// the scary part

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (cur, target, rate) => cur + (target - cur) * rate;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export const rand = (min, max) => min + Math.random() * (max - min);
export const chance = (p) => Math.random() < p;
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const wave = (t) => 0.5 - 0.5 * Math.cos(t);
export const smoothstep = (t) => wave(t * Math.PI);

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function lerpKeys(a, b, t, base) {
  const out = {};
  for (const key of Object.keys(base)) out[key] = lerp(a[key] ?? base[key], b[key] ?? base[key], t);
  return out;
}

export const num = (n, digits = 2) => n.toFixed(digits);
export const translate = (x, y) => `translate(${num(x)},${num(y)})`;
export const rotate = (deg) => `rotate(${num(deg)})`;
export const scale = (x, y = x) => `scale(${num(x, 3)},${num(y, 3)})`;