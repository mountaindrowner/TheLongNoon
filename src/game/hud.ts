import type { GameState } from './state';
import { ITEM_NAMES } from './state';

/**
 * The story's screen furniture, ported from the first version (legacy/poc2
 * 13-staybook, 14-quests-hud, 19-intro-cinematic, 21-menus) into the
 * rebuild's interface style (spec §15: dark glass, a thin gold rule):
 * - the status panel: the clock, ten drops of water, the tins of white;
 * - the objective under it, and a marker over the target;
 * - toasts and the daylight warning;
 * - the staybook's pages;
 * - the title, the pause menu and the end card;
 * - the chapter cards and the skip button for the tale.
 */

export interface Page { who: 'dad' | 'mom'; text: string; teach: string }
export const PAGE_ORDER = ['1', '2', '3', '5', 'last'];

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

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly time: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly drops: HTMLDivElement;
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
    this.obj = el('div', 'objective', this.root);
    el('div', 'obj-mission', this.obj);
    this.objText = el('div', 'obj-text', this.obj);
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
    const tm = el('div', 'ts-inner', this.title);
    el('h1', '', tm, 'The Long Noon');
    el('p', 'ts-tag', tm, 'Never walk in white.');
    const sfx = (n: string): void => this.sfx(n);
    this.titleMenu = new Menu(tm, 'ts-menu', sfx);
    el('p', 'ts-foot', this.title, touch() ? 'Drag on the left to walk. Tap A to talk.' : 'WASD or arrows to walk · E to talk · B the staybook · M the map · Esc the menu');
    this.pauseMenu = new Menu(this.pause, 'pause-menu', sfx);
    el('div', 'pause-side', this.pause);
    el('h2', '', this.card, 'Mission: Lamp');
    el('p', '', this.card, 'First mission complete.');
    this.cardMenu = new Menu(this.card, 'card-menu', sfx);
    this.menus.push(this.titleMenu, this.pauseMenu, this.cardMenu);
    this.show(false);
  }

  /** Whether any menu or the book is up (the world waits). */
  get modal(): boolean { return this.menus.some((m) => m.open) || this.bookClose !== null; }

  /** Keys for whatever's open. True when it was used. */
  key(code: string): boolean {
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

  update(s: GameState, clock: string, phase: string): void {
    if (this.time.textContent !== clock) this.time.textContent = clock;
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
    const ds = this.drops.children;
    for (let i = 0; i < 10; i++) ds[i]!.classList.toggle('e', i >= s.water);
    const w = String(s.white);
    if (this.tins.textContent !== w) this.tins.textContent = w;
  }

  objective(mission: string, text: string, flash: boolean): void {
    this.obj.firstElementChild!.textContent = `Mission: ${mission}`;
    this.objText.textContent = text;
    this.obj.classList.toggle('on', text !== '' && this.status.classList.contains('on'));
    if (flash) { this.obj.classList.remove('flash'); void this.obj.offsetWidth; this.obj.classList.add('flash'); }
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
      num.textContent = k === 'last' ? 'last page' : `page ${k}`;
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
  async titleScreen(canContinue: boolean): Promise<'new' | 'continue'> {
    this.title.classList.add('on');
    const a = await this.titleMenu.show([{ id: 'new', label: 'New game' }, { id: 'continue', label: 'Continue', hidden: !canContinue }]);
    this.title.classList.remove('on');
    return a === 'continue' ? 'continue' : 'new';
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
      { id: 'title', label: 'Quit to title' },
    ], true);
    this.pause.classList.remove('on');
    return a;
  }

  async endCard(): Promise<'read' | 'explore' | 'title'> {
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
