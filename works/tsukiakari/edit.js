/* edit.js - THE EDIT, v2.
   Cuts follow the song's beats (158 BPM tracker) and the sung lyrics (aligned per character).
   Every shot is a pure function of song time t. Image coordinates are ORIGINAL pixels. */
'use strict';
var LOWQ = false;
const SONG = { title: '\u6708\u660e\u304b\u308a\u3092\u7e8f\u3063\u3066', romaji: 'TSUKIAKARI WO MATOTTE', duration: 90 };
const BEATS = [2.64,3.01,3.4,3.79,4.18,4.57,4.95,5.33,5.72,6.1,6.47,6.85,7.23,7.6,7.97,8.34,8.71,9.08,9.48,9.87,10.27,10.67,11.07,11.46,11.85,12.23,12.62,13.01,13.39,13.77,14.15,14.52,14.9,15.28,15.67,16.05,16.43,16.81,17.2,17.58,17.97,18.36,18.74,19.13,19.51,19.89,20.27,20.66,21.04,21.43,21.81,22.19,22.57,22.96,23.34,23.73,24.11,24.49,24.87,25.25,25.63,26.01,26.39,26.78,27.16,27.55,27.94,28.33,28.72,29.11,29.49,29.87,30.26,30.64,31.02,31.4,31.79,32.17,32.55,32.93,33.31,33.69,34.07,34.45,34.83,35.21,35.59,35.97,36.35,36.73,37.11,37.49,37.88,38.26,38.64,39.03,39.42,39.81,40.19,40.58,40.97,41.36,41.75,42.14,42.52,42.9,43.29,43.68,44.07,44.45,44.84,45.22,45.6,45.98,46.36,46.75,47.13,47.52,47.91,48.29,48.67,49.05,49.44,49.82,50.2,50.59,50.98,51.36,51.74,52.13,52.51,52.9,53.28,53.66,54.04,54.43,54.81,55.2,55.59,55.97,56.35,56.74,57.12,57.5,57.88,58.26,58.65,59.03,59.42,59.8,60.19,60.57,60.95,61.34,61.72,62.09,62.47,62.85,63.23,63.61,63.99,64.37,64.76,65.15,65.54,65.92,66.3,66.69,67.07,67.46,67.85,68.24,68.63,69.02,69.4,69.78,70.17,70.55,70.94,71.33,71.71,72.09,72.47,72.85,73.23,73.61,73.99,74.38,74.77,75.16,75.54,75.92,76.31,76.69,77.07,77.46,77.85,78.23,78.61,79,79.38,79.77,80.15,80.53,80.92,81.3,81.68,82.07,82.46,82.84,83.22,83.6,83.98,84.36,84.74,85.12,85.51,85.9,86.28,86.66,87.04,87.41,87.79,88.17,88.55];
const B = i => BEATS[i];

const META = {
  '01': { eyes: [[592, 318], [958, 228]] },
  '02': { moon: [557, 78], lanterns: [[548, 582, 14], [1265, 540, 16], [1005, 492, 9], [1185, 492, 9], [970, 540, 11], [1165, 540, 11]], gateLamps: [[40, 300, 26], [1640, 300, 26]] },
  '03': { moon: [1318, 60], candles: [[560, 425, 26], [1620, 385, 24], [1450, 690, 18]] },
  '05': { candles: [[60, 440, 16], [130, 545, 14], [210, 685, 14], [72, 690, 12]] },
  '06': { moon: [205, 30], candles: [[160, 452, 12], [1500, 185, 12]] },
  '07': { eyes: [[1150, 245], [1275, 215]], candles: [[20, 190, 10], [45, 182, 10], [75, 196, 10], [180, 285, 8], [205, 280, 8], [535, 265, 9], [560, 255, 9]] },
  '10': { moon: [1165, 110], eyes: [[816, 101], [851, 100]], candles: [[20, 150, 12], [65, 130, 12], [105, 160, 12], [140, 210, 10], [1535, 215, 10], [1570, 160, 12], [1610, 130, 12], [1650, 160, 12]] },
  '11': { moon: [1370, 90], candles: [[580, 215, 9], [635, 265, 9], [315, 360, 8], [355, 375, 8], [1590, 330, 9], [1545, 380, 9]] },
  '12': { window: [850, 190], eyes: [[823, 71], [850, 69]], brooch: [838, 142], candles: [[20, 420, 8], [45, 405, 8], [70, 425, 8], [290, 430, 8], [315, 418, 8], [340, 432, 8], [1335, 430, 8], [1360, 418, 8], [1385, 432, 8], [1610, 415, 8], [1640, 405, 8], [1665, 420, 8]] },
  '13': { moon: [1104, 56], moonR: 378, face: [1195, 110] },
  '14': { iris: [1326, 387], tear: [1188, 505], moon: [246, 100] },
  '15': { knot: [858, 520], lips: [855, 32] },
  '16': { fire: [1000, 455], candle: [295, 30] },
  '17': { shardBot: [862, 830], shardTop: [860, 20], eye: [855, 305], moon: [340, 70] },
  '18': { moon: [1262, 238], fist: [1170, 205] },
  '19': { moon: [1207, 55] },
  '20': { hand: [1150, 445], moon: [1468, 97] },
  '21': { window: [860, 300] },
  '22': { gem: [573, 290], needleA: [1000, 694], needleB: [1310, 612] },
  '23': { thorn: [955, 545] },
  '24': { brooch: [1000, 363] },
  '25': { handL: [500, 371], handR: [1242, 532] },
  '26': { drop: [830, 274], moon: [1457, 464] },
  '27': { eyes: [[1015, 205], [1100, 200]], candles: [[1479, 464, 14], [1426, 418, 10]], moon: [241, 46] },
  '28': { crest: [1060, 420], moon: [172, 170] },
  '29': { window: [860, 180] },
  '30': { moon: [1259, 44] },
};

// ---------- derived assets ----------
const AUX = {};
function prepareEdit() {
  AUX.plate02 = (() => { const I = IMG['02'], k = I.k, h = I.el.naturalHeight, c = mk(I.el.naturalWidth, h), g = c.g; g.drawImage(I.el, 0, 0);
    const side = (sx0, sw0, dx0, dw0, dir) => { const t = mk(dw0 * k, h), tg = t.g; tg.drawImage(I.el, sx0 * k, 0, sw0 * k, h, 0, 0, dw0 * k, h);
      const m = tg.createLinearGradient(dir < 0 ? dw0 * k : 0, 0, dir < 0 ? 0 : dw0 * k, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(.25, 'rgba(0,0,0,.35)'); m.addColorStop(1, 'rgba(0,0,0,.72)'); tg.fillStyle = m; tg.fillRect(0, 0, dw0 * k, h);
      const f = mk(dw0 * k, h), fg2 = f.g; fg2.drawImage(t, 0, 0); fg2.globalCompositeOperation = 'destination-in'; const fm = fg2.createLinearGradient(dir < 0 ? dw0 * k : 0, 0, dir < 0 ? dw0 * k - 70 * k : 70 * k, 0); fm.addColorStop(0, 'rgba(0,0,0,0)'); fm.addColorStop(1, '#000'); fg2.fillStyle = fm; fg2.fillRect(0, 0, dw0 * k, h);
      g.drawImage(f, dx0 * k, 0); };
    side(330, 110, 0, 345, -1); side(1240, 110, 1335, 337, 1); return c; })();
  AUX.fg02 = fgLayer('02', [[[0, 0], [322, 0], [322, 941], [0, 941]], [[1356, 0], [1672, 0], [1672, 941], [1356, 941]]], 5);
  AUX.blur05 = blurCopy('05', 10);
  AUX.flut07 = makeFlutter('07', [[930, 520], [700, 540], [420, 560], [120, 590], [0, 620], [0, 941], [880, 941], [930, 800]], 40);
  AUX.flut03 = makeFlutter('03', [[980, 170], [860, 250], [760, 360], [690, 470], [700, 540], [800, 520], [900, 420], [1000, 330]], 30);
  IMG['01'].impact = impactOf('01');
  AUX.fire16 = glowMap('16', fireFn, 5); AUX.fire19 = glowMap('19', fireFn, 5);
  AUX.red28 = glowMap('28', redFn, 4); AUX.win12 = glowMap('12', brightFn, 8); AUX.win21a = glowMap('21a', brightFn, 8); AUX.win29 = glowMap('29c', brightFn, 8);
  AUX.moon18b = glowMap('18b', brightFn, 6); AUX.moon13 = glowMap('13', brightFn, 7);
  makeShards();
}

// ---------- helpers ----------
function beatIdx(t) { let lo = 0, hi = BEATS.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (BEATS[m] <= t) { a = m; lo = m + 1; } else hi = m - 1; } return a; }
function pulse(t, decay = 9) { const i = beatIdx(t); return i < 0 ? 0 : Math.exp(-(t - BEATS[i]) * decay); }
const bp = (t, amt) => 1 + amt * pulse(t);
const fl = (t, a = 1, s = 0) => ({ dx: a * (Math.sin(t * .53 + s) * 7 + Math.sin(t * 1.31 + s * 2) * 2.5), dy: a * (Math.cos(t * .47 + s) * 5 + Math.sin(t * 1.13 + s) * 2), r: a * .0022 * Math.sin(t * .61 + s) });
const cam = (x, y, z, r = 0, f) => ({ x, y, z, r: r + (f ? f.r : 0), dx: f ? f.dx : 0, dy: f ? f.dy : 0 });
const tremble = (t, a) => ({ dx: a * (Math.sin(t * 61) * .6 + Math.sin(t * 37) * .4), dy: a * (Math.cos(t * 53) * .6 + Math.sin(t * 29) * .4), r: 0 });
const addF = (f1, f2) => ({ dx: f1.dx + f2.dx, dy: f1.dy + f2.dy, r: f1.r + f2.r });
const glint = (t, T, w = 6) => Math.exp(-Math.abs(t - T) * w) * (t > T - .35 ? 1 : 0);
const faceGuard = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1;
const faceAt = (C, fx, fy, rx, ry) => { const p = mapPt(C, fx, fy); return faceGuard(p[0], p[1], rx * C.s, ry * C.s); };
function letterSpaced(g, s, x, y, sp) { let w = 0; for (const ch of s) w += g.measureText(ch).width + sp; w -= sp; let cx = x - w / 2; const al = g.textAlign; g.textAlign = 'left'; for (const ch of s) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } g.textAlign = al; }
function glowLayer(g, id, C, canvas, a, op = 'screen') { if (a <= 0) return; drawCam(g, id, { x: C.x, y: C.y, z: C.s / Math.max(W / IMG[id].sw, H / IMG[id].sh), r: C.r, dx: C.dx, dy: C.dy }, { src: canvas, alpha: Math.min(1, a), op }); }
function heroFX(g, C, t, a = 1) {
  const w = mapPt(C, 850, 190); rays(g, w[0], w[1], { n: 26, len: 2100, spread: TAU, angle: t * .08, width: 60, alpha: .11 * a, color: '255,215,215', t, seed: 16, wobble: .02 });
  glowAt(g, 'crimson', w[0], w[1], 520 * C.s / 1.2, .25 * a); glowAt(g, 'white', w[0], w[1], 380 * C.s / 1.2, .22 * a);
  candles(g, C, META['12'].candles, t, 1.1); motes(g, t, { n: 40, seed: 31, speed: 14, size: 3.5, alpha: .5, spr: 'gold' });
}

// Vertical title logo: \u6708\u660e\u304b\u308a\u3092\u7e8f\u3063\u3066
function drawTitle(g, t, T0, o) {
  const chars = [...SONG.title], size = o.size, step = size * 1.1, x = o.x, y0 = o.y, out = o.outAt ? seg(t, o.outAt, o.outAt + .35) : 0;
  if (t < T0 || out >= 1) return;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  { const ba = seg(t, T0, T0 + .5) * (1 - out) * (o.backing ?? .62), gx0 = x - size * 2.7, gx1 = x + size * 2.1, bg = g.createLinearGradient(gx0, 0, gx1, 0); bg.addColorStop(0, 'rgba(4,2,6,0)'); bg.addColorStop(.45, `rgba(4,2,6,${ba.toFixed(3)})`); bg.addColorStop(.62, `rgba(4,2,6,${ba.toFixed(3)})`); bg.addColorStop(1, 'rgba(4,2,6,0)'); g.fillStyle = bg; g.fillRect(gx0, 0, gx1 - gx0, H); }
  glowAt(g, 'soft', x, y0 + step * 3.6, 460, .1 * (1 - out));
  const rp = E.out(seg(t, T0, T0 + .9)); g.fillStyle = `rgba(236,206,150,${(.8 * (1 - out)).toFixed(3)})`; g.fillRect(x - size * .95, y0 - size * .55, 1.6, step * 8 * rp); g.fillRect(x + size * .78, y0 + step * 8 * (1 - rp) - size * .55, 1, step * 8 * rp);
  g.font = `800 ${size}px ${JP}`;
  chars.forEach((ch, i) => {
    const ct = T0 + .08 + i * .075, a = seg(t, ct, ct + .35) * (1 - out); if (a <= 0) return;
    const small = ch === '\u3063', yy = y0 + i * step + (1 - E.out(seg(t, ct, ct + .5))) * size * .45 + (small ? -size * .2 : 0), xx = x + (small ? size * .18 : 0);
    const shimmer = o.shimmer ? Math.exp(-Math.abs((t - o.shimmer) * 8 - i * .6)) : 0;
    g.save(); g.globalAlpha = a; g.shadowColor = i === 0 ? 'rgba(255,40,80,.95)' : 'rgba(255,236,236,.85)'; g.shadowBlur = size * (.12 + .7 * (1 - seg(t, ct, ct + .6)) + .5 * shimmer);
    g.fillStyle = i === 0 ? '#ff2a4c' : '#f7f0ee'; g.fillText(ch, xx, yy); if (shimmer > .05) { g.globalCompositeOperation = 'screen'; g.globalAlpha = a * shimmer; g.fillStyle = '#fff'; g.fillText(ch, xx, yy); } g.restore();
  });
  const ra = seg(t, T0 + (o.romajiAt ?? 1.3), T0 + (o.romajiAt ?? 1.3) + .6) * (1 - out);
  if (ra > 0) { g.save(); g.globalAlpha = ra; g.translate(x - size * 1.35, y0 + step * 3.5); g.rotate(Math.PI / 2); g.font = `600 ${Math.round(size * .2)}px ${LATIN}`; g.fillStyle = '#e8d2a6'; letterSpaced(g, SONG.romaji, 0, 0, size * .11); g.restore(); }
  if (o.ring) for (const T of o.ring) { const age = t - T; if (age < 0 || age > 1.2) continue; const r = 40 + age * 900, a = (1 - age / 1.2) * .9 * (1 - out); g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = `rgba(255,60,90,${a.toFixed(3)})`; g.lineWidth = 3 + 10 * (1 - age); g.beginPath(); g.arc(x, y0, r, 0, TAU); g.stroke(); g.strokeStyle = `rgba(255,230,200,${(a * .6).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y0, r * .8, 0, TAU); g.stroke(); g.restore(); }
  if (o.disperse && t > o.disperse) { const age = t - o.disperse; chars.forEach((_, i) => { const r = rng(i * 13 + 5); for (let k = 0; k < 7; k++) { const ang = r() * TAU, sp = 40 + r() * 140, rs = 60 + r() * 160, sz = 10 + r() * 14; glowAt(g, 'gold', x + Math.cos(ang) * sp * age, y0 + i * step - rs * age + Math.sin(ang) * sp * age * .3, sz, (1 - seg(age, .1, .6)) * .9); } }); }
  g.restore();
}
// Full-screen kanji cards on the pre-chorus beats
function kanjiCard(g, t, T, ch, style) {
  const lt = t - T, s = 1 + .14 * Math.exp(-lt * 9), cx = W / 2, cy = H / 2;
  g.save();
  if (style === 'chain') { drawCam(g, '15a', cam(860, 500, 2.3 + .1 * lt)); g.fillStyle = 'rgba(6,2,5,.74)'; g.fillRect(0, 0, W, H); }
  else { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#4d000d'); gr.addColorStop(.5, '#b5001f'); gr.addColorStop(1, '#2e0007'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 560px ${JP}`;
  if (style === 'chain') { g.shadowColor = 'rgba(255,30,70,.9)'; g.shadowBlur = 60; g.fillStyle = '#f7f0ee'; g.fillText(ch, cx, cy + 14); }
  else { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; g.fillStyle = '#0a0204'; g.fillText(ch, cx, cy + 14); }
  g.restore();
  if (style === 'cut') { const p = E.outExpo(seg(lt, 0, .12)); g.save(); g.strokeStyle = '#fff4f0'; g.lineWidth = 10; g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 30; g.beginPath(); g.moveTo(W * (.08), H * (.86)); g.lineTo(lerp(W * .08, W * .92, p), lerp(H * .86, H * .14, p)); g.stroke(); g.restore(); }
  g.fillStyle = '#b3001e'; g.fillRect(W - 180, H - 180, 70, 70); g.font = `800 50px ${JP}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, W - 145, H - 143);
}
// Pose snap over a graphic card: 2 impact frames, then the pose with a pop and a slow float
function poseSnap(g, t, T, o) {
  const lt = t - T, sp = { ...o.sp };
  if (lt >= 0 && lt < 2 / FPS) { g.fillStyle = '#f3ece6'; g.fillRect(0, 0, W, H); speedLines(g, sp.x, H * .42, t, { n: 150, inner: 230, alpha: .95, color: '#0a0406', seed: 3, rate: 30 }); drawSprite(g, o.id, { ...sp, impact: true }); return; }
  card(g, t, o.card, o.cardOpts || {});
  if (o.mark) kanjiMark(g, o.mark, o.markX ?? sp.x, o.markY ?? H * .5, o.markSize ?? 880, { color: o.markCol || '#fff', alpha: o.markA ?? .4, lw: 5, rot: o.markRot || 0 });
  if (o.under) o.under(g, t);
  const pop = 1 + .07 * Math.exp(-lt * 11), bob = Math.sin(lt * 2.4) * 6;
  g.save(); g.translate(sp.x, H * .5); g.scale(pop, pop); g.translate(-sp.x, -H * .5 + bob); drawSprite(g, o.id, sp); g.restore();
  if (o.over) o.over(g, t);
}
function faceCut(g, t, id, o = {}) {
  const bg = g.createRadialGradient(W / 2, H * .42, 40, W / 2, H / 2, W * .7); bg.addColorStop(0, '#16111f'); bg.addColorStop(1, '#020104'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const R = (o.ring || 360) * (1 + .03 * Math.sin(t * 3)); g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = 'rgba(210,222,255,.55)'; g.lineWidth = 3; g.shadowColor = 'rgba(190,210,255,.9)'; g.shadowBlur = 30; g.beginPath(); g.arc(W / 2, H * .41, R, 0, TAU); g.stroke(); g.restore();
  glowAt(g, 'cool', W / 2, H * .41, R * 1.4, .35);
  return drawSprite(g, id, { anchor: 'pt', ax: 620, ay: 470, x: W / 2, y: o.y ?? 500, scale: o.scale ?? 1.28, glow: .3 });
}

// ---------- the shots ----------
const SHOTS = [];
const shot = (t, name, draw) => SHOTS.push({ t, name, draw });

// 00:00 COLD OPEN - her gaze; the letterbox opens like eyelids
shot(0, 'The gaze', (g, t) => {
  const k = E.inOut(seg(t, 0, 2.3)), pre = E.inExpo(seg(t, 2.25, 2.64));
  let x = lerp(772, 780, k), y = lerp(282, 276, k), z = lerp(1.26, 1.36, k); z *= 1 + pre * .6; x = lerp(x, 958, pre); y = lerp(y, 232, pre);
  const C = drawCam(g, '01', cam(x, y, z, 0, fl(t, .5)));
  lightPass(g, seg(t, .3, 2.05), { angle: -1.25, width: 240, alpha: .3, color: '225,232,255' });
  const e1 = mapPt(C, 592, 318), e2 = mapPt(C, 958, 228), gl = glint(t, 1.9, 5);
  sparkle(g, e2[0] - 5, e2[1] - 9, 24 * gl + 1, gl, .3); sparkle(g, e1[0] + 4, e1[1] - 8, 18 * gl, gl * .8, -.2);
  petals(g, t, { n: 12, seed: 3, speed: 38, vx: .25, vy: .6, sMin: 10, sMax: 44, alpha: .85, nearBlur: .7, region: (px, py) => px < 380 || px > 1560 || py < 150 });
  motes(g, t, { n: 16, seed: 4, speed: 10, size: 3, alpha: .35, spr: 'cool' });
  grade(g, { tint: '#4a5f8a', tintA: .28, dark: .6 * (1 - E.out(seg(t, 0, 1.5))) });
  letterbox(g, lerp(H / 2, 132, E.out(seg(t, .05, 1.35))));
});
// 00:02.64 INTRO BURST - crash out from the moon, dolly through the gates
shot(B(0), 'The threshold', (g, t) => {
  const c1 = E.outExpo(seg(t, 2.64, 3.5)), d = E.inOut(seg(t, 3.25, 6.1));
  let x = lerp(560, 836, c1), y = lerp(96, 470, c1), z = lerp(2.15, 1.03, c1); z *= lerp(1, 1.2, d) * bp(t, .012); x = lerp(x, 845, d * .6); y = lerp(y, 560, d * .5);
  const f = fl(t, .5, 1), bgc = cam(x, y, z, 0, f), C = drawCam(g, '02', bgc, { src: AUX.plate02 });
  const m = mapPt(C, 557, 78); glowAt(g, 'cool', m[0], m[1], 170 * C.s / 1.2, .6); rays(g, m[0], m[1], { n: 8, len: 900, spread: 1.2, angle: 1.2, width: 60, alpha: .1, color: '200,212,240', t, seed: 3 });
  candles(g, C, META['02'].lanterns, t, 1); fog(g, t, { y: 560, h: 520, alpha: .42, speed: 70 });
  const Cf = drawCam(g, '02', { ...bgc, z: z * lerp(1, 1.36, d) }, { src: AUX.fg02.c }); candles(g, Cf, META['02'].gateLamps, t, 1);
  rain(g, t, { n: 150, alpha: .22 });
  for (const T of [B(3), B(7)]) { const a = t >= T ? .5 * Math.exp(-(t - T) * 9) + .35 * (t >= T + .1 ? Math.exp(-(t - T - .1) * 12) : 0) : 0; flash(g, a, '215,225,255'); }
  grade(g, { tint: '#3f5078', tintA: .3, dark: .2 * E.in(seg(t, 5.8, 6.1)) });
});
// 00:06.10 \u767d\u3068\u7d05\u306e\u9aea\u3000\u6708\u3092\u88c2\u3044\u3066 - her hair across the moon
shot(B(9), 'Moon hair', (g, t) => {
  const k = E.inOut(seg(t, 6.1, 9.3)), k2 = E.inOut(seg(t, 9.3, 10.67));
  const x = lerp(lerp(560, 980, k), 1080, k2), y = lerp(lerp(640, 330, k), 250, k2), z = lerp(lerp(1.62, 1.14, k), 1.26, k2);
  const C = drawCam(g, '13', cam(x, y, z, 0, fl(t, .45, 60)));
  glowLayer(g, '13', C, AUX.moon13, .22 + .5 * glint(t, 9.24, 2.5) + .12 * pulse(t, 6));
  const m = mapPt(C, 1104, 120); glowAt(g, 'cool', m[0], m[1], 620 * C.s / 1.2, .3 + .25 * glint(t, 9.24, 3));
  rays(g, m[0], m[1] - 80, { n: 12, len: 1700, spread: 2.6, angle: 1.9, width: 70, alpha: .08, color: '210,222,255', t, seed: 7 });
  windLines(g, t, { n: 10, speed: 1600, alpha: .16, angle: -.35 });
  petals(g, t, { n: 26, seed: 61, travel: (t - 6.1) * 380, vx: 1, vy: -.42, sMin: 8, sMax: 40, alpha: .9, region: faceAt(C, 1195, 110, 70, 90) });
  motes(g, t, { n: 24, seed: 62, speed: 9, size: 3, alpha: .4, spr: 'cool' });
  grade(g, { tint: '#46598a', tintA: .26 });
  slashLine(g, seg(t, 10.5, 10.67), { angle: -.55, cx: W * .55, cy: H * .42 });
});
// 00:10.67 TITLE - the full reveal, logo in the dark left of the frame
shot(B(21), 'Title', (g, t) => {
  const k = E.inOut(seg(t, 10.67, 12.55)), x = lerp(1120, 836, k), y = lerp(760, 470, k), z = lerp(1.78, 1.02, k) * lerp(1, 1.05, seg(t, 12.55, 14.15));
  const C = drawCam(g, '03', cam(x, y, z * bp(t, .006), 0, fl(t, .45, 3)), { layers: [flutterLayer(AUX.flut03, t, { amp: 3, lambda: 320, freq: .5, r0: -1000, r1: -760, axis: 'x-' })] });
  candles(g, C, META['03'].candles, t, 1);
  const m = mapPt(C, 1318, 60); glowAt(g, 'cool', m[0], m[1], 110 * C.s, .45); flare(g, m[0], m[1], 70 * C.s, .22);
  petals(g, t, { n: 22, seed: 11, speed: 55, vx: -.35, vy: .8, sMin: 8, sMax: 36, alpha: .9, region: faceAt(C, 1172, 82, 42, 52) });
  lightPass(g, seg(t, 10.67, 11.6), { angle: -1.4, width: 420, alpha: .28 });
  grade(g, { tint: '#4b5a86', tintA: .2 });
  drawTitle(g, t, 11.36, { x: 330, y: 176, size: 86, ring: [11.36, 12.62], shimmer: 13.0, romajiAt: 1.0, outAt: 13.9, disperse: 13.72, backing: .66 });
});
// 00:14.15 \u91d1\u8272\u306e\u77b3\u306b\u3000\u96a0\u3057\u305f\u6d99 - the tear
shot(B(30), 'Golden tear', (g, t) => {
  const k = E.inOut(seg(t, 14.15, 17.2)), C = drawCam(g, '14', cam(lerp(1160, 1290, k), lerp(430, 405, k), lerp(1.12, 1.52, k), 0, fl(t, .4, 61)));
  const ir = mapPt(C, ...META['14'].iris), gi = glint(t, 14.66, 4); sparkle(g, ir[0] - 10, ir[1] - 14, 34 * gi, gi, .3);
  const te = mapPt(C, ...META['14'].tear), gt = glint(t, 16.38, 3.5); sparkle(g, te[0], te[1], 30 * gt, gt, -.2, '230,240,255'); glowAt(g, 'cool', te[0], te[1], 90, .35 * gt);
  const mo = mapPt(C, ...META['14'].moon); glowAt(g, 'cool', mo[0], mo[1], 180, .45);
  lightPass(g, seg(t, 15.6, 16.9), { angle: -1.1, width: 320, alpha: .16, color: '230,236,255' });
  motes(g, t, { n: 18, seed: 63, speed: 6, size: 3, alpha: .35, spr: 'cool', region: (x) => x < W * .45 });
  grade(g, { tint: '#4b5680', tintA: .18 });
});
// 00:17.20 \u8a87\u308a\u306e\u4eee\u9762\u3067\u3000\u50b7\u3092\u7e2b\u3046 - the mask, then the stitch
shot(B(38), 'Mask', (g, t) => {
  const k = E.inOut(seg(t, 17.2, 18.74)), C = drawCam(g, '22', cam(lerp(520, 600, k), lerp(430, 410, k), lerp(1.16, 1.27, k), 0, fl(t, .4, 62)));
  const gm = mapPt(C, ...META['22'].gem), gg = glint(t, 17.94, 5); sparkle(g, gm[0], gm[1], 40 * gg, gg, .2, '255,210,200');
  glowAt(g, 'warm', mapPt(C, 150, 80)[0], mapPt(C, 150, 80)[1], 240, .35 * flicker(t, 1));
  lightPass(g, seg(t, 17.3, 18.6), { angle: -.9, width: 300, alpha: .18, color: '255,220,200' });
  grade(g, { tint: '#5a3042', tintA: .12 });
});
shot(B(42), 'Stitch', (g, t) => {
  const k = E.inOut(seg(t, 18.74, 20.27)), C = drawCam(g, '22', cam(lerp(1080, 1110, k), lerp(690, 670, k), lerp(1.9, 2.08, k), 0, fl(t, .35, 63)));
  const a = mapPt(C, ...META['22'].needleA), b = mapPt(C, ...META['22'].needleB); glintLine(g, a[0], a[1], b[0], b[1], seg(t, 19.8, 20.2), { size: 34, w: 4, tail: 200 });
  grade(g, { tint: '#5a3042', tintA: .12 });
});
// 00:20.27 \u6563\u3063\u305f\u7d05\u3044\u82b1\u3000\u6307\u306b\u523a\u3055\u308a - the rose, then the thorn
shot(B(46), 'The rose', (g, t) => {
  const k = E.inOut(seg(t, 20.27, 21.81)), cm = cam(lerp(560, 610, k), lerp(420, 400, k), lerp(1.1, 1.2, k), 0, fl(t, .4, 5));
  const C = drawCam(g, '05', cm); const fb = 1 - E.out(seg(t, 20.27, 20.9)); if (fb > .01) drawCam(g, '05', cm, { src: AUX.blur05, alpha: fb });
  candles(g, C, META['05'].candles, t, 1);
  for (const [x, y, T] of [[1465, 75, 20.44], [1250, 490, 20.84], [1455, 160, 21.3]]) { const gl = glint(t, T, 7), p = mapPt(C, x, y); sparkle(g, p[0], p[1], 34 * gl, gl, .4, '255,225,180'); }
  petals(g, t, { n: 16, seed: 12, speed: 60, vx: .2, vy: .9, sMin: 14, sMax: 76, alpha: .95, nearBlur: .7 });
  grade(g, { tint: '#6a3040', tintA: .12 });
});
shot(B(50), 'Thorn', (g, t) => {
  const k = E.inOut(seg(t, 21.81, 23.34)), C = drawCam(g, '23', cam(lerp(1010, 1000, k), lerp(520, 540, k), lerp(1.32, 1.52, k), 0, fl(t, .35, 64)));
  const th = mapPt(C, ...META['23'].thorn), gt = glint(t, 22.46, 6); sparkle(g, th[0], th[1], 36 * gt, gt, .5, '255,235,225'); glowAt(g, 'crimson', th[0], th[1], 120, .45 * gt);
  candles(g, C, [[1530, 60, 20], [1620, 140, 16]], t, .8);
  petals(g, t, { n: 10, seed: 13, speed: 40, vx: .15, vy: .9, sMin: 16, sMax: 60, alpha: .85, nearBlur: .7 });
  grade(g, { tint: '#6a3040', tintA: .12 });
});
// 00:23.34 \u623b\u308c\u306a\u3044\u8a93\u3044\u3092\u3000\u307e\u3060\u62b1\u304f - she looks back, then holds the vow
const flut07 = t => flutterLayer(AUX.flut07, t, { amp: 4.5, lambda: 420, freq: .55, r0: -900, r1: -350, axis: 'x-' });
shot(B(54), 'The glance', (g, t) => {
  const k = E.inOut(seg(t, 23.34, 24.87)), C = drawCam(g, '07', cam(lerp(1060, 1190, k), lerp(420, 270, k), lerp(1.22, 1.6, k), 0, fl(t, .5, 7)), { layers: [flut07(t)] });
  candles(g, C, META['07'].candles, t, .9);
  const gl = glint(t, 23.66, 5); META['07'].eyes.forEach(([x, y], i) => { const p = mapPt(C, x, y); sparkle(g, p[0] + 3, p[1] - 6, 24 * gl, gl * (i ? 1 : .8), .3); });
  motes(g, t, { n: 24, seed: 14, speed: 8, size: 3, alpha: .35, spr: 'warm' });
  grade(g, { tint: '#5a4050', tintA: .14 });
});
shot(B(58), 'Vow', (g, t) => {
  const k = E.inOut(seg(t, 24.87, 26.01)), C = drawCam(g, '24', cam(lerp(960, 990, k), lerp(380, 360, k), lerp(1.16, 1.3, k), 0, fl(t, .35, 65)));
  const br = mapPt(C, ...META['24'].brooch), gb = glint(t, 25.38, 5); sparkle(g, br[0], br[1], 44 * gb, gb, .2, '255,215,190'); glowAt(g, 'crimson', br[0], br[1], 140, .4 * gb);
  const mo = mapPt(C, 370, 60); glowAt(g, 'cool', mo[0], mo[1], 200, .4);
  petals(g, t, { n: 10, seed: 15, speed: 45, vx: -.2, vy: .8, sMin: 12, sMax: 50, alpha: .85, region: faceAt(C, 905, 60, 110, 90) });
  grade(g, { tint: '#4b5680', tintA: .18 });
});
// 00:26.01 \u8ab0\u304b\u304c\u6c7a\u3081\u305f\u904b\u547d\u306a\u3089 - seen from above, then the strings of fate
function ballroomFX(g, C, t, a = 1) {
  const src = mapPt(C, 180, -260), q = mapPt(C, 520, 700), ang = Math.atan2(q[1] - src[1], q[0] - src[0]);
  rays(g, src[0], src[1], { n: 9, len: 2200, spread: .5, angle: ang, width: 110, alpha: .12 * a, color: '205,218,255', t, seed: 9 });
  const m = mapPt(C, 205, 30); glowAt(g, 'cool', m[0], m[1], 190, .45 * a); candles(g, C, META['06'].candles, t, 1);
  motes(g, t, { n: 30, seed: 20, speed: 9, size: 3, alpha: .4, spr: 'cool' });
}
shot(B(61), 'Ballroom', (g, t) => {
  const k = E.out(seg(t, 26.01, 28.33)), C = drawCam(g, '06', cam(lerp(1190, 1000, k), lerp(540, 480, k), lerp(2.05, 1.22, k), lerp(-.42, -.03, k), fl(t, .4, 10)));
  ballroomFX(g, C, t); grade(g, { tint: '#44557f', tintA: .26 });
});
shot(B(67), 'Strings', (g, t) => {
  const k = E.inOut(seg(t, 28.33, 31.4)), C = drawCam(g, '25', cam(lerp(830, 800, k), lerp(560, 300, k), lerp(1.12, 1.34, k), 0, fl(t, .4, 66)));
  const src = mapPt(C, 200, -200); rays(g, src[0], src[1], { n: 10, len: 2400, spread: .45, angle: .9, width: 90, alpha: .13, color: '205,218,255', t, seed: 19 });
  for (const [hx, hy, T] of [[...META['25'].handL, 29.3], [...META['25'].handR, 30.26]]) { const p = mapPt(C, hx, hy), gg = glint(t, T, 3); sparkle(g, p[0], p[1], 40 * gg, gg, .3, '235,240,255'); glintLine(g, p[0] + (hx < 800 ? -30 : 40), 0, p[0], p[1], seg(t, T - .45, T + .05), { size: 20, w: 2.5, tail: 300 }); }
  candles(g, C, [[20, 560, 10], [50, 540, 10], [1625, 560, 10]], t, .9);
  motes(g, t, { n: 30, seed: 21, speed: 7, size: 3, alpha: .4, spr: 'cool' });
  grade(g, { tint: '#44557f', tintA: .24 });
});
// 00:31.40 \u3053\u306e\u624b\u3067\u9396\u3092\u65ad\u3061\u5207\u308b - bound, straining; the kanji cards; the breath
shot(B(75), 'Chains', (g, t) => {
  const k1 = E.inOut(seg(t, 31.4, 34.28)), k2 = E.in(seg(t, 34.28, 36.73)), tr = 3 * seg(t, 34.28, 36.7) + 2 * pulse(t, 8) * seg(t, 32.6, 36.7);
  const C = drawCam(g, '15a', cam(lerp(855, 858, k1), lerp(420, 470, k1) + 20 * k2, lerp(1.05, 1.28, k1) * lerp(1, 1.3, k2), 0, addF(fl(t, .4, 67), tremble(t, tr))));
  const kn = mapPt(C, ...META['15'].knot); glowAt(g, 'crimson', kn[0], kn[1], 380 * C.s / 1.3, (.12 + .5 * seg(t, 34.28, 36.7)) * (.8 + .4 * pulse(t, 7)));
  const gc = glint(t, 32.72, 5); sparkle(g, kn[0] - 140, kn[1] - 40, 30 * gc, gc, .2); sparkle(g, kn[0] + 120, kn[1] - 70, 24 * gc, gc, -.3);
  embers(g, t, { n: 40, seed: 70, x0: kn[0] - 300, x1: kn[0] + 300, y0: kn[1] + 60, rise: 420, life: 1.6, size: 3, alpha: seg(t, 34.28, 35.2) });
  speedLines(g, kn[0], kn[1], t, { n: 90, inner: 420, alpha: .25 * seg(t, 36.0, 36.7), color: '#fff' });
  grade(g, { tint: '#503048', tintA: .16, edgeRed: .12 + .2 * seg(t, 34.28, 36.7) });
});
shot(B(89), '\u9396', (g, t) => kanjiCard(g, t, B(89), '\u9396', 'chain'));
shot(B(90), '\u65ad', (g, t) => kanjiCard(g, t, B(90), '\u65ad', 'cut'));
shot(B(91), 'Eyes', (g, t) => {
  const open = t >= B(92), map = faceCut(g, t, open ? 'F2' : 'F1', { scale: 1.28 + .05 * seg(t, B(91), B(93)), ring: 360 + 60 * E.outExpo(seg(t, B(92), B(92) + .3)) });
  if (open) { const gl = glint(t, B(92) + .04, 7); for (const [ex, ey] of [[560, 428], [690, 428]]) { const p = map(ex, ey); sparkle(g, p[0], p[1] - 4, 34 * gl, gl, .3, '255,236,190'); } }
  grade(g, { tint: '#46598a', tintA: .14 });
});
// 00:38.26 DROP - \u6708\u660e\u304b\u308a\u3092\u7e8f\u3063\u3066\u3000\u79c1\u306f\u884c\u304f - the chains shatter, then she strides into the wind
shot(B(93), 'Shatter', (g, t) => {
  const k = E.outExpo(seg(t, 38.26, 39.2)), C = drawCam(g, '15b', cam(lerp(860, 856, k), lerp(480, 430, k), lerp(1.55, 1.12, k) * bp(t, .015), 0, fl(t, .7, 68)));
  const kn = mapPt(C, 862, 470); glowAt(g, 'crimson', kn[0], kn[1], 600, .5 * (1 - seg(t, 38.26, 39.4)) + .15); glowAt(g, 'white', kn[0], kn[1], 300, .6 * (1 - seg(t, 38.26, 38.7)));
  chainBurst(g, t, 38.26, kn[0], kn[1], { n: 50, v: 1500, sparks: 90 });
  embers(g, t, { n: 50, seed: 71, x0: 200, x1: 1720, y0: 1150, rise: 900, life: 1.4, size: 3.5 });
  grade(g, { tint: '#503048', tintA: .14, edgeRed: .25 });
});
const cyc = (ids, fps, t) => ids[Math.floor(t * fps) % ids.length];
shot(B(96), 'Stride', (g, t) => {
  const k = E.inOut(seg(t, 39.42, 41.36)), id = cyc(['30a', '30b', '30c', '30b'], 8, t);
  const C = drawCam(g, id, cam(lerp(760, 820, k), lerp(430, 410, k), lerp(1.1, 1.24, k) * bp(t, .016), 0, fl(t, .7, 69)));
  const m = mapPt(C, ...META['30'].moon); glowAt(g, 'cool', m[0], m[1], 260, .55); rays(g, m[0], m[1], { n: 10, len: 1500, spread: 1.4, angle: 2.3, width: 90, alpha: .1, color: '210,220,255', t, seed: 12 });
  petals(g, t, { n: 150, seed: 17, travel: (t - 39.42) * 950, vx: 1, vy: -.18, sMin: 10, sMax: 64, streak: 1.4, alpha: 1, swayF: 2, region: faceAt(C, 560, 120, 55, 65) });
  windLines(g, t, { n: 24, speed: 2700, alpha: .28, angle: -.1 });
  grade(g, { tint: '#50608f', tintA: .18, edgeRed: .2 });
});
// 00:41.36 \u58ca\u308c\u305f\u7d04\u675f\u3082\u3000\u7070\u306b\u5909\u3048\u3066 - the burning promise
function fireFX(g, C, t, a = 1) {
  glowLayer(g, '16', C, AUX.fire16, a * (.55 + .35 * flicker(t, 3) + .25 * pulse(t, 7)));
  const f = mapPt(C, ...META['16'].fire); glowAt(g, 'warm', f[0], f[1], 520 * C.s / 1.3, .35 * a * flicker(t, 2));
  const c = mapPt(C, ...META['16'].candle); glowAt(g, 'warm', c[0], c[1], 160, .5 * flicker(t, 5));
}
shot(B(101), 'Burning promise', (g, t) => {
  const k = E.inOut(seg(t, 41.36, 42.52)), C = drawCam(g, '16', cam(lerp(740, 800, k), lerp(500, 480, k), lerp(1.18, 1.3, k) * bp(t, .012), 0, fl(t, .4, 70)));
  fireFX(g, C, t); const f = mapPt(C, ...META['16'].fire);
  embers(g, t, { n: 60, seed: 72, x0: f[0] - 260, x1: f[0] + 200, y0: f[1] + 120, rise: 700, life: 2, size: 3.2 });
  grade(g, { tint: '#5a3a30', tintA: .1 });
});
shot(B(104), 'Ash', (g, t) => {
  const k = E.inOut(seg(t, 42.52, 44.07)), C = drawCam(g, '16', cam(lerp(970, 990, k), lerp(470, 450, k), lerp(1.85, 2.05, k) * bp(t, .014), 0, fl(t, .45, 71)));
  fireFX(g, C, t, 1.25); glowAt(g, 'warm', W * .55, H * .5, 700, .35 * glint(t, 42.56, 4));
  embers(g, t, { n: 110, seed: 73, x0: 200, x1: 1800, y0: 1180, rise: 1100, life: 1.8, size: 4 });
  ash(g, t, { n: 40, seed: 74, speed: 70, alpha: .7 });
  grade(g, { tint: '#5a3a30', tintA: .1, edgeRed: .1 });
});
// 00:44.07 \u5b64\u72ec\u3055\u3048\u5203\u306b\u3000\u5909\u3048\u305f\u306a\u3089 - loneliness turned to a blade
shot(B(108), 'Blade', (g, t) => {
  const k = E.inOut(seg(t, 44.07, 45.62)), p = E.outExpo(seg(t, 45.62, 46.05));
  const C = drawCam(g, '17', cam(lerp(lerp(900, 905, k), 858, p), lerp(lerp(420, 410, k), 300, p), lerp(lerp(1.1, 1.2, k), 1.95, p), 0, fl(t, .4, 72)));
  const a = mapPt(C, ...META['17'].shardBot), b = mapPt(C, ...META['17'].shardTop); glintLine(g, a[0], a[1], b[0], b[1], seg(t, 45.0, 45.34), { size: 46, w: 6, tail: 360 });
  if (t > 45.0) glowAt(g, 'cool', lerp(a[0], b[0], .5), lerp(a[1], b[1], .5), 520, .35 * glint(t, 45.2, 4));
  const e = mapPt(C, ...META['17'].eye), ge = glint(t, 45.75, 5); sparkle(g, e[0], e[1] - 6, 30 * ge, ge, .2, '255,240,210');
  const mo = mapPt(C, ...META['17'].moon); glowAt(g, 'cool', mo[0], mo[1], 200, .4);
  grade(g, { tint: '#4b5680', tintA: .2 });
});
// 00:46.36 \u9078\u3076\u306e\u306f\u79c1\u306e\u3000\u660e\u65e5\u3060\u304b\u3089 - she reaches for the moon
shot(B(114), 'Reach', (g, t) => {
  const k = E.inOut(seg(t, 46.36, 49.05)), C = drawCam(g, '18a', cam(lerp(836, 1140, k), lerp(470, 285, k), lerp(1.04, 1.48, k), 0, fl(t, .4, 73)));
  const m = mapPt(C, ...META['18'].moon), fm = glint(t, 48.18, 3); glowAt(g, 'cool', m[0], m[1], 420 * C.s / 1.3, .45 + .4 * fm); flare(g, m[0], m[1], 130, .2 + .6 * fm);
  rays(g, m[0], m[1], { n: 14, len: 1800, spread: TAU, angle: t * .05, width: 70, alpha: .07 + .08 * fm, color: '215,225,255', t, seed: 23 });
  petals(g, t, { n: 16, seed: 18, speed: 50, vx: .3, vy: .7, sMin: 10, sMax: 44, alpha: .85 });
  grade(g, { tint: '#4b5680', tintA: .2 });
});
// 00:49.05 \u7f8e\u3057\u304f\u3000\u5371\u3046\u304f\u3000\u71c3\u3048\u4e0a\u304c\u308c - beautiful / dangerous / blaze up
shot(B(121), 'Beautiful', (g, t) => {
  card(g, t, 'moon', { mx: 1215, my: 410, mr: 340, rot: .2 });
  petals(g, t, { n: 40, seed: 80, speed: 60, vx: .15, vy: .9, sMin: 10, sMax: 46, alpha: .85 });
  const lt = t - B(121), pop = 1 + .05 * Math.exp(-lt * 9), bob = Math.sin(lt * 1.8) * 5;
  g.save(); g.translate(1150, H * .5); g.scale(pop * (1 + .02 * seg(t, 49.05, 51.55)), pop * (1 + .02 * seg(t, 49.05, 51.55))); g.translate(-1150, -H * .5 + bob);
  drawSprite(g, 'S7', { x: 1150, y: 70, anchor: 'top', h: 1290, glow: .35 }); g.restore();
  petals(g, t, { n: 16, seed: 81, speed: 90, vx: .1, vy: 1, sMin: 30, sMax: 80, alpha: .9, nearBlur: .5, region: (x, y) => x < 700 || x > 1600 || y > 700 });
  grade(g, { tint: '#4a4468', tintA: .14 });
});
shot(51.55, 'Dangerous', (g, t) => {
  const punch = E.outExpo(seg(t, 51.74, 51.95));
  g.save(); g.translate(1080, 330); g.scale(1 + .2 * punch, 1 + .2 * punch); g.translate(-1080, -330);
  poseSnap(g, t, t < 51.74 ? 51.55 : 51.74, { id: 'S5', card: 'crimson', cardOpts: { cx: 1080, cy: 420, rot: .3 }, mark: '\u5371', markX: 1120, markY: 520, markSize: 900, markCol: '#000', markA: .5, sp: { x: 1060, y: 1066, h: 1000, outline: 'black', outlineW: 6, shadow: .5 } });
  g.restore();
});
shot(B(130), 'Blaze', (g, t) => {
  const k = E.inOut(seg(t, 52.51, 54.43)), C = drawCam(g, '19', cam(lerp(860, 920, k), lerp(470, 450, k), lerp(1.08, 1.22, k) * bp(t, .016), 0, fl(t, .6, 74)));
  glowLayer(g, '19', C, AUX.fire19, .5 + .35 * flicker(t, 4) + .3 * pulse(t, 7) + .4 * glint(t, 52.74, 3));
  const m = mapPt(C, ...META['19'].moon); glowAt(g, 'cool', m[0], m[1], 180, .4);
  embers(g, t, { n: 120, seed: 75, x0: -100, x1: 2000, y0: 1180, rise: 1200, life: 2.2, size: 4 });
  kanjiSlam(g, t, 52.74, '\u71c3', { x: W * .64, y: H * .48, size: 420, life: .9, color: '#ff5a2a', glow: 'rgba(255,140,40,.95)', stroke: '#fff2e0' });
  grade(g, { tint: '#5a2a24', tintA: .12, edgeRed: .2 });
});
shot(B(135), 'Fallen petals', (g, t) => {
  const k = E.inOut(seg(t, 54.43, 57.12)), C = drawCam(g, '11', cam(lerp(760, 575, k), lerp(500, 560, k), lerp(1.08, 1.3, k), 0, fl(t, .35, 20)));
  const s = mapPt(C, 1150, 60); rays(g, s[0], s[1], { n: 7, len: 1300, spread: .22, angle: 2.25, width: 70, alpha: .18, color: '215,222,255', t, seed: 14, wobble: .015 });
  const m = mapPt(C, 1370, 90); glowAt(g, 'cool', m[0], m[1], 180, .5); candles(g, C, META['11'].candles, t, 1);
  embers(g, t, { n: 30, seed: 76, x0: 0, x1: W, y0: 1150, rise: 600, life: 3.4, size: 3, alpha: 1 - seg(t, 54.43, 56.2) });
  petals(g, t, { n: 10, seed: 28, speed: 28, vx: -.2, vy: .7, sMin: 18, sMax: 60, alpha: .9, swayF: .6, sway: 60, spin: .8 });
  grade(g, { tint: '#40506f', tintA: .3 });
});
// 00:57.12 \u6ce3\u304b\u306a\u3044\u3067\u3068\u3000\u8ab0\u306b\u8a00\u3046\u306e - the droplets on the hits
shot(B(142), 'Puddle', (g, t) => {
  const k = E.inOut(seg(t, 57.12, 60.57)), C = drawCam(g, '26', cam(lerp(860, 880, k), lerp(430, 520, k), lerp(1.12, 1.34, k), 0, fl(t, .3, 75)));
  const d = mapPt(C, ...META['26'].drop), fl2 = .42;
  for (const T of [57.65, 58.26, 59.72]) { droplet(g, d[0], d[1], t, T); ripples(g, d[0], d[1], t - T, { speed: 260 * C.s / 1.3, flat: fl2 }); }
  const m = mapPt(C, ...META['26'].moon); glowAt(g, 'cool', m[0], m[1], 200, .45 + .3 * (glint(t, 57.65, 4) + glint(t, 58.26, 4)));
  motes(g, t, { n: 20, seed: 77, speed: 5, size: 3, alpha: .35, spr: 'cool' });
  grade(g, { tint: '#3e4c74', tintA: .26 });
});
// 01:00.57 \u3053\u306e\u80f8\u306e\u591c\u306f\u3000\u79c1\u306e\u3082\u306e - her eyes open on \u79c1
shot(B(151), 'Heart', (g, t) => {
  const k = E.inOut(seg(t, 60.57, 63.23)), cm = cam(lerp(980, 1030, k), lerp(340, 300, k), lerp(1.18, 1.38, k), 0, fl(t, .3, 76)), C = drawCam(g, '27a', cm);
  if (t >= 61.98) drawCam(g, '27b', cm, { alpha: seg(t, 61.98, 62.08) });
  const gl = glint(t, 62.12, 5); META['27'].eyes.forEach(([x, y]) => { const p = mapPt(C, x, y); sparkle(g, p[0], p[1], 22 * gl, gl, .3, '255,236,190'); });
  candles(g, C, META['27'].candles, t, 1); const mo = mapPt(C, ...META['27'].moon); glowAt(g, 'cool', mo[0], mo[1], 220, .45);
  motes(g, t, { n: 22, seed: 78, speed: 6, size: 3, alpha: .35, spr: 'warm', region: (x) => x < W * .45 });
  grade(g, { tint: '#4b4a70', tintA: .18 });
});
// 01:03.23 the sovereign: crash zoom into the four drum hits
shot(B(158), 'Sovereign', (g, t) => {
  const k = E.inOut(seg(t, 63.23, 64.0)), C = drawCam(g, '10', cam(835, lerp(170, 140, k), lerp(2.2, 2.6, k) * (1 + .14 * E.inExpo(seg(t, 63.8, 64.37))), 0, fl(t, .3, 23)));
  candles(g, C, META['10'].candles, t, 1.2);
  const gl = glint(t, 63.61, 5); META['10'].eyes.forEach(([x, y]) => { const p = mapPt(C, x, y); sparkle(g, p[0], p[1], 26 * gl, gl, .3, '255,232,170'); });
  speedLines(g, W / 2, H * .4, t, { n: 60, inner: 480, alpha: .24 * seg(t, 63.6, 64.37), color: '#fff' });
  grade(g, { tint: '#4b4a70', tintA: .22 });
});
// 01:04.37 \u6708\u660e\u304b\u308a\u3092\u7e8f\u3063\u3066\u3000\u79c1\u306f\u884c\u304f - four hits, four snaps
shot(B(161), 'Hit I', (g, t) => poseSnap(g, t, B(161), { id: 'S3', card: 'moon', cardOpts: { mx: 1180, my: 470, mr: 420 }, mark: '\u6708', markX: 1180, markY: 520, markSize: 900, markCol: '#ff3355', markA: .45, sp: { x: 1150, y: 1072, h: 1030, outline: 'white', outlineW: 4, glow: .25, glowCol: 'red' } }));
shot(65.36, 'Hit II', (g, t) => poseSnap(g, t, 65.36, { id: 'S4', card: 'crimson', cardOpts: { cx: 1120, cy: 430, rot: 1.1 }, mark: '\u7e8f', markX: 1150, markY: 520, markSize: 880, markCol: '#000', markA: .45, sp: { x: 1110, y: 1070, h: 1000, outline: 'black', outlineW: 6, shadow: .45 } }));
shot(66.30, 'Hit III', (g, t) => {
  const lt = t - 66.30;
  if (lt < 2 / FPS) { g.fillStyle = '#f3ece6'; g.fillRect(0, 0, W, H); speedLines(g, 1150, H * .42, t, { n: 150, inner: 200, alpha: .95, color: '#0a0406', seed: 4, rate: 30 }); drawSprite(g, 'F3', { anchor: 'pt', ax: 620, ay: 470, x: 1150, y: 500, scale: 1.3, impact: true }); return; }
  card(g, t, 'ink', { cx: 1150, cy: 450, sun: 360, seed: 5 });
  kanjiMark(g, '\u79c1', 620, 560, 820, { color: '#0a0406', alpha: .18, lw: 5 });
  const pop = 1 + .06 * Math.exp(-lt * 11); g.save(); g.translate(1150, 500); g.scale(pop, pop); g.translate(-1150, -500);
  const map = drawSprite(g, 'F3', { anchor: 'pt', ax: 620, ay: 470, x: 1150, y: 500 + Math.sin(lt * 2.4) * 4, scale: 1.3, outline: 'black', outlineW: 6 }); g.restore();
  const gl = glint(t, 66.45, 6); for (const [ex, ey] of [[560, 428], [690, 428]]) { const p = map(ex, ey); sparkle(g, p[0], p[1] - 4, 30 * gl, gl, .3, '255,236,190'); }
});
shot(67.04, 'Hit IV', (g, t) => {
  const z = 1 + .9 * E.inExpo(seg(t, 67.42, 67.85)); g.save(); g.translate(1260, 330); g.scale(z, z); g.translate(-1260, -330);
  poseSnap(g, t, 67.04, { id: 'S6', card: 'night', cardOpts: { mx: 1260, my: 330, mr: 250 }, mark: '\u7d05', markX: 1120, markY: 540, markSize: 880, markCol: '#ff2a4c', markA: .42, sp: { x: 1040, y: 1072, h: 1010, outline: 'red', outlineW: 4, glow: .3 },
    over: (g2, tt) => petals(g2, tt, { n: 60, seed: 82, travel: (tt - 67.04) * 800, vx: 1, vy: -.3, sMin: 10, sMax: 50, alpha: .9, streak: 1 }) });
  g.restore(); flash(g, E.in(seg(t, 67.5, 67.85)) * .5, '255,248,244');
});
// 01:07.85 \u7d05\u3044\u82b1\u3073\u3089\u3092\u3000\u98a8\u306b\u653e\u3061 - held, then released on \u653e
shot(B(170), 'Petals', (g, t) => {
  const k = E.inOut(seg(t, 67.85, 70.55)), rel = t >= 69.2, jolt = rel ? .03 * Math.exp(-(t - 69.2) * 8) : 0;
  const cm = cam(lerp(880, 940, k), lerp(410, 390, k), lerp(1.1, 1.2, k) * (1 + jolt) * bp(t, .01), 0, fl(t, .5, 77)), C = drawCam(g, '20a', cm);
  if (rel) drawCam(g, '20b', cm, { alpha: seg(t, 69.2, 69.3) });
  const h = mapPt(C, ...META['20'].hand), m = mapPt(C, ...META['20'].moon); glowAt(g, 'cool', m[0], m[1], 220, .5);
  petalBurst(g, t, 69.2, h[0], h[1], { n: 44, v: 1100, seed: 83 });
  if (rel) petals(g, t, { n: 90, seed: 84, travel: (t - 69.2) * 900, vx: 1, vy: -.25, sMin: 10, sMax: 54, alpha: seg(t, 69.2, 69.5), streak: .8, region: faceAt(C, 640, 250, 150, 170) });
  else petals(g, t, { n: 16, seed: 85, speed: 40, vx: .4, vy: .5, sMin: 10, sMax: 40, alpha: .8, region: faceAt(C, 640, 250, 150, 170) });
  grade(g, { tint: '#4b5680', tintA: .18 });
});
// 01:10.55 \u904b\u547d\u3055\u3048\u8d8a\u3048\u3066\u3000\u540d\u3092\u523b\u3080 - the crest burns on \u523b
shot(B(177), 'Crest', (g, t) => {
  const k = E.inOut(seg(t, 70.55, 72.85)), C = drawCam(g, '28', cam(lerp(820, 1030, k), lerp(470, 420, k), lerp(1.04, 1.3, k), 0, addF(fl(t, .4, 78), tremble(t, 6 * Math.exp(-Math.max(0, t - 72.1) * 6) * (t > 72.1 ? 1 : 0)))));
  const cr = glint(t, 72.1, 2.2); glowLayer(g, '28', C, AUX.red28, .35 + .35 * pulse(t, 6) + 1.2 * cr);
  const c = mapPt(C, ...META['28'].crest); glowAt(g, 'crimson', c[0], c[1], 700 * C.s / 1.2, .2 + .45 * cr);
  embers(g, t, { n: 70, seed: 79, x0: c[0] - 400, x1: c[0] + 400, y0: c[1] + 300, rise: 700, life: 1.5, size: 3.5, alpha: seg(t, 72.1, 72.2) * (1 - seg(t, 72.3, 72.85)) + .2 });
  const mo = mapPt(C, ...META['28'].moon); glowAt(g, 'cool', mo[0], mo[1], 220, .45);
  grade(g, { tint: '#4b4a70', tintA: .16, edgeRed: .12 });
});
// 01:12.85 \u596a\u308f\u308c\u305f\u672a\u6765\u3092\u3000\u53d6\u308a\u623b\u3059 - she takes the moon on \u53d6
shot(B(183), 'Grasp', (g, t) => {
  const k = E.inOut(seg(t, 72.85, 75.54)), got = t >= 74.2, punch = got ? .08 * Math.exp(-(t - 74.2) * 7) : 0;
  const cm = cam(lerp(1060, 1160, k), lerp(300, 245, k), lerp(1.45, 1.7, k) * (1 + punch), 0, fl(t, .45, 79)), C = drawCam(g, '18a', cm);
  if (got) { drawCam(g, '18b', cm, { alpha: seg(t, 74.2, 74.3) }); glowLayer(g, '18b', C, AUX.moon18b, .4 + .5 * glint(t, 74.25, 2) + .2 * pulse(t, 6)); }
  const m = mapPt(C, ...(got ? META['18'].fist : META['18'].moon)); glowAt(g, 'cool', m[0], m[1], 460, got ? .55 + .4 * glint(t, 74.25, 3) : .5);
  rays(g, m[0], m[1], { n: 18, len: 1900, spread: TAU, angle: t * .06, width: 60, alpha: got ? .14 : .06, color: '225,232,255', t, seed: 24 });
  grade(g, { tint: '#4b5680', tintA: .2 });
});
// 01:15.54 \u4f55\u5ea6\u3067\u3082\u3000\u4f55\u5ea6\u3067\u3082\u3000\u7acb\u3061\u4e0a\u304c\u308c - kneel, rise, stand
shot(B(190), 'Rise', (g, t) => {
  const id = t < 76.69 ? '29a' : t < 77.85 ? '29b' : '29c', st = t < 76.69 ? 75.54 : t < 77.85 ? 76.69 : 77.85, lvl = t < 76.69 ? 0 : t < 77.85 ? 1 : 2;
  const C = drawCam(g, id, cam(840, lerp(470, 430, lvl / 2), (1.04 + .05 * lvl) * (1 + .05 * Math.exp(-(t - st) * 9)) * (1 + .015 * (t - st)), 0, fl(t, .4, 80)));
  glowLayer(g, '29c', C, AUX.win29, .15 + .2 * lvl + .35 * pulse(t, 6));
  const w = mapPt(C, ...META['29'].window); rays(g, w[0], w[1], { n: 22, len: 2000, spread: TAU, angle: t * .07, width: 60, alpha: .06 + .04 * lvl, color: '255,215,215', t, seed: 25 });
  speedLines(g, W / 2, H * .45, t, { n: 70, inner: 380, alpha: .3 * Math.exp(-(t - st) * 6), color: '#fff' });
  petals(g, t, { n: 40 + 20 * lvl, seed: 86, speed: 120, vx: .2, vy: -1, sMin: 10, sMax: 50, alpha: .85 });
  grade(g, { tint: '#503a55', tintA: .16 });
});
// 01:18.61 \u79c1\u304c\u9078\u3076\u3000\u79c1\u306e destiny - her eyes lift to us; the only smile
shot(B(198), 'Destiny', (g, t) => {
  const k = E.inOut(seg(t, 78.61, 81.68)), up = t >= 81.68, cm = cam(lerp(760, 752, k), lerp(430, 400, k), lerp(1.22, 1.4, k) * (1 + (up ? .04 * E.outExpo(seg(t, 81.68, 82.2)) : 0)), 0, fl(t, .3, 81)), C = drawCam(g, '21a', cm);
  if (up) drawCam(g, '21b', cm, { alpha: seg(t, 81.68, 81.78) });
  glowLayer(g, '21a', C, AUX.win21a, .2 + .25 * pulse(t, 6) + .3 * glint(t, 81.9, 3));
  const gl = glint(t, 81.85, 5), f = mapPt(C, 758, 347); sparkle(g, f[0] - 42, f[1], 26 * gl, gl, .3, '255,236,190'); sparkle(g, f[0] + 42, f[1] - 2, 26 * gl, gl, .3, '255,236,190');
  petals(g, t, { n: 30, seed: 87, speed: 60, vx: .15, vy: .9, sMin: 10, sMax: 44, alpha: .85, region: faceAt(C, 760, 340, 150, 190) });
  grade(g, { tint: '#503a55', tintA: .14 });
});
// 01:22.84 one look back
shot(B(209), 'Look back', (g, t) => poseSnap(g, t, B(209), { id: 'S2', card: 'night', cardOpts: { mx: 1320, my: 300, mr: 230 }, sp: { x: 960, y: 1072, h: 1040, outline: 'white', outlineW: 3, glow: .3 },
  over: (g2, tt) => petals(g2, tt, { n: 30, seed: 88, speed: 90, vx: .3, vy: .9, sMin: 10, sMax: 44, alpha: .85 }) }));
// 01:23.60 \u3053\u306e\u9053\u3092\u9078\u3076 - the path to the manor
shot(B(211), 'Path', (g, t) => {
  const k = E.inOut(seg(t, 83.6, 84.74)), f = fl(t, .5, 42), bgc = cam(lerp(836, 842, k), lerp(480, 600, k), lerp(1.1, 1.5, k), 0, f);
  const C = drawCam(g, '02', bgc, { src: AUX.plate02 }); const m = mapPt(C, 557, 78); glowAt(g, 'cool', m[0], m[1], 200, .6);
  candles(g, C, META['02'].lanterns, t, 1); fog(g, t, { y: 560, h: 520, alpha: .4, speed: 90 });
  const Cf = drawCam(g, '02', { ...bgc, z: bgc.z * lerp(1.05, 1.5, k) }, { src: AUX.fg02.c }); candles(g, Cf, META['02'].gateLamps, t, 1);
  rain(g, t, { n: 150, alpha: .22 }); petals(g, t, { n: 40, seed: 43, speed: 200, vx: .4, vy: 1, sMin: 8, sMax: 40, alpha: .85 });
  grade(g, { tint: '#3f5078', tintA: .3 });
});
// 01:24.74 the monumental pose
shot(B(214), 'Hero', (g, t) => {
  const k = E.outExpo(seg(t, 84.74, 85.9)), C = drawCam(g, '12', cam(836, lerp(360, 470, k), lerp(1.5, 1.0, k) * bp(t, .012), 0, fl(t, .45, 53)));
  glowLayer(g, '12', C, AUX.win12, .2 + .3 * pulse(t, 6)); heroFX(g, C, t, 1.3);
  petals(g, t, { n: 150, seed: 54, speed: 200, vx: .25, vy: 1, sMin: 10, sMax: 74, alpha: .95, nearBlur: .8, region: faceAt(C, 838, 72, 42, 52) });
  grade(g, { tint: '#503a55', tintA: .16, edgeRed: .15 });
});
// 01:26.28 \u4eca\u3001\u904b\u547d\u3092\u65ad\u3064 - back to the moon; the cut on \u65ad
shot(B(218), 'Sever', (g, t) => {
  const k = E.inOut(seg(t, 86.28, 87.78)), C = drawCam(g, '13', cam(lerp(1040, 1120, k), lerp(290, 200, k), lerp(1.2, 1.5, k), 0, addF(fl(t, .4, 82), tremble(t, 3 * seg(t, 87.2, 87.78)))));
  glowLayer(g, '13', C, AUX.moon13, .3 + .6 * seg(t, 86.9, 87.78) + .15 * pulse(t, 6));
  const m = mapPt(C, 1104, 120); glowAt(g, 'crimson', m[0], m[1], 800 * C.s / 1.3, .25 * seg(t, 87.0, 87.78)); glowAt(g, 'cool', m[0], m[1], 620 * C.s / 1.3, .35);
  windLines(g, t, { n: 16, speed: 2200, alpha: .22, angle: -.35 });
  petals(g, t, { n: 70, seed: 89, travel: (t - 86.28) * 900, vx: 1, vy: -.42, sMin: 8, sMax: 44, alpha: .9, streak: 1, region: faceAt(C, 1195, 110, 70, 90) });
  grade(g, { tint: '#46598a', tintA: .24, edgeRed: .2 * seg(t, 87.0, 87.78) });
  slashLine(g, seg(t, 87.64, 87.78), { angle: -.5, cx: W * .52, cy: H * .45 });
});
// 01:27.78 FINAL - the title over the final pose
shot(87.78, 'Final', (g, t) => {
  const k = E.inOut(seg(t, 87.78, 90)), C = drawCam(g, '12', cam(836, lerp(262, 250, k), lerp(1.7, 1.8, k), 0, fl(t, .3, 55)));
  glowLayer(g, '12', C, AUX.win12, .3 + .3 * glint(t, B(224), 3)); heroFX(g, C, t, 1.2);
  const gB = glint(t, B(224) + .1, 7), br = mapPt(C, 838, 142); sparkle(g, br[0], br[1], 34 * gB, gB, .2, '255,228,186');
  petals(g, t, { n: 90, seed: 56, speed: 120, vx: .2, vy: 1, sMin: 10, sMax: 64, alpha: .9, nearBlur: .8, region: faceAt(C, 838, 72, 42, 52) });
  petalBurst(g, t, B(224), 1610, 560, { n: 40, v: 1000, seed: 57 });
  grade(g, { tint: '#503a55', tintA: .16, edgeRed: .15 });
  drawTitle(g, t, 87.95, { x: 1610, y: 196, size: 84, ring: [B(224)], shimmer: B(224), romajiAt: .8, backing: .8 });
  blackout(g, E.inOut(seg(t, 89.3, 90)));
});

// ---------- lyric layout: which side, where, which characters glow crimson ----------
const LAY = [
  { side: 'L', x: 350, y: 150, size: 70, accent: '\u7d05\u6708', show: 6.1, hide: 10.6 },
  { side: 'L', x: 380, y: 170, size: 68, accent: '\u91d1\u6d99' },
  { side: 'R', x: 1770, y: 160, size: 66, accent: '\u50b7' },
  { side: 'R', x: 1770, y: 170, size: 66, accent: '\u7d05\u82b1' },
  { side: 'L', x: 380, y: 170, size: 66, accent: '\u8a93', show: 23.34 },
  { side: 'R', x: 1770, y: 130, size: 66, accent: '\u904b\u547d' },
  { side: 'L', x: 380, y: 170, size: 68, accent: '\u9396', hide: 36.4 },
  { side: 'R', x: 1770, y: 140, size: 70, accent: '\u6708' },
  { side: 'R', x: 1770, y: 150, size: 66, accent: '\u7070', show: 41.36 },
  { side: 'L', x: 380, y: 160, size: 66, accent: '\u5203', show: 44.07 },
  { side: 'R', x: 1770, y: 150, size: 66, accent: '\u660e\u65e5' },
  { side: 'L', x: 430, y: 150, size: 72, accent: '\u71c3', hide: 56.2 },
  { side: 'L', x: 380, y: 160, size: 64, accent: '\u6ce3' },
  { side: 'L', x: 380, y: 160, size: 64, accent: '\u591c' },
  { side: 'L', x: 360, y: 150, size: 70, accent: '\u6708' },
  { side: 'R', x: 1770, y: 150, size: 66, accent: '\u7d05' },
  { side: 'L', x: 380, y: 150, size: 66, accent: '\u904b\u547d\u540d' },
  { side: 'R', x: 1770, y: 150, size: 66, accent: '\u672a\u6765' },
  { side: 'R', x: 1790, y: 120, size: 64, accent: '\u7acb', show: 75.54 },
  { side: 'R', x: 1770, y: 170, size: 68, accent: '\u79c1', show: 78.61, hide: 82.52, latin: { x: W / 2, y: H - 175, size: 104 } },
  { side: 'R', x: 1770, y: 190, size: 66, accent: '\u9053', show: 83.6 },
  { side: 'L', x: 360, y: 170, size: 72, accent: '\u65ad\u904b\u547d' },
];
LYRICS.forEach((L, i) => { const lay = LAY[i]; L.show = lay.show ?? L.s; });
LYRICS.forEach((L, i) => { const lay = LAY[i], nx = LYRICS[i + 1]; L.hide = lay.hide ?? Math.min(L.e + .5, nx ? nx.show - .32 : 99); });
function drawLyrics(g, t) { LYRICS.forEach((L, i) => { if (t < L.show - .05 || t > L.hide + .35) return; drawLyricLine(g, L, t, LAY[i]); drawEnglish(g, L, t, LAY[i]); }); }

// ---------- transitions ----------
const TRANS = [
  { t: B(0), type: 'zoom', pre: .22, amt: .35 }, { t: B(0), type: 'flash', post: .32, a: 1 },
  { t: B(9), type: 'flash', post: .3, a: .6, col: '215,228,255' },
  { t: B(21), type: 'slash', post: .55, angle: -.55, cx: W * .55, cy: H * .42, dist: 1100 },
  { t: B(30), type: 'flash', post: .25, a: .5 },
  { t: B(38), type: 'whip', pre: .12, post: .16, dx: -1 }, { t: B(42), type: 'flash', post: .1, a: .2 },
  { t: B(46), type: 'dissolve', post: .3 }, { t: B(50), type: 'flash', post: .1, a: .22 },
  { t: B(54), type: 'whip', pre: .1, post: .14, dx: 1 }, { t: B(58), type: 'dissolve', post: .25 },
  { t: B(61), type: 'spin', pre: .16, post: .3, amt: .5 }, { t: B(67), type: 'dissolve', post: .35 },
  { t: B(75), type: 'flash', post: .3, a: .4 },
  { t: B(89), type: 'flash', post: .12, a: .9 }, { t: B(90), type: 'flash', post: .12, a: .9 },
  { t: B(91), type: 'flash', post: .14, a: .6 }, { t: B(92), type: 'flash', post: .16, a: .55 },
  { t: B(93), type: 'flash', post: .32, a: .9 },
  { t: B(96), type: 'whip', pre: .1, post: .14, dx: 1 },
  { t: B(101), type: 'whip', pre: .1, post: .14, dx: -1 }, { t: B(104), type: 'flash', post: .2, a: .45, col: '255,200,150' },
  { t: B(108), type: 'slash', post: .4, angle: 1.25, dist: 1500, slide: 120 },
  { t: B(114), type: 'dissolve', post: .3 },
  { t: B(121), type: 'zoom', pre: .2, amt: .3 }, { t: B(121), type: 'flash', post: .3, a: .6 },
  { t: 51.55 + 2 / FPS, type: 'flash', post: .12, a: .35 }, { t: 51.74 + 2 / FPS, type: 'flash', post: .12, a: .35 },
  { t: B(130), type: 'flash', post: .28, a: .8, col: '255,190,120' },
  { t: B(135), type: 'dissolve', post: 1.2 }, { t: B(142), type: 'dissolve', post: .8 },
  { t: B(151), type: 'dissolve', post: .5 }, { t: 61.98, type: 'flash', post: .2, a: .25 },
  { t: B(158), type: 'flash', post: .25, a: .35 },
  { t: B(161) + 2 / FPS, type: 'flash', post: .12, a: .35 }, { t: 65.36 + 2 / FPS, type: 'flash', post: .12, a: .35 }, { t: 66.30 + 2 / FPS, type: 'flash', post: .12, a: .35 }, { t: 67.04 + 2 / FPS, type: 'flash', post: .12, a: .35 },
  { t: B(170), type: 'shatter', post: .8, speed: 1.4 }, { t: B(170), type: 'flash', post: .25, a: .3 }, { t: 69.2, type: 'flash', post: .2, a: .4 },
  { t: B(177), type: 'whip', pre: .1, post: .14, dx: 1 }, { t: 72.1, type: 'flash', post: .25, a: .45, col: '255,120,140' },
  { t: B(183), type: 'flash', post: .25, a: .4, col: '215,228,255' }, { t: 74.2, type: 'flash', post: .25, a: .7 },
  { t: B(190), type: 'flash', post: .2, a: .5 }, { t: 76.69, type: 'flash', post: .15, a: .4 }, { t: 77.85, type: 'flash', post: .2, a: .5 },
  { t: B(198), type: 'flash', post: .3, a: .4 }, { t: 81.68, type: 'flash', post: .25, a: .3 },
  { t: B(209) + 2 / FPS, type: 'flash', post: .14, a: .35 }, { t: B(211), type: 'flash', post: .25, a: .5, col: '215,228,255' },
  { t: B(214), type: 'flash', post: .35, a: .85 }, { t: B(218), type: 'flash', post: .25, a: .5, col: '215,228,255' },
  { t: 87.78, type: 'slash', post: .6, angle: -.5, cx: W * .52, cy: H * .45, dist: 1150 }, { t: 87.78, type: 'flash', post: .2, a: .5 },
  { t: B(224), type: 'flash', post: .3, a: .45, col: '255,236,236' },
];
const SHAKES = [[B(0), 9], [B(93), 18], [51.74, 10], [B(130), 9], [B(161), 8], [65.36, 9], [66.30, 10], [67.04, 12], [B(170), 16], [74.2, 9], [77.85, 10], [B(214), 10], [87.78, 14], [B(224), 7]];
const CA_HITS = [[B(93), 12], [51.74, 9], [B(130), 8], [B(161), 9], [65.36, 9], [66.30, 10], [67.04, 12], [B(170), 16], [74.2, 8], [B(214), 8], [87.78, 12]];
const IMPACTS = [51.55, 51.74, B(161), 65.36, 66.30, 67.04, B(209)];
function inChorus(t) { return (t >= 38.26 && t < 54.43) || (t >= 64.37 && t < 86.28); }

// ---------- compositor ----------
function shotIndex(t) { let i = 0; for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].t) i = k; return i; }
function renderShot(g, i, t) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); SHOTS[i].draw(g, t, t - SHOTS[i].t); g.restore(); }
function shakeAt(t) { let x = 0, y = 0, a = 0; if (REDUCED_MOTION) return { x, y, a }; for (const [T, amp] of SHAKES) { const d = t - T; if (d >= 0 && d < .6) { const e = amp * Math.exp(-d * 7); x += Math.sin(d * 95 + T) * e; y += Math.cos(d * 73 + T) * e; a = Math.max(a, e); } } return { x, y, a }; }
let REDUCED_MOTION = false;
function renderFrame(t) {
  const g = FRAME.g, i = shotIndex(t), sh = shakeAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (sh.a > 0) { renderShot(TMP.g, i, t); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const s = 1 + sh.a * .004; g.setTransform(s, 0, 0, s, W / 2 * (1 - s) + sh.x, H / 2 * (1 - s) + sh.y); g.drawImage(TMP, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0); }
  else renderShot(g, i, t);
  for (const tr of TRANS) {
    const pre = tr.pre || 0, post = tr.post || 0; if (t < tr.t - pre || t >= tr.t + post) continue;
    const before = t < tr.t, p = before ? (t - (tr.t - pre)) / pre : (t - tr.t) / post;
    switch (tr.type) {
      case 'flash': if (!before) flash(g, (tr.a ?? 1) * (1 - p) * (1 - p), tr.col); break;
      case 'whip': { const A = before ? E.in(p) : 1 - E.out(p), dx = (tr.dx || 0) * W * .35 * A, dy = (tr.dy || 0) * H * .35 * A; motionBlur(g, dx, dy, 7); break; }
      case 'spin': { const A = before ? E.in(p) : 1 - E.out(p); spinBlur(g, (tr.amt || .5) * A, 7); break; }
      case 'zoom': if (before) zoomBlur(g, W / 2, H / 2, (tr.amt || .3) * E.in(p), 7); break;
      case 'dissolve': if (!before) { const j = shotIndex(tr.t - .001); renderShot(PREV.g, j, t); g.save(); g.globalAlpha = 1 - E.sine(p); g.drawImage(PREV, 0, 0); g.restore(); } break;
      case 'curtain': petalCurtain(g, t, tr.t, pre + post, { seed: 41 }); break;
      case 'shatter': if (!before) { const j = shotIndex(tr.t - .001); renderShot(PREV.g, j, tr.t - .2); shatter(g, PREV, (t - tr.t) * (tr.speed || 1.15)); } break;
      case 'slash': if (!before) { const j = shotIndex(tr.t - .001); renderShot(PREV.g, j, t); slashSplit(g, PREV, p, tr); } break;
    }
  }
  kanjiSlam(g, t, 87.78, '\u65ad', { x: W * .47, y: H * .52, size: 540, life: .42, color: '#c8102e' });
  const impact = IMPACTS.some(T => t >= T && t < T + 2 / FPS);
  bloom(g, impact ? 0 : inChorus(t) ? .5 : .38);
  let ca = inChorus(t) ? 2.2 * pulse(t, 10) : 0; for (const [T, a] of CA_HITS) { const d = t - T; if (d >= 0 && d < .5) ca = Math.max(ca, a * Math.exp(-d * 8)); }
  chroma(g, ca);
  g.drawImage(SPR.vignette, 0, 0);
  if (!impact) drawLyrics(g, t);
  grain(g, t, .09);
  return FRAME;
}
