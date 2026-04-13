import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ORBIT_RADIUS = 18;
const AUTO_ROTATE_SPEED = 0.3;

export class CameraController {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  constructor(aspect: number, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    this.camera.position.set(ORBIT_RADIUS, 3, 0);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 50;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0, 0);
  }

  update(_deltaTime: number): void {
    this.controls.update();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
