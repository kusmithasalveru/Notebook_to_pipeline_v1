import { useEffect, useState } from 'react';
import { History, Play, RefreshCw, Square, Terminal } from 'lucide-react';
import { statusTextClass } from '../components/visualization/DagCanvas';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { ExecutionStatus, PipelineDefinition, PipelineRun, RunLogEntry } from '../types/domain';

export function RunsPage() {
  const selectedRunId = useAppStore((s) => s.selectedRunId);
  const setSelectedRunId = useAppStore((s) => s.setSelectedRunId);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const pushToast = useAppStore((s) => s.pushToast);

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ExecutionStatus>('all');
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    Promise.all([api.listRuns(), api.listPipelines()]).then(([rRes, pRes]) => {
      setRuns(rRes.runs);
      setPipelines(pRes.pipelines);
      if (!selectedRunId && rRes.runs[0]) {
        setSelectedRunId(rRes.runs[0].id);
      }
    });
  }, []);

  // Live WebSocket stream for /ws/runs
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/runs`);
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'run_started' && msg.run) {
          setRuns((prev) => [msg.run, ...prev.filter((r) => r.id !== msg.run.id)]);
        } else if (msg.type === 'run_log' && msg.runId && msg.log) {
          const logEntry = msg.log as RunLogEntry;
          setRuns((prev) =>
            prev.map((r) =>
              r.id === msg.runId
                ? {
                    ...r,
                    stepStatuses: msg.stepStatuses || r.stepStatuses,
                    logs: r.logs.some((l) => l.id === logEntry.id) ? r.logs : [...r.logs, logEntry],
                  }
                : r
            )
          );
        } else if (msg.type === 'run_completed' && msg.run) {
          setRuns((prev) => prev.map((r) => (r.id === msg.run.id ? msg.run : r)));
          pushToast('success', `Run ${msg.run.id} finished with status: ${msg.run.status}`);
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [pushToast]);

  const filteredRuns = runs.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const selectedRun = runs.find((r) => r.id === selectedRunId) || filteredRuns[0] || null;

  const handleManualTrigger = async () => {
    const pl = pipelines[0];
    if (!pl) return;
    const res = await api.triggerRun({ pipelineId: pl.id, triggeredBy: 'manual' });
    setSelectedRunId(res.run.id);
    pushToast('info', `Started run ${res.run.id} — streaming live logs`);
  };

  const handleCancel = async (id: string) => {
    await api.cancelRun(id);
    pushToast('info', `Cancelled run ${id}`);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1440px]">
      {/* Top Filter & Manual Run Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#132238] border border-slate-200 dark:border-[#1E3A5F]">
          {(['all', 'running', 'succeeded', 'reproduced', 'degraded', 'failed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-mono capitalize rounded-md transition-colors ${
                statusFilter === st
                  ? 'bg-white dark:bg-[#1B2A4A] text-[#007FA3] dark:text-[#00D4FF] font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-mono flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#00FF88]' : 'bg-amber-400'}`} aria-hidden="true" />
            <span>{wsConnected ? 'Live Log Socket Connected' : 'Connecting Socket'}</span>
          </div>
          <button
            type="button"
            onClick={handleManualTrigger}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Trigger Manual Run</span>
          </button>
        </div>
      </div>

      {/* Main Split: Run History Table + Live Logs & Frozen Environment Manifest */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1E3A5F] text-sm font-semibold text-slate-900 dark:text-slate-100">
            Historical &amp; Active Runs ({filteredRuns.length})
          </div>
          <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F] max-h-[640px] overflow-y-auto">
            {filteredRuns.map((run) => {
              const active = selectedRun?.id === run.id;
              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    active ? 'bg-[#00D4FF]/8' : 'hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                      {run.id}
                    </span>
                    <span className={`text-xs font-mono font-semibold capitalize ${statusTextClass(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">{run.pipelineName}</div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between tabular-nums">
                    <span>{run.triggeredBy} · {run.durationSec.toFixed(1)}s</span>
                    <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-7 space-y-5">
          {selectedRun && (
            <>
              {/* Header & Quick Links */}
              <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                      {selectedRun.id}
                    </h3>
                    <span className={`text-xs font-mono font-semibold capitalize ${statusTextClass(selectedRun.status)}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {selectedRun.pipelineName} · Commit {selectedRun.environment.gitCommit} · {selectedRun.durationSec.toFixed(1)}s
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedRun.status === 'running' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(selectedRun.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/50 text-rose-500"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRunId(selectedRun.id);
                      setActiveSection('lineage');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#1E3A5F] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Lineage Graph</span>
                  </button>
                  {selectedRun.status === 'reproduced' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#132238] border border-slate-200 dark:border-[#1E3A5F]">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reproduced from {selectedRun.reproductionOfRunId || 'previous run'}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRunId(selectedRun.id);
                        setActiveSection('reproduction');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reproduce Run</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Log Stream Console */}
              <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-[#008EB3] dark:text-[#00D4FF]" />
                    <span>Execution Logs ({selectedRun.logs.length})</span>
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    {Object.entries(selectedRun.stepStatuses).map(([stepId, st]) => (
                      <span key={stepId} className={statusTextClass(st)}>
                        {stepId}: {st}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-[#0B1624] font-mono text-xs space-y-2 max-h-56 overflow-y-auto">
                  {selectedRun.logs.map((l) => (
                    <div key={l.id} className="flex items-start gap-2.5 leading-relaxed log-line-enter">
                      <span className="text-slate-400 shrink-0 tabular-nums">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${
                          l.level === 'ERROR'
                            ? 'text-rose-500'
                            : l.level === 'WARN'
                              ? 'text-amber-500'
                              : 'text-[#008EB3] dark:text-[#00D4FF]'
                        }`}
                      >
                        [{l.level}]
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 break-words">{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frozen Environment Manifest & Dependency Lock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4 space-y-2 text-xs">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Frozen Environment Manifest
                  </h4>
                  <div className="space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    <div>Python: {selectedRun.environment.pythonVersion}</div>
                    <div>OS: {selectedRun.environment.osRelease}</div>
                    <div className="truncate">Image: {selectedRun.environment.containerImage}</div>
                    <div className="text-[#008EB3] dark:text-[#00D4FF]">Digest: {selectedRun.environment.containerDigest}</div>
                    <div>Hardware: {selectedRun.environment.hardwareProfile}</div>
                    <div>Papermill: {selectedRun.environment.papermillVersion}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Dependency Lock ({selectedRun.dependencyLock.entries.length} pkgs)
                    </h4>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-[#00FF88]">
                      {selectedRun.dependencyLock.lockfileHash}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 dark:divide-[#1E3A5F] font-mono text-[11px]">
                    {selectedRun.dependencyLock.entries.map((d) => (
                      <div key={d.packageName} className="py-1 flex items-center justify-between gap-2">
                        <span className="text-slate-800 dark:text-slate-200">
                          {d.packageName}=={d.version}
                        </span>
                        <span className="text-slate-400">{d.sha256.slice(0, 15)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
