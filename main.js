import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { layers, applyLayers, smooth } from './core.js';
import { buildWorld, updateWorld, codebases } from './world.js';
import { buildAgents, stats } from './agents.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#bfe3d0');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 500, 1100);

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
  'A software organisation of agents — streaming between codebases and the merge queue like a colony.',
  'Up close, every agent is a token following a BPMN process: plan, implement, review, merge.',
  'Inside a codebase: a garden. Agents tend the plants; the structures keep it growing.',
];
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
    caption.style.opacity = 0;
    setTimeout(() => { caption.textContent = CAPTIONS[level]; caption.style.opacity = 1; }, 250);
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
  if (e.key === '0') flyTo(HOME.target, HOME.pos.length(), Math.acos(HOME.pos.y / HOME.pos.length()));
  const n = Number(e.key);
  if (n >= 1 && n <= codebases.length) {
    const c = codebases[n - 1];
    const d = camera.position.distanceTo(controls.target);
    flyTo(c.center, controls.target.distanceTo(c.center) < 5 && d < 130 ? 34 : 120, d < 130 ? 0.95 : 0.7);
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Loop --------------------------------------------------------------------------------------
const statsEl = document.getElementById('stats');
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
  updateWorld(dt, t, camFwd);
  for (const a of agents) {
    a.update(dt, t, z.antMode);
    a.obj.scale.setScalar(z.antMode ? z.antScale : 1);
  }
  sun.target.position.copy(controls.target);
  sun.position.copy(controls.target).add(new THREE.Vector3(40, 90, 30));
  sun.castShadow = z.d < 160;

  statT -= dt;
  if (statT <= 0) {
    statT = 0.5;
    const inGarden = agents.filter((a) => a.tending).length;
    const commuting = agents.filter((a) => a.commuting).length;
    statsEl.innerHTML = `<b>${agents.length}</b> agents · <b>${codebases.length}</b> codebases<br>${commuting} in transit · ${inGarden} tending code<br><b>${stats.merged}</b> PRs merged · <b>${stats.tended}</b> plants tended`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
