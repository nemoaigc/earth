import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const TREE_COUNT = 600;
const TREE_COLORS = ['#33aa22', '#44cc33', '#55dd44', '#2d9922', '#44bb28'];

export class Trees {
  group: THREE.Group;
  private mesh: THREE.InstancedMesh;
  private material: THREE.MeshPhongMaterial;
  private timeUniform: { value: number };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    this.timeUniform = { value: 0 };

    const geometry = new THREE.ConeGeometry(0.08, 0.35, 6);
    geometry.translate(0, 0.175, 0);

    this.material = new THREE.MeshPhongMaterial({
      vertexColors: false,
      shininess: 10,
    });

    // Inject wind sway shader
    const timeUniform = this.timeUniform;
    this.material.onBeforeCompile = (shader) => {
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

    // Filter eligible land points
    const eligible = terrainData.landPoints.filter(
      (p) => p.height > 0.1 && p.height < 0.6
    );

    const count = Math.min(TREE_COUNT, eligible.length);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const shuffled = eligible.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const point = shuffled[i];

      dummy.position.copy(point.position);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);

      // Random scale variation
      const scale = 0.7 + Math.random() * 0.6;
      dummy.scale.set(scale, scale, scale);

      // Small random rotation around local Y
      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      // Random color from palette
      color.set(TREE_COLORS[Math.floor(Math.random() * TREE_COLORS.length)]);
      this.mesh.setColorAt(i, color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.group.add(this.mesh);
  }

  update(time: number): void {
    this.timeUniform.value = time;
  }
}
