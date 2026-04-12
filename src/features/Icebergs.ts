import * as THREE from 'three';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';
import { createWorldMask } from '../globe/worldmap';

const ICEBERG_COUNT = 10;

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.sin(theta) * radius,
  );
}

function createIcebergGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.12, 0);
  const pos = geo.getAttribute('position');

  // Perturb vertices for irregular iceberg shape
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.06);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.06);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.06);
  }

  // Vertex colors: alternate faces white and light blue
  const faceCount = pos.count / 3;
  const colors = new Float32Array(pos.count * 3);
  const white = new THREE.Color('#eeffff');
  const lightBlue = new THREE.Color('#ccddff');

  for (let f = 0; f < faceCount; f++) {
    const c = f % 2 === 0 ? white : lightBlue;
    for (let v = 0; v < 3; v++) {
      const idx = f * 3 + v;
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function findOceanPositions(count: number, minAbsLat: number): { lat: number; lng: number }[] {
  const mask = createWorldMask();
  const results: { lat: number; lng: number }[] = [];
  let attempts = 0;

  while (results.length < count && attempts < 5000) {
    attempts++;
    const lat = minAbsLat + Math.random() * (75 - minAbsLat);
    const signedLat = Math.random() < 0.5 ? lat : -lat;
    const lng = Math.random() * 360 - 180;

    if (!mask.isLand(signedLat, lng)) {
      results.push({ lat: signedLat, lng });
    }
  }

  return results;
}

export class Icebergs {
  group: THREE.Group;
  private mesh: THREE.InstancedMesh;
  private initialMatrices: THREE.Matrix4[] = [];
  private timeOffsets: number[] = [];

  constructor(_terrainData: TerrainData) {
    this.group = new THREE.Group();

    const geometry = createIcebergGeometry();
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 60,
    });

    const positions = findOceanPositions(ICEBERG_COUNT, 55);
    const count = positions.length;

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const { lat, lng } = positions[i];
      const pos = latLngToPosition(lat, lng, GLOBE_RADIUS + 0.02);

      dummy.position.copy(pos);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);

      const scale = 0.6 + Math.random() * 0.8;
      dummy.scale.set(scale, scale, scale);

      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      this.initialMatrices.push(dummy.matrix.clone());
      this.timeOffsets.push(Math.random() * Math.PI * 2);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  update(time: number): void {
    const rotAxis = new THREE.Vector3(0, 1, 0);
    const mat = new THREE.Matrix4();

    for (let i = 0; i < this.initialMatrices.length; i++) {
      const angle = 0.0005 * (time + this.timeOffsets[i] * 100);
      mat.makeRotationAxis(rotAxis, angle);
      mat.multiply(this.initialMatrices[i]);
      this.mesh.setMatrixAt(i, mat);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
