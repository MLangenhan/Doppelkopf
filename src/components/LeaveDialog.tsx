import { ArrowLeft, Ban, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

/** Spiel verlassen: zurück zur Übersicht (Platz bleibt) oder das laufende Spiel für alle abbrechen. */
export function LeaveDialog({
  open,
  onClose,
  onLeave,
  onAbort,
  practice,
}: {
  open: boolean;
  onClose: () => void;
  onLeave?: () => void;
  onAbort?: () => Promise<void> | void;
  practice?: boolean;
}) {
  const [confirmAbort, setConfirmAbort] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmAbort(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-title"
        >
          <motion.div
            className="panel w-full max-w-sm p-5"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="leave-title" className="display text-4xl">
                {practice ? 'Übung beenden?' : 'Verlassen?'}
              </h2>
              <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Schließen">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {onLeave && (
                <button className="btn-primary justify-start gap-3 py-3 text-left" onClick={onLeave} autoFocus>
                  <ArrowLeft className="size-4 shrink-0" />
                  <span>
                    {practice ? 'Zur Startseite' : 'Zur Übersicht'}
                    <span className="block text-xs font-normal opacity-75">
                      {practice ? 'Das Übungsspiel endet.' : 'Dein Platz bleibt frei, du kannst jederzeit zurück.'}
                    </span>
                  </span>
                </button>
              )}
              {onAbort &&
                (confirmAbort ? (
                  <div className="rounded-xl bg-red-500/10 p-3 ring-1 ring-red-400/30">
                    <p className="text-sm text-red-100">
                      Das Spiel wird für alle beendet und zählt nicht. Danach gibt derselbe Geber neu.
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="btn-ghost px-3 py-1.5" onClick={() => setConfirmAbort(false)}>
                        Nein
                      </button>
                      <button
                        className="btn rounded-lg bg-red-500/80 px-3 py-1.5 font-semibold text-white hover:bg-red-500"
                        onClick={async () => {
                          await onAbort();
                          onClose();
                        }}
                      >
                        Ja, abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn-ghost justify-start gap-3 py-3 text-left" onClick={() => setConfirmAbort(true)}>
                    <Ban className="size-4 shrink-0 text-red-300" />
                    <span>
                      Spiel abbrechen
                      <span className="block text-xs text-white/55">Zum Beispiel, wenn jemand gehen muss.</span>
                    </span>
                  </button>
                ))}
              <button className="btn-ghost py-2" onClick={onClose}>
                Weiterspielen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
