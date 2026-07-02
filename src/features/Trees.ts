import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BiomeConfig {
  biome: string;
  count: number;
  heightRange: [number, number];
  widthRange: [number, number];
  geoType: 'tropical' | 'temperate' | 'boreal' | 'acacia' | 'cactus'
    | 'oak' | 'bamboo' | 'eucalyptus' | 'baobab' | 'spruce' | 'cherry' | 'olive' | 'sequoia'
    | 'birch';
  /** max terrain heightNorm — trees don't appear above this elevation */
  maxHeight?: number;
  /** optional lat/lng bounding box filter (lng is negated: eastern hemisphere = negative) */
  geoFilter?: (lat: number, lng: number) => boolean;
}

// Lng note: atan2(nz, nx) in this codebase gives NEGATED real longitude
// (eastern hemisphere = negative, western = positive).
// So E Asia 100-145°E → lng -100 to -145; W Americas 95-125°W → lng +95 to +125.

const BIOME_CONFIGS: BiomeConfig[] = [
  { biome: 'tropical',  count: 95,  heightRange: [0.115, 0.170], widthRange: [0.052, 0.080], geoType: 'tropical',   maxHeight: 0.45 },
  { biome: 'temperate', count: 95,  heightRange: [0.105, 0.155], widthRange: [0.048, 0.072], geoType: 'temperate',  maxHeight: 0.55 },
  { biome: 'boreal',    count: 130, heightRange: [0.115, 0.180], widthRange: [0.034, 0.052], geoType: 'boreal',     maxHeight: 0.65 },
  { biome: 'desert',    count: 0,   heightRange: [0.070, 0.100], widthRange: [0.036, 0.050], geoType: 'temperate', maxHeight: 0.40 },
  // Acacia: African savanna (sub-Saharan, real lng -20 to 55°E → our lng +20 to -55)
  { biome: 'desert',    count: 16,  heightRange: [0.120, 0.165], widthRange: [0.065, 0.095], geoType: 'acacia',   maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -35 && lat < 20 && lng < 20 && lng > -55 && !(lat > 12 && lng < -34) },
  // Cactus: Sonoran / N American deserts (real lng 95-120°W → our lng +95 to +120)
  { biome: 'desert',    count: 10,  heightRange: [0.055, 0.080], widthRange: [0.014, 0.022], geoType: 'cactus',   maxHeight: 0.35,
    geoFilter: (lat, lng) => lat > 20 && lat < 38 && lng > 92 && lng < 122 },
  { biome: 'temperate', count: 28, heightRange: [0.130, 0.185], widthRange: [0.065, 0.095],  geoType: 'oak',        maxHeight: 0.55 },
  // Bamboo: East / SE Asia (real lng 95-145°E → our lng -95 to -145)
  { biome: 'tropical',  count: 32, heightRange: [0.130, 0.190], widthRange: [0.025, 0.040],  geoType: 'bamboo',     maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > 10 && lat < 45 && lng < -95 && lng > -148 },
  // Eucalyptus: Australia (real lng 113-154°E → our lng -113 to -154)
  { biome: 'temperate', count: 24, heightRange: [0.140, 0.200], widthRange: [0.040, 0.060],   geoType: 'eucalyptus', maxHeight: 0.50,
    geoFilter: (lat, lng) => lat > -40 && lat < -10 && lng < -113 && lng > -155 },
  // Baobab: Africa (real lng 10-50°E → our lng -10 to -50)
  { biome: 'desert',    count: 8,   heightRange: [0.120, 0.170], widthRange: [0.080, 0.110],   geoType: 'baobab',     maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 15 && lng < -8 && lng > -52 && !(lat > 10 && lng < -34) },
  // Africa tropical mix — three species so the Congo basin / Sub-Saharan
  // tropics aren't all one tree. Density kept low so Africa overall
  // doesn't feel crowded; the global default tropical (count 50) already
  // sprays trees here.
  { biome: 'tropical',  count: 12,  heightRange: [0.110, 0.160], widthRange: [0.060, 0.088],  geoType: 'acacia',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 18 && lng < -5 && lng > -50 && !(lat > 12 && lng < -34) },
  { biome: 'tropical',  count: 6,  heightRange: [0.120, 0.165], widthRange: [0.080, 0.110], geoType: 'baobab',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 15 && lng < -8 && lng > -50 && !(lat > 10 && lng < -34) },
  // Amazon basin tropical accent (real lng -75..-45 → codebase +45..+75,
  // lat -12..8). Keep this sparse: the global tropical layer already covers
  // South America, so regional species should break silhouette, not carpet it.
  { biome: 'tropical',  count: 8, heightRange: [0.125, 0.180], widthRange: [0.024, 0.038],  geoType: 'bamboo',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -12 && lat < 8 && lng > 40 && lng < 78 },
  { biome: 'boreal',    count: 80, heightRange: [0.135, 0.210], widthRange: [0.034, 0.052],  geoType: 'spruce',     maxHeight: 0.65 },
  // Cherry blossom: East Asia (real lng 100-145°E → our lng -100 to -145)
  { biome: 'temperate', count: 10,  heightRange: [0.115, 0.165], widthRange: [0.060, 0.085],  geoType: 'cherry',     maxHeight: 0.50,
    geoFilter: (lat, lng) => lat > 25 && lat < 45 && lng < -100 && lng > -148 },
  // Olive: Mediterranean (real lng -10 to 40°E → our lng +10 to -40)
  { biome: 'desert',    count: 10,  heightRange: [0.100, 0.145], widthRange: [0.055, 0.080],  geoType: 'olive',      maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > 28 && lat < 48 && lng > -40 && lng < 12 },
  // Sequoia: N America Pacific coast (real lng 115-125°W → our lng +115 to +125)
  { biome: 'temperate', count: 8,  heightRange: [0.165, 0.235], widthRange: [0.045, 0.064],   geoType: 'sequoia',    maxHeight: 0.55,
    geoFilter: (lat, lng) => lat > 35 && lat < 52 && lng > 113 && lng < 128 },
  // Birch: white trunks + autumn-gold canopy. Lives along the
  // temperate / taiga boundary across the northern hemisphere
  // (N Europe, Russia, Canada, NE US, Japan). Two configs so the
  // tree shows up in both temperate AND boreal biome cells nearby.
  { biome: 'boreal',    count: 46, heightRange: [0.115, 0.165], widthRange: [0.038, 0.055], geoType: 'birch',      maxHeight: 0.55,
    geoFilter: (lat, _lng) => lat > 45 && lat < 68 },
  { biome: 'temperate', count: 24,  heightRange: [0.110, 0.155], widthRange: [0.036, 0.052], geoType: 'birch',      maxHeight: 0.50,
    geoFilter: (lat, _lng) => lat > 42 && lat < 55 },

  // ─── South America regional accents ───────────────────────────────
  // The terrain colour already carries the forest mass. Extra 3D trees should
  // signal the biome without turning South America into a bristly carpet.
  { biome: 'tropical',  count: 24,  heightRange: [0.115, 0.175], widthRange: [0.055, 0.085],   geoType: 'tropical',   maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -18 && lat < 8 && lng > 35 && lng < 80 },
  // Patagonian / Andean temperate forests (S Chile / Argentina)
  { biome: 'temperate', count: 12, heightRange: [0.130, 0.190], widthRange: [0.034, 0.052],   geoType: 'spruce',     maxHeight: 0.55,
    geoFilter: (lat, lng) => lat > -55 && lat < -30 && lng > 60 && lng < 78 },
  // Brazilian cerrado / atlantic forest oaks
  { biome: 'temperate', count: 6, heightRange: [0.110, 0.160], widthRange: [0.055, 0.080], geoType: 'oak',        maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -28 && lat < -15 && lng > 40 && lng < 60 },
];

interface ForestPatchConfig {
  biome: string;
  count: number;
  radiusRange: [number, number];
  colorDark: string;
  colorLight: string;
  maxHeight?: number;
  geoFilter?: (lat: number, lng: number) => boolean;
}

// Disabled for now: this layer reads as detached tree crowns on steep terrain.
// Keep forest mass in terrain colour; visible 3D vegetation should be grounded trees.
const FOREST_PATCH_CONFIGS: ForestPatchConfig[] = [];

/* ---------- helpers ---------- */

function colorGeometry(
  geo: THREE.BufferGeometry,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  minY: number,
  maxY: number,
): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const range = maxY - minY || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) - minY) / range));
    tmp.lerpColors(bottomColor, topColor, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function colorGeometryFlat(geo: THREE.BufferGeometry, color: THREE.Color): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function ensureMergeReady(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

type CanopyProfileRing = { t: number; r: number; x?: number; z?: number };

function createIconCanopyGeometry(
  height: number,
  radius: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  options: {
    radialSegments?: number;
    profile?: CanopyProfileRing[];
    zScale?: number;
    wobble?: number;
    shoulder?: number;
    aoFloor?: number;
  } = {},
): THREE.BufferGeometry {
  const radialSegments = options.radialSegments ?? 9;
  const shoulder = options.shoulder ?? 0.16;
  const aoFloor = options.aoFloor ?? 0.24;
  const zScale = options.zScale ?? 0.92;
  const wobbleStrength = options.wobble ?? 0.035;

  const profile = options.profile ?? [
    { t: 0.00, r: 0.42 },
    { t: 0.13, r: 0.76 },
    { t: 0.32, r: 1.00 },
    { t: 0.55, r: 0.94 + shoulder * 0.10 },
    { t: 0.76, r: 0.68 },
    { t: 0.91, r: 0.32 },
    { t: 1.00, r: 0.08 },
  ];

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmp = new THREE.Color();

  for (let ringIndex = 0; ringIndex < profile.length; ringIndex += 1) {
    const ring = profile[ringIndex];
    const t = ring.t;
    tmp.lerpColors(bottomColor, topColor, t);
    const ao = THREE.MathUtils.lerp(aoFloor, 1, Math.min(1, t * 1.75));
    tmp.multiplyScalar(ao);

    for (let i = 0; i < radialSegments; i += 1) {
      const a = (i / radialSegments) * Math.PI * 2;
      const wobble = 1
        + Math.sin(i * 1.71 + ringIndex * 0.83) * wobbleStrength
        + Math.cos(i * 2.29 - ringIndex * 0.51) * wobbleStrength * 0.74;
      positions.push(
        Math.cos(a) * radius * ring.r * wobble + (ring.x ?? 0) * radius,
        t * height,
        Math.sin(a) * radius * ring.r * wobble * zScale + (ring.z ?? 0) * radius,
      );
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let ringIndex = 0; ringIndex < profile.length - 1; ringIndex += 1) {
    const current = ringIndex * radialSegments;
    const next = (ringIndex + 1) * radialSegments;
    for (let i = 0; i < radialSegments; i += 1) {
      const a = current + i;
      const b = current + ((i + 1) % radialSegments);
      const c = next + i;
      const d = next + ((i + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const bottomCenter = positions.length / 3;
  const bottomRing = profile[0];
  positions.push((bottomRing.x ?? 0) * radius, 0, (bottomRing.z ?? 0) * radius);
  colors.push(bottomColor.r * aoFloor, bottomColor.g * aoFloor, bottomColor.b * aoFloor);
  for (let i = 0; i < radialSegments; i += 1) {
    indices.push(bottomCenter, i, (i + 1) % radialSegments);
  }

  const topCenter = positions.length / 3;
  const topRing = profile[profile.length - 1];
  positions.push((topRing.x ?? 0) * radius, height, (topRing.z ?? 0) * radius);
  colors.push(topColor.r, topColor.g, topColor.b);
  const topStart = (profile.length - 1) * radialSegments;
  for (let i = 0; i < radialSegments; i += 1) {
    indices.push(topCenter, topStart + ((i + 1) % radialSegments), topStart + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureMergeReady(geo);
}

function createNeedleCanopyGeometry(
  height: number,
  width: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers = [
    { y: 0.17, sy: 0.17, sx: 0.82, sz: 0.68, ox: -0.05, oz: 0.02 },
    { y: 0.35, sy: 0.16, sx: 0.66, sz: 0.58, ox: 0.05,  oz: -0.03 },
    { y: 0.52, sy: 0.15, sx: 0.50, sz: 0.46, ox: -0.03, oz: 0.03 },
    { y: 0.68, sy: 0.13, sx: 0.34, sz: 0.32, ox: 0.03,  oz: -0.02 },
    { y: 0.82, sy: 0.11, sx: 0.22, sz: 0.22, ox: -0.01, oz: 0.01 },
  ];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.getAttribute('position');
    const squash = 0.86 + Math.sin(i * 1.7) * 0.04;
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v);
      // Keep every bough slightly tapered upward without ending in a hard spike.
      const taper = 1 - Math.max(0, y) * 0.16;
      p.setX(v, p.getX(v) * width * tier.sx * taper);
      p.setY(v, p.getY(v) * height * tier.sy * squash);
      p.setZ(v, p.getZ(v) * width * tier.sz * taper);
    }
    geo.rotateY(i * 0.42);
    geo.translate(width * tier.ox, height * tier.y, width * tier.oz);
    const shade = i / (tiers.length - 1);
    colorGeometry(
      geo,
      bottomColor.clone().lerp(topColor, shade * 0.35),
      bottomColor.clone().lerp(topColor, 0.58 + shade * 0.34),
      height * (tier.y - tier.sy),
      height * (tier.y + tier.sy),
    );
    parts.push(ensureMergeReady(geo));
  }

  return mergeGeometries(parts, false)!;
}

function createForestPatchGeometry(darkColor: THREE.Color, lightColor: THREE.Color): THREE.BufferGeometry {
  const radialSegments = 11;
  const positions: number[] = [0, 0.0018, 0];
  const colors: number[] = [lightColor.r, lightColor.g, lightColor.b];
  const indices: number[] = [];

  for (let i = 0; i < radialSegments; i++) {
    const a = (i / radialSegments) * Math.PI * 2;
    const r = 0.82 + Math.sin(i * 1.71) * 0.11 + Math.cos(i * 2.37) * 0.07;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const edgeMix = 0.24 + (Math.sin(i * 2.13) * 0.5 + 0.5) * 0.10;
    const c = darkColor.clone().lerp(lightColor, edgeMix);
    positions.push(x, Math.sin(i * 1.3) * 0.0008, z);
    colors.push(c.r, c.g, c.b);
  }

  for (let i = 0; i < radialSegments; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % radialSegments));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureMergeReady(geo);
}

/* ---------- tree geometry builders ---------- */

const TRUNK_BOTTOM = new THREE.Color('#302719');
const TRUNK_TOP = new THREE.Color('#5A4B2E');
const DEFAULT_TRUNK_BOTTOM_RATIO = 0.13;
const DEFAULT_TRUNK_TOP_RATIO = 0.085;
const DEFAULT_TRUNK_MIN_BOTTOM = 0.006;
const DEFAULT_TRUNK_MIN_TOP = 0.004;

const TROPICAL_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.55 }, { t: 0.14, r: 0.92, z: 0.03 },
  { t: 0.33, r: 1.10, x: -0.03 }, { t: 0.54, r: 1.02, x: 0.04, z: -0.02 },
  { t: 0.74, r: 0.72 }, { t: 0.90, r: 0.32 }, { t: 1.00, r: 0.07 },
];
const TEMPERATE_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.36 }, { t: 0.18, r: 0.72 }, { t: 0.40, r: 0.96 },
  { t: 0.63, r: 0.78 }, { t: 0.84, r: 0.36 }, { t: 1.00, r: 0.06 },
];
const OAK_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.62 }, { t: 0.17, r: 1.05 }, { t: 0.40, r: 1.15 },
  { t: 0.64, r: 0.88 }, { t: 0.84, r: 0.42 }, { t: 1.00, r: 0.08 },
];
const ACACIA_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.18 }, { t: 0.16, r: 0.64 }, { t: 0.28, r: 1.25 },
  { t: 0.42, r: 1.35 }, { t: 0.58, r: 1.08 }, { t: 0.72, r: 0.45 },
  { t: 1.00, r: 0.04 },
];
const EUCALYPTUS_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.30 }, { t: 0.22, r: 0.58, x: 0.04 }, { t: 0.48, r: 0.62, x: -0.03 },
  { t: 0.72, r: 0.42, x: 0.03 }, { t: 0.92, r: 0.18 }, { t: 1.00, r: 0.05 },
];
const BAOBAB_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.26 }, { t: 0.20, r: 0.78 }, { t: 0.45, r: 0.92 },
  { t: 0.65, r: 0.70 }, { t: 0.84, r: 0.32 }, { t: 1.00, r: 0.05 },
];
const CHERRY_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.46 }, { t: 0.18, r: 0.86 }, { t: 0.42, r: 1.04 },
  { t: 0.64, r: 0.88 }, { t: 0.84, r: 0.48 }, { t: 1.00, r: 0.08 },
];
const OLIVE_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.50 }, { t: 0.18, r: 0.96, x: -0.08 },
  { t: 0.42, r: 1.08, x: 0.08, z: -0.04 }, { t: 0.62, r: 0.82, x: 0.02 },
  { t: 0.82, r: 0.36, x: -0.04 }, { t: 1.00, r: 0.06 },
];
const BIRCH_CANOPY: CanopyProfileRing[] = [
  { t: 0.00, r: 0.34 }, { t: 0.20, r: 0.68 }, { t: 0.48, r: 0.78 },
  { t: 0.72, r: 0.50 }, { t: 0.92, r: 0.20 }, { t: 1.00, r: 0.05 },
];

function createTrunk(
  height: number,
  radiusBottom: number,
  radiusTop: number,
  segments = 12,
  bottomCol = TRUNK_BOTTOM,
  topCol = TRUNK_TOP,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  geo.translate(0, height / 2, 0);
  colorGeometry(geo, bottomCol, topCol, 0, height);
  return ensureMergeReady(geo);
}

function createAnchoredTreeGeometry(
  canopy: THREE.BufferGeometry,
  trunkHeight: number,
  trunkRadiusBottom: number,
  trunkRadiusTop: number,
  canopyLiftRatio = 0.72,
  trunkBottom = TRUNK_BOTTOM,
  trunkTop = TRUNK_TOP,
): THREE.BufferGeometry {
  const trunk = createTrunk(
    trunkHeight,
    Math.max(DEFAULT_TRUNK_MIN_BOTTOM, trunkRadiusBottom),
    Math.max(DEFAULT_TRUNK_MIN_TOP, trunkRadiusTop),
    7,
    trunkBottom,
    trunkTop,
  );
  canopy.translate(0, trunkHeight * canopyLiftRatio, 0);
  return mergeGeometries([trunk, canopy].map(ensureMergeReady), false)!;
}

function createPolygonCardGeometry(
  points: [number, number][],
  bottomColor: THREE.Color,
  topColor: THREE.Color,
): THREE.BufferGeometry {
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const centerX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const centerY = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const range = maxY - minY || 1;

  const positions = [centerX, centerY, 0];
  const colors: number[] = [];
  const centerColor = bottomColor.clone().lerp(topColor, (centerY - minY) / range);
  colors.push(centerColor.r, centerColor.g, centerColor.b);

  for (const [x, y] of points) {
    const c = bottomColor.clone().lerp(topColor, Math.max(0, Math.min(1, (y - minY) / range)));
    positions.push(x, y, 0);
    colors.push(c.r, c.g, c.b);
  }

  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    indices.push(0, i + 1, ((i + 1) % points.length) + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureMergeReady(geo);
}

function crossCard(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const card = mergeGeometries(parts.map(ensureMergeReady), false)!;
  const crossed = card.clone();
  crossed.rotateY(Math.PI / 2);
  return mergeGeometries([card, crossed].map(ensureMergeReady), false)!;
}

function createBroadleafSilhouetteGeometry(
  height: number,
  width: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  trunkRatio = 0.32,
  trunkWidthRatio = 0.12,
): THREE.BufferGeometry {
  const trunkH = height * trunkRatio;
  const trunkW = Math.max(0.004, width * trunkWidthRatio);
  const canopyBase = trunkH * 0.62;
  const trunk = createPolygonCardGeometry(
    [[-trunkW, 0], [trunkW, 0], [trunkW * 0.72, trunkH], [-trunkW * 0.72, trunkH]],
    TRUNK_BOTTOM,
    TRUNK_TOP,
  );
  const canopy = createPolygonCardGeometry(
    [
      [0, height],
      [width * 0.34, height * 0.90],
      [width * 0.58, height * 0.68],
      [width * 0.44, height * 0.42],
      [width * 0.16, canopyBase],
      [-width * 0.16, canopyBase],
      [-width * 0.44, height * 0.42],
      [-width * 0.58, height * 0.68],
      [-width * 0.34, height * 0.90],
    ],
    bottomColor,
    topColor,
  );
  return crossCard([trunk, canopy]);
}

function createConiferSilhouetteGeometry(
  height: number,
  width: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
): THREE.BufferGeometry {
  const trunkH = height * 0.30;
  const trunkW = Math.max(0.0035, width * 0.085);
  const trunk = createPolygonCardGeometry(
    [[-trunkW, 0], [trunkW, 0], [trunkW * 0.72, trunkH], [-trunkW * 0.72, trunkH]],
    TRUNK_BOTTOM,
    TRUNK_TOP,
  );
  const lower = createPolygonCardGeometry(
    [[0, height * 0.72], [width * 0.72, height * 0.24], [-width * 0.72, height * 0.24]],
    bottomColor,
    bottomColor.clone().lerp(topColor, 0.56),
  );
  const mid = createPolygonCardGeometry(
    [[0, height * 0.90], [width * 0.52, height * 0.42], [-width * 0.52, height * 0.42]],
    bottomColor.clone().lerp(topColor, 0.12),
    bottomColor.clone().lerp(topColor, 0.78),
  );
  const top = createPolygonCardGeometry(
    [[0, height], [width * 0.34, height * 0.61], [-width * 0.34, height * 0.61]],
    bottomColor.clone().lerp(topColor, 0.24),
    topColor,
  );
  return crossCard([trunk, lower, mid, top]);
}

function createAcaciaSilhouetteGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.58;
  const trunkW = Math.max(0.004, width * 0.10);
  const trunk = createPolygonCardGeometry(
    [[-trunkW, 0], [trunkW, 0], [trunkW * 0.56, trunkH], [-trunkW * 0.56, trunkH]],
    TRUNK_BOTTOM,
    TRUNK_TOP,
  );
  const canopy = createPolygonCardGeometry(
    [
      [-width * 0.82, height * 0.56],
      [-width * 0.52, height * 0.75],
      [-width * 0.08, height * 0.82],
      [width * 0.46, height * 0.76],
      [width * 0.84, height * 0.58],
      [width * 0.54, height * 0.43],
      [-width * 0.48, height * 0.43],
    ],
    new THREE.Color('#4A5F27'),
    new THREE.Color('#9BA84A'),
  );
  return crossCard([trunk, canopy]);
}

function createBaobabSilhouetteGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.70;
  const trunkW = Math.max(0.006, width * 0.22);
  const trunk = createPolygonCardGeometry(
    [[-trunkW, 0], [trunkW, 0], [trunkW * 0.62, trunkH], [-trunkW * 0.62, trunkH]],
    new THREE.Color('#4A3927'),
    new THREE.Color('#7A6847'),
  );
  const canopy = createPolygonCardGeometry(
    [
      [0, height],
      [width * 0.42, height * 0.91],
      [width * 0.54, height * 0.75],
      [width * 0.22, height * 0.64],
      [-width * 0.22, height * 0.64],
      [-width * 0.54, height * 0.75],
      [-width * 0.42, height * 0.91],
    ],
    new THREE.Color('#4A6728'),
    new THREE.Color('#8FA14A'),
  );
  return crossCard([trunk, canopy]);
}

function createRoundedCrownTreeGeometry(
  height: number,
  width: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  trunkRatio = 0.30,
  radiusRatio = 0.64,
  trunkBottom = TRUNK_BOTTOM,
  trunkTop = TRUNK_TOP,
  trunkRadiusBottomRatio = DEFAULT_TRUNK_BOTTOM_RATIO,
  trunkRadiusTopRatio = DEFAULT_TRUNK_TOP_RATIO,
  canopyOptions: Parameters<typeof createIconCanopyGeometry>[4] = {},
): THREE.BufferGeometry {
  const trunkH = height * trunkRatio;
  const canopyH = height * (1 - trunkRatio * 0.38);
  const trunk = createTrunk(
    trunkH,
    Math.max(DEFAULT_TRUNK_MIN_BOTTOM, width * trunkRadiusBottomRatio),
    Math.max(DEFAULT_TRUNK_MIN_TOP, width * trunkRadiusTopRatio),
    7,
    trunkBottom,
    trunkTop,
  );
  const canopy = createIconCanopyGeometry(canopyH, width * radiusRatio, bottomColor, topColor, {
    radialSegments: 9,
    shoulder: Math.max(0.08, Math.min(0.28, radiusRatio - 0.48)),
    ...canopyOptions,
  });
  canopy.translate(0, trunkH - trunkH * 0.18, 0);
  return mergeGeometries([trunk, canopy].map(ensureMergeReady), false)!;
}

function createTieredConiferTreeGeometry(
  height: number,
  width: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
): THREE.BufferGeometry {
  const canopy = createNeedleCanopyGeometry(height * 0.86, width,
    bottomColor,
    topColor,
  );
  return createAnchoredTreeGeometry(
    canopy,
    height * 0.24,
    width * DEFAULT_TRUNK_BOTTOM_RATIO,
    width * DEFAULT_TRUNK_TOP_RATIO,
    0.22,
  );
}

// --- Tropical: single iconic canopy, dense and broad without blob clusters ---
function createTropicalTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#143A20'), new THREE.Color('#78B85B'), 0.27, 0.74,
    TRUNK_BOTTOM, TRUNK_TOP, DEFAULT_TRUNK_BOTTOM_RATIO, DEFAULT_TRUNK_TOP_RATIO,
    { profile: TROPICAL_CANOPY, zScale: 1.02, wobble: 0.055 });
}

// --- Temperate: calm teardrop crown in the shared diorama icon language ---
function createTemperateTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#244D25'), new THREE.Color('#8EB852'), 0.31, 0.64,
    TRUNK_BOTTOM, TRUNK_TOP, DEFAULT_TRUNK_BOTTOM_RATIO, DEFAULT_TRUNK_TOP_RATIO,
    { profile: TEMPERATE_CANOPY, zScale: 0.90, wobble: 0.035 });
}

// --- Boreal: slimmer northern conifer icon for Siberia / Canada / Scandinavia ---
function createBorealTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createTieredConiferTreeGeometry(height, width,
    new THREE.Color('#153B28'), new THREE.Color('#5F8B55'),
  );
}

// --- Acacia: flat disk canopy ---
function createAcaciaGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#4A5F27'), new THREE.Color('#9BA84A'), 0.46, 0.82,
    TRUNK_BOTTOM, TRUNK_TOP, 0.18, 0.115,
    { profile: ACACIA_CANOPY, zScale: 0.62, wobble: 0.040 });
}

// --- Cactus ---
function createCactusGeometry(height: number, _width: number): THREE.BufferGeometry {
  const gc = new THREE.Color('#5A8C32');
  function makeArm(h: number, rTop: number, rBot: number): THREE.BufferGeometry {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 12);
    colorGeometryFlat(g, gc);
    return g;
  }
  const trunk = makeArm(height, 0.035, 0.04);
  trunk.translate(0, height / 2, 0);
  const armL = makeArm(height * 0.4, 0.022, 0.026);
  armL.rotateZ(Math.PI / 4);
  armL.translate(-0.04, height * 0.6, 0);
  const armR = makeArm(height * 0.4, 0.022, 0.026);
  armR.rotateZ(-Math.PI / 4);
  armR.translate(0.04, height * 0.55, 0);
  return mergeGeometries([trunk, armL, armR].map(ensureMergeReady), false)!;
}

// --- Oak: broader temperate crown without separate bulb lobes ---
function createOakGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#2F4B1D'), new THREE.Color('#93A84D'), 0.34, 0.76,
    TRUNK_BOTTOM, TRUNK_TOP, 0.16, 0.105,
    { profile: OAK_CANOPY, zScale: 0.95, wobble: 0.045 });
}

// --- Bamboo: thin stalk with node ring, small leaf tuft ---
function createBambooGeometry(height: number, width: number): THREE.BufferGeometry {
  const lowerH = height * 0.5;
  const lower = new THREE.CylinderGeometry(0.008, 0.012, lowerH, 12);
  lower.translate(0, lowerH / 2, 0);
  colorGeometryFlat(lower, new THREE.Color('#5A7A3A'));

  const upperH = height * 0.35;
  const upper = new THREE.CylinderGeometry(0.006, 0.009, upperH, 12);
  upper.translate(0, lowerH + upperH / 2, 0);
  colorGeometryFlat(upper, new THREE.Color('#6B8B4A'));

  const ring = new THREE.CylinderGeometry(0.012, 0.012, height * 0.02, 12);
  ring.translate(0, lowerH, 0);
  colorGeometryFlat(ring, new THREE.Color('#4A6A2A'));

  const leafR = width * 0.4;
  const leaf = new THREE.IcosahedronGeometry(leafR, 2);
  const lp = leaf.getAttribute('position');
  for (let i = 0; i < lp.count; i++) {
    lp.setY(i, lp.getY(i) * 0.5);
    lp.setX(i, lp.getX(i) * 1.3);
  }
  leaf.translate(0, height * 0.9, 0);
  colorGeometry(leaf,
    new THREE.Color('#3D8B2E'), new THREE.Color('#6BBF4A'),
    height * 0.9 - leafR * 0.5, height * 0.9 + leafR * 0.5);

  return mergeGeometries([lower, upper, ring, leaf].map(ensureMergeReady), false)!;
}

// --- Eucalyptus: tall pale trunk, narrow off-centre crown ---
function createEucalyptusGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#315A3B'), new THREE.Color('#82A56D'), 0.40, 0.48,
    new THREE.Color('#5B5540'), new THREE.Color('#8A8265'), DEFAULT_TRUNK_BOTTOM_RATIO, DEFAULT_TRUNK_TOP_RATIO,
    { profile: EUCALYPTUS_CANOPY, zScale: 0.62, wobble: 0.030 });
}

// --- Baobab: massive trunk, tiny canopy ---
function createBaobabGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#4A6728'), new THREE.Color('#8FA14A'), 0.56, 0.72,
    new THREE.Color('#4A3927'), new THREE.Color('#7A6847'), 0.32, 0.22,
    { profile: BAOBAB_CANOPY, zScale: 0.90, wobble: 0.038 });
}

// --- Spruce: dark, narrow northern accent ---
function createSpruceGeometry(height: number, width: number): THREE.BufferGeometry {
  return createTieredConiferTreeGeometry(height, width,
    new THREE.Color('#123222'), new THREE.Color('#557B49'),
  );
}

// --- Cherry Blossom: pink canopy ---
function createCherryGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#D98AA0'), new THREE.Color('#FFE3EC'), 0.30, 0.70,
    TRUNK_BOTTOM, TRUNK_TOP, DEFAULT_TRUNK_BOTTOM_RATIO, DEFAULT_TRUNK_TOP_RATIO,
    { profile: CHERRY_CANOPY, zScale: 0.95, wobble: 0.025 });
}

// --- Olive: silvery-green, asymmetric canopy ---
function createOliveGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#5D6F52'), new THREE.Color('#A2AA80'), 0.40, 0.70,
    TRUNK_BOTTOM, TRUNK_TOP, 0.17, 0.12,
    { profile: OLIVE_CANOPY, zScale: 0.70, wobble: 0.070 });
}

// --- Giant Sequoia: extra-tall dark conifer accent ---
function createSequoiaGeometry(height: number, width: number): THREE.BufferGeometry {
  return createTieredConiferTreeGeometry(height, width,
    new THREE.Color('#143824'), new THREE.Color('#587D4B'),
  );
}

// --- Birch: tall slim white trunk + warm autumn-gold canopy ---
function createBirchGeometry(height: number, width: number): THREE.BufferGeometry {
  return createRoundedCrownTreeGeometry(height, width,
    new THREE.Color('#B87826'), new THREE.Color('#F4D45B'), 0.38, 0.54,
    new THREE.Color('#817A65'), new THREE.Color('#C8C0A8'), DEFAULT_TRUNK_BOTTOM_RATIO, DEFAULT_TRUNK_TOP_RATIO,
    { profile: BIRCH_CANOPY, zScale: 0.82, wobble: 0.026 });
}

/* ---------- material ---------- */

function createWindSwayMaterial(
  timeUniform: { value: number }
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 8,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  material.color.set(0xffffff);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 instancePos4 = vec4(position, 1.0);
      #ifdef USE_INSTANCING
      instancePos4 = instanceMatrix * instancePos4;
      #endif
      vec4 worldPos4 = modelMatrix * instancePos4;
      // Height-weighted canopy sway: rooted base, soft top motion.
      float swayAmount = transformed.y * transformed.y * 0.080;
      transformed.x += sin(uTime * 1.45 + worldPos4.x * 3.0 + worldPos4.z * 2.7) * swayAmount;
      transformed.z += cos(uTime * 1.05 + worldPos4.z * 2.4 + worldPos4.x * 1.9) * swayAmount * 0.72;`
    );
  };

  return material;
}

/* ---------- placement ---------- */

const _up = new THREE.Vector3(0, 1, 0);
const _leanRef = new THREE.Vector3(0.37, 0.91, 0.17);

type PlantPoint = TerrainData['landPoints'][number];

function pointLatLng(point: { normal: THREE.Vector3 }): { lat: number; lng: number } {
  const n = point.normal;
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI,
    lng: Math.atan2(n.z, n.x) * 180 / Math.PI,
  };
}

function densityGate(point: { position: THREE.Vector3; treeDensity?: number }): boolean {
  const density = point.treeDensity ?? 0.55;
  const hash = Math.sin(
    point.position.x * 91.73 + point.position.y * 37.21 + point.position.z * 53.11,
  ) * 0.5 + 0.5;
  return hash < Math.max(0.08, density);
}

function createForestPatchMaterial(): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    shininess: 0,
    flatShading: true,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.color.set(0xffffff);
  return material;
}

function placeForestPatches(
  points: PlantPoint[],
  geometry: THREE.BufferGeometry,
  material: THREE.MeshPhongMaterial,
  count: number,
  radiusRange: [number, number],
): THREE.InstancedMesh {
  const shuffled = points.sort(() => Math.random() - 0.5);
  const actual = Math.min(count, shuffled.length);
  const mesh = new THREE.InstancedMesh(geometry, material, actual);
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.matrixAutoUpdate = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < actual; i++) {
    const point = shuffled[i];
    const normal = point.normal.clone().normalize();
    const radius = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0]);
    const stretch = 0.76 + Math.random() * 0.58;

    dummy.position.copy(point.position).addScaledVector(normal, 0.0015 + point.height * 0.004);
    dummy.quaternion.setFromUnitVectors(_up, normal);
    const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    dummy.quaternion.premultiply(yRot);
    dummy.scale.set(radius * stretch, 1, radius * (1.18 - (stretch - 0.76) * 0.35));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.updateMatrix();
  mesh.computeBoundingSphere();
  return mesh;
}

function placeTrees(
  points: PlantPoint[],
  geometry: THREE.BufferGeometry,
  material: THREE.MeshPhongMaterial,
  count: number,
): THREE.InstancedMesh {
  const shuffled = points.sort(() => Math.random() - 0.5);
  const actual = Math.min(count, shuffled.length);
  const mesh = new THREE.InstancedMesh(geometry, material, actual);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.matrixAutoUpdate = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < actual; i++) {
    const point = shuffled[i];
    const normal = point.normal.clone().normalize();

    const altitude = Math.max(0, Math.min(1, point.height / 0.55));
    const mountain = Math.max(0, Math.min(1, point.mountain ?? 0));
    const surfaceLift = 0.0035 + mountain * 0.004 + altitude * 0.002;

    // The geometry's base is at local y=0. Keep that base on the terrain
    // normal instead of burying it into high ground; otherwise short trees
    // become "just a crown" or disappear on ridges.
    dummy.position.copy(point.position).addScaledVector(normal, surfaceLift);
    dummy.quaternion.setFromUnitVectors(_up, normal);

    const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    dummy.quaternion.premultiply(yRot);

    const tangent = new THREE.Vector3().crossVectors(normal, _leanRef);
    if (tangent.lengthSq() > 0.0001) {
      tangent.normalize();
      const lean = new THREE.Quaternion().setFromAxisAngle(tangent, (Math.random() - 0.30) * 0.060);
      dummy.quaternion.premultiply(lean);
    }

    const terrainScale = Math.max(0.78, 1.0 - altitude * 0.10 - mountain * 0.08);
    const scaleY = (0.72 + Math.random() * 0.55) * terrainScale;
    const scaleBase = (0.80 + Math.random() * 0.30) * (0.96 + Math.random() * 0.08);
    const crownStretch = 0.78 + Math.random() * 0.44;
    dummy.scale.set(scaleBase * crownStretch, scaleY, scaleBase * (1.30 - crownStretch * 0.24));

    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.updateMatrix();
  mesh.computeBoundingSphere();
  return mesh;
}

/* ---------- main class ---------- */

export class Trees {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];
  private materials: THREE.MeshPhongMaterial[] = [];
  private timeUniform: { value: number };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    this.timeUniform = { value: 0 };

    for (const config of FOREST_PATCH_CONFIGS) {
      const patchPoints = terrainData.landPoints.filter((p) => {
        if (p.biome !== config.biome) return false;
        if (p.height <= 0.04 || p.height >= (config.maxHeight ?? 1.0)) return false;
        if (p.mountain > 0.72 || p.treeDensity < 0.18) return false;
        if (!densityGate(p)) return false;
        if (config.geoFilter) {
          const { lat, lng } = pointLatLng(p);
          if (!config.geoFilter(lat, lng)) return false;
        }
        return true;
      });
      if (patchPoints.length === 0) continue;

      const patchGeometry = createForestPatchGeometry(
        new THREE.Color(config.colorDark),
        new THREE.Color(config.colorLight),
      );
      const patchMaterial = createForestPatchMaterial();
      const patchMesh = placeForestPatches(
        patchPoints,
        patchGeometry,
        patchMaterial,
        config.count,
        config.radiusRange,
      );
      this.meshes.push(patchMesh);
      this.materials.push(patchMaterial);
      this.group.add(patchMesh);
    }

    for (const config of BIOME_CONFIGS) {
      const biomePoints = terrainData.landPoints.filter((p) => {
        if (p.biome !== config.biome) return false;
        if (p.height <= 0.05 || p.height >= (config.maxHeight ?? 1.0)) return false;
        if (!densityGate(p)) return false;
        if (config.geoFilter) {
          const { lat, lng } = pointLatLng(p);
          if (!config.geoFilter(lat, lng)) return false;
        }
        return true;
      });
      if (biomePoints.length === 0) continue;

      const count = Math.min(config.count, biomePoints.length);
      if (count <= 0) continue;

      const height =
        config.heightRange[0] +
        Math.random() * (config.heightRange[1] - config.heightRange[0]);
      const width =
        config.widthRange[0] +
        Math.random() * (config.widthRange[1] - config.widthRange[0]);

      let geometry: THREE.BufferGeometry;
      switch (config.geoType) {
        case 'tropical':   geometry = createTropicalTreeGeometry(height, width); break;
        case 'temperate':  geometry = createTemperateTreeGeometry(height, width); break;
        case 'boreal':     geometry = createBorealTreeGeometry(height, width); break;
        case 'acacia':     geometry = createAcaciaGeometry(height, width); break;
        case 'cactus':     geometry = createCactusGeometry(height, width); break;
        case 'oak':        geometry = createOakGeometry(height, width); break;
        case 'bamboo':     geometry = createBambooGeometry(height, width); break;
        case 'eucalyptus': geometry = createEucalyptusGeometry(height, width); break;
        case 'baobab':     geometry = createBaobabGeometry(height, width); break;
        case 'spruce':     geometry = createSpruceGeometry(height, width); break;
        case 'cherry':     geometry = createCherryGeometry(height, width); break;
        case 'olive':      geometry = createOliveGeometry(height, width); break;
        case 'sequoia':    geometry = createSequoiaGeometry(height, width); break;
        case 'birch':      geometry = createBirchGeometry(height, width); break;
      }

      const material = createWindSwayMaterial(this.timeUniform);

      const mesh = placeTrees(biomePoints, geometry, material, count);
      this.meshes.push(mesh);
      this.materials.push(material);
      this.group.add(mesh);
    }
  }

  update(time: number): void {
    this.timeUniform.value = time;
  }
}
