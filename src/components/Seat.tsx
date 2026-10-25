import type { Party } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Brackets } from './Cursor';
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
  className?: string;
}) {
  const facts = [
    isDealer ? 'Geber' : null,
    typeof cardsLeft === 'number' && !isMe ? `${cardsLeft} Karten` : null,
    tricks ? `${tricks} ${tricks === 1 ? 'Stich' : 'Stiche'}` : null,
  ].filter(Boolean);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative">
        <VideoTile
          stream={stream}
          name={name}
          mirror={isMe}
          connecting={connecting}
          videoOff={videoOff}
          className={`aspect-[4/3] w-full transition-[box-shadow] duration-300 ${isTurn ? 'shadow-[0_0_0_1px_rgba(217,180,90,0.6)]' : ''}`}
        >
          <div className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-2 rounded-md bg-felt-950/75 px-2 py-1">
            {online === false && <span className="size-1.5 shrink-0 rounded-full bg-white/30" title="Nicht verbunden" />}
            <span className="truncate text-sm font-medium">{isMe && name !== 'Du' ? `${name} (du)` : name}</span>
            {party && <PartyBadge party={party} small />}
          </div>
          <AnimatePresence>
            {callouts && callouts.length > 0 && (
              <motion.div
                key={callouts.join()}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-2 right-2 flex flex-col items-end gap-1"
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
      <div className="tag flex min-h-4 flex-wrap items-center gap-x-2 text-[10px] text-white/45">
        {facts.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
