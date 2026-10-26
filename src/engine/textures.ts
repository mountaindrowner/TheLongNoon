import * as THREE from 'three';
import { rng, fbm, vnoise } from './noise';

/**
 * Procedural pixel-art textures for the HD-2D world.
 *
 * Every texture is authored at TEXEL_PER_UNIT pixels per world unit, and all
 * geometry carries world-unit UVs (see geo.ts), so every surface in a scene
 * shares one texel density — the thing that makes an HD-2D diorama read as a
 * single crafted object instead of a pile of mismatched assets.
 */
export const TEXEL_PER_UNIT = 16;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/** A tiny RGBA framebuffer we paint pixel by pixel. Coordinates wrap. */
export class Pix {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB, a = 255): void {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    const i = (yi * this.w + xi) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    const i = (yi * this.w + xi) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }
  alpha(x: number, y: number): number {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    return this.data[(yi * this.w + xi) * 4 + 3]!;
  }
  fill(c: RGB): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c);
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  texture(opts: { repeat?: boolean; worldSize?: boolean } = {}): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas());
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // geometry UVs are in world units → one repeat spans this many units
    if (opts.worldSize !== false) t.repeat.set(TEXEL_PER_UNIT / this.w, TEXEL_PER_UNIT / this.h);
    return t;
  }
}

// ---------------------------------------------------------------- materials

const P = {
  barnRed: hex('#8b3626'),
  barnRedLight: hex('#a8463a'),
  barnRedDark: hex('#5e2219'),
  oldWood: hex('#857865'),
  oldWoodDark: hex('#4f463a'),
  greyBoard: hex('#77695a'),
  greyBoardDark: hex('#4a3f35'),
  white: hex('#d6cfbf'),
  whiteShade: hex('#9c968a'),
  steel: hex('#5b6066'),
  steelDark: hex('#2e3236'),
  rust: hex('#8a4a26'),
  rustLight: hex('#b26a32'),
  rustDark: hex('#4a2614'),
  concrete: hex('#a19c92'),
  concreteDark: hex('#6f6b63'),
  moss: hex('#4f7a2c'),
  mossLight: hex('#7aa83c'),
  shingle: hex('#4a4440'),
  shingleDark: hex('#2c2825'),
  brick: hex('#8c4733'),
  mortar: hex('#9d968a'),
  hay: hex('#c9a24a'),
  hayDark: hex('#8a6a28'),
  bark: hex('#4e3b2b'),
  barkDark: hex('#2a1f17'),
  leaf0: hex('#1e4a1d'),
  leaf1: hex('#2f6b2a'),
  leaf2: hex('#3f8a32'),
  leaf3: hex('#5ea83c'),
  leaf4: hex('#8cc650'),
  glass: hex('#22303a'),
  glassSky: hex('#6f8a98'),
  black: hex('#141210'),
  yellow: hex('#d9a92a'),
};

const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Vertical boards: barn siding, fences, doors. */
function boards(seed: number, base: RGB, light: RGB, dark: RGB, opts: { horizontal?: boolean; boardPx?: number; peel?: RGB } = {}): Pix {
  const S = 32, p = new Pix(S, S), r = rng(seed);
  const bw = opts.boardPx ?? 5;
  const boardTone: number[] = [];
  for (let i = 0; i < S; i++) boardTone.push(0.86 + r() * 0.22);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = opts.horizontal ? y : x, v = opts.horizontal ? x : y;
      const bi = Math.floor(u / bw);
      const edge = u % bw === 0;
      let c = mul(base, boardTone[bi % boardTone.length]!);
      const grain = vnoise(bi * 7.3 + 0.3, v * 0.35, seed);
      c = mix(c, grain > 0.62 ? light : dark, Math.abs(grain - 0.5) * 0.5);
      if (opts.peel) {
        const pe = fbm(x * 0.18, y * 0.18, seed + 3, 3);
        if (pe > 0.62) c = mix(opts.peel, opts.peel, 1);
      }
      if (edge) c = dark;
      else if (opts.horizontal && u % bw === bw - 1) c = mix(c, dark, 0.45); // lap shadow
      if (r() < 0.012) c = dark; // knot / nail
      p.set(x, y, c);
    }
  return p;
}

export const T = {
  barnRed: () => once('barnRed', () => boards(11, P.barnRed, P.barnRedLight, P.barnRedDark, { peel: P.oldWood }).texture()),
  greyBoards: () => once('greyBoards', () => boards(12, P.greyBoard, mul(P.greyBoard, 1.2), P.greyBoardDark, { horizontal: true, boardPx: 4 }).texture()),
  whiteSiding: () => once('whiteSiding', () => boards(13, P.white, mul(P.white, 1.08), P.whiteShade, { horizontal: true, boardPx: 4, peel: P.greyBoard }).texture()),
  oldWood: () => once('oldWood', () => boards(14, P.oldWood, mul(P.oldWood, 1.15), P.oldWoodDark, { boardPx: 4 }).texture()),
  deck: () => once('deck', () => boards(15, hex('#6b4f36'), hex('#86654a'), hex('#33241a'), { horizontal: true, boardPx: 4 }).texture()),

  corrugated: () =>
    once('corrugated', () => {
      const S = 32, p = new Pix(S, S);
      const ridge = [1.18, 1.0, 0.72, 0.92];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.steel, ridge[x % 4]!);
          const ru = fbm(x * 0.12, y * 0.12, 21, 3);
          if (ru > 0.5) c = mix(c, mul(ru > 0.66 ? P.rust : P.rustLight, ridge[x % 4]!), Math.min(1, (ru - 0.5) * 4));
          const streak = vnoise(x * 0.9, y * 0.06, 22);
          if (streak > 0.78) c = mix(c, P.rustDark, 0.5);
          if (fbm(x * 0.3, y * 0.3, 23, 2) > 0.83) c = P.black; // rust-through holes
          p.set(x, y, c);
        }
      return p.texture();
    }),

  binRibs: () =>
    once('binRibs', () => {
      const S = 32, p = new Pix(S, S);
      const ridge = [1.15, 0.95, 0.75, 0.95];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(hex('#8d9296'), ridge[y % 4]!);
          const ru = fbm(x * 0.1, y * 0.14, 31, 3);
          if (ru > 0.56) c = mix(c, P.rust, Math.min(1, (ru - 0.56) * 4));
          if (vnoise(x * 0.7, y * 0.05, 32) > 0.8) c = mix(c, P.rustDark, 0.6); // vertical drip
          if (y % 16 === 0 && x % 4 === 1) c = mul(c, 0.55); // seam bolts
          p.set(x, y, c);
        }
      return p.texture();
    }),

  concrete: () =>
    once('concrete', () => {
      const S = 32, p = new Pix(S, S), r = rng(41);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.2, y * 0.2, 41, 3);
          let c = mix(P.concreteDark, P.concrete, 0.55 + n * 0.45);
          c = mul(c, 0.94 + r() * 0.1);
          if (vnoise(x * 0.8, y * 0.05, 42) > 0.74) c = mix(c, hex('#5e5a52'), 0.45); // water streaks
          if (fbm(x * 0.25, y * 0.25, 43, 2) > 0.72) c = mix(c, P.moss, 0.55);
          p.set(x, y, c);
        }
      // a couple of cracks
      for (let k = 0; k < 2; k++) {
        let x = r() * S, y = r() * S;
        for (let i = 0; i < 18; i++) {
          p.set(x, y, P.concreteDark.map((v) => v * 0.6) as RGB);
          x += r() * 2 - 0.6;
          y += r() * 1.6 - 0.3;
        }
      }
      return p.texture();
    }),

  shingles: () =>
    once('shingles', () => {
      const S = 32, p = new Pix(S, S), r = rng(51);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const row = Math.floor(y / 4);
          const off = row % 2 ? 3 : 0;
          const tab = Math.floor((x + off) / 6);
          let c = mul(P.shingle, 0.85 + vnoise(tab * 3.1, row * 2.7, 52) * 0.3);
          if (y % 4 === 3) c = P.shingleDark;
          if ((x + off) % 6 === 0) c = mix(c, P.shingleDark, 0.6);
          if (vnoise(tab * 1.7, row * 3.3, 53) > 0.86) c = hex('#3a2e24'); // missing tab
          if (fbm(x * 0.2, y * 0.2, 54, 3) > 0.66) c = mix(c, P.moss, 0.6);
          if (r() < 0.01) c = P.mossLight;
          p.set(x, y, c);
        }
      return p.texture();
    }),

  brick: () =>
    once('brick', () => {
      const S = 32, p = new Pix(S, S), r = rng(61);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const row = Math.floor(y / 3);
          const off = row % 2 ? 3 : 0;
          const bi = Math.floor((x + off) / 6);
          let c = mul(P.brick, 0.8 + vnoise(bi * 2.3, row * 1.9, 62) * 0.35);
          if (y % 3 === 2 || (x + off) % 6 === 5) c = P.mortar;
          if (r() < 0.03) c = mul(c, 0.7);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  rustTank: () =>
    once('rustTank', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.15, y * 0.15, 71, 3);
          let c = mix(hex('#7c8b8e'), P.rust, Math.min(1, n * 1.6)); // old paint → rust
          if (vnoise(x * 0.9, y * 0.08, 72) > 0.7) c = mix(c, P.rustDark, 0.55);
          if (y % 8 === 0) c = mul(c, 0.7); // plate seam
          if (y % 8 === 1 && x % 3 === 0) c = mul(c, 1.35); // rivets
          p.set(x, y, c);
        }
      return p.texture();
    }),

  steel: () =>
    once('steel', () => {
      const S = 32, p = new Pix(S, S), r = rng(81);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.steel, 0.82 + vnoise(x * 0.08, y * 1.3, 81) * 0.3);
          if (r() < 0.02) c = mul(c, 1.4); // scratches
          if (fbm(x * 0.2, y * 0.2, 82, 2) > 0.7) c = mix(c, P.rust, 0.5);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  hazard: () =>
    once('hazard', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = ((x + y) % 16) < 8 ? P.yellow : P.black;
          if (fbm(x * 0.3, y * 0.3, 91, 2) > 0.62) c = mix(c, P.concreteDark, 0.7); // worn
          p.set(x, y, c);
        }
      return p.texture();
    }),

  hay: () =>
    once('hay', () => {
      const S = 32, p = new Pix(S, S), r = rng(101);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.hay, 0.85 + r() * 0.25);
          if ((x * 2 + y) % 7 === 0) c = P.hayDark;
          if (fbm(x * 0.2, y * 0.2, 102, 2) > 0.7) c = mix(c, hex('#6f6a3a'), 0.5); // weathered grey
          p.set(x, y, c);
        }
      return p.texture();
    }),

  bark: () =>
    once('bark', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = vnoise(x * 0.9, y * 0.12, 111);
          let c = mix(P.barkDark, P.bark, n);
          if (fbm(x * 0.3, y * 0.15, 112, 2) > 0.68) c = mix(c, P.moss, 0.6);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  leaves: () =>
    once('leaves', () => {
      const S = 32, p = new Pix(S, S), r = rng(121);
      const pal = [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.22, y * 0.22, 121, 3);
          let i = Math.min(4, Math.floor(n * 5.2 + (r() - 0.5) * 0.9));
          i = Math.max(0, i);
          p.set(x, y, pal[i]!);
        }
      return p.texture();
    }),

  leavesOlive: () =>
    once('leavesOlive', () => {
      const S = 32, p = new Pix(S, S), r = rng(131);
      const pal = [hex('#2f3a1c'), hex('#4b5a2a'), hex('#66763a'), hex('#86954a'), hex('#a5ad5c')];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.25, y * 0.25, 131, 3);
          const i = Math.max(0, Math.min(4, Math.floor(n * 5.2 + (r() - 0.5) * 0.9)));
          p.set(x, y, pal[i]!);
        }
      return p.texture();
    }),

  /** Transparent climbing-vine decal — the "life over ruin" overlay. */
  vines: () =>
    once('vines', () => {
      const S = 32, p = new Pix(S, S), r = rng(141);
      const pal = [P.leaf1, P.leaf2, P.leaf3, P.leaf4];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          // denser toward the bottom of the tile: vines climb up
          const dens = fbm(x * 0.22, y * 0.22, 141, 3) + (y / S) * 0.25;
          if (dens > 0.6) p.set(x, y, pal[Math.min(3, Math.floor(r() * 4))]!, 255);
          else p.set(x, y, P.leaf0, 0);
        }
      // stems
      for (let k = 0; k < 5; k++) {
        let x = r() * S;
        for (let y = S - 1; y > 0; y--) {
          p.set(x, y, P.leaf0, 255);
          x += r() * 2 - 1;
        }
      }
      // a few wildflower dots
      for (let k = 0; k < 6; k++) p.set(r() * S, r() * S, k % 2 ? hex('#e9e2f0') : hex('#d8b23a'), 255);
      const t = p.texture();
      return t;
    }),

  glass: () =>
    once('glass', () => {
      const S = 16, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = P.glass;
          if ((x + (S - y)) % 11 < 2) c = mix(P.glass, P.glassSky, 0.6); // sky streak
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2 || x === 7 || x === 8 || y === 7 || y === 8) c = P.white; // frame + mullions
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),

  glassLit: () =>
    once('glassLit', () => {
      const S = 16, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mix(hex('#ffcf7a'), hex('#ff9f45'), y / S);
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2 || x === 7 || x === 8 || y === 7 || y === 8) c = hex('#3a2a1a');
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),

  boarded: () =>
    once('boarded', () => {
      const S = 16, p = new Pix(S, S), r = rng(151);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = P.black;
          const plank = Math.floor((y + x * 0.35) / 4);
          if (plank % 2 === 0) c = mul(P.oldWood, 0.8 + r() * 0.3);
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2) c = P.whiteShade;
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),
};

/** Text painted onto a surface (stencils, signs). Pixelated by thresholding. */
export function textTexture(text: string, opts: { w: number; h: number; bg?: string; fg: string; font: string; worn?: number; seed?: number }): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = opts.w;
  cv.height = opts.h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, opts.w, opts.h);
  }
  ctx.fillStyle = opts.fg;
  ctx.font = opts.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, opts.w / 2, opts.h / 2 + 1);
  // threshold to crisp pixels + wear
  const img = ctx.getImageData(0, 0, opts.w, opts.h);
  const fg = hex(opts.fg);
  const bg = opts.bg ? hex(opts.bg) : null;
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % opts.w, y = Math.floor(i / 4 / opts.w);
    const a = img.data[i + 3]!;
    const isText = bg ? Math.abs(img.data[i]! - fg[0]) + Math.abs(img.data[i + 1]! - fg[1]) < Math.abs(img.data[i]! - bg[0]) + Math.abs(img.data[i + 1]! - bg[1]) : a > 110;
    const worn = fbm(x * 0.3, y * 0.3, opts.seed ?? 7, 2) < (opts.worn ?? 0);
    const c = isText && !worn ? fg : bg;
    if (c) {
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    } else img.data[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const COLORS = P;
