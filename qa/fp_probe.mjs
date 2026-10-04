import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', viewport: { width: 1400, height: 1100 } });
const p = await ctx.newPage();
await p.goto('https://fotopolska.eu/Gdansk/b64728,Kochanowskiego_76.html', { waitUntil: 'networkidle', timeout: 90000 });
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(500); }
await p.screenshot({ path: 'qa/shots/fp-object.jpg', type: 'jpeg', quality: 70 });
const out = await p.evaluate(() => { const res = []; for (const a of document.querySelectorAll('a[href*=",foto.html"]')) { const id = a.getAttribute('href').match(/\/(\d+),foto/)?.[1]; const t = (a.getAttribute('title') || a.innerText || '').replace(/\s+/g,' ').trim(); const par = a.parentElement?.innerText?.replace(/\s+/g,' ').trim().slice(0,120); res.push([id, t.slice(0,80), par]); } return res; });
console.log(JSON.stringify(out.slice(0, 30)));
await b.close();
