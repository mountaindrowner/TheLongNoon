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
 * - **Old voices** wobble slowly, about twice a second, rather than wandering. **Machines** buzz square and
 *   flat, with no breath and no tune.
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
  /** An old voice's slow wobble, as a fraction of pitch (0.03 is plenty). */
  wobble?: number;
  /** Talks with the mouth almost shut: the vowels pulled together and dulled. */
  closed?: boolean;
  /** A machine: square buzz, no breath, no tune. */
  machine?: boolean;
  /** Loudness against the others (1 normal). */
  vol?: number;
}

/** Each speaker's voice, from who they are (tools/cast.json). Anyone missing gets one from their name. */
export const VOICES: Record<string, VoiceProfile> = {
  Juno: { f0: 228, tract: 1.17, breath: 0.22 },
  Kit: { f0: 285, tract: 1.25, breath: 0.18 },
  'Little Juno': { f0: 335, tract: 1.38, breath: 0.2 },
  Tavo: { f0: 300, tract: 1.3, breath: 0.16 },
  Nina: { f0: 315, tract: 1.32, breath: 0.2 },
  'Güero': { f0: 325, tract: 1.35, breath: 0.18 },
  'Hermana Lupe': { f0: 205, tract: 1.12, breath: 0.32, wobble: 0.03 },
  'Abuela Toña': { f0: 212, tract: 1.11, breath: 0.38, wobble: 0.05 },
  'Doña Chayo': { f0: 192, tract: 1.1, breath: 0.14, vol: 1.15 },
  'Doña Fina': { f0: 200, tract: 1.13, breath: 0.2 },
  'Doña Marta': { f0: 214, tract: 1.12, breath: 0.2, wobble: 0.015 },
  'Doña Inés': { f0: 222, tract: 1.16, breath: 0.34, vol: 0.85 },
  'Mamá': { f0: 210, tract: 1.15, breath: 0.24 },
  Traveler: { f0: 204, tract: 1.14, breath: 0.32 },
  'Papá': { f0: 116, tract: 1.0, breath: 0.22 },
  'Rubén': { f0: 108, tract: 0.98, breath: 0.26, closed: true, vol: 0.9 },
  Memo: { f0: 124, tract: 1.0, breath: 0.18 },
  Chuy: { f0: 136, tract: 1.03, breath: 0.16 },
  Benny: { f0: 142, tract: 1.04, breath: 0.16 },
  'Pastor Abel': { f0: 98, tract: 0.92, breath: 0.22 },
  'Don Beto': { f0: 104, tract: 0.96, breath: 0.26, wobble: 0.03 },
  'Abuelo Nacho': { f0: 114, tract: 0.97, breath: 0.36, wobble: 0.05 },
  Scavenger: { f0: 118, tract: 1.0, breath: 0.24, closed: true },
  Neto: { f0: 118, tract: 1.0, breath: 0.24, closed: true },
  Noonrider: { f0: 112, tract: 1.0, breath: 0.1, closed: true },
  NIM: { f0: 150, tract: 1.06, machine: true, vol: 0.8 },
  Keeper: { f0: 360, tract: 1.2, machine: true, wobble: 0.04, vol: 0.7 },
};

/** A voice for anyone without one: a grown man or woman, fixed by the name. */
export function voiceOf(name: string): VoiceProfile {
  const v = VOICES[name];
  if (v) return v;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  const r = (h >>> 0) / 4294967296, woman = r > 0.5, k = (r * 7) % 1;
  return woman ? { f0: 195 + k * 35, tract: 1.1 + k * 0.08, breath: 0.22 } : { f0: 102 + k * 40, tract: 0.95 + k * 0.08, breath: 0.2 };
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
export interface Syllable { at: number; vowel: Vowel; pitch: number; gain: number }

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
      out.set(start + s.i, { at: start + s.i, vowel: vowelOf(s.group), pitch, gain });
    });
  }
  return out;
}

/**
 * Play one syllable now on `dest` (or at `when` on an offline context). `noise` is a buffer of white noise.
 * Each sound runs a little longer than the gap to the next, so they run together into babble.
 */
export function utter(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, v: VoiceProfile, s: Syllable, when = c.currentTime): void {
  const t = when, dur = 0.13, vol = 0.075 * (v.vol ?? 1) * s.gain;
  const tract = v.tract * (v.closed ? 0.94 : 1);
  let [f1, f2, f3] = FORMANTS[s.vowel];
  if (v.closed) { f1 = 300 + (f1 - 300) * 0.55; f2 = 1300 + (f2 - 1300) * 0.5; } // the vowels pulled toward a mumble
  // the buzz: the speaker's pitch, where the syllable sits in its phrase, a nudge, and an old voice's wobble
  const machine = !!v.machine;
  const nudge = machine ? 1 : 1 + (Math.random() - 0.5) * 0.05;
  const f0 = v.f0 * (machine ? 1 : s.pitch) * nudge;
  const src = c.createOscillator();
  src.type = machine ? 'square' : 'sawtooth';
  const N = 9, curve = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const tk = t + (dur * k) / (N - 1);
    const wob = v.wobble ? 1 + v.wobble * Math.sin(tk * 2 * Math.PI * 2.1) : 1;
    curve[k] = f0 * wob * (1 - (machine ? 0 : 0.03) * (k / (N - 1))); // a voice sags a little through a sound
  }
  src.frequency.setValueCurveAtTime(curve, t, dur);
  // the breath: soft noise under the buzz
  const air = c.createBufferSource();
  air.buffer = noise;
  const airG = c.createGain();
  airG.gain.value = machine ? 0 : (v.breath ?? 0.2) * 0.9;
  air.connect(airG);
  // the tube: three bands, louder low, through to a gentle top cut (lower for a shut mouth)
  const mix = c.createGain();
  const top = c.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = v.closed ? 1900 : 4200;
  ([[f1, 90, 1], [f2, 110, 1], [f3, 160, 0.6]] as Array<[number, number, number]>).forEach(([f, bw, g]) => {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * tract;
    bp.Q.value = (f * tract) / (bw * tract);
    const bg = c.createGain();
    bg.gain.value = g;
    src.connect(bp); airG.connect(bp); bp.connect(bg); bg.connect(mix);
  });
  // the shape: swell, hold, let go (not a strike that dies away)
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.03);
  env.gain.setValueAtTime(vol, t + dur * 0.55);
  env.gain.linearRampToValueAtTime(0, t + dur);
  mix.connect(top); top.connect(env); env.connect(dest);
  src.start(t); src.stop(t + dur + 0.02);
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
