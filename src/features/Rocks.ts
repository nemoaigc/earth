import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const ROCK_COUNT = 400;

// ─── Geometry builders ──────────────────────────────────────────────────────

function createBoulderGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.048, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const r = 0.85 + Math.random() * 0.3;
    pos.setX(i, pos.getX(i) * r + (Math.random() - 0.5) * 0.018);
    pos.setY(i, pos.getY(i) * (0.6 + Math.random() * 0.35));
    pos.setZ(i, pos.getZ(i) * r + (Math.random() - 0.5) * 0.018);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createCraggyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(0.052, 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.024);
    pos.setY(i, pos.getY(i) * (0.9 + Math.random() * 0.8));
    pos.setZ(i, pos.getZ(i) * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.024);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSlabGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.062, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * (1.1 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.015);
    pos.setY(i, pos.getY(i) * (0.18 + Math.random() * 0.14));
    pos.setZ(i, pos.getZ(i) * (1.1 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.015);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSpireGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.026, 0.1, 5, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.018);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.018);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const SHAPE_FACTORIES = [
  createBoulderGeometry,
  createCraggyGeometry,
  createSlabGeometry,
  createSpireGeometry,
];

// ─── Biome-aware palettes ────────────────────────────────────────────────────

interface RockPalette { base: string; shadow: string; highlight: string; moss?: string }

const BIOME_PALETTES: Record<string, RockPalette> = {
  tropical:  { base: '#7A7060', shadow: '#4A4438', highlight: '#A89880', moss: '#688055' },
  temperate: { base: '#8A8880', shadow: '#585650', highlight: '#B8B0A0', moss: '#7A9268' },
  boreal:    { base: '#707878', shadow: '#484E50', highlight: '#A0A8A8', moss: '#607860' },
  desert:    { base: '#C8A870', shadow: '#907848', highlight: '#E8C890' },
  polar:     { base: '#B8C4D0', shadow: '#7888A0', highlight: '#D8E4F0' },
};

function applyRockColors(geo: THREE.BufferGeometry, palette: RockPalette): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const shadow = new THREE.Color(palette.shadow);
  const base   = new THREE.Color(palette.base);
  const top    = new THREE.Color(palette.moss ?? palette.highlight);
  const tmp    = new THREE.Color();

  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const yRange = (yMax - yMin) || 0.001;

  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - yMin) / yRange;
    if (t < 0.45) {
      tmp.lerpColors(shadow, base, t / 0.45);
    } else {
      tmp.lerpColors(base, top, (t - 0.45) / 0.55);
    }
    const n = (Math.random() - 0.5) * 0.045;
    colors[i * 3]     = Math.max(0, Math.min(1, tmp.r + n));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, tmp.g + n));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, tmp.b + n));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ─── Main class ─────────────────────────────────────────────────────────────

export class Rocks {
  group: THREE.Group;

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 6,
      flatShading: true,
    });

    const eligible = terrainData.landPoints.filter(p => p.height > 0.05 && p.height < 0.78);
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const count = Math.min(ROCK_COUNT, shuffled.length);

    type BucketKey = string;
    const buckets = new Map<BucketKey, { geo: THREE.BufferGeometry; matrices: THREE.Matrix4[] }>();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const pt      = shuffled[i];
      const biome   = pt.biome;
      const shapeBias = pt.height > 0.45 ? [1, 1, 3, 3] : [0, 0, 0, 1, 2];
      const shapeIdx  = shapeBias[Math.floor(Math.random() * shapeBias.length)];
      const key       = `${biome}_${shapeIdx}`;

      if (!buckets.has(key)) {
        const geo = SHAPE_FACTORIES[shapeIdx]();
        const palette = BIOME_PALETTES[biome] ?? BIOME_PALETTES.temperate;
        applyRockColors(geo, palette);
        buckets.set(key, { geo, matrices: [] });
      }

      dummy.position.copy(pt.position);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);

      const s  = 0.45 + Math.random() * 1.1;
      const sy = s * (0.5 + Math.random() * 0.7);
      dummy.scale.set(
        s  * (0.75 + Math.random() * 0.5),
        sy,
        s  * (0.75 + Math.random() * 0.5),
      );
      dummy.rotateY(Math.random() * Math.PI * 2);
      dummy.rotateZ((Math.random() - 0.5) * 0.7);
      dummy.updateMatrix();
      buckets.get(key)!.matrices.push(dummy.matrix.clone());
    }

    for (const { geo, matrices } of buckets.values()) {
      if (matrices.length === 0) continue;
      const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
      mesh.castShadow = true;
      for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
  }

  update(_time: number): void {}
}
