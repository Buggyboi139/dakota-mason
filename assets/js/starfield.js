// Starfield behind the page: three depth layers of stars and a faint band of
// galactic dust on one fixed canvas. Gentle parallax on pointer and scroll, a
// subtle twinkle, device pixel ratio capped at 2, paused while the tab is
// hidden, and drawn once (no motion) under prefers-reduced-motion. Other scripts can draw
// on top through window.Sky (the stardust does).
(function () {
  'use strict';

  const canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const BG = '#08090b';
  const MARGIN = 24; // extra width on each side so pointer parallax never shows an edge
  const TINTS = ['236,233,225', '236,233,225', '236,233,225', '255,232,206', '210,222,255'];

  // Far, mid, and near layers. density is stars per square CSS pixel.
  const LAYERS = [
    { density: 1 / 2300, rMin: 0.35, rMax: 0.7, aMin: 0.2, aMax: 0.5, scroll: 0.012, point: 4, twinkle: 0 },
    { density: 1 / 7800, rMin: 0.55, rMax: 1.0, aMin: 0.32, aMax: 0.72, scroll: 0.032, point: 9, twinkle: 0.28 },
    { density: 1 / 32000, rMin: 0.85, rMax: 1.55, aMin: 0.5, aMax: 0.95, scroll: 0.07, point: 16, twinkle: 0.5 },
  ];

  let W = 0, H = 0, dpr = 1, builtW = 0, builtH = 0;
  let layers = [];
  let dust = null, dustW = 0, dustH = 0;
  let raf = 0, lastDraw = 0, dirty = true;
  let scrollY = window.scrollY || 0;
  let px = 0, py = 0, tx = 0, ty = 0;
  const overlays = [];
  let overlayBusy = false, stillRaf = 0;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function star(g, x, y, r, a, tint) {
    g.fillStyle = 'rgba(' + tint + ',' + a.toFixed(3) + ')';
    if (r < 0.7) { g.fillRect(x - r, y - r, r * 2, r * 2); return; }
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    if (r > 1.15) {
      g.fillStyle = 'rgba(' + tint + ',' + (a * 0.07).toFixed(3) + ')';
      g.beginPath(); g.arc(x, y, r * 3.4, 0, 6.2832); g.fill();
    }
  }

  function gauss(rand) { // approximately normal, mean 0, sd 1
    return (rand() + rand() + rand() + rand() - 2) * 1.73;
  }

  function buildDust(rand) {
    // A soft diagonal band, rendered once at CSS-pixel resolution.
    dustW = W + 2 * 90; dustH = H + 260;
    const c = document.createElement('canvas');
    c.width = Math.round(dustW); c.height = Math.round(dustH);
    const g = c.getContext('2d');
    const x0 = -0.15 * dustW, y0 = 0.86 * dustH, x1 = 1.15 * dustW, y1 = 0.06 * dustH;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len; // unit normal
    const spread = Math.min(dustW, dustH) * 0.11;
    const blobs = Math.round(len / 4);
    for (let i = 0; i < blobs; i++) {
      const t = rand();
      const off = gauss(rand) * spread * (0.7 + 0.5 * Math.sin(t * 9 + 1.3));
      const x = x0 + (x1 - x0) * t + nx * off;
      const y = y0 + (y1 - y0) * t + ny * off;
      const r = 26 + rand() * 110;
      const warm = rand() < 0.55;
      const col = warm ? '170,152,128' : '118,132,160';
      const a = (0.006 + rand() * 0.016) * (1 - Math.min(1, Math.abs(off) / (spread * 3)));
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(4) + ')');
      grd.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // A darker lane running along the band.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < blobs / 3; i++) {
      const t = rand();
      const off = spread * 0.18 + gauss(rand) * spread * 0.22;
      const x = x0 + (x1 - x0) * t + nx * off;
      const y = y0 + (y1 - y0) * t + ny * off;
      const r = 14 + rand() * 46;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(0,0,0,0.22)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    // Faint unresolved stars crowd the band.
    const n = Math.round(len * 1.1);
    for (let i = 0; i < n; i++) {
      const t = rand();
      const off = gauss(rand) * spread * 0.8;
      const x = x0 + (x1 - x0) * t + nx * off;
      const y = y0 + (y1 - y0) * t + ny * off;
      g.fillStyle = 'rgba(236,233,225,' + (0.08 + rand() * 0.22).toFixed(3) + ')';
      const s = rand() < 0.85 ? 0.6 : 1;
      g.fillRect(x, y, s, s);
    }
    dust = c;
  }

  function build() {
    W = Math.max(1, canvas.clientWidth || window.innerWidth);
    H = Math.max(1, canvas.clientHeight || window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    builtW = W; builtH = H;
    const rand = rng(20150901);
    const LW = W + MARGIN * 2, LH = H;
    layers = LAYERS.map(function (cfg) {
      const off = document.createElement('canvas');
      off.width = Math.round(LW * dpr); off.height = Math.round(LH * dpr);
      const g = off.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(LW * LH * cfg.density);
      const tw = [];
      for (let k = 0; k < n; k++) {
        const x = rand() * LW, y = rand() * LH;
        const r = cfg.rMin + Math.pow(rand(), 2.4) * (cfg.rMax - cfg.rMin);
        const a = cfg.aMin + rand() * (cfg.aMax - cfg.aMin);
        const tint = TINTS[Math.floor(rand() * TINTS.length)];
        const ph = rand() * 6.2832, sp = 0.5 + rand() * 1.4;
        if (rand() < cfg.twinkle) tw.push({ x: x, y: y, r: r, a: a, tint: tint, ph: ph, sp: sp });
        else star(g, x, y, r, a, tint);
      }
      return { cfg: cfg, canvas: off, tw: tw, LW: LW, LH: LH };
    });
    buildDust(rand);
    dirty = true;
  }

  function draw(now) {
    const still = reduce.matches;
    const t = now / 1000;
    if (!still) {
      px += (tx - px) * 0.045;
      py += (ty - py) * 0.045;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    const sy = still ? 0 : scrollY;
    const ppx = still ? 0 : px, ppy = still ? 0 : py;

    // The band drifts up a little as the page scrolls, capped so its lower edge never enters view.
    if (dust) ctx.drawImage(dust, -90 - ppx * 6, -130 - Math.min(sy * 0.02, 110) - ppy * 6, dustW, dustH);

    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const ox = -MARGIN - ppx * L.cfg.point;
      let oy = (-(sy * L.cfg.scroll) - ppy * L.cfg.point) % L.LH;
      if (oy > 0) oy -= L.LH;
      // Two vertical tiles; copy only the rows that are on screen.
      const h1 = oy + L.LH, h2 = -oy;
      if (h1 > 0.5) ctx.drawImage(L.canvas, 0, -oy * dpr, L.canvas.width, h1 * dpr, ox, 0, L.LW, h1);
      if (h2 > 0.5) ctx.drawImage(L.canvas, 0, 0, L.canvas.width, h2 * dpr, ox, h1, L.LW, h2);
      for (let k = 0; k < L.tw.length; k++) {
        const s = L.tw[k];
        let y = s.y + oy;
        if (y < -6) y += L.LH;
        if (y > H + 6) continue;
        const f = still ? 0.85 : 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
        star(ctx, s.x + ox, y, s.r, s.a * f, s.tint);
      }
    }
    // Overlays draw last, in page coordinates. One that is mid-animation asks for full frame rate.
    overlayBusy = false;
    for (let i = 0; i < overlays.length; i++) if (overlays[i](ctx, now, W, H, scrollY)) overlayBusy = true;
    lastDraw = now;
    dirty = false;
  }

  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    const moving = Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001;
    // Twinkle alone is drawn at about 30 frames a second; parallax at full rate.
    if (dirty || moving || overlayBusy || now - lastDraw > 32) draw(now);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (reduce.matches) { draw(performance.now()); return; }
    if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (Math.abs(w - builtW) < 1 && Math.abs(h - builtH) < 1) return;
      build();
      if (reduce.matches) draw(performance.now());
    }, 160);
  });

  // Without motion the sky is drawn on demand, so overlays (which scroll with the page) redraw here.
  function drawStill() {
    if (stillRaf) return;
    stillRaf = requestAnimationFrame(function () { stillRaf = 0; draw(performance.now()); });
  }

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
    dirty = true;
    if (reduce.matches && overlays.length) drawStill();
  }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    if (!W || !H) return;
    tx = Math.max(-1, Math.min(1, (e.clientX / W) * 2 - 1));
    ty = Math.max(-1, Math.min(1, (e.clientY / H) * 2 - 1));
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  const onMotion = function () { stop(); dirty = true; start(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onMotion);
  else if (reduce.addListener) reduce.addListener(onMotion);

  window.Sky = {
    // fn(ctx, now, width, height, scrollY) draws in CSS pixels and returns true while it animates.
    addOverlay: function (fn) { overlays.push(fn); dirty = true; },
    wake: function () { dirty = true; if (reduce.matches) drawStill(); },
  };

  build();
  draw(performance.now());
  canvas.classList.add('is-ready');
  start();
})();
