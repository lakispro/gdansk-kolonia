// Geometry regression check for the building generator.
//   node tools/geomcheck.mjs save    -> writes the current geometry of every building to a baseline
//   node tools/geomcheck.mjs [check] -> rebuilds and reports buildings whose geometry moved
// Builds the whole plan in the same order as the game (neighbours matter for party walls),
// without terrain, and records every baked geometry per building and material.
import fs from 'node:fs';
import { makePlan } from '../src/world/plan1920.js';
import { Streets } from '../src/world/streets.js';
import { World } from '../src/world/world.js';
import { buildBuilding } from '../src/kit/tenement.js';

const mode = process.argv[2] || 'check';
const BASE = process.argv[3] || '/tmp/geom-baseline.json';
const rd = (n) => JSON.parse(fs.readFileSync(new URL(`../public/data/${n}.json`, import.meta.url)));
const overrides = mode === 'save-plain' || process.env.NO_OVERRIDES ? {} : rd('overrides');
const plan = makePlan(rd('scene'), rd('parcels'), overrides);
const streets = new Streets(plan.streets);
const world = new World(150);

let cur = null;
const baker = {
  ground: null, base: null,
  add(geom, matrix, key) {
    const g = matrix ? geom.clone().applyMatrix4(matrix) : geom;
    const p = g.attributes.position.array;
    (cur[key] ||= []).push(...Array.from(p, (v) => Math.round(v * 1000) / 1000));
  },
};
const ctx = { baker, world, streetDist: (x, z) => streets.dist(x, z, ['setts', 'sand', 'dirt']), plate(no, geom) { baker.add(geom, null, '_plate'); },
  sign(text, x, y, z, ang, w, h) { (cur._sign ||= []).push(...[x, y, z, ang, w, h].map((v) => Math.round(v * 1000) / 1000)); } };
const out = {};
// EXTRA='{"shutters":true}' merges extra style keys into every non-shed building, to exercise more code paths
const EXTRA = process.env.EXTRA ? JSON.parse(process.env.EXTRA) : null;
for (const b of plan.buildings) {
  const st = EXTRA && b.style?.kind !== 'shed' ? { ...(b.style || {}), ...EXTRA } : (b.style || {});
  cur = {}; buildBuilding(b, ctx, st); out[b.id] = cur;
}

if (mode.startsWith('save')) { fs.writeFileSync(BASE, JSON.stringify(out)); console.log(`zapisano ${Object.keys(out).length} budynków -> ${BASE}`); process.exit(0); }
const base = JSON.parse(fs.readFileSync(BASE));
let bad = 0;
for (const id of Object.keys(base)) {
  const a = base[id], b = out[id] || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const msgs = [];
  for (const k of keys) {
    const x = a[k] || [], y = b[k] || [];
    if (x.length !== y.length) { msgs.push(`${k}: ${x.length / 3} -> ${y.length / 3} wierzchołków`); continue; }
    let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i]));
    if (m > 0.011) msgs.push(`${k}: odchyłka ${m.toFixed(3)} m`);
  }
  if (msgs.length) { bad++; if (bad <= 25) console.log(id, msgs.slice(0, 4).join('; ')); }
}
console.log(bad ? `RÓŻNICE: ${bad} z ${Object.keys(base).length} budynków` : `OK: ${Object.keys(base).length} budynków bez zmian`);
process.exit(bad ? 1 : 0);
