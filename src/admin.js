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
// embed=1: sama scena do osadzenia (obrotnica warsztatu) — bez panelu, bez przesuwania celu,
// żeby każdy kąt dał się odtworzyć w rendererze samym (az, el, dist, ty, fov)
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
if (EMBED) document.body.classList.add('embed');
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfb9ab);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02;
if (EMBED) controls.enablePan = false;
controls.addEventListener('change', () => { if (window.__admin?.onCam) window.__admin.onCam(window.__admin.camState()); });
const sun = new THREE.DirectionalLight(0xffe2bc, 2.0); sun.position.set(-30, 40, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
const sc = sun.shadow.camera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 150;
scene.add(sun, new THREE.HemisphereLight(0xc9d2dc, 0x6b6250, 0.8), new THREE.AmbientLight(0xffffff, 0.15));
const mats = makeMaterials();
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mats.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(60, 60, 0x776a52, 0x554a38); grid.position.y = 0.01; scene.add(grid);
let group = null, current = null, plan = null, streets = null, arrow = null, photos = null, rowsAll = [];
let offset = [0, 0];   // środek budynku: scena = świat − offset (budynek stoi w początku układu)

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

async function load() {
  const [sceneData, parcels, overrides, photoData] = await Promise.all([
    fetch('data/scene.json').then((r) => r.json()), fetch('data/parcels.json').then((r) => r.json()),
    fetch('data/overrides.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch('data/photos.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  photos = photoData;
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
  rowsAll = rows;
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
  const c = centroid(b.ring.map(xz)); offset = c;
  g.position.set(-c[0], 0, -c[1]);
  scene.add(g); group = g; window.__house = h;
  if (wallLabels) addWallLabels(g, h);
  $('tree').value = h ? treeText(h.drzewo) : '';
  // an arrow towards the street the door faces
  if (h && h.door) { const dir = new THREE.Vector3(h.door.nx, 0, h.door.nz); arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(h.door.x - c[0], 0.3, h.door.z - c[1]), 5, 0xd9b45a, 1.2, 0.6); scene.add(arrow); }
  const size = Math.sqrt(b.area) * 1.6 + 12; const eaves = h ? h.eaves : 8;
  controls.target.set(0, eaves * 0.5, 0);
  if (fresh) { const dn = h && h.door ? new THREE.Vector3(h.door.nx, 0, h.door.nz) : new THREE.Vector3(0, 0, 1); camera.position.copy(dn.multiplyScalar(size)).add(new THREE.Vector3(size * 0.5, eaves * 0.9 + 4, 0)); }
  return h;
}

/** Numery ścian na budynku — żeby dało się powiedzieć, która ściana drzewa jest
 *  którą na zdjęciu.  Etykieta stoi przed środkiem ściany, na połowie okapu. */
let wallLabels = false;
function addWallLabels(g, h) {
  if (!h || !h.drzewo) return;
  for (const E of h.drzewo.elewacje) {
    const a = h.ring[E.sciana], q = h.ring[(E.sciana + 1) % h.ring.length];
    const len = Math.hypot(q[0] - a[0], q[1] - a[1]); const nx = (q[1] - a[1]) / len, nz = -(q[0] - a[0]) / len;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = E.slepa ? 'rgba(90,90,90,0.85)' : E.ulica ? 'rgba(170,60,30,0.92)' : 'rgba(20,40,90,0.9)';
    x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 70px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(E.sciana), 64, 68);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    sp.scale.set(1.6, 1.6, 1);
    sp.position.set((a[0] + q[0]) / 2 + nx * 1.2, (h.eaves || 8) * 0.55, (a[1] + q[1]) / 2 + nz * 1.2);
    sp.userData.label = true; g.add(sp);
  }
}

/** drzewo czytelnie: każda kondygnacja w jednej linii, żeby dało się je przejrzeć i przepisać */
function treeText(t) {
  if (!t) return '';
  const j = (v) => JSON.stringify(v);
  const el = t.elewacje.map((E) => {
    const head = { ...E }; delete head.pietra;
    return `  ${j(head).slice(0, -1)}, "pietra": [\n${E.pietra.map((l) => `    ${j(l)}`).join(',\n')}\n  ]}`;
  });
  return `{"cokol": ${t.cokol}, "kondygnacje": ${j(t.kondygnacje)}, "okap": ${t.okap},\n"bryly": [\n${t.bryly.map((b) => '  ' + j(b)).join(',\n')}\n],\n"elewacje": [\n${el.join(',\n')}\n]}`;
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
  $('bTree').disabled = $('bApply').disabled = $('bReset').disabled = $('bGlb').disabled = $('bSave').disabled = false;
  $('styleMsg').textContent = ''; $('noteMsg').textContent = '';
  refs(b); loadNotes(b);
  history.replaceState(null, '', `?id=${b.id}`);
}

function refs(b) {
  const el = $('refs'); const st = b.addr?.street; const list = [];
  const esc = (t) => String(t || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const card = (ph, tag) => `<a class="ph" href="${ph.page}" target="_blank" rel="noopener"><img src="ref/fotopolska/${ph.id}.jpg" loading="lazy" alt="" /></a><div class="cap"><b>${esc(ph.year || 'b.d.')}</b> · ${esc(ph.objectName)}${tag ? ' <span class="tag">' + esc(tag) + '</span>' : ''}<br>${esc(ph.caption || ph.title)}${ph.author ? ' <i>(' + esc(ph.author) + ')</i>' : ''}</div>`;
  if (photos) {
    const mine = (photos.byBuilding[String(b.id)] || []).map((id) => photos.photos[String(id)]).filter(Boolean);
    const seen = new Set(mine.map((p) => p.id));
    // neighbouring fotopolska objects, nearest first (ENU metres in both)
    const cx = b.c[0], cy = b.c[1];
    const near = photos.objects.map((o) => ({ o, d: Math.hypot(o.e - cx, o.n - cy) })).filter((q) => q.d < 70 && !(q.o.osm || []).includes(b.id)).sort((p, q) => p.d - q.d);
    const others = [];
    for (const { o, d } of near) for (const id of o.photos) { const ph = photos.photos[String(id)]; if (ph && !seen.has(ph.id)) { seen.add(ph.id); others.push({ ph, d }); } }
    const ord = (arr) => arr.sort((p, q) => (parseInt(p.year) || 9999) - (parseInt(q.year) || 9999));
    if (mine.length) list.push(`<div class="grp2">ten budynek · fotopolska.eu</div>` + ord(mine).map((ph) => card(ph)).join(''));
    if (others.length) list.push(`<div class="grp2">sąsiedztwo</div>` + others.slice(0, 8).map(({ ph, d }) => card(ph, `${Math.round(d)} m`)).join(''));
  }
  if (st === 'Jana Kochanowskiego' || st === 'Sebastiana Klonowicza' || b.id === 92356369) {
    list.push(`<div class="grp2">1910 · Moderne Bauformen</div><img src="ref/posadowskyweg_82-86_1910.jpg" alt="" /><div class="cap">Posadowskyweg 82–86 (dziś Kochanowskiego), fot. 1910 — ganek drewniany, okiennice, szczyty ceglano-tynkowe</div><img src="ref/posadowskyweg_99_1910.jpg" alt="" /><div class="cap">Posadowskyweg od nr 99 w dół, fot. 1910 — dachy mansardowe, płoty sztachetowe, piaszczysta jezdnia</div>`);
  }
  if (b.id === 'bahnwaerter') list.push(`<div class="cap">Adreßbuch 1920: „Bärenweg 6 — Eisenbahnfiskus, E; Schulist, Bahnwärter”. Dom dróżnika: typowy pruski, ceglany, parterowy z dachem czterospadowym — bez zdjęcia.</div>`);
  if (!list.length) list.push(`<div class="cap">Brak zdjęć tego budynku na fotopolska.eu w promieniu 70 m.</div>`);
  el.innerHTML = list.join('');
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
// drzewo do stylu: od tej chwili ten budynek ma jawne bryły i klocki, które można przestawiać ręcznie
$('bTree').addEventListener('click', () => {
  try {
    const t = window.__house?.drzewo; if (!t) return;
    const style = JSON.parse($('style').value);
    style.kondygnacje = t.kondygnacje; style.bryly = t.bryly;
    style.elewacje = Object.fromEntries(t.elewacje.filter((E) => !E.slepa).map((E) => [E.sciana, E.pietra]));
    $('style').value = JSON.stringify(style, null, 1); $('styleMsg').textContent = 'drzewo w stylu — zmień i zastosuj'; $('styleMsg').className = 'msg ok';
  } catch (e) { $('styleMsg').textContent = 'błąd JSON: ' + e.message; $('styleMsg').className = 'msg err'; }
});
$('bWalls').addEventListener('click', () => { window.__admin.walls(!wallLabels); $('bWalls').classList.toggle('alt', !wallLabels); });
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
  /**
   * Przebudowa bieżącego budynku z podanym stylem, bez przeładowania strony
   * i bez `npm run build`.  To samo, co robi przycisk „Zastosuj" — wystawione
   * na zewnątrz, żeby warsztat mógł próbować wariantów i renderować katalogi.
   * Styl jest scalany z wyliczonym (jak nadpisania), chyba że `replace`.
   */
  restyle(style, replace = false) {
    if (!current) throw new Error('nie wybrano budynku');
    const base = JSON.parse(JSON.stringify(current.style || {}));
    const s = replace ? (style || {}) : Object.assign(base, style || {});
    const h = build(current, s);
    $('style').value = JSON.stringify(s, null, 1);
    return { storeys: h?.storeys, eaves: h?.eaves };
  },
  /** Powrót do stylu wyliczonego w plan1920.js — po obejrzeniu wariantów. */
  reset() { return this.restyle({}, true) && this.restyle(JSON.parse(JSON.stringify(current.style || {})), true); },
  /**
   * Co warsztat wie o budynku bez patrzenia na piksele: styl po scaleniu,
   * zmierzona bryła i proporcje.  Proporcje są niewrażliwe na kąt kamery,
   * więc dają się porównać z archiwalnym zdjęciem.
   */
  info() {
    if (!current) return null;
    const h = window.__house || {};
    const ring = (current.ring || []).map((p) => (Array.isArray(p) ? p : [p.x ?? p[0], p.z ?? p[1]]));
    let w = 0, d = 0;
    if (ring.length) {
      const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
      w = Math.max(...xs) - Math.min(...xs); d = Math.max(...zs) - Math.min(...zs);
    }
    const eaves = h.eaves || 0;
    const ridge = h.ridge || null;
    let style = {};
    try { style = JSON.parse($('style').value); } catch { style = current.style || {}; }
    return {
      id: String(current.id), area: current.area, footprint: { w: +w.toFixed(1), d: +d.toFixed(1) },
      storeys: h.storeys ?? null, eaves: +eaves.toFixed(2),
      kalenica: ridge ? +ridge.toFixed(2) : null,
      roofKind: h.roofKind ?? null, pitch: h.pitch ?? null,
      door: h.door ? { nx: +h.door.nx.toFixed(3), nz: +h.door.nz.toFixed(3) } : null,
      style,
      // bryły i klocki elewacji, tak jak generator je ułożył (albo jak je nadpisał styl)
      drzewo: h.drzewo || null,
      // proporcje do porównania ze zdjęciem — bez metrów, więc bez perspektywy
      ratios: {
        szerokosc_do_okapu: eaves ? +(w / eaves).toFixed(2) : null,
        glebokosc_do_szerokosci: w ? +(d / w).toFixed(2) : null,
        dach_do_elewacji: eaves && ridge ? +((ridge - eaves) / eaves).toFixed(2) : null,
      },
    };
  },
  /** wybór budynku po id — dla osadzonej obrotnicy */
  select(id) {
    const r = rowsAll.find((q) => q.b && String(q.b.id) === String(id));
    if (!r) return false;
    if (!current || String(current.id) !== String(id)) show(r.b, r);
    return true;
  },
  /** azymut drzwi — „na wprost drzwi" w obrotnicy */
  get doorAz() { const h = window.__house; return h && h.door ? Math.atan2(h.door.nx, h.door.nz) * 180 / Math.PI : 0; },
  /** kamera tak, jak ustawia ją renderer warsztatu (`aim` w renderer/server.mjs):
   *  cel nad środkiem budynku na `ty` (0 = pół okapu), dystans 0 = automatyczny */
  aimCam(o) {
    const h = window.__house; const eaves = h ? h.eaves : 8;
    const auto = Math.sqrt((current && current.area) || 120) * 2.0 + 16;
    camera.fov = o.fov || 45; camera.updateProjectionMatrix();
    controls.target.set(o.tx || 0, o.ty ? o.ty : eaves * 0.5, o.tz || 0);
    this.setCam(o.az || 0, o.el ?? 9, o.dist || auto);
  },
  /** odwrotność `aimCam`: kamera z obracania myszą/palcem jako liczby */
  camState() {
    const t = controls.target, v = camera.position.clone().sub(t); const d = v.length() || 1;
    const h = window.__house; const eaves = h ? h.eaves : 8;
    const o = { az: Math.atan2(v.x, v.z) * 180 / Math.PI, el: Math.asin(Math.max(-1, Math.min(1, v.y / d))) * 180 / Math.PI,
      dist: d, ty: Math.abs(t.y - eaves * 0.5) < 0.01 ? 0 : t.y, fov: camera.fov };
    if (Math.abs(t.x) > 0.01) o.tx = t.x;
    if (Math.abs(t.z) > 0.01) o.tz = t.z;
    return o;
  },
  /**
   * Punkt budynku w układzie sceny, opisany tak, jak da się go wskazać na zdjęciu:
   *   { naroznik: i, wys }       — wierzchołek i obrysu (ściana i biegnie od i do i+1)
   *   { sciana: i, x, wys }      — punkt ściany, x w metrach od LEWEGO narożnika (z zewnątrz)
   * `wys`: 'grunt' (0), 'okap', albo liczba metrów nad chodnikiem.
   */
  point3d(q) {
    const h = window.__house; if (!h) throw new Error('brak budynku');
    const n = h.ring.length; let p;
    if (q.naroznik !== undefined) { const i = ((Number(q.naroznik) % n) + n) % n; p = h.ring[i]; }
    else if (q.sciana !== undefined) {
      const i = ((Number(q.sciana) % n) + n) % n; const a = h.ring[i], b = h.ring[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const k = Math.max(0, Math.min(1, (Number(q.x) || 0) / len));
      p = [b[0] + (a[0] - b[0]) * k, b[1] + (a[1] - b[1]) * k];   // x od lewego końca (q) ku prawemu (a)
    } else throw new Error('punkt: podaj naroznik albo sciana+x');
    const y = q.wys === 'okap' ? h.eaves : q.wys === 'grunt' || q.wys === undefined ? 0 : Number(q.wys);
    if (!Number.isFinite(y)) throw new Error('punkt: wys to grunt, okap albo liczba metrów');
    return [p[0] - offset[0], y, p[1] - offset[1]];
  },
  /**
   * Kamera zdjęcia z punktów: kilka punktów budynku ze znanym położeniem na zdjęciu
   * (u, v w ułamkach szerokości/wysokości).  Szuka azymutu, wzniesienia, dystansu,
   * ogniskowej i celu (tx, ty, tz) metodą sympleksu z kilku startów, na tej samej
   * kamerze three.js, którą potem renderujemy — więc wynik jest wprost do użycia.
   * Zwraca kamerę, średni i największy błąd w pikselach zdjęcia i błąd każdego punktu.
   */
  fitCamera({ points, aspect, W = 1000, H = 1000, start = null } = {}) {
    const h = window.__house; if (!h) throw new Error('brak budynku');
    const P = points.map((q) => ({ q, p: new THREE.Vector3(...this.point3d(q)), u: Number(q.u), v: Number(q.v) }));
    if (P.length < 4) throw new Error('potrzeba co najmniej 4 punktów (lepiej 6)');
    const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 2000); const tmp = new THREE.Vector3();
    const deg = Math.PI / 180, eaves = h.eaves || 8;
    const unpack = (x) => ({ az: x[0], el: Math.max(-10, Math.min(80, x[1])), dist: Math.exp(x[2]), fov: Math.max(8, Math.min(100, x[3])), tx: x[4], ty: x[5], tz: x[6] });
    const place = (c) => { cam.fov = c.fov; cam.aspect = aspect; cam.updateProjectionMatrix();
      const a = c.az * deg, e = c.el * deg;
      cam.position.set(c.tx + Math.sin(a) * Math.cos(e) * c.dist, c.ty + Math.sin(e) * c.dist, c.tz + Math.cos(a) * Math.cos(e) * c.dist);
      cam.lookAt(c.tx, c.ty, c.tz); cam.updateMatrixWorld(true); };
    const resid = (c) => { place(c); return P.map((o) => { tmp.copy(o.p).project(cam); if (tmp.z > 1) return [9, 9];
      return [((tmp.x + 1) / 2 - o.u) * aspect, ((1 - tmp.y) / 2 - o.v)]; }); };
    const cost = (x) => { const c = unpack(x); let s = 0; for (const [a, b] of resid(c)) s += a * a + b * b;
      if (x[1] < -10 || x[1] > 80 || x[3] < 8 || x[3] > 100) s += 10; return s; };
    const nm = (x0) => {   // Nelder–Mead
      const n = x0.length, steps = [20, 5, 0.3, 8, 3, 2, 3];
      let S = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += steps[i]; S.push(x); }
      let F = S.map(cost);
      for (let it = 0; it < 1500; it++) {
        const ord = F.map((f, i) => i).sort((a, b) => F[a] - F[b]); S = ord.map((i) => S[i]); F = ord.map((i) => F[i]);
        if (F[n] - F[0] < 1e-12) break;
        const cen = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += S[i][j] / n;
        const at = (t) => cen.map((c, j) => c + t * (S[n][j] - c));
        const xr = at(-1), fr = cost(xr);
        if (fr < F[0]) { const xe = at(-2), fe = cost(xe); if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
        else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
        else { const xc = at(fr < F[n] ? -0.5 : 0.5), fc = cost(xc);
          if (fc < Math.min(fr, F[n])) { S[n] = xc; F[n] = fc; }
          else for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = cost(S[i]); } }
      }
      return { x: S[0], f: F[0] };
    };
    const size = Math.sqrt((current && current.area) || 120);
    const starts = [];
    if (start && Number.isFinite(start.az)) starts.push([start.az, start.el ?? 8, Math.log(start.dist || size * 2 + 16), start.fov || 45, start.tx || 0, start.ty || eaves * 0.5, start.tz || 0]);
    for (let az = -180; az < 180; az += 30) for (const fov of [30, 55]) starts.push([az, 6, Math.log(size * 2 + 16), fov, 0, eaves * 0.5, 0]);
    let best = null;
    for (const x0 of starts) { let r = nm(x0); r = nm(r.x); if (!best || r.f < best.f) best = r; }
    const c = unpack(best.x); c.az = ((c.az + 540) % 360) - 180;
    const rs = resid(c).map(([a, b]) => Math.hypot(a / aspect * W, b * H));
    const out = { az: +c.az.toFixed(2), el: +c.el.toFixed(2), dist: +c.dist.toFixed(2), fov: +c.fov.toFixed(2), tx: +c.tx.toFixed(2), ty: +c.ty.toFixed(2), tz: +c.tz.toFixed(2) };
    return { cam: out, blad_sredni_px: +(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1), blad_max_px: +Math.max(...rs).toFixed(1),
      punkty: P.map((o, i) => ({ ...o.q, blad_px: +rs[i].toFixed(1) })),
      kierunek: +(((-c.az) % 360 + 360) % 360).toFixed(0) };
  },
  /**
   * Mapa z góry: obrys z numerami ścian (na zewnątrz) i narożników (n0, n1…), sąsiednie
   * budynki, ulice z nazwami z 1920, północ, skala i — jeśli podane — kamery zdjęć
   * jako klin widzenia.  Rysowana na płótnie 2D, zwraca data-URL JPEG.
   */
  plan2d({ w = 900, cams = [] } = {}) {
    const h = window.__house; if (!h || !plan) throw new Error('brak budynku');
    const ring = h.ring; const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 50;
    const k = w / span; const X = (x) => (x - cx) * k + w / 2, Y = (z) => (z - cz) * k + w / 2;   // północ w górę (z = −północ)
    const cv = document.createElement('canvas'); cv.width = cv.height = w; const g = cv.getContext('2d');
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, w);
    const near = (r) => r.some((p) => Math.abs(p[0] - cx) < span && Math.abs(p[1] - cz) < span);
    // ulice
    g.lineCap = 'round';
    for (const st of (streets ? streets.streets : [])) {
      if (!near(st.pts)) continue;
      g.strokeStyle = '#d6cbb2'; g.lineWidth = Math.max(4, (st.width || 6) * k);
      g.beginPath(); st.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke();
    }
    g.fillStyle = '#6a5a3a'; g.font = 'italic 15px Georgia';
    const named = new Set(), labels = [];
    for (const st of (streets ? streets.streets : [])) {
      const nm = st.name1920 || st.name; if (!nm || named.has(nm) || !near(st.pts)) continue;
      // podpis wzdłuż ulicy, w widocznym kawałku, z dala od innych podpisów
      const vis = st.pts.map((q, i) => ({ x: X(q[0]), y: Y(q[1]), i })).filter((q) => q.x > 30 && q.y > 30 && q.x < w - 30 && q.y < w - 30);
      if (vis.length < 2) continue;
      let pick = null;
      for (const f of [0.25, 0.75, 0.5, 0.1, 0.9]) {
        const q = vis[Math.min(vis.length - 2, Math.floor(f * (vis.length - 1)))];
        if (labels.every((l) => Math.hypot(l[0] - q.x, l[1] - q.y) > 170)) { pick = q; break; }
      }
      if (!pick) continue;
      const nq = st.pts[pick.i + 1] || st.pts[pick.i - 1]; let ang = Math.atan2(Y(nq[1]) - pick.y, X(nq[0]) - pick.x);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      named.add(nm); labels.push([pick.x, pick.y]);
      g.save(); g.translate(pick.x, pick.y); g.rotate(ang); g.textAlign = 'center';
      g.fillText(nm + (st.name1920 && st.name ? ` (dziś ${st.name.split(' ').pop()})` : ''), 0, -4); g.restore();
    }
    // sąsiedzi
    for (const b of plan.buildings) {
      if (current && b.id === current.id) continue; const r = b.ring.map(xz); if (!near(r)) continue;
      g.fillStyle = '#c9c1b0'; g.strokeStyle = '#9d9483'; g.lineWidth = 1;
      g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill(); g.stroke();
    }
    // ten budynek
    g.fillStyle = '#d9b45a'; g.strokeStyle = '#5b4520'; g.lineWidth = 2;
    g.beginPath(); ring.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill(); g.stroke();
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
      if (len >= 1.6) {
        const mx = X((a[0] + b[0]) / 2 + nx * 3.2), my = Y((a[1] + b[1]) / 2 + nz * 3.2);
        const E = h.drzewo?.elewacje.find((e) => e.sciana === i);
        g.fillStyle = E?.slepa ? '#777' : E?.ulica ? '#a33c1e' : '#1f3a6e'; g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i), mx, my + 1);
      }
      g.fillStyle = '#000'; g.beginPath(); g.arc(X(a[0]), Y(a[1]), 3, 0, Math.PI * 2); g.fill();
      g.font = '11px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('n' + i, X(a[0]) + 4, Y(a[1]) - 4);
    }
    if (h.door) { g.strokeStyle = '#a33c1e'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(h.door.x), Y(h.door.z)); g.lineTo(X(h.door.x + h.door.nx * 4), Y(h.door.z + h.door.nz * 4)); g.stroke(); }
    // kamery zdjęć
    const deg = Math.PI / 180;
    for (const c of cams) {
      if (!c || !c.cam) continue; const o = c.cam; const auto = Math.sqrt((current && current.area) || 120) * 2 + 16;
      const tx = (o.tx || 0) + offset[0], tz = (o.tz || 0) + offset[1], a = (o.az || 0) * deg, d = (o.dist || auto) * Math.cos((o.el || 0) * deg);
      const px = tx + Math.sin(a) * d, pz = tz + Math.cos(a) * d; const half = ((o.fov || 45) * 0.75) * deg / 2 * 1.4;
      const dir = Math.atan2(tz - pz, tx - px); const L = Math.min(d, 60);
      g.fillStyle = (c.color || '#2a6') + '33'; g.strokeStyle = c.color || '#2a6'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(px), Y(pz)); g.lineTo(X(px + Math.cos(dir - half) * L), Y(pz + Math.sin(dir - half) * L));
      g.lineTo(X(px + Math.cos(dir + half) * L), Y(pz + Math.sin(dir + half) * L)); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = c.color || '#2a6'; g.beginPath(); g.arc(X(px), Y(pz), 6, 0, Math.PI * 2); g.fill();
      g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(c.label || '', Math.min(w - 120, Math.max(4, X(px) + 8)), Math.min(w - 6, Math.max(14, Y(pz) - 8)));
    }
    // północ i skala
    g.fillStyle = '#222'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
    g.beginPath(); g.moveTo(w - 30, 18); g.lineTo(w - 38, 42); g.lineTo(w - 22, 42); g.closePath(); g.fill(); g.fillText('N', w - 30, 60);
    g.fillRect(20, w - 24, 10 * k, 4); g.textAlign = 'left'; g.font = '12px sans-serif'; g.fillText('10 m', 20, w - 30);
    return cv.toDataURL('image/jpeg', 0.9);
  },
  onCam: null,
  /**
   * Zdjęcie kadru prosto z bufora WebGL, w zadanej rozdzielczości, niezależnie od
   * rozmiaru okna.  `crop` przycina do obrysu budynku (rzut pudełka budynku na
   * ekran + margines) — wtedy w porównaniu ze zdjęciem budynek wypełnia kadr, a nie
   * jedną trzecią.  `aspect` wymusza proporcje kadru (np. zdjęcia, do nakładki).
   * Zwraca data-URL JPEG.
   */
  snapshot({ w = 1600, crop = true, aspect = null, margin = 0.05, q = 0.9 } = {}) {
    const cw = Math.round(w), ch = Math.round(aspect ? w / aspect : w * canvas.clientHeight / Math.max(1, canvas.clientWidth));
    const pr = renderer.getPixelRatio(); const hideArrow = arrow && arrow.visible;
    if (hideArrow) arrow.visible = false;
    renderer.setPixelRatio(1); renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    let sx = 0, sy = 0, sw = cw, sh = ch;
    if (crop && group) {
      // rzut wszystkich wierzchołków budynku (pudełko osiowe obróconego budynku jest za luźne);
      // to, co pod gruntem (fundament od -1 m), nie liczy się do kadru
      const v = new THREE.Vector3(); group.updateMatrixWorld(true);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      group.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position; const step = Math.max(1, Math.floor(pos.count / 20000));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < -0.05) continue;
          v.project(camera); if (v.z > 1) continue;
          const px = (v.x + 1) / 2 * cw, py = (1 - v.y) / 2 * ch;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
      });
      const m = margin * Math.max(x1 - x0, y1 - y0);
      sx = Math.max(0, Math.floor(x0 - m)); sy = Math.max(0, Math.floor(y0 - m));
      sw = Math.min(cw, Math.ceil(x1 + m)) - sx; sh = Math.min(ch, Math.ceil(y1 + m)) - sy;
      if (sw < 16 || sh < 16) { sx = 0; sy = 0; sw = cw; sh = ch; }
    }
    const c2 = document.createElement('canvas'); c2.width = sw; c2.height = sh;
    c2.getContext('2d').drawImage(renderer.domElement, sx, sy, sw, sh, 0, 0, sw, sh);
    const url = c2.toDataURL('image/jpeg', q);
    if (hideArrow) arrow.visible = true;
    renderer.setPixelRatio(pr); resize(); renderer.render(scene, camera);
    return url;
  },
  /** numery ścian drzewa na budynku (czerwony = ulica, szary = ślepa) */
  walls(on = true) {
    wallLabels = !!on;
    if (!group) return;
    for (const o of group.children.filter((c) => c.userData.label)) group.remove(o);
    if (wallLabels) addWallLabels(group, window.__house);
  },
  /** azimuth/elevation in degrees, distance in metres, around the current target */
  setCam(az, el, dist) { const t = controls.target; const a = az * Math.PI / 180, e = el * Math.PI / 180;
    camera.position.set(t.x + Math.sin(a) * Math.cos(e) * dist, t.y + Math.sin(e) * dist, t.z + Math.cos(a) * Math.cos(e) * dist);
    // bez tłumienia na jedną klatkę: gasi rozpęd po obracaniu palcem, który inaczej odkręciłby kamerę
    const damp = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = damp; },
  lookAt(x, y, z, dist, az = 40, el = 12) { controls.target.set(x, y, z); this.setCam(az, el, dist); },
};
load().catch((e) => { $('hTitle').textContent = 'błąd: ' + e.message; console.error(e); });
