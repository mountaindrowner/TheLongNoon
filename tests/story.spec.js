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

test('home before Shutter: the doors seal, the drone crosses the white sky, and the Span is yours', async ({ page }, info) => {
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
  expect((await ln(page, 'state')).pages).toContain('last');
  await page.screenshot({ path: info.outputPath('end-card.png') });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await until(page, () => window.__LN.mode === 'play' && window.__LN.step === 'free' && !window.__LN.busy, undefined, 300_000);
  await expect(page.locator('.objective.on')).toContainText('yours to explore');
  expect(errors).toEqual([]);
});
