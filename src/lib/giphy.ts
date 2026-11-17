import { useEffect, useState } from 'react';

// Katzen-GIFs für die Kameras der Bots, von GIPHY. Braucht einen (öffentlichen) GIPHY-API-Schlüssel
// in VITE_GIPHY_API_KEY; ohne Schlüssel bleibt es beim Avatar.

const KEY = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) ?? '';
export const giphyEnabled = KEY.length > 0;

/** Stimmungen eines Bots und wonach dafür bei GIPHY gesucht wird */
export type CatMood = 'idle' | 'think' | 'play' | 'win' | 'lose' | 'shock' | 'announce' | 'solo';

const QUERIES: Record<CatMood, string> = {
  idle: 'cat waiting bored',
  think: 'cat thinking confused',
  play: 'cat slap paw',
  win: 'happy cat celebrate',
  lose: 'grumpy cat sad',
  shock: 'shocked cat',
  announce: 'cat screaming',
  solo: 'cool cat sunglasses',
};

export interface CatGif {
  /** Kleines MP4 (spart Daten), dazu WebP als Ersatz */
  mp4: string;
  webp: string;
  title: string;
}

const cache = new Map<CatMood, Promise<CatGif[]>>();

function load(mood: CatMood): Promise<CatGif[]> {
  let p = cache.get(mood);
  if (!p) {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(KEY)}&q=${encodeURIComponent(QUERIES[mood])}&limit=30&rating=g&lang=en&bundle=messaging_non_clips`;
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data?: { title?: string; images?: Record<string, { mp4?: string; webp?: string; url?: string }> }[] }) =>
        (json.data ?? [])
          .map((g) => {
            const img = g.images?.fixed_height ?? g.images?.downsized ?? {};
            return { mp4: img.mp4 ?? '', webp: img.webp ?? img.url ?? '', title: g.title ?? 'Katze' };
          })
          .filter((g) => g.mp4 || g.webp),
      )
      .catch(() => []);
    cache.set(mood, p);
  }
  return p;
}

/** Ein Katzen-GIF passend zur Stimmung; bleibt gleich, solange sich die Stimmung nicht ändert. */
export function useCatGif(mood: CatMood | null, seed: number): CatGif | null {
  const [gif, setGif] = useState<CatGif | null>(null);
  useEffect(() => {
    if (!giphyEnabled || !mood) {
      setGif(null);
      return;
    }
    let alive = true;
    load(mood).then((list) => {
      if (!alive || !list.length) return;
      // Jeder Bot bekommt eine andere Katze, bei jedem Wechsel eine neue
      setGif(list[Math.floor((Math.random() + seed * 0.37) * list.length) % list.length]);
    });
    return () => {
      alive = false;
    };
  }, [mood, seed]);
  return gif;
}
