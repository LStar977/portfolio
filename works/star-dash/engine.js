/* engine.js - rendering engine for the opening.
   Everything is a pure function of time t (seconds), so the live player
   and the frame-by-frame MP4 render produce identical pictures.
   All scene coordinates are in ORIGINAL image pixels (the 1672x941 PNGs);
   the assets are 1.5x upscales, and drawCam converts. */
'use strict';
const W = 1920, H = 1080, FPS = 30, TAU = Math.PI * 2;

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const E = {
  lin: t => t,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outBack: t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
function rng(seed) { let a = (Math.floor(seed * 2654435761) >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// distance travelled when speed ramps linearly from s0 (at a) to s1 (at b), constant outside
function travelRamp(t, a, s0, b, s1) { if (t <= a) return s0 * (t - a); const d = b - a, u = Math.min(t, b) - a; let x = s0 * u + (s1 - s0) * u * u / (2 * d); if (t > b) x += s1 * (t - b); return x; }
// keyframed value: kf(t, [[t0,v0],[t1,v1],...], easing)
function kf(t, K, ez = E.inOut) { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) { const [a, va] = K[i], [b, vb] = K[i + 1]; if (t <= b) { const e = (K[i + 1][2] || ez)(seg(t, a, b)); return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], e)) : lerp(va, vb, e); } } return K[K.length - 1][1]; }

// ---------- canvases ----------
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; c.g = g; return c; }
let FRAME, TMP, PREV, SMALL, CA_R, CA_G, CA_B;
function initBuffers() { FRAME = mk(W, H); TMP = mk(W, H); PREV = mk(W, H); SMALL = mk(320, 180); CA_R = mk(W, H); CA_G = mk(W, H); CA_B = mk(W, H); }

// ---------- images ----------
const ORIG = { '00': [1536, 1024], '01': [1672, 940] };
const IMG = {};
async function loadImages(base, onProgress) {
  const ids = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  let done = 0;
  await Promise.all(ids.map(async id => {
    const el = new Image(); el.src = base + id + '.jpg'; await el.decode();
    const [sw, sh] = ORIG[id] || [1672, 941];
    IMG[id] = { id, el, sw, sh, k: el.naturalWidth / sw };
    done++; onProgress && onProgress(done / ids.length);
  }));
}

// Draw an image so original-pixel point (x,y) sits at screen centre (+dx,dy),
// at zoom z (1 = just covers the frame), rotation r. Returns a camera record
// for mapping other image points to the screen.
function camOf(id, cam) {
  const I = IMG[id], f0 = Math.max(W / I.sw, H / I.sh), r = cam.r || 0;
  const c = Math.abs(Math.cos(r)), s_ = Math.abs(Math.sin(r));
  const zmin = Math.max((W * c + H * s_) / (f0 * I.sw), (W * s_ + H * c) / (f0 * I.sh));
  const z = Math.max(cam.z || 1, zmin * 1.001), s = f0 * z;
  const hw = (W / 2 * c + H / 2 * s_) / s, hh = (W / 2 * s_ + H / 2 * c) / s;
  const x = clamp(cam.x ?? I.sw / 2, hw, I.sw - hw), y = clamp(cam.y ?? I.sh / 2, hh, I.sh - hh);
  return { id, s, x, y, r, dx: cam.dx || 0, dy: cam.dy || 0 };
}
function applyCam(g, C) { g.translate(W / 2 + C.dx, H / 2 + C.dy); g.rotate(C.r); g.scale(C.s, C.s); g.translate(-C.x, -C.y); }
function drawCam(g, id, cam, o = {}) {
  const I = IMG[id], C = camOf(id, cam);
  g.save(); applyCam(g, C); if (o.op) g.globalCompositeOperation = o.op;
  const src = o.src || I.el;
  g.globalAlpha = o.alpha ?? 1;
  g.drawImage(src, 0, 0, I.sw, I.sh);
  if (o.layers) for (const L of o.layers) { if (!L) continue; g.globalAlpha = L.alpha ?? 1; g.drawImage(L.c, L.ox || 0, L.oy || 0, L.w || I.sw, L.h || I.sh); }
  g.restore(); g.globalAlpha = 1;
  return C;
}
function mapPt(C, px, py) { const dx = (px - C.x) * C.s, dy = (py - C.y) * C.s, c = Math.cos(C.r), s = Math.sin(C.r); return [W / 2 + C.dx + dx * c - dy * s, H / 2 + C.dy + dx * s + dy * c]; }

// ---------- derived image assets ----------
function softMask(w, h, polys, k, feather) {
  const m = mk(w, h), g = m.g; g.save(); g.shadowColor = '#000'; g.shadowBlur = feather * k; g.shadowOffsetX = w + 200; g.translate(-(w + 200), 0); g.fillStyle = '#000';
  for (const P of polys) { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.closePath(); g.fill(); }
  g.restore(); return m;
}
function fgLayer(id, polys, feather) { const I = IMG[id], w = (I.el.naturalWidth || I.el.width), h = (I.el.naturalHeight || I.el.height), c = mk(w, h), g = c.g; g.drawImage(I.el, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(softMask(w, h, polys, I.k, feather), 0, 0); g.globalCompositeOperation = 'source-over'; return { c }; }
function blurCopy(id, f) { const I = IMG[id], w = (I.el.naturalWidth || I.el.width), h = (I.el.naturalHeight || I.el.height), s1 = mk(w / f, h / f), s2 = mk(w / (f * 2), h / (f * 2)); s1.g.drawImage(I.el, 0, 0, s1.width, s1.height); s2.g.drawImage(s1, 0, 0, s2.width, s2.height); const c = mk(w, h); c.g.drawImage(s2, 0, 0, w, h); return c; }
// 3-tone "impact frame" (black / crimson / bone white), classic anime hit frame
function impactOf(id) {
  const I = IMG[id], w = Math.round((I.el.naturalWidth || I.el.width) / 2), h = Math.round((I.el.naturalHeight || I.el.height) / 2), c = mk(w, h), g = c.g; g.drawImage(I.el, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const L = .3 * p[i] + .59 * p[i + 1] + .11 * p[i + 2], red = p[i] - (p[i + 1] + p[i + 2]) / 2; let r, gg, b;
    if (L > 158) { r = 255; gg = 246; b = 242; } else if (L > 82 || red > 55) { r = 196; gg = 8; b = 34; } else { r = 10; gg = 2; b = 8; } p[i] = r; p[i + 1] = gg; p[i + 2] = b; }
  g.putImageData(d, 0, 0); return c;
}
// Hair flutter: a masked region re-drawn in thin strips displaced by a travelling wave.
function makeFlutter(id, poly, feather) {
  const I = IMG[id], k = I.k; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - feather * 2); y0 = Math.max(0, y0 - feather * 2); x1 = Math.min(I.sw, x1 + feather * 2); y1 = Math.min(I.sh, y1 + feather * 2);
  const w = (x1 - x0) * k, h = (y1 - y0) * k, mask = softMask(w, h, [poly.map(([x, y]) => [x - x0, y - y0])], k, feather);
  return { id, x0, y0, w: x1 - x0, h: y1 - y0, mask, buf: mk(w, h) };
}
function flutterLayer(F, t, o) {
  const I = IMG[F.id], k = I.k, b = F.buf.g, bw = F.buf.width, bh = F.buf.height; b.globalCompositeOperation = 'copy'; b.clearRect(0, 0, bw, bh); b.globalCompositeOperation = 'source-over';
  const strip = 3;
  for (let sx = 0; sx < bw; sx += strip) {
    const xo = F.x0 + sx / k, ramp = smoothstep(o.r0, o.r1, o.axis === 'x-' ? -xo : xo);
    const dy = o.amp * ramp * (Math.sin(TAU * (xo / o.lambda) - TAU * o.freq * t) + .35 * Math.sin(TAU * (xo / (o.lambda * .43)) - TAU * o.freq * 1.7 * t + 1.3)) * k;
    b.drawImage(I.el, F.x0 * k + sx, F.y0 * k, strip + 1, bh, sx, dy, strip + 1, bh);
  }
  b.globalCompositeOperation = 'destination-in'; b.drawImage(F.mask, 0, 0); b.globalCompositeOperation = 'source-over';
  return { c: F.buf, ox: F.x0, oy: F.y0, w: F.w, h: F.h };
}

// ---------- sprites ----------
const SPR = {};
function makeSprites() {
  const glow = (rgb, stops) => { const c = mk(128, 128), g = c.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([p, a]) => gr.addColorStop(p, `rgba(${rgb},${a})`)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; };
  const std = [[0, 1], [.2, .55], [.5, .16], [1, 0]];
  SPR.white = glow('255,255,255', std); SPR.warm = glow('255,196,128', std); SPR.cool = glow('190,210,255', std); SPR.crimson = glow('255,40,70', std); SPR.gold = glow('255,214,140', std);
  SPR.soft = glow('255,255,255', [[0, .8], [1, 0]]);
  SPR.bokeh = glow('255,236,220', [[0, .5], [.72, .42], [.86, .16], [1, 0]]);
  // anamorphic streak
  const st = mk(512, 64), sg = st.g; sg.translate(256, 32); sg.scale(1, .07); const gr = sg.createRadialGradient(0, 0, 0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,230,230,.45)'); gr.addColorStop(1, 'rgba(255,200,210,0)'); sg.fillStyle = gr; sg.fillRect(-256, -460, 512, 920); SPR.streak = st;
  // rose petals: 4 shapes, sharp + defocused (160px so large petals stay crisp)
  const cols = [['#e8233f', '#6a0412', '#ff7a8a'], ['#c8122e', '#4a020c', '#ff6070'], ['#f03a55', '#7e0a1c', '#ff97a3'], ['#a90f27', '#370108', '#e0485e']];
  SPR.petal = []; SPR.petalBlur = [];
  cols.forEach((cc, v) => {
    const S = 160, c = mk(S, S), g = c.g; g.translate(S / 2, S / 2); g.rotate(v * .7); const sx = 50 + v * 4, sy = 66 - v * 3; g.scale(sx, sy);
    const p = new Path2D(); p.moveTo(0, -1); p.bezierCurveTo(.98, -1.1, 1.1, .36, .04, 1); p.bezierCurveTo(-1.04, .3, -.94, -1.04, 0, -1);
    const pg = g.createRadialGradient(-.2, -.25, .05, 0, .1, 1.2); pg.addColorStop(0, cc[0]); pg.addColorStop(.7, cc[0]); pg.addColorStop(1, cc[1]); g.fillStyle = pg; g.fill(p);
    g.save(); g.clip(p);
    const sh = g.createLinearGradient(-1, 0, 1, 0); sh.addColorStop(0, 'rgba(40,0,8,.45)'); sh.addColorStop(.35, 'rgba(40,0,8,0)'); sh.addColorStop(.75, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,200,210,.18)'); g.fillStyle = sh; g.fillRect(-1.2, -1.2, 2.4, 2.4);
    g.strokeStyle = 'rgba(90,0,14,.35)'; g.lineWidth = .025; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * .12, .95); g.quadraticCurveTo(k * .32, .1, k * .42, -.8); g.stroke(); }
    g.strokeStyle = cc[2]; g.globalAlpha = .55; g.lineWidth = .07; g.beginPath(); g.moveTo(-.62, -.55); g.quadraticCurveTo(-.1, -1.02, .55, -.72); g.stroke(); g.globalAlpha = 1;
    g.restore();
    g.strokeStyle = 'rgba(30,0,5,.55)'; g.lineWidth = .035; g.stroke(p);
    SPR.petal.push(c);
    const s1 = mk(20, 20); s1.g.drawImage(c, 0, 0, 20, 20); const b = mk(S, S); b.g.drawImage(s1, 0, 0, S, S); SPR.petalBlur.push(b);
  });
  // film grain
  SPR.grain = [0, 1, 2, 3].map(k => { const c = mk(640, 360), g = c.g, d = g.createImageData(640, 360), r = rng(900 + k); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 190; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; });
  // fog bank
  const fog = mk(2048, 512), fg = fog.g, fr = rng(55); for (let i = 0; i < 260; i++) { const x = fr() * 2048, y = 120 + fr() * 330, r = 60 + fr() * 190; const q = fg.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(210,218,235,${(.06 + fr() * .09).toFixed(3)})`); q.addColorStop(1, 'rgba(210,218,235,0)'); fg.fillStyle = q; fg.fillRect(x - r, y - r, r * 2, r * 2); }
  const edge = fg.createLinearGradient(0, 0, 2048, 0); fog.g.globalCompositeOperation = 'destination-in'; edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(.08, '#000'); edge.addColorStop(.92, '#000'); edge.addColorStop(1, 'rgba(0,0,0,0)'); fg.fillStyle = edge; fg.fillRect(0, 0, 2048, 512); fog.g.globalCompositeOperation = 'source-over'; SPR.fog = fog;
  // vignette
  const vg = mk(W, H), vv = vg.g, vgr = vv.createRadialGradient(W / 2, H / 2, H * .32, W / 2, H / 2, H * 1.02); vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(1, 'rgba(0,0,0,.72)'); vv.fillStyle = vgr; vv.fillRect(0, 0, W, H); SPR.vignette = vg;
  // light streak for wind
  const ws = mk(512, 6), wg = ws.g, wgr = wg.createLinearGradient(0, 0, 512, 0); wgr.addColorStop(0, 'rgba(255,255,255,0)'); wgr.addColorStop(.7, 'rgba(255,255,255,.9)'); wgr.addColorStop(1, 'rgba(255,255,255,0)'); wg.fillStyle = wgr; wg.fillRect(0, 2, 512, 2); SPR.wind = ws;
}

// ---------- light & particles ----------
function glowAt(g, spr, x, y, r, a, mode = 'screen') { if (a <= 0 || r <= 0) return; g.save(); g.globalCompositeOperation = mode; g.globalAlpha = Math.min(1, a); g.drawImage(SPR[spr], x - r, y - r, r * 2, r * 2); g.restore(); }
function sparkle(g, x, y, s, a, rot = 0, tint = '255,248,236') {
  if (a <= 0) return; g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, a); g.drawImage(SPR.white, x - s * 1.4, y - s * 1.4, s * 2.8, s * 2.8);
  g.translate(x, y); g.rotate(rot); g.fillStyle = `rgb(${tint})`;
  for (const [len, wd, rr] of [[2.2, .05, 0], [2.2, .05, Math.PI / 2], [1, .04, Math.PI / 4], [1, .04, -Math.PI / 4]]) { g.save(); g.rotate(rr); g.beginPath(); g.moveTo(-s * len, 0); g.lineTo(0, -s * wd * 2); g.lineTo(s * len, 0); g.lineTo(0, s * wd * 2); g.closePath(); g.fill(); g.restore(); }
  g.restore();
}
function flare(g, x, y, s, a) { if (a <= 0) return; g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, a); g.drawImage(SPR.streak, x - s * 6, y - s * .38, s * 12, s * .76); g.globalAlpha = Math.min(1, a) * .8; g.drawImage(SPR.white, x - s, y - s, s * 2, s * 2);
  const dx = W / 2 - x, dy = H / 2 - y; for (const [f, r, al] of [[.6, .18, .12], [1.1, .09, .16], [1.45, .3, .07]]) { g.globalAlpha = a * al; g.drawImage(SPR.gold, x + dx * f - s * r, y + dy * f - s * r, s * r * 2, s * r * 2); } g.restore(); }
function rays(g, x, y, o) {
  const r = rng(o.seed || 7); g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < o.n; i++) {
    const a = o.angle + (r() - .5) * o.spread + Math.sin(o.t * (.25 + r() * .4) + i * 1.7) * (o.wobble ?? .03), w = o.width * (.35 + r() * 1.3), len = o.len * (.6 + r() * .6);
    const al = o.alpha * (.35 + .65 * r()) * (.72 + .28 * Math.sin(o.t * (.8 + r() * 1.3) + i * 2.1));
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a), w0 = o.w0 ?? 2;
    const gr = g.createLinearGradient(x, y, ex, ey); gr.addColorStop(0, `rgba(${o.color},${al.toFixed(3)})`); gr.addColorStop(.55, `rgba(${o.color},${(al * .4).toFixed(3)})`); gr.addColorStop(1, `rgba(${o.color},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + nx * w0, y + ny * w0); g.lineTo(ex + nx * w, ey + ny * w); g.lineTo(ex - nx * w, ey - ny * w); g.lineTo(x - nx * w0, y - ny * w0); g.closePath(); g.fill();
  }
  g.restore();
}
function flicker(t, seed) { return .78 + .14 * Math.sin(t * 9.3 + seed * 3.1) * Math.sin(t * 5.7 + seed) + .08 * Math.sin(t * 23.1 + seed * 7.7); }
function candles(g, C, list, t, a = 1) { for (const [x, y, r] of list) { const [sx, sy] = mapPt(C, x, y), f = flicker(t, x * .013 + y * .007), rr = r * C.s; glowAt(g, 'warm', sx, sy, rr * 3.2 * (.9 + .2 * f), .5 * a * f); glowAt(g, 'white', sx, sy, rr * .9, .35 * a * f); } }
// rose petals: deterministic field (position is a closed-form function of t)
function petals(g, t, o) {
  const r = rng(o.seed || 1), lt = t - (o.t0 || 0), mX = 260, spanX = W + mX * 2, spanY = H + mX * 2;
  for (let i = 0; i < o.n; i++) {
    const z = Math.pow(r(), o.zPow || 1.7), size = lerp(o.sMin || 10, o.sMax || 46, z), spk = (.35 + .95 * z) * (.7 + .6 * r()), spd = (o.speed || 120) * spk, trav = (o.travel ?? (o.speed || 120) * lt) * spk;
    const x0 = r() * spanX, y0 = r() * spanY, ph = r() * TAU, sw = (o.sway ?? 30) * (.5 + r()), rot0 = r() * TAU, spin = (r() - .5) * 2 * (o.spin ?? 2.2), fl = 1 + r() * 2.2, v = i % 4, rr = r();
    let x = x0 + (o.vx ?? .3) * trav + Math.sin(lt * (o.swayF ?? 1.3) + ph) * sw, y = y0 + (o.vy ?? 1) * trav + Math.cos(lt * (o.swayF ?? 1.3) * .7 + ph) * sw * .6;
    x = ((x % spanX) + spanX) % spanX - mX; y = ((y % spanY) + spanY) % spanY - mX;
    if (o.region && !o.region(x, y)) continue;
    const blurred = z > (o.nearBlur ?? .84), spr = (blurred ? SPR.petalBlur : SPR.petal)[v], a = (o.alpha ?? 1) * (.45 + .55 * z) * (blurred ? .85 : 1) * (o.fade ? o.fade(x, y) : 1);
    if (a <= .01) continue;
    const rot = rot0 + lt * spin, flip = Math.max(.18, Math.abs(Math.cos(lt * fl + ph)));
    const draw = (dx, dy, al) => { g.save(); g.globalAlpha = al; g.translate(x + dx, y + dy); g.rotate(rot); g.scale(size * flip / 80, size / 80); g.drawImage(spr, -80, -80); g.restore(); };
    if (o.streak && !blurred) { const L = o.streak * spd / 200, ang = Math.atan2(o.vy ?? 1, o.vx ?? .3); draw(-Math.cos(ang) * L * 2, -Math.sin(ang) * L * 2, a * .22); draw(-Math.cos(ang) * L, -Math.sin(ang) * L, a * .45); }
    draw(0, 0, a);
  }
  g.globalAlpha = 1;
}
// petals bursting from a point (analytic drag + gravity)
function petalBurst(g, t, T, x, y, o) {
  const age = t - T; if (age < 0 || age > (o.life || 2.2)) return; const r = rng(o.seed || 3), fade = 1 - seg(age, (o.life || 2.2) * .6, o.life || 2.2);
  for (let i = 0; i < o.n; i++) { const a = r() * TAU, v = (o.v || 900) * (.3 + r() * .9), k = 2.4, d = v * (1 - Math.exp(-k * age)) / k, size = lerp(o.sMin || 14, o.sMax || 52, r()), rot = r() * TAU + age * (r() - .5) * 8, flip = Math.max(.2, Math.abs(Math.cos(age * 4 + i)));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .8 + 160 * age * age; g.save(); g.globalAlpha = fade * (o.alpha ?? 1); g.translate(px, py); g.rotate(rot); g.scale(size * flip / 80, size / 80); g.drawImage(SPR.petal[i % 4], -80, -80); g.restore(); }
  g.globalAlpha = 1;
}
function motes(g, t, o) { const r = rng(o.seed || 9); for (let i = 0; i < o.n; i++) { const x0 = r() * W, y0 = r() * H, sp = (o.speed || 18) * (.5 + r()), ph = r() * TAU, s = (o.size || 5) * (.4 + r() * 1.2), twr = 1.5 + r() * 2;
  let x = x0 + Math.sin(t * .4 + ph) * 30 + (o.vx || 0) * t, y = y0 - sp * t; y = ((y % (H + 40)) + H + 40) % (H + 40) - 20; x = ((x % W) + W) % W; if (o.region && !o.region(x, y)) continue;
  const tw = .5 + .5 * Math.sin(t * twr + ph); glowAt(g, o.spr || 'gold', x, y, s * 3, (o.alpha || .6) * tw); } }
function rain(g, t, o) { const r = rng(o.seed || 21); g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round'; for (let i = 0; i < o.n; i++) { const x0 = r() * (W + 400), y0 = r() * H, sp = 1600 + r() * 900, L = 30 + r() * 50; let y = ((y0 + sp * t) % (H + 100)) - 50, x = ((x0 + sp * .18 * t) % (W + 400)) - 200; g.strokeStyle = `rgba(200,210,235,${(o.alpha * (.3 + .7 * r())).toFixed(3)})`; g.lineWidth = .8 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + L * .18, y + L); g.stroke(); } g.restore(); }
function windLines(g, t, o) { const r = rng(o.seed || 31); g.save(); g.globalCompositeOperation = 'screen'; for (let i = 0; i < o.n; i++) { const y = r() * H, sp = (o.speed || 2600) * (.6 + r() * .8), L = 200 + r() * 500, x0 = r() * (W + 1200); const x = ((x0 + sp * t) % (W + 1200)) - 600; g.globalAlpha = (o.alpha || .35) * (.3 + .7 * r()); g.save(); g.translate(x, y + Math.sin(t * 2 + i) * 10); g.rotate(o.angle || -.08); g.drawImage(SPR.wind, 0, -1, L, 2 + r() * 2); g.restore(); } g.restore(); }
function fog(g, t, o) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = o.alpha; const w = o.w || 2600, h = o.h || 650, x = -((((t * (o.speed || 40)) % w) + w) % w); g.drawImage(SPR.fog, x, o.y, w, h); g.drawImage(SPR.fog, x + w, o.y, w, h); g.restore(); }
function speedLines(g, cx, cy, t, o) { const step = Math.floor(t * (o.rate || 15)), r = rng(step * 7 + (o.seed || 0)), R = Math.hypot(W, H); g.save(); g.fillStyle = o.color || '#fff'; g.globalAlpha = o.alpha; for (let i = 0; i < (o.n || 90); i++) { const a = r() * TAU, w = .0015 + r() * .008, r0 = (o.inner || 320) * (.75 + r() * .7); g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); g.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); g.closePath(); g.fill(); } g.restore(); }
function lightPass(g, p, o = {}) { if (p <= 0 || p >= 1) return; const ang = o.angle ?? -1.1, w = o.width || 520, L = Math.hypot(W, H), cx = lerp(-w * 1.5, W + w * 1.5, p), c = Math.cos(ang), s = Math.sin(ang); g.save(); g.globalCompositeOperation = o.mode || 'screen'; g.translate(cx, H / 2); g.rotate(ang + Math.PI / 2); const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(${o.color || '255,246,236'},${o.alpha ?? .35})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-w, -L, w * 2, L * 2); g.restore(); }
function grade(g, o) {
  if (o.tint) { g.save(); g.globalCompositeOperation = o.mode || 'soft-light'; g.globalAlpha = o.tintA ?? .3; g.fillStyle = o.tint; g.fillRect(0, 0, W, H); g.restore(); }
  if (o.tint2) { g.save(); g.globalCompositeOperation = o.mode2 || 'overlay'; g.globalAlpha = o.tint2A ?? .15; g.fillStyle = o.tint2; g.fillRect(0, 0, W, H); g.restore(); }
  if (o.dark) { g.fillStyle = `rgba(3,2,6,${o.dark.toFixed(3)})`; g.fillRect(0, 0, W, H); }
  if (o.edgeRed) { const gr = g.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, H * 1.1); gr.addColorStop(0, 'rgba(120,0,16,0)'); gr.addColorStop(1, `rgba(120,0,16,${o.edgeRed})`); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
}
function flash(g, a, col = '255,252,248') { if (a <= .003) return; g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = `rgba(${col},${Math.min(1, a).toFixed(3)})`; g.fillRect(0, 0, W, H); g.restore(); }
function blackout(g, a) { if (a <= .003) return; g.fillStyle = `rgba(0,0,0,${Math.min(1, a).toFixed(3)})`; g.fillRect(0, 0, W, H); }

// ---------- whole-frame effects (operate on the FRAME buffer) ----------
function copyTo(dst, src) { dst.g.globalCompositeOperation = 'copy'; dst.g.globalAlpha = 1; dst.g.drawImage(src, 0, 0); dst.g.globalCompositeOperation = 'source-over'; }
// Blurs run in two passes (coarse spread, then a fine spread across one coarse step), giving
// (n+1)^2 effective samples: a smooth smear instead of visible ghost copies.
function blurPass(g, n, xf) { copyTo(TMP, FRAME); g.save(); for (let k = 1; k <= n; k++) { g.globalAlpha = 1 / (k + 1); g.setTransform(1, 0, 0, 1, 0, 0); xf(g, k / n); g.drawImage(TMP, 0, 0); } g.restore(); }
function motionBlur(g, dx, dy, n = 7) { blurPass(g, n, (c, u) => c.translate(dx * u, dy * u)); blurPass(g, n, (c, u) => c.translate(dx * u / n, dy * u / n)); }
function zoomBlur(g, cx, cy, amt, n = 7) { const z = (a) => (c, u) => { const s = 1 + a * u; c.setTransform(s, 0, 0, s, cx * (1 - s), cy * (1 - s)); }; blurPass(g, n, z(amt)); blurPass(g, n, z(amt / n)); }
function spinBlur(g, ang, n = 7) { const r = (a) => (c, u) => { c.translate(W / 2, H / 2); c.rotate(a * (u - .5)); c.translate(-W / 2, -H / 2); }; blurPass(g, n, r(ang)); blurPass(g, n, r(ang / n)); }
function chroma(g, px) {
  if (px < .5) return;
  for (const [B, col] of [[CA_R, '#ff0000'], [CA_G, '#00ff00'], [CA_B, '#0000ff']]) { const b = B.g; b.globalCompositeOperation = 'copy'; b.drawImage(FRAME, 0, 0); b.globalCompositeOperation = 'multiply'; b.fillStyle = col; b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'source-over'; }
  g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(CA_G, 0, 0); g.globalCompositeOperation = 'lighter'; g.drawImage(CA_R, -px, 0); g.drawImage(CA_B, px, 0); g.restore();
}
function bloom(g, amt) {
  if (amt <= 0) return; const s = SMALL.g; s.globalCompositeOperation = 'copy'; s.drawImage(FRAME, 0, 0, 320, 180); s.globalCompositeOperation = 'multiply'; s.drawImage(SMALL, 0, 0); s.drawImage(SMALL, 0, 0); s.globalCompositeOperation = 'source-over';
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = amt; g.drawImage(SMALL, 0, 0, W, H); g.restore();
}
function grain(g, t, a) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; g.drawImage(SPR.grain[Math.floor(t * FPS) % 4], 0, 0, W, H); g.restore(); }
function letterbox(g, bar) { if (bar <= 0) return; g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar); }

// ---------- transitions ----------
let SHARDS = null;
function makeShards() { const cols = 11, rows = 7, r = rng(77), P = []; for (let j = 0; j <= rows; j++) { const row = []; for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; row.push([i / cols * W + (edge ? 0 : (r() - .5) * 120), j / rows * H + (edge ? 0 : (r() - .5) * 110)]); } P.push(row); }
  SHARDS = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i]; for (const tri of (r() < .5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]])) { const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, dx = cx - W / 2, dy = cy - H / 2, L = Math.hypot(dx, dy) || 1; SHARDS.push({ tri, cx, cy, vx: dx / L * (500 + r() * 900), vy: dy / L * (380 + r() * 700) - 200, vr: (r() - .5) * 7, vz: .8 + r() * 1.8, tint: r() < .5 ? '190,10,40' : '240,190,110', d: r() * .08 }); } } }
function shatter(g, src, age) { for (const s of SHARDS) { const p = Math.max(0, age - s.d); if (p > 1.1) continue; const sc = 1 + s.vz * p * p * 1.6, a = 1 - seg(p, .45, 1.05);
  g.save(); g.globalAlpha = a; g.translate(s.cx + s.vx * p, s.cy + s.vy * p + 500 * p * p); g.rotate(s.vr * p); g.scale(sc, sc); g.translate(-s.cx, -s.cy); g.beginPath(); g.moveTo(...s.tri[0]); g.lineTo(...s.tri[1]); g.lineTo(...s.tri[2]); g.closePath(); g.save(); g.clip(); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'overlay'; g.fillStyle = `rgba(${s.tint},.28)`; g.fill(); g.restore(); g.strokeStyle = `rgba(255,240,230,${(.75 * a).toFixed(3)})`; g.lineWidth = 2.2; g.stroke(); g.restore(); } }
function petalCurtain(g, t, T, dur, o = {}) { const p = seg(t, T - dur / 2, T + dur / 2); if (p <= 0 || p >= 1) return; const r = rng(o.seed || 41), front = lerp(-500, W + 1300, E.inOut(p));
  for (let i = 0; i < 420; i++) { const off = Math.pow(r(), 1.3) * 1300, y = r() * (H + 240) - 120, z = r(), size = 40 + z * z * 190, rot = r() * TAU + t * (r() - .5) * 4, soft = z > .55 || z < .12, v = i % 2 ? 3 : 1, ph = r() * TAU, x = front - off + Math.sin(t * 3 + i) * 30, flip = Math.max(.25, Math.abs(Math.cos(t * 5 + ph)));
    if (x < -300 || x > W + 300) continue; g.save(); g.globalAlpha = z < .12 ? .7 : 1; g.translate(x, y); g.rotate(rot); g.scale(size * flip / 80, size / 80); g.drawImage((soft ? SPR.petalBlur : SPR.petal)[v], -80, -80); g.restore(); } g.globalAlpha = 1; }
