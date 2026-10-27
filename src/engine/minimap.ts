import type { BuiltPiece, Region } from './region';
import type { RGB } from './section';

/**
 * The mini map: always up in the top-right corner, north up like the camera.
 * Two ranges, close (a couple of screens around Juno) and far (most of the
 * region); M or a tap switches between them.
 *
 * The ground is painted once from every map's own painter, so streets run on
 * their true lines. Buildings and walls are drawn in as each map is built (its
 * solid footprints), and they stay drawn after it's taken down. Rooms show the
 * region where you went in, dimmed, under the room's name.
 */

export interface MapMark { x: number; z: number; kind: 'person' | 'door' | 'goal' }

const PPU = 2; // map pixels per world unit
const SPAN = [64, 230]; // world units across, close and far
const BRUSH: RGB[] = [[52, 48, 30], [60, 55, 34], [46, 42, 27]];

export class Minimap {
  private readonly box: HTMLDivElement;
  private readonly view: HTMLCanvasElement;
  private readonly label: HTMLDivElement;
  private base: HTMLCanvasElement | null = null;
  private bx = 0;
  private bz = 0;
  private far = false;
  private painted = new Set<string>();
  private drawn = new Set<string>();

  constructor(parent: HTMLElement) {
    this.box = document.createElement('div');
    this.box.className = 'minimap';
    this.view = document.createElement('canvas');
    this.label = document.createElement('div');
    this.label.className = 'mm-label';
    this.box.append(this.view, this.label);
    parent.appendChild(this.box);
    this.box.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.toggle(); });
    try { this.far = localStorage.getItem('longnoon.minimap') === 'far'; } catch { /* storage off: start close */ }
  }

  toggle(): void {
    this.far = !this.far;
    this.box.classList.toggle('far', this.far);
    try { localStorage.setItem('longnoon.minimap', this.far ? 'far' : 'close'); } catch { /* fine */ }
  }

  set hidden(v: boolean) { this.box.style.display = v ? 'none' : ''; }

  /** Paint the region's ground, one map at a time between frames, nearest first. */
  async setRegion(region: Region, near: { x: number; z: number }): Promise<void> {
    const x0 = Math.min(...region.plan.map((p) => p.ox)) - 40, z0 = Math.min(...region.plan.map((p) => p.oz)) - 40;
    const x1 = Math.max(...region.plan.map((p) => p.ox + p.cols)) + 40, z1 = Math.max(...region.plan.map((p) => p.oz + p.rows)) + 40;
    // the same region rebuilt (the town relights at Lamp and at the white): keep the map as drawn
    if (this.base && this.bx === x0 && this.bz === z0 && this.base.width === (x1 - x0) * PPU && this.base.height === (z1 - z0) * PPU) {
      for (const b of region.pieces) this.addPiece(b);
      return;
    }
    this.painted.clear();
    this.drawn.clear();
    const c = document.createElement('canvas');
    c.width = (x1 - x0) * PPU; c.height = (z1 - z0) * PPU;
    const g = c.getContext('2d')!;
    // the brush past the maps' edges
    const img = g.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const k = (Math.sin(x * 1.7 + y * 0.3) * Math.sin(y * 1.3 - x * 0.2) + 1) / 2;
        const col = BRUSH[Math.floor(k * 2.99)]!, i = (y * c.width + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    this.base = c; this.bx = x0; this.bz = z0;
    this.box.classList.toggle('far', this.far);
    const order = [...region.plan].sort((a, b) => Math.hypot(a.ox + a.cols / 2 - near.x, a.oz + a.rows / 2 - near.z) - Math.hypot(b.ox + b.cols / 2 - near.x, b.oz + b.rows / 2 - near.z));
    for (const p of order) {
      if (this.painted.has(p.id)) continue;
      const pi = g.createImageData(p.cols * PPU, p.rows * PPU);
      let t = performance.now();
      for (let y = 0; y < p.rows * PPU; y++) {
        for (let x = 0; x < p.cols * PPU; x++) {
          const col = region.groundColor(p.ox + (x + 0.5) / PPU, p.oz + (y + 0.5) / PPU) ?? BRUSH[0]!;
          const i = (y * p.cols * PPU + x) * 4;
          pi.data[i] = col[0] * 0.82; pi.data[i + 1] = col[1] * 0.8; pi.data[i + 2] = col[2] * 0.76; pi.data[i + 3] = 255;
        }
        // hand the frame back every few milliseconds, so painting never stalls a step
        if (performance.now() - t > 6) { await new Promise((r) => setTimeout(r, 0)); t = performance.now(); }
      }
      // softened a touch: the painters' grain is for the ground at 16 px a unit, not a map at 2
      const tmp = document.createElement('canvas');
      tmp.width = pi.width; tmp.height = pi.height;
      tmp.getContext('2d')!.putImageData(pi, 0, 0);
      g.save();
      g.filter = 'blur(0.7px)';
      g.drawImage(tmp, (p.ox - x0) * PPU, (p.oz - z0) * PPU);
      g.restore();
      this.painted.add(p.id);
      // a map built before its ground was painted gets its buildings now
      const b = region.pieces.find((q) => q.id === p.id);
      if (b) { this.drawn.delete(b.id); this.addPiece(b); }
    }
  }

  /** Draw a built map's solid footprints (buildings, walls, tanks, trunks) onto the ground. */
  addPiece(b: BuiltPiece): void {
    if (!this.base || this.drawn.has(b.id) || !this.painted.has(b.id)) return;
    this.drawn.add(b.id);
    const g = this.base.getContext('2d')!;
    for (const s of b.chunk.solids) {
      const w = (s.x1 - s.x0) * PPU, h = (s.z1 - s.z0) * PPU;
      if (w * h < 1.2) continue; // posts and stems: too small to read
      const x = (s.x0 + b.ox - this.bx) * PPU, y = (s.z0 + b.oz - this.bz) * PPU;
      g.fillStyle = '#1c1a17';
      g.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
      g.fillStyle = w > 6 && h > 6 ? '#6e6252' : '#4a443a';
      g.fillRect(x, y, w, h);
    }
  }

  /** Redraw around (x, z). `dir` is the way Juno faces; `room` dims the map under a room's name. */
  draw(x: number, z: number, dir: 'N' | 'S' | 'E' | 'W', marks: MapMark[], place: string, room = false): void {
    const v = this.view, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = this.box.clientWidth;
    if (!css || !this.base) return;
    const W = Math.round(css * dpr);
    if (v.width !== W) { v.width = W; v.height = W; }
    const g = v.getContext('2d')!;
    const span = SPAN[this.far ? 1 : 0]!, k = W / span; // view pixels per unit
    g.imageSmoothingEnabled = !this.far;
    g.fillStyle = '#16140f';
    g.fillRect(0, 0, W, W);
    const sx = (x - span / 2 - this.bx) * PPU, sz = (z - span / 2 - this.bz) * PPU;
    g.drawImage(this.base, sx, sz, span * PPU, span * PPU, 0, 0, W, W);
    const at = (px: number, pz: number): [number, number] => [(px - x) * k + W / 2, (pz - z) * k + W / 2];
    const r = Math.max(2, W / 70);
    for (const m of marks) {
      const [mx, my] = at(m.x, m.z);
      if (m.kind === 'goal') continue;
      if (mx < -r || my < -r || mx > W + r || my > W + r) continue;
      if (m.kind === 'door') { g.fillStyle = '#ffcf8a'; g.fillRect(mx - r * 0.7, my - r * 0.7, r * 1.4, r * 1.4); }
      else { g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(mx, my, r * 0.75, 0, Math.PI * 2); g.fill(); }
    }
    // the goal: a gold diamond, held at the edge when it's off the map
    for (const m of marks) {
      if (m.kind !== 'goal') continue;
      let [mx, my] = at(m.x, m.z);
      const pad = r * 2.2, cx = W / 2, cy = W / 2;
      const out = mx < pad || my < pad || mx > W - pad || my > W - pad;
      if (out) {
        const dx = mx - cx, dy = my - cy, s = (W / 2 - pad) / Math.max(Math.abs(dx), Math.abs(dy));
        mx = cx + dx * s; my = cy + dy * s;
      }
      g.save();
      g.translate(mx, my); g.rotate(Math.PI / 4);
      g.fillStyle = '#c8a050'; g.strokeStyle = '#1c1a17'; g.lineWidth = Math.max(1, dpr);
      const q = r * (out ? 1.1 : 1.4);
      g.fillRect(-q, -q, q * 2, q * 2); g.strokeRect(-q, -q, q * 2, q * 2);
      g.restore();
    }
    // Juno: an arrowhead the way she faces
    const a = { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI }[dir];
    g.save();
    g.translate(W / 2, W / 2); g.rotate(a);
    const q = r * 1.9;
    g.beginPath(); g.moveTo(q, 0); g.lineTo(-q * 0.7, q * 0.68); g.lineTo(-q * 0.35, 0); g.lineTo(-q * 0.7, -q * 0.68); g.closePath();
    g.fillStyle = '#fff6e0'; g.strokeStyle = '#1c1a17'; g.lineWidth = Math.max(1.5, dpr * 1.2);
    g.stroke(); g.fill();
    g.restore();
    if (room) { g.fillStyle = 'rgba(14,13,12,0.55)'; g.fillRect(0, 0, W, W); }
    if (this.label.textContent !== place) this.label.textContent = place;
  }
}
