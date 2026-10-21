// The worlds: one procedural object per stop on the route.
// Every builder returns { group, radius, update(t, ctx) }. ctx = { camera, focus, speed, q }.
import * as THREE from 'three';
import { NOISE, SPHERE_VERT, ATMO_FRAG, SOFT_POINT_FRAG } from './glsl.js';
import { LAND } from './globe-dots.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const col = hex => new THREE.Color(hex);
const LIGHT = V3(-0.78, 0.42, 0.48).normalize();
const rand = (() => { let s = 1337; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; })();

function additive(extra = {}) {
  return { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra };
}

// ---------- shared pieces ----------
function planet({ radius, a, b, c, rim, bands = 6, scale = 1.6, warp = 0.35, spin = 0.02, night = 0, octaves = 5, seg = 96 }) {
  const mat = new THREE.ShaderMaterial({
    defines: { OCTAVES: octaves },
    uniforms: {
      uTime: { value: 0 }, uLight: { value: LIGHT }, uA: { value: col(a) }, uB: { value: col(b) }, uC: { value: col(c) },
      uRim: { value: col(rim) }, uBands: { value: bands }, uScale: { value: scale }, uWarp: { value: warp }, uSpin: { value: spin }, uNight: { value: night },
    },
    vertexShader: SPHERE_VERT,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uBands, uScale, uWarp, uSpin, uNight; uniform vec3 uLight, uA, uB, uC, uRim;
      varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){
        vec3 n = normalize(vN); vec3 p = normalize(vObj);
        float cs = cos(uTime*uSpin), sn = sin(uTime*uSpin);
        vec3 q = vec3(cs*p.x - sn*p.z, p.y, sn*p.x + cs*p.z);
        float w = fbm(q*uScale + vec3(0.0, uTime*0.015, 0.0));
        float m = 0.5 + 0.5*sin((q.y + w*uWarp) * uBands * 3.14159);
        vec3 c = mix(uA, uB, smoothstep(0.05, 0.95, m));
        c = mix(c, uC, smoothstep(0.35, 0.9, fbm(q*uScale*2.4 + 4.0)) * 0.75);
        float wrap = smoothstep(-0.2, 0.75, dot(n, uLight));
        vec3 V = normalize(cameraPosition - vW);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 lit = c * (0.035 + 1.25*wrap) + uRim * rim * (0.12 + 0.88*wrap);
        lit += c * uNight * (1.0 - wrap) * 0.25;
        gl_FragColor = vec4(lit, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2), mat);
  return mesh;
}

function halo(radius, color, { scale = 1.16, intensity = 1.2 } = {}) {
  const edge = Math.sqrt(1 - 1 / (scale * scale));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uIntensity: { value: intensity }, uEdge: { value: edge }, uLight: { value: LIGHT } },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uLight; uniform float uIntensity, uEdge; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN);
        float d = -dot(N, V);
        float k = smoothstep(0.0, uEdge, d); k = k*k*(3.0-2.0*k);
        float lit = 0.25 + 0.75*smoothstep(-0.5, 0.7, dot(N, uLight));
        gl_FragColor = vec4(uColor * k * uIntensity * lit, 1.0);
      }`,
    side: THREE.BackSide, ...additive(),
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 64, 32), mat);
}

function glowSprite(size, color, { power = 2.2, intensity = 1.4, rays = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: { uColor: { value: col(color) }, uPower: { value: power }, uIntensity: { value: intensity }, uRays: { value: rays }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform vec3 uColor; uniform float uPower, uIntensity, uRays, uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv*2.0 - 1.0; float r = length(p);
        float g = pow(max(0.0, 1.0 - r), uPower);
        if (uRays > 0.0) {
          float a = atan(p.y, p.x);
          float ray = snoise(vec3(cos(a)*2.0, sin(a)*2.0, uTime*0.15)) * 0.5 + 0.5;
          g *= 0.75 + uRays * ray * (1.0 - r);
          g += pow(max(0.0, 1.0 - abs(p.y)*18.0), 2.0) * pow(max(0.0, 1.0 - abs(p.x)), 3.0) * 0.35 * uRays;
          g += pow(max(0.0, 1.0 - abs(p.x)*18.0), 2.0) * pow(max(0.0, 1.0 - abs(p.y)), 3.0) * 0.35 * uRays;
        }
        gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
      }`,
    ...additive(),
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.userData.billboard = true;
  return m;
}

function points(count, fill, { vertex, fragment = SOFT_POINT_FRAG, uniforms = {}, blending = THREE.AdditiveBlending } = {}) {
  const geo = new THREE.BufferGeometry();
  const attrs = fill(count);
  for (const [k, [arr, size]] of Object.entries(attrs)) geo.setAttribute(k, new THREE.BufferAttribute(arr, size));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uFocus: { value: 1 }, ...uniforms },
    vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

function billboards(group, camera) {
  group.traverse(o => { if (o.userData.billboard) o.quaternion.copy(camera.quaternion); });
}

// ---------- Gate ----------
export function gate() {
  const group = new THREE.Group();
  const R = 70;
  const metal = new THREE.MeshStandardMaterial({ color: 0x0d1120, metalness: 0.92, roughness: 0.32, emissive: 0x070a14 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 3.4, 32, 220), metal);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R + 7.5, 1.1, 16, 220), metal);
  group.add(ring, ring2);

  // segmented inner ring that turns
  const segs = new THREE.Group();
  const segGeo = new THREE.BoxGeometry(4.2, 2.2, 3.2);
  const segMat = new THREE.MeshStandardMaterial({ color: 0x141a2c, metalness: 0.85, roughness: 0.38, emissive: 0x0b1530 });
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, m = new THREE.Mesh(segGeo, segMat);
    m.position.set(Math.cos(a) * (R - 6.2), Math.sin(a) * (R - 6.2), 0); m.rotation.z = a; segs.add(m);
  }
  group.add(segs);

  // nine chevrons
  const chevrons = [];
  const chevGeo = new THREE.ConeGeometry(4.2, 9, 3);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 - i / 9 * Math.PI * 2;
    const m = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0x1b2440 }));
    m.position.set(Math.cos(a) * (R + 9), Math.sin(a) * (R + 9), 1.5);
    m.rotation.z = a + Math.PI / 2;
    group.add(m); chevrons.push(m);
  }
  const chevOn = col('#ffd9a0').multiplyScalar(1.5), chevOff = col('#1b2440');

  // event horizon
  const horizon = new THREE.Mesh(new THREE.CircleGeometry(R - 4, 160), new THREE.ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uNear: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uOpen, uNear; varying vec2 vUv;
      void main(){
        vec2 p = vUv*2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float sw = a + uTime*0.22 + (1.0 - r)*4.2;
        vec3 q = vec3(cos(sw)*r*1.6, sin(sw)*r*1.6, uTime*0.08);
        float n = fbm(q*1.4) * 0.5 + 0.5;
        float n2 = fbm(q*3.1 + 7.0) * 0.5 + 0.5;
        vec3 deep = vec3(0.01, 0.025, 0.07);
        vec3 ion = vec3(0.22, 0.55, 1.25);
        vec3 gold = vec3(1.4, 0.9, 0.45);
        vec3 c = mix(deep, ion * 0.55, pow(n, 2.6) * smoothstep(0.15, 1.0, r));
        c += gold * pow(n2, 7.0) * 0.9 * r;
        float rim = smoothstep(0.86, 1.0, r);
        c += mix(ion, vec3(1.3, 1.25, 1.2), 0.35) * rim * (0.55 + 0.45*n);
        float core = pow(max(0.0, 1.0 - r), 4.0);
        c += vec3(0.6, 0.8, 1.2) * core * (0.04 + 2.4*uNear);
        c *= mix(0.42, 1.0, smoothstep(0.25, 0.92, r)) * uOpen;
        float alpha = smoothstep(1.0, 0.985, r);
        gl_FragColor = vec4(c * alpha, 1.0);
      }`,
    ...additive({ side: THREE.DoubleSide }),
  }));
  horizon.position.z = -0.5;
  group.add(horizon);


  const lightA = new THREE.PointLight(0x7fb0ff, 3.5, 420, 1.4); lightA.position.set(0, 0, 18);
  const lightB = new THREE.PointLight(0xffc48a, 2.2, 520, 1.4); lightB.position.set(-120, 90, 160);
  group.add(lightA, lightB);

  let open = 0;
  return {
    group, radius: R + 12,
    update(t, ctx) {
      segs.rotation.z = t * 0.06;
      const boot = Math.min(1, t / 2.6);
      chevrons.forEach((m, i) => { const on = boot * 9 > i + 0.5 ? 1 : 0; m.material.color.copy(chevOff).lerp(chevOn, on * (0.75 + 0.25 * Math.sin(t * 2 + i))); });
      open += ((boot > 0.95 ? 1 : 0.15) - open) * 0.04;
      const u = horizon.material.uniforms; u.uTime.value = t; u.uOpen.value = open;
      const d = ctx.camera.position.distanceTo(group.position);
      { const k = Math.min(1, Math.max(0, (260 - d) / 220)); u.uNear.value = k * k * (3 - 2 * k); }
      billboards(group, ctx.camera);
    },
  };
}

// ---------- Represent: a gold star and the 1,460 lights ----------
export function represent() {
  const group = new THREE.Group();
  const R = 30;
  const star = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({
    defines: { OCTAVES: 5 },
    uniforms: { uTime: { value: 0 } },
    vertexShader: SPHERE_VERT,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){
        vec3 p = normalize(vObj);
        float g = fbm(p*4.0 + vec3(0.0, uTime*0.05, uTime*0.03));
        float c2 = ridge(p*9.0 + uTime*0.04);
        vec3 V = normalize(cameraPosition - vW);
        float limb = pow(max(dot(normalize(vN), V), 0.0), 0.5);
        vec3 base = mix(vec3(1.6, 0.72, 0.18), vec3(3.2, 2.3, 1.1), 0.5 + 0.5*g);
        base += vec3(1.4, 1.0, 0.5) * pow(c2, 3.0) * 0.6;
        gl_FragColor = vec4(base * (0.35 + 0.65*limb), 1.0);
      }`,
  }));
  group.add(star);
  const corona = glowSprite(R * 9, '#ffb84a', { power: 3.0, intensity: 1.15, rays: 1.0 });
  group.add(corona);
  const halo2 = glowSprite(R * 22, '#e8a640', { power: 5.0, intensity: 0.35 });
  group.add(halo2);

  // the 1,460 lights: one per day between elections
  const N = 1460;
  const lights = points(N, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), rad = new Float32Array(n), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 60 + Math.pow(rand(), 0.8) * 190;
      rad[i] = r; seed[i] = rand(); size[i] = rand() < 0.03 ? 2.6 : 0.6 + rand() * 1.1;
      pos[i * 3] = rand() * Math.PI * 2; pos[i * 3 + 1] = (rand() - 0.5) * (6 + r * 0.05); pos[i * 3 + 2] = 0;
    }
    return { position: [pos, 3], aSeed: [seed, 1], aRad: [rad, 1], aSize: [size, 1] };
  }, {
    vertex: /* glsl */`
      uniform float uTime, uPR, uFocus; attribute float aSeed, aRad, aSize; varying vec3 vColor; varying float vAlpha;
      void main(){
        float ang = position.x + uTime * 7.5 * pow(aRad, -1.1);
        vec3 p = vec3(cos(ang)*aRad, position.y, sin(ang)*aRad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.65 + 0.35*sin(uTime*(1.0 + aSeed*3.0) + aSeed*50.0);
        gl_PointSize = aSize * uPR * (900.0 / -mv.z) * tw;
        vColor = mix(vec3(2.4, 1.6, 0.7), vec3(2.6, 2.4, 2.1), aSeed) * (0.5 + 0.5*uFocus);
        vAlpha = 0.9;
        gl_Position = projectionMatrix * mv;
      }`,
  });
  group.add(lights);

  const orbitMat = new THREE.LineBasicMaterial({ color: 0xe9b65a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const r of [72, 140, 230]) {
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
  }
  const tilt = new THREE.Group(); tilt.add(lights); group.add(tilt);
  tilt.rotation.x = 0.36; tilt.rotation.z = -0.18;
  group.children.filter(o => o.isLine).forEach(l => tilt.add(l));

  return {
    group, radius: 240,
    update(t, ctx) {
      star.material.uniforms.uTime.value = t;
      corona.material.uniforms.uTime.value = t;
      lights.material.uniforms.uTime.value = t;
      lights.material.uniforms.uPR.value = ctx.pr;
      lights.material.uniforms.uFocus.value = 0.4 + 0.6 * ctx.focus;
      billboards(group, ctx.camera);
    },
  };
}

// ---------- TITAN: a ringed giant with Valkyrie for a moon ----------
export function titan() {
  const group = new THREE.Group();
  const R = 62;
  const body = planet({ radius: R, a: '#1a0d3d', b: '#6b46e0', c: '#c7b2ff', rim: '#9b7bff', bands: 7, scale: 1.3, warp: 0.5, spin: 0.03 });
  group.add(body, halo(R, '#7b5cff', { scale: 1.12, intensity: 1.5 }));

  const ringMat = new THREE.ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: { uLight: { value: LIGHT }, uInner: { value: R * 1.32 }, uOuter: { value: R * 2.35 }, uR: { value: R }, uCenter: { value: V3(0, 0, 0) } },
    vertexShader: /* glsl */`varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + /* glsl */`
      uniform vec3 uLight, uCenter; uniform float uInner, uOuter, uR; varying vec3 vW; varying vec3 vL;
      void main(){
        float r = length(vL.xy); float u = (r - uInner) / (uOuter - uInner);
        if (u < 0.0 || u > 1.0) discard;
        float bands = 0.55 + 0.45*sin(u*92.0 + snoise(vec3(u*14.0, 0.0, 0.0))*2.2);
        float gaps = smoothstep(0.02, 0.06, abs(u - 0.62)) * smoothstep(0.01, 0.03, abs(u - 0.3));
        float dens = bands * gaps * smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.82, u);
        vec3 P = vW - uCenter; float b = dot(P, uLight); float c = dot(P,P) - uR*uR;
        float shadow = (b*b - c > 0.0 && b < 0.0) ? 0.12 : 1.0;
        vec3 tint = mix(vec3(0.55, 0.42, 1.2), vec3(1.25, 1.1, 1.5), u);
        gl_FragColor = vec4(tint * dens * shadow * 0.9, dens * 0.85);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const rings = new THREE.Mesh(new THREE.RingGeometry(R * 1.32, R * 2.35, 256, 1), ringMat);
  const ringTilt = new THREE.Group();
  rings.rotation.x = -Math.PI / 2; ringTilt.add(rings); ringTilt.rotation.set(0.42, 0, -0.32); group.add(ringTilt);
  const tiltBody = body; tiltBody.rotation.set(0.42, 0, -0.32);

  const moon = planet({ radius: 8.5, a: '#3b0f2a', b: '#ff5fa8', c: '#ffd1e6', rim: '#ff8cc6', bands: 3, scale: 2.2, warp: 0.8, spin: 0.2, octaves: 4, seg: 48 });
  const moonOrbit = new THREE.Group(); moonOrbit.add(moon); moon.position.set(R * 2.9, 0, 0); moonOrbit.rotation.set(0.5, 0, -0.2);
  group.add(moonOrbit);
  return {
    group, radius: R * 2.6,
    update(t, ctx) {
      body.material.uniforms.uTime.value = t; moon.material.uniforms.uTime.value = t;
      moonOrbit.rotation.y = t * 0.12;
      ringMat.uniforms.uCenter.value.copy(group.position);
    },
  };
}

// ---------- Distill: a refinery vortex with six bright decisions ----------
export function distill() {
  const group = new THREE.Group();
  const N = 7000;
  const vortex = points(N, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), arm = new Float32Array(n), kind = new Float32Array(n);
    for (let i = 0; i < n; i++) { seed[i] = rand(); arm[i] = Math.floor(rand() * 6); kind[i] = rand(); pos[i * 3] = rand(); pos[i * 3 + 1] = rand(); pos[i * 3 + 2] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1], aArm: [arm, 1], aKind: [kind, 1] };
  }, {
    vertex: /* glsl */`
      uniform float uTime, uPR, uFocus; attribute float aSeed, aArm, aKind; varying vec3 vColor; varying float vAlpha;
      void main(){
        float life = fract(uTime*0.035*(0.6 + position.x*0.8) + aSeed);
        float k = pow(life, 1.6);
        float r = mix(150.0, 9.0, k) + (position.y - 0.5) * 26.0 * (1.0 - k);
        float ang = aArm * 1.0472 + k * 7.5 + position.z * 0.9;
        float h = (1.0 - k) * (position.x - 0.5) * 60.0 + sin(ang*2.0)*4.0*(1.0-k);
        vec3 p = vec3(cos(ang)*r, h, sin(ang)*r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.1 + 2.2*k) * uPR * (420.0 / -mv.z);
        // each review starts as a red complaint, a green compliment or grey noise, and burns white at the core
        vec3 red = vec3(1.7, 0.2, 0.16), green = vec3(0.22, 1.25, 0.5), grey = vec3(0.7, 0.72, 0.85), hot = vec3(3.0, 2.3, 1.7);
        vec3 c0 = aKind < 0.55 ? red : aKind < 0.86 ? green : grey;
        vColor = mix(c0, hot, smoothstep(0.62, 1.0, k));
        vAlpha = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.94, life) * (0.4 + 0.35*uFocus);
        gl_Position = projectionMatrix * mv;
      }`,
  });
  group.add(vortex);
  const core = glowSprite(90, '#ff6a45', { power: 3.6, intensity: 1.4, rays: 0.6 });
  group.add(core);
  const decisions = [];
  for (let i = 0; i < 6; i++) { const s = glowSprite(16, i % 2 ? '#ffe2c4' : '#ff8a5c', { power: 2.6, intensity: 2.6 }); group.add(s); decisions.push(s); }
  const disk = new THREE.Mesh(new THREE.RingGeometry(10, 160, 128, 1), new THREE.ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
        float n = fbm(vec3(cos(a + uTime*0.2 + 30.0/r)*r*0.03, sin(a + uTime*0.2 + 30.0/r)*r*0.03, uTime*0.05))*0.5+0.5;
        float f = smoothstep(160.0, 20.0, r) * smoothstep(8.0, 22.0, r);
        gl_FragColor = vec4(vec3(1.0, 0.3, 0.16) * n * f * 0.16, 1.0); }`,
    ...additive({ side: THREE.DoubleSide }),
  }));
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);
  group.rotation.set(0.5, 0, 0.15);
  return {
    group, radius: 160,
    update(t, ctx) {
      vortex.material.uniforms.uTime.value = t; vortex.material.uniforms.uPR.value = ctx.pr; vortex.material.uniforms.uFocus.value = 0.4 + 0.6 * ctx.focus;
      core.material.uniforms.uTime.value = t; disk.material.uniforms.uTime.value = t;
      decisions.forEach((s, i) => { const a = i / 6 * Math.PI * 2 + t * 0.35; s.position.set(Math.cos(a) * 22, Math.sin(t * 1.3 + i) * 3, Math.sin(a) * 22); });
      billboards(group, ctx.camera);
    },
  };
}

// ---------- Contrail: a night globe with live-looking flight arcs ----------
const AIRPORTS = { JFK: [40.64, -73.78], LHR: [51.47, -0.45], DXB: [25.25, 55.36], HND: [35.55, 139.78], SYD: [-33.94, 151.18], LAX: [33.94, -118.41], ORD: [41.97, -87.9], DUB: [53.42, -6.27], YYC: [51.13, -114.01], FRA: [50.04, 8.56], SIN: [1.36, 103.99], GRU: [-23.43, -46.47], JNB: [-26.14, 28.24], CDG: [49.01, 2.55], HKG: [22.31, 113.91], MEX: [19.44, -99.07], YVR: [49.19, -123.18], DEL: [28.56, 77.1], ATL: [33.64, -84.43], IST: [41.26, 28.74] };
const ROUTES = [['ORD', 'DUB'], ['JFK', 'LHR'], ['LHR', 'DXB'], ['DXB', 'SIN'], ['SIN', 'SYD'], ['HND', 'LAX'], ['LAX', 'JFK'], ['YYC', 'YVR'], ['YYC', 'LHR'], ['FRA', 'HKG'], ['GRU', 'JNB'], ['CDG', 'JFK'], ['MEX', 'ORD'], ['DEL', 'LHR'], ['HKG', 'SYD'], ['YVR', 'HND'], ['ATL', 'CDG'], ['IST', 'DEL'], ['YYC', 'ATL'], ['DXB', 'JNB']];
function ll(lat, lon, r) { const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180; return V3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); }
export function contrail() {
  const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin);
  const R = 58;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT } },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */`uniform vec3 uLight; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(n,V),0.0), 2.5);
        float wrap = smoothstep(-0.3, 0.8, dot(n, uLight));
        vec3 c = vec3(0.012, 0.03, 0.06) + vec3(0.03, 0.09, 0.16)*wrap + vec3(0.25, 0.6, 1.0)*rim*0.55;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  spin.add(globe, halo(R, '#2f8cff', { scale: 1.1, intensity: 1.1 }));

  const land = points(LAND.length / 2, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = ll(LAND[i * 2], LAND[i * 2 + 1], R + 0.25); pos.set([v.x, v.y, v.z], i * 3); seed[i] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1] };
  }, {
    vertex: /* glsl */`
      uniform float uTime, uPR; uniform vec3 uLight; attribute float aSeed; varying vec3 vColor; varying float vAlpha;
      void main(){
        vec3 wn = normalize(mat3(modelMatrix) * position);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec3 V = normalize(cameraPosition - w.xyz);
        float facing = dot(wn, V);
        vec4 mv = viewMatrix * w;
        gl_PointSize = 1.9 * uPR * (300.0 / -mv.z);
        float day = smoothstep(-0.2, 0.6, dot(wn, uLight));
        vColor = mix(vec3(1.4, 0.75, 0.3)*(aSeed > 0.86 ? 1.0 : 0.25), vec3(0.32, 0.8, 1.25), day);
        vAlpha = smoothstep(-0.05, 0.25, facing) * (0.55 + 0.45*day);
        gl_Position = projectionMatrix * mv;
      }`,
    uniforms: { uLight: { value: LIGHT } },
  });
  spin.add(land);

  // arcs
  const arcs = [];
  const arcMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`attribute float aT; attribute float aPhase; varying float vT; varying float vPhase; void main(){ vT = aT; vPhase = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime; varying float vT; varying float vPhase;
      void main(){ float head = fract(uTime*0.09 + vPhase); float d = head - vT; float tail = d > 0.0 ? exp(-d*9.0) : 0.0;
        float base = 0.12; vec3 c = vec3(2.2, 0.75, 0.25) * (base + tail*2.2); gl_FragColor = vec4(c, 1.0); }`,
    ...additive(),
  });
  const heads = [];
  ROUTES.forEach(([a, b], i) => {
    const A = ll(...AIRPORTS[a], 1).normalize(), B = ll(...AIRPORTS[b], 1).normalize();
    const ang = A.angleTo(B), pts = [], ts = [], ph = [], phase = rand();
    const S = 96;
    for (let k = 0; k <= S; k++) {
      const t = k / S, s1 = Math.sin((1 - t) * ang) / Math.sin(ang), s2 = Math.sin(t * ang) / Math.sin(ang);
      const v = A.clone().multiplyScalar(s1).add(B.clone().multiplyScalar(s2)).normalize();
      const h = R + 0.6 + Math.sin(Math.PI * t) * R * 0.22 * ang;
      pts.push(v.multiplyScalar(h)); ts.push(t); ph.push(phase);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
    const line = new THREE.Line(geo, arcMat); spin.add(line);
    const hd = glowSprite(4.2, '#ffb07a', { power: 2.0, intensity: 2.4 }); spin.add(hd);
    heads.push({ hd, pts, phase }); arcs.push(line);
  });
  spin.rotation.set(0.38, -1.1, 0.12);
  return {
    group, radius: R * 1.5,
    update(t, ctx) {
      spin.rotation.y = -1.1 + t * 0.03;
      arcMat.uniforms.uTime.value = t; land.material.uniforms.uPR.value = ctx.pr;
      for (const h of heads) { const u = (t * 0.09 + h.phase) % 1, i = Math.min(h.pts.length - 1, Math.floor(u * (h.pts.length - 1))); h.hd.position.copy(h.pts[i]); }
      billboards(group, ctx.camera);
    },
  };
}

// ---------- Nova: a quiet observatory platform ----------
export function novaStage() {
  const group = new THREE.Group();
  const deck = new THREE.Group(); group.add(deck);
  const ringMat = (o) => new THREE.MeshBasicMaterial({ color: new THREE.Color('#f0b45c').multiplyScalar(o), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(46, 47.2, 180), ringMat(1.6));
  const r2 = new THREE.Mesh(new THREE.RingGeometry(58, 58.5, 180), ringMat(0.7));
  const r3 = new THREE.Mesh(new THREE.RingGeometry(30, 30.4, 140), ringMat(0.9));
  for (const r of [r1, r2, r3]) { r.rotation.x = -Math.PI / 2; deck.add(r); }
  deck.position.y = -56;
  const column = points(1400, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 44; pos.set([Math.cos(a) * r, rand(), Math.sin(a) * r], i * 3); seed[i] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; varying vec3 vColor; varying float vAlpha;
      void main(){ float y = fract(position.y + uTime*0.03*(0.5+aSeed)); vec3 p = vec3(position.x, -56.0 + y*150.0, position.z);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = (0.6 + aSeed*1.4) * uPR * (340.0 / -mv.z);
        vColor = vec3(2.2, 1.45, 0.7); vAlpha = smoothstep(0.0, 0.15, y) * smoothstep(1.0, 0.5, y) * 0.8; gl_Position = projectionMatrix * mv; }`,
  });
  group.add(column);
  const glow = glowSprite(260, '#f0a040', { power: 4.0, intensity: 0.5 });
  group.add(glow);
  return {
    group, radius: 80,
    update(t, ctx) { deck.rotation.y = t * 0.05; column.material.uniforms.uTime.value = t; column.material.uniforms.uPR.value = ctx.pr; billboards(group, ctx.camera); },
  };
}

// ---------- STAR DASH: four member stars dancing ----------
export function starDash() {
  const group = new THREE.Group();
  const colors = ['#ff8a2a', '#6f8cff', '#ff6fae', '#2fd49a'];
  const stars = colors.map(c => { const g = new THREE.Group(); g.add(glowSprite(60, c, { power: 2.4, intensity: 1.6, rays: 1.2 })); g.add(glowSprite(10, '#ffffff', { power: 1.6, intensity: 2.8 })); group.add(g); return g; });
  const sparkles = points(1800, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([(rand() - 0.5) * 340, (rand() - 0.5) * 220, (rand() - 0.5) * 200], i * 3); seed[i] = rand();
      const k = new THREE.Color(colors[i % 4]).lerp(new THREE.Color('#ffffff'), 0.35); c.set([k.r * 2, k.g * 2, k.b * 2], i * 3);
    }
    return { position: [pos, 3], aSeed: [seed, 1], aColor: [c, 3] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; attribute vec3 aColor; varying vec3 vColor; varying float vAlpha;
      void main(){ vec3 p = position; p.y += sin(uTime*0.6 + aSeed*20.0)*6.0; vec4 mv = modelViewMatrix * vec4(p,1.0);
        float tw = pow(0.5 + 0.5*sin(uTime*(2.0 + aSeed*4.0) + aSeed*90.0), 6.0);
        gl_PointSize = (1.0 + 3.0*tw) * uPR * (300.0 / -mv.z); vColor = aColor; vAlpha = 0.25 + 0.75*tw; gl_Position = projectionMatrix * mv; }`,
  });
  group.add(sparkles);
  // a big outline star behind them
  const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 46 : 118; pts.push(V3(Math.cos(a) * r, Math.sin(a) * r, -40)); }
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(outline);
  // shooting stars
  const meteors = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(90, 1.4), new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`uniform float uA; varying vec2 vUv; void main(){ float f = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y - 0.5)*2.0); gl_FragColor = vec4(vec3(2.4, 2.2, 2.6) * f * uA, 1.0); }`,
      ...additive(),
    }));
    g.userData.seed = rand() * 10; group.add(g); meteors.push(g);
  }
  return {
    group, radius: 150,
    update(t, ctx) {
      stars.forEach((s, i) => {
        const a = t * 0.55 + i * Math.PI / 2;
        s.position.set(Math.cos(a) * 62 + Math.sin(t * 1.1 + i) * 10, Math.sin(a * 2) * 26 + Math.sin(t * 2.2 + i * 2) * 5, Math.sin(a) * 30);
        const pulse = 1 + 0.12 * Math.max(0, Math.sin(t * Math.PI * 2 * 2.6 + i));
        s.scale.setScalar(pulse);
        s.children.forEach(c => c.material.uniforms.uTime && (c.material.uniforms.uTime.value = t));
      });
      outline.rotation.z = t * 0.08;
      sparkles.material.uniforms.uTime.value = t; sparkles.material.uniforms.uPR.value = ctx.pr;
      meteors.forEach((m, i) => {
        const cyc = (t + m.userData.seed * 3) % 7, k = cyc / 1.1;
        m.material.uniforms.uA.value = k < 1 ? Math.sin(k * Math.PI) : 0;
        m.position.set(140 - k * 220 + i * 40, 110 - k * 70 - i * 30, -60);
        m.rotation.z = 0.32;
      });
      billboards(group, ctx.camera);
    },
  };
}

// ---------- Tsukiakari: the crimson moon and falling petals ----------
export function tsuki() {
  const group = new THREE.Group();
  const R = 74;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.ShaderMaterial({
    defines: { OCTAVES: 5 },
    uniforms: { uTime: { value: 0 }, uLight: { value: V3(-0.55, 0.35, 0.76).normalize() } },
    vertexShader: SPHERE_VERT,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; uniform vec3 uLight; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){
        vec3 p = normalize(vObj); vec3 n = normalize(vN);
        float h = fbm(p*2.2); float cr = ridge(p*5.5 + 3.0);
        float maria = smoothstep(0.05, 0.35, fbm(p*1.3 + 11.0));
        vec3 c = mix(vec3(0.75, 0.13, 0.16), vec3(0.32, 0.03, 0.06), maria);
        c = mix(c, vec3(1.25, 0.55, 0.5), pow(cr, 4.0)*0.6);
        c *= 0.85 + 0.3*h;
        float wrap = smoothstep(-0.1, 0.7, dot(n, uLight));
        vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(n,V),0.0), 2.6);
        vec3 lit = c * (0.04 + 1.5*wrap) + vec3(1.6, 0.25, 0.3)*rim*(0.2 + 0.8*wrap);
        gl_FragColor = vec4(lit, 1.0);
      }`,
  }));
  group.add(moon, halo(R, '#ff2a40', { scale: 1.14, intensity: 1.4 }));
  const veil = glowSprite(R * 7, '#a3122a', { power: 4.5, intensity: 0.45 });
  group.add(veil);
  const petals = points(900, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(rand() - 0.5) * 420, rand(), (rand() - 0.2) * 240], i * 3); seed[i] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; varying vec3 vColor; varying float vAlpha; varying float vRot;
      void main(){ float y = fract(position.y - uTime*0.012*(0.6 + aSeed)); vec3 p = vec3(position.x + sin(uTime*0.3 + aSeed*30.0)*20.0 - y*40.0, 160.0 - y*320.0, position.z);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = (2.0 + aSeed*3.5) * uPR * (300.0 / -mv.z);
        vColor = mix(vec3(1.3, 0.08, 0.15), vec3(1.6, 0.5, 0.55), aSeed); vAlpha = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.85, y);
        vRot = uTime*(0.5 + aSeed) + aSeed*20.0; gl_Position = projectionMatrix * mv; }`,
    fragment: /* glsl */`varying vec3 vColor; varying float vAlpha; varying float vRot;
      void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
        float d = length(vec2(p.x*2.2, p.y)); float a = smoothstep(0.5, 0.35, d) * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(vColor * a, 1.0); }`,
  });
  group.add(petals);
  return {
    group, radius: R * 1.3,
    update(t, ctx) { moon.material.uniforms.uTime.value = t; moon.rotation.y = t * 0.01; petals.material.uniforms.uTime.value = t; petals.material.uniforms.uPR.value = ctx.pr; billboards(group, ctx.camera); },
  };
}

// ---------- Count Me In: a candy planet full of Voicelings ----------
export function candy() {
  const group = new THREE.Group();
  const R = 48;
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: { uTime: { value: 0 }, uLight: { value: LIGHT } },
    vertexShader: SPHERE_VERT,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; uniform vec3 uLight; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      vec3 pal(float t){ t = fract(t); vec3 a = vec3(1.0,0.2,0.33), b = vec3(1.0,0.62,0.1), c = vec3(0.12,0.78,0.44), d = vec3(0.14,0.42,1.0), e = vec3(0.46,0.22,1.0);
        float s = t*5.0; if (s < 1.0) return mix(a,b,s); if (s < 2.0) return mix(b,c,s-1.0); if (s < 3.0) return mix(c,d,s-2.0); if (s < 4.0) return mix(d,e,s-3.0); return mix(e,a,s-4.0); }
      void main(){
        vec3 p = normalize(vObj); vec3 n = normalize(vN);
        float sw = p.y*2.2 + fbm(p*1.6 + uTime*0.03)*0.9 + atan(p.z, p.x)*0.15;
        vec3 c = pal(sw*0.5 + uTime*0.01);
        float brush = fbm(p*vec3(9.0, 40.0, 9.0))*0.5 + 0.5;
        c *= 0.82 + 0.3*brush;
        float wrap = smoothstep(-0.35, 0.8, dot(n, uLight));
        vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(n,V),0.0), 3.0);
        gl_FragColor = vec4(c * (0.1 + 0.72*wrap) + vec3(1.0,0.6,0.95)*rim*0.3, 1.0);
      }`,
  }));
  group.add(body, halo(R, '#ff7ac8', { scale: 1.12, intensity: 0.7 }));
  const palette = ['#ff6b8a', '#ffd25a', '#62e6b8', '#6fb6ff', '#b48cff', '#ff9a4d'];
  const count = 30;
  const blob = new THREE.InstancedMesh(new THREE.SphereGeometry(3.6, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, emissive: 0x2a2030 }), count);
  const sun = new THREE.DirectionalLight(0xfff4ea, 2.6); sun.position.set(-160, 120, 160); sun.target = group; group.add(sun);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push({ a: i / count * Math.PI * 2 + rand() * 0.1, lat: (rand() - 0.5) * 0.5, ph: rand() * 6 });
    blob.setColorAt(i, new THREE.Color(palette[i % palette.length]).multiplyScalar(1.15));
  }
  group.add(blob);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(1, 1, 1), p = V3(0, 0, 0), up = V3(0, 1, 0), nrm = V3(0, 0, 0);
  const confetti = points(700, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([rand() * Math.PI * 2, (rand() - 0.5) * 2, 70 + rand() * 90], i * 3); seed[i] = rand(); const k = new THREE.Color(palette[i % palette.length]); c.set([k.r * 1.6, k.g * 1.6, k.b * 1.6], i * 3); }
    return { position: [pos, 3], aSeed: [seed, 1], aColor: [c, 3] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; attribute vec3 aColor; varying vec3 vColor; varying float vAlpha;
      void main(){ float a = position.x + uTime*0.06*(0.5+aSeed); vec3 p = vec3(cos(a)*position.z, position.y*40.0 + sin(uTime + aSeed*30.0)*6.0, sin(a)*position.z);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = (1.5 + aSeed*2.0) * uPR * (300.0/-mv.z); vColor = aColor; vAlpha = 0.8; gl_Position = projectionMatrix * mv; }`,
  });
  group.add(confetti);
  return {
    group, radius: R * 1.9,
    update(t, ctx) {
      body.material.uniforms.uTime.value = t;
      const beat = t * 2.1; // about 126 bpm
      seeds.forEach((sd, i) => {
        const a = sd.a + t * 0.08, hop = Math.abs(Math.sin(beat * Math.PI + sd.ph));
        nrm.set(Math.cos(a) * Math.cos(sd.lat), Math.sin(sd.lat), Math.sin(a) * Math.cos(sd.lat)).normalize();
        p.copy(nrm).multiplyScalar(R + 3 + hop * 5);
        q.setFromUnitVectors(up, nrm);
        s.set(1 + (1 - hop) * 0.18, 1 - (1 - hop) * 0.22 + hop * 0.1, 1 + (1 - hop) * 0.18);
        m4.compose(p, q, s); blob.setMatrixAt(i, m4);
      });
      blob.instanceMatrix.needsUpdate = true;
      confetti.material.uniforms.uTime.value = t; confetti.material.uniforms.uPR.value = ctx.pr;
      body.rotation.y = t * 0.02;
    },
  };
}

// ---------- Akatsuki: night and dawn split by a blade of light ----------
export function dawn() {
  const group = new THREE.Group();
  const R = 340;
  const limb = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: { uSun: { value: V3(0.25, 0.55, -1).normalize() }, uFade: { value: 1 } },
    vertexShader: SPHERE_VERT,
    fragmentShader: NOISE + /* glsl */`uniform vec3 uSun; uniform float uFade; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){ vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(n,V),0.0), 4.0);
        float h = fbm(normalize(vObj)*6.0)*0.5+0.5;
        vec3 c = vec3(0.02, 0.018, 0.03) * (0.6 + 0.6*h) + vec3(1.8, 0.7, 0.25) * rim * (0.6 + 0.4*dot(n, uSun)) * uFade;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  limb.position.set(0, -R - 38, -60);
  group.add(limb);
  const sky = halo(R, '#ff7a3a', { scale: 1.06, intensity: 1.6 }); sky.position.copy(limb.position); group.add(sky);
  const sun = glowSprite(260, '#ffb56a', { power: 3.0, intensity: 1.6, rays: 1.0 }); sun.position.set(40, -22, -220); group.add(sun);
  const core = glowSprite(40, '#fff1d6', { power: 1.6, intensity: 3.0 }); core.position.copy(sun.position); group.add(core);
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(520, 3.2), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime, uFade; varying vec2 vUv; void main(){ float x = vUv.x; float f = smoothstep(0.0, 0.25, x) * smoothstep(1.0, 0.6, x) * (1.0 - abs(vUv.y-0.5)*2.0);
      float sweep = exp(-pow((x - fract(uTime*0.12))*6.0, 2.0)); gl_FragColor = vec4(vec3(2.6, 2.2, 1.9) * f * (0.4 + 1.4*sweep) * uFade, 1.0); }`,
    ...additive(),
  }));
  blade.position.set(0, 40, -40); blade.rotation.z = -0.38; group.add(blade);
  const moon = new THREE.Group(); moon.add(glowSprite(46, '#ff3048', { power: 2.0, intensity: 1.4 })); moon.add(glowSprite(14, '#ffd0d4', { power: 1.4, intensity: 2.2 }));
  moon.position.set(-150, 120, -160); group.add(moon);
  const glows = [[sky, 1.6], [sun, 1.6], [core, 3.0], [moon.children[0], 1.4], [moon.children[1], 2.2]];
  return {
    group, radius: 220,
    update(t, ctx) {
      // the planet is big enough to hang at the edge of the stop before, so it only fades in on approach
      const fade = 1 - THREE.MathUtils.smoothstep(group.position.distanceTo(ctx.camera.position), 1800, 2900);
      for (const c of group.children) c.visible = fade > 0.002;
      limb.material.uniforms.uFade.value = fade; blade.material.uniforms.uFade.value = fade;
      for (const [m, k] of glows) m.material.uniforms.uIntensity.value = k * fade;
      blade.material.uniforms.uTime.value = t; sun.material.uniforms.uTime.value = t; sun.position.y = -22 + Math.sin(t * 0.1) * 4; billboards(group, ctx.camera); blade.quaternion.copy(ctx.camera.quaternion); blade.rotateZ(-0.38); },
  };
}

// ---------- Radar: a sonar beacon ----------
export function radar() {
  const group = new THREE.Group();
  const R = 30;
  group.add(planet({ radius: R, a: '#1a0b26', b: '#3b1d55', c: '#8a5cc0', rim: '#d3a6ff', bands: 4, scale: 2.0, warp: 0.6, spin: 0.05, octaves: 4, seg: 64 }));
  group.add(halo(R, '#b580ff', { scale: 1.16, intensity: 1.1 }));
  const sonar = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP) / 210.0; if (r > 1.0) discard;
        float w = fract(r*1.0 - uTime*0.22); float ring = smoothstep(0.0, 0.01, w) * smoothstep(0.035, 0.01, w) * (1.0 - r);
        float ring2 = smoothstep(0.985, 1.0, fract(r*9.0)) * 0.12;
        float a = atan(vP.y, vP.x); float sweep = pow(max(0.0, cos(a - uTime*0.9)), 30.0) * (1.0 - r);
        float fade = smoothstep(1.0, 0.2, r) * smoothstep(0.12, 0.2, r);
        vec3 c = vec3(1.1, 0.7, 1.6) * (ring*0.9 + ring2 + sweep*0.5) * fade;
        gl_FragColor = vec4(c, 1.0); }`,
    ...additive({ side: THREE.DoubleSide }),
  }));
  sonar.userData.billboard = true;
  group.add(sonar);
  const blips = [];
  for (let i = 0; i < 7; i++) { const b = glowSprite(14, i % 3 ? '#ffb3d9' : '#e7d2ff', { power: 2.0, intensity: 2.4 }); const a = rand() * Math.PI * 2, r = 60 + rand() * 130; b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); b.userData.ph = rand() * 6; group.add(b); blips.push(b); }
  return {
    group, radius: 200,
    update(t, ctx) {
      sonar.material.uniforms.uTime.value = t;
      blips.forEach(b => { b.material.uniforms.uIntensity.value = 2.6 * Math.pow(Math.max(0, Math.sin(t * 0.9 + b.userData.ph)), 8); });
      billboards(group, ctx.camera);
      group.children[0].material.uniforms.uTime.value = t;
    },
  };
}

// ---------- More signals: a small satellite constellation ----------
export function signals() {
  const group = new THREE.Group();
  const sats = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.85, roughness: 0.35, emissive: 0x08120e });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x0f2a24, metalness: 0.6, roughness: 0.45, emissive: 0x0a3a2c });
  const spots = [[-120, 30, 0], [-40, -40, 30], [50, 46, -10], [130, -20, 20]];
  const linePts = [];
  spots.forEach((p, i) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0), metal);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 9), panelMat);
    g.add(core, wing);
    const beacon = glowSprite(26, '#8cf5b0', { power: 2.2, intensity: 2.0 }); g.add(beacon);
    g.position.set(...p); g.userData = { beacon, ph: i * 1.7, base: V3(...p) };
    group.add(g); sats.push(g); linePts.push(V3(...p));
  });
  const lines = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x8cf5b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(lines);
  const key = new THREE.DirectionalLight(0xcfe3ff, 2.2); key.position.set(-160, 160, 200); key.target = group; group.add(key);
  return {
    group, radius: 180,
    update(t, ctx) {
      sats.forEach((s, i) => {
        s.rotation.set(t * 0.2 + i, t * 0.3 + i, 0);
        s.position.copy(s.userData.base).add(V3(0, Math.sin(t * 0.5 + i) * 6, 0));
        s.userData.beacon.material.uniforms.uIntensity.value = 0.4 + 2.4 * Math.pow(Math.max(0, Math.sin(t * 2.2 + s.userData.ph)), 12);
        s.userData.beacon.quaternion.copy(ctx.camera.quaternion);
      });
      const arr = lines.geometry.attributes.position.array; sats.forEach((s, i) => { arr[i * 3] = s.position.x; arr[i * 3 + 1] = s.position.y; arr[i * 3 + 2] = s.position.z; }); lines.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- Edge: a black hole ----------
export function blackHole() {
  const group = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.SphereGeometry(26, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  group.add(hole);
  const diskMat = new THREE.ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + /* glsl */`uniform float uTime; varying vec2 vP; varying vec3 vW;
      void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
        float u = (r - 34.0) / 120.0; if (u < 0.0 || u > 1.0) discard;
        float spin = a + uTime*(0.9 / (0.3 + u)) ;
        float n = fbm(vec3(cos(spin)*u*3.0, sin(spin)*u*3.0, uTime*0.05 + u*2.0))*0.5+0.5;
        float streak = 0.6 + 0.4*sin(spin*3.0 + n*6.0);
        vec3 hot = vec3(3.2, 2.8, 2.4), mid = vec3(2.4, 1.0, 0.3), cold = vec3(0.6, 0.1, 0.05);
        vec3 c = mix(hot, mid, smoothstep(0.0, 0.35, u)); c = mix(c, cold, smoothstep(0.35, 1.0, u));
        float dop = 0.6 + 0.6*cos(a - 0.6);
        float f = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.55, u) * n * streak * dop;
        gl_FragColor = vec4(c * f, 1.0); }`,
    ...additive({ side: THREE.DoubleSide }),
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(34, 154, 256, 2), diskMat);
  const tilt = new THREE.Group(); tilt.add(disk); disk.rotation.x = -Math.PI / 2; tilt.rotation.set(0.22, 0, 0.12); group.add(tilt);
  const photon = new THREE.Mesh(new THREE.RingGeometry(26.5, 31, 200), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vP; void main(){ float r = length(vP); float k = 1.0 - abs(r - 28.0)/3.0; float a = atan(vP.y, vP.x);
      gl_FragColor = vec4(vec3(2.8, 2.0, 1.3) * pow(max(k,0.0), 2.0) * (0.7 + 0.3*cos(a - 0.6 + uTime*0.2)), 1.0); }`,
    ...additive({ side: THREE.DoubleSide }),
  }));
  photon.userData.billboard = true; group.add(photon);
  const lens = new THREE.Mesh(new THREE.RingGeometry(30, 70, 200, 1, 0, Math.PI), new THREE.ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: NOISE + /* glsl */`uniform float uTime; varying vec2 vP; void main(){ float r = length(vP); float u = (r - 30.0)/40.0; float a = atan(vP.y, vP.x);
      float n = fbm(vec3(a*3.0 + uTime*0.4, u*3.0, uTime*0.05))*0.5+0.5;
      float f = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.3, u) * n * sin(clamp(a,0.0,3.1416));
      gl_FragColor = vec4(mix(vec3(3.0,2.4,1.8), vec3(2.0,0.7,0.2), u) * f * 0.9, 1.0); }`,
    ...additive({ side: THREE.DoubleSide }),
  }));
  lens.userData.billboard = true; group.add(lens);
  group.add(glowSprite(520, '#ff8a3c', { power: 5.0, intensity: 0.32 }));
  return {
    group, radius: 160,
    update(t, ctx) { diskMat.uniforms.uTime.value = t; photon.material.uniforms.uTime.value = t; lens.material.uniforms.uTime.value = t; billboards(group, ctx.camera); },
  };
}

// rough up a geometry's vertices so rock reads as rock
function roughen(geo, amount, freq = 0.12) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * freq + y * freq * 0.4) * 0.45 + Math.sin(z * freq * 1.3 - y * freq * 0.7) * 0.35 + (rand() - 0.5) * 0.5;
    const k = 1 + n * amount;
    pos.setXYZ(i, x * k, y + (rand() - 0.5) * amount * 20, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Lantern Gorge: karst spires, a pagoda, and a river of sky lanterns ----------
export function gorge() {
  const group = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x141b27, roughness: 0.9, metalness: 0, flatShading: true, emissive: 0x05080f });
  const moss = new THREE.MeshStandardMaterial({ color: 0x173022, roughness: 1, flatShading: true });
  const base = -200;
  // x, z, radius, height
  const spires = [[-160, -20, 50, 300], [-100, -70, 38, 235], [-35, 25, 34, 340], [25, -85, 30, 205], [80, 15, 44, 285], [140, -45, 36, 250], [190, 35, 28, 195], [-215, 45, 30, 185], [10, 95, 24, 160], [-120, 90, 22, 140]];
  spires.forEach(([x, z, r, h]) => {
    const m = new THREE.Mesh(roughen(new THREE.CylinderGeometry(r * 0.5, r, h, 11, 16), 0.17), rock);
    m.position.set(x, base + h / 2, z); group.add(m);
    const cap = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(r * 0.62, 1), 0.2), moss);
    cap.scale.set(1, 0.42, 1); cap.position.set(x, base + h + 3, z); group.add(cap);
  });
  // a nine-storey pagoda on the tallest spire
  const [px, pz, , ph] = spires[2];
  const pagoda = new THREE.Group(); pagoda.position.set(px, base + ph + 6, pz); group.add(pagoda);
  const lime = new THREE.MeshStandardMaterial({ color: 0xd9d3c4, roughness: 0.7 });
  const eave = new THREE.MeshStandardMaterial({ color: 0x3b414b, roughness: 0.8 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(1.6) });
  for (let i = 0; i < 9; i++) {
    const r = 7.5 - i * 0.55, y = i * 5.2;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 4, 8), lime); body.position.y = y + 2; pagoda.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.45, 2.2, 8, 1, true), eave); roof.position.y = y + 4.6; pagoda.add(roof);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.9, 8, 1, true), glowMat); band.position.y = y + 2.2; pagoda.add(band);
  }
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 8), eave); finial.position.y = 9 * 5.2 + 3; pagoda.add(finial);

  // the river
  const river = new THREE.Mesh(new THREE.PlaneGeometry(560, 150), new THREE.ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: NOISE + /* glsl */`uniform float uTime; varying vec2 vP;
      void main(){ float n = fbm(vec3(vP.x*0.02, vP.y*0.12 + uTime*0.15, uTime*0.05));
        float glint = pow(max(0.0, n), 3.0);
        vec3 c = vec3(0.02, 0.05, 0.08) + vec3(1.6, 0.7, 0.25) * glint * 0.7;
        float edge = smoothstep(75.0, 40.0, abs(vP.y)) * smoothstep(280.0, 200.0, abs(vP.x));
        gl_FragColor = vec4(c * edge, 1.0); }`,
    ...additive(),
  }));
  river.rotation.x = -Math.PI / 2; river.position.y = base + 1; group.add(river);

  // sky lanterns rising out of the gorge
  const lanterns = points(2000, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(rand() - 0.5) * 380, rand(), (rand() - 0.5) * 140], i * 3); seed[i] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; varying vec3 vColor; varying float vAlpha;
      void main(){
        float life = fract(position.y + uTime*(0.012 + aSeed*0.012));
        vec3 p = vec3(position.x + sin(uTime*0.4 + aSeed*20.0)*6.0 + life*60.0, -190.0 + life*470.0, position.z + cos(uTime*0.3 + aSeed*13.0)*5.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (3.2 + aSeed*3.6) * uPR * (360.0 / -mv.z);
        float flick = 0.82 + 0.18*sin(uTime*7.0 + aSeed*60.0);
        vColor = (aSeed > 0.93 ? vec3(3.0, 0.6, 0.3) : vec3(3.0, 1.35, 0.45)) * flick;
        vAlpha = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.62, life);
        gl_Position = projectionMatrix * mv;
      }`,
  });
  group.add(lanterns);

  const moon = new THREE.Group(); moon.add(glowSprite(150, '#bcd2ff', { power: 2.6, intensity: 0.7 })); moon.add(glowSprite(26, '#f4f7ff', { power: 1.2, intensity: 2.4 }));
  moon.position.set(60, 170, -260); group.add(moon);
  const moonlight = new THREE.DirectionalLight(0x9db8ff, 2.2); moonlight.position.set(160, 240, -320); moonlight.target = group; group.add(moonlight);
  const twilight = glowSprite(1100, '#2a4c9a', { power: 3.2, intensity: 0.42 }); twilight.position.set(0, -40, -380); group.add(twilight);
  const dusk = glowSprite(700, '#ff8a4a', { power: 4.5, intensity: 0.22 }); dusk.position.set(-120, -150, -360); group.add(dusk);
  const warm = new THREE.PointLight(0xff9440, 140, 700, 1); warm.position.set(0, base + 30, 60); group.add(warm);
  return {
    group, radius: 230,
    update(t, ctx) {
      lanterns.material.uniforms.uTime.value = t; lanterns.material.uniforms.uPR.value = ctx.pr;
      river.material.uniforms.uTime.value = t;
      pagoda.rotation.y = Math.sin(t * 0.05) * 0.04;
      billboards(group, ctx.camera);
    },
  };
}

// ---------- Golden Acropolis: a floating temple island at sunset ----------
export function acropolis() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8c6b52, roughness: 0.95, flatShading: true });
  const terrace = new THREE.MeshStandardMaterial({ color: 0xd8c6a4, roughness: 0.8 });
  const marble = new THREE.MeshStandardMaterial({ color: 0xf3e9d8, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xebb85c, roughness: 0.25, metalness: 1, emissive: 0x3a2208 });
  const green = new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 0.9, flatShading: true });

  const island = new THREE.Mesh(roughen(new THREE.ConeGeometry(80, 150, 20, 10), 0.14, 0.09), stone);
  island.rotation.x = Math.PI; island.position.y = -75; group.add(island);
  [[80, 8, 0], [62, 9, 8], [44, 9, 17]].forEach(([r, h, y]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 48), terrace); m.position.y = y + h / 2 - 4; group.add(m); });

  // a round temple: twelve columns, a gilded drum and dome
  const top = 22;
  const stylobate = new THREE.Mesh(new THREE.CylinderGeometry(19, 20.5, 2.4, 48), marble); stylobate.position.y = top + 1.2; group.add(stylobate);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, 19, 14), marble);
    col.position.set(Math.cos(a) * 16, top + 2.4 + 9.5, Math.sin(a) * 16); group.add(col);
  }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 3, 48, 1, true), gold); drum.position.y = top + 23.4; group.add(drum);
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d3270, roughness: 0.32, metalness: 0.35, emissive: 0x050a1c });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(17.5, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), blue); dome.position.y = top + 24.9; group.add(dome);
  for (let i = 0; i < 12; i++) { // gilded ribs over the blue dome, as in the render
    const rib = new THREE.Mesh(new THREE.TorusGeometry(17.7, 0.32, 6, 28, Math.PI / 2), gold);
    rib.position.y = top + 24.9; rib.rotation.y = i / 12 * Math.PI * 2; group.add(rib);
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10), gold); finial.position.y = top + 43; group.add(finial);
  const inner = new THREE.PointLight(0xffc070, 60, 160, 1); inner.position.y = top + 10; group.add(inner);

  // cypresses around the terraces
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.2, r = i % 2 ? 54 : 72, h = 16 + (i % 3) * 5;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(3.2, h, 7), green);
    tree.position.set(Math.cos(a) * r, (r > 60 ? 4 : 13) + h / 2, Math.sin(a) * r); group.add(tree);
  }

  // the cascade spilling off the edge
  const falls = points(1600, n => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(rand() - 0.5) * 9, rand(), (rand() - 0.5) * 3], i * 3); seed[i] = rand(); }
    return { position: [pos, 3], aSeed: [seed, 1] };
  }, {
    vertex: /* glsl */`uniform float uTime, uPR; attribute float aSeed; varying vec3 vColor; varying float vAlpha;
      void main(){
        float life = fract(position.y + uTime*(0.18 + aSeed*0.08));
        float drop = life*life;
        vec3 p = vec3(position.x * (1.0 + life*2.5), 6.0 - drop*260.0, 79.0 + life*14.0 + position.z * (1.0 + life*3.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.2 + aSeed*1.8 + life*2.0) * uPR * (300.0 / -mv.z);
        vColor = mix(vec3(1.9, 1.8, 1.7), vec3(1.3, 1.1, 1.2), life);
        vAlpha = smoothstep(0.0, 0.04, life) * smoothstep(1.0, 0.5, life) * 0.75;
        gl_Position = projectionMatrix * mv;
      }`,
  });
  group.add(falls);

  const sunset = glowSprite(560, '#ff8a5c', { power: 3.6, intensity: 0.45 }); sunset.position.set(-60, -10, -220); group.add(sunset);
  const sun = new THREE.Group(); sun.add(glowSprite(110, '#ffb35c', { power: 2.4, intensity: 1.2, rays: 0.6 })); sun.add(glowSprite(22, '#fff3d8', { power: 1.4, intensity: 2.6 }));
  sun.position.set(-140, 30, -260); group.add(sun);
  const key = new THREE.DirectionalLight(0xffb478, 3.2); key.position.set(-220, 90, -60); key.target = group; group.add(key);
  const fill = new THREE.DirectionalLight(0xff7aa0, 0.9); fill.position.set(200, 40, 160); fill.target = group; group.add(fill);
  return {
    group, radius: 140,
    update(t, ctx) {
      falls.material.uniforms.uTime.value = t; falls.material.uniforms.uPR.value = ctx.pr;
      group.position.y = group.userData.baseY + Math.sin(t * 0.35) * 4;
      billboards(group, ctx.camera);
    },
  };
}

export const BUILDERS = { gate, represent, titan, distill, contrail, nova: novaStage, stardash: starDash, tsuki, countmein: candy, gorge, acropolis, akatsuki: dawn, radar, signals, edge: blackHole };
