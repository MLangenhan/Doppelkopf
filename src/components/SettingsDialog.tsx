import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { usePrefs } from '../lib/prefs';
import { sound } from '../lib/sound';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPref] = usePrefs();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <motion.div
            className="panel w-full max-w-md p-6"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="settings-title" className="text-lg font-semibold">
                Einstellungen
              </h2>
              <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Schließen">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-white/55">Gilt nur für dich, in diesem Browser.</p>

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Spielhilfen</h3>
            <Toggle
              checked={prefs.highlightPlayable}
              onChange={(v) => setPref('highlightPlayable', v)}
              label="Spielbare Karten hervorheben"
              hint="Ausgeschaltet spielst du ohne Hilfe: Alle Karten sehen gleich aus. Wer nicht bedient, bekommt einen Hinweis und muss eine andere Karte wählen."
            />

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Ton</h3>
            <Toggle
              checked={prefs.sound}
              onChange={(v) => setPref('sound', v)}
              label="Sounds"
              hint="Karten ausspielen, Stich einsammeln, Ansagen, wenn du dran bist und am Spielende."
            />
            {prefs.sound && (
              <div className="flex items-center gap-3 px-2 pt-1 pb-2">
                <label htmlFor="volume" className="text-sm text-white/70">
                  Lautstärke
                </label>
                <input
                  id="volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.volume}
                  onChange={(e) => setPref('volume', Number(e.target.value))}
                  onPointerUp={() => sound.card()}
                  onKeyUp={() => sound.card()}
                  className="flex-1 accent-gold-400"
                />
                <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => sound.card()}>
                  Testen
                </button>
              </div>
            )}

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Darstellung</h3>
            <Toggle
              checked={prefs.effects}
              onChange={(v) => setPref('effects', v)}
              label="Effekte"
              hint="3D-Karten auf der Startseite und Partikel hinter dem Tisch. Bei reduzierter Bewegung im System bleiben sie immer aus."
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-white/5">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/20 transition peer-checked:bg-gold-400 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-300
          after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4"
      />
      <span className="text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="block text-white/55">{hint}</span>
      </span>
    </label>
  );
}
