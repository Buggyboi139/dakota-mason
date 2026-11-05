// The city itself: a diorama tile with a harbor, an airfield, a desert camp,
// a civic center, a tech district, a campus, and an old town. Built entirely
// from primitives; each landmark is one merged, vertex-colored mesh.
import * as THREE from 'three';
import { Kit, rng, rrect, smooth, band } from './kit.js';
import { helipad, SignAtlas } from './textures.js';
import { DISTRICTS } from './data.js';

const PI = Math.PI, H = PI / 2;

export const PAL = {
  grass: '#a8ba86', grass2: '#9caf7a', lawn: '#b6c78e', dry: '#d8c99b', sand: '#e7d0a0', dune: '#e2c48d',
  embank: '#cdb48a', soil1: '#caa57a', soil2: '#b3865d', soil3: '#8e6447', waterSide: '#4f9a9b',
  asphalt: '#7b7872', tarmac: '#8c8880', runway: '#6b6965', mark: '#f3ead6', paint: '#eec35a',
  pave: '#dcd1be', curb: '#c9bda7', plaza: '#e5dbc9', quay: '#c3bbad', path: '#e2d5bb',
  cream: '#f2e8d5', cream2: '#e6d8bf', white: '#f7f3ea', stone: '#ddd2bf', trim: '#efe4cf',
  terra: '#c8704c', terra2: '#b45e3e', brick: '#b8694c', rust: '#a8553a',
  slate: '#5d6a73', slate2: '#4c5860', iron: '#5a636a', ink: '#2c333a', dark: '#30383e',
  glass: '#5f8b91', glassD: '#3b5a61',
  hull: '#7f8b95', deck: '#a7b0b7', navy1: '#9aa4ad', navy2: '#a9b2ba', navy3: '#b4bcc3',
  tan: '#d3b98b', tan2: '#b89b6c', hesco: '#c8ae7e', wood: '#9b7452', woodD: '#7a5a3f',
  rock: '#a49d91', rock2: '#8f887d', rock3: '#b8b0a2',
  leaf: '#7fa266', leaf2: '#6b9157', leaf3: '#98b377', pine: '#5e8a5b', trunk: '#8a6a4e',
  mustard: '#d9a845', coral: '#e2775a', teal: '#3f9a98', plum: '#86628c', green: '#4f8f64', verdigris: '#7fae97',
};
const WARM = '#ffcf87';

// ---------- layout ----------
export const TILE = { W: 48, D: 40, R: 8 };
const COAST = [
  [-48, -6], [-34, -6], [-30.8, -5.7], [-28.8, -4.4], [-28, -2], [-28, 14],
  ...smooth([[-28, 14], [-26.6, 17], [-23, 18.8], [-18.4, 20.6], [-14.8, 23.6], [-12.6, 27.6], [-11, 32], [-9.6, 36.4], [-8.8, 40]], 4).slice(1),
];
const arc = (cx, cz, r, a0, a1, seg = 8) => Array.from({ length: seg + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / seg; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
});
const { W, D, R } = TILE;
export const LAND = [...COAST, ...arc(W - R, D - R, R, H, 0), ...arc(W - R, -D + R, R, 0, -H), ...arc(-W + R, -D + R, R, -H, -PI)];
const WATER = [...COAST.slice().reverse(), ...arc(-W + R, D - R, R, PI, H)];

export function onLand(x, z, poly = LAND) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const RW = 1.7; // road half width
const ROADS = [
  { a: [-20, -8], b: [48, -8] }, // Avenue North
  { a: [-20, 14], b: [48, 14] }, // Avenue South
  { a: [-20, -26], b: [22, -26] }, // Back Road
  { a: [-20, -26], b: [-20, 14] }, // Harbor Road
  { a: [4, -26], b: [4, 40] }, // Center Street
  { a: [22, -26], b: [22, 40] }, // East Street
];
const CROSS = [[-20, -26], [4, -26], [22, -26], [-20, -8], [4, -8], [22, -8], [-20, 14], [4, 14], [22, 14]];
// City blocks between road centerlines and which sides have a street.
const BLOCKS = [
  { x0: -20, z0: -26, x1: 4, z1: -8, sides: 'NESW', fill: 'plaza' },
  { x0: 4, z0: -26, x1: 22, z1: -8, sides: 'NESW', fill: 'plaza' },
  { x0: -20, z0: -8, x1: 4, z1: 14, sides: 'NESW', fill: 'plaza' },
  { x0: 4, z0: -8, x1: 22, z1: 14, sides: 'NESW', fill: 'plaza' },
  { x0: 22, z0: -8, x1: 48, z1: 14, sides: 'NSW', fill: null },
  { x0: 4, z0: 14, x1: 22, z1: 40, sides: 'NEW', fill: null },
  { x0: 22, z0: 14, x1: 48, z1: 40, sides: 'NW', fill: null },
  { x0: -14, z0: 14, x1: 4, z1: 40, sides: 'NE', fill: null },
];
// Car loops: one clockwise loop per block, on the inner lane.
export const LOOPS = [
  [-20, -26, 4, -8], [4, -26, 22, -8], [-20, -8, 4, 14], [4, -8, 22, 14],
];

// ---------- windows (one InstancedMesh for the whole city) ----------
class WindowSet {
  constructor() { this.items = []; }
  add(owner, x, y, z, ry, w, h, lit) { this.items.push({ owner, x, y, z, ry, w, h, lit }); }
  // Window grid on the faces of a box. Faces: S (+z), N (-z), E (+x), W (-x).
  grid(owner, rnd, o) {
    const { cx = 0, cz = 0, w, d, y0, rows, rowH, ww = 0.6, wh = 0.9, faces = 'NESW', lit = 0.62, pitch = 1.5, inset = 0.03 } = o;
    const nx = o.cols ?? Math.max(1, Math.round(w / pitch));
    const nz = o.colsZ ?? Math.max(1, Math.round(d / pitch));
    const L = () => (rnd() < lit ? 0.55 + rnd() * 0.45 : 0);
    for (let r = 0; r < rows; r++) {
      const y = y0 + (r + 0.5) * rowH;
      for (let i = 0; i < nx; i++) {
        const x = cx - w / 2 + ((i + 0.5) * w) / nx;
        if (faces.includes('S')) this.add(owner, x, y, cz + d / 2 + inset, 0, ww, wh, L());
        if (faces.includes('N')) this.add(owner, x, y, cz - d / 2 - inset, PI, ww, wh, L());
      }
      for (let i = 0; i < nz; i++) {
        const z = cz - d / 2 + ((i + 0.5) * d) / nz;
        if (faces.includes('E')) this.add(owner, cx + w / 2 + inset, y, z, H, ww, wh, L());
        if (faces.includes('W')) this.add(owner, cx - w / 2 - inset, y, z, -H, ww, wh, L());
      }
    }
  }
  build(material) {
    const n = this.items.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    const lit = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(geo, material, n);
    const local = new THREE.Matrix4(), m = new THREE.Matrix4();
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    this.byOwner = new Map();
    this.items.forEach((it, i) => {
      local.compose(p.set(it.x, it.y, it.z), q.setFromAxisAngle(Y, it.ry), s.set(it.w, it.h, 1));
      if (it.owner) {
        m.multiplyMatrices(it.owner.matrixWorld, local);
        if (!this.byOwner.has(it.owner)) this.byOwner.set(it.owner, []);
        this.byOwner.get(it.owner).push([i, local.clone()]);
      } else m.copy(local);
      mesh.setMatrixAt(i, m);
      lit[i] = it.lit;
    });
    geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(lit, 1));
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    return mesh;
  }
  // Re-place an owner's windows after it moves (hover lift).
  refresh(owner) {
    const list = this.byOwner && this.byOwner.get(owner);
    if (!list) return;
    owner.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    for (const [i, local] of list) { m.multiplyMatrices(owner.matrixWorld, local); this.mesh.setMatrixAt(i, m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- the builder ----------
export function buildWorld({ scene, mats, atlas, places }) {
  const ctx = {
    scene, mats, atlas, places, rnd: rng(20261105),
    groups: {}, pick: [], anim: {}, win: new WindowSet(), blocked: [], lights: [], groundLabels: [],
  };
  terrain(ctx);
  roads(ctx);
  navyPier(ctx);
  lighthouse(ctx);
  airBase(ctx);
  camp(ctx);
  civic(ctx);
  takTower(ctx);
  ironMargins(ctx);
  researchLab(ctx);
  kiosks(ctx);
  university(ctx);
  bookshop(ctx);
  postOffice(ctx);
  groundLabels(ctx);
  filler(ctx);
  props(ctx);
  traffic(ctx);
  scene.updateMatrixWorld(true);
  scene.add(ctx.win.build(mats.win));
  atlas.texture.needsUpdate = true;
  return ctx;
}

function block(ctx, x0, z0, x1, z1) { ctx.blocked.push([x0, z0, x1, z1]); }
function isFree(ctx, x, z, r = 0.8) {
  for (const [x0, z0, x1, z1] of ctx.blocked) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
  return true;
}

function placeGroup(ctx, id, x, z, ry = 0) {
  const g = new THREE.Group();
  g.name = id;
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  ctx.scene.add(g);
  g.updateMatrixWorld(true);
  ctx.groups[id] = { id, group: g, lift: 0 };
  return g;
}
function addKit(ctx, g, kit, id, mat = ctx.mats.flat, opts) {
  const m = kit.mesh(mat, opts);
  g.add(m);
  if (id) { m.userData.place = id; ctx.pick.push(m); }
  return m;
}
function sign(ctx, parent, text, height, x, y, z, ry = 0, style = {}) {
  const cell = ctx.atlas.add(text, style);
  const m = new THREE.Mesh(ctx.atlas.geometry(cell, height), ctx.mats.sign);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const glowSprite = (ctx, color, scale) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.mats.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  s.scale.setScalar(scale);
  return s;
};

// ---------- terrain ----------
function terrain(ctx) {
  const k = new Kit();
  const full = rrect(-W, -D, W, D, R, 8);
  // Soil strata under the whole tile.
  k.prism(full, -6, -3.6, PAL.soil3);
  k.prism(full, -3.6, -1.7, PAL.soil2);
  k.prism(full, -1.7, -0.75, PAL.soil1);
  // Water body (its sides show as a teal band on the tile edge) and the land.
  k.prism(WATER, -0.75, -0.52, PAL.waterSide);
  k.prism(LAND, -0.75, 0, (nx, ny) => (ny > 0.5 ? PAL.grass : PAL.embank));
  // Zones laid over the grass.
  const airfield = [[4 - RW, -D], ...arc(-W + R, -D + R, R, -H, -PI), [-W, -6], [-20 - RW, -6], [-20 - RW, -26 - RW], [4 - RW, -26 - RW]];
  k.prism(airfield, 0, 0.03, PAL.dry);
  const desert = [[22 + RW, -8 - RW], [22 + RW, -D], ...arc(W - R, -D + R, R, -H, 0), [W, -8 - RW]];
  k.prism(desert, 0, 0.035, PAL.sand);
  // Beach along the natural shore.
  const shore = COAST.filter(([x, z]) => z > 15.5);
  k.prism(band(shore, 2.4, 1), 0, 0.04, PAL.sand);
  // Harbor quay.
  k.box(6.5, 0.05, 20.6, PAL.quay, -24.95, 0, 4);
  // Blocks: sidewalks with curbs and paved or grassy interiors.
  for (const b of BLOCKS) {
    const x0 = b.x0 + (b.sides.includes('W') ? RW : 0), x1 = b.x1 - (b.sides.includes('E') ? RW : 0);
    const z0 = b.z0 + (b.sides.includes('N') ? RW : 0), z1 = b.z1 - (b.sides.includes('S') ? RW : 0);
    const sw = 1.1;
    if (b.sides.includes('N')) k.box(x1 - x0, 0.13, sw, PAL.pave, (x0 + x1) / 2, 0, z0 + sw / 2);
    if (b.sides.includes('S')) k.box(x1 - x0, 0.13, sw, PAL.pave, (x0 + x1) / 2, 0, z1 - sw / 2);
    if (b.sides.includes('W')) k.box(sw, 0.13, z1 - z0, PAL.pave, x0 + sw / 2, 0, (z0 + z1) / 2);
    if (b.sides.includes('E')) k.box(sw, 0.13, z1 - z0, PAL.pave, x1 - sw / 2, 0, (z0 + z1) / 2);
    if (b.fill === 'plaza') k.box(x1 - x0 - 0.1, 0.07, z1 - z0 - 0.1, PAL.plaza, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  }
  // Campus quad: lawn with crossing paths.
  k.box(17, 0.06, 0.9, PAL.path, 35, 0, 7.2);
  k.box(0.9, 0.06, 7.6, PAL.path, 35, 0, 8.2);
  k.box(0.9, 0.06, 7.6, PAL.path, 27.5, 0, 8.2);
  k.box(0.9, 0.06, 7.6, PAL.path, 42.5, 0, 8.2);
  // Old town park: pond and paths.
  k.cyl(3.4, 3.4, 0.05, 14, PAL.sand, 36, 0, 29, { sxk: 1.35 });
  k.cyl(2.9, 2.9, 0.06, 14, '#6fb2ad', 36, 0, 29, { sxk: 1.35, glow: null });
  k.box(0.8, 0.05, 11, PAL.path, 29.5, 0, 26);
  k.box(13, 0.05, 0.8, PAL.path, 36, 0, 37.2);
  // Desert dunes.
  const dunes = [[45.6, -31, 3.2], [46.2, -23.5, 2.2], [36, -38.4, 3.0], [27.5, -37.6, 2.2], [42.5, -38.2, 2.0]];
  block(ctx, 31, 25.2, 41, 32.8);
  for (const [x, z, r] of dunes) k.ball(r, PAL.dune, x, -0.2, z, { syk: 0.32, sxk: 1.25, ry: x * 0.3 });
  // Airfield: runway, taxiways, apron, markings.
  k.box(43, 0.06, 5, PAL.runway, -21.5, 0, -35);
  k.box(1.8, 0.065, 9.6, PAL.tarmac, -27, 0, -29.6);
  k.box(23, 0.065, 1.8, PAL.tarmac, -16.5, 0, -30);
  k.box(1.8, 0.065, 3.4, PAL.tarmac, -5.9, 0, -31.9);
  k.box(9.6, 0.062, 16.4, PAL.tarmac, -26.6, 0, -16.4);
  for (let x = -40; x <= -3; x += 2.6) if (x < -30.5 || x > -11.5) k.box(1.3, 0.075, 0.16, PAL.mark, x, 0, -35);
  for (const xe of [-42.2, -0.8]) for (let i = -3; i <= 3; i++) if (i) k.box(1.6, 0.075, 0.3, PAL.mark, xe, 0, -35 + i * 0.6);
  for (let x = -24.5; x <= -7; x += 2) k.box(0.9, 0.07, 0.1, PAL.paint, x, 0, -30);
  // Runway edge lights glow at night.
  for (let x = -42.5; x <= -0.5; x += 3) for (const z of [-37.6, -32.4]) k.box(0.18, 0.2, 0.18, '#e8e2d2', x, 0, z, { glow: x < -40 || x > -2 ? '#9fe0a8' : '#fff3d1', glowK: 1.6 });
  addKit(ctx, ctx.scene, k, null, ctx.mats.flat, { cast: false, receive: true });

  // Animated water surface (separate material).
  const wg = new THREE.PlaneGeometry(W * 2, D * 2, 120, 100).rotateX(-H);
  const water = new THREE.Mesh(wg, ctx.mats.water);
  water.position.y = -0.37;
  water.receiveShadow = true;
  water.matrixAutoUpdate = false; water.updateMatrix();
  ctx.scene.add(water);
}

// ---------- roads ----------
function roads(ctx) {
  const k = new Kit();
  const near = (x, z, d) => CROSS.some(([cx, cz]) => Math.abs(cx - x) < d && Math.abs(cz - z) < d);
  for (const r of ROADS) {
    const [ax, az] = r.a, [bx, bz] = r.b;
    const horiz = az === bz;
    const ext0 = Math.abs(ax) >= W || Math.abs(az) >= D ? 0 : RW;
    const ext1 = Math.abs(bx) >= W || Math.abs(bz) >= D ? 0 : RW;
    if (horiz) k.box(bx - ax + ext0 + ext1, 0.06, RW * 2, PAL.asphalt, (ax - ext0 + bx + ext1) / 2, 0, az);
    else k.box(RW * 2, 0.06, bz - az + ext0 + ext1, PAL.asphalt, ax, 0, (az - ext0 + bz + ext1) / 2);
    const len = horiz ? bx - ax : bz - az;
    for (let t = 1.4; t < len - 0.6; t += 2.4) {
      const x = horiz ? ax + t : ax, z = horiz ? az : az + t;
      if (near(x, z, 2.8)) continue;
      if (horiz) k.box(1.1, 0.075, 0.14, PAL.mark, x, 0, z); else k.box(0.14, 0.075, 1.1, PAL.mark, x, 0, z);
    }
  }
  // Zebra crossings at the busy intersections.
  for (const [cx, cz] of [[4, -8], [22, -8], [4, 14], [22, 14], [-20, -8]]) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ox = cx + dx * (RW + 0.9), oz = cz + dz * (RW + 0.9);
      if (!onLand(ox, oz) || Math.abs(ox) > W - 1 || Math.abs(oz) > D - 1) continue;
      for (let i = -2; i <= 2; i++) {
        if (dx) k.box(1.1, 0.078, 0.32, PAL.mark, ox, 0, cz + i * 0.62);
        else k.box(0.32, 0.078, 1.1, PAL.mark, cx + i * 0.62, 0, oz);
      }
    }
  }
  addKit(ctx, ctx.scene, k, null, ctx.mats.flat, { cast: false });
  for (const r of ROADS) {
    const [ax, az] = r.a, [bx, bz] = r.b;
    block(ctx, Math.min(ax, bx) - RW - 0.6, Math.min(az, bz) - RW - 0.6, Math.max(ax, bx) + RW + 0.6, Math.max(az, bz) + RW + 0.6);
  }
}

// ---------- Harbor: Navy pier and ship ----------
function navyPier(ctx) {
  const id = 'navy', g = placeGroup(ctx, id, -33, 4), k = new Kit();
  // Pier deck on pilings, from the quay out into the harbor.
  k.box(16.4, 0.38, 3.6, '#c3baa9', -3.2, -0.28, -0.6);
  k.box(16.4, 0.14, 0.18, PAL.woodD, -3.2, -0.04, 1.2);
  k.box(16.4, 0.14, 0.18, PAL.woodD, -3.2, -0.04, -2.4);
  for (let x = -11; x <= 4.5; x += 1.9) for (const z of [-2.3, 1.1]) k.cyl(0.17, 0.17, 0.75, 6, PAL.woodD, x, -1.0, z);
  for (let x = -10.4; x <= 4; x += 2.6) k.cyl(0.13, 0.11, 0.32, 6, PAL.dark, x, 0.1, 0.85);
  for (const x of [-9, -1]) { k.box(0.12, 2.2, 0.12, PAL.dark, x, 0.1, -2.1); k.box(0.5, 0.16, 0.26, PAL.dark, x + 0.18, 2.3, -2.1, { glow: WARM, glowK: 1.4 }); }
  // Quay-side crane (portal crane), terracotta.
  const cx = 7.6, cz = 1.6, crane = '#cf7650', craneD = '#a95b3c';
  for (const dx of [-1.4, 1.4]) for (const dz of [-1.7, 1.7]) k.box(0.34, 6.6, 0.34, crane, cx + dx, 0, cz + dz);
  k.box(3.2, 0.4, 0.4, craneD, cx, 1.4, cz - 1.7); k.box(3.2, 0.4, 0.4, craneD, cx, 1.4, cz + 1.7);
  k.box(3.4, 1.1, 4.0, crane, cx, 6.6, cz);
  k.box(13, 0.55, 0.9, crane, cx - 4.6, 7.0, cz);
  k.box(1.6, 1.0, 1.4, PAL.cream, cx - 5.2, 6.0, cz, { glow: WARM, glowK: 0.4 });
  k.box(0.08, 3.2, 0.08, PAL.dark, cx - 8.8, 3.8, cz);
  k.box(0.6, 0.35, 0.6, PAL.mustard, cx - 8.8, 3.45, cz);
  // Containers stacked on the quay.
  const cc = ['#c8704c', '#3f9a98', '#d9a845', '#5d6a73', '#e7d8bd', '#86628c', '#4f8f64'];
  let i = 0;
  for (const [x, z, n] of [[6.2, 6.0, 2], [7.5, 6.0, 3], [8.8, 6.0, 1], [10.1, 6.0, 2], [6.2, 8.9, 1], [7.5, 8.9, 2], [8.8, 8.9, 2], [10.1, 8.9, 1]]) {
    for (let j = 0; j < n; j++) {
      const c = cc[(i++ * 3) % cc.length];
      k.box(1.18, 1.15, 2.6, c, x, 0.06 + j * 1.17, z);
      k.quad(1.0, 0.95, PAL.dark, x, 0.16 + j * 1.17 + 0.48, z + 1.31, { glow: null });
    }
  }
  // Harbor office with a small signal mast.
  k.box(3.4, 2.6, 2.8, PAL.cream, 8.4, 0.06, -7.4);
  k.box(3.7, 0.3, 3.1, PAL.terra2, 8.4, 2.66, -7.4);
  k.box(0.1, 3.4, 0.1, PAL.dark, 9.6, 2.9, -8.2);
  ctx.win.grid(g, ctx.rnd, { cx: 8.4, cz: -7.4, w: 3.4, d: 2.8, y0: 0.4, rows: 1, rowH: 1.8, ww: 0.7, wh: 0.9, pitch: 1.2 });
  addKit(ctx, g, k, id);
  block(ctx, -28.4, -10, -20, 14);

  // The ship rides on its own group so it can bob.
  const ship = new THREE.Group();
  ship.position.set(-3.6, 0, 3.35);
  g.add(ship);
  const s = new Kit();
  const hull = [[-7.6, 0], [-6.3, -0.95], [-4.6, -1.55], [-2.4, -1.72], [6.7, -1.72], [7.5, -1.45], [7.5, 1.45], [6.7, 1.72], [-2.4, 1.72], [-4.6, 1.55], [-6.3, 0.95]];
  s.prism(hull, -0.85, 0.85, (nx, ny) => (ny > 0.5 ? PAL.deck : PAL.hull));
  s.prism(hull.map(([x, z]) => [x * 1.012, z * 1.06]), -0.5, -0.28, '#3c454c');
  s.prism(hull.filter(([x]) => x < -2).concat([[-2.4, 1.72]]).map(([x, z]) => [x, z * 0.98]), 0.85, 1.25, (nx, ny) => (ny > 0.5 ? PAL.deck : PAL.hull));
  s.box(5.6, 1.5, 2.7, PAL.navy1, 1.6, 0.85, 0);
  s.box(4.0, 1.25, 2.4, PAL.navy2, 1.1, 2.35, 0);
  s.box(2.3, 0.95, 2.55, PAL.navy3, -0.2, 3.6, 0);
  s.box(0.06, 0.34, 2.2, PAL.glassD, -1.36, 3.92, 0, { glow: WARM, glowK: 0.8 });
  for (const z of [-1.29, 1.29]) s.box(1.9, 0.3, 0.06, PAL.glassD, -0.1, 3.95, z, { glow: WARM, glowK: 0.6 });
  s.box(1.3, 1.7, 1.3, '#8a959e', 3.3, 3.6, 0);
  s.box(1.36, 0.22, 1.36, PAL.dark, 3.3, 5.3, 0);
  s.cyl(0.12, 0.06, 4.0, 6, PAL.dark, 0.7, 4.55, 0);
  s.box(0.1, 0.08, 2.0, PAL.dark, 0.7, 7.1, 0);
  s.box(0.5, 0.18, 0.5, PAL.navy3, 0.7, 7.8, 0);
  s.cyl(0.5, 0.42, 0.42, 8, PAL.navy2, -4.4, 1.25, 0);
  s.box(1.7, 0.13, 0.13, PAL.dark, -5.3, 1.48, 0);
  for (const z of [-1.5, 1.5]) s.cyl(0.24, 0.24, 1.3, 6, PAL.coral, 0.9, 2.9, z, { rz: H });
  for (let x = -0.6; x <= 3.8; x += 0.75) for (const z of [-1.36, 1.36]) s.box(0.22, 0.22, 0.06, PAL.glassD, x, 1.8, z, { glow: WARM, glowK: 0.5 });
  const shipMesh = addKit(ctx, ship, s, id);
  shipMesh.matrixAutoUpdate = false;
  ctx.anim.ship = ship;
}

// ---------- Lighthouse Point: Pearl Tide lighthouse ----------
function lighthouse(ctx) {
  const id = 'pearltide', g = placeGroup(ctx, id, -39, 30), k = new Kit();
  k.cyl(4.2, 3.7, 1.25, 9, PAL.rock2, 0, -0.95, 0, { ry: 0.3 });
  k.cyl(3.7, 3.5, 0.2, 9, '#d6cbb5', 0, 0.3, 0, { ry: 0.3 });
  const rocks = [[3.6, 1.6, 1.3], [-3.3, 2.2, 1.1], [1.0, 3.9, 1.2], [-1.8, -3.6, 1.4], [3.2, -2.5, 1.0], [-4.2, -0.8, 0.9], [4.6, 0.2, 0.7], [0.4, -4.4, 0.8]];
  rocks.forEach(([x, z, r], i) => k.rock(r, i % 2 ? PAL.rock : PAL.rock3, x, -0.35, z, { syk: 0.75, ry: i }));
  const y0 = 0.5;
  for (let i = 0; i < 5; i++) {
    const rb = 1.3 - i * 0.095, rt = rb - 0.095;
    k.cyl(rb, rt, 1.8, 12, i % 2 ? PAL.terra : PAL.cream, 0, y0 + i * 1.8, 0);
  }
  k.cyl(1.32, 1.32, 0.22, 12, PAL.dark, 0, 9.5, 0);
  k.cyl(1.24, 1.24, 0.5, 12, PAL.dark, 0, 9.72, 0, { open: true });
  k.cyl(0.66, 0.66, 1.05, 8, '#f5f0dc', 0, 9.72, 0, { glow: '#ffe2a6', glowK: 1.4 });
  for (let a = 0; a < 8; a++) k.box(0.06, 1.05, 0.06, PAL.dark, Math.cos(a * PI / 4) * 0.66, 9.72, Math.sin(a * PI / 4) * 0.66);
  k.cone(0.9, 0.95, 8, PAL.terra2, 0, 10.77, 0);
  k.ball(0.14, PAL.dark, 0, 11.8, 0);
  // Keeper's cottage.
  k.box(2.6, 1.7, 2.0, PAL.cream, 2.1, 0.5, -1.1);
  k.gable(2.3, 1.0, 2.9, PAL.terra2, 2.1, 2.2, -1.1, { ry: H });
  k.box(0.3, 0.9, 0.3, PAL.cream2, 2.9, 2.4, -1.5);
  k.quad(0.55, 1.0, PAL.dark, 2.1, 1.0, -0.08);
  k.quad(0.5, 0.5, PAL.glassD, 3.42, 1.4, -1.1, { ry: H, glow: WARM, glowK: 0.9 });
  addKit(ctx, g, k, id);
  // Rotating beam pair, faint by day and bright at night.
  const beam = new THREE.Group();
  beam.position.set(0, 10.25, 0);
  const bg = new THREE.CylinderGeometry(2.6, 0.22, 26, 16, 1, true).translate(0, 13, 0).rotateZ(-H);
  for (const r of [0, PI]) {
    const m = new THREE.Mesh(bg, ctx.mats.beam);
    m.rotation.set(0, r, -0.045);
    m.renderOrder = 2;
    beam.add(m);
  }
  g.add(beam);
  const lamp = glowSprite(ctx, '#ffe0a0', 3.4);
  lamp.position.set(0, 10.25, 0);
  g.add(lamp);
  ctx.anim.beam = beam;
  ctx.anim.lamp = lamp;
}

// ---------- Airfield: Isa Air Base ----------
function airBase(ctx) {
  const id = 'bahrain', g = placeGroup(ctx, id, -31, -24), k = new Kit();
  // Arched hangar, axis along x, door facing the apron (+x).
  const hx = -6, hz = 7.2, hr = 5.3, hl = 12;
  k.box(hl + 0.6, 0.25, hr * 2 + 0.6, PAL.stone, hx, 0, hz);
  k.arch(hr, hl, 10, (nx, ny, nz, cy) => (cy > hr * 0.92 ? '#d9cdb8' : '#e8dfcf'), hx, 0.25, hz, { ry: H, open: true });
  for (let i = -2; i <= 2; i++) k.arch(hr + 0.06, 0.18, 10, '#cbbda5', hx + i * 2.6, 0.25, hz, { ry: H, open: true });
  k.push(new THREE.CircleGeometry(hr, 10, 0, PI), '#d6cab5', { x: hx - hl / 2, y: 0.25, z: hz, ry: -H });
  k.push(new THREE.CircleGeometry(hr - 0.05, 10, 0, PI), '#2f363b', { x: hx + hl / 2 - 0.35, y: 0.25, z: hz, ry: H });
  k.box(0.3, 4.6, 3.0, '#e2d8c6', hx + hl / 2 - 0.05, 0.25, hz - 3.4);
  k.box(0.3, 4.6, 3.0, '#e2d8c6', hx + hl / 2 - 0.05, 0.25, hz + 3.4);
  k.box(0.08, 0.5, 4.4, PAL.slate, hx + hl / 2 + 0.05, hr - 0.8, hz, { glow: WARM, glowK: 0.25 });
  // Control tower.
  const tx = 7.2, tz = -2.8;
  k.box(4.2, 2.6, 3.6, PAL.cream, tx, 0, tz);
  k.box(4.5, 0.25, 3.9, PAL.cream2, tx, 2.6, tz);
  k.cyl(0.95, 0.85, 7.4, 8, PAL.cream, tx, 2.85, tz);
  k.cyl(1.2, 1.55, 1.45, 8, PAL.glassD, tx, 10.2, tz, { glow: '#bfe7e0', glowK: 0.55 });
  k.cyl(1.7, 1.7, 0.3, 8, PAL.terra2, tx, 11.65, tz);
  k.cyl(0.12, 0.08, 1.6, 6, PAL.dark, tx + 0.5, 11.9, tz);
  k.box(0.5, 0.18, 0.5, '#e85a4a', tx + 0.5, 13.5, tz, { glow: '#ff6a55', glowK: 1.6 });
  ctx.win.grid(g, ctx.rnd, { cx: tx, cz: tz, w: 4.2, d: 3.6, y0: 0.3, rows: 1, rowH: 2.0, pitch: 1.3, ww: 0.7, wh: 0.9 });
  // A parked transport aircraft on the apron.
  const plane = aircraft('#d5d8d6', '#9aa3a8');
  plane.parts.forEach((p) => k.parts.push(p.applyMatrix4(new THREE.Matrix4().makeRotationY(-0.35).setPosition(5.4, 0, 9.8))));
  addKit(ctx, g, k, id);
  // Radar on the tower roof.
  const radar = new THREE.Group();
  radar.position.set(tx - 0.6, 11.95, tz);
  const rk = new Kit();
  rk.box(0.08, 0.5, 0.08, PAL.dark, 0, 0, 0);
  rk.box(1.6, 0.28, 0.12, PAL.white, 0, 0.5, 0);
  radar.add(rk.mesh(ctx.mats.flat));
  radar.children[0].userData.place = id;
  ctx.pick.push(radar.children[0]);
  g.add(radar);
  ctx.anim.radar = radar;
  block(ctx, -44, -24, -21, -6);
  block(ctx, -26.5, -30.5, -20, -25);
}

// A small generic aircraft as kit parts, nose toward +x.
function aircraft(body, accent) {
  const k = new Kit();
  k.cyl(0.62, 0.62, 6.4, 10, body, -3.0, 1.15, 0, { rz: -H });
  k.cone(0.62, 1.4, 10, body, 3.4, 1.15, 0, { rz: -H });
  k.cone(0.62, 1.8, 10, body, -3.0, 1.15, 0, { rz: H });
  k.box(1.7, 0.14, 8.6, accent, 0.3, 1.45, 0);
  k.box(1.2, 1.5, 0.14, accent, -4.1, 1.5, 0);
  k.box(0.9, 0.1, 3.0, accent, -4.3, 2.75, 0);
  for (const z of [-2.0, 2.0]) k.cyl(0.26, 0.26, 1.2, 8, PAL.slate, -0.2, 1.08, z, { rz: -H });
  k.box(0.6, 0.12, 1.3, PAL.glassD, 3.0, 1.62, 0);
  for (const [x, z] of [[2.4, 0], [-0.6, -0.9], [-0.6, 0.9]]) k.box(0.18, 0.55, 0.18, PAL.dark, x, 0, z);
  return k;
}

// ---------- Desert edge: Camp Lemonnier ----------
function camp(ctx) {
  const id = 'djibouti', g = placeGroup(ctx, id, 35, -24), k = new Kit();
  // HESCO barrier perimeter with a gate in the south wall.
  const wall = (x0, z0, x1, z1) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.06);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      k.box(1.0, 1.05, 1.0, PAL.hesco, x, 0, z);
      k.box(0.86, 0.05, 0.86, '#bfa676', x, 1.05, z);
    }
  };
  wall(-8, -10.5, 8, -10.5);
  wall(8, -9.44, 8, 10);
  wall(-8, -9.44, -8, 10);
  wall(-6.94, 10, -4.6, 10);
  wall(-1.4, 10, 6.94, 10);
  // Gate posts and boom.
  k.box(0.4, 2.0, 0.4, PAL.tan2, -4.1, 0, 10.6);
  k.box(0.4, 2.0, 0.4, PAL.tan2, -1.9, 0, 10.6);
  k.box(2.4, 0.16, 0.16, '#d9534a', -3.0, 1.2, 10.75);
  // Tents in two rows.
  for (const x of [-3.6, 1.6]) for (const z of [-6.4, -1.4, 3.6]) {
    k.arch(1.6, 4.2, 7, (nx, ny, nz) => (Math.abs(nz) > 0.9 ? PAL.tan2 : PAL.tan), x, 0.02, z, { syk: 1.15 });
    k.quad(0.8, 1.2, '#7d6748', x, 0.62, z + 2.11, {});
    k.box(3.4, 0.05, 4.6, '#cdb48a', x, 0, z);
  }
  // Watchtower in the south-east corner.
  const wx = 6.3, wz = 8.1, th = 7.4;
  for (const dx of [-0.95, 0.95]) for (const dz of [-0.95, 0.95]) k.box(0.24, th, 0.24, PAL.woodD, wx + dx, 0, wz + dz);
  for (const y of [2.2, 4.8]) { k.box(2.1, 0.12, 0.12, PAL.woodD, wx, y, wz + 0.95); k.box(0.12, 0.12, 2.1, PAL.woodD, wx + 0.95, y, wz); k.box(0.12, 0.12, 2.1, PAL.woodD, wx - 0.95, y, wz); }
  k.box(2.9, 0.26, 2.9, PAL.wood, wx, th, wz);
  k.box(2.9, 0.9, 0.18, PAL.tan2, wx, th + 0.26, wz + 1.36);
  k.box(0.18, 0.9, 2.9, PAL.tan2, wx + 1.36, th + 0.26, wz);
  k.box(0.18, 0.9, 2.9, PAL.tan2, wx - 1.36, th + 0.26, wz);
  k.box(2.9, 0.9, 0.18, PAL.tan2, wx, th + 0.26, wz - 1.36);
  for (const dx of [-1.3, 1.3]) for (const dz of [-1.3, 1.3]) k.box(0.12, 1.6, 0.12, PAL.woodD, wx + dx, th + 0.26, wz + dz);
  k.pyr(3.5, 1.1, 3.5, PAL.tan2, wx, th + 1.86, wz);
  k.box(0.34, 0.28, 0.34, PAL.dark, wx - 0.9, th + 1.2, wz + 1.0, { glow: '#fff1c8', glowK: 1.6 });
  for (let y = 0.5; y < th; y += 0.55) k.box(0.6, 0.06, 0.08, PAL.woodD, wx, y, wz + 1.12);
  // Command building with an antenna.
  const bx = -5.4, bz = 7.3;
  k.box(3.8, 2.6, 2.8, PAL.tan2, bx, 0, bz);
  k.box(4.2, 0.2, 3.2, '#a88d60', bx, 2.6, bz);
  k.cyl(0.08, 0.05, 5.0, 5, PAL.dark, bx - 1.2, 2.8, bz - 0.8);
  k.box(0.22, 0.22, 0.22, '#e85a4a', bx - 1.2, 7.8, bz - 0.8, { glow: '#ff6a55', glowK: 1.6 });
  k.quad(0.7, 1.4, '#6f5c40', bx + 0.9, 0.7, bz + 1.42);
  ctx.win.grid(g, ctx.rnd, { cx: bx, cz: bz, w: 3.8, d: 2.8, y0: 0.6, rows: 1, rowH: 1.6, pitch: 1.6, ww: 0.6, wh: 0.6, faces: 'NEW' });
  // Water tank and generator.
  k.cyl(0.9, 0.9, 1.6, 10, '#d8d0c0', 5.2, 0, -7.5);
  k.box(1.8, 1.1, 1.1, '#8f8a6a', 3.0, 0, -8.3);
  // Utility truck outside the gate.
  const truck = new Kit();
  truck.box(2.8, 0.9, 1.4, '#b49b6b', 0, 0.35, 0);
  truck.box(1.1, 0.8, 1.35, '#a68d5f', 0.8, 1.25, 0);
  truck.box(0.06, 0.4, 1.1, PAL.glassD, 1.37, 1.45, 0);
  for (const [x, z] of [[0.9, 0.7], [0.9, -0.7], [-0.9, 0.7], [-0.9, -0.7]]) truck.cyl(0.36, 0.36, 0.3, 8, PAL.dark, x, 0.36, z - Math.sign(z) * 0.15, { rx: H });
  truck.parts.forEach((p) => k.parts.push(p.applyMatrix4(new THREE.Matrix4().makeRotationY(0.4).setPosition(-11.2, 0, 7.4))));
  addKit(ctx, g, k, id);
  block(ctx, 26, -35.5, 44, -13.2);
  block(ctx, 22.5, -19, 26, -14);

  // A camel resting by the dunes; its head bobs.
  const camel = new THREE.Group();
  camel.position.set(10.4, 0, 7.4);
  camel.rotation.y = 2.6;
  camel.scale.setScalar(1.45);
  const ck = new Kit(), fur = '#c49a64', furD = '#a9814f';
  for (const [x, z] of [[0.55, 0.24], [0.55, -0.24], [-0.6, 0.24], [-0.6, -0.24]]) ck.box(0.17, 1.2, 0.17, furD, x, 0, z);
  ck.ball(0.78, fur, 0, 1.55, 0, { sxk: 1.28, syk: 0.6, szk: 0.62 });
  ck.ball(0.48, furD, -0.08, 1.95, 0, { sxk: 1.05, syk: 0.82, szk: 0.78 });
  ck.box(0.08, 0.55, 0.08, furD, -1.0, 1.15, 0, { rz: 0.35 });
  addKit(ctx, camel, ck, id);
  const neck = new THREE.Group();
  neck.position.set(0.82, 1.6, 0);
  const nk = new Kit();
  nk.box(0.26, 1.05, 0.26, fur, 0, 0, 0, { rz: -0.5 });
  nk.box(0.6, 0.32, 0.3, fur, 0.62, 0.84, 0);
  nk.box(0.22, 0.22, 0.26, furD, 0.98, 0.8, 0);
  for (const z of [-0.12, 0.12]) nk.box(0.08, 0.16, 0.06, furD, 0.44, 1.06, z);
  addKit(ctx, neck, nk, id);
  camel.add(neck);
  g.add(camel);
  ctx.anim.camel = neck;
}

// ---------- Civic center: VA police station and medical center ----------
function civic(ctx) {
  const id = 'va', g = placeGroup(ctx, id, 12.5, 3), k = new Kit();
  // Medical center.
  const mx = 2, mz = -3.6;
  k.box(10.6, 0.5, 8.4, PAL.stone, mx, 0, mz);
  k.box(10.2, 8.3, 8, '#f5f0e6', mx, 0.5, mz);
  for (const y of [3.15, 5.75]) k.box(10.4, 0.2, 8.2, '#e3d8c5', mx, y, mz);
  k.box(10.5, 0.45, 8.3, '#e0d4c0', mx, 8.8, mz);
  k.box(3.2, 1.4, 2.6, '#d9cfbf', mx + 3, 9.25, mz - 2);
  k.box(1.6, 0.9, 1.6, PAL.slate, mx - 3.6, 9.25, mz - 2.4);
  k.box(3.6, 0.25, 1.6, '#e3d8c5', mx + 2.2, 2.6, mz + 4.7);
  k.box(0.18, 2.6, 0.18, '#e3d8c5', mx + 0.6, 0.5, mz + 5.35);
  k.box(0.18, 2.6, 0.18, '#e3d8c5', mx + 3.8, 0.5, mz + 5.35);
  k.quad(2.0, 2.0, PAL.glassD, mx + 2.2, 1.5, mz + 4.04, { glow: WARM, glowK: 0.7 });
  ctx.win.grid(g, ctx.rnd, { cx: mx, cz: mz, w: 10.2, d: 8, y0: 0.6, rows: 3, rowH: 2.4, pitch: 1.45, ww: 0.95, wh: 1.15, lit: 0.7 });
  // Police station: two-story brick with a blue lamp over the door.
  const px = -3, pz = 5;
  k.box(6.8, 0.4, 5.4, PAL.stone, px, 0, pz);
  k.box(6.4, 4.5, 5, PAL.brick, px, 0.4, pz);
  k.box(6.8, 0.4, 5.4, PAL.trim, px, 4.9, pz);
  k.box(6.5, 0.45, 5.1, '#a65f44', px, 5.3, pz);
  k.box(2.4, 0.22, 1.3, PAL.trim, px, 2.5, pz + 3.1);
  k.quad(1.3, 2.0, '#33404a', px, 1.4, pz + 2.52);
  k.box(0.5, 0.36, 0.3, '#3d6fb6', px, 3.0, pz + 2.65, { glow: '#5f9bff', glowK: 2.0 });
  k.box(2.8, 0.18, 1.0, PAL.stone, px, 0.4, pz + 3.0);
  ctx.win.grid(g, ctx.rnd, { cx: px, cz: pz, w: 6.4, d: 5, y0: 0.6, rows: 2, rowH: 2.05, pitch: 1.6, ww: 0.75, wh: 1.0, lit: 0.55 });
  // Parking bays.
  for (let i = 0; i < 4; i++) k.box(0.1, 0.075, 2.2, PAL.mark, 1.8 + i * 1.5, 0, 7.6);
  addKit(ctx, g, k, id);
  sign(ctx, g, 'POLICE', 0.62, px, 3.62, pz + 2.54, 0, { bg: '#2d3a4a', fg: '#f4ead6' });
  sign(ctx, g, 'VA MEDICAL CENTER', 0.7, mx, 7.85, mz + 4.04, 0, { bg: '#2c333a', fg: '#f4ead6' });
  const pad = sign(ctx, g, '', 4.0, mx - 1.4, 9.26, mz + 0.4, 0, { draw: helipad, w: 96, h: 96 });
  pad.rotation.x = -H;
  block(ctx, 6, -8, 20, 13);
  // Police cruiser with a light bar that blinks at night.
  const car = new THREE.Group();
  car.position.set(3.9, 0, 7.6);
  car.rotation.y = H + 0.18;
  const ck = new Kit();
  ck.box(2.1, 0.5, 1.0, '#1f2a36', 0, 0.22, 0);
  ck.box(1.2, 0.5, 1.02, '#f6f3ec', -0.05, 0.22, 0);
  ck.box(1.15, 0.42, 0.92, '#f6f3ec', -0.15, 0.72, 0);
  ck.box(0.06, 0.32, 0.8, PAL.glassD, 0.43, 0.76, 0);
  for (const z of [-0.47, 0.47]) ck.box(0.9, 0.26, 0.02, PAL.glassD, -0.15, 0.8, z);
  for (const [x, z] of [[0.68, 0.5], [0.68, -0.5], [-0.68, 0.5], [-0.68, -0.5]]) ck.box(0.42, 0.42, 0.14, PAL.dark, x, 0.04, z);
  for (const z of [-0.3, 0.3]) ck.box(0.04, 0.1, 0.2, '#fff6dc', 1.06, 0.4, z, { glow: '#fff1d0', glowK: 1.5 });
  addKit(ctx, car, ck, id);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), new THREE.MeshBasicMaterial({ color: '#d84040' }));
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), new THREE.MeshBasicMaterial({ color: '#3b6fd6' }));
  red.position.set(-0.15, 1.2, 0.18); blue.position.set(-0.15, 1.2, -0.18);
  car.add(red, blue);
  g.add(car);
  ctx.anim.bar = { red, blue, redC: new THREE.Color('#d84040'), blueC: new THREE.Color('#3b6fd6') };
}

// ---------- Tech district ----------
function takTower(ctx) {
  const id = 'tak', g = placeGroup(ctx, id, -5, -17), k = new Kit();
  const cream = '#f1e8d6', fin = '#dccfb6', band = '#3d7b62', accent = '#2e6b55';
  k.box(10.4, 0.1, 12.6, '#ece3d2', 0, 0, 0);
  k.box(8.4, 2.4, 8.4, PAL.glassD, 0, 0.1, 0, { glow: WARM, glowK: 0.45 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.8, 2.4, 0.8, cream, sx * 4.1, 0.1, sz * 4.1);
  k.box(9.2, 0.5, 9.2, fin, 0, 2.5, 0);
  k.box(8.7, 2.7, 8.7, cream, 0, 3.0, 0);
  k.box(9.3, 0.42, 9.3, fin, 0, 5.7, 0);
  const tier = (s, y0, h, fins) => {
    k.box(s, h, s, cream, 0, y0, 0);
    if (fins) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.55, h + 0.4, 0.55, accent, (sx * s) / 2, y0, (sz * s) / 2);
  };
  tier(6.4, 6.12, 9.2, true);
  k.box(7.1, 0.42, 7.1, fin, 0, 15.3, 0);
  tier(5.0, 15.72, 6.6, true);
  k.box(5.7, 0.4, 5.7, fin, 0, 22.3, 0);
  tier(3.8, 22.7, 3.3, false);
  k.box(4.2, 1.5, 4.2, band, 0, 26.0, 0);
  k.box(4.5, 0.28, 4.5, fin, 0, 27.5, 0);
  k.pyr(3.3, 1.15, 3.3, PAL.terra, 0, 27.78, 0);
  k.cyl(0.2, 0.06, 3.2, 6, PAL.dark, 0, 28.6, 0);
  // Fountain in the plaza.
  k.cyl(1.5, 1.5, 0.35, 12, PAL.stone, 4.6, 0.1, 5.2);
  k.cyl(1.25, 1.25, 0.36, 12, '#79b9b2', 4.6, 0.1, 5.2);
  k.cyl(0.18, 0.12, 0.9, 6, PAL.stone, 4.6, 0.3, 5.2);
  ctx.win.grid(g, ctx.rnd, { w: 8.7, d: 8.7, y0: 3.05, rows: 1, rowH: 2.6, cols: 6, colsZ: 6, ww: 0.95, wh: 1.4, lit: 0.8 });
  ctx.win.grid(g, ctx.rnd, { w: 6.4, d: 6.4, y0: 6.3, rows: 6, rowH: 1.48, cols: 4, colsZ: 4, ww: 0.95, wh: 1.05, lit: 0.72 });
  ctx.win.grid(g, ctx.rnd, { w: 5.0, d: 5.0, y0: 15.85, rows: 4, rowH: 1.55, cols: 3, colsZ: 3, ww: 0.95, wh: 1.1, lit: 0.72 });
  ctx.win.grid(g, ctx.rnd, { w: 3.8, d: 3.8, y0: 22.8, rows: 2, rowH: 1.5, cols: 2, colsZ: 2, ww: 0.9, wh: 1.0, lit: 0.8 });
  addKit(ctx, g, k, id);
  const name = ctx.places.find((p) => p.id === 'tak').data.name;
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    sign(ctx, g, name, 1.0, Math.sin(a) * 2.13, 26.75, Math.cos(a) * 2.13, a, { bg: '#2e6b55', fg: '#f4ead6', track: 0.3, pad: 1.4 });
  }
  // The beacon pulses at night.
  const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), new THREE.MeshBasicMaterial({ color: '#e2775a' }));
  beacon.position.set(0, 32.0, 0);
  beacon.userData.place = id;
  g.add(beacon);
  ctx.pick.push(beacon);
  const halo = glowSprite(ctx, '#ff8a5c', 5.5);
  halo.position.copy(beacon.position);
  g.add(halo);
  ctx.anim.beacon = { beacon, halo };
  block(ctx, -11.2, -23.3, 1.2, -10.7);
}

function ironMargins(ctx) {
  const id = 'ironmargins', g = placeGroup(ctx, id, -13.8, -15), k = new Kit();
  const iron = PAL.iron, frame = '#ece2cf';
  k.box(7.0, 0.9, 8.2, '#41494f', 0, 0, 0.4);
  k.box(6.6, 10.6, 7.6, iron, 0, 0.9, 0.4);
  for (const x of [-3.3, -1.1, 1.1, 3.3]) k.box(0.42, 10.6, 0.3, frame, x, 0.9, 4.25);
  for (const z of [-3.4, -1.0, 1.4, 3.8]) k.box(0.3, 10.6, 0.42, frame, 3.35, 0.9, z);
  k.box(7.0, 0.5, 8.0, '#4a5359', 0, 11.5, 0.4);
  k.box(2.4, 1.2, 2.2, PAL.slate, -1.8, 12.0, -1.6);
  for (const x of [-2.9, 2.9]) k.box(0.14, 1.9, 0.14, PAL.dark, x, 12.0, 3.6);
  k.box(6.2, 0.16, 0.16, PAL.dark, 0, 13.3, 3.6);
  k.box(1.8, 0.5, 0.9, frame, 0, 0.9, 4.65);
  k.quad(1.4, 2.0, PAL.glassD, 0, 1.9, 4.61, { glow: WARM, glowK: 0.6 });
  ctx.win.grid(g, ctx.rnd, { cz: 0.4, w: 6.6, d: 7.6, y0: 1.2, rows: 4, rowH: 2.5, cols: 3, colsZ: 3, ww: 1.4, wh: 1.5, lit: 0.6 });
  // Tower crane for the contractors next door.
  const mx = -3.0, mz = -4.6;
  for (let i = 0; i < 14; i++) k.box(0.62, 1.2, 0.62, i % 2 ? '#d9a845' : '#c8943a', mx, i * 1.2, mz);
  k.box(1.3, 0.3, 1.3, PAL.dark, mx, 0, mz);
  addKit(ctx, g, k, id);
  const name = ctx.places.find((p) => p.id === 'ironmargins').data.name.toUpperCase();
  sign(ctx, g, name, 0.95, 0, 14.0, 3.62, 0, { bg: '#2c333a', fg: '#f0c46a', track: 0.16 });
  const jib = new THREE.Group();
  jib.position.set(mx, 16.8, mz);
  const jk = new Kit(), y = '#d9a845';
  jk.box(1.0, 1.0, 1.1, y, 0, 0, 0);
  jk.box(0.8, 0.7, 0.9, PAL.cream, 0.5, 0.1, 0.45, { glow: WARM, glowK: 0.5 });
  jk.pyr(0.8, 1.8, 0.8, y, 0, 1.0, 0);
  jk.box(0.42, 0.42, 12.5, y, 0, 0.6, 6.6);
  jk.box(0.42, 0.42, 4.2, y, 0, 0.6, -2.6);
  jk.box(1.2, 1.1, 1.3, PAL.slate, 0, 0.0, -4.2);
  jk.box(0.04, 3.2, 0.04, PAL.dark, 0, -2.6, 9.0);
  jk.box(0.5, 0.4, 0.5, PAL.coral, 0, -3.0, 9.0);
  jk.box(0.32, 0.18, 0.32, '#e85a4a', 0, 2.85, 0, { glow: '#ff6a55', glowK: 1.6 });
  addKit(ctx, jib, jk, id);
  g.add(jib);
  ctx.anim.jib = jib;
  block(ctx, -18.4, -20.6, -9.6, -10.4);
}

function researchLab(ctx) {
  const id = 'research', g = placeGroup(ctx, id, 12, -17), k = new Kit();
  const wall = '#ebe1cd';
  k.box(11, 0.6, 7.4, PAL.stone, -1.2, 0, -1.6);
  k.box(10.6, 4.4, 7, wall, -1.2, 0.6, -1.6);
  k.box(10.8, 0.35, 7.2, '#d8ccb6', -1.2, 5.0, -1.6);
  for (let i = 0; i < 3; i++) {
    const sx = -4.6 + i * 3.4;
    k.wedge(6.4, 1.3, 2.6, '#d8ccb6', sx, 5.35, -1.6, { ry: -H });
    k.quad(6.2, 1.18, PAL.glass, sx + 1.32, 6.0, -1.6, { ry: H, glow: WARM, glowK: 0.5 });
  }
  k.box(3.2, 0.25, 1.6, '#d8ccb6', -1.2, 2.6, 2.5);
  k.quad(2.0, 2.0, PAL.glassD, -1.2, 1.6, 1.94, { glow: WARM, glowK: 0.7 });
  k.cyl(0.08, 0.05, 3.2, 5, PAL.dark, 2.6, 5.35, -3.8);
  k.box(0.22, 0.22, 0.22, '#e85a4a', 2.6, 8.5, -3.8, { glow: '#ff6a55', glowK: 1.6 });
  ctx.win.grid(g, ctx.rnd, { cx: -1.2, cz: -1.6, w: 10.6, d: 7, y0: 0.7, rows: 2, rowH: 2.05, pitch: 1.18, ww: 0.95, wh: 1.15, lit: 0.75 });
  // Dish pedestal.
  const dx = 6.2, dz = 3.6;
  k.cyl(1.25, 1.35, 0.5, 10, PAL.stone, dx, 0, dz);
  k.cyl(0.55, 0.42, 2.2, 10, wall, dx, 0.5, dz);
  addKit(ctx, g, k, id);
  sign(ctx, g, 'RESEARCH LAB', 0.55, -1.2, 3.05, 2.32, 0, { bg: '#2e6b55', fg: '#f4ead6' });
  // The dish slowly scans the sky.
  const dish = new THREE.Group();
  dish.position.set(dx, 2.7, dz);
  const yoke = new Kit();
  yoke.box(0.9, 0.4, 0.9, '#d8ccb6', 0, 0, 0);
  for (const x of [-0.5, 0.5]) yoke.box(0.16, 1.1, 0.4, '#d8ccb6', x, 0.3, 0);
  addKit(ctx, dish, yoke, id);
  const tilt = new THREE.Group();
  tilt.position.y = 1.15;
  tilt.rotation.x = 0.75;
  const bowl = new Kit();
  const prof = [];
  for (let i = 0; i <= 7; i++) { const r = (i / 7) * 2.4; prof.push([r, 0.14 * r * r]); }
  bowl.lathe(prof, 18, '#f3ede1');
  bowl.cyl(0.2, 0.2, 0.25, 8, '#cfc5b3', 0, -0.25, 0);
  for (let a = 0; a < 3; a++) {
    const ang = (a * 2 * PI) / 3;
    bowl.box(0.05, 1.9, 0.05, PAL.dark, Math.cos(ang) * 0.95, 0.75, Math.sin(ang) * 0.95, { rz: Math.cos(ang) * 0.45, rx: -Math.sin(ang) * 0.45 });
  }
  bowl.cyl(0.2, 0.2, 0.36, 8, PAL.dark, 0, 1.95, 0);
  addKit(ctx, tilt, bowl, id, ctx.mats.flatDouble);
  dish.add(tilt);
  g.add(dish);
  ctx.anim.dish = dish;
  block(ctx, 5.4, -21.6, 20.6, -12.6);
}

function kiosks(ctx) {
  const ids = ['burpcockpit', 'glassskull', 'smolllm', 'llamacalc', 'hostilevolume'];
  const accents = ['#2e7a4c', '#c8704c', '#3f9a98', '#d39a2e', '#86628c'];
  ids.forEach((id, i) => {
    const pl = ctx.places.find((p) => p.id === id);
    if (!pl) return;
    const g = placeGroup(ctx, id, pl.at[0], pl.at[2]), k = new Kit(), a = accents[i];
    k.box(3.2, 0.12, 2.8, PAL.plaza, 0, 0.07, 0);
    k.box(2.6, 2.2, 2.0, PAL.cream, 0, 0.12, -0.25);
    k.box(2.8, 0.24, 2.3, a, 0, 2.32, -0.25);
    k.quad(2.0, 0.95, '#34393d', 0, 1.3, 0.76, { glow: WARM, glowK: 0.85 });
    k.box(2.3, 0.12, 0.42, PAL.wood, 0, 0.92, 0.92);
    for (let s = 0; s < 5; s++) k.box(0.53, 0.07, 1.25, s % 2 ? PAL.cream : a, -1.06 + s * 0.53, 1.95, 1.18, { rx: 0.42 });
    k.box(0.06, 1.0, 0.06, PAL.dark, -1.25, 0.12, 1.65);
    k.box(0.06, 1.0, 0.06, PAL.dark, 1.25, 0.12, 1.65);
    for (let s = 0; s < 4; s++) k.box(0.2, 0.2, 0.2, '#fff0c8', -0.9 + s * 0.6, 2.62, 0.95, { glow: WARM, glowK: 1.8 });
    addKit(ctx, g, k, id);
    sign(ctx, g, pl.data.name.toUpperCase(), 0.5, 0, 2.95, 0.6, 0, { bg: a, fg: '#fbf4e6', track: 0.06 });
  });
  block(ctx, -17, 7.3, 3, 11);
}

// ---------- Campus: University Hall with a clock tower ----------
function university(ctx) {
  const id = 'education', g = placeGroup(ctx, id, 35, 1), k = new Kit();
  const brick = '#b6674a', trim = PAL.trim, roof = PAL.slate;
  k.box(17.8, 0.5, 6.8, trim, 0, 0, -1.6);
  k.box(17, 4.6, 6.2, brick, 0, 0.5, -1.6);
  k.box(17.4, 0.42, 6.6, trim, 0, 5.1, -1.6);
  k.gable(6.6, 2.0, 17.4, roof, 0, 5.52, -1.6, { ry: H });
  for (const x of [-6.95, -4.65, 4.65, 6.95]) k.box(0.34, 4.6, 0.14, trim, x, 0.5, 1.54);
  // Portico.
  k.box(6.4, 0.22, 2.6, trim, 0, 0, 2.6);
  k.box(5.8, 0.22, 2.2, trim, 0, 0.22, 2.4);
  for (const x of [-2.1, -0.7, 0.7, 2.1]) k.cyl(0.27, 0.24, 4.3, 10, trim, x, 0.44, 3.0);
  k.box(6.0, 0.62, 2.5, trim, 0, 4.74, 2.35);
  k.gable(6.0, 1.3, 2.5, trim, 0, 5.36, 2.35);
  k.quad(1.6, 2.6, '#4b3a30', 0, 1.8, 1.55);
  // Clock tower with a cupola.
  const tz = -1.6;
  k.box(3.6, 9.2, 3.6, brick, 0, 5.5, tz);
  k.box(4.0, 0.36, 4.0, trim, 0, 9.6, tz);
  k.box(3.9, 0.4, 3.9, trim, 0, 14.5, tz);
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    k.quad(0.5, 1.3, '#3a3230', Math.sin(a) * 1.82 + Math.cos(a) * 0.45, 13.45, tz + Math.cos(a) * 1.82 - Math.sin(a) * 0.45, { ry: a, glow: WARM, glowK: 0.35 });
    k.quad(0.5, 1.3, '#3a3230', Math.sin(a) * 1.82 - Math.cos(a) * 0.45, 13.45, tz + Math.cos(a) * 1.82 + Math.sin(a) * 0.45, { ry: a, glow: WARM, glowK: 0.35 });
    k.quad(0.7, 1.1, '#3a3230', Math.sin(a) * 1.82, 8.4, tz + Math.cos(a) * 1.82, { ry: a, glow: WARM, glowK: 0.6 });
  }
  k.cyl(1.35, 1.35, 1.3, 8, trim, 0, 14.9, tz);
  for (let i = 0; i < 8; i++) k.quad(0.4, 0.8, '#3a3230', Math.sin((i * PI) / 4 + PI / 8) * 1.3, 15.15, tz + Math.cos((i * PI) / 4 + PI / 8) * 1.3, { ry: (i * PI) / 4 + PI / 8, glow: WARM, glowK: 0.5 });
  k.cone(1.55, 2.3, 8, PAL.verdigris, 0, 16.2, tz);
  k.ball(0.16, PAL.mustard, 0, 18.55, tz);
  ctx.win.grid(g, ctx.rnd, { cz: -1.6, w: 17, d: 6.2, y0: 0.7, rows: 2, rowH: 2.15, pitch: 1.2, ww: 0.62, wh: 1.45, lit: 0.6, faces: 'NEW' });
  for (const side of [-1, 1]) for (const x of [3.8, 5.8, 7.75]) for (let r = 0; r < 2; r++) {
    ctx.win.add(g, side * x, 0.7 + (r + 0.5) * 2.15, 1.53, 0, 0.78, 1.45, ctx.rnd() < 0.6 ? 0.8 : 0);
  }
  addKit(ctx, g, k, id);
  // Clock faces and hands that keep real time.
  const faceGeo = new THREE.CircleGeometry(1.05, 24);
  const hands = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    const face = new THREE.Group();
    face.position.set(Math.sin(a) * 1.83, 11.2, tz + Math.cos(a) * 1.83);
    face.rotation.y = a;
    const disc = new THREE.Mesh(faceGeo, ctx.mats.clock);
    face.add(disc);
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.03).translate(0, 0.24, 0), ctx.mats.hands);
    const min = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.03).translate(0, 0.37, 0), ctx.mats.hands);
    hour.position.z = min.position.z = 0.03;
    face.add(hour, min);
    hands.push({ hour, min });
    g.add(face);
  }
  ctx.anim.clock = hands;
  block(ctx, 25.6, -6.3, 44.4, 4.6);
}

// ---------- Old town: bookshop and post office ----------
function bookshop(ctx) {
  const id = 'book', g = placeGroup(ctx, id, 16.5, 21), k = new Kit();
  const shop = '#3f5f52', wall = '#efe3cc';
  k.box(5.2, 2.6, 5.4, shop, 0, 0, 0);
  k.box(5.0, 4.6, 5.2, wall, 0, 2.6, 0);
  k.box(5.4, 0.3, 5.6, PAL.trim, 0, 2.5, 0);
  k.gable(5.6, 2.8, 5.8, PAL.terra, 0, 7.2, 0, { ry: H });
  k.box(0.7, 1.6, 0.7, wall, -1.2, 8.2, -1.6);
  k.quad(3.0, 1.55, '#e9d9b0', 2.62, 1.35, -0.7, { ry: H, glow: WARM, glowK: 1.1 });
  k.quad(0.9, 1.9, '#2a2f2c', 2.62, 0.95, 1.7, { ry: H });
  for (let s = 0; s < 6; s++) k.box(1.3, 0.07, 0.6, s % 2 ? PAL.cream : '#7b4f7f', 3.15, 2.12, -2.15 + s * 0.6, { rz: -0.42 });
  // Book cart outside.
  k.box(0.9, 0.7, 1.6, PAL.wood, 3.7, 0, 1.4 - 2.6);
  const bc = ['#c8704c', '#3f9a98', '#d9a845', '#86628c', '#4f8f64', '#5d6a73'];
  for (let i = 0; i < 6; i++) k.box(0.7, 0.16 + (i % 3) * 0.05, 0.22, bc[i], 3.7, 0.7, -1.85 + i * 0.25);
  ctx.win.grid(g, ctx.rnd, { w: 5.0, d: 5.2, y0: 2.8, rows: 2, rowH: 2.2, pitch: 1.6, ww: 0.75, wh: 1.15, lit: 0.75 });
  addKit(ctx, g, k, id);
  sign(ctx, g, 'BOOKS', 0.62, 2.72, 2.95, 0.6, H, { bg: '#3f5f52', fg: '#f4ead6', track: 0.3 });
  block(ctx, 13.4, 17.8, 21, 24.2);
}

function postOffice(ctx) {
  const id = 'contact', g = placeGroup(ctx, id, 16.5, 29), k = new Kit();
  k.box(5.0, 0.4, 6.0, PAL.stone, 0, 0, 0);
  k.box(4.6, 3.7, 5.6, '#e8d8bb', 0, 0.4, 0);
  k.box(5.0, 0.3, 6.0, PAL.trim, 0, 4.1, 0);
  k.pyr(5.4, 1.7, 6.4, PAL.terra2, 0, 4.4, 0);
  for (const z of [-1.1, 1.1]) k.cyl(0.22, 0.2, 3.3, 8, PAL.trim, 2.85, 0.4, z);
  k.box(1.2, 0.4, 3.2, PAL.trim, 2.85, 3.7, 0);
  k.gable(1.2, 0.8, 3.2, PAL.trim, 2.85, 4.1, 0, { ry: H, sx: 3.2, sz: 1.2 });
  k.quad(1.2, 2.1, '#3c4a5c', 2.31, 1.45, 0, { ry: H });
  k.box(0.5, 0.9, 0.55, '#2d5b89', 3.35, 0, 2.5);
  k.arch(0.25, 0.5, 6, '#2d5b89', 3.35, 0.9, 2.5, { ry: H });
  ctx.win.grid(g, ctx.rnd, { w: 4.6, d: 5.6, y0: 0.9, rows: 1, rowH: 2.4, pitch: 1.6, ww: 0.8, wh: 1.4, lit: 0.6, faces: 'NSW' });
  ctx.win.add(g, 2.33, 2.2, -2.1, H, 0.8, 1.4, 0.8);
  ctx.win.add(g, 2.33, 2.2, 2.1, H, 0.8, 1.4, 0.8);
  addKit(ctx, g, k, id);
  // The name runs along the portico frieze, under the pediment.
  sign(ctx, g, 'POST OFFICE', 0.32, 3.47, 3.9, 0, H, { bg: '#2d5b89', fg: '#f4ead6' });
  block(ctx, 13.6, 25.6, 20.6, 32.4);
}

// ---------- district names painted on the ground ----------
function groundLabels(ctx) {
  const atlas = new SignAtlas(1024);
  atlas.texture.premultiplyAlpha = true;
  const az = 40 * (PI / 180);
  const defs = [
    { k: 'harbor', at: [-39.2, -0.15, 17.6], h: 2.3, rot: az, water: true },
    { k: 'coast', at: [-26.6, -0.15, 34.2], h: 1.3, rot: az, water: true },
    { k: 'airfield', at: [-21, 0.085, -35], h: 2.0, rot: 0, paint: true },
    { k: 'desert', at: [35, 0.05, -11.9], h: 1.45, rot: 0 },
    { k: 'campus', at: [31.2, 0.075, 9.8], h: 1.3, rot: 0 },
    { k: 'oldtown', at: [36, 0.03, 34.4], h: 1.5, rot: 0 },
  ];
  for (const d of defs) {
    const name = DISTRICTS[d.k].name.toUpperCase();
    const cell = atlas.add(name, { h: 72, bg: 'rgba(0,0,0,0)', fg: '#ffffff', weight: d.water ? 'italic 700' : 800, track: d.water ? 0.34 : 0.42, pad: 0.2 });
    const day = d.water ? '#f4fbf8' : d.paint ? '#f7f1e2' : DISTRICTS[d.k].color;
    const night = d.water ? '#bfe0e6' : d.paint ? '#e9e2d2' : DISTRICTS[d.k].tint;
    const mat = new THREE.MeshBasicMaterial({ map: atlas.texture, transparent: true, depthWrite: false, premultipliedAlpha: true, color: day, opacity: 0.92 });
    const m = new THREE.Mesh(atlas.geometry(cell, d.h), mat);
    m.rotation.set(-H, d.rot, 0, 'YXZ');
    m.scale.y = 1.4;
    m.position.set(...d.at);
    m.renderOrder = 1;
    m.userData.day = day; m.userData.night = night;
    ctx.scene.add(m);
    ctx.groundLabels.push(m);
    const half = (d.h * cell.aspect) / 2;
    if (!d.water && !d.rot) block(ctx, d.at[0] - half, d.at[2] - d.h, d.at[0] + half, d.at[2] + d.h);
  }
  atlas.texture.needsUpdate = true;
}

// ---------- Filler: houses and apartments ----------
function filler(ctx) {
  const k = new Kit(), w = ctx.win, r = ctx.rnd;
  const walls = ['#efe3cc', '#e8d5b5', '#f2e8d5', '#e5c9a8', '#dcc8ad', '#e9dcc7'];
  const roofs = [PAL.terra, PAL.terra2, PAL.slate, '#9a6a4f', PAL.terra];
  const house = (x, z, hw, hd, floors, ridgeX, i) => {
    const h = floors * 2.3;
    k.box(hw, h, hd, walls[i % walls.length], x, 0, z);
    k.gable(ridgeX ? hd + 0.5 : hw + 0.5, 1.5 + hw * 0.08, ridgeX ? hw + 0.4 : hd + 0.4, roofs[i % roofs.length], x, h, z, { ry: ridgeX ? H : 0 });
    k.box(0.45, 1.0, 0.45, walls[(i + 2) % walls.length], x + hw * 0.22, h + 0.4, z - hd * 0.18);
    k.quad(0.7, 1.3, '#4a3d33', x, 0.65, z + hd / 2 + 0.02);
    w.grid(null, r, { cx: x, cz: z, w: hw, d: hd, y0: 0.2, rows: floors, rowH: 2.3, pitch: 1.5, ww: 0.6, wh: 0.85, lit: 0.55, faces: 'NEW' });
    block(ctx, x - hw / 2, z - hd / 2, x + hw / 2, z + hd / 2);
  };
  const apt = (x, z, aw, ad, floors, i) => {
    const h = floors * 2.4;
    k.box(aw, h, ad, walls[i % walls.length], x, 0, z);
    k.box(aw + 0.3, 0.35, ad + 0.3, '#d6c8b0', x, h, z);
    k.cyl(0.6, 0.6, 1.1, 8, PAL.woodD, x - aw * 0.25, h + 0.35, z - ad * 0.2);
    k.cone(0.68, 0.45, 8, PAL.woodD, x - aw * 0.25, h + 1.45, z - ad * 0.2);
    w.grid(null, r, { cx: x, cz: z, w: aw, d: ad, y0: 0.4, rows: floors, rowH: 2.4, pitch: 1.35, ww: 0.7, wh: 1.0, lit: 0.6 });
    block(ctx, x - aw / 2, z - ad / 2, x + aw / 2, z + ad / 2);
  };
  // Old Town, center block (west side of the block, facing Center Street).
  house(8.2, 18.6, 3.6, 3.4, 2, false, 0);
  house(8.4, 24.2, 3.8, 3.6, 1, true, 1);
  house(8.2, 30, 3.6, 3.4, 2, false, 2);
  house(8.6, 36, 4.0, 3.6, 1, true, 3);
  house(14.4, 36.4, 3.6, 3.4, 2, false, 4);
  // Old Town, east block.
  house(26.2, 18.6, 3.4, 3.4, 2, false, 5);
  house(26.4, 24.0, 3.6, 3.4, 1, true, 1);
  house(31.2, 18.4, 3.4, 3.2, 2, true, 2);
  house(42.6, 18.8, 3.8, 3.6, 2, false, 3);
  house(43.2, 25.6, 3.6, 3.6, 1, false, 0);
  house(26.6, 36.4, 3.6, 3.4, 2, false, 4);
  house(41.6, 35.2, 3.6, 3.4, 1, true, 5);
  // Old Town, west block by the beach.
  house(-1.6, 18.8, 3.6, 3.4, 2, false, 3);
  house(-1.4, 25.4, 3.8, 3.6, 1, true, 0);
  house(-7.6, 19.2, 3.4, 3.2, 1, false, 2);
  house(-2.0, 33.6, 3.6, 3.4, 2, false, 1);
  // Mid-west block: apartments beside the plaza.
  apt(-15.2, -2.6, 4.6, 5.0, 3, 1);
  apt(-1.6, -3.0, 4.2, 4.6, 4, 3);
  // Campus annex.
  apt(46.0 - 2.6, -4.2, 3.6, 4.0, 2, 0);
  ctx.scene.add(k.mesh(ctx.mats.flat));
}

// ---------- props: trees, palms, streetlights, rocks ----------
function props(ctx) {
  const r = ctx.rnd;
  const trees = [], pines = [], palms = [];
  const want = (list, x, z, rad = 1.2) => {
    if (!onLand(x, z) || Math.abs(x) > W - 1.4 || Math.abs(z) > D - 1.4) return;
    const cornerDist = Math.hypot(Math.max(0, Math.abs(x) - (W - R)), Math.max(0, Math.abs(z) - (D - R)));
    if (cornerDist > R - 1.4) return;
    if (!isFree(ctx, x, z, rad)) return;
    list.push([x, z, 0.8 + r() * 0.45, r() * PI * 2]);
    block(ctx, x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  };
  const scatter = (list, x0, z0, x1, z1, n, rad) => {
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const before = list.length;
      want(list, x0 + r() * (x1 - x0), z0 + r() * (z1 - z0), rad);
      if (list.length > before) n--;
    }
  };
  // Plaza trees around the mid-west square.
  for (let i = 0; i < 7; i++) want(trees, -8 + Math.cos((i / 7) * PI * 2) * 4.6, 1.2 + Math.sin((i / 7) * PI * 2) * 3.6, 0.6);
  // Street trees along sidewalks.
  for (let x = -17; x < 46; x += 4.6) { if (x < 20) want(trees, x, -8 - 2.9, 0.4); want(trees, x + 2.3, 14 + 2.9, 0.4); }
  for (let z = -22; z < 38; z += 4.8) { want(trees, 4 + 2.9, z, 0.4); want(trees, 22 - 2.9, z + 2.4, 0.4); }
  // Campus quad.
  for (const [x, z] of [[25.8, 5.6], [25.8, 10.4], [38.8, 10.8], [44.4, 5.8], [44.4, 10.2], [31.6, 4.6], [38.6, 4.6]]) want(trees, x, z, 0.4);
  // Parks and edges.
  scatter(trees, 28, 23, 46, 36, 14, 1.0);
  scatter(pines, 24, 30, 47, 39, 8, 1.0);
  scatter(trees, -12, 16, 2, 39, 10, 1.0);
  scatter(pines, -20, -24, -12, -21, 3, 0.8);
  scatter(trees, 6, -24, 20, -20, 4, 0.8);
  scatter(pines, 44, -8, 47.5, 12, 5, 0.6);
  scatter(trees, -21, -6, -17, 12, 4, 0.6);
  // Palms at the desert camp and the air base.
  for (const [x, z] of [[24.6, -19.6], [24.8, -24], [24.6, -30.4], [46.6, -27.2], [40.6, -11.2], [31, -11.4], [-43.6, -8.2], [-46.2, -24], [-46.4, -16]]) want(palms, x, z, 0.3);

  const treeKit = new Kit();
  treeKit.cyl(0.16, 0.12, 1.1, 5, PAL.trunk, 0, 0, 0);
  treeKit.ball(0.95, PAL.leaf, 0, 1.75, 0, { syk: 1.05 });
  treeKit.ball(0.62, PAL.leaf3, 0.25, 2.45, 0.1);
  const pineKit = new Kit();
  pineKit.cyl(0.14, 0.1, 0.8, 5, PAL.trunk, 0, 0, 0);
  pineKit.cone(0.95, 1.6, 7, PAL.pine, 0, 0.7, 0);
  pineKit.cone(0.72, 1.4, 7, '#6b9764', 0, 1.6, 0);
  pineKit.cone(0.45, 1.1, 7, '#79a370', 0, 2.5, 0);
  const palmKit = new Kit();
  for (let i = 0; i < 5; i++) palmKit.cyl(0.16 - i * 0.015, 0.15 - i * 0.015, 0.7, 6, i % 2 ? '#a0815c' : '#8c6d4c', i * 0.07, i * 0.68, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    palmKit.box(0.34, 0.06, 1.9, i % 2 ? PAL.palm : '#6b9150', Math.cos(a) * 0.8 + 0.35, 3.3, Math.sin(a) * 0.8, { ry: -a + H, rx: 0.35 });
  }
  const inst = (kit, list, cast = true) => {
    const geo = kit.geometry();
    const mesh = new THREE.InstancedMesh(geo, ctx.mats.flat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const tint = new THREE.Color();
    list.forEach(([x, z, sc, rot], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      mesh.setMatrixAt(i, m.compose(p.set(x, 0, z), q, s.set(sc, sc * (0.9 + (i % 5) * 0.06), sc)));
      const v = 0.9 + ((i * 37) % 11) / 55;
      mesh.setColorAt(i, tint.setRGB(v, v * (0.98 + ((i * 13) % 7) / 120), v * 0.95));
    });
    mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    ctx.scene.add(mesh);
    return mesh;
  };
  inst(treeKit, trees); inst(pineKit, pines); inst(palmKit, palms);

  // Streetlights along the roads, with light pools that show at night.
  const lamps = [];
  for (const rd of ROADS) {
    const [ax, az] = rd.a, [bx, bz] = rd.b;
    const horiz = az === bz, len = horiz ? bx - ax : bz - az;
    let side = 1;
    for (let t = 3.2; t < len - 1; t += 7.6) {
      const x = horiz ? ax + t : ax + side * (RW + 0.55), z = horiz ? az + side * (RW + 0.55) : az + t;
      side = -side;
      if (CROSS.some(([cx, cz]) => Math.abs(cx - x) < 3.2 && Math.abs(cz - z) < 3.2)) continue;
      if (!onLand(x, z) || Math.abs(x) > W - 1 || Math.abs(z) > D - 1) continue;
      const ang = horiz ? (z > az ? PI : 0) : (x > ax ? -H : H);
      lamps.push([x, z, ang]);
    }
  }
  for (const [x, z, a] of [[-10, -40 + 8.5, 0], [-30, -40 + 8.5, 0]]) lamps.push([x, z, a]);
  const lampKit = new Kit();
  lampKit.box(0.12, 2.6, 0.12, PAL.dark, 0, 0, 0);
  lampKit.box(0.08, 0.08, 0.7, PAL.dark, 0, 2.55, 0.32);
  lampKit.box(0.26, 0.14, 0.36, PAL.dark, 0, 2.48, 0.65);
  lampKit.box(0.2, 0.05, 0.28, '#fff4d6', 0, 2.43, 0.65, { glow: '#ffd890', glowK: 2.2 });
  const lampMesh = new THREE.InstancedMesh(lampKit.geometry(), ctx.mats.flat, lamps.length);
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-H), ctx.mats.pool, lamps.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  lamps.forEach(([x, z, a], i) => {
    q.setFromAxisAngle(Y, a);
    lampMesh.setMatrixAt(i, m.compose(p.set(x, 0, z), q, s.set(1, 1, 1)));
    const fx = x + Math.sin(a) * 0.65, fz = z + Math.cos(a) * 0.65;
    poolMesh.setMatrixAt(i, m.compose(p.set(fx, 0.14, fz), q, s.set(4.2, 1, 4.2)));
  });
  lampMesh.castShadow = true; lampMesh.receiveShadow = true;
  poolMesh.renderOrder = 1;
  lampMesh.computeBoundingSphere(); poolMesh.computeBoundingSphere();
  ctx.scene.add(lampMesh, poolMesh);
  ctx.anim.pools = poolMesh;

  // Rocks along the natural shore.
  const rk = new Kit();
  const shore = COAST.filter(([, z]) => z > 15);
  for (let i = 0; i < shore.length; i += 2) {
    const [x, z] = shore[i];
    const nx = -0.8, nz = 0.3;
    rk.rock(0.45 + r() * 0.5, r() > 0.5 ? PAL.rock : PAL.rock3, x + nx * (0.3 + r() * 0.5), -0.35, z + nz * (r() - 0.5), { syk: 0.7, ry: r() * 6 });
  }
  for (const [x, z] of [[-28.6, 15.4], [-29.2, -4.8], [-31.8, -6.6]]) rk.rock(0.6, PAL.rock, x, -0.4, z, { syk: 0.7 });
  ctx.scene.add(rk.mesh(ctx.mats.flat, { cast: false }));

  // Windsock at the end of the runway.
  const sock = new THREE.Group();
  sock.position.set(1.4, 0, -37.6);
  const sk = new Kit();
  sk.box(0.1, 3.4, 0.1, PAL.dark, 0, 0, 0);
  const sockArm = new THREE.Group();
  sockArm.position.y = 3.3;
  const sa = new Kit();
  for (let i = 0; i < 4; i++) sa.cyl(0.32 - i * 0.05, 0.27 - i * 0.05, 0.42, 8, i % 2 ? '#f4ead6' : '#e0703f', 0.05 + i * 0.42, 0, 0, { rz: -H });
  sockArm.add(sa.mesh(ctx.mats.flat));
  sock.add(sk.mesh(ctx.mats.flat), sockArm);
  ctx.scene.add(sock);
  ctx.anim.sock = sockArm;
}

// ---------- traffic: cars on block loops, a harbor boat, gulls ----------
function loopPath(x0, z0, x1, z1, inset = 0.85, rad = 1.4) {
  const a = x0 + inset, b = z0 + inset, c = x1 - inset, d = z1 - inset;
  const pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= 6; i++) { const t = a0 + (i / 6) * H; pts.push([cx + Math.cos(t) * rad, cz + Math.sin(t) * rad]); } };
  corner(c - rad, b + rad, -H);
  corner(c - rad, d - rad, 0);
  corner(a + rad, d - rad, H);
  corner(a + rad, b + rad, PI);
  const lens = [0];
  for (let i = 1; i <= pts.length; i++) {
    const [px, pz] = pts[i - 1], [qx, qz] = pts[i % pts.length];
    lens.push(lens[i - 1] + Math.hypot(qx - px, qz - pz));
  }
  return { pts, lens, total: lens[lens.length - 1] };
}
export function sample(path, s, out) {
  const { pts, lens, total } = path;
  s = ((s % total) + total) % total;
  let i = 0;
  while (lens[i + 1] < s) i++;
  const [px, pz] = pts[i], [qx, qz] = pts[(i + 1) % pts.length];
  const t = (s - lens[i]) / (lens[i + 1] - lens[i] || 1);
  out.x = px + (qx - px) * t; out.z = pz + (qz - pz) * t;
  out.a = Math.atan2(-(qz - pz), qx - px);
  return out;
}

function traffic(ctx) {
  const k = new Kit();
  k.box(1.75, 0.42, 0.86, '#ffffff', 0, 0.2, 0);
  k.box(0.95, 0.38, 0.8, '#ffffff', -0.12, 0.62, 0);
  k.box(0.05, 0.28, 0.7, PAL.glassD, 0.37, 0.65, 0);
  k.box(0.05, 0.26, 0.7, PAL.glassD, -0.6, 0.65, 0);
  for (const z of [-0.41, 0.41]) k.box(0.8, 0.22, 0.02, PAL.glassD, -0.12, 0.68, z);
  for (const [x, z] of [[0.55, 0.42], [0.55, -0.42], [-0.55, 0.42], [-0.55, -0.42]]) k.box(0.36, 0.36, 0.1, '#2a2f33', x, 0.03, z);
  for (const z of [-0.28, 0.28]) {
    k.box(0.04, 0.1, 0.18, '#fff6dc', 0.88, 0.36, z, { glow: '#fff1d0', glowK: 1.8 });
    k.box(0.04, 0.1, 0.16, '#a8323a', -0.88, 0.36, z, { glow: '#ff3a3a', glowK: 1.2 });
  }
  const colors = ['#e7dcc6', '#c8704c', '#3f9a98', '#d9a845', '#5d6a73', '#86628c', '#f4f0e8', '#4f8f64', '#b8694c', '#7fa3c4'];
  const paths = LOOPS.map(([x0, z0, x1, z1]) => loopPath(x0, z0, x1, z1));
  const cars = [];
  paths.forEach((path, li) => {
    const n = li === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) cars.push({ path, s: (path.total * i) / n + li * 3.1, v: 3.2 + ((li + i) % 3) * 0.45 });
  });
  const parked = [[7.4, -12.0, H], [8.8, -12.0, H], [10.2, -12.0, H], [-24.2, -9.6, 0.3], [12.2, 33.2, H]];
  const mesh = new THREE.InstancedMesh(k.geometry(), ctx.mats.flat, cars.length + parked.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const c = new THREE.Color();
  for (let i = 0; i < cars.length + parked.length; i++) mesh.setColorAt(i, c.set(colors[(i * 3) % colors.length]));
  parked.forEach(([x, z, a], i) => mesh.setMatrixAt(cars.length + i, m.compose(p.set(x, 0.06, z), q.setFromAxisAngle(Y, a), one)));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  const tmp = { x: 0, z: 0, a: 0 };
  const place = () => {
    cars.forEach((car, i) => {
      sample(car.path, car.s, tmp);
      mesh.setMatrixAt(i, m.compose(p.set(tmp.x, 0.06, tmp.z), q.setFromAxisAngle(Y, tmp.a), one));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  ctx.anim.cars = { update(dt) { for (const car of cars) car.s += car.v * dt; place(); } };

  // A small harbor boat looping between the pier and the lighthouse.
  const boat = new THREE.Group();
  const bk = new Kit();
  const hull = [[-1.3, 0], [-0.8, -0.55], [1.1, -0.6], [1.3, -0.4], [1.3, 0.4], [1.1, 0.6], [-0.8, 0.55]];
  bk.prism(hull.map(([x, z]) => [-x, z]), -0.25, 0.35, (nx, ny) => (ny > 0.5 ? '#efe4cf' : '#c8704c'));
  bk.box(0.9, 0.6, 0.8, PAL.cream, 0.2, 0.35, 0);
  bk.box(1.0, 0.1, 0.9, '#3f9a98', 0.2, 0.95, 0);
  bk.box(0.04, 0.24, 0.6, PAL.glassD, 0.66, 0.55, 0, { glow: WARM, glowK: 0.8 });
  bk.box(0.08, 0.9, 0.08, PAL.dark, -0.3, 0.95, 0);
  boat.add(bk.mesh(ctx.mats.flat));
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1).rotateX(-H).translate(-1.9, 0, 0), new THREE.MeshBasicMaterial({ color: '#f4f6ee', transparent: true, opacity: 0.45, depthWrite: false }));
  wake.position.y = 0.06;
  boat.add(wake);
  ctx.scene.add(boat);
  const bpts = smooth([[-33.5, 22.5], [-26, 20.4], [-19.5, 24], [-17.8, 30], [-22, 35.4], [-29.5, 36.4], [-32.6, 33.8], [-31.4, 27.8], [-33.5, 22.5]], 6);
  const bpath = (() => { const lens = [0]; for (let i = 1; i < bpts.length; i++) lens.push(lens[i - 1] + Math.hypot(bpts[i][0] - bpts[i - 1][0], bpts[i][1] - bpts[i - 1][1])); return { pts: bpts, lens, total: lens[lens.length - 1] }; })();
  let bs = 0;
  const bt = { x: 0, z: 0, a: 0 };
  const placeBoat = (t) => {
    sample(bpath, bs, bt);
    boat.position.set(bt.x, -0.3 + Math.sin(t * 2.1) * 0.05, bt.z);
    boat.rotation.set(Math.sin(t * 1.7) * 0.04, bt.a, Math.sin(t * 2.3) * 0.03);
  };
  placeBoat(0);
  ctx.anim.boat = { update(dt, t) { bs += dt * 2.4; placeBoat(t); } };

  // Gulls circling above the harbor.
  const gulls = new THREE.Group();
  const gk = new Kit();
  gk.box(0.5, 0.05, 0.12, '#f7f3ea', 0, 0, 0.24, { ry: 0.5 });
  gk.box(0.5, 0.05, 0.12, '#f7f3ea', 0, 0, -0.24, { ry: -0.5 });
  gk.box(0.36, 0.1, 0.12, '#e9e4da', 0.05, -0.02, 0);
  const gg = gk.geometry();
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(gg, ctx.mats.flat);
    b.castShadow = true;
    gulls.add(b);
    birds.push({ b, r: 4 + i * 1.3, h: 8 + i * 0.9, sp: 0.35 + i * 0.05, ph: i * 1.7 });
  }
  ctx.scene.add(gulls);
  const placeGulls = (t) => {
    for (const g of birds) {
      const a = t * g.sp + g.ph;
      g.b.position.set(-34 + Math.cos(a) * g.r, g.h + Math.sin(t * 0.8 + g.ph) * 0.4, 12 + Math.sin(a) * g.r * 0.8);
      g.b.rotation.set(Math.sin(t * 6 + g.ph) * 0.35, -a - H, 0);
    }
  };
  placeGulls(0);
  ctx.anim.gulls = { update(dt, t) { placeGulls(t); } };
}
