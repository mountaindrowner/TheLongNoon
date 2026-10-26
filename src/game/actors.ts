import * as THREE from 'three';
import { blob, pixelTex } from '../engine/sprites';
import charsUrl from '../assets/chars-poc2.png';

/**
 * Characters drawn from the proof-of-concept sprite atlas (16×24 frames,
 * rows down/left/right/up, 3 columns, walk order 1-0-2-0), placed the way the
 * style spec places sprites (§13.4): an upright plane facing the camera,
 * MeshBasicMaterial tinted by the mood, alpha-cut, a soft blob shadow, and
 * sized by measuring the drawn figure so it stands its target height.
 * These are placeholders until the cast is regenerated as 64px, 8-direction
 * sprites (spec §13); the engine's RotHero already plays those.
 */

export type Dir4 = 'S' | 'W' | 'E' | 'N';
const ROW: Record<Dir4, number> = { S: 0, W: 1, E: 2, N: 3 };
const WALK = [1, 0, 2, 0];

/** Where each figure sits in the atlas (from the old manifest). */
export const ATLAS = {
  people: { juno: [0, 0], kit: [49, 0], lupe: [98, 0], chayo: [147, 0], beto: [196, 0], ruben: [0, 97], tavo: [49, 97], nacho: [98, 97], fina: [147, 97], memo: [196, 97], nina: [0, 194], tona: [49, 194], elias: [98, 194], rosa: [147, 194], kidjuno: [196, 194] } as Record<string, [number, number]>,
  critters: { goat: [[141, 291, 18, 15], [160, 291, 18, 15]], chicken: [[179, 291, 10, 10], [190, 291, 10, 10]], coyote: [[87, 291, 26, 17], [114, 291, 26, 17]] } as Record<string, Array<[number, number, number, number]>>,
};

interface Atlas { img: HTMLImageElement; data: Uint8ClampedArray; tex: THREE.Texture }
let atlas: Promise<Atlas> | null = null;
function loadAtlas(): Promise<Atlas> {
  atlas ??= new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      res({ img, data: g.getImageData(0, 0, img.width, img.height).data, tex: pixelTex(new THREE.Texture(img)) });
    };
    img.onerror = rej;
    img.src = charsUrl;
  });
  return atlas;
}

/** Top and bottom drawn rows (alpha > 128) inside a rect of the atlas. */
function measure(data: Uint8ClampedArray, W: number, x: number, y: number, w: number, h: number): [number, number] {
  let top = h, bottom = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (data[((y + j) * W + x + i) * 4 + 3]! > 128) { top = Math.min(top, j); bottom = Math.max(bottom, j + 1); }
  return [top, bottom];
}

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

  private constructor(tex: THREE.Texture, private readonly W: number, private readonly H: number, private readonly frames: Array<[number, number, number, number]> | null, private readonly origin: [number, number], fw: number, fh: number, k: number, bottom: number, tint: THREE.Color, shadowR: number) {
    this.tex = tex;
    const geo = new THREE.PlaneGeometry(fw * k, fh * k);
    geo.translate(0, fh * k * (bottom / fh - 0.5), 0); // feet on the ground
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: tint }));
    this.mesh.castShadow = true;
    this.body.add(this.mesh);
    this.root.add(this.body, blob(shadowR));
    this.frame(0);
  }

  /** A person from the atlas, standing `height` units tall. */
  static async person(id: string, tint: THREE.Color, height = 1.65): Promise<Actor> {
    const a = await loadAtlas();
    const [ox, oy] = ATLAS.people[id] ?? ATLAS.people.juno!;
    const [top, bottom] = measure(a.data, a.img.width, ox, oy, 16, 24);
    const tex = a.tex.clone(); // shares the uploaded image; only the window differs
    return new Actor(tex, a.img.width, a.img.height, null, [ox, oy], 16, 24, height / Math.max(1, bottom - top), bottom, tint, 0.34);
  }

  /** An animal from the atlas: side-view frames, mirrored to face its way. */
  static async critter(kind: string, tint: THREE.Color, height: number): Promise<Actor> {
    const a = await loadAtlas();
    const fr = ATLAS.critters[kind]!;
    const [x, y, w, h] = fr[0]!;
    const [top, bottom] = measure(a.data, a.img.width, x, y, w, h);
    return new Actor(a.tex.clone(), a.img.width, a.img.height, fr, [x, y], w, h, height / Math.max(1, bottom - top), bottom, tint, Math.max(0.18, w / 40));
  }

  private frame(col: number): void {
    const { W, H } = this;
    if (this.frames) {
      const [x, y, w, h] = this.frames[col % this.frames.length]!;
      const flip = this.dir === 'E';
      this.tex.repeat.set(((flip ? -1 : 1) * w) / W, h / H);
      this.tex.offset.set((flip ? x + w : x) / W, 1 - (y + h) / H);
      return;
    }
    const [ox, oy] = this.origin;
    this.tex.repeat.set(16 / W, 24 / H);
    this.tex.offset.set((ox + col * 16) / W, 1 - (oy + ROW[this.dir] * 24 + 24) / H);
  }

  face(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    this.dir = Math.abs(dx) >= Math.abs(dz) * 0.9 ? (dx < 0 ? 'W' : 'E') : dz < 0 ? 'N' : 'S';
  }

  place(x: number, y: number, z: number): void {
    this.x = x; this.z = z;
    this.root.position.set(x, y, z);
  }

  animate(dt: number, speed = 1): void {
    this.t += dt * speed;
    if (this.frames) {
      this.frame(this.moving ? Math.floor(this.t * 6) : 0);
      this.body.scale.y = 1;
      return;
    }
    this.frame(this.moving ? WALK[Math.floor(this.t * 7) % 4]! : 0);
    // idle: a slow breath so nobody looks pasted on (spec §13.4)
    this.body.scale.y = this.moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.012;
  }

  setTint(c: THREE.Color): void { (this.mesh.material as THREE.MeshBasicMaterial).color.copy(c); }

  /** The dialogue card: this figure's standing frame, trimmed and upscaled (spec §13.4). */
  async card(): Promise<string> {
    const a = await loadAtlas();
    const [ox, oy] = this.origin;
    const c = document.createElement('canvas');
    const k = 9;
    c.width = 16 * k; c.height = 24 * k;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.translate(16 * k, 0); g.scale(-1, 1); // facing left, standing at the right of the box
    g.drawImage(a.img, ox, oy, 16, 24, 0, 0, 16 * k, 24 * k);
    return c.toDataURL();
  }
}
