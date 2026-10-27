import * as THREE from 'three';
import { fbm, rng, vnoise } from './noise';
import { Pix, TEXEL_PER_UNIT } from './textures';
import { cell, heightAt, solidRects, insideSolid, world } from './world';
import { planeGeo } from './geo';

type RGB = [number, number, number];
const H = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const GRASS_DRY = ['#6c6a3a', '#7d7a45', '#8f8a52', '#5c5c33'].map(H);
const GRASS_LUSH = ['#3d6b26', '#4f7f2f', '#5f9536', '#79ad47', '#335c21'].map(H);
const TALL = ['#2f5420', '#355f22', '#41702a', '#2a4a1c'].map(H);
const ASPHALT = ['#5f5c57', '#6d6a64', '#7a766e', '#55524d'].map(H);
const SCRUB = ['#2f3a1d', '#3d4a25', '#4a5530', '#5a5a35'].map(H);
const MUD = ['#3f3527', '#4a3f2e', '#55493a'].map(H);
const FLOWERS = ['#e3c34a', '#ece6d6', '#5e6fd0', '#c4473a', '#b07ad0'].map(H);

/** Paint a piece of the outdoor floor (x0, z0, w × h units) as one pixel-art texture, 16px per unit.
 *  Big maps are painted in tiles so no texture is larger than a phone can hold. */
function paintGround(x0: number, z0: number, w: number, h: number): THREE.CanvasTexture {
  const wd = world();
  const W = w * TEXEL_PER_UNIT, Hh = h * TEXEL_PER_UNIT;
  const p = new Pix(W, Hh);
  const r = rng((wd.seed ?? 2026) + x0 * 131 + z0 * 977);
  for (let py = 0; py < Hh; py++)
    for (let px = 0; px < W; px++) {
      const x = x0 + (px + 0.5) / TEXEL_PER_UNIT, z = z0 + (py + 0.5) / TEXEL_PER_UNIT;
      // jittered lookup → organic, hand-drawn boundaries instead of tile seams
      const jx = x + (fbm(x * 0.9, z * 0.9, 9, 2) - 0.5) * 0.75;
      const jz = z + (fbm(x * 0.9, z * 0.9, 19, 2) - 0.5) * 0.75;
      const c = cell(Math.floor(jx), Math.floor(jz));
      const fine = r();
      let col: RGB;
      const custom = wd.paint?.(c, x, z, fine);
      if (custom) {
        col = custom;
      } else if (c === 'd') {
        const n = fbm(x * 0.6, z * 0.6, 31, 3);
        col = ASPHALT[Math.min(3, Math.floor(n * 3.2 + fine * 0.9))]!;
        // crack network = contour lines of a noise field; weeds push through them
        const cr = fbm(x * 0.55, z * 0.55, 33, 3);
        const crack = Math.abs(cr - 0.5) < 0.012 || Math.abs(fbm(x * 1.3, z * 1.3, 34, 2) - 0.5) < 0.008;
        if (crack) col = vnoise(x * 3, z * 3, 35) > 0.55 ? GRASS_LUSH[1 + Math.floor(fine * 3)]! : H('#3a3733');
        // faded center line
        if (wd.centerLine?.(x, z)) col = H('#b49a52');
        // weathered potholes and gravel
        if (fbm(x * 0.35, z * 0.35, 37, 2) > 0.74) col = fine > 0.5 ? H('#7d6a4c') : H('#6a5a40');
      } else if (c === 'T') {
        col = TALL[Math.floor(fine * TALL.length)]!;
      } else if (c === 'w') {
        col = MUD[Math.floor(fine * MUD.length)]!;
      } else if (c === '#') {
        col = SCRUB[Math.min(3, Math.floor(fbm(x * 0.7, z * 0.7, 41, 2) * 3 + fine * 1.2))]!;
      } else {
        // prairie: big patches of lush life over dry straw
        const lush = fbm(x * 0.13, z * 0.13, 3, 3);
        const pal = lush > 0.5 ? GRASS_LUSH : GRASS_DRY;
        const n = fbm(x * 1.4, z * 1.4, 4, 2);
        col = pal[Math.min(pal.length - 1, Math.floor(n * pal.length * 0.9 + fine * 1.4))]!;
        if (lush > 0.55 && fine > 0.993) col = FLOWERS[Math.floor(r() * FLOWERS.length)]!;
        else if (fine < 0.006) col = H('#6a5638');
      }
      p.set(px, py, col);
    }
  // darken under/around building footprints: a painted contact shadow
  for (const s of solidRects()) {
    if (s.x1 + 0.4 < x0 || s.x0 - 0.4 > x0 + w || s.z1 + 0.4 < z0 || s.z0 - 0.4 > z0 + h) continue;
    for (let z = s.z0 - 0.4; z < s.z1 + 0.4; z += 1 / TEXEL_PER_UNIT)
      for (let x = s.x0 - 0.4; x < s.x1 + 0.4; x += 1 / TEXEL_PER_UNIT) {
        const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
        const d = Math.hypot(dx, dz);
        const k = 0.72 + Math.min(1, d / 0.4) * 0.28;
        const px = Math.floor((x - x0) * TEXEL_PER_UNIT), py = Math.floor((z - z0) * TEXEL_PER_UNIT);
        if (px < 0 || py < 0 || px >= W || py >= Hh) continue;
        const c = p.get(px, py);
        p.set(px, py, [c[0] * k, c[1] * k, c[2] * k]);
      }
  }
  const t = p.texture({ repeat: false, worldSize: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Maps built into the overworld skip their own edge aprons. */
let aprons = true;
export function setAprons(on: boolean): void { aprons = on; }

/** Overgrown scrub for the land beyond the map edge. */
let scrubCache: THREE.Texture | null = null;
/** A region can supply its own land beyond the edge (the Span's is desert, not prairie). */
export function setApronTexture(t: THREE.Texture | null): void { scrubCache = t; }
export function scrubTex(): THREE.Texture {
  if (scrubCache) return scrubCache;
  const S = 64, p = new Pix(S, S), r = rng(99);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.09, y * 0.09, 98, 3);
      const pal = n > 0.5 ? GRASS_LUSH : SCRUB;
      p.set(x, y, pal[Math.min(pal.length - 1, Math.floor(r() * 1.3 + n * pal.length * 0.8))]!);
    }
  scrubCache = p.texture();
  return scrubCache;
}

export function buildGround(scene: THREE.Scene): void {
  const { cols: COLS, rows: ROWS, openings = [] } = world();
  // in tiles of at most 64 units (1024 px textures): heights meet exactly at the tile edges
  const TILE = 64;
  const K = COLS * ROWS > 20000 ? 2 : 4; // vertices per unit: a town-sized map is mostly flat, and twice as costly
  for (let tz = 0; tz < ROWS; tz += TILE) for (let tx = 0; tx < COLS; tx += TILE) {
    const w = Math.min(TILE, COLS - tx), h = Math.min(TILE, ROWS - tz);
    const g = new THREE.PlaneGeometry(w, h, w * K, h * K);
    g.rotateX(-Math.PI / 2);
    g.translate(tx + w / 2, 0, tz + h / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paintGround(tx, tz, w, h), roughness: 1, metalness: 0 }));
    m.receiveShadow = true;
    scene.add(m);
  }
  if (!aprons) return; // the overworld frames all its chunks at once

  // a frame of scrubland beyond the map edge (level with the berm top), so
  // the diorama never shows a void at the edges of the camera
  const apronMat = new THREE.MeshStandardMaterial({ map: scrubTex(), roughness: 1 });
  const bankMat = new THREE.MeshStandardMaterial({ color: '#2b2419', roughness: 1, side: THREE.DoubleSide });
  const roadMat = new THREE.MeshStandardMaterial({ color: '#5f5c57', roughness: 1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: '#6a5238', roughness: 1 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: '#7a746a', roughness: 1 });
  const E = 40;
  // each side's apron sits level with that edge's berm top
  const edgeY = (side: 'n' | 's' | 'w' | 'e'): number => {
    let sum = 0, n = 0;
    for (let t = 0.5; t < (side === 'n' || side === 's' ? COLS : ROWS); t += 1) {
      const [x, z] = side === 'n' ? [t, 0] : side === 's' ? [t, ROWS] : side === 'w' ? [0, t] : [COLS, t];
      sum += heightAt(x, z);
      n++;
    }
    return sum / n;
  };
  const rects: Array<[number, number, number, number, number]> = [];
  for (const side of ['n', 's', 'w', 'e'] as const) {
    const ns = side === 'n' || side === 's';
    // the apron band beyond this edge: along-edge span a0..a1, depth d0..d1
    const a0 = ns ? -E : 0, a1 = ns ? COLS + E : ROWS;
    const d0 = side === 'n' ? -E : side === 's' ? ROWS : side === 'w' ? -E : COLS;
    const d1 = side === 'n' ? 0 : side === 's' ? ROWS + E : side === 'w' ? 0 : COLS + E;
    const ay = edgeY(side);
    const band = (s0: number, s1: number): void => { if (s1 > s0) rects.push(ns ? [s0, d0, s1, d1, ay] : [d0, s0, d1, s1, ay]); };
    let a = a0;
    for (const o of openings.filter((q) => q.side === side).sort((p, q) => p.x0 - q.x0)) {
      band(a, o.x0);
      a = o.x1;
      const mid = (o.x0 + o.x1) / 2;
      const ry = heightAt(ns ? mid : side === 'w' ? 0.01 : COLS - 0.01, ns ? (side === 'n' ? 0.01 : ROWS - 0.01) : mid);
      // the road cut through the berm gets its own banks, and runs on out of frame
      for (const b of [o.x0, o.x1]) {
        const bank = new THREE.Mesh(new THREE.PlaneGeometry(E, Math.max(0.1, ay - ry + 0.05)), bankMat);
        if (ns) { bank.rotation.y = Math.PI / 2; bank.position.set(b, (ay + ry) / 2, (d0 + d1) / 2); }
        else bank.position.set((d0 + d1) / 2, (ay + ry) / 2, b);
        scene.add(bank);
      }
      // the road out matches whatever runs off the edge: blacktop, a dirt lane, gravel
      const g0 = cell(Math.floor(ns ? mid : side === 'w' ? 0 : COLS - 1), Math.floor(ns ? (side === 'n' ? 0 : ROWS - 1) : mid));
      const outMat = g0 === 'e' ? dirtMat : g0 === 'v' ? gravelMat : roadMat;
      const out = new THREE.Mesh(new THREE.PlaneGeometry(ns ? o.x1 - o.x0 : E, ns ? E : o.x1 - o.x0), outMat);
      out.rotation.x = -Math.PI / 2;
      out.position.set(ns ? mid : (d0 + d1) / 2, ry + 0.01, ns ? (d0 + d1) / 2 : mid);
      out.receiveShadow = true;
      scene.add(out);
    }
    band(a, a1);
  }
  for (const [ax0, az0, ax1, az1, y] of rects) {
    // tuck each apron half a unit under the map edge so no seam shows the sky
    const x0 = ax0 === COLS ? COLS - 0.5 : ax0, x1 = ax1 === 0 ? 0.5 : ax1;
    const z0 = az0 === ROWS ? ROWS - 0.5 : az0, z1 = az1 === 0 ? 0.5 : az1;
    const a = new THREE.Mesh(planeGeo(x1 - x0, z1 - z0), apronMat);
    a.rotation.x = -Math.PI / 2;
    a.position.set((x0 + x1) / 2, y - 0.02, (z0 + z1) / 2);
    a.receiveShadow = true;
    scene.add(a);
  }
}

// ------------------------------------------------------------------ water

/** A shader creek over the rect x0..x1, z0..z1 (banks shallow, centre deep). */
export function buildWater(scene: THREE.Scene, night: boolean, x0: number, z0: number, x1: number, z1: number, y: number, cells?: Array<[number, number]>): (t: number) => void {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      bankA: { value: z0 + 0.4 },
      bankB: { value: z1 - 0.6 },
      deep: { value: new THREE.Color(night ? '#0b1a24' : '#1d3a38') },
      shallow: { value: new THREE.Color(night ? '#1d3346' : '#4f7a6a') },
      sky: { value: new THREE.Color(night ? '#5f7fb0' : '#e8d6b0') },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying float vFog;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, fogDensity, bankA, bankB; uniform vec3 deep, shallow, sky, fogColor;
      varying vec3 vW; varying float vFog;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = floor(vW.xz * 16.0) / 16.0; // ripples snap to the 16-texel world grid
        float rip = sin(p.x * 3.1 + uTime * 1.3 + sin(p.y * 2.0)) * 0.5 + sin(p.y * 4.3 - uTime * 0.9 + p.x) * 0.5;
        float band = smoothstep(0.78, 1.0, rip) * (0.5 + 0.5 * sin(p.x * 0.73 + p.y * 1.9 + uTime * 0.35));
        // depth: shallower near the banks (z 24 / 27)
        float edge = min(abs(p.y - bankA), abs(p.y - bankB));
        vec3 col = mix(shallow, deep, smoothstep(0.1, 1.2, edge));
        col = mix(col, sky, band * 0.1);
        // pixel-snapped sun glints
        vec2 q = floor(p * 16.0);
        float g = step(0.985, h(q + floor(uTime * 3.0))) * band;
        col += sky * g * 1.2;
        float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, 0.88);
      }`,
  });
  let m: THREE.Mesh;
  if (cells) {
    // one quad per water cell (any shape of pool); world-space positions
    const pos: number[] = [];
    for (const [cx, cz] of cells) pos.push(cx, 0, cz, cx, 0, cz + 1, cx + 1, 0, cz, cx + 1, 0, cz, cx, 0, cz + 1, cx + 1, 0, cz + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    m = new THREE.Mesh(g, mat);
    m.position.y = y;
  } else {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
    g.rotateX(-Math.PI / 2);
    m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  }
  scene.add(m);
  return (t) => {
    mat.uniforms.uTime!.value = t;
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      (mat.uniforms.fogColor!.value as THREE.Color).copy(fog.color);
      mat.uniforms.fogDensity!.value = fog.density;
    }
  };
}

// ------------------------------------------------- grass, tufts, flowers

/** A clump of 3 tapered blades. Normals point up so grass catches light like a
 *  painted field rather than flickering with blade orientation. */
function clumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], nrm: number[] = [];
  const base = new THREE.Color('#1e3a14'), tip = new THREE.Color('#9fd05a');
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + 0.3;
    const ca = Math.cos(a) * 0.07, sa = Math.sin(a) * 0.07;
    const lean = (b - 1) * 0.08;
    const tri = [
      [-ca, 0, -sa, 0], [ca, 0, sa, 0], [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55],
      [ca, 0, sa, 0], [lean * 0.5 + ca * 0.4, 0.55, sa * 0.4, 0.55], [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55],
      [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55], [lean * 0.5 + ca * 0.4, 0.55, sa * 0.4, 0.55], [lean, 1.0, 0, 1],
    ];
    for (const [x, y, z, t] of tri) {
      pos.push(x!, y!, z!);
      const c = base.clone().lerp(tip, t!);
      col.push(c.r, c.g, c.b);
      nrm.push(0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

function swayMaterial(uTime: { value: number }, amount: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
       float wv = sin(uTime * 1.5 + ip.x * 0.55 + ip.y * 0.35) * 0.6 + sin(uTime * 2.9 + ip.x * 1.7) * 0.25;
       float k = position.y * position.y * ${amount.toFixed(3)};
       transformed.x += wv * k;
       transformed.z += wv * k * 0.4;`,
    );
  };
  return m;
}


export function buildGrass(scene: THREE.Scene): (t: number) => void {
  const uTime = { value: 0 };
  const r = rng(77);
  const clump = clumpGeometry();
  type Spot = { x: number; z: number; s: number; c: THREE.Color };
  const spots: Spot[] = [];
  const { cols: COLS, rows: ROWS } = world();
  const tallTints = ['#cfe8a0', '#e8f0b8', '#b8d890', '#f0e8a8'];
  const shortTints = ['#d8e0a0', '#c8d890', '#e8d898', '#b0c880'];
  for (let z = 0; z < ROWS; z++)
    for (let x = 0; x < COLS; x++) {
      const c = cell(x, z);
      const n = c === 'T' ? 30 : c === 'g' ? (fbm(x * 0.13, z * 0.13, 3, 3) > 0.5 ? 6 : 3) : c === '#' ? 5 : 0;
      for (let i = 0; i < n; i++) {
        const px = x + r(), pz = z + r();
        if (insideSolid(px, pz)) continue;
        const tall = c === 'T' || c === '#';
        const pick = tall ? tallTints[Math.floor(r() * 4)]! : shortTints[Math.floor(r() * 4)]!;
        spots.push({
          x: px, z: pz,
          s: tall ? 0.55 + r() * 0.45 : 0.22 + r() * 0.2,
          c: new THREE.Color(world().grassTint?.(px, pz) ?? pick),
        });
      }
    }
  // tall grass hugging the road edges and building walls: life reclaiming the town
  for (let z = 1; z < ROWS - 1; z++)
    for (let x = 1; x < COLS - 1; x++) {
      if (cell(x, z) !== 'g') continue;
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cell(x + dx!, z + dz!) === 'd');
      if (!nearRoad) continue;
      for (let i = 0; i < 4; i++) {
        const px = x + r(), pz = z + r();
        if (insideSolid(px, pz)) continue;
        spots.push({ x: px, z: pz, s: 0.35 + r() * 0.3, c: new THREE.Color(tallTints[Math.floor(r() * 4)]!) });
      }
    }
  const mesh = new THREE.InstancedMesh(clump, swayMaterial(uTime, 0.16), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach((s, i) => {
    e.set(0, r() * Math.PI * 2, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, heightAt(s.x, s.z) - 0.02, s.z), q, new THREE.Vector3(s.s * 1.1, s.s, s.s * 1.1));
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, s.c);
  });
  mesh.receiveShadow = true;
  scene.add(mesh);

  // wildflowers: lupines, Indian paintbrush, yellow coneflower, white yarrow
  const fl: Spot[] = [];
  const FL = ['#5a6ee0', '#d8483a', '#f0c63a', '#f2ece0', '#b97ae0'];
  for (let k = 0; k < 900; k++) {
    const x = 1 + r() * (COLS - 2), z = 1 + r() * (ROWS - 2);
    const c = cell(Math.floor(x), Math.floor(z));
    if (c !== 'g' && c !== 'T') continue;
    const lush = fbm(x * 0.13, z * 0.13, 3, 3);
    if (lush < 0.52 && r() > 0.25) continue;
    if (insideSolid(x, z)) continue;
    // flowers grow in drifts
    const drift = Math.floor(fbm(x * 0.25, z * 0.25, 88, 2) * FL.length);
    fl.push({ x, z, s: 0.16 + r() * 0.1, c: new THREE.Color(FL[(drift + (r() > 0.8 ? 1 : 0)) % FL.length]!) });
  }
  const head = new THREE.IcosahedronGeometry(0.11, 0);
  head.translate(0, 0.32, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3);
  stem.translate(0, 0.16, 0);
  const flowerMat = swayMaterial(uTime, 0.5);
  flowerMat.vertexColors = false;
  const heads = new THREE.InstancedMesh(head, flowerMat, fl.length);
  const stems = new THREE.InstancedMesh(stem, new THREE.MeshLambertMaterial({ color: '#3f6b28' }), fl.length);
  fl.forEach((s, i) => {
    m4.compose(new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z), q.identity(), new THREE.Vector3(s.s * 4, s.s * 4, s.s * 4));
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, s.c);
    stems.setMatrixAt(i, m4);
  });
  heads.receiveShadow = stems.receiveShadow = true;
  scene.add(heads, stems);

  return (t) => { uTime.value = t; };
}
