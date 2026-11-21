// pocket voyagers
import { Animator, EXPRESSIONS, EYE_SHAPES, POSES } from './pvanimation.js';
import { Behavior, activeVoyagers } from './pvbehavior.js';

const DEBUG = false;
const SVG_PATH = './voyager.svg';

const COLOR_SCHEMES = {
  whisper: { body: '#191930', eyeTop: '#b0b0ca', eyeBottom: '#d3ac3e', tail: '#00678f', star: '#d3ac3e' },
  plum:    { body: '#7b247c', eyeTop: '#1e1b2e', eyeBottom: '#1e1b2e', tail: '#9d3488', star: '#f25c69' },
  coral:   { body: '#f25c69', eyeTop: '#23192d', eyeBottom: '#23192d', tail: '#d94352', star: '#ffd166' },
  ink:     { body: '#13315c', eyeTop: '#eef4ed', eyeBottom: '#8da9c4', tail: '#13315c', star: '#13315c' },
};

let svgTemplate = null;
let nextId = 0;

class PocketVoyager {
  constructor(options = {}) {
    const base = COLOR_SCHEMES[options.theme] ?? COLOR_SCHEMES.whisper;
    const custom = typeof options.theme === 'object' ? options.theme : {};
    this.theme = { ...base, ...custom };
    this.scale = options.scale ?? 1;
    this.speed = options.speed ?? 1.8 + Math.random() * 0.9;
    this.tick = Math.random() * 100;

    this.behavior = new Behavior(this, options);
    this._mountSVG();
    activeVoyagers.push(this);

    if (options.pose) this.setPose(options.pose);
    else this.behavior.pickGoal();
  }

  get x() { return this.behavior.x; }
  get y() { return this.behavior.y; }
  get state() { return this.behavior.state; }
  get facing() { return this.behavior.facing; }
  get isPosed() { return this.behavior.isPosed; }

  _mountSVG() {
    const w = 110 * this.scale;
    const h = 100 * this.scale;

    this.wrapper = document.createElement('div');
    this.wrapper.setAttribute(
      'style',
      `position:fixed!important;left:0!important;top:0!important;width:${w}px!important;height:${h}px!important;pointer-events:none!important;z-index:2147483647!important;`
    );

    this.svg = document.importNode(svgTemplate, true);
    this.svg.setAttribute('width', String(w));
    this.svg.setAttribute('height', String(h));
    const vars = Object.entries(this.theme).map(([k, val]) => `--pv-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${val};`);
    this.svg.setAttribute('style', `overflow:visible;display:block;${vars.join('')}`);

    // all voyagers share ids, so give each gradient a unique id (solves all eye colors being the same)
    const gradientId = `eye-grad-${nextId++}`;
    const gradient = this.svg.querySelector('#eye-grad');
    if (gradient) gradient.id = gradientId;

    this.anim = new Animator(this, this.svg, gradientId);

    this.debugLayer = this.svg.querySelector('#debug-layer');
    this.debugPivots = this.svg.querySelector('#debug-pivots');
    this.debugLabel = this.svg.querySelector('#debug-label');
    this.setDebug(DEBUG);

    this.wrapper.appendChild(this.svg);
    (document.body || document.documentElement).appendChild(this.wrapper);
  }

  setDebug(enabled) { // view information about voyagers
    this.debugEnabled = enabled;
    const mode = enabled ? 'inline' : 'none';
    this.debugLayer?.setAttribute('display', mode);
    this.debugPivots?.setAttribute('display', mode);
  }

  // has to be an element, a css selector, or a { left, top, right, bottom } rect. setting to null releases them.
  setBounds(target) {
    this.behavior.setBounds(target);
  }

  setPose(nameOrDef) {
    if (this.anim.setPose(nameOrDef)) this.behavior.holdPose();
  }

  resumeBehavior() {
    this.anim.clearPose();
    this.anim.setExpression(null);
    this.behavior.pickGoal();
  }

  setExpression(nameOrDef, frames = 0) {
    this.anim.setExpression(nameOrDef, frames);
  }

  setEyes(left, right = left, frames = 0) {
    this.anim.setExpression({ eyes: [left, right] }, frames);
  }

  update() {
    this.tick++;
    this.behavior.update();
    this.anim.update();

    this.wrapper.style.transform = `translate(${(this.x - 45 * this.scale).toFixed(1)}px,${(this.y - 49 * this.scale).toFixed(1)}px)`;
    if (this.debugEnabled && this.debugLabel) {
      this.debugLabel.textContent = `${this.state.toUpperCase()} (${Math.round(this.x)},${Math.round(this.y)})`;
    }
  }

  destroy() {
    this.wrapper.remove();
  }
}

function startLoop() {
  for (let i = activeVoyagers.length - 1; i >= 0; i--) {
    const v = activeVoyagers[i];
    if (!v.wrapper.isConnected) activeVoyagers.splice(i, 1);
    else v.update();
  }
  requestAnimationFrame(startLoop);
}

const summonVoyagers = (count = 1, theme, options = {}) => {
  const keys = Object.keys(COLOR_SCHEMES);
  return Array.from({ length: count }, (_, i) => new PocketVoyager({ theme: theme || keys[i % keys.length], ...options }));
};
const setVoyagerBounds = (target) => activeVoyagers.forEach((v) => v.setBounds(target));
const setVoyagerDebug = (enabled) => activeVoyagers.forEach((v) => v.setDebug(enabled));
const clearVoyagers = () => {
  while (activeVoyagers.length) activeVoyagers.pop().destroy();
};

async function init() {
  const response = await fetch(SVG_PATH);
  if (!response.ok) {
    console.error(`[PocketVoyagers] Could not load ${SVG_PATH} (HTTP ${response.status}). Check the file path.`);
    return;
  }

  const svgText = await response.text();
  svgTemplate = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  if (svgTemplate?.nodeName.toLowerCase() !== 'svg') {
    console.error('[PocketVoyagers] Loaded file is not a valid SVG:', svgText.slice(0, 120));
    return;
  }

  Object.assign(window, {
    PocketVoyager,
    VOYAGER_THEMES: COLOR_SCHEMES,
    VOYAGER_POSES: POSES,
    VOYAGER_EXPRESSIONS: EXPRESSIONS,
    VOYAGER_EYE_SHAPES: EYE_SHAPES,
    activeVoyagers,
    summonVoyagers,
    setVoyagerBounds,
    setVoyagerDebug,
    clearVoyagers,
  });

  requestAnimationFrame(startLoop);
}

await init();

export {
  PocketVoyager,
  COLOR_SCHEMES,
  COLOR_SCHEMES as VOYAGER_THEMES,
  POSES as VOYAGER_POSES,
  EXPRESSIONS as VOYAGER_EXPRESSIONS,
  EYE_SHAPES as VOYAGER_EYE_SHAPES,
  activeVoyagers,
  summonVoyagers,
  setVoyagerBounds,
  setVoyagerDebug,
  clearVoyagers,
};
