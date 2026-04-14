import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BIOME_GRASS: { biome: string; color: string }[] = [
  { biome: 'tropical', color: '#33AA44' },
  { biome: 'temperate', color: '#55BB44' },
  { biome: 'boreal', color: '#448855' },
];

function buildGrassGeometry(baseColor: THREE.Color): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const dark = baseColor.clone().multiplyScalar(0.75);
  const light = baseColor.clone();
  const tipColor = baseColor.clone().lerp(new THREE.Color('#CCDD66'), 0.3);

  // 7 blades per tuft, varying heights — center tallest
  const bladeCount = 7;
  for (let i = 0; i < bladeCount; i++) {
    const centerDist = Math.abs(i - 3) / 3; // 0 at center, 1 at edges
    const bladeH = 0.08 * (1 - centerDist * 0.4); // center taller
    const bladeW = 0.014;

    const blade = new THREE.PlaneGeometry(bladeW, bladeH, 1, 2);
    const pos = blade.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);

    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      const t = (y + bladeH / 2) / bladeH; // 0 at base, 1 at tip
      const c = new THREE.Color();
      if (t < 0.6) {
        c.lerpColors(dark, light, t / 0.6);
      } else {
        c.lerpColors(light, tipColor, (t - 0.6) / 0.4);
      }
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;

      // Slight bend at tip
      if (t > 0.5) {
        const bend = (t - 0.5) * 0.015 * (i % 2 === 0 ? 1 : -1);
        pos.setX(v, pos.getX(v) + bend);
      }
    }
    blade.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const angle = (i / bladeCount) * Math.PI + (Math.random() - 0.5) * 0.4;
    const mat = new THREE.Matrix4().makeRotationY(angle);
    blade.applyMatrix4(mat);
    blade.translate(0, bladeH / 2, 0);
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

      const count = Math.min(100, eligible.length);
      if (count === 0) continue;

      const geo = buildGrassGeometry(new THREE.Color(bg.color));
      const mat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      mat.color.set(0xffffff);

      const tu = this.timeUniform;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = tu;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
          float sw = transformed.y * 0.05;
          transformed.x += sin(uTime * 2.0 + wp4.x * 3.5) * sw;
          transformed.z += cos(uTime * 1.8 + wp4.z * 3.0) * sw;`
        );
      };

      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const p = eligible[i];
        dummy.position.copy(p.position).setLength(p.position.length() + 0.03);
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
