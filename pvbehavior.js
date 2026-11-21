// decides what a voyager is doing at any given time
import { chance, clamp, dist, pick, rand } from './pvmath.js';

const AUTO_POSES = ['wave', 'stretch', 'sit', 'dance', 'lieStomach'];
const SOCIAL = { greetDist: 110, copyDist: 160, cooldown: 600 };
const CURSOR = { chaseDist: 180, lookDist: 300, chaseFresh: 800, lookFresh: 1500 };

export const activeVoyagers = [];
export const mouse = { x: -999, y: -999, lastMoved: 0 };

document.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.lastMoved = Date.now();
});

export class Behavior {
  constructor(v, options = {}) {
    this.v = v;
    this.bounds = options.bounds ?? null;
    this._boundsEl = null;
    this._boundsWarned = false;

    const spawn = this.getBounds();
    this.x = options.x ?? rand(spawn.left, spawn.right);
    this.y = options.y ?? rand(spawn.top, spawn.bottom);
    this.tx = this.x;
    this.ty = this.y;
    this.vx = 0;
    this.dx = 0;
    this.dy = 0;
    this.moving = false;
    this.facing = chance(0.5) ? 1 : -1;

    this.state = 'wander';
    this.timer = rand(90, 240);
    this.autoPoseTimer = 0;
    this.socialBattery = 0; // frames till voyager can socialize again

    this.look = { x: 0, y: 0 };
    this.idleLook = { x: 0, y: 0 };
  }

  get isPosed() {
    return this.state === 'posed' || this.state === 'social';
  }

  setBounds(target) {
    this.bounds = target ?? null;
    this._boundsEl = null;
    this._boundsWarned = false;
  }

  getBounds() {
    const { scale } = this.v;
    const viewport = {
      left: 80,
      top: 80,
      right: 80 + Math.max(100, window.innerWidth - 160),
      bottom: 80 + Math.max(100, window.innerHeight - 160),
    };
    const b = this.bounds;
    if (!b) return viewport;

    let r = null;
    if (typeof b === 'string') {
      if (!this._boundsEl?.isConnected) this._boundsEl = document.querySelector(b);
      r = this._boundsEl?.getBoundingClientRect() ?? null;
    } else if (b instanceof Element) {
      r = b.isConnected ? b.getBoundingClientRect() : null;
    } else {
      r = { left: b.left, top: b.top, right: b.right ?? b.left + b.width, bottom: b.bottom ?? b.top + b.height };
    }

    if (!r) {
      if (!this._boundsWarned) {
        console.warn('[PocketVoyager] Bounds target not found, falling back to the viewport:', b);
        this._boundsWarned = true;
      }
      return viewport;
    }

    // lying down poses are wider than standing ones, so leave a little more room at the sides
    const lying = Math.abs(this.v.anim?.angles.bodyAngle ?? 0) / 90;
    const padX = (18 + lying * 12) * scale;
    let left = r.left + padX;
    let right = r.right - padX;
    let top = r.top + 30 * scale;
    let bottom = r.bottom - 25 * scale;
    if (left > right) left = right = (r.left + r.right) / 2;
    if (top > bottom) top = bottom = (r.top + r.bottom) / 2;
    return { left, top, right, bottom };
  }

  // manually hold a pose until told to do otherwise
  holdPose() {
    this.state = 'posed';
    this.autoPoseTimer = 0;
  }

  // decide what to do
  pickGoal() {
    this.autoPoseTimer = 0;
    const roll = Math.random();

    if (roll < 0.25) {
      this.v.setPose(pick(AUTO_POSES));
      this.autoPoseTimer = rand(180, 360);
    } else if (roll < 0.5) {
      this.state = 'idle';
      this.timer = rand(90, 250);
      this.idleLook = { x: (Math.random() - 0.35) * 1.8, y: (Math.random() - 0.5) * 1.4 };
    } else {
      const area = this.getBounds();
      this.state = 'wander';
      this.tx = rand(area.left, area.right);
      this.ty = rand(area.top, area.bottom);
      this.timer = rand(140, 320);
    }
  }

  update() {
    if (this.socialBattery > 0) this.socialBattery--;

    if (!this.isPosed) {
      this._think();
    } else if (this.autoPoseTimer > 0 && --this.autoPoseTimer <= 0) {
      this.pickGoal(); 
    }

    this._move();
    this._updateLook();
  }

  _think() {
    this.timer--;
    const cursorFresh = Date.now() - mouse.lastMoved < CURSOR.chaseFresh;

    if (cursorFresh && dist(mouse.x, mouse.y, this.x, this.y) < CURSOR.chaseDist && this.state !== 'chase' && chance(0.04)) {
      this.state = 'chase';
      this.timer = rand(70, 120);
      this.tx = mouse.x + rand(-30, 30);
      this.ty = mouse.y + rand(-30, 30);
      this.v.setExpression('surprised', 45);
    } else if (this.timer <= 0) {
      this.pickGoal();
    }
    this._checkSocial();
  }

  _move() {
    const area = this.bounds ? this.getBounds() : null;
    if (area) {
      this.tx = clamp(this.tx, area.left, area.right);
      this.ty = clamp(this.ty, area.top, area.bottom);
    }

    this.dx = this.tx - this.x;
    this.dy = this.ty - this.y;
    const d = Math.hypot(this.dx, this.dy);
    const travelling = this.state === 'wander' || this.state === 'chase';
    this.moving = d > 8 && travelling;

    if (this.moving) {
      const spd = this.v.speed * (this.state === 'chase' ? 1.2 : 0.8);
      this.vx = (this.dx / d) * spd;
      this.x += this.vx;
      this.y += (this.dy / d) * spd;
      if (Math.abs(this.dx) > 1.5) this.facing = this.dx < 0 ? -1 : 1;
    } else {
      this.vx *= 0.8;
      if (travelling) this.pickGoal();
    }

    // ease into bounds if outside them
    if (area) {
      this.x += (clamp(this.x, area.left, area.right) - this.x) * 0.2;
      this.y += (clamp(this.y, area.top, area.bottom) - this.y) * 0.2;
    }
  }

  // where is the voyager gazing?: cursor if it's recent and close, else the travel direction, else a random idle glance
  _updateLook() {
    const cursorNear = Date.now() - mouse.lastMoved < CURSOR.lookFresh && dist(mouse.x, mouse.y, this.x, this.y) < CURSOR.lookDist;

    if (cursorNear) {
      const lx = mouse.x - this.x;
      const ly = mouse.y - this.y;
      if (!this.moving && !this.isPosed && Math.abs(lx) > 25) this.facing = lx < 0 ? -1 : 1; // turn toward cursor
      this.look.x = clamp((lx / 120) * this.facing, -2.0, 2.0);
      this.look.y = clamp(ly / 120, -1.6, 1.6);
    } else if (this.moving) {
      this.look.x = clamp((this.dx / 100) * this.facing, -1.8, 1.8);
      this.look.y = clamp(this.dy / 100, -1.4, 1.4);
    } else {
      this.look.x = this.idleLook.x;
      this.look.y = this.idleLook.y;
    }
  }

  // social activity

  _checkSocial() {
    const free = (b) => b.cooldown <= 0 && (b.state === 'wander' || b.state === 'idle');
    if (!free(this)) return;

    const others = activeVoyagers.map((o) => o.behavior).filter((b) => b !== this && b.v.wrapper.isConnected);
    const near = (b, range) => dist(b.x, b.y, this.x, this.y) < range;

    const buddy = others.find((b) => free(b) && near(b, SOCIAL.greetDist));
    if (buddy) return this._greet(buddy);

    // idle voyagers sometimes copy another's pose
    if (this.state === 'idle' && chance(0.004)) {
      const leader = others.find((b) => b.state === 'posed' && b.v.anim.poseName && b.autoPoseTimer > 0 && near(b, SOCIAL.copyDist));
      if (!leader) return;

      this.facing = leader.x < this.x ? -1 : 1;
      this.v.setPose(leader.v.anim.poseName);
      this.v.anim.poseTick = leader.v.anim.poseTick; // stay in sync with the leader's animation
      this.state = 'social';
      this.autoPoseTimer = Math.max(60, leader.autoPoseTimer);
      this.socialBattery = SOCIAL.cooldown / 2;
    }
  }

  // voyagers can stop and wave at one another
  _greet(other) {
    for (const [a, b] of [[this, other], [other, this]]) {
      a.facing = b.x < a.x ? -1 : 1;
      a.v.setPose('wave');
      a.state = 'social';
      a.autoPoseTimer = rand(110, 130);
      a.cooldown = SOCIAL.cooldown;
    }
  }
}