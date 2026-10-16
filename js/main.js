import { createSpace, ROUTE } from './scene.js';
import { createFlight } from './flight.js';
import { createNova } from './nova.js';
import { createAudio } from './audio.js';
import { createTheater } from './theater.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) root.classList.add('reduce');
const coarse = matchMedia('(pointer: coarse)').matches;
const wantsFlight = () => !reduced && window.innerWidth >= 900 && window.innerHeight >= 560;

// ---------- quality ----------
const small = coarse || window.innerWidth < 900;
const cores = navigator.hardwareConcurrency || 4;
const quality = small
  ? { dpr: 1.25, stars: 9000, streaks: 900, dust: 280, bloom: true, octaves: 3 }
  : cores >= 8 ? { dpr: 1.5, stars: 26000, streaks: 2600, dust: 900, bloom: true, octaves: 4 }
    : { dpr: 1.25, stars: 16000, streaks: 1600, dust: 600, bloom: true, octaves: 4 };

// ---------- space ----------
let space = null;
try { space = createSpace(document.getElementById('space'), { quality, reduced }); }
catch (e) { console.warn('No WebGL, showing the flat version.', e); root.classList.add('no-webgl'); }

let flightMode = !!space && wantsFlight();
root.classList.toggle('flight', flightMode);

const tStation = space ? space.tStation : ROUTE.map((_, i) => i / (ROUTE.length - 1));
const flight = createFlight({ tStation, flightMode });
const nova = createNova({ reduced, flightMode });
const audio = createAudio();
const novaIndex = flight.info.findIndex(s => s.id === 'nova');

// smooth wheel scrolling on desktop
let lenis = null;
function setLenis(on) {
  if (on && !lenis && window.Lenis && !coarse) lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  if (!on && lenis) { lenis.destroy(); lenis = null; }
}
setLenis(flightMode);

// ---------- theater ----------
let paused = false;
const theater = createTheater({
  onOpen() {
    paused = true; nova.setHidden(true); audio.duck(true); lenis && lenis.stop();
    document.querySelectorAll('.journey video').forEach(v => v.pause());
  },
  onClose() {
    paused = false; nova.setHidden(false); audio.duck(false); lenis && lenis.start();
    last = performance.now();
    const cur = document.querySelector('.stop.is-current');
    if (cur && !reduced) cur.querySelectorAll('video').forEach(v => v.src && v.play().catch(() => {}));
    if (!flightMode) document.querySelectorAll('.journey video').forEach(v => { const r = v.getBoundingClientRect(); if (v.src && r.bottom > 0 && r.top < innerHeight) v.play().catch(() => {}); });
  },
});

// ---------- flying to a stop ----------
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function flyTo(id) {
  const y = flight.scrollYFor(id);
  const dist = Math.abs(y - window.scrollY) / window.innerHeight;
  if (lenis) lenis.scrollTo(y, { duration: Math.min(5, Math.max(2.2, 1.4 + dist * 0.12)), easing: easeInOut });
  else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fly]');
  if (!b) return;
  e.preventDefault();
  closeIndex(false);
  audio.blip();
  flyTo(b.dataset.fly);
});

// ---------- all projects ----------
const index = document.getElementById('index');
let indexOpener = null;
function openIndex(from) {
  indexOpener = from; index.hidden = false; root.classList.add('index-open'); lenis && lenis.stop();
  index.querySelector('[data-close-index]').focus();
}
function closeIndex(restore = true) {
  if (index.hidden) return;
  index.hidden = true; root.classList.remove('index-open'); lenis && lenis.start();
  if (restore && indexOpener) indexOpener.focus({ preventScroll: true });
}
document.getElementById('open-index').addEventListener('click', e => openIndex(e.currentTarget));
document.querySelectorAll('[data-open-index]').forEach(b => b.addEventListener('click', e => openIndex(e.currentTarget)));
index.querySelector('[data-close-index]').addEventListener('click', () => closeIndex());
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeIndex(); });

// ---------- sound ----------
const soundBtn = document.getElementById('sound'), soundLabel = document.getElementById('sound-label');
function syncSound() { soundBtn.setAttribute('aria-pressed', String(audio.on)); soundLabel.textContent = audio.on ? 'Sound on' : 'Sound off'; }
soundBtn.addEventListener('click', () => { audio.toggle(); syncSound(); audio.blip(); });
if (audio.wanted) {
  const first = () => { if (!audio.on) { audio.set(true); syncSound(); } window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  window.addEventListener('pointerdown', first); window.addEventListener('keydown', first);
}
document.addEventListener('pointerenter', e => { if (e.target.closest && e.target.closest('.btn, .chip, .route__btn')) audio.blip(); }, true);

// ---------- Nova and arrivals ----------
flight.on('stop', s => { nova.speak(s.line, s.mood); audio.chirp(); });
flight.on('leg', l => { nova.speak(l.line, l.mood); });
space && space.onCross(() => audio.thump());
nova.onChip(() => audio.blip());

// ---------- small motion details ----------
const deck = document.querySelector('.deck');
setInterval(() => {
  if (!deck || reduced || paused) return;
  const cur = document.querySelector('#contrail.is-current') || !flightMode;
  if (cur) deck.append(deck.firstElementChild);
}, 3600);
const strip = document.querySelector('.strip');
if (strip && !reduced) [...strip.children].forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.querySelector('img').alt = ''; strip.append(c); });

// ---------- layout ----------
function layout() {
  const want = !!space && wantsFlight();
  if (want !== flightMode) {
    flightMode = want; root.classList.toggle('flight', want);
    flight.setMode(want); nova.setMode(want); setLenis(want);
  }
  if (space) space.resize(window.innerWidth, window.innerHeight);
  flight.measure(); nova.measure();
}
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
flight.setMode(flightMode);
layout();

// arrive at a stop from the address bar
const hash = decodeURIComponent(location.hash.slice(1));
const fromHash = flight.info.find(s => s.el.id === hash);
if (fromHash && fromHash.i > 0) window.scrollTo(0, flight.scrollYFor(fromHash.id));

// ---------- loop ----------
let last = performance.now(), slow = 0, degraded = 0, seenW = window.innerWidth, seenH = window.innerHeight;
function frame(now) {
  requestAnimationFrame(frame);
  // catch size changes that arrive without a resize event (a page opened while hidden, for example)
  if (window.innerWidth !== seenW || window.innerHeight !== seenH) { seenW = window.innerWidth; seenH = window.innerHeight; clearTimeout(rz); rz = setTimeout(layout, 60); }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (lenis) lenis.raf(now);
  if (paused) return;
  const nav = flight.update(window.scrollY, space);
  if (space) {
    space.update(dt, nav);
    audio.warp(space.state.warp);
    // keep the frame rate up on slower machines
    slow = slow * 0.97 + (dt > 0.03 ? 1 : 0) * 0.03;
    if (slow > 0.6 && degraded < 2 && now > 4000) { degraded++; slow = 0; space.degrade(degraded); }
  }
  nova.setStage(flightMode && nav.station === novaIndex && nav.dwell > 0.6);
  nova.update(dt);
}
requestAnimationFrame(frame);
requestAnimationFrame(() => root.classList.add('ready'));
setTimeout(() => (window.requestIdleCallback || setTimeout)(() => nova.boot(), { timeout: 1500 }), 900);
document.fonts && document.fonts.ready.then(() => { flight.measure(); nova.measure(); });
