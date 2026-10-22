import * as THREE from 'three';
import { layers, mesh, toon, rand, pick, V, sprite } from './core.js';

const G = 'garden';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);
const ball = (r) => new THREE.IcosahedronGeometry(r, 1);

const wood = toon(G, '#a0673a');
const woodDark = toon(G, '#7a4a28');
const soil = toon(G, '#5a3d26');
const stem = toon(G, '#4f7a2a');
const pipeMat = toon(G, '#3f86c4');
const steel = toon(G, '#9aa7b4');
const glass = toon(G, '#cfeefa', { opacity: 0.32, side: THREE.DoubleSide });
const frame = toon(G, '#f4f1e8');
const water = toon(G, '#6cc7ff', { emissive: '#2a8fd6', emissiveIntensity: 0.4 });
const gravel = toon(G, '#d9cbb0');
const bed = toon(G, '#c6a678');

const FRUIT = ['#e8483d', '#f2b33d', '#c14bd6', '#ff7aa8', '#ffffff'];
const LEAF_DRY = new THREE.Color('#c9b55a');
const LEAF_WET = new THREE.Color('#3fa34d');

function makePlant(kind) {
  const obj = new THREE.Group();
  const leaf = toon(G, '#3fa34d');
  const flowerMat = toon(G, pick(FRUIT));
  let fruit;
  if (kind === 'corn') {
    obj.add(mesh(cyl(0.06, 0.08, 1.6, 6), stem, 0, 0.8, 0));
    for (let i = 0; i < 4; i++) {
      const l = mesh(new THREE.ConeGeometry(0.12, 0.9, 4), leaf, 0, 0.5 + i * 0.3, 0);
      l.rotation.set(0.9, i * 1.7, 0);
      obj.add(l);
    }
    fruit = mesh(new THREE.ConeGeometry(0.12, 0.4, 6), flowerMat, 0.1, 1.2, 0);
  } else if (kind === 'vine') {
    for (let i = 0; i < 6; i++) obj.add(mesh(ball(0.28), leaf, rand(-0.25, 0.25), 0.3 + i * 0.38, rand(-0.1, 0.1)));
    fruit = new THREE.Group();
    for (let i = 0; i < 3; i++) fruit.add(mesh(ball(0.1), flowerMat, rand(-0.3, 0.3), rand(0.6, 2), 0.2));
  } else if (kind === 'tomato') {
    obj.add(mesh(cyl(0.04, 0.05, 0.9, 6), stem, 0, 0.45, 0));
    obj.add(mesh(ball(0.35), leaf, 0, 0.85, 0));
    obj.add(mesh(ball(0.25), leaf, 0.2, 0.6, 0.1));
    fruit = new THREE.Group();
    for (let i = 0; i < 4; i++) fruit.add(mesh(ball(0.09), flowerMat, rand(-0.3, 0.3), rand(0.5, 0.95), rand(0.15, 0.32)));
  } else {
    // leafy / flower
    for (let i = 0; i < 5; i++) {
      const l = mesh(new THREE.SphereGeometry(0.22, 6, 4), leaf, Math.cos(i * 1.26) * 0.18, 0.18, Math.sin(i * 1.26) * 0.18);
      l.scale.set(1, 0.6, 1.4);
      l.rotation.y = i * 1.26;
      obj.add(l);
    }
    fruit = mesh(new THREE.SphereGeometry(0.16, 8, 6), flowerMat, 0, 0.45, 0);
  }
  obj.add(fruit);
  return { obj, leaf, fruit, kind, growth: rand(0.3, 0.9), pulse: 0 };
}

export function buildGarden(cb) {
  const g = new THREE.Group();
  g.position.copy(cb.center);
  g.rotation.y = cb.gardenYaw;
  layers.garden.group.add(g);
  const plants = [];
  const local = [];

  g.add(mesh(new THREE.CircleGeometry(12.5, 48).rotateX(-Math.PI / 2), bed, 0, 0.02, 0, false));
  const path = mesh(new THREE.RingGeometry(12.5, 13.6, 48).rotateX(-Math.PI / 2), gravel, 0, 0.025, 0, false);
  g.add(path);

  const addPlant = (kind, x, y, z, approach) => {
    const p = makePlant(kind);
    p.obj.position.set(x, y, z);
    g.add(p.obj);
    plants.push(p);
    local.push({ p, at: V(x, 0, z), approach });
  };

  // Planter boxes — one per area of the codebase.
  for (const [i, z] of [-7, -3.5, 0, 3.5].entries()) {
    g.add(mesh(box(6.4, 0.8, 1.6), wood, -2.5, 0.4, z));
    g.add(mesh(box(6.0, 0.1, 1.2), soil, -2.5, 0.81, z, false));
    for (let k = 0; k < 5; k++) {
      const x = -5 + k * 1.25;
      addPlant(['leafy', 'tomato', 'corn', 'flower'][i], x, 0.85, z, V(x, 0, z + 1.25));
    }
  }

  // Greenhouse.
  const gh = new THREE.Group();
  gh.position.set(6, 0, -3);
  g.add(gh);
  const W = 5, D = 7, H = 2.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gh.add(mesh(box(0.12, H, 0.12), frame, (sx * W) / 2, H / 2, (sz * D) / 2));
  for (const sx of [-1, 1]) gh.add(mesh(box(0.08, 0.08, D), frame, (sx * W) / 2, H, 0));
  gh.add(mesh(box(0.1, 0.1, D), frame, 0, H + 1.3, 0));
  for (const sx of [-1, 1]) {
    gh.add(mesh(box(0.04, H, D), glass, (sx * W) / 2, H / 2, 0, false));
    const roof = mesh(box(Math.hypot(W / 2, 1.3), 0.04, D), glass, (sx * W) / 4, H + 0.65, 0, false);
    roof.rotation.z = -sx * Math.atan2(1.3, W / 2);
    gh.add(roof);
  }
  for (const sz of [-1, 1]) {
    gh.add(mesh(box(W, H, 0.04), glass, 0, H / 2, (sz * D) / 2, false));
    const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, 1.3)]);
    gh.add(mesh(new THREE.ShapeGeometry(tri), glass, 0, H, (sz * D) / 2, false));
  }
  for (const x of [-1.2, 1.2]) {
    gh.add(mesh(box(1.4, 0.5, 6), woodDark, x, 0.25, 0));
    for (let k = 0; k < 4; k++) addPlant(pick(['flower', 'tomato']), 6 + x, 0.5, -3 - 2.25 + k * 1.5, V(6, 0, -3 - 2.25 + k * 1.5));
  }

  // Trellis with climbing vines.
  const tz = 6;
  for (const x of [3, 9]) g.add(mesh(box(0.15, 3, 0.15), woodDark, x, 1.5, tz));
  for (let y = 0.6; y <= 3; y += 0.6) g.add(mesh(box(6, 0.06, 0.06), wood, 6, y, tz));
  for (let x = 3.5; x < 9; x += 0.75) {
    const s = mesh(box(0.06, 3, 0.06), wood, x, 1.5, tz);
    s.rotation.z = 0.3;
    g.add(s);
  }
  for (let k = 0; k < 4; k++) addPlant('vine', 3.8 + k * 1.5, 0, tz + 0.25, V(3.8 + k * 1.5, 0, tz + 1.3));

  // Irrigation: tank → manifold → planters and greenhouse, with water flowing through it.
  g.add(mesh(cyl(1.2, 1.2, 2.6, 16), steel, -9.3, 1.3, 7));
  g.add(mesh(cyl(1.25, 1.25, 0.2, 16), pipeMat, -9.3, 2.65, 7));
  const pts = [V(-8, 0.25, 7), V(-7, 0.25, 7), V(-7, 0.25, -8.6), V(6, 0.25, -8.6), V(6, 0.25, -6.6)];
  const pipeCurve = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) pipeCurve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const p = mesh(cyl(0.12, 0.12, len, 8), pipeMat, (a.x + b.x) / 2, 0.25, (a.z + b.z) / 2);
    p.rotation.set(Math.PI / 2, 0, 0);
    p.rotation.order = 'YXZ';
    p.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    g.add(p);
  }
  for (const z of [-7, -3.5, 0, 3.5]) {
    const p = mesh(cyl(0.08, 0.08, 1.5, 6), pipeMat, -6.2, 0.25, z);
    p.rotation.z = Math.PI / 2;
    g.add(p);
  }
  const drops = [];
  for (let i = 0; i < 26; i++) {
    const d = mesh(ball(0.1), water, 0, 0, 0, false);
    d.userData.u = i / 26;
    g.add(d);
    drops.push(d);
  }
  // Rotating sprinkler on the lawn.
  const spr = new THREE.Group();
  spr.position.set(-2.5, 0, 8.6);
  spr.add(mesh(cyl(0.1, 0.1, 0.9), steel, 0, 0.45, 0));
  const head = new THREE.Group();
  head.position.y = 0.9;
  spr.add(head);
  const spray = [];
  for (let i = 0; i < 10; i++) {
    const d = mesh(ball(0.06), water, 0, 0, 0, false);
    head.add(d);
    spray.push(d);
  }
  g.add(spr);
  // Compost bin & sign.
  g.add(mesh(box(1.6, 1, 1.6), woodDark, -9.5, 0.5, -6));
  g.add(mesh(box(1.4, 0.1, 1.4), soil, -9.5, 1.0, -6, false));
  const sign = sprite(G, cb.name, 1.6, { w: 640, h: 128, font: 'bold 64px system-ui', bg: '#fffaf0', fg: '#1f1d2b', stroke: cb.color });
  sign.position.set(0, 4.2, 10.5);
  g.add(sign);

  g.updateMatrixWorld(true);
  for (const l of local) {
    l.p.world = g.localToWorld(l.at.clone());
    l.p.approach = g.localToWorld(l.approach.clone());
  }

  function update(dt, t) {
    for (const p of plants) {
      p.growth = Math.max(0.2, p.growth - dt * 0.006);
      p.pulse = Math.max(0, p.pulse - dt);
      const s = 0.45 + 0.65 * p.growth + Math.sin(p.pulse * 12) * 0.08 * p.pulse;
      p.obj.scale.setScalar(s);
      p.leaf.color.copy(LEAF_DRY).lerp(LEAF_WET, Math.min(1, p.growth * 1.3));
      p.fruit.visible = p.growth > 0.75;
    }
    for (const d of drops) {
      d.userData.u = (d.userData.u + dt * 0.05) % 1;
      d.position.copy(pipeCurve.getPointAt(d.userData.u));
      d.position.y = 0.42;
    }
    head.rotation.y = t * 1.6;
    spray.forEach((d, i) => {
      const k = ((t * 1.5 + i / spray.length) % 1);
      d.position.set(0, k * 1.2 - k * k * 1.6, k * 2.5);
    });
  }
  return { plants, update };
}
