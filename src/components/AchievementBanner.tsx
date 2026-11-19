import { ACHIEVEMENT_BY_KEY, RARITIES } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import type { AchievementEvent } from '../lib/achievementFeed';
import { sound } from '../lib/sound';
import { AchievementBadge } from './AchievementBadge';
import { Confetti } from './Moments';

const TONE = {
  common: 'from-amber-900/90 to-felt-950/95 ring-amber-600/50',
  rare: 'from-slate-600/90 to-felt-950/95 ring-slate-300/50',
  epic: 'from-yellow-700/90 to-felt-950/95 ring-yellow-300/60',
  legendary: 'from-sky-700/90 to-fuchsia-900/90 ring-sky-300/70',
  mythic: 'from-purple-900/95 to-black/95 ring-fuchsia-400/70',
} as const;

/**
 * Ankündigung eines neuen Erfolgs – bewusst anders als Ansagen: kommt von oben als Banner mit Glockenspiel.
 * Legendär und Mythisch: Tisch dunkler, Medaille groß in der Mitte, Konfetti.
 */
export function AchievementBanner({ event, name, onDone }: { event: AchievementEvent | null; name: (uid: string) => string; onDone: (id: number) => void }) {
  const a = event ? ACHIEVEMENT_BY_KEY.get(event.key) : null;
  const big = !!a && (a.rarity === 'legendary' || a.rarity === 'mythic');

  useEffect(() => {
    if (!event || !a) return;
    sound.achievement(a.rarity);
    if (big) sound.say(`${RARITIES[a.rarity].label}! ${a.name}!`);
    const t = setTimeout(() => onDone(event.id), big ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {event && a && (
        <motion.div key={event.id} className="pointer-events-none fixed inset-0 z-[90]" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {big && (
            <>
              <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <motion.div
                className="absolute inset-0 grid place-items-center"
                initial={{ scale: 0.2, opacity: 0, rotate: -40 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.2 }}
              >
                <AchievementBadge achievementKey={a.key} size={220} />
              </motion.div>
              <Confetti active />
            </>
          )}
          <motion.div
            className={`absolute top-4 left-1/2 flex w-[min(92vw,30rem)] -translate-x-1/2 items-center gap-4 rounded-2xl bg-gradient-to-r p-3 pr-5 shadow-2xl ring-1 ${TONE[a.rarity]}`}
            initial={{ y: -140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            role="status"
          >
            <motion.div initial={{ rotateY: 180, scale: 0.6 }} animate={{ rotateY: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
              <AchievementBadge achievementKey={a.key} size={64} />
            </motion.div>
            <div className="min-w-0">
              <p className="tag text-[10px] text-white/70">
                {name(event.userId)} · Erfolg freigeschaltet · {RARITIES[a.rarity].label} · +{RARITIES[a.rarity].points}
              </p>
              <p className="display truncate text-3xl text-white">{a.name}</p>
              <p className="truncate text-xs text-white/70">{a.description}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
