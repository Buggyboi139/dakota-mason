/* Watch Face redesign: renders every fact from window.SITE and connects the watch to the panels. */
(function () {
  'use strict';

  const S = window.SITE;
  const W = window.Watch;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const wideMQ = matchMedia('(min-width: 1260px)');
  const motion = () => !reduceMQ.matches;
  const PROJECTS = S.projectTimeline.map((id) => S.project(id)).filter(Boolean); // the roller, in start order
  const FEATURED = new Set(S.featured.map((p) => p.id));
  const AI = S.localAI;
  const AI_IDS = new Set([S.tak.id, ...AI.projects.map((p) => p.id)]); // these live in the movement section

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(3)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const add = (el, ...kids) => { el.append(...kids.flat(3).filter((k) => k != null && k !== false)); return el; };
  const ext = (href) => (/^https?:/.test(href) ? { target: '_blank', rel: 'noopener' } : {});
  const ICONS = {
    down: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/></svg>',
    ext: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5h6.5V10M12.5 3.5 4 12"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  };
  const icon = (name) => h('span', { class: `ico ico-${name}`, html: ICONS[name] });
  const outLink = (l, cls = '') => h('a', { class: `out ${cls}`.trim(), href: l.href, ...ext(l.href) }, h('span', {}, l.label), /^https?:/.test(l.href) ? icon('ext') : null);
  const img = (p, cls, lazy = true) => h('img', { class: cls, src: p.src, width: p.w, height: p.h, alt: p.alt, loading: lazy ? 'lazy' : null, decoding: 'async' });

  /* ---------- security-print ornaments (generated, so no two are retyped) ---------- */

  function rosette(cls = 'rosette') {
    const rings = [[45, 4.4, 20], [33, 3.6, 15], [21.5, 2.8, 10]];
    let d = '';
    for (const [r0, amp, k] of rings) {
      for (let j = 0; j < 5; j++) {
        const ph = (j / 5) * Math.PI * 2;
        for (let i = 0; i <= 240; i++) {
          const t = (i / 240) * Math.PI * 2;
          const r = r0 + amp * Math.sin(k * t + ph);
          d += `${i ? 'L' : 'M'}${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`;
        }
      }
    }
    return h('span', { class: cls, 'aria-hidden': 'true', html: `<svg viewBox="-52 -52 104 104" focusable="false"><path d="${d}"/><circle r="12"/><circle r="49.5"/></svg>` });
  }
  function band() {
    const w = 640, ht = 24;
    let d = '';
    for (let j = 0; j < 6; j++) {
      const ph = (j / 6) * Math.PI * 2;
      for (let x = 0; x <= w; x += 2) {
        const y = ht / 2 + (ht / 2 - 1.5) * Math.sin((x / w) * Math.PI * 2 * 16 + ph) * (0.55 + 0.45 * Math.cos((x / w) * Math.PI * 2 * 2 + ph / 3));
        d += `${x ? 'L' : 'M'}${x} ${y.toFixed(2)}`;
      }
    }
    return h('span', { class: 'band', 'aria-hidden': 'true', html: `<svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" focusable="false"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>` });
  }

  /* ---------- masthead and stage copy ---------- */

  function renderMast() {
    const L = S.links;
    $('#mast').append(
      h('a', { class: 'mast-name', href: '#top' }, S.name),
      h('nav', { class: 'mast-nav', 'aria-label': 'Sections' },
        h('a', { href: '#record' }, 'Record'),
        h('a', { href: '#projects' }, 'Projects'),
        h('a', { href: `#${AI.id}` }, AI.title),
        h('a', { href: '#papers' }, 'Papers')),
      h('div', { class: 'mast-links' },
        h('a', { class: 'btn-resume', href: L.resume.href, download: '' }, icon('down'), h('span', {}, L.resume.label)),
        ['linkedin', 'github', 'huggingface'].map((k) => h('a', { href: L[k].href, ...ext(L[k].href) }, L[k].label)),
        h('a', { href: L.email.href }, L.email.label)));
  }

  function renderIntro() {
    $('#intro').append(
      h('p', { class: 'kicker' }, S.headline),
      h('h1', { class: 'name' }, h('span', {}, S.firstName), ' ', h('span', {}, S.lastName)),
      h('p', { class: 'tagline' }, S.tagline));
    $('#intro-b').append(
      h('p', { class: 'summary' }, S.summary),
      h('p', { class: 'status' }, h('span', { class: 'status-mark', 'aria-hidden': 'true' }), h('span', {}, S.status)),
      h('p', { class: 'focus' }, h('span', { class: 'focus-k' }, 'Focus'), ' ', S.focusAreas.join(' · ')));
  }

  function renderControls() {
    const row = (k, v) => h('div', {}, h('dt', {}, k), h('dd', {}, v));
    $('#controls').append(
      h('h2', { class: 'ctl-h', id: 'ctl-h' }, 'Reading the watch'),
      h('dl', { class: 'ctl' },
        row('Bezel', 'Turn it to open a service record.'),
        row('Roller', 'Roll it through the projects.'),
        row('Crown', 'Press it for lume.')));
  }

  function renderSpec() {
    $('#spec').append(
      h('h2', { class: 'spec-h', id: 'spec-h' }, 'Complications'),
      h('dl', { class: 'spec-list' }, S.stats.map((s) => h('div', { class: 'spec-row' },
        h('dt', {}, h('span', { class: 'spec-v' }, s.value), s.unit ? h('span', { class: 'spec-u' }, s.unit) : null),
        h('dd', {}, s.label)))));
  }

  function renderFlag() {
    const t = S.tak;
    const hl = t.headline;
    $('#flag').append(
      h('p', { class: 'flag-k' }, t.tag.split(' · ')[0]),
      h('h2', { class: 'flag-h', id: 'flag-h' }, h('span', { class: 'flag-name' }, t.name), h('span', { class: 'flag-sub' }, t.subtitle)),
      h('p', { class: 'flag-num' }, h('span', { class: 'flag-v' }, `+${hl.delta}`),
        h('span', { class: 'flag-m' }, `points over ${hl.baselineName} on ${hl.model} ${hl.task}, at ${hl.size}`)),
      h('a', { class: 'flag-go', href: `#${t.id}` }, h('span', {}, `Open ${t.name}`), icon('arrow')));
  }

  /* ---------- panel: service record ---------- */

  function roleArticle(r, i) {
    const tags = (r.tags || []).filter((t) => t !== r.org);
    const p = r.photo;
    return h('article', { class: 'rec', id: r.id, 'aria-labelledby': `${r.id}-t`, tabindex: '-1', hidden: true },
      h('header', { class: 'rec-head' },
        h('p', { class: 'rec-meta' }, h('span', {}, `Record ${ROMAN[i]} of ${ROMAN[S.roles.length - 1]}`), r.coords ? h('span', { class: 'rec-coords' }, r.coords.label) : null),
        h('h3', { class: 'rec-title', id: `${r.id}-t` }, r.title),
        h('p', { class: 'rec-org' }, r.org, h('span', { class: 'sep', 'aria-hidden': 'true' }, ' · '), r.place),
        h('p', { class: 'rec-dates' }, r.dates),
        tags.length ? h('p', { class: 'rec-tags' }, tags.join(' · ')) : null),
      h('p', { class: 'rec-intro' }, r.intro),
      p ? h('figure', { class: `rec-photo${p.wide ? ' wide' : ''}` }, img(p), h('figcaption', {}, p.caption)) : null,
      r.callout ? h('aside', { class: 'callout' }, rosette('rosette seal'), h('p', { class: 'callout-t' }, r.callout.title), h('p', {}, r.callout.text)) : null,
      r.groups.map((g) => h('section', { class: 'rec-group' }, g.heading ? h('h4', {}, g.heading) : null, h('ul', {}, g.points.map((pt) => h('li', {}, pt))))),
      r.note ? h('aside', { class: 'note' }, h('h4', {}, r.note.heading), h('p', {}, r.note.text)) : null,
      r.serviceTimeline ? h('section', { class: 'svc' }, h('h4', {}, 'Service timeline'),
        h('ol', {}, r.serviceTimeline.map((s) => h('li', {}, h('span', { class: 'svc-when' }, s.when), h('span', { class: 'svc-what' }, s.what))))) : null,
      (r.tools.length || r.awards.length) ? h('dl', { class: 'specs' },
        r.tools.length ? h('div', {}, h('dt', {}, 'Tools'), h('dd', {}, r.tools.join(' · '))) : null,
        r.awards.length ? h('div', {}, h('dt', {}, 'Recognition'), h('dd', {}, r.awards.join(' · '))) : null) : null,
      citeLinks(r.id));
  }

  // "Read the citation" links from a role to its certificates in the papers.
  function citeLinks(roleId) {
    const cites = S.citationsFor(roleId);
    if (!cites.length) return null;
    return h('ul', { class: 'cite-links' }, cites.map((c) => h('li', {},
      h('a', { class: 'cite-link', href: `#${c.id}` },
        rosette('rosette cite-seal'),
        h('span', { class: 'cite-txt' }, h('span', { class: 'cite-k' }, 'Read the citation'), h('span', { class: 'cite-a' }, c.award)),
        icon('arrow')))));
  }

  function roleIndex() {
    return h('nav', { class: 'index', 'aria-label': 'Roles, newest first' },
      h('ol', {}, S.roles.map((r, i) => h('li', {}, h('a', { class: 'ix', href: `#${r.id}`, 'data-role': r.id },
        h('span', { class: 'ix-n' }, ROMAN[i]), h('span', { class: 'ix-t' }, r.short), h('span', { class: 'ix-dots', 'aria-hidden': 'true' }), h('span', { class: 'ix-d' }, r.years))))));
  }

  /* ---------- panel: projects ---------- */

  function benchmarks(t) {
    return h('section', { class: 'bench', 'aria-labelledby': 'bench-h' },
      h('h4', { id: 'bench-h' }, 'Benchmarks'),
      h('ol', {}, t.benchmarks.map((b, k) => h('li', { class: k === 0 ? 'lead' : null },
        h('p', { class: 'bench-what' }, h('span', {}, b.model), h('span', { class: 'bench-task' }, b.task)),
        h('p', { class: 'bench-val' }, b.value),
        h('p', { class: 'bench-text' }, b.text)))));
  }

  // The roller's catalog page for one project. Local AI projects get a short page that points
  // to their full entry in the movement section, which owns their ids for deep links.
  function projectArticle(p, i) {
    const flagship = p.id === S.tak.id;
    const ai = AI_IDS.has(p.id);
    const key = ai ? `cat-${p.id}` : p.id;
    const art = h('article', { class: `cat${flagship ? ' flagship' : ''}${FEATURED.has(p.id) ? ' featured' : ''}${ai ? ' ai' : ''}`, id: key, 'data-pid': p.id, 'aria-labelledby': `${key}-t`, tabindex: '-1', hidden: true },
      h('p', { class: 'cat-meta' }, h('span', {}, `No. ${i + 1} of ${PROJECTS.length}`), h('span', {}, `Started ${W.monthLong(p.started)}`)),
      h('h3', { class: 'cat-name', id: `${key}-t` }, p.name),
      flagship ? h('p', { class: 'cat-sub' }, p.subtitle) : null,
      h('p', { class: 'cat-tag' }, p.tag));
    const toMovement = () => h('a', { class: 'cat-go', href: `#${p.id}` },
      h('span', {}, flagship ? `The full calibre in ${AI.title}` : `Full entry in ${AI.title}`), icon('arrow'));
    if (flagship) {
      add(art,
        h('p', { class: 'cat-hl' }, h('span', { class: 'cat-hl-v' }, `+${p.headline.delta}`), h('span', { class: 'cat-hl-u' }, 'points')),
        h('p', { class: 'cat-desc' }, p.headline.text),
        toMovement());
    } else if (ai) {
      add(art, h('p', { class: 'cat-desc' }, p.description), toMovement());
    } else if (FEATURED.has(p.id)) {
      add(art,
        h('figure', { class: 'cat-fig' }, img(p.image)),
        h('p', { class: 'cat-desc' }, p.description),
        h('p', { class: 'cat-detail' }, p.detail),
        h('p', { class: 'cat-links' }, p.links.map((l) => outLink(l))));
    } else {
      add(art,
        h('p', { class: 'cat-desc' }, p.description),
        p.links.length ? h('p', { class: 'cat-links' }, p.links.map((l) => outLink(l))) : null,
        p.note ? h('p', { class: 'cat-private' }, icon('lock'), h('span', {}, p.note)) : null);
    }
    return art;
  }

  function projectIndex() {
    return h('nav', { class: 'index', 'aria-label': 'Projects, in the order they started' },
      h('ol', {}, PROJECTS.map((p, i) => h('li', {}, h('a', { class: `ix${p.id === S.tak.id ? ' ix-flag' : ''}`, href: `#${p.id}`, 'data-project': p.id },
        h('span', { class: 'ix-n' }, String(i + 1)), h('span', { class: 'ix-t' }, p.name), h('span', { class: 'ix-dots', 'aria-hidden': 'true' }), h('span', { class: 'ix-d' }, W.monthShort(p.started)))))));
  }

  function renderPanel() {
    const tab = (id, label, n, on) => h('button', { class: 'tab', type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': id, 'aria-selected': String(on), tabindex: on ? null : '-1' },
      h('span', {}, label), h('span', { class: 'tab-n' }, String(n)));
    $('#panel').append(
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Record and projects' },
        tab('record', 'Service record', S.roles.length, true),
        tab('projects', 'Projects', PROJECTS.length, false)),
      h('section', { class: 'tabpanel', id: 'record', role: 'tabpanel', 'aria-labelledby': 'tab-record' },
        h('h2', { class: 'sr-only' }, 'Service record'),
        h('p', { class: 'index-k' }, 'Turn the bezel, or choose a record'),
        roleIndex(),
        S.roles.map((r, i) => roleArticle(r, i))),
      h('section', { class: 'tabpanel', id: 'projects', role: 'tabpanel', 'aria-labelledby': 'tab-projects', hidden: true },
        h('h2', { class: 'sr-only' }, 'Projects'),
        h('p', { class: 'index-k' }, 'Roll the roller, or choose a project'),
        projectIndex(),
        PROJECTS.map((p, i) => projectArticle(p, i))));
  }

  /* ---------- the movement: Local AI, seen through the caseback ---------- */

  // The gear train behind TAK: one wheel per step of takHow, meshing left to right.
  const TRAIN = (() => {
    const radii = [60, 44, 54, 39, 49];
    const turns = [-31, 27, -34, 30];
    const pts = [[-152, 46]];
    for (let i = 1; i < radii.length; i++) {
      const d = (radii[i - 1] + radii[i]) * 0.94, a = (turns[i - 1] * Math.PI) / 180;
      const [x, y] = pts[i - 1];
      pts.push([x + d * Math.cos(a), y + d * Math.sin(a)]);
    }
    return radii.map((r, i) => ({ r, x: pts[i][0], y: pts[i][1], teeth: Math.round(r * 0.95) }));
  })();
  const f2 = (v) => v.toFixed(2);

  function gearMarkup(r, teeth, spokes) {
    const ro = r + 3.4, ri = r - 3.8, st = (Math.PI * 2) / teeth;
    const P = (a, rr) => `${f2(rr * Math.cos(a))} ${f2(rr * Math.sin(a))}`;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a = i * st;
      d += `${i ? 'L' : 'M'}${P(a, ri)}L${P(a + st * 0.17, ro)}L${P(a + st * 0.47, ro)}L${P(a + st * 0.64, ri)}`;
    }
    const rim = r * 0.74;
    d += `ZM${f2(rim)} 0A${f2(rim)} ${f2(rim)} 0 1 0 ${f2(-rim)} 0A${f2(rim)} ${f2(rim)} 0 1 0 ${f2(rim)} 0Z`;
    let arms = '';
    for (let k = 0; k < spokes; k++) arms += `<path d="M-2.4 0L-1.6 ${f2(-rim - 1)}L1.6 ${f2(-rim - 1)}L2.4 0Z" transform="rotate(${f2((k * 360) / spokes)})"/>`;
    return `<path d="${d}" fill-rule="evenodd"/>${arms}<circle r="${f2(r * 0.22)}"/>`;
  }
  function pinion(r, leaves) {
    const st = (Math.PI * 2) / leaves;
    let d = '';
    for (let i = 0; i < leaves; i++) {
      const a = i * st, P = (b, rr) => `${f2(rr * Math.cos(b))} ${f2(rr * Math.sin(b))}`;
      d += `${i ? 'L' : 'M'}${P(a, r * 0.7)}L${P(a + st * 0.2, r)}L${P(a + st * 0.5, r)}L${P(a + st * 0.7, r * 0.7)}`;
    }
    return `<path class="mv-pinion" d="${d}Z"/>`;
  }
  const jewel = (x, y, s = 1) => `<g transform="translate(${f2(x)} ${f2(y)}) scale(${s})"><circle r="7.2" class="mv-chaton"/><circle r="4.6" fill="url(#mvRuby)"/><circle cx="-1.5" cy="-1.6" r="1.2" fill="#fff" opacity=".75"/></g>`;
  const screw = (x, y, a) => `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${a})"><circle r="6.4" fill="url(#mvBlue)" stroke="#0a1430" stroke-width=".8"/><rect x="-5.4" y="-.9" width="10.8" height="1.8" rx=".6" fill="#06102a"/><circle cx="-2" cy="-2.4" r="1.6" fill="#9db7ff" opacity=".35"/></g>`;

  function movementSVG(t, steps) {
    const ringText = `${t.title} · ${t.stack.join(' · ')}`;
    const trainText = steps.map((s) => s.step).join(' · ');
    const wheels = TRAIN.map((w, i) => `<g transform="translate(${f2(w.x)} ${f2(w.y)})"><g class="mv-w" data-w="${i}">
        <g class="mv-gold">${gearMarkup(w.r, w.teeth, i % 2 ? 4 : 5)}</g>${pinion(w.r * 0.2, 8)}</g></g>`).join('');
    const bridgePath = TRAIN.map((w, i) => `${i ? 'L' : 'M'}${f2(w.x)} ${f2(w.y)}`).join('');
    const jewels = TRAIN.map((w) => jewel(w.x, w.y)).join('');
    const nums = TRAIN.map((w, i) => {
      const up = i % 2 === 1;
      const ny = w.y + (up ? -(w.r + 17) : w.r + 25);
      return `<text class="mv-num" x="${f2(w.x)}" y="${f2(ny)}">${i + 1}</text>`;
    }).join('');
    const first = TRAIN[0], last = TRAIN[TRAIN.length - 1];
    // Balance wheel under its cock, top right.
    const bx = 62, by = -158, br = 46;
    let spiral = '';
    for (let k = 0; k <= 220; k++) {
      const a = (k / 220) * Math.PI * 2 * 6.5, rr = 4 + (k / 220) * 26;
      spiral += `${k ? 'L' : 'M'}${f2(rr * Math.cos(a))} ${f2(rr * Math.sin(a))}`;
    }
    return `<svg class="mv-svg" viewBox="-310 -310 620 620" focusable="false">
      <defs>
        <radialGradient id="mvRing" cx="50%" cy="50%" r="50%"><stop offset=".84" stop-color="#5b6168"/><stop offset=".9" stop-color="#d9dde1"/><stop offset=".95" stop-color="#9aa1a8"/><stop offset="1" stop-color="#40454b"/></radialGradient>
        <linearGradient id="mvRingSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
        <radialGradient id="mvPerlG" cx="38%" cy="38%" r="62%"><stop offset="0" stop-color="#eef1f3"/><stop offset=".55" stop-color="#c3c9cf"/><stop offset="1" stop-color="#9aa2aa"/></radialGradient>
        <pattern id="mvPerl" width="17" height="15" patternUnits="userSpaceOnUse"><rect width="17" height="15" fill="#a9b0b7"/><circle cx="8.5" cy="7.5" r="8.4" fill="url(#mvPerlG)"/><circle cx="0" cy="0" r="8.4" fill="url(#mvPerlG)" opacity=".8"/><circle cx="17" cy="0" r="8.4" fill="url(#mvPerlG)" opacity=".8"/><circle cx="0" cy="15" r="8.4" fill="url(#mvPerlG)" opacity=".8"/><circle cx="17" cy="15" r="8.4" fill="url(#mvPerlG)" opacity=".8"/></pattern>
        <linearGradient id="mvCoteBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3e7ea"/><stop offset=".5" stop-color="#a7aeb5"/><stop offset="1" stop-color="#e3e7ea"/></linearGradient>
        <pattern id="mvCotes" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect width="13" height="13" fill="url(#mvCoteBand)"/></pattern>
        <linearGradient id="mvGoldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7ad"/><stop offset=".45" stop-color="#d5ab55"/><stop offset="1" stop-color="#8d6620"/></linearGradient>
        <radialGradient id="mvRuby" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ff6f8a"/><stop offset=".45" stop-color="#b3123b"/><stop offset="1" stop-color="#4d0616"/></radialGradient>
        <radialGradient id="mvBlue" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#5f86e6"/><stop offset=".55" stop-color="#20438f"/><stop offset="1" stop-color="#0b1a46"/></radialGradient>
        <radialGradient id="mvWell" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
        <linearGradient id="mvGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="mvWin"><circle r="262"/></clipPath>
        <path id="mvTop" d="M-281 0A281 281 0 1 1 281 0A281 281 0 1 1 -281 0"/>
        <path id="mvBot" d="M-289 0A289 289 0 0 0 289 0"/>
        <filter id="mvDrop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.2" dy="2.4" stdDeviation="2.2" flood-color="#000" flood-opacity=".45"/></filter>
      </defs>
      <circle r="304" fill="url(#mvRing)"/>
      <circle r="304" fill="url(#mvRingSheen)" opacity=".55"/>
      <circle r="300" fill="none" stroke="#2b3036" stroke-width="1.2"/>
      <text class="mv-engrave"><textPath href="#mvTop" startOffset="25%">${esc(ringText)}</textPath></text>
      <text class="mv-engrave"><textPath href="#mvBot" startOffset="50%">${esc(trainText)}</textPath></text>
      <circle r="266" fill="#1c2026"/>
      <g clip-path="url(#mvWin)">
        <rect x="-270" y="-270" width="540" height="540" fill="url(#mvPerl)"/>
        <circle r="262" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10"/>
        <g filter="url(#mvDrop)">${wheels}</g>
        <g filter="url(#mvDrop)">
          <path d="${bridgePath}" fill="none" stroke="#5a6168" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${bridgePath}" fill="none" stroke="url(#mvCotes)" stroke-width="31" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${bridgePath}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -15.2)"/>
        </g>
        ${jewels}
        ${screw(first.x - 22, first.y + 12, 20)}${screw(last.x + 21, last.y - 13, -35)}
        ${nums}
        <g transform="translate(${bx} ${by})">
          <g class="mv-balance"><circle r="${br}" fill="none" stroke="url(#mvGoldG)" stroke-width="7"/>
            <circle r="${br + 3.5}" fill="none" stroke="#7d5a1b" stroke-width=".8"/>
            ${[0, 120, 240].map((a) => `<rect x="-1.8" y="${-br}" width="3.6" height="${br}" fill="url(#mvGoldG)" transform="rotate(${a})"/>`).join('')}
            ${[30, 90, 150, 210, 270, 330].map((a) => `<circle cx="0" cy="${-br}" r="2.6" fill="#e9cf8a" stroke="#7d5a1b" stroke-width=".5" transform="rotate(${a})"/>`).join('')}
          </g>
          <path d="${spiral}" fill="none" stroke="#3f63b8" stroke-width="1.1" opacity=".9"/>
        </g>
        <g filter="url(#mvDrop)">
          <path d="M${bx - 8} ${by - 14}L${bx + 150} ${by - 72}A26 26 0 0 1 ${bx + 168} ${by - 24}L${bx + 10} ${by + 16}A16 16 0 0 1 ${bx - 8} ${by - 14}Z" fill="url(#mvCotes)" stroke="#5a6168" stroke-width="2"/>
        </g>
        ${jewel(bx, by, 1.1)}${screw(bx + 152, by - 46, 40)}
        <circle r="262" fill="url(#mvWell)"/>
        <path d="M-250 -60A258 258 0 0 1 60 -250L40 -205A212 212 0 0 0 -205 -40Z" fill="url(#mvGlass)" opacity=".7"/>
      </g>
      <circle r="262.5" fill="none" stroke="#0d1014" stroke-width="2.5"/>
    </svg>`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderMovement() {
    const t = S.tak, hl = t.headline;
    const listOf = (items, cls) => h('ul', { class: cls }, items.map((x) => h('li', {}, x)));
    const fig = h('figure', { class: 'caseback', 'aria-hidden': 'true', html: movementSVG(t, AI.takHow) });

    const calibre = h('article', { class: 'calibre', id: t.id, 'aria-labelledby': `${t.id}-t`, tabindex: '-1' },
      h('div', { class: 'cal-top' },
        fig,
        h('div', { class: 'cal-sheet' },
          h('p', { class: 'cal-k' }, 'Calibre'),
          h('h3', { class: 'cal-name', id: `${t.id}-t` }, t.name),
          h('p', { class: 'cal-sub' }, t.subtitle),
          h('p', { class: 'cal-tag' }, t.tag),
          h('p', { class: 'cal-desc' }, t.description),
          h('div', { class: 'cal-hl' },
            h('p', { class: 'cal-hl-v' }, `+${hl.delta}`),
            h('p', { class: 'cal-hl-t' }, hl.text)),
          h('a', { class: 'cal-hf', href: AI.huggingface.href, ...ext(AI.huggingface.href) },
            h('span', { class: 'cal-hf-n' }, String(AI.huggingface.models)),
            h('span', { class: 'cal-hf-l' }, AI.huggingface.label), icon('ext')))),
      h('section', { class: 'train', 'aria-labelledby': 'train-h' },
        h('h4', { class: 'mv-h4', id: 'train-h' }, 'Gear train'),
        h('ol', {}, AI.takHow.map((s, i) => h('li', { 'data-w': String(i) },
          h('span', { class: 'train-n', 'aria-hidden': 'true', html: `<svg viewBox="-25 -25 50 50" focusable="false"><g class="mv-gold">${gearMarkup(19.5, 16, 0)}</g><circle r="12.5" class="train-hub"/><text y="5.6" class="train-num">${i + 1}</text></svg>` }),
          h('span', { class: 'train-s' }, s.step),
          h('span', { class: 'train-t' }, s.text))))),
      h('div', { class: 'cal-grid' },
        benchmarks(t),
        h('div', { class: 'cal-notes' },
          h('section', {}, h('h4', { class: 'mv-h4' }, 'Specifications'), listOf(t.points, 'mv-list')),
          h('section', {}, h('h4', { class: 'mv-h4' }, 'Also in the calibre'), listOf(AI.takExtras, 'mv-list')))),
      h('div', { class: 'cal-foot' },
        h('p', { class: 'cal-lineage' }, h('span', { class: 'mv-k' }, 'Lineage'), AI.lineage),
        h('dl', { class: 'mv-specs' }, h('div', {}, h('dt', {}, 'Stack'), h('dd', {}, t.stack.join(' · ')))),
        h('p', { class: 'mv-links' }, t.links.map((l) => outLink(l)), h('span', { class: 'mv-private' }, icon('lock'), h('span', {}, t.note)))));

    const entry = (p, size) => h('article', { class: `mv-entry ${size}`, id: p.id, 'aria-labelledby': `${p.id}-t`, tabindex: '-1' },
      h('header', { class: 'mv-entry-head' },
        h('span', { class: 'mv-jewel', 'aria-hidden': 'true' }),
        h('h3', { id: `${p.id}-t` }, p.name),
        h('p', { class: 'mv-meta' }, h('span', {}, p.tag), h('span', {}, `Started ${W.monthLong(p.started)}`))),
      h('p', { class: 'mv-desc' }, p.description),
      p.workflow ? h('ol', { class: 'mv-flow', 'aria-label': `${p.name} workflow` }, p.workflow.map((w, i) => h('li', {}, h('span', { class: 'mv-flow-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, w)))) : null,
      p.points && p.points.length ? listOf(p.points, 'mv-list') : null,
      (p.links.length || p.note) ? h('p', { class: 'mv-links' }, p.links.map((l) => outLink(l)), p.note ? h('span', { class: 'mv-private' }, icon('lock'), h('span', {}, p.note)) : null) : null);

    $(`#${AI.id}`).append(
      h('header', { class: 'mv-head' },
        h('p', { class: 'kicker' }, 'Through the caseback'),
        h('h2', { id: `${AI.id}-h` }, AI.title),
        h('p', { class: 'mv-kicker' }, AI.kicker),
        h('p', { class: 'mv-intro' }, AI.intro)),
      calibre,
      h('div', { class: 'mv-major' }, AI.projects.slice(0, 2).map((p) => entry(p, 'major'))),
      h('div', { class: 'mv-minor' }, AI.projects.slice(2).map((p) => entry(p, 'minor'))));
  }

  // Turn the gear train while the movement is on screen. Each wheel meshes with the next,
  // so its speed scales with the ratio of radii and its direction alternates.
  function runMovement() {
    const svg = $('.mv-svg');
    if (!svg) return;
    const wheels = $$('.mv-w', svg).map((g) => ({ g, k: TRAIN[0].r / TRAIN[+g.dataset.w].r * (+g.dataset.w % 2 ? -1 : 1) }));
    const balance = $('.mv-balance', svg);
    let raf = 0, visible = false;
    const frame = (now) => {
      const t = now / 1000;
      const base = (t * 9) % 360; // degrees for the first wheel
      for (const w of wheels) w.g.setAttribute('transform', `rotate(${(base * w.k).toFixed(2)})`);
      balance.setAttribute('transform', `rotate(${(150 * Math.sin(t * 4.2)).toFixed(2)})`);
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      const run = visible && motion() && !document.hidden;
      if (run && !raf) raf = requestAnimationFrame(frame);
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }).observe(svg);
    document.addEventListener('visibilitychange', sync);
    reduceMQ.addEventListener('change', sync);
    // Point at a step and its wheel lights up.
    $$('.train li').forEach((li) => {
      const g = $(`.mv-w[data-w="${li.dataset.w}"]`, svg);
      li.addEventListener('pointerenter', () => g.classList.add('hot'));
      li.addEventListener('pointerleave', () => g.classList.remove('hot'));
    });
  }

  /* ---------- papers ---------- */

  // Five stars drawn to the rating, the last one filled in part.
  function stars(value, outOf) {
    const sz = 17, gap = 3, n = Math.round(outOf), w = n * sz + (n - 1) * gap;
    const fill = Math.floor(value) * (sz + gap) + (value % 1) * sz;
    const star = (cx) => {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.6 : 8.4;
        d += `${i ? 'L' : 'M'}${f2(cx + r * Math.cos(a))} ${f2(9 + r * Math.sin(a))}`;
      }
      return d + 'Z';
    };
    const d = Array.from({ length: n }, (_, i) => star(i * (sz + gap) + sz / 2)).join('');
    return `<svg viewBox="0 0 ${w} 18" width="${w}" height="18" focusable="false"><defs><clipPath id="rate-fill"><rect width="${f2(fill)}" height="18"/></clipPath></defs><path class="st-off" d="${d}"/><path class="st-on" d="${d}" clip-path="url(#rate-fill)"/></svg>`;
  }

  function renderPapers() {
    const E = S.education;
    const B = S.book;
    const L = S.links;
    const field = (k, v) => h('div', { class: 'field' }, h('dt', {}, k), h('dd', {}, v));
    const guarantee = h('article', { class: 'paper guarantee', id: 'education', 'aria-labelledby': 'edu-h', tabindex: '-1' },
      band(),
      h('header', { class: 'paper-head' },
        h('div', {}, h('p', { class: 'paper-k' }, 'Guarantee card'), h('h3', { id: 'edu-h' }, 'Education')),
        rosette('rosette paper-seal')),
      h('dl', { class: 'fields' },
        field('Holder', S.name),
        field('Degree', E.degree),
        field('Institution', E.school),
        field('Details', E.details.join(' · ')),
        field('Status', E.status)),
      h('div', { class: 'certs' }, h('h4', {}, 'Certifications'),
        h('ul', {}, E.certs.map((c) => h('li', {}, h('span', { class: 'cert-n' }, c.name), h('span', { class: 'cert-d' }, c.date))))),
      h('div', { class: 'cols' },
        h('section', {}, h('h4', {}, 'Coursework'), h('ul', { class: 'plain' }, E.coursework.map((c) => h('li', {}, c)))),
        h('section', {}, h('h4', {}, 'Skills'), h('ul', { class: 'plain' }, E.skills.map((s) => h('li', {}, s))))));

    const handle = (k, v) => h('li', {}, h('a', { href: L[k].href, ...ext(L[k].href) }, h('span', { class: 'cl-k' }, L[k].label), h('span', { class: 'cl-v' }, v)));
    const contact = h('article', { class: 'paper contact', id: 'contact', 'aria-labelledby': 'contact-h', tabindex: '-1' },
      h('div', { class: 'contact-top' },
        img(S.avatar, 'contact-photo'),
        h('div', {}, h('p', { class: 'paper-k' }, 'Contact'), h('h3', { id: 'contact-h' }, S.name), h('p', { class: 'contact-sub' }, `${S.headline} · ${S.location}`))),
      h('p', { class: 'contact-status' }, S.status),
      h('a', { class: 'btn-ink', href: L.resume.href, download: '' }, icon('down'), h('span', {}, L.resume.label)),
      h('ul', { class: 'contact-list' },
        handle('email', L.email.address),
        handle('linkedin', L.linkedin.handle),
        handle('github', L.github.handle),
        handle('huggingface', L.huggingface.handle)));

    const history = h('article', { class: 'paper history', id: 'history', 'aria-labelledby': 'hist-h' },
      h('header', { class: 'paper-head' }, h('div', {}, h('p', { class: 'paper-k' }, 'Service history'), h('h3', { id: 'hist-h' }, 'Milestones'))),
      h('ol', { class: 'stamps' }, S.milestones.map((m) => h('li', {}, h('a', { href: `#${m.ref}` },
        h('span', { class: 'stamp-d' }, W.monthShort(m.date)), h('span', { class: 'stamp-l' }, m.label))))));

    const manual = h('article', { class: 'paper manual', id: 'book', 'aria-labelledby': 'book-h', tabindex: '-1' },
      h('figure', { class: 'manual-cover' }, img(B.cover)),
      h('div', { class: 'manual-body' },
        h('p', { class: 'paper-k' }, 'The book'),
        h('h3', { id: 'book-h' }, B.title),
        h('p', { class: 'manual-sub' }, B.subtitle),
        h('p', { class: 'manual-formats' }, B.formats.join(' · ')),
        B.rating ? h('p', { class: 'manual-rating' }, h('span', { class: 'stars', 'aria-hidden': 'true', html: stars(B.rating.stars, B.rating.outOf) }), h('span', {}, B.rating.label)) : null,
        B.published ? h('p', { class: 'manual-pub' }, h('span', { class: 'manual-pub-k' }, 'Published'), ' ', B.published) : null,
        h('p', {}, B.text),
        h('a', { class: 'btn-ink', href: B.href, ...ext(B.href) }, h('span', {}, 'View on Amazon'), icon('ext'))));

    // Awards: the ribbons as a list in a medal box, then each citation as a certificate.
    const A = S.awards;
    const medalbox = h('div', { class: 'medalbox' },
      h('header', { class: 'mb-head' },
        h('p', { class: 'paper-k' }, 'Medal box'),
        h('h3', { id: 'awards-h' }, 'Awards'),
        h('p', { class: 'mb-sub' }, 'Ribbons in order of precedence')),
      h('ol', { class: 'ribbons', style: `--rows:${Math.ceil(A.ribbons.length / 2)}` }, A.ribbons.map((r) => h('li', {},
        h('span', { class: 'rib', 'aria-hidden': 'true', html: RIBBONS.ribbon(r.id, { device: r.device, title: r.name, width: 120 }) }),
        h('span', { class: 'rib-txt' }, h('span', { class: 'rib-n' }, r.name), r.note ? h('span', { class: 'rib-note' }, r.note) : null)))));
    const cert = (c) => {
      const role = S.role(c.ref);
      return h('article', { class: 'paper cert', id: c.id, 'aria-labelledby': `${c.id}-t`, tabindex: '-1' },
        h('header', { class: 'cert-head' },
          rosette('rosette cert-seal'),
          h('p', { class: 'paper-k' }, 'Citation'),
          h('h3', { id: `${c.id}-t` }, c.award),
          c.awardNote ? h('p', { class: 'cert-note' }, c.awardNote) : null,
          c.from ? h('p', { class: 'cert-from' }, h('span', { class: 'cert-from-k' }, 'From'), ' ', c.from) : null),
        h('dl', { class: 'fields cert-fields' }, field('Recipient', c.recipient), field('Billet', c.billet), field('Period', c.period)),
        c.opening ? h('p', { class: 'cert-open' }, c.opening) : null,
        h('p', { class: 'cert-text' }, c.text),
        h('footer', { class: 'cert-foot' },
          c.given ? h('p', { class: 'cert-given' }, h('span', { class: 'cert-given-k' }, 'Given'), ' ', c.given) : null,
          h('p', { class: 'cert-sig' }, h('span', { class: 'cert-line', 'aria-hidden': 'true' }),
            c.signer.map((x, i) => h('span', { class: i ? 'cert-sig-t' : 'cert-sig-n' }, x)))),
        role ? h('a', { class: 'cert-role', href: `#${role.id}` }, h('span', {}, `From the record: ${role.short}`), icon('arrow')) : null);
    };
    const awards = h('section', { class: 'awards', id: 'awards', 'aria-labelledby': 'awards-h' },
      medalbox,
      h('div', { class: 'cert-row' }, A.citations.map(cert)));

    $('#papers').append(
      h('header', { class: 'papers-head' },
        h('p', { class: 'kicker' }, 'In the box'),
        h('h2', { id: 'papers-h' }, 'The papers'),
        h('p', {}, 'Education, how to reach me, the book, the service history, and the awards.')),
      h('div', { class: 'papers-grid' },
        h('div', { class: 'pcol' }, guarantee),
        h('div', { class: 'pcol' }, contact, manual),
        history,
        awards));
    $('#foot').append(h('p', {}, S.footer), h('a', { href: '#top' }, 'Back to the watch'));
  }

  /* ---------- state ---------- */

  const state = { role: S.roles[0].id, project: S.tak.id, tab: 'record' };

  function showTab(name, { focus = false } = {}) {
    state.tab = name;
    $$('.tab').forEach((t) => {
      const on = t.getAttribute('aria-controls') === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.tabpanel').forEach((p) => { p.hidden = p.id !== name; });
  }

  function reveal(art) {
    if (motion()) art.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
  function scrollToEl(el, smooth = true) {
    el.scrollIntoView({ behavior: smooth && motion() ? 'smooth' : 'auto', block: 'start' });
  }
  // On the wide layout the panel sits beside the watch: bring the record into view only when it has scrolled away.
  function keepInView(el) {
    if (!wideMQ.matches) return;
    const top = el.getBoundingClientRect().top;
    const limit = ($('#mast').offsetHeight || 0) + ($('.tabs').offsetHeight || 0);
    if (top < limit || top > innerHeight - 120) scrollToEl(el);
  }

  function showRole(id, { scroll = false, follow = false } = {}) {
    const changed = state.role !== id || state.tab !== 'record';
    state.role = id;
    showTab('record');
    let art = null;
    $$('.rec').forEach((a) => { a.hidden = a.id !== id; if (!a.hidden) art = a; });
    $$('[data-role]').forEach((a) => (a.dataset.role === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    const r = S.role(id);
    setReadout('role', r.short, r.years, id);
    if (art && changed) reveal(art);
    if (art && scroll) scrollToEl(art, !scroll.instant);
    else if (art && follow) keepInView(art);
  }

  function showProject(id, { scroll = false, follow = false } = {}) {
    const changed = state.project !== id || state.tab !== 'projects';
    state.project = id;
    showTab('projects');
    let art = null;
    $$('.cat').forEach((a) => { a.hidden = a.dataset.pid !== id; if (!a.hidden) art = a; });
    $$('[data-project]').forEach((a) => (a.dataset.project === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    const p = S.project(id);
    setReadout('project', p.name, W.monthShort(p.started), id);
    if (art && changed) reveal(art);
    if (art && scroll) scrollToEl(art, !scroll.instant);
    else if (art && follow) keepInView(art);
  }

  function setReadout(kind, v, d, id) {
    const a = $(`.ro-${kind}`);
    if (!a) return;
    a.href = `#${id}`;
    $('.ro-v', a).textContent = v;
    $('.ro-d', a).textContent = d;
  }

  const setHash = (id) => { try { history.replaceState(null, '', `#${id}`); } catch (e) { /* file:// or sandboxed */ } };

  /* ---------- the watch ---------- */

  let watch;
  let lumeTimer = 0;
  function mountWatch() {
    const host = $('#watch');
    watch = W.mount(host, {
      roles: S.roles,
      projects: PROJECTS,
      stats: S.stats,
      dialName: S.name.toUpperCase(),
      location: S.location,
      bezelLabel: 'Career bezel, 2015 to 2026. Use the arrow keys to turn it to a role.',
      rollerLabel: 'Project roller. Use the arrow keys to roll through the projects.',
      rollerHint: 'Roll for projects',
      crownLabel: 'Crown: lume mode',
      timeLabel: 'The watch shows your local time,',
      onRole(id) { showRole(id, { follow: true }); setHash(id); },
      onProject(id) { showProject(id, { follow: true }); setHash(id); },
      onUse(part) { document.body.classList.add(`used-${part}`); },
      onLume() {
        const root = document.documentElement;
        root.classList.add('lume-anim');
        clearTimeout(lumeTimer);
        lumeTimer = setTimeout(() => root.classList.remove('lume-anim'), 1000);
      },
    });
    $('#readout').append(
      h('a', { class: 'ro ro-role', href: '#research' }, h('span', { class: 'ro-k' }, 'Bezel'), h('span', { class: 'ro-v' }), h('span', { class: 'ro-d' }), icon('arrow')),
      h('a', { class: 'ro ro-project', href: '#tak' }, h('span', { class: 'ro-k' }, 'Roller'), h('span', { class: 'ro-v' }), h('span', { class: 'ro-d' }), icon('arrow')));
  }

  /* ---------- sizing: one unit of the watch drawing, in CSS pixels ---------- */

  function layout() {
    const stage = $('#stage');
    const vw = document.documentElement.clientWidth;
    let U, crop = 0;
    stage.classList.remove('tight', 'bare');
    stage.style.removeProperty('height');
    stage.style.removeProperty('top');
    if (wideMQ.matches) {
      const view = innerHeight - ($('#mast').offsetHeight || 0); // the stage's natural height
      const sw = stage.clientWidth;
      const col = Math.round(Math.min(300, Math.max(228, sw * 0.26)));
      const spec = Math.round(Math.min(248, Math.max(204, vw * 0.17)));
      stage.style.setProperty('--col', `${col}px`);
      stage.style.setProperty('--specw', `${spec}px`);
      const L = sw - 26 - spec; // left edge of the right-hand column
      const left = $('.left');
      const leftH = () => {
        const kids = [...left.children].filter((k) => k.offsetHeight);
        return kids.reduce((a, k) => a + k.offsetHeight, 0) + parseFloat(getComputedStyle(left).rowGap || 0) * (kids.length - 1) + 2 * left.offsetTop;
      };
      // Where the case centre can sit for a watch of size u in a stage h tall, or null if nowhere.
      // Extents in drawing units from the case centre: case and bezel 305 round, crown 248 to 322
      // right and 124 to 206 up, lugs 152 to 214 right and 260 to 334 up or down, roller 305 to 506
      // right and 97 up or down, with its hint ending 110 units plus a line below.
      const place = (u, h) => {
        if (770 * u + 30 > h) return null;
        const cy = h / 2, inset = stage.classList.contains('tight') ? 22 : 28;
        const sB = inset + $('#spec').offsetHeight + 12, fT = h - inset - $('#flag').offsetHeight - 12;
        let lo = col + 4 + 300 * u, hi = sw - 8 - 506 * u;
        if (sB > cy - 97 * u || fT < cy + 110 * u + 20) hi = Math.min(hi, L - 12 - 506 * u);
        if (sB > cy - 206 * u) hi = Math.min(hi, L - 334 * u);
        if (sB > cy - 334 * u || fT < cy + 334 * u) hi = Math.min(hi, L - 226 * u);
        const r = 305 * u + 8;
        if (cy - sB < r) hi = Math.min(hi, L - Math.sqrt(r * r - (cy - sB) ** 2));
        if (fT - cy < r) hi = Math.min(hi, L - Math.sqrt(r * r - (fT - cy) ** 2));
        return lo > hi ? null : Math.min(Math.max((col + sw - 26) / 2 - 103 * u, lo), hi);
      };
      const best = (h) => {
        if (place(1.02, h) !== null) return 1.02;
        let a = 0.3, b = 1.02;
        for (let k = 0; k < 16; k++) { const m = (a + b) / 2; if (place(m, h) !== null) a = m; else b = m; }
        return a;
      };
      let h = view;
      U = best(h);
      if (U < 0.74 || leftH() > h) { stage.classList.add('tight'); U = best(h); }
      if (leftH() > h) stage.classList.add('bare'); // drop the controls legend
      // Below this the roller's labels get too small to read. When a taller stage would fit a
      // readable watch, let the stage run past the window and stick by its bottom edge.
      const UMIN = 0.64;
      if (U < UMIN && best(h + 480) >= UMIN) {
        while (best(h) < UMIN) h += 8;
        U = best(h);
      }
      h = Math.max(h, Math.ceil(leftH()));
      if (h > view) {
        stage.style.height = `${h}px`;
        stage.style.top = `${innerHeight - h}px`;
      }
      const cx = place(U, h) ?? col + 4 + 300 * U;
      stage.style.setProperty('--cx', `${Math.round(cx)}px`);
    } else if (vw >= 640) {
      U = Math.min((vw - 48) / 860, 0.8);
      crop = 120;
      stage.style.removeProperty('--cx');
    } else {
      U = Math.min((vw - 16) / 650, 0.62);
      crop = 150;
      stage.style.removeProperty('--cx');
    }
    stage.style.setProperty('--U', `${U.toFixed(4)}px`);
    stage.style.setProperty('--crop', String(crop));
  }

  /* ---------- deep links ---------- */

  const ROLE_IDS = new Set(S.roles.map((r) => r.id));
  const PROJECT_IDS = new Set(PROJECTS.map((p) => p.id));

  function route(hash, { initial = false } = {}) {
    const id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    const instant = { instant: true };
    if (ROLE_IDS.has(id)) {
      watch.selectRole(id, { animate: !initial });
      showRole(id, { scroll: initial ? instant : true });
      return true;
    }
    if (PROJECT_IDS.has(id)) {
      watch.selectProject(id, { animate: !initial });
      if (AI_IDS.has(id)) { showProject(id); scrollToEl(document.getElementById(id), !initial); } // its entry in the movement
      else showProject(id, { scroll: initial ? instant : true });
      return true;
    }
    if (id === 'projects' || id === 'record') {
      if (id === 'projects') showProject(state.project); else showRole(state.role);
      scrollToEl($(`#${id}`), !initial);
      return true;
    }
    return false;
  }

  /* ---------- wiring ---------- */

  function wire() {
    // Tabs: click and arrow keys.
    $('.tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      const name = t.getAttribute('aria-controls');
      if (name === 'record') showRole(state.role); else showProject(state.project);
      setHash(name === 'record' ? state.role : state.project);
    });
    $('.tabs').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next = state.tab === 'record' ? 'projects' : 'record';
      const name = e.key === 'Home' ? 'record' : e.key === 'End' ? 'projects' : next;
      if (name === 'record') showRole(state.role); else showProject(state.project);
      showTab(name, { focus: true });
      setHash(name === 'record' ? state.role : state.project);
    });

    // In-page links to roles and projects turn the watch instead of jumping.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      if (ROLE_IDS.has(id) || PROJECT_IDS.has(id) || id === 'projects' || id === 'record') {
        e.preventDefault();
        setHash(id);
        const inPanel = !!a.closest('.index');
        if (ROLE_IDS.has(id)) {
          watch.selectRole(id);
          showRole(id, inPanel ? { follow: true } : { scroll: true });
        } else if (PROJECT_IDS.has(id)) {
          watch.selectProject(id);
          if (AI_IDS.has(id) && !inPanel) {
            showProject(id);
            const entry = document.getElementById(id);
            scrollToEl(entry);
            entry.focus({ preventScroll: true });
          } else showProject(id, inPanel ? { follow: true } : { scroll: true });
        } else route(`#${id}`);
        if (inPanel) {
          const art = ROLE_IDS.has(id) ? document.getElementById(id) : $(`.cat[data-pid="${id}"]`);
          if (art) art.focus({ preventScroll: true });
        }
      } else if (id === 'top') {
        e.preventDefault();
        setHash('top');
        scrollTo({ top: 0, behavior: motion() ? 'smooth' : 'auto' });
      } else if (!a.classList.contains('skip')) {
        // Any other in-page target (sections, citations): glide there and move focus along.
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        setHash(id);
        scrollToEl(target);
        if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
      }
    });
    addEventListener('hashchange', () => route(location.hash));

    let raf = 0;
    const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
    addEventListener('resize', relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe($('#stage'));
  }

  /* ---------- start ---------- */

  document.title = `${S.name} | ${S.headline}`;
  renderMast();
  renderIntro();
  renderControls();
  renderSpec();
  renderFlag();
  renderPanel();
  renderMovement();
  renderPapers();
  layout();
  mountWatch();
  watch.selectRole(state.role, { animate: false });
  watch.selectProject(state.project, { animate: false });
  showRole(state.role);
  setReadout('project', S.tak.name, W.monthShort(S.tak.started), S.tak.id);
  wire();
  runMovement();
  if (location.hash && !route(location.hash, { initial: true })) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  document.documentElement.classList.add('ready');
})();
