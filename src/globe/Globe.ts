import * as THREE from 'three';
import { createShallowWaterMesh, generateTerrain } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';
import { loadElevationMap } from './worldmap';

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshPhongMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;
  timeUniform = { value: 0 };
  onReady: (() => void) | null = null;

  constructor() {
    this.group = new THREE.Group();

    // Placeholder terrain (will be replaced when elevation loads)
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

    this.ocean = new Ocean();
    const shallows = createShallowWaterMesh();
    this.atmosphere = new Atmosphere();

    this.group.add(this.ocean.mesh);
    this.group.add(shallows);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);

    // Load elevation map then regenerate terrain
    loadElevationMap().then(() => {
      const newData = generateTerrain();
      this.terrainData = newData;
      this.group.remove(this.terrain);
      this.terrain = new THREE.Mesh(newData.geometry, this.terrainMaterial);
      this.group.add(this.terrain);
      console.log('[globe] terrain regenerated with real elevation data');
      if (this.onReady) this.onReady();
    });
  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.timeUniform.value = time;
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
