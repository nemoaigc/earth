import * as THREE from 'three';
import { sampleNoise, noise3D } from '../utils/noise';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 5;
const LAND_HEIGHT_SCALE = 1.0;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number; biome: string }[];
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
const C_SNOW          = new THREE.Color('#FBFBFB');

const BIOME_BASE: Record<string, THREE.Color> = {
  polar:     new THREE.Color('#D8E2E8'),
  boreal:    new THREE.Color('#3E5A3A'),   // taiga
  temperate: new THREE.Color('#5BA84A'),
  tropical:  new THREE.Color('#2E8B2E'),
  desert:    new THREE.Color('#D9B26A'),
};

// ═══════════════════════════════════════════════════════════════════
// Mountain regions — table driven. Each region is an ellipse on the
// lat/lng grid with a smooth cosine falloff. Adding new mountains is
// just adding a row. Heights stack (clamped later).
//
// lng convention: codebase east = negative (real-world east longitude
// is stored as a negative number here, see worldmap.ts).
// ═══════════════════════════════════════════════════════════════════

interface MountainRegion {
  name: string;
  lat: number;
  lng: number;
  latRange: number;  // half-extent N-S, degrees
  lngRange: number;  // half-extent E-W, degrees
  peakHeight: number;
}

const MOUNTAINS: MountainRegion[] = [
  // Asia — Himalaya / Tibet broken into a chain of sub-peaks so the
  // range reads as a series of summits rather than one smooth dome.
  { name: 'Karakoram',    lat:  36, lng:  -76, latRange:  3,  lngRange:  4, peakHeight: 1.00 },
  { name: 'Himalaya W',   lat:  32, lng:  -80, latRange:  3,  lngRange:  5, peakHeight: 0.95 },
  { name: 'Himalaya C',   lat:  28, lng:  -86, latRange:  3,  lngRange:  5, peakHeight: 1.15 }, // Everest
  { name: 'Himalaya E',   lat:  28, lng:  -94, latRange:  3,  lngRange:  5, peakHeight: 0.90 },
  { name: 'Tibet Plat.',  lat:  33, lng:  -88, latRange:  7,  lngRange: 13, peakHeight: 0.45 },
  { name: 'Tian Shan',    lat:  42, lng:  -78, latRange:  4,  lngRange:  8, peakHeight: 0.55 },
  { name: 'Japanese Alps',lat:  36, lng: -138, latRange:  2,  lngRange:  2, peakHeight: 0.35 },
  { name: 'Urals',        lat:  60, lng:  -60, latRange:  9,  lngRange:  3, peakHeight: 0.30 },
  // Americas — Andes broken into 4 N-S sub-peaks (the real chain has
  // clearly distinct massifs: Northern, Central, Southern, Patagonian).
  { name: 'Andes N',      lat:   2, lng:   75, latRange:  6,  lngRange:  6, peakHeight: 0.75 },
  { name: 'Andes C',      lat: -15, lng:   70, latRange:  8,  lngRange:  7, peakHeight: 1.00 },
  { name: 'Andes S',      lat: -35, lng:   70, latRange:  9,  lngRange:  6, peakHeight: 0.85 },
  { name: 'Patagonia',    lat: -48, lng:   72, latRange:  6,  lngRange:  5, peakHeight: 0.55 },
  { name: 'Rockies',      lat:  47, lng:  113, latRange: 13,  lngRange:  6, peakHeight: 0.80 },
  { name: 'Appalachians', lat:  38, lng:   80, latRange:  6,  lngRange:  4, peakHeight: 0.35 },
  { name: 'Sierra Madre', lat:  25, lng:  103, latRange:  5,  lngRange:  3, peakHeight: 0.35 },
  { name: 'Brazilian H.', lat: -15, lng:   47, latRange:  7,  lngRange:  7, peakHeight: 0.20 },
  // Europe
  { name: 'Alps',         lat:  46, lng:  -10, latRange:  3,  lngRange:  6, peakHeight: 0.55 },
  { name: 'Pyrenees',     lat:  43, lng:    0, latRange:  1.5,lngRange:  3, peakHeight: 0.40 },
  { name: 'Apennines',    lat:  43, lng:  -13, latRange:  4,  lngRange:  2, peakHeight: 0.25 },
  { name: 'Carpathians',  lat:  47, lng:  -22, latRange:  3,  lngRange:  4, peakHeight: 0.30 },
  { name: 'Caucasus',     lat:42.5, lng:  -44, latRange:  2,  lngRange:  4, peakHeight: 0.45 },
  { name: 'Scandinavian', lat:  64, lng:   -8, latRange:  7,  lngRange:  3, peakHeight: 0.30 },
  // Africa
  { name: 'Atlas',        lat:  33, lng:   -1, latRange:  3,  lngRange: 10, peakHeight: 0.40 },
  { name: 'Ethiopian H.', lat:  10, lng:  -38, latRange:  5,  lngRange:  4, peakHeight: 0.45 },
  { name: 'Drakensberg',  lat: -30, lng:  -29, latRange:  3,  lngRange:  3, peakHeight: 0.30 },
  // Oceania
  { name: 'Great Divide', lat: -33, lng: -148, latRange:  5,  lngRange:  3, peakHeight: 0.25 },
  { name: 'NZ Southern',  lat: -43, lng: -170, latRange:  2,  lngRange:  3, peakHeight: 0.40 },
  // Polar ice plateaus (visual mass for Greenland / Antarctica peaks)
  { name: 'Greenland',    lat:  72, lng:   37, latRange:  8,  lngRange: 12, peakHeight: 0.55 },
];

// ═══════════════════════════════════════════════════════════════════
// Math helpers
// ═══════════════════════════════════════════════════════════════════

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Smooth cosine falloff inside an ellipse. Returns 1 at centre, 0 at
// the edge of the ellipse, with a continuous derivative everywhere —
// so adjoining regions never have a visible crease.
function ellipseFalloff(
  dLat: number, latRange: number,
  dLng: number, lngRange: number,
): number {
  const u = dLat / latRange;
  const v = dLng / lngRange;
  const r2 = u * u + v * v;
  if (r2 >= 1) return 0;
  return Math.cos(Math.sqrt(r2) * Math.PI * 0.5);
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

function mountainBoost(lat: number, lng: number): number {
  let total = 0;
  for (const m of MOUNTAINS) {
    let dLng = lng - m.lng;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    const f = ellipseFalloff(Math.abs(lat - m.lat), m.latRange, Math.abs(dLng), m.lngRange);
    if (f > 0) total += m.peakHeight * f;
  }
  return total;
}

function elevation(
  nx: number, ny: number, nz: number,
  lat: number, lng: number,
  landness: number,
): number {
  if (landness < LAND_THRESHOLD) return 0;

  // Smooth coast fade so the shoreline rises gradually from sea level.
  const coastGate = smoothstep(LAND_THRESHOLD, COAST_FADE_END, landness);

  // Mountains additionally need to sit well inland — a white peak whose
  // vertex lives next to an ocean vertex produces visible "spike"
  // feathering through smooth shading. Push mountain elevation to 0
  // until we're at least a couple of bitmap pixels inside the coast.
  const inlandGate = smoothstep(0.62, 0.85, landness);

  // Slow rolling base noise — adjacent vertices have very similar
  // values, so plains read as a smooth gradient (no spikes, no blocks).
  const baseNoise = noise01(nx, ny, nz, 0.13);
  const baseHeight = 0.06 + baseNoise * 0.22;   // [0.06, 0.28]

  // Mountains (table driven)
  let mtHeight = mountainBoost(lat, lng) * inlandGate;

  // Asymmetric ridge variation — real mountains are NOT smooth cones.
  // Two noise fields, different scales:
  //   * lf (low-freq) shifts whole flanks higher or lower so the chain
  //     has a wavy spine rather than a perfectly symmetric profile
  //   * hf (high-freq) adds individual peaks and saddles
  // Strength fades to 0 at the bump edge so we never get a "spike" at
  // the foothills where the mountain meets the coast or plain.
  if (mtHeight > 0.15) {
    const lf = noise01(nx, ny, nz, 0.18);            // big rolling tilt
    const hf = noise01(nx, ny, nz, 0.55);            // small peaks
    const strength = smoothstep(0.15, 0.70, mtHeight);
    const variation = (lf - 0.5) * 0.32 + (hf - 0.5) * 0.20;
    mtHeight *= 1 + variation * strength;
  }

  return (baseHeight + mtHeight) * coastGate;
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

// Snowline elevation as a function of latitude.
// Equator: only the highest peaks (snowline ≈ 0.80).
// 70°+:    most things are snow (snowline ≈ 0.15).
function snowline(lat: number): number {
  return 0.80 - smoothstep(35, 70, Math.abs(lat)) * 0.65;
}

const C_JUNGLE_DARK = new THREE.Color('#1F5E1F');
const C_FOREST_DARK = new THREE.Color('#2A5520');
const C_SAND_LIGHT  = new THREE.Color('#EAC685');

// Land colour combines: biome-weighted base + micro tint (sphere-wide
// low-freq variation so flat regions don't read as one solid colour) +
// per-biome accent patches (forest darker patches, desert sand mottle)
// + rocky band + snow cap.
function landColor(
  weights: BiomeWeights, elev: number, lat: number,
  nx: number, ny: number, nz: number,
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
  }

  // Rocky band: just below snowline, only on appreciable elevation.
  const sl = snowline(lat);
  const rockyMix = smoothstep(Math.max(0.30, sl - 0.20), sl - 0.04, elev);
  out.lerp(C_ROCKY, rockyMix);

  // Snow above snowline (narrow transition → crisp peaks) or polar lat.
  const altSnow = smoothstep(sl - 0.04, sl + 0.04, elev);
  const polarSnow = smoothstep(68, 75, Math.abs(lat));
  out.lerp(C_SNOW, Math.max(altSnow, polarSnow));

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
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 480, 480);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);
  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  const mask = createWorldMask();
  const colorBuf = new THREE.Color();

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
      const elev = elevation(nx, ny, nz, lat, lng, landness);
      const r = GLOBE_RADIUS + elev * LAND_HEIGHT_SCALE;
      posAttr.setXYZ(i, nx * r, ny * r, nz * r);

      // Distort the lat we feed to getBiomeWeights so biome zones
      // (Sahara/Sahel, taiga/temperate) get a wavy boundary instead of
      // a perfectly horizontal stripe. ±4° of slow noise is enough.
      const latJitter = noise3D(nx * 0.7, ny * 0.7, nz * 0.7) * 4;
      const weights = mask.getBiomeWeights(lat + latJitter, lng);
      const biome = dominantBiomeName(weights);
      landColor(weights, elev, lat, nx, ny, nz, colorBuf);
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
