import type { Card } from '@engine';
import { AnimatePresence, motion, type Variants } from 'motion/react';
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

interface CardCustom {
  rel: Rel;
  i: number;
  w: Rel | null;
  isWinner: boolean;
  complete: boolean;
  cw: number;
  ch: number;
}

const COLLECT_S = 0.75;

const showCard = (c: CardCustom) => ({
  opacity: 1,
  x: SPOT[c.rel].x * c.cw,
  y: SPOT[c.rel].y * c.ch,
  rotate: SPOT[c.rel].r,
  scale: c.isWinner ? 1.08 : c.complete ? 0.97 : 1,
  scaleX: 1,
  scaleY: 1,
  transition: { type: 'spring' as const, stiffness: 220, damping: 24 },
});

const cardVariants: Variants = {
  enter: (c: CardCustom) => ({ opacity: 0, x: FROM[c.rel].x, y: FROM[c.rel].y, rotate: SPOT[c.rel].r * 3, scale: 1.05 }),
  show: (c: CardCustom) => showCard(c),
  // Stich komplett: gleiche Lage, aber neu ausgewertet (Gewinnerkarte hebt sich ab)
  done: (c: CardCustom) => showCard(c),
  // Einsammeln: Karte dreht sich um (zusammenklappen, Rückseite) und fliegt in die Ecke des Gewinners
  collect: (c: CardCustom) =>
    c.w === null
      ? { opacity: 0 }
      : {
          scaleX: [null, 0, 0.4],
          scaleY: [null, 1, 0.4],
          x: [null, SPOT[c.rel].x * c.cw * 0.6, FROM[c.w].x],
          y: [null, SPOT[c.rel].y * c.ch * 0.6, FROM[c.w].y],
          rotate: [null, 0, 0],
          opacity: [1, 1, 0],
          transition: { duration: COLLECT_S, times: [0, 0.3, 1], delay: c.i * 0.05, ease: 'easeInOut' as const },
        },
};

const backVariants: Variants = {
  show: { opacity: 0 },
  done: { opacity: 0 },
  collect: (c: CardCustom) => ({
    opacity: [0, 0, 1, 1],
    transition: { duration: COLLECT_S, times: [0, 0.29, 0.31, 1], delay: c.i * 0.05 },
  }),
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
  impact,
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
  /** Trumpf-Einschlag: Druckwelle an der Stelle dieser Karte (key ändert sich je Einschlag) */
  impact?: { key: string; rel: Rel } | null;
  /** Overlays über der Fläche (z. B. große Momente) */
  children?: ReactNode;
}) {
  const cardH = cardWidth * (244.64 / 169.075);
  const matW = cardWidth * 4.4;
  const matH = cardH * 2.05;
  const complete = winnerRel !== null;

  return (
    // Die Fläche selbst fängt keine Klicks ab – sonst blockiert sie Knöpfe, die darunter liegen
    <div className="pointer-events-none relative grid place-items-center" style={{ width: matW, height: matH }}>
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

      {/* Druckwelle beim Trumpf-Einschlag */}
      <AnimatePresence>
        {impact && (
          <motion.div
            key={impact.key}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{ x: SPOT[impact.rel].x * cardWidth, y: SPOT[impact.rel].y * cardH }}
            exit={{ opacity: 0 }}
          >
            {[0, 0.12].map((d) => (
              <motion.span
                key={d}
                className="absolute rounded-full border-2 border-gold-300"
                style={{ width: cardWidth, height: cardWidth, left: -cardWidth / 2, top: -cardWidth / 2 }}
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 4.2, opacity: 0 }}
                transition={{ duration: 0.75, delay: d, ease: [0.2, 0.7, 0.3, 1] }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Karten */}
      <div
        className={`absolute inset-0 ${onCollect ? 'pointer-events-auto cursor-pointer' : ''}`}
        onClick={onCollect}
        role={onCollect ? 'button' : undefined}
        data-cursor={onCollect ? 'Nehmen' : undefined}
        aria-label={onCollect ? 'Stich nehmen' : undefined}
        aria-live="polite"
      >
        <AnimatePresence>
          <motion.div
            key={trickKey}
            className="absolute inset-0"
            initial="enter"
            animate={complete ? 'done' : 'show'}
            exit="collect"
            // Hält den Stich im DOM, bis alle Karten beim Gewinner angekommen sind
            variants={{ show: { opacity: 1 }, done: { opacity: 1 }, collect: { opacity: 1, transition: { duration: COLLECT_S + 0.25 } } }}
          >
            {plays.map(({ card, rel }, i) => {
              const custom: CardCustom = {
                rel,
                i,
                w: winnerRel,
                isWinner: winnerRel === rel,
                complete,
                cw: cardWidth,
                ch: cardH,
              };
              return (
                <motion.div
                  key={card}
                  className="absolute top-1/2 left-1/2"
                  style={{ zIndex: i + 1, marginLeft: -cardWidth / 2, marginTop: -cardH / 2 }}
                  custom={custom}
                  variants={cardVariants}
                >
                  <PlayingCard card={card} width={cardWidth} className={custom.isWinner ? 'ring-[3px] ring-gold-400' : ''} />
                  <motion.div className="absolute inset-0" custom={custom} variants={backVariants} aria-hidden>
                    <PlayingCard back width={cardWidth} />
                  </motion.div>
                </motion.div>
              );
            })}
            {complete && winnerLabel && (
              <motion.div
                variants={{
                  enter: { opacity: 0, y: 6, scale: 0.9 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { delay: 0.25 } },
                  done: { opacity: 1, y: 0, scale: 1, transition: { delay: 0.25 } },
                  collect: { opacity: 0, transition: { duration: 0.15 } },
                }}
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
