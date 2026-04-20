import * as THREE from 'three';
import { sampleNoise, noise3D } from '../utils/noise';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 5;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number; biome: string }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

const LAND_HEIGHT_SCALE = 0.85;

// Vibrant colors matching reference screenshots
const BIOME_COLORS: Record<string, { low: THREE.Color; mid: THREE.Color; high: THREE.Color; snow: THREE.Color }> = {
  tropical: {
    low: new THREE.Color('#86D468'),  // bright grass green
    mid: new THREE.Color('#55A645'),  // forest green
    high: new THREE.Color('#6B8B3A'), // olive
    snow: new THREE.Color('#A09060'), // brown peak
  },
  temperate: {
    low: new THREE.Color('#7ACC55'),  // vivid green
    mid: new THREE.Color('#55A645'),  // forest
    high: new THREE.Color('#8B9944'), // yellow-green
    snow: new THREE.Color('#D4C4A0'), // sandy peak
  },
  boreal: {
    low: new THREE.Color('#3A8833'),  // dark green
    mid: new THREE.Color('#2A6622'),  // deep forest
    high: new THREE.Color('#556644'), // grey-green
    snow: new THREE.Color('#BBCCBB'), // pale green-white
  },
  desert: {
    low: new THREE.Color('#DDCC88'),  // sand
    mid: new THREE.Color('#CCBB77'),  // darker sand
    high: new THREE.Color('#AA9955'), // brown
    snow: new THREE.Color('#CCBBAA'), // pale brown
  },
  polar: {
    low: new THREE.Color('#DDEEFF'),  // ice blue
    mid: new THREE.Color('#CCDDEE'),  // lighter
    high: new THREE.Color('#BBCCDD'), // grey-blue
    snow: new THREE.Color('#FFFFFF'), // white
  },
};

// Secondary noise: darker vegetation patches
const PATCH_COLORS = [
  new THREE.Color('#3A7A2A'), // dark green patch
  new THREE.Color('#7A8844'), // olive patch
  new THREE.Color('#998855'), // brown-green patch
];

// Ocean colors
const COLOR_OCEAN_DEEP = new THREE.Color('#22aadd');
const COLOR_OCEAN_SHALLOW = new THREE.Color('#55ccee');

export function generateTerrain(): TerrainData {
  // 320 segments → ~0.56°/vertex (~62 km), noticeably smoother coastlines
  // without going to 400+ which doubles generation time.
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 320, 320);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;

  const colors = new Float32Array(vertexCount * 3);
  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  const mask = createWorldMask();
  const color = new THREE.Color();
  const tmpC = new THREE.Color();

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
      const coastFactor = coastDist; // linear ramp — visible mountains inland

      // Very low frequency noise — smooth rolling hills, no spikes
      // scale 0.2 = extremely slow variation across the sphere
      const hills = sampleNoise(nx, ny, nz, 2, 1.8, 0.5, 0.2);
      // Slight medium frequency for texture
      const texture = sampleNoise(nx, ny, nz, 2, 2.0, 0.4, 0.5);
      const noise = Math.abs(hills) * 0.85 + Math.abs(texture) * 0.15 + 0.05;
      const centralBoost = 1.0 + coastDist * 0.3;

      // Regional mountain boost
      // lng from atan2 is raw (positive=east), negate to match our polygon system
      // Actually: lng = atan2(nz,nx), for real-world east=positive this gives positive values
      // But our polygons are negated. So lng itself IS the negated value.
      // Use lng directly (which is already in our negated coord system)
      let regionBoost = 1.0;
      // Himalayas / Tibet
      if (lat > 25 && lat < 42 && lng > -102 && lng < -68)
        regionBoost = 1.0 + 0.9 * Math.max(0, 1 - Math.abs(lat - 33) / 9) * Math.max(0, 1 - Math.abs(lng + 85) / 17);
      // Andes
      if (lat > -55 && lat < 10 && lng > 60 && lng < 80)
        regionBoost = Math.max(regionBoost, 1.0 + 0.7 * Math.max(0, 1 - Math.abs(lng - 70) / 10));
      // Rockies — reduced to avoid crazy spires
      if (lat > 35 && lat < 60 && lng > 105 && lng < 120)
        regionBoost = Math.max(regionBoost, 1.0 + 0.5 * Math.max(0, 1 - Math.abs(lng - 112) / 8));
      // Alps
      if (lat > 43 && lat < 49 && lng > -17 && lng < -4)
        regionBoost = Math.max(regionBoost, 1.25);
      // East Africa
      if (lat > -6 && lat < 6 && lng > -42 && lng < -28)
        regionBoost = Math.max(regionBoost, 1.2);

      // Hard cap so no single combination explodes into skyward spires.
      const heightNorm = Math.min(noise * coastFactor * centralBoost * regionBoost, 0.72);
      const height = heightNorm * LAND_HEIGHT_SCALE;
      const newRadius = GLOBE_RADIUS + height;

      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // ── Color is decoupled from height ────────────────────────────────
      // Previously colorNorm === heightNorm, which pushed interior land
      // (high coastDist + centralBoost) deep into olive/brown territory.
      // Now: base color = raw noise only (keeps land vivid and biome-true).
      // Mountain ridges (regionBoost > 1.0) blend toward high/snow on top
      // of the base, so only real peaks get rocky colours.
      const baseColorNorm = Math.min(0.38, noise * 0.9);  // 0→0.38: low→mid
      const mountainBlend = Math.max(0, (regionBoost - 1.0) / 1.5);   // 0→1 for peaks
      const colorNorm = baseColorNorm + mountainBlend * (1.0 - baseColorNorm);

      // Smooth-step color bands — avoids the hard threshold "steps" that
      // create visible colour blocks on the terrain surface.
      const smoothstep = (e0: number, e1: number, x: number) => {
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      };

      const weights = mask.getBiomeWeights(lat, lng);
      color.setRGB(0, 0, 0);
      for (const [biomeName, weight] of Object.entries(weights) as [keyof BiomeWeights, number][]) {
        if (weight < 0.01) continue;
        const palette = BIOME_COLORS[biomeName];
        if (!palette) continue;
        // Continuous triple-lerp: low→mid→high→snow, fully smooth.
        const t01 = smoothstep(0.0, 0.35, colorNorm);
        const t12 = smoothstep(0.30, 0.65, colorNorm);
        const t23 = smoothstep(0.60, 1.00, colorNorm);
        tmpC.copy(palette.low)
          .lerp(palette.mid,  t01)
          .lerp(palette.high, t12)
          .lerp(palette.snow, t23);
        color.r += tmpC.r * weight;
        color.g += tmpC.g * weight;
        color.b += tmpC.b * weight;
      }


      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Collect land points at the exact vertex position. We deliberately
      // don't jitter the XZ here — jittering moved the point off the
      // actual triangle face plane, which caused features to float or get
      // buried. Visual variation comes from per-instance rotation/scale
      // in the feature classes instead.
      const sampleChance = (Math.sin(i * 7.13) * 0.5 + 0.5) > 0.85;
      if (i % 12 === 0 || sampleChance) {
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
    } else if (onLand) {
      // On land — fully transparent (land terrain shows through)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
    } else {
      // Deep ocean — fully transparent (ocean mesh below handles this)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
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
