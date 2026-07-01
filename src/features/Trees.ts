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
  { biome: 'tropical',  count: 50, heightRange: [0.11, 0.18], widthRange: [0.065, 0.095], geoType: 'tropical',   maxHeight: 0.45 },
  { biome: 'temperate', count: 50, heightRange: [0.10, 0.15], widthRange: [0.055, 0.085], geoType: 'temperate',  maxHeight: 0.55 },
  { biome: 'boreal',    count: 50, heightRange: [0.11, 0.18], widthRange: [0.038, 0.055], geoType: 'boreal',     maxHeight: 0.65 },
  { biome: 'desert',    count: 8,  heightRange: [0.065, 0.095], widthRange: [0.038, 0.055], geoType: 'temperate', maxHeight: 0.40 },
  // Acacia: African savanna (sub-Saharan, real lng -20 to 55°E → our lng +20 to -55)
  { biome: 'desert',    count: 15, heightRange: [0.075, 0.105], widthRange: [0.045, 0.065], geoType: 'acacia',   maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -35 && lat < 20 && lng < 20 && lng > -55 },
  // Cactus: Sonoran / N American deserts (real lng 95-120°W → our lng +95 to +120)
  { biome: 'desert',    count: 8,  heightRange: [0.038, 0.055], widthRange: [0.015, 0.023], geoType: 'cactus',   maxHeight: 0.35,
    geoFilter: (lat, lng) => lat > 20 && lat < 38 && lng > 92 && lng < 122 },
  { biome: 'temperate', count: 25, heightRange: [0.12, 0.16], widthRange: [0.07, 0.095],  geoType: 'oak',        maxHeight: 0.55 },
  // Bamboo: East / SE Asia (real lng 95-145°E → our lng -95 to -145)
  { biome: 'tropical',  count: 20, heightRange: [0.14, 0.20], widthRange: [0.025, 0.04],  geoType: 'bamboo',     maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > 10 && lat < 45 && lng < -95 && lng > -148 },
  // Eucalyptus: Australia (real lng 113-154°E → our lng -113 to -154)
  { biome: 'temperate', count: 20, heightRange: [0.13, 0.18], widthRange: [0.04, 0.06],   geoType: 'eucalyptus', maxHeight: 0.50,
    geoFilter: (lat, lng) => lat > -40 && lat < -10 && lng < -113 && lng > -155 },
  // Baobab: Africa (real lng 10-50°E → our lng -10 to -50)
  { biome: 'desert',    count: 10, heightRange: [0.10, 0.14], widthRange: [0.07, 0.10],   geoType: 'baobab',     maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 15 && lng < -8 && lng > -52 },
  // Africa tropical mix — three species so the Congo basin / Sub-Saharan
  // tropics aren't all one tree. Density kept low so Africa overall
  // doesn't feel crowded; the global default tropical (count 50) already
  // sprays trees here.
  { biome: 'tropical',  count: 10, heightRange: [0.085, 0.115], widthRange: [0.05, 0.07],  geoType: 'acacia',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 18 && lng < -5 && lng > -50 },
  { biome: 'tropical',  count: 6,  heightRange: [0.11, 0.15], widthRange: [0.075, 0.105], geoType: 'baobab',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 15 && lng < -8 && lng > -50 },
  // Amazon basin tropical mix (real lng -75..-45 → codebase +45..+75,
  // lat -12..8). Bamboo (Guadua spp. is real here) + baobab as a
  // visual stand-in for kapok/ceiba — wide-trunk silhouette breaks up
  // the otherwise uniform default-tropical canopy.
  { biome: 'tropical',  count: 16, heightRange: [0.13, 0.19], widthRange: [0.025, 0.04],  geoType: 'bamboo',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -12 && lat < 8 && lng > 40 && lng < 78 },
  { biome: 'tropical',  count: 8,  heightRange: [0.12, 0.16], widthRange: [0.075, 0.105], geoType: 'baobab',   maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -12 && lat < 8 && lng > 40 && lng < 78 },
  { biome: 'boreal',    count: 35, heightRange: [0.12, 0.19], widthRange: [0.03, 0.045],  geoType: 'spruce',     maxHeight: 0.65 },
  // Cherry blossom: East Asia (real lng 100-145°E → our lng -100 to -145)
  { biome: 'temperate', count: 12, heightRange: [0.10, 0.14], widthRange: [0.06, 0.085],  geoType: 'cherry',     maxHeight: 0.50,
    geoFilter: (lat, lng) => lat > 25 && lat < 45 && lng < -100 && lng > -148 },
  // Olive: Mediterranean (real lng -10 to 40°E → our lng +10 to -40)
  { biome: 'desert',    count: 10, heightRange: [0.08, 0.12], widthRange: [0.05, 0.075],  geoType: 'olive',      maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > 28 && lat < 48 && lng > -40 && lng < 12 },
  // Sequoia: N America Pacific coast (real lng 115-125°W → our lng +115 to +125)
  { biome: 'temperate', count: 6,  heightRange: [0.16, 0.22], widthRange: [0.05, 0.07],   geoType: 'sequoia',    maxHeight: 0.55,
    geoFilter: (lat, lng) => lat > 35 && lat < 52 && lng > 113 && lng < 128 },
  // Birch: white trunks + autumn-gold canopy. Lives along the
  // temperate / taiga boundary across the northern hemisphere
  // (N Europe, Russia, Canada, NE US, Japan). Two configs so the
  // tree shows up in both temperate AND boreal biome cells nearby.
  { biome: 'boreal',    count: 30, heightRange: [0.12, 0.17], widthRange: [0.038, 0.058], geoType: 'birch',      maxHeight: 0.55,
    geoFilter: (lat, _lng) => lat > 45 && lat < 68 },
  { biome: 'temperate', count: 14, heightRange: [0.11, 0.15], widthRange: [0.035, 0.055], geoType: 'birch',      maxHeight: 0.50,
    geoFilter: (lat, _lng) => lat > 42 && lat < 55 },

  // ─── South America density boosts ────────────────────────────────
  // Amazon basin: dense tropical rainforest
  { biome: 'tropical',  count: 45, heightRange: [0.13, 0.20], widthRange: [0.07, 0.10],   geoType: 'tropical',   maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -18 && lat < 8 && lng > 35 && lng < 80 },
  // Patagonian / Andean temperate forests (S Chile / Argentina)
  { biome: 'temperate', count: 22, heightRange: [0.12, 0.17], widthRange: [0.04, 0.06],   geoType: 'spruce',     maxHeight: 0.55,
    geoFilter: (lat, lng) => lat > -55 && lat < -30 && lng > 60 && lng < 78 },
  // Brazilian cerrado / atlantic forest oaks
  { biome: 'temperate', count: 18, heightRange: [0.11, 0.16], widthRange: [0.055, 0.085], geoType: 'oak',        maxHeight: 0.45,
    geoFilter: (lat, lng) => lat > -28 && lat < -15 && lng > 40 && lng < 60 },
];

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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function shadeColor(color: THREE.Color, amount: number): THREE.Color {
  return new THREE.Color(
    clamp01(color.r + amount),
    clamp01(color.g + amount * 0.86),
    clamp01(color.b + amount * 0.62),
  );
}

function createFacetedRingGeometry(
  sides: number,
  rings: { y: number; rx: number; rz: number; x?: number; z?: number; twist?: number; jitter?: number }[],
  colors: THREE.Color[],
  seed: number,
  capTop = true,
  capBottom = true,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colorAttr: number[] = [];
  const indices: number[] = [];

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    const baseColor = colors[Math.min(colors.length - 1, ringIndex)];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (ring.twist ?? 0);
      const facet = 0.94 + Math.sin(i * 1.91 + seed + ringIndex * 0.73) * (ring.jitter ?? 0.06);
      positions.push(
        (ring.x ?? 0) + Math.cos(a) * ring.rx * facet,
        ring.y,
        (ring.z ?? 0) + Math.sin(a) * ring.rz * facet,
      );
      const c = shadeColor(baseColor, Math.sin(a - 0.7) * 0.08 + ringIndex * 0.004);
      colorAttr.push(c.r, c.g, c.b);
    }
  }

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const a = ringIndex * sides + i;
      const b = ringIndex * sides + next;
      const c = (ringIndex + 1) * sides + i;
      const d = (ringIndex + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  if (capBottom) {
    const center = positions.length / 3;
    const ring = rings[0];
    positions.push(ring.x ?? 0, ring.y, ring.z ?? 0);
    const c = colors[0];
    colorAttr.push(c.r, c.g, c.b);
    for (let i = 0; i < sides; i++) indices.push(center, i, (i + 1) % sides);
  }
  if (capTop) {
    const center = positions.length / 3;
    const ring = rings[rings.length - 1];
    positions.push(ring.x ?? 0, ring.y, ring.z ?? 0);
    const c = colors[colors.length - 1];
    colorAttr.push(c.r, c.g, c.b);
    const base = (rings.length - 1) * sides;
    for (let i = 0; i < sides; i++) indices.push(center, base + ((i + 1) % sides), base + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureMergeReady(geo);
}

function createFacetedBlobGeometry(
  radius: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  seed: number,
  flatten = 0.68,
): THREE.BufferGeometry {
  const rings: { y: number; rx: number; rz: number; x?: number; z?: number; twist?: number; jitter?: number }[] = [];
  const colors: THREE.Color[] = [];
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const width = Math.sin(t * Math.PI) * radius * (0.94 + Math.sin(seed + i * 1.7) * 0.08);
    rings.push({
      y: (t - 0.5) * radius * 2 * flatten,
      rx: Math.max(0.004, width * (1.06 + Math.sin(seed + i) * 0.08)),
      rz: Math.max(0.004, width * (0.86 + Math.cos(seed + i) * 0.07)),
      x: Math.sin(seed * 0.7 + i) * radius * 0.05,
      z: Math.cos(seed * 0.5 + i) * radius * 0.04,
      twist: i * 0.18 + seed * 0.04,
      jitter: 0.12,
    });
    colors.push(bottomColor.clone().lerp(topColor, t));
  }
  return createFacetedRingGeometry(9, rings, colors, seed);
}

function createRootPrismGeometry(length: number, width: number, height: number, color: THREE.Color): THREE.BufferGeometry {
  const w = width;
  const h = height;
  const l = length;
  const positions = [
    -w, 0, -w,  w, 0, -w,  w * 0.75, 0, l, -w * 0.55, 0, l,
    -w * 0.62, h, -w * 0.55, w * 0.62, h * 0.9, -w * 0.45, w * 0.35, h * 0.45, l * 0.92, -w * 0.28, h * 0.4, l * 0.9,
  ];
  const indices = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7, 4, 5, 7, 5, 6, 7, 0, 3, 1, 1, 3, 2];
  const colors: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const c = shadeColor(color, (i % 4 - 1.5) * 0.025);
    colors.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return ensureMergeReady(geo);
}

function createSculptedTrunk(height: number, width: number, seed: number): THREE.BufferGeometry {
  const base = Math.max(0.010, width * 0.26);
  return createFacetedRingGeometry(7, [
    { y: 0, rx: base * 1.22, rz: base * 0.96, x: -width * 0.02, twist: 0.0, jitter: 0.08 },
    { y: height * 0.28, rx: base * 0.98, rz: base * 0.78, x: width * 0.05, z: width * 0.02, twist: 0.08, jitter: 0.08 },
    { y: height * 0.58, rx: base * 0.72, rz: base * 0.62, x: width * 0.10, z: -width * 0.02, twist: 0.18, jitter: 0.08 },
    { y: height, rx: base * 0.48, rz: base * 0.40, x: -width * 0.04, z: -width * 0.04, twist: 0.30, jitter: 0.06 },
  ], [
    new THREE.Color('#6B4226'), new THREE.Color('#8D5D30'),
    new THREE.Color('#A06D3D'), new THREE.Color('#B4814C'),
  ], seed);
}

function createSculptedCanopyTreeGeometry(
  height: number,
  width: number,
  palette: { trunkSeed: number; low: string; mid: string; high: string; dark?: string },
): THREE.BufferGeometry {
  const trunkH = height * 0.62;
  const parts: THREE.BufferGeometry[] = [createSculptedTrunk(trunkH, width, palette.trunkSeed)];

  const low = new THREE.Color(palette.low);
  const mid = new THREE.Color(palette.mid);
  const high = new THREE.Color(palette.high);
  const dark = new THREE.Color(palette.dark ?? palette.low);
  const blobs = [
    { r: width * 0.52, p: [-width * 0.16, trunkH + width * 0.40, width * 0.02], s: [1.16, 0.82, 0.94], c0: dark, c1: mid, seed: palette.trunkSeed + 1 },
    { r: width * 0.44, p: [width * 0.26, trunkH + width * 0.52, -width * 0.05], s: [1.02, 0.72, 0.82], c0: low, c1: high, seed: palette.trunkSeed + 4 },
    { r: width * 0.36, p: [0, trunkH + width * 0.82, width * 0.10], s: [0.88, 0.66, 0.76], c0: mid, c1: high, seed: palette.trunkSeed + 8 },
  ];
  for (const b of blobs) {
    const blob = createFacetedBlobGeometry(b.r, b.c0, b.c1, b.seed);
    blob.scale(b.s[0], b.s[1], b.s[2]);
    blob.rotateY(b.seed * 0.11);
    blob.translate(b.p[0], b.p[1], b.p[2]);
    parts.push(blob);
  }

  return mergeGeometries(parts, false)!;
}

function createSculptedNeedleTreeGeometry(
  height: number,
  width: number,
  palette: { trunkSeed: number; low: string; mid: string; high: string },
): THREE.BufferGeometry {
  const trunkH = height * 0.32;
  const parts: THREE.BufferGeometry[] = [createSculptedTrunk(height * 0.78, width * 0.75, palette.trunkSeed)];
  const low = new THREE.Color(palette.low);
  const mid = new THREE.Color(palette.mid);
  const high = new THREE.Color(palette.high);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const blob = createFacetedBlobGeometry(width * (0.58 - t * 0.12), low.clone().lerp(mid, t), mid.clone().lerp(high, t), palette.trunkSeed + 12 + i, 0.42);
    blob.scale(1.18 - t * 0.15, 0.55 - t * 0.05, 0.92 - t * 0.12);
    blob.rotateY(i * 0.82);
    blob.translate(0, trunkH + height * (0.11 + i * 0.16), 0);
    parts.push(blob);
  }
  return mergeGeometries(parts, false)!;
}

/* ---------- tree geometry builders ---------- */

const TRUNK_BOTTOM = new THREE.Color('#6B4226');
const TRUNK_TOP = new THREE.Color('#A0784C');

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

// --- Tropical: sculpted multi-lobe canopy, not primitive spheres ---
function createTropicalTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createSculptedCanopyTreeGeometry(height, width, {
    trunkSeed: 11,
    dark: '#123B1E',
    low: '#1E5B2F',
    mid: '#2F8C45',
    high: '#64B45A',
  });
}

// --- Temperate: broad faceted crown integrated with roots ---
function createTemperateTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createSculptedCanopyTreeGeometry(height, width, {
    trunkSeed: 23,
    dark: '#1F4A24',
    low: '#2D642B',
    mid: '#4F8733',
    high: '#86B64A',
  });
}

// --- Boreal: stepped needle masses instead of stacked cones ---
function createBorealTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  return createSculptedNeedleTreeGeometry(height, width, {
    trunkSeed: 37,
    low: '#0B3020',
    mid: '#1B5631',
    high: '#4B8A4D',
  });
}

// --- Acacia: flat disk canopy ---
function createAcaciaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.015, 0.025, height, 12);
  trunk.translate(0, height / 2, 0);
  colorGeometryFlat(trunk, new THREE.Color('#A0784C'));

  const canopy = new THREE.CylinderGeometry(width / 2, width / 2 * 0.85, 0.05, 22);
  canopy.translate(0, height, 0);
  colorGeometryFlat(canopy, new THREE.Color('#5A8C32'));
  return mergeGeometries([ensureMergeReady(trunk), ensureMergeReady(canopy)], false)!;
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

// --- Oak: wide sculpted canopy, thick terrain-like base ---
function createOakGeometry(height: number, width: number): THREE.BufferGeometry {
  const tree = createSculptedCanopyTreeGeometry(height, width * 1.12, {
    trunkSeed: 41,
    dark: '#263F1D',
    low: '#315B20',
    mid: '#52772B',
    high: '#8B9B3B',
  });
  tree.scale(1.15, 0.95, 1.03);
  return tree;
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

// --- Eucalyptus: tall pale trunk, narrow cone canopy ---
function createEucalyptusGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.6;
  const trunk = createTrunk(trunkH, 0.035, 0.02, 6,
    new THREE.Color('#8B7355'), new THREE.Color('#C4A882'));

  const c1H = height * 0.35;
  const c1 = new THREE.ConeGeometry(width * 0.35, c1H, 16);
  c1.translate(0, trunkH + c1H * 0.4, 0);
  colorGeometry(c1,
    new THREE.Color('#3B6B3B'), new THREE.Color('#5A9A5A'),
    trunkH, trunkH + c1H);

  const c2H = height * 0.2;
  const c2 = new THREE.ConeGeometry(width * 0.2, c2H, 14);
  c2.translate(0, trunkH + c1H * 0.65 + c2H * 0.4, 0);
  colorGeometry(c2,
    new THREE.Color('#4A7A4A'), new THREE.Color('#6AAA6A'),
    trunkH + c1H * 0.5, trunkH + c1H * 0.5 + c2H);

  return mergeGeometries([trunk, ensureMergeReady(c1), ensureMergeReady(c2)], false)!;
}

// --- Baobab: massive trunk, tiny canopy ---
function createBaobabGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.7;
  const trunk = createTrunk(trunkH, width * 0.5, width * 0.35, 16,
    new THREE.Color('#6B4226'), new THREE.Color('#A08060'));

  const bulge = new THREE.SphereGeometry(width * 0.3, 18, 12);
  const bp = bulge.getAttribute('position');
  for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) * 0.4);
  bulge.translate(0, trunkH, 0);
  colorGeometryFlat(bulge, new THREE.Color('#9A7B5A'));

  const canopyR = width * 0.25;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 2);
  const cp = canopy.getAttribute('position');
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) * 0.6);
  canopy.translate(0, height * 0.85, 0);
  colorGeometry(canopy,
    new THREE.Color('#4A7A2A'), new THREE.Color('#6A9A4A'),
    height * 0.85 - canopyR * 0.6, height * 0.85 + canopyR * 0.6);

  return mergeGeometries([trunk, ensureMergeReady(bulge), ensureMergeReady(canopy)], false)!;
}

// --- Spruce: narrower/darker stepped needle tree ---
function createSpruceGeometry(height: number, width: number): THREE.BufferGeometry {
  const tree = createSculptedNeedleTreeGeometry(height, width * 0.92, {
    trunkSeed: 53,
    low: '#082519',
    mid: '#143D26',
    high: '#326A3A',
  });
  tree.scale(0.88, 1.12, 0.88);
  return tree;
}

// --- Cherry Blossom: pink canopy ---
function createCherryGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.03, 0.02, 12,
    new THREE.Color('#5A3A2A'), new THREE.Color('#7A5A4A'));
  const parts: THREE.BufferGeometry[] = [trunk];

  const r1 = width * 0.5;
  const r2 = width * 0.35;
  for (const { r, y, cBot, cTop } of [
    { r: r1, y: trunkH + width * 0.35, cBot: new THREE.Color('#E8A0B0'), cTop: new THREE.Color('#FFD0DD') },
    { r: r2, y: trunkH + width * 0.7,  cBot: new THREE.Color('#F0C0D0'), cTop: new THREE.Color('#FFE8F0') },
  ]) {
    const geo = new THREE.DodecahedronGeometry(r, 3);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.75);
    geo.translate(0, y, 0);
    colorGeometry(geo, cBot, cTop, y - r * 0.75, y + r * 0.75);
    parts.push(ensureMergeReady(geo));
  }
  return mergeGeometries(parts, false)!;
}

// --- Olive: silvery-green, asymmetric canopy ---
function createOliveGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.35;
  const trunkGeo = new THREE.CylinderGeometry(0.025, 0.04, trunkH, 14);
  // Gnarled trunk: perturb vertices
  const tp = trunkGeo.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const angle = Math.atan2(tp.getZ(i), tp.getX(i));
    const offset = Math.sin(angle * 3) * 0.005;
    tp.setX(i, tp.getX(i) + offset);
    tp.setZ(i, tp.getZ(i) + offset);
  }
  trunkGeo.translate(0, trunkH / 2, 0);
  colorGeometry(trunkGeo,
    new THREE.Color('#5A4A30'), new THREE.Color('#7A6A50'),
    0, trunkH);

  const c1R = width * 0.45;
  const c1 = new THREE.IcosahedronGeometry(c1R, 3);
  const c1p = c1.getAttribute('position');
  for (let i = 0; i < c1p.count; i++) c1p.setX(i, c1p.getX(i) * 1.2);
  c1.translate(0, trunkH + width * 0.3, 0);
  colorGeometry(c1,
    new THREE.Color('#6A7A5A'), new THREE.Color('#8A9A7A'),
    trunkH, trunkH + c1R * 2);

  const c2R = width * 0.3;
  const c2 = new THREE.IcosahedronGeometry(c2R, 2);
  c2.translate(width * 0.1, trunkH + width * 0.55, width * 0.05);
  colorGeometry(c2,
    new THREE.Color('#7A8A6A'), new THREE.Color('#9AAA8A'),
    trunkH + width * 0.3, trunkH + width * 0.8);

  return mergeGeometries([ensureMergeReady(trunkGeo), ensureMergeReady(c1), ensureMergeReady(c2)], false)!;
}

// --- Giant Sequoia: very tall reddish trunk, small top canopy ---
function createSequoiaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.75;
  const trunk = createTrunk(trunkH, 0.065, 0.04, 16,
    new THREE.Color('#6B2A1A'), new THREE.Color('#9B4A2A'));

  const canopyR = width * 0.35;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 3);
  const cp = canopy.getAttribute('position');
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) * 1.4);
  canopy.translate(0, height * 0.8, 0);
  colorGeometry(canopy,
    new THREE.Color('#1A4A1A'), new THREE.Color('#2A6A2A'),
    height * 0.8 - canopyR * 1.4, height * 0.8 + canopyR * 1.4);

  const topH = height * 0.12;
  const top = new THREE.ConeGeometry(width * 0.15, topH, 14);
  top.translate(0, height * 0.95, 0);
  colorGeometry(top,
    new THREE.Color('#2A5A2A'), new THREE.Color('#3A7A3A'),
    height * 0.95 - topH / 2, height * 0.95 + topH / 2);

  return mergeGeometries([trunk, ensureMergeReady(canopy), ensureMergeReady(top)], false)!;
}

// --- Birch: tall slim white trunk + warm autumn-gold canopy ---
function createBirchGeometry(height: number, width: number): THREE.BufferGeometry {
  // Slim, mostly-white trunk taking up the lower 60% of the tree.
  const trunkH = height * 0.6;
  const trunk = createTrunk(trunkH, 0.018, 0.012, 12,
    new THREE.Color('#D8CDB8'),  // warm ivory at the base
    new THREE.Color('#FAF6EE'));  // near-white at the top

  // Slender, slightly oblong canopy in warm autumn tones.
  const canopyR = width * 0.42;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 3);
  const cp = canopy.getAttribute('position');
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) * 1.35);
  const cy = trunkH + canopyR * 0.9;
  canopy.translate(0, cy, 0);
  colorGeometry(canopy,
    new THREE.Color('#C6892A'),  // amber base
    new THREE.Color('#F5D04A'),  // bright gold top
    cy - canopyR * 1.35, cy + canopyR * 1.35);

  return mergeGeometries([trunk, ensureMergeReady(canopy)], false)!;
}

/* ---------- material ---------- */

function createWindSwayMaterial(
  timeUniform: { value: number }
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 16,
    flatShading: false,
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
      vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
      // Linear in y (not y²). The previous y²×0.015 made the sway peak
      // at ~0.0006 for a 0.2-unit-tall tree, invisible on a globe of
      // radius 5. Linear y×0.07 gives a visible canopy swing while
      // keeping the trunk base anchored (y=0 ⇒ 0 sway).
      float swayAmount = transformed.y * 0.07;
      transformed.x += sin(uTime * 2.0 + worldPos4.x * 3.0 + worldPos4.z * 2.0) * swayAmount;
      transformed.z += cos(uTime * 1.7 + worldPos4.z * 3.0 + worldPos4.x * 2.0) * swayAmount;`
    );
  };

  return material;
}

/* ---------- placement ---------- */

const _up = new THREE.Vector3(0, 1, 0);

function densityGate(point: { position: THREE.Vector3; treeDensity?: number }): boolean {
  const density = point.treeDensity ?? 0.55;
  const hash = Math.sin(
    point.position.x * 91.73 + point.position.y * 37.21 + point.position.z * 53.11,
  ) * 0.5 + 0.5;
  return hash < Math.max(0.08, density);
}

function placeTrees(
  points: { position: THREE.Vector3; normal: THREE.Vector3; height: number; mountain?: number; treeDensity?: number }[],
  geometry: THREE.BufferGeometry,
  material: THREE.MeshPhongMaterial,
  count: number,
): THREE.InstancedMesh {
  const shuffled = points.sort(() => Math.random() - 0.5);
  const actual = Math.min(count, shuffled.length);
  const mesh = new THREE.InstancedMesh(geometry, material, actual);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < actual; i++) {
    const point = shuffled[i];
    const normal = point.normal.clone().normalize();

    const altitude = Math.max(0, Math.min(1, point.height / 0.55));
    const mountain = Math.max(0, Math.min(1, point.mountain ?? 0));
    const expose = Math.max(0.45, 1.0 - altitude * 0.48 - mountain * 0.20);
    const buryDepth = 0.010 + altitude * 0.025 + mountain * 0.018;

    dummy.position.copy(point.position).addScaledVector(normal, -buryDepth);
    dummy.quaternion.setFromUnitVectors(_up, normal);

    const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    dummy.quaternion.premultiply(yRot);

    const scaleY = (0.82 + Math.random() * 0.28) * expose;
    const scaleXZ = (0.86 + Math.random() * 0.24) * (0.86 + expose * 0.18);
    dummy.scale.set(scaleXZ, scaleY, scaleXZ);

    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
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

    for (const config of BIOME_CONFIGS) {
      const biomePoints = terrainData.landPoints.filter((p) => {
        if (p.biome !== config.biome) return false;
        if (p.height <= 0.05 || p.height >= (config.maxHeight ?? 1.0)) return false;
        if (!densityGate(p)) return false;
        if (config.geoFilter) {
          const n = p.normal;
          const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
          const lng = Math.atan2(n.z, n.x) * 180 / Math.PI;
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
