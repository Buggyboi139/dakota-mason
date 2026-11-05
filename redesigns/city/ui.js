// DOM for the city guide: masthead, contact bar, directory, map pins, and the
// info card. Everything renders from window.SITE; no facts live in this file.
import { DISTRICTS, LINES, monthYear } from './data.js';

// ---------- tiny DOM helpers ----------
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
}
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  append(el, kids);
  return el;
}

// Hand-drawn 24px icons, stroke-based so they inherit currentColor.
const ICON = {
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/>',
  out: '<path d="M9 6h9v9M18 6 7 17"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  rotl: '<path d="M4.5 8.5A8 8 0 1 1 4 13"/><path d="M4.5 3.5v5h5"/>',
  rotr: '<path d="M19.5 8.5A8 8 0 1 0 20 13"/><path d="M19.5 3.5v5h-5"/>',
  home: '<path d="M12 3.5 4 9v11h5.5v-6h5v6H20V9z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M12 4.8 14.7 12H9.3z" fill="currentColor"/><path d="M12 19.2 9.3 12h5.4z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  prev: '<path d="M14.5 6 8.5 12l6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  medal: '<path d="M8 3h8l-2.5 6h-3z"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 14.3l2-.3z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 6.5 8 6.5 8-6.5"/>',
  doc: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12.5h6M9 16h6"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
  handle: '<path d="M8 12h8"/>',
};
export function icon(name, cls = 'i') {
  return h('span', { class: cls, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>` });
}

// Text with " · " separators drawn as even dots (the font's middle dot sits off-center).
export function dotted(str) {
  const parts = String(str).split(' · ');
  return parts.map((t, i) => (i ? [h('span', { class: 'mid' }, h('span', { class: 'sr-only' }, ' · ')), t] : t));
}

const ext = (href) => /^https?:/.test(href);
function link(href, label, opts = {}) {
  const external = ext(href);
  return h('a', {
    class: opts.class || 'lnk', href,
    target: external ? '_blank' : null, rel: external ? 'noopener' : null,
    download: opts.download ? '' : null,
    'aria-label': opts.aria || null,
  }, h('span', null, label), external ? icon('out', 'i i--out') : null);
}

export function bullet(district, cls = 'bullet') {
  const d = DISTRICTS[district];
  return h('span', { class: cls, style: { '--c': d.color }, 'aria-hidden': 'true' }, d.code);
}

// ---------- masthead + contact ----------
export function renderMasthead(S) {
  const stats = h('ul', { class: 'stats', 'aria-label': 'At a glance' },
    S.stats.map((st) => h('li', { class: 'stat' },
      h('span', { class: 'stat__fig' }, h('b', null, st.value), st.unit ? h('span', { class: 'stat__unit' }, st.unit) : null),
      h('span', { class: 'stat__lbl' }, st.label))));
  return [
    h('p', { class: 'mast__kicker' }, h('span', null, S.headline), h('span', { class: 'mast__loc' }, S.location)),
    h('h1', { class: 'mast__name' }, h('span', null, S.firstName), ' ', h('span', null, S.lastName)),
    h('p', { class: 'mast__tag' }, S.tagline),
    h('p', { class: 'mast__summary' }, S.summary),
    h('p', { class: 'mast__focus' }, h('span', { class: 'mast__focus-k' }, 'Focus'),
      h('span', null, S.focusAreas.map((t, i) => [i ? ['\u00a0', h('span', { class: 'slashes__sep', 'aria-hidden': 'true' }, '/'), ' '] : null, h('span', { class: 'mast__area' }, t)]))),
    h('p', { class: 'mast__status' }, h('span', { class: 'mast__dot', 'aria-hidden': 'true' }), h('span', null, dotted(S.status))),
    stats,
  ];
}

export function renderContacts(S) {
  const L = S.links;
  const items = [
    { k: 'resume', href: L.resume.href, label: L.resume.label, short: 'Resume', ico: 'download', download: true },
    { k: 'linkedin', href: L.linkedin.href, label: L.linkedin.label, short: 'in' },
    { k: 'github', href: L.github.href, label: L.github.label, short: 'GH' },
    { k: 'huggingface', href: L.huggingface.href, label: L.huggingface.label, short: 'HF' },
    { k: 'email', href: L.email.href, label: L.email.label, short: '@', ico: 'mail' },
  ];
  return items.map((it) => {
    const external = ext(it.href);
    return h('a', {
      class: `cx cx--${it.k}`, href: it.href,
      target: external ? '_blank' : null, rel: external ? 'noopener' : null,
      download: it.download ? '' : null,
      title: it.k === 'email' ? L.email.address : it.label,
      'aria-label': it.k === 'resume' ? `${it.label} (PDF)` : it.k === 'email' ? `${it.label} ${L.email.address}` : it.label,
    },
    it.ico ? icon(it.ico, 'i cx__i') : null,
    h('span', { class: 'cx__long' }, it.label),
    h('span', { class: 'cx__short', 'aria-hidden': 'true' }, it.short));
  });
}

// ---------- directory ----------
export function renderDirectory(places, S) {
  const frag = [];
  const byId = Object.fromEntries(places.map((p) => [p.id, p]));
  for (const line of LINES) {
    const stops = places.filter((p) => p.line === line.id);
    const kiosks = stops.filter((p) => p.kind === 'kiosk');
    const main = stops.filter((p) => p.kind !== 'kiosk');
    const ol = h('ol', { class: 'stops' });
    for (const p of main) {
      ol.append(h('li', { class: 'stops__item' }, stopLink(p)));
      if (p.id === 'pearltide' && kiosks.length) {
        // Project Row: one stop with five shops.
        ol.append(h('li', { class: 'stops__item stops__item--row' },
          h('span', { class: 'stop stop--static', style: { '--c': DISTRICTS.tech.color } },
            h('span', { class: 'stop__dot', 'aria-hidden': 'true' }),
            h('span', { class: 'stop__text' }, h('span', { class: 'stop__name' }, kiosks[0].building),
              h('span', { class: 'stop__meta' }, `${kiosks.length} shops`))),
          h('ul', { class: 'shops' }, kiosks.map((k) => h('li', null,
            h('a', { class: 'shop', href: `#${k.id}`, 'data-go': k.id }, k.title))))));
      }
    }
    frag.push(h('section', { class: 'line', 'aria-labelledby': `line-${line.id}` },
      h('h2', { class: 'line__name', id: `line-${line.id}` }, h('span', { class: 'line__code', 'aria-hidden': 'true' }, line.code), line.name),
      ol));
  }
  // Career milestones, oldest first, as a timetable under the lines.
  if (S && S.milestones && S.milestones.length) {
    frag.push(h('section', { class: 'line line--times', 'aria-labelledby': 'line-times' },
      h('h2', { class: 'line__name', id: 'line-times' }, h('span', { class: 'line__code', 'aria-hidden': 'true' }, String(LINES.length + 1)), 'Timeline'),
      h('ol', { class: 'times' }, S.milestones.map((m) => {
        const p = byId[m.ref];
        const inner = [h('span', { class: 'time__date' }, monthYear(m.date)), h('span', { class: 'time__label' }, m.label)];
        return h('li', null, p
          ? h('a', { class: 'time', href: `#${p.id}`, 'data-go': p.id, style: { '--c': DISTRICTS[p.district].color } }, inner)
          : h('span', { class: 'time' }, inner));
      }))));
  }
  return frag;
}
function stopLink(p) {
  const d = DISTRICTS[p.district];
  return h('a', { class: 'stop', href: `#${p.id}`, 'data-go': p.id, style: { '--c': d.color } },
    h('span', { class: 'stop__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'stop__text' },
      h('span', { class: 'stop__name' }, p.title),
      h('span', { class: 'stop__meta' }, dotted(p.kind === 'role' ? `${p.building} · ${p.meta}` : p.kind === 'district' ? p.meta : p.building))));
}

// ---------- pins (projected over the 3D buildings) ----------
export function renderPin(p) {
  const d = DISTRICTS[p.district];
  return h('div', { class: `pin${p.pin.small ? ' pin--small' : ''}`, 'data-id': p.id, style: { '--c': d.color, '--t': d.tint } },
    h('button', { class: 'pin__btn', type: 'button', tabindex: '-1', 'aria-hidden': 'true', 'data-go': p.id },
      h('span', { class: 'pin__code' }, d.code),
      h('span', { class: 'pin__text' },
        h('span', { class: 'pin__name' }, p.pin.name),
        h('span', { class: 'pin__sub' }, dotted(p.pin.sub)))),
    h('span', { class: 'pin__stem', 'aria-hidden': 'true' }));
}

// ---------- card content ----------
const sec = (title, ...kids) => h('section', { class: 'blk' }, title ? h('h3', { class: 'blk__h' }, title) : null, ...kids);
const list = (items, cls = 'ticks') => h('ul', { class: cls }, items.map((t) => h('li', null, t)));
const slashes = (items) => h('p', { class: 'slashes' }, items.map((t, i) => [i ? h('span', { class: 'slashes__sep', 'aria-hidden': 'true' }, '/') : null, h('span', null, t)]));
function figure(img, caption, cls = 'photo') {
  const portrait = img.h > img.w * 1.1;
  return h('figure', { class: `${cls}${portrait ? ` ${cls}--tall` : ''}` },
    h('img', { src: img.src, alt: img.alt, width: img.w, height: img.h, loading: 'lazy', decoding: 'async' }),
    caption ? h('figcaption', null, h('span', null, dotted(caption))) : null);
}
function links(arr) {
  if (!arr || !arr.length) return null;
  return h('p', { class: 'links' }, arr.map((l) => link(l.href, l.label, { class: 'btn' })));
}

function roleCard(r) {
  const out = [];
  out.push(h('p', { class: 'byline' }, dotted([r.org, r.place].join(' · '))));
  out.push(h('p', { class: 'when' }, h('span', null, r.dates), r.coords ? h('span', { class: 'coords' }, r.coords.label) : null));
  out.push(slashes(r.tags));
  if (r.photo) out.push(figure(r.photo, r.photo.caption));
  out.push(h('p', { class: 'lede' }, r.intro));
  if (r.callout) out.push(h('div', { class: 'callout' }, h('p', { class: 'callout__t' }, r.callout.title), h('p', null, r.callout.text)));
  if (r.awards && r.awards.length) {
    out.push(h('ul', { class: 'awards', 'aria-label': 'Recognition' }, r.awards.map((a) => h('li', null, icon('medal', 'i awards__i'), h('span', null, a)))));
  }
  for (const g of r.groups) out.push(sec(g.heading, list(g.points)));
  if (r.serviceTimeline) {
    out.push(sec('Service timeline', h('ol', { class: 'route' }, r.serviceTimeline.map((t) =>
      h('li', { class: 'route__stop' }, h('span', { class: 'route__when' }, t.when), h('span', { class: 'route__what' }, dotted(t.what)))))));
  }
  if (r.note) out.push(h('aside', { class: 'note' }, h('p', { class: 'note__h' }, r.note.heading), h('p', null, r.note.text)));
  if (r.tools && r.tools.length) out.push(sec('Tools', slashes(r.tools)));
  return out;
}

// Dot plot on a "route line": three stations on one score axis.
function takChart(T) {
  const H = T.headline;
  const source = Math.round((H.tak + H.gapToSource) * 100) / 100;
  const pts = [
    { key: 'base', name: H.baselineName, size: H.size, v: H.baseline },
    { key: 'tak', name: T.name, size: H.size, v: H.tak },
    { key: 'src', name: 'Original', size: H.sourceSize, v: source },
  ];
  const lo = Math.floor(Math.min(...pts.map((p) => p.v)) / 5) * 5;
  const hi = Math.ceil(Math.max(...pts.map((p) => p.v)) / 5) * 5;
  // Size the drawing to the space it gets, so its type renders at full size
  // on a phone sheet as well as in the desktop card.
  const W = Math.round(Math.min(420, Math.max(300, innerWidth - 62))), X0 = 22, X1 = W - 22, Y = 74;
  const x = (v) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
  const svg = s('svg', { viewBox: `0 0 ${W} 152`, class: 'chart__svg', role: 'img', 'aria-labelledby': 'tak-chart-cap' });
  // axis ticks
  for (let v = lo; v <= hi; v += 2.5) {
    const major = v % 5 === 0;
    svg.append(s('line', { x1: x(v), x2: x(v), y1: Y + 14, y2: Y + (major ? 22 : 18), class: 'chart__tick' }));
    if (major) svg.append(s('text', { x: x(v), y: Y + 36, class: 'chart__axis', 'text-anchor': 'middle' }, String(v)));
  }
  svg.append(s('line', { x1: X0, x2: X1, y1: Y, y2: Y, class: 'chart__route' }));
  // the gain: baseline -> TAK
  svg.append(s('line', { x1: x(H.baseline), x2: x(H.tak), y1: Y, y2: Y, class: 'chart__gain' }));
  svg.append(s('text', { x: (x(H.baseline) + x(H.tak)) / 2, y: Y - 11, class: 'chart__delta', 'text-anchor': 'middle' }, `+${H.delta.toFixed(2)}`));
  // gap to source
  svg.append(s('line', { x1: x(H.tak), x2: x(source), y1: Y, y2: Y, class: 'chart__gap' }));
  for (const p of pts) {
    const g = s('g', { class: `chart__pt chart__pt--${p.key}`, tabindex: '-1' },
      s('title', null, `${p.name}: ${p.v.toFixed(2)} (${p.size})`),
      s('circle', { cx: x(p.v), cy: Y, r: 14, class: 'chart__hit' }),
      s('circle', { cx: x(p.v), cy: Y, r: p.key === 'tak' ? 7.5 : 6, class: 'chart__dot' }));
    svg.append(g);
  }
  // Direct labels: value and file size, then the name. TAK and the baseline
  // sit below the line; the source model sits above it.
  const lab = (p, ax, ay, anchor, nameFirst) => {
    const t = s('text', { x: ax, y: ay, class: `chart__lab chart__lab--${p.key}`, 'text-anchor': anchor });
    const val = [s('tspan', { class: 'chart__v' }, p.v.toFixed(2)), s('tspan', { dx: 6, class: 'chart__sz' }, p.size)];
    const name = s('tspan', { class: 'chart__n2' }, p.name);
    if (nameFirst) { t.append(name, s('tspan', { x: ax, dy: 17 }, ...val)); }
    else { t.append(...val, s('tspan', { x: ax, dy: 16 }, name)); }
    svg.append(t);
  };
  lab(pts[0], x(pts[0].v), Y + 56, 'middle');
  lab(pts[1], x(pts[1].v) + 6, Y + 56, 'end');
  lab(pts[2], x(pts[2].v) + 6, Y - 48, 'end', true);
  svg.append(s('text', { x: (x(H.tak) + x(source)) / 2, y: Y + 31, class: 'chart__gapt', 'text-anchor': 'middle' }, H.gapToSource.toFixed(2)));
  const table = h('table', { class: 'sr-only' },
    h('caption', null, `${H.model} ${H.task} scores`),
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Model'), h('th', { scope: 'col' }, 'Score'), h('th', { scope: 'col' }, 'File size'))),
    h('tbody', null, pts.map((p) => h('tr', null, h('th', { scope: 'row' }, p.name), h('td', null, p.v.toFixed(2)), h('td', null, p.size)))));
  return h('figure', { class: 'chart' },
    svg,
    h('figcaption', { id: 'tak-chart-cap', class: 'chart__cap' },
      `${H.model} ${H.task} score. The scale runs from ${lo} to ${hi}.`),
    table);
}

// Keeps tokens such as "UD-IQ2_M" from breaking at the hyphen.
const nobr = (str) => String(str).split(/(\S+-\S+)/).map((t, i) => (i % 2 ? h('span', { class: 'nobr' }, t) : t));
const benchHead = (b) => h('p', { class: 'bench__model' },
  h('span', { class: 'bench__name' }, b.model),
  h('span', { class: 'bench__task' }, h('span', { class: 'sr-only' }, ', '), b.task));

function takCard(T) {
  const [first, ...rest] = T.benchmarks;
  return [
    h('p', { class: 'byline' }, dotted(T.tag)),
    h('p', { class: 'when' }, h('span', null, `Started ${monthYear(T.started)}`)),
    h('p', { class: 'lede' }, T.description),
    h('section', { class: 'bench bench--hero', 'aria-label': `${first.model} ${first.task}` },
      benchHead(first),
      h('p', { class: 'bench__value' }, first.value),
      takChart(T),
      h('p', { class: 'bench__text' }, nobr(first.text))),
    h('div', { class: 'bench-pair' }, rest.map((b) => h('section', { class: 'bench', 'aria-label': `${b.model} ${b.task}` },
      benchHead(b),
      h('p', { class: 'bench__value' }, b.value),
      h('p', { class: 'bench__text' }, nobr(b.text))))),
    sec('Inside TAK', list(T.points)),
    sec('Stack', slashes(T.stack)),
    links(T.links),
    h('p', { class: 'private' }, icon('lock', 'i'), T.note),
  ];
}

function featuredCard(p) {
  return [
    h('p', { class: 'byline' }, dotted(p.tag)),
    h('p', { class: 'when' }, h('span', null, `Started ${monthYear(p.started)}`)),
    p.image ? figure(p.image, null, 'shot') : null,
    h('p', { class: 'lede' }, p.description),
    p.detail ? h('p', { class: 'para' }, p.detail) : null,
    links(p.links),
    p.note ? h('p', { class: 'private' }, icon('lock', 'i'), p.note) : null,
  ];
}

function districtCard(S, places, go) {
  const byId = Object.fromEntries(places.map((p) => [p.id, p]));
  const timeline = h('ol', { class: 'route route--wide' }, S.projectTimeline.map((id) => {
    const pr = S.project(id);
    const pl = byId[id];
    return h('li', { class: 'route__stop', style: { '--c': DISTRICTS[pl.district].color } },
      h('span', { class: 'route__when' }, monthYear(pr.started)),
      h('a', { class: 'route__what route__go', href: `#${id}`, 'data-go': id }, pr.name));
  }));
  const items = S.allProjects.map((pr) => {
    const pl = byId[pr.id];
    return h('li', { class: 'proj' },
      h('p', { class: 'proj__head' }, bullet(pl.district, 'bullet bullet--sm'),
        h('a', { class: 'proj__name', href: `#${pr.id}`, 'data-go': pr.id }, pr.name),
        h('span', { class: 'proj__tag' }, dotted(pr.tag))),
      h('p', { class: 'proj__desc' }, pr.description),
      h('p', { class: 'proj__where' }, dotted(`${pl.building} · ${DISTRICTS[pl.district].name}`)));
  });
  return [
    h('p', { class: 'byline' }, dotted(`${S.allProjects.length} projects · ${DISTRICTS.tech.name} and ${DISTRICTS.coast.name}`)),
    sec('In the order they started', timeline),
    h('ul', { class: 'projs' }, items),
  ];
}

function educationCard(E) {
  return [
    h('p', { class: 'byline' }, E.school),
    h('p', { class: 'when' }, h('span', null, dotted(E.details.join(' · ')))),
    h('p', { class: 'lede' }, E.status),
    sec('Certifications', h('ul', { class: 'certs' }, E.certs.map((c) => h('li', null, h('span', { class: 'certs__n' }, c.name), h('span', { class: 'certs__d' }, c.date))))),
    sec('Coursework', list(E.coursework, 'ticks ticks--cols')),
    sec('Skills', slashes(E.skills)),
  ];
}

function bookCard(B, S) {
  return [
    h('p', { class: 'byline' }, B.subtitle),
    h('p', { class: 'when' }, h('span', null, dotted(B.formats.join(' · ')))),
    h('div', { class: 'book' },
      figure(B.cover, null, 'cover'),
      h('div', null, h('p', { class: 'lede' }, B.text), h('p', { class: 'links' }, link(B.href, `${B.title} on Amazon`, { class: 'btn btn--solid' })))),
  ];
}

function contactCard(S) {
  const L = S.links;
  const row = (href, label, value, opts = {}) => {
    const external = ext(href);
    return h('li', null, h('a', {
      class: 'mail', href, download: opts.download ? '' : null,
      target: external ? '_blank' : null, rel: external ? 'noopener' : null,
    }, icon(opts.ico || 'out', 'i mail__i'), h('span', { class: 'mail__l' }, label), h('span', { class: 'mail__v' }, value)));
  };
  return [
    h('p', { class: 'byline' }, S.location),
    h('p', { class: 'lede' }, dotted(S.status)),
    h('ul', { class: 'mailbox' },
      row(L.resume.href, L.resume.label, 'PDF', { download: true, ico: 'download' }),
      row(L.email.href, L.email.label, L.email.address, { ico: 'mail' }),
      row(L.linkedin.href, L.linkedin.label, L.linkedin.handle),
      row(L.github.href, L.github.label, L.github.handle),
      row(L.huggingface.href, L.huggingface.label, L.huggingface.handle)),
    h('p', { class: 'foot' }, dotted(S.footer)),
  ];
}

// Card body for one place. `titleId` lets the fallback page reuse it.
export function renderPlaceBody(S, p, places, titleId) {
  const d = DISTRICTS[p.district];
  let title, body;
  switch (p.kind) {
    case 'role': title = p.data.title; body = roleCard(p.data); break;
    case 'tak': title = p.data.title; body = takCard(p.data); break;
    case 'featured': case 'kiosk': title = p.data.name; body = featuredCard(p.data); break;
    case 'district': title = p.title; body = districtCard(S, places); break;
    case 'education': title = p.data.degree; body = educationCard(p.data); break;
    case 'book': title = p.data.title; body = bookCard(p.data, S); break;
    case 'contact': title = p.title; body = contactCard(S); break;
  }
  return {
    title,
    head: h('header', { class: 'card__head' },
      h('p', { class: 'card__where' }, bullet(p.district), h('span', { class: 'card__district' }, d.name), p.building !== d.name ? h('span', { class: 'card__bldg' }, p.building) : null),
      h('h2', { class: 'card__title', id: titleId, tabindex: '-1' }, nobr(title))),
    body: h('div', { class: 'card__body' }, body),
  };
}
