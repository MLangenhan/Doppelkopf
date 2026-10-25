import { type Card, cardName, rankOf, suitOf } from '@engine';
import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef } from 'react';

const SPRITE = `${import.meta.env.BASE_URL}cards/svg-cards.svg`;

const SUIT_ID = { C: 'club', S: 'spade', H: 'heart', D: 'diamond' } as const;
const RANK_ID = { '9': '9', '10': '10', J: 'jack', Q: 'queen', K: 'king', A: '1' } as const;

export function spriteId(card: Card) {
  return `${SUIT_ID[suitOf(card)]}_${RANK_ID[rankOf(card)]}`;
}

// Natürliche Kartengröße im Sprite
const W = 169.075;
const H = 244.64;

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
      className={`relative shrink-0 select-none rounded-[6%/4.2%] bg-white shadow-card ${className}`}
      style={{ width, height: (width * H) / W, ...style }}
      aria-label={showBack ? 'Verdeckte Karte' : cardName(card!)}
      role="img"
      {...rest}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full">
        {showBack ? (
          <use href={`${SPRITE}#back`} fill="#1d4f8f" />
        ) : (
          <use href={`${SPRITE}#${spriteId(card!)}`} />
        )}
      </svg>
    </motion.div>
  );
});
