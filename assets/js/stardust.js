// Stardust: with a mouse, the cursor becomes a small star that sheds dust as it moves.
// The dust is drawn on the starfield canvas behind the page, anchored to the page so it
// scrolls with the content, and it settles slowly like pigment; holding the button down
// lays it on heavier. A click on open sky lights a star, and stars lit in quick succession
// join into a constellation. "Chart a constellation" draws a real one and "Clear the sky"
// wipes everything. Under prefers-reduced-motion the cursor stays off and charts draw at once.
(function () {
  'use strict';

  const sky = window.Sky;
  if (!sky) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const INTERACTIVE = 'a[href], button, summary, label, input, select, textarea, [role="tab"], [role="button"], [tabindex]:not([tabindex="-1"])';
  const OWN_UI = '[data-design-switcher], .dust-ctl';
  const WARM = '#fff7e8';
  const RED = 'rgb(252,61,33)';
  const TINTS = ['rgb(255,247,232)', 'rgb(255,247,232)', 'rgb(255,238,218)', 'rgb(214,226,255)'];
  const STEP = 4; // px of travel per grain
  const MAX_GRAINS = 4000, MAX_HAZE = 600, MAX_SPARKS = 500, MAX_STARS = 160;
  // Where a charted constellation would sit on top of words or panels.
  const BUSY = 'p, h1, h2, h3, h4, li, dl, a, button, summary, figure, img, text, [role="button"], [tabindex]:not([tabindex="-1"]), .inst, .dossier, .cite, .rack, .mrow, .ai-card, .dust-ctl';
  // Pressing on these starts a text selection, so they don't paint.
  const TEXTY = 'p, h1, h2, h3, h4, li, dt, dd, figcaption, blockquote, text, label, summary';
  const secs = () => performance.now() / 1000;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];

  // Real star patterns, unit-scaled with y pointing down. Lines index into pts.
  const CONSTELLATIONS = [
    { name: 'Ursa Major', note: 'the Big Dipper', pts: [[0, .3], [.17, .18], [.3, .16], [.45, .22], [.5, .42], [.74, .42], [.76, .18]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
    { name: 'Orion', note: 'the Hunter', pts: [[.47, 0], [.18, .13], [.78, .2], [.38, .55], [.47, .52], [.56, .49], [.25, 1], [.86, .93]], lines: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]] },
    { name: 'Cassiopeia', note: '', pts: [[0, .25], [.25, .6], [.5, .32], [.73, .62], [1, .22]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: 'Crux', note: 'the Southern Cross', pts: [[.48, 0], [.52, 1], [.9, .42], [.12, .52]], lines: [[0, 1], [2, 3]] },
    { name: 'Cygnus', note: 'the Northern Cross', pts: [[.5, 0], [.5, .38], [.5, 1], [.1, .3], [.9, .5]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  ];

  // Everything below is stored in page coordinates.
  let grains = [], haze = [], sparks = [], stars = [], links = [], labels = [], tail = [];
  let clearAt = 0, lastLit = null, lastChart = null;

  // A soft glow, rendered once and stamped under each lit star.
  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  {
    const g = glow.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,247,232,1)');
    grd.addColorStop(0.22, 'rgba(255,247,232,.32)');
    grd.addColorStop(1, 'rgba(255,247,232,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }

  // ---------------------------------------------------------------- making dust
  function grain(x, y, t, heavy) {
    if (grains.length >= MAX_GRAINS) grains.splice(0, MAX_GRAINS / 10);
    grains.push({ x: x, y: y, t0: t, life: rand(22, 36), r: rand(.35, heavy ? 1.15 : .85), a: rand(.16, heavy ? .62 : .42),
      fill: Math.random() < .05 ? RED : pick(TINTS) });
  }

  // Soft puffs that give the trail a glow instead of a dotted line.
  function puff(x, y, t, heavy) {
    if (haze.length >= MAX_HAZE) haze.splice(0, MAX_HAZE / 10);
    haze.push({ x: x, y: y, t0: t, life: rand(8, 14), R: rand(5, heavy ? 13 : 9), a: rand(.05, heavy ? .12 : .08) });
  }

  function spark(x, y, vx, vy, t) {
    if (sparks.length >= MAX_SPARKS) sparks.splice(0, MAX_SPARKS / 10);
    sparks.push({ x: x, y: y, vx: vx, vy: vy, t0: t, life: rand(.45, 1.15), r: rand(.5, 1.25), a: rand(.5, .95),
      fill: Math.random() < .08 ? RED : pick(TINTS) });
  }

  function burst(x, y, n, t) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, 6.2832), v = rand(30, 120);
      spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, t);
    }
  }

  function addStar(x, y, t, life, r) {
    if (stars.length >= MAX_STARS) stars.splice(0, MAX_STARS / 10);
    const s = { x: x, y: y, t0: t, life: life, r: r };
    stars.push(s);
    return s;
  }

  // Dust along the path since the last grain, so fast strokes stay continuous.
  let lastX = null, lastY = 0, lastT = 0;
  function shed(x, y, heavy) {
    const t = secs();
    tail.push({ x: x, y: y, t: t });
    if (lastX === null || Math.hypot(x - lastX, y - lastY) > 240) { lastX = x; lastY = y; lastT = t; sky.wake(); return; }
    const dx = x - lastX, dy = y - lastY, d = Math.hypot(dx, dy);
    if (d < STEP) return;
    const dt = Math.max(0.008, t - lastT);
    const vx = dx / dt, vy = dy / dt, nx = -dy / d, ny = dx / d;
    const n = Math.floor(d / STEP), spread = heavy ? 5 : 3.4;
    const off = () => (rand(-1, 1) + rand(-1, 1)) * spread * .75; // most dust near the path, some strays
    for (let i = 1; i <= n; i++) {
      const f = i / n, bx = lastX + dx * f, by = lastY + dy * f;
      let j = off();
      grain(bx + nx * j + rand(-1.5, 1.5), by + ny * j + rand(-1.5, 1.5), t, heavy);
      if (heavy || Math.random() < .3) { j = off(); grain(bx + nx * j, by + ny * j, t, heavy); }
      if (heavy && Math.random() < .5) { j = off(); grain(bx + nx * j, by + ny * j, t, true); }
      if (Math.random() < (heavy ? .35 : .18)) puff(bx + nx * off() * .5, by + ny * off() * .5, t, heavy);
      if (Math.random() < (heavy ? .5 : .22)) spark(bx, by, rand(-24, 24) - vx * .05, rand(-24, 24) - vy * .05, t);
    }
    lastX = x; lastY = y; lastT = t;
    sky.wake();
  }

  function light(x, y) {
    const t = secs(), still = reduce.matches;
    const s = addStar(x, y, t, 60, rand(1.4, 1.9));
    if (!still) burst(x, y, 16, t);
    if (lastLit && t - lastLit.t0 < 7 && Math.hypot(x - lastLit.x, y - lastLit.y) < 560) {
      links.push({ a: lastLit, b: s, t0: t, dur: still ? 0 : .28, life: 60 });
    }
    lastLit = s;
    tip.classList.add('is-done');
    sky.wake();
  }

  // Draws the next constellation in open sky on screen, one line at a time.
  let chartNo = 0;
  function chart() {
    const c = CONSTELLATIONS[chartNo++ % CONSTELLATIONS.length];
    const W = window.innerWidth, H = window.innerHeight, top = 96, bottom = 110;
    const base = Math.max(140, Math.min(300, W * .38, H * .45));
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    c.pts.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    const span = Math.max(x1 - x0, y1 - y0);
    const text = c.name + (c.note ? ' · ' + c.note : '');
    // Try spots on screen and keep the one that covers the fewest words and panels.
    const busyAt = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return true;
      const el = document.elementFromPoint(x, y);
      return !!(el && el.closest(BUSY));
    };
    const sy = window.scrollY, labelW = text.length * 7.6;
    let best = null;
    for (let i = 0; i < 30; i++) {
      const k = (i % 3 ? base : base * .72) / span, w = (x1 - x0) * k, h = (y1 - y0) * k;
      const bx = rand(24, Math.max(24, W - 24 - w)), by = rand(top, Math.max(top, H - bottom - h));
      const lx = Math.max(16, Math.min(bx, W - 16 - labelW)), ly = by + h + 26;
      const at = (p) => [bx + (p[0] - x0) * k, by + (p[1] - y0) * k];
      let score = 0;
      c.pts.forEach((p) => { if (busyAt.apply(null, at(p))) score += 1; });
      c.lines.forEach((ln) => { const a = at(c.pts[ln[0]]), b = at(c.pts[ln[1]]); if (busyAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) score += .25; });
      for (let q = 0; q <= 6; q++) { const x = lx + labelW * q / 6; if (busyAt(x, ly - 9)) score += .3; if (busyAt(x, ly - 1)) score += .3; }
      if (lastChart && bx < lastChart.x + lastChart.w && bx + w > lastChart.x && by + sy < lastChart.y + lastChart.h && by + h + sy > lastChart.y) score += 3;
      // Keep clear of stars already lit.
      stars.forEach((st) => { if (st.x > bx - 24 && st.x < bx + w + 24 && st.y > by + sy - 24 && st.y < by + h + sy + 24) score += .5; });
      if (!best || score < best.score) best = { x: bx, y: by, lx: lx, k: k, w: w, h: h, score: score };
    }
    const k = best.k, w = best.w, h = best.h, ox = best.x, oy = best.y + sy;
    lastChart = { x: ox, y: oy, w: w, h: h };
    const pts = c.pts.map((p) => ({ x: ox + (p[0] - x0) * k, y: oy + (p[1] - y0) * k }));
    const t = secs(), still = reduce.matches, step = still ? 0 : .34;
    const lit = [];
    const reach = (i, when) => {
      if (!lit[i]) {
        lit[i] = addStar(pts[i].x, pts[i].y, when, 50, rand(1.4, 1.9));
        if (!still) burst(pts[i].x, pts[i].y, 7, when);
      }
      return lit[i];
    };
    c.lines.forEach((ln, j) => {
      const when = t + j * step;
      links.push({ a: reach(ln[0], when), b: reach(ln[1], when + step), t0: when, dur: step, life: 50 });
    });
    labels.push({ text: text.toUpperCase(), x: best.lx, y: oy + h + 26, t0: t + c.lines.length * step, life: 10 });
    say('Charted ' + text.replace(' · ', ', ') + '.');
    sky.wake();
  }

  function clear() {
    clearAt = secs();
    lastLit = null;
    say('Sky cleared.');
    sky.wake();
  }

  // ---------------------------------------------------------------- drawing (behind the page)
  function drawStar(ctx, x, y, r, a) {
    const R = r * 6, L = r * 5;
    ctx.globalAlpha = a * .5;
    ctx.drawImage(glow, x - R, y - R, R * 2, R * 2);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * .4;
    ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
  }

  sky.addOverlay(function (ctx, now, W, H, sy) {
    const t = now / 1000, still = reduce.matches;
    let fade = 1, busy = false, n;
    if (clearAt) {
      fade = still ? 0 : 1 - (t - clearAt) / .5;
      if (fade <= 0) { grains = []; haze = []; sparks = []; stars = []; links = []; labels = []; tail = []; clearAt = 0; lastChart = null; return false; }
      busy = true;
    }
    if (!grains.length && !haze.length && !sparks.length && !stars.length && !labels.length && !tail.length) return busy;
    const top = sy - 8, bottom = sy + H + 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Haze along the trail.
    n = 0;
    for (let i = 0; i < haze.length; i++) {
      const g = haze[i], age = t - g.t0;
      if (age >= g.life) continue;
      haze[n++] = g;
      if (g.y + g.R < top || g.y - g.R > bottom) continue;
      ctx.globalAlpha = g.a * Math.pow(1 - age / g.life, 1.4) * fade;
      ctx.drawImage(glow, g.x - g.R, g.y - sy - g.R, g.R * 2, g.R * 2);
    }
    haze.length = n;

    // Settled dust: bright for a moment, then a long, slow fade.
    n = 0;
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i], age = t - g.t0;
      if (age >= g.life) continue;
      grains[n++] = g;
      if (g.y < top || g.y > bottom) continue;
      let a = g.a * Math.pow(1 - age / g.life, 1.6);
      if (age < .4 && !still) { a *= 1 + 2.4 * (1 - age / .4); busy = true; }
      ctx.globalAlpha = Math.min(1, a * fade);
      ctx.fillStyle = g.fill;
      ctx.fillRect(g.x - g.r, g.y - sy - g.r, g.r * 2, g.r * 2);
    }
    grains.length = n;

    // Sparks drift out and slow down.
    n = 0;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i], age = t - s.t0;
      if (age >= s.life) continue;
      sparks[n++] = s;
      busy = true;
      if (age < 0) continue;
      const k = (1 - Math.exp(-2.4 * age)) / 2.4;
      const x = s.x + s.vx * k, y = s.y + s.vy * k - sy;
      if (y < -8 || y > H + 8) continue;
      const f = 1 - age / s.life;
      ctx.globalAlpha = s.a * f * f * fade;
      ctx.fillStyle = s.fill;
      ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
    }
    sparks.length = n;

    // Constellation lines grow from star to star, stopping short of each one like a chart.
    ctx.strokeStyle = 'rgb(236,233,225)';
    ctx.lineWidth = .8;
    n = 0;
    for (let i = 0; i < links.length; i++) {
      const l = links[i], age = t - l.t0;
      if (age >= l.life) continue;
      links[n++] = l;
      if (age < 0) { busy = true; continue; }
      const p = l.dur ? Math.min(1, age / l.dur) : 1;
      if (p < 1) busy = true;
      const ax = l.a.x, ay = l.a.y - sy, dx = l.b.x - ax, dy = l.b.y - sy - ay, len = Math.hypot(dx, dy);
      if (len < 14 || Math.max(ay, ay + dy) < -10 || Math.min(ay, ay + dy) > H + 10) continue;
      const ux = dx / len, uy = dy / len, end = Math.max(6, len * p - (p === 1 ? 6 : 0));
      ctx.globalAlpha = .3 * (1 - Math.pow(age / l.life, 3)) * fade;
      ctx.beginPath(); ctx.moveTo(ax + ux * 6, ay + uy * 6); ctx.lineTo(ax + ux * end, ay + uy * end); ctx.stroke();
    }
    links.length = n;

    // Lit stars flare as they appear, hold, then fade at the end of their life.
    ctx.fillStyle = WARM;
    ctx.strokeStyle = WARM;
    ctx.lineWidth = .6;
    n = 0;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i], age = t - s.t0;
      if (age >= s.life) continue;
      stars[n++] = s;
      if (age < 0) { busy = true; continue; }
      const y = s.y - sy;
      if (y < -24 || y > H + 24) continue;
      let pop = 1;
      if (age < .5 && !still) { pop = 1 + 1.6 * (1 - age / .5); busy = true; }
      drawStar(ctx, s.x, y, s.r * pop, (1 - Math.pow(age / s.life, 3)) * fade);
    }
    stars.length = n;

    // Names of charted constellations.
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    ctx.fillStyle = 'rgb(236,233,225)';
    n = 0;
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i], age = t - l.t0;
      if (age >= l.life) continue;
      labels[n++] = l;
      if (age < 0) { busy = true; continue; }
      if (age < .6 && !still) busy = true;
      ctx.globalAlpha = .62 * (still ? 1 : Math.min(1, age / .6)) * Math.min(1, (l.life - age) / 2) * fade;
      ctx.fillText(l.text, l.x, l.y - sy);
    }
    labels.length = n;
    ctx.globalCompositeOperation = 'lighter';

    // Comet tail: the last fifth of a second of travel, widest at the cursor.
    n = 0;
    for (let i = 0; i < tail.length; i++) if (t - tail[i].t < .2) tail[n++] = tail[i];
    tail.length = n;
    if (n) busy = true;
    if (n > 1) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = WARM;
      for (let i = 1; i < n; i++) {
        const f = 1 - (t - tail[i].t) / .2;
        ctx.globalAlpha = .3 * f * f * fade;
        ctx.lineWidth = .5 + 2.2 * f;
        ctx.beginPath(); ctx.moveTo(tail[i - 1].x, tail[i - 1].y - sy); ctx.lineTo(tail[i].x, tail[i].y - sy); ctx.stroke();
      }
    }

    ctx.restore();
    return busy;
  });

  // ---------------------------------------------------------------- the cursor (above the page)
  const cursor = document.createElement('div');
  cursor.className = 'star-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML =
    '<svg viewBox="-20 -20 40 40" focusable="false">' +
    '<defs><radialGradient id="sc-glow"><stop offset="0" stop-color="#fff7e8" stop-opacity=".5"/><stop offset="1" stop-color="#fff7e8" stop-opacity="0"/></radialGradient></defs>' +
    '<circle class="sc-ring" r="12"/>' +
    '<circle r="10" fill="url(#sc-glow)"/>' +
    '<g class="sc-rays"><path d="M0-15L.9-.9L15 0L.9 .9L0 15L-.9 .9L-15 0L-.9-.9Z"/>' +
    '<path class="sc-short" d="M0-15L.9-.9L15 0L.9 .9L0 15L-.9 .9L-15 0L-.9-.9Z" transform="rotate(45) scale(.45)"/></g>' +
    '<circle class="sc-core" r="2"/></svg>';
  document.body.appendChild(cursor);

  let cursorOn = true, cx = -100, cy = -100, pressed = false, painting = false, dragged = false, downX = 0, downY = 0;
  try { cursorOn = localStorage.getItem('space-star-cursor') !== 'off'; } catch (e) { /* storage blocked: default on */ }
  const active = () => cursorOn && mouse.matches && !reduce.matches;

  function place(x, y) {
    cx = x; cy = y;
    cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    cursor.classList.add('is-on');
    root.classList.add('has-star-cursor');
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') { cursor.classList.remove('is-on'); return; }
    if (!active()) return;
    place(e.clientX, e.clientY);
    if (pressed && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragged = true;
    if (!cursor.classList.contains('is-away')) shed(e.clientX, e.clientY + window.scrollY, pressed && painting);
  }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest ? e.target : null;
    const away = !!(el && el.closest('[data-design-switcher]')); // the comparison switcher keeps the system cursor
    cursor.classList.toggle('is-away', away);
    cursor.classList.toggle('is-target', !away && !!(el && el.closest(INTERACTIVE)));
  });
  window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) cursor.classList.remove('is-on'); });
  window.addEventListener('blur', () => cursor.classList.remove('is-on'));
  window.addEventListener('scroll', () => { lastX = null; }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pressed = true; dragged = false; downX = e.clientX; downY = e.clientY;
    cursor.classList.add('is-down');
  }, { passive: true });
  const release = () => { pressed = false; painting = false; cursor.classList.remove('is-down'); };
  // Pressing on open sky paints heavier dust instead of starting a text selection.
  document.addEventListener('mousedown', (e) => {
    const el = e.target.closest ? e.target : null;
    painting = !!(e.button === 0 && active() && el && !el.closest(INTERACTIVE) && !el.closest(TEXTY) && !el.closest(OWN_UI));
    if (painting) e.preventDefault();
  });
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });

  // A click on open sky (anything that isn't a control, and not the end of a text selection).
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || dragged || !e.isTrusted) return;
    const el = e.target.closest ? e.target : null;
    if (!el || el.closest(INTERACTIVE) || el.closest(OWN_UI)) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    light(e.clientX, e.clientY + window.scrollY);
  });

  // ---------------------------------------------------------------- controls
  const live = document.createElement('p');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);
  function say(msg) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 60); }

  const ctl = document.createElement('div');
  ctl.className = 'dust-ctl';
  ctl.setAttribute('role', 'group');
  ctl.setAttribute('aria-label', 'Stardust');
  ctl.innerHTML =
    '<span class="dust-lbl" aria-hidden="true"><svg viewBox="-10 -10 20 20" focusable="false"><path d="M0-10L1.6-1.6L10 0L1.6 1.6L0 10L-1.6 1.6L-10 0L-1.6-1.6Z"/></svg><span>Stardust</span></span>' +
    '<button type="button" data-act="chart"><span class="dust-long">Chart a constellation</span><span class="dust-short">Chart</span></button>' +
    '<button type="button" data-act="clear"><span class="dust-long">Clear the sky</span><span class="dust-short">Clear</span></button>' +
    '<button type="button" data-act="cursor" aria-pressed="true">Star cursor</button>' +
    '<span class="dust-tip" aria-hidden="true">Click open sky to light a star</span>';
  document.body.appendChild(ctl);
  const toggle = ctl.querySelector('[data-act="cursor"]');
  const tip = ctl.querySelector('.dust-tip');

  ctl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.getAttribute('data-act');
    if (act === 'chart') chart();
    else if (act === 'clear') clear();
    else if (act === 'cursor') {
      cursorOn = !cursorOn;
      try { localStorage.setItem('space-star-cursor', cursorOn ? 'on' : 'off'); } catch (err) { /* not remembered */ }
      apply();
      if (active() && cx > -100) place(cx, cy);
    }
  });

  function apply() {
    const on = active();
    if (!on) { cursor.classList.remove('is-on'); root.classList.remove('has-star-cursor'); tail = []; lastX = null; }
    toggle.hidden = !mouse.matches || reduce.matches;
    toggle.setAttribute('aria-pressed', String(cursorOn));
    tip.hidden = !mouse.matches;
  }
  [reduce, mouse].forEach((mq) => {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  });
  apply();
})();
