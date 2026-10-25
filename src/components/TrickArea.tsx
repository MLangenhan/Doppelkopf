import type { Card } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { PlayingCard } from './PlayingCard';

/** Relative Sitzposition: 0 = ich (unten), 1 = links, 2 = gegenüber, 3 = rechts. */
export type Rel = 0 | 1 | 2 | 3;

const SPOT: Record<Rel, { x: number; y: number; r: number }> = {
  0: { x: 0, y: 0.5, r: -3 },
  1: { x: -1.1, y: 0.04, r: -9 },
  2: { x: 0, y: -0.5, r: 4 },
  3: { x: 1.1, y: -0.04, r: 8 },
};

const FROM: Record<Rel, { x: number; y: number }> = {
  0: { x: 0, y: 360 },
  1: { x: -480, y: 0 },
  2: { x: 0, y: -360 },
  3: { x: 480, y: 0 },
};

export interface TrickPlay {
  card: Card;
  rel: Rel;
}

const cardVariants = {
  enter: (rel: Rel) => ({ opacity: 0, x: FROM[rel].x, y: FROM[rel].y, rotate: SPOT[rel].r * 3, scale: 1.05 }),
};

export function TrickArea({
  trickKey,
  plays,
  winnerRel,
  winnerName,
  cardWidth,
}: {
  /** Eindeutig je Stich, damit beim nächsten Stich die alten Karten wegfliegen */
  trickKey: string;
  plays: TrickPlay[];
  /** Gesetzt, sobald der Stich komplett ist */
  winnerRel: Rel | null;
  winnerName?: string;
  cardWidth: number;
}) {
  const cardH = cardWidth * (244.64 / 169.075);
  return (
    <div className="relative" style={{ width: cardWidth * 3.4, height: cardH * 2.1 }} aria-live="polite">
      <AnimatePresence custom={winnerRel}>
        <motion.div
          key={trickKey}
          className="absolute inset-0"
          exit="collect"
          custom={winnerRel}
          variants={{
            collect: (w: Rel | null) => ({
              x: w === null ? 0 : FROM[w].x * 0.7,
              y: w === null ? 0 : FROM[w].y * 0.7,
              scale: 0.45,
              opacity: 0,
              transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] },
            }),
          }}
        >
          {plays.map(({ card, rel }, i) => {
            const spot = SPOT[rel];
            const isWinner = winnerRel === rel;
            return (
              <motion.div
                key={card}
                className="absolute top-1/2 left-1/2"
                style={{ zIndex: i + 1, marginLeft: -cardWidth / 2, marginTop: -cardH / 2 }}
                custom={rel}
                variants={cardVariants}
                initial="enter"
                animate={{
                  opacity: 1,
                  x: spot.x * cardWidth,
                  y: spot.y * cardH,
                  rotate: spot.r,
                  scale: isWinner ? 1.06 : 1,
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              >
                <PlayingCard
                  card={card}
                  width={cardWidth}
                  className={isWinner ? 'ring-4 ring-gold-400 shadow-[0_0_30px_rgba(239,199,94,0.55)]' : ''}
                />
              </motion.div>
            );
          })}
          {winnerRel !== null && winnerName && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-felt-950/85 px-3 py-1 text-sm font-semibold whitespace-nowrap text-gold-300 shadow-lg"
            >
              Stich für {winnerName}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
