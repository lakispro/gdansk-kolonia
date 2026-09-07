// End-to-end run of the story on a touch-emulated phone: taps Wejdź, pushes the stick,
// jumps, then teleports to each chapter's target in turn, presses "działaj", answers
// the dialogue, and checks the end card.  Then walks into the home house and checks the collider.
// usage: node tools/playtest.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:5191';
fs.mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['Pixel 7'], hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__world, null, { timeout: 180000 });
await page.screenshot({ path: 'qa/shots/play-00-start.jpg', type: 'jpeg', quality: 80 });
await page.tap('#go');
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
await frames(3);
// stick: walk forward for a second, then jump
const stick = await page.$('#stick'); const sb = await stick.boundingBox();
await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
const p0 = await page.evaluate(() => [window.__world.player.pos.x, window.__world.player.pos.z]);
await page.evaluate(() => { const p = window.__world.player; p.stick.active = true; p.stick.dy = -1; });
await frames(20);
await page.evaluate(() => { const p = window.__world.player; p.stick.active = false; p.stick.dy = 0; });
const p1 = await page.evaluate(() => [window.__world.player.pos.x, window.__world.player.pos.z]);
console.log('walked', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2), 'm in 20 frames (1 s of game time)');
await page.tap('#bJump'); await frames(5);
const air = await page.evaluate(() => window.__world.player.pos.y - window.__world.plan.ground(window.__world.player.pos.x, window.__world.player.pos.z));
console.log('jump height after 5 frames:', air.toFixed(2), 'm');
await frames(25);
// sprint toggle
await page.tap('#bRun'); const run = await page.evaluate(() => window.__world.player.isRunning); console.log('sprint toggled:', run); await page.tap('#bRun');
// the story
const total = await page.evaluate(() => window.__world.story.total);
let shots = 0;
for (let i = 0; i < total + 2; i++) {
  const done = await page.evaluate(() => window.__world.story.done); if (done) break;
  const tp = await page.evaluate(() => window.__world.story.targetPos());
  await page.evaluate((tp) => { const w = window.__world; w.setView(tp[0] + 1.2, tp[1] + 1.2, Math.atan2(1.2, 1.2) + Math.PI, 0.05); }, tp);
  await frames(3);
  if (shots < 3) { await page.screenshot({ path: `qa/shots/play-0${++shots}-chapter.jpg`, type: 'jpeg', quality: 80 }); }
  await page.tap('#bAct'); await frames(2);
  const cardOpen = await page.evaluate(() => document.getElementById('dialog').classList.contains('on'));
  if (!cardOpen) { console.log('chapter', i, 'no card opened at', tp); continue; }
  if (i === 0) await page.screenshot({ path: 'qa/shots/play-dialog.jpg', type: 'jpeg', quality: 80 });
  // answer: click the first button, then keep clicking while a card is open
  for (let k = 0; k < 4; k++) { const b = await page.$('#dialog.on .btns .go'); if (!b) break; await b.tap(); await frames(2); }
  const idx = await page.evaluate(() => window.__world.story.idx); console.log('chapter', i, 'done ->', idx, '/', total);
}
await frames(3);
const ended = await page.evaluate(() => document.getElementById('end').classList.contains('on'));
console.log('end card:', ended);
await page.screenshot({ path: 'qa/shots/play-end.jpg', type: 'jpeg', quality: 80 });
// collider: walk into the home from the street
await page.tap('#again'); await frames(3);
const home = await page.evaluate(() => { const h = window.__world.houses.find((h) => h.b.home); return h ? [h.door.x, h.door.z, h.door.nx, h.door.nz] : null; });
if (home) {
  await page.evaluate((h) => { const w = window.__world; w.setView(h[0] + h[2] * 4, h[1] + h[3] * 4, Math.atan2(h[2], h[3]) + Math.PI, 0); w.player.stick.active = true; w.player.stick.dy = -1; }, home);
  await frames(60);
  await page.evaluate(() => { const p = window.__world.player; p.stick.active = false; p.stick.dy = 0; });
  const d = await page.evaluate((h) => { const p = window.__world.player.pos; return Math.hypot(p.x - h[0], p.z - h[1]); }, home);
  console.log('stopped', d.toFixed(2), 'm from the door (collider ok if > 0.3)');
}
const stats = await page.evaluate(() => ({ calls: window.__world.renderer.info.render.calls, tris: window.__world.renderer.info.render.triangles }));
console.log('stats', stats, 'errors', errors.length ? errors : 'none');
await browser.close();
