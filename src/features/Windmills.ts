import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const WINDMILL_COUNT_MIN = 6;
const WINDMILL_COUNT_MAX = 8;

function buildWindmill(): THREE.Group {
  const windmill = new THREE.Group();

  // --- Tower: tapered cylinder ---
  const towerGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.2, 8);
  towerGeo.translate(0, 0.1, 0);
  const towerMat = new THREE.MeshPhongMaterial({ color: '#f0e8d8', shininess: 15 });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.castShadow = true;
  windmill.add(tower);

  // --- Platform/cap on top ---
  const capGeo = new THREE.CylinderGeometry(0.025, 0.022, 0.02, 8);
  capGeo.translate(0, 0.21, 0);
  const capMat = new THREE.MeshPhongMaterial({ color: '#8a7a6a', shininess: 20 });
  const cap = new THREE.Mesh(capGeo, capMat);
  windmill.add(cap);

  // --- Blade hub + blades ---
  const bladeHub = new THREE.Group();
  bladeHub.position.set(0, 0.21, 0.028);

  // Hub sphere
  const hubGeo = new THREE.SphereGeometry(0.008, 6, 6);
  const hubMat = new THREE.MeshPhongMaterial({ color: '#666666', shininess: 30 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  bladeHub.add(hub);

  // 4 blades in cross pattern
  const bladeMat = new THREE.MeshPhongMaterial({
    color: '#e8e0d0',
    side: THREE.DoubleSide,
    shininess: 10,
  });

  for (let i = 0; i < 4; i++) {
    const bladeGeo = new THREE.PlaneGeometry(0.012, 0.1);
    bladeGeo.translate(0, 0.055, 0); // offset so base is at center
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    blade.castShadow = true;
    bladeHub.add(blade);
  }

  // Store reference for rotation
  windmill.userData.bladeHub = bladeHub;
  windmill.add(bladeHub);

  return windmill;
}

export class Windmills {
  group: THREE.Group;
  private windmillGroups: THREE.Group[] = [];
  private bladeHubs: THREE.Group[] = [];
  private rotationSpeeds: number[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    // Filter eligible points: moderate height
    const eligible = terrainData.landPoints.filter(
      (p) => p.height > 0.2 && p.height < 0.5
    );

    if (eligible.length === 0) return;

    const count = WINDMILL_COUNT_MIN + Math.floor(
      Math.random() * (WINDMILL_COUNT_MAX - WINDMILL_COUNT_MIN + 1)
    );
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const actual = Math.min(count, shuffled.length);

    for (let i = 0; i < actual; i++) {
      const point = shuffled[i];
      const windmill = buildWindmill();

      windmill.position.copy(point.position);
      windmill.lookAt(0, 0, 0);
      windmill.rotateX(Math.PI / 2);
      windmill.rotateY(Math.random() * Math.PI * 2);

      const scale = 0.8 + Math.random() * 0.4;
      windmill.scale.set(scale, scale, scale);

      this.windmillGroups.push(windmill);
      this.bladeHubs.push(windmill.userData.bladeHub as THREE.Group);
      this.rotationSpeeds.push(1.5 + Math.random() * 1.5);

      this.group.add(windmill);
    }
  }

  update(time: number): void {
    for (let i = 0; i < this.bladeHubs.length; i++) {
      // Rotate blades around the local Z axis (forward-facing axis from hub)
      this.bladeHubs[i].rotation.z = time * this.rotationSpeeds[i];
    }
  }
}
