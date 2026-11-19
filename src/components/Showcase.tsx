import { TITLE_BY_KEY } from '@engine';
import { AchievementBadge } from './AchievementBadge';

/** Gekaufter Titel; die sehr seltenen leuchten babyblau */
export function TitleTag({ titleKey, className = '' }: { titleKey?: string | null; className?: string }) {
  const t = titleKey ? TITLE_BY_KEY.get(titleKey) : null;
  if (!t) return null;
  return (
    <span
      className={`tag truncate text-[9px] ${
        t.rare ? 'title-rare rounded px-1 text-sky-100' : 'text-gold-300/90'
      } ${className}`}
      title={t.rare ? 'Sehr seltener Titel' : 'Titel'}
    >
      {t.name}
    </span>
  );
}

/** Bis zu drei ausgewählte Erfolge, klein nebeneinander */
export function BadgeRow({ keys, size = 18 }: { keys?: string[]; size?: number }) {
  if (!keys?.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-label="Erfolge">
      {keys.slice(0, 3).map((k) => (
        <AchievementBadge key={k} achievementKey={k} size={size} />
      ))}
    </span>
  );
}
