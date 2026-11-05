// Builds the Pastel page from window.SITE, then wires up the pastel swashes, the TAK bars,
// and the pastel box in the hero.
(function () {
  'use strict';
  const S = window.SITE;
  const P = window.Pastel;
  const reduced = P.reduced;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- DOM helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }

  const ICONS = {
    download: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6v11.1m-4.7-4.5 4.7 4.7 4.7-4.7M4.8 19.7h14.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7m-8.3-.2H17v8.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.4" y="5.4" width="17.2" height="13.2" rx="3.4" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="m4.6 7.6 7.4 5.8 7.4-5.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rosette: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8.6 13.2-2.7 7.4 3.4-1.2 1.9 3 1.4-6.2m3.8-3 2.7 7.4-3.4-1.2-1.9 3-1.4-6.2" style="fill:var(--hue)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="9" r="6.3" style="fill:var(--hue)" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4.6v14.2m-5.4-5.4 5.4 5.4 5.4-5.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    seal: '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M20 3.5l3.2 2.6 4-.9 1.9 3.6 3.9 1.2.1 4.1 3 2.8-1.7 3.7 1.7 3.7-3 2.8-.1 4.1-3.9 1.2-1.9 3.6-4-.9L20 36.5l-3.2-2.6-4 .9-1.9-3.6-3.9-1.2-.1-4.1-3-2.8 1.7-3.7-1.7-3.7 3-2.8.1-4.1 3.9-1.2 1.9-3.6 4 .9z" fill="#FFFDF8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m13.6 20.6 4.4 4.4 8.6-9.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function icon(name) {
    const t = document.createElement('template');
    t.innerHTML = ICONS[name];
    return t.content.firstChild;
  }

  function link(href, label, o = {}) {
    // Off-site links open in a new tab; same-origin files such as the resume PDF stay put.
    const http = /^https?:/i.test(href) && new URL(href, location.href).origin !== location.origin;
    const a = h('a', {
      class: o.cls, href,
      target: http ? '_blank' : null, rel: http ? 'noopener' : null,
      download: o.download ? '' : null, 'aria-label': o.aria || null,
    });
    a.append(...[].concat(label));
    if (o.icon) a.append(icon(o.icon));
    else if (http && o.icon !== false) a.append(icon('out'));
    if (http && !o.aria) a.append(h('span', { class: 'sr-only' }, ' (opens in a new tab)'));
    return a;
  }

  const hueVars = (k, dark) => {
    const d = dark ? '-dk' : '';
    return `--hue: var(--${k}); --dab1: var(--dab-${k}${d}-1); --dab2: var(--dab-${k}${d}-2); --dab3: var(--dab-${k}${d}-3);`;
  };

  // A heading that gets its own pastel swash when it scrolls into view.
  function swashHeading(tag, text, hue, cls, id) {
    return h(tag, { class: 'sh ' + (cls || ''), id, 'data-hue': hue },
      h('span', { class: 'sh-text' }, text, h('span', { class: 'probe', 'aria-hidden': 'true' })),
      h('canvas', { class: 'sh-canvas', 'aria-hidden': 'true' }),
      h('span', { class: 'sh-layer', 'aria-hidden': 'true' }));
  }

  const ROLE_HUE = { research: 'lilac', va: 'mint', bahrain: 'butter', djibouti: 'peach', navy: 'sky' };
  const TRAY = [['rose', 128], ['peach', 112], ['butter', 136], ['mint', 104], ['sky', 122], ['lilac', 116]];

  // ---------- Build ----------
  function buildBar() {
    const L = S.links;
    document.getElementById('bar').append(
      h('a', { class: 'bar-name', href: '#top' }, S.name),
      h('nav', { class: 'bar-nav', 'aria-label': 'Sections' },
        h('a', { class: 'opt', href: '#experience' }, 'Experience'),
        h('a', { class: 'opt', href: '#' + S.localAI.id }, S.localAI.title),
        h('a', { class: 'opt', href: '#projects' }, 'Projects'),
        h('a', { class: 'opt', href: '#awards' }, 'Awards'),
        h('a', { class: 'opt opt2', href: '#education' }, 'Education'),
        h('a', { class: 'opt opt2', href: '#book' }, 'Book'),
        h('a', { href: '#contact' }, 'Contact')),
      link(L.resume.href, ['Resume ', h('small', {}, 'PDF')], { cls: 'btn btn-rose squish', download: true, icon: 'download', aria: L.resume.label + ' (PDF)' }));
  }

  function buildHero() {
    const L = S.links;
    const copy = h('div', { class: 'hero-copy' },
      h('p', { class: 'kicker' }, S.headline),
      h('h1', { class: 'name', id: 'hero-name' },
        h('span', { class: 'n1' }, S.firstName), ' ',
        h('span', { class: 'n2' }, S.lastName, h('span', { class: 'probe', 'aria-hidden': 'true' }))),
      h('p', { class: 'summary' }, S.summary),
      h('p', { class: 'status' }, S.status),
      h('p', { class: 'focus' }, h('b', {}, 'Focus: '), S.focusAreas.join(' · ')),
      h('div', { class: 'cta' },
        link(L.resume.href, [L.resume.label, ' ', h('small', {}, 'PDF')], { cls: 'btn btn-rose squish', download: true, icon: 'download' }),
        h('div', { class: 'cta-links' },
          link(L.linkedin.href, L.linkedin.label),
          link(L.github.href, L.github.label),
          link(L.huggingface.href, L.huggingface.label),
          link(L.email.href, L.email.label, { icon: false }))));

    const tray = h('div', { class: 'tray', role: 'radiogroup', 'aria-labelledby': 'tray-label' });
    TRAY.forEach(([k, len], i) => {
      const b = h('button', {
        class: 'tstick', type: 'button', role: 'radio', 'aria-checked': i === 0 ? 'true' : 'false',
        tabindex: i === 0 ? '0' : '-1', 'aria-label': P.PALETTE[k].name, 'data-color': k,
      });
      b.innerHTML = P.stickSVG(k, len, 30);
      P.shadeStick(b.firstElementChild, -Math.PI / 2);
      tray.append(b);
    });
    const pad = h('div', { class: 'pad' },
      h('span', { class: 'tape tape-1', 'aria-hidden': 'true' }),
      h('span', { class: 'tape tape-2', 'aria-hidden': 'true' }),
      h('span', { class: 'pad-hint' },
        h('span', { class: 'hint-fine' }, 'Draw here, or anywhere on the paper'),
        h('span', { class: 'hint-touch' }, 'Draw here with a finger')));
    const box = h('aside', { class: 'box', 'aria-label': 'Pastel box' },
      h('p', { class: 'box-label', id: 'tray-label' }, 'Pick a pastel'),
      tray, pad,
      h('div', { class: 'box-actions' },
        h('button', { class: 'btn btn-sm squish', type: 'button', id: 'clean' }, 'Clean the paper'),
        h('button', { class: 'btn btn-sm squish', type: 'button', id: 'doodle' }, 'Doodle for me')));

    // The flagship, one click from the first screen.
    const T = S.tak, b0 = T.benchmarks[0], vs = b0.value.split(' vs ');
    const slate = h('a', { class: 'slate', href: '#' + T.id },
      h('span', { class: 'slate-kicker' }, T.tag),
      h('span', { class: 'slate-title' }, h('b', {}, T.name), ' ', T.subtitle),
      h('span', { class: 'slate-score' }, vs.length === 2 ? [vs[0], h('i', {}, 'vs'), vs[1]] : b0.value),
      h('span', { class: 'slate-on' }, `${b0.model} · ${b0.task}`),
      h('span', { class: 'slate-go' }, 'See the results', icon('down')));

    return h('section', { class: 'hero', id: 'top', 'aria-labelledby': 'hero-name' },
      h('canvas', { class: 'hero-canvas', 'aria-hidden': 'true' }),
      h('div', { class: 'hero-layer', 'aria-hidden': 'true' }),
      h('div', { class: 'wrap hero-grid' }, copy, h('div', { class: 'slate-wrap' }, slate), box));
  }

  function buildStats() {
    const hues = ['lilac', 'sky', 'butter', 'mint'];
    return h('section', { class: 'stats', 'aria-label': 'At a glance' },
      h('ul', { class: 'wrap stats-grid' }, S.stats.map((s, i) =>
        h('li', { class: 'stat', style: `--hue: var(--${hues[i % hues.length]})` },
          h('p', { class: 'stat-value' }, s.value, s.unit ? h('span', { class: 'stat-unit' }, s.unit) : null),
          h('p', { class: 'stat-label' }, s.label)))));
  }

  // A role's awards, each linked to its citation when there is one.
  const norm = (t) => t.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  function citeLink(c) {
    return h('a', { class: 'cite-link', href: '#' + c.id, 'aria-label': 'Read the citation: ' + c.award }, 'Read the citation');
  }
  function recognition(r) {
    const cites = S.citationsFor ? S.citationsFor(r.id) : [];
    const items = r.awards.map((a) => {
      const c = cites.find((x) => norm(x.award) === norm(a));
      return h('li', {}, icon('rosette'), h('span', {}, a), c ? citeLink(c) : null);
    });
    cites.filter((c) => !r.awards.some((a) => norm(a) === norm(c.award)))
      .forEach((c) => items.push(h('li', {}, icon('rosette'), h('span', {}, c.award), citeLink(c))));
    return items.length ? h('ul', { class: 'awards', 'aria-label': 'Recognition' }, items) : null;
  }

  function buildRole(r, i) {
    const hue = ROLE_HUE[r.id] || 'peach';
    const tags = r.tags.filter((t) => t !== r.org);
    const head = h('header', { class: 'role-head' },
      h('p', { class: 'role-years' }, r.years),
      swashHeading('h3', r.short, hue, 'role-name', r.id + '-title'),
      h('p', { class: 'role-title' }, r.title),
      h('p', { class: 'role-meta' }, [r.org, r.place, r.dates].join(' · ')),
      tags.length ? h('ul', { class: 'role-tags dot-list', 'aria-label': 'Tags' }, tags.map((t) => h('li', {}, t))) : null,
      recognition(r));

    const body = h('div', { class: 'role-body' }, h('p', { class: 'intro' }, r.intro));
    if (r.callout) body.append(h('div', { class: 'callout' }, h('p', { class: 'callout-title' }, r.callout.title), h('p', {}, r.callout.text)));
    r.groups.forEach((g) => body.append(h('div', { class: 'group' },
      g.heading ? h('h4', { class: 'group-title' }, g.heading) : null,
      h('ul', { class: 'dabs' }, g.points.map((p) => h('li', {}, p))))));
    if (r.note) body.append(h('aside', { class: 'note', 'aria-label': r.note.heading }, h('p', { class: 'note-title' }, r.note.heading), h('p', {}, r.note.text)));
    if (r.serviceTimeline) {
      body.append(h('h4', { class: 'mini-title' }, 'Service timeline'),
        h('ol', { class: 'timeline' }, r.serviceTimeline.map((t) => h('li', {}, h('span', { class: 'when' }, t.when), h('span', {}, t.what)))));
    }
    if (r.tools.length) body.append(h('div', { class: 'tools' }, h('h4', { class: 'mini-title' }, 'Tools'), h('ul', { class: 'dot-list' }, r.tools.map((t) => h('li', {}, t)))));

    const ph = r.photo;
    const fig = ph ? h('figure', { class: 'photo role-photo' + (i % 2 ? ' tilt-r' : '') },
      h('div', { class: 'print' }, h('img', { src: ph.src, width: ph.w, height: ph.h, alt: ph.alt, loading: i === 0 ? 'eager' : 'lazy', decoding: 'async' })),
      h('figcaption', {}, ph.caption)) : null;

    return h('section', { class: 'role' + (ph && ph.wide ? ' wide' : ''), id: r.id, style: hueVars(hue), 'aria-labelledby': r.id + '-title' },
      h('div', { class: 'wrap role-grid' }, head, body, fig));
  }

  function buildExperience() {
    return h('section', { class: 'sec', id: 'experience', 'aria-labelledby': 'experience-title', style: hueVars('peach') },
      h('div', { class: 'wrap' }, swashHeading('h2', 'Experience', 'peach', '', 'experience-title')),
      S.roles.map(buildRole));
  }

  function barRow(b) {
    return h('div', { class: 'bar-row' },
      h('span', { class: 'bar-label' }, b.label),
      h('span', { class: 'bar-track', 'data-value': b.value, 'data-max': b.max, 'data-color': b.color, 'aria-hidden': 'true' }),
      h('span', { class: 'bar-num' }, b.num),
      b.text ? h('span', { class: 'bar-text' }, b.text) : null);
  }

  function buildCharts(T) {
    const H = T.headline, B = T.benchmarks, b0 = B[0];
    const vs = b0.value.split(' vs ');
    const size = parseFloat(H.size), src = parseFloat(H.sourceSize);
    const maxD = Math.ceil(Math.max(...B.map((b) => b.delta)) / 5) * 5;
    const plate1 = h('div', { class: 'plate' },
      h('p', { class: 'plate-kicker' }, `${b0.model} · ${b0.task}`),
      h('p', { class: 'plate-value' }, vs.length === 2 ? [vs[0], h('i', {}, 'vs'), vs[1]] : b0.value),
      h('p', { class: 'plate-label' }, 'Score'),
      h('div', { class: 'bars' },
        barRow({ label: T.name, value: H.tak, max: 100, num: H.tak.toFixed(2), color: 'rose' }),
        barRow({ label: H.baselineName, value: H.baseline, max: 100, num: H.baseline.toFixed(2), color: 'pewter' })),
      h('p', { class: 'scale-note' }, 'Score bars run from 0 to 100.'),
      h('p', { class: 'plate-label' }, 'File size'),
      h('div', { class: 'bars' },
        barRow({ label: T.name, value: size, max: src, num: H.size, color: 'rose' }),
        barRow({ label: 'Original', value: src, max: src, num: H.sourceSize, color: 'pewter' })),
      h('p', { class: 'plate-text' }, b0.text));
    const plate2 = h('div', { class: 'plate gains' },
      h('p', { class: 'plate-kicker' }, 'Points over Unsloth'),
      h('div', { class: 'bars' }, B.map((b, i) => barRow({
        label: `${b.model} · ${b.task}`, value: b.delta, max: maxD, num: '+' + b.delta.toFixed(2), color: 'rose',
        text: i ? b.text : b.value,
      }))),
      h('p', { class: 'scale-note' }, `Bars run from 0 to ${maxD} points.`));
    return h('div', { class: 'charts' },
      h('canvas', { class: 'charts-canvas', 'aria-hidden': 'true' }),
      h('div', { class: 'charts-layer', 'aria-hidden': 'true' }),
      plate1, plate2);
  }

  // A pipeline of steps joined by chalk arrows, drawn when it scrolls into view.
  const STEP_HUES = ['rose', 'peach', 'butter', 'mint', 'sky', 'lilac'];
  function pipeline(steps, o) {
    return h('div', { class: 'pipe ' + o.cls, 'data-hue': o.hue },
      h('canvas', { class: 'pipe-canvas', 'aria-hidden': 'true' }),
      h('div', { class: 'pipe-layer', 'aria-hidden': 'true' }),
      h('ol', { class: 'pipe-steps', role: 'list', 'aria-labelledby': o.labelledby || null, 'aria-label': o.label || null },
        steps.map((st, i) => {
          const k = STEP_HUES[((o.offset || 0) + i) % STEP_HUES.length];
          return h('li', { class: 'pipe-step', style: `--node: var(--node-${k}); --node-c: var(--${k})` },
            h('span', { class: 'pipe-node', 'aria-hidden': 'true' }, String(i + 1)),
            h('span', { class: 'pipe-name' }, st.step),
            st.text ? h('span', { class: 'pipe-text' }, st.text) : null);
        })));
  }

  function buildTak() {
    const T = S.tak, A = S.localAI, hf = A.huggingface;
    // The Hugging Face line already links the collection, so its button would repeat it.
    const links = T.links.filter((l) => !hf || l.href !== hf.href);
    return h('article', { class: 'sheet tak', id: T.id, 'aria-labelledby': 'tak-title' },
      h('p', { class: 'kicker' }, T.tag),
      h('div', {}, swashHeading('h3', T.name, 'butter', 'tak-name', 'tak-title')),
      h('p', { class: 'tak-sub' }, T.subtitle),
      h('p', { class: 'tak-desc' }, T.description),
      h('ul', { class: 'tak-stack dot-list', 'aria-label': 'Stack' }, T.stack.map((x) => h('li', {}, x))),
      buildCharts(T),
      h('ul', { class: 'dabs tak-points', style: hueVars('lilac', true) }, T.points.map((x) => h('li', {}, x))),
      h('h4', { class: 'sheet-label', id: 'tak-how' }, 'How TAK works'),
      pipeline(A.takHow, { cls: 'pipe-how', hue: 'butter', labelledby: 'tak-how' }),
      h('h4', { class: 'sheet-label', id: 'tak-extras' }, 'Also in TAK'),
      h('ul', { class: 'dabs tak-points tak-extras', style: hueVars('mint', true), 'aria-labelledby': 'tak-extras' }, A.takExtras.map((x) => h('li', {}, x))),
      h('p', { class: 'lineage' }, A.lineage),
      h('div', { class: 'tak-links' },
        hf ? link(hf.href, hf.label, { cls: 'hf-link' }) : null,
        h('div', { class: 'tak-btns' }, links.map((l) => link(l.href, l.label, { cls: 'btn squish' })), h('span', { class: 'private' }, T.note))));
  }

  const AI_HUES = ['mint', 'lilac', 'sky', 'peach', 'rose'];
  function buildAIProject(p, i, big) {
    const hue = AI_HUES[i % AI_HUES.length];
    const kids = [
      h('p', { class: 'kicker' }, p.tag),
      big ? h('div', {}, swashHeading('h3', p.name, hue, 'ai-name', p.id + '-title'))
        : h('h4', { class: 'ai-name-sm', id: p.id + '-title' }, p.name),
      h('p', { class: 'ai-desc' }, p.description),
    ];
    if (p.workflow && p.workflow.length) kids.push(pipeline(p.workflow.map((w) => ({ step: w })), { cls: 'pipe-flow', hue, label: 'Workflow', offset: 4 }));
    if (p.points && p.points.length) kids.push(h('ul', { class: 'dabs ai-points' }, p.points.map((x) => h('li', {}, x))));
    const foot = [];
    if (p.links.length) foot.push(h('p', { class: 'ai-links' }, p.links.map((l) => link(l.href, l.label))));
    if (p.note) foot.push(h('p', { class: 'private' }, p.note));
    if (foot.length) kids.push(h('div', { class: 'ai-foot' }, foot));
    return h(big ? 'article' : 'li', {
      class: 'sheet ai-proj ' + (big ? 'ai-big' : 'ai-small'), id: p.id, style: hueVars(hue, true), 'aria-labelledby': p.id + '-title',
    }, kids);
  }

  function buildLocalAI() {
    const A = S.localAI;
    // TAK leads; the next two projects get sheets of their own, the rest share a row.
    const big = A.projects.slice(0, 2), small = A.projects.slice(2);
    return h('section', { class: 'sec', id: A.id, 'aria-labelledby': 'ai-title', style: hueVars('mint') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' },
          swashHeading('h2', A.title, 'mint', '', 'ai-title'),
          h('p', { class: 'sec-kicker' }, A.kicker),
          h('p', { class: 'sec-intro' }, A.intro)),
        buildTak(),
        big.length ? h('div', { class: 'ai-pair' }, big.map((p, i) => buildAIProject(p, i, true))) : null,
        small.length ? h('ul', { class: 'ai-more' }, small.map((p, i) => buildAIProject(p, i + 2, false))) : null));
  }

  function buildProjects() {
    const fHues = ['peach', 'sky'];
    const featured = h('div', { class: 'featured' }, S.featured.map((f, i) =>
      h('article', { class: 'card clay squish', id: f.id, style: `--hue: var(--${fHues[i % 2]})`, 'aria-labelledby': f.id + '-title' },
        h('div', { class: 'card-img', style: `--ar: ${f.image.w} / ${f.image.h}` },
          h('img', { src: f.image.src, width: f.image.w, height: f.image.h, alt: f.image.alt, loading: 'lazy', decoding: 'async' })),
        h('div', { class: 'card-body' },
          h('p', { class: 'kicker' }, f.tag),
          h('h3', { class: 'card-name', id: f.id + '-title' }, f.name),
          h('p', { class: 'card-desc' }, f.description),
          f.detail ? h('p', { class: 'card-detail' }, f.detail) : null,
          h('p', { class: 'card-links' }, f.links.map((l) => link(l.href, l.label)))))));

    const mHues = ['lilac', 'rose', 'mint', 'butter', 'sky'];
    const more = h('ul', { class: 'more' }, S.more.map((m, i) =>
      h('li', { class: 'mini squish', id: m.id, style: `--hue: var(--${mHues[i % mHues.length]})` },
        h('p', { class: 'kicker' }, m.tag),
        h('h4', { class: 'mini-name' }, m.name),
        h('p', { class: 'mini-desc' }, m.description),
        m.links.length ? h('p', { class: 'mini-links' }, m.links.map((l) => link(l.href, l.label))) : null,
        m.note ? h('p', { class: 'mini-note' }, m.note) : null)));

    return h('section', { class: 'sec', id: 'projects', 'aria-labelledby': 'projects-title', style: hueVars('rose') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' }, swashHeading('h2', 'Projects', 'rose', '', 'projects-title')),
        featured,
        S.more.length ? [h('h3', { class: 'mini-title more-title' }, 'More projects'), more] : null));
  }

  // ---------- Awards ----------
  function buildCitation(c, open) {
    const fields = [['To', c.recipient], ['Billet', c.billet], ['Period', c.period]];
    return h('article', { class: 'cite', id: c.id, 'aria-labelledby': c.id + '-title' },
      h('header', { class: 'cite-head' },
        h('h4', { class: 'cite-award', id: c.id + '-title' }, c.award),
        c.awardNote ? h('p', { class: 'cite-note' }, c.awardNote) : null,
        c.from ? h('p', { class: 'cite-from' }, h('span', { class: 'cite-k' }, 'From'), ' ', c.from) : null),
      h('dl', { class: 'cite-fields' }, fields.filter((f) => f[1]).map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
      h('details', { class: 'cite-body', open: open || null },
        h('summary', {}, h('span', { class: 'when-closed' }, 'Read the citation'), h('span', { class: 'when-open' }, 'Hide the citation')),
        c.opening ? h('p', { class: 'cite-opening' }, c.opening) : null,
        h('p', { class: 'cite-text' }, c.text)),
      h('footer', { class: 'cite-sign' },
        c.given ? h('p', { class: 'cite-given' }, h('span', { class: 'cite-k' }, 'Given'), ' ', c.given) : null,
        h('div', { class: 'signer' },
          h('span', { class: 'sig-rule', 'aria-hidden': 'true' }),
          c.signer.map((line, k) => h('p', { class: k ? 'signer-line' : 'signer-name' }, line)))));
  }

  function buildAwards() {
    const W = S.awards;
    const wide = matchMedia('(min-width: 1021px)').matches;
    const rows = W.ribbons.map((r) => {
      const rib = h('span', { class: 'ribbon', 'aria-hidden': 'true' });
      if (window.RIBBONS) rib.innerHTML = window.RIBBONS.ribbon(r.id, { device: r.device, title: r.name, width: 112 });
      return h('li', { class: 'ribbon-row' }, rib,
        h('span', { class: 'rb-text' }, h('span', { class: 'rb-name' }, r.name), r.note ? h('span', { class: 'rb-note' }, r.note) : null));
    });
    return h('section', { class: 'sec', id: 'awards', 'aria-labelledby': 'awards-title', style: hueVars('butter') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' }, swashHeading('h2', 'Awards', 'butter', '', 'awards-title')),
        h('h3', { class: 'mini-title', id: 'ribbons-title' }, 'Ribbons, in order of precedence'),
        h('ul', { class: 'ribbons', 'aria-labelledby': 'ribbons-title' }, rows),
        h('h3', { class: 'mini-title cites-title' }, 'Citations'),
        h('div', { class: 'cites' }, W.citations.map((c) => buildCitation(c, wide)))));
  }

  function buildEducation() {
    const E = S.education;
    return h('section', { class: 'sec', id: 'education', 'aria-labelledby': 'education-title', style: hueVars('sky') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' }, swashHeading('h2', 'Education', 'sky', '', 'education-title')),
        h('div', { class: 'edu' },
          h('div', { class: 'edu-main' },
            h('p', { class: 'kicker' }, E.school),
            h('h3', { class: 'edu-degree' }, E.degree),
            h('p', { class: 'edu-details' }, E.details.join(' · ')),
            h('p', { class: 'edu-status' }, E.status)),
          h('ul', { class: 'certs', 'aria-label': 'Certifications' }, E.certs.map((c) =>
            h('li', { class: 'cert clay' }, icon('seal'), h('div', {}, h('p', { class: 'cert-name' }, c.name), h('p', { class: 'cert-date' }, c.date)))))),
        h('div', { class: 'edu-lists' },
          h('div', { style: hueVars('lilac') }, h('h3', { class: 'mini-title' }, 'Coursework'), h('ul', { class: 'dabs' }, E.coursework.map((c) => h('li', {}, c)))),
          h('div', { style: hueVars('mint') }, h('h3', { class: 'mini-title' }, 'Skills'), h('ul', { class: 'dabs skills' }, E.skills.map((c) => h('li', {}, c)))))));
  }

  function buildBook() {
    const B = S.book;
    return h('section', { class: 'sec', id: 'book', 'aria-labelledby': 'book-title', style: hueVars('lilac') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' }, swashHeading('h2', 'Book', 'lilac', '', 'book-title')),
        h('div', { class: 'book' },
          h('figure', { class: 'book-cover photo' },
            h('div', { class: 'print' }, h('img', { src: B.cover.src, width: B.cover.w, height: B.cover.h, alt: B.cover.alt, loading: 'lazy', decoding: 'async' }))),
          h('div', { class: 'book-copy' },
            h('h3', { class: 'book-title' }, B.title),
            h('p', { class: 'book-sub' }, B.subtitle),
            h('p', { class: 'book-formats' }, B.formats.join(' · ')),
            B.rating ? h('p', { class: 'rating' },
              h('span', { class: 'stars', 'aria-hidden': 'true', style: `--fill: ${clamp(B.rating.stars / B.rating.outOf, 0, 1)}` }, h('span', { class: 'stars-on' })),
              h('span', { class: 'rating-label' }, B.rating.label)) : null,
            B.published ? h('p', { class: 'book-pub' }, h('span', { class: 'cite-k' }, 'Published'), ' ', B.published) : null,
            h('p', { class: 'book-text' }, B.text),
            link(B.href, 'View on Amazon', { cls: 'btn btn-butter squish' })))));
  }

  function buildContact() {
    const L = S.links;
    const items = [
      { l: L.resume, sub: 'PDF', hue: 'rose', ico: 'download', download: true },
      { l: L.email, sub: L.email.address, hue: 'butter', ico: 'mail' },
      { l: L.linkedin, sub: L.linkedin.handle, hue: 'sky', ico: 'out' },
      { l: L.github, sub: L.github.handle, hue: 'lilac', ico: 'out' },
      { l: L.huggingface, sub: L.huggingface.handle, hue: 'mint', ico: 'out' },
    ];
    return h('section', { class: 'sec', id: 'contact', 'aria-labelledby': 'contact-title', style: hueVars('butter') },
      h('div', { class: 'wrap' },
        h('div', { class: 'sec-head' }, swashHeading('h2', 'Contact', 'butter', '', 'contact-title')),
        h('div', { class: 'contact-grid' }, items.map((it) => link(it.l.href, [
          h('span', { class: 'c-row' }, h('span', { class: 'c-label' }, it.l.label), icon(it.ico)),
          h('span', { class: 'c-sub' }, it.sub),
        ], { cls: 'contact-card clay squish', download: it.download, icon: false })))));
  }

  function build() {
    buildBar();
    const main = document.getElementById('main');
    main.append(buildHero(), buildStats(), buildExperience(), buildLocalAI(), buildProjects(), buildAwards(), buildEducation(), buildBook(), buildContact());
    // Give each contact card its hue.
    main.querySelectorAll('.contact-card').forEach((a, i) => { a.style.setProperty('--hue', `var(--${['rose', 'butter', 'sky', 'lilac', 'mint'][i]})`); });
    document.getElementById('foot').append(h('div', { class: 'wrap foot-inner' }, h('p', { class: 'foot-tag' }, S.tagline), h('p', {}, S.footer)));
  }

  // ---------- Geometry ----------
  function textLine(el) {
    const rs = el.getClientRects();
    return rs[rs.length - 1];
  }

  // ---------- Heading swashes ----------
  const swashes = [];

  function swashStrokes(sw) {
    const cr = sw.canvas.getBoundingClientRect();
    const line = textLine(sw.el.querySelector('.sh-text'));
    const base = sw.el.querySelector('.probe').getBoundingClientRect().top - cr.top;
    const fs = parseFloat(getComputedStyle(sw.el).fontSize);
    const L = line.left - cr.left, R = line.right - cr.left, w = R - L;
    const vw = document.documentElement.clientWidth;
    const rnd = P.prng(sw.seed);
    const j = (a) => (rnd() - 0.5) * a;
    const hw = clamp(fs * 0.2, 10, 24);
    const maxX = Math.min(cr.width - hw - 6, vw - cr.left - hw - 8);
    const minX = Math.max(hw * 0.6, -cr.left + 6);
    const x0 = Math.max(minX, L - fs * 0.12);
    const out = [P.strokeFrom([
      [x0 + j(6), base + fs * 0.13 + j(3)],
      [L + w * 0.36, base + fs * 0.06 + j(4)],
      [L + w * 0.72, base + fs * 0.1 + j(4)],
      [Math.min(R + fs * 0.3, maxX), base + fs * 0.01 + j(5)],
    ], { color: sw.hue, hw, pressure: 1.16, seed: sw.seed + 1, inPx: 14, outPx: 48 })];
    if (sw.type === 1 && w > fs * 1.2) {
      out.push(P.strokeFrom([
        [Math.min(R + fs * 0.12, maxX), base + fs * 0.17],
        [L + w * 0.58, base + fs * 0.23 + j(3)],
        [Math.max(minX, L + w * 0.2), base + fs * 0.2 + j(3)],
      ], { color: sw.hue, hw: hw * 0.62, pressure: 1.06, seed: sw.seed + 2, inPx: 10, outPx: 54 }));
    }
    return out;
  }

  function renderSwashNow(sw) {
    if (sw.job) { sw.job.cancel(); sw.job = null; }
    sw.surface.measure();
    sw.surface.clear();
    sw.strokes = swashStrokes(sw);
    P.drawNow(sw.surface, sw.strokes);
    sw.surface.release();
    sw.state = 'done';
  }

  function startSwash(sw) {
    const sheet = sw.el.closest('.sheet');
    sw.surface = new P.Surface(sw.canvas, { paperEl: sheet, dark: !!sheet });
    sw.strokes = swashStrokes(sw);
    sw.state = 'drawing';
    const big = sw.el.classList.contains('tak-name');
    const small = sw.el.classList.contains('ai-name');
    P.draw(sw.surface, sw.layer, sw.strokes.map((st) => ({ stroke: st, stick: sw.hue })), {
      stickLen: big ? 130 : small ? 100 : 112, stickDia: big ? 32 : small ? 25 : 28, speed: 900, onJob: (jb) => { sw.job = jb; },
    }).then((jb) => {
      if (sw.job !== jb && jb) return;
      sw.job = null;
      if (sw.state === 'drawing') { sw.state = 'done'; sw.surface.flush(); sw.surface.release(); }
    });
  }

  function setupSwashes() {
    document.querySelectorAll('.sh').forEach((el, i) => {
      swashes.push({
        el, hue: el.dataset.hue, canvas: el.querySelector('.sh-canvas'), layer: el.querySelector('.sh-layer'),
        seed: 1000 + i * 37, type: i % 2, state: 'idle', surface: null, job: null, strokes: null,
      });
    });
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const sw = swashes.find((s) => s.el === en.target);
        if (sw && sw.state === 'idle') startSwash(sw);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.7 });
    swashes.forEach((sw) => io.observe(sw.el));
  }

  // ---------- TAK bars ----------
  const chart = { el: null, canvas: null, layer: null, surface: null, state: 'idle', jobs: [] };

  // Bar strokes, grouped by the stick that draws them: TAK bars, gain bars, and baseline bars.
  function barStrokes() {
    const cr = chart.canvas.getBoundingClientRect();
    const out = { rose: [], gains: [], pewter: [] };
    chart.el.querySelectorAll('.bar-track').forEach((t, i) => {
      const group = t.dataset.color === 'pewter' ? 'pewter' : t.closest('.gains') ? 'gains' : 'rose';
      const r = t.getBoundingClientRect();
      const v = +t.dataset.value, m = +t.dataset.max, color = t.dataset.color;
      const x0 = r.left - cr.left, len = (r.width * v) / m, x1 = x0 + len, yc = r.top - cr.top + r.height / 2;
      const hw = Math.min(11.5, r.height * 0.4);
      const rnd = P.prng(900 + i * 17);
      out[group].push(P.strokeFrom([
        [x0 + 1, yc + 1.2], [x0 + len * 0.5, yc - 1.2 + (rnd() - 0.5) * 2], [x1 - 0.5, yc + 0.4],
      ], { color, hw, pressure: 1.22, seed: 500 + i * 7, inPx: 5, outPx: 8, lift: 0.18, tail: false, crumbs: 0 }));
      if (len > hw * 3) {
        out[group].push(P.strokeFrom([
          [x1 - 1.5, yc + hw * 0.32], [x0 + len * 0.5, yc + hw * 0.22 + (rnd() - 0.5) * 2], [x0 + Math.min(10, len * 0.2), yc - hw * 0.15],
        ], { color, hw: hw * 0.68, pressure: 1.06, seed: 600 + i * 7, inPx: 4, outPx: 34, tail: false, crumbs: 0 }));
      }
    });
    return out;
  }

  function startChart() {
    chart.surface = new P.Surface(chart.canvas, { paperEl: chart.el.closest('.tak'), dark: true });
    const g = barStrokes();
    chart.state = 'drawing';
    const opts = { stickLen: 104, stickDia: 26, speed: 1500, onJob: (j) => chart.jobs.push(j) };
    Promise.all([
      P.draw(chart.surface, chart.layer, g.rose.map((st) => ({ stroke: st, stick: 'rose' })), opts),
      P.draw(chart.surface, chart.layer, g.gains.map((st) => ({ stroke: st, stick: 'rose' })), { ...opts, delay: 240 }),
      P.draw(chart.surface, chart.layer, g.pewter.map((st) => ({ stroke: st, stick: 'pewter' })), { ...opts, delay: 420 }),
    ]).then(() => {
      if (chart.state !== 'drawing') return;
      chart.state = 'done';
      chart.jobs = [];
      chart.surface.flush();
      chart.surface.release();
    });
  }

  function renderChartNow() {
    chart.jobs.forEach((j) => j.cancel());
    chart.jobs = [];
    chart.surface.measure();
    chart.surface.clear();
    const g = barStrokes();
    P.drawNow(chart.surface, [...g.rose, ...g.gains, ...g.pewter]);
    chart.surface.release();
    chart.state = 'done';
  }

  function setupChart() {
    chart.el = document.querySelector('.charts');
    chart.canvas = chart.el.querySelector('.charts-canvas');
    chart.layer = chart.el.querySelector('.charts-layer');
    const io = new IntersectionObserver(([en]) => {
      if (en && en.isIntersecting) { io.disconnect(); startChart(); }
    }, { rootMargin: '0px 0px -24% 0px', threshold: 0 });
    io.observe(chart.el);
  }

  // ---------- Pipelines: chalk arrows between the step nodes ----------
  const pipes = [];

  function pipeStrokes(pp) {
    const cr = pp.canvas.getBoundingClientRect();
    const nodes = [...pp.el.querySelectorAll('.pipe-node')].map((n) => {
      const r = n.getBoundingClientRect();
      return [r.left - cr.left + r.width / 2, r.top - cr.top + r.height / 2, Math.max(r.width, r.height) / 2];
    });
    const out = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const [x0, y0, r0] = nodes[i], [x1, y1, r1] = nodes[i + 1];
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
      const g0 = r0 + 9, g1 = r1 + 8;
      if (d - g0 - g1 < 18) continue;
      const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      const rnd = P.prng(pp.seed + i * 31);
      const ax = x0 + ux * g0, ay = y0 + uy * g0, bx = x1 - ux * g1, by = y1 - uy * g1;
      const bow = (rnd() - 0.5) * Math.min(8, d * 0.05);
      out.push(P.strokeFrom([[ax, ay], [(ax + bx) / 2 + nx * bow, (ay + by) / 2 + ny * bow], [bx, by]],
        { color: pp.hue, hw: 3.4, pressure: 1.14, seed: pp.seed + i * 7, inPx: 6, outPx: 8, tail: false, crumbs: 0.4 }));
      const k = 10;
      out.push(P.strokeFrom([[bx - ux * k + nx * k * 0.8, by - uy * k + ny * k * 0.8], [bx + ux * 1.5, by + uy * 1.5], [bx - ux * k - nx * k * 0.8, by - uy * k - ny * k * 0.8]],
        { color: pp.hue, hw: 3, pressure: 1.12, seed: pp.seed + i * 7 + 3, inPx: 4, outPx: 6, tail: false, crumbs: 0 }));
    }
    return out;
  }

  function startPipe(pp) {
    const sheet = pp.el.closest('.sheet');
    pp.surface = new P.Surface(pp.canvas, { paperEl: sheet, dark: !!sheet });
    pp.state = 'drawing';
    P.draw(pp.surface, pp.layer, pipeStrokes(pp).map((st) => ({ stroke: st, stick: pp.hue })), {
      stickLen: 96, stickDia: 24, speed: 1100, onJob: (j) => { pp.job = j; },
    }).then((j) => {
      if (pp.job !== j && j) return;
      pp.job = null;
      if (pp.state === 'drawing') { pp.state = 'done'; pp.surface.flush(); pp.surface.release(); }
    });
  }

  function renderPipeNow(pp) {
    if (pp.job) { pp.job.cancel(); pp.job = null; }
    pp.surface.measure();
    pp.surface.clear();
    P.drawNow(pp.surface, pipeStrokes(pp));
    pp.surface.release();
    pp.state = 'done';
  }

  function setupPipes() {
    document.querySelectorAll('.pipe').forEach((el, i) => {
      pipes.push({ el, hue: el.dataset.hue, canvas: el.querySelector('.pipe-canvas'), layer: el.querySelector('.pipe-layer'), seed: 7000 + i * 101, state: 'idle', surface: null, job: null });
    });
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const pp = pipes.find((x) => x.el === en.target);
        if (pp && pp.state === 'idle') startPipe(pp);
      }
    }, { rootMargin: '0px 0px -22% 0px', threshold: 0 });
    pipes.forEach((pp) => io.observe(pp.el));
  }

  // ---------- Small marks, drawn once by the engine and used as CSS images ----------
  function starPoints(cx, cy, R, r) {
    const v = [];
    for (let j = 0; j < 10; j++) {
      const a = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? r : R;
      v.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return v;
  }

  async function makeMarks() {
    const root = document.documentElement.style;
    const set = (name) => (u) => root.setProperty(name, `url("${u}")`);
    const jobs = [];
    // Pipeline nodes: a tight spiral of pastel reads as a filled chalk disc.
    STEP_HUES.forEach((k, i) => {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 44) {
        const a = t * Math.PI * 2 * 2.4 + i * 1.3, r = 2.5 + 10.5 * t;
        pts.push([20 + Math.cos(a) * r, 20 + Math.sin(a) * r * 0.94]);
      }
      const st = P.strokeFrom(pts, { color: k, hw: 4.6, pressure: 1.25, seed: 300 + i * 17, inPx: 4, outPx: 8, lift: 0.2, crumbs: 0.25, tail: false });
      jobs.push(P.markURL([st], { width: 40, height: 40, dark: true }).then(set(`--node-${k}`)));
    });
    // Rating stars: five outlines, and the same five filled, for a partial fill by width.
    const cell = 32, R = 13, r = 5.4;
    const outline = [], filled = [];
    for (let i = 0; i < 5; i++) {
      const cx = cell * i + cell / 2, cy = cell / 2 + 1;
      const v = starPoints(cx, cy, R, r);
      const ring = [];
      for (let j = 0; j <= 10; j++) {
        const a = v[j % 10], b = v[(j + 1) % 10];
        ring.push(a, [a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5]);
      }
      const o1 = { hw: 1.35, pressure: 1.2, seed: 5200 + i * 13, inPx: 3, outPx: 4, tail: false, crumbs: 0 };
      outline.push(P.strokeFrom(ring, { ...o1, color: 'pewter' }));
      for (let j = 0; j < 5; j++) {
        const tip = v[j * 2];
        filled.push(P.strokeFrom([[cx, cy], [cx + (tip[0] - cx) * 0.55, cy + (tip[1] - cy) * 0.55], [cx + (tip[0] - cx) * 0.9, cy + (tip[1] - cy) * 0.9]],
          { color: 'butter', hw: 2.7, pressure: 1.3, seed: 5300 + i * 31 + j, inPx: 2, outPx: 7, lift: 0.4, tail: false, crumbs: 0 }));
      }
      filled.push(P.strokeFrom([[cx - 2.2, cy + 0.6], [cx + 2.4, cy - 0.4]], { color: 'butter', hw: 4.4, pressure: 1.3, seed: 5400 + i, inPx: 1, outPx: 1, lift: 0, tail: false, crumbs: 0 }));
      filled.push(P.strokeFrom(ring, { ...o1, color: 'peach', seed: 5500 + i * 13 }));
    }
    jobs.push(P.markURL(outline, { width: cell * 5, height: cell }).then(set('--stars-empty')));
    jobs.push(P.markURL(filled, { width: cell * 5, height: cell }).then(set('--stars-full')));
    // A chalk rule for each citation's signature line.
    const rule = P.strokeFrom([[6, 9], [80, 7.6], [160, 8.8], [214, 7.4]], { color: 'pewter', hw: 2.2, pressure: 1.15, seed: 4100, inPx: 10, outPx: 26, crumbs: 0.3 });
    jobs.push(P.markURL([rule], { width: 220, height: 16 }).then(set('--sig-rule')));
    await Promise.all(jobs);
  }

  // ---------- Citations open when a link or the address points at them ----------
  function openCitation(id) {
    const el = id && document.getElementById(id);
    const d = el && el.classList.contains('cite') ? el.querySelector('details.cite-body') : null;
    if (d && !d.open) d.open = true;
  }

  // ---------- Hero: name swash and the pastel box ----------
  const hero = { el: null, canvas: null, layer: null, pad: null, surface: null, name: [], user: [], job: null, color: TRAY[0][0] };

  function nameStrokes() {
    const cr = hero.canvas.getBoundingClientRect();
    const line = hero.el.querySelector('.n2');
    const lr = line.getBoundingClientRect();
    const base = line.querySelector('.probe').getBoundingClientRect().top - cr.top;
    const fs = parseFloat(getComputedStyle(hero.el.querySelector('.name')).fontSize);
    const L = lr.left - cr.left, R = lr.right - cr.left, w = R - L;
    const vw = document.documentElement.clientWidth;
    const hw1 = clamp(fs * 0.155, 12, 26), hw2 = clamp(fs * 0.1, 8, 17);
    const maxX = Math.min(cr.width - 10, vw - cr.left - 10);
    const x0 = Math.max(hw1, L - fs * 0.08);
    return [
      P.strokeFrom([
        [x0, base + fs * 0.14], [L + w * 0.3, base + fs * 0.06], [L + w * 0.68, base + fs * 0.1],
        [Math.min(R + fs * 0.32, maxX - hw1), base - fs * 0.03],
      ], { color: 'peach', hw: hw1, pressure: 1.2, seed: 1201, inPx: 20, outPx: 60 }),
      P.strokeFrom([
        [Math.min(R + fs * 0.16, maxX - hw2), base + fs * 0.12], [L + w * 0.64, base + fs * 0.22],
        [L + w * 0.24, base + fs * 0.2], [Math.max(hw2, L + w * 0.04), base + fs * 0.24],
      ], { color: 'rose', hw: hw2, pressure: 1.08, seed: 1202, inPx: 12, outPx: 70 }),
    ];
  }

  function redrawHero() {
    if (hero.job) { hero.job.cancel(); hero.job = null; }
    hero.surface.measure();
    hero.surface.clear();
    hero.name = nameStrokes();
    P.drawNow(hero.surface, [...hero.name, ...hero.user]);
  }

  // A stroke built live from pointer input: centripetal Catmull-Rom through the input points,
  // resampled every 2.5 px, with pressure from the pen or from drawing speed.
  class Live {
    constructor(color, hw, x, y, p, t) {
      this.st = new P.Stroke({ color, hw, seed: (Math.random() * 1e9) >>> 0 });
      this.pts = [[x, y, p]];
      this.last = [x, y, p];
      this.carry = 0;
      this.t = t;
      this.vs = 0.4;
      this.st.add(x, y, this.ramp(p));
    }
    ramp(p) { return p * (0.42 + 0.58 * Math.min(1, this.st.length / 16)); }
    pressure(e, x, y) {
      if (e.pointerType === 'pen' && e.pressure > 0) return 0.5 + e.pressure * 0.8;
      const q = this.pts[this.pts.length - 1];
      const dt = Math.max(4, e.timeStamp - this.t);
      const v = Math.hypot(x - q[0], y - q[1]) / dt;
      this.vs = this.vs * 0.75 + v * 0.25;
      return clamp(1.32 - this.vs * 0.22, 0.85, 1.28);
    }
    push(x, y, e) {
      const q = this.pts[this.pts.length - 1];
      if (Math.hypot(x - q[0], y - q[1]) < 1.6) return;
      const p = this.pressure(e, x, y);
      this.t = e.timeStamp;
      this.pts.push([x, y, p]);
      if (this.pts.length >= 3) this.emit(this.pts.length - 3);
    }
    emit(i) {
      const A = this.pts, p1 = A[i], p2 = A[i + 1];
      const p0 = A[i - 1] || [2 * p1[0] - p2[0], 2 * p1[1] - p2[1], p1[2]];
      const p3 = A[i + 2] || [2 * p2[0] - p1[0], 2 * p2[1] - p1[1], p2[2]];
      const tj = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1e-6;
      const t0 = 0, t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
      const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
      for (let s = 1; s <= steps; s++) {
        const t = t1 + ((t2 - t1) * s) / steps;
        const m = (a, b, ta, tb) => { const k = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
        const A1 = m(p0, p1, t0, t1), A2 = m(p1, p2, t1, t2), A3 = m(p2, p3, t2, t3);
        const B1 = m(A1, A2, t0, t2), B2 = m(A2, A3, t1, t3);
        const C = m(B1, B2, t1, t2);
        this.feed(C[0], C[1], p1[2] + ((p2[2] - p1[2]) * s) / steps);
      }
    }
    feed(x, y, p) {
      const [lx, ly, lp] = this.last;
      const seg = Math.hypot(x - lx, y - ly), SP = 2.5;
      let d = SP - this.carry;
      while (d <= seg) {
        const k = d / seg;
        this.st.add(lx + (x - lx) * k, ly + (y - ly) * k, this.ramp(lp + (p - lp) * k));
        d += SP;
      }
      this.carry = seg - (d - SP);
      this.last = [x, y, p];
    }
    end() {
      if (this.pts.length >= 2) this.emit(this.pts.length - 2);
      if (this.st.n < 2) { const [x, y, p] = this.last; this.st.add(x + 1.4, y + 0.5, this.ramp(p)); }
      this.st.finish(true);
    }
  }

  function doodlePath(b, rnd) {
    const pts = [];
    const x0 = b.x + 30, x1 = b.x + b.w - 30, span = x1 - x0;
    const cy = b.y + b.h * (0.52 + (rnd() - 0.5) * 0.12);
    const kind = (rnd() * 3) | 0;
    if (kind === 0) {
      const loops = 3 + ((rnd() * 2) | 0), r = Math.min(b.h * 0.2, 34), n = loops * 12;
      const k = (span - 2 * r) / (loops * Math.PI * 2);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * loops * Math.PI * 2;
        pts.push([x0 + r + k * a + r * Math.sin(a) * 0.95, cy - r * Math.cos(a) * 0.9]);
      }
    } else if (kind === 1) {
      const A = Math.min(b.h * 0.22, 36), f = 1.5 + rnd() * 1.2, n = 28;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + t * span, cy + A * Math.sin(t * f * Math.PI * 2 + rnd() * 0.2)]); }
    } else {
      const A = Math.min(b.h * 0.24, 40), n = 6 + ((rnd() * 3) | 0);
      for (let i = 0; i <= n; i++) pts.push([x0 + (i / n) * span + (rnd() - 0.5) * 8, cy + (i % 2 ? A : -A) + (rnd() - 0.5) * 10]);
    }
    return pts;
  }

  function setupHero() {
    hero.el = document.querySelector('.hero');
    hero.canvas = hero.el.querySelector('.hero-canvas');
    hero.layer = hero.el.querySelector('.hero-layer');
    hero.pad = hero.el.querySelector('.pad');
    hero.surface = new P.Surface(hero.canvas, { maxPixels: 3.0e6 });
    const coarse = matchMedia('(pointer: coarse)').matches;
    const HW = coarse ? 12 : 13.5;
    const REST = -2.25;
    let live = null, hand = null, handA = REST, handVisible = false;
    const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

    // Name swash: a peach stick, then a rose stick, scribble under the name.
    hero.name = nameStrokes();
    // Size the stick to the name, so it stays in proportion on a phone.
    const nameLen = clamp(parseFloat(getComputedStyle(document.getElementById('hero-name')).fontSize), 100, 150);
    P.draw(hero.surface, hero.layer, hero.name.map((st, i) => ({ stroke: st, stick: i ? 'rose' : 'peach' })), {
      stickLen: nameLen, stickDia: nameLen * 0.24, speed: 860, delay: 200, onJob: (j) => { hero.job = j; },
    }).then((j) => { if (hero.job === j) hero.job = null; });

    const local = (e) => {
      const r = hero.canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const ensureHand = () => {
      if (!hand || hand.key !== hero.color) {
        if (hand) hand.remove();
        hand = new P.Stick(hero.layer, hero.color, { len: 136, dia: 34 });
        hand.set(0, 0, handA, 0.6, 0);
      }
    };
    const showHand = (x, y, lift, a) => {
      ensureHand();
      if (a != null) handA = a;
      hand.set(x, y, handA, lift, 1);
      handVisible = true;
    };
    const hideHand = () => {
      if (hand && handVisible) { hand.set(hand.x, hand.y, handA, 0.8, 0); handVisible = false; }
    };

    const liveTask = () => {
      if (!live) return false;
      hero.surface.advance(live.st, live.st.n - 2);
      return true;
    };

    hero.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const onPad = !!e.target.closest('.pad');
      if (e.pointerType === 'touch' ? !onPad : !(onPad || e.target === hero.el)) return;
      e.preventDefault();
      try { hero.el.setPointerCapture(e.pointerId); } catch (err) { /* capture is best effort */ }
      const [x, y] = local(e);
      live = new Live(hero.color, HW, x, y, e.pointerType === 'pen' && e.pressure > 0 ? 0.5 + e.pressure * 0.8 : 1.05, e.timeStamp);
      live.id = e.pointerId;
      hero.pad.classList.add('used');
      showHand(x, y, 0);
      P.addTask(liveTask);
    });

    hero.el.addEventListener('pointermove', (e) => {
      if (live && e.pointerId === live.id) {
        const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        for (const ev of evs.length ? evs : [e]) {
          const [x, y] = local(ev);
          live.push(x, y, ev);
        }
        const st = live.st, n = st.n;
        if (n >= 3) {
          const mv = Math.atan2(st.y[n - 1] - st.y[n - 3], st.x[n - 1] - st.x[n - 3]);
          handA += angDiff(handA, handA + angDiff(handA, mv + 0.62) * 0.35 + angDiff(handA, REST) * 0.25) * 0.25;
        }
        const [x, y] = local(e);
        showHand(x, y, 0);
        return;
      }
      if (e.pointerType === 'touch') return;
      const can = e.target === hero.el || !!e.target.closest('.pad');
      hero.el.classList.toggle('can-draw', can);
      if (can) {
        const [x, y] = local(e);
        handA += angDiff(handA, REST) * 0.2;
        showHand(x, y, 0.55);
      } else hideHand();
    });

    const endLive = (e) => {
      if (!live || e.pointerId !== live.id) return;
      live.end();
      hero.surface.finishStroke(live.st);
      hero.user.push(live.st);
      live = null;
      P.kick();
      if (e.pointerType === 'touch') hideHand();
      else { const [x, y] = local(e); showHand(x, y, 0.55); }
    };
    hero.el.addEventListener('pointerup', endLive);
    hero.el.addEventListener('pointercancel', endLive);
    hero.el.addEventListener('pointerleave', (e) => {
      if (live) return;
      hero.el.classList.remove('can-draw');
      if (e.pointerType !== 'touch') hideHand();
    });

    // Tray: a radio group of sticks.
    const tray = hero.el.querySelector('.tray');
    const sticks = [...tray.querySelectorAll('.tstick')];
    const select = (btn, focus) => {
      sticks.forEach((b) => { const on = b === btn; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      hero.color = btn.dataset.color;
      if (focus) btn.focus();
    };
    tray.addEventListener('click', (e) => { const b = e.target.closest('.tstick'); if (b) select(b); });
    tray.addEventListener('keydown', (e) => {
      const i = sticks.indexOf(document.activeElement);
      if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % sticks.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + sticks.length) % sticks.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = sticks.length - 1;
      if (j != null) { e.preventDefault(); select(sticks[j], true); }
    });

    // Doodle for me: the chosen stick draws a flourish on the taped sheet.
    let doodles = 0;
    document.getElementById('doodle').addEventListener('click', () => {
      const pr = hero.pad.getBoundingClientRect(), cr = hero.canvas.getBoundingClientRect();
      const rnd = P.prng(4242 + doodles * 7919 + ((Math.random() * 1e6) | 0));
      doodles++;
      const box = { x: pr.left - cr.left, y: pr.top - cr.top, w: pr.width, h: pr.height };
      const st = P.strokeFrom(doodlePath(box, rnd), { color: hero.color, hw: HW, pressure: 1.12, seed: (rnd() * 1e9) >>> 0, inPx: 14, outPx: 40 });
      hero.pad.classList.add('used');
      hero.user.push(st);
      P.draw(hero.surface, hero.layer, [{ stroke: st, stick: hero.color }], { stickLen: 136, stickDia: 34, speed: 640 });
    });

    // Clean the paper: wipe the user's marks; the name swash stays.
    document.getElementById('clean').addEventListener('click', () => {
      hero.user.length = 0;
      live = null;
      const finish = () => {
        redrawHero();
        hero.canvas.style.opacity = '1';
        hero.pad.classList.remove('used');
      };
      if (reduced) { finish(); return; }
      hero.canvas.style.transition = 'opacity .3s ease';
      hero.canvas.style.opacity = '0';
      setTimeout(finish, 320);
    });
  }

  // ---------- Hash links, fonts, resizes ----------
  let userScrolled = false;
  ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, () => { userScrolled = true; }, { passive: true, once: true }));

  function goToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    openCitation(id);
    const html = document.documentElement, prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    el.scrollIntoView({ block: 'start' });
    html.style.scrollBehavior = prev;
  }

  function fontsReady(ms) {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, ms))]);
  }

  let lastW = 0, lastDpr = 0;
  function relayout(force) {
    const w = document.documentElement.clientWidth, dpr = window.devicePixelRatio || 1;
    if (!force && w === lastW && dpr === lastDpr) return;
    lastW = w; lastDpr = dpr;
    if (hero.surface) redrawHero();
    swashes.forEach((sw) => { if (sw.state !== 'idle') renderSwashNow(sw); });
    if (chart.state !== 'idle') renderChartNow();
    pipes.forEach((pp) => { if (pp.state !== 'idle') renderPipeNow(pp); });
  }
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  async function start() {
    build();
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) openCitation(decodeURIComponent(a.hash.slice(1)));
    });
    addEventListener('hashchange', () => openCitation(decodeURIComponent(location.hash.slice(1))));
    goToHash();
    // Let the page paint once on flat paper before the tooth is generated.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const paper = P.init();
    await Promise.all([paper, fontsReady(2500)]);
    if (!userScrolled) goToHash();
    lastW = document.documentElement.clientWidth;
    lastDpr = window.devicePixelRatio || 1;
    makeMarks();
    setupHero();
    setupSwashes();
    setupChart();
    setupPipes();
    addEventListener('resize', debounce(() => relayout(false), 180));
    if (document.fonts) document.fonts.addEventListener('loadingdone', debounce(() => relayout(true), 120));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
