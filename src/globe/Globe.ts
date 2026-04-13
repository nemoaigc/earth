import * as THREE from 'three';
import { createShallowWaterMesh, generateTerrain, GLOBE_RADIUS } from './terrain';
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
  timeUniform = { value: 0 };

  constructor() {
    this.group = new THREE.Group();

    this.terrainData = generateTerrain();
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

    this.terrain = new THREE.Mesh(
      this.terrainData.geometry,
      this.terrainMaterial
    );

    this.ocean = new Ocean();
    const shallows = createShallowWaterMesh();
    this.atmosphere = new Atmosphere();

    // Order: ocean first, then shallows, then terrain on top, atmosphere last
    this.group.add(this.ocean.mesh);
    this.group.add(shallows);
    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);
  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.timeUniform.value = time;
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
