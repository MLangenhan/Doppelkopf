import { augenOf, augenTargets, type Card, isTrump, type Party, type PublicGameState, rankOf, sumAugen } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useFx } from '../lib/prefs';
import { sound } from '../lib/sound';
import { hasSchweinchen, levelLabel, partyLabel, resultKindLabel, SCHMEISSEN_LABEL, trumpMode } from '../lib/gameText';
import { arrangeHand } from '../lib/handSort';
import { PlayingCard } from './PlayingCard';
import { TrickList } from './TrickList';
import type { SchmeissenReason } from '@engine';
import { Medal } from 'lucide-react';
import { BADGES, badgesOfGame } from '../lib/achievements';
import { Confetti } from './Moments';
import { SpaceHint } from './SpaceHint';
import { PartyBadge } from './Seat';

export function ResultDialog({
  view,
  name,
  myPos,
  onNext,
  onClose,
  busy,
  canStart,
  spectator,
}: {
  view: PublicGameState;
  name: (pos: number) => string;
  myPos: number;
  onNext: () => void;
  onClose: () => void;
  busy: boolean;
  canStart: boolean;
  spectator?: { on: boolean; takenBy: string | null; toggle: (on: boolean) => void };
}) {
  const r = view.result;
  // Leertaste: erst die Auswertung überspringen, dann das nächste Spiel geben
  const [skip, setSkip] = useState(false);
  const [revealed, setRevealed] = useState(!!view.redeal);
  const state = useRef({ revealed, busy, canStart, onNext });
  state.current = { revealed, busy, canStart, onNext };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== 'Space' || el?.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const s = state.current;
      if (!s.revealed) setSkip(true);
      else if (!s.busy && s.canStart) s.onNext();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <motion.div
        className="panel max-h-full w-full max-w-lg overflow-y-auto p-5 sm:p-6 lg:max-w-5xl"
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.1 }}
      >
        {view.redeal ? (
          <RedealBody view={view} name={name} myPos={myPos} />
        ) : r ? (
          <ResultBody view={view} name={name} myPos={myPos} skip={skip} onRevealed={() => setRevealed(true)} />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <SpaceHint
            active={!revealed || canStart}
            resetKey={revealed ? 'next' : 'skip'}
            label={revealed ? 'Nächstes Spiel' : 'Überspringen'}
            touchLabel=""
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:flex-nowrap [&>button]:whitespace-nowrap">
            {spectator && (!spectator.takenBy || spectator.on) && (
              <button className="btn-ghost" onClick={() => spectator.toggle(!spectator.on)} disabled={busy}>
                {spectator.on ? 'Wieder mitspielen' : 'Nächstes Spiel zuschauen'}
              </button>
            )}
            <button className="btn-ghost" onClick={onClose}>
              Tisch ansehen
            </button>
            <button className="btn-primary min-w-40" onClick={onNext} disabled={busy || !canStart}>
              {view.redeal ? 'Neu geben' : 'Nächstes Spiel'}
            </button>
          </div>
        </div>
        {!canStart && <p className="mt-2 text-right text-xs text-white/50">Es dürfen höchstens 5 Spieler am Tisch sitzen.</p>}
      </motion.div>
    </motion.div>
  );
}

function ResultBody({
  view,
  name,
  myPos,
  skip,
  onRevealed,
}: {
  view: PublicGameState;
  name: (pos: number) => string;
  myPos: number;
  skip: boolean;
  onRevealed: () => void;
}) {
  const r = view.result!;
  const winner = r.winner;
  const myParty: Party | null = myPos >= 0 ? (r.reTeam.includes(myPos) ? 're' : 'kontra') : null;
  const iWon = myParty !== null && winner === myParty;
  const targets = augenTargets(view.announcements);
  const badges = badgesOfGame(view);
  const { re, kontra, revealed } = useAugenReveal(r.augen, winner, myParty, skip, targets);
  // Siegmarke für Re (bei Schwarz-Ansagen zählen Stiche, dann bleibt die Marke bei 121)
  const mark = targets.re ?? 121;
  const markLabel = mark === 121 ? '121' : `Re braucht ${mark}`;
  const absagen = (['re', 'kontra'] as const)
    .filter((p) => view.announcements[p] !== null && view.announcements[p]! < 120)
    .map((p) => ({ party: p, level: view.announcements[p]!, need: targets[p] }));
  useEffect(() => {
    if (revealed) onRevealed();
  }, [revealed, onRevealed]);
  const kind = view.revealedKind ?? view.kind ?? 'normal';
  const soloist = r.soloScoring ? r.reTeam[0] : null;

  return (
    // Breit: links das Ergebnis, rechts Blätter und Stiche – so passt alles ohne Scrollen
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0">
      <Confetti active={iWon && revealed} />
      <p className="tag text-[11px] text-white/50">
        {resultKindLabel(kind, view.solo)}
        {soloist !== null && ` von ${name(soloist)}`}
        {view.revealedKind === 'silentSolo' && ' – Überraschung!'}
      </p>
      <h2 id="result-title" className="display text-5xl sm:text-6xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={revealed ? 'r' : 'w'}
            className={`inline-block ${revealed ? '' : 'text-white/40'}`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            {!revealed ? 'Auswertung …' : winner ? `${partyLabel(winner)} gewinnt` : 'Kein Gewinner'}
          </motion.span>
        </AnimatePresence>
        {revealed && myParty && winner && (
          <span className={`tag ml-3 align-middle text-xs ${iWon ? 'text-emerald-300' : 'text-red-300'}`}>
            {iWon ? 'Gewonnen' : 'Verloren'}
          </span>
        )}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {(['re', 'kontra'] as const).map((p) => (
          <div
            key={p}
            className={`rounded-xl p-3 transition-colors duration-500 ${revealed && winner === p ? 'bg-white/10 ring-1 ring-gold-400/60' : 'bg-white/5'}`}
          >
            <div className="flex items-center justify-between">
              <PartyBadge party={p} />
              <span className="display text-4xl tabular-nums">{p === 're' ? re : kontra}</span>
            </div>
            <div className="mt-1.5 text-white/75">{(p === 're' ? r.reTeam : r.kontraTeam).map(name).join(' & ')}</div>
            <div className="text-xs text-white/50">
              {r.tricks[p]} {r.tricks[p] === 1 ? 'Stich' : 'Stiche'}
            </div>
          </div>
        ))}
      </div>

      {/* Re wächst von links, Kontra von rechts; die Marke steht dort, wo Re gewinnt (121, mit Absagen mehr oder weniger) */}
      <div className="relative mt-4 h-3 rounded-full bg-white/[0.06]" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-re" style={{ width: `${(re / 240) * 100}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-kontra" style={{ width: `${(kontra / 240) * 100}%` }} />
        <motion.div
          className="absolute -inset-y-1.5 w-0.5 rounded bg-white/70"
          style={{ left: `${(mark / 240) * 100}%` }}
          animate={revealed ? { backgroundColor: '#e8cd85', scaleY: [1, 1.8, 1], boxShadow: '0 0 14px rgba(232,205,133,0.9)' } : {}}
          transition={{ duration: 0.5 }}
        />
        <span className="tag absolute -top-5 -translate-x-1/2 text-[9px] whitespace-nowrap text-white/45" style={{ left: `${(mark / 240) * 100}%` }}>
          {markLabel}
        </span>
      </div>

      {/* Warum: Absagen verschieben die Siegmarke */}
      {revealed && absagen.length > 0 && (
        <p className="mt-4 text-sm text-white/65">
          {absagen.map(({ party, level, need }) => (
            <span key={party} className="block">
              {partyLabel(party)} hat „{levelLabel(level, party)}“ angesagt und brauchte{' '}
              {need === null ? (level === 0 ? 'alle Stiche' : 'einen Stich') : `${need} Augen`}
              {need !== null && ` – geholt: ${r.augen[party]}`}.
            </span>
          ))}
        </p>
      )}

      {revealed && r.lines.length > 0 && (
        <ul className="mt-5 space-y-1 text-sm">
          {r.lines.map((l, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className="flex items-center justify-between rounded-lg px-2 py-1 odd:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <PartyBadge party={l.party} small />
                {l.label}
              </span>
              <span className="tabular-nums font-semibold">+{l.points}</span>
            </motion.li>
          ))}
        </ul>
      )}

      {revealed && badges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 + r.lines.length * 0.06 }}
          className="mt-4 flex flex-wrap gap-1.5"
          aria-label="Abzeichen in diesem Spiel"
        >
          {badges.map(({ pos, key }, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-2.5 py-1 text-xs text-gold-200 ring-1 ring-gold-400/40"
              title={BADGES[key].hint}
            >
              <Medal className="size-3.5" aria-hidden />
              {BADGES[key].label} · {name(pos)}
            </span>
          ))}
        </motion.div>
      )}

      <div className={`mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 ${revealed ? '' : 'invisible'}`}>
        {revealed && r.scores.map((s, p) => {
          // Wer selbst wie viele Augen geholt hat (Summe seiner gewonnenen Stiche)
          const won = (view.tricks ?? []).filter((t) => t.winner === p);
          const augen = won.reduce((sum, t) => sum + sumAugen(t.cards), 0);
          const best = Math.max(...[0, 1, 2, 3].map((q) => (view.tricks ?? []).filter((t) => t.winner === q).reduce((x, t) => x + sumAugen(t.cards), 0)));
          return (
          <motion.div
            key={p}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + r.lines.length * 0.06 + p * 0.07, type: 'spring' }}
            className={`rounded-xl px-3 py-2 text-center ${p === myPos ? 'ring-2 ring-gold-400' : ''} ${
              s > 0 ? 'bg-emerald-500/20' : s < 0 ? 'bg-red-500/20' : 'bg-white/10'
            }`}
          >
            <div className="truncate text-xs text-white/70">{name(p)}</div>
            <div className="tabular-nums text-xl font-bold">{s > 0 ? `+${s}` : s}</div>
            <div className={`mt-0.5 text-[11px] tabular-nums ${augen === best && augen > 0 ? 'text-gold-200' : 'text-white/55'}`}>
              {augen === best && augen > 0 && <span aria-label="Meiste Augen">👑 </span>}
              {augen} Augen · {won.length} {won.length === 1 ? 'Stich' : 'Stiche'}
            </div>
          </motion.div>
          );
        })}
      </div>
      </div>
      <div className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-8">
        {revealed && <AllHands view={view} name={name} myPos={myPos} />}
        {revealed && <AllTricks view={view} name={name} />}
      </div>
    </div>
  );
}

/**
 * Spannende Auswertung: Die Augen zählen hoch, der Gewinner steht erst fest, wenn seine
 * Partei die Siegmarke überschreitet (bzw. am Ende). Ohne Effekte sofort das Ergebnis.
 */
function useAugenReveal(
  augen: Record<Party, number>,
  winner: Party | null,
  myParty: Party | null,
  skip: boolean,
  targets: Record<Party, number | null>,
) {
  const effects = useFx('reveal');
  const [p, setP] = useState(effects ? 0 : 1);
  if (skip && p < 1) setP(1);
  useEffect(() => {
    if (!effects || skip) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - start - 350) / 2600);
      setP(Math.max(0, x));
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [effects, skip]);

  const ease = 1 - Math.pow(1 - p, 3);
  const re = Math.round(augen.re * ease);
  const kontra = Math.round(augen.kontra * ease);
  const needed = winner ? targets[winner] : null;
  const crossed = winner !== null && needed !== null && augen[winner] >= needed && (winner === 're' ? re : kontra) >= needed;
  const revealed = p >= 1 || crossed;

  const fired = useRef(false);
  useEffect(() => {
    if (!revealed || fired.current) return;
    fired.current = true;
    if (myParty && winner) {
      if (winner === myParty) sound.win();
      else sound.lose();
    } else sound.announce();
  }, [revealed, myParty, winner]);

  return { re, kontra, revealed };
}

/** Nach dem Spiel: alle vier Blätter, wie sie ausgeteilt wurden */
function AllHands({
  view,
  name,
  myPos,
  mark,
}: {
  view: PublicGameState;
  name: (pos: number) => string;
  myPos: number;
  /** Neu geben: Karten, die den Grund zeigen (z. B. die fünf Könige), plus kurze Notiz am Namen */
  mark?: { pos: number; cards: Card[]; note: string } | null;
}) {
  const [open, setOpen] = useState(true);
  const hands = view.dealtHands;
  if (!hands) return null;
  const r = view.result;
  const mode = trumpMode(view);
  return (
    <div className="mt-5 lg:mt-0">
      <button className="btn-ghost tag px-2 py-1 text-[10px]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Blätter ausblenden' : 'Alle Blätter ansehen'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-2.5">
              {hands.map((cards, p) => {
                const base = arrangeHand(cards, { mode, schweinchen: hasSchweinchen(view, cards) }, 'trumpFirst', null);
                // Markierte Karten (Grund fürs Neugeben) gesammelt ans Ende, damit nichts verdeckt wird
                const sorted =
                  mark?.pos === p ? [...base.filter((c) => !mark.cards.includes(c)), ...base.filter((c) => mark.cards.includes(c))] : base;
                const party: Party | null = r ? (r.reTeam.includes(p) ? 're' : 'kontra') : null;
                return (
                  <div key={p}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-white/70">
                      <span className={`truncate ${p === myPos ? 'font-semibold text-white' : ''}`}>{name(p)}</span>
                      {party && <PartyBadge party={party} small />}
                      {mark?.pos === p && (
                        <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-semibold text-gold-200 ring-1 ring-gold-400/40">
                          {mark.note}
                        </span>
                      )}
                    </div>
                    <div className="flex">
                      {sorted.map((c, i) => (
                        <PlayingCard
                          key={c}
                          card={c}
                          width={46}
                          style={{ marginLeft: i ? -15 : 0 }}
                          className={
                            mark?.pos === p
                              ? mark.cards.includes(c)
                                ? 'relative z-10 -translate-y-1.5 ring-2 ring-gold-400 shadow-[0_0_12px_rgba(217,180,90,0.6)]'
                                : 'opacity-60'
                              : 'ring-1 ring-black/20'
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Nach dem Spiel: alle Stiche der Reihe nach */
function AllTricks({ view, name }: { view: PublicGameState; name: (pos: number) => string }) {
  const [open, setOpen] = useState(false);
  const tricks = view.tricks;
  if (!tricks?.length) return null;
  return (
    <div className="mt-3">
      <button className="btn-ghost tag px-2 py-1 text-[10px]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Stiche ausblenden' : `Alle Stiche ansehen (${tricks.length})`}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 lg:max-h-[42vh] lg:overflow-y-auto lg:pr-2">
              <TrickList tricks={tricks} name={name} cardW={40} newestFirst={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Neu geben: was passiert ist, wer was gesagt hat – und rechts die Blätter mit dem markierten Grund */
function RedealBody({ view, name, myPos }: { view: PublicGameState; name: (pos: number) => string; myPos: number }) {
  const rd = view.redeal!;
  const hands = view.dealtHands;
  const hand = hands?.[rd.pos] ?? [];
  const ctx = { mode: 'normal' as const, schweinchen: false };
  const reason = rd.reason === 'schmeissen' ? (rd.detail as SchmeissenReason) : null;
  const trumps = hand.filter((c) => isTrump(c, ctx));
  const mark: { pos: number; cards: Card[]; note: string } | null =
    reason === 'over80'
      ? { pos: rd.pos, cards: hand.filter((c) => augenOf(c) >= 10), note: `${sumAugen(hand)} Augen` }
      : reason === 'fiveKings'
        ? { pos: rd.pos, cards: hand.filter((c) => rankOf(c) === 'K'), note: `${hand.filter((c) => rankOf(c) === 'K').length} Könige` }
        : reason === 'fiveNines'
          ? { pos: rd.pos, cards: hand.filter((c) => rankOf(c) === '9'), note: `${hand.filter((c) => rankOf(c) === '9').length} Neunen` }
          : { pos: rd.pos, cards: trumps, note: `${trumps.length} ${trumps.length === 1 ? 'Trumpf' : 'Trümpfe'}` };
  const declined = view.armut?.declined ?? [];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0">
        <p className="tag text-[11px] text-white/50">{rd.reason === 'schmeissen' ? 'Geschmissen' : 'Armut abgelehnt'}</p>
        <h2 id="result-title" className="display text-5xl sm:text-6xl">
          Neu geben
        </h2>
        <p className="mt-3 text-lg text-white/85">
          {rd.reason === 'schmeissen' ? (
            <>
              <span className="font-semibold text-white">{name(rd.pos)}</span> hat geschmissen:{' '}
              <span className="text-gold-200">{reason ? SCHMEISSEN_LABEL[reason] : rd.detail}</span>
            </>
          ) : (
            <>
              Niemand wollte die Armut von <span className="font-semibold text-white">{name(rd.pos)}</span> mitnehmen.
            </>
          )}
        </p>

        {/* Wer hat was gesagt */}
        <ul className="mt-5 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((p) => {
            const isCause = p === rd.pos;
            const said =
              rd.reason === 'armut'
                ? isCause
                  ? 'Armut'
                  : declined.includes(p)
                    ? 'Nein danke'
                    : '–'
                : isCause
                  ? 'Schmeißen'
                  : view.declarations[p] === 'healthy'
                    ? 'Gesund'
                    : view.declarations[p] === 'reserved'
                      ? 'Vorbehalt'
                      : '–';
            return (
              <li
                key={p}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                  isCause ? 'bg-gold-400/15 ring-1 ring-gold-400/50' : 'bg-white/5'
                } ${p === myPos ? 'font-semibold' : ''}`}
              >
                <span className="truncate">{name(p)}</span>
                <span className={isCause ? 'text-gold-200' : said === 'Nein danke' ? 'text-red-300' : 'text-white/60'}>{said}</span>
              </li>
            );
          })}
        </ul>

        <p className="tag mt-5 text-[11px] text-white/55">Gleicher Geber, neue Karten – ohne Punkte.</p>
      </div>
      <div className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-8">{hands && <AllHands view={view} name={name} myPos={myPos} mark={mark} />}</div>
    </div>
  );
}
