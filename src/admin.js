import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Baker, xz, centroid } from './core/util.js';
import { makeMaterials } from './core/materials.js';
import * as T from './core/textures.js';
import { World } from './world/world.js';
import { Streets } from './world/streets.js';
import { buildBuilding } from './kit/tenement.js';
import { makePlan } from './world/plan1920.js';

/* ------------------------------------------------------------------ *
 * The building panel: one generated building at a time in an orbit
 * viewer, its style record editable live, notes for the next refinement
 * round saved to /admin/api/notes, and a glTF (.glb) download of the
 * building as shown.
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfb9ab);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02;
const sun = new THREE.DirectionalLight(0xffe2bc, 2.0); sun.position.set(-30, 40, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
const sc = sun.shadow.camera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 150;
scene.add(sun, new THREE.HemisphereLight(0xc9d2dc, 0x6b6250, 0.8), new THREE.AmbientLight(0xffffff, 0.15));
const mats = makeMaterials();
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mats.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(60, 60, 0x776a52, 0x554a38); grid.position.y = 0.01; scene.add(grid);
let group = null, current = null, plan = null, streets = null, arrow = null;

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

async function load() {
  const [sceneData, parcels, overrides] = await Promise.all([
    fetch('data/scene.json').then((r) => r.json()), fetch('data/parcels.json').then((r) => r.json()),
    fetch('data/overrides.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  plan = makePlan(sceneData, parcels, overrides);
  streets = new Streets(plan.streets);
  const items = $('items');
  const label = (b) => { const st = b.addr?.street; const s1920 = b.street1920 || { 'Adama Mickiewicza': 'Bärenweg', 'Jana Kochanowskiego': 'Posadowskyweg', 'Sebastiana Klonowicza': 'Marineweg', 'Sochaczewska': 'Neptunweg' }[st]; const no = b.style?.number !== undefined && b.style.number !== '' ? b.style.number : b.addr?.housenumber; return { title: b.name || (s1920 ? `${s1920} ${no || ''}`.trim() : (st ? `${st} ${no || ''}` : (b.style?.kind === 'shed' ? 'szopa / komórka' : 'budynek'))), today: st ? `dziś ${st} ${b.addr.housenumber || ''}` : (b.style?.shop ? b.style.shop : '') }; };
  const groups = [['Bärenweg', (b) => b.addr?.street === 'Adama Mickiewicza' || b.id === 'bahnwaerter' || [92358185, 92358725].includes(b.id)], ['Posadowskyweg', (b) => b.addr?.street === 'Jana Kochanowskiego'], ['Marineweg', (b) => b.addr?.street === 'Sebastiana Klonowicza'], ['Szopy i komórki', (b) => b.style?.kind === 'shed'], ['Inne', () => true]];
  const seen = new Set(); const rows = [];
  for (const [g, f] of groups) { const list = plan.buildings.filter((b) => !seen.has(b.id) && f(b)); if (!list.length) continue; rows.push({ grp: g }); for (const b of list.sort((a, c) => (parseInt(a.addr?.housenumber) || 999) - (parseInt(c.addr?.housenumber) || 999))) { seen.add(b.id); rows.push({ b, ...label(b) }); } }
  const render = (q = '') => {
    items.innerHTML = '';
    for (const r of rows) {
      if (r.grp) { const d = document.createElement('div'); d.className = 'grp'; d.textContent = r.grp; items.appendChild(d); continue; }
      const text = `${r.title} ${r.today} ${r.b.id}`.toLowerCase(); if (q && !text.includes(q.toLowerCase())) continue;
      const d = document.createElement('div'); d.className = 'item' + (current && current.id === r.b.id ? ' on' : ''); d.dataset.id = r.b.id;
      d.innerHTML = `<b>${r.title}</b><small>${r.today}${r.today ? ' · ' : ''}${r.b.style?.kind || ''} · ${Math.round(r.b.area)} m² · ${r.b.h ? r.b.h.toFixed(1) + ' m LiDAR' : 'bez wysokości'} · id ${r.b.id}</small>`;
      d.addEventListener('click', () => show(r.b, r)); items.appendChild(d);
    }
  };
  $('q').addEventListener('input', (e) => render(e.target.value));
  render();
  const want = new URLSearchParams(location.search).get('id');
  const first = rows.find((r) => r.b && String(r.b.id) === want) || rows.find((r) => r.b && r.b.home) || rows.find((r) => r.b);
  if (first) show(first.b, first);
  resize();
}

function build(b, style, fresh = false) {
  if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  if (arrow) scene.remove(arrow);
  const world = new World(600);
  const baker = new Baker(mats, null);
  const g = new THREE.Group();
  const plate = (no, geom, matrix) => { const m = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ map: T.numberPlate(no) })); m.applyMatrix4(matrix); g.add(m); };
  const sign = (text, x, y, z, ang, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: T.shopSign(text) })); m.position.set(x, y, z); m.rotation.y = ang; g.add(m); };
  const ctx = { baker, world, streetDist: (x, z) => streets.dist(x, z, ['setts', 'sand', 'dirt']), plate, sign };
  const h = buildBuilding(b, ctx, style);
  baker.finish(g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const c = centroid(b.ring.map(xz));
  g.position.set(-c[0], 0, -c[1]);
  scene.add(g); group = g; window.__house = h;
  // an arrow towards the street the door faces
  if (h && h.door) { const dir = new THREE.Vector3(h.door.nx, 0, h.door.nz); arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(h.door.x - c[0], 0.3, h.door.z - c[1]), 5, 0xd9b45a, 1.2, 0.6); scene.add(arrow); }
  const size = Math.sqrt(b.area) * 1.6 + 12; const eaves = h ? h.eaves : 8;
  controls.target.set(0, eaves * 0.5, 0);
  if (fresh) { const dn = h && h.door ? new THREE.Vector3(h.door.nx, 0, h.door.nz) : new THREE.Vector3(0, 0, 1); camera.position.copy(dn.multiplyScalar(size)).add(new THREE.Vector3(size * 0.5, eaves * 0.9 + 4, 0)); }
  return h;
}

function show(b, row) {
  current = b;
  document.querySelectorAll('#list .item').forEach((d) => d.classList.toggle('on', d.dataset.id === String(b.id)));
  const style = JSON.parse(JSON.stringify(b.style || {}));
  const h = build(b, style, true);
  $('hTitle').textContent = row?.title || String(b.id); $('hSub').textContent = `${row?.today || ''} · ${b.style?.kind} · ${h ? h.storeys + ' kondygnacje, okap ' + h.eaves.toFixed(1) + ' m' : ''}`;
  $('style').value = JSON.stringify(style, null, 1);
  $('facts').innerHTML = [
    ['id OSM', b.id], ['adres dziś', b.addr ? `${b.addr.street || ''} ${b.addr.housenumber || ''}` : '—'], ['powierzchnia', `${Math.round(b.area)} m²`], ['wysokość LiDAR', b.h ? `${b.h.toFixed(2)} m (GUGiK LoD1)` : 'brak'], ['kondygnacje OSM', b.levels ?? '—'], ['typ OSM', b.type], ['odległość od Mickiewicza 43', `${Math.round(b.dist)} m`], ['w 1920', b.id === 'bahnwaerter' ? 'dom dróżnika (Bärenweg 6, Schulist)' : 'istniał — dom spółdzielni Neuschottland (1907–15)'],
  ].map(([k, v]) => `<div><span>${k}:</span> ${v}</div>`).join('');
  $('bApply').disabled = $('bReset').disabled = $('bGlb').disabled = $('bSave').disabled = false;
  $('styleMsg').textContent = ''; $('noteMsg').textContent = '';
  refs(b); loadNotes(b);
  history.replaceState(null, '', `?id=${b.id}`);
}

function refs(b) {
  const el = $('refs'); const st = b.addr?.street; const list = [];
  if (st === 'Jana Kochanowskiego' || st === 'Sebastiana Klonowicza' || b.id === 92356369) {
    list.push(['ref/posadowskyweg_82-86_1910.jpg', 'Posadowskyweg 82–86 (dziś Kochanowskiego), fot. 1910, Moderne Bauformen — ganek drewniany, okiennice, szczyty ceglano-tynkowe'], ['ref/posadowskyweg_99_1910.jpg', 'Posadowskyweg od nr 99 w dół, fot. 1910 — dachy mansardowe, płoty sztachetowe, piaszczysta jezdnia']);
  }
  if (st === 'Adama Mickiewicza' || [92358185, 92358725].includes(b.id)) list.push([null, 'Pocztówki „Reichskolonie Dzg.-Langfuhr” (róg Marine-/Posadowskyweg, Bärenweg): jarekwasielewski.pl/zwrzeszcza/2012/11/gruse-aus-reichskolonie-czyli-pocztowkowy-cymes/']);
  if (b.id === 'bahnwaerter') list.push([null, 'Adreßbuch 1920: „Bärenweg 6 — Eisenbahnfiskus, E; Schulist, Bahnwärter”. Wygląd domu dróżnika: typowy pruski, ceglany, jednokondygnacyjny z dachem czterospadowym — bez zdjęcia.']);
  list.push([null, `fotopolska.eu — dzisiejsze zdjęcia ulicy: https://fotopolska.eu/Gdansk/u${st === 'Jana Kochanowskiego' ? '104665,ul_Kochanowskiego_Jana' : '104928,ul_Mickiewicza_Adama'}.html`]);
  el.innerHTML = list.map(([src, cap]) => (src ? `<img src="${src}" alt="" /><div class="cap">${cap}</div>` : `<div class="cap" style="margin-top:8px">${cap}</div>`)).join('');
}

async function loadNotes(b) {
  const el = $('notes'); el.innerHTML = '';
  try {
    const r = await fetch(`admin/api/notes?id=${encodeURIComponent(b.id)}`); if (!r.ok) return;
    const list = await r.json();
    el.innerHTML = list.slice().reverse().map((n) => `<div class="n"><small>${new Date(n.t).toLocaleString('pl-PL')}${n.done ? ' · zrobione' : ''}</small>${escapeHtml(n.note)}</div>`).join('');
  } catch { /* the notes API is optional */ }
}
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

$('bApply').addEventListener('click', () => {
  try { const style = JSON.parse($('style').value); build(current, style); $('styleMsg').textContent = 'zastosowano (tylko podgląd)'; $('styleMsg').className = 'msg ok'; }
  catch (e) { $('styleMsg').textContent = 'błąd JSON: ' + e.message; $('styleMsg').className = 'msg err'; }
});
$('bReset').addEventListener('click', () => { $('style').value = JSON.stringify(current.style || {}, null, 1); build(current, JSON.parse(JSON.stringify(current.style || {}))); $('styleMsg').textContent = ''; });
$('bSave').addEventListener('click', async () => {
  const note = $('note').value.trim(); if (!note) return;
  let style = null; try { style = JSON.parse($('style').value); } catch { /* keep null */ }
  try {
    const r = await fetch('admin/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: current.id, addr: $('hTitle').textContent, note, style }) });
    if (!r.ok) throw new Error(r.status);
    $('noteMsg').textContent = 'zapisano — Claude to przeczyta'; $('noteMsg').className = 'msg ok'; $('note').value = ''; loadNotes(current);
  } catch (e) { $('noteMsg').textContent = 'nie zapisano (' + e.message + ')'; $('noteMsg').className = 'msg err'; }
});
$('bGlb').addEventListener('click', () => {
  if (!group) return;
  const exporter = new GLTFExporter();
  const name = `${$('hTitle').textContent.replace(/[^\w\däöüß-]+/gi, '_').toLowerCase()}_${current.id}.glb`;
  exporter.parse(group, (res) => { const blob = new Blob([res], { type: 'model/gltf-binary' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, (e) => alert('eksport nie powiódł się: ' + e.message), { binary: true, onlyVisible: true });
});
window.__admin = {
  scene, camera, controls, mats,
  get current() { return current; },
  /** azimuth/elevation in degrees, distance in metres, around the current target */
  setCam(az, el, dist) { const t = controls.target; const a = az * Math.PI / 180, e = el * Math.PI / 180;
    camera.position.set(t.x + Math.sin(a) * Math.cos(e) * dist, t.y + Math.sin(e) * dist, t.z + Math.cos(a) * Math.cos(e) * dist); controls.update(); },
  lookAt(x, y, z, dist, az = 40, el = 12) { controls.target.set(x, y, z); this.setCam(az, el, dist); },
};
load().catch((e) => { $('hTitle').textContent = 'błąd: ' + e.message; console.error(e); });
