import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { rock } from '../../engine/props';
import { box, beam, colMat, shade } from '../../engine/geo';
import { addSolid } from '../../engine/world';
import { carHulk, tires } from './props';
import { spanPaint, retainingWall, jerseys, fallenSign, gantry, fuelCanopy, cairn } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { rubble } from './ruins';

/**
 * THE RAMP (the Span; medium, 88×64). The last of the Span before the
 * highway: the frontage road up from Mar Farm, the on-ramp climbing to the
 * Thirty-Five, the highway on its embankment heading north. Road leg, tier
 * ruined, quiet on purpose (methodology §7.2).
 *
 * - Hero: where the highway stops: the embankment sheared off, the slab
 *   tipped into the dirt, rebar hanging out of it.
 * - Routine: the checkpoint gantry over the ramp, its scanner still sweeping, its lamp still saying STOP.
 * - Signature: the green sign face-down by the ramp. Underneath, out of the sun, it kept its
 *   letters: the region's one Old Name (methodology §3.5).
 * - Side pocket: a fuel canopy and a restroom block, shut: a shade-hold to come back to.
 * - Ways out: south to Mar Farm (the frontage road); north up the Thirty-Five (the next region).
 */

export const COLS = 88, ROWS = 64;
const TOP = 3.4;
const HW = { x0: 6, x1: 20, z1: 38 }; // the highway on its embankment, four lanes
const A: [number, number] = [50, 46], B: [number, number] = [22, 17]; // the on-ramp, foot to top
const FRONTAGE: Array<[number, number]> = [[66, ROWS + 1], [64, 56], [58, 50], [A[0], A[1]]];

const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function rampParam(x: number, z: number): [number, number] {
  const dx = B[0] - A[0], dz = B[1] - A[1], L = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / L));
  return [t, Math.hypot(x - (A[0] + dx * t), z - (A[1] + dz * t))];
}

export function ramp(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'ramp',
    title: 'The Ramp',
    sub: 'The road to the Thirty-Five',
    kind: 'road',
    cols: COLS,
    rows: ROWS,
    seed: 63,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(40, 8, 8, 4, 's', 21, (q) => q === 'x');
      g.blob(76, 50, 6, 5, 's', 22, (q) => q === 'x');
      g.rect(HW.x0, 0, HW.x1 - HW.x0, HW.z1 + 1, 'd'); // the highway deck
      g.line([A, B], 4.4, 'd'); // the on-ramp
      g.line(FRONTAGE, 3.4, 'e', (q) => q !== 'd'); // the frontage road up from home
      g.rect(60, 8, 22, 16, 'b'); // the fuel lot, broken concrete
      g.line([[58, 50], [70, 24]], 2.6, 'e', (q) => q !== 'd'); // a track to the lot
      // brush: mottes east and south, a long wall of it under the embankment
      motte(g, 78, 40, 9, 8, 31); motte(g, 40, 58, 10, 5, 32); motte(g, 32, 34, 6, 5, 33); motte(g, 82, 4, 6, 4, 34);
      motte(g, 24, 52, 9, 7, 35); motte(g, 52, 24, 5, 4, 36);
    },
    height(x, z, h) {
      // the on-ramp rises from the frontage road to the deck
      const [t, dd] = rampParam(x, z);
      let out = h;
      if (dd < 3.2) out = THREE.MathUtils.lerp(TOP * t, h, smooth(2.2, 3.2, dd));
      // the highway's embankment, flat on top, ending where it was cut
      const e = Math.hypot(Math.max(HW.x0 - x, 0, x - HW.x1), Math.max(0, z - HW.z1));
      if (e < 1.2) out = THREE.MathUtils.lerp(TOP, out, smooth(0, 1.2, e));
      return out;
    },
    paint(glyph, x, z, fine) {
      // lane dashes on the deck, half gone
      if (glyph === 'd' && x > HW.x0 && x < HW.x1 && z < HW.z1 && (Math.abs(x - 9.5) < 0.07 || Math.abs(x - 16.5) < 0.07) && (z % 3) < 1.6 && fine > 0.3) return [200, 192, 172];
      if (glyph === 'd' && x > HW.x0 && x < HW.x1 && Math.abs(x - 13) < 0.1 && fine > 0.2) return [190, 160, 70]; // the yellow line down the middle
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', w: 'bluff', e: 'brush', s: 'brush' },
    exits: [
      { side: 'n', at: 13, w: 12, to: 'thirty-five', spawn: 'south', name: 'north' },
      { side: 's', at: 66, w: 5, to: 'mar-farm', spawn: 'ramp', name: 'farm' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the highway: retaining walls, barriers, the cut end (hero)
      retainingWall(scene, HW.x1 + 0.15, 0, HW.x1 + 0.15, 12.0, TOP);
      retainingWall(scene, HW.x1 + 0.15, 22.4, HW.x1 + 0.15, HW.z1, TOP);
      retainingWall(scene, HW.x0 - 0.15, 0, HW.x0 - 0.15, HW.z1, TOP);
      retainingWall(scene, HW.x0 - 0.15, HW.z1 + 0.15, HW.x1 + 0.15, HW.z1 + 0.15, TOP);
      addSolid(HW.x1, 0, HW.x1 + 0.4, 12.0); addSolid(HW.x1, 22.4, HW.x1 + 0.4, HW.z1 + 0.4);
      addSolid(HW.x0 - 0.4, 0, HW.x0, HW.z1 + 0.4); addSolid(HW.x0, HW.z1, HW.x1, HW.z1 + 0.4);
      jerseys(scene, [[6.6, 0.4], [6.6, 37.6]], seed(), TOP);
      jerseys(scene, [[13, 2], [13, 30]], seed(), TOP); // the median
      jerseys(scene, [[19.4, 0.4], [19.4, 11.4]], seed(), TOP);
      jerseys(scene, [[19.4, 23.0], [19.4, 37.6]], seed(), TOP);
      jerseys(scene, [[7.4, 37.6], [18.6, 37.6]], seed(), TOP); // somebody blocked the edge
      // the slab that went down, rebar out of the cut like roots
      const slab = box(13.2, 0.6, 6.4, M.concrete(), 0, 0, 0);
      slab.position.set(13, 1.4, 41.4);
      slab.rotation.x = 0.6;
      scene.add(shade(slab));
      addSolid(6.4, 38.4, 19.6, 44.6);
      const rebar = colMat('#5a3a26', { metalness: 0.5 });
      for (let i = 0; i < 18; i++) scene.add(beam(new THREE.Vector3(6.6 + i * 0.75, TOP - 0.3, HW.z1 + 0.3), new THREE.Vector3(6.8 + i * 0.75 + Math.sin(i * 2.1) * 0.4, TOP - 0.9 - (i % 3) * 0.3, HW.z1 + 0.9 + (i % 2) * 0.4), 0.035, rebar));
      for (const [x, z, s] of [[5.2, 42, 0.6], [20.6, 43, 0.7], [9, 46, 0.5], [17, 47, 0.45], [22.6, 40.4, 0.55], [12, 49, 0.4]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      rubble(scene, 16, 47.5, 1.3, seed());
      // the highway goes on north, out of the region
      scene.add(box(HW.x1 - HW.x0, TOP + 1.2, 40, M.concrete(), (HW.x0 + HW.x1) / 2, -1.2, -20));
      scene.add(box(HW.x1 - HW.x0 - 0.6, 0.02, 40, colMat('#5f5c57', { roughness: 1 }), (HW.x0 + HW.x1) / 2, TOP, -20));
      carHulk(scene, 10, 8, 0.1, seed()); carHulk(scene, 16.4, 26, 3.2, seed()); // stopped where they stopped
      cairn(scene, 9.6, 22, seed()); // up on the deck: given to the sun

      // ------------------------------------------------ the on-ramp, its barriers, the gantry (routine)
      const [dx, dz] = [B[0] - A[0], B[1] - A[1]], L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L;
      jerseys(scene, [[A[0] + nx * 2.4 + (dx / L) * 2, A[1] + nz * 2.4 + (dz / L) * 2], [B[0] + nx * 2.4 + 0.6, B[1] + nz * 2.4 - 0.4]], seed());
      jerseys(scene, [[A[0] - nx * 2.4 + (dx / L) * 2, A[1] - nz * 2.4 + (dz / L) * 2], [B[0] - nx * 2.4 + 0.6, B[1] - nz * 2.4 + 0.4]], seed());
      const P = [A[0] + dx * 0.42, A[1] + dz * 0.42];
      d.built.push(gantry(scene, P[0]! + nx * 3.2, P[1]! + nz * 3.2, P[0]! - nx * 3.2, P[1]! - nz * 3.2, TOP * 0.42, night));

      // ------------------------------------------------ the sign, face down (signature)
      fallenSign(scene, 44, 32, 0.3);

      // ------------------------------------------------ the side pocket: a fuel canopy, a restroom block shut tight
      fuelCanopy(scene, 68, 14, 12, 7);
      d.built.push(...building(scene, { x: 78.0, z: 20.4, w: 4.4, d: 3.2, h: 2.6, wall: 'concrete', roof: 'flat', seed: 41, doors: [{ x: 0.4, ...spanDoor('shut', night) }] }, night));
      carHulk(scene, 63.4, 19, 1.4, seed()); carHulk(scene, 72, 9.6, 0.2, seed());
      tires(scene, 81, 12, 5);

      // ------------------------------------------------ brush
      brushFill(d, 63, 1);
      openScatter(d, 64, ['x', 's'], 0.9, (x, z) => clearOf(FRONTAGE, 3)(x, z) && clearOf([A, B], 4)(x, z) && !(x < HW.x1 + 1.5 && z < HW.z1 + 8));

      // ------------------------------------------------ what you can look at
      d.things.push(
        { x: 44, z: 33.6, r: 2.6, label: 'Sign', lines: ['A highway sign, face down in the caliche.', 'Underneath, where the sun never reached, the letters are still white: NORTH 35. SAN ANTONIO 154.'] },
        { x: P[0]!, z: P[1]! + 1.0, r: 2.4, label: 'Gantry', lines: ['A steel frame over the ramp. Something on it turns to watch whatever passes. A red light says STOP.'] },
        { x: 13, z: 45.4, r: 3.2, label: 'The end of the road', lines: ['The highway just stops. The rest of it is down there, in pieces, rebar hanging out like roots.'] },
        { x: 78.4, z: 22.4, r: 1.4, label: 'Door', lines: ['Shut. Cool air comes from under it.'] },
        { x: 9.6, z: 23.2, r: 1.4, label: 'Stones', lines: ['Stones stacked waist high, bleached white. Bones between them, set with care.'] },
        { x: 68, z: 17.6, r: 2.6, label: 'Canopy', lines: ['A roof on four legs over dead pumps. Open on every side.'] },
      );
    },
  };
}
