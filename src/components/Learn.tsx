import type { Card, TrickContext } from '@engine';
import { ArrowDown, Check, ChevronLeft, ChevronRight, Copy, Flame, GraduationCap, Play, Trophy, TrendingUp, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LEARN_LEVELS, lessonText, type PlayKind, RULE_LEVEL, RULE_ORDER, type RuleKey, type TrickLesson } from '../lib/trickLesson';
import { PlayingCard } from './PlayingCard';

// ---------------------------------------------------------------------------
// Frage zu Rundenbeginn
// ---------------------------------------------------------------------------

export function LearnPrompt({ onYes, onNo, level }: { onYes: () => void; onNo: () => void; level: number }) {
  return (
    <motion.div
      className="fixed inset-0 z-[75] grid place-items-center bg-black/55 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="learn-title"
    >
      <motion.div
        className="panel w-full max-w-sm p-6 text-center"
        initial={{ y: 16, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <GraduationCap className="mx-auto size-9 text-gold-300" aria-hidden />
        <h2 id="learn-title" className="mt-3 text-xl font-semibold">
          Möchtest du Doppelkopf lernen?
        </h2>
        <p className="mt-2 text-sm text-white/65">
          Du schaust zu und siehst alle Karten. Auf Wunsch erklären wir dir jeden Stich – Schritt für Schritt in vier Stufen,
          von den Grundlagen bis zu den Punkten.
        </p>
        <p className="mt-2 text-sm text-gold-200/90">
          {level > 1 ? `Weiter bei Stufe ${level}: ${LEARN_LEVELS[level - 1].title}` : `Los geht's mit Stufe 1: ${LEARN_LEVELS[0].title}`}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn-primary justify-center" onClick={onYes} autoFocus>
            Ja, erklär mir das Spiel
          </button>
          <button className="btn-ghost justify-center" onClick={onNo}>
            Nein danke
          </button>
        </div>
        <p className="mt-3 text-[11px] text-white/40">
          „Nein danke“ merken wir uns. In den Einstellungen unter „Doppelkopf lernen“ kannst du die Frage wieder einschalten.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Erklärungen pro Stich
// ---------------------------------------------------------------------------

export interface LessonItem {
  id: number;
  /** 1-basiert */
  number: number;
  cards: Card[];
  lesson: TrickLesson;
}

const KIND_ICON: Record<PlayKind, { icon: ReactNode; label: string; cls: string }> = {
  lead: { icon: <Play className="size-3" />, label: 'spielt aus', cls: 'text-white/70' },
  follow: { icon: <Check className="size-3" />, label: 'bedient', cls: 'text-emerald-300' },
  trump: { icon: <Zap className="size-3" />, label: 'sticht mit Trumpf', cls: 'text-gold-300' },
  discard: { icon: <ArrowDown className="size-3" />, label: 'wirft ab', cls: 'text-white/40' },
};

const REASON: Record<TrickLesson['reason'], { icon: ReactNode; label: string }> = {
  trumpBeats: { icon: <Zap className="size-3.5" />, label: 'Trumpf sticht' },
  highestTrump: { icon: <TrendingUp className="size-3.5" />, label: 'höchster Trumpf' },
  highest: { icon: <TrendingUp className="size-3.5" />, label: 'höchste Farbe' },
  equal: { icon: <Copy className="size-3.5" />, label: 'erste von zwei' },
  dulle: { icon: <Flame className="size-3.5" />, label: 'Dulle' },
  alone: { icon: <Play className="size-3.5" />, label: '' },
};

const SPECIAL: Record<TrickLesson['specials'][number], string> = {
  doppelkopf: '40+ Doppelkopf',
  fuchs: '🦊 Fuchs',
  karlchen: '♣B Karlchen',
};

/** Stapel der letzten Stich-Erklärungen: neueste oben, jede mit eigenem Timer, Hovern hält ihn an */
export function LessonFeed({
  items,
  ctx,
  name,
  onDone,
  onHoverPos,
  level,
  max = 2,
}: {
  level: number;
  items: LessonItem[];
  ctx: TrickContext;
  name: (pos: number) => string;
  onDone: (id: number) => void;
  onHoverPos: (pos: number | null) => void;
  max?: number;
}) {
  const shown = items.slice(-max).reverse();
  return (
    <div className="flex w-full max-w-xl flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {shown.map((it) => (
          <LessonCard key={it.id} item={it} ctx={ctx} name={name} level={level} onDone={() => onDone(it.id)} onHoverPos={onHoverPos} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function LessonCard({
  item,
  ctx,
  name,
  onDone,
  onHoverPos,
  level,
}: {
  level: number;
  item: LessonItem;
  ctx: TrickContext;
  name: (pos: number) => string;
  onDone: () => void;
  onHoverPos: (pos: number | null) => void;
}) {
  const { lesson: l, cards } = item;
  const lines = lessonText(l, cards, ctx, name, level);
  // Genug Zeit zum Lesen: Grundzeit plus pro Zeile; beim Hovern steht die Uhr
  const total = 7000 + lines.length * 2200;
  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      setLeft((v) => Math.max(0, v - (now - last)));
      last = now;
    }, 100);
    return () => clearInterval(t);
  }, [paused]);
  useEffect(() => {
    if (left <= 0) done.current();
  }, [left]);

  const winPos = l.plays[l.winnerIdx].pos;
  // Was erst in späteren Stufen kommt, bleibt in der Kurzfassung weg
  const reason = level < 2 && (l.reason === 'dulle' || l.reason === 'highestTrump') ? REASON.highestTrump : REASON[l.reason];
  const chip = (pos: number, children: ReactNode, cls = '') => (
    <span
      className={`cursor-default rounded px-1 font-semibold transition-colors hover:bg-white/10 ${cls}`}
      onMouseEnter={() => onHoverPos(pos)}
      onMouseLeave={() => onHoverPos(null)}
    >
      {children}
    </span>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-xl bg-felt-950/90 text-left ring-1 ring-gold-400/25 shadow-xl backdrop-blur"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        onHoverPos(null);
      }}
    >
      {/* Kurz und knapp: Karten, wer was gemacht hat, Gewinner, Grund, Augen */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-2.5">
        <span className="tag text-[10px] text-white/40">Stich {item.number}</span>
        <div className="flex gap-1.5">
          {l.plays.map((p) => {
            const k = KIND_ICON[p.kind];
            return (
              <div
                key={p.card}
                className="flex flex-col items-center gap-0.5"
                title={`${name(p.pos)} ${k.label}`}
                onMouseEnter={() => onHoverPos(p.pos)}
                onMouseLeave={() => onHoverPos(null)}
              >
                <PlayingCard card={p.card} width={30} className={p.idx === l.winnerIdx ? 'ring-2 ring-gold-400' : 'opacity-85'} />
                <span className={`flex items-center gap-0.5 text-[9px] ${k.cls}`}>
                  {k.icon}
                  <span className="max-w-10 truncate">{name(p.pos)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 text-gold-200">
            <Trophy className="size-3.5" aria-hidden />
            {chip(winPos, name(winPos))}
          </span>
          {reason.label && (
            <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-white/80">
              {reason.icon}
              {reason.label}
            </span>
          )}
          {level >= 4 && (
            <span className="rounded-full bg-gold-400/15 px-2 py-0.5 font-semibold text-gold-200 tabular-nums" title="Augen im Stich">
              {l.augen} Augen
            </span>
          )}
          {(level >= 4 ? l.specials : []).map((s) => (
            <span key={s} className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-200">
              {SPECIAL[s]}
            </span>
          ))}
        </div>
      </div>
      {/* Ausführlich: Karte für Karte */}
      <ol className="space-y-0.5 px-3 pt-1.5 pb-3 text-[11px] leading-snug text-white/65">
        {lines.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <button
        className="absolute top-1.5 right-1.5 rounded p-0.5 text-white/35 hover:text-white"
        onClick={onDone}
        aria-label="Erklärung schließen"
      >
        <X className="size-3.5" />
      </button>
      {/* Timer: läuft ab, beim Hovern angehalten */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]" aria-hidden>
        <div
          className={`h-full transition-colors ${paused ? 'bg-sky-300/80' : 'bg-gold-400/70'}`}
          style={{ width: `${(left / total) * 100}%` }}
        />
      </div>
      {paused && <span className="tag absolute right-7 top-1.5 text-[9px] text-sky-300/80">angehalten</span>}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Regeln kurz und knapp – was gerade greift, leuchtet leicht
// ---------------------------------------------------------------------------

export function RulesPanel({
  texts,
  active,
  level,
  onLevel,
  suggestNext,
  notices,
  className = '',
}: {
  texts: Record<RuleKey, { title: string; text: string } | null>;
  active: RuleKey[];
  level: number;
  onLevel: (level: number) => void;
  /** Nach ein paar Stichen auf dieser Stufe: Hinweis, dass es weitergehen kann */
  suggestNext: boolean;
  /** Was gerade passiert, aber erst in einer späteren Stufe erklärt wird */
  notices: string[];
  className?: string;
}) {
  const info = LEARN_LEVELS[level - 1];
  return (
    <div className={`rounded-xl bg-black/30 p-2.5 ring-1 ring-white/[0.06] ${className}`}>
      {/* Stufe: vor und zurück jederzeit möglich */}
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <GraduationCap className="size-3.5 text-white/45" aria-hidden />
        <span className="tag flex-1 text-[10px] text-white/45">
          Stufe {level}/{LEARN_LEVELS.length} · <span className="text-white/75">{info.title}</span>
        </span>
        <button className="rounded p-0.5 text-white/45 hover:text-white disabled:opacity-25" disabled={level <= 1} onClick={() => onLevel(level - 1)} aria-label="Vorige Stufe">
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          className="rounded p-0.5 text-white/45 hover:text-white disabled:opacity-25"
          disabled={level >= LEARN_LEVELS.length}
          onClick={() => onLevel(level + 1)}
          aria-label="Nächste Stufe"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="mb-2 flex gap-0.5 px-1" aria-hidden>
        {LEARN_LEVELS.map((_, i) => (
          <span key={i} className={`h-0.5 flex-1 rounded-full ${i < level ? 'bg-gold-400/70' : 'bg-white/10'}`} />
        ))}
      </div>
      <p className="mb-2 px-1 text-[11px] leading-snug text-white/60">{info.intro}</p>
      <ul className="flex flex-col gap-1">
        {RULE_ORDER.filter((k) => RULE_LEVEL[k] <= level).map((k) => {
          const r = texts[k];
          if (!r) return null;
          const on = active.includes(k);
          const fresh = RULE_LEVEL[k] === level && level > 1;
          return (
            <li
              key={k}
              className={`rounded-lg px-2 py-1 text-[11px] leading-snug transition-[background-color,box-shadow,color] duration-500 ${
                on
                  ? 'bg-gold-400/[0.09] text-white/90 shadow-[0_0_14px_rgba(217,180,90,0.18)] ring-1 ring-gold-400/30'
                  : 'text-white/45'
              }`}
            >
              {fresh && <span className="mr-1 inline-block size-1.5 rounded-full bg-sky-300/70 align-middle" title="Neu in dieser Stufe" />}
              <span className={`font-semibold ${on ? 'text-gold-200' : 'text-white/60'}`}>{r.title}</span> · {r.text}
            </li>
          );
        })}
      </ul>
      {notices.length > 0 && (
        <ul className="mt-2 space-y-0.5 px-1">
          {notices.map((n) => (
            <li key={n} className="text-[10px] text-white/40">
              {n}
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>
        {suggestNext && level < LEARN_LEVELS.length && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 w-full rounded-lg bg-sky-400/10 px-2 py-1.5 text-left text-[11px] text-sky-200 ring-1 ring-sky-300/25 hover:bg-sky-400/15"
            onClick={() => onLevel(level + 1)}
          >
            Sitzt das? Weiter zu Stufe {level + 1}: {LEARN_LEVELS[level].title} →
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
