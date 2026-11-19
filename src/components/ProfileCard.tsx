import { achievementPoints } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { AchievementBadge } from './AchievementBadge';
import { TitleTag } from './Showcase';

interface Info {
  games: number;
  wins: number;
  points: number;
  achievements: string[];
  title: string | null;
  showcase: string[];
}

const cache = new Map<string, Promise<Info>>();

function load(userId: string): Promise<Info> {
  let p = cache.get(userId);
  if (!p) {
    p = Promise.all([
      supabase.from('player_stats').select('games, wins, points').eq('user_id', userId).maybeSingle(),
      supabase.from('user_achievements').select('key').eq('user_id', userId),
      supabase.from('profiles').select('title, showcase, show_title, show_badges').eq('id', userId).maybeSingle(),
    ]).then(([s, a, pr]) => ({
      games: s.data?.games ?? 0,
      wins: s.data?.wins ?? 0,
      points: s.data?.points ?? 0,
      achievements: (a.data ?? []).map((r) => r.key as string),
      title: pr.data?.show_title !== false ? ((pr.data?.title as string | null) ?? null) : null,
      showcase: pr.data?.show_badges !== false ? ((pr.data?.showcase as string[]) ?? []) : [],
    }));
    cache.set(userId, p);
    // Nach einer Minute frisch laden
    setTimeout(() => cache.delete(userId), 60_000);
  }
  return p;
}

/** Profilkarte beim Überfahren: Vitrine, Titel, Kurzstatistik. Für Bots und den Übungsmodus abschaltbar (userId leer). */
export function ProfileCard({ userId, name, children, placement = 'top' }: { userId?: string | null; name: string; children: ReactNode; placement?: 'top' | 'bottom' }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  if (!userId) return <>{children}</>;

  const show = () => {
    timer.current = setTimeout(() => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      // Frei schwebend (Kamerakacheln schneiden Überstehendes ab), am Bildschirmrand gehalten
      setOpen({ x: Math.max(8, Math.min(window.innerWidth - 264, r.left)), y: placement === 'top' ? r.top - 8 : r.bottom + 8 });
      void load(userId).then(setInfo);
    }, 250);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(null);
  };

  return (
    <span ref={anchor} className="relative inline-flex max-w-full" onPointerEnter={show} onPointerLeave={hide}>
      {children}
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: placement === 'top' ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ left: open.x, top: open.y, translateY: placement === 'top' ? '-100%' : 0 }}
            className="panel pointer-events-none fixed z-[95] flex w-64 flex-col gap-2 p-3 text-left"
          >
            <span className="text-sm font-semibold">{name}</span>
            {info ? (
              <>
                <TitleTag titleKey={info.title} className="self-start" />
                {info.showcase.length > 0 && (
                  <span className="flex gap-1.5">
                    {info.showcase.map((k) => (
                      <AchievementBadge key={k} achievementKey={k} size={36} />
                    ))}
                  </span>
                )}
                <span className="tag grid grid-cols-3 gap-1 text-[9px] text-white/50">
                  <span>
                    <b className="block text-sm text-white tabular-nums">{info.games}</b>Spiele
                  </span>
                  <span>
                    <b className="block text-sm text-white tabular-nums">{info.games ? Math.round((info.wins / info.games) * 100) : 0} %</b>Siege
                  </span>
                  <span>
                    <b className="block text-sm text-white tabular-nums">{info.points > 0 ? `+${info.points}` : info.points}</b>Punkte
                  </span>
                </span>
                <span className="tag text-[9px] text-white/45">
                  {info.achievements.length} Erfolge · {achievementPoints(info.achievements)} Erfolgspunkte
                </span>
              </>
            ) : (
              <span className="tag text-[10px] text-white/40">Lädt …</span>
            )}
          </motion.span>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </span>
  );
}
