import type { GameState } from './state';
import type { Cmd, Dialogue, Script } from './script';

/**
 * The prologue on paper (docs/design/prologue.md, data/quests.json). Conditions, steps and nights live here, and
 * so does a reading of the scripts that does what they say to the state (items, flags, steps, nights) without a
 * screen. The game reads conditions through this; `?step=` catches up with it; and the prologue checker walks
 * every night with it to prove each step can be done and leads to the next (the owner, 2026-10-29: "make sure
 * the progression is possible").
 */

export interface Via {
  /** Who or what Juno talks to or uses: a person's id, a scripted thing, a scripted spot she walks into. */
  npc?: string; thing?: string; zone?: string;
  /** Where: a room, or a map of a region; outdoors anywhere if neither. */
  room?: string; piece?: string;
  /** Done by the game itself rather than a talk: the burial, the drain, arriving somewhere. */
  code?: string; script?: string;
  /** An edge road the step turns into a script. */
  exit?: string;
  /** In the white (people out by day are only the ones who stay out). */
  day?: boolean;
}
export interface StepDef {
  night: number;
  obj: string;
  marker?: unknown;
  tasks?: Record<string, string>;
  then?: string;
  arrive?: { at: string; then?: string; script?: string };
  faint?: { flag: string; script: string; night: number };
  exit?: Record<string, string>;
  via?: Via[];
}
export interface NightDef { title: string; name: string; first: string; wake?: string; dawn?: string; at?: string }
export interface Quests { mission: string; nights: Record<string, NightDef>; steps: Record<string, StepDef> }

/** The night a step belongs to (0 past the prologue). */
export const nightOf = (q: Quests, step: string): number => q.steps[step]?.night ?? 0;

/**
 * A dialogue condition: `a&b&!c`, alternatives with `|`. A token is a step's name, `night:N`, `has:item`,
 * `white:N` (at least N tins), or a flag.
 */
export function cond(q: Quests, s: GameState, key: string): boolean {
  return key.split('|').some((alt) => alt.split('&').every((tok) => {
    if (tok.startsWith('!')) return !cond(q, s, tok.slice(1));
    if (tok in q.steps) return s.step === tok;
    if (tok.startsWith('night:')) return nightOf(q, s.step) === Number(tok.slice(6));
    if (tok.startsWith('has:')) return (s.items[tok.slice(4)] ?? 0) > 0;
    if (tok.startsWith('white:')) return s.white >= Number(tok.slice(6));
    return !!s.flags[tok];
  }));
}
/** Every token a condition reads (for the checker). */
export const tokens = (key: string): string[] => key.split(/[|&]/).map((t) => t.replace(/^!/, ''));

/** The script an id resolves to in state `s`, and the key that chose it. */
export function resolve(q: Quests, dlg: Dialogue, s: GameState, id: string): { script: Script; key: string } | null {
  const d = dlg[id];
  if (!d) return null;
  if (Array.isArray(d)) return { script: d, key: '' };
  for (const k of Object.keys(d)) if (k !== '*' && cond(q, s, k)) return { script: d[k]!, key: k };
  return d['*'] ? { script: d['*'], key: '*' } : null;
}

/** The step's objective, with what's left of its tasks. */
export function objective(q: Quests, s: GameState): string {
  const st = q.steps[s.step];
  if (!st) return '';
  const left = Object.entries(st.tasks ?? {}).filter(([f]) => !s.flags[f]).map(([, t]) => t);
  return left.length ? `${st.obj}: ${left.join(' · ')}` : st.obj;
}
/** A step's tasks are all done: the step it hands on to. */
export function tasksDone(q: Quests, s: GameState): string | null {
  const st = q.steps[s.step];
  return st?.tasks && st.then && Object.keys(st.tasks).every((f) => s.flags[f]) ? st.then : null;
}

// ---------------------------------------------------------------- the scripts, read without a screen

/** What a paper run needs to know beyond the data: the names the game knows. */
export interface Catalog {
  items: Record<string, string>;
  pages: Record<string, unknown>;
  stories: Record<string, unknown>;
  fights: Record<string, unknown>;
  /** Worlds you can `go` to, with their spawn names (rooms and regions). */
  worlds: Record<string, string[]>;
}
/** Commands the game understands (main.ts `command`, plus the director's own `choice`). */
export const COMMANDS = ['wait', 'item', 'take', 'white', 'water', 'page', 'step', 'flag', 'checkHome', 'hint', 'rest', 'cam', 'tale', 'sfx', 'ending',
  'spawnEnemies', 'battle', 'join', 'salvage', 'lookUp', 'waitDrone', 'story', 'buy', 'run', 'go', 'bell', 'nightEnd', 'clock', 'fight', 'strays',
  'noonBell', 'prologueEnd', 'choice'];

export interface Paper {
  s: GameState;
  /** What happened, in order, for the report. */
  log: string[];
  problems: string[];
  /** Choices: which option to take each time one comes up (default: the first). */
  pick?: (q: string, opts: string[]) => number;
  /** Seen in the run: worlds gone to, fights fought. */
  went: string[];
}

/** The state a night starts in: Lamp at home (night seven wakes at noon), the step its first, its wake script run. */
export function startNight(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper, n: number): void {
  const N = q.nights[String(n)];
  if (!N) { p.s.step = 'free'; p.log.push('the prologue is over: free'); return; }
  p.s.day++;
  p.s.flags.night = n;
  p.s.step = N.first;
  p.s.clock = N.at ? hhmm(N.at) : 18 * 60 + 30;
  p.log.push(`night ${n} (${N.title}: ${N.name}) starts at ${N.first}`);
  if (N.wake) runScript(q, dlg, cat, p, N.wake);
}
const hhmm = (t: string): number => { const [h, m] = t.split(':').map(Number); return h! * 60 + m!; };

/** End the night Juno sleeps on (the cot, the drain night's ending): the next one begins. */
export function endNight(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper): void {
  const n = nightOf(q, p.s.step);
  if (q.nights[String(n)]?.dawn === 'drone') { p.s.flags.drone_down = true; p.log.push('day five: the drone comes down in the White Bowl'); }
  startNight(q, dlg, cat, p, n + 1);
}

/** Run a script by id on paper. */
export function runScript(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper, id: string): boolean {
  const r = resolve(q, dlg, p.s, id);
  if (!r) { p.problems.push(`${p.s.step}: "${id}" has nothing to say`); return false; }
  p.log.push(`  ${id}${r.key ? ` [${r.key}]` : ''}`);
  run(q, dlg, cat, p, r.script, id);
  return true;
}

function run(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper, script: Script, where: string): void {
  for (const l of script) {
    if (Array.isArray(l)) continue;
    command(q, dlg, cat, p, l, where);
  }
}

function command(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper, c: Cmd, where: string): void {
  const s = p.s, bad = (m: string): void => { p.problems.push(`${where}: ${m}`); };
  const itemOk = (id: unknown): string => { const i = String(id); if (!(i in cat.items)) bad(`unknown item "${i}"`); return i; };
  switch (c.do) {
    case 'item': { const i = itemOk(c.id); s.items[i] = (s.items[i] ?? 0) + Number(c.n ?? 1); break; }
    case 'take': {
      const i = itemOk(c.id), n = Number(c.n ?? 1);
      if ((s.items[i] ?? 0) < n) bad(`takes ${n} ${i} but Juno has ${s.items[i] ?? 0}`);
      s.items[i] = Math.max(0, (s.items[i] ?? 0) - n);
      break;
    }
    case 'white': s.white += Number(c.add); break;
    case 'water': s.water = c.set != null ? Number(c.set) : Math.min(10, s.water + Number(c.add)); break;
    case 'buy': {
      const n = Number(c.white), i = itemOk(c.item);
      if (s.white < n) { bad(`buys ${i} for ${n} white but Juno has ${s.white}`); break; }
      s.white -= n; s.items[i] = (s.items[i] ?? 0) + 1;
      if (c.flag) s.flags[String(c.flag)] = true;
      break;
    }
    case 'page': if (!(String(c.n) in cat.pages)) bad(`no page "${c.n}"`); else if (!s.pages.includes(String(c.n))) s.pages.push(String(c.n)); break;
    case 'step': if (!(String(c.to) in q.steps)) bad(`no step "${c.to}"`); else { s.step = String(c.to); p.log.push(`  → ${s.step}`); } break;
    case 'flag': s.flags[String(c.f)] = true; break;
    case 'story': if (!(String(c.id) in cat.stories)) bad(`no story "${c.id}"`); else s.flags[`q_${c.id}`] = true; break;
    case 'run': if (!(String(c.id) in dlg)) bad(`runs "${c.id}", which doesn't exist`); else runScript(q, dlg, cat, p, String(c.id)); break;
    case 'go': {
      const to = String(c.to), sp = String(c.spawn);
      if (!(to in cat.worlds)) bad(`goes to "${to}", which isn't a place`);
      else if (cat.worlds[to]!.length && !cat.worlds[to]!.includes(sp)) bad(`goes to ${to}:${sp}, which has no such spawn`);
      p.went.push(to);
      break;
    }
    case 'fight': case 'battle': case 'spawnEnemies': {
      if (!(String(c.id) in cat.fights)) bad(`fights "${c.id}", which isn't a fight`);
      if (c.do === 'battle') { s.flags.drainDone = true; runScript(q, dlg, cat, p, 'drainWin'); }
      if (c.do === 'fight') { p.log.push(`  fight: ${c.id}`); if (c.win) runScript(q, dlg, cat, p, String(c.win)); }
      if (c.do === 'spawnEnemies') s.flags.drainStarted = true;
      break;
    }
    case 'join': if (!s.joined.includes(String(c.who))) s.joined.push(String(c.who)); break;
    case 'salvage': for (const [k, n] of [['scrap', 4], ['cell', 1], ['bearings', 6]] as const) s.items[k] = (s.items[k] ?? 0) + n; break;
    case 'checkHome': if (s.flags.fed && s.flags.tank) runScript(q, dlg, cat, p, 'homeDone'); break;
    case 'clock': s.clock = hhmm(String(c.at)); break;
    case 'ending': case 'nightEnd': endNight(q, dlg, cat, p); break;
    case 'prologueEnd': s.step = 'free'; p.log.push('  → the prologue ends'); break;
    case 'choice': {
      const opts = c.opts as Array<[string, Script]>;
      const i = p.pick ? p.pick(String(c.q), opts.map((o) => o[0])) : 0;
      run(q, dlg, cat, p, opts[i]![1], where);
      break;
    }
    default: if (!COMMANDS.includes(c.do)) bad(`unknown command "${c.do}"`);
  }
  const then = tasksDone(q, s);
  if (then) { s.step = then; p.log.push(`  → ${then} (every task done)`); }
}

/** Walk the steps from where the state is to `until` (or the prologue's end), the way the data says each is done.
 *  `faintAt`: steps where Juno is taken by the white instead (the branches). The world isn't consulted: `place`
 *  is asked about each person and thing the step needs, and says what's wrong with reaching it, if anything. */
export function walk(q: Quests, dlg: Dialogue, cat: Catalog, p: Paper, opts: { until?: string; faintAt?: string[]; place?: (v: Via, s: GameState) => string | null } = {}): void {
  const seen = new Set<string>();
  for (let guard = 0; guard < 200; guard++) {
    const id = p.s.step, st = q.steps[id];
    if (id === opts.until || id === 'free' || !st) return;
    if (seen.has(id)) { p.problems.push(`${id}: the walk came back to this step (a loop)`); return; }
    seen.add(id);
    p.log.push(`${id}: ${objective(q, p.s)}`);
    if (opts.faintAt?.includes(id)) {
      if (!st.faint) { p.problems.push(`${id}: no faint branch`); return; }
      p.log.push(`  (the white takes her)`);
      p.s.flags[st.faint.flag] = true;
      runScript(q, dlg, cat, p, st.faint.script);
      startNight(q, dlg, cat, p, st.faint.night);
      continue;
    }
    if (!st.via?.length) { p.problems.push(`${id}: no way through is written (via)`); return; }
    for (const v of st.via) {
      if (p.s.step !== id) break;
      const issue = opts.place?.(v, p.s);
      if (issue) p.problems.push(`${id}: ${issue}`);
      if (v.npc || v.thing || v.zone) runScript(q, dlg, cat, p, v.npc ?? v.thing ?? v.zone!);
      else if (v.code === 'burial') runScript(q, dlg, cat, p, v.script ?? 'burial');
      else if (v.code === 'drainZone') runScript(q, dlg, cat, p, v.script ?? 'drainIntro');
      else if (v.code === 'arrive') {
        const a = st.arrive;
        if (!a) p.problems.push(`${id}: arrives, but the step has no arrive`);
        else if (a.script) runScript(q, dlg, cat, p, a.script);
        else if (a.then) { p.s.step = a.then; p.log.push(`  → ${a.then} (arrived at ${a.at})`); }
      } else if (v.exit) {
        const sc = st.exit?.[v.exit];
        if (!sc) p.problems.push(`${id}: the road ${v.exit} has no script at this step`); else runScript(q, dlg, cat, p, sc);
      } else p.problems.push(`${id}: can't read this way through: ${JSON.stringify(v)}`);
    }
    if (p.s.step === id) { p.problems.push(`${id}: done the way the data says, but it never moves on`); return; }
  }
  p.problems.push('the walk went on for 200 steps');
}

/**
 * Every script, not just the ones the walk passes through: commands the game knows, targets that exist (scripts,
 * pages, stories, steps, places, fights, items), and every flag a condition reads set somewhere (a typo in a
 * condition is a door that never opens). `codeFlags` are the flags the game itself sets.
 */
export function lint(q: Quests, dlg: Dialogue, cat: Catalog, codeFlags: string[]): string[] {
  const out: string[] = [];
  const set = new Set<string>(codeFlags), read: Array<[string, string]> = [];
  const keysOf = (id: string): string[] => { const d = dlg[id]; return d && !Array.isArray(d) ? Object.keys(d).filter((k) => k !== '*') : []; };
  const visit = (script: Script, where: string): void => {
    for (const l of script) {
      if (Array.isArray(l)) { if (typeof l[0] !== 'string' || typeof l[1] !== 'string') out.push(`${where}: a line that isn't [speaker, text]`); continue; }
      const c = l;
      if (!COMMANDS.includes(c.do)) out.push(`${where}: unknown command "${c.do}"`);
      if (c.do === 'flag') set.add(String(c.f));
      if (c.do === 'buy' && c.flag) set.add(String(c.flag));
      if (c.do === 'story') set.add(`q_${c.id}`);
      if (c.do === 'run' && !(String(c.id) in dlg)) out.push(`${where}: runs "${c.id}", which doesn't exist`);
      if (c.do === 'page' && !(String(c.n) in cat.pages)) out.push(`${where}: no page "${c.n}"`);
      if (c.do === 'story' && !(String(c.id) in cat.stories)) out.push(`${where}: no story "${c.id}"`);
      if (c.do === 'step' && !(String(c.to) in q.steps)) out.push(`${where}: no step "${c.to}"`);
      if ((c.do === 'item' || c.do === 'take') && !(String(c.id) in cat.items)) out.push(`${where}: unknown item "${c.id}"`);
      if (c.do === 'buy' && !(String(c.item) in cat.items)) out.push(`${where}: unknown item "${c.item}"`);
      if ((c.do === 'fight' || c.do === 'battle') && !(String(c.id) in cat.fights)) out.push(`${where}: no fight "${c.id}"`);
      if (c.do === 'fight' && c.win && !(String(c.win) in dlg)) out.push(`${where}: wins into "${c.win}", which doesn't exist`);
      if (c.do === 'go' && !(String(c.to) in cat.worlds)) out.push(`${where}: goes to "${c.to}", which isn't a place`);
      if (c.do === 'choice') for (const [label, sub] of c.opts as Array<[string, Script]>) visit(sub, `${where} / "${label}"`);
    }
  };
  for (const [id, d] of Object.entries(dlg)) {
    if (Array.isArray(d)) visit(d, id);
    else for (const [k, sc] of Object.entries(d)) { visit(sc, `${id} [${k}]`); if (k !== '*') read.push([`${id} [${k}]`, k]); }
  }
  for (const [id, st] of Object.entries(q.steps)) {
    for (const f of Object.keys(st.tasks ?? {})) read.push([`${id} tasks`, f]);
    if (st.then && !(st.then in q.steps)) out.push(`${id}: hands on to "${st.then}", which isn't a step`);
    if (st.arrive?.then && !(st.arrive.then in q.steps)) out.push(`${id}: arrives into "${st.arrive.then}", which isn't a step`);
    if (st.arrive?.script && !(st.arrive.script in dlg)) out.push(`${id}: arrives into "${st.arrive.script}", which doesn't exist`);
    if (st.faint && !(st.faint.script in dlg)) out.push(`${id}: faints into "${st.faint.script}", which doesn't exist`);
    if (st.faint) set.add(st.faint.flag);
    for (const sc of Object.values(st.exit ?? {})) if (!(sc in dlg)) out.push(`${id}: its road runs "${sc}", which doesn't exist`);
    if (st.marker && typeof st.marker === 'object' && !Array.isArray(st.marker)) for (const k of Object.keys(st.marker)) if (k !== '*') read.push([`${id} marker`, k]);
  }
  for (const [n, N] of Object.entries(q.nights)) {
    if (!(N.first in q.steps)) out.push(`night ${n}: starts at "${N.first}", which isn't a step`);
    if (N.wake && !(N.wake in dlg)) out.push(`night ${n}: wakes into "${N.wake}", which doesn't exist`);
  }
  for (const [id, st] of Object.entries(cat.stories)) {
    const stages = (st as { stages?: Array<{ when: string }> }).stages ?? [];
    for (const g of stages) read.push([`story ${id}`, g.when]);
  }
  for (const [where, key] of read) for (const t of tokens(key)) {
    if (t in q.steps || t.startsWith('night:') || t.startsWith('white:')) continue;
    if (t.startsWith('has:')) { if (!(t.slice(4) in cat.items)) out.push(`${where}: has:${t.slice(4)} isn't an item`); continue; }
    if (!set.has(t)) out.push(`${where}: reads flag "${t}", which nothing ever sets`);
  }
  return out;
}
