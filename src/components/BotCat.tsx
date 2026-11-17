import { AnimatePresence, motion } from 'motion/react';
import { type CatMood, useCatGif } from '../lib/giphy';

/** Katzen-GIF in der Kamera eines Bots. GIPHY verlangt den Hinweis "Powered by GIPHY". */
export function BotCat({ mood, seed }: { mood: CatMood; seed: number }) {
  const gif = useCatGif(mood, seed);
  if (!gif) return null;
  return (
    <>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={gif.mp4 || gif.webp}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {gif.mp4 ? (
            <video src={gif.mp4} autoPlay loop muted playsInline className="h-full w-full object-cover" aria-label={gif.title} />
          ) : (
            <img src={gif.webp} alt={gif.title} className="h-full w-full object-cover" />
          )}
        </motion.div>
      </AnimatePresence>
      <span className="tag pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1 text-[8px] text-white/70">
        Powered by GIPHY
      </span>
    </>
  );
}
