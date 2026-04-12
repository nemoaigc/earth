import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const ROCK_COUNT = 200;
const ROCK_COLORS = ['#999988', '#aa9977', '#bbaa88', '#8899777', '#998866'];

function createRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.04, 0);
  const pos = geo.getAttribute('position');

  // Perturb vertices for a natural rocky look
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.015);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.015);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.015);
  }

  geo.computeVertexNormals();
  return geo;
}

export class Rocks {
  group: THREE.Group;
  private mesh: THREE.InstancedMesh;

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const geometry = createRockGeometry();
    const material = new THREE.MeshPhongMaterial({
      shininess: 30,
    });

    const eligible = terrainData.landPoints;
    const count = Math.min(ROCK_COUNT, eligible.length);

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
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

      // Random scale 0.5-1.5x
      const scale = 0.5 + Math.random() * 1.0;
      dummy.scale.set(scale, scale * (0.6 + Math.random() * 0.4), scale);

      // Random rotation
      dummy.rotateX(Math.random() * Math.PI);
      dummy.rotateY(Math.random() * Math.PI * 2);
      dummy.rotateZ(Math.random() * Math.PI);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      color.set(ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)]);
      this.mesh.setColorAt(i, color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.group.add(this.mesh);
  }

  update(_time: number): void {
    // Rocks don't animate
  }
}
