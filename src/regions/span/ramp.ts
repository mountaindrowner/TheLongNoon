import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { rock } from '../../engine/props';
import { box, beam, colMat, shade } from '../../engine/geo';
import { addSolid } from '../../engine/world';
import { carHulk, tires } from './props';
import { spanPaint, retainingWall, jerseys, fallenSign, gantry, fuelCanopy, cairn, exitVeil } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { rubble } from './ruins';

/**
 * THE RAMP (the Span; medium, 88×64). The Thirty-Five north out of Seven
 * Flags: four lanes and a median, an exit ramp down to an old fuel stop, the
 * checkpoint, and the overpass that came down. Road leg, tier ruined, quiet
 * on purpose (methodology §7.2): the region's road out.
 *
 * - Hero: the overpass, half of it down across the southbound lanes, rebar hanging out of the break.
 * - Routine: the checkpoint gantry over the ramp, its scanner still sweeping, its lamp still saying STOP.
 * - Signature: the green sign face-down by the ramp. Underneath, out of the sun, it kept its
 *   letters: the region's one Old Name (methodology §3.5).
 * - Side pocket: a fuel canopy and a restroom block, shut: a shade-hold to come back to.
 * - Ways out: south down the Thirty-Five into town; north up the Thirty-Five (the next region).
 */

export const COLS = 88, ROWS = 64;
const TOP = 2.6; // the deck's height where it comes up out of town on its embankment
/** The highway comes north out of town on its embankment and settles to grade before the overpass. */
const deckY = (z: number): number => TOP * smooth(38, 58, z);
const HW = { x0: 7, x1: 19, z1: ROWS }; // the highway, four lanes, the whole length of the map
const A: [number, number] = [50, 46], B: [number, number] = [20, 20]; // the exit ramp, from the fuel stop up to the highway
const FRONTAGE: Array<[number, number]> = [[A[0], A[1]], [56, 40]];
const BRIDGE = 30; // where the overpass crossed

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
      g.line(FRONTAGE, 3.4, 'e', (q) => q !== 'd');
      g.rect(60, 8, 22, 16, 'b'); // the fuel lot, broken concrete
      g.line([[58, 50], [70, 24]], 2.6, 'e', (q) => q !== 'd'); // a track to the lot
      // brush: mottes east and south, a long wall of it under the embankment
      motte(g, 78, 40, 9, 8, 31); motte(g, 40, 58, 10, 5, 32); motte(g, 32, 34, 6, 5, 33); motte(g, 82, 4, 6, 4, 34);
      motte(g, 34, 52, 7, 6, 35); motte(g, 52, 24, 5, 4, 36);
    },
    height(x, z, h) {
      // the highway and its ramp lie flat; the land rolls a little either side
      const [, dd] = rampParam(x, z);
      let out = h;
      if (dd < 3.2) out = THREE.MathUtils.lerp(0, h, smooth(2.2, 3.2, dd));
      const e = Math.max(HW.x0 - x, 0, x - HW.x1);
      if (e < 1.2) out = THREE.MathUtils.lerp(deckY(z), out, smooth(0, 1.2, e));
      return out;
    },
    paint(glyph, x, z, fine) {
      // lane dashes on the deck, half gone
      if (glyph === 'd' && x > HW.x0 && x < HW.x1 && z < HW.z1 && (Math.abs(x - 10) < 0.07 || Math.abs(x - 16) < 0.07) && (z % 3) < 1.6 && fine > 0.3) return [200, 192, 172];
      if (glyph === 'd' && x > HW.x0 && x < HW.x1 && Math.abs(x - 13) < 0.1 && fine > 0.2) return [190, 160, 70]; // the yellow line down the middle
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', w: 'bluff', e: 'brush', s: 'brush' },
    exits: [
      { side: 'n', at: 13, w: 12, to: 'thirty-five', spawn: 'south', name: 'north' },
      { side: 's', at: 13, w: 12, to: 'seven-flags', spawn: 'north', name: 'town' },
    ],
    dress(d) {
      const { scene } = d;
      // the lookout on the road north, day and night under his wraps: he holds a line across the deck (the caravan leaves this way, later)
      d.npcs.push({
        id: 'chuy', name: 'Chuy', sprite: 'chuy', x: 20.8, z: 5.4, face: 'W', allDay: true,
        lines: ['Machines don’t come past the ramp. Usually.', '“Usually” is my whole job.'],
        guard: {
          x0: 5, x1: 22, z0: 1.5, z1: 4.2, back: [14.6, 8.6],
          lines: ['Whoa. That’s the Thirty-Five, Juno. Nobody walks north alone.', 'Go on home. Whatever’s up that road will still be there tomorrow.'],
          again: ['Still the Thirty-Five. Still no.'],
          // the night Juno leaves (night seven), he lets her by
          unless: 'n7_leave',
        },
      });
      const seed = (): number => d.seed();

      // ------------------------------------------------ the highway: the median, the overpass that came down (hero)
      jerseys(scene, [[13, 0.6], [13, BRIDGE - 5]], seed());
      jerseys(scene, [[13, BRIDGE + 5], [13, ROWS - 0.6]], seed());
      // where the deck is still up on its embankment, barriers along both edges and walls below them
      for (const ex of [HW.x0 + 0.4, HW.x1 - 0.4]) {
        jerseys(scene, [[ex, 40], [ex, ROWS - 0.2]], seed());
        for (let z = 40; z < ROWS; z += 0.5) addSolid(ex - 0.35, z - 0.3, ex + 0.35, z + 0.3);
      }
      for (const wx of [HW.x0 - 0.15, HW.x1 + 0.15]) for (let z = 44; z < ROWS; z += 4) retainingWall(scene, wx, z, wx, Math.min(ROWS, z + 4), deckY(z + 2));
      // the piers either side, the half that still stands over the northbound lanes, the half that fell
      for (const px of [4.6, 21.4]) { scene.add(box(1.2, 5.2, 1.6, M.concrete(), px, 0, BRIDGE)); addSolid(px - 0.6, BRIDGE - 0.8, px + 0.6, BRIDGE + 0.8); }
      scene.add(box(1.0, 5.2, 1.4, M.concrete(), 13, 0, BRIDGE)); addSolid(12.5, BRIDGE - 0.7, 13.5, BRIDGE + 0.7);
      const deck = box(9, 0.8, 4.2, M.concrete(), 0, 0, 0);
      deck.position.set(17.4, 5.2, BRIDGE);
      scene.add(shade(deck));
      const fallen = box(9.4, 0.8, 4.2, M.concrete(), 0, 0, 0);
      fallen.position.set(8.6, 1.9, BRIDGE + 0.4);
      fallen.rotation.z = -0.42;
      scene.add(shade(fallen));
      addSolid(4.4, BRIDGE - 2.2, 12.6, BRIDGE + 2.6);
      const rebar = colMat('#5a3a26', { metalness: 0.5 });
      for (let i = 0; i < 10; i++) scene.add(beam(new THREE.Vector3(12.9, 4.8 + (i % 3) * 0.2, BRIDGE - 1.8 + i * 0.4), new THREE.Vector3(12.0 - (i % 2) * 0.4, 3.9 - (i % 3) * 0.4, BRIDGE - 1.8 + i * 0.4 + Math.sin(i) * 0.3), 0.035, rebar));
      for (const [x, z, s] of [[5.2, 34, 0.6], [11, 36, 0.5], [8, 26.6, 0.45], [6.4, 37.4, 0.4]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      rubble(scene, 9, 35, 1.3, seed());
      // the highway goes on north, out of the region
      scene.add(box(HW.x1 - HW.x0, 0.02, 40, colMat('#5f5c57', { roughness: 1 }), (HW.x0 + HW.x1) / 2, 0, -20));
      carHulk(scene, 10, 8, 0.1, seed()); carHulk(scene, 16.4, 46, 3.2, seed()); // stopped where they stopped
      cairn(scene, 23.4, 12, seed()); // by the shoulder: given to the sun

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
      // ------------------------------------------------ a second sign down by the ramp's foot: the sled, on the last night
      fallenSign(scene, 24, 52, -0.4);
      d.things.push({ x: 24, z: 53.8, r: 2.6, label: 'Sign', script: 'sled' });
      // back down to town: the highway fades out past the south edge (the hub, its own place)
      exitVeil(scene, 13, ROWS, 12, 's', night);
      d.spawns.town = { x: 10, z: ROWS - 2.4, face: 'N' }; // the west lanes, clear of the median
      brushFill(d, 63, 1);
      openScatter(d, 64, ['x', 's'], 0.9, (x, z) => clearOf(FRONTAGE, 3)(x, z) && clearOf([A, B], 4)(x, z) && x > HW.x1 + 1.5);

      // ------------------------------------------------ what you can look at
      d.things.push(
        { x: 44, z: 33.6, r: 2.6, label: 'Sign', lines: ['A highway sign, face down in the caliche.', 'Underneath, where the sun never reached, the letters are still white: NORTH 35. SAN ANTONIO 154.'] },
        { x: P[0]!, z: P[1]! + 1.0, r: 2.4, label: 'Gantry', lines: ['A steel frame over the ramp. Something on it turns to watch whatever passes. A red light says STOP.'] },
        { x: 13, z: BRIDGE + 3.6, r: 3.4, label: 'Overpass', lines: ['An overpass, half of it down across the southbound lanes, rebar hanging out of the break like roots.', 'The other half still stands, carrying nothing.'] },
        { x: 78.4, z: 22.4, r: 1.4, label: 'Door', lines: ['Shut. Cool air comes from under it.'] },
        { x: 23.4, z: 13.2, r: 1.4, label: 'Stones', lines: ['Stones stacked waist high, bleached white. Bones between them, set with care.'] },
        { x: 68, z: 17.6, r: 2.6, label: 'Canopy', lines: ['A roof on four legs over dead pumps. Open on every side.'] },
      );
    },
  };
}
