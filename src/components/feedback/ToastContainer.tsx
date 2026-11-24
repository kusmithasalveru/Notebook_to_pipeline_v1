import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function ToastContainer() {
  const toasts  = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 48, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scaleX: 0, transformOrigin: 'right', transition: { duration: 0.18 } }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium shadow-xl backdrop-blur-md ${
              t.kind === 'error'
                ? 'bg-rose-950/90 border-[#EF4444]/50 text-rose-100'
                : t.kind === 'success'
                  ? 'bg-[#0D2824]/95 border-[#00FF88]/40 text-emerald-100'
                  : 'bg-[#132238]/95 border-[#00D4FF]/40 text-[#E2E8F0]'
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
