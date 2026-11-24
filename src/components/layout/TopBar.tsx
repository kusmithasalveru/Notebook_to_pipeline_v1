import { Play } from 'lucide-react';
import { type NavSection, useAppStore } from '../../store/useAppStore';
import { APP_NAME } from '../../constants.ts';

const SECTION_META: Record<
  NavSection,
  { breadcrumb: string; title: string; primaryActionLabel: string; primaryTarget: NavSection }
> = {
  dashboard: {
    breadcrumb: `${APP_NAME} / Dashboard`,
    title: 'Reproducible Pipeline Studio',
    primaryActionLabel: 'Build Pipeline',
    primaryTarget: 'pipelines',
  },
  notebooks: {
    breadcrumb: `${APP_NAME} / Authoring / Notebooks`,
    title: 'Notebook Ingestion & Parameter Detection',
    primaryActionLabel: 'Compose DAG',
    primaryTarget: 'pipelines',
  },
  pipelines: {
    breadcrumb: `${APP_NAME} / Authoring / Pipelines`,
    title: 'Pipeline DAG Builder',
    primaryActionLabel: 'Manage Schedules',
    primaryTarget: 'schedules',
  },
  schedules: {
    breadcrumb: `${APP_NAME} / Orchestration / Schedules`,
    title: 'Cron & Interval Triggers',
    primaryActionLabel: 'Inspect Runs',
    primaryTarget: 'runs',
  },
  runs: {
    breadcrumb: `${APP_NAME} / Orchestration / Runs`,
    title: 'Pipeline Run History & Live Logs',
    primaryActionLabel: 'Reproduce Run',
    primaryTarget: 'reproduction',
  },
  lineage: {
    breadcrumb: `${APP_NAME} / Provenance / Lineage`,
    title: 'OpenLineage Provenance Graph',
    primaryActionLabel: 'Reproduce Run',
    primaryTarget: 'reproduction',
  },
  reproduction: {
    breadcrumb: `${APP_NAME} / Provenance / Reproduction`,
    title: 'Historical Run Reproduction & Diff Engine',
    primaryActionLabel: 'Fault Injection',
    primaryTarget: 'fault-injection',
  },
  'fault-injection': {
    breadcrumb: `${APP_NAME} / Assurance / Fault Injection`,
    title: 'Negative Testing & Recovery (NT-1..NT-5)',
    primaryActionLabel: 'View KPI Contract',
    primaryTarget: 'kpi',
  },
  kpi: {
    breadcrumb: `${APP_NAME} / Assurance / KPI & Acceptance`,
    title: 'KPI-1..KPI-6 & Acceptance Gates (AC-1..AC-4)',
    primaryActionLabel: 'View Runs',
    primaryTarget: 'runs',
  },
  settings: {
    breadcrumb: `${APP_NAME} / System / Settings`,
    title: 'Runtime & Provenance Configuration',
    primaryActionLabel: 'Back to Dashboard',
    primaryTarget: 'dashboard',
  },
};

export function TopBar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const meta = SECTION_META[activeSection];

  return (
    <header className="h-16 px-6 lg:px-8 border-b border-slate-200 dark:border-[#1E3A5F] bg-white/90 dark:bg-[#0D1B2A]/95 backdrop-blur-sm flex items-center justify-between gap-8 sticky top-0 z-20">
      <div className="min-w-0 flex items-center gap-3">
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {meta.breadcrumb}
        </span>
        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">/</span>
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {meta.title}
        </h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSection(meta.primaryTarget)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] hover:bg-[#008EB3] dark:hover:bg-[#33DDFF] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0D1B2A]"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{meta.primaryActionLabel}</span>
        </button>
      </div>
    </header>
  );
}
