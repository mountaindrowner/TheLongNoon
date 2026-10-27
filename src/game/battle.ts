import * as THREE from 'three';
import type { Actor } from './actors';
import type { Sound } from './sound';
import type { GameState } from './state';

/**
 * The fight, from the first version (legacy/poc2 17-battle.js), rule for
 * rule. It's fought where it starts, in the world, not on a separate stage.
 * - Turns by charge time: each unit gains its speed every tick and acts at
 *   100. The strip at the top shows who's next.
 * - Hit what's soft: you pick a part, not just a target. Armor shrugs off the
 *   pipe; a machine's eye is soft, and breaking it stuns it, then blinds it.
 * - The pipe wears down and bends.
 * - Brace for half damage. Drink water to heal. Running is refused when the
 *   fight says so.
 * - Parry: when a hit comes, a ring closes on whoever's hit. Press as it
 *   closes and the hit does a fifth.
 */

export interface PartDef { id: string; name: string; hp: number; soft?: boolean; armor?: number }
export interface FoeDef { id: string; name: string; spd: number; parts: PartDef[]; flee?: number }
export interface UnitDef { name: string; hp: number; atk: number; spd: number; weapon: string; sling?: boolean }
export interface FightDef { noRun: string; party: string[]; enemies: FoeDef[]; intro: string }

interface Unit { id: string; name: string; party: true; actor: Actor; hp: number; max: number; atk: number; spd: number; ct: number; sling: boolean; weapon: string; brace: boolean }
interface Part extends PartDef { max: number }
interface Foe { id: string; name: string; party: false; actor: Actor; def: FoeDef; parts: Part[]; spd: number; ct: number; stunned: number; eyeBroken: boolean; fled: boolean }
type Any = Unit | Foe;

export interface FightWorld {
  sound: Sound;
  state: GameState;
  /** World point → screen px; null when behind the camera. */
  toScreen(x: number, y: number, z: number): { x: number; y: number } | null;
  ground(x: number, z: number): number;
  /** The tint everyone wears in this light (restored after a flash). */
  tint: THREE.Color;
  /** The broken frame for a machine whose eye is gone. */
  blind(f: Actor): void;
  /** A machine gone still (its eye's light out). */
  dead(f: Actor): void;
  touch: boolean;
  /** Someone acts on someone: the stage can cut the camera to it. */
  onAct?(who: Actor, target: Actor): void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const tween = (ms: number, fn: (k: number) => void): Promise<void> => new Promise((res) => {
  const t0 = performance.now();
  const f = (): void => { const t = Math.min(1, (performance.now() - t0) / ms); fn(easeOut(t)); if (t < 1) requestAnimationFrame(f); else res(); };
  f();
});
const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const alive = (f: Foe): boolean => !f.fled && f.parts.find((p) => p.id === 'body')!.hp > 0;
const live = (all: Any[]): Any[] => all.filter((u) => (u.party ? u.hp > 0 : alive(u)));

function nextTurn(all: Any[]): Any {
  const l = live(all);
  for (let g = 0; g < 1000; g++) {
    let best: Any | null = null;
    for (const u of l) if (u.ct >= 100 && (!best || u.ct > best.ct)) best = u;
    if (best) { best.ct -= 100; return best; }
    for (const u of l) u.ct += u.spd;
  }
  return l[0]!;
}
function preview(all: Any[], n: number): Any[] {
  const l = live(all).map((u) => ({ u, ct: u.ct }));
  const out: Any[] = [];
  for (let g = 0; g < 800 && out.length < n; g++) {
    let best: (typeof l)[number] | null = null;
    for (const s of l) if (s.ct >= 100 && (!best || s.ct > best.ct)) best = s;
    if (best) { best.ct -= 100; out.push(best.u); } else for (const s of l) s.ct += s.u.spd;
  }
  return out;
}

export class Fight {
  private readonly root: HTMLDivElement;
  private readonly turnbar: HTMLDivElement;
  private readonly msg: HTMLDivElement;
  private readonly partyEl: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private readonly floats: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private menuRes: ((id: string | null) => void) | null = null;
  private qteRes: (() => void) | null = null;
  private party: Unit[] = [];
  private on = false;

  constructor(parent: HTMLElement, private readonly w: FightWorld) {
    this.root = document.createElement('div');
    this.root.className = 'fight';
    parent.appendChild(this.root);
    const mk = (cls: string): HTMLDivElement => { const d = document.createElement('div'); d.className = cls; this.root.appendChild(d); return d; };
    this.turnbar = mk('f-turns');
    this.msg = mk('f-msg');
    this.partyEl = mk('f-party');
    this.menu = mk('f-menu');
    this.floats = mk('f-floats');
    this.ring = mk('f-ring');
    this.ring.innerHTML = '<i></i><b></b>';
    this.root.addEventListener('pointerdown', (e) => { if (this.qteRes && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); this.qteRes(); } });
  }

  get active(): boolean { return this.on; }

  /** Which staging the fight is shown in (the menus sit differently in each; ui.css `.fight.l-…`). */
  setLayout(name: string): void { this.root.className = `fight l-${name}${this.on ? ' on' : ''}`; }

  /** Keys while fighting: the menu, and the parry. True when used. */
  key(code: string): boolean {
    if (!this.on) return false;
    if (this.qteRes && ['Space', 'Enter', 'KeyE', 'KeyZ'].includes(code)) { this.qteRes(); return true; }
    if (!this.menuRes) return true;
    const bs = [...this.menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (code.startsWith('Arrow')) { const d = code === 'ArrowDown' || code === 'ArrowRight' ? 1 : -1; bs[(i + d + bs.length) % bs.length]?.focus(); this.w.sound.tick(); return true; }
    if (['Enter', 'Space', 'KeyE', 'KeyZ'].includes(code)) { bs[Math.max(0, i)]?.click(); return true; }
    if (['Escape', 'Backspace', 'KeyQ'].includes(code)) { this.pick(null); return true; }
    return true;
  }

  private pick(v: string | null): void {
    const r = this.menuRes;
    if (!r) return;
    this.menuRes = null;
    this.menu.replaceChildren();
    this.menu.classList.remove('on');
    if (v === null) this.w.sound.back(); else this.w.sound.blip();
    r(v);
  }
  private choose(items: Array<{ id: string | null; label?: string; html?: string; sub?: string; disabled?: boolean }>, hd?: string): Promise<string | null> {
    this.menu.replaceChildren();
    this.menu.classList.add('on');
    if (hd) { const h = document.createElement('div'); h.className = 'hd'; h.textContent = hd; this.menu.appendChild(h); }
    for (const it of items) {
      const b = document.createElement('button');
      b.innerHTML = it.html ?? esc(it.label ?? '');
      if (it.sub) { const s = document.createElement('small'); s.textContent = it.sub; b.appendChild(s); }
      b.disabled = !!it.disabled;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.pick(it.id); });
      b.addEventListener('mouseenter', () => { if (!b.disabled) b.focus(); });
      this.menu.appendChild(b);
    }
    setTimeout(() => this.menu.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true }), 30);
    return new Promise((r) => { this.menuRes = r; });
  }

  private async say(t: string, ms = 900): Promise<void> { this.msg.textContent = t; this.msg.classList.toggle('on', !!t); if (ms) await sleep(ms); }

  private float(a: Actor, t: string, cls = '', dy = 0): void {
    const s = this.w.toScreen(a.x, a.root.position.y + 1.5 + dy, a.z);
    if (!s) return;
    const d = document.createElement('div');
    d.className = `fl ${cls}`;
    d.textContent = t;
    d.style.left = `${s.x}px`; d.style.top = `${s.y}px`;
    this.floats.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  }
  private flash(a: Actor): void { a.setTint(new THREE.Color(3, 3, 3)); setTimeout(() => a.setTint(this.w.tint), 130); }
  private shake(a: Actor): void {
    const x0 = a.x;
    void tween(240, (t) => { a.place(x0 + Math.sin(t * 40) * 0.08 * (1 - t), a.root.position.y, a.z); }).then(() => a.place(x0, a.root.position.y, a.z));
  }
  private async lunge(a: Actor, t: Actor, frac = 0.62): Promise<void> {
    this.w.onAct?.(a, t);
    const sx = a.x, sz = a.z, tx = lerp(sx, t.x, frac), tz = lerp(sz, t.z, frac);
    a.moving = true;
    this.w.sound.whoosh();
    await tween(200, (k) => { const x = lerp(sx, tx, k), z = lerp(sz, tz, k); a.place(x, this.w.ground(x, z), z); });
    await tween(220, (k) => { const x = lerp(tx, sx, k), z = lerp(tz, sz, k); a.place(x, this.w.ground(x, z), z); });
    a.moving = false;
  }
  private async shoot(a: Actor, t: Actor): Promise<void> {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xe8e2d4 }));
    a.root.parent?.add(b);
    this.w.onAct?.(a, t);
    this.w.sound.twang();
    const y0 = a.root.position.y;
    await tween(260, (k) => { b.position.set(lerp(a.x, t.x, k), y0 + 0.9 + Math.sin(k * Math.PI) * 0.6, lerp(a.z, t.z, k)); });
    b.parent?.remove(b); b.geometry.dispose(); (b.material as THREE.Material).dispose();
  }

  private renderTurns(cur: Any, all: Any[]): void {
    this.turnbar.innerHTML = [cur, ...preview(all, 5)].map((u) => `<span class="${u.party ? '' : 'e'}">${esc(u.name)}</span>`).join('');
  }
  private renderParty(cur: Unit | null): void {
    const s = this.w.state;
    this.partyEl.innerHTML = this.party.map((p) => {
      const wpn = p.id === 'juno' ? (s.party.juno.dur > 0 ? `Pipe ${s.party.juno.dur}/12` : 'Pipe (bent)') : p.weapon;
      return `<div class="pc ${cur === p ? 'act' : ''}"><b>${esc(p.name)}</b><div class="bar"><i style="width:${Math.round((100 * p.hp) / p.max)}%"></i></div><span class="hp">${p.hp}/${p.max}</span><span class="wpn">${wpn}${p.brace ? ' · bracing' : ''}</span></div>`;
    }).join('');
  }

  /** The ring closing on whoever's about to be hit; resolves 'parry' if pressed as it closes. */
  private qte(a: Actor): Promise<'parry' | 'fail'> {
    return new Promise((res) => {
      const s = this.w.state, first = !s.flags.qteSeen;
      s.flags.qteSeen = true;
      const T = first ? 1200 : 900;
      const lab = this.ring.querySelector('b')!, ring = this.ring.querySelector('i')!;
      lab.textContent = first ? (this.w.touch ? 'Tap when the ring closes' : 'Press Space when the ring closes') : '';
      const p = this.w.toScreen(a.x, a.root.position.y + 0.9, a.z) ?? { x: innerWidth / 2, y: innerHeight / 2 };
      this.ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
      this.ring.classList.add('on');
      const t0 = performance.now() + (first ? 500 : 150);
      let over = false;
      const end = (r: 'parry' | 'fail'): void => { if (over) return; over = true; this.qteRes = null; this.ring.classList.remove('on'); res(r); };
      const fr = (): void => {
        if (over) return;
        const k = (performance.now() - t0) / T;
        ring.style.transform = `scale(${lerp(2.5, 1, Math.min(1, Math.max(0, k)))})`;
        ring.style.opacity = k < 0 ? '0.4' : '1';
        if (k > 1.22) { end('fail'); return; }
        requestAnimationFrame(fr);
      };
      this.qteRes = () => { const k = (performance.now() - t0) / T; end(k >= 0.78 && k <= 1.22 ? 'parry' : 'fail'); };
      fr();
    });
  }

  private async flee(f: Foe): Promise<void> {
    f.fled = true;
    this.w.sound.yelp();
    await this.say(`The ${f.name.toLowerCase()} yelps and limps off into the brush.`, 0);
    const a = f.actor, sx = a.x;
    a.dir = 'E'; a.moving = true;
    await tween(900, (k) => { const x = sx + k * 7; a.place(x, this.w.ground(x, a.z), a.z); });
    a.root.visible = false;
    await sleep(500);
  }

  private async playerTurn(u: Unit, foes: Foe[], def: FightDef): Promise<void> {
    const s = this.w.state;
    u.brace = false;
    this.renderParty(u);
    await this.say(`${u.name}'s turn.`, 0);
    for (;;) {
      const c = await this.choose([
        { id: 'fight', label: 'Fight', sub: u.id === 'juno' ? (s.party.juno.dur > 0 ? 'Pipe' : 'Bent pipe') : 'Sling' },
        { id: 'brace', label: 'Brace', sub: 'Half damage' },
        { id: 'drink', label: 'Drink water', sub: `${s.water} left`, disabled: s.water <= 0 || u.hp >= u.max },
        { id: 'run', label: 'Run' },
      ], u.name);
      if (c === 'fight') {
        const known = s.pages.includes('5');
        const items: Array<{ id: string | null; html?: string; label?: string; sub?: string }> = [];
        for (const f of foes.filter(alive)) for (const p of f.parts.filter((q) => q.hp > 0)) {
          let tag = '';
          if (known && p.soft) tag = '<span class="tag soft">Soft</span>';
          if (p.armor) tag = f.stunned ? '<span class="tag brk">Broken</span>' : '<span class="tag armor">Armor</span>';
          const lbl = f.parts.length > 1 ? `${f.name}: ${p.name}` : f.name;
          items.push({ id: `${f.id}|${p.id}`, html: `${esc(lbl)}${tag}`, sub: `${p.hp}/${p.max}` });
        }
        items.push({ id: null, label: 'Back' });
        const tg = await this.choose(items, 'Hit what?');
        if (!tg) continue;
        const [fid, pid] = tg.split('|');
        const f = foes.find((x) => x.id === fid)!;
        await this.attack(u, f, f.parts.find((p) => p.id === pid)!);
        return;
      }
      if (c === 'brace') { u.brace = true; this.w.sound.brace(); this.renderParty(null); await this.say(`${u.name} braces.`, 700); return; }
      if (c === 'drink') {
        s.water--;
        u.hp = Math.min(u.max, u.hp + 16);
        this.float(u.actor, '+16', 'good');
        this.w.sound.gulp(); setTimeout(() => this.w.sound.heal(), 300);
        await this.say(`${u.name} drinks. One less cup of water.`, 900);
        return;
      }
      if (c === 'run') { await this.say(def.noRun, 1200); continue; }
    }
  }

  private async attack(u: Unit, f: Foe, part: Part): Promise<void> {
    const s = this.w.state;
    if (u.sling) await this.shoot(u.actor, f.actor); else await this.lunge(u.actor, f.actor);
    let mult = 1, brk = false;
    if (part.soft) mult *= u.sling ? 2.2 : 1.4;
    if (part.armor) { if (f.stunned) { mult *= 2; brk = true; } else mult *= u.sling ? 0.3 : f.eyeBroken ? 0.6 : part.armor; }
    if (u.id === 'juno') {
      const j = s.party.juno;
      if (j.dur <= 0) mult *= 0.6;
      else { j.dur = Math.max(0, j.dur - (part.armor ? 2 : 1)); if (j.dur === 0) await this.say("The pipe bends. It won't swing straight anymore.", 1200); }
    }
    const dmg = Math.max(1, Math.round((u.atk + ri(0, 2)) * mult));
    part.hp = Math.max(0, part.hp - dmg);
    this.flash(f.actor); this.shake(f.actor);
    if (part.armor && !brk) this.w.sound.clang(); else this.w.sound.thud();
    this.float(f.actor, String(dmg), brk ? 'brk' : '');
    this.renderParty(null);
    if (part.armor && !f.stunned && !f.eyeBroken && !u.sling && !s.flags.armorHint) { s.flags.armorHint = true; await this.say("Armor. The pipe barely dents it. Hit what's soft.", 1700); }
    if (part.id === 'eye' && part.hp === 0 && !f.eyeBroken) {
      f.eyeBroken = true; f.stunned = 1;
      this.w.blind(f.actor);
      this.float(f.actor, 'BREAK!', 'brk', 0.7);
      this.w.sound.brk();
      await this.say('Sensor broken! The Stray is blind and stunned.', 1600);
    }
    if (f.def.flee && !f.fled && f.parts[0]!.hp <= f.def.flee) await this.flee(f);
    else if (!alive(f)) {
      if (f.id === 'stray') { this.w.sound.powerDown(); this.w.dead(f.actor); }
      await this.say(`The ${f.name.toLowerCase()} shudders and goes still.`, 1100);
    }
    await sleep(250);
  }

  private async hit(f: Foe, targets: Unit[], base: number, kind: 'spark' | 'lunge' | 'ram'): Promise<void> {
    const r = await this.qte(targets[0]!.actor);
    if (kind === 'spark') { this.w.sound.zap(); for (let i = 0; i < 3; i++) { for (const t of targets) this.flash(t.actor); await sleep(90); } }
    else await this.lunge(f.actor, targets[0]!.actor, 0.6);
    for (const t of targets) {
      let d = base;
      if (r === 'parry') d = Math.round(d * 0.2);
      if (t.brace) d = Math.round(d * 0.5);
      t.hp = Math.max(0, t.hp - d);
      this.flash(t.actor); this.shake(t.actor);
      this.float(t.actor, String(d), r === 'parry' ? 'small' : '');
    }
    if (r === 'parry') { this.float(targets[0]!.actor, 'Parry!', 'good', 0.85); this.w.sound.parry(); } else this.w.sound.hurt();
    this.renderParty(null);
    for (const t of targets) if (t.hp === 0) { this.w.sound.ko(); await this.say(`${t.name} is down.`, 900); }
    await sleep(300);
  }

  private async enemyTurn(f: Foe): Promise<void> {
    const up = this.party.filter((p) => p.hp > 0);
    if (!up.length) return;
    if (f.id === 'coyote') {
      const t = up.slice().sort((a, b) => a.hp - b.hp)[0]!;
      this.w.sound.growl();
      await this.say(`The coyote lunges at ${t.name}!`, 450);
      await this.hit(f, [t], ri(4, 6), 'lunge');
      return;
    }
    if (f.stunned > 0) { f.stunned--; this.w.sound.beep(); await this.say('The Stray spins in place, blind.', 1200); return; }
    if (!f.eyeBroken && Math.random() < 0.35) { await this.say('The Stray sparks! Arcs jump across the concrete.', 600); await this.hit(f, up, ri(4, 6), 'spark'); return; }
    const t = up[ri(0, up.length - 1)]!;
    this.w.sound.servo();
    await this.say(`The Stray rams ${t.name}!`, 450);
    if (f.eyeBroken && Math.random() < 0.4) { await this.lunge(f.actor, t.actor, 0.35); this.float(t.actor, 'Miss', 'miss'); await this.say('Blind, it slams into the concrete instead.', 1000); return; }
    await this.hit(f, [t], ri(7, 10), 'ram');
  }

  /**
   * Fight it out. `party` and `foes` are actors already standing where they fight.
   * Resolves 'win', or 'lose' with the player's pick ('retry' or 'load').
   */
  async fight(def: FightDef, units: Record<string, UnitDef>, partyActors: Record<string, Actor>, foeActors: Actor[], retry = false): Promise<'win' | 'retry' | 'load'> {
    const s = this.w.state;
    this.on = true;
    this.root.classList.add('on');
    this.party = def.party.map((id) => {
      const b = units[id]!;
      return { id, name: b.name, party: true as const, actor: partyActors[id]!, hp: id === 'juno' ? s.party.juno.hp : s.party.kit.hp, max: b.hp, atk: b.atk, spd: b.spd, ct: Math.random() * 30, sling: !!b.sling, weapon: b.weapon, brace: false };
    });
    const startHp = this.party.map((p) => p.hp), startDur = s.party.juno.dur;
    const foes: Foe[] = def.enemies.map((e, i) => ({ id: e.id, name: e.name, party: false as const, actor: foeActors[i]!, def: e, parts: e.parts.map((p) => ({ ...p, max: p.hp })), spd: e.spd, ct: Math.random() * 30, stunned: 0, eyeBroken: false, fled: false }));
    this.renderParty(null);
    if (!retry) await this.say(def.intro, 1100);
    const all: Any[] = [...this.party, ...foes];
    let result: 'win' | 'lose' | null = null;
    while (!result) {
      const u = nextTurn(all);
      this.renderTurns(u, all);
      if (u.party) { this.w.sound.turn(); await this.playerTurn(u, foes, def); } else await this.enemyTurn(u);
      this.renderParty(null);
      if (foes.every((f) => !alive(f))) result = 'win';
      else if (this.party.every((p) => p.hp <= 0)) result = 'lose';
    }
    this.turnbar.innerHTML = '';
    const writeBack = (): void => { for (const p of this.party) { if (p.id === 'juno') s.party.juno.hp = Math.max(1, p.hp); else s.party.kit.hp = Math.max(1, p.hp); } };
    if (result === 'lose') {
      this.w.sound.ko();
      await this.say('Juno goes down.', 1300);
      const c = await this.choose([{ id: 'retry', label: 'Try the fight again' }, { id: 'load', label: 'Load last save' }]);
      // back on your feet with at least six tenths of your health; the pipe as it was
      this.party.forEach((p, i) => { p.hp = Math.max(startHp[i]!, Math.round(p.max * 0.6)); });
      writeBack();
      s.party.juno.dur = startDur;
      this.end();
      return c === 'load' ? 'load' : 'retry';
    }
    await this.say('The drain goes quiet.', 0);
    this.w.sound.music('none');
    this.w.sound.victory();
    await sleep(1700);
    writeBack();
    this.end();
    return 'win';
  }

  private end(): void {
    this.on = false;
    this.root.classList.remove('on');
    this.msg.classList.remove('on');
    this.menu.classList.remove('on');
    this.partyEl.innerHTML = '';
  }
}
