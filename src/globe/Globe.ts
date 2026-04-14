import * as THREE from 'three';
import { createShallowWaterMesh, generateTerrain, GLOBE_RADIUS } from './terrain';
import type { TerrainData } from './terrain';
import { Ocean } from './Ocean';
import { Atmosphere } from './Atmosphere';

/**
 * Raycast from globe centre outward through (lat, lng) direction onto the
 * actual terrain mesh. Returns the visible surface point — this is the only
 * reliable way to snap instances onto flat-shaded facets, since vertex
 * positions alone don't describe the triangle face between them.
 *
 * Returns null if the ray misses the mesh (shouldn't happen for a closed
 * globe but kept defensive).
 */
export type SurfaceSnap = (lat: number, lng: number) => {
  point: THREE.Vector3;
  normal: THREE.Vector3;
} | null;

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.MeshPhongMaterial;
  ocean: Ocean;
  atmosphere: Atmosphere;
  terrainData: TerrainData;
  timeUniform = { value: 0 };
  snapToSurface: SurfaceSnap;

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

    // Build a raycaster bound to the terrain mesh for exact surface snapping.
    // Shoots from outside the globe inward so the FrontSide material is hit
    // (a ray from the centre outward would hit back-facing triangles, which
    // are ignored by default).
    const raycaster = new THREE.Raycaster();
    raycaster.near = 0;
    raycaster.far = GLOBE_RADIUS * 2 + 10;
    const FAR = GLOBE_RADIUS + 5;
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const inward = new THREE.Vector3();
    const terrainMesh = this.terrain;
    const oceanMesh = this.ocean.mesh;
    this.snapToSurface = (lat, lng) => {
      const phi = (lat * Math.PI) / 180;
      const theta = (lng * Math.PI) / 180;
      dir.set(
        Math.cos(phi) * Math.cos(theta),
        Math.sin(phi),
        Math.cos(phi) * Math.sin(theta),
      ).normalize();
      origin.copy(dir).multiplyScalar(FAR);
      inward.copy(dir).negate();
      raycaster.set(origin, inward);
      const hits = raycaster.intersectObjects([terrainMesh, oceanMesh], false);
      if (hits.length === 0) return null;
      const hit = hits[0];
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : dir.clone();
      return { point: hit.point.clone(), normal };
    };

  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.timeUniform.value = time;
    this.ocean.update(time);
    this.atmosphere.updateColor(atmosphereColor);
  }
}
