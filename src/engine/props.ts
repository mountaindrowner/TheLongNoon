import * as THREE from 'three';
import { rng } from './noise';
import { textTexture } from './textures';
import { box, cyl, beam, boxGeo, cylGeo, colMat, shade, planeGeo } from './geo';
import { heightAt, addSolid } from './world';
import { M, vines, type Built } from './buildings';

/**
 * Shared prop recipes, ported from the world style spec (docs/style/world-style-spec.md §7):
 * rocks, hand-painted signs, stock tanks, bales, and machines still doing
 * their old jobs. Templates for every new prop.
 */

const SAND = ['#a8865e', '#9a7a54', '#b89670', '#8a6c4a'];

/** A weathered sandstone boulder. */
export function rock(scene: THREE.Scene, x: number, z: number, s: number, seed: number): void {
  const r = rng(seed);
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), colMat(SAND[Math.floor(r() * SAND.length)]!, { roughness: 1 }));
  m.scale.set(1 + r() * 0.4, 0.55 + r() * 0.35, 1 + r() * 0.3);
  m.rotation.set(r() * 0.4, r() * 6, r() * 0.4);
  m.position.set(x, heightAt(x, z) + s * 0.25, z);
  scene.add(shade(m));
  if (s > 0.45) addSolid(x - s * 0.8, z - s * 0.6, x + s * 0.8, z + s * 0.6);
}

/** A hoodoo: a pillar of soft stone with a harder cap, left standing by the wind. */
export function hoodoo(scene: THREE.Scene, x: number, z: number, h: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const rad = (0.55 - i * 0.08) * (0.85 + r() * 0.3);
    const seg = h / 4;
    g.add(cyl(rad * 0.85, rad, seg, colMat(SAND[(i + 1) % SAND.length]!, { roughness: 1 }), (r() - 0.5) * 0.06, y, 0, 7));
    y += seg;
  }
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), colMat('#6e5a44', { roughness: 1 }));
  cap.scale.set(1.2, 0.45, 1.1);
  cap.position.set(0, y + 0.1, 0);
  g.add(shade(cap));
  g.position.set(x, heightAt(x, z) - 0.1, z);
  scene.add(g);
  addSolid(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
}

/** A hand-painted board on a post: the only kind of sign anyone still makes. */
export function boardSign(scene: THREE.Scene, x: number, z: number, text: string, rotY = 0, seed = 3): void {
  const g = new THREE.Group();
  g.add(box(0.1, 1.45, 0.1, M.wood(), 0, 0, 0));
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text, { w: 96, h: 24, bg: '#6f6656', fg: '#efe8d6', font: 'bold 12px monospace', worn: 0.3, seed }), roughness: 1 });
  const b = new THREE.Mesh(boxGeo(1.35, 0.4, 0.05), [M.wood(), M.wood(), M.wood(), M.wood(), face, M.wood()]);
  b.position.set(0, 1.25, 0.06);
  b.rotation.z = (rng(seed)() - 0.5) * 0.12;
  g.add(shade(b));
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rotY;
  scene.add(g);
  addSolid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
}

/** A round galvanized stock tank, still holding water. */
export function stockTank(scene: THREE.Scene, x: number, z: number, rad = 0.95): void {
  const g = new THREE.Group();
  const side = new THREE.Mesh(cylGeo(rad, rad, 0.55, 20, true), colMat('#8f9498', { metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }));
  side.position.y = 0.27;
  g.add(shade(side));
  g.add(cyl(rad + 0.03, rad + 0.03, 0.05, colMat('#6e7378', { metalness: 0.5 }), 0, 0.53, 0, 20));
  const wtr = new THREE.Mesh(new THREE.CircleGeometry(rad - 0.04, 20), colMat('#3f6a62', { roughness: 0.2, metalness: 0.2 }));
  wtr.rotation.x = -Math.PI / 2;
  wtr.position.y = 0.44;
  g.add(wtr);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - rad, z - rad, x + rad, z + rad);
}

/** A round hay bale on its side, gone grey on top. */
export function bale(scene: THREE.Scene, x: number, z: number, rotY = 0): void {
  const m = new THREE.Mesh(cylGeo(0.62, 0.62, 1.1, 14), [M.hay(), colMat('#a89464', { roughness: 1 }), colMat('#a89464', { roughness: 1 })]);
  m.rotation.set(Math.PI / 2, 0, rotY);
  m.position.set(x, heightAt(x, z) + 0.58, z);
  scene.add(shade(m));
  addSolid(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
}

// ------------------------------------------------- machines on the old jobs

/** A wheel-line sprinkler Ohm crawling its arc, keeping one field green. */
export function sprinkler(scene: THREE.Scene, cx: number, cz: number, len: number): Built {
  const pivot = new THREE.Group();
  pivot.position.set(cx, heightAt(cx, cz), cz);
  pivot.add(cyl(0.12, 0.16, 1.6, M.steel(), 0, 0, 0, 8));
  const arm = new THREE.Group();
  arm.position.y = 1.35;
  pivot.add(arm);
  const pipe = colMat('#c8cccc', { metalness: 0.5, roughness: 0.45 });
  arm.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(len, 0, 0), 0.08, pipe));
  const wheels: THREE.Object3D[] = [];
  for (let k = 1; k <= 3; k++) {
    const x = (len * k) / 3;
    const tower = new THREE.Group();
    tower.position.x = x;
    tower.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.35, -1.3, 0.25), 0.05, M.steel()));
    tower.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, -1.3, -0.25), 0.05, M.steel()));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 5, 12), colMat('#2a2622'));
    wheel.position.set(0, -1.05, 0);
    tower.add(shade(wheel));
    wheels.push(wheel);
    arm.add(tower);
  }
  // spray: little additive droplets falling under the arm
  const N = 90, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spray = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d8ecf0', size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }));
  arm.add(spray);
  scene.add(pivot);
  addSolid(cx - 0.25, cz - 0.25, cx + 0.25, cz + 0.25);
  return {
    update(t) {
      arm.rotation.y = Math.sin(t * 0.05) * 1.1 - 0.4;
      for (const w of wheels) w.rotation.z = -t * 0.6;
      for (let i = 0; i < N; i++) {
        const s = seeds[i]!, k = (t * 0.9 + s * 7) % 1;
        pos[i * 3] = (s * 9.7 % 1) * len;
        pos[i * 3 + 1] = -k * 1.3;
        pos[i * 3 + 2] = Math.sin(s * 40) * 0.35 * (0.3 + k);
      }
      geo.attributes.position!.needsUpdate = true;
    },
  };
}

/** A weather-vane Ohm on a leaning post, still turning to the wind. */
export function weatherVane(scene: THREE.Scene, x: number, z: number): Built {
  const g = new THREE.Group();
  g.add(box(0.1, 2.4, 0.1, M.wood(), 0, 0, 0));
  const head = new THREE.Group();
  head.position.y = 2.45;
  head.add(box(1.0, 0.05, 0.05, M.tank(), 0, 0, 0));
  const tail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, -0.2, 0), new THREE.Vector3(-0.5, 0.25, 0), new THREE.Vector3(-0.2, 0.03, 0)]), colMat('#8a5a3a', { side: THREE.DoubleSide, metalness: 0.3 }));
  tail.geometry.computeVertexNormals();
  head.add(shade(tail));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), M.tank());
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.55;
  head.add(shade(tip));
  // the cups: a little anemometer spinning above
  const cups = new THREE.Group();
  cups.position.y = 0.35;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cups.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), 0.025, M.steel()));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI), M.steel());
    c.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    cups.add(c);
  }
  head.add(cups);
  g.add(head);
  g.rotation.z = 0.05;
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
  return { update(t) { head.rotation.y = 0.6 + Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.83) * 0.12; cups.rotation.y = -t * 3.1; } };
}

/** A wind turbine down in the dirt: the tower on its side, two blades flat, one stuck upright. */
export function fallenTurbine(scene: THREE.Scene, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  const white = colMat('#d8d4c8', { roughness: 0.7 });
  const tower = new THREE.Mesh(cylGeo(0.32, 0.5, 9, 14), white);
  tower.rotation.z = Math.PI / 2;
  tower.position.set(4.5, 0.42, 0);
  g.add(shade(tower));
  g.add(box(1.3, 0.8, 0.8, white, -0.4, 0.05, 0)); // the nacelle
  g.add(box(0.5, 0.5, 0.5, colMat('#8a8a84'), -1.1, 0.2, 0));
  const blade = (): THREE.Mesh => {
    const b = new THREE.Mesh(boxGeo(0.35, 4.6, 0.08), white);
    b.geometry.translate(0, 2.3, 0);
    return shade(b);
  };
  const b1 = blade(); b1.rotation.set(Math.PI / 2, 0, 0.5); b1.position.set(-1.2, 0.1, 0.3); g.add(b1);
  const b2 = blade(); b2.rotation.set(-Math.PI / 2 + 0.05, 0, -0.9); b2.position.set(-1.3, 0.1, -0.2); g.add(b2);
  const b3 = blade(); b3.rotation.set(0.3, 0, 0.25); b3.position.set(-2.8, -0.6, 1.2); g.add(b3); // driven into the ground
  vines(g, 3.0, 0.0, 0.52, 2.4, 0.6);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rot;
  scene.add(g);
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let k = -1.5; k <= 9; k += 1.5) { const px = x + c * k, pz = z - s * k; addSolid(px - 0.55, pz - 0.55, px + 0.55, pz + 0.55); }
}

/** A railroad crossing signal still flashing for trains that never come. */
export function crossingSignal(scene: THREE.Scene, x: number, z: number, night: boolean): Built {
  const g = new THREE.Group();
  g.add(box(0.12, 2.7, 0.12, M.steel(), 0, 0, 0));
  const mat = new THREE.MeshStandardMaterial({ map: textTexture('RAILROAD', { w: 64, h: 12, bg: '#e8e2d2', fg: '#1d1b19', font: 'bold 9px monospace', worn: 0.25 }), roughness: 1 });
  for (const a of [0.6, -0.6]) {
    const b = new THREE.Mesh(boxGeo(1.2, 0.2, 0.03), [M.steel(), M.steel(), M.steel(), M.steel(), mat, M.steel()]);
    b.position.set(0, 2.45, 0.08);
    b.rotation.z = a;
    g.add(shade(b));
  }
  g.add(box(1.1, 0.07, 0.07, M.steel(), 0, 1.75, 0.05));
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (const dx of [-0.45, 0.45]) {
    const m = colMat('#ff3a22', { emissive: '#ff2a12', emissiveIntensity: 0 }).clone();
    lamps.push(m);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), m);
    l.position.set(dx, 1.75, 0.12);
    g.add(l);
    g.add(box(0.34, 0.34, 0.08, colMat('#151515'), dx, 1.58, 0.06));
  }
  const glow = new THREE.PointLight('#ff4020', 0, 4, 1.8);
  glow.position.set(0, 1.8, 0.4);
  g.add(glow);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
  return {
    update(t) {
      const on = Math.floor(t * 1.6) % 2;
      lamps[0]!.emissiveIntensity = on ? 3 : 0.1;
      lamps[1]!.emissiveIntensity = on ? 0.1 : 3;
      glow.intensity = night ? 2.4 : 0.6;
      glow.position.x = on ? -0.45 : 0.45;
    },
  };
}

