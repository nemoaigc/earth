import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TerrainData } from '../globe/terrain';

const MOUNTAIN_COUNT = 52;
const SNOW_MOUNTAIN_COUNT = 20;

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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function shadeColor(color: THREE.Color, amount: number): THREE.Color {
  return new THREE.Color(
    clamp01(color.r + amount),
    clamp01(color.g + amount * 0.86),
    clamp01(color.b + amount * 0.62),
  );
}

function createFacetedPeakGeometry(
  height: number,
  radiusX: number,
  radiusZ: number,
  seed: number,
  colors: THREE.Color[],
): THREE.BufferGeometry {
  const sides = 9;
  const profile = [
    { y: 0.00, rx: radiusX * 1.25, rz: radiusZ * 1.10, x: 0.00, z: 0.00, twist: 0.00, jitter: 0.10 },
    { y: height * 0.24, rx: radiusX * 0.92, rz: radiusZ * 0.86, x: -radiusX * 0.08, z: radiusZ * 0.03, twist: 0.09, jitter: 0.10 },
    { y: height * 0.52, rx: radiusX * 0.58, rz: radiusZ * 0.54, x: radiusX * 0.06, z: -radiusZ * 0.08, twist: 0.20, jitter: 0.12 },
    { y: height * 0.82, rx: radiusX * 0.28, rz: radiusZ * 0.26, x: radiusX * 0.03, z: -radiusZ * 0.04, twist: 0.34, jitter: 0.16 },
    { y: height, rx: radiusX * 0.045, rz: radiusZ * 0.040, x: radiusX * 0.12, z: -radiusZ * 0.10, twist: 0.49, jitter: 0.08 },
  ];
  const positions: number[] = [];
  const colorAttr: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring < profile.length; ring++) {
    const p = profile[ring];
    const base = colors[Math.min(colors.length - 1, ring)];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + p.twist;
      const facet = 0.92 + Math.sin(i * 1.9 + seed + ring * 0.7) * p.jitter;
      positions.push(
        p.x + Math.cos(a) * p.rx * facet,
        p.y,
        p.z + Math.sin(a) * p.rz * facet,
      );
      const c = shadeColor(base, Math.sin(a - 0.65) * 0.07 + ring * 0.006);
      colorAttr.push(c.r, c.g, c.b);
    }
  }

  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const a = ring * sides + i;
      const b = ring * sides + next;
      const c = (ring + 1) * sides + i;
      const d = (ring + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, 0, 0);
  const bottom = colors[0];
  colorAttr.push(bottom.r, bottom.g, bottom.b);
  for (let i = 0; i < sides; i++) indices.push(bottomCenter, (i + 1) % sides, i);

  const topCenter = positions.length / 3;
  const last = profile[profile.length - 1];
  positions.push(last.x, last.y, last.z);
  const top = colors[colors.length - 1];
  colorAttr.push(top.r, top.g, top.b);
  const topBase = (profile.length - 1) * sides;
  for (let i = 0; i < sides; i++) indices.push(topCenter, topBase + i, topBase + ((i + 1) % sides));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return ensureMergeReady(geometry);
}

function createFoothillDiscGeometry(radius: number, height: number, seed: number, colors: [THREE.Color, THREE.Color]): THREE.BufferGeometry {
  const sides = 14;
  const positions: number[] = [0, height, 0, 0, 0, 0];
  const colorAttr: number[] = [colors[1].r, colors[1].g, colors[1].b, colors[0].r, colors[0].g, colors[0].b];
  const indices: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const jitter = 0.88 + Math.sin(seed + i * 2.1) * 0.08 + Math.sin(seed * 0.4 + i * 4.7) * 0.04;
    const x = Math.cos(a) * radius * jitter;
    const z = Math.sin(a) * radius * 0.68 * jitter;
    positions.push(x, height, z, x * 1.04, 0, z * 1.04);
    const light = Math.sin(a - 0.8) * 0.05;
    const top = shadeColor(colors[1], light);
    const side = shadeColor(colors[0], light * 0.4);
    colorAttr.push(top.r, top.g, top.b, side.r, side.g, side.b);
  }
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const t0 = 2 + i * 2;
    const b0 = t0 + 1;
    const t1 = 2 + next * 2;
    const b1 = t1 + 1;
    indices.push(0, t1, t0, 1, b0, b1, t0, t1, b0, t1, b1, b0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return ensureMergeReady(geometry);
}

/* ---------- mountain geometry: main peak + 2 smaller side peaks + base ---------- */

function createMountainGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  parts.push(createFoothillDiscGeometry(0.082, 0.018, 3, [new THREE.Color('#8E826F'), new THREE.Color('#B6AA96')]));

  const rockColors = [
    new THREE.Color('#8F846F'),
    new THREE.Color('#A79B86'),
    new THREE.Color('#BFB39E'),
    new THREE.Color('#D0C6B4'),
    new THREE.Color('#DDD5C8'),
  ];
  const main = createFacetedPeakGeometry(0.14, 0.046, 0.038, 7, rockColors);
  main.translate(0, 0.014, 0);
  parts.push(main);

  const side = createFacetedPeakGeometry(0.088, 0.034, 0.028, 11, rockColors);
  side.rotateY(-0.35);
  side.translate(-0.034, 0.012, 0.018);
  parts.push(side);

  const side2 = createFacetedPeakGeometry(0.068, 0.026, 0.022, 17, rockColors);
  side2.rotateY(0.52);
  side2.translate(0.034, 0.010, -0.018);
  parts.push(side2);

  return mergeGeometries(parts, false)!;
}

/* ---------- high mountain: rocky ridge with a small broken snow cap ---------- */

function createSnowMountainGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  parts.push(createFoothillDiscGeometry(0.058, 0.014, 29, [new THREE.Color('#8D877A'), new THREE.Color('#B3AA9B')]));

  const rock = createFacetedPeakGeometry(0.112, 0.044, 0.034, 31, [
    new THREE.Color('#8F887A'),
    new THREE.Color('#A59E90'),
    new THREE.Color('#B9B2A4'),
    new THREE.Color('#C8C1B2'),
    new THREE.Color('#D1CCC0'),
  ]);
  rock.translate(0, 0.012, 0);
  parts.push(rock);

  const snow = createFacetedPeakGeometry(0.038, 0.017, 0.014, 37, [
    new THREE.Color('#C9D0CB'),
    new THREE.Color('#D6DAD1'),
    new THREE.Color('#E5EAE0'),
    new THREE.Color('#EEF2EA'),
    new THREE.Color('#F5F8F0'),
  ]);
  snow.translate(0.006, 0.096, -0.004);
  parts.push(snow);

  const snowRidge = createFacetedPeakGeometry(0.026, 0.010, 0.008, 41, [
    new THREE.Color('#C4CCC7'),
    new THREE.Color('#D9DFD7'),
    new THREE.Color('#EEF2EA'),
    new THREE.Color('#F5F8F0'),
    new THREE.Color('#F5F8F0'),
  ]);
  snowRidge.rotateY(0.6);
  snowRidge.translate(0.020, 0.088, 0.010);
  parts.push(snowRidge);

  return mergeGeometries(parts, false)!;
}

/* ---------- main class ---------- */

export class Mountains {
  group: THREE.Group;
  private meshes: THREE.InstancedMesh[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    const up = new THREE.Vector3(0, 1, 0);

    const highPoints = terrainData.landPoints.filter(
      (p) => p.mountain > 0.38 && p.height > 0.34,
    );
    const veryHighOrColdPoints = terrainData.landPoints.filter(
      (p) =>
        (p.mountain > 0.58 && p.height > 0.55 && p.snowBias > 0.16) ||
        (p.mountain > 0.42 && p.height > 0.44 && (p.biome === 'polar' || p.biome === 'boreal'))
    );

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 14,
      flatShading: true,
      side: THREE.DoubleSide,
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
        const normal = point.normal.clone().normalize();
        dummy.position.copy(point.position).addScaledVector(normal, 0.026);
        dummy.quaternion.setFromUnitVectors(up, normal);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        const spin = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
        dummy.quaternion.premultiply(spin);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    // --- Highest mountains: rocky body with a small snow cap ---
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
        const normal = point.normal.clone().normalize();
        dummy.position.copy(point.position).addScaledVector(normal, 0.026);
        dummy.quaternion.setFromUnitVectors(up, normal);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        const spin = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
        dummy.quaternion.premultiply(spin);
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
