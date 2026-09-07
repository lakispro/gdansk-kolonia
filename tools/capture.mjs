// Screenshots of fixed viewpoints, driven through the real app with Playwright.
// usage: node tools/capture.mjs [baseUrl]   (default http://127.0.0.1:5181)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:5181';
const views = JSON.parse(fs.readFileSync(new URL('./views.json', import.meta.url)));
fs.mkdirSync('qa/shots', { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function run(ctxOpts, tag, list) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__world, null, { timeout: 120000 });
  await page.click('#go');
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.exitPointerLock?.(); window.__world.player.sens = 0; });
  await page.mouse.move(10, 10);
  for (const v of list) {
    await page.evaluate((v) => { window.__world.setView(v.x, v.z, v.yaw, v.pitch || 0); window.__world.minimap.toggle(!!v.map); }, v);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `qa/shots/${tag}-${v.name}.jpg`, type: 'jpeg', quality: 82 });
    const cam = await page.evaluate(() => { const p = window.__world.player; return [p.pos.x.toFixed(1), p.pos.z.toFixed(1), p.yaw.toFixed(2), p.pitch.toFixed(2)].join(' '); });
    console.log('shot', tag, v.name, cam);
  }
  const stats = await page.evaluate(() => ({ calls: window.__world.renderer.info.render.calls, tris: window.__world.renderer.info.render.triangles }));
  console.log(tag, stats);
  await ctx.close();
}
await run({ viewport: { width: 1280, height: 720 } }, 'desk', views);
await run({ ...devices['Pixel 7'], hasTouch: true }, 'mobile', views.slice(0, 2));
await browser.close();
