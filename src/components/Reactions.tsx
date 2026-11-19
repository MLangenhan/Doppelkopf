import { CircleQuestionMark, Clover, Crown, Glasses, Megaphone, PartyPopper, Rabbit, ThumbsUp, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EXTRA_REACTIONS } from '../lib/cosmetics';
import { useMyAchievements } from '../lib/myAchievements';
import { EXTRA_REACTION_KINDS, REACTION_KINDS, REACTION_LABELS, type ReactionKind, type ShownReaction } from '../lib/reactions';

export const REACTION_ICONS = {
  applaus: PartyPopper,
  autsch: Zap,
  glueck: Clover,
  hmm: CircleQuestionMark,
  hoert: Megaphone,
  fuchs: Rabbit,
  brille: Glasses,
  ehrenrunde: Crown,
} as const;

/** Reaktion groß über einer Kamera */
export function ReactionBubble({ reaction, compact }: { reaction?: ShownReaction; compact?: boolean }) {
  return (
    <AnimatePresence>
      {reaction && (
        <motion.div
          key={reaction.id}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          initial={{ opacity: 0, scale: 0.4, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, y: -24, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        >
          <div
            className={`flex flex-col items-center rounded-2xl bg-felt-950/85 text-gold-300 shadow-xl ring-1 ring-gold-400/40 ${
              compact ? 'gap-0.5 px-2 py-1.5' : 'gap-1.5 px-4 py-3'
            }`}
          >
            {(() => {
              const Icon = REACTION_ICONS[reaction.kind];
              return <Icon className={compact ? 'size-5' : 'size-9'} strokeWidth={1.75} />;
            })()}
            <span className={`tag text-white ${compact ? 'text-[8px]' : 'text-[11px]'}`}>{REACTION_LABELS[reaction.kind]}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Knopf mit kleinem Menü für die eigenen Reaktionen; Tasten 1–4 gehen auch direkt */
export function ReactionPicker({ onReact }: { onReact: (k: ReactionKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const earned = useMyAchievements();
  const kinds: ReactionKind[] = [
    ...REACTION_KINDS,
    ...EXTRA_REACTION_KINDS.filter((k) => {
      const u = EXTRA_REACTIONS.find((e) => e.key === k)?.unlock;
      return !u || earned.has(u);
    }),
  ];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="btn-ghost p-2"
        onClick={() => setOpen((o) => !o)}
        aria-label="Reaktion senden"
        aria-expanded={open}
        title="Reaktion (Tasten 1–4)"
        data-cursor="Reaktion"
      >
        <ThumbsUp className="size-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="panel absolute top-full left-1/2 z-40 mt-1 grid w-max -translate-x-1/2 grid-cols-4 gap-1 p-1.5"
            role="menu"
          >
            {kinds.map((k, i) => {
              const Icon = REACTION_ICONS[k];
              return (
                <button
                  key={k}
                  role="menuitem"
                  className="btn-ghost flex flex-col gap-1 px-2.5 py-2"
                  onClick={() => {
                    onReact(k);
                    setOpen(false);
                  }}
                  title={i < 4 ? `${REACTION_LABELS[k]} (${i + 1})` : REACTION_LABELS[k]}
                >
                  <Icon className="size-5" />
                  <span className="tag text-[9px] whitespace-nowrap">{REACTION_LABELS[k]}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
