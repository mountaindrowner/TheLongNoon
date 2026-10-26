import * as THREE from 'three';
import './styles/fonts.css';
import './styles/ui.css';
import { createPost } from './engine/post';
import { applyMood, type Lights } from './engine/mood';
import { beginArea } from './engine/world';
import { checkDoors } from './engine/doorway';
import { UI } from './engine/ui';
import type { Area, NPC, Thing } from './engine/area';
import { Actor } from './game/actors';
import { MOODS } from './regions/span/moods';
import { marFarm } from './regions/span/mar-farm';
import { fadeOccluders } from './regions/span/props';

/**
 * The Long Noon, rebuilt on the world style spec (docs/style/world-style-spec.md).
 * This file is the runtime: renderer and camera (§3), post (§4), the mood (§5),
 * walking, talking, exits. Maps live in src/regions; the engine in src/engine.
 */

const params = new URLSearchParams(location.search);
const timeKey = params.get('time') ?? 'lamp';
const mood = MOODS[timeKey] ?? MOODS.lamp!;
const night = timeKey !== 'white' && timeKey !== 'day';
const CLOCK: Record<string, [string, string]> = { lamp: ['7:20 pm', 'Lamp'], night: ['11:40 pm', 'Long night'], white: ['12:10 pm', 'Day'], day: ['5:30 pm', 'Day'] };

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

const scene = new THREE.Scene();
const post = createPost(renderer, scene, camera);
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

// ------------------------------------------------------------ the area
let area: Area;
let lights: Lights;
let player: Actor;
const people: Array<{ npc: NPC; actor: Actor }> = [];
const roamers: Array<{ actor: Actor; area: [number, number, number, number]; speed: number; tx: number | null; tz: number; wait: number }> = [];
const tint = new THREE.Color().setRGB(...mood.sprite);
let doorIssues: string[] = [];
let loaded = false;

async function load(): Promise<void> {
  beginArea();
  area = await marFarm(mood)(scene, night);
  lights = applyMood(scene, renderer, post, area.mood);
  doorIssues = checkDoors(area);
  for (const issue of doorIssues) console.warn('[door promise]', issue);

  player = await Actor.person('juno', tint);
  scene.add(player.root);
  const s = area.spawns.start!;
  player.place(s.x, area.ground(s.x, s.z), s.z);
  player.face(s.face === 'N' ? 0 : s.face === 'W' ? -1 : s.face === 'E' ? 1 : 0, s.face === 'N' ? -1 : 1);

  for (const npc of area.npcs) {
    const a = await Actor.person(npc.sprite, tint);
    a.place(npc.x, area.ground(npc.x, npc.z), npc.z);
    a.dir = npc.face ?? 'S';
    scene.add(a.root);
    people.push({ npc, actor: a });
  }
  for (const r of area.roamers ?? []) {
    const a = await Actor.critter(r.sprite, tint, r.height);
    a.place(r.x, area.ground(r.x, r.z), r.z);
    scene.add(a.root);
    roamers.push({ actor: a, area: r.area, speed: r.speed, tx: null, tz: 0, wait: Math.random() * 3 });
  }
  camTarget.copy(clampCam(player.x, player.z));
  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
  ui.badge(`<b>${CLOCK[timeKey]?.[0] ?? ''}</b><span>${CLOCK[timeKey]?.[1] ?? ''}</span>`);
  ui.titleCard(area.title.toUpperCase(), area.sub);
  loaded = true;
}

function clampCam(x: number, z: number): THREE.Vector3 {
  const c = area.cam;
  return new THREE.Vector3(THREE.MathUtils.clamp(x, c.x0, c.x1), 0.8, THREE.MathUtils.clamp(z, c.z0, c.z1));
}

// ------------------------------------------------------------ talking and looking
type Target = { kind: 'npc'; p: (typeof people)[number] } | { kind: 'thing'; t: Thing };
function nearest(): Target | null {
  let best: Target | null = null, bd = Infinity;
  for (const p of people) { const d = Math.hypot(p.actor.x - player.x, p.actor.z - player.z); if (d < 1.7 && d < bd) { bd = d; best = { kind: 'npc', p }; } }
  for (const t of area.things) { const d = Math.hypot(t.x - player.x, t.z - player.z); if (d < (t.r ?? 1.6) && d < bd) { bd = d; best = { kind: 'thing', t }; } }
  return best;
}

let busy = false;
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
  if (t.script === 'rest') {
    busy = true;
    await ui.fade(true, 600);
    await new Promise((r) => setTimeout(r, 700));
    await ui.fade(false, 600);
    busy = false;
    ui.hint('Rested. <i>(Saving and the clock come in a later piece.)</i>');
    return;
  }
  if (t.lines) ui.say({ lines: t.lines });
}

// ------------------------------------------------------------ exits
const BUILT = new Set(['mar-farm']);
async function checkTriggers(): Promise<void> {
  for (const tr of area.triggers) {
    if (!tr.go || player.x < tr.x0 || player.x > tr.x1 || player.z < tr.z0 || player.z > tr.z1) continue;
    busy = true;
    await ui.dissolve(true);
    if (!BUILT.has(tr.go.to)) {
      // not built yet: turn back at the edge rather than promise a road that isn't there
      const back = area.spawns[area.triggers.indexOf(tr) === 0 ? 'south' : 'west'] ?? area.spawns.start!;
      player.place(back.x, area.ground(back.x, back.z), back.z);
      camTarget.copy(clampCam(player.x, player.z));
      await ui.dissolve(false);
      ui.hint(`The road to <b>${tr.go.to.replace(/-/g, ' ')}</b> isn't built yet.`);
    }
    busy = false;
    return;
  }
}

// ------------------------------------------------------------ frame
const clock = new THREE.Clock();
const SPEED = 3.1, RUN = 5.0;
let focusY = 0.46;
const v = new THREE.Vector3();
function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (!loaded) return;

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

  for (const p of people) p.actor.animate(dt);
  for (const r of roamers) {
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

  // camera: follow the player, clamped so the map edge never shows a void
  camTarget.lerp(clampCam(player.x, player.z), 1 - Math.exp(-dt * 4.5));
  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
  lights.follow(player.root.position);
  fadeOccluders(player.x, player.z, dt);

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
    get areaId() { return area.id; },
    get doorIssues() { return doorIssues; },
    get talking() { return ui.talking; },
    tp(x: number, z: number) { player.place(x, area.ground(x, z), z); camTarget.copy(clampCam(x, z)); },
    face(dx: number, dz: number) { player.face(dx, dz); },
    get player() { return player; },
    get scene() { return scene; },
    stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  };
  document.getElementById('boot')?.remove();
}).catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Something went wrong while building the world: ' + (e as Error).message;
});
requestAnimationFrame(frame);
