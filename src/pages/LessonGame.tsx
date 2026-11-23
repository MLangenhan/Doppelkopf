import {
  actorOf,
  applyAction,
  botAction,
  type Card,
  cardName,
  createGame,
  DEFAULT_SETTINGS,
  effectiveSuit,
  isTrump,
  type GameAction,
  type GameState,
  publicView,
  sumAugen,
} from '@engine';
import { ArrowRight, Check, Hand, Play, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameView, useViewport } from '../components/GameView';
import { BigTitle, ConceptCard, LayoutGroup, NotesRail, useBigTitle } from '../components/Tutorial';
import { CONCEPTS, type ConceptKey, lessonFor, STAGES } from '../lib/lessons';
import { setPref, usePrefs } from '../lib/prefs';
import type { GameRow, Member } from '../lib/supabase';
import type { CameraControls } from '../components/CameraButton';


const BOT_NAMES: Record<string, string> = { 'bot-1': 'Anton', 'bot-2': 'Berta', 'bot-3': 'Carl', 'bot-4': 'Dora' };

/** Vor dem ersten Stich sagen alle „Gesund“ – Vorbehalte kommen erst in Lektion 3 als Erklärung */
function healthyStart(s: GameState): GameState {
  let x = s;
  while (x.phase === 'reservations') {
    const p = actorOf(x)!;
    x = applyAction(x, p, { type: 'declare', declaration: { kind: 'healthy' } });
  }
  return x;
}

export function LessonGame({
  stage,
  watch,
  name: myName,
  camera,
  notes,
  addNote,
  onExit,
  onNext,
  onFree,
}: {
  stage: number;
  /** Zuschauen: vier Bots spielen, du klickst weiter */
  watch: boolean;
  name: string;
  camera: CameraControls;
  notes: ConceptKey[];
  addNote: (k: ConceptKey) => void;
  onExit: () => void;
  onNext: (stage: number) => void;
  onFree: () => void;
}) {
  const lesson = lessonFor(stage);
  const players = useMemo(() => (watch ? ['bot-4', 'bot-1', 'bot-2', 'bot-3'] : ['me', 'bot-1', 'bot-2', 'bot-3']), [watch]);
  const [state, setState] = useState<GameState>(() =>
    healthyStart(createGame({ players, starter: lesson.starter, settings: DEFAULT_SETTINGS, hands: lesson.hands })),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState<ConceptKey | null>(null);
  const [ended, setEnded] = useState(false);
  const [free, setFree] = useState(false);
  const [title, showTitle] = useBigTitle();
  const vp = useViewport();
  const mobile = vp.w < 760 || vp.h < 480;
  const [prefs] = usePrefs();

  const nameOf = (pos: number) => (pos === 0 && !watch ? 'Du' : BOT_NAMES[players[pos]]);
  const beat = !free && !ended ? lesson.beats[idx] : undefined;
  const next = () => setIdx((i) => i + 1);

  // Drehbuch abarbeiten: Lernkarten warten auf „Verstanden“, Bot-Züge kommen mit kleiner Pause, deine Züge warten auf dich
  useEffect(() => {
    if (!beat || open) return;
    const s = state;
    const mine = (pos: number) => pos === 0 && !watch;
    switch (beat.t) {
      case 'card':
        // Erst den großen Titel ausklingen lassen, dann die nächste Lernkarte
        if (title) return;
        setOpen(beat.concept);
        return;
      case 'title': {
        showTitle(beat.text, beat.sub);
        const t = setTimeout(next, 1700);
        return () => clearTimeout(t);
      }
      case 'play': {
        if (mine(beat.pos)) {
          if (!s.hands[0].includes(beat.card)) next();
          return;
        }
        const t = setTimeout(() => {
          setState((cur) => applyAction(cur, beat.pos, { type: 'play', card: beat.card }));
          next();
        }, 900);
        return () => clearTimeout(t);
      }
      case 'announce': {
        const party = beat.pos === 0 ? 're' : 'kontra';
        if (mine(beat.pos)) {
          if (s.announcements[party] !== null) {
            showTitle('Re!', 'Du hast angesagt');
            next();
          }
          return;
        }
        const t = setTimeout(() => {
          setState((cur) => applyAction(cur, beat.pos, { type: 'announce', level: beat.level }));
          showTitle(party === 're' ? 'Re!' : 'Kontra!', `${nameOf(beat.pos)} sagt an`);
          next();
        }, 800);
        return () => clearTimeout(t);
      }
      case 'collect': {
        const last = s.tricks.at(-1);
        const w = last?.winner;
        if (w === null || w === undefined) return;
        const announceWin = () =>
          showTitle(mine(w) ? 'Dein Stich!' : `Stich für ${nameOf(w)}`, stage >= 4 && last ? `${sumAugen(last.cards)} Augen` : undefined);
        if (mine(w)) {
          if (!s.collectPending) {
            announceWin();
            next();
          }
          return;
        }
        if (!s.collectPending) return;
        const t = setTimeout(() => {
          setState((cur) => applyAction(cur, w, { type: 'collect' }));
          announceWin();
          next();
        }, 1500);
        return () => clearTimeout(t);
      }
      case 'end':
        setEnded(true);
        if (prefs.learnLevel <= stage) setPref('learnLevel', Math.min(4, stage + 1));
        showTitle(`Lektion ${stage} geschafft`, STAGES[stage - 1].title);
        return;
    }
  }, [beat, idx, open, state, beat?.t === 'card' ? title : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Weiterspielen nach der Lektion: Bots spielen frei
  useEffect(() => {
    if (!free) return;
    const who = actorOf(state);
    if (who === null || (who === 0 && !watch)) return;
    const t = setTimeout(
      () => {
        const s = stateRef.current;
        const a = botAction(s, who, 'medium');
        if (a) setState(applyAction(s, who, a));
      },
      state.collectPending ? 1800 : 800,
    );
    return () => clearTimeout(t);
  }, [free, state, watch]);

  // Beim Lesen einer Lernkarte die passenden Karten markieren: eigene Hand, beim Zuschauen die des nächsten Spielers
  const focusCards = useMemo(() => {
    const f = open ? CONCEPTS[open].focus : undefined;
    if (!f) return null;
    const ctx = { mode: 'normal' as const, schweinchen: false };
    const who = watch ? (actorOf(state) ?? 0) : 0;
    const hand = state.hands[who];
    if (f === 'trumps') return hand.filter((c) => isTrump(c, ctx));
    const led = state.current?.cards[0];
    if (!led) return null;
    return hand.filter((c) => effectiveSuit(c, ctx) === effectiveSuit(led, ctx));
  }, [open, state, watch]);

  const forcedCard: Card | null = beat?.t === 'play' && beat.pos === 0 && !watch && !open ? beat.card : null;

  const act = useCallback(async (a: GameAction) => {
    if (watch) return;
    setState((cur) => applyAction(cur, 0, a));
  }, [watch]);

  const game: GameRow = useMemo(
    () => ({
      id: `lesson-${stage}-${watch ? 'w' : 'p'}`,
      table_id: 'practice',
      number: stage,
      dealer_seat: (lesson.starter + 3) % 4,
      seats: [0, 1, 2, 3],
      players,
      state: publicView(state),
      version: state.version,
      status: state.phase === 'finished' ? 'finished' : 'running',
      created_at: '',
      finished_at: null,
    }),
    [state, stage, watch, players, lesson.starter],
  );
  const members: Member[] = useMemo(
    () => [
      { user_id: 'me', seat: watch ? 4 : 0, display_name: myName },
      ...players.filter((u) => u !== 'me').map((u) => ({ user_id: u, seat: players.indexOf(u) === -1 ? 4 : players.indexOf(u), display_name: BOT_NAMES[u] })),
    ],
    [players, watch, myName],
  );
  const otherHands = useMemo(
    () => (watch ? Object.fromEntries(players.map((u, i) => [u, state.hands[i]])) : undefined),
    [watch, players, state.hands],
  );

  const dismiss = () => {
    if (!open) return;
    addNote(open);
    setOpen(null);
    next();
  };

  return (
    <LayoutGroup>
      <GameView
        game={game}
        hand={watch ? [] : state.hands[0]}
        otherHands={otherHands}
        members={members}
        results={[]}
        me="me"
        camera={camera}
        remotes={{}}
        online={players}
        act={act}
        startGame={async () => onFree()}
        onLeave={onExit}
        forcedCard={forcedCard}
        focusCards={focusCards}
        playedCards={(state.collectPending ? state.tricks.slice(0, -1) : state.tricks).flatMap((t) => t.cards)}
        allowAnnounce={stage === 3 || free}
        tutorial
      />
      <AnimatePresence>
        {open && <ConceptCard key={open} concept={open} onDone={dismiss} reveal={!!focusCards?.length} />}
      </AnimatePresence>
      <NotesRail
        notes={notes.filter((k) => k !== open)}
        mobile={mobile}
        right={watch ? Math.round(Math.max(180, Math.min(400, vp.w * 0.22, vp.h * 0.36))) + 24 : 8}
      />
      <BigTitle title={title} />
      {/* Was jetzt zu tun ist – deutlich über der Hand */}
      <AnimatePresence>
        {!open && !ended && (forcedCard || (beat?.t === 'announce' && beat.pos === 0 && !watch) || (beat?.t === 'collect' && !watch && state.collectPending && state.tricks.at(-1)?.winner === 0)) && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 bottom-[230px] z-[55] flex justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="flex items-center gap-2 rounded-full bg-gold-400 px-4 py-2 text-base font-semibold text-felt-950 shadow-xl">
              <Hand className="size-5" />
              {forcedCard
                ? `Spiel jetzt: ${cardName(forcedCard)}`
                : beat?.t === 'announce'
                  ? 'Sag jetzt „Re“ an – rechts neben deiner Hand'
                  : 'Dein Stich – tippe auf die Mitte, um ihn zu nehmen'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ended && !free && (
          <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="panel w-full max-w-md p-6 text-center"
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 1.2 }}
            >
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                <Check className="size-8" />
              </span>
              <h2 className="display mt-3 text-4xl">Lektion {stage} geschafft</h2>
              <p className="mt-2 text-white/65">{STAGES[stage - 1].blurb} – sitzt. Alles Gelernte findest du im Merkzettel.</p>
              <div className="mt-6 flex flex-col gap-2">
                {stage < 4 && (
                  <button className="btn-primary justify-center py-3 text-base" onClick={() => onNext(stage + 1)} autoFocus>
                    Weiter mit Lektion {stage + 1}: {STAGES[stage].title} <ArrowRight className="size-4" />
                  </button>
                )}
                <button className="btn-ghost justify-center" onClick={() => setFree(true)}>
                  <Play className="size-4" /> Diese Runde zu Ende spielen
                </button>
                <button className="btn-ghost justify-center" onClick={onExit}>
                  <RotateCcw className="size-4" /> Zur Auswahl
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
