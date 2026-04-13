import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BIOME_GRASS: { biome: string; color: string }[] = [
  { biome: 'tropical', color: '#228833' },
  { biome: 'temperate', color: '#44aa33' },
  { biome: 'boreal', color: '#336644' },
];

function buildGrassGeometry(baseColor: THREE.Color): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const dark = baseColor.clone().multiplyScalar(0.6);
  const light = baseColor.clone();

  for (let i = 0; i < 5; i++) {
    const blade = new THREE.PlaneGeometry(0.011, 0.07, 1, 1);
    // Color: bottom dark, top light
    const pos = blade.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) {
      const t = (pos.getY(v) + 0.025) / 0.05;
      const c = dark.clone().lerp(light, t);
      colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    }
    blade.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const angle = (i / 5) * Math.PI + (Math.random() - 0.5) * 0.3;
    const mat = new THREE.Matrix4().makeRotationY(angle);
    blade.applyMatrix4(mat);
    blade.translate(0, 0.025, 0);
    blades.push(blade);
  }

  return mergeGeometries(blades, false)!;
}

export class Grass {
  group: THREE.Group;
  private timeUniform = { value: 0 };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    for (const bg of BIOME_GRASS) {
      const eligible = terrainData.landPoints
        .filter(p => p.biome === bg.biome)
        .sort(() => Math.random() - 0.5);

      const count = Math.min(170, eligible.length);
      if (count === 0) continue;

      const geo = buildGrassGeometry(new THREE.Color(bg.color));
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
      const tu = this.timeUniform;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = tu;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
          float sw = transformed.y * 0.06;
          transformed.x += sin(uTime * 2.0 + wp4.x * 3.5) * sw;
          transformed.z += cos(uTime * 1.8 + wp4.z * 3.0) * sw;`
        );
      };

      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const p = eligible[i];
        dummy.position.copy(p.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
        dummy.scale.setScalar(0.5 + Math.random() * 1.0);
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
