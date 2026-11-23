import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  GitCompare,
  Image as ImageIcon,
  Play,
  RefreshCw,
  ShieldCheck,
  Table2,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { statusTextClass } from '../components/visualization/DagCanvas';
import type { PipelineRun, ReproductionJob } from '../types/domain';

export function ReproductionPage() {
  const { selectedRunId, setSelectedRunId, setActiveSection, pushToast } = useAppStore();

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [reproductions, setReproductions] = useState<ReproductionJob[]>([]);
  const [sourceRunId, setSourceRunId] = useState<string>(selectedRunId || '');
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [reproducing, setReproducing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [runsRes, reproRes] = await Promise.all([api.listRuns(), api.listReproductions()]);
      setRuns(runsRes.runs);
      setReproductions(reproRes.reproductions);

      const defaultSource =
        (selectedRunId && runsRes.runs.some((r) => r.id === selectedRunId) && selectedRunId) ||
        runsRes.runs.find((r) => r.status === 'succeeded')?.id ||
        runsRes.runs[0]?.id ||
        '';
      setSourceRunId((prev) => prev || defaultSource);

      if (reproRes.reproductions.length > 0) {
        setActiveJobId((prev) =>
          prev && reproRes.reproductions.some((j) => j.id === prev) ? prev : reproRes.reproductions[0].id
        );
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to load reproduction jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      setSourceRunId(selectedRunId);
    }
  }, [selectedRunId]);

  const activeJob = useMemo(
    () => reproductions.find((j) => j.id === activeJobId) || reproductions[0] || null,
    [reproductions, activeJobId]
  );

  const handleReproduce = async () => {
    if (!sourceRunId) return;
    setReproducing(true);
    try {
      const res = await api.startReproduction(sourceRunId);
      setReproductions((prev) => [res.reproduction, ...prev]);
      setActiveJobId(res.reproduction.id);
      pushToast(
        'success',
        `Reproduced ${sourceRunId} → ${res.reproduction.reproducedRunId} (${(res.reproduction.fidelityScore * 100).toFixed(1)}% fidelity)`
      );
      const updatedRuns = await api.listRuns();
      setRuns(updatedRuns.runs);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Reproduction failed');
    } finally {
      setReproducing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* Header & Trigger Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Historical Run Reproduction & Artifact Diff
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Replay any historical run using its frozen container digest, SHA-256 dependency lock, and input dataset hashes to verify bit-for-bit or bounded-tolerance fidelity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select historical run to reproduce"
            value={sourceRunId}
            onChange={(e) => setSourceRunId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.status.toUpperCase()} · {r.pipelineName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleReproduce}
            disabled={!sourceRunId || reproducing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4FF] text-[#0D1B2A] text-xs font-semibold hover:bg-[#33DDFF] disabled:opacity-50 transition-colors"
          >
            {reproducing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {reproducing ? 'Reproducing Run…' : 'Reproduce Selected Run'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#00D4FF]" />
          Loading reproduction history…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left: Reproduction History Ledger */}
          <div className="xl:col-span-4 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Reproduction Verifications
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {reproductions.length} jobs
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F] max-h-[680px] overflow-y-auto">
              {reproductions.map((job) => {
                const selected = activeJob?.id === job.id;
                const fidelityPct = (job.fidelityScore * 100).toFixed(1);
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setActiveJobId(job.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      selected
                        ? 'bg-slate-100 dark:bg-[#1B2A4A]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {job.sourceRunId} → {job.reproducedRunId}
                      </span>
                      <span
                        className={`font-mono tabular-nums text-xs font-bold ${
                          job.fidelityScore >= 0.99
                            ? 'text-emerald-600 dark:text-[#00FF88]'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {fidelityPct}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                      {job.pipelineName}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className={statusTextClass(job.status)}>{job.status}</span>
                      <span>{new Date(job.completedAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Side-by-Side Diff Workbench */}
          <div className="xl:col-span-8 space-y-5">
            {!activeJob ? (
              <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Select a historical run above and click Reproduce Selected Run to generate a side-by-side verification report.
              </div>
            ) : (
              <>
                {/* Fidelity & Determinism Flags */}
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Verification Job · {activeJob.id}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {activeJob.sourceRunId} vs {activeJob.reproducedRunId}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {activeJob.summaryNote}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                        Fidelity Score
                      </div>
                      <div
                        className={`text-3xl font-mono font-bold tabular-nums ${
                          activeJob.fidelityScore >= 0.99
                            ? 'text-emerald-600 dark:text-[#00FF88]'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {(activeJob.fidelityScore * 100).toFixed(1)}%
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRunId(activeJob.reproducedRunId);
                          setActiveSection('lineage');
                        }}
                        className="mt-1 text-[11px] font-mono text-[#008EB3] dark:text-[#00D4FF] hover:underline"
                      >
                        Inspect lineage graph →
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Environment Digest',
                        ok: activeJob.environmentMatch,
                        detail: activeJob.environmentMatch ? 'Exact container SHA match' : 'Drift detected',
                      },
                      {
                        label: 'Dependency Lock',
                        ok: activeJob.dependencyLockMatch,
                        detail: activeJob.dependencyLockMatch ? 'SHA-256 lock verified' : 'Package mismatch',
                      },
                      {
                        label: 'Input Dataset Hash',
                        ok: activeJob.inputDatasetHashMatch,
                        detail: activeJob.inputDatasetHashMatch ? 'Immutable snapshot verified' : 'Input hash changed',
                      },
                    ].map((flag) => (
                      <div
                        key={flag.label}
                        className="p-3 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] flex items-start gap-2.5"
                      >
                        {flag.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-[#00FF88] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {flag.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {flag.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metric Deltas */}
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-[#00D4FF]" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Metric Delta Verification
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Tolerance ε ≤ 0.005
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                          <th className="py-2.5 px-4">Metric</th>
                          <th className="py-2.5 px-4 text-right">Original ({activeJob.sourceRunId})</th>
                          <th className="py-2.5 px-4 text-right">Reproduced ({activeJob.reproducedRunId})</th>
                          <th className="py-2.5 px-4 text-right">Delta (Δ)</th>
                          <th className="py-2.5 px-4 text-right">Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] font-mono text-xs tabular-nums">
                        {activeJob.metricDeltas.map((m) => (
                          <tr key={m.metric} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40">
                            <td className="py-2.5 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                              {m.metric}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                              {m.original.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                              {m.reproduced.toFixed(4)}
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right ${
                                Math.abs(m.delta) === 0
                                  ? 'text-emerald-600 dark:text-[#00FF88]'
                                  : m.withinTolerance
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {m.delta >= 0 ? `+${m.delta.toFixed(4)}` : m.delta.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span
                                className={
                                  m.withinTolerance
                                    ? 'text-emerald-600 dark:text-[#00FF88]'
                                    : 'text-rose-600 dark:text-rose-400'
                                }
                              >
                                {m.withinTolerance ? 'PASS' : 'DRIFT'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabular Output Diff */}
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-[#00D4FF]" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Tabular Output Side-by-Side Diff
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {activeJob.tableDiff.rows.filter((r) => r.status === 'unchanged').length}/
                      {activeJob.tableDiff.rows.length} rows bit-identical
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                          <th className="py-2.5 px-4">Row Key</th>
                          <th className="py-2.5 px-4">Status</th>
                          {activeJob.tableDiff.columns.map((col) => (
                            <th key={col} className="py-2.5 px-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] font-mono text-xs tabular-nums">
                        {activeJob.tableDiff.rows.map((row) => (
                          <tr
                            key={row.rowKey}
                            className={
                              row.status === 'changed'
                                ? 'bg-amber-50/70 dark:bg-amber-950/20'
                                : 'hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40'
                            }
                          >
                            <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {row.rowKey}
                            </td>
                            <td className="py-2.5 px-4 uppercase text-[11px]">
                              <span
                                className={
                                  row.status === 'unchanged'
                                    ? 'text-emerald-600 dark:text-[#00FF88]'
                                    : 'text-amber-600 dark:text-amber-400'
                                }
                              >
                                {row.status}
                              </span>
                            </td>
                            {activeJob.tableDiff.columns.map((col) => {
                              const cell = row.columns[col];
                              if (!cell) {
                                return (
                                  <td key={col} className="py-2.5 px-4 text-slate-400">
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={col} className="py-2.5 px-4">
                                  {cell.changed ? (
                                    <div className="space-y-0.5">
                                      <div className="text-rose-600 dark:text-rose-400 line-through">
                                        {cell.original}
                                      </div>
                                      <div className="text-emerald-600 dark:text-[#00FF88]">
                                        {cell.reproduced}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-700 dark:text-slate-300">{cell.reproduced}</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Image & Plot Hash Comparison */}
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#00D4FF]" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Rendered Figure & Plot Hash Comparison
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Perceptual + SHA-256 checksum
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeJob.imageHashes.map((img) => (
                      <div
                        key={img.artifactName}
                        className="p-4 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {img.artifactName}
                          </span>
                          <span
                            className={`text-[11px] font-mono tabular-nums font-semibold ${
                              img.exactMatch
                                ? 'text-emerald-600 dark:text-[#00FF88]'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {img.pixelSimilarityPct.toFixed(2)}% · {img.exactMatch ? 'EXACT' : 'SIMILAR'}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                          <div className="truncate">
                            Orig: <span className="text-slate-700 dark:text-slate-300">{img.originalHash}</span>
                          </div>
                          <div className="truncate">
                            Repr: <span className="text-slate-700 dark:text-slate-300">{img.reproducedHash}</span>
                          </div>
                        </div>
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-[#00FF88]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Deterministic matplotlib seed & DPI verified</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
