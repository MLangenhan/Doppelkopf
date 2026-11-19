import { ACHIEVEMENT_BY_KEY, type Rarity } from '@engine';
import {
  Anchor,
  Award,
  Bird,
  CalendarDays,
  Church,
  Club,
  Crosshair,
  Crown,
  Diamond,
  Dices,
  EyeOff,
  Flame,
  Footprints,
  Gem,
  HandCoins,
  Heart,
  House,
  Layers,
  Leaf,
  type LucideIcon,
  Medal,
  Megaphone,
  Moon,
  Mountain,
  Orbit,
  PiggyBank,
  Play,
  Rabbit,
  Rocket,
  Shield,
  ShieldCheck,
  Skull,
  Snowflake,
  Spade,
  Sparkles,
  Star,
  Sunrise,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Wand,
} from 'lucide-react';
import { useId } from 'react';

/** Symbol und Farbton (Hue) je Erfolg – jede Medaille sieht anders aus */
const LOOK: Record<string, [LucideIcon, number]> = {
  ersterStich: [Layers, 140],
  erstesSpiel: [Play, 160],
  ersterSieg: [Trophy, 45],
  fuchsjaeger: [Rabbit, 25],
  ansager: [Megaphone, 210],
  doppelkopf: [Dices, 280],
  gegenDieAlten: [Swords, 5],
  hochzeit: [Church, 330],
  armutszeugnis: [PiggyBank, 300],
  goenner: [HandCoins, 95],
  gastgeber: [House, 190],
  stammgast: [CalendarDays, 230],
  karlchen: [Club, 120],
  fuchsbau: [Footprints, 20],
  solist: [Star, 50],
  keine90: [Shield, 200],
  siegesserie: [TrendingUp, 150],
  comeback: [Sunrise, 35],
  marathon: [Timer, 260],
  nachteule: [Moon, 250],
  schweinchen: [Diamond, 345],
  fuchsVerteidigt: [ShieldCheck, 30],
  dulleSticht: [Heart, 0],
  dreifachKoenig: [Crown, 48],
  fleischlos: [Leaf, 110],
  keine60: [Anchor, 195],
  doppelterDoko: [Gem, 285],
  fuchsjagd: [Crosshair, 15],
  stillesSolo: [EyeOff, 270],
  alleinVorDemAltar: [Bird, 320],
  absageMeister: [Mountain, 175],
  unaufhaltsam: [Rocket, 10],
  veteran: [Award, 40],
  schwarz: [Spade, 240],
  soloSammler: [Sparkles, 60],
  karlchenFuchs: [Wand, 100],
  gegenDenStrom: [Flame, 15],
  makellos: [Snowflake, 190],
  schwarzMitAnsage: [Skull, 275],
  soloSchwarz: [Orbit, 300],
};

/** Form und Material je Seltenheit */
const SHAPES: Record<Rarity, string> = {
  common: 'M50 4 A46 46 0 1 1 49.99 4 Z',
  rare: 'M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z',
  epic: 'M50 3 L90 15 L90 52 C90 75 72 89 50 97 C28 89 10 75 10 52 L10 15 Z',
  legendary:
    'M50 2 L61 34 L95 35 L68 56 L78 90 L50 70 L22 90 L32 56 L5 35 L39 34 Z',
  mythic: 'M50 2 L86 20 L98 56 L72 92 L28 92 L2 56 L14 20 Z',
};

const RIM: Record<Rarity, [string, string]> = {
  common: ['#e0a46a', '#7a4a22'],
  rare: ['#f2f5f8', '#8a96a3'],
  epic: ['#fff1b8', '#b8860b'],
  legendary: ['#ffd6f5', '#7ad7ff'],
  mythic: ['#e9d5ff', '#3b0764'],
};

export function iconFor(key: string): LucideIcon {
  return LOOK[key]?.[0] ?? Medal;
}

/** Medaille eines Erfolgs. Je seltener, desto aufwendiger: Glanz, Schimmer, Lichtkranz, Funken. */
export function AchievementBadge({ achievementKey, size = 56, locked = false }: { achievementKey: string; size?: number; locked?: boolean }) {
  const a = ACHIEVEMENT_BY_KEY.get(achievementKey);
  const id = useId().replace(/:/g, '');
  if (!a) return null;
  const [Icon, hue] = LOOK[a.key] ?? [Medal, 45];
  const rarity = a.rarity;
  const [rimA, rimB] = RIM[rarity];
  const fillA = `hsl(${hue} 70% ${rarity === 'mythic' ? 30 : 48}%)`;
  const fillB = `hsl(${(hue + 30) % 360} 75% ${rarity === 'mythic' ? 12 : 26}%)`;
  const fancy = rarity === 'legendary' || rarity === 'mythic';

  return (
    <div
      className={`relative shrink-0 ${locked ? 'medal-locked' : ''} ${fancy && !locked ? 'achievement-glow' : ''}`}
      style={{ width: size, height: size, ['--glow' as string]: rarity === 'mythic' ? '#a855f7' : '#7dd3fc' }}
      title={a.name}
    >
      {/* Lichtkranz hinter legendären und mythischen Medaillen */}
      {fancy && !locked && (
        <div
          aria-hidden
          className="achievement-rays absolute -inset-[18%] rounded-full"
          style={{
            background:
              rarity === 'mythic'
                ? 'conic-gradient(from 0deg, #a855f700, #a855f7aa, #facc1500, #a855f7aa, #a855f700)'
                : 'conic-gradient(from 0deg, #7dd3fc00, #7dd3fc99, #f0abfc00, #fde68a99, #7dd3fc00)',
          }}
        />
      )}
      <svg viewBox="0 0 100 100" className="relative h-full w-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]" aria-hidden>
        <defs>
          <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={rimA} />
            <stop offset="1" stopColor={rimB} />
          </linearGradient>
          <radialGradient id={`fill${id}`} cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor={fillA} />
            <stop offset="1" stopColor={fillB} />
          </radialGradient>
          <clipPath id={`clip${id}`}>
            <path d={SHAPES[rarity]} />
          </clipPath>
        </defs>
        <path d={SHAPES[rarity]} fill={`url(#rim${id})`} />
        <g transform="translate(50 50) scale(0.84) translate(-50 -50)">
          <path d={SHAPES[rarity]} fill={`url(#fill${id})`} />
        </g>
        {/* Glanzstreifen ab Episch */}
        {(rarity === 'epic' || fancy) && !locked && (
          <g clipPath={`url(#clip${id})`}>
            <rect className="achievement-shine" x="-60" y="-10" width="30" height="130" fill="white" opacity="0.35" transform="rotate(20)" />
          </g>
        )}
      </svg>
      <Icon
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
        style={{ width: size * 0.38, height: size * 0.38 }}
        strokeWidth={2}
      />
      {rarity === 'mythic' && !locked && (
        <>
          <span aria-hidden className="achievement-spark absolute top-[8%] left-[18%] size-1 rounded-full bg-yellow-200" />
          <span aria-hidden className="achievement-spark absolute right-[12%] bottom-[20%] size-1 rounded-full bg-fuchsia-200 [animation-delay:0.7s]" />
          <span aria-hidden className="achievement-spark absolute top-[40%] right-[4%] size-0.5 rounded-full bg-white [animation-delay:1.3s]" />
        </>
      )}
    </div>
  );
}

