// Charts for the Space theme: the hero trajectory plot (in the manner of the
// Voyager Grand Tour diagrams) and a small orthographic globe for coordinates.
window.Charts = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const D2R = Math.PI / 180;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function decYear(s) {
    const p = String(s).split('-').map(Number);
    return p[0] + (p[1] ? (p[1] - 1) / 12 : 0);
  }
  function fmtDate(s) {
    const p = String(s).split('-');
    return p[1] ? MONTHS[Number(p[1]) - 1] + ' ' + p[0] : p[0];
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  // ---------------------------------------------------------------- trajectory
  // opts: { milestones: [{ date, label, ref, target }], projection, readout, log, ariaLabel }
  function trajectory(host, opts) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ms = opts.milestones.map((m, i) => Object.assign({ i: i, t: decYear(m.date), when: fmtDate(m.date) }, m));
    const T0 = ms[0].t, T1 = ms[ms.length - 1].t, SPAN = Math.max(0.01, T1 - T0);
    ms.forEach((m) => { m.u = (m.t - T0) / SPAN; });
    const LAST = ms.length - 1;
    const EXT = 0.15; // projected path beyond the latest waypoint, as a fraction of the span

    let U = reduce.matches ? 1 : 0;
    let flown = reduce.matches, flying = false;
    let hover = -1, passed = -1;
    let geo = null, svg = null, probe = null, flownPath = null, wpEls = [], logEls = [];
    let lastW = 0, lastH = 0, rendered = false;

    // Spiral in abstract units around a center at the origin.
    function spiral(g, u) {
      const r = g.a + g.b * u;
      const f = (g.rot + g.p0 + (g.p1 - g.p0) * u) * D2R;
      return [r * Math.cos(f), r * Math.sin(f)];
    }

    function layout(W, H, small) {
      const m = small ? { l: 22, r: 22, t: 44, b: 40 } : { l: 34, r: 40, t: 70, b: 70 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const g = { a: 1, b: small ? 2.05 : 1.9, p0: small ? 46 : 40, p1: small ? -40 : -30, rot: 0 };
      // Orient the spiral so its chord runs along the box diagonal.
      const s0 = spiral(g, 0), s1 = spiral(g, 1 + EXT);
      const chord = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) / D2R;
      const want = -Math.atan2(ih, iw) / D2R * (small ? 0.9 : 0.94);
      g.rot = want - chord;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k <= 200; k++) {
        const p = spiral(g, (k / 200) * (1 + EXT));
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const sc = Math.min(iw / (x1 - x0), ih / (y1 - y0));
      const ox = m.l + (iw - (x1 - x0) * sc) / 2 - x0 * sc;
      const oy = m.t + (ih - (y1 - y0) * sc) / 2 - y0 * sc;
      const P = (u) => { const p = spiral(g, u); return [ox + p[0] * sc, oy + p[1] * sc]; };
      const tangent = (u) => {
        const a = P(u - 0.002), b = P(u + 0.002);
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      };
      const radius = (u) => (g.a + g.b * u) * sc;
      return { W: W, H: H, small: small, g: g, sc: sc, ox: ox, oy: oy, P: P, tangent: tangent, radius: radius };
    }

    function render() {
      const W = Math.round(host.clientWidth), H = Math.round(host.clientHeight);
      if (W < 40 || H < 40) return;
      lastW = W; lastH = H;
      const small = W < 560;
      const hasReadout = !!(opts.readout && window.getComputedStyle(opts.readout).display !== 'none');
      geo = layout(W, H, small);
      const G = geo;
      const fs = small ? 9.5 : 10.5;

      svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'traj', role: 'group', 'aria-label': opts.ariaLabel || 'Career trajectory' });
      const defs = el('defs', null, svg);
      const clipId = 'traj-clip';
      const cp = el('clipPath', { id: clipId }, defs);
      el('rect', { x: 0, y: 0, width: W, height: H }, cp);

      // Figure corners.
      const cl = small ? 10 : 16;
      el('path', {
        class: 'traj-corner',
        d: 'M.5 ' + cl + 'V.5H' + cl + 'M' + (W - cl) + ' .5H' + (W - 0.5) + 'V' + cl +
          'M' + (W - 0.5) + ' ' + (H - cl) + 'V' + (H - 0.5) + 'H' + (W - cl) + 'M' + cl + ' ' + (H - 0.5) + 'H.5V' + (H - cl),
      }, svg);

      // Orbits: one circle per waypoint, centered on the off-frame primary.
      const orbits = el('g', { class: 'traj-orbits', 'clip-path': 'url(#' + clipId + ')' }, svg);
      ms.forEach((m) => {
        el('circle', { cx: f1(G.ox), cy: f1(G.oy), r: f1(G.radius(m.u)), class: 'traj-orbit' + (m.i === LAST ? ' is-last' : ''), style: '--i:' + m.i }, orbits);
      });

      // Path samples and cumulative lengths for the flown trail.
      const N = 260;
      const pts = [];
      for (let k = 0; k <= N; k++) pts.push(G.P(k / N));
      const cum = [0];
      for (let k = 1; k <= N; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const total = cum[N];
      G.lenAt = (u) => {
        const x = Math.max(0, Math.min(1, u)) * N, k = Math.floor(x);
        if (k >= N) return total;
        return cum[k] + (cum[k + 1] - cum[k]) * (x - k);
      };
      G.total = total;
      const d = 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L');

      // Projected path past the latest waypoint.
      const ext = [];
      for (let k = 0; k <= 40; k++) ext.push(G.P(1 + (k / 40) * EXT));
      el('path', { class: 'traj-proj', d: 'M' + ext.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') }, svg);
      const tip = ext[ext.length - 1], tt = G.tangent(1 + EXT);
      const ah = small ? 6 : 8;
      el('path', {
        class: 'traj-arrow',
        d: 'M' + f1(tip[0] - tt[0] * ah - tt[1] * ah * 0.55) + ' ' + f1(tip[1] - tt[1] * ah + tt[0] * ah * 0.55) +
          'L' + f1(tip[0]) + ' ' + f1(tip[1]) +
          'L' + f1(tip[0] - tt[0] * ah + tt[1] * ah * 0.55) + ' ' + f1(tip[1] - tt[1] * ah - tt[0] * ah * 0.55),
      }, svg);

      el('path', { class: 'traj-plan', d: d }, svg);
      flownPath = el('path', { class: 'traj-flown', d: d, 'stroke-dasharray': f1(total) + ' ' + f1(total + 10) }, svg);

      // Year ticks at one-year intervals.
      let ticks = '';
      for (let y = Math.floor(T0) + 1; y <= T1; y++) {
        const u = (y - T0) / SPAN;
        const p = G.P(u), t = G.tangent(u), n = [-t[1], t[0]], L = small ? 3.5 : 4.5;
        ticks += 'M' + f1(p[0] - n[0] * L) + ' ' + f1(p[1] - n[1] * L) + 'L' + f1(p[0] + n[0] * L) + ' ' + f1(p[1] + n[1] * L);
      }
      el('path', { class: 'traj-ticks', d: ticks }, svg);

      // Labels: place each date on whichever side of the path is clear.
      const placed = [];
      if (hasReadout) placed.push({ x1: 0, y1: 0, x2: Math.min(300, W * 0.42), y2: small ? 150 : 132 });
      else placed.push({ x1: 0, y1: 0, x2: 170, y2: 72 });
      ms.forEach((m) => {
        const p = G.P(m.u);
        m.X = p[0]; m.Y = p[1];
        placed.push({ x1: p[0] - 8, y1: p[1] - 8, x2: p[0] + 8, y2: p[1] + 8 });
      });
      const cw = fs * 0.6; // IBM Plex Mono advance
      function box(x, y, anchor, w, h) {
        const x1 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        return { x1: x1 - 2, y1: y - h + 1, x2: x1 + w + 2, y2: y + 3 };
      }
      function free(b) {
        if (b.x1 < 2 || b.x2 > W - 2 || b.y1 < 2 || b.y2 > H - 2) return false;
        for (let k = 0; k < placed.length; k++) {
          const q = placed[k];
          if (!(b.x2 < q.x1 || b.x1 > q.x2 || b.y2 < q.y1 || b.y1 > q.y2)) return false;
        }
        return true;
      }
      function hitsPath(b) {
        for (let k = 0; k <= N; k += 2) {
          const q = pts[k];
          if (q[0] > b.x1 && q[0] < b.x2 && q[1] > b.y1 && q[1] < b.y2) return true;
        }
        return false;
      }
      function place(m, lines) {
        const t = G.tangent(m.u), n = [-t[1], t[0]];
        const w = Math.max.apply(null, lines.map((s) => s.length)) * cw;
        const h = lines.length * (fs + 3);
        const tries = [[1, 13], [-1, 13], [1, 22], [-1, 22], [1, 34], [-1, 34]];
        let best = null;
        for (let k = 0; k < tries.length && !best; k++) {
          const s = tries[k][0], dist = tries[k][1];
          const nx = n[0] * s, ny = n[1] * s;
          const anchor = nx > 0.38 ? 'start' : nx < -0.38 ? 'end' : 'middle';
          const x = m.X + nx * dist;
          let y = m.Y + ny * dist + (ny > 0.38 ? fs : ny < -0.38 ? -h + fs : fs * 0.35 - (h - fs) / 2);
          const b = box(x, y + (lines.length - 1) * (fs + 3), anchor, w, h);
          if (free(b) && !hitsPath(b)) best = { x: x, y: y, anchor: anchor, b: b };
        }
        if (!best) {
          const anchor = n[0] > 0 ? 'start' : 'end';
          const x = m.X + n[0] * 13, y = m.Y + n[1] * 13 + fs * 0.35;
          best = { x: x, y: y, anchor: anchor, b: box(x, y, anchor, w, h) };
        }
        placed.push(best.b);
        return best;
      }

      // Waypoints.
      const layer = el('g', { class: 'traj-wps' }, svg);
      wpEls = ms.map((m) => {
        const a = el('a', {
          class: 'wp' + (m.i === 0 ? ' wp-origin' : '') + (m.i === LAST ? ' wp-last' : ''),
          href: '#' + m.ref,
          'data-i': m.i,
          'aria-label': m.when + ': ' + m.label + (m.target ? '. Opens ' + m.target + '.' : ''),
        }, layer);
        el('circle', { class: 'wp-hit', cx: f1(m.X), cy: f1(m.Y), r: small ? 13 : 15 }, a);
        el('circle', { class: 'wp-ring', cx: f1(m.X), cy: f1(m.Y), r: m.i === 0 ? 8.5 : 6.5 }, a);
        el('circle', { class: 'wp-dot', cx: f1(m.X), cy: f1(m.Y), r: m.i === 0 ? 3.6 : 2.6 }, a);
        const lines = m.i === 0 ? [m.when.toUpperCase(), 'ORIGIN'] : [m.when.toUpperCase()];
        const L = place(m, lines);
        const tx = el('text', { class: 'wp-label', x: f1(L.x), y: f1(L.y), 'text-anchor': L.anchor, 'font-size': fs }, a);
        lines.forEach((s, k) => {
          const ts = el('tspan', { x: f1(L.x), dy: k ? fs + 3 : 0, class: k ? 'wp-sub' : '' }, tx);
          ts.textContent = s;
        });
        return a;
      });

      // Projection label, beside the arrow.
      if (opts.projection) {
        const text = String(opts.projection).toUpperCase();
        const lw = text.length * fs * 0.66;
        let anchor = 'start', x = tip[0] + 10, y = tip[1] + 4;
        if (x + lw > W - 4) { anchor = 'end'; x = tip[0] - 6; y = tip[1] - 10; }
        if (y < fs + 4) { y = tip[1] + fs + 8; }
        const pl = el('text', { class: 'traj-proj-label', x: f1(x), y: f1(y), 'text-anchor': anchor, 'font-size': fs }, svg);
        pl.textContent = text;
      }

      // Figure caption: bottom right on wide plots, top left on phones.
      const span = ms[0].when.toUpperCase() + ' TO ' + ms[LAST].when.toUpperCase();
      if (hasReadout) {
        const cap = el('text', { class: 'traj-cap', x: W - 18, y: H - 18, 'text-anchor': 'end' }, svg);
        const a1 = el('tspan', { class: 'traj-cap-k' }, cap);
        a1.textContent = 'FIG. 1  ';
        const a2 = el('tspan', null, cap);
        a2.textContent = small ? 'TICKS AT 1-YEAR INTERVALS' : 'CAREER TRAJECTORY, ' + span + ' · TICKS AT 1-YEAR INTERVALS';
      } else {
        const cap = el('text', { class: 'traj-cap', x: 14, y: 26 }, svg);
        const a1 = el('tspan', { class: 'traj-cap-k', x: 14 }, cap);
        a1.textContent = 'FIG. 1';
        const a2 = el('tspan', { x: 14, dy: 15 }, cap);
        a2.textContent = 'CAREER TRAJECTORY';
        const a3 = el('tspan', { x: 14, dy: 13 }, cap);
        a3.textContent = span;
        const a4 = el('tspan', { x: 14, dy: 13 }, cap);
        a4.textContent = 'TICKS AT 1-YEAR INTERVALS';
      }

      // Probe.
      probe = el('g', { class: 'probe', 'aria-hidden': 'true' }, svg);
      el('circle', { class: 'probe-ring', r: small ? 7 : 9 }, probe);
      el('path', { class: 'probe-head', d: 'M0 0L' + (small ? 13 : 17) + ' 0' }, probe);
      el('circle', { class: 'probe-core', r: small ? 3 : 3.6 }, probe);

      if (!rendered && !reduce.matches) svg.classList.add('is-intro');
      rendered = true;
      host.textContent = '';
      host.appendChild(svg);
      bind();
      setU(U, true);
    }

    function bind() {
      wpEls.forEach((a) => {
        const i = Number(a.getAttribute('data-i'));
        a.addEventListener('pointerenter', () => { hover = i; paint(); });
        a.addEventListener('pointerleave', () => { if (hover === i) { hover = -1; paint(); } });
        a.addEventListener('focus', () => { hover = i; paint(); });
        a.addEventListener('blur', () => { if (hover === i) { hover = -1; paint(); } });
      });
      const narrow = geo && geo.small && opts.log && opts.log.offsetParent !== null;
      // On phones the flight log below the plot carries the same links.
      if (narrow) {
        svg.setAttribute('aria-hidden', 'true');
        wpEls.forEach((a) => a.setAttribute('tabindex', '-1'));
      }
    }

    function setU(u, force) {
      U = u;
      if (!geo || !probe) return;
      const p = geo.P(U), t = geo.tangent(Math.max(0.001, Math.min(0.999, U)));
      const ang = Math.atan2(t[1], t[0]) / D2R;
      probe.setAttribute('transform', 'translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') rotate(' + ang.toFixed(1) + ')');
      flownPath.setAttribute('stroke-dashoffset', f1(geo.total - geo.lenAt(U)));
      let k = -1;
      for (let i = 0; i < ms.length; i++) if (ms[i].u <= U + 1e-6) k = i;
      if (k !== passed || force) { passed = k; paint(); }
    }

    function paint() {
      wpEls.forEach((a, i) => {
        a.classList.toggle('is-passed', i <= passed);
        a.classList.toggle('is-active', i === (hover >= 0 ? hover : passed));
        a.classList.toggle('is-rest', !flying && i === LAST && U >= 1);
      });
      if (logEls.length) logEls.forEach((li, i) => {
        li.classList.toggle('is-passed', i <= passed);
        li.classList.toggle('is-active', i === passed && flying);
      });
      const i = hover >= 0 ? hover : Math.max(0, passed);
      if (opts.readout) {
        const m = ms[i];
        opts.readout.innerHTML =
          '<p class="ro-k"><span class="ro-tag">' + (hover >= 0 ? 'Waypoint' : flying ? 'In flight' : 'Latest waypoint') + '</span>' +
          '<span class="ro-n">' + String(i + 1).padStart(2, '0') + ' / ' + String(ms.length).padStart(2, '0') + '</span></p>' +
          '<p class="ro-d">' + m.when + '</p>' +
          '<p class="ro-l">' + escapeHTML(m.label) + '</p>' +
          (m.target ? '<p class="ro-t">' + escapeHTML(m.target) + '</p>' : '');
      }
    }

    function fly() {
      if (flown || flying) return;
      if (reduce.matches) { flown = true; setU(1, true); return; }
      flown = true; flying = true;
      const dur = 5200, start = performance.now();
      setU(0, true);
      const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) * 0.35 + k * 0.65;
      function step(now) {
        const k = Math.min(1, (now - start) / dur);
        setU(ease(k));
        if (k < 1) requestAnimationFrame(step);
        else { flying = false; setU(1, true); }
      }
      requestAnimationFrame(step);
    }

    function escapeHTML(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Flight log list (shown on phones).
    if (opts.log) {
      opts.log.innerHTML = ms.map((m) =>
        '<li><a href="#' + m.ref + '"><span class="fl-n">' + String(m.i + 1).padStart(2, '0') + '</span>' +
        '<span class="fl-d">' + m.when + '</span><span class="fl-l">' + escapeHTML(m.label) + '</span></a></li>').join('');
      logEls = Array.from(opts.log.children);
    }

    render();
    if ('ResizeObserver' in window) {
      let raf = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const W = Math.round(host.clientWidth), H = Math.round(host.clientHeight);
          if (W !== lastW || H !== lastH) render();
        });
      }).observe(host);
    }

    return { fly: fly, render: render, get flown() { return flown; } };
  }

  // ---------------------------------------------------------------- globe
  // Orthographic globe with a graticule and a marker at lat, lon.
  function globe(lat, lon, size) {
    const c = size / 2, R = size / 2 - 1;
    const phi0 = Math.max(-50, Math.min(50, lat * 0.55)) * D2R, lam0 = lon * D2R;
    function proj(la, lo) {
      const p = la * D2R, l = lo * D2R;
      const cosc = Math.sin(phi0) * Math.sin(p) + Math.cos(phi0) * Math.cos(p) * Math.cos(l - lam0);
      const x = R * Math.cos(p) * Math.sin(l - lam0);
      const y = R * (Math.cos(phi0) * Math.sin(p) - Math.sin(phi0) * Math.cos(p) * Math.cos(l - lam0));
      return [c + x, c - y, cosc > 0];
    }
    function line(points) {
      let d = '', pen = false;
      points.forEach((q) => {
        const p = proj(q[0], q[1]);
        if (p[2]) { d += (pen ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); pen = true; } else pen = false;
      });
      return d;
    }
    let grid = '', eq = '';
    for (let lo = -180; lo < 180; lo += 30) {
      const pts = [];
      for (let la = -90; la <= 90; la += 3) pts.push([la, lo]);
      grid += line(pts);
    }
    for (let la = -60; la <= 60; la += 30) {
      const pts = [];
      for (let lo = -180; lo <= 180; lo += 3) pts.push([la, lo]);
      if (la === 0) eq = line(pts); else grid += line(pts);
    }
    const m = proj(lat, lon);
    return '<svg class="globe" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" class="globe-limb"/>' +
      '<path d="' + grid + '" class="globe-grid"/>' +
      '<path d="' + eq + '" class="globe-eq"/>' +
      '<circle cx="' + f1(m[0]) + '" cy="' + f1(m[1]) + '" r="5.5" class="globe-ring"/>' +
      '<circle cx="' + f1(m[0]) + '" cy="' + f1(m[1]) + '" r="2.2" class="globe-dot"/>' +
      '</svg>';
  }

  return { trajectory: trajectory, globe: globe, fmtDate: fmtDate, decYear: decYear };
})();
