import * as THREE from 'three';

/* People of the colony: simple jointed figures built from boxes, in 1920
 * working clothes — flat caps, waistcoats, long skirts, aprons, headscarves.
 * Each figure is a Group with a small idle animation and a name label
 * position for the dialogue prompt. */

const M = new THREE.Matrix4();
function box(w, h, d, x, y, z, mat, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }

/**
 * @param spec { kind: 'worker'|'woman'|'child'|'old'|'boy', x, z, yaw, name, cap?, coat?, skirt? }
 */
export function makePerson(spec, mats) {
  const g = new THREE.Group(); g.position.set(spec.x, 0, spec.z); g.rotation.y = spec.yaw || 0;
  const k = spec.kind || 'worker';
  const scale = k === 'child' || k === 'boy' ? 0.62 : k === 'woman' ? 0.93 : 1;
  const body = new THREE.Group(); body.scale.setScalar(scale); g.add(body);
  const coat = mats[spec.coat || (k === 'woman' ? 'cloth_brown' : k === 'child' || k === 'boy' ? 'cloth_grey' : 'cloth_blue')];
  const dark = mats.trim_dark, skin = mats.skin;
  // legs / skirt
  if (k === 'woman') { const s = box(0.5, 0.95, 0.42, 0, 0.48, 0, mats[spec.skirt || 'cloth_grey'], body); s.geometry.translate(0, 0, 0); const apron = box(0.34, 0.7, 0.02, 0, 0.5, 0.22, mats.linen, body); }
  else { box(0.17, 0.85, 0.2, -0.11, 0.43, 0, dark, body); box(0.17, 0.85, 0.2, 0.11, 0.43, 0, dark, body); }
  // torso
  const torso = box(0.5, 0.62, 0.3, 0, 1.16, 0, coat, body);
  if (k === 'worker' || k === 'old') box(0.3, 0.5, 0.02, 0, 1.12, 0.16, mats.cloth_grey, body); // waistcoat
  // arms
  const armL = box(0.13, 0.6, 0.15, -0.32, 1.12, 0, coat, body), armR = box(0.13, 0.6, 0.15, 0.32, 1.12, 0, coat, body);
  box(0.11, 0.1, 0.12, -0.32, 0.79, 0, skin, body); box(0.11, 0.1, 0.12, 0.32, 0.79, 0, skin, body);
  // head
  const head = box(0.26, 0.3, 0.26, 0, 1.66, 0, skin, body);
  if (k === 'woman') { box(0.3, 0.2, 0.3, 0, 1.76, 0, mats[spec.scarf || 'cloth_brown'], body); box(0.32, 0.32, 0.06, 0, 1.64, -0.13, mats[spec.scarf || 'cloth_brown'], body); }
  else { // flat cap (Schirmmütze)
    box(0.32, 0.08, 0.32, 0, 1.84, 0, dark, body); box(0.3, 0.05, 0.14, 0, 1.8, 0.2, dark, body);
  }
  if (k === 'old') box(0.2, 0.08, 0.06, 0, 1.58, 0.14, mats.cloth_grey, body); // moustache
  // props
  if (spec.prop === 'pipe') box(0.03, 0.03, 0.14, 0.08, 1.58, 0.18, dark, body);
  if (spec.prop === 'basket') { const b = box(0.36, 0.26, 0.26, 0.42, 0.85, 0.05, mats.planks, body); }
  if (spec.prop === 'lunchbox') box(0.22, 0.14, 0.12, -0.42, 0.85, 0.05, mats.iron, body);
  if (spec.prop === 'newspaper') box(0.3, 0.02, 0.22, 0.1, 1.2, 0.3, mats.linen, body);
  if (spec.prop === 'broom') { box(0.03, 1.5, 0.03, 0.45, 0.75, 0.1, mats.pole, body); box(0.2, 0.25, 0.1, 0.45, 0.12, 0.1, mats.planks, body); }
  if (spec.prop === 'hoop') { const h = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 20), mats.iron); h.position.set(0.5, 0.36, 0.1); body.add(h); }
  g.userData = { spec, body, armL, armR, head, torso, phase: Math.random() * 6 };
  g.userData.top = 1.95 * scale;
  return g;
}

/** idle motion: breathing, occasional head turn, the sweeper sweeps */
export function animatePeople(list, t, player) {
  for (const g of list) {
    const u = g.userData; const s = u.spec;
    const ph = t * 1.4 + u.phase;
    u.torso.position.y = 1.16 + Math.sin(ph) * 0.008;
    u.head.position.y = 1.66 + Math.sin(ph) * 0.01;
    // look at the player when near
    if (player) {
      const dx = player.x - g.position.x, dz = player.z - g.position.z; const d = Math.hypot(dx, dz);
      const want = d < 7 ? Math.atan2(dx, dz) - g.rotation.y : 0;
      let a = want; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
      a = Math.max(-1.1, Math.min(1.1, a));
      u.head.rotation.y += (a - u.head.rotation.y) * 0.06;
    }
    if (s.prop === 'broom') { u.armR.rotation.x = Math.sin(t * 2.6 + u.phase) * 0.4; u.armL.rotation.x = Math.sin(t * 2.6 + u.phase) * 0.4; }
    else if (s.prop === 'pipe') { u.armR.rotation.x = -1.3 + Math.sin(t * 0.5 + u.phase) * 0.1; }
    else { u.armR.rotation.x = Math.sin(ph * 0.5) * 0.05; u.armL.rotation.x = -Math.sin(ph * 0.5) * 0.05; }
  }
}

/** a horse and a flat cart with a driver, moving back and forth along a polyline */
export function makeCart(mats) {
  const g = new THREE.Group();
  const cart = new THREE.Group(); g.add(cart);
  box(2.6, 0.12, 1.5, 0, 0.75, 0, mats.planks, cart);
  box(2.6, 0.35, 0.05, 0, 0.98, 0.72, mats.planks, cart); box(2.6, 0.35, 0.05, 0, 0.98, -0.72, mats.planks, cart);
  box(0.05, 0.35, 1.5, -1.28, 0.98, 0, mats.planks, cart);
  box(0.6, 0.1, 1.2, -0.7, 1.0, 0, mats.planks, cart); // seat plank
  // sacks / coal
  for (let i = 0; i < 4; i++) box(0.55, 0.4, 0.5, 0.3 + (i % 2) * 0.6 - 0.3, 1.0, (i < 2 ? -0.35 : 0.35), mats.cloth_grey, cart);
  for (const [x, z] of [[-0.9, 0.8], [-0.9, -0.8], [0.9, 0.8], [0.9, -0.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.07, 14), mats.trim_brown); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); w.castShadow = true; cart.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), mats.iron); hub.rotation.x = Math.PI / 2; hub.position.set(x, 0.45, z); cart.add(hub); }
  // shafts and the horse in front (+x)
  box(2.2, 0.06, 0.06, 2.2, 0.9, 0.45, mats.pole, cart); box(2.2, 0.06, 0.06, 2.2, 0.9, -0.45, mats.pole, cart);
  const horse = new THREE.Group(); horse.position.set(2.7, 0, 0); g.add(horse);
  box(1.5, 0.75, 0.6, 0, 1.25, 0, mats.horse, horse);
  const neck = box(0.5, 0.7, 0.35, 0.85, 1.65, 0, mats.horse, horse); neck.rotation.z = -0.5;
  const head = box(0.55, 0.28, 0.28, 1.25, 1.95, 0, mats.horse, horse);
  box(0.12, 0.15, 0.06, 1.05, 2.12, 0.1, mats.horse, horse); box(0.12, 0.15, 0.06, 1.05, 2.12, -0.1, mats.horse, horse);
  const legs = [];
  for (const [x, z] of [[0.55, 0.2], [0.55, -0.2], [-0.55, 0.2], [-0.55, -0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), mats.horse); l.geometry.translate(0, -0.45, 0); l.position.set(x, 0.9, z); l.castShadow = true; horse.add(l); legs.push(l); }
  const tail = box(0.08, 0.6, 0.08, -0.8, 1.2, 0, mats.trim_dark, horse);
  // driver
  const driver = new THREE.Group(); driver.position.set(-0.7, 1.05, 0.2); driver.rotation.y = Math.PI / 2; cart.add(driver);
  box(0.4, 0.5, 0.3, 0, 0.3, 0, mats.cloth_brown, driver); box(0.24, 0.26, 0.24, 0, 0.7, 0, mats.skin, driver); box(0.3, 0.07, 0.3, 0, 0.86, 0, mats.trim_dark, driver);
  box(0.16, 0.5, 0.18, -0.1, -0.1, 0.2, mats.trim_dark, driver); box(0.16, 0.5, 0.18, 0.1, -0.1, 0.2, mats.trim_dark, driver);
  g.userData = { legs, phase: 0, horse, speed: 1.6 };
  return g;
}
export function animateCart(cart, path, t, world, cbPos) {
  // path: [[x,z]...]; the cart drives along it, waits at the ends, comes back
  const u = cart.userData; const L = []; let tot = 0;
  for (let i = 0; i < path.length - 1; i++) { const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); L.push(d); tot += d; }
  const period = tot / u.speed + 12; const cyc = t % (2 * period); let s;
  let moving = true;
  if (cyc < period) { s = Math.min(tot, cyc * u.speed); if (cyc * u.speed > tot) moving = false; } else { s = Math.max(0, tot - (cyc - period) * u.speed); if ((cyc - period) * u.speed > tot) moving = false; }
  const fwd = cyc < period ? 1 : -1;
  let acc = 0, i = 0; while (i < L.length - 1 && acc + L[i] < s) { acc += L[i]; i++; }
  const f = L[i] > 0 ? (s - acc) / L[i] : 0; const a = path[i], b = path[i + 1];
  const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
  const ang = Math.atan2(-(b[1] - a[1]) * fwd, (b[0] - a[0]) * fwd);
  cart.position.set(x, 0, z); cart.rotation.y = ang;
  if (moving) { u.phase += 0.09; u.legs.forEach((l, k) => { l.rotation.z = Math.sin(u.phase + (k % 2 ? Math.PI : 0) + (k > 1 ? 0.5 : 0)) * 0.45; }); u.horse.position.y = Math.abs(Math.sin(u.phase)) * 0.03; }
  cbPos?.(x + Math.cos(ang) * 1.3, z - Math.sin(ang) * 1.3, moving);
  return moving;
}
