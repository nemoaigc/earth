import * as THREE from 'three';

const ORBIT_RADIUS = 12;
const ORBIT_SPEED = 0.05; // rad/s, full rotation ~125s
const HEIGHT_BASE = 3;
const HEIGHT_AMPLITUDE = 1.5;
const HEIGHT_FREQUENCY = 0.15; // oscillation speed

export class CameraController {
  camera: THREE.PerspectiveCamera;
  private orbitAngle: number;
  private heightPhase: number;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    this.orbitAngle = 0;
    this.heightPhase = 0;

    // Set initial position
    this.camera.position.set(ORBIT_RADIUS, HEIGHT_BASE, 0);
    this.camera.lookAt(0, 0, 0);
  }

  update(deltaTime: number): void {
    this.orbitAngle += ORBIT_SPEED * deltaTime;
    this.heightPhase += HEIGHT_FREQUENCY * deltaTime;

    const x = Math.cos(this.orbitAngle) * ORBIT_RADIUS;
    const z = Math.sin(this.orbitAngle) * ORBIT_RADIUS;
    const y = HEIGHT_BASE + Math.sin(this.heightPhase) * HEIGHT_AMPLITUDE;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
