import { noise3D } from '../utils/noise';
import { globeLngToLon, localKmDelta } from './coordinates';
import { LANDFORMS } from './data/landforms';
import { MOUNTAIN_RANGES } from './data/mountain-ranges';
import type { GeoPoint, GeoSample, LandformFeature, MountainRangeFeature } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function sphericalNoise(lat: number, lon: number, scale: number, ox = 0, oy = 0, oz = 0): number {
  const phi = lat * Math.PI / 180;
  const theta = lon * Math.PI / 180;
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(theta);
  return noise3D(x * scale + ox, y * scale + oy, z * scale + oz);
}

function distancePointToSegmentKm(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const ab = localKmDelta(a.lat, a.lon, b.lat, b.lon);
  const ap = localKmDelta(a.lat, a.lon, p.lat, p.lon);
  const len2 = ab.x * ab.x + ab.y * ab.y || 1;
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / len2, 0, 1);
  const dx = ap.x - ab.x * t;
  const dy = ap.y - ab.y * t;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToPathKm(p: GeoPoint, path: GeoPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, distancePointToSegmentKm(p, path[i], path[i + 1]));
  }
  return best;
}

function ellipseInfluence(lat: number, lon: number, feature: LandformFeature): { influence: number; radial: number } {
  const d = localKmDelta(feature.center.lat, feature.center.lon, lat, lon);
  const u = d.y / feature.latRadiusKm;
  const v = d.x / feature.lonRadiusKm;
  const radial = Math.sqrt(u * u + v * v);
  if (radial >= 1) return { influence: 0, radial };
  return { influence: Math.cos(radial * Math.PI * 0.5), radial };
}

export function createGeoSample(): GeoSample {
  return {
    elevation: 0,
    roughness: 0.08,
    moisture: 0,
    snowBias: 0,
    rock: 0,
    sand: 0,
    forest: 0,
    volcanic: 0,
    treeDensity: 0.55,
    mountain: 0,
    basin: 0,
    plateau: 0,
    rift: 0,
    desert: 0,
    shield: 0,
  };
}

function resetGeoSample(out: GeoSample): GeoSample {
  out.elevation = 0;
  out.roughness = 0.08;
  out.moisture = 0;
  out.snowBias = 0;
  out.rock = 0;
  out.sand = 0;
  out.forest = 0;
  out.volcanic = 0;
  out.treeDensity = 0.55;
  out.mountain = 0;
  out.basin = 0;
  out.plateau = 0;
  out.rift = 0;
  out.desert = 0;
  out.shield = 0;
  return out;
}

function addMountain(lat: number, lon: number, range: MountainRangeFeature, out: GeoSample): void {
  const distance = distanceToPathKm({ lat, lon }, range.path);
  if (distance >= range.widthKm) return;

  const falloff = Math.cos((distance / range.widthKm) * Math.PI * 0.5);
  const ridge = Math.pow(falloff, 1.70);
  const shoulder = Math.pow(falloff, 0.74);
  const broadUplift = Math.pow(falloff, 0.46);
  const brokenSpine = 0.76 + sphericalNoise(lat, lon, 8.5, 2.3, -4.1, 1.7) * 0.16;
  const height = range.height * (ridge * 0.54 + shoulder * 0.24 + broadUplift * 0.10) * brokenSpine;

  out.elevation += height;
  out.roughness += range.roughness * falloff * 0.42;
  out.rock += range.rock * falloff * 0.46;
  out.snowBias += range.snowBias * ridge;
  out.treeDensity += (range.treeDensityBias ?? -0.12) * falloff;
  out.mountain = Math.max(out.mountain, falloff);
}

function addLandform(lat: number, lon: number, feature: LandformFeature, out: GeoSample): void {
  const { influence, radial } = ellipseInfluence(lat, lon, feature);
  if (influence <= 0) return;

  const broad = Math.pow(influence, 0.72);
  const texture = sphericalNoise(lat, lon, 5.2, 4.8, -2.6, 8.1) * (feature.roughness ?? 0.12) * 0.055;
  out.elevation += feature.elevation * broad + texture * influence;

  if (feature.rim) {
    const ring = smoothstep(0.46, 0.68, radial) * (1 - smoothstep(0.78, 1.0, radial));
    out.elevation += feature.rim * ring;
    out.roughness += ring * 0.08;
  }

  out.roughness += (feature.roughness ?? 0) * influence;
  out.moisture += (feature.moisture ?? 0) * influence;
  out.rock += (feature.rock ?? 0) * influence;
  out.sand += (feature.sand ?? 0) * influence;
  out.forest += (feature.forest ?? 0) * influence;
  out.volcanic += (feature.volcanic ?? 0) * influence;
  out.snowBias += (feature.snowBias ?? 0) * influence;
  out.treeDensity += (feature.treeDensityBias ?? 0) * influence;

  if (feature.kind === 'basin') out.basin = Math.max(out.basin, influence);
  if (feature.kind === 'plateau') out.plateau = Math.max(out.plateau, influence);
  if (feature.kind === 'rift') out.rift = Math.max(out.rift, influence);
  if (feature.kind === 'desert') out.desert = Math.max(out.desert, influence);
  if (feature.kind === 'shield') out.shield = Math.max(out.shield, influence);
}

export function sampleGeo(lat: number, lon: number, out: GeoSample = createGeoSample()): GeoSample {
  resetGeoSample(out);

  for (const range of MOUNTAIN_RANGES) addMountain(lat, lon, range, out);
  for (const feature of LANDFORMS) addLandform(lat, lon, feature, out);

  const absLat = Math.abs(lat);
  out.moisture += (1 - smoothstep(0, 38, absLat)) * 0.10;
  out.snowBias += smoothstep(52, 74, absLat) * 0.12;

  out.treeDensity += out.moisture * 0.16 + out.forest * 0.22;
  out.treeDensity -= out.sand * 0.28 + out.volcanic * 0.18 + out.mountain * 0.20 + out.rock * 0.08;

  out.roughness = clamp01(out.roughness);
  out.moisture = clamp(out.moisture, -1, 1);
  out.snowBias = clamp01(out.snowBias);
  out.rock = clamp01(out.rock);
  out.sand = clamp01(out.sand);
  out.forest = clamp01(out.forest);
  out.volcanic = clamp01(out.volcanic);
  out.treeDensity = clamp01(out.treeDensity);
  return out;
}

export function sampleGeoFromGlobe(lat: number, globeLng: number, out?: GeoSample): GeoSample {
  return sampleGeo(lat, globeLngToLon(globeLng), out);
}
