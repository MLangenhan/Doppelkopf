import { faceOf, type PublicGameState } from '@engine';
import type { CatMood } from './giphy';

/**
 * Stimmung eines Spielers (für die Katzen der Bots), rein aus dem öffentlichen Spielstand:
 * Spielende > Fuchs verloren > eigener Stich > gerade angesagt > am Zug > gerade gespielt > Solo > wartet.
 */
export function moodOf(view: PublicGameState, pos: number, recentAnnouncer: number | null): CatMood {
  if (view.phase === 'finished' && view.result) {
    const party = view.result.reTeam.includes(pos) ? 're' : 'kontra';
    return view.result.winner === party ? 'win' : 'lose';
  }
  const t = view.current;
  const done = view.collectPending && t && t.winner !== null;
  if (done) {
    const foxBy = t.cards.findIndex((c) => faceOf(c) === 'D-A');
    const foxOwner = foxBy >= 0 ? (t.leader + foxBy) % 4 : null;
    const sameParty = (a: number, b: number) => view.knownParties[a] !== null && view.knownParties[a] === view.knownParties[b];
    if (foxOwner === pos && t.winner !== pos && !sameParty(pos, t.winner!) && view.kind !== 'solo') return 'shock';
    if (t.winner === pos) return 'win';
  }
  if (recentAnnouncer === pos) return 'announce';
  if (view.phase === 'reservations' ? view.declTurn === pos : view.turn === pos && !view.collectPending) return 'think';
  if (t && !done && t.cards.length > 0) {
    const playedIdx = (pos - t.leader + 4) % 4;
    if (playedIdx < t.cards.length && playedIdx === t.cards.length - 1) return 'play';
  }
  if (view.kind === 'solo' && view.soloist === pos) return 'solo';
  return 'idle';
}
