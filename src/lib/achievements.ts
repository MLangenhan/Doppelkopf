import { faceOf, type PublicGameState, sumAugen } from '@engine';
import type { GameRow, ResultRow } from './supabase';

// Abzeichen für besondere Spielzüge und Titel des Abends – alles aus den fertigen Spielständen berechnet.

export type BadgeKey = 'fuchs' | 'karlchen' | 'doppelkopf' | 'schwarz' | 'gegenDieAlten' | 'solo';

export const BADGES: Record<BadgeKey, { label: string; hint: string }> = {
  fuchs: { label: 'Fuchsjäger', hint: 'Fuchs (Karo-As) des Gegners gefangen' },
  karlchen: { label: 'Karlchen-Held', hint: 'Letzten Stich mit dem Kreuz-Buben gemacht' },
  doppelkopf: { label: 'Doppelkopf', hint: 'Stich mit 40 oder mehr Augen' },
  schwarz: { label: 'Schwarz gespielt', hint: 'Der Gegner hat keinen einzigen Stich bekommen' },
  gegenDieAlten: { label: 'Gegen die Alten', hint: 'Als Kontra gewonnen' },
  solo: { label: 'Solo-König', hint: 'Ein Solo gewonnen' },
};

export const BADGE_KEYS = Object.keys(BADGES) as BadgeKey[];

/** Abzeichen eines fertigen Spiels: wer (Position) hat was geschafft */
export function badgesOfGame(view: PublicGameState): { pos: number; key: BadgeKey }[] {
  const r = view.result;
  if (!r) return [];
  const out: { pos: number; key: BadgeKey }[] = [];
  const party = (p: number) => (r.reTeam.includes(p) ? 're' : 'kontra');
  const tricks = view.tricks ?? [];

  if (!r.soloScoring) {
    tricks.forEach((t, i) => {
      const w = t.winner;
      if (w === null) return;
      if (view.settings.fuchs && view.schweinchen === null) {
        t.cards.forEach((c, j) => {
          const by = (t.leader + j) % 4;
          if (faceOf(c) === 'D-A' && party(by) !== party(w)) out.push({ pos: w, key: 'fuchs' });
        });
      }
      if (view.settings.doppelkopf && sumAugen(t.cards) >= 40) out.push({ pos: w, key: 'doppelkopf' });
      if (view.settings.karlchen && i === tricks.length - 1 && faceOf(t.cards[(w - t.leader + 4) % 4]) === 'C-J') {
        out.push({ pos: w, key: 'karlchen' });
      }
    });
    if (r.winner === 'kontra') r.kontraTeam.forEach((p) => out.push({ pos: p, key: 'gegenDieAlten' }));
  } else if (r.winner === 're') {
    out.push({ pos: r.reTeam[0], key: 'solo' });
  }
  if (r.winner && r.tricks[r.winner === 're' ? 'kontra' : 're'] === 0) {
    (r.winner === 're' ? r.reTeam : r.kontraTeam).forEach((p) => out.push({ pos: p, key: 'schwarz' }));
  }
  return out;
}

/** Zählt die Abzeichen je Spieler (Nutzer-ID) über viele Spiele */
export function countBadges(games: GameRow[]): Map<string, Record<BadgeKey, number>> {
  const out = new Map<string, Record<BadgeKey, number>>();
  for (const g of games) {
    for (const { pos, key } of badgesOfGame(g.state)) {
      const uid = g.players[pos];
      const row = out.get(uid) ?? (Object.fromEntries(BADGE_KEYS.map((k) => [k, 0])) as Record<BadgeKey, number>);
      row[key]++;
      out.set(uid, row);
    }
  }
  return out;
}

export interface EveningTitle {
  title: string;
  hint: string;
  holders: string[];
}

/** Titel eines Abends: König, Pechvogel, Fuchsjäger, Solo-König, Ansager vom Dienst */
export function eveningTitles(results: ResultRow[], games: GameRow[]): EveningTitle[] {
  const points = new Map<string, number>();
  for (const r of results) points.set(r.user_id, (points.get(r.user_id) ?? 0) + r.points);
  const badges = countBadges(games);
  const announcements = new Map<string, number>();
  for (const g of games) {
    for (const a of g.state.announcementLog) {
      const uid = g.players[a.pos];
      announcements.set(uid, (announcements.get(uid) ?? 0) + 1);
    }
  }

  const best = (m: Map<string, number>, dir: 1 | -1, min: number) => {
    const entries = [...m.entries()].filter(([, v]) => dir * v >= dir * min && v !== 0);
    if (!entries.length) return [];
    const top = dir > 0 ? Math.max(...entries.map(([, v]) => v)) : Math.min(...entries.map(([, v]) => v));
    return entries.filter(([, v]) => v === top).map(([u]) => u);
  };
  const byBadge = (key: BadgeKey) => new Map([...badges.entries()].map(([u, b]) => [u, b[key]]));

  const titles: EveningTitle[] = [
    { title: 'König des Abends', hint: 'Die meisten Punkte', holders: best(points, 1, 1) },
    { title: 'Pechvogel', hint: 'Die wenigsten Punkte', holders: best(points, -1, -1) },
    { title: 'Fuchsjäger', hint: 'Die meisten gefangenen Füchse', holders: best(byBadge('fuchs'), 1, 1) },
    { title: 'Solo-König', hint: 'Die meisten gewonnenen Soli', holders: best(byBadge('solo'), 1, 1) },
    { title: 'Ansager vom Dienst', hint: 'Die meisten Ansagen', holders: best(announcements, 1, 2) },
  ];
  return titles.filter((t) => t.holders.length > 0);
}
