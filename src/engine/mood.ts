import * as THREE from 'three';
import type { PostFX } from './post';

/**
 * Per-scene lighting. Day or night is FIXED per scene (no clock) — Mark,
 * 2026-10-22. The Field is a late, golden afternoon; `?time=night` previews
 * the same diorama after dark for comparison.
 */
export interface Mood {
  night: boolean;
  sun: { color: string; intensity: number; from: THREE.Vector3 };
  hemi: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  grade: { dull: number; lush: number; vignette: number; shadowTint: [number, number, number]; highTint: [number, number, number] };
  /** Flat-lit sprite brightness (the frame is tonemapped as a whole). */
  sprite: [number, number, number];
}

export const DAY: Mood = {
  night: false,
  // low sun from the west-southwest, over the viewer's left shoulder: fronts catch the light, long shadows fall north-east
  sun: { color: '#ffd09a', intensity: 3.4, from: new THREE.Vector3(-13, 10.5, 6.5) },
  hemi: { sky: '#a9c2d8', ground: '#5a5232', intensity: 1.05 },
  fog: { color: '#cdb895', density: 0.016 },
  exposure: 1.05,
  bloom: { strength: 0.42, radius: 0.55, threshold: 0.85 },
  grade: { dull: 1.35, lush: 1.2, vignette: 0.42, shadowTint: [0.9, 0.97, 1.08], highTint: [1.07, 1.0, 0.9] },
  sprite: [1.1, 1.05, 0.98],
};

export const NIGHT: Mood = {
  night: true,
  sun: { color: '#8aa6d8', intensity: 0.85, from: new THREE.Vector3(-8, 14, 5) },
  hemi: { sky: '#22365a', ground: '#0b0d12', intensity: 0.55 },
  fog: { color: '#101a2c', density: 0.03 },
  exposure: 1.15,
  bloom: { strength: 0.9, radius: 0.6, threshold: 0.6 },
  grade: { dull: 1.25, lush: 1.1, vignette: 0.55, shadowTint: [0.85, 0.95, 1.18], highTint: [1.12, 1.0, 0.86] },
  sprite: [0.6, 0.68, 0.95],
};

/** Underground: no sky. A faint cool wash from the vent shafts for shadow
 *  shape; the real light is the colony's own lamps (a pooled set of point
 *  lights the area moves to whichever lamps are near the camera). */
export const UNDER: Mood = {
  night: true,
  sun: { color: '#a8b8d0', intensity: 0.5, from: new THREE.Vector3(-5, 14, 7) },
  hemi: { sky: '#5a6070', ground: '#2a231b', intensity: 1.35 },
  fog: { color: '#07080b', density: 0.014 },
  exposure: 1.25,
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.7 },
  grade: { dull: 1.25, lush: 1.2, vignette: 0.58, shadowTint: [0.86, 0.94, 1.12], highTint: [1.12, 1.0, 0.86] },
  sprite: [0.9, 0.84, 0.8],
};

/** The Cistern: cool green-blue water light under the vaults, warm lamps
 *  and the nursery's soft glow doing the real work. */
export const CISTERN: Mood = {
  night: true,
  sun: { color: '#9fd0c8', intensity: 0.55, from: new THREE.Vector3(-4, 14, 6) },
  hemi: { sky: '#6a8a84', ground: '#2a3a32', intensity: 2.1 },
  fog: { color: '#06100f', density: 0.012 },
  exposure: 1.45,
  bloom: { strength: 0.75, radius: 0.6, threshold: 0.68 },
  grade: { dull: 1.2, lush: 1.25, vignette: 0.56, shadowTint: [0.84, 0.98, 1.06], highTint: [1.1, 1.02, 0.88] },
  sprite: [0.86, 0.9, 0.86],
};

export interface Lights {
  sun: THREE.DirectionalLight;
  follow(target: THREE.Vector3): void;
  /** Re-light the scene with another mood (a clock moving the light). */
  set(m: Mood): void;
}

const col = new THREE.Color(), col2 = new THREE.Color();
const mixHex = (a: string, b: string, t: number): string => '#' + col.set(a).lerp(col2.set(b), t).getHexString();
const mixN = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)];

/** A mood part way from `a` to `b`. `night` (which lamps a scene was built with) is taken from `a`. */
export function mixMood(a: Mood, b: Mood, t: number): Mood {
  if (t <= 0) return a;
  if (t >= 1) return { ...b, night: a.night };
  return {
    night: a.night,
    sun: { color: mixHex(a.sun.color, b.sun.color, t), intensity: mixN(a.sun.intensity, b.sun.intensity, t), from: a.sun.from.clone().lerp(b.sun.from, t) },
    hemi: { sky: mixHex(a.hemi.sky, b.hemi.sky, t), ground: mixHex(a.hemi.ground, b.hemi.ground, t), intensity: mixN(a.hemi.intensity, b.hemi.intensity, t) },
    fog: { color: mixHex(a.fog.color, b.fog.color, t), density: mixN(a.fog.density, b.fog.density, t) },
    exposure: mixN(a.exposure, b.exposure, t),
    bloom: { strength: mixN(a.bloom.strength, b.bloom.strength, t), radius: mixN(a.bloom.radius, b.bloom.radius, t), threshold: mixN(a.bloom.threshold, b.bloom.threshold, t) },
    grade: {
      dull: mixN(a.grade.dull, b.grade.dull, t), lush: mixN(a.grade.lush, b.grade.lush, t), vignette: mixN(a.grade.vignette, b.grade.vignette, t),
      shadowTint: mix3(a.grade.shadowTint, b.grade.shadowTint, t), highTint: mix3(a.grade.highTint, b.grade.highTint, t),
    },
    sprite: mix3(a.sprite, b.sprite, t),
  };
}

/** A day's light as keyframes: [minute of the day, mood]. Minutes wrap at 1440; keys in order from any start. */
export type MoodKeys = Array<[number, Mood]>;
export function moodAt(keys: MoodKeys, minute: number): Mood {
  const m = ((minute % 1440) + 1440) % 1440;
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const [ta, a] = keys[i]!, [tb0, b] = keys[(i + 1) % n]!;
    const tb = tb0 <= ta ? tb0 + 1440 : tb0;
    const mm = m < ta ? m + 1440 : m;
    if (mm >= ta && mm <= tb) return mixMood(a, b, tb === ta ? 0 : (mm - ta) / (tb - ta));
  }
  return keys[0]![1];
}

/** Exposure, bloom and grade for a mood — re-applied when returning from a battle stage. */
export function moodPost(renderer: THREE.WebGLRenderer, post: PostFX, m: Mood): void {
  renderer.toneMappingExposure = m.exposure;
  post.bloom.strength = m.bloom.strength;
  post.bloom.radius = m.bloom.radius;
  post.bloom.threshold = m.bloom.threshold;
  const g = post.grade.uniforms;
  g.dull!.value = m.grade.dull;
  g.lush!.value = m.grade.lush;
  g.vignette!.value = m.grade.vignette;
  (g.shadowTint!.value as THREE.Color).setRGB(...m.grade.shadowTint);
  (g.highTint!.value as THREE.Color).setRGB(...m.grade.highTint);
}

export function applyMood(scene: THREE.Scene, renderer: THREE.WebGLRenderer, post: PostFX, m: Mood): Lights {
  const fog = new THREE.FogExp2(m.fog.color, m.fog.density);
  scene.background = new THREE.Color(m.fog.color);
  scene.fog = fog;
  renderer.toneMappingExposure = m.exposure;

  const hemi = new THREE.HemisphereLight(m.hemi.sky, m.hemi.ground, m.hemi.intensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(m.sun.color, m.sun.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 15;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  moodPost(renderer, post, m);

  const texel = (S * 2) / 2048;
  return {
    sun,
    set(next) {
      m = next;
      (scene.background as THREE.Color).set(m.fog.color);
      fog.color.set(m.fog.color);
      fog.density = m.fog.density;
      hemi.color.set(m.hemi.sky);
      hemi.groundColor.set(m.hemi.ground);
      hemi.intensity = m.hemi.intensity;
      sun.color.set(m.sun.color);
      sun.intensity = m.sun.intensity;
      moodPost(renderer, post, m);
    },
    follow(target) {
      // keep the shadow frustum centred on the player, snapped to shadow texels so edges don't shimmer
      const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
      sun.target.position.set(tx, 0, tz);
      sun.position.set(tx + m.sun.from.x, m.sun.from.y, tz + m.sun.from.z);
    },
  };
}
