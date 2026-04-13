import * as THREE from 'three';
import { Globe } from './globe/Globe';
import { Trees } from './features/Trees';
import { PalmTrees } from './features/PalmTrees';
import { Rocks } from './features/Rocks';
import { Mountains } from './features/Mountains';
// Balloons removed
import { Icebergs } from './features/Icebergs';
import { Reefs } from './features/Reefs';
import { Flowers } from './features/Flowers';
import { Grass } from './features/Grass';
import { SkyDome } from './sky/SkyDome';
import { Clouds } from './sky/Clouds';
import { Stars } from './sky/Stars';
// LensFlare removed
// Rain removed
import { DayNightCycle } from './systems/DayNightCycle';
import { CameraController } from './systems/Camera';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Labels } from './features/Labels';
import { Animals } from './features/Animals';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;

const appEl = document.getElementById('app');
if (appEl) {
  appEl.innerHTML = '';
  appEl.appendChild(renderer.domElement);
}

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
appEl?.appendChild(labelRenderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#60ccde', 25, 80);

// --- Day/Night Cycle ---
const dayNight = new DayNightCycle();

// --- Camera ---
const cameraController = new CameraController(
  window.innerWidth / window.innerHeight,
  renderer.domElement
);

// --- Globe ---
const globe = new Globe();
scene.add(globe.group);

// --- Terrain features ---
const trees = new Trees(globe.terrainData);
scene.add(trees.group);
const palmTrees = new PalmTrees(globe.terrainData);
scene.add(palmTrees.group);
const rocks = new Rocks(globe.terrainData);
scene.add(rocks.group);
const mountains = new Mountains(globe.terrainData);
scene.add(mountains.group);
// Balloons removed
const icebergs = new Icebergs(globe.terrainData);
scene.add(icebergs.group);
const reefs = new Reefs(globe.terrainData);
scene.add(reefs.group);
const flowers = new Flowers(globe.terrainData);
scene.add(flowers.group);
const grass = new Grass(globe.terrainData);
scene.add(grass.group);

const labels = new Labels();
scene.add(labels.group);
const animals = new Animals(globe.terrainData, renderer.domElement);
scene.add(animals.group);

// --- Sky elements ---
const skyDome = new SkyDome();
scene.add(skyDome.mesh);
const clouds = new Clouds();
scene.add(clouds.group);
const stars = new Stars();
scene.add(stars.points);
// lensFlare removed
// lensFlare removed
// Rain removed

// --- Lighting: Self-illuminating (no sun, sky-driven) ---
const ambientLight = new THREE.AmbientLight('#ffffff', 1.5);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight('#aaccee', '#334422', 1.2);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
dirLight.position.set(8, 6, 4);
scene.add(dirLight);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  dayNight.update(deltaTime);
  const state = dayNight.state;

  // --- Light driven by sky brightness ---
  const skyBrightness = (state.hemiSkyColor.r + state.hemiSkyColor.g + state.hemiSkyColor.b) / 3;
  const brightnessFactor = Math.max(0.4, skyBrightness * 2);
  ambientLight.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.6);
  ambientLight.intensity = 2.5 * brightnessFactor;

  // --- Fog ---
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(state.fogColor);
    scene.fog.near = state.fogNear;
    scene.fog.far = state.fogFar;
  }

  // --- Sky ---
  skyDome.updateGradient(state.skyGradient);

  // --- Terrain & ocean ---
  globe.terrainMaterial.color.copy(state.terrainTint);
  globe.ocean.material.color.copy(state.oceanShallow);
  globe.ocean.material.emissive.copy(state.oceanDeep);

  globe.update(elapsed, state.atmosphereColor);

  // --- Sky elements ---
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  // lensFlare removed
  // rain removed

  // --- Terrain features ---
  trees.update(elapsed);
  palmTrees.update(elapsed);
  rocks.update(elapsed);
  mountains.update(elapsed);
  // Balloons removed
  icebergs.update(elapsed);
  reefs.update(elapsed);
  flowers.update(elapsed);
  grass.update(elapsed);
  animals.update(elapsed, cameraController.camera);

  cameraController.update(deltaTime);
  renderer.render(scene, cameraController.camera);
  labels.update(cameraController.camera);
  labelRenderer.render(scene, cameraController.camera);
}

animate();

// --- Click to get lat/lng coordinates ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const coordLabel = document.createElement('div');
coordLabel.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);color:white;font-size:14px;font-family:monospace;background:rgba(0,0,0,0.6);padding:6px 14px;border-radius:8px;z-index:200;pointer-events:none;display:none;';
document.body.appendChild(coordLabel);

renderer.domElement.addEventListener('dblclick', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, cameraController.camera);
  const intersects = raycaster.intersectObject(globe.terrain);
  if (intersects.length > 0) {
    const p = intersects[0].point;
    const len = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
    const lat = Math.asin(p.y/len) * 180 / Math.PI;
    const lng = Math.atan2(p.z/len, p.x/len) * 180 / Math.PI;
    coordLabel.textContent = `lat: ${lat.toFixed(1)}, lng: ${lng.toFixed(1)}`;
    coordLabel.style.display = 'block';
    console.log(`{ lat: ${lat.toFixed(1)}, lng: ${lng.toFixed(1)} }`);
    setTimeout(() => { coordLabel.style.display = 'none'; }, 4000);
  }
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.resize(window.innerWidth / window.innerHeight);
});
