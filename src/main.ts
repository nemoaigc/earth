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

// --- Lighting: Sun + ambient fill ---

// Sun — large glowing sphere
const sunGroup = new THREE.Group();
const sunGeo = new THREE.SphereGeometry(3, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#fff8e0'),
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunGroup.add(sunMesh);

// Sun glow (larger transparent sphere)
const glowGeo = new THREE.SphereGeometry(4.5, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#ffe880'),
  transparent: true,
  opacity: 0.15,
  side: THREE.BackSide,
});
sunGroup.add(new THREE.Mesh(glowGeo, glowMat));

// Position sun far away
sunGroup.position.set(30, 10, 20);
scene.add(sunGroup);

// Directional light from sun
const sunLight = new THREE.DirectionalLight('#fff8e0', 3.0);
sunLight.position.copy(sunGroup.position);
scene.add(sunLight);

// Hemisphere light for ambient fill
const hemiLight = new THREE.HemisphereLight('#88aacc', '#223344', 1.0);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight('#334466', 0.8);
scene.add(ambientLight);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  dayNight.update(deltaTime);
  const state = dayNight.state;


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
