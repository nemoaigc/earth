import * as THREE from 'three';
import { generateTerrain } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';

const loader = new THREE.TextureLoader();

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshStandardMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;

  constructor() {
    this.group = new THREE.Group();

    // Generate terrain data (for landPoints used by features)
    this.terrainData = generateTerrain();

    // Real earth texture + bump map
    const colorMap = loader.load('/earth-map.jpg');
    const bumpMap = loader.load('/earth-bump.jpg');

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: colorMap,
      displacementMap: bumpMap,
      displacementScale: 0.5,
      bumpMap: bumpMap,
      bumpScale: 0.3,
      roughness: 0.8,
      metalness: 0.0,
      flatShading: true,
    });

    this.terrain = new THREE.Mesh(
      this.terrainData.geometry,
      this.terrainMaterial
    );

    this.ocean = new Ocean();
    this.atmosphere = new Atmosphere();

    this.group.add(this.ocean.mesh);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);
  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
