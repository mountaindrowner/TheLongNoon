import * as THREE from 'three';
import { box, boxGeo, colMat, planeGeo } from '../../engine/geo';
import { M, windowAt, type Built, type DoorSpec } from '../../engine/buildings';
import type { DoorState } from '../../engine/doorway';

/**
 * The Span's door language (methodology §4.6, owner's call 2026-10-26):
 * **light means you can go in**, and it comes from whatever people have.
 *   lantern · a lantern hung by the door, the door standing ajar
 *   bulb    · old tech: a caged bulb on a bracket, run off a panel somewhere
 *   under   · the door shut, light spilling out under it
 *   window  · the door shut, the window beside it lit
 * No light means it won't open: shut (closed, may open later), boarded
 * (never), dark (a black opening under a dead lamp: you'd need your own light).
 * Every lit door here must lead somewhere; the promise check enforces it.
 */
export type SpanDoor = 'lantern' | 'bulb' | 'under' | 'window' | 'shut' | 'boarded' | 'dark';

let poolTex: THREE.Texture | null = null;
function lightPool(w: number, d: number, opacity: number): THREE.Mesh {
  if (!poolTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,200,130,0.9)');
    grd.addColorStop(1, 'rgba(255,200,130,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    poolTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(planeGeo(w, d), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

const warm = (k: number): THREE.MeshStandardMaterial => colMat('#ffcf8a', { emissive: '#ffb060', emissiveIntensity: k });

/** A frame round the opening: two posts and a lintel, thick enough to read. */
function frame(g: THREE.Object3D, x: number, z: number, w: number, h: number): void {
  for (const sx of [-1, 1]) g.add(box(0.12, h + 0.06, 0.1, M.wood(), x + sx * (w / 2 + 0.06), 0, z + 0.03));
  g.add(box(w + 0.36, 0.14, 0.12, M.wood(), x, h, z + 0.03));
}

function leaf(g: THREE.Object3D, x: number, z: number, w: number, h: number, ajar = 0): THREE.Object3D {
  const hinge = new THREE.Group();
  hinge.position.set(x - w / 2, 0, z + 0.02);
  hinge.rotation.y = ajar;
  const l = box(w, h, 0.07, M.wood(), w / 2, 0, 0);
  hinge.add(l);
  hinge.add(box(0.06, 0.06, 0.06, colMat('#2a2420', { metalness: 0.5 }), w - 0.14, h * 0.48, 0.05)); // the handle
  g.add(hinge);
  return hinge;
}

export function spanDoor(kind: SpanDoor, night: boolean): Pick<DoorSpec, 'state' | 'dress'> {
  const state: DoorState = kind === 'shut' ? 'shut' : kind === 'boarded' ? 'boarded' : kind === 'dark' ? 'dark' : 'open';
  if (kind === 'bulb' || kind === 'boarded' || kind === 'dark') return { state }; // the spec's own dressing does these
  return {
    state,
    dress(g, x, z, w, h): Built {
      frame(g, x, z, w, h);
      if (kind === 'shut') { leaf(g, x, z, w, h); return {}; }
      const light = new THREE.PointLight('#ffb867', (night ? 5 : 1.8), 5, 1.7);
      g.add(light);
      g.add(box(w + 0.3, 0.08, 0.5, M.concrete(), x, 0, z + 0.26)); // a clear step
      let flick: THREE.MeshStandardMaterial | null = null;
      if (kind === 'lantern') {
        // the door stands open a hand's width; a lantern hangs on a hook beside it
        const inside = new THREE.Mesh(planeGeo(w * 0.96, h * 0.96), warm(night ? 2.4 : 1.4));
        inside.position.set(x, h * 0.48, z - 0.02);
        g.add(inside);
        leaf(g, x, z, w, h, -0.75);
        const lx = x + w / 2 + 0.34;
        g.add(box(0.05, 0.05, 0.3, M.steel(), lx, h * 0.86, z + 0.15));
        flick = warm(night ? 4.5 : 2.2).clone();
        const core = new THREE.Mesh(boxGeo(0.15, 0.22, 0.15), flick);
        core.position.set(lx, h * 0.72, z + 0.3);
        g.add(core);
        g.add(box(0.2, 0.04, 0.2, M.steel(), lx, h * 0.84, z + 0.3));
        g.add(box(0.2, 0.04, 0.2, M.steel(), lx, h * 0.58, z + 0.3));
        light.position.set(lx, h * 0.72, z + 0.6);
        const p = lightPool(2.6, 2.2, night ? 0.55 : 0.25);
        p.position.set(lx - 0.3, 0.04, z + 1.0);
        g.add(p);
      } else if (kind === 'under') {
        // shut, but someone's home: light leaks out under the door
        leaf(g, x, z, w, h);
        const strip = new THREE.Mesh(planeGeo(w * 0.92, 0.05), warm(night ? 5 : 2));
        strip.position.set(x, 0.035, z + 0.065);
        g.add(strip);
        const p = lightPool(w * 1.6, 0.9, night ? 0.6 : 0.25);
        p.position.set(x, 0.04, z + 0.5);
        g.add(p);
        light.position.set(x, 0.25, z + 0.35);
        light.intensity = night ? 2.6 : 1;
        light.distance = 3;
      } else {
        // shut, the window beside it lit
        leaf(g, x, z, w, h);
        windowAt(g, x + w / 2 + 0.75, h * 0.6, z - 0.01, 'lit', 0.75, 0.75);
        light.position.set(x + w / 2 + 0.75, h * 0.6, z + 0.6);
        const p = lightPool(2.0, 1.6, night ? 0.45 : 0.2);
        p.position.set(x + w / 2 + 0.75, 0.04, z + 0.8);
        g.add(p);
      }
      return flick ? { update(t) { flick!.emissiveIntensity = (night ? 4.5 : 2.2) * (0.92 + Math.sin(t * 8.1 + x) * 0.05 + Math.sin(t * 19.3) * 0.03); } } : {};
    },
  };
}

