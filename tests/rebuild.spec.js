// Playtests for the rebuilt game (src/). The spec's acceptance sizes (§20):
// 1280×720 and a phone in landscape at 844×340, plus the CI's 1080p.
//
// The Span is one region: five sections on a grid (cell 44×32), walked between with no cut.
// Region coordinates: Mar Farm is cell (0,1), the Ramp (0,0), the Plaza (1,1),
// the East Road (2,1), the White Bowl (2,2). Rooms are separate scenes behind lit doors.
const { test, expect } = require('@playwright/test');
const path = require('path');
const GAME = 'file://' + path.resolve(__dirname, '../dist/index.html');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
async function boot(page, time = 'lamp') {
  await page.goto(`${GAME}?time=${time}`);
  await page.waitForFunction(() => window.__LN && window.__LN.ready, null, { timeout: 90_000 });
}
const pos = (page) => page.evaluate(() => window.__LN.pos);

// Software-rendered WebGL in CI runs a frame or two a second, so these wait on
// outcomes (a position reached, a dialogue open), never on fixed durations.
const until = (page, fn, arg, timeout = 90_000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

test.skip(({ viewport }) => viewport.height > viewport.width, 'portrait: the rebuild has no rotate prompt yet');

for (const time of ['lamp', 'night', 'white']) {
  test(`the Span builds at ${time} with every door promise kept, rooms included`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await boot(page, time);
    expect(await page.evaluate(() => window.__LN.areaId)).toBe('span');
    expect(await page.evaluate(() => window.__LN.piece)).toBe('mar-farm');
    expect(await page.evaluate(() => window.__LN.doorIssues)).toEqual([]);
    expect(await page.evaluate(() => window.__LN.checkAllRooms())).toEqual([]);
    await page.screenshot({ path: info.outputPath(`span-${time}.png`) });
    expect(errors).toEqual([]);
  });
}

// Region coordinates (src/regions/span/region.ts PLACE): the Ramp (0,0) 88×64, Mar Farm (0,64), the Plaza (132,64),
// the Colonia (264,64), all 132×96; the Lake Road (396,64) 96×132; the White Bowl (360,196) 132×96.
test('every map is where the region says it is', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, 'night');
  const where = await page.evaluate(() => [[40, 30], [26, 114], [198, 100], [330, 110], [440, 170], [440, 250]].map(([x, z]) => window.__LN.pieceAtPoint(x, z)));
  expect(where).toEqual(['ramp', 'mar-farm', 'plaza', 'colonia', 'lake-road', 'white-bowl']);
});

test('Juno walks from the farm into the Plaza with no cut, and solid things stop her', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  // the boulevard runs east from the farm into the Plaza through a gap in the brush at x 132
  await page.evaluate(() => window.__LN.tp(131.2, 124));
  await page.keyboard.down('KeyD');
  await until(page, () => window.__LN.pos[0] > 132.4, undefined, 150_000);
  await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => window.__LN.piece)).toBe('plaza');
  expect(await page.evaluate(() => window.__LN.areaId)).toBe('span');
  // the store's front wall is solid: walking north from the lot stops at its face (z 64 + 42.5)
  await page.evaluate(() => window.__LN.tp(28, 108.4));
  await page.keyboard.down('KeyW');
  await until(page, () => window.__LN.pos[1] < 107.4);
  let prev = 999;
  for (;;) { const z = (await pos(page))[1]; if (Math.abs(z - prev) < 1e-4) break; prev = z; await page.waitForTimeout(1500); }
  await page.keyboard.up('KeyW');
  expect((await pos(page))[1]).toBeGreaterThan(106.5);
});

test('a lit door is a way in: into the chapel and back out to its step', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await boot(page, 'night');
  // stand on the chapel step (Plaza 66, 11.6) facing the door, and use it
  await page.evaluate(async () => { await window.__LN.tp(132 + 66, 64 + 11.6); window.__LN.face(0, -1); });
  await until(page, () => !!document.querySelector('.prompt.on'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.areaId === 'chapel' && !window.__LN.busy);
  await page.screenshot({ path: info.outputPath('chapel.png') });
  // walk back out through the doorway
  await page.keyboard.down('KeyS');
  await until(page, () => window.__LN.areaId === 'span' && !window.__LN.busy);
  await page.keyboard.up('KeyS');
  const [x, z] = await pos(page);
  expect(Math.abs(x - (132 + 66))).toBeLessThan(1.5);
  expect(Math.abs(z - (64 + 11.6))).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});

test('talking to Hermana Lupe opens her dialogue, and it closes', async ({ page }, info) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(async () => { await window.__LN.tp(12.3, 64 + 39.4); window.__LN.face(-1, 0); });
  await until(page, () => !!document.querySelector('.prompt.on'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.talking);
  await expect(page.locator('.dlg.on .dlg-name')).toHaveText('Hermana Lupe');
  await page.screenshot({ path: info.outputPath('lupe.png') });
  for (let i = 0; i < 12 && (await page.evaluate(() => window.__LN.talking)); i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(900);
  }
  expect(await page.evaluate(() => window.__LN.talking)).toBe(false);
});

test('an unbuilt road turns you back at the edge instead of breaking', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await boot(page);
  // the boulevard goes on east past the lake road's fork (x 492, z 64 + 60); the next region isn't built
  await page.evaluate(() => window.__LN.tp(490.6, 124));
  await page.keyboard.down('KeyD');
  await until(page, () => !!document.querySelector('.hint'), undefined, 150_000);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.hint')).toContainText('east road');
  expect((await pos(page))[0]).toBeLessThan(492);
  expect(errors).toEqual([]);
});

test('the clock runs, and at Lamp the town lights its lanterns', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await boot(page, 'white');
  expect(await page.evaluate(() => [window.__LN.phase, window.__LN.lit])).toEqual(['Day', false]);
  // half a game minute before Lamp, running: the town is rebuilt lit, and every door promise still holds
  await page.evaluate(() => window.__LN.setClock(18 * 60 + 29.6, true));
  await until(page, () => window.__LN.lit === true && !window.__LN.busy, undefined, 150_000);
  expect(await page.evaluate(() => window.__LN.phase)).toBe('Lamp');
  await expect(page.locator('.badge')).toContainText('Lamp');
  expect(await page.evaluate(() => window.__LN.areaId)).toBe('span');
  expect(await page.evaluate(() => window.__LN.doorIssues)).toEqual([]);
  expect(errors).toEqual([]);
});
