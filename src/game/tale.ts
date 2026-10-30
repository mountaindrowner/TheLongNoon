import * as THREE from 'three';

/**
 * The old tale's painted panels, from the first version
 * (legacy/poc2 19-intro-cinematic.js), drawing for drawing, with two more for the
 * fuller telling (the long summers, the war that stopped the planes): a 320 × 150
 * firelit sheet, each panel cross-fading into the next while Papá talks. Ink on
 * firelight, like shadow puppets. Since 2026-10-30 the sheet hangs in the world,
 * on a line behind the fire (`texture`); the old overlay is still there for any
 * scene without one.
 */

type G = CanvasRenderingContext2D;
const INK = '#1c0d07', LIGHT = '#fff3cc';

function sheet(g: G, t: number): void {
  const fl = 0.9 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 23.7);
  const gr = g.createRadialGradient(160, 118, 10, 160, 95, 190);
  gr.addColorStop(0, `rgba(${(255 * fl) | 0},${(200 * fl) | 0},${(120 * fl) | 0},1)`);
  gr.addColorStop(0.55, `rgba(${(226 * fl) | 0},${(140 * fl) | 0},${(70 * fl) | 0},1)`);
  gr.addColorStop(1, '#5a2410');
  g.fillStyle = gr;
  g.fillRect(0, 0, 320, 150);
}
const R = (g: G, x: number, y: number, w: number, h: number, c: string): void => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const O = (g: G, x: number, y: number, r: number, c: string): void => { g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 6.283); g.fill(); };

function skyline(g: G, sink = 0, broken = false): void {
  const B = [[8, 34], [30, 52], [52, 26], [70, 64], [94, 40], [118, 30], [136, 72], [162, 44], [186, 56], [206, 30], [226, 62], [250, 38], [272, 50], [294, 28]] as const;
  B.forEach(([x, h], i) => {
    const hh = h * (1 - sink);
    R(g, x, 130 - hh, 18, hh, INK);
    if (broken && i % 2 === 0) R(g, x + 12, 130 - hh, 6, 6 + (i % 3) * 4, '#c97a3a');
    if (!broken && hh > 20) for (let wy = 130 - hh + 5; wy < 126; wy += 8) for (let wx = x + 3; wx < x + 15; wx += 6) if ((wx * 7 + wy * 3 + i) % 5 < 2) R(g, wx, wy, 2, 3, '#e8a05a');
  });
  R(g, 0, 130, 320, 20, INK);
}
function person(g: G, x: number, y: number, s = 1, arms = 0, c = INK): void {
  O(g, x, y - 14 * s, 3 * s, c);
  g.fillStyle = c;
  g.beginPath(); g.moveTo(x - 4 * s, y); g.lineTo(x + 4 * s, y); g.lineTo(x + 1.5 * s, y - 11 * s); g.lineTo(x - 1.5 * s, y - 11 * s); g.fill();
  R(g, x - 5 * s, y - 10 * s - arms * 3 * s, 1.5 * s, 5 * s, c);
  R(g, x + 3.5 * s, y - 10 * s - arms * 3 * s, 1.5 * s, 5 * s, c);
}
function drone(g: G, x: number, y: number, s = 1, c = INK): void {
  R(g, x - 12 * s, y, 24 * s, 1.6 * s, c); R(g, x - 3 * s, y - 1.5 * s, 7 * s, 3 * s, c);
  R(g, x - 11 * s, y - 2 * s, 1.4 * s, 3 * s, c); R(g, x + 10 * s, y - 2 * s, 1.4 * s, 3 * s, c);
}

const PANELS: Record<string, (g: G, t: number) => void> = {
  heat(g, t) {
    // a sun too big, the ground cracked, people walking away with everything they own
    O(g, 160, 40, 26 + Math.sin(t * 2) * 1.5, LIGHT);
    for (let i = 0; i < 9; i++) { const y = 74 + i * 5; R(g, 0, y + Math.sin(t * 3 + i) * 1.2, 320, 1, `rgba(255,243,204,${0.08 + 0.02 * i})`); }
    R(g, 0, 122, 320, 28, INK);
    for (let i = 0; i < 12; i++) R(g, i * 27 + 6, 124 + (i % 3) * 3, 14, 1, '#c97a3a');
    for (let i = 0; i < 7; i++) {
      const x = 330 - ((t * 10 + i * 46) % 380), bob = Math.abs(Math.sin(t * 4 + i)) * 1.5;
      person(g, x, 122 - bob, 0.95 - (i % 3) * 0.12);
      R(g, x - 2, 103 - bob, 7, 6, INK); // a bundle on the back
    }
  },
  war(g, t) {
    // a dish on its tower, the flash, the planes coming down out of the sky
    skyline(g, 0.2, true);
    R(g, 196, 72, 6, 58, INK); O(g, 199, 66, 15, INK); R(g, 186, 64, 26, 4, '#1c0d07');
    const boom = Math.max(0, Math.min(1, (t - 1.2) / 0.5));
    if (boom > 0) { O(g, 199, 66, 10 + boom * 40, `rgba(255,243,204,${0.9 - boom * 0.6})`); O(g, 199, 66, 6 + boom * 18, `rgba(255,170,90,${1 - boom * 0.5})`); }
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, t - 2 - i * 0.9), x = 60 + i * 80 + k * 14, y = 24 + i * 6 + k * k * 9;
      if (y < 128) { g.save(); g.translate(x, y); g.rotate(Math.min(0.9, k * 0.4)); drone(g, 0, 0, 0.8); g.restore(); }
    }
    for (const x of [40, 54, 268]) person(g, x, 130, 0.9, 1);
  },
  rain(g, t) {
    skyline(g);
    for (let k = 0; k < 3; k++) {
      const cx = ((k * 120 + t * 6) % 420) - 50, cy = 26 + k * 7;
      for (const [dx, dy, r] of [[0, 0, 14], [14, -4, 17], [30, 0, 13], [16, 6, 15]] as const) O(g, cx + dx, cy + dy, r, 'rgba(28,13,7,0.88)');
    }
    g.strokeStyle = 'rgba(28,13,7,0.7)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 70; i++) { const x = (((i * 37) % 330) + t * 18) % 330 - 5, y = (((i * 53) % 90) + t * 130) % 92 + 44; g.moveTo(x, y); g.lineTo(x - 2, y + 6); }
    g.stroke();
    const j = Math.abs(Math.sin(t * 4)) * 4;
    person(g, 205, 130 - j, 1, 1); person(g, 190, 130, 1.15, 0);
  },
  machines(g, t) {
    O(g, 252, 40, 17, LIGHT);
    R(g, 0, 0, 320, 150, `rgba(28,13,7,${Math.min(0.32, t * 0.03)})`);
    skyline(g);
    for (let i = 0; i < 5; i++) {
      const x = ((t * 28 + i * 74) % 420) - 50, y = 24 + i * 9;
      for (let k = 1; k < 14; k++) { const px = x - k * 7, sp = k * 0.8; O(g, px, y + Math.sin(k + t) * sp * 0.5, 1.2 + sp * 0.35, 'rgba(28,13,7,0.28)'); }
      drone(g, x, y, 0.8);
    }
  },
  veil(g, t) {
    skyline(g);
    const N = 180;
    for (let i = 0; i < N; i++) {
      const die = 1.5 + (((i * 7919) % N) / N) * 9;
      if (t > die) continue;
      const x = (i * 31) % 320, y = 18 + Math.sin(x * 0.05 + t * 0.6) * 7 + ((i * 13) % 9) - 4;
      const tw = 0.5 + 0.5 * Math.sin(t * 6 + i);
      R(g, x, y, 1.4, 1.4, `rgba(255,246,208,${0.5 + 0.5 * tw})`);
    }
    const sc = Math.max(0, 1 - t / 10);
    for (let k = 0; k < 2; k++) { const cx = 70 + k * 150; for (const [dx, dy, r] of [[0, 0, 12], [13, -3, 14], [26, 0, 11]] as const) O(g, cx + dx, 46 + dy, r * sc, 'rgba(28,13,7,0.85)'); }
    for (let i = 0; i < 2; i++) { const x = ((t * 24 + i * 170) % 420) - 50; drone(g, x, 62 + i * 10, 0.7); }
  },
  white(g, t) {
    const w = Math.min(0.85, t * 0.11);
    O(g, 250, 46, 17 + Math.min(110, t * 12), LIGHT);
    skyline(g, Math.min(0.55, t * 0.06));
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 45, fall = Math.max(0, Math.min(1, (t - 1.5 - i * 0.8) / 0.7));
      g.save(); g.translate(x, 130); g.rotate(fall * 1.45 * (i % 2 ? 1 : -1)); person(g, 0, 0, 1); g.restore();
    }
    R(g, 0, 0, 320, 150, `rgba(255,248,226,${w})`);
  },
  below(g, t) {
    R(g, 0, 0, 320, 70, 'rgba(255,240,200,0.35)'); O(g, 250, 24, 14, LIGHT); R(g, 0, 70, 320, 80, INK); R(g, 30, 96, 260, 22, '#7a3414'); R(g, 150, 70, 10, 26, '#7a3414');
    for (let k = 0; k < 5; k++) R(g, 150, 74 + k * 5, 10, 1.5, INK);
    const sx = ((t * 14) % 380) - 30;
    R(g, sx - 10, 58, 20, 10, INK); O(g, sx - 6, 69, 2.5, INK); O(g, sx, 69, 2.5, INK); O(g, sx + 6, 69, 2.5, INK); R(g, sx + 7, 60, 3, 3, '#ff6b3a');
    const wx = 320 - ((t * 9) % 400);
    R(g, wx - 6, 40, 12, 16, INK); R(g, wx - 5, 56, 3, 14, INK); R(g, wx + 2, 56, 3, 14, INK); R(g, wx - 2, 36, 4, 4, '#ff6b3a');
    for (const [x, i] of [[60, 0], [100, 1], [200, 2], [245, 3]] as const) {
      person(g, x, 118, 0.85, 0, INK);
      const fl = 0.6 + 0.4 * Math.sin(t * 9 + i * 2);
      O(g, x + 5, 104, 3.5, `rgba(255,210,122,${0.25 * fl})`); O(g, x + 5, 104, 1.6, `rgba(255,226,160,${fl})`);
    }
  },
  circling(g, t) {
    R(g, 0, 0, 320, 150, 'rgba(255,248,226,0.35)'); O(g, 262, 30, 16, LIGHT); skyline(g, 0.35, true);
    const x = -70 + t * 13, y = 36 + Math.sin(t * 0.8) * 2;
    R(g, x - 34, y, 68, 2.2, INK); R(g, x - 6, y - 2.5, 12, 4.5, INK);
    for (const dx of [-24, -9, 9, 24]) R(g, x + dx - 1, y + 2, 2, 3, INK);
    person(g, 40, 130, 1); person(g, 52, 130, 0.75);
  },
};

/** The sheet over the fire. `set` changes the panel (null fades it all out); call `draw` every frame. */
export class Tale {
  private readonly wrap: HTMLDivElement;
  private readonly g: G;
  private cur: string | null = null;
  private prev: string | null = null;
  private t = 0;
  private pt = 0;
  private f = 1;
  private readonly cv: HTMLCanvasElement;
  private tex: THREE.CanvasTexture | null = null;
  private since = 1;

  constructor(parent: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'tale';
    const c = document.createElement('canvas');
    c.width = 320; c.height = 150;
    this.cv = c;
    this.wrap.appendChild(c);
    parent.appendChild(this.wrap);
    // kept on the CPU: a canvas drawn on the GPU stalls the frame each time WebGL reads it back for the cloth
    this.g = c.getContext('2d', { willReadFrequently: true })!;
    this.g.imageSmoothingEnabled = false;
  }

  set(id: string | null): void {
    this.prev = this.cur; this.pt = this.t; this.cur = id; this.t = 0; this.f = 0;
    if (!this.tex) this.wrap.classList.toggle('show', !!id || !!this.prev);
  }

  /** Put it away at once (a skipped tale). */
  clear(): void { this.cur = this.prev = null; this.wrap.classList.remove('show'); }

  /** The sheet as a texture for a cloth hung in the scene: from now on it's drawn there, blank between panels. */
  texture(): THREE.CanvasTexture {
    if (!this.tex) {
      this.tex = new THREE.CanvasTexture(this.cv);
      this.tex.magFilter = THREE.NearestFilter;
      this.tex.minFilter = THREE.LinearFilter;
      this.tex.generateMipmaps = false;
      this.tex.colorSpace = THREE.SRGBColorSpace;
      this.wrap.classList.remove('show');
    }
    return this.tex;
  }
  /** Back to the overlay (the scene took its cloth down). */
  untexture(): void { this.tex?.dispose(); this.tex = null; }

  draw(dt: number): void {
    if (this.tex) {
      // in the world the cloth is always there: firelit and blank, or with the tale on it; redrawn about 15 times
      // a second (shadow puppets flicker; the upload isn't free)
      this.t += dt; this.pt += dt; this.f = Math.min(1, this.f + dt / 0.8);
      if ((this.since += dt) < 1 / 15) return;
      this.since = 0;
      const g = this.g;
      sheet(g, this.t);
      if (this.prev && this.f < 1) { g.globalAlpha = 1 - this.f; PANELS[this.prev]?.(g, this.pt); g.globalAlpha = 1; }
      if (this.cur) { g.globalAlpha = this.f; PANELS[this.cur]?.(g, this.t); g.globalAlpha = 1; }
      else if (this.f >= 1) this.prev = null;
      this.tex.needsUpdate = true;
      return;
    }
    if (!this.cur && !this.prev) return;
    this.t += dt; this.pt += dt; this.f = Math.min(1, this.f + dt / 0.8);
    const g = this.g;
    sheet(g, this.t);
    if (this.prev && this.f < 1) { g.globalAlpha = 1 - this.f; PANELS[this.prev]?.(g, this.pt); g.globalAlpha = 1; }
    if (this.cur) { g.globalAlpha = this.f; PANELS[this.cur]?.(g, this.t); g.globalAlpha = 1; }
    else if (this.f >= 1) { this.prev = null; this.wrap.classList.remove('show'); }
  }
}
