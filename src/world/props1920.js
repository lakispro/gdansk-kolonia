import * as THREE from 'three';
import { xz, hash, resamplePolyline, pointInPoly } from '../core/util.js';
import * as T from '../core/textures.js';

/* Street furniture and life of 1920 Langfuhr: gas lamps, telegraph poles,
 * enamel street signs on the corner houses, an advertising column, water
 * pumps, benches, coal heaps, hand carts, laundry lines, allotment gardens
 * with their sheds, the railway embankment with its tracks, a horse cart,
 * and a few people standing about.  All merged through the baker except the
 * moving cart and the people, which are small groups. */

export function buildProps(ctx) {
  const { scene, streets, houses, baker, world, radius, group, mats, plan } = ctx;
  const M = new THREE.Matrix4();
  const placed = []; const clear = (x, z, d) => !placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < d);
  const inBuilding = (x, z) => houses.some((h) => h && ptIn(x, z, h.ring, 0.6));
  const okSpot = (x, z) => Math.hypot(x, z) < radius + 50 && !inBuilding(x, z) && !streets.onRoad(x, z, 0.3);
  const roads = streets.streets.filter((s) => s.kind === 'setts' || s.kind === 'sand' || s.kind === 'dirt');
  const wires = [];

  // ---- gas lamps on the paved streets (every ~30 m, alternating sides), Prussian pattern: fluted post, square lantern
  for (const s of roads) {
    if (s.kind !== 'setts' && s.kind !== 'sand') continue;
    const pts = resamplePolyline(s.pts, s.kind === 'setts' ? 30 : 38); let side = hash(s.id) > 0.5 ? 1 : -1; const off = s.width / 2 + 0.7;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const x = p[0] - dz * off * side, z = p[1] + dx * off * side; side = -side;
      if (!okSpot(x, z) || !clear(x, z, 10)) continue;
      placed.push([x, z]); gasLamp(baker, world, x, z);
    }
  }
  // ---- telegraph poles along the paved streets and the lane, with wires
  for (const s of roads) {
    const pts = resamplePolyline(s.pts, 38); const side = hash(s.id * 3) > 0.5 ? 1 : -1; const off = s.width / 2 + (s.kind === 'dirt' ? 1.3 : 2.6);
    let prev = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const x = p[0] - dz * off * side, z = p[1] + dx * off * side;
      if (!okSpot(x, z) || !clear(x, z, 6)) { prev = null; continue; }
      placed.push([x, z]);
      const H = 7.5; const ang = Math.atan2(dz, dx);
      const g = new THREE.CylinderGeometry(0.09, 0.14, H, 7); M.identity().setPosition(x, H / 2 - 0.2, z); baker.add(g, M.clone(), 'pole');
      const bar = new THREE.BoxGeometry(0.08, 0.08, 1.2); M.makeRotationY(-ang).setPosition(x, H - 0.6, z); baker.add(bar, M.clone(), 'trim_brown');
      for (const e of [-0.45, -0.15, 0.15, 0.45]) { const ins = new THREE.CylinderGeometry(0.05, 0.06, 0.14, 6); M.identity().setPosition(x - dz * e, H - 0.5, z + dx * e); baker.add(ins, M.clone(), 'white'); }
      world.addCircle(x, z, 0.2);
      if (prev) for (const e of [-0.45, -0.15, 0.15, 0.45]) wires.push([[prev.x - prev.dz * e, H - 0.5, prev.z + prev.dx * e], [x - dz * e, H - 0.5, z + dx * e]]);
      prev = { x, z, dx, dz };
    }
  }
  // ---- young street trees on the paved streets, staked, as in the 1910 photographs of the colony
  {
    const crown = new THREE.IcosahedronGeometry(1, 1); const trunk = new THREE.CylinderGeometry(0.06, 0.09, 1, 6);
    for (const s of roads) {
      if (s.kind !== 'setts' && s.kind !== 'sand') continue;
      const pts = resamplePolyline(s.pts, 11); const off = s.width / 2 + 1.9;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        for (const side of [-1, 1]) {
          if (hash(s.id * 7 + i * 3 + side) > 0.8) continue;
          const x = p[0] - dz * off * side, z = p[1] + dx * off * side;
          if (!okSpot(x, z) || !clear(x, z, 4)) continue;
          if (houses.some((h) => h && ptIn(x, z, h.ring, 2.2))) continue;
          placed.push([x, z]);
          const H = 2.6 + hash(i + s.id) * 0.8, R = 0.9 + hash(i * 5 + s.id) * 0.5;
          M.makeScale(1, H, 1).setPosition(x, H / 2, z); baker.add(trunk, M.clone(), 'bark');
          M.makeScale(R, R * 1.3, R).setPosition(x, H + R * 0.8, z); baker.add(crown, M.clone(), hash(i * 11 + s.id) > 0.5 ? 'foliage' : 'foliage_olive');
          const stake = new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4); M.identity().setPosition(x + 0.18, 1.0, z); baker.add(stake, M.clone(), 'pole');
          world.addCircle(x, z, 0.14);
        }
      }
    }
  }
  // ---- enamel street signs on the corner houses (German names of 1920), plus a post where there is no house
  const signed = new Map();
  for (const s of roads) {
    const name = s.name1920 || s.name; if (!name) continue;
    const pts = resamplePolyline(s.pts, 4);
    const inside = pts.filter((p) => Math.hypot(p[0], p[1]) < radius + 10);
    if (!inside.length) continue;
    const n = signed.get(name) || 0; if (n >= 2) continue;
    for (const idx of [0, inside.length - 1]) {
      const p = inside[idx]; const j = pts.indexOf(p); const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const off = s.width / 2 + 1.0; const x = p[0] - dz * off, z = p[1] + dx * off; if (!okSpot(x, z)) continue;
      const post = new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6); M.identity().setPosition(x, 1.35, z); baker.add(post, M.clone(), 'iron');
      const tex = T.streetSign(name);
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), mat); sign.position.set(x, 2.5, z); sign.rotation.y = -Math.atan2(dz, dx); sign.castShadow = true; group.add(sign);
      world.addCircle(x, z, 0.08); signed.set(name, (signed.get(name) || 0) + 1);
    }
  }
  // ---- the advertising column (Litfaßsäule)
  if (plan.column) {
    const [x, z] = plan.column;
    const g = new THREE.CylinderGeometry(0.75, 0.75, 2.9, 24, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1, uv.getY(i));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: T.posters(plan.posters || ['DANZIGER|VOLKSSTIMME', 'KINO|Langfuhr', 'BIER|Kleinhammer', 'VERSAMMLUNG|Werftarbeiter', 'Goldwasser|Der Lachs', 'ZIRKUS|Busch', 'THEATER|Danzig', 'Freie Stadt|Danzig']) })); m.position.set(x, 1.5, z); m.castShadow = true; group.add(m);
    const base = new THREE.CylinderGeometry(0.85, 0.9, 0.3, 24); M.identity().setPosition(x, 0.15, z); baker.add(base, M.clone(), 'plinth');
    const top = new THREE.CylinderGeometry(0.2, 0.9, 0.5, 24); M.identity().setPosition(x, 3.15, z); baker.add(top, M.clone(), 'trim_dark');
    const knob = new THREE.SphereGeometry(0.22, 12, 8); M.identity().setPosition(x, 3.5, z); baker.add(knob, M.clone(), 'trim_dark');
    world.addCircle(x, z, 0.95);
  }
  // ---- water pumps (a cast-iron street pump, the colony had no mains water on every plot)
  for (const [x, z] of plan.pumps || []) { if (!okSpot(x, z)) continue; pump(baker, world, x, z); }
  // ---- benches
  for (const [x, z, ang] of plan.benches || []) { if (!okSpot(x, z)) continue; bench(baker, world, x, z, ang); }
  // ---- coal heaps, hand carts, crates, barrels by the houses' yards
  for (const [x, z, kind, ang] of plan.yardProps || []) {
    if (!okSpot(x, z)) continue;
    if (kind === 'coal') { const g = new THREE.SphereGeometry(1.1, 10, 7); M.makeScale(1.3, 0.55, 1).setPosition(x, 0, z); baker.add(g, M.clone(), 'coal'); world.addCircle(x, z, 1.3); }
    if (kind === 'cart') handCart(baker, world, x, z, ang || 0);
    if (kind === 'crates') { for (let i = 0; i < 3; i++) { const g = new THREE.BoxGeometry(0.6, 0.4, 0.45); M.makeRotationY((ang || 0) + i * 0.2).setPosition(x + i * 0.15, 0.2 + (i === 2 ? 0.4 : 0), z + (i === 1 ? 0.5 : 0)); baker.add(g, M.clone(), 'planks'); } world.addCircle(x, z, 0.7); }
    if (kind === 'barrel') { const g = new THREE.CylinderGeometry(0.32, 0.28, 0.85, 10); M.identity().setPosition(x, 0.42, z); baker.add(g, M.clone(), 'trim_brown'); for (const y of [0.15, 0.7]) { const r = new THREE.TorusGeometry(0.31, 0.02, 4, 12); M.makeRotationX(Math.PI / 2).setPosition(x, y, z); baker.add(r, M.clone(), 'iron'); } world.addCircle(x, z, 0.35); }
    if (kind === 'wood') { for (let i = 0; i < 12; i++) { const g = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6); M.makeRotationZ(Math.PI / 2).multiply(new THREE.Matrix4().makeRotationY(ang || 0)).setPosition(x + (i % 4) * 0.17 - 0.25, 0.08 + Math.floor(i / 4) * 0.16, z); baker.add(g, M.clone(), 'bark'); } world.addCircle(x, z, 0.5); }
  }
  // ---- laundry lines: two posts and a line with sheets and shirts
  for (const [x0, z0, x1, z1] of plan.laundry || []) {
    if (!okSpot(x0, z0) || !okSpot(x1, z1)) continue;
    const L = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(z1 - z0, x1 - x0);
    for (const [x, z] of [[x0, z0], [x1, z1]]) { const g = new THREE.CylinderGeometry(0.05, 0.06, 2.1, 6); M.identity().setPosition(x, 1.05, z); baker.add(g, M.clone(), 'pole'); world.addCircle(x, z, 0.1); }
    wires.push([[x0, 2.0, z0], [x1, 2.0, z1]]);
    const n = Math.floor(L / 1.3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const w = 0.7 + hash(i * 7 + x0) * 0.6, h = 0.8 + hash(i * 3 + z0) * 0.7;
      const g = new THREE.PlaneGeometry(w, h); M.makeRotationY(-ang).setPosition(x0 + (x1 - x0) * t, 2.0 - h / 2 - 0.02, z0 + (z1 - z0) * t); baker.add(g, M.clone(), hash(i + x0 * 3) > 0.7 ? 'cloth_blue' : 'linen');
    }
  }
  // ---- allotment gardens (Schrebergärten): a plot with beds, a plank shed, a bean frame, a mesh fence
  for (const a of plan.allotments || []) allotment(baker, world, a, houses);
  // ---- fields / meadows: haystacks and a few fruit trees are placed by vegetation; here only a field boundary of posts
  // ---- garden strips (the co-operative's vegetable plots on the empty Marktplatz and the building plots)
  for (const g of plan.gardens || []) gardenStrips(baker, world, g);
  // ---- orchards and meadows of the old Schellmühl estate: rows of fruit trees, haystacks
  for (const o of plan.orchards || []) orchard(baker, world, o, houses, streets);
  // ---- the Reichskolonie-Sportplatz (1916): goal posts, a rope on posts round the pitch
  if (plan.pitch) pitch(baker, world, plan.pitch);
  // ---- the railway on the embankment (the Danzig-Neufahrwasser line), east of the colony, with the Bärenweg level crossing
  if (plan.rail) railway(baker, world, plan.rail, radius);
  if (plan.crossing) crossing(baker, world, plan.crossing, plan.rail);
  // ---- the wires
  if (wires.length) {
    const pos = [];
    for (const [a, b] of wires) { const n = 8; for (let i = 0; i < n; i++) { for (const t of [i / n, (i + 1) / n]) { const sag = Math.sin(t * Math.PI) * 0.4; pos.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    group.add(new THREE.LineSegments(g, mats.wire));
  }
  // ---- edge of the playable world
  const ringG = new THREE.RingGeometry(radius - 0.25, radius, 128); ringG.rotateX(-Math.PI / 2);
  const ringM = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })); ringM.position.y = 0.16; group.add(ringM);
}

export function gasLamp(baker, world, x, z) {
  const M = new THREE.Matrix4();
  const base = new THREE.CylinderGeometry(0.14, 0.2, 0.5, 8); M.identity().setPosition(x, 0.25, z); baker.add(base, M.clone(), 'iron');
  const post = new THREE.CylinderGeometry(0.05, 0.08, 3.0, 8); M.identity().setPosition(x, 1.9, z); baker.add(post, M.clone(), 'iron');
  const collar = new THREE.CylinderGeometry(0.1, 0.06, 0.2, 8); M.identity().setPosition(x, 3.45, z); baker.add(collar, M.clone(), 'iron');
  const lantern = new THREE.BoxGeometry(0.34, 0.5, 0.34); M.identity().setPosition(x, 3.85, z); baker.add(lantern, M.clone(), 'lamp');
  const frame = new THREE.BoxGeometry(0.4, 0.06, 0.4); M.identity().setPosition(x, 3.6, z); baker.add(frame, M.clone(), 'iron'); M.identity().setPosition(x, 4.1, z); baker.add(frame, M.clone(), 'iron');
  const cap = new THREE.ConeGeometry(0.3, 0.25, 4); M.makeRotationY(Math.PI / 4).setPosition(x, 4.25, z); baker.add(cap, M.clone(), 'iron');
  world.addCircle(x, z, 0.16);
}
function pump(baker, world, x, z) {
  const M = new THREE.Matrix4();
  const body = new THREE.CylinderGeometry(0.13, 0.16, 1.2, 8); M.identity().setPosition(x, 0.6, z); baker.add(body, M.clone(), 'metal_green');
  const top = new THREE.SphereGeometry(0.16, 8, 6); M.identity().setPosition(x, 1.22, z); baker.add(top, M.clone(), 'metal_green');
  const spout = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6); M.makeRotationZ(Math.PI / 2).setPosition(x + 0.2, 0.85, z); baker.add(spout, M.clone(), 'metal_green');
  const handle = new THREE.BoxGeometry(0.05, 0.9, 0.05); M.makeRotationZ(0.5).setPosition(x - 0.25, 1.35, z); baker.add(handle, M.clone(), 'iron');
  const trough = new THREE.BoxGeometry(1.0, 0.3, 0.5); M.identity().setPosition(x + 0.45, 0.15, z); baker.add(trough, M.clone(), 'trim_stone');
  const water = new THREE.BoxGeometry(0.9, 0.02, 0.4); M.identity().setPosition(x + 0.45, 0.28, z); baker.add(water, M.clone(), 'water');
  world.addCircle(x, z, 0.45);
}
function bench(baker, world, x, z, ang = 0) {
  const M = new THREE.Matrix4();
  const seat = new THREE.BoxGeometry(1.7, 0.06, 0.45); M.makeRotationY(ang).setPosition(x, 0.46, z); baker.add(seat, M.clone(), 'planks');
  const back = new THREE.BoxGeometry(1.7, 0.4, 0.05); M.makeRotationY(ang).multiply(new THREE.Matrix4().makeRotationX(-0.15)).setPosition(x - Math.sin(ang) * 0.22, 0.75, z - Math.cos(ang) * 0.22); baker.add(back, M.clone(), 'planks');
  for (const e of [-0.7, 0.7]) { const leg = new THREE.BoxGeometry(0.06, 0.46, 0.4); M.makeRotationY(ang).setPosition(x + Math.cos(ang) * e, 0.23, z - Math.sin(ang) * e); baker.add(leg, M.clone(), 'iron'); }
  world.addCircle(x, z, 0.6);
}
export function handCart(baker, world, x, z, ang = 0) {
  const M = new THREE.Matrix4();
  const box = new THREE.BoxGeometry(1.3, 0.45, 0.8); M.makeRotationY(ang).setPosition(x, 0.55, z); baker.add(box, M.clone(), 'planks');
  for (const e of [-0.42, 0.42]) { const w = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12); M.makeRotationY(ang).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).setPosition(x - Math.sin(ang) * e, 0.38, z - Math.cos(ang) * e); baker.add(w, M.clone(), 'trim_brown'); }
  for (const e of [-0.3, 0.3]) { const h = new THREE.BoxGeometry(1.2, 0.05, 0.05); M.makeRotationY(ang).multiply(new THREE.Matrix4().makeRotationZ(-0.35)).setPosition(x + Math.cos(ang) * 1.0, 0.45, z - Math.sin(ang) * 1.0 + e); baker.add(h, M.clone(), 'trim_brown'); }
  world.addCircle(x, z, 0.75);
}
function allotment(baker, world, a, houses) {
  const M = new THREE.Matrix4();
  const { x, z, w, d, ang = 0, shed = true } = a;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const P = (u, v) => [x + u * cos - v * sin, z + u * sin + v * cos];
  // beds: dark soil strips
  const nb = Math.max(1, Math.floor(w / 1.6));
  for (let i = 0; i < nb; i++) { const u = (i + 0.5) / nb * w - w / 2; const [bx, bz] = P(u, 0.3); const g = new THREE.BoxGeometry(1.1, 0.06, d - 2.4); M.makeRotationY(-ang).setPosition(bx, 0.03, bz); baker.add(g, M.clone(), 'soil');
    // a few cabbages / bean poles
    if (hash(i * 13 + x) > 0.5) for (let k = 0; k < 4; k++) { const [px, pz] = P(u, -d / 2 + 1.6 + k * (d - 2.8) / 4); const c = new THREE.SphereGeometry(0.22, 7, 5); M.makeScale(1, 0.7, 1).setPosition(px, 0.15, pz); baker.add(c, M.clone(), 'hedge'); }
    else for (let k = 0; k < 3; k++) { const [px, pz] = P(u, -d / 2 + 1.8 + k * (d - 3) / 3); const s = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4); M.identity().setPosition(px, 0.9, pz); baker.add(s, M.clone(), 'pole'); }
  }
  // fence: mesh on posts
  const corners = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
  for (let i = 0; i < 4; i++) {
    const A = corners[i], B = corners[(i + 1) % 4]; const L = Math.hypot(B[0] - A[0], B[1] - A[1]); const an = Math.atan2(A[1] - B[1], B[0] - A[0]);
    // a gate gap on side 0
    const segs = i === 0 ? [[0, L / 2 - 0.5], [L / 2 + 0.5, L]] : [[0, L]];
    for (const [t0, t1] of segs) {
      const mx = A[0] + (B[0] - A[0]) * (t0 + t1) / 2 / L, mz = A[1] + (B[1] - A[1]) * (t0 + t1) / 2 / L;
      const g = new THREE.PlaneGeometry(t1 - t0, 1.2); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (t1 - t0), uv.getY(k) * 1.2); M.makeRotationY(an).setPosition(mx, 0.6, mz); baker.add(g, M.clone(), 'mesh');
      world.addSegment(A[0] + (B[0] - A[0]) * t0 / L, A[1] + (B[1] - A[1]) * t0 / L, A[0] + (B[0] - A[0]) * t1 / L, A[1] + (B[1] - A[1]) * t1 / L, 0.08, 1.2);
    }
    for (let t = 0; t <= L + 0.01; t += 2.5) { const px = A[0] + (B[0] - A[0]) * Math.min(t, L) / L, pz = A[1] + (B[1] - A[1]) * Math.min(t, L) / L; const p = new THREE.BoxGeometry(0.09, 1.35, 0.09); M.identity().setPosition(px, 0.67, pz); baker.add(p, M.clone(), 'pole'); }
  }
  // shed in the back corner
  if (shed) {
    const [sx, sz] = P(w / 2 - 1.3, d / 2 - 1.2);
    const box = new THREE.BoxGeometry(2.2, 2.1, 1.9); M.makeRotationY(-ang).setPosition(sx, 1.05, sz); baker.add(box, M.clone(), 'planks');
    const roof = new THREE.BoxGeometry(2.5, 0.08, 2.2); M.makeRotationY(-ang).multiply(new THREE.Matrix4().makeRotationX(0.18)).setPosition(sx, 2.2, sz); baker.add(roof, M.clone(), 'roof_tar');
    const door = new THREE.PlaneGeometry(0.8, 1.7); M.makeRotationY(-ang + Math.PI).setPosition(sx - sin * -0.96 * -1, 0.9, sz + cos * -0.96); baker.add(door, M.clone(), 'plank_door');
    const ring = [P(w / 2 - 2.4, d / 2 - 2.15), P(w / 2 - 0.2, d / 2 - 2.15), P(w / 2 - 0.2, d / 2 - 0.25), P(w / 2 - 2.4, d / 2 - 0.25)];
    world.addPolygon(ring);
    // water butt
    const [bx, bz] = P(w / 2 - 2.7, d / 2 - 1.2); const b = new THREE.CylinderGeometry(0.3, 0.28, 0.8, 10); M.identity().setPosition(bx, 0.4, bz); baker.add(b, M.clone(), 'trim_brown'); world.addCircle(bx, bz, 0.32);
  }
}
function gardenStrips(baker, world, g) {
  // g: { x, z, w, d, ang } — parallel beds with a path between, a few cabbages and bean poles, no fence
  const M = new THREE.Matrix4(); const cos = Math.cos(g.ang || 0), sin = Math.sin(g.ang || 0);
  const P = (u, v) => [g.x + u * cos - v * sin, g.z + u * sin + v * cos];
  const n = Math.max(1, Math.floor(g.w / 2.2));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n * g.w - g.w / 2; const [bx, bz] = P(u, 0);
    const bed = new THREE.BoxGeometry(1.5, 0.05, g.d); M.makeRotationY(-(g.ang || 0)).setPosition(bx, 0.025, bz); baker.add(bed, M.clone(), 'soil');
    const k = hash(i * 17 + Math.round(g.x));
    if (k < 0.35) for (let j = 0; j < Math.floor(g.d / 1.2); j++) { const [px, pz] = P(u, -g.d / 2 + 0.6 + j * 1.2); const c = new THREE.SphereGeometry(0.2, 6, 5); M.makeScale(1, 0.6, 1).setPosition(px, 0.12, pz); baker.add(c, M.clone(), 'hedge'); }
    else if (k < 0.55) for (let j = 0; j < Math.floor(g.d / 2.5); j++) { const [px, pz] = P(u, -g.d / 2 + 1.2 + j * 2.5); const s = new THREE.CylinderGeometry(0.02, 0.02, 1.9, 4); M.identity().setPosition(px, 0.95, pz); baker.add(s, M.clone(), 'pole'); }
  }
  // a hand pump or a water butt at one end
  const [wx, wz] = P(-g.w / 2 + 0.6, g.d / 2 - 0.6); const b = new THREE.CylinderGeometry(0.3, 0.28, 0.8, 10); M.identity().setPosition(wx, 0.4, wz); baker.add(b, M.clone(), 'trim_brown'); world.addCircle(wx, wz, 0.32, 0.8);
}
function orchard(baker, world, o, houses, streets) {
  // o: { x, z, w, d, ang, spacing, hay } — a grid of small fruit trees, some haystacks
  const M = new THREE.Matrix4(); const cos = Math.cos(o.ang || 0), sin = Math.sin(o.ang || 0);
  const P = (u, v) => [o.x + u * cos - v * sin, o.z + u * sin + v * cos];
  const crown = new THREE.IcosahedronGeometry(1, 1); const trunk = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
  const sp = o.spacing || 7;
  for (let u = -o.w / 2 + sp / 2; u < o.w / 2; u += sp) for (let v = -o.d / 2 + sp / 2; v < o.d / 2; v += sp) {
    const [x, z] = P(u + (hash(u * 3 + v) - 0.5) * 1.5, v + (hash(u + v * 5) - 0.5) * 1.5);
    if (houses.some((h) => h && ptIn(x, z, h.ring, 3))) continue;
    if (streets.onRoad(x, z, 3)) continue;
    if (hash(u * 7 + v * 11 + o.x) > 0.85) continue;
    const H = 1.8 + hash(u + v) * 0.8, R = 1.4 + hash(u * 2 + v) * 0.9;
    M.makeScale(1, H, 1).setPosition(x, H / 2, z); baker.add(trunk, M.clone(), 'bark');
    M.makeScale(R, R * 0.8, R).setPosition(x, H + R * 0.5, z); baker.add(crown, M.clone(), hash(u * 5 + v * 3) > 0.5 ? 'foliage' : 'foliage_olive');
    world.addCircle(x, z, 0.2);
  }
  for (let i = 0; i < (o.hay || 0); i++) {
    const [x, z] = P((hash(i * 13 + o.x) - 0.5) * o.w * 0.8, (hash(i * 7 + o.z) - 0.5) * o.d * 0.8);
    if (streets.onRoad(x, z, 3)) continue;
    const g = new THREE.ConeGeometry(2.2, 3.2, 10); M.identity().setPosition(x, 1.6, z); baker.add(g, M.clone(), 'gravel');
    world.addCircle(x, z, 2.1);
  }
}
function pitch(baker, world, p) {
  const M = new THREE.Matrix4(); const cos = Math.cos(p.ang || 0), sin = Math.sin(p.ang || 0);
  const P = (u, v) => [p.x + u * cos - v * sin, p.z + u * sin + v * cos];
  // worn ground: a lighter, trampled rectangle
  const g = new THREE.PlaneGeometry(p.w, p.d, 8, 6); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * p.w / 2, uv.getY(i) * p.d / 2);
  M.makeRotationY(-(p.ang || 0)).setPosition(p.x, 0.02, p.z); baker.add(g, M.clone(), 'gravel');
  // goals at the two ends (7.32 x 2.44), wooden
  for (const e of [-1, 1]) {
    const [gx, gz] = P(e * (p.w / 2 - 2), 0);
    for (const s of [-3.66, 3.66]) { const [px, pz] = P(e * (p.w / 2 - 2), s); const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 6); M.identity().setPosition(px, 1.22, pz); baker.add(post, M.clone(), 'white'); world.addCircle(px, pz, 0.1); }
    const bar = new THREE.CylinderGeometry(0.06, 0.06, 7.32, 6); M.makeRotationY(-(p.ang || 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).setPosition(gx, 2.44, gz); baker.add(bar, M.clone(), 'white');
  }
  // posts with a rope along the touchlines, a few metres out
  for (const side of [-1, 1]) for (let u = -p.w / 2; u <= p.w / 2; u += 8) { const [px, pz] = P(u, side * (p.d / 2 + 2)); const post = new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5); M.identity().setPosition(px, 0.55, pz); baker.add(post, M.clone(), 'pole'); }
}
function crossing(baker, world, c, rail) {
  // c: { x, z, ang (road direction), width } — plank deck over the tracks and two raised barrier poles
  const M = new THREE.Matrix4(); const cos = Math.cos(c.ang), sin = Math.sin(c.ang);
  const h = (rail?.height || 0.5) + 0.22;
  const deck = new THREE.BoxGeometry(c.width || 6, 0.08, (rail?.width || 10) + 1); M.makeRotationY(-c.ang).setPosition(c.x, h, c.z); baker.add(deck, M.clone(), 'planks');
  for (const e of [-1, 1]) {
    const d = (rail?.width || 10) / 2 + 5;
    const px = c.x - sin * e * d, pz = c.z + cos * e * d;   // along the road, either side of the tracks
    const side = (c.width || 6) / 2 + 0.8;
    const bx = px + cos * side * e, bz = pz + sin * side * e;
    const post = new THREE.BoxGeometry(0.25, 2.2, 0.25); M.identity().setPosition(bx, 1.1, bz); baker.add(post, M.clone(), 'trim_dark');
    // the barrier pole, raised (train not due): red-white, leaning up from the post
    const pole = new THREE.CylinderGeometry(0.06, 0.06, 6.5, 6); M.makeRotationY(-c.ang).multiply(new THREE.Matrix4().makeRotationZ(-e * 1.15)).setPosition(bx - cos * e * 1.6, 3.9, bz - sin * e * 1.6); baker.add(pole, M.clone(), 'white');
    for (let k = 0; k < 4; k++) { const band = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6); const t = -2.6 + k * 1.6; M.makeRotationY(-c.ang).multiply(new THREE.Matrix4().makeRotationZ(-e * 1.15)).setPosition(bx - cos * e * 1.6 - Math.sin(1.15) * e * cos * t * 0, 3.9 + Math.cos(1.15) * t, bz - sin * e * 1.6); baker.add(band, M.clone(), 'red'); }
    world.addCircle(bx, bz, 0.3);
    // a cross-buck sign (Andreaskreuz)
    const sp = new THREE.CylinderGeometry(0.04, 0.04, 3, 6); M.identity().setPosition(bx - cos * e * 0.9, 1.5, bz - sin * e * 0.9); baker.add(sp, M.clone(), 'pole');
    for (const r of [0.6, -0.6]) { const arm = new THREE.BoxGeometry(1.1, 0.14, 0.04); M.makeRotationY(-c.ang).multiply(new THREE.Matrix4().makeRotationZ(r)).setPosition(bx - cos * e * 0.9, 2.7, bz - sin * e * 0.9); baker.add(arm, M.clone(), 'white'); }
  }
}
function railway(baker, world, rail, radius) {
  // rail: { pts: [[x,z]...], width, height } — an embankment with two tracks
  const M = new THREE.Matrix4();
  const pts = resamplePolyline(rail.pts, 4);
  // embankment: a wide ribbon raised by height, with sloped sides approximated by two lower steps
  for (const [w, y, key] of [[rail.width + 8, rail.height * 0.35, 'grass'], [rail.width + 3.5, rail.height * 0.7, 'grass'], [rail.width, rail.height, 'gravel']]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ang = Math.atan2(a[1] - b[1], b[0] - a[0]);
      const g = new THREE.BoxGeometry(L + 0.5, y, w); M.makeRotationY(ang).setPosition((a[0] + b[0]) / 2, y / 2, (a[1] + b[1]) / 2); baker.add(g, M.clone(), key);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ang = Math.atan2(a[1] - b[1], b[0] - a[0]);
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; const nx = -dz, nz = dx;
    for (const off of rail.tracks || [-2.2, 2.2]) {
      const cx = (a[0] + b[0]) / 2 + nx * off, cz = (a[1] + b[1]) / 2 + nz * off;
      for (const e of [-0.72, 0.72]) { const r = new THREE.BoxGeometry(L + 0.2, 0.14, 0.07); M.makeRotationY(ang).setPosition(cx + nx * e, rail.height + 0.2, cz + nz * e); baker.add(r, M.clone(), 'iron'); }
      const n = Math.floor(L / 0.7);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; const s = new THREE.BoxGeometry(0.24, 0.14, 2.4); M.makeRotationY(ang).setPosition(a[0] + (b[0] - a[0]) * t + nx * off, rail.height + 0.07, a[1] + (b[1] - a[1]) * t + nz * off); baker.add(s, M.clone(), 'trim_brown'); }
    }
  }
  // fence at the foot of the embankment on the colony side, with a gap at the crossing
  const side = rail.fenceSide || -1; const gap = rail.gap; // gap: [x, z, halfWidth]
  const inGap = (x, z) => gap && Math.hypot(x - gap[0], z - gap[1]) < gap[2];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; const nx = -dz, nz = dx; const off = side * (rail.width / 2 + 4.5);
    const A = [a[0] + nx * off, a[1] + nz * off], B = [b[0] + nx * off, b[1] + nz * off];
    if (inGap((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)) continue;
    world.addSegment(A[0], A[1], B[0], B[1], 0.1, 1.3);
    for (let t = 0; t < L; t += 3) { const p = new THREE.BoxGeometry(0.1, 1.3, 0.1); M.identity().setPosition(A[0] + dx * t, 0.65, A[1] + dz * t); baker.add(p, M.clone(), 'pole'); }
  }
  // the embankment blocks the walker, except at the crossing
  const w2 = rail.width / 2 + 4; const L0 = [], R0 = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l; L0.push([pts[i][0] + nx * w2, pts[i][1] + nz * w2]); R0.push([pts[i][0] - nx * w2, pts[i][1] - nz * w2]); }
  for (let i = 0; i < pts.length - 1; i++) {
    if (inGap((L0[i][0] + L0[i + 1][0]) / 2, (L0[i][1] + L0[i + 1][1]) / 2)) continue;
    world.addSegment(L0[i][0], L0[i][1], L0[i + 1][0], L0[i + 1][1]); world.addSegment(R0[i][0], R0[i][1], R0[i + 1][0], R0[i + 1][1]);
  }
}
function ptIn(x, z, r, pad) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
  if (ins) return true;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < pad) return true; }
  return false;
}
