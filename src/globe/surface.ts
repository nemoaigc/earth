import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

const LAND_THRESHOLD = 0.55;
const LAND_BLOBS = [
  { lat: 56, lon: -108, rx: 28, ry: 18, weight: 1.05 },
  { lat: 42, lon: -92, rx: 24, ry: 15, weight: 0.96 },
  { lat: 24, lon: -100, rx: 13, ry: 10, weight: 0.55 },
  { lat: 63, lon: -149, rx: 12, ry: 9, weight: 0.46 },
  { lat: 74, lon: -42, rx: 16, ry: 10, weight: 0.64 },
  { lat: -10, lon: -60, rx: 17, ry: 20, weight: 0.86 },
  { lat: -34, lon: -63, rx: 10, ry: 15, weight: 0.68 },
  { lat: 7, lon: 17, rx: 18, ry: 22, weight: 0.95 },
  { lat: 24, lon: 15, rx: 15, ry: 13, weight: 0.76 },
  { lat: -19, lon: 29, rx: 15, ry: 16, weight: 0.78 },
  { lat: 51, lon: 18, rx: 20, ry: 11, weight: 0.82 },
  { lat: 57, lon: 66, rx: 36, ry: 14, weight: 1.04 },
  { lat: 43, lon: 93, rx: 28, ry: 14, weight: 0.95 },
  { lat: 29, lon: 104, rx: 21, ry: 12, weight: 0.82 },
  { lat: 22, lon: 79, rx: 11, ry: 9, weight: 0.58 },
  { lat: 14, lon: 105, rx: 12, ry: 8, weight: 0.46 },
  { lat: -25, lon: 134, rx: 15, ry: 12, weight: 0.76 },
  { lat: -41, lon: 173, rx: 5, ry: 4, weight: 0.18 },
  { lat: -19, lon: 47, rx: 5, ry: 8, weight: 0.14 },
] as const;

const OCEAN_DEEP = new THREE.Color('#1550a6');
const OCEAN_MID = new THREE.Color('#39a3df');
const OCEAN_SHALLOW = new THREE.Color('#9fe6ff');
const BEACH = new THREE.Color('#e0ce8b');
const TROPICAL_FOREST = new THREE.Color('#45a73b');
const TEMPERATE_FOREST = new THREE.Color('#6fc24b');
const GRASSLAND = new THREE.Color('#c0d56d');
const DESERT = new THREE.Color('#cbb06f');
const ROCK = new THREE.Color('#9e8760');
const TUNDRA = new THREE.Color('#8f9a74');
const ICE = new THREE.Color('#d9e2d8');

export interface SurfaceSample {
  color: THREE.Color;
  elevation: number;
  landness: number;
  moisture: number;
  mountainness: number;
  temperature: number;
  shoreProximity: number;
  isLand: boolean;
  biome: string;
}

export function sampleSurface(normal: THREE.Vector3): SurfaceSample {
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1)) / DEG2RAD;
  const lon = Math.atan2(normal.z, normal.x) / DEG2RAD;

  let landness = 0;
  for (const blob of LAND_BLOBS) {
    landness += ellipseField(lat, lon, blob.lat, blob.lon, blob.rx, blob.ry, 1.45) * blob.weight;
  }

  const antarctica = THREE.MathUtils.clamp((-lat - 61) / 15, 0, 1);
  landness += antarctica * 0.9;

  const macroNoise =
    Math.sin((lon * 1.9 + lat * 0.7) * DEG2RAD) * 0.08 +
    Math.cos((lon * 1.2 - lat * 1.4) * DEG2RAD * 1.7) * 0.07 +
    Math.sin((lon * 3.8 + lat * 2.2) * DEG2RAD) * 0.05;
  const coastNoise =
    Math.sin((lon * 8.8 - lat * 3.2) * DEG2RAD) * 0.03 +
    Math.cos((lon * 6.7 + lat * 7.6) * DEG2RAD) * 0.028;
  landness += macroNoise + coastNoise;

  const andes = ridgeField(lat, lon, 9, -78, -52, -70, 5.2);
  const rockies = ridgeField(lat, lon, 30, -114, 58, -108, 6.5);
  const alps = ridgeField(lat, lon, 44, 5, 48, 15, 3.0);
  const himalayas = ridgeField(lat, lon, 28, 74, 36, 97, 4.2);
  const eastAfrica = ridgeField(lat, lon, -13, 30, 14, 40, 4.8);
  const japanArc = ridgeField(lat, lon, 30, 130, 45, 145, 3.4);
  const scandinavia = ridgeField(lat, lon, 58, 7, 69, 27, 4.6);
  const mountainNoise = Math.max(
    0,
    Math.sin((lon * 2.5 + lat * 2.8) * DEG2RAD) * 0.32 +
      Math.cos((lon * 5.2 - lat * 1.7) * DEG2RAD) * 0.18,
  );
  const mountainness = Math.max(
    0,
    andes * 1.2 +
      rockies * 0.95 +
      himalayas * 1.4 +
      alps * 0.72 +
      eastAfrica * 0.55 +
      japanArc * 0.5 +
      scandinavia * 0.4 +
      mountainNoise,
  );

  const sahara = ellipseField(lat, lon, 23, 13, 24, 10, 1.3);
  const arabia = ellipseField(lat, lon, 24, 48, 12, 8, 1.3);
  const gobi = ellipseField(lat, lon, 43, 103, 15, 8, 1.25);
  const australiaDry = ellipseField(lat, lon, -24, 134, 16, 10, 1.3);
  const atacama = ellipseField(lat, lon, -24, -70, 4.5, 8, 1.2);
  const southwestUS = ellipseField(lat, lon, 33, -111, 9, 6, 1.2);
  const rainAmazon = ellipseField(lat, lon, -5, -62, 16, 11, 1.3);
  const rainCongo = ellipseField(lat, lon, -1, 20, 11, 9, 1.3);
  const rainSEA = ellipseField(lat, lon, 10, 104, 18, 10, 1.3);
  const taiga = ellipseField(lat, lon, 60, 95, 34, 10, 1.25);

  const isLand = landness > LAND_THRESHOLD;
  const temperature = THREE.MathUtils.clamp(1 - Math.abs(lat) / 88 - mountainness * 0.12, 0, 1);
  const moistureBase =
    0.36 +
    Math.cos((lat - 8) * DEG2RAD * 1.7) * 0.28 +
    Math.sin((lon + lat * 0.45) * DEG2RAD * 1.8) * 0.12;
  const moisture = THREE.MathUtils.clamp(
    moistureBase +
      rainAmazon * 0.42 +
      rainCongo * 0.28 +
      rainSEA * 0.32 +
      taiga * 0.16 -
      sahara * 0.62 -
      arabia * 0.42 -
      gobi * 0.28 -
      australiaDry * 0.4 -
      atacama * 0.48 -
      southwestUS * 0.24,
    0,
    1,
  );

  const coastline = THREE.MathUtils.clamp((landness - LAND_THRESHOLD) / 0.12, 0, 1);
  const shoreProximity = THREE.MathUtils.clamp(1 - Math.abs(landness - LAND_THRESHOLD) / 0.12, 0, 1);
  const elevation = isLand
    ? 0.008 +
      coastline * 0.018 +
      Math.max(0, landness - 0.62) * 0.018 +
      mountainness * 0.068 +
      Math.max(0, coastNoise) * 0.016
    : Math.max(0, landness - 0.47) * 0.003;

  const desertness = THREE.MathUtils.clamp(
    1 - moisture + sahara * 0.35 + arabia * 0.25 + australiaDry * 0.22,
    0,
    1,
  );
  const coldness = THREE.MathUtils.clamp(1 - temperature, 0, 1);

  const color = new THREE.Color();
  let biome = 'ocean';

  if (isLand) {
    if (antarctica > 0.28 || (coldness > 0.76 && moisture > 0.35)) {
      color.copy(ICE);
      biome = 'polar';
    } else if (desertness > 0.72 && temperature > 0.38) {
      color.lerpColors(BEACH, DESERT, THREE.MathUtils.clamp((desertness - 0.72) / 0.28, 0, 1));
      biome = 'desert';
    } else if (coldness > 0.62) {
      color.lerpColors(TUNDRA, ICE, THREE.MathUtils.clamp((coldness - 0.62) / 0.38, 0, 1) * 0.5);
      biome = 'boreal';
    } else if (moisture > 0.68 && temperature > 0.45) {
      color.lerpColors(TROPICAL_FOREST, TEMPERATE_FOREST, THREE.MathUtils.clamp((0.85 - temperature) / 0.4, 0, 1));
      biome = 'tropical';
    } else if (moisture > 0.42) {
      color.lerpColors(TEMPERATE_FOREST, GRASSLAND, THREE.MathUtils.clamp((0.6 - moisture) / 0.25, 0, 1));
      biome = 'temperate';
    } else {
      color.lerpColors(GRASSLAND, DESERT, THREE.MathUtils.clamp((desertness - 0.35) / 0.45, 0, 1));
      biome = temperature > 0.62 ? 'tropical' : 'temperate';
    }

    if (coastline < 0.22) {
      color.lerp(BEACH, 0.46 - coastline * 1.2);
    }

    color.lerp(ROCK, THREE.MathUtils.clamp(mountainness * 0.62 + Math.max(0, elevation - 0.055) * 4.1, 0, 0.46));
  } else {
    const oceanMix = THREE.MathUtils.clamp(normal.y * 0.16 + 0.54 + macroNoise * 0.22, 0, 1);
    color.lerpColors(OCEAN_DEEP, OCEAN_MID, oceanMix);
    color.lerp(OCEAN_SHALLOW, THREE.MathUtils.clamp((landness - 0.26) / 0.3, 0, 0.85));
  }

  return {
    color,
    elevation,
    landness,
    moisture,
    mountainness,
    temperature,
    shoreProximity,
    isLand,
    biome,
  };
}

export function sampleSurfaceAtLatLng(lat: number, lon: number): SurfaceSample {
  return sampleSurface(latLonToNormal(lat, lon));
}

export function isSurfaceLand(lat: number, lon: number): boolean {
  return sampleSurfaceAtLatLng(lat, lon).isLand;
}

export function latLonToNormal(lat: number, lon: number): THREE.Vector3 {
  const phi = lat * DEG2RAD;
  const theta = lon * DEG2RAD;

  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta),
  );
}

function wrapLongitudeDelta(a: number, b: number): number {
  let delta = a - b;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function ellipseField(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  rx: number,
  ry: number,
  softness: number,
): number {
  const dx = wrapLongitudeDelta(lon, centerLon) / rx;
  const dy = (lat - centerLat) / ry;
  const dist = dx * dx + dy * dy;
  return dist < 1 ? Math.pow(1 - dist, softness) : 0;
}

function ridgeField(
  lat: number,
  lon: number,
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  width: number,
): number {
  const bx = wrapLongitudeDelta(lonB, lonA);
  const by = latB - latA;
  const px = wrapLongitudeDelta(lon, lonA);
  const py = lat - latA;
  const denom = bx * bx + by * by;
  const t = denom === 0 ? 0 : THREE.MathUtils.clamp((px * bx + py * by) / denom, 0, 1);
  const dx = px - bx * t;
  const dy = py - by * t;
  const dist = Math.hypot(dx, dy) / width;
  return dist < 1 ? Math.pow(1 - dist, 1.7) : 0;
}
