import * as THREE from 'three';

/**
 * Geometry helpers that bake WORLD-UNIT UVs, so any textured material tiles
 * at the shared texel density no matter the object's size (textures.ts sets
 * each texture's repeat to 16px-per-unit). Plus small mesh builders.
 */

/** BoxGeometry with per-face UVs in world units. */
export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // face order: px, nx (d×h) · py, ny (w×d) · pz, nz (w×h); 4 verts each
  const dims: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f]!;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  return g;
}

/** Cylinder/cone with world-unit UVs (torso wraps the circumference). */
export function cylGeo(rTop: number, rBot: number, h: number, seg = 16, open = false): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const torso = (seg + 1) * 2;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) {
    if (i < torso) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
    else uv.setXY(i, uv.getX(i) * 2 * Math.max(rTop, rBot), uv.getY(i) * 2 * Math.max(rTop, rBot));
  }
  return g;
}

export function planeGeo(w: number, h: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

// --------------------------------------------------------------- materials

const matCache = new Map<string, THREE.Material>();
/** Standard lit material over a texture, cached by key. */
export function texMat(key: string, map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}
export function colMat(hex: string, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = 'col:' + hex + JSON.stringify(opts);
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}

// ----------------------------------------------------------------- meshes

export function shade<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

/** A box whose position is given by its CENTER-BOTTOM. */
export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

export function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(cylGeo(rTop, rBot, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

/** A flat textured decal plane (windows, doors, vines) facing +Z. */
export function decal(w: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, rotY = 0): THREE.Mesh {
  const m = new THREE.Mesh(planeGeo(w, h), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  return m;
}

/** A thin beam between two points (braces, rails, wires-with-thickness). */
export function beam(a: THREE.Vector3, b: THREE.Vector3, thick: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(boxGeo(thick, len, thick), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return shade(m);
}

/** Prism from a 2D profile (XY) extruded along Z; UVs are already world-unit. */
export function prism(shape: THREE.Shape, depth: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return shade(new THREE.Mesh(g, mat));
}
