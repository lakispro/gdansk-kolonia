import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * First-person walker, desktop and touch, with a jump.
 *
 * Desktop: pointer-lock mouse look, WASD, Shift sprint, Space jump, E act.
 * Touch:   a virtual stick on the left drives movement, any drag on the
 *          rest of the screen turns the view, buttons act / sprint / jump.
 *
 * Collision is a 2-D circle against building footprints (segment
 * distance) plus circular props, sub-stepped so a sprint cannot tunnel
 * through a fence.  Vertical motion is a simple gravity integrator over
 * a ground-height function (the block is nearly flat, 6-9 m ASL).
 * ------------------------------------------------------------------ */

export const EYE = 1.66;
export const RADIUS = 0.36;
const GRAVITY = 18.5, JUMP_V = 6.6;   // 1.2 m: enough to vault a picket fence

export class Player {
  constructor(camera, dom, world, opts = {}) {
    this.camera = camera; this.dom = dom; this.world = world;
    this.spawn = { x: opts.x ?? 0, z: opts.z ?? 0, yaw: opts.yaw ?? 0 };
    this.ground = opts.ground || (() => 0);
    this.pos = new THREE.Vector3(this.spawn.x, 0, this.spawn.z);
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    this.vy = 0; this.onGround = true; this.airTime = 0;
    this.yaw = this.spawn.yaw; this.pitch = 0;
    this.keys = new Set();
    this.locked = false; this.touch = false; this.frozen = true;
    this.walk = 2.7; this.run = 5.6; this.running = false;
    this.sens = 0.0022; this.touchSens = 0.0048;
    this.bob = 0; this.moving = 0; this.lastStepPhase = 0;
    this.stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
    this.look = { id: null, lx: 0, ly: 0 };
    this.onAct = null; this.onKey = null; this.onStep = null; this.onJump = null; this.onLand = null;
    this._bind(); this.applyCamera(0);
  }

  _bind() {
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sens; this.pitch -= e.movementY * this.sens;
      this.pitch = Math.max(-1.25, Math.min(1.15, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; this.keys.add(e.code);
      if (e.code === 'KeyE' && !this.frozen) this.onAct?.();
      if (e.code === 'Space' && !this.frozen) this.jump();
      this.onKey?.(e.code, e);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // ---- touch
    const stick = document.getElementById('stick'), knob = stick.querySelector('.knob');
    const lookEl = document.getElementById('look');
    const R = 46;
    stick.addEventListener('pointerdown', (e) => {
      if (this.stick.active) return;
      this.stick.active = true; this.stick.id = e.pointerId;
      const b = stick.getBoundingClientRect(); this.stick.cx = b.left + b.width / 2; this.stick.cy = b.top + b.height / 2;
      stick.setPointerCapture(e.pointerId); moveStick(e); e.preventDefault();
    });
    const moveStick = (e) => {
      let dx = e.clientX - this.stick.cx, dy = e.clientY - this.stick.cy;
      const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      this.stick.dx = dx / R; this.stick.dy = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) moveStick(e); });
    const endStick = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.active = false; this.stick.id = null; this.stick.dx = this.stick.dy = 0; knob.style.transform = '';
    };
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

    lookEl.addEventListener('pointerdown', (e) => {
      if (this.look.id !== null || e.pointerType === 'mouse') return;
      this.look.id = e.pointerId; this.look.lx = e.clientX; this.look.ly = e.clientY;
      lookEl.setPointerCapture(e.pointerId);
    });
    lookEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.look.id) return;
      const dx = e.clientX - this.look.lx, dy = e.clientY - this.look.ly; this.look.lx = e.clientX; this.look.ly = e.clientY;
      this.yaw -= dx * this.touchSens; this.pitch -= dy * this.touchSens;
      this.pitch = Math.max(-1.25, Math.min(1.15, this.pitch));
    });
    const endLook = (e) => { if (e.pointerId === this.look.id) this.look.id = null; };
    lookEl.addEventListener('pointerup', endLook); lookEl.addEventListener('pointercancel', endLook);

    const bAct = document.getElementById('bAct'), bRun = document.getElementById('bRun'), bJump = document.getElementById('bJump');
    bAct.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!this.frozen) this.onAct?.(); });
    bRun.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.running = !this.running; bRun.classList.toggle('hot', this.running); });
    bJump.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!this.frozen) this.jump(); });
  }

  enableTouch() { this.touch = true; document.body.classList.add('touch'); }

  lock() {
    try { const r = this.dom.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch { /* fallback: drag look */ }
  }

  reset() { this.pos.set(this.spawn.x, 0, this.spawn.z); this.pos.y = this.ground(this.pos.x, this.pos.z); this.vy = 0; this.yaw = this.spawn.yaw; this.pitch = 0; }

  jump() { if (!this.onGround) return; this.vy = JUMP_V; this.onGround = false; this.onJump?.(); }

  get isRunning() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.running; }

  update(dt) {
    if (this.frozen) { this.applyCamera(dt); return; }
    dt = Math.min(dt, 0.05);
    let fwd = 0, side = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) side += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) side -= 1;
    if (this.stick.active) { fwd -= this.stick.dy; side += this.stick.dx; }
    const mag = Math.hypot(fwd, side);
    const run = this.isRunning;
    let speed = run ? this.run : this.walk;
    if (mag > 1) { fwd /= mag; side /= mag; }
    this.moving = Math.min(1, mag);
    // yaw = 0 faces -z (north).  forward = (-sin yaw, -cos yaw)
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let vx = (fx * fwd + rx * side) * speed, vz = (fz * fwd + rz * side) * speed;
    const dist = Math.hypot(vx, vz) * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.15));
    for (let i = 0; i < steps; i++) {
      this._move(vx * dt / steps, 0); this._move(0, vz * dt / steps);
    }
    // vertical
    const g = this.ground(this.pos.x, this.pos.z);
    if (this.onGround) {
      this.pos.y = g;
    } else {
      this.vy -= GRAVITY * dt; this.pos.y += this.vy * dt; this.airTime += dt;
      if (this.pos.y <= g) { this.pos.y = g; this.onGround = true; this.vy = 0; this.onLand?.(this.airTime); this.airTime = 0; }
    }
    // head bob and footstep events
    if (this.moving > 0.05 && this.onGround) {
      this.bob += dt * (run ? 11 : 7.5) * this.moving;
      const phase = Math.floor(this.bob / Math.PI);
      if (phase !== this.lastStepPhase) { this.lastStepPhase = phase; this.onStep?.(run); }
    } else if (!this.onGround) { /* keep bob */ } else this.bob = 0;
    this.applyCamera(dt);
  }

  _move(dx, dz) {
    const x = this.pos.x + dx, z = this.pos.z + dz;
    const r = this.world.resolve(x, z, RADIUS, this.pos.y - this.ground(x, z));
    this.pos.x = r.x; this.pos.z = r.z;
  }

  applyCamera(dt) {
    const bobY = this.moving > 0.05 && this.onGround ? Math.sin(this.bob) * 0.03 : 0;
    const bobX = this.moving > 0.05 && this.onGround ? Math.sin(this.bob / 2) * 0.012 : 0;
    this.camera.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.pos.y + EYE + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
  }
}
