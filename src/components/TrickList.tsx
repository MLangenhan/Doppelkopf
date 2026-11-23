import { sumAugen, type Trick } from '@engine';
import { PlayingCard } from './PlayingCard';

/** Alle Stiche eines Spiels: wer was gelegt hat, wer gewonnen hat, wie viele Augen */
export function TrickList({
  tricks,
  name,
  cardW,
  newestFirst = true,
}: {
  tricks: Trick[];
  name: (pos: number) => string;
  cardW: number;
  newestFirst?: boolean;
}) {
  const items = tricks.map((t, n) => ({ t, n }));
  if (newestFirst) items.reverse();
  return (
    <>
      <ol className="flex flex-col gap-4">
        {items.map(({ t, n }) => (
          <li key={n} className="flex items-center gap-4 border-t border-white/[0.06] pt-3 first:border-0 first:pt-0">
            <span className="tag w-16 shrink-0 text-[10px] text-white/45">
              Stich {n + 1}
              <span className="block text-gold-300/90 normal-case">{t.winner !== null ? name(t.winner) : ''}</span>
              <span className="block normal-case text-white/35">{sumAugen(t.cards)} Augen</span>
            </span>
            <div className="flex gap-2">
              {t.cards.map((c, i) => {
                const pos = (t.leader + i) % 4;
                return (
                  <div key={c} className="flex flex-col items-center gap-1">
                    <PlayingCard card={c} width={cardW} className={pos === t.winner ? 'ring-2 ring-gold-400' : 'opacity-90'} />
                    <span className="truncate text-[10px] text-white/55" style={{ maxWidth: cardW + 12 }}>
                      {i === 0 ? '▸ ' : ''}
                      {name(pos)}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-white/40">▸ hat ausgespielt · Gold umrandet: hat den Stich gewonnen</p>
    </>
  );
}
