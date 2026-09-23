import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1500,height:900} })).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:5191/admin.html',{waitUntil:'load'});
await p.waitForSelector('#items .item',{timeout:120000});
const clip = { x:280, y:48, width:878, height:850 };
const pairs = process.argv.length > 2 ? process.argv.slice(2).map((a) => a.split(':')) : [['92358725','ne'],['92358185','se']];
for (const [id,tag] of pairs) {
  await p.click(`#items .item[data-id="${id}"]`); await p.waitForTimeout(1400);
  for (const az of [20,110,200,290]) {
    await p.evaluate(a=>window.__admin.setCam(a,18,78), az); await p.waitForTimeout(450);
    await p.screenshot({ path:`qa/shots/orb-${tag}-${az}.jpg`, type:'jpeg', quality:85, clip });
  }
  // close-up of the street front at archway height
  await p.evaluate(()=>{ const w=window.__admin, h=window.__house; const d=h&&h.door;
    if(d){ const c=h.ring.reduce((a,q)=>[a[0]+q[0]/h.ring.length,a[1]+q[1]/h.ring.length],[0,0]);
      w.controls.target.set(d.x-c[0], 5, d.z-c[1]); w.setCam(Math.atan2(d.nx,d.nz)*180/Math.PI, 9, 21); }
    else { w.controls.target.y=4; w.setCam(20,6,26); } }); await p.waitForTimeout(450);
  await p.screenshot({ path:`qa/shots/orb-${tag}-arch.jpg`, type:'jpeg', quality:88, clip });
  console.log(tag, 'ok');
}
console.log('errors', errs.length?errs.slice(0,2):'none');
await b.close();
