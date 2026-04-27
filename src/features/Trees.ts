import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BiomeConfig {
  biome: string;
  count: number;
  heightRange: [number, number];
  widthRange: [number, number];
  geoType: 'tropical' | 'temperate' | 'boreal' | 'acacia' | 'cactus'
    | 'oak' | 'bamboo' | 'eucalyptus' | 'baobab' | 'spruce' | 'cherry' | 'olive' | 'sequoia';
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
  { biome: 'desert',    count: 12, heightRange: [0.075, 0.105], widthRange: [0.045, 0.065], geoType: 'acacia',   maxHeight: 0.45,
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
  { biome: 'desert',    count: 8,  heightRange: [0.10, 0.14], widthRange: [0.07, 0.10],   geoType: 'baobab',     maxHeight: 0.40,
    geoFilter: (lat, lng) => lat > -25 && lat < 15 && lng < -8 && lng > -52 },
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

/* ---------- tree geometry builders ---------- */

const TRUNK_BOTTOM = new THREE.Color('#6B4226');
const TRUNK_TOP = new THREE.Color('#A0784C');

function createTrunk(
  height: number,
  radiusBottom: number,
  radiusTop: number,
  segments = 6,
  bottomCol = TRUNK_BOTTOM,
  topCol = TRUNK_TOP,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  geo.translate(0, height / 2, 0);
  colorGeometry(geo, bottomCol, topCol, 0, height);
  return ensureMergeReady(geo);
}

// --- Tropical: 2 bushy dodecahedron canopy ---
function createTropicalTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.4;
  const trunk = createTrunk(trunkH, 0.04, 0.025);
  const parts: THREE.BufferGeometry[] = [trunk];

  const r1 = width * 0.5;
  const r2 = r1 * 0.72;
  const layers = [
    { r: r1, y: trunkH + r1 * 0.75 },
    { r: r2, y: trunkH + r1 * 1.45 },
  ];
  for (const layer of layers) {
    const sphere = new THREE.DodecahedronGeometry(layer.r, 1);
    sphere.translate(0, layer.y, 0);
    colorGeometry(sphere,
      new THREE.Color(0.15, 0.45, 0.1),
      new THREE.Color(0.35, 0.75, 0.2),
      layer.y - layer.r, layer.y + layer.r);
    parts.push(ensureMergeReady(sphere));
  }
  return mergeGeometries(parts, false)!;
}

// --- Temperate: ellipsoid canopy on trunk ---
function createTemperateTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.4;
  const trunk = createTrunk(trunkH, 0.035, 0.02);

  const canopyR = width * 0.5;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 1);
  const pos = canopy.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * 1.3);
  const cy = trunkH + canopyR * 0.9;
  canopy.translate(0, cy, 0);
  colorGeometry(canopy,
    new THREE.Color(0.2, 0.5, 0.12),
    new THREE.Color(0.45, 0.82, 0.25),
    cy - canopyR * 1.3, cy + canopyR * 1.3);
  return mergeGeometries([trunk, ensureMergeReady(canopy)], false)!;
}

// --- Boreal: 3 layered cones ---
function createBorealTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.2;
  const trunk = createTrunk(trunkH, 0.025, 0.016);
  const parts: THREE.BufferGeometry[] = [trunk];

  const canopyH = height - trunkH;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const layerH = canopyH * (0.48 - t * 0.1);
    const layerR = width * (0.55 - t * 0.15);
    const cone = new THREE.ConeGeometry(layerR, layerH, 6);
    const yPos = trunkH + canopyH * (i / 3) * 0.85 + layerH * 0.5;
    cone.translate(0, yPos, 0);
    colorGeometry(cone,
      new THREE.Color(0.08, 0.32 + t * 0.05, 0.08),
      new THREE.Color(0.18, 0.55 + t * 0.08, 0.15),
      yPos - layerH / 2, yPos + layerH / 2);
    parts.push(ensureMergeReady(cone));
  }
  return mergeGeometries(parts, false)!;
}

// --- Acacia: flat disk canopy ---
function createAcaciaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.015, 0.025, height, 6);
  trunk.translate(0, height / 2, 0);
  colorGeometryFlat(trunk, new THREE.Color('#A0784C'));

  const canopy = new THREE.CylinderGeometry(width / 2, width / 2 * 0.85, 0.05, 8);
  canopy.translate(0, height, 0);
  colorGeometryFlat(canopy, new THREE.Color('#5A8C32'));
  return mergeGeometries([ensureMergeReady(trunk), ensureMergeReady(canopy)], false)!;
}

// --- Cactus ---
function createCactusGeometry(height: number, _width: number): THREE.BufferGeometry {
  const gc = new THREE.Color('#5A8C32');
  function makeArm(h: number, rTop: number, rBot: number): THREE.BufferGeometry {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 6);
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

// --- Oak: wide flattened canopy, thick trunk ---
function createOakGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.35;
  const trunk = createTrunk(trunkH, 0.045, 0.03);
  const parts: THREE.BufferGeometry[] = [trunk];

  const r1 = width * 0.6;
  const r2 = width * 0.4;
  for (const { r, y } of [
    { r: r1, y: trunkH + width * 0.3 },
    { r: r2, y: trunkH + width * 0.7 },
  ]) {
    const geo = new THREE.DodecahedronGeometry(r, 1);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * 0.7);
    geo.translate(0, y, 0);
    colorGeometry(geo,
      new THREE.Color('#2D5A1E'), new THREE.Color('#4A8C2A'),
      y - r * 0.7, y + r * 0.7);
    parts.push(ensureMergeReady(geo));
  }
  return mergeGeometries(parts, false)!;
}

// --- Bamboo: thin stalk with node ring, small leaf tuft ---
function createBambooGeometry(height: number, width: number): THREE.BufferGeometry {
  const lowerH = height * 0.5;
  const lower = new THREE.CylinderGeometry(0.008, 0.012, lowerH, 6);
  lower.translate(0, lowerH / 2, 0);
  colorGeometryFlat(lower, new THREE.Color('#5A7A3A'));

  const upperH = height * 0.35;
  const upper = new THREE.CylinderGeometry(0.006, 0.009, upperH, 6);
  upper.translate(0, lowerH + upperH / 2, 0);
  colorGeometryFlat(upper, new THREE.Color('#6B8B4A'));

  const ring = new THREE.CylinderGeometry(0.012, 0.012, height * 0.02, 6);
  ring.translate(0, lowerH, 0);
  colorGeometryFlat(ring, new THREE.Color('#4A6A2A'));

  const leafR = width * 0.4;
  const leaf = new THREE.IcosahedronGeometry(leafR, 0);
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
  const c1 = new THREE.ConeGeometry(width * 0.35, c1H, 7);
  c1.translate(0, trunkH + c1H * 0.4, 0);
  colorGeometry(c1,
    new THREE.Color('#3B6B3B'), new THREE.Color('#5A9A5A'),
    trunkH, trunkH + c1H);

  const c2H = height * 0.2;
  const c2 = new THREE.ConeGeometry(width * 0.2, c2H, 7);
  c2.translate(0, trunkH + c1H * 0.65 + c2H * 0.4, 0);
  colorGeometry(c2,
    new THREE.Color('#4A7A4A'), new THREE.Color('#6AAA6A'),
    trunkH + c1H * 0.5, trunkH + c1H * 0.5 + c2H);

  return mergeGeometries([trunk, ensureMergeReady(c1), ensureMergeReady(c2)], false)!;
}

// --- Baobab: massive trunk, tiny canopy ---
function createBaobabGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.7;
  const trunk = createTrunk(trunkH, width * 0.5, width * 0.35, 7,
    new THREE.Color('#6B4226'), new THREE.Color('#A08060'));

  const bulge = new THREE.SphereGeometry(width * 0.3, 6, 4);
  const bp = bulge.getAttribute('position');
  for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) * 0.4);
  bulge.translate(0, trunkH, 0);
  colorGeometryFlat(bulge, new THREE.Color('#9A7B5A'));

  const canopyR = width * 0.25;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 0);
  const cp = canopy.getAttribute('position');
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) * 0.6);
  canopy.translate(0, height * 0.85, 0);
  colorGeometry(canopy,
    new THREE.Color('#4A7A2A'), new THREE.Color('#6A9A4A'),
    height * 0.85 - canopyR * 0.6, height * 0.85 + canopyR * 0.6);

  return mergeGeometries([trunk, ensureMergeReady(bulge), ensureMergeReady(canopy)], false)!;
}

// --- Spruce: narrower/darker than boreal, 3 tighter cones ---
function createSpruceGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.15;
  const trunk = createTrunk(trunkH, 0.02, 0.012);
  const parts: THREE.BufferGeometry[] = [trunk];

  const canopyH = height - trunkH;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const layerH = canopyH * (0.5 - t * 0.12);
    const layerR = width * (0.5 - t * 0.15);
    const cone = new THREE.ConeGeometry(layerR, layerH, 6);
    const yPos = trunkH + canopyH * (i / 3) * 0.85 + layerH * 0.5;
    cone.translate(0, yPos, 0);
    colorGeometry(cone,
      new THREE.Color(0.04, 0.23 + t * 0.04, 0.04),
      new THREE.Color(0.1, 0.38 + t * 0.06, 0.1),
      yPos - layerH / 2, yPos + layerH / 2);
    parts.push(ensureMergeReady(cone));
  }
  return mergeGeometries(parts, false)!;
}

// --- Cherry Blossom: pink canopy ---
function createCherryGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.03, 0.02, 6,
    new THREE.Color('#5A3A2A'), new THREE.Color('#7A5A4A'));
  const parts: THREE.BufferGeometry[] = [trunk];

  const r1 = width * 0.5;
  const r2 = width * 0.35;
  for (const { r, y, cBot, cTop } of [
    { r: r1, y: trunkH + width * 0.35, cBot: new THREE.Color('#E8A0B0'), cTop: new THREE.Color('#FFD0DD') },
    { r: r2, y: trunkH + width * 0.7,  cBot: new THREE.Color('#F0C0D0'), cTop: new THREE.Color('#FFE8F0') },
  ]) {
    const geo = new THREE.DodecahedronGeometry(r, 1);
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
  const trunkGeo = new THREE.CylinderGeometry(0.025, 0.04, trunkH, 5);
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
  const c1 = new THREE.IcosahedronGeometry(c1R, 1);
  const c1p = c1.getAttribute('position');
  for (let i = 0; i < c1p.count; i++) c1p.setX(i, c1p.getX(i) * 1.2);
  c1.translate(0, trunkH + width * 0.3, 0);
  colorGeometry(c1,
    new THREE.Color('#6A7A5A'), new THREE.Color('#8A9A7A'),
    trunkH, trunkH + c1R * 2);

  const c2R = width * 0.3;
  const c2 = new THREE.IcosahedronGeometry(c2R, 0);
  c2.translate(width * 0.1, trunkH + width * 0.55, width * 0.05);
  colorGeometry(c2,
    new THREE.Color('#7A8A6A'), new THREE.Color('#9AAA8A'),
    trunkH + width * 0.3, trunkH + width * 0.8);

  return mergeGeometries([ensureMergeReady(trunkGeo), ensureMergeReady(c1), ensureMergeReady(c2)], false)!;
}

// --- Giant Sequoia: very tall reddish trunk, small top canopy ---
function createSequoiaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.75;
  const trunk = createTrunk(trunkH, 0.065, 0.04, 7,
    new THREE.Color('#6B2A1A'), new THREE.Color('#9B4A2A'));

  const canopyR = width * 0.35;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 1);
  const cp = canopy.getAttribute('position');
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) * 1.4);
  canopy.translate(0, height * 0.8, 0);
  colorGeometry(canopy,
    new THREE.Color('#1A4A1A'), new THREE.Color('#2A6A2A'),
    height * 0.8 - canopyR * 1.4, height * 0.8 + canopyR * 1.4);

  const topH = height * 0.12;
  const top = new THREE.ConeGeometry(width * 0.15, topH, 6);
  top.translate(0, height * 0.95, 0);
  colorGeometry(top,
    new THREE.Color('#2A5A2A'), new THREE.Color('#3A7A3A'),
    height * 0.95 - topH / 2, height * 0.95 + topH / 2);

  return mergeGeometries([trunk, ensureMergeReady(canopy), ensureMergeReady(top)], false)!;
}

/* ---------- material ---------- */

function createWindSwayMaterial(
  timeUniform: { value: number }
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 10,
    flatShading: true,
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
      float swayAmount = transformed.y * transformed.y * 0.015;
      transformed.x += sin(uTime * 2.0 + worldPos4.x * 3.0 + worldPos4.z * 2.0) * swayAmount;
      transformed.z += cos(uTime * 1.7 + worldPos4.z * 3.0 + worldPos4.x * 2.0) * swayAmount;`
    );
  };

  return material;
}

/* ---------- placement ---------- */

const _up = new THREE.Vector3(0, 1, 0);

function placeTrees(
  points: { position: THREE.Vector3; normal: THREE.Vector3; height: number }[],
  geometry: THREE.BufferGeometry,
  material: THREE.MeshPhongMaterial,
  count: number
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

    dummy.position.copy(point.position);
    dummy.quaternion.setFromUnitVectors(_up, normal);

    const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    dummy.quaternion.premultiply(yRot);

    const scaleY = 0.9 + Math.random() * 0.3;
    const scaleXZ = 0.9 + Math.random() * 0.3;
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
