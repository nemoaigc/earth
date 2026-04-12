import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

interface BiomeConfig {
  biome: string;
  count: number;
  colors: string[];
  heightRange: [number, number];
  widthRange: [number, number];
  useCone: boolean;
}

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    biome: 'tropical',
    count: 400,
    colors: ['#228833', '#33aa44', '#2d9922'],
    heightRange: [0.3, 0.5],
    widthRange: [0.08, 0.12],
    useCone: false,
  },
  {
    biome: 'temperate',
    count: 400,
    colors: ['#55cc33', '#44bb44', '#66cc55', '#cc8833'],
    heightRange: [0.25, 0.4],
    widthRange: [0.06, 0.09],
    useCone: false,
  },
  {
    biome: 'boreal',
    count: 400,
    colors: ['#225533', '#336644', '#2a5533'],
    heightRange: [0.3, 0.45],
    widthRange: [0.04, 0.06],
    useCone: true,
  },
  {
    biome: 'desert',
    count: 30,
    colors: ['#889944'],
    heightRange: [0.15, 0.25],
    widthRange: [0.04, 0.06],
    useCone: false,
  },
];

function createTeardropGeometry(height: number, width: number): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI) * (1 - t * 0.4) * (width / 2);
    points.push(new THREE.Vector2(r, t * height));
  }
  points[points.length - 1].x = 0;
  points[0].x = 0;

  const geometry = new THREE.LatheGeometry(points, 6);

  const posAttr = geometry.getAttribute('position');
  const colors = new Float32Array(posAttr.count * 3);
  const darkGreen = new THREE.Color(0.15, 0.35, 0.1);
  const lightGreen = new THREE.Color(0.4, 0.7, 0.25);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = Math.max(0, Math.min(1, y / height));
    tmpColor.lerpColors(darkGreen, lightGreen, t);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createConeTreeGeometry(height: number, width: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(width / 2, height, 6);

  // Shift so base is at y=0
  geometry.translate(0, height / 2, 0);

  const posAttr = geometry.getAttribute('position');
  const colors = new Float32Array(posAttr.count * 3);
  const darkGreen = new THREE.Color(0.1, 0.25, 0.1);
  const lightGreen = new THREE.Color(0.2, 0.45, 0.2);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = Math.max(0, Math.min(1, y / height));
    tmpColor.lerpColors(darkGreen, lightGreen, t);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

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

      // Distribute across color groups evenly
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

        const geometry = config.useCone
          ? createConeTreeGeometry(height, width)
          : createTeardropGeometry(height, width);

        const tintColor = new THREE.Color(config.colors[c]);
        const material = createWindSwayMaterial(tintColor, this.timeUniform);

        // Slice a portion of biome points for this color group
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
