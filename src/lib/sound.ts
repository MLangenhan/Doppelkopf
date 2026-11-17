// Soundeffekte, komplett per Web Audio erzeugt (keine Audiodateien).
// Karten: kurzes, gefiltertes Rauschen plus ein leiser dumpfer Schlag.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let volume = 0.6;
let voice = true;
let voiceName = '';

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // Browser erlauben Ton erst nach einer Nutzeraktion; danach läuft der Kontext weiter
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Beim ersten Klick/Tippen freischalten, damit spätere Sounds (z. B. Karten der anderen) hörbar sind
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function configureSound(on: boolean, vol: number, speak = true, speakWith = '') {
  enabled = on;
  volume = vol;
  voice = speak;
  voiceName = speakWith;
  if (master && ctx) master.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.02);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBurst(
  c: AudioContext,
  at: number,
  opts: { filter: BiquadFilterType; freq: number; q: number; gain: number; attack: number; decay: number; sweepTo?: number },
) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = rand(0.9, 1.1);
  const filter = c.createBiquadFilter();
  filter.type = opts.filter;
  filter.frequency.setValueAtTime(opts.freq, at);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, at + opts.attack + opts.decay);
  filter.Q.value = opts.q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain, at + opts.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.attack + opts.decay);
  src.connect(filter).connect(g).connect(master!);
  src.start(at, rand(0, 0.5));
  src.stop(at + opts.attack + opts.decay + 0.05);
}

function thump(c: AudioContext, at: number, gain: number, from = 150, to = 70) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + 0.07);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + 0.12);
}

function tone(c: AudioContext, at: number, freq: number, gain: number, dur: number, type: OscillatorType = 'triangle') {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/**
 * Deutsche Stimmen des Browsers, die natürlich klingenden zuerst: "Natural"/"Online" (Edge, Windows 11),
 * dann "Google" (Chrome), dann die eingebauten Systemstimmen.
 */
export function germanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const rank = (v: SpeechSynthesisVoice) =>
    /natural|neural|online/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : v.localService ? 3 : 2;
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('de'))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export const sound = {
  /** Karte wird auf den Tisch gelegt */
  card(delay = 0) {
    const c = audio();
    if (!c) return;
    const at = c.currentTime + delay;
    noiseBurst(c, at, { filter: 'bandpass', freq: rand(2200, 3200), q: 0.8, gain: 0.9, attack: 0.002, decay: 0.08 });
    noiseBurst(c, at + 0.004, { filter: 'highpass', freq: 5000, q: 0.5, gain: 0.25, attack: 0.001, decay: 0.03 });
    thump(c, at + 0.003, 0.35);
  },

  /** Großer Trumpf knallt auf den Tisch */
  slam() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    noiseBurst(c, at, { filter: 'lowpass', freq: 2400, q: 0.6, gain: 1.2, attack: 0.002, decay: 0.16 });
    noiseBurst(c, at, { filter: 'bandpass', freq: 3200, q: 0.9, gain: 0.7, attack: 0.002, decay: 0.07 });
    thump(c, at, 0.9, 120, 42);
    thump(c, at + 0.01, 0.5, 70, 35);
  },

  /** Austeilen: schnelle Folge leiser Karten */
  deal(count: number) {
    const c = audio();
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const at = c.currentTime + 0.1 + i * 0.06;
      noiseBurst(c, at, { filter: 'bandpass', freq: rand(2800, 3800), q: 1, gain: 0.35, attack: 0.002, decay: 0.05 });
      thump(c, at, 0.1, 180, 90);
    }
  },

  /** Stich wird eingesammelt */
  collect() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    noiseBurst(c, at, { filter: 'bandpass', freq: 900, sweepTo: 3200, q: 0.7, gain: 0.3, attack: 0.09, decay: 0.22 });
    thump(c, at + 0.24, 0.2, 120, 60);
  },

  /** Du bist dran */
  turn() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    tone(c, at, 659.25, 0.09, 0.25, 'sine');
    tone(c, at + 0.11, 987.77, 0.08, 0.35, 'sine');
  },

  /** Ansage (Re, Kontra, keine 90 …): kräftiger Fanfarenstoß, Re hell, Kontra tiefer */
  announce(party: 're' | 'kontra' | null = null) {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    const base = party === 'kontra' ? 392 : 523.25;
    // Zwei Schläge, dann ein gehaltener Dur-Akkord – deutlich hörbar, auch über Gespräch
    thump(c, at, 0.6, 140, 60);
    tone(c, at, base, 0.22, 0.18, 'sawtooth');
    tone(c, at + 0.14, base, 0.22, 0.16, 'sawtooth');
    for (const [f, g] of [[1, 0.2], [1.25, 0.16], [1.5, 0.16], [2, 0.1]] as const) {
      tone(c, at + 0.3, base * f, g, 0.75, f === 2 ? 'sine' : 'triangle');
    }
  },

  /** Ansage vorlesen (Sprachausgabe des Browsers), z. B. "Re!" */
  say(text: string) {
    if (!enabled || !voice || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.volume = Math.min(1, volume * 1.6);
    u.rate = 1.05;
    u.pitch = 1;
    const chosen = germanVoices().find((v) => v.name === voiceName) ?? germanVoices()[0];
    if (chosen) u.voice = chosen;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  },

  /** Reaktionen am Tisch */
  reaction(kind: 'applaus' | 'autsch' | 'glueck' | 'hmm') {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    if (kind === 'applaus') {
      // Viele kurze Klatscher, zufällig verteilt
      for (let i = 0; i < 22; i++) {
        noiseBurst(c, at + rand(0, 0.9), { filter: 'bandpass', freq: rand(1200, 2600), q: 1.2, gain: rand(0.15, 0.35), attack: 0.002, decay: 0.05 });
      }
    } else if (kind === 'autsch') {
      tone(c, at, 660, 0.14, 0.12, 'square');
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, at + 0.1);
      osc.frequency.exponentialRampToValueAtTime(180, at + 0.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at + 0.1);
      g.gain.exponentialRampToValueAtTime(0.16, at + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      osc.connect(g).connect(master!);
      osc.start(at + 0.1);
      osc.stop(at + 0.6);
    } else if (kind === 'glueck') {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(c, at + i * 0.06, f, 0.08, 0.35, 'sine'));
    } else {
      tone(c, at, 196, 0.12, 0.5, 'triangle');
      tone(c, at + 0.25, 174.61, 0.1, 0.5, 'triangle');
    }
  },

  win() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, at + i * 0.09, f, 0.11, 0.4));
  },

  lose() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    tone(c, at, 392, 0.1, 0.35);
    tone(c, at + 0.16, 311.13, 0.1, 0.55);
  },

  /** Nicht erlaubt (z. B. nicht bedient) */
  nope() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    tone(c, at, 220, 0.08, 0.12, 'square');
    tone(c, at + 0.09, 196, 0.07, 0.16, 'square');
  },
};
