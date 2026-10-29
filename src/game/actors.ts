import * as THREE from 'three';
import { blob, pixelTex } from '../engine/sprites';
import charsUrl from '../assets/chars-poc2.png';

/**
 * Characters, placed the way the style spec places sprites (§13.4): an
 * upright plane facing the camera, MeshBasicMaterial tinted by the mood,
 * alpha-cut, a soft blob shadow, and sized by measuring the drawn figure so
 * it stands its target height.
 *
 * Two sources:
 * - **The cast from PixelLab** (docs/design/cast.md): one packed sheet per
 *   figure (src/assets/cast/<id>.png, laid out in cast.json by
 *   tools/pack-cast.py). The still figure, the idle and the walk each face
 *   four ways (a figure missing its west row plays its east row mirrored).
 * - **The first version's atlas** (16×24 frames, rows down/left/right/up,
 *   walk order 1-0-2-0), for anyone not remade yet.
 */

export type Dir4 = 'S' | 'W' | 'E' | 'N';
const ROW: Record<Dir4, number> = { S: 0, W: 1, E: 2, N: 3 };
const WALK = [1, 0, 2, 0];
const NAME: Record<Dir4, string> = { S: 'south', E: 'east', N: 'north', W: 'west' };

/** Where each figure sits in the old atlas (from the old manifest). */
export const ATLAS = {
  people: { juno: [0, 0], kit: [49, 0], lupe: [98, 0], chayo: [147, 0], beto: [196, 0], ruben: [0, 97], tavo: [49, 97], nacho: [98, 97], fina: [147, 97], memo: [196, 97], nina: [0, 194], tona: [49, 194], elias: [98, 194], rosa: [147, 194], kidjuno: [196, 194] } as Record<string, [number, number]>,
  critters: { goat: [[141, 291, 18, 15], [160, 291, 18, 15]], chicken: [[179, 291, 10, 10], [190, 291, 10, 10]], coyote: [[87, 291, 26, 17], [114, 291, 26, 17]], stray: [[0, 291, 28, 24], [29, 291, 28, 24]], strayBroken: [[58, 291, 28, 24]] } as Record<string, Array<[number, number, number, number]>>,
};

/** How tall each person stands (units ≈ metres): the cast is drawn on one canvas size, so children are scaled here. */
const HEIGHT: Record<string, number> = { kit: 1.42, tavo: 1.22, nina: 1.2, kidjuno: 1.0, juno: 1.6, nacho: 1.58, tona: 1.5, lupe: 1.55, chayo: 1.58 };

// ---------------------------------------------------------------- the PixelLab cast
interface CastAnim { fps: number; frames: number; rows: Record<string, number> }
interface CastMeta { w: number; h: number; still: Record<string, [number, number]>; anims: Record<string, CastAnim> }
const CAST_META = (Object.values(import.meta.glob('../assets/cast/cast.json', { eager: true, import: 'default' }))[0] ?? {}) as Record<string, CastMeta>;
const CAST_URL = Object.fromEntries(Object.entries(import.meta.glob('../assets/cast/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [k.split('/').pop()!.replace('.png', ''), v]));
/** The cast figure an atlas name is drawn from now (the Stray's wreck is the Stray, gone dark). */
const CAST_OF: Record<string, string> = { strayBroken: 'stray' };
const castId = (id: string): string | null => { for (const c of [CAST_OF[id] ?? id, BASE[id]]) if (c && CAST_META[c] && CAST_URL[c]) return c; return null; };
/** What an animal is when its own look isn't drawn yet. */
const BASE: Record<string, string> = { pancha: 'goat', dog: 'coyote', warden: 'hauler' };
/** Animals come in a few looks (the owner, 2026-10-27: "a little bit of variation"): one picked from where it
 *  stands, so a pen is mixed and stays the same each visit. Only looks that have been drawn are used. */
export function variant(kind: string, x: number, z: number): string {
  const looks = [kind, `${kind}2`, `${kind}3`].filter((k) => k === kind || castId(k));
  const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
  return looks[Math.floor(h * looks.length)]!;
}

interface Sheet { img: HTMLImageElement; data: Uint8ClampedArray; tex: THREE.Texture }
const sheets = new Map<string, Promise<Sheet>>();
function loadSheet(url: string): Promise<Sheet> {
  let p = sheets.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        res({ img, data: g.getImageData(0, 0, img.width, img.height).data, tex: pixelTex(new THREE.Texture(img)) });
      };
      img.onerror = rej;
      img.src = url;
    });
    sheets.set(url, p);
  }
  return p;
}
const loadAtlas = (): Promise<Sheet> => loadSheet(charsUrl);

/** Top and bottom drawn rows (alpha > 128) inside a rect of a sheet. */
function measure(data: Uint8ClampedArray, W: number, x: number, y: number, w: number, h: number): [number, number] {
  let top = h, bottom = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (data[((y + j) * W + x + i) * 4 + 3]! > 128) { top = Math.min(top, j); bottom = Math.max(bottom, j + 1); }
  return [top, bottom];
}
/** The drawn bounds of a rect: [left, top, right, bottom]. */
function bounds(data: Uint8ClampedArray, W: number, x: number, y: number, w: number, h: number): [number, number, number, number] {
  let l = w, t = h, r = 0, b = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (data[((y + j) * W + x + i) * 4 + 3]! > 128) { l = Math.min(l, i); r = Math.max(r, i + 1); t = Math.min(t, j); b = Math.max(b, j + 1); }
  return [l, t, r, b];
}

type Source =
  | { kind: 'atlas'; frames: Array<[number, number, number, number]> | null; origin: [number, number] }
  | { kind: 'cast'; id: string; meta: CastMeta };

export class Actor {
  readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly tex: THREE.Texture;
  private readonly body = new THREE.Group();
  dir: Dir4 = 'S';
  x = 0;
  z = 0;
  moving = false;
  private t = 0;
  /** A multiplier on the mood's tint (the Stray's wreck is dark). */
  private dim = 1;
  /** Battle staging: a rotation picked for the battle camera (any of eight), or null in play. */
  private posed: string | null = null;
  /** Moving fast (the run, where one is drawn). */
  running = false;
  /** In a fight: the stance between turns, where one is drawn. */
  stance = false;
  /** A move played once (a blow, a hit taken, a fall), with when it started and what to do at its end. */
  private once: { name: string; t: number; hold: boolean; done: () => void } | null = null;
  /** Wall-clock seconds, for moves played once. */
  private lt = 0;

  private constructor(tex: THREE.Texture, private readonly W: number, private readonly H: number, private readonly src: Source, fw: number, fh: number, k: number, bottom: number, tint: THREE.Color, shadowR: number) {
    this.tex = tex;
    const geo = new THREE.PlaneGeometry(fw * k, fh * k);
    geo.translate(0, fh * k * (bottom / fh - 0.5), 0); // feet on the ground
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: tint }));
    this.mesh.castShadow = true;
    this.body.add(this.mesh);
    this.root.add(this.body, blob(shadowR));
    this.frame(0);
  }

  /** A figure from its PixelLab sheet, `height` units tall measured on its front-facing still. */
  private static async fromCast(id: string, tint: THREE.Color, height: number, shadowR: number): Promise<Actor> {
    const meta = CAST_META[id]!;
    const s = await loadSheet(CAST_URL[id]!);
    const [top, bottom] = measure(s.data, s.img.width, 0, 0, meta.w, meta.h);
    return new Actor(s.tex.clone(), s.img.width, s.img.height, { kind: 'cast', id, meta }, meta.w, meta.h, height / Math.max(1, bottom - top), bottom, tint, shadowR);
  }

  /** A person, standing `height` units tall. */
  static async person(id: string, tint: THREE.Color, height = HEIGHT[id] ?? 1.65): Promise<Actor> {
    const c = castId(id);
    if (c) return Actor.fromCast(c, tint, height, 0.34 * height / 1.65);
    const a = await loadAtlas();
    const [ox, oy] = ATLAS.people[id] ?? ATLAS.people.juno!;
    const [top, bottom] = measure(a.data, a.img.width, ox, oy, 16, 24);
    return new Actor(a.tex.clone(), a.img.width, a.img.height, { kind: 'atlas', frames: null, origin: [ox, oy] }, 16, 24, height / Math.max(1, bottom - top), bottom, tint, 0.34);
  }

  /** An animal (or a machine): its sheet if it's been remade, else side-view frames from the atlas, mirrored to face its way. */
  static async critter(kind: string, tint: THREE.Color, height: number): Promise<Actor> {
    const c = castId(kind);
    if (c) {
      const a = await Actor.fromCast(c, tint, height, Math.max(0.2, height * 0.42));
      if (kind === 'strayBroken') { a.dim = 0.42; a.dir = 'E'; a.body.rotation.z = -0.12; a.setTint(tint); a.frame(0); }
      return a;
    }
    const a = await loadAtlas();
    const fr = ATLAS.critters[kind] ?? ATLAS.critters[BASE[kind] ?? kind.replace(/\d+$/, '')] ?? ATLAS.critters.goat!;
    const [x, y, w, h] = fr[0]!;
    const [top, bottom] = measure(a.data, a.img.width, x, y, w, h);
    return new Actor(a.tex.clone(), a.img.width, a.img.height, { kind: 'atlas', frames: fr, origin: [x, y] }, w, h, height / Math.max(1, bottom - top), bottom, tint, Math.max(0.18, w / 40));
  }

  /** Show one cell of the sheet; `flip` mirrors it (the side frames played for the other side). */
  private cell(x: number, y: number, w: number, h: number, flip = false): void {
    const { W, H } = this;
    this.tex.repeat.set(((flip ? -1 : 1) * w) / W, h / H);
    this.tex.offset.set((flip ? x + w : x) / W, 1 - (y + h) / H);
  }

  private frame(col: number): void {
    const src = this.src;
    if (src.kind === 'cast') {
      const m = src.meta;
      const name = this.animName();
      const anim = name ? m.anims[name] : undefined;
      if (anim) {
        // animations are drawn in four directions; a battle camera's diagonal plays the side it's nearest
        const want = this.posed ? (this.posed.includes('east') ? 'east' : this.posed.includes('west') ? 'west' : this.posed) : NAME[this.dir];
        const row = anim.rows[want] ?? (want === 'west' ? anim.rows.east : undefined);
        if (row !== undefined) { this.cell((col % anim.frames) * m.w, row * m.h, m.w, m.h, anim.rows[want] === undefined); return; }
      }
      const [r, c] = m.still[this.posed ?? NAME[this.dir]] ?? m.still[(this.posed ?? '').split('-')[0]!] ?? m.still.south!;
      this.cell(c * m.w, r * m.h, m.w, m.h);
      return;
    }
    if (src.frames) {
      const [x, y, w, h] = src.frames[col % src.frames.length]!;
      this.cell(x, y, w, h, this.dir === 'E');
      return;
    }
    const [ox, oy] = src.origin;
    this.cell(ox + col * 16, oy + ROW[this.dir] * 24, 16, 24);
  }

  /**
   * Battle staging: face world direction (fx, fz) as seen by a camera looking along (vx, vz) from yaw `yaw`.
   * The figure turns its plane to the camera and shows the one of its eight drawn directions that matches
   * (spec §13: the eight rotations are for exactly this). `null` hands it back to play.
   */
  pose(f: { fx: number; fz: number; vx: number; vz: number; yaw: number } | null): void {
    if (!f) { this.posed = null; this.body.rotation.y = 0; this.frame(0); return; }
    const l = Math.hypot(f.vx, f.vz) || 1, vx = f.vx / l, vz = f.vz / l;
    // in camera terms: toward the camera is south, the camera's right is east
    const toward = -(f.fx * vx + f.fz * vz), right = f.fx * -vz + f.fz * vx;
    const a = Math.atan2(right, toward); // 0 south, +90° east, ±180° north, −90° west
    const NAMES = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
    this.posed = NAMES[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]!;
    if (this.src.kind !== 'cast') this.dir = ({ south: 'S', east: 'E', north: 'N', west: 'W' } as Record<string, Dir4>)[this.posed.split('-')[0]!] ?? 'S';
    this.body.rotation.y = f.yaw;
    this.frame(0);
  }

  face(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    this.dir = Math.abs(dx) >= Math.abs(dz) * 0.9 ? (dx < 0 ? 'W' : 'E') : dz < 0 ? 'N' : 'S';
  }

  place(x: number, y: number, z: number): void {
    this.x = x; this.z = z;
    this.root.position.set(x, y, z);
  }

  /** Which drawn animation plays now, if any: a move played once, the run or walk, the fight stance, the idle. */
  private animName(): string | null {
    const src = this.src;
    if (src.kind !== 'cast' || this.dim < 1) return null;
    const a = src.meta.anims;
    if (this.once) return this.once.name;
    if (this.moving) return this.running && a.run ? 'run' : a.walk ? 'walk' : null;
    if (this.stance && a.stance) return 'stance';
    return a.idle ? 'idle' : null;
  }

  /** Whether this figure has a move drawn. */
  has(name: string): boolean { return this.src.kind === 'cast' && !!this.src.meta.anims[name]; }

  /** Play a drawn move once (a blow, a hit taken, a fall); `hold` keeps its last frame (a fall stays down). Resolves at its end. */
  play(name: string, hold = false): Promise<void> {
    if (!this.has(name)) return Promise.resolve();
    this.once?.done();
    return new Promise((done) => { this.once = { name, t: this.lt, hold, done }; this.frame(0); });
  }
  /** Back up from a held move. */
  release(): void { const o = this.once; this.once = null; o?.done(); }

  animate(dt: number, speed = 1): void {
    this.t += dt * speed;
    this.lt += dt;
    const src = this.src;
    if (src.kind === 'cast') {
      const name = this.animName();
      const anim = name ? src.meta.anims[name] : undefined;
      let col = anim ? Math.floor(this.t * anim.fps) : 0;
      if (this.once && anim) {
        col = Math.floor((this.lt - this.once.t) * anim.fps);
        if (col >= anim.frames) {
          col = anim.frames - 1;
          if (!this.once.hold) { const o = this.once; this.once = null; o.done(); col = 0; }
        }
      }
      this.frame(col);
      // nothing drawn: step with a small bob, or breathe slowly (spec §13.4)
      this.body.position.y = this.moving && !anim ? Math.abs(Math.sin(this.t * 9)) * 0.05 : 0;
      this.body.scale.y = !this.moving && !anim && this.dim === 1 ? 1 + Math.sin(this.t * 2.2) * 0.012 : 1;
      return;
    }
    if (this.posed) { this.body.scale.y = 1 + Math.sin(this.t * 2.2) * 0.012; return; }
    if (src.frames) {
      this.frame(this.moving ? Math.floor(this.t * 6) : 0);
      this.body.scale.y = 1;
      return;
    }
    this.frame(this.moving ? WALK[Math.floor(this.t * 7) % 4]! : 0);
    // idle: a slow breath so nobody looks pasted on (spec §13.4)
    this.body.scale.y = this.moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.012;
  }

  setTint(c: THREE.Color): void { (this.mesh.material as THREE.MeshBasicMaterial).color.copy(c).multiplyScalar(this.dim); }

  /** The dialogue card: this figure's standing frame, trimmed and upscaled (spec §13.4). */
  async card(): Promise<string> { return this.src.kind === 'cast' ? Actor.portrait(this.src.id) : Actor.atlasCard(this.src.origin); }

  private static cards = new Map<string, Promise<string>>();
  /** A person's picture beside their lines: their portrait if one was made, else their front-facing figure,
   *  trimmed, scaled up and facing left (standing at the right of the box). */
  static portrait(id: string): Promise<string> {
    const c = castId(id);
    if (!c) return Actor.atlasCard(ATLAS.people[id] ?? ATLAS.people.juno!);
    let p = Actor.cards.get(c);
    if (!p) {
      p = (async () => {
        if (PORTRAIT_URL[c]) return PORTRAIT_URL[c];
        const s = await loadSheet(CAST_URL[c]!);
        const m = CAST_META[c]!;
        const [l, t, r, b] = bounds(s.data, s.img.width, 0, 0, m.w, m.h);
        const k = Math.max(2, Math.floor(216 / (b - t)));
        const cv = document.createElement('canvas');
        cv.width = (r - l) * k; cv.height = (b - t) * k;
        const g = cv.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.translate(cv.width, 0); g.scale(-1, 1);
        g.drawImage(s.img, l, t, r - l, b - t, 0, 0, cv.width, cv.height);
        return cv.toDataURL();
      })();
      Actor.cards.set(c, p);
    }
    return p;
  }
  private static atlasCard(origin: [number, number]): Promise<string> {
    const key = origin.join(',');
    let p = Actor.cards.get(key);
    if (!p) {
      p = loadAtlas().then((a) => {
        const [ox, oy] = origin;
        const c = document.createElement('canvas');
        const k = 9;
        c.width = 16 * k; c.height = 24 * k;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.translate(16 * k, 0); g.scale(-1, 1); // facing left, standing at the right of the box
        g.drawImage(a.img, ox, oy, 16, 24, 0, 0, 16 * k, 24 * k);
        return c.toDataURL();
      });
      Actor.cards.set(key, p);
    }
    return p;
  }
}

/** Bust portraits made from the cast (src/assets/cast/portraits/<id>.png), for the dialogue box. */
const PORTRAIT_URL = Object.fromEntries(Object.entries(import.meta.glob('../assets/cast/portraits/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [k.split('/').pop()!.replace('.png', ''), v]));
