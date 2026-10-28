import { type Card, suitOf } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CARD_RADIUS, CARD_RATIO, PlayingCard } from './PlayingCard';
import { TiltCard } from './TiltCard';

/** Ab so viel Pixeln Bewegung wird aus dem Tippen ein Ziehen */
const DRAG_THRESHOLD = 8;

/**
 * Die eigene Kartenhand.
 * - mode "play": erster Klick hebt die Karte an, zweiter Klick spielt sie.
 * - mode "pick": Mehrfachauswahl (z. B. Karten bei der Armut zurückgeben).
 * - Karten lassen sich seitlich ziehen, um die Reihenfolge selbst festzulegen (onReorder).
 */
export function Hand({
  cards,
  playable,
  mode,
  picked,
  onPick,
  onPlay,
  onSelect,
  onReorder,
  highlight,
  dealKey,
  maxCardW = 124,
}: {
  cards: Card[];
  /** Spielbare Karten; null = gerade nichts spielbar (nicht dran) */
  playable: Set<Card> | null;
  mode: 'play' | 'pick' | 'view';
  picked?: Set<Card>;
  onPick?: (card: Card) => void;
  onPlay?: (card: Card) => void;
  /** Meldet die angehobene Karte (Leertaste spielt sie aus) */
  onSelect?: (card: Card | null) => void;
  /** Neue Reihenfolge nach dem Ziehen */
  onReorder?: (cards: Card[]) => void;
  /** Karten, die markiert werden sollen (z. B. neu erhalten) */
  highlight?: Set<Card>;
  /** Ändert sich bei jedem neuen Spiel → Austeil-Animation */
  dealKey: string;
  maxCardW?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [selected, setSelected] = useState<Card | null>(null);
  const [drag, setDrag] = useState<{ card: Card; from: number; dx: number } | null>(null);
  const press = useRef<{ card: Card; from: number; x: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
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

  const latest = useRef({ selected, onPlay, onSelect });
  latest.current = { selected, onPlay, onSelect };
  useEffect(() => latest.current.onSelect?.(selected), [selected]);
  // Tastatur: ← → wählt eine Karte, Leertaste/Enter/↑ spielt sie (bzw. wählt sie bei der Armut), Esc/↓ hebt die Wahl auf
  const [cursor, setCursor] = useState<Card | null>(null);
  if (cursor && (mode !== 'pick' || !cards.includes(cursor))) setCursor(null);
  const keys = useRef({ cards, playable, mode, cursor, onPick });
  keys.current = { cards, playable, mode, cursor, onPick };
  useEffect(() => {
    if (mode === 'view') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.repeat && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
      if (el?.closest('input, textarea, select, [contenteditable], [role=dialog]')) return;
      const k = keys.current;
      const pick = k.mode === 'pick';
      const list = pick ? k.cards : k.cards.filter((c) => k.playable?.has(c));
      const current = pick ? k.cursor : latest.current.selected;
      const set = pick ? setCursor : setSelected;
      // Andere Knöpfe (Ansage, Vorbehalt …) behalten Leertaste und Enter für sich
      const onOtherButton = !!el?.closest('button, a') && !el.closest('[data-hand]');

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (!list.length) return;
        e.preventDefault();
        const i = current ? list.indexOf(current) : -1;
        const dir = e.code === 'ArrowRight' ? 1 : -1;
        set(i < 0 ? list[dir > 0 ? 0 : list.length - 1] : list[(i + dir + list.length) % list.length]);
        return;
      }
      if (e.code === 'Escape' || e.code === 'ArrowDown') {
        if (current) {
          e.preventDefault();
          set(null);
        }
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'ArrowUp') {
        if (!current || (onOtherButton && e.code !== 'ArrowUp')) return;
        e.preventDefault();
        if (pick) {
          k.onPick?.(current);
        } else {
          setSelected(null);
          latest.current.onPlay?.(current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const n = Math.max(cards.length, 1);
  const cardW = Math.max(48, Math.min(maxCardW, width / 6.2));
  const cardH = cardW * CARD_RATIO;
  const step = n > 1 ? Math.min(cardW * 0.98, (width - cardW) / (n - 1)) : 0;
  const total = step * (n - 1) + cardW;
  const offset = (width - total) / 2;

  // Beim Ziehen rücken die anderen Karten schon an ihren neuen Platz
  const target = drag && step > 0 ? Math.max(0, Math.min(cards.length - 1, Math.round(drag.from + drag.dx / step))) : null;
  const order = drag && target !== null ? moveTo(cards, drag.from, target) : cards;

  function click(card: Card) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
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

  const down = (e: React.PointerEvent<HTMLElement>, card: Card, i: number) => {
    if (!onReorder || (e.pointerType === 'mouse' && e.button !== 0)) return;
    press.current = { card, from: i, x: e.clientX, id: e.pointerId, moved: false };
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!p.moved) {
      p.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag({ card: p.card, from: p.from, dx });
  };
  const up = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.moved) return;
    suppressClick.current = true;
    // Falls kein Klick mehr folgt (Zeiger außerhalb losgelassen), die Sperre wieder lösen
    setTimeout(() => (suppressClick.current = false), 50);
    if (target !== null && target !== p.from) onReorder?.(moveTo(cards, p.from, target));
    setDrag(null);
  };

  return (
    <div ref={ref} data-hand className="relative w-full" style={{ height: cardH + 34 }}>
      <AnimatePresence>
        {cards.map((card, i) => {
          const isPlayable = mode === 'play' && !!playable?.has(card);
          const dimmed = mode === 'play' && playable !== null && !isPlayable;
          const isSelected = selected === card || !!picked?.has(card);
          const isNew = highlight?.has(card);
          const interactive = mode === 'pick' || isPlayable;
          const dragging = drag?.card === card;
          const slot = order.indexOf(card);
          const x = dragging ? offset + drag.from * step + drag.dx : offset + slot * step;
          return (
            <motion.button
              key={`${dealKey}:${card}`}
              type="button"
              aria-pressed={isSelected}
              aria-disabled={!interactive}
              data-suit={suitOf(card)}
              onClick={() => click(card)}
              onPointerDown={(e) => down(e, card, i)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className={`absolute bottom-0 ${CARD_RADIUS} outline-none focus-visible:ring-4 focus-visible:ring-gold-300 ${
                interactive ? 'cursor-pointer' : onReorder ? 'cursor-grab' : 'cursor-default'
              } ${dragging ? 'cursor-grabbing' : ''}`}
              style={{ zIndex: dragging ? 100 : slot, touchAction: onReorder ? 'pan-y' : undefined }}
              initial={{ opacity: 0, y: -320, x: width / 2 - cardW / 2, rotate: -20 + ((i * 37) % 40) }}
              animate={{
                opacity: 1,
                x,
                y: dragging ? -22 : isSelected ? -30 : cursor === card ? -12 : 0,
                rotate: dragging ? (drag.dx > 0 ? 4 : -4) : 0,
                scale: dragging ? 1.05 : 1,
                filter: dimmed ? 'brightness(0.55) saturate(0.6)' : 'brightness(1) saturate(1)',
              }}
              exit={{ opacity: 0, y: -140, scale: 0.9, transition: { duration: 0.25 } }}
              whileHover={interactive && !isSelected && !drag ? { y: -14 } : undefined}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 26,
                delay: dealing ? 0.1 + i * 0.06 : 0,
                x: dragging ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32, delay: dealing ? 0.1 + i * 0.06 : 0 },
                opacity: { duration: 0.2, delay: dealing ? 0.1 + i * 0.06 : 0 },
                filter: { duration: 0.2 },
              }}
            >
              <TiltCard>
                <PlayingCard
                  card={card}
                  width={cardW}
                  className={isSelected ? 'ring-4 ring-gold-400' : cursor === card ? 'ring-4 ring-white/80' : ''}
                />
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

function moveTo<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
