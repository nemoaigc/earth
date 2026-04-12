import * as THREE from 'three';
import { sampleNoise } from '../utils/noise';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 7;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number; biome: string }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

const LAND_HEIGHT_SCALE = 0.8;

// Biome color palettes
const BIOME_COLORS: Record<string, { low: THREE.Color; mid: THREE.Color; high: THREE.Color; snow: THREE.Color }> = {
  tropical: {
    low: new THREE.Color('#33aa44'),
    mid: new THREE.Color('#228833'),
    high: new THREE.Color('#667744'),
    snow: new THREE.Color('#889966'),
  },
  temperate: {
    low: new THREE.Color('#55cc33'),
    mid: new THREE.Color('#44bb44'),
    high: new THREE.Color('#99aa55'),
    snow: new THREE.Color('#ddddcc'),
  },
  boreal: {
    low: new THREE.Color('#336644'),
    mid: new THREE.Color('#225533'),
    high: new THREE.Color('#556655'),
    snow: new THREE.Color('#ccddcc'),
  },
  desert: {
    low: new THREE.Color('#ddcc88'),
    mid: new THREE.Color('#ccbb77'),
    high: new THREE.Color('#aa9966'),
    snow: new THREE.Color('#ccbbaa'),
  },
  polar: {
    low: new THREE.Color('#ddeeff'),
    mid: new THREE.Color('#ccddee'),
    high: new THREE.Color('#bbccdd'),
    snow: new THREE.Color('#ffffff'),
  },
};

// Ocean colors
const COLOR_OCEAN_DEEP = new THREE.Color('#22aadd');
const COLOR_OCEAN_SHALLOW = new THREE.Color('#55ccee');

export function generateTerrain(): TerrainData {
  const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 140);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;

  const colors = new Float32Array(vertexCount * 3);
  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  const mask = createWorldMask();
  const color = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // Convert to lat/lng
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const lng = Math.atan2(nz, nx) * 180 / Math.PI;

    const biome = mask.getBiome(lat, lng);

    if (biome !== 'ocean') {
      // Check distance to coast: sample nearby points for ocean
      let coastDist = 1.0; // 1.0 = far from coast
      for (let step = 1; step <= 7; step++) {
        const d = step * 2.1;
        const nearOcean =
          !mask.isLand(lat + d, lng) || !mask.isLand(lat - d, lng) ||
          !mask.isLand(lat, lng + d) || !mask.isLand(lat, lng - d) ||
          !mask.isLand(lat + d, lng + d) || !mask.isLand(lat - d, lng - d);
        if (nearOcean) {
          coastDist = step / 7;
          break;
        }
      }
      // Smooth ramp: height scales with distance from coast
      const coastFactor = coastDist * coastDist; // quadratic ramp — gentle near coast

      const noise = Math.abs(sampleNoise(nx, ny, nz, 6, 2.0, 0.55, 0.8));
      const centralBoost = 1.0 + coastDist * 0.5;
      const heightNorm = noise * coastFactor * centralBoost;
      const height = heightNorm * LAND_HEIGHT_SCALE;
      const newRadius = GLOBE_RADIUS + height;

      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // Blend colors across biomes using weights (smooth transitions)
      const weights = mask.getBiomeWeights(lat, lng);
      color.setRGB(0, 0, 0);
      const tmpC = new THREE.Color();
      for (const [biomeName, weight] of Object.entries(weights) as [keyof BiomeWeights, number][]) {
        if (weight < 0.01) continue;
        const palette = BIOME_COLORS[biomeName];
        if (!palette) continue;
        if (heightNorm < 0.2) {
          tmpC.lerpColors(palette.low, palette.mid, heightNorm / 0.2);
        } else if (heightNorm < 0.5) {
          tmpC.lerpColors(palette.mid, palette.high, (heightNorm - 0.2) / 0.3);
        } else {
          tmpC.lerpColors(palette.high, palette.snow, (heightNorm - 0.5) / 0.5);
        }
        color.r += tmpC.r * weight;
        color.g += tmpC.g * weight;
        color.b += tmpC.b * weight;
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Collect land points
      if (i % 15 === 0) {
        landPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
          height: heightNorm,
          biome,
        });
      }

      // Coast points
      if (heightNorm < 0.1) {
        coastPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
        });
      }
    } else {
      // OCEAN
      const newRadius = GLOBE_RADIUS - 0.06;
      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // Check proximity to land for shallow color
      const nearLand = mask.isLand(lat + 3, lng) || mask.isLand(lat - 3, lng) ||
                       mask.isLand(lat, lng + 3) || mask.isLand(lat, lng - 3);
      if (nearLand) {
        color.copy(COLOR_OCEAN_SHALLOW);
      } else {
        color.copy(COLOR_OCEAN_DEEP);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      oceanCount++;
    }
  }

  console.log(`[terrain] vertices: ${vertexCount}, land: ${vertexCount - oceanCount}, ocean: ${oceanCount}, landPoints: ${landPoints.length}, coastPoints: ${coastPoints.length}`);
  const biomeCounts: Record<string, number> = {};
  for (const p of landPoints) biomeCounts[p.biome] = (biomeCounts[p.biome] || 0) + 1;
  console.log('[terrain] biomes:', biomeCounts);

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return {
    geometry,
    landPoints,
    coastPoints,
    oceanRatio: oceanCount / vertexCount,
  };
}
