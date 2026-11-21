// move and dance!!
import POSES_JSON from './pvposes.json' with { type: 'json' };
import { approach, clamp, easeOutBack, lerp, lerpKeys, num, rand, rotate, scale, smoothstep, translate, wave } from './pvmath.js';

export const POSES = { ...POSES_JSON };
POSES.sleep = { ...POSES.lieBack, headAngle: 70 }; // you can make a pose based upon another pose
const IDLE = POSES.idle; // the ORIGINAL pose..

const JOINTS = {
  head:  { id: 'head-group',  at: [30, 12.5],  angle: 'headAngle' },
  lLegU: { id: 'leg-l-upper', at: [29.4, 38],  angle: 'lLeg' },
  lLegL: { id: 'leg-l-lower', at: [0, 7.5],    angle: 'lKnee' },
  rLegU: { id: 'leg-r-upper', at: [30.6, 38],  angle: 'rLeg' },
  rLegL: { id: 'leg-r-lower', at: [0, 7.5],    angle: 'rKnee' },
  lArmU: { id: 'arm-l-upper', at: [29.2, 21],  angle: 'lArm' },
  lArmL: { id: 'arm-l-lower', at: [0, 7.25],   angle: 'lElbow' },
  rArmU: { id: 'arm-r-upper', at: [30.8, 21],  angle: 'rArm' },
  rArmL: { id: 'arm-r-lower', at: [0, 7.25],   angle: 'rElbow' },
};

const BLEND = 0.22; // floaty  vs snappy blending between poses

// eyes are a 3 point line. expression shape coords are per eye
export const EYE_SHAPES = {
  l: {
    normal:  [[-3.3, -1.5], [-3.3, 0.6], [-3.3, 2.7]],
    chevron: [[-4.8, -1.6], [-2.7, 0.6], [-4.8, 2.8]],
    happy:   [[-5.95, 2.2], [-3.75, -1.0], [-1.55, 2.2]],
    flat:    [[-5.65, 0.6], [-3.75, 0.6], [-1.85, 0.6]],
    dot:     [[-3.75, 0.6], [-3.75, 0.6], [-3.75, 0.6]],
  },
  r: {
    normal:  [[3.6, -1.5], [3.6, 0.6], [3.6, 2.7]],
    chevron: [[5.2, -1.6], [3.1, 0.6], [5.2, 2.8]],
    happy:   [[1.95, 2.2], [4.15, -1.0], [6.35, 2.2]],
    flat:    [[2.25, 0.6], [4.15, 0.6], [6.05, 0.6]],
    dot:     [[4.15, 0.6], [4.15, 0.6], [4.15, 0.6]],
  },
};

// only tall shapes use both colors
const FLAT_SHAPES = new Set(['flat', 'dot']);
const EYE_CENTER = { l: [-3.3, 0.6], r: [3.6, 0.6] };
const EYE_MORPH_MS = 220;

// presets can be set for both eyes or individually
export const EXPRESSIONS = {
  neutral:   { eyes: 'normal' },
  happy:     { eyes: 'happy' },
  sleepy:    { eyes: 'flat' },
  surprised: { eyes: 'normal', size: 1.2 },
  squint:    { eyes: 'chevron' },
  blank:     { eyes: 'dot' },
  wink:      { eyes: ['normal', 'happy'] },
};

class Eye {
  constructor(svg, side, gradientId) {
    this.side = side;
    this.el = svg.querySelector(`#eye-${side}`);
    this.gradient = `url(#${gradientId})`;
    const initial = svg.getAttribute(`data-eye-${side}`);
    this.shape = EYE_SHAPES[side][initial] ? initial : 'normal';
    this.points = EYE_SHAPES[side][this.shape].map((p) => [...p]);
    this.raf = null;
    this._applyStroke();
    this._paint();
  }

  _applyStroke() {
    this.el?.setAttribute('stroke', FLAT_SHAPES.has(this.shape) ? 'var(--pv-eye-top, #b0b0ca)' : this.gradient);
  }

  _paint() {
    this.el?.setAttribute('d', 'M ' + this.points.map(([x, y]) => `${num(x)},${num(y)}`).join(' L '));
  }

  setShape(shape, ms = EYE_MORPH_MS) {
    const target = EYE_SHAPES[this.side][shape];
    if (!target || !this.el) return;

    this.shape = shape;
    this._applyStroke();
    cancelAnimationFrame(this.raf);

    const from = this.points.map((p) => [...p]);
    const t0 = performance.now();
    const tick = (now) => {
      const raw = clamp((now - t0) / ms, 0, 1);
      const k = raw === 1 ? 1 : easeOutBack(raw);
      this.points = from.map((p, i) => [lerp(p[0], target[i][0], k), lerp(p[1], target[i][1], k)]);
      this._paint();
      if (raw < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setScale(sx, sy) {
    const [cx, cy] = EYE_CENTER[this.side];
    this.el?.setAttribute('transform', `${translate(cx, cy)} ${scale(sx, sy)} ${translate(-cx, -cy)}`);
  }
}

const walkAngles = (tick, freq) => {
  const a = Math.sin(tick * freq) * 40;
  const b = Math.sin(tick * freq + Math.PI) * 40;
  return {
    lLeg: a, lKnee: Math.max(0, -a * 0.7), rLeg: b, rKnee: Math.max(0, -b * 0.7),
    lArm: b * 0.8, lElbow: -22 - Math.max(0, b * 0.3), rArm: a * 0.8, rElbow: -22 - Math.max(0, a * 0.3),
  };
};

export class Animator {
  constructor(v, svg, gradientId) {
    this.v = v;
    const q = (id) => svg.querySelector(`#${id}`);

    this.rig = q('vrig');
    this.joints = Object.fromEntries(Object.entries(JOINTS).map(([name, j]) => [name, q(j.id)]));
    this.tail = { path: q('tail-path'), star: q('tail-star') };
    this.eyeGroup = q('eyes');
    this.eyes = { l: new Eye(svg, 'l', gradientId), r: new Eye(svg, 'r', gradientId) };

    this.angles = { ...IDLE };
    this.pose = null;
    this.poseName = null;
    this.poseTick = 0;

    this.tailAmt = 1; // 0 = tail at rest, 1 = full wag
    this.gaze = { x: 0, y: 0 };
    this.eyeSize = 1;
    this.blinkTimer = rand(60, 240);
    this.blinkFrame = 0;
    this.override = null;
    this.overrideTimer = 0;
  }

  setPose(nameOrDef) {
    const def = typeof nameOrDef === 'string' ? POSES[nameOrDef] : nameOrDef;
    if (!def) return false;

    const animated = Array.isArray(def.frames);
    this.poseName = typeof nameOrDef === 'string' ? nameOrDef : null;
    this.poseTick = 0;
    this.pose = {
      speed: animated ? def.speed ?? 0.14 : 0,
      bob: def.bob ?? 0,
      expression: def.expression ?? 'neutral',
      frames: (animated ? def.frames : [def]).map((fr) => ({ ...IDLE, ...fr })),
    };
    return true;
  }

  clearPose() {
    this.pose = null;
    this.poseName = null;
  }

  // if there are only 2 frames ping pong between them, if 3 or more then run them in order
  _poseAngles() {
    const { frames, speed } = this.pose;
    if (frames.length === 1) return frames[0];

    this.poseTick += speed;
    if (frames.length === 2) return lerpKeys(frames[0], frames[1], wave(this.poseTick), IDLE);

    const i = Math.floor(this.poseTick) % frames.length;
    const frac = this.poseTick - Math.floor(this.poseTick);
    return lerpKeys(frames[i], frames[(i + 1) % frames.length], smoothstep(frac), IDLE);
  }

  _motion() {
    const v = this.v;
    if (v.isPosed && this.pose) {
      const bob = this.pose.bob ? Math.sin(this.poseTick) * this.pose.bob : 0;
      return { angles: this._poseAngles(), bob, lean: 0 };
    }
    if (v.behavior.moving) {
      const chasing = v.state === 'chase';
      const freq = chasing ? 0.28 : 0.2;
      return { angles: walkAngles(v.tick, freq), bob: Math.abs(Math.sin(v.tick * freq)) * -3.5, lean: chasing ? 8 : 3 };
    }
    return { angles: IDLE, bob: Math.sin(v.tick * 0.07) * 1.2, lean: 0 };
  }

  setExpression(nameOrDef, frames = 0) {
    const def = typeof nameOrDef === 'string' ? EXPRESSIONS[nameOrDef] : nameOrDef;
    this.override = def ?? null;
    this.overrideTimer = def ? frames : 0;
  }

  _expression() {
    if (this.override) return this.override;
    if (this.v.isPosed && this.pose) return EXPRESSIONS[this.pose.expression] ?? EXPRESSIONS.neutral;
    return this.v.state === 'chase' ? EXPRESSIONS.happy : EXPRESSIONS.neutral;
  }

  update() {
    if (this.overrideTimer > 0 && --this.overrideTimer <= 0) this.override = null;

    const { angles, bob, lean } = this._motion();
    this._applyLimbs(angles);
    this._applyRig(bob, lean);
    this._animateTail();
    this._animateEyes();
  }

  _applyLimbs(target) {
    for (const key of Object.keys(this.angles)) this.angles[key] = approach(this.angles[key], target[key] ?? IDLE[key], BLEND);
    for (const [name, j] of Object.entries(JOINTS)) {
      this.joints[name]?.setAttribute('transform', `${translate(...j.at)} ${rotate(this.angles[j.angle])}`);
    }
  }

  _applyRig(bob, lean) {
    const { yOffset, bodyAngle } = this.angles;
    this.rig?.setAttribute(
      'transform',
      `${translate(45, 49 + bob + yOffset)} ${scale(this.v.facing, 1)} ${rotate(lean + bodyAngle)} ${translate(-30, -30)}`
    );
  }

  _animateTail() {
    const { path, star } = this.tail;
    if (!path || !star) return;

    const { v } = this;
    const moving = v.behavior.moving;
    this.tailAmt = approach(this.tailAmt, v.isPosed && !this.pose?.bob ? 0 : 1, 0.1);

    const speed = moving ? 0.22 : 0.06;
    const amp = (moving ? 4.5 : 2.5) * this.tailAmt;
    const drag = Math.abs(v.behavior.vx) * 1.6 * this.tailAmt;
    const wave1 = Math.sin(v.tick * speed) * amp * 0.6;
    const wave2 = Math.sin(v.tick * speed - 0.9) * amp;

    const c1 = [23 - drag * 0.4, 43 + wave1];
    const c2 = [14 - drag * 0.8, 40 + wave2 * 0.8];
    const tip = [11 - drag, 33 + wave2 - drag * 0.5];

    path.setAttribute('d', `M 31,38 C ${c1.map((n) => num(n, 1))} ${c2.map((n) => num(n, 1))} ${tip.map((n) => num(n, 1))}`);
    const tangent = Math.atan2(tip[1] - c2[1], tip[0] - c2[0]) * (180 / Math.PI);
    star.setAttribute('transform', `${translate(...tip)} ${rotate(tangent)}`);
  }

  _animateEyes() {
    const look = this.v.behavior.look;
    this.gaze.x = approach(this.gaze.x, look.x, 0.15);
    this.gaze.y = approach(this.gaze.y, look.y, 0.15);
    this.eyeGroup?.setAttribute('transform', translate(this.gaze.x, this.gaze.y));

    const expr = this._expression();
    const [left, right = left] = [].concat(expr.eyes);
    if (this.eyes.l.shape !== left) this.eyes.l.setShape(left);
    if (this.eyes.r.shape !== right) this.eyes.r.setShape(right);
    this.eyeSize = approach(this.eyeSize, expr.size ?? 1, 0.18);

    let openness = 1;
    if (this.blinkFrame > 0) {
      this.blinkFrame--;
      openness = Math.max(0.08, Math.abs(this.blinkFrame - 5) / 5);
    } else if (--this.blinkTimer <= 0) {
      this.blinkFrame = 10;
      this.blinkTimer = Math.random() < 0.18 ? 16 : rand(90, 270);
    }
    this.eyes.l.setScale(this.eyeSize, this.eyeSize * openness);
    this.eyes.r.setScale(this.eyeSize, this.eyeSize * openness);
  }
}