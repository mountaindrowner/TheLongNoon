import * as THREE from 'three';
import './styles/fonts.css';
import './styles/ui.css';
import { createPost } from './engine/post';
import { applyMood, moodPost, moodAt, type Lights, type Mood } from './engine/mood';
import { beginArea } from './engine/world';
import { checkDoors, clearDoorMarks } from './engine/doorway';
import { buildRegion, type Region } from './engine/region';
import { UI } from './engine/ui';
import type { Area, NPC, Spot, Thing } from './engine/area';
import { Actor } from './game/actors';
import { Clock, fmtTime, parseClock } from './game/clock';
import { SKY } from './regions/span/moods';
import { fadeOccluders, swaySpan } from './regions/span/props';
import { SPAN, spanRegion, spanRooms, UNBUILT } from './regions/span/region';

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
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (!e.repeat && ['KeyE', 'Space', 'Enter', 'KeyZ'].includes(e.code)) aQueued = true;
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
  people: Array<{ npc: NPC; actor: Actor }>;
  roamers: Array<{ actor: Actor; area: [number, number, number, number]; speed: number; tx: number | null; tz: number; wait: number }>;
  tint: THREE.Color;
  issues: string[];
}
let ROOMS = spanRooms(night);
const worlds = new Map<string, World>();
let cur: World;
let player: Actor;
let loaded = false;
let busy = false;

async function buildWorld(id: string): Promise<World> {
  const scene = new THREE.Scene();
  let area: Area, issues: string[];
  if (id === SPAN) {
    beginArea();
    const region = await buildRegion(scene, night, spanRegion(sky(), night));
    area = region;
    issues = region.doorIssues;
  } else {
    clearDoorMarks();
    area = await ROOMS[id]!(scene, night);
    issues = checkDoors(area);
  }
  for (const issue of issues) console.warn('[door promise]', issue);
  const lights = applyMood(scene, renderer, post, area.mood);
  const tint = new THREE.Color().setRGB(...area.mood.sprite);
  const w: World = { id, scene, area, lights, people: [], roamers: [], tint, issues };
  for (const npc of area.npcs) {
    const a = await Actor.person(npc.sprite, tint);
    a.place(npc.x, area.ground(npc.x, npc.z), npc.z);
    a.dir = npc.face ?? 'S';
    scene.add(a.root);
    w.people.push({ npc, actor: a });
  }
  for (const r of area.roamers ?? []) {
    const a = await Actor.critter(r.sprite, tint, r.height);
    a.place(r.x, area.ground(r.x, r.z), r.z);
    scene.add(a.root);
    w.roamers.push({ actor: a, area: r.area, speed: r.speed, tx: null, tz: 0, wait: Math.random() * 3 });
  }
  worlds.set(id, w);
  return w;
}

function placeAt(s: Spot): void {
  player.place(s.x, cur.area.ground(s.x, s.z), s.z);
  if (s.face) player.face(s.face === 'W' ? -1 : s.face === 'E' ? 1 : 0, s.face === 'N' ? -1 : s.face === 'S' ? 1 : 0);
  camTarget.copy(clampCam(player.x, player.z));
  camera.position.copy(camTarget).add(CAM_OFFSET);
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
    const w = await buildWorld(SPAN);
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
async function go(to: string, spawn: string): Promise<void> {
  busy = true;
  ui.showPrompt(null);
  await ui.dissolve(true);
  const w = worlds.get(to) ?? (await buildWorld(to));
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
  ui.badge(`<b>${fmtTime(m)}</b><span>${time.phase}</span>`);
}
async function load(): Promise<void> {
  player = await Actor.person('juno', new THREE.Color(1, 1, 1));
  const w = await buildWorld(SPAN);
  enter(w, 'start');
  showClock();
  ui.titleCard('THE SPAN', 'A town that stayed');
  lastPiece = (cur.area as Region).pieceAt(player.x, player.z)?.id ?? '';
  loaded = true;
}

function clampCam(x: number, z: number): THREE.Vector3 {
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
    ui.say({ name: npc.name, portrait: await actor.card(), lines: npc.lines ?? ['…'] }, () => { actor.dir = npc.face ?? actor.dir; });
    return;
  }
  const t = tg.t;
  player.face(t.x - player.x, t.z - player.z);
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

  // the clock: stopped while people talk or the screen is changing (legacy: it only runs while exploring)
  if (!ui.talking && !busy) {
    time.tick(dt);
    showClock();
    if (time.lit !== night) void turnOfDay(time.lit);
    else if ((lightAge += dt) > 0.2) { lightAge = 0; relight(); }
  }

  const a = aQueued || ui.takeA();
  aQueued = false;
  if (ui.talking) { if (a) ui.advance(); }
  else if (!busy) {
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
  camTarget.lerp(clampCam(player.x, player.z), 1 - Math.exp(-dt * 4.5));
  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
  cur.lights.follow(player.root.position);
  if (cur.id === SPAN) { fadeOccluders(player.x, player.z, dt); swaySpan(t); }

  // tilt-shift: the sharp band tracks the player's height on screen (spec §4)
  v.set(player.x, player.root.position.y + 0.8, player.z).project(camera);
  focusY += ((v.y * 0.5 + 0.5) - focusY) * (1 - Math.exp(-dt * 6));
  post.tiltH.uniforms.focus!.value = focusY;
  post.tiltV.uniforms.focus!.value = focusY;

  area.update(t, player.root.position, camTarget);
  post.tick(t);
  post.composer.render();
}

// a debug handle for tests and quick checks (spec §20: prove it by looking)
declare global { interface Window { __LN?: Record<string, unknown> } }
load().then(() => {
  window.__LN = {
    ready: true,
    get pos() { return [player.x, player.z]; },
    get areaId() { return cur.area.id; },
    get piece() { return cur.id === SPAN ? (cur.area as Region).pieceAt(player.x, player.z)?.id ?? null : null; },
    get doorIssues() { return [...worlds.values()].flatMap((w) => w.issues); },
    get talking() { return ui.talking; },
    get busy() { return busy; },
    get clock() { return time.minute; },
    get phase() { return time.phase; },
    get lit() { return night; },
    /** Set the clock (minutes after midnight); `run` lets it move from there. */
    setClock(m: number, run = false) { time.set(m); time.frozen = !run; shownMinute = -1; showClock(); relight(true); },
    tp(x: number, z: number) { player.place(x, cur.area.ground(x, z), z); camTarget.copy(clampCam(x, z)); safe = [x, z]; },
    face(dx: number, dz: number) { player.face(dx, dz); },
    go: (to: string, spawn: string) => go(to, spawn),
    /** Build every room and return any broken door promise across the whole region. */
    async checkAllRooms() { for (const id of Object.keys(ROOMS)) if (!worlds.has(id)) await buildWorld(id); return [...worlds.values()].flatMap((w) => w.issues); },
    rooms: Object.keys(ROOMS),
  };
  document.getElementById('boot')?.remove();
}).catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Something went wrong while building the world: ' + (e as Error).message;
});
requestAnimationFrame(frame);
