import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
// The region drawn straight down, north up, from the built game (npm run build first):
//   node tools/overview.mjs [time=day] [pixels per unit=10] [out dir] [rooms]
// Writes <out>/span-<time>.webp and a .json of what's placed on it (things, people, exits, sections).
const [,, time = 'day', ppu = '10', out = 'docs/design/regions/overview'] = process.argv;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`file://${path.resolve('dist/index.html')}?time=${time}`);
await p.waitForFunction(() => window.__LN?.ready, null, { timeout: 240000 });
await p.waitForTimeout(3000);
const save = (name, r) => { fs.writeFileSync(`${out}/${name}.webp`, Buffer.from(r.img.split(',')[1], 'base64')); delete r.img; fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(r, null, 1)); console.log(name, r.w, r.h); };
save(`span-${time}`, await p.evaluate((ppu) => window.__LN.overview(+ppu), ppu));
if (process.argv[5] === 'rooms') {
  const sizes = { 'mar-home': [18, 11], chapel: [13, 15], 'fina-house': [12, 9], 'kids-house': [11, 9] };
  for (const [id, [w, h]] of Object.entries(sizes)) {
    await p.evaluate((id) => window.__LN.go(id, 'door'), id);
    await p.waitForFunction((id) => window.__LN.areaId === id && !window.__LN.busy, id, { timeout: 120000 });
    await p.waitForTimeout(1500);
    save(`room-${id}-${time}`, await p.evaluate(([w, h]) => window.__LN.overview(40, [-0.6, -0.6, w + 0.6, h + 1.4]), [w, h]));
  }
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
