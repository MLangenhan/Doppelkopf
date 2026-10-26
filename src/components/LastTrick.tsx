import type { Trick } from '@engine';
import { CARD_RATIO, PlayingCard } from './PlayingCard';

/** Kleine, immer sichtbare Ansicht des letzten Stichs. Zum Vergrößern mit der Maus darüberfahren. */
export function LastTrick({ trick, name, cardW = 44 }: { trick: Trick | null; name: (pos: number) => string; cardW?: number }) {
  if (!trick) {
    return <div style={{ height: cardW * CARD_RATIO + 22 }} aria-hidden />;
  }
  return (
    <div className="group flex flex-col items-center gap-1" aria-label={`Letzter Stich, gewonnen von ${name(trick.winner!)}`}>
      <span className="text-[11px] font-semibold tracking-wider text-white/45 uppercase">
        Letzter Stich · <span className="text-gold-300/90 normal-case">{name(trick.winner!)}</span>
      </span>
      <div className="flex origin-top gap-1 transition-transform duration-200 group-hover:scale-[1.6]">
        {trick.cards.map((c, i) => {
          const pos = (trick.leader + i) % 4;
          return (
            <div key={c} className="relative" title={name(pos)}>
              <PlayingCard card={c} width={cardW} className={pos === trick.winner ? 'ring-2 ring-gold-400' : 'opacity-90'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
