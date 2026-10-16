// Ship sound, synthesized live: a low drone, warp wind that follows speed,
// a soft chirp when Nova speaks and a thump when the gate opens. Off until asked for.
export function createAudio() {
  let ctx = null, master, wind, windFilter, padFilter, on = false, duck = 1;
  const store = { get() { try { return localStorage.getItem('warpgate-sound') === 'on'; } catch (e) { return false; } }, set(v) { try { localStorage.setItem('warpgate-sound', v ? 'on' : 'off'); } catch (e) {} } };

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // drone
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 480; padFilter.Q.value = 0.6;
    const pad = ctx.createGain(); pad.gain.value = 0.14;
    [[55, 'sine', 0.55], [82.41, 'triangle', 0.22], [110, 'sine', 0.22], [164.81, 'sine', 0.08], [220.4, 'triangle', 0.035]].forEach(([f, type, g], i) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (i - 2) * 6;
      const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg).connect(padFilter); o.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017; const lg = ctx.createGain(); lg.gain.value = g * 0.4; lfo.connect(lg).connect(gg.gain); lfo.start();
    });
    const sweep = ctx.createOscillator(); sweep.frequency.value = 0.045; const sg = ctx.createGain(); sg.gain.value = 160; sweep.connect(sg).connect(padFilter.frequency); sweep.start();
    padFilter.connect(pad).connect(master);

    // wind
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.08; b1 = 0.6 * b1 + w * 0.3; d[i] = (b0 + b1) * 0.6; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 380; windFilter.Q.value = 0.9;
    wind = ctx.createGain(); wind.gain.value = 0.015;
    src.connect(windFilter).connect(wind).connect(master); src.start();
    return true;
  }

  function setOn(v) {
    if (v && !ctx && !init()) return false;
    on = v; store.set(v);
    if (ctx) { if (v) ctx.resume(); master.gain.setTargetAtTime(v ? 0.55 * duck : 0, ctx.currentTime, 0.4); }
    return on;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    if (!on || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    get on() { return on; },
    wanted: store.get(),
    toggle() { return setOn(!on); },
    set: setOn,
    warp(w) { if (!on || !ctx) return; const t = ctx.currentTime; wind.gain.setTargetAtTime(0.015 + w * 0.34, t, 0.12); windFilter.frequency.setTargetAtTime(320 + w * 2400, t, 0.18); padFilter.frequency.setTargetAtTime(480 + w * 900, t, 0.3); },
    blip() { tone(1320, 0.09, 'sine', 0.05, 1.25); },
    chirp() { tone(880, 0.07, 'sine', 0.05); setTimeout(() => tone(1175, 0.09, 'sine', 0.045), 80); },
    thump() { tone(70, 1.1, 'sine', 0.4, 0.45); tone(2200, 0.5, 'triangle', 0.03, 0.3); },
    duck(d) { duck = d ? 0.18 : 1; if (ctx && on) master.gain.setTargetAtTime(0.55 * duck, ctx.currentTime, 0.25); },
  };
}
