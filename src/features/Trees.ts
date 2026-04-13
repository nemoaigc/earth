import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BiomeConfig {
  biome: string;
  count: number;
  colors: string[];
  heightRange: [number, number];
  widthRange: [number, number];
  geoType: 'tropical' | 'temperate' | 'boreal' | 'acacia' | 'cactus';
}

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    biome: 'tropical',
    count: 400,
    colors: ['#228833', '#33aa44', '#2d9922'],
    heightRange: [0.5, 0.7],
    widthRange: [0.20, 0.28],
    geoType: 'tropical',
  },
  {
    biome: 'temperate',
    count: 400,
    colors: ['#55cc33', '#44bb44', '#66cc55', '#cc8833'],
    heightRange: [0.45, 0.65],
    widthRange: [0.18, 0.25],
    geoType: 'temperate',
  },
  {
    biome: 'boreal',
    count: 400,
    colors: ['#225533', '#336644', '#2a5533'],
    heightRange: [0.55, 0.75],
    widthRange: [0.12, 0.18],
    geoType: 'boreal',
  },
  {
    biome: 'desert',
    count: 30,
    colors: ['#889944'],
    heightRange: [0.30, 0.45],
    widthRange: [0.12, 0.18],
    geoType: 'temperate',
  },
  {
    biome: 'desert',
    count: 60,
    colors: ['#557733'],
    heightRange: [0.35, 0.49],
    widthRange: [0.14, 0.20],
    geoType: 'acacia',
  },
  {
    biome: 'desert',
    count: 40,
    colors: ['#558833'],
    heightRange: [0.14, 0.21],
    widthRange: [0.04, 0.07],
    geoType: 'cactus',
  },
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

const TRUNK_BOTTOM = new THREE.Color('#5C3D1A');
const TRUNK_TOP = new THREE.Color('#8B6914');

function createTrunk(
  height: number,
  radiusBottom: number,
  radiusTop: number,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 6);
  geo.translate(0, height / 2, 0);
  colorGeometry(geo, TRUNK_BOTTOM, TRUNK_TOP, 0, height);
  return ensureMergeReady(geo);
}

/* ---------- tree geometry builders ---------- */

function createTropicalTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.025, 0.018);

  const parts: THREE.BufferGeometry[] = [trunk];

  // 2 stacked spheres for bushy round canopy
  const baseRadius = width * 0.45;
  const layers = [
    { r: baseRadius, y: trunkH + baseRadius * 0.7 },
    { r: baseRadius * 0.75, y: trunkH + baseRadius * 1.5 },
  ];
  for (const layer of layers) {
    const sphere = new THREE.DodecahedronGeometry(layer.r, 1);
    sphere.translate(0, layer.y, 0);
    const darkGreen = new THREE.Color(0.08, 0.28, 0.06);
    const lightGreen = new THREE.Color(0.2, 0.5, 0.12);
    colorGeometry(sphere, darkGreen, lightGreen, layer.y - layer.r, layer.y + layer.r);
    parts.push(ensureMergeReady(sphere));
  }

  return mergeGeometries(parts, false)!;
}

function createTemperateTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.022, 0.015);

  // Ellipsoid canopy — icosahedron stretched on Y
  const canopyRadius = width * 0.45;
  const canopy = new THREE.IcosahedronGeometry(canopyRadius, 1);
  const pos = canopy.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 1.5);
  }
  const canopyCenter = trunkH + canopyRadius * 1.2;
  canopy.translate(0, canopyCenter, 0);

  const darkGreen = new THREE.Color(0.12, 0.32, 0.08);
  const lightGreen = new THREE.Color(0.3, 0.6, 0.18);
  colorGeometry(canopy, darkGreen, lightGreen, canopyCenter - canopyRadius * 1.5, canopyCenter + canopyRadius * 1.5);

  return mergeGeometries([trunk, ensureMergeReady(canopy)], false)!;
}

function createBorealTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunkH = height * 0.25;
  const trunk = createTrunk(trunkH, 0.018, 0.012);

  const parts: THREE.BufferGeometry[] = [trunk];

  // 3 layered cones — spruce/christmas tree silhouette
  const layerCount = 3;
  const canopyH = height - trunkH;
  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1); // 0 = bottom, 1 = top
    const layerH = canopyH * (0.45 - t * 0.1);
    const layerR = width * (0.5 - t * 0.18);
    const cone = new THREE.ConeGeometry(layerR, layerH, 6);
    const yPos = trunkH + canopyH * (i / layerCount) * 0.9 + layerH * 0.5;
    cone.translate(0, yPos, 0);

    const darkGreen = new THREE.Color(0.06, 0.18 + t * 0.05, 0.06);
    const lightGreen = new THREE.Color(0.12, 0.35 + t * 0.08, 0.1);
    colorGeometry(cone, darkGreen, lightGreen, yPos - layerH / 2, yPos + layerH / 2);
    parts.push(ensureMergeReady(cone));
  }

  return mergeGeometries(parts, false)!;
}

function createAcaciaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.012, 0.018, height, 6);
  trunk.translate(0, height / 2, 0);
  colorGeometryFlat(trunk, new THREE.Color('#8B6914'));

  const canopy = new THREE.CylinderGeometry(width / 2, width / 2 * 0.85, 0.035, 8);
  canopy.translate(0, height, 0);
  colorGeometryFlat(canopy, new THREE.Color('#557733'));

  return mergeGeometries([ensureMergeReady(trunk), ensureMergeReady(canopy)], false)!;
}

function createCactusGeometry(height: number, _width: number): THREE.BufferGeometry {
  const gc = new THREE.Color('#558833');
  function makeArm(h: number, rTop: number, rBot: number): THREE.BufferGeometry {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 6);
    colorGeometryFlat(g, gc);
    return g;
  }
  const trunk = makeArm(height, 0.028, 0.035);
  trunk.translate(0, height / 2, 0);

  const armL = makeArm(height * 0.4, 0.017, 0.021);
  armL.rotateZ(Math.PI / 4);
  armL.translate(-0.03, height * 0.6, 0);

  const armR = makeArm(height * 0.4, 0.017, 0.021);
  armR.rotateZ(-Math.PI / 4);
  armR.translate(0.03, height * 0.55, 0);

  return mergeGeometries(
    [trunk, armL, armR].map(ensureMergeReady),
    false,
  )!;
}

/* ---------- material ---------- */

function createWindSwayMaterial(
  tintColor: THREE.Color,
  timeUniform: { value: number }
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 10,
    flatShading: true,
  });
  material.color.copy(tintColor);

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
      float swayAmount = transformed.y * transformed.y * 0.02;
      transformed.x += sin(uTime * 2.0 + worldPos4.x * 3.0 + worldPos4.z * 2.0) * swayAmount;
      transformed.z += cos(uTime * 1.7 + worldPos4.z * 3.0 + worldPos4.x * 2.0) * swayAmount;`
    );
  };

  return material;
}

/* ---------- placement ---------- */

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

  const dummy = new THREE.Object3D();
  for (let i = 0; i < actual; i++) {
    const point = shuffled[i];
    dummy.position.copy(point.position);
    dummy.lookAt(0, 0, 0);
    dummy.rotateX(Math.PI / 2);

    const scaleY = 0.7 + Math.random() * 0.6;
    const scaleXZ = 0.8 + Math.random() * 0.4;
    dummy.scale.set(scaleXZ, scaleY, scaleXZ);
    dummy.rotateY(Math.random() * Math.PI * 2);

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
      const biomePoints = terrainData.landPoints.filter(
        (p) => p.biome === config.biome
      );
      if (biomePoints.length === 0) continue;

      const colorsCount = config.colors.length;
      const perColor = Math.ceil(config.count / colorsCount);

      for (let c = 0; c < colorsCount; c++) {
        const colorCount = Math.min(
          perColor,
          Math.floor(biomePoints.length / colorsCount)
        );
        if (colorCount <= 0) continue;

        const height =
          config.heightRange[0] +
          Math.random() * (config.heightRange[1] - config.heightRange[0]);
        const width =
          config.widthRange[0] +
          Math.random() * (config.widthRange[1] - config.widthRange[0]);

        let geometry: THREE.BufferGeometry;
        switch (config.geoType) {
          case 'tropical': geometry = createTropicalTreeGeometry(height, width); break;
          case 'temperate': geometry = createTemperateTreeGeometry(height, width); break;
          case 'boreal': geometry = createBorealTreeGeometry(height, width); break;
          case 'acacia': geometry = createAcaciaGeometry(height, width); break;
          case 'cactus': geometry = createCactusGeometry(height, width); break;
        }

        const tintColor = new THREE.Color(config.colors[c]);
        const material = createWindSwayMaterial(tintColor, this.timeUniform);

        const startIdx = c * Math.floor(biomePoints.length / colorsCount);
        const endIdx = startIdx + Math.floor(biomePoints.length / colorsCount);
        const subset = biomePoints.slice(startIdx, endIdx);

        const mesh = placeTrees(subset, geometry, material, colorCount);
        this.meshes.push(mesh);
        this.materials.push(material);
        this.group.add(mesh);
      }
    }
  }

  update(time: number): void {
    this.timeUniform.value = time;
  }
}
