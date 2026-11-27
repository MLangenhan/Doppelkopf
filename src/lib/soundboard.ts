import { getPrefs } from './prefs';

/** Soundboard: kurze Meme-Sounds, für alle frei. Namen lassen sich hier anpassen. */
const NAMES = [
  'God Damn!',
  'Spawn',
  'Metal Pipe Falling',
  'Undertakers Bell',
  'Travis Scott',
  'Mentality',
  'PS2 Startup',
  'French',
  'Bass Drop',
  'Windows 95',
  'Windows XP',
  'Windows XP Shutdown',
  'English or Spanish',
  'Flashbang',
  'Siren',
  'Among Us',
  'Long Brain Fart',
  'Gay Echo',
  'Mewing',
  'Get out',
  'Glass Breaking',
  'RDR2 Low Honor',
  'Grandma House',
  'Collect Gold',
  'Slow Motion',
  'Spongebob Walking',
  'I be poppin bottles',
  'Depressed Penguin',
  'Super Idol',
  'Fortnite Shield Pot',
  'Don Pollo Ahh Sound',
  'Dark Piano Dexter',
  'Optimus Prime',
  'Hells Kitchen Suspense',
  'Bone Crack',
  'Magic Spells',
  'Laugh Toy World',
  'You Are My Sunshine',
  'Fahh',
];

export const SOUNDS: { file: string; label: string }[] = NAMES.map((label, i) => ({
  file: `meme-${String(i + 1).padStart(2, '0')}.mp3`,
  label,
}));

/** Tasten 1–9 und 0 (Index 0–9) → Sound-Index oder null */
export const HOTKEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const cache = new Map<number, HTMLAudioElement>();

/** Spielt einen Sound mit der eingestellten Soundboard-Lautstärke (0 = stumm) */
export function playBoardSound(idx: number) {
  const s = SOUNDS[idx];
  const vol = getPrefs().soundboardVolume;
  if (!s || vol <= 0) return;
  let base = cache.get(idx);
  if (!base) {
    base = new Audio(`${import.meta.env.BASE_URL}sounds/${s.file}`);
    base.preload = 'auto';
    cache.set(idx, base);
  }
  // Eigene Kopie, damit derselbe Sound sich überlagern darf
  const a = base.cloneNode(true) as HTMLAudioElement;
  a.volume = Math.min(1, Math.max(0, vol));
  void a.play().catch(() => {});
}
