import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const TREE_COUNT = 1500;

const TREE_COLOR_GROUPS: { color: string; weight: number }[] = [
  { color: '#4aaa33', weight: 0.18 },
  { color: '#55bb44', weight: 0.16 },
  { color: '#338822', weight: 0.16 },
  { color: '#66cc55', weight: 0.14 },
  { color: '#2d7722', weight: 0.14 },
  { color: '#337733', weight: 0.12 },
  { color: '#cc8833', weight: 0.10 },
];

function createTeardropGeometry(height: number, width: number): THREE.BufferGeometry {
  // Teardrop profile: widest near bottom, tapers to point at top
  const points: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom, 1 = top
    // Teardrop curve: sin-based bulge near bottom, tapering to 0 at top
    const r = Math.sin(t * Math.PI) * (1 - t * 0.4) * (width / 2);
    points.push(new THREE.Vector2(r, t * height));
  }
  // Ensure tip is closed
  points[points.length - 1].x = 0;
  // Ensure bottom is closed
  points[0].x = 0;

  const geometry = new THREE.LatheGeometry(points, 6);

  // Add vertex colors: darker at base, lighter at top
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

export class Trees {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];
  private materials: THREE.MeshPhongMaterial[] = [];
  private timeUniform: { value: number };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    this.timeUniform = { value: 0 };

    // Filter eligible land points
    const eligible = terrainData.landPoints.filter(
      (p) => p.height > 0.05 && p.height < 0.65
    );

    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const totalCount = Math.min(TREE_COUNT, shuffled.length);

    // Distribute trees across color groups by weight
    const groupCounts: number[] = [];
    let assigned = 0;
    for (let g = 0; g < TREE_COLOR_GROUPS.length; g++) {
      const count =
        g < TREE_COLOR_GROUPS.length - 1
          ? Math.round(totalCount * TREE_COLOR_GROUPS[g].weight)
          : totalCount - assigned;
      groupCounts.push(count);
      assigned += count;
    }

    const dummy = new THREE.Object3D();
    let pointIndex = 0;

    for (let g = 0; g < TREE_COLOR_GROUPS.length; g++) {
      const count = groupCounts[g];
      if (count <= 0) continue;

      // Random geometry size for variety within each group
      const height = 0.25 + Math.random() * 0.2;
      const width = 0.05 + Math.random() * 0.03;
      const geometry = createTeardropGeometry(height, width);

      const tintColor = new THREE.Color(TREE_COLOR_GROUPS[g].color);

      const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 10,
        flatShading: true,
      });
      // Tint: multiply vertex colors by the group color
      material.color.copy(tintColor);

      // Inject wind sway shader
      const timeUniform = this.timeUniform;
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

      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      for (let i = 0; i < count; i++) {
        if (pointIndex >= shuffled.length) break;
        const point = shuffled[pointIndex++];

        dummy.position.copy(point.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);

        // Random scale variation per tree
        const scaleY = 0.7 + Math.random() * 0.6;
        const scaleXZ = 0.8 + Math.random() * 0.4;
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);

        // Random rotation around local Y axis
        dummy.rotateY(Math.random() * Math.PI * 2);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;

      this.meshes.push(mesh);
      this.materials.push(material);
      this.group.add(mesh);
    }
  }

  update(time: number): void {
    this.timeUniform.value = time;
  }
}
