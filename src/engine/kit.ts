import * as THREE from 'three';
import { Pix, T, textTexture } from './textures';
import { rng, fbm, vnoise } from './noise';
import { box, cyl, beam, boxGeo, cylGeo, texMat, colMat, shade } from './geo';
import { addSolid } from './world';

/**
 * Ohmstead's interior kit: the metal bomb-shelter look Mark set for the
 * colony (big riveted floor plates, thick steel walls), plus the furniture
 * and lamps that make it lived-in. Everything sits on a flat floor at y = 0.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

export const C = {
  steel: hex('#566068'),
  steelLight: hex('#7c8790'),
  steelDark: hex('#2b3136'),
  plate: hex('#68727a'),
  rust: hex('#7c4424'),
  rustLight: hex('#a8622e'),
  grime: hex('#23211d'),
  hazard: hex('#d2a22a'),
  moss: hex('#4f7a2c'),
  mossLight: hex('#7aa83c'),
  black: hex('#0b0c0e'),
};

const cache = new Map<string, THREE.Texture>();
const once = (k: string, make: () => THREE.Texture): THREE.Texture => {
  let t = cache.get(k);
  if (!t) { t = make(); cache.set(k, t); }
  return t;
};

// ------------------------------------------------------------- textures

/** Wall panels: 1-unit riveted plates, a seam at 1.2, a dark kick plate. 2×3 units. */
function wallTex(): THREE.Texture {
  return once('ohm-wall', () => {
    const W = 32, H = 48, p = new Pix(W, H), r = rng(51);
    const tone = [0.95, 1.05, 0.9, 1.0];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const up = H - 1 - y; // texels above the floor
        const panel = Math.floor(x / 16) + (up >= 19 ? 2 : 0);
        let c = mul(C.steel, tone[panel % 4]! * (0.94 + vnoise(x * 0.5, y * 0.5, 52) * 0.1));
        // seams: vertical every unit, horizontal at 1.2 units, kick plate below 0.5
        const vx = x % 16;
        if (vx === 0) c = C.steelDark;
        else if (vx === 1) c = mul(C.steelLight, 0.95);
        if (up === 19) c = C.steelDark;
        if (up === 20) c = mul(C.steelLight, 0.92);
        if (up < 8) c = mul(C.steel, 0.62 + (up === 7 ? 0.25 : 0));
        if (up < 8 && (x + up) % 8 < 1) c = mul(C.steel, 0.5); // tread lines
        // rivets beside seams
        if ((vx === 3 || vx === 13) && (up % 6 === 3) && up > 8) c = up === 9 ? C.steelLight : mix(C.steelLight, C.steel, 0.3);
        // rust streaks bleeding down from the seams, grime rising from the floor
        const streak = vnoise(x * 1.1, y * 0.08, 53);
        if (streak > 0.8 && up > 6) c = mix(c, C.rust, (streak - 0.8) * 3);
        const grime = fbm(x * 0.15, y * 0.15, 54, 3);
        if (up < 14) c = mix(c, C.grime, Math.max(0, (14 - up) / 14) * 0.45 * grime);
        if (r() < 0.01) c = mul(c, 0.8);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** Wall tops: the black of the rock beyond — a cut wall draws a crisp dark
 *  outline round the lit room, the way HD-2D interiors read. */
function capTex(): THREE.Texture {
  return once('ohm-cap', () => {
    const S = 16, p = new Pix(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const c = mul(hex('#121417'), 0.85 + vnoise(x * 0.6, y * 0.6, 55) * 0.3);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** Rough rock: the Yard's dig face. */
function rockTex(): THREE.Texture {
  return once('ohm-rock', () => {
    const S = 32, p = new Pix(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const n = fbm(x * 0.18, y * 0.18, 56, 3);
        let c = mix(hex('#3a3430'), hex('#6a5e52'), n);
        if (Math.abs(fbm(x * 0.12, y * 0.12, 57, 2) - 0.5) < 0.025) c = hex('#1e1a17');
        if (n > 0.7) c = mix(c, hex('#8a7a66'), 0.5);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** World-space UVs (triplanar by face normal): instanced walls of any height
 *  keep the same texel density, so a wall can drop low without its panels squashing. */
export function worldUV(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_MAP
      {
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
        im = instanceMatrix;
        #endif
        vec3 wp = (modelMatrix * im * vec4(transformed, 1.0)).xyz;
        vec3 wn = abs(normalize(mat3(modelMatrix * im) * objectNormal));
        vec2 w = wn.y > 0.5 ? wp.xz : (wn.x > 0.5 ? wp.zy : wp.xy);
        vMapUv = (mapTransform * vec3(w, 1.0)).xy;
      }
      #endif`);
  };
  m.customProgramCacheKey = () => 'worldUV';
  return m;
}

export const KM = {
  wall: (): THREE.MeshStandardMaterial => texMat('ohm-wall-mat', wallTex(), { metalness: 0.35, roughness: 0.7 }),
  cap: (): THREE.MeshStandardMaterial => texMat('ohm-cap-mat', capTex(), { roughness: 1 }),
  rock: (): THREE.MeshStandardMaterial => texMat('ohm-rock-mat', rockTex(), { roughness: 1 }),
  steel: (): THREE.MeshStandardMaterial => texMat('steel', T.steel(), { metalness: 0.35, roughness: 0.65 }),
  rust: (): THREE.MeshStandardMaterial => texMat('rustTank', T.rustTank(), { metalness: 0.25, roughness: 0.7 }),
  wood: (): THREE.MeshStandardMaterial => texMat('oldWood', T.oldWood()),
  deck: (): THREE.MeshStandardMaterial => texMat('deck', T.deck()),
  concrete: (): THREE.MeshStandardMaterial => texMat('concrete', T.concrete()),
  hazard: (): THREE.MeshStandardMaterial => texMat('hazard', T.hazard()),
  dark: (): THREE.MeshStandardMaterial => colMat('#101113', { roughness: 1 }),
  paintRed: (): THREE.MeshStandardMaterial => colMat('#8a2e24', { roughness: 0.6, metalness: 0.3 }),
  paintGreen: (): THREE.MeshStandardMaterial => colMat('#3f5a3c', { roughness: 0.7, metalness: 0.2 }),
  paintBlue: (): THREE.MeshStandardMaterial => colMat('#34506a', { roughness: 0.7, metalness: 0.2 }),
  cloth: (hexc: string): THREE.MeshStandardMaterial => colMat(hexc, { roughness: 1, side: THREE.DoubleSide }),
  vine: (): THREE.MeshStandardMaterial => texMat('vines', T.vines(), { alphaTest: 0.5, side: THREE.DoubleSide }),
  leaves: (): THREE.MeshStandardMaterial => texMat('leaves-flat', T.leaves(), { roughness: 0.95, flatShading: true }),
};

/** Wall + cap materials for the instanced walls (world-space UVs). */
export function wallMaterials(rock = false): THREE.Material[] {
  const side = worldUV(new THREE.MeshStandardMaterial({ map: rock ? rockTex() : wallTex(), metalness: rock ? 0 : 0.35, roughness: rock ? 1 : 0.7 }));
  const cap = worldUV(new THREE.MeshStandardMaterial({ map: capTex(), roughness: 1 }));
  // BoxGeometry groups: +x, -x, +y (cap), -y, +z, -z
  return [side, side, cap, cap, side, side];
}

// --------------------------------------------------------------- floor

/** Paint the colony floor: 2×2 riveted plates, scuffed walk-lines, oil and
 *  rust, hazard paint at thresholds, moss pushing up through the seams. */
export function paintFloor(cols: number, rows: number, floor: (x: number, z: number) => boolean, extra: (x: number, z: number, c: RGB) => RGB): THREE.CanvasTexture {
  const S = 16, W = cols * S, H = rows * S;
  const p = new Pix(W, H);
  const r = rng(77);
  const plateTone = new Map<number, number>();
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / S, z = (py + 0.5) / S;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!floor(cx, cz)) { p.set(px, py, C.black); continue; }
      const bx = Math.floor(x / 2), bz = Math.floor(z / 2), key = bz * 1000 + bx;
      let tone = plateTone.get(key);
      if (tone === undefined) { tone = 0.86 + r() * 0.22; plateTone.set(key, tone); }
      const u = px % 32, v = py % 32;
      let c = mul(C.plate, tone * (0.95 + vnoise(px * 0.4, py * 0.4, 61) * 0.08));
      // diamond tread on alternate plates
      if ((bx + bz) % 3 === 0 && (u + v) % 6 === 0) c = mul(c, 1.18);
      if ((bx + bz) % 3 === 0 && (u - v + 64) % 6 === 0) c = mul(c, 0.86);
      // seams + bevel highlight, corner rivets
      if (u === 0 || v === 0) c = C.steelDark;
      else if (u === 1 || v === 1) c = mul(C.steelLight, tone * 0.9);
      if ((u === 3 || u === 29) && (v === 3 || v === 29)) c = C.steelLight;
      if ((u === 4 || u === 30) && (v === 4 || v === 30)) c = C.steelDark;
      // grime, oil, rust blooms
      const g = fbm(x * 0.35, z * 0.35, 62, 3);
      c = mix(c, C.grime, Math.max(0, g - 0.5) * 0.7);
      if (fbm(x * 0.6, z * 0.6, 63, 2) > 0.85) c = mix(c, hex('#1f1c17'), 0.4);
      const ru = fbm(x * 0.25, z * 0.25, 64, 3);
      if (ru > 0.66) c = mix(c, ru > 0.74 ? C.rust : C.rustLight, Math.min(1, (ru - 0.66) * 4) * 0.7);
      // moss and tiny leaves in the seams near the edges of rooms
      if ((u <= 1 || v <= 1) && fbm(x * 0.3, z * 0.3, 65, 2) > 0.7 && vnoise(px * 0.7, py * 0.7, 66) > 0.55) c = r() < 0.5 ? C.moss : C.mossLight;
      p.set(px, py, extra(x, z, c));
    }
  const t = p.texture({ repeat: false, worldSize: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
export { hex as kitHex, mix as kitMix, mul as kitMul };
export type { RGB };

// -------------------------------------------------------------- lamps

export interface Lamp { pos: THREE.Vector3; color: THREE.Color; intensity: number; dist: number; flicker?: number }

/** A small pool of point lights moved each frame to the lamps nearest the
 *  camera — dozens of lamps for the price of a few lights. */
export class LightPool {
  private readonly lights: THREE.PointLight[] = [];
  private readonly lamps: Lamp[] = [];
  constructor(scene: THREE.Scene, n = 10) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 6, 1.7);
      scene.add(l);
      this.lights.push(l);
    }
  }
  add(l: Lamp): void { this.lamps.push(l); }
  update(t: number, focus: THREE.Vector3): void {
    const near = this.lamps
      .map((l) => ({ l, d: (l.pos.x - focus.x) ** 2 + ((l.pos.z - focus.z) * 1.3) ** 2 }))
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((light, i) => {
      const e = near[i];
      if (!e) { light.intensity = 0; return; }
      const { l } = e;
      light.position.copy(l.pos);
      light.color.copy(l.color);
      light.distance = l.dist;
      const fl = l.flicker ? 1 - l.flicker * (0.5 + 0.5 * Math.sin(t * 23 + l.pos.x * 7) * Math.sin(t * 5.1 + l.pos.z)) : 1;
      // fade with distance so a light handed to a new lamp doesn't pop
      const fade = THREE.MathUtils.clamp(1.6 - Math.sqrt(e.d) / 11, 0, 1);
      light.intensity = l.intensity * fl * fade;
    });
  }
}

function glow(hexc: string, intensity: number): THREE.MeshStandardMaterial {
  return colMat(hexc, { emissive: hexc, emissiveIntensity: intensity, roughness: 0.4 });
}

/** A caged bulb on a wall bracket (+z facing wall at z), pooled light. */
export function wallLamp(g: THREE.Object3D, pool: LightPool, x: number, z: number, y = 2.1, warm = true): void {
  g.add(box(0.1, 0.1, 0.32, KM.steel(), x, y + 0.1, z + 0.16));
  g.add(box(0.26, 0.05, 0.26, KM.steel(), x, y + 0.2, z + 0.36));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow(warm ? '#ffcf7a' : '#bfe8ff', 5));
  bulb.position.set(x, y + 0.08, z + 0.36);
  g.add(bulb);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#202428', wireframe: true }));
  cage.position.set(x, y + 0.08, z + 0.36);
  g.add(cage);
  pool.add({ pos: new THREE.Vector3(x, y, z + 0.7), color: new THREE.Color(warm ? '#ffb35c' : '#9ad8ff'), intensity: warm ? 11 : 8, dist: 8, flicker: Math.random() < 0.12 ? 0.6 : 0 });
}

/** A pendant lamp hanging on a cord from the dark overhead. */
export function pendant(g: THREE.Object3D, pool: LightPool, x: number, z: number, warm = true, y = 2.5): void {
  g.add(box(0.015, 3.5, 0.015, colMat('#111214'), x, y + 0.2, z));
  const sh = new THREE.Mesh(cylGeo(0.07, 0.3, 0.2, 10, true), colMat('#3d5248', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }));
  sh.position.set(x, y + 0.1, z);
  g.add(sh); // no shadow: a shade's blot on the floor reads as a hole
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow(warm ? '#ffd590' : '#cfeeff', 5));
  bulb.position.set(x, y - 0.02, z);
  g.add(bulb);
  pool.add({ pos: new THREE.Vector3(x, y - 0.1, z), color: new THREE.Color(warm ? '#ffb35c' : '#9ad8ff'), intensity: warm ? 10 : 7, dist: 7 });
}
