import { type Card } from '@engine';
import { PlayingCard } from './PlayingCard';

/**
 * Spickzettel: Trumpf-Reihenfolge im Normalspiel und die Augen jeder Karte.
 * Oben die Trümpfe (Dullen, Damen, Buben, Karo), unten die Fehlfarben.
 */
type Group = { cards: string[]; values: number[] };

const card = (face: string) => `${face}-0` as Card;

export function CardGuide({ width, withNines }: { width: number; withNines: boolean }) {
  const cw = Math.round(width / 6.4);
  const step = cw * 0.38;
  const nine = (faces: string[]) => (withNines ? faces : faces.filter((f) => !f.endsWith('-9')));
  const values = (faces: string[]) => faces.map((f) => ({ A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0 })[f.split('-')[1]] ?? 0);
  const g = (faces: string[]): Group => ({ cards: nine(faces), values: values(nine(faces)) });

  const rows: Group[][] = [
    [g(['H-10', 'H-10']), g(['C-Q', 'S-Q', 'H-Q', 'D-Q']), g(['C-J', 'S-J', 'H-J', 'D-J'])],
    [g(['D-A', 'D-10', 'D-K', 'D-9'])],
    [g(['H-A', 'H-K', 'H-9']), g(['S-A', 'S-10', 'S-K', 'S-9']), g(['C-A', 'C-10', 'C-K', 'C-9'])],
  ];

  return (
    <div
      className="pointer-events-none flex flex-col items-center gap-2 rounded-xl bg-felt-950/55 p-2 ring-1 ring-white/[0.06]"
      aria-label="Kartenübersicht: Trumpf-Reihenfolge und Augen"
    >
      <span className="tag text-[9px] text-white/45">Trumpf von hoch nach niedrig · Augen</span>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {row.map((grp, j) => {
            const same = grp.values.every((v) => v === grp.values[0]);
            return (
              <div key={j} className="relative" style={{ width: cw + step * (grp.cards.length - 1), height: cw * 1.4 }}>
                {grp.cards.map((f, k) => (
                  <div key={k} className="absolute top-0" style={{ left: k * step }}>
                    <PlayingCard card={card(f)} width={cw} />
                    {(!same || k === grp.cards.length - 1) && (
                      <span
                        className="absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold-400 text-[8px] font-bold text-felt-950 shadow"
                        style={{ left: k === grp.cards.length - 1 ? '50%' : step / 2, top: '50%' }}
                      >
                        {grp.values[k]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
