import * as THREE from 'three';
import { layers, mesh, toon, rand, pick, V, sprite, textCanvas } from './core.js';
import { buildPartial } from './partial.js';

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
// kind: 'wild' | 'partial' | 'structured' (structured is kept as a boolean for the existing code).
// speed / policy only drive the partial garden's simulation (see partial.js).
export const gardenMode = { structured: false, partial: false, mutating: false, build: null, speed: 'human', policy: 'wait', listeners: [] };
export const gardenKind = () => (gardenMode.structured ? 'structured' : gardenMode.partial ? 'partial' : 'wild');
// One shared season clock so every garden (and the caption) is on the same beat.
export const season = { t: 0, length: 48 };
const SEASON_PHASES = [
  [0, 'Agents tend the vines; they grow and bear fruit\u2026'],
  [7, '\u2026and the weight starts to bend the trellis.'],
  [10, 'A human steps in to reinforce the structure.'],
  [20.5, 'Agents add a new planter box\u2026'],
  [24, '\u2026but nothing waters it. It starts to wilt.'],
  [27, 'A human routes a new irrigation line.'],
  [35, 'Structure adapted. The garden keeps growing.'],
];
export function seasonPhase() {
  let label = SEASON_PHASES[0][1];
  for (const [at, l] of SEASON_PHASES) if (season.t >= at) label = l;
  return label;
}
export function tickSeason(dt) {
  if (gardenMode.build) {
    gardenMode.build.t += dt;
    if (gardenMode.build.t >= BUILD_LENGTH) { gardenMode.build = null; for (const f of gardenMode.listeners) f(true); }
    return;
  }
  if (gardenMode.structured && gardenMode.mutating) season.t = (season.t + dt) % season.length;
}
export function setMutating(on) {
  gardenMode.mutating = on;
  season.t = 0;
}
// Unstructured → structured is not a switch, it's work: a human walks in with agents and builds it.
export const BUILD_LENGTH = 25;
const BUILD_PHASES = [
  [0, 'A human walks into the garden with a crew of agents\u2026'],
  [1.5, 'First, clear the weeds and prepare the soil.'],
  [5.5, 'Build planter boxes: modules with clear boundaries.'],
  [10.5, 'Put up the greenhouse: quality gates.'],
  [13.5, 'Raise the trellis: CI for things to grow along.'],
  [16, 'Lay the irrigation: architecture that feeds every bed.'],
  [21.5, 'Label it all. Now the agents can tend it.'],
];
export function finishBuild() {
  if (gardenMode.build) gardenMode.build.t = Math.max(gardenMode.build.t, BUILD_LENGTH - 0.001);
}
export function buildPhase() {
  let label = BUILD_PHASES[0][1];
  for (const [at, l] of BUILD_PHASES) if (gardenMode.build.t >= at) label = l;
  return label;
}
export function setGardenMode(structured) {
  setGardenKind(structured ? 'structured' : 'wild');
}
export function setGardenKind(kind) {
  const was = gardenKind();
  if (was === kind) return;
  gardenMode.structured = kind === 'structured';
  gardenMode.partial = kind === 'partial';
  gardenMode.build = kind === 'structured' ? { t: 0, from: was } : null;
  for (const f of gardenMode.listeners) f(gardenMode.structured, true);
}
// Speed / policy changes restart the partial garden's simulation from a clean state.
export function setSim({ speed = gardenMode.speed, policy = gardenMode.policy } = {}) {
  gardenMode.speed = speed;
  gardenMode.policy = policy;
  for (const f of gardenMode.listeners) f(gardenMode.structured, true);
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

  // Build stages: each slice of g's children pops in during the unstructured → structured build.
  const stages = [];
  const mark = (t0, t1, at, regroup = true) => stages.push({ from: g.children.length, t0, t1, at, regroup });
  mark(1.5, 5.5, V(0, 0, 2));
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
    mark(5.5 + (3 - i) * 1.25, 6.75 + (3 - i) * 1.25, V(1.3, 0, z + 0.4));
    g.add(mesh(box(6.4, 0.8, 1.6), wood, -2.5, 0.4, z));
    g.add(mesh(box(6.0, 0.1, 1.2), soil, -2.5, 0.81, z, false));
    for (let k = 0; k < 5; k++) {
      const x = -5 + k * 1.25;
      addPlant(['leafy', 'tomato', 'corn', 'flower'][i], x, 0.85, z, V(x, 0, z + 1.25));
    }
  }

  // Greenhouse.
  mark(10.5, 13.5, V(6, 0, 1.6));
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

  // Trellis with climbing vines. Everything hangs off a pivot at its base so it can lean under load.
  const tz = 6;
  mark(13.5, 16, V(6, 0, tz + 1.6));
  const trellis = new THREE.Group();
  trellis.position.set(6, 0, tz);
  g.add(trellis);
  for (const x of [-3, 3]) trellis.add(mesh(box(0.15, 3, 0.15), woodDark, x, 1.5, 0));
  const rails = [];
  for (let y = 0.6; y <= 3; y += 0.6) { const r = mesh(box(6, 0.06, 0.06), wood, 0, y, 0); r.userData.y = y; trellis.add(r); rails.push(r); }
  for (let x = -2.5; x < 3; x += 0.75) {
    const s = mesh(box(0.06, 3, 0.06), wood, x, 1.5, 0);
    s.rotation.z = 0.3;
    trellis.add(s);
  }
  const vines = [];
  for (let k = 0; k < 4; k++) {
    const x = 3.8 + k * 1.5;
    const p = addPlant('vine', x, 0, tz + 0.25, V(x, 0, tz + 1.3));
    trellis.add(p.obj);
    p.obj.position.set(x - 6, 0, 0.25);
    vines.push(p);
  }
  // Reinforcement a human adds once the trellis starts to bend: a centre post and back braces.
  const braces = new THREE.Group();
  trellis.add(braces);
  const steelPost = toon(G, '#6b7785');
  braces.add(mesh(box(0.22, 3.3, 0.22), steelPost, 0, 1.65, -0.15));
  for (const x of [-3, 0, 3]) {
    const b = mesh(box(0.14, 3.0, 0.14), steelPost, x, 1.3, -1.0);
    b.rotation.x = -0.55;
    braces.add(b);
  }
  braces.add(mesh(box(6.4, 0.12, 0.12), steelPost, 0, 3.05, -0.05));

  mark(16, 20, V(-7.8, 0, 5));
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
  mark(19.5, 20, null, false); // water starts flowing once the pipes are in
  const drops = [];
  for (let i = 0; i < 26; i++) {
    const d = mesh(ball(0.1), water, 0, 0, 0, false);
    d.userData.u = i / 26;
    g.add(d);
    drops.push(d);
  }
  mark(20, 21.5, V(-1, 0, 8.5));
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

  mark(-1, -1, null, false); // managed by the season timeline, not the build
  // ---- Change over time: a new planter box arrives and needs its own irrigation line. -------
  const newBox = new THREE.Group();
  newBox.position.set(-2.5, 0, 7);
  newBox.add(mesh(box(6.4, 0.8, 1.6), wood, 0, 0.4, 0));
  newBox.add(mesh(box(6.0, 0.1, 1.2), soil, 0, 0.81, 0, false));
  const newPlants = [];
  for (let k = 0; k < 5; k++) {
    const p = makePlant(pick(['leafy', 'flower', 'tomato']));
    p.obj.position.set(-2.5 + k * 1.25, 0.85, 0);
    newBox.add(p.obj);
    newPlants.push(p);
  }
  g.add(newBox);
  const hose = mesh(cyl(0.08, 0.08, 1, 6), pipeMat, 0, 0.25, 7);
  hose.rotation.z = Math.PI / 2;
  g.add(hose);
  const hoseDrops = [];
  for (let i = 0; i < 5; i++) { const d = mesh(ball(0.08), water, 0, 0.42, 7, false); g.add(d); hoseDrops.push(d); }
  spr.position.set(1.5, 0, 10); // sprinkler moves aside to make room for the new box

  // The human gardener: bigger, hard hat, toolbox — the one who changes the structure.
  const human = new THREE.Group();
  const hb = new THREE.Group();
  hb.scale.setScalar(1.45);
  human.add(hb);
  hb.add(mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10), toon(G, '#2d5fa8'), 0, 0.65, 0));
  hb.add(mesh(new THREE.SphereGeometry(0.25, 12, 10), toon(G, '#f1c7a1'), 0, 1.3, 0));
  hb.add(mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(G, '#ff8a1f'), 0, 1.38, 0));
  hb.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 16), toon(G, '#ff8a1f'), 0, 1.38, 0.04));
  for (const sx of [1, -1]) hb.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), toon(G, '#1f1d2b'), 0.09 * sx, 1.33, 0.22));
  const arm = new THREE.Group();
  arm.position.set(0.38, 0.95, 0);
  arm.add(mesh(cyl(0.07, 0.07, 0.55, 6), toon(G, '#2d5fa8'), 0, -0.25, 0));
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.5, 0.1);
  hammer.add(mesh(cyl(0.03, 0.03, 0.5, 6), woodDark, 0, 0, 0.2).rotateX(Math.PI / 2));
  hammer.add(mesh(box(0.12, 0.12, 0.25), steel, 0, 0, 0.45).rotateY(Math.PI / 2));
  arm.add(hammer);
  hb.add(arm);
  hb.add(mesh(box(0.5, 0.3, 0.25), toon(G, '#d23c3c'), -0.45, 0.35, 0));
  const humanTag = sprite(G, 'HUMAN', 0.45, { w: 320, h: 110, font: 'bold 64px system-ui', bg: '#ff8a1f', fg: '#fff' });
  humanTag.position.y = 2.9;
  human.add(humanTag);
  g.add(human);

  const warn = (text) => {
    const l = sprite(G, text, 0.75, { ...signStyle, bg: '#ff5a4f', fg: '#fff', stroke: '#fff' });
    g.add(l);
    return l;
  };
  const bendSign = warn('TRELLIS BENDING!');
  bendSign.position.set(6, 5.2, tz);
  const drySign = warn('NO IRRIGATION!');
  drySign.position.set(-2.5, 3, 7);

  mark(21.5, 24, V(8, 0, 4));
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
  stages.push({ from: g.children.length });
  // Gather each stage into a group pivoting at its ground centroid so it can grow up out of the soil.
  for (let i = 0; i < stages.length - 1; i++) {
    const st = stages[i];
    st.objs = g.children.slice(st.from, stages[i + 1].from);
  }
  stages.pop();
  for (const st of stages) {
    if (!st.regroup) continue;
    const c = V(0, 0, 0);
    for (const o of st.objs) c.add(o.position);
    c.multiplyScalar(1 / st.objs.length).setY(0);
    st.group = new THREE.Group();
    st.group.position.copy(c);
    g.add(st.group);
    for (const o of st.objs) { st.group.add(o); o.position.sub(c); }
  }
  // Helper agents who build alongside the human.
  const crew = [];
  for (const [i, col] of ['#e8603c', '#3c7ee8', '#2fa36b', '#8a4fd6'].entries()) {
    const a = new THREE.Group();
    a.add(mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 10), toon(G, col), 0, 0.6, 0));
    a.add(mesh(new THREE.SphereGeometry(0.24, 12, 10), toon(G, '#f1c7a1'), 0, 1.2, 0));
    a.add(mesh(cyl(0.42, 0.42, 0.04, 16), toon(G, '#e9cf7a'), 0, 1.36, 0));
    a.add(mesh(cyl(0.18, 0.22, 0.2, 12), toon(G, '#e9cf7a'), 0, 1.46, 0));
    const plank = mesh(box(1.4, 0.08, 0.25), wood, 0, 1.0, 0.35);
    a.add(plank);
    a.userData = { off: V(Math.cos(i * 1.6 + 0.6) * 1.8, 0, Math.sin(i * 1.6 + 0.6) * 1.8), plank, phase: i * 1.3 };
    a.position.set(rand(-2, 2), 0, 13 + i * 0.6);
    g.add(a);
    crew.push(a);
  }

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

  const apply = (on, resetSim) => {
    const fromPartial = gardenMode.build?.from === 'partial';
    g.visible = on;
    w.visible = (!on && !gardenMode.partial) || (!!gardenMode.build && !fromPartial);
    partial.group.visible = (!on && gardenMode.partial) || (!!gardenMode.build && fromPartial);
    partial.group.scale.set(1, 1, 1);
    if (resetSim) partial.reset();
    if (gardenMode.build) {
      for (const p of plants) p.growth = rand(0.2, 0.35); // freshly planted
      human.position.set(0, 0, 13);
      crew.forEach((a, i) => a.position.set(-1.5 + i, 0, 13.5));
      tangle.scale.set(1, 1, 1);
    }
    if (!on || !gardenMode.build) {
      for (const st of stages) { if (st.group) { st.group.visible = true; st.group.scale.setScalar(1); } else for (const o of st.objs) o.visible = true; }
      for (const a of crew) a.visible = false;
      tangle.visible = weeds.visible = true;
      for (const p of wildPlants) p.obj.visible = true;
    }
  };
  const partial = buildPartial(root, { makePlant, mode: gardenMode });
  gardenMode.listeners.push(apply);
  apply(gardenMode.structured);

  root.updateMatrixWorld(true);
  for (const l of local) {
    l.p.world = g.localToWorld(l.at.clone());
    l.p.approach = g.localToWorld(l.approach.clone());
  }

  function update(dt, t) {
    const S = gardenMode.structured;
    if (!S && gardenMode.partial) { partial.update(dt, t); return; }
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
    mutate(dt, t);
    if (gardenMode.build) buildStep(dt, t);
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
  // ---- Season timeline (structured + evolving) -------------------------------------------------
  const HOME = V(0, 0, 13), AT_TRELLIS = V(6, 0, tz - 1.6), AT_HOSE = V(-7.6, 0, 8.2);
  const lerpPath = (k, pts) => {
    const f = Math.min(pts.length - 1.0001, Math.max(0, k) * (pts.length - 1));
    return pts[Math.floor(f)].clone().lerp(pts[Math.floor(f) + 1], f - Math.floor(f));
  };
  const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  function mutate(dt, t) {
    const T = gardenMode.mutating && !gardenMode.build ? season.t : -1;
    const on = T >= 0;
    // Load: vines grow heavy with fruit, then the trellis leans until reinforced.
    const load = on ? ramp(T, 0, 9) : 0;
    const reinforce = on ? ramp(T, 16, 20) : 0;
    const bend = load * (1 - reinforce) * (on ? ramp(T, 4, 10) : 0);
    trellis.rotation.x = bend * 0.32 + Math.sin(t * 3) * 0.015 * bend;
    trellis.rotation.z = bend * 0.06;
    rails.forEach((r) => { r.position.y = r.userData.y - bend * 0.25 * (r.userData.y / 3) ** 2; r.rotation.z = Math.sin(r.userData.y * 3) * bend * 0.05; });
    braces.visible = reinforce > 0;
    braces.scale.set(1, Math.max(0.01, reinforce), 1);
    for (const v of vines) {
      if (on && T < 36) v.growth = Math.max(v.growth, 0.5 + load * 0.5);
      for (const f of v.fruit.children) f.scale.setScalar(1 + load * 1.3);
    }
    bendSign.visible = bend > 0.5;
    // A new planter box grows in; its plants wilt until a hose is routed to it.
    const boxIn = on ? ramp(T, 20, 22.5) : 0;
    newBox.visible = boxIn > 0;
    newBox.scale.setScalar(Math.max(0.01, boxIn));
    const hoseLen = on ? ramp(T, 31, 34) : 0;
    hose.visible = hoseLen > 0;
    hose.scale.set(1, Math.max(0.01, hoseLen * 2.4), 1);
    hose.position.x = -7 + hoseLen * 1.2;
    hoseDrops.forEach((d, i) => { d.visible = hoseLen >= 1; d.position.x = -7 + ((t * 0.8 + i / 5) % 1) * 2.4; });
    const watered = on ? ramp(T, 34, 38) : 0;
    const wilt = on ? ramp(T, 22, 28) : 0;
    for (const p of newPlants) {
      const gr = 0.9 - wilt * 0.6 + watered * 0.6;
      p.obj.scale.setScalar(0.45 + 0.6 * gr);
      p.obj.rotation.z = (1 - watered) * wilt * 0.5;
      p.leaf.color.copy(LEAF_DRY).lerp(LEAF_WET, Math.min(1, gr));
      p.fruit.visible = gr > 0.85;
    }
    drySign.visible = boxIn >= 1 && hoseLen < 1;
    // The human walks in, reinforces the trellis, then routes the new hose, then leaves.
    human.visible = on && T > 9 && T < 44;
    if (human.visible) {
      let pos, working = false;
      if (T < 14) pos = lerpPath(ramp(T, 9, 14), [HOME, V(6, 0, 11), AT_TRELLIS.clone().setZ(tz + 1.6)]);
      else if (T < 15.5) pos = lerpPath(ramp(T, 14, 15.5), [AT_TRELLIS.clone().setZ(tz + 1.6), V(9.8, 0, tz), AT_TRELLIS]);
      else if (T < 20.5) { pos = AT_TRELLIS; working = true; }
      else if (T < 28) pos = lerpPath(ramp(T, 25, 30), [AT_TRELLIS, V(10, 0, 9), V(0, 0, 10.6), AT_HOSE]);
      else if (T < 34) { pos = lerpPath(ramp(T, 25, 30), [AT_TRELLIS, V(10, 0, 9), V(0, 0, 10.6), AT_HOSE]); working = T > 30; }
      else pos = lerpPath(ramp(T, 38, 43), [AT_HOSE, V(-4, 0, 10.6), HOME]);
      const prev = human.position.clone();
      human.position.copy(pos);
      const d = pos.clone().sub(prev);
      if (d.lengthSq() > 1e-6) human.rotation.y = Math.atan2(d.x, d.z);
      else if (working) human.rotation.y = T < 21 ? 0 : -Math.PI * 0.6;
      arm.rotation.x = working ? -1.2 + Math.sin(t * 14) * 0.7 : Math.sin(t * 8) * 0.3;
      hb.position.y = d.lengthSq() > 1e-6 ? Math.abs(Math.sin(t * 10)) * 0.1 : 0;
    }
  }

  // ---- Build transition -----------------------------------------------------------------------
  const easeBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
  const tmp = V(0, 0, 0);
  function buildStep(dt, t) {
    const T = gardenMode.build.t;
    // Clear the wild: overgrowth shrinks away as the crew pulls it.
    const clear = ramp(T, 1, 5);
    tangle.scale.set(Math.max(0.01, 1 - clear), Math.max(0.01, (1 - clear) * 1.1), Math.max(0.01, 1 - clear));
    weeds.scale.set(1, Math.max(0.01, 1 - clear), 1);
    for (const p of wildPlants) p.obj.scale.setScalar(Math.max(0.01, (1 - clear) * 0.8));
    if (gardenMode.build.from === 'partial') {
      w.visible = false;
      partial.group.visible = clear < 1;
      partial.group.scale.set(1, Math.max(0.01, 1 - clear), 1);
    } else w.visible = clear < 1;
    // Stages grow in, the human working at whichever one is being built.
    let active = null;
    for (const st of stages) {
      if (st.t0 < 0) continue;
      const k = ramp(T, st.t0, st.t1);
      if (st.group) { st.group.visible = k > 0; st.group.scale.setScalar(Math.max(0.01, easeBack(k))); }
      else for (const o of st.objs) o.visible = k >= 1;
      if (st.at && T >= st.t0 - 1.2 && T < st.t1) active = st;
    }
    const target = active ? active.at : T < 1.5 ? V(0, 0, 4) : V(0, 0, 11);
    human.visible = true;
    const d = tmp.copy(target).sub(human.position).setY(0);
    const dist = d.length();
    const moving = dist > 0.15;
    if (moving) {
      human.position.addScaledVector(d, Math.min(1, (6 * dt) / dist));
      human.rotation.y = Math.atan2(d.x, d.z);
    } else if (active) {
      const c = active.group ? active.group.position : target;
      human.rotation.y = Math.atan2(c.x - human.position.x, c.z - human.position.z);
    }
    const working = !moving && (active || T < 5.5);
    arm.rotation.x = working ? -1.2 + Math.sin(t * 14) * 0.7 : Math.sin(t * 8) * 0.3;
    hb.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.1 : 0;
    // The crew fans out around the human, carrying planks and bobbing as they hammer.
    for (const a of crew) {
      a.visible = true;
      const goal = tmp.copy(human.position).add(a.userData.off);
      goal.x = Math.max(-11, Math.min(11, goal.x)); goal.z = Math.max(-11, Math.min(12.5, goal.z));
      const ad = goal.sub(a.position).setY(0);
      const al = ad.length();
      if (al > 0.2) { a.position.addScaledVector(ad, Math.min(1, (5 * dt) / al)); a.rotation.y = Math.atan2(ad.x, ad.z); }
      else a.rotation.y = Math.atan2(human.position.x - a.position.x, human.position.z - a.position.z);
      a.position.y = al > 0.2 ? Math.abs(Math.sin(t * 11 + a.userData.phase)) * 0.12 : Math.max(0, Math.sin(t * 9 + a.userData.phase)) * 0.15;
      a.userData.plank.visible = T > 4.5 && T < 22;
    }
  }

  return {
    get plants() { return gardenMode.structured ? plants : gardenMode.partial ? partial.plants : wildPlants; },
    get ripe() { return (gardenMode.structured ? plants : gardenMode.partial ? partial.plants : wildPlants).filter((p) => p.fruit.visible).length; },
    partial,
    update,
  };
}
