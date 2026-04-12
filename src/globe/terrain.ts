import * as THREE from 'three';
import { sampleNoise } from '../utils/noise';
import { smoothstep } from '../utils/helpers';

export const GLOBE_RADIUS = 5;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

const TERRAIN_THRESHOLD = 0.05;
const LAND_HEIGHT_SCALE = 0.35;
const OCEAN_INDENT_MAX = 0.08;
const NOISE_SCALE = 0.8;
const NOISE_OCTAVES = 6;
const NOISE_LACUNARITY = 2.0;
const NOISE_PERSISTENCE = 0.5;

// Land colors by elevation
const COLOR_BEACH = new THREE.Color('#c8b878');
const COLOR_GRASS_LOW = new THREE.Color('#55cc33');
const COLOR_GRASS_MID = new THREE.Color('#44bb44');
const COLOR_ROCKY = new THREE.Color('#99aa55');
const COLOR_SNOW = new THREE.Color('#ddddcc');

// Ocean colors - bright turquoise
const COLOR_OCEAN_DEEP = new THREE.Color('#22aadd');
const COLOR_OCEAN_SHALLOW = new THREE.Color('#55ccee');
const COLOR_OCEAN_COAST = new THREE.Color('#77ddcc');

export function generateTerrain(seed?: number): TerrainData {
  const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 80);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;

  // Create color attribute
  const colors = new Float32Array(vertexCount * 3);

  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  // Seed offset (simple approach: offset noise sampling)
  const seedOffset = seed !== undefined ? seed * 100 : 0;

  // First pass: determine land/ocean per vertex and collect noise values
  const noiseValues = new Float32Array(vertexCount);
  const isLand = new Uint8Array(vertexCount);

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Normalize to unit sphere for consistent noise sampling
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    const noise = sampleNoise(
      nx + seedOffset, ny + seedOffset, nz + seedOffset,
      NOISE_OCTAVES, NOISE_LACUNARITY, NOISE_PERSISTENCE, NOISE_SCALE
    );

    noiseValues[i] = noise;
    isLand[i] = noise > TERRAIN_THRESHOLD ? 1 : 0;
  }

  // Second pass: displace vertices and assign colors
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    const noise = noiseValues[i];
    const color = new THREE.Color();

    if (isLand[i]) {
      // Land: displace outward based on height
      const heightNorm = (noise - TERRAIN_THRESHOLD) / (1.0 - TERRAIN_THRESHOLD);
      const height = heightNorm * LAND_HEIGHT_SCALE;
      const newRadius = GLOBE_RADIUS + height;

      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // Color based on elevation - with beach at coast
      if (heightNorm < 0.06) {
        // Beach/sand at very low elevation
        color.lerpColors(COLOR_BEACH, COLOR_GRASS_LOW, heightNorm / 0.06);
      } else if (heightNorm < 0.3) {
        color.lerpColors(COLOR_GRASS_LOW, COLOR_GRASS_MID, (heightNorm - 0.06) / 0.24);
      } else if (heightNorm < 0.6) {
        color.lerpColors(COLOR_GRASS_MID, COLOR_ROCKY, (heightNorm - 0.3) / 0.3);
      } else {
        color.lerpColors(COLOR_ROCKY, COLOR_SNOW, (heightNorm - 0.6) / 0.4);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Collect land points (sample every ~20th for performance)
      if (i % 20 === 0) {
        landPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
          height: heightNorm,
        });
      }

      // Check if this is a coast point (land vertex near the threshold)
      if (heightNorm < 0.08) {
        coastPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
        });
      }
    } else {
      // Ocean: slightly indent
      const depthNorm = smoothstep(-0.3, TERRAIN_THRESHOLD, noise);
      // Shallow water near coast: less indent. Deep water: more indent
      const indent = OCEAN_INDENT_MAX * (1.0 - depthNorm * 0.8);
      const newRadius = GLOBE_RADIUS - indent;

      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // Color: coast → shallow → deep
      if (depthNorm > 0.7) {
        color.lerpColors(COLOR_OCEAN_SHALLOW, COLOR_OCEAN_COAST, (depthNorm - 0.7) / 0.3);
      } else {
        color.lerpColors(COLOR_OCEAN_DEEP, COLOR_OCEAN_SHALLOW, depthNorm / 0.7);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      oceanCount++;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return {
    geometry,
    landPoints,
    coastPoints,
    oceanRatio: oceanCount / vertexCount,
  };
}
