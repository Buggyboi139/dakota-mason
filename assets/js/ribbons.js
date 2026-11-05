// Service ribbons drawn as SVG at true proportions: 1 3/8" × 3/8", in units of 1/32" (44 × 12).
// Stripe widths and colors match the Institute of Heraldry patterns.
// Usage: RIBBONS.rack() returns an SVG string for SITE.awards.ribbons; RIBBONS.ribbon(id) draws one.
(function () {
  const SCARLET = '#ba0c2f', BLUE = '#012169', GOLD = '#ffcd00', WHITE = '#ffffff';
  const LIGHT_BLUE = '#7bafd4';

  // [color, width] from the wearer's right edge to the left; widths sum to 44.
  const SPECS = {
    nam: [['#00843d', 6], ['#fc4c02', 6], ['#00843d', 20], ['#fc4c02', 6], ['#00843d', 6]],
    ndsm: [[SCARLET, 14], [WHITE, 1], [BLUE, 1], [WHITE, 1], [SCARLET, 1], [GOLD, 8], [SCARLET, 1], [WHITE, 1], [BLUE, 1], [WHITE, 1], [SCARLET, 14]],
    gwotem: [[LIGHT_BLUE, 5], [BLUE, 3], [WHITE, 2], [BLUE, 3], [LIGHT_BLUE, 2], [GOLD, 2], [LIGHT_BLUE, 2], [SCARLET, 6], [LIGHT_BLUE, 2], [GOLD, 2], [LIGHT_BLUE, 2], [BLUE, 3], [WHITE, 2], [BLUE, 3], [LIGHT_BLUE, 5]],
    gwotsm: [[BLUE, 5], [GOLD, 4], [SCARLET, 4], [BLUE, 2], [WHITE, 2], [BLUE, 10], [WHITE, 2], [BLUE, 2], [SCARLET, 4], [GOLD, 4], [BLUE, 5]],
    osr: [['#00c1d5', 4], [GOLD, 2], ['#041e42', 10], [GOLD, 2], [SCARLET, 8], [GOLD, 2], ['#041e42', 10], [GOLD, 2], ['#00c1d5', 4]],
    afrm: [[LIGHT_BLUE, 2], ['#f2c75c', 1], [LIGHT_BLUE, 2], ['#f2c75c', 1], [LIGHT_BLUE, 2], ['#f2c75c', 12], [LIGHT_BLUE, 4], ['#f2c75c', 12], [LIGHT_BLUE, 2], ['#f2c75c', 1], [LIGHT_BLUE, 2], ['#f2c75c', 1], [LIGHT_BLUE, 2]],
    rifle: [['#00263a', 5], ['#64a70b', 1], ['#00263a', 15.5], ['#64a70b', 1], ['#00263a', 15.5], ['#64a70b', 1], ['#00263a', 5]],
    pistol: [['#00263a', 5], ['#64a70b', 1], ['#00263a', 32], ['#64a70b', 1], ['#00263a', 5]],
  };

  const METALS = {
    gold: ['#fff1a8', '#d4a52c', '#8a6416'],
    bronze: ['#f0c995', '#a8743a', '#5c3a14'],
    silver: ['#ffffff', '#c3c7cc', '#6b7077'],
  };

  let uid = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function star(cx, cy, r, fill, stroke) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.42 : r;
      pts.push((cx + rr * Math.cos(a)).toFixed(3) + ',' + (cy + rr * Math.sin(a)).toFixed(3));
    }
    return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.35" stroke-linejoin="round"/>`;
  }

  // Block letters for the "M" (mobilization) and "E" (expert) devices, 1/4" tall.
  function letter(ch, cx, cy, fill, stroke) {
    const shapes = {
      M: [[0, 8], [0, 0], [1.7, 0], [3.5, 3.6], [5.3, 0], [7, 0], [7, 8], [5.5, 8], [5.5, 2.9], [4.1, 5.6], [2.9, 5.6], [1.5, 2.9], [1.5, 8]],
      E: [[0, 0], [5.2, 0], [5.2, 1.5], [1.6, 1.5], [1.6, 3.2], [4.6, 3.2], [4.6, 4.7], [1.6, 4.7], [1.6, 6.5], [5.2, 6.5], [5.2, 8], [0, 8]],
    }[ch];
    const w = Math.max(...shapes.map((p) => p[0]));
    const pts = shapes.map(([x, y]) => (cx - w / 2 + x).toFixed(2) + ',' + (cy - 4 + y).toFixed(2)).join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="0.35" stroke-linejoin="round"/>`;
  }

  function device(kind, id) {
    if (!kind) return '';
    const metal = { 'gold-star': 'gold', 'bronze-star': 'bronze', m: 'bronze', e: 'silver' }[kind];
    const [hi, mid, lo] = METALS[metal];
    const g = `dv${id}`;
    const grad = `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`;
    const fill = `url(#${g})`;
    let shape = '';
    if (kind === 'gold-star') shape = star(22, 6.1, 5, fill, lo); // 5/16"
    if (kind === 'bronze-star') shape = star(22, 6.1, 3, fill, lo); // 3/16"
    if (kind === 'm') shape = letter('M', 22, 6, fill, lo);
    if (kind === 'e') shape = letter('E', 22, 6, fill, lo);
    return `<defs>${grad}</defs><g filter="url(#ds${id})">${shape}</g>`;
  }

  // One ribbon as a <g> in a 44 × 12 box, with woven texture and a slight curve of light.
  function ribbonGroup(id, opts = {}) {
    const spec = SPECS[id];
    if (!spec) throw new Error('Unknown ribbon: ' + id);
    const n = ++uid;
    let x = 0;
    const stripes = spec.map(([c, w]) => { const r = `<rect x="${x}" y="0" width="${w + 0.02}" height="12" fill="${c}"/>`; x += w; return r; }).join('');
    const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
    return `<g${opts.transform ? ` transform="${opts.transform}"` : ''}>${title}
      <defs>
        <pattern id="wv${n}" width="0.8" height="12" patternUnits="userSpaceOnUse"><rect width="0.4" height="12" fill="#000" opacity=".07"/></pattern>
        <linearGradient id="sh${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
        <filter id="ds${n}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.25" dy="0.35" stdDeviation="0.25" flood-opacity=".45"/></filter>
      </defs>
      ${stripes}
      <rect width="44" height="12" fill="url(#wv${n})"/>
      <rect width="44" height="12" fill="url(#sh${n})"/>
      ${device(opts.device, n)}
      <rect x="0.15" y="0.15" width="43.7" height="11.7" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="0.3"/>
    </g>`;
  }

  function label(r) {
    return r.note ? `${r.name} (${r.note})` : r.name;
  }

  window.RIBBONS = {
    specs: SPECS,

    // A single ribbon. opts: { device, title, width (CSS px) }
    ribbon(id, opts = {}) {
      const w = opts.width || 132;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 12" width="${w}" height="${(w * 12) / 44}" role="img" aria-label="${esc(opts.title || id)}">${ribbonGroup(id, opts)}</svg>`;
    },

    // The full rack in order of precedence: rows of three, highest at top and inboard,
    // a short top row centered. opts: { list, width (CSS px of the whole rack), gap (1/32" units) }
    rack(opts = {}) {
      const list = opts.list || (window.SITE && SITE.awards && SITE.awards.ribbons) || [];
      const per = 3, gap = opts.gap == null ? 0 : opts.gap;
      const rows = [];
      const first = list.length % per || per;
      rows.push(list.slice(0, first));
      for (let i = first; i < list.length; i += per) rows.push(list.slice(i, i + per));
      const W = per * 44 + (per - 1) * gap;
      const H = rows.length * 12 + (rows.length - 1) * gap;
      const groups = rows.map((row, ri) => {
        const rowW = row.length * 44 + (row.length - 1) * gap;
        const x0 = (W - rowW) / 2;
        return row.map((r, i) => ribbonGroup(r.id, { device: r.device, title: label(r), transform: `translate(${x0 + i * (44 + gap)} ${ri * (12 + gap)})` })).join('');
      }).join('');
      const width = opts.width || 396;
      const aria = 'Ribbon rack: ' + list.map(label).join('; ');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${width}" height="${(width * H) / W}" role="img" aria-label="${esc(aria)}">${groups}</svg>`;
    },
  };
})();
