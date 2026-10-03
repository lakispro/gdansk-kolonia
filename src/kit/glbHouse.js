import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * A building that comes as a finished glTF model instead of from the generator
 * (style.glb in overrides.json):
 *   { src, at: [x, z] world metres, rot: degrees, plan: [[x, z], …] local footprint, door: [x, z, nx, nz] local }
 * The model's origin is placed at `at` and turned by `rot` (three.js Y rotation, so local +x
 * points along ENU azimuth `rot`).  It stands on the lowest terrain point of its footprint.
 * Returns the same kind of house record the generator does (ring, door, eaves…), so the
 * plots, trees, props and the story treat it like any other house.
 */
const loader = new GLTFLoader();

export async function buildGlbHouse(b, ctx, group, st) {
  const g = st.glb;
  const gltf = await loader.loadAsync(g.src);
  const model = gltf.scene;
  const ang = THREE.MathUtils.degToRad(g.rot || 0), c = Math.cos(ang), s = Math.sin(ang);
  const [ox, oz] = g.at;
  const toWorld = (x, z) => [ox + x * c + z * s, oz - x * s + z * c];
  const ring = g.plan.map(([x, z]) => toWorld(x, z));
  let baseY = 0;
  if (ctx.ground) { baseY = Infinity; for (const p of ring) baseY = Math.min(baseY, ctx.ground(p[0], p[1])); }
  model.position.set(ox, baseY, oz);
  model.rotation.y = ang;
  model.name = 'glb_' + b.id;
  // the look the model has in Blender's Material Preview: its PBR materials lit by a studio
  // environment (the game's own materials are Lambert and ignore it)
  model.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) if (ctx.envMap) { m.envMap = ctx.envMap; m.envMapIntensity = g.envIntensity ?? 1; }
  });
  group.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (ctx.world) ctx.world.addPolygon(ring);
  // chimney tops, for the smoke: one per cluster of the Chimneys mesh
  const chimneys = [];
  const ch = model.getObjectByName('Chimneys');
  if (ch) {
    const v = new THREE.Vector3(), pts = [];
    ch.traverse((o) => { if (!o.isMesh) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pts.push(v.clone()); } });
    const top = Math.max(...pts.map((p) => p.y));
    for (const p of pts) { if (p.y < top - 0.3) continue; const k = chimneys.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.5); if (k) { k.x = (k.x * k.n + p.x) / (k.n + 1); k.z = (k.z * k.n + p.z) / (k.n + 1); k.n++; } else chimneys.push({ x: p.x, y: top, z: p.z, n: 1 }); }
  }
  let door = null;
  if (g.door) { const [dx, dz, nx, nz] = g.door; const [x, z] = toWorld(dx, dz); door = { x, z, nx: nx * c + nz * s, nz: -nx * s + nz * c }; }
  return { ring, door, eaves: box.max.y - baseY - 4, ridge: box.max.y - baseY, roofKind: 'glb', kind: 'house', style: st, baseY, model, chimneys: chimneys.map((q) => [q.x, q.y, q.z]) };
}
