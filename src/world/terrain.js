/* Ground relief from the GUGiK digital terrain model (NMT), sampled on a
 * 10 m grid over 500 m around the origin (research/maps/terrain.json ->
 * public/data/terrain.json).  The colony slopes gently from ~6.5 m ASL in
 * the west to ~4 m by the railway.  Smoothed a little, and expressed
 * relative to the origin so the origin's door step is at y = 0. */
export function makeTerrain(t) {
  const n = t.size, step = t.step; const half = (n - 1) / 2 * step;
  // 3x3 box smoothing, twice
  let z = t.z.map((r) => r.slice());
  for (let pass = 0; pass < 2; pass++) {
    const o = z.map((r) => r.slice());
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0, c = 0; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; s += z[ii][jj]; c++; } o[i][j] = s / c; }
    z = o;
  }
  const sample = (x, zz) => {
    // x east, zz south (three.js).  rows north->south: row = (zz + half)/step ; cols west->east: col = (x + half)/step
    const fc = Math.min(n - 1.001, Math.max(0, (x + half) / step)), fr = Math.min(n - 1.001, Math.max(0, (zz + half) / step));
    const c0 = Math.floor(fc), r0 = Math.floor(fr); const u = fc - c0, v = fr - r0;
    return z[r0][c0] * (1 - u) * (1 - v) + z[r0][c0 + 1] * u * (1 - v) + z[r0 + 1][c0] * (1 - u) * v + z[r0 + 1][c0 + 1] * u * v;
  };
  const z0 = sample(0, 0);
  const ground = (x, zz) => sample(x, zz) - z0;
  ground.asl = z0;
  return ground;
}
