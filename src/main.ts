import * as THREE from 'three';
import { Globe } from './globe/Globe';
import { Trees } from './features/Trees';
import { PalmTrees } from './features/PalmTrees';
import { Rocks } from './features/Rocks';
import { Mountains } from './features/Mountains';
import { Balloons } from './features/Balloons';
import { Icebergs } from './features/Icebergs';
import { Reefs } from './features/Reefs';
import { SkyDome } from './sky/SkyDome';
import { Clouds } from './sky/Clouds';
import { Stars } from './sky/Stars';
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
const mountains = new Mountains(globe.terrainData);
scene.add(mountains.group);
const balloons = new Balloons(globe.terrainData);
scene.add(balloons.group);
const icebergs = new Icebergs(globe.terrainData);
scene.add(icebergs.group);
const reefs = new Reefs(globe.terrainData);
scene.add(reefs.group);

// --- Sky elements ---
const skyDome = new SkyDome();
scene.add(skyDome.mesh);
const clouds = new Clouds();
scene.add(clouds.group);
const stars = new Stars();
scene.add(stars.points);
const lensFlare = new LensFlare();
scene.add(lensFlare.group);
const rain = new Rain();
scene.add(rain.group);

// --- Lighting: Self-illuminating (no sun, sky-driven) ---
const ambientLight = new THREE.AmbientLight('#ffffff', 3.5);
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
  if ((globe.ocean.material as any)._foamColorUniform) {
    (globe.ocean.material as any)._foamColorUniform.value.copy(state.oceanFoam);
  }

  globe.update(elapsed, state.atmosphereColor);

  // --- Sky elements ---
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  lensFlare.update(cameraController.camera, new THREE.Vector3(20, 10, 0), state.starVisibility < 0.5 ? 1.0 : 0.0);
  rain.update(elapsed, state.rainIntensity);

  // --- Terrain features ---
  trees.update(elapsed);
  palmTrees.update(elapsed);
  rocks.update(elapsed);
  mountains.update(elapsed);
  balloons.update(elapsed);
  icebergs.update(elapsed);
  reefs.update(elapsed);

  cameraController.update(deltaTime);
  renderer.render(scene, cameraController.camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.resize(window.innerWidth / window.innerHeight);
});
