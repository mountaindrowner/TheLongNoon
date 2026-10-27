import * as THREE from 'three';
import { box, cyl, colMat, shade } from '../engine/geo';

/**
 * A cooking fire for a scene (the old tale is told at one): a ring of stones,
 * crossed sticks, and flames that never hold still. The light comes from the
 * region's lamp pool; this is only the fire you see.
 */
export function campfire(x: number, y: number, z: number): { group: THREE.Group; update(t: number): void; dispose(): void } {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stone = colMat('#7a7268', { roughness: 0.95 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = box(0.24, 0.16, 0.2, stone, Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
    s.rotation.y = a;
    g.add(shade(s));
  }
  const wood = colMat('#3a2a1c', { roughness: 1 }), char = colMat('#1a1410', { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const l = cyl(0.05, 0.06, 0.8, i === 1 ? char : wood, 0, 0.09, 0, 6);
    l.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI * 2, 0);
    g.add(shade(l, true, false));
  }
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: '#ff7a2a', toneMapped: false }));
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 0.04;
  g.add(embers);
  const hot = new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false, transparent: true, opacity: 0.92 });
  const core = new THREE.MeshBasicMaterial({ color: '#fff0b0', toneMapped: false });
  const flames = [
    { m: new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 6), hot), x: 0, z: 0, ph: 0 },
    { m: new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 6), hot), x: 0.12, z: 0.05, ph: 1.7 },
    { m: new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 6), hot), x: -0.11, z: -0.04, ph: 3.1 },
    { m: new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), core), x: 0.02, z: 0.02, ph: 0.6 },
  ];
  for (const f of flames) { f.m.position.set(f.x, 0.3, f.z); g.add(f.m); }
  // a soft halo of firelight on the ground
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const cg = c.getContext('2d')!;
  const gr = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,170,80,0.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  cg.fillStyle = gr; cg.fillRect(0, 0, 64, 64);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  g.add(halo);
  return {
    group: g,
    update(t) {
      for (const f of flames) {
        const k = 0.8 + 0.25 * Math.sin(t * 13 + f.ph) + 0.12 * Math.sin(t * 29 + f.ph * 2);
        f.m.scale.set(1, k, 1);
        f.m.position.y = 0.12 + 0.31 * k * (f.m.geometry as THREE.ConeGeometry).parameters.height / 0.62;
        f.m.rotation.z = Math.sin(t * 7 + f.ph) * 0.12;
      }
      (embers.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.42 + 0.08 * Math.sin(t * 9), 0.15);
    },
    dispose() {
      g.parent?.remove(g);
      g.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
    },
  };
}
