import * as THREE from 'three';
import { T } from './textures';
import { box, decal, prism, texMat, colMat, shade, planeGeo } from './geo';
import { addSolid, heightAt } from './world';
import { rng } from './noise';
import { dressDoor, markDoor, type DoorState } from './doorway';

/**
 * Shared materials and building recipes. The spec's appendix imports `M`,
 * `vines`, `windowAt` and `Built` from a buildings module it doesn't list;
 * this supplies them, plus a general building builder in the spec's
 * language (§7): primitives only, world-unit UVs, trim thick enough to read,
 * weathering that tells time, and every door dressed by the door language (§12).
 */

/** Anything with a per-frame routine (an animated prop, a flickering lamp). */
export interface Built { update?(t: number): void }

export const M = {
  wood: () => texMat('oldWood', T.oldWood()),
  grey: () => texMat('greyBoards', T.greyBoards()),
  white: () => texMat('whiteSiding', T.whiteSiding()),
  red: () => texMat('barnRed', T.barnRed()),
  deck: () => texMat('deck', T.deck()),
  tin: () => texMat('corrugated', T.corrugated(), { metalness: 0.3, roughness: 0.7 }),
  steel: () => texMat('steel', T.steel(), { metalness: 0.35, roughness: 0.65 }),
  tank: () => texMat('rustTank', T.rustTank(), { metalness: 0.25, roughness: 0.7 }),
  rust: () => texMat('rustTank', T.rustTank(), { metalness: 0.25, roughness: 0.7 }),
  bin: () => texMat('binRibs', T.binRibs(), { metalness: 0.3, roughness: 0.6 }),
  concrete: () => texMat('concrete', T.concrete()),
  brick: () => texMat('brick', T.brick()),
  shingles: () => texMat('shingles', T.shingles()),
  hay: () => texMat('hay', T.hay()),
  hazard: () => texMat('hazard', T.hazard()),
  vine: () => texMat('vines', T.vines(), { alphaTest: 0.5, side: THREE.DoubleSide }),
  dark: () => colMat('#0d0c0b', { roughness: 1 }),
};

/** A climbing-vine decal on a wall facing +z (life over ruin): (x, y, z) is its bottom-centre. */
export function vines(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, rotY = 0): void {
  parent.add(decal(w, h, M.vine(), x, y, z, rotY));
}

/** A window decal on a wall facing +z: glass, lit glass, or boarded. */
export function windowAt(parent: THREE.Object3D, x: number, y: number, z: number, kind: 'glass' | 'lit' | 'boarded' = 'glass', w = 0.8, h = 0.8): void {
  const map = kind === 'lit' ? T.glassLit() : kind === 'boarded' ? T.boarded() : T.glass();
  const mat = kind === 'lit'
    ? new THREE.MeshStandardMaterial({ map, emissive: '#ffb867', emissiveMap: map, emissiveIntensity: 1.2, roughness: 0.6 })
    : new THREE.MeshStandardMaterial({ map, roughness: kind === 'glass' ? 0.25 : 1, metalness: kind === 'glass' ? 0.2 : 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z + 0.02);
  parent.add(m);
  // a sill: thick trim reads at the camera's distance
  parent.add(box(w + 0.14, 0.07, 0.1, M.wood(), x, y - h / 2 - 0.07, z + 0.04));
}

export interface DoorSpec {
  x: number; w?: number; h?: number; state: DoorState; fresh?: boolean;
  /** A region's own way of dressing this door (its light, its leaf), in the building's local
   *  space: bottom-centre (x, 0, z) on a wall facing +z. Still marked with `state` for the promise check. */
  dress?: (g: THREE.Object3D, x: number, z: number, w: number, h: number) => Built;
}
export interface BuildingSpec {
  x: number; z: number; w: number; d: number; h: number;
  /** A shared material key, or any material (a region's own wall texture). */
  wall: keyof typeof M | THREE.Material;
  roof: 'gable' | 'flat' | 'shed';
  roofMat?: keyof typeof M;
  /** Front (+z, facing the camera) door(s), x relative to the centre. */
  doors?: DoorSpec[];
  windows?: Array<{ x: number; y?: number; kind?: 'glass' | 'lit' | 'boarded'; w?: number; h?: number }>;
  /** Vines climbing the front: x offsets. */
  vines?: number[];
  seed?: number;
}

/**
 * A building in the spec's language: walls, a roof (gable with shingles, a
 * flat parapet roof, or a lean-to shed roof), a concrete footing, eave trim,
 * windows and doors on the camera-facing front, vines at the foot. Registers
 * its footprint and returns its door routines.
 */
export function building(scene: THREE.Scene, b: BuildingSpec, night: boolean): Built[] {
  const r = rng(b.seed ?? 7);
  const g = new THREE.Group();
  const y0 = heightAt(b.x, b.z);
  g.position.set(b.x, y0, b.z);
  scene.add(g);
  const wall = typeof b.wall === 'string' ? M[b.wall]() : b.wall;
  g.add(box(b.w + 0.24, 0.22, b.d + 0.24, M.concrete(), 0, -0.12, 0)); // footing
  g.add(box(b.w, b.h, b.d, wall, 0, 0, 0));
  g.add(box(b.w + 0.1, 0.12, 0.12, M.wood(), 0, b.h - 0.12, b.d / 2 + 0.02)); // eave trim
  const roof = M[b.roofMat ?? (b.roof === 'gable' ? 'shingles' : 'tin')]();
  if (b.roof === 'gable') {
    const rise = Math.min(1.6, b.d * 0.32), over = 0.35;
    const s = new THREE.Shape();
    s.moveTo(-b.d / 2 - over, 0); s.lineTo(0, rise); s.lineTo(b.d / 2 + over, 0); s.lineTo(b.d / 2 + over, -0.12); s.lineTo(0, rise - 0.14); s.lineTo(-b.d / 2 - over, -0.12); s.closePath();
    const p = prism(s, b.w + over * 2, roof);
    p.rotation.y = Math.PI / 2;
    p.position.y = b.h;
    g.add(p);
    // gable ends
    for (const sx of [-1, 1]) {
      const end = prism(new THREE.Shape([new THREE.Vector2(-b.d / 2, 0), new THREE.Vector2(b.d / 2, 0), new THREE.Vector2(0, rise - 0.05)]), 0.05, wall);
      end.rotation.y = Math.PI / 2;
      end.position.set(sx * (b.w / 2 - 0.03), b.h, 0);
      g.add(end);
    }
  } else if (b.roof === 'shed') {
    const p = box(b.w + 0.5, 0.1, b.d + 0.6, roof, 0, b.h, 0.1);
    p.rotation.x = 0.16;
    g.add(p);
  } else {
    g.add(box(b.w, 0.06, b.d, roof, 0, b.h, 0));
    for (const [w, d, x, z] of [[b.w + 0.1, 0.18, 0, b.d / 2], [b.w + 0.1, 0.18, 0, -b.d / 2], [0.18, b.d, b.w / 2, 0], [0.18, b.d, -b.w / 2, 0]] as Array<[number, number, number, number]>)
      g.add(box(w, 0.32, d, M.concrete(), x, b.h, z)); // parapet
  }
  const built: Built[] = [];
  for (const wdw of b.windows ?? []) windowAt(g, wdw.x, wdw.y ?? b.h * 0.55, b.d / 2, wdw.kind ?? 'glass', wdw.w, wdw.h);
  for (const dr of b.doors ?? []) {
    const w = dr.w ?? 1.1, h = dr.h ?? 1.95;
    built.push(dr.dress ? dr.dress(g, dr.x, b.d / 2 + 0.01, w, h) : dressDoor(g, dr.x, 0, b.d / 2 + 0.01, w, h, dr.state, night, 0, { fresh: dr.fresh }));
    markDoor(b.x + dr.x, b.z + b.d / 2, dr.state);
  }
  for (const vx of b.vines ?? []) vines(g, vx, 0, b.d / 2 + 0.03, 0.9 + r() * 0.8, 0.9 + r() * 1.3);
  addSolid(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2);
  shade(g);
  return built;
}

/** A plane laid on the ground (stains, rugs, shadows) at the terrain height. */
export function groundDecal(scene: THREE.Scene, x: number, z: number, w: number, d: number, mat: THREE.Material): void {
  const m = new THREE.Mesh(planeGeo(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, heightAt(x, z) + 0.02, z);
  m.receiveShadow = true;
  scene.add(m);
}

/** Place a group at the terrain height and add it. */
export function put<T extends THREE.Object3D>(scene: THREE.Scene, o: T, x: number, z: number, rotY = 0): T {
  o.position.set(x, heightAt(x, z), z);
  o.rotation.y = rotY;
  scene.add(o);
  return o;
}
