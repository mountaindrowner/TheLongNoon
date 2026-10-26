import { section, type Grid, type RGB } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { mesquite, deadTree, bush, powerLine, truck, crates } from '../../engine/foliage';
import { rock, stockTank, boardSign } from '../../engine/props';
import { fence } from '../../engine/fence';
import { fbm } from '../../engine/noise';
import { decal, texMat } from '../../engine/geo';
import { insideSolid } from '../../engine/world';
import { setApronTexture } from '../../engine/terrain';
import type { Mood } from '../../engine/mood';
import type { AreaBuilder } from '../../engine/area';
import { spanApron, SCRUB_DRY, STRAW, palm, nopal, waterTower, windmill, lanternPost, solarPanels, clothesline, shadeSail, jugs, drum, tires, carHulk, burialPlatform, chairsAndSpool, roofLetters, swaySpan, resetSpan, blockWall, tireEdging, mailbox, desertScatter, skull } from './props';
import { tumbleweed } from '../../engine/foliage';

/**
 * MAR FARM: the family's place, an old store at the edge of the Span with the
 * last of its name on the roof. Tier: lived_in (spec §8.3).
 *
 * - Hero: the water tower, visible from every corner of the map.
 * - Routine: the windmill pump, still lifting water into the goats' trough.
 * - Signature: the store's big letters, MAR, and the lit door under them.
 * - Seen, never said: the platform with the shroud; the green that grows only
 *   where water has spilled; power lines that carry nothing.
 *
 * Glyphs (engine/section.ts): x caliche (the base) · g green where water is ·
 * d old asphalt · e dirt lane · v gravel · s sand · c the garden's rows.
 */

const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const SAND = ['#c8b08a', '#d2ba92', '#bca47e', '#dcc6a0'].map(H);

export const COLS = 44, ROWS = 32;
/** The parking lot's painted stalls (world units). */
const LOT = { x0: 8, x1: 31, z0: 12, z1: 19 };

export function marFarm(mood: Mood): AreaBuilder {
  let grid: Grid;
  setApronTexture(spanApron());
  return section({
    id: 'mar-farm',
    title: 'Mar Farm',
    sub: 'Home',
    kind: 'home',
    cols: COLS,
    rows: ROWS,
    seed: 41,
    mood,
    ground(g: Grid) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(5, 27, 6, 4, 's', 3, (q) => q === 'x');
      g.blob(40, 4, 4, 3, 's', 4, (q) => q === 'x');
      g.rect(9, 0, 21, 5, '#'); // scrub grown up behind the store: no hidden walkway
      g.rect(LOT.x0, LOT.z0, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, 'd');
      g.line([[-1, 18.6], [LOT.x0 + 1, 17.2]], 3.6, 'd');
      g.rect(10, 11, 18, 1, 'v'); // the old sidewalk, gone to gravel
      g.line([[21, LOT.z1 - 1], [21.4, 25], [20.8, ROWS + 1]], 3, 'e');
      // green only where water has been: round the pump and trough, along the leak, the garden
      g.blob(38, 17, 5, 5, 'g', 5, (q) => q === 'x' || q === 's');
      g.blob(27.6, 26.0, 2.6, 1.8, 'g', 6, (q) => q === 'x');
      g.blob(34, 27, 6, 4, 'g', 7, (q) => q === 'x');
      g.rect(31, 25, 7, 4, 'c');
      g.blob(27.5, 11.8, 1.6, 1, 'g', 8, (q) => q === 'v' || q === 'x');
    },
    grassTint(x, z) {
      // blades in the dry edge scrub are straw; the watered places keep their green
      const c = grid.get(Math.floor(x), Math.floor(z));
      return c === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 61, 1) * 4) % 4] : undefined;
    },
    paint(glyph, x, z, fine) {
      if (glyph === '#') return SCRUB_DRY[Math.min(3, Math.floor(fbm(x * 0.7, z * 0.7, 41, 2) * 3 + fine * 1.2))]!;
      if (glyph === 's') return SAND[Math.min(3, Math.floor(fbm(x * 0.4, z * 0.4, 51, 2) * 3 + fine * 1.2))]!;
      // faded parking stalls, still there under the dust
      if (glyph === 'd' && z > LOT.z0 + 0.4 && z < LOT.z0 + 3.4 && x > LOT.x0 + 1 && x < LOT.x1 - 1 && Math.abs((x - LOT.x0) % 3) < 0.11 && fine > 0.18) return H('#b8b0a0');
      return undefined;
    },
    edges: { n: 'scrub', w: 'bluff', e: 'fence', s: 'open' },
    exits: [
      { side: 's', at: 21, to: 'long-road', spawn: 'north', name: 'south' },
      { side: 'w', at: 18.6, w: 3.4, to: 'del-mar-park', spawn: 'east', name: 'west' },
    ],
    start: { x: 21.5, z: 21, face: 'N' },
    dress(d) {
      resetSpan();
      const { scene, night } = d;
      const lit = night; // lamps burn from the Lamp hour on; by day they're out
      const seed = (): number => d.seed();

      // ------------------------------------------------ the store (signature)
      d.built.push(...building(scene, {
        x: 19, z: 8, w: 18, d: 7, h: 4.0, wall: texMat('block0', blockWall(0)), roof: 'flat', seed: 9,
        doors: [{ x: 5, state: 'open' }],
        windows: [{ x: 7.6, kind: lit ? 'lit' : 'glass' }, { x: -6.5, kind: 'boarded', w: 1.4, h: 1.0 }, { x: -3.8, kind: 'boarded', w: 1.4, h: 1.0 }],
        vines: [-8.1, 8.2, -1.9],
      }, night));
      // the shutter: down, rusted at the foot. It has no lamp; it promises nothing.
      scene.add(decal(4.4, 2.9, M.tin(), 17, 0, 11.53));
      roofLetters(scene, 'MAR', 17, 4.3, 7.4, 4.6, 1.5);
      solarPanels(scene, 23.5, 4.3, 6.3, 3, 2);
      jugs(scene, 26.9, 12.5, 6, seed());
      drum(scene, 10.6, 12.4);
      drum(scene, 11.5, 12.9, true);
      tires(scene, 8.4, 13.3, 3);
      crates(scene, 28.6, 12.4);

      // ------------------------------------------------ a shed round the side, boarded
      d.built.push(...building(scene, { x: 6.2, z: 6.6, w: 3.4, d: 2.8, h: 2.3, wall: 'grey', roof: 'shed', seed: 12, doors: [{ x: 0.3, state: 'boarded' }], vines: [-1.2] }, night));

      // ------------------------------------------------ the water tower (hero) and the windmill (routine)
      waterTower(scene, 27.6, 24.0, night);
      d.built.push(windmill(scene, 38.6, 13.6));
      stockTank(scene, 38.4, 15.9, 0.85);
      // the goat pen, its gate open on the west
      fence(scene, [[33.2, 19.6], [33.2, 15], [37, 14.8]], seed());
      fence(scene, [[40, 14.8], [42.4, 15], [42.4, 23.4], [33.2, 23.4], [33.2, 21.8]], seed());
      shadeSail(scene, 40.3, 21.2, 3.2, 2.6, 2.1);
      // the garden: the greenest thing for miles
      fence(scene, [[30.6, 24.6], [38.4, 24.6], [38.4, 29.4], [30.6, 29.4], [30.6, 27.8]], seed());
      boardSign(scene, 29.6, 25.2, 'DONT PICK', 0.2, 14);

      // ------------------------------------------------ where the family lives outside
      shadeSail(scene, 30.2, 15.4, 3.4, 2.8, 2.3, '#5a3f34');
      chairsAndSpool(scene, 30.2, 15.6, seed());
      d.built.push(clothesline(scene, 3.4, 10.6, 8.2, 11.6, seed()));
      carHulk(scene, 13.4, 16.6, 0.12, seed());
      truck(scene, 35.2, 9.4);

      // ------------------------------------------------ the platform, west, under a lantern
      burialPlatform(scene, 6.4, 25.8);
      d.built.push(lanternPost(scene, 9.0, 24.6, night, lit));

      // ------------------------------------------------ the lane home, lanterns along it
      d.built.push(lanternPost(scene, 19.1, 21.6, night, lit));
      d.built.push(lanternPost(scene, 23.0, 27.4, night, lit));
      boardSign(scene, 23.6, 30.6, 'MAR FARM ^', -0.15, 21);
      boardSign(scene, 2.6, 21.4, '< DEL MAR PARK', 0.25, 22);
      // power lines that carry nothing
      powerLine(scene, [[11.2, 12.3, 0.03], [18.0, 20.4, -0.02], [18.2, 26.4, 0.06], [18.4, 31.4, 0.1]], [[0, 1], [1, 2], [2, 3]]);

      // ------------------------------------------------ growing things, pooled at the edges (spec §8.2)
      for (const [x, z, s] of [[3.2, 6.5, 1.15], [9.6, 2.6, 1.0], [2.6, 15.4, 1.1], [42, 9.5, 1.0], [26.5, 2.4, 1.05], [12.2, 30.2, 1.1]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      d.tree(deadTree(13.2, 27.6, 1.0, seed()), 0.2);
      for (const [x, z, s] of [[7.4, 3.6, 1.0], [31.2, 3.4, 1.15], [41.2, 11.2, 0.95], [2.4, 29.4, 0.9]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());
      for (const [x, z, s] of [[3.4, 22.2, 1.0], [15.2, 24.6, 0.85], [25.6, 30.4, 1.0], [41.2, 28.2, 1.1], [36.6, 3.2, 0.9], [11.8, 21.4, 0.7], [15.8, 18.9, 0.6]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[9.4, 10.2, 0.7], [28.6, 10.6, 0.8], [33.4, 13.4, 0.8], [42.2, 25.4, 0.9], [16.4, 29.4, 0.8], [8.6, 29.8, 0.7]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      for (const [x, z, s] of [[4.2, 18.0, 0.4], [14.6, 20.8, 0.3], [24.8, 21.6, 0.35], [35.4, 30.6, 0.45], [1.8, 25.2, 0.5]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());

      // ------------------------------------------------ what you can look at (describes, never interprets: §11.3)
      d.things.push(
        { x: 24, z: 12.3, label: 'Go in', script: 'rest' },
        { x: 17, z: 12.2, label: 'Shutter', lines: ['The shutter is down. Rust has locked the bottom slats to the sill.'] },
        { x: 27.6, z: 26.2, r: 2.2, label: 'Water tower', lines: ['AGUA, painted by hand. Under it, older letters, painted by a different hand.', 'The pipe down the leg is sweating. The ground under it is green.'] },
        { x: 37.6, z: 14.4, r: 1.8, label: 'Windmill', lines: ['The wheel turns. On every upstroke the pump coughs water into the trough.'] },
        { x: 34.6, z: 26.6, r: 2.4, label: 'Garden', lines: ['Squash, beans, and something with purple flowers. Every row has been watered today.'] },
        { x: 6.4, z: 27.0, r: 2.0, label: 'Platform', lines: ['A shroud on the boards, sewn shut with white thread.'] },
        { x: 27.0, z: 13.4, r: 1.4, label: 'Water jugs', lines: ['Six jugs. Two full.'] },
      );
      d.npcs.push({ id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 8.9, z: 26.8, face: 'W', lines: ['The sun takes what it wants.', 'Light the lantern, mija. Somebody has to be the oldest tonight.'] });
      for (const [x, z] of [[35.5, 17.5], [39.5, 19.5], [36.5, 21.5], [41, 17.4]] as Array<[number, number]>) d.roamers.push({ sprite: 'goat', frames: [], x, z, area: [34, 16, 41.6, 22.6], speed: 0.6, height: 0.62 });
      for (const [x, z] of [[15.5, 13.6], [22.5, 15.5], [19, 17.5]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [12, 12.6, 27, 18.6], speed: 0.9, height: 0.34 });

      // the lane home, kerbed with whitewashed tires; a mailbox at the road
      tireEdging(scene, [[19.2, 23.4], [19.3, 24.6], [19.1, 25.8], [19.2, 28.4], [19.0, 29.6], [23.2, 23.6], [23.4, 24.8], [23.2, 26.0], [23.0, 29.2], [22.9, 30.4]], seed());
      mailbox(scene, 24.4, 31.2);
      for (const [x, z, k] of [[14.6, 30.8, 1], [36.2, 31.0, 2], [3.6, 18.6, 3]] as Array<[number, number, number]>) tumbleweed(scene, x, z, k);
      skull(scene, 4.6, 29.6, 0.6);
      desertScatter(scene, COLS, ROWS, 77, (x, z) => ['x', 's', '#'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3) && Math.abs(x - 21.2) > 2.2);

      // the yard's own routines tick with the map's
      d.built.push({ update: swaySpan });
    },
  });
}
