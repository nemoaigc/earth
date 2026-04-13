import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TerrainData } from '../globe/terrain';

const MOUNTAIN_COUNT = 50;
const SNOW_MOUNTAIN_COUNT = 30;
const MOUNTAIN_COLORS = ['#888888', '#777766', '#999988'];
const SNOW_COLORS = ['#ffffff', '#eeeeff'];

function createMountainGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.11, 0.35, 5);
  geometry.translate(0, 0.35 / 2, 0);

  const posAttr = geometry.getAttribute('position');
  const colors = new Float32Array(posAttr.count * 3);
  const baseColor = new THREE.Color('#777766');
  for (let i = 0; i < posAttr.count; i++) {
    colors[i * 3] = baseColor.r;
    colors[i * 3 + 1] = baseColor.g;
    colors[i * 3 + 2] = baseColor.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createSnowMountainGeometry(): THREE.BufferGeometry {
  const totalHeight = 0.25;
  const radius = 0.08;
  const snowFraction = 0.3;

  // Base cone (bottom 70%)
  const baseHeight = totalHeight * (1 - snowFraction);
  const baseTopRadius = radius * snowFraction;
  const baseGeo = new THREE.CylinderGeometry(
    baseTopRadius,
    radius,
    baseHeight,
    5
  );
  baseGeo.translate(0, baseHeight / 2, 0);

  const basePos = baseGeo.getAttribute('position');
  const baseColors = new Float32Array(basePos.count * 3);
  const grayColor = new THREE.Color('#888888');
  for (let i = 0; i < basePos.count; i++) {
    baseColors[i * 3] = grayColor.r;
    baseColors[i * 3 + 1] = grayColor.g;
    baseColors[i * 3 + 2] = grayColor.b;
  }
  baseGeo.setAttribute('color', new THREE.BufferAttribute(baseColors, 3));

  // Snow tip (top 30%)
  const tipHeight = totalHeight * snowFraction;
  const tipGeo = new THREE.ConeGeometry(baseTopRadius, tipHeight, 5);
  tipGeo.translate(0, baseHeight + tipHeight / 2, 0);

  const tipPos = tipGeo.getAttribute('position');
  const tipColors = new Float32Array(tipPos.count * 3);
  const snowColor = new THREE.Color('#ffffff');
  for (let i = 0; i < tipPos.count; i++) {
    tipColors[i * 3] = snowColor.r;
    tipColors[i * 3 + 1] = snowColor.g;
    tipColors[i * 3 + 2] = snowColor.b;
  }
  tipGeo.setAttribute('color', new THREE.BufferAttribute(tipColors, 3));

  // Ensure both have matching attributes for merge
  const parts = [baseGeo, tipGeo].map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    if (!ni.getAttribute('normal')) ni.computeVertexNormals();
    if (!ni.getAttribute('uv')) {
      const count = ni.getAttribute('position').count;
      ni.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(count * 2), 2)
      );
    }
    return ni;
  });

  return mergeGeometries(parts, false);
}

export class Mountains {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const highPoints = terrainData.landPoints.filter((p) => p.height > 0.5);
    const veryHighOrColdPoints = terrainData.landPoints.filter(
      (p) =>
        p.height > 0.7 ||
        (p.height > 0.5 &&
          (p.biome === 'polar' || p.biome === 'boreal'))
    );

    // --- Regular mountains ---
    if (highPoints.length > 0) {
      const mountainGeo = createMountainGeometry();
      const mountainMat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 5,
        flatShading: true,
      });

      const shuffled = highPoints.sort(() => Math.random() - 0.5);
      const count = Math.min(MOUNTAIN_COUNT, shuffled.length);
      const mesh = new THREE.InstancedMesh(mountainGeo, mountainMat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const point = shuffled[i];
        dummy.position.copy(point.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);

        const scale = 0.8 + Math.random() * 0.7;
        dummy.scale.set(scale, scale, scale);
        dummy.rotateY(Math.random() * Math.PI * 2);

        // Tint with a random mountain color
        const color = new THREE.Color(
          MOUNTAIN_COLORS[Math.floor(Math.random() * MOUNTAIN_COLORS.length)]
        );
        mesh.setColorAt(i, color);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    // --- Snow-capped mountains ---
    if (veryHighOrColdPoints.length > 0) {
      const snowGeo = createSnowMountainGeometry();
      const snowMat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 15,
        flatShading: true,
      });

      const shuffled = veryHighOrColdPoints.sort(() => Math.random() - 0.5);
      const count = Math.min(SNOW_MOUNTAIN_COUNT, shuffled.length);
      const mesh = new THREE.InstancedMesh(snowGeo, snowMat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const point = shuffled[i];
        dummy.position.copy(point.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);

        const scale = 0.8 + Math.random() * 0.7;
        dummy.scale.set(scale, scale, scale);
        dummy.rotateY(Math.random() * Math.PI * 2);

        // Tint snow cap color
        const color = new THREE.Color(
          SNOW_COLORS[Math.floor(Math.random() * SNOW_COLORS.length)]
        );
        mesh.setColorAt(i, color);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  update(_time: number): void {
    // Mountains don't animate
  }
}
