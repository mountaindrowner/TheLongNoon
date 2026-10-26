// Playtests for the rebuilt game (src/). The spec's acceptance sizes (§20):
// 1280×720 and a phone in landscape at 844×340, plus the CI's 1080p.
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

test.skip(({ viewport }) => viewport.height > viewport.width, 'portrait: the rebuild has no rotate prompt yet');

for (const time of ['lamp', 'night', 'white']) {
  test(`Mar Farm builds at ${time} with every door promise kept`, async ({ page }, info) => {
    const errors = watchErrors(page);
    await boot(page, time);
    expect(await page.evaluate(() => window.__LN.areaId)).toBe('mar-farm');
    expect(await page.evaluate(() => window.__LN.doorIssues)).toEqual([]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: info.outputPath(`mar-farm-${time}.png`) });
    expect(errors).toEqual([]);
  });
}

// Software-rendered WebGL in CI runs a frame or two a second, so these wait on
// outcomes (a position reached, a dialogue open), never on fixed durations.
const until = (page, fn, arg, timeout = 90_000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

test('Juno walks, and solid things stop her', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const [x0, z0] = await pos(page);
  await page.keyboard.down('KeyW');
  await until(page, (z) => window.__LN.pos[1] < z - 1, z0);
  await page.keyboard.up('KeyW');
  const [x1] = await pos(page);
  expect(Math.abs(x1 - x0)).toBeLessThan(0.05); // straight up the lane
  // the store's front wall is solid: walking north from the lot stops at its face (z 11.5)
  await page.evaluate(() => window.__LN.tp(14, 14));
  await page.keyboard.down('KeyW');
  await until(page, () => window.__LN.pos[1] < 12.4);
  let prev = 99;
  for (;;) { const z = (await pos(page))[1]; if (Math.abs(z - prev) < 1e-4) break; prev = z; await page.waitForTimeout(1500); }
  await page.keyboard.up('KeyW');
  expect((await pos(page))[1]).toBeGreaterThan(11.5);
});

test('talking to Hermana Lupe opens her dialogue, and it closes', async ({ page }, info) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => { window.__LN.tp(10.2, 26.8); window.__LN.face(-1, 0); });
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
  await page.evaluate(() => window.__LN.tp(21, 30.6));
  await page.keyboard.down('KeyS');
  await until(page, () => !!document.querySelector('.hint'));
  await page.keyboard.up('KeyS');
  await expect(page.locator('.hint')).toContainText("isn't built yet");
  expect((await pos(page))[1]).toBeLessThan(32);
  expect(errors).toEqual([]);
});
