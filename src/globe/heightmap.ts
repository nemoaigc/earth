// Load NASA bump map and provide height sampling

let _heightData: Uint8ClampedArray | null = null;
let _width = 0;
let _height = 0;
let _ready = false;

export function loadHeightmap(): Promise<void> {
  return new Promise((resolve) => {
    if (_ready) { resolve(); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      _heightData = imageData.data;
      _width = img.width;
      _height = img.height;
      _ready = true;
      console.log(`[heightmap] Loaded ${_width}x${_height}`);
      resolve();
    };
    img.onerror = () => {
      console.warn('[heightmap] Failed to load, using flat terrain');
      _ready = true;
      resolve();
    };
    img.src = '/earth-bump.png';
  });
}

/**
 * Sample elevation at lat/lng. Returns 0-1 (0=ocean floor, 1=Everest).
 */
export function sampleElevation(lat: number, lng: number): number {
  if (!_heightData) return 0;
  // Equirectangular: lng -180..180 → x 0..width, lat 90..-90 → y 0..height
  const x = Math.floor(((lng + 180) / 360) * _width) % _width;
  const y = Math.floor(((90 - lat) / 180) * _height);
  const yc = Math.max(0, Math.min(_height - 1, y));
  const idx = (yc * _width + x) * 4; // RGBA
  return _heightData[idx] / 255; // R channel = grayscale
}
