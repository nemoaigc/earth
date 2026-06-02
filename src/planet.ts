import { mulberry32 } from './utils/noise';
import * as THREE from 'three';
import { Globe } from './globe/Globe';
import { Trees } from './features/Trees';
import { PalmTrees } from './features/PalmTrees';
import { Reefs } from './features/Reefs';
import { Flowers } from './features/Flowers';
import { Grass } from './features/Grass';
import { SkyDome } from './sky/SkyDome';
import { Clouds } from './sky/Clouds';
import { Stars } from './sky/Stars';
import { DayNightCycle } from './systems/DayNightCycle';
import { CameraController } from './systems/Camera';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Labels } from './features/Labels';
import { Animals } from './features/Animals';

export interface MountOptions {
  /** Called once, after the first frame is painted (dismiss the loading screen). */
  onReady?: () => void;
}

/**
 * Build the entire planet scene inside `container` and start the render loop.
 * Returns a disposer that fully tears everything down — animation frame, resize
 * listener, GL context, and all DOM nodes appended to the container — so it is
 * safe to call repeatedly (React StrictMode / Fast Refresh remount in dev).
 *
 * Previously this was the top-level body of src/main.ts; it now lives behind a
 * function so it only runs on the client, inside a React effect.
 */
export function mountPlanet(container: HTMLElement, opts: MountOptions = {}): () => void {
  // Make every Math.random() call deterministic so the planet (tree positions,
  // animal jitter, sprite scales, etc.) looks identical on every load. This must
  // run before any feature constructor is called below — which it does, since
  // those constructors are only invoked inside this function.
  Math.random = mulberry32(0x5C0F_E2A1);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#5bbad0', 25, 80);

  // --- Day/Night Cycle ---
  const dayNight = new DayNightCycle();

  // --- Camera ---
  const cameraController = new CameraController(width / height, renderer.domElement);

  // --- Globe ---
  const globe = new Globe();
  scene.add(globe.group);

  // --- Terrain features ---
  const trees = new Trees(globe.terrainData);
  scene.add(trees.group);
  const palmTrees = new PalmTrees(globe.terrainData);
  scene.add(palmTrees.group);
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
  // When the panel is closed via the × button, mirror the deselect back to
  // Animals so the selected sprite returns to normal scale and tooltips work.
  animals.panel.onHide = () => {
    animals.deselect();
    cameraController.clearFocus();
  };

  if (process.env.NODE_ENV !== 'production') {
    (window as unknown as { __earth: unknown }).__earth = { scene, globe, animals, cameraController };
  }

  // --- Sky elements ---
  const skyDome = new SkyDome();
  scene.add(skyDome.mesh);
  const clouds = new Clouds();
  scene.add(clouds.group);
  const stars = new Stars();
  scene.add(stars.points);

  // --- Lighting: Self-illuminating (no sun, sky-driven) ---
  const ambientLight = new THREE.AmbientLight('#ffffff', 5.0);
  scene.add(ambientLight);

  // --- Animation loop ---
  const clock = new THREE.Clock();
  let firstFrameRendered = false;
  let rafId = 0;
  let disposed = false;

  function animate(): void {
    rafId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsed = clock.getElapsedTime();

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

    // --- Terrain features ---
    trees.update(elapsed);
    palmTrees.update(elapsed);
    reefs.update(elapsed);
    flowers.update(elapsed);
    grass.update(elapsed);
    animals.update(elapsed, cameraController.camera);

    cameraController.update(deltaTime);
    renderer.render(scene, cameraController.camera);
    labels.update(cameraController.camera);
    labelRenderer.render(scene, cameraController.camera);

    // Notify once the first real frame is painted (loading screen dismissal).
    if (!firstFrameRendered) {
      firstFrameRendered = true;
      opts.onReady?.();
    }
  }

  animate();

  // --- Resize: track the container (not the viewport) so the canvas fits
  // whatever box React gives it. ---
  function onResize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    cameraController.resize(w / h);
  }
  window.addEventListener('resize', onResize);

  // --- Teardown ---
  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    animals.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    // Remove the canvas + CSS2D layer we appended.
    renderer.domElement.remove();
    labelRenderer.domElement.remove();
  };
}
