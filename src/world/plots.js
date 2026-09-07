import * as THREE from 'three';
import { xz, ensureCCW, polyArea, pointInPoly, segClosest, hash, wallQuad, centroid } from '../core/util.js';

/* Plot boundaries of 1920 from the cadastral parcels (the Prussian cadastre
 * is the ancestor of today's EGiB; parcel lines in an old block like this
 * are mostly the original ones).
 *
 * Tenement frontages: a brick dwarf wall with an iron railing and a gate to
 * the front garden.  Houses and gardens: weathered picket fences.  Between
 * plots: pickets or privet hedges.  Everything is a collider. */

export function buildPlots(parcels, houses, streets, baker, world, radius, opts = {}) {
  const M = new THREE.Matrix4();
  const roadKinds = ['setts', 'sand', 'dirt'];
  const houseList = houses.filter(Boolean);
  const skip = opts.skip || (() => false);
  const isRoadParcel = (ring) => {
    let hits = 0;
    for (const s of streets.streets) for (let i = 0; i < s.pts.length; i += 2) if (pointInPoly(s.pts[i][0], s.pts[i][1], ring) && ++hits > 1) return true;
    return false;
  };
  const seenEdges = new Set();
  for (const p of parcels) {
    let ring = ensureCCW(p.ring.map(xz));
    const c = centroid(ring); if (Math.hypot(c[0], c[1]) > radius + 45) continue;
    const area = Math.abs(polyArea(ring));
    if (area < 15 || isRoadParcel(ring) || skip(ring, c)) continue;
    const seed = hash(parseInt(p.no) || area);
    const houseIn = houseList.filter((h) => pointInPoly(h.ring[0][0], h.ring[0][1], ring) || pointInPoly(centroid(h.ring)[0], centroid(h.ring)[1], ring));
    const tenement = houseIn.some((h) => h.kind === 'tenement');
    const door = houseIn.find((h) => h.door)?.door;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.8) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (Math.hypot(mx, mz) > radius + 40) continue;
      const key = [a, b].map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).sort().join('|');
      if (seenEdges.has(key)) continue; seenEdges.add(key);
      let onBuilding = false;
      for (const h of houseList) { if (pointInPoly(mx, mz, h.ring)) { onBuilding = true; break; } for (let j = 0; j < h.ring.length; j++) { const q = h.ring[j], r = h.ring[(j + 1) % h.ring.length]; const [cx, cz] = segClosest(mx, mz, q[0], q[1], r[0], r[1]); if (Math.hypot(cx - mx, cz - mz) < 0.45) { onBuilding = true; break; } } if (onBuilding) break; }
      if (onBuilding) continue;
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len; const nx = dz, nz = -dx;
      const sd = streets.dist(mx + nx * 1.5, mz + nz * 1.5, roadKinds);
      const parallel = sd.s ? Math.abs(sd.tx * dx + sd.tz * dz) : 0;
      const frontage = sd.s && sd.d < sd.s.width / 2 + 5.5 && parallel > 0.8;
      if (sd.s && sd.d < sd.s.width / 2 + 0.3) continue;
      const ang = Math.atan2(a[1] - b[1], b[0] - a[0]);
      const place = (t, y, out) => [a[0] + dx * t + nx * out, y, a[1] + dz * t + nz * out];
      let gates = [];
      if (frontage) {
        let tDoor = len * 0.5;
        if (door) { const [cx, cz, t] = segClosest(door.x, door.z, a[0], a[1], b[0], b[1]); tDoor = t * len; }
        tDoor = Math.min(Math.max(tDoor, 1.0), len - 1.0);
        gates.push([tDoor - 0.6, tDoor + 0.6, 'ped']);
        if (len > 10 && !tenement) { const tDrive = tDoor + 2.6 + 1.4 < len - 0.6 ? tDoor + 2.6 : tDoor - 2.6; if (tDrive - 1.4 > 0.3 && tDrive + 1.4 < len - 0.3) gates.push([tDrive - 1.4, tDrive + 1.4, 'drive']); }
        gates.sort((u, v) => u[0] - v[0]);
      }
      const runs = []; let t0 = 0;
      for (const g of gates) { if (g[0] > t0 + 0.2) runs.push([t0, g[0]]); t0 = g[1]; }
      if (len > t0 + 0.2) runs.push([t0, len]);
      const fenceStyle = frontage ? (tenement ? 'iron' : 'wood') : (seed > 0.55 ? 'wood' : seed > 0.25 ? 'hedge' : 'mesh');
      const h = fenceStyle === 'iron' ? 1.35 : fenceStyle === 'wood' ? 1.25 : fenceStyle === 'mesh' ? 1.3 : 1.2;
      for (const [u0, u1] of runs) {
        const L = u1 - u0; const mid = place((u0 + u1) / 2, 0, 0);
        if (fenceStyle === 'iron') {
          const base = new THREE.BoxGeometry(L, 1.0, 0.26); M.makeRotationY(ang).setPosition(mid[0], 0.0, mid[2]); baker.add(base, M.clone(), 'brick_red');
          const cap = new THREE.BoxGeometry(L, 0.06, 0.32); M.makeRotationY(ang).setPosition(mid[0], 0.53, mid[2]); baker.add(cap, M.clone(), 'trim_stone');
          const pa = place(u0, 0, 0), pb = place(u1, 0, 0);
          const q = wallQuad(pa[0], pa[2], pb[0], pb[2], 0.55, h, 1, false);
          const uv = q.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k) / (h - 0.55)); baker.add(q, null, 'railing');
          for (let t = u0; t <= u1 + 0.01; t += Math.max(2.5, L / Math.max(1, Math.round(L / 3.0)))) { const pp = place(Math.min(t, u1), 0, 0); const pg = new THREE.BoxGeometry(0.4, h + 0.25, 0.4); M.makeRotationY(ang).setPosition(pp[0], (h + 0.25) / 2, pp[2]); baker.add(pg, M.clone(), 'brick_red'); const cp = new THREE.BoxGeometry(0.48, 0.1, 0.48); M.makeRotationY(ang).setPosition(pp[0], h + 0.28, pp[2]); baker.add(cp, M.clone(), 'trim_stone'); }
        } else if (fenceStyle === 'wood') {
          const pa = place(u0, 0, 0), pb = place(u1, 0, 0); const q = wallQuad(pa[0], pa[2], pb[0], pb[2], -0.5, h, 1, false); const uv = q.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k) / (h + 0.5)); baker.add(q, null, 'wood_fence');
          for (let t = u0; t <= u1 + 0.01; t += 2.4) { const pp = place(Math.min(t, u1), 0, 0); const pg = new THREE.BoxGeometry(0.12, h + 0.1, 0.12); M.makeRotationY(ang).setPosition(pp[0], (h + 0.1) / 2, pp[2]); baker.add(pg, M.clone(), 'trim_brown'); }
        } else if (fenceStyle === 'mesh') {
          const pa = place(u0, 0, 0), pb = place(u1, 0, 0); const q = wallQuad(pa[0], pa[2], pb[0], pb[2], -0.5, h, 1, false); const uv = q.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2, uv.getY(k) * 2); baker.add(q, null, 'mesh');
          for (let t = u0; t <= u1 + 0.01; t += 2.5) { const pp = place(Math.min(t, u1), 0, 0); const pg = new THREE.BoxGeometry(0.09, h + 0.05, 0.09); M.makeRotationY(ang).setPosition(pp[0], (h + 0.05) / 2, pp[2]); baker.add(pg, M.clone(), 'pole'); }
        } else {
          const hg = new THREE.BoxGeometry(L, h, 0.7); const uv = hg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 1.2, uv.getY(k)); M.makeRotationY(ang).setPosition(mid[0], h / 2, mid[2]); baker.add(hg, M.clone(), 'hedge');
        }
        const pa = place(u0, 0, 0), pb = place(u1, 0, 0); world.addSegment(pa[0], pa[2], pb[0], pb[2], fenceStyle === 'hedge' ? 0.35 : 0.1, h);
      }
      // a privet hedge behind the iron railing of the tenement front garden
      if (frontage && fenceStyle === 'iron' && seed > 0.3) {
        for (const [u0, u1] of runs) { const L = u1 - u0; if (L < 1.5) continue; const mid = place((u0 + u1) / 2, 0, -0.55); const hh = 1.0 + seed * 0.4; const hg = new THREE.BoxGeometry(L - 0.3, hh, 0.6); const uv = hg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 1.2, uv.getY(k)); M.makeRotationY(ang).setPosition(mid[0], hh / 2, mid[2]); baker.add(hg, M.clone(), 'hedge'); }
      }
      for (const g of gates) {
        const gw = g[1] - g[0];
        const postK = fenceStyle === 'iron' ? 'brick_red' : 'trim_brown'; const pw = fenceStyle === 'iron' ? 0.42 : 0.14;
        for (const e of [0, 1]) { const pp = place(e ? g[1] : g[0], 0, 0); const pg = new THREE.BoxGeometry(pw, 1.7, pw); M.makeRotationY(ang).setPosition(pp[0], 0.85, pp[2]); baker.add(pg, M.clone(), postK); if (fenceStyle === 'iron') { const cap = new THREE.BoxGeometry(0.5, 0.1, 0.5); M.makeRotationY(ang).setPosition(pp[0], 1.74, pp[2]); baker.add(cap, M.clone(), 'trim_stone'); } }
        if (g[2] === 'drive') {
          const pa = place(g[0] + 0.2, 0, 0), pb = place(g[1] - 0.2, 0, 0); const q = wallQuad(pa[0], pa[2], pb[0], pb[2], 0.1, 1.2, 1, false); const uv = q.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k) / 1.15); baker.add(q, null, 'wood_fence');
          world.addSegment(pa[0], pa[2], pb[0], pb[2], 0.1, 1.2);
          const dp = place((g[0] + g[1]) / 2, 0.03, 1.6); const dg = new THREE.BoxGeometry(gw - 0.3, 0.02, 3.2); M.makeRotationY(ang).setPosition(dp[0], dp[1], dp[2]); baker.add(dg, M.clone(), 'gravel');
        } else {
          // open pedestrian leaf and a path to the door
          const pa = place(g[0] + 0.2, 0, 0); const pb = place(g[0] + 0.2, 0, 0.95); const q = wallQuad(pa[0], pa[2], pb[0], pb[2], 0.1, 1.2, 1, false); const uv = q.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k) / 1.15); baker.add(q, null, fenceStyle === 'iron' ? 'railing' : 'wood_fence');
          const dp = place((g[0] + g[1]) / 2, 0.03, 1.4); const dg = new THREE.BoxGeometry(1.0, 0.02, 2.8); M.makeRotationY(ang).setPosition(dp[0], dp[1], dp[2]); baker.add(dg, M.clone(), fenceStyle === 'iron' ? 'clinker' : 'gravel');
          if (door) { const gx = place((g[0] + g[1]) / 2, 0, -0.4); const ddx = door.x + door.nx * 0.6 - gx[0], ddz = door.z + door.nz * 0.6 - gx[2]; const l = Math.hypot(ddx, ddz); if (l > 1 && l < 25) { const pg = new THREE.BoxGeometry(1.0, 0.02, l); M.makeRotationY(-Math.atan2(ddz, ddx) + Math.PI / 2).setPosition(gx[0] + ddx / 2, 0.03, gx[2] + ddz / 2); baker.add(pg, M.clone(), fenceStyle === 'iron' ? 'clinker' : 'gravel'); } }
        }
      }
    }
  }
}
