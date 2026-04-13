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
  const geo = new THREE.DodecahedronGeometry(0.18, 1);
  const pos = geo.getAttribute('position');

  // Strong perturbation for angular crystalline look
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Flatten bottom, keep top angular
    if (y < 0) {
      pos.setY(i, y * 0.4); // squash underwater portion
    }
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.05);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.03);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.05);
  }

  // Vertex colors: bottom deep blue → top bright white
  const colors = new Float32Array(pos.count * 3);
  const deepBlue = new THREE.Color('#8ABBE8');
  const iceWhite = new THREE.Color('#F0FAFF');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 0.08) / 0.22));
    tmp.lerpColors(deepBlue, iceWhite, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
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
