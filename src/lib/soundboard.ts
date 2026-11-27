import { getPrefs } from './prefs';

/** Soundboard: kurze Meme-Sounds, für alle frei. Namen lassen sich hier anpassen. */
export const SOUNDS: { file: string; label: string }[] = Array.from({ length: 39 }, (_, i) => ({
  file: `meme-${String(i + 1).padStart(2, '0')}.mp3`,
  label: `Sound ${i + 1}`,
}));

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
