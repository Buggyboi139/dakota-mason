// Space theme: renders every fact from window.SITE and wires the interactions
// (trajectory plot, mission patches and dossiers, the Local AI program with the
// TAK readout, launch manifest, commendations).
(function () {
  'use strict';

  const S = window.SITE;
  if (!S || !window.Charts || !window.Patches) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const month = (ym) => Charts.fmtDate(ym);
  const isExt = (href) => /^https?:\/\//i.test(href);

  const svgIc = (d, extra) => '<svg class="ic" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' + (extra || '') + '<path d="' + d + '"/></svg>';
  const IC = {
    out: svgIc('M3 9L9 3M4.5 3H9V7.5'),
    down: svgIc('M6 1.5V8.5M3 5.5L6 8.5L9 5.5M2 10.5H10'),
    right: svgIc('M1.5 6H10M7 3L10 6L7 9'),
    left: svgIc('M10.5 6H2M5 3L2 6L5 9'),
    up: svgIc('M6 10.5V2M3 5L6 2L9 5'),
    lock: svgIc('M4 5.5V4A2 2 0 0 1 8 4V5.5', '<rect x="2.5" y="5.5" width="7" height="5"/>'),
  };
  const STAR = '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 .4L6.2 3.6L9.6 3.7L6.9 5.8L7.9 9.1L5 7.2L2.1 9.1L3.1 5.8L.4 3.7L3.8 3.6Z"/></svg>';
  const CHECK = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="17" height="17" fill="none" stroke="rgba(236,233,225,.5)"/><path d="M4.6 9.4L7.6 12.4L13.6 5.4" fill="none" stroke="#fc3d21" stroke-width="1.6"/></svg>';

  function link(href, inner, cls, attrs) {
    const ext = isExt(href);
    return '<a class="' + cls + '" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + (attrs || '') + '>' +
      inner + (ext ? '<span class="vh"> (opens in a new tab)</span>' : '') + '</a>';
  }
  function linkIcon(href) {
    if (/^mailto:/i.test(href)) return IC.right;
    return isExt(href) ? IC.out : IC.right;
  }

  // ------------------------------------------------------------------ basics
  document.title = S.name + ' | ' + S.headline;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', S.summary);

  const bar = $('#bar');
  $$('[data-text="name"]').forEach((n) => { n.textContent = S.name; });
  const resume = S.links.resume;
  const resumeExt = (resume.href.split('.').pop() || '').toUpperCase();
  $$('[data-link="resume"]').forEach((a) => {
    a.href = resume.href;
    if (resume.download) a.setAttribute('download', '');
    const ext = a.querySelector('.bar-resume-ext');
    if (ext) ext.textContent = resumeExt;
  });

  const missions = S.roles.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const missionNo = new Map(missions.map((r, i) => [r.id, i + 1]));
  const firstYear = missions[0].start.slice(0, 4);
  const lastEnd = missions.reduce((acc, r) => (r.end && r.end > acc ? r.end : acc), '');
  const range = firstYear + ' – ' + (S.roles.some((r) => !r.end) ? 'present' : lastEnd.slice(0, 4));

  function sectionName(ref) {
    const r = S.role(ref);
    if (r) return r.short;
    const h = document.getElementById(ref + '-title');
    return h ? h.textContent.trim() : '';
  }

  // ------------------------------------------------------------------ hero
  const contactKeys = ['email', 'linkedin', 'github', 'huggingface'];
  $('#hero-id').innerHTML =
    '<p class="eyebrow"><span class="lbl">Mission archive</span><span class="mono">' + esc(range) + '</span></p>' +
    '<h1 class="name" id="hero-name"><span>' + esc(S.firstName) + '</span> <span>' + esc(S.lastName) + '</span></h1>' +
    '<p class="role-line"><span>' + esc(S.headline) + '</span><span class="role-tag">' + esc(S.tagline) + '</span></p>' +
    '<p class="summary">' + esc(S.summary) + '</p>' +
    '<p class="status"><span class="lbl">Status</span><span>' + esc(S.status) + '</span></p>' +
    '<div class="cta">' +
    '<a class="btn-primary" href="' + esc(resume.href) + '"' + (resume.download ? ' download' : '') + '>' + IC.down +
    '<span>' + esc(resume.label) + '</span><span class="btn-ext">' + esc(resumeExt) + '</span></a>' +
    '<ul class="contact" aria-label="Contact">' +
    contactKeys.map((k) => S.links[k]).filter(Boolean).map((l) => '<li>' + link(l.href, '<span>' + esc(l.label) + '</span>' + linkIcon(l.href), '') + '</li>').join('') +
    '</ul></div>' +
    '<a class="flagship" href="#tak"><span class="lbl">Flagship payload</span><span class="flagship-t">' + esc(S.tak.title) + '</span>' + IC.right + '</a>';

  // Telemetry: mission elapsed time since the Navy start, then the four stats.
  const navy = S.role('navy') || missions[0];
  const ns = navy.start.split('-').map(Number);
  const now = new Date();
  const elapsed = Math.max(0, (now.getFullYear() - ns[0]) * 12 + (now.getMonth() + 1 - (ns[1] || 1)));
  $('#telemetry').innerHTML =
    '<div class="tm tm-met"><p class="tm-label lbl"><span>Mission elapsed time</span><span class="mono">MET</span></p>' +
    '<p class="tm-value"><span class="tm-pre">T+</span>' + Math.floor(elapsed / 12) + '<span class="tm-unit">yr</span>' + pad(elapsed % 12) + '<span class="tm-unit">mo</span></p>' +
    '<p class="tm-note">since ' + esc(month(navy.start)) + '</p></div>' +
    S.stats.map((st, i) =>
      '<div class="tm"><p class="tm-label lbl"><span class="mono">CH ' + pad(i + 1) + '</span></p>' +
      '<p class="tm-value">' + esc(st.value) + (st.unit ? '<span class="tm-unit">' + esc(st.unit) + '</span>' : '') + '</p>' +
      '<p class="tm-note">' + esc(st.label) + '</p></div>').join('');

  // Trajectory plot.
  const plot = Charts.trajectory($('#plot'), {
    milestones: S.milestones.map((m) => ({ date: m.date, label: m.label, ref: m.ref, target: sectionName(m.ref) })),
    projection: String(S.status).split('·')[0].trim(),
    readout: $('#readout'),
    log: $('#flightlog'),
    ariaLabel: 'Career trajectory with ' + S.milestones.length + ' waypoints. Each waypoint opens its section.',
  });
  if ('IntersectionObserver' in window && !reduce.matches) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); setTimeout(plot.fly, 900); }
    }, { threshold: 0.3 });
    io.observe($('#plot'));
  } else {
    plot.fly();
  }

  // ------------------------------------------------------------------ missions
  $('#missions-sub').textContent = missions.length + ' missions, ' + range + '. Select a patch to open its dossier.';
  const patchesEl = $('#patches');
  patchesEl.innerHTML = missions.map((r) =>
    '<button class="ptab" type="button" role="tab" id="tab-' + r.id + '" aria-controls="' + r.id + '" aria-selected="false" tabindex="-1">' +
    Patches.svg(r) +
    '<span class="ptab-no">' + pad(missionNo.get(r.id)) + '</span>' +
    '<span class="ptab-name">' + esc(r.short) + '</span>' +
    '<span class="ptab-yrs">' + esc(r.years) + '</span></button>').join('');

  // Mission window: where this mission sits between the first mission and today.
  const nowDec = now.getFullYear() + now.getMonth() / 12;
  const w0 = Charts.decYear(missions[0].start);
  const w1 = Math.max(nowDec, ...missions.map((r) => (r.end ? Charts.decYear(r.end) : nowDec)));
  const nowLabel = Charts.fmtDate(now.getFullYear() + '-' + pad(now.getMonth() + 1));
  function missionWindow(r) {
    const pct = (v) => ((v - w0) / (w1 - w0)) * 100;
    const a = Charts.decYear(r.start), b = r.end ? Charts.decYear(r.end) : nowDec;
    let ticks = '';
    for (let y = Math.ceil(w0); y <= Math.floor(w1); y++) ticks += '<i style="left:' + pct(y).toFixed(2) + '%"></i>';
    return '<div class="d-window" aria-hidden="true">' +
      '<p class="dw-k"><span class="lbl">Mission window</span><span class="mono">' + esc(r.dates) + '</span></p>' +
      '<div class="dw-track">' + ticks +
      '<span class="dw-seg' + (r.end ? '' : ' is-open') + '" style="left:' + pct(a).toFixed(2) + '%;width:' + Math.max(0.6, pct(b) - pct(a)).toFixed(2) + '%"></span></div>' +
      '<p class="dw-ends"><span>' + esc(month(missions[0].start)) + '</span><span>' + esc(nowLabel) + '</span></p></div>';
  }

  function dossier(r) {
    const n = missionNo.get(r.id);
    const prev = missions[n - 2], next = missions[n];
    const ph = r.photo;
    const fields = [['Place', esc(r.place)]];
    if (r.coords) {
      fields.push(['Coordinates', '<span class="d-coords">' + Charts.globe(r.coords.lat, r.coords.lon, 44) +
        '<span class="mono">' + esc(r.coords.label) + '</span></span>']);
    }
    fields.push(['Dates', esc(r.dates)]);
    if (r.rank) fields.push(['Rank', esc(r.rank)]);
    if (r.awards && r.awards.length) {
      fields.push(['Awards', r.awards.map((a) => '<span class="d-award">' + STAR + '<span>' + esc(a) + '</span></span>').join('')]);
    }

    let body = '<p class="d-intro">' + esc(r.intro) + '</p>';
    if (r.callout) {
      body += '<aside class="d-callout"><p class="d-callout-t">' + esc(r.callout.title) + '</p><p>' + esc(r.callout.text) + '</p></aside>';
    }
    (r.groups || []).forEach((g, gi) => {
      body += '<div class="d-block"><h4 class="d-h"><span class="mono">' + pad(gi + 1) + '</span><span>' + esc(g.heading || 'Mission log') + '</span></h4>' +
        '<ul class="d-list">' + g.points.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></div>';
    });
    if (r.note) {
      body += '<aside class="d-note"><h4>' + esc(r.note.heading) + '</h4><p>' + esc(r.note.text) + '</p></aside>';
    }
    if (r.tools && r.tools.length) {
      body += '<div class="d-block d-tools"><h4 class="d-h"><span>Tools</span><span class="mono">' + pad(r.tools.length) + '</span></h4><ol>' +
        r.tools.map((t, i) => '<li><span>' + pad(i + 1) + '</span>' + esc(t) + '</li>').join('') + '</ol></div>';
    }
    if (r.serviceTimeline && r.serviceTimeline.length) {
      body += '<div class="d-block d-timeline"><h4 class="d-h"><span>Service timeline</span></h4><ol>' +
        r.serviceTimeline.map((s) => '<li><span class="mono">' + esc(s.when) + '</span><span>' + esc(s.what) + '</span></li>').join('') + '</ol></div>';
    }
    // Citations on file for this mission, attached as enclosures.
    const cites = S.citationsFor ? S.citationsFor(r.id) : [];
    if (cites.length) {
      body += '<div class="d-encl">' + cites.map((c, k) =>
        '<a class="encl" href="#citation-' + esc(c.id) + '">' +
        '<span class="encl-k"><span class="lbl">Enclosure ' + pad(k + 1) + '</span><span class="mono">' + esc(c.period) + '</span></span>' +
        '<span class="encl-t">' + esc(c.award) + '</span>' +
        '<span class="encl-go"><span>Read the citation</span>' + IC.right + '</span></a>').join('') + '</div>';
    }

    return '<section class="dossier' + (ph && ph.wide ? ' is-wide' : '') + '" id="' + r.id + '" role="tabpanel" aria-labelledby="tab-' + r.id + '" tabindex="-1" hidden>' +
      '<div class="d-patch">' + Patches.svg(r) + '</div>' +
      '<header class="d-head">' + missionWindow(r) +
      '<p class="d-kicker"><span class="mono">Mission ' + pad(n) + ' / ' + pad(missions.length) + '</span><span>Dossier</span><span>' + esc(r.short) + '</span></p>' +
      '<h3 class="d-title">' + esc(r.title) + '</h3>' +
      '<p class="d-org">' + esc(r.org) + '</p>' +
      (r.tags && r.tags.length ? '<p class="d-tags">' + r.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</p>' : '') +
      '</header>' +
      '<dl class="d-fields">' + fields.map((f) => '<div><dt class="lbl">' + f[0] + '</dt><dd>' + f[1] + '</dd></div>').join('') + '</dl>' +
      (ph ? '<figure class="d-photo print"><div class="print-frame"><img src="' + esc(ph.src) + '" width="' + ph.w + '" height="' + ph.h + '" alt="' + esc(ph.alt) + '" loading="lazy" decoding="async"></div>' +
        '<figcaption><span class="mono">Fig. ' + pad(n) + '</span><span>' + esc(ph.caption) + '</span></figcaption></figure>' : '') +
      '<div class="d-body">' + body + '</div>' +
      '<nav class="d-nav" aria-label="Adjacent missions">' +
      (prev ? '<a class="prev" href="#' + prev.id + '"><span class="mono">' + IC.left + ' Mission ' + pad(n - 1) + '</span>' + esc(prev.short) + '</a>' : '') +
      (next ? '<a class="next" href="#' + next.id + '"><span class="mono">Mission ' + pad(n + 1) + ' ' + IC.right + '</span>' + esc(next.short) + '</a>' : '') +
      '</nav></section>';
  }
  const dossiersEl = $('#dossiers');
  dossiersEl.innerHTML = missions.map(dossier).join('');

  let current = null;
  function selectMission(id, opts) {
    opts = opts || {};
    if (!missionNo.has(id)) return;
    const changed = current !== id;
    current = id;
    $$('.ptab', patchesEl).forEach((b) => {
      const on = b.getAttribute('aria-controls') === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    $$('.dossier', dossiersEl).forEach((d) => {
      const on = d.id === id;
      d.hidden = !on;
      if (on && changed && opts.animate !== false && !reduce.matches) {
        d.classList.remove('is-entering');
        void d.offsetWidth;
        d.classList.add('is-entering');
        clearTimeout(d._t);
        d._t = setTimeout(() => d.classList.remove('is-entering'), 1100);
      }
    });
  }

  patchesEl.addEventListener('click', (e) => {
    const b = e.target.closest('.ptab');
    if (!b) return;
    const id = b.getAttribute('aria-controls');
    selectMission(id);
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  });
  patchesEl.addEventListener('keydown', (e) => {
    const tabs = $$('.ptab', patchesEl);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    tabs[j].focus();
    tabs[j].click();
  });

  // ------------------------------------------------------------------ Local AI program (TAK leads)
  const AI = S.localAI;
  const T = S.tak, Hd = T.headline;
  const launchNo = new Map(S.projectTimeline.map((id, i) => [id, i + 1]));
  const launchMeta = (p) => (launchNo.has(p.id) ? '<span>Launch ' + pad(launchNo.get(p.id)) + '</span>' : '') +
    (p.started ? '<span>Started ' + esc(month(p.started)) + '</span>' : '');
  const anchorFor = (id) => (id === T.id ? T.id : 'payload-' + id);

  $('#ai-title').textContent = AI.title;
  $('#ai-sub').textContent = AI.kicker;
  $('#ai-lede').innerHTML =
    '<p class="lab-intro">' + esc(AI.intro) + '</p>' +
    '<nav class="roster" aria-label="' + esc(AI.title) + ' projects"><span class="lbl">On board</span><ul>' +
    [T].concat(AI.projects).map((p) => '<li><a href="#' + anchorFor(p.id) + '">' + esc(p.name) + '</a></li>').join('') + '</ul></nav>';

  // TAK: the flagship mission.
  const source = Math.round((Hd.tak + Hd.gapToSource) * 100) / 100;
  const lo = Math.floor(Hd.baseline) - 1, hi = Math.ceil(source) + 1;
  const X = (v) => ((v - lo) / (hi - lo)) * 100;
  let ticks = '';
  for (let k = 0; k <= (hi - lo) * 5; k++) {
    const v = lo + k / 5, major = k % 5 === 0;
    ticks += '<span class="sc-tick' + (major ? ' major' : '') + '" style="left:' + X(v).toFixed(3) + '%"></span>';
    if (major) ticks += '<span class="sc-num" style="left:' + X(v).toFixed(3) + '%">' + Math.round(v) + '</span>';
  }
  const mark = (cls, v, val, name, size, flip) =>
    '<div class="sc-mark ' + cls + (flip ? ' flip' : '') + '" style="--x:' + X(v).toFixed(3) + '%">' +
    '<span class="sc-stem"></span><span class="sc-dot"></span>' +
    '<span class="sc-label"><span class="sc-val">' + val + '</span><span class="sc-name">' + name +
    '<span class="sc-size">' + size + '</span></span></span></div>';
  const tSize = parseFloat(Hd.size), sSize = parseFloat(Hd.sourceSize);
  const unit = (String(Hd.size).match(/[A-Za-z]+/) || [''])[0];
  const sizeMax = Math.ceil(sSize / 10) * 10;
  let sizeAxis = '';
  for (let v = 0; v <= sizeMax; v += 10) sizeAxis += '<span style="left:' + (v / sizeMax * 100).toFixed(2) + '%">' + v + (v === sizeMax ? ' ' + esc(unit) : '') + '</span>';
  const sizeRow = (cls, name, v, label) => {
    const w = v / sizeMax * 100;
    return '<div class="sz-row ' + cls + '"><span class="sz-name lbl">' + name + '</span><div class="sz-track" style="--w:' + w.toFixed(2) + '%">' +
      '<div class="sz-bar"></div><span class="sz-val' + (w > 70 ? ' in' : '') + '">' + esc(label) + '</span></div></div>';
  };
  const dmax = Math.ceil(Math.max.apply(null, T.benchmarks.map((b) => b.delta)) / 5) * 5;
  const hf = AI.huggingface;
  const takLinks = T.links.filter((l) => !hf || l.href !== hf.href);
  const numbered = (list, cls) => '<ol class="' + cls + '">' + list.map((p, i) => '<li><span class="mono">' + pad(i + 1) + '</span><span>' + esc(p) + '</span></li>').join('') + '</ol>';

  $('#tak').innerHTML =
    '<header class="tak-head">' +
    '<p class="sec-index sub-index"><span class="sec-no">02.1</span><span>Flagship mission</span><span class="tak-launch">' + launchMeta(T) + '</span></p>' +
    '<div class="tak-id"><p class="lbl tak-kicker">Deep-space probe</p>' +
    '<h3 class="tak-name" id="tak-title">' + esc(T.name) + '</h3>' +
    '<p class="tak-sub">' + esc(T.subtitle) + '</p>' +
    '<p class="tak-tag">' + esc(T.tag) + '</p></div>' +
    '<div class="tak-desc"><p>' + esc(T.description) + '</p>' +
    '<ul class="tak-stack" aria-label="Stack">' + T.stack.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' +
    '</header>' +
    '<div class="tak-panel">' +
    // Instrument 01: the headline score line.
    '<section class="inst" aria-labelledby="inst-1">' +
    '<header class="inst-head"><span class="mono">Instrument 01</span><h4 id="inst-1">' + esc(Hd.model) + ' · ' + esc(Hd.task) + ' score</h4>' +
    '<span class="inst-meta">' + esc(Hd.size) + ' file</span></header>' +
    '<div class="score" role="img" aria-label="' + esc(Hd.model + ' ' + Hd.task + ' score: ' + T.name + ' ' + Hd.tak + ', ' + Hd.baselineName + ' ' + Hd.baseline + ', source model ' + source.toFixed(2)) + '">' +
    '<div class="sc-axis">' + ticks + '</div>' +
    mark('sc-src', source, source.toFixed(2), 'Source model', esc(Hd.sourceSize), true) +
    mark('sc-tak', Hd.tak, Hd.tak.toFixed(2), esc(T.name), esc(Hd.size), true) +
    mark('sc-base', Hd.baseline, Hd.baseline.toFixed(2), esc(Hd.baselineName), esc(Hd.size), false) +
    '<div class="sc-bracket" style="left:' + X(Hd.baseline).toFixed(3) + '%;width:' + (X(Hd.tak) - X(Hd.baseline)).toFixed(3) + '%"><span>+' + Hd.delta.toFixed(2) + ' points</span></div>' +
    '<div class="sc-bracket gap" style="left:' + X(Hd.tak).toFixed(3) + '%;width:' + (X(source) - X(Hd.tak)).toFixed(3) + '%"><span>' + Hd.gapToSource.toFixed(2) + ' to source</span></div>' +
    '</div>' +
    '<p class="inst-cap">' + esc(Hd.text) + '</p>' +
    '</section>' +
    // Instruments 02 and 03: file size and the benchmark channels.
    '<div class="inst-grid">' +
    '<section class="inst" aria-labelledby="inst-2">' +
    '<header class="inst-head"><span class="mono">Instrument 02</span><h4 id="inst-2">File size</h4></header>' +
    '<div class="sizes">' + sizeRow('sz-tak', esc(T.name), tSize, Hd.size) +
    sizeRow('sz-base', esc(Hd.baselineName), tSize, Hd.size) +
    sizeRow('sz-src', 'Source model', sSize, Hd.sourceSize) +
    '<div class="sz-axis" aria-hidden="true">' + sizeAxis + '</div></div>' +
    '<p class="sz-sum"><b>' + esc(Hd.smaller) + '</b><span class="lbl">smaller</span></p>' +
    '</section>' +
    '<section class="inst" aria-labelledby="inst-3">' +
    '<header class="inst-head"><span class="mono">Instrument 03</span><h4 id="inst-3">Benchmark channels</h4></header>' +
    '<ol class="channels">' + T.benchmarks.map((b, i) =>
      '<li><span class="ch-no">CH ' + pad(i + 1) + '</span>' +
      '<div class="ch-model"><b>' + esc(b.model) + '</b><span class="lbl">' + esc(b.task) + '</span></div>' +
      '<div class="ch-row"><div class="ch-track" aria-hidden="true"><div class="ch-bar" style="--w:' + (b.delta / dmax * 100).toFixed(2) + '%"></div></div>' +
      '<span class="ch-val">' + esc(b.value) + '</span></div>' +
      '<p class="ch-text">' + (b.text === Hd.text ? '+' + b.delta.toFixed(2) + ' points. Full readout in Instrument 01.' : esc(b.text)) + '</p></li>').join('') +
    '</ol>' +
    '<p class="ch-scale" aria-hidden="true"><span>0</span><span>' + dmax + ' points</span></p>' +
    '</section>' +
    '</div>' +
    // The pipeline, drawn as a launch sequence.
    '<section class="inst inst-seq" aria-labelledby="inst-seq">' +
    '<header class="inst-head"><span class="mono">Launch sequence</span><h4 id="inst-seq">How ' + esc(T.name) + ' works</h4>' +
    '<span class="inst-meta">' + AI.takHow.length + ' stages</span></header>' +
    '<ol class="seq">' + AI.takHow.map((s, i) =>
      '<li style="--k:' + i + '"><span class="seq-node" aria-hidden="true"></span>' +
      '<p class="seq-h"><span class="mono">' + pad(i + 1) + '</span><b>' + esc(s.step) + '</b></p>' +
      '<p class="seq-t">' + esc(s.text) + '</p></li>').join('') +
    '</ol></section>' +
    // Notes and the extra systems, side by side.
    '<div class="inst-grid even">' +
    '<section class="inst" aria-labelledby="inst-4">' +
    '<header class="inst-head"><span class="mono">Systems notes</span><h4 id="inst-4">Design and evaluation</h4></header>' +
    numbered(T.points, 'notes') + '</section>' +
    '<section class="inst" aria-labelledby="inst-5">' +
    '<header class="inst-head"><span class="mono">Additional systems</span><h4 id="inst-5">Also on board</h4></header>' +
    numbered(AI.takExtras, 'notes') + '</section>' +
    '</div>' +
    // Lineage and the published models.
    '<div class="inst-grid even">' +
    '<section class="inst heritage" aria-labelledby="inst-6">' +
    '<header class="inst-head"><span class="mono">Heritage</span><h4 id="inst-6">Lineage</h4></header>' +
    '<p class="heritage-t">' + esc(AI.lineage) + '</p></section>' +
    (hf ? '<section class="inst hf" aria-labelledby="inst-7">' +
      '<header class="inst-head"><span class="mono">Published</span><h4 id="inst-7">Hugging Face</h4></header>' +
      link(hf.href, '<b class="hf-n">' + esc(hf.models) + '</b><span class="hf-l">' + esc(hf.label) + '</span>' + IC.out, 'hf-link') +
      '</section>' : '') +
    '</div>' +
    '<footer class="tak-foot"><div class="tak-links">' +
    takLinks.map((l) => link(l.href, '<span>' + esc(l.label) + '</span>' + IC.out, 'link-line')).join('') +
    '</div><p class="private">' + IC.lock + '<span>' + esc(T.note) + '</span></p></footer>' +
    '</div>';

  // The rest of the program: two primary payloads, then the smaller ones.
  function aiCard(p, size) {
    const flow = p.workflow && p.workflow.length
      ? '<div class="flow-wrap"><p class="lbl">Workflow</p><ol class="flow">' +
        p.workflow.map((w, i) => '<li><span class="mono">' + pad(i + 1) + '</span><span>' + esc(w) + '</span></li>').join('') + '</ol></div>'
      : '';
    const pts = p.points && p.points.length ? numbered(p.points, 'ai-points') : '';
    const links = p.links && p.links.length
      ? '<div class="m-links">' + p.links.map((l) => link(l.href, '<span>' + esc(l.label) + '</span>' + IC.out, 'link-line')).join('') + '</div>'
      : '';
    const note = p.note ? '<p class="m-note">' + IC.lock + '<span>' + esc(p.note) + '</span></p>' : '';
    return '<article class="ai-card is-' + size + '" id="payload-' + p.id + '" aria-labelledby="ai-' + p.id + '-t">' +
      '<p class="ai-meta">' + launchMeta(p) + '</p>' +
      '<h4 class="ai-name" id="ai-' + p.id + '-t">' + esc(p.name) + '</h4>' +
      '<p class="ai-tag">' + esc(p.tag) + '</p>' +
      '<p class="ai-desc">' + esc(p.description) + '</p>' + flow + pts +
      (links || note ? '<footer class="ai-foot">' + links + note + '</footer>' : '') +
      '</article>';
  }
  const primary = AI.projects.slice(0, 2), secondary = AI.projects.slice(2);
  $('#lab-bay').innerHTML =
    (primary.length ? '<section class="lab-group" aria-labelledby="lab-g2"><h3 class="sec-index sub-index" id="lab-g2"><span class="sec-no">02.2</span><span>Primary payloads</span></h3>' +
      '<div class="ai-major">' + primary.map((p) => aiCard(p, 'major')).join('') + '</div></section>' : '') +
    (secondary.length ? '<section class="lab-group" aria-labelledby="lab-g3"><h3 class="sec-index sub-index" id="lab-g3"><span class="sec-no">02.3</span><span>Secondary payloads</span></h3>' +
      '<div class="ai-minor">' + secondary.map((p) => aiCard(p, 'minor')).join('') + '</div></section>' : '');

  // Gauges settle into place the first time they come into view.
  const gauges = $$('.score, .sizes, .channels, .seq', $('#tak'));
  if (!reduce.matches && 'IntersectionObserver' in window) {
    gauges.forEach((g) => g.classList.add('is-pre'));
    const gio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.remove('is-pre'); gio.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    gauges.forEach((g) => gio.observe(g));
  }

  // ------------------------------------------------------------------ payloads
  // The cadence and the manifest both run newest first; the manifest lists the projects outside Local AI.
  const aiIds = new Set([T.id].concat(AI.projects.map((p) => p.id)));
  const launches = S.projectTimeline.map((id) => S.project(id)).filter(Boolean).reverse();
  const manifestList = S.featured.concat(S.more);
  const onManifest = new Set(manifestList.map((p) => p.id));
  const payloads = launches.filter((p) => onManifest.has(p.id));
  manifestList.forEach((p) => { if (payloads.indexOf(p) < 0) payloads.push(p); });
  const featured = new Set(S.featured.map((p) => p.id));
  const startedSorted = launches.map((p) => p.started).filter(Boolean).sort();
  const firstM = startedSorted[0], lastM = startedSorted[startedSorted.length - 1];
  const monthsList = [];
  {
    let y = Number(firstM.slice(0, 4)), m = Number(firstM.slice(5, 7));
    const ey = Number(lastM.slice(0, 4)), em = Number(lastM.slice(5, 7));
    while (y < ey || (y === ey && m <= em)) {
      monthsList.push(y + '-' + pad(m));
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    monthsList.reverse();
  }
  const aiCount = launches.filter((p) => aiIds.has(p.id)).length;
  $('#projects-sub').textContent = launches.length + ' launches, newest first, from ' + month(lastM) + ' back to ' + month(firstM) + ', by the month each project started. ' +
    'The ' + AI.title + ' program above holds ' + aiCount + '; the other ' + payloads.length + ' are on this manifest. Select a row to open its details.';
  const noLabel = (p) => (launchNo.has(p.id) ? pad(launchNo.get(p.id)) : '··');
  $('#cadence').innerHTML =
    '<figcaption class="cad-cap"><span class="lbl">Launch cadence</span>' +
    '<span class="cad-key" aria-hidden="true"><span class="k k-ai">' + esc(AI.title) + ' program</span><span class="k k-man">This manifest</span><span class="k k-flag">Flagship</span></span>' +
    '<span class="mono">' + esc(month(lastM).toUpperCase()) + ' – ' + esc(month(firstM).toUpperCase()) + '</span></figcaption>' +
    '<div class="cad-grid" style="--n:' + monthsList.length + '">' + monthsList.map((mo) =>
      '<div class="cad-col">' + launches.filter((p) => p.started === mo).map((p) => {
        const ai = aiIds.has(p.id);
        return '<a class="cad-pin' + (ai ? ' is-ai' : '') + (p.id === T.id ? ' is-flag' : '') + '" href="#' + anchorFor(p.id) + '" data-p="' + p.id + '" aria-label="' +
          esc('Launch ' + noLabel(p) + ', ' + p.name + ', ' + month(mo) + (ai ? ', ' + AI.title + ' program' : '')) + '"><b>' + noLabel(p) + '</b><span class="cad-name">' + esc(p.name) + '</span></a>';
      }).join('') +
      '</div>').join('') + '</div>' +
    '<div class="cad-months" style="--n:' + monthsList.length + '" aria-hidden="true">' + monthsList.map((mo, i) => {
      const has = launches.some((p) => p.started === mo);
      // Read right to left in time, so each year is labeled at its newest month.
      const lab = month(mo).split(' ')[0] + (i === 0 || mo.endsWith('-12') ? ' ' + mo.slice(2, 4) : '');
      return '<span' + (has ? ' class="has"' : '') + '>' + esc(lab) + '</span>';
    }).join('') + '</div>';

  function payloadRow(p) {
    const feat = featured.has(p.id);
    const img = p.image ? '<figure class="m-img print"><div class="print-frame"><img src="' + esc(p.image.src) + '" width="' + p.image.w + '" height="' + p.image.h +
      '" alt="' + esc(p.image.alt) + '" loading="lazy" decoding="async"></div></figure>' : '';
    let text = '<p>' + esc(p.description) + '</p>' + (p.detail ? '<p class="m-detail">' + esc(p.detail) + '</p>' : '');
    if (p.links && p.links.length) text += '<div class="m-links">' + p.links.map((l) => link(l.href, '<span>' + esc(l.label) + '</span>' + IC.out, 'link-line')).join('') + '</div>';
    if (p.note) text += '<p class="m-note">' + IC.lock + '<span>' + esc(p.note) + '</span></p>';
    return '<details class="mrow" id="payload-' + p.id + '"' + (feat ? ' open' : '') + '>' +
      '<summary><span class="m-seq">' + noLabel(p) + '</span>' +
      '<span class="m-name">' + esc(p.name) + '</span>' +
      '<span class="m-meta"><span class="m-date">' + (p.started ? esc(month(p.started)) : '') + '</span><span class="m-class">' + esc(p.tag) + '</span>' +
      (feat ? '<span class="m-flag">Featured</span>' : '') + '</span>' +
      '<span class="m-tog" aria-hidden="true"></span></summary>' +
      '<div class="m-body' + (img ? ' has-img' : '') + '">' + img + '<div class="m-text">' + text + '</div></div></details>';
  }
  $('#manifest').innerHTML =
    '<div class="m-cols" aria-hidden="true"><span class="lbl">Launch</span><span class="lbl">Started</span><span class="lbl">Payload</span><span class="lbl">Class</span><span></span><span></span></div>' +
    payloads.map(payloadRow).join('');

  // Pins and rows light each other up.
  $$('.cad-pin').forEach((pin) => {
    const row = document.getElementById(anchorFor(pin.getAttribute('data-p')));
    if (!row) return;
    const hot = row.tagName === 'DETAILS' ? row.querySelector('summary') : row;
    const on = () => pin.classList.add('is-hot'), off = () => pin.classList.remove('is-hot');
    hot.addEventListener('pointerenter', on); hot.addEventListener('pointerleave', off);
    if (row.tagName === 'DETAILS') { hot.addEventListener('focus', on); hot.addEventListener('blur', off); }
  });

  // ------------------------------------------------------------------ awards
  const AW = S.awards || { ribbons: [], citations: [] };
  const ribbons = AW.ribbons || [], citations = AW.citations || [];
  const citeNo = new Map(citations.map((c, i) => [c.id, i + 1]));
  $('#awards-sub').textContent = ribbons.length + ' ribbons in order of precedence, and the full text of ' + citations.length + ' citations. Each citation links back to its mission.';
  function ribbonImg(r) {
    let svg = '';
    try { if (window.RIBBONS) svg = RIBBONS.ribbon(r.id, { device: r.device, title: r.name, width: 110 }); } catch (err) { svg = ''; }
    return '<span class="rb-img" aria-hidden="true">' + svg + '</span>';
  }
  const ribbonRows = ribbons.map((r, i) => {
    const linked = citations.filter((c) => c.award === r.name);
    return '<li><span class="rb-no mono">' + pad(i + 1) + '</span>' + ribbonImg(r) +
      '<span class="rb-txt"><span class="rb-name">' + esc(r.name) + '</span>' +
      (r.note ? '<span class="rb-note">' + esc(r.note) + '</span>' : '') +
      (linked.length ? '<span class="rb-cites">' + linked.map((c) => '<a href="#citation-' + esc(c.id) + '">Citation ' + pad(citeNo.get(c.id)) + '</a>').join('') + '</span>' : '') +
      '</span></li>';
  }).join('');
  function citeDoc(c, i) {
    const role = S.role(c.ref);
    const f = [];
    if (c.from) f.push(['From', c.from]);
    f.push(['Recipient', c.recipient], ['Billet', c.billet], ['Period', c.period]);
    if (c.given) f.push(['Given', c.given]);
    const sg = c.signer || [];
    return '<article class="cite" id="citation-' + esc(c.id) + '" aria-labelledby="cite-' + esc(c.id) + '-t">' +
      '<header class="cite-bar"><span class="mono">Citation ' + pad(i + 1) + ' / ' + pad(citations.length) + '</span>' +
      (role ? '<a class="cite-ref" href="#' + role.id + '"><span class="lbl">Mission</span><span>' + esc(role.short) + '</span>' + IC.right + '</a>' : '') + '</header>' +
      '<div class="cite-title"><h3 id="cite-' + esc(c.id) + '-t">' + esc(c.award) + '</h3>' +
      (c.awardNote ? '<p class="cite-note">' + esc(c.awardNote) + '</p>' : '') + '</div>' +
      '<dl class="cite-fields">' + f.map((x) => '<div><dt class="lbl">' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>').join('') + '</dl>' +
      '<div class="cite-text">' + (c.opening ? '<p class="cite-open">' + esc(c.opening) + '</p>' : '') + '<p>' + esc(c.text) + '</p></div>' +
      (sg.length ? '<footer class="cite-sig"><span class="sig-line" aria-hidden="true"></span>' +
        sg.map((s, k) => '<span class="' + (k ? 'sig-sub' : 'sig-name') + '">' + esc(s) + '</span>').join('') + '</footer>' : '') +
      '</article>';
  }
  $('#aw-body').innerHTML =
    '<aside class="rack" aria-labelledby="rack-t"><header class="rack-head"><h3 class="lbl" id="rack-t">Ribbons</h3>' +
    '<span class="mono">' + pad(ribbons.length) + '</span></header>' +
    '<p class="rack-sub">In order of precedence</p>' +
    '<ol class="rb-list">' + ribbonRows + '</ol></aside>' +
    '<div class="cites">' + citations.map(citeDoc).join('') + '</div>';

  // ------------------------------------------------------------------ training
  const E = S.education;
  $('#training').innerHTML =
    '<div class="tr-degree"><h3 class="lbl">Degree</h3>' +
    '<p class="tr-deg">' + esc(E.degree) + '</p>' +
    '<p class="tr-school">' + esc(E.school) + '</p>' +
    '<ul class="tr-details">' + E.details.map((d) => '<li>' + esc(d) + '</li>').join('') + '</ul>' +
    '<p class="tr-status"><span class="lbl">Status</span><span>' + esc(E.status) + '</span></p></div>' +
    '<div class="tr-certs"><h3 class="lbl">Certifications</h3><ol>' +
    E.certs.map((c) => '<li>' + CHECK + '<b>' + esc(c.name) + '</b><span class="mono">' + esc(c.date) + '</span></li>').join('') + '</ol></div>' +
    '<div class="tr-course"><h3 class="lbl">Coursework</h3><ol>' +
    E.coursework.map((c, i) => '<li><span>' + pad(i + 1) + '</span>' + esc(c) + '</li>').join('') + '</ol></div>' +
    '<div class="tr-skills"><h3 class="lbl">Skills</h3><ul>' +
    E.skills.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>';

  // ------------------------------------------------------------------ archive
  const B = S.book;
  // Rating as drawn stars, filled to the exact value; the label carries the meaning.
  function stars(r) {
    const n = r.outOf || 5, v = Math.max(0, Math.min(n, Number(r.stars) || 0));
    const sw = 15, gap = 4, W = n * sw + (n - 1) * gap;
    const full = Math.floor(v), clipW = full * (sw + gap) + (v - full) * sw;
    let shapes = '';
    for (let i = 0; i < n; i++) shapes += '<path transform="translate(' + i * (sw + gap) + ' 0) scale(1.5)" d="M5 .4L6.2 3.6L9.6 3.7L6.9 5.8L7.9 9.1L5 7.2L2.1 9.1L3.1 5.8L.4 3.7L3.8 3.6Z"/>';
    return '<svg class="stars" viewBox="0 0 ' + W + ' ' + sw + '" width="' + W + '" height="' + sw + '" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="stars-clip"><rect x="0" y="0" width="' + clipW.toFixed(2) + '" height="' + sw + '"/></clipPath></defs>' +
      '<g class="stars-off">' + shapes + '</g><g class="stars-on" clip-path="url(#stars-clip)">' + shapes + '</g></svg>';
  }
  const recFields = [['Author', esc(S.name)], ['Formats', B.formats.map(esc).join(' / ')]];
  if (B.published) recFields.push(['Published', esc(B.published)]);
  if (B.rating && B.rating.label) recFields.push(['Rating', '<span class="rec-rating">' + stars(B.rating) + '<span>' + esc(B.rating.label) + '</span></span>']);
  $('#record').innerHTML =
    '<figure class="rec-cover print"><div class="print-frame"><img src="' + esc(B.cover.src) + '" width="' + B.cover.w + '" height="' + B.cover.h +
    '" alt="' + esc(B.cover.alt) + '" loading="lazy" decoding="async"></div><figcaption><span class="mono">Item 01</span><span>Cover</span></figcaption></figure>' +
    '<div class="rec-body">' +
    '<p class="rec-kicker"><span>Record 01</span><span>Book</span></p>' +
    '<h3 class="rec-title">' + esc(B.title) + '</h3>' +
    '<p class="rec-sub">' + esc(B.subtitle) + '</p>' +
    '<dl class="rec-fields">' + recFields.map((f) => '<div><dt class="lbl">' + f[0] + '</dt><dd>' + f[1] + '</dd></div>').join('') + '</dl>' +
    '<p class="rec-text">' + esc(B.text) + '</p>' +
    '<p class="rec-link">' + link(B.href, '<span>View on Amazon</span>' + IC.out, 'link-line') + '</p>' +
    '</div>';

  // ------------------------------------------------------------------ comms
  const chans = [
    { l: S.links.email, h: S.links.email && S.links.email.address },
    { l: S.links.linkedin, h: S.links.linkedin && S.links.linkedin.handle },
    { l: S.links.github, h: S.links.github && S.links.github.handle },
    { l: S.links.huggingface, h: S.links.huggingface && S.links.huggingface.handle },
  ].filter((c) => c.l);
  $('#comms-body').innerHTML =
    '<div class="comms-lead">' +
    '<p class="status"><span class="lbl">Status</span><span>' + esc(S.status) + '</span></p>' +
    '<p class="status comms-loc"><span class="lbl">Location</span><span>' + esc(S.location) + '</span></p>' +
    '<div class="comms-focus"><p class="lbl">Focus areas</p><ul>' + S.focusAreas.map((f, i) => '<li><span>' + pad(i + 1) + '</span>' + esc(f) + '</li>').join('') + '</ul></div>' +
    '<a class="btn-primary" href="' + esc(resume.href) + '"' + (resume.download ? ' download' : '') + '>' + IC.down +
    '<span>' + esc(resume.label) + '</span><span class="btn-ext">' + esc(resumeExt) + '</span></a>' +
    '</div>' +
    '<ol class="chan" aria-label="Channels">' + chans.map((c, i) =>
      '<li>' + link(c.l.href,
        '<span class="chan-n">CH ' + pad(i + 1) + '</span><span class="chan-name">' + esc(c.l.label) + '</span>' +
        '<span class="chan-h">' + esc(c.h || '') + '</span>' + linkIcon(c.l.href), '') + '</li>').join('') +
    '</ol>';

  // ------------------------------------------------------------------ footer
  $('#foot').innerHTML = '<p>' + esc(S.footer) + '</p><a href="#top"><span>Back to top</span>' + IC.up + '</a>';

  // ------------------------------------------------------------------ navigation
  const menuBtn = $('.menu-btn');
  function closeMenu() {
    if (!bar.classList.contains('is-open')) return;
    bar.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => {
    const open = !bar.classList.contains('is-open');
    bar.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bar.classList.contains('is-open')) { closeMenu(); menuBtn.focus(); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (bar.classList.contains('is-open') && !bar.contains(e.target)) closeMenu();
  });

  let userMoved = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, () => { userMoved = true; }, { passive: true, once: true }));

  function go(id, how) {
    how = how || {};
    let target = null;
    if (missionNo.has(id)) {
      selectMission(id, { animate: how.animate });
      target = document.getElementById(id);
    } else {
      target = document.getElementById(id);
      if (target && target.tagName === 'DETAILS') target.open = true;
    }
    if (!target) return false;
    const behavior = how.instant || reduce.matches ? 'auto' : 'smooth';
    if (id === 'top') window.scrollTo({ top: 0, behavior: behavior });
    else target.scrollIntoView({ behavior: behavior, block: 'start' });
    if (how.focus) {
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|DETAILS|SUMMARY)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      const f = target.tagName === 'DETAILS' ? target.querySelector('summary') : target;
      f.focus({ preventScroll: true });
    }
    return true;
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    closeMenu();
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    go(id, { focus: true });
  });
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) go(id);
  });

  // Initial state and deep links.
  const initial = decodeURIComponent(location.hash.slice(1));
  selectMission(missionNo.has(initial) ? initial : missions[missions.length - 1].id, { animate: false });
  if (initial && document.getElementById(initial)) {
    const jump = () => { if (!userMoved) go(initial, { instant: true, animate: false }); };
    jump();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(jump);
    window.addEventListener('load', jump, { once: true });
  }

  // Bar background once the page scrolls, and the active section in the nav.
  const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const navLinks = $$('.nav a');
  const crumb = $('.brand-sub');
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    let lastActive = '';
    const sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
      let active = '';
      navLinks.forEach((a) => { if (visible.get(a.getAttribute('data-sec'))) active = a.getAttribute('data-sec'); });
      // Between sections keep the last one; at the hero, clear it.
      if (!active && !visible.get('top')) active = lastActive;
      lastActive = active;
      navLinks.forEach((a) => {
        const on = a.getAttribute('data-sec') === active;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      const cur = navLinks.find((a) => a.getAttribute("data-sec") === active);
      const no = active && document.querySelector('#' + active + ' .sec-no');
      if (cur && crumb) crumb.innerHTML = (no ? "<span class=\"mono\">" + esc(no.textContent) + "</span>" : "") + esc(cur.textContent);
      bar.classList.toggle("has-crumb", !!cur);
    }, { rootMargin: '-40% 0px -55% 0px' });
    navLinks.forEach((a) => { const s = document.getElementById(a.getAttribute('data-sec')); if (s) sio.observe(s); });
    sio.observe($('#top'));
  }
})();
