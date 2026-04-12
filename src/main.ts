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
import { Rain } from './sky/Rain';
import { DayNightCycle } from './systems/DayNightCycle';
import { CameraController } from './systems/Camera';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;

const appEl = document.getElementById('app');
if (appEl) { appEl.innerHTML = ''; appEl.appendChild(renderer.domElement); }

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#60ccde', 20, 55);

const dayNight = new DayNightCycle();
const cameraController = new CameraController(window.innerWidth / window.innerHeight, renderer.domElement);

// Globe (loads terrain async)
const globe = new Globe();
scene.add(globe.group);

// Features added when terrain is ready
const featureGroups: THREE.Group[] = [];
const featureUpdaters: ((t: number) => void)[] = [];

function addFeatures() {
  const td = globe.terrainData;
  const features = [
    new Trees(td), new PalmTrees(td), new Rocks(td),
    new Villages(td), new Windmills(td), new Mountains(td),
    new Lighthouses(td), new Balloons(td),
  ];
  for (const f of features) {
    scene.add(f.group);
    featureGroups.push(f.group);
    featureUpdaters.push((t) => f.update(t));
  }
}

globe.onReady = addFeatures;
// If already ready (sync fallback)
if (globe.ready) addFeatures();

// Sky
const skyDome = new SkyDome();
scene.add(skyDome.mesh);
const clouds = new Clouds();
scene.add(clouds.group);
const stars = new Stars();
scene.add(stars.points);
const rain = new Rain();
scene.add(rain.group);

// Lighting: self-illuminating
const ambientLight = new THREE.AmbientLight('#ffffff', 3.5);
scene.add(ambientLight);

// Animation
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  dayNight.update(deltaTime);
  const state = dayNight.state;

  // Light driven by sky
  const skyBrightness = (state.hemiSkyColor.r + state.hemiSkyColor.g + state.hemiSkyColor.b) / 3;
  const bf = Math.max(0.4, skyBrightness * 2);
  ambientLight.color.copy(state.hemiSkyColor).lerp(new THREE.Color('#ffffff'), 0.6);
  ambientLight.intensity = 2.5 * bf;

  // Fog
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(state.fogColor);
    scene.fog.near = state.fogNear;
    scene.fog.far = state.fogFar;
  }

  skyDome.updateGradient(state.skyGradient);

  globe.terrainMaterial.color.copy(state.terrainTint);
  globe.ocean.material.color.copy(state.oceanShallow);
  globe.ocean.material.emissive.copy(state.oceanDeep);
  if ((globe.ocean.material as any)._foamColorUniform) {
    (globe.ocean.material as any)._foamColorUniform.value.copy(state.oceanFoam);
  }

  globe.update(elapsed, state.atmosphereColor);
  clouds.update(elapsed, state.cloudOpacity);
  stars.update(state.starVisibility);
  rain.update(elapsed, state.rainIntensity);

  for (const updater of featureUpdaters) updater(elapsed);

  cameraController.update(deltaTime);
  renderer.render(scene, cameraController.camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.resize(window.innerWidth / window.innerHeight);
});
