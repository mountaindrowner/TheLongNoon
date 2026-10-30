import type { Grid, RGB, SectionSpec } from '../../engine/section';
import { powerLine } from '../../engine/foliage';
import { boardSign } from '../../engine/props';
import { fbm } from '../../engine/noise';
import { dressDoor, markDoor } from '../../engine/doorway';
import { STRAW, nopal, carHulk, tires, lanternPost, skull, drum } from './props';
import { spanPaint, tracks, billboard, trafficSignal, busShelter, cairn, headwall, jerseys, exitVeil } from './kit';
import { SPAN_FLORA, mesquite, deadMesquite } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { salvageFence, rubble, ruinWall } from './ruins';

/**
 * THE LAKE ROAD (the Span; large and portrait, 96×132). The long way from
 * the east end of town down to the dry lake. Del Mar comes in from the
 * barricade at the edge of Seven Flags and runs on east into brush nobody takes after Lamp; at the fork,
 * the lake road turns south and goes on and on, the drain running beside it.
 * Road leg, tier ruined.
 *
 * - Hero: the billboard at the fork, peeled down to nothing.
 * - Routine: the traffic light over the fork, cycling for nobody.
 * - Signature: the drain: a concrete channel crossing under the boulevard, its culvert mouths black,
 *   running south beside the road all the way to the lake.
 * - Seen, never said: small tracks, six wheels, coming up out of the drain and heading east (Memo's "little tracks").
 * - Side pocket: the salvage yard, where the town's fences come from: cars stacked on cars.
 * - Ways out: west into Seven Flags (past Memo's barricade on Del Mar); east on the boulevard (not built); south to the White Bowl, by the
 *   road or down the drain.
 * - The culverts are dark: a way in that needs a light you don't have yet (the drains, a dungeon to come).
 */

export const COLS = 96, ROWS = 132;
const BLVD = { z0: 57, z1: 63 };
const DRAIN = { x0: 66, x1: 72 };
const ROAD: Array<[number, number]> = [[40, BLVD.z1], [42, 84], [38, 104], [44, ROWS + 1]];
const SIX: Array<[number, number]> = [[69, 70], [72, 64.6], [76, 54], [84, 46], [90, 40], [97, 36]];
const YARD = { x0: 6, x1: 30, z0: 74, z1: 100 };

export function lakeRoad(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'lake-road',
    title: 'The Lake Road',
    sub: 'The Span',
    kind: 'road',
    cols: COLS,
    rows: ROWS,
    seed: 74,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(54, 30, 7, 5, 's', 31, (q) => q === 'x');
      g.blob(20, 118, 6, 4, 's', 32, (q) => q === 'x');
      // brush: the land between the roads is thorn, end to end
      motte(g, 22, 22, 18, 14, 71); motte(g, 84, 18, 9, 10, 72); motte(g, 86, 90, 8, 16, 73); motte(g, 20, 116, 12, 10, 74);
      motte(g, 56, 116, 6, 9, 75); motte(g, 54, 82, 6, 8, 76); motte(g, 86, 124, 8, 6, 77); motte(g, 10, 50, 6, 4, 78);
      g.rect(DRAIN.x0, 0, DRAIN.x1 - DRAIN.x0, ROWS, 'b'); // the drain: a concrete channel, north to south
      g.rect(0, BLVD.z0, COLS, BLVD.z1 - BLVD.z0, 'd'); // the boulevard, going on east
      g.line(ROAD, 5, 'd'); // the lake road
      g.rect(YARD.x0, YARD.z0, YARD.x1 - YARD.x0, YARD.z1 - YARD.z0, 'v'); // the salvage yard's floor
      g.line([[30, 86], [39.6, 86]], 3, 'e');
      g.blob(69, 8, 2, 3, 'g', 33, (q) => q === 'b'); // a seep at the bottom of the drain, still green
    },
    height(x, z, h) {
      // the drain sinks below grade; the boulevard crosses it at grade (a culvert under it)
      if (z > BLVD.z0 - 0.4 && z < BLVD.z1 + 0.4) return h;
      const k = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 - x, x - DRAIN.x1) / 1.0));
      const inner = 1 - Math.min(1, Math.max(0, Math.max(DRAIN.x0 + 1.2 - x, x - (DRAIN.x1 - 1.2)) / 1.2));
      return h - 0.8 * k - 0.7 * inner;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 64, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      if (glyph === 'd' && Math.abs(z - 60) < 0.08 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      const base = spanPaint(glyph, x, z, fine);
      if (glyph === 'x' || glyph === 's' || glyph === 'b') {
        const c: RGB = base ?? (glyph === 'b' ? [94, 89, 82] : [160, 138, 102]);
        return tracks(x, z, SIX, 'six', c) ?? base;
      }
      return base;
    },
    edges: { n: 'brush', e: 'brush', w: 'brush', s: 'brush' },
    exits: [
      { side: 'w', at: 60, w: 9, to: 'seven-flags', spawn: 'east', name: 'town' },
      { side: 'e', at: 60, w: 6, to: 'east-loop', spawn: 'west', name: 'east' },
      { side: 's', at: 44, w: 8, to: 'white-bowl', spawn: 'road', name: 'lake' },
      { side: 's', at: 69, w: 6, to: 'white-bowl', spawn: 'drain', name: 'drain' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the drain: headwalls either side of the boulevard, culverts black
      headwall(scene, 69, BLVD.z0 - 0.4, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, -1);
      headwall(scene, 69, BLVD.z1 + 0.4, DRAIN.x1 - DRAIN.x0 + 0.6, 1.5, 1);
      d.built.push(dressDoor(scene, 69, -1.45, BLVD.z0 - 0.65, 2.2, 1.3, 'dark', night, Math.PI));
      markDoor(69, BLVD.z0 - 0.8, 'dark');
      d.built.push(dressDoor(scene, 69, -1.45, BLVD.z1 + 0.65, 2.2, 1.3, 'dark', night, 0));
      markDoor(69, BLVD.z1 + 0.8, 'dark');

      // ------------------------------------------------ the fork: the billboard (hero) and the light (routine)
      billboard(scene, 52, 48, 0.08);
      d.built.push(trafficSignal(scene, 46, BLVD.z0 - 0.8, 3.0, night));
      boardSign(scene, 33, 65.4, 'WHITE BOWL v', -0.12, 41);
      boardSign(scene, 60, 55.4, 'EAST RD >', 0.1, 42);
      busShelter(scene, 24, 55.2);
      d.built.push(lanternPost(scene, 34, 64.6, night, night)); // the last lantern before the road goes dark
      carHulk(scene, 14, 61, 0.04, seed()); carHulk(scene, 84, 58.4, 2.9, seed());
      tires(scene, 50, 54.4, 4);
      cairn(scene, 84, 34, seed());
      powerLine(scene, [[0.6, 55.4, 0.02], [20, 55.6, -0.06], [40, 55.4, 0.1], [60, 55.6, -0.15], [92, 55.4, 0.05]], [[0, 1], [1, 2], [2, 3], [3, 4]]);

      // ------------------------------------------------ down the lake road: poles with no wires, a wreck, the old motor court
      powerLine(scene, [[46.4, 72, 0.1], [47, 92, -0.08], [43.4, 112, 0.12]], [[0, 1]]);
      carHulk(scene, 37, 96, 1.7, seed());
      skull(scene, 48, 100, 2.2);
      ruinWall(scene, 82, 104, 8, 2.6, 0, seed()); ruinWall(scene, 78, 110, 6, 2.2, Math.PI / 2, seed());
      rubble(scene, 86, 110, 1.4, seed());

      // ------------------------------------------------ the salvage yard (side pocket): where the town's fences come from
      salvageFence(scene, [[YARD.x0, YARD.z0], [YARD.x1, YARD.z0], [YARD.x1, 84.6]], seed());
      salvageFence(scene, [[YARD.x1, 87.4], [YARD.x1, YARD.z1], [YARD.x0, YARD.z1], [YARD.x0, YARD.z0]], seed());
      for (let i = 0; i < 9; i++) {
        const x = YARD.x0 + 3 + (i % 3) * 7.4, z = YARD.z0 + 4 + Math.floor(i / 3) * 7.6;
        carHulk(scene, x, z, (i * 1.3) % 3.1, seed());
        if (i % 2 === 0) { const top = seed(); carHulk(scene, x + 0.3, z - 0.2, (i * 0.7) % 3.1, top); }
      }
      tires(scene, 26, 96, 6); drum(scene, 10, 97); drum(scene, 11, 97.6, true);

      // ------------------------------------------------ brush
      // back west to town: the boulevard fades out past the edge (the hub, its own place)
      exitVeil(scene, 0, 60, 9, 'w', night);
      // down to the White Bowl, its own place: the road, and the drain beside it
      exitVeil(scene, 44, ROWS, 8, 's', night);
      exitVeil(scene, 69, ROWS, 6, 's', night, '#8a8a84');
      brushFill(d, 74, 1);
      for (const [x, z, s] of [[56, 70, 1.1], [30, 108, 1.0], [52, 92, 1.0]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.3);
      d.tree(deadMesquite(46, 40, 1.1, seed()), 0.2);
      for (const [x, z, s] of [[34, 70, 0.9], [50, 110, 0.8], [58, 64, 1.0], [30, 48, 0.8]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      openScatter(d, 80, ['x', 's'], 0.7, (x, z) => clearOf(ROAD, 4)(x, z) && !(z > BLVD.z0 - 3 && z < BLVD.z1 + 3) && !(x > YARD.x0 - 1 && x < YARD.x1 + 1 && z > YARD.z0 - 1 && z < YARD.z1 + 1));

      // ------------------------------------------------ things, people
      // ------------------------------------------------ the boulevard east, closed: barriers and two cars nose to nose
      jerseys(scene, [[90.6, BLVD.z0 - 2.2], [90.6, BLVD.z1 + 2.2]], seed());
      carHulk(scene, 93.2, BLVD.z0 + 1.6, 1.62, seed()); carHulk(scene, 93.6, BLVD.z1 - 1.5, 1.5, seed());
      d.things.push(
        { x: 89.4, z: (BLVD.z0 + BLVD.z1) / 2, r: 2.4, label: 'Barrier', lines: ['Concrete barriers across the boulevard, two cars pushed up nose to nose behind them. Past them, the road runs on east into the brush.'] },
        { x: 69, z: BLVD.z0 - 2.0, r: 2.0, label: 'Culvert', lines: ['The drain goes under the road here. The pipe is black all the way in. Something in there drips.'] },
        { x: 52, z: 49.4, r: 2.8, label: 'Billboard', lines: ['A billboard on two legs. Paper on paper on paper, all of it peeled. Not one word left.'] },
        { x: 46, z: 55.6, r: 1.8, label: 'Light', lines: ['Green, then yellow, then red. Then green again.'] },
        { x: 74, z: 56, r: 1.8, label: 'Tracks', lines: ['Little tracks in the dust. Six wheels. They come up out of the drain and go east.'] },
        { x: 84, z: 35.2, r: 1.4, label: 'Stones', lines: ['Stones stacked waist high, bleached white. Bones between them, set with care.'] },
        { x: 30.6, z: 86, r: 2.2, label: 'Yard', lines: ['Cars stacked on cars, every door gone, every hood gone. The fences in town came from here.'] },
      );
      // night three: Güero, out in the white after the machines, crouched in the culvert's shade
      d.npcs.push({ id: 'guero', name: 'Güero', sprite: 'guero', x: 66.4, z: BLVD.z0 - 2.4, face: 'W', allDay: true, when: 'n3_search', lines: ['They went this way. All of them.'] });
      d.npcs.push({ id: 'memo', name: 'Memo', sprite: 'memo', x: 27, z: 56.4, face: 'E', lines: ['Nobody goes out the east road after Lamp. Not without a reason and a pipe.', 'Big tracks out by the lake lately. Bigger than any Stray.'] });
    },
  };
}
