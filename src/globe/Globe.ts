import * as THREE from 'three';
import { createShallowWaterMesh, generateTerrain } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshStandardMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;

  constructor() {
    this.group = new THREE.Group();

    this.terrainData = generateTerrain();
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: true,
    });

    this.terrain = new THREE.Mesh(
      this.terrainData.geometry,
      this.terrainMaterial
    );

    this.ocean = new Ocean();
    const shallows = createShallowWaterMesh();
    this.atmosphere = new Atmosphere();

    this.group.add(this.ocean.mesh);
    this.group.add(shallows);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);
  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
