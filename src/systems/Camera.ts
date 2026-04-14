import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ORBIT_RADIUS = 10;
const AUTO_ROTATE_SPEED = 0.3;
const FOCUS_DURATION = 0.9;   // seconds
// Offset the camera slightly so the clicked animal sits a bit above centre —
// leaves room for the right-side panel without dead-centring the subject.
const FOCUS_SCREEN_SHIFT = new THREE.Vector3(-0.6, 0.15, 0);

export class CameraController {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  // Focus animation state (great-circle slerp of the viewing direction)
  private focusStartDir: THREE.Vector3 | null = null;
  private focusEndDir: THREE.Vector3 | null = null;
  private focusStartDist = ORBIT_RADIUS;
  private focusEndDist = ORBIT_RADIUS;
  private focusT = 0;
  private focusing = false;

  constructor(aspect: number, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    this.camera.position.set(ORBIT_RADIUS * 0.5, 3, ORBIT_RADIUS * 0.87);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 25;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0, 0);
  }

  /**
   * Animate the camera so the given world-space surface point is roughly
   * centred in view. Preserves the current orbit distance; keeps user
   * control once the animation finishes.
   */
  focusOn(point: THREE.Vector3, distance = ORBIT_RADIUS): void {
    this.controls.autoRotate = false;
    this.focusStartDir = this.camera.position.clone().normalize();
    const shifted = point.clone().add(FOCUS_SCREEN_SHIFT);
    this.focusEndDir = shifted.normalize();
    this.focusStartDist = this.camera.position.length();
    this.focusEndDist = Math.min(Math.max(distance, this.controls.minDistance), this.controls.maxDistance);
    this.focusT = 0;
    this.focusing = true;
  }

  clearFocus(): void {
    this.focusing = false;
  }

  update(deltaTime: number): void {
    if (this.focusing && this.focusStartDir && this.focusEndDir) {
      this.focusT = Math.min(1, this.focusT + deltaTime / FOCUS_DURATION);
      // Ease-in-out cubic
      const e = this.focusT < 0.5
        ? 4 * this.focusT ** 3
        : 1 - Math.pow(-2 * this.focusT + 2, 3) / 2;
      // Slerp along great circle for smooth globe rotation
      const dir = new THREE.Vector3().copy(this.focusStartDir);
      const end = this.focusEndDir;
      const dot = Math.min(1, Math.max(-1, dir.dot(end)));
      const omega = Math.acos(dot);
      if (omega < 1e-4) {
        dir.copy(end);
      } else {
        const s = Math.sin(omega);
        const a = Math.sin((1 - e) * omega) / s;
        const b = Math.sin(e * omega) / s;
        dir.set(
          a * this.focusStartDir.x + b * end.x,
          a * this.focusStartDir.y + b * end.y,
          a * this.focusStartDir.z + b * end.z,
        );
      }
      const dist = this.focusStartDist + (this.focusEndDist - this.focusStartDist) * e;
      this.camera.position.copy(dir).multiplyScalar(dist);
      if (this.focusT >= 1) this.focusing = false;
    }
    this.controls.update();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
