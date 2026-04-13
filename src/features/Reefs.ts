import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';
import { createWorldMask } from '../globe/worldmap';

const REEF_COUNT = 18;

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.sin(theta) * radius,
  );
}

/* ---------- helpers ---------- */

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

function colorFlat(geo: THREE.BufferGeometry, color: THREE.Color): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function ensureMergeReady(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

/* ---------- coral geometry builders (tree-style: base + vertical structures) ---------- */

// Brain coral: rocky base + dome on top
function createBrainCoralGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Sandy base
  const base = new THREE.CylinderGeometry(0.06, 0.08, 0.02, 6);
  base.translate(0, 0.01, 0);
  colorFlat(base, new THREE.Color('#DDC888'));
  parts.push(ensureMergeReady(base));

  // Brain dome
  const dome = new THREE.DodecahedronGeometry(0.05, 1);
  const dp = dome.getAttribute('position');
  for (let i = 0; i < dp.count; i++) {
    // Flatten bottom, keep top bumpy
    if (dp.getY(i) < 0) dp.setY(i, dp.getY(i) * 0.2);
    dp.setX(i, dp.getX(i) + (Math.random() - 0.5) * 0.008);
    dp.setZ(i, dp.getZ(i) + (Math.random() - 0.5) * 0.008);
  }
  dome.translate(0, 0.03, 0);
  colorGradientY(dome,
    new THREE.Color('#CC5566'), new THREE.Color('#EE8899'),
    0.02, 0.08);
  parts.push(ensureMergeReady(dome));

  return mergeGeometries(parts, false)!;
}

// Branch coral: base + 4-5 upward cylinders with tips
function createBranchCoralGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Sandy base
  const base = new THREE.CylinderGeometry(0.04, 0.05, 0.015, 6);
  base.translate(0, 0.0075, 0);
  colorFlat(base, new THREE.Color('#DDC888'));
  parts.push(ensureMergeReady(base));

  // 4-5 branches growing upward
  const branchCount = 4 + Math.floor(Math.random() * 2);
  const branchColor = ['#EE8844', '#DDAA55', '#CCDD66'][Math.floor(Math.random() * 3)];

  for (let i = 0; i < branchCount; i++) {
    const h = 0.06 + Math.random() * 0.04;
    const angle = (i / branchCount) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 0.01 + Math.random() * 0.015;
    const tilt = (Math.random() - 0.5) * 0.3;

    // Branch stem
    const branch = new THREE.CylinderGeometry(0.005, 0.008, h, 5);
    branch.translate(0, h / 2, 0);
    branch.rotateZ(tilt);
    branch.translate(Math.cos(angle) * dist, 0.015, Math.sin(angle) * dist);
    colorGradientY(branch,
      new THREE.Color(branchColor).multiplyScalar(0.8),
      new THREE.Color(branchColor),
      0, h);
    parts.push(ensureMergeReady(branch));

    // Tip blob
    const tip = new THREE.SphereGeometry(0.008, 4, 3);
    tip.translate(
      Math.cos(angle) * dist + Math.sin(tilt) * h * 0.3,
      0.015 + h * 0.95,
      Math.sin(angle) * dist,
    );
    colorFlat(tip, new THREE.Color(branchColor));
    parts.push(ensureMergeReady(tip));
  }

  return mergeGeometries(parts, false)!;
}

// Fan coral: base + tall thin fan shape
function createFanCoralGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Sandy base
  const base = new THREE.CylinderGeometry(0.03, 0.04, 0.015, 6);
  base.translate(0, 0.0075, 0);
  colorFlat(base, new THREE.Color('#DDC888'));
  parts.push(ensureMergeReady(base));

  // Stem
  const stemH = 0.03;
  const stem = new THREE.CylinderGeometry(0.006, 0.008, stemH, 5);
  stem.translate(0, 0.015 + stemH / 2, 0);
  colorFlat(stem, new THREE.Color('#AA5577'));
  parts.push(ensureMergeReady(stem));

  // Fan (half-disc standing upright)
  const fanR = 0.05;
  const fan = new THREE.CircleGeometry(fanR, 8, 0, Math.PI);
  fan.rotateX(-Math.PI / 2);
  fan.rotateY(Math.PI / 2);
  fan.translate(0, 0.015 + stemH + fanR * 0.5, 0);
  const fanColor = ['#DD5588', '#EE6699', '#CC4488'][Math.floor(Math.random() * 3)];
  colorGradientY(fan,
    new THREE.Color(fanColor).multiplyScalar(0.7),
    new THREE.Color(fanColor),
    0.015 + stemH, 0.015 + stemH + fanR);
  parts.push(ensureMergeReady(fan));

  return mergeGeometries(parts, false)!;
}

const REEF_BUILDERS = [createBrainCoralGeo, createBranchCoralGeo, createFanCoralGeo];

/* ---------- placement ---------- */

function findTropicalOceanPositions(count: number): { lat: number; lng: number }[] {
  const mask = createWorldMask();
  const results: { lat: number; lng: number }[] = [];
  let attempts = 0;

  while (results.length < count && attempts < 5000) {
    attempts++;
    const lat = Math.random() * 50 - 25;
    const lng = Math.random() * 360 - 180;
    if (!mask.isLand(lat, lng)) {
      results.push({ lat, lng });
    }
  }
  return results;
}

export class Reefs {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];

  constructor(_terrainData: TerrainData) {
    this.group = new THREE.Group();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 25,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    material.color.set(0xffffff);

    const positions = findTropicalOceanPositions(REEF_COUNT);
    const perType = Math.ceil(positions.length / REEF_BUILDERS.length);

    for (let t = 0; t < REEF_BUILDERS.length; t++) {
      const geo = REEF_BUILDERS[t]();
      const start = t * perType;
      const end = Math.min(start + perType, positions.length);
      const count = end - start;
      if (count <= 0) continue;

      const mesh = new THREE.InstancedMesh(geo, material, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const dummy = new THREE.Object3D();
      const _up = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i < count; i++) {
        const { lat, lng } = positions[start + i];
        const pos = latLngToPosition(lat, lng, GLOBE_RADIUS + 0.005);
        const normal = pos.clone().normalize();

        dummy.position.copy(pos);
        dummy.quaternion.setFromUnitVectors(_up, normal);
        const yRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
        dummy.quaternion.premultiply(yRot);

        const scale = 0.8 + Math.random() * 0.5;
        dummy.scale.set(scale, scale, scale);

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
