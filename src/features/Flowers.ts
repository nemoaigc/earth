import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FLOWER_COLORS = [
  { color: '#EE4466', center: '#CC2244', weight: 0.3 },  // Red
  { color: '#FFDD44', center: '#DDAA22', weight: 0.3 },  // Yellow
  { color: '#EEEEFF', center: '#DDDDBB', weight: 0.2 },  // White
  { color: '#AA66CC', center: '#884488', weight: 0.2 },  // Purple
];

function ensureMergeReady(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function colorFlat(geo: THREE.BufferGeometry, color: THREE.Color): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function buildFlowerGeometry(petalColor: THREE.Color, centerColor: THREE.Color): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Stem
  const stem = new THREE.CylinderGeometry(0.005, 0.006, 0.06, 4);
  stem.translate(0, 0.03, 0);
  colorFlat(stem, new THREE.Color('#4A8A3A'));
  parts.push(ensureMergeReady(stem));

  // Small leaf on stem
  const leaf = new THREE.SphereGeometry(0.012, 4, 3);
  const lp = leaf.getAttribute('position');
  for (let i = 0; i < lp.count; i++) {
    lp.setY(i, lp.getY(i) * 0.3);
    lp.setX(i, lp.getX(i) * 1.5);
  }
  leaf.translate(0.01, 0.025, 0);
  colorFlat(leaf, new THREE.Color('#5A9A4A'));
  parts.push(ensureMergeReady(leaf));

  // Center (pistil)
  const center = new THREE.SphereGeometry(0.008, 5, 4);
  center.translate(0, 0.065, 0);
  colorFlat(center, centerColor);
  parts.push(ensureMergeReady(center));

  // 5 petals arranged around center
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.012, 4, 3);
    const pp = petal.getAttribute('position');
    // Flatten into petal shape
    for (let v = 0; v < pp.count; v++) {
      pp.setY(v, pp.getY(v) * 0.25);
      pp.setZ(v, pp.getZ(v) * 0.7);
    }
    const px = Math.cos(angle) * 0.014;
    const pz = Math.sin(angle) * 0.014;
    petal.rotateY(angle);
    petal.translate(px, 0.065, pz);
    colorFlat(petal, petalColor);
    parts.push(ensureMergeReady(petal));
  }

  return mergeGeometries(parts, false)!;
}

export class Flowers {
  group: THREE.Group;
  private timeUniform = { value: 0 };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    const eligible = terrainData.landPoints.filter(
      p => (p.biome === 'temperate' || p.biome === 'tropical') && p.height < 0.3
    ).sort(() => Math.random() - 0.5);

    const total = Math.min(200, eligible.length);
    let idx = 0;

    for (const fc of FLOWER_COLORS) {
      const count = Math.round(total * fc.weight);
      const geo = buildFlowerGeometry(new THREE.Color(fc.color), new THREE.Color(fc.center));
      const mat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
      });
      mat.color.set(0xffffff);

      const tu = this.timeUniform;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = tu;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
          float sw = transformed.y * 0.04;
          transformed.x += sin(uTime * 2.5 + wp4.x * 4.0) * sw;
          transformed.z += cos(uTime * 2.0 + wp4.z * 3.0) * sw;`
        );
      };

      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count && idx < eligible.length; i++, idx++) {
        const p = eligible[idx];
        dummy.position.copy(p.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
        dummy.scale.setScalar(0.7 + Math.random() * 0.6);
        dummy.rotateY(Math.random() * Math.PI * 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
  }

  update(time: number): void { this.timeUniform.value = time; }
}
