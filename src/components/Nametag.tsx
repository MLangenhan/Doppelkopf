import type { ReactNode } from 'react';
import { type FrameKey, FRAME_STYLE } from '../lib/cosmetics';
import { BadgeRow, TitleTag } from './Showcase';

/** Namensschild: Name, darunter der Titel, rechts die Badges – auf Wunsch mit Rahmen */
export function Nametag({
  name,
  title,
  badges,
  frame,
  compact,
  before,
  after,
  className = '',
}: {
  name: string;
  title?: string | null;
  badges?: string[];
  frame?: FrameKey | null;
  compact?: boolean;
  /** z. B. Online-Punkt */
  before?: ReactNode;
  /** z. B. Partei */
  after?: ReactNode;
  className?: string;
}) {
  const inner = (
    <div className={`flex min-w-0 items-center rounded-md bg-felt-950/80 ${compact ? 'gap-1 px-1 py-0.5' : 'gap-2 px-2 py-1'}`}>
      {before}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={`truncate font-medium ${compact ? 'text-[11px]' : 'text-sm'}`}>{name}</span>
        {!compact && <TitleTag titleKey={title} />}
      </span>
      {!compact && <BadgeRow keys={badges} size={20} />}
      {after}
    </div>
  );
  if (!frame || !FRAME_STYLE[frame]) return <div className={`max-w-full ${className}`}>{inner}</div>;
  return <div className={`max-w-full rounded-lg p-[1.5px] ${FRAME_STYLE[frame]} ${className}`}>{inner}</div>;
}
