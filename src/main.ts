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
import { Actor } from './game/actors';
import { Clock, fmtTime, parseClock } from './game/clock';
import { Director, type Cmd, type Dialogue, type Script, type Stage } from './game/script';
import { Hud, type Page } from './game/hud';
import { Tale } from './game/tale';
import { campfire } from './game/fire';
import { Sound } from './game/sound';
import { Fight, type FightDef, type UnitDef } from './game/battle';
import BATTLES from './game/data/battles.json';
import { newState, save as writeSave, load as readSave, hasSave, ITEM_NAMES, type GameState } from './game/state';
import DIALOGUE from './game/data/dialogue.json';
import QUESTS from './game/data/quests.json';
import PAGES from './game/data/pages.json';
import { SKY } from './regions/span/moods';
import { fadeOccluders, swaySpan } from './regions/span/props';
import { SPAN, START, spanRegion, spanRooms, UNBUILT } from './regions/span/region';

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
let player: Actor;
let loaded = false;
let busy = false;

async function buildWorld(id: string, at?: Spot): Promise<World> {
  const scene = new THREE.Scene();
  let area: Area, issues: string[];
  if (id === SPAN) {
    beginArea();
    const region = await buildRegion(scene, night, spanRegion(sky(), night, at));
    area = region;
    issues = region.doorIssues;
  } else {
    // a map half-built in the region shares the builders' state; let it finish first
    await (worlds.get(SPAN)?.area as Region | undefined)?.idle();
    clearDoorMarks();
    area = await ROOMS[id]!(scene, night);
    issues = checkDoors(area);
  }
  for (const issue of issues) console.warn('[door promise]', issue);
  const lights = applyMood(scene, renderer, post, area.mood);
  const tint = new THREE.Color().setRGB(...area.mood.sprite);
  const w: World = { id, scene, area, lights, people: [], roamers: [], tint, issues };
  if (id === SPAN) {
    // the region streams: its people and animals come and go with their maps
    const region = area as Region;
    for (const b of region.pieces) await populate(w, b.npcs, b.roamers ?? [], b.id);
    region.onChange = (added, removed) => {
      if (removed) unpopulate(w, removed.id);
      if (added) { void populate(w, added.npcs, added.roamers, added.id); minimap.addPiece(added); remember(added.things, added.npcs); }
    };
    for (const b of region.pieces) remember(b.things, b.npcs);
    void minimap.setRegion(region, at ?? region.spawns.start!);
  } else await populate(w, area.npcs, area.roamers ?? [], id);
  worlds.set(id, w);
  return w;
}

async function populate(w: World, npcs: NPC[], roamers: NonNullable<Area['roamers']>, tag: string): Promise<void> {
  for (const npc of npcs) {
    if (npc.id === 'kit' && S && (S.flags.drainStarted || S.joined.includes('kit'))) continue;
    const a = await Actor.person(npc.sprite, w.tint);
    a.place(npc.x, w.area.ground(npc.x, npc.z), npc.z);
    a.dir = npc.face ?? 'S';
    w.scene.add(a.root);
    w.people.push({ npc, actor: a, tag });
  }
  for (const r of roamers) {
    const a = await Actor.critter(r.sprite, w.tint, r.height);
    a.place(r.x, w.area.ground(r.x, r.z), r.z);
    w.scene.add(a.root);
    w.roamers.push({ actor: a, kind: r.sprite, area: r.area, speed: r.speed, tx: null, tz: 0, wait: Math.random() * 3, tag });
  }
}
function unpopulate(w: World, tag: string): void {
  for (const p of w.people.filter((q) => q.tag === tag)) w.scene.remove(p.actor.root);
  for (const r of w.roamers.filter((q) => q.tag === tag)) w.scene.remove(r.actor.root);
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
  if (w.id === SPAN) relight(true);
  player.setTint(w.tint);
  placeAt(typeof spawn === 'string' ? w.area.spawns[spawn] ?? w.area.spawns.start! : spawn);
  bringCast(w);
}

// ------------------------------------------------------------ the clock moving the light
let lightAge = 0;
/** Outdoors, the light follows the clock: the mood, and the tint on every sprite. Rooms keep their own lamps. */
function relight(force = false): void {
  if (cur.id !== SPAN || (time.frozen && !force)) return;
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
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) mat.dispose();
  });
}

/** Lamp and the white change the town itself (lanterns lit or not, doors, windows), so it is rebuilt in the other
 *  state behind a dissolve. Inside a room nothing shows; the town is rebuilt when you step back out. */
async function turnOfDay(lit: boolean): Promise<void> {
  busy = true;
  night = lit;
  ROOMS = spanRooms(night);
  const here = cur;
  const outdoors = here.id === SPAN;
  if (outdoors) { ui.showPrompt(null); await ui.dissolve(true); }
  for (const w of [...worlds.values()]) if (w !== here) { dispose(w); worlds.delete(w.id); }
  if (outdoors) {
    worlds.delete(SPAN);
    const at: Spot = { x: player.x, z: player.z };
    const w = await buildWorld(SPAN, at);
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
  const w = worlds.get(to) ?? (await buildWorld(to));
  if (to === SPAN) await (typeof spawn === 'string' ? (w.area as Region).prepare(spawn) : (w.area as Region).settle(spawn.x, spawn.z));
  enter(w, spawn);
  if (staleRoom && staleRoom !== w) { dispose(staleRoom); staleRoom = null; }
  lastPiece = '';
  await ui.dissolve(false);
  if (to !== SPAN) ui.nameTag(w.area.title, w.area.sub);
  busy = false;
}

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
  if (TEST) {
    // straight into the town, for playtests and screenshots: free roam, or the mission step asked for
    S.step = STEP ?? 'free';
    if (STEP) catchUp(STEP);
    mode = 'play';
    hud.show(true);
    showObjective(false);
    if (STEP === 'burial') void burial();
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
  for (const t of cur.area.things) { const d = Math.hypot(t.x - player.x, t.z - player.z); if (d < (t.r ?? 1.6) && d < bd) { bd = d; best = { kind: 'thing', t }; } }
  return best;
}

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
let safe: [number, number] = [0, 0];
async function checkTriggers(): Promise<void> {
  for (const tr of cur.area.triggers) {
    if (!tr.go || player.x < tr.x0 || player.x > tr.x1 || player.z < tr.z0 || player.z > tr.z1) continue;
    if (tr.go.to === SPAN || ROOMS[tr.go.to]) { await go(tr.go.to, tr.go.spawn); return; }
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
function frame(): void {
  requestAnimationFrame(frame);
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
  hud.update(S, fmtTime(time.minute), time.phase);

  const a = aQueued || ui.takeA();
  aQueued = false;
  if (ui.talking) { if (a) ui.advance(); }
  else if (free()) {
    const m = moveInput();
    const l = Math.hypot(m.x, m.z);
    player.moving = l > 0.12;
    if (player.moving) {
      const sp = (m.run ? RUN : SPEED) * Math.min(1, l);
      const nx = player.x + m.x * sp * dt, nz = player.z + m.z * sp * dt;
      const px = area.blocked(nx, player.z, 0.28) ? player.x : nx;
      const pz = area.blocked(px, nz, 0.28) ? player.z : nz;
      player.face(m.x, m.z);
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
  } else { player.moving = false; player.animate(dt); }

  // crossing from one section of the region into the next: just the name tag, no cut
  if (cur.id === SPAN) {
    const p = (area as Region).pieceAt(player.x, player.z);
    if (p && p.id !== lastPiece) { if (lastPiece) ui.nameTag(p.title, p.sub); lastPiece = p.id; }
  }

  for (const p of cur.people) p.actor.animate(dt);
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
  camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, camZoom);
  camera.lookAt(camTarget);
  if (tilt > 0.001) { camera.position.y -= tilt * 8; camera.lookAt(v.set(camTarget.x, camTarget.y + tilt * 17, camTarget.z - tilt * 30)); }
  cur.lights.follow(player.root.position);
  if (cur.id === SPAN) { fadeOccluders(player.x, player.z, dt); swaySpan(t); }

  // tilt-shift: the sharp band tracks the player's height on screen (spec §4)
  v.set(player.x, player.root.position.y + 0.8, player.z).project(camera);
  focusY += ((v.y * 0.5 + 0.5) - focusY) * (1 - Math.exp(-dt * 6));
  post.tiltH.uniforms.focus!.value = focusY;
  post.tiltV.uniforms.focus!.value = focusY;
  // looking up at the sky, the diorama blur would smear it: the band opens to the whole frame
  post.tiltH.uniforms.band!.value = post.tiltV.uniforms.band!.value = 0.1 + tilt * 0.9;

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
const STEP = params.get('step');
const TEST = held !== undefined || params.has('clock') || STEP !== null;
const STEPS = QUESTS.steps as unknown as Record<string, { obj: string; marker: string | [number, number] | null }>;
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
};
let aborting = false;
const stage: Stage = {
  async say(name, text) { const id = PORTRAIT[name]; await ui.speak(name, text, id ? await Actor.portrait(id) : undefined); },
  choose: (q, opts) => ui.choose(q, opts),
  endTalk: () => ui.endTalk(),
  aborted: () => aborting,
  command: (c) => command(c),
};
const director = new Director(DIALOGUE as unknown as Dialogue, STEPS, () => S, stage);
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
    case 'take': S.items[c.id as string] = Math.max(0, (S.items[c.id as string] ?? 0) - (c.n as number)); break;
    case 'white': sound.coin(); S.white += c.add as number; hud.toast(`+${c.add as number} tins of white`, true); break;
    case 'water':
      sound.pour();
      S.water = c.set != null ? (c.set as number) : Math.min(10, S.water + (c.add as number));
      hud.toast(c.set != null ? 'Water topped off' : `+${c.add as number} water`);
      break;
    case 'page': await unlockPage(String(c.n)); break;
    case 'step': setStep(c.to as string); break;
    case 'flag': S.flags[c.f as string] = true; break;
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
    default: console.warn('[script] unknown command:', c.do);
  }
}

/** Start at a later step with what the steps before it would have given (playtests: `?step=`). */
function catchUp(step: string): void {
  const order = Object.keys(STEPS), at = order.indexOf(step), past = (k: string): boolean => at > order.indexOf(k);
  if (past('burial')) { S.items.staybook = 1; S.pages.push('1'); }
  if (past('home')) { Object.assign(S.flags, { fed: true, tank: true }); S.water = 10; S.items.milk = 2; S.pages.push('3'); }
  if (past('market')) { S.white = 2; S.items.milk = 0; S.pages.push('2'); }
  if (past('pancha')) {
    Object.assign(S.flags, { drainStarted: true, drainDone: true });
    S.joined.push('kit'); S.pages.push('5');
    Object.assign(S.items, { scrap: 4, cell: 1, bearings: 6 });
  }
}

function setStep(to: string): void {
  S.step = to;
  showObjective(true);
  if (to !== 'burial') sound.chime();
  void bringCast(cur);
  if (to !== 'burial') saveGame(true);
}
function showObjective(flash: boolean): void { hud.objective(QUESTS.mission, STEPS[S.step]?.obj ?? '', flash); }

async function unlockPage(key: string): Promise<void> {
  if (!S.pages.includes(key)) S.pages.push(key);
  sound.page();
  await hud.openBook(PAGES as Record<string, Page>, S.pages, key, true);
}
async function openBook(): Promise<void> {
  if (!S.pages.length) { hud.toast('The staybook is empty.'); return; }
  sound.page();
  const have = ['1', '2', '3', '5', 'last'].filter((k) => S.pages.includes(k));
  await hud.openBook(PAGES as Record<string, Page>, S.pages, have[have.length - 1]!, false);
}

// ---------------------------------------------------------------- where the story's things are
/** The last place each scripted thing and person was seen (maps stream, the marker still needs them). */
const known = new Map<string, [number, number]>();
function remember(things: Thing[], npcs: NPC[]): void {
  for (const t of things) if (t.script) known.set(`i:${t.script}`, [t.x, t.z]);
  for (const n of npcs) known.set(`npc:${n.id}`, [n.x, n.z]);
}
function goalPoint(): [number, number] | null {
  const m = STEPS[S.step]?.marker;
  if (!m) return null;
  if (Array.isArray(m)) return m;
  if (m === 'homeTasks') return S.flags.fed && S.flags.tank ? null : known.get(S.flags.fed ? 'i:tank' : 'i:pen') ?? null;
  if (m.startsWith('npc:')) { const p = cur.people.find((q) => q.npc.id === m.slice(4)); return p ? [p.actor.x, p.actor.z] : known.get(m) ?? null; }
  return known.get(m) ?? null;
}
function markGoal(): void {
  const g = mode === 'play' && cur.id === SPAN && free() ? goalPoint() : null;
  if (!g || Math.hypot(player.x - g[0], player.z - g[1]) < 2.4) { hud.mark(null); return; }
  v.set(g[0], cur.area.ground(g[0], g[1]) + 2.1, g[1]).project(camera);
  hud.mark({ x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 });
}

// ---------------------------------------------------------------- the white: daylight costs water (legacy 16-exploration)
let exposure = 0, thirst = 0, fainting = false;
function weather(dt: number): void {
  if (time.frozen || fainting) { hud.warning(null); return; }
  const ph = time.phase;
  const door = known.get('i:door');
  const sheltered = cur.id !== SPAN || (!!door && Math.hypot(player.x - door[0], player.z - door[1]) < 3.4);
  if (ph === 'Shutter' && S.flags.shutterWarn !== S.day) { S.flags.shutterWarn = S.day; hud.toast('Shutter. Get under a roof before the white.', true, 4200); }
  if (ph === 'Day' && !sheltered) {
    hud.warning('Daylight. Your water is burning.');
    if ((exposure += dt) > 3.5) { exposure = 0; S.water = Math.max(0, S.water - 1); sound.hurt(); if (S.water === 0) void faint(); }
  } else hud.warning(ph === 'Shutter' && !sheltered ? 'Shutter. Find a roof.' : null);
  if ((thirst += dt) > 150) { thirst = 0; if (S.water > 1) S.water--; }
}

/** Out in the white with no water: you wake at home the next Lamp, one tin of white poorer. */
async function faint(): Promise<void> {
  fainting = true;
  hud.warning(null);
  await ui.fade(true, 900, '#f4f0e6');
  await run('faint');
  S.day++; S.water = 3; S.white = Math.max(0, S.white - 1);
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
  S.party.juno.hp = 42; S.party.kit.hp = 26;
  saveGame(true);
  await sleep(350);
  await ui.fade(false, 500);
  hud.toast('Rested. Game saved.', true);
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
  await go(w.world in ROOMS || w.world === SPAN ? w.world : SPAN, { x: w.x, z: w.z, face: w.face });
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
  if (S.flags.drainStarted || joined) for (const p of w.people.filter((q) => q.npc.id === 'kit')) { w.scene.remove(p.actor.root); w.people.splice(w.people.indexOf(p), 1); }
  else if (w.id === SPAN && !w.people.some((q) => q.npc.id === 'kit')) {
    const def = w.area.npcs.find((n) => n.id === 'kit'), piece = def && (w.area as Region).pieceAt(def.x, def.z);
    if (def && piece) await populate(w, [def], [], piece.id);
  }
  if (joined || (S.flags.drainStarted && !drainDone)) kitActor ??= await Actor.person('kit', w.tint);
  else if (kitActor) { kitActor.root.parent?.remove(kitActor.root); kitActor = null; }
  const pancha = (S.step === 'pancha' && w.id === SPAN) || drainDone;
  if (pancha) panchaActor ??= await Actor.critter('goat', w.tint, 0.62);
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
  blind(a) { const i = foes.indexOf(a); if (i >= 0) void Actor.critter('strayBroken', cur.tint, 1.15).then((b) => { b.place(a.x, a.root.position.y, a.z); cur.scene.remove(a.root); cur.scene.add(b.root); foes[i] = b; }); (cur.area as Region).dropLamps('stray'); },
  dead() { (cur.area as Region).dropLamps('stray'); },
  touch: touchUI(),
});

/** Something rolls out of the culvert's dark mouth, and a coyote after it. Everyone takes their places. */
async function spawnEnemies(): Promise<void> {
  await bringCast(cur);
  const g = (x: number, z: number): number => cur.area.ground(x, z);
  player.place(AT.juno[0], g(AT.juno[0], AT.juno[1]), AT.juno[1]); player.dir = 'N';
  if (kitActor) { kitActor.place(AT.kit[0], g(AT.kit[0], AT.kit[1]), AT.kit[1]); kitActor.dir = 'N'; cur.scene.add(kitActor.root); }
  for (const [kind, h, to] of [['stray', 1.15, AT.stray], ['coyote', 0.8, AT.coyote]] as const) {
    const a = await Actor.critter(kind, cur.tint, h);
    a.place(AT.culvert[0], g(AT.culvert[0], AT.culvert[1]), AT.culvert[1]);
    cur.scene.add(a.root);
    foes.push(a);
    void to;
  }
  // the Stray's one red eye
  const eye = new THREE.Vector3(AT.stray[0], g(AT.stray[0], AT.stray[1]) + 0.9, AT.stray[1] + 0.4);
  (cur.area as Region).addLamp({ pos: eye, color: new THREE.Color('#ff4a2a'), intensity: 2.2, dist: 5, flicker: 0.1, tag: 'stray' });
  sound.servo(); setTimeout(() => sound.beep(), 500); setTimeout(() => sound.growl(), 900);
  await Promise.all(foes.map(async (a, i) => {
    const to = i === 0 ? AT.stray : AT.coyote;
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
}

async function battle(): Promise<'win' | 'load'> {
  const B = BATTLES as unknown as { drain: FightDef; units: Record<string, UnitDef> };
  sound.battleStart();
  sound.music('combat');
  minimap.hidden = true;
  for (let retry = false; ; retry = true) {
    const r = await fight.fight(B.drain, B.units, { juno: player, kit: kitActor! }, foes, retry);
    if (r === 'win') break;
    if (r === 'load') { clearFoes(); camHold = null; minimap.hidden = false; await loadGame(); return 'load'; }
    for (const a of foes) a.root.visible = true;
  }
  S.flags.drainDone = true;
  minimap.hidden = false;
  await ui.fade(true, 450);
  clearFoes();
  await bringCast(cur);
  if (kitActor) { kitActor.place(player.x + 0.9, cur.area.ground(player.x + 0.9, player.z + 0.4), player.z + 0.4); kitActor.dir = 'W'; }
  if (panchaActor) panchaActor.place(player.x + 1.6, cur.area.ground(player.x + 1.6, player.z + 0.9), player.z + 0.9);
  sound.music('explore');
  await ui.fade(false, 600);
  camHold = null;
  return 'win';
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

/** Home before Shutter: the doors sealed, the day, the drone, the last page, the end card. */
async function ending(): Promise<void> {
  sound.creak();
  sound.music('none');
  await ui.fade(true, 800);
  await stage.say('', 'Shutter. Doors sealed. The Span sleeps through the heat.');
  ui.endTalk();
  S.party.juno.hp = 42; S.party.kit.hp = 26;
  S.day++;
  await setTime(6 * 60 + 50);
  await go(SPAN, 'seven-flags:home');
  await bringCast(cur);
  await ui.fade(true, 0);
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
  if (!S.pages.includes('last')) S.pages.push('last');
  ui.endTalk();
  sound.music('intro');
  for (;;) {
    const a = await hud.endCard();
    if (a === 'read') { await hud.openBook(PAGES as Record<string, Page>, S.pages, 'last', true); continue; }
    await afterEnding();
    if (a === 'title') await titleScreen();
    return;
  }
}
/** First mission complete: the next Lamp, Kit and Pancha with you, the Span yours to walk. */
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
  if (cur.id !== SPAN) { sound.step('floor'); return; }
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
  if (cur.id !== SPAN) { minimap.draw(outside.x, outside.z, outside.dir, [], cur.area.title, true); return; }
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
    pieceAtPoint(x: number, z: number) { return cur.id === SPAN ? (cur.area as Region).pieceAt(x, z)?.id ?? null : null; },
    get piece() { return cur.id === SPAN ? (cur.area as Region).pieceAt(player.x, player.z)?.id ?? null : null; },
    get doorIssues() { return [...worlds.values()].flatMap((w) => w.issues); },
    get talking() { return ui.talking; },
    get mode() { return mode; },
    get step() { return S.step; },
    get state() { return S; },
    get scripting() { return director.running; },
    get drone() { return drone ? { x: drone.position.x - player.x, y: drone.position.y, z: drone.position.z - player.z, t: lookUp, tilt } : null; },
    get busy() { return busy; },
    get buildMs() { return cur.id === SPAN ? (cur.area as Region).buildMs : {}; },
    get built() { return cur.id === SPAN ? (cur.area as Region).pieces.map((p) => p.id) : []; },
    get clock() { return time.minute; },
    get phase() { return time.phase; },
    get lit() { return night; },
    /** Set the clock (minutes after midnight); `run` lets it move from there. */
    setClock(m: number, run = false) { time.set(m); time.frozen = !run; shownMinute = -1; showClock(); relight(true); },
    /** Put Juno at (x, z); in the region, the maps around her are built first. */
    async tp(x: number, z: number) {
      if (cur.id === SPAN) await (cur.area as Region).settle(x, z);
      player.place(x, cur.area.ground(x, z), z); camTarget.copy(clampCam(x, z)); safe = [x, z];
    },
    face(dx: number, dz: number) { player.face(dx, dz); },
    go: (to: string, spawn: string) => go(to, spawn),
    /** Build every room and return any broken door promise across the whole region. */
    /** Build every map of the region and every room, and return any broken door promise. */
    async checkAllRooms() {
      const region = worlds.get(SPAN)?.area as Region | undefined;
      const issues = region ? await region.checkEach(player.x, player.z) : [];
      for (const id of Object.keys(ROOMS)) if (!worlds.has(id)) await buildWorld(id);
      for (const w of worlds.values()) if (w.id !== SPAN) issues.push(...w.issues);
      return issues;
    },
    rooms: Object.keys(ROOMS),
    /** A map of the current world drawn straight down, north up, `ppu` pixels per unit, with what's placed on it.
     *  For the overview (docs/design/regions/): no fog, no post, the shadow stretched over the whole map. */
    async overview(ppu = 10, bounds?: [number, number, number, number]) {
      const region = cur.id === SPAN ? (cur.area as Region) : null;
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
