import type { Party } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Brackets } from './Cursor';
import { CARD_RATIO, PlayingCard } from './PlayingCard';
import { VideoTile } from './VideoTile';

export function PartyBadge({ party, small }: { party: Party; small?: boolean }) {
  return (
    <span
      className={`tag inline-flex items-center gap-1.5 ${small ? 'text-[10px]' : 'text-[11px]'} ${
        party === 're' ? 'text-re' : 'text-kontra'
      }`}
    >
      <span className={`size-1.5 rounded-full ${party === 're' ? 'bg-re' : 'bg-kontra'}`} />
      {party === 're' ? 'Re' : 'Kontra'}
    </span>
  );
}

export function Seat({
  name,
  stream,
  isMe,
  isTurn,
  party,
  isDealer,
  tricks,
  cardsLeft,
  status,
  callouts,
  online,
  connecting,
  videoOff,
  pile,
  compact,
  className = '',
}: {
  name: string;
  stream: MediaStream | null | undefined;
  isMe?: boolean;
  isTurn?: boolean;
  party?: Party | null;
  isDealer?: boolean;
  tricks?: number;
  cardsLeft?: number;
  status?: ReactNode;
  /** Ansagen dieses Spielers, z. B. ["Re", "Keine 90"] */
  callouts?: string[];
  online?: boolean;
  connecting?: boolean;
  videoOff?: boolean;
  /** Gewonnene Stiche als sichtbarer Stapel neben der Kachel, zur Tischmitte hin */
  pile?: { side: 'left' | 'right'; v: 'above' | 'below'; cardW: number };
  /** Kleine Kachel fürs Handy */
  compact?: boolean;
  className?: string;
}) {
  const facts = [
    isDealer ? 'Geber' : null,
    typeof cardsLeft === 'number' && !isMe ? `${cardsLeft} Karten` : null,
    tricks ? `${tricks} ${tricks === 1 ? 'Stich' : 'Stiche'}` : null,
  ].filter(Boolean);

  return (
    <div className={`relative flex flex-col ${compact ? 'gap-1' : 'gap-2'} ${className}`}>
      {pile && !!tricks && <TrickPile count={tricks} {...pile} />}
      <div className="relative">
        <VideoTile
          stream={stream}
          name={name}
          mirror={isMe}
          connecting={connecting}
          videoOff={videoOff}
          small={compact}
          className={`aspect-[4/3] w-full transition-[box-shadow] duration-300 ${isTurn ? 'shadow-[0_0_0_1px_rgba(217,180,90,0.6)]' : ''}`}
        >
          <div
            className={`absolute flex max-w-[92%] items-center rounded-md bg-felt-950/75 ${
              compact ? 'bottom-1 left-1 gap-1 px-1 py-0.5' : 'bottom-2 left-2 gap-2 px-2 py-1'
            }`}
          >
            {online === false && <span className="size-1.5 shrink-0 rounded-full bg-white/30" title="Nicht verbunden" />}
            <span className={`truncate font-medium ${compact ? 'text-[11px]' : 'text-sm'}`}>
              {isMe && name !== 'Du' && !compact ? `${name} (du)` : name}
            </span>
            {party && !compact && <PartyBadge party={party} small />}
          </div>
          <AnimatePresence>
            {callouts && callouts.length > 0 && (
              <motion.div
                key={callouts.join()}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute flex flex-col items-end gap-1 ${compact ? 'top-1 right-1' : 'top-2 right-2'}`}
              >
                {callouts.map((c) => (
                  <span key={c} className="tag rounded bg-gold-400 px-1.5 py-0.5 text-[10px] text-felt-950">
                    {c}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </VideoTile>
        {/* Wer dran ist: goldene Eckwinkel, die sich um die Kachel ziehen */}
        <AnimatePresence>
          {isTurn && (
            <motion.span
              className="pointer-events-none absolute -inset-1.5 text-gold-400"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <Brackets size={18} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className={`tag flex min-h-5 flex-wrap items-center gap-x-2 text-white/45 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {compact && party && <PartyBadge party={party} small />}
        {facts.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}

/** Gewonnene Stiche als Stapel verdeckter Karten. Neue landen mit einem kleinen Fall. */
function TrickPile({ count, side, v, cardW }: { count: number; side: 'left' | 'right'; v: 'above' | 'below'; cardW: number }) {
  const cardH = cardW * CARD_RATIO;
  return (
    <div
      className={`pointer-events-none absolute z-10 flex items-end gap-2 ${side === 'left' ? 'left-1' : 'right-1'} ${
        v === 'below' ? 'top-full mt-1' : 'bottom-full mb-2'
      }`}
      aria-label={`${count} ${count === 1 ? 'Stich' : 'Stiche'}`}
    >
      <div className="relative" style={{ width: cardW + 16, height: cardH + 12 }}>
        <AnimatePresence initial={false}>
          {Array.from({ length: count }, (_, i) => (
            <motion.div
              key={i}
              className="absolute bottom-0 left-0"
              style={{ rotate: ((i * 37) % 13) - 6, x: (i % 4) * 1.5 + Math.min(i, 8) * 1, y: -Math.min(i, 10) * 1.2 }}
              initial={{ y: -60, opacity: 0, scale: 1.4 }}
              animate={{ y: -Math.min(i, 10) * 1.2, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.55 }}
            >
              <PlayingCard back width={cardW} className="ring-1 ring-black/20" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <motion.span
        key={count}
        initial={{ scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.6 }}
        className="display mb-1 text-3xl leading-none text-white/85 tabular-nums"
      >
        {count}
      </motion.span>
    </div>
  );
}
