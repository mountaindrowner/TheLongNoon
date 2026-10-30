/**
 * The old tale as a dream (the owner, 2026-10-30: "more like a full screen dream sequence … fades to black and
 * reveals what happened … as highly detailed as you can get, and stylized"). When Papá starts, the fire goes to
 * black and each part of the story comes up as a painted scene that moves: layered skies, light, weather and
 * silhouettes, the camera drifting through them. Between parts it goes through black; at the end it opens back
 * onto the fire. Everything is painted in code each frame (no images to download), at the screen's resolution,
 * with grain and a vignette over it.
 *
 * The scenes, in the order he tells it: rain, heat, machines, veil, war, white, below, circling.
 */

type G = CanvasRenderingContext2D;
type Rand = () => number;

const rand = (seed: number): Rand => {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, x));
const ease = (x: number): number => { const k = clamp(x); return k * k * (3 - 2 * k); };
const off = (w: number, h: number): [HTMLCanvasElement, G] => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return [c, c.getContext('2d')!]; };

// ------------------------------------------------------------------ painting kit
function vgrad(g: G, y0: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  return gr;
}
function glow(g: G, x: number, y: number, r: number, color: string, alpha = 1): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}
/** A soft dot of light, drawn once and stamped many times (hundreds of motes a frame). */
const dots = new Map<string, HTMLCanvasElement>();
function dot(color: string): HTMLCanvasElement {
  let c = dots.get(color);
  if (!c) { const [cv, g] = off(32, 32); glow(g, 16, 16, 16, color); dots.set(color, cv); c = cv; }
  return c;
}
/** A bank of cloud: many soft puffs, lit from above, darker underneath. */
function cloudBank(seed: number, w: number, h: number, top: string, under: string, density = 1): HTMLCanvasElement {
  const [c, g] = off(w, h); const r = rand(seed);
  const n = Math.round(70 * density);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = h * (0.35 + r() * 0.45), rad = h * (0.12 + r() * 0.3);
    const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
    gr.addColorStop(0, top); gr.addColorStop(0.55, under); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * 1.6, rad, 0, 0, Math.PI * 2); g.fill();
  }
  return c;
}
/** A sea of cloud seen from above: long flat billows, bright on top, shadowed in the troughs. */
function cloudSea(seed: number, w: number, h: number): HTMLCanvasElement {
  const [c, g] = off(w, h); const r = rand(seed);
  g.fillStyle = vgrad(g, 0, h, [[0, 'rgba(236,240,244,0)'], [0.25, 'rgba(236,240,244,0.8)'], [1, 'rgba(250,250,246,1)']]); g.fillRect(0, h * 0.15, w, h);
  for (let row = 0; row < 7; row++) {
    const y = h * (0.15 + row * 0.13), sc = 0.4 + row * 0.25;
    for (let i = 0; i < 40; i++) {
      const x = r() * w, rx = w * 0.05 * sc * (0.6 + r()), ry = rx * 0.28;
      g.fillStyle = 'rgba(160,172,188,0.25)'; g.beginPath(); g.ellipse(x, y + ry * 0.5, rx, ry, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(x, y - ry * 0.4, 0, x, y, rx);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(240,244,248,0.7)'); gr.addColorStop(1, 'rgba(240,244,248,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}
interface SkyOpts { top?: string; rim?: string; rimSide?: 1 | -1; blur?: number; bloom?: boolean }
/**
 * A skyline: towers with setbacks, water tanks and masts; each one shaded from a lighter roof down to its base, a
 * rim of light along the roofline on the side the light comes from, faint floor lines, windows lit warm and the odd
 * one cold, and a soft bloom around the lit ones. `blur` softens the whole layer for distance.
 */
function skyline(seed: number, w: number, h: number, color: string, windows: string | null, lit = 0.25, base = 0.15, o: SkyOpts = {}): HTMLCanvasElement {
  const [c, g] = off(w, h); const r = rand(seed);
  let x = -10;
  const wins: Array<[number, number, number, number, number]> = [];
  const shade = (y: number): CanvasGradient => vgrad(g, y, h, [[0, o.top ?? color], [0.55, color], [1, color]]);
  while (x < w + 10) {
    const bw = w * (0.022 + r() * 0.05), bh = h * (base + r() * (1 - base) * (r() < 0.2 ? 1 : 0.62));
    const y = h - bh;
    g.fillStyle = shade(y); g.fillRect(x, y, bw, bh);
    // setbacks, masts, tanks
    let roof = y;
    if (r() < 0.45) { const sw = bw * (0.4 + r() * 0.4), sh = bh * (0.06 + r() * 0.14); roof = y - sh; g.fillStyle = shade(roof); g.fillRect(x + (bw - sw) / 2, roof, sw, sh + 1); }
    g.fillStyle = color;
    if (r() < 0.3) { const mx = x + bw * (0.3 + r() * 0.4); g.fillRect(mx, roof - h * 0.09, Math.max(1, w * 0.0012), h * 0.09); g.fillRect(mx - w * 0.002, roof - h * 0.06, w * 0.004 + 1, 1); }
    if (r() < 0.15) { const tx = x + bw * 0.15, tw = bw * 0.32, ty = y - h * 0.045; g.beginPath(); g.ellipse(tx + tw / 2, ty + h * 0.012, tw / 2, h * 0.02, 0, 0, Math.PI * 2); g.fill(); g.fillRect(tx, ty + h * 0.012, tw, h * 0.02); g.fillRect(tx + tw * 0.12, y - h * 0.012, 1.5, h * 0.012); g.fillRect(tx + tw * 0.85, y - h * 0.012, 1.5, h * 0.012); }
    // the rim of light on the roofline, and the floors
    if (o.rim) { g.fillStyle = o.rim; const side = o.rimSide ?? 1; g.fillRect(side > 0 ? x + bw - Math.max(1.5, bw * 0.06) : x, y, Math.max(1.5, bw * 0.06), bh * 0.9); g.fillRect(x, y, bw, 1.5); }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    const fl = Math.max(4, h * 0.03);
    for (let fy = y + fl; fy < h; fy += fl) g.fillRect(x, fy, bw, 1);
    if (windows) {
      const cw = Math.max(2, bw / 8), ch = cw * 1.5;
      for (let wy = y + ch; wy < h - ch; wy += ch * 1.8) for (let wx = x + cw * 0.8; wx < x + bw - cw; wx += cw * 1.7) if (r() < lit) wins.push([wx, wy, cw * 0.7, ch * 0.75, r()]);
    }
    x += bw + (r() < 0.3 ? w * 0.012 * r() : -1);
  }
  if (windows && wins.length) {
    const draw = (gg: G): void => { for (const [a, b, cw, ch, k] of wins) { gg.fillStyle = k > 0.92 ? '#a9d2ee' : windows; gg.globalAlpha = 0.45 + k * 0.55; gg.fillRect(a, b, cw, ch); } gg.globalAlpha = 1; };
    if (o.bloom !== false) { const [bc, bg] = off(w, h); draw(bg); g.save(); g.filter = `blur(${Math.max(2, w * 0.003)}px)`; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9; g.drawImage(bc, 0, 0); g.restore(); }
    draw(g);
  }
  if (o.blur) { const [bc, bg] = off(w, h); bg.filter = `blur(${o.blur}px)`; bg.drawImage(c, 0, 0); return bc; }
  return c;
}
/** Rolling land along the bottom, from value noise. */
function ridge(seed: number, w: number, h: number, color: string, rough = 0.5, top = 0.3): HTMLCanvasElement {
  const [c, g] = off(w, h); const r = rand(seed);
  const pts = Array.from({ length: 24 }, () => r());
  const at = (x: number): number => { const k = (x / w) * (pts.length - 1), i = Math.floor(k), f = k - i; const a = pts[i]!, b = pts[Math.min(i + 1, pts.length - 1)]!; return a + (b - a) * (f * f * (3 - 2 * f)); };
  g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 160) g.lineTo(x, h * top + at(x) * h * rough + Math.sin(x * 0.07) * h * 0.01);
  g.lineTo(w, h); g.fill();
  return c;
}
type Pose = 'stand' | 'walk' | 'reach' | 'shield' | 'sit' | 'point';
interface Who { kind?: 'man' | 'woman' | 'child'; hat?: boolean; bundle?: boolean; coat?: boolean }
/** A limb: a tapered stroke from (x1, y1), w1 thick, to (x2, y2), w2 thick, rounded at both ends. */
function limb(g: G, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  g.beginPath();
  g.moveTo(x1 + c * w1 / 2, y1 + s * w1 / 2); g.lineTo(x2 + c * w2 / 2, y2 + s * w2 / 2);
  g.lineTo(x2 - c * w2 / 2, y2 - s * w2 / 2); g.lineTo(x1 - c * w1 / 2, y1 - s * w1 / 2); g.closePath(); g.fill();
  g.beginPath(); g.arc(x1, y1, w1 / 2, 0, Math.PI * 2); g.arc(x2, y2, w2 / 2, 0, Math.PI * 2); g.fill();
}
/**
 * A person in silhouette, drawn like a cut paper figure: a head with hair (and a hat, for some), a neck, shoulders
 * sloping to a waist, hips or a skirt, tapered arms and legs with hands and feet; a child is all head and limbs.
 */
function figure(g: G, x: number, y: number, hgt: number, color: string, pose: Pose = 'stand', ph = 0, who: Who | boolean = {}): void {
  const o: Who = typeof who === 'boolean' ? { bundle: who } : who;
  const child = o.kind === 'child', woman = o.kind === 'woman';
  const heads = child ? 5.2 : 7.4, u = hgt / heads;
  g.fillStyle = color;
  const sit = pose === 'sit';
  const legL = (child ? 2.2 : 3.6) * u, torso = (child ? 1.7 : 2.7) * u;
  const hip = y - (sit ? legL * 0.42 : legL), sh = hip - torso, neck = sh - 0.22 * u, head = neck - 0.55 * u;
  const shW = (woman ? 0.82 : child ? 0.7 : 1.0) * u, hipW = (woman ? 0.78 : child ? 0.55 : 0.62) * u;
  const sw = pose === 'walk' ? Math.sin(ph) : 0;
  // legs and feet
  const knee = legL * 0.5;
  for (const k of [-1, 1]) {
    const hx = x + k * hipW * 0.45;
    if (sit) { limb(g, hx, hip, hx + 1.3 * u, hip - 0.05 * u, 0.5 * u, 0.42 * u); limb(g, hx + 1.3 * u, hip, hx + 1.45 * u, y, 0.42 * u, 0.3 * u); g.fillRect(hx + 1.3 * u, y - 0.18 * u, 0.6 * u, 0.18 * u); continue; }
    const s1 = sw * k, kx = hx + s1 * 0.45 * u, ky = hip + knee, fx = hx + s1 * 0.95 * u, fy = y - 0.12 * u;
    limb(g, hx, hip, kx, ky, 0.55 * u, 0.4 * u); limb(g, kx, ky, fx, fy, 0.4 * u, 0.28 * u);
    g.beginPath(); g.ellipse(fx + 0.18 * u, y - 0.1 * u, 0.32 * u, 0.12 * u, 0, 0, Math.PI * 2); g.fill();
  }
  // body: shoulders sloping to a waist, then hips, a skirt or a long coat
  g.beginPath();
  g.moveTo(x - shW, sh + 0.15 * u);
  g.quadraticCurveTo(x - shW * 0.95, sh - 0.12 * u, x - 0.25 * u, neck + 0.05 * u);
  g.lineTo(x + 0.25 * u, neck + 0.05 * u);
  g.quadraticCurveTo(x + shW * 0.95, sh - 0.12 * u, x + shW, sh + 0.15 * u);
  const hem = o.coat || woman ? hip + (woman ? 1.5 : 1.2) * u : hip, flare = o.coat || woman ? 0.35 * u : 0;
  g.quadraticCurveTo(x + shW * 0.7, sh + torso * 0.5, x + hipW + flare, hem);
  g.lineTo(x - hipW - flare, hem);
  g.quadraticCurveTo(x - shW * 0.7, sh + torso * 0.5, x - shW, sh + 0.15 * u);
  g.fill();
  // arms
  const arm = (k: number, ex: number, ey: number, hx: number, hy: number): void => { limb(g, x + k * shW * 0.88, sh + 0.25 * u, ex, ey, 0.42 * u, 0.32 * u); limb(g, ex, ey, hx, hy, 0.32 * u, 0.24 * u); g.beginPath(); g.arc(hx, hy, 0.18 * u, 0, Math.PI * 2); g.fill(); };
  const al = 1.25 * u;
  for (const k of [-1, 1]) {
    if (pose === 'reach') arm(k, x + k * 1.25 * u, sh - 0.9 * u, x + k * 1.6 * u, sh - 2.1 * u);
    else if (pose === 'shield' && k < 0) arm(k, x - 0.9 * u, sh + 0.6 * u, x - 0.15 * u, head + 0.05 * u);
    else if (pose === 'point' && k > 0) arm(k, x + 1.2 * u, sh - 0.3 * u, x + 2.1 * u, sh - 1.2 * u);
    else if (sit) arm(k, x + k * shW + 0.3 * u, sh + al, x + 1.1 * u, hip - 0.1 * u);
    else { const s2 = -sw * k; arm(k, x + k * (shW + 0.05 * u) + s2 * 0.3 * u, sh + al, x + k * (shW - 0.05 * u) + s2 * 0.6 * u, sh + al * 2); }
  }
  // neck, head, hair, hat
  g.fillRect(x - 0.17 * u, neck - 0.05 * u, 0.34 * u, 0.35 * u);
  g.beginPath(); g.ellipse(x, head, 0.42 * u, 0.52 * u, 0, 0, Math.PI * 2); g.fill();
  if (woman) { g.beginPath(); g.ellipse(x - 0.12 * u, head + 0.35 * u, 0.42 * u, 0.75 * u, 0.2, 0, Math.PI * 2); g.fill(); }
  if (child) { for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * 0.5 * u, head + 0.2 * u, 0.14 * u, 0.32 * u, k * 0.4, 0, Math.PI * 2); g.fill(); } }
  if (o.hat) { g.beginPath(); g.ellipse(x, head - 0.3 * u, 0.95 * u, 0.16 * u, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x, head - 0.45 * u, 0.42 * u, 0.32 * u, 0, Math.PI, 0); g.fill(); }
  if (o.bundle) { g.beginPath(); g.ellipse(x - 0.55 * u, sh + 0.75 * u, 0.85 * u, 1.05 * u, -0.25, 0, Math.PI * 2); g.fill(); limb(g, x - 0.2 * u, sh, x - 1.1 * u, sh + 0.3 * u, 0.12 * u, 0.12 * u); }
}
/** One of the planes that sprayed the sky: a long thin wing, a slim body, a high tail. */
function swift(g: G, x: number, y: number, s: number, color: string, bank = 0): void {
  g.save(); g.translate(x, y); g.rotate(bank); g.fillStyle = color;
  g.beginPath();
  g.moveTo(-s * 1.0, s * 0.02); g.quadraticCurveTo(-s * 0.4, -s * 0.08, 0, -s * 0.06); g.quadraticCurveTo(s * 0.4, -s * 0.08, s * 1.0, s * 0.02);
  g.lineTo(s * 0.95, s * 0.05); g.quadraticCurveTo(s * 0.3, s * 0.0, 0, s * 0.03); g.quadraticCurveTo(-s * 0.3, s * 0.0, -s * 0.95, s * 0.05); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(s * 0.05, s * 0.0, s * 0.28, s * 0.035, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(-s * 0.26, -s * 0.12, s * 0.03, s * 0.12); g.fillRect(-s * 0.32, -s * 0.12, s * 0.14, s * 0.02);
  g.restore();
}
/** A walking machine seen far off in the white: a box on long legs. */
function walker(g: G, x: number, y: number, s: number, color: string, ph: number): void {
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = s * 0.06; g.lineCap = 'round';
  g.fillRect(x - s * 0.5, y - s * 1.6, s, s * 0.45);
  g.fillRect(x - s * 0.15, y - s * 1.8, s * 0.3, s * 0.2);
  g.fillRect(x + s * 0.05, y - s * 2.1, Math.max(1, s * 0.03), s * 0.3);
  g.fillStyle = 'rgba(255,70,40,0.9)'; g.fillRect(x + s * 0.02, y - s * 1.74, s * 0.1, s * 0.06); g.fillStyle = color;
  g.beginPath();
  for (const k of [-1, 1]) { const sw = Math.sin(ph + (k > 0 ? Math.PI : 0)) * s * 0.25; g.moveTo(x + k * s * 0.35, y - s * 1.15); g.lineTo(x + k * s * 0.5 + sw, y - s * 0.55); g.lineTo(x + k * s * 0.4 + sw * 1.4, y); }
  g.stroke();
}

// ------------------------------------------------------------------ the scenes
interface Scene { paint(g: G, t: number, W: number, H: number): void }

/** Makes a scene's cached layers for one canvas size; rebuilt if the screen changes. */
type Maker = (W: number, H: number) => Scene;

const SCENES: Record<string, Maker> = {
  // "A long time ago, the sky was full": a city at dusk under rain, a lamp, a child with her arms up in it
  rain(W, H) {
    const clouds = [cloudBank(11, W * 1.6, H * 0.55, 'rgba(120,138,156,0.55)', 'rgba(40,50,62,0.5)'), cloudBank(12, W * 1.6, H * 0.5, 'rgba(92,108,124,0.6)', 'rgba(30,38,48,0.55)', 1.2)];
    const far = skyline(21, W * 1.3, H * 0.42, '#4a5d70', '#f0c27a', 0.12, 0.15, { top: '#6f8498', blur: 2 });
    const mid = skyline(22, W * 1.3, H * 0.5, '#2a3743', '#ffcf86', 0.26, 0.25, { top: '#43566a', rim: 'rgba(255,196,130,0.22)' });
    const near = skyline(23, W * 1.4, H * 0.62, '#11171d', '#ffd08e', 0.3, 0.45, { top: '#1d2731', rim: 'rgba(255,190,120,0.18)' });
    // the street's reflection of the near buildings, blurred once
    const [refl, rg] = off(near.width, near.height); rg.filter = 'blur(2px)'; rg.drawImage(near, 0, 0);
    const r = rand(5);
    const drops = Array.from({ length: 480 }, () => [r(), r()] as [number, number]);
    return {
      paint(g, t) {
        const cam = t * 0.012;
        g.fillStyle = vgrad(g, 0, H, [[0, '#1b2632'], [0.45, '#3a4c5c'], [0.7, '#66787f'], [1, '#1e2730']]); g.fillRect(0, 0, W, H);
        glow(g, W * 0.72, H * 0.6, H * 0.55, 'rgba(255,190,120,0.25)');
        clouds.forEach((c, i) => g.drawImage(c, -((t * (8 + i * 6)) % (W * 0.6)) - W * 0.1 - cam * W * (0.2 + i * 0.1), H * (i === 0 ? 0.02 : 0.1)));
        const fl = Math.max(0, Math.sin(t * 0.9) - 0.985) * 40;
        if (fl > 0) { g.fillStyle = `rgba(220,230,255,${fl * 0.25})`; g.fillRect(0, 0, W, H * 0.6); }
        g.drawImage(far, -W * 0.15 - cam * W * 0.2, H * 0.36);
        g.fillStyle = vgrad(g, H * 0.5, H * 0.8, [[0, 'rgba(110,128,140,0)'], [1, 'rgba(110,128,140,0.35)']]); g.fillRect(0, H * 0.5, W, H * 0.3);
        g.drawImage(mid, -W * 0.15 - cam * W * 0.4, H * 0.4);
        g.fillStyle = vgrad(g, H * 0.6, H * 0.85, [[0, 'rgba(70,86,98,0)'], [1, 'rgba(70,86,98,0.3)']]); g.fillRect(0, H * 0.6, W, H * 0.25);
        g.drawImage(near, -W * 0.25 - cam * W * 0.65, H * 0.24);
        // the street, wet: the city upside down in it, smeared, rings spreading in the puddles
        g.fillStyle = vgrad(g, H * 0.84, H, [[0, '#1a2229'], [1, '#090d11']]); g.fillRect(0, H * 0.84, W, H * 0.16);
        g.save(); g.globalAlpha = 0.3; g.translate(0, H * 1.7); g.scale(1, -0.85); g.drawImage(refl, -W * 0.25 - cam * W * 0.65, H * 0.24); g.restore();
        g.lineWidth = 1;
        for (let i = 0; i < 12; i++) { const rx = ((i * 0.137 + t * 0.03) % 1) * W, ry = H * (0.87 + (i % 4) * 0.032), rr = ((t * 0.7 + i * 0.31) % 1); g.strokeStyle = `rgba(200,220,235,${0.35 * (1 - rr)})`; g.beginPath(); g.ellipse(rx, ry, rr * W * 0.03, rr * W * 0.006, 0, 0, Math.PI * 2); g.stroke(); }
        // a street lamp, its cone full of rain
        const lx = W * 0.8 - cam * W * 0.7;
        g.fillStyle = '#07090b'; g.fillRect(lx, H * 0.38, W * 0.006, H * 0.55); g.fillRect(lx - W * 0.03, H * 0.38, W * 0.035, H * 0.008);
        g.save(); g.globalCompositeOperation = 'lighter';
        const cone = g.createLinearGradient(0, H * 0.39, 0, H * 0.95); cone.addColorStop(0, 'rgba(255,214,150,0.22)'); cone.addColorStop(0.6, 'rgba(255,214,150,0.06)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
        g.fillStyle = cone; g.beginPath(); g.moveTo(lx - W * 0.032, H * 0.39); g.lineTo(lx - W * 0.022, H * 0.39); g.lineTo(lx + W * 0.05, H * 0.95); g.lineTo(lx - W * 0.11, H * 0.95); g.fill();
        glow(g, lx - W * 0.03, H * 0.93, W * 0.06, 'rgba(255,200,130,0.18)');
        glow(g, lx - W * 0.027, H * 0.395, H * 0.05, 'rgba(255,230,180,0.95)');
        g.restore();
        // far off, people running for cover; near, the two of them standing in it: her arms up, him beside her
        for (let i = 0; i < 3; i++) figure(g, ((0.15 + i * 0.08 + t * 0.03) % 1) * W - cam * W * 0.5, H * 0.86, H * 0.06, '#0b0f13', 'walk', t * 9 + i, { kind: i === 1 ? 'woman' : 'man', coat: true });
        figure(g, W * 0.42 - cam * W * 0.75, H * 0.94, H * 0.3, '#05080b', 'stand', 0, { kind: 'man', coat: true });
        figure(g, W * 0.49 - cam * W * 0.75, H * 0.94, H * 0.17, '#05080b', 'reach', 0, { kind: 'child' });
        // rain, three depths, brighter in the lamp's cone
        g.lineCap = 'round';
        for (let layer = 0; layer < 3; layer++) {
          const d = 0.5 + layer * 0.25;
          g.strokeStyle = `rgba(200,215,230,${0.1 + d * 0.28})`; g.lineWidth = d * 1.5;
          g.beginPath();
          for (let k = layer; k < drops.length; k += 3) {
            const [x0, y0] = drops[k]!, sp = 0.9 + d * 1.4, y = ((y0 + t * sp) % 1.1) * H - H * 0.05, x = ((x0 + t * 0.06 * d) % 1) * W - (y / H) * W * 0.06;
            g.moveTo(x, y); g.lineTo(x - d * W * 0.004, y + d * H * 0.05);
          }
          g.stroke();
        }
      },
    };
  },

  // "Then the world got hot": a sun too big, the land cracked, whole towns walking away
  heat(W, H) {
    const mesa = ridge(31, W * 1.4, H * 0.3, '#b8643a', 0.45, 0.35), near = ridge(32, W * 1.4, H * 0.3, '#5a2512', 0.3, 0.55);
    const [cracks, cg] = off(W, H * 0.25); const r = rand(33);
    cg.strokeStyle = 'rgba(30,10,4,0.6)';
    for (let i = 0; i < 90; i++) { let x = r() * W, y = r() * H * 0.25; cg.lineWidth = 0.6 + r() * 1.6; cg.beginPath(); cg.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * W * 0.05; y += (r() - 0.3) * H * 0.02; cg.lineTo(x, y); } cg.stroke(); }
    const trees = Array.from({ length: 5 }, () => [r(), 0.6 + r() * 0.5] as [number, number]);
    const folk = Array.from({ length: 18 }, (_, i) => ({ kind: (['man', 'woman', 'man', 'child'] as const)[i % 4], hat: r() < 0.4, bundle: r() < 0.55, coat: r() < 0.3 }));
    return {
      paint(g, t) {
        const cam = t * 0.01;
        g.fillStyle = vgrad(g, 0, H, [[0, '#fff6e2'], [0.35, '#ffd08a'], [0.62, '#f08a3c'], [1, '#7a2e14']]); g.fillRect(0, 0, W, H);
        const sx = W * 0.5, sy = H * 0.34, sr = H * (0.17 + 0.006 * Math.sin(t * 1.3));
        glow(g, sx, sy, sr * 4.5, 'rgba(255,240,200,0.75)'); glow(g, sx, sy, sr * 2, 'rgba(255,255,240,0.9)');
        g.fillStyle = '#fffdf4'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
        // rays down through the haze
        g.save(); g.globalCompositeOperation = 'lighter'; g.translate(sx, sy);
        for (let k = 0; k < 9; k++) { g.rotate(0.7); const gr = g.createLinearGradient(sr, 0, H, 0); gr.addColorStop(0, 'rgba(255,240,200,0.08)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(sr, -sr * 0.1); g.lineTo(H, -H * 0.06); g.lineTo(H, H * 0.06); g.lineTo(sr, sr * 0.1); g.fill(); }
        g.restore();
        // the far mesas swim in the heat
        for (let y = 0; y < mesa.height; y += 3) g.drawImage(mesa, 0, y, mesa.width, 3, -W * 0.2 - cam * W * 0.2 + Math.sin(t * 3 + y * 0.09) * W * 0.003, H * 0.5 + y, mesa.width, 3);
        g.globalAlpha = 0.4; g.fillStyle = '#ffd9a0'; g.fillRect(0, H * 0.5, W, H * 0.08); g.globalAlpha = 1;
        g.drawImage(near, -W * 0.2 - cam * W * 0.35, H * 0.58);
        g.fillStyle = vgrad(g, H * 0.75, H, [[0, '#6a2a12'], [1, '#2a0e06']]); g.fillRect(0, H * 0.75, W, H * 0.25);
        g.drawImage(cracks, 0, H * 0.75);
        for (const [tx, sc] of trees) { const x = tx * W - cam * W * 0.5, y = H * 0.77; g.strokeStyle = '#2a0e06'; g.lineWidth = H * 0.006 * sc; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - H * 0.12 * sc); g.moveTo(x, y - H * 0.07 * sc); g.lineTo(x + H * 0.04 * sc, y - H * 0.11 * sc); g.moveTo(x, y - H * 0.09 * sc); g.lineTo(x - H * 0.03 * sc, y - H * 0.13 * sc); g.stroke(); }
        // the long line north, shrinking toward the horizon, dust kicked up behind them
        folk.forEach((f, i) => {
          const k = ((i / folk.length) + t * 0.008) % 1, d = 1 - k;
          const x = W * (0.06 + k * 0.64) - cam * W * 0.4 * d, y = H * (0.6 + d * 0.33), hgt = H * (0.025 + d * 0.21) * (f.kind === 'child' ? 0.7 : 1);
          g.globalAlpha = 0.12 * d; g.drawImage(dot('rgba(255,210,150,1)'), x - hgt * 0.6, y - hgt * 0.25, hgt * 1.2, hgt * 0.35); g.globalAlpha = 1;
          figure(g, x, y, hgt, `rgba(30,9,3,${0.45 + d * 0.55})`, 'walk', t * 3 + i * 1.7, f);
        });
        g.globalAlpha = 0.22; g.fillStyle = '#ffe0b0'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      },
    };
  },

  // "So the people built machines": one passing right over, the rest in a long line, laying a haze across the dawn
  machines(W, H) {
    const city = skyline(41, W * 1.3, H * 0.4, '#1c2333', '#ffd38c', 0.14, 0.15, { top: '#2e3a52', rim: 'rgba(255,200,150,0.35)', rimSide: 1 });
    const farCity = skyline(42, W * 1.3, H * 0.3, '#3b4766', null, 0, 0.2, { top: '#56648a', blur: 2 });
    return {
      paint(g, t) {
        const cam = t * 0.01, veil = clamp(t / 16);
        g.fillStyle = vgrad(g, 0, H, [[0, '#18223a'], [0.45, '#4d5f8a'], [0.75, '#e7b98f'], [1, '#f6d2a6']]); g.fillRect(0, 0, W, H);
        glow(g, W * 0.74, H * 0.72, H * 0.5, `rgba(255,214,150,${0.85 - veil * 0.5})`);
        // trails: soft, spreading wider the further behind each plane
        const trail = (x: number, y: number, len: number, w0: number, a: number): void => {
          g.globalAlpha = a;
          for (let k = 0; k < 70; k++) { const f = k / 69, rr = w0 * (1.6 + f * 7), px = x - f * len, py = y + Math.sin(f * 5 + t * 0.5) * w0 * 0.6 * f; g.drawImage(dot('rgba(244,238,226,1)'), px - rr, py - rr, rr * 2, rr * 2); }
          g.globalAlpha = 1;
        };
        for (let row = 0; row < 2; row++) {
          const y = H * (0.24 + row * 0.11), s = W * (0.085 - row * 0.03), sp = 0.028 + row * 0.01;
          for (let i = 0; i < 4; i++) {
            const x = ((i * 0.32 + row * 0.15 + t * sp) % 1.5) * W * 1.1 - W * 0.25;
            trail(x - s * 0.55, y + s * 0.03, W * 0.55, H * 0.005 * (2.2 - row), 0.07 + veil * 0.03);
            swift(g, x, y, s, '#121827', Math.sin(t * 0.4 + i) * 0.03);
          }
        }
        // the shade they laid: a milky layer thickening across the sky
        g.fillStyle = vgrad(g, 0, H * 0.75, [[0, `rgba(232,226,214,${veil * 0.55})`], [1, `rgba(232,226,214,${veil * 0.2})`]]); g.fillRect(0, 0, W, H * 0.75);
        g.drawImage(farCity, -W * 0.15 - cam * W * 0.15, H * 0.58);
        g.drawImage(city, -W * 0.15 - cam * W * 0.3, H * 0.62);
        // and one right over us, low, its spray falling behind it
        const bx = ((t * 0.045) % 1.6) * W * 1.1 - W * 0.4, by = H * 0.1 + Math.sin(t * 0.3) * H * 0.01;
        trail(bx - W * 0.12, by + H * 0.01, W * 0.7, H * 0.012, 0.06);
        swift(g, bx, by, W * 0.24, '#0b1020', 0.04);
        g.fillStyle = vgrad(g, H * 0.92, H, [[0, '#0d1220'], [1, '#05070d']]); g.fillRect(0, H * 0.92, W, H * 0.08);
        figure(g, W * 0.18 - cam * W * 0.5, H * 0.97, H * 0.13, '#05070d', 'point', 0, { kind: 'man' });
        figure(g, W * 0.215 - cam * W * 0.5, H * 0.97, H * 0.08, '#05070d', 'stand', 0, { kind: 'child' });
        figure(g, W * 0.82 - cam * W * 0.5, H * 0.97, H * 0.12, '#05070d', 'shield', 0, { kind: 'woman' });
      },
    };
  },
  // "Something lived up there … smaller than dust": a band of living light in the high dark, going out
  veil(W, H) {
    const r = rand(51);
    const motes = Array.from({ length: 900 }, () => ({ u: r(), v: (r() - 0.5) * 2, s: 0.6 + r() * 1.8, die: 3 + r() * 13, ph: r() * 6.28, hue: r() }));
    const dust = Array.from({ length: 260 }, () => [r(), r(), 0.4 + r() * 0.6] as [number, number, number]);
    return {
      paint(g, t) {
        g.fillStyle = vgrad(g, 0, H, [[0, '#02030a'], [0.55, '#0a1430'], [0.82, '#1a3a6a'], [1, '#7ec8e8']]); g.fillRect(0, 0, W, H);
        // the curve of the world far below, its thin blue air
        g.save(); g.beginPath(); g.ellipse(W * 0.5, H * 1.9, W * 1.3, H * 1.05, 0, Math.PI, 0); g.closePath(); g.clip();
        g.fillStyle = vgrad(g, H * 0.85, H, [[0, '#5fb0d8'], [1, '#e8f4f0']]); g.fillRect(0, H * 0.8, W, H * 0.2); g.restore();
        glow(g, W * 0.5, H * 0.9, W * 0.6, 'rgba(120,200,240,0.25)');
        for (let i = 0; i < 70; i++) { const x = ((i * 97.3) % 1) * W + ((i * 13) % W), y = ((i * 37) % 100) / 100 * H * 0.45; g.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t + i)})`; g.fillRect(x % W, y, 1.2, 1.2); }
        // the band: drifting, glowing; touched by the falling dust, each one goes grey and out
        g.globalCompositeOperation = 'lighter';
        for (const m of motes) {
          const life = clamp((m.die - t) / 1.5);
          if (life <= 0) continue;
          const x = ((m.u + t * 0.008) % 1) * W, band = H * 0.5 + Math.sin(m.u * 9 + t * 0.3) * H * 0.08 + m.v * H * 0.07;
          const y = band + Math.sin(t * 1.3 + m.ph) * 3;
          const tw = 0.6 + 0.4 * Math.sin(t * 3 + m.ph);
          const rad = m.s * 5 * (0.6 + life * 0.4);
          g.globalAlpha = 0.7 * life * tw;
          g.drawImage(dot(m.hue > 0.7 ? 'rgba(255,214,130,1)' : 'rgba(120,240,210,1)'), x - rad, y - rad, rad * 2, rad * 2);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        for (const m of motes) { const d = (t - m.die) / 1.5; if (d <= 0 || d > 1) continue; const x = ((m.u + t * 0.008) % 1) * W, y = H * 0.5 + Math.sin(m.u * 9 + t * 0.3) * H * 0.08 + m.v * H * 0.07 + d * 20; g.fillStyle = `rgba(120,120,125,${0.6 * (1 - d)})`; g.fillRect(x, y, 2, 2); }
        // the dust coming down through it
        for (const [x0, y0, d] of dust) { const y = ((y0 + t * 0.05 * d) % 1) * H * 0.75, x = x0 * W + Math.sin(t + y0 * 9) * 6; g.fillStyle = `rgba(170,165,160,${0.25 + d * 0.3})`; g.fillRect(x, y, 1.5 * d + 0.5, 1.5 * d + 0.5); }
        for (let i = 0; i < 2; i++) swift(g, ((t * 0.02 + i * 0.5) % 1.3) * W * 1.1 - W * 0.1, H * (0.12 + i * 0.05), W * 0.035, '#01020a');
      },
    };
  },

  // "People went to war over what was left": the station's dish, the flash, the planes coming down
  war(W, H) {
    const hills = ridge(61, W * 1.3, H * 0.3, '#1a0906', 0.35, 0.4);
    const city = skyline(62, W * 1.3, H * 0.35, '#2a0f0a', null, 0, 0.1, { top: '#4a1a10', rim: 'rgba(255,120,60,0.25)', rimSide: -1 });
    return {
      paint(g, t) {
        const cam = t * 0.01;
        g.fillStyle = vgrad(g, 0, H, [[0, '#0d0606'], [0.5, '#3a120c'], [0.8, '#a2391c'], [1, '#2a0c06']]); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) { const x = W * (0.1 + i * 0.2), lean = Math.sin(t * 0.2 + i) * W * 0.02; for (let k = 0; k < 9; k++) { const rr = H * (0.06 + k * 0.025); g.globalAlpha = 0.5; g.drawImage(dot('rgba(20,8,6,1)'), x + lean * k + k * W * 0.012 - rr, H * (0.72 - k * 0.07) - rr, rr * 2, rr * 2); } g.globalAlpha = 1; }
        g.drawImage(city, -W * 0.15 - cam * W * 0.2, H * 0.55);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) { const a = -Math.PI / 2 + Math.sin(t * 0.5 + i * 2) * 0.5, x = W * (0.25 + i * 0.5), y = H * 0.8; g.save(); g.translate(x, y); g.rotate(a); const gr = g.createLinearGradient(0, 0, H, 0); gr.addColorStop(0, 'rgba(255,230,190,0.2)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(H, -H * 0.06); g.lineTo(H, H * 0.06); g.fill(); g.restore(); }
        g.restore();
        // the dish on its lattice tower, turned up at the sky
        const dx = W * 0.62 - cam * W * 0.3, dy = H * 0.8, th = H * 0.34;
        g.strokeStyle = '#0a0302'; g.lineWidth = Math.max(1.5, H * 0.004);
        g.beginPath();
        for (let k = 0; k < 7; k++) { const y0 = dy - k * th / 7, y1 = y0 - th / 7, w0 = H * (0.055 - k * 0.0055), w1 = H * (0.055 - (k + 1) * 0.0055); g.moveTo(dx - w0, y0); g.lineTo(dx + w1, y1); g.moveTo(dx + w0, y0); g.lineTo(dx - w1, y1); g.moveTo(dx - w0, y0); g.lineTo(dx + w0, y0); g.moveTo(dx - w0, y0); g.lineTo(dx - w1, y1); g.moveTo(dx + w0, y0); g.lineTo(dx + w1, y1); }
        g.stroke();
        g.fillStyle = '#0a0302'; g.save(); g.translate(dx, dy - th); g.rotate(-0.55);
        g.beginPath(); g.moveTo(-H * 0.12, 0); g.quadraticCurveTo(0, H * 0.09, H * 0.12, 0); g.lineTo(H * 0.11, -H * 0.008); g.quadraticCurveTo(0, H * 0.07, -H * 0.11, -H * 0.008); g.closePath(); g.fill();
        g.fillRect(-H * 0.004, -H * 0.075, H * 0.008, H * 0.1); g.beginPath(); g.arc(0, -H * 0.078, H * 0.008, 0, Math.PI * 2); g.fill();
        g.restore();
        // the flash, the fire after it
        const b = ((t - 2.2) % 6) / 6, boom = t > 2.2 ? b : -1;
        if (boom >= 0) { const k = ease(boom * 3); glow(g, dx, dy - th, H * (0.1 + k * 0.6), `rgba(255,236,190,${(1 - k) * 0.9})`); glow(g, dx, dy - th * 0.8, H * 0.25, `rgba(255,120,40,${0.5 * (1 - boom)})`); }
        for (let i = 0; i < 3; i++) {
          const k = clamp((t - 3 - i * 1.6) / 6); if (k <= 0) continue;
          const x = W * (0.15 + i * 0.25) + k * W * 0.2, y = H * (0.12 + i * 0.05) + k * k * H * 0.6;
          g.globalAlpha = 0.35;
          for (let sIdx = 0; sIdx < 12; sIdx++) { const rr = H * (0.01 + sIdx * 0.004); g.drawImage(dot('rgba(30,14,10,1)'), x - sIdx * W * 0.012 - rr, y - sIdx * H * 0.02 * k - rr, rr * 2, rr * 2); }
          g.globalAlpha = 1;
          swift(g, x, y, W * 0.045, '#080202', 0.3 + k * 0.9);
          glow(g, x, y, H * 0.025, 'rgba(255,150,60,0.85)');
        }
        g.drawImage(hills, -W * 0.15 - cam * W * 0.4, H * 0.75);
        figure(g, W * 0.1 - cam * W * 0.5, H * 0.99, H * 0.17, '#050101', 'stand', 0, { kind: 'man', coat: true });
        figure(g, W * 0.135 - cam * W * 0.5, H * 0.99, H * 0.1, '#050101', 'stand', 0, { kind: 'child' });
        figure(g, W * 0.88 - cam * W * 0.5, H * 0.99, H * 0.16, '#050101', 'shield', 0, { kind: 'woman' });
      },
    };
  },

  // "The sky turned white": the light comes in, the city goes to bone, the people in the street fade into it
  white(W, H) {
    const city = skyline(71, W * 1.3, H * 0.5, '#7d7c7a', '#ffffff', 0.05, 0.3, { top: '#a6a49f', bloom: false });
    const folk = [['man', 'stand'], ['woman', 'shield'], ['child', 'stand'], ['man', 'shield'], ['woman', 'stand'], ['man', 'stand'], ['child', 'shield']] as const;
    return {
      paint(g, t) {
        const cam = t * 0.008, w = ease(t / 11);
        g.fillStyle = vgrad(g, 0, H, [[0, '#cfd8e0'], [0.6, '#f2efe6'], [1, '#d8d2c4']]); g.fillRect(0, 0, W, H);
        const sr = H * (0.12 + w * 0.5);
        glow(g, W * 0.5, H * 0.3, sr * 3, 'rgba(255,255,255,0.95)');
        g.drawImage(city, -W * 0.15 - cam * W * 0.2, H * 0.5);
        g.fillStyle = vgrad(g, H * 0.85, H, [[0, '#8a857c'], [1, '#5a564e']]); g.fillRect(0, H * 0.88, W, H * 0.12);
        folk.forEach(([kind, pose], i) => {
          const fade = clamp((t - 2 - i * 0.9) / 2.2);
          figure(g, W * (0.12 + i * 0.12) - cam * W * 0.4, H * 0.97, H * (kind === 'child' ? 0.11 : 0.17), `rgba(40,36,30,${1 - fade})`, pose, 0, { kind });
        });
        g.fillStyle = `rgba(255,253,246,${0.2 + w * 0.75})`; g.fillRect(0, 0, W, H);
      },
    };
  },

  // "Most people … went down. Under bridges. Under stores. Into the dark, where the lanterns are."
  below(W, H) {
    const r = rand(81);
    // the underpass in perspective, opening onto the white day at its far end
    const ox0 = W * 0.36, ox1 = W * 0.64, oy0 = H * 0.3, oy1 = H * 0.56;
    const at = (d: number): [number, number, number, number] => [ox0 * d, oy0 * d, W - (W - ox1) * d, H - (H - oy1) * d];
    const groups = [{ d: 0.25, x: 0.18 }, { d: 0.45, x: 0.78 }, { d: 0.7, x: 0.3 }, { d: 0.55, x: 0.55 }];
    const folk = groups.map(() => Array.from({ length: 3 }, (_, i) => ({ dx: (i - 1) * 0.045 + (r() - 0.5) * 0.02, sit: i !== 1 || r() < 0.5, kind: (['man', 'woman', 'child'] as const)[Math.floor(r() * 3)] })));
    return {
      paint(g, t) {
        const sway = Math.sin(t * 0.2) * W * 0.004;
        // beyond: the white day, the land flat and shimmering, the machines walking in it
        g.fillStyle = vgrad(g, oy0, oy1, [[0, '#fffaf0'], [0.7, '#f1e6cc'], [1, '#d8c8a4']]); g.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
        g.fillStyle = 'rgba(170,150,120,0.6)'; g.fillRect(ox0, oy1 - (oy1 - oy0) * 0.22, ox1 - ox0, (oy1 - oy0) * 0.05);
        g.save(); g.beginPath(); g.rect(ox0, oy0, ox1 - ox0, oy1 - oy0); g.clip();
        for (let i = 0; i < 3; i++) walker(g, ox0 + (((t * 0.015 + i * 0.37) % 1.2) - 0.1) * (ox1 - ox0), oy1 - (oy1 - oy0) * 0.18, (oy1 - oy0) * (0.22 + i * 0.06), 'rgba(110,98,84,0.85)', t * 2.4 + i);
        g.restore();
        // the concrete: ceiling, walls and floor converging on the opening, beams across the ceiling, piers along the walls
        const [a0, b0, a1, b1] = at(0), [c0, d0, c1, d1] = at(1);
        g.fillStyle = vgrad(g, 0, oy0, [[0, '#050403'], [1, '#2a2520']]); g.beginPath(); g.moveTo(a0, b0); g.lineTo(a1, b0); g.lineTo(c1, d0); g.lineTo(c0, d0); g.fill();
        g.fillStyle = '#0d0b09'; g.beginPath(); g.moveTo(a0, b0); g.lineTo(c0, d0); g.lineTo(c0, d1); g.lineTo(a0, b1); g.fill();
        g.beginPath(); g.moveTo(a1, b0); g.lineTo(c1, d0); g.lineTo(c1, d1); g.lineTo(a1, b1); g.fill();
        g.fillStyle = vgrad(g, oy1, H, [[0, '#2a2018'], [0.3, '#140f0b'], [1, '#060403']]); g.beginPath(); g.moveTo(a0, b1); g.lineTo(a1, b1); g.lineTo(c1, d1); g.lineTo(c0, d1); g.fill();
        for (let k = 1; k < 9; k++) {
          const d = 1 - Math.pow(1 - k / 9, 1.6), [x0, y0, x1] = at(d), [, , , y1] = at(d), [px0, py0, px1] = at(Math.min(1, d + 0.035));
          g.fillStyle = `rgba(0,0,0,${0.7 - d * 0.4})`; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(px1, py0); g.lineTo(px0, py0); g.fill();
          if (k % 2 === 0) { g.fillStyle = `rgba(4,3,2,${0.95 - d * 0.5})`; const pw = (x1 - x0) * 0.04; g.fillRect(x0, y0, pw, y1 - y0); g.fillRect(x1 - pw, y0, pw, y1 - y0); }
        }
        // the day's glare spilling a little way in
        g.save(); g.globalCompositeOperation = 'lighter'; glow(g, (ox0 + ox1) / 2, oy1, (ox1 - ox0) * 0.9, 'rgba(255,240,210,0.25)'); g.restore();
        // the camps: a lantern each, people sitting round it, the light on the floor
        groups.forEach((gp, gi) => {
          const [x0, , x1, y1] = at(gp.d), sc = 1 - gp.d * 0.75, cx = x0 + (x1 - x0) * gp.x + sway, cy = y1 - H * 0.02 * sc;
          const fl = 0.85 + 0.15 * Math.sin(t * 7 + gi * 2);
          g.save(); g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.5 * fl; g.drawImage(dot('rgba(255,150,60,1)'), cx - H * 0.3 * sc, cy - H * 0.12 * sc, H * 0.6 * sc, H * 0.24 * sc);
          glow(g, cx, cy - H * 0.06 * sc, H * 0.18 * sc * fl, 'rgba(255,170,80,0.35)');
          g.restore();
          folk[gi]!.forEach((f) => figure(g, cx + f.dx * W * sc, cy, H * (f.kind === 'child' ? 0.2 : 0.3) * sc, '#030201', f.sit ? 'sit' : 'stand', 0, { kind: f.kind }));
          g.fillStyle = '#ffd590'; g.fillRect(cx - 3 * sc, cy - H * 0.07 * sc, 6 * sc + 1, 9 * sc + 1);
          glow(g, cx, cy - H * 0.065 * sc, H * 0.03 * sc, 'rgba(255,230,170,0.95)');
        });
        // a pier right in front, out of focus
        g.save(); g.filter = 'blur(3px)'; g.fillStyle = '#020101'; g.fillRect(W * 0.9, 0, W * 0.12, H); g.restore();
      },
    };
  },

  // "Some people say something is still up there. Circling.": one plane on a slow ring over the white world
  circling(W, H) {
    const sea = cloudSea(91, W * 1.6, H * 0.4);
    return {
      paint(g, t) {
        g.fillStyle = vgrad(g, 0, H, [[0, '#0a1424'], [0.45, '#3c5c8a'], [0.8, '#d8e2ea'], [1, '#fbfaf4']]); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 60; i++) { const x = (i * 211) % W, y = ((i * 89) % 100) / 100 * H * 0.32; g.fillStyle = `rgba(255,255,255,${0.15 + 0.2 * Math.sin(t * 0.7 + i)})`; g.fillRect(x, y, 1.3, 1.3); }
        g.drawImage(sea, -W * 0.3 - (t * W * 0.004), H * 0.66);
        g.fillStyle = vgrad(g, H * 0.75, H, [[0, 'rgba(250,248,240,0)'], [1, 'rgba(250,248,240,0.9)']]); g.fillRect(0, H * 0.75, W, H * 0.25);
        const sx = W * 0.82, sy = H * 0.2;
        glow(g, sx, sy, H * 0.35, 'rgba(255,255,240,0.5)'); glow(g, sx, sy, H * 0.08, 'rgba(255,255,255,1)');
        // its ring, faint where it's flown; the far side of the ring small, the near side large
        const cx = W * 0.48, cy = H * 0.46, rx = W * 0.34, ry = H * 0.14, a = t * 0.2;
        g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, a - 2.6, a); g.stroke();
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, near = 0.55 + 0.45 * (Math.sin(a) + 1) / 2;
        swift(g, x, y, W * 0.11 * near, '#081020', Math.cos(a) * 0.3);
        const glint = Math.max(0, Math.sin(a * 2 + 1)) ** 30;
        if (glint > 0.01) { glow(g, x + W * 0.03 * near, y - 2, H * 0.12 * glint, `rgba(255,255,255,${glint})`); }
      },
    };
  },
};

// ------------------------------------------------------------------ the frame around it
function grainTile(): HTMLCanvasElement {
  const [c, g] = off(192, 192); const r = rand(9);
  const img = g.createImageData(192, 192);
  for (let i = 0; i < img.data.length; i += 4) { const v = 110 + r() * 100; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}

export class Dream {
  private readonly cv: HTMLCanvasElement;
  private readonly g: G;
  private W = 0;
  private H = 0;
  private id: string | null = null;
  private scene: Scene | null = null;
  private t = 0;
  /** How much of the screen the dream covers (0 the world, 1 the dream), and how black it is over the scene. */
  private cover = 0;
  private black = 1;
  private want: string | null = null;
  private swapping = false;
  private waiting: Array<() => void> = [];
  private readonly grain = grainTile();
  private age = 0;

  constructor(parent: HTMLElement) {
    this.cv = document.createElement('canvas');
    this.cv.className = 'dream';
    parent.appendChild(this.cv);
    this.g = this.cv.getContext('2d')!;
  }

  /** The dream covers the whole screen: the world behind it needn't be drawn. */
  get covering(): boolean { return this.cover >= 1; }

  /** Go to a part of the tale (through black), or out of it back to the world (null). Resolves once it's showing. */
  set(id: string | null): Promise<void> {
    this.want = id;
    this.swapping = true;
    return new Promise((r) => this.waiting.push(r));
  }

  /** Gone at once (a skipped tale). */
  clear(): void {
    this.want = this.id = null; this.scene = null; this.cover = 0; this.black = 1; this.swapping = false;
    this.cv.classList.remove('on');
    const w = this.waiting; this.waiting = []; w.forEach((r) => r());
  }

  private size(): void {
    const k = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(Math.min(1920, innerWidth * k)), H = Math.round(Math.min(1080, innerHeight * k));
    if (W === this.W && H === this.H) return;
    this.cv.width = this.W = W; this.cv.height = this.H = H;
    if (this.id) this.scene = SCENES[this.id]?.(W, H) ?? null;
  }

  draw(dt: number): void {
    if (!this.swapping && !this.id && this.cover <= 0) return;
    this.cv.classList.add('on');
    this.size();
    // the fades: cover the world, go black, change scene, come up out of black; or the reverse, out to the world
    if (this.swapping) {
      if (this.cover < 1 && this.want !== null) this.cover = Math.min(1, this.cover + dt / 0.9);
      else if (this.black < 1 && this.id !== this.want) this.black = Math.min(1, this.black + dt / 0.6);
      else if (this.id !== this.want) {
        this.id = this.want; this.t = 0;
        this.scene = this.id ? SCENES[this.id]?.(this.W, this.H) ?? null : null;
      } else if (this.id && this.black > 0) {
        this.black = Math.max(0, this.black - dt / 1.2);
        if (this.black < 0.6) this.release();
        if (this.black <= 0) this.swapping = false;
      } else if (!this.id) {
        this.cover = Math.max(0, this.cover - dt / 1.0);
        if (this.cover <= 0) { this.swapping = false; this.black = 1; this.cv.classList.remove('on'); this.release(); return; }
      }
    }
    this.cv.style.opacity = String(this.cover);
    // paint about 30 times a second
    this.t += dt;
    if ((this.age += dt) < 1 / 30 && !this.swapping) return;
    this.age = 0;
    const g = this.g, W = this.W, H = this.H;
    if (this.scene) {
      // the camera drifts in, slowly, the whole time
      const z = 1.03 + Math.min(this.t, 20) * 0.003;
      g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
      this.scene.paint(g, this.t, W, H);
      g.restore();
      // grain, and the dark at the edges
      g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay';
      const ox = (Math.random() * 192) | 0, oy = (Math.random() * 192) | 0;
      for (let y = -oy; y < H; y += 192) for (let x = -ox; x < W; x += 192) g.drawImage(this.grain, x, y);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    if (this.black > 0 || !this.scene) { g.fillStyle = `rgba(0,0,0,${this.scene ? this.black : 1})`; g.fillRect(0, 0, W, H); }
  }

  private release(): void { const w = this.waiting; this.waiting = []; w.forEach((r) => r()); }
}
