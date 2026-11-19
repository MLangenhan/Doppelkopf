// Achievements: Definitionen und Regeln. Vergeben werden sie in der Edge Function am Spielende
// (nur an Tischen ohne Bots); die Übersicht im Browser nutzt dieselben Definitionen.

import { faceOf, sumAugen } from './cards.ts';
import type { GameState, Party } from './game.ts';
import { SOLO_TYPES } from './settings.ts';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITIES: Record<Rarity, { label: string; points: number }> = {
  common: { label: 'Gewöhnlich', points: 10 },
  rare: { label: 'Selten', points: 25 },
  epic: { label: 'Episch', points: 50 },
  legendary: { label: 'Legendär', points: 100 },
  mythic: { label: 'Mythisch', points: 250 },
};

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Geheim: Beschreibung erst sichtbar, wenn es jemand geschafft hat */
  secret?: boolean;
  /** Zielwert für die Fortschrittsanzeige (z. B. 10 Füchse) */
  target?: number;
}

const def = (key: string, rarity: Rarity, name: string, description: string, extra: Partial<AchievementDef> = {}): AchievementDef => ({
  key,
  rarity,
  name,
  description,
  ...extra,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  // Gewöhnlich
  def('ersterStich', 'common', 'Erster Stich', 'Den ersten Stich gewonnen'),
  def('erstesSpiel', 'common', 'Erstes Spiel', 'Ein Spiel zu Ende gespielt'),
  def('ersterSieg', 'common', 'Erster Sieg', 'Ein Spiel gewonnen'),
  def('fuchsjaeger', 'common', 'Fuchsjäger', 'Einen Fuchs des Gegners gefangen'),
  def('ansager', 'common', 'Ansager', 'Zum ersten Mal Re oder Kontra angesagt'),
  def('doppelkopf', 'common', 'Doppelkopf', 'Einen Stich mit 40 oder mehr Augen gemacht'),
  def('gegenDieAlten', 'common', 'Gegen die Alten', 'Als Kontra gewonnen'),
  def('hochzeit', 'common', 'Hochzeitsglocken', 'Eine Hochzeit gespielt'),
  def('armutszeugnis', 'common', 'Armutszeugnis', 'Eine Armut angesagt und gespielt'),
  def('goenner', 'common', 'Gönner', 'Eine Armut mitgenommen und gewonnen'),
  def('gastgeber', 'common', 'Gastgeber', 'Einen Tisch eröffnet, an dem gespielt wurde'),
  def('stammgast', 'common', 'Stammgast', 'An 3 Abenden mitgespielt', { target: 3 }),
  // Selten
  def('karlchen', 'rare', 'Karlchen', 'Den letzten Stich mit dem Kreuz-Buben gewonnen'),
  def('fuchsbau', 'rare', 'Fuchsbau', 'Insgesamt 10 Füchse gefangen', { target: 10 }),
  def('solist', 'rare', 'Solist', 'Ein Solo gewonnen'),
  def('keine90', 'rare', 'Keine 90', 'Gewonnen, während der Gegner unter 90 Augen blieb'),
  def('siegesserie', 'rare', 'Siegesserie', '5 Spiele in Folge gewonnen', { target: 5 }),
  def('comeback', 'rare', 'Comeback', 'Einen Abend nach 10 Punkten Rückstand noch angeführt'),
  def('marathon', 'rare', 'Marathon', '20 Spiele an einem Abend', { target: 20 }),
  def('nachteule', 'rare', 'Nachteule', 'Ein Spiel nach 2 Uhr nachts beendet', { secret: true }),
  def('schweinchen', 'rare', 'Schweinchen', 'Beide Karo-Asse auf der Hand gehabt (Schweinchen)'),
  def('fuchsVerteidigt', 'rare', 'Fuchs verteidigt', 'Den eigenen Fuchs sicher heimgebracht'),
  def('dulleSticht', 'rare', 'Dulle sticht Dulle', 'Mit der zweiten Dulle die erste überstochen'),
  def('dreifachKoenig', 'rare', 'Dreifach-König', 'An 3 Abenden die meisten Punkte gehabt', { target: 3 }),
  // Episch
  def('fleischlos', 'epic', 'Fleischlos glücklich', 'Einen Fleischlosen gewonnen'),
  def('keine60', 'epic', 'Keine 60', 'Gewonnen, während der Gegner unter 60 Augen blieb'),
  def('doppelterDoko', 'epic', 'Doppelter Doppelkopf', 'Zwei Doppelköpfe in einem Spiel gemacht'),
  def('fuchsjagd', 'epic', 'Fuchsjagd komplett', 'Beide Füchse in einem Spiel gefangen'),
  def('stillesSolo', 'epic', 'Stilles Solo', 'Ein stilles Solo gewonnen'),
  def('alleinVorDemAltar', 'epic', 'Allein vor dem Altar', 'Eine Hochzeit ohne Partner gewonnen'),
  def('absageMeister', 'epic', 'Absage-Meister', '„Keine 30“ oder mehr angesagt und gewonnen'),
  def('unaufhaltsam', 'epic', 'Unaufhaltsam', '10 Spiele in Folge gewonnen', { target: 10 }),
  def('veteran', 'epic', 'Veteran', '100 Spiele gespielt', { target: 100 }),
  // Legendär
  def('schwarz', 'legendary', 'Schwarz gespielt', 'Der Gegner hat keinen einzigen Stich bekommen'),
  def('soloSammler', 'legendary', 'Solo-Sammler', 'Jede Solo-Art einmal gewonnen', { target: SOLO_TYPES.length }),
  def('karlchenFuchs', 'legendary', 'Karlchen fängt den Fuchs', 'Im letzten Stich mit dem Kreuz-Buben den Fuchs gefangen', { secret: true }),
  def('gegenDenStrom', 'legendary', 'Gegen den Strom', 'Als Kontra gegen eine Re-Absage gewonnen'),
  def('makellos', 'legendary', 'Makelloser Abend', 'Mindestens 8 Spiele an einem Abend, keins verloren'),
  // Mythisch
  def('schwarzMitAnsage', 'mythic', 'Schwarz mit Ansage', '„Schwarz“ angesagt und tatsächlich alle Stiche gemacht'),
  def('soloSchwarz', 'mythic', 'Solo schwarz', 'Ein Solo gespielt, ohne einen Stich abzugeben', { secret: true }),
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** Punkte aller freigeschalteten Erfolge */
export function achievementPoints(keys: Iterable<string>): number {
  let sum = 0;
  for (const k of keys) {
    const a = ACHIEVEMENT_BY_KEY.get(k);
    if (a) sum += RARITIES[a.rarity].points;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Regeln für ein einzelnes, fertiges Spiel
// ---------------------------------------------------------------------------

const other = (p: Party): Party => (p === 're' ? 'kontra' : 're');

/** Wie viele Füchse hat pos in diesem Spiel gefangen? */
export function foxesCaught(s: GameState, pos: number): number {
  if (!s.result || s.result.soloScoring || !s.settings.fuchs || s.schweinchen !== null) return 0;
  const party = (p: number): Party => (s.result!.reTeam.includes(p) ? 're' : 'kontra');
  let n = 0;
  for (const t of s.tricks) {
    if (t.winner !== pos) continue;
    t.cards.forEach((c, j) => {
      const by = (t.leader + j) % 4;
      if (faceOf(c) === 'D-A' && party(by) !== party(pos)) n++;
    });
  }
  return n;
}

/** Erfolge, die pos in diesem (fertigen) Spiel erreicht hat */
export function gameAchievements(s: GameState, pos: number): string[] {
  const r = s.result;
  if (!r) return [];
  const out = new Set<string>();
  const party = (p: number): Party => (r.reTeam.includes(p) ? 're' : 'kontra');
  const mine = party(pos);
  const won = r.winner === mine;
  const loser = other(mine);
  const solo = r.soloScoring;
  const tricks = s.tricks;
  const last = tricks[tricks.length - 1];

  if (tricks.some((t) => t.winner === pos)) out.add('ersterStich');
  if (s.announcementLog.some((a) => a.pos === pos)) out.add('ansager');
  if (won && !solo && mine === 'kontra') out.add('gegenDieAlten');
  if (s.kind === 'hochzeit' && s.hochzeit?.bride === pos) out.add('hochzeit');
  if (s.kind === 'armut' && s.armut?.poor === pos) out.add('armutszeugnis');
  if (s.kind === 'armut' && s.armut?.rich === pos && won) out.add('goenner');
  if (s.schweinchen === pos) out.add('schweinchen');
  if (won && r.augen[loser] < 90) out.add('keine90');
  if (won && r.augen[loser] < 60) out.add('keine60');

  const foxes = foxesCaught(s, pos);
  if (foxes >= 1) out.add('fuchsjaeger');
  if (foxes >= 2) out.add('fuchsjagd');

  if (!solo) {
    const dokos = tricks.filter((t) => t.winner === pos && sumAugen(t.cards) >= 40).length;
    if (s.settings.doppelkopf && dokos >= 1) out.add('doppelkopf');
    if (s.settings.doppelkopf && dokos >= 2) out.add('doppelterDoko');

    if (last && last.winner === pos && s.settings.karlchen) {
      const winning = last.cards[(pos - last.leader + 4) % 4];
      if (faceOf(winning) === 'C-J') {
        out.add('karlchen');
        const foxInLast = last.cards.some((c, j) => faceOf(c) === 'D-A' && party((last.leader + j) % 4) !== mine);
        if (foxInLast && s.settings.fuchs && s.schweinchen === null) out.add('karlchenFuchs');
      }
    }
    // Eigener Fuchs, der bei der eigenen Partei landet
    if (s.settings.fuchs && s.schweinchen === null) {
      for (const t of tricks) {
        const j = t.cards.findIndex((c, i) => faceOf(c) === 'D-A' && (t.leader + i) % 4 === pos);
        if (j >= 0 && t.winner !== null && party(t.winner) === mine) out.add('fuchsVerteidigt');
      }
    }
  }

  // Zweite Dulle sticht die erste (nur mit passender Regel möglich)
  for (const t of tricks) {
    const dullen = t.cards.map((c, i) => (faceOf(c) === 'H-10' ? (t.leader + i) % 4 : -1)).filter((p) => p >= 0);
    if (dullen.length === 2 && dullen[1] === pos && t.winner === pos) out.add('dulleSticht');
  }

  const soloist = s.kind === 'solo' || s.kind === 'silentSolo' ? s.soloist : null;
  if (s.kind === 'solo' && soloist === pos && won) {
    out.add('solist');
    if (s.solo === 'fleischlos') out.add('fleischlos');
  }
  if (s.kind === 'silentSolo' && soloist === pos && won) out.add('stillesSolo');
  if (s.kind === 'hochzeit' && s.hochzeit?.alone && s.hochzeit.bride === pos && won) out.add('alleinVorDemAltar');

  const ownAbsage = s.announcements[mine];
  if (won && ownAbsage !== null && ownAbsage <= 30) out.add('absageMeister');
  const reAbsage = s.announcements.re;
  if (won && mine === 'kontra' && reAbsage !== null && reAbsage < 120) out.add('gegenDenStrom');

  const allTricks = r.tricks[loser] === 0 && won;
  if (allTricks) {
    out.add('schwarz');
    if (ownAbsage === 0) out.add('schwarzMitAnsage');
    if (s.kind === 'solo' && soloist === pos) out.add('soloSchwarz');
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Regeln über mehrere Spiele und Abende
// ---------------------------------------------------------------------------

export interface ResultLite {
  user_id: string;
  game_id: string;
  table_id: string;
  points: number;
  won: boolean;
  kind: string;
  solo: string | null;
  is_soloist: boolean;
  created_at: string;
}

export interface AchievementHistory {
  /** Alle Ergebnisse dieses Spielers, älteste zuerst (inklusive des gerade beendeten Spiels) */
  mine: ResultLite[];
  /** Alle Ergebnisse an den Tischen, an denen er gespielt hat (für König des Abends und Comeback) */
  tables: ResultLite[];
  /** Tisch des gerade beendeten Spiels */
  tableId: string;
  /** Ist er Gastgeber dieses Tisches? */
  isHost: boolean;
  /** Gefangene Füchse insgesamt (nach diesem Spiel) */
  foxes: number;
  /** Wann das Spiel endete */
  finishedAt: Date;
}

/** Fortschritt der zählbaren Erfolge (für Übersicht und Vergabe) */
export function achievementProgress(userId: string, h: Omit<AchievementHistory, 'tableId' | 'isHost' | 'finishedAt'>) {
  const mine = h.mine;
  let streak = 0;
  for (let i = mine.length - 1; i >= 0 && mine[i].won; i--) streak++;
  const tablesPlayed = new Set(mine.map((r) => r.table_id));
  const soloTypes = new Set(mine.filter((r) => r.kind === 'solo' && r.is_soloist && r.won && r.solo).map((r) => r.solo));
  let kingNights = 0;
  for (const t of tablesPlayed) {
    const totals = new Map<string, number>();
    for (const r of h.tables) if (r.table_id === t) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points);
    const me = totals.get(userId) ?? 0;
    if (me > 0 && [...totals].every(([u, v]) => u === userId || v < me)) kingNights++;
  }
  return {
    stammgast: tablesPlayed.size,
    fuchsbau: h.foxes,
    siegesserie: streak,
    unaufhaltsam: streak,
    veteran: mine.length,
    soloSammler: SOLO_TYPES.filter((t) => soloTypes.has(t)).length,
    dreifachKoenig: kingNights,
  } as Record<string, number>;
}

export function historyAchievements(userId: string, h: AchievementHistory): string[] {
  const out = new Set<string>();
  const progress = achievementProgress(userId, h);
  for (const a of ACHIEVEMENTS) if (a.target && (progress[a.key] ?? 0) >= a.target) out.add(a.key);

  if (h.mine.length >= 1) out.add('erstesSpiel');
  if (h.mine.some((r) => r.won)) out.add('ersterSieg');
  if (h.isHost) out.add('gastgeber');

  const here = h.mine.filter((r) => r.table_id === h.tableId);
  if (here.length >= 20) out.add('marathon');
  if (here.length >= 8 && here.every((r) => r.won)) out.add('makellos');

  // Comeback: an diesem Abend einmal mindestens 10 hinter dem Führenden, jetzt allein vorne
  const games = [...new Set(h.tables.filter((r) => r.table_id === h.tableId).map((r) => r.game_id))];
  const totals = new Map<string, number>();
  let wasBehind = false;
  for (const g of games) {
    for (const r of h.tables) if (r.game_id === g) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points);
    const me = totals.get(userId) ?? 0;
    const best = Math.max(...[...totals].filter(([u]) => u !== userId).map(([, v]) => v), -Infinity);
    if (best - me >= 10) wasBehind = true;
  }
  const me = totals.get(userId) ?? 0;
  if (wasBehind && [...totals].every(([u, v]) => u === userId || v < me)) out.add('comeback');

  // Nachteule: Spielende zwischen 2 und 5 Uhr (deutsche Zeit)
  const hour = Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(h.finishedAt));
  if (hour >= 2 && hour < 5) out.add('nachteule');

  return [...out];
}

// ---------------------------------------------------------------------------
// Titel: mit Erfolgspunkten kaufbar. Wer alle Erfolge hat, kann sich alle Titel leisten.
// Die Preise stehen auch in der Datenbank-Funktion title_cost (Migration) – beide gleich halten.
// ---------------------------------------------------------------------------

export interface TitleDef {
  key: string;
  name: string;
  cost: number;
  /** Sehr selten: babyblaues Leuchten */
  rare?: boolean;
}

export const TITLES: TitleDef[] = [
  { key: 'pechvogel', name: 'Pechvogel vom Dienst', cost: 20 },
  { key: 'kartenschubser', name: 'Kartenschubser', cost: 30 },
  { key: 'stichsammler', name: 'Stichsammler', cost: 40 },
  { key: 'fuchsfluesterer', name: 'Fuchsflüsterer', cost: 50 },
  { key: 'karokoenig', name: 'Karo-König', cost: 60 },
  { key: 'dullenschwinger', name: 'Dullenschwinger', cost: 70 },
  { key: 'ansagenass', name: 'Ansagen-Ass', cost: 80 },
  { key: 'schweinchenzuechter', name: 'Schweinchenzüchter', cost: 90 },
  { key: 'hochzeitsplaner', name: 'Hochzeitsplaner', cost: 100 },
  { key: 'kontrarebell', name: 'Kontra-Rebell', cost: 110 },
  { key: 'solokuenstler', name: 'Solo-Künstler', cost: 120 },
  { key: 'unbestechlich', name: 'Der Unbestechliche', cost: 130 },
  { key: 'schwarzmaler', name: 'Der Schwarzmaler', cost: 250, rare: true },
  { key: 'grossmeister', name: 'Großmeister des Doppelkopfs', cost: 300, rare: true },
  { key: 'legende', name: 'Legende der Tafelrunde', cost: 400, rare: true },
];

export const TITLE_BY_KEY = new Map(TITLES.map((t) => [t.key, t]));

export function achievementPointsOf(key: string): number {
  const a = ACHIEVEMENT_BY_KEY.get(key);
  return a ? RARITIES[a.rarity].points : 0;
}
