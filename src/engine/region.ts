import * as THREE from 'three';
import { section, sectionGrid, type Grid, type SectionSpec, type Side } from './section';
import { currentChunk, useChunk, hitsSolid, type Chunk } from './world';
import { checkDoors, clearDoorMarks } from './doorway';
import { LightPool } from './kit';
import { motes } from './foliage';
import { planeGeo } from './geo';
import type { Area, NPC, Roamer, Spot, Thing, Trigger } from './area';
import type { Mood } from './mood';

/**
 * A region (docs/design/world-methodology.md §2.4, option C): sections laid
 * side by side on a grid and walked between with no cut. Each section is
 * still its own map, designed and built with the section kit (its own
 * hero, routine, signature and edges), so any of them can be split out and
 * joined by a dissolve instead if the open version doesn't feel right.
 *
 * How the seams disappear:
 * - every section's glyph grid is drawn first, and a section's lookups past
 *   its own edge read its neighbour's ground, so roads, paint and height
 *   flattening carry straight across;
 * - base terrain noise is sampled in region coordinates;
 * - sides with a neighbour use edge style 'none' (no frame, no berm) and stay walkable;
 * - the region, not the section, frames the outside: aprons fill every empty
 *   cell around it, level with the framed edges' berm.
 *
 * Lights: every point light the sections build becomes a lamp in one shared
 * LightPool (spec §5: many lamps, few lights), so a whole lit town costs a
 * fixed number of lights.
 */

export interface RegionPiece {
  /** Grid cell in the region (each cell is one section). */
  at: [number, number];
  spec: SectionSpec;
}

export interface RegionSpec {
  id: string;
  title: string;
  sub: string;
  mood: Mood;
  /** Section size in world units; every piece shares it so seams line up. */
  cell: [number, number];
  pieces: RegionPiece[];
  heightSeed: number;
  start: Spot;
  /** Land beyond the region's edge. */
  apron: THREE.Texture;
  /** Called after each piece builds (shift region-specific registries into world space…). */
  afterPiece?(piece: BuiltPiece): void;
  /** How many pooled lights the region gets. */
  lights?: number;
}

export interface BuiltPiece {
  id: string;
  title: string;
  sub: string;
  ox: number;
  oz: number;
  cols: number;
  rows: number;
  grid: Grid;
  area: Area;
  chunk: Chunk;
  group: THREE.Group;
}

export interface Region extends Area {
  pieces: BuiltPiece[];
  /** The section a point lies in (for name tags, music, encounters). */
  pieceAt(x: number, z: number): BuiltPiece | null;
  doorIssues: string[];
}

const SIDES: Array<[Side, number, number]> = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];

export async function buildRegion(scene: THREE.Scene, night: boolean, r: RegionSpec): Promise<Region> {
  const [CW, CH] = r.cell;
  const at = new Map<string, RegionPiece>();
  for (const p of r.pieces) at.set(p.at.join(','), p);
  const has = (cx: number, cz: number): boolean => at.has(`${cx},${cz}`);

  // 1. every section's grid, so neighbours can read across seams
  const grids = new Map<RegionPiece, Grid>();
  const cellAt = (wx: number, wz: number): string => {
    const cx = Math.floor(wx / CW), cz = Math.floor(wz / CH);
    const p = at.get(`${cx},${cz}`);
    const g = p && grids.get(p);
    return g ? g.get(Math.floor(wx - cx * CW), Math.floor(wz - cz * CH)) : '#';
  };
  for (const p of r.pieces) {
    const [cx, cz] = p.at;
    const edges = { ...p.spec.edges };
    for (const [side, dx, dz] of SIDES) if (has(cx + dx, cz + dz)) edges[side] = 'none';
    p.spec = {
      ...p.spec, edges, origin: [cx * CW, cz * CH], heightSeed: r.heightSeed, aprons: false, noMotes: true,
      cols: CW, rows: CH,
      outside: (x, z) => cellAt(x + cx * CW, z + cz * CH),
    };
    grids.set(p, sectionGrid(p.spec));
  }

  // 2. build each section in its own group, offset into place
  const built: BuiltPiece[] = [];
  const doorIssues: string[] = [];
  for (const p of r.pieces) {
    const [cx, cz] = p.at;
    const group = new THREE.Group();
    group.position.set(cx * CW, 0, cz * CH);
    scene.add(group);
    clearDoorMarks();
    // the section kit adds to whatever it's given; a group placed in the region is enough
    const area = await section(p.spec, grids.get(p)!)(group as unknown as THREE.Scene, night);
    const bp: BuiltPiece = { id: p.spec.id, title: p.spec.title, sub: p.spec.sub, ox: cx * CW, oz: cz * CH, cols: CW, rows: CH, grid: grids.get(p)!, area, chunk: currentChunk(), group };
    for (const issue of checkDoors(area)) doorIssues.push(issue);
    clearDoorMarks();
    built.push(bp);
    r.afterPiece?.(bp);
  }

  // 3. aprons: every empty cell in and around the region's grid, level with the framed edges' berm
  const cxs = r.pieces.map((p) => p.at[0]), czs = r.pieces.map((p) => p.at[1]);
  const apronMat = new THREE.MeshStandardMaterial({ map: r.apron, roughness: 1 });
  for (let cz = Math.min(...czs) - 1; cz <= Math.max(...czs) + 1; cz++)
    for (let cx = Math.min(...cxs) - 1; cx <= Math.max(...cxs) + 1; cx++) {
      if (has(cx, cz)) continue;
      const a = new THREE.Mesh(planeGeo(CW + 0.02, CH + 0.02), apronMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(cx * CW + CW / 2, 0.66, cz * CH + CH / 2);
      a.receiveShadow = true;
      scene.add(a);
    }

  // 4. one light pool for the whole region; every built point light becomes a lamp in it
  const pool = new LightPool(scene, r.lights ?? 10);
  const lights: THREE.PointLight[] = [];
  scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
  const own = new Set<THREE.Object3D>();
  scene.children.forEach((c) => { if ((c as THREE.PointLight).isPointLight) own.add(c); });
  for (const l of lights) {
    if (own.has(l)) continue; // the pool's own lights
    l.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld);
    if (l.intensity > 0) pool.add({ pos, color: l.color.clone(), intensity: l.intensity, dist: l.distance || 6, flicker: 0.12 });
    l.parent?.remove(l);
  }
  const dust = motes(scene, night);

  // ---------------------------------------------------------------- queries in region space
  const pieceAt = (x: number, z: number): BuiltPiece | null => {
    const cx = Math.floor(x / CW), cz = Math.floor(z / CH);
    return built.find((b) => b.ox === cx * CW && b.oz === cz * CH) ?? null;
  };
  const nearestPiece = (x: number, z: number): BuiltPiece =>
    built.reduce((best, b) => {
      const d = Math.hypot(Math.max(b.ox - x, 0, x - (b.ox + CW)), Math.max(b.oz - z, 0, z - (b.oz + CH)));
      const bd = Math.hypot(Math.max(best.ox - x, 0, x - (best.ox + CW)), Math.max(best.oz - z, 0, z - (best.oz + CH)));
      return d < bd ? b : best;
    });
  const shift = <T extends { x: number; z: number }>(b: BuiltPiece, o: T): T => ({ ...o, x: o.x + b.ox, z: o.z + b.oz });

  const things: Thing[] = [], npcs: NPC[] = [], roamers: Roamer[] = [], triggers: Trigger[] = [];
  const spawns: Record<string, Spot> = { start: r.start };
  for (const b of built) {
    for (const t of b.area.things) things.push({ ...shift(b, t), go: t.go });
    for (const n of b.area.npcs) npcs.push({ ...shift(b, n), wander: n.wander && [n.wander[0] + b.ox, n.wander[1] + b.oz, n.wander[2] + b.ox, n.wander[3] + b.oz] });
    for (const ro of b.area.roamers ?? []) roamers.push({ ...shift(b, ro), area: [ro.area[0] + b.ox, ro.area[1] + b.oz, ro.area[2] + b.ox, ro.area[3] + b.oz] });
    for (const tr of b.area.triggers) triggers.push({ ...tr, x0: tr.x0 + b.ox, x1: tr.x1 + b.ox, z0: tr.z0 + b.oz, z1: tr.z1 + b.oz });
    for (const [k, s] of Object.entries(b.area.spawns)) spawns[`${b.id}:${k}`] = shift(b, s);
  }
  const xs = built.map((b) => b.ox), zs = built.map((b) => b.oz);
  const focusLocal = new THREE.Vector3();

  return {
    id: r.id,
    title: r.title,
    sub: r.sub,
    kind: 'home',
    region: r.id,
    mood: r.mood,
    sky: true,
    cam: { x0: Math.min(...xs) + 8.2, x1: Math.max(...xs) + CW - 8.2, z0: Math.min(...zs) + 4.4, z1: Math.max(...zs) + CH - 4.6 },
    pieces: built,
    pieceAt,
    doorIssues,
    blocked(x, z, rad) {
      // each probe asks the section it falls in (or the nearest, past the region's edge: that one knows its exits)
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        const b = pieceAt(px, pz) ?? nearestPiece(px, pz);
        useChunk(b.chunk);
        if (b.area.blocked(px - b.ox, pz - b.oz, 0)) return true;
      }
      const b = pieceAt(x, z) ?? nearestPiece(x, z);
      useChunk(b.chunk);
      return hitsSolid(x - b.ox, z - b.oz, rad);
    },
    ground(x, z) {
      const b = pieceAt(x, z) ?? nearestPiece(x, z);
      useChunk(b.chunk);
      return b.area.ground(x - b.ox, z - b.oz);
    },
    water(x, z) { const b = pieceAt(x, z); return !!b && !!b.area.water?.(x - b.ox, z - b.oz); },
    wild(x, z) { const b = pieceAt(x, z); return !!b && !!b.area.wild?.(x - b.ox, z - b.oz); },
    spawns,
    triggers,
    things,
    npcs,
    roamers,
    update(t, focus, camT) {
      for (const b of built) {
        focusLocal.set(focus.x - b.ox, focus.y, focus.z - b.oz);
        b.area.update(t, focusLocal, camT);
      }
      pool.update(t, camT);
      dust(t, focus);
    },
  };
}
