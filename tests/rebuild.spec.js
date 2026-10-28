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
    expect(await page.evaluate(() => window.__LN.piece)).toBe('seven-flags');
    expect(await page.evaluate(() => window.__LN.doorIssues)).toEqual([]);
    expect(await page.evaluate(() => window.__LN.checkAllRooms())).toEqual([]);
    await page.screenshot({ path: info.outputPath(`span-${time}.png`) });
    expect(errors).toEqual([]);
  });
}

// Region coordinates (src/regions/span/region.ts PLACE): the Ramp (40,0) 88×64; Seven Flags, the town (0,64) 192×160;
// the Lake Road (192,128) 96×132; the White Bowl (156,260) 132×96; the Trail North (192,48) 88×72; the church (208,-48)
// 120×96; the mall (-40,224) 132×96.
test('every map is where the region says it is', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, 'night');
  const where = await page.evaluate(() => [[80, 30], [100, 150], [240, 200], [240, 300], [230, 80], [260, 0], [20, 280]].map(([x, z]) => window.__LN.pieceAtPoint(x, z)));
  expect(where).toEqual(['ramp', 'seven-flags', 'lake-road', 'white-bowl', 'trail', 'church', 'mall']);
  expect(await page.evaluate(() => window.__LN.piece)).toBe('seven-flags');
});

test('Juno walks out of town onto the Lake Road with no cut, and solid things stop her', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  // Del Mar runs east past Memo's barricade into the Lake Road through a gap in the brush at x 192
  await page.evaluate(() => window.__LN.tp(191.2, 188));
  await page.keyboard.down('KeyD');
  await until(page, () => window.__LN.pos[0] > 192.4, undefined, 150_000);
  await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => window.__LN.piece)).toBe('lake-road');
  expect(await page.evaluate(() => window.__LN.areaId)).toBe('span');
  // Mar Farm's front wall is solid: walking north across the lot stops at its face (z 64 + 115.9)
  await page.evaluate(() => window.__LN.tp(139, 182));
  await page.keyboard.down('KeyW');
  await until(page, () => window.__LN.pos[1] < 180.9);
  let prev = 999;
  for (;;) { const z = (await pos(page))[1]; if (Math.abs(z - prev) < 1e-4) break; prev = z; await page.waitForTimeout(1500); }
  await page.keyboard.up('KeyW');
  expect((await pos(page))[1]).toBeGreaterThan(179.9);
});

test('a lit door is a way in: into the chapel and back out to its step', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await boot(page, 'night');
  // stand on the chapel step (town 106, 111.4) facing the door, and use it
  await page.evaluate(async () => { await window.__LN.tp(106, 64 + 111.4); window.__LN.face(0, -1); });
  await until(page, () => !!document.querySelector('.prompt.on'));
  await page.keyboard.press('KeyE');
  await until(page, () => window.__LN.areaId === 'chapel' && !window.__LN.busy);
  await page.screenshot({ path: info.outputPath('chapel.png') });
  // walk back out through the doorway
  await page.keyboard.down('KeyS');
  await until(page, () => window.__LN.areaId === 'span' && !window.__LN.busy);
  await page.keyboard.up('KeyS');
  const [x, z] = await pos(page);
  expect(Math.abs(x - 106)).toBeLessThan(1.5);
  expect(Math.abs(z - (64 + 111.4))).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});

test('talking to Hermana Lupe opens her dialogue, and it closes', async ({ page }, info) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(async () => { await window.__LN.tp(131.9, 64 + 123); window.__LN.face(1, 0); });
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

test('every edge Juno can reach is a barrier, or a person who turns her back', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, 'night');
  // walks out from Juno over every map: nothing reachable past a map's edge or onto a road to a map not built
  expect(await page.evaluate(() => window.__LN.edgeIssues())).toEqual([]);
});

test('the boulevard east is closed with barriers, and they stop her', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await boot(page);
  // Del Mar goes on east past the Lake Road's fork (x 288, z 128 + 60); barriers stand across it near x 282.6
  await page.evaluate(() => window.__LN.tp(278, 188));
  await page.keyboard.down('KeyD');
  await until(page, () => window.__LN.pos[0] > 280);
  let prev = -1;
  for (;;) { const x = (await pos(page))[0]; if (Math.abs(x - prev) < 1e-4) break; prev = x; await page.waitForTimeout(1500); }
  await page.keyboard.up('KeyD');
  expect((await pos(page))[0]).toBeLessThan(282.6);
  expect(errors).toEqual([]);
});

test('Chuy holds the road north: stepping onto his line, he talks and turns Juno back', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await boot(page);
  // the Ramp is at (40, 0); Chuy's line runs across the highway at z 1.5 to 4.2
  await page.evaluate(() => window.__LN.tp(54, 8));
  await page.keyboard.down('KeyW');
  await until(page, () => window.__LN.talking, undefined, 150_000);
  await page.keyboard.up('KeyW');
  await expect(page.locator('.dlg-name')).toContainText('Chuy');
  while (await page.evaluate(() => window.__LN.talking || window.__LN.busy)) {
    if (await page.evaluate(() => window.__LN.talking)) await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
  }
  expect((await pos(page))[1]).toBeGreaterThan(7);
  expect(errors).toEqual([]);
});

test('the highway is walled off; the on-ramp at the top of town leads up onto it and north to the Ramp', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  // from International's west end, walking west stops at the foot of the highway's wall (the deck's edge is near x 27)
  await page.evaluate(() => window.__LN.tp(36, 64 + 106));
  await page.keyboard.down('KeyA');
  await until(page, () => window.__LN.pos[0] < 33);
  let prev = 999;
  for (;;) { const x = (await pos(page))[0]; if (Math.abs(x - prev) < 1e-4) break; prev = x; await page.waitForTimeout(1500); }
  await page.keyboard.up('KeyA');
  expect((await pos(page))[0]).toBeGreaterThan(26);
  // up on the deck north of the junction, walking north leaves town for the Ramp
  await page.evaluate(() => window.__LN.tp(53, 64 + 4));
  await page.keyboard.down('KeyW');
  await until(page, () => window.__LN.pos[1] < 63.4, undefined, 150_000);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => window.__LN.piece)).toBe('ramp');
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
  await expect(page.locator('.status')).toContainText('Lamp');
  expect(await page.evaluate(() => window.__LN.areaId)).toBe('span');
  expect(await page.evaluate(() => window.__LN.doorIssues)).toEqual([]);
  expect(errors).toEqual([]);
});
