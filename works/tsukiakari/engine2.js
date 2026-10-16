/* engine2.js - v2 additions: sprites (transparent poses), lyric typography,
   graphic cards, embers / ash / ripples / chain shards, glow maps, slash split. */
'use strict';
const JP = "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif";
const LATIN = "Cinzel,'Times New Roman',serif";
const SHEETS = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15a', '15b', '16', '17', '18a', '18b', '19', '20a', '20b', '21a', '21b', '22', '23', '24', '25', '26', '27a', '27b', '28', '29a', '29b', '29c', '30a', '30b', '30c'];
const SPRITES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'F1', 'F2', 'F3'];
const SP = {};
function oval(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); g.fill(); }

async function loadAll(base, onProgress) {
  const jobs = SHEETS.map(id => [id, base + id + '.jpg']).concat(SPRITES.map(id => [id, base + id + '.png']));
  let done = 0;
  await Promise.all(jobs.map(async ([id, url]) => {
    const el = new Image(); el.src = url; await el.decode();
    const sprite = SPRITES.includes(id), [sw, sh] = sprite ? [el.naturalWidth, el.naturalHeight] : (ORIG[id] || [1672, 941]);
    IMG[id] = { id, el, sw, sh, k: el.naturalWidth / sw, sprite };
    done++; onProgress && onProgress(done / jobs.length);
  }));
  for (const id of SPRITES) prepSprite(id);
}
// bbox, tinted silhouettes (for outlines), soft glow, and a 3-tone impact version
function prepSprite(id) {
  const I = IMG[id], w = I.sw, h = I.sh, q = 2, lw = Math.round(w / q), lh = Math.round(h / q);
  const lo = mk(lw, lh); lo.g.drawImage(I.el, 0, 0, lw, lh);
  const d = lo.g.getImageData(0, 0, lw, lh).data; let x0 = lw, y0 = lh, x1 = 0, y1 = 0;
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (d[(y * lw + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const sil = col => { const c = mk(lw, lh); c.g.drawImage(I.el, 0, 0, lw, lh); c.g.globalCompositeOperation = 'source-in'; c.g.fillStyle = col; c.g.fillRect(0, 0, lw, lh); return c; };
  const glow = col => { const s = sil(col), c = mk(lw / 2, lh / 2); c.g.filter = 'blur(14px)'; c.g.drawImage(s, 0, 0, lw / 2, lh / 2); c.g.filter = 'none'; return c; };
  const imp = mk(lw, lh), ig = imp.g; ig.drawImage(I.el, 0, 0, lw, lh); const id2 = ig.getImageData(0, 0, lw, lh), p = id2.data;
  for (let i = 0; i < p.length; i += 4) { const L = .3 * p[i] + .59 * p[i + 1] + .11 * p[i + 2], red = p[i] - (p[i + 1] + p[i + 2]) / 2;
    if (L > 150) { p[i] = 255; p[i + 1] = 246; p[i + 2] = 242; } else if (L > 78 || red > 55) { p[i] = 196; p[i + 1] = 8; p[i + 2] = 34; } else { p[i] = 10; p[i + 1] = 2; p[i + 2] = 8; } }
  ig.putImageData(id2, 0, 0);
  SP[id] = { bb: { x0: x0 * q, y0: y0 * q, x1: x1 * q, y1: y1 * q }, silW: sil('#fff4ee'), silR: sil('#d3163a'), silK: sil('#050204'), glowW: glow('#ffffff'), glowR: glow('#ff2a4c'), impact: imp };
}
// Place a sprite. Anchor: bottom-centre of its opaque bbox (feet) by default; 'center' / 'top' / 'pt' (o.ax, o.ay in sprite px).
function drawSprite(g, id, o) {
  const S = SP[id], I = IMG[id], bb = S.bb, bh = bb.y1 - bb.y0, sc = o.scale ?? (o.h / bh), fx = o.flip ? -1 : 1;
  const ax = o.anchor === 'pt' ? o.ax : (bb.x0 + bb.x1) / 2, ay = o.anchor === 'pt' ? o.ay : o.anchor === 'top' ? bb.y0 : o.anchor === 'center' ? (bb.y0 + bb.y1) / 2 : bb.y1;
  g.save(); g.translate(o.x, o.y); if (o.rot) g.rotate(o.rot); g.scale(sc * fx, sc); g.translate(-ax, -ay);
  if (o.shadow) { g.globalAlpha = o.shadow; g.drawImage(S.silK, 18 / sc, 26 / sc, I.sw, I.sh); }
  if (o.glow) { g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, o.glow); g.drawImage(o.glowCol === 'red' ? S.glowR : S.glowW, -I.sw * .02, -I.sh * .02, I.sw * 1.04, I.sh * 1.04); g.globalCompositeOperation = 'source-over'; }
  if (o.outline) { g.globalAlpha = o.outlineA ?? 1; const sil = o.outline === 'red' ? S.silR : o.outline === 'black' ? S.silK : S.silW, dd = (o.outlineW || 5) / sc; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.drawImage(sil, Math.cos(a) * dd, Math.sin(a) * dd, I.sw, I.sh); } }
  g.globalAlpha = o.alpha ?? 1; g.drawImage(o.impact ? S.impact : I.el, 0, 0, I.sw, I.sh);
  g.restore(); g.globalAlpha = 1;
  return (px, py) => [o.x + (px - ax) * sc * fx, o.y + (py - ay) * sc];
}

// ---------- glow maps: the bright / fiery / red parts of a painting, for flicker and pulses ----------
function glowMap(id, fn, blur = 6) {
  const I = IMG[id], w = Math.round(I.sw / 2), h = Math.round(I.sh / 2), c = mk(w, h), g = c.g; g.drawImage(I.el, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const k = clamp(fn(p[i], p[i + 1], p[i + 2])); p[i] *= k; p[i + 1] *= k; p[i + 2] *= k; p[i + 3] = 255; }
  g.putImageData(d, 0, 0); const out = mk(w, h); out.g.filter = `blur(${blur}px)`; out.g.drawImage(c, 0, 0); out.g.filter = 'none'; return out;
}
const fireFn = (r, g, b) => smoothstep(150, 235, r) * smoothstep(60, 170, g) * (1 - smoothstep(150, 230, b));
const redFn = (r, g, b) => smoothstep(110, 200, r) * (1 - smoothstep(50, 110, g)) * (1 - smoothstep(60, 120, b));
const brightFn = (r, g, b) => smoothstep(185, 245, .3 * r + .59 * g + .11 * b);

// ---------- procedural graphics ----------
function drawMoon(g, x, y, r, o = {}) {
  glowAt(g, 'cool', x, y, r * 2.6, o.glow ?? .55);
  g.save();
  const gr = g.createRadialGradient(x - r * .32, y - r * .34, r * .08, x, y, r);
  gr.addColorStop(0, o.c0 || '#fbf8f2'); gr.addColorStop(.72, o.c1 || '#e6e1d8'); gr.addColorStop(1, o.c2 || '#b9b2aa');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.clip();
  const rr = rng(o.seed || 17);
  for (let i = 0; i < 16; i++) { const a = rr() * TAU, dd = Math.sqrt(rr()) * r * .82, s = r * (.07 + rr() * .2), sq = .6 + rr() * .5, rot = rr() * 3, al = .05 + rr() * .1; g.fillStyle = `rgba(110,104,112,${al.toFixed(3)})`; oval(g, x + Math.cos(a) * dd, y + Math.sin(a) * dd, s, s * sq, rot); }
  for (let i = 0; i < 26; i++) { const a = rr() * TAU, dd = Math.sqrt(rr()) * r * .9, s = r * (.012 + rr() * .03), al = .08 + rr() * .1; g.strokeStyle = `rgba(90,86,94,${al.toFixed(3)})`; g.lineWidth = Math.max(1, s * .35); g.beginPath(); g.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, s, 0, TAU); g.stroke(); }
  const limb = g.createRadialGradient(x, y, r * .55, x, y, r); limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(40,30,50,.28)'); g.fillStyle = limb; g.fillRect(x - r, y - r, r * 2, r * 2);
  if (o.tint) { g.globalCompositeOperation = 'multiply'; g.fillStyle = o.tint; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.restore();
}
function wedgeRays(g, cx, cy, n, rot, col, alpha, len = 2400) { g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = col; g.globalAlpha = alpha; for (let i = 0; i < n; i += 2) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, len, i / n * TAU, (i + 1) / n * TAU); g.closePath(); g.fill(); } g.restore(); g.globalAlpha = 1; }
const HALF = {};
function halftone(key, col, step, edge) {
  if (HALF[key]) return HALF[key]; const c = mk(W, H), g = c.g; g.fillStyle = col;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2 + ((y / step) % 2 ? step / 2 : 0); x < W; x += step) {
    const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)), r = step * .5 * clamp((d - (edge ?? .45)) / .7);
    if (r > .4) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
  return HALF[key] = c;
}
// graphic "card" backgrounds for the pose snaps
function card(g, t, kind, o = {}) {
  const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
  if (kind === 'moon') {
    const bg = g.createRadialGradient(cx, cy, 50, cx, cy, W * .75); bg.addColorStop(0, '#1d1428'); bg.addColorStop(1, '#040208'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    wedgeRays(g, cx, cy, 36, t * .05 + (o.rot || 0), '#b3001e', .22);
    g.drawImage(halftone('red', 'rgba(211,22,58,.55)', 22, .4), 0, 0);
    drawMoon(g, o.mx ?? cx, o.my ?? cy, o.mr ?? 400, { glow: .6, seed: o.seed || 17 });
  } else if (kind === 'crimson') {
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#3a0008'); bg.addColorStop(.5, '#b0001c'); bg.addColorStop(1, '#2a0006'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    wedgeRays(g, cx, cy, 44, -t * .08 + (o.rot || 0), '#000', .32);
    g.drawImage(halftone('black', 'rgba(0,0,0,.6)', 20, .35), 0, 0);
  } else if (kind === 'ink') {
    g.fillStyle = '#f3ece6'; g.fillRect(0, 0, W, H);
    const sun = o.sun ?? 330; g.fillStyle = '#c8102e'; g.beginPath(); g.arc(cx, cy, sun, 0, TAU); g.fill();
    speedLines(g, cx, cy, t, { n: 120, inner: sun + 40, alpha: .85, color: '#0a0406', rate: 12, seed: o.seed || 2 });
  } else if (kind === 'night') {
    const bg = g.createRadialGradient(cx, cy * .8, 40, cx, cy, W * .8); bg.addColorStop(0, '#172036'); bg.addColorStop(1, '#030409'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { const x = h1(i * 3.1) * W, y = h1(i * 7.7) * H, a = .25 + .5 * Math.abs(Math.sin(t * .8 + i)); g.fillStyle = `rgba(230,236,255,${a.toFixed(3)})`; g.fillRect(x, y, 1.6, 1.6); }
    if (o.moon !== false) drawMoon(g, o.mx ?? W * .72, o.my ?? H * .36, o.mr ?? 250, { glow: .5 });
  }
}
function kanjiMark(g, ch, x, y, size, o = {}) { g.save(); g.font = `800 ${size}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = o.alpha ?? .5; g.translate(x, y); g.rotate(o.rot || 0);
  if (o.fill) { g.fillStyle = o.fill; g.fillText(ch, 0, 0); } g.lineWidth = o.lw || size * .012; g.strokeStyle = o.color || '#fff'; g.strokeText(ch, 0, 0); g.restore(); }
function kanjiSlam(g, t, T, ch, o) {
  const age = t - T, life = o.life || .7; if (age < 0 || age > life) return;
  const s = lerp(o.s0 || 1.9, o.s1 || 1, E.outExpo(seg(age, 0, .16))) * (1 + .04 * age), a = 1 - seg(age, life - .28, life);
  g.save(); g.translate(o.x, o.y); g.scale(s, s); g.rotate(o.rot || 0); g.font = `800 ${o.size}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = a; g.lineJoin = 'round';
  g.lineWidth = o.size * .07; g.strokeStyle = o.stroke || '#fff4ee'; g.strokeText(ch, 0, 0);
  g.shadowColor = o.glow || 'rgba(255,40,70,.95)'; g.shadowBlur = o.size * .25; g.fillStyle = o.color || '#c8102e'; g.fillText(ch, 0, 0); g.restore();
}

// ---------- particles ----------
function embers(g, t, o) {
  const r = rng(o.seed || 3); g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < (LOWQ ? o.n >> 1 : o.n); i++) {
    const x0 = lerp(o.x0, o.x1, r()), ph = r(), life = (o.life || 2.2) * (.6 + r() * .8), rise = (o.rise || 420) * (.6 + r() * .8), sw = 8 + r() * 26, sz = (o.size || 3) * (.5 + r() * 1.3), fr = .8 + r() * 2.2, gg = 150 + r() * 90 | 0;
    const u = ((t / life + ph) % 1 + 1) % 1, x = x0 + Math.sin(u * TAU * fr + ph * 9) * sw + (o.drift || 0) * u, y = (o.y0 ?? H) - u * rise;
    if (o.region && !o.region(x, y)) continue;
    const a = Math.sin(u * Math.PI) * (.55 + .45 * Math.sin(t * 17 + i * 1.3)) * (o.alpha ?? 1);
    glowAt(g, 'warm', x, y, sz * 5, a * .45); g.fillStyle = `rgba(255,${gg},120,${Math.max(0, a).toFixed(3)})`; g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  g.restore();
}
function ash(g, t, o) {
  const r = rng(o.seed || 8);
  for (let i = 0; i < o.n; i++) { const x0 = r() * (W + 200) - 100, y0 = r() * H, sp = (o.speed || 60) * (.5 + r()), sz = 3 + r() * 7, rot0 = r() * TAU, spin = (r() - .5) * 4, gr = 40 + r() * 50 | 0;
    const y = ((y0 + sp * t) % (H + 60)) - 30, x = x0 + Math.sin(t * .9 + i) * 24 + (o.drift || 0) * t;
    g.save(); g.translate(((x % (W + 200)) + W + 200) % (W + 200) - 100, y); g.rotate(rot0 + spin * t); g.globalAlpha = (o.alpha ?? .7); g.fillStyle = `rgb(${gr},${gr - 8},${gr - 6})`; g.fillRect(-sz / 2, -sz / 3, sz, sz * .66); g.restore(); }
  g.globalAlpha = 1;
}
function chainBurst(g, t, T, x, y, o = {}) {
  const age = t - T; if (age < 0 || age > 1.8) return; const r = rng(o.seed || 5), n = o.n || 46;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, v = (o.v || 1300) * (.35 + r() * .9), k = 2.2, d = v * (1 - Math.exp(-k * age)) / k, sz = 8 + r() * 26, spin = (r() - .5) * 14, pts = [r(), r(), r(), r()];
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .85 + 420 * age * age, fade = 1 - seg(age, .9, 1.8);
    g.save(); g.translate(px, py); g.rotate(spin * age + a); g.globalAlpha = fade;
    g.fillStyle = '#16131a'; g.beginPath(); g.moveTo(-sz * (.4 + pts[0] * .4), -sz * .3); g.lineTo(sz * (.3 + pts[1] * .5), -sz * (.2 + pts[2] * .3)); g.lineTo(sz * .5, sz * (.3 + pts[3] * .3)); g.lineTo(-sz * .4, sz * .4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200,190,210,.55)'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round';
  for (let i = 0; i < (o.sparks || 70); i++) { const a = r() * TAU, v = 900 + r() * 1700, d = v * (1 - Math.exp(-3 * age)) / 3, L = 18 + r() * 60, fade = (1 - seg(age, .15, .9)) * (.5 + r() * .5);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 300 * age * age; g.strokeStyle = `rgba(255,${80 + (r() * 120 | 0)},90,${Math.max(0, fade).toFixed(3)})`; g.lineWidth = 2 + r() * 2.5; g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * L, py - Math.sin(a) * L); g.stroke(); }
  g.restore(); g.globalAlpha = 1;
}
function ripples(g, x, y, age, o = {}) {
  const life = o.life || 2.4; if (age < 0 || age > life) return;
  for (let k = 0; k < 4; k++) { const ak = age - k * .16; if (ak < 0) continue; const R = (o.speed || 280) * ak + 6, a = Math.pow(1 - ak / life, 1.6) * .85, fl = o.flat || .42;
    g.strokeStyle = `rgba(0,0,0,${(a * .45).toFixed(3)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + 4, R, R * fl, 0, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(226,236,255,${a.toFixed(3)})`; g.lineWidth = 2.2 * (1 - ak / life) + .6; g.beginPath(); g.ellipse(x, y, R, R * fl, 0, 0, TAU); g.stroke(); }
}
function droplet(g, x, y, t, T) { const d = T - t; if (d < 0 || d > .28) { if (d < 0 && d > -.12) { glowAt(g, 'white', x, y, 60, .6 * (1 + d / .12)); } return; } const yy = y - d * 1400; g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createLinearGradient(x, yy - 70, x, yy); gr.addColorStop(0, 'rgba(230,240,255,0)'); gr.addColorStop(1, 'rgba(240,246,255,.95)'); g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(x, yy - 70); g.lineTo(x, yy); g.stroke(); g.restore(); }
function glintLine(g, x1, y1, x2, y2, p, o = {}) { if (p <= 0 || p >= 1) return; const x = lerp(x1, x2, p), y = lerp(y1, y2, p), a = Math.sin(p * Math.PI);
  g.save(); g.globalCompositeOperation = 'screen'; const L = o.tail || 260, dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1; const gr = g.createLinearGradient(x - dx / n * L, y - dy / n * L, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,252,246,${(.9 * a).toFixed(3)})`); g.strokeStyle = gr; g.lineWidth = o.w || 5; g.beginPath(); g.moveTo(x - dx / n * L, y - dy / n * L); g.lineTo(x, y); g.stroke(); g.restore();
  sparkle(g, x, y, (o.size || 30) * a, a, p * 4); }

// ---------- lyric typography: vertical Japanese written in as it is sung, English beneath ----------
const SMALL_KANA = '\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308e\u30a1\u30a3\u30a5\u30a7\u30a9\u30c3\u30e3\u30e5\u30e7';
function drawLyricLine(g, L, t, lay) {
  const a0 = seg(t, L.show - .02, L.show + .05) * (1 - seg(t, L.hide, L.hide + .3)); if (a0 <= 0) return;
  const size = lay.size || 64, step = size * 1.08, colGap = size * 1.42, stag = lay.stagger ?? size * 1.15;
  const cols = [[]]; let latin = [];
  for (const [c, ct] of L.ch) { if (c === '\u3000') { cols.push([]); continue; } if (c === ' ') continue; if (/[A-Za-z]/.test(c)) { latin.push([c, ct]); continue; } cols[cols.length - 1].push([c, ct]); }
  const nc = cols.filter(c => c.length).length, xr = lay.side === 'R' ? (lay.x ?? W - 150) : (lay.x ?? 150 + (nc - 1) * colGap), y0 = lay.y ?? 150;
  g.save(); g.font = `800 ${size}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let j = 0;
  for (const col of cols) { if (!col.length) continue; const x = xr - j * colGap, yc = y0 + j * stag;
    col.forEach(([c, ct], i) => {
      const ta = Math.max(ct, L.show), a = seg(t, ta - .03, ta + .14) * a0; if (a <= 0) return;
      let cx = x, cy = yc + i * step - (1 - E.out(seg(t, ta, ta + .28))) * size * .25;
      if (SMALL_KANA.includes(c)) { cx += size * .13; cy -= size * .12; }
      if (c === '\u3001' || c === '\u3002') { cx += size * .34; cy -= size * .36; }
      const acc = lay.accent && lay.accent.includes(c), fresh = 1 - seg(t, ta, ta + .55);
      g.globalAlpha = a * .8; g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = size * .42; g.fillStyle = '#000'; g.fillText(c, cx, cy);
      g.globalAlpha = a; g.shadowColor = acc ? 'rgba(255,34,70,.95)' : 'rgba(255,226,214,.85)'; g.shadowBlur = size * (.14 + .75 * fresh);
      g.fillStyle = acc ? '#ff3b57' : '#f7f0eb'; g.fillText(c, cx, cy);
      if (fresh > .6) { g.globalCompositeOperation = 'screen'; g.globalAlpha = a * (fresh - .6) * 2.2; g.fillStyle = '#fff'; g.fillText(c, cx, cy); g.globalCompositeOperation = 'source-over'; }
    });
    j++; }
  g.restore();
  if (latin.length && lay.latin) { const ta = Math.max(latin[0][1], L.show), a = seg(t, ta - .03, ta + .3) * a0; if (a > 0) {
    const word = latin.map(x => x[0]).join(''), p = lay.latin, sz = p.size || 110, s = lerp(1.25, 1, E.outExpo(seg(t, ta, ta + .5)));
    g.save(); g.translate(p.x, p.y); g.scale(s, s); g.font = `600 ${sz}px ${LATIN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = a;
    g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 30; g.fillStyle = '#000'; letterSpaced(g, word, 0, 0, sz * .22);
    g.shadowColor = 'rgba(255,214,150,.95)'; g.shadowBlur = 28 + 40 * (1 - seg(t, ta, ta + .8)); g.fillStyle = '#fff6ea'; letterSpaced(g, word, 0, 0, sz * .22); g.restore(); } }
}
function drawEnglish(g, L, t, lay) {
  if (!L.en || lay.noEN) return; const a = seg(t, L.show + .12, L.show + .55) * (1 - seg(t, L.hide, L.hide + .3)); if (a <= 0) return;
  const sz = lay.enSize || 27; g.save(); g.font = `400 ${sz}px ${LATIN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const x = lay.enX ?? W / 2, y = lay.enY ?? H - 62;
  g.globalAlpha = a * .85; g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 16; g.fillStyle = '#000'; letterSpaced(g, L.en, x, y, sz * .16);
  g.globalAlpha = a; g.shadowBlur = 6; g.shadowColor = 'rgba(0,0,0,.9)'; g.fillStyle = '#eadbc8'; letterSpaced(g, L.en, x, y, sz * .16);
  g.restore();
}

// ---------- slash split: the outgoing frame is cut along a line and the halves slide apart ----------
function slashSplit(g, src, p, o) {
  const ang = o.angle ?? -.42, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, L = 3000, d = E.outExpo(p) * (o.dist || 900), sl = E.outExpo(p) * (o.slide || 220);
  for (const sgn of [-1, 1]) {
    g.save(); g.translate(nx * d * sgn + dx * sl * sgn, ny * d * sgn + dy * sl * sgn);
    g.beginPath(); g.moveTo(cx - dx * L, cy - dy * L); g.lineTo(cx + dx * L, cy + dy * L); g.lineTo(cx + dx * L + nx * L * sgn, cy + dy * L + ny * L * sgn); g.lineTo(cx - dx * L + nx * L * sgn, cy - dy * L + ny * L * sgn); g.closePath(); g.clip();
    g.drawImage(src, 0, 0);
    g.strokeStyle = `rgba(255,236,236,${(1 - p).toFixed(3)})`; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - dx * L, cy - dy * L); g.lineTo(cx + dx * L, cy + dy * L); g.stroke(); g.restore();
  }
  const a = 1 - seg(p, 0, .5); if (a > 0) { g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = `rgba(255,60,90,${a.toFixed(3)})`; g.lineWidth = 26 * a + 4; g.shadowColor = 'rgba(255,40,80,1)'; g.shadowBlur = 40; g.beginPath(); g.moveTo(cx - dx * L, cy - dy * L); g.lineTo(cx + dx * L, cy + dy * L); g.stroke(); g.restore(); }
}
function slashLine(g, p, o) { if (p <= 0) return; const ang = o.angle ?? -.42, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, dx = Math.cos(ang), dy = Math.sin(ang), L = 1400 * E.inExpo(p);
  g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,240,240,.95)'; g.shadowColor = 'rgba(255,40,80,1)'; g.shadowBlur = 30; g.lineWidth = 3 + 5 * p; g.beginPath(); g.moveTo(cx - dx * L, cy - dy * L); g.lineTo(cx + dx * L, cy + dy * L); g.stroke(); g.restore(); }
