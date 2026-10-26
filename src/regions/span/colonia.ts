import * as THREE from 'three';
import type { Grid, SectionSpec } from '../../engine/section';
import { M, type Built } from '../../engine/buildings';
import { powerLine } from '../../engine/foliage';
import { boardSign } from '../../engine/props';
import { box, beam, cyl, colMat, shade } from '../../engine/geo';
import { addSolid, heightAt } from '../../engine/world';
import { rng, fbm } from '../../engine/noise';
import { STRAW, nopal, lanternPost, clothesline, carHulk, tires, drum, solarPanels } from './props';
import { spanPaint } from './kit';
import { SPAN_FLORA, deadMesquite } from './brush';
import { brushFill, openScatter, motte } from './fill';
import { house, containerHome, salvageFence, yardTank, fireRing, rubble, ruinWall, type Patch } from './ruins';

/**
 * THE COLONIA (the Span; large, 132×96: the east half of the town). Where
 * most of the Span lives: lots off dirt lanes, every house patched from what
 * stood, every yard closed with what was lying around. It runs straight on
 * west into the Plaza: the two halves are one town. Hold, tier lived_in.
 *
 * - Hero: the mast. A radio mast with its dishes gone; on top, a lantern somebody climbs up to light
 *   every night (the Vigil, methodology §4.2: someone keeping watch).
 * - Routine: a wind turbine built from a car's fan on a pole, turning, charging somebody's batteries.
 * - Signature: the salvage walls: tin, pallets, car hoods and old doors closing every yard.
 * - Ways out: the boulevard west into the Plaza and east to the lake road.
 * - Inside: nothing yet. Every door here is shut (out, or asleep): the door language promises
 *   nothing it can't keep.
 */

export const COLS = 132, ROWS = 96;
const BLVD = { z0: 57, z1: 63 };
const LANES_X = [20, 50, 80, 110];
const ALLEYS = [{ z: 30, x0: 6, x1: 126 }, { z: 78, x0: 6, x1: 126 }];
const MAST = { x: 64, z: 16 };
const TURBINE = { x: 94, z: 16 };

/** The mast: a lattice tower, its dish brackets empty, a lantern at the top. */
function mast(s: THREE.Scene, x: number, z: number, h: number, night: boolean): Built {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  const steel = M.steel(), rustM = M.rust();
  const legs: Array<[number, number]> = [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]];
  const at = (k: number, y: number): THREE.Vector3 => { const [lx, lz] = legs[k % 4]!; const t = 1 - (y / h) * 0.7; return new THREE.Vector3(lx * t, y, lz * t); };
  for (let k = 0; k < 4; k++) g.add(beam(at(k, 0), at(k, h), 0.09, steel));
  for (let y = 0; y < h - 0.5; y += 1.4) for (let k = 0; k < 4; k++) { g.add(beam(at(k, y), at(k + 1, y + 1.4), 0.04, k % 2 ? steel : rustM)); g.add(beam(at(k, y + 1.4), at(k + 1, y + 1.4), 0.04, steel)); }
  for (const y of [h * 0.55, h * 0.75]) for (let k = 0; k < 3; k++) g.add(box(0.5, 0.06, 0.06, steel, Math.cos(k * 2.1) * 0.6, y, Math.sin(k * 2.1) * 0.6)); // empty dish brackets
  // the ladder side, and the lantern at the top
  g.add(box(0.5, 0.06, 0.5, steel, 0, h, 0));
  const glass = colMat('#ffd08a', { emissive: '#ffb050', emissiveIntensity: night ? 5 : 0.4 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), glass);
  lamp.position.set(0, h + 0.3, 0);
  g.add(lamp);
  g.add(box(0.3, 0.04, 0.3, steel, 0, h + 0.47, 0));
  if (night) { const l = new THREE.PointLight('#ffb050', 6, 9, 1.6); l.position.set(0, h + 0.4, 0); g.add(l); }
  s.add(shade(g));
  addSolid(x - 0.75, z - 0.75, x + 0.75, z + 0.75);
  return { update(t) { glass.emissiveIntensity = (night ? 5 : 0.4) * (0.9 + Math.sin(t * 6.3) * 0.06 + Math.sin(t * 17.1) * 0.04); } };
}

/** A turbine made from a car's radiator fan on a pole, a tail fin from a road sign, wire down to a battery box. */
function turbine(s: THREE.Scene, x: number, z: number): Built {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  const H = 5.4;
  g.add(cyl(0.08, 0.11, H, M.steel(), 0, 0, 0, 8));
  for (const [dx, dz] of [[1.6, 0], [-0.8, 1.4], [-0.8, -1.4]] as Array<[number, number]>) g.add(beam(new THREE.Vector3(0, H * 0.7, 0), new THREE.Vector3(dx, 0, dz), 0.02, M.steel()));
  const head = new THREE.Group();
  head.position.y = H;
  head.add(box(0.5, 0.26, 0.26, colMat('#3a3a3a', { metalness: 0.5 }), 0, -0.13, 0));
  head.add(box(1.0, 0.04, 0.6, colMat('#2e5a3a', { metalness: 0.3 }), -0.8, -0.1, 0)); // the tail: a green road sign
  const rotor = new THREE.Group();
  rotor.position.set(0.32, 0, 0);
  const blade = colMat('#8a8a82', { metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < 5; i++) { const b = box(0.04, 0.6, 0.16, blade, 0, 0, 0); b.position.set(0, 0, 0); b.rotation.x = (i / 5) * Math.PI * 2; b.translateY(0.32); rotor.add(b); }
  head.add(rotor);
  g.add(head);
  g.add(box(0.7, 0.5, 0.5, M.rust(), 0.9, 0, 0.8)); // the battery box
  s.add(shade(g));
  addSolid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  return { update(t) { rotor.rotation.x = t * 5.2; head.rotation.y = Math.sin(t * 0.13) * 0.4; } };
}

export function colonia(night: boolean): SectionSpec {
  let grid: Grid;
  return {
    id: 'colonia',
    title: 'The Colonia',
    sub: 'The Span',
    kind: 'town',
    cols: COLS,
    rows: ROWS,
    seed: 61,
    flora: SPAN_FLORA,
    ground(g) {
      grid = g;
      g.rect(0, 0, COLS, ROWS, 'x');
      motte(g, 120, 6, 12, 4, 61); motte(g, 8, 90, 7, 4, 62); motte(g, 64, 92, 10, 3, 63); motte(g, 126, 88, 5, 5, 64);
      g.rect(0, BLVD.z0, COLS, BLVD.z1 - BLVD.z0, 'd');
      g.rect(0, BLVD.z0 - 1, COLS, 1, 'v'); g.rect(0, BLVD.z1, COLS, 1, 'v');
      // lanes as people walked them, not as anyone drew them
      LANES_X.forEach((x, i) => {
        const k = i % 2 ? 1.6 : -1.4;
        g.line([[x + k * 0.6, 6], [x + k, 20], [x - k * 0.5, 40], [x, BLVD.z0]], 2.8, 'e');
        g.line([[x, BLVD.z1], [x + k * 0.8, 76], [x - k * 0.4, 90]], 2.8, 'e');
      });
      for (const a of ALLEYS) g.line([[a.x0, a.z], [a.x1, a.z]], 2.4, 'e');
      g.blob(MAST.x, MAST.z + 3, 6, 4, 'v', 65, (q) => q === 'x');
      g.blob(TURBINE.x + 4, TURBINE.z + 2, 3, 2, 's', 66, (q) => q === 'x');
    },
    grassTint: (x, z) => (grid.get(Math.floor(x), Math.floor(z)) === '#' ? STRAW[Math.floor(fbm(x * 3, z * 3, 63, 1) * 4) % 4] : undefined),
    paint(glyph, x, z, fine) {
      if (glyph === 'd' && Math.abs(z - 60) < 0.08 && (x % 3) < 1.8 && fine > 0.25) return [180, 154, 82];
      return spanPaint(glyph, x, z, fine);
    },
    edges: { n: 'brush', s: 'brush', w: 'none', e: 'brush' },
    exits: [{ side: 'e', at: 60, w: 10, to: 'lake-road', spawn: 'town', name: 'east' }],
    dress(d) {
      const { scene } = d;
      const seed = (): number => d.seed();
      const r = rng(6100);

      // ------------------------------------------------ the mast (hero) and the turbine (routine)
      d.built.push(mast(scene, MAST.x, MAST.z, 15, night));
      d.built.push(turbine(scene, TURBINE.x, TURBINE.z));
      salvageFence(scene, [[56, 8], [72, 8], [72, 24]], seed());
      salvageFence(scene, [[87, 10], [87, 24], [100, 24]], seed());

      // ------------------------------------------------ the lots: a house or a container on each, its yard closed with salvage
      const BX: Array<[number, number]> = [[4, 18], [22, 48], [52, 78], [82, 108], [112, 128]];
      const BZ: Array<[number, number]> = [[8, 28], [32, 55], [65, 76], [80, 92]];
      const bases: Patch[] = ['block', 'block', 'stucco', 'tin', 'ply'];
      let n = 0;
      for (const [z0, z1] of BZ) for (const [x0, x1] of BX) {
        if (z0 === 8 && (x0 === 52 || x0 === 82)) continue; // the mast's yard, the turbine's
        const lots = x1 - x0 > 20 ? 2 : 1;
        for (let l = 0; l < lots; l++) {
          const lx0 = x0 + (l * (x1 - x0)) / lots, lx1 = x0 + ((l + 1) * (x1 - x0)) / lots;
          const cx = (lx0 + lx1) / 2 + (r() - 0.5) * 4, depth = z1 - z0;
          // some lots are what's left of the people who went: a wall, a heap, the brush coming in
          if (r() < 0.14) {
            const rx = (lx0 + lx1) / 2, rz = (z0 + z1) / 2;
            ruinWall(scene, rx - 1, rz - 1, 4 + r() * 3, 1.4 + r() * 1.2, 0, 6800 + n);
            rubble(scene, rx + 2, rz + 1.6, 1.1, 6850 + n);
            d.tree(deadMesquite(rx - 3, rz + 2.4, 1.0, 6870 + n), 0.25);
            n++;
            continue;
          }
          const w = Math.min(lx1 - lx0 - 3, 5 + r() * 3), dd = Math.min(depth - 5, 4.2 + r() * 1.6);
          const hz = z0 + 1 + dd / 2 + r() * Math.max(0, depth - dd - 6);
          const doorKind = r() < 0.18 ? 'boarded' : 'shut';
          n++;
          if (r() < 0.28) d.built.push(...containerHome(scene, cx, hz + 0.6, 0, doorKind, night, 6200 + n));
          else d.built.push(...house(scene, { x: cx, z: hz, w, d: dd, h: 2.5 + r() * 0.5, base: bases[Math.floor(r() * bases.length)]!, door: { x: (r() - 0.5) * (w - 2.2), kind: doorKind }, windows: r() > 0.4 ? [{ x: (r() > 0.5 ? 1 : -1) * (w / 2 - 0.8), kind: r() > 0.5 ? 'boarded' : 'glass' }] : [], porch: r() > 0.55, tarp: r() > 0.5, seed: 6300 + n }, night));
          // the yard, in front: closed on its sides with what was lying around
          const yz = hz + dd / 2 + 0.6, ye = Math.min(z1 - 0.6, yz + 4.5);
          // a shed out back, tin on posts or a box of block
          if (r() < 0.4) {
            const sx = cx + (r() > 0.5 ? 1 : -1) * (w / 2 + 1.8);
            if (sx > lx0 + 1.4 && sx < lx1 - 1.4) d.built.push(...house(scene, { x: sx, z: hz - 0.6, w: 2.4, d: 2.2, h: 2.0, base: r() > 0.5 ? 'tin' : 'ply', tarp: false, seed: 6900 + n }, night));
          }
          if (r() > 0.25) salvageFence(scene, [[lx0 + 0.8, yz], [lx0 + 0.8, ye], [cx - 1.6, ye]], 6400 + n);
          if (r() > 0.4) salvageFence(scene, [[lx1 - 0.8, yz], [lx1 - 0.8, ye]], 6500 + n);
          const t = r();
          if (t < 0.35) yardTank(scene, lx1 - 2.2, hz - dd / 2 + 0.2, 6600 + n);
          else if (t < 0.6) d.built.push(clothesline(scene, lx0 + 1.6, yz + 1.6, lx0 + 5.2, yz + 2.0, 6700 + n));
          else if (t < 0.8) { fireRing(scene, cx + 2.4, yz + 2.2); d.built.push(lanternPost(scene, cx + 3.8, yz + 1.2, night, night)); } // somebody's sitting up by the fire
          else tires(scene, lx1 - 2, yz + 1.4, 3);
          if (r() > 0.7) drum(scene, lx0 + 1.4, hz, r() > 0.5);
          if (r() > 0.8) solarPanels(scene, cx, 2.9, hz, 2, 1);
          if (r() > 0.6) d.roamers.push({ sprite: 'chicken', frames: [], x: cx, z: yz + 2, area: [lx0 + 1.2, yz + 0.6, lx1 - 1.2, ye - 0.4], speed: 0.9, height: 0.34 });
        }
      }

      // ------------------------------------------------ what didn't stand: the old warehouse, picked to the bones
      ruinWall(scene, 118, 40, 9, 3.4, 0, seed());
      ruinWall(scene, 113.6, 46, 8, 2.6, Math.PI / 2, seed());
      rubble(scene, 120, 46, 1.6, seed()); rubble(scene, 124, 51, 1.2, seed());

      // ------------------------------------------------ the boulevard
      for (const x of [14, 40, 66, 92, 118]) d.built.push(lanternPost(scene, x, BLVD.z0 - 1.6, night, night));
      for (const [x, z] of [[20, 30], [80, 30], [50, 78], [110, 78]] as Array<[number, number]>) d.built.push(lanternPost(scene, x + 1.8, z - 1.6, night, night));
      boardSign(scene, 128, 55.4, 'LAKE RD >', -0.1, 61);
      carHulk(scene, 36, 61.4, 3.1, seed()); carHulk(scene, 100, 58.4, 0.08, seed());
      powerLine(scene, [[0.6, 55.6, -0.03], [26, 55.4, 0.04], [52, 55.6, -0.05], [78, 55.4, 0.03], [104, 55.6, 0.05], [131.4, 55.4, -0.02]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);

      // ------------------------------------------------ brush and open ground
      brushFill(d, 61, 1);
      for (const [x, z, s] of [[30, 66, 0.9], [96, 70, 1.0], [8, 36, 0.8], [126, 34, 1.0]] as Array<[number, number, number]>) nopal(scene, x, z, s, seed());
      openScatter(d, 79, ['x', 's'], 0.3, (x, z) => !(z > BLVD.z0 - 3 && z < BLVD.z1 + 3));

      // ------------------------------------------------ things
      d.things.push(
        { x: MAST.x, z: MAST.z + 2.4, r: 2.6, label: 'Mast', lines: ['A radio mast, its dishes gone. At the top, a lantern.', 'There are fresh scuffs on the rungs.'] },
        { x: TURBINE.x, z: TURBINE.z + 1.6, r: 2.0, label: 'Turbine', lines: ['A car’s fan on a pole, a road sign for a tail. It turns. A wire runs down to a box.'] },
        { x: 118, z: 42, r: 2.6, label: 'Wall', lines: ['One wall of something big, standing alone. Everything that could be carried away has been.'] },
      );
      void colMat;
    },
  };
}
