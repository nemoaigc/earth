import * as THREE from 'three';
import { Globe } from './globe/Globe';
import { Trees } from './features/Trees';
import { PalmTrees } from './features/PalmTrees';
import { Rocks } from './features/Rocks';
import { Villages } from './features/Villages';
import { Windmills } from './features/Windmills';
import { Lighthouses } from './features/Lighthouses';
import { Balloons } from './features/Balloons';
import { SkyDome } from './sky/SkyDome';
import { Clouds } from './sky/Clouds';
import { Stars } from './sky/Stars';
import { Aurora } from './sky/Aurora';
import { LensFlare } from './sky/LensFlare';
import { Rain } from './sky/Rain';
import { DayNightCycle } from './systems/DayNightCycle';
import { CameraController } from './systems/Camera';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const appEl = document.getElementById('app');
if (appEl) {
  appEl.innerHTML = '';
  appEl.appendChild(renderer.domElement);
}

// --- Scene ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#99bbdd', 10, 50);

// --- Day/Night Cycle ---
const dayNight = new DayNightCycle();

// --- Camera ---
const cameraController = new CameraController(
  window.innerWidth / window.innerHeight
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

const villages = new Villages(globe.terrainData);
scene.add(villages.group);

const windmills = new Windmills(globe.terrainData);
scene.add(windmills.group);

const lighthouses = new Lighthouses(globe.terrainData);
scene.add(lighthouses.group);

const balloons = new Balloons(globe.terrainData);
scene.add(balloons.group);

// --- Sky elements ---
const skyDome = new SkyDome();
scene.add(skyDome.mesh);

const clouds = new Clouds();
scene.add(clouds.group);

const stars = new Stars();
scene.add(stars.points);

const aurora = new Aurora();
scene.add(aurora.group);

const lensFlare = new LensFlare();
scene.add(lensFlare.group);

const rain = new Rain();
scene.add(rain.group);

// --- Lights ---
const sunLight = new THREE.DirectionalLight('#fffae6', 1.2);
sunLight.position.copy(dayNight.state.sunDirection).multiplyScalar(20);
sunLight.castShadow = false;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight('#8899bb', 0.4);
scene.add(ambientLight);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Update day/night cycle
  dayNight.update(deltaTime);
  const state = dayNight.state;

  // Apply lighting
  sunLight.color.copy(state.sunColor);
  sunLight.intensity = state.sunIntensity;
  sunLight.position.copy(state.sunDirection).multiplyScalar(20);

  ambientLight.color.copy(state.ambientColor);
  ambientLight.intensity = state.ambientIntensity;

  // Apply fog
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(state.fogColor);
    scene.fog.near = state.fogNear;
    scene.fog.far = state.fogFar;
  }

  // Apply sky
  skyDome.update(state.skyTopColor, state.skyBottomColor);

  // Apply atmosphere, ocean
  globe.update(elapsed, state.sunDirection, state.atmosphereColor);

  // Update sky elements
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  aurora.update(elapsed, state.auroraVisibility);
  lensFlare.update(cameraController.camera, state.sunDirection.clone().multiplyScalar(20), state.starVisibility < 0.5 ? 1.0 : 0.0);
  rain.update(elapsed, state.rainIntensity);

  // Update terrain features
  trees.update(elapsed);
  palmTrees.update(elapsed);
  rocks.update(elapsed);
  villages.update(elapsed);
  windmills.update(elapsed);
  lighthouses.update(elapsed);
  balloons.update(elapsed);

  // Update camera
  cameraController.update(deltaTime);

  // Render
  renderer.render(scene, cameraController.camera);
}

animate();

// --- Resize handling ---
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  cameraController.resize(width / height);
});
