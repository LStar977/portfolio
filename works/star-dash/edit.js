/* edit.js - THE EDIT: STAR\u2606DASH! (3\u30fb2\u30fb1 STAR DASH!).
   Cuts follow the song's beats (176.5 BPM) and the sung lyrics (aligned per syllable).
   Stills use ORIGINAL image pixels (1672x941); Grok clips use their own pixels (736x400) in original clip seconds.
   Every frame is a pure function of song time t (clips are seeked to the exact frame before each render). */
'use strict';
var LOWQ = false;
const SONG = { title: 'STAR\u2606DASH!', romaji: '3\u30fb2\u30fb1 STAR DASH!', duration: 89.5 };
let REDUCED_MOTION = false;
const RD = "'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Arial Rounded MT Bold',sans-serif";
const MEM = {
  K: { name: 'KOKONA', jp: '\u5929\u91ce\u3053\u3053\u306a', ro: 'AMANO KOKONA', tag: 'The sunny leader', col: '#ff8a2a', rgb: '255,138,42', dark: '#7a2a00' },
  R: { name: 'REI', jp: '\u6708\u5cf6\u30ec\u30a4', ro: 'TSUKISHIMA REI', tag: 'The club astronomer', col: '#4a6cf0', rgb: '90,120,255', dark: '#0d1650' },
  M: { name: 'MIMI', jp: '\u685c\u5ead\u307f\u307f', ro: 'SAKURABA MIMI', tag: 'Shy, sweet, secretly brave', col: '#ff6fae', rgb: '255,111,174', dark: '#7a1040' },
  N: { name: 'NAGI', jp: '\u590f\u76ee\u30ca\u30ae', ro: 'NATSUME NAGI', tag: 'Sporty and unstoppable', col: '#2fd49a', rgb: '47,212,154', dark: '#08503a' },
};
const SCENES = ['A01', 'A02', 'A03', 'A04', 'A05', 'D1', 'D2', 'D3', 'D4', 'I1', 'I2', 'I3', 'I4', 'V1', 'V2', 'V3', 'V4', 'V5', 'P1', 'P2', 'G1', 'G2', 'G3', 'G4', 'G5', 'H0', 'H1', 'H2', 'H3', 'F1', 'F2', 'F3', 'F4'];
const POSES = ['C1', 'C2', 'C3', 'C4', 'HS1', 'HS2', 'HS3', 'HS4'];
// Grok clips: the part of each source clip that was kept (original clip seconds). prep-assets.py uses the same table.
const CLIP_TRIM = { A01: [0.0, 5.4], I1: [5.0, 7.4], I2: [5.0, 7.2], I3: [8.3, 10.5], I4: [5.5, 11.2], V2: [0.0, 6.04], V5: [0.2, 6.5], G3: [4.6, 7.9], H1: [2.8, 4.4], H3: [0.0, 2.0], F2: [10.8, 13.8] };

// ---------- assets ----------
const CLIPS = {};
async function loadAll(base, onProgress) {
  const jobs = SCENES.map(id => [id, base + id + '.jpg', 'scene']).concat(POSES.map(id => [id, base + id + '.png', 'sprite']), [['L0', base + 'L0.png', 'logo']]);
  const total = jobs.length + Object.keys(CLIP_TRIM).length; let done = 0; const tick = () => { done++; onProgress && onProgress(done / total); };
  await Promise.all(jobs.map(async ([id, url, kind]) => {
    const el = new Image(); el.src = url; await el.decode();
    const [sw, sh] = kind === 'scene' ? [1672, 941] : [el.naturalWidth, el.naturalHeight];
    IMG[id] = { id, el, sw, sh, k: el.naturalWidth / sw, sprite: kind === 'sprite' }; tick();
  }));
  await Promise.allSettled(Object.keys(CLIP_TRIM).map(async id => {
    try { const v = await loadClip(base + 'clip-' + id + '.mp4'); CLIPS[id] = { v, t0: CLIP_TRIM[id][0], dur: v.duration }; IMG['v' + id] = { id: 'v' + id, el: v, sw: 736, sh: 400, k: v.videoWidth / 736 }; }
    catch (e) { console.warn('clip ' + id + ' unavailable, using its still', e); }
    tick();
  }));
  for (const id of POSES) prepSprite(id);
}
function mkVideo() { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; return v; }
function videoReady(v, ms) { return new Promise((ok, bad) => { const done = e => { clearTimeout(tm); v.removeEventListener('loadeddata', y); v.removeEventListener('error', n); e ? bad(e) : ok(); }, y = () => done(), n = () => done(new Error('video error')), tm = setTimeout(() => done(new Error('video timeout')), ms); v.addEventListener('loadeddata', y); v.addEventListener('error', n); if (v.readyState >= 2) done(); }); }
async function loadClip(url) {
  try { const r = await fetch(url); if (!r.ok) throw new Error('http ' + r.status); const v = mkVideo(); v.src = URL.createObjectURL(await r.blob()); await videoReady(v, 20000); return v; }
  catch (e) { const v = mkVideo(); v.src = url; v.load(); await videoReady(v, 45000); return v; }
}
// draw a Grok clip (its own 736x400 pixel space), or its source still if the clip didn't load
const clipCam = (g, id, c) => CLIPS[id] ? drawCam(g, 'v' + id, c) : drawCam(g, id, { ...c, x: c.x * 1672 / 736, y: c.y * 941 / 400 });
const AUX = {};
function prepareEdit() {
  makeShards(); makeSakura();
  AUX.over = mk(W, H); AUX.spin = mk(W, H);
  AUX.vig = (() => { const c = mk(W, H), g = c.g, gr = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); gr.addColorStop(0, 'rgba(10,8,40,0)'); gr.addColorStop(1, 'rgba(10,8,40,.42)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); return c; })();
}
// pink sakura petals (the engine's petals are red rose petals)
function makeSakura() {
  SPR.sakura = []; SPR.sakuraBlur = [];
  [['#ffd3e2', '#f59ab8'], ['#ffe4ee', '#f7a9c4'], ['#ffc2d7', '#ee86ab'], ['#fff0f5', '#f8b8cf']].forEach(([c0, c1], v) => {
    const S = 160, c = mk(S, S), g = c.g; g.translate(S / 2, S / 2); g.rotate(v * .8); g.scale(46, 60);
    const p = new Path2D(); p.moveTo(0, 1); p.bezierCurveTo(-1, .5, -.9, -.7, -.22, -1); p.lineTo(0, -.78); p.lineTo(.22, -1); p.bezierCurveTo(.9, -.7, 1, .5, 0, 1);
    const gr = g.createRadialGradient(0, .7, .05, 0, 0, 1.2); gr.addColorStop(0, c1); gr.addColorStop(.5, c0); gr.addColorStop(1, c0); g.fillStyle = gr; g.fill(p);
    g.strokeStyle = 'rgba(220,120,160,.45)'; g.lineWidth = .04; g.stroke(p); SPR.sakura.push(c);
    const s1 = mk(20, 20); s1.g.drawImage(c, 0, 0, 20, 20); const b = mk(S, S); b.g.drawImage(s1, 0, 0, S, S); SPR.sakuraBlur.push(b);
  });
}
function sakura(g, t, o) { const P = SPR.petal, B = SPR.petalBlur; SPR.petal = SPR.sakura; SPR.petalBlur = SPR.sakuraBlur; try { petals(g, t, o); } finally { SPR.petal = P; SPR.petalBlur = B; } }

// ---------- clips: seeking and live sync ----------
function clipLocal(id, ct) { const C = CLIPS[id]; return C ? clamp(ct - C.t0, 0, C.dur - .03) : 0; }
function neededClips(t) {
  const out = {}, add = (k, tt) => { const S = SHOTS[k]; if (!S || !S.clip) return; const c = S.clip(tt); if (c && CLIPS[c[0]]) out[c[0]] = { ct: c[1], rate: c[2] ?? 1 }; };
  for (const tr of TRANS) if ((tr.type === 'dissolve' || tr.type === 'slash' || tr.type === 'star') && t >= tr.t && t < tr.t + (tr.post || 0)) add(shotIndex(tr.t - .001), t);
  add(shotIndex(t), t);
  return out;
}
function seekVideo(v, lt) { if (Math.abs(v.currentTime - lt) < 1e-3 && !v.seeking) return Promise.resolve(); return new Promise(ok => { const done = () => { v.removeEventListener('seeked', done); ok(); }; v.addEventListener('seeked', done); v.currentTime = lt; setTimeout(done, 3000); }); }
window.beforeFrame = async t => { const need = neededClips(t); await Promise.all(Object.entries(need).map(([id, c]) => seekVideo(CLIPS[id].v, clipLocal(id, c.ct)))); };
window.syncClips = (t, playing) => {
  const need = neededClips(t), i = shotIndex(t), N = SHOTS[i + 1];
  if (N && N.clip && N.t - t < .5) { const c = N.clip(N.t); if (c && CLIPS[c[0]] && !need[c[0]]) need[c[0]] = { ct: c[1], rate: c[2] ?? 1, cue: true }; }
  for (const id in CLIPS) {
    const v = CLIPS[id].v, c = need[id];
    if (!c) { if (!v.paused) v.pause(); continue; }
    const lt = clipLocal(id, c.ct);
    if (!playing || c.cue) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - lt) > .03 && !v.seeking) { v.currentTime = lt; v.addEventListener('seeked', () => { window.__redraw = true; }, { once: true }); } continue; }
    if (v.playbackRate !== c.rate) v.playbackRate = c.rate;
    if (v.paused) { v.currentTime = lt; v.play().catch(() => {}); } else if (Math.abs(v.currentTime - lt) > .12 && !v.seeking) v.currentTime = lt;
  }
};

// ---------- helpers ----------
function beatIdx(t) { let lo = 0, hi = BEATS.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (BEATS[m] <= t) { a = m; lo = m + 1; } else hi = m - 1; } return a; }
function pulse(t, decay = 9) { const i = beatIdx(t); return i < 0 ? 0 : Math.exp(-(t - BEATS[i]) * decay); }
const bp = (t, amt) => 1 + amt * pulse(t);
const after = (t, T, k = 6) => t >= T ? Math.exp(-(t - T) * k) : 0;
const glint = (t, T, w = 6) => Math.exp(-Math.abs(t - T) * w) * (t > T - .35 ? 1 : 0);
const fl = (t, a = 1, s = 0) => ({ dx: a * (Math.sin(t * .53 + s) * 7 + Math.sin(t * 1.31 + s * 2) * 2.5), dy: a * (Math.cos(t * .47 + s) * 5 + Math.sin(t * 1.13 + s) * 2), r: a * .0018 * Math.sin(t * .61 + s) });
const cam = (x, y, z, r = 0, f) => ({ x, y, z, r: r + (f ? f.r : 0), dx: f ? f.dx : 0, dy: f ? f.dy : 0 });
const tremble = (t, a) => ({ dx: a * (Math.sin(t * 61) * .6 + Math.sin(t * 37) * .4), dy: a * (Math.cos(t * 53) * .6 + Math.sin(t * 29) * .4), r: 0 });
const addF = (f1, f2) => ({ dx: f1.dx + f2.dx, dy: f1.dy + f2.dy, r: f1.r + f2.r });
const pt = (C, x, y) => mapPt(C, x, y);
const faceGuard = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1;
function spaced(g, s, sp) { let w = 0; for (const ch of s) w += g.measureText(ch).width + sp; return w - sp; }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function starPath(g, cx, cy, R, rot = 0, inner = .46, begin = true) { if (begin) g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * inner : R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
// sparkling 4-point glints scattered over the frame
function sparkles(g, t, n, seed, o = {}) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H * (o.yMax ?? 1), ph = r() * TAU, sp = 1.5 + r() * 3, s = (o.size || 16) * (.4 + r()); const a = Math.max(0, Math.sin(t * sp + ph)) ** 3 * (o.alpha ?? .9); if (a < .02 || (o.region && !o.region(x, y))) continue; sparkle(g, x, y, s * a, a, ph, o.tint || '255,248,236'); } }
function shootingStar(g, t, T, x0, y0, x1, y1, dur = .7, w = 4) { const p = seg(t, T, T + dur); if (p <= 0 || p >= 1) return; const e = E.out(p), x = lerp(x0, x1, e), y = lerp(y0, y1, e), a = Math.sin(p * Math.PI);
  g.save(); g.globalCompositeOperation = 'screen'; const L = 420, dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy); const gr = g.createLinearGradient(x - dx / n * L, y - dy / n * L, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,250,230,${a.toFixed(3)})`);
  g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - dx / n * L, y - dy / n * L); g.lineTo(x, y); g.stroke(); g.restore(); sparkle(g, x, y, 28 * a, a, p * 3); }
// a meteor shower: deterministic streaks, each repeating on its own period
function meteors(g, t, o = {}) { const r = rng(o.seed || 21); for (let i = 0; i < (o.n || 10); i++) { const per = 1.2 + r() * 1.8, ph = r() * per, x0 = W * (.25 + r() * .9), y0 = -40 + r() * H * .25, len = 500 + r() * 500, T = Math.floor((t + ph) / per) * per - ph;
  shootingStar(g, t, T, x0, y0, x0 - len, y0 + len * (.45 + r() * .2), .75, 2 + r() * 3); } }
function confetti(g, t, T, o = {}) { const age = t - T; if (age < 0) return; const r = rng(o.seed || 17), cols = ['#ff8a2a', '#5a78ff', '#ff6fae', '#2fd49a', '#ffd36b', '#ffffff'];
  for (let i = 0; i < (o.n || 120); i++) { const x0 = r() * W, v = 160 + r() * 260, sw = 30 + r() * 60, ph = r() * TAU, sp = 2 + r() * 5, s = 8 + r() * 12, c = cols[i % 6], y0 = -40 - r() * H * (o.spread ?? .8);
    const y = y0 + v * age, x = x0 + Math.sin(age * 2 + ph) * sw; if (y > H + 30) continue; g.save(); g.translate(x, y); g.rotate(ph + age * sp); g.scale(Math.cos(age * sp * 1.3 + ph), 1); g.fillStyle = c; g.fillRect(-s / 2, -s * .3, s, s * .6); g.restore(); } }
// idol card: member-colour burst with rays, dots and glints
function idolCard(g, t, m, o = {}) {
  const c = MEM[m], cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, gr = g.createRadialGradient(cx, cy, 40, cx, cy, W * .8);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.2, c.col); gr.addColorStop(1, c.dark); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  wedgeRays(g, cx, cy, 32, t * .15 + (o.rot || 0), 'rgba(255,255,255,1)', .15);
  g.drawImage(halftone('w' + m, 'rgba(255,255,255,.28)', 26, .35), 0, 0);
  sparkles(g, t, 26, 7 + m.charCodeAt(0), { size: 22 });
}
function penlights(g, t, o = {}) { const r = rng(o.seed || 5), cols = ['255,138,42', '90,140,255', '255,111,174', '47,212,154'], n = o.n || 150, sw = Math.sin((beatIdx(t) % 2 ? 1 : -1) * Math.PI / 2 * (1 - pulse(t, 7)));
  g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = r() * W, y = H * (o.y0 ?? .7) + r() * H * .35, L = 40 + r() * 30, c = cols[i % 4], ang = -Math.PI / 2 + (sw * .45 + (r() - .5) * .2);
    g.strokeStyle = `rgba(${c},.95)`; g.lineWidth = 7; g.shadowColor = `rgba(${c},1)`; g.shadowBlur = 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke(); }
  g.restore(); if (o.heads !== false) { g.fillStyle = 'rgba(10,10,28,.9)'; for (let i = 0; i < 26; i++) { const x = (i + .5) / 26 * W, hh = 80 + h1(i) * 60; g.beginPath(); g.ellipse(x, H + 30 - hh * .2, 50, hh, 0, 0, TAU); g.fill(); } }
}

// ---------- graphics: countdown numbers, logo, name cards, calls, credits ----------
function bigNumber(g, t, T, txt, m, o = {}) {
  const lt = t - T; if (lt < 0) return; const c = MEM[m], s = lerp(2.2, 1, E.outBack(seg(lt, 0, .22))) * (1 + .02 * lt), size = o.size || 620, a = o.outAt ? 1 - seg(t, o.outAt, o.outAt + .12) : 1; if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(o.x ?? W * .7, o.y ?? H * .52); g.rotate(o.rot ?? -.06); g.scale(s, s); g.font = `900 ${size}px ${RD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * .09; g.strokeStyle = '#fff'; g.strokeText(txt, 0, 0); g.lineWidth = size * .04; g.strokeStyle = c.dark; g.strokeText(txt, 0, 0);
  const gr = g.createLinearGradient(0, -size * .4, 0, size * .4); gr.addColorStop(0, '#fff'); gr.addColorStop(.35, c.col); gr.addColorStop(1, c.dark); g.fillStyle = gr; g.shadowColor = `rgba(${c.rgb},.9)`; g.shadowBlur = 40; g.fillText(txt, 0, 0);
  g.restore(); if (lt < .5 && a > 0) { g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = `rgba(255,255,255,${(1 - lt / .5).toFixed(3)})`; g.lineWidth = 10 * (1 - lt / .5); g.beginPath(); g.arc(o.x ?? W * .7, o.y ?? H * .52, 80 + lt * 1400, 0, TAU); g.stroke(); g.restore(); }
}
function logoDrop(g, t, T, o = {}) {
  const lt = t - T; if (lt < 0) return; const I = IMG.L0, out = o.outAt ? seg(t, o.outAt, o.outAt + .25) : 0; if (out >= 1) return;
  const s = lerp(1.9, 1, E.outBack(seg(lt, 0, .28))) * (o.scale || .86) * (1 + .012 * lt) * (1 + .025 * pulse(t, 10)), w = W * s, h = w * I.sh / I.sw, x = o.x ?? W / 2, y = (o.y ?? H * .3) - 40 * out;
  g.save(); g.globalAlpha = seg(lt, 0, .06) * (1 - out); g.translate(x, y); g.rotate(-.03 * Math.exp(-lt * 3)); g.drawImage(I.el, -w / 2, -h / 2, w, h); g.restore();
  const sh = o.shine ?? T + .45, sp = seg(t, sh, sh + .5); if (sp > 0 && sp < 1) { g.save(); g.globalAlpha = 1 - out; g.globalCompositeOperation = 'screen'; const gx = lerp(x - w * .45, x + w * .45, sp), gr = g.createLinearGradient(gx - 90, 0, gx + 90, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.translate(0, 0); g.fillRect(gx - 90, y - h * .22, 180, h * .44); g.restore(); }
  if (lt < .9) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + .3, d = 200 + E.out(seg(lt, 0, .9)) * 760; sparkle(g, x + Math.cos(a) * d, y + Math.sin(a) * d * .55, 44 * (1 - lt / .9), 1 - lt / .9, lt * 4); }
}
function nameCard(g, t, T0, m, side = 'L', outAt = 99) {
  const p = E.outBack(seg(t, T0 + .05, T0 + .4)) * (1 - E.in(seg(t, outAt, outAt + .2))), c = MEM[m]; if (p <= 0) return; const x0 = side === 'L' ? lerp(-700, 70, p) : lerp(W + 700, W - 690, p), y = H - 310;
  g.save(); g.translate(x0, y); g.rotate(-.04);
  g.shadowColor = 'rgba(20,10,60,.35)'; g.shadowBlur = 24; g.shadowOffsetY = 8; g.fillStyle = 'rgba(255,255,255,.95)'; roundRect(g, 0, 0, 620, 172, 38); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = c.col; roundRect(g, 0, 0, 30, 172, 15); g.fill();
  g.font = `900 74px ${RD}`; g.fillStyle = c.dark; g.textBaseline = 'alphabetic'; g.fillText(c.jp, 58, 88);
  g.font = `800 26px ${RD}`; g.fillStyle = c.col; let cx = 62; for (const ch of c.ro) { g.fillText(ch, cx, 126); cx += g.measureText(ch).width + 4; }
  g.font = `700 22px ${RD}`; g.fillStyle = '#6b6e8f'; g.fillText(c.tag, 62, 156);
  starPath(g, 578, 36, 22, t * 1.5); g.fillStyle = c.col; g.fill();
  g.restore(); sparkle(g, x0 + 600, y + 14, 34 * p, p, t * 2, c.rgb);
}
function haiCall(g, t, T, m, x, y, rot = 0, size = 150) { const lt = t - T; if (lt < 0 || lt > .5) return; const c = MEM[m], s = lerp(1.8, 1, E.outBack(seg(lt, 0, .14))), a = 1 - seg(lt, .3, .5);
  g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot); g.scale(s, s); g.font = `900 ${size}px ${RD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * .15; g.strokeStyle = '#fff'; g.strokeText('Hai!', 0, 0); g.fillStyle = c.col; g.shadowColor = `rgba(${c.rgb},1)`; g.shadowBlur = 30; g.fillText('Hai!', 0, 0); g.restore(); }
function wordSlam(g, t, T, word, o = {}) { const lt = t - T; if (lt < 0 || (o.until && t > o.until + .2)) return; const size = o.size || 200, s = lerp(2.4, 1, E.outBack(seg(lt, 0, .2))), a = o.until ? 1 - seg(t, o.until, o.until + .2) : 1;
  g.save(); g.globalAlpha = a; g.translate(o.x ?? W / 2, o.y ?? H * .72); g.rotate(o.rot ?? -.05); g.scale(s, s); g.font = `900 ${size}px ${RD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * .17; g.strokeStyle = '#fff'; g.strokeText(word, 0, 0); g.lineWidth = size * .06; g.strokeStyle = '#1b1a4a'; g.strokeText(word, 0, 0);
  const w = g.measureText(word).width, gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, '#ff8a2a'); gr.addColorStop(.33, '#5a78ff'); gr.addColorStop(.66, '#ff6fae'); gr.addColorStop(1, '#2fd49a'); g.fillStyle = gr; g.fillText(word, 0, 0); g.restore();
  if (lt < .6) for (let k = 0; k < 8; k++) { const a2 = k / 8 * TAU, d = 160 + lt * 900; sparkle(g, (o.x ?? W / 2) + Math.cos(a2) * d, (o.y ?? H * .72) + Math.sin(a2) * d * .5, 40 * (1 - lt / .6), 1 - lt / .6, lt * 5); } }
// dance-break calls: \u30ad\u30fb\u30e9\u30fb\u30ad\u30fb\u30e9 pop in one syllable at a time, then \u30b8\u30e3\u30f3\u30d7! / \u30bf\u30fc\u30f3! slams in
function danceCall(g, t, L) {
  const hide = L.hide; if (t < L.s - .05 || t > hide + .2) return; const out = seg(t, hide, hide + .2);
  const chars = L.ch.filter(c => c[0] !== ' '), sep = chars.findIndex(c => c[0] === '\u3000'), w1 = chars.slice(0, sep), w2 = chars.slice(sep + 1), cols = ['K', 'R', 'M', 'N'], size = 118, gap = size * 1.08, x0 = W / 2 - (w1.length - 1) * gap / 2;
  g.save(); g.globalAlpha = 1 - out;
  w1.forEach(([c, T], k) => { if (t < T) return; const lt = t - T, s = lerp(1.9, 1, E.outBack(seg(lt, 0, .16))), m = MEM[cols[k % 4]];
    g.save(); g.translate(x0 + k * gap, H * .13 + (k % 2 ? 12 : -12)); g.rotate(k % 2 ? .09 : -.09); g.scale(s, s); g.font = `900 ${size}px ${RD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = '#fff'; g.strokeText(c, 0, 0); g.fillStyle = m.col; g.shadowColor = `rgba(${m.rgb},.9)`; g.shadowBlur = 24; g.fillText(c, 0, 0); g.restore(); });
  g.restore();
  if (w2.length) wordSlam(g, t, w2[0][1], w2.map(c => c[0]).join(''), { until: hide });
  if (L.en) { const ea = seg(t, L.s, L.s + .2) * (1 - out); g.save(); g.globalAlpha = ea; g.font = `800 36px ${RD}`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(15,12,40,.85)'; g.strokeText(L.en, W / 2, H - 62); g.fillStyle = '#fff8f0'; g.fillText(L.en, W / 2, H - 62); g.restore(); }
}
// karaoke: the romaji lights up syllable by syllable at the top, the English sits at the bottom
const KARA_COL = { Verse: ['#ff9fc8', '#ff5fa8'], Chorus: ['#ffe08a', '#ff9a3c'], 'Final chorus': ['#b8e8ff', '#6f8cff'] };
function karaoke(g, t) {
  for (const L of LYRICS) {
    if (L.kind !== 'ja' || L.sec === 'Dance') continue; const show = L.show, hide = L.hide, fd = L.fade; if (t < show || t > hide + fd) continue;
    const a = seg(t, show, show + .15) * (1 - seg(t, hide, hide + fd)), [c0, c1] = KARA_COL[L.sec] || KARA_COL.Verse, size = 52, y = 88;
    g.save(); g.globalAlpha = a; g.font = `800 ${size}px ${RD}`; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const parts = L.kara.map(k => k[0] + (k[3] ? ' ' : '')), widths = parts.map(p => g.measureText(p).width), tw = widths.reduce((q, b) => q + b, 0);
    let x = W / 2 - tw / 2;
    L.kara.forEach(([syl, t0, t1], k) => {
      const sw = g.measureText(syl).width, p = clamp((t - t0) / Math.max(.08, t1 - t0)), pop = 1 + .15 * Math.exp(-Math.max(0, t - t0) * 9) * (t >= t0 ? 1 : 0);
      g.save(); g.translate(x + sw / 2, y); g.scale(pop, pop); g.translate(-sw / 2, 0);
      g.lineWidth = 13; g.strokeStyle = 'rgba(20,16,50,.8)'; g.strokeText(syl, 0, 0); g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText(syl, 0, 0); g.fillStyle = '#ffffff'; g.fillText(syl, 0, 0);
      if (p > 0) { g.save(); g.beginPath(); g.rect(-4, -size, (sw + 8) * p, size * 2); g.clip(); const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.shadowColor = c1; g.shadowBlur = 16; g.fillText(syl, 0, 0); g.restore(); }
      g.restore(); if (p > 0 && p < 1) sparkle(g, x + sw * p, y, 15, .9, t * 6);
      x += widths[k];
    });
    if (L.en) { const ea = seg(t, show, show + .2) * (1 - seg(t, hide, hide + fd)); g.globalAlpha = ea; g.font = `800 36px ${RD}`; g.textAlign = 'center'; g.lineWidth = 9; g.strokeStyle = 'rgba(15,12,40,.85)'; g.strokeText(L.en, W / 2, H - 62); g.fillStyle = '#fff8f0'; g.fillText(L.en, W / 2, H - 62); }
    g.restore();
  }
}
// fictional staff credits, like a real TV opening
const CREDITS = [[20.2, 22.6, '\u539f\u4f5c', '\u661f\u898b\u5742\u5b66\u5712\u5929\u6587\u90e8'], [22.9, 25.6, '\u76e3\u7763', '\u6d41\u661f \u5149'], [26.0, 28.8, '\u30b7\u30ea\u30fc\u30ba\u69cb\u6210', '\u591c\u7a7a \u7d21'], [29.1, 31.1, '\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u30c7\u30b6\u30a4\u30f3', '\u5929\u5ddd \u3059\u3070\u308b'],
  [31.5, 33.5, '\u97f3\u697d', '\u9280\u6cb3 \u30cf\u30eb\u30ab'], [34.0, 36.0, '\u7f8e\u8853\u76e3\u7763', '\u661f\u5c51 \u30df\u30aa'], [36.4, 39.2, '\u64ae\u5f71\u76e3\u7763', '\u5f57\u661f \u30bd\u30e9'], [39.5, 41.8, '\u8272\u5f69\u8a2d\u8a08', '\u8679\u91ce \u3042\u307e\u306d'], [44.9, 47.0, '\u30a2\u30cb\u30e1\u30fc\u30b7\u30e7\u30f3\u5236\u4f5c', '\u30b9\u30bf\u30b8\u30aa\u30fb\u30b9\u30bf\u30fc\u30c0\u30c3\u30b7\u30e5']];
function credits(g, t) {
  for (const [a, b, role, name] of CREDITS) { if (t < a || t > b) continue; const al = seg(t, a, a + .3) * (1 - seg(t, b - .3, b));
    g.save(); g.globalAlpha = al; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.shadowColor = 'rgba(10,8,40,.9)'; g.shadowBlur = 10;
    g.font = `700 24px ${RD}`; g.fillStyle = '#fff'; g.fillText(role, W - 64, H - 190); g.font = `800 42px ${RD}`; g.fillText(name, W - 64, H - 142); g.restore(); }
  if (t >= 5.2 && t < 6.95) { const al = seg(t, 5.2, 5.5) * (1 - seg(t, 6.6, 6.95)); g.save(); g.globalAlpha = al; g.textAlign = 'center'; g.shadowColor = 'rgba(10,8,40,.9)'; g.shadowBlur = 12; g.fillStyle = '#fff';
    g.font = `800 34px ${RD}`; g.fillText('OP\u4e3b\u984c\u6b4c\u300c3\u30fb2\u30fb1 STAR DASH!\u300d  \u6b4c\uff1aSTAR\u2606DASH', W / 2, H - 60); g.restore(); }
}

// every string drawn on screen, so the page can load those glyphs of the rounded font before rendering
const EXTRA_TEXT = Object.values(MEM).map(m => m.jp + m.ro + m.tag).join('') + CREDITS.map(c => c[2] + c[3]).join('') + 'OP\u4e3b\u984c\u6b4c\u300c3\u30fb2\u30fb1 STAR DASH!\u300d\u6b4c\uff1aSTAR\u2606DASH\u2665\u2605Hai!DASH!';

// ---------- the shots ----------
const SHOTS = [];
const shot = (t, name, draw, o = {}) => SHOTS.push({ t, name, draw, clip: o.clip, bloom: o.bloom });
const clipAt = (id, t0, c0, rate = 1) => t => [id, c0 + (t - t0) * rate, rate];

// 00:00 cold open on the key visual (Grok clip), crash at 0.38
shot(0, 'Key visual', (g, t) => {
  const C = clipCam(g, 'A01', cam(368, 200, 1.0 + .02 * t)); sparkles(g, t, 24, 3, { yMax: .5 });
  if (t >= .38) flash(g, .55 * after(t, .38, 6));
}, { clip: clipAt('A01', 0, 0) });
// 00:00.86 countdown "3, 2, 1": one girl per number, on her colour
[[.86, 'R', 'C1', '3'], [1.55, 'M', 'C2', '2'], [2.25, 'N', 'C3', '1']].forEach(([T, m, id, n]) => shot(T, 'Count ' + n, (g, t) => {
  idolCard(g, t, m, { cx: W * .34, rot: T }); const lt = t - T, pop = 1 + .09 * Math.exp(-lt * 11);
  g.save(); g.translate(W * .34, H); g.scale(pop, pop); g.translate(-W * .34, -H); drawSprite(g, id, { x: W * .34, y: H - 14, h: 1010, outline: 'white', outlineW: 6, shadow: .25 }); g.restore();
  bigNumber(g, t, T, n, m, { x: W * .72, y: H * .5 });
}, { bloom: .15 }));
shot(2.60, 'Count STAR', (g, t) => {
  idolCard(g, t, 'K'); const lt = t - 2.60, pop = 1 + .09 * Math.exp(-lt * 11);
  g.save(); g.translate(W / 2, H * .5); g.scale(pop, pop); g.translate(-W / 2, -H * .5); drawSprite(g, 'C4', { x: W / 2, y: H - 30, h: 980, outline: 'white', outlineW: 6, shadow: .25 }); g.restore();
  bigNumber(g, t, 2.60, 'STAR', 'K', { x: W / 2, y: H * .8, size: 270, rot: -.04 });
}, { bloom: .15 });
// 00:02.95 "DASH!": the logo drops over the key visual (the clip picks up where the cold open left it)
shot(2.95, 'Logo', (g, t) => {
  const C = clipCam(g, 'A01', cam(368, 205, 1.02 + .015 * (t - 2.95) + .03 * after(t, 4.67, 4)));
  shootingStar(g, t, 4.67, W * .92, H * .06, W * .38, H * .3, .9, 5); sparkles(g, t, 40, 9, { yMax: .6 });
  logoDrop(g, t, 2.95, { y: H * .2, scale: .74, outAt: 6.85, shine: 4.67 }); if (t >= 4.67) flash(g, .45 * after(t, 4.67, 5));
}, { clip: clipAt('A01', 2.95, .86) });
// 00:07.11 the school on the hill; 08.50 the observatory; 09.87 the clubroom
shot(7.11, 'School', (g, t) => { const k = E.inOut(seg(t, 7.11, 8.7)); const C = drawCam(g, 'A02', cam(lerp(560, 1060, k), lerp(430, 380, k), lerp(1.18, 1.1, k), 0, fl(t, .4, 1)));
  const s = pt(C, 298, 395); glowAt(g, 'warm', s[0], s[1], 360, .5); flare(g, s[0], s[1], 90, .35); sakura(g, t, { n: 26, seed: 4, speed: 60, vx: .5, vy: .8, sMin: 10, sMax: 34, alpha: .9 }); grade(g, { tint: '#ffb070', tintA: .08 }); });
shot(8.50, 'Observatory', (g, t) => { const k = E.inOut(seg(t, 8.5, 10.1)); const C = drawCam(g, 'A03', cam(lerp(760, 480, k), lerp(470, 520, k), lerp(1.04, 1.32, k), 0, fl(t, .4, 2)));
  const s = pt(C, 1323, 590); glowAt(g, 'warm', s[0], s[1], 300, .45); const gd = pt(C, 306, 550); for (let k2 = 0; k2 < 6; k2++) sparkle(g, gd[0] - 120 + k2 * 55, gd[1] - 30 + Math.sin(k2) * 14, 14 * (.5 + .5 * Math.sin(t * 4 + k2)), .8, t + k2, '255,236,190'); });
shot(9.87, 'Clubroom', (g, t) => { const k = E.inOut(seg(t, 9.87, 11.9)); drawCam(g, 'A04', cam(lerp(520, 1150, k), lerp(430, 390, k), 1.16, 0, fl(t, .4, 3)));
  motes(g, t, { n: 40, seed: 5, speed: 10, size: 3.5, alpha: .55, spr: 'warm' }); grade(g, { tint: '#ffb070', tintA: .08 }); });
// 00:11.90 countdown #2 on their faces
[[11.90, 'D1', 'K', '3', 420, 1.12], [12.58, 'D2', 'N', '2', 440, 1.1], [13.30, 'D3', 'R', '1', 400, 1.12], [13.65, 'D4', 'M', '\u2605', 440, 1.1]].forEach(([T, id, m, n, y, z]) => shot(T, 'Close ' + id, (g, t) => {
  const lt = t - T; drawCam(g, id, cam(836, y, z * (1 + .1 * Math.exp(-lt * 9)) * (1 + .03 * lt), 0, fl(t, .3, T))); sparkles(g, t, 14, T * 10, { size: 20 });
  if (n === '\u2605') { bigNumber(g, t, T, 'STAR', m, { x: W * .8, y: H * .3, size: 250 }); } else bigNumber(g, t, T, n, m, { x: W * .84, y: H * .46, size: 480 });
}));
// 00:13.98 "DASH!" then the four intros (Grok clips) with name cards
shot(13.98, 'Kokona', (g, t) => { clipCam(g, 'I1', cam(368, 200, 1.0 + .03 * (t - 13.98))); sparkles(g, t, 16, 11, { yMax: .5 }); nameCard(g, t, 13.98, 'K', 'L', 15.2); bigNumber(g, t, 13.98, 'DASH!', 'K', { x: W * .3, y: H * .42, size: 280, outAt: 14.36 }); }, { clip: clipAt('I1', 13.98, 5.3, 1.12) });
shot(15.41, 'Rei', (g, t) => { clipCam(g, 'I2', cam(380, 200, 1.02 + .03 * (t - 15.41))); sparkles(g, t, 20, 12, { yMax: .45, tint: '220,230,255' }); nameCard(g, t, 15.61, 'R', 'L', 16.58); }, { clip: clipAt('I2', 15.41, 5.2, 1.16) });
shot(16.79, 'Mimi', (g, t) => { clipCam(g, 'I3', cam(380, 200, 1.02 + .03 * (t - 16.79))); sparkles(g, t, 16, 13); nameCard(g, t, 16.99, 'M', 'L', 17.95); }, { clip: clipAt('I3', 16.79, 8.5, 1.17) });
shot(18.16, 'Nagi', (g, t) => { clipCam(g, 'I4', cam(368, 200, 1.02 + .02 * (t - 18.16) + .04 * after(t, 18.51, 6))); sparkles(g, t, 14, 14, { yMax: .5 }); nameCard(g, t, 18.36, 'N', 'L', 19.72); if (t >= 18.51) flash(g, .3 * after(t, 18.51, 9)); },
  { clip: t => t < 18.51 ? ['I4', 5.6 + (t - 18.16), 1] : ['I4', 9.45 + (t - 18.51), 1] });
// 00:19.94 \u653e\u8ab2\u5f8c\u306e\u5c4b\u4e0a\u3067 \u898b\u3064\u3051\u305f \u5c0f\u3055\u306a\u5149 - the rooftop; the first star glints on \u5149
shot(19.94, 'First star', (g, t) => {
  const k1 = E.inOut(seg(t, 19.94, 23.6)), k2 = E.inOut(seg(t, 23.6, 25.6));
  const C = drawCam(g, 'V1', cam(lerp(lerp(900, 880, k1), 430, k2), lerp(lerp(470, 440, k1), 190, k2), lerp(lerp(1.02, 1.12, k1), 1.55, k2), 0, fl(t, .35, 4)));
  const s = pt(C, 239, 48), gs = glint(t, 24.58, 2.5); glowAt(g, 'white', s[0], s[1], 90 + 260 * gs, .5 + .5 * gs); sparkle(g, s[0], s[1], 26 + 60 * gs, 1, t * .5); rays(g, s[0], s[1], { n: 10, len: 700, spread: TAU, angle: t * .2, width: 20, alpha: .08 + .2 * gs, color: '255,246,220', t, seed: 6 });
  sakura(g, t, { n: 16, seed: 7, speed: 50, vx: .6, vy: .7, sMin: 10, sMax: 30, alpha: .8 }); grade(g, { tint: '#ffb070', tintA: .06 });
});
// 00:25.82 \u300c\u3053\u3053\u304b\u3089\u59cb\u3081\u3088\u3046\u300d\u3063\u3066 \u541b\u304c\u7b11\u3063\u305f - Kokona turns and reaches for you (Grok clip)
shot(25.82, 'Lets start', (g, t) => { const C = clipCam(g, 'V2', cam(368, 200, 1.0 + .06 * seg(t, 25.82, 31.26))); const s = pt(C, 130, 150); glowAt(g, 'warm', s[0], s[1], 420, .3 + .2 * seg(t, 28, 30));
  sparkles(g, t, 18, 15, { yMax: .6 }); sakura(g, t, { n: 12, seed: 8, speed: 45, vx: .5, vy: .7, sMin: 10, sMax: 30, alpha: .8 }); }, { clip: clipAt('V2', 25.82, .2, 1.066) });
// 00:31.26 \u671b\u9060\u93e1\u3058\u3083 \u5c4a\u304b\u306a\u3044 - Rei at the telescope
shot(31.26, 'Telescope', (g, t) => { const k = E.inOut(seg(t, 31.26, 33.64)); const C = drawCam(g, 'V3', cam(lerp(820, 720, k), lerp(470, 400, k), lerp(1.02, 1.28, k), 0, fl(t, .3, 5)));
  const l = pt(C, 590, 300), gl = glint(t, 32.52, 3); sparkle(g, l[0], l[1], 40 * gl, gl, .3, '220,230,255'); sparkles(g, t, 30, 16, { size: 14, tint: '220,230,255', region: (x, y) => x > W * .55 && y < H * .5 }); });
// 00:33.64 \u5922\u306e\u661f\u5ea7 - the Milky Way; a star-shaped constellation draws itself
shot(33.64, 'Constellation', (g, t) => { const k = E.inOut(seg(t, 33.64, 36.18)); const C = drawCam(g, 'V4', cam(lerp(760, 820, k), lerp(520, 430, k), lerp(1.12, 1.04, k), 0, fl(t, .3, 6)));
  const cx = W * .42, cy = H * .38, R = 250, P = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + .1, r = i % 2 ? R * .46 : R; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  const n = seg(t, 33.9, 35.5) * P.length; g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = 'rgba(255,240,200,.85)'; g.lineWidth = 3; g.shadowColor = 'rgba(255,220,150,1)'; g.shadowBlur = 14; g.beginPath();
  for (let i = 0; i <= Math.floor(n); i++) { const [x, y] = P[i % 10]; i ? g.lineTo(x, y) : g.moveTo(x, y); } if (n < 10 && n > 0) { const i = Math.floor(n), [x0, y0] = P[i % 10], [x1, y1] = P[(i + 1) % 10], f = n - i; g.lineTo(lerp(x0, x1, f), lerp(y0, y1, f)); } g.stroke(); g.restore();
  P.forEach(([x, y], i) => { if (i <= n) sparkle(g, x, y, (i % 2 ? 14 : 24) * (1 + .3 * Math.sin(t * 5 + i)), 1, t + i); }); if (t > 35.5) glowAt(g, 'gold', cx, cy, 420, .35 * glint(t, 35.6, 2));
  sparkles(g, t, 30, 17, { size: 14 }); });
// 00:36.18 \u306a\u3089 \u3053\u306e\u8db3\u3067 \u4f1a\u3044\u306b\u884c\u3053\u3046 - the four run down the hill (Grok clip)
shot(36.18, 'Run', (g, t) => { clipCam(g, 'V5', cam(368, 200, 1.02 + .03 * seg(t, 36.18, 42.1))); sakura(g, t, { n: 50, seed: 9, travel: (t - 36.18) * 260, vx: .2, vy: 1, sMin: 10, sMax: 40, alpha: .9 }); }, { clip: clipAt('V5', 36.18, .3) });
// 00:42.10 \u30c9\u30ad\u30c9\u30ad\u304c \u6b62\u307e\u3089\u306a\u3044 - Mimi's heartbeat, then eye cuts on each beat
shot(42.10, 'Heartbeat', (g, t) => { const hb = 1 + .05 * pulse(t, 10); drawCam(g, 'P1', cam(760, 380, 1.18 * hb, 0, fl(t, .3, 7))); glowAt(g, 'crimson', W * .5, H * .62, 500, .12 * pulse(t, 8));
  const r = rng(71); for (let i = 0; i < 10; i++) { const T = 42.1 + i * .16, a = seg(t, T, T + 1.2); if (a <= 0 || a >= 1) continue; const x = W * (.2 + r() * .6), y = H * (.8 - a * .6); g.save(); g.globalAlpha = Math.sin(a * Math.PI) * .9; g.font = `900 ${40 + r() * 30}px ${RD}`; g.fillStyle = '#ff6fae'; g.textAlign = 'center'; g.fillText('\u2665', x, y); g.restore(); }
  sparkles(g, t, 16, 18); });
[[43.68, 'D1', 'K', 900, 340, 3.0], [44.02, 'D3', 'R', 754, 322, 3.0], [44.37, 'I4', 'N', 1157, 232, 4.2]].forEach(([T, id, m, x, y, z]) => shot(T, 'Eyes ' + m, (g, t) => {
  drawCam(g, id, cam(x, y, z * (1 + .18 * seg(t, T, T + .5)))); speedLines(g, W / 2, H / 2, t, { n: 70, inner: 520, alpha: .22, color: '#fff', seed: T * 3 }); flash(g, .25 * after(t, T, 10), MEM[m].rgb);
}));
// 00:44.88 \u30ab\u30a6\u30f3\u30c8\u30c0\u30a6\u30f3 \u3082\u3046\u59cb\u307e\u3063\u3066\u308b! - clubroom chaos
shot(44.88, 'Chaos', (g, t) => { const p = E.outExpo(seg(t, 45.39, 45.6)), q = E.outExpo(seg(t, 46.36, 46.6));
  const x = lerp(lerp(836, 520, p), 900, q), y = lerp(lerp(470, 260, p), 450, q), z = lerp(lerp(1.02, 1.45, p), 1.1, q);
  drawCam(g, 'A05', cam(x, y, z * bp(t, .01), 0, addF(fl(t, .4, 8), tremble(t, 2 * after(t, 45.39, 5))))); const f = pt(drawCamInfo('A05', x, y, z), 758, 18); sparkle(g, f[0], f[1] + 20, 40 * glint(t, 45.4, 4), glint(t, 45.4, 4), .2);
  sparkles(g, t, 14, 19); });
function drawCamInfo(id, x, y, z) { return camOf(id, { x, y, z }); }
// 00:47.13 the dark stage: lights flicker as the build rises
shot(47.13, 'Dark stage', (g, t) => { drawCam(g, 'P2', cam(836, 470, 1.04 + .02 * seg(t, 47.13, 50.55))); const fl2 = Math.max(after(t, 47.30, 12), after(t, 47.65, 12), after(t, 48.84, 10), after(t, 49.19, 12), after(t, 49.53, 12), .6 * after(t, 49.87, 8), .6 * after(t, 50.22, 8));
  g.fillStyle = `rgba(4,4,16,${(.93 - .5 * fl2 - .25 * seg(t, 50.0, 50.5)).toFixed(3)})`; g.fillRect(0, 0, W, H); glowAt(g, 'white', W / 2, H * .15, 700, .25 * seg(t, 49.5, 50.5)); });
// 00:50.55 "Three, two, one, STAR" - a spotlight snaps on each girl
function spotStage(g, t, lit) {
  const C = drawCam(g, 'P2', cam(836, 470, 1.04)), X = { R: 306, M: 645, N: 1008, K: 1379 }, o = AUX.over.g;
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, W, H); o.fillStyle = 'rgba(4,4,16,.9)'; o.fillRect(0, 0, W, H); o.globalCompositeOperation = 'destination-out';
  for (const [m, a] of lit) { const p = pt(C, X[m], 470), gr = o.createRadialGradient(p[0], p[1], 60, p[0], p[1], 430); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.7, `rgba(0,0,0,${a * .8})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = gr; o.beginPath(); o.ellipse(p[0], p[1], 300, 560, 0, 0, TAU); o.fill(); }
  g.drawImage(AUX.over, 0, 0);
  for (const [m, a] of lit) { const p = pt(C, X[m], 470), gr = g.createLinearGradient(p[0], 0, p[0], H); gr.addColorStop(0, `rgba(255,255,255,${(.4 * a).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.beginPath(); g.moveTo(p[0] - 40, 0); g.lineTo(p[0] + 40, 0); g.lineTo(p[0] + 260, H); g.lineTo(p[0] - 260, H); g.fill(); g.restore(); }
  return C;
}
shot(50.55, 'Spotlights', (g, t) => { const L = [['R', 50.55, '3'], ['M', 50.90, '2'], ['N', 51.25, '1'], ['K', 51.58, 'STAR']].filter(([m, T]) => t >= T);
  const C = spotStage(g, t, L.map(([m, T]) => [m, 1])), X = { R: 306, M: 645, N: 1008, K: 1379 };
  for (const [m, T, n] of L) { const p = pt(C, X[m], 470); bigNumber(g, t, T, n, m, { x: p[0], y: H * .58, size: n === 'STAR' ? 190 : 330, rot: 0 }); flash(g, .25 * after(t, T, 12)); } });
shot(51.92, 'DASH', (g, t) => { drawCam(g, 'P2', cam(836, 470, 1.04 + .04 * after(t, 51.92, 4))); sparkles(g, t, 40, 20); confetti(g, t, 51.92, { n: 90, spread: .3 }); bigNumber(g, t, 51.92, 'DASH!', 'K', { x: W / 2, y: H * .55, size: 300, rot: -.04 }); });
// 00:52.40 CHORUS \u591c\u7a7a\u3092 \u99c6\u3051\u629c\u3051\u3066 - running across the night sky
shot(52.40, 'Sky run', (g, t) => { const k = E.inOut(seg(t, 52.40, 55.10)), bob = Math.sin((t - 52.40) * TAU * 176.5 / 60) * 6;
  drawCam(g, 'G1', cam(lerp(560, 1100, k), lerp(430, 400, k) + bob, 1.3, 0, fl(t, .3, 9))); speedLines(g, W * .1, H * .45, t, { n: 50, inner: 900, alpha: .12, color: '#fff', seed: 21 });
  sparkles(g, t, 40, 22, { size: 18 }); for (let i = 0; i < 18; i++) { const r = rng(i + 90), x = ((r() * W - (t - 52.4) * 700 * (.6 + r())) % W + W) % W, y = H * (.75 + r() * .25); sparkle(g, x, y, 10 + r() * 16, .9, t + i, '255,236,180'); } });
// 00:55.10 \u6d41\u308c\u661f\u3088\u308a \u901f\u304f \u541b\u306e\u3082\u3068\u3078 - Kokona reaches out; a shooting star
shot(55.10, 'Reach', (g, t) => { const k = E.inOut(seg(t, 55.1, 57.64)); const C = drawCam(g, 'G2', cam(lerp(836, 700, k), lerp(470, 420, k), lerp(1.02, 1.2, k), 0, fl(t, .3, 10)));
  shootingStar(g, t, 55.3, W * 1.02, H * .08, W * .45, H * .32, 1.1, 5); const h = pt(C, 387, 484); glowAt(g, 'warm', h[0], h[1], 300, .2 + .5 * glint(t, 56.5, 2)); sparkles(g, t, 26, 23); });
// 00:57.64 \u5c0f\u3055\u306a\u661f\u3067\u3082 \u8f1d\u3051\u308b\u3063\u3066 - Mimi sings (Grok clip)
shot(57.64, 'Mimi sings', (g, t) => { clipCam(g, 'G3', cam(368, 200, 1.0 + .05 * seg(t, 57.64, 60.28))); sparkles(g, t, 30, 24, { size: 18 }); }, { clip: clipAt('G3', 57.64, 4.8, 1.06) });
// 01:00.28 \u8a3c\u660e\u3059\u308b\u3088 \u4eca\u591c - Rei, then Nagi
shot(60.28, 'Rei and Nagi', (g, t) => { const p = E.inOut(seg(t, 61.38, 61.62)); drawCam(g, 'G4', cam(lerp(640, 1000, p), lerp(300, 290, p), 1.55 + .03 * (t - 60.28), 0, fl(t, .3, 11))); sparkles(g, t, 20, 25); });
// 01:02.10 \u3053\u3053\u3067! - all four point at you
shot(62.10, 'Point', (g, t) => { const p = E.outExpo(seg(t, 62.70, 62.85)); drawCam(g, 'G5', cam(836, lerp(430, 400, p), lerp(1.04, 1.22, p), 0, addF(fl(t, .3, 12), tremble(t, 3 * after(t, 62.7, 6))))); confetti(g, t, 62.1, { n: 110 }); });
// 01:02.93 DANCE BREAK: Hai! Hai! Hai! Hai!
function crowd(g, t, T0, calls, z = 1.04, y = 470) {
  drawCam(g, 'H0', cam(836, y, z * (1 + .05 * pulse(t, 8)), 0, fl(t, .3, T0))); penlights(g, t, { n: 110, y0: .78, heads: false });
  calls.forEach(([T, m, x, yy], k) => haiCall(g, t, T, m, W * x, H * yy, k % 2 ? .1 : -.1));
}
shot(62.93, 'Hai x4', (g, t) => crowd(g, t, 62.93, [[62.93, 'K', .25, .3], [63.28, 'R', .45, .22], [63.62, 'M', .65, .3], [63.97, 'N', .82, .22]]));
shot(64.44, 'Jump', (g, t) => { clipCam(g, 'H1', cam(368, 200, 1.02 + .06 * after(t, 65.5, 4))); sparkles(g, t, 26, 26); if (t >= 65.5) { flash(g, .4 * after(t, 65.5, 7)); confetti(g, t, 65.5, { n: 60, spread: .2, seed: 5 }); } },
  { clip: t => ['H1', 3.5 + (t - 65.02), 1] });
[['K', 65.68, 'HS1'], ['R', 66.02, 'HS2'], ['M', 66.37, 'HS3'], ['N', 66.71, 'HS4']].forEach(([m, T, id], k) => shot(T, 'Hai ' + m, (g, t) => {
  idolCard(g, t, m, { cx: W * .42, rot: k }); const lt = t - T, pop = 1 + .09 * Math.exp(-lt * 11);
  g.save(); g.translate(W * .42, H); g.scale(pop, pop); g.translate(-W * .42, -H); drawSprite(g, id, { x: W * .42, y: H - 14, h: 1030, outline: 'white', outlineW: 6, shadow: .25 }); g.restore();
  haiCall(g, t, T, m, W * .75, H * .42, .08, 190);
}, { bloom: .15 }));
// \u30c9\u30ad\u30c9\u30ad \u30bf\u30fc\u30f3! - they pose; the frame spins on \u30bf\u30fc\u30f3!
function spinShot(g, t, T0, turnAt, x, y, z) {
  const sp = seg(t, turnAt, turnAt + .34), rot = E.out(sp) * TAU, beat = [0, .24, .44, .64].reduce((a, d) => Math.max(a, after(t, T0 + d, 12)), 0);
  const c = cam(x, y, z * (1 + .05 * beat) * (sp > 0 && sp < 1 ? 1 + .25 * Math.sin(sp * Math.PI) : 1), sp < 1 ? rot : 0, fl(t, .3, T0));
  if (sp > 0 && sp < 1) { // rotational smear from the shot's own buffer (the engine's spinBlur works on FRAME/TMP, which a shot must not touch)
    const b = AUX.spin.g; b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; b.fillStyle = '#000'; b.fillRect(0, 0, W, H); drawCam(b, 'H2', c);
    const amt = .36 * Math.sin(sp * Math.PI), n = 12; g.save(); for (let k = 0; k <= n; k++) { g.globalAlpha = 1 / (k + 1); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2, H / 2); g.rotate(amt * (k / n - .5)); g.translate(-W / 2, -H / 2); g.drawImage(AUX.spin, 0, 0); } g.restore();
  } else drawCam(g, 'H2', c);
  if (t >= turnAt) { const a = after(t, turnAt + .3, 3); for (let k = 0; k < 14; k++) { const ang = k / 14 * TAU + t, d = 200 + (t - turnAt) * 600; sparkle(g, W / 2 + Math.cos(ang) * d, H / 2 + Math.sin(ang) * d * .6, 36 * a, a, t * 4); } }
}
shot(67.02, 'Turn', (g, t) => spinShot(g, t, 67.02, 67.90, 836, 420, 1.06));
shot(68.42, 'Four panels', (g, t) => {
  [['K', 68.42, 'HS1'], ['R', 68.76, 'HS2'], ['M', 69.11, 'HS3'], ['N', 69.45, 'HS4']].forEach(([m, T, id], k) => { const x0 = k * W / 4, cx = x0 + W / 8, on = t >= T;
    g.save(); g.beginPath(); g.rect(x0, 0, W / 4, H); g.clip(); idolCard(g, t, m, { cx, rot: k }); const pop = on ? 1 + .1 * Math.exp(-(t - T) * 11) : 1;
    g.translate(cx, H); g.scale(pop, pop); g.translate(-cx, -H); drawSprite(g, id, { x: cx, y: H - 10, h: 960, outline: 'white', outlineW: 5 }); g.restore();
    if (!on) { g.fillStyle = 'rgba(8,8,28,.72)'; g.fillRect(x0, 0, W / 4, H); } haiCall(g, t, T, m, cx, H * .18, k % 2 ? .1 : -.1, 130); });
  g.fillStyle = '#fff'; for (let k = 1; k < 4; k++) g.fillRect(k * W / 4 - 4, 0, 8, H);
}, { bloom: .15 });
shot(69.84, 'Jump 2', (g, t) => { clipCam(g, 'H3', cam(368, 200, 1.04 + .03 * (t - 69.84))); sparkles(g, t, 34, 27); if (t >= 71.12) { flash(g, .4 * after(t, 71.12, 7)); confetti(g, t, 71.12, { n: 60, spread: .2, seed: 6 }); } }, { clip: clipAt('H3', 69.84, .2, .8) });
shot(71.51, 'Hai x3', (g, t) => crowd(g, t, 71.51, [[71.51, 'M', .3, .26], [71.85, 'N', .55, .2], [72.20, 'K', .75, .28]], 1.35, 330));
shot(72.36, 'Turn 2', (g, t) => spinShot(g, t, 72.36, 73.36, 836, 330, 1.35));
// 01:14.42 FINAL CHORUS - the rooftop concert under a meteor shower
shot(74.42, 'Rooftop concert', (g, t) => { const k = E.out(seg(t, 74.42, 77.02)); drawCam(g, 'F1', cam(836, lerp(300, 460, k), lerp(1.45, 1.04, k), 0, fl(t, .3, 13)));
  meteors(g, t, { n: 12, seed: 3 }); penlights(g, t, { n: 90, y0: .86, heads: false, seed: 8 }); sparkles(g, t, 30, 28); });
shot(77.02, 'Tears', (g, t) => { clipCam(g, 'F2', cam(368, 200, 1.02 + .05 * seg(t, 77.02, 79.56))); meteors(g, t, { n: 6, seed: 4 }); sparkles(g, t, 20, 29, { yMax: .5 }); }, { clip: clipAt('F2', 77.02, 11.0) });
shot(79.56, 'Hands', (g, t) => { const k = E.inOut(seg(t, 79.56, 82.28)); const C = drawCam(g, 'F3', cam(836, lerp(480, 330, k), lerp(1.02, 1.2, k), 0, fl(t, .3, 14)));
  meteors(g, t, { n: 8, seed: 5 }); const hnd = pt(C, 836, 532), gh = glint(t, 81.0, 2); glowAt(g, 'white', hnd[0], hnd[1], 500, .15 + .45 * gh); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = 120 + 300 * gh; sparkle(g, hnd[0] + Math.cos(a) * d, hnd[1] + Math.sin(a) * d * .5, 30 * gh, gh, t); } sparkles(g, t, 24, 30); });
// 01:22.28 \u8a3c\u660e\u3059\u308b\u3088 \u4eca\u591c \u3053\u3053\u3067! - one close-up per girl
[[82.28, 'G4', 'R', 690, 250, 2.1], [82.90, 'G3', 'M', 855, 330, 1.6], [83.42, 'G4', 'N', 990, 250, 2.1], [83.98, 'G2', 'K', 880, 330, 1.5]].forEach(([T, id, m, x, y, z]) => shot(T, 'Final ' + m, (g, t) => {
  drawCam(g, id, cam(x, y, z * (1 + .08 * Math.exp(-(t - T) * 8)) * (1 + .04 * (t - T)), 0, fl(t, .3, T))); flash(g, .3 * after(t, T, 10), MEM[m].rgb); sparkles(g, t, 18, T * 7);
}));
// 01:24.60 \u3053\u3053\u3067! - the final jump; a star bursts on every Hai!, then the logo on the final hit
shot(84.60, 'Final jump', (g, t) => {
  const hit = t >= 87.22, k = E.out(seg(t, 84.6, 87.22)); const C = drawCam(g, 'F4', cam(836, lerp(520, 470, k), lerp(1.18, 1.04, k) * (hit ? 1 + .04 * after(t, 87.22, 3) : 1), 0, hit ? { dx: 0, dy: 0, r: 0 } : fl(t, .3, 15)));
  meteors(g, t, { n: 8, seed: 6 });
  [[84.85, 'K'], [85.32, 'R'], [85.82, 'M'], [86.35, 'N'], [86.85, 'K'], [87.20, 'R']].forEach(([T, m], k2) => { if (t < T) return; const a = after(t, T, 2.2), x = W * (.16 + k2 * .136), y = H * (.12 + (k2 % 2) * .09), c = MEM[m];
    glowAt(g, 'white', x, y, 60 + 220 * a, .3 + .6 * a); starPath(g, x, y, 34 + 30 * a, t * 2); g.save(); g.fillStyle = c.col; g.shadowColor = `rgba(${c.rgb},1)`; g.shadowBlur = 30; g.fill(); g.restore(); haiCall(g, t, T, m, x, y + 120, 0, 90);
    for (let i = 0; i < 10; i++) { const ang = i / 10 * TAU, d = (t - T) * 420; if (t - T < 1.2) sparkle(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 20 * (1 - (t - T) / 1.2), 1 - (t - T) / 1.2, t, c.rgb); } });
  confetti(g, t, 84.6, { n: 140, seed: 9 }); if (hit) { logoDrop(g, t, 87.22, { y: H * .22, scale: .76, shine: 87.8 }); flash(g, .6 * after(t, 87.22, 5)); }
  blackout(g, E.inOut(seg(t, 88.9, 89.5)));
});

// ---------- lyrics: show / hide ----------
{ const KL = LYRICS.filter(L => L.kind === 'ja' && L.sec !== 'Dance');
  KL.forEach((L, k) => { L.show = L.s - .45; L.hide = L.e + .45; L.fade = .3; });
  KL.forEach((L, k) => { const N = KL[k + 1]; if (!N) { L.hide = L.e + .3; return; } if (L.hide + L.fade <= N.show) return;
    const S = Math.max(L.e - .05, N.s - .45, Math.min(N.s - .12, L.e + .1)); L.hide = S - .12; L.fade = .12; N.show = Math.max(N.show, S); }); }
// dance-break calls vanish exactly at the next cut
LYRICS.forEach((L, i) => { if (L.sec !== 'Dance' || L.kind !== 'ja') return; const nx = LYRICS[i + 1]; L.hide = Math.min(L.e + .35, nx ? nx.s - .2 : 99); });
// the last dance call clears the top of the frame before the final chorus's first karaoke line comes in
{ const D = LYRICS.filter(L => L.sec === 'Dance' && L.kind === 'ja').pop(), N = LYRICS.find(L => L.kind === 'ja' && L.sec !== 'Dance' && L.s > D.e); D.hide = Math.min(D.hide, N.s - .52); N.show = Math.max(N.show, D.hide + .2); }
const DANCE = LYRICS.filter(L => L.sec === 'Dance' && L.kind === 'ja');

// ---------- transitions, shakes, aberration ----------
const TRANS = [
  { t: .86, type: 'flash', post: .14, a: .6 }, { t: 1.55, type: 'flash', post: .12, a: .5 }, { t: 2.25, type: 'flash', post: .12, a: .5 }, { t: 2.60, type: 'flash', post: .12, a: .5 },
  { t: 2.95, type: 'zoom', pre: .2, amt: .35 }, { t: 2.95, type: 'flash', post: .35, a: .9 },
  { t: 7.11, type: 'dissolve', post: .45 }, { t: 8.50, type: 'dissolve', post: .35 }, { t: 9.87, type: 'dissolve', post: .35 },
  { t: 11.90, type: 'whip', pre: .12, post: .14, dx: 1 }, { t: 11.90, type: 'flash', post: .2, a: .5 }, { t: 12.58, type: 'flash', post: .12, a: .45 }, { t: 13.30, type: 'flash', post: .12, a: .45 }, { t: 13.65, type: 'flash', post: .12, a: .45 },
  { t: 13.98, type: 'flash', post: .3, a: .75 }, { t: 15.41, type: 'star', post: .38 }, { t: 16.79, type: 'star', post: .38 }, { t: 18.16, type: 'star', post: .38 },
  { t: 19.94, type: 'star', post: .5 }, { t: 25.82, type: 'dissolve', post: .45 }, { t: 31.26, type: 'dissolve', post: .45 }, { t: 33.64, type: 'dissolve', post: .5 },
  { t: 36.18, type: 'whip', pre: .1, post: .15, dx: -1 }, { t: 42.10, type: 'flash', post: .25, a: .35, col: '255,111,174' },
  { t: 43.68, type: 'flash', post: .1, a: .5 }, { t: 44.02, type: 'flash', post: .1, a: .5 }, { t: 44.37, type: 'flash', post: .1, a: .5 },
  { t: 44.88, type: 'whip', pre: .08, post: .14, dx: 1 }, { t: 47.13, type: 'dissolve', post: .3 },
  { t: 51.92, type: 'flash', post: .4, a: 1 }, { t: 52.40, type: 'star', post: .45 }, { t: 52.40, type: 'flash', post: .2, a: .4 },
  { t: 55.10, type: 'whip', pre: .08, post: .14, dx: 1 }, { t: 57.64, type: 'dissolve', post: .3 }, { t: 57.64, type: 'flash', post: .25, a: .3, col: '255,111,174' },
  { t: 60.28, type: 'whip', pre: .08, post: .14, dx: -1 }, { t: 61.50, type: 'whip', pre: .12, post: .12, dx: 1 }, { t: 62.10, type: 'flash', post: .2, a: .5 },
  { t: 62.93, type: 'flash', post: .3, a: .7 }, { t: 64.44, type: 'flash', post: .2, a: .5 },
  { t: 65.68, type: 'flash', post: .12, a: .4 }, { t: 66.02, type: 'flash', post: .12, a: .4 }, { t: 66.37, type: 'flash', post: .12, a: .4 }, { t: 66.71, type: 'flash', post: .12, a: .4 },
  { t: 67.02, type: 'flash', post: .2, a: .5 }, { t: 68.42, type: 'flash', post: .2, a: .5 }, { t: 69.84, type: 'flash', post: .25, a: .6 }, { t: 71.51, type: 'flash', post: .2, a: .5 }, { t: 72.36, type: 'flash', post: .2, a: .5 },
  { t: 74.10, type: 'whip', pre: .32, post: 0, dx: 1 }, { t: 74.42, type: 'flash', post: .5, a: 1 },
  { t: 77.02, type: 'dissolve', post: .4 }, { t: 79.56, type: 'dissolve', post: .45 },
  { t: 84.60, type: 'flash', post: .4, a: .8 },
];
const SHAKES = [[.38, 8], [2.95, 12], [4.67, 8], [11.90, 6], [13.98, 9], [18.51, 7], [45.39, 6], [51.92, 14], [52.40, 6], [62.70, 9], [62.93, 8], [65.50, 11], [67.90, 7], [71.12, 11], [73.36, 7], [74.42, 15], [84.60, 11], [87.22, 15],
  [.86, 5], [1.55, 5], [2.25, 5], [2.60, 6], [65.68, 5], [66.02, 5], [66.37, 5], [66.71, 5]];
const CA_HITS = [[2.95, 6], [51.92, 7], [65.50, 6], [74.42, 8], [87.22, 7]];
function inChorus(t) { return (t >= 52.40 && t < 62.93) || (t >= 74.42 && t < 84.60); }

// ---------- compositor ----------
function shotIndex(t) { let i = 0; for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].t) i = k; return i; }
function renderShot(g, i, t) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); SHOTS[i].draw(g, t, t - SHOTS[i].t); g.restore(); }
function shakeAt(t) { let x = 0, y = 0, a = 0; if (REDUCED_MOTION) return { x, y, a }; for (const [T, amp] of SHAKES) { const d = t - T; if (d >= 0 && d < .6) { const e = amp * Math.exp(-d * 8); x += Math.sin(d * 95 + T) * e; y += Math.cos(d * 73 + T) * e; a = Math.max(a, e); } } return { x, y, a }; }
function starWipe(g, t, tr, p) {
  const j = shotIndex(tr.t - .001); renderShot(PREV.g, j, t); const R = E.inOut(p) * 1650, rot = tr.t + p * 1.2;
  g.save(); g.beginPath(); g.rect(0, 0, W, H); starPath(g, W / 2, H / 2, Math.max(1, R), rot, .46, false); g.clip('evenodd'); g.drawImage(PREV, 0, 0); g.restore();
  g.save(); starPath(g, W / 2, H / 2, Math.max(1, R), rot); g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 14; g.shadowColor = 'rgba(255,230,160,1)'; g.shadowBlur = 30; g.stroke(); g.restore();
  for (let i = 0; i < 5; i++) { const a = rot - Math.PI / 2 + i * TAU / 5; sparkle(g, W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R, 50, 1, t * 3); }
}
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
      case 'zoom': if (before) zoomBlur(g, W / 2, H / 2, (tr.amt || .3) * E.in(p), 7); break;
      case 'dissolve': if (!before) { const j = shotIndex(tr.t - .001); renderShot(PREV.g, j, t); g.save(); g.globalAlpha = 1 - E.sine(p); g.drawImage(PREV, 0, 0); g.restore(); } break;
      case 'star': if (!before) starWipe(g, t, tr, p); break;
    }
  }
  bloom(g, (SHOTS[i].bloom ?? .2) * (inChorus(t) ? 1.3 : 1));
  let ca = 0; for (const [T, a] of CA_HITS) { const d = t - T; if (d >= 0 && d < .4) ca = Math.max(ca, a * Math.exp(-d * 9)); }
  chroma(g, ca);
  g.drawImage(AUX.vig, 0, 0);
  karaoke(g, t); for (const L of DANCE) danceCall(g, t, L); credits(g, t);
  grain(g, t, .035);
  return FRAME;
}
