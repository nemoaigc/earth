import * as THREE from 'three';
import { sampleNoise, noise3D } from '../utils/noise';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 10;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number; biome: string }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

const LAND_HEIGHT_SCALE = 0.8;

// Colors matching original Tiny Skies (extracted from source)
const BIOME_COLORS: Record<string, { low: THREE.Color; mid: THREE.Color; high: THREE.Color; snow: THREE.Color }> = {
  tropical: {
    low: new THREE.Color('#3a833a'),
    mid: new THREE.Color('#4a8b5f'),
    high: new THREE.Color('#5a8b0a'),
    snow: new THREE.Color('#8a7744'),
  },
  temperate: {
    low: new THREE.Color('#4a8b3a'),
    mid: new THREE.Color('#5e9944'),
    high: new THREE.Color('#7a8a44'),
    snow: new THREE.Color('#c4aa6a'),
  },
  boreal: {
    low: new THREE.Color('#2a6633'),
    mid: new THREE.Color('#1a4422'),
    high: new THREE.Color('#445533'),
    snow: new THREE.Color('#aabbaa'),
  },
  desert: {
    low: new THREE.Color('#ccbb77'),
    mid: new THREE.Color('#bbaa66'),
    high: new THREE.Color('#aa9955'),
    snow: new THREE.Color('#ccbbaa'),
  },
  polar: {
    low: new THREE.Color('#ddeeff'),
    mid: new THREE.Color('#ccddee'),
    high: new THREE.Color('#bbccdd'),
    snow: new THREE.Color('#ffffff'),
  },
};

// Secondary noise patch colors (original Tiny Skies)
const PATCH_COLORS = [
  new THREE.Color('#5e5868'), // dark brown-grey
  new THREE.Color('#8a6c50'), // warm brown
  new THREE.Color('#b0a568'), // tan/olive
];

// Ocean colors
const COLOR_OCEAN_DEEP = new THREE.Color('#22aadd');
const COLOR_OCEAN_SHALLOW = new THREE.Color('#55ccee');

export function generateTerrain(): TerrainData {
  const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 200);
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

      // Secondary noise: add color patches (like original Tiny Skies)
      if (biome !== 'desert' && biome !== 'polar') {
        const patchNoise = noise3D(nx * 4 + 100, ny * 4 + 100, nz * 4 + 100);
        if (patchNoise > 0.2) {
          const patchStrength = Math.min(1, (patchNoise - 0.2) * 2.5) * 0.6;
          const patchIdx = Math.floor(Math.abs(patchNoise * 7)) % PATCH_COLORS.length;
          const patchColor = PATCH_COLORS[patchIdx];
          color.lerp(patchColor, patchStrength);
        }
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
      // OCEAN — push just below ocean mesh to avoid gap
      const newRadius = GLOBE_RADIUS - 0.02;
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


  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return {
    geometry,
    landPoints,
    coastPoints,
    oceanRatio: oceanCount / vertexCount,
  };
}

// Shallow water transition ring — only near coastlines
export function createShallowWaterMesh(): THREE.Mesh {
  const mask = createWorldMask();
  const geo = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.001, 80);
  const posAttr = geo.getAttribute('position');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len, ny = y / len, nz = z / len;
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const lng = Math.atan2(nz, nx) * 180 / Math.PI;

    const onLand = mask.isLand(lat, lng);
    // Check if near coast (within 5°)
    const nearLand = !onLand && (
      mask.isLand(lat + 1, lng) || mask.isLand(lat - 1, lng) ||
      mask.isLand(lat, lng + 1) || mask.isLand(lat, lng - 1)
    );

    if (nearLand) {
      // Shallow turquoise water
      colors[i * 3] = 0.25; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.65;
      alphas[i] = 0.3;
    } else if (onLand) {
      // On land — fully transparent (land terrain shows through)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
      alphas[i] = 0;
    } else {
      // Deep ocean — fully transparent (ocean mesh below handles this)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
      alphas[i] = 0;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    shininess: 20,
    flatShading: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
