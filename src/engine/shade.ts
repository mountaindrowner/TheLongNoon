/**
 * Is a point in the sun's shadow? Read straight from the sun's shadow map, so the answer is exactly the shadow the
 * player sees on the ground: walls, sails, trees, people. One pixel, read a few times a second.
 *
 * three.js packs each shadow-map texel's depth into RGBA (`packDepthToRGBA`, most significant byte in red).
 */
import * as THREE from 'three';

const v = new THREE.Vector3();
const px = new Uint8Array(4);
/** The last sample's shadow depth and the point's own depth, then the raw bytes (for checks). */
export let last: number[] = [];
/** How much nearer the sun something must be to count as shade, in shadow depth (about 0.15 units). */
const BIAS = 0.0025;

/** True in shade, false in sun, null when the point is outside the shadow map (or there's no map yet). */
export function shadedFromSun(renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, p: THREE.Vector3): boolean | null {
  const map = sun.shadow.map;
  if (!map || !sun.castShadow) return null;
  const cam = sun.shadow.camera;
  v.copy(p).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
  if (Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98 || v.z < -1 || v.z > 1) return null;
  const x = Math.floor((v.x * 0.5 + 0.5) * map.width), y = Math.floor((v.y * 0.5 + 0.5) * map.height);
  try { renderer.readRenderTargetPixels(map, x, y, 1, 1, px); } catch { return null; }
  const occluder = px[0]! / 256 + px[1]! / 65536 + px[2]! / 16777216 + px[3]! / 255 / 16777216;
  last = [occluder, v.z * 0.5 + 0.5, ...px];
  return occluder < v.z * 0.5 + 0.5 - BIAS;
}
