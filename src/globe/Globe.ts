import * as THREE from 'three';
import { generateTerrainAsync } from './terrain';
import type { TerrainData } from './terrain';
import { GLOBE_RADIUS } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshPhongMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;
  private _ready = false;
  onReady: (() => void) | null = null;

  constructor() {
    this.group = new THREE.Group();

    // Placeholder empty terrain (will be replaced when image loads)
    const placeholderGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 16);
    this.terrainMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 8,
      flatShading: true,
    });
    this.terrain = new THREE.Mesh(placeholderGeo, this.terrainMaterial);

    this.terrainData = {
      geometry: placeholderGeo,
      landPoints: [],
      coastPoints: [],
      oceanRatio: 0.7,
    };

    this.ocean = new Ocean();
    this.atmosphere = new Atmosphere();

    this.group.add(this.terrain);
    this.group.add(this.ocean.mesh);
    this.group.add(this.atmosphere.mesh);

    // Load real terrain async
    this.loadTerrain();
  }

  private async loadTerrain() {
    const data = await generateTerrainAsync();
    this.terrainData = data;

    // Replace placeholder mesh
    this.group.remove(this.terrain);
    this.terrain = new THREE.Mesh(data.geometry, this.terrainMaterial);
    this.group.add(this.terrain);

    this._ready = true;
    if (this.onReady) this.onReady();
  }

  get ready() { return this._ready; }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
