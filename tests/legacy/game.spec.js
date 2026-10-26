const { test, expect } = require('@playwright/test');
const { boot, continueGame, watchErrors, state } = require('./helpers');

const portrait = info => info.project.name === 'phone-portrait';

test('boots to the title screen without errors', async ({ page }, info) => {
  const errors = watchErrors(page);
  await boot(page);
  await expect(page.locator('#title')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: info.outputPath('title.png') });
  expect(errors).toEqual([]);
});

test('stage fits the screen at the 16:9 design grid', async ({ page }, info) => {
  await boot(page);
  const s = await page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    return { w: r.width, h: r.height, u: parseFloat(getComputedStyle(document.getElementById('stage')).getPropertyValue('--u')),
      rotate: !document.getElementById('rotate').hidden };
  });
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  expect(s.w).toBeLessThanOrEqual(vw);
  expect(s.h).toBeLessThanOrEqual(vh);
  expect(s.w / s.h).toBeGreaterThanOrEqual(16 / 9 - 0.01);   // never narrower than 16:9
  expect(s.w / s.h).toBeLessThanOrEqual(2.35 + 0.01);        // never wider than 2.35:1
  expect(s.u).toBeCloseTo(s.h / 540, 3);                     // UI is laid out on a 540-line grid
  if (info.project.name === 'desktop-1080p') { expect(s.w).toBe(1920); expect(s.h).toBe(1080); }
  expect(s.rotate).toBe(portrait(info));                     // phones held upright get the "turn sideways" prompt
});

const scenes = [
  ['farm-at-lamp', { step: 'home', clock: 19 * 60 + 25, pos: [12, 32] }],
  ['night-market', { step: 'market', clock: 20 * 60 + 30, pos: [72, 55], items: { milk: 1 } }],
  ['daylight', { step: 'kit', clock: 12 * 60, pos: [40, 40] }],
];
for (const [name, save] of scenes) {
  test(`continue into ${name}`, async ({ page }, info) => {
    test.skip(portrait(info), 'portrait shows the rotate prompt first');
    const errors = watchErrors(page);
    await boot(page, save);
    await continueGame(page);
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#touch')).toBeVisible({ visible: info.project.use.hasTouch === true });
    expect((await state(page)).step).toBe(save.step);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
    expect(errors).toEqual([]);
  });
}

test('walking into the drain starts the fight setup', async ({ page }, info) => {
  test.skip(portrait(info), 'portrait shows the rotate prompt first');
  const errors = watchErrors(page);
  await boot(page, { step: 'pancha', clock: 22 * 60, pos: [100, 52], joined: ['kit'] });
  await continueGame(page);
  await page.evaluate(() => __LN.tp(104, 54));               // inside the drain zone
  await page.waitForFunction(() => __LN.ST.flags.drainStarted === true, null, { timeout: 15_000 });
  await expect(page.locator('#dialog')).toBeVisible();
  await page.screenshot({ path: info.outputPath('drain-intro.png') });
  expect(errors).toEqual([]);
});
