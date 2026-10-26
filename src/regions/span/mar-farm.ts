import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { mesquite, deadTree, bush, powerLine, truck, crates, tumbleweed } from '../../engine/foliage';
import { rock, stockTank, boardSign } from '../../engine/props';
import { fence } from '../../engine/fence';
import { fbm } from '../../engine/noise';
import { decal, texMat } from '../../engine/geo';
import { insideSolid } from '../../engine/world';
import { STRAW, palm, nopal, waterTower, windmill, lanternPost, solarPanels, clothesline, shadeSail, jugs, drum, tires, carHulk, burialPlatform, chairsAndSpool, roofLetters, blockWall, tireEdging, mailbox, desertScatter, skull } from './props';
import { spanPaint } from './kit';
import { spanDoor } from './doors';

/**
 * MAR FARM (the Span, cell 0,1). The family's place: an old store at the
 * west end of the boulevard, the last of its name on the roof. Hold, tier lived_in.
 *
 * - Hero: the water tower. Routine: the windmill pump filling the trough.
 * - Signature: the store with MAR on the roof; its door lit by an old caged bulb (they have panels).
 * - Seen, never said: the platform with the shroud; green only where water spills; lines that carry nothing.
 * - Ways out: the boulevard east to the Plaza; the track north to the Ramp.
 * - Inside: the store (mar-home).
 *
 * Glyphs: x caliche · g green · d old asphalt · e dirt · v gravel · s sand · c the garden's rows · # scrub.
 */

export const COLS = 44, ROWS = 32;
const LOT = { x0: 8, x1: 31, z0: 12, z1: 19 };

export function marFarm(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'mar-farm',
    title: 'Mar Farm',
    sub: 'Home',
    kind: 'home',
    cols: COLS,
    rows: ROWS,
    seed: 41,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(4, 21, 4, 3, 's', 3, (q) => q === 'x');
      g.blob(41, 4, 3, 3, 's', 4, (q) => q === 'x');
      g.rect(9, 0, 21, 5, '#'); // scrub grown up behind the store: no hidden walkway
      g.rect(LOT.x0, LOT.z0, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, 'd');
      g.rect(10, 11, 18, 1, 'v'); // the old sidewalk, gone to gravel
      g.line([[21, LOT.z1 - 1], [21.2, 27.5]], 3, 'e');
      g.rect(8, 27, COLS - 8, 4, 'd'); // the boulevard, east to the Plaza
      g.line([[31, 14], [36, 9], [39, 4], [39.5, -1]], 2.6, 'e', (q) => q === 'x' || q === 's'); // the track north to the Ramp
      g.blob(38, 17, 5, 4, 'g', 5, (q) => q === 'x' || q === 's');
      g.blob(27.6, 24.8, 2.6, 1.8, 'g', 6, (q) => q === 'x');
      g.blob(34.5, 24.8, 5, 3, 'g', 7, (q) => q === 'x');
      g.rect(31, 23, 7, 3, 'c');
      g.blob(27.5, 11.8, 1.6, 1, 'g', 8, (q) => q === 'v' || q === 'x');
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 61, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // faded parking stalls, still there under the dust
      if (glyph === 'd' && z > LOT.z0 + 0.4 && z < LOT.z0 + 3.4 && x > LOT.x0 + 1 && x < LOT.x1 - 1 && Math.abs((x - LOT.x0) % 3) < 0.11 && fine > 0.18) return [184, 176, 160];
      // the boulevard's faded centre line
      if (glyph === 'd' && Math.abs(z - 29) < 0.07 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'scrub', w: 'bluff', e: 'fence', s: 'scrub' },
    exits: [],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the store (signature): home, lit by an old caged bulb
      d.built.push(...building(scene, {
        x: 19, z: 8, w: 18, d: 7, h: 4.0, wall: texMat('block0', blockWall(0)), roof: 'flat', seed: 9,
        doors: [{ x: 5, ...spanDoor('bulb', night) }],
        windows: [{ x: 7.6, kind: night ? 'lit' : 'glass' }, { x: -6.5, kind: 'boarded', w: 1.4, h: 1.0 }, { x: -3.8, kind: 'boarded', w: 1.4, h: 1.0 }],
        vines: [-8.1, 8.2, -1.9],
      }, night));
      scene.add(decal(4.4, 2.9, M.tin(), 17, 0, 11.53)); // the shutter: down, no light, no promise
      roofLetters(scene, 'MAR', 17, 4.3, 7.4, 4.6, 1.5);
      solarPanels(scene, 23.5, 4.3, 6.3, 3, 2);
      jugs(scene, 26.9, 12.5, 6, seed());
      drum(scene, 10.6, 12.4);
      drum(scene, 11.5, 12.9, true);
      tires(scene, 8.4, 13.3, 3);
      crates(scene, 28.6, 12.4);
      d.spawns.home = { x: 24, z: 13.0, face: 'S' };

      d.built.push(...building(scene, { x: 6.2, z: 6.6, w: 3.4, d: 2.8, h: 2.3, wall: 'grey', roof: 'shed', seed: 12, doors: [{ x: 0.3, ...spanDoor('boarded', night) }], vines: [-1.2] }, night));

      // ------------------------------------------------ the tower (hero), the windmill (routine), the goats, the garden
      waterTower(scene, 27.6, 24.0, night);
      d.built.push(windmill(scene, 38.6, 13.6));
      stockTank(scene, 38.4, 15.9, 0.85);
      fence(scene, [[33.2, 18.2], [33.2, 15], [37, 14.8]], seed());
      fence(scene, [[40, 14.8], [42.4, 15], [42.4, 21.8], [33.2, 21.8], [33.2, 19.8]], seed());
      shadeSail(scene, 40.3, 19.6, 3.2, 2.4, 2.1);
      fence(scene, [[30.6, 22.8], [38.4, 22.8], [38.4, 26.4], [30.6, 26.4], [30.6, 25.0]], seed());
      boardSign(scene, 29.6, 23.4, 'DONT PICK', 0.2, 14);

      // ------------------------------------------------ the yard
      shadeSail(scene, 30.2, 15.4, 3.4, 2.8, 2.3, '#5a3f34');
      chairsAndSpool(scene, 30.2, 15.6, seed());
      d.built.push(clothesline(scene, 3.4, 10.6, 8.2, 11.6, seed()));
      carHulk(scene, 13.4, 16.6, 0.12, seed());
      truck(scene, 5.4, 17.2);

      // ------------------------------------------------ the platform, under a lantern
      burialPlatform(scene, 6.4, 24.4);
      d.built.push(lanternPost(scene, 9.0, 23.4, night, night));

      // ------------------------------------------------ the lane down to the boulevard
      d.built.push(lanternPost(scene, 19.1, 21.6, night, night));
      d.built.push(lanternPost(scene, 23.0, 25.6, night, night));
      tireEdging(scene, [[19.2, 23.0], [19.3, 24.2], [19.1, 25.4], [23.2, 21.0], [23.2, 22.2], [23.4, 23.4], [23.2, 24.6]], seed());
      mailbox(scene, 24.6, 26.4);
      boardSign(scene, 17.0, 26.4, 'MAR FARM', 0.12, 21);
      boardSign(scene, 41.6, 26.4, 'PLAZA >', -0.1, 22);
      powerLine(scene, [[11.2, 12.3, 0.03], [18.0, 20.4, -0.02], [18.2, 26.2, 0.06], [32.0, 26.4, -0.05], [43.4, 26.3, 0.04]], [[0, 1], [1, 2], [2, 3], [3, 4]]);
      for (const [x, z, s] of [[7.4, 28.0, 0.5], [7.8, 30.0, 0.45], [6.6, 29.0, 0.35]] as Array<[number, number, number]>) rock(scene, x, z, s, seed()); // where the boulevard gives out

      // ------------------------------------------------ growing things, pooled at the edges (spec §8.2)
      for (const [x, z, s] of [[3.2, 6.5, 1.15], [9.6, 2.6, 1.0], [2.0, 19.6, 1.1], [42, 9.5, 1.0], [26.5, 2.4, 1.05], [12.2, 25.0, 1.1]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      d.tree(deadTree(14.2, 23.6, 1.0, seed()), 0.2);
      for (const [x, z, s] of [[7.4, 3.6, 1.0], [31.2, 3.4, 1.15], [41.2, 11.2, 0.95], [2.4, 26.4, 0.9]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());
      for (const [x, z, s] of [[3.4, 22.2, 1.0], [15.6, 21.4, 0.85], [41.4, 24.6, 1.1], [36.6, 3.2, 0.9], [11.8, 21.4, 0.7], [15.8, 18.9, 0.6]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[9.4, 10.2, 0.7], [28.6, 10.6, 0.8], [33.4, 13.4, 0.8], [42.2, 18.4, 0.9], [26.0, 21.0, 0.8]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      for (const [x, z, s] of [[4.2, 15.0, 0.4], [14.6, 20.8, 0.3], [24.8, 20.6, 0.35], [1.8, 23.2, 0.5]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      for (const [x, z, k] of [[14.6, 30.4, 1], [36.2, 31.2, 2], [3.6, 18.6, 3]] as Array<[number, number, number]>) tumbleweed(scene, x, z, k);
      skull(scene, 4.6, 29.6, 0.6);
      desertScatter(scene, COLS, ROWS, 77, (x, z) => ['x', 's', '#'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3));

      // ------------------------------------------------ what you can look at (describes, never interprets: §11.3)
      d.things.push(
        { x: 24, z: 12.3, label: 'Go in', go: { to: 'mar-home', spawn: 'door' } },
        { x: 17, z: 12.2, label: 'Shutter', lines: ['The shutter is down. Rust has locked the bottom slats to the sill.'] },
        { x: 27.6, z: 26.2, r: 2.2, label: 'Water tower', lines: ['AGUA, painted by hand. Under it, older letters, painted by a different hand.', 'The pipe down the leg is sweating. The ground under it is green.'] },
        { x: 37.6, z: 14.4, r: 1.8, label: 'Windmill', lines: ['The wheel turns. On every upstroke the pump coughs water into the trough.'] },
        { x: 34.6, z: 24.6, r: 2.4, label: 'Garden', lines: ['Squash, beans, and something with purple flowers. Every row has been watered today.'] },
        { x: 6.4, z: 25.6, r: 2.0, label: 'Platform', lines: ['A shroud on the boards, sewn shut with white thread.'] },
        { x: 27.0, z: 13.4, r: 1.4, label: 'Water jugs', lines: ['Six jugs. Two full.'] },
      );
      d.npcs.push({ id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 8.9, z: 25.4, face: 'W', lines: ['Keep the lantern lit, mija. Somebody always has to.'] });
      for (const [x, z] of [[35.5, 17.5], [39.5, 19.5], [36.5, 20.5], [41, 17.4]] as Array<[number, number]>) d.roamers.push({ sprite: 'goat', frames: [], x, z, area: [34, 16, 41.6, 21.2], speed: 0.6, height: 0.62 });
      for (const [x, z] of [[15.5, 13.6], [22.5, 15.5], [19, 17.5]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [12, 12.6, 27, 18.6], speed: 0.9, height: 0.34 });
    },
  };
}
