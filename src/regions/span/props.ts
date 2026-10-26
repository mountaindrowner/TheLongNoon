import * as THREE from 'three';
import { Pix, T, textTexture } from '../../engine/textures';
import { box, boxGeo, cyl, cylGeo, beam, colMat, texMat, shade, planeGeo } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { rng, fbm, vnoise } from '../../engine/noise';
import { blobGeo, leafMat } from '../../engine/foliage';
import { M, vines, type Built } from '../../engine/buildings';

/**
 * The Span's prop kit, built the style spec's way (§7): primitives only,
 * world-unit UVs, silhouette first, chunky trim, wear that tells time.
 * Every machine here that still moves is doing its old job (§11.2).
 */

type RGB = [number, number, number];
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

const tex = new Map<string, THREE.Texture>();
const once = (k: string, make: () => THREE.Texture): THREE.Texture => { let t = tex.get(k); if (!t) { t = make(); tex.set(k, t); } return t; };

/** Prickly-pear pads: waxy green, pale spine dots in a grid, a little sunburn at the rims. */
function nopalTex(): THREE.Texture {
  return once('nopal', () => {
    const S = 32, p = new Pix(S, S), r = rng(301);
    const pal = ['#3f6a2e', '#4d7a35', '#5c8a3c', '#6f9a46'].map(H);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.2, y * 0.2, 302, 3);
      let c = pal[Math.min(3, Math.floor(n * 4 + r() * 0.6))]!;
      if (fbm(x * 0.15, y * 0.15, 303, 2) > 0.7) c = H('#8a8a4a'); // sunburn
      if ((x % 5 === 2) && (y % 5 === (x % 10 < 5 ? 1 : 3))) c = H('#e8e2c0'); // spine areoles
      p.set(x, y, c);
    }
    return p.texture();
  });
}

/** Dead palm thatch: the skirt of old fronds a fan palm keeps. */
function thatchTex(): THREE.Texture {
  return once('thatch', () => {
    const S = 32, p = new Pix(S, S), r = rng(311);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let c: RGB = [138, 112, 74];
      const streak = vnoise(x * 1.3, y * 0.08, 312);
      c = streak > 0.55 ? [164, 136, 92] : streak < 0.3 ? [96, 76, 50] : c;
      if (r() < 0.05) c = [72, 56, 38];
      p.set(x, y, c);
    }
    return p.texture();
  });
}

const sways: Array<{ obj: THREE.Object3D; phase: number; amp: number }> = [];
export function swaySpan(t: number): void { for (const s of sways) s.obj.rotation.z = Math.sin(t * 0.8 + s.phase) * s.amp; }

/**
 * Overhead things (sails, the tank on its tower) fade when the player walks
 * behind them, so a figure is never lost under the scenery: the outdoor
 * cousin of the interior cutaway (spec §10). `rect` is the ground area
 * from which the thing would hide the player.
 */
export interface Occluder { mats: THREE.Material[]; rect: [number, number, number, number]; k: number }
export const occluders: Occluder[] = [];
export function resetSpan(): void { sways.length = 0; occluders.length = 0; }
/** Forget the swaying fronds of maps taken out of the scene (a streamed region drops far maps). */
export function pruneSpan(attached: (o: THREE.Object3D) => boolean): void { for (let i = sways.length - 1; i >= 0; i--) if (!attached(sways[i]!.obj)) sways.splice(i, 1); }
export function fadeOccluders(px: number, pz: number, dt: number): void {
  for (const o of occluders) {
    const [x0, z0, x1, z1] = o.rect;
    const target = px > x0 && px < x1 && pz > z0 && pz < z1 ? 0.28 : 1;
    o.k += (target - o.k) * (1 - Math.exp(-dt * 8));
    for (const m of o.mats) { m.opacity = o.k; m.transparent = o.k < 0.999; m.depthWrite = o.k > 0.9; }
  }
}

/** A fan palm: a tall leaning trunk, a skirt of dead fronds, a crown of green fans. */
export function palm(scene: THREE.Scene, x: number, z: number, s: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const h = (4.2 + r() * 1.4) * s, lean = (r() - 0.5) * 0.25;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const a = new THREE.Vector3(lean * h * (i / segs) ** 2, (h * i) / segs, 0), b = new THREE.Vector3(lean * h * ((i + 1) / segs) ** 2, (h * (i + 1)) / segs, 0);
    g.add(beam(a, b, (0.3 - i * 0.025) * s, texMat('bark', T.bark())));
  }
  const top = new THREE.Vector3(lean * h, h, 0);
  const skirt = new THREE.Mesh(cylGeo(0.42 * s, 0.24 * s, 1.1 * s, 10), texMat('thatch', thatchTex()));
  skirt.position.copy(top).add(new THREE.Vector3(0, -0.55 * s, 0));
  g.add(shade(skirt));
  const crown = new THREE.Group();
  crown.position.copy(top);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3;
    const frond = new THREE.Group();
    frond.rotation.y = -a;
    const blade = new THREE.Mesh(blobGeo(0.5 * s, seed + i), leafMat('#d8e6b0', true));
    blade.scale.set(1.5, 0.14, 0.42);
    blade.position.set(0.62 * s, -0.08 * s, 0);
    blade.rotation.z = -0.32 - r() * 0.3; // fronds droop
    frond.add(shade(blade));
    crown.add(frond);
  }
  g.add(crown);
  sways.push({ obj: crown, phase: r() * 6.28, amp: 0.03 });
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.22, z - 0.22, x + 0.22, z + 0.22);
}

/** Prickly pear: pads stacked on pads, a few red fruit along the rims. */
export function nopal(scene: THREE.Scene, x: number, z: number, s: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const mat = texMat('nopal-mat', nopalTex(), { roughness: 0.75 });
  const fruit = colMat('#a8304a', { roughness: 0.6 });
  const pad = (px: number, py: number, pz: number, rz: number, ry: number, k: number, depth: number): void => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3 * k, 10, 8), mat);
    m.scale.set(1, 1.3, 0.28);
    m.position.set(px, py + 0.36 * k, pz);
    m.rotation.set(0, ry, rz);
    g.add(shade(m));
    const tip = new THREE.Vector3(Math.sin(-rz) * 0.7 * k, 0.72 * k, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(px, py, pz));
    if (depth > 0) {
      for (let i = 0; i < 2; i++) if (r() > 0.3) pad(tip.x, tip.y - 0.12 * k, tip.z, rz + (r() - 0.5) * 1.1, ry + (r() - 0.5) * 0.9, k * 0.86, depth - 1);
    } else if (r() > 0.5) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06 * k, 6, 4), fruit);
      f.scale.y = 1.3;
      f.position.copy(tip);
      g.add(f);
    }
  };
  // pads mostly face the camera, so the cactus reads by its silhouette (spec §7)
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) pad((r() - 0.5) * 0.4 * s, 0, (r() - 0.5) * 0.3 * s, (r() - 0.5) * 0.6, (r() - 0.5) * 1.1, s, 2);
  g.position.set(x, heightAt(x, z) - 0.05, z);
  scene.add(g);
  addSolid(x - 0.4 * s, z - 0.3 * s, x + 0.4 * s, z + 0.3 * s);
}

/** A water tower on four legs: the tallest thing for miles, so everyone knows where the water is. */
export function waterTower(scene: THREE.Scene, x: number, z: number, night: boolean): void {
  const g = new THREE.Group();
  const legH = 3.8, R = 1.5, spread = 1.3, top = 1.0;
  const steel = M.steel();
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) {
    g.add(beam(new THREE.Vector3(sx * spread, -0.1, sz * spread), new THREE.Vector3(sx * top, legH, sz * top), 0.14, steel));
    g.add(box(0.36, 0.3, 0.36, M.concrete(), sx * spread, -0.15, sz * spread)); // footings
  }
  // X bracing between legs, two tiers
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i]!, [bx, bz] = corners[(i + 1) % 4]!;
    for (const [y0, y1] of [[0.4, 2.2], [2.2, 4.0]] as Array<[number, number]>) {
      const k0 = spread + (top - spread) * (y0 / legH), k1 = spread + (top - spread) * (y1 / legH);
      g.add(beam(new THREE.Vector3(ax * k0, y0, az * k0), new THREE.Vector3(bx * k1, y1, bz * k1), 0.05, steel));
      g.add(beam(new THREE.Vector3(bx * k0, y0, bz * k0), new THREE.Vector3(ax * k1, y1, az * k1), 0.05, steel));
    }
  }
  // the tank, its catwalk, a cap
  const tankMat = (M.tank() as THREE.MeshStandardMaterial).clone();
  g.add(cyl(R, R, 2.3, tankMat, 0, legH, 0, 20));
  g.add(cyl(R + 0.05, R + 0.05, 0.08, colMat('#5a5048', { metalness: 0.4 }), 0, legH + 2.3, 0, 20));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(R + 0.12, 0.9, 20), tankMat);
  cap.position.y = legH + 2.3 + 0.45;
  g.add(shade(cap));
  g.add(cyl(R + 0.5, R + 0.5, 0.06, M.deck(), 0, legH - 0.05, 0, 20));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(box(0.04, 0.6, 0.04, steel, Math.cos(a) * (R + 0.48), legH, Math.sin(a) * (R + 0.48)));
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 0.48, 0.025, 4, 28), steel);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = legH + 0.6;
  g.add(rail);
  // a ladder up the front-right leg
  const lx = 0.55, lz = 1.25;
  g.add(beam(new THREE.Vector3(lx - 0.2, 0, lz + 0.1), new THREE.Vector3(lx - 0.2, legH, lz - 0.1), 0.04, steel));
  g.add(beam(new THREE.Vector3(lx + 0.2, 0, lz + 0.1), new THREE.Vector3(lx + 0.2, legH, lz - 0.1), 0.04, steel));
  for (let y = 0.35; y < legH; y += 0.35) g.add(box(0.4, 0.03, 0.03, steel, lx, y, lz + 0.1 - (y / legH) * 0.2));
  // painted by hand, twice: the old letters still show under the new
  const sign = new THREE.Mesh(planeGeo(2.0, 0.55), new THREE.MeshStandardMaterial({ map: textTexture('AGUA', { w: 64, h: 18, fg: '#ece4cc', font: 'bold 16px monospace', worn: 0.1, seed: 11 }), transparent: true, alphaTest: 0.4, roughness: 1 }));
  sign.position.set(0, legH + 1.25, R + 0.02);
  g.add(sign);
  // a pipe down to the yard, sweating; the ground under it is green
  g.add(beam(new THREE.Vector3(-0.6, legH, R * 0.7), new THREE.Vector3(-0.9, 0.3, 1.6), 0.09, M.rust()));
  vines(g, -1.25, 0, 1.38, 0.8, 1.6);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  for (const [sx, sz] of corners) addSolid(x + sx * spread - 0.25, z + sz * spread - 0.25, x + sx * spread + 0.25, z + sz * spread + 0.25);
  occluders.push({ mats: [tankMat, sign.material as THREE.Material], rect: [x - 2.4, z - 7.5, x + 2.4, z - 0.6], k: 1 });
  void night;
}

/** A windmill pump still lifting water into the trough: the yard's routine. */
export function windmill(scene: THREE.Scene, x: number, z: number): Built {
  const g = new THREE.Group();
  const H5 = 5.2, steel = M.steel();
  const base = 0.75, topW = 0.18;
  const cs: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of cs) g.add(beam(new THREE.Vector3(sx * base, -0.1, sz * base), new THREE.Vector3(sx * topW, H5, sz * topW), 0.07, steel));
  for (let y = 0.8; y < H5 - 0.4; y += 1.1) {
    const k = base + (topW - base) * (y / H5);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i]!, [bx, bz] = cs[(i + 1) % 4]!;
      g.add(beam(new THREE.Vector3(ax * k, y, az * k), new THREE.Vector3(bx * k, y, bz * k), 0.04, steel));
    }
  }
  const head = new THREE.Group();
  head.position.y = H5 + 0.1;
  head.rotation.y = -0.5; // into the wind, off the viewer's left shoulder
  g.add(head);
  head.add(box(0.3, 0.25, 0.5, M.rust(), 0, -0.1, 0));
  // the tail vane
  head.add(beam(new THREE.Vector3(0, 0, -0.2), new THREE.Vector3(0, 0.05, -1.4), 0.05, steel));
  const vane = new THREE.Mesh(boxGeo(0.04, 0.55, 0.8), M.tin());
  vane.position.set(0, 0.1, -1.55);
  head.add(shade(vane));
  // the wheel
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.05, 0.35);
  head.add(wheel);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const blade = new THREE.Mesh(boxGeo(0.2, 0.75, 0.02), colMat(i % 3 === 0 ? '#8a5a3a' : '#9a958a', { metalness: 0.4, roughness: 0.6 }));
    blade.geometry.translate(0, 0.62, 0);
    blade.rotation.set(0, 0.35, a);
    wheel.add(shade(blade));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 4, 20), steel);
  wheel.add(ring);
  // the pump rod down the middle and the pump head at the bottom
  const rod = box(0.05, H5 - 0.6, 0.05, steel, 0, 0.5, 0);
  g.add(rod);
  g.add(box(0.26, 0.6, 0.26, M.rust(), 0, 0, 0));
  g.add(beam(new THREE.Vector3(0, 0.45, 0.1), new THREE.Vector3(0.05, 0.45, 0.65), 0.08, M.rust())); // the spout
  const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3)), new THREE.PointsMaterial({ color: '#cfe6ee', size: 0.05, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(drops);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
  return {
    update(t) {
      wheel.rotation.z = -t * 2.1;
      const lift = Math.sin(t * 2.1);
      rod.position.y = 0.5 + lift * 0.12;
      const pos = drops.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 12; i++) {
        const k = ((t * 1.4 + i / 12) % 1);
        pos.setXYZ(i, 0.05 + Math.sin(i * 3.1) * 0.02, 0.42 - k * 0.42, 0.68 + k * 0.05);
      }
      pos.needsUpdate = true;
      (drops.material as THREE.PointsMaterial).opacity = lift > -0.2 ? 0.85 : 0.2; // it only runs on the upstroke
    },
  };
}

/** A lantern hung from a post arm. Lit, it means people are here (the Lamp). */
export function lanternPost(scene: THREE.Scene, x: number, z: number, night: boolean, lit = true): Built {
  const g = new THREE.Group();
  g.add(box(0.12, 2.3, 0.12, M.wood(), 0, 0, 0));
  g.add(box(0.7, 0.08, 0.08, M.wood(), 0.28, 2.15, 0));
  g.add(box(0.015, 0.25, 0.015, colMat('#1a1816'), 0.56, 1.9, 0));
  g.add(box(0.2, 0.04, 0.2, M.steel(), 0.56, 1.88, 0));
  const glassMat = colMat('#ffcf7a', { emissive: '#ffa850', emissiveIntensity: lit ? (night ? 4 : 2.2) : 0, roughness: 0.4 }).clone();
  const core = new THREE.Mesh(boxGeo(0.14, 0.2, 0.14), glassMat);
  core.position.set(0.56, 1.72, 0);
  g.add(core);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) g.add(box(0.02, 0.24, 0.02, M.steel(), 0.56 + dx * 0.08, 1.6, dz * 0.08));
  g.add(box(0.2, 0.04, 0.2, M.steel(), 0.56, 1.58, 0));
  const light = new THREE.PointLight('#ffb060', lit ? (night ? 6 : 3) : 0, 6.5, 1.7);
  light.position.set(0.56, 1.7, 0.25);
  g.add(light);
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
  core.castShadow = false;
  addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
  return { update(t) { if (!lit) return; const f = 0.92 + Math.sin(t * 8.3 + x) * 0.05 + Math.sin(t * 21.7) * 0.03; glassMat.emissiveIntensity = (night ? 4 : 2.2) * f; light.intensity = (night ? 6 : 3) * f; } };
}

/** Solar panels racked on a roof, tilted to the south. Some cells cracked. */
export function solarPanels(parent: THREE.Object3D, x: number, y: number, z: number, n: number, rows = 2): void {
  const cell = once('panel', () => {
    const S = 16, p = new Pix(S, S), r = rng(321);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let c: RGB = (i % 4 === 0 || j % 4 === 0) ? [180, 186, 196] : [38, 54, 88];
      if (i % 4 && j % 4 && r() < 0.06) c = [70, 96, 140];
      if (vnoise(i * 0.4, j * 0.4, 322) > 0.82) c = [150, 140, 120]; // dust
      p.set(i, j, c);
    }
    return p.texture();
  });
  const mat = new THREE.MeshStandardMaterial({ map: cell, roughness: 0.3, metalness: 0.4 });
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < n; i++) {
      const px = x + (i - (n - 1) / 2) * 1.25, pz = z + row * 1.4;
      const panel = new THREE.Mesh(boxGeo(1.15, 0.05, 0.9), [M.steel(), M.steel(), mat, M.steel(), M.steel(), M.steel()]);
      panel.position.set(px, y + 0.42, pz);
      panel.rotation.x = 0.5;
      parent.add(shade(panel));
      parent.add(box(0.05, 0.5, 0.05, M.steel(), px - 0.45, y, pz - 0.25));
      parent.add(box(0.05, 0.5, 0.05, M.steel(), px + 0.45, y, pz - 0.25));
    }
}

/** A clothesline between two T-posts, the wash moving in the breeze. */
export function clothesline(scene: THREE.Scene, x0: number, z0: number, x1: number, z1: number, seed: number): Built {
  const r = rng(seed);
  const g = new THREE.Group();
  const y = (x: number, z: number): number => heightAt(x, z);
  for (const [px, pz] of [[x0, z0], [x1, z1]] as Array<[number, number]>) {
    g.add(box(0.09, 1.9, 0.09, M.wood(), px, y(px, pz), pz));
    g.add(box(0.6, 0.07, 0.07, M.wood(), px, y(px, pz) + 1.8, pz));
    addSolid(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1);
  }
  const a = new THREE.Vector3(x0, y(x0, z0) + 1.82, z0), b = new THREE.Vector3(x1, y(x1, z1) + 1.82, z1);
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= 0.22;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.01, 3, false), colMat('#2a2622')));
  const cloths: THREE.Mesh[] = [];
  const COL = ['#c86a3a', '#e8e0cc', '#3f6a8a', '#d8b23a', '#8a3a4a', '#6f8a5a'];
  for (let k = 0.12; k < 0.92; k += 0.13 + r() * 0.08) {
    const p = curve.getPoint(k);
    const w = 0.35 + r() * 0.3, h = 0.4 + r() * 0.35;
    const c = new THREE.Mesh(planeGeo(w, h), colMat(COL[Math.floor(r() * COL.length)]!, { roughness: 1, side: THREE.DoubleSide }));
    c.geometry.translate(0, -h / 2, 0);
    c.position.copy(p);
    c.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    c.castShadow = true;
    g.add(c);
    cloths.push(c);
  }
  scene.add(g);
  return { update(t) { cloths.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.7 + i * 1.3) * 0.12 - 0.05; }); } };
}

/** A shade sail on four posts: the cloth everyone lives under by day. */
export function shadeSail(scene: THREE.Scene, x: number, z: number, w: number, d: number, h: number, color = '#2f4a40'): void {
  const g = new THREE.Group();
  const pts: Array<[number, number, number]> = [[-w / 2, -d / 2, h + 0.4], [w / 2, -d / 2, h + 0.2], [w / 2, d / 2, h - 0.2], [-w / 2, d / 2, h]];
  for (const [px, pz, ph] of pts) {
    g.add(cyl(0.06, 0.08, ph, M.wood(), px, -0.1, pz, 6));
    addSolid(x + px - 0.1, z + pz - 0.1, x + px + 0.1, z + pz + 0.1);
  }
  const geo = new THREE.BufferGeometry();
  const v = pts.map(([px, pz, ph]) => [px, ph - 0.05, pz]);
  const sag = [0, (pts[0]![2] + pts[2]![2]) / 2 - 0.25, 0];
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...v[0]!, ...v[1]!, ...sag, ...v[1]!, ...v[2]!, ...sag, ...v[2]!, ...v[3]!, ...sag, ...v[3]!, ...v[0]!, ...sag], 3));
  geo.computeVertexNormals();
  const clothMat = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(geo, clothMat);
  cloth.castShadow = true;
  g.add(cloth);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  occluders.push({ mats: [clothMat], rect: [x - w / 2 - 0.4, z - d / 2 - 3.4, x + w / 2 + 0.4, z + d / 2 - 0.2], k: 1 });
}

/** Water jugs, blue, in a crate: what everyone's work is for. */
export function jugs(scene: THREE.Scene, x: number, z: number, n: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const blue = colMat('#4f86b0', { roughness: 0.25, transparent: true, opacity: 0.88 });
  for (let i = 0; i < n; i++) {
    const j = new THREE.Group();
    j.add(cyl(0.16, 0.16, 0.42, blue, 0, 0, 0, 10));
    j.add(cyl(0.05, 0.05, 0.07, colMat('#d8d4c8'), 0, 0.42, 0, 6));
    j.position.set((i % 3) * 0.36 - 0.36 + (r() - 0.5) * 0.04, 0, Math.floor(i / 3) * 0.36);
    if (r() < 0.15) { j.rotation.z = Math.PI / 2; j.position.y = 0.16; }
    g.add(j);
  }
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
  addSolid(x - 0.6, z - 0.25, x + 0.6, z + 0.6);
}

/** A rusted steel drum. */
export function drum(scene: THREE.Scene, x: number, z: number, tipped = false): void {
  const m = new THREE.Mesh(cylGeo(0.3, 0.3, 0.88, 12), M.rust());
  if (tipped) { m.rotation.z = Math.PI / 2; m.position.set(x, heightAt(x, z) + 0.3, z); } else m.position.set(x, heightAt(x, z) + 0.44, z);
  scene.add(shade(m));
  addSolid(x - 0.32, z - 0.32, x + 0.32, z + 0.32);
}

/** A stack of tires, one fallen. */
export function tires(scene: THREE.Scene, x: number, z: number, n: number): void {
  const g = new THREE.Group();
  const rub = colMat('#1d1b19', { roughness: 0.95 });
  for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 14), rub);
    t.rotation.x = Math.PI / 2;
    t.position.set((i % 2) * 0.05, 0.12 + i * 0.22, 0);
    g.add(t);
  }
  const f = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 14), rub);
  f.rotation.set(0.2, 0.6, 0);
  f.position.set(0.75, 0.38, 0.1);
  g.add(f);
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
  addSolid(x - 0.45, z - 0.45, x + 1.1, z + 0.45);
}

/** A car with no wheels left, up on blocks, a nopal growing out of the engine bay. */
export function carHulk(scene: THREE.Scene, x: number, z: number, rot: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const paint = colMat(['#7a8a8e', '#8a5a3e', '#5a6a4a'][Math.floor(r() * 3)]!, { roughness: 0.9, metalness: 0.2 });
  g.add(box(2.7, 0.55, 1.25, M.rust(), 0, 0.28, 0));
  g.add(box(2.6, 0.12, 1.22, paint, 0, 0.83, 0));
  g.add(box(1.45, 0.5, 1.12, paint, -0.15, 0.95, 0));
  g.add(box(0.05, 0.38, 1.0, colMat('#1d262c', { roughness: 0.2 }), 0.58, 1.0, 0)); // windscreen
  g.add(box(1.3, 0.34, 0.03, colMat('#151a1e', { roughness: 0.3 }), -0.15, 1.02, 0.57));
  for (const [bx, bz] of [[0.9, 0.5], [0.9, -0.5], [-0.9, 0.5], [-0.9, -0.5]] as Array<[number, number]>) g.add(box(0.3, 0.3, 0.3, M.concrete(), bx, 0, bz));
  vines(g, -0.6, 0.15, 0.64, 1.2, 0.6);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rot;
  scene.add(shade(g));
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  addSolid(x - (1.35 * c + 0.62 * s), z - (1.35 * s + 0.62 * c), x + (1.35 * c + 0.62 * s), z + (1.35 * s + 0.62 * c));
}

/** The burial platform: a raised board deck, a shroud, stones at the corners. */
export function burialPlatform(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(box(2.6, 0.45, 1.4, M.wood(), 0, 0, 0));
  g.add(box(2.8, 0.1, 1.6, M.deck(), 0, 0.45, 0));
  const shroud = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.35, 4, 10), colMat('#e6dfcc', { roughness: 1 }));
  shroud.rotation.z = Math.PI / 2;
  shroud.scale.set(1, 1, 0.8);
  shroud.position.set(0, 0.74, 0);
  g.add(shroud);
  for (const [sx, sz] of [[-1.5, -0.85], [1.5, -0.85], [1.5, 0.85], [-1.5, 0.85]] as Array<[number, number]>) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), colMat('#b8a68a', { roughness: 1 }));
    s.position.set(sx, 0.08, sz);
    s.scale.y = 0.7;
    g.add(s);
  }
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
  addSolid(x - 1.4, z - 0.8, x + 1.4, z + 0.8);
}

/** Plastic chairs round an upturned spool for a table. */
export function chairsAndSpool(scene: THREE.Scene, x: number, z: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const spool = new THREE.Group();
  spool.add(cyl(0.55, 0.55, 0.08, M.wood(), 0, 0, 0, 14));
  spool.add(cyl(0.22, 0.22, 0.55, M.wood(), 0, 0.08, 0, 10));
  spool.add(cyl(0.6, 0.6, 0.08, M.wood(), 0, 0.63, 0, 14));
  g.add(spool);
  const white = colMat('#d4cfc2', { roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    const c = new THREE.Group();
    c.add(box(0.42, 0.06, 0.42, white, 0, 0.4, 0));
    c.add(box(0.42, 0.45, 0.06, white, 0, 0.45, -0.2));
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]] as Array<[number, number]>) c.add(box(0.04, 0.4, 0.04, white, lx, 0, lz));
    c.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
    c.rotation.y = -a - Math.PI / 2;
    if (r() < 0.25) { c.rotation.z = 1.4; c.position.y = 0.2; } // one knocked over
    g.add(c);
  }
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
  addSolid(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
}

/** Big painted letters on a board on the roof: the last of an old name. */
export function roofLetters(parent: THREE.Object3D, text: string, x: number, y: number, z: number, w: number, h: number): void {
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text, { w: 96, h: 32, bg: '#d8cdb0', fg: '#8a3a2a', font: 'bold 26px monospace', worn: 0.34, seed: 5 }), roughness: 1 });
  const board = new THREE.Mesh(boxGeo(w, h, 0.08), [M.wood(), M.wood(), M.wood(), M.wood(), face, M.wood()]);
  board.position.set(x, y + h / 2 + 0.6, z);
  board.rotation.z = 0.04;
  parent.add(shade(board));
  for (const dx of [-w * 0.35, w * 0.35]) parent.add(box(0.1, 0.7, 0.1, M.steel(), x + dx, y, z - 0.1));
}

/** Concrete block, three seeded variants so repetition never shows (spec §8.1): mortar courses, grime at the foot, water streaks. */
export function blockWall(variant = 0): THREE.Texture {
  return once('block' + variant, () => {
    const S = 32, p = new Pix(S, S), r = rng(401 + variant * 17);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = Math.floor(y / 4), off = (row % 2) * 8;
      const mortar = y % 4 === 3 || (x + off) % 16 === 15;
      const n = vnoise(Math.floor((x + off) / 16) * 3.1 + row * 1.7, row * 2.3, 402 + variant);
      let c: RGB = mortar ? [128, 122, 110] : [176 + n * 22, 168 + n * 20, 152 + n * 18];
      if (vnoise(x * 0.9, y * 0.06, 403 + variant) > 0.76) c = [c[0] * 0.78, c[1] * 0.77, c[2] * 0.74]; // water streaks
      if (fbm(x * 0.2, y * 0.2, 404 + variant, 2) > 0.7) c = [c[0] * 0.86 + 6, c[1] * 0.9 + 4, c[2] * 0.8]; // stains
      if (r() < 0.02) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
      p.set(x, y, c);
    }
    return p.texture();
  });
}

/** Tires half-buried and whitewashed, lining a lane: somebody's idea of a kerb. */
export function tireEdging(scene: THREE.Scene, pts: Array<[number, number]>, seed: number): void {
  const r = rng(seed);
  const white = colMat('#d8d0bc', { roughness: 0.9 });
  const worn = colMat('#9a958a', { roughness: 0.95 });
  for (const [x, z] of pts) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 6, 12), r() < 0.25 ? worn : white);
    t.rotation.set(0, (r() - 0.5) * 0.4, 0);
    t.position.set(x, heightAt(x, z) + 0.06, z);
    scene.add(shade(t));
  }
}

/** A mailbox on a post, its flag still up. */
export function mailbox(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(box(0.1, 1.05, 0.1, M.wood(), 0, 0, 0));
  const body = new THREE.Mesh(cylGeo(0.17, 0.17, 0.55, 10), M.rust());
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 1.18, 0.05);
  g.add(shade(body));
  g.add(box(0.36, 0.2, 0.55, M.rust(), 0, 0.98, 0.05));
  g.add(box(0.03, 0.26, 0.05, colMat('#a8402e'), 0.2, 1.1, -0.08));
  g.rotation.z = 0.06;
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
}

/**
 * The desert floor's scatter layers (spec §8.1: three or more over the base):
 * pebbles, dry tufts, and the odd bleached bone, seeded, pooled toward the
 * edges and thinning across the open middle (§8.2). `ok` keeps them off
 * roads, buildings and paths.
 */
export function desertScatter(scene: THREE.Scene, cols: number, rows: number, seed: number, ok: (x: number, z: number) => boolean): void {
  const r = rng(seed);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const edge = (x: number, z: number): number => Math.min(x, z, cols - x, rows - z);
  // pebbles
  const peb = new THREE.DodecahedronGeometry(0.07, 0);
  const pebs: THREE.Matrix4[] = [];
  for (let i = 0; i < cols * rows * 0.9; i++) {
    const x = r() * cols, z = r() * rows;
    if (!ok(x, z) || r() > 0.35 + Math.max(0, 0.6 - edge(x, z) * 0.08)) continue;
    e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
    const s = 0.6 + r() * 1.6;
    pebs.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) + 0.02, z), q, new THREE.Vector3(s, s * 0.6, s)));
  }
  const pm = new THREE.InstancedMesh(peb, colMat('#a8987c', { roughness: 1 }), pebs.length);
  pebs.forEach((mm, i) => pm.setMatrixAt(i, mm));
  pm.receiveShadow = true;
  scene.add(pm);
  // dry tufts: three straw blades, gone gold and grey
  const blade = new THREE.ConeGeometry(0.035, 0.32, 3);
  blade.translate(0, 0.16, 0);
  const tufts: Array<[THREE.Matrix4, THREE.Color]> = [];
  const straw = ['#b8a070', '#a89060', '#c8b484', '#8a8058'];
  for (let i = 0; i < cols * rows * 0.6; i++) {
    const x = r() * cols, z = r() * rows;
    if (!ok(x, z) || fbm(x * 0.2, z * 0.2, seed + 3, 2) < 0.45 - Math.max(0, 0.3 - edge(x, z) * 0.05)) continue;
    for (let k = 0; k < 3; k++) {
      e.set((r() - 0.5) * 0.7, r() * 6, (r() - 0.5) * 0.7); q.setFromEuler(e);
      const s = 0.7 + r() * 0.8;
      tufts.push([new THREE.Matrix4().compose(new THREE.Vector3(x + (r() - 0.5) * 0.15, heightAt(x, z), z + (r() - 0.5) * 0.15), q, new THREE.Vector3(s, s, s)), new THREE.Color(straw[Math.floor(r() * 4)]!)]);
    }
  }
  const tm = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: '#ffffff' }), tufts.length);
  tufts.forEach(([mm, c], i) => { tm.setMatrixAt(i, mm); tm.setColorAt(i, c); });
  tm.receiveShadow = true;
  scene.add(tm);
  void m4;
}

/** A cow skull, bleached: the desert's own signage. */
export function skull(scene: THREE.Scene, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  const bone = colMat('#e8e0cc', { roughness: 0.9 });
  g.add(box(0.22, 0.12, 0.34, bone, 0, 0, 0));
  g.add(box(0.12, 0.08, 0.16, bone, 0, 0.02, 0.22));
  for (const sx of [-1, 1]) g.add(beam(new THREE.Vector3(sx * 0.1, 0.1, -0.1), new THREE.Vector3(sx * 0.32, 0.22, -0.18), 0.04, bone));
  g.add(box(0.05, 0.03, 0.02, colMat('#1a1714'), -0.05, 0.08, 0.1));
  g.add(box(0.05, 0.03, 0.02, colMat('#1a1714'), 0.05, 0.08, 0.1));
  g.rotation.y = rot;
  g.position.set(x, heightAt(x, z), z);
  scene.add(shade(g));
}

/** The land beyond and between the Span's maps: thorn brush seen from above, clumps of dark
 *  olive canopy with dust showing between them. Drawn with wraparound, so it tiles with no seam. */
export function spanApron(): THREE.Texture {
  return once('span-apron-brush', () => {
    const S = 96, p = new Pix(S, S), r = rng(501);
    const dust = ['#7a6a4e', '#86755a', '#6c5e46'].map(H);
    const leaf = ['#3a3c26', '#46482e', '#525436', '#5e5e3e', '#6a6844'].map(H);
    const grid: RGB[] = [];
    for (let i = 0; i < S * S; i++) grid.push(dust[Math.floor(r() * 3)]!);
    const set = (x: number, y: number, c: RGB): void => { grid[(((y % S) + S) % S) * S + (((x % S) + S) % S)] = c; };
    // shadows first (down-right of each clump), then the clumps over them
    const clumps: Array<[number, number, number]> = [];
    for (let i = 0; i < 70; i++) clumps.push([r() * S, r() * S, 4 + r() * 8]);
    for (const [cx, cy, rad] of clumps)
      for (let y = -rad - 3; y <= rad + 3; y++) for (let x = -rad - 3; x <= rad + 3; x++)
        if (Math.hypot(x - 2, y - 2) < rad) set(Math.floor(cx + x), Math.floor(cy + y), H('#2a2618'));
    for (const [cx, cy, rad] of clumps)
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y) / rad;
        if (d > 1 - r() * 0.12) continue;
        const light = (-x - y) / (rad * 2); // lit from the upper left
        const k = Math.min(4, Math.max(0, Math.floor(2 + light * 2.4 + (r() - 0.5) * 1.4 - d)));
        set(Math.floor(cx + x), Math.floor(cy + y), leaf[k]!);
      }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, grid[y * S + x]!);
    return p.texture();
  });
}
/** Dry edge scrub, painted (replaces the spec's prairie scrub for the '#' glyph). */
export const SCRUB_DRY = ['#6a6244', '#7a704c', '#5c5a3c', '#8a7e58'].map(H);
export const STRAW = ['#c8b484', '#b8a070', '#d4c49a', '#a89060'];
