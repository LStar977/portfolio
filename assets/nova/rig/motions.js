// Nova v5 performance layer: idle life, expressions and motions -> rig parameters.
// Deterministic for a given seed, so video renders are repeatable.
import { DEFAULTS } from './nova-rig.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const noise = (t, k) => Math.sin(t * 1.00 + k) * .5 + Math.sin(t * 2.31 + k * 1.7) * .3 + Math.sin(t * 4.13 + k * 2.9) * .2; // smooth, -1..1

// Expressions: additive offsets, except EyeLOpen/EyeROpen which are multipliers (1 = unchanged).
export const EXPRESSIONS = {
  neutral: {},
  smile: { ParamMouthForm: .65, ParamEyeLSmile: .35, ParamEyeRSmile: .35, ParamCheek: .25, ParamBrowLY: .15, ParamBrowRY: .15 },
  happy: { ParamMouthForm: 1, ParamEyeLSmile: .8, ParamEyeRSmile: .8, ParamCheek: .5, ParamBrowLY: .35, ParamBrowRY: .35 },
  laugh: { ParamMouthForm: 1, ParamMouthOpenY: .42, ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamEyeLOpen: .35, ParamEyeROpen: .35, ParamCheek: .6, ParamBrowLY: .45, ParamBrowRY: .45 },
  surprised: { ParamEyeWide: 1, ParamBrowLY: 1, ParamBrowRY: 1, ParamMouthOpenY: .4, ParamMouthForm: -.15, ParamAngleY: 4 },
  curious: { ParamBrowLY: .75, ParamBrowRY: -.15, ParamBrowRAngle: .2, ParamMouthForm: .15, ParamEyeWide: .25, ParamAngleZ: 9 },
  thinking: { ParamBrowRY: .45, ParamBrowLAngle: .35, ParamEyeBallX: -.6, ParamEyeBallY: .65, ParamMouthForm: -.3, ParamAngleZ: -7, ParamAngleX: -7, ParamAngleY: 5 },
  shy: { ParamCheek: 1, ParamEyeBallY: -.55, ParamEyeBallX: .45, ParamAngleY: -9, ParamAngleZ: 7, ParamMouthForm: .35, ParamBrowLAngle: -.45, ParamBrowRAngle: -.45, ParamEyeLSmile: .3, ParamEyeRSmile: .3 },
  worried: { ParamBrowLAngle: -1, ParamBrowRAngle: -1, ParamBrowLY: .3, ParamBrowRY: .3, ParamMouthForm: -.6, ParamEyeWide: .2 },
  serious: { ParamBrowLAngle: .5, ParamBrowRAngle: .5, ParamBrowLY: -.35, ParamBrowRY: -.35, ParamMouthForm: -.2, ParamEyeLSmile: .15, ParamEyeRSmile: .15 },
  sad: { ParamBrowLAngle: -.8, ParamBrowRAngle: -.8, ParamMouthForm: -.8, ParamEyeLOpen: .75, ParamEyeROpen: .75, ParamEyeBallY: -.4, ParamAngleY: -8 },
  sleepy: { ParamEyeLOpen: .38, ParamEyeROpen: .38, ParamBrowLY: -.2, ParamBrowRY: -.2, ParamMouthForm: .1, ParamAngleZ: 6, ParamAngleY: -5 },
  smug: { ParamMouthForm: .55, ParamEyeLSmile: .5, ParamEyeRSmile: .5, ParamBrowLY: .5, ParamBrowRY: -.25, ParamAngleZ: -6, ParamAngleY: 4, ParamEyeLOpen: .8, ParamEyeROpen: .8 },
};

// Motions: additive keyframe tracks [t, value]; eased between keys. `expr` switches expression during the motion.
export const MOTIONS = {
  nod: { dur: 1.0, tracks: { ParamAngleY: [[0, 0], [.2, -11], [.42, 2], [.62, -7], [.9, 0]], ParamBodyAngleY: [[0, 0], [.2, -2], [.5, 0]] } },
  shake: { dur: 1.3, tracks: { ParamAngleX: [[0, 0], [.22, -11], [.5, 10], [.78, -7], [1.02, 3], [1.3, 0]], ParamEyeBallX: [[0, 0], [.22, -.3], [.5, .3], [.78, -.2], [1.1, 0]] } },
  tilt: { dur: 2.6, tracks: { ParamAngleZ: [[0, 0], [.55, 14], [2.0, 13], [2.6, 0]], ParamBrowLY: [[0, 0], [.5, .5], [2.1, .45], [2.6, 0]], ParamEyeBallY: [[0, 0], [.5, .2], [2.1, .2], [2.6, 0]] } },
  lookAround: { dur: 4.2, tracks: {
    ParamEyeBallX: [[0, 0], [.12, -.85], [1.1, -.85], [1.25, .85], [2.5, .85], [2.65, 0], [4.2, 0]],
    ParamAngleX: [[0, 0], [.5, -16], [1.2, -16], [1.9, 16], [2.6, 16], [3.3, 0], [4.2, 0]],
    ParamEyeBallY: [[0, 0], [.12, .15], [1.1, .15], [1.25, -.1], [2.5, -.1], [2.65, 0]],
    ParamBodyAngleX: [[0, 0], [.7, -3], [1.3, -3], [2.1, 3], [2.8, 3], [3.5, 0]] } },
  laugh: { dur: 2.4, expr: [[0, 'laugh'], [2.1, null]], tracks: {
    ParamMouthOpenY: [[0, 0], [.15, .35], [.3, .12], [.45, .38], [.6, .12], [.75, .36], [.9, .1], [1.1, .3], [1.6, .15], [2.2, 0]],
    ParamAngleY: [[0, 0], [.15, 6], [.3, 2], [.45, 6], [.6, 2], [.75, 5], [1.0, 1], [2.2, 0]],
    ParamAngleZ: [[0, 0], [.4, 7], [1.8, 5], [2.4, 0]], ParamBodyAngleY: [[0, 0], [.15, 3], [.3, 0], [.45, 3], [.6, 0], [.75, 2], [1.1, 0]] } },
  gasp: { dur: 2.0, expr: [[0, 'surprised'], [1.6, null]], tracks: { ParamAngleY: [[0, 0], [.18, 9], [1.4, 6], [2.0, 0]], ParamBodyAngleY: [[0, 0], [.18, 4], [1.4, 2], [2.0, 0]], ParamBodyAngleZ: [[0, 0], [.2, -2], [1.5, -1], [2.0, 0]] } },
  sigh: { dur: 3.2, tracks: {
    ParamBreath: [[0, 0], [1.0, 1], [2.2, -.6], [3.2, 0]], ParamAngleY: [[0, 0], [1.0, 5], [2.2, -9], [3.2, 0]],
    ParamEyeLOpen: [[0, 0], [1.2, 0], [1.7, -.5], [2.6, -.5], [3.2, 0]], ParamEyeROpen: [[0, 0], [1.2, 0], [1.7, -.5], [2.6, -.5], [3.2, 0]],
    ParamMouthOpenY: [[0, 0], [1.4, 0], [1.7, .12], [2.3, .05], [2.6, 0]], ParamBrowLAngle: [[0, 0], [1.5, -.5], [2.8, -.5], [3.2, 0]], ParamBrowRAngle: [[0, 0], [1.5, -.5], [2.8, -.5], [3.2, 0]] } },
  think: { dur: 3.4, expr: [[0, 'thinking'], [3.0, null]], tracks: { ParamBodyAngleZ: [[0, 0], [.8, -2], [2.8, -2], [3.4, 0]] } },
  wink: { dur: 1.2, tracks: {
    ParamEyeLOpen: [[0, 0], [.1, -1], [.45, -1], [.62, 0]], ParamEyeLSmile: [[0, 0], [.1, 1], [.5, 1], [.75, 0]],
    ParamMouthForm: [[0, 0], [.1, .9], [.8, .8], [1.2, 0]], ParamAngleZ: [[0, 0], [.18, 9], [.8, 8], [1.2, 0]], ParamCheek: [[0, 0], [.2, .3], [.9, .3], [1.2, 0]], ParamBrowLY: [[0, 0], [.1, -.3], [.5, -.3], [.7, 0]] } },
  hello: { dur: 3.4, expr: [[0, 'smile'], [3.1, null]], tracks: {
    ParamGestureL: [[0, 0], [.85, 1], [1.9, 1], [3.2, 0]], ParamAngleY: [[0, 0], [.9, 0], [1.1, -8], [1.35, 1], [1.6, -4], [1.9, 0]],
    ParamAngleZ: [[0, 0], [.8, 7], [2.4, 6], [3.2, 0]], ParamBrowLY: [[0, 0], [.6, .5], [2.2, .4], [3.0, 0]], ParamBrowRY: [[0, 0], [.6, .5], [2.2, .4], [3.0, 0]] } },
  emphasis: { dur: 3.2, tracks: {
    ParamGestureL: [[0, 0], [.85, 1], [1.9, 1], [3.2, 0]], ParamAngleY: [[0, 0], [.7, -6], [1.0, 1], [1.9, 0]],
    ParamBrowLY: [[0, 0], [.6, .6], [1.9, .5], [2.8, 0]], ParamBrowRY: [[0, 0], [.6, .6], [1.9, .5], [2.8, 0]], ParamBodyAngleX: [[0, 0], [.9, 2], [2.2, 2], [3.2, 0]] } },
  glance: { dur: 2.6, tracks: { ParamEyeBallX: [[0, 0], [.1, .8], [1.9, .8], [2.05, 0]], ParamAngleX: [[0, 0], [.2, 0], [.8, 10], [1.9, 10], [2.6, 0]], ParamMouthForm: [[0, 0], [.9, .35], [1.9, .35], [2.5, 0]] } },
  speak: { dur: 3.6, tracks: {
    ParamMouthOpenY: [[0, 0], [.1, .32], [.22, .08], [.34, .28], [.46, .05], [.6, .36], [.74, .12], [.86, .22], [1.0, 0], [1.25, 0], [1.37, .3], [1.5, .1], [1.62, .34], [1.76, .06], [1.9, .26], [2.05, .1], [2.2, .3], [2.4, 0], [2.7, 0], [2.82, .28], [2.96, .1], [3.1, .24], [3.3, 0]],
    ParamAngleY: [[0, 0], [.6, -3], [1.4, 2], [2.2, -2], [3.0, 1], [3.6, 0]], ParamAngleX: [[0, 0], [1.2, 3], [2.4, -2], [3.6, 0]],
    ParamBrowLY: [[0, 0], [.55, .35], [.9, 0], [1.6, .3], [2.0, 0], [3.6, 0]], ParamBrowRY: [[0, 0], [.55, .35], [.9, 0], [1.6, .3], [2.0, 0], [3.6, 0]] } },
};

function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)); }
  return keys[keys.length - 1][1];
}

export class Performer {
  constructor({ seed = 7, life = true } = {}) {
    this.r = rng(seed); this.t = 0; this.life = life;
    this.exprW = {}; this.exprTarget = 'neutral'; this.exprFade = .35;
    this.active = []; this.overrides = {};
    this.nextBlink = 1.5 + this.r() * 2; this.blinkAt = -9; this.doubleBlink = false;
    this.nextSaccade = .8; this.eye = [0, 0]; this.eyeFrom = [0, 0]; this.eyeTo = [0, 0]; this.eyeAt = -9; this.headFollow = [0, 0];
  }
  setExpression(name, fade = .35) { if (!(name in EXPRESSIONS)) name = 'neutral'; this.exprTarget = name; this.exprFade = fade; }
  play(name, { at = this.t, scale = 1 } = {}) { const m = MOTIONS[name]; if (m) this.active.push({ m, name, start: at, scale, exprSet: new Set() }); }
  stopAll() { this.active = []; }
  update(dt) {
    this.t += dt; const t = this.t, out = { ...DEFAULTS };
    // expression cross-fade
    for (const k of Object.keys(EXPRESSIONS)) {
      const w = this.exprW[k] || 0, target = k === this.exprTarget ? 1 : 0, rate = dt / Math.max(.05, this.exprFade);
      this.exprW[k] = target > w ? Math.min(1, w + rate) : target < w ? Math.max(0, w - rate) : w;
    }
    // motions (may switch expressions at their cue times)
    const add = {};
    this.active = this.active.filter(a => {
      const lt = t - a.start; if (lt < 0) return true;
      for (const [ct, e] of a.m.expr || []) if (lt >= ct && !a.exprSet.has(ct)) { a.exprSet.add(ct); this.setExpression(e || 'neutral', .3); }
      for (const [id, keys] of Object.entries(a.m.tracks)) add[id] = (add[id] || 0) + track(keys, Math.min(lt, a.m.dur)) * a.scale;
      return lt < a.m.dur;
    });
    // idle life
    let blink = 1;
    if (this.life) {
      out.ParamBreath = .5 - .5 * Math.cos(t * 2 * Math.PI / 4.8);
      if (t >= this.nextBlink) { this.blinkAt = t; this.doubleBlink = this.r() < .14; this.nextBlink = t + 2.4 + this.r() * 3.6; }
      for (const b0 of [this.blinkAt, this.doubleBlink ? this.blinkAt + .32 : -9]) { const d = t - b0; if (d >= 0 && d < .27) blink = Math.min(blink, d < .08 ? 1 - smooth(d / .08) : d < .11 ? 0 : smooth((d - .11) / .16)); }
      if (t >= this.nextSaccade) {
        this.eyeFrom = [...this.eye]; this.eyeAt = t;
        this.eyeTo = this.r() < .35 ? [0, 0] : [(this.r() * 2 - 1) * .38, (this.r() * 2 - 1) * .2];
        this.nextSaccade = t + .7 + this.r() * 2.2;
      }
      const k = smooth((t - this.eyeAt) / .07); this.eye = [this.eyeFrom[0] + (this.eyeTo[0] - this.eyeFrom[0]) * k, this.eyeFrom[1] + (this.eyeTo[1] - this.eyeFrom[1]) * k];
      const f = 1 - Math.exp(-dt * 2.2); this.headFollow = [this.headFollow[0] + (this.eye[0] - this.headFollow[0]) * f, this.headFollow[1] + (this.eye[1] - this.headFollow[1]) * f];
      out.ParamEyeBallX += this.eye[0]; out.ParamEyeBallY += this.eye[1];
      out.ParamAngleX += 3.2 * noise(t * .27, 1) + 7 * this.headFollow[0];
      out.ParamAngleY += 2.6 * noise(t * .23, 4) + 5 * this.headFollow[1];
      out.ParamAngleZ += 3.0 * noise(t * .19, 7);
      out.ParamBodyAngleX += 1.3 * noise(t * .16, 2); out.ParamBodyAngleZ += 1.6 * noise(t * .14, 5); out.ParamBodyAngleY += .9 * (out.ParamBreath - .5);
    }
    // apply expressions
    let eyeMulL = 1, eyeMulR = 1;
    for (const [k, w] of Object.entries(this.exprW)) {
      if (!w) continue;
      for (const [id, v] of Object.entries(EXPRESSIONS[k])) {
        if (id === 'ParamEyeLOpen') eyeMulL *= 1 + (v - 1) * w; else if (id === 'ParamEyeROpen') eyeMulR *= 1 + (v - 1) * w; else out[id] += v * w;
      }
    }
    for (const [id, v] of Object.entries(add)) {
      if (id === 'ParamEyeLOpen') eyeMulL *= Math.max(0, 1 + v); else if (id === 'ParamEyeROpen') eyeMulR *= Math.max(0, 1 + v); else out[id] = (out[id] || 0) + v;
    }
    out.ParamEyeLOpen = clamp(DEFAULTS.ParamEyeLOpen * eyeMulL * blink); out.ParamEyeROpen = clamp(DEFAULTS.ParamEyeROpen * eyeMulR * blink);
    Object.assign(out, this.overrides);
    // clamp to ranges
    out.ParamEyeBallX = clamp(out.ParamEyeBallX, -1, 1); out.ParamEyeBallY = clamp(out.ParamEyeBallY, -1, 1);
    for (const id of ['ParamMouthOpenY', 'ParamCheek', 'ParamEyeLSmile', 'ParamEyeRSmile', 'ParamEyeWide', 'ParamGestureL', 'ParamBreath']) out[id] = clamp(out[id]);
    for (const id of ['ParamMouthForm', 'ParamBrowLY', 'ParamBrowRY', 'ParamBrowLAngle', 'ParamBrowRAngle']) out[id] = clamp(out[id], -1, 1);
    for (const id of ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ']) out[id] = clamp(out[id], -30, 30);
    for (const id of ['ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ']) out[id] = clamp(out[id], -10, 10);
    return out;
  }
}
