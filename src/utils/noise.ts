import { createNoise3D } from 'simplex-noise';

const noise3D = createNoise3D();

export function sampleNoise(
  x: number, y: number, z: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  persistence: number = 0.5,
  scale: number = 1.0
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

export { noise3D };
