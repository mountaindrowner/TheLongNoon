import * as THREE from 'three';
import type { Grid, RGB, SectionSpec } from '../../engine/section';
import { box, colMat, shade } from '../../engine/geo';
import { addSolid } from '../../engine/world';
import { markDoor } from '../../engine/doorway';
import { rock, boardSign } from '../../engine/props';
import { fbm, vnoise } from '../../engine/noise';
import { STRAW, nopal, skull, lanternPost } from './props';
import { spanPaint, tracks, intakeTower, buoy, boatHull, trailer, picnicShelter, cairn, headwall, exitVeil } from './kit';
import { SPAN_FLORA, deadMesquite } from './brush';
import { brushFill, openScatter, motte } from './fill';
import { rubble } from './ruins';

/**
 * THE WHITE BOWL (the Span; large, 132×96). The lake, gone: a bowl of white
 * crust cracked into plates nearly the whole map wide, the boat ramps running
 * down into nothing, the intake tower standing where the water was deepest,
 * the dam along the west side holding back no water at all. Landmark stop,
 * tier ruined, empty on purpose.
 *
 * - Hero: the intake tower, the old waterline still banded on it.
 * - Routine: a buoy tipped on its side on the bed, its lamp blinking every four seconds for boats.
 * - Signature: the white: the only ground in the Span that shines back at the moon.
 * - Seen, never said: big tracks across the crust, two treads and cross-bars, bigger than
 *   anything in town drives (Memo: "bigger than any Stray"); the dead trees on the old shore.
 * - Ways out: north to the lake road (the park road, or up the drain).
 */

export const COLS = 132, ROWS = 96;
const BOWL = { cx: 68, cz: 54, rx: 54, rz: 33 };
const DRAIN = { x0: 102, x1: 108 };
const BIG: Array<[number, number]> = [[-1, 40], [24, 50], [52, 70], [80, 82], [110, 80], [133, 66]];
const RAMPS = [{ ax: 92, az: 18, bx: 84, bz: 30, half: 1.6 }, { ax: 30, az: 22, bx: 38, bz: 32, half: 1.4 }];
const PARK: Array<[number, number]> = [[80, -1], [82, 10], [92, 16]];

/** How far into the bowl a point is: <1 inside, a little noise on the shore. */
const bowlK = (x: number, z: number): number => Math.hypot((x - BOWL.cx) / BOWL.rx, (z - BOWL.cz) / BOWL.rz) - (vnoise(x * 0.18, z * 0.18, 77) - 0.5) * 0.12;
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A boat ramp: where along it and how far across, or null. */
function rampAt(x: number, z: number): { along: number; across: number } | null {
  for (const R of RAMPS) {
    const dx = R.bx - R.ax, dz = R.bz - R.az, L = Math.hypot(dx, dz);
    const along = ((x - R.ax) * dx + (z - R.az) * dz) / L;
    const across = ((x - R.ax) * -dz + (z - R.az) * dx) / L;
    if (along >= 0 && along <= L && Math.abs(across) <= R.half) return { along, across };
  }
  return null;
}

export function whiteBowl(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'white-bowl',
    title: 'The White Bowl',
    sub: 'Where the lake was',
    kind: 'side',
    cols: COLS,
    rows: ROWS,
    seed: 85,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
        const k = bowlK(x + 0.5, z + 0.5);
        if (k < 1) g.set(x, z, 'W');
        else if (k < 1.12) g.set(x, z, 's');
      }
      // brush on the old shore, thick where nobody goes
      for (const [cx, cz, rx, rz, s] of [[10, 8, 9, 6, 81], [120, 10, 10, 7, 82], [124, 60, 6, 14, 83], [8, 88, 8, 6, 84], [66, 92, 14, 3, 85], [116, 90, 10, 5, 86], [52, 6, 8, 4, 87]] as Array<[number, number, number, number, number]>) motte(g, cx, cz, rx, rz, s);
      g.rect(DRAIN.x0, 0, DRAIN.x1 - DRAIN.x0, 22, 'b'); // the drain comes down and opens onto the bed
      g.blob(105, 22, 3, 2, 'g', 41, (q) => q === 'b' || q === 's' || q === 'W'); // it still seeps
      g.line(PARK, 4, 'd'); // the park road
      g.rect(70, 8, 22, 9, 'b'); // the shore lot
      g.line([[30, 14], [30, 22]], 2.6, 'e');
      g.rect(20, 8, 16, 7, 'v'); // the picnic ground
    },
    height(x, z, h) {
      let out = h - 2.4 * smooth(1.1, 0.72, bowlK(x, z));
      // the drain keeps its depth until it meets the bowl
      if (z < 23) {
        const k = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 - x, x - DRAIN.x1) / 1.0));
        const inner = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 + 1.2 - x, x - (DRAIN.x1 - 1.2)) / 1.2));
        out = Math.min(out, h - 0.8 * k - 0.7 * inner);
      }
      // the dam along the west: a long earth bank
      if (x < 9) out += (9 - x) * 0.32 * smooth(0, 6, Math.min(z, ROWS - z));
      return out;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 65, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // the boat ramps: straight concrete slabs, scored across every half unit for grip
      const r = rampAt(x, z);
      if (r) return r.along % 0.5 < 0.05 ? [112, 106, 96] : fine > 0.8 ? [146, 140, 128] : [132, 126, 116];
      // the shore follows the true curve, not the grid cells it was laid out on
      if (glyph === 'W' || glyph === 's' || glyph === 'x') {
        const k = bowlK(x, z);
        const g = k < 1 ? 'W' : k < 1.12 ? 's' : glyph;
        const base = spanPaint(g, x, z, fine);
        if (g === 'W' || g === 's') return tracks(x, z, BIG, 'big', base ?? [200, 190, 170]) ?? base;
        return base;
      }
      return spanPaint(glyph, x, z, fine);
    },
    edges: { w: 'bluff', s: 'brush', e: 'brush', n: 'brush' },
    exits: [
      { side: 'n', at: 80, w: 8, to: 'lake-road', spawn: 'lake', name: 'road' },
      { side: 'n', at: 105, w: 6, to: 'lake-road', spawn: 'drain', name: 'drain' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();
      intakeTower(scene, 62, 50);
      d.built.push(buoy(scene, 84, 62, night));
      boatHull(scene, 96, 54, 5.0, 0.5, 0.16, '#d8d4c8');
      boatHull(scene, 44, 66, 2.6, -0.3, -0.24, '#3f6a8a');
      boatHull(scene, 76, 40, 3.4, 1.9, 0.1, '#a84a3a');
      boatHull(scene, 30, 44, 4.2, 2.6, -0.12, '#d8d4c8');
      trailer(scene, 86, 22, 2.15);
      trailer(scene, 76, 14, 0.4);
      picnicShelter(scene, 24, 11, 0.1); picnicShelter(scene, 32, 11.4, -0.08);
      picnicShelter(scene, 118, 30, -0.12);
      headwall(scene, 105, 22.6, DRAIN.x1 - DRAIN.x0 + 0.6, 1.2, 1);
      boardSign(scene, 78, 4, 'LAKE RD ^', 0.2, 51);
      d.built.push(lanternPost(scene, 84, 8, night, false)); // a post with its lantern long gone dark
      cairn(scene, 40, 84, seed()); cairn(scene, 16, 30, seed());
      skull(scene, 70, 70, 1.2); skull(scene, 106, 66, 2.4);
      rubble(scene, 112, 18, 1.2, seed());
      // the old shore's trees, dead where they stood when the water went
      for (const [x, z, s] of [[18, 26, 1.2], [14, 46, 1.1], [22, 72, 1.3], [46, 18, 1.0], [112, 40, 1.2], [118, 72, 1.1], [98, 86, 1.0], [40, 86, 1.1], [60, 18, 1.0]] as Array<[number, number, number]>) d.tree(deadMesquite(x, z, s, seed()), 0.25);
      for (const [x, z, s] of [[66, 54, 0.5], [90, 74, 0.4], [36, 54, 0.55], [100, 44, 0.45], [54, 36, 0.4]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      for (const [x, z, s] of [[100, 12, 0.9], [14, 18, 0.8], [124, 44, 1.0]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      // ------------------------------------------------ the old plane, buried to its wings (always here)
      const plane = new THREE.Group(), tin = colMat('#b8b4a8', { metalness: 0.4, roughness: 0.7 });
      plane.add(box(1.4, 0.9, 7, tin, 0, -0.3, 0), box(9, 0.14, 1.6, tin, 0, 0.0, -0.4), box(0.14, 1.4, 1.0, tin, 0, 0.4, 3.0));
      plane.position.set(104, 0, 78); plane.rotation.y = 0.5;
      scene.add(shade(plane));
      addSolid(100, 74, 108, 82);
      // ------------------------------------------------ the drone, down on day five (it's here only after it falls)
      const wreck = new THREE.Group(), hull = colMat('#d8d4cc', { metalness: 0.5, roughness: 0.45 }), burnt = colMat('#2a2624', { roughness: 1 });
      wreck.add(box(16, 2.2, 3.4, hull, 0, 0, 0), box(6, 0.2, 8, hull, -1, 1.0, 0), box(2.2, 1.6, 3.0, burnt, 5.6, 0.1, 0));
      wreck.children[1]!.rotation.z = 0.12;
      const gap = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshBasicMaterial({ color: '#050505' }));
      gap.position.set(6.5, 0.9, 1.72);
      wreck.add(gap);
      wreck.position.set(40, 0, 64);
      wreck.userData.when = 'drone_down';
      scene.add(shade(wreck));
      addSolid(32, 62.2, 48, 65.6);
      markDoor(46.5, 65.8, 'open');
      d.spawns.wreck = { x: 46.5, z: 67.4, face: 'S' };
      d.things.push(
        { x: 104, z: 80, r: 3.0, label: 'Plane', script: 'plane' },
        { x: 46.5, z: 66.2, r: 1.6, label: 'Hatch', script: 'wreck', when: 'drone_down', go: { to: 'fuselage', spawn: 'door' } },
        { x: 52, z: 70, r: 1.4, label: 'Mud', script: 'footprint', when: 'guero_lost&drone_down&!footprint_seen' },
      );
      // night six: scavengers from town at the wreck, and two Noonrider scouts on the dam
      d.npcs.push(
        { id: 'digger', name: 'Scavenger', sprite: 'scav', x: 36, z: 67.6, face: 'S', when: 'night:6' },
        { id: 'scout', name: 'Noonrider', sprite: 'noonrider', x: 8, z: 34, face: 'E', when: 'night:6' },
        { id: 'scout', name: 'Noonrider', sprite: 'noonrider', x: 8, z: 46, face: 'E', when: 'night:6' },
      );
      // back up to the Lake Road, its own place: the road, and the drain beside it
      exitVeil(scene, 80, 0, 8, 'n', night);
      exitVeil(scene, 105, 0, 6, 'n', night, '#8a8a84');
      brushFill(d, 85, 1);
      openScatter(d, 81, ['x', 's'], 0.5, (x, z) => !(x > 66 && x < 96 && z < 20) && !(x > 18 && x < 38 && z < 18));
      d.things.push(
        { x: 62, z: 52.4, r: 2.8, label: 'Tower', lines: ['A concrete tower standing out in the white. Halfway up, a dark band all the way round. Above it, the concrete is pale.'] },
        { x: 84, z: 63, r: 1.8, label: 'Buoy', lines: ['A buoy on its side on the dry bed. Every few breaths, its lamp blinks.'] },
        { x: 96, z: 56, r: 2.6, label: 'Boat', lines: ['A boat, sitting level on the crust as if it were floating.'] },
        { x: 88, z: 24, r: 2.0, label: 'Ramp', lines: ['A concrete ramp runs down into the bowl, and keeps going, under the crust.'] },
        { x: 52, z: 72, r: 2.4, label: 'Tracks', lines: ['Two treads, wide as a door, with cross-bars. They cross the whole bowl.'] },
        { x: 6, z: 40, r: 3.0, label: 'Dam', lines: ['A long bank of earth along the west side, a concrete lip along its top. On this side, nothing to hold.'] },
      );
    },
  };
}

export type { RGB };
