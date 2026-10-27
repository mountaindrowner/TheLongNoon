/**
 * The Long Noon's cast from PixelLab, in the spec's locked style (docs/style/world-style-spec.md §13):
 * 64 px, low top-down, 8 directions, every figure made with the anchor (Juno) as its style reference.
 *
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs juno            # the anchor first: look at her before going on
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs                 # everyone not made yet
 *   PIXELLAB_API_KEY=… node tools/gen-cast.mjs kit --anims     # then their idles and walks
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
const COST = { figure: 15, template: 3, custom: 3 };
// animations in three directions (the owner, 2026-10-27): front, side, back; the other side is the side mirrored
const DIRS3 = ['south', 'east', 'north'];
// people walk and breathe on PixelLab's templates; animals on four legs use a quadruped skeleton; the rest are animated from text
const BODY = { person: 'mannequin', goat: 'dog', coyote: 'dog' };
const ANIM = {
  idle: { template: 'breathing-idle', fps: 5 },
  walk: { template: 'walking-8-frames', fps: 11 },
};
const CUSTOM = {
  stray: { idle: 'idle: rocking slightly on its six wheels, the red eye pulsing', walk: 'rolling forward on its six wheels, chassis bobbing' },
  chicken: { idle: 'idle: pecking at the ground, head bobbing', walk: 'walking, head bobbing with each step' },
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

async function figure(id) {
  const c = C.cast[id];
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

async function animate(id) {
  const p = made(id);
  if (!p) throw new Error(`${id}: no figure yet`);
  for (const name of C.cast[id].anims) {
    if (p.anims[name] && !flag('--force')) continue;
    const custom = CUSTOM[id]?.[name];
    const body = custom
      ? { character_id: p.character_id, mode: 'v3', action_description: custom, frame_count: 8, animation_name: name, directions: DIRS3 }
      : { character_id: p.character_id, template_animation_id: ANIM[name].template, animation_name: name, directions: DIRS3 };
    const sub = await api('/animate-character', body);
    await Promise.all((sub.background_job_ids ?? []).map(job));
    p.anims[name] = { animation_group_id: sub.animation_group_id, fps: ANIM[name].fps, body };
    writeFileSync(join(OUT, id, 'prompt.json'), JSON.stringify(p, null, 2));
  }
  await fetchZip(id, p.character_id);
  return `${id}: animated (${C.cast[id].anims.join(', ')})`;
}

// ------------------------------------------------------------------ the plan, or the work
const todo = want.filter((id) => flag('--anims') ? made(id) : flag('--force') || !made(id));
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
