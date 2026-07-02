import * as THREE from 'three';
import { sampleNoise, noise3D } from '../utils/noise';
import { createGeoSample, sampleGeoFromGlobe } from '../geo/sampler';
import type { GeoSample } from '../geo/types';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 5;
const LAND_HEIGHT_SCALE = 1.0;
const TERRAIN_SEGMENTS = 360;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    height: number;
    biome: string;
    treeDensity: number;
    mountain: number;
    snowBias: number;
    volcanic: number;
  }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

// ═══════════════════════════════════════════════════════════════════
// Palette — single source of truth for every land/ocean colour.
// ═══════════════════════════════════════════════════════════════════

const C_DEEP_OCEAN    = new THREE.Color('#1E5FA0');
const C_SHALLOW_OCEAN = new THREE.Color('#46B5C8');
const C_TURQUOISE     = new THREE.Color('#7CD3D9');
const C_ROCKY         = new THREE.Color('#7A6A50');
const C_POLAR_ICE     = new THREE.Color('#C8D6DA');
const C_SNOW_CAP      = new THREE.Color('#EEF2EA');

const BIOME_BASE: Record<string, THREE.Color> = {
  polar:     new THREE.Color('#D8E2E8'),
  boreal:    new THREE.Color('#3E5A3A'),   // taiga
  temperate: new THREE.Color('#5BA84A'),
  tropical:  new THREE.Color('#2E8B2E'),
  desert:    new THREE.Color('#D9B26A'),
};

// ═══════════════════════════════════════════════════════════════════
// Math helpers
// ═══════════════════════════════════════════════════════════════════

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Simplex noise mapped to [0, 1] without the abs() V-fold.
function noise01(x: number, y: number, z: number, scale: number, octaves = 2): number {
  return (sampleNoise(x, y, z, octaves, 1.8, 0.5, scale) + 1) * 0.5;
}

// ═══════════════════════════════════════════════════════════════════
// Layer: elevation
// ═══════════════════════════════════════════════════════════════════

const LAND_THRESHOLD = 0.5;
const COAST_BLUR_DEG = 1.2;   // wide blur → soft coast, no pixel stair
const COAST_FADE_END = 0.85;  // landness at which we hit full height

function elevation(
  nx: number, ny: number, nz: number,
  landness: number,
  geo: GeoSample,
): number {
  if (landness < LAND_THRESHOLD) return 0;

  // Smooth coast fade so the shoreline rises gradually from sea level.
  const coastGate = smoothstep(LAND_THRESHOLD, COAST_FADE_END, landness);

  // Inland gate. All real-geo features fade in after the coast so basins,
  // plateaus and ranges feel embedded in the continent, not stamped onto
  // the shoreline.
  const inlandGate = smoothstep(0.62, 1.0, landness);
  const geoFeatureGate = smoothstep(0.70, 1.0, landness);

  // Slow rolling base noise — adjacent vertices have very similar
  // values, so plains read as a smooth gradient (no spikes, no blocks).
  const baseNoise = noise01(nx, ny, nz, 0.13);
  const baseHeight = 0.035 + baseNoise * 0.14;   // [0.035, 0.175]

  // Geography-aware relief comes from src/geo: mountain polylines, basins,
  // highlands and rifts all share one true-lon atlas.
  const continentalRoll = (
    (noise01(nx + 11.7, ny - 4.3, nz + 2.6, 0.34, 4) - 0.5) * 0.170 +
    noise3D(nx * 4.8 - 6.1, ny * 4.8 + 2.9, nz * 4.8 + 9.4) * 0.050
  );
  const macroRelief = (
    geo.elevation * geoFeatureGate +
    continentalRoll * (0.55 + geo.roughness * 0.55) * inlandGate
  );

  // Fine land material relief. Desert gets shallow ribbing, highlands
  // get more tooth, and plains stay subtle.
  const ridgeNoise = Math.abs(noise3D(nx * 22 + 4.1, ny * 22 - 8.3, nz * 22 + 1.7));
  const rollingNoise = noise3D(nx * 9 - 2.5, ny * 9 + 6.2, nz * 9 - 1.1);
  const reliefGate = smoothstep(0.04, 0.22, Math.abs(macroRelief));
  const materialRoughness = geo.roughness + geo.mountain * 0.45 + geo.volcanic * 0.35;
  const detailStrength = 0.020 + materialRoughness * 0.070 + reliefGate * 0.026;
  const surfaceDetail = (rollingNoise * 0.55 + (ridgeNoise - 0.42) * 0.45) * detailStrength;

  return Math.max(0, baseHeight + macroRelief + surfaceDetail) * coastGate;
}

// ═══════════════════════════════════════════════════════════════════
// Layer: biome (weighted blend, with noise-distorted boundaries)
// ═══════════════════════════════════════════════════════════════════

// Pick the dominant biome name (only needed for landPoints metadata).
function dominantBiomeName(weights: BiomeWeights): string {
  let best: keyof BiomeWeights = 'temperate';
  let bestW = -1;
  for (const [name, w] of Object.entries(weights) as [keyof BiomeWeights, number][]) {
    if (w > bestW) { bestW = w; best = name; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════
// Layer: colour
// ═══════════════════════════════════════════════════════════════════

const C_JUNGLE_DARK = new THREE.Color('#1F5E1F');
const C_FOREST_DARK = new THREE.Color('#2A5520');
const C_SAND_LIGHT  = new THREE.Color('#EAC685');
const C_GRASS_LIGHT = new THREE.Color('#82C75A');
const C_FOREST_BLUE = new THREE.Color('#1E4D35');
const C_WARM_ROCK   = new THREE.Color('#9A8566');
const C_DARK_ROCK   = new THREE.Color('#55483A');
const C_BASIN_GREEN = new THREE.Color('#3E6D36');
const C_BASIN_EARTH = new THREE.Color('#6F6546');
const C_PLATEAU_SOIL = new THREE.Color('#8C744F');
const C_DRY_PLATEAU = new THREE.Color('#C08C52');
const C_VOLCANIC_ROCK = new THREE.Color('#332B27');
const C_LAND_LIGHT = new THREE.Color('#E6E0B8');

// Snow caps exist, but only on high/cold peaks. Threshold stays high
// near the equator so mountains read as landform first, snow second.
function snowline(lat: number): number {
  return 0.92 - smoothstep(38, 72, Math.abs(lat)) * 0.38;
}

// Land colour combines: biome-weighted base + micro tint (sphere-wide
// low-freq variation so flat regions don't read as one solid colour) +
// per-biome accent patches (forest darker patches, desert sand mottle)
// + rocky highlands + polar ice + restrained snow caps.
function landColor(
  weights: BiomeWeights, elev: number, lat: number,
  nx: number, ny: number, nz: number,
  geo: GeoSample,
  out: THREE.Color,
): THREE.Color {
  // Weighted blend of biome base colours (no dominant snap → soft borders)
  out.setRGB(0, 0, 0);
  for (const [name, w] of Object.entries(weights) as [keyof BiomeWeights, number][]) {
    if (w < 0.01) continue;
    const base = BIOME_BASE[name];
    if (!base) continue;
    out.r += base.r * w;
    out.g += base.g * w;
    out.b += base.b * w;
  }

  // Sphere-wide low-freq micro tint (±5%). Same noise field for r/g/b
  // shifted slightly so the tint is colour-coherent, not just brightness.
  const micro = noise3D(nx * 3, ny * 3, nz * 3);  // [-1, 1]
  const tint = micro * 0.045;
  out.r += tint;
  out.g += tint * 0.85;
  out.b += tint * 0.70;

  // Forest patches: tropical/temperate regions get darker green clumps.
  if ((weights.tropical ?? 0) + (weights.temperate ?? 0) > 0.35) {
    const patch = noise3D(nx * 6, ny * 6, nz * 6);
    if (patch > 0.2) {
      const darkRef = (weights.tropical ?? 0) > 0.5 ? C_JUNGLE_DARK : C_FOREST_DARK;
      out.lerp(darkRef, Math.min(0.45, (patch - 0.2) * 0.55));
    }

    // Mid-frequency canopy speckles. This is intentionally colour-only:
    // the terrain mesh is already dense enough, but the old vertex colour
    // field read like flat paint. Tiny green/yellow flecks make forests and
    // grasslands feel like material instead of a single biome swatch.
    const canopy = noise3D(nx * 18 + 2.1, ny * 18 - 1.7, nz * 18 + 4.3);
    if (canopy > 0.34) {
      out.lerp(C_GRASS_LIGHT, Math.min(0.26, (canopy - 0.34) * 0.32));
    } else if (canopy < -0.38) {
      out.lerp(C_FOREST_BLUE, Math.min(0.24, (-canopy - 0.38) * 0.30));
    }
  }

  // Desert mottle: sand-coloured highlights and shadowy dunes.
  if ((weights.desert ?? 0) > 0.35) {
    const patch = noise3D(nx * 5, ny * 5, nz * 5);
    if (patch > 0) {
      out.lerp(C_SAND_LIGHT, patch * 0.30);
    } else {
      out.r += patch * 0.04;  // slightly darker dunes
      out.g += patch * 0.03;
    }

    const dune = noise3D(nx * 15 + 4, ny * 15, nz * 15 - 2);
    if (dune > 0.18) {
      out.lerp(C_SAND_LIGHT, Math.min(0.20, dune * 0.18));
    } else {
      out.lerp(C_WARM_ROCK, Math.min(0.14, -dune * 0.10));
    }
  }

  // Named GeoAtlas landforms get a material response so their real height
  // changes are readable: basin floors darken/cool, plateaus pick up dry
  // exposed soil, and rifts add black-brown rock.
  if (geo.basin > 0.04) {
    const basinMix = Math.min(0.36, geo.basin * 0.34 + Math.max(0, geo.moisture) * 0.08);
    const basinRef = (weights.tropical ?? 0) + (weights.temperate ?? 0) > 0.45
      ? C_BASIN_GREEN
      : C_BASIN_EARTH;
    out.lerp(basinRef, basinMix);
  }
  const plateauSignal = Math.max(geo.plateau, geo.shield, geo.rift * 0.65);
  if (plateauSignal > 0.04) {
    const plateauMix = Math.min(0.38, plateauSignal * 0.28 + geo.rock * 0.12 + geo.sand * 0.08);
    const plateauRef = (weights.desert ?? 0) > 0.35 || geo.sand > 0.25 ? C_DRY_PLATEAU : C_PLATEAU_SOIL;
    out.lerp(plateauRef, plateauMix);
  }
  if (geo.volcanic > 0.05) {
    out.lerp(C_VOLCANIC_ROCK, Math.min(0.42, geo.volcanic * 0.36));
  }

  // Mountain material: altitude-driven ridges, scree, and dark slope
  // pockets. The geometry supplies the silhouette; these colour layers
  // supply the missing sense of "faces" on the mountains.
  const highland = Math.max(smoothstep(0.30, 0.78, elev), geo.mountain * 0.65 + geo.roughness * 0.22);
  if (highland > 0) {
    const ridgeA = Math.abs(noise3D(nx * 26 + 9, ny * 26 - 3, nz * 26 + 2));
    const ridgeB = Math.abs(noise3D(nx * 47 - 5, ny * 47 + 7, nz * 47 - 11));
    const striation = Math.pow(Math.max(ridgeA, ridgeB), 2.2) * highland;
    out.lerp(C_DARK_ROCK, Math.min(0.34, striation * 0.30));

    const sunSide = smoothstep(-0.2, 0.8, nx * -0.35 + ny * 0.76 + nz * 0.28);
    out.lerp(C_WARM_ROCK, highland * sunSide * 0.12);
  }

  // Rocky band: pure elevation-driven material. This replaces the old
  // white snow-cap look with warmer rock and soil.
  const rockyMix = Math.min(0.72, smoothstep(0.36, 0.66, elev) + geo.rock * 0.28 + geo.volcanic * 0.18);
  out.lerp(C_ROCKY, rockyMix);

  // Polar ice only. High mountains elsewhere stay rocky, matching the
  // requested non-white mountain material, with only small broken caps.
  const capBreakup = noise3D(nx * 31 - 13, ny * 31 + 8, nz * 31 + 1) * 0.055;
  const localSnowline = snowline(lat) - geo.snowBias * 0.18;
  const capSnow = smoothstep(localSnowline + capBreakup, localSnowline + 0.12 + capBreakup, elev);
  const polarIce = smoothstep(66, 78, Math.abs(lat));
  out.lerp(C_SNOW_CAP, capSnow * Math.min(0.56, 0.34 + geo.snowBias * 0.38));
  out.lerp(C_POLAR_ICE, polarIce * 0.50);

  // Fine grain last. It is subtle but removes the remaining "flat vertex
  // paint" feeling on plains without changing the macro biome colours.
  const grain = noise3D(nx * 68 + 1.3, ny * 68 - 4.2, nz * 68 + 6.7) * 0.022;
  out.r += grain;
  out.g += grain * 0.9;
  out.b += grain * 0.72;

  // Slight continental lift. Keep it small: enough to make land read brighter
  // through the atmosphere/glass, not enough to wash out biome differences.
  out.lerp(C_LAND_LIGHT, 0.055);

  // Final clamp (some additive tints could under/overshoot a bit)
  out.r = Math.max(0, Math.min(1, out.r));
  out.g = Math.max(0, Math.min(1, out.g));
  out.b = Math.max(0, Math.min(1, out.b));
  return out;
}

function oceanColor(landness: number, out: THREE.Color): THREE.Color {
  const t = smoothstep(0, LAND_THRESHOLD, landness);
  out.copy(C_DEEP_OCEAN).lerp(C_SHALLOW_OCEAN, t);
  // Wider, stronger turquoise band right at the shoreline.
  const shore = smoothstep(0.28, LAND_THRESHOLD, landness);
  out.lerp(C_TURQUOISE, shore * 0.75);
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// Top-level: build the geometry
// ═══════════════════════════════════════════════════════════════════

export function generateTerrain(): TerrainData {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);
  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  const mask = createWorldMask();
  const colorBuf = new THREE.Color();
  const geoBuf = createGeoSample();

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const lng = Math.atan2(nz, nx) * 180 / Math.PI;

    // ── Layer 1: landness (single source of truth for coast) ──
    const landness = mask.sampleLandBlur(lat, lng, COAST_BLUR_DEG);

    if (landness >= LAND_THRESHOLD) {
      // ── Land vertex ──
      const geo = sampleGeoFromGlobe(lat, lng, geoBuf);
      const elev = elevation(nx, ny, nz, landness, geo);
      const r = GLOBE_RADIUS + elev * LAND_HEIGHT_SCALE;
      posAttr.setXYZ(i, nx * r, ny * r, nz * r);

      // Distort lat AND lng we feed to getBiomeWeights so biome zones
      // get a wavy boundary in BOTH directions, not a rectangle. With
      // only lat jitter, deserts defined as rectangular lat/lng boxes
      // still showed straight east/west edges — square patches in the
      // Caspian / Mid-east region. ±5° lng jitter (different noise
      // field) breaks those lines too.
      const latJitter = noise3D(nx * 0.7, ny * 0.7, nz * 0.7) * 4;
      const lngJitter = noise3D(nx * 0.6 + 17, ny * 0.6, nz * 0.6 + 5) * 5;
      const weights = mask.getBiomeWeights(lat + latJitter, lng + lngJitter);
      const biome = dominantBiomeName(weights);
      landColor(weights, elev, lat, nx, ny, nz, geo, colorBuf);
      colors[i * 3]     = colorBuf.r;
      colors[i * 3 + 1] = colorBuf.g;
      colors[i * 3 + 2] = colorBuf.b;

      const sampleChance = (Math.sin(i * 7.13) * 0.5 + 0.5) > 0.85;
      if ((i % 12 === 0 || sampleChance) && landness >= 0.65) {
        landPoints.push({
          position: new THREE.Vector3(nx * r, ny * r, nz * r),
          normal: new THREE.Vector3(nx, ny, nz),
          height: elev,
          biome,
          treeDensity: geo.treeDensity,
          mountain: geo.mountain,
          snowBias: geo.snowBias,
          volcanic: geo.volcanic,
        });
      }
      if (elev < 0.05) {
        coastPoints.push({
          position: new THREE.Vector3(nx * r, ny * r, nz * r),
          normal: new THREE.Vector3(nx, ny, nz),
        });
      }
    } else {
      // ── Ocean vertex ──
      // Slight depth-fade toward the coast so the static base reads
      // shallow near land. The animated ocean shader sits on top.
      const shoreNearness = smoothstep(0.20, LAND_THRESHOLD, landness);
      const depth = (1 - shoreNearness) * 0.008;
      const r = GLOBE_RADIUS - depth;
      posAttr.setXYZ(i, nx * r, ny * r, nz * r);

      oceanColor(landness, colorBuf);
      colors[i * 3]     = colorBuf.r;
      colors[i * 3 + 1] = colorBuf.g;
      colors[i * 3 + 2] = colorBuf.b;
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

// ═══════════════════════════════════════════════════════════════════
// Shallow water ring — unchanged. The animated ocean shader you like
// lives elsewhere; this mesh just adds a thin turquoise halo around
// every coast.
// ═══════════════════════════════════════════════════════════════════

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
    const nearLand = !onLand && (
      mask.isLand(lat + 1, lng) || mask.isLand(lat - 1, lng) ||
      mask.isLand(lat, lng + 1) || mask.isLand(lat, lng - 1)
    );

    if (nearLand) {
      colors[i * 3] = 0.25; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.65;
    } else {
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
