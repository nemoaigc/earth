import * as THREE from 'three';

export type VisualPresetId = 'a' | 'b' | 'c';

interface ColorTransform {
  tint: THREE.Color;
  tintStrength: number;
  saturation: number;
  lightness: number;
  lift: number;
}

export interface OceanShaderStyle {
  deepColor: THREE.Color;
  midColor: THREE.Color;
  glowColor: THREE.Color;
  lineColor: THREE.Color;
  lineIntensity: number;
  sparkleIntensity: number;
  fresnelIntensity: number;
  fresnelPower: number;
  waveScale: number;
  bandSteps: number;
  daylightBoost: number;
}

export interface VisualPreset {
  id: VisualPresetId;
  label: string;
  shortLabel: 'A' | 'B' | 'C';
  clearColor: THREE.Color;
  sky: ColorTransform;
  fog: ColorTransform & { nearScale: number; farScale: number };
  atmosphere: ColorTransform & { intensity: number };
  ocean: OceanShaderStyle;
}

const PRESETS: Record<VisualPresetId, VisualPreset> = {
  a: {
    id: 'a',
    shortLabel: 'A',
    label: 'Coast-Aware + Fresnel',
    clearColor: new THREE.Color('#315d84'),
    sky: {
      tint: new THREE.Color('#8fc0e3'),
      tintStrength: 0.12,
      saturation: 0.86,
      lightness: 1.08,
      lift: 0.03,
    },
    fog: {
      tint: new THREE.Color('#8db9da'),
      tintStrength: 0.16,
      saturation: 0.82,
      lightness: 1.1,
      lift: 0.02,
      nearScale: 1,
      farScale: 1.03,
    },
    atmosphere: {
      tint: new THREE.Color('#b5dcff'),
      tintStrength: 0.22,
      saturation: 0.9,
      lightness: 1.14,
      lift: 0.03,
      intensity: 0.18,
    },
    ocean: {
      deepColor: new THREE.Color('#1d4f86'),
      midColor: new THREE.Color('#3f93ca'),
      glowColor: new THREE.Color('#f1fbff'),
      lineColor: new THREE.Color('#8fd7ff'),
      lineIntensity: 0.08,
      sparkleIntensity: 0.54,
      fresnelIntensity: 0.16,
      fresnelPower: 2.1,
      waveScale: 1,
      bandSteps: 0,
      daylightBoost: 0.06,
    },
  },
  b: {
    id: 'b',
    shortLabel: 'B',
    label: 'Toon + Sparkle',
    clearColor: new THREE.Color('#4d7da0'),
    sky: {
      tint: new THREE.Color('#b6e0ff'),
      tintStrength: 0.2,
      saturation: 1.02,
      lightness: 1.18,
      lift: 0.06,
    },
    fog: {
      tint: new THREE.Color('#a8dfff'),
      tintStrength: 0.24,
      saturation: 1.05,
      lightness: 1.18,
      lift: 0.05,
      nearScale: 0.96,
      farScale: 1.08,
    },
    atmosphere: {
      tint: new THREE.Color('#d9f1ff'),
      tintStrength: 0.28,
      saturation: 1.02,
      lightness: 1.2,
      lift: 0.06,
      intensity: 0.28,
    },
    ocean: {
      deepColor: new THREE.Color('#2574b5'),
      midColor: new THREE.Color('#61c7eb'),
      glowColor: new THREE.Color('#fff7c9'),
      lineColor: new THREE.Color('#d9f9ff'),
      lineIntensity: 0.16,
      sparkleIntensity: 0.9,
      fresnelIntensity: 0.23,
      fresnelPower: 1.65,
      waveScale: 1.14,
      bandSteps: 5,
      daylightBoost: 0.12,
    },
  },
  c: {
    id: 'c',
    shortLabel: 'C',
    label: 'Hybrid',
    clearColor: new THREE.Color('#3f6c8d'),
    sky: {
      tint: new THREE.Color('#9fd0f0'),
      tintStrength: 0.16,
      saturation: 0.92,
      lightness: 1.12,
      lift: 0.04,
    },
    fog: {
      tint: new THREE.Color('#95c5e0'),
      tintStrength: 0.18,
      saturation: 0.9,
      lightness: 1.13,
      lift: 0.03,
      nearScale: 0.98,
      farScale: 1.05,
    },
    atmosphere: {
      tint: new THREE.Color('#c6e5ff'),
      tintStrength: 0.24,
      saturation: 0.95,
      lightness: 1.16,
      lift: 0.04,
      intensity: 0.23,
    },
    ocean: {
      deepColor: new THREE.Color('#1d5e96'),
      midColor: new THREE.Color('#49add8'),
      glowColor: new THREE.Color('#f5fbff'),
      lineColor: new THREE.Color('#a6e2ff'),
      lineIntensity: 0.11,
      sparkleIntensity: 0.66,
      fresnelIntensity: 0.18,
      fresnelPower: 1.95,
      waveScale: 1.04,
      bandSteps: 0,
      daylightBoost: 0.08,
    },
  },
};

const _hsl = { h: 0, s: 0, l: 0 };

export function getVisualPreset(id?: string | null): VisualPreset {
  if (!id) return PRESETS.c;
  const normalized = id.toLowerCase() as VisualPresetId;
  return PRESETS[normalized] ?? PRESETS.c;
}

export function adjustColor(base: THREE.Color, transform: ColorTransform, out: THREE.Color): THREE.Color {
  out.copy(base).lerp(transform.tint, transform.tintStrength);
  out.getHSL(_hsl);
  _hsl.s = THREE.MathUtils.clamp(_hsl.s * transform.saturation, 0, 1);
  _hsl.l = THREE.MathUtils.clamp(_hsl.l * transform.lightness + transform.lift, 0, 1);
  return out.setHSL(_hsl.h, _hsl.s, _hsl.l);
}
