import * as THREE from 'three';
import { xz, hash } from '../core/util.js';

/* Trees from the orthophoto canopy extraction (+ the hand-placed ones from the
 * first build), hedges likewise.  A tree is a trunk and three overlapping
 * low-poly crowns; a conifer is a stack of cones.  All merged through the baker. */

export function buildVegetation(veg, houses, streets, baker, world, radius, extra = []) {
  const M = new THREE.Matrix4();
  const crownBase = new THREE.IcosahedronGeometry(1, 2);
  // a few pre-jittered crown variants so the trees are not balloons
  const crowns = [0, 1, 2, 3, 4].map((k) => { const g = crownBase.clone(); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const j = 1 + 0.16 * (Math.sin(3.1 * x + k * 1.7) * Math.sin(2.7 * y + k * 0.9) + Math.sin(2.3 * z + k * 2.3) * 0.7); pos.setXYZ(i, x * j, y * (j * 0.92), z * j); } g.computeVertexNormals(); return g; });
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 7);
  const coneG = new THREE.ConeGeometry(1, 1, 8);
  const inBuilding = (x, z) => houses.some((h) => h && pointInRing(x, z, h.ring, 0.8));
  let n = 0;
  const trees = veg.trees.map((t) => ({ x: xz([t.x, t.y])[0], z: xz([t.x, t.y])[1], r: t.r, kind: t.kind })).concat(extra);
  for (const t of trees) {
    if (Math.hypot(t.x, t.z) > radius + 60) continue;
    if (inBuilding(t.x, t.z)) continue;
    if (streets.onRoad(t.x, t.z, 0.8)) continue;
    const s = hash(Math.round(t.x * 7 + t.z * 13));
    const kind = t.kind || (s > 0.86 ? 'conifer' : 'round');
    const R = Math.min(3.3, Math.max(1.3, t.r * 0.85));
    if (kind === 'conifer') {
      const H = Math.max(5, R * 3.2);
      M.makeScale(0.18, H * 0.35, 0.18).setPosition(t.x, H * 0.17, t.z); baker.add(trunkG, M.clone(), 'bark');
      for (let i = 0; i < 3; i++) { const y = H * (0.3 + i * 0.22), rr = R * (0.75 - i * 0.18), hh = H * 0.4; M.makeScale(rr, hh, rr).setPosition(t.x, y + hh / 2 - hh * 0.2, t.z); baker.add(coneG, M.clone(), 'conifer'); }
      world.addCircle(t.x, t.z, 0.35);
    } else {
      const trunkH = 2.0 + R * 0.5; const crownY = trunkH + R * 0.7;
      M.makeScale(1 + R * 0.12, trunkH, 1 + R * 0.12).setPosition(t.x, trunkH / 2, t.z); baker.add(trunkG, M.clone(), 'bark');
      const mat = s > 0.66 ? 'foliage' : s > 0.33 ? 'foliage_dark' : 'foliage_olive';
      const lobes = [[0, 0, 0, 1], [0.45, 0.2, 0.2, 0.7], [-0.4, -0.05, -0.35, 0.66], [0.1, -0.25, 0.45, 0.6], [-0.15, 0.35, 0.1, 0.55]];
      let li = 0;
      for (const [ox, oy, oz, k] of lobes) { const crownG = crowns[(Math.round(s * 97) + li++) % crowns.length]; M.makeRotationY(s * 6 + li).multiply(new THREE.Matrix4().makeScale(R * k, R * k * 0.85, R * k)).setPosition(t.x + ox * R, crownY + oy * R, t.z + oz * R); baker.add(crownG, M.clone(), mat); }
      world.addCircle(t.x, t.z, 0.3);
    }
    n++;
  }
  for (const h of veg.hedges) {
    const a = xz(h.a), b = xz(h.b); const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (Math.hypot(mx, mz) > radius + 40) continue;
    const ang = Math.atan2(a[1] - b[1], b[0] - a[0]); const w = Math.min(2.2, Math.max(0.8, h.w)); const hh = 1.4 + hash(Math.round(mx)) * 0.8;
    const g = new THREE.BoxGeometry(L, hh, w); M.makeRotationY(ang).setPosition(mx, hh / 2, mz); baker.add(g, M.clone(), 'hedge');
    world.addSegment(a[0], a[1], b[0], b[1], w / 2, hh);
  }
  return n;
}
function pointInRing(x, z, r, pad) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
  if (ins) return true;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < pad) return true; }
  return false;
}
