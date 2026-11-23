import { useEffect, useState } from 'react';
import { CalendarClock, Play, Plus, Trash2 } from 'lucide-react';
import { statusTextClass } from '../components/visualization/DagCanvas';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { PipelineDefinition, ScheduleRecord } from '../types/domain';

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [triggerType, setTriggerType] = useState<'cron' | 'interval'>('cron');
  const [cronExpression, setCronExpression] = useState('0 6 * * *');
  const [intervalMinutes, setIntervalMinutes] = useState(360);
  const [overrideKnn, setOverrideKnn] = useState('1');
  const [overrideSeed, setOverrideSeed] = useState('42');
  const [creating, setCreating] = useState(false);

  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const setSelectedRunId = useAppStore((s) => s.setSelectedRunId);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    Promise.all([api.listSchedules(), api.listPipelines()]).then(([sRes, pRes]) => {
      setSchedules(sRes.schedules);
      setPipelines(pRes.pipelines);
      if (pRes.pipelines[0]) setPipelineId(pRes.pipelines[0].id);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineId) return;
    setCreating(true);
    try {
      const res = await api.createSchedule({
        pipelineId,
        triggerType,
        cronExpression,
        intervalMinutes: triggerType === 'interval' ? intervalMinutes : undefined,
        timezone: 'UTC',
        parameterOverrides: {
          knn_neighbors: overrideKnn,
          random_seed: overrideSeed,
        },
      });
      setSchedules((prev) => [res.schedule, ...prev]);
      pushToast('success', `Attached schedule (${res.schedule.cronExpression}) to ${res.schedule.pipelineName}`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (sched: ScheduleRecord) => {
    const res = await api.updateSchedule(sched.id, { enabled: !sched.enabled });
    setSchedules((prev) => prev.map((s) => (s.id === sched.id ? res.schedule : s)));
    pushToast('info', `${sched.pipelineName} schedule ${res.schedule.enabled ? 'enabled' : 'paused'}`);
  };

  const handleTrigger = async (sched: ScheduleRecord) => {
    const res = await api.triggerRun({
      pipelineId: sched.pipelineId,
      triggeredBy: 'scheduled',
      scheduleId: sched.id,
      parameterOverrides: sched.parameterOverrides,
    });
    setSelectedRunId(res.run.id);
    pushToast('success', `Triggered scheduled run ${res.run.id}`);
    setActiveSection('runs');
  };

  const handleDelete = async (id: string) => {
    await api.deleteSchedule(id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    pushToast('info', 'Schedule removed');
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1440px]">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Create Schedule Form */}
        <form
          onSubmit={handleCreate}
          className="xl:col-span-4 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-4 h-fit"
        >
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Attach Cron / Interval Schedule
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure automated Airflow / Argo-style execution with explicit parameter overrides.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Pipeline
            </label>
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0D1B2A]">
            {(['cron', 'interval'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTriggerType(t)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize ${
                  triggerType === t
                    ? 'bg-white dark:bg-[#1B2A4A] text-[#007FA3] dark:text-[#00D4FF]'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {triggerType === 'cron' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cron Expression (UTC)
              </label>
              <input
                type="text"
                required
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 6 * * *"
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Interval (minutes)
              </label>
              <input
                type="number"
                min={5}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                knn_neighbors
              </label>
              <input
                type="text"
                value={overrideKnn}
                onChange={(e) => setOverrideKnn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                random_seed
              </label>
              <input
                type="text"
                value={overrideSeed}
                onChange={(e) => setOverrideSeed(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] disabled:opacity-60"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creating ? 'Creating...' : 'Create Schedule'}</span>
          </button>
        </form>

        {/* Active Schedules Table */}
        <div className="xl:col-span-8 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E3A5F]">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Configured Pipeline Schedules ({schedules.length})
            </h3>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F]">
            {schedules.map((sched) => (
              <div key={sched.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-[#008EB3] dark:text-[#00D4FF]" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {sched.pipelineName}
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        sched.enabled ? 'text-emerald-600 dark:text-[#00FF88]' : 'text-slate-400'
                      }`}
                    >
                      · {sched.enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {sched.triggerType === 'cron'
                      ? `cron(${sched.cronExpression})`
                      : `interval(${sched.intervalMinutes}m)`}{' '}
                    · {sched.timezone} · Overrides: {JSON.stringify(sched.parameterOverrides)}
                  </div>
                  {sched.lastRunId && (
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Last run:{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRunId(sched.lastRunId!);
                          setActiveSection('runs');
                        }}
                        className="text-[#008EB3] dark:text-[#00D4FF] hover:underline"
                      >
                        {sched.lastRunId}
                      </button>{' '}
                      (<span className={statusTextClass(sched.lastRunStatus || 'idle')}>{sched.lastRunStatus}</span>)
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(sched)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#1E3A5F] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
                  >
                    {sched.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrigger(sched)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sched.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                    aria-label="Delete schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
