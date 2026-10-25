// Abrechnung eines beendeten Spiels (angelehnt an die DDV-Turnierregeln).

import { faceOf, sumAugen } from './cards.ts';
import type { AnnounceLevel, GameState, Party } from './game.ts';

export interface ScoreLine {
  label: string;
  party: Party;
  points: number;
}

export interface GameResult {
  reTeam: number[];
  kontraTeam: number[];
  soloScoring: boolean;
  augen: Record<Party, number>;
  tricks: Record<Party, number>;
  winner: Party | null;
  lines: ScoreLine[];
  /** Spielwert aus Sicht der Re-Partei (positiv = Re bekommt Punkte), vor dem Solo-Faktor. */
  reValue: number;
  /** Punkte je Position 0–3. */
  scores: number[];
}

const other = (p: Party): Party => (p === 're' ? 'kontra' : 're');

const ABSAGE_LABEL: Record<Exclude<AnnounceLevel, 120>, string> = {
  90: 'Keine 90',
  60: 'Keine 60',
  30: 'Keine 30',
  0: 'Schwarz',
};

export function isSoloScoring(s: GameState): boolean {
  return s.kind === 'solo' || s.kind === 'silentSolo' || (s.kind === 'hochzeit' && !!s.hochzeit?.alone);
}

function meetsTarget(
  party: Party,
  augen: Record<Party, number>,
  tricks: Record<Party, number>,
  totalTricks: number,
  ann: Record<Party, AnnounceLevel | null>,
): boolean {
  const absage = (p: Party) => {
    const l = ann[p];
    return l !== null && l < 120 ? l : null;
  };
  const own = absage(party);
  const opp = absage(other(party));
  if (own !== null) return own === 0 ? tricks[party] === totalTricks : augen[party] >= 240 - own + 1;
  if (opp !== null) return opp === 0 ? tricks[party] >= 1 : augen[party] >= opp;
  const onlyKontra = ann.kontra !== null && ann.re === null;
  if (party === 're') return augen.re >= (onlyKontra ? 120 : 121);
  return augen.kontra >= (onlyKontra ? 121 : 120);
}

export function scoreGame(s: GameState): GameResult {
  const reTeam = [...s.reTeam].sort();
  const kontraTeam = [0, 1, 2, 3].filter((p) => !reTeam.includes(p));
  const partyOf = (pos: number): Party => (reTeam.includes(pos) ? 're' : 'kontra');
  const solo = isSoloScoring(s);

  const augen: Record<Party, number> = { re: 0, kontra: 0 };
  const tricks: Record<Party, number> = { re: 0, kontra: 0 };
  for (const t of s.tricks) {
    const p = partyOf(t.winner!);
    augen[p] += sumAugen(t.cards);
    tricks[p] += 1;
  }

  const ann = s.announcements;
  const total = s.tricks.length;
  const reWins = meetsTarget('re', augen, tricks, total, ann);
  const kontraWins = meetsTarget('kontra', augen, tricks, total, ann);
  const winner: Party | null = reWins && !kontraWins ? 're' : kontraWins && !reWins ? 'kontra' : null;

  const lines: ScoreLine[] = [];
  const add = (label: string, party: Party, points = 1) => lines.push({ label, party, points });

  if (winner) {
    const loser = other(winner);
    add('Gewonnen', winner);
    if (!solo && winner === 'kontra') add('Gegen die Alten', winner);
    if (ann.re !== null) add('Re angesagt', winner, 2);
    if (ann.kontra !== null) add('Kontra angesagt', winner, 2);
    for (const p of ['re', 'kontra'] as Party[]) {
      const lvl = ann[p];
      if (lvl === null) continue;
      for (const l of [90, 60, 30, 0] as const) {
        if (lvl <= l) add(`${ABSAGE_LABEL[l]} abgesagt (${p === 're' ? 'Re' : 'Kontra'})`, winner);
      }
    }
    if (augen[loser] < 90) add('Keine 90 gespielt', winner);
    if (augen[loser] < 60) add('Keine 60 gespielt', winner);
    if (augen[loser] < 30) add('Keine 30 gespielt', winner);
    if (tricks[loser] === 0) add('Schwarz gespielt', winner);
    const loserAbs = ann[loser];
    if (loserAbs !== null && loserAbs < 120) {
      if (loserAbs <= 90 && augen[winner] >= 120) add('120 gegen keine 90', winner);
      if (loserAbs <= 60 && augen[winner] >= 90) add('90 gegen keine 60', winner);
      if (loserAbs <= 30 && augen[winner] >= 60) add('60 gegen keine 30', winner);
      if (loserAbs <= 0 && augen[winner] >= 30) add('30 gegen schwarz', winner);
    }
  }

  if (!solo) {
    s.tricks.forEach((t, i) => {
      const wp = partyOf(t.winner!);
      if (s.settings.doppelkopf && sumAugen(t.cards) >= 40) add('Doppelkopf', wp);
      if (s.settings.fuchs && s.schweinchen === null) {
        t.cards.forEach((c, j) => {
          const playedBy = (t.leader + j) % 4;
          if (faceOf(c) === 'D-A' && partyOf(playedBy) !== wp) add('Fuchs gefangen', wp);
        });
      }
      if (s.settings.karlchen && i === s.tricks.length - 1) {
        const winningCard = t.cards[(t.winner! - t.leader + 4) % 4];
        if (faceOf(winningCard) === 'C-J') add('Karlchen', wp);
      }
    });
  }

  const reValue = lines.reduce((v, l) => v + (l.party === 're' ? l.points : -l.points), 0);
  const scores = [0, 1, 2, 3].map((p) => {
    const factor = solo && reTeam.includes(p) ? 3 : 1;
    return (reTeam.includes(p) ? factor * reValue : -reValue) || 0;
  });

  return { reTeam, kontraTeam, soloScoring: solo, augen, tricks, winner, lines, reValue, scores };
}
