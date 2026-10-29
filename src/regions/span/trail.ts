import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { boardSign, stockTank, rock } from '../../engine/props';
import { powerLine } from '../../engine/foliage';
import { box, colMat } from '../../engine/geo';
import { M } from '../../engine/buildings';
import { addSolid } from '../../engine/world';
import { fbm } from '../../engine/noise';
import { STRAW, nopal, lanternPost, windmill, skull } from './props';
import { spanPaint, cairn, trailGate } from './kit';
import { SPAN_FLORA, deadMesquite } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { ruinWall, rubble } from './ruins';

/**
 * THE TRAIL NORTH (the Span; medium, 88×72). The Old Trail doesn't stop at the edge of town. Past the last
 * yards it goes on north-east through the brush as a footpath, down across the dry creek on a plank bridge and
 * up toward the hill where the church is. Somebody keeps lanterns lit along it after Lamp. Road leg (methodology
 * §2.2), tier wild, quiet on purpose: the way to somewhere, not a place.
 *
 * - Hero: the footbridge over the dry creek, planks on old railroad ties, a rope for a handrail.
 * - Routine: the windmill by the stock tank, still turning, still filling a tank someone keeps clean.
 * - Signature: the lanterns, one every stretch, lit every night: the way is kept (lantern language: glow
 *   only where it promises something, and these promise the hill).
 * - Ways out: west into town at the end of the Old Trail; north up to the church.
 */

export const COLS = 88, ROWS = 72;
type Pt = [number, number];
/** The footpath, from the town's edge to the hill. */
export const PATH: Pt[] = [[-1, 37], [12, 37.6], [24, 36], [34, 32.4], [42, 27.6], [47, 19], [51, 10], [52, -1]];
/** The creek coming out of town and on east under the brush. */
const CREEK: Pt[] = [[-1, 29], [16, 30.4], [30, 30.8], [42, 28], [58, 34], [74, 42], [89, 47]];
/** Where the path crosses the creek: the footbridge, along the path. */
const BRIDGE = { x: 40.6, z: 28.6, rot: -0.92, len: 7.4 };

const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function distTo(pts: Pt[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export function trailNorth(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'trail',
    title: 'The Trail North',
    sub: 'Lanterns toward the hill',
    kind: 'road',
    cols: COLS,
    rows: ROWS,
    seed: 141,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      // the brush closes in: thick mottes either side, thinning toward the hill
      for (const [cx, cz, rx, rz, s] of [[14, 14, 12, 9, 141], [30, 58, 16, 9, 142], [70, 16, 13, 10, 143], [74, 62, 12, 8, 144], [8, 56, 7, 9, 145], [58, 50, 7, 5, 146], [80, 32, 6, 6, 147], [26, 8, 6, 4, 148]] as Array<[number, number, number, number, number]>) motte(g, cx, cz, rx, rz, s);
      g.line(CREEK, 4.6, 's');
      g.line(PATH, 2.4, 'e');
      g.blob(64, 24, 5, 4, 'b', 149, (q) => q === 'x'); // the stock tank's apron, packed hard
    },
    height(x, z, h) {
      // the creek bed runs a body's height below the land, banks easing down to it
      const dc = distTo(CREEK, x, z);
      let out = h - 1.3 * (1 - smooth(1.6, 3.4, dc));
      // the land rises toward the hill in the north
      out += 1.4 * smooth(30, 0, z);
      // the path keeps its own grade across the bridge
      const db = Math.hypot(x - BRIDGE.x, z - BRIDGE.z);
      if (db < 4.2 && distTo(PATH, x, z) < 1.4) out = Math.max(out, h + 1.4 * smooth(30, 0, z) - 0.05);
      return out;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 145, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // the path: two worn lines of bare dirt and a straw ridge between them, where feet don't go
      if (glyph === 'e') {
        const d = distTo(PATH, x, z);
        if (d < 0.25) return fine > 0.5 ? [150, 130, 96] : [140, 120, 88];
        if (d < 1.0) return fine > 0.6 ? [172, 150, 112] : [162, 140, 104];
      }
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', e: 'brush', w: 'brush' },
    exits: [
      { side: 'w', at: 37, w: 5, to: 'seven-flags', spawn: 'trail', name: 'town' },
      { side: 'n', at: 52, w: 6, to: 'church', spawn: 'trail', name: 'hill' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the footbridge (hero): planks on ties, a rope rail
      const br = new THREE.Group();
      br.position.set(BRIDGE.x, 0, BRIDGE.z);
      br.rotation.y = BRIDGE.rot;
      const plank = colMat('#8a6a48', { roughness: 1 }), tie = colMat('#4a3a2c', { roughness: 1 });
      for (const sz of [-1.1, 1.1]) br.add(box(BRIDGE.len, 0.18, 0.22, tie, 0, -0.14, sz));
      for (let i = 0; i < 16; i++) { const p = box(0.4, 0.06, 2.4, plank, -BRIDGE.len / 2 + 0.25 + i * 0.46, 0, 0); p.rotation.y = (Math.sin(i * 7.1) * 0.05); br.add(p); }
      for (const sz of [-1.2, 1.2]) for (const sx of [-3.4, 0, 3.4]) br.add(box(0.1, 1.0, 0.1, M.wood(), sx, 0, sz));
      const rope = colMat('#c8b08a', { roughness: 1 });
      for (const sz of [-1.2, 1.2]) br.add(box(BRIDGE.len - 0.4, 0.04, 0.04, rope, 0, 0.9, sz));
      br.position.y = 0.02;
      scene.add(br);
      // the banks stay where they are: no climbing off the bridge into the creek here
      for (const sz of [-1.35, 1.35]) for (let t = -3.4; t <= 3.4; t += 0.45) {
        const c = Math.cos(BRIDGE.rot), s = Math.sin(BRIDGE.rot);
        const x = BRIDGE.x + t * c + sz * s, z = BRIDGE.z - t * s + sz * c;
        addSolid(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
      }

      // ------------------------------------------------ the lanterns (signature): one every stretch, lit every night
      const LAMPS: Pt[] = [[6, 39.6], [18, 39.2], [29, 36.6], [37.6, 31.6], [45.6, 23.6], [49.6, 15.6], [54.4, 6]];
      for (const [x, z] of LAMPS) d.built.push(lanternPost(scene, x, z, night, night));

      // ------------------------------------------------ the windmill and the stock tank (routine), kept clean
      d.built.push(windmill(scene, 66, 21.6));
      stockTank(scene, 63.2, 25, 1.1);
      d.things.push({ x: 63.2, z: 26.6, r: 2.0, label: 'Stock tank', lines: ['A stock tank, full to the lip. The windmill turns over it, slow, and a pipe drips.', 'Somebody keeps the scum skimmed off.'] });

      // ------------------------------------------------ what the trail passes
      boardSign(scene, 9.4, 34.6, 'AGUA Y PAN ^', 0.2, 141);
      d.things.push({ x: 9.4, z: 35.6, r: 1.6, label: 'Sign', lines: ['A board on a post, painted by hand: AGUA Y PAN. The arrow points up the trail.'] });
      powerLine(scene, [[20, 46, 0.12], [38, 44, -0.08], [56, 41, 0.2], [72, 36, -0.04], [87, 32, 0.15]], [[0, 1], [1, 2], [3, 4]]);
      ruinWall(scene, 24, 24, 5, 1.4, 0.3, seed()); ruinWall(scene, 27.6, 21, 3.4, 0.9, 1.8, seed()); rubble(scene, 26, 22.6, 1.4, seed());
      d.things.push({ x: 25.6, z: 25.2, r: 2.2, label: 'Walls', lines: ['Two walls of a house, the rest gone. A doorstep with nothing behind it.'] });
      cairn(scene, 47.4, 10.6, seed());
      // a small cross of two sticks bound with wire, stuck in the cairn
      const cr = new THREE.Group();
      cr.add(box(0.06, 0.9, 0.06, M.wood(), 0, 0.4, 0), box(0.46, 0.06, 0.06, M.wood(), 0, 1.0, 0));
      cr.position.set(47.4, 0.2, 10.6);
      scene.add(cr);
      d.things.push({ x: 47.4, z: 11.6, r: 1.4, label: 'Cairn', lines: ['White stones stacked knee high. A cross of two sticks stands in the top, bound with wire.'] });
      skull(scene, 70, 46, 0.6);
      for (const [x, z, s] of [[34, 44, 1.1], [60, 30, 1.0], [16, 26, 1.2], [56, 12, 0.9]] as Array<[number, number, number]>) d.tree(deadMesquite(x, z, s, seed()), 0.25);
      for (const [x, z, s] of [[42, 36, 0.5], [22, 30.6, 0.4], [58, 26, 0.45]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      for (const [x, z, s] of [[12, 44, 0.9], [54, 34, 0.8], [36, 16, 0.85]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());

      d.spawns.trail = { x: 52, z: 3, face: 'S' };
      // the way back to town: the same gate, seen from the trail's side
      d.built.push(trailGate(scene, 2.4, 37, 3.2, Math.PI / 2, night));
      d.spawns.town = { x: 4.4, z: 37, face: 'E' };
      brushFill(d, 141, 1);
      openScatter(d, 142, ['x', 's'], 0.8, (x, z) => clearOf(PATH, 2.6)(x, z) && Math.hypot(x - 64, z - 24) > 5 && Math.hypot(x - BRIDGE.x, z - BRIDGE.z) > 5);
    },
  };
}
