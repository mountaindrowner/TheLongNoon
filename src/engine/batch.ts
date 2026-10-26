import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static scenery in bulk (thousands of brush clumps along a large map's
 * edges) costs a draw call per mesh. Anything marked `batch(o)` is merged,
 * per material, into one mesh when the map is finished, so a whole map's
 * brush draws in a handful of calls. Batched things never move again
 * (nothing that sways or animates should be marked).
 */
export function batch<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.userData.batch = true; });
  return o;
}

/** Merge every batched mesh under `root` into one mesh per material (in root's space). */
export function mergeBatched(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const gone: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.userData.batch || Array.isArray(m.material) || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position as THREE.BufferAttribute).count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    let e = groups.get(m.material);
    if (!e) { e = { geos: [], cast: false, receive: false }; groups.set(m.material, e); }
    e.geos.push(g);
    e.cast ||= m.castShadow;
    e.receive ||= m.receiveShadow;
    gone.push(m);
  });
  for (const m of gone) { m.parent?.remove(m); m.geometry.dispose(); }
  for (const [mat, e] of groups) {
    const merged = mergeGeometries(e.geos, false);
    for (const g of e.geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = e.cast;
    mesh.receiveShadow = e.receive;
    mesh.userData.merged = true;
    root.add(mesh);
  }
  return gone.length;
}
