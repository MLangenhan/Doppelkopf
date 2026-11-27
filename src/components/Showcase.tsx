import { BOT_BADGES, BOT_TITLES } from '../lib/botLooks';
import { titleOf } from '@engine';
import { AchievementBadge } from './AchievementBadge';

/** Gekaufter Titel; die sehr seltenen leuchten babyblau */
export function TitleTag({ titleKey, className = '' }: { titleKey?: string | null; className?: string }) {
  // Bots haben eigene Spaß-Titel
  if (titleKey && BOT_TITLES[titleKey]) {
    return (
      <span
        className={`tag truncate font-mono text-[9px] text-red-400 [text-shadow:0_0_6px_rgba(248,113,113,0.9),0_0_12px_rgba(239,68,68,0.55)] ${className}`}
        title="Bot-Titel"
      >
        {BOT_TITLES[titleKey]}
      </span>
    );
  }
  const found = titleOf(titleKey);
  const t = found ? { ...found.def, name: found.name } : null;
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
      {keys.slice(0, 3).map((k) => {
        const b = BOT_BADGES[k];
        if (!b) return <AchievementBadge key={k} achievementKey={k} size={size} />;
        const Icon = b.icon;
        return (
          <span
            key={k}
            className="grid shrink-0 place-items-center rounded-md bg-black/50 ring-1 ring-white/15"
            style={{ width: size, height: size, color: b.color }}
            title={b.label}
            aria-label={b.label}
          >
            <Icon style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={2.2} />
          </span>
        );
      })}
    </span>
  );
}
