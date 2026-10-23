import * as THREE from 'three';
import { layers, mesh, toon, rand, pick, V, sprite, textCanvas } from './core.js';

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

// Two ways to grow the same seeds (after the "Growing software: before → approach" comic):
// structured = tended soil, planters, trellis (CI), greenhouse (quality gates), irrigation;
// wild = seeds thrown on cracked dirt and hope — overgrowth, weeding, a tiny harvest.
export const gardenMode = { structured: true, listeners: [] };
export function setGardenMode(structured) {
  gardenMode.structured = structured;
  for (const f of gardenMode.listeners) f(structured);
}

const signStyle = { w: 640, h: 128, font: 'bold 60px system-ui', bg: '#fff3a8', fg: '#1f1d2b', stroke: '#1f1d2b' };
const crackedMat = toon(G, '#c9a46e');
const crackLine = toon(G, '#8a6a40');
const tangleMat = toon(G, '#2f6b2a');
const weedMat = toon(G, '#5e8f2e');
const deadMat = toon(G, '#8a6a46');

export function buildGarden(cb) {
  const root = new THREE.Group();
  root.position.copy(cb.center);
  root.rotation.y = cb.gardenYaw;
  layers.garden.group.add(root);
  const g = new THREE.Group(); // structured
  const w = new THREE.Group(); // wild
  root.add(g, w);
  const plants = [];
  const wildPlants = [];
  const local = [];

  g.add(mesh(new THREE.CircleGeometry(12.5, 48).rotateX(-Math.PI / 2), bed, 0, 0.02, 0, false));
  const path = mesh(new THREE.RingGeometry(12.5, 13.6, 48).rotateX(-Math.PI / 2), gravel, 0, 0.025, 0, false);
  root.add(path);

  const addPlant = (kind, x, y, z, approach, list = plants, parent = g) => {
    const p = makePlant(kind);
    p.obj.position.set(x, y, z);
    parent.add(p.obj);
    list.push(p);
    local.push({ p, at: V(x, 0, z), approach });
    return p;
  };
  const label = (text, x, y, z, s = 0.7, parent = g) => {
    const l = sprite(G, text, s, signStyle);
    l.position.set(x, y, z);
    parent.add(l);
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
  root.add(sign);

  // Structure labels, as in the comic.
  label('CI', 6, 3.6, tz);
  label('QUALITY GATES', 6, 4.6, -3);
  label('MODULES', -2.5, 1.5, -8.2, 0.55);
  label('BOUNDARIES', -6.2, 1.6, 4.6, 0.55);
  label('ARCHITECTURE', -9.3, 3.4, 7, 0.55);
  // Harvest crate full of {} fruit.
  const crate = new THREE.Group();
  crate.position.set(9.3, 0, 2.2);
  crate.add(mesh(box(1.8, 0.7, 1.2), wood, 0, 0.35, 0));
  const harvest = [];
  const brace = textCanvas('{}', { w: 64, h: 64, font: 'bold 44px ui-monospace, monospace', fg: '#fff' });
  for (let i = 0; i < 12; i++) {
    const m = mesh(box(0.34, 0.34, 0.34), toon(G, pick(['#e8483d', '#f2b33d', '#3c7ee8', '#8a4fd6', '#2fa36b']), { map: brace }), rand(-0.7, 0.7), 0.75 + (i % 3) * 0.2, rand(-0.4, 0.4));
    m.rotation.y = rand(0, 3);
    crate.add(m);
    harvest.push(m);
  }
  g.add(crate);

  // ---- Wild garden: no soil prep, no structure. ---------------------------------------------
  w.add(mesh(new THREE.CircleGeometry(12.5, 48).rotateX(-Math.PI / 2), crackedMat, 0, 0.02, 0, false));
  for (let i = 0; i < 40; i++) {
    const a = rand(0, 6.28), r = rand(0, 11), len = rand(1, 3);
    const c = mesh(box(len, 0.02, 0.07), crackLine, Math.cos(a) * r, 0.035, Math.sin(a) * r, false);
    c.rotation.y = rand(0, 3.14);
    w.add(c);
  }
  // Seeds thrown anywhere — plants land at random, crowded and unlabelled.
  for (let i = 0; i < 34; i++) {
    const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 10.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const p = addPlant(pick(['leafy', 'tomato', 'corn', 'flower', 'vine']), x, 0, z, V(x * 0.88 + rand(-0.4, 0.4), 0, z * 0.88 + rand(-0.4, 0.4)), wildPlants, w);
    p.obj.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3));
    p.growth = rand(0.2, 0.6);
  }
  // Overgrowth: tangled vines that thicken over time and get hacked back by weeding.
  const tangle = new THREE.Group();
  w.add(tangle);
  for (let i = 0; i < 22; i++) {
    const pts = [];
    let x = rand(-10, 10), z = rand(-10, 10);
    for (let k = 0; k < 6; k++) {
      pts.push(V(x, rand(0.1, 2.2), z));
      x = Math.max(-10, Math.min(10, x + rand(-3, 3)));
      z = Math.max(-10, Math.min(10, z + rand(-3, 3)));
    }
    tangle.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, rand(0.05, 0.12), 5), tangleMat, 0, 0, 0, false));
  }
  const leafGeo = new THREE.SphereGeometry(0.22, 5, 3);
  leafGeo.scale(1, 0.4, 1.6);
  const leaves = new THREE.InstancedMesh(leafGeo, tangleMat, 420);
  const weeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.7, 4), weedMat, 260);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 420; i++) {
    const r = Math.sqrt(Math.random()) * 11, a = rand(0, 6.28);
    m4.compose(V(Math.cos(a) * r, rand(0.1, 2.4), Math.sin(a) * r), q.setFromEuler(e.set(rand(0, 6), rand(0, 6), rand(0, 6))), V(1, 1, 1));
    leaves.setMatrixAt(i, m4);
  }
  for (let i = 0; i < 260; i++) {
    const r = Math.sqrt(Math.random()) * 12, a = rand(0, 6.28), s = rand(0.6, 1.6);
    m4.compose(V(Math.cos(a) * r, 0.35 * s, Math.sin(a) * r), q.setFromEuler(e.set(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), V(s, s, s));
    weeds.setMatrixAt(i, m4);
  }
  tangle.add(leaves);
  w.add(weeds);
  // Pulled-weed piles and a basket with one sad tomato.
  for (const [x, z] of [[8.5, -6], [-8, 6.5], [9, 5]]) {
    const pile = mesh(ball(0.9), deadMat, x, 0.35, z);
    pile.scale.y = 0.5;
    w.add(pile);
  }
  const basket = new THREE.Group();
  basket.position.set(9.3, 0, 2.2);
  basket.add(mesh(cyl(0.7, 0.5, 0.6, 12), woodDark, 0, 0.3, 0));
  basket.add(mesh(ball(0.18), toon(G, '#e8483d'), 0, 0.62, 0));
  w.add(basket);
  label('MORE SEEDS!\nGROW FASTER!', 0, 4.4, 0, 1.0, w);
  let overgrowth = 0.6;

  const apply = (on) => { g.visible = on; w.visible = !on; };
  gardenMode.listeners.push(apply);
  apply(gardenMode.structured);

  root.updateMatrixWorld(true);
  for (const l of local) {
    l.p.world = g.localToWorld(l.at.clone());
    l.p.approach = g.localToWorld(l.approach.clone());
  }

  function update(dt, t) {
    const S = gardenMode.structured;
    if (!S) {
      // Wild: everything competes, weeds choke the plants, effort goes into weeding.
      overgrowth = Math.min(1.25, overgrowth + dt * 0.03);
      tangle.scale.set(1, 0.6 + overgrowth * 0.5, 1);
      weeds.scale.set(1, 0.6 + overgrowth * 0.6, 1);
      for (const p of wildPlants) {
        p.growth = Math.max(0.15, p.growth - dt * (0.02 + overgrowth * 0.03));
        p.pulse = Math.max(0, p.pulse - dt);
        if (p.pulse > 0.95) overgrowth = Math.max(0.3, overgrowth - 0.04);
        p.obj.scale.setScalar(0.45 + 0.65 * p.growth + Math.sin(p.pulse * 12) * 0.08 * p.pulse);
        p.leaf.color.copy(LEAF_DRY).lerp(LEAF_WET, Math.min(1, p.growth * 1.1));
        p.fruit.visible = p.growth > 0.95;
      }
      return;
    }
    let ripe = 0;
    for (const p of plants) {
      if (p.fruit.visible) ripe++;
    }
    harvest.forEach((h, i) => { h.visible = i < Math.round((ripe / plants.length) * harvest.length * 1.4); });
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
  return {
    get plants() { return gardenMode.structured ? plants : wildPlants; },
    get ripe() { return (gardenMode.structured ? plants : wildPlants).filter((p) => p.fruit.visible).length; },
    update,
  };
}
