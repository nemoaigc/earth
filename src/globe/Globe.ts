import * as THREE from 'three';
import { generateTerrain, GLOBE_RADIUS } from './terrain';
import type { TerrainData } from './terrain';
import { Atmosphere } from './Atmosphere';

const loader = new THREE.TextureLoader();

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshStandardMaterial;
  atmosphere: Atmosphere;
  terrainData: TerrainData;

  // Stub for compatibility with main.ts
  ocean = { update(_t: number) {}, material: { color: new THREE.Color(), emissive: new THREE.Color() } };

  constructor() {
    this.group = new THREE.Group();

    this.terrainData = generateTerrain();

    const colorMap = loader.load('/earth-map.jpg');
    const bumpMap = loader.load('/earth-bump.jpg');

    // Pure texture + displacement — no shader mixing
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: colorMap,
      displacementMap: bumpMap,
      displacementScale: 0.4,
      bumpMap: bumpMap,
      bumpScale: 0.2,
      roughness: 0.75,
      metalness: 0.0,
    });

    const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 256, 256);
    this.terrain = new THREE.Mesh(geometry, this.terrainMaterial);

    this.atmosphere = new Atmosphere();

    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);
  }

  update(_time: number, atmosphereColor: THREE.Color): void {
    this.atmosphere.updateColor(atmosphereColor);
  }
}
