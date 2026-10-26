import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { building, M } from '../../engine/buildings';
import { powerLine, crates } from '../../engine/foliage';
import { boardSign } from '../../engine/props';
import { box, shade } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { fbm } from '../../engine/noise';
import { STRAW, palm, nopal, lanternPost, shadeSail, jugs, drum, clothesline, carHulk } from './props';
import { spanPaint, stall, stringLights, sevenFlags, well, lawnkeeper, bench, belfry, busShelter } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA } from './brush';
import { brushFill, openScatter, motte } from './fill';
import { house, containerHome, salvageFence, yardTank, fireRing, rubble, ruinWall } from './ruins';

/**
 * THE PLAZA (the Span; large, 132×96: the west half of the town). The town
 * body: the old park square on the boulevard, the night market in rows
 * under strung bulbs, the chapel at its head, the houses round it, and the
 * long kitchen south of the road where everybody eats. Hold, tier cluttered
 * (the market) going lived_in at the edges. It runs straight on east into
 * the Colonia: the two halves are one town.
 *
 * - Hero: the seven flags, the tallest things in town.
 * - Routine: the Lawnkeeper, mowing the dust of a square it remembers.
 * - Signature: the market, twelve stalls under strung bulbs, every stall a different cloth.
 * - Ways out: the boulevard west to Mar Farm and east through the Colonia; a lane north into the brush
 *   (the Old Trail, not built); the road south to the Dead River (not built).
 * - Inside (lit): the Chapel (lantern), Doña Fina's (light under the door),
 *   Tavo and Nina's (lit window). Not inside: houses shut for the night, a house boarded.
 */

export const COLS = 132, ROWS = 96;
const SQ = { x0: 34, z0: 16, x1: 98, z1: 54 };
const BLVD = { z0: 57, z1: 63 };

/** The kitchen: long tables under a tin roof on posts, a fire, the big pots. */
function comedor(s: THREE.Scene, x: number, z: number, w: number, dd: number): void {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) g.add(box(0.14, 2.6, 0.14, M.wood(), -w / 2 + (i * w) / 4, 0, (sz * dd) / 2));
  const roof = box(w + 0.8, 0.07, dd + 0.9, M.tin(), 0, 2.62, 0);
  roof.rotation.x = 0.06;
  g.add(roof);
  for (let row = 0; row < 3; row++) {
    const tz = -dd / 2 + 1.1 + row * ((dd - 2.2) / 2);
    g.add(box(w - 2.2, 0.08, 0.8, M.wood(), 0, 0.74, tz));
    for (const lx of [-w / 2 + 1.6, 0, w / 2 - 1.6]) g.add(box(0.1, 0.74, 0.7, M.wood(), lx, 0, tz));
    for (const bz of [-0.75, 0.75]) g.add(box(w - 2.4, 0.07, 0.3, M.wood(), 0, 0.42, tz + bz));
  }
  shade(g);
  s.add(g);
  for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) { const px = x - w / 2 + (i * w) / 4, pz = z + (sz * dd) / 2; addSolid(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12); }
  for (let row = 0; row < 3; row++) { const tz = z - dd / 2 + 1.1 + row * ((dd - 2.2) / 2); addSolid(x - w / 2 + 1.1, tz - 0.55, x + w / 2 - 1.1, tz + 0.55); }
}

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
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      motte(g, 14, 4, 12, 4, 51); motte(g, 112, 5, 14, 4, 52); motte(g, 6, 88, 6, 6, 53); motte(g, 126, 90, 5, 4, 54); motte(g, 80, 90, 8, 3, 55);
      g.rect(0, BLVD.z0, COLS, BLVD.z1 - BLVD.z0, 'd'); // the boulevard
      g.rect(0, BLVD.z0 - 1, COLS, 1, 'v'); g.rect(0, BLVD.z1, COLS, 1, 'v');
      g.rect(SQ.x0, SQ.z0, SQ.x1 - SQ.x0, SQ.z1 - SQ.z0, 'e'); // the square: a park once, packed dirt now
      g.rect(SQ.x0 - 2, SQ.z0 - 2, SQ.x1 - SQ.x0 + 4, 2, 'v');
      g.rect(SQ.x0 - 2, SQ.z1, SQ.x1 - SQ.x0 + 4, 3, 'v');
      g.rect(SQ.x0 - 2, SQ.z0, 2, SQ.z1 - SQ.z0, 'v');
      g.rect(SQ.x1, SQ.z0, 2, SQ.z1 - SQ.z0, 'v');
      g.blob(66, 50, 3.4, 2, 'g', 11, (q) => q === 'e'); // the well spills
      g.blob(43, 21, 5, 2.6, 'g', 12, (q) => q === 'e'); // the Lawnkeeper's patch, mown to stubble
      g.rect(58, 11, 16, 3, 'b'); // the chapel's yard
      // lanes: north past the chapel into the brush, south to the river road, alleys between the houses
      g.line([[104, SQ.z0 - 2], [104, 4], [100, -1]], 2.6, 'e');
      g.line([[40, BLVD.z1], [40, 80], [44, ROWS + 1]], 3.2, 'e');
      g.line([[16, BLVD.z0], [16, 16], [SQ.x0 - 2, 16]], 2.4, 'e');
      g.line([[118, BLVD.z0], [118, 20], [SQ.x1 + 2, 20]], 2.4, 'e');
      g.line([[86, BLVD.z1], [86, 84]], 2.4, 'e');
      g.rect(54, 66, 26, 14, 'v'); // the kitchen's yard
      g.blob(112, 74, 4, 3, 's', 13, (q) => q === 'x');
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 62, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      if (glyph === 'd' && Math.abs(z - 60) < 0.08 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', w: 'brush', e: 'none' },
    exits: [
      { side: 'w', at: 60, w: 10, to: 'mar-farm', spawn: 'plaza', name: 'farm' },
      { side: 'n', at: 100, w: 3, to: 'old-trail', spawn: 'south', name: 'north' },
      { side: 's', at: 44, w: 4, to: 'dead-river', spawn: 'north', name: 'south' },
    ],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();

      // ------------------------------------------------ the chapel at the head of the square: lantern at the door, the bell in its tower
      d.built.push(...building(scene, { x: 66, z: 6, w: 10, d: 8, h: 4.0, wall: 'white', roof: 'gable', seed: 21, doors: [{ x: 0, w: 1.6, h: 2.4, ...spanDoor('lantern', night) }], windows: [{ x: -3.2, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.2 }, { x: 3.2, kind: night ? 'lit' : 'glass', w: 0.6, h: 1.2 }], vines: [-4.4] }, night));
      d.built.push(belfry(scene, 72.6, 4.4, 6.0));
      d.spawns.chapel = { x: 66, z: 11.6, face: 'S' };
      d.built.push(lanternPost(scene, 59, 13, night, night));
      d.built.push(lanternPost(scene, 73, 13, night, night));

      // ------------------------------------------------ the houses round the square
      d.built.push(...house(scene, { x: 22, z: 26, w: 7, d: 5.4, h: 2.8, base: 'block', door: { x: 0, kind: 'under' }, windows: [{ x: -2.2, kind: 'boarded' }], seed: 22 }, night));
      d.spawns.fina = { x: 22, z: 30.2, face: 'S' };
      jugs(scene, 25.6, 29.6, 9, seed()); // Doña Fina's stock, out front
      d.built.push(...house(scene, { x: 112, z: 30, w: 7, d: 5.4, h: 2.7, base: 'tin', door: { x: -1.4, kind: 'window' }, seed: 23 }, night));
      d.spawns.kids = { x: 110.6, z: 34.2, face: 'S' };
      d.built.push(clothesline(scene, 106, 35.4, 109, 36.4, seed()));
      d.built.push(...house(scene, { x: 112, z: 44, w: 6, d: 5, h: 2.6, base: 'stucco', door: { x: 0.8, kind: 'shut' }, windows: [{ x: -1.4, kind: 'glass' }], porch: true, seed: 24 }, night));
      d.built.push(...house(scene, { x: 22, z: 44, w: 6.4, d: 5, h: 2.6, base: 'block', door: { x: 0.8, kind: 'boarded' }, windows: [{ x: -1.6, kind: 'boarded' }], seed: 25 }, night));
      d.built.push(...containerHome(scene, 8, 26, 1, 'shut', night, 26));
      d.built.push(...house(scene, { x: 10, z: 44, w: 5.6, d: 4.6, h: 2.5, base: 'ply', door: { x: 0, kind: 'shut' }, tarp: true, seed: 27 }, night));
      d.built.push(...house(scene, { x: 124, z: 30, w: 5.6, d: 5, h: 2.6, base: 'block', door: { x: -0.6, kind: 'shut' }, porch: true, seed: 28 }, night));
      d.built.push(...containerHome(scene, 126, 44, 1, 'shut', night, 29));
      d.built.push(...house(scene, { x: 24, z: 10, w: 7.4, d: 5, h: 2.8, base: 'stucco', door: { x: 1, kind: 'shut' }, windows: [{ x: -2, kind: 'glass' }], seed: 30 }, night));
      d.built.push(...house(scene, { x: 110.6, z: 13, w: 6, d: 5, h: 2.6, base: 'block', door: { x: -1, kind: 'shut' }, tarp: true, seed: 31 }, night));
      salvageFence(scene, [[17.6, 33.6], [17.6, 38.6], [28, 38.6]], seed());
      salvageFence(scene, [[104, 37.6], [119, 37.6], [119, 33]], seed());
      yardTank(scene, 28.4, 22.6, seed()); yardTank(scene, 118.6, 26, seed());
      fireRing(scene, 116, 50.6); fireRing(scene, 14, 50.4);
      rubble(scene, 30, 48.6, 1.2, seed());
      ruinWall(scene, 124, 52, 5, 2.2, 0, seed());

      // ------------------------------------------------ the seven flags (hero) and the Lawnkeeper (routine)
      d.built.push(sevenFlags(scene, 66, 22));
      d.built.push(lawnkeeper(scene, [[39.6, 19.6], [47, 19.6], [47, 22.6], [39.6, 22.6], [39.6, 19.6]]));

      // ------------------------------------------------ the night market (signature): two rows of stalls each side of the aisle
      const CLOTH = ['#a8402e', '#3f6a8a', '#d8b23a', '#6a8a4a', '#8a3a4a', '#c86a3a', '#4a6a7a', '#9a7a3a'];
      let ci = 0;
      for (const sz of [33, 42]) for (const sx of [45, 50.4, 55.8, 76.2, 81.6, 87]) stall(scene, sx, sz, CLOTH[ci++ % CLOTH.length]!, seed());
      for (const sz of [30.6, 39.6, 47]) d.built.push(stringLights(scene, [[41, sz], [53, sz - 0.6], [66, sz], [79, sz - 0.6], [91, sz]], night));
      d.built.push(stringLights(scene, [[64.4, 28], [64.4, 46]], night));
      shadeSail(scene, 66, 37, 4.4, 3, 2.8, '#7a5a3a');
      crates(scene, 60.4, 44.6); crates(scene, 71.6, 30.4);
      drum(scene, 92, 44); drum(scene, 40, 36);
      well(scene, 66, 49.6);
      bench(scene, 88, 51.4, -0.1); bench(scene, 44, 51.4, 0.1); bench(scene, 57, 26, 0); bench(scene, 75, 26, 0);
      for (const [x, z] of [[35, 17], [97, 17], [35, 53], [97, 53]] as Array<[number, number]>) d.built.push(lanternPost(scene, x, z, night, night));
      for (const [x, z, s] of [[37, 28, 1.1], [95, 28, 1.0], [38, 46, 0.95], [94, 46, 1.05]] as Array<[number, number, number]>) palm(scene, x, z, s, seed());

      // ------------------------------------------------ the boulevard
      for (const x of [8, 30, 52, 80, 102, 124]) d.built.push(lanternPost(scene, x, BLVD.z0 - 1.6, night, night));
      boardSign(scene, 3, 55.4, '< MAR FARM', 0.15, 31);
      busShelter(scene, 100, 55.2);
      carHulk(scene, 60, 61.6, 3.12, seed()); carHulk(scene, 110, 58.6, 0.05, seed());
      powerLine(scene, [[0.6, 55.4, 0.04], [26, 55.6, -0.03], [52, 55.4, 0.07], [78, 55.6, 0.02], [104, 55.4, -0.04], [131.4, 55.6, 0.03]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);

      // ------------------------------------------------ south of the road: the kitchen, more homes, the river road
      comedor(scene, 67, 72, 20, 9);
      fireRing(scene, 56.6, 77.6);
      d.built.push(stringLights(scene, [[55.6, 66.6], [67, 66], [78.4, 66.6]], night));
      jugs(scene, 79.6, 77.4, 8, seed());
      d.built.push(...house(scene, { x: 22, z: 72, w: 7, d: 5, h: 2.7, base: 'block', door: { x: 1.4, kind: 'shut' }, porch: true, seed: 32 }, night));
      d.built.push(...containerHome(scene, 24, 84, 0, 'shut', night, 33));
      d.built.push(...house(scene, { x: 100, z: 72, w: 6.6, d: 5.2, h: 2.7, base: 'stucco', door: { x: -1, kind: 'shut' }, tarp: true, seed: 34 }, night));
      d.built.push(...house(scene, { x: 118, z: 76, w: 6, d: 5, h: 2.6, base: 'tin', door: { x: 0.6, kind: 'boarded' }, seed: 35 }, night));
      salvageFence(scene, [[16, 66.4], [16, 78], [30, 78]], seed());
      salvageFence(scene, [[94, 66.4], [94, 80], [108, 80]], seed());
      d.built.push(clothesline(scene, 96, 77, 104, 77.6, seed()));
      yardTank(scene, 12.6, 70, seed()); yardTank(scene, 108.6, 68, seed());
      boardSign(scene, 37.4, 86, 'RIVER v', 0.1, 36);

      // ------------------------------------------------ brush and open ground
      brushFill(d, 52, 1);
      for (const [x, z, s] of [[30, 6, 0.9], [100, 88, 1.0], [8, 62, 0.8]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      openScatter(d, 78, ['x', 's'], 0.45, (x, z) => !(x > SQ.x0 - 4 && x < SQ.x1 + 4 && z > SQ.z0 - 4 && z < SQ.z1 + 4) && !(z > BLVD.z0 - 3 && z < BLVD.z1 + 3) && !(x > 50 && x < 84 && z > 62 && z < 82));

      // ------------------------------------------------ doors, things, people
      d.things.push(
        { x: 66, z: 10.8, label: 'Go in', go: { to: 'chapel', spawn: 'door' } },
        { x: 22, z: 29.4, label: 'Knock', go: { to: 'fina-house', spawn: 'door' } },
        { x: 110.6, z: 33.4, label: 'Go in', go: { to: 'kids-house', spawn: 'door' } },
        { x: 112.8, z: 47.2, label: 'Door', lines: ['Shut. No light inside. Whoever lives here is out, or asleep.'] },
        { x: 66, z: 51.2, r: 2.0, label: 'Well', lines: ["The bucket comes up wet. Somebody's lucky night."] },
        { x: 66, z: 24.4, r: 3.0, label: 'Flags', lines: ['Seven flags on seven poles. The colors have all gone the same gray-pink.'] },
        { x: 43, z: 22.6, r: 1.8, label: 'Machine', lines: ['A small machine on four wheels, mowing the same square of dust it always has. Its blade isn’t turning.'] },
        { x: 88, z: 52.2, r: 1.3, label: 'Bench', lines: ['A concrete bench. The dust is worn off one end, where somebody sits every night.'] },
        { x: 67, z: 77.6, r: 3.0, label: 'Tables', lines: ['Long tables under a tin roof. Enough benches for everybody, if everybody squeezes.'] },
      );
      d.npcs.push(
        { id: 'chayo', name: 'Doña Chayo', sprite: 'chayo', x: 45, z: 35.2, face: 'S', lines: ["White's not for looking at, mija. Put it on before you leave, not when you feel it."] },
        { id: 'beto', name: 'Don Beto', sprite: 'beto', x: 50.4, z: 35.2, face: 'S', lines: ['You hear her last night? La Llorona. Down in the Dead River.', "My abuela said if you hear her crying, you don't go look. You don't help. You go home."] },
        { id: 'ruben', name: 'Rubén', sprite: 'ruben', x: 62.4, z: 24.6, face: 'N', lines: ['Seven flags. Seven nations owned this ground once, they say.', "Can't name a single one of them. Doesn't matter. They're gone, and we're still here."] },
        { id: 'kit', name: 'Kit', sprite: 'kit', x: 69.6, z: 24.8, face: 'W', lines: ['Does rain make a noise? Like, when it hits stuff?', 'Your papá said his abuelo heard it once. He said it sounds like applause.'] },
        { id: 'tavo', name: 'Tavo', sprite: 'tavo', x: 64.2, z: 51.6, face: 'E', lines: ['Did you know the Old Trail is the oldest place in the whole world?', 'Abuelo Nacho says the first people walked it. It’s north. It has benches.'] },
        { id: 'nina', name: 'Nina', sprite: 'nina', x: 67.8, z: 51.8, face: 'W', lines: ['Tavo says the Old Trail is the oldest place in the world. I say it’s the drain.', 'The drain has bones in it. That’s how you know it’s old.'] },
        { id: 'nacho', name: 'Abuelo Nacho', sprite: 'nacho', x: 86.8, z: 52.4, face: 'S', lines: ["There's a bench up the way. Somebody carved a heart in it. Ancient."] },
      );
      for (const [x, z] of [[60, 50], [72, 52], [50, 48], [84, 49]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [SQ.x0 + 2, 47, SQ.x1 - 2, 53], speed: 0.9, height: 0.34 });
      for (const [x, z] of [[20, 74], [12, 76]] as Array<[number, number]>) d.roamers.push({ sprite: 'chicken', frames: [], x, z, area: [17, 67, 29, 77], speed: 0.9, height: 0.34 });
    },
  };
}
