import {
  Activity,
  BookOpen,
  CalendarClock,
  CheckSquare,
  GitBranch,
  History,
  Moon,
  PlayCircle,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sun,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { type NavSection, useAppStore } from '../../store/useAppStore';

const NAV_ITEMS: { id: NavSection; label: string; group: string; icon: typeof Activity }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', icon: Activity },
  { id: 'notebooks', label: 'Notebooks', group: 'Authoring', icon: BookOpen },
  { id: 'pipelines', label: 'Pipelines', group: 'Authoring', icon: GitBranch },
  { id: 'schedules', label: 'Schedules', group: 'Orchestration', icon: CalendarClock },
  { id: 'runs', label: 'Runs', group: 'Orchestration', icon: PlayCircle },
  { id: 'lineage', label: 'Lineage', group: 'Provenance', icon: History },
  { id: 'reproduction', label: 'Reproduction', group: 'Provenance', icon: RefreshCw },
  { id: 'fault-injection', label: 'Fault Injection', group: 'Assurance', icon: ShieldAlert },
  { id: 'kpi', label: 'KPI & Acceptance', group: 'Assurance', icon: CheckSquare },
  { id: 'settings', label: 'Settings', group: 'System', icon: Settings },
];

export function Sidebar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const user = useAppStore((s) => s.user);
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen);
  const clearAuthSession = useAppStore((s) => s.clearAuthSession);

  const groups = Array.from(new Set(NAV_ITEMS.map((i) => i.group)));

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0B1624] flex flex-col justify-between h-screen sticky top-0 select-none">
      <div className="overflow-y-auto">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-[#1E3A5F]">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] rounded-md"
          >
            <div className="w-8 h-8 rounded-lg bg-[#00D4FF]/15 border border-[#00D4FF]/40 flex items-center justify-center text-[#008EB3] dark:text-[#00D4FF] font-mono font-semibold text-xs">
              C39
            </div>
            <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              CLOUD-39 Studio
            </span>
          </button>
        </div>

        <nav className="p-3 space-y-4" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group}>
              <div className="px-3 mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {group}
              </div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] ${
                        active
                          ? 'bg-[#00D4FF]/12 text-[#007FA3] dark:text-[#00D4FF]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#132238] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-[#1E3A5F] space-y-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#132238] transition-colors"
        >
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </span>
        </button>

        {user ? (
          <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#132238] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-[#00FF88] shrink-0" />
                <span className="truncate">{user.name}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={clearAuthSession}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#132238] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign In or Register</span>
          </button>
        )}
      </div>
    </aside>
  );
}
