import { useEffect, useRef } from 'react';
import { useEffectsEnabled } from '../lib/prefs';

// Feine, langsam aufsteigende Lichtpunkte und ein wandernder Schimmer hinter dem Tisch.
// Bewusst als 2D-Canvas mit 30 Bildern pro Sekunde: braucht neben vier Videos kaum Leistung.

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
  gold: boolean;
}

export function Atmosphere() {
  const enabled = useEffectsEnabled();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!enabled || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    let w = 0;
    let h = 0;
    let motes: Mote[] = [];

    const spawn = (y?: number): Mote => ({
      x: Math.random() * w,
      y: y ?? Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vy: 6 + Math.random() * 14,
      drift: 4 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.06 + Math.random() * 0.28,
      gold: Math.random() < 0.55,
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, Math.max(30, (w * h) / 18000)));
      motes = Array.from({ length: count }, () => spawn());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 30 || document.hidden) return;
      const step = acc;
      acc = 0;
      const t = now / 1000;

      ctx.clearRect(0, 0, w, h);

      // Wandernder Schimmer
      const sx = w * (0.5 + 0.35 * Math.sin(t * 0.05));
      const sy = h * (0.45 + 0.2 * Math.cos(t * 0.07));
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.45);
      g.addColorStop(0, 'rgba(217, 180, 90, 0.07)');
      g.addColorStop(1, 'rgba(217, 180, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const m of motes) {
        m.y -= m.vy * step;
        const x = m.x + Math.sin(t * 0.5 + m.phase) * m.drift;
        if (m.y < -10) Object.assign(m, spawn(h + 10));
        const flicker = 0.75 + 0.25 * Math.sin(t * 1.3 + m.phase);
        ctx.beginPath();
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.gold
          ? `rgba(232, 205, 133, ${m.alpha * flicker})`
          : `rgba(233, 240, 236, ${m.alpha * 0.7 * flicker})`;
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.clearRect(0, 0, w, h);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 -z-10 h-full w-full" aria-hidden />;
}
