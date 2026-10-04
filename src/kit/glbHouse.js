import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * A building that comes as a finished glTF model instead of from the generator
 * (style.glb in overrides.json):
 *   { src, at: [x, z] world metres, rot: degrees,
 *     nodes: ['Mickiewicza_45', …] only these top-level nodes of the file (one file can hold a
 *            whole street corner; each OSM building takes its own nodes from it),
 *     plan: [[x, z], …] local footprint, door: [x, z, nx, nz] local,
 *     chimneys: [[x, z], …] local, for a model without chimney meshes,
 *     envIntensity: studio light strength, brightness: base-colour multiplier to match the game's darker look }
 * The model's origin is placed at `at` and turned by `rot` (three.js Y rotation, so local +x
 * points along ENU azimuth `rot`).  It stands on the lowest terrain point of its footprint.
 * Without `plan` the footprint is the convex hull of each node's ground floor, without `door`
 * the door is found on the Door_* meshes (or the facade nearest a street), and chimney tops
 * come from the Chimney* / *Flue meshes.
 * Returns the same kind of house record the generator does (ring, door, eaves…), so the
 * plots, trees, props and the story treat it like any other house.
 */
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('draco/'));
const files = new Map();
const load = (src) => { if (!files.has(src)) files.set(src, loader.loadAsync(src)); return files.get(src); };

/** world-space vertices of every mesh under `root` whose material name passes `test` */
function vertices(root, test = () => true) {
  const v = new THREE.Vector3(), out = [];
  root.traverse((o) => {
    if (!o.isMesh || !test(o.material?.name || '')) return;
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); out.push([v.x, v.y, v.z]); }
  });
  return out;
}

function hull(pts) {
  const p = pts.map((q) => [q[0], q[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)).map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]);
}

/** greedy xz clusters of points within `r` metres */
function clusters(pts, r) {
  const out = [];
  for (const p of pts) {
    const k = out.find((q) => Math.hypot(q.x - p[0], q.z - p[2]) < r);
    if (k) { k.x = (k.x * k.n + p[0]) / (k.n + 1); k.z = (k.z * k.n + p[2]) / (k.n + 1); k.n++; k.top = Math.max(k.top, p[1]); k.bot = Math.min(k.bot, p[1]); }
    else out.push({ x: p[0], z: p[2], n: 1, top: p[1], bot: p[1] });
  }
  return out;
}

/** the outward normal of the ring edge nearest (x, z) */
function edgeNormal(ring, x, z) {
  let best = null;
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cz = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l)));
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
    if (!best || d < best.d) {
      let nx = dz / l, nz = -dx / l;
      if (((a[0] + b[0]) / 2 - cx) * nx + ((a[1] + b[1]) / 2 - cz) * nz < 0) { nx = -nx; nz = -nz; }
      best = { d, nx, nz, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, l };
    }
  }
  return best;
}

export async function buildGlbHouse(b, ctx, group, st) {
  const g = st.glb;
  const gltf = await load(g.src);
  let model, parts;
  if (g.nodes) {
    model = new THREE.Group();
    parts = g.nodes.map((n) => { const o = gltf.scene.getObjectByName(n); if (!o) throw new Error(`${g.src}: no node ${n}`); const k = o.clone(); model.add(k); return k; });
  } else { model = gltf.scene; parts = [model]; }
  const ang = THREE.MathUtils.degToRad(g.rot || 0), c = Math.cos(ang), s = Math.sin(ang);
  const [ox, oz] = g.at;
  const toWorld = (x, z) => [ox + x * c + z * s, oz - x * s + z * c];
  model.position.set(ox, 0, oz);
  model.rotation.y = ang;
  model.name = 'glb_' + b.id;
  model.updateMatrixWorld(true);
  // footprints: given, or the hull of each part's ground floor
  const rings = g.plan ? [g.plan.map(([x, z]) => toWorld(x, z))]
    : parts.map((p) => { const v = vertices(p); const y0 = Math.min(...v.map((q) => q[1])); return hull(v.filter((q) => q[1] < y0 + 2.5)); });
  const ring = rings.length === 1 ? rings[0] : hull(rings.flat().map(([x, z]) => [x, 0, z]));
  let baseY = 0;
  if (ctx.ground) { baseY = Infinity; for (const p of rings.flat()) baseY = Math.min(baseY, ctx.ground(p[0], p[1])); }
  model.position.y = baseY;
  // the look the model has in Blender's Material Preview: its PBR materials lit by a studio
  // environment (the game's own materials are Lambert and ignore it)
  model.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) {
      if (ctx.envMap) { m.envMap = ctx.envMap; m.envMapIntensity = g.envIntensity ?? 1; }
      if (g.brightness != null && m.color && !m.userData.dimmed) { m.color.multiplyScalar(g.brightness); m.userData.dimmed = true; }
    }
  });
  group.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (ctx.world) for (const r of rings) ctx.world.addPolygon(r);
  // chimney tops, for the smoke: one per cluster of the chimney meshes, at its own height
  let chimneys = clusters(vertices(model, (n) => /chimney|flue/i.test(n)), 1.2).map((k) => ({ x: k.x, y: k.top, z: k.z }));
  const named = model.getObjectByName('Chimneys');
  if (!chimneys.length && named) chimneys = clusters(vertices(named), 1.5).map((k) => ({ x: k.x, y: k.top, z: k.z }));
  if (!chimneys.length && g.chimneys) for (const [x, z] of g.chimneys) { const [wx, wz] = toWorld(x, z); chimneys.push({ x: wx, y: box.max.y, z: wz }); }
  // the door: given, or the street-side Door_* cluster, or the middle of the facade nearest a street
  const street = (x, z) => (ctx.streetDist ? ctx.streetDist(x, z) : 0);
  let door = null;
  if (g.door) { const [dx, dz, nx, nz] = g.door; const [x, z] = toWorld(dx, dz); door = { x, z, nx: nx * c + nz * s, nz: -nx * s + nz * c }; }
  else {
    const doors = clusters(vertices(model, (n) => /^door/i.test(n)), 1.0).filter((k) => k.bot < baseY + 1.5).sort((p, q) => street(p.x, p.z) - street(q.x, q.z));
    const main = rings[0];
    if (doors.length) { const r = rings.reduce((a, q) => (edgeNormal(q, doors[0].x, doors[0].z).d < edgeNormal(a, doors[0].x, doors[0].z).d ? q : a)); const e = edgeNormal(r, doors[0].x, doors[0].z); door = { x: doors[0].x, z: doors[0].z, nx: e.nx, nz: e.nz }; }
    else {
      let best = null;
      for (let i = 0; i < main.length; i++) { const e = edgeNormal(main, (main[i][0] + main[(i + 1) % main.length][0]) / 2, (main[i][1] + main[(i + 1) % main.length][1]) / 2); if (e.l < 4) continue; const d = street(e.mx + e.nx * 3, e.mz + e.nz * 3); if (!best || d < best.d) best = { ...e, d }; }
      if (best) door = { x: best.mx, z: best.mz, nx: best.nx, nz: best.nz };
    }
  }
  return { ring, rings, door, eaves: box.max.y - baseY - 4, ridge: box.max.y - baseY, roofKind: 'glb', kind: 'house', style: st, baseY, model, chimneys: chimneys.map((q) => [q.x, q.y, q.z]) };
}
