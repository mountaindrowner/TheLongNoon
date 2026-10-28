/**
 * The Long Noon's cast from PixelLab, in the spec's locked style (docs/style/world-style-spec.md §13):
 * 64 px, low top-down, 8 directions, every figure made with the anchor (Juno) as its style reference.
 *
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs juno            # the anchor first: look at her before going on
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs                 # everyone not made yet
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs kit --anims     # then their idles and walks
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs --portraits     # bust portraits for the dialogue box (the speakers)
 *   node tools/gen-cast.mjs --plan                             # what it would make and roughly what it costs
 *
 * Who's who and how they're described: tools/cast.json (reviewed in docs/design/cast.md).
 * Writes assets/cast/<id>/: the unzipped character (rotations/, animations/), and prompt.json with the
 * request and character_id. Nothing is made twice: a figure with a prompt.json is skipped (--force remakes it).
 * The anchor's own style comes from PIXELLAB_STYLE_ID (default: the spec's style character, which must be on
 * the same PixelLab account); everyone after it is styled on the anchor.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/cast');
const API = 'https://api.pixellab.ai/v2';
const KEY = process.env.PIXELLAB_API_KEY;
const SPEC_STYLE_ID = 'cea31c61-3b70-4ec6-a617-413b60f80ece'; // §13.2
const FLOOR = Number(process.env.PIXELLAB_FLOOR ?? 1000); // §13: stop before the account's floor
const C = JSON.parse(readFileSync(join(ROOT, 'tools/cast.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const ids = args.filter((a) => !a.startsWith('--'));
const want = ids.length ? ids : Object.keys(C.cast);
for (const id of want) if (!C.cast[id]) throw new Error(`no ${id} in tools/cast.json`);

// rough generation costs (§13.2: about 10 per 8-direction figure; template animations 1 per direction)
const COST = { figure: 15, template: 4, custom: 4, portrait: 17 };
// animations in four directions (the owner, 2026-10-27): front, back and both sides
const DIRS4 = ['south', 'east', 'north', 'west'];
// people walk and breathe on PixelLab's templates; animals on four legs use a quadruped skeleton; the rest are animated from text
const BODY = { person: 'mannequin', goat: 'dog', goat2: 'dog', goat3: 'dog', pancha: 'dog', coyote: 'dog', coyote2: 'dog' };
/** The four-legged skeleton has its own templates (idle, walk, run; no attack). */
const DOG = { idle: 'idle', walk: 'walk-8-frames', run: 'running-8-frames' };
const ANIM = {
  idle: { template: 'breathing-idle', fps: 5 },
  walk: { template: 'walking-8-frames', fps: 11 },
  run: { template: 'running-8-frames', fps: 14 },
  // the fight (the main characters): a stance between turns, a blow, a hit taken, a fall, a drink of water
  stance: { template: 'fight-stance-idle-8-frames', fps: 8 },
  attack: { template: 'attack', fps: 12 },
  throw: { template: 'throw-object', fps: 12 },
  hurt: { template: 'taking-punch', fps: 10 },
  down: { template: 'falling-back-death', fps: 10 },
  drink: { template: 'drinking', fps: 8 },
};
const CUSTOM = {
  juno: { attack: 'swinging a length of steel pipe down hard in front of her with both hands, then back to guard' },
  stray: {
    idle: 'idle: rocking slightly on its six wheels, the red eye pulsing', walk: 'rolling forward on its six wheels, chassis bobbing',
    attack: 'ramming forward hard on its six wheels, red eye flaring bright, then rolling back',
    hurt: 'jolting backward from a heavy hit, sparks and bolts flying from its chassis',
    spark: 'crackling with blue electric arcs all over its chassis, red eye flashing',
  },
  coyote: { attack: 'lunging forward with jaws snapping, then springing back', hurt: 'yelping and recoiling from a hit, tail tucked' },
  coyote2: { attack: 'lunging forward with jaws snapping, then springing back', hurt: 'yelping and recoiling from a hit, tail tucked' },
  chicken: { idle: 'idle: pecking at the ground, head bobbing', walk: 'walking, head bobbing with each step' },
  chicken2: { idle: 'idle: pecking at the ground, head bobbing', walk: 'walking, head bobbing with each step' },
  chicken3: { idle: 'idle: puffing up, head bobbing', walk: 'strutting, head bobbing with each step' },
  keeper: { idle: 'idle: sweeping the ground slowly with its broom, swaying on its base', walk: 'rolling forward on its base, broom held out' },
  hauler: { idle: 'idle: idling, beacon turning, chains swaying', walk: 'rolling forward on its treads, forklift jaw bobbing' },
  sprinkler: { idle: 'idle: sprinkler head turning, legs shifting', walk: 'crawling forward on four spindly legs like a crab' },
};

const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, body) {
  for (let tries = 0; ; tries++) {
    const r = await fetch(`${API}${path}`, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H });
    const j = await r.json().catch(() => ({}));
    // at most three jobs at once (§13.2): wait for a slot
    if ((r.status === 429 || /concurrent|slot/i.test(JSON.stringify(j))) && tries < 20) { await sleep(18000); continue; }
    if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
    return j;
  }
}
async function job(id) {
  for (let i = 0; ; i++) {
    const j = await api(`/background-jobs/${id}`);
    if (j.status === 'completed') return j;
    if (!['processing', 'queued', 'pending'].includes(j.status)) throw new Error(`job ${id}: ${j.status} ${JSON.stringify(j).slice(0, 300)}`);
    if (i > 360) throw new Error(`job ${id}: still running after 30 minutes`);
    await sleep(5000);
  }
}
const balance = async () => (await api('/balance')).subscription?.generations;
const made = (id) => existsSync(join(OUT, id, 'prompt.json')) ? JSON.parse(readFileSync(join(OUT, id, 'prompt.json'), 'utf8')) : null;

async function fetchZip(id, cid) {
  const dir = join(OUT, id);
  const zip = Buffer.from(await (await fetch(`${API}/characters/${cid}/zip`, { headers: H })).arrayBuffer());
  const tmp = join(dir, '.zip');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'c.zip'), zip);
  execFileSync('unzip', ['-o', '-q', join(tmp, 'c.zip'), '-d', tmp]);
  // the zip holds one folder named for the character: keep its contents as they are
  const inner = readdirSync(tmp).find((d) => d !== 'c.zip' && !d.endsWith('.json'));
  rmSync(join(dir, 'character'), { recursive: true, force: true });
  execFileSync('cp', ['-r', inner ? join(tmp, inner) : tmp, join(dir, 'character')]);
  rmSync(tmp, { recursive: true, force: true });
}

/** A figure already on the account from an earlier run (a run cut short): adopt it instead of paying for it twice. */
async function adopt(id) {
  const c = C.cast[id];
  const list = (await api('/characters?limit=60')).characters ?? [];
  const found = list.find((x) => x.name?.startsWith(c.desc.slice(0, 48)) && x.status !== 'failed');
  if (!found) return null;
  for (let i = 0; ; i++) {
    const x = await api(`/characters/${found.id}`);
    if (x.status === 'completed') break;
    if (x.status === 'failed' || i > 360) return null;
    await sleep(5000);
  }
  mkdirSync(join(OUT, id), { recursive: true });
  await fetchZip(id, found.id);
  writeFileSync(join(OUT, id, 'prompt.json'), JSON.stringify({ source: 'pixellab', endpoint: 'v2/create-character-pro', adopted: true, description: found.name, character_id: found.id, anims: {}, at: new Date().toISOString() }, null, 2));
  return `${id}: adopted (${found.id})`;
}

async function figure(id) {
  const c = C.cast[id];
  if (!flag('--force')) { const a = await adopt(id); if (a) return a; }
  const anchor = id === C.anchor ? null : made(C.anchor);
  if (id !== C.anchor && !anchor) throw new Error(`${id}: make the anchor (${C.anchor}) first, and look at her`);
  const body = {
    description: `${c.desc}. ${c.kind === 'person' ? C.person : C.creature}`,
    style_description: C.style,
    method: 'create_with_style',
    view: 'low top-down',
    image_size: { width: 64, height: 64 },
    no_background: true,
    style_character_id: anchor ? anchor.character_id : (process.env.PIXELLAB_STYLE_ID ?? SPEC_STYLE_ID),
    ...(BODY[id] ?? BODY[c.kind] ? { template_id: BODY[id] ?? BODY[c.kind] } : {}),
  };
  const sub = await api('/create-character-pro', body);
  const done = await job(sub.background_job_id);
  const cid = sub.character_id ?? done.last_response?.character_id;
  mkdirSync(join(OUT, id), { recursive: true });
  await fetchZip(id, cid);
  writeFileSync(join(OUT, id, 'prompt.json'), JSON.stringify({ source: 'pixellab', endpoint: 'v2/create-character-pro', body, character_id: cid, anims: {}, at: new Date().toISOString() }, null, 2));
  return `${id}: made (${cid})`;
}

/** Which of the four directions an animation lacks, read from the packed sheet's meta (src/assets/cast/cast.json,
 *  written by tools/pack-cast.py, which knows PixelLab's folder names): pack first, then --fill. */
function missingDirs(id, name) {
  const metaPath = join(ROOT, 'src/assets/cast/cast.json');
  const rows = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8'))[id]?.anims?.[name]?.rows : null;
  return DIRS4.filter((d) => !rows?.[d]);
}

async function animate(id) {
  const p = made(id);
  if (!p) throw new Error(`${id}: no figure yet`);
  for (const name of C.cast[id].anims) {
    // --fill: an animation that came back missing a direction gets just that direction, in the same group
    if (p.anims[name] && flag('--fill')) {
      const missing = missingDirs(id, name);
      if (!missing.length) continue;
      const b = { ...p.anims[name].body, animation_group_id: p.anims[name].animation_group_id, directions: missing };
      const sub = await api('/animate-character', b);
      await Promise.all((sub.background_job_ids ?? []).map(job));
      continue;
    }
    if (p.anims[name] && !flag('--force')) continue;
    const custom = CUSTOM[id]?.[name];
    const template = BODY[id] === 'dog' ? DOG[name] : ANIM[name]?.template;
    const body = custom
      ? { character_id: p.character_id, mode: 'v3', action_description: custom, frame_count: 8, animation_name: name, directions: DIRS4 }
      : { character_id: p.character_id, template_animation_id: template, animation_name: name, directions: DIRS4 };
    const sub = await api('/animate-character', body);
    await Promise.all((sub.background_job_ids ?? []).map(job));
    p.anims[name] = { animation_group_id: sub.animation_group_id, fps: ANIM[name]?.fps ?? 10, body };
    writeFileSync(join(OUT, id, 'prompt.json'), JSON.stringify(p, null, 2));
  }
  await fetchZip(id, p.character_id);
  return `${id}: animated (${C.cast[id].anims.join(', ')})`;
}

/** A bust portrait for the dialogue box, drawn by PixelLab from the figure's front still (character_to_portrait).
 *  Raw output in assets/cast/<id>/portrait.png; the game's copy in src/assets/cast/portraits/<id>.png. */
const SPEAKERS = ['juno', 'kit', 'lupe', 'chayo', 'beto', 'ruben', 'tavo', 'nacho', 'fina', 'memo', 'nina', 'tona', 'elias', 'rosa', 'kidjuno'];
async function portrait(id) {
  const front = join(OUT, id, 'character/rotations/south.png');
  const start = await api('/portrait-character-pro', {
    direction: 'character_to_portrait', view: 'low top-down', result_size: 128,
    image: { base64: `data:image/png;base64,${readFileSync(front).toString('base64')}` },
  });
  const done = await job(start.background_job_id ?? start.job_id ?? start.id);
  const img = JSON.stringify(done).match(/data:image\/png;base64,([A-Za-z0-9+/=]+)|"base64":"([A-Za-z0-9+/=]+)"/);
  if (!img) throw new Error(`${id}: no image in ${JSON.stringify(done).slice(0, 300)}`);
  const png = Buffer.from(img[1] ?? img[2], 'base64');
  writeFileSync(join(OUT, id, 'portrait.png'), png);
  mkdirSync(join(ROOT, 'src/assets/cast/portraits'), { recursive: true });
  writeFileSync(join(ROOT, 'src/assets/cast/portraits', `${id}.png`), png);
  const rec = made(id);
  rec.portrait = { endpoint: 'v2/portrait-character-pro', direction: 'character_to_portrait', result_size: 128, at: new Date().toISOString() };
  writeFileSync(join(OUT, id, 'prompt.json'), JSON.stringify(rec, null, 2));
  return `${id}: portrait`;
}

// ------------------------------------------------------------------ the plan, or the work
if (flag('--portraits')) {
  const who = (ids.length ? ids : SPEAKERS).filter((id) => made(id) && (flag('--force') || !existsSync(join(OUT, id, 'portrait.png'))));
  console.log(`portraits: ${who.join(', ') || 'nothing'}`);
  if (flag('--plan') || !who.length) process.exit(0);
  if (!KEY) throw new Error('set PIXELLAB_API_KEY (the environment\'s secrets, not the chat)');
  const before = await balance();
  if (before - who.length * COST.portrait < FLOOR) throw new Error(`would go under the floor of ${FLOOR}`);
  for (let i = 0; i < who.length; i += 3) {
    for (const r of await Promise.allSettled(who.slice(i, i + 3).map(portrait))) console.log(r.status === 'fulfilled' ? r.value : `FAILED ${r.reason.message ?? r.reason}`);
  }
  console.log(`used ${before - (await balance())}`);
  process.exit(0);
}
// the look is locked on the anchor (docs/design/cast.md): she's never remade by accident
if (flag('--force') && want.includes(C.anchor) && !flag('--remake-anchor')) throw new Error(`${C.anchor} is the style anchor for the whole cast; remaking her needs the owner, and --remake-anchor`);
const todo = want.filter((id) => flag('--anims') ? made(id) : flag('--force') || !made(id));
if (flag('--fill')) console.log('fill:', todo.map((id) => `${id} ${C.cast[id].anims.map((n) => missingDirs(id, n).join('+')).join(' ')}`).join(', '));
const cost = todo.reduce((n, id) => n + (flag('--anims') ? C.cast[id].anims.length * COST.template : COST.figure), 0);
console.log(`${flag('--anims') ? 'animate' : 'make'}: ${todo.join(', ') || 'nothing'} (about ${cost} generations)`);
if (flag('--plan') || !todo.length) process.exit(0);
if (!KEY) throw new Error('set PIXELLAB_API_KEY (the environment\'s secrets, not the chat)');
const before = await balance();
console.log(`balance: ${before} generations; floor ${FLOOR}`);
if (before - cost < FLOOR) throw new Error(`would go under the floor of ${FLOOR} (have ${before}, need about ${cost})`);
mkdirSync(OUT, { recursive: true });
if (!flag('--anims') && todo.includes(C.anchor)) console.log(await figure(C.anchor)); // the anchor alone first
const rest = todo.filter((id) => flag('--anims') || id !== C.anchor);
// three at a time (§13.2)
for (let i = 0; i < rest.length; i += 3) {
  for (const r of await Promise.allSettled(rest.slice(i, i + 3).map(flag('--anims') ? animate : figure))) console.log(r.status === 'fulfilled' ? r.value : `FAILED ${r.reason.message ?? r.reason}`);
}
console.log(`used ${before - (await balance())}`);
