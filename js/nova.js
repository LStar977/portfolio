// Nova, the navigator: a live Live2D rig in the corner of the cockpit that talks at each stop,
// follows the pointer, and steps up to centre stage at her own stop.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

const MOODS = {
  hello: { expr: 'smile', motion: 'hello' },
  smile: { expr: 'smile' },
  nod: { expr: 'smile', motion: 'nod' },
  smug: { expr: 'smug' },
  think: { expr: 'thinking' },
  look: { expr: 'curious', motion: 'lookAround' },
  happy: { expr: 'happy', motion: 'laugh' },
  wink: { expr: 'smile', motion: 'wink' },
  tilt: { expr: 'smile', motion: 'tilt' },
  laugh: { expr: 'happy', motion: 'laugh' },
  serious: { expr: 'serious' },
  curious: { expr: 'curious', motion: 'glance' },
};

export function createNova({ reduced, flightMode }) {
  const wrap = document.getElementById('nova');
  const frame = document.getElementById('nova-frame');
  const canvas = document.getElementById('nova-canvas');
  const say = document.getElementById('nova-say');
  const lineEl = document.getElementById('nova-line');
  const stageEl = document.getElementById('nova-stage');
  let rig = null, perf = null, live = false, hidden = false;
  let morph = 0, morphTarget = 0, mode = flightMode;
  let pointer = null, lastPointer = 0, look = [0, 0];
  let talk = 0, talkTarget = 0, typing = null, quietTimer = 0, lastLine = '';
  let exprTimer = 0, onChip = null;
  const geo = { commW: 120, commH: 157, stageW: 120, stageH: 157, dx: 0, dy: 0 };

  // ---------- speech ----------
  function speak(text, mood) {
    if (!text || text === lastLine) return;
    lastLine = text;
    clearInterval(typing); clearTimeout(quietTimer);
    say.classList.remove('is-quiet'); wrap.classList.remove('is-away');
    lineEl.textContent = '';
    const caret = document.createElement('span'); caret.className = 'caret';
    if (reduced) { lineEl.textContent = text; }
    else {
      let i = 0;
      lineEl.append(caret);
      typing = setInterval(() => {
        i++;
        lineEl.textContent = text.slice(0, i); lineEl.append(caret);
        const ch = text[i - 1] || ' ';
        talkTarget = /[aeiouyAEIOUY]/.test(ch) ? 0.42 + Math.random() * 0.2 : /[\s,.!?']/.test(ch) ? 0.0 : 0.18 + Math.random() * 0.15;
        if (i >= text.length) { clearInterval(typing); typing = null; talkTarget = 0; setTimeout(() => caret.remove(), 1600); }
      }, 34);
    }
    if (mood) setMood(mood);
    quietTimer = setTimeout(() => { if (mode) say.classList.add('is-quiet'); else wrap.classList.add('is-away'); }, Math.max(6500, text.length * 80));
  }

  function setMood(name) {
    const m = MOODS[name]; if (!m || !perf) return;
    if (m.expr) perf.setExpression(m.expr, 0.4);
    if (m.motion && !reduced) perf.play(m.motion);
    clearTimeout(exprTimer);
    exprTimer = setTimeout(() => perf && perf.setExpression('smile', 1.2), 7000);
  }

  // ---------- pointer ----------
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') { pointer = [e.clientX, e.clientY]; lastPointer = performance.now(); } }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer = null; });

  // ---------- chamber controls ----------
  const exprChips = [...document.querySelectorAll('[data-expr]')];
  document.querySelectorAll('[data-expr], [data-motion]').forEach(b => b.addEventListener('click', () => {
    if (!perf) return;
    if (b.dataset.expr) {
      const on = b.getAttribute('aria-pressed') === 'true';
      exprChips.forEach(c => c.setAttribute('aria-pressed', 'false'));
      if (!on) { b.setAttribute('aria-pressed', 'true'); perf.setExpression(b.dataset.expr, 0.35); clearTimeout(exprTimer); }
      else perf.setExpression('smile', 0.6);
    } else perf.play(b.dataset.motion);
    onChip && onChip();
  }));
  exprChips.forEach(c => c.setAttribute('aria-pressed', 'false'));

  // ---------- geometry ----------
  function measure() {
    const small = window.innerWidth < 900;
    geo.commW = small ? 64 : mode ? 120 : 96;
    geo.commH = geo.commW * 17 / 13;
    if (mode && stageEl) {
      const r = stageEl.getBoundingClientRect();
      geo.stageW = Math.max(geo.commW, r.width); geo.stageH = Math.max(geo.commH, r.height);
      geo.stageLeft = r.left; geo.stageBottom = r.bottom;
    } else { geo.stageW = geo.commW; geo.stageH = geo.commH; }
    wrap.style.width = geo.commW + 'px'; wrap.style.height = geo.commH + 'px';
    frame.style.width = geo.stageW + 'px'; frame.style.height = geo.stageH + 'px';
    say.style.left = (geo.commW + 14) + 'px';
    const wr = wrap.getBoundingClientRect(); geo.wrapLeft = wr.left; geo.wrapBottom = wr.bottom;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(geo.stageW * dpr), h = Math.round(geo.stageH * dpr);
    if (rig && (canvas.width !== w || canvas.height !== h)) rig.resize(w, h);
    else if (!rig) { canvas.width = w; canvas.height = h; }
    applyMorph();
  }

  function applyMorph() {
    const s = lerp(geo.commW / geo.stageW, 1, morph);
    // frame's bottom-left sits on the wrap's bottom-left; slide it to the stage
    const tx = mode ? (geo.stageLeft - geo.wrapLeft) * morph : 0;
    const ty = mode ? (geo.stageBottom - geo.wrapBottom) * morph : 0;
    frame.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    frame.style.setProperty('--m', morph.toFixed(3));
    wrap.dataset.state = morph > 0.5 ? 'stage' : 'comm';
  }

  // ---------- rig ----------
  async function boot() {
    if (reduced || !window.WebGL2RenderingContext) return;
    try {
      for (let i = 0; i < 80 && !window.Live2DCubismCore; i++) await new Promise(r => setTimeout(r, 100));
      if (!window.Live2DCubismCore) return;
      const [{ createRig }, { Performer }] = await Promise.all([import('../assets/nova/rig/nova-rig.js'), import('../assets/nova/rig/motions.js')]);
      rig = await createRig(canvas, { modelUrl: 'assets/nova/model/Nova.web.model3.json', width: canvas.width, height: canvas.height });
      perf = new Performer({ seed: (Date.now() % 9973) + 1 });
      perf.setExpression('smile', 0.1);
      live = true;
      wrap.classList.add('is-live');
      if (pendingMood) setMood(pendingMood);
    } catch (e) { console.warn('Nova stayed still:', e); }
  }
  let pendingMood = null;

  function camFor(m) {
    const H = canvas.height, W = canvas.width;
    const comm = { cx: 846, cy: 820, s: H / 1180 };
    const stage = { cx: 828, cy: 1235, s: H / 2480 };
    return { cx: lerp(comm.cx, stage.cx, m), cy: lerp(comm.cy, stage.cy, m), s: lerp(comm.s, stage.s, m), ox: W / 2, oy: H / 2, rot: 0 };
  }

  function update(dt) {
    morph += (morphTarget - morph) * (1 - Math.exp(-dt * (reduced ? 50 : 3.2)));
    if (Math.abs(morphTarget - morph) < 0.001) morph = morphTarget;
    if (mode) applyMorph();
    if (!live || hidden || wrap.classList.contains('is-away')) return;
    const p = perf.update(dt);
    // look at the pointer from wherever her face is on screen
    const idle = performance.now() - lastPointer > 4500;
    if (pointer && !idle) {
      const r = frame.getBoundingClientRect();
      const c = camFor(morph);
      const fx = r.left + ((848 - c.cx) * c.s + c.ox) / canvas.width * r.width;
      const fy = r.top + ((600 - c.cy) * c.s + c.oy) / canvas.height * r.height;
      const tx = clamp((pointer[0] - fx) / (window.innerWidth * 0.45), -1, 1), ty = clamp(-(pointer[1] - fy) / (window.innerHeight * 0.45), -1, 1);
      look[0] += (tx - look[0]) * Math.min(1, dt * 6); look[1] += (ty - look[1]) * Math.min(1, dt * 6);
    } else { look[0] *= 1 - Math.min(1, dt * 1.5); look[1] *= 1 - Math.min(1, dt * 1.5); }
    p.ParamEyeBallX = clamp(p.ParamEyeBallX + look[0] * 0.9, -1, 1); p.ParamEyeBallY = clamp(p.ParamEyeBallY + look[1] * 0.9, -1, 1);
    p.ParamAngleX += 20 * look[0]; p.ParamAngleY += 14 * look[1]; p.ParamBodyAngleX += 3.5 * look[0];
    talk += (talkTarget - talk) * Math.min(1, dt * 22);
    p.ParamMouthOpenY = Math.max(p.ParamMouthOpenY, talk);
    p.ParamWind = 0.22;
    rig.set(p); rig.step(dt); rig.render(camFor(morph));
  }

  window.addEventListener('resize', () => measure());

  return {
    boot, update, measure, speak,
    mood(name) { if (perf) setMood(name); else pendingMood = name; },
    setStage(on) { morphTarget = mode && on ? 1 : 0; },
    setMode(m) { mode = m; morph = morphTarget = 0; frame.style.transform = ''; measure(); },
    setHidden(h) { hidden = h; },
    onChip(fn) { onChip = fn; },
    get live() { return live; },
  };
}
