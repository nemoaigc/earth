// World continent outlines - more detailed for recognizable Earth shape
// Each continent: [longitude, latitude] pairs

const AFRICA: [number, number][] = [
  [-17,15],[-17,21],[-13,28],[-5,34],[0,36],[5,37],[10,37],[12,34],
  [15,33],[20,32],[25,32],[30,31],[33,30],[35,28],[37,25],[40,22],
  [43,17],[48,12],[50,8],[45,2],[42,-1],[40,-5],[38,-8],[35,-12],
  [33,-18],[32,-22],[30,-28],[28,-33],[25,-34],[20,-35],[18,-34],
  [15,-28],[12,-22],[10,-15],[8,-5],[5,0],[2,5],[-2,5],[-5,5],
  [-8,5],[-10,7],[-15,10],[-17,12],[-17,15],
];

const EUROPE: [number, number][] = [
  [-10,36],[-9,38],[-9,43],[-2,44],[0,46],[-5,48],[-10,44],
  [-10,52],[-5,54],[0,51],[5,52],[5,55],[8,55],[8,58],[5,60],
  [5,62],[10,64],[15,66],[20,68],[25,70],[30,70],[32,68],
  [35,65],[40,62],[45,55],[42,50],[35,48],[30,46],[28,42],
  [25,38],[20,36],[15,38],[10,36],[5,36],[0,36],[-5,36],[-10,36],
];

const ASIA: [number, number][] = [
  [28,42],[30,46],[35,48],[42,50],[45,55],[50,58],[55,62],
  [60,65],[70,68],[80,72],[90,72],[100,72],[110,70],[120,68],
  [130,64],[140,62],[150,58],[155,55],[160,52],[155,48],
  [148,45],[142,42],[140,38],[135,35],[130,33],[128,30],
  [125,28],[122,25],[120,22],[118,18],[115,15],[110,12],
  [108,16],[105,12],[100,5],[98,2],[100,0],[104,-5],[106,-7],
  [108,-7],[110,-5],[115,-8],[120,-8],[115,-5],[108,0],
  [105,10],[100,13],[98,8],[95,8],[90,22],[88,25],[85,28],
  [82,22],[80,15],[78,10],[76,8],[74,10],[72,15],[70,20],
  [68,24],[65,25],[58,27],[55,28],[50,30],[48,28],[45,25],
  [40,28],[37,32],[35,35],[32,38],[28,42],
];

// India sub-shape
const INDIA: [number, number][] = [
  [68,24],[72,15],[74,10],[76,8],[78,10],[80,15],[82,22],
  [85,22],[88,22],[90,22],[92,20],[90,15],[85,10],[80,7],
  [78,8],[76,8],[74,10],[72,15],[68,24],
];

const NORTH_AMERICA: [number, number][] = [
  [-170,65],[-168,68],[-162,72],[-155,72],[-148,70],[-140,68],
  [-135,70],[-125,72],[-118,75],[-110,75],[-100,75],[-95,72],
  [-90,75],[-85,72],[-80,70],[-75,68],[-70,65],[-65,60],
  [-60,52],[-55,48],[-60,45],[-65,43],[-70,42],[-72,40],
  [-75,38],[-78,35],[-80,32],[-82,30],[-85,28],[-88,25],
  [-90,22],[-92,18],[-95,16],[-98,18],[-100,20],[-105,22],
  [-108,28],[-112,32],[-115,32],[-118,34],[-120,36],[-122,38],
  [-124,42],[-125,45],[-126,48],[-128,52],[-130,55],[-135,58],
  [-140,60],[-148,62],[-155,60],[-160,62],[-168,64],[-170,65],
];

const SOUTH_AMERICA: [number, number][] = [
  [-80,10],[-77,12],[-73,12],[-68,12],[-63,10],[-55,5],
  [-50,2],[-45,0],[-40,-2],[-38,-5],[-35,-8],[-35,-12],
  [-37,-15],[-38,-18],[-40,-22],[-43,-23],[-45,-24],
  [-48,-28],[-50,-30],[-52,-33],[-55,-38],[-58,-40],
  [-63,-42],[-65,-46],[-67,-50],[-68,-53],[-68,-55],
  [-70,-52],[-72,-48],[-73,-42],[-72,-38],[-71,-32],
  [-70,-25],[-70,-18],[-72,-15],[-75,-10],[-77,-5],
  [-78,0],[-80,5],[-80,10],
];

const AUSTRALIA: [number, number][] = [
  [114,-15],[118,-13],[123,-12],[128,-12],[132,-12],[135,-12],
  [138,-13],[140,-15],[142,-16],[145,-18],[148,-20],[150,-22],
  [152,-25],[153,-28],[152,-32],[150,-35],[148,-38],[145,-38],
  [142,-38],[138,-36],[135,-34],[132,-33],[128,-30],[125,-28],
  [120,-25],[118,-22],[115,-20],[114,-18],[114,-15],
];

const GREENLAND: [number, number][] = [
  [-52,60],[-48,60],[-42,62],[-35,65],[-25,68],[-20,70],
  [-18,73],[-20,76],[-25,78],[-30,80],[-38,82],[-45,82],
  [-52,80],[-55,78],[-58,75],[-55,70],[-52,65],[-52,60],
];

const JAPAN: [number, number][] = [
  [130,31],[132,33],[134,34],[136,35],[138,36],[140,38],
  [141,40],[142,42],[144,44],[145,45],
  [144,43],[142,40],[140,38],[138,35],[135,33],[132,31],[130,31],
];

const UK: [number, number][] = [
  [-6,50],[-5,52],[-4,54],[-5,56],[-3,58],[-2,57],[0,53],[1,52],[0,51],[-2,50],[-6,50],
];

const CONTINENTS = [AFRICA, EUROPE, ASIA, INDIA, NORTH_AMERICA, SOUTH_AMERICA, AUSTRALIA, GREENLAND, JAPAN, UK];

const DESERTS: { minLng: number; maxLng: number; minLat: number; maxLat: number }[] = [
  { minLng: -15, maxLng: 40, minLat: 16, maxLat: 30 },
  { minLng: 45, maxLng: 62, minLat: 16, maxLat: 32 },
  { minLng: 120, maxLng: 148, minLat: -28, maxLat: -20 },
  { minLng: 55, maxLng: 75, minLat: 28, maxLat: 42 },
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

export interface BiomeWeights {
  tropical: number;
  temperate: number;
  boreal: number;
  desert: number;
  polar: number;
}

export interface WorldMask {
  isLand: (lat: number, lng: number) => boolean;
  getBiome: (lat: number, lng: number) => string;
  getBiomeWeights: (lat: number, lng: number) => BiomeWeights;
}

function smoothTransition(value: number, center: number, width: number): number {
  return Math.max(0, 1 - Math.abs(value - center) / width);
}

function inDesert(lat: number, lng: number): number {
  for (const d of DESERTS) {
    const insideLng = Math.min((lng - d.minLng) / 5, (d.maxLng - lng) / 5);
    const insideLat = Math.min((lat - d.minLat) / 4, (d.maxLat - lat) / 4);
    if (insideLng > 0 && insideLat > 0) {
      return Math.min(1, Math.min(insideLng, insideLat));
    }
  }
  return 0;
}

export function createWorldMask(): WorldMask {
  function isLand(lat: number, lng: number): boolean {
    if (lat < -65) return true;  // Antarctica
    if (lat > 78) return true;   // Arctic ice
    for (const continent of CONTINENTS) {
      if (pointInPolygon(lng, lat, continent)) return true;
    }
    return false;
  }

  function getBiome(lat: number, lng: number): string {
    if (!isLand(lat, lng)) return 'ocean';
    const w = getBiomeWeights(lat, lng);
    let max = 0;
    let best = 'temperate';
    for (const [k, v] of Object.entries(w)) {
      if (v > max) { max = v; best = k; }
    }
    return best;
  }

  function getBiomeWeights(lat: number, lng: number): BiomeWeights {
    const absLat = Math.abs(lat);

    let tropical = smoothTransition(absLat, 10, 18);
    let temperate = smoothTransition(absLat, 38, 20);
    let boreal = smoothTransition(absLat, 58, 12);
    let polar = Math.max(0, (absLat - 62) / 15);
    let desert = inDesert(lat, lng);

    if (desert > 0) {
      tropical *= (1 - desert);
      temperate *= (1 - desert);
    }

    const total = tropical + temperate + boreal + polar + desert;
    if (total > 0) {
      tropical /= total;
      temperate /= total;
      boreal /= total;
      polar /= total;
      desert /= total;
    } else {
      temperate = 1;
    }

    return { tropical, temperate, boreal, desert, polar };
  }

  return { isLand, getBiome, getBiomeWeights };
}
