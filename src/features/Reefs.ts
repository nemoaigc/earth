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

const REEF_BUILDERS = [createBrainCoralGeo, createFanCoralGeo, createBranchCoralGeo];

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

// Brain coral: bumpy flattened sphere
function createBrainCoralGeo(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.05, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 0.4);
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.01);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.01);
  }
  const colors = ['#E8887A', '#CC6688', '#DD8877'];
  colorFlat(geo, new THREE.Color(colors[Math.floor(Math.random() * colors.length)]));
  geo.computeVertexNormals();
  return geo;
}

// Fan coral: thin upright half-disc
function createFanCoralGeo(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.005, 8, 1, false, 0, Math.PI);
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(Math.PI / 2);
  geo.translate(0, 0.025, 0);
  const colors = ['#DD6699', '#EE8844', '#CC55AA'];
  colorFlat(geo, new THREE.Color(colors[Math.floor(Math.random() * colors.length)]));
  geo.computeVertexNormals();
  return geo;
}

// Branch coral: 3 thin cylinders
function createBranchCoralGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color(['#EEAA66', '#DD7788', '#AADD77'][Math.floor(Math.random() * 3)]);

  for (let i = 0; i < 3; i++) {
    const h = 0.04 + Math.random() * 0.03;
    const branch = new THREE.CylinderGeometry(0.004, 0.006, h, 4);
    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
    branch.rotateZ((Math.random() - 0.5) * 0.4);
    branch.translate(Math.cos(angle) * 0.01, h / 2, Math.sin(angle) * 0.01);
    colorFlat(branch, color);
    const ni = branch.index ? branch.toNonIndexed() : branch;
    ni.computeVertexNormals();
    if (!ni.getAttribute('uv')) {
      ni.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ni.getAttribute('position').count * 2), 2));
    }
    parts.push(ni);
  }
  return mergeGeometries(parts, false) ?? parts[0];
}

function createReefGeometry(): THREE.BufferGeometry {
  const builder = REEF_BUILDERS[Math.floor(Math.random() * REEF_BUILDERS.length)];
  return builder();
}

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
  private mesh: THREE.InstancedMesh;

  constructor(_terrainData: TerrainData) {
    this.group = new THREE.Group();

    const geometry = createReefGeometry();
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 20,
    });

    const positions = findTropicalOceanPositions(REEF_COUNT);
    const count = positions.length;

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const { lat, lng } = positions[i];
      const pos = latLngToPosition(lat, lng, GLOBE_RADIUS + 0.005);

      dummy.position.copy(pos);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);

      const scale = 0.5 + Math.random() * 0.5;
      dummy.scale.set(scale, scale, scale);

      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  update(_time: number): void {
    // Reefs are static
  }
}
