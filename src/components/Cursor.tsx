import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { useEffectsEnabled } from '../lib/prefs';

/**
 * Eigener Cursor: Punkt + nachziehender Ring (wie im Portfolio). Über Elementen mit
 * data-cursor="Text" wächst der Ring und zeigt den Text, z. B. „Spielen“ oder „Nehmen“.
 * Nur mit Maus; auf Touch-Geräten, bei reduzierter Bewegung oder ohne Effekte bleibt der normale Cursor.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const effects = useEffectsEnabled();
  const [fine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const enabled = fine && effects && !reduce;
  const [label, setLabel] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 30, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 350, damping: 30, mass: 0.5 });

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('has-cursor');
    const inspect = (el: Element | null) => {
      const t = (el as HTMLElement | null)?.closest<HTMLElement>(
        'a, button:not([disabled]), [data-cursor], input, select, label, [role=button]',
      );
      setHovering(!!t);
      setLabel(t?.dataset.cursor ?? null);
    };
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      inspect(e.target as Element);
    };
    const down = () => setPressed(true);
    // Nach einem Klick kann das Element unter dem Cursor verschwinden (Karte gespielt, Dialog offen)
    const up = () => {
      setPressed(false);
      setTimeout(() => inspect(document.elementFromPoint(x.get(), y.get())), 180);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('has-cursor');
    };
  }, [enabled, x, y]);

  if (!enabled) return null;
  const size = label ? 84 : hovering ? 44 : 26;

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[200] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400"
        style={{ x, y }}
      />
      <motion.div
        aria-hidden
        className="tag pointer-events-none fixed top-0 left-0 z-[200] flex items-center justify-center rounded-full border border-gold-400/70 text-[10px] text-felt-950"
        style={{ x: rx, y: ry, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: size,
          height: size,
          scale: pressed ? 0.85 : 1,
          backgroundColor: label ? 'rgba(217,180,90,1)' : 'rgba(217,180,90,0)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {label}
      </motion.div>
    </>
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
