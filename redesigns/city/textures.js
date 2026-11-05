// Canvas-generated textures: building signs, soft glows, the lighthouse beam
// gradient, and the campus clock face. No image files are loaded.
import * as THREE from 'three';

const FONT = "'Overpass', 'Arial Narrow', sans-serif";

// Packs short text signs into one atlas so every sign shares a material.
export class SignAtlas {
  constructor(size = 1024) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.x = 8; this.y = 8; this.row = 0;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }
  // Returns { u0, v0, u1, v1, aspect } for a sign cell.
  add(text, { h = 88, bg = '#2c333a', fg = '#f4ead6', weight = 800, track = 0.12, pad = 0.9, border = null, draw = null, w = null } = {}) {
    const c = this.ctx;
    c.font = `${weight} ${Math.round(h * 0.56)}px ${FONT}`;
    const chars = [...text];
    const trackPx = h * 0.56 * track;
    const textW = c.measureText(text).width + trackPx * (chars.length - 1);
    const W = Math.ceil(w ?? textW + h * pad);
    if (this.x + W > this.size - 8) { this.x = 8; this.y += this.row + 8; this.row = 0; }
    const x = this.x, y = this.y;
    this.x += W + 8; this.row = Math.max(this.row, h);
    c.save();
    c.translate(x, y);
    if (draw) draw(c, W, h);
    else {
      c.fillStyle = bg;
      roundRect(c, 0, 0, W, h, h * 0.14); c.fill();
      if (border) { c.strokeStyle = border; c.lineWidth = h * 0.06; roundRect(c, h * 0.08, h * 0.08, W - h * 0.16, h - h * 0.16, h * 0.08); c.stroke(); }
      c.fillStyle = fg; c.textBaseline = 'middle';
      let cx = (W - textW) / 2;
      for (const ch of chars) { c.fillText(ch, cx, h * 0.56); cx += c.measureText(ch).width + trackPx; }
    }
    c.restore();
    const S = this.size;
    return { u0: x / S, u1: (x + W) / S, v0: 1 - (y + h) / S, v1: 1 - y / S, aspect: W / h };
  }
  // A plane geometry (facing +z) of the given height mapped to a cell.
  geometry(cell, height) {
    const g = new THREE.PlaneGeometry(height * cell.aspect, height);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, cell.u0 + uv.getX(i) * (cell.u1 - cell.u0), cell.v0 + uv.getY(i) * (cell.v1 - cell.v0));
    }
    return g;
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}

export function helipad(c, W, H) {
  c.fillStyle = '#4c5860'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#f2e8d5'; c.lineWidth = H * 0.06;
  c.beginPath(); c.arc(W / 2, H / 2, H * 0.38, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#f2e8d5'; c.font = `900 ${Math.round(H * 0.5)}px ${FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', W / 2, H * 0.55);
}

export function radialTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)', size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, mid); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vertical alpha ramp: opaque at the bottom (v = 0), clear at the top.
export function rampTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#aaa'); g.addColorStop(1, '#000');
  c.fillStyle = g; c.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(cv);
}

export function clockTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#b96a4d'; c.fillRect(0, 0, S, S);
  c.fillStyle = '#efe4cf';
  c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#2c333a'; c.lineWidth = S * 0.025;
  c.beginPath(); c.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 0.3 : 0.35, r1 = 0.4;
    c.lineWidth = i % 3 === 0 ? S * 0.03 : S * 0.016;
    c.beginPath();
    c.moveTo(S / 2 + Math.sin(a) * S * r0, S / 2 - Math.cos(a) * S * r0);
    c.lineTo(S / 2 + Math.sin(a) * S * r1, S / 2 - Math.cos(a) * S * r1);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
