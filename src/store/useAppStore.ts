import { create } from 'zustand';
import type { AuthUser } from '../types/domain';

export type NavSection =
  | 'dashboard'
  | 'notebooks'
  | 'pipelines'
  | 'schedules'
  | 'runs'
  | 'lineage'
  | 'reproduction'
  | 'fault-injection'
  | 'kpi'
  | 'settings';

export interface ToastMessage {
  id: string;
  kind: 'info' | 'success' | 'error';
  message: string;
}

interface StudioState {
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;

  // Context handoffs between screens (e.g., Runs -> Lineage / Reproduction)
  selectedRunId: string | null;
  setSelectedRunId: (runId: string | null) => void;

  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Auth held strictly in memory
  user: AuthUser | null;
  authToken: string | null;
  authModalOpen: boolean;
  setAuthSession: (user: AuthUser, token: string) => void;
  clearAuthSession: () => void;
  setAuthModalOpen: (open: boolean) => void;

  toasts: ToastMessage[];
  pushToast: (kind: ToastMessage['kind'], message: string) => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<StudioState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),

  selectedRunId: null,
  setSelectedRunId: (runId) => set({ selectedRunId: runId }),

  theme: 'dark',
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),

  user: null,
  authToken: null,
  authModalOpen: false,
  setAuthSession: (user, token) => set({ user, authToken: token, authModalOpen: false }),
  clearAuthSession: () => set({ user: null, authToken: null }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  toasts: [],
  pushToast: (kind, message) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, kind, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
