import { achievementPointsOf, ACHIEVEMENT_BY_KEY, TITLE_BY_KEY, TITLES, type TitleDef } from '@engine';
import { Check, Coins, Lock, RotateCcw, Sparkles, X } from 'lucide-react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/sound';
import { Confetti } from './Moments';
import { Nametag } from './Nametag';
import type { FrameKey } from '../lib/cosmetics';
import { TitleTag } from './Showcase';
import { VideoTile } from './VideoTile';

type Sort = 'leistbar' | 'preis' | 'besitz';
const SORT_LABELS: Record<Sort, string> = { leistbar: 'Leistbar zuerst', preis: 'Nach Preis', besitz: 'Besitze ich' };
const RARE_CONFETTI = ['#bae6fd', '#7dd3fc', '#e0f2fe', '#ffffff', '#38bdf8'];
const GOLD_CONFETTI = ['#e8cd85', '#d9b45a', '#fff4d6', '#ffffff', '#b8913a'];

export interface ShopLook {
  badges: string[];
  showBadges: boolean;
  frame: FrameKey | null;
  avatar: string | null;
  avatarColor: string | null;
  title: string | null;
}

/** Titel-Shop: Geldbörse, Sortierung, Karten mit Glanz – und ein richtiger Kaufmoment im Dialog */
export function TitleShop({
  owned,
  free,
  name,
  look,
  earned,
  onBuy,
  onRefund,
  onWear,
  onPeek,
}: {
  owned: string[];
  free: number;
  name: string;
  look: ShopLook;
  /** Eigene Erfolge (für „woher kommen die Punkte“) */
  earned: string[];
  onBuy: (key: string) => Promise<boolean>;
  onRefund: (key: string) => Promise<boolean>;
  onWear: (key: string | null) => void;
  onPeek: (key: string | null) => void;
}) {
  const [sort, setSort] = useState<Sort>('leistbar');
  const [open, setOpen] = useState<TitleDef | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const walletRef = useRef<HTMLButtonElement>(null);

  // Kontostand zählt sichtbar mit (beim Kauf runter, beim Rückgängig wieder hoch)
  const shown = useMotionValue(free);
  const rounded = useTransform(shown, (v) => Math.round(v));
  useEffect(() => {
    const c = animate(shown, free, { duration: 0.9, ease: 'easeOut' });
    return () => c.stop();
  }, [free, shown]);

  const sorted = [...TITLES].sort((a, b) => {
    if (sort === 'preis') return a.cost - b.cost;
    if (sort === 'besitz') return Number(owned.includes(b.key)) - Number(owned.includes(a.key)) || a.cost - b.cost;
    const ra = owned.includes(a.key) ? 2 : a.cost <= free ? 0 : 1;
    const rb = owned.includes(b.key) ? 2 : b.cost <= free ? 0 : 1;
    return ra - rb || a.cost - b.cost;
  });
  const spent = owned.reduce((s, k) => s + (TITLE_BY_KEY.get(k)?.cost ?? 0), 0);

  return (
    <div className="pt-6">
      {/* Geldbörse: bleibt oben stehen, ein Klick zeigt, woher die Punkte kommen */}
      <div className="sticky top-0 z-20 -mx-2 mb-4 flex flex-wrap items-center gap-3 bg-felt-950/85 px-2 py-2 backdrop-blur">
        <button
          ref={walletRef}
          className="flex items-center gap-2 rounded-full bg-gold-400/15 px-3 py-1.5 ring-1 ring-gold-400/40 transition hover:bg-gold-400/25"
          onClick={() => setWalletOpen((o) => !o)}
          aria-expanded={walletOpen}
        >
          <Coins className="size-5 text-gold-300" />
          <motion.span className="display text-2xl leading-none text-gold-200 tabular-nums">{rounded}</motion.span>
          <span className="tag text-[10px] text-white/55">Punkte frei</span>
        </button>
        <div className="ml-auto flex gap-1 rounded-lg bg-black/25 p-0.5" role="radiogroup" aria-label="Sortierung">
          {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={sort === k}
              onClick={() => setSort(k)}
              className={`tag rounded-md px-2 py-1 text-[10px] ${sort === k ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {walletOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-full left-2 z-30 mt-1 max-h-80 w-80 overflow-y-auto rounded-xl bg-felt-900 p-3 text-sm shadow-2xl ring-1 ring-white/10"
            >
              <p className="tag mb-2 text-[10px] text-white/45">Verdient durch Erfolge</p>
              <ul className="space-y-1">
                {earned.map((k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="truncate text-white/80">{ACHIEVEMENT_BY_KEY.get(k)?.name ?? k}</span>
                    <span className="text-gold-300 tabular-nums">+{achievementPointsOf(k)}</span>
                  </li>
                ))}
                {!earned.length && <li className="text-white/50">Noch keine Erfolge – spiel ein paar Runden!</li>}
              </ul>
              {spent > 0 && (
                <>
                  <p className="tag mt-3 mb-1 text-[10px] text-white/45">Ausgegeben für Titel</p>
                  <ul className="space-y-1">
                    {owned.map((k) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="truncate text-white/70">{TITLE_BY_KEY.get(k)?.name ?? k}</span>
                        <span className="text-white/50 tabular-nums">−{TITLE_BY_KEY.get(k)?.cost ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((t) => {
          const has = owned.includes(t.key);
          const active = look.title === t.key;
          const afford = free >= t.cost;
          return (
            <li key={t.key}>
              <button
                onPointerEnter={() => onPeek(t.key)}
                onPointerLeave={() => onPeek(null)}
                onClick={() => (has ? onWear(active ? null : t.key) : setOpen(t))}
                className={`shine-sweep group flex w-full flex-col gap-3 rounded-xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${
                  t.rare ? 'shine-border bg-gradient-to-br from-sky-400/15 to-transparent ring-sky-300/30' : 'bg-white/[0.03] ring-white/[0.06] hover:ring-gold-400/40'
                } ${has ? '' : afford ? '' : 'opacity-70'}`}
              >
                <TitleTag titleKey={t.key} className="self-start text-[12px]!" />
                <span className="flex items-center gap-2">
                  {has ? (
                    <span className={`tag flex items-center gap-1 text-[10px] ${active ? 'text-gold-300' : 'text-white/55'}`}>
                      <Check className="size-3" /> {active ? 'Getragen' : 'Besitzt du · Tragen'}
                    </span>
                  ) : (
                    <span className={`tag flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${afford ? 'bg-gold-400/15 text-gold-200' : 'bg-white/5 text-white/50'}`}>
                      {afford ? <Coins className="size-3" /> : <Lock className="size-3" />}
                      {t.cost}
                    </span>
                  )}
                  {t.rare && <span className="tag text-[9px] text-sky-200/80">sehr selten</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {open && (
          <BuyDialog
            key={open.key}
            title={open}
            free={free}
            name={name}
            look={look}
            walletRef={walletRef}
            onBuy={onBuy}
            onRefund={onRefund}
            onWear={onWear}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type Phase = 'confirm' | 'buying' | 'bought';

function BuyDialog({
  title: t,
  free,
  name,
  look,
  walletRef,
  onBuy,
  onRefund,
  onWear,
  onClose,
}: {
  title: TitleDef;
  free: number;
  name: string;
  look: ShopLook;
  walletRef: React.RefObject<HTMLButtonElement | null>;
  onBuy: (key: string) => Promise<boolean>;
  onRefund: (key: string) => Promise<boolean>;
  onWear: (key: string | null) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [hold, setHold] = useState(0);
  const [undo, setUndo] = useState(10);
  const [coins, setCoins] = useState<{ x: number; y: number } | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const afford = free >= t.cost;
  const after = free - t.cost;

  const doBuy = async () => {
    if (phase !== 'confirm' || !afford) return;
    setPhase('buying');
    // Münzen fliegen von der Geldbörse zum Titel
    const w = walletRef.current?.getBoundingClientRect();
    const d = titleRef.current?.getBoundingClientRect();
    if (w && d) setCoins({ x: d.left + d.width / 2 - (w.left + 40), y: d.top + d.height / 2 - (w.top + w.height / 2) });
    const ok = await onBuy(t.key);
    if (!ok) return setPhase('confirm');
    sound.purchase(!!t.rare);
    setTimeout(() => setPhase('bought'), 550);
  };

  // Sehr seltene Titel: Knopf kurz gedrückt halten
  const holdTimer = useRef<number | null>(null);
  const startHold = () => {
    if (!afford || phase !== 'confirm') return;
    const start = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / 1200);
      setHold(p);
      if (p >= 1) {
        holdTimer.current = null;
        void doBuy();
      } else holdTimer.current = requestAnimationFrame(step);
    };
    holdTimer.current = requestAnimationFrame(step);
  };
  const stopHold = () => {
    if (holdTimer.current) cancelAnimationFrame(holdTimer.current);
    holdTimer.current = null;
    if (phase === 'confirm') setHold(0);
  };

  // Rückgängig: 10 Sekunden lang
  useEffect(() => {
    if (phase !== 'bought' || undo <= 0) return;
    const id = setTimeout(() => setUndo((u) => u - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, undo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={phase === 'buying' ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Titel „${t.name}“`}
    >
      <Confetti active={phase === 'bought'} colors={t.rare ? RARE_CONFETTI : GOLD_CONFETTI} />
      {/* Münzen auf dem Weg von der Geldbörse zum Titel */}
      {coins &&
        walletRef.current &&
        Array.from({ length: 8 }, (_, i) => {
          const w = walletRef.current!.getBoundingClientRect();
          return (
            <motion.span
              key={i}
              className="pointer-events-none fixed z-[90] text-gold-300"
              style={{ left: w.left + 28, top: w.top + w.height / 2 - 10 }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{ x: coins.x + (i - 4) * 6, y: coins.y + ((i * 13) % 20) - 10, opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 0.8] }}
              transition={{ duration: 0.75, delay: i * 0.05, ease: 'easeInOut' }}
            >
              <Coins className="size-5 drop-shadow" />
            </motion.span>
          );
        })}

      <motion.div
        className={`panel relative w-full max-w-md p-6 text-center ${t.rare ? 'shine-border' : ''}`}
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="btn-ghost absolute top-2 right-2 p-1.5" onClick={onClose} aria-label="Schließen" disabled={phase === 'buying'}>
          <X className="size-5" />
        </button>

        <p className="tag text-[10px] text-white/45">{phase === 'bought' ? 'Gekauft!' : t.rare ? 'Sehr seltener Titel' : 'Titel'}</p>
        {/* Der Titel – beim Kauf „ausgepackt“ */}
        <motion.div
          ref={titleRef}
          className={`relative mx-auto mt-3 w-fit overflow-hidden rounded-lg px-4 py-2 ${t.rare ? 'bg-sky-400/10' : 'bg-gold-400/10'}`}
          animate={phase === 'bought' ? { scale: [0.7, 1.25, 1], rotate: [0, -3, 0] } : { scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <TitleTag titleKey={t.key} className="text-xl! tracking-wider" />
          {phase === 'bought' && (
            <motion.span
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.7)_50%,transparent_70%)]"
              initial={{ x: '-120%' }}
              animate={{ x: '120%' }}
              transition={{ duration: 0.8, delay: 0.15 }}
            />
          )}
        </motion.div>

        {/* So sieht es am Tisch aus */}
        <div className="mx-auto mt-5 w-64">
          <VideoTile stream={null} name={name} avatar={look.avatar} avatarColor={look.avatarColor} className="aspect-[4/3] w-full">
            <Nametag className="absolute bottom-2 left-2 max-w-[92%]" name={name} title={t.key} badges={look.showBadges ? look.badges : []} frame={look.frame} />
          </VideoTile>
        </div>

        {phase !== 'bought' ? (
          <>
            {/* Kontostand vorher → nachher */}
            <div className="mt-5 flex items-center justify-center gap-3 text-lg tabular-nums">
              <span className="flex items-center gap-1.5 text-gold-200">
                <Coins className="size-5" /> {free}
              </span>
              <span className="text-white/40">→</span>
              <span className={after < 0 ? 'text-red-300' : 'text-white'}>{after < 0 ? `fehlen ${-after}` : after}</span>
            </div>
            {afford ? (
              t.rare ? (
                <button
                  className="btn-primary relative mt-5 w-full justify-center overflow-hidden py-3 text-base select-none"
                  onPointerDown={startHold}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && startHold()}
                  onKeyUp={stopHold}
                  disabled={phase !== 'confirm'}
                >
                  <span className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${hold * 100}%` }} aria-hidden />
                  <span className="relative flex items-center gap-2">
                    <Sparkles className="size-4" /> Gedrückt halten zum Kaufen · {t.cost}
                  </span>
                </button>
              ) : (
                <button className="btn-primary mt-5 w-full justify-center py-3 text-base" onClick={() => void doBuy()} disabled={phase !== 'confirm'} autoFocus>
                  <Coins className="size-4" /> Für {t.cost} Punkte kaufen
                </button>
              )
            ) : (
              <p className="mt-5 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/65">
                <Lock className="mr-1 inline size-3.5" /> Dir fehlen noch {-after} Punkte – Erfolge bringen neue.
              </p>
            )}
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="mt-5 flex gap-2">
              <button
                className="btn-primary flex-1 justify-center py-3 text-base"
                onClick={() => {
                  onWear(t.key);
                  onClose();
                }}
                autoFocus
              >
                Jetzt tragen
              </button>
              <button className="btn-ghost flex-1 justify-center" onClick={onClose}>
                Später
              </button>
            </div>
            {undo > 0 && (
              <button
                className="tag mx-auto mt-3 flex items-center gap-1.5 text-[10px] text-white/50 hover:text-white"
                onClick={async () => {
                  if (await onRefund(t.key)) onClose();
                }}
              >
                <RotateCcw className="size-3" /> Rückgängig ({undo})
              </button>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
