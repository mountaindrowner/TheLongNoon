import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { boardSign, rock } from '../../engine/props';
import { deadTree } from '../../engine/foliage';
import { box, colMat, prism } from '../../engine/geo';
import { building, windowAt } from '../../engine/buildings';
import { addSolid, heightAt } from '../../engine/world';
import { fbm } from '../../engine/noise';
import { STRAW, palm, nopal, lanternPost, carHulk, shadeSail, jugs, drum } from './props';
import { spanPaint, cairn, jerseys } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA, mesquite } from './brush';
import { brushFill, openScatter, motte, clearOf } from './fill';
import { house, containerHome, yardTank, rubble } from './ruins';
import { table } from './rooms';

/**
 * THE OPEN DOOR (the Span; large, 120×96). A church on the rise north-east of town, at the top of the trail,
 * laid out from the owner's map and photograph of the real one: a tall mission front facing the old boulevard,
 * its gable carrying an arched belfry and a cross, a long low wing off to the east with a row of arched windows,
 * the parking lot between the building and the road, palms by the door, one big tree at the end of the wing.
 *
 * A century on, people still keep it. They give water and bread and a roof through the day to whoever comes up
 * the trail, and they pray. Nobody knows much about who built it; they know those people fed whoever came, and
 * who they did it for (the owner, 2026-10-28). Its door never shuts: the one lantern in town that's always lit.
 *
 * - Hero: the front gable, the belfry arch and its cross against the sky.
 * - Routine: the line at the water table under the sails, Marta ladling, Benny bringing jugs.
 * - Signature: the wing's arched windows, lit warm all night where people sleep.
 * - Seen, never said: the palms are alive, and green under them. Water goes on the ground here.
 * - Old Name: inside, a plaque out of the sun (the hall, rooms.ts).
 * - Ways out: south down the trail to town. The boulevard runs off both ways into brush, closed with wrecks.
 */

export const COLS = 120, ROWS = 96;
type Pt = [number, number];
/** The old boulevard, curving south-west to north-east across the foot of the lot (the owner's map). */
const BLVD: Pt[] = [[-1, 90], [30, 80], [60, 70], [90, 56], [121, 38]];
/** The trail up from the south. */
const TRAIL: Pt[] = [[36, 97], [37, 84], [38, 72], [40, 62]];
const HALL = { x: 47, z: 37, w: 14, d: 24, h: 4.2 };
const WING = { x: 68, z: 43.4, w: 28, d: 10, h: 3.0 };
const LOT = { x0: 28, z0: 50.4, x1: 92, z1: 64 };
const TREE: Pt = [86.4, 44.6];

export function churchOnTheHill(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'church',
    title: 'The Open Door',
    sub: 'A church on the rise',
    kind: 'side',
    cols: COLS,
    rows: ROWS,
    seed: 151,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      // open sand to the north and east, the way the real lot backs onto empty ground
      g.blob(80, 20, 26, 14, 's', 151, (q) => q === 'x');
      g.blob(20, 30, 12, 10, 's', 152, (q) => q === 'x');
      for (const [cx, cz, rx, rz, s] of [[8, 8, 9, 7, 153], [112, 10, 8, 8, 154], [6, 60, 6, 10, 155], [114, 76, 6, 10, 156], [60, 6, 10, 4, 157], [100, 90, 12, 5, 158]] as Array<[number, number, number, number, number]>) motte(g, cx, cz, rx, rz, s);
      g.rect(LOT.x0, LOT.z0, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, 'd');
      g.line(BLVD, 8, 'd');
      g.line(TRAIL, 2.4, 'e');
      g.rect(HALL.x - HALL.w / 2 - 3, HALL.z + HALL.d / 2, HALL.w + 6, 1.6, 'b'); // the walk along the front
      // green where they water: under the palms, and the beds along the wing
      g.blob(40, 50.6, 3, 1.4, 'g', 159, () => true); g.blob(54.6, 50.6, 3, 1.4, 'g', 160, () => true);
      g.rect(56, 48.6, 24, 1.4, 'g');
      g.rect(16, 66, 10, 6, 'b'); // a slab where something stood across the road
    },
    height(x, z, h) {
      // the rise: the church sits a little above the road
      return h + 1.0 * Math.max(0, Math.min(1, (60 - z) / 30));
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 155, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // the lot: faded stall lines in rows facing the building
      if (glyph === 'd' && x > LOT.x0 + 1 && x < LOT.x1 - 1 && z > LOT.z0 + 1 && z < LOT.z1 - 1) {
        const row = (z - LOT.z0) % 6.4;
        if ((row < 0.12 || (Math.abs((x - LOT.x0) % 2.8) < 0.08 && row < 2.6)) && fine > 0.22) return [176, 168, 150];
      }
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', e: 'brush', w: 'brush' },
    exits: [{ side: 's', at: 36, w: 6, to: 'trail', spawn: 'hill', name: 'trail' }],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();
      const stucco = colMat('#e8dcc4', { roughness: 1 }), stuccoShade = colMat('#d6c8ae', { roughness: 1 });
      const tile = colMat('#a8563e', { roughness: 0.9 });

      // ------------------------------------------------ the hall (hero): the mission front, the belfry, the cross
      const front = HALL.z + HALL.d / 2;
      d.built.push(...building(scene, { x: HALL.x, z: HALL.z, w: HALL.w, d: HALL.d, h: HALL.h, wall: stucco, roof: 'flat', seed: 151, doors: [{ x: 0, w: 1.7, h: 2.4, ...spanDoor('lantern', night) }] }, night));
      const hall = new THREE.Group();
      hall.position.set(HALL.x, heightAt(HALL.x, HALL.z), HALL.z);
      // the roof: a low gable running front to back, behind a front gable that stands taller than the roof
      const rise = 1.8;
      const roofShape = new THREE.Shape([new THREE.Vector2(-HALL.w / 2 - 0.3, 0), new THREE.Vector2(0, rise - 0.6), new THREE.Vector2(HALL.w / 2 + 0.3, 0)]);
      const roof = prism(roofShape, HALL.d - 0.4, colMat('#b8a890', { roughness: 1 }));
      roof.position.set(0, HALL.h, -0.2);
      hall.add(roof);
      const gableShape = new THREE.Shape([new THREE.Vector2(-HALL.w / 2, 0), new THREE.Vector2(-HALL.w / 2, 0.5), new THREE.Vector2(0, rise + 0.4), new THREE.Vector2(HALL.w / 2, 0.5), new THREE.Vector2(HALL.w / 2, 0)]);
      const gable = prism(gableShape, 0.5, stucco);
      gable.position.set(0, HALL.h, HALL.d / 2 - 0.2);
      hall.add(gable);
      // the belfry at the peak: two piers and an arch, open in the middle, a cross on top
      const peak = HALL.h + rise + 0.4;
      for (const sx of [-0.6, 0.6]) hall.add(box(0.32, 1.3, 0.44, stucco, sx, peak - 0.2, HALL.d / 2 - 0.2));
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 6, 14, Math.PI), stucco);
      arch.position.set(0, peak + 1.1, HALL.d / 2 - 0.2);
      hall.add(arch);
      hall.add(box(1.6, 0.2, 0.5, stucco, 0, peak - 0.25, HALL.d / 2 - 0.2));
      const crossMat = colMat('#f2ead8', { roughness: 0.8 });
      hall.add(box(0.14, 1.0, 0.14, crossMat, 0, peak + 1.7, HALL.d / 2 - 0.2), box(0.6, 0.14, 0.14, crossMat, 0, peak + 2.2, HALL.d / 2 - 0.2));
      // over the door: an arch, and above it a round window, lit when the hall is
      const doorArch = new THREE.Mesh(new THREE.CircleGeometry(0.95, 14, 0, Math.PI), stuccoShade);
      doorArch.position.set(0, 2.4, HALL.d / 2 + 0.03);
      hall.add(doorArch);
      const rose = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), night ? new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ffb060', emissiveIntensity: 1.3 }) : colMat('#3a3a40', { roughness: 0.3, metalness: 0.2 }));
      rose.position.set(0, 4.75, HALL.d / 2 + 0.28);
      hall.add(rose);
      // buttresses at the front corners, the way the mission style squares a front off
      for (const sx of [-1, 1]) hall.add(box(0.7, HALL.h + 0.6, 0.9, stuccoShade, sx * (HALL.w / 2 + 0.15), 0, HALL.d / 2 - 0.3));
      scene.add(hall);

      // ------------------------------------------------ the wing (signature): long and low, a row of arched windows
      d.built.push(...building(scene, { x: WING.x, z: WING.z, w: WING.w, d: WING.d, h: WING.h, wall: stucco, roof: 'flat', seed: 152, doors: [{ x: -WING.w / 2 + 2.4, w: 1.2, ...spanDoor('shut', night) }] }, night));
      const wing = new THREE.Group();
      wing.position.set(WING.x, heightAt(WING.x, WING.z), WING.z);
      // the roof: pale, with a coping of red tile along its edges
      wing.add(box(WING.w, 0.1, WING.d, colMat('#cfc2a8', { roughness: 1 }), 0, WING.h, 0));
      for (const sz of [-1, 1]) wing.add(box(WING.w + 0.3, 0.3, 0.4, tile, 0, WING.h, sz * (WING.d / 2)));
      for (const sx of [-1, 1]) wing.add(box(0.4, 0.3, WING.d + 0.3, tile, sx * (WING.w / 2), WING.h, 0));
      for (let i = 0; i < 9; i++) {
        const wx = -WING.w / 2 + 5.2 + i * 2.5;
        windowAt(wing, wx, 0.8, WING.d / 2 + 0.02, night ? 'lit' : 'glass', 0.8, 1.1);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10, 0, Math.PI), night ? new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ffb060', emissiveIntensity: 1.1 }) : colMat('#3a3a40', { roughness: 0.3 }));
        cap.position.set(wx, 1.9, WING.d / 2 + 0.025);
        wing.add(cap);
      }
      scene.add(wing);

      // ------------------------------------------------ the front: palms by the door, alive, the one green thing for miles
      palm(scene, 40.6, 50.4, 1.05, seed()); palm(scene, 54.2, 50.6, 0.95, seed()); palm(scene, 37.4, 49.6, 0.8, seed());
      for (let x = 57; x < 80; x += 3.4) nopal(scene, x, 49.3, 0.55, seed());
      d.built.push(lanternPost(scene, 49.4, 50.6, night, true)); // by the door: lit every night, lit by day too
      // the tree at the end of the wing: dead a long time, still standing, a sail strung off it for shade
      d.tree(deadTree(TREE[0], TREE[1], 2.4, seed()), 0.8);
      shadeSail(scene, 84, 52, 7, 5, 2.9, '#c8b48a');

      // ------------------------------------------------ the water table (routine): sails over trestles, jugs, a line
      shadeSail(scene, 66, 54.4, 9, 5.4, 2.7, '#2f4a40');
      const tables = new THREE.Group();
      tables.position.y = heightAt(66, 54);
      table(tables, 64, 54, 3.2, 1.0); table(tables, 68, 54, 3.2, 1.0);
      scene.add(tables);
      addSolid(62.2, 53.4, 69.8, 54.6);
      jugs(scene, 63.4, 52.6, 6, seed()); drum(scene, 70.6, 53, false); drum(scene, 71.4, 53.8, false);
      yardTank(scene, 58, 30, seed()); yardTank(scene, 61, 29, seed());
      d.things.push({ x: 66, z: 55.6, r: 2.2, label: 'Water table', lines: ['Two tables under a sail. Jugs, a ladle, a stack of tin cups washed and turned over to dry.'] });

      // ------------------------------------------------ the lot: what's parked here hasn't moved in a hundred years
      carHulk(scene, 34, 58.4, 1.56, seed()); carHulk(scene, 80, 61.6, 1.62, seed());
      boardSign(scene, 44, 64.6, 'AGUA Y PAN', 0.0, 151);
      d.things.push({ x: 44, z: 65.4, r: 1.6, label: 'Sign', lines: ['A board on a post at the edge of the lot, painted by hand: AGUA Y PAN.'] });

      // ------------------------------------------------ behind: two containers where the keepers live, a cairn for their dead
      d.built.push(...containerHome(scene, 22, 22, 0, 'shut', night, seed()), ...containerHome(scene, 26, 14, 1, null, night, seed()));
      cairn(scene, 34, 18, seed()); cairn(scene, 36.6, 16.4, seed());
      d.things.push({ x: 35, z: 19.4, r: 2.0, label: 'Cairns', lines: ['Two stone cairns behind the hall, each with a cross of sticks.'] });

      // ------------------------------------------------ across the boulevard: houses nobody lives in now
      const R = (i: number): number => ((Math.sin(i * 91.7) + 1) / 2);
      for (const [i, [x, z, rot]] of ([[86, 74, -0.44], [98, 68, -0.44], [72, 82, -0.3], [108, 62, -0.5], [20, 90, -0.3]] as Array<[number, number, number]>).entries()) {
        d.built.push(...house(scene, { x, z, w: 5 + R(i) * 1.4, d: 4.4, h: 2.6, base: (['stucco', 'block', 'tin'] as const)[i % 3]!, door: { x: 0.4, kind: i % 2 ? 'boarded' : 'shut' }, seed: 1510 + i, rot }, night));
      }
      rubble(scene, 20, 68, 1.4, seed());
      // the boulevard runs on off both ways: wrecks and barriers where it meets the brush
      jerseys(scene, [[3, 84], [3, 94]], seed()); carHulk(scene, 6, 88.4, 0.3, seed());
      jerseys(scene, [[116.6, 33], [116.6, 44]], seed()); carHulk(scene, 113, 39, 1.2, seed());

      // ------------------------------------------------ the people who keep it (the hall has Pastor Abel)
      d.npcs.push(
        { id: 'marta', name: 'Doña Marta', sprite: 'marta', x: 66, z: 52.6, face: 'S', lines: ['Water’s free, mija. Sit down before you drink it.', 'Nobody drinks standing up here. That’s the only rule I make.'] },
        { id: 'benny', name: 'Benny', sprite: 'benny', x: 59.6, z: 31.8, face: 'S', lines: ['The windmill down the trail fills the tank. I fill the jugs. Marta fills the cups.', 'Pastor Abel says that’s a sermon. I just carry water.'] },
        { id: 'traveler', name: 'Traveler', sprite: 'traveler', x: 66.4, z: 57.2, face: 'N', lines: ['Came up from the river side three nights ago.', 'They didn’t ask where from. They just pointed at a cot.'] },
      );
      d.spawns.door = { x: HALL.x, z: front + 1.6, face: 'S' };
      d.things.push(
        { x: HALL.x, z: front + 0.8, label: 'Go in', go: { to: 'church-hall', spawn: 'door' } },
        { x: HALL.x - 4.6, z: front + 1.0, r: 1.8, label: 'Front', lines: ['A tall white front with a cross on top, the plaster gone soft and pale. Over the door, a round window.'] },
        { x: WING.x, z: WING.z + WING.d / 2 + 1.0, r: 2.6, label: 'Windows', lines: night ? ['A long low wing, a row of arched windows, every one of them lit. Shapes of people on cots inside.'] : ['A long low wing, a row of arched windows. Inside, out of the white, people sleep on cots.'] },
        { x: TREE[0], z: TREE[1] + 1.6, r: 2.4, label: 'Tree', lines: ['A huge tree, dead and grey, still standing. A sail is tied off its lowest limb.'] },
      );
      for (const [x, z, s] of [[50, 22, 0.5], [96, 30, 0.45], [12, 44, 0.5]] as Array<[number, number, number]>) rock(scene, x, z, s, seed());
      for (const [x, z, s] of [[14, 28, 1.0], [104, 22, 1.1], [92, 12, 0.9]] as Array<[number, number, number]>) d.tree(mesquite(x, z, s, seed()), 0.3);
      brushFill(d, 151, 1);
      openScatter(d, 152, ['x', 's'], 0.6, (x, z) => clearOf(TRAIL, 2.4)(x, z) && !(x > 30 && x < 94 && z > 28 && z < 66));
    },
  };
}
