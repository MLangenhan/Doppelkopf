import type { Rarity } from '@engine';
import { Bird, Cat, Club, Crown, Diamond, Ghost, Heart, type LucideIcon, Rabbit, Rocket, Skull, Spade, Star } from 'lucide-react';

// Anpassungen fürs Namensschild. Rahmen sind an Erfolge gekoppelt (erster Erfolg der Stufe), Avatare frei.

export type FrameKey = 'bronze' | 'silver' | 'gold' | 'holo' | 'crystal';

export const FRAMES: { key: FrameKey; name: string; rarity: Rarity }[] = [
  { key: 'bronze', name: 'Bronze', rarity: 'common' },
  { key: 'silver', name: 'Silber', rarity: 'rare' },
  { key: 'gold', name: 'Gold', rarity: 'epic' },
  { key: 'holo', name: 'Holografisch', rarity: 'legendary' },
  { key: 'crystal', name: 'Kristall', rarity: 'mythic' },
];

/** Rand des Namensschilds je Rahmen (als Hintergrund hinter 1,5 px Innenabstand) */
export const FRAME_STYLE: Record<FrameKey, string> = {
  bronze: 'bg-gradient-to-br from-amber-400 via-amber-700 to-amber-900',
  silver: 'bg-gradient-to-br from-white via-slate-300 to-slate-500',
  gold: 'bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-700 shadow-[0_0_10px_rgba(250,204,21,0.45)]',
  holo: 'frame-holo shadow-[0_0_14px_rgba(125,211,252,0.6)]',
  crystal: 'bg-gradient-to-br from-fuchsia-300 via-purple-600 to-indigo-950 shadow-[0_0_16px_rgba(168,85,247,0.7)]',
};

export const AVATARS: Record<string, LucideIcon> = {
  cat: Cat,
  rabbit: Rabbit,
  bird: Bird,
  crown: Crown,
  spade: Spade,
  club: Club,
  heart: Heart,
  diamond: Diamond,
  ghost: Ghost,
  skull: Skull,
  rocket: Rocket,
  star: Star,
};

export const AVATAR_COLORS = ['#c98b6b', '#6fa596', '#c9ae6b', '#8fa878', '#9a88c4', '#c48aa6', '#6f9cc4', '#d96c6c', '#e2e8f0'];

// ---------------------------------------------------------------------------
// Nur für dich sichtbar: Kartenrücken, Filzfarbe, Konfetti. Freigeschaltet durch einzelne Erfolge.
// ---------------------------------------------------------------------------

export interface Unlockable {
  key: string;
  name: string;
  /** Erfolg, der es freischaltet (ohne = von Anfang an) */
  unlock?: string;
}

export const CARD_BACKS: (Unlockable & { a: string; b: string; frame: string })[] = [
  { key: 'blue', name: 'Klassisch blau', a: '#1d4f8f', b: '#ffffff', frame: '#1d4f8f' },
  { key: 'red', name: 'Rot', unlock: 'ersterSieg', a: '#a3162e', b: '#ffffff', frame: '#a3162e' },
  { key: 'green', name: 'Waldgrün', unlock: 'fuchsjaeger', a: '#1f6b45', b: '#ffffff', frame: '#1f6b45' },
  { key: 'purple', name: 'Violett', unlock: 'doppelkopf', a: '#5b2a86', b: '#ffffff', frame: '#5b2a86' },
  { key: 'gold', name: 'Schwarz-Gold', unlock: 'schwarz', a: '#d9b45a', b: '#111111', frame: '#111111' },
  { key: 'fox', name: 'Fuchs', unlock: 'fuchsbau', a: '#e07a2e', b: '#fff4e6', frame: '#7a3b0e' },
];

/** Rückseite als SVG (Rautenmuster wie die Original-Rückseite) */
export function cardBackSvg(key: string): string {
  const b = CARD_BACKS.find((x) => x.key === key) ?? CARD_BACKS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -168 240 336"><defs><pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${b.b}"/><path d="M3 0L6 3L3 6L0 3Z" fill="${b.a}"/></pattern></defs><rect width="239" height="335" x="-119.5" y="-167.5" rx="12" fill="white"/><rect x="-108" y="-156" width="216" height="312" rx="10" fill="url(#p)" stroke="${b.frame}" stroke-width="3"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const FELTS: Unlockable[] = [
  { key: 'green', name: 'Grün' },
  { key: 'blue', name: 'Nachtblau', unlock: 'stammgast' },
  { key: 'bordeaux', name: 'Bordeaux', unlock: 'gegenDieAlten' },
  { key: 'black', name: 'Schwarz', unlock: 'nachteule' },
];

export const CONFETTI: (Unlockable & { colors: string[]; shape: 'rect' | 'card' | 'star' })[] = [
  { key: 'classic', name: 'Bunt', colors: ['#e8cd85', '#d9b45a', '#6aa8f0', '#ee8a6b', '#e9f0ec', '#8fd3a8'], shape: 'rect' },
  { key: 'cards', name: 'Spielkarten', unlock: 'siegesserie', colors: ['#ffffff', '#ffffff', '#ffffff'], shape: 'card' },
  { key: 'fox', name: 'Füchse', unlock: 'fuchsjagd', colors: ['#e07a2e', '#f4a259', '#fff4e6'], shape: 'rect' },
  { key: 'stars', name: 'Goldsterne', unlock: 'unaufhaltsam', colors: ['#fde68a', '#facc15', '#e8cd85'], shape: 'star' },
];

/** Zusätzliche Reaktionen, durch Erfolge freigeschaltet (alle sehen sie) */
export const EXTRA_REACTIONS: (Unlockable & { label: string })[] = [
  { key: 'hoert', name: 'Hört, hört!', label: 'Hört, hört!', unlock: 'ansager' },
  { key: 'fuchs', name: 'Fuchs!', label: 'Fuchs!', unlock: 'fuchsjaeger' },
  { key: 'brille', name: 'Brille auf', label: 'Brille auf', unlock: 'comeback' },
  { key: 'ehrenrunde', name: 'Ehrenrunde', label: 'Ehrenrunde', unlock: 'dreifachKoenig' },
];
