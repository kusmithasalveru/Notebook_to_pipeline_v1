import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  RefreshCw,
  Target,
} from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { AcceptanceCondition, CapstoneDocument, KpiSnapshot } from '../types/domain';

interface NormalizedKpiPoint {
  id: string;
  measure: string;
  unit: string;
  baselineAttainment: number;
  achievedAttainment: number;
  baselineRaw: number;
  targetRaw: number;
  achievedRaw: number;
  targetRule: string;
}

function normalizeToTargetPct(kpi: KpiSnapshot, value: number): number {
  if (kpi.direction === 'higher') {
    if (kpi.targetNumeric <= 0) return 100;
    return Math.min(125, Math.round((value / kpi.targetNumeric) * 100));
  }
  // Lower is better: target / value * 100 (capped cleanly for chart readability)
  if (value <= 0) return 120;
  return Math.min(125, Math.round((kpi.targetNumeric / value) * 100));
}

export function KpiAcceptancePage() {
  const { pushToast } = useAppStore();

  const [kpis, setKpis] = useState<KpiSnapshot[]>([]);
  const [acceptanceConditions, setAcceptanceConditions] = useState<AcceptanceCondition[]>([]);
  const [documents, setDocuments] = useState<CapstoneDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getKpiSummary()
      .then((res) => {
        setKpis(res.kpis);
        setAcceptanceConditions(res.acceptanceConditions);
        setDocuments(res.documents);
      })
      .catch((err) => {
        pushToast('error', err instanceof Error ? err.message : 'Failed to load KPI summary');
      })
      .finally(() => setLoading(false));
  }, [pushToast]);

  const chartData: NormalizedKpiPoint[] = useMemo(
    () =>
      kpis.map((k) => ({
        id: k.id,
        measure: k.measure,
        unit: k.unit,
        baselineAttainment: normalizeToTargetPct(k, k.baselineValue),
        achievedAttainment: normalizeToTargetPct(k, k.currentValue),
        baselineRaw: k.baselineValue,
        targetRaw: k.targetNumeric,
        achievedRaw: k.currentValue,
        targetRule: k.targetRule,
      })),
    [kpis]
  );

  const kpisPassed = kpis.filter((k) => k.status === 'pass').length;
  const acsPassed = acceptanceConditions.filter((ac) => ac.status === 'pass').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            KPI Evaluation & Acceptance Conditions (AC-1 – AC-4)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quantitative benchmark tracking for NoteOps across reproducibility fidelity, lineage completeness, schedule reliability, and fault recovery.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span>
            KPIs Passed:{' '}
            <strong className="text-emerald-600 dark:text-[#00FF88]">
              {kpisPassed}/{kpis.length}
            </strong>
          </span>
          <span>·</span>
          <span>
            Acceptance Gates:{' '}
            <strong className="text-emerald-600 dark:text-[#00FF88]">
              {acsPassed}/{acceptanceConditions.length}
            </strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#00D4FF]" />
          Loading KPI evaluation matrix…
        </div>
      ) : (
        <>
          {/* Chart + Acceptance Condition Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#00D4FF]" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Baseline vs Achieved Target Attainment (100% = Target Gate)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Normalized across KPI-1..KPI-6
                </span>
              </div>

              <div className="h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" opacity={0.35} />
                    <XAxis
                      dataKey="id"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#94A3B8' }}
                    />
                    <YAxis
                      domain={[0, 130]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#94A3B8' }}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="#FF6B35"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Target Gate (100%)',
                        position: 'insideTopRight',
                        fill: '#FF6B35',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload as NormalizedKpiPoint;
                        return (
                          <div className="rounded-lg border border-[#1E3A5F] bg-[#0D1B2A] px-3 py-2.5 text-xs shadow-lg">
                            <div className="font-mono font-bold text-[#00D4FF]">
                              {pt.id} · {pt.measure}
                            </div>
                            <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-200 tabular-nums">
                              <div>
                                Baseline: {pt.baselineRaw} {pt.unit} ({pt.baselineAttainment}%)
                              </div>
                              <div>
                                Target: {pt.targetRule}
                              </div>
                              <div className="text-[#00FF88]">
                                Achieved: {pt.achievedRaw} {pt.unit} ({pt.achievedAttainment}%)
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }} />
                    <Bar dataKey="baselineAttainment" name="Baseline (% of Target)" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="achievedAttainment" name="NoteOps Achieved (% of Target)" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AC-1..AC-4 Acceptance Grid */}
            <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
              {acceptanceConditions.map((ac) => (
                <div
                  key={ac.id}
                  className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#008EB3] dark:text-[#00D4FF]">
                      {ac.id} · {ac.title}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase font-semibold text-emerald-600 dark:text-[#00FF88]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {ac.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ac.description}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#1E3A5F] text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Evidence: {ac.evidenceSummary}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI-1..KPI-6 Full Matrix Table */}
          <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                NoteOps Key Performance Indicator Matrix
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Baseline vs Target vs Live Achieved
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                    <th className="py-2.5 px-4">KPI</th>
                    <th className="py-2.5 px-4">Measure</th>
                    <th className="py-2.5 px-4 text-right">Baseline</th>
                    <th className="py-2.5 px-4">Target Rule</th>
                    <th className="py-2.5 px-4 text-right">Achieved</th>
                    <th className="py-2.5 px-4">Acceptance Mapping</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] text-xs">
                  {kpis.map((kpi) => (
                    <tr key={kpi.id} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40">
                      <td className="py-3 px-4 font-mono font-bold text-[#008EB3] dark:text-[#00D4FF]">
                        {kpi.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {kpi.measure}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-500 dark:text-slate-400">
                        {kpi.baselineValue} {kpi.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {kpi.targetRule}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-emerald-600 dark:text-[#00FF88]">
                        {kpi.currentValue} {kpi.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {kpi.acceptanceConditions.join(' · ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-right uppercase font-semibold">
                        <span
                          className={
                            kpi.status === 'pass'
                              ? 'text-emerald-600 dark:text-[#00FF88]'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {kpi.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Capstone Metadata & Attached Review Documents */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#00D4FF]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Capstone Project Attribution
                </h3>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Project ID:</span>{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">NoteOps</strong> · Turning Notebooks into Reproducible Scheduled Pipelines
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Institution:</span>{' '}
                  KL University · Dept. of Computer Science & Engineering (Software Modelling & DevOps)
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Team & Guide:</span>{' '}
                  Team C-162 · Guide: Dr. K.V.D. Kiran
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#1E3A5F] font-mono text-[11px] text-slate-500 dark:text-slate-400 grid grid-cols-2 gap-1.5">
                <span>2200032535 · K. Harshitha</span>
                <span>2200030847 · D. Sai Teja</span>
                <span>2200031521 · P. Naga Charan</span>
                <span>2200030715 · M. Vamsi Krishna</span>
              </div>
            </div>

            <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#00D4FF]" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Capstone Reference Artifacts & Review PDFs
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {documents.length} files
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3.5 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] hover:border-[#00D4FF] transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#008EB3] dark:group-hover:text-[#00D4FF] truncate">
                        {doc.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {doc.subtitle}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00D4FF] shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
