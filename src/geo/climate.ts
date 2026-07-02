import { sampleGeo } from './sampler';
import type { ClimateSample, GeoSample } from './types';

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

export function createClimateSample(): ClimateSample {
  return {
    cloudDensity: 0,
    cloudAltitude: 5.95,
    windSpeed: 0.004,
    windHeading: 0,
    moisture: 0,
    orographic: 0,
    storm: 0,
    polar: 0,
  };
}

function resetClimateSample(out: ClimateSample): ClimateSample {
  out.cloudDensity = 0;
  out.cloudAltitude = 5.95;
  out.windSpeed = 0.004;
  out.windHeading = 0;
  out.moisture = 0;
  out.orographic = 0;
  out.storm = 0;
  out.polar = 0;
  return out;
}

export function sampleClimate(
  lat: number,
  lon: number,
  geo: GeoSample = sampleGeo(lat, lon),
  out: ClimateSample = createClimateSample(),
): ClimateSample {
  resetClimateSample(out);

  const absLat = Math.abs(lat);
  const equatorial = 1 - smoothstep(6, 28, absLat);
  const midLatitudeStormTrack = smoothstep(24, 42, absLat) * (1 - smoothstep(58, 72, absLat));
  const polar = smoothstep(58, 78, absLat);
  const dryness = Math.max(geo.sand, geo.desert * 0.85, Math.max(0, -geo.moisture));
  const moisture = clamp01(0.35 + equatorial * 0.38 + geo.moisture * 0.55 + geo.forest * 0.22 - dryness * 0.42);
  const orographic = clamp01(geo.mountain * moisture * 0.9 + geo.rift * 0.18);
  const storm = clamp01(midLatitudeStormTrack * (0.22 + moisture * 0.5) + equatorial * moisture * 0.22);

  out.moisture = moisture;
  out.orographic = orographic;
  out.storm = storm;
  out.polar = polar;
  out.cloudDensity = clamp01(0.10 + moisture * 0.48 + orographic * 0.28 + storm * 0.22 + polar * 0.12 - dryness * 0.34);
  out.cloudAltitude = 5.84 + equatorial * 0.08 + storm * 0.18 + polar * 0.10;
  out.windSpeed = 0.0025 + midLatitudeStormTrack * 0.006 + storm * 0.004;
  out.windHeading = lat >= 0 ? 1 : -1;
  return out;
}
