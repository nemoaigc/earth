import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Syllables for village name generation
const PREFIXES = ['Bri', 'Ston', 'Oak', 'Glen', 'Ash', 'Elm', 'Wil', 'Hol', 'Fen', 'Dun', 'Carn', 'Thorn'];
const SUFFIXES = ['vale', 'wood', 'haven', 'port', 'dale', 'bury', 'ton', 'wick', 'ford', 'stead', 'moor', 'bridge'];

function generateVillageName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return prefix + suffix;
}

const WALL_COLORS = [new THREE.Color('#e8d5b5'), new THREE.Color('#d4c4a0')];
const ROOF_COLORS = [new THREE.Color('#b44a3a'), new THREE.Color('#c45a4a'), new THREE.Color('#8a5a3a')];
const DOOR_COLOR = new THREE.Color('#5a3a2a');
const WINDOW_COLOR = new THREE.Color('#88ccff');

function setGeometryColor(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function ensureAttributes(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const ni = geo.index ? geo.toNonIndexed() : geo;
  if (!ni.getAttribute('normal')) ni.computeVertexNormals();
  if (!ni.getAttribute('uv')) {
    const count = ni.getAttribute('position').count;
    ni.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!ni.getAttribute('color')) {
    setGeometryColor(ni, new THREE.Color('#cccccc'));
  }
  return ni;
}

function buildDomeHouse(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Cylinder base
  const base = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8);
  base.translate(0, 0.02, 0);
  setGeometryColor(base, WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)]);
  parts.push(base);

  // Hemisphere dome
  const dome = new THREE.SphereGeometry(0.04, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, 0.04, 0);
  setGeometryColor(dome, ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)]);
  parts.push(dome);

  // Door
  const door = new THREE.PlaneGeometry(0.015, 0.025);
  door.translate(0, 0.0125, 0.041);
  setGeometryColor(door, DOOR_COLOR);
  parts.push(door);

  return mergeGeometries(parts.map(ensureAttributes), false);
}

function buildLShapedHouse(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const wallColor = WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)];
  const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];

  // Main box
  const main = new THREE.BoxGeometry(0.08, 0.05, 0.06);
  main.translate(0, 0.025, 0);
  setGeometryColor(main, wallColor);
  parts.push(main);

  // Wing box (L extension)
  const wing = new THREE.BoxGeometry(0.04, 0.05, 0.05);
  wing.translate(0.04, 0.025, -0.03);
  setGeometryColor(wing, wallColor);
  parts.push(wing);

  // Flat roof (slightly above)
  const roof = new THREE.BoxGeometry(0.09, 0.008, 0.07);
  roof.translate(0, 0.054, 0);
  setGeometryColor(roof, roofColor);
  parts.push(roof);

  // Window
  const win = new THREE.PlaneGeometry(0.015, 0.015);
  win.translate(-0.02, 0.03, 0.031);
  setGeometryColor(win, WINDOW_COLOR);
  parts.push(win);

  // Door
  const door = new THREE.PlaneGeometry(0.015, 0.03);
  door.translate(0.015, 0.015, 0.031);
  setGeometryColor(door, DOOR_COLOR);
  parts.push(door);

  return mergeGeometries(parts.map(ensureAttributes), false);
}

function buildTowerHouse(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const wallColor = WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)];
  const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];

  // Tall thin box
  const tower = new THREE.BoxGeometry(0.04, 0.1, 0.04);
  tower.translate(0, 0.05, 0);
  setGeometryColor(tower, wallColor);
  parts.push(tower);

  // Pointed roof (cone)
  const roof = new THREE.ConeGeometry(0.035, 0.04, 4);
  roof.translate(0, 0.12, 0);
  roof.rotateY(Math.PI / 4);
  setGeometryColor(roof, roofColor);
  parts.push(roof);

  // Window
  const win = new THREE.PlaneGeometry(0.012, 0.012);
  win.translate(0, 0.07, 0.021);
  setGeometryColor(win, WINDOW_COLOR);
  parts.push(win);

  // Door
  const door = new THREE.PlaneGeometry(0.015, 0.025);
  door.translate(0, 0.0125, 0.021);
  setGeometryColor(door, DOOR_COLOR);
  parts.push(door);

  return mergeGeometries(parts.map(ensureAttributes), false);
}

function buildMultiStoryHouse(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const wallColorLower = WALL_COLORS[0];
  const wallColorUpper = WALL_COLORS[1];
  const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];

  // Lower floor
  const lower = new THREE.BoxGeometry(0.07, 0.04, 0.06);
  lower.translate(0, 0.02, 0);
  setGeometryColor(lower, wallColorLower);
  parts.push(lower);

  // Upper floor (slightly narrower)
  const upper = new THREE.BoxGeometry(0.065, 0.035, 0.055);
  upper.translate(0, 0.0575, 0);
  setGeometryColor(upper, wallColorUpper);
  parts.push(upper);

  // Flat roof
  const roof = new THREE.BoxGeometry(0.075, 0.006, 0.065);
  roof.translate(0, 0.078, 0);
  setGeometryColor(roof, roofColor);
  parts.push(roof);

  // Windows (lower)
  const win1 = new THREE.PlaneGeometry(0.012, 0.012);
  win1.translate(-0.02, 0.025, 0.031);
  setGeometryColor(win1, WINDOW_COLOR);
  parts.push(win1);

  const win2 = new THREE.PlaneGeometry(0.012, 0.012);
  win2.translate(0.02, 0.025, 0.031);
  setGeometryColor(win2, WINDOW_COLOR);
  parts.push(win2);

  // Windows (upper)
  const win3 = new THREE.PlaneGeometry(0.012, 0.012);
  win3.translate(0, 0.055, 0.028);
  setGeometryColor(win3, WINDOW_COLOR);
  parts.push(win3);

  // Door
  const door = new THREE.PlaneGeometry(0.018, 0.028);
  door.translate(0, 0.014, 0.031);
  setGeometryColor(door, DOOR_COLOR);
  parts.push(door);

  return mergeGeometries(parts.map(ensureAttributes), false);
}

const HOUSE_BUILDERS = [buildDomeHouse, buildLShapedHouse, buildTowerHouse, buildMultiStoryHouse];

export interface VillageInfo {
  name: string;
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

export class Villages {
  group: THREE.Group;
  villages: VillageInfo[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    // Find relatively flat mid-height land points for villages
    const eligible = terrainData.landPoints.filter(
      (p) => p.height > 0.15 && p.height < 0.45
    );

    if (eligible.length === 0) return;

    const villageCount = 8 + Math.floor(Math.random() * 5); // 8-12
    const shuffled = eligible.sort(() => Math.random() - 0.5);

    // Ensure villages are spread apart
    const usedPositions: THREE.Vector3[] = [];
    const minDistance = 1.5;

    for (let v = 0; v < villageCount && shuffled.length > 0; v++) {
      // Find a point far enough from existing villages
      let centerPoint = null;
      for (let attempt = 0; attempt < shuffled.length; attempt++) {
        const candidate = shuffled[attempt];
        let tooClose = false;
        for (const used of usedPositions) {
          if (candidate.position.distanceTo(used) < minDistance) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          centerPoint = candidate;
          break;
        }
      }

      if (!centerPoint) continue;
      usedPositions.push(centerPoint.position.clone());

      const villageName = generateVillageName();
      this.villages.push({
        name: villageName,
        position: centerPoint.position.clone(),
        normal: centerPoint.normal.clone(),
      });

      // Create a village cluster of 3-6 houses
      const houseCount = 3 + Math.floor(Math.random() * 4);
      const villageGroup = new THREE.Group();

      for (let h = 0; h < houseCount; h++) {
        const builderIdx = Math.floor(Math.random() * HOUSE_BUILDERS.length);
        const houseGeo = HOUSE_BUILDERS[builderIdx]();

        const houseMesh = new THREE.Mesh(
          houseGeo,
          new THREE.MeshPhongMaterial({
            vertexColors: true,
            shininess: 15,
          })
        );

        // Offset house position within the cluster
        // Generate a small offset in the tangent plane
        const tangent = new THREE.Vector3()
          .crossVectors(centerPoint.normal, new THREE.Vector3(0, 1, 0))
          .normalize();
        if (tangent.length() < 0.1) {
          tangent.crossVectors(centerPoint.normal, new THREE.Vector3(1, 0, 0)).normalize();
        }
        const bitangent = new THREE.Vector3()
          .crossVectors(centerPoint.normal, tangent)
          .normalize();

        const offsetDist = 0.04 + Math.random() * 0.08;
        const offsetAngle = Math.random() * Math.PI * 2;
        const offset = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(offsetAngle) * offsetDist)
          .addScaledVector(bitangent, Math.sin(offsetAngle) * offsetDist);

        const housePos = centerPoint.position.clone().add(offset);
        // Re-project onto the sphere surface at the correct height
        const houseNorm = housePos.clone().normalize();
        const projectedRadius = centerPoint.position.length();
        housePos.copy(houseNorm).multiplyScalar(projectedRadius);

        houseMesh.position.copy(housePos);
        houseMesh.lookAt(0, 0, 0);
        houseMesh.rotateX(Math.PI / 2);
        houseMesh.rotateY(Math.random() * Math.PI * 2);

        const scale = 0.8 + Math.random() * 0.4;
        houseMesh.scale.set(scale, scale, scale);

        houseMesh.castShadow = true;
        houseMesh.receiveShadow = true;

        villageGroup.add(houseMesh);
      }

      this.group.add(villageGroup);
    }
  }

  update(_time: number): void {
    // Villages are static
  }
}
