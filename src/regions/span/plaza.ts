import type { Grid, SectionSpec } from '../../engine/section';
import { building } from '../../engine/buildings';
import { mesquite, deadTree, bush, powerLine, crates, tumbleweed } from '../../engine/foliage';
import { rock, boardSign } from '../../engine/props';
import { fbm } from '../../engine/noise';
import { texMat } from '../../engine/geo';
import { insideSolid } from '../../engine/world';
import { STRAW, palm, nopal, lanternPost, shadeSail, jugs, drum, clothesline, desertScatter, blockWall, carHulk } from './props';
import { spanPaint, stall, stringLights, sevenFlags, well, lawnkeeper, bench, belfry } from './kit';
import { spanDoor } from './doors';

/**
 * THE PLAZA (the Span, cell 1,1). The town body: the old park square on the
 * boulevard, the night market under strung bulbs, the chapel, the houses
 * round it. Hold, tier cluttered (the market) going lived_in at the edges.
 *
 * - Hero: the seven flags, the tallest things in town.
 * - Routine: the Lawnkeeper, mowing the dust of a square it remembers.
 * - Signature: the market under the strung bulbs, every stall a different cloth.
 * - Ways out: the boulevard west to Mar Farm and east to the east road.
 * - Inside (lit): the Chapel (lantern), Doña Fina's (light under the door),
 *   Tavo and Nina's (lit window). Not inside: a house shut for the night, a house boarded.
 */

export const COLS = 44, ROWS = 32;
const SQ = { x0: 9, z0: 9, x1: 33, z1: 25 };

export function plaza(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'plaza',
    title: 'The Plaza',
    sub: 'The Span',
    kind: 'town',
    cols: COLS,
    rows: ROWS,
    seed: 52,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      g.rect(0, 27, COLS, 4, 'd'); // the boulevard
      g.rect(SQ.x0, SQ.z0, SQ.x1 - SQ.x0, SQ.z1 - SQ.z0, 'e'); // the square: a park once, packed dirt now
      g.rect(SQ.x0 - 1, SQ.z0 - 1, SQ.x1 - SQ.x0 + 2, 1, 'v');
      g.rect(SQ.x0 - 1, SQ.z1, SQ.x1 - SQ.x0 + 2, 2, 'v');
      g.rect(SQ.x0 - 1, SQ.z0, 1, SQ.z1 - SQ.z0, 'v');
      g.rect(SQ.x1, SQ.z0, 1, SQ.z1 - SQ.z0, 'v');
      g.blob(21, 22.4, 2.6, 1.6, 'g', 11, (q) => q === 'e'); // the well spills
      g.blob(14, 11.5, 3.2, 2, 'g', 12, (q) => q === 'e'); // the Lawnkeeper's patch, mown to stubble
      g.rect(2, 9, 10, 2, 'b'); // the chapel's yard
      g.line([[7, 10], [7, SQ.z1 + 1]], 2.2, 'e', (q) => q === 'x');
      g.line([[31.5, 9.5], [31.5, SQ.z0 - 1]], 1.8, 'e');
      g.line([[38.5, 16.5], [36, 26.8]], 1.8, 'e', (q) => q === 'x');
      g.blob(41, 22, 3, 2, 's', 13, (q) => q === 'x');
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 62, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      if (glyph === 'd' && Math.abs(z - 29) < 0.07 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'trees', s: 'scrub', w: 'none', e: 'none' },
    exits: [],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the chapel: lantern at the door, the bell in its tower
      d.built.push(...building(scene, { x: 6.5, z: 5.0, w: 7.0, d: 6.0, h: 3.6, wall: 'white', roof: 'gable', seed: 21, doors: [{ x: 0, w: 1.5, h: 2.3, ...spanDoor('lantern', night) }], windows: [{ x: -2.4, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.1 }, { x: 2.4, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.1 }], vines: [-3.2, 3.1] }, night));
      d.built.push(belfry(scene, 10.9, 4.0, 5.2));
      d.spawns.chapel = { x: 6.5, z: 8.9, face: 'S' };

      // ------------------------------------------------ the houses round the square
      d.built.push(...building(scene, { x: 31.5, z: 6.4, w: 6.0, d: 5.0, h: 2.8, wall: texMat('block1', blockWall(1)), roof: 'flat', seed: 22, doors: [{ x: 0, ...spanDoor('under', night) }], windows: [{ x: -2.0, kind: 'boarded', w: 0.8, h: 0.8 }], vines: [2.4] }, night));
      d.spawns.fina = { x: 31.5, z: 9.8, face: 'S' };
      d.built.push(...building(scene, { x: 38.5, z: 13.6, w: 6.0, d: 5.0, h: 2.7, wall: 'tin', roof: 'shed', seed: 23, doors: [{ x: -1.2, ...spanDoor('window', night) }], vines: [2.6] }, night));
      d.spawns.kids = { x: 37.3, z: 16.9, face: 'S' };
      d.built.push(...building(scene, { x: 39.0, z: 4.6, w: 5.0, d: 4.4, h: 2.6, wall: 'white', roof: 'gable', seed: 24, doors: [{ x: 0.6, ...spanDoor('shut', night) }], windows: [{ x: -1.4, kind: 'glass', w: 0.7, h: 0.7 }] }, night));
      d.built.push(...building(scene, { x: 4.4, z: 18.6, w: 5.4, d: 4.4, h: 2.6, wall: texMat('block2', blockWall(2)), roof: 'flat', seed: 25, doors: [{ x: 0.8, ...spanDoor('boarded', night) }], windows: [{ x: -1.4, kind: 'boarded', w: 0.8, h: 0.8 }], vines: [-2.2, 1.9] }, night));
      d.built.push(clothesline(scene, 34.2, 9.6, 36.6, 10.6, seed()));
      jugs(scene, 34.0, 8.8, 9, seed()); // Doña Fina's stock, out front

      // ------------------------------------------------ the seven flags (hero) and the Lawnkeeper (routine)
      d.built.push(sevenFlags(scene, 21, 10.2));
      d.built.push(lawnkeeper(scene, [[11.2, 10.6], [17.2, 10.6], [17.2, 12.6], [11.2, 12.6], [11.2, 10.6]]));

      // ------------------------------------------------ the night market (signature)
      const CLOTH = ['#a8402e', '#3f6a8a', '#d8b23a', '#6a8a4a', '#8a3a4a', '#c86a3a'];
      const stalls: Array<[number, number]> = [[12.4, 17.2], [16.2, 17.2], [26.0, 17.2], [29.8, 17.2], [12.4, 21.6], [29.8, 21.6]];
      stalls.forEach(([x, z], i) => stall(scene, x, z, CLOTH[i]!, seed()));
      d.built.push(stringLights(scene, [[10.2, 15.6], [21, 14.8], [31.8, 15.6]], night));
      d.built.push(stringLights(scene, [[10.2, 20.4], [21, 19.6], [31.8, 20.4]], night));
      shadeSail(scene, 21, 16.6, 4.2, 2.6, 2.6, '#7a5a3a');
      crates(scene, 23.6, 22.6);
      drum(scene, 33.6, 21.0);
      well(scene, 21, 22.6);
      bench(scene, 35.6, 23.0, -0.2);
      d.built.push(lanternPost(scene, 8.4, 24.6, night, night));
      d.built.push(lanternPost(scene, 33.6, 24.8, night, night));
      boardSign(scene, 1.6, 26.0, '< MAR FARM', 0.15, 31);
      boardSign(scene, 42.4, 26.0, 'EAST RD >', -0.1, 32);
      carHulk(scene, 25.0, 30.0, 3.12, seed());
      powerLine(scene, [[0.6, 26.3, 0.04], [14.0, 26.4, -0.03], [28.0, 26.3, 0.07], [43.4, 26.3, 0.02]], [[0, 1], [1, 2], [2, 3]]);

      // ------------------------------------------------ growing things, at the edges
      for (const [x, z, s] of [[1.6, 3.0, 1.1], [15.6, 3.2, 1.0], [24.6, 3.6, 1.15], [43.0, 9.4, 1.0], [2.2, 13.2, 1.0], [43.0, 18.6, 0.95]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.25);
      d.tree(deadTree(26.4, 24.6, 1.0, seed()), 0.2);
      for (const [x, z, s] of [[18.4, 3.4, 1.1], [35.4, 23.8, 0.95], [8.6, 14.4, 1.0]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());
      for (const [x, z, s] of [[1.4, 23.6, 0.9], [27.6, 6.2, 0.8], [42.4, 23.6, 1.0], [14.4, 6.8, 0.7]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      for (const [x, z, s] of [[9.0, 8.6, 0.7], [34.2, 12.6, 0.8], [3.0, 16.0, 0.7], [41.6, 7.6, 0.8]] as Array<[number, number, number]>) d.tree(bush(x, z, s, seed()), 0);
      for (const [x, z, s] of [[43.0, 15.0, 0.4], [1.6, 6.6, 0.35]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      tumbleweed(scene, 40.6, 30.2, 4);
      desertScatter(scene, COLS, ROWS, 78, (x, z) => ['x', 's', '#'].includes(d.grid.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.3));

      // ------------------------------------------------ doors, things, people
      d.things.push(
        { x: 6.5, z: 8.4, label: 'Go in', go: { to: 'chapel', spawn: 'door' } },
        { x: 31.5, z: 9.4, label: 'Knock', go: { to: 'fina-house', spawn: 'door' } },
        { x: 37.3, z: 16.5, label: 'Go in', go: { to: 'kids-house', spawn: 'door' } },
        { x: 39.6, z: 7.4, label: 'Door', lines: ['Shut. No light inside. Whoever lives here is out, or asleep.'] },
        { x: 21, z: 24.0, r: 1.8, label: 'Well', lines: ["The bucket comes up wet. Somebody's lucky night."] },
        { x: 21, z: 12.4, r: 2.6, label: 'Flags', lines: ['Seven flags on seven poles. The colors have all gone the same gray-pink.'] },
        { x: 14.2, z: 13.4, r: 1.6, label: 'Machine', lines: ['A small machine on four wheels, mowing the same square of dust it always has. Its blade isn’t turning.'] },
        { x: 35.6, z: 23.8, r: 1.3, label: 'Bench', lines: ['A concrete bench. The dust is worn off one end, where somebody sits every night.'] },
      );
      d.npcs.push(
        { id: 'chayo', name: 'Doña Chayo', sprite: 'chayo', x: 12.4, z: 16.6, face: 'S', lines: ["White's not for looking at, mija. Put it on before you leave, not when you feel it."] },
        { id: 'beto', name: 'Don Beto', sprite: 'beto', x: 16.2, z: 16.6, face: 'S', lines: ['You hear her last night? La Llorona. Down in the Dead River.', "My abuela said if you hear her crying, you don't go look. You don't help. You go home."] },
        { id: 'ruben', name: 'Rubén', sprite: 'ruben', x: 18.2, z: 12.6, face: 'N', lines: ['Seven flags. Seven nations owned this ground once, they say.', "Can't name a single one of them. Doesn't matter. They're gone, and we're still here."] },
        { id: 'kit', name: 'Kit', sprite: 'kit', x: 23.4, z: 12.8, face: 'W', lines: ['Does rain make a noise? Like, when it hits stuff?', 'Your papá said his abuelo heard it once. He said it sounds like applause.'] },
        { id: 'tavo', name: 'Tavo', sprite: 'tavo', x: 19.4, z: 24.2, face: 'E', lines: ['Did you know the Old Trail is the oldest place in the whole world?', 'Abuelo Nacho says the first people walked it. It’s north. It has benches.'] },
        { id: 'nina', name: 'Nina', sprite: 'nina', x: 22.8, z: 24.4, face: 'W', lines: ['Tavo says the Old Trail is the oldest place in the world. I say it’s the drain.', 'The drain has bones in it. That’s how you know it’s old.'] },
        { id: 'nacho', name: 'Abuelo Nacho', sprite: 'nacho', x: 34.4, z: 23.6, face: 'S', lines: ["There's a bench up the way. Somebody carved a heart in it. Ancient."] },
      );
      for (const [x, z] of [[24.5, 23.0], [14.0, 23.4], [30.5, 24.0]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [SQ.x0 + 1, 22, SQ.x1 - 1, 25], speed: 0.9, height: 0.34 });
    },
  };
}
