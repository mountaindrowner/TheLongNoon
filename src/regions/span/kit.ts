import * as THREE from 'three';
import { Pix, textTexture } from '../../engine/textures';
import { box, boxGeo, cyl, cylGeo, beam, colMat, shade, planeGeo, prism } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { rng, fbm, vnoise } from '../../engine/noise';
import { M, vines, type Built } from '../../engine/buildings';
import { distToPath, type RGB } from '../../engine/section';
import { SCRUB_DRY, occluders } from './props';

/**
 * The Span's second prop shelf: the town, the road and the lake. Same rules
 * as props.ts (spec §7): primitives, world-unit UVs, silhouette first, wear
 * that tells time. Routines (§11.2) return a Built with an update.
 */

type O = THREE.Object3D;
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pick = (pal: RGB[], k: number): RGB => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(k * pal.length)))]!;
const at = (o: O, x: number, z: number, dy = 0): O => { o.position.set(x, heightAt(x, z) + dy, z); return o; };
const glow = (hex: string, k: number): THREE.MeshStandardMaterial => colMat(hex, { emissive: hex, emissiveIntensity: k }).clone();

// ------------------------------------------------------------------ ground

const BRUSH_TOP = ['#3a3c26', '#46482e', '#525436', '#5e5e3e', '#6a6844'].map(H);
const ASPHALT = ['#6a6762', '#77736c', '#827e76', '#605c56'].map(H);
const SAND = ['#c8b08a', '#d2ba92', '#bca47e', '#dcc6a0'].map(H);
const CRUST = ['#e6e0d2', '#ddd6c6', '#efe9dc', '#d2cab8'].map(H);

/** Ground glyphs the Span adds to the region painter: '#' dry edge scrub, 's' sand,
 *  'W' the White Bowl's salt crust, cracked into plates. */
export function spanPaint(glyph: string, x: number, z: number, fine: number): RGB | undefined {
  if (glyph === 'd') {
    // old asphalt, sun-greyed: cracks full of blown dust and dead tufts, never green
    const n = fbm(x * 0.6, z * 0.6, 31, 3);
    let c = ASPHALT[Math.min(3, Math.floor(n * 3.2 + fine * 0.9))]!;
    const cr = fbm(x * 0.55, z * 0.55, 33, 3);
    if (Math.abs(cr - 0.5) < 0.012 || Math.abs(fbm(x * 1.3, z * 1.3, 34, 2) - 0.5) < 0.008) c = vnoise(x * 3, z * 3, 35) > 0.6 ? H(fine > 0.5 ? '#a89060' : '#8a7a54') : H('#3e3a34');
    if (fbm(x * 0.35, z * 0.35, 37, 2) > 0.74) c = fine > 0.5 ? H('#8d7a5c') : H('#7a6a50'); // dust drifted over it
    return c;
  }
  if (glyph === 'p') {
    // dead grass where a park or a yard was: straw over dust, the odd dark tuft
    const n = fbm(x * 0.5, z * 0.5, 61, 3);
    const P = ['#8c8456', '#9a9060', '#7e7a4e', '#a89c6a'].map(H);
    let c = P[Math.min(3, Math.floor(n * 3 + fine * 1.2))]!;
    if (fine > 0.985) c = H('#5e5a38');
    return c;
  }
  if (glyph === '#') {
    // thorn brush seen from above: clumps of dark olive canopy, lit from the upper left, dust between them
    const n = vnoise(x * 0.8, z * 0.8, 41) * 0.75 + vnoise(x * 2.2, z * 2.2, 42) * 0.25;
    if (n > 0.47) {
      const lit = vnoise((x - 0.35) * 0.8, (z - 0.35) * 0.8, 41) * 0.75 + vnoise((x - 0.35) * 2.2, (z - 0.35) * 2.2, 42) * 0.25 - n;
      const k = Math.min(4, Math.max(0, Math.floor(2 + lit * 14 + (fine - 0.5) * 1.6)));
      return BRUSH_TOP[k]!;
    }
    if (n > 0.43) return H('#2a2618'); // the shadow at a clump's edge
    return SCRUB_DRY[Math.min(3, Math.floor(fbm(x * 0.7, z * 0.7, 41, 2) * 3 + fine * 1.2))]!;
  }
  if (glyph === 's') return SAND[Math.min(3, Math.floor(fbm(x * 0.4, z * 0.4, 51, 2) * 3 + fine * 1.2))]!;
  if (glyph === 'W') {
    let c = pick(CRUST, fbm(x * 0.3, z * 0.3, 91, 3) * 0.8 + fine * 0.3);
    // plates: the crack network at two scales, curling up pale at the edges
    const a = Math.abs(fbm(x * 0.55, z * 0.55, 92, 2) - 0.5), b = Math.abs(fbm(x * 1.6, z * 1.6, 93, 2) - 0.5);
    if (a < 0.016 || b < 0.01) c = H('#9a917e');
    else if (a < 0.03) c = H('#f4f0e6');
    if (fine > 0.994) c = H('#ffffff');
    return c;
  }
  return undefined;
}

/** Tracks pressed into the ground along a path: `kind` six (three thin wheel lines a side,
 *  something small) or big (two wide treads with cross-bars, something bigger). */
export function tracks(x: number, z: number, path: Array<[number, number]>, kind: 'six' | 'big', base: RGB): RGB | undefined {
  const d = distToPath(x, z, path);
  if (kind === 'six') {
    if (d > 0.42) return undefined;
    for (const o of [0.0, 0.32]) if (Math.abs(d - o) < 0.035) return [base[0] * 0.72, base[1] * 0.7, base[2] * 0.68];
    return undefined;
  }
  if (d < 0.55 || d > 1.35) return undefined;
  const bar = ((x * 3.1 + z * 2.3) % 1 + 1) % 1 < 0.35;
  return bar ? [base[0] * 0.62, base[1] * 0.6, base[2] * 0.58] : [base[0] * 0.8, base[1] * 0.78, base[2] * 0.76];
}

// ------------------------------------------------------------------ the Plaza

/** A market stall: four poles, a cloth awning, a plank counter and whatever's for trade. */
export function stall(s: O, x: number, z: number, cloth: string, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) g.add(box(0.08, 2.0 + (sz < 0 ? 0.25 : 0), 0.08, M.wood(), sx * 1.05, 0, sz * 0.6));
  const aw = new THREE.Mesh(boxGeo(2.4, 0.04, 1.6), colMat(cloth, { roughness: 1 }));
  aw.position.set(0, 2.15, 0);
  aw.rotation.x = 0.16;
  g.add(shade(aw));
  for (let i = 0; i < 6; i++) g.add(box(0.4, 0.12, 0.04, colMat(cloth, { roughness: 1 }), -1.0 + i * 0.4, 1.98, 0.82)); // scalloped edge
  g.add(box(2.1, 0.08, 0.7, M.wood(), 0, 0.85, 0.3), box(2.1, 0.85, 0.06, M.grey(), 0, 0, 0.62));
  const GOODS = ['#c8a050', '#8a3a2a', '#6a8a4a', '#d8d0bc', '#4f86b0', '#a8643e'];
  for (let i = 0; i < 7; i++) {
    const k = r();
    const col = colMat(GOODS[Math.floor(r() * GOODS.length)]!, { roughness: 0.7 });
    const gx = -0.85 + i * 0.28;
    if (k < 0.4) g.add(cyl(0.08, 0.08, 0.2, col, gx, 0.93, 0.3, 7));
    else if (k < 0.7) g.add(box(0.2, 0.14, 0.2, col, gx, 0.93, 0.3));
    else { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), col); b.position.set(gx, 1.02, 0.3); g.add(b); }
  }
  g.add(box(0.5, 0.4, 0.4, M.wood(), 0.7, 0, -0.35));
  s.add(at(g, x, z));
  addSolid(x - 1.15, z + 0.0, x + 1.15, z + 0.7);
}

/** Strung bulbs between posts, lit off a battery somewhere: the market's light. */
export function stringLights(s: O, posts: Array<[number, number]>, night: boolean): Built {
  const mats: THREE.MeshStandardMaterial[] = [];
  // small and warm: a string of bulbs is many lamps, not many lights (bloom turns anything brighter into coins)
  const bulb = glow('#ffd890', night ? 1.5 : 0.8);
  mats.push(bulb);
  const wire = colMat('#1a1816');
  for (const [x, z] of posts) { s.add(at(box(0.09, 3.0, 0.09, M.wood(), 0, 0, 0), x, z)); addSolid(x - 0.1, z - 0.1, x + 0.1, z + 0.1); }
  for (let i = 0; i < posts.length - 1; i++) {
    const [ax, az] = posts[i]!, [bx, bz] = posts[i + 1]!;
    const a = new THREE.Vector3(ax, heightAt(ax, az) + 2.95, az), b = new THREE.Vector3(bx, heightAt(bx, bz) + 2.95, bz);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.45;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    s.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.012, 3, false), wire));
    const n = Math.max(3, Math.round(a.distanceTo(b) / 1.1));
    for (let k = 1; k < n; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), bulb);
      m.position.copy(curve.getPoint(k / n)).add(new THREE.Vector3(0, -0.07, 0));
      s.add(m);
      if (k === Math.floor(n / 2)) { const l = new THREE.PointLight('#ffc070', night ? 4 : 1.2, 7, 1.7); l.position.copy(m.position); s.add(l); }
    }
  }
  return { update(t) { bulb.emissiveIntensity = (night ? 1.5 : 0.8) * (0.94 + Math.sin(t * 3.3) * 0.04); } };
}

/** The seven flags: seven poles in an arc, seven rags gone the same gray-pink. The Plaza's hero. */
export function sevenFlags(s: O, cx: number, cz: number): Built {
  const COL = ['#b07a6a', '#a8908a', '#9a8a7a', '#b8a090', '#8a7a8a', '#a87a5a', '#9a9a8a'];
  const cloths: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.6;
    const x = cx + Math.sin(a) * 6.2, z = cz - Math.cos(a) * 1.6 + 1.6;
    const h = 6.2 - Math.abs(i - 3) * 0.25;
    const g = new THREE.Group();
    g.add(cyl(0.06, 0.09, h, M.steel(), 0, -0.1, 0, 8));
    g.add(cyl(0.12, 0.12, 0.1, colMat('#c8a050', { metalness: 0.6 }), 0, h - 0.1, 0, 8));
    // the flag: a rag, torn short, stripes nobody can name any more
    const p = new Pix(16, 10), r = rng(70 + i);
    for (let y = 0; y < 10; y++) for (let xx = 0; xx < 16; xx++) {
      const band = Math.floor((i % 2 ? xx : y) / (i % 3 + 3)) % 2;
      let c = H(COL[i]!);
      if (band) c = [c[0] * 0.82, c[1] * 0.82, c[2] * 0.84];
      const torn = xx > 11 + vnoise(y * 0.9, i, 3) * 4;
      p.set(xx, y, c, torn || r() < 0.03 ? 0 : 255);
    }
    const cloth = new THREE.Mesh(planeGeo(1.3, 0.8), new THREE.MeshStandardMaterial({ map: p.texture({ repeat: false, worldSize: false }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }));
    cloth.geometry.translate(0.65, 0, 0);
    cloth.position.set(0.05, h - 0.55, 0);
    cloth.castShadow = true;
    g.add(cloth);
    cloths.push(cloth);
    s.add(at(g, x, z));
    addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
  }
  s.add(at(box(13.6, 0.18, 2.8, M.concrete(), 0, -0.1, 0), cx, cz + 0.9)); // the old plinth
  return { update(t) { cloths.forEach((c, i) => { c.rotation.y = Math.sin(t * 0.9 + i * 1.7) * 0.35 - 0.2; c.rotation.x = Math.sin(t * 2.1 + i) * 0.06; }); } };
}

/** The well: a stone ring, a frame, a pulley, a bucket on a rope. */
export function well(s: O, x: number, z: number): void {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(cylGeo(0.85, 0.9, 0.75, 16, true), M.brick());
  ring.position.y = 0.37;
  g.add(shade(ring));
  g.add(cyl(0.95, 0.95, 0.08, M.concrete(), 0, 0.75, 0, 16));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.78, 16), colMat('#060504'));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.6;
  g.add(hole);
  for (const sx of [-1, 1]) g.add(box(0.12, 2.0, 0.12, M.wood(), sx * 0.85, 0.7, 0));
  g.add(box(1.9, 0.12, 0.14, M.wood(), 0, 2.6, 0));
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 5, 12), M.steel());
  pulley.position.set(0, 2.45, 0);
  g.add(pulley);
  g.add(box(0.015, 1.1, 0.015, colMat('#8a7a5a'), 0, 1.3, 0));
  g.add(cyl(0.14, 0.11, 0.24, M.rust(), 0, 1.12, 0, 8));
  s.add(at(g, x, z));
  addSolid(x - 0.95, z - 0.95, x + 0.95, z + 0.95);
}

/** The Lawnkeeper: a little mower still mowing the dust of a square it remembers. The Plaza's routine. */
export function lawnkeeper(s: O, path: Array<[number, number]>): Built {
  const g = new THREE.Group();
  g.add(box(0.62, 0.26, 0.82, colMat('#6f8a5a', { roughness: 0.6, metalness: 0.3 }), 0, 0.1, 0));
  g.add(box(0.5, 0.06, 0.6, colMat('#c8c4b4', { metalness: 0.4 }), 0, 0.36, -0.05));
  g.add(box(0.12, 0.12, 0.1, colMat('#2a2622'), 0, 0.24, 0.43));
  const eye = glow('#8aff8a', 2.4);
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), eye);
  e.position.set(0, 0.26, 0.48);
  g.add(e);
  for (const [wx, wz] of [[-0.33, -0.3], [0.33, -0.3], [-0.33, 0.3], [0.33, 0.3]] as Array<[number, number]>) {
    const w = new THREE.Mesh(cylGeo(0.12, 0.12, 0.08, 10), colMat('#1d1b19'));
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.12, wz);
    g.add(w);
  }
  s.add(shade(g));
  // its loop, measured so it moves at a steady crawl
  const seg = path.map((p, i) => (i ? Math.hypot(p[0] - path[i - 1]![0], p[1] - path[i - 1]![1]) : 0));
  const total = seg.reduce((a, b) => a + b, 0);
  return {
    update(t) {
      let d = (t * 0.45) % total;
      for (let i = 1; i < path.length; i++) {
        if (d > seg[i]!) { d -= seg[i]!; continue; }
        const [ax, az] = path[i - 1]!, [bx, bz] = path[i]!, k = d / seg[i]!;
        const x = ax + (bx - ax) * k, z = az + (bz - az) * k;
        g.position.set(x, heightAt(x, z), z);
        g.rotation.y = Math.atan2(bx - ax, bz - az);
        break;
      }
      eye.emissiveIntensity = 2.0 + Math.sin(t * 4) * 0.4;
    },
  };
}

/** A bench with a heart carved in it. */
export function bench(s: O, x: number, z: number, rot = 0): void {
  const g = new THREE.Group();
  g.add(box(1.6, 0.07, 0.42, M.wood(), 0, 0.45, 0), box(1.6, 0.4, 0.06, M.wood(), 0, 0.55, -0.2));
  for (const sx of [-0.65, 0.65]) g.add(box(0.1, 0.45, 0.42, M.concrete(), sx, 0, 0));
  g.rotation.y = rot;
  s.add(shade(at(g, x, z)));
  addSolid(x - 0.8, z - 0.25, x + 0.8, z + 0.25);
}

/** A bell tower over a chapel front: the tallest roof in town, an open belfry, the bell still hung. */
export function belfry(s: O, x: number, z: number, h: number): Built {
  const g = new THREE.Group();
  const wall = M.white();
  g.add(box(2.2, h, 2.2, wall, 0, 0, 0));
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) g.add(box(0.36, 1.4, 0.36, wall, px * 0.92, h, pz * 0.92));
  g.add(box(2.5, 0.2, 2.5, M.concrete(), 0, h + 1.4, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 4), M.shingles());
  cap.rotation.y = Math.PI / 4;
  cap.position.y = h + 2.1;
  g.add(shade(cap));
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 0.6, 10, 1, true), colMat('#8a6a3a', { metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  bell.position.y = h + 0.8;
  g.add(shade(bell));
  vines(g, 0.4, 0, 1.13, 1.4, 2.6);
  s.add(shade(at(g, x, z)));
  addSolid(x - 1.1, z - 1.1, x + 1.1, z + 1.1);
  return { update(t) { bell.rotation.z = Math.sin(t * 0.6) * 0.02; } };
}

// ------------------------------------------------------------------ the road

/** A billboard on two legs, its face peeled back layer on layer until no word is left (spec §11.3). */
export function billboard(s: O, x: number, z: number, rot: number): void {
  const p = new Pix(64, 28), r = rng(611);
  const LAYERS = ['#d8d0bc', '#c8b49a', '#9a8a7a', '#b8a888', '#e6dccc', '#8a8070'].map(H);
  for (let y = 0; y < 28; y++) for (let xx = 0; xx < 64; xx++) {
    const n = fbm(xx * 0.08, y * 0.12, 612, 3);
    let c = LAYERS[Math.floor(n * LAYERS.length * 1.1) % LAYERS.length]!;
    if (Math.abs(n - 0.5) < 0.02) c = H('#5a5248'); // torn paper edges
    if (vnoise(xx * 0.7, y * 0.06, 613) > 0.78) c = [c[0] * 0.8, c[1] * 0.78, c[2] * 0.76]; // drip lines
    if (r() < 0.02) c = H('#6a6258');
    p.set(xx, y, c);
  }
  const face = new THREE.MeshStandardMaterial({ map: p.texture({ repeat: false, worldSize: false }), roughness: 1 });
  const g = new THREE.Group();
  for (const sx of [-2.4, 2.4]) g.add(box(0.3, 7.2, 0.3, M.steel(), sx, -0.1, 0));
  const board = new THREE.Mesh(boxGeo(7.4, 3.2, 0.14), [M.steel(), M.steel(), M.steel(), M.steel(), face, M.steel()]);
  board.position.y = 5.6;
  g.add(shade(board));
  g.add(box(7.0, 0.06, 0.6, M.steel(), 0, 3.85, 0.35)); // the catwalk
  for (let i = 0; i < 5; i++) g.add(box(0.05, 0.4, 0.05, M.steel(), -3 + i * 1.5, 3.9, 0.62));
  g.rotation.y = rot;
  s.add(shade(at(g, x, z)));
  addSolid(x - 2.6, z - 0.3, x - 2.2, z + 0.3);
  addSolid(x + 2.2, z - 0.3, x + 2.6, z + 0.3);
  occluders.push({ mats: [face], rect: [x - 3.8, z - 7.5, x + 3.8, z - 0.4], k: 1 });
}

/** A traffic signal on a mast arm, still cycling red, yellow, green for nobody. A routine. */
export function trafficSignal(s: O, x: number, z: number, arm: number, night: boolean): Built {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.16, 5.4, M.steel(), 0, -0.1, 0, 8));
  g.add(beam(new THREE.Vector3(0, 5.0, 0), new THREE.Vector3(arm, 5.15, 0), 0.09, M.steel()));
  const lamps = ['#ff3a22', '#ffb020', '#3aff7a'].map((c) => glow(c, 0));
  const head = new THREE.Group();
  head.position.set(arm * 0.82, 4.25, 0);
  head.add(box(0.34, 1.0, 0.26, colMat('#2a2c26', { roughness: 0.7 }), 0, 0, 0));
  lamps.forEach((m, i) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), m); l.position.set(0, 0.82 - i * 0.3, 0.135); head.add(l); });
  g.add(head);
  s.add(shade(at(g, x, z)));
  addSolid(x - 0.18, z - 0.18, x + 0.18, z + 0.18);
  const k = night ? 3.2 : 1.6;
  return {
    update(t) {
      const c = t % 14; // green 6, yellow 2, red 6
      const on = c < 6 ? 2 : c < 8 ? 1 : 0;
      lamps.forEach((m, i) => { m.emissiveIntensity = i === on ? k : 0.05; });
    },
  };
}

/** A bus shelter: a tin roof on posts, a bench, a schedule board gone blank. */
export function busShelter(s: O, x: number, z: number): void {
  const g = new THREE.Group();
  for (const [px, pz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]] as Array<[number, number]>) g.add(box(0.08, 2.3, 0.08, M.steel(), px, 0, pz));
  const roof = box(3.0, 0.06, 1.4, M.tin(), 0, 2.3, 0);
  roof.rotation.x = -0.08;
  g.add(roof);
  g.add(box(2.4, 0.06, 0.4, M.wood(), 0, 0.45, -0.25), box(2.6, 1.6, 0.05, colMat('#5a6a6a', { roughness: 0.3, transparent: true, opacity: 0.45 }), 0, 0.4, -0.55));
  for (const sx of [-1, 1]) g.add(box(0.06, 0.45, 0.4, M.steel(), sx * 1.1, 0, -0.25));
  s.add(shade(at(g, x, z)));
  addSolid(x - 1.4, z - 0.6, x + 1.4, z - 0.1);
}

/** A cairn of stones bleached white, bones set between them with care: given to the sun. */
export function cairn(s: O, x: number, z: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const stone = colMat('#e8e2d4', { roughness: 1 });
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const rad = 0.32 - i * 0.04;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), stone);
    st.scale.y = 0.55;
    st.position.set((r() - 0.5) * 0.08, y + rad * 0.5, (r() - 0.5) * 0.08);
    st.rotation.y = r() * 6;
    g.add(shade(st));
    y += rad * 0.9;
  }
  for (let i = 0; i < 3; i++) g.add(beam(new THREE.Vector3((r() - 0.5) * 0.5, 0.05, (r() - 0.5) * 0.5 + 0.3), new THREE.Vector3((r() - 0.5) * 0.6, 0.08, (r() - 0.5) * 0.5 + 0.35), 0.04, colMat('#f0ead8')));
  s.add(at(g, x, z));
  addSolid(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
}

/** A concrete headwall where a drain runs under the road, its culvert mouth black. */
export function headwall(s: O, x: number, z: number, w: number, h: number, facing: 1 | -1): void {
  const g = new THREE.Group();
  g.add(box(w, h, 0.4, M.concrete(), 0, 0, 0));
  g.add(box(w + 0.3, 0.16, 0.5, M.concrete(), 0, h, 0));
  g.rotation.y = facing < 0 ? Math.PI : 0;
  s.add(shade(at(g, x, z, -1.45)));
  addSolid(x - w / 2, z - 0.25, x + w / 2, z + 0.25); // a rail at the road's edge: no stepping off into the drain
}

// ------------------------------------------------------------------ the highway

/** A retaining wall face, from the ground up to `top`, along x0→x1 at z (or along z when vertical). */
export function retainingWall(s: O, x0: number, z0: number, x1: number, z1: number, top: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const w = box(len, top + 1.2, 0.35, M.concrete(), 0, 0, 0);
  w.position.set(mx, -1.0 + (top + 1.2) / 2, mz); // from a metre below grade up to the deck
  w.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  s.add(w);
  w.add(box(len + 0.05, 0.12, 0.42, M.concrete(), 0, (top + 1.2) / 2 - 0.12, 0)); // cap course
}

/** Jersey barriers along a line, every 2 units, the odd one knocked askew. */
export function jerseys(s: O, pts: Array<[number, number]>, seed: number, y?: number): void {
  const r = rng(seed);
  const mat = M.concrete();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2));
    const rot = -Math.atan2(bz - az, bx - ax);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const sh = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.12, 0.25), new THREE.Vector2(0.08, 0.8), new THREE.Vector2(-0.08, 0.8), new THREE.Vector2(-0.12, 0.25)]);
      const j = prism(sh, Math.min(1.9, len / n - 0.08), mat);
      j.rotation.y = rot + Math.PI / 2 + (r() < 0.12 ? (r() - 0.5) * 0.5 : 0);
      j.position.set(x, (y ?? heightAt(x, z)) - 0.02, z);
      s.add(j);
    }
    // solid end to end, not just under each block's middle: a line of barriers is a wall
    for (let k = 0, m = Math.max(1, Math.ceil(len / 0.5)); k <= m; k++) {
      const x = ax + ((bx - ax) * k) / m, z = az + ((bz - az) * k) / m;
      addSolid(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
    }
  }
}

/** A highway sign face-down where it fell: you see its steel back and brackets. Its face kept the old letters. */
export function fallenSign(s: O, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  const back = box(4.6, 0.12, 2.3, colMat('#8a8e8a', { metalness: 0.5, roughness: 0.6 }), 0, 0, 0);
  g.add(back);
  g.add(box(4.6, 0.04, 2.3, colMat('#1e5a3a', { roughness: 0.8 }), 0, -0.02, 0)); // the green, underneath
  for (const bx of [-1.4, 1.4]) g.add(box(0.12, 0.14, 2.4, M.steel(), bx, 0.12, 0));
  g.add(beam(new THREE.Vector3(1.6, 0.2, 0.6), new THREE.Vector3(3.2, 1.5, 1.6), 0.14, M.steel())); // a bent post, still bolted on
  g.rotation.set(0.04, rot, 0.03);
  s.add(shade(at(g, x, z, 0.05)));
  addSolid(x - 2.3, z - 1.2, x + 2.3, z + 1.2);
}

/** The checkpoint gantry over the on-ramp: its scanner still sweeps, its light still asks you to stop. A routine. */
export function gantry(s: O, x0: number, z0: number, x1: number, z1: number, y: number, night: boolean): Built {
  const g = new THREE.Group();
  const top = 4.4;
  for (const [x, z] of [[x0, z0], [x1, z1]] as Array<[number, number]>) { g.add(box(0.36, top + y - heightAt(x, z), 0.36, M.steel(), x, heightAt(x, z), z)); addSolid(x - 0.25, z - 0.25, x + 0.25, z + 0.25); }
  g.add(beam(new THREE.Vector3(x0, y + top, z0), new THREE.Vector3(x1, y + top, z1), 0.32, M.steel()));
  g.add(beam(new THREE.Vector3(x0, y + top - 0.6, z0), new THREE.Vector3(x1, y + top - 0.6, z1), 0.14, M.steel()));
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const scanner = new THREE.Group();
  scanner.position.set(mx, y + top - 0.45, mz);
  scanner.add(box(0.5, 0.3, 0.4, colMat('#3a3e3a', { metalness: 0.4 }), 0, -0.15, 0));
  const lens = glow('#ff3020', 0);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lens);
  l.position.set(0, -0.15, 0.22);
  scanner.add(l);
  g.add(scanner);
  const sign = new THREE.Mesh(planeGeo(1.8, 0.45), new THREE.MeshStandardMaterial({ map: textTexture('STOP', { w: 48, h: 12, bg: '#8a2a1e', fg: '#e8e0cc', font: 'bold 10px monospace', worn: 0.25, seed: 9 }), roughness: 1 }));
  sign.position.set(mx + 1.4, y + top + 0.45, mz + 0.2);
  g.add(sign);
  s.add(shade(g));
  return { update(t) { scanner.rotation.y = Math.sin(t * 0.7) * 0.6; lens.emissiveIntensity = Math.floor(t * 1.2) % 2 ? (night ? 4 : 2) : 0.1; } };
}

/** A fuel canopy over dead pumps: shade nobody uses, because everyone knows it's open on all sides. */
export function fuelCanopy(s: O, x: number, z: number, w: number, d: number): void {
  const g = new THREE.Group();
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) g.add(box(0.4, 4.2, 0.4, M.concrete(), px * (w / 2 - 0.8), 0, pz * (d / 2 - 0.8)));
  const roofMat = M.tin();
  g.add(box(w, 0.5, d, roofMat, 0, 4.2, 0));
  g.add(box(w + 0.1, 0.4, 0.06, colMat('#c8c4b4', { roughness: 0.8 }), 0, 4.25, d / 2 + 0.03)); // fascia, blank
  for (const px of [-w / 4, w / 4]) {
    g.add(box(1.0, 0.25, 2.6, M.concrete(), px, 0, 0));
    for (const pz of [-0.7, 0.7]) {
      g.add(box(0.5, 1.4, 0.35, colMat('#a8a49a', { roughness: 0.7 }), px, 0.25, pz));
      g.add(box(0.36, 0.22, 0.02, colMat('#141210'), px, 1.15, pz + 0.18));
    }
    addSolid(x + px - 0.55, z - 1.35, x + px + 0.55, z + 1.35);
  }
  s.add(shade(at(g, x, z)));
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) addSolid(x + px * (w / 2 - 0.8) - 0.25, z + pz * (d / 2 - 0.8) - 0.25, x + px * (w / 2 - 0.8) + 0.25, z + pz * (d / 2 - 0.8) + 0.25);
  occluders.push({ mats: [roofMat], rect: [x - w / 2, z - d / 2 - 4, x + w / 2, z + d / 2 - 0.5], k: 1 });
}

// ------------------------------------------------------------------ the White Bowl

/** The intake tower: a concrete column standing in the dry lake, its walkway to shore broken off. The Bowl's hero. */
export function intakeTower(s: O, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(cyl(1.15, 1.35, 6.4, M.concrete(), 0, -0.3, 0, 18));
  g.add(cyl(1.5, 1.5, 0.2, M.concrete(), 0, 6.1, 0, 18));
  g.add(box(1.8, 1.4, 1.8, M.concrete(), 0, 6.3, 0));
  g.add(box(2.2, 0.16, 2.2, M.concrete(), 0, 7.7, 0));
  g.add(box(0.5, 0.9, 0.05, colMat('#141210'), 0, 6.4, 0.92)); // a doorway, dark
  // the old waterline: a dark band where the lake used to stand, and a pale one above
  g.add(cyl(1.17, 1.21, 0.5, colMat('#6a645a', { roughness: 1 }), 0, 2.2, 0, 18));
  // the walkway truss, broken off a few spans out
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Vector3(-1.4 - i * 2.2, 6.2, 0), b = new THREE.Vector3(-3.6 - i * 2.2, 6.2 - (i === 2 ? 0.6 : 0), 0);
    g.add(beam(a, b, 0.14, M.steel()), beam(a.clone().setY(6.9), b.clone().setY(6.9 - (i === 2 ? 0.6 : 0)), 0.1, M.steel()), beam(a, b.clone().setY(6.9 - (i === 2 ? 0.6 : 0)), 0.06, M.steel()));
  }
  vines(g, 0.5, -0.3, 1.36, 1.4, 2.4);
  s.add(shade(at(g, x, z)));
  addSolid(x - 1.3, z - 1.3, x + 1.3, z + 1.3);
}

/** A navigation buoy tipped over on the lake bed, its lamp still blinking for boats. The Bowl's routine. */
export function buoy(s: O, x: number, z: number, night: boolean): Built {
  const g = new THREE.Group();
  const body = new THREE.Mesh(cylGeo(0.35, 0.45, 1.2, 12), colMat('#b8402e', { roughness: 0.7 }));
  body.rotation.z = Math.PI / 2 - 0.3;
  body.position.set(0, 0.42, 0);
  g.add(shade(body));
  g.add(box(0.7, 0.1, 0.2, colMat('#e8e0cc'), 0.1, 0.55, 0));
  const lampMat = glow('#ffffff', 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lampMat);
  lamp.position.set(0.75, 0.7, 0);
  g.add(lamp);
  g.add(cyl(0.02, 0.02, 0.9, colMat('#4a4642'), -0.9, 0, 0.3, 4)); // the chain, gone slack
  s.add(at(g, x, z));
  addSolid(x - 0.6, z - 0.4, x + 0.6, z + 0.4);
  return { update(t) { const c = t % 4; lampMat.emissiveIntensity = c < 0.35 ? (night ? 7 : 3) : 0.05; } };
}

/** A boat hull stranded on the lake bed. */
export function boatHull(s: O, x: number, z: number, len: number, rot: number, tilt: number, color: string): void {
  const sh = new THREE.Shape();
  sh.moveTo(-len / 2, 0.55); sh.quadraticCurveTo(-len / 2 + 0.3, 0, 0, 0); sh.quadraticCurveTo(len / 2 - 0.2, 0, len / 2 + 0.25, 0.7); sh.lineTo(-len / 2, 0.7); sh.closePath();
  const g = new THREE.Group();
  const hull = prism(sh, len * 0.36, colMat(color, { roughness: 0.8 }));
  g.add(hull);
  g.add(box(len * 0.75, 0.05, len * 0.32, M.wood(), -0.1, 0.62, 0));
  g.add(box(0.06, 0.36, len * 0.34, M.wood(), -len * 0.15, 0.4, 0));
  g.rotation.set(tilt, rot, tilt * 0.6);
  s.add(shade(at(g, x, z, -0.12)));
  const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  addSolid(x - (len / 2) * c - 0.4 * sn, z - (len / 2) * sn - 0.4 * c, x + (len / 2) * c + 0.4 * sn, z + (len / 2) * sn + 0.4 * c);
}

/** A boat trailer rusting at the foot of the ramp. */
export function trailer(s: O, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  g.add(beam(new THREE.Vector3(-1.6, 0.35, -0.5), new THREE.Vector3(1.4, 0.35, -0.5), 0.1, M.rust()), beam(new THREE.Vector3(-1.6, 0.35, 0.5), new THREE.Vector3(1.4, 0.35, 0.5), 0.1, M.rust()));
  g.add(beam(new THREE.Vector3(1.4, 0.35, -0.5), new THREE.Vector3(2.4, 0.3, 0), 0.08, M.rust()), beam(new THREE.Vector3(1.4, 0.35, 0.5), new THREE.Vector3(2.4, 0.3, 0), 0.08, M.rust()));
  for (const wz of [-0.62, 0.62]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 6, 12), colMat('#1d1b19')); w.position.set(-0.4, 0.26, wz); g.add(w); }
  g.rotation.y = rot;
  s.add(shade(at(g, x, z)));
  addSolid(x - 1.3, z - 1.3, x + 1.3, z + 1.3);
}

/** A picnic shelter: a slab roof on four posts over a table, built to last, and it did. */
export function picnicShelter(s: O, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  g.add(box(4.2, 0.12, 3.4, M.concrete(), 0, -0.04, 0));
  for (const [px, pz] of [[-1.7, -1.3], [1.7, -1.3], [1.7, 1.3], [-1.7, 1.3]] as Array<[number, number]>) g.add(box(0.22, 2.5, 0.22, M.concrete(), px, 0, pz));
  const roof = box(4.8, 0.2, 4.0, M.tin(), 0, 2.5, 0);
  roof.rotation.z = 0.06;
  g.add(roof);
  g.add(box(2.2, 0.08, 0.8, M.concrete(), 0, 0.72, 0), box(0.2, 0.72, 0.5, M.concrete(), 0, 0, 0));
  for (const pz of [-0.75, 0.75]) g.add(box(2.2, 0.06, 0.3, M.concrete(), 0, 0.42, pz), box(0.16, 0.42, 0.2, M.concrete(), 0, 0, pz));
  g.rotation.y = rot;
  s.add(shade(at(g, x, z)));
  for (const [px, pz] of [[-1.7, -1.3], [1.7, -1.3], [1.7, 1.3], [-1.7, 1.3]] as Array<[number, number]>) {
    const c = Math.cos(rot), sn = Math.sin(rot), wx = x + px * c + pz * sn, wz = z - px * sn + pz * c;
    addSolid(wx - 0.15, wz - 0.15, wx + 0.15, wz + 0.15);
  }
  addSolid(x - 1.1, z - 0.4, x + 1.1, z + 0.4);
  occluders.push({ mats: [roof.material as THREE.Material], rect: [x - 2.4, z - 5.4, x + 2.4, z + 1.2], k: 1 });
}

// ------------------------------------------------------------------ ways through to the places beyond town

/**
 * An underpass: a concrete box through the old rail embankment, the road running in under it and the far end
 * too far to see. The way to the mall (the owner, 2026-10-29: "a tunnel that allows us to load it"). `facing` is
 * the side the mouth opens to: +1 south (toward the camera), -1 north. Its dark is a wall: whoever walks in is gone.
 */
export function underpass(s: O, x: number, z: number, w: number, facing: 1 | -1): void {
  const D = 5, H = 2.6, BERM = 10;
  const g = new THREE.Group();
  const conc = colMat('#9a958a', { roughness: 0.9 }), earth = colMat('#8a7656', { roughness: 1 }), steel = colMat('#4a4440', { metalness: 0.5, roughness: 0.6 });
  const dark = new THREE.MeshBasicMaterial({ color: '#040404' });
  // the box: two walls, a deck, a face band with a parapet; inside, nothing you can see
  for (const sx of [-1, 1]) g.add(box(0.6, H, D, conc, sx * (w / 2 + 0.3), 0, -D / 2));
  g.add(box(w + 1.2, 0.5, D, conc, 0, H, -D / 2));
  g.add(box(w + 1.2, 0.5, 0.3, conc, 0, H + 0.5, 0.1));
  const inside = new THREE.Mesh(boxGeo(w, H, 0.2), dark);
  inside.position.set(0, H / 2, -1.6);
  g.add(inside);
  // the embankment either side, stepped down toward its foot, and the rails across the top
  for (const sx of [-1, 1]) {
    const cx = sx * (w / 2 + 0.6 + BERM / 2);
    g.add(box(BERM, H + 0.5, D, earth, cx, 0, -D / 2), box(BERM, (H + 0.5) * 0.55, 1.6, earth, cx, 0, 0.7));
  }
  for (const rx of [-0.75, 0.75]) g.add(box(w + 2 * BERM + 1.2, 0.12, 0.1, steel, 0, H + 0.5, -D / 2 + rx));
  for (let i = -12; i <= 12; i++) g.add(box(0.22, 0.08, 2.0, colMat('#5a4636', { roughness: 1 }), i * 0.68, H + 0.46, -D / 2));
  g.rotation.y = facing > 0 ? 0 : Math.PI;
  s.add(shade(at(g, x, z)));
  // the walls and the embankment are solid; the mouth is open
  const zA = facing > 0 ? z - D : z - 2.3, zB = facing > 0 ? z + 2.3 : z + D;
  addSolid(x - w / 2 - 0.6 - BERM, zA, x - w / 2, zB);
  addSolid(x + w / 2, zA, x + w / 2 + 0.6 + BERM, zB);
  // coming at it from the far side of the camera, the embankment thins so she can be seen walking in
  if (facing < 0) occluders.push({ mats: [conc, earth], rect: [x - w / 2 - BERM, z - 7, x + w / 2 + BERM, z + D], k: 1 });
}

/** Where a footpath leaves for somewhere: two posts and a crossbar, a lantern hung from it, lit at night. */
export function trailGate(s: O, x: number, z: number, w: number, rot: number, night: boolean): Built {
  const g = new THREE.Group();
  const wood = colMat('#6a5038', { roughness: 1 });
  for (const sx of [-1, 1]) g.add(box(0.18, 2.6, 0.18, wood, sx * w / 2, 0, 0));
  g.add(box(w + 0.5, 0.16, 0.16, wood, 0, 2.5, 0));
  g.add(box(0.03, 0.4, 0.03, colMat('#222', {}), 0, 2.1, 0));
  const glass = colMat('#ffd590', { emissive: new THREE.Color(night ? '#ffb35c' : '#000000'), emissiveIntensity: night ? 3 : 0 });
  g.add(box(0.22, 0.3, 0.22, glass, 0, 1.8, 0));
  g.rotation.y = rot;
  s.add(shade(at(g, x, z)));
  for (const sx of [-1, 1]) { const px = x + Math.cos(rot) * sx * w / 2, pz = z - Math.sin(rot) * sx * w / 2; addSolid(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15); }
  return { update(t: number) { if (night) glass.emissiveIntensity = 3 * (0.92 + Math.sin(t * 5.1) * 0.06); } };
}
