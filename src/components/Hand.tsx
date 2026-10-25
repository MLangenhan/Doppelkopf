import type { Card } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { PlayingCard } from './PlayingCard';
import { TiltCard } from './TiltCard';

const RATIO = 244.64 / 169.075;

/**
 * Die eigene Kartenhand.
 * - mode "play": erster Klick hebt die Karte an, zweiter Klick spielt sie (ein Doppelklick also auch).
 * - mode "pick": Mehrfachauswahl (z. B. Karten bei der Armut zurückgeben).
 */
export function Hand({
  cards,
  playable,
  mode,
  picked,
  onPick,
  onPlay,
  highlight,
  dealKey,
}: {
  cards: Card[];
  /** Spielbare Karten; null = gerade nichts spielbar (nicht dran) */
  playable: Set<Card> | null;
  mode: 'play' | 'pick' | 'view';
  picked?: Set<Card>;
  onPick?: (card: Card) => void;
  onPlay?: (card: Card) => void;
  /** Karten, die markiert werden sollen (z. B. neu erhalten) */
  highlight?: Set<Card>;
  /** Ändert sich bei jedem neuen Spiel → Austeil-Animation */
  dealKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [selected, setSelected] = useState<Card | null>(null);
  // Kurz nach dem Austeilen fliegen die Karten nacheinander ein
  const [dealtAt, setDealtAt] = useState(() => ({ key: dealKey, at: Date.now() }));
  if (dealtAt.key !== dealKey) setDealtAt({ key: dealKey, at: Date.now() });
  const dealing = Date.now() - dealtAt.at < 1200;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auswahl zurücksetzen, wenn die Karte nicht mehr spielbar ist
  if (selected && (!playable || !playable.has(selected) || !cards.includes(selected))) {
    setSelected(null);
  }

  const n = Math.max(cards.length, 1);
  const cardW = Math.max(64, Math.min(124, width / 6.2));
  const cardH = cardW * RATIO;
  const step = n > 1 ? Math.min(cardW * 0.98, (width - cardW) / (n - 1)) : 0;
  const total = step * (n - 1) + cardW;
  const offset = (width - total) / 2;

  function click(card: Card) {
    if (mode === 'pick') {
      onPick?.(card);
      return;
    }
    if (mode !== 'play' || !playable?.has(card)) return;
    if (selected === card) {
      setSelected(null);
      onPlay?.(card);
    } else {
      setSelected(card);
    }
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height: cardH + 34 }}>
      <AnimatePresence>
        {cards.map((card, i) => {
          const isPlayable = mode === 'play' && !!playable?.has(card);
          const dimmed = mode === 'play' && playable !== null && !isPlayable;
          const isSelected = selected === card || !!picked?.has(card);
          const isNew = highlight?.has(card);
          const interactive = mode === 'pick' || isPlayable;
          return (
            <motion.button
              key={`${dealKey}:${card}`}
              type="button"
              aria-pressed={isSelected}
              disabled={!interactive}
              data-cursor={mode === 'pick' ? (isSelected ? 'Abwählen' : 'Wählen') : isPlayable ? (isSelected ? 'Spielen' : 'Wählen') : undefined}
              onClick={() => click(card)}
              className={`absolute bottom-0 rounded-[6%/4.2%] outline-none focus-visible:ring-4 focus-visible:ring-gold-300 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{ zIndex: i }}
              initial={{ opacity: 0, y: -320, x: width / 2 - cardW / 2, rotate: -20 + ((i * 37) % 40) }}
              animate={{
                opacity: 1,
                x: offset + i * step,
                y: isSelected ? -30 : 0,
                rotate: 0,
                filter: dimmed ? 'brightness(0.55) saturate(0.6)' : 'brightness(1) saturate(1)',
              }}
              exit={{ opacity: 0, y: -140, scale: 0.9, transition: { duration: 0.25 } }}
              whileHover={interactive && !isSelected ? { y: -14 } : undefined}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 26,
                delay: dealing ? 0.1 + i * 0.06 : 0,
                opacity: { duration: 0.2, delay: dealing ? 0.1 + i * 0.06 : 0 },
                filter: { duration: 0.2 },
              }}
            >
              <TiltCard>
                <PlayingCard card={card} width={cardW} className={isSelected ? 'ring-4 ring-gold-400' : ''} />
              </TiltCard>
              {isNew && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-bold text-felt-950">
                  neu
                </span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
