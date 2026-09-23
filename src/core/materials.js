import * as THREE from 'three';
import * as T from './textures.js';

/* One material per shading signature.  Lambert is deliberate: it is the cheapest
 * lit material three.js has and this has to run on a phone.  Everything drawn
 * through the Baker ends up as one mesh per key. */

export const PLASTER_COLOURS = {
  ochre: 0xc9a465, cream: 0xd9c9a4, grey: 0xa9a49a, olive: 0x9a9a70, rose: 0xc39a84, white: 0xd9d4c6, sand: 0xc7b48c, green: 0x8fa08a,
};
export const ROOF_COLOURS = { red: 0x8f3f2c, brown: 0x5a3d2c, dark: 0x3f3a36, orange: 0xa85a36, slate: 0x4a4d52 };

export function makeMaterials() {
  const m = {};
  const lam = (opts) => new THREE.MeshLambertMaterial(opts);
  for (const [k, hex] of Object.entries(PLASTER_COLOURS)) m['wall_' + k] = lam({ map: T.plaster(hex) });
  m.brick_red = lam({ map: T.brick() });
  m.brick_yellow = lam({ map: T.brickYellow() });
  m.brick_dark = lam({ map: T.brickDark() });
  m.rustic = lam({ map: T.rustic() });
  for (const [k, hex] of Object.entries(ROOF_COLOURS)) m['roof_' + k] = lam({ map: T.roofTile(hex, k !== 'slate' && k !== 'dark'), side: THREE.DoubleSide });
  m.roof_tar = lam({ map: T.tarPaper(), side: THREE.DoubleSide });
  m.plinth = lam({ color: 0x5f5a52 });
  m.fachwerk = lam({ map: T.fachwerk() });
  m.tilehung = lam({ map: T.roofTile(0x6a3d2a, false), side: THREE.DoubleSide });   // Biberschwanz tile-hanging on gables and bays
  m.passage = lam({ color: 0x2a241d, side: THREE.DoubleSide });   // the dark barrel vault of a carriage archway
  m.trim_white = lam({ color: 0xe9e4d8 });
  m.trim_stone = lam({ color: 0xc9c2b2 });
  m.trim_brown = lam({ color: 0x3f2e22 });
  m.trim_dark = lam({ color: 0x2a2a2c });
  m.trim_green = lam({ color: 0x3d4a3a });
  m.gutter = lam({ color: 0x5e5a52 });
  m.chimney = lam({ map: T.brickDark() });
  m.window = lam({ map: T.windowTex('std') });
  m.window_green = lam({ map: T.windowTex('std', 0x6a7a5a) });
  m.window_brown = lam({ map: T.windowTex('std', 0x6b5238) });
  m.window_tall = lam({ map: T.windowTex('tall') });
  m.window_small = lam({ map: T.windowSmall() });
  m.door = lam({ map: T.doorTex() });
  m.door_brown = lam({ map: T.doorTex(0x4a3222) });
  m.plank_door = lam({ map: T.plankDoor() });
  m.shop = lam({ map: T.shopWindow() });
  m.concrete = lam({ map: T.concrete() });
  m.setts = lam({ map: T.setts() });
  m.setts_dark = lam({ map: T.setts(0x66625c) });
  m.dirt = lam({ map: T.dirt() });
  m.cinder = lam({ map: T.cinder() });
  m.clinker = lam({ map: T.clinker() });
  m.kerb = lam({ map: T.kerb() });
  m.grass = lam({ map: T.grass() });
  m.gravel = lam({ map: T.gravel() });
  m.soil = lam({ map: T.soil() });
  m.hedge = lam({ map: T.hedge() });
  m.foliage = lam({ map: T.foliage(48), color: 0xf0e6d0 });          // copper
  m.foliage_dark = lam({ map: T.foliage(84), color: 0xd8e0d0 });     // still green
  m.foliage_olive = lam({ map: T.foliage(62), color: 0xe8e0c0 });    // yellowing
  { const ct = T.foliage(120); ct.repeat.set(3, 3); m.conifer = lam({ map: ct, color: 0xa8b8a0 }); }
  m.bark = lam({ map: T.bark() });
  m.planks = lam({ map: T.planks() });
  m.wood_fence = lam({ map: T.woodFence(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  m.metal_dark = lam({ color: 0x2b2d30 });
  m.metal_green = lam({ color: 0x2e4a34 });
  m.iron = lam({ color: 0x3a3c3e });
  m.pole = lam({ color: 0x6e5a44 });
  m.wire = new THREE.LineBasicMaterial({ color: 0x222222 });
  m.white = lam({ color: 0xf0ede4 });
  m.red = lam({ color: 0xa8322b });
  m.yellow = lam({ color: 0xd8b234 });
  m.brass = lam({ color: 0xb08a3c });
  m.cloth_blue = lam({ color: 0x3a4a6a });
  m.cloth_grey = lam({ color: 0x6a6660 });
  m.cloth_brown = lam({ color: 0x5c4634 });
  m.skin = lam({ color: 0xd9b291 });
  m.horse = lam({ color: 0x5a3c26 });
  m.railing = lam({ map: T.railingTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  m.mesh = lam({ map: T.meshTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  m.linen = lam({ map: T.linen(), side: THREE.DoubleSide });
  m.lamp = lam({ color: 0xfff3c8, emissive: 0xffe0a0, emissiveIntensity: 0.5 });
  m.glass_dark = lam({ color: 0x25313a });
  m.coal = lam({ color: 0x151515 });
  m.marking = lam({ color: 0xf0f0ea });
  m.water = lam({ color: 0x4a5a5e });
  for (const k in m) if (m[k].map) { m[k].map.needsUpdate = true; }
  return m;
}
