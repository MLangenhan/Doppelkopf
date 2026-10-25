import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { partyLabel, resultKindLabel } from '../lib/gameText';
import type { GameRow } from '../lib/supabase';
import { PartyBadge } from './Seat';

/** Wie sich die Punkte der letzten Spiele zusammensetzen: Gewonnen, Ansagen, keine 90, Fuchs … */
export function RecentGames({
  games,
  name,
  limit = 5,
  showTable,
}: {
  /** Fertige Spiele, neuestes zuerst */
  games: GameRow[];
  name: (userId: string) => string;
  limit?: number;
  /** Tischname je Spiel (Statistikseite) */
  showTable?: (game: GameRow) => string | undefined;
}) {
  const [all, setAll] = useState(false);
  const scored = games.filter((g) => g.state.result);
  if (!scored.length) return <p className="px-1 text-sm text-white/50">Noch keine Spiele gewertet.</p>;
  const shown = all ? scored : scored.slice(0, limit);

  return (
    <div className="flex flex-col gap-2">
      {shown.map((g, i) => (
        <GameCard key={g.id} game={g} name={name} defaultOpen={i === 0} table={showTable?.(g)} />
      ))}
      {scored.length > limit && (
        <button className="btn-ghost tag py-1.5 text-[10px]" onClick={() => setAll((v) => !v)}>
          {all ? 'Weniger' : `Alle ${scored.length} Spiele`}
        </button>
      )}
    </div>
  );
}

function GameCard({ game, name, defaultOpen, table }: { game: GameRow; name: (id: string) => string; defaultOpen: boolean; table?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const v = game.state;
  const r = v.result!;
  const kind = resultKindLabel(v.revealedKind ?? v.kind ?? 'normal', v.solo);
  const winners = r.winner ? (r.winner === 're' ? r.reTeam : r.kontraTeam) : [];
  // Spielwert aus Sicht der Gewinner (Sonderpunkte der Verlierer sind schon abgezogen)
  const value = r.winner === 'kontra' ? -r.reValue : r.winner === 're' ? r.reValue : Math.abs(r.reValue);

  return (
    <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tag text-[10px] text-white/40">{String(game.number).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {r.winner ? (
            <>
              <span className={r.winner === 're' ? 'text-re' : 'text-kontra'}>{partyLabel(r.winner)}</span>{' '}
              <span className="text-white/60">{winners.map((p) => name(game.players[p])).join(' & ')}</span>
            </>
          ) : (
            <span className="text-white/60">Kein Gewinner</span>
          )}
        </span>
        <span className="tag text-[9px] text-white/40">{kind}</span>
        <span className="w-8 text-right font-semibold tabular-nums">{value}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-2.5 pt-1.5 pb-2.5">
          {table && <p className="tag pb-1 text-[9px] text-white/35">{table}</p>}
          <ul className="text-[13px]">
            {r.lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <PartyBadge party={l.party} small />
                  <span className="truncate text-white/80">{l.label}</span>
                </span>
                <span className="tabular-nums text-white/70">+{l.points}</span>
              </li>
            ))}
          </ul>
          <div className="tag mt-1.5 flex justify-between border-t border-white/[0.06] pt-1.5 text-[9px] text-white/40">
            <span>
              Augen {r.augen.re} : {r.augen.kontra}
            </span>
            <span>{r.soloScoring ? `Solo ×3 · ${value * 3}` : `Wert ${value}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
