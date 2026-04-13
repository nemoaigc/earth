import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';
import { createWorldMask } from '../globe/worldmap';
import { latLngToPosition } from '../utils/geo';

const ICEBERG_COUNT = 10;

function ensureMergeReady(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function colorGradientY(
  geo: THREE.BufferGeometry,
  bottom: THREE.Color, top: THREE.Color,
  minY: number, maxY: number,
): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const range = maxY - minY || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) - minY) / range));
    tmp.lerpColors(bottom, top, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function createIcebergGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Wide base sitting at water level
  const base = new THREE.CylinderGeometry(0.10, 0.14, 0.03, 5);
  base.translate(0, 0.015, 0);
  // Perturb base for irregular ice
  const bp = base.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    bp.setX(i, bp.getX(i) + (Math.random() - 0.5) * 0.02);
    bp.setZ(i, bp.getZ(i) + (Math.random() - 0.5) * 0.02);
  }
  colorGradientY(base,
    new THREE.Color('#AAD4EE'), new THREE.Color('#CCE8F8'),
    0, 0.03);
  parts.push(ensureMergeReady(base));

  // Main ice peak - angular box rotated for crystalline look
  const peakH = 0.12;
  const peak = new THREE.BoxGeometry(0.07, peakH, 0.06);
  peak.rotateY(Math.random() * 0.5);
  peak.translate(0, 0.03 + peakH / 2, 0);
  // Perturb for angular feel
  const pp = peak.getAttribute('position');
  for (let i = 0; i < pp.count; i++) {
    pp.setX(i, pp.getX(i) + (Math.random() - 0.5) * 0.015);
    pp.setZ(i, pp.getZ(i) + (Math.random() - 0.5) * 0.015);
  }
  colorGradientY(peak,
    new THREE.Color('#BBDDEE'), new THREE.Color('#F0F8FF'),
    0.03, 0.03 + peakH);
  parts.push(ensureMergeReady(peak));

  // Secondary smaller peak offset to side
  const sideH = 0.07;
  const side = new THREE.BoxGeometry(0.04, sideH, 0.035);
  side.rotateY(0.6 + Math.random() * 0.4);
  side.translate(0.05, 0.03 + sideH / 2, 0.02);
  const sp = side.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    sp.setX(i, sp.getX(i) + (Math.random() - 0.5) * 0.01);
    sp.setZ(i, sp.getZ(i) + (Math.random() - 0.5) * 0.01);
  }
  colorGradientY(side,
    new THREE.Color('#BBDDEE'), new THREE.Color('#E8F4FF'),
    0.03, 0.03 + sideH);
  parts.push(ensureMergeReady(side));

  // Top crystal spike
  const spikeH = 0.05;
  const spike = new THREE.ConeGeometry(0.02, spikeH, 4);
  spike.rotateY(Math.PI / 4);
  spike.translate(-0.01, 0.03 + peakH + spikeH * 0.3, 0);
  colorGradientY(spike,
    new THREE.Color('#DDEEFF'), new THREE.Color('#FFFFFF'),
    0.03 + peakH, 0.03 + peakH + spikeH);
  parts.push(ensureMergeReady(spike));

  return mergeGeometries(parts, false)!;
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
      shininess: 40,
      flatShading: true,
    });
    material.color.set(0xffffff);

    const positions = findOceanPositions(ICEBERG_COUNT, 55);
    const count = positions.length;

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const _up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const { lat, lng } = positions[i];
      const pos = latLngToPosition(lat, lng, GLOBE_RADIUS + 0.005);
      const normal = pos.clone().normalize();

      dummy.position.copy(pos);
      dummy.quaternion.setFromUnitVectors(_up, normal);
      const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
      dummy.quaternion.premultiply(yRot);

      const scale = 0.7 + Math.random() * 0.6;
      dummy.scale.set(scale, scale, scale);

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
