import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { FX_LABELS, type FxKey, HAND_SORT_LABELS, type HandSort, setAllFx, setFx, usePrefs } from '../lib/prefs';
import { useAllCardOrders } from '../lib/cardOrder';
import { germanVoices, sound } from '../lib/sound';

const SHORTCUTS: [string[], string][] = [
  [['←', '→'], 'Karte wählen'],
  [['Leertaste'], 'Gewählte Karte ausspielen, eigenen Stich nehmen, Auswertung überspringen bzw. nächstes Spiel'],
  [['Enter', '↑'], 'Gewählte Karte ausspielen (bei der Armut: Karte auswählen)'],
  [['Esc', '↓'], 'Auswahl aufheben, Dialoge schließen'],
  [['Tab'], 'Zu Knöpfen wie Ansage oder Vorbehalt springen'],
  [['S'], 'Sortierung der Hand wechseln'],
  [['P'], 'Punkte und Regeln ein- und ausblenden'],
  [['1', '2', '3', '4'], 'Reaktion: Applaus, Autsch, Glück gehabt, Hmm'],
];

const PAD: [string[], string][] = [
  [['←', '→'], 'Karte wählen (Steuerkreuz oder linker Stick)'],
  [['↑', '↓'], 'Zum vorigen / nächsten Knopf (Ansage, Vorbehalt, Dialoge)'],
  [['A'], 'Markierten Knopf drücken, sonst wie Leertaste: ausspielen, Stich nehmen, weiter'],
  [['B'], 'Zurück: Auswahl aufheben, Dialog schließen'],
  [['LB', 'RB'], 'Sortierung wechseln'],
  [['Start'], 'Punkte und Regeln'],
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPref] = usePrefs();
  const cardOrders = useAllCardOrders();
  // Stimmen lädt der Browser erst nach und nach
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => germanVoices());
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const update = () => setVoices(germanVoices());
    window.speechSynthesis.addEventListener('voiceschanged', update);
    update();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
            className="panel max-h-full w-full max-w-md overflow-y-auto p-5 sm:p-6"
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

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Doppelkopf lernen</h3>
            <Toggle
              checked={prefs.highlightPlayable}
              onChange={(v) => setPref('highlightPlayable', v)}
              label="Spielbare Karten hervorheben"
              hint="Aus: Alle Karten sehen gleich aus."
            />
            <Toggle
              checked={prefs.cardGuide}
              onChange={(v) => setPref('cardGuide', v)}
              label="Kartenübersicht anzeigen"
              hint="Trumpf-Reihenfolge und Augen, rechts zwischen den Kameras."
            />
            <Toggle
              checked={prefs.explain}
              onChange={(v) => setPref('explain', v)}
              label="Spiel erklären"
              hint="Bei jedem eigenen Zug und nach jedem Stich."
            />
            <Toggle
              checked={prefs.spectatorLearn === 'ask'}
              onChange={(v) => setPref('spectatorLearn', v ? 'ask' : 'off')}
              label="Beim Zuschauen fragen, ob ich lernen möchte"
              hint="Zu Rundenbeginn, wenn du zuschaust."
            />

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Ton</h3>
            <Toggle
              checked={prefs.sound}
              onChange={(v) => setPref('sound', v)}
              label="Sounds"
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

            {prefs.sound && (
              <Toggle
                checked={prefs.voice}
                onChange={(v) => {
                  setPref('voice', v);
                  // kurz warten, bis die Einstellung bei der Sprachausgabe angekommen ist
                  if (v) setTimeout(() => sound.say('Re!'), 60);
                }}
                label="Ansagen vorlesen"
                hint="Mit der Sprachausgabe des Browsers."
              />
            )}
            {prefs.sound && prefs.voice && (
              <div className="flex items-center gap-3 px-2 pt-1 pb-2">
                <label htmlFor="voice" className="text-sm text-white/70">
                  Stimme
                </label>
                <select
                  id="voice"
                  className="input flex-1 py-1.5 text-sm"
                  value={prefs.voiceName}
                  onChange={(e) => {
                    setPref('voiceName', e.target.value);
                    setTimeout(() => sound.say('Re!'), 60);
                  }}
                >
                  <option value="">Automatisch{voices[0] ? ` (${voices[0].name})` : ''}</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => sound.say('Kontra!')}>
                  Anhören
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 px-2 pt-1 pb-2">
              <label htmlFor="soundboard" className="text-sm text-white/70">
                Soundboard
              </label>
              <input
                id="soundboard"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.soundboardVolume}
                onChange={(e) => setPref('soundboardVolume', Number(e.target.value))}
                className="flex-1 accent-gold-400"
              />
              <span className="tag w-12 text-right text-[10px] text-white/55">
                {prefs.soundboardVolume > 0 ? Math.round(prefs.soundboardVolume * 100) : 'stumm'}
              </span>
            </div>

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Kartenhand</h3>
            <div className="grid grid-cols-2 gap-1.5 px-2" role="radiogroup" aria-label="Sortierung">
              {(Object.keys(HAND_SORT_LABELS) as HandSort[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={prefs.handSort === k}
                  onClick={() => setPref('handSort', k)}
                  className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                    prefs.handSort === k ? 'bg-white/15 text-white ring-1 ring-gold-400/60' : 'bg-white/5 text-white/65 hover:text-white'
                  }`}
                >
                  {HAND_SORT_LABELS[k]}
                </button>
              ))}
            </div>
            <p className="px-2 pt-1.5 text-xs text-white/50">
              Zieh Karten in der Hand an ihren Platz – daraus wird deine eigene Reihenfolge. Normalspiel und jedes Solo
              merken sich ihre eigene Reihenfolge, gespeichert mit deinem Konto.
            </p>
            {cardOrders.any && (
              <button type="button" className="btn-ghost tag mx-2 mt-1 px-2 py-1 text-[10px]" onClick={cardOrders.reset}>
                Eigene Reihenfolgen zurücksetzen
              </button>
            )}

            <div className="mt-5 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-white/50 uppercase">Effekte</h3>
              <span className="flex gap-1">
                <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setAllFx(true)}>
                  Alle an
                </button>
                <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setAllFx(false)}>
                  Alle aus
                </button>
              </span>
            </div>
            {reduced && (
              <p className="mb-1 px-2 text-xs text-gold-300">
                Dein System wünscht reduzierte Bewegung – Effekte bleiben deshalb aus.
              </p>
            )}
            {(Object.keys(FX_LABELS) as FxKey[]).map((k) => (
              <Toggle
                key={k}
                checked={prefs.fx[k]}
                onChange={(v) => setFx(k, v)}
                label={FX_LABELS[k].label}
                hint={FX_LABELS[k].hint}
              />
            ))}

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Tastatur</h3>
            <KeyList items={SHORTCUTS} />
            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Controller</h3>
            <p className="mb-2 px-2 text-xs text-white/50">
              Xbox-, PlayStation- oder Switch-Controller per USB oder Bluetooth. Der Browser erkennt ihn nach dem ersten Knopfdruck.
            </p>
            <KeyList items={PAD} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KeyList({ items }: { items: [string[], string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-2 text-sm">
      {items.map(([keys, what]) => (
        <div key={what} className="contents">
          <dt className="flex gap-1">
            {keys.map((k) => (
              <kbd key={k} className="tag rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/80">
                {k}
              </kbd>
            ))}
          </dt>
          <dd className="text-white/65">{what}</dd>
        </div>
      ))}
    </dl>
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
  hint?: string;
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
        {hint && <span className="block text-white/55">{hint}</span>}
      </span>
    </label>
  );
}
