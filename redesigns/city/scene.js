// Renderer, camera, lights, and everything that moves: camera flights, hover
// and picking, day and night, traffic and other life, and the projected pins.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld, TILE } from './world.js';
import { SignAtlas, radialTexture, rampTexture, clockTexture } from './textures.js';
import { DISTRICTS } from './data.js';

const DEG = Math.PI / 180;
const HOME = { az: 40, el: 33 };
const HALF_H = 50; // ortho frustum half height at zoom 1
const R = 200; // camera distance from target
const UP = new THREE.Vector3(0, 1, 0);

const DAY = { sky: '#fff2dc', ground: '#b49e80', hemi: 1.7, sun: '#ffe6c2', sunI: 2.35, sunDir: [-0.52, 0.76, 0.39], fog: '#e9dcc4', water: '#5fa8a4', spec: '#e3f2ec', sign: 0, win: '#56787e' };
const NIGHT = { sky: '#6f88b8', ground: '#252b3a', hemi: 0.95, sun: '#a9c0ec', sunI: 0.8, sunDir: [0.45, 0.8, -0.4], fog: '#1a2838', water: '#2b5866', spec: '#9fc0e0', sign: 0.9, win: '#2c3d48' };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export async function createScene(o) {
  const { host, places, pins, onHover, onPick, onView, getInsets } = o;
  let reduced = !!o.reduced;
  const coarse = matchMedia('(pointer: coarse)').matches;

  // Wait briefly for the sign font so canvas text uses it.
  try {
    await Promise.race([
      Promise.all([document.fonts.load("800 64px 'Overpass'"), document.fonts.load("italic 700 64px 'Overpass'")]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* canvas text falls back to the system font */ }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(DAY.fog, R - 10, R + 200);

  // ---------- materials ----------
  const uNight = { value: 0 }, uTime = { value: 0 };
  const flat = (side = THREE.FrontSide) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = uNight;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nvarying vec3 vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying vec3 vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uNight;');
    };
    return m;
  };
  const win = new THREE.MeshLambertMaterial({ color: DAY.win });
  win.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uNight;
    sh.uniforms.uWarm = { value: new THREE.Color('#ffc978') };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform vec3 uWarm;\nvarying float vLit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uWarm * vLit * uNight * 1.1;');
  };
  const water = new THREE.MeshPhongMaterial({ color: DAY.water, specular: DAY.spec, shininess: 60, flatShading: true });
  water.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uRect = { value: new THREE.Vector3(TILE.W, TILE.D, TILE.R) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vXZ;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 wp = position.xz;
        transformed.y += sin(wp.x * 0.55 + uTime * 1.1) * 0.05 + sin(wp.y * 0.72 - uTime * 0.9) * 0.04 + sin((wp.x + wp.y) * 0.31 + uTime * 0.6) * 0.03;
        vXZ = wp;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRect;\nvarying vec2 vXZ;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 q = abs(vXZ) - (uRect.xy - uRect.z);
        if (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRect.z > 0.0) discard;`);
  };
  const atlas = new SignAtlas(1024);
  const signMat = new THREE.MeshLambertMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: '#000000' });
  const clockTex = clockTexture();
  const clockMat = new THREE.MeshLambertMaterial({ map: clockTex, emissiveMap: clockTex, emissive: '#000000' });
  const glowTex = radialTexture();
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0.045, alphaMap: rampTexture(), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a', map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.35)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const mats = { flat: flat(), flatDouble: flat(THREE.DoubleSide), win, water, sign: signMat, clock: clockMat, hands: new THREE.MeshLambertMaterial({ color: '#2c333a' }), beam: beamMat, pool: poolMat, glowTex };

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(DAY.sky, DAY.ground, DAY.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -66; sc.right = 66; sc.top = 66; sc.bottom = -66; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3();
  const setSunDir = (d) => { sunDir.set(...d).normalize(); sun.position.copy(sunDir).multiplyScalar(150); };
  setSunDir(DAY.sunDir);

  // ---------- world ----------
  const world = buildWorld({ scene, mats, atlas, places });
  const A = world.anim;
  const byId = new Map(places.map((p) => [p.id, p]));
  const groups = world.groups;
  for (const id of Object.keys(groups)) {
    const box = new THREE.Box3().setFromObject(groups[id].group);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    groups[id].ring = { x: c.x, z: c.z, r: Math.max(2.2, Math.max(size.x, size.z) * 0.55 + 0.4) };
  }

  // Hover and selection rings, in the district's tint.
  const ringGeo = new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2);
  const mkRing = () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    m.renderOrder = 3; m.visible = false; scene.add(m);
    return m;
  };
  const hoverRing = mkRing(), selRing = mkRing();

  // ---------- camera and controls ----------
  const camera = new THREE.OrthographicCamera(-HALF_H, HALF_H, HALF_H, -HALF_H, 1, 520);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = false;
  controls.minPolarAngle = 22 * DEG;
  controls.maxPolarAngle = 72 * DEG;
  controls.zoomSpeed = 1.1;
  controls.rotateSpeed = 0.7;
  controls.zoomToCursor = !coarse;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  let W = 1, H = 1, homeZoom = 1;
  const off = new THREE.Vector3(), sph = new THREE.Spherical();
  const view = { target: new THREE.Vector3(), theta: 0, phi: 0, zoom: 1 };
  const getView = () => {
    off.copy(camera.position).sub(controls.target);
    sph.setFromVector3(off);
    return { target: controls.target.clone(), theta: sph.theta, phi: sph.phi, zoom: camera.zoom };
  };
  const setView = (v) => {
    sph.set(R, v.phi, v.theta);
    off.setFromSpherical(sph);
    controls.target.copy(v.target);
    camera.position.copy(v.target).add(off);
    camera.zoom = v.zoom;
    camera.updateProjectionMatrix();
    camera.lookAt(v.target);
  };

  // Free screen area not covered by the UI, and the view offset that centers it.
  let ins = { left: 0, right: 0, top: 0, bottom: 0 };
  const freeW = () => Math.max(120, W - ins.left - ins.right);
  const freeH = () => Math.max(120, H - ins.top - ins.bottom);
  const offTarget = { x: 0, y: 0 }, offNow = { x: 0, y: 0 };
  const computeOffset = () => {
    offTarget.x = W / 2 - (ins.left + freeW() / 2);
    offTarget.y = H / 2 - (ins.top + freeH() / 2);
  };
  const applyOffset = () => {
    if (Math.abs(offNow.x) < 0.25 && Math.abs(offNow.y) < 0.25) camera.clearViewOffset();
    else camera.setViewOffset(W, H, offNow.x, offNow.y, W, H);
  };

  // Points that bound the city, used to fit the overview.
  const bounds = [];
  for (const x of [-TILE.W, TILE.W]) for (const z of [-TILE.D, TILE.D]) for (const y of [-6, 0]) bounds.push(new THREE.Vector3(x, y, z));
  bounds.push(new THREE.Vector3(-5, 32.5, -17), new THREE.Vector3(35, 19, -0.6), new THREE.Vector3(-16.8, 20, -19.6), new THREE.Vector3(-39, 12, 30));
  const basis = (theta, phi) => {
    const fwd = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).negate();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { fwd, right, up };
  };
  const PIN_ROOM = 46; // px kept free above a landmark for its label
  const homeView = () => {
    const theta = HOME.az * DEG, phi = (90 - HOME.el) * DEG;
    const { fwd, right, up } = basis(theta, phi);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of bounds) { const px = p.dot(right), py = p.dot(up); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    // In a short view, keep room above the city for the tallest labels.
    const room = freeH() < 520 ? PIN_ROOM : 0;
    const zoom = Math.min((100 * freeW()) / (H * (x1 - x0)), (100 * (freeH() - room)) / (H * (y1 - y0))) * 0.95;
    const ppu = (H / 100) * zoom;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + room / 2 / ppu;
    const t = right.clone().multiplyScalar(cx).add(up.clone().multiplyScalar(cy));
    t.addScaledVector(fwd, -t.y / fwd.y);
    return { target: t, theta, phi, zoom };
  };
  // Close-up framing: a circle of radius r around the place fills the free
  // area. In a short view (a phone with the card open) a tall landmark may not
  // fit that way, so the zoom also keeps the ground-to-label span in view, and
  // the focus moves up to center that span when the label would be cut off.
  const placeView = (p) => {
    const fw = freeW(), fh = freeH();
    const ce = Math.cos(p.el * DEG), se = Math.sin(p.el * DEG);
    const foot = Math.min(p.r * 0.5, 6) * se;
    const span = (p.top || 0) * ce + 2 * foot;
    const ppuCircle = Math.min(fw, fh) / (2 * p.r);
    const ppuSpan = (fh * 0.94 - PIN_ROOM) / Math.max(span, 1);
    const top = p.top || 0;
    const ppu = Math.min(ppuCircle, ppuSpan);
    let fy = p.fy ?? 1;
    const up = (top - fy) * ce * ppu + PIN_ROOM, down = (fy * ce + foot) * ppu;
    if (up > fh * 0.47 || down > fh * 0.5) fy = (top * ce + PIN_ROOM / ppu - foot) / 2 / ce;
    const zoom = Math.min(controls.maxZoom, (100 / H) * ppu);
    return { target: new THREE.Vector3(p.at[0], fy, p.at[2]), theta: p.az * DEG, phi: (90 - p.el) * DEG, zoom };
  };

  // ---------- flights ----------
  let flight = null;
  const fly = (to, dur) => {
    const from = getView();
    if (reduced || !dur) { flight = null; setView(to); controls.enabled = true; dirty = true; return; }
    let dT = to.theta - from.theta;
    dT = ((((dT + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const dist = from.target.distanceTo(to.target);
    flight = { from, to: { ...to, theta: from.theta + dT }, t: 0, dur, bump: Math.min(0.32, dist / 110) };
    controls.enabled = false;
  };
  const stepFlight = (dt) => {
    if (!flight) return;
    const f = flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = ease(f.t);
    view.target.lerpVectors(f.from.target, f.to.target, e);
    view.theta = f.from.theta + (f.to.theta - f.from.theta) * e;
    view.phi = f.from.phi + (f.to.phi - f.from.phi) * e;
    view.zoom = Math.exp(Math.log(f.from.zoom) + (Math.log(f.to.zoom) - Math.log(f.from.zoom)) * e) * (1 - f.bump * Math.sin(Math.PI * e));
    setView(view);
    if (f.t >= 1) { flight = null; controls.enabled = true; controls.update(); }
    dirty = true;
  };
  const flightDur = (to) => {
    const d = controls.target.distanceTo(to.target);
    return Math.min(2.1, Math.max(1.15, 0.85 + d / 55));
  };
  canvas.addEventListener('pointerdown', () => { if (flight) { flight = null; controls.enabled = true; } }, true);
  canvas.addEventListener('wheel', () => { if (flight) { flight = null; controls.enabled = true; } }, { capture: true, passive: true });

  // ---------- hover, pick, lift ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null, selected = null, pointerMoved = false, pointerIn = false;
  let down = null;
  const pickAt = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(world.pick, false)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.place) o = o.parent;
    return o ? o.userData.place : null;
  };
  let lastMove = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    lastMove = e; pointerMoved = true; pointerIn = true;
  });
  canvas.addEventListener('pointerleave', () => { pointerIn = false; setHover(null, 'scene'); });
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 7 || dt > 650) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) onPick(id);
  });
  const setHover = (id, from) => {
    if (id === hovered) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : '';
    if (from !== 'ui') onHover(id);
    dirty = true;
  };

  const ringState = (ring, id, k, dt, target) => {
    if (id && groups[id]) {
      const g = groups[id].ring, d = DISTRICTS[byId.get(id).district];
      ring.visible = true;
      ring.position.set(g.x, 0.17, g.z);
      ring.scale.setScalar(g.r * (1 + (1 - ring.material.opacity) * 0.15));
      ring.material.color.set(d.tint);
    }
    const o = damp(ring.material.opacity, id ? target : 0, k, dt);
    ring.material.opacity = o;
    if (o < 0.01 && !id) ring.visible = false;
  };
  const stepLift = (dt) => {
    let moving = false;
    for (const id of Object.keys(groups)) {
      const gr = groups[id];
      const target = id === hovered ? 0.5 : id === selected ? 0.22 : 0;
      if (Math.abs(gr.lift - target) < 0.002) { if (gr.lift !== target) { gr.lift = target; apply(gr); } continue; }
      gr.lift = reduced ? target : damp(gr.lift, target, 14, dt);
      apply(gr);
      moving = true;
    }
    return moving;
  };
  const apply = (gr) => {
    gr.group.position.y = gr.lift;
    gr.group.updateMatrixWorld(true);
    world.win.refresh(gr.group);
  };

  // ---------- pins ----------
  const pv = new THREE.Vector3();
  const pinList = pins.map((p) => ({ ...p, place: byId.get(p.id), w: 0, h: 0, x: -999, y: -999, shown: true }));
  const measure = () => {
    for (const p of pinList) { const b = p.el.firstElementChild; p.w = b.offsetWidth; p.bh = b.offsetHeight; }
  };
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H];
  };
  // Label placement: try short stems first, and at each height try the plate
  // centered on its stem, then hanging right of it, then left of it. A plate
  // must fit inside the free area so it never slides under a panel.
  const STEMS = [12, 36, 60, 84];
  const ALIGN = [0, 1, -1];
  const updatePins = () => {
    const placed = [];
    const hit = (r) => placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    const order = pinList.slice().sort((a, b) => (b.id === selected) - (a.id === selected) || (b.id === hovered) - (a.id === hovered) || b.prio - a.prio);
    const near = camera.zoom > homeZoom * 1.9;
    const L = ins.left, R = W - ins.right, T = ins.top, B = H - ins.bottom;
    for (const p of order) {
      const lift = groups[p.id] ? groups[p.id].lift : 0;
      const pa = p.place.pinAt || [p.place.at[0], p.place.at[2]];
      const [x, y] = project(pa[0], p.place.top + lift, pa[1]);
      const small = p.small && !near && p.id !== hovered && p.id !== selected;
      const inView = x > L && x < R && y > T + 4 && y < B + 20;
      let show = false, stem = p.stem || 12, dx = p.dx || 0;
      if (inView && !small) {
        const post = [x - 3, 0, x + 3, y + 4];
        search: for (const st of STEMS) {
          if (y - st - p.bh < T) break;
          post[1] = y - st;
          if (hit(post)) continue;
          for (const al of ALIGN) {
            const off = al * (p.w / 2 - 14);
            const plate = [x + off - p.w / 2 - 4, y - st - p.bh - 4, x + off + p.w / 2 + 4, y - st + 2];
            if (plate[0] < L || plate[2] > R) continue;
            if (!hit(plate)) { show = true; stem = st; dx = off; placed.push(plate, post.slice()); break search; }
          }
        }
      }
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (stem !== p.stem) { p.el.style.setProperty('--stem', `${stem}px`); p.stem = stem; }
      if (dx !== p.dx) { p.el.style.setProperty('--dx', `${dx.toFixed(1)}px`); p.dx = dx; }
      if (show !== p.shown) { p.el.classList.toggle('is-hidden', !show); p.shown = show; }
      p.el.classList.toggle('is-near', near);
    }
  };

  // ---------- day and night ----------
  let night = 0, nightTarget = 0;
  const cA = new THREE.Color(), cB = new THREE.Color();
  const mix = (a, b, t) => cA.set(a).lerp(cB.set(b), t);
  const dA = new THREE.Vector3(), dB = new THREE.Vector3();
  const applyNight = () => {
    const n = night;
    uNight.value = n;
    hemi.color.copy(mix(DAY.sky, NIGHT.sky, n));
    hemi.groundColor.copy(mix(DAY.ground, NIGHT.ground, n));
    hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * n;
    sun.color.copy(mix(DAY.sun, NIGHT.sun, n));
    sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * n;
    dA.set(...DAY.sunDir).normalize(); dB.set(...NIGHT.sunDir).normalize();
    setSunDir(dA.lerp(dB, n).toArray());
    scene.fog.color.copy(mix(DAY.fog, NIGHT.fog, n));
    water.color.copy(mix(DAY.water, NIGHT.water, n));
    water.specular.copy(mix(DAY.spec, NIGHT.spec, n));
    win.color.copy(mix(DAY.win, NIGHT.win, n));
    signMat.emissive.copy(cA.set('#ffe2b0').multiplyScalar(NIGHT.sign * n));
    clockMat.emissive.copy(cA.set('#ffe9c4').multiplyScalar(0.75 * n));
    poolMat.opacity = 0.75 * n;
    beamMat.opacity = 0.045 + 0.4 * n;
    for (const gl of world.groundLabels) gl.material.color.copy(mix(gl.userData.day, gl.userData.night, n));
    A.lamp.material.opacity = 0.95 * n;
    dirty = true;
  };

  // ---------- life ----------
  let clockSec = -1;
  const tickClock = () => {
    const d = new Date();
    const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    if (s === clockSec) return false;
    clockSec = s;
    const m = (s / 60) % 60, hr = (s / 3600) % 12;
    for (const h of A.clock) { h.min.rotation.z = -(m / 60) * Math.PI * 2; h.hour.rotation.z = -(hr / 12) * Math.PI * 2; }
    return true;
  };
  const restPose = () => {
    A.beam.rotation.y = 0.9;
    A.dish.rotation.y = 0.5;
    A.jib.rotation.y = 255 * DEG;
  };
  restPose();
  const life = (dt, t) => {
    A.cars.update(dt);
    A.boat.update(dt, t);
    A.gulls.update(dt, t);
    A.ship.position.y = Math.sin(t * 1.3) * 0.06;
    A.ship.rotation.x = Math.sin(t * 0.9) * 0.012;
    A.ship.rotation.z = Math.sin(t * 1.1) * 0.01;
    A.beam.rotation.y += dt * 0.75;
    A.dish.rotation.y = 0.5 + Math.sin(t * 0.22) * 0.9;
    A.jib.rotation.y = (255 + 105 * Math.sin(t * 0.11)) * DEG;
    A.radar.rotation.y += dt * 1.8;
    A.sock.rotation.y = Math.sin(t * 0.6) * 0.35 + Math.sin(t * 1.7) * 0.08;
    A.sock.rotation.z = -0.18 + Math.sin(t * 2.4) * 0.05;
    A.camel.rotation.z = Math.sin(t * 1.3) * 0.12;
    uTime.value = t;
  };
  const lights = (t) => {
    const n = night;
    const pulse = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2.6);
    A.beacon.halo.material.opacity = n * (0.25 + 0.75 * pulse);
    A.beacon.halo.scale.setScalar(4 + 3.5 * pulse * n);
    A.beacon.beacon.material.color.copy(cA.set('#e2775a').lerp(cB.set('#ffd2b8'), n * pulse));
    const blink = reduced ? 0.5 : (Math.floor(t * 3.2) % 2);
    A.bar.red.material.color.copy(A.bar.redC).multiplyScalar(1 + n * (blink ? 1.4 : -0.5));
    A.bar.blue.material.color.copy(A.bar.blueC).multiplyScalar(1 + n * (blink ? -0.5 : 1.4));
  };

  // ---------- sizing ----------
  const resize = () => {
    W = host.clientWidth || innerWidth;
    H = host.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    const a = W / H;
    camera.left = -HALF_H * a; camera.right = HALF_H * a; camera.top = HALF_H; camera.bottom = -HALF_H;
    ins = getInsets();
    computeOffset();
    offNow.x = offTarget.x; offNow.y = offTarget.y;
    applyOffset();
    const hv = homeView();
    homeZoom = hv.zoom;
    controls.minZoom = homeZoom * 0.7;
    controls.maxZoom = homeZoom * 9;
    camera.updateProjectionMatrix();
    measure();
    dirty = true;
  };
  window.addEventListener('resize', () => { resize(); if (!selected && !flight) setView(homeView()); });

  // ---------- loop ----------
  let dirty = true, t = 0, last = performance.now(), lastTheta = 99;
  let frames = 0, slow = 0, tuned = false;
  controls.addEventListener('change', () => { dirty = true; });
  const bound = new THREE.Vector3();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    stepFlight(dt);
    if (!flight) controls.update();
    // Keep the target over the city.
    bound.copy(controls.target);
    bound.x = THREE.MathUtils.clamp(bound.x, -TILE.W + 4, TILE.W - 4);
    bound.z = THREE.MathUtils.clamp(bound.z, -TILE.D + 4, TILE.D - 4);
    bound.y = THREE.MathUtils.clamp(bound.y, -2, 22);
    if (!bound.equals(controls.target)) { camera.position.add(bound.clone().sub(controls.target)); controls.target.copy(bound); }
    // Ease the view offset toward the free area.
    if (Math.abs(offNow.x - offTarget.x) > 0.2 || Math.abs(offNow.y - offTarget.y) > 0.2) {
      offNow.x = reduced ? offTarget.x : damp(offNow.x, offTarget.x, 7, dt);
      offNow.y = reduced ? offTarget.y : damp(offNow.y, offTarget.y, 7, dt);
      applyOffset(); camera.updateProjectionMatrix(); dirty = true;
    }
    if (night !== nightTarget) {
      night = reduced ? nightTarget : Math.abs(night - nightTarget) < 0.004 ? nightTarget : damp(night, nightTarget, 2.6, dt);
      applyNight();
    }
    if (pointerMoved && lastMove && !flight && !down) {
      pointerMoved = false;
      setHover(pointerIn ? pickAt(lastMove.clientX, lastMove.clientY) : null, 'scene');
    }
    const lifting = stepLift(dt);
    ringState(hoverRing, hovered !== selected ? hovered : null, 12, dt, 0.85);
    ringState(selRing, selected, 8, dt, 0.95);
    if (hoverRing.visible || selRing.visible) dirty = true;
    if (tickClock()) dirty = true;
    if (!reduced) { life(dt, t); dirty = true; }
    lights(t);
    if (lifting) dirty = true;
    if (dirty) {
      updatePins();
      if (onView) { const th = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z); if (Math.abs(th - lastTheta) > 0.002) { lastTheta = th; onView(th); } }
      renderer.render(scene, camera);
      dirty = false;
      // Drop resolution once if frames are slow on this device.
      if (!tuned && !reduced) {
        frames++;
        if (dt > 0.034) slow++;
        if (frames === 150) {
          tuned = true;
          if (slow > 90 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5)); resize(); }
        }
      }
    }
  };
  let running = false;
  const start = () => { if (!running) { running = true; last = performance.now(); renderer.setAnimationLoop(loop); } };
  const stop = () => { running = false; renderer.setAnimationLoop(null); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  resize();
  setView(homeView());
  applyNight();
  start();

  const api = {
    canvas,
    go(id, { instant = false } = {}) {
      const p = byId.get(id);
      if (!p) return;
      selected = groups[id] ? id : null;
      const to = placeView(p);
      fly(to, instant ? 0 : flightDur(to));
      dirty = true;
    },
    home({ instant = false } = {}) {
      selected = null;
      const to = homeView();
      fly(to, instant ? 0 : flightDur(to));
      dirty = true;
    },
    setNight(on, { instant = false } = {}) {
      nightTarget = on ? 1 : 0;
      if (instant) { night = nightTarget; applyNight(); }
      dirty = true;
    },
    setReduced(on) {
      reduced = on;
      if (on) { restPose(); A.cars.update(0); }
      dirty = true;
    },
    hover(id) { setHover(id, 'ui'); },
    control(action) {
      const v = getView();
      if (action === 'in') v.zoom = Math.min(controls.maxZoom, v.zoom * 1.45);
      else if (action === 'out') v.zoom = Math.max(controls.minZoom, v.zoom / 1.45);
      else if (action === 'left') v.theta -= 45 * DEG;
      else if (action === 'right') v.theta += 45 * DEG;
      else if (action === 'home') { api.home(); return; }
      fly(v, 0.55);
    },
    setInsets() {
      ins = getInsets();
      computeOffset();
      dirty = true;
    },
    refit() { resize(); },
    measure() { measure(); dirty = true; },
    get zoomRatio() { return camera.zoom / homeZoom; },
  };
  return api;
}
