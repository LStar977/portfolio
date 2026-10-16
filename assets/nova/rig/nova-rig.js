// Nova v5 motion rig
// ------------------------------------------------------------------
// The v4 Cubism model is a stack of 23 flat four-corner cards. This rig keeps the
// authored v4 behaviour (blink, mouth, breath, hand emphasis, small tilt) by evaluating
// the original .moc3 with Cubism Core, then re-meshes every card into a dense grid and
// adds new deformers, physics, a blush layer and its own WebGL renderer on top.
// Nothing in model/ is modified at runtime.
//
// Requires Live2DCubismCore (vendor/live2dcubismcore.js) to be loaded first.

export const CONTROLS = [
  // id, min, max, default, label, group, source
  ['ParamAngleX', -30, 30, 0, 'Head turn', 'Head', 'v5'],
  ['ParamAngleY', -30, 30, 0, 'Head nod (up +)', 'Head', 'v5'],
  ['ParamAngleZ', -30, 30, 0, 'Head tilt', 'Head', 'v4+v5'],
  ['ParamEyeLOpen', 0, 1, 1, 'Left eye open', 'Eyes', 'v4'],
  ['ParamEyeROpen', 0, 1, 1, 'Right eye open', 'Eyes', 'v4'],
  ['ParamEyeBallX', -1, 1, 0, 'Look left / right', 'Eyes', 'v5'],
  ['ParamEyeBallY', -1, 1, 0, 'Look down / up', 'Eyes', 'v5'],
  ['ParamEyeLSmile', 0, 1, 0, 'Left eye smile', 'Eyes', 'v5'],
  ['ParamEyeRSmile', 0, 1, 0, 'Right eye smile', 'Eyes', 'v5'],
  ['ParamEyeWide', 0, 1, 0, 'Eyes wide', 'Eyes', 'v5'],
  ['ParamBrowLY', -1, 1, 0, 'Left brow down / up', 'Brows', 'v5'],
  ['ParamBrowRY', -1, 1, 0, 'Right brow down / up', 'Brows', 'v5'],
  ['ParamBrowLAngle', -1, 1, 0, 'Left brow worried / stern', 'Brows', 'v5'],
  ['ParamBrowRAngle', -1, 1, 0, 'Right brow worried / stern', 'Brows', 'v5'],
  ['ParamMouthOpenY', 0, 1, 0, 'Mouth open', 'Mouth', 'v4'],
  ['ParamMouthForm', -1, 1, 0, 'Frown / smile', 'Mouth', 'v5'],
  ['ParamCheek', 0, 1, 0, 'Blush', 'Mouth', 'v5'],
  ['ParamBodyAngleX', -10, 10, 0, 'Body turn', 'Body', 'v5'],
  ['ParamBodyAngleY', -10, 10, 0, 'Body bob', 'Body', 'v5'],
  ['ParamBodyAngleZ', -10, 10, 0, 'Body lean', 'Body', 'v5'],
  ['ParamBreath', 0, 1, 0, 'Breath', 'Body', 'v4'],
  ['ParamGestureL', 0, 1, 0, 'Hand emphasis', 'Body', 'v4'],
  ['ParamHairSide', -1, 1, 0, 'Hair sway (manual)', 'Physics', 'v5'],
  ['ParamWind', 0, 1, 0.3, 'Wind', 'Physics', 'v5'],
];
export const DEFAULTS = Object.fromEntries(CONTROLS.map(c => [c[0], c[3]]));
const V4_PARAMS = new Set(['ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY', 'ParamAngleZ', 'ParamBreath', 'ParamGestureL']);

// ---------- geometry of the artwork (model pixels, 1650 x 2440 canvas, rest pose) ----------
export const GEO = {
  face: [845, 605], faceR: [300, 330],          // face ellipse centre / radii in face frame
  ex: [0.995, -0.0995], ey: [0.0995, 0.995],    // face frame (her head is rolled ~5.7 degrees)
  irisL: [964, 539], irisR: [706, 566],         // L/R = Nova's left/right (viewer right/left)
  eyeL: [975, 541], eyeR: [700, 567],
  browL: [945, 458], browR: [712, 483],
  mouth: [852, 733], nose: [840, 652],
  cheekL: [1003, 604], cheekR: [690, 630],
  neck: [850, 940], hip: [840, 2700],
  emblem: [878, 1514], headAnchor: [845, 520], chestAnchor: [870, 1320],
};
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bump = r2 => r2 >= 1 ? 0 : (1 - r2) * (1 - r2);
const local = (x, y, o) => { const dx = x - o[0], dy = y - o[1]; return [dx * GEO.ex[0] + dy * GEO.ex[1], dx * GEO.ey[0] + dy * GEO.ey[1]]; };
const vec = (a, v) => [GEO.ex[0] * a + GEO.ey[0] * v, GEO.ex[1] * a + GEO.ey[1] * v]; // face-frame (along, down) -> model px

// ---------- deformer shapes: displacement (model px) per unit of control, at rest position ----------
// ctx: { hair: 0..1 hairness of the texel (Portrait_Base only), layer: drawable id }
function faceTerms(x, y, hair) {
  const [lx, ly] = local(x, y, GEO.face), rF2 = (lx / GEO.faceR[0]) ** 2 + ((ly + 15) / GEO.faceR[1]) ** 2;
  const b = bump(rF2), rigid = 1 - sstep(170, 330, ly);
  const back = hair * (1 - b) * (1 - sstep(300, 480, ly)) * sstep(0.85, 1.1, Math.sqrt(rF2)); // outer hair behind the face
  return { b, rigid, back, rF: Math.sqrt(rF2), ly };
}
const SHAPES = {
  turn(x, y, c) { // ParamAngleX / 30
    const f = faceTerms(x, y, c.hair), [nx, ny] = local(x, y, GEO.nose);
    const a = 38 * f.b + 7 * f.rigid * (1 - f.b) - 15 * f.back + 7 * bump((nx / 50) ** 2 + (ny / 44) ** 2);
    return vec(a, 0);
  },
  nod(x, y, c) { // ParamAngleY / 30, + looks up
    const f = faceTerms(x, y, c.hair), [nx, ny] = local(x, y, GEO.nose);
    return vec(0, -(24 * f.b + 5 * f.rigid * (1 - f.b)) + 9 * f.back - 5 * bump((nx / 50) ** 2 + (ny / 44) ** 2));
  },
  eyeX(x, y) { let d = 0; for (const k of ['irisL', 'irisR']) { const [lx, ly] = local(x, y, GEO[k]); d += bump((lx / 48) ** 2 + (ly / 38) ** 2); } return vec(9 * d, 0); },
  eyeY(x, y) { let d = 0; for (const k of ['irisL', 'irisR']) { const [lx, ly] = local(x, y, GEO[k]); d += bump((lx / 48) ** 2 + (ly / 38) ** 2); } return vec(0, -5.5 * d); },
  eyeSmileL(x, y) { return eyeSmile(x, y, GEO.eyeL); },
  eyeSmileR(x, y) { return eyeSmile(x, y, GEO.eyeR); },
  eyeWide(x, y) {
    let v = 0; for (const k of ['eyeL', 'eyeR']) { const [lx, ly] = local(x, y, GEO[k]); v += clamp(ly, -45, 45) * .24 * bump((lx / 85) ** 2 + (ly / 62) ** 2); }
    return vec(0, v);
  },
  browLY(x, y) { const [lx, ly] = local(x, y, GEO.browL); return vec(0, -16 * bump((lx / 95) ** 2 + (ly / 40) ** 2)); },
  browRY(x, y) { const [lx, ly] = local(x, y, GEO.browR); return vec(0, -16 * bump((lx / 95) ** 2 + (ly / 40) ** 2)); },
  browLAngle(x, y) { const [lx, ly] = local(x, y, GEO.browL); return vec(0, -12 * bump((lx / 95) ** 2 + (ly / 40) ** 2) * clamp(lx / 60, -1.3, 1.3)); },
  browRAngle(x, y) { const [lx, ly] = local(x, y, GEO.browR); return vec(0, 12 * bump((lx / 95) ** 2 + (ly / 40) ** 2) * clamp(lx / 60, -1.3, 1.3)); },
  mouthForm(x, y) {
    const [lx, ly] = local(x, y, GEO.mouth), u = lx / 50, g = bump((ly / 42) ** 2) * (1 - sstep(1.15, 1.7, Math.abs(u)));
    const corner = sstep(.15, 1, Math.abs(u)) * g;
    let [dx, dy] = vec(4 * Math.sign(u) * corner, -9 * corner + 1.5 * bump(u * u) * bump((ly / 30) ** 2));
    for (const k of ['cheekL', 'cheekR']) { const [cx, cy] = local(x, y, GEO[k]); const cb = bump((cx / 80) ** 2 + (cy / 55) ** 2); const [ax, ay] = vec(0, -3.5 * cb); dx += ax; dy += ay; }
    return [dx, dy];
  },
  bodyX(x, y, c) { const w = 1 - sstep(1150, 2440, y), front = /Emblem|Drawstring/.test(c.layer) ? 4 : 0; return [14 * (.3 + .7 * w) + front * (1 - sstep(1150, 2440, y)), 0]; },
  bodyY(x, y) { return [0, -8 * (1 - sstep(1300, 2440, y))]; },
  hairL(x, y, c) { return [hairW(x, y, c) * sstep(780, 900, x), 0]; }, // Nova's left side (viewer right)
  hairR(x, y, c) { return [hairW(x, y, c) * sstep(900, 780, x), 0]; }, // Nova's right side (viewer left)
  strL(x, y, c) { return c.layer === 'Body_Drawstring_L' ? [Math.pow(clamp((y - 1262) / 380), 1.35), 0] : [0, 0]; },
  strR(x, y, c) { return c.layer === 'Body_Drawstring_R' ? [Math.pow(clamp((y - 1262) / 363), 1.35), 0] : [0, 0]; },
};
function eyeSmile(x, y, eye) {
  const [lx, ly] = local(x, y, eye);
  const low = bump((lx / 88) ** 2 + ((ly - 30) / 44) ** 2), arc = bump((lx / 80) ** 2 + (ly / 58) ** 2) * (1 - (clamp(lx / 80, -1, 1)) ** 2);
  return vec(0, -16 * low - 5 * arc);
}
function hairW(x, y, c) {
  if (!c.hair) return 0;
  const f = faceTerms(x, y, c.hair), side = sstep(1.0, 1.28, f.rF);
  return c.hair * side * sstep(520, 900, y) * (1 - .78 * sstep(985, 1085, y));
}
const SHAPE_IDS = Object.keys(SHAPES);

// ---------- physics: damped springs driven by the motion of their anchors ----------
class Spring {
  constructor(freq, damping, gain) { this.k = (2 * Math.PI * freq) ** 2; this.c = 2 * damping * 2 * Math.PI * freq; this.gain = gain; this.x = 0; this.v = 0; }
  step(dt, accel, force) { const a = -this.k * this.x - this.c * this.v - this.gain * accel + force; this.v += a * dt; this.x += this.v * dt; }
}

// ---------- rig ----------
export async function createRig(canvas, { modelUrl, width, height, cleanup = true, spacing = { Portrait_Base: 6, eyes: 4, body: 14, strings: 7 } } = {}) {
  const C = globalThis.Live2DCubismCore; if (!C) throw Error('Live2DCubismCore not loaded');
  const url = new URL(modelUrl, location.href), spec = await (await fetch(url)).json();
  // the .moc3 can also ship base64-encoded inside a .json file, for hosts that only serve web file types
  const bytes = async f => {
    const res = await fetch(new URL(f, url));
    if (!/\.json$/i.test(f)) return res.arrayBuffer();
    const bin = atob((await res.json()).base64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  };
  const moc = C.Moc.fromArrayBuffer(await bytes(spec.FileReferences.Moc)); if (!moc) throw Error('moc3 failed to load');
  const core = C.Model.fromMoc(moc), P = core.parameters, D = core.drawables, ci = core.canvasinfo, PPU = ci.PixelsPerUnit;
  const pidx = Object.fromEntries(Array.from(P.ids, (id, i) => [id, i]));
  const toPx = (u, v) => [ci.CanvasOriginX + u * PPU, ci.CanvasOriginY - v * PPU];

  // texture (read once for alpha / hair classification, then uploaded)
  const img = new Image(); img.src = new URL(spec.FileReferences.Textures[0], url); await img.decode();
  const TS = img.width, tc = document.createElement('canvas'); tc.width = tc.height = TS;
  const tctx = tc.getContext('2d', { willReadFrequently: true }); tctx.drawImage(img, 0, 0);
  const tdata = tctx.getImageData(0, 0, TS, TS).data;
  const texel = (u, v) => { const x = Math.min(TS - 1, Math.max(0, Math.round(u * TS))), y = Math.min(TS - 1, Math.max(0, Math.round((1 - v) * TS))); return (y * TS + x) * 4; };

  // rest pose
  P.values.set(P.defaultValues); core.update();
  const layers = [];
  for (let i = 0; i < D.count; i++) {
    const id = D.ids[i], uv = D.vertexUvs[i], ix = D.indices[i];
    let u0 = 1, u1 = 0, v0 = 1, v1 = 0; for (let k = 0; k < uv.length; k += 2) { u0 = Math.min(u0, uv[k]); u1 = Math.max(u1, uv[k]); v0 = Math.min(v0, uv[k + 1]); v1 = Math.max(v1, uv[k + 1]); }
    const sp = id === 'Portrait_Base' ? spacing.Portrait_Base : /^(Eye|Mouth)/.test(id) ? spacing.eyes : /Drawstring/.test(id) ? spacing.strings : spacing.body;
    const nx = Math.max(2, Math.ceil((u1 - u0) * TS / sp) + 1), ny = Math.max(2, Math.ceil((v1 - v0) * TS / sp) + 1);
    const n = nx * ny, bary = new Float32Array(n * 3), tri = new Uint16Array(n * 3), uvs = new Float32Array(n * 2), rest = new Float32Array(n * 2);
    const rp = D.vertexPositions[i];
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      const k = gy * nx + gx, u = u0 + (u1 - u0) * gx / (nx - 1), v = v0 + (v1 - v0) * gy / (ny - 1);
      uvs[k * 2] = u; uvs[k * 2 + 1] = v;
      let best = null;
      for (let t = 0; t < ix.length; t += 3) { // barycentric in UV space; pick the containing (or nearest) triangle
        const a = ix[t], b = ix[t + 1], c = ix[t + 2], x1 = uv[a * 2], y1 = uv[a * 2 + 1], x2 = uv[b * 2], y2 = uv[b * 2 + 1], x3 = uv[c * 2], y3 = uv[c * 2 + 1];
        const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3); if (!den) continue;
        const l1 = ((y2 - y3) * (u - x3) + (x3 - x2) * (v - y3)) / den, l2 = ((y3 - y1) * (u - x3) + (x1 - x3) * (v - y3)) / den, l3 = 1 - l1 - l2, m = Math.min(l1, l2, l3);
        if (!best || m > best.m) best = { m, a, b, c, l1, l2, l3 };
      }
      tri.set([best.a, best.b, best.c], k * 3); bary.set([best.l1, best.l2, best.l3], k * 3);
      rest[k * 2] = best.l1 * rp[best.a * 2] + best.l2 * rp[best.b * 2] + best.l3 * rp[best.c * 2];
      rest[k * 2 + 1] = best.l1 * rp[best.a * 2 + 1] + best.l2 * rp[best.b * 2 + 1] + best.l3 * rp[best.c * 2 + 1];
    }
    // keep only grid cells that touch visible texels
    const cellVisible = (gx, gy) => {
      const ua = u0 + (u1 - u0) * (gx - .5) / (nx - 1), ub = u0 + (u1 - u0) * (gx + 1.5) / (nx - 1), va = v0 + (v1 - v0) * (gy - .5) / (ny - 1), vb = v0 + (v1 - v0) * (gy + 1.5) / (ny - 1);
      for (let s = 0; s <= 4; s++) for (let r = 0; r <= 4; r++) if (tdata[texel(ua + (ub - ua) * s / 4, va + (vb - va) * r / 4) + 3] > 0) return true;
      return false;
    };
    const idxs = [];
    for (let gy = 0; gy < ny - 1; gy++) for (let gx = 0; gx < nx - 1; gx++) if (cellVisible(gx, gy)) { const a = gy * nx + gx; idxs.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx); }
    // per-vertex hairness (Portrait_Base only), smoothed on the grid
    let hair = null;
    if (id === 'Portrait_Base') {
      hair = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let s = 0, cnt = 0;
        for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
          const o = texel(uvs[k * 2] + dx / TS, uvs[k * 2 + 1] + dy / TS), r = tdata[o], g = tdata[o + 1], b = tdata[o + 2], a = tdata[o + 3];
          if (a < 30) continue; cnt++;
          const lum = (r * 3 + g * 6 + b) / 10, skin = r > 170 && g > 120 && r - b < 90 ? 1 : 0;
          s += skin ? 0 : clamp((r - b - 6) / 18) * clamp((lum - 14) / 16);
        }
        hair[k] = cnt ? s / cnt : 0;
      }
      for (let it = 0; it < 4; it++) { const h2 = hair.slice(); for (let gy = 1; gy < ny - 1; gy++) for (let gx = 1; gx < nx - 1; gx++) { const k = gy * nx + gx; hair[k] = (h2[k] * 4 + h2[k - 1] + h2[k + 1] + h2[k - nx] + h2[k + nx]) / 8; } }
    }
    // bake deformer shapes as sparse blendshapes
    const shapes = {};
    for (const sid of SHAPE_IDS) {
      const vi = [], dxy = [];
      for (let k = 0; k < n; k++) {
        const [x, y] = toPx(rest[k * 2], rest[k * 2 + 1]);
        const [dx, dy] = SHAPES[sid](x, y, { hair: hair ? hair[k] : 0, layer: id });
        if (Math.abs(dx) + Math.abs(dy) > 1e-3) { vi.push(k); dxy.push(dx / PPU, -dy / PPU); }
      }
      if (vi.length) shapes[sid] = { vi: Int32Array.from(vi), d: Float32Array.from(dxy) };
    }
    const restPx = new Float32Array(n * 2); for (let k = 0; k < n; k++) { const [x, y] = toPx(rest[k * 2], rest[k * 2 + 1]); restPx[k * 2] = x; restPx[k * 2 + 1] = y; }
    layers.push({ i, id, nx, ny, n, bary, tri, uvs, restPx, index: Uint32Array.from(idxs), shapes, pos: new Float32Array(n * 2), hair });
  }

  // blush: an extra multiply layer on the cheeks, deformed with the face
  const blushTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,120,130,1)'); g.addColorStop(.35, 'rgba(255,128,138,.8)'); g.addColorStop(.7, 'rgba(255,140,150,.3)'); g.addColorStop(1, 'rgba(255,150,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; })();
  const blush = ['cheekL', 'cheekR'].map(k => {
    const nx = 13, ny = 9, n = nx * ny, restPx = new Float32Array(n * 2), uvs = new Float32Array(n * 2), idxs = [];
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const s = gx / (nx - 1), t = gy / (ny - 1), kk = gy * nx + gx; const [dx, dy] = vec((s - .5) * 210, (t - .5) * 120); restPx[kk * 2] = GEO[k][0] + dx; restPx[kk * 2 + 1] = GEO[k][1] + dy; uvs[kk * 2] = s; uvs[kk * 2 + 1] = t; if (gx < nx - 1 && gy < ny - 1) idxs.push(kk, kk + 1, kk + nx, kk + 1, kk + nx + 1, kk + nx); }
    const shapes = {}; for (const sid of SHAPE_IDS) { const vi = [], d = []; for (let q = 0; q < n; q++) { const [dx, dy] = SHAPES[sid](restPx[q * 2], restPx[q * 2 + 1], { hair: 0, layer: 'Blush' }); if (Math.abs(dx) + Math.abs(dy) > 1e-3) { vi.push(q); d.push(dx, dy); } } if (vi.length) shapes[sid] = { vi: Int32Array.from(vi), d: Float32Array.from(d) }; }
    return { id: 'Blush_' + k, n, restPx, uvs, index: Uint32Array.from(idxs), shapes, pos: new Float32Array(n * 2) };
  });

  // ---------- WebGL ----------
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw Error('WebGL2 unavailable');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p)); return p; };
  const layerProg = prog(`#version 300 es
    in vec2 aPos; in vec2 aUv; uniform mat3 uCam; uniform float uFlip; out vec2 vUv;
    void main(){ vec3 p = uCam * vec3(aPos, 1.0); gl_Position = vec4(p.xy, 0.0, 1.0); vUv = vec2(aUv.x, uFlip > 0.5 ? 1.0 - aUv.y : aUv.y); }`,
    `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uOpacity; out vec4 o;
    void main(){ o = texture(uTex, vUv) * uOpacity; }`);
  const quadVS = `#version 300 es
    in vec2 aPos; out vec2 vUv; void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const minProg = prog(quadVS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uStep; uniform int uR; uniform int uFromAlpha; out vec4 o;
    void main(){ float m = 1.0; for (int i = -12; i <= 12; i++) { if (i < -uR || i > uR) continue; vec4 s = texture(uSrc, vUv + uStep * float(i)); m = min(m, uFromAlpha == 1 ? s.a : s.r); } o = vec4(m, 0.0, 0.0, 1.0); }`);
  const finalProg = prog(quadVS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uSrc; uniform sampler2D uMin; uniform int uClean; out vec4 o;
    void main(){
      vec4 c = texture(uSrc, vUv);
      if (uClean == 1 && c.a > 0.02) {
        vec3 u = c.rgb / c.a * 255.0; float mx = max(u.r, max(u.g, u.b)), mn = min(u.r, min(u.g, u.b)), l = (u.r * 3.0 + u.g * 6.0 + u.b) / 10.0;
        bool fringe = (l > 82.0 && mx - mn < 30.0) || (l > 165.0 && mx - mn < 70.0);
        if (fringe && texture(uMin, vUv).r < 0.08) c = vec4(0.0);
      }
      o = c;
    }`);

  const mkTex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const mkTarget = (w, h) => { const tex = mkTex(w, h), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return { tex, fb, w, h }; };
  let W = width || canvas.width, H = height || canvas.height, targets;
  const resize = (w, h) => { W = canvas.width = w; H = canvas.height = h; targets = [mkTarget(w, h), mkTarget(w, h), mkTarget(w, h)]; };
  resize(W, H);

  const atlas = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlas); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  const blushGL = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blushGL); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, blushTex); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const aPos = gl.getAttribLocation(layerProg, 'aPos'), aUv = gl.getAttribLocation(layerProg, 'aUv');
  for (const L of [...layers, ...blush]) {
    L.vao = gl.createVertexArray(); gl.bindVertexArray(L.vao);
    L.posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, L.posBuf); gl.bufferData(gl.ARRAY_BUFFER, L.n * 8, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, L.uvs, gl.STATIC_DRAW); gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, L.index, gl.STATIC_DRAW);
  }
  gl.bindVertexArray(null);
  const quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao); const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (const p of [minProg, finalProg]) { const l = gl.getAttribLocation(p, 'aPos'); if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); } }
  gl.bindVertexArray(null);

  // ---------- state ----------
  const params = { ...DEFAULTS };
  const springs = { hairL: new Spring(1.35, .16, 1.15), hairR: new Spring(1.5, .17, 1.05), strL: new Spring(1.05, .11, 1.3), strR: new Spring(1.15, .12, 1.3) };
  let simTime = 0, prevHead = null, prevHeadV = [0, 0], prevChest = null, prevChestV = [0, 0];

  // analytic deformation of a single model-pixel point (used for anchors, effects and hit points)
  function amounts() {
    const p = params;
    return {
      turn: p.ParamAngleX / 30, nod: p.ParamAngleY / 30, eyeX: p.ParamEyeBallX, eyeY: p.ParamEyeBallY,
      eyeSmileL: p.ParamEyeLSmile, eyeSmileR: p.ParamEyeRSmile, eyeWide: p.ParamEyeWide,
      browLY: p.ParamBrowLY, browRY: p.ParamBrowRY, browLAngle: p.ParamBrowLAngle, browRAngle: p.ParamBrowRAngle,
      mouthForm: p.ParamMouthForm, bodyX: p.ParamBodyAngleX / 10, bodyY: p.ParamBodyAngleY / 10,
      hairL: springs.hairL.x + p.ParamHairSide * 14, hairR: springs.hairR.x + p.ParamHairSide * 14, strL: springs.strL.x, strR: springs.strR.x,
    };
  }
  const roll = () => params.ParamAngleZ * .14 * DEG, lean = () => params.ParamBodyAngleZ * .22 * DEG;
  function rotAbout(x, y, c, a, w) { if (!w || !a) return [x, y]; const s = Math.sin(a * w), co = Math.cos(a * w), dx = x - c[0], dy = y - c[1]; return [c[0] + co * dx - s * dy, c[1] + s * dx + co * dy]; }
  const rollW = y => 1 - sstep(760, 990, y);
  function deformPoint(x, y, am = amounts(), ctx = { hair: 0, layer: '' }) {
    let X = x, Y = y;
    for (const sid of SHAPE_IDS) { const a = am[sid]; if (!a) continue; const [dx, dy] = SHAPES[sid](x, y, ctx); X += dx * a; Y += dy * a; }
    [X, Y] = rotAbout(X, Y, GEO.neck, roll(), rollW(y));
    [X, Y] = rotAbout(X, Y, GEO.hip, lean(), 1);
    return [X, Y];
  }

  // physics step: springs react to their anchors' acceleration, plus a little wind
  function step(dt) {
    const sub = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / sub;
    const am = amounts(); am.hairL = am.hairR = am.strL = am.strR = 0;
    const head = deformPoint(...GEO.headAnchor, am), chest = deformPoint(...GEO.chestAnchor, am);
    const breathLift = params.ParamBreath * 3; chest[1] -= breathLift;
    if (!prevHead) { prevHead = head; prevChest = chest; }
    const hv = [(head[0] - prevHead[0]) / dt, (head[1] - prevHead[1]) / dt], cv = [(chest[0] - prevChest[0]) / dt, (chest[1] - prevChest[1]) / dt];
    const ha = [(hv[0] - prevHeadV[0]) / dt, 0], ca = [(cv[0] - prevChestV[0]) / dt, 0];
    prevHead = head; prevChest = chest; prevHeadV = hv; prevChestV = cv;
    const wind = params.ParamWind;
    for (let s = 0; s < sub; s++) {
      simTime += h; const t = simTime;
      const gust = wind * 8 * (60 * Math.sin(t * 1.3) + 34 * Math.sin(t * 2.9 + 1) + 16 * Math.sin(t * 5.3 + 2) + 30 * Math.sin(t * .47 + 4) + 9 * Math.sin(t * 8.1 + 3));
      springs.hairL.step(h, clamp(ha[0], -9000, 9000), gust);
      springs.hairR.step(h, clamp(ha[0], -9000, 9000), gust * .9 + wind * 20 * Math.sin(t * 3.7));
      springs.strL.step(h, clamp(ca[0] + ha[0] * .25, -9000, 9000), gust * .35);
      springs.strR.step(h, clamp(ca[0] + ha[0] * .25, -9000, 9000), gust * .32);
    }
    for (const k in springs) springs[k].x = clamp(springs[k].x, -28, 28);
  }

  let cam = { cx: 825, cy: 1220, s: .4, ox: W / 2, oy: H / 2, rot: 0 };
  function camMatrix(c) { // model px -> clip, column-major mat3
    const co = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), s = c.s;
    const a = s * co, b = s * sn, cc = -s * sn, d = s * co; // screen = R*s*(p - C) + O
    const tx = c.ox - (a * c.cx + cc * c.cy), ty = c.oy - (b * c.cx + d * c.cy);
    return new Float32Array([2 * a / W, -2 * b / H, 0, 2 * cc / W, -2 * d / H, 0, 2 * tx / W - 1, 1 - 2 * ty / H, 1]);
  }
  const project = (x, y, c = cam) => { const co = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), dx = (x - c.cx) * c.s, dy = (y - c.cy) * c.s; return [c.ox + co * dx - sn * dy, c.oy + sn * dx + co * dy]; };

  function evaluate() {
    P.values.set(P.defaultValues);
    for (const id of V4_PARAMS) if (id in pidx) P.values[pidx[id]] = params[id];
    core.update();
    const am = amounts(), ro = roll(), le = lean();
    for (const L of layers) {
      const v = D.vertexPositions[L.i], pos = L.pos, b = L.bary, t = L.tri, n = L.n;
      for (let k = 0; k < n; k++) {
        const a = t[k * 3], bb = t[k * 3 + 1], c = t[k * 3 + 2], l1 = b[k * 3], l2 = b[k * 3 + 1], l3 = b[k * 3 + 2];
        pos[k * 2] = l1 * v[a * 2] + l2 * v[bb * 2] + l3 * v[c * 2]; pos[k * 2 + 1] = l1 * v[a * 2 + 1] + l2 * v[bb * 2 + 1] + l3 * v[c * 2 + 1];
      }
      applyShapes(L, am, true);
      finishPx(L, ro, le, true);
      L.opacity = D.opacities[L.i];
    }
    for (const B of blush) { B.pos.set(B.restPx); applyShapes(B, am, false); finishPx(B, ro, le, false); B.opacity = clamp(params.ParamCheek) * .26; }
    return core.getRenderOrders ? core.getRenderOrders() : D.drawOrders;
  }
  function applyShapes(L, am, units) {
    for (const sid in L.shapes) { const a = am[sid]; if (!a) continue; const { vi, d } = L.shapes[sid], pos = L.pos; for (let q = 0; q < vi.length; q++) { const k = vi[q]; pos[k * 2] += d[q * 2] * a; pos[k * 2 + 1] += d[q * 2 + 1] * a; } }
  }
  function finishPx(L, ro, le, units) { // to model px, then head roll and body lean
    const pos = L.pos, r = L.restPx, n = L.n;
    const sr = Math.sin(ro), cr = Math.cos(ro), sl = Math.sin(le), cl = Math.cos(le);
    for (let k = 0; k < n; k++) {
      let x = pos[k * 2], y = pos[k * 2 + 1]; if (units) { x = ci.CanvasOriginX + x * PPU; y = ci.CanvasOriginY - y * PPU; }
      if (ro) { const w = rollW(r[k * 2 + 1]); if (w > 0) { const s = w === 1 ? sr : Math.sin(ro * w), c = w === 1 ? cr : Math.cos(ro * w), dx = x - GEO.neck[0], dy = y - GEO.neck[1]; x = GEO.neck[0] + c * dx - s * dy; y = GEO.neck[1] + s * dx + c * dy; } }
      if (le) { const dx = x - GEO.hip[0], dy = y - GEO.hip[1]; x = GEO.hip[0] + cl * dx - sl * dy; y = GEO.hip[1] + sl * dx + cl * dy; }
      pos[k * 2] = x; pos[k * 2 + 1] = y;
    }
  }

  let cleanupOn = cleanup;
  function render(camera = cam) {
    cam = { ...cam, ...camera };
    const ro = evaluate(), order = Array.from({ length: layers.length }, (_, i) => i).sort((a, b) => ro[layers[a].i] - ro[layers[b].i]);
    const M = camMatrix(cam);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0].fb); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.useProgram(layerProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(layerProg, 'uCam'), false, M);
    const uOp = gl.getUniformLocation(layerProg, 'uOpacity'), uFlip = gl.getUniformLocation(layerProg, 'uFlip');
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(gl.getUniformLocation(layerProg, 'uTex'), 0);
    const draw = (L, tex, flip) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(uFlip, flip); gl.uniform1f(uOp, L.opacity); gl.bindVertexArray(L.vao); gl.bindBuffer(gl.ARRAY_BUFFER, L.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.pos); gl.drawElements(gl.TRIANGLES, L.index.length, gl.UNSIGNED_INT, 0); };
    for (const li of order) {
      const L = layers[li]; if (L.opacity <= .001) continue;
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); draw(L, atlas, 1);
      if (L.id === 'Portrait_Base' && params.ParamCheek > .001) { gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); for (const B of blush) draw(B, blushGL, 0); }
    }
    gl.bindVertexArray(null);
    // matte cleanup: remove the light halo baked around the silhouette (distance-to-transparency via separable min)
    gl.disable(gl.BLEND); gl.bindVertexArray(quadVao);
    const R = Math.min(12, Math.ceil(3.2 * cam.s) + 2);
    gl.useProgram(minProg); gl.uniform1i(gl.getUniformLocation(minProg, 'uSrc'), 0); gl.uniform1i(gl.getUniformLocation(minProg, 'uR'), R);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].fb); gl.bindTexture(gl.TEXTURE_2D, targets[0].tex); gl.uniform2f(gl.getUniformLocation(minProg, 'uStep'), 1 / W, 0); gl.uniform1i(gl.getUniformLocation(minProg, 'uFromAlpha'), 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[2].fb); gl.bindTexture(gl.TEXTURE_2D, targets[1].tex); gl.uniform2f(gl.getUniformLocation(minProg, 'uStep'), 0, 1 / H); gl.uniform1i(gl.getUniformLocation(minProg, 'uFromAlpha'), 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.useProgram(finalProg); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, targets[2].tex); gl.uniform1i(gl.getUniformLocation(finalProg, 'uMin'), 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, targets[0].tex); gl.uniform1i(gl.getUniformLocation(finalProg, 'uSrc'), 0);
    gl.uniform1i(gl.getUniformLocation(finalProg, 'uClean'), cleanupOn ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  const layerCentroid = id => { const L = layers.find(l => l.id === id); if (!L) return null; let x = 0, y = 0; for (let k = 0; k < L.n; k++) { x += L.pos[k * 2]; y += L.pos[k * 2 + 1]; } return [x / L.n, y / L.n]; };

  return {
    canvas, gl, params, CONTROLS, DEFAULTS, GEO, layers,
    set(values) { for (const k in values) if (k in params) params[k] = values[k]; },
    reset() { Object.assign(params, DEFAULTS); for (const k in springs) { springs[k].x = springs[k].v = 0; } prevHead = prevChest = null; prevHeadV = [0, 0]; prevChestV = [0, 0]; simTime = 0; },
    step, render, resize,
    setCleanup(on) { cleanupOn = on; },
    get camera() { return cam; },
    // model-pixel point -> screen, after all deformation (uses the current parameter state)
    project(x, y, withDeform = true) { const [X, Y] = withDeform ? deformPoint(x, y) : [x, y]; return project(X, Y); },
    layerCentroid(id) { const c = layerCentroid(id); return c && project(c[0], c[1]); },
    physics: springs,
    stats() { return { layers: layers.length, vertices: layers.reduce((s, l) => s + l.n, 0), triangles: layers.reduce((s, l) => s + l.index.length / 3, 0) }; },
  };
}
