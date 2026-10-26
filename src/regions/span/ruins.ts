import * as THREE from 'three';
import { T, Pix } from '../../engine/textures';
import { box, beam, cyl, colMat, texMat, shade } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { rng, vnoise } from '../../engine/noise';
import { building, windowAt, M, type Built, type DoorSpec } from '../../engine/buildings';
import { batch } from '../../engine/batch';
import { blockWall } from './props';
import { spanDoor, type SpanDoor } from './doors';

/**
 * The Span's homes (owner, 2026-10-26: "a pieced-together village from the
 * ruins"). Nobody here builds new; they patch. A house is whatever stood,
 * mended with what was lying around: block walls with a tin panel where the
 * block fell, a plywood corner, a shipping container with a door cut in it,
 * a tarp over the bad half of the roof held down with tires, a lean-to on
 * the front for shade. Salvage fences close the yards: tin sheet, pallets,
 * car hoods, an old door.
 */

type RGB = [number, number, number];
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const cache = new Map<string, THREE.Material>();
const mat = (k: string, make: () => THREE.Material): THREE.Material => { let m = cache.get(k); if (!m) { m = make(); cache.set(k, m); } return m; };

/** Container steel, ribbed, in a faded colour with rust coming through. */
function ribTex(base: string): THREE.Texture {
  const S = 32, p = new Pix(S, S), r = rng(base.length * 31 + base.charCodeAt(2));
  const c0 = H(base);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rib = x % 4;
    const k = rib === 0 ? 0.7 : rib === 1 ? 1.08 : 0.95;
    let c: RGB = [c0[0] * k, c0[1] * k, c0[2] * k];
    if (vnoise(x * 0.2, y * 0.25, 911) > 0.72) c = [120 * k, 66 * k, 38 * k]; // rust
    if (r() < 0.03) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    p.set(x, y, c);
  }
  return p.texture();
}
/** Faded tarp cloth with a hem and fold creases. */
function tarpTex(base: string): THREE.Texture {
  const S = 32, p = new Pix(S, S);
  const c0 = H(base);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = vnoise(x * 0.15, y * 0.15, 913);
    let c: RGB = [c0[0] * (0.85 + n * 0.25), c0[1] * (0.85 + n * 0.25), c0[2] * (0.85 + n * 0.25)];
    if (x % 16 === 0 || y % 16 === 0) c = [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82];
    p.set(x, y, c);
  }
  return p.texture();
}
/** Stucco, once painted, the colour sun-bleached to a ghost of itself. */
function stuccoTex(base: string): THREE.Texture {
  const S = 32, p = new Pix(S, S), r = rng(base.charCodeAt(1) * 7);
  const c0 = H(base);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = vnoise(x * 0.3, y * 0.3, 917);
    let c: RGB = [c0[0] * (0.9 + n * 0.15), c0[1] * (0.9 + n * 0.15), c0[2] * (0.9 + n * 0.15)];
    if (vnoise(x * 0.12, y * 0.12, 918) > 0.74) c = [168, 160, 146]; // paint gone, render showing
    if (r() < 0.02) c = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
    p.set(x, y, c);
  }
  return p.texture();
}

export type Patch = 'block' | 'tin' | 'ply' | 'stucco' | 'container';
const CONTAINER = ['#7a3a2e', '#3e5a6e', '#4e6a4a', '#8a6a32', '#6a6e72'];
const STUCCO = ['#c8a888', '#b8c0b0', '#d0b890', '#c09888', '#a8b8c0'];
const TARP = ['#3e6a9a', '#c8742e', '#4e7a4a', '#8a8a8a', '#a84a3a'];
export const R = {
  block: (v: number) => mat('block' + v, () => texMat('block-mat' + v, blockWall(v))),
  tin: () => M.tin(),
  ply: () => M.wood(),
  stucco: (i: number) => mat('stucco' + i, () => new THREE.MeshStandardMaterial({ map: stuccoTex(STUCCO[i % STUCCO.length]!), roughness: 1 })),
  container: (i: number) => mat('ctr' + i, () => new THREE.MeshStandardMaterial({ map: ribTex(CONTAINER[i % CONTAINER.length]!), metalness: 0.3, roughness: 0.65 })),
  tarp: (i: number) => mat('tarp' + i, () => new THREE.MeshStandardMaterial({ map: tarpTex(TARP[i % TARP.length]!), roughness: 0.9, side: THREE.DoubleSide })),
  tire: () => mat('tire', () => colMat('#1e1c1a', { roughness: 0.95 })),
  hood: (i: number) => mat('hood' + i, () => colMat(['#6a2a24', '#2e4a6a', '#8a8a82', '#4a5a3a'][i % 4]!, { metalness: 0.4, roughness: 0.55 })),
};
const patchMat = (p: Patch, k: number): THREE.Material => (p === 'block' ? R.block(k % 3) : p === 'tin' ? R.tin() : p === 'ply' ? R.ply() : p === 'stucco' ? R.stucco(k) : R.container(k));

export interface HouseSpec {
  x: number; z: number; w: number; d: number; h: number;
  /** What it was before it was patched. */
  base: Patch;
  /** The front door (x from the centre) and how its light speaks. */
  door?: { x: number; kind: SpanDoor; w?: number };
  windows?: Array<{ x: number; kind: 'glass' | 'lit' | 'boarded' }>;
  /** A lean-to on the front for shade. */
  porch?: boolean;
  /** A tarp over part of the roof. */
  tarp?: boolean;
  seed: number;
}

/**
 * A patched house: the base walls, panels of other stuff where they failed,
 * a tin shed roof (a tarp over the worst of it, tires to hold it down), a
 * stovepipe, sometimes a lean-to porch. Returns its door routines.
 */
export function house(scene: THREE.Scene, s: HouseSpec, night: boolean): Built[] {
  const r = rng(s.seed);
  const k = Math.floor(r() * 5);
  const doors: DoorSpec[] = s.door ? [{ x: s.door.x, w: s.door.w, ...spanDoor(s.door.kind, night) }] : [];
  const built = building(scene, {
    x: s.x, z: s.z, w: s.w, d: s.d, h: s.h, wall: patchMat(s.base, k), roof: 'shed', seed: s.seed,
    doors, windows: s.windows?.map((w) => ({ x: w.x, kind: w.kind, w: 0.7, h: 0.7 })),
  }, night);
  const y0 = heightAt(s.x, s.z);
  const g = new THREE.Group();
  g.position.set(s.x, y0, s.z);
  scene.add(g);
  // patches on the front and the sides: where the base gave out, something else holds
  const others: Patch[] = (['block', 'tin', 'ply', 'stucco', 'container'] as Patch[]).filter((p) => p !== s.base && p !== 'container');
  const keepClear = (x: number): boolean => !!s.door && Math.abs(x - s.door.x) < (s.door.w ?? 1.1) / 2 + 0.35 || (s.windows ?? []).some((w) => Math.abs(x - w.x) < 0.55);
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
    const pw = 0.8 + r() * 1.3, ph = s.h * (0.45 + r() * 0.55), px = (r() - 0.5) * (s.w - pw);
    if (keepClear(px - pw / 2) || keepClear(px + pw / 2) || keepClear(px)) continue;
    g.add(box(pw, ph, 0.05, patchMat(others[Math.floor(r() * others.length)]!, k + i), px, r() > 0.5 ? 0 : s.h - ph, s.d / 2 + 0.03));
  }
  for (const sx of [-1, 1]) if (r() > 0.4) {
    const pd = 1 + r() * (s.d - 1.2), ph = s.h * (0.5 + r() * 0.5);
    g.add(box(0.05, ph, pd, patchMat(others[Math.floor(r() * others.length)]!, k + 3), sx * (s.w / 2 + 0.03), 0, (r() - 0.5) * (s.d - pd)));
  }
  // the roof: a tarp over part of it, tires holding the tarp down, a stovepipe
  if (s.tarp ?? r() > 0.4) {
    const tw = s.w * (0.4 + r() * 0.35), tx = (r() - 0.5) * (s.w - tw);
    const t = box(tw, 0.03, s.d + 0.5, R.tarp(k), tx, s.h + 0.12, 0.1);
    t.rotation.x = 0.16;
    g.add(t);
    for (let i = 0; i < 2; i++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 6, 10), R.tire());
      tire.rotation.x = Math.PI / 2 + 0.16;
      tire.position.set(tx + (i - 0.5) * tw * 0.5, s.h + 0.24 - (i - 0.5) * 0.15, (i - 0.5) * s.d * 0.4);
      g.add(tire);
    }
  }
  g.add(cyl(0.07, 0.07, 1.0, M.steel(), s.w / 2 - 0.5, s.h, -s.d / 4, 6));
  // a lean-to porch: tin on two posts, for the shade
  if (s.porch) {
    const pw = Math.min(s.w - 0.4, 3.4), pz = s.d / 2 + 1.0;
    const px = s.door ? s.door.x : 0;
    for (const sx of [-1, 1]) g.add(box(0.09, s.h * 0.72, 0.09, M.wood(), px + sx * pw / 2, 0, pz + 0.6));
    const roof = box(pw + 0.4, 0.05, 2.1, M.tin(), px, s.h * 0.74, pz - 0.05);
    roof.rotation.x = 0.12;
    g.add(roof);
    addSolid(s.x + px - pw / 2 - 0.08, s.z + pz + 0.5, s.x + px - pw / 2 + 0.08, s.z + pz + 0.7);
    addSolid(s.x + px + pw / 2 - 0.08, s.z + pz + 0.5, s.x + px + pw / 2 + 0.08, s.z + pz + 0.7);
  }
  shade(g);
  return built;
}

/** A shipping container someone lives in: a door cut in the side, a window, a tarp, tires on top. */
export function containerHome(scene: THREE.Scene, x: number, z: number, rot: 0 | 1, door: SpanDoor | null, night: boolean, seed: number): Built[] {
  const r = rng(seed);
  const L = 6.1, W = 2.45, Hh = 2.6;
  const k = Math.floor(r() * CONTAINER.length);
  const [w, d] = rot ? [W, L] : [L, W];
  return house(scene, { x, z, w, d, h: Hh, base: 'container', door: door ? { x: (r() - 0.5) * (w - 2.2), kind: door } : undefined, windows: [{ x: w / 2 - 0.7, kind: door && door !== 'shut' && door !== 'boarded' && night ? 'lit' : 'boarded' }], tarp: r() > 0.5, seed: seed * 7 + k }, night);
}

/** A salvage fence along a polyline: tin sheets, pallets, car hoods, the odd door, on posts. Solid. */
export function salvageFence(scene: THREE.Scene, pts: Array<[number, number]>, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.25));
    const ang = Math.atan2(bz - az, bx - ax);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const g = new THREE.Group();
      g.position.set(x, heightAt(x, z), z);
      g.rotation.y = -ang;
      const kind = r();
      const pw = L / n + 0.05;
      if (kind < 0.42) g.add(box(pw, 1.5 + r() * 0.3, 0.04, R.tin(), 0, 0, 0));
      else if (kind < 0.66) { for (let s = 0; s < 4; s++) g.add(box(pw * 0.92, 0.12, 0.05, M.wood(), 0, 0.15 + s * 0.32, 0)); g.add(box(0.1, 1.3, 0.1, M.wood(), -pw * 0.3, 0, 0.05)); g.add(box(0.1, 1.3, 0.1, M.wood(), pw * 0.3, 0, 0.05)); }
      else if (kind < 0.86) { const h = box(pw, 1.2, 0.06, R.hood(Math.floor(r() * 4)), 0, 0.15, 0); h.rotation.z = (r() - 0.5) * 0.1; g.add(h); }
      else g.add(box(Math.min(pw, 0.95), 1.95, 0.06, M.grey(), 0, 0, 0));
      g.add(box(0.08, 1.7, 0.08, M.steel(), -pw / 2, 0, 0.05));
      g.rotation.z = (r() - 0.5) * 0.06;
      scene.add(batch(shade(g)));
    }
    const pad = 0.12;
    addSolid(Math.min(ax, bx) - pad, Math.min(az, bz) - pad, Math.max(ax, bx) + pad, Math.max(az, bz) + pad);
  }
}

/** A water tank on a stand (plastic, the colour gone chalky): every yard has one. */
export function yardTank(scene: THREE.Scene, x: number, z: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) g.add(box(0.1, 1.0, 0.1, M.wood(), sx * 0.5, 0, sz * 0.5));
  g.add(box(1.3, 0.1, 1.3, M.wood(), 0, 1.0, 0));
  g.add(cyl(0.62, 0.62, 1.3, colMat(r() > 0.5 ? '#2a2c2a' : '#8a9aa0', { roughness: 0.8 }), 0, 1.1, 0, 12));
  scene.add(batch(shade(g)));
  addSolid(x - 0.65, z - 0.65, x + 0.65, z + 0.65);
}

/** A cook fire ring of stones with a grate; ash, a pot. */
export function fireRing(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(box(0.22, 0.16, 0.2, M.concrete(), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)); }
  g.add(box(0.7, 0.03, 0.6, M.steel(), 0, 0.2, 0));
  g.add(cyl(0.16, 0.13, 0.22, colMat('#2a2622', { metalness: 0.5 }), 0.1, 0.23, 0, 10));
  scene.add(batch(shade(g)));
  addSolid(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
}

/** Rubble from what didn't stand: block, rebar, a slab corner. */
export function rubble(scene: THREE.Scene, x: number, z: number, s: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  for (let i = 0; i < 6; i++) {
    const b = box((0.3 + r() * 0.5) * s, (0.15 + r() * 0.25) * s, (0.25 + r() * 0.4) * s, i % 3 ? M.concrete() : R.block(i % 3), (r() - 0.5) * 1.4 * s, -0.05, (r() - 0.5) * 1.0 * s);
    b.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    g.add(b);
  }
  for (let i = 0; i < 3; i++) g.add(beam(new THREE.Vector3((r() - 0.5) * s, 0.1, (r() - 0.5) * s), new THREE.Vector3((r() - 0.5) * 1.6 * s, 0.5 + r() * 0.6, (r() - 0.5) * s), 0.03, M.rust()));
  scene.add(batch(shade(g)));
  addSolid(x - 0.7 * s, z - 0.5 * s, x + 0.7 * s, z + 0.5 * s);
}

/** A wall left standing from something bigger, alone: block with a window hole, patched with nothing. */
export function ruinWall(scene: THREE.Scene, x: number, z: number, w: number, h: number, rot: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rot;
  const m = R.block(seed % 3);
  const hole = w * (0.25 + r() * 0.2);
  g.add(box((w - hole) / 2, h, 0.22, m, -(w + hole) / 4, 0, 0));
  g.add(box((w - hole) / 2, h * (0.6 + r() * 0.4), 0.22, m, (w + hole) / 4, 0, 0));
  g.add(box(hole, h * 0.35, 0.22, m, 0, 0, 0));
  scene.add(batch(shade(g)));
  const c = Math.cos(rot), sn = Math.sin(rot);
  const hx = Math.abs(c) * w / 2 + 0.15, hz = Math.abs(sn) * w / 2 + 0.15;
  addSolid(x - hx, z - hz, x + hx, z + hz);
}

export { windowAt, T };
