import * as THREE from 'three';
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

function createReefGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.04, 6, 4);

  // Flatten Y
  geo.scale(1, 0.3, 1);

  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#ddcc88');
  const green = new THREE.Color('#77aa55');

  for (let i = 0; i < pos.count; i++) {
    // Top vertices get green, sides get sand
    const y = pos.getY(i);
    const c = y > 0.005 ? green : sand;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
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
