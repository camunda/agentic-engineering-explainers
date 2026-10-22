import * as THREE from 'three';

export const INK = '#1f1d2b';

// Three-step ramp: the flat cel-shaded look of the Nano 3D office (cubefarm).
export const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

// Semantic-zoom layers. Each frame main.js sets layer.o (0..1) from camera distance; every material
// registered in a layer fades with it and the layer's group hides when fully faded.
export const layers = {};
for (const name of ['always', 'far', 'label', 'bpmn', 'garden']) layers[name] = { o: 1, mats: [], group: new THREE.Group() };

export function reg(layer, m, base = 1) {
  m.userData.base = base;
  m.userData.keepT = m.transparent; // textured/glass materials always blend
  layers[layer].mats.push(m);
  return m;
}
export function toon(layer, color, extra = {}) {
  const base = extra.opacity ?? 1;
  return reg(layer, new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }), base);
}
export function basic(layer, opts) {
  return reg(layer, new THREE.MeshBasicMaterial(opts), opts.opacity ?? 1);
}

export function applyLayers() {
  for (const L of Object.values(layers)) {
    L.group.visible = L.o > 0.01;
    for (const m of L.mats) {
      const op = m.userData.base * L.o;
      const tr = op < 0.999 || m.userData.keepT;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op;
      m.depthWrite = op > 0.6 && !(m.userData.keepT && m.map);
    }
  }
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function textCanvas(text, { w = 512, h = 128, font = 'bold 60px system-ui', fg = INK, bg = null, radius = 24, stroke = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, radius); g.fill();
    if (stroke) { g.lineWidth = 6; g.strokeStyle = stroke; g.stroke(); }
  }
  g.font = font; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = h / (lines.length + 0.6);
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function sprite(layer, text, scale, opts) {
  const s = new THREE.Sprite(reg(layer, new THREE.SpriteMaterial({ map: textCanvas(text, opts), transparent: true, depthTest: false })));
  const ar = (opts?.w ?? 512) / (opts?.h ?? 128);
  s.scale.set(scale * ar, scale, 1);
  s.renderOrder = 10;
  return s;
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
