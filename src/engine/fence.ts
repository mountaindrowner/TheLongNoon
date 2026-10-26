import * as THREE from 'three';
import { box, beam } from './geo';
import { M } from './buildings';
import { addSolid, heightAt } from './world';
import { rng } from './noise';

/**
 * A post-and-rail fence through `pts`: a post at each point, two rails
 * between, sagging and a little crooked; the odd rail is missing (weathering
 * tells time). Each run registers a thin solid footprint. (section.ts
 * imports this from a module the spec's appendix doesn't list.)
 */
export function fence(scene: THREE.Scene, pts: Array<[number, number]>, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const top = (x: number, z: number, y: number): THREE.Vector3 => new THREE.Vector3(x, heightAt(x, z) + y, z);
  for (const [x, z] of pts) {
    const post = box(0.12, 1.05, 0.12, M.wood(), x, heightAt(x, z) - 0.05, z);
    post.rotation.z = (r() - 0.5) * 0.12;
    g.add(post);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    for (const y of [0.45, 0.85]) {
      if (r() < 0.08) continue; // a missing rail
      const a = top(ax, az, y + (r() - 0.5) * 0.06), b = top(bx, bz, y - r() * 0.1);
      g.add(beam(a, b, 0.07, M.wood()));
    }
    addSolid(Math.min(ax, bx) - 0.08, Math.min(az, bz) - 0.08, Math.max(ax, bx) + 0.08, Math.max(az, bz) + 0.08);
  }
  scene.add(g);
}
