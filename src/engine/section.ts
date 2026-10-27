import * as THREE from 'three';
import { fbm, rng, vnoise } from './noise';
import { setWorld, cell, heightAt, hitsSolid, addSolid, currentChunk, useChunk, type TileWorld } from './world';
import { buildGround, buildGrass, buildWater, setAprons } from './terrain';
import { maskAt } from './layout';
import { cottonwood, mesquite, deadTree, bush, motes, swayTrees } from './foliage';
import { fence } from './fence';
import type { Built } from './buildings';
import { DAY, NIGHT, type Mood } from './mood';
import type { Area, AreaBuilder, NPC, SectionKind, Spot, Thing, Travel, Trigger } from './area';
import { rock } from './props';
import { mergeBatched } from './batch';

/**
 * One section of a region (docs/design/regions.md): a hand-dressed map built
 * from a short spec. The kit paints the ground from a glyph grid the section
 * draws, frames each edge naturally (trees, scrub, a fence line, a bluff, or
 * open grass), cuts the exits, and wires spawns + triggers so walking off an
 * edge lands you on the matching edge of the next map.
 *
 * Glyphs: g prairie · T tall grass (wild Ohms) · d asphalt · e dirt road ·
 * v gravel · x dry cracked earth · k red clay · w water · # edge scrub.
 */

export type Side = 'n' | 's' | 'e' | 'w';
export type EdgeStyle = 'trees' | 'scrub' | 'brush' | 'fence' | 'bluff' | 'open' | 'none';

/** The plants a region frames its maps with (the engine's defaults are prairie trees). */
export interface Flora {
  tree(x: number, z: number, s: number, seed: number): THREE.Object3D;
  bush(x: number, z: number, s: number, seed: number): THREE.Object3D;
  dead(x: number, z: number, s: number, seed: number): THREE.Object3D;
  /** A clump of thorny thicket for 'brush' edges: wide, low, impassable. */
  thicket(x: number, z: number, s: number, seed: number): THREE.Object3D;
}

export interface Exit {
  side: Side;
  /** Centre of the gap along the edge (x on n/s, z on e/w). */
  at: number;
  /** Gap width (default 3). */
  w?: number;
  to: string;
  /** Spawn name in the destination. */
  spawn: string;
  /** This exit's own spawn name (arrivals from `to` land here). */
  name: string;
  travel?: Travel;
  /** Inside a region: the road runs straight on into the neighbouring map, with no cut (no trigger). */
  seam?: boolean;
}

/** The glyph grid a section draws on. */
export class Grid {
  readonly m: string[][];
  constructor(readonly cols: number, readonly rows: number, fill = 'g') {
    this.m = Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  }
  inb(x: number, z: number): boolean { return x >= 0 && z >= 0 && x < this.cols && z < this.rows; }
  get(x: number, z: number): string { x = Math.floor(x); z = Math.floor(z); return this.inb(x, z) ? this.m[z]![x]! : '#'; }
  set(x: number, z: number, c: string): void { x = Math.floor(x); z = Math.floor(z); if (this.inb(x, z)) this.m[z]![x] = c; }
  /** Every cell whose centre lies in the rectangle (fractional corners are fine). */
  rect(x0: number, z0: number, w: number, h: number, c: string): void {
    for (let z = Math.round(z0); z < Math.round(z0 + h); z++) for (let x = Math.round(x0); x < Math.round(x0 + w); x++) this.set(x, z, c);
  }
  /** A thick polyline (roads, creeks): every cell whose centre is within w/2 of the line. */
  line(pts: Array<[number, number]>, w: number, c: string, only?: (cur: string) => boolean): void {
    for (let z = 0; z < this.rows; z++)
      for (let x = 0; x < this.cols; x++) {
        if (only && !only(this.get(x, z))) continue;
        if (distToPath(x + 0.5, z + 0.5, pts) <= w / 2) this.set(x, z, c);
      }
  }
  /** A ragged blob (grass patches, clay, Static). */
  blob(cx: number, cz: number, rx: number, rz: number, c: string, seed: number, only: (cur: string) => boolean = (q) => q === 'g'): void {
    for (let z = Math.floor(cz - rz - 2); z <= cz + rz + 2; z++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (z + 0.5 - cz) / rz);
        if (d < 0.75 + vnoise(x * 0.6, z * 0.6, seed) * 0.5 && only(this.get(x, z))) this.set(x, z, c);
      }
  }
}

export function distToPath(x: number, z: number, pts: Array<[number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

type RGB = [number, number, number];
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pick = (pal: RGB[], k: number): RGB => pal[Math.min(pal.length - 1, Math.max(0, Math.floor(k * pal.length)))]!;
const DIRT = ['#6a5238', '#7a5e40', '#5a442e', '#84694a'].map(H);
const GRAVEL = ['#7a746a', '#8e877a', '#9a9284', '#666056'].map(H);
const DRY = ['#a08a66', '#b39c74', '#8f7a58', '#c2ab80'].map(H);
const CLAY = ['#8a4a32', '#9c5a3c', '#7a3f2a', '#a8664a'].map(H);

/** The region's shared painter for the extra glyphs. */
export function regionPaint(g: string, x: number, z: number, fine: number): RGB | undefined {
  const n = fbm(x * 0.5, z * 0.5, 71, 3);
  if (g === 'e') {
    let c = pick(DIRT, n * 0.7 + fine * 0.35);
    if (Math.abs((((x + z * 0.15) % 2.6) + 2.6) % 2.6 - 1.3) < 0.14 && fine > 0.35) c = H('#4e3c2a'); // wheel ruts
    if (fine > 0.992) c = H('#9a9284');
    return c;
  }
  if (g === 'v') return fine > 0.97 ? H('#b0a898') : pick(GRAVEL, n * 0.7 + fine * 0.4);
  if (g === 'x') {
    let c = pick(DRY, n * 0.8 + fine * 0.3);
    const crack = Math.abs(fbm(x * 0.8, z * 0.8, 77, 2) - 0.5) < 0.018;
    if (crack) c = H('#6a5a40');
    if (fine > 0.995) c = H('#5f6a3a');
    return c;
  }
  if (g === 'k') return fine > 0.985 ? H('#c08060') : pick(CLAY, n * 0.75 + fine * 0.35);
  if (g === 'b') {
    let c = pick(['#4e4a45', '#5e5952', '#6a645b', '#433f3a'].map(H), n * 0.6 + fine * 0.5);
    if (fbm(x * 0.3, z * 0.3, 73, 2) > 0.7) c = [c[0] * 1.15 + 18, c[1], c[2] * 0.85]; // rust run-off
    if (vnoise(x * 2, z * 2, 74) > 0.86) c = H('#4f7a2c');
    return c;
  }
  if (g === 'c') {
    // crop rows: green hills over dark furrows, the one field someone still waters
    const row = ((z % 0.9) + 0.9) % 0.9;
    if (row < 0.22) return pick(['#5a4630', '#64503a', '#523f2a'].map(H), fine);
    return pick(['#4f8a2e', '#5f9a36', '#6aa83e', '#447a28'].map(H), n * 0.6 + fine * 0.5);
  }
  return undefined;
}

export interface Dress {
  scene: THREE.Scene;
  night: boolean;
  grid: Grid;
  r: () => number;
  /** A fresh prop seed. */
  seed(): number;
  /** Add a tree (or any prop) with a small square footprint. */
  tree(o: THREE.Object3D, solid?: number): void;
  built: Built[];
  things: Thing[];
  npcs: NPC[];
  roamers: NonNullable<Area['roamers']>;
  triggers: Trigger[];
  spawns: Record<string, Spot>;
}

export interface SectionSpec {
  id: string;
  title: string;
  sub: string;
  kind: SectionKind;
  /** Battle grid theme / region id. */
  region?: string;
  cols: number;
  rows: number;
  seed: number;
  zone?: string;
  /** Draw roads, grass, water and custom ground on the grid. */
  ground(g: Grid): void;
  edges: Partial<Record<Side, EdgeStyle>>;
  exits: Exit[];
  /** Adjust the height field (gullies, embankments…); gets the kit's height. */
  height?(x: number, z: number, h: number, g: Grid): number;
  grassTint?(x: number, z: number): string | undefined;
  /** Paint a glyph this section treats specially (falls back to the region painter). */
  paint?(g: string, x: number, z: number, fine: number): RGB | undefined;
  /** Water surface height over 'w' cells. */
  waterY?: number;
  /** Place the section's buildings, props, people. */
  dress(d: Dress): void | Promise<void>;
  start?: Spot;
  mood?: Mood;
  // ---- region use (engine/region.ts): sections that join their neighbours without a cut
  /** This section's offset in its region (world units). Base terrain noise is sampled in
   *  region coordinates, so two neighbours meet at the same height. */
  origin?: [number, number];
  /** The ground glyph beyond this section's own grid: a neighbour's, so seams paint,
   *  flatten and walk as one place. Sides with a neighbour use edge style 'none'. */
  outside?(x: number, z: number): string;
  /** Seed for the base terrain noise (shared across a region). */
  heightSeed?: number;
  /** Build edge aprons (off inside a region, which frames its own outer edge). */
  aprons?: boolean;
  /** Skip this map's motes (a region runs one set around the player). */
  noMotes?: boolean;
  /** The region's plants for the edges (default: the engine's prairie trees). */
  flora?: Flora;
  /** Ground glyphs nobody walks on (besides '#' and 'w'): a raised highway behind its walls… */
  solidGlyphs?: string[];
}

const ROAD = new Set(['d', 'e', 'v']);
export type { RGB };

/** Draw a section's glyph grid: its ground, then the edge band (one row of
 *  scrub, two under a bluff) cut open at the exits. A region draws every
 *  section's grid first so neighbours can read across their seams. */
export function sectionGrid(spec: SectionSpec): Grid {
  const { cols: COLS, rows: ROWS } = spec;
  const grid = new Grid(COLS, ROWS);
  spec.ground(grid);
  const edges = spec.edges;
  const exitAt = (side: Side, a: number, pad = 0): Exit | undefined =>
    spec.exits.find((e) => e.side === side && Math.abs(a - e.at) <= (e.w ?? 3) / 2 + pad);
  for (const side of ['n', 's', 'w', 'e'] as const) {
      const st = edges[side] ?? 'trees';
      if (st === 'none') continue;
      const depth = st === 'bluff' || st === 'brush' ? 2 : 1;
      const len = side === 'n' || side === 's' ? COLS : ROWS;
      for (let a = 0; a < len; a++) {
        if (exitAt(side, a + 0.5)) continue;
        for (let k = 0; k < depth; k++) {
          const [x, z] = side === 'n' ? [a, k] : side === 's' ? [a, ROWS - 1 - k] : side === 'w' ? [k, a] : [COLS - 1 - k, a];
          grid.set(x, z, '#');
        }
      }
  }
  return grid;
}

/** `pace` is awaited between the heavy stages of a build (a region streaming maps in
 *  while you walk spreads the work over several frames). */
export function section(spec: SectionSpec, pre?: Grid, pace?: () => Promise<void>): AreaBuilder {
  return async (scene, night) => {
    const { cols: COLS, rows: ROWS } = spec;
    const grid = pre ?? sectionGrid(spec);
    const edges = spec.edges;
    const exitAt = (side: Side, a: number, pad = 0): Exit | undefined =>
      spec.exits.find((e) => e.side === side && Math.abs(a - e.at) <= (e.w ?? 3) / 2 + pad);
    // inside a region, a side with a neighbour is a seam: open ground, no frame
    const seam = (side: Side): boolean => !!spec.outside && edges[side] === 'none';
    const get = (x: number, z: number): string => (grid.inb(x, z) ? grid.get(x, z) : spec.outside?.(x, z) ?? '#');
    const edgeDist = (x: number, z: number): Record<Side, number> => ({ n: z, s: ROWS - z, w: x, e: COLS - x });
    const height = (x: number, z: number): number => {
      const [ox, oz] = spec.origin ?? [0, 0];
      let h = (fbm((x + ox) * 0.09, (z + oz) * 0.09, spec.heightSeed ?? spec.seed, 3) - 0.5) * 0.45;
      const road = Math.max(maskAt(get, 'd', x, z), maskAt(get, 'e', x, z), maskAt(get, 'v', x, z));
      h *= 1 - road * 0.9;
      h -= maskAt(get, 'w', x, z) * 0.6;
      const d = edgeDist(x, z);
      for (const side of ['n', 's', 'w', 'e'] as const) {
        const st = edges[side] ?? 'trees';
        const along = side === 'n' || side === 's' ? x : z;
        if (st === 'none' || st === 'open' || exitAt(side, along, 0.6)) continue;
        if (st === 'bluff') { if (d[side] < 3.4) h += Math.pow((3.4 - d[side]) / 3.4, 1.4) * 1.9; }
        else if (st === 'brush') { if (d[side] < 2.6) h += (2.6 - d[side]) * 0.32; }
        else if (d[side] < 1.6) h += (1.6 - d[side]) * 0.5;
      }
      // exits stay level with the road running off the map
      for (const e of spec.exits) {
        const along = e.side === 'n' || e.side === 's' ? x : z;
        if (d[e.side] < 2.2 && Math.abs(along - e.at) < (e.w ?? 3) / 2 + 0.6) h = Math.min(h, 0.05);
      }
      return spec.height ? spec.height(x, z, h, grid) : h;
    };
    const openings = spec.exits.map((e) => ({ side: e.side, x0: e.at - (e.w ?? 3) / 2 - 0.4, x1: e.at + (e.w ?? 3) / 2 + 0.4 }));
    const W: TileWorld = { cols: COLS, rows: ROWS, cell: get, height, seed: spec.seed, paint: (g, x, z, f) => spec.paint?.(g, x, z, f) ?? regionPaint(g, x, z, f), openings, grassTint: spec.grassTint };
    setWorld(W);
    const chunk = currentChunk();
    // after any pause, this map's ground and solids are current again (other maps may have been queried meanwhile)
    const step = async (): Promise<void> => { if (pace) { await pace(); useChunk(chunk); } };

    const r = rng(spec.seed * 13 + 7);
    let seedN = spec.seed * 100;
    const d: Dress = {
      scene, night, grid, r,
      seed: () => seedN++,
      tree(o, solid = 0.25) { scene.add(o); if (solid > 0) addSolid(o.position.x - solid, o.position.z - solid, o.position.x + solid, o.position.z + solid); },
      built: [], things: [], npcs: [], roamers: [], triggers: [], spawns: {},
    };

    // exits: a spawn just inside, a trigger just beyond
    for (const e of spec.exits) {
      const w = e.w ?? 3, a0 = e.at - w / 2 - 0.4, a1 = e.at + w / 2 + 0.4;
      const go = { to: e.to, spawn: e.spawn, travel: e.travel };
      const trig = (t: Trigger): void => { if (!e.seam) d.triggers.push(t); };
      if (e.side === 'n') { d.spawns[e.name] = { x: e.at, z: 1.1, face: 'S' }; trig({ x0: a0, x1: a1, z0: -3, z1: 0.3, go }); }
      if (e.side === 's') { d.spawns[e.name] = { x: e.at, z: ROWS - 1.1, face: 'N' }; trig({ x0: a0, x1: a1, z0: ROWS - 0.3, z1: ROWS + 3, go }); }
      if (e.side === 'w') { d.spawns[e.name] = { x: 1.1, z: e.at, face: 'E' }; trig({ x0: -3, x1: 0.3, z0: a0, z1: a1, go }); }
      if (e.side === 'e') { d.spawns[e.name] = { x: COLS - 1.1, z: e.at, face: 'W' }; trig({ x0: COLS - 0.3, x1: COLS + 3, z0: a0, z1: a1, go }); }
    }

    await step();
    await spec.dress(d);
    useChunk(chunk);
    await step();
    frameEdges(d, spec, exitAt);
    await step();

    setAprons(spec.aprons ?? true);
    buildGround(scene);
    setAprons(true);
    await step();
    const water: Array<[number, number]> = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) if (get(x, z) === 'w') water.push([x, z]);
    const waterTick = water.length ? buildWater(scene, night, 0, 0, COLS, ROWS, spec.waterY ?? -0.32, water) : null;
    const grass = buildGrass(scene);
    useChunk(chunk);
    mergeBatched(scene); // the static brush, a few draw calls instead of thousands
    const dust = spec.noMotes ? null : motes(scene, night);

    const inExit = (x: number, z: number): boolean => {
      if (z < 0.4) return seam('n') || !!exitAt('n', x, -0.2);
      if (z > ROWS - 0.4) return seam('s') || !!exitAt('s', x, -0.2);
      if (x < 0.4) return seam('w') || !!exitAt('w', z, -0.2);
      if (x > COLS - 0.4) return seam('e') || !!exitAt('e', z, -0.2);
      return true;
    };
    const solidGlyphs = new Set(spec.solidGlyphs ?? []);
    const blocked = (x: number, z: number, rad: number): boolean => {
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        if (px < -2.5 || pz < -2.5 || px > COLS + 2.5 || pz > ROWS + 2.5) return true;
        if (!inExit(px, pz)) return true;
        if (px < 0 || pz < 0 || px >= COLS || pz >= ROWS) continue; // running out through an exit
        const c = get(Math.floor(px), Math.floor(pz));
        if (c === '#' || c === 'w' || solidGlyphs.has(c)) return true;
      }
      return hitsSolid(x, z, rad);
    };
    const firstExit = spec.exits[0];
    const cam = {
      x0: COLS > 16.4 ? 8.2 : COLS / 2, x1: COLS > 16.4 ? COLS - 8.2 : COLS / 2,
      z0: ROWS > 9 ? 4.4 : ROWS / 2, z1: ROWS > 9 ? ROWS - 4.6 : ROWS / 2,
    };
    return {
      id: spec.id,
      title: spec.title,
      sub: spec.sub,
      kind: spec.kind,
      region: spec.region,
      mood: spec.mood ?? (night ? NIGHT : DAY),
      sky: true,
      cam,
      blocked,
      water: (x, z) => get(Math.floor(x), Math.floor(z)) === 'w',
      ground: (x, z) => heightAt(x, z),
      wild: (x, z) => get(Math.floor(x), Math.floor(z)) === 'T',
      zone: spec.zone,
      spawns: { ...d.spawns, start: spec.start ?? (firstExit ? d.spawns[firstExit.name]! : { x: COLS / 2, z: ROWS / 2 }) },
      triggers: d.triggers,
      things: d.things,
      npcs: d.npcs,
      roamers: d.roamers,
      update(t, focus) {
        grass(t);
        swayTrees(t);
        waterTick?.(t);
        for (const b of d.built) b.update?.(t);
        dust?.(t, focus);
      },
    };
  };
}

/** Natural edges: a broken tree line, scrub and a fence, a bluff with rocks, or nothing but grass. */
const PRAIRIE: Flora = {
  tree: (x, z, s, seed) => (seed % 10 < 7 ? cottonwood(x, z, s, seed) : mesquite(x, z, s, seed)),
  bush: (x, z, s, seed) => bush(x, z, s, seed, seed % 2 === 0),
  dead: deadTree,
  thicket: (x, z, s, seed) => bush(x, z, s * 1.3, seed, true),
};

function frameEdges(d: Dress, spec: SectionSpec, exitAt: (side: Side, a: number, pad?: number) => Exit | undefined): void {
  const { cols: COLS, rows: ROWS } = spec;
  const r = rng(spec.seed * 31 + 3);
  const F = spec.flora ?? PRAIRIE;
  for (const side of ['n', 's', 'w', 'e'] as const) {
    const st = spec.edges[side] ?? 'trees';
    if (st === 'none' || st === 'open') continue;
    const len = side === 'n' || side === 's' ? COLS : ROWS;
    // (along, inward depth) → world x, z
    const P = (a: number, k: number): [number, number] =>
      side === 'n' ? [a, k] : side === 's' ? [a, ROWS - k] : side === 'w' ? [k, a] : [COLS - k, a];
    const clearOf = (a: number): boolean => !exitAt(side, a, 1.4);
    if (st === 'trees') {
      for (let a = 0.4; a < len; a += 0.9 + r() * 1.6) {
        if (!clearOf(a) || r() < 0.18) continue; // gaps: you can see past the trees
        const [x, z] = P(a, 0.5 + r() * 0.5);
        const k = r();
        d.tree(k < 0.85 ? F.tree(x, z, 0.95 + r() * 0.45, d.seed()) : F.dead(x, z, 1.0, d.seed()), 0);
        const [ox, oz] = P(a + r(), -1.2 - r() * 2.8);
        if (r() > 0.25) d.scene.add(F.tree(ox, oz, 1.0 + r() * 0.5, d.seed()));
      }
    } else if (st === 'scrub') {
      for (let a = 0.5; a < len; a += 1.3 + r() * 2.2) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 0.4 + r() * 0.6);
        d.tree(r() > 0.35 ? F.bush(x, z, 0.8 + r() * 0.6, d.seed()) : F.tree(x, z, 0.9 + r() * 0.3, d.seed()), 0);
        if (r() > 0.6) { const [ox, oz] = P(a, -1.5 - r() * 2.5); d.scene.add(F.tree(ox, oz, 1.0 + r() * 0.3, d.seed())); }
      }
    } else if (st === 'brush') {
      // a wall of thorn: two rows of thicket inside the band, more beyond, the odd tree standing out of it
      for (let a = 0.3; a < len; a += 0.9 + r() * 0.9) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 0.5 + r() * 0.9);
        d.tree(F.thicket(x, z, 0.9 + r() * 0.5, d.seed()), 0);
        const [x2, z2] = P(a + r() * 0.6, -0.6 - r() * 2.4);
        d.scene.add(F.thicket(x2, z2, 1.0 + r() * 0.6, d.seed()));
        if (r() > 0.78) { const [tx, tz] = P(a + 0.4, -1.2 - r() * 3); d.scene.add(r() > 0.3 ? F.tree(tx, tz, 1.0 + r() * 0.4, d.seed()) : F.dead(tx, tz, 1.0, d.seed())); }
        if (r() > 0.55) { const [bx, bz] = P(a + 0.3, 1.6 + r() * 0.8); d.tree(F.bush(bx, bz, 0.6 + r() * 0.4, d.seed()), 0); }
      }
    } else if (st === 'fence') {
      // a fence line along the edge, broken where the exits pass; a few trees beyond
      let run: Array<[number, number]> = [];
      for (let a = 0.6; a < len - 0.4; a += 1.4) {
        if (!clearOf(a)) { if (run.length > 1) fence(d.scene, run, d.seed()); run = []; continue; }
        run.push(P(a, 1.25));
      }
      if (run.length > 1) fence(d.scene, run, d.seed());
      for (let a = 0.5; a < len; a += 1.8 + r() * 3) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 0.45);
        if (r() > 0.45) d.tree(F.bush(x, z, 0.7 + r() * 0.5, d.seed()), 0);
        const [ox, oz] = P(a + r(), -1.6 - r() * 3);
        if (r() > 0.5) d.scene.add(F.tree(ox, oz, 1.0 + r() * 0.4, d.seed()));
      }
    } else if (st === 'bluff') {
      for (let a = 0.3; a < len; a += 0.7 + r() * 1.1) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 1.0 + r() * 2.0);
        rock(d.scene, x, z, 0.35 + r() * 0.55, d.seed());
        if (r() > 0.8) { const [tx, tz] = P(a, 0.4); d.tree(F.tree(tx, tz, 0.9, d.seed()), 0); }
      }
    }
  }
}

/** True when (x, z) is on a road glyph. */
export const onRoad = (x: number, z: number): boolean => ROAD.has(cell(Math.floor(x), Math.floor(z)));
