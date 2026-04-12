// Simplified world continent outlines for land/ocean mask
// Each continent is an array of [longitude, latitude] points

const AFRICA: [number, number][] = [
  [-17, 15], [-5, 36], [10, 37], [30, 32], [35, 30], [40, 25],
  [50, 12], [42, 0], [40, -2], [35, -10], [32, -25], [28, -34],
  [18, -35], [12, -20], [10, -5], [5, 5], [-5, 5], [-10, 8],
  [-17, 15],
];

const EUROPE: [number, number][] = [
  [-10, 36], [-10, 44], [-5, 44], [0, 48], [-5, 54], [5, 56],
  [10, 54], [10, 58], [5, 62], [15, 65], [25, 70], [30, 70],
  [40, 68], [50, 65], [45, 55], [40, 50], [30, 42], [25, 36],
  [5, 36], [-10, 36],
];

const ASIA: [number, number][] = [
  [30, 42], [40, 50], [45, 55], [50, 65], [60, 70], [80, 72],
  [100, 72], [120, 70], [140, 65], [155, 60], [160, 55],
  [145, 45], [130, 35], [125, 30], [120, 25], [108, 20],
  [105, 10], [100, 2], [95, 5], [80, 8], [75, 15], [70, 22],
  [65, 25], [50, 30], [40, 25], [35, 30], [30, 32], [30, 42],
];

const NORTH_AMERICA: [number, number][] = [
  [-170, 65], [-160, 72], [-140, 70], [-120, 75], [-90, 75],
  [-70, 68], [-60, 55], [-65, 45], [-75, 40], [-80, 30],
  [-85, 25], [-90, 20], [-100, 18], [-105, 22], [-115, 30],
  [-120, 35], [-125, 45], [-130, 55], [-145, 62], [-170, 65],
];

const SOUTH_AMERICA: [number, number][] = [
  [-80, 10], [-75, 12], [-60, 10], [-50, 0], [-35, -5],
  [-35, -15], [-40, -22], [-45, -25], [-50, -30], [-55, -35],
  [-65, -55], [-70, -50], [-72, -40], [-70, -20], [-75, -5],
  [-80, 5], [-80, 10],
];

const AUSTRALIA: [number, number][] = [
  [115, -15], [130, -12], [140, -12], [150, -20], [153, -28],
  [148, -38], [140, -38], [130, -32], [115, -22], [115, -15],
];

const GREENLAND: [number, number][] = [
  [-55, 60], [-45, 60], [-20, 65], [-18, 72], [-25, 78],
  [-40, 82], [-55, 80], [-60, 75], [-55, 60],
];

const CONTINENTS = [AFRICA, EUROPE, ASIA, NORTH_AMERICA, SOUTH_AMERICA, AUSTRALIA, GREENLAND];

// Deserts defined as lat/lng bounding boxes
const DESERTS: { minLng: number; maxLng: number; minLat: number; maxLat: number }[] = [
  { minLng: -15, maxLng: 40, minLat: 15, maxLat: 32 },   // Sahara
  { minLng: 45, maxLng: 65, minLat: 15, maxLat: 35 },     // Arabian
  { minLng: 115, maxLng: 150, minLat: -30, maxLat: -18 },  // Australian interior
  { minLng: 60, maxLng: 80, minLat: 25, maxLat: 40 },     // Central Asian
];

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export interface WorldMask {
  isLand: (lat: number, lng: number) => boolean;
  getBiome: (lat: number, lng: number) => string;
}

export function createWorldMask(): WorldMask {
  function isLand(lat: number, lng: number): boolean {
    // Antarctica & Arctic
    if (lat < -65) return true;
    if (lat > 75) return true;
    for (const continent of CONTINENTS) {
      if (pointInPolygon(lng, lat, continent)) return true;
    }
    return false;
  }

  function getBiome(lat: number, lng: number): string {
    if (!isLand(lat, lng)) return 'ocean';
    const absLat = Math.abs(lat);

    // Polar
    if (absLat > 70) return 'polar';

    // Desert check
    for (const d of DESERTS) {
      if (lng >= d.minLng && lng <= d.maxLng && lat >= d.minLat && lat <= d.maxLat) {
        return 'desert';
      }
    }

    // Boreal (taiga)
    if (absLat > 50) return 'boreal';

    // Tropical
    if (absLat < 23) return 'tropical';

    // Temperate
    return 'temperate';
  }

  return { isLand, getBiome };
}
