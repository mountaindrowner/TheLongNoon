import * as THREE from 'three';
import { Pix, T } from '../../engine/textures';
import { beam, cyl, colMat, texMat, shade } from '../../engine/geo';
import { heightAt, addSolid } from '../../engine/world';
import { rng, fbm, vnoise } from '../../engine/noise';
import { blobGeo } from '../../engine/foliage';
import { batch } from '../../engine/batch';
import type { Flora } from '../../engine/section';

/**
 * South Texas brush (owner, 2026-10-26: "lots of brush and bramble ... harsh
 * greenery, not lush trees"). The brush country's plants, built from
 * primitives at the shared texel density:
 *
 *   mesquite   · low, wide, crooked; lacy dusty-olive crowns with sky through them
 *   huisache   · a smaller, rounder crown, flecked yellow
 *   cenizo     · a silver-grey shrub, the odd lilac fleck
 *   thicket    · the bramble: low dark tangles with bare thorn twigs sticking out; walls of it frame every map
 *   yucca      · a shaggy trunk under a rosette of daggers
 *   tasajillo  · pencil cactus with red berries
 *   dead mesquite · bleached grey, bare
 *
 * Everything here is static and merged per map (engine/batch.ts); a whole
 * map's brush draws in a few calls.
 */

type RGB = [number, number, number];
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const tex = new Map<string, THREE.Texture>();
const once = (k: string, make: () => THREE.Texture): THREE.Texture => { let t = tex.get(k); if (!t) { t = make(); tex.set(k, t); } return t; };

/** A leaf texture: a palette mottled by noise, gaps of shadow, flecks of something. */
function leafTex(key: string, pal: string[], gap: string, gapK: number, fleck?: string, fleckK = 0): THREE.Texture {
  return once(key, () => {
    const S = 32, p = new Pix(S, S), r = rng(key.length * 97 + pal.length);
    const P = pal.map(H), G = H(gap), F = fleck ? H(fleck) : null;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.22, y * 0.22, key.length * 13, 3);
      let c = P[Math.min(P.length - 1, Math.floor(n * P.length + r() * 0.7))]!;
      if (vnoise(x * 0.45, y * 0.45, key.length * 7) > 1 - gapK) c = G;
      if (F && r() < fleckK) c = F;
      p.set(x, y, c);
    }
    return p.texture();
  });
}
const MAT = {
  // grey-olive and dusty: the grade lifts greens, so the brush starts drabber than it should end up
  mesquite: () => texMat('st-mesquite2', leafTex('mesquite2', ['#4c5038', '#585c42', '#64664a', '#727254', '#5e5a44'], '#24241a', 0.24), { roughness: 0.95, flatShading: true }),
  huisache: () => texMat('st-huisache', leafTex('huisache', ['#5e6a32', '#6e7a3a', '#7e8a42', '#8e9450'], '#2a3018', 0.16, '#d8b830', 0.06), { roughness: 0.95, flatShading: true }),
  cenizo: () => texMat('st-cenizo', leafTex('cenizo', ['#7c8476', '#8e9686', '#a0a896', '#b0b6a4'], '#4a5048', 0.12, '#a888c0', 0.025), { roughness: 0.95, flatShading: true }),
  thicket: () => texMat('st-thicket', leafTex('thicket', ['#2c2a1c', '#3c3a26', '#48452e', '#545036'], '#1a1810', 0.22, '#6a5a3a', 0.05), { roughness: 1, flatShading: true }),
  yucca: () => texMat('st-yucca', leafTex('yucca', ['#5a6a46', '#6a7a52', '#7a8a5e', '#8a9668'], '#3a4430', 0.1), { roughness: 0.8, side: THREE.DoubleSide }),
  bark: () => texMat('bark', T.bark()),
  bone: () => colMat('#9a9282', { roughness: 1 }),
  thorn: () => colMat('#3a2c20', { roughness: 1 }),
  cactus: () => colMat('#5e7448', { roughness: 0.8 }),
  berry: () => colMat('#b0303a', { roughness: 0.5 }),
  shag: () => colMat('#7a6a50', { roughness: 1 }),
};

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const place = (g: THREE.Group, x: number, z: number, sink = 0.04): THREE.Group => { g.position.set(x, heightAt(x, z) - sink, z); return shade(g); };

/** Mesquite: two or three crooked trunks leaning out from one root, each holding up a flat, lacy crown. */
export function mesquite(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 1.2, lean = 0.35 + r() * 0.35;
    const mid = V(Math.cos(a) * lean * s, (0.8 + r() * 0.3) * s, Math.sin(a) * lean * 0.7 * s);
    const top = V(Math.cos(a + (r() - 0.5)) * (lean + 0.45) * s, (1.55 + r() * 0.45) * s, Math.sin(a + (r() - 0.5)) * (lean + 0.3) * 0.7 * s);
    g.add(beam(V(0, -0.1, 0), mid, 0.13 * s, MAT.bark()), beam(mid, top, 0.09 * s, MAT.bark()));
    // a crown of several small, ragged clumps at different heights, sky through the gaps
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(blobGeo((0.32 + r() * 0.2) * s, seed + i * 5 + k), MAT.mesquite());
      b.scale.set(1.2, 0.5 + r() * 0.2, 1.0);
      b.rotation.y = r() * 3;
      b.position.copy(top).add(V((r() - 0.5) * 1.2 * s, (r() - 0.3) * 0.35 * s, (r() - 0.5) * 0.8 * s));
      g.add(b);
    }
  }
  return batch(place(g, x, z));
}

/** Huisache: one short trunk forking low, a rounder crown flecked with yellow. */
export function huisache(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const fork = V((r() - 0.5) * 0.2, 0.55 * s, 0);
  g.add(beam(V(0, -0.1, 0), fork, 0.12 * s, MAT.bark()));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    const top = V(Math.cos(a) * 0.5 * s, (1.25 + r() * 0.3) * s, Math.sin(a) * 0.35 * s);
    g.add(beam(fork, top, 0.07 * s, MAT.bark()));
    const b = new THREE.Mesh(blobGeo((0.55 + r() * 0.2) * s, seed + i), MAT.huisache());
    b.scale.set(1.1, 0.6, 1.0);
    b.position.copy(top).add(V(0, 0.15 * s, 0));
    g.add(b);
  }
  return batch(place(g, x, z));
}

/** Cenizo: a rounded silver shrub, knee to waist high. */
export function cenizo(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(blobGeo((0.32 + r() * 0.14) * s, seed + i * 3), MAT.cenizo());
    b.scale.y = 0.8;
    b.position.set((r() - 0.5) * 0.55 * s, 0.26 * s + r() * 0.1 * s, (r() - 0.5) * 0.4 * s);
    g.add(b);
  }
  return batch(place(g, x, z));
}

/** Bramble: a low, wide, dark tangle with bare thorn twigs sticking out. Nobody walks through this. */
export function thicket(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(blobGeo((0.42 + r() * 0.26) * s, seed + i * 7), i % 3 === 2 ? MAT.mesquite() : MAT.thicket());
    b.scale.set(1.3, 0.62 + r() * 0.25, 1.05);
    b.position.set((r() - 0.5) * 1.3 * s, (0.3 + r() * 0.25) * s, (r() - 0.5) * 0.9 * s);
    g.add(b);
  }
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const from = V(Math.cos(a) * 0.4 * s, 0.35 * s, Math.sin(a) * 0.3 * s);
    g.add(beam(from, from.clone().add(V(Math.cos(a) * 0.55 * s, (0.35 + r() * 0.4) * s, Math.sin(a) * 0.4 * s)), 0.035, MAT.thorn()));
  }
  return batch(place(g, x, z, 0.08));
}

/** Yucca: a shaggy trunk (old dead leaves hanging) under a rosette of daggers. */
export function yucca(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const h = (0.5 + r() * 0.9) * s;
  g.add(cyl(0.09 * s, 0.13 * s, h, MAT.shag(), 0, -0.05, 0, 6));
  const leaf = new THREE.PlaneGeometry(0.08 * s, 0.7 * s);
  leaf.translate(0, 0.35 * s, 0);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(leaf, MAT.yucca());
    m.position.set(0, h, 0);
    m.rotation.set((0.25 + r() * 0.75) * (i % 2 ? 1 : -1), (i / 16) * Math.PI * 2, (r() - 0.5) * 0.6);
    g.add(m);
  }
  return batch(place(g, x, z));
}

/** Tasajillo: pencil cactus in a loose tangle, red berries on the tips. */
export function tasajillo(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const base = V((r() - 0.5) * 0.3 * s, 0, (r() - 0.5) * 0.3 * s);
    const tip = base.clone().add(V(Math.cos(a) * 0.3 * s, (0.5 + r() * 0.4) * s, Math.sin(a) * 0.2 * s));
    g.add(beam(base, tip, 0.05 * s, MAT.cactus()));
    if (r() > 0.4) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 5, 4), MAT.berry()); b.position.copy(tip); g.add(b); }
  }
  return batch(place(g, x, z));
}

/** A dead mesquite, bleached grey and bare. */
export function deadMesquite(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, th: number, depth: number): void => {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    g.add(beam(from, to, th, MAT.bone()));
    if (depth > 0) for (let i = 0; i < 2; i++) {
      const d = dir.clone().add(V(r() - 0.5, r() * 0.2, r() - 0.5).multiplyScalar(1.6)).normalize();
      grow(to, d, len * 0.7, th * 0.65, depth - 1);
    }
  };
  grow(V(0, -0.1, 0), V(0.3, 1, 0.1).normalize(), 0.9 * s, 0.14 * s, 3);
  return batch(place(g, x, z));
}

/** The Span's edge plants: walls of bramble, mesquite standing out of them, cenizo in front. */
export const SPAN_FLORA: Flora = {
  tree: (x, z, s, seed) => (seed % 5 === 0 ? huisache(x, z, s, seed) : mesquite(x, z, s * 1.1, seed)),
  bush: (x, z, s, seed) => (seed % 3 === 0 ? tasajillo(x, z, s, seed) : cenizo(x, z, s, seed)),
  dead: deadMesquite,
  thicket,
};

/** Scatter brush over an area: `ok` says where it may go; `k` is how thick (0..1). */
export function brushScatter(scene: THREE.Object3D, x0: number, z0: number, x1: number, z1: number, k: number, seed: number, ok: (x: number, z: number) => boolean): void {
  const r = rng(seed);
  const n = Math.round((x1 - x0) * (z1 - z0) * 0.05 * k);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    // clumped, not even: brush grows in mottes
    if (fbm(x * 0.12, z * 0.12, seed, 2) < 0.48 || !ok(x, z)) continue;
    const t = r(), sd = seed * 1000 + i, s = 0.8 + r() * 0.5;
    scene.add(t < 0.36 ? thicket(x, z, s, sd) : t < 0.58 ? cenizo(x, z, s, sd) : t < 0.72 ? mesquite(x, z, s, sd)
      : t < 0.8 ? huisache(x, z, s, sd) : t < 0.88 ? yucca(x, z, s, sd) : t < 0.95 ? tasajillo(x, z, s, sd) : deadMesquite(x, z, s, sd));
    // bramble is a wall; the rest you step round
    const hw = t < 0.36 ? 0.75 * s : 0.28, hd = t < 0.36 ? 0.5 * s : 0.28;
    addSolid(x - hw, z - hd, x + hw, z + hd);
  }
}
