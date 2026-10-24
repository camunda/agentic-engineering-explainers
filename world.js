import * as THREE from 'three';
import { layers, mesh, toon, basic, sprite, textCanvas, rand, V, INK } from './core.js';
import { buildGarden } from './garden.js';

// '*' = work happens in the garden (code is tended), '?' = exclusive gateway, '~' = rework loop target.
const CODEBASES = [
  { name: 'nano-workforce', color: '#e8603c', proc: ['Triage issue', 'Plan fan-out', 'Implement*', '?Review converged?', 'Merge'], rework: 'Address review*' },
  { name: 'nanobpmn', color: '#3c7ee8', proc: ['Claim issue', 'Write failing test*', 'Make it green*', '?CI green?', 'Open PR'], rework: 'Root-cause*' },
  { name: 'nano-ide', color: '#8a4fd6', proc: ['Read spec', 'Implement*', '?Copilot review?', 'Readiness probe', 'Merge'], rework: 'Fix comments*' },
  { name: 'urban', color: '#2fa36b', proc: ['Decompose epic', 'Implement slice*', 'Layout BPMN*', '?Converged?', 'Merge'], rework: 'Rebase*' },
  { name: 'nano-sdk-js', color: '#e0a72a', proc: ['Regenerate facades', 'Implement*', '?Typecheck?', 'Review', 'Release'], rework: 'Fix types*' },
  { name: 'cubefarm', color: '#d6487f', proc: ['Pick card', 'Build scene*', 'Polish*', '?QA pass?', 'Ship'], rework: 'Address QA*' },
];

const RING = 110; // codebase distance from the hub
const PR = 19; // process ring radius around each garden

export const hub = { pos: V(0, 0, 0), pulse: 0 };
export const codebases = [];

export function buildWorld(scene) {
  for (const L of Object.values(layers)) scene.add(L.group);
  const A = layers.always.group;

  A.add(mesh(new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2), toon('always', '#9fcf8a'), 0, 0, 0, false));
  // Scattered tufts and pebbles so the colony floor has texture at every zoom.
  const tuft = toon('always', '#86bd72');
  const tg = new THREE.ConeGeometry(0.8, 1.6, 4);
  const tufts = new THREE.InstancedMesh(tg, tuft, 1400);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 1400; i++) {
    let r, a, p;
    do {
      r = Math.sqrt(Math.random()) * 420; a = Math.random() * 6.283;
      p = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    } while (r < 20 || [0, 1, 2, 3, 4, 5].some((k) => { const ca = (k / 6) * Math.PI * 2 - Math.PI / 2; return p.distanceTo(V(Math.cos(ca) * RING, 0, Math.sin(ca) * RING)) < 34; }));
    const s = rand(0.5, 2.2);
    m4.compose(V(Math.cos(a) * r, 0.6 * s, Math.sin(a) * r), new THREE.Quaternion(), V(s, s, s));
    tufts.setMatrixAt(i, m4);
  }
  A.add(tufts);

  // Hub: the Nano Workforce app, which orchestrates the agents and dispatches them to codebases.
  const stone = toon('always', '#c9c2b4');
  A.add(mesh(new THREE.CylinderGeometry(13, 14, 1.2, 32), stone, 0, 0.6, 0));
  A.add(mesh(new THREE.CylinderGeometry(3, 4, 14, 8), toon('always', '#efe7d6'), 0, 7, 0));
  hub.beaconMat = toon('always', '#ffd34d', { emissive: '#ffb800', emissiveIntensity: 0.4 });
  A.add(mesh(new THREE.IcosahedronGeometry(2.6, 1), hub.beaconMat, 0, 16, 0));
  const hl = sprite('label', 'Nano Workforce app', 6, { w: 900, h: 140, font: 'bold 70px system-ui', bg: 'rgba(31,29,43,.85)', fg: '#fff' });
  hl.position.set(0, 26, 0);
  layers.label.group.add(hl);

  CODEBASES.forEach((def, i) => {
    const a = (i / CODEBASES.length) * Math.PI * 2 - Math.PI / 2;
    const center = V(Math.cos(a) * RING, 0, Math.sin(a) * RING);
    const toHub = Math.atan2(-center.z, -center.x);
    const cb = { ...def, center, toHub, gardenYaw: -toHub - Math.PI / 2 };
    codebases.push(cb);

    A.add(mesh(new THREE.CircleGeometry(31, 48).rotateX(-Math.PI / 2), toon('always', '#d4bb8c'), center.x, 0.01, center.z, false));
    A.add(mesh(new THREE.RingGeometry(29.5, 31, 64).rotateX(-Math.PI / 2), toon('always', def.color), center.x, 0.015, center.z, false));

    // Far: the codebase is an anthill the colony streams in and out of.
    const mound = mesh(new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon('far', '#b98a55'), center.x, 0, center.z);
    mound.scale.y = 0.45;
    layers.far.group.add(mound);
    const cap = mesh(new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('far', def.color), center.x, 5.2, center.z);
    cap.scale.y = 0.5;
    layers.far.group.add(cap);
    for (let k = 0; k < 4; k++) {
      const ea = toHub + (k - 1.5) * 0.9;
      const hole = mesh(new THREE.CircleGeometry(1.6, 12), basic('far', { color: '#3a2716' }), center.x + Math.cos(ea) * 12.2, 1.8, center.z + Math.sin(ea) * 12.2, false);
      hole.lookAt(center.x + Math.cos(ea) * 30, 3, center.z + Math.sin(ea) * 30);
      layers.far.group.add(hole);
    }
    const lab = sprite('label', def.name, 11, { w: 720, h: 140, font: 'bold 76px system-ui', bg: 'rgba(255,255,255,.9)', fg: INK, stroke: def.color });
    lab.position.set(center.x, 30, center.z);
    layers.label.group.add(lab);

    buildProcess(cb);
    cb.garden = buildGarden(cb);

    // Trail from the hub to this codebase's gate.
    const dir = center.clone().normalize();
    const side = V(-dir.z, 0, dir.x);
    cb.gate = center.clone().addScaledVector(dir, -27);
    const mid = dir.clone().multiplyScalar(RING * 0.5).addScaledVector(side, rand(-18, 18));
    const curve = new THREE.CatmullRomCurve3([dir.clone().multiplyScalar(14), mid, cb.gate]);
    cb.trail = curve.getSpacedPoints(30); // hub → gate
    const tube = mesh(new THREE.TubeGeometry(curve, 60, 1.6, 6), toon('always', '#c4a272'), 0, 0, 0, false);
    tube.scale.y = 0.06;
    A.add(tube);
  });

  // Ring road linking neighbouring codebases (cross-repo work).
  for (let i = 0; i < codebases.length; i++) {
    const a = codebases[i], b = codebases[(i + 1) % codebases.length];
    const m = a.center.clone().add(b.center).multiplyScalar(0.5).multiplyScalar(1.08);
    const c = new THREE.CatmullRomCurve3([a.center.clone().lerp(m, 0.28), m, b.center.clone().lerp(m, 0.28)]);
    const tube = mesh(new THREE.TubeGeometry(c, 40, 1.1, 6), toon('always', '#c9ab7e'), 0, 0, 0, false);
    tube.scale.y = 0.05;
    A.add(tube);
  }
}

function ringPos(cb, ang, r = PR) {
  return V(cb.center.x + Math.cos(ang) * r, 0, cb.center.z + Math.sin(ang) * r);
}

function nodeLabel(text, w, h, px = 400, fontPx = Math.round(px / 8.2)) {
  const lines = text.length > 14 ? text.replace(/ (\S+)$/, '\n$1') : text;
  const tex = textCanvas(lines, { w: px, h: Math.round((px * h) / w), font: `bold ${fontPx}px system-ui` });
  const m = mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), basic('bpmn', { map: tex, transparent: true }), 0, 0.33, 0, false);
  return m;
}
const labelGroups = [];

function buildProcess(cb) {
  const B = layers.bpmn.group;
  const seq = [{ type: 'start', label: '' }];
  for (const p of cb.proc) {
    if (p.startsWith('?')) seq.push({ type: 'gw', label: p.slice(1) });
    else seq.push({ type: 'task', label: p.replace('*', ''), garden: p.endsWith('*') });
  }
  seq.push({ type: 'end', label: '' });

  const n = seq.length;
  const deg = Math.PI / 180;
  seq.forEach((node, k) => {
    node.ang = cb.toHub + (22 + (k * 316) / (n - 1)) * deg;
    node.pos = ringPos(cb, node.ang);
  });
  const gwIndex = seq.findIndex((s) => s.type === 'gw');
  const firstGarden = seq.findIndex((s) => s.garden);
  const gw = seq[gwIndex];
  const rework = { type: 'task', label: cb.rework.replace('*', ''), garden: true, ang: (gw.ang + seq[firstGarden].ang) / 2 };
  rework.pos = ringPos(cb, rework.ang, PR + 8);
  cb.procNodes = seq;
  cb.rework = rework;
  cb.gwIndex = gwIndex;
  cb.reworkTarget = firstGarden;

  for (const node of [...seq, rework]) {
    const g = new THREE.Group();
    g.position.copy(node.pos);
    g.rotation.y = -node.ang + Math.PI / 2;
    B.add(g);
    if (node.type !== 'start' && node.type !== 'end') labelGroups.push(g);
    node.mat = toon('bpmn', '#ffffff', { emissive: cb.color, emissiveIntensity: 0 });
    node.pulse = 0;
    if (node.type === 'task') {
      g.add(mesh(new THREE.BoxGeometry(6.4, 0.3, 3.4), toon('bpmn', INK), 0, 0.14, 0, false));
      g.add(mesh(new THREE.BoxGeometry(6, 0.32, 3), node.mat, 0, 0.15, 0, false));
      g.add(nodeLabel(node.label, 5.8, 2.8));
    } else if (node.type === 'gw') {
      const d = mesh(new THREE.BoxGeometry(2.6, 0.32, 2.6), node.mat, 0, 0.15, 0, false);
      d.rotation.y = Math.PI / 4;
      g.add(d);
      const o = mesh(new THREE.BoxGeometry(2.9, 0.3, 2.9), toon('bpmn', INK), 0, 0.14, 0, false);
      o.rotation.y = Math.PI / 4;
      g.add(o);
      g.add(nodeLabel('×', 2, 2, 200, 190));
      const l = nodeLabel(node.label, 6, 1.6, 600);
      l.position.z = 3.2;
      g.add(l);
    } else {
      const end = node.type === 'end';
      g.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 28), toon('bpmn', end ? '#c0392b' : '#2e9e57'), 0, 0.14, 0, false));
      g.add(mesh(new THREE.CylinderGeometry(end ? 1.1 : 1.3, end ? 1.1 : 1.3, 0.32, 28), node.mat, 0, 0.15, 0, false));
    }
  }

  const flows = [];
  for (let k = 0; k < n - 1; k++) flows.push([seq[k], seq[k + 1]]);
  flows.push([gw, rework], [rework, seq[firstGarden]]);
  for (const [a, b] of flows) arrow(B, a, b, cb);
}

const radiusOf = (n) => (n.type === 'task' ? 2.6 : n.type === 'gw' ? 1.9 : 1.6);
const arrowMat = () => toon('bpmn', '#33384a');
function arrow(B, a, b) {
  const dir = b.pos.clone().sub(a.pos);
  const len = dir.length();
  dir.normalize();
  const s = a.pos.clone().addScaledVector(dir, radiusOf(a));
  const e = b.pos.clone().addScaledVector(dir, -radiusOf(b));
  const L = s.distanceTo(e);
  if (L < 0.5) return;
  const m = arrowMat();
  const shaft = mesh(new THREE.BoxGeometry(0.22, 0.12, L - 0.8), m, 0, 0, 0, false);
  shaft.position.copy(s).lerp(e, 0.5).addScaledVector(dir, -0.4);
  shaft.position.y = 0.1;
  shaft.rotation.y = Math.atan2(dir.x, dir.z);
  B.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.55, 1.0, 3).rotateX(Math.PI / 2), m, 0, 0, 0, false);
  head.position.copy(e).addScaledVector(dir, -0.5);
  head.position.y = 0.12;
  head.rotation.y = Math.atan2(dir.x, dir.z);
  head.scale.y = 0.3;
  B.add(head);
  void len;
}

export function updateWorld(dt, t, camFwd) {
  // Keep ground labels readable: flip any whose text-up points back toward the viewer.
  const yaw = Math.atan2(-camFwd.x, -camFwd.z);
  for (const g of labelGroups) g.rotation.y = yaw;
  hub.pulse = Math.max(0, hub.pulse - dt * 0.8);
  hub.beaconMat.emissiveIntensity = 0.3 + hub.pulse * 1.5 + Math.sin(t * 2) * 0.1;
  for (const cb of codebases) {
    for (const node of [...cb.procNodes, cb.rework]) {
      node.pulse = Math.max(0, node.pulse - dt * 0.7);
      node.mat.emissiveIntensity = node.pulse * 0.8;
    }
    cb.garden.update(dt, t);
  }
}
