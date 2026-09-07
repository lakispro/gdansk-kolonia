/* A plan of the colony drawn on a 2-D canvas in the manner of a 1920 city
 * plan: sepia paper, building footprints, streets with their German names,
 * the railway, the 150 m ring, you, and the current objective. */
export class Minimap {
  constructor(canvas, plan, radius) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.plan = plan; this.radius = radius; this.on = false;
    this.size = 280; canvas.width = this.size * 2; canvas.height = this.size * 2; canvas.style.width = canvas.style.height = this.size + 'px';
    this.scale = (this.size * 2) / 2 / (radius + 14);
  }
  toggle(force) { this.on = force ?? !this.on; this.c.classList.toggle('on', this.on); }
  draw(px, pz, yaw, target) {
    if (!this.on) return;
    const x = this.ctx, S = this.size * 2, k = this.scale, cx = S / 2, cz = S / 2;
    x.clearRect(0, 0, S, S);
    x.fillStyle = '#e6dcc2'; x.beginPath(); x.arc(cx, cz, S / 2, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(cx, cz, S / 2 - 2, 0, 7); x.clip();
    // ENU -> canvas: X = cx + e*k, Z = cz - n*k
    if (this.plan.props.rail) { const r = this.plan.props.rail; x.strokeStyle = '#4a4036'; x.lineWidth = 6; x.beginPath(); r.pts.forEach((p, i) => { const X = cx + p[0] * k, Z = cz + p[1] * k; i ? x.lineTo(X, Z) : x.moveTo(X, Z); }); x.stroke(); x.strokeStyle = '#e6dcc2'; x.lineWidth = 2; x.setLineDash([4, 6]); x.stroke(); x.setLineDash([]); }
    for (const s of this.plan.streets) {
      x.strokeStyle = s.kind === 'setts' ? '#9a8c74' : s.kind === 'sand' ? '#cdbb92' : s.kind === 'dirt' ? '#c9b68f' : '#d6c7a4'; x.lineWidth = Math.max(2, s.width * k);
      x.beginPath(); s.pts.forEach((p, i) => { const X = cx + p[0] * k, Z = cz - p[1] * k; i ? x.lineTo(X, Z) : x.moveTo(X, Z); }); x.stroke();
    }
    for (const a of this.plan.mapAreas || []) { x.fillStyle = a.color; x.beginPath(); a.pts.forEach((p, i) => { const X = cx + p[0] * k, Z = cz - p[1] * k; i ? x.lineTo(X, Z) : x.moveTo(X, Z); }); x.closePath(); x.fill(); }
    for (const b of this.plan.buildings) {
      x.fillStyle = b.home ? '#c8452f' : b.style?.kind === 'shed' ? '#a89a80' : '#6b5a48';
      x.beginPath(); b.ring.forEach((p, i) => { const X = cx + p[0] * k, Z = cz - p[1] * k; i ? x.lineTo(X, Z) : x.moveTo(X, Z); }); x.closePath(); x.fill();
    }
    // street names
    x.fillStyle = '#3a2f24'; x.font = 'italic 15px Georgia, serif'; x.textAlign = 'center';
    for (const s of this.plan.streets) {
      if (!(s.name1920 || s.name) || s.labelled) continue;
      const mid = s.pts[Math.floor(s.pts.length / 2)]; const a = s.pts[Math.max(0, Math.floor(s.pts.length / 2) - 1)], b = s.pts[Math.min(s.pts.length - 1, Math.floor(s.pts.length / 2) + 1)];
      let ang = -Math.atan2(b[1] - a[1], b[0] - a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      if (Math.hypot(mid[0], mid[1]) > this.radius + 5) continue;
      x.save(); x.translate(cx + mid[0] * k, cz - mid[1] * k); x.rotate(ang); x.fillText(s.name1920 || s.name, 0, -4); x.restore();
    }
    x.strokeStyle = 'rgba(80,60,40,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cz, this.radius * k, 0, 7); x.stroke();
    if (target) { const X = cx + target[0] * k, Z = cz + target[1] * k; x.fillStyle = '#d9a12f'; x.beginPath(); x.arc(X, Z, 7, 0, 7); x.fill(); x.strokeStyle = '#3a2f24'; x.lineWidth = 2; x.stroke(); }
    const X = cx + px * k, Z = cz + pz * k;
    x.save(); x.translate(X, Z); x.rotate(-yaw); x.fillStyle = '#1f5f9c'; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.restore();
    x.restore();
    x.fillStyle = '#3a2f24'; x.font = 'bold 20px Georgia, serif'; x.textAlign = 'center'; x.fillText('N', cx, 28);
    x.font = 'italic 13px Georgia, serif'; x.fillText('Reichskolonie · Langfuhr · 1920', cx, S - 18);
  }
}
