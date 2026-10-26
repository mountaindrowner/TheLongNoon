import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { mesquite, bush, deadTree, tumbleweed } from '../../engine/foliage';
import { rock } from '../../engine/props';
import { fbm } from '../../engine/noise';
import { box, beam, colMat, shade } from '../../engine/geo';
import { addSolid, insideSolid } from '../../engine/world';
import { STRAW, nopal, desertScatter, carHulk } from './props';
import { spanPaint, retainingWall, jerseys, fallenSign, gantry, fuelCanopy, cairn } from './kit';
import { spanDoor } from './doors';

/**
 * THE RAMP (the Span, cell 0,0). The last of the Span before the highway: a
 * dirt frontage road up from Mar Farm, the on-ramp climbing to the
 * Thirty-Five, the highway on its embankment heading north. Road leg, tier
 * ruined, quiet on purpose (methodology §7.2).
 *
 * - Hero: where the highway stops: the embankment sheared off, the slab
 *   tipped into the dirt, rebar hanging out of it.
 * - Routine: the checkpoint gantry over the ramp, its scanner still sweeping, its lamp still saying STOP.
 * - Signature: the green sign face-down by the ramp. Underneath, out of the sun, it kept its
 *   letters: the region's one Old Name (methodology §3.5).
 * - Side pocket: a fuel canopy and a restroom block, shut: a shade-hold to come back to.
 * - Ways out: south to Mar Farm; north up the Thirty-Five (the next region).
 */

export const COLS = 44, ROWS = 32;
const TOP = 3.0;
const A: [number, number] = [26.5, 22.6], B: [number, number] = [11.0, 8.4]; // the on-ramp, foot to top
const HW = { x0: 2.6, x1: 10.4, z1: 20.5 }; // the highway on its embankment

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
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(20, 4, 5, 3, 's', 21, (q) => q === 'x');
      g.blob(36, 26, 4, 3, 's', 22, (q) => q === 'x');
      g.rect(3, 0, 7, 21, 'd'); // the highway deck
      g.line([A, B], 3.2, 'd'); // the on-ramp
      g.line([[39.5, ROWS + 1], [37, 27], [31, 23.6], [A[0], A[1]]], 2.6, 'e', (q) => q !== 'd'); // the frontage road up from home
      g.rect(28, 5, 14, 9, 'b'); // the fuel lot, broken concrete
    },
    height(x, z, h) {
      // the on-ramp rises from the frontage road to the deck
      const [t, d] = rampParam(x, z);
      let out = h;
      if (d < 2.4) out = THREE.MathUtils.lerp(TOP * t, h, smooth(1.6, 2.4, d));
      // the highway's embankment, flat on top, ending where it was cut
      const e = Math.hypot(Math.max(HW.x0 - x, 0, x - HW.x1), Math.max(0, z - HW.z1));
      if (e < 1.0) out = THREE.MathUtils.lerp(TOP, out, smooth(0, 1.0, e));
      return out;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 63, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // lane dashes on the deck, half gone
      if (glyph === 'd' && x > HW.x0 && x < HW.x1 && z < HW.z1 && Math.abs(x - 6.5) < 0.07 && (z % 3) < 1.6 && fine > 0.3) return [200, 192, 172];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'scrub', w: 'bluff', e: 'trees', s: 'none' },
    exits: [{ side: 'n', at: 6.5, w: 6, to: 'thirty-five', spawn: 'south', name: 'north' }],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the highway: retaining walls, barriers, the cut end (hero)
      retainingWall(scene, HW.x1 + 0.15, 0, HW.x1 + 0.15, 6.0, TOP);
      retainingWall(scene, HW.x1 + 0.15, 10.8, HW.x1 + 0.15, HW.z1, TOP);
      retainingWall(scene, HW.x0 - 0.15, 0, HW.x0 - 0.15, HW.z1, TOP);
      retainingWall(scene, HW.x0 - 0.15, HW.z1 + 0.15, HW.x1 + 0.15, HW.z1 + 0.15, TOP);
      addSolid(HW.x1, 0, HW.x1 + 0.4, 6.0); addSolid(HW.x1, 10.8, HW.x1 + 0.4, HW.z1 + 0.4);
      addSolid(HW.x0 - 0.4, 0, HW.x0, HW.z1 + 0.4); addSolid(HW.x0, HW.z1, HW.x1, HW.z1 + 0.4);
      jerseys(scene, [[3.2, 0.4], [3.2, 19.8]], seed(), TOP);
      jerseys(scene, [[9.8, 0.4], [9.8, 5.6]], seed(), TOP);
      jerseys(scene, [[9.8, 11.4], [9.8, 19.8]], seed(), TOP);
      jerseys(scene, [[4.0, 19.8], [9.2, 19.8]], seed(), TOP); // somebody blocked the edge
      // the slab that went down, rebar out of the cut like roots
      const slab = box(6.6, 0.5, 4.6, M.concrete(), 0, 0, 0);
      slab.position.set(6.5, 1.25, 23.0);
      slab.rotation.x = 0.62;
      scene.add(shade(slab));
      addSolid(3.2, 20.6, 9.8, 25.2);
      const rebar = colMat('#5a3a26', { metalness: 0.5 });
      for (let i = 0; i < 9; i++) scene.add(beam(new THREE.Vector3(3.4 + i * 0.75, TOP - 0.3, HW.z1 + 0.3), new THREE.Vector3(3.6 + i * 0.75 + Math.sin(i * 2.1) * 0.4, TOP - 0.9 - (i % 3) * 0.3, HW.z1 + 0.9 + (i % 2) * 0.4), 0.035, rebar));
      for (const [x, z, s] of [[2.6, 23.4, 0.5], [10.6, 24.0, 0.6], [5.0, 26.2, 0.4], [9.0, 26.6, 0.35], [11.6, 21.8, 0.45]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      // the highway goes on north, out of the region
      scene.add(box(HW.x1 - HW.x0, TOP + 1.2, 40, M.concrete(), (HW.x0 + HW.x1) / 2, -1.2, -20));
      scene.add(box(HW.x1 - HW.x0 - 0.6, 0.02, 40, colMat('#5f5c57', { roughness: 1 }), (HW.x0 + HW.x1) / 2, TOP, -20));

      // ------------------------------------------------ the on-ramp, its barriers, the gantry (routine)
      const [dx, dz] = [B[0] - A[0], B[1] - A[1]], L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L;
      jerseys(scene, [[A[0] + nx * 1.8 + (dx / L) * 2, A[1] + nz * 1.8 + (dz / L) * 2], [B[0] + nx * 1.8 + 0.6, B[1] + nz * 1.8 - 0.4]], seed());
      jerseys(scene, [[A[0] - nx * 1.8 + (dx / L) * 2, A[1] - nz * 1.8 + (dz / L) * 2], [B[0] - nx * 1.8 + 0.6, B[1] - nz * 1.8 + 0.4]], seed());
      const P = [A[0] + dx * 0.45, A[1] + dz * 0.45];
      d.built.push(gantry(scene, P[0]! + nx * 2.4, P[1]! + nz * 2.4, P[0]! - nx * 2.4, P[1]! - nz * 2.4, TOP * 0.45, night));

      // ------------------------------------------------ the sign, face down (signature)
      fallenSign(scene, 25.2, 17.4, 0.3);

      // ------------------------------------------------ the side pocket: a fuel canopy, a restroom block shut tight
      fuelCanopy(scene, 34.6, 9.0, 9.0, 6.0);
      d.built.push(...building(scene, { x: 40.0, z: 16.2, w: 3.6, d: 2.8, h: 2.4, wall: 'concrete', roof: 'flat', seed: 41, doors: [{ x: 0.4, ...spanDoor('shut', night) }] }, night));
      carHulk(scene, 30.4, 11.8, 1.4, seed());
      cairn(scene, 5.4, 12.0, seed()); // up on the deck: given to the sun

      // ------------------------------------------------ brush, thick to the east, thin by the road
      for (const [x, z, s] of [[38.2, 21.4, 1.1], [42.0, 24.0, 1.2], [40.4, 28.6, 1.0], [33.0, 28.8, 1.1], [16.2, 26.8, 1.0], [22.0, 6.6, 1.1], [43.0, 4.6, 1.0]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      d.tree(deadTree(18.4, 4.0, 1.1, seed()), 0.2);
      for (const [x, z, s] of [[14.6, 24.4, 1.0], [24.4, 27.6, 0.8], [30.0, 18.4, 0.9], [13.4, 12.6, 0.7], [36.4, 30.4, 1.0]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[12.8, 30.6, 0.8], [27.4, 2.4, 0.9], [35.4, 24.0, 0.8], [19.6, 28.8, 0.7], [42.6, 13.6, 0.8]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      for (const [x, z, s] of [[15.6, 16.6, 0.4], [29.0, 26.6, 0.35], [23.0, 12.0, 0.45]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      tumbleweed(scene, 21.2, 19.6, 5); tumbleweed(scene, 33.6, 21.6, 6);
      desertScatter(scene, COLS, ROWS, 79, (x, z) => ['x', 's', '#', 'b'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3) && (x > HW.x1 + 1 || z > HW.z1 + 1));

      // ------------------------------------------------ what you can look at
      d.things.push(
        { x: 25.2, z: 19.0, r: 2.4, label: 'Sign', lines: ['A highway sign, face down in the caliche.', 'Underneath, where the sun never reached, the letters are still white: NORTH 35. SAN ANTONIO 154.'] },
        { x: P[0]!, z: P[1]! + 1.0, r: 2.0, label: 'Gantry', lines: ['A steel frame over the ramp. Something on it turns to watch whatever passes. A red light says STOP.'] },
        { x: 6.5, z: 25.4, r: 2.6, label: 'The end of the road', lines: ['The highway just stops. The rest of it is down there, in pieces, rebar hanging out like roots.'] },
        { x: 40.4, z: 18.0, r: 1.4, label: 'Door', lines: ['Shut. Cool air comes from under it.'] },
        { x: 5.4, z: 13.2, r: 1.4, label: 'Stones', lines: ['Stones stacked waist high, bleached white. Bones between them, set with care.'] },
        { x: 34.6, z: 12.6, r: 2.2, label: 'Canopy', lines: ['A roof on four legs over dead pumps. Open on every side.'] },
      );
      void colMat;
    },
  };
}
