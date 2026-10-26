import { type Card, cardName, rankOf, suitOf } from '@engine';
import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef } from 'react';

const BASE = `${import.meta.env.BASE_URL}cards/`;
const RANK_FILE = { '9': '9', '10': 'T', J: 'J', Q: 'Q', K: 'K', A: 'A' } as const;

/** Höhe / Breite einer Karte */
export const CARD_RATIO = 336 / 240;
/** Eckenradius passend zu den Kartenbildern (12 von 240 × 336) */
export const CARD_RADIUS = 'rounded-[5%/3.57%]';

/** Bild-URL einer Karte; ohne Karte die Rückseite */
export function cardUrl(card: Card | null): string {
  return card ? `${BASE}${RANK_FILE[rankOf(card)]}${suitOf(card)}.svg` : `${BASE}back.svg`;
}

let preloaded = false;
/** Alle Kartenbilder vorab laden, damit beim ersten Austeilen nichts nachblitzt. */
export function preloadCards() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  const faces = Object.values(RANK_FILE).flatMap((r) => ['C', 'S', 'H', 'D'].map((s) => `${BASE}${r}${s}.svg`));
  for (const src of [...faces, `${BASE}back.svg`]) new Image().src = src;
}

type Props = {
  card?: Card | null;
  /** Rückseite zeigen */
  back?: boolean;
  width?: number;
  className?: string;
} & HTMLMotionProps<'div'>;

/** Eine Spielkarte (französisches Bild). Breite in Pixeln, Höhe ergibt sich aus dem Seitenverhältnis. */
export const PlayingCard = forwardRef<HTMLDivElement, Props>(function PlayingCard(
  { card, back, width = 96, className = '', style, ...rest },
  ref,
) {
  const showBack = back || !card;
  return (
    <motion.div
      ref={ref}
      className={`relative shrink-0 select-none ${CARD_RADIUS} bg-white shadow-card ${className}`}
      style={{ width, height: width * CARD_RATIO, ...style }}
      aria-label={showBack ? 'Verdeckte Karte' : cardName(card!)}
      role="img"
      {...rest}
    >
      <img
        src={cardUrl(showBack ? null : card!)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </motion.div>
  );
});
