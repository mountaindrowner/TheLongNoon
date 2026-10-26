const path = require('path');
const GAME = 'file://' + path.resolve(__dirname, '../../dist/legacy/The-Long-Noon-poc2.html') + '#debug';

// A save in the game's current format (v1). Tests start scenes by loading one of these
// through the real Continue button, the same path a player takes.
const baseSave = { v: 1, flags: {}, day: 1, water: 6, white: 0, items: {}, pages: ['1'],
  party: { juno: { hp: 42, dur: 12 }, kit: { hp: 26 } }, joined: [], dir: 'down' };

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function boot(page, save) {
  if (save) await page.addInitScript(s => localStorage.setItem('longnoon.poc2.save', s), JSON.stringify({ ...baseSave, ...save }));
  await page.goto(GAME);
  await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 90_000 });
}

async function continueGame(page) {
  await page.mouse.click(10, 10);            // the "tap anywhere to begin" gate
  await page.locator('#tmenu [data-a=continue]').click();
  await page.waitForFunction(() => window.__LN.mode === 'explore');
  await page.waitForTimeout(1500);           // camera settle and chunk streaming
}

const state = page => page.evaluate(() => ({ mode: __LN.mode, step: __LN.ST.step, flags: __LN.ST.flags }));

module.exports = { boot, continueGame, watchErrors, state, baseSave };
