// Flight control: maps the page's scroll position to a place on the route,
// and keeps the DOM (panels, HUD, route map, videos) in step with it.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeHop = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const easeLeg = u => 0.5 - 0.5 * Math.cos(Math.PI * u);

export function createFlight({ tStation, flightMode }) {
  const sections = [...document.querySelectorAll('.journey > section')];
  const stops = sections.filter(s => s.hasAttribute('data-stop'));
  const legs = sections.filter(s => s.hasAttribute('data-leg'));
  const info = stops.map((el, i) => ({
    el, i, id: el.dataset.stop, name: el.dataset.name, sector: el.dataset.sector,
    accent: el.dataset.accent, frame: el.dataset.frame || 'center',
    line: el.dataset.line, mood: el.dataset.mood, panel: el.querySelector('.panel'),
    videos: [...el.querySelectorAll('video[data-src]')],
    lede: el.dataset.note || el.querySelector('.dossier__lede')?.textContent.trim() || el.querySelector('.gate__sub, .edge__sub')?.textContent.trim() || '',
    A: 0, D: 0,
  }));
  const legInfo = legs.map(el => ({ el, panel: el.querySelector('.panel'), line: el.dataset.line, mood: el.dataset.mood, sector: el.dataset.sector, name: el.dataset.name, accent: el.dataset.accent, top: 0, h: 0, after: 0 }));
  let vh = window.innerHeight, docEnd = 1, mode = flightMode;

  function measure() {
    vh = window.innerHeight;
    docEnd = Math.max(1, document.documentElement.scrollHeight - vh);
    const tops = el => el.getBoundingClientRect().top + window.scrollY;
    info.forEach((s, i) => {
      const T = tops(s.el), H = s.el.offsetHeight;
      if (mode) { s.A = i === 0 ? 0 : T + 0.12 * H; s.D = i === info.length - 1 ? docEnd + 1 : T + Math.max(0.14 * H, H - 0.95 * vh); }
      else { s.A = i === 0 ? 0 : T - 0.25 * vh; s.D = i === info.length - 1 ? docEnd + 1 : Math.max(s.A + 1, T + H - 0.75 * vh); }
    });
    legInfo.forEach(l => {
      l.top = tops(l.el); l.h = l.el.offsetHeight;
      l.after = info.findIndex(s => tops(s.el) > l.top);
    });
  }

  // nav: what the camera should be doing at scroll position y
  function navAt(y) {
    const n = info.length;
    if (y <= info[0].D) return { t: tStation[0], station: 0, dwell: 1, dwellProgress: clamp(y / Math.max(1, info[0].D)), u: 0, from: 0, to: 0 };
    for (let i = 0; i < n; i++) {
      const s = info[i];
      if (y >= s.A && y <= s.D) return { t: tStation[i], station: i, dwell: 1, dwellProgress: clamp((y - s.A) / Math.max(1, s.D - s.A)), u: 0, from: i, to: i };
      const nx = info[i + 1];
      if (nx && y > s.D && y < nx.A) {
        const u = (y - s.D) / Math.max(1, nx.A - s.D);
        const isLeg = s.sector !== nx.sector;
        const e = isLeg ? easeLeg(u) : easeHop(u);
        const dwell = Math.max(1 - smooth(0, isLeg ? 0.12 : 0.22, u), smooth(isLeg ? 0.88 : 0.78, 1, u));
        const near = u < 0.5 ? i : i + 1;
        return { t: tStation[i] + (tStation[i + 1] - tStation[i]) * e, station: near, dwell, dwellProgress: u < 0.5 ? 1 : 0, u, from: i, to: i + 1, leg: isLeg };
      }
    }
    return { t: tStation[n - 1], station: n - 1, dwell: 1, dwellProgress: 1, u: 0, from: n - 1, to: n - 1 };
  }

  // ---------- DOM state ----------
  const root = document.documentElement;
  const hudSector = document.getElementById('hud-sector'), hudStop = document.getElementById('hud-stop');
  const gSpeed = document.getElementById('g-speed'), gDist = document.getElementById('g-dist'), gBar = document.getElementById('g-bar');
  let accentNow = '', currentPanel = null, currentStop = -1, currentLeg = null, hudText = '', routeAt = -1;
  const listeners = { stop: [], leg: [] };

  // route map
  const routeList = document.getElementById('route');
  let lastSector = null;
  info.forEach((s, i) => {
    const li = document.createElement('li'); li.className = 'route__item' + (lastSector && lastSector !== s.sector ? ' route__item--gap' : '');
    lastSector = s.sector;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'route__btn'; b.dataset.fly = s.id;
    b.innerHTML = `<span class="route__label"></span>`; b.querySelector('.route__label').textContent = s.name;
    b.setAttribute('aria-label', `Fly to ${s.name}`);
    li.append(b); routeList.append(li); s.routeBtn = b;
  });

  // index of all projects
  const indexList = document.getElementById('index-list');
  let idxSector = null;
  info.forEach(s => {
    if (s.id === 'gate' || s.id === 'edge') return;
    if (s.sector !== idxSector) { idxSector = s.sector; const h = document.createElement('li'); h.className = 'index__sector'; h.textContent = `${s.sector}: ${legInfo.find(l => l.sector === s.sector)?.name || ''}`; indexList.append(h); }
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'index__go'; b.dataset.fly = s.id; b.style.setProperty('--c', s.accent);
    const nm = document.createElement('span'); nm.className = 'index__name'; nm.textContent = s.id === 'tsuki' ? '月明かりを纏って' : s.id === 'akatsuki' ? '暁を斬れ' : s.id === 'stardash' ? 'STAR☆DASH!' : s.name;
    const nt = document.createElement('span'); nt.className = 'index__note'; nt.textContent = s.lede;
    b.append(nm, nt); li.append(b); indexList.append(li);
  });

  function setAccent(hex) {
    if (hex === accentNow) return;
    accentNow = hex; root.style.setProperty('--accent', hex);
  }
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t));
    const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t));
    const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  function setPanel(panel) {
    if (panel === currentPanel) return;
    if (currentPanel) { currentPanel.classList.remove('is-on'); currentPanel.setAttribute('inert', ''); }
    currentPanel = panel;
    if (panel) { panel.classList.add('is-on'); panel.removeAttribute('inert'); }
  }

  function playVideos(stopIndex) {
    info.forEach((s, i) => {
      const on = i === stopIndex;
      s.el.classList.toggle('is-current', on);
      for (const v of s.videos) {
        if (on) {
          if (!v.src) { v.src = v.dataset.src; }
          if (!document.documentElement.classList.contains('reduce')) v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
    });
  }

  function update(y, scene) {
    const nav = navAt(y);
    const s = info[nav.station];
    nav.frame = s.frame;

    // accent drifts between the worlds you're travelling between
    const a = info[nav.from].accent, b = info[nav.to].accent;
    let acc = nav.from === nav.to ? a : mixHex(a, b, smooth(0.2, 0.8, nav.u));
    // legs carry their own colour through the warp
    let legNow = null;
    for (const l of legInfo) { const p = (y - l.top) / l.h; if (p > -0.15 && p < 1.05) { legNow = l; l.p = p; } }
    if (legNow && nav.leg) acc = mixHex(acc, legNow.accent, Math.sin(Math.PI * clamp(nav.u)) * 0.9);
    nav.accent = acc;
    setAccent(acc);

    if (mode) {
      // panels: a stop's dossier is on while you're settled there; a leg's title shows mid-warp
      let panel = null;
      const calm = !scene || scene.state.warp < 0.3;
      if (calm && nav.dwell > 0.62 && (nav.from === nav.to || nav.u < 0.1 || nav.u > 0.9)) panel = s.panel;
      if (legNow && nav.leg && nav.u > 0.16 && nav.u < 0.84) panel = legNow.panel;
      setPanel(panel);
      if (legNow) {
        const k = Math.sin(Math.PI * clamp((nav.u - 0.16) / 0.68));
        legNow.panel.style.setProperty('--wdth-leg', String(Math.round(60 + 90 * (scene ? scene.state.warp : 0))));
        legNow.panel.style.setProperty('--leg-k', k.toFixed(3));
      }
    }

    // stop and leg arrival events (Nova talks, videos start)
    const settled = nav.dwell > 0.6 ? nav.station : -1;
    if (settled !== -1 && settled !== currentStop) {
      currentStop = settled; playVideos(settled);
      listeners.stop.forEach(f => f(info[settled], settled));
    }
    if (legNow && nav.leg && nav.u > 0.18 && nav.u < 0.8 && currentLeg !== legNow) {
      currentLeg = legNow; currentStop = -1;
      listeners.leg.forEach(f => f(legNow));
    }
    if (!nav.leg) currentLeg = null;

    // HUD
    const label = legNow && nav.leg && nav.u > 0.12 && nav.u < 0.88 ? [legNow.sector, legNow.name] : [s.sector, s.name];
    const txt = label.join('|');
    if (txt !== hudText) { hudText = txt; hudSector.textContent = label[0]; scramble(hudStop, label[1]); }
    if (nav.station !== routeAt) {
      routeAt = nav.station;
      info.forEach((x, i) => {
        if (i === nav.station) x.routeBtn.setAttribute('aria-current', 'step'); else x.routeBtn.removeAttribute('aria-current');
        x.routeBtn.classList.toggle('is-past', i < nav.station);
      });
    }
    if (scene) {
      const v = scene.state.speed / 1000;
      gSpeed.textContent = (Math.min(9.99, v * 0.42)).toFixed(2) + 'c';
      gDist.textContent = (scene.distanceFromGate() / 260).toFixed(1) + ' ly';
    }
    gBar.style.width = (clamp(y / docEnd) * 100).toFixed(2) + '%';
    return nav;
  }

  // text scramble for HUD readouts
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  function scramble(el, text) {
    if (document.documentElement.classList.contains('reduce')) { el.textContent = text; return; }
    const from = el.textContent, len = Math.max(from.length, text.length);
    let frame = 0; cancelAnimationFrame(el._raf);
    const step = () => {
      let out = '';
      for (let i = 0; i < len; i++) {
        const done = frame > i * 1.4 + 6;
        out += done ? (text[i] || '') : (text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      }
      el.textContent = out;
      if (frame++ < len * 1.4 + 8) el._raf = requestAnimationFrame(step); else el.textContent = text;
    };
    step();
  }

  function scrollYFor(id) {
    const s = info.find(x => x.id === id); if (!s) return 0;
    if (s.i === 0) return 0;
    return Math.min(docEnd, s.A + (mode ? 0.06 * (s.D - s.A) : 0.2 * vh));
  }

  // flow mode (phones): panels are always visible; videos play when on screen
  let io = null;
  function setMode(m) {
    mode = m;
    if (!m) {
      setPanel(null);
      info.forEach(s => { s.panel && s.panel.removeAttribute('inert'); });
      legInfo.forEach(l => l.panel.removeAttribute('inert'));
      if (!io) {
        io = new IntersectionObserver(entries => {
          for (const e of entries) {
            const v = e.target;
            if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!document.documentElement.classList.contains('reduce')) v.play().catch(() => {}); }
            else if (!v.paused) v.pause();
          }
        }, { threshold: 0.35 });
        info.forEach(s => s.videos.forEach(v => io.observe(v)));
      }
    } else {
      if (io) { io.disconnect(); io = null; }
      info.forEach(s => s.panel && s.panel.setAttribute('inert', ''));
      legInfo.forEach(l => l.panel.setAttribute('inert', ''));
      currentPanel = null; currentStop = -1;
    }
    measure();
  }

  return {
    info, legInfo, measure, update, navAt, scrollYFor, setMode,
    get mode() { return mode; },
    on(type, fn) { listeners[type].push(fn); },
  };
}
