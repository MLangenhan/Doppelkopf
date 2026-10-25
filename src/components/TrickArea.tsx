import type { Card } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { PlayingCard } from './PlayingCard';

/** Relative Sitzposition im Uhrzeigersinn: 0 = ich (unten links), 1 = oben links, 2 = oben rechts, 3 = unten rechts. */
export type Rel = 0 | 1 | 2 | 3;

const SPOT: Record<Rel, { x: number; y: number; r: number }> = {
  0: { x: -0.62, y: 0.36, r: -8 },
  1: { x: -0.62, y: -0.36, r: 6 },
  2: { x: 0.62, y: -0.36, r: -5 },
  3: { x: 0.62, y: 0.36, r: 9 },
};

/** Woher die Karten einfliegen: aus der Ecke des jeweiligen Spielers */
const FROM: Record<Rel, { x: number; y: number }> = {
  0: { x: -520, y: 320 },
  1: { x: -520, y: -320 },
  2: { x: 520, y: -320 },
  3: { x: 520, y: 320 },
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
    <div className="relative" style={{ width: cardWidth * 2.8, height: cardH * 1.75 }} aria-live="polite">
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
                  className={isWinner ? 'ring-[3px] ring-gold-400' : ''}
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
