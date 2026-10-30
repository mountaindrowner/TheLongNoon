/**
 * Mumble speech: people "talk" in vowel sounds built from the line as it types, nothing recorded.
 *
 * - **The voice** is a buzz (the vocal folds) with a little breath in it, through three bands of pitch (the
 *   throat and mouth, a tube). The bands are a vowel's formants, from the old speech research (Peterson and
 *   Barney's averages for a grown man). A shorter tube (`tract` > 1) moves all three up together: a woman, a
 *   child. Each sound swells, holds and lets go, and no two buzzes are quite alike.
 * - **The text** decides what plays. A sound starts only where a group of vowels starts, about one a
 *   syllable, and its first letter picks the vowel, so a line sounds the same every time it's said.
 * - **The tune** comes from the punctuation already in the line: the pitch drifts down through a phrase and
 *   starts again at each comma; a question rises on its last word; an exclamation starts high; trailing dots
 *   fade out; a word in capitals is shouted.
 * - **Who's talking** sets the rest: old voices wobble slowly, about twice a second, rather than wandering; a
 *   hard life rasps; some talk through the nose, some barely above a whisper, some fast, some in a drawl, some
 *   flat and some all over the place; a visor or a speaker thins a voice. **Machines** buzz square and flat,
 *   with no breath.
 *
 * The idea and the method follow a devlog on mumble speech the owner shared (2026-10-30).
 */

export interface VoiceProfile {
  /** The buzz, Hz (a grown man ~110, a woman ~210, a child ~300). */
  f0: number;
  /** Tube length as a scale on the formants: 1 a grown man, ~1.15 a woman, ~1.3 a child, under 1 a big man. */
  tract: number;
  /** Air in the voice, 0–1. */
  breath?: number;
  /** A slow wobble in the pitch, as a fraction of it (0.03 is plenty): an old voice. */
  wobble?: number;
  /** How fast it wobbles, Hz (default 2.1: age; 5–6 is a shiver, a fever). */
  wobbleHz?: number;
  /** Gravel: a rough, creaking buzz (0–1). A hard life, a smoker's throat, a fever. */
  rasp?: number;
  /** Through the nose (0–1). */
  nasal?: number;
  /** Mostly air, little buzz (0–1): a whisper, somebody practising not being heard. */
  whisper?: number;
  /** Talks with the mouth almost shut: the vowels pulled together and dulled. */
  closed?: boolean;
  /** Brightness of the top end (1 normal; under 1 dark and warm, over 1 sharp). */
  bright?: number;
  /** How far the tune moves (1 normal; 0.3 flat and controlled, 1.6 all over the place). */
  range?: number;
  /** A sing-song rise and fall from syllable to syllable (0–0.1). */
  lilt?: number;
  /** Speed (1 normal): the typing and the sounds both; a drawl under 1, a chatterbox over. */
  rate?: number;
  /** Heard through a visor, a speaker or a radio: thin, and a little broken. */
  radio?: boolean;
  /** A machine: square buzz, no breath, no tune of its own unless `range` gives it one. */
  machine?: boolean;
  /** The buzz's wave, over the default (sawtooth; square for a machine): 'sine' is smooth, too smooth. */
  wave?: OscillatorType;
  /** Sounds that drop out (0–1): a failing machine. */
  dropout?: number;
  /** Loudness against the others (1 normal). */
  vol?: number;
}

/**
 * Each speaker's voice, from who they are (tools/cast.json, the prologue's dialogue): age and build set the
 * pitch and the tube, the person sets the rest. Anyone missing gets a voice from their name.
 */
export const VOICES: Record<string, VoiceProfile> = {
  // the young: Juno steady and low for her age, Kit never stops, Güero barely there
  Juno: { f0: 214, tract: 1.16, breath: 0.24, range: 0.85 },
  Kit: { f0: 292, tract: 1.25, breath: 0.16, rate: 1.25, range: 1.45, bright: 1.15 },
  'Little Juno': { f0: 340, tract: 1.38, breath: 0.2, range: 1.4 },
  Tavo: { f0: 305, tract: 1.3, breath: 0.14, rate: 1.15, range: 1.3, bright: 1.1 },
  Nina: { f0: 318, tract: 1.32, breath: 0.2, range: 0.9, lilt: 0.03 },
  'Güero': { f0: 330, tract: 1.35, breath: 0.3, whisper: 0.55, vol: 0.8, range: 0.8 },
  // the old: slow, wobbling, each their own way
  'Hermana Lupe': { f0: 200, tract: 1.12, breath: 0.3, wobble: 0.03, rate: 0.85, range: 0.8, bright: 0.9 },
  'Abuela Toña': { f0: 212, tract: 1.11, breath: 0.4, wobble: 0.05, rate: 0.8, whisper: 0.2, lilt: 0.03 },
  'Don Beto': { f0: 102, tract: 0.95, breath: 0.24, wobble: 0.025, rasp: 0.35, rate: 0.85, range: 1.35 },
  'Abuelo Nacho': { f0: 116, tract: 0.97, breath: 0.38, wobble: 0.055, rate: 0.75, rasp: 0.2 },
  // the market and the well: Chayo sells, Fina is plain, Marta is glad of you
  'Doña Chayo': { f0: 188, tract: 1.09, breath: 0.12, vol: 1.15, lilt: 0.06, rate: 1.1, range: 1.25, nasal: 0.25 },
  'Doña Fina': { f0: 198, tract: 1.13, breath: 0.2, range: 0.8 },
  'Doña Marta': { f0: 218, tract: 1.12, breath: 0.18, wobble: 0.015, lilt: 0.05, bright: 1.1, range: 1.3 },
  'Doña Inés': { f0: 224, tract: 1.16, breath: 0.36, whisper: 0.25, vol: 0.85, rate: 0.95 },
  'Mamá': { f0: 208, tract: 1.15, breath: 0.24, lilt: 0.02 },
  Traveler: { f0: 200, tract: 1.14, breath: 0.34, rasp: 0.15, rate: 0.9 },
  // the men: tired, quiet, laconic, warm
  'Papá': { f0: 114, tract: 1.0, breath: 0.26, range: 0.85, rate: 0.95 },
  'Rubén': { f0: 106, tract: 0.98, breath: 0.26, closed: true, vol: 0.9, range: 0.6 },
  Memo: { f0: 122, tract: 1.0, breath: 0.16, range: 0.55, rate: 0.95, rasp: 0.1 },
  Chuy: { f0: 138, tract: 1.03, breath: 0.14, rate: 1.15, nasal: 0.2, bright: 1.1 },
  Benny: { f0: 146, tract: 1.05, breath: 0.16, bright: 1.15, range: 1.25, rate: 1.1 },
  'Pastor Abel': { f0: 96, tract: 0.91, breath: 0.22, bright: 0.85, rate: 0.85, range: 0.9 },
  // the mall: a scavenger mutters through his nose
  Scavenger: { f0: 120, tract: 1.0, breath: 0.22, closed: true, nasal: 0.45, rasp: 0.25 },
  Neto: { f0: 128, tract: 1.01, breath: 0.24, closed: true, nasal: 0.35, rate: 1.1 },
  // through a visor
  Noonrider: { f0: 110, tract: 1.0, breath: 0.1, radio: true, range: 0.4, rasp: 0.15 },
  // machines: NIM a bright child of a machine, the Keeper's cracked speaker keening
  NIM: { f0: 236, tract: 1.22, machine: true, range: 1.5, bright: 1.2, rate: 1.1, vol: 0.75 },
  Keeper: { f0: 360, tract: 1.2, machine: true, wave: 'sine', wobble: 0.04, wobbleHz: 3.2, radio: true, lilt: 0.05, range: 0.6, vol: 0.75 },
};

/** A voice for anyone without one: a grown man or woman, fixed by the name. */
export function voiceOf(name: string): VoiceProfile {
  const v = VOICES[name];
  if (v) return v;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  const r = (h >>> 0) / 4294967296, woman = r > 0.5, k = (r * 7) % 1, q = (r * 13) % 1;
  const base = woman ? { f0: 195 + k * 35, tract: 1.1 + k * 0.08 } : { f0: 102 + k * 40, tract: 0.95 + k * 0.08 };
  return { ...base, breath: 0.16 + q * 0.16, rate: 0.9 + q * 0.2, range: 0.8 + k * 0.4 };
}

type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';
/** First three formants (Hz) of each vowel, a grown man's. */
const FORMANTS: Record<Vowel, [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

/** One sound in a line: where it falls, which vowel, its pitch against the speaker's, how loud. */
export interface Syllable { at: number; vowel: Vowel; pitch: number; gain: number; /** its place in the phrase */ k?: number }

const VOWEL = /[aeiouyáéíóúü]/i;
const fold = (c: string): string => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** The vowel a group of letters sounds like, mostly from its first letter. */
function vowelOf(group: string): Vowel {
  const g = fold(group);
  if (g.startsWith('oo') || g.startsWith('ou')) return 'u';
  if (g.startsWith('ee') || g.startsWith('ea') || g.startsWith('ie')) return 'i';
  if (g.startsWith('ai') || g.startsWith('ay') || g.startsWith('ei')) return 'e';
  if (g.startsWith('oa')) return 'o';
  const c = g[0]!;
  return c === 'y' ? 'i' : (c as Vowel);
}

/**
 * Where a line's sounds fall and how each is pitched (char index → syllable). Phrases end at punctuation;
 * within one the pitch drifts down; its end mark shapes the tune.
 */
export function planLine(text: string): Map<number, Syllable> {
  const out = new Map<number, Syllable>();
  // phrases: runs of text up to and including their marks
  const re = /[^,;:—.?!…]+([,;:—.?!…]+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const start = m.index, body = m[0], mark = m[1] ?? '';
    const ask = mark.includes('?'), cry = mark.includes('!'), trail = mark.includes('…') || mark.includes('..');
    // syllable starts: a vowel letter after a non-vowel; 'y' only inside a word; a silent final e skipped
    const at: Array<{ i: number; group: string; word: [number, number] }> = [];
    for (let i = 0; i < body.length; i++) {
      const c = body[i]!, prev = body[i - 1] ?? ' ';
      if (!VOWEL.test(c) || VOWEL.test(prev)) continue;
      if ((c === 'y' || c === 'Y') && !/\p{L}/u.test(prev)) continue;
      let j = i;
      while (j < body.length && VOWEL.test(body[j]!)) j++;
      let w0 = i, w1 = j;
      while (w0 > 0 && /[\p{L}']/u.test(body[w0 - 1]!)) w0--;
      while (w1 < body.length && /[\p{L}']/u.test(body[w1]!)) w1++;
      const word = body.slice(w0, w1);
      if (fold(body[i]!) === 'e' && j === w1 && j - i === 1 && word.length > 3 && at.some((s) => s.word[0] === w0)) continue;
      at.push({ i, group: body.slice(i, j), word: [w0, w1] });
    }
    const n = at.length;
    const lastWord = at.length ? at[at.length - 1]!.word[0] : -1;
    at.forEach((s, k) => {
      const t = n > 1 ? k / (n - 1) : 0;
      let pitch = (cry ? 1.14 : 1.05) - (cry ? 0.16 : 0.11) * t;
      let gain = 1;
      if (ask && s.word[0] === lastWord) pitch += 0.12 + 0.12 * t;
      if (trail) { gain *= 1 - 0.55 * t; pitch -= 0.04 * t; }
      const word = body.slice(s.word[0], s.word[1]);
      if (word.length > 1 && word === word.toUpperCase() && /\p{Lu}/u.test(word)) { pitch *= 1.22; gain *= 1.55; }
      out.set(start + s.i, { at: start + s.i, vowel: vowelOf(s.group), pitch, gain, k });
    });
  }
  return out;
}

/** A soft-clip curve for voices heard through something (a visor, a speaker). */
let clipCurve: Float32Array | null = null;
const clip = (): Float32Array => {
  if (clipCurve) return clipCurve;
  clipCurve = new Float32Array(257);
  for (let i = 0; i < 257; i++) { const x = (i - 128) / 128; clipCurve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
  return clipCurve;
};

/**
 * Play one syllable now on `dest` (or at `when` on an offline context). `noise` is a buffer of white noise.
 * Each sound runs a little longer than the gap to the next, so they run together into babble.
 */
export function utter(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, v: VoiceProfile, s: Syllable, when = c.currentTime): void {
  if (v.dropout && Math.random() < v.dropout) return;
  const rate = v.rate ?? 1, machine = !!v.machine;
  const t = when, dur = 0.13 / Math.sqrt(rate), vol = 0.075 * (v.vol ?? 1) * s.gain;
  const tract = v.tract * (v.closed ? 0.94 : 1);
  let [f1, f2, f3] = FORMANTS[s.vowel];
  if (v.closed) { f1 = 300 + (f1 - 300) * 0.55; f2 = 1300 + (f2 - 1300) * 0.5; } // the vowels pulled toward a mumble
  // the buzz: the speaker's pitch, the phrase's tune (as wide as they speak), a lilt, a nudge, a wobble
  const range = v.range ?? (machine ? 0 : 1);
  const lilt = v.lilt ? 1 + v.lilt * Math.sin((s.k ?? 0) * 1.9) : 1;
  const nudge = machine ? 1 : 1 + (Math.random() - 0.5) * 0.05;
  const f0 = v.f0 * (1 + (s.pitch - 1) * range) * lilt * nudge;
  const rasp = v.rasp ?? 0;
  const src = c.createOscillator();
  src.type = v.wave ?? (machine ? 'square' : 'sawtooth');
  const N = 12, curve = new Float32Array(N), wHz = v.wobbleHz ?? 2.1;
  for (let k = 0; k < N; k++) {
    const tk = t + (dur * k) / (N - 1);
    const wob = v.wobble ? 1 + v.wobble * Math.sin(tk * 2 * Math.PI * wHz) : 1;
    const grit = rasp ? 1 + (Math.random() - 0.5) * 0.06 * rasp : 1; // a rough voice never holds a pitch
    curve[k] = f0 * wob * grit * (1 - (machine ? 0 : 0.03) * (k / (N - 1))); // and every voice sags a little
  }
  src.frequency.setValueCurveAtTime(curve, t, dur);
  const buzz = c.createGain();
  buzz.gain.value = 1 - (v.whisper ?? 0) * 0.92;
  src.connect(buzz);
  // gravel: the folds catching every other cycle, a buzz an octave down under the voice
  let sub: OscillatorNode | null = null;
  if (rasp) {
    sub = c.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueCurveAtTime(curve.map((f) => f / 2), t, dur);
    const sg = c.createGain();
    sg.gain.value = rasp * 0.55;
    sub.connect(sg); sg.connect(buzz);
  }
  // the breath: soft noise under the buzz (most of a whisper)
  const air = c.createBufferSource();
  air.buffer = noise;
  const airG = c.createGain();
  airG.gain.value = machine ? 0 : ((v.breath ?? 0.2) * 0.9 + (v.whisper ?? 0) * 1.6 + rasp * 0.15);
  air.connect(airG);
  // the tube: three bands, louder low (and through the nose, a low hum and a hollow in the middle)
  const mix = c.createGain();
  const nasal = v.nasal ?? 0;
  const bands: Array<[number, number, number]> = [[f1, 90, 1 - nasal * 0.45], [f2, 110, 1], [f3, 160, 0.6]];
  if (nasal) bands.push([260, 70, nasal * 1.3]);
  for (const [f, bw, g] of bands) {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * tract;
    bp.Q.value = f / bw;
    const bg = c.createGain();
    bg.gain.value = g;
    buzz.connect(bp); airG.connect(bp); bp.connect(bg); bg.connect(mix);
  }
  let node: AudioNode = mix;
  if (nasal) {
    const hollow = c.createBiquadFilter();
    hollow.type = 'peaking'; hollow.frequency.value = 1000 * tract; hollow.Q.value = 2; hollow.gain.value = -10 * nasal;
    node.connect(hollow); node = hollow;
  }
  // the top end: a gentle cut, lower for a shut mouth, moved by brightness
  const top = c.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = (v.closed ? 1900 : 4200) * (v.bright ?? 1);
  node.connect(top); node = top;
  // through a visor or a speaker: only the middle gets through, a little broken
  if (v.radio) {
    const lo = c.createBiquadFilter(); lo.type = 'highpass'; lo.frequency.value = 450;
    const hi = c.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 2700;
    const pre = c.createGain(); pre.gain.value = 6;
    const sh = c.createWaveShaper(); sh.curve = clip() as Float32Array<ArrayBuffer>;
    const post = c.createGain(); post.gain.value = 0.22;
    node.connect(lo); lo.connect(hi); hi.connect(pre); pre.connect(sh); sh.connect(post); node = post;
  }
  // the shape: swell, hold, let go (not a strike that dies away)
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.03);
  env.gain.setValueAtTime(vol, t + dur * 0.55);
  env.gain.linearRampToValueAtTime(0, t + dur);
  node.connect(env); env.connect(dest);
  src.start(t); src.stop(t + dur + 0.02);
  sub?.start(t); sub?.stop(t + dur + 0.02);
  air.start(t, Math.random() * Math.max(0, noise.duration - dur - 0.1)); air.stop(t + dur + 0.02);
}

/** How long the typing waits after a character: a beat at a comma, longer at the end of a sentence. */
export function pauseAfter(text: string, i: number, base: number): number {
  const c = text[i]!, next = text[i + 1];
  const end = next === undefined || next === ' ' || next === '"' || next === '”' || next === ')';
  if (c === '…') return base * 9;
  if ((c === '.' || c === '?' || c === '!') && end) return text[i - 1] === '.' && c === '.' ? base * 4 : base * 6;
  if ((c === ',' || c === ';' || c === ':' || c === '—') && end) return base * 3;
  if (c === '—') return base * 3;
  return base;
}
