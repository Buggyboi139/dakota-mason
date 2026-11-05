// Mission patches: an original embroidered-style circular patch for each role.
// Twill field, satin-stitch emblem, merrowed edge, a running stitch, and the
// mission name and years set on circular text paths. Patches.svg(role) returns
// SVG markup in a 200 x 200 viewBox.
window.Patches = (function () {
  'use strict';

  let uid = 0;
  const C = 100;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Colorways, keyed by role id. edge = merrowed border thread, band = outer ring,
  // disk = center field, thread = lettering and main emblem, accent = second color.
  const STYLES = {
    research: { edge: '#e4e0d6', band: '#0f1012', disk: '#16181b', thread: '#ece9e1', accent: '#fc3d21', shade: '#9a978f', emblem: 'reticle' },
    va: { edge: '#b4bcc7', band: '#1c2530', disk: '#283443', thread: '#d2d8df', accent: '#21324f', shade: '#8a96a5', emblem: 'shield' },
    bahrain: { edge: '#d6c59b', band: '#113234', disk: '#194a4c', thread: '#e7d8af', accent: '#86b5ac', shade: '#5f9089', emblem: 'compass' },
    djibouti: { edge: '#e0c389', band: '#5a2616', disk: '#853a22', thread: '#efd5a0', accent: '#eeb24b', shade: '#c79a5c', emblem: 'dunes' },
    navy: { edge: '#c9a152', band: '#101c35', disk: '#182a4d', thread: '#dbb562', accent: '#e9e2d0', shade: '#a8853f', emblem: 'anchor' },
  };
  const ORDER = ['research', 'va', 'bahrain', 'djibouti', 'navy'];

  function styleFor(role, i) {
    return STYLES[role.id] || STYLES[ORDER[(i || 0) % ORDER.length]];
  }

  function starPath(cx, cy, R, r, n, rot) {
    n = n || 5; rot = rot == null ? -90 : rot;
    let d = '';
    for (let k = 0; k < n * 2; k++) {
      const a = (rot + (k * 180) / n) * Math.PI / 180;
      const rr = k % 2 ? r : R;
      d += (k ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  }

  // Satin stitch: fine parallel stripes of one thread color at an angle.
  function satin(id, color, angle, dark) {
    return '<pattern id="' + id + '" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(' + angle + ')">' +
      '<rect width="2.2" height="2.2" fill="' + color + '"/>' +
      '<rect y="1.45" width="2.2" height=".75" fill="#000" fill-opacity="' + (dark == null ? 0.2 : dark) + '"/></pattern>';
  }

  // Approximate advance widths (em) for Barlow Semi Condensed SemiBold capitals.
  function textWidth(s, fs) {
    let w = 0;
    for (const ch of s) {
      if (ch === ' ') w += 0.21;
      else if ('IJ1'.includes(ch)) w += 0.3;
      else if ('MW'.includes(ch)) w += 0.74;
      else if ('&'.includes(ch)) w += 0.62;
      else if ('–-'.includes(ch)) w += 0.42;
      else if ('0123456789'.includes(ch)) w += 0.52;
      else w += 0.56;
    }
    return w * fs;
  }

  function ringText(id, str, span, fsMax) {
    const n = Math.max(1, [...str].length);
    let fs = fsMax;
    const natural = textWidth(str, fs);
    if (natural + (n - 1) * 0.6 > span) fs = Math.max(10, fsMax * (span - (n - 1) * 0.6) / natural);
    const ls = Math.max(0.4, (span - textWidth(str, fs)) / Math.max(1, n - 1));
    return { fs: fs.toFixed(2), ls: ls.toFixed(2) };
  }

  const EMBLEMS = {
    reticle(st, p) {
      const specks = [[63, 70, 1.1], [139, 66, 0.9], [144, 128, 1.2], [58, 131, 0.8], [118, 52, 0.7], [76, 150, 0.9]]
        .map((s) => '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="' + st.thread + '" opacity=".75"/>').join('');
      return '<g clip-path="url(#' + p.clip + ')">' + specks + '</g>' +
        '<circle cx="100" cy="100" r="41" fill="none" stroke="url(#' + p.s1 + ')" stroke-width="3.4"/>' +
        '<circle cx="100" cy="100" r="41" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>' +
        '<circle cx="100" cy="100" r="28.5" fill="none" stroke="' + st.thread + '" stroke-width="1.15" stroke-dasharray="2.3 2.3" opacity=".85"/>' +
        '<path d="M100 46V66M100 134V154M46 100H66M134 100H154" stroke="url(#' + p.s1 + ')" stroke-width="2.8"/>' +
        '<path d="M94.8 100.35A9 9 0 1 1 105.2 100.35L108.6 117.5H91.4Z" fill="url(#' + p.s2 + ')" stroke="#000" stroke-opacity=".4" stroke-width=".7"/>';
    },
    shield(st, p) {
      return '<path d="M100 43L136 55.5V89C136 115.5 119.5 132 100 141.5C80.5 132 64 115.5 64 89V55.5Z" fill="url(#' + p.s1 + ')" stroke="#000" stroke-opacity=".4" stroke-width=".9"/>' +
        '<path d="M100 50.5L129 60.6V89C129 111.2 115.6 125 100 133.3C84.4 125 71 111.2 71 89V60.6Z" fill="none" stroke="' + st.band + '" stroke-width="1.15" stroke-dasharray="2.4 2" opacity=".8"/>' +
        '<path d="' + starPath(100, 91, 18.5, 7.6) + '" fill="url(#' + p.s2 + ')" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>';
    },
    compass(st, p) {
      const cx = 100, cy = 86;
      let pts = '';
      const draw = (deg, R, ri) => {
        const a = (deg - 90) * Math.PI / 180;
        const tip = [cx + R * Math.cos(a), cy + R * Math.sin(a)];
        const l = [cx + ri * Math.cos(a - Math.PI / 4), cy + ri * Math.sin(a - Math.PI / 4)];
        const r = [cx + ri * Math.cos(a + Math.PI / 4), cy + ri * Math.sin(a + Math.PI / 4)];
        const f = (q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2);
        pts += '<path d="M' + cx + ' ' + cy + 'L' + f(tip) + 'L' + f(l) + 'Z" fill="url(#' + p.s1 + ')"/>' +
          '<path d="M' + cx + ' ' + cy + 'L' + f(tip) + 'L' + f(r) + 'Z" fill="url(#' + p.s3 + ')"/>';
      };
      [45, 135, 225, 315].forEach((d) => draw(d, 19, 6));
      [0, 90, 180, 270].forEach((d) => draw(d, 37, 7.5));
      const wave = (y, amp) => {
        let d = 'M30 ' + y;
        for (let x = 30; x < 172; x += 20) d += 'C' + (x + 6) + ' ' + (y - amp) + ' ' + (x + 14) + ' ' + (y - amp) + ' ' + (x + 20) + ' ' + y;
        return d;
      };
      return '<g clip-path="url(#' + p.clip + ')">' +
        '<path d="' + wave(130, 7) + 'V176H30Z" fill="url(#' + p.s2 + ')"/>' +
        '<path d="' + wave(146, 7) + 'V176H30Z" fill="url(#' + p.s4 + ')"/>' +
        '<path d="' + wave(130, 7) + '" fill="none" stroke="' + st.thread + '" stroke-width=".9" stroke-dasharray="2.2 2" opacity=".55"/>' +
        '</g>' + pts +
        '<circle cx="' + cx + '" cy="' + cy + '" r="3.2" fill="' + st.band + '" stroke="' + st.thread + '" stroke-width="1"/>';
    },
    dunes(st, p) {
      let rays = '';
      for (let deg = -164; deg <= -16; deg += 18.5) {
        const a = deg * Math.PI / 180;
        rays += 'M' + (100 + 31 * Math.cos(a)).toFixed(2) + ' ' + (117 + 31 * Math.sin(a)).toFixed(2) +
          'L' + (100 + 41 * Math.cos(a)).toFixed(2) + ' ' + (117 + 41 * Math.sin(a)).toFixed(2);
      }
      const crest = 'M34 123C56 109 80 111 100 122C118 132 140 125 166 113';
      return '<g clip-path="url(#' + p.clip + ')">' +
        '<path d="' + rays + '" stroke="url(#' + p.s2 + ')" stroke-width="3.2" stroke-linecap="round"/>' +
        '<circle cx="100" cy="117" r="25" fill="url(#' + p.s2 + ')" stroke="#000" stroke-opacity=".3" stroke-width=".7"/>' +
        '<path d="' + crest + 'V172H34Z" fill="url(#' + p.s1 + ')"/>' +
        '<path d="M34 141C58 129 84 131 108 141C126 148 146 143 166 133V172H34Z" fill="url(#' + p.s3 + ')"/>' +
        '<path d="' + crest + '" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".8"/>' +
        '<path d="M40 156C62 150 84 152 104 158" fill="none" stroke="' + st.band + '" stroke-width="1" stroke-dasharray="2.4 2" opacity=".55"/>' +
        '</g>';
    },
    anchor(st, p) {
      const stars = '<path d="' + starPath(67, 80, 5.2, 2.1) + starPath(133, 80, 5.2, 2.1) + '" fill="url(#' + p.s2 + ')"/>';
      return stars +
        '<g stroke="#000" stroke-opacity=".35" stroke-width=".7">' +
        '<circle cx="100" cy="57" r="7" fill="none" stroke="url(#' + p.s1 + ')" stroke-width="3.8" stroke-opacity="1"/>' +
        '<rect x="77" y="69" width="46" height="6.6" rx="3.3" fill="url(#' + p.s1 + ')"/>' +
        '<rect x="96.5" y="63" width="7" height="72" rx="1.4" fill="url(#' + p.s1 + ')"/>' +
        '<path d="M68.5 110C70.5 129 86 140.5 100 140.5C114 140.5 129.5 129 131.5 110" fill="none" stroke="url(#' + p.s1 + ')" stroke-width="6.6" stroke-opacity="1"/>' +
        '<path d="M60.5 114.5L68.5 98L77.5 114.5Z" fill="url(#' + p.s3 + ')"/>' +
        '<path d="M139.5 114.5L131.5 98L122.5 114.5Z" fill="url(#' + p.s3 + ')"/>' +
        '</g>';
    },
  };

  function svg(role, opts) {
    opts = opts || {};
    const st = styleFor(role, opts.index);
    const id = 'mp' + (++uid);
    const ids = { clip: id + 'c', s1: id + 's1', s2: id + 's2', s3: id + 's3', s4: id + 's4' };
    const name = String(role.short || role.title || '').toUpperCase();
    const years = String(role.years || '').toUpperCase();
    const nTop = [...name].length, nBot = [...years].length;
    const topSpan = Math.max(92, Math.min(178, nTop * 12.6));
    const botSpan = Math.max(78, Math.min(146, nBot * 10.4));
    const tt = ringText(ids.clip, name, topSpan, 15);
    const tb = ringText(ids.clip, years, botSpan, 14);
    const rTop = 76 - tt.fs * 0.35, rBot = 76 + tb.fs * 0.35;
    const em = EMBLEMS[st.emblem] || EMBLEMS.reticle;

    const defs =
      '<defs>' +
      '<pattern id="' + id + 'tw" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.4" height="1.2" fill="#fff" fill-opacity=".05"/></pattern>' +
      '<pattern id="' + id + 'tx" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="3.4" height="1" fill="#000" fill-opacity=".12"/></pattern>' +
      satin(ids.s1, st.thread, -32) +
      satin(ids.s2, st.accent, 28) +
      satin(ids.s3, st.shade, 62, 0.25) +
      satin(ids.s4, st.shade, -12, 0.3) +
      '<radialGradient id="' + id + 'sh" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".13"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>' +
      '<clipPath id="' + ids.clip + '"><circle cx="100" cy="100" r="62"/></clipPath>' +
      '<path id="' + id + 'pt" d="M' + (C - rTop).toFixed(2) + ' 100A' + rTop.toFixed(2) + ' ' + rTop.toFixed(2) + ' 0 0 1 ' + (C + rTop).toFixed(2) + ' 100"/>' +
      '<path id="' + id + 'pb" d="M' + (C - rBot).toFixed(2) + ' 100A' + rBot.toFixed(2) + ' ' + rBot.toFixed(2) + ' 0 0 0 ' + (C + rBot).toFixed(2) + ' 100"/>' +
      '</defs>';

    const textStyle = 'font-family:\'Barlow Semi Condensed\',\'Barlow\',Arial,sans-serif;font-weight:600;';

    return '<svg class="patch' + (opts.className ? ' ' + opts.className : '') + '" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      defs +
      '<circle cx="100" cy="100" r="98" fill="' + st.edge + '"/>' +
      '<circle cx="100" cy="100" r="89" fill="' + st.band + '"/>' +
      '<circle cx="100" cy="100" r="89" fill="url(#' + id + 'tw)"/>' +
      '<circle cx="100" cy="100" r="89" fill="url(#' + id + 'tx)"/>' +
      '<circle cx="100" cy="100" r="62" fill="' + st.disk + '"/>' +
      '<circle cx="100" cy="100" r="62" fill="url(#' + id + 'tw)"/>' +
      em(st, ids) +
      '<circle cx="100" cy="100" r="62.8" fill="none" stroke="' + st.edge + '" stroke-width="2.6"/>' +
      '<circle cx="100" cy="100" r="62.8" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.6" stroke-dasharray=".8 1.1"/>' +
      '<circle cx="100" cy="100" r="85.6" fill="none" stroke="' + st.thread + '" stroke-width="1.05" stroke-dasharray="2.6 2.1" opacity=".7"/>' +
      '<text fill="' + st.thread + '" style="' + textStyle + 'font-size:' + tt.fs + 'px;letter-spacing:' + tt.ls + 'px">' +
      '<textPath href="#' + id + 'pt" startOffset="50%" text-anchor="middle" textLength="' + topSpan.toFixed(1) + '" lengthAdjust="spacing">' + esc(name) + '</textPath></text>' +
      '<text fill="' + st.thread + '" style="' + textStyle + 'font-size:' + tb.fs + 'px;letter-spacing:' + tb.ls + 'px">' +
      '<textPath href="#' + id + 'pb" startOffset="50%" text-anchor="middle" textLength="' + botSpan.toFixed(1) + '" lengthAdjust="spacing">' + esc(years) + '</textPath></text>' +
      '<path d="' + starPath(24, 100, 4.4, 1.8) + starPath(176, 100, 4.4, 1.8) + '" fill="' + st.thread + '"/>' +
      '<circle cx="100" cy="100" r="93.5" fill="none" stroke="#000" stroke-opacity=".26" stroke-width="9" stroke-dasharray=".9 1.25"/>' +
      '<circle cx="100" cy="100" r="89.3" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".8"/>' +
      '<circle cx="100" cy="100" r="97.6" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".8"/>' +
      '<circle cx="100" cy="100" r="98" fill="url(#' + id + 'sh)"/>' +
      '</svg>';
  }

  return { svg: svg, styleFor: styleFor };
})();
