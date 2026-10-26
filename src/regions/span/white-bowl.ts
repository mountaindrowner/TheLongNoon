import type { Grid, RGB, SectionSpec } from '../../engine/section';
import { mesquite, bush, deadTree, tumbleweed } from '../../engine/foliage';
import { rock, boardSign } from '../../engine/props';
import { fbm, vnoise } from '../../engine/noise';
import { insideSolid } from '../../engine/world';
import { STRAW, nopal, desertScatter, skull } from './props';
import { spanPaint, tracks, intakeTower, buoy, boatHull, trailer, picnicShelter, cairn } from './kit';

/**
 * THE WHITE BOWL (the Span, cell 2,2). The lake, gone: a bowl of white crust
 * cracked into plates, a boat ramp running down into nothing, the intake tower
 * standing where the water was deepest. Landmark stop, tier ruined, empty on purpose.
 *
 * - Hero: the intake tower, the old waterline still banded on it.
 * - Routine: a buoy tipped on its side on the bed, its lamp blinking every four seconds for boats.
 * - Signature: the white: the only ground in the Span that shines back at the moon.
 * - Seen, never said: big tracks across the crust, two treads and cross-bars, bigger than
 *   anything in town drives (Memo: "bigger than any Stray").
 * - Ways out: north to the East Road (the park road, or up the drain).
 */

export const COLS = 44, ROWS = 32;
const BOWL = { cx: 24, cz: 19.6, rx: 16.6, rz: 9.4 };
const DRAIN = { x0: 12, x1: 18 };
const BIG: Array<[number, number]> = [[-1, 13.0], [10.0, 17.0], [22.0, 25.4], [34.0, 27.6], [45.0, 24.0]];

/** How far into the bowl a point is: <1 inside, a little noise on the shore. */
const bowlK = (x: number, z: number): number => Math.hypot((x - BOWL.cx) / BOWL.rx, (z - BOWL.cz) / BOWL.rz) - (vnoise(x * 0.35, z * 0.35, 77) - 0.5) * 0.14;
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function whiteBowl(): SectionSpec {
  let grid: Grid;
  return {
    id: 'white-bowl',
    title: 'The White Bowl',
    sub: 'Where the lake was',
    kind: 'side',
    cols: COLS,
    rows: ROWS,
    seed: 85,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
        const k = bowlK(x + 0.5, z + 0.5);
        if (k < 1) g.set(x, z, 'W');
        else if (k < 1.18) g.set(x, z, 's');
      }
      g.rect(DRAIN.x0, 0, DRAIN.x1 - DRAIN.x0, 11, 'b'); // the drain comes down and opens onto the bed
      g.blob(15, 10.6, 2.6, 1.6, 'g', 41, (q) => q === 'b' || q === 's' || q === 'W'); // it still seeps
      g.line([[33.6, -1], [34.4, 5.0]], 3.4, 'd'); // the park road
      g.rect(30, 4, 12, 6, 'b'); // the shore lot
      g.line([[33.0, 9.4], [28.6, 16.4]], 2.6, 'b'); // the boat ramp, down into nothing
    },
    height(x, z, h) {
      let out = h - 1.7 * smooth(1.12, 0.78, bowlK(x, z));
      // the drain keeps its depth until it meets the bowl
      if (z < 12) {
        const k = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 - x, x - DRAIN.x1) / 1.0));
        const inner = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 + 1.2 - x, x - (DRAIN.x1 - 1.2)) / 1.2));
        out = Math.min(out, h - 0.8 * k - 0.7 * inner);
      }
      return out;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 65, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      const base = spanPaint(glyph, x, z, fine);
      if (glyph === 'W' || glyph === 's') return tracks(x, z, BIG, 'big', base ?? [200, 190, 170]) ?? base;
      return base;
    },
    edges: { w: 'bluff', s: 'trees', e: 'scrub', n: 'none' },
    exits: [],
    dress(d) {
      const { scene, night } = d;
      const seed = (): number => d.seed();
      intakeTower(scene, 21.0, 18.4);
      d.built.push(buoy(scene, 27.6, 23.2, night));
      boatHull(scene, 31.6, 20.4, 5.0, 0.5, 0.16, '#d8d4c8');
      boatHull(scene, 13.4, 23.4, 2.6, -0.3, -0.24, '#3f6a8a');
      trailer(scene, 30.6, 13.4, 2.15);
      picnicShelter(scene, 40.4, 13.6, 0.1);
      picnicShelter(scene, 5.4, 6.0, -0.12);
      boardSign(scene, 36.8, 3.2, 'EAST RD ^', 0.2, 51);
      cairn(scene, 23.4, 30.0, seed());
      skull(scene, 35.4, 25.8, 1.2);
      for (const [x, z, s] of [[2.6, 22.0, 1.1], [42.0, 22.6, 1.2], [43.0, 6.6, 1.0], [8.0, 30.4, 1.0], [38.6, 30.6, 1.1], [2.4, 2.6, 1.0]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      for (const [x, z, s] of [[7.0, 11.6, 1.1], [39.6, 9.0, 1.0], [5.6, 26.8, 0.95], [30.0, 29.2, 1.0]] as Array<[number, number, number]>) d.tree(deadTree(x, z, s, seed()), 0.2);
      for (const [x, z, s] of [[25.4, 5.6, 0.9], [3.0, 16.6, 0.8], [42.6, 17.0, 1.0], [17.6, 30.0, 0.8]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[20.6, 4.2, 0.8], [9.6, 7.0, 0.7], [27.0, 30.6, 0.8]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      for (const [x, z, s] of [[18.4, 26.6, 0.35], [29.0, 17.0, 0.3], [10.6, 18.6, 0.4], [36.0, 15.6, 0.45]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      tumbleweed(scene, 24.6, 13.6, 9); tumbleweed(scene, 16.4, 21.0, 10);
      desertScatter(scene, COLS, ROWS, 81, (x, z) => ['x', 's', '#'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3));
      d.things.push(
        { x: 21.0, z: 20.2, r: 2.4, label: 'Tower', lines: ['A concrete tower standing out in the white. Halfway up, a dark band all the way round. Above it, the concrete is pale.'] },
        { x: 27.6, z: 24.2, r: 1.6, label: 'Buoy', lines: ['A buoy on its side on the dry bed. Every few breaths, its lamp blinks.'] },
        { x: 31.6, z: 22.0, r: 2.4, label: 'Boat', lines: ['A boat, sitting level on the crust as if it were floating.'] },
        { x: 29.6, z: 15.4, r: 1.8, label: 'Ramp', lines: ['A concrete ramp runs down into the bowl, and keeps going, under the crust.'] },
        { x: 21.4, z: 25.6, r: 2.0, label: 'Tracks', lines: ['Two treads, wide as a door, with cross-bars. They cross the whole bowl.'] },
      );
    },
  };
}

export type { RGB };
