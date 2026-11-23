import { ArrowDown, ArrowLeft, ChevronDown, Eye, GraduationCap, Pin, Play, Shuffle, X } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CONCEPTS, type ConceptKey, STAGES } from '../lib/lessons';

// ---------------------------------------------------------------------------
// Große Lernkarte: erst erklären, dann spielen
// ---------------------------------------------------------------------------

/**
 * Eine Lernkarte groß in der Mitte. „Verstanden“ (oder Enter/Leertaste) schickt sie an den rechten Rand –
 * die Animation läuft über die gemeinsame layoutId mit dem Merkzettel.
 */
export function ConceptCard({
  concept,
  onDone,
  modal = true,
  doneLabel = 'Verstanden',
  reveal = false,
  guideSide = null,
  center = false,
}: {
  concept: ConceptKey;
  onDone: () => void;
  /** Offline: Spiel steht, Hintergrund abgedunkelt. Online: schwebt nur über dem Tisch. */
  modal?: boolean;
  doneLabel?: string;
  /** Markierte Karten in der Hand sollen sichtbar bleiben: Karte oben, Hintergrund kaum abgedunkelt */
  reveal?: boolean;
  /** Wo die Kartenübersicht steht – dann gibt es einen Verweis darauf (null = keine Übersicht sichtbar) */
  guideSide?: 'left' | 'below' | null;
  /** Oberflächen-Tour: mittig mit hellem Hintergrund, damit oben und unten alles sichtbar bleibt */
  center?: boolean;
}) {
  const c = CONCEPTS[concept];
  const Icon = c.icon;
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modal, onDone]);

  const body = (
    <motion.div
      layoutId={`concept-${concept}`}
      className="pointer-events-auto w-full max-w-md rounded-2xl bg-felt-950/95 p-6 shadow-2xl ring-1 ring-gold-400/40 backdrop-blur"
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      role="dialog"
      aria-labelledby={`concept-title-${concept}`}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/30">
          <Icon className="size-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="tag text-[10px] text-white/45">
            Stufe {c.stage} · {STAGES[c.stage - 1].title}
          </p>
          <h2 id={`concept-title-${concept}`} className="text-2xl leading-tight font-semibold">
            {c.title}
          </h2>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {c.points.map((p, i) => (
          <li key={i} className="flex gap-3 text-lg leading-snug text-white/90">
            <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-gold-200">
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ul>
      {c.guide && guideSide && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm leading-snug text-emerald-100 ring-1 ring-emerald-300/25">
          {guideSide === 'left' ? <ArrowLeft className="mt-0.5 size-4 shrink-0" /> : <ArrowDown className="mt-0.5 size-4 shrink-0" />}
          <span>
            <span className="font-semibold">Kartenübersicht {guideSide === 'left' ? 'links' : 'unten'}:</span> {c.guide}
          </span>
        </p>
      )}
      <button className="btn-primary mt-6 w-full justify-center py-3 text-base" onClick={onDone} autoFocus={modal}>
        {doneLabel} →
      </button>
    </motion.div>
  );

  if (!modal) return body;
  return (
    <motion.div
      className={`fixed inset-0 z-[70] grid justify-items-center p-4 transition-colors ${center ? 'place-items-center bg-black/10' : reveal ? 'items-start bg-black/10 pt-[12vh]' : 'place-items-center bg-black/45'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {body}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Merkzettel am rechten Rand
// ---------------------------------------------------------------------------

export function NotesRail({
  notes,
  mobile,
  inline = false,
  right = 8,
}: {
  notes: ConceptKey[];
  mobile: boolean;
  inline?: boolean;
  /** Abstand zum rechten Rand – beim Zuschauen neben die Kartenspalte rücken */
  right?: number;
}) {
  const [open, setOpen] = useState<ConceptKey | null>(null);
  const [sheet, setSheet] = useState(false);
  if (!notes.length) return null;

  const list = (
    <ul className="flex flex-col gap-1.5">
      {notes.map((k) => {
        const c = CONCEPTS[k];
        const Icon = c.icon;
        const isOpen = open === k;
        return (
          <motion.li
            key={k}
            layoutId={mobile ? undefined : `concept-${k}`}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="overflow-hidden rounded-xl bg-felt-950/90 ring-1 ring-white/10 backdrop-blur"
          >
            <button
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-white/5"
              onClick={() => setOpen(isOpen ? null : k)}
              aria-expanded={isOpen}
            >
              <Icon className="size-4 shrink-0 text-gold-300" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <ChevronDown className={`size-3.5 shrink-0 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1 px-3 pb-2.5 text-[13px] leading-snug text-white/75"
                >
                  {c.points.map((p, i) => (
                    <li key={i}>· {p}</li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.li>
        );
      })}
    </ul>
  );

  if (mobile) {
    return (
      <>
        <button
          className="fixed right-3 bottom-3 z-[60] flex items-center gap-1.5 rounded-full bg-felt-950/95 px-3 py-2 text-sm ring-1 ring-gold-400/40 shadow-xl"
          onClick={() => setSheet(true)}
        >
          <Pin className="size-4 text-gold-300" /> Merkzettel ({notes.length})
        </button>
        <AnimatePresence>
          {sheet && (
            <motion.div className="fixed inset-0 z-[80] bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)}>
              <motion.div
                className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-felt-900 p-4"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Merkzettel</h2>
                  <button className="btn-ghost p-1.5" onClick={() => setSheet(false)} aria-label="Schließen">
                    <X className="size-5" />
                  </button>
                </div>
                {list}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
  if (inline) {
    return (
      <div aria-label="Merkzettel">
        <p className="tag mb-1.5 flex items-center gap-1.5 px-1 text-[10px] text-white/50">
          <Pin className="size-3" /> Merkzettel
        </p>
        {list}
      </div>
    );
  }
  return (
    <aside className="fixed top-[180px] z-[60] flex max-h-[calc(100vh-380px)] w-56 flex-col gap-1.5 overflow-y-auto" style={{ right }} aria-label="Merkzettel">
      <p className="tag flex items-center gap-1.5 px-1 text-[10px] text-white/50">
        <Pin className="size-3" /> Merkzettel
      </p>
      {list}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Große Ansage-Titel
// ---------------------------------------------------------------------------

export function BigTitle({ title }: { title: { id: number; text: string; sub?: string } | null }) {
  return (
    <AnimatePresence>
      {title && (
        <motion.div
          key={title.id}
          className="pointer-events-none fixed inset-x-0 top-[38%] z-[65] flex flex-col items-center text-center"
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <span className="display text-6xl text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-8xl">{title.text}</span>
          {title.sub && <span className="tag mt-2 text-sm text-gold-200 drop-shadow">{title.sub}</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Kurzer Titel, der nach einer Weile von selbst verschwindet */
export function useBigTitle(ms = 1600) {
  const [title, setTitle] = useState<{ id: number; text: string; sub?: string } | null>(null);
  useEffect(() => {
    if (!title) return;
    const t = setTimeout(() => setTitle(null), ms);
    return () => clearTimeout(t);
  }, [title, ms]);
  return [title, (text: string, sub?: string) => setTitle({ id: Date.now(), text, sub })] as const;
}

export { LayoutGroup };

// ---------------------------------------------------------------------------
// Startauswahl im Übungsmodus
// ---------------------------------------------------------------------------

export type PracticeChoice = { mode: 'learnPlay' | 'learnWatch'; stage: number } | { mode: 'free' };

export function PracticeChooser({ level, onChoose }: { level: number; onChoose: (c: PracticeChoice) => void }) {
  const [stage, setStage] = useState(Math.min(4, Math.max(1, level)));
  const tile = 'group flex flex-col items-start gap-2 rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-gold-400/50';
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div>
        <p className="tag text-[11px] text-gold-300">Übung · offline gegen Bots</p>
        <h1 className="display mt-2 text-5xl sm:text-6xl">Wie möchtest du üben?</h1>
      </div>

      <section>
        <h2 className="tag mb-3 flex items-center gap-1.5 text-[11px] text-white/55">
          <GraduationCap className="size-3.5" /> Lektion wählen
        </h2>
        <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Lektion">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const on = stage === s.stage;
            return (
              <button
                key={s.stage}
                role="radio"
                aria-checked={on}
                onClick={() => setStage(s.stage)}
                className={`flex flex-col gap-1 rounded-xl p-3 text-left ring-1 transition ${
                  on ? 'bg-gold-400/10 ring-gold-400/60' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className={`size-4 ${on ? 'text-gold-300' : 'text-white/50'}`} />
                  {s.stage}. {s.title}
                  {s.stage < level && <span className="ml-auto text-xs text-emerald-300">✓</span>}
                </span>
                <span className="text-xs text-white/55">{s.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <button className={tile} onClick={() => onChoose({ mode: 'learnPlay', stage })} autoFocus>
          <Play className="size-8 text-gold-300" />
          <span className="text-xl font-semibold">Lernen & mitspielen</span>
          <span className="text-sm text-white/60">Erst erklären, dann legst du selbst die passende Karte.</span>
        </button>
        <button className={tile} onClick={() => onChoose({ mode: 'learnWatch', stage })}>
          <Eye className="size-8 text-sky-300" />
          <span className="text-xl font-semibold">Lernen & zuschauen</span>
          <span className="text-sm text-white/60">Vier Bots spielen, du siehst alle Karten und bestimmst das Tempo.</span>
        </button>
        <button className={tile} onClick={() => onChoose({ mode: 'free' })}>
          <Shuffle className="size-8 text-white/70" />
          <span className="text-xl font-semibold">Frei spielen</span>
          <span className="text-sm text-white/60">Ein normales Spiel gegen drei Bots – ohne Lektion.</span>
        </button>
      </div>
    </div>
  );
}

/** Oberflächen-Tour: legt einen leuchtenden Rahmen um ein Element der Seite */
export function Spotlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const t = setInterval(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);
  if (!rect) return null;
  return (
    <motion.div
      className="pointer-events-none fixed z-[72] rounded-xl ring-2 ring-gold-300 shadow-[0_0_0_4px_rgba(217,180,90,0.25),0_0_32px_rgba(217,180,90,0.6)]"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
    />
  );
}
