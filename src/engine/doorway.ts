import * as THREE from 'three';
import { box, beam, colMat, planeGeo } from './geo';
import { onWorldReset } from './world';
import { M, type Built } from './buildings';
import type { Area } from './area';

/**
 * The door language (docs/design/design-philosophy.md §2b). Light is the
 * promise: a lit lamp at a door means you can go in, always. Planks mean
 * never; a chain means later, when the story gets there; a dead lamp over a
 * black doorway means it needs LUMEN.
 *
 * Every door a builder dresses is also marked in world space, so the game can
 * check its own promises: a lit door must lead somewhere, and every way in
 * must be lit (checkDoors, run on every area load in development).
 */

export type DoorState = 'open' | 'boarded' | 'chained' | 'dark';
export interface DoorMark { x: number; z: number; state: DoorState }

const marks: DoorMark[] = [];
onWorldReset(() => { marks.length = 0; });
/** Record a door at world (x, z) for the promise check. */
export function markDoor(x: number, z: number, state: DoorState): void { marks.push({ x, z, state }); }
export const doorMarks = (): readonly DoorMark[] => marks;

let poolTex: THREE.CanvasTexture | null = null;
function poolTexture(): THREE.CanvasTexture {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,214,150,0.9)');
  grd.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

/**
 * Dress a doorway in `parent`'s local space: (x, y, z) is the bottom-centre of
 * the opening on a wall facing +z (turned by rotY), w × h its size.
 * - open: warm light inside, a lamp on the wall by the door, light pooled on the step
 * - boarded: planks nailed across a shut door
 * - chained: a shut door with a chain and padlock across it (fresh = a new lock)
 * - dark: a black opening under a dead lamp
 */
export function dressDoor(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, state: DoorState, night: boolean, rotY = 0, opts: { fresh?: boolean; daylight?: boolean; noLeaf?: boolean } = {}): Built {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  if (state === 'open') {
    // warm light inside (or daylight, for a way back out of a dungeon)
    // (both faces: an exit is seen from inside the room, looking at the wall's back)
    const inside = new THREE.Mesh(planeGeo(w * 0.96, h * 0.96), colMat(opts.daylight ? '#fff2d0' : '#ffcf8a', { emissive: opts.daylight ? '#fff0c8' : '#ffb867', emissiveIntensity: opts.daylight ? 2.6 : night ? 2.6 : 1.5, side: THREE.DoubleSide }));
    inside.position.set(0, h * 0.48, -0.015);
    g.add(inside);
    let bulbMat: THREE.MeshStandardMaterial | null = null;
    if (!opts.daylight) {
      // the lamp: a bracket on the wall beside the door, a caged bulb, always lit
      g.add(box(0.06, 0.06, 0.32, M.steel(), w / 2 + 0.22, h + 0.12, 0.16));
      bulbMat = colMat('#ffe0a0', { emissive: '#ffb850', emissiveIntensity: night ? 6 : 2.2 }).clone();
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bulbMat);
      bulb.position.set(w / 2 + 0.22, h + 0.02, 0.3);
      g.add(bulb);
      const cage = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: '#2a2622', wireframe: true }));
      cage.position.copy(bulb.position);
      g.add(cage);
    }
    const light = new THREE.PointLight(opts.daylight ? '#fff0d0' : '#ffb867', night ? 7 : 2.4, 5.5, 1.6);
    light.position.set(0, h * 0.7, 0.7);
    g.add(light);
    // light pooled on the step
    const pool = new THREE.Mesh(planeGeo(w * 2.6, 2.4), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: opts.daylight ? 0.7 : night ? 0.55 : 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.03, 0.9);
    g.add(pool);
    g.add(box(w + 0.3, 0.08, 0.5, M.concrete(), 0, 0, 0.26)); // a clear step
    return { update(t) { if (bulbMat) bulbMat.emissiveIntensity = (night ? 6 : 2.2) * (0.94 + Math.sin(t * 9) * 0.04 + Math.sin(t * 2.7) * 0.02); } };
  }
  if (state === 'dark') {
    g.add(box(w * 0.98, h * 0.98, 0.04, colMat('#030303', { roughness: 1 }), 0, 0, -0.02));
    g.add(box(0.06, 0.06, 0.32, M.steel(), w / 2 + 0.22, h + 0.12, 0.16));
    const dead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), colMat('#3a3632', { roughness: 0.6 }));
    dead.position.set(w / 2 + 0.22, h + 0.02, 0.3);
    dead.rotation.x = 0.6; // the broken bulb, hanging crooked
    g.add(dead);
    return {};
  }
  // boarded and chained doors are shut doors first
  if (!opts.noLeaf) g.add(box(w, h, 0.07, M.wood(), 0, 0, 0.02));
  if (state === 'boarded') {
    const plank = M.grey();
    const span = Math.hypot(w, h * 0.7);
    for (const [ang, py] of [[Math.atan2(h * 0.7, w), h * 0.5], [-Math.atan2(h * 0.7, w), h * 0.5], [0.04, h * 0.25], [-0.03, h * 0.78]] as Array<[number, number]>) {
      const len = Math.abs(ang) > 0.2 ? span + 0.2 : w + 0.3;
      const b = box(len, 0.16, 0.05, plank, 0, -0.08, 0);
      const hold = new THREE.Group();
      hold.add(b);
      hold.position.set(0, py, 0.1);
      hold.rotation.z = ang;
      g.add(hold);
    }
    return {};
  }
  // chained: links sagging across the door, a padlock where they meet
  const steel = opts.fresh ? colMat('#b8bcc0', { metalness: 0.8, roughness: 0.3 }) : colMat('#6a645c', { metalness: 0.6, roughness: 0.6 });
  const n = Math.max(6, Math.round(w / 0.11));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = -w / 2 + 0.05 + t * (w - 0.1), py = h * 0.52 - Math.sin(t * Math.PI) * 0.18;
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.024, 4, 8), steel);
    link.position.set(px, py, 0.1);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    g.add(link);
  }
  g.add(box(0.26, 0.28, 0.08, opts.fresh ? colMat('#c8a050', { metalness: 0.8, roughness: 0.3 }) : steel, 0, h * 0.52 - 0.46, 0.13));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.026, 4, 10, Math.PI), steel);
  shackle.position.set(0, h * 0.52 - 0.18, 0.13);
  g.add(shackle);
  g.add(beam(new THREE.Vector3(-w / 2 - 0.05, h * 0.52, 0.06), new THREE.Vector3(-w / 2 - 0.05, h * 0.52 - 0.2, 0.06), 0.05, steel)); // the hasp
  return {};
}

/**
 * The promise check: every lit door must lead somewhere, and every way in
 * (a Thing that travels; a dungeon's exit) must have a lit door at it.
 * Returns the broken promises, one line each.
 */
export function checkDoors(a: Area): string[] {
  const out: string[] = [];
  const near = (x: number, z: number, px: number, pz: number, r = 2.6): boolean => Math.hypot(x - px, z - pz) < r;
  const ways: Array<{ x: number; z: number; what: string }> = [
    ...a.things.filter((t) => t.go || t.script).map((t) => ({ x: t.x, z: t.z, what: `"${t.label}" → ${t.go?.to ?? t.script}` })),
    // an interior's own exits are doorways too (outdoor edge exits are roads, not doors)
    ...(!a.sky
      ? a.triggers.filter((t) => t.go).map((t) => ({ x: Math.max(t.x0, Math.min(t.x1, (t.x0 + t.x1) / 2)), z: Math.max(0, Math.min(t.z0, t.z1)), what: `exit → ${t.go!.to}` }))
      : []),
  ];
  for (const m of marks) if (m.state === 'open' && !ways.some((w) => near(m.x, m.z, w.x, w.z))) out.push(`${a.id}: a lit door at (${m.x.toFixed(1)}, ${m.z.toFixed(1)}) goes nowhere`);
  for (const w of ways) if (!marks.some((m) => m.state === 'open' && near(m.x, m.z, w.x, w.z))) out.push(`${a.id}: ${w.what} at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) has no lit door`);
  return out;
}
