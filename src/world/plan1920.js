import { xz, hash, segClosest } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * The plan of 1920.
 *
 * What stood here on Monday 15 November 1920, the day the Free City of
 * Danzig was proclaimed, decided from research/history.md (Adreßbuch
 * 1920, Gedanopedia, the 1910 photographs) and the georeferenced Plan
 * der Stadt Danzig 1920 and 1933 (research/maps):
 *
 *  - the Reichskolonie (Wohnungsgenossenschaft Neuschottland, 1907-15,
 *    architect Paul Kadereit): the two-storey rows of Posadowskyweg 61-113
 *    (today's Kochanowskiego, which kept the 1910 numbers), the corner
 *    houses at the Bärenweg/Posadowskyweg junction (Bärenweg 4/5, 7-10f,
 *    49), the rows on the north side of Bärenweg and along Marineweg;
 *  - the south side of Bärenweg west of the junction — where today's
 *    Mickiewicza 27-43 stand, the origin among them — was still building
 *    plots and gardens (built 1921-33);
 *  - the square north of the junction was an empty Marktplatz with garden
 *    strips; south-west, the Reichskolonie-Sportplatz (1916) on the
 *    meadows; west and east of the railway the orchards of the old
 *    Schellmühl estate;
 *  - the Danzig-Neufahrwasser railway on its low embankment, crossed by
 *    the Bärenweg at grade beside the Bahnwärter's house (Bärenweg 6);
 *  - streets: sand roadways between granite kerbs with clinker footways,
 *    gas lamps and staked saplings (1910 photographs); Leegstrieß (Reja)
 *    and Simsonweg (Dzielna) did not exist yet.
 * ------------------------------------------------------------------ */

const STREET_1920 = {
  'Adama Mickiewicza': 'Bärenweg',
  'Jana Kochanowskiego': 'Posadowskyweg',
  'Sochaczewska': 'Neptunweg',
  'Sebastiana Klonowicza': 'Marineweg',
};
const NOT_YET = new Set(['Dzielna', 'Mikołaja Reja']);
const MODERN_TYPES = new Set(['garage', 'warehouse', 'university', 'office', 'service', 'kindergarten', 'industrial']);
// present-day buildings that stood in 1920 (see the header); everything else built on the odd side of Bärenweg is later
const EXISTED_IDS = new Set([92358185, 92358725]);
const NUMBERS_1920 = { 92356369: '9', 92358185: '10f', 92358184: '49', 92358725: '3', 93303779: '5', 93303780: '7' };

export function makePlan(scene, parcels, overrides = {}) {
  const byName = (n) => scene.streets.filter((s) => s.name === n);
  const polyXZ = (list) => list.flatMap((s) => s.pts.map(xz));
  const mick = polyXZ(byName('Adama Mickiewicza')), koch = polyXZ(byName('Jana Kochanowskiego'));
  /** nearest point of a street polyline to (x,z) with the tangent there */
  const nearestOn = (pts, x, z) => {
    let best = { d: Infinity };
    for (const s of scene.streets) { /* noop: keep signature simple */ break; }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 60) continue;
      const [cx, cz] = segClosest(x, z, a[0], a[1], b[0], b[1]); const d = Math.hypot(cx - x, cz - z);
      if (d < best.d) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; best = { d, x: cx, z: cz, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; }
    }
    return best;
  };
  // the junction Bärenweg / Posadowskyweg
  let junction = { d: Infinity };
  for (const p of koch) { const n = nearestOn(mick, p[0], p[1]); if (n.d < junction.d) junction = { ...n, d: n.d }; }
  const J = [junction.x, junction.z];
  // Bärenweg direction pointing east (towards the railway)
  let ex = junction.tx, ez = junction.tz; if (ex < 0) { ex = -ex; ez = -ez; }

  // ---------------- streets
  const streets = [];
  for (const s of scene.streets) {
    if (!['residential', 'living_street', 'tertiary', 'path'].includes(s.kind)) continue;
    if (NOT_YET.has(s.name) || !s.name) continue;
    const name1920 = STREET_1920[s.name] || null;
    const kind = s.kind === 'path' ? 'path' : 'sand';
    streets.push({ ...s, kind, width: s.name === 'Adama Mickiewicza' ? 6.5 : 5.5, name1920 });
  }

  // ---------------- the railway and the level crossing
  let rail = null, crossing = null, keeper = null;
  const rails = scene.lines.filter((l) => l.tags && l.tags.railway === 'rail' && !l.tags.service);
  if (rails.length) {
    const l = rails.map((r) => ({ r, d: Math.min(...r.pts.map((p) => Math.hypot(p[0], p[1]))) })).sort((a, b) => a.d - b.d)[0].r;
    const pts = l.pts.map(xz);
    let best = { d: Infinity };
    for (const p of pts) { const n = nearestOn(mick, p[0], p[1]); if (n.d < best.d) best = { d: n.d, x: n.x, z: n.z, tx: n.tx, tz: n.tz }; }
    // refine: the crossing is the rail point nearest the road line
    let cr = { d: Infinity };
    for (let i = 0; i < pts.length - 1; i++) { const [cx, cz] = segClosest(best.x, best.z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); const d = Math.hypot(cx - best.x, cz - best.z); if (d < cr.d) cr = { d, x: cx, z: cz }; }
    crossing = { x: cr.x, z: cr.z, ang: Math.atan2(-best.tz, best.tx), width: 6.5 };
    rail = { pts, width: 9, height: 0.5, tracks: [-2.2, 2.2], fenceSide: -1, gap: [cr.x, cr.z, 9] };
    // the Bahnwärter's house (Bärenweg 6): 12 m before the crossing on the north side of the road
    const kx = cr.x - ex * 16, kz = cr.z - ez * 16; const nx = ez, nz = -ex;   // north side (right-hand normal in XZ points north when heading east)
    const hx = kx + nx * 8, hz = kz + nz * 8;
    const ring = [[-3.2, -4], [3.2, -4], [3.2, 4], [-3.2, 4]].map(([u, v]) => { const px = hx + u * ex - v * nx, pz = hz + u * ez - v * nz; return [px, -pz]; });
    keeper = { id: 'bahnwaerter', ring, area: 51, c: [hx, -hz], dist: Math.hypot(hx, hz), type: 'house', levels: 1, h: null, addr: { housenumber: '6' }, style: { kind: 'house', storeys: 1, roofKind: 'hip', pitch: 35, wall: 'brick_red', roof: 'red', chimneys: 1, number: '6' }, name: 'Bahnwärterhaus' };
  }

  // ---------------- buildings
  const numOf = (b) => parseInt(b.addr?.housenumber) || 0;
  const bigHouses = scene.buildings.filter((b) => b.area > 60 && !MODERN_TYPES.has(b.type));
  const existed = (b) => {
    if (b.dist > 225) return false;
    if (MODERN_TYPES.has(b.type)) return false;
    if (EXISTED_IDS.has(b.id)) return true;
    const st = b.addr?.street || ''; const no = numOf(b);
    if (st === 'Adama Mickiewicza') return no >= 30 && no <= 38 ? true : no === 45 || no === 49;
    if (st === 'Jana Kochanowskiego') return no >= 61 && no <= 113;
    if (st === 'Sebastiana Klonowicza') return /^2[A-F]$/.test(b.addr.housenumber);
    if (st === 'Józefa Hallera') return false;
    return null; // undecided: sheds are kept near existing houses
  };
  const existedBig = bigHouses.filter((b) => existed(b) === true);
  const buildings = [];
  for (const b of scene.buildings) {
    const v = existed(b);
    if (v === false) continue;
    if (v === null) {
      if (b.area < 14 || b.area > 60) continue;
      const near = existedBig.some((h) => Math.hypot(h.c[0] - b.c[0], h.c[1] - b.c[1]) < 26);
      if (!near) continue;
      if (overrides[b.id]?.hide) continue;
      buildings.push({ ...b, style: { kind: 'shed', ...(overrides[b.id] || {}) } });
      continue;
    }
    const st = b.addr?.street || ''; const no = numOf(b); const s = hash(b.id);
    let style;
    if (st === 'Jana Kochanowskiego' && no >= 79) style = { kind: 'house', storeys: 2, roofKind: 'gable', pitch: 48, wall: s < 0.5 ? 'wall_white' : 'wall_cream', brickBase: true, shutters: true, dormers: 0, roof: 'red' };
    else if (st === 'Jana Kochanowskiego') style = { kind: 'house', storeys: 2, roofKind: s < 0.55 ? 'mansard' : 'gable', pitch: 52, wall: ['wall_white', 'wall_cream', 'wall_ochre', 'wall_sand'][Math.floor(s * 4)], brickBase: s > 0.3, shutters: true, dormers: Math.max(1, Math.floor(Math.sqrt(b.area) / 6)), roof: s < 0.75 ? 'red' : 'brown', shop: b.id === 92358118 ? 'Meierei O. Schwarz' : undefined };
    else if (st === 'Sebastiana Klonowicza') style = { kind: 'house', storeys: 2, roofKind: 'mansard', pitch: 52, wall: s < 0.5 ? 'wall_white' : 'wall_cream', brickBase: true, shutters: true, dormers: 1, roof: 'red' };
    else if (b.id === 92356369) style = { kind: 'house', storeys: 2, roofKind: 'mansard', pitch: 52, wall: 'wall_cream', brickBase: true, shutters: true, dormers: 2, roof: 'red' };
    else if (b.id === 92358184) style = { kind: 'house', storeys: 3, roofKind: 'mansard', pitch: 52, wall: 'wall_ochre', brickBase: true, shutters: false, dormers: 2, roof: 'red', shop: 'Bäckerei A. Alt' };
    // the two monumental blocks flanking the Bärenweg east of the Posadowskyweg junction,
    // from the "Reichskolonie Dzg.-Langfuhr / Bärenweg" postcard: three plastered storeys over a
    // tall shop floor, steep mansard roofs with a row of hooded dormers and a big gabled wall
    // dormer, a round-arched carriage passage, a corner bay and an iron balcony
    else if (b.id === 92358185) style = { kind: 'house', storeys: 3, storeyH: 3.35, roofKind: 'mansard', pitch: 54, wall: 'wall_sand', brickBase: false, shutters: false, dormers: 4, roof: 'red', shop: 'Fleischerei Hohmann', doorWall: 4, archway: true, archAt: 0.62, archW: 3.1,
      rects: [[49.5, 22.5, 19, 11, 15.1], [37.8, 37.5, 23, 9.5, -74.7]], zwerch: { w: 5.0, at: -0.3 }, oriel: true, orielAt: [39.5, 14.2], chimneys: 4 };
    else if (b.id === 92358725) style = { kind: 'house', storeys: 3, storeyH: 3.35, roofKind: 'mansard', pitch: 54, wall: 'wall_cream', brickBase: false, shutters: false, dormers: 5, roof: 'red', shop: 'Bergschlösschen-Bier · Niederlage', doorWall: 20, archway: true, archAt: 0.52, archW: 3.1,
      rects: [[54.0, -8.6, 20.5, 11, 18.8], [50.5, -38.5, 44, 10.5, -69.2]], zwerch: { w: 5.2, at: 0.25 }, oriel: true, orielAt: [44.1, -6.3], balcony: true, chimneys: 5 };
    else style = { kind: 'house', storeys: 3, roofKind: s < 0.5 ? 'mansard' : 'gable', pitch: 48, wall: ['wall_white', 'wall_cream', 'wall_sand'][Math.floor(s * 3)], brickBase: true, shutters: false, dormers: 2, roof: 'red' };
    if (NUMBERS_1920[b.id] !== undefined) style.number = NUMBERS_1920[b.id];
    else if (st !== 'Jana Kochanowskiego') style.number = '';
    if (overrides[b.id]) { if (overrides[b.id].hide) continue; Object.assign(style, overrides[b.id]); }
    buildings.push({ ...b, style, street1920: STREET_1920[st] || (EXISTED_IDS.has(b.id) ? 'Bärenweg' : null), home: b.id === 92356369 });
  }
  if (keeper) { if (overrides.bahnwaerter) Object.assign(keeper.style, overrides.bahnwaerter); buildings.push(keeper); }

  // ---------------- open ground: gardens, orchards, the sports ground
  const nx = ez, nz = -ex; // north-pointing normal of the Bärenweg
  const roadAng = Math.atan2(-ez, ex);
  const gardens = [
    // the empty Marktplatz north of the junction
    { x: J[0] - ex * 10 + nx * 28, z: J[1] - ez * 10 + nz * 28, w: 26, d: 16, ang: roadAng },
    { x: J[0] - ex * 10 + nx * 50, z: J[1] - ez * 10 + nz * 50, w: 26, d: 16, ang: roadAng },
    // the building plots on the south side of the Bärenweg (today's Mickiewicza 41-27)
    { x: J[0] - ex * 38 - nx * 22, z: J[1] - ez * 38 - nz * 22, w: 20, d: 18, ang: roadAng },
    { x: J[0] - ex * 66 - nx * 22, z: J[1] - ez * 66 - nz * 22, w: 20, d: 18, ang: roadAng },
  ];
  const allotments = [
    { x: J[0] - ex * 96 - nx * 24, z: J[1] - ez * 96 - nz * 24, w: 16, d: 20, ang: roadAng },
    { x: J[0] - ex * 118 - nx * 24, z: J[1] - ez * 118 - nz * 24, w: 16, d: 20, ang: roadAng },
  ];
  const orchards = [
    { x: -60, z: -70, w: 70, d: 60, ang: roadAng, spacing: 8, hay: 2 },       // between Marineweg and the Marktplatz gardens: the estate's old orchard
    { x: 150, z: -60, w: 80, d: 150, ang: 0, spacing: 9, hay: 3 },           // east of the railway: Gut Schellmühl
    { x: -60, z: 140, w: 120, d: 60, ang: 0, spacing: 9, hay: 2 },           // south: the Strießbach meadows
    { x: -150, z: 20, w: 70, d: 90, ang: 0, spacing: 9, hay: 1 },            // west: towards Neuschottland
  ];
  const pitch = { x: -95, z: 87, w: 90, d: 55, ang: 0.08 };
  const props = {
    column: [J[0] - ex * 6 + nx * 7, J[1] - ez * 6 + nz * 7],
    pumps: [[J[0] - ex * 12 + nx * 40, J[1] - ez * 12 + nz * 40]],
    benches: [[J[0] + ex * 4 + nx * 8, J[1] + ez * 4 + nz * 8, roadAng + Math.PI]],
    yardProps: [],
    laundry: [],
    allotments, gardens, orchards, pitch, rail, crossing,
    posters: ['DANZIGER|VOLKSSTIMME|Die Proklamierung', 'STADTTHEATER|Der Blaufuchs|15. Nov.', 'Bergschlösschen|BIER|Zoppot', 'BuEV|Sportplatz|Reichskolonie', 'ODEON|Kino|Langfuhr', 'Stambul|Zigaretten|J. Borg', 'Schaufenster|Woche|28. Nov.', 'Freie Stadt|DANZIG|15. XI. 1920'],
  };

  // ---------------- people and the story: everything hangs on real doors
  const findHouse = (houses, id) => houses.find((h) => h.b.id === id);
  const doorSpot = (h, out = 1.6, side = 0) => { if (!h || !h.door) return null; const d = h.door; return { x: d.x + d.nx * out + (-d.nz) * side, z: d.z + d.nz * out + d.nx * side, yaw: Math.atan2(-d.nx, -d.nz) + Math.PI }; };
  const spots = (houses) => {
    const home = findHouse(houses, 92356369), bakery = findHouse(houses, 92358184), dairy = findHouse(houses, 92358118), wollermann = findHouse(houses, 92358117), keeperH = findHouse(houses, 'bahnwaerter');
    const S = {};
    S.home = doorSpot(home, 1.8) || { x: 18, z: -2, yaw: 0 };
    S.bakery = doorSpot(bakery, 2.0, -3.5) || { x: 66, z: -20, yaw: 0 };
    S.dairy = doorSpot(dairy, 2.0, 3.0) || { x: 22, z: -28, yaw: 0 };
    S.wollermann = doorSpot(wollermann, 1.8) || { x: 12, z: -46, yaw: 0 };
    S.keeper = doorSpot(keeperH, 1.8) || { x: 90, z: -40, yaw: 0 };
    S.column = { x: props.column[0] + nx * 2.2 + ex * 1.5, z: props.column[1] + nz * 2.2 + ez * 1.5, yaw: roadAng + Math.PI / 2 };
    S.garden = { x: gardens[0].x + 3, z: gardens[0].z - 2, yaw: roadAng };
    S.kids = { x: J[0] - ex * 2 - nx * 22, z: J[1] - ez * 2 - nz * 22, yaw: roadAng + 0.6 };
    S.bench = { x: props.benches[0][0], z: props.benches[0][1] - 0.6, yaw: roadAng + Math.PI };
    return S;
  };
  const people = (houses) => {
    const S = spots(houses);
    return [
      { kind: 'worker', ...S.keeper, name: 'Schulist, Bahnwärter', prop: 'lunchbox', coat: 'cloth_blue' },
      { kind: 'worker', ...S.bakery, name: 'Alt, Bäckermeister', coat: 'linen', prop: null },
      { kind: 'woman', ...S.dairy, name: 'Frau Schwarz', prop: 'basket', scarf: 'cloth_grey' },
      { kind: 'old', ...S.wollermann, name: 'Wollermann', prop: 'newspaper', coat: 'cloth_grey' },
      { kind: 'boy', ...S.column, name: 'gazeciarz', prop: 'newspaper' },
      { kind: 'worker', ...S.garden, name: 'Kossowski', prop: 'broom', coat: 'cloth_brown' },
      { kind: 'boy', x: S.kids.x, z: S.kids.z, yaw: S.kids.yaw, name: 'Jaś', prop: 'hoop' },
      { kind: 'child', x: S.kids.x + 1.6, z: S.kids.z + 0.8, yaw: S.kids.yaw + 2.5, name: 'Gretka' },
      { kind: 'woman', x: S.home.x + 0.4, z: S.home.z, yaw: S.home.yaw, name: 'Agnieszka', prop: 'basket', scarf: 'cloth_blue' },
      { kind: 'old', ...S.bench, name: 'stary Trohl', prop: 'pipe', coat: 'cloth_grey' },
    ];
  };
  const chapters = ({ houses }) => {
    const S = spots(houses);
    const at = (s) => [s.x, s.z];
    return [
      { id: 'keeper', title: 'Przejazd na Bärenweg', hint: 'Schulist przy szlabanie', at: at(S.keeper), prompt: 'zagadaj do dróżnika', who: 'Schulist, Bahnwärter (Bärenweg 6)',
        text: 'A, Potrafki. Z szychty? Szlaban podniesiony, pociąg do Neufahrwasser dopiero za kwadrans.<br>Słyszałeś? Dziś w Zgromadzeniu ogłosili <i>Freie Stadt Danzig</i>. Wolne Miasto. Anglicy wyjeżdżają pod koniec miesiąca, a my zostajemy — ani Rzesza, ani Polska.<br>Idź do domu, zimno idzie od Martwej Wisły.', ok: 'Dobranoc, Schulist' },
      { id: 'bread', title: 'Chleb na kartki', hint: 'piekarnia Alt, Bärenweg 49', at: at(S.bakery), prompt: 'wejdź do piekarni', who: 'Alt, Bäckermeister',
        text: 'Kartkę proszę. 350 gramów na dzień na głowę, więcej nie mogę. Żytni po jeden osiemdziesiąt za kilo, pszenny po trzy marki. I żeby mi nikt nie mówił, że wypiekam ciasto z mąki chlebowej — pięć lat więzienia za to dają.',
        choices: [{ label: 'Żytni, 1,80 M', value: 'zytni', after: 'Bochenek ląduje w torbie. Ciepły jeszcze. Zostaje 178 marek i 20 fenigów.' }, { label: 'Pszenny, 3 M', value: 'pszenny', after: 'Biały chleb — na wolne miasto. Zostaje 177 marek.' }] },
      { id: 'butter', title: 'Mleczarnia', hint: 'Meierei Schwarz, Posadowskyweg 78', at: at(S.dairy), prompt: 'wejdź do mleczarni', who: 'Frau Schwarz, Meierei',
        text: 'Masło tylko na kartkę: sześćdziesiąt dwa i pół grama. Margaryna od sierpnia bez kartek, ile pan chce. Mleko dziś było o siódmej, ostatni litr wzięła Wollermannowa.',
        choices: [{ label: 'Masło na kartkę', value: 'maslo', after: 'Kostka masła w papierze. Kartka podziurkowana. Minus 90 fenigów.' }, { label: 'Pół funta margaryny', value: 'margaryna', after: '„Bez kartek, ale też bez smaku” — mówi Frau Schwarz i zawija. Minus 1,20 M.' }] },
      { id: 'union', title: 'Wollermann', hint: 'Posadowskyweg 76, przy drzwiach', at: at(S.wollermann), prompt: 'porozmawiaj', who: 'Wollermann, Gewerkschaftsführer',
        text: 'Potrafki! Czytałeś, co pisze <i>Volksstimme</i>? „Die Proklamierung der <i>Freiheit</i>” — w cudzysłowie. Wolność dla Sahma i kupców. A na Werft od czerwca strajk za strajkiem, Klawitter wyrzucił tysiąc siedmiuset ludzi, po pożarze w październiku roboty jeszcze mniej.<br>Dziś wieczorem zebranie w Neuschottland u Grabbela. O taryfie. Przyjdziesz?',
        choices: [{ label: 'Przyjdę', value: 'ide', after: 'Wollermann klepie cię w ramię: „O ósmej. Weź Trohla.”' }, { label: 'Żona czeka', value: 'nie', after: '„Żona zawsze czeka. A taryfa sama się nie zrobi.” Odwraca się do gazety.' }] },
      { id: 'paper', title: 'Gazeciarz', hint: 'słup ogłoszeniowy na placu', at: at(S.column), prompt: 'kup gazetę', who: 'chłopak z gazetami',
        text: '<i>Volksstimme!</i> <i>Volksstimme!</i> Wolne Miasto ogłoszone! Dwadzieścia pięć fenigów! Panie, niech pan weźmie, ostatnie trzy.',
        choices: [{ label: 'Daj jedną, 25 Pf', value: 'kupil', after: 'Chłopak łapie monetę — nową, cynkową dziesiątkę z fabryki karabinów i piętnaście fenigów drobnymi. Nagłówek: <i>Die Proklamierung der „Freiheit”</i>.' }, { label: 'Nie dziś', value: 'nie', after: '„To jutro będzie już stara” — wzrusza ramionami.' }] },
      { id: 'kossowski', title: 'Ogródki na placu', hint: 'Kossowski kopie kartofle', at: at(S.garden), prompt: 'zagadaj po polsku', who: 'Kossowski, Schlosser',
        text: 'Ostatnie kartofle wykopuję, zanim mróz chwyci. Na mieście po trzydzieści pięć fenigów za funt ustalili, to chłopi przestali wozić — bez ogródka byłaby bieda.<br>Słyszałeś, w Herz-Jesu znów kazanie po polsku? Mówią, że będzie Gmina Polska. Ja tam nie wiem — u nas na Werft jeden mówi tak, drugi siak, a nitować trzeba tak samo.', ok: 'Zdrowia, Kossowski' },
      { id: 'kids', title: 'Dzieci na Posadowskyweg', hint: 'Jaś z fajerką', at: at(S.kids), prompt: 'zawołaj dzieci', who: 'Jaś',
        text: 'Tato! Patrz, znalazłem przy przejeździe! — Jaś wyciąga cynkową dziesięciofenigówkę z herbem Gdańska. — Schulist mówi, że to prawdziwe pieniądze, a nie Notgeld.<br>Gretka chce do domu, mama woła na zupę.', ok: 'Do domu, oboje' },
      { id: 'home', title: 'Do domu', hint: 'Bärenweg 9, drzwi od podwórka', at: at(S.home), prompt: 'wejdź do domu', who: 'Agnieszka',
        text: (c) => `Nareszcie. Zupa z brukwi, ${c.bread === 'pszenny' ? 'a ty z białym chlebem jak na niedzielę' : 'chleb żytni się przyda'}. ${c.butter === 'maslo' ? 'Masło na kartkę — dobrze, że pamiętałeś.' : 'Margaryna… no, jest i to.'}<br>${c.union === 'ide' ? 'Znowu na zebranie? Idź, ale wróć przed dziesiątą, w kolonii gaz gaszą.' : 'Wollermann przychodził, mówił o zebraniu. Dobrze, że zostajesz.'}<br>${c.paper === 'kupil' ? 'Przeczytasz mi, co piszą o tym Wolnym Mieście. Czy to znaczy, że Werft zostanie?' : 'Sąsiadka mówiła, że gazety piszą o Wolnym Mieście. Czy to znaczy, że Werft zostanie?'}`, ok: 'Siadamy do zupy' },
    ];
  };
  const intro = `<p class="date">Danzig-Langfuhr, poniedziałek 15 listopada 1920, po szychcie</p>
<p>Jesteś <b>Franciszkiem Potrafkim</b>, nitowaczem z <b>Danziger Werft</b> — dawnej Stoczni Cesarskiej, którą rok temu Rzesza oddała miastu. Mieszkasz z Agnieszką i dwojgiem dzieci na <b>Bärenweg 9</b> w <b>Reichskolonie</b>: osiedlu spółdzielni Neuschottland, które admiralicja zbudowała w latach 1907–1915 dla robotników stoczni. Dwupiętrowe domy z czerwonej cegły i jasnego tynku, ogródki za sztachetami, piaszczyste uliczki z gazowymi latarniami i młodymi lipami.</p>
<p>Dziś w Zgromadzeniu proklamowano <b>Wolne Miasto Gdańsk</b>. Na stoczni od czerwca strajki, chleb po marce osiemdziesiąt na kartki, w kieszeni <b>180 marek</b> z sobotniej wypłaty. Wracasz pociągiem na przystanek Reichskolonie i przez przejazd na Bärenweg — do domu.</p>`;
  const endText = (c, time) => {
    const spent = (c.bread === 'pszenny' ? 3 : 1.8) + (c.butter === 'maslo' ? 0.9 : 1.2) + (c.paper === 'kupil' ? 0.25 : 0);
    const left = (180 - spent).toFixed(2).replace('.', ',');
    return `Wieczór 15 listopada 1920 w Reichskolonie zajął ci <b>${time}</b>. W kieszeni zostało <b>${left} marek</b>${c.union === 'ide' ? ', a o ósmej idziesz do Grabbela na zebranie o taryfie' : ', a wieczór spędzasz w domu'}.<br><br>Za trzy lata marka zniknie — od października 1923 płacić się będzie guldenami. Domy spółdzielni Neuschottland stoją do dziś przy Kochanowskiego, Klonowicza i Sochaczewskiej; działki po południowej stronie Bärenweg zabudowano w latach dwudziestych i trzydziestych — dziś stoi tam Mickiewicza 43.`;
  };
  const chimneys = buildings.filter((b) => b.style.kind !== 'shed' && b.dist < 130).map((b) => [b.c[0], 8 + (b.style.storeys || 2) * 3, -b.c[1]]);
  const spawn = crossing ? { x: crossing.x - ex * 10, z: crossing.z - ez * 10, yaw: Math.atan2(ex, ez) } : { x: 60, z: -20, yaw: 1.5 };
  const trees = (veg) => veg.trees.filter((t) => hash(Math.round(t.x * 3 + t.y * 7)) > 0.45);
  const skipParcel = (ring, c) => Math.hypot(c[0] - pitch.x, c[1] - pitch.z) < 45;
  const cart = { path: (() => { const pts = mick.filter((p) => Math.hypot(p[0], p[1]) < 145 && (!crossing || (p[0] - crossing.x) * ex + (p[1] - crossing.z) * ez < -8)); pts.sort((a, b) => (a[0] * ex + a[1] * ez) - (b[0] * ex + b[1] * ez)); return pts; })() };
  const mapAreas = [
    { pts: [[pitch.x - 45, -(pitch.z - 28)], [pitch.x + 45, -(pitch.z - 28)], [pitch.x + 45, -(pitch.z + 28)], [pitch.x - 45, -(pitch.z + 28)]], color: '#cfd8a8' },
  ];
  return { streets, buildings, props, people, spawn, ground: () => 0, chapters, intro, endText, chimneys, trees, skipParcel, cart, mapAreas, junction: J };
}
