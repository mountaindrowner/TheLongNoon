import * as THREE from 'three';
import './styles/fonts.css';
import './styles/ui.css';
import { createPost } from './engine/post';
import { applyMood, moodPost, moodAt, type Lights, type Mood } from './engine/mood';
import { beginArea } from './engine/world';
import { checkDoors, clearDoorMarks } from './engine/doorway';
import { buildRegion, type Region } from './engine/region';
import { UI } from './engine/ui';
import { Minimap, type MapMark } from './engine/minimap';
import type { Area, NPC, Spot, Thing } from './engine/area';
import { Actor, variant } from './game/actors';
import { Clock, fmtTime, parseClock } from './game/clock';
import { Director, type Cmd, type Dialogue, type Script, type Stage } from './game/script';
import { Hud, PAGE_ORDER, type Page } from './game/hud';
import { Tale } from './game/tale';
import { campfire } from './game/fire';
import { Sound } from './game/sound';
import { Fight, type FightDef, type UnitDef } from './game/battle';
import BATTLES from './game/data/battles.json';
import { newState, save as writeSave, load as readSave, hasSave, ITEM_NAMES, type GameState } from './game/state';
import { SUN, CONDITIONS, has, afflict, maxHp, sleepOff, type Condition } from './game/sun';
import { shadedFromSun, last as shadeLast } from './engine/shade';
import DIALOGUE from './game/data/dialogue.json';
import QUESTS from './game/data/quests.json';
import PAGES from './game/data/pages.json';
import STORIES from './game/data/stories.json';
import { cond as condOf, objective, tasksDone, nightOf, walk, lint, type Quests, type Catalog, type Paper } from './game/progress';
import { SKY } from './regions/span/moods';
import { fadeOccluders, swaySpan } from './regions/span/props';
import { SPAN, HILL, TRAIL, START, REGIONS, gateTo, regionOf, regionAt, spanRegion, spanRooms, UNBUILT } from './regions/span/region';

/**
 * The Long Noon, rebuilt on the world style spec (docs/style/world-style-spec.md)
 * and laid out by the world methodology (docs/design/world-methodology.md).
 * This file is the runtime: renderer and camera (spec §3), post (§4), the
 * mood (§5), walking, talking, doors, and moving between worlds: the open
 * region (sections walked between with no cut) and the rooms behind its lit
 * doors (a quick pixel dissolve, spec §9.4).
 */

// The clock runs from Lamp, as the story does (legacy newState: 7:20 pm). `?clock=HH:MM` starts it elsewhere;
// `?time=lamp|night|shutter|white|day` holds one light still, for screenshots and playtests.
const params = new URLSearchParams(location.search);
const HELD: Record<string, number> = { lamp: 19 * 60 + 20, night: 23 * 60 + 40, shutter: 5 * 60 + 10, white: 12 * 60 + 10, day: 17 * 60 + 30 };
const held = HELD[params.get('time') ?? ''];
const time = new Clock(held ?? parseClock(params.get('clock')) ?? 19 * 60 + 20, held !== undefined);
/** Whether the town is built with its lanterns lit (Lamp to Shutter) or not (the white). */
let night = time.lit;
const sky = (): Mood => moodAt(night ? SKY.lit : SKY.unlit, time.minute);

// ------------------------------------------------------------ renderer + camera (spec §3)
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const host = document.getElementById('app')!;
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 220);
const CAM_OFFSET = new THREE.Vector3(0, 12.5, 14.5); // ≈ 41° down, looking north (−z). The camera never rotates.
const camTarget = new THREE.Vector3();
const post = createPost(renderer, new THREE.Scene(), camera);
const ui = new UI(host);
const minimap = new Minimap(ui.root);
const hud = new Hud(ui.root);
const tale = new Tale(ui.root);
const sound = new Sound();
ui.onType = (name) => sound.voice(name);
hud.sfx = (n) => sound.play(n);
// browsers start sound only after a tap or a key
for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => sound.init(), { capture: true });

function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ input
const keys = new Set<string>();
let aQueued = false;
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  // whatever's open on top takes the key: the book, a menu, the skip of the tale, a choice
  if (!e.repeat && fight.key(e.code)) { e.preventDefault(); return; }
  if (!e.repeat && hud.key(e.code)) return;
  if (mode === 'cine' && !e.repeat && (e.code === 'Escape' || e.code === 'KeyQ')) { skipTale(); return; }
  if (e.code.startsWith('Arrow') && ui.nudge(e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1)) return;
  keys.add(e.code);
  if (e.repeat) return;
  if (['KeyE', 'Space', 'Enter', 'KeyZ'].includes(e.code)) aQueued = true;
  if (e.code === 'KeyM') minimap.toggle();
  if (free() && (e.code === 'Escape' || e.code === 'KeyQ' || e.code === 'Backspace')) void openPause();
  if (free() && (e.code === 'KeyB' || e.code === 'Tab')) void openBook();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function moveInput(): { x: number; z: number; run: boolean } {
  let x = 0, z = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z++;
  x += ui.stick.x; z += ui.stick.y;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { x, z, run: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(ui.stick.x, ui.stick.y) > 0.92 };
}

// ------------------------------------------------------------ worlds: the region, and each room
interface World {
  id: string;
  scene: THREE.Scene;
  area: Area;
  lights: Lights;
  people: Array<{ npc: NPC; actor: Actor; tag: string }>;
  roamers: Array<{ actor: Actor; kind: string; area: [number, number, number, number]; speed: number; tx: number | null; tz: number; wait: number; tag: string }>;
  tint: THREE.Color;
  issues: string[];
}
let ROOMS = spanRooms(night);
const worlds = new Map<string, World>();
let cur: World;
/** An outdoor region (the town, the hill, the mall), as against a room. */
const isOut = (w: World | undefined): boolean => !!w && w.id in REGIONS;
/** The outdoor region built now (one at a time). */
const outWorld = (): World | undefined => [...worlds.values()].find((w) => isOut(w));
const outRegion = (): Region | undefined => outWorld()?.area as Region | undefined;
let player: Actor;
let loaded = false;
let busy = false;

async function buildWorld(id: string, at?: Spot): Promise<World> {
  const scene = new THREE.Scene();
  let area: Area, issues: string[];
  if (id in REGIONS) {
    beginArea();
    const region = await buildRegion(scene, night, spanRegion(sky(), night, at, id));
    area = region;
    issues = region.doorIssues;
  } else {
    // a map half-built in the region shares the builders' state; let it finish first
    await outRegion()?.idle();
    clearDoorMarks();
    area = await ROOMS[id]!(scene, night);
    issues = checkDoors(area);
  }
  for (const issue of issues) console.warn('[door promise]', issue);
  const lights = applyMood(scene, renderer, post, area.mood);
  const tint = new THREE.Color().setRGB(...area.mood.sprite);
  const w: World = { id, scene, area, lights, people: [], roamers: [], tint, issues };
  if (id in REGIONS) {
    // the region streams: its people and animals come and go with their maps
    const region = area as Region;
    for (const b of region.pieces) await populate(w, b.npcs, b.roamers ?? [], b.id);
    region.onChange = (added, removed) => {
      if (removed) unpopulate(w, removed.id);
      if (added) { void populate(w, added.npcs, added.roamers, added.id); minimap.addPiece(added); remember(added.things, added.npcs); showWhen(added.group); if (added.id === 'church') showBell(); }
    };
    for (const b of region.pieces) remember(b.things, b.npcs);
    void minimap.setRegion(region, at ?? region.spawns.start!);
  } else await populate(w, area.npcs, area.roamers ?? [], id);
  worlds.set(id, w);
  return w;
}

async function populate(w: World, npcs: NPC[], roamers: NonNullable<Area['roamers']>, tag: string): Promise<void> {
  for (const npc of npcs) {
    // some people are only there for a beat of the story (NPC `when`)
    if (npc.when && (!S || !director.cond(npc.when))) continue;
    if (w.people.some((q) => q.npc === npc) || adding.has(npc)) continue;
    adding.add(npc);
    if (npc.id === 'kit' && S && (S.flags.drainStarted || S.joined.includes('kit'))) continue;
    // by day the town is shut: outdoors, only the lookouts stay out
    if (isOut(w) && !night && !npc.allDay) continue;
    const a = await Actor.person(npc.sprite, w.tint);
    a.place(npc.x, w.area.ground(npc.x, npc.z), npc.z);
    a.dir = npc.face ?? 'S';
    w.scene.add(a.root);
    w.people.push({ npc, actor: a, tag });
    adding.delete(npc);
  }
  // the animals are under the shade-cloth by day too (the bible: "let out only at night"); the machines own the day
  for (const r of isOut(w) && !night ? roamers.filter((q) => q.sprite === 'stray') : roamers) {
    const a = await Actor.critter(variant(r.sprite, r.x, r.z), w.tint, r.height);
    a.place(r.x, w.area.ground(r.x, r.z), r.z);
    w.scene.add(a.root);
    w.roamers.push({ actor: a, kind: r.sprite, area: r.area, speed: r.speed, tx: null, tz: 0, wait: Math.random() * 3, tag });
  }
}
const adding = new Set<NPC>();
/** The story moved on: people it needs now come out, people it doesn't go, props it names show or hide. */
function refreshPeople(): void {
  const w = cur;
  if (!w || !S) return;
  for (const p of [...w.people]) if (p.npc.when && !director.cond(p.npc.when)) { letGo(w.scene, p.actor); w.people.splice(w.people.indexOf(p), 1); }
  const add = (npcs: NPC[], tag: string): void => { const want = npcs.filter((n) => n.when && director.cond(n.when)); if (want.length) void populate(w, want, [], tag); };
  if (isOut(w)) for (const b of (w.area as Region).pieces) add(b.npcs, b.id);
  else add(w.area.npcs, w.id);
  showWhen(w.scene);
}
/** Props a map builds for a beat of the story carry `userData.when`: shown only while it holds. */
function showWhen(scene: THREE.Object3D): void {
  scene.traverse((o) => { if (typeof o.userData.when === 'string') o.visible = !!S && director.cond(o.userData.when); });
}
/** Take someone out of a scene for good, and free what their figure put on the GPU (their sheet stays shared). */
function letGo(scene: THREE.Object3D, a: Actor): void {
  scene.remove(a.root);
  a.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); const m = (o as THREE.Mesh).material; for (const x of Array.isArray(m) ? m : m ? [m] : []) x.dispose(); });
}
function unpopulate(w: World, tag: string): void {
  for (const p of w.people.filter((q) => q.tag === tag)) letGo(w.scene, p.actor);
  for (const r of w.roamers.filter((q) => q.tag === tag)) letGo(w.scene, r.actor);
  w.people = w.people.filter((q) => q.tag !== tag);
  w.roamers = w.roamers.filter((q) => q.tag !== tag);
}

function placeAt(s: Spot): void {
  player.place(s.x, cur.area.ground(s.x, s.z), s.z);
  if (s.face) player.face(s.face === 'W' ? -1 : s.face === 'E' ? 1 : 0, s.face === 'N' ? -1 : s.face === 'S' ? 1 : 0);
  camTarget.copy(clampCam(player.x, player.z));
  camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, camZoom);
  camera.lookAt(camTarget);
}

function enter(w: World, spawn: string | Spot): void {
  cur = w;
  post.setScene(w.scene, camera);
  moodPost(renderer, post, w.area.mood);
  w.scene.add(player.root);
  if (isOut(w)) relight(true);
  player.setTint(w.tint);
  placeAt(typeof spawn === 'string' ? w.area.spawns[spawn] ?? w.area.spawns.start! : spawn);
  bringCast(w);
}

// ------------------------------------------------------------ the clock moving the light
let lightAge = 0;
/** Outdoors, the light follows the clock: the mood, and the tint on every sprite. Rooms keep their own lamps. */
function relight(force = false): void {
  if (!isOut(cur) || (time.frozen && !force)) return;
  const m = sky();
  cur.lights.set(m);
  cur.tint.setRGB(...m.sprite);
  for (const p of cur.people) p.actor.setTint(cur.tint);
  for (const r of cur.roamers) r.actor.setTint(cur.tint);
  for (const a of castActors()) a.setTint(cur.tint);
  player.setTint(cur.tint);
}

/** Drop a built world and free what it put on the GPU. */
function dispose(w: World): void {
  w.scene.traverse((o) => {
    // a light's shadow map is a render target of its own
    (o as THREE.DirectionalLight).shadow?.map?.dispose();
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
      // its textures too (a material doesn't free them): the painted ground, signs, walls. A shared one (a kit's wood,
      // say) is only let go from the GPU; three uploads it again the next time something draws with it.
      for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    }
  });
}

/** Lamp and the white change the town itself (lanterns lit or not, doors, windows), so it is rebuilt in the other
 *  state behind a dissolve. Inside a room nothing shows; the town is rebuilt when you step back out. */
async function turnOfDay(lit: boolean): Promise<void> {
  busy = true;
  night = lit;
  ROOMS = spanRooms(night);
  const here = cur;
  const outdoors = isOut(here);
  if (outdoors) { ui.showPrompt(null); await ui.dissolve(true); }
  for (const w of [...worlds.values()]) if (w !== here) { dispose(w); worlds.delete(w.id); }
  if (outdoors) {
    worlds.delete(here.id);
    const at: Spot = { x: player.x, z: player.z };
    const w = await buildWorld(here.id, at);
    enter(w, at);
    dispose(here);
    await ui.dissolve(false);
    ui.nameTag(lit ? 'Lamp' : 'The white', lit ? 'The first lanterns are lit' : 'Shutters down');
  } else {
    // keep the room you're in until you leave it; it's rebuilt in the new state on the next visit
    worlds.delete(here.id);
    staleRoom = here;
  }
  busy = false;
}
let staleRoom: World | null = null;


/** Through a door or out of a room: a quick pixel dissolve, then a small name tag (spec §9.4). */
async function go(to: string, spawn: string | Spot): Promise<void> {
  busy = true;
  ui.showPrompt(null);
  await ui.dissolve(true);
  // one outdoor region at a time: going on to another, the one behind is let go (its rooms with it)
  const leaving = to in REGIONS ? outWorld() : undefined;
  const crossing = !!leaving && leaving.id !== to;
  if (crossing) for (const old of [...worlds.values()]) if (old !== cur) { dispose(old); worlds.delete(old.id); }
  if (crossing) worlds.delete(leaving!.id);
  const w = worlds.get(to) ?? (await buildWorld(to));
  if (to in REGIONS) await (typeof spawn === 'string' ? (w.area as Region).prepare(spawn) : (w.area as Region).settle(spawn.x, spawn.z));
  const from = cur;
  enter(w, spawn);
  refreshPeople();
  if (crossing && from !== w) dispose(from);
  if (staleRoom && staleRoom !== w) { dispose(staleRoom); staleRoom = null; }
  lastPiece = '';
  await ui.dissolve(false);
  if (!(to in REGIONS)) { ui.nameTag(w.area.title, w.area.sub); arrived(to); }
  else if (crossing) { const p = (w.area as Region).pieceAt(player.x, player.z); if (p) { ui.nameTag(p.title, p.sub); lastPiece = p.id; arrived(p.id); } }
  busy = false;
}

/** Reaching a map or a room the step is waiting for (`arrive` in data/quests.json). */
function arrived(at: string): void {
  const a = STEPS[S?.step]?.arrive;
  if (!a || a.at !== at || mode !== 'play') return;
  if (a.then) setStep(a.then);
  if (a.script) void run(a.script);
}
let lastPhase = '';
let lastPiece = '';
let shownMinute = -1;
function showClock(): void {
  const m = Math.floor(time.minute);
  if (m === shownMinute) return;
  shownMinute = m;
  // the time is shown in the status panel (game/hud.ts), redrawn each frame
}
async function load(): Promise<void> {
  player = await Actor.person('juno', new THREE.Color(1, 1, 1));
  const w = await buildWorld(SPAN);
  enter(w, 'start');
  showClock();
  lastPiece = (cur.area as Region).pieceAt(player.x, player.z)?.id ?? '';
  loaded = true;
  S = newState(where());
  refreshPeople();
  if (TEST) {
    // straight into the town, for playtests and screenshots: free roam, or the mission step asked for
    S.step = STEP ?? 'free';
    if (STEP) catchUp(STEP);
    refreshPeople();
    mode = 'play';
    hud.show(true);
    showObjective(false);
    if (STEP === 'burial') void burial();
    else if (HASH_FIGHT) void fightDemo();
    else if (HASH_DRONE) void droneDay();
    else { ui.titleCard('SEVEN FLAGS', 'A town that stayed'); void bringCast(cur); }
  } else void titleScreen();
}

function clampCam(x: number, z: number): THREE.Vector3 {
  if (camHold) return camHold.clone();
  const c = cur.area.cam;
  return new THREE.Vector3(THREE.MathUtils.clamp(x, c.x0, c.x1), 0.8, THREE.MathUtils.clamp(z, c.z0, c.z1));
}

// ------------------------------------------------------------ talking, looking, doors
type Target = { kind: 'npc'; p: World['people'][number] } | { kind: 'thing'; t: Thing };
function nearest(): Target | null {
  let best: Target | null = null, bd = Infinity;
  for (const p of cur.people) { const d = Math.hypot(p.actor.x - player.x, p.actor.z - player.z); if (d < 1.7 && d < bd) { bd = d; best = { kind: 'npc', p }; } }
  for (const t of cur.area.things) {
    if (t.when && !director.cond(t.when)) continue;
    const d = Math.hypot(t.x - player.x, t.z - player.z); if (d < (t.r ?? 1.6) && d < bd) { bd = d; best = { kind: 'thing', t };
    }
  }
  // Kit walks with Juno once he's joined, and can still be talked to
  if (kitActor && S.joined.includes('kit') && kitActor.root.parent === cur.scene) { const d = Math.hypot(kitActor.x - player.x, kitActor.z - player.z); if (d < 1.7 && d < bd) best = { kind: 'npc', p: { npc: KIT, actor: kitActor, tag: 'party' } }; }
  return best;
}

const KIT: NPC = { id: 'kit', name: 'Kit', sprite: 'kit', x: 0, z: 0 };
async function interact(tg: Target): Promise<void> {
  if (tg.kind === 'npc') {
    const { npc, actor } = tg.p;
    actor.face(player.x - actor.x, player.z - actor.z);
    player.face(actor.x - player.x, actor.z - player.z);
    const sc = director.resolve(npc.script ?? npc.id);
    if (sc) { await director.run(sc); actor.dir = npc.face ?? actor.dir; return; }
    ui.say({ name: npc.name, portrait: await actor.card(), lines: npc.lines ?? ['…'] }, () => { actor.dir = npc.face ?? actor.dir; });
    return;
  }
  const t = tg.t;
  player.face(t.x - player.x, t.z - player.z);
  // a thing with a script says what the story needs it to say now; a door with nothing to say just opens
  const sc = t.script ? director.resolve(t.script) : null;
  if (sc) { await director.run(sc); return; }
  if (t.go) { await go(t.go.to, t.go.spawn); return; }
  if (t.lines) ui.say({ lines: t.lines });
}

// ------------------------------------------------------------ exits
/** Someone holding a line across a way out (NPC `guard`), if (x, z) is on it. */
const onGuard = (n: NPC, x: number, z: number): boolean => !!n.guard && !(n.guard.unless && director.cond(n.guard.unless)) && x >= n.guard.x0 && x <= n.guard.x1 && z >= n.guard.z0 && z <= n.guard.z1;
function guardAt(x: number, z: number): boolean {
  const region = outRegion();
  return !!region && region.npcs.some((n) => onGuard(n, x, z));
}
/** Juno walking under the story's control (turned back at a guard's line), so the frame plays her walk. */
let walking = false;
/** Stepping onto a guard's line: they turn to her, say their piece, and she walks back the way she came. */
async function turnBack(p: World['people'][number]): Promise<void> {
  const g = p.npc.guard!;
  busy = true;
  player.moving = false;
  p.actor.face(player.x - p.actor.x, player.z - p.actor.z);
  player.face(p.actor.x - player.x, p.actor.z - player.z);
  const seen = S.flags[`turned:${p.npc.id}`];
  S.flags[`turned:${p.npc.id}`] = true;
  const portrait = await p.actor.card();
  for (const line of seen && g.again ? g.again : g.lines) await ui.speak(p.npc.name, line, portrait);
  ui.endTalk();
  const [sx, sz] = [player.x, player.z], [bx, bz] = g.back, ms = (Math.hypot(bx - sx, bz - sz) / SPEED) * 1000;
  walking = true;
  player.face(bx - sx, bz - sz);
  await new Promise<void>((res) => {
    const t0 = performance.now();
    const f = (): void => { const k = Math.min(1, (performance.now() - t0) / ms), x = sx + (bx - sx) * k, z = sz + (bz - sz) * k; player.place(x, cur.area.ground(x, z), z); if (k < 1) requestAnimationFrame(f); else res(); };
    f();
  });
  walking = false;
  safe = [bx, bz];
  p.actor.dir = p.npc.face ?? p.actor.dir;
  busy = false;
}
let safe: [number, number] = [0, 0];
async function checkTriggers(): Promise<void> {
  const held = cur.people.find((p) => onGuard(p.npc, player.x, player.z));
  if (held) { await turnBack(held); return; }
  for (const tr of cur.area.triggers) {
    if (player.x < tr.x0 || player.x > tr.x1 || player.z < tr.z0 || player.z > tr.z1) continue;
    if (tr.when && !director.cond(tr.when)) continue;
    // a spot that starts a beat of the story (the dogs in the Big Store)
    if (tr.script && !tr.go) { player.moving = false; await run(tr.script); return; }
    if (!tr.go) continue;
    if (tr.go.to in REGIONS || ROOMS[tr.go.to]) { await go(tr.go.to, tr.go.spawn); return; }
    // a road on to a map of another region: the transition (the hill, the mall)
    const other = regionOf(tr.go.to);
    if (other) { await go(other, `${tr.go.to}:${tr.go.spawn}`); return; }
    // a road the story takes tonight (up the Thirty-Five, at the end)
    const leave = STEPS[S.step]?.exit?.[tr.go.to];
    if (leave) { player.moving = false; await run(leave); return; }
    // a road on to a piece not built yet: turn back at the edge rather than promise what isn't there
    busy = true;
    await ui.dissolve(true);
    const c = clampCam(safe[0], safe[1]);
    const dx = c.x - safe[0], dz = c.z - safe[1], l = Math.hypot(dx, dz) || 1;
    player.place(safe[0] + (dx / l) * 1.5, cur.area.ground(safe[0], safe[1]), safe[1] + (dz / l) * 1.5);
    camTarget.copy(clampCam(player.x, player.z));
    await ui.dissolve(false);
    ui.hint(UNBUILT[tr.go.to] ?? 'The road goes on. Not yet.');
    busy = false;
    return;
  }
}
const inTrigger = (x: number, z: number): boolean => cur.area.triggers.some((tr) => x >= tr.x0 && x <= tr.x1 && z >= tr.z0 && z <= tr.z1);

// ------------------------------------------------------------ frame
const clock = new THREE.Clock();
const SPEED = 3.1, RUN = 5.0;
let focusY = 0.46;
const v = new THREE.Vector3();
/** `?perf` (or `#perf`, which a shared or itch.io page passes on): a corner readout of what each frame costs (for testing on real phones): frames a second, draw calls and
 *  triangles per frame (shadows and post included), what's on the GPU, the JS heap, and the last map built. */
const PERF = params.has('perf') || location.hash === '#perf' ? Object.assign(document.createElement('div'), { className: 'perf' }) : null;
if (PERF) {
  Object.assign(PERF.style, { position: 'fixed', left: '4px', bottom: '4px', zIndex: '99', font: '11px monospace', color: '#cfe', background: 'rgba(0,0,0,.6)', padding: '3px 6px', pointerEvents: 'none', whiteSpace: 'pre' });
  document.body.appendChild(PERF);
  renderer.info.autoReset = false;
}
let perfAge = 0, perfFrames = 0, perfCalls = 0, perfTris = 0, perfLast = performance.now();
function perfTick(): void {
  if (!PERF) return;
  const now = performance.now();
  perfFrames++; perfAge += (now - perfLast) / 1000; perfLast = now; perfCalls = renderer.info.render.calls; perfTris = renderer.info.render.triangles;
  renderer.info.reset();
  if (perfAge < 0.5) return;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory, ms = isOut(cur) ? (cur.area as Region).buildMs : {};
  const last = Object.entries(ms).pop();
  PERF.textContent = `${(perfFrames / perfAge).toFixed(0)} fps  ${perfCalls} calls  ${(perfTris / 1000).toFixed(0)}k tris\n${renderer.info.memory.geometries} geo  ${renderer.info.memory.textures} tex${mem ? `  ${Math.round(mem.usedJSHeapSize / 1e6)} MB` : ''}${last ? `\nbuilt ${last[0]} in ${(last[1] / 1000).toFixed(1)} s` : ''}`;
  perfAge = 0; perfFrames = 0;
}
function frame(): void {
  requestAnimationFrame(frame);
  perfTick();
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (!loaded) return;
  const area = cur.area;

  // the clock: stopped while people talk, in menus, or while the screen is changing (legacy: it only runs while exploring)
  if (free()) {
    const before = time.day;
    time.tick(dt);
    if (time.day !== before) S.day++;
    showClock();
    if (time.lit !== night) void turnOfDay(time.lit);
    else if ((lightAge += dt) > 0.2) { lightAge = 0; relight(); }
    weather(dt);
    if (S.step === 'pancha' && !S.flags.drainStarted && cur.id === SPAN && player.x > DRAIN_ZONE[0] && player.x < DRAIN_ZONE[2] && player.z > DRAIN_ZONE[1] && player.z < DRAIN_ZONE[3]) {
      S.flags.drainStarted = true;
      player.moving = false;
      void run('drainIntro');
    }
  }
  if (lookUp > 0) skyward();
  tale.draw(dt);
  for (const c of cine) c.animate(dt);
  fire?.update(t);
  hud.update(S, fmtTime(time.minute), time.phase, maxHp(S));
  const ph = `ph-${time.phase === 'Long night' ? 'night' : time.phase.toLowerCase()}`;
  if (!document.body.classList.contains(ph)) { document.body.classList.remove('ph-lamp', 'ph-night', 'ph-shutter', 'ph-day'); document.body.classList.add(ph); }

  const a = aQueued || ui.takeA();
  aQueued = false;
  if (ui.talking) { if (a) ui.advance(); }
  else if (free()) {
    const m = moveInput();
    const l = Math.hypot(m.x, m.z);
    player.moving = l > 0.12;
    if (player.moving) {
      const sick = has(S, 'heat');
      if (sick) m.run = false;
      const sp = (m.run ? RUN : SPEED) * (sick ? 0.8 : 1) * Math.min(1, l);
      const nx = player.x + m.x * sp * dt, nz = player.z + m.z * sp * dt;
      const px = area.blocked(nx, player.z, 0.28) ? player.x : nx;
      const pz = area.blocked(px, nz, 0.28) ? player.z : nz;
      player.face(m.x, m.z);
      player.running = m.run;
      player.place(px, area.ground(px, pz), pz);
      trailPush();
      if ((stepAge += dt * (m.run ? 1.6 : 1)) > 0.29) { stepAge = 0; footstep(); }
      if (!inTrigger(px, pz)) safe = [px, pz];
      void checkTriggers();
    }
    player.animate(dt, m.run ? 1.6 : 1);
    const tg = nearest();
    if (tg) {
      const tx = tg.kind === 'npc' ? tg.p.actor.x : tg.t.x, tz = tg.kind === 'npc' ? tg.p.actor.z : tg.t.z;
      v.set(tx, area.ground(tx, tz) + 2.2, tz).project(camera);
      ui.showPrompt(tg.kind === 'npc' ? `Talk to ${tg.p.npc.name}` : tg.t.label, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
      if (a) { ui.showPrompt(null); void interact(tg); }
    } else ui.showPrompt(null);
  } else { player.moving = walking; player.animate(dt); }

  // crossing from one section of the region into the next: just the name tag, no cut
  if (isOut(cur)) {
    const p = (area as Region).pieceAt(player.x, player.z);
    if (p && p.id !== lastPiece) { if (lastPiece) ui.nameTag(p.title, p.sub); lastPiece = p.id; arrived(p.id); }
  }

  for (const p of cur.people) p.actor.animate(dt);
  if (isOut(cur) && time.phase === 'Shutter' && !fight.active) goingIn(dt);
  // once the bell is home, Benny rings it at Lamp: heard on the hill and down the trail
  if (time.phase !== lastPhase) {
    if (lastPhase && time.phase === 'Lamp' && S.flags.bell_hung && (cur.id === HILL || cur.id === TRAIL)) sound.bell();
    lastPhase = time.phase;
  }
  follow(dt);
  if ((ambAge += dt) > 0.38) { ambAge = 0; ambience(); }
  for (const r of cur.roamers) {
    const ac = r.actor;
    r.wait -= dt;
    if (r.tx === null && r.wait <= 0) { r.tx = r.area[0] + Math.random() * (r.area[2] - r.area[0]); r.tz = r.area[1] + Math.random() * (r.area[3] - r.area[1]); }
    if (r.tx !== null) {
      const dx = r.tx - ac.x, dz = r.tz - ac.z, d = Math.hypot(dx, dz);
      if (d < 0.1 || area.blocked(ac.x + (dx / d) * r.speed * dt, ac.z + (dz / d) * r.speed * dt, 0.15)) { r.tx = null; r.wait = 1.5 + Math.random() * 4; ac.moving = false; }
      else { ac.moving = true; ac.face(dx, dz); const nx = ac.x + (dx / d) * r.speed * dt, nz = ac.z + (dz / d) * r.speed * dt; ac.place(nx, area.ground(nx, nz), nz); }
    }
    ac.animate(dt);
  }

  // camera: follow the player, clamped so the edge never shows a void
  camTarget.lerp(clampCam(player.x, player.z), 1 - Math.exp(-dt * (camHold ? 2.2 : 4.5)));
  camZoom += (camZoomTo - camZoom) * (1 - Math.exp(-dt * 1.6));
  if (staged) stageFrame(dt, t);
  else {
    camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, camZoom);
    camera.lookAt(camTarget);
  }
  if (tilt > 0.001) { camera.position.y -= tilt * 8; camera.lookAt(v.set(camTarget.x, camTarget.y + tilt * 17, camTarget.z - tilt * 30)); }
  cur.lights.follow(player.root.position);
  if (isOut(cur)) { fadeOccluders(player.x, player.z, dt); swaySpan(t); }

  // tilt-shift: the sharp band tracks the player's height on screen (spec §4); in a fight, the fight's middle
  if (staged) v.set(CENTRE.x, cur.area.ground(CENTRE.x, CENTRE.z) + 0.8, CENTRE.z).project(camera);
  else v.set(player.x, player.root.position.y + 0.8, player.z).project(camera);
  focusY += ((v.y * 0.5 + 0.5) - focusY) * (1 - Math.exp(-dt * 6));
  post.tiltH.uniforms.focus!.value = focusY;
  post.tiltV.uniforms.focus!.value = focusY;
  // looking up at the sky, the diorama blur would smear it: the band opens to the whole frame
  if (!staged) post.tiltH.uniforms.band!.value = post.tiltV.uniforms.band!.value = 0.1 + tilt * 0.9;

  area.update(t, player.root.position, camTarget);
  if ((mapAge += dt) > 0.05) { mapAge = 0; drawMap(); }
  markGoal();
  post.tick(t);
  post.composer.render();
}

// ------------------------------------------------------------ the story (legacy/poc2, broken down in docs/design/legacy-breakdown.md)
type Mode = 'title' | 'cine' | 'play';
let mode: Mode = 'play';
let S: GameState;
/** Playtests and screenshots skip the title: `?time=`/`?clock=` start in free roam, `?step=` at a mission step. */
/** `#fight-<staging>` (the only part of an address a shared page passes on): straight into the drain fight, framed that way. */
const HASH_FIGHT = /^#fight-([a-z]+)$/.exec(location.hash)?.[1] ?? null;
const HASH_DRONE = location.hash === '#drone';
const STEP = params.get('step') ?? (HASH_FIGHT ? 'pancha' : HASH_DRONE ? 'free' : null);
const TEST = held !== undefined || params.has('clock') || STEP !== null;
/** The prologue's nights and steps (data/quests.json; game/progress.ts reads them). */
const Q = QUESTS as unknown as Quests;
const STEPS = Q.steps;
const hhmm = (t: string): number => { const [h, m] = t.split(':').map(Number); return h! * 60 + m!; };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const touchUI = (): boolean => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let camHold: THREE.Vector3 | null = null;
let camZoom = 1, camZoomTo = 1;
/** Free to walk and for the clock to run: playing, nothing open, nothing being said, no script running. */
const free = (): boolean => loaded && mode === 'play' && !busy && !ui.talking && !director.running && !hud.modal;

/** Who's speaking → whose sprite stands beside the line (legacy PORTRAIT). */
const PORTRAIT: Record<string, string> = {
  'Papá': 'elias', 'Mamá': 'rosa', 'Little Juno': 'kidjuno', 'Juno': 'juno', 'Kit': 'kit', 'Hermana Lupe': 'lupe', 'Doña Chayo': 'chayo', 'Don Beto': 'beto',
  'Rubén': 'ruben', 'Tavo': 'tavo', 'Abuelo Nacho': 'nacho', 'Doña Fina': 'fina', 'Memo': 'memo', 'Nina': 'nina', 'Abuela Toña': 'tona',
  'Doña Marta': 'marta', 'Benny': 'benny', 'Pastor Abel': 'abel', 'Traveler': 'traveler', 'Scavenger': 'scav', 'Neto': 'scav', 'Chuy': 'chuy', 'Keeper': 'keeper',
  'Doña Inés': 'ines', 'Güero': 'guero', 'Noonrider': 'noonrider',
};
let aborting = false;
const stage: Stage = {
  async say(name, text) { const id = PORTRAIT[name]; await ui.speak(name, text, id ? await Actor.portrait(id) : undefined); },
  choose: (q, opts) => ui.choose(q, opts),
  endTalk: () => ui.endTalk(),
  aborted: () => aborting,
  command: (c) => command(c),
};
const director = new Director(DIALOGUE as unknown as Dialogue, (k) => condOf(Q, S, k), stage);
const run = (id: string): Promise<void> => director.run(director.resolve(id));

async function command(c: Cmd): Promise<void> {
  switch (c.do) {
    case 'wait': await sleep(c.ms as number); break;
    case 'item': {
      sound.coin();
      const id = c.id as string, n = c.n as number;
      S.items[id] = (S.items[id] ?? 0) + n;
      hud.toast(n > 1 ? `${ITEM_NAMES[id]} ×${n}` : `Got ${(ITEM_NAMES[id] ?? id).toLowerCase()}`, true);
      break;
    }
    case 'take': S.items[c.id as string] = Math.max(0, (S.items[c.id as string] ?? 0) - (c.n as number)); hud.toast(`Gave ${(ITEM_NAMES[c.id as string] ?? String(c.id)).toLowerCase()}`); break;
    case 'white': sound.coin(); S.white += c.add as number; hud.toast(`+${c.add as number} tins of white`, true); break;
    case 'water':
      sound.pour();
      S.water = c.set != null ? (c.set as number) : Math.min(10, S.water + (c.add as number));
      hud.toast(c.set != null ? 'Water topped off' : `+${c.add as number} water`);
      break;
    case 'page': await unlockPage(String(c.n)); break;
    case 'step': setStep(c.to as string); break;
    case 'flag': S.flags[c.f as string] = true; showObjective(false); break;
    case 'nightEnd': await nightEnd(); break;
    case 'clock': await setTime(hhmm(String(c.at))); break;
    case 'fight': { ui.endTalk(); const r = await fightHere(String(c.id)); if (r === 'win' && c.win) await run(String(c.win)); break; }
    case 'strays': ui.endTalk(); await strayLine(); break;
    case 'noonBell': sound.bell(); break;
    case 'prologueEnd': await prologueEnd(); break;
    case 'checkHome': if (S.flags.fed && S.flags.tank) await run('homeDone'); break;
    case 'hint': hud.toast(touchUI() ? 'Drag on the left to walk. Tap A to talk.' : 'Walk with WASD or the arrows. E or Space to talk. B opens the staybook.', false, 6000); break;
    case 'rest': await rest(); break;
    case 'cam': camHold = new THREE.Vector3(c.x as number, 0.8, c.z as number); break;
    case 'tale': tale.set((c.p as string | null) ?? null); break;
    case 'sfx': sound.play(c.s as string); break;
    case 'ending': await ending(); break;
    case 'spawnEnemies': await spawnEnemies(); break;
    case 'battle': { ui.endTalk(); const r = await battle(); if (r === 'win') await run('drainWin'); break; }
    case 'join': S.joined.push(c.who as string); await bringCast(cur); hud.toast('Kit joined the party', true); sound.coin(); break;
    case 'salvage':
      for (const [k, n] of [['scrap', 4], ['cell', 1], ['bearings', 6]] as const) S.items[k] = (S.items[k] ?? 0) + n;
      hud.toast('Stripped the Stray: scrap ×4, dead cell, bearings ×6');
      await sleep(400);
      break;
    case 'lookUp': await lookUpAt(); break;
    case 'waitDrone': {
      droneGone = lookUp;
      while (lookUp > 0 && lookUp - droneGone < 7) await sleep(100);
      break;
    }
    case 'story': {
      // a side story begins (data/stories.json): its flag, a toast, and its line under the night's objective
      const id = c.id as string, st = (STORIES as unknown as Record<string, Story>)[id];
      if (!st || S.flags[`q_${id}`]) break;
      S.flags[`q_${id}`] = true;
      sound.chime();
      hud.toast(`New story: ${st.title}`, true, 3600);
      showObjective(true);
      break;
    }
    case 'buy': {
      // trade tins of white for something; short of white, nothing changes hands
      const n = c.white as number;
      if (S.white < n) { hud.toast(`Not enough white: ${n} tins`, false); break; }
      S.white -= n;
      S.items[c.item as string] = (S.items[c.item as string] ?? 0) + 1;
      if (c.flag) S.flags[c.flag as string] = true;
      sound.coin();
      hud.toast(`−${n} tins of white · ${ITEM_NAMES[c.item as string] ?? String(c.item)}`, true);
      break;
    }
    case 'run': await run(c.id as string); break;
    case 'go': ui.endTalk(); await go(c.to as string, c.spawn as string); break;
    case 'bell': sound.bell(); showBell(); break;
    default: console.warn('[script] unknown command:', c.do);
  }
  // a step whose tasks are all done hands on; whoever the story needs now comes out (and whoever it doesn't, goes)
  const then = tasksDone(Q, S);
  if (then) setStep(then);
  else if (['flag', 'item', 'take', 'white', 'buy', 'story'].includes(c.do)) refreshPeople();
}

/** Start at a later step with what the steps before it would have given (playtests: `?step=`): the prologue,
 *  walked on paper up to it (game/progress.ts), the same walk the prologue checker makes. */
function catchUp(step: string): void {
  S.step = 'burial';
  const p: Paper = { s: S, log: [], problems: [], went: [] };
  walk(Q, DIALOGUE as unknown as Dialogue, CATALOG, p, { until: step });
  for (const m of p.problems) console.warn('[catch up]', m);
  S.step = step;
}
/** What the paper walk needs to know is there. */
const CATALOG: Catalog = {
  items: ITEM_NAMES, pages: PAGES as Record<string, unknown>, stories: STORIES as Record<string, unknown>, fights: BATTLES as Record<string, unknown>,
  worlds: Object.fromEntries([...Object.keys(REGIONS), ...Object.keys(ROOMS)].map((k) => [k, []])),
};

function setStep(to: string): void {
  S.step = to;
  showObjective(true);
  if (to !== 'burial') sound.chime();
  refreshPeople();
  void bringCast(cur);
  if (to !== 'burial') saveGame(true);
}
function showObjective(flash: boolean): void {
  const n = nightOf(Q, S.step), N = Q.nights[String(n)];
  hud.objective(N ? `${Q.mission} · ${N.title}` : Q.mission, objective(Q, S), flash);
  const st = storyStage();
  hud.side(st ? `${st.title}: ${st.obj}` : '');
}

// ---------------------------------------------------------------- side stories (data/stories.json)
interface StoryStage { when: string; obj: string; marker?: string; at?: [number, number] }
interface Story { title: string; stages: StoryStage[] }
/** The side story being followed: the most recently started one with a stage that holds now. */
function storyStage(): (StoryStage & { title: string }) | null {
  const all = Object.entries(STORIES as unknown as Record<string, Story | string>).filter(([k]) => k !== '_') as Array<[string, Story]>;
  for (const [, st] of all.reverse()) for (const g of st.stages) if (director.cond(g.when)) return { ...g, title: st.title };
  return null;
}
/** Put the bell back in the church's belfry once it's been brought home (church.ts names it). */
function showBell(): void {
  const b = outWorld()?.scene.getObjectByName('church-bell');
  if (b) b.visible = !!S.flags.bell_hung;
}

async function unlockPage(key: string): Promise<void> {
  if (!S.pages.includes(key)) S.pages.push(key);
  sound.page();
  await hud.openBook(PAGES as Record<string, Page>, S.pages, key, true);
}
async function openBook(): Promise<void> {
  if (!S.pages.length) { hud.toast('The staybook is empty.'); return; }
  sound.page();
  const have = PAGE_ORDER.filter((k) => S.pages.includes(k));
  await hud.openBook(PAGES as Record<string, Page>, S.pages, have[have.length - 1]!, false);
}

// ---------------------------------------------------------------- where the story's things are
/** The last place each scripted thing and person was seen (maps stream, the marker still needs them). */
const known = new Map<string, [number, number]>();
function remember(things: Thing[], npcs: NPC[]): void {
  for (const t of things) if (t.script) known.set(`i:${t.script}`, [t.x, t.z]);
  for (const n of npcs) known.set(`npc:${n.id}`, [n.x, n.z]);
}
/** A step's marker: a person, a thing, a place, or one of those chosen by condition (like a dialogue entry). */
type Marker = string | [number, number] | null;
function markerNow(spec: unknown): Marker {
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    for (const [k, v] of Object.entries(spec as Record<string, Marker>)) if (k === '*' || director.cond(k)) return v;
    return null;
  }
  return (spec ?? null) as Marker;
}
function goalPoint(): [number, number] | null {
  const m = markerNow(STEPS[S.step]?.marker);
  if (!m) return storyPoint();
  if (Array.isArray(m)) return m;
  if (m === 'homeTasks') return S.flags.fed && S.flags.tank ? null : known.get(S.flags.fed ? 'i:tank' : 'i:pen') ?? null;
  if (m.startsWith('npc:')) { const p = cur.people.find((q) => q.npc.id === m.slice(4)); return p ? [p.actor.x, p.actor.z] : known.get(m) ?? null; }
  return known.get(m) ?? null;
}
/** Where the followed side story points: its person or thing if it's here, else its place in the region. */
function storyPoint(): [number, number] | null {
  const st = storyStage();
  if (!st?.marker) return null;
  const m = st.marker;
  if (m.startsWith('npc:')) { const p = cur.people.find((q) => q.npc.id === m.slice(4)); if (p) return [p.actor.x, p.actor.z]; }
  else if (!isOut(cur)) { const t = cur.area.things.find((q) => q.script === m.slice(2)); if (t) return [t.x, t.z]; }
  // out in the region it points at the place; inside a room that isn't the place, nowhere
  if (!isOut(cur)) return null;
  return known.get(m) ?? st.at ?? null;
}
function markGoal(): void {
  let g = mode === 'play' && isOut(cur) && free() ? goalPoint() : null;
  // a goal in another region (the hill, the mall, the town): point at the way there
  const there = g && regionAt(g[0], g[1]);
  if (there && there !== cur.id) g = gateTo(cur.id, there);
  if (!g || Math.hypot(player.x - g[0], player.z - g[1]) < 2.4) { hud.mark(null); return; }
  v.set(g[0], cur.area.ground(g[0], g[1]) + 2.1, g[1]).project(camera);
  hud.mark({ x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 });
}

// ---------------------------------------------------------------- Shutter: people go in (the owner, 2026-10-28)
/** Where each person outdoors is headed at Shutter: the nearest door, then gone inside. */
const headingIn = new Map<string, { to: [number, number]; t: number }>();
function goingIn(dt: number): void {
  if (ui.talking || director.running) return;
  const region = cur.area as Region;
  for (const p of [...cur.people]) {
    if (p.npc.allDay) continue;
    let h = headingIn.get(p.npc.id);
    if (!h) {
      // each sets off at its own moment, toward its nearest door that isn't boarded
      if (Math.random() > dt * 0.6) continue;
      const doors = region.pieces.flatMap((b) => b.doors).filter((d) => d.state !== 'boarded');
      let best: [number, number] | null = null, bd = 40;
      for (const d of doors) { const k = Math.hypot(d.x - p.actor.x, d.z - p.actor.z); if (k < bd) { bd = k; best = [d.x, d.z]; } }
      h = { to: best ?? [p.actor.x, p.actor.z], t: 0 };
      headingIn.set(p.npc.id, h);
    }
    h.t += dt;
    const dx = h.to[0] - p.actor.x, dz = h.to[1] - p.actor.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, 1.4 * dt), nx = p.actor.x + (dx / (d || 1)) * step, nz = p.actor.z + (dz / (d || 1)) * step;
    const stuck = cur.area.blocked(nx, nz, 0.2) && d > 1.2;
    if (d < 1.0 || stuck || h.t > 25) {
      // inside: the door shuts behind them
      letGo(cur.scene, p.actor);
      cur.people.splice(cur.people.indexOf(p), 1);
      headingIn.delete(p.npc.id);
      continue;
    }
    p.actor.moving = true;
    p.actor.face(dx, dz);
    p.actor.place(nx, cur.area.ground(nx, nz), nz);
  }
}

// ---------------------------------------------------------------- the white: what daylight costs (game/sun.ts)
let exposure = 0, fainting = false, shadeAge = 0, shaded = false;
const head = new THREE.Vector3();
/** In the sun's shadow right now? Read from the shadow map a few times a second (engine/shade.ts). */
function inShade(dt: number): boolean {
  if ((shadeAge += dt) < 0.25) return shaded;
  shadeAge = 0;
  // just above her head: nothing of hers stands between there and the sun, but sails, roofs and walls do
  head.set(player.x, player.root.position.y + 1.72, player.z);
  shaded = shadedFromSun(renderer, cur.lights.sun, head) ?? false;
  return shaded;
}
function condition(c: Condition): void {
  if (afflict(S, c)) hud.toast(`${CONDITIONS[c].name}. ${CONDITIONS[c].what}`, false, 4200);
}
function weather(dt: number): void {
  if (time.frozen || fainting) { hud.warning(null); return; }
  const ph = time.phase;
  const door = known.get('i:door');
  const sheltered = !isOut(cur) || (!!door && Math.hypot(player.x - door[0], player.z - door[1]) < 3.4);
  if (ph === 'Shutter' && S.flags.shutterWarn !== S.day) { S.flags.shutterWarn = S.day; hud.toast('Shutter. Get under a roof before the white.', true, 4200); }
  if (ph === 'Day' && !sheltered) {
    // shade slows the white, and so do wraps (Rubén's, or Papá's mirror cloth)
    const shade = inShade(dt), k = (shade ? 1 / SUN.shadeSlows : 1) * (S.items.wraps || S.items.mirrorwraps ? SUN.wrapsSlow : 1);
    S.sunTime += dt * k;
    if (S.sunTime > SUN.burnAfter) condition('burn');
    if (S.sunTime > SUN.blindAfter) condition('blind');
    if (S.water > 0) {
      hud.warning(shade ? 'In the shade. Your water burns slower.' : 'Daylight. Your water is burning.');
      if ((exposure += dt * k) > SUN.dropEvery) { exposure = 0; S.water--; sound.hurt(); if (S.water === 0) condition('heat'); }
    } else {
      // no water left: the sun takes health instead
      hud.warning(shade ? 'No water. Even the shade is hot.' : 'No water. The white is taking you.');
      if ((exposure += dt * k) > SUN.hurtEvery) {
        exposure = 0;
        S.party.juno.hp = Math.max(0, S.party.juno.hp - SUN.hurt);
        sound.hurt();
        if (S.party.juno.hp === 0) void faint();
      }
    }
  } else hud.warning(ph === 'Shutter' && !sheltered ? 'Shutter. Find a roof.' : null);
}

/** Out in the white with nothing left: you wake at home the next Lamp, one tin of white poorer, still marked by it. */
async function faint(): Promise<void> {
  fainting = true;
  hud.warning(null);
  await ui.fade(true, 900, '#f4f0e6');
  // in some beats the white decides the story (Güero, night three): its script, then the next night
  const f = STEPS[S.step]?.faint;
  if (f) {
    S.flags[f.flag] = true;
    await run(f.script);
    ui.endTalk();
    S.water = 3; S.white = Math.max(0, S.white - 1);
    S.party.juno.hp = Math.round(maxHp(S) * SUN.faintHp);
    fainting = false;
    await beginNight(f.night);
    return;
  }
  await run('faint');
  S.day++; S.water = 3; S.white = Math.max(0, S.white - 1);
  S.party.juno.hp = Math.round(maxHp(S) * SUN.faintHp);
  await setTime(19 * 60 + 30);
  await go(SPAN, 'seven-flags:home');
  saveGame(true);
  await ui.fade(false, 900);
  fainting = false;
}

/** Jump the clock; the town is rebuilt if its lanterns change. */
async function setTime(m: number): Promise<void> {
  time.set(m);
  shownMinute = -1;
  showClock();
  if (time.lit !== night) await turnOfDay(time.lit);
  relight(true);
}

async function rest(): Promise<void> {
  sound.creak();
  await ui.fade(true, 500);
  // sleep through the day to the next Lamp: whatever the white did wears off
  const lamp = 18 * 60 + 30, from = time.minute;
  if (from >= lamp) S.day++;
  sleepOff(S);
  exposure = 0;
  await setTime(lamp);
  saveGame(true);
  await sleep(350);
  await ui.fade(false, 500);
  hud.toast('You sleep through the white. Lamp. Game saved.', true);
}

// ---------------------------------------------------------------- saves (game/state.ts; rule 8)
function where(): GameState['where'] {
  return player ? { world: cur?.id ?? SPAN, x: +player.x.toFixed(2), z: +player.z.toFixed(2), face: player.dir } : { world: SPAN, ...START, face: 'N' };
}
function saveGame(quiet: boolean): void {
  S.clock = time.minute;
  S.where = where();
  const ok = writeSave(S);
  if (!quiet) { sound.save(); hud.toast(ok ? 'Game saved' : "Couldn't save. Browser storage is turned off.", ok); }
}
async function loadGame(): Promise<boolean> {
  const s = readSave();
  if (!s) { hud.toast('No saved game yet.'); return false; }
  S = s;
  await setTime(S.clock);
  const w = S.where;
  // a save from before the hill and the mall were their own places says 'span' for them too
  const world = w.world in ROOMS ? w.world : w.world in REGIONS ? (regionAt(w.x, w.z) ?? w.world) : SPAN;
  await go(world, { x: w.x, z: w.z, face: w.face });
  mode = 'play';
  hud.show(true);
  minimap.hidden = false;
  showObjective(false);
  await bringCast(cur);
  sound.music('explore');
  hud.toast('Loaded your last save');
  return true;
}

// ---------------------------------------------------------------- menus
async function openPause(): Promise<void> {
  const a = await hud.openPause(S, hasSave());
  if (a === 'book') await openBook();
  else if (a === 'save') saveGame(false);
  else if (a === 'load') await loadGame();
  else if (a === 'title') await titleScreen();
}

async function titleScreen(): Promise<void> {
  mode = 'title';
  ui.endTalk();
  hud.show(false);
  minimap.hidden = true;
  // the title stands in Mar Farm's lot; from anywhere else (a room, the road), Juno is brought home under it
  if (cur.id !== SPAN || Math.hypot(player.x - START.x, player.z - START.z) > 12) {
    await ui.fade(true, 400);
    await go(SPAN, 'start');
    await ui.fade(false, 600);
  }
  camHold = new THREE.Vector3(START.x + 2, 0.8, START.z - 6);
  camZoomTo = 1.25;
  sound.music('intro');
  const a = await hud.titleScreen(hasSave());
  camZoomTo = 1;
  if (a === 'continue') { await ui.fade(true, 400); camHold = null; if (await loadGame()) { await ui.fade(false, 600); return; } }
  await newGame();
}

// ---------------------------------------------------------------- the tale, then the burial
const FIRE = { x: 142.6, z: 64 + 124.2 };
let fire: ReturnType<typeof campfire> | null = null;
const cine: Actor[] = [];
function skipTale(): void {
  if (mode !== 'cine' || aborting) return;
  aborting = true;
  ui.endTalk();
}
hud.skip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); skipTale(); });
for (const [label, fn] of [['Book', openBook], ['Menu', openPause]] as const) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (free()) void fn(); });
  hud.buttons.appendChild(b);
}

async function newGame(): Promise<void> {
  mode = 'cine';
  await ui.fade(true, 700);
  S = newState(where());
  await theTale();
  await burial();
}

/** "A story told at Mar Farm, a long time ago": Papá tells the old story by the fire (legacy 19-intro-cinematic). */
async function theTale(): Promise<void> {
  aborting = false;
  await setTime(21 * 60 + 40);
  if (cur.id !== SPAN) await go(SPAN, 'start');
  await (cur.area as Region).settle(FIRE.x, FIRE.z);
  player.root.visible = false;
  const lupe = cur.people.find((p) => p.npc.id === 'lupe');
  if (lupe) lupe.actor.root.visible = false;
  const y = cur.area.ground(FIRE.x, FIRE.z);
  fire = campfire(FIRE.x, y, FIRE.z);
  cur.scene.add(fire.group);
  (cur.area as Region).addLamp({ pos: new THREE.Vector3(FIRE.x, y + 0.9, FIRE.z), color: new THREE.Color('#ff9a4a'), intensity: 5, dist: 9, flicker: 0.35, tag: 'tale' });
  for (const [id, dx, dz, face] of [['elias', -1.6, 0, 'E'], ['kidjuno', -0.75, 0.8, 'E'], ['rosa', 1.5, 0.2, 'W']] as const) {
    const a = await Actor.person(id, cur.tint);
    a.place(FIRE.x + dx, cur.area.ground(FIRE.x + dx, FIRE.z + dz), FIRE.z + dz);
    a.dir = face;
    cur.scene.add(a.root);
    cine.push(a);
  }
  camHold = new THREE.Vector3(FIRE.x + 0.3, 0.9, FIRE.z - 1.1); // the fire low in the frame, the sheet above it
  camZoomTo = camZoom = 0.55;
  camTarget.copy(camHold);
  hud.skip.classList.add('on');
  await hud.chapter('<p>A story told at Mar Farm,<br>a long time ago.</p>', 2800, () => aborting);
  if (!aborting) { await ui.fade(false, 1600); await run('intro'); }
  hud.skip.classList.remove('on');
  tale.clear();
  ui.endTalk();
  if (!aborting) { await ui.fade(true, 600); await hud.chapter('<h1>The Long Noon</h1><p>Many years later.</p>', 3600, () => aborting); }
  else await ui.fade(true, 200);
  for (const a of cine) cur.scene.remove(a.root);
  cine.length = 0;
  fire?.dispose(); fire = null;
  (cur.area as Region).dropLamps('tale');
  player.root.visible = true;
  if (lupe) lupe.actor.root.visible = true;
  aborting = false;
}

/** Many years later. Lamp, and Papá on the platform, wrapped in white (dialogue.json `burial`). */
async function burial(): Promise<void> {
  mode = 'cine';
  S.step = 'burial';
  await setTime(19 * 60 + 20);
  if (cur.id !== SPAN) await go(SPAN, 'start');
  await (cur.area as Region).settle(START.x, START.z);
  placeAt(START);
  player.face(-0.3, -1);
  camHold = new THREE.Vector3(START.x - 1.2, 0.8, START.z - 1.4);
  camZoomTo = camZoom = 0.8;
  camTarget.copy(camHold);
  sound.music('explore');
  await ui.fade(false, 1100);
  mode = 'play';
  hud.show(true);
  minimap.hidden = false;
  showObjective(false);
  await bringCast(cur);
  await run('burial');
  camHold = null;
  camZoomTo = 1;
}

// ---------------------------------------------------------------- Kit, Pancha, the Stray's wreck (legacy 10-game-state applyState)
/** Where the drain beats happen in Seven Flags (region coordinates): Pancha backed against the concrete,
 *  the culvert the Stray rolls out of, where everyone stands to fight. */
const DRAIN_ZONE = [111, 203, 119.5, 222] as const;
const AT = { pancha: [115, 214.2], culvert: [115, 199.6], stray: [114, 206.6], coyote: [116.7, 207.6], juno: [113.9, 210.8], kit: [116.3, 211.4] } as const;
let kitActor: Actor | null = null, panchaActor: Actor | null = null, wreck: Actor | null = null;
const foes: Actor[] = [];
const castActors = (): Actor[] => [kitActor, panchaActor, wreck, ...foes].filter((a): a is Actor => !!a);

/** Make the cast match the story, in world `w`: Kit following once he's joined, Pancha at the drain or
 *  following, the wreck where the Stray fell. */
async function bringCast(w: World): Promise<void> {
  if (!S || !player) return;
  const joined = S.joined.includes('kit'), drainDone = !!S.flags.drainDone;
  // Kit leaves the plaza for good once the drain begins (and is back there in a new game)
  if (S.flags.drainStarted || joined) for (const p of w.people.filter((q) => q.npc.id === 'kit')) { letGo(w.scene, p.actor); w.people.splice(w.people.indexOf(p), 1); }
  else if (w.id === SPAN && !w.people.some((q) => q.npc.id === 'kit')) {
    const def = w.area.npcs.find((n) => n.id === 'kit'), piece = def && (w.area as Region).pieceAt(def.x, def.z);
    if (def && piece) await populate(w, [def], [], piece.id);
  }
  if (joined || (S.flags.drainStarted && !drainDone)) kitActor ??= await Actor.person('kit', w.tint);
  else if (kitActor) { kitActor.root.parent?.remove(kitActor.root); kitActor = null; }
  const pancha = (S.step === 'pancha' && w.id === SPAN) || drainDone;
  if (pancha) panchaActor ??= await Actor.critter('pancha', w.tint, 0.62);
  else if (panchaActor) { panchaActor.root.parent?.remove(panchaActor.root); panchaActor = null; }
  if (drainDone && w.id === SPAN) wreck ??= await Actor.critter('strayBroken', w.tint, 1.15);
  if (wreck && (!drainDone || w.id !== SPAN)) { wreck.root.parent?.remove(wreck.root); if (!drainDone) wreck = null; }
  if (wreck && w.id === SPAN) { wreck.place(AT.stray[0], w.area.ground(AT.stray[0], AT.stray[1]), AT.stray[1]); w.scene.add(wreck.root); }
  if (panchaActor && !drainDone) { panchaActor.place(AT.pancha[0], w.area.ground(AT.pancha[0], AT.pancha[1]), AT.pancha[1]); panchaActor.dir = 'W'; }
  // followers fall in behind Juno
  trailReset();
  for (const [a, dx, dz] of [[joined ? kitActor : null, 1.0, 0.5], [drainDone ? panchaActor : null, -1.1, 1.2]] as const) {
    if (!a) continue;
    const x = player.x + dx, z = player.z + dz;
    a.place(x, w.area.ground(x, z), z);
  }
  for (const a of [kitActor, panchaActor]) if (a && (a !== kitActor || joined || S.flags.drainStarted)) { a.setTint(w.tint); w.scene.add(a.root); }
}

/** Juno's trail; followers walk it a few steps behind her (legacy 16-exploration). */
const trail: Array<[number, number]> = [];
function trailReset(): void { trail.length = 0; for (let i = 0; i < 40; i++) trail.push([player.x, player.z]); }
function trailPush(): void { const l = trail[trail.length - 1]; if (!l || Math.hypot(l[0] - player.x, l[1] - player.z) > 0.16) { trail.push([player.x, player.z]); if (trail.length > 90) trail.shift(); } }
function follow(dt: number): void {
  if (!S || mode !== 'play' || fight.active || lookUp > 0) { kitActor?.animate(dt); panchaActor?.animate(dt); return; }
  const go = (a: Actor | null, back: number): void => {
    if (!a) return;
    const [tx, tz] = trail[Math.max(0, trail.length - 1 - back)] ?? [player.x, player.z];
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    a.moving = d > 0.04;
    a.running = a.moving && (player.running || d > 1.2); // keeping up: runs when Juno runs, or when left behind
    if (a.moving) { const st = Math.min(d, RUN * 1.15 * dt), x = a.x + (dx / d) * st, z = a.z + (dz / d) * st; a.face(dx, dz); a.place(x, cur.area.ground(x, z), z); }
    a.animate(dt);
  };
  if (S.joined.includes('kit')) go(kitActor, 12); else kitActor?.animate(dt);
  if (S.flags.drainDone) go(panchaActor, 24); else panchaActor?.animate(dt);
}

// ---------------------------------------------------------------- the fight at the drain (legacy 17-battle; game/battle.ts)
const v2 = new THREE.Vector3();
const fight = new Fight(ui.root, {
  sound,
  get state() { return S; },
  toScreen(x, y, z) { v2.set(x, y, z).project(camera); return v2.z > 1 ? null : { x: (v2.x * 0.5 + 0.5) * innerWidth, y: (-v2.y * 0.5 + 0.5) * innerHeight }; },
  ground: (x, z) => cur.area.ground(x, z),
  get tint() { return cur.tint; },
  blind(a) { const i = foes.indexOf(a); if (i >= 0 && fightId === 'drain') void Actor.critter('strayBroken', cur.tint, 1.15).then((b) => { b.place(a.x, a.root.position.y, a.z); cur.scene.remove(a.root); cur.scene.add(b.root); foes[i] = b; }); (cur.area as Partial<Region>).dropLamps?.('stray'); },
  dead() { (cur.area as Partial<Region>).dropLamps?.('stray'); },
  touch: touchUI(),
  onAct: (who, target, move) => {
    // a foe's move: the Stray's spark, or a ram or a bite
    if (who !== player && who !== kitActor) { void who.play(move && who.has(move) ? move : 'attack'); return; }
    cutTo(who, target);
    // the blow itself: Juno swings the pipe, Kit lets the sling go
    void who.play(who.has('throw') ? 'throw' : 'attack');
  },
  onHurt: (who, down) => { void who.play(down ? 'down' : 'hurt', down); },
  onDrink: (who) => { void who.play('drink'); },
  miss: (id) => (id === 'juno' && has(S, 'blind') ? 0.25 : 0),
  onTurn: (side) => {
    if (!staged?.director) return;
    // being attacked: the hero shot, low behind the enemy, for the whole of its turn; back to the rotation after
    if (side === 'foe') { if (direct.hold !== 'hero') direct.quick = performance.now() + 900; direct.hold = 'hero'; }
    else if (direct.hold) { direct.hold = null; direct.quick = performance.now() + 900; direct.next = performance.now() + DIRECTOR.every; }
  },
});

// ---------------------------------------------------------------- battle stagings
/**
 * How a fight is shown. The owner, 2026-10-27: "play with a few different battle screens… different
 * orientations… let's be dramatic." Each staging sets where everyone stands (offsets from the fight's
 * centre: x east, z south), the camera, and the look; `?battle=<name>` picks one. The fight's rules don't
 * change, only how it's framed.
 */
interface Staging {
  title: string;
  after: string;
  party: Array<[number, number]>;
  foes: Array<[number, number]>;
  cam: { pos: [number, number, number]; look: [number, number, number]; fov: number };
  /** Cinema bars top and bottom. */
  letterbox?: boolean;
  /** The camera pushes in on whoever acts. */
  cuts?: boolean;
  /** A slow drift, so the frame breathes (units). */
  sway?: number;
  /** How much of the frame the tilt-shift keeps sharp (0.1 is the overworld's band). */
  band: number;
  /** Turn everyone this far toward the camera, the way actors cheat out on a stage (0 = squarely at each other). */
  cheat?: number;
  /** A directed staging: everyone holds one formation and the camera moves between shots (`DIRECTOR`). */
  director?: boolean;
}

/** One camera set-up around the director's formation. */
interface Shot { pos: [number, number, number]; look: [number, number, number]; fov: number; band: number; cheat: number; letterbox?: boolean }
/**
 * The director (the owner, 2026-10-27): everyone keeps their place, and the camera floats between four
 * shots of the same formation. It opens over the shoulder, then glides to the next shot every five
 * seconds (shoulder, diorama, face-off); an enemy's turn swings to the hero shot for as long as you're
 * being attacked; your own blows cut in over the attacker's shoulder for a beat.
 */
const DIRECTOR = {
  /** The formation all four shots look at: the party to the south, the enemy to the north, along the drain. */
  party: [[-0.9, 1.8], [1.1, 3.4]] as Array<[number, number]>,
  foes: [[-0.5, -2.6], [2.2, -1.6]] as Array<[number, number]>,
  shots: {
    shoulder: { pos: [1.5, 3.0, 8.8], look: [-0.5, 0.9, -1.2], fov: 38, band: 0.2, cheat: 0 },
    diorama: { pos: [-8.2, 4.2, 0.7], look: [0.3, 0.7, 0.3], fov: 32, band: 0.2, cheat: 0.75 },
    faceoff: { pos: [8.8, 9.4, 8.6], look: [0.2, 0.4, 0.2], fov: 24, band: 0.14, cheat: 0.85 },
    hero: { pos: [2.2, 0.7, -8.4], look: [-0.7, 1.4, 1.8], fov: 42, band: 0.22, cheat: 0.3, letterbox: true },
  } as Record<string, Shot>,
  rotation: ['shoulder', 'diorama', 'faceoff'],
  every: 5000,
};
/** Where the director is: the shot in the rotation, when it moves on, and a shot held for a turn (the hero shot). */
const direct = { rot: 0, next: 0, hold: null as string | null, quick: 0 };
const STAGINGS: Record<string, Staging> = {
  topdown: {
    title: 'In place', after: 'Sea of Stars, Chrono Trigger: the fight happens where you stand, from the overworld camera',
    party: [[-1.3, 1.3], [1.1, 1.9]], foes: [[-1.2, -2.9], [1.5, -1.9]],
    cam: { pos: [0, 10.8, 12.5], look: [0, 0.8, 0.9], fov: 30 }, band: 0.1,
  },
  diorama: {
    title: 'Diorama', after: 'Octopath Traveler I and II: side-on and low, the party in a staggered column on the right, the enemy large on the left',
    party: [[-0.7, 2.3], [0.9, 3.5]], foes: [[-0.1, -2.2], [1.4, -1.0]],
    cam: { pos: [-7.6, 4.4, 1.2], look: [0.3, 0.7, 0.6], fov: 32 }, band: 0.2, sway: 0.35, cheat: 0.75,
  },
  shoulder: {
    title: 'Over the shoulder', after: 'Dragon Quest III HD-2D: behind the party, the enemy facing you',
    party: [[-0.9, 2.5], [1.0, 2.9]], foes: [[-0.6, -3.2], [1.6, -2.4]],
    cam: { pos: [0.3, 2.4, 7.4], look: [0.1, 1.1, -2.4], fov: 38 }, band: 0.2, sway: 0.2,
  },
  hero: {
    title: 'Hero shot', after: 'Clair Obscur, modern Final Fantasy: low behind the enemy, looking up at the party, letterboxed',
    party: [[-0.5, 1.6], [0.9, 2.3]], foes: [[2.1, -3.3], [-2.1, -2.7]],
    cam: { pos: [0.3, 0.62, -7.6], look: [0.1, 1.45, 1.8], fov: 42 }, band: 0.22, letterbox: true, sway: 0.25, cheat: 0.3,
  },
  iso: {
    title: 'Face-off', after: 'Triangle Strategy, Live A Live: a high diagonal, two sides squared up across the concrete',
    party: [[1.7, 1.9], [3.0, 0.8]], foes: [[-1.9, -1.5], [-0.6, -2.9]],
    cam: { pos: [9.4, 9.8, 9.4], look: [0.2, 0.4, 0.2], fov: 24 }, band: 0.14, cheat: 0.85,
  },
  director: {
    title: 'Directed', after: 'The owner\'s mix: one formation; the camera floats between over the shoulder, the diorama and the face-off, swings to the hero shot when you\'re attacked, and cuts in on your blows',
    party: DIRECTOR.party, foes: DIRECTOR.foes,
    cam: { ...DIRECTOR.shots.shoulder! }, band: 0.2, director: true, cuts: true,
  },
  cuts: {
    title: 'Diorama with cuts', after: 'Octopath Traveler II: the diorama, but the camera swings in on every blow',
    party: [[-0.7, 2.3], [0.9, 3.5]], foes: [[-0.1, -2.2], [1.4, -1.0]],
    cam: { pos: [-7.6, 4.4, 1.2], look: [0.3, 0.7, 0.6], fov: 32 }, band: 0.2, sway: 0.35, cuts: true, cheat: 0.75,
  },
};
const BATTLE = [params.get('battle'), HASH_FIGHT].find((b) => b && STAGINGS[b]) ?? 'director';
/** The fight's centre at the drain, and the staging in use (null outside a fight). */
const CENTRE = { x: 115.2, z: 209.4 };
/** Where the fight in progress is centred (the drain's centre, or wherever the story started it). */
let centre = { ...CENTRE };
/** Which fight (data/battles.json). */
let fightId = 'drain';
let staged: Staging | null = null;
let stageCut: { pos: THREE.Vector3; look: THREE.Vector3; fov: number; until: number } | null = null;
/** The first frame of a staging cuts straight to its mark (the fight opens on a flash). */
let stageSnap = false;
const letterbox = document.createElement('div');
letterbox.className = 'letterbox';
ui.root.appendChild(letterbox);

const stageAt = (o: [number, number]): [number, number] => [centre.x + o[0], centre.z + o[1]];
/** A staging's mark for the i-th foe; a third foe and on stand beyond the second. */
const foeMark = (st: Staging, i: number): [number, number] => st.foes[i] ?? [st.foes[1]![0] + 1.8 * (i - 1), st.foes[1]![1] - 1.0 * (i - 1)];
/** Put everyone where the staging says and frame it. */
function stageFight(st: Staging): void {
  staged = st;
  stageSnap = true;
  ui.root.classList.add('fighting');
  // the director keeps one set of panels while its camera moves: in the corners, out of every shot's middle
  fight.setLayout(st.director ? 'topdown' : Object.keys(STAGINGS).find((k) => STAGINGS[k] === st) ?? 'topdown');
  letterbox.classList.toggle('on', !!st.letterbox);
  Object.assign(direct, { rot: 0, next: performance.now() + DIRECTOR.every, hold: null, quick: 0 });
  const g = (x: number, z: number): number => cur.area.ground(x, z);
  const party = [player, kitActor].filter((a): a is Actor => !!a);
  party.forEach((a, i) => { const [x, z] = stageAt(st.party[i]!); a.place(x, g(x, z), z); a.stance = true; a.moving = false; });
  foes.forEach((a, i) => { const [x, z] = stageAt(foeMark(st, i)); a.place(x, g(x, z), z); });
  // the Stray's one red eye goes where the Stray is (a room has its own lamps, and no pool to add to)
  const lamps = cur.area as Partial<Region>;
  lamps.dropLamps?.('stray');
  if (foes[0] && fightId === 'drain') lamps.addLamp?.({ pos: new THREE.Vector3(foes[0].x, foes[0].root.position.y + 0.9, foes[0].z + 0.3), color: new THREE.Color('#ff4a2a'), intensity: 2.2, dist: 5, flicker: 0.1, tag: 'stray' });
  // and a cool key light over the fight, so faces read from any side at night
  lamps.dropLamps?.('stage');
  const y = g(centre.x, centre.z);
  lamps.addLamp?.({ pos: new THREE.Vector3(centre.x - 1, y + 4.6, centre.z + 1.2), color: new THREE.Color('#b8c6ff'), intensity: 5, dist: 14, flicker: 0, tag: 'stage' });
}
function unstage(): void {
  for (const a of [player, kitActor, ...foes]) { a?.pose(null); if (a) { a.stance = false; a.release(); } }
  staged = null; stageCut = null;
  ui.root.classList.remove('fighting');
  letterbox.classList.remove('on');
  camera.fov = 30; camera.updateProjectionMatrix();
  (cur.area as Region | undefined)?.dropLamps?.('stage');
}
/** On a cut staging, swing in over the attacker's shoulder toward the target for a beat. */
function cutTo(who: Actor, target: Actor): void {
  if (!staged?.cuts) return;
  const dx = who.x - target.x, dz = who.z - target.z, l = Math.hypot(dx, dz) || 1;
  const y = who.root.position.y;
  stageCut = {
    pos: new THREE.Vector3(who.x + (dx / l) * 4.4 - (dz / l) * 1.9, y + 2.0, who.z + (dz / l) * 4.4 + (dx / l) * 1.9),
    look: new THREE.Vector3(target.x, target.root.position.y + 0.8, target.z),
    fov: 26, until: performance.now() + 1300,
  };
}
const camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3(), lookNow = new THREE.Vector3();
/** Each frame of a staged fight: the camera, and every figure turned to it. */
function stageFrame(dt: number, t: number): void {
  const st = staged!;
  const y = cur.area.ground(centre.x, centre.z);
  const sw = st.sway ? Math.sin(t * 0.25) * st.sway : 0;
  const now = performance.now();
  if (stageCut && now > stageCut.until) stageCut = null;
  // the director: which shot, and a gentle float around it
  let cam = st.cam, band = st.band, cheatNow = st.cheat ?? 0, drift = [0, 0, 0];
  if (st.director) {
    if (!direct.hold && !stageCut && now > direct.next) { direct.rot = (direct.rot + 1) % DIRECTOR.rotation.length; direct.next = now + DIRECTOR.every; }
    const shot = DIRECTOR.shots[direct.hold ?? DIRECTOR.rotation[direct.rot]!]!;
    cam = shot; band = shot.band; cheatNow = shot.cheat;
    letterbox.classList.toggle('on', !!shot.letterbox && !stageCut);
    const ft = now / 1000;
    drift = [Math.sin(ft * 0.21) * 0.45, Math.sin(ft * 0.17) * 0.16, Math.cos(ft * 0.23) * 0.4];
  }
  if (stageCut) { camGoal.copy(stageCut.pos); lookGoal.copy(stageCut.look); }
  else {
    camGoal.set(centre.x + cam.pos[0] + sw + drift[0]!, y + cam.pos[1] + drift[1]!, centre.z + cam.pos[2] - sw * 0.5 + drift[2]!);
    lookGoal.set(centre.x + cam.look[0], y + cam.look[1], centre.z + cam.look[2]);
  }
  // glides are gentle; a swing to the hero shot or a cut is quick
  const rate = stageCut ? 7 : now < direct.quick ? 4.5 : st.director ? 1.7 : 3;
  const k = stageSnap ? 1 : 1 - Math.exp(-dt * rate);
  stageSnap = false;
  camera.position.lerp(camGoal, k);
  lookNow.lerp(lookGoal, k);
  camera.lookAt(lookNow);
  const fov = stageCut ? stageCut.fov : cam.fov;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
  post.tiltH.uniforms.band!.value = post.tiltV.uniforms.band!.value = band;
  // everyone faces the other side, turned to the camera, drawn from whichever of their eight sides shows
  const vx = lookNow.x - camera.position.x, vz = lookNow.z - camera.position.z;
  const party = [player, kitActor].filter((a): a is Actor => !!a);
  const mid = (list: Actor[]): [number, number] => [list.reduce((s, a) => s + a.x, 0) / list.length, list.reduce((s, a) => s + a.z, 0) / list.length];
  const pm = mid(party), fm = foes.length ? mid(foes) : pm;
  const vl = Math.hypot(vx, vz) || 1, cheat = stageCut ? 0.2 : cheatNow;
  for (const [list, other] of [[party, fm], [foes, pm]] as const) for (const a of list) {
    if (!a.root.visible) continue;
    const fx = other[0] - a.x, fz = other[1] - a.z, fl = Math.hypot(fx, fz) || 1;
    a.pose({ fx: fx / fl - (vx / vl) * cheat, fz: fz / fl - (vz / vl) * cheat, vx, vz, yaw: Math.atan2(camera.position.x - a.x, camera.position.z - a.z) });
  }
}

/** Straight into the drain fight (looking at stagings: `#fight-<name>`, `__LN.battleDemo`). */
async function fightDemo(): Promise<void> {
  S.flags.drainStarted = true;
  await (cur.area as Region).settle(CENTRE.x, CENTRE.z);
  player.place(CENTRE.x, cur.area.ground(CENTRE.x, CENTRE.z + 2), CENTRE.z + 2);
  await bringCast(cur);
  await spawnEnemies();
  const r = await battle();
  if (r === 'win') await run('drainWin');
}

/** Something rolls out of the culvert's dark mouth, and a coyote after it. Everyone takes their places. */
async function spawnEnemies(): Promise<void> {
  await bringCast(cur);
  const g = (x: number, z: number): number => cur.area.ground(x, z);
  player.place(AT.juno[0], g(AT.juno[0], AT.juno[1]), AT.juno[1]); player.dir = 'N';
  if (kitActor) { kitActor.place(AT.kit[0], g(AT.kit[0], AT.kit[1]), AT.kit[1]); kitActor.dir = 'N'; cur.scene.add(kitActor.root); }
  for (const [kind, h] of [['stray', 1.15], [variant('coyote', 3, 1), 0.8]] as const) {
    const a = await Actor.critter(kind, cur.tint, h);
    a.place(AT.culvert[0], g(AT.culvert[0], AT.culvert[1]), AT.culvert[1]);
    cur.scene.add(a.root);
    foes.push(a);
  }
  const st = STAGINGS[BATTLE]!;
  // the Stray's one red eye
  const eye = new THREE.Vector3(AT.stray[0], g(AT.stray[0], AT.stray[1]) + 0.9, AT.stray[1] + 0.4);
  (cur.area as Region).addLamp({ pos: eye, color: new THREE.Color('#ff4a2a'), intensity: 2.2, dist: 5, flicker: 0.1, tag: 'stray' });
  sound.servo(); setTimeout(() => sound.beep(), 500); setTimeout(() => sound.growl(), 900);
  await Promise.all(foes.map(async (a, i) => {
    const to = stageAt(st.foes[i]!);
    await sleep(i * 500);
    a.moving = true;
    const sx = a.x, sz = a.z;
    await new Promise<void>((res) => {
      const t0 = performance.now();
      const f = (): void => { const k = Math.min(1, (performance.now() - t0) / 1500), x = sx + (to[0] - sx) * k, z = sz + (to[1] - sz) * k; a.face(to[0] - sx, to[1] - sz); a.place(x, g(x, z), z); if (k < 1) requestAnimationFrame(f); else res(); };
      f();
    });
    a.moving = false;
  }));
  stageFight(st);
}

async function battle(id = 'drain'): Promise<'win' | 'load'> {
  if (!staged) stageFight(STAGINGS[BATTLE]!);
  const B = BATTLES as unknown as Record<string, FightDef> & { units: Record<string, UnitDef> };
  sound.battleStart();
  sound.music('combat');
  minimap.hidden = true;
  for (let retry = false; ; retry = true) {
    // what the white did to Juno follows her into the fight (game/sun.ts)
    const j = B.units.juno!, units = { ...B.units, juno: { ...j, hp: maxHp(S), spd: has(S, 'heat') ? j.spd * 0.75 : j.spd } };
    const r = await fight.fight(B[id]!, units, { juno: player, kit: kitActor! }, foes, retry);
    if (r === 'win') break;
    if (r === 'load') { unstage(); clearFoes(); camHold = null; minimap.hidden = false; await loadGame(); return 'load'; }
    for (const a of foes) a.root.visible = true;
  }
  if (id === 'drain') S.flags.drainDone = true;
  fightId = 'drain'; centre = { ...CENTRE };
  minimap.hidden = false;
  await ui.fade(true, 450);
  unstage();
  clearFoes();
  await bringCast(cur);
  if (kitActor) { kitActor.place(player.x + 0.9, cur.area.ground(player.x + 0.9, player.z + 0.4), player.z + 0.4); kitActor.dir = 'W'; }
  if (panchaActor) panchaActor.place(player.x + 1.6, cur.area.ground(player.x + 1.6, player.z + 0.9), player.z + 0.9);
  sound.music('explore');
  await ui.fade(false, 600);
  camHold = null;
  return 'win';
}
/** A fight the story starts where Juno stands (the dogs, the Warden): its foes come in, everyone takes their
 *  marks, and it's fought there. Indoors it's framed from the overworld camera (walls close in on the others). */
async function fightHere(id: string): Promise<'win' | 'load'> {
  const def = (BATTLES as unknown as Record<string, { enemies: Array<{ sprite?: string; height?: number }> }>)[id];
  if (!def) { console.warn('[fight] no fight', id); return 'win'; }
  fightId = id;
  centre = { x: player.x, z: player.z - 2.4 };
  await bringCast(cur);
  for (const e of def.enemies) {
    const a = await Actor.critter(e.sprite ?? 'stray', cur.tint, e.height ?? 1);
    a.place(centre.x, cur.area.ground(centre.x, centre.z - 5), centre.z - 5);
    cur.scene.add(a.root);
    foes.push(a);
  }
  sound.growl();
  stageFight(isOut(cur) ? STAGINGS[BATTLE]! : STAGINGS.topdown!);
  return battle(id);
}
/** Night three's Lamp: the Strays roll east down Del Mar in a line, past Juno and Kit. */
async function strayLine(): Promise<void> {
  const z = player.z + 6.5, x0 = player.x - 12, g = (x: number): number => cur.area.ground(x, z);
  const line = await Promise.all([0, 1, 2, 3, 4].map(() => Actor.critter('stray', cur.tint, 1.0)));
  line.forEach((a, i) => { a.place(x0 - i * 2.4, g(x0 - i * 2.4), z); a.face(1, 0); a.moving = true; cur.scene.add(a.root); });
  sound.servo();
  camHold = new THREE.Vector3(player.x, 0.8, player.z + 3);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    let last = t0;
    const f = (now: number): void => {
      const k = Math.min(1, (now - t0) / 7000), dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      line.forEach((a, i) => { const x = x0 - i * 2.4 + k * 30; a.place(x, g(x), z); a.animate(dt); });
      if (k < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  for (const a of line) cur.scene.remove(a.root);
  camHold = null;
}
function clearFoes(): void {
  for (const a of foes) a.root.parent?.remove(a.root);
  foes.length = 0;
  (cur.area as Region | undefined)?.dropLamps?.('stray');
}

// ---------------------------------------------------------------- the ending: the drone (legacy 18-rest-faint-ending, 07-the-drone)
let tilt = 0, lookUp = 0, droneT0 = 0, droneGone = 0;
let drone: THREE.Group | null = null, droneShadow: THREE.Mesh | null = null;
function makeDrone(): THREE.Group {
  const D = new THREE.Group();
  const wM = new THREE.MeshBasicMaterial({ color: 0x3a3d46, fog: false }), pM = new THREE.MeshBasicMaterial({ color: 0x1d2433, fog: false }), dM = new THREE.MeshBasicMaterial({ color: 0x2a2c33, fog: false });
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material): void => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); D.add(o); };
  add(3.4, 0.35, 60, 0, 0, 0, wM); add(2.9, 0.06, 58, 0.1, 0.2, 0, pM);
  for (const z of [-21, -7, 7, 21]) { add(3.6, 1.1, 0.9, -0.4, -0.7, z, dM); add(0.3, 1.6, 0.08, -2.3, -0.3, z, dM); }
  add(5.2, 1.5, 2.2, -0.6, -0.9, 0, wM); add(9, 0.3, 0.3, -4.5, -0.5, -6, dM); add(9, 0.3, 0.3, -4.5, -0.5, 6, dM); add(1.4, 0.2, 13, -9, -0.4, 0, wM);
  add(3.6, 0.12, 60.4, 0.2, -0.05, 0, new THREE.MeshBasicMaterial({ color: 0x8a8e98, fog: false }));
  return D;
}
/** Everybody's up on the roofs. Look up: something the length of a street, low over town, going toward the lake. */
async function lookUpAt(): Promise<void> {
  player.dir = 'N';
  if (kitActor) kitActor.dir = 'N';
  drone = makeDrone();
  drone.position.set(player.x - 70, 20, player.z - 40);
  droneGone = 0;
  cur.scene.add(drone);
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const x = c.getContext('2d')!, gr = x.createLinearGradient(0, 0, 16, 0);
  gr.addColorStop(0, 'rgba(30,26,40,0)'); gr.addColorStop(0.5, 'rgba(30,26,40,0.55)'); gr.addColorStop(1, 'rgba(30,26,40,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 16, 64);
  droneShadow = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  droneShadow.rotation.x = -Math.PI / 2;
  cur.scene.add(droneShadow);
  lookUp = 0.001;
  droneT0 = performance.now();
  sound.drone();
  await sleep(2600);
}
function skyward(): void {
  // the flight runs on the wall clock, so a slow frame never stretches it
  lookUp = (performance.now() - droneT0) / 1000;
  tilt = Math.min(1, lookUp / 2.2);
  if (!drone || !droneShadow) return;
  // it glides in over the town and seems to hang there while you look; told to wait for it, it goes on east
  if (!droneGone) drone.position.x = player.x - 2 - 68 * Math.exp(-lookUp / 2.4);
  else drone.position.x = player.x - 2 - 68 * Math.exp(-droneGone / 2.4) + (lookUp - droneGone) * 12;
  drone.position.y = 20 - Math.min(lookUp, 12) * 0.2;
  drone.position.z = player.z - 40 + Math.sin(lookUp * 0.4) * 1.2;
  drone.rotation.x = Math.sin(lookUp * 0.7) * 0.05; drone.rotation.z = -0.04;
  droneShadow.position.set(drone.position.x + 6, cur.area.ground(player.x, player.z) + 0.06, drone.position.z + 22);
}
function dropDrone(): void {
  for (const o of [drone, droneShadow]) if (o) { o.parent?.remove(o); o.traverse((q) => { const m = q as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
  drone = null; droneShadow = null; lookUp = 0; tilt = 0;
}

/**
 * Night one ends quietly (the Complete Story File, night one): Memo's bell, Kit says what Shutter is and runs home,
 * Juno sits by Papá's empty chair while the light under the door goes white, and sleeps. No drone: it comes down at
 * the end of the fifth night (the owner, 2026-10-28), when it changes what five nights have made ordinary.
 */
async function ending(): Promise<void> {
  mode = 'cine';
  sound.music('none');
  sound.bell();
  await run('shutterBell');
  ui.endTalk();
  // Kit and Pancha go off east at a run, home before the bell stops
  await Promise.all([kitActor, panchaActor].map(async (a, i) => {
    if (!a) return;
    a.moving = true; a.running = true;
    const sx = a.x, sz = a.z, tx = sx + 14, tz = sz + 2 + i;
    await new Promise<void>((res) => {
      const t0 = performance.now();
      const f = (): void => { const k = Math.min(1, (performance.now() - t0) / 2600), x = sx + (tx - sx) * k, z = sz + (tz - sz) * k; a.face(1, 0.1); a.place(x, cur.area.ground(x, z), z); if (k < 1) requestAnimationFrame(f); else res(); };
      f();
    });
    a.root.visible = false;
  }));
  await ui.fade(true, 700);
  await go('mar-home', { x: 11.6, z: 5.0, face: 'E' });
  hud.show(false);
  minimap.hidden = true;
  await ui.fade(false, 700);
  await run('emptyChair');
  ui.endTalk();
  // she sleeps: the day goes by, and whatever the night did with it
  await ui.fade(true, 1600, '#f4f0e6');
  S.day++;
  sleepOff(S);
  if (!S.pages.includes('last')) S.pages.push('last');
  sound.music('intro');
  for (;;) {
    const a = await hud.endCard('Night one', 'Given to the Sun');
    if (a === 'read') { await hud.openBook(PAGES as Record<string, Page>, S.pages, 'last', true); continue; }
    if (kitActor) kitActor.root.visible = true;
    if (panchaActor) panchaActor.root.visible = true;
    hud.hideCard();
    await ui.fade(true, 500);
    await beginNight(2);
    if (a === 'title') await titleScreen();
    return;
  }
}

/** Juno sleeps on her cot and the night ends (the cot's scripts): the night's card, then the next night. Night
 *  five's dawn is the drone's day. */
async function nightEnd(): Promise<void> {
  const n = nightOf(Q, S.step), N = Q.nights[String(n)];
  mode = 'cine';
  ui.endTalk();
  await ui.fade(true, 1400, '#f4f0e6');
  sleepOff(S);
  exposure = 0;
  if (N?.dawn === 'drone') { S.flags.drone_down = true; await droneDay(n + 1); return; }
  hud.show(false);
  minimap.hidden = true;
  sound.music('intro');
  const a = await hud.endCard(N?.title ?? '', N?.name ?? '');
  if (a === 'read') { const last = PAGE_ORDER.filter((k) => S.pages.includes(k)).pop(); if (last) await hud.openBook(PAGES as Record<string, Page>, S.pages, last, true); }
  hud.hideCard();
  await beginNight(n + 1);
  if (a === 'title') await titleScreen();
}
/** Where Juno wakes: her cot in Mar Farm. */
const COT: Spot = { x: 4.1, z: 9.6, face: 'N' };
/** A night begins: Lamp (or the hour the night says), at home, its first step, and its wake script. */
async function beginNight(n: number): Promise<void> {
  const N = Q.nights[String(n)];
  if (!N) return;
  S.day++;
  S.flags.night = n;
  S.step = N.first;
  dropDrone();
  camHold = null; camZoomTo = 1;
  await setTime(N.at ? hhmm(N.at) : 19 * 60 + 30);
  await go('mar-home', COT);
  mode = 'play';
  hud.show(true);
  minimap.hidden = false;
  showObjective(true);
  refreshPeople();
  await bringCast(cur);
  saveGame(true);
  sound.music('explore');
  await ui.fade(false, 700);
  ui.nameTag(N.title, N.name);
  if (N.wake) await run(N.wake);
}
/** Up the Thirty-Five at Lamp: the prologue ends, and Act I would begin at the Gate. */
async function prologueEnd(): Promise<void> {
  mode = 'cine';
  ui.endTalk();
  await ui.fade(true, 1600);
  hud.show(false);
  minimap.hidden = true;
  sound.music('intro');
  S.step = 'free';
  const a = await hud.endCard('Seven Flags', 'The prologue ends. Act I begins at the Gate.');
  hud.hideCard();
  await afterEnding();
  if (a === 'title') await titleScreen();
}

/** The fifth night's end (`#drone` shows it now): Kit wakes Juno in the white, everyone's on the roofs, and the drone goes over toward the lake. */
async function droneDay(next?: number): Promise<void> {
  sound.music('none');
  await ui.fade(true, 0);
  await setTime(6 * 60 + 50);
  await go(SPAN, 'seven-flags:home');
  await bringCast(cur);
  player.dir = 'N';
  if (kitActor) { kitActor.place(player.x + 1.4, cur.area.ground(player.x + 1.4, player.z + 0.5), player.z + 0.5); kitActor.dir = 'W'; }
  if (panchaActor) panchaActor.place(player.x + 4, cur.area.ground(player.x + 4, player.z + 1.6), player.z + 1.6);
  camHold = new THREE.Vector3(player.x + 0.6, 0.8, player.z - 0.4);
  camZoomTo = camZoom = 0.8;
  mode = 'cine';
  hud.show(false);
  minimap.hidden = true;
  await ui.fade(true, 0, '#f4f0e6');
  await ui.fade(false, 1100);
  await run('fall');
  await sleep(900);
  ui.endTalk();
  sound.music('intro');
  const a = await hud.endCard('Day five', 'Nothing ever comes down');
  hud.hideCard();
  if (next) { await ui.fade(true, 500); await beginNight(next); } else await afterEnding();
  if (a === 'title') await titleScreen();
}
/** After an ending: the next Lamp, Kit and Pancha with you, Seven Flags yours to walk. */
async function afterEnding(): Promise<void> {
  dropDrone();
  camHold = null; camZoomTo = 1;
  await ui.fade(true, 500);
  await setTime(19 * 60 + 30);
  await go(SPAN, 'seven-flags:home');
  S.step = 'free';
  mode = 'play';
  hud.show(true);
  minimap.hidden = false;
  showObjective(true);
  await bringCast(cur);
  saveGame(true);
  sound.music('explore');
  sound.chime();
  await ui.fade(false, 600);
}

// ---------------------------------------------------------------- footsteps and the night's sounds (legacy 22-audio amb)
let stepAge = 0, ambAge = 0;
const T = { goat: 4, chick: 3, pancha: 2, howl: 40 };
function footstep(): void {
  if (!isOut(cur)) { sound.step('floor'); return; }
  const c = (cur.area as Region).groundColor(player.x, player.z);
  // grey ground is road or concrete; anything browner is dirt
  sound.step(c && Math.abs(c[0] - c[2]) < 26 ? 'hard' : 'dirt');
}
function ambience(): void {
  if (!sound.started || !S || mode === 'title') return;
  const day = time.phase === 'Day';
  sound.setDay(day);
  if (fight.active) return;
  for (const k of Object.keys(T) as Array<keyof typeof T>) T[k] -= 0.38;
  if (!day && Math.random() < 0.5) sound.tone('sine', 4300 + Math.random() * 300, 4300, 0.04, 0.008); // crickets
  const near = (kind: string, r: number): [Actor, number] | null => {
    let best: [Actor, number] | null = null;
    for (const o of cur.roamers) { if (o.kind !== kind) continue; const d = Math.hypot(o.actor.x - player.x, o.actor.z - player.z); if (d < r && (!best || d < best[1])) best = [o.actor, d]; }
    return best;
  };
  if (T.goat <= 0) { T.goat = 5 + Math.random() * 9; const g = near('goat', 11); if (g) sound.goat(0.012 + 0.05 * (1 - g[1] / 11), (g[0].x - player.x) / 8); }
  if (T.chick <= 0) { T.chick = 4 + Math.random() * 6; const c = near('chicken', 8); if (c) sound.chicken(0.01 + 0.035 * (1 - c[1] / 8), (c[0].x - player.x) / 8); }
  if (T.pancha <= 0) {
    T.pancha = 4 + Math.random() * 3;
    if (panchaActor && S.step === 'pancha' && !S.flags.drainDone) { const d = Math.hypot(panchaActor.x - player.x, panchaActor.z - player.z); if (d < 26) sound.goat(0.015 + 0.06 * (1 - d / 26), (panchaActor.x - player.x) / 10); }
  }
  if (T.howl <= 0) { T.howl = 70 + Math.random() * 60; if (!day) sound.howl(); }
}

// ------------------------------------------------------------ the mini map
let mapAge = 0;
let outside: { x: number; z: number; dir: Actor['dir'] } = { x: 0, z: 0, dir: 'S' };
function drawMap(): void {
  if (!isOut(cur)) { minimap.draw(outside.x, outside.z, outside.dir, [], cur.area.title, true); return; }
  outside = { x: player.x, z: player.z, dir: player.dir };
  const marks: MapMark[] = [];
  for (const p of cur.people) marks.push({ x: p.actor.x, z: p.actor.z, kind: 'person' });
  for (const t of cur.area.things) if (t.go && ROOMS[t.go.to]) marks.push({ x: t.x, z: t.z, kind: 'door' });
  const goal = mode === 'play' ? goalPoint() : null;
  if (goal) marks.push({ x: goal[0], z: goal[1], kind: 'goal' });
  const piece = (cur.area as Region).pieceAt(player.x, player.z);
  minimap.draw(player.x, player.z, player.dir, marks, piece?.title ?? cur.area.title);
}

// a debug handle for tests and quick checks (spec §20: prove it by looking)
declare global { interface Window { __LN?: Record<string, unknown> } }
load().then(() => {
  window.__LN = {
    ready: true,
    get pos() { return [player.x, player.z]; },
    get areaId() { return cur.area.id; },
    pieceAtPoint(x: number, z: number) { return isOut(cur) ? (cur.area as Region).pieceAt(x, z)?.id ?? null : null; },
    get piece() { return isOut(cur) ? (cur.area as Region).pieceAt(player.x, player.z)?.id ?? null : null; },
    get doorIssues() { return [...worlds.values()].flatMap((w) => w.issues); },
    get talking() { return ui.talking; },
    get mode() { return mode; },
    get step() { return S.step; },
    get state() { return S; },
    get scripting() { return director.running; },
    stagings: Object.keys(STAGINGS),
    /** Hold a cut on Juno's blow at the Stray (looking at the cut staging without waiting for a turn). */
    cutDemo() { if (!staged || !foes[0]) return; const c = staged.cuts; staged.cuts = true; cutTo(player, foes[0]); staged.cuts = c; if (stageCut) stageCut.until = performance.now() + 120_000; },
    /** Straight into the drain fight in the staging `?battle=` picked (for looking at stagings). */
    battleDemo: () => fightDemo(),
    /** Hold one of the director's shots (for screenshots), or null to let it rotate. */
    directorShot(name: string | null) { direct.hold = name; stageSnap = true; },
    get directorNow() { return direct.hold ?? DIRECTOR.rotation[direct.rot]; },
    get drone() { return drone ? { x: drone.position.x - player.x, y: drone.position.y, z: drone.position.z - player.z, t: lookUp, tilt } : null; },
    get busy() { return busy; },
    get buildMs() { return isOut(cur) ? (cur.area as Region).buildMs : {}; },
    /** What the renderer carries right now (draw calls and triangles of the last frame, geometries and textures on the
     *  GPU) and the JS heap where the browser tells it: for checking that the game holds as it grows. */
    /** What's drawn at a point on the screen (0..1 across and down): for finding where a stray shape comes from. */
    pick(sx: number, sy: number) {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(sx * 2 - 1, 1 - sy * 2), camera);
      return rc.intersectObjects(cur.scene.children, true).filter((h) => h.object.type !== 'Points').slice(0, 5).map((h) => {
        const m = h.object as THREE.Mesh, mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
        const chain: string[] = []; for (let o: THREE.Object3D | null = m; o && chain.length < 5; o = o.parent) chain.push(o.name || o.type);
        return { at: [+h.point.x.toFixed(1), +h.point.y.toFixed(2), +h.point.z.toFixed(1)], type: m.type, geo: m.geometry?.type, color: mat?.color?.getHexString?.(), map: !!mat?.map, chain: chain.join(' < ') };
      });
    },
    async stats() {
      // the renderer's counters reset with every pass (the post passes too): count one whole frame instead
      const r = renderer.info;
      r.autoReset = false; r.reset();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      r.autoReset = true;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      let meshes = 0; cur.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? 0, meshes, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e6) : null, worlds: [...worlds.keys()] };
    },
    get built() { return isOut(cur) ? (cur.area as Region).pieces.map((p) => p.id) : []; },
    get clock() { return time.minute; },
    get phase() { return time.phase; },
    get lit() { return night; },
    /** Set the clock (minutes after midnight); `run` lets it move from there. */
    setClock(m: number, run = false) { time.set(m); time.frozen = !run; shownMinute = -1; showClock(); relight(true); },
    /** Put Juno at (x, z); in the region, the maps around her are built first. */
    async tp(x: number, z: number) {
      if (isOut(cur)) await (cur.area as Region).settle(x, z);
      player.place(x, cur.area.ground(x, z), z); camTarget.copy(clampCam(x, z)); safe = [x, z];
    },
    face(dx: number, dz: number) { player.face(dx, dz); },
    go: (to: string, spawn: string | Spot) => go(to, spawn),
    /** Build every room and return any broken door promise across the whole region. */
    /** Build every map of the region and every room, and return any broken door promise. */
    async checkAllRooms() {
      // each outdoor region in turn (one is built at a time), then every room, then back where Juno was
      const back: [string, Spot] = [cur.id, { x: player.x, z: player.z }];
      const issues: string[] = [];
      for (const id of Object.keys(REGIONS)) {
        if (cur.id !== id) await go(id, REGIONS[id]!.start);
        issues.push(...await (cur.area as Region).checkEach(player.x, player.z));
      }
      for (const id of Object.keys(ROOMS)) if (!worlds.has(id)) await buildWorld(id);
      for (const w of worlds.values()) if (!isOut(w)) issues.push(...w.issues);
      await go(...back);
      return issues;
    },
    rooms: Object.keys(ROOMS),
    blockedAt: (x: number, z: number) => cur.area.blocked(x, z, 0.28),
    /** In the sun's shadow at (x, z), just above head height (near Juno: the shadow map follows her). */
    shadeAt: (x: number, z: number) => shadedFromSun(renderer, cur.lights.sun, new THREE.Vector3(x, cur.area.ground(x, z) + 1.72, z)),
    get shaded() { return shaded; },
    get people() { return cur.people.map((p) => p.npc.id); },
    /** Props shown for a beat of the story (`userData.when`): what each waits on, and whether it shows now. */
    whenProps() { const o: Array<[string, boolean, number, number]> = []; cur.scene.traverse((q) => { if (typeof q.userData.when === 'string') { const v = new THREE.Vector3(); q.getWorldPosition(v); o.push([q.userData.when, q.visible, +v.x.toFixed(1), +v.z.toFixed(1)]); } }); return o; },
    get bellUp() { return !!outWorld()?.scene.getObjectByName('church-bell')?.visible; },
    shadeDebug(x: number, z: number, y: number) { const r = shadedFromSun(renderer, cur.lights.sun, new THREE.Vector3(x, cur.area.ground(x, z) + y, z)); return [r, ...shadeLast]; },
    /**
     * Walk out from Juno over the whole region (every map built) and report anywhere she can reach that she
     * shouldn't: ground past every map's edge, or a road on to a map that isn't built. Empty is clean: every
     * edge she can get to is a physical barrier or a person who turns her back.
     */
    regions: Object.keys(REGIONS),
    /**
     * The prologue checker (the owner, 2026-10-29: "make sure that those paths exist, that the conversation and
     * dialogue exist, that the progression is possible"). Builds every region and room, finds where Juno can walk
     * in each, then walks the prologue on paper (game/progress.ts) down each branch, asking at every step whether
     * the person, thing, spot or road it needs is there at that point in the story, and reachable on foot. Also:
     * every script's targets exist, every marker points at something, every door leads somewhere that leads back.
     */
    async prologueCheck() {
      const problems: string[] = [], notes: string[] = [];
      interface Place { id: string; out: boolean; npcs: NPC[]; things: Thing[]; triggers: Area['triggers']; spawns: Record<string, Spot>; reach: Map<number, number>; pieceAt: (x: number, z: number) => string | null }
      const places = new Map<string, Place>();
      const STEP = 0.5, key = (i: number, j: number): number => (i + 4096) * 8192 + (j + 4096);
      /** Where Juno can walk from `from`, and how far (units, along the grid). */
      const flood = (area: Area, from: Spot, inside: (x: number, z: number) => boolean): Map<number, number> => {
        const d = new Map<number, number>(), q: Array<[number, number]> = [[Math.round(from.x / STEP), Math.round(from.z / STEP)]];
        d.set(key(q[0]![0], q[0]![1]), 0);
        for (let h = 0; h < q.length; h++) {
          const [i, j] = q[h]!, here = d.get(key(i, j))!;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const k = key(i + di, j + dj), x = (i + di) * STEP, z = (j + dj) * STEP;
            if (d.has(k) || !inside(x, z) || area.blocked(x, z, 0.28)) continue;
            d.set(k, here + STEP); q.push([i + di, j + dj]);
          }
        }
        return d;
      };
      /** The walk from the nearest reachable spot within `r` of (x, z), or null. */
      const near = (P: Place, x: number, z: number, r: number): number | null => {
        let best: number | null = null;
        for (let i = Math.floor((x - r) / STEP); i <= Math.ceil((x + r) / STEP); i++) for (let j = Math.floor((z - r) / STEP); j <= Math.ceil((z + r) / STEP); j++) {
          if (Math.hypot(i * STEP - x, j * STEP - z) > r) continue;
          const v = P.reach.get(key(i, j));
          if (v !== undefined && (best === null || v < best)) best = v;
        }
        return best;
      };
      const back: [string, Spot] = [cur.id, { x: player.x, z: player.z }];
      for (const id of Object.keys(REGIONS)) {
        if (cur.id !== id) await go(id, REGIONS[id]!.start);
        const region = cur.area as Region;
        region.hold = true;
        await region.buildAll();
        const start = REGIONS[id]!.start;
        places.set(id, { id, out: true, npcs: [...region.npcs], things: [...region.things], triggers: [...region.triggers], spawns: { ...region.spawns }, reach: flood(region, start, (x, z) => !!region.pieceAt(x, z)), pieceAt: (x, z) => region.pieceAt(x, z)?.id ?? null });
        region.hold = false;
      }
      for (const id of Object.keys(ROOMS)) {
        const w = worlds.get(id) ?? await buildWorld(id);
        const a = w.area, from = a.spawns.door ?? a.spawns.start!;
        places.set(id, { id, out: false, npcs: [...a.npcs], things: [...a.things], triggers: [...a.triggers], spawns: { ...a.spawns }, reach: flood(a, from, () => true), pieceAt: () => null });
      }
      await go(...back);

      // every door leads somewhere, and the way back out lands on a spawn that exists
      for (const P of places.values()) {
        for (const t of P.things) if (t.go) {
          const T = places.get(t.go.to) ?? places.get(regionOf(t.go.to) ?? '');
          if (!T) { problems.push(`${P.id}: "${t.label}" leads to ${t.go.to}, which isn't built`); continue; }
          if (!T.spawns[t.go.spawn] && !T.spawns[`${t.go.to}:${t.go.spawn}`]) problems.push(`${P.id}: "${t.label}" lands on ${t.go.to}:${t.go.spawn}, which isn't a spawn`);
          if (near(P, t.x, t.z, t.r ?? 1.6) === null) problems.push(`${P.id}: "${t.label}" (to ${t.go.to}) can't be reached on foot`);
        }
        if (!P.out) for (const tr of P.triggers) if (tr.go) {
          const T = places.get(tr.go.to);
          if (!T) problems.push(`${P.id}: its way out leads to ${tr.go.to}, which isn't built`);
          else if (!T.spawns[tr.go.spawn]) problems.push(`${P.id}: its way out lands on ${tr.go.to}:${tr.go.spawn}, which isn't a spawn`);
        }
      }
      // every marker points at someone or something that's there, or a place inside a map
      const named = (m: unknown): void => {
        if (m === null || m === undefined) return;
        if (Array.isArray(m)) { if (!regionAt(m[0] as number, m[1] as number)) problems.push(`marker [${m.join(', ')}] is outside every map`); return; }
        if (typeof m === 'object') { for (const v of Object.values(m as Record<string, unknown>)) named(v); return; }
        const id = String(m), all = [...places.values()];
        if (id.startsWith('npc:') && !all.some((P) => P.npcs.some((n) => n.id === id.slice(4))) && id !== 'npc:kit') problems.push(`marker ${id}: nobody by that name anywhere`);
        if (id.startsWith('i:') && !all.some((P) => P.things.some((t) => t.script === id.slice(2)))) problems.push(`marker ${id}: nothing with that script anywhere`);
      };
      for (const st of Object.values(STEPS)) named(st.marker);

      /** Is what this part of the step needs there, at this point in the story, and can Juno get to it? */
      const place = (v: import('./game/progress').Via, s: GameState): string | null => {
        const ok = (when?: string): boolean => !when || condOf(Q, s, when);
        const where = [...places.values()].filter((P) => (v.room ? P.id === v.room : v.piece ? P.out && [...P.reach.keys()].length > 0 && Object.keys(P.spawns).some((k) => k.startsWith(`${v.piece}:`)) : P.out));
        if (!where.length) return `nowhere is ${v.room ?? v.piece}`;
        if (v.npc) {
          if (v.npc === 'kit' && s.joined.includes('kit')) return null; // walking with her
          for (const P of where) for (const n of P.npcs) {
            if (n.id !== v.npc || !ok(n.when) || (v.day && P.out && !n.allDay)) continue;
            const d = near(P, n.x, n.z, 1.6);
            if (d !== null) { if (v.day) notes.push(`${s.step}: ${n.name} is ${Math.round(d)} units' walk from ${P.id}'s start`); return null; }
            return `${n.name} is in ${P.id} at (${n.x.toFixed(1)}, ${n.z.toFixed(1)}) but can't be reached on foot`;
          }
          return `nobody called ${v.npc} is in ${v.room ?? 'the open'} now${v.day ? ' by day' : ''}`;
        }
        if (v.thing) {
          for (const P of where) for (const t of P.things) {
            if (t.script !== v.thing || !ok(t.when)) continue;
            return near(P, t.x, t.z, t.r ?? 1.6) !== null ? null : `"${t.label}" in ${P.id} can't be reached on foot`;
          }
          return `no ${v.thing} in ${v.room ?? 'the open'} now`;
        }
        if (v.zone) {
          for (const P of where) for (const tr of P.triggers) {
            if (tr.script !== v.zone || !ok(tr.when)) continue;
            for (let x = tr.x0; x <= tr.x1; x += STEP) for (let z = tr.z0; z <= tr.z1; z += STEP) if (near(P, x, z, STEP) !== null) return null;
            return `the ${v.zone} spot in ${P.id} can't be walked into`;
          }
          return `no ${v.zone} spot in ${v.room ?? 'the open'} now`;
        }
        if (v.exit) {
          for (const P of where) for (const tr of P.triggers) {
            if (tr.go?.to !== v.exit) continue;
            const cx = (tr.x0 + tr.x1) / 2, cz = (tr.z0 + tr.z1) / 2;
            const held = P.npcs.find((n) => n.guard && Math.hypot((n.guard.x0 + n.guard.x1) / 2 - cx, (n.guard.z0 + n.guard.z1) / 2 - cz) < 10 && !(n.guard.unless && condOf(Q, s, n.guard.unless)));
            if (held) return `${held.name} still holds the line across the road to ${v.exit}`;
            for (let x = tr.x0; x <= tr.x1; x += STEP) for (let z = Math.max(tr.z0, -1); z <= tr.z1; z += STEP) if (near(P, x, z, 1.0) !== null) return null;
            return `the road to ${v.exit} can't be walked onto`;
          }
          return `no road to ${v.exit}`;
        }
        if (v.code === 'arrive' && v.room && !places.has(v.room)) return `no room ${v.room}`;
        return null;
      };
      const walks: Array<[string, string[]]> = [['Güero found', []], ['Güero lost (the white takes Juno searching)', ['n3_search']], ['Güero found, Juno faints on the way home', ['n3_home']]];
      const logs: Record<string, string[]> = {};
      for (const [name, faintAt] of walks) {
        const p: Paper = { s: newState({ world: SPAN, ...START, face: 'N' }), log: [], problems: [], went: [] };
        walk(Q, DIALOGUE as unknown as Dialogue, CATALOG, p, { faintAt, place });
        if (p.s.step !== 'free') p.problems.push(`stops at ${p.s.step} and never reaches the end`);
        for (const m of p.problems) problems.push(`${name}: ${m}`);
        for (const w of p.went) if (!places.has(w)) problems.push(`${name}: a script goes to ${w}, which isn't built`);
        logs[name] = p.log;
      }
      problems.push(...lint(Q, DIALOGUE as unknown as Dialogue, CATALOG, ['drainStarted', 'drainDone', 'night', 'drone_down']));
      // the white, night three: there and back from Mar Farm in the open, against what water and health can take
      const span = places.get(SPAN)!, hatchAt = span.spawns['seven-flags:hatch'];
      // Güero is wherever he waits on night three (out east, past the hub's edge): Mar Farm to that place's way in,
      // then on to him; walks measured while every map was built
      const P3 = [...places.values()].find((P) => P.out && P.npcs.some((n) => n.id === 'guero'));
      const g = P3?.npcs.find((n) => n.id === 'guero');
      if (P3 && g && hatchAt) {
        const gate = P3 === span ? null : gateTo(SPAN, P3.id);
        const leg1 = gate ? near(span, gate[0], gate[1], 1.6) : 0, leg2 = near(P3, g.x, g.z, 1.6);
        const out = leg1 === null || leg2 === null ? null : leg1 + leg2, hatchFromHome = near(span, hatchAt.x, hatchAt.z, 1.0);
        if (out === null || hatchFromHome === null) problems.push('night three: Güero or the hatch can\'t be walked to from Mar Farm');
        else {
          // the walk back is no longer than out and on to the hatch
          const trip = out * 2 + hatchFromHome, secs = trip / RUN;
          const per = SUN.dropEvery / SUN.wrapsSlow, budget = 10 * per + Math.ceil(42 / SUN.hurt) * (SUN.hurtEvery / SUN.wrapsSlow);
          notes.push(`night three in the white: at most ${Math.round(trip)} units in the open (${Math.round(secs)} s running, wraps on); full water and health last ${Math.round(budget)} s before she faints`);
          if (secs > budget) problems.push(`night three: the search can't be done running in full sun with full water (${Math.round(secs)} s against ${Math.round(budget)} s)`);
        }
      }
      return { problems, notes, logs };
    },
    async edgeIssues(step = 0.5) {
      const region = outRegion();
      if (!region) return ['no region'];
      region.hold = true;
      await region.buildAll();
      // a way on to another region (the hill, the mall) is a transition: as good as a wall
      const onward = (to: string): boolean => to in REGIONS || !!regionOf(to);
      const gates = region.triggers.filter((tr) => tr.go && onward(tr.go.to));
      const unbuilt = region.triggers.filter((tr) => tr.go && !onward(tr.go.to) && !ROOMS[tr.go.to]);
      const home = REGIONS[region.id]!.start;
      const [sx, sz] = isOut(cur) ? [player.x, player.z] : [home.x, home.z];
      const key = (i: number, j: number): number => (i + 4096) * 8192 + (j + 4096);
      const seen = new Set<number>([key(Math.round(sx / step), Math.round(sz / step))]);
      const todo: Array<[number, number]> = [[Math.round(sx / step), Math.round(sz / step)]];
      const found = new Map<string, [number, number]>();
      while (todo.length) {
        const [i, j] = todo.pop()!;
        const x = i * step, z = j * step;
        // reported once per patch of about 16 units, so one leak reads as one line
        const patch = `${Math.floor(x / 16) * 16},${Math.floor(z / 16) * 16}`;
        if (gates.some((t) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1)) continue; // walked into another region
        if (!region.pieceAt(x, z)) { if (!found.has(`off:${patch}`)) found.set(`off:${patch}`, [x, z]); continue; }
        const tr = unbuilt.find((t) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1);
        if (tr) { const k = `road:${tr.go!.to}`; if (!found.has(k)) found.set(k, [x, z]); continue; }
        if (guardAt(x, z)) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = key(i + di, j + dj);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!region.blocked((i + di) * step, (j + dj) * step, 0.28)) todo.push([i + di, j + dj]);
        }
      }
      region.hold = false;
      return [...found].map(([k, [x, z]]) => `${k.startsWith('off') ? 'off every map' : k} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    },
    /** A map of the current world drawn straight down, north up, `ppu` pixels per unit, with what's placed on it.
     *  For the overview (docs/design/regions/): no fog, no post, the shadow stretched over the whole map. */
    async overview(ppu = 10, bounds?: [number, number, number, number]) {
      const region = isOut(cur) ? (cur.area as Region) : null;
      if (region) { region.hold = true; await region.buildAll(); }
      const [x0, z0, x1, z1] = bounds ?? (region
        ? [Math.min(...region.plan.map((p) => p.ox)), Math.min(...region.plan.map((p) => p.oz)), Math.max(...region.plan.map((p) => p.ox + p.cols)), Math.max(...region.plan.map((p) => p.oz + p.rows))]
        : [0, 0, 20, 14]);
      const W = Math.round((x1 - x0) * ppu), H = Math.round((z1 - z0) * ppu);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const cam = new THREE.OrthographicCamera(-(x1 - x0) / 2, (x1 - x0) / 2, (z1 - z0) / 2, -(z1 - z0) / 2, 1, 200);
      cam.position.set(cx, 80, cz);
      cam.up.set(0, 0, -1);
      cam.lookAt(cx, 0, cz);
      const scene = cur.scene, fog = scene.fog, sun = cur.lights.sun, sc = sun.shadow.camera;
      const keep = { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, far: sc.far, size: sun.shadow.mapSize.x, pr: renderer.getPixelRatio() };
      scene.fog = null;
      const S = Math.max(x1 - x0, z1 - z0) * 0.75;
      Object.assign(sc, { left: -S, right: S, top: S, bottom: -S, far: 260 });
      sc.updateProjectionMatrix();
      sun.shadow.mapSize.set(4096, 4096);
      sun.shadow.map?.dispose(); sun.shadow.map = null;
      cur.lights.follow(new THREE.Vector3(cx, 0, cz));
      sun.position.y *= 4; sun.position.x = cx + (sun.position.x - cx) * 4; sun.position.z = cz + (sun.position.z - cz) * 4;
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      cur.area.update(clock.elapsedTime, new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx, 0, cz));
      renderer.render(scene, cam);
      const img = renderer.domElement.toDataURL('image/webp', 0.9);
      // put everything back
      scene.fog = fog;
      Object.assign(sc, { left: keep.l, right: keep.r, top: keep.t, bottom: keep.b, far: keep.far });
      sc.updateProjectionMatrix();
      sun.shadow.mapSize.set(keep.size, keep.size);
      (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose(); sun.shadow.map = null;
      renderer.setPixelRatio(keep.pr);
      resize();
      if (region) region.hold = false;
      const a = cur.area;
      return {
        img, w: W, h: H, bounds: [x0, z0, x1, z1], ppu,
        pieces: region?.plan.map((p) => ({ id: p.id, title: p.title, sub: p.sub, x: p.ox, z: p.oz, w: p.cols, h: p.rows })) ?? [],
        things: a.things.map((t) => ({ label: t.label, x: t.x, z: t.z, go: t.go?.to ?? null, lines: t.lines ?? [] })),
        npcs: a.npcs.map((n) => ({ name: n.name, x: n.x, z: n.z })),
        exits: a.triggers.filter((t) => t.go).map((t) => ({ to: t.go!.to, x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2 })),
        spawns: a.spawns,
      };
    },
  };
  document.getElementById('boot')?.remove();
}).catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Something went wrong while building the world: ' + (e as Error).message;
});
requestAnimationFrame(frame);
