import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

interface CloudCluster {
  group: THREE.Group;
  inclination: number;
  azimuth: number;
  orbitSpeed: number;
  orbitRadius: number;
}

function buildCumulusGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const spheres = [
    { x: 0,     y: 0,    z: 0,    sx: 1.0,  sy: 0.6,  sz: 0.85 },
    { x: 0.55,  y: 0.08, z: 0.15, sx: 0.8,  sy: 0.55, sz: 0.7  },
    { x: -0.5,  y: 0.05, z: -0.1, sx: 0.75, sy: 0.5,  sz: 0.65 },
    { x: 0.2,   y: 0.3,  z: -0.2, sx: 0.65, sy: 0.45, sz: 0.55 },
    { x: -0.15, y: 0.25, z: 0.3,  sx: 0.7,  sy: 0.45, sz: 0.6  },
    { x: 0.35,  y: -0.05,z: 0.35, sx: 0.55, sy: 0.35, sz: 0.5  },
    { x: -0.3,  y: 0.15, z: -0.25,sx: 0.5,  sy: 0.35, sz: 0.45 },
  ];

  const tempMatrix = new THREE.Matrix4();
  for (const s of spheres) {
    const geo = new THREE.SphereGeometry(randomRange(0.22, 0.35), 6, 5);
    tempMatrix.compose(
      new THREE.Vector3(s.x, s.y, s.z),
      new THREE.Quaternion(),
      new THREE.Vector3(s.sx, s.sy, s.sz),
    );
    geo.applyMatrix4(tempMatrix);
    extractGeo(geo, positions, normals);
    geo.dispose();
  }
  return makeBufferGeo(positions, normals);
}

function buildStratusGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const layers = [
    { x: 0,    y: 0,    z: 0,    sx: 1.6, sy: 0.14, sz: 0.9  },
    { x: 0.5,  y: 0.03, z: 0.2,  sx: 1.2, sy: 0.10, sz: 0.7  },
    { x: -0.6, y: 0.02, z: -0.1, sx: 1.3, sy: 0.09, sz: 0.7  },
    { x: 0.15, y: 0.05, z: -0.4, sx: 0.9, sy: 0.08, sz: 0.55 },
  ];

  const tempMatrix = new THREE.Matrix4();
  for (const l of layers) {
    const geo = new THREE.SphereGeometry(0.28, 6, 4);
    tempMatrix.compose(
      new THREE.Vector3(l.x, l.y, l.z),
      new THREE.Quaternion(),
      new THREE.Vector3(l.sx, l.sy, l.sz),
    );
    geo.applyMatrix4(tempMatrix);
    extractGeo(geo, positions, normals);
    geo.dispose();
  }
  return makeBufferGeo(positions, normals);
}

function buildWispGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const parts = [
    { x: 0,    y: 0,    z: 0,    sx: 0.55, sy: 0.22, sz: 0.35 },
    { x: 0.25, y: 0.04, z: 0.08, sx: 0.4,  sy: 0.18, sz: 0.3  },
    { x: -0.2, y: 0.02, z: -0.05,sx: 0.35, sy: 0.15, sz: 0.25 },
  ];

  const tempMatrix = new THREE.Matrix4();
  for (const p of parts) {
    const geo = new THREE.SphereGeometry(0.18, 5, 4);
    tempMatrix.compose(
      new THREE.Vector3(p.x, p.y, p.z),
      new THREE.Quaternion(),
      new THREE.Vector3(p.sx, p.sy, p.sz),
    );
    geo.applyMatrix4(tempMatrix);
    extractGeo(geo, positions, normals);
    geo.dispose();
  }
  return makeBufferGeo(positions, normals);
}

function extractGeo(geo: THREE.BufferGeometry, positions: number[], normals: number[]): void {
  const posAttr = geo.getAttribute('position');
  const normAttr = geo.getAttribute('normal');
  const index = geo.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i++) {
      const idx = index.getX(i);
      positions.push(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
      normals.push(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));
    }
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
    }
  }
}

function makeBufferGeo(positions: number[], normals: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export class Clouds {
  group: THREE.Group;
  private clusters: CloudCluster[] = [];
  private material: THREE.MeshPhongMaterial;

  constructor() {
    this.group = new THREE.Group();

    this.material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0xddeeff,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      flatShading: true,
      shininess: 5,
    });

    const cumulusCount = Math.floor(randomRange(8, 12));
    for (let i = 0; i < cumulusCount; i++) {
      this.clusters.push(this.createCluster(buildCumulusGeometry, randomRange(7.4, 7.7)));
    }

    const stratusCount = Math.floor(randomRange(4, 6));
    for (let i = 0; i < stratusCount; i++) {
      this.clusters.push(this.createCluster(buildStratusGeometry, randomRange(7.3, 7.5)));
    }

    const wispCount = Math.floor(randomRange(6, 8));
    for (let i = 0; i < wispCount; i++) {
      this.clusters.push(this.createCluster(buildWispGeometry, randomRange(7.6, 7.9)));
    }
  }

  private createCluster(
    builder: () => THREE.BufferGeometry,
    orbitRadius: number,
  ): CloudCluster {
    const clusterGroup = new THREE.Group();
    const geo = builder();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true;
    mesh.renderOrder = 1; // render above atmosphere
    clusterGroup.add(mesh);

    const inclination = randomRange(-Math.PI * 0.45, Math.PI * 0.45);
    const azimuth = randomRange(0, Math.PI * 2);
    const orbitSpeed = randomRange(0.003, 0.012);

    const x = orbitRadius * Math.cos(azimuth) * Math.cos(inclination);
    const y = orbitRadius * Math.sin(inclination);
    const z = orbitRadius * Math.sin(azimuth) * Math.cos(inclination);

    clusterGroup.position.set(x, y, z);
    clusterGroup.lookAt(0, 0, 0);

    this.group.add(clusterGroup);

    return { group: clusterGroup, inclination, azimuth, orbitSpeed, orbitRadius };
  }

  update(_time: number, opacity: number): void {
    this.material.opacity = opacity * 0.88;

    for (const cluster of this.clusters) {
      cluster.azimuth += cluster.orbitSpeed * 0.01;

      const x = cluster.orbitRadius * Math.cos(cluster.azimuth) * Math.cos(cluster.inclination);
      const y = cluster.orbitRadius * Math.sin(cluster.inclination);
      const z = cluster.orbitRadius * Math.sin(cluster.azimuth) * Math.cos(cluster.inclination);

      cluster.group.position.set(x, y, z);
      cluster.group.lookAt(0, 0, 0);
    }
  }
}
