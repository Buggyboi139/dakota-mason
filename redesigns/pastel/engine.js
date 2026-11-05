// Pastel engine for the "Pastel" redesign.
//
// Paper: one tileable tooth height map, generated once. It paints the page's paper and decides
// where pigment catches, so pigment sits on the same ridges you see in the paper.
// Strokes: Catmull-Rom paths, rasterized segment by segment into per-pixel pigment buffers
// (amount and color). Pigment lands where the tooth rises above a pressure threshold, builds up
// where passes overlap, and is shaded with light from the top left (highlight, shade, cast
// shadow). Each stroke is drawn to its canvas once; nothing redraws per frame.
// Sticks: pseudo-3D SVG pastel sticks that travel along a stroke while it draws.
(function () {
  'use strict';

  // ---------- Palette ----------
  // css: swatch color for UI. pig: pigment color for strokes (a touch richer than the swatch,
  // because a single pass of chalk lets paper show through).
  const PALETTE = {
    peach: { name: 'Peach', css: '#F6C6A8', pig: [243, 182, 146] },
    rose: { name: 'Rose', css: '#F2A7B8', pig: [238, 150, 172] },
    lilac: { name: 'Lilac', css: '#C9B6E4', pig: [188, 165, 224] },
    sky: { name: 'Sky', css: '#A9CFEF', pig: [150, 194, 236] },
    mint: { name: 'Mint', css: '#B5E3C8', pig: [156, 214, 182] },
    butter: { name: 'Butter', css: '#F7E3A1', pig: [244, 215, 128] },
    pewter: { name: 'Pewter', css: '#B9B1C6', pig: [172, 163, 188] },
  };
  const INK = '#3B3346';

  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Small math helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  function hashU(n) {
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return (n ^ (n >>> 16)) >>> 0;
  }
  const rnd1 = (n) => hashU(n | 0) / 4294967296;
  const rnd2 = (x, y, s) => hashU(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(s | 0, 83492791)) / 4294967296;

  // Smooth 1D value noise in [0, 1].
  function vnoise1(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const s = Math.imul(seed | 0, 668265263);
    const a = hashU(Math.imul(i, 374761393) ^ s) / 4294967296;
    const b = hashU(Math.imul(i + 1, 374761393) ^ s) / 4294967296;
    return a + (b - a) * u;
  }

  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRGB(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mixHex(a, b, t) {
    const A = hexRGB(a), B = hexRGB(b);
    return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('');
  }

  // ---------- Paper tooth ----------
  const TILE = 256; // CSS px per tile
  const TD = 2; // tooth samples per CSS px
  const N = TILE * TD; // samples per side (power of two)
  const NM = N - 1;
  let tooth = null; // equalized height, uniform in [0, 1): pigment threshold map
  let toothSoft = null; // smooth height without grit: paper relief

  function worleyLayer(out, cell, amp, seed) {
    const G = N / cell;
    const fx = new Float32Array(G * G), fy = new Float32Array(G * G);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i;
        fx[k] = (i + 0.5 + (rnd2(i, j, seed) - 0.5) * 0.95) * cell;
        fy[k] = (j + 0.5 + (rnd2(i, j, seed + 1) - 0.5) * 0.95) * cell;
      }
    }
    const inv = 1 / cell;
    for (let y = 0; y < N; y++) {
      const cj = (y / cell) | 0;
      for (let x = 0; x < N; x++) {
        const ci = (x / cell) | 0;
        let d1 = 1e9, d2 = 1e9;
        for (let dj = -1; dj <= 1; dj++) {
          let jj = cj + dj, oy = 0;
          if (jj < 0) { jj += G; oy = -N; } else if (jj >= G) { jj -= G; oy = N; }
          for (let di = -1; di <= 1; di++) {
            let ii = ci + di, ox = 0;
            if (ii < 0) { ii += G; ox = -N; } else if (ii >= G) { ii -= G; ox = N; }
            const k = jj * G + ii;
            const dx = fx[k] + ox - x, dy = fy[k] + oy - y;
            const d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
        }
        // Dimples at the feature points, rims between them (like a laid pastel paper's honeycomb).
        const f1 = Math.sqrt(d1) * inv, f2 = Math.sqrt(d2) * inv;
        const rim = 1 - clamp((f2 - f1) * 1.6, 0, 1); // high on cell borders
        out[y * N + x] += amp * (0.6 * Math.min(1, f1 * 1.35) + 0.4 * rim);
      }
    }
  }

  function valueLayer(out, period, amp, seed) {
    const G = N / period;
    const lat = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) lat[i] = rnd2(i, seed, 7);
    for (let y = 0; y < N; y++) {
      const gy = y / period, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % G) * G, r1 = ((y0 + 1) % G) * G;
      for (let x = 0; x < N; x++) {
        const gx = x / period, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % G, c1 = (x0 + 1) % G;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * N + x] += (a + (b - a) * sy) * amp;
      }
    }
  }

  function normalize(a) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const k = 1 / (mx - mn || 1), out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] - mn) * k;
    return out;
  }

  // Histogram equalization: a threshold t then covers exactly (1 - t) of the paper.
  function equalize(a) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const B = 4096, hist = new Uint32Array(B), k = (B - 1) / (mx - mn || 1);
    for (let i = 0; i < a.length; i++) hist[((a[i] - mn) * k) | 0]++;
    const cdf = new Float32Array(B);
    let c = 0;
    for (let b = 0; b < B; b++) { cdf[b] = (c + hist[b] * 0.5) / a.length; c += hist[b]; }
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = cdf[((a[i] - mn) * k) | 0];
    return out;
  }

  function makeTooth() {
    const acc = new Float32Array(N * N);
    worleyLayer(acc, 8, 0.46, 11);
    worleyLayer(acc, 16, 0.16, 23);
    valueLayer(acc, 4, 0.10, 5);
    valueLayer(acc, 8, 0.08, 7);
    valueLayer(acc, 64, 0.08, 13);
    valueLayer(acc, 128, 0.06, 17);
    toothSoft = normalize(acc);
    for (let i = 0; i < acc.length; i++) acc[i] += 0.07 * rnd1(Math.imul(i, 2654435761) ^ 0x5bd1e995);
    tooth = equalize(acc);
  }

  // Paints a paper tile from the tooth. Light comes from the top left.
  function paperCanvas(base, o) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(N, N), d = im.data;
    for (let y = 0; y < N; y++) {
      const yu = ((y - 1) & NM) * N, yd = ((y + 1) & NM) * N, yr = y * N;
      for (let x = 0; x < N; x++) {
        const xl = (x - 1) & NM, xr = (x + 1) & NM;
        const s = toothSoft[yr + x];
        const g = toothSoft[yd + xr] - toothSoft[yu + xl];
        const L = 1 + g * o.relief + (s - 0.5) * o.ao + (tooth[yr + x] - 0.5) * o.grit;
        const i = (yr + x) * 4;
        d[i] = base[0] * L + o.lift * (L - 1) * 255;
        d[i + 1] = base[1] * L + o.lift * (L - 1) * 255;
        d[i + 2] = base[2] * L + o.lift * (L - 1) * 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    // Paper fibers: short, faint, wrapped across tile edges.
    const r = prng(o.seed || 3);
    ctx.lineCap = 'round';
    for (let f = 0; f < o.fibers; f++) {
      const x = r() * N, y = r() * N, a = r() * Math.PI * 2, len = 10 + r() * 34, bend = (r() - 0.5) * 0.9;
      const dark = r() < 0.6;
      ctx.strokeStyle = dark ? o.fiberDark : o.fiberLight;
      ctx.lineWidth = 0.7 + r() * 0.9;
      for (let ox = -N; ox <= N; ox += N) {
        for (let oy = -N; oy <= N; oy += N) {
          ctx.beginPath();
          ctx.moveTo(x + ox, y + oy);
          ctx.quadraticCurveTo(
            x + ox + Math.cos(a + bend) * len * 0.5, y + oy + Math.sin(a + bend) * len * 0.5,
            x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
          ctx.stroke();
        }
      }
    }
    return c;
  }

  // Large, soft tonal blotches, tiled at a period that doesn't line up with the tooth tile.
  function mottleCanvas(seed) {
    const S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d'), im = ctx.createImageData(S, S), d = im.data;
    const G = 5;
    const lat = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) lat[i] = rnd2(i, seed, 3);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const gx = (x / S) * G, gy = (y / S) * G;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const sx = sstep(gx - x0), sy = sstep(gy - y0);
        const a = lat[(y0 % G) * G + (x0 % G)], b = lat[(y0 % G) * G + ((x0 + 1) % G)];
        const c0 = lat[((y0 + 1) % G) * G + (x0 % G)], c1 = lat[((y0 + 1) % G) * G + ((x0 + 1) % G)];
        const v = (a + (b - a) * sx) * (1 - sy) + (c0 + (c1 - c0) * sx) * sy;
        const i = (y * S + x) * 4;
        if (v > 0.5) { d[i] = 150; d[i + 1] = 118; d[i + 2] = 92; d[i + 3] = (v - 0.5) * 2 * 16; }
        else { d[i] = 255; d[i + 1] = 253; d[i + 2] = 247; d[i + 3] = (0.5 - v) * 2 * 30; }
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  const toURL = (canvas, type) => new Promise((res) => {
    canvas.toBlob((b) => res(b ? URL.createObjectURL(b) : canvas.toDataURL()), type || 'image/png');
  });

  // ---------- Strokes ----------
  const SOFT = 0.055, SOFT2 = SOFT * 2; // softness of the tooth threshold
  const DEP = 0.55; // pigment amount of one full pass
  const COVER = 0.6; // how strongly old pigment resists a new color
  const BUILD = 0.3; // how much piled pigment raises the surface for the next pass
  let strokeSerial = 0;

  class Stroke {
    // o: { color: palette key or [r,g,b], hw: half-width (CSS px), seed, crumbs: density }
    constructor(o) {
      this.key = typeof o.color === 'string' ? o.color : null;
      this.color = this.key ? PALETTE[this.key].pig : o.color;
      this.hw = o.hw;
      this.seed = (o.seed >>> 0) || ((Math.random() * 1e9) >>> 0);
      this.rnd = prng(this.seed);
      this.x = []; this.y = []; this.arc = []; this.p = []; this.hl = []; this.hr = []; this.ext = [];
      this.asym = (this.rnd() - 0.5) * 0.5;
      this.passLen = Math.max(6, this.hw * 2.6);
      strokeSerial = (strokeSerial % 63) + 1;
      this.keyHi = strokeSerial << 10;
      this.crumbDensity = o.crumbs == null ? 1 : o.crumbs;
      this.crumbs = [];
      this.nextCrumb = 8 + this.rnd() * 30;
      this.doneSeg = 0; // segments deposited so far
      this.doneCrumb = 0;
      this.length = 0;
      // Streaks: grooves in the worn tip drag lines along the stroke.
      const SL = Math.ceil(this.hw * 1.5 * 4) + 8;
      this.streak = new Float32Array(SL);
      this.sOff = SL / 2;
      for (let i = 0; i < SL; i++) {
        const t = (i - this.sOff) * 0.5;
        this.streak[i] = 1 + (vnoise1(t / 1.4, this.seed + 7) - 0.5) * 0.2 + (vnoise1(t / 4.6, this.seed + 9) - 0.5) * 0.34;
      }
      // Grooves: grit in the tip drags a line that comes and goes along the stroke.
      const ng = 1 + ((this.rnd() * 3) | 0);
      this.grooves = new Float64Array(ng * 4);
      for (let g = 0; g < ng; g++) {
        this.grooves[g * 4] = (this.rnd() - 0.5) * 1.4 * this.hw;
        this.grooves[g * 4 + 1] = 0.45 + this.rnd() * 0.9;
        this.grooves[g * 4 + 2] = 0.3 + this.rnd() * 0.4;
        this.grooves[g * 4 + 3] = (this.rnd() * 1e6) | 0;
      }
    }

    get n() { return this.x.length; }

    add(x, y, p) {
      const n = this.x.length;
      let arc = 0;
      if (n) {
        const dx = x - this.x[n - 1], dy = y - this.y[n - 1];
        arc = this.arc[n - 1] + Math.sqrt(dx * dx + dy * dy);
      }
      this.x.push(x); this.y.push(y); this.arc.push(arc); this.p.push(p);
      const s = this.seed;
      const nl = (vnoise1(arc / 17, s + 1) - 0.5) * 0.22 + (vnoise1(arc / 6, s + 2) - 0.5) * 0.12;
      const nr = (vnoise1(arc / 17, s + 3) - 0.5) * 0.22 + (vnoise1(arc / 6, s + 4) - 0.5) * 0.12;
      const w = this.hw * (0.84 + 0.16 * clamp(p, 0, 1.25));
      this.hl.push(w * (1 + nl));
      this.hr.push(w * (1 + nr));
      this.ext.push(0);
      if (n >= 2) {
        // Extend the segment quads at a bend so the outer side of the curve has no gaps.
        const ax = this.x[n - 1] - this.x[n - 2], ay = this.y[n - 1] - this.y[n - 2];
        const bx = x - this.x[n - 1], by = y - this.y[n - 1];
        const cr = ax * by - ay * bx, dt = ax * bx + ay * by;
        const phi = Math.min(1.25, Math.abs(Math.atan2(cr, dt)));
        this.ext[n - 1] = Math.max(this.hl[n - 1], this.hr[n - 1]) * Math.tan(phi / 2) * 1.08 + 0.6;
      }
      this.length = arc;
      // Crumbs of pigment break off near the edges as the stick drags.
      while (this.crumbDensity > 0 && arc >= this.nextCrumb && n >= 1) {
        this._crumbAt(n, 0.86, 1.22);
        this.nextCrumb += (22 + this.rnd() * 48) / this.crumbDensity;
      }
    }

    _crumbAt(i, latMin, latMax, along) {
      const r = this.rnd;
      const j = Math.max(1, Math.min(this.x.length - 1, i));
      let tx = this.x[j] - this.x[j - 1], ty = this.y[j] - this.y[j - 1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const side = r() < 0.5 ? 1 : -1;
      const hw = side > 0 ? this.hl[j] : this.hr[j];
      const lat = hw * (latMin + (latMax - latMin) * r() * r()) * side;
      const a = along || 0;
      this.crumbs.push({
        x: this.x[j] - ty * lat + tx * a + (r() - 0.5) * 2,
        y: this.y[j] + tx * lat + ty * a + (r() - 0.5) * 2,
        r: (0.55 + r() * r() * 1.0) * Math.min(1.4, Math.max(0.7, this.hw / 12)),
        amt: 0.35 + r() * 0.45,
        arc: this.arc[j] + a,
        seed: (r() * 1e9) | 0,
      });
    }

    // Lift-off: a short tail along the last direction with falling pressure, plus a few crumbs.
    finish(tail) {
      const n = this.x.length;
      if (n < 2) return;
      if (tail) {
        let tx = this.x[n - 1] - this.x[n - 2], ty = this.y[n - 1] - this.y[n - 2];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const p0 = this.p[n - 1], steps = 5, len = Math.min(16, this.hw * 0.9);
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          this.add(this.x[n - 1] + tx * len * t, this.y[n - 1] + ty * len * t, p0 * (1 - t * 0.85));
        }
      }
      if (this.crumbDensity > 0) {
        const m = this.x.length, count = 2 + ((this.rnd() * 3) | 0);
        for (let k = 0; k < count; k++) this._crumbAt(m - 1, 0, 0.9, this.rnd() * this.hw * 0.7);
      }
    }
  }

  // Centripetal Catmull-Rom through control points, resampled every `spacing` CSS px.
  function catmullRom(pts, spacing) {
    if (pts.length < 2) return pts.slice();
    const P = [];
    for (const p of pts) if (!P.length || Math.hypot(p[0] - P[P.length - 1][0], p[1] - P[P.length - 1][1]) > 0.01) P.push(p);
    if (P.length < 2) return P;
    const a = P[0], b = P[1], y = P[P.length - 2], z = P[P.length - 1];
    const Q = [[2 * a[0] - b[0], 2 * a[1] - b[1]], ...P, [2 * z[0] - y[0], 2 * z[1] - y[1]]];
    const dense = [];
    const tj = (p, q) => Math.sqrt(Math.hypot(q[0] - p[0], q[1] - p[1])) + 1e-6;
    const m = (p, q, ta, tb, t) => {
      const k = (t - ta) / (tb - ta);
      return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    };
    for (let i = 0; i < Q.length - 3; i++) {
      const p0 = Q[i], p1 = Q[i + 1], p2 = Q[i + 2], p3 = Q[i + 3];
      const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
      const steps = Math.max(6, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
      for (let s = 0; s < steps; s++) {
        const t = t1 + ((t2 - t1) * s) / steps;
        const A1 = m(p0, p1, t0, t1, t), A2 = m(p1, p2, t1, t2, t), A3 = m(p2, p3, t2, t3, t);
        const B1 = m(A1, A2, t0, t2, t), B2 = m(A2, A3, t1, t3, t);
        dense.push(m(B1, B2, t1, t2, t));
      }
    }
    dense.push(P[P.length - 1]);
    return resample(dense, spacing);
  }

  function resample(dense, spacing) {
    const out = [dense[0]];
    let carry = 0;
    for (let i = 1; i < dense.length; i++) {
      const p = dense[i - 1], q = dense[i];
      const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
      let d = spacing - carry;
      while (d <= seg) {
        const t = d / seg;
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        d += spacing;
      }
      carry = seg - (d - spacing);
    }
    const last = dense[dense.length - 1], o = out[out.length - 1];
    if (Math.hypot(last[0] - o[0], last[1] - o[1]) > spacing * 0.3) out.push(last);
    return out;
  }

  // Builds a finished stroke from control points.
  // o: { color, hw, pressure (peak, ~0.9-1.3), seed, inPx, outPx, lift, wobble, crumbs, tail }
  function strokeFrom(points, o) {
    const st = new Stroke(o);
    const pts = catmullRom(points, o.spacing || 2.5);
    let L = 0;
    const arcs = [0];
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      arcs.push(L);
    }
    const peak = o.pressure || 1.05;
    const inT = Math.min(0.2, (o.inPx || 16) / Math.max(L, 1));
    const outT = Math.min(0.35, (o.outPx || 34) / Math.max(L, 1));
    const lift = o.lift == null ? 0.55 : o.lift;
    for (let i = 0; i < pts.length; i++) {
      const t = arcs[i] / Math.max(L, 1);
      let p = peak * (0.9 + 0.2 * vnoise1(arcs[i] / 48, st.seed + 31));
      if (t < inT) p *= 0.42 + 0.58 * sstep(t / inT);
      if (t > 1 - outT) p *= 1 - lift * sstep((t - (1 - outT)) / outT);
      st.add(pts[i][0], pts[i][1], p);
    }
    st.finish(o.tail !== false);
    return st;
  }

  // ---------- Surface ----------
  const surfaces = new Set();

  class Surface {
    // o: { paperEl, dark, maxPixels, dprCap, width, height, scale } (width/height/scale: offscreen)
    constructor(canvas, o = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.paperEl = o.paperEl || null;
      this.dark = !!o.dark;
      this.maxPx = o.maxPixels || 2.6e6;
      this.dprCap = o.dprCap || 2;
      this.fixed = o.width ? o : null;
      this.W = 0; this.H = 0; this.scale = 1; this.ox = 0; this.oy = 0;
      this.amt = null; this.dirty = null;
      this.shadowRGB = this.dark ? [16, 10, 22] : [74, 54, 80];
      this.measure();
      surfaces.add(this);
    }

    // Reads the canvas's CSS box, sets the backing store, and aligns the tooth with the paper.
    // Returns true when the backing store changed size (its pixels are then cleared).
    measure() {
      let cssW, cssH, scale, ox = 0, oy = 0;
      if (this.fixed) {
        cssW = this.fixed.width; cssH = this.fixed.height; scale = this.fixed.scale || 2;
      } else {
        const r = this.canvas.getBoundingClientRect();
        cssW = Math.max(1, Math.round(r.width));
        cssH = Math.max(1, Math.round(r.height));
        scale = Math.min(window.devicePixelRatio || 1, this.dprCap);
        if (cssW * cssH * scale * scale > this.maxPx) scale = Math.max(0.75, Math.sqrt(this.maxPx / (cssW * cssH)));
        // The main paper is the root background, anchored at the document origin.
        let px = -window.scrollX, py = -window.scrollY;
        if (this.paperEl) { const pr = this.paperEl.getBoundingClientRect(); px = pr.left; py = pr.top; }
        ox = r.left - px; oy = r.top - py;
      }
      const W = Math.max(1, Math.round(cssW * scale)), H = Math.max(1, Math.round(cssH * scale));
      const changed = W !== this.W || H !== this.H;
      this.cssW = cssW; this.cssH = cssH;
      this.scale = W / cssW;
      this.ox = ox; this.oy = oy;
      if (changed) {
        this.W = W; this.H = H;
        this.canvas.width = W; this.canvas.height = H;
        this.amt = null;
      }
      // Tooth lookup tables, so device pixel (x, y) reads the paper texel under it.
      const k = 1 / this.scale;
      if (!this.tu || this.tu.length !== W) this.tu = new Int32Array(W);
      if (!this.tv || this.tv.length !== H) this.tv = new Int32Array(H);
      for (let x = 0; x < W; x++) this.tu[x] = Math.floor((ox + (x + 0.5) * k) * TD) & NM;
      for (let y = 0; y < H; y++) this.tv[y] = (Math.floor((oy + (y + 0.5) * k) * TD) & NM) * N;
      return changed;
    }

    ensure() {
      if (this.amt) return;
      const n = this.W * this.H;
      this.amt = new Float32Array(n);
      this.col = new Uint8ClampedArray(n * 3);
      this.pq = new Uint8Array(n);
      this.pk = new Uint16Array(n);
    }

    // Frees the pigment buffers. The canvas keeps its pixels.
    release() { this.amt = this.col = this.pq = this.pk = null; this.dirty = null; }

    clear() {
      if (this.amt) { this.amt.fill(0); this.col.fill(0); this.pq.fill(0); this.pk.fill(0); }
      this.dirty = null;
      this.ctx.clearRect(0, 0, this.W, this.H);
    }

    // Keeps a short list of dirty rectangles; merges one into another only when that stays compact.
    markDirty(x0, y0, x1, y1) {
      if (!this.dirty) this.dirty = [];
      const L = this.dirty, area = (r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
      const r = { x0, y0, x1, y1 };
      for (let i = 0; i < L.length; i++) {
        const d = L[i];
        const u = { x0: Math.min(d.x0, x0), y0: Math.min(d.y0, y0), x1: Math.max(d.x1, x1), y1: Math.max(d.y1, y1) };
        if (area(u) <= (area(d) + area(r)) * 1.35 + 4096) { L[i] = u; return; }
      }
      if (L.length < 8) { L.push(r); return; }
      const d = L[L.length - 1];
      L[L.length - 1] = { x0: Math.min(d.x0, x0), y0: Math.min(d.y0, y0), x1: Math.max(d.x1, x1), y1: Math.max(d.y1, y1) };
    }

    // Deposits segments k0..k1-1 of a stroke (segment k joins samples k and k+1).
    deposit(st, k0, k1) {
      if (k1 <= k0) return;
      this.ensure();
      const W = this.W, H = this.H, sc = this.scale;
      const amt = this.amt, col = this.col, pq = this.pq, pk = this.pk, tu = this.tu, tv = this.tv, T = tooth;
      const cr = st.color[0], cg = st.color[1], cb = st.color[2];
      const streak = st.streak, sOff = st.sOff, sMax = streak.length - 1, asym = st.asym;
      const keyHi = st.keyHi, passLen = st.passLen, seed = st.seed;
      const SX = st.x, SY = st.y, ARC = st.arc, HL = st.hl, HR = st.hr, PP = st.p, EXT = st.ext, GR = st.grooves;
      const q8 = this._q || (this._q = new Float64Array(8));
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let k = k0; k < k1; k++) {
        const ax = SX[k] * sc, ay = SY[k] * sc, bx = SX[k + 1] * sc, by = SY[k + 1] * sc;
        let ux = bx - ax, uy = by - ay;
        const len = Math.sqrt(ux * ux + uy * uy);
        if (len < 1e-4) continue;
        ux /= len; uy /= len;
        const nx = -uy, ny = ux;
        const hlA = HL[k] * sc, hlB = HL[k + 1] * sc, hrA = HR[k] * sc, hrB = HR[k + 1] * sc;
        const pA = PP[k], pB = PP[k + 1];
        const rL = Math.max(hlA, hlB) * 1.1 + 1, rR = Math.max(hrA, hrB) * 1.1 + 1;
        const e0 = EXT[k] * sc, e1 = EXT[k + 1] * sc;
        const sx0 = ax - ux * e0, sy0 = ay - uy * e0, sx1 = bx + ux * e1, sy1 = by + uy * e1;
        q8[0] = sx0 + nx * rL; q8[1] = sy0 + ny * rL;
        q8[2] = sx1 + nx * rL; q8[3] = sy1 + ny * rL;
        q8[4] = sx1 - nx * rR; q8[5] = sy1 - ny * rR;
        q8[6] = sx0 - nx * rR; q8[7] = sy0 - ny * rR;
        const qy0 = Math.min(q8[1], q8[3], q8[5], q8[7]), qy1 = Math.max(q8[1], q8[3], q8[5], q8[7]);
        const yS = Math.max(0, Math.floor(qy0)), yE = Math.min(H - 1, Math.ceil(qy1));
        const arcA = ARC[k], arcSpan = ARC[k + 1] - arcA;
        for (let y = yS; y <= yE; y++) {
          const yc = y + 0.5;
          let xl = Infinity, xr = -Infinity;
          for (let e = 0; e < 8; e += 2) {
            const x0 = q8[e], y0 = q8[e + 1], x1 = q8[(e + 2) & 7], y1 = q8[(e + 3) & 7];
            if (y0 !== y1 && (yc - y0) * (yc - y1) <= 0) {
              const xi = x0 + ((x1 - x0) * (yc - y0)) / (y1 - y0);
              if (xi < xl) xl = xi;
              if (xi > xr) xr = xi;
            }
          }
          if (xl > xr) continue;
          const xS = Math.max(0, Math.floor(xl)), xE = Math.min(W - 1, Math.ceil(xr) - 1);
          if (xS > xE) continue;
          const row = y * W, tvy = tv[y], py = yc - ay;
          for (let x = xS; x <= xE; x++) {
            const px = x + 0.5 - ax;
            const along = px * ux + py * uy;
            const lat = px * nx + py * ny;
            let u = along / len;
            if (u < 0) u = 0; else if (u > 1) u = 1;
            const left = lat >= 0;
            const arc = arcA + arcSpan * u;
            // Fine chipping along each edge.
            const chip = 1 + (vnoise1(arc * 0.45 + (left ? 0 : 913.7), seed) - 0.5) * 0.18;
            const hw = (left ? hlA + (hlB - hlA) * u : hrA + (hrB - hrA) * u) * chip;
            const al = left ? lat : -lat;
            if (al >= hw) continue;
            const s = al / hw;
            let prof = s <= 0.56 ? 1 : 1 - sstep((s - 0.56) / 0.44);
            prof *= 1 + asym * (lat / hw);
            const latC = lat / sc;
            let si = (latC * 2 + sOff) | 0;
            if (si < 0) si = 0; else if (si > sMax) si = sMax;
            let gf = 1;
            for (let g = 0; g < GR.length; g += 4) {
              const kq = 1 - Math.abs(latC - GR[g]) / GR[g + 1];
              if (kq > 0) gf *= 1 - GR[g + 2] * kq * sstep((vnoise1(arc / 34, GR[g + 3]) - 0.42) / 0.3);
            }
            const e = (pA + (pB - pA) * u) * prof * streak[si] * gf;
            if (e < 0.03) continue;
            const i = row + x;
            const a = amt[i];
            const hEff = T[tvy + tu[x]] + (a < 1.6 ? a : 1.6) * BUILD;
            const lo = 1 - e - SOFT;
            if (hEff <= lo) continue;
            const dep = hEff >= lo + SOFT2 ? 1 : sstep((hEff - lo) / SOFT2);
            const q = dep * (e >= 1.3 ? 1 : e <= 0.5 ? 0.385 : e / 1.3);
            const key = keyHi | (((arc / passLen) | 0) & 1023);
            const old = pk[i];
            let prev = 0;
            if (old !== 0 && (old & 0xfc00) === keyHi) {
              const dk = ((key & 1023) - (old & 1023)) & 1023;
              if (dk <= 1 || dk === 1023) prev = pq[i] * (1 / 255);
            }
            if (q <= prev + 0.003) continue;
            const dA = (q - prev) * DEP;
            const w = dA / (a * COVER + dA);
            const ci = i * 3;
            col[ci] += (cr - col[ci]) * w;
            col[ci + 1] += (cg - col[ci + 1]) * w;
            col[ci + 2] += (cb - col[ci + 2]) * w;
            amt[i] = a + dA;
            pq[i] = (q * 255 + 0.5) | 0;
            pk[i] = key;
            if (x < bx0) bx0 = x;
            if (x > bx1) bx1 = x;
            if (y < by0) by0 = y;
            if (y > by1) by1 = y;
          }
        }
      }
      if (bx1 >= bx0) this.markDirty(bx0, by0, bx1, by1);
    }

    // A crumb: a tiny dome of caked pigment.
    crumb(st, c) {
      this.ensure();
      const W = this.W, H = this.H, sc = this.scale;
      const X = c.x * sc, Y = c.y * sc, R = Math.max(0.7, c.r * sc);
      const x0 = Math.max(0, Math.floor(X - R - 1)), x1 = Math.min(W - 1, Math.ceil(X + R + 1));
      const y0 = Math.max(0, Math.floor(Y - R - 1)), y1 = Math.min(H - 1, Math.ceil(Y + R + 1));
      if (x0 > x1 || y0 > y1) return;
      const amt = this.amt, col = this.col;
      // Loose dust reads a little lighter than the pressed stroke.
      const cr = st.color[0] + (255 - st.color[0]) * 0.18, cg = st.color[1] + (255 - st.color[1]) * 0.18, cb = st.color[2] + (255 - st.color[2]) * 0.18;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - X, dy = y + 0.5 - Y;
          const d = (Math.sqrt(dx * dx + dy * dy) / R) * (0.8 + 0.4 * rnd2(x, y, c.seed));
          if (d >= 1) continue;
          const i = y * W + x, a = amt[i];
          const dA = c.amt * (1 - d * d);
          const w = dA / (a * COVER + dA), ci = i * 3;
          col[ci] += (cr - col[ci]) * w;
          col[ci + 1] += (cg - col[ci + 1]) * w;
          col[ci + 2] += (cb - col[ci + 2]) * w;
          amt[i] = a + dA;
        }
      }
      this.markDirty(x0, y0, x1, y1);
    }

    // Deposits everything of a stroke up to sample index `upto` (exclusive of later segments).
    advance(st, upto) {
      const k1 = Math.min(upto, st.n - 1);
      if (k1 > st.doneSeg) { this.deposit(st, st.doneSeg, k1); st.doneSeg = k1; }
      const reach = st.n ? st.arc[Math.min(k1, st.n - 1)] : 0;
      while (st.doneCrumb < st.crumbs.length && st.crumbs[st.doneCrumb].arc <= reach + 0.01) {
        this.crumb(st, st.crumbs[st.doneCrumb++]);
      }
    }

    finishStroke(st) {
      this.advance(st, st.n - 1);
      while (st.doneCrumb < st.crumbs.length) this.crumb(st, st.crumbs[st.doneCrumb++]);
    }

    // Shades the dirty rectangles and writes them to the canvas, in bands to keep memory small.
    flush() {
      const list = this.dirty;
      this.dirty = null;
      if (!list || !this.amt) return;
      for (const D of list) {
        for (let y = D.y0; y <= D.y1; y += 160) {
          this._flushRect({ x0: D.x0, y0: y, x1: D.x1, y1: Math.min(D.y1, y + 159) });
        }
      }
    }

    _flushRect(D) {
      const W = this.W, H = this.H, sc = this.scale, amt = this.amt, col = this.col;
      const BR = Math.max(1, Math.round(1.1 * sc));
      const SO = Math.max(1, Math.round(1.5 * sc));
      const M = BR + SO + 2;
      const ox0 = Math.max(0, D.x0 - M), oy0 = Math.max(0, D.y0 - M);
      const ox1 = Math.min(W - 1, D.x1 + M), oy1 = Math.min(H - 1, D.y1 + M);
      const P = M + 1;
      const ow = ox1 - ox0 + 1, oh = oy1 - oy0 + 1;
      const gw = ow + 2 * P, gh = oh + 2 * P, gx0 = ox0 - P, gy0 = oy0 - P;
      const A = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) {
        const sy = gy0 + gy;
        if (sy < 0 || sy >= H) continue;
        const srow = sy * W, drow = gy * gw - gx0;
        const xa = Math.max(0, gx0), xb = Math.min(W - 1, gx0 + gw - 1);
        for (let sx = xa; sx <= xb; sx++) A[drow + sx] = amt[srow + sx];
      }
      const B = boxBlur(A, gw, gh, BR);
      const img = this.ctx.createImageData(ow, oh), d = img.data;
      const kR = 0.88 * sc * 0.5, kF = 0.065;
      const dark = this.dark;
      const SR = this.shadowRGB[0], SG = this.shadowRGB[1], SB = this.shadowRGB[2];
      const shK = dark ? 0.8 : 0.62, shMax = dark ? 0.45 : 0.32;
      const tu = this.tu, tv = this.tv, T = tooth;
      for (let y = 0; y < oh; y++) {
        const sy = oy0 + y, grow = (y + P) * gw + P, tvy = tv[sy];
        for (let x = 0; x < ow; x++) {
          const gi = grow + x, oi = (y * ow + x) * 4;
          const a = A[gi], b = B[gi];
          const sh = B[gi - SO - SO * gw] - b;
          if (a > 0.004) {
            const sx = ox0 + x;
            let L = (B[gi + 1] - B[gi - 1] + B[gi + gw] - B[gi - gw]) * kR;
            L += (A[gi + 1] - A[gi - 1] + A[gi + gw] - A[gi - gw]) * kF;
            const cake = sstep((a - 0.55) / 1.3);
            // Thin chalk shows the paper grain catching light; caked chalk is smoother.
            L += (T[tvy + tu[sx]] - 0.5) * 0.09 * (1 - cake);
            if (L > 0.34) L = 0.34; else if (L < -0.3) L = -0.3;
            const ci = (sy * W + sx) * 3;
            const rich = 1 - 0.08 * cake;
            let r = col[ci] * rich, g = col[ci + 1] * rich, bl = col[ci + 2] * rich;
            if (L > 0) { r += (255 - r) * L; g += (255 - g) * L; bl += (255 - bl) * L; }
            else { r *= 1 + L; g *= 1 + L; bl *= 1 + L; }
            let alpha = 1 - Math.exp(-3.4 * a);
            if (sh > 0.004) {
              const s = Math.min(shMax, sh * shK);
              // Shadow on the pigment itself, plus on the paper that shows through thin chalk.
              r *= 1 - s * 0.4; g *= 1 - s * 0.4; bl *= 1 - s * 0.4;
              const pa = (1 - alpha) * s;
              const outA = alpha + pa;
              r = (r * alpha + SR * pa) / outA; g = (g * alpha + SG * pa) / outA; bl = (bl * alpha + SB * pa) / outA;
              alpha = outA;
            }
            d[oi] = r; d[oi + 1] = g; d[oi + 2] = bl; d[oi + 3] = alpha * 255;
          } else if (sh > 0.004) {
            d[oi] = SR; d[oi + 1] = SG; d[oi + 2] = SB;
            d[oi + 3] = Math.min(shMax, sh * shK) * 255;
          }
        }
      }
      this.ctx.putImageData(img, ox0, oy0);
    }

    destroy() { surfaces.delete(this); this.release(); }
  }

  function boxBlur(A, w, h, r) {
    const Tm = new Float32Array(w * h), B = new Float32Array(w * h), inv = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let s = 0;
      for (let x = -r; x <= r; x++) s += A[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        Tm[row + x] = s * inv;
        s += A[row + Math.min(w - 1, x + r + 1)] - A[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += Tm[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        B[y * w + x] = s * inv;
        s += Tm[Math.min(h - 1, y + r + 1) * w + x] - Tm[Math.max(0, y - r) * w + x];
      }
    }
    return B;
  }

  // ---------- Frame loop ----------
  const tasks = new Set();
  let rafId = 0;
  function frame(now) {
    rafId = 0;
    for (const t of tasks) {
      if (t(now) === false) tasks.delete(t);
    }
    for (const s of surfaces) if (s.dirty) s.flush();
    if (tasks.size) rafId = requestAnimationFrame(frame);
  }
  function addTask(fn) {
    tasks.add(fn);
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function kick() { if (!rafId) rafId = requestAnimationFrame(frame); }

  // ---------- Sticks ----------
  let uidSeq = 0;
  // Local frame: the tip touches the paper at (0, 0) and the body runs toward -x.
  function stickSVG(key, L, D) {
    const uid = 'pst' + ++uidSeq;
    const base = PALETTE[key].css;
    const r = D / 2, tl = D * 1.05;
    const deep = mixHex(base, INK, 0.34), face = mixHex(base, '#ffffff', 0.34), wrap = mixHex(base, '#FBF6EC', 0.8);
    const band = mixHex(base, INK, 0.16);
    const f = (v) => +v.toFixed(2);
    const body = `M${f(-L + 3)} ${f(-r)}H-4Q0 ${f(-r)} 0 0L${f(-tl)} ${f(r)}H${f(-L + 3)}Q${f(-L)} ${f(r)} ${f(-L)} ${f(r - 3)}V${f(-r + 3)}Q${f(-L)} ${f(-r)} ${f(-L + 3)} ${f(-r)}Z`;
    const facePath = `M${f(-D * 0.66)} ${f(-r)}H-4Q0 ${f(-r)} 0 0L${f(-tl)} ${f(r)}Q${f(-tl - D * 0.26)} ${f(r * 0.05)} ${f(-D * 0.66)} ${f(-r)}Z`;
    const wx0 = -L * 0.9, wx1 = -L * 0.5;
    let tear = `M${f(wx0)} ${f(-r - 1)}H${f(wx1)}`;
    const teeth = 8;
    for (let i = 1; i <= teeth; i++) tear += `L${f(wx1 + (i % 2 ? 1.8 : -0.4))} ${f(-r + (D * i) / teeth)}`;
    tear += `L${f(wx1)} ${f(r + 1)}H${f(wx0)}Z`;
    const bw = (wx1 - wx0) * 0.3, bx = wx0 + (wx1 - wx0) * 0.22;
    const bands = `M${f(wx0 + 3.5)} ${f(-r)}V${f(r)}M${f(wx1 - 6)} ${f(-r)}V${f(r)}M${f(wx1 - 3.6)} ${f(-r)}V${f(r)}`;
    return `<svg class="pst-svg" viewBox="${f(-L - 3)} ${f(-r - 3)} ${f(L + 6)} ${f(D + 6)}" width="${f(L + 6)}" height="${f(D + 6)}" aria-hidden="true" focusable="false">
<defs>
<clipPath id="c${uid}"><path d="${body}"/></clipPath>
<linearGradient id="g${uid}" x1="0" y1="${f(-r)}" x2="0" y2="${f(r)}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".16" stop-color="#fff" stop-opacity=".62"/>
<stop offset=".3" stop-color="#fff" stop-opacity=".12"/><stop offset=".52" stop-color="#fff" stop-opacity="0"/>
<stop offset=".78" stop-color="${deep}" stop-opacity=".22"/><stop offset="1" stop-color="${deep}" stop-opacity=".62"/>
</linearGradient>
<filter id="n${uid}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="${uidSeq % 89}"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -1.45"/>
</filter>
</defs>
<g clip-path="url(#c${uid})">
<rect x="${f(-L)}" y="${f(-r)}" width="${f(L)}" height="${f(D)}" fill="${base}"/>
<path d="${facePath}" fill="${face}"/>
<rect x="${f(-L)}" y="${f(-r)}" width="${f(L)}" height="${f(D)}" filter="url(#n${uid})" opacity=".42"/>
<path d="${tear}" fill="${wrap}"/>
<rect x="${f(bx)}" y="${f(-r)}" width="${f(bw)}" height="${f(D)}" fill="${band}"/>
<path d="${bands}" stroke="${deep}" stroke-opacity=".5" stroke-width="1.1" fill="none"/>
<g class="pst-shade"><rect x="${f(-L)}" y="${f(-r)}" width="${f(L)}" height="${f(D)}" fill="url(#g${uid})"/></g>
<ellipse cx="${f(-L + 1.2)}" cy="0" rx="2.4" ry="${f(r)}" fill="${deep}" opacity=".32"/>
</g>
</svg>`;
  }

  // Which side of a stick at page angle `a` faces the top-left light.
  function lightFacing(a) { return (Math.cos(a) - Math.sin(a)) * Math.SQRT1_2; }
  function shadeStick(svg, a) {
    const g = svg.querySelector('.pst-shade');
    if (!g) return;
    const fct = lightFacing(a);
    g.setAttribute('transform', fct >= 0 ? '' : 'scale(1,-1)');
    g.setAttribute('opacity', (0.45 + 0.55 * Math.abs(fct)).toFixed(2));
  }

  // A stick that moves over a layer element (positioned, same box as its surface's canvas).
  class Stick {
    constructor(layer, key, o = {}) {
      this.key = key;
      this.L = o.len || 118;
      this.D = o.dia || 30;
      this.layer = layer;
      this.shadow = document.createElement('div');
      this.shadow.className = 'pst-shadow';
      this.el = document.createElement('div');
      this.el.className = 'pst';
      this.el.innerHTML = stickSVG(key, this.L, this.D);
      this.svg = this.el.firstElementChild;
      const ow = this.L + 3, oh = this.D / 2 + 3;
      this.ow = ow; this.oh = oh;
      this.el.style.transformOrigin = `${ow}px ${oh}px`;
      this.shadow.style.height = Math.round(this.D * 0.78) + 'px';
      layer.appendChild(this.shadow);
      layer.appendChild(this.el);
      this.x = 0; this.y = 0; this.a = 0; this.lastShadeA = 99;
      this.set(0, 0, 0, 1, 0);
    }
    // x, y: tip position in layer px; a: axis angle (radians, back end -> tip); lift: 0 touching .. 1 raised.
    set(x, y, a, lift, opacity) {
      this.x = x; this.y = y; this.a = a;
      const s = 1 + 0.07 * lift;
      this.el.style.transform = `translate(${(x - this.ow).toFixed(1)}px,${(y - this.oh - 5 * lift).toFixed(1)}px) rotate(${a.toFixed(3)}rad) scale(${s.toFixed(3)})`;
      this.el.style.opacity = opacity;
      if (Math.abs(a - this.lastShadeA) > 0.05) { shadeStick(this.svg, a); this.lastShadeA = a; }
      // Shadow: touches the paper at the tip, falls away toward the raised back end.
      const ca = Math.cos(a), sa = Math.sin(a);
      const bx = x - ca * this.L, by = y - sa * this.L;
      const k = 1 + 1.7 * lift;
      const s0x = x + 1.5 * k, s0y = y + 2.5 * k;
      const s1x = bx + 11 * k, s1y = by + 15 * k;
      const len = Math.hypot(s1x - s0x, s1y - s0y);
      const ang = Math.atan2(s1y - s0y, s1x - s0x);
      const hh = this.D * 0.39;
      this.shadow.style.width = (len + 6).toFixed(1) + 'px';
      this.shadow.style.transform = `translate(${(s0x - 3).toFixed(1)}px,${(s0y - hh).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      this.shadow.style.transformOrigin = `3px ${hh.toFixed(1)}px`;
      this.shadow.style.opacity = (opacity * (0.95 - 0.45 * lift)).toFixed(3);
    }
    remove() { this.el.remove(); this.shadow.remove(); }
  }

  // ---------- Animated drawing ----------
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Drag profile: quick touch-down, steady pull, gentle slow-down before lift-off.
  const EASE_N = 128;
  const easeTable = (() => {
    const v = (t) => (t < 0.14 ? 0.3 + 0.7 * sstep(t / 0.14) : t > 0.78 ? 1 - 0.62 * sstep((t - 0.78) / 0.22) : 1);
    const out = new Float32Array(EASE_N + 1);
    let acc = 0;
    for (let i = 1; i <= EASE_N; i++) { acc += v((i - 0.5) / EASE_N); out[i] = acc; }
    for (let i = 1; i <= EASE_N; i++) out[i] /= acc;
    return out;
  })();
  const easeDraw = (t) => {
    const f = clamp(t, 0, 1) * EASE_N, i = Math.min(EASE_N - 1, f | 0);
    return easeTable[i] + (easeTable[i + 1] - easeTable[i]) * (f - i);
  };
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  function tangentAt(st, i) {
    const n = st.n;
    const j0 = Math.max(0, Math.min(n - 2, i - 2)), j1 = Math.min(n - 1, Math.max(1, i + 2));
    return Math.atan2(st.y[j1] - st.y[j0], st.x[j1] - st.x[j0]);
  }

  // Animates strokes onto a surface with sticks traveling along them. Resolves when finished.
  // items: [{ stroke, stick: palette key }] in order. o: { speed (px/s), tilt (rad), stickLen, stickDia, delay }
  function draw(surface, layer, items, o = {}) {
    if (reduced || o.instant || !layer) return drawInstant(surface, items.map((it) => it.stroke || it));
    return new Promise((resolve) => {
      const speed = o.speed || 950, tilt = o.tilt == null ? 0.62 : o.tilt;
      let idx = 0, phase = 'wait', t0 = 0, stick = null, from = null, prevNow = 0, cancelled = false;
      let ang = 0;
      const job = { cancel() { cancelled = true; } };
      const startPhase = (p, now) => { phase = p; t0 = now; };
      const end = () => { if (stick) stick.remove(); stick = null; resolve(job); };
      const step = (now) => {
        if (cancelled) { end(); return false; }
        if (!t0) { t0 = now; prevNow = now; }
        const dt = Math.min(64, now - prevNow);
        prevNow = now;
        const it = items[idx];
        const st = it && it.stroke;
        if (phase === 'wait') {
          if (now - t0 >= (o.delay || 0)) startPhase('enter', now);
          return true;
        }
        if (phase === 'enter') {
          if (!stick || stick.key !== it.stick) {
            if (stick) stick.remove();
            stick = new Stick(layer, it.stick, { len: o.stickLen, dia: o.stickDia });
            const a0 = tangentAt(st, 0) + tilt;
            ang = a0;
            from = { x: st.x[0] + 70, y: st.y[0] - 90, a: a0 - 0.5, op: 0, lift: 1 };
          } else {
            from = { x: stick.x, y: stick.y, a: ang, op: 1, lift: 0.35 };
          }
          startPhase('approach', now);
        }
        if (phase === 'approach') {
          const dist = Math.hypot(st.x[0] - from.x, st.y[0] - from.y);
          const dur = from.op === 0 ? 420 : clamp(160 + dist * 0.9, 180, 420);
          const t = clamp((now - t0) / dur, 0, 1), e = easeInOut(t);
          const target = tangentAt(st, 0) + tilt;
          ang = from.a + angDiff(from.a, target) * e;
          const lift = from.op === 0 ? 1 - e : Math.sin(Math.PI * t) * 0.6 * (1 - t) + (1 - e) * 0.2;
          stick.set(from.x + (st.x[0] - from.x) * e, from.y + (st.y[0] - from.y) * e - Math.sin(Math.PI * t) * 14, ang, Math.max(0, lift), from.op + (1 - from.op) * Math.min(1, t * 2.2));
          if (t >= 1) startPhase('draw', now);
          return true;
        }
        if (phase === 'draw') {
          const L = st.length;
          const dur = Math.max(260, 140 + (L / speed) * 1000);
          const t = clamp((now - t0) / dur, 0, 1);
          const sArc = L * easeDraw(t);
          // Find the sample at the head.
          let j = Math.max(0, st.doneSeg);
          while (j < st.n - 1 && st.arc[j + 1] <= sArc) j++;
          surface.advance(st, j);
          const j1 = Math.min(st.n - 1, j + 1);
          const segL = st.arc[j1] - st.arc[j] || 1;
          const f = clamp((sArc - st.arc[j]) / segL, 0, 1);
          const hx = st.x[j] + (st.x[j1] - st.x[j]) * f, hy = st.y[j] + (st.y[j1] - st.y[j]) * f;
          const target = tangentAt(st, j) + tilt;
          ang += angDiff(ang, target) * (1 - Math.exp(-dt / 70));
          stick.set(hx, hy, ang, 0, 1);
          if (t >= 1) {
            surface.finishStroke(st);
            idx++;
            if (idx < items.length) startPhase('enter', now);
            else { from = { x: hx, y: hy, a: ang }; startPhase('exit', now); }
          }
          return true;
        }
        if (phase === 'exit') {
          const t = clamp((now - t0) / 380, 0, 1), e = easeInOut(t);
          const ca = Math.cos(from.a), sa = Math.sin(from.a);
          stick.set(from.x + ca * 26 * e + 30 * e, from.y + sa * 26 * e - 50 * e, from.a + 0.35 * e, e, 1 - e);
          if (t >= 1) { end(); return false; }
          return true;
        }
        return false;
      };
      addTask(step);
      if (o.onJob) o.onJob(job);
    });
  }

  // Deposits strokes without animation, a time-boxed batch per frame.
  function drawInstant(surface, strokes) {
    return new Promise((resolve) => {
      let i = 0;
      addTask(() => {
        const t0 = performance.now();
        while (i < strokes.length && performance.now() - t0 < 10) {
          const st = strokes[i];
          const k1 = Math.min(st.n - 1, st.doneSeg + 40);
          surface.advance(st, k1);
          if (k1 >= st.n - 1) { surface.finishStroke(st); i++; }
        }
        if (i >= strokes.length) { resolve(); return false; }
        return true;
      });
    });
  }

  // Deposits strokes right now, in this task.
  function drawNow(surface, strokes) {
    for (const st of strokes) { st.doneSeg = 0; st.doneCrumb = 0; surface.finishStroke(st); }
    surface.flush();
  }

  // Renders strokes into an offscreen canvas and resolves to a blob URL, for marks used as CSS images.
  // o: { width, height (CSS px), scale, dark }
  async function markURL(strokes, o) {
    const c = document.createElement('canvas');
    const s = new Surface(c, { width: o.width, height: o.height, scale: o.scale || 2, dark: !!o.dark });
    drawNow(s, strokes);
    s.destroy();
    return toURL(c);
  }

  // ---------- Init ----------
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  const assets = {};

  async function init() {
    const t0 = performance.now();
    makeTooth();
    const light = paperCanvas([247, 241, 230], {
      relief: 0.075, ao: 0.05, grit: 0.03, lift: 0, fibers: 46, seed: 5,
      fiberDark: 'rgba(132, 108, 84, .10)', fiberLight: 'rgba(255, 255, 255, .55)',
    });
    const dark = paperCanvas([62, 53, 73], {
      relief: 0.12, ao: 0.08, grit: 0.06, lift: 0.06, fibers: 40, seed: 9,
      fiberDark: 'rgba(20, 14, 26, .25)', fiberLight: 'rgba(236, 226, 244, .10)',
    });
    const mottle = mottleCanvas(21);
    const [lu, du, mu] = await Promise.all([toURL(light), toURL(dark), toURL(mottle)]);
    const root = document.documentElement.style;
    root.setProperty('--paper-img', `url("${lu}")`);
    root.setProperty('--paper-dark-img', `url("${du}")`);
    root.setProperty('--mottle-img', `url("${mu}")`);
    assets.paper = lu; assets.paperDark = du;
    // Dabs: tiny real strokes from the engine, used as list bullets.
    const keys = Object.keys(PALETTE);
    const shapes = [
      [[7, 12.5], [14, 11], [22, 10.2]],
      [[7.5, 10.5], [15, 11.5], [21.5, 12.4]],
      [[8, 12], [13.5, 10.6], [18, 11.2], [22, 10.4]],
    ];
    await Promise.all(keys.flatMap((k, ki) => [false, true].flatMap((onDark) => shapes.map(async (pts, v) => {
      const c = document.createElement('canvas');
      const s = new Surface(c, { width: 30, height: 22, scale: 2, dark: onDark });
      const st = strokeFrom(pts, { color: k, hw: 4.4 + v * 0.3, pressure: 1.22, seed: 77 + ki * 13 + v * 101, inPx: 3, outPx: 5, lift: 0.3, crumbs: 0, tail: false });
      drawNow(s, [st]);
      s.destroy();
      const u = await toURL(c);
      root.setProperty(`--dab-${k}${onDark ? '-dk' : ''}-${v + 1}`, `url("${u}")`);
    }))));
    assets.ms = Math.round(performance.now() - t0);
    readyResolve(assets);
  }

  window.Pastel = {
    PALETTE, INK, reduced, ready, init, assets,
    Surface, Stroke, Stick, strokeFrom, catmullRom, resample, draw, drawInstant, drawNow, addTask, kick, markURL,
    stickSVG, shadeStick, lightFacing, prng, vnoise1, mixHex,
  };
})();
