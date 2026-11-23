import { augenOf, type Card, type DulleRule, faceOf, trickWinnerIndex, trumpOrder, type TrumpMode } from '@engine';

/**
 * Spickzettel: Trumpf-Reihenfolge und Augen jeder Karte – aus eigenen kleinen Kacheln gebaut (Rang + Farbe),
 * damit Markierungen auf jedem Bildschirm gleich aussehen. Mit einem laufenden Stich zeigt er,
 * welche Karte gerade vorne liegt, welche übernehmen würde und welche nicht.
 */
const SUIT_SYMBOL: Record<string, string> = { C: '♣', S: '♠', H: '♥', D: '♦' };
const RANK_LABEL: Record<string, string> = { A: 'A', '10': '10', K: 'K', Q: 'D', J: 'B', '9': '9' };
const FEHL_RANKS = ['A', '10', 'K', 'Q', 'J', '9'];

type State = 'lead' | 'wins' | 'loses' | 'gone' | 'neutral';

export function CardGuide({
  width,
  withNines,
  mode = 'normal',
  schweinchen = false,
  dulleRule = 'first',
  trick,
  played = [],
  isLast = false,
}: {
  width: number;
  withNines: boolean;
  mode?: TrumpMode;
  schweinchen?: boolean;
  dulleRule?: DulleRule;
  /** Laufender Stich: markiert, welche Karte übernehmen würde */
  trick?: Card[];
  /** Schon gespielte Karten (fertige Stiche): beide weg → durchgestrichen */
  played?: Card[];
  isLast?: boolean;
}) {
  const ctx = { mode, schweinchen, dulleRule };
  const keep = (f: string) => withNines || !f.endsWith('-9');
  const trumps = trumpOrder(mode, schweinchen).filter(keep);
  const fehl = ['C', 'S', 'H', 'D']
    .map((s) => FEHL_RANKS.map((r) => `${s}-${r}`).filter((f) => keep(f) && !trumps.includes(f)))
    .filter((row) => row.length > 0);

  const cards = trick ?? [];
  const leadIdx = cards.length ? trickWinnerIndex(cards, ctx, isLast) : -1;
  const leadFace = leadIdx >= 0 ? faceOf(cards[leadIdx]) : null;
  const goneCount = (f: string) => played.filter((c) => faceOf(c) === f).length + cards.filter((c) => faceOf(c) === f).length;

  const stateOf = (f: string): State => {
    if (f === leadFace) return 'lead';
    const gone = goneCount(f);
    if (gone >= 2) return 'gone';
    if (!cards.length || cards.length >= 4) return 'neutral';
    // Käme diese Karte als nächste, läge sie dann vorne?
    const copy = `${f}-${cards.some((c) => c === `${f}-0`) ? 1 : 0}` as Card;
    return trickWinnerIndex([...cards, copy], ctx, isLast) === cards.length ? 'wins' : 'loses';
  };

  // Kachelgröße aus der verfügbaren Breite: die längste Reihe (Trümpfe) passt, notfalls umgebrochen
  const cw = Math.max(18, Math.min(30, Math.floor((width - 24) / Math.max(8, Math.ceil(trumps.length / 1.5)) - 4)));

  const tile = (f: string) => {
    const [suit, rank] = f.split('-');
    const red = suit === 'H' || suit === 'D';
    const st = stateOf(f);
    const ring =
      st === 'lead'
        ? 'ring-2 ring-gold-400 shadow-[0_0_10px_rgba(217,180,90,0.7)]'
        : st === 'wins'
          ? 'ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]'
          : 'ring-1 ring-black/25';
    const fade = st === 'loses' ? 'opacity-35' : st === 'gone' ? 'opacity-20' : '';
    return (
      <div key={f} className="flex flex-col items-center gap-0.5" title={`${f}: ${augenOf(`${f}-0`)} Augen`}>
        <div
          className={`relative grid place-items-center rounded-[5px] bg-white leading-none font-bold transition-[opacity,box-shadow] duration-300 ${ring} ${fade}`}
          style={{ width: cw, height: Math.round(cw * 1.35) }}
        >
          <span className={red ? 'text-red-600' : 'text-neutral-900'} style={{ fontSize: Math.round(cw * 0.42) }}>
            {RANK_LABEL[rank]}
          </span>
          <span className={red ? 'text-red-600' : 'text-neutral-900'} style={{ fontSize: Math.round(cw * 0.5) }}>
            {SUIT_SYMBOL[suit]}
          </span>
          {st === 'gone' && <span className="absolute inset-x-0.5 top-1/2 h-0.5 -rotate-45 bg-neutral-800" aria-hidden />}
        </div>
        <span className="text-[9px] text-white/55 tabular-nums">{augenOf(`${f}-0`)}</span>
      </div>
    );
  };

  return (
    <div
      className="pointer-events-none flex flex-col gap-2 rounded-xl bg-felt-950/70 p-2.5 ring-1 ring-white/[0.06]"
      style={{ width }}
      aria-label="Kartenübersicht: Trumpf-Reihenfolge und Augen"
    >
      <span className="tag text-[9px] text-white/45">{trumps.length ? 'Trumpf von hoch nach niedrig' : 'Kein Trumpf'}</span>
      {trumps.length > 0 && <div className="flex flex-wrap gap-1">{trumps.map(tile)}</div>}
      <span className="tag text-[9px] text-white/45">Fehlfarben</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {fehl.map((row) => (
          <div key={row[0]} className="flex gap-1">
            {row.map(tile)}
          </div>
        ))}
      </div>
      {cards.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-white/55">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm ring-2 ring-gold-400" /> liegt vorne
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm ring-2 ring-emerald-400" /> würde übernehmen
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-white/30" /> reicht nicht
          </span>
        </div>
      )}
    </div>
  );
}
