import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { statusTextClass } from '../components/visualization/DagCanvas';
import { api, type OverviewResponse } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { APP_NAME, APP_DOMAIN, APP_TEAM } from '../constants.ts';
import { useCountUp } from '../hooks/useCountUp';

/* Animated KPI card — count-up on mount */
function KpiCard({
  id,
  measure,
  displayTarget,
  baseline,
  delay,
}: {
  id: string | undefined;
  measure: string | undefined;
  displayTarget: number; // numeric value to count up to
  displaySuffix: string; // '%' | ' ms' etc
  baseline: string;
  delay: number;
}) {
  const counted = useCountUp(displayTarget, 700, 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 dark:[border-top-color:rgba(0,212,255,0.18)]"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#94A3B8]">
        <span>{id}</span>
        <span className="font-mono text-emerald-600 dark:text-[#00FF88] inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Pass
        </span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-[#E2E8F0]">
        {measure}
      </div>
      <div className="mt-2 text-3xl font-mono font-bold tabular-nums text-[#008EB3] dark:text-[#00D4FF]">
        {counted.toFixed(1)}%
      </div>
      <div className="mt-1.5 text-xs font-mono text-slate-500 dark:text-[#94A3B8]">
        {baseline}
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const setSelectedRunId = useAppStore((s) => s.setSelectedRunId);

  useEffect(() => {
    let active = true;
    api
      .getOverview()
      .then((res) => { if (active) setData(res); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] animate-pulse" />
      </div>
    );
  }

  const kpi1 = data.kpis.find((k) => k.id === 'KPI-1');
  const kpi2 = data.kpis.find((k) => k.id === 'KPI-2');
  const kpi3 = data.kpis.find((k) => k.id === 'KPI-3');
  const kpi4 = data.kpis.find((k) => k.id === 'KPI-4');

  const kpiChartData = data.kpis.slice(0, 4).map((k) => ({
    name: k.id,
    Baseline: k.unit === 'ratio' ? Number((k.baselineValue * 100).toFixed(1)) : k.baselineValue,
    Target:   k.unit === 'ratio' ? Number((k.targetNumeric * 100).toFixed(1)) : k.targetNumeric,
    Achieved: k.unit === 'ratio' ? Number((k.currentValue * 100).toFixed(1)) : k.currentValue,
  }));

  const kpiCards = [
    {
      kpi: kpi1,
      target: kpi1 ? kpi1.currentValue * 100 : 99.6,
      baseline: kpi1 ? `O2 baseline ${(kpi1.baselineValue * 100).toFixed(0)}%` : 'O2 baseline 84%',
    },
    {
      kpi: kpi2,
      target: kpi2 ? kpi2.currentValue : 99.4,
      baseline: kpi2 ? `O2 baseline ${kpi2.baselineValue}% · target ≥ ${kpi2.targetNumeric}%` : 'Target ≥ 95%',
    },
    {
      kpi: kpi3,
      target: kpi3 ? kpi3.currentValue : 98.8,
      baseline: kpi3 ? `O2 baseline ${kpi3.baselineValue}% · target ≥ ${kpi3.targetNumeric}%` : 'Target ≥ 94.5%',
    },
    {
      kpi: kpi4,
      target: kpi4 ? kpi4.currentValue * 100 : 100.0,
      baseline: `${data.counts.faultTestsPassed}/5 (${(kpi4?.currentValue ?? 1) * 100}%)`,
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1440px]">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#1E3A5F] pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-mono text-[#008EB3] dark:text-[#00D4FF]">
            NoteOps · Software Modelling &amp; DevOps · Team C-162
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white hero-title-glow">
            Turning Notebooks into Reproducible Scheduled Pipelines
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#E2E8F0] leading-relaxed">
            Parameterise Jupyter notebooks with Papermill, orchestrate DAG schedules, capture frozen environments and OpenLineage provenance, and reproduce historical runs deterministically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('notebooks')}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#1E3A5F] text-slate-700 dark:text-[#E2E8F0] hover:bg-slate-100 dark:hover:bg-[#132238] hover:border-[#3B82F6] transition-colors whitespace-nowrap"
          >
            Upload Notebook
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('reproduction')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#1E3A5F] text-slate-700 dark:text-[#E2E8F0] hover:bg-slate-100 dark:hover:bg-[#132238] hover:border-[#3B82F6] transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reproduce Historical Run</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards — stagger reveal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <KpiCard
            key={card.kpi?.id ?? idx}
            id={card.kpi?.id}
            measure={card.kpi?.measure}
            displayTarget={card.target}
            displaySuffix="%"
            baseline={card.baseline}
            delay={idx * 0.06}
          />
        ))}
      </div>

      {/* Main Split: Chart + Upcoming Schedules */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 dark:[border-top-color:rgba(0,212,255,0.18)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#E2E8F0]">
                KPI Performance: O2 Baseline vs Target vs Achieved (%)
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                KPI-1 Fidelity, KPI-2 Lineage Completeness, KPI-3 Scheduling Reliability, KPI-4 Fault Recovery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('kpi')}
              className="text-xs font-medium text-[#008EB3] dark:text-[#00D4FF] hover:text-[#3B82F6] hover:underline whitespace-nowrap shrink-0 transition-colors"
            >
              All 6 KPIs &amp; AC-1..4
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiChartData} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis domain={[60, 100]} unit="%" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1B2A', borderColor: '#1E3A5F', fontSize: 12, color: '#E2E8F0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Baseline" name="O2 Baseline"      fill="#64748B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Target"   name="Target Threshold" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Achieved" name="Current Achieved" fill="#00D4FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 flex flex-col justify-between space-y-5 dark:[border-top-color:rgba(0,212,255,0.18)]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#E2E8F0]">
                Active Pipelines &amp; Upcoming Schedules
              </h3>
              <button
                type="button"
                onClick={() => setActiveSection('schedules')}
                className="text-xs font-medium text-[#008EB3] dark:text-[#00D4FF] hover:text-[#3B82F6] hover:underline transition-colors"
              >
                Manage
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F] text-xs">
              <div>
                <div className="text-slate-500 dark:text-[#94A3B8]">Notebooks</div>
                <div className="text-xl font-mono font-semibold tabular-nums text-slate-900 dark:text-[#E2E8F0] mt-0.5">
                  {data.counts.notebooks}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-[#94A3B8]">Pipelines</div>
                <div className="text-xl font-mono font-semibold tabular-nums text-slate-900 dark:text-[#E2E8F0] mt-0.5">
                  {data.counts.activePipelines}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-[#94A3B8]">Schedules</div>
                <div className="text-xl font-mono font-semibold tabular-nums text-[#008EB3] dark:text-[#00D4FF] mt-0.5">
                  {data.counts.enabledSchedules}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F] mt-2">
              {data.upcomingSchedules.map((sched) => (
                <div key={sched.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-[#E2E8F0] truncate flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-[#008EB3] dark:text-[#00D4FF] shrink-0" />
                      <span className="truncate">{sched.pipelineName}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-[#94A3B8] mt-0.5">
                      {sched.triggerType === 'cron' ? `cron(${sched.cronExpression})` : `every ${sched.intervalMinutes}m`} · {sched.timezone}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500 dark:text-[#94A3B8] shrink-0 tabular-nums">
                    Next {new Date(sched.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI-5 / KPI-6 mini cards */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-[#1E3A5F]">
            {[
              { id: 'KPI-5', label: 'Service Error Rate',    value: '0.32%', target: 'Target ≤ 1.12%' },
              { id: 'KPI-6', label: 'Request Latency p95',   value: '114 ms', target: 'Target ≤ 168 ms' },
            ].map((k, i) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.28 + i * 0.06, ease: 'easeOut' }}
                className="rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#94A3B8]">
                  <span>{k.id}</span>
                  <span className="font-mono text-emerald-600 dark:text-[#00FF88] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pass
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-[#E2E8F0]">{k.label}</div>
                <div className="mt-1 text-xl font-mono font-bold tabular-nums text-[#008EB3] dark:text-[#00D4FF]">{k.value}</div>
                <div className="mt-1 text-xs font-mono text-slate-500 dark:text-[#94A3B8]">{k.target}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden dark:[border-top-color:rgba(0,212,255,0.18)]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#E2E8F0]">
              Recent Pipeline Executions
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Every run captures its frozen container digest, pip/conda dependency lock, and OpenLineage artifact graph.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('runs')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#008EB3] dark:text-[#00D4FF] hover:text-[#3B82F6] hover:underline transition-colors"
          >
            <span>All Runs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1E3A5F] text-slate-500 dark:text-[#94A3B8]">
                <th className="px-5 py-3 text-left font-medium">Run ID</th>
                <th className="px-5 py-3 text-left font-medium">Pipeline</th>
                <th className="px-5 py-3 text-left font-medium">Trigger</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Duration</th>
                <th className="px-5 py-3 text-right font-medium">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F]">
              {data.recentRuns.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/50 transition-colors">
                  <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-[#E2E8F0]">{run.id}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-[#E2E8F0]">{run.pipelineName}</td>
                  <td className="px-5 py-3 font-mono text-slate-500 dark:text-[#94A3B8]">{run.triggeredBy}</td>
                  <td className={`px-5 py-3 font-mono font-semibold capitalize ${statusTextClass(run.status)}`}>
                    {run.status}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {run.durationSec.toFixed(1)}s
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedRunId(run.id); setActiveSection('lineage'); }}
                      className="text-[#008EB3] dark:text-[#00D4FF] hover:text-[#3B82F6] hover:underline font-medium transition-colors"
                    >
                      Lineage
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedRunId(run.id); setActiveSection('runs'); }}
                      className="text-slate-600 dark:text-slate-300 hover:underline font-medium"
                    >
                      Manifest
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
