import * as THREE from 'three';
import type { Grid, RGB, SectionSpec } from '../../engine/section';
import { mesquite, bush, deadTree, powerLine, tumbleweed } from '../../engine/foliage';
import { rock, boardSign } from '../../engine/props';
import { fbm } from '../../engine/noise';
import { insideSolid } from '../../engine/world';
import { dressDoor, markDoor } from '../../engine/doorway';
import { STRAW, nopal, desertScatter, carHulk, tires, lanternPost } from './props';
import { spanPaint, tracks, billboard, trafficSignal, busShelter, cairn, headwall } from './kit';

/**
 * THE EAST ROAD (the Span, cell 2,1). Where the boulevard leaves town:
 * the drain crossing under it, a fork south to the White Bowl, and the road
 * going on east into brush nobody takes after Lamp. Road leg, tier ruined.
 *
 * - Hero: the billboard at the fork, peeled down to nothing.
 * - Routine: the traffic light over the fork, cycling for nobody.
 * - Signature: the drain: a concrete channel crossing under the road, its culvert mouths black.
 * - Seen, never said: small tracks, six wheels, coming up out of the drain and heading east (Memo's "little tracks").
 * - Ways out: west to the Plaza; south to the White Bowl; east on the road (the next piece).
 * - The culverts are dark: a way in that needs a light you don't have yet (the drain, a dungeon to come).
 */

export const COLS = 44, ROWS = 32;
const DRAIN = { x0: 12, x1: 18 };
const SIX: Array<[number, number]> = [[15.2, 26.0], [17.4, 21.6], [22.0, 18.0], [30.0, 14.6], [38.0, 9.4], [44.5, 6.0]];

export function eastRoad(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'east-road',
    title: 'The East Road',
    sub: 'The Span',
    kind: 'road',
    cols: COLS,
    rows: ROWS,
    seed: 74,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(28, 6, 6, 4, 's', 31, (q) => q === 'x');
      g.blob(6, 12, 4, 3, 's', 32, (q) => q === 'x');
      g.rect(DRAIN.x0, 0, DRAIN.x1 - DRAIN.x0, ROWS, 'b'); // the drain: a concrete channel, north to south
      g.rect(0, 27, COLS, 4, 'd'); // the boulevard, going on east
      g.line([[33, 29], [33.6, ROWS + 1]], 3.4, 'd'); // the fork south to the Bowl
      g.blob(15, 4, 2, 3, 'g', 33, (q) => q === 'b'); // a seep at the bottom of the drain, still green
    },
    height(x, z, h) {
      // the drain sinks below grade; the road crosses it at grade (a culvert under it)
      if (z > 26.6 && z < 31.4) return h;
      const k = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 - x, x - DRAIN.x1) / 1.0));
      const inner = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 + 1.2 - x, x - (DRAIN.x1 - 1.2)) / 1.2));
      return h - 0.8 * k - 0.7 * inner;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 64, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      if (glyph === 'd' && Math.abs(z - 29) < 0.07 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      const base = spanPaint(glyph, x, z, fine);
      if (glyph === 'x' || glyph === 's' || glyph === 'b') {
        const c: RGB = base ?? (glyph === 'b' ? [94, 89, 82] : [160, 138, 102]);
        return tracks(x, z, SIX, 'six', c) ?? base;
      }
      return base;
    },
    edges: { n: 'scrub', e: 'trees', w: 'none', s: 'none' },
    exits: [{ side: 'e', at: 29, w: 4, to: 'east-loop', spawn: 'west', name: 'east' }],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the drain: headwalls either side of the road, culverts black
      headwall(scene, 15, 26.6, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, -1);
      headwall(scene, 15, 31.4, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, 1);
      // the culvert mouths: dark. You'd need your own light to go in there (the door language: dark).
      d.built.push(dressDoor(scene, 15, -1.45, 26.35, 2.2, 1.3, 'dark', night, Math.PI));
      markDoor(15, 26.2, 'dark');
      d.built.push(dressDoor(scene, 15, -1.45, 31.65, 2.2, 1.3, 'dark', night, 0));
      markDoor(15, 31.8, 'dark');
      for (const [x, z, s] of [[13.2, 22.0, 0.35], [16.8, 14.0, 0.4], [14.0, 7.6, 0.3]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());

      // ------------------------------------------------ the fork: the billboard (hero) and the light (routine)
      billboard(scene, 24.6, 21.6, 0.08);
      d.built.push(trafficSignal(scene, 30.6, 26.2, 3.0, night));
      boardSign(scene, 36.4, 26.2, 'WHITE BOWL v', -0.12, 41);
      busShelter(scene, 6.2, 25.6);
      d.built.push(lanternPost(scene, 3.6, 25.2, night, night)); // the last lantern before the road goes dark
      carHulk(scene, 21.4, 30.0, 0.04, seed());
      carHulk(scene, 41.0, 28.4, 2.9, seed());
      tires(scene, 26.6, 25.4, 4);
      cairn(scene, 38.6, 13.0, seed());
      powerLine(scene, [[0.6, 26.3, 0.02], [10.8, 26.4, -0.06], [22.0, 26.3, 0.1], [36.0, 26.4, -0.15]], [[0, 1], [1, 2], [2, 3]]);

      // ------------------------------------------------ brush: thick to the east, where the road goes into it
      for (const [x, z, s] of [[40.0, 20.0, 1.2], [42.6, 16.0, 1.1], [37.4, 22.6, 1.0], [42.0, 33.0, 1.1], [5.2, 6.0, 1.0], [27.6, 2.6, 1.1], [21.0, 8.4, 1.0], [41.0, 3.4, 1.1]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      d.tree(deadTree(9.0, 18.4, 1.1, seed()), 0.2);
      for (const [x, z, s] of [[7.6, 20.6, 0.9], [25.4, 12.4, 0.8], [33.0, 19.4, 1.0], [3.2, 16.0, 0.8], [38.6, 25.0, 0.7]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[19.8, 24.0, 0.7], [10.0, 23.6, 0.8], [30.6, 8.4, 0.9], [2.4, 21.6, 0.7], [43.2, 23.8, 0.9]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      tumbleweed(scene, 28.6, 30.8, 7); tumbleweed(scene, 19.6, 12.6, 8);
      desertScatter(scene, COLS, ROWS, 80, (x, z) => ['x', 's', '#'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3));

      // ------------------------------------------------ things, people
      d.things.push(
        { x: 15, z: 25.0, r: 1.8, label: 'Culvert', lines: ['The drain goes under the road here. The pipe is black all the way in. Something in there drips.'] },
        { x: 24.6, z: 22.8, r: 2.6, label: 'Billboard', lines: ['A billboard on two legs. Paper on paper on paper, all of it peeled. Not one word left.'] },
        { x: 30.6, z: 25.4, r: 1.6, label: 'Light', lines: ['Green, then yellow, then red. Then green again.'] },
        { x: 17.6, z: 21.0, r: 1.6, label: 'Tracks', lines: ['Little tracks in the dust. Six wheels. They come up out of the drain and go east.'] },
        { x: 38.6, z: 14.2, r: 1.4, label: 'Stones', lines: ['Stones stacked waist high, bleached white. Bones between them, set with care.'] },
      );
      d.npcs.push({ id: 'memo', name: 'Memo', sprite: 'memo', x: 7.6, z: 26.0, face: 'E', lines: ['Nobody goes out the east road after Lamp. Not without a reason and a pipe.', 'Big tracks out by the lake lately. Bigger than any Stray.'] });
      void THREE;
    },
  };
}
