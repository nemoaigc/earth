import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BIOME_GRASS: {
  biome: string;
  count: number;
  color: string;
  tip: string;
  height: number;
  width: number;
  maxHeight: number;
}[] = [
  { biome: 'tropical',  count: 220, color: '#2F9A3C', tip: '#7DC75B', height: 0.050, width: 0.011, maxHeight: 0.44 },
  { biome: 'temperate', count: 210, color: '#62AE42', tip: '#B6C96B', height: 0.046, width: 0.012, maxHeight: 0.52 },
  { biome: 'boreal',    count: 155, color: '#3E7350', tip: '#7A9961', height: 0.038, width: 0.010, maxHeight: 0.62 },
];

function buildGrassGeometry(baseColor: THREE.Color, tipColor: THREE.Color, bladeHeight: number, bladeWidth: number): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const dark = baseColor.clone().multiplyScalar(0.68);
  const light = baseColor.clone();

  // Short, soft tufts: these should read as ground fuzz, not as separate props.
  const bladeCount = 5;
  for (let i = 0; i < bladeCount; i++) {
    const centerDist = Math.abs(i - 2) / 2;
    const bladeH = bladeHeight * (0.74 + (1 - centerDist) * 0.22 + Math.random() * 0.10);
    const bladeW = bladeWidth * (0.82 + Math.random() * 0.36);

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

      // Slight bend at tip; tiny at globe scale so it feels furry, not spiky.
      if (t > 0.5) {
        const bend = (t - 0.5) * bladeHeight * 0.20 * (i % 2 === 0 ? 1 : -1);
        pos.setX(v, pos.getX(v) + bend);
      }
    }
    blade.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const angle = (i / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.34;
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
        .filter(p =>
          p.biome === bg.biome &&
          p.height > 0.035 &&
          p.height < bg.maxHeight &&
          p.mountain < 0.70 &&
          p.treeDensity > 0.12
        )
        .sort(() => Math.random() - 0.5);

      const count = Math.min(bg.count, eligible.length);
      if (count === 0) continue;

      const geo = buildGrassGeometry(new THREE.Color(bg.color), new THREE.Color(bg.tip), bg.height, bg.width);
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
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const p = eligible[i];
        const normal = p.normal.clone().normalize();
        dummy.position.copy(p.position).addScaledVector(normal, -0.001);
        dummy.quaternion.setFromUnitVectors(up, normal);
        dummy.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2));
        const scale = 0.58 + Math.random() * 0.52;
        dummy.scale.set(scale * (0.86 + Math.random() * 0.22), scale, scale * (0.86 + Math.random() * 0.22));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
  }

  update(time: number): void { this.timeUniform.value = time; }
}
