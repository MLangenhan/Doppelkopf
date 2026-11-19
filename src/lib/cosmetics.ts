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
