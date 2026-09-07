import * as THREE from 'three';
import { xz, ribbonGeom, resamplePolyline, segClosest } from '../core/util.js';

/* Streets of 1920 as ribbons over the meadow ground.
 *  'setts'  - the paved streets: granite Kopfsteinpflaster, granite kerbs,
 *             clinker footways behind them
 *  'sand'   - the colony streets as in the 1910 photographs: a packed sand
 *             roadway between granite kerbs, clinker footways, young trees
 *  'dirt'   - unpaved lanes of the colony: packed earth with cart ruts, a
 *             cinder path along one side, no kerbs
 *  'path'   - field paths: bare earth
 *  'rail'   - the railway embankment is built in props
 * Streets come from scene.json (present-day OSM) filtered and re-labelled
 * by the 1920 plan in period.js. */

const ROAD_Y = 0.02, KERB_H = 0.11, FOOT_Y = 0.05;

export class Streets {
  constructor(list) {
    this.streets = list.map((s0) => ({ ...s0, pts: resamplePolyline(s0.pts.map(xz), 3) }));
    this.cars = [];
    for (const s of this.streets) if (s.kind !== 'path') for (let i = 0; i < s.pts.length - 1; i++) this.cars.push({ a: s.pts[i], b: s.pts[i + 1], s });
    this.all = [];
    for (const s of this.streets) for (let i = 0; i < s.pts.length - 1; i++) this.all.push({ a: s.pts[i], b: s.pts[i + 1], s });
  }
  /** distance to the nearest carriageway centreline and the direction to it */
  dist(x, z, kinds = null, list = this.cars) {
    let best = { d: Infinity, nx: 0, nz: 0, s: null, t: 0, tx: 1, tz: 0 };
    for (const c of list) {
      if (kinds && !kinds.includes(c.s.kind)) continue;
      const [cx, cz] = segClosest(x, z, c.a[0], c.a[1], c.b[0], c.b[1]);
      const d = Math.hypot(cx - x, cz - z);
      if (d < best.d) { const tl = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) || 1; best = { d, nx: (cx - x) / (d || 1), nz: (cz - z) / (d || 1), s: c.s, px: cx, pz: cz, tx: (c.b[0] - c.a[0]) / tl, tz: (c.b[1] - c.a[1]) / tl }; }
    }
    return best;
  }
  onRoad(x, z, extra = 0.5) { const r = this.dist(x, z, null, this.all); return r.s && r.d < r.s.width / 2 + extra; }
  /** what is underfoot: 'cobble' | 'dirt' | 'grass' | 'boards' */
  surfaceAt(x, z) {
    const r = this.dist(x, z, null, this.all); if (!r.s) return 'grass';
    if (r.s.kind === 'setts') { if (r.d < r.s.width / 2 + 2.4) return 'cobble'; return 'grass'; }
    if (r.s.kind === 'sand') { if (r.d < r.s.width / 2 + 0.3) return 'dirt'; if (r.d < r.s.width / 2 + 2.4) return 'cobble'; return 'grass'; }
    if (r.d < r.s.width / 2 + 0.3) return 'dirt';
    return 'grass';
  }

  build(baker, world, radius) {
    const g = new THREE.PlaneGeometry(radius * 6.4, radius * 6.4, 160, 160); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; const pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
    baker.add(g, null, 'grass');
    let zi = 0;
    for (const s of this.streets) {
      zi++; const lift = (zi % 7) * 0.0015;
      const w = s.width; const kind = s.kind;
      const surf = kind === 'setts' ? 'setts' : kind === 'path' ? 'dirt' : 'dirt';
      const y = ROAD_Y + lift;
      const rg = ribbonGeom(s.pts, w, y, 2);
      if (rg) baker.add(rg, null, surf);
      if (kind === 'setts' || kind === 'sand') {
        const kerbOff = w / 2 + 0.08; const footOff = w / 2 + 0.15 + 1.1;
        for (const side of [-1, 1]) {
          for (const run of this._runs(s, side * kerbOff)) { const kg = ribbonGeom(run, 0.18, KERB_H, 1, side * kerbOff); if (kg) baker.add(kg, null, 'kerb'); }
          for (const run of this._runs(s, side * footOff, 1.2)) { const fg = ribbonGeom(run, 2.0, FOOT_Y + lift, 2, side * footOff); if (fg) baker.add(fg, null, 'clinker'); }
        }
        // gutter line of darker setts along the kerb (the sand streets of the colony have a paved gutter too)
        for (const side of [-1, 1]) for (const run of this._runs(s, side * (w / 2 - 0.25))) { const gg = ribbonGeom(run, 0.5, y + 0.004, 2, side * (w / 2 - 0.25)); if (gg) baker.add(gg, null, 'setts_dark'); }
      } else if (kind === 'dirt' && s.path !== false) {
        // a cinder footpath on one side, and worn verges
        const side = s.pathSide || 1; const off = w / 2 + 0.9;
        for (const run of this._runs(s, side * off, 0.8)) { const fg = ribbonGeom(run, 1.3, FOOT_Y + lift, 1, side * off); if (fg) baker.add(fg, null, 'cinder'); }
      }
    }
  }
  _runs(s, lateral, margin = 0.6) {
    const runs = []; let cur = [];
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i]; const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const ox = p[0] - dz * lateral, oz = p[1] + dx * lateral;
      let blocked = false;
      for (const c of this.cars) {
        if (c.s === s) continue;
        const [cx, cz] = segClosest(ox, oz, c.a[0], c.a[1], c.b[0], c.b[1]);
        if (Math.hypot(cx - ox, cz - oz) < c.s.width / 2 + margin) { blocked = true; break; }
      }
      if (blocked) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(p);
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  }
}
