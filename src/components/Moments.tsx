import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Große Momente am Tisch: Ansagen, Soli, Fuchs, Doppelkopf … erscheinen kurz groß über der Spielfläche.

export interface Moment {
  title: string;
  sub?: string;
  tone?: 'gold' | 're' | 'kontra';
}

interface Shown extends Moment {
  id: number;
}

let nextId = 1;

/** Warteschlange: Momente erscheinen nacheinander, nie mehrere übereinander. */
export function useMoments() {
  const [queue, setQueue] = useState<Shown[]>([]);
  const push = useCallback((m: Moment) => setQueue((q) => [...q.slice(-3), { ...m, id: nextId++ }]), []);
  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 1900);
    return () => clearTimeout(t);
  }, [current]);
  return { current, push };
}

const TONE: Record<NonNullable<Moment['tone']>, { glow: string; spark: string }> = {
  gold: { glow: 'rgba(217,180,90,0.5)', spark: '#e8cd85' },
  re: { glow: 'rgba(106,168,240,0.5)', spark: '#9cc8ff' },
  kontra: { glow: 'rgba(238,138,107,0.5)', spark: '#ffb49c' },
};

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
  const d = 90 + (i % 3) * 40;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.6, s: 3 + (i % 3) * 2 };
});

export function MomentOverlay({ moment }: { moment: Shown | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <AnimatePresence mode="wait">
        {moment && (
          <motion.div
            key={moment.id}
            className="relative flex flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.15, filter: 'blur(6px)', transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            {/* Funken */}
            {SPARKS.map((p, i) => (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{ width: p.s, height: p.s, background: TONE[moment.tone ?? 'gold'].spark }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.05 }}
              />
            ))}
            {/* Dunkler Schein, damit der Text auch über Karten lesbar ist */}
            <span aria-hidden className="absolute -inset-x-10 -inset-y-4 rounded-full bg-felt-950/75 blur-2xl" />
            <span
              className={`display relative text-7xl sm:text-8xl ${moment.tone === 're' ? 'text-re' : moment.tone === 'kontra' ? 'text-kontra' : 'text-gold-300'}`}
              style={{ textShadow: `0 0 32px ${TONE[moment.tone ?? 'gold'].glow}, 0 3px 0 rgba(0,0,0,0.45)` }}
            >
              {moment.title.replace(/!$/, '')}
            </span>
            {moment.sub && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="tag relative mt-2 text-[11px] text-white/80"
              >
                {moment.sub}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Konfetti-Regen, z. B. beim Sieg. Leichtgewichtig auf einem Canvas. */
export function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!active || !canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const colors = ['#e8cd85', '#d9b45a', '#6aa8f0', '#ee8a6b', '#e9f0ec', '#8fd3a8'];
    const pieces = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 18 * dpr,
      vy: (-10 - Math.random() * 14) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: (5 + Math.random() * 6) * dpr,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 3.2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3.2) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden />;
}
