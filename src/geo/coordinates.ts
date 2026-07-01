import * as THREE from 'three';

export const KM_PER_DEG_LAT = 110.574;
export const KM_PER_DEG_LON_AT_EQUATOR = 111.320;

export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function deltaLon(a: number, b: number): number {
  return normalizeLon(a - b);
}

/**
 * The existing globe mesh uses `atan2(z, x)` directly, which makes real-world
 * east longitudes negative. Keep all GeoAtlas data in normal real-world lon and
 * convert at this boundary only.
 */
export function lonToGlobeLng(lon: number): number {
  return normalizeLon(-lon);
}

export function globeLngToLon(globeLng: number): number {
  return normalizeLon(-globeLng);
}

export function latLonToVec3(lat: number, lon: number, r: number, out: THREE.Vector3): void {
  const phi = lat * Math.PI / 180;
  const theta = lonToGlobeLng(lon) * Math.PI / 180;
  out.set(
    Math.cos(phi) * Math.cos(theta) * r,
    Math.sin(phi) * r,
    Math.cos(phi) * Math.sin(theta) * r,
  );
}

export function normalToLatLon(normal: THREE.Vector3): { lat: number; lon: number } {
  const n = normal.clone().normalize();
  const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
  const globeLng = Math.atan2(n.z, n.x) * 180 / Math.PI;
  return { lat, lon: globeLngToLon(globeLng) };
}

export function localKmDelta(
  originLat: number,
  originLon: number,
  lat: number,
  lon: number,
): { x: number; y: number } {
  const meanLat = ((originLat + lat) * 0.5) * Math.PI / 180;
  return {
    x: deltaLon(lon, originLon) * KM_PER_DEG_LON_AT_EQUATOR * Math.cos(meanLat),
    y: (lat - originLat) * KM_PER_DEG_LAT,
  };
}
