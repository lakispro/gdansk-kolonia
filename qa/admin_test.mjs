import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [tag, opts] of [['desk', { viewport: { width: 1400, height: 800 } }], ['mobile', { ...devices['Pixel 7'], hasTouch: true }]]) {
  const page = await (await browser.newContext(opts)).newPage();
  page.on('pageerror', (e) => errors.push(tag + ': ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('admin/api')) errors.push(tag + ': ' + m.text()); });
  await page.goto('http://127.0.0.1:5191/admin.html', { waitUntil: 'load' });
  await page.waitForSelector('#items .item', { timeout: 120000 }); await page.waitForTimeout(1500);
  const n = await page.$$eval('#items .item', (l) => l.length);
  await page.screenshot({ path: `qa/shots/admin-${tag}-1.jpg`, type: 'jpeg', quality: 80 });
  // pick Posadowskyweg 74 and change the style
  await page.click('#items .item:has-text("Posadowskyweg 74")'); await page.waitForTimeout(1200);
  const title = await page.textContent('#hTitle');
  await page.fill('#style', JSON.stringify({ kind: 'house', storeys: 3, roofKind: 'gable', pitch: 55, wall: 'brick_red', brickBase: false, shutters: false, dormers: 2, roof: 'dark' }));
  await page.click('#bApply'); await page.waitForTimeout(1200);
  const msg = await page.textContent('#styleMsg');
  await page.screenshot({ path: `qa/shots/admin-${tag}-2.jpg`, type: 'jpeg', quality: 80 });
  // glb export: intercept the download
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#bGlb')]);
  const path = await dl.path(); const fs = await import('node:fs'); const size = fs.statSync(path).size;
  console.log(tag, { items: n, title, msg, glb: dl.suggestedFilename(), bytes: size });
}
console.log('errors', errors.length ? errors : 'none');
await browser.close();
