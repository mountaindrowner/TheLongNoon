import * as THREE from 'three';
import { fbm, rng, vnoise } from './noise';
import { Pix } from './textures';
import { box, colMat } from './geo';
import { setWorld, hitsSolid, currentChunk, useChunk } from './world';
import { KM, LightPool, worldUV, type RGB } from './kit';
import type { Built } from './buildings';
import type { Mood } from './mood';
import type { Area, AreaBuilder, NPC, SectionKind, Spot, Thing, Trigger } from './area';
import { Grid } from './section';
import { dressDoor, markDoor } from './doorway';
import { pendant } from './kit';

/**
 * Interiors for Railhead Country's dungeons (the Grain Tower, the Roundhouse,
 * Ohm Depot), built the Cistern's way: a glyph grid, a painted floor, walls as
 * instanced cubes that drop low in front of the player (the HD-2D cutaway),
 * a pooled set of lamps. Glyphs: . floor · # wall · r debris/spill (wild
 * Ohms) · v void (a pit, blocked) · = steel grate over a void (walkable).
 */

/** Dusty daylight through high windows; the lamps do the rest. */
export const INSIDE: Mood = {
  night: true,
  sun: { color: '#ffd8a0', intensity: 0.9, from: new THREE.Vector3(-6, 14, 5) },
  hemi: { sky: '#9a8a70', ground: '#3a2e22', intensity: 2.1 },
  fog: { color: '#0c0906', density: 0.012 },
  exposure: 1.42,
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.7 },
  grade: { dull: 1.25, lush: 1.1, vignette: 0.58, shadowTint: [0.92, 0.94, 1.08], highTint: [1.12, 1.02, 0.86] },
  sprite: [0.95, 0.88, 0.8],
};

export type WallKind = 'concrete' | 'brick' | 'tin' | 'block' | 'boards';
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const wallCache = new Map<WallKind, THREE.Texture>();
function wallTex(kind: WallKind): THREE.Texture {
  const hit = wallCache.get(kind);
  if (hit) return hit;
  const W = 32, Hh = 48, p = new Pix(W, Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const up = Hh - 1 - y, n = vnoise(x * 0.4, y * 0.4, 11);
    let c: RGB;
    if (kind === 'brick') {
      const row = Math.floor(up / 4), off = (row % 2) * 4;
      const mortar = up % 4 === 0 || (x + off) % 8 === 0;
      c = mortar ? H('#6a6052') : mix(H('#8a4a36'), H('#6e3a2a'), n);
      if (vnoise(x * 0.2, y * 0.6, 5) > 0.72) c = mix(c, H('#2a2420'), 0.45); // soot
    } else if (kind === 'tin') {
      c = mix(H('#8a8c88'), H('#6a6c68'), (Math.sin(x * 1.6) + 1) / 2 * 0.6 + n * 0.4);
      if (fbm(x * 0.15, y * 0.15, 6, 3) > 0.58) c = mix(c, H('#8a4a2a'), 0.6); // rust
    } else if (kind === 'boards') {
      // painted board walls gone soft with age, a dado rail low down
      const seam = x % 6 === 0;
      c = seam ? H('#5a4a3a') : mix(H('#a8957a'), H('#968468'), n);
      if (up === 14 || up === 15) c = H('#6a5440');
      if (up < 14) c = mix(c, H('#7a6650'), 0.35);
    } else if (kind === 'block') {
      const mortar = up % 6 === 0 || (x + (Math.floor(up / 6) % 2) * 8) % 16 === 0;
      c = mortar ? H('#7a766c') : mix(H('#b8b0a0'), H('#a09888'), n);
      if (up < 10) c = mix(c, H('#7a6a50'), 0.3 * (1 - up / 10)); // grime at the foot
    } else {
      c = mix(H('#8a867a'), H('#6e6a60'), n);
      if (up % 12 === 0) c = mix(c, H('#4e4a42'), 0.6);
      if (vnoise(x * 1.2, y * 0.07, 12) > 0.74) c = mix(c, H('#4a4438'), 0.5);
    }
    p.set(x, y, c);
  }
  const t = p.texture();
  wallCache.set(kind, t);
  return t;
}

export interface InteriorDress {
  scene: THREE.Scene;
  root: THREE.Group;
  pool: LightPool;
  grid: Grid;
  r: () => number;
  seed(): number;
  /** A group that hides with its wall row when the cutaway drops it. */
  mount(row: number): THREE.Group;
  built: Built[];
  things: Thing[];
  npcs: NPC[];
  roamers: NonNullable<Area['roamers']>;
  triggers: Trigger[];
  spawns: Record<string, Spot>;
}

/** The way back out: a gap in the south wall with daylight in it (the door language: every way in is lit). */
export function exitDoor(d: InteriorDress, x: number, to: string, spawn: string, w = 1.6): void {
  const rows = d.grid.rows;
  d.spawns.door = { x, z: rows - 1.3, face: 'N' };
  d.triggers.push({ x0: x - 1.4, x1: x + 1.4, z0: rows - 0.2, z1: rows + 2, go: { to, spawn } });
  d.built.push(dressDoor(d.root, x, 0, rows - 0.04, w, 2.2, 'open', false, Math.PI, { daylight: true }));
  markDoor(x, rows - 0.1, 'open');
}

/** A lamp over a stairway or ladder (every way through is lit). */
export function stairLight(d: InteriorDress, x: number, z: number): void {
  pendant(d.root, d.pool, x, z, true);
  markDoor(x, z, 'open');
}

export interface InteriorSpec {
  id: string;
  title: string;
  sub: string;
  kind?: SectionKind;
  region?: string;
  cols: number;
  rows: number;
  seed: number;
  zone?: string;
  mood?: Mood;
  wall: WallKind;
  ground(g: Grid): void;
  /** Floor colour per texel (x, z in world units) for a non-wall glyph. */
  floor(glyph: string, x: number, z: number, fine: number): RGB;
  dress(d: InteriorDress): void | Promise<void>;
  start: Spot;
}

export function interior(spec: InteriorSpec): AreaBuilder {
  return async (scene) => {
    const { cols: COLS, rows: ROWS } = spec;
    const grid = new Grid(COLS, ROWS, '.');
    for (let x = 0; x < COLS; x++) { grid.set(x, 0, '#'); grid.set(x, ROWS - 1, '#'); }
    for (let z = 0; z < ROWS; z++) { grid.set(0, z, '#'); grid.set(COLS - 1, z, '#'); }
    spec.ground(grid);
    const get = (x: number, z: number): string => grid.get(x, z);
    setWorld({ cols: COLS, rows: ROWS, cell: (x, z) => (get(x, z) === 'r' ? 'T' : get(x, z) === '#' ? '#' : '.'), height: () => 0 });
    scene.background = new THREE.Color('#060504');
    const root = new THREE.Group();
    scene.add(root);
    const pool = new LightPool(scene, 12);

    // ---------------------------------------------------------- floor
    const S = 16, p = new Pix(COLS * S, ROWS * S);
    const fr = rng(spec.seed);
    for (let py = 0; py < ROWS * S; py++) for (let px = 0; px < COLS * S; px++) {
      const x = (px + 0.5) / S, z = (py + 0.5) / S, gl = get(Math.floor(x), Math.floor(z));
      if (gl === '#') { p.set(px, py, H('#0c0b0a')); continue; }
      if (gl === 'v') { p.set(px, py, mix(H('#050404'), H('#14110e'), vnoise(x * 3, z * 3, 9))); continue; }
      p.set(px, py, spec.floor(gl, x, z, fr()));
    }
    const ft = p.texture({ repeat: false, worldSize: false });
    ft.wrapS = ft.wrapT = THREE.ClampToEdgeWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(COLS / 2, 0, ROWS / 2);
    floor.receiveShadow = true;
    root.add(floor);

    // ---------------------------------------------------------- grates over the voids
    const grateMat = colMat('#4a5258', { metalness: 0.5, roughness: 0.5 });
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== '=') continue;
      root.add(box(1.0, 0.06, 1.0, grateMat, x + 0.5, 0.02, z + 0.5));
      for (let k = 0; k < 4; k++) root.add(box(1.0, 0.012, 0.04, colMat('#22262a'), x + 0.5, 0.085, z + 0.15 + k * 0.23));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
        if (get(x + dx, z + dz) !== 'v') continue;
        const ex = x + 0.5 + dx * 0.47, ez = z + 0.5 + dz * 0.47;
        root.add(box(0.05, 0.9, 0.05, KM.steel(), ex, 0.06, ez));
        root.add(box(dx === 0 ? 1.0 : 0.04, 0.04, dx === 0 ? 0.04 : 1.0, KM.steel(), ex, 0.96, ez));
      }
    }

    // ---------------------------------------------------------- walls (cutaway)
    const TALL = 2.9, LOW = 0.6;
    const walls: Array<{ x: number; z: number; front: boolean }> = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== '#') continue;
      let near = false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = get(x + dx, z + dz); if (c !== '#' && grid.inb(x + dx, z + dz)) near = true; }
      if (near) walls.push({ x, z, front: z === ROWS - 1 });
    }
    const side = worldUV(new THREE.MeshStandardMaterial({ map: wallTex(spec.wall), roughness: 0.9 }));
    const cap = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 });
    const wg = new THREE.BoxGeometry(1.02, 1, 1.02);
    wg.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(wg, [side, side, cap, cap, side, side], Math.max(1, walls.length));
    im.castShadow = im.receiveShadow = true;
    root.add(im);
    const rowH = new Map<number, number>();
    for (let z = 0; z < ROWS; z++) rowH.set(z, TALL);
    const m4 = new THREE.Matrix4();
    const writeWalls = (): void => {
      walls.forEach((w, i) => { m4.makeScale(1, w.front ? LOW : rowH.get(w.z)!, 1).setPosition(w.x + 0.5, 0, w.z + 0.5); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    };
    writeWalls();
    const mounts: Array<{ row: number; obj: THREE.Object3D }> = [];

    const r = rng(spec.seed * 7 + 1);
    let seedN = spec.seed * 100;
    const d: InteriorDress = {
      scene, root, pool, grid, r,
      seed: () => seedN++,
      mount(row) { const g = new THREE.Group(); root.add(g); mounts.push({ row, obj: g }); return g; },
      built: [], things: [], npcs: [], roamers: [], triggers: [], spawns: {},
    };
    // debris piles on the wild cells
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== 'r' || r() > 0.45) continue;
      const pile = new THREE.Mesh(new THREE.SphereGeometry(0.28 + r() * 0.22, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), colMat(spec.wall === 'concrete' ? '#a8884a' : '#6a5a48', { roughness: 1 }));
      pile.scale.y = 0.4;
      pile.position.set(x + r(), 0, z + r());
      root.add(pile);
    }
    await spec.dress(d);

    // this room's own solids: other worlds may have been built (and made current) since
    const chunk = currentChunk();
    const blocked = (x: number, z: number, rad: number): boolean => {
      useChunk(chunk);
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        if (px < 0 || px > COLS) return true;
        if (pz < -2 || pz > ROWS + 2) return true;
        if (pz < 0 || pz >= ROWS) continue; // stepping out through a door
        const c = get(Math.floor(px), Math.floor(pz));
        if (c === '#' || c === 'v') return true;
      }
      return hitsSolid(x, z, rad);
    };
    const cam = { x0: COLS > 19 ? 9.5 : COLS / 2, x1: COLS > 19 ? COLS - 9.5 : COLS / 2, z0: ROWS > 12 ? 6.0 : ROWS / 2, z1: ROWS > 12 ? ROWS - 5.5 : ROWS / 2 };
    return {
      id: spec.id,
      title: spec.title,
      sub: spec.sub,
      kind: spec.kind ?? 'dungeon',
      region: spec.region ?? 'bunker',
      mood: spec.mood ?? INSIDE,
      sky: false,
      cam,
      blocked,
      ground: () => 0,
      wild: (x, z) => get(Math.floor(x), Math.floor(z)) === 'r',
      zone: spec.zone,
      spawns: { ...d.spawns, start: spec.start },
      triggers: d.triggers,
      things: d.things,
      npcs: d.npcs,
      roamers: d.roamers,
      update(t, focus, camT) {
        let dirty = false;
        for (let z = 0; z < ROWS; z++) {
          const target = z + 0.5 > focus.z + 0.7 ? LOW : TALL;
          const h = rowH.get(z)!;
          if (Math.abs(h - target) > 0.002) { rowH.set(z, h + (target - h) * 0.14); dirty = true; }
        }
        if (dirty) writeWalls();
        for (const m of mounts) m.obj.visible = rowH.get(m.row)! > TALL * 0.8;
        pool.update(t, camT);
        for (const b of d.built) b.update?.(t);
      },
    };
  };
}
