import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TerrainData } from '../globe/terrain';

const MOUNTAIN_COUNT = 40;
const SNOW_MOUNTAIN_COUNT = 25;

/* ---------- helpers ---------- */

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

/* ---------- mountain geometry: main peak + 2 smaller side peaks + base ---------- */

function createMountainGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Base foothills
  const base = new THREE.CylinderGeometry(0.06, 0.08, 0.02, 6);
  base.translate(0, 0.01, 0);
  colorGradientY(base,
    new THREE.Color('#B8AD9A'), new THREE.Color('#C8BBA8'),
    0, 0.02);
  parts.push(ensureMergeReady(base));

  // Main peak
  const mainH = 0.14;
  const main = new THREE.ConeGeometry(0.045, mainH, 5);
  main.translate(0, 0.02 + mainH / 2, 0);
  colorGradientY(main,
    new THREE.Color('#B8AD9A'), new THREE.Color('#DDD5C8'),
    0.02, 0.02 + mainH);
  parts.push(ensureMergeReady(main));

  // Side peak
  const sideH = 0.09;
  const side = new THREE.ConeGeometry(0.03, sideH, 5);
  side.translate(-0.035, 0.02 + sideH / 2, 0.015);
  colorGradientY(side,
    new THREE.Color('#B8AD9A'), new THREE.Color('#D0C8B8'),
    0.02, 0.02 + sideH);
  parts.push(ensureMergeReady(side));

  return mergeGeometries(parts, false)!;
}

/* ---------- snow mountain: ridge with snow cap + rocky base ---------- */

function createSnowMountainGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Rocky base
  const baseH = 0.10;
  const baseGeo = new THREE.CylinderGeometry(0.02, 0.05, baseH, 5);
  baseGeo.translate(0, baseH / 2, 0);
  colorGradientY(baseGeo,
    new THREE.Color('#B0A898'), new THREE.Color('#C8BBA8'),
    0, baseH);
  parts.push(ensureMergeReady(baseGeo));

  // Snow tip
  const tipH = 0.06;
  const tipGeo = new THREE.ConeGeometry(0.02, tipH, 5);
  tipGeo.translate(0, baseH + tipH / 2, 0);
  colorGradientY(tipGeo,
    new THREE.Color('#E8E8E8'), new THREE.Color('#FFFFFF'),
    baseH, baseH + tipH);
  parts.push(ensureMergeReady(tipGeo));

  return mergeGeometries(parts, false)!;
}

/* ---------- main class ---------- */

export class Mountains {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const highPoints = terrainData.landPoints.filter((p) => p.height > 0.5);
    const veryHighOrColdPoints = terrainData.landPoints.filter(
      (p) =>
        p.height > 0.7 ||
        (p.height > 0.5 && (p.biome === 'polar' || p.biome === 'boreal'))
    );

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 8,
      flatShading: true,
    });
    mat.color.set(0xffffff);

    // --- Regular mountains ---
    if (highPoints.length > 0) {
      const geo = createMountainGeometry();
      const shuffled = highPoints.sort(() => Math.random() - 0.5);
      const count = Math.min(MOUNTAIN_COUNT, shuffled.length);
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const point = shuffled[i];
        dummy.position.copy(point.position).setLength(point.position.length() + 0.05);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.rotateY(Math.random() * Math.PI * 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    // --- Snow-capped mountains ---
    if (veryHighOrColdPoints.length > 0) {
      const geo = createSnowMountainGeometry();
      const snowMat = mat.clone();
      snowMat.shininess = 20;
      const shuffled = veryHighOrColdPoints.sort(() => Math.random() - 0.5);
      const count = Math.min(SNOW_MOUNTAIN_COUNT, shuffled.length);
      const mesh = new THREE.InstancedMesh(geo, snowMat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const point = shuffled[i];
        dummy.position.copy(point.position).setLength(point.position.length() + 0.05);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.rotateY(Math.random() * Math.PI * 2);
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
