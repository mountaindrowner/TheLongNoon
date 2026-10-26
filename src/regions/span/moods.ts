import * as THREE from 'three';
import { DAY, NIGHT, type Mood } from '../../engine/mood';

/**
 * The Span's light. The style spec fixes one mood per scene (§5); The Long
 * Noon's clock is the game, so the Span has a mood for each of its phases:
 * LAMP (the evening hour when the oldest person in every house lights the
 * first lantern), NIGHT (the long night, when people live), and WHITE (day:
 * bleached, overhead, lethal; shadows short). How the clock moves between
 * them is a later piece; for now a scene picks one (`?time=lamp|night|white|day`).
 */

export const LAMP: Mood = {
  night: false,
  // the sun is low in the west-southwest, over the viewer's left shoulder, as the spec requires: warm fronts, long shadows
  sun: { color: '#ffb072', intensity: 2.7, from: new THREE.Vector3(-14, 7, 6) },
  hemi: { sky: '#9a8cb8', ground: '#5e4636', intensity: 1.15 },
  fog: { color: '#5c4450', density: 0.02 },
  exposure: 1.2,
  bloom: { strength: 0.6, radius: 0.6, threshold: 0.75 },
  grade: { dull: 1.3, lush: 1.18, vignette: 0.46, shadowTint: [0.88, 0.94, 1.12], highTint: [1.12, 1.0, 0.86] },
  sprite: [1.04, 0.93, 0.87],
};

/** Day in the Span: the white. The sun is high, so shadows are short: "if your shadow's shorter than you are, you're already late." */
export const WHITE: Mood = {
  night: false,
  sun: { color: '#fff3dc', intensity: 4.0, from: new THREE.Vector3(-5, 16, 4) },
  hemi: { sky: '#e6e2d6', ground: '#a8946e', intensity: 1.35 },
  fog: { color: '#eee4cc', density: 0.02 },
  exposure: 1.12,
  bloom: { strength: 0.38, radius: 0.6, threshold: 0.93 }, // high threshold: the White Bowl is near-white and would bloom whole
  grade: { dull: 1.55, lush: 1.08, vignette: 0.3, shadowTint: [0.95, 0.97, 1.03], highTint: [1.06, 1.03, 0.96] },
  sprite: [1.15, 1.12, 1.06],
};

/** The long night in the Span: the engine's night with a stronger moon and thinner haze, so the empty
 *  roads read as shapes in blue (methodology §5.3: lantern pools, moon, deep blue shadows) rather than as a blank. */
export const SPAN_NIGHT: Mood = {
  ...NIGHT,
  sun: { color: '#9ab4e4', intensity: 1.25, from: new THREE.Vector3(-8, 14, 5) },
  hemi: { sky: '#2c4470', ground: '#12141a', intensity: 0.7 },
  fog: { color: '#121c30', density: 0.024 },
};

export const MOODS: Record<string, Mood> = { lamp: LAMP, night: SPAN_NIGHT, white: WHITE, day: DAY };
