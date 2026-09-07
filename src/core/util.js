import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* Scene data is ENU metres (+x east, +y north).  Three.js here is +X east,
 * +Z south, +Y up.  north = -Z. */
export const toX = (e) => e;
export const toZ = (n) => -n;
export const xz = (p) => [p[0], -p[1]];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// deterministic hash → [0,1)
export function hash(n) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ 0x85EBCA6B) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) >>> 0; x = Math.imul(x ^ (x >>> 12), 0x297A2D39) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
export function strHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }

// ---------------------------------------------------------------- 2-D polygon (XZ)
export function polyArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function ensureCCW(r) { return polyArea(r) < 0 ? r.slice().reverse() : r; } // CCW in XZ as seen from +Y ... note Z is flipped, "CCW" here = positive signed area
export function centroid(r) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; const c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cz += (p[1] + q[1]) * c; }
  if (Math.abs(a) < 1e-9) return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
  return [cx / (3 * a), cz / (3 * a)];
}
export function pointInPoly(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
export function segClosest(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return [ax + dx * t, az + dz * t, t];
}
/** minimum-area oriented bounding box: {cx, cz, ang, w, h, fill} — w along ang */
export function obb(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length]; const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const t of r) { const u = t[0] * c - t[1] * s, v = t[0] * s + t[1] * c; if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v; }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2; const cc = Math.cos(ang), ss = Math.sin(ang);
      best = { area, ang, w: maxU - minU, h: maxV - minV, cx: cu * cc - cv * ss, cz: cu * ss + cv * cc };
    }
  }
  best.fill = Math.abs(polyArea(r)) / best.area;
  if (best.h > best.w) { best.ang += Math.PI / 2; const t = best.w; best.w = best.h; best.h = t; }
  return best;
}
export function polyBounds(r) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of r) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); } return { x0, z0, x1, z1 }; }
export function offsetPoly(r, d) {
  // mitred offset, positive = outward for a positive-area ring
  const n = r.length, out = [];
  const sgn = polyArea(r) > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = r[(i - 1 + n) % n], q = r[i], s = r[(i + 1) % n];
    let ax = q[0] - p[0], az = q[1] - p[1]; let bx = s[0] - q[0], bz = s[1] - q[1];
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
    // outward normals (for positive area in XZ with Z down-screen, outward = (dz, -dx) * sgn)
    const n1x = az * sgn, n1z = -ax * sgn, n2x = bz * sgn, n2z = -bx * sgn;
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { out.push([q[0] + n1x * d, q[1] + n1z * d]); continue; }
    mx /= ml; mz /= ml; const cosHalf = mx * n1x + mz * n1z; const k = d / Math.max(cosHalf, 0.35);
    out.push([q[0] + mx * k, q[1] + mz * k]);
  }
  return out;
}

// ---------------------------------------------------------------- baker
/** Merges geometry per material into a handful of meshes. */
const GROUND_KEYS = new Set(['grass', 'setts', 'setts_dark', 'dirt', 'cinder', 'clinker', 'kerb', 'gravel', 'soil', 'marking']);
export class Baker {
  constructor(materials, ground = null) { this.mats = materials; this.parts = new Map(); this.ground = ground; this.base = null; }
  /** every geometry added is lifted onto the terrain: ground surfaces per vertex, everything else rigidly
   *  by the height at its centre — or at `base`, which a building sets once so its walls stay joined */
  _lift(g, key) {
    if (!this.ground) return g;
    const pos = g.attributes.position;
    if (GROUND_KEYS.has(key)) { for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + this.ground(pos.getX(i), pos.getZ(i))); pos.needsUpdate = true; return g; }
    let dy;
    if (this.base !== null) dy = this.base;
    else { g.computeBoundingBox(); const b = g.boundingBox; dy = this.ground((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2); }
    if (dy) { for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + dy); pos.needsUpdate = true; }
    return g;
  }
  add(geom, matrix, key) {
    if (!this.mats[key]) throw new Error('no material ' + key);
    const g = this._lift(matrix ? geom.clone().applyMatrix4(matrix) : geom, key);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }
  box(w, h, d, x, y, z, key, ry = 0, uvScale = 1) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (uvScale !== 1) scaleUV(g, uvScale);
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.add(g, m, key);
  }
  finish(group, opts = {}) {
    const meshes = [];
    for (const [key, list] of this.parts) {
      const clean = list.map((g) => { const c = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(a)) c.deleteAttribute(a); if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); if (!c.attributes.normal) c.computeVertexNormals(); return c; });
      const merged = mergeGeometries(clean, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.castShadow = opts.shadow ?? true; mesh.receiveShadow = true; mesh.name = key;
      group.add(mesh); meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}
export function scaleUV(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); }

/** vertical quad wall from (ax,az)->(bx,bz), y0..y1; uv in metres/uvScale; normal faces (dz,-dx) side */
export function wallQuad(ax, az, bx, bz, y0, y1, uvScale = 1, flip = false) {
  const g = new THREE.BufferGeometry();
  const len = Math.hypot(bx - ax, bz - az);
  const pos = flip
    ? [bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz]
    : [ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len / uvScale, 0, len / uvScale, (y1 - y0) / uvScale, 0, (y1 - y0) / uvScale], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  return g;
}
/** flat polygon at height y (XZ ring), uv = world/uvScale, facing up unless down */
export function polyGeom(ring, y, uvScale = 1, down = false) {
  const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getY(i); pos.setXYZ(i, x, y, z); uv.setXY(i, x / uvScale, z / uvScale); }
  // ShapeGeometry winds for +Z normal; after mapping y<-z the normal is -Y for a positive-area ring
  if (!down) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  g.computeVertexNormals();
  if (down === (g.attributes.normal.getY(0) < 0)) return g;
  // if orientation came out wrong, flip
  const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.computeVertexNormals(); return g;
}
/** triangle/quad from explicit points [[x,y,z]...], normal from winding, planar uv */
export function faceGeom(pts, uvScale = 1) {
  const g = new THREE.BufferGeometry();
  const pos = []; const idx = [];
  for (const p of pts) pos.push(p[0], p[1], p[2]);
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // planar uv: project on the two largest axes of the face
  const n = g.attributes.normal; const nx = Math.abs(n.getX(0)), ny = Math.abs(n.getY(0)), nz = Math.abs(n.getZ(0));
  const uv = [];
  for (const p of pts) {
    if (ny >= nx && ny >= nz) uv.push(p[0] / uvScale, p[2] / uvScale);
    else if (nx >= nz) uv.push(p[2] / uvScale, p[1] / uvScale);
    else uv.push(p[0] / uvScale, p[1] / uvScale);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** ribbon along a polyline (XZ), width w, at height y. uv: u along length/uvScale, v across */
export function ribbonGeom(pts, w, y, uvScale = 1, lateral = 0) {
  const n = pts.length; if (n < 2) return null;
  const L = []; const R = []; let s = 0; const S = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i]; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz, nz = dx;
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); S.push(s);
    // mitre scale at corners
    let k = 1;
    if (i > 0 && i < n - 1) { const d1x = p[0] - a[0], d1z = p[1] - a[1], l1 = Math.hypot(d1x, d1z) || 1; const d2x = b[0] - p[0], d2z = b[1] - p[1], l2 = Math.hypot(d2x, d2z) || 1; const cosT = (d1x * d2x + d1z * d2z) / (l1 * l2); k = 1 / Math.max(Math.cos(Math.acos(clamp(cosT, -1, 1)) / 2), 0.5); }
    L.push([p[0] + nx * (lateral + w / 2) * k, p[1] + nz * (lateral + w / 2) * k]);
    R.push([p[0] + nx * (lateral - w / 2) * k, p[1] + nz * (lateral - w / 2) * k]);
  }
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) { pos.push(L[i][0], y, L[i][1], R[i][0], y, R[i][1]); uv.push(S[i] / uvScale, 0, S[i] / uvScale, w / uvScale); }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // make sure it faces up
  if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
export function resamplePolyline(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const k = Math.max(1, Math.round(l / step));
    for (let j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  return out;
}
