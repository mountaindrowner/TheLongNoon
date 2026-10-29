import * as THREE from 'three';
import { box, boxGeo, cyl, cylGeo, colMat, shade, planeGeo } from '../../engine/geo';
import { addSolid } from '../../engine/world';
import { rng, vnoise, fbm } from '../../engine/noise';
import { Pix, textTexture } from '../../engine/textures';
import { interior, type InteriorDress } from '../../engine/interior';
import { dressDoor, markDoor } from '../../engine/doorway';
import { M } from '../../engine/buildings';
import { pendant } from '../../engine/kit';
import type { AreaBuilder } from '../../engine/area';
import type { RGB } from '../../engine/section';

/**
 * The Span's rooms: the interiors behind its lit doors, built with the
 * spec's interior kit (§10: cutaway walls, pooled lamps, the way out always
 * lit). Furniture is primitives at world texel density, like everything else.
 * Tiers (spec §8.3): the home and the houses are lived_in; the chapel is tidy.
 */

const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const pick = (pal: RGB[], k: number): RGB => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(k * pal.length)))]!;

// ------------------------------------------------------------------ floors

/** The old store's floor: big faded tiles, a path worn pale between the door and the table. */
function storeTile(x: number, z: number, fine: number): RGB {
  const tile = (Math.floor(x) + Math.floor(z)) % 2 === 0;
  let c = tile ? mix(H('#b8b0a0'), H('#a8a090'), fine * 0.4) : mix(H('#7a7468'), H('#6e685c'), fine * 0.4);
  const fx = x % 1, fz = z % 1;
  if (fx < 0.06 || fz < 0.06) c = H('#4e4a42');
  if (fbm(x * 0.4, z * 0.4, 81, 3) > 0.62) c = mix(c, H('#6a5a44'), 0.35); // dust and grime
  return c;
}
/** Saltillo: square terracotta, uneven, grout gone dark. */
function saltillo(x: number, z: number, fine: number): RGB {
  const tx = Math.floor(x), tz = Math.floor(z);
  let c = pick(['#9a5a3a', '#a8643e', '#8e5034', '#b06e46'].map(H), vnoise(tx * 1.7, tz * 2.3, 82) * 0.8 + fine * 0.3);
  if (x % 1 < 0.07 || z % 1 < 0.07) c = H('#3e2a20');
  if (fine > 0.985) c = mix(c, H('#e8d8b8'), 0.4); // candle wax
  return c;
}
/** Plank floor, scuffed. */
function planks(x: number, z: number, fine: number): RGB {
  const row = Math.floor(z * 3);
  let c = mix(H('#6b4f36'), H('#86654a'), vnoise(row * 3.1, Math.floor(x / 2.3 + row * 0.7) * 1.3, 83) * 0.7 + fine * 0.25);
  if ((z * 3) % 1 < 0.1) c = H('#33241a');
  if (fbm(x * 0.5, z * 0.5, 84, 2) > 0.7) c = mix(c, H('#a89a80'), 0.25);
  return c;
}
/** Packed earth with a woven mat in the middle. */
function earth(x: number, z: number, fine: number): RGB {
  return pick(['#8a7458', '#967e60', '#7e6a50', '#a08868'].map(H), fbm(x * 0.6, z * 0.6, 85, 2) * 0.8 + fine * 0.3);
}

// ------------------------------------------------------------------ furniture

type P = THREE.Object3D;
const solid = (x: number, z: number, hw: number, hd: number): void => addSolid(x - hw, z - hd, x + hw, z + hd);

export function table(g: P, x: number, z: number, w = 1.6, d = 0.9, rot = 0): THREE.Group {
  const t = new THREE.Group();
  t.add(box(w, 0.08, d, M.wood(), 0, 0.72, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) t.add(box(0.08, 0.72, 0.08, M.wood(), sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
  t.position.set(x, 0, z);
  t.rotation.y = rot;
  g.add(shade(t));
  solid(x, z, w / 2, d / 2);
  return t;
}
export function chair(g: P, x: number, z: number, rot: number): void {
  const c = new THREE.Group();
  c.add(box(0.42, 0.05, 0.42, M.wood(), 0, 0.42, 0));
  c.add(box(0.42, 0.5, 0.05, M.wood(), 0, 0.45, -0.19));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) c.add(box(0.05, 0.42, 0.05, M.wood(), sx * 0.17, 0, sz * 0.17));
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(shade(c));
}
export function cot(g: P, x: number, z: number, blanket: string, rot = 0, made = true): void {
  const c = new THREE.Group();
  c.add(box(0.85, 0.32, 1.9, M.steel(), 0, 0.12, 0));
  c.add(box(0.8, 0.12, 1.85, colMat('#d8d0bc', { roughness: 1 }), 0, 0.44, 0));
  const b = box(0.84, 0.08, made ? 1.3 : 0.7, colMat(blanket, { roughness: 1 }), 0, 0.55, made ? 0.25 : 0.55);
  c.add(b);
  c.add(box(0.5, 0.12, 0.32, colMat('#ece4d2', { roughness: 1 }), 0, 0.56, -0.7)); // pillow
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(shade(c));
  solid(x, z, rot ? 0.95 : 0.45, rot ? 0.45 : 0.95);
}
/** Shelving: steel racks with whatever's on them. */
export function shelf(g: P, x: number, z: number, w: number, seed: number, goods: 'jars' | 'empty' | 'jugs' = 'jars'): void {
  const r = rng(seed);
  const s = new THREE.Group();
  for (const sx of [-1, 1]) s.add(box(0.06, 1.9, 0.06, M.steel(), sx * w / 2, 0, -0.22), box(0.06, 1.9, 0.06, M.steel(), sx * w / 2, 0, 0.22));
  const JAR = ['#c8a050', '#8a3a2a', '#6a8a4a', '#d8d0bc', '#4f86b0'];
  for (const y of [0.35, 0.95, 1.55]) {
    s.add(box(w, 0.04, 0.5, M.steel(), 0, y, 0));
    if (goods === 'empty') continue;
    for (let i = 0; i < w / 0.22; i++) {
      if (r() < 0.35) continue;
      const col = goods === 'jugs' ? '#4f86b0' : JAR[Math.floor(r() * JAR.length)]!;
      s.add(cyl(0.07, 0.07, 0.16 + r() * 0.12, colMat(col, { roughness: goods === 'jugs' ? 0.25 : 0.5 }), -w / 2 + 0.12 + i * 0.22, y + 0.04, (r() - 0.5) * 0.2, 7));
    }
  }
  s.position.set(x, 0, z);
  g.add(shade(s));
  solid(x, z, w / 2, 0.26);
}
/** A stove made from a drum: a flue up into the dark, a pot on top, a glow at the grate. */
export function drumStove(g: P, x: number, z: number, lit: boolean): THREE.MeshStandardMaterial {
  const s = new THREE.Group();
  const body = new THREE.Mesh(cylGeo(0.32, 0.32, 0.8, 12), M.rust());
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.45;
  s.add(shade(body));
  s.add(box(0.08, 0.2, 0.6, M.steel(), -0.3, 0, 0), box(0.08, 0.2, 0.6, M.steel(), 0.3, 0, 0));
  s.add(cyl(0.06, 0.06, 2.4, M.steel(), 0.25, 0.7, 0, 8));
  const pot = cyl(0.2, 0.17, 0.26, colMat('#3a3632', { metalness: 0.5 }), -0.1, 0.77, 0, 10);
  s.add(pot);
  const glow = colMat('#ff7a2a', { emissive: '#ff5a10', emissiveIntensity: lit ? 2.5 : 0 }).clone();
  const grate = new THREE.Mesh(planeGeo(0.3, 0.14), glow);
  grate.position.set(-0.41, 0.45, 0);
  grate.rotation.y = -Math.PI / 2;
  s.add(grate);
  s.position.set(x, 0, z);
  g.add(s);
  solid(x, z, 0.45, 0.35);
  return glow;
}
/** A curtain on a wire: how a room becomes rooms. */
export function curtain(g: P, x0: number, z0: number, x1: number, z1: number, color: string): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const c = new THREE.Mesh(planeGeo(len, 1.85), colMat(color, { roughness: 1, side: THREE.DoubleSide }));
  c.position.set((x0 + x1) / 2, 0.98, (z0 + z1) / 2);
  c.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  c.castShadow = true;
  g.add(c);
  g.add(box(len, 0.02, 0.02, colMat('#1a1816'), (x0 + x1) / 2, 1.92, (z0 + z1) / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0)));
}
export function rug(g: P, x: number, z: number, w: number, d: number, seed: number): void {
  const p = new Pix(32, 32), r = rng(seed);
  const COL = [H('#8a3a2a'), H('#d8b23a'), H('#3f6a8a'), H('#e8e0cc')];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const band = Math.floor(Math.abs(y - 16) / 3);
    let c = COL[band % 4]!;
    if (x < 2 || x > 29) c = H('#e8e0cc');
    if (r() < 0.06) c = mix(c, H('#5a4a3a'), 0.4);
    p.set(x, y, c);
  }
  const m = new THREE.Mesh(planeGeo(w, d), new THREE.MeshStandardMaterial({ map: p.texture({ repeat: false, worldSize: false }), roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.012, z);
  m.receiveShadow = true;
  g.add(m);
}
/** Candles in jars, for a table or an altar. Returns their flames for a flicker. */
export function candles(g: P, x: number, y: number, z: number, n: number, seed: number, spread = 0.5): THREE.MeshStandardMaterial {
  const r = rng(seed);
  const flame = colMat('#ffd890', { emissive: '#ffb050', emissiveIntensity: 3.2 }).clone();
  for (let i = 0; i < n; i++) {
    const cx = x + (r() - 0.5) * spread * 2, cz = z + (r() - 0.5) * spread * 0.6;
    const hh = 0.08 + r() * 0.14;
    g.add(cyl(0.035, 0.035, hh, colMat(r() < 0.5 ? '#e8e0cc' : '#c8402e', { roughness: 0.8, transparent: true, opacity: 0.9 }), cx, y, cz, 6));
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), flame);
    f.scale.y = 1.8;
    f.position.set(cx, y + hh + 0.025, cz);
    g.add(f);
  }
  return flame;
}
/** A table lantern: a pooled lamp and a glowing core. */
export function tableLantern(d: InteriorDress, x: number, y: number, z: number): void {
  const core = new THREE.Mesh(boxGeo(0.13, 0.18, 0.13), colMat('#ffcf7a', { emissive: '#ffa850', emissiveIntensity: 3.5 }));
  core.position.set(x, y + 0.13, z);
  d.root.add(core, box(0.17, 0.03, 0.17, M.steel(), x, y + 0.22, z), box(0.17, 0.03, 0.17, M.steel(), x, y, z));
  d.pool.add({ pos: new THREE.Vector3(x, y + 0.5, z + 0.2), color: new THREE.Color('#ffb060'), intensity: 7, dist: 7, flicker: 0.15 });
}
/** Chalk drawings on a wall, in a kid's hand. */
export function chalkWall(g: P, x: number, y: number, z: number, w: number, h: number, seed: number): void {
  const W = 64, Hh = 32, p = new Pix(W, Hh), r = rng(seed);
  for (let i = 0; i < W * Hh; i++) p.set(i % W, Math.floor(i / W), [0, 0, 0], 0);
  const dot = (px: number, py: number, c: RGB): void => p.set(Math.round(px), Math.round(py), c, 255);
  const WHITE = H('#ece6d6'), YEL = H('#e8c84a'), RED = H('#d8604a');
  for (let a = 0; a < 6.28; a += 0.2) dot(10 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, YEL); // a sun
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; for (let s = 7; s < 10; s++) dot(10 + Math.cos(a) * s, 9 + Math.sin(a) * s, YEL); }
  for (const gx of [30, 42]) { for (let i = 0; i < 7; i++) dot(gx + i, 20, WHITE); dot(gx, 21, WHITE); dot(gx + 6, 21, WHITE); dot(gx, 22, WHITE); dot(gx + 6, 22, WHITE); dot(gx + 7, 19, WHITE); dot(gx + 8, 18, WHITE); } // goats
  // a thing on six wheels, with one eye
  for (let i = 0; i < 12; i++) dot(48 + i, 8, RED);
  for (let i = 0; i < 12; i++) dot(48 + i, 12, RED);
  for (const wx of [49, 53, 57]) { dot(wx, 13, WHITE); dot(wx + 1, 14, WHITE); }
  dot(54, 10, RED);
  for (let i = 0; i < 30; i++) dot(4 + r() * 56, 26 + r() * 4, WHITE); // tally marks, scuffed
  const t = p.texture({ repeat: false, worldSize: false });
  const m = new THREE.Mesh(planeGeo(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, color: '#c8c2b4' }));
  m.position.set(x, y, z);
  g.add(m);
}
/** An old radio, its dial still lit off a battery. Old tech, still doing its job: the room's routine. */
export function radio(g: P, x: number, y: number, z: number): THREE.MeshStandardMaterial {
  g.add(box(0.5, 0.3, 0.22, colMat('#5a3a26', { roughness: 0.6 }), x, y, z));
  const dial = colMat('#ffd890', { emissive: '#ffb040', emissiveIntensity: 1.6 }).clone();
  const d = new THREE.Mesh(planeGeo(0.22, 0.08), dial);
  d.position.set(x + 0.08, y + 0.18, z + 0.115);
  g.add(d);
  g.add(box(0.12, 0.12, 0.02, colMat('#2a2420'), x - 0.14, y + 0.09, z + 0.11));
  return dial;
}
export function pew(g: P, x: number, z: number, w: number): void {
  const p = new THREE.Group();
  p.add(box(w, 0.06, 0.42, M.wood(), 0, 0.44, 0), box(w, 0.55, 0.06, M.wood(), 0, 0.47, -0.2));
  for (const sx of [-1, 1]) p.add(box(0.07, 0.95, 0.46, M.wood(), sx * (w / 2 - 0.04), 0, 0));
  p.position.set(x, 0, z);
  g.add(shade(p));
  solid(x, z, w / 2, 0.24);
}

// ------------------------------------------------------------------ the way out

/** The way back out: a gap in the front wall, lit (every way in is lit, spec §12). By night the doorway shows the night. */
function roomExit(d: InteriorDress, x: number, to: string, spawn: string, night: boolean, w = 1.4): void {
  const rows = d.grid.rows;
  d.spawns.door = { x, z: rows - 1.4, face: 'N' };
  d.triggers.push({ x0: x - 1.2, x1: x + 1.2, z0: rows - 0.15, z1: rows + 2, go: { to, spawn } });
  markDoor(x, rows - 0.1, 'open');
  if (!night) { d.built.push(dressDoor(d.root, x, 0, rows - 0.04, w, 2.1, 'open', night, Math.PI, { daylight: true })); return; }
  // by night the way out is the night itself: the gap in the cut-away front wall and a cool spill of moonlight
  // on the floor. No lamp: the lamp is on the other side of the door, for the people coming in.
  const g = new THREE.Group();
  g.position.set(x, 0, rows - 0.04);
  const spill = new THREE.Mesh(planeGeo(w * 1.3, 1.5), new THREE.MeshBasicMaterial({ color: '#4a6aa0', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.02, -0.7);
  g.add(spill);
  g.add(box(w + 0.3, 0.08, 0.5, M.concrete(), 0, 0, 0.26));
  d.root.add(g);
}
const carve = (g: { set(x: number, z: number, c: string): void; rows: number }, x: number, w = 1.4): void => {
  for (let k = Math.floor(x - w / 2); k < Math.ceil(x + w / 2); k++) g.set(k, g.rows - 1, '.');
};

// ------------------------------------------------------------------ the rooms

export interface RoomLinks { to: string; spawn: string; night: boolean }

/** Inside the old store: one big room the family has made into several. */
export function marHome(l: RoomLinks): AreaBuilder {
  const COLS = 18, ROWS = 11, DOOR = 13;
  return interior({
    id: 'mar-home', title: 'Mar Farm', sub: 'Inside', kind: 'home', cols: COLS, rows: ROWS, seed: 501, wall: 'block',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR); },
    floor: (_g, x, z, f) => storeTile(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night);
      // the store's old shelving along the back wall: seeds, jars, a few jugs
      shelf(g, 3.2, 1.6, 3.2, 1, 'jars');
      shelf(g, 7.0, 1.6, 3.2, 2, 'jugs');
      shelf(g, 11.0, 1.6, 2.6, 3, 'empty');
      // the kitchen corner
      const stove = drumStove(g, 15.6, 2.4, true);
      table(g, 13.2, 3.4, 1.8, 1.0);
      chair(g, 12.4, 4.4, Math.PI); chair(g, 14.0, 4.3, Math.PI + 0.2); chair(g, 13.2, 2.4, 0.1);
      tableLantern(d, 13.6, 0.8, 3.3);
      // the staybook, open on the table
      const book = new THREE.Mesh(boxGeo(0.42, 0.04, 0.3), new THREE.MeshStandardMaterial({ map: textTexture('', { w: 16, h: 12, bg: '#e8e0c8', fg: '#253a66', font: '8px monospace' }), roughness: 1 }));
      book.position.set(12.8, 0.82, 3.4);
      book.rotation.y = 0.2;
      g.add(book);
      // the family's corners, made with sheets on wires
      curtain(g, 1.0, 5.6, 5.4, 5.6, '#7a8a9a');
      curtain(g, 5.4, 5.6, 5.4, 9.2, '#7a8a9a');
      cot(g, 2.2, 7.6, '#8a3a2a');
      cot(g, 4.1, 7.6, '#3f6a8a', 0, false); // one bed nobody's slept in
      curtain(g, 6.6, 5.6, 6.6, 9.4, '#9a7a5a');
      cot(g, 8.0, 7.8, '#d8b23a', Math.PI / 2);
      rug(g, 10.6, 7.4, 2.6, 1.8, 7);
      // milk in a crock by the door, and the water, always by the door
      g.add(cyl(0.22, 0.18, 0.4, colMat('#c8b49a', { roughness: 0.7 }), 15.6, 0, 8.4, 10));
      for (let i = 0; i < 4; i++) g.add(cyl(0.16, 0.16, 0.42, colMat('#4f86b0', { roughness: 0.25, transparent: true, opacity: 0.88 }), 16.2 - (i % 2) * 0.36, 0, 6.2 + Math.floor(i / 2) * 0.36, 10));
      pendant(g, d.pool, 9, 4.6, true);
      d.things.push(
        { x: 12.8, z: 4.2, r: 1.4, label: 'Counter', lines: ['The counter. A clean square in the dust, where a book sat for a long time.'] },
        { x: 5.0, z: 2.4, r: 1.6, label: 'Shelves', lines: ['Store shelves. Nothing on them but jars of seed, labeled by hand.'] },
        { x: 4.1, z: 8.6, r: 1.2, label: 'Cot', script: 'cot', lines: ['The blanket is folded. Nobody has slept here in a while.'] },
        { x: 12.4, z: 4.9, r: 1.0, label: 'Papá’s chair', lines: ['Papá’s chair, still facing the door.', 'He slept in it at the end. Never in the bed.'] },
        { x: 11.2, z: 5.4, r: 0.9, label: 'Shoes', script: 'shoes' },
        { x: 9.6, z: 8.4, r: 1.3, label: 'Workbench', script: 'workbench' },
      );
      // his shoes by the chair, until they go to Toña's shrine (night four)
      const shoes = new THREE.Group();
      for (const sx of [-0.12, 0.12]) shoes.add(box(0.14, 0.12, 0.34, colMat('#4a3424', { roughness: 1 }), sx, 0, 0));
      shoes.position.set(11.4, 0, 5.3);
      shoes.userData.when = '!shoes_given';
      g.add(shoes);
      // his workbench under the window: a vise, a coil of wire, a lamp
      g.add(box(2.2, 0.9, 0.7, M.wood(), 9.6, 0, 9.3), box(0.3, 0.2, 0.3, M.steel(), 8.9, 0.9, 9.3));
      addSolid(8.5, 8.95, 10.7, 9.65);
      d.built.push({ update(t) { stove.emissiveIntensity = 2.5 * (0.85 + Math.sin(t * 6.1) * 0.1 + Math.sin(t * 13.3) * 0.05); } });
    },
  });
}

/** The Chapel: pews, the altar, and rows of candles that someone lights every Lamp. */
export function chapel(l: RoomLinks): AreaBuilder {
  const COLS = 13, ROWS = 15, DOOR = 6.5;
  return interior({
    id: 'chapel', title: 'The Chapel', sub: '', kind: 'town', cols: COLS, rows: ROWS, seed: 502, wall: 'brick',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR, 1.8); },
    floor: (_g, x, z, f) => saltillo(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 1.8);
      // the altar: a table under a cloth, a cross of two boards on the wall above
      g.add(box(3.2, 0.95, 1.0, M.wood(), 6.5, 0, 2.0));
      g.add(box(3.3, 0.04, 1.1, colMat('#ece4d2', { roughness: 1 }), 6.5, 0.95, 2.0));
      g.add(box(0.14, 1.5, 0.08, M.wood(), 6.5, 1.25, 1.06), box(0.9, 0.14, 0.08, M.wood(), 6.5, 2.2, 1.06));
      const altar = candles(g, 6.5, 0.99, 2.0, 14, 9, 1.4);
      addSolid(4.9, 1.5, 8.1, 2.5);
      // the votive rack: rows of candles in jars
      g.add(box(2.2, 0.8, 0.6, M.steel(), 10.6, 0, 3.6), box(2.2, 0.04, 0.7, M.steel(), 10.6, 0.8, 3.6));
      const rack = candles(g, 10.6, 0.84, 3.6, 22, 10, 1.0);
      addSolid(9.5, 3.3, 11.7, 3.9);
      for (let i = 0; i < 4; i++) { pew(g, 4.2, 5.6 + i * 1.6, 3.6); pew(g, 8.8, 5.6 + i * 1.6, 3.6); }
      d.pool.add({ pos: new THREE.Vector3(6.5, 1.6, 2.8), color: new THREE.Color('#ffb860'), intensity: 9, dist: 9, flicker: 0.2 });
      d.pool.add({ pos: new THREE.Vector3(10.6, 1.4, 4.2), color: new THREE.Color('#ffb060'), intensity: 6, dist: 6, flicker: 0.25 });
      pendant(g, d.pool, 6.5, 8.6, true);
      // Abuela Toña sits outside now, at the elders' table (the owner's map, 2026-10-27)
      d.things.push({ x: 10.6, z: 4.4, r: 1.4, label: 'Candles', lines: ['Rows of candles in jars. Three of them are new tonight.'] });
      // the elders' table (night two): Lupe, Memo, Chayo and Beto, at the front pews
      d.npcs.push(
        { id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 6.5, z: 3.6, face: 'S', when: 'n2_table' },
        { id: 'memo', name: 'Memo', sprite: 'memo', x: 4.4, z: 4.3, face: 'E', when: 'n2_table' },
        { id: 'chayo', name: 'Doña Chayo', sprite: 'chayo', x: 8.8, z: 4.3, face: 'W', when: 'n2_table' },
        { id: 'beto', name: 'Don Beto', sprite: 'beto', x: 3.2, z: 5.0, face: 'E', when: 'n2_table' },
      );
      d.built.push({ update(t) { altar.emissiveIntensity = 3.2 * (0.9 + Math.sin(t * 7.3) * 0.07); rack.emissiveIntensity = 3.2 * (0.88 + Math.sin(t * 9.1 + 1) * 0.09); } });
    },
  });
}

/** Doña Fina's: she boils water and sells it, and the house is the business. */
export function finaHouse(l: RoomLinks): AreaBuilder {
  const COLS = 12, ROWS = 9, DOOR = 6;
  return interior({
    id: 'fina-house', title: "Doña Fina's", sub: '', kind: 'town', cols: COLS, rows: ROWS, seed: 503, wall: 'boards',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR); },
    floor: (_g, x, z, f) => planks(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night);
      const stove = drumStove(g, 2.0, 2.0, true);
      g.add(cyl(0.32, 0.3, 0.42, colMat('#4a4642', { metalness: 0.5 }), 2.4, 0.9, 2.0, 12)); // the big pot
      shelf(g, 5.6, 1.4, 3.6, 21, 'jugs');
      shelf(g, 9.6, 1.4, 2.4, 22, 'jars');
      table(g, 6.0, 4.4, 2.2, 0.9);
      for (let i = 0; i < 5; i++) g.add(cyl(0.07, 0.07, 0.26, colMat('#cfe6ee', { roughness: 0.2, transparent: true, opacity: 0.7 }), 5.2 + i * 0.4, 0.8, 4.4, 7));
      const dial = radio(g, 9.8, 0.8, 4.3);
      table(g, 9.8, 4.4, 1.0, 0.6);
      // the blessing: a picture, a candle, a sprig
      g.add(box(0.5, 0.6, 0.04, colMat('#c8a050', { metalness: 0.4 }), 10.6, 1.4, 1.06));
      const flame = candles(g, 10.6, 0.8, 1.5, 3, 31, 0.15);
      cot(g, 2.4, 6.6, '#6a8a4a', Math.PI / 2);
      rug(g, 6.0, 6.8, 2.2, 1.4, 12);
      tableLantern(d, 6.8, 0.8, 4.5);
      // Doña Fina is out at her stall in the plaza (the owner's map, 2026-10-27)
      d.things.push(
        { x: 2.4, z: 2.9, r: 1.4, label: 'Pot', lines: ['A pot the size of a child, at a slow boil. The steam smells like iron.'] },
        { x: 9.8, z: 5.0, r: 1.2, label: 'Radio', lines: ['An old radio. The dial is lit. Nothing comes out of it but a low hiss, and she leaves it on.'] },
      );
      d.built.push({ update(t) { stove.emissiveIntensity = 2.5 * (0.85 + Math.sin(t * 5.7) * 0.12); dial.emissiveIntensity = 1.6 + Math.sin(t * 0.7) * 0.15; flame.emissiveIntensity = 3.2 * (0.9 + Math.sin(t * 8.7) * 0.08); } });
    },
  });
}

/** Where Tavo and Nina sleep: a tin room, bunks, and a wall they've drawn on. */
export function kidsHouse(l: RoomLinks): AreaBuilder {
  const COLS = 11, ROWS = 9, DOOR = 5;
  return interior({
    id: 'kids-house', title: "Tavo and Nina's", sub: '', kind: 'town', cols: COLS, rows: ROWS, seed: 504, wall: 'tin',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR); },
    floor: (_g, x, z, f) => earth(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night);
      // bunks of pipe and plywood
      for (const bx of [1.8, 9.2]) {
        g.add(box(0.9, 0.05, 1.9, M.wood(), bx, 0.4, 3.0), box(0.9, 0.05, 1.9, M.wood(), bx, 1.35, 3.0));
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) g.add(box(0.05, 1.8, 0.05, M.steel(), bx + sx * 0.42, 0, 3.0 + sz * 0.92));
        g.add(box(0.85, 0.1, 1.4, colMat(bx < 5 ? '#c86a3a' : '#3f6a8a', { roughness: 1 }), bx, 0.45, 3.2), box(0.85, 0.1, 1.4, colMat('#d8b23a', { roughness: 1 }), bx, 1.4, 3.2));
        addSolid(bx - 0.48, 2.0, bx + 0.48, 4.0);
      }
      chalkWall(g, 5.5, 1.5, 1.04, 3.6, 1.8, 41);
      table(g, 5.5, 5.0, 1.4, 0.8);
      chair(g, 4.8, 5.9, Math.PI); chair(g, 6.2, 5.9, Math.PI);
      tableLantern(d, 5.9, 0.8, 4.9);
      // a water filter: two buckets stacked, a tap, a cup
      g.add(cyl(0.22, 0.2, 0.42, colMat('#d8d0bc', { roughness: 0.6 }), 9.4, 0, 6.6, 10), cyl(0.22, 0.2, 0.42, colMat('#d8d0bc', { roughness: 0.6 }), 9.4, 0.42, 6.6, 10));
      addSolid(9.1, 6.3, 9.7, 6.9);
      // a toy: a little truck made from a can, on six bottle-cap wheels
      g.add(box(0.3, 0.12, 0.14, colMat('#b8bcc0', { metalness: 0.6 }), 3.6, 0.04, 6.2));
      for (const wx of [-0.1, 0, 0.1]) for (const wz of [-0.08, 0.08]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8), colMat('#c8402e')); w.rotation.x = Math.PI / 2; w.position.set(3.6 + wx, 0.035, 6.2 + wz); g.add(w); }
      d.things.push(
        { x: 5.5, z: 1.9, r: 1.8, label: 'Drawings', lines: ['Chalk on the tin: a sun, two goats, a row of tally marks.', 'In one corner, something long on six wheels, with one red eye.'] },
        { x: 3.6, z: 6.2, r: 1.0, label: 'Toy', lines: ['A can on six bottle-cap wheels. Somebody worked hard on the wheels.'] },
      );
    },
  });
}


/**
 * The hall at the Open Door (church.ts): the old sanctuary, kept. Chairs in rows facing a plain cross, cots along
 * the walls for whoever's sleeping out the white, a long table with bread by the door. By the inner door, out of
 * the sun for a century, a plaque that still has most of the church's old name (methodology §3.5: the Old Name).
 */
export function churchHall(l: RoomLinks): AreaBuilder {
  const COLS = 14, ROWS = 18, DOOR = 7;
  return interior({
    id: 'church-hall', title: 'The Open Door', sub: 'The hall', kind: 'town', cols: COLS, rows: ROWS, seed: 505, wall: 'concrete',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR, 1.8); },
    floor: (_g, x, z, f) => saltillo(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 1.8);
      // the platform at the far end, a lectern, and a cross of two plain beams on the wall
      g.add(box(8, 0.3, 2.6, M.wood(), 7, 0, 2.2));
      addSolid(3, 0.9, 11, 3.5);
      g.add(box(0.7, 1.1, 0.5, M.wood(), 7, 0.3, 2.6));
      g.add(box(0.24, 3.2, 0.14, M.wood(), 7, 0.6, 1.06), box(1.7, 0.24, 0.14, M.wood(), 7, 2.9, 1.06));
      const alt = candles(g, 4.6, 0.32, 2.0, 8, 5, 0.6), alt2 = candles(g, 9.4, 0.32, 2.0, 8, 6, 0.6);
      d.pool.add({ pos: new THREE.Vector3(7, 2.2, 2.6), color: new THREE.Color('#ffc070'), intensity: 8, dist: 9, flicker: 0.15 });
      // chairs in rows; the back ones pushed aside for the cots
      for (let i = 0; i < 3; i++) { pew(g, 4.4, 5.6 + i * 1.5, 3.4); pew(g, 9.6, 5.6 + i * 1.5, 3.4); }
      for (let i = 0; i < 4; i++) { cot(g, 1.3, 6.2 + i * 2.1, ['#8a3a2a', '#3f6a8a', '#d8b23a', '#6a8a4a'][i]!, Math.PI / 2, i % 2 === 0); cot(g, 12.7, 6.6 + i * 2.1, ['#a87a5a', '#7a8a9a', '#8a3a2a', '#3f6a8a'][i]!, Math.PI / 2, i % 2 === 1); }
      // the long table by the door: bread under a cloth, jugs, cups turned over to dry
      table(g, 4.4, 14.6, 3.4, 1.0); table(g, 9.6, 14.6, 3.4, 1.0);
      g.add(box(1.4, 0.04, 0.6, colMat('#ece4d2', { roughness: 1 }), 4.0, 0.82, 14.6));
      for (let i = 0; i < 4; i++) g.add(cyl(0.15, 0.15, 0.4, colMat('#4f86b0', { roughness: 0.25, transparent: true, opacity: 0.88 }), 9.0 + i * 0.36, 0.8, 14.5, 10));
      pendant(g, d.pool, 7, 9, true);
      pendant(g, d.pool, 7, 14, true);
      d.npcs.push({ id: 'abel', name: 'Pastor Abel', sprite: 'abel', x: 7, z: 4.4, face: 'S', lines: [
        'Come in out of it. Nobody here is going to ask you for anything.',
        'We don’t know much about the people who built this place. We know they fed whoever came up the road, and we know who they did it for.',
        'So we keep doing it. That’s most of what I preach.',
      ] });
      d.things.push(
        { x: 7, z: 1.8, r: 1.6, label: 'Cross', lines: ['A cross of two plain beams on the wall. Candles in jars along the platform under it.'] },
        { x: 11.6, z: ROWS - 1.6, r: 1.3, label: 'Plaque', lines: ['A brass plaque inside the door, out of the sun all these years. The first letters are worn away.', '…CH OF THE CROSSROADS'] },
        { x: 4.4, z: 13.6, r: 1.4, label: 'Bread', lines: ['Flat bread under a cloth, still warm. Mesquite flour, by the color of it.'] },
      );
      d.built.push({ update(t) { alt.emissiveIntensity = 3 * (0.9 + Math.sin(t * 6.7) * 0.08); alt2.emissiveIntensity = 3 * (0.9 + Math.sin(t * 8.3 + 1) * 0.08); } });
    },
  });
}

/**
 * Inside the mall's centre court (mall.ts): the concourse running off both ways into the dark, shop fronts behind
 * pulled-down grilles, a dry fountain, a skylight with half its panes gone letting the outside in. A scavenger's
 * camp by the fountain: whoever hangs the lantern at the doors sleeps here.
 */
export function mallCourt(l: RoomLinks): AreaBuilder {
  const COLS = 24, ROWS = 12, DOOR = 12;
  return interior({
    id: 'mall-court', title: 'The Mall', sub: 'The centre court', kind: 'town', cols: COLS, rows: ROWS, seed: 506, wall: 'concrete',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR, 2.2); },
    floor: (_g, x, z, f) => {
      // terrazzo under a skin of sand blown in through the broken skylight
      const sand = fbmLike(x, z) > 0.62 || (Math.abs(x - 12) < 3 && z < 7 && f > 0.4);
      if (sand) return [196, 178, 140];
      return f > 0.97 ? [120, 116, 110] : [(176 + f * 14) | 0, (170 + f * 12) | 0, (160 + f * 10) | 0];
    },
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 2.2);
      // shop fronts along the back: grilles pulled down, one up a foot off the floor
      const grille = colMat('#5a5c5e', { metalness: 0.5, roughness: 0.5 });
      for (let i = 0; i < 5; i++) {
        const x = 2.6 + i * 4.7;
        g.add(box(4.2, 0.5, 0.2, colMat('#2a2826', { roughness: 1 }), x, 2.6, 1.1)); // the dark sign band, letters long gone
        const up = i === 3 ? 0.35 : 0;
        for (let b = 0; b < 18; b++) g.add(box(0.04, 2.5 - up, 0.04, grille, x - 2 + b * 0.235, up, 1.3));
        g.add(box(4.2, 0.08, 0.1, grille, x, 2.5, 1.3));
      }
      addSolid(0.4, 0.4, COLS - 0.4, 1.5);
      // the fountain: a ring of tile, dry, a century of coins gone green in the bottom
      g.add(cyl(1.8, 1.9, 0.5, colMat('#8aa4a8', { roughness: 0.6 }), 12, 0, 5.4, 18), cyl(1.55, 1.55, 0.06, colMat('#4a6a5a', { roughness: 1 }), 12, 0.46, 5.4, 18));
      g.add(cyl(0.2, 0.26, 1.4, colMat('#8aa4a8', { roughness: 0.6 }), 12, 0.5, 5.4, 10));
      addSolid(10.2, 3.6, 13.8, 7.2);
      // benches either side, and the scavenger's camp: a bedroll, a pack, a lantern burning low
      for (const x of [5, 19]) { g.add(box(2.2, 0.1, 0.6, M.wood(), x, 0.45, 6.4)); for (const sx of [-0.9, 0.9]) g.add(box(0.1, 0.45, 0.5, M.steel(), x + sx, 0, 6.4)); }
      g.add(box(0.9, 0.12, 2.0, colMat('#6a5a3e', { roughness: 1 }), 15.6, 0, 7.4), box(0.5, 0.5, 0.4, colMat('#4a5a3a', { roughness: 1 }), 16.4, 0, 6.2));
      tableLantern(d, 15.0, 0.02, 6.4);
      // the skylight's light falling through, pale by night, white by day
      d.pool.add({ pos: new THREE.Vector3(12, 4, 5.4), color: new THREE.Color(l.night ? '#7a90c0' : '#fff2d8'), intensity: l.night ? 5 : 12, dist: 10, flicker: 0 });
      d.npcs.push({ id: 'scav', name: 'Scavenger', sprite: 'scav', x: 17.4, z: 7.8, face: 'W', lines: [
        'Don’t touch the pack. Anything else in here, take it if you can find it.',
        'Grilles are down on all of it. Except that one. I don’t go in that one.',
      ] });
      d.things.push(
        { x: 12, z: 7.4, r: 2.2, label: 'Fountain', lines: ['A tiled fountain, dry. The bottom is green with old coins, more than anyone could count.'] },
        { x: 16.7, z: 2.2, r: 1.6, label: 'Grille', script: 'grille' },
        { x: 7.3, z: 2.2, r: 1.6, label: 'Shop', lines: ['A steel grille pulled down to the floor and locked. Behind it, racks, and shapes on them.'] },
      );
      d.spawns.grille = { x: 16.7, z: 2.9, face: 'S' };
      // the light under the one grille that's up: somebody kept the lights on in there
      const under = new THREE.Mesh(planeGeo(4, 0.5), new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      under.rotation.x = -Math.PI / 2;
      under.position.set(16.7, 0.02, 1.62);
      g.add(under);
    },
  });
}

/**
 * Behind the one grille that's up (mallCourt): a toy store with the lights still on. Every toy on every shelf set
 * out in a perfect row, faced forward, dusted, and a shop machine behind the counter that still says welcome.
 * Nobody has bought anything in a hundred years; it keeps the shelves as if somebody might. (A Shrine: the
 * methodology's word for a place the old world left running.)
 */
export function mallShop(l: RoomLinks): AreaBuilder {
  const COLS = 14, ROWS = 10, DOOR = 7;
  return interior({
    id: 'mall-shop', title: 'The Mall', sub: 'The toy store', kind: 'town', cols: COLS, rows: ROWS, seed: 507, wall: 'concrete',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR, 3.4); },
    // the store's floor, clean: the machine sweeps it, in squares
    floor: (_g, x, z, f) => ((Math.floor(x) + Math.floor(z)) % 2 === 0 ? [(214 + f * 10) | 0, (206 + f * 8) | 0, (192 + f * 8) | 0] : [(150 + f * 8) | 0, (176 + f * 8) | 0, (190 + f * 8) | 0]),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 3.4);
      // the grille, a hand's width up, seen from inside
      const grille = colMat('#5a5c5e', { metalness: 0.5, roughness: 0.5 });
      for (let b = 0; b < 15; b++) g.add(box(0.04, 2.15, 0.04, grille, DOOR - 1.7 + b * 0.24, 0.35, ROWS - 0.2));
      // shelves: every toy in a perfect row, the same distance apart, faced forward
      const TOY = ['#d84a3a', '#3a7ad8', '#e8c03a', '#5aa85a', '#e88ac0', '#f0ece0'];
      const rack = (x: number, z: number, w: number, rot: number, k: number): void => {
        const s = new THREE.Group();
        for (const sx of [-1, 1]) s.add(box(0.06, 1.8, 0.5, colMat('#e8e4dc', { roughness: 0.6 }), sx * w / 2, 0, 0));
        for (const [j, y] of [0.3, 0.85, 1.4].entries()) {
          s.add(box(w, 0.05, 0.5, colMat('#e8e4dc', { roughness: 0.6 }), 0, y, 0));
          const col = colMat(TOY[(k + j) % TOY.length]!, { roughness: 0.8 });
          for (let i = 0; i < Math.floor(w / 0.34); i++) {
            const tx = -w / 2 + 0.22 + i * 0.34;
            // blocks, balls and boxed dolls, alternating by shelf, never out of line
            if (j === 0) s.add(box(0.2, 0.2, 0.2, col, tx, y + 0.03, 0));
            else if (j === 1) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), col); b.position.set(tx, y + 0.13, 0); s.add(b); }
            else s.add(box(0.18, 0.32, 0.1, col, tx, y + 0.03, 0.08), box(0.1, 0.12, 0.02, colMat('#f4d8c0', { roughness: 1 }), tx, y + 0.16, 0.14));
          }
        }
        s.position.set(x, 0, z);
        s.rotation.y = rot;
        g.add(shade(s));
      };
      rack(4.2, 1.6, 5.2, 0, 0); rack(10.4, 1.6, 4.6, 0, 2);
      addSolid(1, 1.3, COLS - 1, 1.9);
      rack(1.6, 5.2, 3.6, Math.PI / 2, 4); solid(1.6, 5.2, 0.26, 1.8);
      rack(5.4, 5.2, 3.0, 0, 1); solid(5.4, 5.2, 1.55, 0.3);
      // the counter, and the machine behind it, a register on top
      g.add(box(3.2, 1.0, 0.8, colMat('#c8443a', { roughness: 0.7 }), 10.6, 0, 4.6), box(3.3, 0.06, 0.9, colMat('#f0ece0', { roughness: 0.5 }), 10.6, 1.0, 4.6));
      g.add(box(0.5, 0.3, 0.4, colMat('#3a3c40', { metalness: 0.4, roughness: 0.5 }), 11.6, 1.06, 4.6));
      solid(10.6, 4.6, 1.65, 0.45);
      // the store's sign band on the back wall, its letters long gone, still blue
      g.add(box(4.0, 0.4, 0.06, colMat('#3a7ad8', { roughness: 0.6 }), 10.4, 2.3, 1.04));
      // the lights on: every one still burning
      for (const x of [4.2, 10.4]) pendant(g, d.pool, x, 3.2, false, 2.6);
      d.pool.add({ pos: new THREE.Vector3(7, 2.4, 6.4), color: new THREE.Color('#e8f4ff'), intensity: 6, dist: 8, flicker: 0 });
      d.npcs.push({ id: 'keeper', name: 'Keeper', sprite: 'keeper', x: 10.6, z: 3.9, face: 'S', lines: ['Welcome! Let me know if you need help finding anything.'] });
      d.things.push(
        { x: 4.2, z: 2.6, r: 1.6, label: 'Shelves', lines: ['Toys in rows, every one the same distance from the next, every one faced forward. No dust on any of them.'] },
        { x: 5.4, z: 6.0, r: 1.4, label: 'Price tags', lines: ['Price tags in a money nobody uses. The numbers are small.'] },
      );
    },
  });
}
const fbmLike = (x: number, z: number): number => (Math.sin(x * 0.9 + Math.sin(z * 0.7) * 2) + Math.sin(z * 1.3 + x * 0.4)) * 0.25 + 0.5;

/**
 * The Cellars (night two, the water shift): Doña Inés's home, dug under an old house behind the Plaza. Steps down
 * from the hatch, a room cut into the caliche, cool all day. Inés and Güero live here (night three's search ends
 * here). Lit low: a lantern and a candle.
 */
export function cellar(l: RoomLinks): AreaBuilder {
  const COLS = 12, ROWS = 9, DOOR = 6;
  return interior({
    id: 'cellar', title: 'The Cellars', sub: 'Doña Inés’s', kind: 'home', cols: COLS, rows: ROWS, seed: 508, wall: 'block',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR); },
    floor: (_g, x, z, f) => earth(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night);
      // the steps down from the hatch, cut into the caliche
      for (let i = 0; i < 3; i++) g.add(box(1.4, 0.12 * (3 - i), 0.5, colMat('#b8a27a', { roughness: 1 }), DOOR, 0, ROWS - 1.6 - i * 0.5));
      cot(g, 2.0, 3.0, '#d8b23a', Math.PI / 2);
      cot(g, 2.0, 5.6, '#8a3a2a', Math.PI / 2, false);
      table(g, 8.6, 3.0, 1.8, 1.0);
      chair(g, 8.0, 4.0, Math.PI); chair(g, 9.4, 3.9, Math.PI + 0.2);
      tableLantern(d, 8.8, 0.8, 2.9);
      // a shrine niche cut in the wall: a candle, a toy truck, a picture
      const shrine = candles(g, 10.6, 0.8, 1.2, 3, 21, 0.4);
      g.add(box(1.2, 0.06, 0.4, colMat('#8a7656', { roughness: 1 }), 10.6, 0.76, 1.2));
      for (let i = 0; i < 3; i++) g.add(cyl(0.16, 0.16, 0.42, colMat('#4f86b0', { roughness: 0.25, transparent: true, opacity: 0.88 }), 4.2 + i * 0.38, 0, 7.4, 10));
      d.npcs.push(
        { id: 'ines', name: 'Doña Inés', sprite: 'ines', x: 7.4, z: 5.4, face: 'S', lines: ['Mind your head on the way down. Everybody hits it once.'] },
        // Güero's out east, after the machines, while Juno searches; never home again if she doesn't find him
        { id: 'guero', name: 'Güero', sprite: 'guero', x: 3.6, z: 4.4, face: 'E', when: '!guero_lost&!n3_search', lines: ['Kit says you killed a Stray with your face.'] },
      );
      d.things.push(
        { x: 10.6, z: 2.0, r: 1.3, label: 'Niche', lines: ['A niche cut in the wall: a candle, a toy truck with no wheels, a picture of a man in a cap.'] },
        { x: 4.6, z: 6.8, r: 1.2, label: 'Jugs', lines: ['Water jugs, lined up by the steps where the floor is coolest.'] },
      );
      d.built.push({ update(t) { shrine.emissiveIntensity = 3 * (0.9 + Math.sin(t * 7.7) * 0.08); } });
    },
  });
}

/**
 * The Big Store (Papá's salvage route, nights two and five): a supermarket the size of a field, its roof fallen
 * in at the back, the light coming down through the hole. Aisles of steel shelving, most of it stripped; Papá's
 * chalk on the end of one, and two shelves he never cleared. Feral dogs den in the back on night two.
 */
export function bigStore(l: RoomLinks): AreaBuilder {
  const COLS = 26, ROWS = 16, DOOR = 13;
  return interior({
    id: 'big-store', title: 'The Big Store', sub: 'Papá’s route', kind: 'town', cols: COLS, rows: ROWS, seed: 509, wall: 'concrete',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) {
      carve(g, DOOR, 2.4);
      // the back of the store, where the roof came down: rubble, not floor
      for (let x = 18; x < 25; x++) for (let z = 1; z < 4; z++) if ((x * 7 + z * 3) % 5 < 2) g.set(x, z, 'r');
    },
    floor: (_g, x, z, f) => storeTile(x, z, f),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 2.4);
      // the aisles: long runs of shelving, most of it stripped bare, one run fallen against the next
      for (const [x, z, w] of [[5.0, 3.6, 7], [5.0, 7.2, 7], [5.0, 10.8, 7], [15.0, 7.2, 6], [15.0, 10.8, 6]] as Array<[number, number, number]>) shelf(g, x, z, w, Math.round(x * 3 + z), 'empty');
      const fallen = new THREE.Group();
      fallen.add(box(6, 0.1, 1.9, M.steel(), 0, 0, 0));
      fallen.position.set(15.0, 0.8, 3.8); fallen.rotation.x = 0.5;
      g.add(shade(fallen));
      addSolid(12, 3.0, 18, 4.6);
      // the high end-cap where Papá chalked his route: E.H., and a tick on every shelf but two
      g.add(box(0.5, 2.6, 1.4, M.steel(), 9.0, 0, 7.2));
      g.add(box(0.02, 0.4, 0.9, colMat('#e8e4dc', { roughness: 1 }), 9.26, 1.8, 7.2));
      // the hole in the roof: the night (or the white) coming straight down on the rubble
      d.pool.add({ pos: new THREE.Vector3(21, 4, 2.4), color: new THREE.Color(l.night ? '#8aa0d0' : '#fff2d8'), intensity: l.night ? 6 : 14, dist: 9, flicker: 0 });
      pendant(g, d.pool, 6, 13, true);
      d.things.push(
        { x: 9.8, z: 7.2, r: 1.4, label: 'Chalk', script: 'ehshelf', lines: ['Papá’s chalk: E.H., and a tick on every shelf.'] },
        { x: 5.0, z: 12.0, r: 1.6, label: 'Shelves', lines: ['Steel shelving, picked clean. Somebody left the price tags.'] },
        { x: 21, z: 4.6, r: 2.0, label: 'Rubble', lines: ['Where the roof came down. Something has been sleeping in the rubble. More than one something.'] },
      );
      // the back half of the store: on night two, the dogs come out of the dark here
      d.triggers.push({ x0: 11, x1: 24, z0: 4.8, z1: 9.5, script: 'dogs', when: 'n2_store&!dogs_done' });
    },
  });
}

/**
 * Inside the drone (night six): a corridor tilted where the hull came down, dead maintenance drones in their
 * racks, screens still flickering words Juno can't read, a picture of clouds somebody kept. The cradle with the
 * canister at the far end. It hums.
 */
export function fuselage(l: RoomLinks): AreaBuilder {
  const COLS = 22, ROWS = 8, DOOR = 18;
  return interior({
    id: 'fuselage', title: 'The Wreck', sub: 'Inside', kind: 'town', cols: COLS, rows: ROWS, seed: 510, wall: 'tin',
    start: { x: DOOR, z: ROWS - 1.4, face: 'N' },
    ground(g) { carve(g, DOOR, 1.6); },
    floor: (_g, x, z, f) => ((Math.floor(x * 2) + Math.floor(z * 2)) % 2 === 0 ? [(96 + f * 8) | 0, (100 + f * 8) | 0, (104 + f * 8) | 0] : [(84 + f * 8) | 0, (88 + f * 8) | 0, (92 + f * 8) | 0]),
    dress(d) {
      const g = d.root;
      roomExit(d, DOOR, l.to, l.spawn, l.night, 1.6);
      // the ribs of the hull, leaning where it came down
      for (let i = 0; i < 9; i++) { const r = box(0.16, 3.0, 0.16, colMat('#5a5e64', { metalness: 0.6, roughness: 0.4 }), 2 + i * 2.3, 0, 1.1); r.rotation.z = 0.18; g.add(r); }
      // dead maintenance drones in their racks, and screens still on
      const screen = colMat('#0a1a14', { emissive: new THREE.Color('#3aff9a'), emissiveIntensity: 1.6 });
      for (let i = 0; i < 4; i++) {
        g.add(box(0.9, 0.5, 0.7, colMat('#8a8e94', { metalness: 0.5, roughness: 0.5 }), 5 + i * 3.4, 0, 2.0));
        g.add(box(0.8, 0.5, 0.06, screen, 6.4 + i * 3.4, 1.2, 1.24));
      }
      addSolid(4, 1.4, 17, 2.6);
      // the cradle at the far end: cold metal arms round an empty place, frost on them
      g.add(box(1.6, 0.8, 1.2, colMat('#c8d0d8', { metalness: 0.7, roughness: 0.3 }), 2.2, 0, 4.6));
      const frost = colMat('#e8f6ff', { emissive: new THREE.Color('#9ad8ff'), emissiveIntensity: 0.8 });
      g.add(box(0.5, 0.6, 0.5, frost, 2.2, 0.8, 4.6));
      addSolid(1.3, 3.9, 3.1, 5.3);
      d.pool.add({ pos: new THREE.Vector3(2.4, 1.6, 4.8), color: new THREE.Color('#9ad8ff'), intensity: 6, dist: 6, flicker: 0.05 });
      pendant(g, d.pool, 12, 5, false, 2.4);
      d.things.push(
        { x: 3.6, z: 4.6, r: 1.6, label: 'Cradle', script: 'cradle' },
        { x: 9.8, z: 3.0, r: 1.4, label: 'Screens', lines: ['Screens, still lit. Words go by on them, too fast and too many. Juno can’t read them.'] },
        { x: 14.6, z: 3.0, r: 1.4, label: 'Picture', lines: ['A picture taped to a rack: a sky full of grey clouds, heavy and low. Somebody kept it here.'] },
      );
    },
  });
}
