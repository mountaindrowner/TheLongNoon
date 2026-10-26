import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { powerLine, truck, crates } from '../../engine/foliage';
import { rock, stockTank, boardSign } from '../../engine/props';
import { fence } from '../../engine/fence';
import { fbm } from '../../engine/noise';
import { decal, texMat } from '../../engine/geo';
import { STRAW, palm, nopal, waterTower, windmill, lanternPost, solarPanels, clothesline, shadeSail, jugs, drum, tires, carHulk, burialPlatform, chairsAndSpool, roofLetters, blockWall, tireEdging, mailbox, skull } from './props';
import { spanPaint } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA, mesquite } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { house, containerHome, salvageFence, yardTank, fireRing } from './ruins';

/**
 * MAR FARM (the Span; large, 132×96). The family's place: an old store at the
 * west end of the boulevard, the last of its name on the roof, and what they've
 * made around it. Hold, tier lived_in.
 *
 * - Hero: the water tower. Routine: the windmill pump filling the trough.
 * - Signature: the store with MAR on the roof; its door lit by an old caged bulb (they have panels).
 * - Seen, never said: the platform with the shroud; green only where water spills; lines that carry nothing;
 *   the fields gone back to brush.
 * - Around it: the goat pen and the garden behind it, the family yard, three neighbours' patched houses
 *   south of the boulevard, the old fields, a dry wash across the north.
 * - Ways out: the boulevard east to the Plaza; the track north over the wash to the Ramp.
 * - Inside: the store (mar-home).
 *
 * Glyphs: x caliche · g green · d old asphalt · e dirt · v gravel · s sand · c the garden's rows · # brush.
 */

export const COLS = 132, ROWS = 96;
const BLVD = { z0: 57, z1: 63, x0: 44 };
const LOT = { x0: 18, x1: 50, z0: 46, z1: 57 };
const WASH: Array<[number, number]> = [[-1, 12], [20, 16], [44, 10], [70, 14], [96, 8], [133, 12]];
const TRACK: Array<[number, number]> = [[58, 34], [62, 24], [66, 12], [66, -1]];
const LANE: Array<[number, number]> = [[22, 50], [14, 47], [10, 42]];
const FIELD = { x0: 6, x1: 50, z0: 66, z1: 90 };

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
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.blob(10, 30, 6, 4, 's', 3, (q) => q === 'x');
      g.blob(96, 40, 5, 4, 's', 4, (q) => q === 'x');
      g.line(WASH, 3.4, 's'); // the dry wash
      // brush: mottes wherever nobody's kept it back
      motte(g, 112, 30, 14, 11, 11); motte(g, 22, 5, 11, 4, 12); motte(g, 96, 22, 7, 5, 13); motte(g, 122, 84, 9, 8, 14);
      motte(g, 40, 91, 12, 4, 15); motte(g, 4, 62, 4, 9, 16); motte(g, 126, 52, 5, 3, 17); motte(g, 46, 24, 4, 3, 18);
      motte(g, 64, 88, 6, 4, 19); motte(g, 106, 90, 8, 4, 20);
      // the boulevard, the lot, the old sidewalk
      g.rect(BLVD.x0, BLVD.z0, COLS - BLVD.x0, BLVD.z1 - BLVD.z0, 'd');
      g.rect(BLVD.x0, BLVD.z0 - 1, COLS - BLVD.x0, 1, 'v');
      g.rect(BLVD.x0 + 6, BLVD.z1, COLS - BLVD.x0 - 6, 1, 'v');
      g.rect(LOT.x0, LOT.z0, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, 'd');
      g.rect(22, 43, 24, 2, 'v');
      g.line(LANE, 2.6, 'e', (q) => q !== 'd');
      g.line(TRACK, 3, 'e', (q) => q !== 'd');
      g.line([[84, BLVD.z1], [84, 88]], 2.6, 'e'); // the neighbours' lane
      g.line([[48, 34], [58, 34]], 2.6, 'e');
      // where the water goes, green follows
      g.blob(56, 39, 3, 2.4, 'g', 5, (q) => q === 'x' || q === 's');
      g.line([[72, 33], [76, 40]], 1.6, 'g', (q) => q === 'x');
      g.blob(79, 45, 8, 5, 'g', 7, (q) => q === 'x');
      g.rect(72, 41, 14, 7, 'c');
      g.blob(72, 30, 3, 2, 'g', 8, (q) => q === 'x');
    },
    height(x, z, h) {
      // the wash runs lower than the land
      let best = 99;
      for (let i = 0; i < WASH.length - 1; i++) {
        const [ax, az] = WASH[i]!, [bx, bz] = WASH[i + 1]!;
        const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
      }
      return best < 3.2 ? h - 0.7 * (1 - best / 3.2) ** 1.5 : h;
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 61, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // faded parking stalls, still there under the dust
      if (glyph === 'd' && z > LOT.z0 + 0.4 && z < LOT.z0 + 3.6 && x > LOT.x0 + 1 && x < LOT.x1 - 1 && Math.abs((x - LOT.x0) % 3) < 0.11 && fine > 0.18) return [184, 176, 160];
      // the boulevard's faded centre line
      if (glyph === 'd' && x > BLVD.x0 && Math.abs(z - 60) < 0.08 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      // the old fields: rows gone to stubble, still there under the dust
      if (glyph === 'x' && x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1 && ((z % 1.4) + 1.4) % 1.4 < 0.28) return fine > 0.5 ? [122, 104, 74] : [136, 116, 84];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', w: 'brush', e: 'brush', s: 'brush' },
    exits: [
      { side: 'e', at: 60, w: 10, to: 'plaza', spawn: 'farm', name: 'plaza' },
      { side: 'n', at: 66, w: 5, to: 'ramp', spawn: 'farm', name: 'ramp' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the store (signature): home, lit by an old caged bulb
      d.built.push(...building(scene, {
        x: 34, z: 38, w: 22, d: 9, h: 4.2, wall: texMat('block0', blockWall(0)), roof: 'flat', seed: 9,
        doors: [{ x: 6, ...spanDoor('bulb', night) }],
        windows: [{ x: 9, kind: night ? 'lit' : 'glass' }, { x: -8, kind: 'boarded', w: 1.4, h: 1.0 }, { x: -5, kind: 'boarded', w: 1.4, h: 1.0 }],
        vines: [-10.1],
      }, night));
      scene.add(decal(4.4, 2.9, M.tin(), 32, 0, 42.53)); // the shutter: down, no light, no promise
      roofLetters(scene, 'MAR', 31, 4.5, 37.2, 4.6, 1.5);
      solarPanels(scene, 40.5, 4.5, 36.3, 4, 2);
      jugs(scene, 43.6, 43.9, 6, seed());
      drum(scene, 24.6, 43.9); drum(scene, 25.5, 44.4, true);
      tires(scene, 21, 44.6, 3);
      crates(scene, 46.4, 43.8);
      d.spawns.home = { x: 40, z: 44.4, face: 'S' };
      d.built.push(...building(scene, { x: 14, z: 26, w: 4.4, d: 3.4, h: 2.4, wall: 'grey', roof: 'shed', seed: 12, doors: [{ x: 0.3, ...spanDoor('boarded', night) }] }, night));

      // ------------------------------------------------ the tower (hero), the windmill (routine), the goats, the garden
      waterTower(scene, 56, 36, night);
      d.built.push(windmill(scene, 72.6, 29.6));
      stockTank(scene, 72.4, 31.9, 0.95);
      fence(scene, [[66, 38], [66, 22], [86, 22], [86, 38], [76, 38]], seed());
      fence(scene, [[74, 38], [66.2, 38]], seed());
      shadeSail(scene, 82, 27, 4.4, 3.2, 2.2);
      fence(scene, [[70.6, 40.6], [87.4, 40.6], [87.4, 48.6], [70.6, 48.6], [70.6, 44.0]], seed());
      boardSign(scene, 70.2, 41.4, 'DONT PICK', 0.2, 14);
      yardTank(scene, 89, 44, seed());

      // ------------------------------------------------ the yard behind the store
      salvageFence(scene, [[16, 20], [36, 19.6], [52, 20.4]], seed());
      shadeSail(scene, 42, 29, 4.4, 3.2, 2.3, '#5a3f34');
      chairsAndSpool(scene, 42, 29.2, seed());
      fireRing(scene, 34, 29);
      d.built.push(clothesline(scene, 20, 27.6, 27, 28.8, seed()));
      d.built.push(clothesline(scene, 21, 31.2, 28, 31.8, seed()));
      carHulk(scene, 28, 34.4, 0.12, seed());
      truck(scene, 48.6, 26);
      yardTank(scene, 47.6, 32.6, seed());

      // ------------------------------------------------ the platform, at the end of the lane, under a lantern
      burialPlatform(scene, 8, 38.4);
      d.built.push(lanternPost(scene, 11.6, 37.6, night, night));
      d.built.push(lanternPost(scene, 17.6, 49.8, night, night));
      tireEdging(scene, [[19, 48.2], [16.4, 46.8], [13.8, 45.4], [12.4, 43.6], [21, 51.8], [17.6, 50.6], [15, 49.4]], seed());

      // ------------------------------------------------ the lot and the boulevard
      d.built.push(lanternPost(scene, 30, 55.8, night, night));
      d.built.push(lanternPost(scene, 46, 55.8, night, night));
      mailbox(scene, 51.6, 55.6);
      boardSign(scene, 36, 55.6, 'MAR FARM', 0.12, 21);
      boardSign(scene, 126, 55.6, 'PLAZA >', -0.1, 22);
      powerLine(scene, [[24, 44.6, 0.03], [52, 55.4, -0.02], [76, 55.6, 0.06], [100, 55.4, -0.05], [124, 55.6, 0.04]], [[0, 1], [1, 2], [2, 3], [3, 4]]);
      carHulk(scene, 94, 59, 3.0, seed()); carHulk(scene, 120, 61.4, 0.1, seed());
      for (const [x, z, s] of [[44.6, 59, 0.5], [45, 61.4, 0.45], [43.4, 60.4, 0.35]] as Array<[number, number, number]>) rock(scene, x, z, s, seed()); // where the boulevard gives out
      for (const [x, z, s] of [[26, 41.4, 1.0], [50.4, 41.6, 1.1], [16.6, 41.8, 0.95]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());

      // ------------------------------------------------ the neighbours, south of the boulevard
      d.built.push(...house(scene, { x: 64, z: 72, w: 6.6, d: 5, h: 2.7, base: 'block', door: { x: 1.2, kind: 'shut' }, windows: [{ x: -1.6, kind: 'boarded' }], porch: true, seed: 401 }, night));
      salvageFence(scene, [[58, 66.4], [58, 79], [72, 79], [72, 76]], seed());
      yardTank(scene, 70.4, 68, seed()); fireRing(scene, 61.4, 77.4);
      d.built.push(clothesline(scene, 60, 67.4, 66, 68, seed()));
      d.built.push(...containerHome(scene, 92, 72, 0, 'shut', night, 402));
      salvageFence(scene, [[87.6, 66.4], [87.6, 78.6], [98, 78.6]], seed());
      d.built.push(...house(scene, { x: 108, z: 74, w: 7.4, d: 5.4, h: 2.8, base: 'stucco', door: { x: -1.4, kind: 'shut' }, windows: [{ x: 1.8, kind: 'glass' }], tarp: true, seed: 403 }, night));
      salvageFence(scene, [[102, 66.4], [102, 80], [116, 80], [116, 66.4]], seed());
      yardTank(scene, 113.6, 69, seed());

      // ------------------------------------------------ brush, the old fields, the open ground
      brushFill(d, 41, 1);
      for (const [x, z, s] of [[30, 76, 1.1], [18, 84, 1.0], [42, 70, 0.9]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.3); // brush coming back into the fields
      for (const [x, z, s] of [[11, 33, 1.0], [52, 48.6, 0.9], [92, 34, 1.1], [120, 66, 1.0], [8, 52, 0.8]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      skull(scene, 10, 58, 0.6);
      openScatter(d, 77, ['x', 's'], 0.8, (x, z) =>
        clearOf(TRACK, 3)(x, z) && clearOf(LANE, 2.6)(x, z) && clearOf([[84, BLVD.z1], [84, 88]], 2.6)(x, z) && !(x > 14 && x < 92 && z > 18 && z < 56) && !(z > BLVD.z0 - 2 && z < BLVD.z1 + 2) && !(x > 56 && x < 118 && z > 64 && z < 82));

      // ------------------------------------------------ what you can look at (describes, never interprets: §11.3)
      d.things.push(
        { x: 40, z: 43.3, label: 'Go in', go: { to: 'mar-home', spawn: 'door' } },
        { x: 32, z: 43.2, label: 'Shutter', lines: ['The shutter is down. Rust has locked the bottom slats to the sill.'] },
        { x: 56, z: 38.4, r: 2.4, label: 'Water tower', lines: ['AGUA, painted by hand. Under it, older letters, painted by a different hand.', 'The pipe down the leg is sweating. The ground under it is green.'] },
        { x: 71.6, z: 30.4, r: 2.0, label: 'Windmill', lines: ['The wheel turns. On every upstroke the pump coughs water into the trough.'] },
        { x: 79, z: 49.4, r: 2.6, label: 'Garden', lines: ['Squash, beans, and something with purple flowers. Every row has been watered today.'] },
        { x: 8, z: 39.6, r: 2.2, label: 'Platform', lines: ['A shroud on the boards, sewn shut with white thread.'] },
        { x: 43.6, z: 44.8, r: 1.4, label: 'Water jugs', lines: ['Six jugs. Two full.'] },
        { x: 30, z: 14.4, r: 2.4, label: 'Wash', lines: ['A dry wash. The sand in the bottom is finer than anywhere else, and full of tracks.'] },
        { x: 65.2, z: 75.4, r: 1.4, label: 'Door', lines: ['Shut. A pair of boots by the step.'] },
      );
      d.npcs.push({ id: 'lupe', name: 'Hermana Lupe', sprite: 'lupe', x: 11, z: 39.4, face: 'W', lines: ['Keep the lantern lit, mija. Somebody always has to.'] });
      for (const [x, z] of [[70, 26], [78, 30], [74, 34], [82, 25], [80, 35]] as Array<[number, number]>) d.roamers.push({ sprite: 'goat', frames: [], x, z, area: [67, 23, 85, 37], speed: 0.6, height: 0.62 });
      for (const [x, z] of [[30, 30], [38, 33], [24, 32], [44, 34]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [18, 22, 52, 36], speed: 0.9, height: 0.34 });
      for (const [x, z] of [[64, 76], [68, 70]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [59, 67, 71, 78], speed: 0.9, height: 0.34 });
    },
  };
}
