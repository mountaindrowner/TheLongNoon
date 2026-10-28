import * as THREE from 'three';
import { section, sectionGrid, regionPaint, type Grid, type RGB, type SectionSpec } from './section';
import { currentChunk, useChunk, hitsSolid, type Chunk } from './world';
import { checkDoors, clearDoorMarks, doorMarks, type DoorMark } from './doorway';
import { LightPool, type Lamp } from './kit';
import { motes, pruneSways } from './foliage';
import { planeGeo } from './geo';
import type { Area, NPC, Roamer, Spot, Thing, Trigger } from './area';
import type { Mood } from './mood';

/**
 * A region (docs/design/world-methodology.md §2.4, option C): a web of maps
 * laid out on one ground and walked between with no cut. Each map is still
 * its own section (its own hero, routine, signature and edges) and can be
 * any size: a road long in the direction of travel, a town twice the size of
 * a farm. Between the maps is brush you can't walk; the maps meet where a
 * road runs from one into the next.
 *
 * How the seams disappear:
 * - every map's glyph grid is drawn first, and a map's lookups past its own
 *   edge read whichever map lies there, so a road, its paint and its level
 *   carry straight across;
 * - base terrain noise is sampled in region coordinates;
 * - an exit whose target is another map in the region is a seam: the edge is
 *   cut open there and you walk straight on (no trigger, no dissolve). A side
 *   two maps share completely can use edge style 'none' and be open its whole length;
 * - the region, not the map, fills the gaps: aprons cover every 4-unit square
 *   no map covers.
 *
 * Streaming: only the maps near the player exist. A map is built when you
 * come within LOAD units of it (its work spread over a few frames) and taken
 * down past DROP. People, lamps and anything a region registers per map come
 * and go with it (`onChange`, `dropPiece`).
 *
 * Lights: every point light a map builds becomes a lamp in one shared
 * LightPool (spec §5: many lamps, few lights).
 */

export interface RegionPiece {
  /** Where the map's top-left corner sits in the region (world units). */
  at: [number, number];
  spec: SectionSpec;
}

export interface RegionSpec {
  id: string;
  title: string;
  sub: string;
  mood: Mood;
  pieces: RegionPiece[];
  heightSeed: number;
  start: Spot;
  /** Land beyond and between the maps. */
  apron: THREE.Texture;
  /** Called after each map builds (shift region-specific registries into world space…). */
  afterPiece?(piece: BuiltPiece): void;
  /** Called when a map is taken down (forget what afterPiece registered). */
  dropPiece?(piece: BuiltPiece): void;
  /** How many pooled lights the region gets. */
  lights?: number;
  /** Streaming distances from a map's edge (default 26 to build, 44 to drop). */
  load?: number;
  drop?: number;
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
  /** The map's things, people, roamers, triggers and spawns, in region coordinates. */
  things: Thing[];
  npcs: NPC[];
  roamers: Roamer[];
  triggers: Trigger[];
  doorIssues: string[];
  /** Every door the map built (lit, shut or boarded), in region coordinates: where people go in at Shutter. */
  doors: DoorMark[];
}

/** A map of the region, built or not: its place and size are always known. */
export interface PiecePlan { id: string; title: string; sub: string; ox: number; oz: number; cols: number; rows: number }

export interface Region extends Area {
  /** Every map in the region, built or not. */
  plan: PiecePlan[];
  /** The maps built right now. */
  pieces: BuiltPiece[];
  /** The map a point lies in (for name tags, music, encounters). */
  pieceAt(x: number, z: number): PiecePlan | null;
  /** Door promises broken in any map built so far. */
  doorIssues: string[];
  /** Build every map within reach of (x, z) now, and wait for them. */
  settle(x: number, z: number): Promise<void>;
  /** Build every map in the region (the overview). */
  buildAll(): Promise<void>;
  /** Build each map in turn, check its door promises, and take it down again unless it's near (x, z). */
  checkEach(x: number, z: number): Promise<string[]>;
  /** Make sure a spawn (`map:name`) exists: build its map and what's around it. */
  prepare(spawn: string): Promise<void>;
  /** Resolves when no map is being built (other worlds can then be built safely). */
  idle(): Promise<void>;
  /** How long each map took to build, last time (ms, wall clock, including paced pauses). */
  buildMs: Record<string, number>;
  /** While set, nothing is taken down (checks and the overview build everything at once). */
  hold: boolean;
  /** Told whenever a map is built or taken down. */
  onChange?: (added: BuiltPiece | null, removed: BuiltPiece | null) => void;
  /** The ground's colour at a point, as its map paints it (for the mini map); null past every map's edge. */
  groundColor(x: number, z: number): RGB | null;
  /** Add a lamp to the region's shared light pool (a scene's fire), or take a tag's lamps away again. */
  addLamp(l: Lamp): void;
  dropLamps(tag: string): void;
}

const inside = (p: PiecePlan, x: number, z: number): boolean => x >= p.ox && x < p.ox + p.cols && z >= p.oz && z < p.oz + p.rows;
const distTo = (p: PiecePlan, x: number, z: number): number => Math.hypot(Math.max(p.ox - x, 0, x - (p.ox + p.cols)), Math.max(p.oz - z, 0, z - (p.oz + p.rows)));
/** Let a frame through (a build in progress hands the browser back its turn). */
const nextFrame = (): Promise<void> => new Promise((res) => setTimeout(res, 0));

export async function buildRegion(scene: THREE.Scene, night: boolean, r: RegionSpec): Promise<Region> {
  const LOAD = r.load ?? 26, DROP = r.drop ?? 44;
  const plan: PiecePlan[] = r.pieces.map((p) => ({ id: p.spec.id, title: p.spec.title, sub: p.spec.sub, ox: p.at[0], oz: p.at[1], cols: p.spec.cols, rows: p.spec.rows }));
  const ids = new Set(plan.map((p) => p.id));
  const planAt = (x: number, z: number): PiecePlan | null => plan.find((p) => inside(p, x, z)) ?? null;

  // 1. every map's grid first, so neighbours can read across seams
  const grids = new Map<string, Grid>();
  const specs = new Map<string, SectionSpec>();
  const cellAt = (wx: number, wz: number): string => {
    const p = planAt(wx, wz);
    const g = p && grids.get(p.id);
    return g ? g.get(Math.floor(wx - p.ox), Math.floor(wz - p.oz)) : '#';
  };
  r.pieces.forEach((p, i) => {
    const pl = plan[i]!;
    const spec: SectionSpec = {
      ...p.spec, origin: [pl.ox, pl.oz], heightSeed: r.heightSeed, aprons: false, noMotes: true,
      exits: p.spec.exits.map((e) => (ids.has(e.to) ? { ...e, seam: true } : e)),
      outside: (x, z) => cellAt(x + pl.ox, z + pl.oz),
    };
    specs.set(pl.id, spec);
    grids.set(pl.id, sectionGrid(spec));
  });

  // 2. aprons: every 4-unit square in and around the region that no map covers, in runs along each row
  const T = 4;
  const x0 = Math.min(...plan.map((p) => p.ox)) - 2 * T, x1 = Math.max(...plan.map((p) => p.ox + p.cols)) + 2 * T;
  const z0 = Math.min(...plan.map((p) => p.oz)) - 2 * T, z1 = Math.max(...plan.map((p) => p.oz + p.rows)) + 2 * T;
  const apronMat = new THREE.MeshStandardMaterial({ map: r.apron, roughness: 1 });
  const covered = (ax: number, az: number): boolean => plan.some((p) => ax + T > p.ox && ax < p.ox + p.cols && az + T > p.oz && az < p.oz + p.rows);
  for (let az = z0; az < z1; az += T) {
    let run = -1;
    for (let ax = x0; ax <= x1; ax += T) {
      const free = ax < x1 && !covered(ax, az);
      if (free && run < 0) run = ax;
      if (!free && run >= 0) {
        const a = new THREE.Mesh(planeGeo(ax - run + 0.02, T + 0.02), apronMat);
        a.rotation.x = -Math.PI / 2;
        a.position.set((run + ax) / 2, 0.66, az + T / 2);
        a.receiveShadow = true;
        scene.add(a);
        run = -1;
      }
    }
  }

  // 3. the light pool and the air, shared by every map
  const pool = new LightPool(scene, r.lights ?? 10);
  const dust = motes(scene, night);

  // 4. building and taking down maps
  const built = new Map<string, BuiltPiece>();
  const buildMs: Record<string, number> = {};
  const building = new Map<string, Promise<BuiltPiece>>();
  let streaming = false; // pace builds over frames once the first view is up
  const shift = <T extends { x: number; z: number }>(b: { ox: number; oz: number }, o: T): T => ({ ...o, x: o.x + b.ox, z: o.z + b.oz });

  async function build(pl: PiecePlan): Promise<BuiltPiece> {
    const t0 = performance.now();
    const spec = specs.get(pl.id)!;
    const group = new THREE.Group();
    group.position.set(pl.ox, 0, pl.oz);
    clearDoorMarks();
    // the section kit adds to whatever it's given; a group placed in the region is enough
    const area = await section(spec, grids.get(pl.id)!, streaming ? nextFrame : undefined)(group as unknown as THREE.Scene, night);
    const chunk = currentChunk();
    const doorIssues = checkDoors(area).map((i) => `${pl.id}: ${i}`);
    const doors = doorMarks().map((m) => ({ ...m, x: m.x + pl.ox, z: m.z + pl.oz }));
    clearDoorMarks();
    // its point lights become lamps in the pool
    group.traverse((o) => {
      const l = o as THREE.PointLight;
      if (!l.isPointLight) return;
      l.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld);
      if (l.intensity > 0) pool.add({ pos, color: l.color.clone(), intensity: l.intensity, dist: l.distance || 6, flicker: 0.12, tag: pl.id });
    });
    const dead: THREE.Object3D[] = [];
    group.traverse((o) => { if ((o as THREE.PointLight).isPointLight) dead.push(o); });
    for (const l of dead) l.parent?.remove(l);
    const bp: BuiltPiece = {
      ...pl, grid: grids.get(pl.id)!, area, chunk, group, doorIssues, doors,
      things: area.things.map((t) => ({ ...shift(pl, t), go: t.go })),
      npcs: area.npcs.map((n) => ({
        ...shift(pl, n),
        wander: n.wander && [n.wander[0] + pl.ox, n.wander[1] + pl.oz, n.wander[2] + pl.ox, n.wander[3] + pl.oz],
        guard: n.guard && { ...n.guard, x0: n.guard.x0 + pl.ox, x1: n.guard.x1 + pl.ox, z0: n.guard.z0 + pl.oz, z1: n.guard.z1 + pl.oz, back: [n.guard.back[0] + pl.ox, n.guard.back[1] + pl.oz] as [number, number] },
      })),
      roamers: (area.roamers ?? []).map((ro) => ({ ...shift(pl, ro), area: [ro.area[0] + pl.ox, ro.area[1] + pl.oz, ro.area[2] + pl.ox, ro.area[3] + pl.oz] })),
      triggers: area.triggers.map((tr) => ({ ...tr, x0: tr.x0 + pl.ox, x1: tr.x1 + pl.ox, z0: tr.z0 + pl.oz, z1: tr.z1 + pl.oz })),
    };
    for (const issue of doorIssues) console.warn('[door promise]', issue);
    scene.add(group);
    built.set(pl.id, bp);
    buildMs[pl.id] = Math.round(performance.now() - t0);
    r.afterPiece?.(bp);
    refresh();
    region.onChange?.(bp, null);
    return bp;
  }

  function take(id: string): void {
    const bp = built.get(id);
    if (!bp) return;
    built.delete(id);
    scene.remove(bp.group);
    pool.drop(id);
    r.dropPiece?.(bp);
    pruneSways();
    // free what only this map used: its geometry, and big one-off textures (its painted ground)
    bp.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        const map = (mat as THREE.MeshStandardMaterial).map;
        const img = map?.image as { width?: number } | undefined;
        if (map && (img?.width ?? 0) > 512) { map.dispose(); mat.dispose(); }
      }
    });
    refresh();
    region.onChange?.(null, bp);
  }

  function ensure(pl: PiecePlan): Promise<BuiltPiece> {
    const b = built.get(pl.id);
    if (b) return Promise.resolve(b);
    let p = building.get(pl.id);
    if (!p) {
      p = build(pl).finally(() => building.delete(pl.id));
      building.set(pl.id, p);
    }
    return p;
  }

  /** Keep the maps near (x, z) built and the far ones down; one build at a time. */
  function stream(x: number, z: number): void {
    if (region.hold) return;
    for (const b of [...built.values()]) if (distTo(b, x, z) > DROP && !building.has(b.id)) take(b.id);
    if (building.size) return;
    const want = plan.filter((p) => !built.has(p.id) && distTo(p, x, z) < LOAD).sort((a, b) => distTo(a, x, z) - distTo(b, x, z))[0];
    if (want) void ensure(want);
  }

  // ---------------------------------------------------------------- queries in region space
  const things: Thing[] = [], npcs: NPC[] = [], roamers: Roamer[] = [], triggers: Trigger[] = [], doorIssues: string[] = [];
  const spawns: Record<string, Spot> = { start: r.start };
  // every map's spawns are known before it's built (they're where its exits are, or set in its dress, once built)
  function refresh(): void {
    things.length = npcs.length = roamers.length = triggers.length = doorIssues.length = 0;
    for (const b of built.values()) {
      things.push(...b.things); npcs.push(...b.npcs); roamers.push(...b.roamers); triggers.push(...b.triggers); doorIssues.push(...b.doorIssues);
      for (const [k, s] of Object.entries(b.area.spawns)) spawns[`${b.id}:${k}`] = shift(b, s);
    }
  }
  const builtAt = (x: number, z: number): BuiltPiece | null => { const p = planAt(x, z); return p ? built.get(p.id) ?? null : null; };
  const nearestBuilt = (x: number, z: number): BuiltPiece | null => {
    let best: BuiltPiece | null = null, bd = Infinity;
    for (const b of built.values()) { const d = distTo(b, x, z); if (d < bd) { bd = d; best = b; } }
    return best;
  };
  const focusLocal = new THREE.Vector3();

  const region: Region = {
    id: r.id,
    title: r.title,
    sub: r.sub,
    kind: 'home',
    region: r.id,
    mood: r.mood,
    sky: true,
    cam: { x0: x0 + 2 * T + 8.2, x1: x1 - 2 * T - 8.2, z0: z0 + 2 * T + 4.4, z1: z1 - 2 * T - 4.6 },
    plan,
    hold: false,
    buildMs,
    get pieces() { return [...built.values()]; },
    pieceAt: planAt,
    doorIssues,
    blocked(x, z, rad) {
      // each probe asks the map it falls in; past every map's edge, the nearest one (it knows its exits).
      // Ground that isn't built yet is never walkable.
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        const b = planAt(px, pz) ? builtAt(px, pz) : nearestBuilt(px, pz);
        if (!b) return true;
        useChunk(b.chunk);
        if (b.area.blocked(px - b.ox, pz - b.oz, 0)) return true;
      }
      const b = builtAt(x, z) ?? nearestBuilt(x, z);
      if (!b) return true;
      useChunk(b.chunk);
      return hitsSolid(x - b.ox, z - b.oz, rad);
    },
    ground(x, z) {
      const b = builtAt(x, z) ?? nearestBuilt(x, z);
      if (!b) return 0;
      useChunk(b.chunk);
      return b.area.ground(x - b.ox, z - b.oz);
    },
    water(x, z) { const b = builtAt(x, z); return !!b && !!b.area.water?.(x - b.ox, z - b.oz); },
    wild(x, z) { const b = builtAt(x, z); return !!b && !!b.area.wild?.(x - b.ox, z - b.oz); },
    spawns,
    triggers,
    things,
    npcs,
    roamers,
    async settle(x, z) {
      const near = plan.filter((p) => distTo(p, x, z) < LOAD).sort((a, b) => distTo(a, x, z) - distTo(b, x, z));
      for (const p of near) await ensure(p);
      streaming = true;
    },
    async buildAll() { for (const p of plan) await ensure(p); },
    async checkEach(x, z) {
      const issues: string[] = [];
      region.hold = true;
      for (const p of plan) {
        const had = built.has(p.id);
        const b = await ensure(p);
        issues.push(...b.doorIssues);
        if (!had && distTo(p, x, z) > DROP) take(p.id);
      }
      region.hold = false;
      return issues;
    },
    async prepare(key) {
      const id = key.split(':')[0]!;
      const p = plan.find((q) => q.id === id);
      if (p) await ensure(p);
      const s = spawns[key];
      if (s) await region.settle(s.x, s.z);
    },
    async idle() { while (building.size) await Promise.allSettled([...building.values()]); },
    addLamp(l) { pool.add(l); },
    dropLamps(tag) { pool.drop(tag); },
    groundColor(x, z) {
      const p = planAt(x, z);
      if (!p) return null;
      const lx = x - p.ox, lz = z - p.oz, g = grids.get(p.id)!.get(Math.floor(lx), Math.floor(lz));
      return specs.get(p.id)!.paint?.(g, lx, lz, 0.5) ?? regionPaint(g, lx, lz, 0.5) ?? null;
    },
    update(t, focus, camT) {
      stream(focus.x, focus.z);
      for (const b of built.values()) {
        focusLocal.set(focus.x - b.ox, focus.y, focus.z - b.oz);
        b.area.update(t, focusLocal, camT);
      }
      pool.update(t, camT);
      dust(t, focus);
    },
  };
  await region.settle(r.start.x, r.start.z);
  return region;
}
