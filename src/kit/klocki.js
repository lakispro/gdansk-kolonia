import * as THREE from 'three';
import { wallQuad } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Klocki elewacji.  Budynek opisuje drzewo (zob. `buildBuilding`): bryły
 * z dachami i, dla każdej ściany i kondygnacji, lista klocków ustawionych
 * w metrach.  Tu jest to, co z pojedynczego klocka robi geometrię.
 *
 * Współrzędne klocka na ścianie:
 *   x   — środek klocka, w metrach od LEWEGO narożnika ściany, patrząc na nią z zewnątrz;
 *   dol — dolna krawędź nad podłogą kondygnacji (ujemna: poniżej, np. drzwi w cokole);
 *   w,h — szerokość i wysokość otworu.
 * ------------------------------------------------------------------ */

/** rama jednej ściany pierścienia (CCW): a→q, normalna na zewnątrz, pomocnicze pozycje */
export function wallFrame(ring, i) {
  const a = ring[i], q = ring[(i + 1) % ring.length];
  const dxw = q[0] - a[0], dzw = q[1] - a[1]; const len = Math.hypot(dxw, dzw);
  const nx = dzw / len, nz = -dxw / len;
  const ang = Math.atan2(dzw, -dxw);
  const along = (t, y, out) => [a[0] + dxw * t + nx * out, y, a[1] + dzw * t + nz * out];
  const patch = (t, y, wd, ht, out) => { const t0 = t - wd / 2 / len, t1 = t + wd / 2 / len; const A = along(t0, 0, out), B = along(t1, 0, out); const g = wallQuad(A[0], A[2], B[0], B[2], y - ht / 2, y + ht / 2, 1, true); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); return g; };
  // z zewnątrz lewy koniec ściany to q, więc x rośnie od q do a
  const T = (x) => 1 - x / len, X = (t) => (1 - t) * len;
  // azymut normalnej: 0 = północ, 90 = wschód (z to minus północ)
  const azymut = ((Math.atan2(nx, -nz) * 180 / Math.PI) + 360) % 360;
  return { i, a, q, len, nx, nz, ang, mx: (a[0] + q[0]) / 2, mz: (a[1] + q[1]) / 2, along, patch, T, X, azymut };
}

const M = new THREE.Matrix4();
const boxAt = (baker, W, p, w, h, d, key) => { M.makeRotationY(W.ang).setPosition(p[0], p[1], p[2]); baker.add(new THREE.BoxGeometry(w, h, d), M.clone(), key); };

/** półkoliste zamknięcie otworu (arkada): pole łuku w materiale otworu i kamienna archiwolta.
 *  Włącza je pole `luk` klocka (true = półkole o promieniu w/2, liczba = strzałka w metrach). */
function lukNad(baker, W, el, top, key) {
  const t = W.T(el.x), w = el.w, r = w / 2, rise = el.luk === true ? r : Number(el.luk);
  const seg = new THREE.CircleGeometry(r, 22, 0, Math.PI); seg.scale(1, rise / r, 1);
  const p = W.along(t, top, 0.025); M.makeRotationY(W.ang).setPosition(p[0], p[1], p[2]); baker.add(seg, M.clone(), key);
  const arc = new THREE.TorusGeometry(r + 0.03, 0.11, 6, 26, Math.PI); arc.scale(1, rise / r, 1);
  const q = W.along(t, top, 0.06); M.makeRotationY(W.ang).setPosition(q[0], q[1], q[2]); baker.add(arc, M.clone(), 'trim_stone');
}

/** okno: szyba, okiennice, nadproże, parapet, opaska */
function okno(baker, W, el, B, floor) {
  const t = W.T(el.x), w = el.w, h = el.h, y = floor + el.dol + h / 2;
  baker.add(W.patch(t, y, w, h, 0.025), null, el.mat || B.winK);
  if (el.okiennice) for (const e of [-1, 1]) boxAt(baker, W, W.along(t + e * (w / 2 + 0.3) / W.len, y, 0.05), 0.5, h - 0.05, 0.05, el.okiennice === true ? 'trim_green' : el.okiennice);
  if (el.luk) lukNad(baker, W, el, y + h / 2, el.mat || B.winK);
  else if (el.nadproze !== false) boxAt(baker, W, W.along(t, y + h / 2 + 0.12, 0.05), w + 0.36, 0.26, 0.09, B.isBrick ? 'brick_dark' : 'trim_stone');
  if (el.parapet !== false) boxAt(baker, W, W.along(t, y - h / 2 - 0.04, 0.08), w + 0.24, 0.09, 0.18, 'trim_stone');
  if (el.obramienie ?? B.frame) boxAt(baker, W, W.along(t, y, 0.03), w + 0.3, h + 0.2, 0.05, 'trim_stone');
}

/** drzwi: skrzydło, kamienna obudowa, schody, tabliczka z numerem.  Zwraca rekord wejścia. */
function drzwi(baker, W, el, B, floor) {
  const t = W.T(el.x), w = el.w, h = el.h, bottom = floor + el.dol, y = bottom + h / 2;
  const frame = el.obramienie ?? !B.isShed;
  baker.add(W.patch(t, y, w, h, frame ? 0.075 : 0.03), null, el.mat || (B.isShed ? 'plank_door' : B.isBrick ? 'door' : 'door_brown'));
  if (frame) boxAt(baker, W, W.along(t, y, 0.0), w + 0.5, h + 0.3, 0.12, B.isBrick ? 'brick_dark' : 'trim_stone');
  if (el.luk) lukNad(baker, W, el, bottom + h, el.mat || (B.isBrick ? 'door' : 'door_brown'));
  const n = el.schody ?? (B.isShed ? 0 : B.kind === 'tenement' ? 3 : 2);
  for (let s = 0; s < n; s++) { const p = W.along(t, bottom - s * 0.16 + 0.08, 0.3 + s * 0.3); p[1] = Math.max(0.08, p[1]); boxAt(baker, W, p, w + 0.6, 0.16, 0.6, 'trim_stone'); }
  const no = el.numer === true ? B.numberAt : el.numer;
  if (no && B.ctx.plate) B.ctx.plate(no, W.patch(t + (w / 2 + 0.35) / W.len, floor + 1.9, 0.3, 0.24, 0.03), new THREE.Matrix4());
  const p = W.along(t, 0, B.isShed ? 0 : 0.6);
  return { x: p[0], z: p[2], nx: W.nx, nz: W.nz, wall: W.i, t };
}

/** witryna sklepu z gzymsem, szyldem i cokolikiem */
function witryna(baker, W, el, B, floor) {
  const t = W.T(el.x), w = el.w, h = el.h, bottom = floor + el.dol;
  baker.add(W.patch(t, bottom + h / 2, w, h, 0.06), null, el.mat || 'shop');
  if (el.luk) lukNad(baker, W, el, bottom + h, el.mat || 'shop');
  const fp = W.along(t, bottom + h + (el.luk ? (el.luk === true ? w / 2 : Number(el.luk)) + 0.3 : 0.25), 0.12);
  if (!el.luk || el.szyld) boxAt(baker, W, fp, w + 0.5, 0.55, 0.14, 'trim_brown');
  if (el.szyld && B.ctx.sign) B.ctx.sign(el.szyld, fp[0] + W.nx * 0.09, fp[1], fp[2] + W.nz * 0.09, W.ang, w + 0.3, 0.5);
  const sp = W.along(t, 0, 0.02); sp[1] = floor + 0.1; boxAt(baker, W, sp, w + 0.2, 0.2, 0.3, 'trim_stone');
}

/** żeliwny balkon: płyta, balustrada z trzech stron, dwa wsporniki */
function balkon(baker, W, el, B, floor) {
  const t = W.T(el.x), w = el.w ?? 2.8, yB = floor + (el.dol ?? 0.6);
  boxAt(baker, W, W.along(t, yB, 0.66), w, 0.16, 1.3, 'trim_stone');
  { const rg = new THREE.PlaneGeometry(w, 1.0); const uv = rg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w, uv.getY(k)); const p = W.along(t, yB + 0.56, 1.26); M.makeRotationY(W.ang).setPosition(p[0], p[1], p[2]); baker.add(rg, M.clone(), 'railing'); }
  for (const e of [-1, 1]) { const p = W.along(t + e * (w / 2 - 0.02) / W.len, yB + 0.56, 0.66); M.makeRotationY(W.ang + Math.PI / 2).setPosition(p[0], p[1], p[2]); baker.add(new THREE.PlaneGeometry(1.25, 1.0), M.clone(), 'railing'); }
  for (const e of [-1, 1]) { const p = W.along(t + e * (w * 0.375) / W.len, yB - 0.42, 0.34); M.makeRotationY(W.ang + Math.PI / 4).setPosition(p[0], p[1], p[2]); baker.add(new THREE.ConeGeometry(0.24, 0.66, 4), M.clone(), 'trim_stone'); }
}

/** okno owalne (wole oko) w kamiennej opasce */
function owal(baker, W, el, B, floor) {
  const t = W.T(el.x), w = el.w ?? 1.0, h = el.h ?? 0.68, p = W.along(t, floor + el.dol + h / 2, 0.03);
  const g = new THREE.CircleGeometry(w / 2, 20); g.scale(1, h / w, 1); M.makeRotationY(W.ang).setPosition(p[0], p[1], p[2]); baker.add(g, M.clone(), 'glass_dark');
  const fr = new THREE.TorusGeometry(w / 2 + 0.02, 0.08, 6, 24); fr.scale(1, h / w + 0.02, 1); M.makeRotationY(W.ang).setPosition(p[0] + W.nx * 0.03, p[1], p[2] + W.nz * 0.03); baker.add(fr, M.clone(), 'trim_stone');
}

/** Katalog: typ klocka → budowniczy.  `brama` nie jest tutaj, bo wycina otwór
 *  w samej ścianie — buduje ją `buildBuilding` razem z murem. */
export const KLOCKI = { okno, drzwi, witryna, balkon, owal };

/** Wartości domyślne pól, które zna panel i agent.  Pola równe domyślnym są
 *  pomijane w eksporcie drzewa, żeby dało się je czytać. */
export const DOMYSLNE = {
  okno: { nadproze: true, parapet: true },
  drzwi: {},
  witryna: {},
  balkon: { w: 2.8, dol: 0.6 },
  owal: { w: 1.0, h: 0.68 },
  brama: {},
};

/** buduje wszystkie klocki elewacji, w kolejności ścian i kondygnacji; owale na końcu */
export function buildFacades(baker, frames, elewacje, B) {
  let door = null, streetDoor = null;
  const late = [];
  for (const E of elewacje) {
    const W = frames[E.sciana]; if (!W) continue;
    E.pietra.forEach((list, s) => {
      for (const el of list || []) {
        if (el.typ === 'brama') continue;
        if (el.typ === 'owal') { late.push([W, el, s]); continue; }
        const f = KLOCKI[el.typ]; if (!f) continue;
        const r = f(baker, W, el, B, B.floorY(s));
        if (el.typ === 'drzwi') { if (!door) door = r; if (!streetDoor && W.i === B.doorWall) streetDoor = r; }
      }
    });
  }
  for (const [W, el, s] of late) owal(baker, W, el, B, B.floorY(s));
  return streetDoor || door;
}
