// Edge Function "game": einzige Stelle, die Spielzustände schreibt.
// Aktionen:
//   { type: 'start', tableId }               → neues Spiel austeilen
//   { type: 'action', gameId, action }        → Zug ausführen (Vorbehalt, Karte, Ansage, Armut)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  applyAction,
  createGame,
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
  if (seated.length < 4 || seated.length > 5) throw new GameError('Es werden 4 oder 5 Spieler gebraucht.');

  const occupied = seated.map((p) => p.seat as number);
  const dealer = occupied.includes(table.dealer_seat) ? table.dealer_seat : nextOccupied(occupied, table.dealer_seat);

  // Reihenfolge im Uhrzeigersinn ab links vom Geber. Bei fünf Spielern setzt der Geber aus.
  const order: number[] = [];
  let seat = dealer;
  for (let i = 0; i < occupied.length; i++) {
    seat = nextOccupied(occupied, seat);
    order.push(seat);
  }
  const activeSeats = occupied.length === 5 ? order.slice(0, 4) : order;
  const players = activeSeats.map((s) => seated.find((p) => p.seat === s)!.user_id as string);

  const state = createGame({ players, starter: 0, settings: normalizeSettings(table.settings) });
  const hands = Object.fromEntries(players.map((u, i) => [u, state.hands[i]]));

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

async function act(db: SupabaseClient, userId: string, gameId: string, action: GameAction) {
  const { data: game, error: gErr } = await db
    .from('games')
    .select('id, table_id, status, players, dealer_seat, version')
    .eq('id', gameId)
    .single();
  if (gErr || !game) throw new GameError('Dieses Spiel gibt es nicht.');
  if (game.status !== 'running') throw new GameError('Dieses Spiel ist schon vorbei.');

  const pos = (game.players as string[]).indexOf(userId);
  if (pos < 0) throw new GameError('Du spielst in diesem Spiel nicht mit.');

  const { data: secret, error: sErr } = await db.from('game_secrets').select('state').eq('game_id', gameId).single();
  if (sErr || !secret) throw new Error('Spielstand konnte nicht geladen werden');
  const before = secret.state as GameState;
  if (before.version !== game.version) throw new Error('Spielstand ist inkonsistent');

  const after = applyAction(before, pos, action);

  const changedHands: Record<string, string[]> = {};
  after.hands.forEach((h, p) => {
    if (JSON.stringify(h) !== JSON.stringify(before.hands[p])) changedHands[game.players[p]] = h;
  });

  const status = after.phase === 'finished' ? (after.redeal ? 'redeal' : 'finished') : 'running';

  let results: unknown[] | null = null;
  let nextDealer: number | null = null;
  if (status === 'finished' && after.result) {
    const r = after.result;
    results = after.players.map((uid, p) => {
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
    });
    const { data: seated } = await db.from('table_players').select('seat').eq('table_id', game.table_id);
    const occupied = (seated ?? []).map((s) => s.seat as number);
    nextDealer = occupied.length ? nextOccupied(occupied, game.dealer_seat) : null;
  }

  const { data: saved, error } = await db.rpc('save_game', {
    p_game: gameId,
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
    return json({ error: 'Ungültige Anfrage' }, 400);
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Serverfehler – bitte nochmal versuchen.' }, 500);
  }
});
