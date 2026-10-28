import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const IDLE_MS = 5000;
const touch = () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * Dezenter Leertasten-Hinweis, der erst nach 5 Sekunden Untätigkeit erscheint.
 * Auf Touch-Geräten (ohne Tastatur) steht dort stattdessen, was man antippen kann.
 */
export function SpaceHint({
  active,
  resetKey,
  label,
  touchLabel,
  keys = ['Leertaste'],
}: {
  active: boolean;
  resetKey: string;
  label: string;
  touchLabel: string;
  /** Angezeigte Tasten */
  keys?: string[];
}) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    setShown(null);
    if (!active) return;
    const t = setTimeout(() => setShown(resetKey), IDLE_MS);
    return () => clearTimeout(t);
  }, [active, resetKey]);
  const visible = active && shown === resetKey;

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          key="hint"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="tag inline-flex items-center gap-2 text-[10px] text-white/55"
          role="status"
        >
          {touch() ? (
            touchLabel
          ) : (
            <>
              {keys.map((k) => (
                <kbd key={k} className="rounded border border-white/25 px-1.5 py-0.5 text-white/75">
                  {k}
                </kbd>
              ))}
              {label}
            </>
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
