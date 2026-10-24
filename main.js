import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { layers, applyLayers, smooth } from './core.js';
import { buildWorld, updateWorld, codebases } from './world.js';
import { buildAgents, stats } from './agents.js';
import { gardenMode, gardenKind, setGardenMode, setGardenKind, setSim, setMutating, tickSeason, seasonPhase, buildPhase, finishBuild } from './garden.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#bfe3d0');
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 500, 1100);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.2, 3000);
const HOME = { pos: new THREE.Vector3(0, 330, 240), target: new THREE.Vector3(0, 0, 0) };
camera.position.copy(HOME.pos);

const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.minDistance = 5;
controls.maxDistance = 650;
controls.maxPolarAngle = Math.PI * 0.46;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.copy(HOME.target);

scene.add(new THREE.HemisphereLight('#ffffff', '#7da36b', 1.6));
const sun = new THREE.DirectionalLight('#fff4dd', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

buildWorld(scene);
const agents = buildAgents(scene, 180);

// --- Semantic zoom -----------------------------------------------------------------------------
const levelEls = [...document.querySelectorAll('#level span')];
const caption = document.getElementById('caption');
const CAPTIONS = [
  'A software organisation of agents — dispatched by the Nano Workforce app to codebases, streaming back and forth like a colony.',
  'Up close, every agent is a token following a BPMN process: plan, implement, review, merge.',
  'Inside a codebase: a garden. Agents tend the plants; the structures keep it growing.',
];
const GARDEN_CAPTIONS = {
  true: 'Tend the soil, build the structure it grows into. I don\u2019t force the plants — I shape the garden.',
  false: 'Just throw seeds and hope: overgrowth, all effort goes into weeding — and a tiny harvest.',
};
const PARTIAL_CAPTIONS = {
  human: 'Partial structure at human speed: manageable \u2014 but someone is always watering, re-tying, patching.',
  wait: 'Agentic speed, agents wait for the human: the human is the bottleneck.',
  carry: 'Agentic speed, agents carry on: unhandled changes escape containment.',
};
const partialCaption = () => PARTIAL_CAPTIONS[gardenMode.speed === 'human' ? 'human' : gardenMode.policy];
const captionFor = (level) => (level !== 2 ? CAPTIONS[level] : gardenMode.build ? buildPhase() : gardenMode.partial ? partialCaption() : gardenMode.structured && gardenMode.mutating ? seasonPhase() : GARDEN_CAPTIONS[gardenMode.structured]);
const modeEl = document.getElementById('mode');
const SKY_WILD = new THREE.Color('#e3d3b0');
function toggleGarden(structured = !gardenMode.structured) {
  setGardenMode(structured);
  syncModeButtons();
  if (shownLevel === 2) { caption.textContent = captionFor(2); }
}
function syncModeButtons() {
  const kind = gardenKind();
  modeEl.querySelectorAll('button[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === kind));
  modeEl.querySelectorAll('button[data-x]').forEach((b) => b.classList.toggle('on', (b.dataset.x === 'm') === gardenMode.mutating));
  modeEl.querySelectorAll('button[data-sp]').forEach((b) => b.classList.toggle('on', b.dataset.sp === gardenMode.speed));
  modeEl.querySelectorAll('button[data-po]').forEach((b) => b.classList.toggle('on', b.dataset.po === gardenMode.policy));
  modeEl.className = modeEl.className.replace(/\bkind-\w+/g, '').trim() + ` kind-${kind}`;
}
function setKind(kind) {
  setGardenKind(kind);
  syncModeButtons();
  if (shownLevel === 2) caption.textContent = captionFor(2);
}
function setPartialSim(opts) {
  setSim(opts);
  syncModeButtons();
  if (shownLevel === 2) caption.textContent = captionFor(2);
}
function toggleMutating(on = !gardenMode.mutating) {
  if (!gardenMode.structured) setGardenMode(true);
  setMutating(on);
  syncModeButtons();
  if (shownLevel === 2) caption.textContent = captionFor(2);
}
modeEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b?.dataset.m) setKind(b.dataset.m);
  if (b?.dataset.sp) setPartialSim({ speed: b.dataset.sp });
  if (b?.dataset.po) setPartialSim({ policy: b.dataset.po });
  if (b?.dataset.adv !== undefined) modeEl.classList.toggle('advanced');
  if (b?.dataset.x) toggleMutating(b.dataset.x === 'm');
});
let shownLevel = -1;

function updateZoom() {
  const d = camera.position.distanceTo(controls.target);
  layers.far.o = smooth(115, 175, d);
  layers.label.o = smooth(45, 90, d);
  layers.bpmn.o = smooth(330, 200, d);
  layers.garden.o = smooth(150, 75, d);
  applyLayers();
  const level = d > 210 ? 0 : d > 90 ? 1 : 2;
  if (level !== shownLevel) {
    shownLevel = level;
    levelEls.forEach((e, i) => e.classList.toggle('on', i === level));
    modeEl.classList.toggle('show', level === 2);
    caption.style.opacity = 0;
    setTimeout(() => { caption.textContent = captionFor(shownLevel); caption.style.opacity = 1; }, 250);
  }
  // Ants are drawn bigger when far away so the colony still reads; gardeners appear when close.
  return { d, antMode: d > 150, antScale: Math.max(1, d / 110) };
}

// --- Fly-to --------------------------------------------------------------------------------------
let fly = null;
function flyTo(target, dist, polar = 0.85) {
  const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  const pos = new THREE.Vector3(Math.sin(az) * Math.sin(polar), Math.cos(polar), Math.cos(az) * Math.sin(polar)).multiplyScalar(dist).add(target);
  fly = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos, toT: target.clone() };
}
const stopAuto = () => { controls.autoRotate = false; };
renderer.domElement.addEventListener('pointerdown', () => { stopAuto(); fly = null; });
renderer.domElement.addEventListener('wheel', () => { stopAuto(); fly = null; }, { passive: true });

const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
renderer.domElement.addEventListener('dblclick', (e) => {
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(ground, p)) return;
  const d = camera.position.distanceTo(controls.target);
  const near = codebases.find((c) => c.center.distanceTo(p) < 32);
  if (d > 150 && near) flyTo(near.center, 120, 0.7);
  else if (near) flyTo(near.center.distanceTo(p) < 14 ? near.center : p, 38, 0.95);
  else flyTo(p, Math.max(40, d * 0.45), 0.8);
});
addEventListener('keydown', (e) => {
  if (e.key === ' ') { controls.autoRotate = !controls.autoRotate; e.preventDefault(); }
  if (e.key === 'g' || e.key === 'G') toggleGarden();
  if (e.key === 'p' || e.key === 'P') setKind('partial');
  if (e.key === 'm' || e.key === 'M') toggleMutating();
  if (e.key === '0') flyTo(HOME.target, HOME.pos.length(), Math.acos(HOME.pos.y / HOME.pos.length()));
  const n = Number(e.key);
  if (n >= 1 && n <= codebases.length) {
    const c = codebases[n - 1];
    const d = camera.position.distanceTo(controls.target);
    flyTo(c.center, controls.target.distanceTo(c.center) < 5 && d < 130 ? 34 : 120, d < 130 ? 0.95 : 0.7);
  }
});
// --- Guided tour sidebar ------------------------------------------------------------------------
const TOUR_CB = codebases[0];
const toGarden = () => flyTo(TOUR_CB.center, 34, 0.95);
function partialStep(speed, policy) {
  setMutating(false);
  setGardenKind('partial');
  setSim({ speed, policy });
  syncModeButtons();
  toGarden();
}
function wildGarden() {
  setMutating(false);
  setGardenMode(false);
  syncModeButtons();
}
const TOUR = [
  { title: 'An organisation of agents', text: 'From far away, Nano Workforce looks like an ant colony. The Nano Workforce app in the middle orchestrates them, dispatching agents out to the codebases (the anthills) and back.',
    go: () => { flyTo(HOME.target, HOME.pos.length(), Math.acos(HOME.pos.y / HOME.pos.length())); controls.autoRotate = true; } },
  { title: 'Every agent follows a process', text: 'Zoom in on a codebase and each ant turns out to be a token moving through a BPMN process: plan, implement, review, merge. Gateways send work back for rework.',
    go: () => flyTo(TOUR_CB.center, 120, 0.7) },
  { title: 'Inside: a garden', text: 'Inside the codebase is a garden. Without structure, it\u2019s seeds thrown on cracked dirt: overgrowth, constant weeding, and a tiny harvest. More agents just means more seeds.',
    go: () => { wildGarden(); toGarden(); } },
  { title: 'Most gardens are partly structured', text: 'A couple of proper planter boxes, some dirt mounds that need watering by hand, a stick trellis, leaky pipes. At human speed it works: the human keeps up, but they are never not fixing something.',
    go: () => partialStep('human', 'wait') },
  { title: 'Agentic speed: the human is the bottleneck', text: 'Now agents make changes 8\u00d7 faster. Most changes still need a human. If agents wait for the human, the queue grows, beds dry out waiting, and output is capped at the speed of one person.',
    go: () => partialStep('agentic', 'wait') },
  { title: '\u2026or it escapes containment', text: 'If agents don\u2019t wait, changes nobody handled pile up: vines escape the trellis, dry beds die, things get planted wherever. The garden slides back into an overgrown mess.',
    go: () => partialStep('agentic', 'carry') },
  { title: 'Humans refactor the structure', text: 'Not a rewrite. The human stops planting and turns their attention to the structure: KEEP what works, TAKE OUT what doesn\u2019t, MOVE plants into better beds, ADD what is missing: planter boxes (modules), a greenhouse (quality gates), a trellis (CI), irrigation (architecture).',
    go: () => { setMutating(false); setGardenKind('partial'); setGardenMode(true); syncModeButtons(); toGarden(); } },
  { title: 'Agents tend a structured garden', text: 'Now the agents have something to grow into. They tend the plants, and the structure keeps the growth healthy and the harvest coming.',
    go: () => { setGardenMode(true); finishBuild(); setMutating(false); syncModeButtons(); toGarden(); } },
  { title: 'The structure keeps evolving', text: 'Growth puts load on the structure. When the trellis bends, a human reinforces it. When agents add a planter box, a human routes new irrigation. With good structure, everyday change is absorbed by the garden itself; humans only step in to change the structure. That\u2019s what lets it run at agentic speed.',
    go: () => { setGardenMode(true); finishBuild(); toggleMutating(true); toGarden(); } },
  { title: 'Back to the organisation', text: 'Multiply that across every codebase: agents doing the tending at scale, and humans shaping the garden they grow in.',
    go: () => { setMutating(false); syncModeButtons(); flyTo(HOME.target, HOME.pos.length(), Math.acos(HOME.pos.y / HOME.pos.length())); } },
];
const tourEl = document.getElementById('tour');
let tourStep = -1;
function showStep(i) {
  tourStep = Math.max(0, Math.min(TOUR.length - 1, i));
  const st = TOUR[tourStep];
  tourEl.querySelector('.count').textContent = `${tourStep + 1} / ${TOUR.length}`;
  tourEl.querySelector('h2').textContent = st.title;
  tourEl.querySelector('p').textContent = st.text;
  tourEl.querySelector('[data-t=prev]').disabled = tourStep === 0;
  tourEl.querySelector('[data-t=next]').disabled = tourStep === TOUR.length - 1;
  tourEl.querySelector('.dots').innerHTML = TOUR.map((_, k) => `<i class="${k === tourStep ? 'on' : ''}"></i>`).join('');
  controls.autoRotate = false;
  st.go();
}
const toggleTour = () => tourEl.classList.toggle('collapsed');
tourEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  if (b.dataset.t === 'next') showStep(tourStep + 1);
  if (b.dataset.t === 'prev') showStep(tourStep - 1);
  if (b.dataset.t === 'toggle') toggleTour();
});
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { showStep(tourStep + 1); e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { showStep(Math.max(0, tourStep - 1)); e.preventDefault(); }
  if (e.key === 't' || e.key === 'T') toggleTour();
});
// Fill in step 1's text without moving the camera, so the page still opens on the auto-orbit.
{
  const st = TOUR[0];
  tourEl.querySelector('.count').textContent = `1 / ${TOUR.length}`;
  tourEl.querySelector('h2').textContent = st.title;
  tourEl.querySelector('p').textContent = st.text;
  tourEl.querySelector('[data-t=prev]').disabled = true;
  tourEl.querySelector('.dots').innerHTML = TOUR.map((_, k) => `<i class="${k === 0 ? 'on' : ''}"></i>`).join('');
  tourStep = 0;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Loop --------------------------------------------------------------------------------------
const statsEl = document.getElementById('stats');
// Partial garden: the human-throughput numbers, averaged over all gardens.
function partialStats() {
  if (!gardenMode.partial) return '';
  const sims = codebases.map((c) => c.garden.partial.sim);
  const avg = (f) => sims.reduce((n, s) => n + f(s), 0) / sims.length;
  const busy = Math.round(avg((s) => s.busy) * 100);
  const mess = Math.round(avg((s) => s.mess) * 100);
  return `<br><b>${busy}%</b> human busy · <b>${avg((s) => s.queue.length).toFixed(1)}</b> ${gardenMode.policy === 'carry' ? 'unhandled' : 'waiting'}<br><b>${Math.round(avg((s) => s.rate))}</b> changes/min · <b>${mess}%</b> out of control`;
}
const timer = new THREE.Timer();
const camFwd = new THREE.Vector3();
let statT = 0;
function frame() {
  timer.update();
  const dt = Math.min(0.05, timer.getDelta());
  const t = timer.getElapsed();
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.8);
    const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
    camera.position.lerpVectors(fly.fromP, fly.toP, k);
    controls.target.lerpVectors(fly.fromT, fly.toT, k);
    if (fly.t >= 1) fly = null;
  }
  controls.update(dt);
  const z = updateZoom();
  camera.getWorldDirection(camFwd);
  tickSeason(dt);
  if (shownLevel === 2 && caption.style.opacity !== '0' && caption.textContent !== captionFor(2)) caption.textContent = captionFor(2);
  updateWorld(dt, t, camFwd);
  for (const a of agents) {
    a.update(dt, t, z.antMode);
    a.obj.scale.setScalar(z.antMode ? z.antScale : 1);
  }
  sun.target.position.copy(controls.target);
  sun.position.copy(controls.target).add(new THREE.Vector3(40, 90, 30));
  sun.castShadow = z.d < 160;
  // Dusty sky for the wild garden, fading in only at garden level.
  const wild = (gardenMode.build ? 1 - Math.min(1, gardenMode.build.t / 6) : gardenMode.structured ? 0 : 1) * layers.garden.o;
  scene.background.copy(SKY).lerp(SKY_WILD, wild);
  scene.fog.color.copy(scene.background);

  statT -= dt;
  if (statT <= 0) {
    statT = 0.5;
    const inGarden = agents.filter((a) => a.tending).length;
    const commuting = agents.filter((a) => a.commuting).length;
    statsEl.innerHTML = `<b>${agents.length}</b> agents · <b>${codebases.length}</b> codebases<br>${commuting} in transit · ${inGarden} tending code<br><b>${stats.merged}</b> PRs merged · <b>${stats.tended}</b> plants tended<br>${{ wild: 'unstructured', partial: 'partially structured', structured: 'structured' }[gardenKind()]} gardens · <b>${codebases.reduce((n, c) => n + c.garden.ripe, 0)}</b> ripe${partialStats()}`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
