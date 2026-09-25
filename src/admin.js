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
let group = null, current = null, plan = null, streets = null, arrow = null, photos = null;

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
  /** numery ścian drzewa na budynku (czerwony = ulica, szary = ślepa) */
  walls(on = true) {
    wallLabels = !!on;
    if (!group) return;
    for (const o of group.children.filter((c) => c.userData.label)) group.remove(o);
    if (wallLabels) addWallLabels(group, window.__house);
  },
  /** azimuth/elevation in degrees, distance in metres, around the current target */
  setCam(az, el, dist) { const t = controls.target; const a = az * Math.PI / 180, e = el * Math.PI / 180;
    camera.position.set(t.x + Math.sin(a) * Math.cos(e) * dist, t.y + Math.sin(e) * dist, t.z + Math.cos(a) * Math.cos(e) * dist); controls.update(); },
  lookAt(x, y, z, dist, az = 40, el = 12) { controls.target.set(x, y, z); this.setCam(az, el, dist); },
};
load().catch((e) => { $('hTitle').textContent = 'błąd: ' + e.message; console.error(e); });
