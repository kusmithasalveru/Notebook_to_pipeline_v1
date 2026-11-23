import { AuthModal } from './components/auth/AuthModal';
import { ToastContainer } from './components/feedback/ToastContainer';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { FaultInjectionPage } from './pages/FaultInjectionPage';
import { KpiAcceptancePage } from './pages/KpiAcceptancePage';
import { LineagePage } from './pages/LineagePage';
import { NotebooksPage } from './pages/NotebooksPage';
import { PipelinesPage } from './pages/PipelinesPage';
import { ReproductionPage } from './pages/ReproductionPage';
import { RunsPage } from './pages/RunsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const activeSection = useAppStore((s) => s.activeSection);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardPage />;
      case 'notebooks':
        return <NotebooksPage />;
      case 'pipelines':
        return <PipelinesPage />;
      case 'schedules':
        return <SchedulesPage />;
      case 'runs':
        return <RunsPage />;
      case 'lineage':
        return <LineagePage />;
      case 'reproduction':
        return <ReproductionPage />;
      case 'fault-injection':
        return <FaultInjectionPage />;
      case 'kpi':
        return <KpiAcceptancePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0D1B2A] text-slate-900 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{renderSection()}</main>
      </div>
      <AuthModal />
      <ToastContainer />
    </div>
  );
}
