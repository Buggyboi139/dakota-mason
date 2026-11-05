// Geometry kit: builds flat-shaded, vertex-colored meshes from primitives and
// merges each building into a single draw call. Shared by world.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLORS = new Map();
export const col = (hex) => {
  let c = COLORS.get(hex);
  if (!c) COLORS.set(hex, (c = new THREE.Color(hex)));
  return c;
};

// Small seeded random so the city looks the same on every visit.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gableGeo() {
  // Unit gable roof: base 1x1 at y = 0, ridge along z at y = 1.
  const p = [
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
    0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}
function wedgeGeo() {
  // Unit ramp: full height at z = -0.5, zero at z = +0.5 (for awnings, wedge bows).
  const p = [
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 1, -0.5, -0.5, 1, -0.5, // slope
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, // back
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, -0.5, // left
    0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, -0.5, // right
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

export const U = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  plane: new THREE.PlaneGeometry(1, 1),
  pyr: new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dode: new THREE.DodecahedronGeometry(1, 0),
  gable: gableGeo(),
  wedge: wedgeGeo(),
};
const cache = new Map();
export function cylU(ratio = 1, seg = 8, open = false) {
  const k = `c${ratio}|${seg}|${open}`;
  if (!cache.has(k)) cache.set(k, new THREE.CylinderGeometry(ratio, 1, 1, seg, 1, open).translate(0, 0.5, 0));
  return cache.get(k);
}
export function archU(seg = 8, open = false) {
  const k = `a${seg}|${open}`;
  if (!cache.has(k)) cache.set(k, new THREE.CylinderGeometry(1, 1, 1, seg, 1, open, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2));
  return cache.get(k);
}
export function discU(seg = 16, half = false) {
  const k = `d${seg}|${half}`;
  if (!cache.has(k)) cache.set(k, new THREE.CircleGeometry(1, seg, 0, half ? Math.PI : Math.PI * 2));
  return cache.get(k);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Kit {
  constructor() { this.parts = []; }

  // Add any geometry with a color (hex or fn(nx, ny, nz, cy) -> hex) and an
  // optional glow color that lights up at night.
  push(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ');
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    if (o.m) g.applyMatrix4(o.m);
    const pos = g.attributes.position, n = pos.count;
    const ca = new Float32Array(n * 3), ga = new Float32Array(n * 3);
    if (typeof color === 'function') {
      for (let i = 0; i < n; i += 3) {
        _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _c.fromBufferAttribute(pos, i + 2);
        const cy = (_a.y + _b.y + _c.y) / 3;
        _b.sub(_a); _c.sub(_a); _b.cross(_c).normalize();
        const cc = col(color(_b.x, _b.y, _b.z, cy));
        for (let j = 0; j < 3; j++) { ca[(i + j) * 3] = cc.r; ca[(i + j) * 3 + 1] = cc.g; ca[(i + j) * 3 + 2] = cc.b; }
      }
    } else {
      const cc = col(color);
      for (let i = 0; i < n; i++) { ca[i * 3] = cc.r; ca[i * 3 + 1] = cc.g; ca[i * 3 + 2] = cc.b; }
    }
    if (o.glow) {
      const gc = col(o.glow), k = o.glowK ?? 1;
      for (let i = 0; i < n; i++) { ga[i * 3] = gc.r * k; ga[i * 3 + 1] = gc.g * k; ga[i * 3 + 2] = gc.b * k; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(ga, 3));
    this.parts.push(g);
    return this;
  }

  box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.box, color, { ...o, x, y, z, sx: w, sy: h, sz: d }); }
  // Cylinder or frustum standing on y.
  cyl(rb, rt, h, seg, color, x = 0, y = 0, z = 0, o = {}) {
    return this.push(cylU(+(rt / rb).toFixed(3), seg, !!o.open), color, { ...o, x, y, z, sx: rb * (o.sxk ?? 1), sy: h, sz: rb * (o.szk ?? 1) });
  }
  cone(r, h, seg, color, x = 0, y = 0, z = 0, o = {}) { return this.cyl(r, 0, h, seg, color, x, y, z, o); }
  pyr(w, h, d, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.pyr, color, { ...o, x, y, z, sx: w, sy: h, sz: d }); }
  gable(w, h, d, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.gable, color, { ...o, x, y, z, sx: w, sy: h, sz: d }); }
  wedge(w, h, d, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.wedge, color, { ...o, x, y, z, sx: w, sy: h, sz: d }); }
  ball(r, color, x = 0, y = 0, z = 0, o = {}) { return this.push(o.smooth ? U.ico1 : U.ico, color, { ...o, x, y, z, sx: r * (o.sxk ?? 1), sy: r * (o.syk ?? 1), sz: r * (o.szk ?? 1) }); }
  rock(r, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.dode, color, { ...o, x, y, z, sx: r * (o.sxk ?? 1), sy: r * (o.syk ?? 1), sz: r * (o.szk ?? 1) }); }
  // Half cylinder lying on the ground, axis along z (tents, hangars).
  arch(r, len, seg, color, x = 0, y = 0, z = 0, o = {}) { return this.push(archU(seg, !!o.open), color, { ...o, x, y, z, sx: r, sy: r * (o.syk ?? 1), sz: len }); }
  // Flat quad facing +z (rotate with ry).
  quad(w, h, color, x = 0, y = 0, z = 0, o = {}) { return this.push(U.plane, color, { ...o, x, y, z, sx: w, sy: h }); }
  // Extrude a polygon given as [[x, z], ...] between y0 and y1.
  prism(pts, y0, y1, color, o = {}) {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: o.curve || 6 });
    g.rotateX(-Math.PI / 2).translate(0, y0, 0);
    this.push(g, color, o);
    g.dispose();
    return this;
  }
  // A lathe (surface of revolution) from [[r, y], ...].
  lathe(prof, seg, color, o = {}) {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    this.push(g, color, o);
    g.dispose();
    return this;
  }

  geometry() {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return g;
  }
  mesh(material, { cast = true, receive = true, name } = {}) {
    const g = this.geometry();
    const m = new THREE.Mesh(g, material);
    m.castShadow = cast; m.receiveShadow = receive;
    if (name) m.name = name;
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}

// Rounded rectangle outline as [[x, z], ...]; r = {nw, ne, se, sw} or a number.
export function rrect(x0, z0, x1, z1, r, seg = 6) {
  const R = typeof r === 'number' ? { nw: r, ne: r, se: r, sw: r } : { nw: 0, ne: 0, se: 0, sw: 0, ...r };
  const pts = [];
  const arc = (cx, cz, rad, a0, a1) => {
    if (!rad) { pts.push([cx, cz]); return; }
    for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]); }
  };
  const H = Math.PI / 2;
  arc(x0 + R.nw, z0 + R.nw, R.nw, Math.PI, Math.PI + H); // NW corner (back-left)
  arc(x1 - R.ne, z0 + R.ne, R.ne, -H, 0); // NE
  arc(x1 - R.se, z1 - R.se, R.se, 0, H); // SE
  arc(x0 + R.sw, z1 - R.sw, R.sw, H, Math.PI); // SW
  return pts;
}

// Smooth a polyline with Catmull-Rom, keeping its ends.
export function smooth(pts, per = 4) {
  const v = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  return curve.getPoints((pts.length - 1) * per).map((p) => [p.x, p.z]);
}

// Polygon band of width w along one side of a polyline (side = +1 right).
export function band(pts, w, side = 1) {
  const off = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    return [p[0] + dz * w * side, p[1] - dx * w * side];
  });
  return [...pts, ...off.reverse()];
}
