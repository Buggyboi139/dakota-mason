// Entry point: builds the guide UI from window.SITE, routes deep links, and
// loads the 3D city. Without WebGL the same content renders as a plain guide.
import { DISTRICTS, buildPlaces } from './data.js';
import { h, icon, dotted, renderMasthead, renderContacts, renderDirectory, renderPin, renderPlaceBody } from './ui.js';

const S = window.SITE;
const doc = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const places = buildPlaces(S);
const byId = new Map(places.map((p) => [p.id, p]));
const params = new URLSearchParams(location.search);
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqPhone = matchMedia('(max-width: 760px)');

for (const [k, d] of Object.entries(DISTRICTS)) {
  doc.style.setProperty(`--c-${k}`, d.color);
  doc.style.setProperty(`--t-${k}`, d.tint);
}
document.title = `${S.name} | ${S.headline}`;
$('meta[name="description"]').setAttribute('content', `${S.name}: ${S.summary}`);

// ---------- static UI ----------
$('#mast-body').append(...renderMasthead(S));
$('#contact').append(...renderContacts(S));
$('#dir-lines').append(...renderDirectory(places, S));
$('#dir-foot').append(...dotted(S.footer).flat());
$('#top-name').textContent = S.name;
$('#top-sub').textContent = S.headline;
for (const el of document.querySelectorAll('[data-icon]')) el.prepend(icon(el.dataset.icon));
$('#skip').addEventListener('click', (e) => {
  if (fallback) return;
  e.preventDefault();
  if (mqPhone.matches) openDir();
  else { const a = dir.querySelector('a'); if (a) a.focus(); }
});

const card = $('#card');
const scrollEl = $('#card-scroll');
const mast = $('#mast');
const dir = $('#directory');
let current = null;
let scene = null;
let fallback = false;
let keyboardMode = false;
addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') keyboardMode = true; }, true);
addEventListener('pointerdown', () => { keyboardMode = false; }, true);

// ---------- card ----------
function cardNav(p) {
  const prev = places[(p.index - 1 + places.length) % places.length];
  const next = places[(p.index + 1) % places.length];
  const btn = (q, dirn) => h('a', { class: `hop hop--${dirn}`, href: `#${q.id}`, 'data-go': q.id },
    icon(dirn === 'prev' ? 'prev' : 'next', 'i hop__i'),
    h('span', { class: 'hop__text' }, h('span', { class: 'hop__k' }, dirn === 'prev' ? 'Previous stop' : 'Next stop'), h('span', { class: 'hop__n' }, q.title)));
  return h('nav', { class: 'hops', 'aria-label': 'More stops' }, btn(prev, 'prev'), btn(next, 'next'));
}

function openCard(id, { focus = false } = {}) {
  const p = byId.get(id);
  const { head, body } = renderPlaceBody(S, p, places, 'card-title');
  scrollEl.replaceChildren(head, body, cardNav(p));
  scrollEl.scrollTop = 0;
  card.style.setProperty('--c', DISTRICTS[p.district].color);
  card.style.setProperty('--t', DISTRICTS[p.district].tint);
  card.dataset.kind = p.kind;
  card.hidden = false;
  void card.offsetWidth;
  doc.classList.add('card-open');
  current = id;
  for (const a of dir.querySelectorAll('.stop[data-go], .shop[data-go]')) {
    if (a.dataset.go === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  }
  pinEls.forEach((el, pid) => el.classList.toggle('is-active', pid === id));
  if (focus) $('#card-title').focus({ preventScroll: true });
  sheet(mqPhone.matches ? 'mid' : null);
  insetsChanged();
}

function closeCard() {
  if (!current) return;
  const was = current;
  current = null;
  doc.classList.remove('card-open');
  for (const a of dir.querySelectorAll('[aria-current]')) a.removeAttribute('aria-current');
  pinEls.forEach((el) => el.classList.remove('is-active'));
  setTimeout(() => { if (!current) card.hidden = true; }, 420);
  insetsChanged();
  if (keyboardMode) {
    const back = dir.querySelector(`[data-go="${was}"]`);
    if (back && getComputedStyle(back).visibility !== 'hidden' && back.offsetParent) back.focus({ preventScroll: true });
  }
}

// Phone bottom sheet height: 'mid' or 'full'.
function sheet(state) {
  if (state) card.dataset.sheet = state; else delete card.dataset.sheet;
  $('#card-grip').setAttribute('aria-label', state === 'full' ? 'Shrink the card' : 'Expand the card');
}

// ---------- routing ----------
function go(id, { push = true, focus = keyboardMode, instant = false } = {}) {
  if (!byId.has(id)) return;
  if (fallback) { const t = document.getElementById(id); if (t) t.scrollIntoView({ block: 'start' }); return; }
  if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  closeDir();
  openCard(id, { focus });
  // Frame the close-up for the free area that remains once the card is open.
  if (scene) { scene.setInsets(); scene.go(id, { instant: instant || mqReduce.matches }); }
  hideHint();
}
function goHome({ push = true } = {}) {
  if (push && location.hash) history.pushState(null, '', location.pathname + location.search);
  closeCard();
  if (scene) { scene.setInsets(); scene.home({ instant: mqReduce.matches }); }
}
function syncFromHash() {
  if (fallback) return;
  const id = decodeURIComponent(location.hash.slice(1));
  if (byId.has(id)) { if (id !== current) go(id, { push: false, focus: false }); }
  else if (!id && current) goHome({ push: false });
}
addEventListener('popstate', syncFromHash);
addEventListener('hashchange', syncFromHash);

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]');
  if (!a || fallback) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  go(a.dataset.go, { focus: keyboardMode || !!a.closest('#directory, #card') });
});

// ---------- header controls ----------
const timeBtn = $('#daynight');
function setNight(on, instant = false) {
  doc.dataset.time = on ? 'night' : 'day';
  timeBtn.setAttribute('aria-checked', String(on));
  if (scene) scene.setNight(on, { instant: instant || mqReduce.matches });
}
timeBtn.addEventListener('click', () => setNight(doc.dataset.time !== 'night'));

const dirBtn = $('#dir-toggle');
function openDir() {
  doc.classList.add('dir-open');
  dirBtn.setAttribute('aria-expanded', 'true');
  const first = dir.querySelector('a');
  if (first) first.focus({ preventScroll: true });
}
function closeDir() {
  if (!doc.classList.contains('dir-open')) return;
  doc.classList.remove('dir-open');
  dirBtn.setAttribute('aria-expanded', 'false');
}
dirBtn.addEventListener('click', () => (doc.classList.contains('dir-open') ? closeDir() : openDir()));

$('#card-close').addEventListener('click', () => goHome());
$('#card-grip').addEventListener('click', () => sheet(card.dataset.sheet === 'full' ? 'mid' : 'full'));
const foldBtn = $('#mast-fold');
foldBtn.addEventListener('click', () => {
  const folded = mast.classList.toggle('is-folded');
  foldBtn.setAttribute('aria-expanded', String(!folded));
  insetsChanged();
});

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (doc.classList.contains('dir-open')) { closeDir(); dirBtn.focus(); }
  else if (current) { const was = current; goHome(); const b = dir.querySelector(`[data-go="${was}"]`); if (b && b.offsetParent) b.focus({ preventScroll: true }); }
});

// Drag the phone sheet handle to resize or dismiss.
(() => {
  const grip = $('#card-grip');
  let y0 = null, h0 = 0, moved = false;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; h0 = card.offsetHeight; moved = false; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    if (Math.abs(dy) > 6) moved = true;
    if (moved) card.style.setProperty('--drag', `${Math.max(-h0, dy)}px`);
  });
  const end = (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    card.style.removeProperty('--drag');
    if (!moved) return;
    if (dy > 120 && card.dataset.sheet !== 'full') goHome();
    else if (dy > 60) sheet('mid');
    else if (dy < -60) sheet('full');
    grip.addEventListener('click', (ev) => ev.stopImmediatePropagation(), { once: true, capture: true });
    insetsChanged();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
})();

// ---------- map controls and hint ----------
for (const b of document.querySelectorAll('[data-map]')) b.addEventListener('click', () => { if (scene) scene.control(b.dataset.map); hideHint(); });
const compass = $('[data-map="home"] .i');
const hint = $('#hint');
const coarse = matchMedia('(pointer: coarse)').matches;
hint.replaceChildren(h('span', null, dotted(coarse ? 'Drag to orbit · Pinch to zoom · Tap a building' : 'Drag to orbit · Scroll to zoom · Click a building')));
function hideHint() { hint.classList.add('is-gone'); }
// On phones the hint sits in the strip between the map and the summary sheet.
function placeHint() {
  hint.style.top = mqPhone.matches ? `${mast.offsetTop - 28}px` : '';
  // The full-height phone sheet stops under the top bar so contact links stay in reach.
  const tb = $('#topbar');
  doc.style.setProperty('--topbar', `${tb.offsetTop + tb.offsetHeight + 2}px`);
}

// ---------- pins ----------
const pinEls = new Map();
const pinLayer = $('#pins');
for (const p of places) {
  if (!p.pin) continue;
  const el = renderPin(p);
  pinLayer.append(el);
  pinEls.set(p.id, el);
  const btn = el.querySelector('button');
  btn.addEventListener('mouseenter', () => scene && scene.hover(p.id));
  btn.addEventListener('mouseleave', () => scene && scene.hover(null));
}
function onHover(id) {
  pinEls.forEach((el, pid) => el.classList.toggle('is-hover', pid === id));
  for (const a of dir.querySelectorAll('[data-go]')) a.classList.toggle('is-hover', a.dataset.go === id);
}
for (const a of dir.querySelectorAll('[data-go]')) {
  a.addEventListener('mouseenter', () => { if (scene) scene.hover(a.dataset.go); onHover(a.dataset.go); });
  a.addEventListener('mouseleave', () => { if (scene) scene.hover(null); onHover(null); });
}

// ---------- layout insets for the 3D view ----------
function getInsets() {
  const W = innerWidth, H = innerHeight;
  if (mqPhone.matches) {
    const tb = $('#topbar');
    const top = tb.offsetTop + tb.offsetHeight + 6;
    let bottom = 0;
    if (current) bottom = H - card.offsetTop;
    else bottom = H - mast.offsetTop + 30;
    return { left: 0, right: 0, top, bottom: Math.max(0, Math.min(H * 0.8, bottom)) };
  }
  const side = $('#side');
  const left = side.offsetLeft + side.offsetWidth + 8;
  const right = current ? W - card.offsetLeft + 8 : 72;
  const top = 64;
  return { left, right, top, bottom: 16 };
}
let insetRaf = 0;
function insetsChanged() {
  placeHint();
  cancelAnimationFrame(insetRaf);
  insetRaf = requestAnimationFrame(() => { if (scene) scene.setInsets(); });
}
mqPhone.addEventListener('change', () => { if (scene) scene.refit(); });
// The summary sheet's height changes with fonts, folding, and rotation.
new ResizeObserver(() => insetsChanged()).observe(mast);
addEventListener('resize', placeHint);
placeHint();

// ---------- boot ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function renderFallback() {
  fallback = true;
  doc.classList.add('is-fallback');
  doc.classList.remove('is-loading');
  const guide = $('#guide');
  guide.hidden = false;
  for (const p of places) {
    const { head, body } = renderPlaceBody(S, p, places, `t-${p.id}`);
    const sec = h('section', { class: 'stop-sec', id: p.id, style: { '--c': DISTRICTS[p.district].color, '--t': DISTRICTS[p.district].tint }, 'aria-labelledby': `t-${p.id}` }, head, body);
    guide.append(sec);
  }
  for (const a of dir.querySelectorAll('[data-go]')) a.removeAttribute('data-go');
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}

async function boot() {
  setNight(false, true);
  if (params.has('flat') || !webglOK()) { renderFallback(); return; }
  try {
    const { createScene } = await import('./scene.js');
    scene = await createScene({
      host: $('#stage'),
      places,
      pins: [...pinEls].map(([id, el]) => ({ id, el, prio: byId.get(id).pin.prio, small: !!byId.get(id).pin.small })),
      onView: (theta) => compass.style.setProperty('--north', `${theta}rad`),
      reduced: mqReduce.matches,
      onHover,
      onPick: (id) => go(id, { focus: false }),
      getInsets,
    });
  } catch (err) {
    renderFallback();
    return;
  }
  doc.classList.remove('is-loading');
  if (params.has('debug')) window.__city = { scene, go, goHome, places };
  mqReduce.addEventListener('change', () => scene.setReduced(mqReduce.matches));
  document.fonts.ready.then(() => scene.measure());
  scene.canvas.addEventListener('pointerdown', hideHint, { once: true });
  const id = decodeURIComponent(location.hash.slice(1));
  if (byId.has(id)) setTimeout(() => go(id, { push: false, focus: false }), mqReduce.matches ? 0 : 450);
}
boot();
