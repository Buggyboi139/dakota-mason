/* Watch face: an original dive watch drawn in SVG and CSS.
   Watch.mount(host, options) draws the watch into host and returns a small control API.
   Units: every SVG layer shares one viewBox, centered on the case, with a case radius of 300. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const VB = '-340 -560 680 1120';
  const YEAR0 = 2015;
  const YEARS = 12;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SUBS = [300, 60, 240, 120]; // subdials at 10, 2, 8 and 4 o'clock
  const TILT_V = -13; // the side roller turns its free end toward the viewer
  const TILT_H = -6; // the phone roller tips its top toward the viewer
  const USER = new Set(['wheel', 'drag', 'tap', 'key', 'bezel', 'marker']); // sources that report back
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const phoneMQ = matchMedia('(max-width: 639px)');
  const motion = () => !reduceMQ.matches;

  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const n2 = (v) => Math.round(v * 100) / 100;
  const n3 = (v) => Math.round(v * 1000) / 1000;
  const pt = (r, a) => [n2(r * Math.sin(rad(a))), n2(-r * Math.cos(rad(a)))];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ym = (s) => { const [y, m] = String(s).split('-').map(Number); return y + ((m || 1) - 1) / 12; };
  const angleOf = (t) => ((t - YEAR0) / YEARS) * 360;
  const monthShort = (s) => { const [y, m] = String(s).split('-'); return m ? `${MON[m - 1]} ${y}` : y; };
  const monthLong = (s) => { const [y, m] = String(s).split('-'); return m ? `${MONTH[m - 1]} ${y}` : y; };

  /* ---------- geometry helpers ---------- */

  function arcPath(r, a0, a1, sweep = 1) {
    const [x0, y0] = pt(r, a0);
    const [x1, y1] = pt(r, a1);
    return `M${x0} ${y0}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${sweep} ${x1} ${y1}`;
  }
  function ringPath(r0, r1) {
    return `M${r1} 0A${r1} ${r1} 0 1 1 ${-r1} 0A${r1} ${r1} 0 1 1 ${r1} 0Z` +
      `M${r0} 0A${r0} ${r0} 0 1 0 ${-r0} 0A${r0} ${r0} 0 1 0 ${r0} 0Z`;
  }
  function radialLines(n, r0, r1, skip, offset = 0) {
    let d = '';
    for (let i = 0; i < n; i++) {
      if (skip && skip(i)) continue;
      const a = (i * 360) / n + offset;
      const [x0, y0] = pt(r0, a);
      const [x1, y1] = pt(r1, a);
      d += `M${x0} ${y0}L${x1} ${y1}`;
    }
    return d;
  }
  const rr = (x, y, w, h, r) =>
    `M${n2(x + r)} ${y}H${n2(x + w - r)}Q${n2(x + w)} ${y} ${n2(x + w)} ${n2(y + r)}V${n2(y + h - r)}` +
    `Q${n2(x + w)} ${n2(y + h)} ${n2(x + w - r)} ${n2(y + h)}H${n2(x + r)}Q${x} ${n2(y + h)} ${x} ${n2(y + h - r)}V${n2(y + r)}Q${x} ${y} ${n2(x + r)} ${y}Z`;
  // A crescent of light hugging the inside of a circle, from angle a0 to a1.
  function lens(r, a0, a1, t) {
    const [x0, y0] = pt(r, a0);
    const [x1, y1] = pt(r, a1);
    const [cx, cy] = pt(r - 2 * t, (a0 + a1) / 2);
    return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Q${cx} ${cy} ${x0} ${y0}Z`;
  }

  // Case outline: a round case with four lugs, filleted where the lugs meet the case.
  // The lugs swell slightly where they leave the case and taper toward soft, rounded tips.
  const LUG = (() => {
    const R = 300, xi = 152, xo = 214, xt = 203, tip = 334, cr = 17, fr = 24;
    const yi = n2(Math.sqrt(R * R - xi * xi));
    const fcx = xo + fr, fcy = Math.sqrt((R + fr) ** 2 - fcx ** 2);
    const k = R / (R + fr);
    return { R, xi, xo, xt, tip, cr, fr, yi, tx: n2(fcx * k), ty: n2(fcy * k), ly: n2(fcy), t1: tip - cr };
  })();
  const OUTLINE = (() => {
    const { R, xi, xo, xt, tip, cr, fr, yi, tx, ty, ly, t1 } = LUG;
    return [
      `M${xi} ${-yi}L${xi} ${-t1}A${cr} ${cr} 0 0 1 ${xi + cr} ${-tip}L${xt - cr} ${-tip}A${cr} ${cr} 0 0 1 ${xt} ${-t1}`,
      `C${xt + 1} ${-t1 + 30} ${xo} ${-ly - 40} ${xo} ${-ly}A${fr} ${fr} 0 0 0 ${tx} ${-ty}`,
      `A${R} ${R} 0 0 1 ${tx} ${ty}`,
      `A${fr} ${fr} 0 0 0 ${xo} ${ly}C${xo} ${ly + 40} ${xt + 1} ${t1 - 30} ${xt} ${t1}`,
      `A${cr} ${cr} 0 0 1 ${xt - cr} ${tip}L${xi + cr} ${tip}A${cr} ${cr} 0 0 1 ${xi} ${t1}L${xi} ${yi}`,
      `A${R} ${R} 0 0 1 ${-xi} ${yi}`,
      `L${-xi} ${t1}A${cr} ${cr} 0 0 1 ${-xi - cr} ${tip}L${-xt + cr} ${tip}A${cr} ${cr} 0 0 1 ${-xt} ${t1}`,
      `C${-xt - 1} ${t1 - 30} ${-xo} ${ly + 40} ${-xo} ${ly}A${fr} ${fr} 0 0 0 ${-tx} ${ty}`,
      `A${R} ${R} 0 0 1 ${-tx} ${-ty}`,
      `A${fr} ${fr} 0 0 0 ${-xo} ${-ly}C${-xo} ${-ly - 40} ${-xt - 1} ${-t1 + 30} ${-xt} ${-t1}`,
      `A${cr} ${cr} 0 0 1 ${-xt + cr} ${-tip}L${-xi - cr} ${-tip}A${cr} ${cr} 0 0 1 ${-xi} ${-t1}L${-xi} ${-yi}`,
      `A${R} ${R} 0 0 1 ${xi} ${-yi}Z`,
    ].join('');
  })();
  // Polished chamfers run along the outer edge of each lug; the inner walls fall into shadow.
  const LUG_EDGES = (() => {
    const { xi, xo, xt, cr, yi, ly, t1, tip } = LUG;
    const outer = [1, -1].flatMap((sx) => [1, -1].map((sy) =>
      `M${sx * xo} ${sy * (ly + 6)}C${sx * xo} ${sy * (ly + 40)} ${sx * (xt + 1)} ${sy * (t1 - 30)} ${sx * xt} ${sy * t1}A${cr} ${cr} 0 0 ${sx * sy > 0 ? 1 : 0} ${sx * (xt - cr)} ${sy * tip}`)).join('');
    const inner = [1, -1].flatMap((sx) => [1, -1].map((sy) => `M${sx * xi} ${sy * (yi - 4)}L${sx * xi} ${sy * t1}`)).join('');
    return { outer, inner };
  })();
  const STRAP_T = 'M-150 -256L150 -256L139 -560L-139 -560Z';
  const STRAP_B = 'M-150 256L150 256L139 560L-139 560Z';
  // The roller's shoulder flares out of the case flank at 3 o'clock.
  const BOSS = 'M246 -132C286 -130 300 -104 318 -101L321 -101Q333 -101 333 -89L333 89Q333 101 321 101L318 101C300 104 286 130 246 132Z';

  /* ---------- shared paint servers and filters ---------- */

  const DEFS = `
<svg class="w-defs" width="0" height="0" aria-hidden="true" focusable="false">
 <defs>
  <linearGradient id="wSteel" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#f3f5f7"/><stop offset=".15" stop-color="#d0d6db"/>
   <stop offset=".31" stop-color="#8e969e"/><stop offset=".47" stop-color="#e4e8eb"/>
   <stop offset=".62" stop-color="#a1a8af"/><stop offset=".8" stop-color="#5d656d"/>
   <stop offset="1" stop-color="#959ca3"/>
  </linearGradient>
  <linearGradient id="wBevel" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#eef1f3"/>
   <stop offset=".58" stop-color="#7a828a"/><stop offset="1" stop-color="#2c3238"/>
  </linearGradient>
  <linearGradient id="wRim" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".45" stop-color="#c6ccd1" stop-opacity=".5"/>
   <stop offset=".6" stop-color="#3a4046" stop-opacity=".5"/><stop offset="1" stop-color="#22272c" stop-opacity=".8"/>
  </linearGradient>
  <linearGradient id="wGrip" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#f6f7f8"/><stop offset=".42" stop-color="#b2b9bf"/>
   <stop offset=".58" stop-color="#737b83"/><stop offset="1" stop-color="#363c42"/>
  </linearGradient>
  <linearGradient id="wBevelRing" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#c8ced3"/><stop offset="1" stop-color="#4f565d"/>
  </linearGradient>
  <radialGradient id="wInsert" cx="0" cy="0" r="279" gradientUnits="userSpaceOnUse">
   <stop offset=".82" stop-color="#060a13"/><stop offset=".895" stop-color="#121c31"/>
   <stop offset=".97" stop-color="#0b1222"/><stop offset="1" stop-color="#04070d"/>
  </radialGradient>
  <linearGradient id="wSheen" x1="-279" y1="-279" x2="279" y2="279" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".28" stop-color="#fff" stop-opacity=".05"/>
   <stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#a9bcff" stop-opacity=".12"/>
  </linearGradient>
  <linearGradient id="wIdx" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0" stop-color="#fbfcfd"/><stop offset=".4" stop-color="#bcc3c9"/><stop offset=".5" stop-color="#5a626a"/>
   <stop offset=".6" stop-color="#9ba3aa"/><stop offset="1" stop-color="#eceff1"/>
  </linearGradient>
  <linearGradient id="wHandL" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b9c0c7"/>
  </linearGradient>
  <linearGradient id="wHandR" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#9da5ad"/><stop offset="1" stop-color="#4b5259"/>
  </linearGradient>
  <radialGradient id="wCap" cx=".38" cy=".34" r=".75">
   <stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#b9c0c7"/><stop offset="1" stop-color="#3f464d"/>
  </radialGradient>
  <radialGradient id="wAzur" cx=".5" cy=".5" r=".05" spreadMethod="repeat">
   <stop offset="0" stop-color="#14294f"/><stop offset=".5" stop-color="#0a1a37"/><stop offset="1" stop-color="#14294f"/>
  </radialGradient>
  <linearGradient id="wRecess" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset=".5" stop-color="#000" stop-opacity=".12"/>
   <stop offset="1" stop-color="#fff" stop-opacity=".26"/>
  </linearGradient>
  <linearGradient id="wFrame" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#fff"/><stop offset=".42" stop-color="#b0b7bd"/>
   <stop offset=".58" stop-color="#666e76"/><stop offset="1" stop-color="#e6e9ec"/>
  </linearGradient>
  <linearGradient id="wDisc" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#a7a296"/><stop offset=".3" stop-color="#eeeae0"/><stop offset="1" stop-color="#f7f4ed"/>
  </linearGradient>
  <linearGradient id="wTube" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0" stop-color="#4d545b"/><stop offset=".3" stop-color="#eef1f3"/><stop offset=".5" stop-color="#c3c9ce"/>
   <stop offset="1" stop-color="#3b4147"/>
  </linearGradient>
  <linearGradient id="wBoss" x1="0" y1="-132" x2="0" y2="132" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#d9dee2"/><stop offset=".22" stop-color="#f2f4f6"/><stop offset=".42" stop-color="#b5bcc3"/>
   <stop offset=".62" stop-color="#8a929a"/><stop offset=".84" stop-color="#555c63"/><stop offset="1" stop-color="#363c42"/>
  </linearGradient>
  <linearGradient id="wCrown" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#4f575f"/><stop offset=".18" stop-color="#e9edf0"/><stop offset=".3" stop-color="#fff"/>
   <stop offset=".52" stop-color="#a6aeb5"/><stop offset=".82" stop-color="#454c53"/><stop offset="1" stop-color="#262b30"/>
  </linearGradient>
  <linearGradient id="wCrownEnd" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/>
   <stop offset="1" stop-color="#fff" stop-opacity=".05"/>
  </linearGradient>
  <radialGradient id="wCrysEdge" cx="0" cy="0" r="226" gradientUnits="userSpaceOnUse">
   <stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset=".955" stop-color="#000" stop-opacity=".2"/>
   <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </radialGradient>
  <linearGradient id="wGlare" x1="-200" y1="-200" x2="40" y2="60" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/>
   <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="wAR" x1="200" y1="200" x2="0" y2="0" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#9aa8ff" stop-opacity=".16"/><stop offset="1" stop-color="#9aa8ff" stop-opacity="0"/>
  </linearGradient>
  <pattern id="wTwill" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
   <rect width="7" height="7" fill="#16213a"/><rect width="7" height="2.6" fill="#1d2b48"/>
   <rect y="4.3" width="7" height=".8" fill="#101a2d"/>
  </pattern>
  <linearGradient id="wStrapShade" x1="-150" y1="0" x2="150" y2="0" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".07" stop-color="#000" stop-opacity=".16"/>
   <stop offset=".34" stop-color="#fff" stop-opacity=".05"/><stop offset=".66" stop-color="#000" stop-opacity="0"/>
   <stop offset=".93" stop-color="#000" stop-opacity=".26"/><stop offset="1" stop-color="#000" stop-opacity=".66"/>
  </linearGradient>
  <linearGradient id="wTuckT" x1="0" y1="-256" x2="0" y2="-400" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#000" stop-opacity=".78"/><stop offset=".45" stop-color="#000" stop-opacity=".3"/>
   <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="wTuckB" x1="0" y1="256" x2="0" y2="400" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#000" stop-opacity=".78"/><stop offset=".45" stop-color="#000" stop-opacity=".3"/>
   <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="wFadeG" x1="0" y1="-560" x2="0" y2="560" gradientUnits="userSpaceOnUse">
   <stop offset="0" stop-color="#000"/><stop offset=".09" stop-color="#2a2a2a"/><stop offset=".2" stop-color="#fff"/>
   <stop offset=".8" stop-color="#fff"/><stop offset=".91" stop-color="#2a2a2a"/><stop offset="1" stop-color="#000"/>
  </linearGradient>
  <mask id="wFade" maskUnits="userSpaceOnUse" x="-340" y="-560" width="680" height="1120">
   <rect x="-340" y="-560" width="680" height="1120" fill="url(#wFadeG)"/>
  </mask>
  <clipPath id="wCaseClip"><path d="${OUTLINE}"/></clipPath>
  <clipPath id="wBossClip"><path d="${BOSS}"/></clipPath>
  <clipPath id="wWinClip"><rect x="-56" y="108.6" width="112" height="23.8"/></clipPath>
  <filter id="wBrush" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
   <feTurbulence type="fractalNoise" baseFrequency="1.5 .007" numOctaves="2" seed="4" result="n"/>
   <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -1.12" result="hi"/>
   <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.2 0 0 0 1.02" result="lo"/>
   <feMerge result="m"><feMergeNode in="hi"/><feMergeNode in="lo"/></feMerge>
   <feComposite in="m" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="wBlur30" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="wBlur2" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="wIdxShadow" x="-10%" y="-10%" width="125%" height="125%">
   <feDropShadow dx="1.6" dy="2.8" stdDeviation="1.3" flood-color="#000" flood-opacity=".62"/>
  </filter>
  <filter id="wHs1" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="3" dy="5" stdDeviation="2.6" flood-color="#000" flood-opacity=".5"/></filter>
  <filter id="wHs2" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="4" dy="7" stdDeviation="3" flood-color="#000" flood-opacity=".46"/></filter>
  <filter id="wHs3" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="5" dy="9" stdDeviation="2.4" flood-color="#000" flood-opacity=".42"/></filter>
  <filter id="wGlow" x="-180%" y="-30%" width="460%" height="160%" color-interpolation-filters="sRGB">
   <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="a"/>
   <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
   <feMerge><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
 </defs>
</svg>`;

  /* ---------- static drawings ---------- */

  function strapSVG() {
    const st = (s) => `M-135 ${s * 266}L-125 ${s * 560}M135 ${s * 266}L125 ${s * 560}`;
    return `<g mask="url(#wFade)">
      <path d="${STRAP_T}" fill="url(#wTwill)"/><path d="${STRAP_B}" fill="url(#wTwill)"/>
      <path d="${STRAP_T}" fill="url(#wStrapShade)"/><path d="${STRAP_B}" fill="url(#wStrapShade)"/>
      <path d="${STRAP_T}" fill="url(#wTuckT)"/><path d="${STRAP_B}" fill="url(#wTuckB)"/>
      <path d="${st(-1)}${st(1)}" fill="none" stroke="#d9cfb7" stroke-opacity=".55" stroke-width="2.3" stroke-dasharray="8 6" stroke-linecap="round"/>
      <path d="M-150 -256L-139 -560M150 -256L139 -560M-150 256L-139 560M150 256L139 560" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
    </g>`;
  }

  function caseSVG() {
    return `
      <ellipse cx="24" cy="40" rx="300" ry="372" fill="#000" opacity=".62" filter="url(#wBlur30)"/>
      ${strapSVG()}
      <g class="w-boss">
        <path d="${BOSS}" fill="url(#wBoss)"/>
        <g clip-path="url(#wBossClip)">
          <rect x="246" y="-132" width="88" height="264" fill="#fff" filter="url(#wBrush)" opacity=".22"/>
          <path d="M333 -96V96" stroke="#fff" stroke-opacity=".75" stroke-width="5"/>
          <path d="M318 -101C300 -104 286 -130 246 -132" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5"/>
          <path d="M318 101C300 104 286 130 246 132" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="6"/>
        </g>
        <path d="${BOSS}" fill="none" stroke="#12161a" stroke-opacity=".75" stroke-width="1.2"/>
      </g>
      <path d="${OUTLINE}" fill="url(#wSteel)"/>
      <path d="${OUTLINE}" fill="#fff" filter="url(#wBrush)" opacity=".2"/>
      <g clip-path="url(#wCaseClip)">
        <path d="${LUG_EDGES.inner}" fill="none" stroke="#0c0f12" stroke-opacity=".38" stroke-width="12"/>
        <path d="${OUTLINE}" fill="none" stroke="url(#wBevel)" stroke-width="15"/>
        <path d="${LUG_EDGES.outer}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
        <path d="${OUTLINE}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.6"/>
      </g>
      <circle r="296.4" fill="none" stroke="url(#wRim)" stroke-width="8"/>
      <circle r="292.8" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2.4" filter="url(#wBlur2)"/>
      <path d="${OUTLINE}" fill="none" stroke="#12161a" stroke-opacity=".82" stroke-width="1.2"/>
      <g transform="rotate(60)"><rect x="-15" y="-313" width="30" height="21" rx="2" fill="url(#wTube)"/></g>`;
  }

  function veilSVG() {
    return `<g fill="#010203">
      <g mask="url(#wFade)"><path d="${STRAP_T}"/><path d="${STRAP_B}"/></g>
      <path class="w-boss" d="${BOSS}"/>
      <path d="${OUTLINE}"/>
      <g transform="rotate(60)"><rect x="-15" y="-313" width="30" height="21"/></g>
    </g>`;
  }

  function markerAngles(roles) { return roles.map((r) => angleOf(ym(r.start))); }

  function bezelSVG(roles) {
    const notches = radialLines(120, 283.6, 291.4);
    const notchHi = radialLines(120, 283.6, 291.4, null, 1.15);
    const months = radialLines(144, 269, 277, (i) => i % 12 === 0);
    const years = radialLines(12, 261, 277.6);
    const nums = Array.from({ length: YEARS }, (_, k) =>
      `<text transform="rotate(${k * 30}) translate(0 -251)">${YEAR0 + k}</text>`).join('');
    const frames = markerAngles(roles).map((a, i) =>
      `<path class="bz-frame" data-i="${i}" transform="rotate(${n2(a)})" d="M-8.8 -243.6L8.8 -243.6L0 -229.6Z"/>`).join('');
    return `
      <path d="${ringPath(282, 292)}" fill="url(#wGrip)" fill-rule="evenodd"/>
      <path d="${ringPath(279, 282.4)}" fill="url(#wBevelRing)" fill-rule="evenodd"/>
      <path d="${ringPath(230, 279)}" fill="url(#wInsert)" fill-rule="evenodd"/>
      <path d="${ringPath(224, 230.2)}" fill="#04060a" fill-rule="evenodd"/>
      <g class="bz-rot">
        <path d="${notches}" stroke="#1d2228" stroke-opacity=".78" stroke-width="2.4"/>
        <path d="${notchHi}" stroke="#fff" stroke-opacity=".4" stroke-width=".9"/>
        <path d="${months}" stroke="#ced4da" stroke-width="1.25"/>
        <path d="${years}" stroke="#e6eaee" stroke-width="2.8"/>
        <g class="bz-num">${nums}</g>
        <path class="bz-span" d="M0 0"/>
        <g class="bz-frames">${frames}</g>
      </g>
      <path class="bz-sheen" d="${ringPath(230, 279)}" fill="url(#wSheen)" fill-rule="evenodd"/>
      <path class="bz-sheen" d="${arcPath(277.4, 290, 340)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.5" stroke-linecap="round"/>
      <path class="bz-sheen" d="${arcPath(281, 296, 330)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>`;
  }

  function bezelLumeSVG(roles) {
    const pips = markerAngles(roles).map((a, i) =>
      `<path class="bz-pip w-lume" data-i="${i}" transform="rotate(${n2(a)})" d="M-6.2 -241.4L6.2 -241.4L0 -231.9Z"/>`).join('');
    return `<g class="bz-rot">${pips}</g>`;
  }

  function indices() {
    const out = [];
    for (let i = 0; i < 12; i++) {
      let frame, lume;
      if (i === 0) {
        frame = 'M-15.6 -203.6L15.6 -203.6L5.6 -157L-5.6 -157Z';
        lume = 'M-11.5 -200.5L11.5 -200.5L3.3 -161.6L-3.3 -161.6Z';
      } else if (i % 3 === 0) {
        const r0 = i === 6 ? 170 : 162;
        frame = rr(-8.6, -203.6, 17.2, 203.6 - r0, 1.6);
        lume = rr(-5.5, -200.6, 11, 200.6 - r0 - 3, 1);
      } else {
        frame = rr(-7.3, -203.6, 14.6, 28, 1.4);
        lume = rr(-4.4, -200.6, 8.8, 22, 0.9);
      }
      out.push({ a: i * 30, frame, lume });
    }
    return out;
  }

  function dialBaseSVG() {
    const minutes = radialLines(60, 212, 220.6, (i) => i % 5 === 0);
    const fives = radialLines(12, 207, 220.6);
    const subs = SUBS.map((a) => {
      const [cx, cy] = pt(98, a);
      return `<g transform="translate(${cx} ${cy})">
        <circle r="42" fill="url(#wAzur)"/>
        <circle r="41.1" fill="none" stroke="url(#wRecess)" stroke-width="2.4"/>
        <path d="${radialLines(36, 37.6, 40.2)}" stroke="#dfe4e8" stroke-opacity=".55" stroke-width=".8"/>
        <circle r="36.8" fill="none" stroke="#dfe4e8" stroke-opacity=".3" stroke-width=".6"/>
      </g>`;
    }).join('');
    const frames = indices().map(({ a, frame }) => `<path transform="rotate(${a})" d="${frame}" fill="url(#wIdx)"/>`).join('');
    return `
      <path d="${minutes}" stroke="#e9edf0" stroke-opacity=".8" stroke-width="1.25"/>
      <path d="${fives}" stroke="#f2f4f6" stroke-width="2.6"/>
      ${subs}
      <g class="d-window">
        <rect x="-60.5" y="104.8" width="121" height="31.4" rx="3.6" fill="url(#wFrame)" filter="url(#wIdxShadow)"/>
        <rect x="-56" y="108.6" width="112" height="23.8" rx="1.6" fill="url(#wDisc)"/>
        <g clip-path="url(#wWinClip)"><g class="d-wintext"></g></g>
        <rect x="-56" y="108.6" width="112" height="23.8" rx="1.6" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>
      </g>
      <g filter="url(#wIdxShadow)">${frames}</g>`;
  }

  function dialLumeSVG(o) {
    const lume = indices().map(({ a, lume }) => `<path transform="rotate(${a})" d="${lume}"/>`).join('');
    const subs = o.stats.map((s, i) => {
      const [cx, cy] = pt(98, SUBS[i]);
      const [ax, ay] = pt(33.4, 300);
      const [bx, by] = pt(33.4, 60);
      const id = `wSubArc${i}`;
      return `<g transform="translate(${cx} ${cy})">
        <path id="${id}" d="M${ax} ${ay}A33.4 33.4 0 1 0 ${bx} ${by}" fill="none"/>
        <text class="d-subval" y="${s.unit ? -2 : 1}">${esc(s.value)}</text>
        ${s.unit ? `<text class="d-subunit" y="13">${esc(s.unit.toUpperCase())}</text>` : ''}
        <text class="d-micro"><textPath href="#${id}" startOffset="50%">${esc(s.label.toUpperCase())}</textPath></text>
      </g>`;
    }).join('');
    const [loc1, loc2] = String(o.location || '').split(/,\s*/);
    const [lx, ly] = pt(191, 216);
    const [rx, ry] = pt(191, 144);
    const location = loc1 ? `
      <path id="wLocArc" d="M${lx} ${ly}A191 191 0 0 0 ${rx} ${ry}" fill="none"/>
      <text class="d-loc"><textPath href="#wLocArc" startOffset="27%">${esc(loc1.toUpperCase())}</textPath></text>
      ${loc2 ? `<text class="d-loc"><textPath href="#wLocArc" startOffset="73%">${esc(loc2.toUpperCase())}</textPath></text>` : ''}` : '';
    return `<g class="d-lume w-lume">${lume}</g>
      <g class="d-print">
        <text class="d-name" y="-121">${esc(o.dialName)}</text>
        <text class="d-role" y="-102.4"></text>
        <text class="d-years" y="-89.6"></text>
        ${subs}
        ${location}
      </g>`;
  }

  function handsSVG() {
    const hour = {
      left: 'M0 -14L-11 -14L-11 -116L0 -150Z', right: 'M0 -14L11 -14L11 -116L0 -150Z',
      sil: 'M-11 -14L-11 -116L0 -150L11 -116L11 -14Z', lume: 'M-6.2 -30L-6.2 -113.6L0 -133L6.2 -113.6L6.2 -30Z', hub: 16,
    };
    const minute = {
      left: 'M0 -12L-4.3 -12L-9.4 -152L0 -213Z', right: 'M0 -12L4.3 -12L9.4 -152L0 -213Z',
      sil: 'M-4.3 -12L-9.4 -152L0 -213L9.4 -152L4.3 -12Z', lume: 'M-2.1 -34L-5.9 -150L0 -197L5.9 -150L2.1 -34Z', hub: 12,
    };
    const hand = (cls, f, h) => `
      <g filter="url(#${f})"><g class="hand ${cls}">
        <path d="${h.left}" fill="url(#wHandL)"/><path d="${h.right}" fill="url(#wHandR)"/>
        <circle r="${h.hub}" fill="url(#wCap)"/>
        <path d="${h.left}" fill="none" stroke="#2a3036" stroke-opacity=".5" stroke-width=".7"/>
        <path d="${h.right}" fill="none" stroke="#2a3036" stroke-opacity=".5" stroke-width=".7"/>
        <g class="h-veil"><path d="${h.sil}"/><circle r="${h.hub}"/></g>
        <path class="h-lume w-lume" d="${h.lume}"/>
      </g></g>`;
    const second = `
      <g filter="url(#wHs3)"><g class="hand hand-s">
        <path d="M-1.6 66L-1.15 -222L1.15 -222L1.6 66Z" fill="#e9edf0"/>
        <path d="M0 66L0 -222L1.15 -222L1.6 66Z" fill="#9aa2aa"/>
        <path d="M-1.3 -176L-1.15 -222L1.15 -222L1.3 -176Z" fill="#cf2a2f"/>
        <path d="${rr(-4.6, -167, 9.2, 27, 1.4)}" fill="url(#wHandL)"/>
        <path d="${rr(-5.2, 30, 10.4, 36, 5.2)}" fill="url(#wHandR)"/>
        <path d="${rr(-2.4, 33, 4.8, 30, 2.4)}" fill="#fff" fill-opacity=".35"/>
        <path d="${rr(-5.2, 30, 10.4, 36, 5.2)}" fill="none" stroke="#1d2227" stroke-opacity=".55" stroke-width=".7"/>
        <circle r="9.5" fill="url(#wCap)"/>
        <g class="h-veil"><path d="M-1.6 66L-1.15 -222L1.15 -222L1.6 66Z"/><path d="${rr(-4.6, -167, 9.2, 27, 1.4)}"/><path d="${rr(-5.2, 30, 10.4, 36, 5.2)}"/><circle r="9.5"/></g>
        <path class="h-lume w-lume" d="${rr(-3, -165, 6, 23, 0.9)}"/>
        <circle r="3.4" fill="#cf2a2f"/>
      </g></g>`;
    return hand('hand-h', 'wHs1', hour) + hand('hand-m', 'wHs2', minute) + second;
  }

  function crystalSVG() {
    return `
      <circle r="226" fill="url(#wCrysEdge)"/>
      <path d="${lens(223, 232, 334, 34)}" fill="url(#wGlare)"/>
      <path d="${arcPath(215, 300, 334)}" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="2.4" stroke-linecap="round"/>
      <path d="${lens(223, 96, 168, 22)}" fill="url(#wAR)"/>
      <circle r="225.5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>`;
  }

  function crownSVG() {
    let ridges = '', hi = '';
    for (let y = 5; y < 54; y += 3.4) {
      ridges += `M9 ${n2(y)}L40 ${n2(y)}`;
      hi += `M9 ${n2(y + 1.2)}L40 ${n2(y + 1.2)}`;
    }
    return `<svg viewBox="0 0 48 58" aria-hidden="true" focusable="false">
      <rect x="5" y="1.5" width="38" height="55" rx="6" fill="url(#wCrown)"/>
      <path d="${ridges}" stroke="#1b2025" stroke-opacity=".6" stroke-width="1.5"/>
      <path d="${hi}" stroke="#fff" stroke-opacity=".38" stroke-width=".6"/>
      <rect x="38" y="1.5" width="6.5" height="55" rx="3" fill="url(#wCrownEnd)"/>
      <rect x="5" y="1.5" width="38" height="55" rx="6" fill="none" stroke="#0e1114" stroke-opacity=".7" stroke-width="1"/>
      <rect class="cr-veil" x="3" y="0" width="43" height="58" rx="6" fill="#010203"/>
    </svg>`;
  }

  /* ---------- the roller drum ---------- */

  function makeRoller(o) {
    const projects = o.projects;
    const N = projects.length;
    const el = document.createElement('div');
    el.className = 'rl';
    el.innerHTML = `
      <div class="rl-mount" aria-hidden="true"></div>
      <div class="rl-drum" tabindex="0" role="slider" aria-label="${esc(o.label)}" aria-valuemin="1" aria-valuemax="${N}">
        <div class="rl-view" aria-hidden="true"><div class="rl-cyl"></div></div>
      </div>
      <div class="rl-index" aria-hidden="true"></div>
      <p class="rl-hint" aria-hidden="true"><svg viewBox="0 0 12 20" class="rl-chev"><path d="M2 7L6 3L10 7M2 13L6 17L10 13"/></svg><span>${esc(o.hint)}</span></p>`;
    const drum = el.querySelector('.rl-drum');
    const view = el.querySelector('.rl-view');
    const cyl = el.querySelector('.rl-cyl');
    const index = el.querySelector('.rl-index');

    let orient = 'v', step = 30, facets = [], labels = [];
    let pos = 0, vel = 0, target = 0, mode = 'idle', raf = 0, last = 0;
    let idx = -1, settledIdx = -1, source = 'init', wheelTimer = 0, drag = null, used = false;

    // Light from the upper left, a little in front.
    const Lr = [-0.4, -0.62, 0.68], Ll = Math.hypot(...Lr), L = Lr.map((v) => v / Ll);
    const Hr = [L[0], L[1], L[2] + 1], Hl = Math.hypot(...Hr), H = Hr.map((v) => v / Hl);

    function build(next) {
      orient = next;
      step = orient === 'v' ? 30 : 36;
      // Facets per label step: the wide phone drum needs finer facets to keep its shading smooth.
      const sub = orient === 'v' ? 4 : 8;
      const F = 360 / (step / sub);
      el.dataset.orient = orient;
      drum.setAttribute('aria-orientation', orient === 'v' ? 'vertical' : 'horizontal');
      cyl.textContent = '';
      facets = []; labels = [];
      const axis = orient === 'v' ? 'X' : 'Y';
      for (let k = 0; k < F; k++) {
        const a = (k * 360) / F;
        const f = document.createElement('div');
        f.className = 'rl-facet' + (k % sub === sub / 2 ? ' g' : '');
        f.style.transform = `rotate${axis}(${a}deg) translateZ(var(--r))`;
        cyl.appendChild(f);
        facets.push({ el: f, a, ov: '' });
      }
      projects.forEach((p, i) => {
        const a = orient === 'v' ? -i * step : i * step;
        const l = document.createElement('div');
        l.className = 'rl-label';
        l.style.transform = `rotate${axis}(${a}deg) translateZ(calc(var(--r) + 1px))`;
        l.innerHTML = `<span class="rl-name">${esc(p.name)}</span><span class="rl-date">${esc(monthShort(p.started))}</span>`;
        cyl.appendChild(l);
        labels.push({ el: l, a, op: -1 });
      });
      ['a', 'b'].forEach((s) => { const c = document.createElement('div'); c.className = `rl-cap rl-cap-${s}`; c.innerHTML = '<i></i>'; cyl.appendChild(c); });
      idx = -1;
      render();
    }

    function shade(rho) {
      const tilt = rad(orient === 'v' ? TILT_V : TILT_H);
      const st = Math.sin(tilt), ct = Math.cos(tilt);
      for (const f of facets) {
        const th = rad(f.a + rho), s = Math.sin(th), c = Math.cos(th);
        const n = orient === 'v' ? [c * st, -s, c * ct] : [s, -c * st, c * ct];
        if (n[2] < -0.02) continue;
        const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const spec = Math.pow(Math.max(0, n[0] * H[0] + n[1] * H[1] + n[2] * H[2]), 26);
        const rim = 0.14 + 0.86 * Math.pow(Math.max(0, n[2]), 1.15);
        const b = (0.14 + 0.92 * dif + 0.95 * spec) * rim;
        const ov = b < 1
          ? `rgba(4,6,10,${n3(Math.min(0.94, (1 - b) * 1.04))})`
          : `rgba(255,255,255,${n3(Math.min(0.5, (b - 1) * 0.85))})`;
        if (ov !== f.ov) { f.el.style.setProperty('--ov', ov); f.ov = ov; }
      }
      // Labels fade as they turn away, and also by distance in the list, so the far end of a
      // long list never shows up beside the near end on the wide phone drum.
      labels.forEach((l, k) => {
        const nz = Math.cos(rad(l.a + rho)) * ct;
        const op = n3(smooth(0.18, 0.86, nz) * (1 - smooth(2.2, 2.9, Math.abs(k - pos))));
        if (op !== l.op) { l.el.style.opacity = op; l.op = op; }
      });
    }

    function render() {
      const rho = orient === 'v' ? pos * step : -pos * step;
      cyl.style.transform = orient === 'v'
        ? `rotateY(${TILT_V}deg) rotateX(${n3(rho)}deg)`
        : `translateZ(calc(-1 * var(--r))) rotateX(${TILT_H}deg) rotateY(${n3(rho)}deg)`;
      shade(rho);
      const i = clamp(Math.round(pos), 0, N - 1);
      if (i !== idx) {
        const dir = idx < 0 ? 0 : Math.sign(i - idx);
        idx = i;
        labels.forEach((l, k) => l.el.classList.toggle('cur', k === i));
        const p = projects[i];
        drum.setAttribute('aria-valuenow', i + 1);
        drum.setAttribute('aria-valuetext', `${p.name}, started ${monthLong(p.started)}`);
        o.onIndex(i, dir);
        if (dir && motion()) {
          const kick = orient === 'v' ? 'translate(2px,0)' : 'translate(0,2px)';
          const jolt = orient === 'v' ? `translate(0,${dir}px)` : `translate(${-dir}px,0)`;
          index.animate([{ transform: 'translate(0,0)' }, { transform: kick }, { transform: 'translate(0,0)' }], { duration: 120, easing: 'ease-out' });
          drum.animate([{ transform: 'translate(0,0)' }, { transform: jolt }, { transform: 'translate(0,0)' }], { duration: 90, easing: 'ease-out' });
        }
      }
    }

    // Report a project as soon as the roller knows where it will stop.
    function commit(i) {
      if (i !== settledIdx) {
        settledIdx = i;
        o.onSettle(i, source);
      }
    }

    function frame(t) {
      raf = 0;
      const dt = last ? Math.min(0.034, (t - last) / 1000) : 1 / 60;
      last = t;
      let running = true;
      if (mode === 'free') {
        vel *= Math.exp(-2.4 * dt);
        const d = pos - Math.round(pos);
        vel -= Math.sin(d * 2 * Math.PI) * 3.4 * dt;
        pos += vel * dt;
        if (pos < -0.02 || pos > N - 0.98 || Math.abs(vel) < 0.85) {
          mode = 'snap'; target = clamp(Math.round(pos), 0, N - 1); commit(target);
        }
      } else if (mode === 'snap' || mode === 'wheel') {
        const k = mode === 'wheel' ? 240 : 150;
        const z = mode === 'wheel' ? 0.92 : 0.58;
        vel += (-k * (pos - target) - 2 * Math.sqrt(k) * z * vel) * dt;
        pos += vel * dt;
        if (mode === 'snap' && Math.abs(pos - target) < 0.002 && Math.abs(vel) < 0.03) {
          pos = target; vel = 0; running = false;
        }
      } else running = false;
      render();
      if (running) raf = requestAnimationFrame(frame);
      else { last = 0; if (mode === 'snap') mode = 'idle'; }
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    function go(i, src, animate = true) {
      source = src;
      target = clamp(i, 0, N - 1);
      if (!animate || !motion()) {
        cancelAnimationFrame(raf); raf = 0;
        pos = target; vel = 0; mode = 'idle';
        if (!animate) idx = -1; // a silent jump: no flip or detent animation
        render(); commit(target);
        return;
      }
      mode = 'snap';
      commit(target);
      kick();
    }

    function markUsed() {
      if (used) return;
      used = true;
      el.classList.add('used');
      o.onUse && o.onUse();
    }

    const rubber = (x) => (0.6 * x) / (1 + 1.6 * x);

    drum.addEventListener('wheel', (e) => {
      e.preventDefault();
      markUsed();
      let d = orient === 'h' && Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 18; else if (e.deltaMode === 2) d *= 300;
      source = 'wheel';
      if (!motion()) {
        clearTimeout(wheelTimer);
        if (Math.abs(d) >= 1) {
          const base = mode === 'wheel' ? target : Math.round(pos);
          target = clamp(base + d / 100, -0.3, N - 0.7);
          mode = 'wheel';
          wheelTimer = setTimeout(() => go(Math.round(target), 'wheel', false), 90);
        }
        return;
      }
      if (mode !== 'wheel') { target = pos; mode = 'wheel'; }
      target = clamp(target + d / 100, -0.3, N - 0.7);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { target = clamp(Math.round(target), 0, N - 1); mode = 'snap'; commit(target); kick(); }, 150);
      kick();
    }, { passive: false });

    drum.addEventListener('keydown', (e) => {
      const deltas = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, PageDown: 3, PageUp: -3 };
      const base = mode === 'snap' ? target : Math.round(pos);
      let t = null;
      if (e.key in deltas) t = base + deltas[e.key];
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = N - 1;
      if (t === null) return;
      e.preventDefault();
      markUsed();
      go(t, 'key');
    });

    drum.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || drag) return;
      drum.setPointerCapture(e.pointerId);
      const r = view.getBoundingClientRect();
      const now = performance.now();
      cancelAnimationFrame(raf); raf = 0; clearTimeout(wheelTimer);
      drag = { id: e.pointerId, start: orient === 'v' ? e.clientY : e.clientX, pos0: pos, rpx: (orient === 'v' ? r.height : r.width) / 2, t0: now, samples: [[now, pos]], moved: 0 };
      mode = 'drag'; vel = 0;
      el.classList.add('grab');
    });
    drum.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = (orient === 'v' ? e.clientY : e.clientX) - drag.start;
      drag.moved = Math.max(drag.moved, Math.abs(d));
      let p = drag.pos0 - d / (drag.rpx * rad(step));
      if (p < 0) p = -rubber(-p); else if (p > N - 1) p = N - 1 + rubber(p - (N - 1));
      pos = p;
      render();
      const now = performance.now();
      drag.samples.push([now, pos]);
      while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
      if (drag.moved > 3) markUsed();
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      el.classList.remove('grab');
      source = 'drag';
      if (e.type === 'pointerup' && d.moved < 5 && performance.now() - d.t0 < 450) {
        const r = drum.getBoundingClientRect();
        const before = orient === 'v' ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
        markUsed();
        go(Math.round(pos) + (before ? -1 : 1), 'tap');
        return;
      }
      const [t0, p0] = d.samples[0];
      const [t1, p1] = d.samples[d.samples.length - 1];
      vel = t1 > t0 && performance.now() - t1 < 80 ? clamp((p1 - p0) / ((t1 - t0) / 1000), -14, 14) : 0;
      if (!motion()) { go(Math.round(pos + vel * 0.12), 'drag', false); return; }
      mode = 'free';
      kick();
    };
    drum.addEventListener('pointerup', release);
    drum.addEventListener('pointercancel', release);

    return {
      el,
      build,
      go,
      get orient() { return orient; },
      get index() { return idx; },
    };
  }

  /* ---------- mount ---------- */

  function mount(host, o) {
    const roles = o.roles.slice().sort((a, b) => ym(a.start) - ym(b.start));
    const angles = markerAngles(roles);
    const now = new Date();
    const nowT = Math.min(YEAR0 + YEARS - 0.002, now.getFullYear() + now.getMonth() / 12 + (now.getDate() - 1) / 365);

    host.classList.add('w-host');
    host.innerHTML = `${DEFS}
      <div class="w-frame"><div class="w-head">
        <svg class="w-layer w-case" viewBox="${VB}" aria-hidden="true" focusable="false">${caseSVG()}</svg>
        <svg class="w-layer w-bezel" viewBox="${VB}" aria-hidden="true" focusable="false">${bezelSVG(roles)}</svg>
        <div class="w-dial" aria-hidden="true"></div>
        <svg class="w-layer w-dialbase" viewBox="${VB}" aria-hidden="true" focusable="false">${dialBaseSVG()}</svg>
        <svg class="w-layer w-veil" viewBox="${VB}" aria-hidden="true" focusable="false">${veilSVG()}</svg>
        <svg class="w-layer w-bezlume" viewBox="${VB}" aria-hidden="true" focusable="false">${bezelLumeSVG(roles)}</svg>
        <svg class="w-layer w-diallume" viewBox="${VB}" aria-hidden="true" focusable="false">${dialLumeSVG(o)}</svg>
        <svg class="w-layer w-hands" viewBox="${VB}" aria-hidden="true" focusable="false">${handsSVG()}</svg>
        <svg class="w-layer w-crystal" viewBox="${VB}" aria-hidden="true" focusable="false">${crystalSVG()}</svg>
        <div class="w-ring" tabindex="0" role="slider" aria-label="${esc(o.bezelLabel)}" aria-valuemin="1" aria-valuemax="${roles.length}"></div>
        <div class="w-hole" aria-hidden="true"></div>
        <button class="w-crown" type="button" aria-pressed="false" aria-label="${esc(o.crownLabel)}">${crownSVG()}</button>
        <div class="w-tip" aria-hidden="true"></div>
      </div></div>
      <div class="w-under"></div>
      <p class="w-time sr-only"></p>`;

    const head = host.querySelector('.w-head');
    const under = host.querySelector('.w-under');
    const ring = host.querySelector('.w-ring');
    const crown = host.querySelector('.w-crown');
    const tip = host.querySelector('.w-tip');
    const rots = host.querySelectorAll('.bz-rot');
    const span = host.querySelector('.bz-span');
    const roleText = host.querySelector('.d-role');
    const yearsText = host.querySelector('.d-years');
    const winText = host.querySelector('.d-wintext');
    const timeText = host.querySelector('.w-time');
    const hands = { h: host.querySelector('.hand-h'), m: host.querySelector('.hand-m'), s: host.querySelector('.hand-s') };

    /* clock */
    const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    let clockRaf = 0, clockTimer = 0, visible = true, lastMinute = -1;
    function drawTime() {
      const d = new Date();
      const s = d.getSeconds() + (motion() ? d.getMilliseconds() / 1000 : 0);
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      hands.h.setAttribute('transform', `rotate(${n3(h * 30)})`);
      hands.m.setAttribute('transform', `rotate(${n3(m * 6)})`);
      hands.s.setAttribute('transform', `rotate(${n3(s * 6)})`);
      if (d.getMinutes() !== lastMinute) {
        lastMinute = d.getMinutes();
        timeText.textContent = `${o.timeLabel} ${fmt.format(d)}`;
      }
    }
    function clockLoop() { drawTime(); clockRaf = requestAnimationFrame(clockLoop); }
    function startClock() {
      cancelAnimationFrame(clockRaf); clearInterval(clockTimer);
      clockRaf = 0; clockTimer = 0;
      if (!visible || document.hidden) return;
      if (motion()) clockRaf = requestAnimationFrame(clockLoop);
      else { drawTime(); clockTimer = setInterval(drawTime, 1000); }
    }
    drawTime();
    startClock();
    document.addEventListener('visibilitychange', startClock);
    reduceMQ.addEventListener('change', startClock);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; startClock(); }).observe(head);
    }

    /* bezel */
    const bz = { B: 0, v: 0, target: 0, raf: 0, last: 0, sel: -1, src: 'init' };
    const nearest = (B) => {
      let best = 0, bd = 1e9;
      angles.forEach((a, i) => { const d = Math.abs(wrap180(a + B)); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    function setB(b) {
      bz.B = b;
      const t = `rotate(${n3(b)})`;
      rots.forEach((g) => g.setAttribute('transform', t));
    }
    function choose(i, animate) {
      if (i === bz.sel) return;
      const r = roles[i];
      bz.sel = i;
      host.querySelectorAll('.bz-pip, .bz-frame').forEach((p) => p.classList.toggle('on', +p.dataset.i === i));
      const a0 = angles[i];
      const a1 = r.end ? angleOf(ym(r.end)) : angleOf(nowT);
      span.setAttribute('d', arcPath(235.4, a0, Math.max(a0 + 1.5, a1)));
      roleText.textContent = r.short.toUpperCase();
      yearsText.textContent = r.years.toUpperCase();
      if (animate && motion()) {
        [roleText, yearsText].forEach((t) => t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' }));
      }
      ring.setAttribute('aria-valuenow', i + 1);
      ring.setAttribute('aria-valuetext', `${r.title}, ${r.dates}`);
    }
    function bezelFrame(t) {
      bz.raf = 0;
      const dt = bz.last ? Math.min(0.034, (t - bz.last) / 1000) : 1 / 60;
      bz.last = t;
      const k = 120, z = 0.5;
      bz.v += (-k * (bz.B - bz.target) - 2 * Math.sqrt(k) * z * bz.v) * dt;
      setB(bz.B + bz.v * dt);
      if (Math.abs(bz.B - bz.target) < 0.02 && Math.abs(bz.v) < 0.05) {
        setB(bz.target); bz.v = 0; bz.last = 0;
        return;
      }
      bz.raf = requestAnimationFrame(bezelFrame);
    }
    // The page hears about a selection as soon as it is decided; the ring then
    // springs into place on its own time.
    function turnTo(i, src, animate = true) {
      bz.src = src;
      bz.target = bz.B + wrap180(-angles[i] - bz.B);
      choose(i, animate);
      cancelAnimationFrame(bz.raf); bz.raf = 0;
      if (!animate || !motion()) { setB(bz.target); bz.v = 0; }
      else { bz.last = 0; bz.raf = requestAnimationFrame(bezelFrame); }
      if (USER.has(src)) o.onRole(roles[i].id, src);
    }

    const center = () => { const r = ring.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / 588 }; };
    const angleAt = (e, c) => deg(Math.atan2(e.clientX - c.x, -(e.clientY - c.y)));
    const markerNear = (a) => {
      let best = -1, bd = 7.5;
      angles.forEach((m, i) => { const d = Math.abs(wrap180(m + bz.B - a)); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    function showTip(i) {
      if (i < 0) { tip.classList.remove('on'); return; }
      const r = roles[i];
      const [x, y] = pt(322, angles[i] + bz.B);
      tip.textContent = `${r.short} · ${r.years}`;
      tip.style.left = `calc(${n2(340 + x)} * var(--U))`;
      tip.style.top = `calc(${n2(560 + y)} * var(--U))`;
      tip.classList.add('on');
    }

    let bdrag = null;
    ring.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const c = center();
      const a = angleAt(e, c);
      ring.setPointerCapture(e.pointerId);
      cancelAnimationFrame(bz.raf); bz.raf = 0;
      bdrag = { id: e.pointerId, c, last: a, acc: 0, B0: bz.B, a0: a, x: e.clientX, y: e.clientY, moved: 0 };
      ring.classList.add('grab');
      showTip(-1);
    });
    ring.addEventListener('pointermove', (e) => {
      if (!bdrag) {
        if (e.pointerType === 'mouse') {
          const i = markerNear(angleAt(e, center()));
          ring.classList.toggle('on-marker', i >= 0);
          showTip(i);
        }
        return;
      }
      if (e.pointerId !== bdrag.id) return;
      const a = angleAt(e, bdrag.c);
      bdrag.acc += wrap180(a - bdrag.last);
      bdrag.last = a;
      bdrag.moved = Math.max(bdrag.moved, Math.hypot(e.clientX - bdrag.x, e.clientY - bdrag.y));
      if (bdrag.moved > 4) { setB(bdrag.B0 + bdrag.acc); choose(nearest(bz.B), true); o.onUse && o.onUse('bezel'); }
    });
    ring.addEventListener('pointerleave', () => { if (!bdrag) { showTip(-1); ring.classList.remove('on-marker'); } });
    const bezelRelease = (e) => {
      if (!bdrag || e.pointerId !== bdrag.id) return;
      const d = bdrag;
      bdrag = null;
      ring.classList.remove('grab');
      if (d.moved <= 4) {
        if (e.type !== 'pointerup') return;
        const i = markerNear(d.a0);
        if (i >= 0) turnTo(i, 'marker');
        return;
      }
      turnTo(nearest(bz.B), 'bezel');
    };
    ring.addEventListener('pointerup', bezelRelease);
    ring.addEventListener('pointercancel', bezelRelease);
    ring.addEventListener('keydown', (e) => {
      const n = roles.length;
      let i = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = Math.min(n - 1, bz.sel + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = Math.max(0, bz.sel - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      if (i === null) return;
      e.preventDefault();
      if (i !== bz.sel) turnTo(i, 'key');
    });

    /* lume */
    let lume = false;
    function setLume(on) {
      lume = !!on;
      document.documentElement.toggleAttribute('data-lume', lume);
      crown.setAttribute('aria-pressed', String(lume));
      o.onLume && o.onLume(lume);
    }
    crown.addEventListener('click', () => {
      if (motion()) crown.firstElementChild.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-9%)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'cubic-bezier(.3,.7,.3,1)' });
      setLume(!lume);
    });

    /* date window */
    function setWindow(text, dir) {
      winText.querySelectorAll('text').forEach((t) => t.getAnimations().forEach((a) => a.finish()));
      const old = winText.lastElementChild;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', '0');
      t.setAttribute('y', '124.6');
      t.textContent = text.toUpperCase();
      winText.appendChild(t);
      try {
        if (t.getComputedTextLength() > 101) { t.setAttribute('textLength', '101'); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
      } catch (err) { /* not rendered yet */ }
      if (!old) return;
      if (!dir || !motion()) { old.remove(); return; }
      const ease = 'cubic-bezier(.25,.8,.25,1)';
      old.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-dir * 26}px)` }], { duration: 240, easing: ease, fill: 'forwards' }).onfinish = () => old.remove();
      t.animate([{ transform: `translateY(${dir * 26}px)` }, { transform: 'translateY(0)' }], { duration: 240, easing: ease });
    }

    /* roller */
    const roller = makeRoller({
      projects: o.projects,
      label: o.rollerLabel,
      hint: o.rollerHint,
      onIndex: (i, dir) => setWindow(o.projects[i].name, dir),
      onSettle: (i, src) => { if (USER.has(src)) o.onProject(o.projects[i].id, src); },
      onUse: () => o.onUse && o.onUse('roller'),
    });
    function placeRoller() {
      const next = phoneMQ.matches ? 'h' : 'v';
      (next === 'h' ? under : head).appendChild(roller.el);
      if (roller.orient !== next || !roller.el.querySelector('.rl-facet')) {
        const keep = roller.index < 0 ? null : roller.index;
        roller.build(next);
        if (keep !== null) roller.go(keep, 'init', false);
      }
    }
    placeRoller();
    phoneMQ.addEventListener('change', placeRoller);

    const projIndex = (id) => o.projects.findIndex((p) => p.id === id);
    const roleIndex = (id) => roles.findIndex((r) => r.id === id);

    return {
      selectRole(id, opts = {}) {
        const i = roleIndex(id);
        if (i < 0) return;
        if (i === bz.sel && !bz.raf && Math.abs(wrap180(angles[i] + bz.B)) < 0.05) return;
        turnTo(i, opts.source || 'api', opts.animate !== false);
      },
      selectProject(id, opts = {}) {
        const i = projIndex(id);
        if (i >= 0) roller.go(i, opts.source || 'api', opts.animate !== false);
      },
      setLume,
      get role() { return bz.sel >= 0 ? roles[bz.sel].id : null; },
      get project() { return roller.index >= 0 ? o.projects[roller.index].id : null; },
    };
  }

  window.Watch = { mount, monthShort, monthLong };
})();
