import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

// 4 shape variants so not every rock looks identical.
// Each is a squashed IcosahedronGeometry(1, 0) — 20 angular faces, clearly a rock.
// Geometry Y is strongly flattened so rocks sit wide & low on terrain.
const VARIANTS = 4;
const PER_VARIANT = 18; // 4 × 18 = 72 rocks total

const BIOME_COLORS: Record<string, THREE.Color> = {
  tropical:  new THREE.Color('#8A7A6A'),
  temperate: new THREE.Color('#8A8272'),
  boreal:    new THREE.Color('#727268'),
  desert:    new THREE.Color('#C8A870'),
  polar:     new THREE.Color('#B0BCC8'),
};
const DEFAULT_COLOR = new THREE.Color('#8A8070');

/**
 * One boulder geometry: IcosahedronGeometry(1,0) with each vertex non-uniformly
 * scaled so it looks chunky and irregular, but Y is heavily squashed so it reads
 * as a flat stone sitting on the ground, not a pillar.
 * Geometry radius ≈ 1 so the caller controls size via dummy.scale.
 */
function buildVariant(seed: number): THREE.BufferGeometry {
  // Clone from a fresh icosahedron each time
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const rng = (i: number) => Math.abs(Math.sin(seed * 127.1 + i * 311.7));

  for (let i = 0; i < pos.count; i++) {
    const sx = 0.70 + rng(i * 3)     * 0.60; // 0.70 – 1.30 in X
    const sy = 0.18 + rng(i * 3 + 1) * 0.22; // 0.18 – 0.40 in Y  ← very flat
    const sz = 0.70 + rng(i * 3 + 2) * 0.60; // 0.70 – 1.30 in Z
    pos.setXYZ(i, pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export class Rocks {
  group: THREE.Group;

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    // White base so instance color is the sole source of hue.
    // No vertexColors — that was causing vertex-color × instance-color
    // double-multiplication that turned everything black.
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('#ffffff'),
      flatShading: true,
      shininess: 12,
    });

    const eligible = terrainData.landPoints.filter(
      p => p.height > 0.08 && p.height < 0.58,
    );
    if (eligible.length === 0) return;

    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const total = Math.min(VARIANTS * PER_VARIANT, shuffled.length);

    // Build variant meshes
    const meshes: THREE.InstancedMesh[] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const geo = buildVariant(v + 1);
      const mesh = new THREE.InstancedMesh(geo, material, PER_VARIANT);
      mesh.count = 0;
      meshes.push(mesh);
      this.group.add(mesh);
    }

    const dummy = new THREE.Object3D();

    for (let i = 0; i < total; i++) {
      const p = shuffled[i];
      const mesh = meshes[i % VARIANTS];
      if (mesh.count >= PER_VARIANT) continue;

      const color = BIOME_COLORS[p.biome] ?? DEFAULT_COLOR;

      dummy.position.copy(p.position);
      // Orient so geometry +Y points away from globe centre (= up from terrain)
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      // Random spin around the surface normal for variety
      dummy.rotateY(Math.random() * Math.PI * 2);
      // Slight random tilt — rocks aren't perfectly level
      dummy.rotateX((Math.random() - 0.5) * 0.25);

      // s controls world-unit radius of the rock.
      // Trees are 0.10-0.22 tall; rocks should be smaller footprint.
      // Geometry radius≈1, so s = world radius in units.
      // 0.06-0.12 → diameter 0.12-0.24 (clearly visible, clearly smaller than trees)
      const s = 0.06 + Math.random() * 0.06;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      mesh.setMatrixAt(mesh.count, dummy.matrix);
      mesh.setColorAt(mesh.count, color);
      mesh.count++;
    }

    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  update(_time: number): void {}
}
