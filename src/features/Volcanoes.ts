import * as THREE from 'three';
import { latLonToVec3, lonToGlobeLng } from '../geo/coordinates';
import { VOLCANOES } from '../geo/data/volcanoes';
import { GLOBE_RADIUS } from '../globe/terrain';

// Real-geo volcano layer. Positions come from src/geo/data/volcanoes.ts
// using true-world longitude, then convert through the shared coordinate
// helpers and optionally snap to the rendered terrain surface.
type SurfaceSnap = (lat: number, lng: number) => { point: THREE.Vector3; normal: THREE.Vector3 } | null;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
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

function createIrregularDiscGeometry(
  radius: number,
  height: number,
  seed: number,
  topColor: THREE.Color,
  sideColor: THREE.Color,
  sides = 15,
  squishZ = 0.72,
  bottomScale = 1.04,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topCenter = 0;
  const bottomCenter = 1;
  positions.push(0, height / 2, 0, 0, -height / 2, 0);
  colors.push(topColor.r, topColor.g, topColor.b, sideColor.r, sideColor.g, sideColor.b);

  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const jitter = 0.88 + Math.sin(i * 2.1 + seed * 12.3) * 0.08 + Math.sin(i * 4.7 + seed * 5.1) * 0.05;
    const x = Math.cos(a) * radius * jitter;
    const z = Math.sin(a) * radius * squishZ * jitter;
    positions.push(x, height / 2, z, x * bottomScale, -height / 2, z * bottomScale);
    const light = Math.sin(a - 0.8) * 0.055;
    const tc = shadeColor(topColor, light);
    const sc = shadeColor(sideColor, light * 0.4);
    colors.push(tc.r, tc.g, tc.b, sc.r, sc.g, sc.b);
  }

  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const t0 = 2 + i * 2;
    const b0 = t0 + 1;
    const t1 = 2 + next * 2;
    const b1 = t1 + 1;
    indices.push(topCenter, t1, t0, bottomCenter, b0, b1, t0, t1, b0, t1, b1, b0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFacetedBlobGeometry(
  radius: number,
  bottomColor: THREE.Color,
  topColor: THREE.Color,
  seed: number,
  flatten = 0.62,
): THREE.BufferGeometry {
  const sides = 8;
  const layers = 4;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const t = layer / (layers - 1);
    const y = (t - 0.5) * radius * 2 * flatten;
    const w = Math.sin(t * Math.PI) * radius * (0.92 + Math.sin(seed + layer * 1.7) * 0.08);
    const baseColor = bottomColor.clone().lerp(topColor, t);
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + layer * 0.18 + seed * 0.04;
      const facet = 0.92 + Math.sin(i * 1.9 + seed + layer * 0.7) * 0.11;
      positions.push(
        Math.cos(a) * w * (1.06 + Math.sin(seed + layer) * 0.08) * facet,
        y,
        Math.sin(a) * w * (0.86 + Math.cos(seed + layer) * 0.07) * facet,
      );
      const c = shadeColor(baseColor, Math.sin(a - 0.7) * 0.08 + layer * 0.006);
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let layer = 0; layer < layers - 1; layer++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const a = layer * sides + i;
      const b = layer * sides + next;
      const c = (layer + 1) * sides + i;
      const d = (layer + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createVolcanoBodyGeometry(size: number, seed: number): THREE.BufferGeometry {
  const radialSegments = 28;
  const profile = [
    { y: -0.07, rx: 1.72, rz: 1.52, x: 0.00, z: 0.00, c: new THREE.Color('#8D6849') },
    { y: -0.02, rx: 1.58, rz: 1.42, x: 0.00, z: 0.00, c: new THREE.Color('#B08258') },
    { y: 0.08, rx: 1.28, rz: 1.16, x: -0.01, z: 0.01, c: new THREE.Color('#C0895E') },
    { y: 0.20, rx: 0.98, rz: 0.88, x: 0.01, z: 0.00, c: new THREE.Color('#AA7054') },
    { y: 0.31, rx: 0.70, rz: 0.64, x: 0.00, z: -0.01, c: new THREE.Color('#8E5745') },
    { y: 0.38, rx: 0.54, rz: 0.49, x: 0.01, z: 0.00, c: new THREE.Color('#6D4035') },
  ];

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring < profile.length; ring++) {
    const p = profile[ring];
    const yNorm = p.y;
    for (let seg = 0; seg < radialSegments; seg++) {
      const a = (seg / radialSegments) * Math.PI * 2;
      const flankNoise =
        Math.sin(a * 3 + seed * 12.7) * 0.018 +
        Math.sin(a * 7 + seed * 31.3 + ring * 0.45) * 0.010;
      const jitter = 1 + flankNoise * (1 - yNorm * 0.35);
      positions.push(
        (p.x + Math.cos(a) * p.rx * jitter) * size,
        p.y * size,
        (p.z + Math.sin(a) * p.rz * jitter) * size,
      );

      const shade = 0.94 + Math.sin(a * 2 + ring * 1.2 + seed * 8) * 0.035;
      colors.push(
        Math.max(0, Math.min(1, p.c.r * shade)),
        Math.max(0, Math.min(1, p.c.g * shade)),
        Math.max(0, Math.min(1, p.c.b * shade)),
      );
    }
  }

  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let seg = 0; seg < radialSegments; seg++) {
      const next = (seg + 1) % radialSegments;
      const a = ring * radialSegments + seg;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + seg;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const bottomCenter = positions.length / 3;
  const bottom = profile[0];
  positions.push(bottom.x * size, bottom.y * size, bottom.z * size);
  colors.push(bottom.c.r, bottom.c.g, bottom.c.b);
  for (let seg = 0; seg < radialSegments; seg++) {
    indices.push(bottomCenter, (seg + 1) % radialSegments, seg);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCraterGlowGeometry(size: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(size * 0.20, 24);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(size * 0.02, size * 0.392, -size * 0.005);
  return geometry;
}

function createSmokePlume(size: number, material: THREE.MeshPhongMaterial, seed: number): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const puffGeometry = new THREE.SphereGeometry(size * (0.16 + t * 0.13), 16, 10);
    const puff = new THREE.Mesh(puffGeometry, material.clone());
    const angle = seed * Math.PI * 2 + i * 1.37;
    const drift = size * (0.03 + t * 0.16);
    puff.position.set(
      Math.cos(angle) * drift,
      size * (0.90 + t * 0.30),
      Math.sin(angle) * drift,
    );
    puff.scale.set(1.10 - t * 0.12, 0.78 + t * 0.22, 0.96);
    group.add(puff);
  }
  return group;
}

export class Volcanoes {
  group: THREE.Group;
  private smokes: { group: THREE.Group; phase: number; baseScale: number }[] = [];

  constructor(snapToSurface?: SurfaceSnap) {
    this.group = new THREE.Group();

    const bodyMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      flatShading: false,
      shininess: 8,
    });
    bodyMat.specular.set('#3A2A22');
    const lavaMat = new THREE.MeshPhongMaterial({
      color: '#E76B35',
      flatShading: false,
      emissive: '#D3401B',
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide,
    });
    const craterMat = new THREE.MeshPhongMaterial({
      color: '#241512',
      emissive: '#160A08',
      emissiveIntensity: 0.04,
      flatShading: false,
      shininess: 4,
      side: THREE.DoubleSide,
    });
    const smokeMat = new THREE.MeshPhongMaterial({
      color: '#F1ECDD',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      flatShading: false,
      shininess: 10,
    });

    const basePoint = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const v of VOLCANOES) {
      const seed = hashString(v.id);
      const visualSize = v.size * 1.24;
      const volcano = new THREE.Group();

      const body = new THREE.Mesh(createVolcanoBodyGeometry(visualSize, seed), bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      volcano.add(body);

      const craterFloor = new THREE.Mesh(
        (() => {
          const geo = new THREE.CircleGeometry(visualSize * 0.31, 28);
          geo.rotateX(-Math.PI / 2);
          return geo;
        })(),
        craterMat,
      );
      craterFloor.position.set(visualSize * 0.02, visualSize * 0.386, -visualSize * 0.004);
      volcano.add(craterFloor);

      if (v.smoke) {
        const lava = new THREE.Mesh(createCraterGlowGeometry(visualSize), lavaMat);
        volcano.add(lava);
      }

      // Place + orient onto the sphere surface.
      const globeLng = lonToGlobeLng(v.position.lon);
      const snapped = snapToSurface?.(v.position.lat, globeLng);
      if (snapped) {
        basePoint.copy(snapped.point);
        normal.copy(basePoint).normalize();
      } else {
        latLonToVec3(v.position.lat, v.position.lon, GLOBE_RADIUS, basePoint);
        normal.copy(basePoint).normalize();
      }
      volcano.position.copy(basePoint).addScaledVector(normal, -visualSize * 0.080);
      volcano.quaternion.setFromUnitVectors(up, normal);
      this.group.add(volcano);

      // Optional smoke plume — actual 3D puffs, not a billboard sprite.
      if (v.smoke) {
        const smoke = createSmokePlume(visualSize, smokeMat, seed);
        volcano.add(smoke);
        this.smokes.push({
          group: smoke,
          phase: Math.sin((v.position.lat + v.position.lon) * 9.13) * Math.PI,  // deterministic
          baseScale: 1,
        });
      }
    }
  }

  update(time: number): void {
    // Gentle pulse on the smoke so the volcanoes feel alive.
    for (const s of this.smokes) {
      const t = time * 0.6 + s.phase;
      const opacity = 0.20 + Math.sin(t) * 0.05;
      s.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = mesh.material as THREE.MeshPhongMaterial | undefined;
        if (material) material.opacity = opacity;
      });
      const scale = s.baseScale * (1.0 + Math.sin(t * 0.7) * 0.05);
      s.group.scale.set(scale, scale, scale);
    }
  }
}
