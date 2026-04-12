// World map mask using NASA Blue Marble texture
// Loads a real equirectangular earth image and samples it per-vertex

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
  getColor: (lat: number, lng: number) => [number, number, number];
  ready: boolean;
}

let maskInstance: WorldMask | null = null;

export function createWorldMask(): WorldMask {
  if (maskInstance) return maskInstance;

  // Load earth texture onto canvas for pixel sampling
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let imageData: ImageData | null = null;
  let width = 0;
  let height = 0;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    imageData = ctx.getImageData(0, 0, img.width, img.height);
    width = img.width;
    height = img.height;
    mask.ready = true;
  };
  img.src = '/earth-color.jpg';

  function samplePixel(lat: number, lng: number): [number, number, number] {
    if (!imageData) return [30, 100, 200]; // default ocean blue
    // Equirectangular: lng -180..180 → x 0..width, lat 90..-90 → y 0..height
    const x = Math.floor(((lng + 180) / 360) * width) % width;
    const y = Math.floor(((90 - lat) / 180) * height);
    const yc = Math.max(0, Math.min(height - 1, y));
    const idx = (yc * width + x) * 4;
    return [imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]];
  }

  function isLand(lat: number, lng: number): boolean {
    const [r, g, b] = samplePixel(lat, lng);
    // Ocean is blue-dominant: b > r and b > g significantly
    // Land has higher red or green relative to blue
    if (b > r + 30 && b > g + 10) return false; // ocean
    // Very dark = deep ocean
    if (r + g + b < 80) return false;
    return true;
  }

  function getBiome(lat: number, lng: number): string {
    if (!isLand(lat, lng)) return 'ocean';
    const [r, g, b] = samplePixel(lat, lng);
    const absLat = Math.abs(lat);

    // White/bright = snow/ice (polar or high altitude)
    if (r > 200 && g > 200 && b > 200) return 'polar';
    // Very bright with high r and g = desert/sand
    if (r > 180 && g > 150 && b < 120) return 'desert';
    // Yellowish/tan = desert
    if (r > 150 && g > 120 && b < 100 && r > g) return 'desert';
    // Dark green = tropical forest
    if (g > r && g > 60 && absLat < 25) return 'tropical';
    // High latitude + dark = boreal
    if (absLat > 50 && g > 40) return 'boreal';
    // Default green = temperate
    return 'temperate';
  }

  function getBiomeWeights(lat: number, lng: number): BiomeWeights {
    const biome = getBiome(lat, lng);
    // Return dominant biome with slight blending at boundaries
    const w: BiomeWeights = { tropical: 0, temperate: 0, boreal: 0, desert: 0, polar: 0 };
    if (biome === 'ocean') { w.temperate = 1; return w; }
    (w as any)[biome] = 0.8;
    // Blend with latitude-based neighbor
    const absLat = Math.abs(lat);
    if (absLat < 20) w.tropical = Math.max(w.tropical, 0.2);
    else if (absLat < 50) w.temperate = Math.max(w.temperate, 0.2);
    else if (absLat < 70) w.boreal = Math.max(w.boreal, 0.2);
    else w.polar = Math.max(w.polar, 0.2);
    // Normalize
    const total = w.tropical + w.temperate + w.boreal + w.desert + w.polar;
    w.tropical /= total; w.temperate /= total; w.boreal /= total;
    w.desert /= total; w.polar /= total;
    return w;
  }

  function getColor(lat: number, lng: number): [number, number, number] {
    return samplePixel(lat, lng);
  }

  const mask: WorldMask = { isLand, getBiome, getBiomeWeights, getColor, ready: false };
  maskInstance = mask;
  return mask;
}

// Synchronous version: pre-load the image and wait
export function createWorldMaskSync(): Promise<WorldMask> {
  const mask = createWorldMask();
  return new Promise((resolve) => {
    if (mask.ready) { resolve(mask); return; }
    const check = setInterval(() => {
      if (mask.ready) { clearInterval(check); resolve(mask); }
    }, 50);
  });
}
