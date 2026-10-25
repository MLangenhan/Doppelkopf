import { useNavigate } from 'react-router-dom';
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
import { botAction } from '../lib/bots';
import type { GameRow, Member, ResultRow } from '../lib/supabase';
import { useCamera } from '../lib/video';

const PLAYERS = ['me', 'bot-1', 'bot-2', 'bot-3'];

function loadRules(): RuleSettings {
  try {
    const raw = localStorage.getItem('doko:lastRules');
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    // ignorieren
  }
  return DEFAULT_SETTINGS;
}

/** Wer muss gerade handeln? */
function actor(s: GameState): number | null {
  switch (s.phase) {
    case 'reservations':
      return s.declTurn;
    case 'armutOffer':
      return s.armut?.offerTurn ?? null;
    case 'armutReturn':
      return s.armut?.rich ?? null;
    case 'playing':
      return s.turn;
    default:
      return null;
  }
}

/** Übungsspiel gegen drei Bots – läuft komplett im Browser, ohne Server. */
export function PracticePage() {
  const { profile } = useAuth();
  const camera = useCamera();
  const [settings] = useState(loadRules);
  const [number, setNumber] = useState(1);
  const [state, setState] = useState<GameState>(() =>
    createGame({ players: PLAYERS, starter: 0, settings }),
  );
  const [results, setResults] = useState<ResultRow[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const members: Member[] = useMemo(
    () => [
      { user_id: 'me', seat: 0, display_name: profile?.display_name ?? 'Du' },
      { user_id: 'bot-1', seat: 1, display_name: 'Anton' },
      { user_id: 'bot-2', seat: 2, display_name: 'Berta' },
      { user_id: 'bot-3', seat: 3, display_name: 'Carl' },
    ],
    [profile],
  );

  const gameId = `practice-${number}`;
  const game: GameRow = useMemo(
    () => ({
      id: gameId,
      table_id: 'practice',
      number,
      dealer_seat: (state.starter + 3) % 4,
      seats: [0, 1, 2, 3],
      players: PLAYERS,
      state: publicView(state),
      version: state.version,
      status: state.phase === 'finished' ? (state.redeal ? 'redeal' : 'finished') : 'running',
      created_at: '',
      finished_at: null,
    }),
    [state, number, gameId],
  );

  // Bots spielen mit kleiner Pause, damit man folgen kann
  useEffect(() => {
    const who = actor(state);
    if (who === null || who === 0) return;
    // Bots lassen den fertigen Stich kurz liegen, bevor sie ihn nehmen
    const delay = state.phase !== 'playing' ? 600 : state.collectPending ? 2200 : 750;
    const t = setTimeout(() => {
      const s = stateRef.current;
      const action = botAction(s, who);
      if (action) setState(applyAction(s, who, action));
    }, delay);
    return () => clearTimeout(t);
  }, [state]);

  // Ergebnis in die Punkteliste übernehmen
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (state.phase !== 'finished' || !state.result || recorded.current.has(gameId)) return;
    recorded.current.add(gameId);
    const r = state.result;
    const now = new Date().toISOString();
    setResults((cur) => [
      ...cur,
      ...PLAYERS.map((uid, p) => {
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
  }, [state, gameId]);

  const act = useCallback(async (action: GameAction) => {
    setState(applyAction(stateRef.current, 0, action));
  }, []);

  const navigate = useNavigate();
  const startGame = useCallback(async () => {
    const s = stateRef.current;
    // Bei Neugeben bleibt der Geber, sonst rückt er weiter
    const starter = s.redeal ? s.starter : (s.starter + 1) % 4;
    setNumber((n) => n + 1);
    setState(createGame({ players: PLAYERS, starter, settings }));
  }, [settings]);

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="tag truncate text-[11px] text-white/55">Übungsspiel gegen Bots</span>
      </TopBar>
      <GameView
        game={game}
        hand={state.hands[0]}
        members={members}
        results={results}
        me="me"
        camera={camera}
        remotes={{}}
        online={['bot-1', 'bot-2', 'bot-3']}
        act={act}
        startGame={startGame}
        onLeave={() => navigate('/')}
      />
    </div>
  );
}
