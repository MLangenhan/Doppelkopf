import { type ReactNode, useEffect, useRef } from 'react';

const AVATAR_COLORS = ['#c98b6b', '#6fa596', '#c9ae6b', '#8fa878', '#9a88c4', '#c48aa6', '#6f9cc4'];

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function VideoTile({
  stream,
  name,
  mirror,
  videoOff,
  highlight,
  className = '',
  children,
  connecting,
}: {
  stream: MediaStream | null | undefined;
  name: string;
  /** Eigenes Bild spiegeln, wie man es aus Videocalls kennt */
  mirror?: boolean;
  videoOff?: boolean;
  /** Goldener Rahmen (z. B. wer dran ist) */
  highlight?: boolean;
  connecting?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream ?? null;
    if (stream) v.play().catch(() => {});
  }, [stream, videoOff]);

  const showVideo = !!stream && !videoOff;

  return (
    <div className={`relative overflow-hidden rounded-xl bg-felt-950 ring-1 ring-white/[0.08] ${className}`}>
      {showVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-felt-800">
          <div
            className="grid aspect-square w-[34%] max-w-20 place-items-center rounded-full text-2xl font-bold text-felt-950 shadow-lg"
            style={{ background: colorFor(name) }}
            aria-hidden
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          {connecting && <span className="absolute bottom-9 text-[11px] text-white/50">verbindet …</span>}
        </div>
      )}
      {highlight && (
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-[3px] ring-gold-400 ring-inset" />
      )}
      {children}
    </div>
  );
}
