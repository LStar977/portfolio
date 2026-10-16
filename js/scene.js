// Space: renderer, starfields, nebula, the route the camera flies, and post effects.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NOISE, SOFT_POINT_FRAG } from './glsl.js';
import { BUILDERS } from './worlds.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rand = (() => { let s = 90210; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; })();

// Where every world sits. dist = how far the camera holds back from it; frame = where it sits on screen.
export const ROUTE = [
  { id: 'gate', pos: [0, 0, 0], dist: 236, sector: 0 },
  { id: 'represent', pos: [0, 40, -9000], dist: 430, sector: 1 },
  { id: 'titan', pos: [-640, 160, -11400], dist: 330, sector: 1 },
  { id: 'distill', pos: [520, -120, -13800], dist: 380, sector: 1 },
  { id: 'contrail', pos: [-320, 60, -16200], dist: 205, sector: 1 },
  { id: 'nova', pos: [420, 120, -27000], dist: 250, sector: 2 },
  { id: 'stardash', pos: [-420, -60, -29400], dist: 300, sector: 2 },
  { id: 'tsuki', pos: [320, 140, -31800], dist: 290, sector: 2 },
  { id: 'countmein', pos: [-520, -80, -34200], dist: 196, sector: 2 },
  { id: 'akatsuki', pos: [200, 60, -36600], dist: 250, sector: 2 },
  { id: 'radar', pos: [-300, -100, -47400], dist: 330, sector: 3 },
  { id: 'signals', pos: [320, 80, -49800], dist: 360, sector: 3 },
  { id: 'edge', pos: [0, 0, -52400], dist: 470, sector: 4 },
];

const SECTOR_SKY = [
  ['#060b1c', '#0d2240', '#1a1530'],
  ['#071526', '#0f3048', '#2a1d0c'],
  ['#170718', '#3a0d2c', '#0f1636'],
  ['#061718', '#160f34', '#0c2a22'],
  ['#0a0507', '#2a0f06', '#09060f'],
].map(s => s.map(c => new THREE.Color(c)));

export function createSpace(canvas, { quality, reduced }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x020309, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 12000);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x120c08, 0.35));

  // ---------- worlds ----------
  const worlds = ROUTE.map((r, i) => {
    const w = BUILDERS[r.id]();
    w.group.position.set(...r.pos);
    w.id = r.id; w.route = r; w.index = i;
    scene.add(w.group);
    return w;
  });
  // the gate faces the camera's approach, everything else is free to sit as built

  // ---------- route curve ----------
  const ctrl = [], stationIdx = [];
  ROUTE.forEach((r, i) => {
    const W = V3(...r.pos), w = worlds[i];
    stationIdx.push(ctrl.length);
    ctrl.push(W.clone().add(V3(0, 0, r.dist)));
    const next = ROUTE[i + 1];
    if (!next) return;
    if (i === 0) {
      ctrl.push(V3(0, 0, 0));                       // straight through the gate
    } else {
      const side = i % 2 ? -1 : 1;
      ctrl.push(W.clone().add(V3(side * (w.radius * 1.25 + 90), 26, 0)));
    }
    if (next.sector !== r.sector) {                 // a warp leg: swing wide through open space
      const a = ctrl[ctrl.length - 1], b = V3(...next.pos).add(V3(0, 0, next.dist));
      const span = a.z - b.z;
      ctrl.push(V3(a.x * 0.4 + 520, a.y + 260, a.z - span * 0.3));
      ctrl.push(V3(b.x * 0.4 - 480, b.y - 200, a.z - span * 0.66));
      ctrl.push(V3(b.x, b.y + 30, b.z + 900));
    }
  });
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const tStation = stationIdx.map(k => k / (ctrl.length - 1));

  // ---------- starfield ----------
  const starCount = quality.stars;
  const stars = (() => {
    const n = starCount, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    const temps = [new THREE.Color('#9db8ff'), new THREE.Color('#cfdcff'), new THREE.Color('#fff4e6'), new THREE.Color('#ffd2a1'), new THREE.Color('#ffb3a1')];
    for (let i = 0; i < n; i++) {
      let p;
      if (i < n * 0.55) {                    // clouds around each world
        const w = ROUTE[i % ROUTE.length], r = 300 + Math.pow(rand(), 0.6) * 2600, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        p = V3(w.pos[0] + r * Math.sin(ph) * Math.cos(th), w.pos[1] + r * Math.cos(ph) * 0.7, w.pos[2] + r * Math.sin(ph) * Math.sin(th));
      } else {                               // sparse field along the whole route
        const z = 2400 - rand() * 57000, a = rand() * Math.PI * 2, r = 400 + Math.pow(rand(), 0.5) * 3600;
        p = V3(Math.cos(a) * r, Math.sin(a) * r * 0.75, z);
      }
      pos.set([p.x, p.y, p.z], i * 3);
      const c = temps[Math.floor(Math.pow(rand(), 1.6) * temps.length)];
      const b = 0.6 + rand() * 1.4;
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = rand() < 0.02 ? 3.2 + rand() * 3 : 0.8 + Math.pow(rand(), 3) * 2.2;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uWarp: { value: 0 } },
      vertexShader: /* glsl */`
        uniform float uTime, uPR, uWarp; attribute vec3 aColor; attribute float aSize, aSeed; varying vec3 vColor; varying float vAlpha;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.7 + 0.3*sin(uTime*(0.7 + aSeed*2.5) + aSeed*60.0);
          float d = -mv.z;
          gl_PointSize = clamp(aSize * uPR * (900.0 / d), 0.0, 7.0*uPR) * tw;
          vColor = aColor;
          vAlpha = smoothstep(11000.0, 5000.0, d) * smoothstep(2.0, 40.0, d) * (1.0 - 0.75*uWarp);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: SOFT_POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
  })();
  scene.add(stars);

  // ---------- warp streaks and near dust (live in camera space and wrap) ----------
  const STREAK_L = 2400;
  const streaks = (() => {
    const n = quality.streaks, pos = new Float32Array(n * 2 * 3), tail = new Float32Array(n * 2), seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = 40 + Math.pow(rand(), 0.7) * 520, z = -rand() * STREAK_L, s = rand();
      for (let k = 0; k < 2; k++) { pos.set([Math.cos(a) * r, Math.sin(a) * r, z], (i * 2 + k) * 3); tail[i * 2 + k] = k; seed[i * 2 + k] = s; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTravel: { value: 0 }, uWarp: { value: 0 }, uTint: { value: new THREE.Color('#cfe3ff') } },
      vertexShader: /* glsl */`
        uniform float uTravel, uWarp; attribute float aTail, aSeed; varying float vA; varying float vTail;
        void main(){
          vec3 p = position;
          p.z = mod(p.z + uTravel * (0.8 + aSeed*0.6), ${STREAK_L.toFixed(1)}) - ${STREAK_L.toFixed(1)};
          float len = uWarp * (90.0 + aSeed * 760.0);
          p.z -= aTail * len;
          vA = smoothstep(-${STREAK_L.toFixed(1)}, -1200.0, p.z) * smoothstep(0.0, -60.0, p.z);
          vTail = aTail;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uWarp; uniform vec3 uTint; varying float vA; varying float vTail;
        void main(){ float a = vA * uWarp * mix(1.0, 0.0, vTail); gl_FragColor = vec4(uTint * a * 2.8, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const l = new THREE.LineSegments(g, m); l.frustumCulled = false; return l;
  })();
  camera.add(streaks);

  const dust = (() => {
    const n = quality.dust, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(rand() - 0.5) * 360, (rand() - 0.5) * 240, -rand() * 600], i * 3); seed[i] = rand(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTravel: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 }, uWarp: { value: 0 } },
      vertexShader: /* glsl */`
        uniform float uTravel, uTime, uPR, uWarp; attribute float aSeed; varying vec3 vColor; varying float vAlpha;
        void main(){
          vec3 p = position; p.z = mod(p.z + uTravel + uTime*6.0*(0.5 + aSeed), 600.0) - 600.0;
          p.x += sin(uTime*0.2 + aSeed*30.0)*3.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.8 + aSeed*1.6) * uPR * (120.0 / -mv.z);
          vColor = vec3(0.7, 0.78, 1.0);
          vAlpha = smoothstep(-600.0, -380.0, p.z) * smoothstep(0.0, -40.0, p.z) * 0.45 * (1.0 - uWarp);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: SOFT_POINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
  })();
  camera.add(dust);

  // ---------- nebula sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 32), new THREE.ShaderMaterial({
    defines: { OCTAVES: quality.octaves },
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() }, uSeed: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSeed; uniform vec3 uA, uB, uC; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float n1 = fbm(d*1.6 + vec3(uSeed, 0.0, uTime*0.004));
        float n2 = fbm(d*3.2 + vec3(4.0 + uSeed, 1.0, -uTime*0.003));
        float band = exp(-pow(d.y*2.2 + n1*0.8, 2.0));
        vec3 c = uA * 0.6;
        c = mix(c, uB, smoothstep(-0.1, 0.8, n1) * 0.9 * (0.4 + 0.6*band));
        c += uC * pow(max(0.0, n2), 2.0) * 1.2 * band;
        c += vec3(0.9, 0.95, 1.0) * pow(max(0.0, n2*n1), 3.0) * 0.08;
        gl_FragColor = vec4(c * 0.85, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.55, 0.62);
  if (quality.bloom) composer.addPass(bloom);
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uWarp: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uWarp, uFlash, uTime, uAspect; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5; float r = length(c * vec2(uAspect, 1.0));
        vec3 acc = vec3(0.0); float wsum = 0.0;
        float blur = uWarp * 0.11 * r;
        for (int i = 0; i < 8; i++) {
          float k = float(i) / 7.0; float w = 1.0 - k*0.6;
          vec2 uv = vUv - c * blur * k;
          float ca = uWarp * 0.012 * r;
          acc += vec3(texture2D(tDiffuse, uv + c*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c*ca).b) * w;
          wsum += w;
        }
        vec3 col = acc / wsum;
        col += vec3(0.85, 0.92, 1.0) * uFlash;
        col *= 1.0 - smoothstep(0.55, 1.15, r) * 0.55;
        col += (h(vUv * 800.0 + uTime) - 0.5) * 0.018;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());

  // ---------- state ----------
  const state = {
    t: 0, travel: 0, speed: 0, warp: 0, flash: 0, fovKick: 0,
    camT: 0, lastPos: new THREE.Vector3().copy(curve.getPoint(0)),
    look: new THREE.Vector3(), roll: 0, offX: 0, offY: 0,
    skyA: SECTOR_SKY[0][0].clone(), skyB: SECTOR_SKY[0][1].clone(), skyC: SECTOR_SKY[0][2].clone(),
    crossed: false, w: 1, h: 1,
  };
  camera.position.copy(curve.getPoint(0));
  state.look.copy(worlds[0].group.position);

  function resize(w, h) {
    if (!w || !h) return;
    state.w = w; state.h = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    finalPass.uniforms.uAspect.value = w / h;
  }

  const tmp = V3(0, 0, 0), tmp2 = V3(0, 0, 0), ahead = V3(0, 0, 0), orbitPos = V3(0, 0, 0);
  const tangentA = V3(0, 0, 0), tangentB = V3(0, 0, 0);

  // nav = { t, station, dwell (0..1 how settled at the station), dwellProgress, frame }
  function update(dt, nav) {
    state.t += dt;
    const t = state.t;
    // follow the scroll target with a little inertia
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7.5);
    state.camT += (nav.t - state.camT) * k;
    if (Math.abs(nav.t - state.camT) < 1e-6) state.camT = nav.t;
    const ct = clamp(state.camT, 0, 1);
    const station = worlds[nav.station];
    const W = station.group.position;

    // position: along the curve, plus a slow orbit while settled at a world
    const base = curve.getPoint(ct, tmp);
    if (nav.dwell > 0.001) {
      const ang = (nav.dwellProgress - 0.5) * 0.32 * nav.dwell;
      orbitPos.copy(base).sub(W).applyAxisAngle(V3(0, 1, 0), ang).add(W);
      orbitPos.y += Math.sin(t * 0.25) * 4 * nav.dwell;
      camera.position.copy(base).lerp(orbitPos, nav.dwell);
    } else camera.position.copy(base);

    // speed and warp
    const moved = camera.position.distanceTo(state.lastPos);
    state.lastPos.copy(camera.position);
    const v = moved / Math.max(dt, 1 / 240);
    state.speed += (v - state.speed) * (1 - Math.exp(-dt * 6));
    const warpTarget = reduced ? 0 : smooth(1400, 9500, state.speed);
    state.warp += (warpTarget - state.warp) * (1 - Math.exp(-dt * 5));
    state.travel += moved;

    // look: down the route while travelling, at the world while settled
    curve.getPoint(clamp(ct + 0.006), ahead);
    if (ahead.distanceToSquared(camera.position) < 1) ahead.copy(camera.position).add(V3(0, 0, -10));
    tmp2.copy(ahead).lerp(W, nav.dwell);
    state.look.lerp(tmp2, reduced ? 1 : 1 - Math.exp(-dt * 6));
    camera.up.set(0, 1, 0);
    camera.lookAt(state.look);

    // bank into turns
    curve.getTangent(clamp(ct), tangentA); curve.getTangent(clamp(ct + 0.01), tangentB);
    const turn = tangentA.clone().cross(tangentB).y;
    const rollTarget = reduced ? 0 : clamp(turn * 26, -0.32, 0.32) * (1 - nav.dwell);
    state.roll += (rollTarget - state.roll) * (1 - Math.exp(-dt * 3));
    camera.rotateZ(state.roll);

    // framing: slide the projection centre so the world sits beside the copy
    const fx = { right: 0.15, left: -0.15, top: 0.0, center: 0, 'high-right': 0.17, low: 0.02, high: 0 }[nav.frame] ?? 0;
    const fy = { right: 0.05, left: 0.05, top: 0.12, center: 0, 'high-right': 0.2, low: -0.2, high: 0.19 }[nav.frame] ?? 0;
    const narrow = state.w < 900;
    const tx = narrow ? 0 : fx * nav.dwell, ty = narrow ? 0.1 * nav.dwell : fy * nav.dwell;
    state.offX += (tx - state.offX) * (1 - Math.exp(-dt * 4));
    state.offY += (ty - state.offY) * (1 - Math.exp(-dt * 4));
    camera.setViewOffset(state.w, state.h, -state.offX * state.w, state.offY * state.h, state.w, state.h);
    state.fovKick += ((reduced ? 0 : state.warp * 20) - state.fovKick) * (1 - Math.exp(-dt * 4));
    camera.fov = 50 + state.fovKick;
    camera.updateProjectionMatrix();

    // the gate flash when the camera passes through the ring
    const gz = worlds[0].group.position.z;
    if (!state.crossed && camera.position.z < gz && state.lastZ >= gz) { state.flash = 1; state.crossed = true; onCross && onCross(); }
    if (camera.position.z > gz + 5) state.crossed = false;
    state.lastZ = camera.position.z;
    state.flash *= Math.exp(-dt * 3.2);

    // sky colours follow the sector
    const sec = SECTOR_SKY[ROUTE[nav.skyStation ?? nav.station].sector];
    const sk = 1 - Math.exp(-dt * 0.9);
    state.skyA.lerp(sec[0], sk); state.skyB.lerp(sec[1], sk); state.skyC.lerp(sec[2], sk);
    const su = sky.material.uniforms;
    su.uA.value.copy(state.skyA); su.uB.value.copy(state.skyB); su.uC.value.copy(state.skyC); su.uTime.value = t;
    sky.position.copy(camera.position);

    const pr = renderer.getPixelRatio();
    stars.material.uniforms.uTime.value = t; stars.material.uniforms.uPR.value = pr; stars.material.uniforms.uWarp.value = state.warp;
    streaks.material.uniforms.uTravel.value = state.travel; streaks.material.uniforms.uWarp.value = state.warp;
    streaks.material.uniforms.uTint.value.set(nav.accent || '#cfe3ff').lerp(new THREE.Color('#ffffff'), 0.55);
    dust.material.uniforms.uTravel.value = state.travel; dust.material.uniforms.uTime.value = t; dust.material.uniforms.uPR.value = pr; dust.material.uniforms.uWarp.value = state.warp;

    // worlds: only the ones near the camera do any work
    for (const w of worlds) {
      const d = w.group.position.distanceTo(camera.position);
      const near = d < 6400;
      w.group.visible = near;
      if (near) w.update(t, { camera, focus: w.index === nav.station ? nav.dwell : 0, speed: state.speed, pr });
    }

    bloom.strength = 0.75 + state.warp * 0.5 + state.flash * 1.2;
    finalPass.uniforms.uWarp.value = state.warp;
    finalPass.uniforms.uFlash.value = state.flash * 0.7;
    finalPass.uniforms.uTime.value = t;
    composer.render(dt);
  }

  let onCross = null;
  return {
    renderer, camera, scene, curve, tStation, worlds, state, resize, update,
    onCross(fn) { onCross = fn; },
    distanceFromGate() { return Math.max(0, -camera.position.z); },
    degrade(level) {
      if (level === 1) { renderer.setPixelRatio(1); resize(state.w, state.h); }
      if (level >= 2) bloom.enabled = false;
    },
  };
}
