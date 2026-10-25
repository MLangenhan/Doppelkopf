// Soundeffekte, komplett per Web Audio erzeugt (keine Audiodateien).
// Karten: kurzes, gefiltertes Rauschen plus ein leiser dumpfer Schlag.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let volume = 0.6;

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

export function configureSound(on: boolean, vol: number) {
  enabled = on;
  volume = vol;
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

  /** Ansage (Re, Kontra, keine 90 …) */
  announce() {
    const c = audio();
    if (!c) return;
    const at = c.currentTime;
    tone(c, at, 523.25, 0.12, 0.35);
    tone(c, at + 0.08, 783.99, 0.12, 0.45);
    tone(c, at + 0.16, 1046.5, 0.08, 0.5, 'sine');
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
