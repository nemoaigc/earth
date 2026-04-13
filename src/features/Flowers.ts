import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FLOWER_COLORS = [
  { color: '#cc3344', weight: 0.3 },
  { color: '#eecc33', weight: 0.3 },
  { color: '#eeeeff', weight: 0.2 },
  { color: '#8844aa', weight: 0.2 },
];

function buildFlowerGeometry(headColor: THREE.Color): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.004, 0.004, 0.056, 4);
  stem.translate(0, 0.028, 0);
  const stemColors = new Float32Array(stem.getAttribute('position').count * 3);
  const sc = new THREE.Color('#338833');
  for (let i = 0; i < stemColors.length; i += 3) {
    stemColors[i] = sc.r; stemColors[i+1] = sc.g; stemColors[i+2] = sc.b;
  }
  stem.setAttribute('color', new THREE.BufferAttribute(stemColors, 3));

  const head = new THREE.SphereGeometry(0.017, 5, 4);
  head.translate(0, 0.063, 0);
  const headColors = new Float32Array(head.getAttribute('position').count * 3);
  for (let i = 0; i < headColors.length; i += 3) {
    headColors[i] = headColor.r; headColors[i+1] = headColor.g; headColors[i+2] = headColor.b;
  }
  head.setAttribute('color', new THREE.BufferAttribute(headColors, 3));

  return mergeGeometries([stem, head], false)!;
}

export class Flowers {
  group: THREE.Group;
  private timeUniform = { value: 0 };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    const eligible = terrainData.landPoints.filter(
      p => (p.biome === 'temperate' || p.biome === 'tropical') && p.height < 0.3
    ).sort(() => Math.random() - 0.5);

    const total = Math.min(300, eligible.length);
    let idx = 0;

    for (const fc of FLOWER_COLORS) {
      const count = Math.round(total * fc.weight);
      const geo = buildFlowerGeometry(new THREE.Color(fc.color));
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true });
      const tu = this.timeUniform;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = tu;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
          float sw = transformed.y * 0.05;
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
        dummy.scale.setScalar(0.6 + Math.random() * 0.8);
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
