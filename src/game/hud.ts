import type { GameState } from './state';
import { CONDITIONS } from './sun';
import { ITEM_NAMES } from './state';
import { DEFAULT_SETTINGS, type Settings } from './settings';

/**
 * The story's screen furniture, ported from the first version (legacy/poc2
 * 13-staybook, 14-quests-hud, 19-intro-cinematic, 21-menus) into the
 * rebuild's interface style (spec §15: dark glass, a thin gold rule):
 * - the status panel: the clock, ten drops of water, the tins of white, Juno's health and what the white did to her;
 * - the objective under it, and a marker over the target;
 * - toasts and the daylight warning;
 * - the staybook's pages;
 * - the title, the pause menu, the options and the end card;
 * - the chapter cards and the skip button for the tale.
 */

export interface Page { who: 'dad' | 'mom'; text: string; teach: string }
/** The staybook in order: her parents' pages, then Juno's own (side stories). */
export const PAGE_ORDER = ['1', '2', '3', '5', 'last', 'j2', 'j3', 'j3b', 'j4', 'j5', 'j6', 'jflour_a', 'jflour_b', 'jbell', 'jneto_a', 'jneto_b', 'jcloud_a', 'jcloud_b'];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
};
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const touch = (): boolean => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/** A column of buttons: arrows move, Enter/Space/E picks, Escape backs out (when allowed). */
class Menu {
  private readonly box: HTMLDivElement;
  private res: ((id: string | null) => void) | null = null;
  constructor(parent: HTMLElement, cls: string, private readonly sfx: (n: string) => void) { this.box = el('div', `menu ${cls}`, parent); }
  get open(): boolean { return this.res !== null; }
  show(items: Array<{ id: string; label: string; sub?: string; hidden?: boolean }>, back = false): Promise<string | null> {
    this.box.replaceChildren();
    for (const it of items) {
      if (it.hidden) continue;
      const b = el('button', 'menu-item', this.box, it.label);
      if (it.sub) el('small', '', b, it.sub);
      b.addEventListener('click', (e) => { e.stopPropagation(); this.done(it.id); });
      b.addEventListener('mouseenter', () => b.focus());
    }
    this.back = back;
    setTimeout(() => (this.box.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true }), 30);
    return new Promise((r) => { this.res = r; });
  }
  private back = false;
  done(id: string | null): void { const r = this.res; this.res = null; this.box.replaceChildren(); this.sfx(id === null ? 'back' : 'blip'); r?.(id); }
  key(code: string): boolean {
    if (!this.res) return false;
    const bs = [...this.box.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (code === 'ArrowDown' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowLeft') {
      const d = code === 'ArrowDown' || code === 'ArrowRight' ? 1 : -1;
      bs[(i + d + bs.length) % bs.length]?.focus();
      this.sfx('tick');
      return true;
    }
    if (code === 'Enter' || code === 'Space' || code === 'KeyE' || code === 'KeyZ') { (bs[Math.max(0, i)] as HTMLButtonElement | undefined)?.click(); return true; }
    if ((code === 'Escape' || code === 'Backspace' || code === 'KeyQ') && this.back) { this.done(null); return true; }
    return false;
  }
}

/** What the options screen can't hold itself: going full screen, which only the page can ask for. */
export interface ScreenControl { can: boolean; on(): boolean; toggle(): Promise<void> }

type OptRow =
  | { kind: 'head'; label: string }
  | { kind: 'level'; key: 'master' | 'music' | 'sfx' | 'voices'; label: string }
  | { kind: 'choice'; key: 'text' | 'blur' | 'resolution' | 'perf'; label: string; values: Array<[Settings[keyof Settings], string]> }
  | { kind: 'full'; label: string }
  | { kind: 'note'; label: string }
  | { kind: 'act'; id: 'reset' | 'back'; label: string };

const OPTIONS: OptRow[] = [
  { kind: 'head', label: 'Sound' },
  { kind: 'level', key: 'master', label: 'Everything' },
  { kind: 'level', key: 'music', label: 'Music' },
  { kind: 'level', key: 'sfx', label: 'Effects and the world' },
  { kind: 'level', key: 'voices', label: 'Voices' },
  { kind: 'head', label: 'Text' },
  { kind: 'choice', key: 'text', label: 'Text speed', values: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'At once']] },
  { kind: 'head', label: 'Picture' },
  { kind: 'choice', key: 'blur', label: 'Depth blur', values: [[true, 'On'], [false, 'Off']] },
  { kind: 'choice', key: 'resolution', label: 'Resolution', values: [['sharp', 'Sharp'], ['balanced', 'Balanced'], ['fast', 'Fast']] },
  { kind: 'full', label: 'Full screen' },
  { kind: 'choice', key: 'perf', label: 'Frame rate', values: [[false, 'Hidden'], [true, 'Shown']] },
  { kind: 'head', label: 'Controls' },
  { kind: 'note', label: touch() ? 'Drag on the left side to walk; push far to run.\nA talks and looks. Book opens the staybook, Menu this menu.\nTap the map to bring it near or far.' : 'WASD or the arrows walk; hold Shift to run.\nE or Space talks and looks. B or Tab opens the staybook.\nM brings the map near or far. Esc opens this menu.' },
  { kind: 'act', id: 'reset', label: 'Back to defaults' },
  { kind: 'act', id: 'back', label: 'Done' },
];

/**
 * The options screen: rows of volumes (ten notches), choices that step left and right, and the controls. Arrows
 * move and change, Enter steps a choice, Escape closes; every part is a tap target too. Each change is applied
 * as it's made.
 */
class Options {
  readonly box: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private s!: Settings;
  private apply: (s: Settings) => void = () => {};
  private screen: ScreenControl | null = null;
  private done: (() => void) | null = null;
  private rows: Array<{ row: OptRow; el: HTMLElement; paint(): void }> = [];
  constructor(parent: HTMLElement, private readonly sfx: (n: string) => void) {
    this.box = el('div', 'options', parent);
    const panel = el('div', 'opt-panel', this.box);
    el('h2', '', panel, 'Options');
    this.list = el('div', 'opt-list', panel);
  }
  get open(): boolean { return this.done !== null; }

  show(s: Settings, apply: (s: Settings) => void, screen: ScreenControl): Promise<void> {
    this.s = s; this.apply = apply; this.screen = screen;
    this.build();
    this.box.classList.add('on');
    setTimeout(() => this.rows.find((r) => r.row.kind !== 'head' && r.row.kind !== 'note')?.el.focus({ preventScroll: true }), 30);
    return new Promise((r) => { this.done = r; });
  }
  private close(): void {
    const d = this.done;
    this.done = null;
    this.box.classList.remove('on');
    this.sfx('back');
    d?.();
  }
  private change(): void { this.apply(this.s); this.rows.forEach((r) => r.paint()); }

  private build(): void {
    this.list.replaceChildren();
    this.rows = [];
    for (const row of OPTIONS) {
      if (row.kind === 'full' && !this.screen?.can) continue;
      if (row.kind === 'head') { el('h3', '', this.list, row.label); continue; }
      if (row.kind === 'note') { const n = el('p', 'opt-note', this.list); for (const l of row.label.split('\n')) el('span', '', n, l); continue; }
      if (row.kind === 'act') {
        const b = el('button', 'menu-item opt-act', this.list, row.label);
        b.addEventListener('click', (e) => { e.stopPropagation(); this.act(row.id); });
        b.addEventListener('mouseenter', () => b.focus());
        this.rows.push({ row, el: b, paint: () => {} });
        continue;
      }
      const r = el('div', 'opt-row', this.list);
      r.tabIndex = 0;
      el('span', 'opt-label', r, row.label);
      const ctl = el('div', 'opt-ctl', r);
      const less = el('button', 'opt-step', ctl, '‹');
      const mid = el('div', row.kind === 'level' ? 'opt-pips' : 'opt-val', ctl);
      const more = el('button', 'opt-step', ctl, '›');
      less.tabIndex = more.tabIndex = -1;
      less.setAttribute('aria-label', 'Less'); more.setAttribute('aria-label', 'More');
      less.addEventListener('click', (e) => { e.stopPropagation(); r.focus(); this.step(row, -1); });
      more.addEventListener('click', (e) => { e.stopPropagation(); r.focus(); this.step(row, 1); });
      r.addEventListener('mouseenter', () => r.focus({ preventScroll: true }));
      let paint: () => void;
      if (row.kind === 'level') {
        r.setAttribute('role', 'slider'); r.setAttribute('aria-valuemin', '0'); r.setAttribute('aria-valuemax', '10');
        const pips = Array.from({ length: 10 }, (_, i) => {
          const p = el('i', '', mid);
          p.addEventListener('click', (e) => { e.stopPropagation(); r.focus(); const v = i + 1; this.s[row.key] = this.s[row.key] === v && v === 1 ? 0 : v; this.sfx('tick'); this.change(); });
          return p;
        });
        const num = el('b', 'opt-num', ctl);
        ctl.insertBefore(num, more);
        paint = () => { const v = this.s[row.key]; pips.forEach((p, i) => p.classList.toggle('on', i < v)); num.textContent = String(v); r.setAttribute('aria-valuenow', String(v)); };
      } else if (row.kind === 'full') {
        paint = () => { mid.textContent = this.screen?.on() ? 'On' : 'Off'; };
        mid.addEventListener('click', (e) => { e.stopPropagation(); this.step(row, 1); });
      } else {
        paint = () => { const v = this.s[row.key]; mid.textContent = row.values.find(([x]) => x === v)?.[1] ?? String(v); };
        mid.addEventListener('click', (e) => { e.stopPropagation(); r.focus(); this.step(row, 1); });
      }
      paint();
      this.rows.push({ row, el: r, paint });
    }
  }

  private step(row: OptRow, d: number): void {
    if (row.kind === 'level') {
      const v = Math.max(0, Math.min(10, this.s[row.key] + d));
      if (v === this.s[row.key]) return;
      this.s[row.key] = v;
    } else if (row.kind === 'choice') {
      const i = row.values.findIndex(([x]) => x === this.s[row.key]);
      const n = row.values.length;
      (this.s as unknown as Record<string, unknown>)[row.key] = row.values[(i + d + n) % n]![0];
    } else if (row.kind === 'full') {
      void this.screen?.toggle().then(() => this.rows.forEach((r) => r.paint()));
      this.sfx('tick');
      return;
    } else return;
    this.sfx('tick');
    this.change();
  }
  private act(id: 'reset' | 'back'): void {
    if (id === 'back') { this.close(); return; }
    Object.assign(this.s, DEFAULT_SETTINGS);
    this.sfx('blip');
    this.change();
  }

  key(code: string): boolean {
    if (!this.done) return false;
    const els = this.rows.map((r) => r.el);
    const i = els.indexOf(document.activeElement as HTMLElement);
    const row = this.rows[i]?.row;
    if (code === 'ArrowDown' || code === 'ArrowUp' || code === 'KeyS' || code === 'KeyW') {
      const d = code === 'ArrowDown' || code === 'KeyS' ? 1 : -1;
      const next = els[(Math.max(0, i) + d + els.length) % els.length];
      next?.focus(); next?.scrollIntoView({ block: 'nearest' });
      this.sfx('tick');
      return true;
    }
    if ((code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') && row) { this.step(row, code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1); return true; }
    if (code === 'Enter' || code === 'Space' || code === 'KeyE' || code === 'KeyZ') {
      if (row?.kind === 'act') this.act(row.id);
      else if (row) this.step(row, 1);
      return true;
    }
    if (code === 'Escape' || code === 'Backspace' || code === 'KeyQ') { this.close(); return true; }
    return true; // nothing else gets through while it's open
  }
}

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly time: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly drops: HTMLDivElement;
  private readonly hpBar: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly conds: HTMLDivElement;
  private readonly glare: HTMLDivElement;
  private condKey = '';
  private readonly objSide: HTMLDivElement;
  private objTop = 0;
  private readonly tins: HTMLElement;
  private readonly obj: HTMLDivElement;
  private readonly objText: HTMLDivElement;
  private readonly warn: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  readonly marker: HTMLDivElement;
  private readonly book: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly pause: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly chapterEl: HTMLDivElement;
  readonly skip: HTMLButtonElement;
  readonly buttons: HTMLDivElement;
  private readonly menus: Menu[] = [];
  private readonly titleMenu: Menu;
  private readonly pauseMenu: Menu;
  private readonly cardMenu: Menu;
  private readonly options: Options;
  private readonly press: HTMLParagraphElement;
  /** Waiting on "press any key" at the title. */
  private pressed: (() => void) | null = null;
  private bookClose: (() => void) | null = null;
  /** Plays an interface sound by name (game/sound.ts). */
  sfx: (n: string) => void = () => {};
  private bookKey: ((code: string) => boolean) | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'story', parent);
    this.status = el('div', 'status', this.root);
    const row = el('div', 'st-time', this.status);
    this.time = el('b', '', row);
    this.phase = el('span', '', row);
    const meter = el('div', 'st-meter', this.status);
    this.drops = el('div', 'st-drops', meter);
    for (let i = 0; i < 10; i++) el('i', 'drop', this.drops);
    const t = el('div', 'st-white', meter);
    el('i', 'tin', t);
    this.tins = el('span', '', t, '0');
    const hp = el('div', 'st-hp', this.status);
    this.hpBar = el('i', '', el('div', 'bar', hp));
    this.hpText = el('span', '', hp);
    this.conds = el('div', 'st-conds', this.status);
    this.glare = el('div', 'glare', this.root);
    this.obj = el('div', 'objective', this.root);
    el('div', 'obj-mission', this.obj);
    this.objText = el('div', 'obj-text', this.obj);
    this.objSide = el('div', 'obj-side', this.obj);
    this.warn = el('div', 'warn', this.root);
    this.toasts = el('div', 'toasts', this.root);
    this.marker = el('div', 'marker', this.root);
    el('i', '', this.marker);
    this.book = el('div', 'book', this.root);
    this.title = el('div', 'title-screen', this.root);
    this.pause = el('div', 'pause', this.root);
    this.card = el('div', 'end-card', this.root);
    this.chapterEl = el('div', 'chapter', this.root);
    this.skip = el('button', 'skip', this.root, 'Skip ›');
    this.buttons = el('div', 'story-buttons', this.root);
    // the lockup: a sun on the line of the land, the name, a rule, the town's first rule
    const tm = el('div', 'ts-inner', this.title);
    const lock = el('div', 'ts-lock', tm);
    el('i', 'ts-sun', lock);
    el('h1', '', lock, 'The Long Noon');
    const rule = el('div', 'ts-rule', lock);
    el('span', '', rule); el('b', '', rule); el('span', '', rule);
    el('p', 'ts-tag', lock, 'Never walk in white.');
    this.press = el('p', 'ts-press', tm, touch() ? 'Tap to begin' : 'Press any key');
    const sfx = (n: string): void => this.sfx(n);
    this.titleMenu = new Menu(tm, 'ts-menu', sfx);
    el('p', 'ts-foot', this.title, touch() ? 'Drag on the left to walk. Tap A to talk.' : 'WASD or arrows to walk · E to talk · B the staybook · M the map · Esc the menu');
    el('p', 'ts-ver', this.title, 'The Prologue');
    this.title.addEventListener('pointerdown', () => { if (this.pressed) { const r = this.pressed; this.pressed = null; r(); } });
    this.pauseMenu = new Menu(this.pause, 'pause-menu', sfx);
    el('div', 'pause-side', this.pause);
    el('h2', '', this.card, 'Night one');
    el('p', '', this.card, 'Given to the Sun');
    this.cardMenu = new Menu(this.card, 'card-menu', sfx);
    this.menus.push(this.titleMenu, this.pauseMenu, this.cardMenu);
    this.options = new Options(this.root, sfx);
    this.show(false);
  }

  /** Whether any menu or the book is up (the world waits). */
  get modal(): boolean { return this.menus.some((m) => m.open) || this.bookClose !== null || this.options.open || this.pressed !== null; }

  /** Keys for whatever's open. True when it was used. */
  key(code: string): boolean {
    if (this.pressed) { const r = this.pressed; this.pressed = null; r(); return true; }
    if (this.options.key(code)) return true;
    if (this.bookKey?.(code)) return true;
    for (const m of this.menus) if (m.key(code)) return true;
    return false;
  }

  /** The play HUD (status, objective, touch buttons) on or off. */
  show(on: boolean): void {
    this.status.classList.toggle('on', on);
    this.obj.classList.toggle('on', on && this.objText.textContent !== '');
    this.buttons.classList.toggle('on', on && touch());
    if (!on) { this.marker.classList.remove('on'); this.warn.classList.remove('on'); }
  }

  update(s: GameState, clock: string, phase: string, most: number): void {
    if (this.time.textContent !== clock) this.time.textContent = clock;
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
    const ds = this.drops.children;
    for (let i = 0; i < 10; i++) ds[i]!.classList.toggle('e', i >= s.water);
    const w = String(s.white);
    if (this.tins.textContent !== w) this.tins.textContent = w;
    const hp = s.party.juno.hp, pct = `${Math.round((100 * hp) / most)}%`, txt = `${hp}/${most}`;
    if (this.hpBar.style.width !== pct) this.hpBar.style.width = pct;
    if (this.hpText.textContent !== txt) this.hpText.textContent = txt;
    this.hpBar.parentElement!.parentElement!.classList.toggle('low', hp <= most * 0.3);
    const key = s.conds.join(',');
    if (key !== this.condKey) {
      this.condKey = key;
      this.conds.innerHTML = '';
      for (const c of s.conds) el('span', `cond ${c}`, this.conds, CONDITIONS[c].name).title = CONDITIONS[c].what;
      this.glare.classList.toggle('on', s.conds.includes('blind'));
    }
    // the objective sits just under the status panel, however tall the conditions make it
    const below = this.status.offsetTop + this.status.offsetHeight + 8;
    if (below > 8 && below !== this.objTop) { this.objTop = below; this.obj.style.top = `${below}px`; }
  }

  objective(mission: string, text: string, flash: boolean): void {
    this.obj.firstElementChild!.textContent = mission;
    this.objText.textContent = text;
    this.obj.classList.toggle('on', text !== '' && this.status.classList.contains('on'));
    if (flash) { this.obj.classList.remove('flash'); void this.obj.offsetWidth; this.obj.classList.add('flash'); }
  }

  /** The side story being followed, under the night's objective (empty hides it). */
  side(text: string): void {
    if (this.objSide.textContent !== text) this.objSide.textContent = text;
    this.obj.classList.toggle('on', (this.objText.textContent !== '' || text !== '') && this.status.classList.contains('on'));
  }

  warning(text: string | null): void {
    this.warn.classList.toggle('on', !!text);
    if (text && this.warn.textContent !== text) this.warn.textContent = text;
  }

  toast(text: string, gold = false, ms = 2600): void {
    const t = el('div', gold ? 'toast gold' : 'toast', this.toasts, text);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }

  /** The marker at a screen point, pinned to the edge (and paler) when it's off screen; null hides it. */
  mark(p: { x: number; y: number; behind: boolean } | null): void {
    if (!p) { this.marker.classList.remove('on'); return; }
    const W = innerWidth, H = innerHeight, m = 28;
    let { x, y } = p;
    let edge = false;
    if (p.behind || x < m || x > W - m || y < m + 60 || y > H - m) {
      edge = true;
      const cx = W / 2, cy = H / 2;
      let dx = x - cx, dy = y - cy;
      if (p.behind) { dx = -dx; dy = -dy; }
      const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-3), (H / 2 - m - 30) / Math.abs(dy || 1e-3));
      x = cx + dx * k; y = cy + dy * k;
    }
    this.marker.classList.add('on');
    this.marker.classList.toggle('edge', edge);
    this.marker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ---------------------------------------------------------------- the staybook
  /** Show a page. A new page is shown alone; otherwise you can turn through every page you have. */
  openBook(pages: Record<string, Page>, have: string[], key: string, isNew: boolean): Promise<void> {
    const list = PAGE_ORDER.filter((k) => have.includes(k));
    let i = Math.max(0, list.indexOf(key));
    const b = this.book;
    b.replaceChildren();
    const page = el('div', 'page', b);
    const num = el('div', 'pnum', page);
    const hand = el('div', 'hand', page);
    const teach = el('div', 'teach', page);
    const nav = el('div', 'bnav', b);
    const prev = el('button', 'bk', nav, '‹');
    if (isNew) el('span', 'bnew', nav, 'New page');
    const close = el('button', 'bk close', nav, 'Close');
    const next = el('button', 'bk', nav, '›');
    const draw = (): void => {
      const k = list[i]!, p = pages[k]!;
      hand.className = `hand ${p.who}`;
      hand.textContent = p.text;
      teach.textContent = p.teach;
      num.textContent = k === 'last' ? 'last page' : k.startsWith('j') ? 'Juno' : `page ${k}`;
      prev.hidden = next.hidden = isNew || list.length < 2;
    };
    draw();
    const turn = (d: number): void => { i = (i + d + list.length) % list.length; draw(); this.sfx('page'); };
    prev.addEventListener('click', (e) => { e.stopPropagation(); turn(-1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); turn(1); });
    b.classList.add('on');
    return new Promise((res) => {
      const opened = performance.now();
      const done = (): void => { b.classList.remove('on'); this.bookClose = null; this.bookKey = null; this.sfx('close'); res(); };
      close.addEventListener('click', (e) => { e.stopPropagation(); done(); });
      this.bookClose = done;
      this.bookKey = (code) => {
        if (code === 'ArrowLeft' && !isNew) { turn(-1); return true; }
        if (code === 'ArrowRight' && !isNew) { turn(1); return true; }
        // a new page stays up a moment, so a held key doesn't skip it unread
        if (performance.now() - opened > 350 && ['Escape', 'KeyB', 'Tab', 'Enter', 'Space', 'KeyE', 'KeyZ', 'KeyQ', 'Backspace'].includes(code)) { done(); return true; }
        return true;
      };
    });
  }
  get bookOpen(): boolean { return this.bookClose !== null; }

  // ---------------------------------------------------------------- menus
  /** The title: first the name alone and "press any key" (`splash`), then the menu under it. */
  async titleScreen(canContinue: boolean, splash = false): Promise<'new' | 'continue' | 'options'> {
    this.title.classList.add('on');
    if (splash) {
      this.title.classList.add('splash');
      await new Promise<void>((r) => { this.pressed = r; });
      this.title.classList.remove('splash');
      this.sfx('open');
    }
    const a = await this.titleMenu.show([{ id: 'new', label: 'New game' }, { id: 'continue', label: 'Continue', hidden: !canContinue }, { id: 'options', label: 'Options' }]);
    if (a !== 'options') this.title.classList.remove('on');
    return a === 'continue' || a === 'options' ? a : 'new';
  }

  /** The options screen over whatever's showing; resolves when it's closed. */
  openOptions(s: Settings, apply: (s: Settings) => void, screen: ScreenControl): Promise<void> {
    this.sfx('open');
    return this.options.show(s, apply, screen);
  }

  async openPause(s: GameState, canLoad: boolean): Promise<string | null> {
    const side = this.pause.querySelector<HTMLElement>('.pause-side')!;
    side.replaceChildren();
    el('h3', '', side, 'Party');
    el('p', '', side, `Juno  ${s.party.juno.hp}/42  ·  ${s.party.juno.dur > 0 ? `Pipe ${s.party.juno.dur}/12` : 'Bent pipe'}`);
    if (s.joined.includes('kit')) el('p', '', side, `Kit  ${s.party.kit.hp}/26  ·  Sling`);
    el('h3', '', side, 'Carrying');
    for (const [k, n] of Object.entries(s.items)) if (n > 0) el('p', '', side, `${ITEM_NAMES[k] ?? k}${n > 1 ? ` ×${n}` : ''}`);
    el('p', '', side, `Water ${s.water}/10  ·  White ${s.white} ${s.white === 1 ? 'tin' : 'tins'}`);
    this.pause.classList.add('on');
    this.sfx('open');
    const a = await this.pauseMenu.show([
      { id: 'resume', label: 'Resume' },
      { id: 'book', label: 'Staybook', hidden: s.pages.length === 0 },
      { id: 'save', label: 'Save' },
      { id: 'load', label: 'Load last save', hidden: !canLoad },
      { id: 'options', label: 'Options' },
      { id: 'title', label: 'Quit to title' },
    ], true);
    this.pause.classList.remove('on');
    return a;
  }

  async endCard(title: string, sub: string): Promise<'read' | 'explore' | 'title'> {
    this.card.querySelector('h2')!.textContent = title;
    this.card.querySelector('p')!.textContent = sub;
    this.card.classList.add('on');
    const a = await this.cardMenu.show([{ id: 'read', label: 'Read the last page' }, { id: 'explore', label: 'Keep exploring' }, { id: 'title', label: 'Title screen' }]);
    if (a !== 'read') this.card.classList.remove('on');
    return (a ?? 'explore') as 'read' | 'explore' | 'title';
  }
  hideCard(): void { this.card.classList.remove('on'); }

  // ---------------------------------------------------------------- the tale's cards
  /** A chapter card over black: lines in, a hold, then out. `stayBlack` leaves the screen black behind it. */
  async chapter(html: string, ms: number, abort: () => boolean): Promise<void> {
    const c = this.chapterEl;
    c.innerHTML = html;
    c.classList.remove('out');
    c.classList.add('on');
    void c.offsetWidth;
    c.classList.add('in');
    for (let t = 0; t < ms && !abort(); t += 100) await sleep(100);
    c.classList.add('out');
    await sleep(abort() ? 200 : 900);
    c.classList.remove('in', 'out', 'on');
  }
}
