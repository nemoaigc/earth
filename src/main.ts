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
const animals = new Animals(globe.terrainData, renderer.domElement, globe.snapToSurface);
scene.add(animals.group);
animals.onSelect = (_info, position) => {
  cameraController.focusOn(position);
};

if (import.meta.env.DEV) {
  (window as unknown as { __earth: unknown }).__earth = { scene, globe, animals, cameraController };
}

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
const ambientLight = new THREE.AmbientLight('#ffffff', 5.0);
scene.add(ambientLight);

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

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.resize(window.innerWidth / window.innerHeight);
});
