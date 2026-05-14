import { createNoise3D } from 'simplex-noise';

// Deterministic seed so terrain looks identical on every page load.
// Mulberry32 PRNG seeded with a fixed constant; simplex-noise uses it to
// build its permutation table once at module load.
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TERRAIN_SEED = 0xEA12_7D_03; // fixed
const noise3D = createNoise3D(mulberry32(TERRAIN_SEED));

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
