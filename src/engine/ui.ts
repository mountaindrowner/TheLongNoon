/**
 * The HD-2D overworld UI: a clean dark panel with a thin gold rule, a name
 * plate, and the speaker's own sprite (upscaled, facing left) standing at the
 * right of the box, tucked behind the panel (Mark's notes). Plus the area
 * title card, the interact prompt, and touch controls.
 */

export interface Speech { name?: string; portrait?: string; lines: string[] }

/** 4×4 ordered-dither thresholds, for the pixel dissolve. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
};

export class UI {
  readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly box: HTMLDivElement;
  private readonly portrait: HTMLImageElement;
  private readonly plate: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private readonly more: HTMLDivElement;
  private speech: Speech | null = null;
  private line = 0;
  private shown = 0;
  private onClose: (() => void) | null = null;
  /** A scripted line waiting to be read (`speak`): the box stays open after it. */
  private spoken: (() => void) | null = null;
  private readonly choices: HTMLDivElement;
  private chosen: ((i: number) => void) | null = null;
  /** Called on each typed character with the speaker's name (a voice blip). */
  onType: ((name: string) => void) | null = null;

  /** Touch stick vector in [-1,1]², and a one-shot A press. */
  stick = { x: 0, y: 0 };
  private aPressed = false;

  constructor(host: HTMLElement) {
    this.root = el('div', 'ui', host);
    this.prompt = el('div', 'prompt', this.root);
    this.box = el('div', 'dlg', this.root);
    this.portrait = el('img', 'dlg-portrait', this.box);
    // a drawn bust portrait (square, 128 or 160 px) is shown at whole-pixel scale; a figure card at its own size
    this.portrait.onload = () => { const i = this.portrait; this.portrait.classList.toggle('bust', i.naturalWidth === i.naturalHeight && i.naturalWidth <= 160); };
    const panel = el('div', 'dlg-panel', this.box);
    this.plate = el('div', 'dlg-name', panel);
    this.text = el('div', 'dlg-text', panel);
    this.more = el('div', 'dlg-more', panel);
    this.more.textContent = '▼';
    this.choices = el('div', 'dlg-choices', panel);
    this.box.addEventListener('pointerdown', (e) => { e.preventDefault(); this.aPressed = true; });
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) this.touchControls();
  }

  get talking(): boolean { return this.speech !== null; }

  /** True once per A press (keyboard handled by the caller; touch here). */
  takeA(): boolean {
    const a = this.aPressed;
    this.aPressed = false;
    return a;
  }

  titleCard(title: string, sub: string): void {
    this.root.querySelectorAll('.title-card').forEach((e) => e.remove());
    const c = el('div', 'title-card', this.root);
    el('div', 'tc-rule', c);
    el('div', 'tc-title', c).textContent = title;
    el('div', 'tc-sub', c).textContent = sub;
    el('div', 'tc-rule', c);
    setTimeout(() => c.classList.add('out'), 3200);
    setTimeout(() => c.remove(), 4600);
  }

  hint(html: string): void {
    const h = el('div', 'hint', this.root);
    h.innerHTML = html;
    setTimeout(() => h.classList.add('out'), 9000);
  }

  private badgeEl: HTMLDivElement | null = null;
  badge(html: string): void {
    this.badgeEl ??= el('div', 'badge', this.root);
    this.badgeEl.innerHTML = html;
  }

  private fadeEl: HTMLDivElement | null = null;
  /** Fade the screen to black, or another colour (true), or back in (false); resolves when done. */
  fade(on: boolean, ms = 450, color = '#000'): Promise<void> {
    this.fadeEl ??= el('div', 'fade', this.root);
    const f = this.fadeEl;
    if (on) f.style.background = color;
    f.style.transitionDuration = `${ms}ms`;
    void f.offsetWidth;
    f.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms));
  }

  private disEl: HTMLCanvasElement | null = null;
  /** A quick pixel dissolve to black (true) or back (false): cells drop out in a
   *  dithered order, so it reads as "next area" rather than a slow fade. */
  dissolve(on: boolean, ms = 280): Promise<void> {
    const c = (this.disEl ??= el('canvas', 'dissolve', this.root));
    const cell = 12, w = Math.ceil(window.innerWidth / cell), h = Math.ceil(window.innerHeight / cell);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const th = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const hash = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        th[y * w + x] = ((BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16) * 0.65 + Math.abs(hash) * 0.35;
      }
    for (let i = 0; i < w * h; i++) { img.data[i * 4] = 11; img.data[i * 4 + 1] = 12; img.data[i * 4 + 2] = 14; }
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (): void => {
        const k = Math.min(1, (performance.now() - t0) / ms), v = on ? k : 1 - k;
        for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = th[i]! < v ? 255 : 0;
        ctx.putImageData(img, 0, 0);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  /** The small place-name tag shown each time you enter a section. */
  nameTag(text: string, sub = ''): void {
    this.root.querySelectorAll('.name-tag').forEach((e) => e.remove());
    const t = el('div', 'name-tag', this.root);
    el('div', 'nt-title', t).textContent = text;
    if (sub) el('div', 'nt-sub', t).textContent = sub;
    setTimeout(() => t.classList.add('out'), 1700);
    setTimeout(() => t.remove(), 2600);
  }

  private travelImg = new Map<string, Promise<HTMLImageElement>>();
  /** The travel card between regions: the world map, a dotted line drawing from
   *  here to there, and one line of text. Shown over the dissolve's black. */
  async travel(s: { img: string; box: [number, number, number, number]; path: Array<[number, number]>; line: string; ms?: number }): Promise<void> {
    let p = this.travelImg.get(s.img);
    if (!p) {
      p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s.img; });
      this.travelImg.set(s.img, p);
    }
    const img = await p.catch(() => null);
    const card = el('div', 'travel-card', this.root);
    const cv = el('canvas', 'tv-map', card);
    el('div', 'tv-line', card).textContent = s.line;
    const [bx0, by0, bx1, by1] = s.box;
    const H = Math.min(window.innerHeight * 0.62, 560), W = H * ((bx1 - bx0) / (by1 - by0));
    const dpr = Math.min(window.devicePixelRatio, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${Math.round(W)}px`; cv.style.height = `${Math.round(H)}px`;
    const ctx = cv.getContext('2d')!;
    const k = (W * dpr) / (bx1 - bx0);
    const P = (q: [number, number]): [number, number] => [(q[0] - bx0) * k, (q[1] - by0) * k];
    // path length, for drawing it out over time
    const pts = s.path.map(P);
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
    const total = seg.reduce((a, b) => a + b, 0);
    const ms = s.ms ?? 2600;
    void card.offsetWidth;
    card.classList.add('on');
    await new Promise<void>((res) => {
      const t0 = performance.now();
      const draw = (): void => {
        const e = Math.min(1, (performance.now() - t0) / ms), d = Math.min(1, Math.max(0, (e - 0.15) / 0.6)) * total;
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (img) ctx.drawImage(img, bx0, by0, bx1 - bx0, by1 - by0, 0, 0, cv.width, cv.height);
        else { ctx.fillStyle = '#e6d6b4'; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.save();
        ctx.strokeStyle = '#6b2a1e'; ctx.lineWidth = 4 * dpr; ctx.setLineDash([9 * dpr, 7 * dpr]); ctx.lineCap = 'round';
        ctx.beginPath();
        let left = d, head = pts[0]!;
        ctx.moveTo(head[0], head[1]);
        for (let i = 0; i < seg.length && left > 0; i++) {
          const a = pts[i]!, b = pts[i + 1]!, f = Math.min(1, left / seg[i]!);
          head = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
          ctx.lineTo(head[0], head[1]);
          left -= seg[i]!;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#efe3c8'; ctx.strokeStyle = '#6b2a1e'; ctx.lineWidth = 3 * dpr;
        ctx.beginPath(); ctx.arc(head[0], head[1], 7 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        if (e < 1) requestAnimationFrame(draw); else res();
      };
      draw();
    });
    card.classList.remove('on');
    await new Promise((r) => setTimeout(r, 380));
    card.remove();
  }

  /** The floating "talk" prompt, placed at a screen point (px) or hidden. */
  showPrompt(label: string | null, x = 0, y = 0): void {
    if (!label || this.talking) { this.prompt.classList.remove('on'); return; }
    this.prompt.innerHTML = `<b>${'ontouchstart' in window ? 'A' : 'E'}</b>${label}`;
    this.prompt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    this.prompt.classList.add('on');
  }

  /** One scripted line. Resolves once it's read; the box stays up for the next (close it with `endTalk`). */
  speak(name: string, text: string, portrait?: string): Promise<void> {
    return new Promise((res) => {
      this.choices.replaceChildren();
      this.say({ name: name || undefined, portrait, lines: [text] });
      this.spoken = res;
    });
  }

  /** A question with buttons under it; resolves with the option picked. */
  choose(q: string, opts: string[]): Promise<number> {
    return new Promise((res) => {
      this.say({ lines: [q] });
      clearInterval(this.typing);
      this.shown = q.length;
      this.text.textContent = q;
      this.more.style.visibility = 'hidden';
      this.choices.replaceChildren();
      opts.forEach((o, i) => {
        const b = el('button', 'dlg-choice', this.choices);
        b.textContent = o;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.pick(i); });
        b.addEventListener('mouseenter', () => b.focus());
      });
      (this.choices.firstElementChild as HTMLButtonElement | null)?.focus();
      this.chosen = res;
    });
  }

  /** Move the highlight among the choices (arrow keys). */
  nudge(d: number): boolean {
    if (!this.chosen) return false;
    const bs = [...this.choices.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    bs[(i + d + bs.length) % bs.length]?.focus();
    return true;
  }

  private pick(i: number): void {
    const cb = this.chosen;
    if (!cb) return;
    this.chosen = null;
    this.choices.replaceChildren();
    cb(i);
  }

  /** Close the box after scripted lines. */
  endTalk(): void {
    const spoken = this.spoken, chosen = this.chosen;
    this.speech = null;
    this.spoken = null;
    this.chosen = null;
    // anything still waiting on the box (a skipped scene) is let go
    spoken?.();
    chosen?.(0);
    this.choices.replaceChildren();
    clearInterval(this.typing);
    this.box.classList.remove('on');
  }

  say(s: Speech, onClose?: () => void): void {
    this.speech = s;
    this.line = 0;
    this.onClose = onClose ?? null;
    this.plate.textContent = s.name ?? '';
    this.plate.style.display = s.name ? '' : 'none';
    if (s.portrait) { this.portrait.src = s.portrait; this.portrait.style.display = ''; } else this.portrait.style.display = 'none';
    this.box.classList.toggle('narr', !s.name);
    this.box.classList.add('on');
    this.showLine();
  }

  private typing = 0;
  private showLine(): void {
    const text = this.speech!.lines[this.line]!;
    this.shown = 0;
    this.text.textContent = '';
    this.more.style.visibility = 'hidden';
    clearInterval(this.typing);
    const who = this.speech!.name ?? '';
    this.typing = window.setInterval(() => {
      this.shown++;
      this.text.textContent = text.slice(0, this.shown);
      if (this.shown % 2 === 0 && text[this.shown - 1] !== ' ') this.onType?.(who);
      if (this.shown >= text.length) { clearInterval(this.typing); this.more.style.visibility = 'visible'; }
    }, 22);
  }

  /** A press while talking: finish the line, or go to the next, or close. */
  advance(): void {
    if (!this.speech) return;
    if (this.chosen) {
      const bs = [...this.choices.querySelectorAll('button')];
      this.pick(Math.max(0, bs.indexOf(document.activeElement as HTMLButtonElement)));
      return;
    }
    const text = this.speech.lines[this.line]!;
    if (this.shown < text.length) {
      clearInterval(this.typing);
      this.shown = text.length;
      this.text.textContent = text;
      this.more.style.visibility = 'visible';
      return;
    }
    if (this.spoken) { const r = this.spoken; this.spoken = null; r(); return; }
    this.line++;
    if (this.line < this.speech.lines.length) { this.showLine(); return; }
    this.speech = null;
    this.box.classList.remove('on');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  /** A floating stick on the left half, an A button on the right. */
  private touchControls(): void {
    const zone = el('div', 'stick-zone', this.root);
    const ring = el('div', 'stick', zone);
    const knob = el('div', 'stick-knob', ring);
    const a = el('button', 'btn-a', this.root);
    a.textContent = 'A';
    a.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.aPressed = true; });
    let id: number | null = null, x0 = 0, y0 = 0;
    zone.addEventListener('pointerdown', (e) => {
      id = e.pointerId; zone.setPointerCapture(id); x0 = e.clientX; y0 = e.clientY;
      ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`; ring.classList.add('on');
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const max = 48;
      let dx = e.clientX - x0, dy = e.clientY - y0;
      const l = Math.hypot(dx, dy);
      if (l > max) { dx *= max / l; dy *= max / l; }
      this.stick.x = dx / max; this.stick.y = dy / max;
      if (Math.hypot(this.stick.x, this.stick.y) < 0.18) this.stick.x = this.stick.y = 0;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== id) return;
      id = null; this.stick.x = this.stick.y = 0; knob.style.transform = ''; ring.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}
