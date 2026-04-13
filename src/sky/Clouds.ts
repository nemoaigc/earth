import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

interface CloudCluster {
  group: THREE.Group;
  inclination: number;
  azimuth: number;
  orbitSpeed: number;
  orbitRadius: number;
}

// Shared material — solid white, receives light for 3D shading
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.8,
  metalness: 0,
  emissive: new THREE.Color(0xddeeff),
  emissiveIntensity: 0.15,
});

const _up = new THREE.Vector3(0, 1, 0);

// Cumulus: 7 overlapping spheres forming puffy cotton shape
function createCumulus(): THREE.Group {
  const group = new THREE.Group();
  const defs = [
    { x: 0,     y: 0,    z: 0,     r: 0.28, sx: 1.0,  sy: 0.55, sz: 0.85 },
    { x: 0.22,  y: 0.03, z: 0.06,  r: 0.25, sx: 0.85, sy: 0.5,  sz: 0.7  },
    { x: -0.2,  y: 0.02, z: -0.04, r: 0.24, sx: 0.8,  sy: 0.48, sz: 0.65 },
    { x: 0.08,  y: 0.1,  z: -0.1,  r: 0.22, sx: 0.65, sy: 0.42, sz: 0.55 },
    { x: -0.07, y: 0.08, z: 0.12,  r: 0.23, sx: 0.7,  sy: 0.42, sz: 0.6  },
    { x: 0.14,  y: -0.02,z: 0.14,  r: 0.2,  sx: 0.55, sy: 0.35, sz: 0.5  },
    { x: -0.13, y: 0.05, z: -0.1,  r: 0.18, sx: 0.5,  sy: 0.32, sz: 0.45 },
  ];
  for (const d of defs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 7, 5), cloudMat);
    m.position.set(d.x, d.y, d.z);
    m.scale.set(d.sx, d.sy, d.sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// Stratus: flat wide layer
function createStratus(): THREE.Group {
  const group = new THREE.Group();
  const defs = [
    { x: 0,    y: 0,    z: 0,    r: 0.25, sx: 1.6, sy: 0.12, sz: 0.8  },
    { x: 0.2,  y: 0.01, z: 0.08, r: 0.22, sx: 1.2, sy: 0.10, sz: 0.65 },
    { x: -0.22,y: 0.01, z: -0.04,r: 0.23, sx: 1.3, sy: 0.09, sz: 0.65 },
  ];
  for (const d of defs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 6, 4), cloudMat);
    m.position.set(d.x, d.y, d.z);
    m.scale.set(d.sx, d.sy, d.sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// Wisp: small high cloud
function createWisp(): THREE.Group {
  const group = new THREE.Group();
  const defs = [
    { x: 0,    y: 0,    z: 0,    r: 0.18, sx: 0.5, sy: 0.2, sz: 0.35 },
    { x: 0.1,  y: 0.01, z: 0.03, r: 0.15, sx: 0.38,sy: 0.16,sz: 0.28 },
    { x: -0.08,y: 0.01, z: -0.02,r: 0.14, sx: 0.32,sy: 0.14,sz: 0.24 },
  ];
  for (const d of defs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 5, 4), cloudMat);
    m.position.set(d.x, d.y, d.z);
    m.scale.set(d.sx, d.sy, d.sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

export class Clouds {
  group: THREE.Group;
  private clusters: CloudCluster[] = [];

  constructor() {
    this.group = new THREE.Group();

    // GLOBE_RADIUS=5, surface max=5.7, atmosphere=5*1.3=6.5
    // Clouds between 5.8 and 6.2

    for (let i = 0; i < Math.floor(randomRange(10, 14)); i++) {
      this.clusters.push(this.createCluster(createCumulus, randomRange(5.8, 6.0)));
    }

    for (let i = 0; i < Math.floor(randomRange(5, 8)); i++) {
      this.clusters.push(this.createCluster(createStratus, randomRange(5.85, 5.95)));
    }

    for (let i = 0; i < Math.floor(randomRange(6, 10)); i++) {
      this.clusters.push(this.createCluster(createWisp, randomRange(6.0, 6.2)));
    }
  }

  private createCluster(
    builder: () => THREE.Group,
    orbitRadius: number,
  ): CloudCluster {
    const cloudGroup = builder();

    const inclination = randomRange(-Math.PI * 0.45, Math.PI * 0.45);
    const azimuth = randomRange(0, Math.PI * 2);
    const orbitSpeed = randomRange(0.003, 0.012);

    const x = orbitRadius * Math.cos(azimuth) * Math.cos(inclination);
    const y = orbitRadius * Math.sin(inclination);
    const z = orbitRadius * Math.sin(azimuth) * Math.cos(inclination);

    cloudGroup.position.set(x, y, z);

    // Orient cloud to lie on the sphere surface:
    // cloud geometry is built in XZ plane with Y up
    // we need local Y to point radially outward from origin
    const normal = new THREE.Vector3(x, y, z).normalize();
    cloudGroup.quaternion.setFromUnitVectors(_up, normal);

    this.group.add(cloudGroup);

    return { group: cloudGroup, inclination, azimuth, orbitSpeed, orbitRadius };
  }

  update(_time: number, opacity: number): void {
    cloudMat.opacity = opacity;
    cloudMat.transparent = opacity < 1;

    for (const c of this.clusters) {
      c.azimuth += c.orbitSpeed * 0.1;

      const x = c.orbitRadius * Math.cos(c.azimuth) * Math.cos(c.inclination);
      const y = c.orbitRadius * Math.sin(c.inclination);
      const z = c.orbitRadius * Math.sin(c.azimuth) * Math.cos(c.inclination);

      c.group.position.set(x, y, z);

      const normal = new THREE.Vector3(x, y, z).normalize();
      c.group.quaternion.setFromUnitVectors(_up, normal);
    }
  }
}
