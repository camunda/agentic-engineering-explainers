import * as THREE from 'three';
import { mesh, rand, pick, V, ramp } from './core.js';
import { codebases, hub } from './world.js';

const ROLES = [
  { name: 'planner', color: '#3c7ee8' },
  { name: 'coder', color: '#e8603c' },
  { name: 'coder', color: '#e8603c' },
  { name: 'reviewer', color: '#8a4fd6' },
  { name: 'tester', color: '#2fa36b' },
];
const mat = (c, e = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp, ...e });
const antBody = mat('#2a1d17');
const antLeg = mat('#1a120e');
const skin = mat('#f2c9a0');
const straw = mat('#e8cf7a');
const canMat = mat('#7fa6b8');
const waterMat = mat('#6cc7ff', { emissive: '#2a8fd6', emissiveIntensity: 0.5 });
const sph = new THREE.SphereGeometry(1, 10, 8);
const legG = new THREE.BoxGeometry(0.06, 0.06, 0.9).translate(0, 0, 0.45);

export const stats = { tended: 0, merged: 0, reviews: 0 };

function makeAnt(role) {
  const g = new THREE.Group();
  const roleMat = mat(role.color);
  const parts = [[0, 0.35, -0.55, 0.42, 0.3, 0.55, roleMat], [0, 0.32, 0.05, 0.22, 0.2, 0.3, antBody], [0, 0.38, 0.45, 0.25, 0.22, 0.25, antBody]];
  for (const [x, y, z, sx, sy, sz, m] of parts) {
    const p = mesh(sph, m, x, y, z);
    p.scale.set(sx, sy, sz);
    g.add(p);
  }
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 1 : -1;
    const piv = new THREE.Group();
    piv.position.set(0.1 * side, 0.3, 0.2 - (i % 3) * 0.2);
    const l = mesh(legG, antLeg);
    l.rotation.set(0.5, side * Math.PI / 2, 0);
    piv.add(l);
    piv.userData.base = side * ((i % 3) - 1) * 0.5;
    piv.userData.phase = (i % 2) * Math.PI + (side > 0 ? 0 : Math.PI);
    g.add(piv);
    legs.push(piv);
  }
  for (const s of [1, -1]) {
    const a = mesh(legG, antLeg, 0.08 * s, 0.45, 0.6);
    a.rotation.set(-0.6, s * 0.4, 0);
    a.scale.z = 0.7;
    g.add(a);
  }
  return { g, legs };
}

function makeGardener(role) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 10), mat(role.color), 0, 0.6, 0);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.24, 12, 10), skin, 0, 1.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), straw, 0, 1.36, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 12), straw, 0, 1.46, 0));
  const eyeM = mat('#1f1d2b');
  for (const s of [1, -1]) g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeM, 0.09 * s, 1.24, 0.21));
  const can = new THREE.Group();
  can.position.set(0.38, 0.55, 0.15);
  can.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.28, 10), canMat));
  const spout = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 6), canMat, 0, 0.05, 0.22);
  spout.rotation.x = 1.0;
  can.add(spout);
  g.add(can);
  const drops = [];
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.SphereGeometry(0.05, 6, 4), waterMat, 0, 0, 0, false);
    g.add(d);
    drops.push(d);
  }
  return { g, can, drops };
}

class Agent {
  constructor(i) {
    this.role = pick(ROLES);
    this.obj = new THREE.Group();
    this.ant = makeAnt(this.role);
    this.person = makeGardener(this.role);
    this.obj.add(this.ant.g, this.person.g);
    this.pos = V(0, 0, 0);
    this.queue = [];
    this.wait = 0;
    this.tending = null;
    this.phase = Math.random() * 10;
    this.lane = V(rand(-0.9, 0.9), 0, rand(-0.9, 0.9));
    this.cb = codebases[i % codebases.length];
    this.speed = rand(3.2, 4.4);
    this.heading = 0;
  }

  push(p, opts = {}) {
    this.queue.push({ p: p.clone().add(opts.exact ? V(0, 0, 0) : this.lane), ...opts });
  }

  planProcess() {
    const cb = this.cb;
    const nodes = cb.procNodes;
    let loops = 0;
    for (let i = 0; i < nodes.length; ) {
      const n = nodes[i];
      this.push(n.pos, { node: n, wait: n.type === 'task' ? rand(0.8, 2) : 0.3, fast: true });
      if (n.garden) this.visitGarden(cb, n);
      if (n.type === 'gw' && loops < 2 && Math.random() < 0.35) {
        loops++;
        this.push(cb.rework.pos, { node: cb.rework, wait: 0.8 });
        this.visitGarden(cb, cb.rework);
        i = cb.reworkTarget;
        continue;
      }
      i++;
    }
    this.queue[this.queue.length - 1].onArrive = () => { stats.merged++; hub.pulse = 1; };
  }

  visitGarden(cb, node) {
    const plants = cb.garden.plants;
    const n = Math.floor(rand(1, 3));
    for (let k = 0; k < n; k++) {
      const p = pick(plants);
      this.push(p.approach, { exact: true, wait: rand(2.5, 4.5), tend: p });
    }
    this.push(node.pos, { wait: 0.2 });
  }

  planCommute() {
    const from = this.cb;
    const to = Math.random() < 0.5 ? from : pick(codebases);
    this.push(from.gate);
    for (let i = from.trail.length - 1; i >= 0; i--) this.push(from.trail[i], { fast: true });
    this.push(V(rand(-8, 8), 0, rand(-8, 8)), { wait: rand(0, 1.5), fast: true });
    for (const p of to.trail) this.push(p, { fast: true });
    this.push(to.gate);
    this.cb = to;
    this.commuting = true;
  }

  plan() {
    if (this.commuting) { this.commuting = false; this.planProcess(); }
    else this.planCommute();
  }

  update(dt, t, antMode) {
    this.ant.g.visible = antMode;
    this.person.g.visible = !antMode;
    let moving = false;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.tending) {
        this.tending.growth = Math.min(1, this.tending.growth + dt * 0.18);
        if (this.wait <= 0) { this.tending.pulse = 1; this.tending = null; stats.tended++; }
      }
    } else {
      if (!this.queue.length) this.plan();
      const q = this.queue[0];
      const d = q.p.clone().sub(this.pos);
      d.y = 0;
      const dist = d.length();
      const step = this.speed * (q.fast ? 2.2 : 1) * dt;
      if (dist <= step) {
        this.pos.copy(q.p);
        this.queue.shift();
        if (q.wait) this.wait = q.wait;
        if (q.node) q.node.pulse = 1;
        if (q.tend) { this.tending = q.tend; this.face = q.tend.world; }
        q.onArrive?.();
      } else {
        this.pos.addScaledVector(d, step / dist);
        moving = true;
        const h = Math.atan2(d.x, d.z);
        let dh = h - this.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        this.heading += dh * Math.min(1, dt * 10);
      }
    }
    if (this.tending && this.face) {
      const h = Math.atan2(this.face.x - this.pos.x, this.face.z - this.pos.z);
      let dh = Math.atan2(Math.sin(h - this.heading), Math.cos(h - this.heading));
      this.heading += dh * Math.min(1, dt * 6);
    }
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.heading;

    const tt = t * 12 + this.phase;
    if (antMode) {
      for (const l of this.ant.legs) l.rotation.y = l.userData.base + (moving ? Math.sin(tt * 1.6 + l.userData.phase) * 0.35 : 0);
    } else {
      const P = this.person;
      P.g.position.y = moving ? Math.abs(Math.sin(tt)) * 0.12 : 0;
      P.g.rotation.x = this.tending ? 0.35 : 0;
      P.g.rotation.z = moving ? Math.sin(tt) * 0.06 : 0;
      P.can.rotation.x = this.tending ? 0.9 : 0;
      P.drops.forEach((d, i) => {
        d.visible = !!this.tending;
        const k = (t * 2 + i / 4) % 1;
        d.position.set(0.38, 0.6 - k * 0.7, 0.55 + k * 0.25);
      });
    }
  }
}

export function buildAgents(scene, count) {
  const agents = [];
  for (let i = 0; i < count; i++) {
    const a = new Agent(i);
    // Seed mid-flight so the organisation is already busy when the page opens.
    if (Math.random() < 0.6) a.planProcess(); else a.planCommute();
    const skip = Math.floor(Math.random() * a.queue.length);
    a.queue.splice(0, skip);
    if (a.queue.length) a.pos.copy(a.queue[0].p);
    else a.pos.copy(a.cb.gate);
    scene.add(a.obj);
    agents.push(a);
  }
  return agents;
}
