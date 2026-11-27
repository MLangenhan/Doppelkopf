import { CircleQuestionMark, Clover, Crown, Glasses, Megaphone, Music, PartyPopper, Rabbit, ThumbsUp, Volume2, VolumeX, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EXTRA_REACTIONS } from '../lib/cosmetics';
import { usePrefs } from '../lib/prefs';
import { HOTKEY_LABELS, SOUNDS } from '../lib/soundboard';
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
              const Icon = reaction.kind === 'sound' ? Volume2 : REACTION_ICONS[reaction.kind];
              return <Icon className={compact ? 'size-5' : 'size-9'} strokeWidth={1.75} />;
            })()}
            <span className={`tag text-white ${compact ? 'text-[8px]' : 'text-[11px]'}`}>
              {reaction.kind === 'sound' ? reaction.label : REACTION_LABELS[reaction.kind]}
            </span>
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

/** Soundboard: alle Sounds frei für alle; Lautstärke (bzw. stumm) direkt im Menü */
export function Soundboard({ onPlay }: { onPlay: (idx: number) => void }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPref] = usePrefs();
  const ref = useRef<HTMLDivElement>(null);
  const muted = prefs.soundboardVolume <= 0;
  const lastVol = useRef(prefs.soundboardVolume || 0.6);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={`btn-ghost p-2 ${muted ? 'text-white/40' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Soundboard"
        aria-expanded={open}
        title="Soundboard"
        data-cursor="Sounds"
      >
        <Music className="size-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="panel absolute top-full left-1/2 z-40 mt-1 w-[22rem] max-w-[92vw] -translate-x-1/2 p-2"
          >
            {/* Lautstärke für alles, was das Soundboard abspielt – auch die Sounds der anderen */}
            <div className="mb-2 flex items-center gap-2 px-1">
              <button
                className="btn-ghost p-1"
                onClick={() => {
                  if (muted) setPref('soundboardVolume', lastVol.current || 0.6);
                  else {
                    lastVol.current = prefs.soundboardVolume;
                    setPref('soundboardVolume', 0);
                  }
                }}
                aria-label={muted ? 'Soundboard einschalten' : 'Soundboard stumm schalten'}
                title={muted ? 'Stumm – antippen zum Einschalten' : 'Stumm schalten'}
              >
                {muted ? <VolumeX className="size-4 text-red-300" /> : <Volume2 className="size-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.soundboardVolume}
                onChange={(e) => setPref('soundboardVolume', Number(e.target.value))}
                className="flex-1 accent-gold-400"
                aria-label="Lautstärke Soundboard"
              />
              <span className="tag w-8 text-right text-[10px] text-white/55 tabular-nums">{Math.round(prefs.soundboardVolume * 100)}</span>
            </div>
            <div className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto">
              {SOUNDS.map((s, i) => (
                <button
                  key={s.file}
                  className="btn-ghost truncate px-2 py-1.5 text-left text-xs"
                  onClick={() => onPlay(i)}
                  title={s.label}
                >
                  {prefs.soundHotkeys.indexOf(i) >= 0 && (
                    <kbd className="tag mr-1 rounded border border-white/25 px-1 text-[9px] text-gold-200">
                      {HOTKEY_LABELS[prefs.soundHotkeys.indexOf(i)]}
                    </kbd>
                  )}
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
