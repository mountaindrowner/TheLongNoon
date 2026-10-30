// Playtests for the story (docs/design/legacy-breakdown.md): the first version's mission, "Lamp",
// played through the rebuilt town. `?step=` starts at a mission step with what came before it.
// Software-rendered WebGL runs a frame or two a second here, so every wait is on an outcome.
const { test, expect } = require('@playwright/test');
const path = require('path');
const GAME = 'file://' + path.resolve(__dirname, '../dist/index.html');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const until = (page, fn, arg, timeout = 120_000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
async function boot(page, query = '') {
  await page.goto(`${GAME}${query}`);
  await until(page, () => window.__LN && window.__LN.ready, undefined, 120_000);
}
const ln = (page, key) => page.evaluate((k) => window.__LN[k], key);

/** Read whatever's being said, a line at a time; a new staybook page is closed after a look. Stops when `done` says so. */
async function readThrough(page, done = () => false) {
  for (let i = 0; i < 600; i++) {
    const s = await page.evaluate(() => ({
      book: !!document.querySelector('.book.on'), talking: window.__LN.talking, scripting: window.__LN.scripting,
      text: document.querySelector('.dlg-text')?.textContent ?? '', fight: !!document.querySelector('.fight.on'),
      card: !!document.querySelector('.end-card.on'), step: window.__LN.step,
    }));
    if (done(s)) return s;
    if (s.book) { await page.waitForTimeout(500); await page.keyboard.press('Escape'); await until(page, () => !document.querySelector('.book.on')); continue; }
    if (!s.talking) { if (!s.scripting) return s; await page.waitForTimeout(300); continue; }
    await page.keyboard.press('KeyE');
    await page.waitForFunction((t) => !window.__LN.talking || (document.querySelector('.dlg-text')?.textContent ?? '') !== t
      || document.querySelector('.dlg-more')?.style.visibility === 'visible' || !!document.querySelector('.book.on'), s.text, { timeout: 60_000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  throw new Error('still talking after 600 lines');
}

test.skip(({ viewport }) => viewport.height > viewport.width, 'portrait: the rebuild has no rotate prompt yet');

test('the title opens on New game; the old tale is told by the fire, and skipping it goes to the burial', async ({ page }, info) => {
  test.setTimeout(420_000);
  const errors = watchErrors(page);
  await boot(page);
  await expect(page.locator('.title-screen.on .menu-item').first()).toHaveText('New game');
  await page.screenshot({ path: info.outputPath('title.png') });
  await page.keyboard.press('Enter');
  await until(page, () => window.__LN.talking, undefined, 240_000);
  await expect(page.locator('.dlg.on .dlg-name')).toHaveText('Little Juno');
  await page.screenshot({ path: info.outputPath('tale.png') });
  await page.keyboard.press('Escape');
  await until(page, () => window.__LN.mode === 'play' && window.__LN.talking, undefined, 240_000);
  expect(await ln(page, 'step')).toBe('burial');
  await expect(page.locator('.status.on')).toContainText('Lamp');
  await page.screenshot({ path: info.outputPath('burial.png') });
  expect(errors).toEqual([]);
});

test('home: feed the goats and fill up at the tank, and the milk is ready for Chayo', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = watchErrors(page);
  await boot(page, '?step=home');
  await page.evaluate(async () => { await window.__LN.tp(150.4, 64 + 126.6); window.__LN.face(0, -1); });
  await until(page, () => document.querySelector('.prompt.on')?.textContent.includes('Goats'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.talking);
  await readThrough(page);
  expect((await ln(page, 'state')).flags.fed).toBe(true);
  await page.evaluate(async () => { await window.__LN.tp(156.4, 64 + 112.6); window.__LN.face(0, -1); });
  await until(page, () => document.querySelector('.prompt.on')?.textContent.includes('Water tank'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.talking);
  await readThrough(page);
  const s = await ln(page, 'state');
  expect([s.step, s.water, s.items.milk, s.pages.includes('3')]).toEqual(['market', 10, 2, true]);
  await expect(page.locator('.objective.on')).toContainText('Doña Chayo');
  expect(errors).toEqual([]);
});

// The two long scenes run once, at 1080p: in software WebGL each takes several minutes (the phone layout of the
// fight and the end card is checked by screenshots, docs/architecture/current-state.md piece 6).
test('the drain: the Stray and the coyote, the fight, and Kit comes along', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(1_800_000);
  const errors = watchErrors(page);
  await boot(page, '?step=pancha&clock=22:00');
  await page.evaluate(() => window.__LN.tp(115, 205));
  await until(page, () => window.__LN.talking);
  await readThrough(page, (s) => s.fight);
  await until(page, () => !!document.querySelector('.f-menu.on button'), undefined, 240_000);
  await page.screenshot({ path: info.outputPath('fight.png') });
  // always the first choice: Fight, then the first part offered; the parry ring is left to close
  for (const end = Date.now() + 900_000; ;) {
    const s = await page.evaluate(() => ({ fight: !!document.querySelector('.fight.on'), menu: !!document.querySelector('.f-menu.on button') }));
    if (!s.fight) break;
    if (Date.now() > end) throw new Error('the fight is still going after 15 minutes');
    if (s.menu) await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  await readThrough(page);
  const s = await ln(page, 'state');
  expect([s.step, s.flags.drainDone, s.joined]).toEqual(['home2', true, ['kit']]);
  expect(s.items.scrap).toBe(4);
  expect(errors).toEqual([]);
});

test('home before Shutter: Memo\'s bell, Kit runs home, the empty chair, and night two begins', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=home2&clock=03:40');
  await page.evaluate(async () => { await window.__LN.tp(143, 64 + 118.2); window.__LN.face(0, -1); });
  await until(page, () => document.querySelector('.prompt.on')?.textContent.includes('Go in'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.talking);
  await readThrough(page, (s) => s.card);
  await expect(page.locator('.end-card.on .menu-item').first()).toHaveText('Read the last page');
  await expect(page.locator('.end-card.on h2')).toHaveText('Night one');
  expect(await page.evaluate(() => window.__LN.areaId)).toBe('mar-home');
  expect((await ln(page, 'state')).pages).toContain('last');
  await page.screenshot({ path: info.outputPath('end-card.png') });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // the next Lamp: Kit at the door, and the elders want her (night two, Her Father's Share)
  await until(page, () => window.__LN.talking, undefined, 300_000);
  await readThrough(page);
  expect([await ln(page, 'step'), await ln(page, 'areaId')]).toEqual(['n2_table', 'mar-home']);
  await expect(page.locator('.objective.on')).toContainText('Night two');
  await expect(page.locator('.objective.on')).toContainText("elders' table");
  expect((await ln(page, 'state')).flags.sides).toBe(true);
  expect(errors).toEqual([]);
});

test('the fifth day: Kit wakes Juno in the white and the drone goes over toward the lake (#drone)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await page.goto(`${GAME}#drone`);
  await until(page, () => window.__LN && window.__LN.ready, undefined, 120_000);
  await until(page, () => window.__LN.talking, undefined, 300_000);
  await readThrough(page, (s) => s.card);
  await until(page, () => !!document.querySelector('.end-card.on'), undefined, 120_000);
  await expect(page.locator('.end-card.on h2')).toHaveText('Day five');
  await page.screenshot({ path: info.outputPath('drone-card.png') });
  expect(errors).toEqual([]);
});

/** Stand at (x, z) facing (fx, fz), wait for the prompt to name `who`, and hear it out (first choice each time). */
async function talkAt(page, x, z, fx, fz, who) {
  await page.evaluate(async ([x, z, fx, fz]) => { await window.__LN.tp(x, z); window.__LN.face(fx, fz); }, [x, z, fx, fz]);
  // (a press left over from the last talk can start this one by itself)
  await until(page, (w) => document.querySelector('.prompt.on')?.textContent.includes(w) || window.__LN.talking, who);
  if (!(await ln(page, 'talking'))) await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.talking || window.__LN.scripting);
  // a talk can end a night (the card) or start a fight: stop there and let the test go on
  await readThrough(page, (s) => s.card || s.fight);
}
async function inRoom(page, to, spawn) {
  await page.evaluate(([to, spawn]) => window.__LN.go(to, spawn), [to, spawn]);
  await until(page, (id) => window.__LN.areaId === id && window.__LN.mode === 'play' && !window.__LN.busy, to);
}

test('side stories: the flour to the church, Neto and the bell at the mall, and the shop behind the grille', async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=free&time=night');
  const flags = async () => (await ln(page, 'state')).flags;

  // Chayo sends the flour up the Old Trail; the side story shows under the night's line
  await talkAt(page, 81.9, 209.1, 0, -1, 'Doña Chayo');
  expect((await flags()).q_flour).toBe(true);
  expect((await ln(page, 'state')).items.flour).toBe(1);
  await expect(page.locator('.obj-side')).toContainText('Doña Marta');
  // Rubén gives his jug for his brother
  await talkAt(page, 96.5, 204.6, 0, -1, 'Rubén');
  expect((await flags()).q_neto).toBe(true);

  // up the hill (a place of its own, through the trail gate): Marta takes the sack; Benny tells of the bell
  await inRoom(page, 'hill', 'church:trail');
  await talkAt(page, 274, 5.8, 0, -1, 'Doña Marta');
  expect((await flags()).flour_given).toBe(true);
  await talkAt(page, 267.6, -15, 0, -1, 'Benny');
  expect((await flags()).q_bell).toBe(true);
  await page.screenshot({ path: info.outputPath('church.png') });

  // the mall: Neto first (the jug), then the bell for two tins of white
  await page.evaluate(() => { window.__LN.state.white = 4; });
  await inRoom(page, 'mall-court', 'door');
  await talkAt(page, 16.2, 7.8, 1, 0, 'Scavenger');
  expect((await flags()).neto_met).toBe(true);
  await talkAt(page, 16.2, 7.8, 1, 0, 'Scavenger');
  const s = await ln(page, 'state');
  expect([s.flags.bell_got, s.items.bell, s.white]).toEqual([true, 1, 2]);
  // the one grille that's up: under it, the toy store with the lights on
  await talkAt(page, 16.7, 2.9, 0, -1, 'Grille');
  await until(page, () => window.__LN.areaId === 'mall-shop' && window.__LN.mode === 'play' && !window.__LN.busy);
  await talkAt(page, 10.6, 5.4, 0, -1, 'Keeper');
  const s2 = await ln(page, 'state');
  expect([s2.flags.shop_done, s2.items.cloud, s2.pages.includes('jcloud_a')]).toEqual([true, 1, true]);
  await page.screenshot({ path: info.outputPath('shop.png') });

  // home with the news: Rubén, then the bell to Benny, and it hangs in the arch
  await inRoom(page, 'span', 'seven-flags:mall');
  await talkAt(page, 96.5, 204.6, 0, -1, 'Rubén');
  expect((await flags()).q_neto_done).toBe(true);
  await talkAt(page, 81.9, 209.1, 0, -1, 'Doña Chayo');
  expect((await flags()).q_flour_done).toBe(true);
  await inRoom(page, 'hill', 'church:trail');
  await talkAt(page, 267.6, -15, 0, -1, 'Benny');
  expect((await flags()).bell_hung).toBe(true);
  expect(await page.evaluate(() => window.__LN.bellUp)).toBe(true);
  await expect(page.locator('.obj-side')).toHaveText('');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------- the prologue, nights two to seven (docs/design/prologue.md)

test('the prologue can be done: every step, on every branch, has its person or thing there and reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'builds every map: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?time=night');
  const r = await page.evaluate(() => window.__LN.prologueCheck());
  require('fs').writeFileSync(info.outputPath('prologue-check.json'), JSON.stringify(r, null, 1));
  expect(r.problems).toEqual([]);
  expect(Object.keys(r.logs)).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('night two ends on the cot: Juno writes her first page, and night three opens on the Strays in a line', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=n2_sleep&time=night');
  await inRoom(page, 'mar-home', 'door');
  await talkAt(page, 4.1, 9.4, 0, -1, 'Cot');
  await readThrough(page, (s) => s.card);
  await expect(page.locator('.end-card.on h2')).toHaveText('Night two');
  expect((await ln(page, 'state')).pages).toContain('j2');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await until(page, () => window.__LN.talking, undefined, 300_000);
  await readThrough(page);
  expect([await ln(page, 'step'), await ln(page, 'areaId')]).toEqual(['n3_tithe', 'span']);
  await expect(page.locator('.objective.on')).toContainText('Night three');
  await page.screenshot({ path: info.outputPath('night-three.png') });
  expect(errors).toEqual([]);
});

test('the dogs in the Big Store: walking into the back starts the fight, indoors, three of them', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=n2_store&time=night');
  await inRoom(page, 'big-store', 'door');
  // into the back half of the store, where the roof came down
  await page.evaluate(async () => { await window.__LN.tp(19.5, 10.4); });
  await page.keyboard.down('ArrowUp');
  await until(page, () => window.__LN.talking, undefined, 240_000);
  await page.keyboard.up('ArrowUp');
  await readThrough(page, (s) => s.fight);
  // the turn strip: Juno, Kit and three dogs (the dogs are quicker, so they go first)
  await until(page, () => document.querySelectorAll('.fight.on .f-turns > *').length >= 5, undefined, 240_000);
  await page.screenshot({ path: info.outputPath('dogs.png') });
  expect(errors).toEqual([]);
});

test('night three: the white takes Juno while she searches, Güero is lost, and night four begins', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=n3_search&clock=09:00');
  // out on the Lake Road in full sun, nothing left
  await page.evaluate(() => window.__LN.go('lakeside', { x: 226, z: 190 }));
  await until(page, () => window.__LN.areaId === 'lakeside' && !window.__LN.busy, undefined, 240_000);
  await page.evaluate(async () => { const s = window.__LN.state; s.water = 0; s.party.juno.hp = 1; delete s.items.wraps; await window.__LN.tp(226, 190); });
  await until(page, () => window.__LN.talking, undefined, 600_000);
  await readThrough(page);
  const s = await ln(page, 'state');
  expect([s.step, s.flags.guero_lost, s.pages.includes('j3b')]).toEqual(['n4_mower', true, true]);
  expect(errors).toEqual([]);
});

test('night seven: Chuy lets Juno by, and up the Thirty-Five the prologue ends', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1080p', 'long scene: 1080p only');
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  await boot(page, '?step=n7_leave&time=lamp');
  // up the northbound lanes of the Ramp (the median is at x 53)
  await page.evaluate(() => window.__LN.go('northroad', { x: 50, z: 5 }));
  await until(page, () => window.__LN.areaId === 'northroad' && !window.__LN.busy, undefined, 240_000);
  await page.evaluate(async () => { await window.__LN.tp(50, 5); window.__LN.face(0, -1); });
  await page.keyboard.down('ArrowUp');
  await until(page, () => window.__LN.talking, undefined, 300_000);
  await page.keyboard.up('ArrowUp');
  await readThrough(page, (s) => s.card);
  await expect(page.locator('.end-card.on h2')).toHaveText('Seven Flags');
  expect(await ln(page, 'step')).toBe('free');
  expect(errors).toEqual([]);
});
