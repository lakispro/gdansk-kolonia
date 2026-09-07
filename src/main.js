import * as THREE from 'three';
import { Baker, xz } from './core/util.js';
import { makeMaterials } from './core/materials.js';
import * as T from './core/textures.js';
import { Player } from './core/player.js';
import { Audio } from './core/audio.js';
import { World } from './world/world.js';
import { Streets } from './world/streets.js';
import { buildBuilding } from './kit/tenement.js';
import { Minimap } from './core/minimap.js';
import { buildPlots } from './world/plots.js';
import { buildVegetation } from './world/vegetation.js';
import { buildProps } from './world/props1920.js';
import { makePerson, animatePeople, makeCart, animateCart } from './kit/people.js';
import { Story } from './game/story.js';
import { makePlan } from './world/plan1920.js';
import { makeTerrain } from './world/terrain.js';

const canvas = document.getElementById('view');
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9c3b4);
scene.fog = new THREE.Fog(0xcdc6b6, 70, 270);
const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 68, 1, 0.08, 600);

// ---- light: a November afternoon, a low sun from the south-west through haze, coal smoke in the air
const sun = new THREE.DirectionalLight(0xffd6a4, 1.75);
sun.position.set(-55, 38, 50); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
const sc = sun.shadow.camera; sc.near = 10; sc.far = 260; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xb9c2cc, 0x5c5240, 0.75));
scene.add(new THREE.AmbientLight(0xffffff, 0.14));

// ---- sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), new THREE.MeshBasicMaterial({ map: T.skyTex(), side: THREE.BackSide, fog: false }));
scene.add(sky);
{ const g = sky.geometry; const uv = g.attributes.uv; const p = g.attributes.position; for (let i = 0; i < uv.count; i++) { const y = p.getY(i) / 520; uv.setXY(i, uv.getX(i), y * 0.5 + 0.5); } }

// ---- ui
const $ = (id) => document.getElementById(id);
const audio = new Audio();
const ui = {
  task: $('task'), score: $('score'), clock: $('clock'), prompt: $('prompt'), toastEl: $('toast'), place: $('place'), debug: $('debug'), dialog: $('dialog'),
  toast(msg, ms = 2800) { this.toastEl.textContent = msg; this.toastEl.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => this.toastEl.classList.remove('on'), ms); },
  end(story) { const t = story.elapsed(clock.elapsedTime); $('endText').innerHTML = plan.endText(story.choices, fmt(t)); $('end').classList.add('on'); if (!isTouch) document.exitPointerLock?.(); },
  onCard(open) { if (player) { player.frozen = open; player.keys.clear(); if (!open && !isTouch) player.lock(); else if (open && !isTouch) document.exitPointerLock?.(); } },
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---- world
const mats = makeMaterials();
const worldGroup = new THREE.Group(); scene.add(worldGroup);
let player, story, streets, world, minimap, plan, houses = [], people = [], cart = null, smoke = null;
const RADIUS = 150;

async function build() {
  const [sceneData, veg, parcels, terrain] = await Promise.all(['scene', 'vegetation', 'parcels', 'terrain'].map((n) => fetch(`data/${n}.json`).then((r) => r.json())));
  $('loading').textContent = 'budowanie roku 1920…';
  await new Promise((r) => setTimeout(r, 30));
  const ground = makeTerrain(terrain);
  plan = makePlan(sceneData, parcels);
  plan.ground = ground;
  $('intro').innerHTML = plan.intro;
  world = new World(RADIUS);
  streets = new Streets(plan.streets);
  const baker = new Baker(mats, ground);
  streets.build(baker, world, RADIUS);
  const plateCache = new Map();
  const plate = (no, geom, matrix) => { if (!plateCache.has(no)) plateCache.set(no, new THREE.MeshLambertMaterial({ map: T.numberPlate(no) })); const m = new THREE.Mesh(geom, plateCache.get(no)); m.applyMatrix4(matrix); worldGroup.add(m); };
  const sign = (text, x, y, z, ang, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: T.shopSign(text) })); m.position.set(x, y, z); m.rotation.y = ang; worldGroup.add(m); };
  const ctx = { baker, world, streetDist: (x, z) => streets.dist(x, z, ['setts', 'sand', 'dirt']), plate, sign };
  for (const b of plan.buildings) {
    const h = buildBuilding(b, ctx, b.style || {});
    if (h) { h.b = b; houses.push(h); }
  }
  buildPlots(parcels, houses, streets, baker, world, RADIUS, { skip: plan.skipParcel });
  buildVegetation({ trees: plan.trees(veg), hedges: [] }, houses, streets, baker, world, RADIUS, []);
  buildProps({ scene: sceneData, streets, houses, baker, world, radius: RADIUS, group: worldGroup, mats, plan: plan.props });
  const meshes = baker.finish(worldGroup);
  for (const m of meshes) if (['grass', 'setts', 'setts_dark', 'dirt', 'cinder', 'clinker', 'kerb', 'soil', 'gravel', 'marking'].includes(m.name)) m.castShadow = false;
  // people and the cart
  for (const p of (typeof plan.people === 'function' ? plan.people(houses) : plan.people)) { const g = makePerson(p, mats); g.position.y = ground(p.x, p.z); worldGroup.add(g); people.push(g); world.addCircle(p.x, p.z, 0.35); }
  if (plan.cart) { cart = makeCart(mats); worldGroup.add(cart); }
  if (plan.props.rail) { const r = plan.props.rail.pts; audio.rail = [r[0], r[r.length - 1]]; audio.yard = { x: 260, z: 200 }; }
  smoke = makeSmoke((plan.chimneys || []).map((s) => [s[0], s[1] + ground(s[0], s[2]), s[2]]));
  worldGroup.add(smoke.mesh);

  player = new Player(camera, canvas, world, { ...plan.spawn, ground: plan.ground });
  if (isTouch) player.enableTouch();
  player.onAct = () => { if (story) story.act(player.pos.x, player.pos.z); };
  player.onKey = (code) => { if (code === 'F1') ui.debug.classList.toggle('on'); if (code === 'KeyR') player.reset(); if (code === 'KeyM') minimap.toggle(); if (code === 'KeyN') toggleSound(); };
  player.onStep = (run) => audio.step(streets.surfaceAt(player.pos.x, player.pos.z), run);
  player.onJump = () => audio.jump(); player.onLand = (air) => audio.land(air);
  minimap = new Minimap($('map'), plan, RADIUS);
  $('bMap').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); minimap.toggle(); });
  $('bSound').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleSound(); });
  story = new Story(plan.chapters({ houses, people }), worldGroup, ui, audio, { ground, onChapter: (c) => { if (c.cartStart !== undefined) cartT0 = clock.elapsedTime; } });
  window.__world = { player, camera, renderer, scene, houses, streets, plan, audio, get minimap() { return minimap; }, get story() { return story; }, setView: (x, z, yaw, pitch = 0) => { player.pos.x = x; player.pos.z = z; player.pos.y = plan.ground(x, z); player.yaw = yaw; player.pitch = pitch; player.applyCamera(0); } };
  $('how').innerHTML = isTouch
    ? '<b>lewy drążek</b> — chodzenie · <b>przeciągnij</b> po ekranie — rozglądanie · <b>skok</b>, <b>bieg</b>, <b>działaj</b> — przyciski po prawej'
    : '<b>WASD</b> chodzenie · <b>mysz</b> rozglądanie · <b>Shift</b> bieg · <b>Spacja</b> skok · <b>E</b> działaj · <b>M</b> mapa · <b>N</b> dźwięk';
  $('start').classList.add('ready');
  $('loading').textContent = '';
  return meshes.length;
}
function toggleSound() { audio.init(); audio.setMuted(!audio.muted); $('bSound').classList.toggle('hot', !audio.muted); ui.toast(audio.muted ? 'dźwięk wyłączony' : 'dźwięk włączony', 1200); }

// ---- chimney smoke: a few dozen soft sprites drifting with the wind
function makeSmoke(spots) {
  const N = spots.length * 12; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); const life = new Float32Array(N);
  for (let i = 0; i < N; i++) { life[i] = Math.random(); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(200,195,185,.55)'); g.addColorStop(1, 'rgba(200,195,185,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({ size: 3.2, map: tex, transparent: true, depthWrite: false, opacity: 0.8, sizeAttenuation: true });
  const mesh = new THREE.Points(geo, mat); mesh.frustumCulled = false;
  return { mesh, spots, life, update(dt, t) { const p = geo.attributes.position.array; for (let i = 0; i < N; i++) { life[i] += dt * 0.12; if (life[i] > 1) life[i] -= 1; const s = spots[i % spots.length]; const L = life[i]; p[i * 3] = s[0] + L * 9 + Math.sin(t * 0.7 + i) * L * 1.5; p[i * 3 + 1] = s[1] + L * 7; p[i * 3 + 2] = s[2] - L * 5 + Math.cos(t * 0.5 + i * 1.3) * L; } geo.attributes.position.needsUpdate = true; } };
}

$('go').addEventListener('click', () => { $('start').classList.add('gone'); player.frozen = false; audio.init(); $('bSound').classList.add('hot'); if (!isTouch) player.lock(); });
canvas.addEventListener('click', () => { if (player && !player.frozen && !isTouch && !player.locked) player.lock(); });
$('again').addEventListener('click', () => { $('end').classList.remove('on'); story.start(); player.reset(); player.frozen = false; if (!isTouch) player.lock(); });

function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// ---- loop
const clock = new THREE.Clock(); let frames = 0, fpsT = 0, fps = 0, cartT0 = 0;
let lastPlace = '';
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta(); const t = clock.elapsedTime;
  if (!player) { renderer.render(scene, camera); return; }
  player.update(dt);
  sky.position.copy(camera.position);
  sun.position.set(player.pos.x - 55, 38, player.pos.z + 50); sun.target.position.set(player.pos.x, 0, player.pos.z); sun.target.updateMatrixWorld();
  const prompt = story.update(player.pos.x, player.pos.z, dt, t);
  ui.prompt.textContent = prompt ? (isTouch ? `▸ ${prompt}` : `E — ${prompt}`) : ''; ui.prompt.classList.toggle('on', !!prompt);
  $('bAct').classList.toggle('hot', !!prompt);
  if (!story.done && !player.frozen) ui.clock.textContent = fmt(story.elapsed(t));
  $('needle').setAttribute('transform', `rotate(${THREE.MathUtils.radToDeg(player.yaw)} 16 16)`);
  { const tp = story.targetPos(); if (tp) { const a = Math.atan2(tp[0] - player.pos.x, -(tp[1] - player.pos.z)); $('tick').setAttribute('transform', `rotate(${THREE.MathUtils.radToDeg(a + player.yaw)} 16 16)`); } }
  if (minimap.on && (frames & 3) === 0) minimap.draw(player.pos.x, player.pos.z, player.yaw, story.targetPos());
  animatePeople(people, t, player.pos);
  if (cart) { animateCart(cart, plan.cart.path, t - cartT0, world, (x, z, moving) => audio.cartAt(x, z, moving)); cart.position.y = plan.ground(cart.position.x, cart.position.z); }
  smoke.update(dt, t);
  if (!player.frozen) audio.update(dt, player.pos.x, player.pos.z, player.yaw);
  if ((frames & 15) === 0) {
    const r = streets.dist(player.pos.x, player.pos.z, ['setts', 'sand', 'dirt']);
    const name = r.s && r.d < r.s.width / 2 + 5 ? (r.s.name1920 || r.s.name) : '';
    if (name !== lastPlace) { lastPlace = name; if (name) { ui.place.querySelector('.a').textContent = name; ui.place.querySelector('.b').textContent = (r.s.name && r.s.name1920 ? `dziś ${r.s.name} · ` : '') + 'Langfuhr · Danzig'; ui.place.classList.add('on'); } else ui.place.classList.remove('on'); }
  }
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (ui.debug.classList.contains('on')) ui.debug.textContent = `${fps.toFixed(0)} fps\ncalls ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k\nx ${player.pos.x.toFixed(1)} z ${player.pos.z.toFixed(1)} yaw ${player.yaw.toFixed(2)}`;
  renderer.render(scene, camera);
}
build().then((n) => { console.log('world built:', n, 'baked meshes'); loop(); }).catch((e) => { console.error(e); $('loading').textContent = 'błąd: ' + e.message; });
