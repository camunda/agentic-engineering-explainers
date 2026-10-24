import * as THREE from 'three';
import { mesh, toon, rand, pick, V, sprite } from './core.js';

// A partially structured garden: a couple of proper planters, some dirt-mound beds that have to be
// watered by hand, a stick trellis, leaky irrigation. Changes arrive at "human" or "agentic" speed;
// most of them need a human, who can only do one thing at a time. With policy 'wait' agents queue
// for the human (bottleneck); with 'carry' they don't, and unhandled changes escape into overgrowth.

const G = 'garden';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);
const ball = (r) => new THREE.IcosahedronGeometry(r, 1);

const wood = toon(G, '#a0673a');
const woodDark = toon(G, '#7a4a28');
const soil = toon(G, '#5a3d26');
const mound = toon(G, '#6b4a2e');
const ground = toon(G, '#c9ad7f');
const crack = toon(G, '#8a6a40');
const stick = toon(G, '#8b6b45');
const string = toon(G, '#efe6cf');
const pipeMat = toon(G, '#3f86c4');
const steel = toon(G, '#9aa7b4');
const water = toon(G, '#6cc7ff', { emissive: '#2a8fd6', emissiveIntensity: 0.4 });
const puddleMat = toon(G, '#6cc7ff', { opacity: 0.75 });
const tangleMat = toon(G, '#2f6b2a');
const weedMat = toon(G, '#5e8f2e');
const LEAF_DRY = new THREE.Color('#c9b55a');
const LEAF_WET = new THREE.Color('#3fa34d');

export const SIM = {
  humanInterval: 3.2, // seconds between changes at human speed
  agenticFactor: 8, // agentic speed = this many times faster
  needsHuman: 0.7, // share of changes this structure can't absorb on its own
  workTime: 2.2, // seconds a human spends on one fix
  walkSpeed: 5,
  waitCap: 8, // with 'wait', agents stop producing changes once this many are queued
  escapeAfter: 6, // with 'carry', a change nobody handled within this long escapes containment
};

export function makeHuman() {
  const human = new THREE.Group();
  const hb = new THREE.Group();
  hb.scale.setScalar(1.45);
  human.add(hb);
  hb.add(mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10), toon(G, '#2d5fa8'), 0, 0.65, 0));
  hb.add(mesh(new THREE.SphereGeometry(0.25, 12, 10), toon(G, '#f1c7a1'), 0, 1.3, 0));
  hb.add(mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(G, '#ff8a1f'), 0, 1.38, 0));
  hb.add(mesh(cyl(0.36, 0.36, 0.03, 16), toon(G, '#ff8a1f'), 0, 1.38, 0.04));
  for (const sx of [1, -1]) hb.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), toon(G, '#1f1d2b'), 0.09 * sx, 1.33, 0.22));
  const arm = new THREE.Group();
  arm.position.set(0.38, 0.95, 0);
  arm.add(mesh(cyl(0.07, 0.07, 0.55, 6), toon(G, '#2d5fa8'), 0, -0.25, 0));
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.5, 0.1);
  hammer.add(mesh(cyl(0.03, 0.03, 0.5, 6), woodDark, 0, 0, 0.2).rotateX(Math.PI / 2));
  hammer.add(mesh(box(0.12, 0.12, 0.25), steel, 0, 0, 0.45).rotateY(Math.PI / 2));
  arm.add(hammer);
  const can = new THREE.Group();
  can.position.set(0, -0.55, 0.15);
  can.add(mesh(cyl(0.13, 0.15, 0.28, 10), toon(G, '#3f86c4')));
  const spout = mesh(cyl(0.025, 0.03, 0.4, 6), toon(G, '#3f86c4'), 0, 0.05, 0.22);
  spout.rotation.x = 1.0;
  can.add(spout);
  arm.add(can);
  hb.add(arm);
  hb.add(mesh(box(0.5, 0.3, 0.25), toon(G, '#d23c3c'), -0.45, 0.35, 0));
  const tag = sprite(G, 'HUMAN', 0.45, { w: 320, h: 110, font: 'bold 64px system-ui', bg: '#ff8a1f', fg: '#fff' });
  tag.position.y = 2.9;
  human.add(tag);
  return { human, hb, arm, hammer, can };
}

export function makeCrewAgent(col) {
  const a = new THREE.Group();
  a.add(mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 10), toon(G, col), 0, 0.6, 0));
  a.add(mesh(new THREE.SphereGeometry(0.24, 12, 10), toon(G, '#f1c7a1'), 0, 1.2, 0));
  a.add(mesh(cyl(0.42, 0.42, 0.04, 16), toon(G, '#e9cf7a'), 0, 1.36, 0));
  a.add(mesh(cyl(0.18, 0.22, 0.2, 12), toon(G, '#e9cf7a'), 0, 1.46, 0));
  return a;
}

// Tangled vines + weeds, grown in by a 0..1 level.
export function makeOvergrowth(parent, { tubes = 22, leaves = 420, weeds = 260, radius = 11 } = {}) {
  const tangle = new THREE.Group();
  parent.add(tangle);
  for (let i = 0; i < tubes; i++) {
    const pts = [];
    let x = rand(-radius + 1, radius - 1), z = rand(-radius + 1, radius - 1);
    for (let k = 0; k < 6; k++) {
      pts.push(V(x, rand(0.1, 2.2), z));
      x = Math.max(-radius + 1, Math.min(radius - 1, x + rand(-3, 3)));
      z = Math.max(-radius + 1, Math.min(radius - 1, z + rand(-3, 3)));
    }
    tangle.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, rand(0.05, 0.12), 5), tangleMat, 0, 0, 0, false));
  }
  const leafGeo = new THREE.SphereGeometry(0.22, 5, 3);
  leafGeo.scale(1, 0.4, 1.6);
  const lv = new THREE.InstancedMesh(leafGeo, tangleMat, leaves);
  const wd = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.7, 4), weedMat, weeds);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < leaves; i++) {
    const r = Math.sqrt(Math.random()) * radius, a = rand(0, 6.28);
    m4.compose(V(Math.cos(a) * r, rand(0.1, 2.4), Math.sin(a) * r), q.setFromEuler(e.set(rand(0, 6), rand(0, 6), rand(0, 6))), V(1, 1, 1));
    lv.setMatrixAt(i, m4);
  }
  for (let i = 0; i < weeds; i++) {
    const r = Math.sqrt(Math.random()) * (radius + 1), a = rand(0, 6.28), s = rand(0.6, 1.6);
    m4.compose(V(Math.cos(a) * r, 0.35 * s, Math.sin(a) * r), q.setFromEuler(e.set(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), V(s, s, s));
    wd.setMatrixAt(i, m4);
  }
  tangle.add(lv);
  parent.add(wd);
  return {
    tangle, weeds: wd,
    set(k, sy = 1) {
      tangle.visible = wd.visible = k > 0.01;
      tangle.scale.set(Math.max(0.01, k), Math.max(0.01, k * sy), Math.max(0.01, k));
      wd.scale.set(1, Math.max(0.01, k * sy), 1);
    },
  };
}

export function buildPartial(root, { makePlant, mode }) {
  const pg = new THREE.Group();
  root.add(pg);
  const plants = [];
  const local = [];
  // Named pieces, so the refactor into a structured garden can keep, move or take out each one.
  const parts = { cracks: [], keep: [], tank: [], pipes: [], frame: [], vines: [] };
  const addPlant = (kind, parent, x, y, z, ax, az) => {
    const p = makePlant(kind);
    p.obj.position.set(x, y, z);
    parent.add(p.obj);
    plants.push(p);
    local.push({ p, at: V(x, 0, z), approach: V(ax, 0, az) });
    return p;
  };

  parts.ground = mesh(new THREE.CircleGeometry(12.5, 48).rotateX(-Math.PI / 2), ground, 0, 0.02, 0, false);
  pg.add(parts.ground);
  for (let i = 0; i < 18; i++) {
    const a = rand(0, 6.28), r = rand(4, 11);
    const c = mesh(box(rand(1, 2.5), 0.02, 0.07), crack, Math.cos(a) * r, 0.035, Math.sin(a) * r, false);
    c.rotation.y = rand(0, 3.14);
    pg.add(c);
    parts.cracks.push(c);
  }

  // Two proper planter boxes, fed by irrigation.
  for (const [i, z] of [-7, -3.5].entries()) {
    const bx = mesh(box(6.4, 0.8, 1.6), wood, -2.5, 0.4, z);
    const sl = mesh(box(6.0, 0.1, 1.2), soil, -2.5, 0.81, z, false);
    pg.add(bx, sl);
    parts.keep.push(bx, sl);
    for (let k = 0; k < 5; k++) parts.keep.push(addPlant(['leafy', 'tomato'][i], pg, -5 + k * 1.25, 0.85, z, -5 + k * 1.25, z + 1.25).obj);
  }
  // Dirt-mound beds with no irrigation: someone has to water them by hand.
  const beds = [];
  for (const [x, z, kind] of [[-2.5, 0.5, 'corn'], [-2.5, 4.2, 'flower'], [6, -3, 'tomato']]) {
    const m = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mound, x, 0, z);
    m.scale.set(3.2, 0.35, 0.9);
    pg.add(m);
    const bed = { at: V(x, 0, z + 1.4), plants: [], dry: 0, pending: false, mound: m };
    for (let k = 0; k < 4; k++) bed.plants.push(addPlant(kind, pg, x - 2.1 + k * 1.4, 0.25, z, x - 2.1 + k * 1.4, z + 1.3));
    beds.push(bed);
  }
  const handSign = sprite(G, 'HAND WATERED', 0.55, { w: 640, h: 128, font: 'bold 60px system-ui', bg: '#fff3a8', fg: '#1f1d2b', stroke: '#1f1d2b' });
  handSign.position.set(-2.5, 2.2, 2.4);
  pg.add(handSign);
  // A half-built greenhouse frame nobody finished.
  for (const [x, z] of [[3.5, -6.5], [8.5, -6.5], [3.5, 0.5]]) parts.frame.push(mesh(box(0.12, 2.6, 0.12), toon(G, '#f4f1e8'), x, 1.3, z));
  parts.frame.push(mesh(box(5, 0.08, 0.08), toon(G, '#f4f1e8'), 6, 2.6, -6.5));
  pg.add(...parts.frame);

  // Stick-and-string trellis that sags whenever re-tying is overdue.
  const tz = 6;
  const trellis = new THREE.Group();
  trellis.position.set(6, 0, tz);
  pg.add(trellis);
  for (const x of [-3, -1, 1.2, 3]) {
    const s = mesh(box(0.08, 2.6, 0.08), stick, x, 1.3, 0);
    s.rotation.z = rand(-0.12, 0.12);
    trellis.add(s);
  }
  for (const y of [0.9, 1.7, 2.4]) {
    const s = mesh(box(6.1, 0.025, 0.025), string, 0, y, 0, false);
    s.rotation.z = rand(-0.05, 0.05);
    trellis.add(s);
  }
  for (let k = 0; k < 4; k++) {
    const x = 3.8 + k * 1.5;
    const p = addPlant('vine', trellis, x - 6, 0, 0.25, x, tz + 1.3);
    p.obj.scale.setScalar(0.8);
    parts.vines.push(p);
  }

  // Irrigation that only reaches the two planters, and springs leaks.
  parts.tank.push(mesh(cyl(1.2, 1.2, 2.6, 16), steel, -9.3, 1.3, 7), mesh(cyl(1.25, 1.25, 0.2, 16), pipeMat, -9.3, 2.65, 7));
  pg.add(...parts.tank);
  const pts = [V(-8, 0.25, 7), V(-7, 0.25, 7), V(-7, 0.25, -7), V(-5.5, 0.25, -7)];
  const pipeCurve = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    pipeCurve.add(new THREE.LineCurve3(a, b));
    const p = mesh(cyl(0.12, 0.12, a.distanceTo(b), 8), pipeMat, (a.x + b.x) / 2, 0.25, (a.z + b.z) / 2);
    p.rotation.order = 'YXZ';
    p.rotation.set(Math.PI / 2, Math.atan2(b.x - a.x, b.z - a.z), 0);
    pg.add(p);
    parts.pipes.push(p);
  }
  const branch = mesh(cyl(0.08, 0.08, 1.5, 6), pipeMat, -6.2, 0.25, -3.5);
  branch.rotation.z = Math.PI / 2;
  pg.add(branch);
  parts.pipes.push(branch);
  const drops = [];
  for (let i = 0; i < 16; i++) {
    const d = mesh(ball(0.1), water, 0, 0.42, 0, false);
    d.userData.u = i / 16;
    pg.add(d);
    drops.push(d);
  }
  const leaks = [];
  for (const z of [5, 1.5, -2, -5.5]) {
    const puddle = mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), puddleMat, -6.4, 0.04, z, false);
    const spurt = mesh(ball(0.12), water, -7, 0.5, z, false);
    pg.add(puddle, spurt);
    leaks.push({ at: V(-6.2, 0, z), puddle, spurt, size: 0, pending: false });
  }

  // Overgrowth + stray plants for when changes escape containment.
  const over = makeOvergrowth(pg, { tubes: 18, leaves: 360, weeds: 220 });
  const strays = [];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, 6.28), r = rand(2, 11);
    const p = makePlant(pick(['leafy', 'tomato', 'corn', 'flower', 'vine']));
    p.obj.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    p.obj.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3));
    pg.add(p.obj);
    strays.push(p);
  }

  // Agents waiting for the human, lined up along the path.
  const waitSign = sprite(G, 'WAITING FOR HUMAN', 0.7, { w: 760, h: 128, font: 'bold 60px system-ui', bg: '#ff5a4f', fg: '#fff', stroke: '#fff' });
  waitSign.position.set(0, 3.2, 12.4);
  pg.add(waitSign);
  const waiters = [];
  const COLS = ['#e8603c', '#3c7ee8', '#2fa36b', '#8a4fd6', '#e0a72a', '#d6487f'];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI / 2 + (i - 6.5) * 0.11;
    const w = makeCrewAgent(COLS[i % COLS.length]);
    w.position.set(Math.cos(a) * 12.1, 0, Math.sin(a) * 12.1);
    w.rotation.y = Math.PI;
    const bang = sprite(G, '!', 0.4, { w: 128, h: 128, font: 'bold 96px system-ui', bg: '#ffd34d', fg: '#1f1d2b', radius: 64 });
    bang.position.y = 2.1;
    w.add(bang);
    pg.add(w);
    waiters.push(w);
  }
  const H = makeHuman();
  pg.add(H.human);
  const HOME = V(0, 0, 10.5);

  // ---- Simulation ------------------------------------------------------------------------------
  const sim = { queue: [], job: null, nextIn: 1, mess: 0, busy: 0, shipped: 0, rate: 0, blocked: false, t: 0 };
  function reset() {
    sim.queue.length = 0; sim.job = null; sim.nextIn = 1; sim.mess = 0; sim.busy = 0; sim.shipped = 0; sim.rate = 0; sim.t = 0;
    for (const b of beds) { b.dry = 0; b.pending = false; }
    for (const l of leaks) { l.size = 0; l.pending = false; }
    sim.trellis = 0;
    H.human.position.copy(HOME);
  }
  reset();

  function newJob() {
    const opts = [];
    for (const b of beds) if (!b.pending) opts.push(() => { b.pending = true; return { kind: 'water', bed: b, at: b.at }; });
    for (const l of leaks) if (!l.pending) opts.push(() => { l.pending = true; return { kind: 'leak', leak: l, at: l.at }; });
    if (sim.trellis < 3) opts.push(() => { sim.trellis++; return { kind: 'trellis', at: V(6, 0, tz + 1.6) }; });
    return opts.length ? pick(opts)() : { kind: 'overflow', at: HOME };
  }
  function resolve(job) {
    if (job.kind === 'water') { job.bed.pending = false; job.bed.dry = 0; for (const p of job.bed.plants) p.pulse = 1; }
    if (job.kind === 'leak') { job.leak.pending = false; }
    if (job.kind === 'trellis') sim.trellis = Math.max(0, sim.trellis - 1);
  }
  function escape(job) {
    resolve(job); // nobody fixed it; it's no longer tracked, it just turned into mess
    if (job.kind === 'water') job.bed.dry = 1;
    sim.mess = Math.min(1, sim.mess + 0.03);
  }

  function step(dt) {
    const agentic = mode.speed === 'agentic';
    const carry = mode.policy === 'carry';
    sim.t += dt;
    // Changes arrive.
    sim.blocked = !carry && sim.queue.length >= SIM.waitCap;
    if (!sim.blocked) sim.nextIn -= dt;
    let shippedNow = 0;
    while (sim.nextIn <= 0) {
      sim.nextIn += (agentic ? SIM.humanInterval / SIM.agenticFactor : SIM.humanInterval) * rand(0.5, 1.5);
      sim.shipped++;
      shippedNow++;
      if (Math.random() < SIM.needsHuman) {
        const job = newJob();
        job.age = 0;
        if (job.kind === 'overflow') { if (carry) escape(job); else sim.queue.push(job); }
        else sim.queue.push(job);
      }
      if (!carry && sim.queue.length >= SIM.waitCap) break;
    }
    for (const j of sim.queue) j.age += dt;
    if (carry) {
      for (let i = sim.queue.length - 1; i >= 0; i--) if (sim.queue[i].age > SIM.escapeAfter) escape(sim.queue.splice(i, 1)[0]);
    }
    // The human works the queue, one job at a time.
    if (!sim.job && sim.queue.length) { sim.job = sim.queue.shift(); sim.job.work = SIM.workTime; }
    const job = sim.job;
    const target = job ? job.at : HOME;
    const d = target.clone().sub(H.human.position).setY(0);
    const dist = d.length();
    const moving = dist > 0.1;
    if (moving) {
      H.human.position.addScaledVector(d, Math.min(1, (SIM.walkSpeed * dt) / dist));
      H.human.rotation.y = Math.atan2(d.x, d.z);
    } else if (job) {
      job.work -= dt;
      if (job.kind === 'water' || job.kind === 'trellis') H.human.rotation.y = Math.PI;
      if (job.kind === 'leak') H.human.rotation.y = -Math.PI / 2;
      if (job.work <= 0) { resolve(job); sim.job = null; }
    }
    sim.working = !moving && !!job;
    sim.moving = moving;
    sim.busy += ((job ? 1 : 0) - sim.busy) * Math.min(1, dt / 8);
    // Without changes piling up, the human gets time to weed.
    if (!job && !sim.queue.length) sim.mess = Math.max(0, sim.mess - dt * 0.02);
    // Changes per minute over a rolling ~20s window.
    sim.rate += (shippedNow * 60) / 20 - sim.rate * Math.min(1, dt / 20);
  }

  root.updateMatrixWorld(true);
  for (const l of local) {
    l.p.world = root.localToWorld(l.at.clone());
    l.p.approach = root.localToWorld(l.approach.clone());
  }

  function update(dt, t) {
    step(dt);
    const m = sim.mess;
    for (const b of beds) {
      if (b.pending) b.dry = Math.min(1, b.dry + dt * 0.12);
      b.dry = Math.max(b.dry, m * 0.9);
    }
    for (const p of plants) {
      p.growth = Math.max(0.2, p.growth - dt * 0.006);
      p.pulse = Math.max(0, p.pulse - dt);
    }
    for (const b of beds) for (const p of b.plants) p.growth = Math.min(p.growth, 1 - b.dry * 0.8);
    for (const p of plants) {
      p.obj.scale.setScalar((0.45 + 0.65 * p.growth + Math.sin(p.pulse * 12) * 0.08 * p.pulse) * (p.kind === 'vine' ? 0.85 : 1));
      p.leaf.color.copy(LEAF_DRY).lerp(LEAF_WET, Math.min(1, p.growth * 1.3));
      p.fruit.visible = p.growth > 0.75;
    }
    for (const l of leaks) {
      l.size = l.pending ? Math.min(1, l.size + dt * 0.25) : Math.max(0, l.size - dt * 0.8);
      l.puddle.visible = l.size > 0.02;
      l.puddle.scale.setScalar(Math.max(0.01, l.size * 1.3));
      l.spurt.visible = l.pending;
      l.spurt.position.y = 0.4 + Math.abs(Math.sin(t * 9 + l.at.z)) * 0.5;
    }
    trellis.rotation.x = Math.min(1, sim.trellis / 3 + m * 0.6) * 0.38;
    trellis.rotation.z = Math.sin(t * 2.5) * 0.01 * sim.trellis;
    for (const d of drops) {
      d.userData.u = (d.userData.u + dt * 0.06) % 1;
      d.position.copy(pipeCurve.getPointAt(d.userData.u));
      d.position.y = 0.42;
    }
    over.set(Math.min(1, m * 1.3), 1);
    strays.forEach((p, i) => {
      const on = i < Math.round(m * strays.length);
      p.obj.visible = on;
      if (on) p.obj.scale.setScalar(0.6 + m * 0.5);
    });
    const nWait = mode.policy === 'carry' ? 0 : Math.min(waiters.length, sim.queue.length + (sim.blocked ? 6 : 0));
    waiters.forEach((w, i) => {
      w.visible = i < nWait;
      w.position.y = Math.max(0, Math.sin(t * 6 + i)) * 0.06;
    });
    waitSign.visible = nWait >= 4;
    const kind = sim.job?.kind;
    H.can.visible = kind === 'water';
    H.hammer.visible = kind !== 'water';
    H.arm.rotation.x = sim.working ? -1.2 + Math.sin(t * (kind === 'water' ? 4 : 14)) * (kind === 'water' ? 0.2 : 0.7) : Math.sin(t * 8) * (sim.moving ? 0.3 : 0.05);
    H.hb.position.y = sim.moving ? Math.abs(Math.sin(t * 10)) * 0.1 : 0;
  }

  return {
    group: pg, plants, sim, update, reset, beds,
    parts: Object.assign(parts, { trellis, drops, leaks, over, strays, waiters, waitSign, handSign, human: H.human }),
    get ripe() { return plants.filter((p) => p.fruit.visible).length; },
  };
}
