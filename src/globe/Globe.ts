import * as THREE from 'three';
import { generateTerrain } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshPhongMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;

  constructor() {
    this.group = new THREE.Group();

    // Generate terrain
    this.terrainData = generateTerrain();
    this.terrainMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 8,
      flatShading: true,
    });
    this.terrain = new THREE.Mesh(
      this.terrainData.geometry,
      this.terrainMaterial
    );

    // Create ocean and atmosphere
    this.ocean = new Ocean();
    this.atmosphere = new Atmosphere();

    // Add all to group
    this.group.add(this.terrain);
    this.group.add(this.ocean.mesh);
    this.group.add(this.atmosphere.mesh);
  }

  update(time: number, sunDirection: THREE.Vector3, atmosphereColor: THREE.Color): void {
    this.ocean.update(time);
    this.atmosphere.update(sunDirection, atmosphereColor);
  }
}
