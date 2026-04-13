import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BiomeConfig {
  biome: string;
  count: number;
  heightRange: [number, number];
  widthRange: [number, number];
  geoType: 'tropical' | 'temperate' | 'boreal' | 'acacia' | 'cactus';
}

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    biome: 'tropical',
    count: 400,
    heightRange: [0.5, 0.7],
    widthRange: [0.18, 0.26],
    geoType: 'tropical',
  },
  {
    biome: 'temperate',
    count: 400,
    heightRange: [0.45, 0.65],
    widthRange: [0.16, 0.22],
    geoType: 'temperate',
  },
  {
    biome: 'boreal',
    count: 400,
    heightRange: [0.5, 0.7],
    widthRange: [0.10, 0.16],
    geoType: 'boreal',
  },
  {
    biome: 'desert',
    count: 30,
    heightRange: [0.30, 0.45],
    widthRange: [0.12, 0.18],
    geoType: 'temperate',
  },
  {
    biome: 'desert',
    count: 60,
    heightRange: [0.35, 0.49],
    widthRange: [0.14, 0.20],
    geoType: 'acacia',
  },
  {
    biome: 'desert',
    count: 40,
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

/* ---------- tree geometry builders ---------- */

const TRUNK_BOTTOM = new THREE.Color('#6B4226');
const TRUNK_TOP = new THREE.Color('#A0784C');

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

function createTropicalTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  // Tall trunk + 2 bushy round canopy blobs
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.03, 0.02);

  const parts: THREE.BufferGeometry[] = [trunk];

  const r1 = width * 0.5;
  const r2 = r1 * 0.7;
  const layers = [
    { r: r1, y: trunkH + r1 * 0.8 },
    { r: r2, y: trunkH + r1 * 1.6 },
  ];
  for (const layer of layers) {
    const sphere = new THREE.DodecahedronGeometry(layer.r, 1);
    sphere.translate(0, layer.y, 0);
    colorGeometry(sphere,
      new THREE.Color(0.15, 0.45, 0.1),
      new THREE.Color(0.3, 0.7, 0.2),
      layer.y - layer.r, layer.y + layer.r);
    parts.push(ensureMergeReady(sphere));
  }

  return mergeGeometries(parts, false)!;
}

function createTemperateTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  // Trunk + ellipsoid canopy (lollipop)
  const trunkH = height * 0.45;
  const trunk = createTrunk(trunkH, 0.025, 0.016);

  const canopyR = width * 0.5;
  const canopy = new THREE.IcosahedronGeometry(canopyR, 1);
  const pos = canopy.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 1.4);
  }
  const cy = trunkH + canopyR * 1.1;
  canopy.translate(0, cy, 0);
  colorGeometry(canopy,
    new THREE.Color(0.2, 0.5, 0.1),
    new THREE.Color(0.45, 0.8, 0.25),
    cy - canopyR * 1.4, cy + canopyR * 1.4);

  return mergeGeometries([trunk, ensureMergeReady(canopy)], false)!;
}

function createBorealTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  // Short trunk + 3 layered cones (spruce)
  const trunkH = height * 0.2;
  const trunk = createTrunk(trunkH, 0.02, 0.014);

  const parts: THREE.BufferGeometry[] = [trunk];

  const canopyH = height - trunkH;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const layerH = canopyH * (0.5 - t * 0.12);
    const layerR = width * (0.55 - t * 0.18);
    const cone = new THREE.ConeGeometry(layerR, layerH, 6);
    const yPos = trunkH + canopyH * (i / 3) * 0.85 + layerH * 0.5;
    cone.translate(0, yPos, 0);
    colorGeometry(cone,
      new THREE.Color(0.08, 0.3 + t * 0.05, 0.08),
      new THREE.Color(0.18, 0.55 + t * 0.08, 0.15),
      yPos - layerH / 2, yPos + layerH / 2);
    parts.push(ensureMergeReady(cone));
  }

  return mergeGeometries(parts, false)!;
}

function createAcaciaGeometry(height: number, width: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.012, 0.018, height, 6);
  trunk.translate(0, height / 2, 0);
  colorGeometryFlat(trunk, new THREE.Color('#A0784C'));

  const canopy = new THREE.CylinderGeometry(width / 2, width / 2 * 0.85, 0.035, 8);
  canopy.translate(0, height, 0);
  colorGeometryFlat(canopy, new THREE.Color('#5A8C32'));

  return mergeGeometries([ensureMergeReady(trunk), ensureMergeReady(canopy)], false)!;
}

function createCactusGeometry(height: number, _width: number): THREE.BufferGeometry {
  const gc = new THREE.Color('#5A8C32');
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
  timeUniform: { value: number }
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 10,
    flatShading: true,
  });
  // White base so vertex colors show through at full brightness
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

    const scaleY = 0.8 + Math.random() * 0.5;
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
        case 'tropical': geometry = createTropicalTreeGeometry(height, width); break;
        case 'temperate': geometry = createTemperateTreeGeometry(height, width); break;
        case 'boreal': geometry = createBorealTreeGeometry(height, width); break;
        case 'acacia': geometry = createAcaciaGeometry(height, width); break;
        case 'cactus': geometry = createCactusGeometry(height, width); break;
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
