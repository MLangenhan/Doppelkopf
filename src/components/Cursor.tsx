import { Hand } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useFx } from '../lib/prefs';

type Suit = 'C' | 'S' | 'H' | 'D';
const GLYPH: Record<Suit, string> = { C: '♣', S: '♠', H: '♥', D: '♦' };

/**
 * Eigener Cursor als Farbzeichen: ein kleines ♠, das über einer Karte zu deren Farbe wird
 * (♥ und ♦ in Rot) und sich beim Klick einmal um sich selbst dreht. Über dem fertigen Stich wird es zur Hand.
 * Karten markieren sich mit data-suit, Aktionen mit data-cursor.
 * Nur mit Maus; auf Touch-Geräten, bei reduzierter Bewegung oder ohne Effekte bleibt der normale Cursor.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const effects = useFx('cursor');
  const [fine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  // Notbremse für schwache Rechner: läuft es dauerhaft ruckelig, übernimmt der Systemcursor (mit Farbsymbol)
  const [slow, setSlow] = useState(false);
  const enabled = fine && effects && !reduce && !slow;
  const [suit, setSuit] = useState<Suit>('S');
  const [overCard, setOverCard] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [grab, setGrab] = useState(false);
  const [spin, setSpin] = useState(0);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('has-cursor');
    let px = -100;
    let py = -100;
    let frame = 0;
    let lastTarget: Element | null = null;
    const inspect = (node: Element | null) => {
      const target = node as HTMLElement | null;
      const card = target?.closest<HTMLElement>('[data-suit]');
      const action = target?.closest<HTMLElement>(
        'a, button:not([disabled]):not([aria-disabled=true]), [data-cursor], input, select, label, [role=button]',
      );
      if (card) setSuit(card.dataset.suit as Suit);
      setOverCard(!!card);
      setHovering(!!action);
      setGrab(action?.dataset.cursor === 'Nehmen');
    };
    // Position direkt und höchstens einmal pro Bild setzen – ohne Feder, damit nichts nachzieht
    const paint = () => {
      frame = 0;
      if (el.current) el.current.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    };
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
      // Nur prüfen, wenn sich das Element unter der Maus ändert
      if (e.target !== lastTarget) {
        lastTarget = e.target as Element;
        inspect(lastTarget);
      }
    };
    const down = () => setSpin((s) => s + 360);
    // Nach einem Klick kann das Element unter dem Cursor verschwinden (Karte gespielt, Dialog offen)
    const up = () =>
      setTimeout(() => {
        lastTarget = document.elementFromPoint(px, py);
        inspect(lastTarget);
      }, 180);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);

    // Bildrate messen, solange die Maus sich bewegt: dauerhaft unter ~40 FPS → Systemcursor
    let last = performance.now();
    let slowFrames = 0;
    let samples = 0;
    let probe = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (dt < 200) {
        samples++;
        if (dt > 25) slowFrames++;
        if (samples >= 120) {
          if (slowFrames / samples > 0.5) setSlow(true);
          samples = 0;
          slowFrames = 0;
        }
      }
      probe = requestAnimationFrame(tick);
    };
    probe = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(probe);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('has-cursor');
    };
  }, [enabled]);

  // Systemcursor mit Farbsymbol, wenn der eigene Cursor zu langsam wäre
  useEffect(() => {
    if (!slow || !fine || !effects || reduce) return;
    document.documentElement.classList.add('native-cursor');
    return () => document.documentElement.classList.remove('native-cursor');
  }, [slow, fine, effects, reduce]);

  if (!enabled) return null;
  const red = overCard && (suit === 'H' || suit === 'D');

  return (
    <div
      ref={el}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[200] flex flex-col items-center will-change-transform"
      style={{ transform: 'translate3d(-100px, -100px, 0)' }}
    >
      {grab ? (
        <motion.span
          key="grab"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center text-gold-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        >
          <Hand className="size-7" strokeWidth={1.75} />
          <span className="tag mt-0.5 text-[9px]">Nehmen</span>
        </motion.span>
      ) : (
        <motion.span
          key="suit"
          className={`block leading-none select-none ${red ? 'text-[#e2534a]' : overCard ? 'text-white' : 'text-gold-300'}`}
          style={{ fontSize: 22, textShadow: '0 2px 6px rgba(0,0,0,0.65)' }}
          animate={{ rotate: spin, scale: overCard ? 1.35 : hovering ? 1.15 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          {GLYPH[overCard ? suit : 'S']}
        </motion.span>
      )}
    </div>
  );
}

/** Vier Eckwinkel um das Elternelement (HUD-Rahmen, wie im Portfolio). */
export function Brackets({ size = 14, className = '' }: { size?: number; className?: string }) {
  const corner = 'absolute border-current';
  const s = { width: size, height: size };
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${corner} top-0 left-0 border-t-2 border-l-2`} style={s} />
      <span className={`${corner} top-0 right-0 border-t-2 border-r-2`} style={s} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} style={s} />
      <span className={`${corner} right-0 bottom-0 border-r-2 border-b-2`} style={s} />
    </span>
  );
}
