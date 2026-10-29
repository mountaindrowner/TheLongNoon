import * as THREE from 'three';
import { regionPaint, type Grid, type RGB, type SectionSpec } from '../../engine/section';
import { building, onBuilding, M } from '../../engine/buildings';
import { powerLine, crates } from '../../engine/foliage';
import { boardSign } from '../../engine/props';
import { fence } from '../../engine/fence';
import { box, decal, texMat, shade } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { rng, fbm } from '../../engine/noise';
import { dressDoor, markDoor } from '../../engine/doorway';
import { STRAW, palm, nopal, waterTower, lanternPost, solarPanels, clothesline, shadeSail, jugs, drum, tires, carHulk, burialPlatform, roofLetters, blockWall, mailbox } from './props';
import { spanPaint, stall, stringLights, sevenFlags, well, lawnkeeper, bench, belfry, headwall, jerseys, retainingWall, underpass, trailGate } from './kit';
import { spanDoor, type SpanDoor } from './doors';
import { SPAN_FLORA, mesquite } from './brush';
import { brushFill, openScatter, motte } from './fill';
import { house, containerHome, salvageFence, yardTank, fireRing, rubble, ruinWall, type Patch } from './ruins';

/**
 * SEVEN FLAGS (the Span; the town, 192×160). North Laredo, disguised, laid
 * out from the owner's map of the real streets (2026-10-27): the Thirty-Five
 * and the rail line running up the west side on the diagonal, Del Mar along
 * the south, International and Shiloh cutting across, McPherson winding
 * north to south, side streets between them, the old creek and the Old
 * Trail going off to the north-east. West of the Thirty-Five is outside the town.
 *
 * Where the story happens (the owner's key):
 * - Mar Farm: Juno's home, a dead supermarket. Walk in to enter the interior. Hermana Lupe at the burial platform, where the game starts.
 * - The Plaza: the night market, the seven flags, the well.
 * - The Chapel: the elders' table outside it.
 * - The drain: the first fight.
 * - The Big Store: Papá's salvage route (night two).
 * - The School: the cellar (Nacho).
 * - The Old Trail: Abuelo Nacho. The dry creek: La Llorona, the Keeper.
 * - Abby's yard: the mower, the swing.
 * - The Warehouse: a landmark, no story yet.
 * - The east barricade (Memo): the east edge of town, on Del Mar.
 * - Off the edges: the White Bowl east (down the Lake Road), the Dead River west, north on the Thirty-Five.
 *
 * Hero: the seven flags. Routine: the Lawnkeeper, mowing Abby's yard. Signature: the dead supermarket with MAR on the roof.
 */

export const COLS = 192, ROWS = 160;
type Pt = [number, number];

// ------------------------------------------------------------------ the streets (centre lines, in map units)
const I35: Pt[] = [[2, 161], [10, 140], [16, 115], [28, 85], [38, 60], [46, 40], [51, 18], [53, -1]];
const RAIL: Pt[] = [[27, 161], [32, 140], [37, 118], [42, 96], [48, 70], [55, 40], [60, 18], [63, -1]];
const DELMAR: Pt[] = [[19.5, 137.8], [33, 134.7], [72, 129.8], [123, 130], [161, 130.6], [193, 124]]; // ends at the highway's wall
/** The Thirty-Five rides above the town on an embankment behind retaining walls. The only way up is the on-ramp at the top of town. */
const DECK = 2.6;
const JUNCTION = 16; // north of here the deck is open (it leads out of town); south of here, walled off
const ONRAMP: Pt[] = [[70.4, 17], [57.2, 8.2]]; // foot (on the side street) to top (the deck's east edge)
const INTL: Pt[] = [[40, 105], [104, 94.3], [136, 77], [193, 59]];
const SHILOH: Pt[] = [[44, 76], [123, 61], [193, 47.6]];
const MCPH: Pt[] = [[146, -1], [142, 19.5], [130.6, 36], [121.6, 46.3], [126.7, 59], [142, 77], [155, 90], [159, 102.7], [160, 161]];
const MAIN: Array<[Pt[], number]> = [[DELMAR, 7], [INTL, 6], [SHILOH, 6], [MCPH, 6]];
const SIDE: Pt[][] = [
  [[60, 4.7], [86, 4.7]], [[69, 4.7], [71.7, 29.7]], [[53.8, 34.8], [92, 26.5]], [[80.4, 20.7], [88.3, 66.8]],
  [[56.3, 50.2], [121, 44]], [[61.4, 65.5], [115, 54]], [[54.4, 79.4], [109.5, 71.3]], [[110, 71.5], [114, 86]],
  [[44, 108.5], [92, 107]], [[42.2, 123], [98.6, 121.6]], [[53.8, 134.7], [56.3, 161]], [[39.7, 142.3], [65.3, 141]],
  [[121.6, 134.7], [192, 134.7]], [[121.6, 152], [192, 151.3]], [[137, 134.7], [137, 161]],
  [[166.4, 83.5], [192, 91.1]], [[185.6, 69.4], [170.2, 119.3]], [[167.7, 101.4], [189.4, 107.8]],
  [[157.4, 38], [183, 28.4]], [[162.5, 52], [190.7, 43.8]], [[174, 29.7], [179, 51.5]], [[142, 77], [150, 96]],
];
const CREEK: Pt[] = [[126, 44], [160, 27], [193, 13]];
const TRAIL: Pt[] = [[123, 52], [160, 34.5], [193, 21]];
const DRAIN = { x0: 112, x1: 118.4, z0: 117 };
const PLAZA = { x0: 72, z0: 136, x1: 104, z1: 153.2 };
const STORE = { x: 143, z: 110, w: 18, d: 11.8 }; // Mar Farm: the dead supermarket
const LOT = { x0: 131.8, z0: 116.7, x1: 154.9, z1: 126.3 };
const SCHOOL = { x: 104, z: 27, w: 18, d: 9 };
const BIGSTORE = { x: 164, z: 8, w: 20, d: 10 };
const WAREHOUSE = { x: 28, z: 124, w: 10.6, d: 15 };
const CHAPEL = { x: 106, z: 105, w: 9, d: 10 };
const YARD = { x0: 163, z0: 60, x1: 179, z1: 72 }; // Abby's yard

/** Where a polyline passes at height z (for the Thirty-Five's west side: outside the town). */
function xAt(pts: Pt[], z: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    if ((z <= az && z >= bz) || (z >= az && z <= bz)) return ax + ((z - az) / (bz - az || 1)) * (bx - ax);
  }
  return pts[pts.length - 1]![0];
}
/** Distance to a polyline, and how far along it the nearest point is. */
function along(pts: Pt[], x: number, z: number): [number, number] {
  let best = Infinity, at = 0, run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; at = run + t * L; }
    run += L;
  }
  return [best, at];
}
const smoothstep = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const bbox = (pts: Pt[], pad: number): [number, number, number, number] => [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad];
const RAIL_BOX = bbox(RAIL, 2);

/**
 * Streets are painted along their true lines, not the grid cells they were laid
 * out on, so a diagonal street has a clean edge. Each 1-unit cell keeps a short
 * list of the lines near it, so the per-pixel test stays cheap.
 */
type Way = { pts: Pt[]; half: number; walk: number; kind: 'main' | 'side' | 'hwy' | 'creek' | 'trail' };
const WAYS: Way[] = [
  ...MAIN.map(([pts, w]): Way => ({ pts, half: w / 2, walk: w / 2 + 1, kind: 'main' })),
  ...SIDE.map((pts): Way => ({ pts, half: 2, walk: 2, kind: 'side' })),
  { pts: I35, half: 5.5, walk: 5.5, kind: 'hwy' },
  { pts: CREEK, half: 2.6, walk: 2.6, kind: 'creek' },
  { pts: TRAIL, half: 1.5, walk: 1.5, kind: 'trail' },
];
let near: Uint8Array[] | null = null;
function waysNear(cx: number, cz: number): Uint8Array {
  if (!near) {
    near = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      const list: number[] = [];
      WAYS.forEach((w, i) => { if (along(w.pts, x + 0.5, z + 0.5)[0] < w.walk + 1.6) list.push(i); });
      near.push(Uint8Array.from(list));
    }
  }
  return near[Math.min(ROWS - 1, Math.max(0, cz)) * COLS + Math.min(COLS - 1, Math.max(0, cx))]!;
}
/** Lots paved square (they're laid out square, so the grid is right for them). */
const inLot = (x: number, z: number): boolean => (x > LOT.x0 && x < LOT.x1 && z > LOT.z0 && z < LOT.z1) || (x > 150 && x < 178 && z > 14 && z < 24) || (x > 139.5 && x < 142.5 && z > 104 && z < LOT.z0);

/** The houses, from the owner's map: centre, size, turn (to sit square to their street), what they were, their door. */
type H = [number, number, number, number, number, Patch | 'ruin', SpanDoor?];
const HOUSES: H[] = [
  // north, by the school and the side streets off the Thirty-Five
  [76.4, 10.2, 5.4, 5, 0, 'ruin'], [83.7, 10.2, 5.6, 5, 0, 'block', 'shut'],
  [63.1, 38.3, 5.6, 5, 0.2, 'stucco', 'shut'], [70, 36.7, 5.4, 4.6, 0.2, 'block', 'shut'], [76.8, 36.3, 5, 4.6, 0.2, 'tin', 'boarded'], [86.7, 34.2, 5, 5.4, 0.2, 'block', 'shut'],
  [64.1, 43.3, 5.4, 5, 0.2, 'block', 'shut'], [71.3, 42.3, 5, 4.6, 0.2, 'stucco', 'shut'],
  [66.2, 54.3, 5.6, 5, 0.2, 'ply', 'shut'], [73.4, 52.4, 5, 4.6, 0.2, 'ruin'], [73.9, 57.2, 5, 4.4, 0.2, 'stucco', 'boarded'],
  [94.6, 48.1, 5.6, 4.8, 0.2, 'stucco', 'shut'], [95.5, 53.5, 5, 4.6, 0.2, 'block', 'shut'], [102.7, 52.1, 5, 4.6, 0.2, 'tin', 'shut'],
  // between Shiloh and International
  [55.7, 85, 5.6, 5, 0.17, 'stucco', 'shut'], [62.7, 83.7, 5, 4.6, 0.17, 'block', 'shut'], [69.9, 82.9, 5, 4.6, 0.17, 'block', 'boarded'], [63.2, 89.2, 5, 4.4, 0.17, 'tin', 'shut'],
  [85, 86.3, 5, 4.6, 0.17, 'ruin'], [88.8, 81.2, 5, 4.4, 0.17, 'stucco', 'shut'], [92.2, 85.8, 5, 4.6, 0.17, 'block', 'shut'], [95.9, 79.6, 5, 4.6, 0.17, 'stucco', 'shut'],
  [97.2, 84.5, 5, 4.6, 0.17, 'block', 'shut'], [102.8, 78, 5, 4.6, 0.17, 'tin', 'shut'], [104.1, 83.1, 5, 4.6, 0.17, 'stucco', 'boarded'],
  [116.8, 74.3, 5.6, 5, 0.25, 'block', 'shut'], [123.8, 72.5, 5.4, 5, 0.25, 'block', 'shut'], [125, 77.1, 5, 4.6, 0.25, 'stucco', 'shut'], [117.9, 79, 5, 4.6, 0.25, 'tin', 'boarded'],
  // between International and Del Mar
  [50.4, 116.3, 5, 4.6, 0.06, 'ruin'], [57.7, 115.9, 5, 4.6, 0.06, 'block', 'shut'], [64.1, 115.4, 5, 4.6, 0.06, 'stucco', 'shut'], [46.9, 121.9, 5, 4.6, 0.06, 'stucco', 'shut'], [58.6, 121, 5, 4.6, 0.06, 'block', 'boarded'],
  [79.2, 113.3, 5.4, 5, 0.04, 'block', 'shut'], [86.4, 112.4, 5, 4.6, 0.04, 'stucco', 'shut'], [87.3, 117.8, 5, 4.6, 0.04, 'ply', 'shut'], [80.3, 118.8, 5, 4.6, 0.04, 'stucco', 'shut'],
  [142.1, 96, 6, 5.4, 0, 'block', 'boarded'],
  // south of Del Mar, by the plaza: Tavo and Nina's (lit window), Doña Fina's (light under the door)
  [42.6, 149, 5, 4.6, 0.04, 'ruin'], [49.7, 147.7, 5.6, 5, 0.04, 'tin', 'window'], [61, 147.5, 6, 5, 0.04, 'block', 'under'], [50.7, 155.8, 5, 4.4, 0.04, 'stucco', 'shut'], [61.6, 154.5, 5, 4.4, 0.04, 'block', 'shut'],
  // south of Del Mar, east
  [130, 142.8, 5, 4.6, 0, 'stucco', 'shut'], [130, 147.8, 5, 4.4, 0, 'block', 'shut'], [144.6, 142.3, 5, 4.6, 0, 'block', 'shut'], [151.8, 142.3, 5, 4.6, 0, 'stucco', 'shut'],
  [144.6, 147.9, 5, 4.6, 0, 'tin', 'boarded'], [151.8, 147.9, 5, 4.6, 0, 'stucco', 'shut'],
  [166.2, 140.7, 5.6, 5, 0, 'block', 'shut'], [172.8, 142.8, 5, 4.6, 0, 'stucco', 'shut'], [187.8, 140, 5, 4.6, 0, 'ruin'], [187.8, 145.6, 5, 4.4, 0, 'block', 'shut'], [166.2, 156.4, 5, 4.4, 0, 'tin', 'shut'],
  // east, off McPherson
  [169.8, 79.4, 5, 4.6, -0.25, 'stucco', 'shut'], [176.7, 81.6, 5, 4.6, -0.25, 'block', 'shut'], [173.2, 91.7, 5, 4.6, -0.25, 'ruin'], [170.6, 96.3, 5, 4.6, -0.25, 'block', 'shut'],
  [186.9, 96.3, 5, 4.6, -0.25, 'stucco', 'boarded'], [180.8, 111, 5, 4.6, -0.25, 'block', 'shut'], [183.2, 117.4, 5, 4.6, -0.25, 'ruin'],
  // north-east, by the trail
  [160, 42.8, 5.4, 5, 0.35, 'block', 'shut'], [166.8, 40.3, 5, 4.6, 0.35, 'stucco', 'shut'], [165.3, 47.6, 5, 4.6, 0.35, 'ruin'], [168.7, 45.8, 5, 4.6, 0.35, 'tin', 'shut'],
  [180.1, 35.5, 5, 4.6, 0.35, 'block', 'shut'], [182.1, 41, 5, 4.6, 0.35, 'stucco', 'boarded'],
];

/** A table and two benches, for the elders outside the chapel. */
function eldersTable(s: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.add(box(3.2, 0.08, 0.9, M.wood(), 0, 0.74, 0));
  for (const lx of [-1.3, 1.3]) g.add(box(0.1, 0.74, 0.7, M.wood(), lx, 0, 0));
  for (const bz of [-0.85, 0.85]) g.add(box(3.0, 0.07, 0.32, M.wood(), 0, 0.42, bz));
  s.add(shade(g));
  addSolid(x - 1.6, z - 0.5, x + 1.6, z + 0.5);
}

/** A swing frame: two A-legs, a bar, one seat on chains. */
function swing(s: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  for (const sx of [-1, 1]) for (const sz of [-0.5, 0.5]) { const leg = box(0.08, 2.3, 0.08, M.steel(), sx * 1.1, 0, sz * 0.5); leg.rotation.x = sz * 0.4; g.add(leg); }
  g.add(box(2.4, 0.08, 0.08, M.steel(), 0, 2.1, 0));
  for (const cx of [-0.25, 0.25]) g.add(box(0.02, 1.5, 0.02, M.steel(), cx, 0.6, 0));
  g.add(box(0.6, 0.05, 0.25, M.wood(), 0, 0.58, 0));
  s.add(shade(g));
  addSolid(x - 1.2, z - 0.3, x + 1.2, z + 0.3);
}

export function sevenFlagsTown(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'seven-flags',
    title: 'Seven Flags',
    sub: 'The Span',
    kind: 'town',
    cols: COLS,
    rows: ROWS,
    seed: 77,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      // west of the Thirty-Five: outside the town, brush to the horizon
      for (let z = 0; z < ROWS; z++) { const xw = Math.floor(xAt(I35, z + 0.5) - 7.5); for (let x = 0; x < Math.min(COLS, xw); x++) g.set(x, z, '#'); }
      // brush where nobody's kept it back
      motte(g, 108, 8, 10, 5, 71); motte(g, 128, 16, 8, 6, 72); motte(g, 185, 64, 5, 6, 73); motte(g, 100, 64, 5, 3, 74);
      motte(g, 186, 154, 6, 4, 75); motte(g, 78, 156, 5, 3, 76); motte(g, 150, 60, 5, 4, 77); motte(g, 66, 98, 4, 3, 78);
      motte(g, 128, 92, 6, 4, 79); motte(g, 182, 6, 8, 4, 80);
      // the creek (dry) and the Old Trail beside it
      g.line(CREEK, 5.2, 's');
      g.line(TRAIL, 3, 'e');
      // the plaza, the school yard, the lots
      g.rect(PLAZA.x0, PLAZA.z0, PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0, 'p');
      g.line([[PLAZA.x0, 145.5], [PLAZA.x1, 145.5]], 2.2, 'e'); g.line([[86, PLAZA.z0], [86, PLAZA.z1]], 2.2, 'e');
      g.rect(92, 32, 24, 8, 'e');
      g.rect(YARD.x0, YARD.z0, YARD.x1 - YARD.x0, YARD.z1 - YARD.z0, 'p');
      g.rect(66, 112, 11, 8, 'e'); // a dirt lot, lived in
      // sidewalks under every street, then the streets
      for (const [pts, w] of MAIN) g.line(pts, w + 2, 'v', (q) => q !== '#' || pts === DELMAR);
      for (const pts of SIDE) g.line(pts, 4, 'd', (q) => q !== '#');
      // the Thirty-Five on its embankment: 'H' is the walled-off deck (asphalt nobody can reach), open only north of the junction
      g.line(I35, 13, 'H');
      for (let z = 0; z <= JUNCTION; z++) for (let x = 40; x < 66; x++) if (g.get(x, z) === 'H') g.set(x, z, 'd');
      g.line(ONRAMP, 4.4, 'd');
      for (const [pts, w] of MAIN) g.line(pts, w, 'd');
      g.rect(LOT.x0, LOT.z0, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, 'd');
      g.rect(150, 14, 28, 10, 'd'); // the Big Store's parking
      g.line([[141, LOT.z0], [141, 104]], 3, 'v');
      // the drain, a concrete channel south from behind the store, under Del Mar, on out of town
      g.rect(DRAIN.x0, DRAIN.z0, DRAIN.x1 - DRAIN.x0, ROWS - DRAIN.z0, 'b');
      g.blob(115, 156, 2, 3, 'g', 79, (q) => q === 'b');
      g.blob(154, 112, 2.4, 1.6, 'g', 80, (q) => q === 'x' || q === 'v'); // under the tank
    },
    height(x, z, h) {
      // the drain sinks below grade except where Del Mar crosses it; the creek runs low
      let out = h;
      // the Thirty-Five's embankment, and the on-ramp climbing up to it
      if (x < 70) {
        const [di] = along(I35, x, z);
        const deck = DECK * (1 - smoothstep(6.6, 7.6, di));
        const [dr, ar] = along(ONRAMP, x, z), L = Math.hypot(ONRAMP[1]![0] - ONRAMP[0]![0], ONRAMP[1]![1] - ONRAMP[0]![1]);
        const ramp = DECK * Math.min(1, ar / L) * (1 - smoothstep(2.2, 3.2, dr));
        out += Math.max(deck, ramp);
      }
      if (z > DRAIN.z0 - 1 && !(z > 125.5 && z < 134.5)) {
        const k = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 - x, x - DRAIN.x1) / 1.0));
        const inner = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 + 1.2 - x, x - (DRAIN.x1 - 1.2)) / 1.2));
        out -= 0.8 * k * Math.min(1, (z - DRAIN.z0 + 1) / 2) + 0.7 * inner * Math.min(1, (z - DRAIN.z0 + 1) / 2);
      }
      if (x > 120 && z < 50) { const [dc] = along(CREEK, x, z); if (dc < 3) out -= 0.6 * (1 - dc / 3) ** 1.5; }
      return out;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 66, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // the rail line: rails and ties over ballast, across whatever it crosses
      if (x > RAIL_BOX[0] && x < RAIL_BOX[2] && along(ONRAMP, x, z)[0] > 2.2) {
        const [dr, a] = along(RAIL, x, z);
        if (dr < 1.25) {
          if (Math.abs(dr - 0.72) < 0.07) return [120, 112, 100];
          if (glyph !== 'd' && (a % 0.75) < 0.22 && dr < 1.0) return [92, 70, 52];
          if (glyph !== 'd') return fine > 0.5 ? [112, 100, 86] : [98, 88, 76];
        }
      }
      // the streets, on their true lines
      let road: Way | null = null, walk = false, dRoad = 99, aRoad = 0;
      for (const i of waysNear(Math.floor(x), Math.floor(z))) {
        const w = WAYS[i]!;
        const [dd, a] = along(w.pts, x, z);
        if (dd <= w.half && (!road || dd < dRoad)) { road = w; dRoad = dd; aRoad = a; }
        else if (dd <= w.walk && !road) walk = true;
      }
      if (road) {
        if (road.kind === 'creek') return paintAs('s', x, z, fine);
        if (road.kind === 'trail') return paintAs('e', x, z, fine);
        if ((road.kind === 'main' || road.kind === 'hwy') && dRoad < 0.08 && (aRoad % 3) < 1.8 && fine > 0.22) return [180, 154, 82]; // the centre line, yellow, half gone
        return paintAs('d', x, z, fine);
      }
      if (walk) return paintAs('v', x, z, fine);
      if (glyph === 'H') return paintAs('d', x, z, fine);
      if (glyph === 'd' && along(ONRAMP, x, z)[0] < 2.3) return paintAs('d', x, z, fine);
      if (glyph === 'd' || glyph === 'v') {
        if (inLot(x, z)) {
          // faded parking stalls at the store and the Big Store
          if (glyph === 'd' && z > LOT.z0 + 0.4 && z < LOT.z0 + 3.6 && x > LOT.x0 + 1 && x < LOT.x1 - 1 && Math.abs((x - LOT.x0) % 3) < 0.11 && fine > 0.18) return [184, 176, 160];
          if (glyph === 'd' && z > 14.4 && z < 18 && x > 151 && x < 177 && Math.abs((x - 150) % 3) < 0.11 && fine > 0.18) return [184, 176, 160];
          return paintAs(glyph, x, z, fine);
        }
        return paintAs('x', x, z, fine); // a grid cell the street only clipped
      }
      if (glyph === 's' || glyph === 'e') { const [dc] = along(CREEK, x, z), [dt] = along(TRAIL, x, z); if (dc > 2.6 && dt > 1.5 && !(x > 66 && x < 77 && z > 112 && z < 120) && !(x > 92 && x < 116 && z > 32 && z < 40) && !(z > 144 && z < 147 && x > PLAZA.x0 && x < PLAZA.x1) && !(x > 85 && x < 87 && z > PLAZA.z0 && z < PLAZA.z1)) return paintAs('x', x, z, fine); }
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', w: 'brush', e: 'brush' },
    solidGlyphs: ['H'],
    exits: [
      { side: 'n', at: 53, w: 12, to: 'ramp', spawn: 'town', name: 'north' },
      { side: 'e', at: 124, w: 9, to: 'lake-road', spawn: 'town', name: 'east' },
      { side: 'e', at: 21, w: 5, to: 'trail', spawn: 'town', name: 'trail' },
      { side: 's', at: 160, w: 7, to: 'south-road', spawn: 'north', name: 'south' },
      { side: 's', at: 56.3, w: 6, to: 'mall', spawn: 'town', name: 'mall' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();
      const r = rng(7700);

      // ------------------------------------------------ Mar Farm: the dead supermarket (signature), lit by an old caged bulb
      d.built.push(...building(scene, {
        x: STORE.x, z: STORE.z, w: STORE.w, d: STORE.d, h: 4.4, wall: texMat('block0', blockWall(0)), roof: 'flat', seed: 9,
        doors: [{ x: 0, ...spanDoor('bulb', night) }],
        windows: [{ x: 4.4, kind: night ? 'lit' : 'glass' }, { x: -6.5, kind: 'boarded', w: 1.6, h: 1.1 }, { x: -3.6, kind: 'boarded', w: 1.6, h: 1.1 }],
      }, night));
      scene.add(decal(4.4, 2.9, M.tin(), STORE.x + 6.4, 0, STORE.z + STORE.d / 2 + 0.03)); // the old shutter: down, no light, no promise
      roofLetters(scene, 'MAR', STORE.x - 2, 4.7, STORE.z - 1, 4.6, 1.5);
      solarPanels(scene, STORE.x + 5, 4.7, STORE.z - 2.6, 4, 2);
      d.spawns.home = { x: STORE.x, z: STORE.z + STORE.d / 2 + 1.6, face: 'S' };
      waterTower(scene, 156.4, 108.4, night); // the tallest thing for blocks: everyone knows where the water is
      jugs(scene, 147.4, 117.2, 6, seed());
      drum(scene, 135, 117.4); drum(scene, 135.8, 117.9, true);
      burialPlatform(scene, 134.6, 119.8);
      fence(scene, [[146.2, 118.2], [154.4, 118.2], [154.4, 124.6], [146.2, 124.6], [146.2, 122]], seed());
      shadeSail(scene, 150.4, 121.4, 3.6, 2.8, 2.1);
      d.built.push(lanternPost(scene, 132.8, 117.4, night, night));
      d.built.push(lanternPost(scene, 153.6, 117.0, night, night));
      mailbox(scene, 131.6, 126.8);
      boardSign(scene, 139, 127.6, 'MAR FARM', 0.06, 21);

      // ------------------------------------------------ the plaza: the flags (hero), the night market, the well
      d.built.push(sevenFlags(scene, 88, 135.8));
      const CLOTH = ['#a8402e', '#3f6a8a', '#d8b23a', '#6a8a4a', '#8a3a4a', '#c86a3a', '#4a6a7a', '#9a7a3a'];
      let ci = 0;
      for (const [sx, sz] of [[76, 142], [80.4, 142], [91.6, 142], [96, 142], [100.4, 142], [76, 149.4], [80.4, 149.4], [100.4, 149.4]] as Pt[]) stall(scene, sx, sz, CLOTH[ci++ % CLOTH.length]!, seed());
      d.built.push(stringLights(scene, [[73, 140], [86, 139.4], [103, 140]], night));
      d.built.push(stringLights(scene, [[73, 147.6], [86, 147], [103, 147.6]], night));
      well(scene, 94, 148.4);
      bench(scene, 74, 152, 0); bench(scene, 98, 152.2, 0);
      for (const [x, z] of [[72.6, 136.6], [103.4, 136.6], [72.6, 152.6], [103.4, 152.6]] as Pt[]) d.built.push(lanternPost(scene, x, z, night, night));
      for (const [x, z, s] of [[74.4, 138.2, 1.05], [101.6, 138.4, 1.0]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());

      // ------------------------------------------------ the chapel and the elders' table
      d.built.push(...building(scene, { ...CHAPEL, h: 4.0, wall: 'white', roof: 'gable', seed: 21, doors: [{ x: 0, w: 1.6, h: 2.4, ...spanDoor('lantern', night) }], windows: [{ x: -3, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.2 }, { x: 3, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.2 }] }, night));
      d.built.push(belfry(scene, CHAPEL.x + 6, CHAPEL.z - 2, 6.0));
      d.spawns.chapel = { x: CHAPEL.x, z: CHAPEL.z + CHAPEL.d / 2 + 1.4, face: 'S' };
      eldersTable(scene, 111.4, 114.2);
      d.built.push(lanternPost(scene, 114, 112, night, night));

      // ------------------------------------------------ the school (the cellar under it), the Big Store, the Warehouse
      d.built.push(...building(scene, { ...SCHOOL, h: 4.0, wall: 'brick', roof: 'flat', seed: 31, doors: [{ x: -5, ...spanDoor('boarded', night) }], windows: [-7.6, -2.4, 0.4, 3.2, 6].map((x) => ({ x, kind: 'boarded' as const, w: 1.2, h: 1.0 })) }, night));
      d.built.push(dressDoor(scene, 100, 0.02, 37.4, 1.6, 0.9, 'dark', night, 0)); // the cellar hatch: dark, a way in for whoever brings a light
      markDoor(100, 37.4, 'dark');
      d.built.push(...building(scene, { ...BIGSTORE, h: 5.0, wall: 'concrete', roof: 'flat', seed: 33, doors: [{ x: -3, w: 3.4, h: 2.6, ...spanDoor('shut', night) }], windows: [{ x: 4, kind: 'boarded', w: 3, h: 1.6 }, { x: -7.6, kind: 'boarded', w: 2.4, h: 1.6 }] }, night));
      carHulk(scene, 156, 19, 0.1, seed()); carHulk(scene, 171, 21, 3.0, seed()); tires(scene, 162, 22.4, 4);
      d.built.push(...building(scene, { ...WAREHOUSE, h: 6.0, wall: 'tin', roof: 'flat', seed: 35, doors: [{ x: 2, w: 3.6, h: 3.2, ...spanDoor('shut', night) }] }, night));
      rubble(scene, 30, 134, 1.2, seed());

      // ------------------------------------------------ Abby's yard: the Lawnkeeper (routine), the swing, the shed
      salvageFence(scene, [[YARD.x0, YARD.z0], [YARD.x1, YARD.z0], [YARD.x1, YARD.z1]], seed());
      salvageFence(scene, [[YARD.x0, YARD.z0 + 0.4], [YARD.x0, YARD.z1 - 3.6]], seed());
      d.built.push(...house(scene, { x: 167.3, z: 63, w: 4, d: 3, h: 2.2, base: 'tin', seed: 61 }, night));
      swing(scene, 175, 65.4);
      d.built.push(lawnkeeper(scene, [[165.6, 67], [173, 67], [173, 70.2], [165.6, 70.2], [165.6, 67]]));

      // ------------------------------------------------ the drain: headwalls either side of Del Mar, culverts black
      headwall(scene, 115.2, 125.4, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, -1);
      headwall(scene, 115.2, 134.6, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, 1);
      d.built.push(dressDoor(scene, 115.2, -1.45, 125.15, 2.2, 1.3, 'dark', night, Math.PI)); markDoor(115.2, 125, 'dark');
      d.built.push(dressDoor(scene, 115.2, -1.45, 134.85, 2.2, 1.3, 'dark', night, 0)); markDoor(115.2, 135, 'dark');

      // ------------------------------------------------ the Old Trail, the creek, the pipe
      bench(scene, 140.6, 39.6, 0.45);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#8a867c', roughness: 0.9, side: THREE.DoubleSide }));
      pipe.rotation.z = Math.PI / 2; pipe.rotation.y = 0.4;
      pipe.position.set(186, heightAt(186, 16) + 0.6, 16);
      scene.add(shade(pipe));
      addSolid(183, 14.6, 189, 17.4);

      // ------------------------------------------------ the Thirty-Five: retaining walls the length of town, the deck barricaded at the junction
      const side = (off: number): Pt[] => I35.map(([x, z], i) => {
        const [nx2, nz2] = I35[Math.min(i + 1, I35.length - 1)]!, [px2, pz2] = I35[Math.max(0, i - 1)]!;
        const L = Math.hypot(nx2 - px2, nz2 - pz2) || 1;
        return [x + ((pz2 - nz2) / L) * -off, z + ((nx2 - px2) / L) * -off];
      });
      for (const off of [-6.6, 6.6]) {
        const wall = side(off).filter(([, z]) => z >= JUNCTION - 2);
        for (let i = 0; i < wall.length - 1; i++) {
          const [ax, az] = wall[i]!, [bx, bz] = wall[i + 1]!;
          retainingWall(scene, ax, Math.max(az, JUNCTION), bx, Math.min(ROWS + 1, Math.max(bz, JUNCTION)), DECK);
        }
      }
      // the deck: barriers along both edges where it's open, and across it at the junction with a wreck behind them
      jerseys(scene, side(5.6).filter(([, z]) => z <= JUNCTION + 2).map(([x, z]) => [x, Math.min(z, JUNCTION)] as Pt), seed(), DECK);
      jerseys(scene, [[46.6, JUNCTION + 0.6], [56.4, JUNCTION]], seed(), DECK);
      carHulk(scene, 50, JUNCTION + 3.4, 0.4, seed());
      // the deck's east edge north of the junction, except where the on-ramp meets it
      jerseys(scene, [[56.6, -0.4], [57.6, 5.6]], seed(), DECK);
      jerseys(scene, [[58, 11.6], [56.4, JUNCTION]], seed(), DECK);
      // the on-ramp's sides
      for (const off of [-2.3, 2.3]) {
        const [[ax, az], [bx, bz]] = ONRAMP as [Pt, Pt];
        const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        jerseys(scene, [[ax + nx * off, az + nz * off], [bx + nx * off, bz + nz * off]], seed());
        for (let t = 0; t <= 1; t += 0.04) addSolid(ax + (bx - ax) * t + nx * off - 0.3, az + (bz - az) * t + nz * off - 0.3, ax + (bx - ax) * t + nx * off + 0.3, az + (bz - az) * t + nz * off + 0.3);
      }
      // the deck's edges where it's open: solid all along, so nobody steps off the top of the wall
      for (let z = 0; z <= JUNCTION; z += 0.5) {
        const xc = xAt(I35, z);
        addSolid(xc - 6.2, z - 0.3, xc - 5.6, z + 0.3);
        if (z < 5.6 || z > 11.6) addSolid(xc + 5.6, z - 0.3, xc + 6.2, z + 0.3);
      }
      addSolid(45, JUNCTION, 57, JUNCTION + 0.6);
      // where Del Mar runs into the wall: barriers stacked across what's left of it
      jerseys(scene, [[20.4, 134], [21.6, 141.4]], seed());
      // the road south, closed: barriers across it where it leaves town, a car on its side behind them
      jerseys(scene, [[154.4, 157.8], [165.6, 157.8]], seed());
      carHulk(scene, 160.4, 155.2, 0.08, seed());
      carHulk(scene, 23.6, 136.6, 1.3, seed());

      // ------------------------------------------------ the east barricade on Del Mar (Memo)
      jerseys(scene, [[189.4, 119.4], [190.4, 122.4]], seed());
      carHulk(scene, 188.6, 125.6, 1.5, seed());
      d.built.push(lanternPost(scene, 185, 119, night, night));

      // ------------------------------------------------ the houses
      HOUSES.forEach(([x, z, w, dd, rot, base, door], i) => {
        if (base === 'ruin') { ruinWall(scene, x, z - 0.6, w, 1.6 + r() * 1.2, rot, 8000 + i); rubble(scene, x + 1, z + 1.4, 1.0, 8100 + i); return; }
        const dx = (r() - 0.5) * (w - 2.4);
        d.built.push(...house(scene, { x, z, w, d: dd, h: 2.5 + r() * 0.4, base, door: door ? { x: door === 'window' ? -1.2 : door === 'under' ? 0 : dx, kind: door } : undefined, windows: door === 'window' ? [] : r() > 0.5 ? [{ x: dx > 0 ? -w / 2 + 0.9 : w / 2 - 0.9, kind: r() > 0.5 ? 'boarded' : 'glass' }] : [], porch: r() > 0.7, tarp: r() > 0.55, seed: 8200 + i, rot }, night));
        // a little yard life
        const [fx, fz] = onBuilding({ x, z, rot }, w / 2 + 1.2, 0);
        const t = r();
        if (t < 0.22) yardTank(scene, fx, fz, 8300 + i);
        else if (t < 0.34) { const [cx, cz] = onBuilding({ x, z, rot }, 0, dd / 2 + 2.4); fireRing(scene, cx + 2, cz); d.built.push(lanternPost(scene, cx + 3.2, cz - 0.8, night, night)); }
        else if (t < 0.46) { const [ax, az] = onBuilding({ x, z, rot }, -w / 2, -dd / 2 - 1); const [bx, bz] = onBuilding({ x, z, rot }, w / 2, -dd / 2 - 1.2); d.built.push(clothesline(scene, ax, az, bx, bz, 8400 + i)); }
        if (r() > 0.75) d.roamers.push({ sprite: 'chicken', frames: [], x: x + 1, z: z + dd / 2 + 1.6, area: [x - w / 2, z + dd / 2 + 0.6, x + w / 2, z + dd / 2 + 3], speed: 0.9, height: 0.34 });
      });
      // the rooms' doors let you back out onto their steps
      d.spawns.fina = { ...xz(onBuilding({ x: 61, z: 147.5, rot: 0.04 }, 0, 2.5 + 1.4)), face: 'S' };
      d.spawns.kids = { ...xz(onBuilding({ x: 49.7, z: 147.7, rot: 0.04 }, -1.2, 2.5 + 1.4)), face: 'S' };
      containerHome(scene, 44, 92, 0, 'shut', night, 8500).forEach((b) => d.built.push(b));
      containerHome(scene, 178, 150, 0, 'boarded', night, 8501).forEach((b) => d.built.push(b));
      salvageFence(scene, [[60, 112], [77.6, 112], [77.6, 119.6]], seed());

      // ------------------------------------------------ lanterns down the streets, poles with no wires
      for (const [pts] of MAIN) {
        const n = pts.length;
        for (let i = 0; i < n - 1; i++) {
          const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
          const L = Math.hypot(bx - ax, bz - az), k = Math.floor(L / 22);
          for (let j = 1; j <= k; j++) {
            const t = j / (k + 1), x = ax + (bx - ax) * t, z = az + (bz - az) * t;
            const nx = -(bz - az) / L, nz = (bx - ax) / L;
            const px = x + nx * 5, pz = z + nz * 5;
            if (px > 2 && px < COLS - 2 && pz > 2 && pz < ROWS - 2 && d.grid.get(Math.floor(px), Math.floor(pz)) !== '#') d.built.push(lanternPost(scene, px, pz, night, night));
          }
        }
      }
      const poles = (pts: Pt[], off: number): Array<[number, number, number]> => pts.map(([x, z], i) => {
        const [nx2, nz2] = pts[Math.min(i + 1, pts.length - 1)]!, [px2, pz2] = pts[Math.max(0, i - 1)]!;
        const L = Math.hypot(nx2 - px2, nz2 - pz2) || 1;
        return [Math.min(COLS - 1, Math.max(1, x - ((nz2 - pz2) / L) * off)), Math.min(ROWS - 1, Math.max(1, z + ((nx2 - px2) / L) * off)), 0.05];
      });
      for (const pts of [INTL, SHILOH, DELMAR.slice(1)]) { const p = poles(pts, 5.6); powerLine(scene, p, p.slice(1).map((_, i) => [i, i + 1] as [number, number])); }

      // ------------------------------------------------ brush, the outside, the open ground
      // ------------------------------------------------ the ways out to the places beyond town (2026-10-29: transitions)
      // south-west: the side street runs under the old rail embankment, and the mall is on the far side
      underpass(scene, 56.3, 159.2, 6, -1);
      d.spawns.mall = { x: 56.3, z: 156.8, face: 'N' };
      d.things.push({ x: 56.3, z: 157.6, r: 2.2, label: 'Underpass', lines: ['The street goes in under the old rail bank. Dark the whole way through. Somebody has hung a lantern at the far end.'] });
      // north-east: the Old Trail narrows to a gate of two posts, a lantern hung between them
      d.built.push(trailGate(scene, 189.6, 21, 3.2, Math.PI / 2, night));
      d.spawns.trail = { x: 187.6, z: 21, face: 'W' };

      // ------------------------------------------------ the prologue's places in town (docs/design/prologue.md)
      // the Cellars: Doña Inés's hatch behind the Plaza, a blue lantern by it (night two's water shift, night three)
      const HATCH = { x: 107.4, z: 141.2 };
      const hatch = new THREE.Group();
      hatch.add(box(1.6, 0.3, 1.4, M.wood(), 0, 0, 0), box(1.8, 0.12, 0.12, M.steel(), 0, 0.3, -0.7));
      hatch.children[0]!.rotation.x = -0.25;
      hatch.position.set(HATCH.x, heightAt(HATCH.x, HATCH.z), HATCH.z);
      scene.add(shade(hatch));
      addSolid(HATCH.x - 0.8, HATCH.z - 0.7, HATCH.x + 0.8, HATCH.z + 0.3);
      scene.add(box(0.1, 1.5, 0.1, M.wood(), HATCH.x + 1.2, heightAt(HATCH.x, HATCH.z), HATCH.z - 0.3));
      const blue = box(0.26, 0.3, 0.26, new THREE.MeshStandardMaterial({ color: '#9ad8ff', emissive: new THREE.Color('#5aa8ff'), emissiveIntensity: night ? 3 : 0.4 }), HATCH.x + 1.2, heightAt(HATCH.x, HATCH.z) + 1.5, HATCH.z - 0.3);
      blue.userData.when = '!guero_lost|ines_lantern'; // the porch goes dark if Güero isn't found, until someone lights it
      scene.add(blue);
      markDoor(HATCH.x, HATCH.z + 0.3, 'open');
      d.things.push({ x: HATCH.x, z: HATCH.z + 0.9, r: 1.5, label: 'Hatch', script: 'hatch', go: { to: 'cellar', spawn: 'door' } });
      d.spawns.hatch = { x: HATCH.x, z: HATCH.z + 1.8, face: 'S' };
      // the Big Store's loading dock, at the east end of its front: its roll-up door jammed half open (Papá's route)
      const DOCK = { x: BIGSTORE.x + 6.6, z: BIGSTORE.z + BIGSTORE.d / 2 };
      d.built.push(dressDoor(scene, DOCK.x, heightAt(DOCK.x, DOCK.z), DOCK.z + 0.04, 3.0, 2.4, 'open', night));
      markDoor(DOCK.x, DOCK.z + 0.1, 'open');
      d.things.push({ x: DOCK.x, z: DOCK.z + 0.9, r: 1.6, label: 'Loading dock', go: { to: 'big-store', spawn: 'door' } });
      d.spawns.dock = { x: DOCK.x, z: DOCK.z + 1.8, face: 'S' };
      // a ladder up the front of Mar Farm, at its west end: the roof is where the town watches the sky (nights five, seven)
      const ROOF = { x: STORE.x - STORE.w / 2 + 1.4, z: STORE.z + STORE.d / 2 + 0.12 };
      const rung = M.wood(), gy = heightAt(ROOF.x, ROOF.z);
      for (const sx of [-0.36, 0.36]) scene.add(shade(box(0.14, 4.6, 0.14, rung, ROOF.x + sx, gy, ROOF.z)));
      for (let i = 0; i < 11; i++) scene.add(box(0.72, 0.1, 0.1, rung, ROOF.x, gy + 0.35 + i * 0.4, ROOF.z));
      addSolid(ROOF.x - 0.45, ROOF.z - 0.1, ROOF.x + 0.45, ROOF.z + 0.2);
      d.things.push({ x: ROOF.x, z: ROOF.z + 0.9, r: 1.5, label: 'Ladder', script: 'roof' });
      brushFill(d, 77, 0.8, 3, (x, z) => x > xAt(I35, z) - 18); // the outside, only as far as anyone can see from the road
      for (const [x, z, s] of [[120, 100, 1.1], [130, 88, 1.0], [96, 60, 1.0], [150, 50, 1.1], [60, 70, 0.9], [178, 100, 1.0]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.3);
      for (const [x, z, s] of [[124, 108, 0.9], [70, 96, 0.8], [158, 128.4, 0.9], [100, 120, 0.8], [176, 58, 1.0]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      openScatter(d, 78, ['x', 's'], 0.25, (x) => x > 40);
      crates(scene, 99.6, 154);

      // ------------------------------------------------ things to look at
      d.things.push(
        { x: STORE.x, z: STORE.z + STORE.d / 2 + 0.8, label: 'Go in', script: 'door', go: { to: 'mar-home', spawn: 'door' } },
        { x: CHAPEL.x, z: CHAPEL.z + CHAPEL.d / 2 + 0.8, label: 'Go in', go: { to: 'chapel', spawn: 'door' } },
        { ...xz(onBuilding({ x: 61, z: 147.5, rot: 0.04 }, 0, 2.5 + 0.8)), label: 'Knock', go: { to: 'fina-house', spawn: 'door' } },
        { ...xz(onBuilding({ x: 49.7, z: 147.7, rot: 0.04 }, -1.2, 2.5 + 0.8)), label: 'Go in', go: { to: 'kids-house', spawn: 'door' } },
        { x: STORE.x + 6.4, z: STORE.z + STORE.d / 2 + 0.7, label: 'Shutter', lines: ['The shutter is down. Rust has locked the bottom slats to the sill.'] },
        { x: 156.4, z: 110.6, r: 2.4, label: 'Water tank', script: 'tank', lines: ['AGUA, painted by hand. Under it, older letters, painted by a different hand.', 'The pipe down the leg is sweating. The ground under it is green.'] },
        { x: 150.4, z: 125.4, r: 2.2, label: 'Goats', script: 'pen', lines: ['Four goats in a pen made of somebody’s fence and somebody else’s gate.'] },
        { x: 134.6, z: 121.2, r: 1.8, label: 'Platform', script: 'platform', lines: ['A shroud on the boards, sewn shut with white thread.'] },
        { x: 88, z: 138.4, r: 3.0, label: 'Flags', lines: ['Seven flags on seven poles. The colors have all gone the same gray-pink.'] },
        { x: 94, z: 150, r: 1.8, label: 'Well', script: 'well', lines: ["The bucket comes up wet. Somebody's lucky night."] },
        { x: 111.4, z: 115.6, r: 2.0, label: 'Table', lines: ['A long table outside the chapel. The bench on the near side is worn smooth.'] },
        { x: 100, z: 38.6, r: 1.6, label: 'Cellar door', lines: ['A steel hatch in the yard behind the school. Under it, steps going down into the dark.'] },
        { x: 164, z: 14, r: 3.0, label: 'Big Store', lines: ['A store the size of a field. The doors are chained, but not the loading dock round the side.'] },
        { x: 27, z: 133, r: 3.0, label: 'Warehouse', lines: ['Tin walls, three stories of nothing. Something big was kept in here once.'] },
        { x: 140.6, z: 41, r: 1.6, label: 'Old bench', script: 'bench', lines: ['A concrete bench by the trail. A heart carved in the seat, the letters worn off.'] },
        { x: 175, z: 66.8, r: 1.8, label: 'Swing', lines: ['A swing on a frame. The seat is new. The chains are not.'] },
        { x: 171, z: 63.6, r: 1.6, label: 'Chalk drawing', lines: ['A chalk drawing on the shed wall: a sun, a house, and something with too many legs.'] },
        { x: 168.6, z: 69.2, r: 1.8, label: 'Machine', lines: ['A small machine on four wheels, mowing the same square of dead grass it always has.'] },
        { x: 115.2, z: 123.8, r: 2.0, label: 'Culvert', lines: ['The drain goes under the road here. The pipe is black all the way in. Something in there drips.'] },
        { x: 186, z: 18.6, r: 2.6, label: 'Concrete pipe', lines: ['A pipe as tall as a man, where the creek used to go under the road. Something lives in it. The sand at its mouth is swept.'] },
        { x: 22.6, z: 138.6, r: 2.4, label: 'Barricade', lines: ['The boulevard runs into the highway’s wall. Somebody stacked barriers across what’s left of it.'] },
        { ...xz(ONRAMP[0]!), r: 2.4, label: 'On-ramp', lines: ['The ramp climbs up onto the Thirty-Five. Up there, the highway goes north out of town.'] },
        { x: 160, z: 153.4, r: 2.6, label: 'Barrier', lines: ['Concrete barriers across the road, a car turned over behind them. Past them, the road runs south out of town.'] },
        { x: 189, z: 120, r: 2.0, label: 'Barricade', lines: ['Barriers across the boulevard and a car on its side. Past it, the road goes east toward the lake.'] },
      );
      d.npcs.push(
        { id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 133.2, z: 123, face: 'E', when: '!n2_table&!n7_meeting', lines: ['Keep the lantern lit, mija. Somebody always has to.'] },
        // night seven: the whole town under the seven flags
        { id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 86.4, z: 141.4, face: 'S', when: 'n7_meeting' },
        { id: 'tona', name: 'Abuela Toña', sprite: 'tona', x: 111.4, z: 112.8, face: 'S', lines: ['One candle for Elías. One for Rosa, in case.', "And one for whoever's walking tonight. That's you, mija. Go on. I've got you covered."] },
        { id: 'nacho', name: 'Abuelo Nacho', sprite: 'nacho', x: 125.4, z: 49.2, face: 'S', lines: ["There's a bench up the way. Somebody carved a heart in it. Ancient."] },
        { id: 'chayo', name: 'Doña Chayo', sprite: 'chayo', x: 81.9, z: 143.9, face: 'S', lines: ["White's not for looking at, mija. Put it on before you leave, not when you feel it."] },
        { id: 'beto', name: 'Don Beto', sprite: 'beto', x: 89.9, z: 143.6, face: 'S', lines: ['You hear her last night? La Llorona. Down in the Dead River.', "My abuela said if you hear her crying, you don't go look. You don't help. You go home."] },
        { id: 'ruben', name: 'Rubén', sprite: 'ruben', x: 96.5, z: 139.4, face: 'W', lines: ['Seven flags. Seven nations owned this ground once, they say.', "Can't name a single one of them. Doesn't matter. They're gone, and we're still here."] },
        { id: 'kit', name: 'Kit', sprite: 'kit', x: 84, z: 139, face: 'E', lines: ['Does rain make a noise? Like, when it hits stuff?', 'Your papá said his abuelo heard it once. He said it sounds like applause.'] },
        { id: 'fina', name: 'Doña Fina', sprite: 'fina', x: 76.5, z: 146.6, face: 'S', lines: ['Agua, agua. Clean, boiled, blessed. Two out of three, guaranteed.', 'Which two? Depends on the day, mija.'] },
        { id: 'tavo', name: 'Tavo', sprite: 'tavo', x: 91.9, z: 149.4, face: 'E', lines: ['Did you know the Old Trail is the oldest place in the whole world?', 'Abuelo Nacho says the first people walked it. It’s north. It has benches.'] },
        // night four: Nina in Abby's yard, by the mower that stopped
        { id: 'nina', name: 'Nina', sprite: 'nina', x: 171.6, z: 68.6, face: 'E', when: 'n4_mower' },
        { id: 'nina', name: 'Nina', sprite: 'nina', x: 96.2, z: 149.6, face: 'W', when: '!n4_mower', lines: ['Tavo says the Old Trail is the oldest place in the world. I say it’s the drain.', 'The drain has bones in it. That’s how you know it’s old.'] },
        // night three: the Noonriders at the barricade for the tithe
        { id: 'rider', name: 'Noonrider', sprite: 'noonrider', x: 190.2, z: 123.6, face: 'W', when: 'n3_tithe' },
        { id: 'rider', name: 'Noonrider', sprite: 'noonrider', x: 190.4, z: 129.0, face: 'W', when: 'n3_tithe' },
        { id: 'memo', name: 'Memo', sprite: 'memo', x: 187, z: 126.4, face: 'W', lines: ['Nobody goes out the east road after Lamp. Not without a reason and a pipe.', 'Big tracks out by the lake lately. Bigger than any Stray.'] },
      );
      for (const [x, z] of [[148, 120], [151, 122], [152.6, 119.6], [149, 123.4]] as Pt[]) d.roamers.push({ sprite: 'goat', frames: [], x, z, area: [147, 119, 153.6, 124], speed: 0.6, height: 0.62 });
      for (const [x, z] of [[80, 151], [92, 152], [99, 150]] as Pt[]) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [PLAZA.x0 + 1, 150, PLAZA.x1 - 1, 152.6], speed: 0.9, height: 0.34 });
    },
  };
}
/** A ground glyph painted as the Span paints it (its own glyphs first, then the region's). */
const paintAs = (g: string, x: number, z: number, fine: number): RGB | undefined => spanPaint(g, x, z, fine) ?? regionPaint(g, x, z, fine);
const xz = ([x, z]: [number, number]): { x: number; z: number } => ({ x, z });
