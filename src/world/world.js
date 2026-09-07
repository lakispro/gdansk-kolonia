import { segClosest, pointInPoly } from '../core/util.js';

/* Collision world: line segments (building walls, fences, hedges) and circles
 * (poles, trunks, small props) in a coarse grid.  The walker is a circle. */
export class World {
  constructor(radius) {
    this.radius = radius; this.cell = 8; this.grid = new Map(); this.segs = []; this.circles = []; this.polys = [];
  }
  _key(i, j) { return i * 100000 + j; }
  _cells(x0, z0, x1, z1) {
    const out = []; const c = this.cell;
    for (let i = Math.floor((Math.min(x0, x1) - 1) / c); i <= Math.floor((Math.max(x0, x1) + 1) / c); i++)
      for (let j = Math.floor((Math.min(z0, z1) - 1) / c); j <= Math.floor((Math.max(z0, z1) + 1) / c); j++) out.push(this._key(i, j));
    return out;
  }
  _insert(keys, item) { for (const k of keys) { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(item); } }
  /** h = top of the obstacle above the ground; a walker whose feet are above h - 0.45 vaults it (fences, hedges) */
  addSegment(ax, az, bx, bz, pad = 0, h = Infinity) {
    const s = { t: 's', ax, az, bx, bz, pad, h }; this.segs.push(s); this._insert(this._cells(ax, az, bx, bz), s); return s;
  }
  addPolygon(ring, pad = 0, h = Infinity) {
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; this.addSegment(a[0], a[1], b[0], b[1], pad, h); }
    if (h === Infinity) this.polys.push(ring);
  }
  addCircle(x, z, r, h = Infinity) { const c = { t: 'c', x, z, r, h }; this.circles.push(c); this._insert(this._cells(x - r, z - r, x + r, z + r), c); return c; }
  removeItem(item) { for (const list of this.grid.values()) { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); } }
  /** push a circle of radius r at (x,z) out of everything */
  resolve(x, z, r, feet = 0) {
    for (let iter = 0; iter < 3; iter++) {
      const list = this.grid.get(this._key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || [];
      for (const it of list) {
        if (feet > it.h - 0.45) continue;
        if (it.t === 's') {
          const [cx, cz] = segClosest(x, z, it.ax, it.az, it.bx, it.bz);
          let dx = x - cx, dz = z - cz; const d = Math.hypot(dx, dz); const R = r + it.pad;
          if (d < R) { if (d < 1e-5) { dx = it.az - it.bz; dz = it.bx - it.ax; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; x += dx * R; z += dz * R; } else { x += dx / d * (R - d); z += dz / d * (R - d); } }
        } else {
          let dx = x - it.x, dz = z - it.z; const d = Math.hypot(dx, dz); const R = r + it.r;
          if (d < R) { if (d < 1e-5) { dx = 1; dz = 0; } else { dx /= d; dz /= d; } x = it.x + dx * R; z = it.z + dz * R; }
        }
      }
    }
    const d = Math.hypot(x, z);
    if (d > this.radius - r) { x *= (this.radius - r) / d; z *= (this.radius - r) / d; }
    return { x, z };
  }
  insideAnyBuilding(x, z) { return this.polys.some((p) => pointInPoly(x, z, p)); }
}
