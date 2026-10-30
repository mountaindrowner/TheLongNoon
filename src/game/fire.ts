import * as THREE from 'three';
import { box, cyl, colMat, shade } from '../engine/geo';
import { rng } from '../engine/noise';

/**
 * A cooking fire for a scene (the old tale is told at one): a ring of fieldstones, a teepee of sticks over two
 * logs, flames drawn as pixel art that never hold still, sparks going up, and a warm patch on the ground. The
 * light on everything around it comes from the region's lamp pool; this is only the fire you see.
 */

/** Six frames of flame, 24 × 36 pixels each, painted from a moving noise: dark red at the edges to white in the heart. */
function flameFrames(): THREE.CanvasTexture[] {
  const W = 24, H = 36, out: THREE.CanvasTexture[] = [];
  const PAL = ['#5a1206', '#a8260b', '#e2541a', '#f6922c', '#ffc95a', '#fff2c4'];
  const r = rng(77);
  const seeds = Array.from({ length: 16 }, () => r());
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    for (let y = 0; y < H; y++) {
      const up = 1 - y / (H - 1); // 0 at the base, 1 at the tip
      for (let x = 0; x < W; x++) {
        const cx = (x + 0.5) / W - 0.5;
        // the tongue sways and splits higher up; each frame moves the noise
        const sway = Math.sin(up * 5.2 + f * 1.05 + seeds[0]! * 6) * 0.09 * up + Math.sin(up * 11 + f * 2.1) * 0.03 * up;
        const width = 0.46 * Math.pow(1 - up, 0.75) + 0.04;
        const flick = 0.12 * Math.sin(x * 1.7 + f * 2.3 + y * 0.55) * up;
        const d = Math.abs(cx - sway) / width - flick;
        if (d > 1) continue;
        const heat = (1 - d) * (1 - up * 0.85) + (y > H - 6 ? 0.2 : 0);
        const k = Math.max(0, Math.min(PAL.length - 1, Math.floor(heat * PAL.length * 1.05)));
        // a few holes near the top: the tips break into licks
        if (up > 0.62 && ((x * 7 + y * 13 + f * 5) % 11) < 2) continue;
        g.fillStyle = PAL[k]!;
        g.fillRect(x, y, 1, 1);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    out.push(t);
  }
  return out;
}

export function campfire(x: number, y: number, z: number): { group: THREE.Group; update(t: number): void; dispose(): void } {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const r = rng(31);
  // fieldstones, each its own size and turn
  const stones = [colMat('#4a443d', { roughness: 0.95 }), colMat('#5c554b', { roughness: 0.95 }), colMat('#3d3832', { roughness: 0.95 })];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.2, s = 0.75 + r() * 0.5;
    const st = box(0.15 * s, 0.09 * s, 0.12 * s, stones[i % 3]!, Math.cos(a) * 0.44, 0, Math.sin(a) * 0.44);
    st.rotation.set(r() * 0.3, a + r(), r() * 0.3);
    g.add(shade(st));
  }
  // two logs crossed under a teepee of sticks, ash between
  const wood = colMat('#4a3420', { roughness: 1 }), char = colMat('#17110c', { roughness: 1 });
  for (const [rot, m] of [[0.4, wood], [-1.1, char]] as const) {
    const l = cyl(0.055, 0.065, 0.7, m, 0, 0.05, 0, 7);
    l.rotation.set(Math.PI / 2, 0, rot);
    g.add(shade(l, true, false));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const st = cyl(0.025, 0.035, 0.55, i % 2 ? char : wood, Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12, 5);
    st.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(shade(st, true, false));
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1 }));
  ash.rotation.x = -Math.PI / 2; ash.position.y = 0.012;
  g.add(ash);
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: '#ff6a1e', toneMapped: false }));
  embers.rotation.x = -Math.PI / 2; embers.position.y = 0.02;
  g.add(embers);

  // the flames: two sprites of drawn fire, out of step, one a little behind the other
  const frames = flameFrames();
  const mk = (sx: number, sy: number, ox: number, oz: number): THREE.Sprite => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: frames[0], transparent: true, depthWrite: false, toneMapped: false }));
    sp.center.set(0.5, 0.04);
    sp.scale.set(sx, sy, 1);
    sp.position.set(ox, 0.04, oz);
    g.add(sp);
    return sp;
  };
  const flames = [mk(0.62, 0.95, 0, 0), mk(0.42, 0.66, 0.1, -0.06), mk(0.38, 0.58, -0.11, 0.05)];

  // sparks: points that rise, drift and go out, then start again from the coals
  const N = 26, pos = new Float32Array(N * 3), life = new Float32Array(N), vel = new Float32Array(N * 3);
  const spawn = (i: number, t0 = 0): void => {
    pos.set([(r() - 0.5) * 0.3, 0.25 + r() * 0.2, (r() - 0.5) * 0.3], i * 3);
    vel.set([(r() - 0.5) * 0.25, 0.7 + r() * 0.9, (r() - 0.5) * 0.25], i * 3);
    life[i] = t0;
  };
  for (let i = 0; i < N; i++) spawn(i, r() * 1.6);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffb35a', size: 0.045, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  g.add(sparks);

  // a warm patch on the ground, soft and small (the lamp pool does the real lighting)
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const cg = c.getContext('2d')!;
  const gr = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,150,60,0.32)'); gr.addColorStop(0.5, 'rgba(255,120,40,0.12)'); gr.addColorStop(1, 'rgba(255,110,40,0)');
  cg.fillStyle = gr; cg.fillRect(0, 0, 64, 64);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  g.add(halo);

  let last = 0;
  return {
    group: g,
    update(t) {
      const dt = Math.min(0.1, Math.max(0, t - last));
      last = t;
      flames.forEach((f, i) => {
        (f.material as THREE.SpriteMaterial).map = frames[Math.floor(t * 9 + i * 2.3) % frames.length]!;
        const k = 1 + 0.08 * Math.sin(t * 13 + i * 1.7) + 0.05 * Math.sin(t * 31 + i);
        f.scale.y = (i === 0 ? 0.95 : i === 1 ? 0.66 : 0.58) * k;
      });
      for (let i = 0; i < N; i++) {
        life[i]! += dt;
        if (life[i]! > 1.6) { spawn(i); continue; }
        pos[i * 3]! += (vel[i * 3]! + Math.sin(t * 3 + i) * 0.15) * dt;
        pos[i * 3 + 1]! += vel[i * 3 + 1]! * dt;
        pos[i * 3 + 2]! += vel[i * 3 + 2]! * dt;
      }
      sg.attributes.position!.needsUpdate = true;
      (embers.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.36 + 0.08 * Math.sin(t * 9), 0.1);
    },
    dispose() {
      g.parent?.remove(g);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        mat?.map?.dispose(); mat?.dispose();
      });
      frames.forEach((f) => f.dispose());
    },
  };
}

/**
 * Around the fire the night Papá tells the old story: a blanket for little Juno, his crank radio on a crate, a stool
 * and a water jug for Mamá. Placed relative to the fire's centre (`x`, `y`, `z`); taken down with `dispose`. The
 * story itself plays as a dream over the whole screen (dream.ts).
 */
export function storyCamp(x: number, y: number, z: number): { group: THREE.Group; dispose(): void } {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const crate = colMat('#7a5a3a', { roughness: 1 }), dark = colMat('#2a2420', { roughness: 0.8 });
  // little Juno's blanket, striped, in front of the fire
  const blanket = box(1.1, 0.025, 0.75, colMat('#7a3226', { roughness: 1 }), -0.35, 0, 1.15);
  blanket.rotation.y = 0.15;
  g.add(blanket);
  for (const dz of [-0.24, 0.24]) { const st = box(1.12, 0.03, 0.08, colMat('#d8b46a', { roughness: 1 }), -0.35, 0, 1.15 + dz); st.rotation.y = 0.15; g.add(st); }
  // Papá's crate and the crank radio he listened to every night
  g.add(box(0.5, 0.42, 0.42, crate, -1.85, 0, -0.35));
  g.add(box(0.3, 0.17, 0.12, dark, -1.85, 0.42, -0.35));
  g.add(box(0.012, 0.32, 0.012, dark, -1.75, 0.59, -0.39)); // the aerial
  g.add(box(0.03, 0.03, 0.08, colMat('#8a7a5a', { roughness: 0.6 }), -1.69, 0.52, -0.35)); // the crank
  // Mamá's stool and a clay jug
  g.add(box(0.42, 0.34, 0.36, crate, 1.55, 0, -0.35));
  g.add(cyl(0.11, 0.08, 0.3, colMat('#a8653a', { roughness: 0.9 }), 1.95, 0, 0.0, 10));
  return {
    group: g,
    dispose() {
      g.parent?.remove(g);
      g.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
    },
  };
}
