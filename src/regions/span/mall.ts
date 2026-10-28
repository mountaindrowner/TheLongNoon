import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { boardSign, rock } from '../../engine/props';
import { box, cyl, colMat } from '../../engine/geo';
import { building, M, type Built } from '../../engine/buildings';
import { addSolid, heightAt } from '../../engine/world';
import { fbm } from '../../engine/noise';
import { STRAW, nopal, carHulk, lanternPost, skull } from './props';
import { spanPaint, cairn, jerseys } from './kit';
import { spanDoor } from './doors';
import { SPAN_FLORA, deadMesquite } from './brush';
import { brushFill, openScatter, motte } from './fill';
import { rubble } from './ruins';

/**
 * THE MALL (the Span; large, 132×96). South-west of town, down the side street past the last yards: a mall
 * laid out on the real one's lines (the owner, 2026-10-28: "the shape of Mall del Norte"): one long concourse
 * under a single roof, a big store at each end, a wing branching north-east to two more two-storey stores, the
 * cinema, and all of it ringed by a road and an ocean of parking. Nobody lives here. Scavengers come and go;
 * one of them hangs a lantern at the broken doors when they're inside.
 *
 * - Hero: the cinema's marquee over the south lot, a few letters still on it, out of the sun under its canopy.
 * - Routine: a roof ventilator, still spinning in the hot wind over the concourse.
 * - Signature: the pylon sign, fallen on its face by the access road. Underneath, the letters kept: the Old Name.
 * - Seen, never said: sand drifted against every north wall; the light poles in rows over nothing.
 * - Ways out: north up the access road, back to town.
 */

export const COLS = 132, ROWS = 96;
type Pt = [number, number];
const RING = { x0: 8, z0: 8, x1: 124, z1: 88 };
const ACCESS: Pt[] = [[96, -1], [96, 9]];
/** The buildings, on the real mall's lines: footprints (centre, size) and heights. */
const CONCOURSE = { x: 62, z: 47, w: 76, d: 14, h: 4.6 };
const WEST = { x: 17, z: 47, w: 16, d: 26, h: 6.0 };
const EAST = { x: 108, z: 47, w: 16, d: 22, h: 5.0 };
const WING = { x: 87, z: 32, w: 9, d: 16, h: 4.2 };
const NE1 = { x: 78, z: 18, w: 15, d: 12, h: 6.0 };
const NE2 = { x: 97, z: 19, w: 15, d: 12, h: 6.0 };
const CINEMA = { x: 36, z: 64, w: 18, d: 12, h: 5.6 };
const COURT = { x: 64, z: 56.6, w: 12, d: 5.2, h: 5.4 };

export function abandonedMall(night: boolean): SectionSpec {
  let grid: Grid;
  const blocks = [CONCOURSE, WEST, EAST, WING, NE1, NE2, CINEMA, COURT];
  const inBlock = (x: number, z: number, pad = 0): boolean => blocks.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad);
  return {
    id: 'mall',
    title: 'The Mall',
    sub: 'Under the long roof',
    kind: 'side',
    cols: COLS,
    rows: ROWS,
    seed: 161,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      for (const [cx, cz, rx, rz, s] of [[4, 6, 6, 5, 161], [128, 6, 5, 6, 162], [4, 92, 8, 4, 163], [126, 90, 6, 5, 164], [60, 93, 12, 3, 165]] as Array<[number, number, number, number, number]>) motte(g, cx, cz, rx, rz, s);
      // the lot: one sheet of asphalt from the ring road in, islands of dead grass in rows
      g.rect(RING.x0, RING.z0, RING.x1 - RING.x0, RING.z1 - RING.z0, 'd');
      for (let x = 20; x < 120; x += 16) for (const z of [12, 76, 82]) g.rect(x, z, 6, 1.4, 'p');
      g.line(ACCESS, 7, 'd');
      // sand drifted against the north walls and across the lot
      for (const [cx, cz, rx, rz, s] of [[60, 37, 26, 3, 166], [86, 10, 14, 3, 167], [18, 31, 8, 3, 168], [40, 22, 10, 6, 169], [116, 30, 6, 8, 170], [20, 80, 10, 4, 171]] as Array<[number, number, number, number, number]>) g.blob(cx, cz, rx, rz, 's', s, (q) => q === 'd' || q === 'x');
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 165, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      // stall lines: rows of them, facing the building, half gone
      if (glyph === 'd' && !inBlock(x, z, 1.5) && x > RING.x0 + 7 && x < RING.x1 - 7 && z > RING.z0 + 7 && z < RING.z1 - 7) {
        const row = ((z - 14) % 10 + 10) % 10;
        if ((row < 0.1 || (Math.abs((x % 2.7) - 1.35) < 0.06 && row < 4.6)) && fine > 0.35) return [178, 170, 152];
      }
      // the ring road's centre line
      if (glyph === 'd' && (Math.abs(z - RING.z0 - 3) < 0.08 || Math.abs(z - RING.z1 + 3) < 0.08 || Math.abs(x - RING.x0 - 3) < 0.08 || Math.abs(x - RING.x1 + 3) < 0.08) && (x + z) % 3 < 1.6 && fine > 0.25) return [190, 160, 70];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', e: 'brush', w: 'brush' },
    exits: [{ side: 'n', at: 96, w: 7, to: 'seven-flags', spawn: 'mall', name: 'town' }],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();
      const panel = colMat('#c8bca4', { roughness: 1 }), panelDark = colMat('#a89c84', { roughness: 1 });
      const blank = colMat('#8a8070', { roughness: 1 });

      // ------------------------------------------------ the buildings: concourse, anchors, the wing, the cinema
      d.built.push(...building(scene, { ...CONCOURSE, wall: panel, roof: 'flat', roofMat: 'concrete', seed: 161, doors: [{ x: -26, w: 1.6, ...spanDoor('boarded', night) }, { x: 24, w: 1.6, ...spanDoor('shut', night) }] }, night));
      d.built.push(...building(scene, { ...WEST, wall: panelDark, roof: 'flat', roofMat: 'concrete', seed: 162, doors: [{ x: 0, w: 3.0, ...spanDoor('boarded', night) }] }, night));
      d.built.push(...building(scene, { ...EAST, wall: panelDark, roof: 'flat', roofMat: 'concrete', seed: 163, doors: [{ x: -2, w: 2.4, ...spanDoor('dark', night) }] }, night));
      d.built.push(...building(scene, { ...WING, wall: panel, roof: 'flat', roofMat: 'concrete', seed: 164 }, night));
      d.built.push(...building(scene, { ...NE1, wall: blank, roof: 'flat', roofMat: 'concrete', seed: 165, doors: [{ x: 2, w: 2.4, ...spanDoor('boarded', night) }] }, night));
      d.built.push(...building(scene, { ...NE2, wall: blank, roof: 'flat', roofMat: 'concrete', seed: 166, doors: [{ x: -2, w: 2.4, ...spanDoor('shut', night) }] }, night));
      d.built.push(...building(scene, { ...CINEMA, wall: panelDark, roof: 'flat', roofMat: 'concrete', seed: 167, doors: [{ x: 0, w: 2.2, ...spanDoor('boarded', night) }] }, night));
      // the centre court's entrance: tall glass, smashed out; a scavenger's lantern means someone's in there
      d.built.push(...building(scene, { ...COURT, wall: panel, roof: 'flat', roofMat: 'concrete', seed: 168, doors: [{ x: 0, w: 2.6, h: 2.6, ...spanDoor('lantern', night) }] }, night));
      const court = new THREE.Group();
      court.position.set(COURT.x, heightAt(COURT.x, COURT.z), COURT.z);
      const glass = colMat('#2a2e34', { roughness: 0.2, metalness: 0.3 });
      for (const sx of [-4.2, -2.6, 2.6, 4.2]) court.add(box(1.3, 3.4, 0.06, glass, sx, 0.2, COURT.d / 2 + 0.02));
      court.add(box(COURT.w + 1.2, 0.3, 2.2, panelDark, 0, 3.8, COURT.d / 2 + 0.8)); // the canopy over the doors
      for (const sx of [-6, 6]) court.add(box(0.3, 3.8, 0.3, panelDark, sx, 0, COURT.d / 2 + 1.7));
      scene.add(court);

      // ------------------------------------------------ the cinema's marquee (hero): a canopy, a letter board, a few letters left
      const cin = new THREE.Group();
      cin.position.set(CINEMA.x, heightAt(CINEMA.x, CINEMA.z), CINEMA.z);
      cin.add(box(CINEMA.w - 2, 0.4, 3.0, colMat('#7a2a2a', { roughness: 0.8 }), 0, 3.4, CINEMA.d / 2 + 1.4));
      cin.add(box(CINEMA.w - 4, 1.1, 0.2, colMat('#e8e0cc', { roughness: 0.9 }), 0, 3.85, CINEMA.d / 2 + 2.8));
      const letter = colMat('#1a1a1a', { roughness: 1 });
      for (const [i, w] of [[0, 0.32], [1, 0.32], [2, 0.32], [5, 0.32], [6, 0.32], [9, 0.32]] as Array<[number, number]>) cin.add(box(w, 0.42, 0.04, letter, -3.4 + i * 0.7, 4.15, CINEMA.d / 2 + 2.92));
      for (const sx of [-6.6, 6.6]) cin.add(box(0.3, 3.4, 0.3, panelDark, sx, 0, CINEMA.d / 2 + 2.6));
      scene.add(cin);
      addSolid(CINEMA.x - 6.8, CINEMA.z + CINEMA.d / 2 + 2.4, CINEMA.x - 6.4, CINEMA.z + CINEMA.d / 2 + 2.8);
      addSolid(CINEMA.x + 6.4, CINEMA.z + CINEMA.d / 2 + 2.4, CINEMA.x + 6.8, CINEMA.z + CINEMA.d / 2 + 2.8);

      // ------------------------------------------------ the roof ventilator (routine), spinning in the hot wind
      const fan = new THREE.Group();
      fan.position.set(CONCOURSE.x - 8, heightAt(CONCOURSE.x, CONCOURSE.z) + CONCOURSE.h + 0.1, CONCOURSE.z);
      fan.add(cyl(0.3, 0.3, 0.5, M.steel(), 0, 0, 0, 10));
      const head = new THREE.Group();
      head.position.y = 0.5;
      for (let i = 0; i < 8; i++) { const v = box(0.08, 0.6, 0.46, M.steel(), 0, 0, 0); v.rotation.y = (i / 8) * Math.PI * 2; v.position.set(Math.cos(i / 8 * Math.PI * 2) * 0.32, 0, Math.sin(i / 8 * Math.PI * 2) * 0.32); head.add(v); }
      head.add(cyl(0.42, 0.1, 0.24, M.steel(), 0, 0.6, 0, 10));
      fan.add(head);
      scene.add(fan);
      const spin: Built = { update(t) { head.rotation.y = t * 1.7; } };
      d.built.push(spin);

      // ------------------------------------------------ the pylon sign (signature), face down by the access road
      const py = new THREE.Group();
      py.position.set(92, heightAt(92, 14), 14);
      py.rotation.y = 0.12;
      const face = box(10, 0.3, 2.6, colMat('#9a948a', { metalness: 0.4, roughness: 0.6 }), 0, 0, 0);
      py.add(face);
      for (const sx of [-4.2, 4.2]) { const post = box(0.5, 0.5, 5.0, M.steel(), sx, 0.1, 3.6); post.rotation.x = 0; py.add(post); }
      py.add(box(1.2, 0.8, 1.2, M.concrete(), -4.2, -0.2, 6.4), box(1.2, 0.8, 1.2, M.concrete(), 4.2, -0.2, 6.4));
      scene.add(py);
      addSolid(86.6, 12, 97.4, 16.4);
      d.things.push({ x: 92, z: 17.2, r: 2.6, label: 'Sign', lines: [
        'A sign the size of a house, down on its face across the stalls. Its posts still stand in their footings.',
        'Underneath, out of the sun all this time, the letters kept their color: MALL DEL NORTE.',
      ] });

      // ------------------------------------------------ the lot: light poles in rows over nothing, cars where they stopped
      const pole = colMat('#6a6a68', { metalness: 0.4, roughness: 0.6 });
      for (const x of [22, 46, 70, 94, 116]) for (const z of [16, 78]) {
        if ((x + z) % 3 === 0) { const p = box(0.18, 0.18, 7, pole, x + 3, 0.1, z); p.rotation.y = 0.6; scene.add(p); continue; } // down
        scene.add(box(0.2, 6.6, 0.2, pole, x, 0, z), box(1.6, 0.14, 0.3, pole, x, 6.5, z));
        addSolid(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
      }
      for (const [x, z, r] of [[30, 20, 0.1], [52, 74, 1.5], [58, 80, 0.2], [104, 72, 3.0], [112, 28, 1.6], [16, 72, 0.4], [74, 66, 1.7], [44, 80, 2.9], [120, 60, 0.05]] as Array<[number, number, number]>) carHulk(scene, x, z, r, seed());
      // a cart corral, the carts long gone
      for (const sz of [-0.5, 0.5]) scene.add(box(5, 0.08, 0.08, M.steel(), 82, 0.9, 72 + sz));
      for (const sx of [-2.5, 2.5]) for (const sz of [-0.5, 0.5]) scene.add(box(0.08, 0.9, 0.08, M.steel(), 82 + sx, 0, 72 + sz));
      addSolid(79.4, 71.4, 84.6, 72.6);

      // ------------------------------------------------ the way in from town, and where the ring road meets the brush
      boardSign(scene, 99.6, 4, 'NO AGUA', 0.1, 161);
      d.things.push({ x: 99.6, z: 5, r: 1.6, label: 'Sign', lines: ['A board on a post, painted by hand: NO AGUA. Somebody has added a skull underneath in charcoal.'] });
      skull(scene, 101, 6, 0.8);
      jerseys(scene, [[RING.x0 + 0.6, 40], [RING.x0 + 0.6, 56]], seed());
      rubble(scene, 120, 46, 1.4, seed()); cairn(scene, 14, 88, seed());
      d.built.push(lanternPost(scene, COURT.x + 2.4, COURT.z + COURT.d / 2 + 1.0, night, night));

      d.spawns.court = { x: COURT.x, z: COURT.z + COURT.d / 2 + 1.6, face: 'S' };
      d.things.push(
        { x: COURT.x, z: COURT.z + COURT.d / 2 + 0.8, label: 'Go in', go: { to: 'mall-court', spawn: 'door' } },
        { x: CINEMA.x, z: CINEMA.z + CINEMA.d / 2 + 3.4, r: 3.0, label: 'Marquee', lines: ['A red canopy over boarded doors, a white letter board above it. Six black letters still hang on it, spelling nothing.'] },
        { x: CONCOURSE.x - 8, z: CONCOURSE.z + CONCOURSE.d / 2 + 0.8, r: 2.4, label: 'Wall', lines: ['A long blank wall, the same pale panels end to end. Up on the roof, something turns and squeaks.'] },
        { x: WEST.x, z: WEST.z + WEST.d / 2 + 0.8, r: 2.6, label: 'Store', lines: ['A store two floors high, its doors sealed with plywood gone silver.'] },
      );
      d.roamers.push({ sprite: 'stray', frames: [], x: 48, z: 76, area: [26, 70, 100, 84], speed: 0.9, height: 0.9 });
      for (const [x, z, s] of [[4, 40, 1.1], [128, 50, 1.0], [60, 4, 1.0]] as Array<[number, number, number]>) d.tree(deadMesquite(x, z, s, seed()), 0.25);
      for (const [x, z, s] of [[122, 20, 0.9], [10, 20, 0.8]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      rock(scene, 126, 84, 0.5, seed());
      brushFill(d, 161, 1);
      openScatter(d, 162, ['x', 's'], 0.5, (x, z) => !inBlock(x, z, 2) && !(x > RING.x0 && x < RING.x1 && z > RING.z0 && z < RING.z1));
    },
  };
}
