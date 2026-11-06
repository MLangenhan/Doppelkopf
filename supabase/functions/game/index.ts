// Edge Function "game": einzige Stelle, die Spielzustände schreibt.
// Aktionen:
//   { type: 'start', tableId }               → neues Spiel austeilen
//   { type: 'action', gameId, action }        → Zug ausführen (Vorbehalt, Karte, Ansage, Armut)
//   { type: 'abort', gameId }                 → laufendes Spiel abbrechen (zählt nicht, gleicher Geber gibt neu)
//   { type: 'botStep', gameId }               → ein Bot macht seinen nächsten Zug (Clients rufen das mit Pause auf)
//
// Sitzen weniger als vier Menschen am Tisch, füllen Bots die freien Plätze auf.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  actorOf,
  applyAction,
  BOT_IDS,
  botAction,
  createGame,
  isBot,
  GameError,
  type GameAction,
  type GameState,
  normalizeSettings,
  publicView,
} from '../_shared/engine/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function serviceKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (key) return key;
    } catch {
      // auf Legacy-Key zurückfallen
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new Error('Kein Service-Key in der Edge Function verfügbar');
  return legacy;
}

/** Nächster besetzter Platz im Uhrzeigersinn nach `seat` (ohne `seat` selbst, außer er ist der einzige). */
function nextOccupied(occupied: number[], seat: number): number {
  const sorted = [...occupied].sort((a, b) => a - b);
  return sorted.find((s) => s > seat) ?? sorted[0];
}

/** Menschen am Tisch plus Bots auf freien Plätzen, bis vier zusammen sind. Sortiert nach Platz. */
function withBots(seated: { user_id: string; seat: number }[]): { user_id: string; seat: number }[] {
  const all = seated.map((p) => ({ user_id: p.user_id, seat: p.seat }));
  const free = [0, 1, 2, 3, 4].filter((seat) => !all.some((p) => p.seat === seat));
  for (let i = 0; all.length < 4; i++) all.push({ user_id: BOT_IDS[i], seat: free[i] });
  return all.sort((a, b) => a.seat - b.seat);
}

/** So lange liegt ein fertiger Stich, bevor ein Bot ihn nimmt */
const BOT_COLLECT_MS = 1800;

async function startGame(db: SupabaseClient, userId: string, tableId: string) {
  const { data: table, error: tErr } = await db
    .from('tables')
    .select('id, settings, dealer_seat, status')
    .eq('id', tableId)
    .single();
  if (tErr || !table) throw new GameError('Diesen Tisch gibt es nicht.');
  if (table.status !== 'open') throw new GameError('Dieser Tisch ist geschlossen.');

  const { data: seated, error: pErr } = await db
    .from('table_players')
    .select('user_id, seat')
    .eq('table_id', tableId)
    .order('seat');
  if (pErr || !seated) throw new Error(pErr?.message ?? 'Spieler konnten nicht geladen werden');
  if (!seated.some((p) => p.user_id === userId)) throw new GameError('Du sitzt nicht an diesem Tisch.');
  if (seated.length > 5) throw new GameError('Höchstens 5 Spieler pro Tisch.');
  const everyone = withBots(seated as { user_id: string; seat: number }[]);

  const occupied = everyone.map((p) => p.seat);
  const dealer = occupied.includes(table.dealer_seat) ? table.dealer_seat : nextOccupied(occupied, table.dealer_seat);

  // Reihenfolge im Uhrzeigersinn ab links vom Geber. Bei fünf Spielern setzt der Geber aus.
  const order: number[] = [];
  let seat = dealer;
  for (let i = 0; i < occupied.length; i++) {
    seat = nextOccupied(occupied, seat);
    order.push(seat);
  }
  const activeSeats = occupied.length === 5 ? order.slice(0, 4) : order;
  const players = activeSeats.map((s) => everyone.find((p) => p.seat === s)!.user_id);

  const state = createGame({ players, starter: 0, settings: normalizeSettings(table.settings) });
  // Bots haben keine eigene Hand-Zeile: ihre Karten kennt nur der geheime Spielstand
  const hands = Object.fromEntries(players.map((u, i) => [u, state.hands[i]]).filter(([u]) => !isBot(u as string)));

  const { data: gameId, error } = await db.rpc('create_game', {
    p_table: tableId,
    p_dealer_seat: dealer,
    p_seats: activeSeats,
    p_players: players,
    p_public: publicView(state),
    p_secret: state,
    p_hands: hands,
  });
  if (error) {
    if (error.message.includes('läuft bereits')) throw new GameError('Es läuft bereits ein Spiel.');
    throw new Error(error.message);
  }
  return { gameId };
}

async function loadGame(db: SupabaseClient, gameId: string) {
  const { data: game, error: gErr } = await db
    .from('games')
    .select('id, table_id, status, players, dealer_seat, version')
    .eq('id', gameId)
    .single();
  if (gErr || !game) throw new GameError('Dieses Spiel gibt es nicht.');
  if (game.status !== 'running') throw new GameError('Dieses Spiel ist schon vorbei.');
  const { data: secret, error: sErr } = await db.from('game_secrets').select('state').eq('game_id', gameId).single();
  if (sErr || !secret) throw new Error('Spielstand konnte nicht geladen werden');
  const state = secret.state as GameState;
  if (state.version !== game.version) throw new Error('Spielstand ist inkonsistent');
  return { game, state };
}

type LoadedGame = Awaited<ReturnType<typeof loadGame>>['game'];

/** Speichert den neuen Stand (inkl. Ergebnissen am Spielende). Bots bekommen keine Ergebnis-Zeilen. */
async function persist(db: SupabaseClient, game: LoadedGame, before: GameState, after: GameState) {
  const changedHands: Record<string, string[]> = {};
  after.hands.forEach((h, p) => {
    const uid = game.players[p] as string;
    if (!isBot(uid) && JSON.stringify(h) !== JSON.stringify(before.hands[p])) changedHands[uid] = h;
  });

  const status = after.phase === 'finished' ? (after.redeal ? 'redeal' : 'finished') : 'running';

  let results: unknown[] | null = null;
  let nextDealer: number | null = null;
  if (status !== 'running') {
    if (status === 'finished' && after.result) {
      const r = after.result;
      results = after.players
        .map((uid, p) => {
          const party = r.reTeam.includes(p) ? 're' : 'kontra';
          return {
            user_id: uid,
            points: r.scores[p],
            party,
            won: r.winner === party,
            kind: after.kind,
            solo: after.solo,
            is_soloist: r.soloScoring && party === 're',
          };
        })
        .filter((row) => !isBot(row.user_id));
    }
    if (status === 'finished') {
      const { data: seated } = await db.from('table_players').select('user_id, seat').eq('table_id', game.table_id);
      const occupied = withBots((seated ?? []) as { user_id: string; seat: number }[]).map((p) => p.seat);
      nextDealer = occupied.length ? nextOccupied(occupied, game.dealer_seat) : null;
    }
  }

  const { data: saved, error } = await db.rpc('save_game', {
    p_game: game.id,
    p_expected_version: before.version,
    p_public: publicView(after),
    p_secret: after,
    p_hands: changedHands,
    p_status: status,
    p_results: results,
    p_next_dealer: nextDealer,
  });
  if (error) throw new Error(error.message);
  if (!saved) throw new GameError('Jemand war schneller – bitte nochmal versuchen.');
  return { version: after.version };
}

async function act(db: SupabaseClient, userId: string, gameId: string, action: GameAction) {
  const { game, state: before } = await loadGame(db, gameId);
  const pos = (game.players as string[]).indexOf(userId);
  if (pos < 0) throw new GameError('Du spielst in diesem Spiel nicht mit.');
  return persist(db, game, before, applyAction(before, pos, action));
}

/** Ein Bot macht seinen Zug. Darf jeder anstoßen, der am Tisch sitzt. */
async function botStep(db: SupabaseClient, userId: string, gameId: string) {
  const { game, state: before } = await loadGame(db, gameId);
  const { data: member } = await db
    .from('table_players')
    .select('user_id')
    .eq('table_id', game.table_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) throw new GameError('Du sitzt nicht an diesem Tisch.');

  const pos = actorOf(before);
  if (pos === null || !isBot(game.players[pos] as string)) throw new GameError('Gerade ist kein Bot am Zug.');
  if (before.collectPending) {
    const last = before.tricks[before.tricks.length - 1];
    if (Date.now() - (last.completedAt ?? 0) < BOT_COLLECT_MS) throw new GameError('Der Bot schaut sich den Stich noch an.');
  }
  const action = botAction(before, pos, before.settings.botLevel ?? 'medium', { budgetMs: 150 });
  if (!action) throw new GameError('Der Bot weiß gerade nichts zu tun.');
  return persist(db, game, before, applyAction(before, pos, action));
}

async function abort(db: SupabaseClient, userId: string, gameId: string) {
  const { data: game, error: gErr } = await db.from('games').select('id, status, players').eq('id', gameId).single();
  if (gErr || !game) throw new GameError('Dieses Spiel gibt es nicht.');
  if (!(game.players as string[]).includes(userId)) throw new GameError('Du spielst in diesem Spiel nicht mit.');
  if (game.status !== 'running') throw new GameError('Dieses Spiel ist schon vorbei.');
  const { error } = await db
    .from('games')
    .update({ status: 'aborted', finished_at: new Date().toISOString() })
    .eq('id', gameId)
    .eq('status', 'running');
  if (error) throw new Error(error.message);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Nicht angemeldet' }, 401);
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth.user) return json({ error: 'Nicht angemeldet' }, 401);

    const body = await req.json();
    if (body?.type === 'start' && typeof body.tableId === 'string') {
      return json(await startGame(db, auth.user.id, body.tableId));
    }
    if (body?.type === 'action' && typeof body.gameId === 'string' && body.action) {
      return json(await act(db, auth.user.id, body.gameId, body.action as GameAction));
    }
    if (body?.type === 'botStep' && typeof body.gameId === 'string') {
      return json(await botStep(db, auth.user.id, body.gameId));
    }
    if (body?.type === 'abort' && typeof body.gameId === 'string') {
      return json(await abort(db, auth.user.id, body.gameId));
    }
    return json({ error: 'Ungültige Anfrage' }, 400);
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Serverfehler – bitte nochmal versuchen.' }, 500);
  }
});
