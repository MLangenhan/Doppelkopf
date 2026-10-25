import type { Party } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { VideoTile } from './VideoTile';

export function PartyBadge({ party, small }: { party: Party; small?: boolean }) {
  return (
    <span
      className={`rounded-md font-bold tracking-wide uppercase ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} ${
        party === 're' ? 'bg-re/90 text-felt-950' : 'bg-kontra/90 text-felt-950'
      }`}
    >
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
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <VideoTile
        stream={stream}
        name={name}
        mirror={isMe}
        highlight={isTurn}
        connecting={connecting}
        videoOff={videoOff}
        className="aspect-[4/3] w-full"
      >
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2">
          {online === false && <span className="h-2 w-2 shrink-0 rounded-full bg-white/30" title="Nicht verbunden" />}
          <span className="truncate text-sm font-semibold">{isMe && name !== 'Du' ? `${name} (du)` : name}</span>
          {isDealer && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold" title="Gibt diese Runde">
              Geber
            </span>
          )}
          <span className="flex-1" />
          {party && <PartyBadge party={party} small />}
        </div>
        {typeof tricks === 'number' && tricks > 0 && (
          <div
            className="absolute top-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-semibold"
            title={`${tricks} Stiche`}
          >
            {tricks} {tricks === 1 ? 'Stich' : 'Stiche'}
          </div>
        )}
        {typeof cardsLeft === 'number' && !isMe && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-xs" title="Karten auf der Hand">
            <span className="inline-block h-3 w-2 rounded-[2px] bg-[#1d4f8f] ring-1 ring-white/60" />
            {cardsLeft}
          </div>
        )}
        <AnimatePresence>
          {callouts && callouts.length > 0 && (
            <motion.div
              key={callouts.join()}
              initial={{ scale: 0.6, opacity: 0, y: -6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="absolute top-9 right-2 flex flex-col items-end gap-1"
            >
              {callouts.map((c) => (
                <span key={c} className="rounded-md bg-gold-400 px-2 py-0.5 text-xs font-bold text-felt-950 shadow">
                  {c}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </VideoTile>
      {status && <div className="min-h-5 text-center text-xs text-white/75">{status}</div>}
    </div>
  );
}
