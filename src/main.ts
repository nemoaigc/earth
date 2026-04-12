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
const lensFlare = new LensFlare();
scene.add(lensFlare.group);
const rain = new Rain();
scene.add(rain.group);

// ==========================================
// THREE LIGHTING MODES - Press 1/2/3 to switch
// ==========================================

let lightingMode = 1; // default: pure ambient

// --- Mode 1: Pure Ambient (no directional sun) ---
const ambientLight1 = new THREE.AmbientLight('#ffffff', 2.5);
const hemiLight1 = new THREE.HemisphereLight('#88bbdd', '#556644', 2.0);

// --- Mode 2: Soft directional + ambient (subtle 3D feel) ---
const ambientLight2 = new THREE.AmbientLight('#ffffff', 1.8);
const hemiLight2 = new THREE.HemisphereLight('#88bbdd', '#556644', 1.5);
const softDir2 = new THREE.DirectionalLight('#ffffff', 1.0);
softDir2.position.set(5, 10, 5);

// --- Mode 3: Self-illuminating (emissive globe) ---
const ambientLight3 = new THREE.AmbientLight('#ffffff', 3.5);

// All lights start hidden
const allLights = [ambientLight1, hemiLight1, ambientLight2, hemiLight2, softDir2, ambientLight3];
allLights.forEach(l => { l.visible = false; scene.add(l); });

function setLightingMode(mode: number) {
  lightingMode = mode;
  allLights.forEach(l => l.visible = false);
  if (mode === 1) {
    ambientLight1.visible = true;
    hemiLight1.visible = true;
  } else if (mode === 2) {
    ambientLight2.visible = true;
    hemiLight2.visible = true;
    softDir2.visible = true;
  } else {
    ambientLight3.visible = true;
  }
  updateModeLabel();
}

// --- Mode label UI ---
const modeLabel = document.createElement('div');
modeLabel.style.cssText = 'position:fixed;top:16px;left:16px;color:white;font-size:14px;font-family:Inter,system-ui,sans-serif;background:rgba(0,0,0,0.5);padding:8px 14px;border-radius:8px;z-index:100;pointer-events:none;';
document.body.appendChild(modeLabel);

function updateModeLabel() {
  const names = ['', '1: Pure Ambient (均匀光)', '2: Soft Directional (微弱方向光)', '3: Self-Illuminating (自发光)'];
  modeLabel.textContent = `Lighting: ${names[lightingMode]}  |  Press 1/2/3 to switch`;
}

// Keyboard listener
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setLightingMode(1);
  if (e.key === '2') setLightingMode(2);
  if (e.key === '3') setLightingMode(3);
});

// Start with mode 1
setLightingMode(1);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  dayNight.update(deltaTime);
  const state = dayNight.state;

  // --- Update lights based on sky state (no sun direction) ---
  // All modes: tint lights by sky color
  const skyBrightness = (state.hemiSkyColor.r + state.hemiSkyColor.g + state.hemiSkyColor.b) / 3;
  const brightnessFactor = Math.max(0.4, skyBrightness * 2);

  if (lightingMode === 1) {
    ambientLight1.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.5);
    ambientLight1.intensity = 1.5 * brightnessFactor;
    hemiLight1.color.copy(state.hemiSkyColor);
    hemiLight1.groundColor.copy(state.hemiGroundColor);
    hemiLight1.intensity = 1.2 * brightnessFactor;
  } else if (lightingMode === 2) {
    ambientLight2.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.5);
    ambientLight2.intensity = 1.2 * brightnessFactor;
    hemiLight2.color.copy(state.hemiSkyColor);
    hemiLight2.groundColor.copy(state.hemiGroundColor);
    hemiLight2.intensity = 1.0 * brightnessFactor;
    softDir2.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.7);
    softDir2.intensity = 0.8 * brightnessFactor;
  } else {
    ambientLight3.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.6);
    ambientLight3.intensity = 2.5 * brightnessFactor;
  }

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

  globe.update(elapsed, state.sunDirection, state.atmosphereColor);

  // --- Sky elements ---
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  lensFlare.update(cameraController.camera, new THREE.Vector3(20, 10, 0), state.starVisibility < 0.5 ? 1.0 : 0.0);
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
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.resize(window.innerWidth / window.innerHeight);
});
