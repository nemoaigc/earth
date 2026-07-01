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
  const radialSegments = 14;
  const profile = [
    { y: 0.06, rx: 1.34, rz: 0.92, x: 0.00, z: 0.02, c: new THREE.Color('#6B4B36') },
    { y: 0.24, rx: 1.12, rz: 0.76, x: -0.04, z: 0.00, c: new THREE.Color('#744C34') },
    { y: 0.48, rx: 0.88, rz: 0.62, x: 0.02, z: -0.02, c: new THREE.Color('#654130') },
    { y: 0.70, rx: 0.66, rz: 0.48, x: 0.00, z: -0.03, c: new THREE.Color('#55362B') },
    { y: 0.90, rx: 0.52, rz: 0.38, x: 0.03, z: -0.02, c: new THREE.Color('#342620') },
    { y: 1.00, rx: 0.63, rz: 0.43, x: 0.00, z: -0.01, c: new THREE.Color('#7B5135') }, // broken raised rim
    { y: 0.92, rx: 0.34, rz: 0.24, x: 0.01, z: -0.01, c: new THREE.Color('#251916') }, // inner wall
    { y: 0.83, rx: 0.22, rz: 0.16, x: 0.02, z: 0.00, c: new THREE.Color('#15100E') }, // crater floor edge
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
        Math.sin(a * 3 + seed * 12.7) * 0.055 +
        Math.sin(a * 7 + seed * 31.3 + ring * 0.45) * 0.030;
      const rimNoise = ring >= profile.length - 3 ? Math.sin(a * 5 + seed * 19.1) * 0.075 : 0;
      const jitter = 1 + flankNoise * (1 - yNorm * 0.45) + rimNoise;
      positions.push(
        (p.x + Math.cos(a) * p.rx * jitter) * size,
        p.y * size,
        (p.z + Math.sin(a) * p.rz * jitter) * size,
      );

      const shade = 0.86 + Math.sin(a * 4 + ring * 1.7 + seed * 8) * 0.07;
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCraterGlowGeometry(size: number): THREE.BufferGeometry {
  const geometry = createIrregularDiscGeometry(
    size * 0.14,
    size * 0.014,
    26,
    new THREE.Color('#E96632'),
    new THREE.Color('#782713'),
    7,
    0.74,
  );
  geometry.translate(size * 0.03, size * 0.86, -size * 0.01);
  return geometry;
}

function createSmokePlume(size: number, material: THREE.MeshPhongMaterial, seed: number): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const puffGeometry = createFacetedBlobGeometry(
      size * (0.24 + t * 0.25),
      new THREE.Color('#A69D8B'),
      new THREE.Color('#E0D8C8'),
      seed * 41 + i,
      0.72,
    );
    const puff = new THREE.Mesh(puffGeometry, material.clone());
    const angle = seed * Math.PI * 2 + i * 1.37;
    const drift = size * (0.05 + t * 0.22);
    puff.position.set(
      Math.cos(angle) * drift,
      size * (1.08 + t * 0.34),
      Math.sin(angle) * drift,
    );
    puff.scale.set(1.15 - t * 0.2, 0.72 + t * 0.2, 0.9);
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
      flatShading: true,
      shininess: 18,
    });
    const lavaMat = new THREE.MeshPhongMaterial({
      color: '#E5763A',
      flatShading: true,
      emissive: '#C53A10',
      emissiveIntensity: 0.42,
    });
    const craterMat = new THREE.MeshPhongMaterial({
      color: '#201713',
      emissive: '#3B1208',
      emissiveIntensity: 0.12,
      flatShading: true,
      shininess: 18,
    });
    const smokeMat = new THREE.MeshPhongMaterial({
      color: '#D6D4CE',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      flatShading: true,
      shininess: 4,
    });

    const basePoint = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const v of VOLCANOES) {
      const seed = hashString(v.id);
      const visualSize = v.size * 1.55;
      const volcano = new THREE.Group();

      const base = new THREE.Mesh(
        createIrregularDiscGeometry(
          visualSize * 1.52,
          visualSize * 0.12,
          seed,
          new THREE.Color('#40302A'),
          new THREE.Color('#211813'),
          15,
          0.70,
          1.22,
        ),
        bodyMat,
      );
      base.position.y = -visualSize * 0.005;
      base.castShadow = true;
      base.receiveShadow = true;
      volcano.add(base);

      const shoulder = new THREE.Mesh(
        createIrregularDiscGeometry(
          visualSize * 1.05,
          visualSize * 0.035,
          seed * 3.7,
          new THREE.Color('#5A3D2E'),
          new THREE.Color('#2A1C17'),
          12,
          0.62,
          1.10,
        ),
        bodyMat,
      );
      shoulder.position.set(-visualSize * 0.04, visualSize * 0.085, visualSize * 0.02);
      shoulder.castShadow = true;
      shoulder.receiveShadow = true;
      volcano.add(shoulder);

      const body = new THREE.Mesh(createVolcanoBodyGeometry(visualSize, seed), bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      volcano.add(body);

      const craterFloor = new THREE.Mesh(
        createIrregularDiscGeometry(
          visualSize * 0.23,
          visualSize * 0.018,
          seed * 5.2,
          new THREE.Color('#21110C'),
          new THREE.Color('#100908'),
          8,
          0.72,
        ),
        craterMat,
      );
      craterFloor.position.set(visualSize * 0.02, visualSize * 0.86, -visualSize * 0.005);
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
      volcano.position.copy(basePoint).addScaledVector(normal, visualSize * 0.045);
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
