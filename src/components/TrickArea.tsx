import type { Card } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
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

const SUITS = ['♣', '♥', '♠', '♦'];

/** Die Spielfläche in der Tischmitte: ovaler Filz mit Goldrand, darauf der aktuelle Stich. */
export function TrickArea({
  trickKey,
  plays,
  winnerRel,
  winnerLabel,
  cardWidth,
  onCollect,
  children,
}: {
  /** Eindeutig je Stich, damit beim nächsten Stich die alten Karten wegfliegen */
  trickKey: string;
  plays: TrickPlay[];
  /** Gesetzt, sobald der Stich komplett ist */
  winnerRel: Rel | null;
  /** Beschriftung, sobald der Stich komplett ist, z. B. "Stich für Anna" */
  winnerLabel?: string;
  cardWidth: number;
  /** Wenn gesetzt, nimmt ein Klick auf den Stich ihn an sich */
  onCollect?: () => void;
  /** Overlays über der Fläche (z. B. große Momente) */
  children?: ReactNode;
}) {
  const cardH = cardWidth * (244.64 / 169.075);
  const matW = cardWidth * 4.4;
  const matH = cardH * 2.25;
  const complete = winnerRel !== null;

  return (
    <div className="relative grid place-items-center" style={{ width: matW, height: matH }}>
      {/* Filz */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: 'radial-gradient(ellipse at 50% 38%, #2c5e4a 0%, #1d4334 48%, #142f25 78%, #10261e 100%)',
        }}
        animate={{
          boxShadow: complete
            ? 'inset 0 2px 40px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(232,205,133,0.75), 0 0 60px 4px rgba(217,180,90,0.28), 0 30px 80px -24px rgba(0,0,0,0.7)'
            : 'inset 0 2px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(217,180,90,0.28), 0 0 0 0 rgba(217,180,90,0), 0 30px 80px -24px rgba(0,0,0,0.7)',
        }}
        transition={{ duration: 0.5 }}
      />
      {/* Innerer Ring und Farbzeichen */}
      <div aria-hidden className="pointer-events-none absolute inset-[7%] rounded-[50%] border border-dashed border-gold-400/15" />
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="flex gap-[0.6em] text-white/[0.06] select-none" style={{ fontSize: cardWidth * 0.42 }}>
          {SUITS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>

      {/* Karten */}
      <div
        className={`absolute inset-0 ${onCollect ? 'cursor-pointer' : ''}`}
        onClick={onCollect}
        role={onCollect ? 'button' : undefined}
        aria-label={onCollect ? 'Stich nehmen' : undefined}
        aria-live="polite"
      >
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
                    scale: isWinner ? 1.08 : complete ? 0.97 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                >
                  <PlayingCard card={card} width={cardWidth} className={isWinner ? 'ring-[3px] ring-gold-400' : ''} />
                </motion.div>
              );
            })}
            {complete && winnerLabel && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="absolute bottom-[4%] left-1/2 z-10 -translate-x-1/2 rounded-full bg-felt-950/90 px-3 py-1 text-sm font-semibold whitespace-nowrap text-gold-300 shadow-lg ring-1 ring-gold-400/30"
              >
                {winnerLabel}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {children}
    </div>
  );
}
