/* ------------------------------------------------------------------ *
 * All sound is synthesised with the Web Audio API at run time: no files.
 *
 *  - wind: filtered noise with a slow, wandering band-pass
 *  - the shipyard to the south-east: bursts of pneumatic riveting
 *    (a rattling hammer at ~9 Hz with a metallic ring), a steam whistle
 *    now and then, and a far, low hum
 *  - rooks over the fields, a dog somewhere, a church bell on the hour
 *  - footsteps: cobbles / dirt / grass / boards, walking or running
 *  - a horse cart passing (hooves + iron tyres) when one is near
 *  - UI: task ticks, the end chord
 * ------------------------------------------------------------------ */

export class Audio {
  constructor() { this.ctx = null; this.on = false; this.master = null; this.t = 0; this.nextRivet = 4; this.nextWhistle = 40; this.nextRook = 6; this.nextDog = 25; this.nextBell = 90; this.nextTrain = 25; this.rail = null; this.listener = { x: 0, z: 0, yaw: 0 }; this.yard = { x: 140, z: 90 }; this.cart = null; this.nextHoof = 0; this.muted = false; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C(); const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    // noise buffer, 2 s
    const len = c.sampleRate * 2; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // ---- wind bed
    const wind = c.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0.045;
    wind.connect(bp); bp.connect(wg); wg.connect(this.master); wind.start();
    this.windBP = bp; this.windG = wg;
    // slow wandering with an LFO
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = c.createGain(); lg2.gain.value = 0.02; lfo2.connect(lg2); lg2.connect(wg.gain); lfo2.start();
    // ---- far shipyard hum (very low, quiet)
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 52;
    const hl = c.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 140;
    const hg = c.createGain(); hg.gain.value = 0.02; hum.connect(hl); hl.connect(hg); hg.connect(this.master); hum.start();
    this.humG = hg;
    this.on = true;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }

  /** stereo pan and attenuation for a world position relative to the listener */
  _spatial(x, z, ref = 30, roll = 1.2) {
    const dx = x - this.listener.x, dz = z - this.listener.z; const d = Math.hypot(dx, dz);
    // listener forward = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
    const yaw = this.listener.yaw; const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    const gain = ref / (ref + Math.pow(Math.max(0, d - 2), roll));
    return { pan, gain };
  }
  _out(x, z, ref, roll) {
    const c = this.ctx; const s = this._spatial(x, z, ref, roll);
    const p = c.createStereoPanner ? c.createStereoPanner() : null; const g = c.createGain(); g.gain.value = s.gain;
    if (p) { p.pan.value = s.pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    return g;
  }

  // ---------------------------------------------------------------- one-shots
  /** pneumatic riveting: ~9 hits/s, 1-2 s, each a click with a metallic ring, from the shipyard */
  rivet() {
    const c = this.ctx, t0 = c.currentTime; const out = this._out(this.yard.x, this.yard.z, 60, 1.0);
    out.gain.value *= 0.55;
    const n = 9 + Math.floor(Math.random() * 10); const rate = 0.105 + Math.random() * 0.02;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rate + Math.random() * 0.004;
      const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 600; f.Q.value = 6;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.12);
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 3100 + Math.random() * 200; const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.08);
    }
  }
  /** a train on the Neufahrwasser line: a rising then fading rumble that slides past along the rail, with a short whistle */
  train() {
    if (!this.rail) return;
    const c = this.ctx, t0 = c.currentTime; const dur = 14;
    // the rail is a polyline; the train runs from one end to the other
    const pts = this.rail; const a = pts[0], b = pts[pts.length - 1];
    const r = c.createBufferSource(); r.buffer = this.noise; r.loop = true; r.playbackRate.value = 0.5;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    r.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    // schedule gain/pan along the pass
    for (let i = 0; i <= 28; i++) {
      const t = i / 28; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const s = this._spatial(x, z, 50, 1.1); g.gain.linearRampToValueAtTime(0.35 * s.gain + 0.0001, t0 + t * dur); if (p) p.pan.linearRampToValueAtTime(s.pan, t0 + t * dur);
    }
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1);
    r.start(t0); r.stop(t0 + dur + 1.2);
    // chuffing: amplitude modulation at ~3-4 Hz
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 3.4; const lg = c.createGain(); lg.gain.value = 0.1; lfo.connect(lg); lg.connect(g.gain); lfo.start(t0); lfo.stop(t0 + dur + 1);
    setTimeout(() => this.whistle(a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3, 0.6), dur * 300);
  }
  /** a steam whistle from the yard (or from a given position): two partials with a slow slide and vibrato */
  whistle(wx = this.yard.x, wz = this.yard.z, k = 1) {
    const c = this.ctx, t0 = c.currentTime; const out = this._out(wx, wz, 120, 0.9); out.gain.value *= 0.35 * k;
    const dur = 1.4 + Math.random() * 1.2;
    for (const [f, a] of [[392, 1], [587, 0.5], [784, 0.25]]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.25);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16 * a, t0 + 0.2); g.gain.setValueAtTime(0.16 * a, t0 + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const v = c.createOscillator(); v.frequency.value = 5.5; const vg = c.createGain(); vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o.frequency); v.start(t0); v.stop(t0 + dur);
      o.connect(lp); lp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    // breathy noise
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur);
  }
  /** a rook: a short rasping caw from a random direction */
  rook() {
    const c = this.ctx, t0 = c.currentTime; const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 50;
    const out = this._out(this.listener.x + Math.cos(a) * d, this.listener.z + Math.sin(a) * d, 30, 1.1);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.42;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520 + Math.random() * 80, t); o.frequency.linearRampToValueAtTime(430, t + 0.22);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2.5;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      // amplitude modulation for the rasp
      const m = c.createOscillator(); m.frequency.value = 38; const mg = c.createGain(); mg.gain.value = 0.045; m.connect(mg); mg.connect(g.gain); m.start(t); m.stop(t + 0.3);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
  }
  dog() {
    const c = this.ctx, t0 = c.currentTime; const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
    const out = this._out(this.listener.x + Math.cos(a) * d, this.listener.z + Math.sin(a) * d, 35, 1.1);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.32 + Math.random() * 0.15);
      const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.14);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    }
  }
  /** church bell: inharmonic partials, long decay, from the north-west (the Langfuhr churches) */
  bell(strikes = 3) {
    const c = this.ctx, t0 = c.currentTime; const out = this._out(this.listener.x - 250, this.listener.z - 300, 300, 0.8); out.gain.value *= 0.5;
    for (let k = 0; k < strikes; k++) {
      const t = t0 + k * 2.4;
      for (const [f, a, dec] of [[330, 1, 3.5], [496, 0.5, 2.6], [661, 0.35, 2], [880, 0.2, 1.4], [1320, 0.12, 0.9], [166, 0.4, 4]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.1);
      }
    }
  }
  /** footstep on a surface */
  step(surface = 'cobble', running = false) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.6 + Math.random() * 0.3;
    const f = c.createBiquadFilter();
    const g = c.createGain(); const vol = (running ? 0.22 : 0.14) * (0.85 + Math.random() * 0.3);
    if (surface === 'cobble') { f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 700; f.Q.value = 1.2; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); }
    else if (surface === 'boards') { f.type = 'lowpass'; f.frequency.value = 500; g.gain.setValueAtTime(vol * 1.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); }
    else if (surface === 'grass') { f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); }
    else { f.type = 'lowpass'; f.frequency.value = 1100; g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); } // dirt / gravel
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.2);
    if (surface === 'cobble') { // a little heel click
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 2200 + Math.random() * 800; const og = c.createGain(); og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.04);
    }
    if (surface === 'boards') { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.1); const og = c.createGain(); og.gain.setValueAtTime(0.12, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.14); }
  }
  jump() { if (!this.ctx) return; this.step('grass', true); }
  land(air) { if (!this.ctx) return; this.step('cobble', true); if (air > 0.5) setTimeout(() => this.step('cobble', false), 60); }
  /** UI ticks */
  tick() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    for (const [f, dt] of [[880, 0], [1320, 0.09]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.12, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25); o.connect(g); g.connect(this.master); o.start(t + dt); o.stop(t + dt + 0.3); }
  }
  chord() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    [261.6, 329.6, 392, 523.3].forEach((f, i) => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.1, t + i * 0.12 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); o.connect(g); g.connect(this.master); o.start(t + i * 0.12); o.stop(t + 2.4); });
  }
  /** a hoof-and-cart passing: call every frame with the cart's world position while it moves */
  cartAt(x, z, moving) {
    if (!this.ctx || !moving) return; const c = this.ctx, t = c.currentTime;
    if (t < this.nextHoof) return; this.nextHoof = t + 0.19 + Math.random() * 0.04;
    const out = this._out(x, z, 14, 1.3);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    const g = c.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2;
    const sg = c.createGain(); sg.gain.setValueAtTime(0.1, t); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.connect(f); f.connect(sg); sg.connect(out); s.start(t); s.stop(t + 0.06);
    // iron tyre rumble
    const r = c.createBufferSource(); r.buffer = this.noise; r.playbackRate.value = 0.3; const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 260;
    const rg = c.createGain(); rg.gain.setValueAtTime(0.16, t); rg.gain.linearRampToValueAtTime(0.0001, t + 0.22); r.connect(rf); rf.connect(rg); rg.connect(out); r.start(t); r.stop(t + 0.24);
  }

  /** ambient scheduler; call every frame */
  update(dt, px, pz, yaw) {
    if (!this.ctx) return; this.listener.x = px; this.listener.z = pz; this.listener.yaw = yaw; this.t += dt;
    if (this.t > this.nextRivet) { this.rivet(); this.nextRivet = this.t + 4 + Math.random() * 9; }
    if (this.t > this.nextWhistle) { this.whistle(); this.nextWhistle = this.t + 70 + Math.random() * 120; }
    if (this.t > this.nextRook) { this.rook(); this.nextRook = this.t + 5 + Math.random() * 14; }
    if (this.t > this.nextDog) { this.dog(); this.nextDog = this.t + 30 + Math.random() * 60; }
    if (this.t > this.nextBell) { this.bell(3 + Math.floor(Math.random() * 3)); this.nextBell = this.t + 240 + Math.random() * 200; }
    if (this.t > this.nextTrain) { this.train(); this.nextTrain = this.t + 120 + Math.random() * 120; }
  }
}
