import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const ROCK_COUNT = 120;

// Rounded boulder
function createBoulderGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.05, 1);
  const pos = geo.getAttribute('position');
  // Gentle perturbation for organic feel
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.012);
    pos.setY(i, pos.getY(i) * (0.6 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.008);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.012);
  }
  // Vertex colors: base gray-brown, top slightly green (moss)
  const colors = new Float32Array(pos.count * 3);
  const baseCol = new THREE.Color('#B0A898');
  const mossCol = new THREE.Color('#8A9A78');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 0.05) / 0.1));
    tmp.lerpColors(baseCol, mossCol, t * 0.4);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// Jagged pointy rock
function createJaggedRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.TetrahedronGeometry(0.045, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.018);
    pos.setY(i, pos.getY(i) * 1.2 + (Math.random() - 0.5) * 0.01);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.018);
  }
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color('#9A9088');
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = col.r + (Math.random() - 0.5) * 0.06;
    colors[i * 3 + 1] = col.g + (Math.random() - 0.5) * 0.06;
    colors[i * 3 + 2] = col.b + (Math.random() - 0.5) * 0.04;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// Flat slab rock
function createSlabRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.055, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 0.3); // flatten
    pos.setX(i, pos.getX(i) * (1 + (Math.random() - 0.5) * 0.3));
    pos.setZ(i, pos.getZ(i) * (1 + (Math.random() - 0.5) * 0.3));
  }
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color('#B8AA95');
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = col.r + (Math.random() - 0.5) * 0.05;
    colors[i * 3 + 1] = col.g + (Math.random() - 0.5) * 0.05;
    colors[i * 3 + 2] = col.b + (Math.random() - 0.5) * 0.04;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

const ROCK_GEOMETRIES = [createBoulderGeometry, createJaggedRockGeometry, createSlabRockGeometry];

export class Rocks {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 15,
      flatShading: true,
    });
    material.color.set(0xffffff);

    const eligible = terrainData.landPoints;
    const perType = Math.floor(Math.min(ROCK_COUNT, eligible.length) / ROCK_GEOMETRIES.length);

    for (let t = 0; t < ROCK_GEOMETRIES.length; t++) {
      const geo = ROCK_GEOMETRIES[t]();
      const shuffled = eligible.sort(() => Math.random() - 0.5);
      const count = Math.min(perType, shuffled.length);
      const mesh = new THREE.InstancedMesh(geo, material, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const point = shuffled[i];
        dummy.position.copy(point.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);

        const scale = 0.5 + Math.random() * 0.8;
        dummy.scale.set(scale, scale * (0.6 + Math.random() * 0.5), scale);
        dummy.rotateX(Math.random() * 0.5);
        dummy.rotateY(Math.random() * Math.PI * 2);
        dummy.rotateZ(Math.random() * 0.5);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  update(_time: number): void {}
}
