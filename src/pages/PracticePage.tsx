import {
  applyAction,
  createGame,
  DEFAULT_SETTINGS,
  type GameAction,
  type GameState,
  normalizeSettings,
  publicView,
  type RuleSettings,
} from '@engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameView } from '../components/GameView';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/auth';
import { actorOf, BOT_LEVEL_LABELS, type BotLevel, botAction } from '@engine';
import type { GameRow, Member, ResultRow } from '../lib/supabase';
import { useReactions } from '../lib/reactions';
import { useCamera } from '../lib/video';
import { PracticeChooser, type PracticeChoice } from '../components/Tutorial';
import { LessonGame } from './LessonGame';
import { CONCEPTS, type ConceptKey, STAGES } from '../lib/lessons';
import { usePrefs } from '../lib/prefs';

const PLAYERS = ['me', 'bot-1', 'bot-2', 'bot-3'];
/** Zuschauen: Dora übernimmt deinen Platz, du siehst alle Karten */
const WATCH_PLAYERS = ['bot-4', 'bot-1', 'bot-2', 'bot-3'];
const BOT_DISPLAY: Record<string, string> = { 'bot-1': 'Anton', 'bot-2': 'Berta', 'bot-3': 'Carl', 'bot-4': 'Dora' };

function loadRules(): RuleSettings {
  try {
    const raw = localStorage.getItem('doko:lastRules');
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    // ignorieren
  }
  return DEFAULT_SETTINGS;
}

function loadLevel(): BotLevel {
  try {
    const v = localStorage.getItem('doko:botLevel');
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  } catch {
    // ignorieren
  }
  return 'medium';
}

/**
 * Übung offline: Zuerst die Wahl – Lektion mitspielen, Lektion zuschauen oder frei spielen.
 * Alles läuft im Browser, ohne Server.
 */
export function PracticePage() {
  const { profile } = useAuth();
  const camera = useCamera();
  const [prefs] = usePrefs();
  const [choice, setChoice] = useState<PracticeChoice | null>(null);
  const [run, setRun] = useState(0);
  // Merkzettel: alles aus bereits geschafften Stufen ist schon drin
  const [notes, setNotes] = useState<ConceptKey[]>(() =>
    (Object.keys(CONCEPTS) as ConceptKey[]).filter((k) => CONCEPTS[k].stage < Math.min(4, prefs.learnLevel)),
  );
  const addNote = (k: ConceptKey) => setNotes((cur) => (cur.includes(k) ? cur : [...cur, k]));
  const name = profile?.display_name ?? 'Du';

  if (!choice) {
    return (
      <div className="flex h-full flex-col">
        <TopBar>
          <span className="tag hidden truncate text-[11px] text-white/55 md:inline">Übung</span>
        </TopBar>
        <div className="felt relative isolate flex-1 overflow-y-auto">
          <PracticeChooser level={prefs.learnLevel} onChoose={setChoice} />
        </div>
      </div>
    );
  }
  if (choice.mode === 'free') return <FreePractice camera={camera} onExit={() => setChoice(null)} />;
  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="tag hidden truncate text-[11px] text-white/55 md:inline">
          Lektion {choice.stage} · {STAGES[choice.stage - 1].title} · {choice.mode === 'learnWatch' ? 'Zuschauen' : 'Mitspielen'}
        </span>
        <button className="btn-ghost tag px-2 py-1 text-[10px]" onClick={() => setChoice(null)}>
          Zur Auswahl
        </button>
      </TopBar>
      <LessonGame
        key={`${choice.stage}-${choice.mode}-${run}`}
        stage={choice.stage}
        watch={choice.mode === 'learnWatch'}
        name={name}
        camera={camera}
        notes={notes}
        addNote={addNote}
        onExit={() => setChoice(null)}
        onNext={(stage) => setChoice({ mode: choice.mode, stage })}
        onFree={() => {
          setRun((r) => r + 1);
          setChoice({ mode: 'free' });
        }}
      />
    </div>
  );
}

/** Freies Übungsspiel gegen drei Bots */
function FreePractice({ camera, onExit }: { camera: ReturnType<typeof useCamera>; onExit: () => void }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState(loadRules);
  const saveRules = async (s: RuleSettings) => {
    setSettings(s);
    try {
      localStorage.setItem('doko:lastRules', JSON.stringify(s));
    } catch {
      // ignorieren
    }
  };
  const [level, setLevelState] = useState<BotLevel>(loadLevel);
  const setLevel = (l: BotLevel) => {
    setLevelState(l);
    try {
      localStorage.setItem('doko:botLevel', l);
    } catch {
      // ignorieren
    }
  };
  const [number, setNumber] = useState(1);
  // Zuschauen wie online: umschalten jederzeit, gilt ab dem nächsten Spiel
  const [players, setPlayers] = useState(PLAYERS);
  const [watchNext, setWatchNext] = useState(false);
  const watching = players[0] !== 'me';
  const [state, setState] = useState<GameState>(() =>
    createGame({ players: PLAYERS, starter: 0, settings }),
  );
  const [results, setResults] = useState<ResultRow[]>([]);
  const [finished, setFinished] = useState<GameRow[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const watchingRef = useRef(watching);
  watchingRef.current = watching;

  const members: Member[] = useMemo(
    () => [
      { user_id: 'me', seat: watching ? 4 : 0, display_name: profile?.display_name ?? 'Du', spectator: watching },
      ...players.filter((u) => u !== 'me').map((u) => ({ user_id: u, seat: players.indexOf(u), display_name: BOT_DISPLAY[u] })),
    ],
    [profile, players, watching],
  );
  const otherHands = useMemo(
    () => (watching ? Object.fromEntries(players.map((u, i) => [u, state.hands[i]])) : undefined),
    [watching, players, state.hands],
  );

  const gameId = `practice-${number}`;
  const game: GameRow = useMemo(
    () => ({
      id: gameId,
      table_id: 'practice',
      number,
      dealer_seat: (state.starter + 3) % 4,
      seats: [0, 1, 2, 3],
      players,
      state: publicView(state),
      version: state.version,
      status: state.phase === 'finished' ? (state.redeal ? 'redeal' : 'finished') : 'running',
      created_at: '',
      finished_at: null,
    }),
    [state, number, gameId, players],
  );

  // Bots spielen mit kleiner Pause, damit man folgen kann
  useEffect(() => {
    const who = actorOf(state);
    // Den fertigen Stich nimmt immer der Spieler vom Tisch (Klick oder Leertaste)
    if (who === null || (who === 0 && !watching) || state.collectPending) return;
    // Bots lassen den fertigen Stich kurz liegen, bevor sie ihn nehmen
    // "Schwer" rechnet selbst ein paar hundert Millisekunden, deshalb kürzer warten
    const delay = state.phase !== 'playing' ? 600 : state.collectPending ? 2200 : level === 'hard' ? 500 : 750;
    const t = setTimeout(() => {
      const s = stateRef.current;
      const action = botAction(s, who, level);
      if (action) setState(applyAction(s, who, action));
    }, delay);
    return () => clearTimeout(t);
  }, [state, level, watching]);

  // Ergebnis in die Punkteliste übernehmen
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (state.phase !== 'finished' || !state.result || recorded.current.has(gameId)) return;
    recorded.current.add(gameId);
    setFinished((cur) => [game, ...cur]);
    const r = state.result;
    const now = new Date().toISOString();
    setResults((cur) => [
      ...cur,
      ...players.map((uid, p) => {
        const party = r.reTeam.includes(p) ? ('re' as const) : ('kontra' as const);
        return {
          game_id: gameId,
          user_id: uid,
          table_id: 'practice',
          points: r.scores[p],
          party,
          won: r.winner === party,
          kind: state.kind!,
          solo: state.solo,
          is_soloist: r.soloScoring && party === 're',
          created_at: now,
        };
      }),
    ]);
  }, [state, gameId, game, players]);

  const act = useCallback(async (action: GameAction) => {
    const s = stateRef.current;
    // Stich nehmen gilt für den Gewinner, auch wenn es ein Bot ist
    const pos = action.type === 'collect' ? (s.tricks.at(-1)?.winner ?? 0) : 0;
    // Beim Zuschauen nimmst du nur die Stiche vom Tisch
    if (watchingRef.current && action.type !== 'collect') return;
    setState(applyAction(s, pos, action));
  }, []);


  const reactions = useReactions(null, 'me');
  const startGame = useCallback(async () => {
    const s = stateRef.current;
    // Bei Neugeben bleibt der Geber, sonst rückt er weiter
    const starter = s.redeal ? s.starter : (s.starter + 1) % 4;
    setNumber((n) => n + 1);
    const next = watchNext ? WATCH_PLAYERS : PLAYERS;
    setPlayers(next);
    setState(createGame({ players: next, starter, settings }));
  }, [settings, watchNext]);

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="tag hidden truncate text-[11px] text-white/55 md:inline">Übungsspiel gegen Bots</span>
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-black/25 p-0.5" role="radiogroup" aria-label="Stärke der Bots">
          {(Object.keys(BOT_LEVEL_LABELS) as BotLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={`tag rounded-md px-2 py-1 text-[10px] transition-colors ${
                level === l ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {BOT_LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </TopBar>
      <GameView
        game={game}
        hand={watching ? [] : state.hands[0]}
        otherHands={otherHands}
        tutorial={watching}
        spectator={{ on: watchNext, takenBy: null, toggle: setWatchNext }}
        members={members}
        results={results}
        finishedGames={finished}
        me="me"
        camera={camera}
        remotes={{}}
        online={players.filter((u) => u !== 'me')}
        act={act}
        startGame={startGame}
        onLeave={onExit}
        collectAlways
        reactions={reactions}
        rules={{ value: settings, locked: null, onSave: saveRules, bots: false }}
      />
    </div>
  );
}
