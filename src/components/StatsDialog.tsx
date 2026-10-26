import { ArrowLeft, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { StatsContent } from './StatsContent';

/** Statistik als Popup: im Spiel (auch gegen Bots) nachschauen, ohne den Tisch zu verlassen. */
export function StatsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] grid place-items-center bg-black/60 p-2 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stats-title"
        >
          <motion.div
            className="panel relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2 sm:px-6">
              <button className="btn-ghost -ml-2 px-2 py-1.5" onClick={onClose} autoFocus>
                <ArrowLeft className="size-4" />
                Zurück zum Spiel
              </button>
              <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Schließen">
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 pt-5 pb-10 sm:px-6">
              <StatsContent inDialog />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
