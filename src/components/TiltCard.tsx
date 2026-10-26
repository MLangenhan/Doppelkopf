import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useFx } from '../lib/prefs';
import { CARD_RADIUS } from './PlayingCard';

/**
 * Karte, die sich zur Maus neigt, mit einem Glanzlicht, das über die Oberfläche wandert.
 * Nur mit Maus und ohne reduzierte Bewegung, sonst bleibt sie flach.
 */
export function TiltCard({ children, max = 14 }: { children: ReactNode; max?: number }) {
  const reduce = useReducedMotion();
  const [fine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const on = useFx('tilt');
  const enabled = fine && !reduce && on;

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(0, { stiffness: 260, damping: 22 });
  const rotateY = useSpring(0, { stiffness: 260, damping: 22 });
  const glare = useSpring(0, { stiffness: 200, damping: 30 });
  const gx = useMotionTemplate`${useSpring(px, { stiffness: 260, damping: 30 })}`;
  const gy = useMotionTemplate`${useSpring(py, { stiffness: 260, damping: 30 })}`;
  const background = useMotionTemplate`radial-gradient(circle at calc(${gx} * 100%) calc(${gy} * 100%), rgba(255,255,255,0.55), rgba(255,255,255,0) 55%)`;

  if (!enabled) return <>{children}</>;

  return (
    <motion.div
      className="relative"
      style={{ rotateX, rotateY, transformPerspective: 700 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        px.set(x);
        py.set(y);
        rotateY.set((x - 0.5) * 2 * max);
        rotateX.set(-(y - 0.5) * 2 * max);
        glare.set(1);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
        glare.set(0);
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${CARD_RADIUS} mix-blend-overlay`}
        style={{ background, opacity: glare }}
      />
    </motion.div>
  );
}
