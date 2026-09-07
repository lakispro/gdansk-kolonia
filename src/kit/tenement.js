import * as THREE from 'three';
import { xz, ensureCCW, polyArea, obb, offsetPoly, wallQuad, polyGeom, faceGeom, hash, pointInPoly } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * The 1920 building generator: Langfuhr tenements (Mietshäuser) in red
 * brick or lime plaster with rusticated plinths, storey cornices, sash-and-
 * casement windows under segmental brick arches, panelled double doors,
 * steep pantile roofs with dormers and tall chimneys; smaller workers'
 * houses; plank sheds and Hinterhäuser with tar-paper roofs; brick
 * workshops.
 *
 * Input: a footprint polygon (OSM or reconstructed from the 1920 plan),
 * the LiDAR height where the building still stands, and a style record.
 * The footprint is decomposed into rectangles in its own oriented frame
 * and each rectangle gets a roof whose ridge runs along it.
 * ------------------------------------------------------------------ */

const OVERHANG = 0.35, GABLE_OVER = 0.25;

/** rectangle decomposition of a (roughly) rectilinear polygon in its OBB frame */
export function decompose(ring) {
  const o = obb(ring);
  const c = Math.cos(-o.ang), s = Math.sin(-o.ang);
  const loc = ring.map((p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
  let rect = true;
  for (let i = 0; i < loc.length; i++) {
    const p = loc[i], q = loc[(i + 1) % loc.length]; const dx = Math.abs(q[0] - p[0]), dz = Math.abs(q[1] - p[1]);
    if (Math.hypot(dx, dz) < 0.4) continue;
    const a = Math.atan2(Math.min(dx, dz), Math.max(dx, dz)); if (a > 0.18) { rect = false; break; }
  }
  const toWorld = (u, v) => [u * Math.cos(o.ang) - v * Math.sin(o.ang), u * Math.sin(o.ang) + v * Math.cos(o.ang)];
  const rects = [];
  const pushRect = (u0, u1, v0, v1) => {
    let w = u1 - u0, h = v1 - v0, ang = o.ang; const [cx, cz] = toWorld((u0 + u1) / 2, (v0 + v1) / 2);
    if (h > w) { const t = w; w = h; h = t; ang += Math.PI / 2; }
    rects.push({ cx, cz, ang, w, h, area: w * h });
  };
  if (!rect || o.fill > 0.86) {
    const us = loc.map((p) => p[0]), vs = loc.map((p) => p[1]);
    pushRect(Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs));
    return { rects, rectilinear: rect, obb: o };
  }
  const uniq = (arr) => { const s = [...arr].sort((a, b) => a - b); const out = []; for (const v of s) if (!out.length || v - out[out.length - 1] > 0.35) out.push(v); return out; };
  const U = uniq(loc.map((p) => p[0])), V = uniq(loc.map((p) => p[1]));
  const nu = U.length - 1, nv = V.length - 1;
  const inside = []; const covered = [];
  for (let i = 0; i < nu; i++) { inside.push([]); covered.push([]); for (let j = 0; j < nv; j++) { inside[i].push(pointInPoly((U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2, loc)); covered[i].push(false); } }
  let guard = 0;
  while (guard++ < 12) {
    let best = null;
    for (let i0 = 0; i0 < nu; i0++) for (let i1 = i0; i1 < nu; i1++) for (let j0 = 0; j0 < nv; j0++) for (let j1 = j0; j1 < nv; j1++) {
      let ok = true, anyNew = false;
      for (let i = i0; i <= i1 && ok; i++) for (let j = j0; j <= j1; j++) { if (!inside[i][j]) { ok = false; break; } if (!covered[i][j]) anyNew = true; }
      if (!ok || !anyNew) continue;
      const w = U[i1 + 1] - U[i0], h = V[j1 + 1] - V[j0]; const area = w * h;
      if (!best || area > best.area) best = { i0, i1, j0, j1, area, w, h };
    }
    if (!best) break;
    for (let i = best.i0; i <= best.i1; i++) for (let j = best.j0; j <= best.j1; j++) covered[i][j] = true;
    if (Math.min(best.w, best.h) >= 1.5 && best.area >= 5) pushRect(U[best.i0], U[best.i1 + 1], V[best.j0], V[best.j1 + 1]);
  }
  rects.sort((a, b) => b.area - a.area);
  return { rects, rectilinear: true, obb: o };
}

/**
 * @param b   { id, ring (ENU), h (LiDAR, may be null), area, addr, type }
 * @param ctx { baker, world, streetDist(x,z)->{d,nx,nz}, plate(no, geom, matrix), sign(text, x,y,z, ang, w) }
 * @param st  style: { kind: 'tenement'|'house'|'shed'|'workshop'|'barn', wall, storeys, roof, pitch, dormers, shop, window, door, storeyH }
 */
export function buildBuilding(b, ctx, st = {}) {
  const { baker } = ctx;
  let ring = ensureCCW(b.ring.map(xz));
  ring = ring.filter((p, i) => { const q = ring[(i + 1) % ring.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.15; });
  if (ring.length < 3) return null;
  const area = Math.abs(polyArea(ring));
  const kind = st.kind || (area < 30 ? 'shed' : area < 90 ? 'house' : 'tenement');
  const isShed = kind === 'shed' || kind === 'barn';
  const STOREY = st.storeyH || (kind === 'tenement' ? 3.3 : kind === 'workshop' ? 4.2 : 2.9);
  const seed = hash(typeof b.id === 'number' ? b.id : (b.id.length * 7919 + Math.round(area)));
  const wallK = st.wall || (isShed ? 'planks' : kind === 'workshop' ? 'brick_red' : seed < 0.45 ? 'brick_red' : seed < 0.55 ? 'brick_yellow' : 'wall_' + ['ochre', 'cream', 'grey', 'sand', 'olive', 'rose', 'white'][Math.floor(hash(seed * 1e6) * 7)]);
  const isBrick = wallK.startsWith('brick');
  const roofK = 'roof_' + (st.roof || (isShed ? 'tar' : kind === 'workshop' ? 'dark' : seed < 0.6 ? 'red' : seed < 0.85 ? 'brown' : 'orange'));
  const { rects, rectilinear } = decompose(ring);
  const main = rects[0];
  let roofKind = st.roofKind || (isShed ? (area < 12 ? 'shed' : 'gable') : kind === 'workshop' ? (main.w / main.h > 1.6 ? 'gable' : 'flat') : (!rectilinear && main.w / main.h < 1.3 ? 'hip' : (main.w / main.h < 1.2 && area > 160 ? 'hip' : 'gable')));
  const pitch = THREE.MathUtils.degToRad(st.pitch || (roofKind === 'hip' ? 38 : roofKind === 'shed' ? 18 : isShed ? 32 : kind === 'workshop' ? 25 : 45));
  const tanP = Math.tan(pitch);
  // storeys and eaves: from the style, else the LiDAR height, else the kind
  let storeys = st.storeys || 0;
  if (!storeys) {
    if (b.h && !isShed) { const rise = (main.h / 2 + OVERHANG) * tanP; const eav = Math.max(2.6, b.h - rise * 0.5); storeys = Math.max(1, Math.round((eav - 0.7) / STOREY)); }
    else storeys = isShed ? 1 : kind === 'tenement' ? 3 : kind === 'workshop' ? 1 : 2;
    if (kind === 'tenement') storeys = Math.min(4, Math.max(2, storeys));
  }
  const plinthH = isShed ? 0.2 : kind === 'tenement' ? 0.9 : 0.5;
  const eaves = roofKind === 'flat' ? plinthH + storeys * STOREY : plinthH + storeys * STOREY + 0.25;
  // the whole building sits on one level: the terrain height at its centre (highest corner on a slope)
  let baseY = 0;
  if (baker.ground) { baseY = -Infinity; for (const p of ring) baseY = Math.max(baseY, baker.ground(p[0], p[1])); baseY = Math.min(baseY, baker.ground(main.cx, main.cz) + 0.35); }
  baker.base = baseY;

  // ---------------- walls
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], q = ring[(i + 1) % ring.length];
    baker.add(wallQuad(a[0], a[1], q[0], q[1], -1.0, eaves, 2, true), null, wallK);
  }
  // the colony houses: brick ground floor under plastered upper storeys (Heimatstil, 1908-1912)
  if (st.brickBase && !isBrick) { const pb = offsetPoly(ring, 0.02); for (let i = 0; i < pb.length; i++) { const a = pb[i], q = pb[(i + 1) % pb.length]; baker.add(wallQuad(a[0], a[1], q[0], q[1], plinthH - 0.05, plinthH + STOREY - 0.15, 2, true), null, 'brick_red'); } }
  // plinth
  const pl = offsetPoly(ring, 0.03);
  for (let i = 0; i < pl.length; i++) { const a = pl[i], q = pl[(i + 1) % pl.length]; baker.add(wallQuad(a[0], a[1], q[0], q[1], -1.0, plinthH, 2, true), null, isShed ? 'plinth' : kind === 'tenement' ? 'rustic' : 'plinth'); }
  // storey cornices and the main cornice (tenements and plastered houses)
  if (!isShed && kind !== 'workshop') {
    const bands = [];
    for (let s = 1; s < storeys; s++) bands.push([plinthH + s * STOREY - 0.05, 0.12, 0.07]);
    bands.push([eaves - 0.36, 0.34, isBrick ? 0.16 : 0.24]);
    for (const [y, hh, out] of bands) { const ring2 = offsetPoly(ring, out); for (let i = 0; i < ring2.length; i++) { const a = ring2[i], q = ring2[(i + 1) % ring2.length]; baker.add(wallQuad(a[0], a[1], q[0], q[1], y, y + hh, 1, true), null, isBrick ? 'brick_dark' : 'trim_stone'); } baker.add(polyGeom(ring2, y + hh, 2), null, isBrick ? 'brick_dark' : 'trim_stone'); }
    // corner pilasters on plastered fronts
    if (!isBrick && kind === 'tenement') for (const p of ring) { const g = new THREE.BoxGeometry(0.42, eaves - plinthH, 0.42); const M = new THREE.Matrix4().setPosition(p[0], (eaves + plinthH) / 2, p[1]); baker.add(g, M, 'trim_stone'); }
  }
  // ceiling cap so no hollow shows between roofs
  baker.add(polyGeom(ring, eaves - 0.02, 2), null, roofK);

  // ---------------- roofs
  const roofRects = [];
  const chimneys = st.chimneys ?? (isShed ? 0 : kind === 'tenement' ? 2 + Math.floor(seed * 2) : 1);
  if (roofKind === 'flat') {
    const cap = offsetPoly(ring, 0.2);
    baker.add(polyGeom(cap, eaves + 0.1, 2), null, 'roof_tar');
    for (let i = 0; i < cap.length; i++) { const a = cap[i], q = cap[(i + 1) % cap.length]; baker.add(wallQuad(a[0], a[1], q[0], q[1], eaves - 0.15, eaves + 0.1, 1, true), null, 'trim_dark'); }
    if (chimneys) chimney(baker, [main.cx, main.cz], eaves + 0.1, 1.6, main.ang, 'chimney');
  } else {
    for (let k = 0; k < rects.length; k++) {
      const r = rects[k];
      const rk = roofKind === 'hip' && k === 0 ? 'hip' : roofKind === 'mansard' && k === 0 ? 'mansard' : (roofKind === 'shed' ? 'shed' : 'gable');
      const rr = roofOnRect(baker, r, eaves, tanP, rk, roofK, wallK, b, isShed);
      roofRects.push(rr);
      if (k === 0 && chimneys) {
        for (let c = 0; c < chimneys; c++) { const u = (c + 1) / (chimneys + 1) * r.w - r.w / 2 + (hash(seed * 31 + c) - 0.5) * 1.5; const cx = r.cx + u * Math.cos(r.ang), cz = r.cz + u * Math.sin(r.ang); chimney(baker, [cx, cz], rr.ridgeY, kind === 'tenement' ? 2.0 : 1.4, r.ang, 'chimney'); }
      }
      // dormers on the street side of tenements
      const nd = st.dormers ?? (kind === 'tenement' && rk === 'gable' ? Math.max(0, Math.floor(r.w / 6)) : 0);
      if (nd && (rk === 'gable' || rk === 'mansard')) dormers(baker, r, rr, nd, roofK, wallK, ctx);
    }
  }

  // ---------------- facade
  const door = facade(baker, ring, eaves, storeys, b, ctx, wallK, kind, roofRects, plinthH, STOREY, st, seed);
  baker.base = null;
  ctx.world.addPolygon(ring);
  return { ring, eaves, storeys, door, kind, rects, roofK, wallK, style: st, baseY };
}

function chimney(baker, [x, z], ridgeY, hh, ang, key) {
  const M = new THREE.Matrix4();
  const g = new THREE.BoxGeometry(0.6, hh + 1.2, 0.9); M.makeRotationY(-ang).setPosition(x, ridgeY + hh / 2 - 0.4, z); baker.add(g, M.clone(), key);
  const cap = new THREE.BoxGeometry(0.76, 0.14, 1.06); M.makeRotationY(-ang).setPosition(x, ridgeY + hh + 0.22, z); baker.add(cap, M.clone(), 'trim_stone');
  for (const e of [-0.22, 0.22]) { const pot = new THREE.CylinderGeometry(0.11, 0.13, 0.4, 8); M.makeRotationY(-ang).setPosition(x - Math.sin(ang) * e, ridgeY + hh + 0.48, z + Math.cos(ang) * e); baker.add(pot, M.clone(), 'trim_dark'); }
}

function dormers(baker, r, rr, n, roofK, wallK, ctx) {
  const M = new THREE.Matrix4(); const cos = Math.cos(r.ang), sin = Math.sin(r.ang);
  // which long side faces the street?
  let side = 1; { const a = [r.cx - sin * r.h, r.cz + cos * r.h], b = [r.cx + sin * r.h, r.cz - cos * r.h]; side = ctx.streetDist(a[0], a[1]).d < ctx.streetDist(b[0], b[1]).d ? -1 : 1; }
  if (rr.breakY) {
    // mansard: windows set into the steep lower slope, each under a little tiled hood
    const W = r.h / 2 + OVERHANG; const tanS = Math.tan(1.2);
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / (n + 1) * r.w - r.w / 2; const inset = 0.55; const v = side * (W - inset); const y = rr.eaveY + inset * tanS + 0.7;
      const x = r.cx + u * cos - v * sin, z = r.cz + u * sin + v * cos;
      const box = new THREE.BoxGeometry(1.1, 1.4, 0.5); M.makeRotationY(-r.ang).setPosition(x, y, z); baker.add(box, M.clone(), wallK);
      const win = new THREE.PlaneGeometry(0.85, 1.05); M.makeRotationY(-r.ang + (side > 0 ? 0 : Math.PI)).setPosition(x - sin * side * 0.27, y, z + cos * side * 0.27); baker.add(win, M.clone(), 'window_small');
      const hood = new THREE.BoxGeometry(1.4, 0.1, 0.9); M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationX(side * 0.5)).setPosition(x - sin * side * 0.15, y + 0.85, z + cos * side * 0.15); baker.add(hood, M.clone(), roofK);
    }
    return;
  }
  const t = (rr.ridgeY - rr.eaveY) / (r.h / 2 + OVERHANG);
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / (n + 1) * r.w - r.w / 2; const v = side * (r.h / 2 - 1.5); const y0 = rr.eaveY + (r.h / 2 + OVERHANG - 1.5) * t;
    const x = r.cx + u * cos - v * sin, z = r.cz + u * sin + v * cos;
    const w = 1.5, h = 1.6, d = 1.4;
    const box = new THREE.BoxGeometry(w, h, d); M.makeRotationY(-r.ang).setPosition(x, y0 + h / 2 - 0.1, z); baker.add(box, M.clone(), wallK);
    const roof = new THREE.BoxGeometry(w + 0.3, 0.12, d + 0.3); M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationX(side * 0.35)).setPosition(x, y0 + h + 0.15, z); baker.add(roof, M.clone(), roofK);
    const win = new THREE.PlaneGeometry(0.8, 1.0); M.makeRotationY(-r.ang + (side > 0 ? 0 : Math.PI)).setPosition(x - sin * side * (d / 2 + 0.02), y0 + h / 2 - 0.05, z + cos * side * (d / 2 + 0.02)); baker.add(win, M.clone(), 'window_small');
  }
}

/** builds a roof over an oriented rectangle. returns {ridgeY, eaveY, r} */
function roofOnRect(baker, r, eaves, tanP, kind, roofK, wallK, b, isShed) {
  const L = r.w / 2 + GABLE_OVER, W = r.h / 2 + OVERHANG;
  const eaveY = eaves - OVERHANG * tanP;
  const ridgeY = eaveY + W * tanP;
  const cos = Math.cos(r.ang), sin = Math.sin(r.ang);
  const P = (u, v, y) => [r.cx + u * cos - v * sin, y, r.cz + u * sin + v * cos];
  const M = new THREE.Matrix4();
  if (kind === 'mansard') {
    // gambrel: steep lower slope to a break, then a shallow upper slope to the ridge
    const bk = W * 0.42; const breakY = eaveY + (W - bk) * Math.tan(1.2); const ridgeM = breakY + bk * 0.55;
    for (const e of [-1, 1]) {
      const lo = [P(-L, e * W, eaveY), P(L, e * W, eaveY), P(L, e * bk, breakY), P(-L, e * bk, breakY)]; if (e < 0) lo.reverse();
      const up = [P(-L, e * bk, breakY), P(L, e * bk, breakY), P(L, 0, ridgeM), P(-L, 0, ridgeM)]; if (e < 0) up.reverse();
      baker.add(faceGeom(lo, 2), null, roofK); baker.add(faceGeom(up, 2), null, roofK);
      // eaves fascia and gutter
      const g = new THREE.BoxGeometry(2 * L, 0.16, 0.14); const p = P(0, e * (W + 0.02), eaveY - 0.08); M.makeRotationY(-r.ang).setPosition(p[0], p[1], p[2]); baker.add(g, M.clone(), 'trim_brown');
      const gu = new THREE.CylinderGeometry(0.07, 0.07, 2 * L, 8); const q = P(0, e * (W + 0.12), eaveY - 0.02); M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).setPosition(q[0], q[1], q[2]); baker.add(gu, M.clone(), 'gutter');
      const und = [P(-L, e * W, eaveY - 0.14), P(L, e * W, eaveY - 0.14), P(L, e * (r.h / 2 - 0.01), eaveY - 0.14), P(-L, e * (r.h / 2 - 0.01), eaveY - 0.14)]; if (e > 0) und.reverse(); baker.add(faceGeom(und, 1), null, 'trim_brown');
    }
    // gable ends: a pentagon in the wall material, tile-hung above the break in the colony style
    for (const e of [-1, 1]) {
      const u = e * r.w / 2; const bkw = bk * (r.h / 2) / W;
      const pent = [P(u, -r.h / 2, eaves - 0.02), P(u, r.h / 2, eaves - 0.02), P(u, bkw, breakY - 0.02), P(u, 0, ridgeM - 0.02), P(u, -bkw, breakY - 0.02)];
      if (e < 0) pent.reverse();
      baker.add(faceGeom(pent, 2), null, wallK);
      // bargeboards
      const uB = e * (L - 0.06);
      for (const [v0, y0, v1, y1] of [[W, eaveY, bk, breakY], [-W, eaveY, -bk, breakY], [bk, breakY, 0, ridgeM], [-bk, breakY, 0, ridgeM]]) {
        const len = Math.hypot(v1 - v0, y1 - y0); const ang = Math.atan2(y1 - y0, v1 - v0); const gg = new THREE.BoxGeometry(0.06, 0.2, len); const mid = P(uB, (v0 + v1) / 2, (y0 + y1) / 2 - 0.06);
        M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationX(-ang)).setPosition(mid[0], mid[1], mid[2]); baker.add(gg, M.clone(), 'trim_brown');
      }
    }
    const rg = new THREE.BoxGeometry(2 * L, 0.12, 0.3); M.makeRotationY(-r.ang).setPosition(r.cx, ridgeM + 0.03, r.cz); baker.add(rg, M.clone(), 'trim_dark');
    return { ridgeY: ridgeM, eaveY, r, breakY };
  }
  if (kind === 'gable' || kind === 'shed') {
    let ridgeV = 0, ridgeYk = ridgeY;
    if (kind === 'shed') { ridgeV = -r.h / 2; ridgeYk = eaveY + (r.h + OVERHANG) * tanP; }
    const s1 = [P(-L, W, eaveY), P(L, W, eaveY), P(L, ridgeV, ridgeYk), P(-L, ridgeV, ridgeYk)];
    baker.add(faceGeom(s1, 2), null, roofK);
    if (kind === 'gable') { const s2 = [P(L, -W, eaveY), P(-L, -W, eaveY), P(-L, 0, ridgeY), P(L, 0, ridgeY)]; baker.add(faceGeom(s2, 2), null, roofK); }
    for (const e of [-1, 1]) {
      const u = e * r.w / 2;
      const tri = kind === 'gable'
        ? [P(u, -r.h / 2, eaves - 0.02), P(u, r.h / 2, eaves - 0.02), P(u, 0, eaves + (r.h / 2) * tanP)]
        : [P(u, r.h / 2, eaves - 0.02), P(u, -r.h / 2, eaves - 0.02), P(u, -r.h / 2, eaves + r.h * tanP)];
      if (e < 0) tri.reverse();
      baker.add(faceGeom(tri, 2), null, wallK);
      const uB = e * (L - 0.06);
      const rakes = kind === 'gable' ? [[W, eaveY, 0, ridgeY], [-W, eaveY, 0, ridgeY]] : [[W, eaveY, -r.h / 2, eaveY + (r.h + OVERHANG) * tanP]];
      for (const [v0, y0, v1, y1] of rakes) {
        const len = Math.hypot(v1 - v0, y1 - y0); const ang = Math.atan2(y1 - y0, v1 - v0);
        const g = new THREE.BoxGeometry(0.06, 0.22, len);
        const mid = P(uB, (v0 + v1) / 2, (y0 + y1) / 2 - 0.06);
        M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationX(-ang)).setPosition(mid[0], mid[1], mid[2]);
        baker.add(g, M.clone(), 'trim_brown');
      }
    }
    if (kind === 'gable') { const g = new THREE.BoxGeometry(2 * L, 0.12, 0.3); M.makeRotationY(-r.ang).setPosition(r.cx, ridgeY + 0.03, r.cz); baker.add(g, M.clone(), 'trim_dark'); }
    for (const e of (kind === 'gable' ? [-1, 1] : [1])) {
      const g = new THREE.BoxGeometry(2 * L, 0.16, 0.14); const p = P(0, e * (W + 0.02), eaveY - 0.08);
      M.makeRotationY(-r.ang).setPosition(p[0], p[1], p[2]); baker.add(g, M.clone(), 'trim_brown');
      if (!isShed) { const gu = new THREE.CylinderGeometry(0.07, 0.07, 2 * L, 8); const q = P(0, e * (W + 0.12), eaveY - 0.02);
        M.makeRotationY(-r.ang).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).setPosition(q[0], q[1], q[2]); baker.add(gu, M.clone(), 'gutter');
        for (const ee of [-1, 1]) { const dp = new THREE.CylinderGeometry(0.05, 0.05, eaveY + 0.2, 6); const d = P(ee * (r.w / 2 - 0.3), e * (r.h / 2 + 0.09), eaveY / 2 - 0.1); M.identity().setPosition(d[0], d[1], d[2]); baker.add(dp, M.clone(), 'gutter'); } }
    }
    const u1 = [P(-L, W, eaveY - 0.14), P(L, W, eaveY - 0.14), P(L, r.h / 2 - 0.01, eaveY - 0.14), P(-L, r.h / 2 - 0.01, eaveY - 0.14)];
    baker.add(faceGeom(u1.reverse(), 1), null, 'trim_brown');
    if (kind === 'gable') { const u2 = [P(L, -W, eaveY - 0.14), P(-L, -W, eaveY - 0.14), P(-L, -r.h / 2 + 0.01, eaveY - 0.14), P(L, -r.h / 2 + 0.01, eaveY - 0.14)]; baker.add(faceGeom(u2.reverse(), 1), null, 'trim_brown'); }
  } else { // hip
    const ridgeHalf = Math.max(0, L - W);
    const f1 = [P(-L, W, eaveY), P(L, W, eaveY), P(ridgeHalf, 0, ridgeY), P(-ridgeHalf, 0, ridgeY)];
    const f2 = [P(L, -W, eaveY), P(-L, -W, eaveY), P(-ridgeHalf, 0, ridgeY), P(ridgeHalf, 0, ridgeY)];
    const f3 = [P(L, W, eaveY), P(L, -W, eaveY), P(ridgeHalf, 0, ridgeY)];
    const f4 = [P(-L, -W, eaveY), P(-L, W, eaveY), P(-ridgeHalf, 0, ridgeY)];
    for (const f of [f1, f2, f3, f4]) baker.add(faceGeom(f, 2), null, roofK);
    if (ridgeHalf > 0.2) { const g = new THREE.BoxGeometry(2 * ridgeHalf, 0.12, 0.3); M.makeRotationY(-r.ang).setPosition(r.cx, ridgeY + 0.03, r.cz); baker.add(g, M.clone(), 'trim_dark'); }
    const ring = [P(-L, W, 0), P(L, W, 0), P(L, -W, 0), P(-L, -W, 0)];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], q = ring[(i + 1) % 4]; const len = Math.hypot(q[0] - a[0], q[2] - a[2]); const ang = Math.atan2(q[2] - a[2], q[0] - a[0]);
      const g = new THREE.BoxGeometry(len, 0.16, 0.14); M.makeRotationY(-ang).setPosition((a[0] + q[0]) / 2, eaveY - 0.08, (a[2] + q[2]) / 2); baker.add(g, M.clone(), 'trim_brown');
    }
    const under = [P(-L, W, eaveY - 0.14), P(L, W, eaveY - 0.14), P(L, -W, eaveY - 0.14), P(-L, -W, eaveY - 0.14)];
    baker.add(faceGeom(under.reverse(), 1), null, 'trim_brown');
    return { ridgeY, eaveY, r, hip: true };
  }
  return { ridgeY, eaveY, r };
}

/** windows, door, shop front, house number.  returns the door record */
function facade(baker, ring, eaves, storeys, b, ctx, wallK, kind, roofRects, plinthH, STOREY, st, seed) {
  const M = new THREE.Matrix4();
  const isShed = kind === 'shed' || kind === 'barn';
  const isBrick = wallK.startsWith('brick');
  let doorWall = -1, bestD = Infinity;
  const walls = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], q = ring[(i + 1) % ring.length]; const len = Math.hypot(q[0] - a[0], q[1] - a[1]);
    const mx = (a[0] + q[0]) / 2, mz = (a[1] + q[1]) / 2; const nx = (q[1] - a[1]) / len, nz = -(q[0] - a[0]) / len;
    walls.push({ a, q, len, mx, mz, nx, nz });
    if (len < 2.4) continue;
    const sd = ctx.streetDist(mx + nx * 2, mz + nz * 2);
    const facing = -(sd.nx * nx + sd.nz * nz);
    const score = sd.d - facing * 3 - Math.min(len, 12) * 0.15;
    if (score < bestD) { bestD = score; doorWall = i; }
  }
  if (st.doorWall !== undefined) doorWall = st.doorWall;
  const win = kind === 'tenement' ? { w: 1.15, h: 1.9 } : kind === 'workshop' ? { w: 1.6, h: 2.2 } : { w: 1.05, h: 1.5 };
  const winK = st.window || (isBrick ? (seed < 0.5 ? 'window' : 'window_green') : (seed < 0.5 ? 'window' : 'window_brown'));
  let door = null;
  const numberAt = st.number ?? b.addr?.housenumber;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]; if (w.len < 1.6) continue;
    const dxw = w.q[0] - w.a[0], dzw = w.q[1] - w.a[1];
    const ang = Math.atan2(dzw, -dxw);
    const along = (t, y, out) => [w.a[0] + dxw * t + w.nx * out, y, w.a[1] + dzw * t + w.nz * out];
    const patch = (t, y, wd, ht, out) => { const t0 = t - wd / 2 / w.len, t1 = t + wd / 2 / w.len; const A = along(t0, 0, out), B = along(t1, 0, out); const g = wallQuad(A[0], A[2], B[0], B[2], y - ht / 2, y + ht / 2, 1, true); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); return g; };
    const isDoorWall = i === doorWall;
    // is this wall buried against a neighbour (party wall)? then no openings
    const probe = along(0.5, 0, 0.8); if (ctx.world.insideAnyBuilding(probe[0], probe[2])) continue;
    // ---- sheds: a plank door and one small window
    if (isShed) {
      if (isDoorWall && w.len > 1.8) { baker.add(patch(0.5, 1.0, 0.95, 1.95, 0.03), null, 'plank_door'); door = { x: along(0.5, 0, 0)[0], z: along(0.5, 0, 0)[2], nx: w.nx, nz: w.nz, wall: i }; }
      else if (w.len > 3.5) baker.add(patch(0.5, 1.4, 0.8, 0.65, 0.03), null, 'window_small');
      continue;
    }
    // ---- door with a stone surround and steps
    let doorT = -1, shopT = -1;
    if (isDoorWall) {
      doorT = w.len > 9 ? (st.doorAt ?? 0.18) : 0.5;
      const dw = kind === 'tenement' ? 1.5 : 1.1, dh = kind === 'tenement' ? 2.9 : 2.2;
      baker.add(patch(doorT, plinthH + dh / 2 - 0.15, dw, dh, 0.075), null, st.door || (isBrick ? 'door' : 'door_brown'));
      // surround: a frame standing just proud of the wall, behind the door leaf
      const sp = along(doorT, plinthH + dh / 2 - 0.15, 0.0); const sg = new THREE.BoxGeometry(dw + 0.5, dh + 0.3, 0.12); M.makeRotationY(ang).setPosition(sp[0], sp[1], sp[2]); baker.add(sg, M.clone(), isBrick ? 'brick_dark' : 'trim_stone');
      // steps
      for (let s = 0; s < (kind === 'tenement' ? 3 : 2); s++) { const st2 = along(doorT, plinthH - 0.15 - s * 0.16 + 0.08, 0.3 + s * 0.3); const g = new THREE.BoxGeometry(dw + 0.6, 0.16, 0.6); M.makeRotationY(ang).setPosition(st2[0], Math.max(0.08, st2[1]), st2[2]); baker.add(g, M.clone(), 'trim_stone'); }
      const p = along(doorT, 0, 0.6);
      if (numberAt && ctx.plate) ctx.plate(numberAt, patch(doorT + (dw / 2 + 0.35) / w.len, plinthH + 1.9, 0.3, 0.24, 0.03), new THREE.Matrix4());
      door = { x: p[0], z: p[2], nx: w.nx, nz: w.nz, wall: i, t: doorT };
      // a shop at the corner end of the ground floor
      if (st.shop && w.len > 8) {
        shopT = doorT < 0.5 ? 0.68 : 0.25;
        baker.add(patch(shopT, plinthH + 1.45, 3.2, 2.5, 0.06), null, 'shop');
        const fp = along(shopT, plinthH + 2.95, 0.12); const fg = new THREE.BoxGeometry(3.7, 0.55, 0.14); M.makeRotationY(ang).setPosition(fp[0], fp[1], fp[2]); baker.add(fg, M.clone(), 'trim_brown');
        if (ctx.sign) ctx.sign(st.shop, fp[0] + w.nx * 0.09, fp[1], fp[2] + w.nz * 0.09, ang, 3.5, 0.5);
        const sp2 = along(shopT, plinthH + 0.8, 0.02); const sd = new THREE.BoxGeometry(3.4, 0.2, 0.3); M.makeRotationY(ang).setPosition(sp2[0], plinthH + 0.1, sp2[2]); baker.add(sd, M.clone(), 'trim_stone');
      }
    }
    // ---- windows per storey
    const spacing = kind === 'tenement' ? 2.6 : kind === 'workshop' ? 3.2 : 2.4;
    const n = Math.max(1, Math.floor((w.len - 0.8) / spacing));
    for (let s = 0; s < storeys; s++) {
      const y = plinthH + s * STOREY + (kind === 'tenement' ? 0.95 : 0.75) + win.h / 2;
      if (y + win.h / 2 > eaves - 0.35) break;
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / (n + 1);
        if (s === 0 && doorT >= 0 && Math.abs(t - doorT) * w.len < 1.5) continue;
        if (s === 0 && shopT >= 0 && Math.abs(t - shopT) * w.len < 2.3) continue;
        baker.add(patch(t, y, win.w, win.h, 0.025), null, winK);
        // ground-floor shutters of the colony houses
        if (st.shutters && s === 0) for (const e of [-1, 1]) { const sp = along(t + e * (win.w / 2 + 0.3) / w.len, y, 0.05); const sg = new THREE.BoxGeometry(0.5, win.h - 0.05, 0.05); M.makeRotationY(ang).setPosition(sp[0], sp[1], sp[2]); baker.add(sg, M.clone(), st.shutterK || 'trim_green'); }
        // segmental arch / lintel above, sill below
        const lp = along(t, y + win.h / 2 + 0.12, 0.05); const lg = new THREE.BoxGeometry(win.w + 0.36, 0.26, 0.09); M.makeRotationY(ang).setPosition(lp[0], lp[1], lp[2]); baker.add(lg, M.clone(), isBrick ? 'brick_dark' : 'trim_stone');
        const sl = along(t, y - win.h / 2 - 0.04, 0.08); const sg = new THREE.BoxGeometry(win.w + 0.24, 0.09, 0.18); M.makeRotationY(ang).setPosition(sl[0], sl[1], sl[2]); baker.add(sg, M.clone(), 'trim_stone');
        // ground-floor windows of tenements get a little iron grille line, upper ones of plaster houses a flat surround
        if (!isBrick && kind === 'tenement') { const fr = along(t, y, 0.03); const fg = new THREE.BoxGeometry(win.w + 0.3, win.h + 0.2, 0.05); M.makeRotationY(ang).setPosition(fr[0], fr[1], fr[2]); baker.add(fg, M.clone(), 'trim_stone'); }
      }
    }
  }
  // attic window in the street gable
  if (roofRects.length && !isShed && roofRects[0] && !roofRects[0].hip) {
    const rr = roofRects[0].r; const cos = Math.cos(rr.ang), sin = Math.sin(rr.ang);
    for (const e of [-1, 1]) {
      const u = e * rr.w / 2; const px = rr.cx + u * cos, pz = rr.cz + u * sin;
      if (pointInPoly(px + e * cos * 0.6, pz + e * sin * 0.6, ring)) continue;
      if (ctx.world.insideAnyBuilding(px + e * cos * 0.8, pz + e * sin * 0.8)) continue;
      const sd = ctx.streetDist(px, pz); if (sd.d > 30) continue;
      const y = eaves + 1.0; const nx = e * cos, nz = e * sin;
      const tx = -nz, tz = nx; const ax = px + nx * 0.03 - tx * 0.4, az = pz + nz * 0.03 - tz * 0.4, bx = px + nx * 0.03 + tx * 0.4, bz = pz + nz * 0.03 + tz * 0.4;
      const g = wallQuad(ax, az, bx, bz, y - 0.5, y + 0.5, 1, true); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.computeVertexNormals(); if (g.attributes.normal.getX(0) * nx + g.attributes.normal.getZ(0) * nz < 0) { const idx = g.index.array; for (let k = 0; k < idx.length; k += 3) { const tt = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tt; } g.computeVertexNormals(); }
      baker.add(g, null, 'window_small');
    }
  }
  return door;
}
