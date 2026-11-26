import type { FrameKey } from './cosmetics';
import { createClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Card, GameAction, PublicGameState, RuleSettings, Trick } from '@engine';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  // PKCE: Bestätigungslinks kommen als ?code=… zurück und vertragen sich so mit dem HashRouter
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  // Herzschlag im Web Worker: Hintergrund-Tabs drosseln Timer, sonst fliegt man beim Tab-Wechsel aus dem Kanal
  realtime: { worker: true },
});

export interface Profile {
  id: string;
  display_name: string;
}

export interface TableRow {
  id: string;
  code: string;
  name: string;
  host_id: string;
  settings: RuleSettings;
  status: 'open' | 'closed';
  dealer_seat: number;
  created_at: string;
}

export interface Member {
  user_id: string;
  seat: number;
  display_name: string;
  /** Vitrine: bis zu 3 Erfolge und ein Titel (wenn angezeigt) */
  showcase?: string[];
  title?: string | null;
  frame?: FrameKey | null;
  avatar?: string | null;
  avatar_color?: string | null;
  /** Sitzt auf dem Zuschauerplatz: spielt nicht mit, sieht alle Karten */
  spectator?: boolean;
}

/** Was jemand von seinen Erfolgen zeigt: nur, was er freigegeben hat */
export function displayOf(
  p:
    | {
        showcase?: string[] | null;
        title?: string | null;
        show_badges?: boolean;
        show_title?: boolean;
        frame?: string | null;
        avatar?: string | null;
        avatar_color?: string | null;
      }
    | null
    | undefined,
) {
  return {
    showcase: p && p.show_badges !== false ? (p.showcase ?? []).slice(0, 3) : [],
    title: p && p.show_title !== false ? (p.title ?? null) : null,
    frame: (p?.frame ?? null) as FrameKey | null,
    avatar: p?.avatar ?? null,
    avatar_color: p?.avatar_color ?? null,
  };
}

/** Profilfelder, die fürs Namensschild gebraucht werden */
export const NAMETAG_COLS = 'showcase, title, show_badges, show_title, frame, avatar, avatar_color';

export interface GameRow {
  id: string;
  table_id: string;
  number: number;
  dealer_seat: number;
  seats: number[];
  players: string[];
  state: PublicGameState;
  version: number;
  status: 'running' | 'finished' | 'redeal' | 'aborted';
  created_at: string;
  finished_at: string | null;
}

export interface ResultRow {
  game_id: string;
  user_id: string;
  table_id: string;
  points: number;
  party: 're' | 'kontra';
  won: boolean;
  kind: string;
  solo: string | null;
  is_soloist: boolean;
  created_at: string;
}

/** Fehlermeldung aus Supabase-Fehlern holen (RPC: "message", Edge Function: JSON-Body). */
export async function errorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error as string;
    } catch {
      // ignorieren
    }
  }
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: string }).message);
  return 'Unbekannter Fehler';
}

async function callGame(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('game', { body });
  if (error) throw new Error(await errorMessage(error));
  return data;
}

export const api = {
  startGame: (tableId: string) => callGame({ type: 'start', tableId }),
  act: (gameId: string, action: GameAction) => callGame({ type: 'action', gameId, action }),
  abortGame: (gameId: string) => callGame({ type: 'abort', gameId }),
  botStep: (gameId: string) => callGame({ type: 'botStep', gameId }),
  /** Nur für wer aussetzt: alle bisherigen Stiche */
  spectate: (gameId: string) => callGame({ type: 'spectate', gameId }) as Promise<{ tricks: Trick[]; hands: Card[][] }>,

  async createTable(settings: RuleSettings, name: string): Promise<TableRow> {
    const { data, error } = await supabase.rpc('create_table', { p_settings: settings, p_name: name });
    if (error) throw new Error(await errorMessage(error));
    return data as TableRow;
  },
  async joinTable(code: string): Promise<TableRow> {
    const { data, error } = await supabase.rpc('join_table', { p_code: code });
    if (error) throw new Error(await errorMessage(error));
    return data as TableRow;
  },
  /** Gastgeber: jemanden vom Tisch nehmen */
  async kickPlayer(tableId: string, userId: string) {
    const { error } = await supabase.rpc('kick_player', { p_table: tableId, p_user: userId });
    if (error) throw new Error(await errorMessage(error));
  },
  async leaveTable(tableId: string) {
    const { error } = await supabase.rpc('leave_table', { p_table: tableId });
    if (error) throw new Error(await errorMessage(error));
  },
  /** Zuschauerplatz an/aus – gilt ab dem nächsten Spiel */
  async setSpectator(tableId: string, on: boolean) {
    const { error } = await supabase.rpc('set_spectator', { p_table: tableId, p_on: on });
    if (error) throw new Error(await errorMessage(error));
  },
  async takeSeat(tableId: string, seat: number) {
    const { error } = await supabase.rpc('take_seat', { p_table: tableId, p_seat: seat });
    if (error) throw new Error(await errorMessage(error));
  },
  async updateSettings(tableId: string, settings: RuleSettings, name?: string) {
    const { error } = await supabase.rpc('update_table_settings', {
      p_table: tableId,
      p_settings: settings,
      p_name: name ?? null,
    });
    if (error) throw new Error(await errorMessage(error));
  },
};
