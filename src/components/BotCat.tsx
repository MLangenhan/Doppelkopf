import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { type CatMood, useCatGif } from '../lib/giphy';

/** Standard-GIF je Bot (Anton, Berta, Carl): läuft, solange nichts Besonderes passiert */
const DEFAULT_GIFS = [
  'https://media.giphy.com/media/tphCApwvdtC1VJabZ1/giphy.gif',
  'https://media.giphy.com/media/gSQp32H82WETR5EFO6/giphy.gif',
  'https://media.giphy.com/media/NAdEYIRFMCBhMGkXSq/giphy.gif',
];

/** Nur diese Stimmungen ersetzen das Standard-GIF (Aktionen); alles andere zeigt den Standard */
const EVENTS = new Set<CatMood>(['play', 'win', 'lose', 'shock', 'announce']);
/** So lange bleibt ein Ereignis-GIF mindestens stehen */
const MIN_EVENT_MS = 2000;

/** Katzen-GIF in der Kamera eines Bots. GIPHY verlangt den Hinweis "Powered by GIPHY". */
export function BotCat({ mood, bot }: { mood: CatMood; bot: number }) {
  // Ereignis halten: kommt die Stimmung zurück zum Standard, wird frühestens nach 2 Sekunden gewechselt
  const [event, setEvent] = useState<{ mood: CatMood; until: number } | null>(null);
  useEffect(() => {
    if (EVENTS.has(mood)) {
      setEvent({ mood, until: Date.now() + MIN_EVENT_MS });
      return;
    }
    if (!event) return;
    const wait = event.until - Date.now();
    if (wait <= 0) {
      setEvent(null);
      return;
    }
    const t = setTimeout(() => setEvent(null), wait);
    return () => clearTimeout(t);
  }, [mood]); // eslint-disable-line react-hooks/exhaustive-deps

  const gif = useCatGif(event?.mood ?? null, bot);
  const src = event && gif ? gif.mp4 || gif.webp : DEFAULT_GIFS[bot % DEFAULT_GIFS.length];
  const isVideo = !!(event && gif?.mp4);

  return (
    <>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={src}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {isVideo ? (
            <video src={src} autoPlay loop muted playsInline className="h-full w-full object-cover" aria-label={gif?.title} />
          ) : (
            <img src={src} alt={event ? (gif?.title ?? 'Katze') : 'Katze'} className="h-full w-full object-cover" />
          )}
        </motion.div>
      </AnimatePresence>
      <span className="tag pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1 text-[8px] text-white/70">
        Powered by GIPHY
      </span>
    </>
  );
}
