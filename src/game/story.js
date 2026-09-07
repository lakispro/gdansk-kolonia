import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * The story engine: a linear chain of objectives, each tied to a place
 * (a door, a person, a prop) inside the 150 m radius.  Walk up, press
 * "act", read the dialogue card, the next objective appears.  Some
 * objectives ask for a choice.  A compass tick, a beam and the map point
 * at the current target; the clock runs; the end card sums it up.
 *
 * Content is in plan1920.js (the chapters), this file is the mechanics.
 * ------------------------------------------------------------------ */

export class Story {
  constructor(chapters, group, ui, audio, opts = {}) {
    this.chapters = chapters; this.group = group; this.ui = ui; this.audio = audio;
    this.marker = this._marker(); group.add(this.marker);
    this.beam = this._beam(); group.add(this.beam);
    this.onChapter = opts.onChapter || null; this.ground = opts.ground || (() => 0);
    this.start();
  }
  start() { this.idx = 0; this.done = false; this.t0 = null; this.card = null; this.choices = {}; this.ui.score.textContent = `0 / ${this.chapters.length}`; this._task(); this.marker.visible = true; this.beam.visible = true; }
  get current() { return this.chapters[this.idx]; }
  get total() { return this.chapters.length; }
  _task() {
    const c = this.current; if (!c) return;
    this.ui.task.innerHTML = `<b>${c.title}</b><small>${c.hint} · <span id="tdist"></span></small>`;
    this.onChapter?.(c, this.idx);
  }
  targetPos() { const c = this.current; return c ? [c.at[0], c.at[1]] : null; }
  update(px, pz, dt, time) {
    if (this.done || this.card) return null;
    if (this.t0 === null) this.t0 = time;
    const c = this.current; const tp = this.targetPos(); if (!tp) return null;
    const d = Math.hypot(tp[0] - px, tp[1] - pz);
    const td = document.getElementById('tdist'); if (td) td.textContent = `${Math.round(d)} m`;
    const gy = this.ground(tp[0], tp[1]);
    this.marker.position.set(tp[0], gy + (c.markerY ?? 1.7) + Math.sin(time * 2.2) * 0.12, tp[1]); this.marker.rotation.y = time * 1.1;
    this.beam.position.set(tp[0], gy, tp[1]);
    this.beam.material.opacity = 0.14 + 0.08 * Math.sin(time * 3);
    if (d < (c.radius ?? 3.2)) return c.prompt;
    return null;
  }
  act(px, pz) {
    if (this.done || this.card) return false;
    const c = this.current; const tp = this.targetPos(); if (!tp) return false;
    if (Math.hypot(tp[0] - px, tp[1] - pz) > (c.radius ?? 3.2)) return false;
    this.audio?.tick();
    this._showCard(c);
    return true;
  }
  _showCard(c) {
    this.card = c;
    const el = this.ui.dialog;
    el.querySelector('.who').textContent = c.who || '';
    el.querySelector('.text').innerHTML = typeof c.text === 'function' ? c.text(this.choices) : c.text;
    const btns = el.querySelector('.btns'); btns.innerHTML = '';
    const opts = c.choices || [{ label: c.ok || 'Dalej', value: null }];
    // the tap that opened the card also fires a click a moment later, under the finger: ignore it
    const openedAt = performance.now();
    for (const o of opts) {
      const b = document.createElement('span'); b.className = 'go'; b.textContent = o.label;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() - openedAt < 450) return; this._closeCard(o); });
      btns.appendChild(b);
    }
    el.classList.add('on');
    this.ui.onCard?.(true);
  }
  _closeCard(o) {
    const c = this.card; this.card = null; this.ui.dialog.classList.remove('on'); this.ui.onCard?.(false);
    if (o && o.value !== null && o.value !== undefined) this.choices[c.id] = o.value;
    if (o && o.after) { this._showCard({ ...c, text: typeof o.after === 'function' ? o.after(this.choices) : o.after, choices: null, ok: 'Dalej', id: c.id + '_after' }); this.card._final = true; this._pendingAdvance = true; return; }
    this._advance();
  }
  _advance() {
    if (this._pendingAdvance) { this._pendingAdvance = false; }
    this.idx++;
    this.ui.score.textContent = `${Math.min(this.idx, this.total)} / ${this.total}`;
    if (this.idx >= this.chapters.length) { this.done = true; this.marker.visible = false; this.beam.visible = false; this.audio?.chord(); this.ui.end(this); }
    else { this.ui.toast(this.chapters[this.idx].toast || this.chapters[this.idx].title); this._task(); }
  }
  elapsed(time) { return this.t0 === null ? 0 : time - this.t0; }
  _marker() {
    const g = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xffd35a })); cap.rotation.x = Math.PI; g.add(cap);
    return g;
  }
  _beam() {
    const g = new THREE.CylinderGeometry(0.8, 0.8, 5, 20, 1, true); g.translate(0, 2.5, 0);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  }
}
