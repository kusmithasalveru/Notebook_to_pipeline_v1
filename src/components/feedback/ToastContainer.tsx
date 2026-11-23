import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium shadow-lg backdrop-blur-md ${
            t.kind === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
              : t.kind === 'success'
                ? 'bg-[#0D2824]/95 border-[#00FF88]/40 text-emerald-100'
                : 'bg-[#132238]/95 border-[#00D4FF]/40 text-slate-100'
          }`}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
