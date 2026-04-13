import * as THREE from 'three';
import { createShallowWaterMesh, generateTerrain, GLOBE_RADIUS } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';
import { loadHeightmap } from './heightmap';

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshPhongMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;
  timeUniform = { value: 0 };
  onReady: (() => void) | null = null;
  private _ready = false;

  constructor() {
    this.group = new THREE.Group();

    // Placeholder — will be replaced when heightmap loads
    this.terrainMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 8,
      flatShading: true,
    });

    const timeUniform = this.timeUniform;
    this.terrainMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.uniforms.uGlobeRadius = { value: GLOBE_RADIUS };
      shader.vertexShader = shader.vertexShader.replace('#include <common>',
        `#include <common>
    uniform float uTime;
    uniform float uGlobeRadius;
    varying float vAltitude;
    varying vec3 vWorldPos;`
      );
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    vWorldPos = wp.xyz;
    vAltitude = (length(wp.xyz) - uGlobeRadius) / 0.8;
    if (vAltitude < 0.4) {
      float sw = vAltitude * 0.003;
      transformed.x += sin(uTime * 1.5 + wp.x * 3.0) * sw;
      transformed.z += cos(uTime * 1.3 + wp.z * 2.5) * sw;
    }`
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
        `#include <common>
    varying float vAltitude;
    varying vec3 vWorldPos;`
      );
    };

    // Temp empty terrain
    this.terrainData = { geometry: new THREE.SphereGeometry(GLOBE_RADIUS, 16, 16), landPoints: [], coastPoints: [], oceanRatio: 0.7 };
    this.terrain = new THREE.Mesh(this.terrainData.geometry, this.terrainMaterial);

    this.ocean = new Ocean();
    this.atmosphere = new Atmosphere();

    this.group.add(this.ocean.mesh);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);

    // Load heightmap then generate real terrain
    this.init();
  }

  private async init() {
    await loadHeightmap();
    this.terrainData = generateTerrain();

    this.group.remove(this.terrain);
    this.terrain = new THREE.Mesh(this.terrainData.geometry, this.terrainMaterial);

    const shallows = createShallowWaterMesh();
    // Re-add in correct order
    this.group.clear();
    this.group.add(this.ocean.mesh);
    this.group.add(shallows);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);

    this._ready = true;
    if (this.onReady) this.onReady();
  }

  get ready() { return this._ready; }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.timeUniform.value = time;
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
