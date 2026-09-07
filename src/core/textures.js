import * as THREE from 'three';

/* Every surface is drawn with Canvas2D at start-up: Danzig brick, lime
 * plaster, granite setts, dirt, period windows and doors, enamel signs.
 * Textures are tiling, sRGB, and sized for a phone GPU (256-512 px). */

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat = 1, aniso = 4) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.repeat.set(repeat, repeat); return t;
}
function flat(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
let seed = 1; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function noise(ctx, w, h, amount, n = 4000) {
  for (let i = 0; i < n; i++) { const a = (rnd() - 0.5) * amount; ctx.fillStyle = `rgba(${a > 0 ? 255 : 0},${a > 0 ? 255 : 0},${a > 0 ? 255 : 0},${Math.abs(a)})`; ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
}
function hexToRgb(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }
function shade(hex, k) { const [r, g, b] = hexToRgb(hex); return `rgb(${Math.round(Math.min(255, r * k))},${Math.round(Math.min(255, g * k))},${Math.round(Math.min(255, b * k))})`; }

/** Danzig brick: stretcher bond, 1 tile = 2 m x 2 m. hex = base brick colour */
export function brick(hex = 0x9a4a32, mortar = 0xb9b0a0) {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'); const px = S / 2; // px per metre
  x.fillStyle = shade(mortar, 1); x.fillRect(0, 0, S, S);
  const bw = 0.25 * px, bh = 0.0715 * px; // 25 x 7.15 cm courses (Reichsformat)
  for (let row = 0; row * bh < S; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col * bw < S + bw; col++) {
      const k = 0.78 + rnd() * 0.42; const r = rnd();
      x.fillStyle = r < 0.08 ? shade(0x5a2e22, k) : r < 0.16 ? shade(0xb46a44, k) : shade(hex, k);
      x.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
      // slight darker bottom edge
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(col * bw + off + 1, row * bh + bh - 3, bw - 2, 2);
    }
  }
  noise(x, S, S, 0.1, 5000);
  return tex(c, 1, 8);
}
export function brickYellow() { return brick(0xc9a86a, 0xb8ae9c); }
export function brickDark() { return brick(0x6e3a2c, 0x8f8578); }
/** old lime plaster, weathered, streaked under the sills.  1 tile = 2 m */
export function plaster(hex) {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = shade(hex, 1); x.fillRect(0, 0, S, S); noise(x, S, S, 0.09, 4000);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; x.fillRect(rnd() * S, 0, 1 + rnd() * 3, S); }
  for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(60,40,20,${rnd() * 0.08})`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 4 + rnd() * 14, 0, 7); x.fill(); }
  return tex(c, 1, 2);
}
/** rusticated plinth: dark grey rendered blocks with grooves. 1 tile = 2 m */
export function rustic() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#6e6a62'; x.fillRect(0, 0, S, S);
  const bh = S / 4;
  for (let r = 0; r < 4; r++) { const off = (r % 2) * S / 4; for (let k = -1; k < 3; k++) { x.fillStyle = shade(0x7a766d, 0.9 + rnd() * 0.2); x.fillRect(k * S / 2 + off + 3, r * bh + 3, S / 2 - 6, bh - 6); } }
  noise(x, S, S, 0.12, 3000); return tex(c, 1, 4);
}
/** granite setts (Kopfsteinpflaster) as on Langfuhr's streets. 1 tile = 2 m */
export function setts(base = 0x7d7a75) {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'); const px = S / 2;
  x.fillStyle = shade(0x4a4640, 1); x.fillRect(0, 0, S, S);
  const bw = 0.16 * px, bh = 0.13 * px;
  for (let row = 0; row * bh < S + bh; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col * bw < S + bw; col++) {
      const k = 0.75 + rnd() * 0.5; const t = rnd();
      x.fillStyle = t < 0.15 ? shade(0x8a7f78, k) : t < 0.3 ? shade(0x6f747c, k) : shade(base, k);
      const jx = (rnd() - 0.5) * 3, jy = (rnd() - 0.5) * 3;
      x.beginPath(); x.roundRect(col * bw + off + 2 + jx, row * bh + 2 + jy, bw - 4, bh - 4, 5); x.fill();
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(col * bw + off + 4 + jx, row * bh + 3 + jy, bw - 10, 2);
    }
  }
  noise(x, S, S, 0.12, 6000);
  return tex(c, 1, 8);
}
/** hard-packed earth road with cart ruts and puddle stains. 1 tile = 2 m */
export function dirt() {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#7d6b50'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `hsl(${28 + rnd() * 14},${20 + rnd() * 20}%,${28 + rnd() * 22}%)`; x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 3); }
  // ruts run along v
  for (const u of [0.31, 0.69]) { const g = x.createLinearGradient(u * S - 22, 0, u * S + 22, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(40,28,14,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(u * S - 22, 0, 44, S); }
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(70,60,50,.35)'; x.beginPath(); x.ellipse(rnd() * S, rnd() * S, 10 + rnd() * 30, 6 + rnd() * 14, rnd() * 3, 0, 7); x.fill(); }
  noise(x, S, S, 0.1, 3000);
  return tex(c, 1, 6);
}
/** gravel / cinder footway */
export function cinder() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#5e5a55'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.3, 9000);
  return tex(c);
}
/** clinker footway pavers, small yellow-grey bricks */
export function clinker() {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'); const px = S / 2;
  x.fillStyle = '#6f6a60'; x.fillRect(0, 0, S, S);
  const bw = 0.25 * px, bh = 0.12 * px;
  for (let row = 0; row * bh < S + bh; row++) { const off = (row % 2) * bw / 2; for (let col = -1; col * bw < S + bw; col++) { x.fillStyle = shade(0xa39073, 0.8 + rnd() * 0.4); x.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2); } }
  noise(x, S, S, 0.12, 4000); return tex(c, 1, 8);
}
/** autumn grass / meadow, a little worn */
export function grass() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#767a44'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `hsl(${58 + rnd() * 30},${22 + rnd() * 20}%,${22 + rnd() * 22}%)`; x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 3); }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,90,40,${rnd() * 0.25})`; x.beginPath(); x.ellipse(rnd() * S, rnd() * S, 6 + rnd() * 16, 4 + rnd() * 10, rnd() * 3, 0, 7); x.fill(); }
  return tex(c);
}
/** ploughed allotment soil, rows */
export function soil() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#5a4634'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.22, 7000);
  for (let i = 0; i < S; i += 24) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, i, S, 6); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, i + 12, S, 4); }
  return tex(c);
}
export function gravel() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#9a9184'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.25, 8000);
  return tex(c);
}
/** plain clay pantiles / Biberschwanz, in courses. tile = 2 m x 2 m */
export function roofTile(hex, profile = true) {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'); const px = S / 2;
  x.fillStyle = shade(hex, 0.8); x.fillRect(0, 0, S, S);
  const course = 0.3 * px, tw = profile ? 0.3 * px : 0.16 * px;
  for (let row = 0; row * course < S + course; row++) {
    const off = (row % 2) * tw / 2;
    for (let col = -1; col * tw < S + tw; col++) {
      const k = 0.85 + rnd() * 0.3;
      const gx = x.createLinearGradient(col * tw + off, 0, col * tw + off + tw, 0);
      if (profile) { gx.addColorStop(0, shade(hex, k * 0.7)); gx.addColorStop(0.4, shade(hex, k * 1.08)); gx.addColorStop(1, shade(hex, k * 0.8)); }
      else { gx.addColorStop(0, shade(hex, k)); gx.addColorStop(1, shade(hex, k * 0.92)); }
      x.fillStyle = gx;
      if (profile) x.fillRect(col * tw + off, row * course, tw, course - 2);
      else { x.beginPath(); x.roundRect(col * tw + off + 1, row * course, tw - 2, course + 6, [0, 0, 8, 8]); x.fill(); }
    }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, row * course + course - 3, S, 3);
  }
  // moss
  for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(90,110,40,${rnd() * 0.25})`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 3 + rnd() * 8, 0, 7); x.fill(); }
  noise(x, S, S, 0.08, 3000);
  return tex(c, 1, 8);
}
/** tar-paper / slate for sheds and flat roofs */
export function tarPaper() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#3a3835'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.16, 6000);
  for (let i = 0; i < S; i += 64) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, i, S, 3); }
  return tex(c, 1, 4);
}
/** period cross window: wooden frame (painted), two casements with a transom, 6 panes, dark glass with a warm room glow */
export function windowTex(kind = 'std', frameHex = 0xe9e4d6) {
  const W = 128, H = kind === 'tall' ? 200 : 160, c = canvas(W, H), x = c.getContext('2d');
  // reveal (in shadow), brick arch is done in geometry
  x.fillStyle = '#2a2622'; x.fillRect(0, 0, W, H);
  const fr = shade(frameHex, 1);
  x.fillStyle = fr; x.fillRect(6, 6, W - 12, H - 12);
  // glass
  const g = x.createLinearGradient(0, 10, 0, H - 10); g.addColorStop(0, '#6d7d86'); g.addColorStop(0.5, '#2f3a42'); g.addColorStop(1, '#1b2126');
  x.fillStyle = g; x.fillRect(12, 12, W - 24, H - 24);
  // a lace curtain and a warm glow in one pane
  x.fillStyle = 'rgba(240,230,210,.35)'; x.fillRect(14, 14, W - 28, (H - 28) * 0.42);
  if (kind !== 'tall' && rnd() < 0.5) { x.fillStyle = 'rgba(255,190,110,.28)'; x.fillRect(W / 2 + 4, H * 0.42, W / 2 - 18, H * 0.4); }
  x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(12, 12); x.lineTo(W - 12, 12); x.lineTo(12, H * 0.5); x.fill();
  // glazing bars: centre mullion, transom at 38%, one bar per casement
  x.fillStyle = fr; x.fillRect(W / 2 - 4, 8, 8, H - 16); x.fillRect(8, H * 0.38 - 3, W - 16, 7);
  x.fillRect(W * 0.28, H * 0.38, 3, H * 0.62 - 8); x.fillRect(W * 0.72, H * 0.38, 3, H * 0.62 - 8);
  x.fillRect(W * 0.28, 8, 3, H * 0.38); x.fillRect(W * 0.72, 8, 3, H * 0.38);
  // sill
  x.fillStyle = '#b9b3a6'; x.fillRect(0, H - 8, W, 8); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, H - 9, W, 2);
  return flat(c);
}
/** shuttered small window for sheds/outbuildings */
export function windowSmall() {
  const W = 96, H = 80, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#2a2622'; x.fillRect(0, 0, W, H); x.fillStyle = '#7a6a52'; x.fillRect(5, 5, W - 10, H - 10);
  x.fillStyle = '#3a4448'; x.fillRect(10, 10, W - 20, H - 20); x.fillStyle = '#7a6a52'; x.fillRect(W / 2 - 3, 8, 6, H - 16); x.fillRect(8, H / 2 - 3, W - 16, 6);
  return flat(c);
}
/** tenement front door: double leaf, panelled, dark green or brown, fanlight above */
export function doorTex(hex = 0x3d4a3a) {
  const W = 112, H = 240, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#2a2622'; x.fillRect(0, 0, W, H);
  x.fillStyle = shade(hex, 1); x.fillRect(6, 40, W - 12, H - 40);
  // fanlight
  x.fillStyle = '#2f3a42'; x.fillRect(8, 8, W - 16, 28); x.fillStyle = shade(hex, 1.1); for (let i = 1; i < 4; i++) x.fillRect(8 + i * (W - 16) / 4 - 2, 8, 3, 28);
  // panels
  for (const l of [8, W / 2 + 2]) { for (const [y, h] of [[52, 60], [124, 90]]) { x.fillStyle = shade(hex, 0.75); x.fillRect(l + 4, y, W / 2 - 14, h); x.fillStyle = shade(hex, 1.12); x.fillRect(l + 8, y + 4, W / 2 - 22, h - 8); } }
  x.fillStyle = '#c9b88a'; x.fillRect(W / 2 - 10, 150, 5, 10); x.fillRect(W / 2 + 5, 150, 5, 10);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(W / 2 - 1, 42, 2, H - 42);
  return flat(c);
}
/** plank door for sheds, gates */
export function plankDoor() {
  const W = 96, H = 200, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#4d3a28'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W; i += 16) { x.fillStyle = `rgb(${105 + rnd() * 30},${78 + rnd() * 20},${50 + rnd() * 15})`; x.fillRect(i + 1, 0, 14, H); }
  x.fillStyle = '#2a2a2a'; x.fillRect(0, 30, W, 8); x.fillRect(0, H - 40, W, 8); x.beginPath(); x.moveTo(4, H - 34); x.lineTo(W - 4, 36); x.lineTo(W - 4, 44); x.lineTo(4, H - 26); x.fill();
  return flat(c);
}
/** shop front: a wide window with goods, painted fascia above is a separate sign */
export function shopWindow() {
  const W = 256, H = 192, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#2a2622'; x.fillRect(0, 0, W, H); x.fillStyle = '#4a3b2a'; x.fillRect(6, 6, W - 12, H - 12);
  const g = x.createLinearGradient(0, 12, 0, H); g.addColorStop(0, '#5d6b73'); g.addColorStop(1, '#242b30'); x.fillStyle = g; x.fillRect(14, 14, W - 28, H - 28);
  // shelves with tins and loaves
  for (let s = 0; s < 3; s++) { const y = 50 + s * 42; x.fillStyle = '#6b4f33'; x.fillRect(20, y + 20, W - 40, 5); for (let i = 0; i < 9; i++) { x.fillStyle = ['#b8823c', '#d9c59a', '#7a4d2c', '#c9a15a', '#8e6b3c'][Math.floor(rnd() * 5)]; x.fillRect(26 + i * 24, y + (rnd() * 6), 16, 18 + rnd() * 4); } }
  x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(14, 14); x.lineTo(W - 14, 14); x.lineTo(14, H * 0.6); x.fill();
  x.fillStyle = '#4a3b2a'; x.fillRect(W / 2 - 4, 8, 8, H - 16);
  return flat(c);
}
/** clipped hedge / privet foliage, tiles 1 m */
export function hedge() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#3f5a2c'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { x.fillStyle = `hsl(${70 + rnd() * 35},${28 + rnd() * 22}%,${16 + rnd() * 24}%)`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 2 + rnd() * 5, 0, 7); x.fill(); }
  return tex(c);
}
/** tree crown, autumn: hue 30 (copper) .. 90 (green) */
export function foliage(hue = 70) {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = `hsl(${hue},32%,34%)`; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) { x.fillStyle = `hsl(${hue - 14 + rnd() * 30},${30 + rnd() * 30}%,${26 + rnd() * 26}%)`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 2 + rnd() * 4, 0, 7); x.fill(); }
  return tex(c);
}
export function bark() {
  const S = 128, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#4e4236'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${rnd() > 0.5 ? 20 : 120},${rnd() > 0.5 ? 20 : 100},${rnd() > 0.5 ? 10 : 80},${0.2 + rnd() * 0.3})`; x.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 3, 8 + rnd() * 30); }
  return tex(c);
}
/** weathered picket / board fence, 1 tile = 1 m */
export function woodFence() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  for (let i = 0; i < S; i += 32) { x.fillStyle = `rgb(${110 + rnd() * 30},${92 + rnd() * 22},${66 + rnd() * 18})`; x.fillRect(i + 4, 10, 20, S - 10); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i + 4, 10, 3, S - 10); x.beginPath(); x.moveTo(i + 4, 12); x.lineTo(i + 14, 0); x.lineTo(i + 24, 12); x.fill(); x.fillStyle = `rgb(${110 + rnd() * 30},${92 + rnd() * 22},${66 + rnd() * 18})`; x.beginPath(); x.moveTo(i + 4, 12); x.lineTo(i + 14, 2); x.lineTo(i + 24, 12); x.fill(); }
  x.fillStyle = '#5e4a34'; x.fillRect(0, S * 0.3, S, 10); x.fillRect(0, S * 0.78, S, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function planks() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#6e5238'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 28) { x.fillStyle = `rgb(${100 + rnd() * 30},${75 + rnd() * 22},${50 + rnd() * 18})`; x.fillRect(0, i + 2, S, 24); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, i, S, 2); }
  noise(x, S, S, 0.12, 2000); return tex(c);
}
export function concrete() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#a9a396'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.12, 5000); return tex(c);
}
export function kerb() {
  const S = 256, c = canvas(S, 64), x = c.getContext('2d');
  x.fillStyle = '#8b8781'; x.fillRect(0, 0, S, 64);
  for (let i = 0; i < S; i += 48) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(i, 0, 3, 64); }
  noise(x, S, 64, 0.14, 1000); return tex(c);
}
/** Prussian enamel street sign: white Fraktur-ish text on dark blue */
export function streetSign(name) {
  const W = 512, H = 96, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#1c2f5e'; x.fillRect(0, 0, W, H); x.strokeStyle = '#e8e6dc'; x.lineWidth = 5; x.strokeRect(7, 7, W - 14, H - 14);
  x.fillStyle = '#f0eee6'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 50; x.font = `bold ${size}px "Old Standard TT", "Times New Roman", Georgia, serif`;
  while (x.measureText(name).width > W - 44 && size > 22) { size -= 2; x.font = `bold ${size}px "Old Standard TT", "Times New Roman", Georgia, serif`; }
  x.fillText(name, W / 2, H / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** house-number: small enamel plate */
export function numberPlate(no) {
  const W = 128, H = 96, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#1c2f5e'; x.fillRect(0, 0, W, H); x.strokeStyle = '#e8e6dc'; x.lineWidth = 4; x.strokeRect(5, 5, W - 10, H - 10);
  x.fillStyle = '#f0eee6'; x.font = 'bold 58px "Times New Roman", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(no), W / 2, H / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** painted shop fascia: text on a dark board, gold serif letters */
export function shopSign(text, bg = '#3b2a1e', fg = '#e2c27a', W = 768, H = 112) {
  const c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(8, 8, W - 16, H - 16);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 56; x.font = `bold ${size}px "Times New Roman", Georgia, serif`;
  while (x.measureText(text).width > W - 50 && size > 18) { size -= 2; x.font = `bold ${size}px "Times New Roman", Georgia, serif`; }
  x.fillText(text, W / 2, H / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** a Litfaßsäule wrap: a stack of posters (tiles horizontally around the column) */
export function posters(lines) {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#5a4b3b'; x.fillRect(0, 0, W, H);
  const cols = ['#e8dcb8', '#d9c9a0', '#c99a5a', '#b9c7c9', '#e0cfa5', '#c46a4a', '#e3e0d5', '#9fb0a0'];
  let u = 0, i = 0;
  while (u < W) {
    const w = 110 + rnd() * 120; const h = 140 + rnd() * 250; const v = rnd() * (H - h);
    x.fillStyle = cols[i % cols.length]; x.fillRect(u, v, w, h);
    x.fillStyle = '#1f1a16'; x.textAlign = 'center'; x.textBaseline = 'top';
    const txt = lines[i % lines.length];
    const parts = txt.split('|');
    parts.forEach((p, k) => { const s = k === 0 ? Math.min(34, w / (p.length * 0.55)) : Math.min(20, w / (p.length * 0.5)); x.font = `${k === 0 ? 'bold' : ''} ${s}px "Times New Roman", Georgia, serif`; x.fillText(p, u + w / 2, v + 12 + k * 30 + (k ? 14 : 0)); });
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(u + 1, v + 1, w - 2, h - 2);
    u += w + 6; i++;
  }
  return tex(c, 1, 8);
}
/** sky: a November afternoon over the bay, pale sun in haze, high cloud, warm at the horizon */
export function skyTex() {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8ea3bd'); g.addColorStop(0.4, '#b6c3cf'); g.addColorStop(0.56, '#d2d3cf'); g.addColorStop(0.64, '#ddd3c1'); g.addColorStop(1, '#d6cdbd');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // stratus streaks and a few soft cumulus in the upper half (v = 0 is the zenith)
  for (let i = 0; i < 26; i++) {
    const cy = 120 + rnd() * 130, cx = rnd() * W, w = 140 + rnd() * 300, h = 8 + rnd() * 22;
    const gr = x.createRadialGradient(cx, cy, 2, cx, cy, w / 2); gr.addColorStop(0, `rgba(240,238,232,${0.5 + rnd() * 0.35})`); gr.addColorStop(1, 'rgba(240,238,232,0)');
    x.fillStyle = gr; x.save(); x.translate(cx, cy); x.scale(1, h / (w / 2)); x.beginPath(); x.arc(0, 0, w / 2, 0, 7); x.fill(); x.restore();
    // wrap-around copy so the seam does not show
    x.save(); x.translate(cx - W, cy); x.scale(1, h / (w / 2)); x.beginPath(); x.arc(0, 0, w / 2, 0, 7); x.fill(); x.restore();
  }
  // a pale sun disc low in the south-west and the haze around it
  const sx = W * 0.62, sy = H * 0.5;
  const hz = x.createRadialGradient(sx, sy, 4, sx, sy, 170); hz.addColorStop(0, 'rgba(255,238,205,.85)'); hz.addColorStop(0.25, 'rgba(255,232,190,.35)'); hz.addColorStop(1, 'rgba(255,232,190,0)');
  x.fillStyle = hz; x.fillRect(sx - 180, sy - 180, 360, 360);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
/** vertical-bar railing (cemetery / front garden), alpha-tested. tile = 1 m x fence height */
export function railingTex() {
  const W = 256, H = 256, c = canvas(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H); x.fillStyle = '#1e1f22';
  x.fillRect(0, 10, W, 8); x.fillRect(0, H - 40, W, 8);
  for (let i = 0; i < W; i += 32) { x.fillRect(i + 13, 0, 6, H); }
  for (let i = 0; i < W; i += 32) { x.beginPath(); x.arc(i + 16, 4, 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** wire mesh (allotment fence), alpha-tested */
export function meshTex() {
  const W = 128, H = 128, c = canvas(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H); x.strokeStyle = '#4a4438'; x.lineWidth = 2;
  for (let i = 0; i <= W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  for (let j = 0; j <= H; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** laundry: a white sheet with a faint weave */
export function linen() {
  const S = 128, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#ece7da'; x.fillRect(0, 0, S, S); noise(x, S, S, 0.08, 1500); return tex(c);
}
/** newspaper page: a headline and grey columns (Danziger Volksstimme) */
export function newspaper(title, headline) {
  const W = 256, H = 352, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#e6dfc9'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#1a1612'; x.textAlign = 'center'; x.font = 'bold 26px "Times New Roman", Georgia, serif'; x.fillText(title, W / 2, 34);
  x.fillRect(12, 44, W - 24, 2); x.font = 'bold 15px "Times New Roman", Georgia, serif'; x.fillText(headline, W / 2, 66);
  for (let col = 0; col < 3; col++) for (let l = 0; l < 30; l++) { x.fillStyle = `rgba(30,25,20,${0.35 + rnd() * 0.3})`; x.fillRect(14 + col * 80, 80 + l * 8, 60 + rnd() * 12, 3); }
  return flat(c);
}
