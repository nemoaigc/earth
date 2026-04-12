import * as THREE from 'three';
import { Globe } from './globe/Globe';
import { Trees } from './features/Trees';
import { PalmTrees } from './features/PalmTrees';
import { Rocks } from './features/Rocks';
import { Villages } from './features/Villages';
import { Windmills } from './features/Windmills';
import { Mountains } from './features/Mountains';
import { Lighthouses } from './features/Lighthouses';
import { Balloons } from './features/Balloons';
import { SkyDome } from './sky/SkyDome';
import { Clouds } from './sky/Clouds';
import { Stars } from './sky/Stars';
// Aurora removed
import { LensFlare } from './sky/LensFlare';
import { Rain } from './sky/Rain';
import { DayNightCycle } from './systems/DayNightCycle';
import { CameraController } from './systems/Camera';

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

// --- Scene ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#60ccde', 15, 40);

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

const villages = new Villages(globe.terrainData);
scene.add(villages.group);

const windmills = new Windmills(globe.terrainData);
scene.add(windmills.group);

const mountains = new Mountains(globe.terrainData);
scene.add(mountains.group);

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

// Aurora removed per user request

const lensFlare = new LensFlare();
scene.add(lensFlare.group);

const rain = new Rain();
scene.add(rain.group);

// --- Multi-light system (matching original Tiny Skies) ---
// Main sun
const sunLight = new THREE.DirectionalLight('#fff0d0', 3.75);
sunLight.position.set(20, 6, 0);
scene.add(sunLight);

// Secondary sun (slightly offset)
const sun2Light = new THREE.DirectionalLight('#fff0d0', 2.5);
sun2Light.position.set(18, 10, 5);
scene.add(sun2Light);

// Fill light (from side, prevents dark faces)
const fillLight = new THREE.DirectionalLight('#90bfcc', 1.25);
fillLight.position.set(-10, 5, 15);
scene.add(fillLight);

// Back light (subtle rim/silhouette light)
const backLight = new THREE.DirectionalLight('#aacc6e', 1.0);
backLight.position.set(-15, -5, -10);
scene.add(backLight);

// Hemisphere light (sky + ground colors)
const hemiLight = new THREE.HemisphereLight('#80ccdd', '#66aa44', 1.25);
scene.add(hemiLight);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  dayNight.update(deltaTime);
  const state = dayNight.state;

  // --- Update lights ---
  const sunDir = state.sunDirection;
  sunLight.color.copy(state.sunColor);
  sunLight.intensity = state.sunIntensity;
  sunLight.position.copy(sunDir).multiplyScalar(20);

  sun2Light.color.copy(state.sun2Color);
  sun2Light.intensity = state.sun2Intensity;
  sun2Light.position.copy(sunDir).multiplyScalar(18).add(new THREE.Vector3(0, 4, 5));

  fillLight.color.copy(state.fillColor);
  fillLight.intensity = state.fillIntensity;
  // Fill from opposite side of sun
  fillLight.position.copy(sunDir).multiplyScalar(-12).add(new THREE.Vector3(0, 5, 0));

  backLight.color.copy(state.backColor);
  backLight.intensity = state.backIntensity;
  backLight.position.copy(sunDir).multiplyScalar(-15).add(new THREE.Vector3(0, -5, 0));

  hemiLight.color.copy(state.hemiSkyColor);
  hemiLight.groundColor.copy(state.hemiGroundColor);
  hemiLight.intensity = state.hemiIntensity;

  // --- Fog ---
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(state.fogColor);
    scene.fog.near = state.fogNear;
    scene.fog.far = state.fogFar;
  }

  // --- Sky (multi-stop gradient) ---
  skyDome.updateGradient(state.skyGradient);

  // --- Terrain & ocean ---
  globe.terrainMaterial.color.copy(state.terrainTint);
  globe.ocean.material.color.copy(state.oceanShallow);
  globe.ocean.material.emissive.copy(state.oceanDeep);
  // Update foam color uniform
  if ((globe.ocean.material as any)._foamColorUniform) {
    (globe.ocean.material as any)._foamColorUniform.value.copy(state.oceanFoam);
  }

  globe.update(elapsed, state.sunDirection, state.atmosphereColor);

  // --- Sky elements ---
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  // aurora removed
  lensFlare.update(cameraController.camera, sunDir.clone().multiplyScalar(20), state.starVisibility < 0.5 ? 1.0 : 0.0);
  rain.update(elapsed, state.rainIntensity);

  // --- Terrain features ---
  trees.update(elapsed);
  palmTrees.update(elapsed);
  rocks.update(elapsed);
  villages.update(elapsed);
  windmills.update(elapsed);
  mountains.update(elapsed);
  lighthouses.update(elapsed);
  balloons.update(elapsed);

  cameraController.update(deltaTime);
  renderer.render(scene, cameraController.camera);
}

animate();

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  cameraController.resize(width / height);
});
