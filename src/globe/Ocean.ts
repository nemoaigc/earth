import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.01, 60);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2288cc'),
      roughness: 0.3,
      metalness: 0.1,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  update(_time: number): void {
    // Static ocean — color driven by main.ts
  }
}
