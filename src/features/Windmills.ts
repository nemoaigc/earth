import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const WINDMILL_COUNT_MIN = 6;
const WINDMILL_COUNT_MAX = 8;

function buildWindmill(): THREE.Group {
  const windmill = new THREE.Group();

  // --- Base platform (stone foundation) ---
  const baseGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.025, 8);
  baseGeo.translate(0, 0.0125, 0);
  const baseMat = new THREE.MeshPhongMaterial({ color: '#A0988A', shininess: 8, flatShading: true });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.castShadow = true;
  base.receiveShadow = true;
  windmill.add(base);

  // --- Tower: tapered cylinder ---
  const towerGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.2, 8);
  towerGeo.translate(0, 0.025 + 0.1, 0);
  const towerMat = new THREE.MeshPhongMaterial({ color: '#f0e8d8', shininess: 15, flatShading: true });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.castShadow = true;
  tower.receiveShadow = true;
  windmill.add(tower);

  // --- Balcony ring at blade height ---
  const balconyGeo = new THREE.TorusGeometry(0.025, 0.003, 4, 8);
  balconyGeo.rotateX(Math.PI / 2);
  balconyGeo.translate(0, 0.22, 0);
  const balconyMat = new THREE.MeshPhongMaterial({ color: '#8A7A6A', shininess: 10 });
  const balcony = new THREE.Mesh(balconyGeo, balconyMat);
  windmill.add(balcony);

  // --- Cap on top ---
  const capGeo = new THREE.ConeGeometry(0.025, 0.025, 8);
  capGeo.translate(0, 0.235, 0);
  const capMat = new THREE.MeshPhongMaterial({ color: '#8a7a6a', shininess: 20, flatShading: true });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.castShadow = true;
  windmill.add(cap);

  // --- Blade hub + blades ---
  const bladeHub = new THREE.Group();
  bladeHub.position.set(0, 0.225, 0.028);

  const hubGeo = new THREE.SphereGeometry(0.008, 6, 6);
  const hubMat = new THREE.MeshPhongMaterial({ color: '#888888', shininess: 30 });
  bladeHub.add(new THREE.Mesh(hubGeo, hubMat));

  // 4 blades — thin boxes instead of planes for thickness
  const bladeMat = new THREE.MeshPhongMaterial({ color: '#f0e8d8', shininess: 10, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const bladeGeo = new THREE.BoxGeometry(0.014, 0.1, 0.003);
    bladeGeo.translate(0, 0.055, 0);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    blade.castShadow = true;
    bladeHub.add(blade);
  }

  windmill.userData.bladeHub = bladeHub;
  windmill.add(bladeHub);

  return windmill;
}

export class Windmills {
  group: THREE.Group;
  private bladeHubs: THREE.Group[] = [];
  private rotationSpeeds: number[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

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

      this.bladeHubs.push(windmill.userData.bladeHub as THREE.Group);
      this.rotationSpeeds.push(1.5 + Math.random() * 1.5);

      this.group.add(windmill);
    }
  }

  update(time: number): void {
    for (let i = 0; i < this.bladeHubs.length; i++) {
      this.bladeHubs[i].rotation.z = time * this.rotationSpeeds[i];
    }
  }
}
