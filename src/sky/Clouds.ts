import * as THREE from 'three';
import { createClimateSample, sampleClimate } from '../geo/climate';
import { latLonToVec3, lonToGlobeLng, normalizeLon } from '../geo/coordinates';
import { createGeoSample, sampleGeo } from '../geo/sampler';
import { createWorldMask } from '../globe/worldmap';

interface CloudCluster {
  group: THREE.Group;
  lat: number;
  lon: number;
  windSpeed: number;
  windHeading: number;
  orbitRadius: number;
  phase: number;
  twist: number;
}

// Shared material — translucent faceted plates, not cotton-ball blobs.
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0xf5f8ee,
  vertexColors: true,
  roughness: 0.8,
  metalness: 0,
  emissive: new THREE.Color(0xcfe6ef),
  emissiveIntensity: 0.08,
  flatShading: true,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const _up = new THREE.Vector3(0, 1, 0);
const _twistQ = new THREE.Quaternion();

function hash01(lat: number, lon: number, salt: number): number {
  return Math.sin(lat * 17.371 + lon * 31.117 + salt * 101.73) * 0.5 + 0.5;
}

function createCloudPlate(width: number, depth: number, lift: number, seed: number): THREE.BufferGeometry {
  const segments = 9;
  const positions: number[] = [0, lift, 0];
  const colors: number[] = [];
  const center = new THREE.Color('#FFFFFF');
  const edge = new THREE.Color('#D5E5E6');
  colors.push(center.r, center.g, center.b);

  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const r = 0.78 + Math.sin(i * 1.73 + seed) * 0.12 + Math.cos(i * 2.31 + seed * 0.7) * 0.08;
    const x = Math.cos(a) * width * r;
    const z = Math.sin(a) * depth * r;
    const y = lift * (0.24 + Math.sin(i * 1.41 + seed) * 0.06);
    positions.push(x, y, z);
    const c = edge.clone().lerp(center, 0.22 + hash01(x, z, seed + i) * 0.20);
    colors.push(c.r, c.g, c.b);
  }

  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, ((i + 1) % segments) + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addPlate(group: THREE.Group, width: number, depth: number, lift: number, x: number, z: number, rot: number, seed: number): void {
  const m = new THREE.Mesh(createCloudPlate(width, depth, lift, seed), cloudMat);
  m.position.set(x, 0, z);
  m.rotation.y = rot;
  m.castShadow = false;
  m.receiveShadow = false;
  group.add(m);
}

// Cumulus: faceted cloud island made from thin atmospheric plates.
function createCumulus(): THREE.Group {
  const group = new THREE.Group();
  addPlate(group, 0.42, 0.23, 0.035, 0.00, 0.00, 0.08, 1);
  addPlate(group, 0.34, 0.18, 0.030, 0.28, 0.04, -0.15, 2);
  addPlate(group, 0.31, 0.17, 0.026, -0.25, -0.03, 0.24, 3);
  addPlate(group, 0.23, 0.12, 0.024, 0.08, -0.17, -0.32, 4);
  return group;
}

// Stratus: long, low cloud streaks following terrain / storm tracks.
function createStratus(): THREE.Group {
  const group = new THREE.Group();
  addPlate(group, 0.70, 0.16, 0.022, 0.00, 0.00, 0.00, 11);
  addPlate(group, 0.50, 0.12, 0.018, 0.38, 0.04, 0.09, 12);
  addPlate(group, 0.45, 0.11, 0.017, -0.42, -0.03, -0.12, 13);
  return group;
}

// Wisp: small high cloud streaks, not separate puffs.
function createWisp(): THREE.Group {
  const group = new THREE.Group();
  addPlate(group, 0.32, 0.07, 0.014, 0.00, 0.00, 0.05, 21);
  addPlate(group, 0.22, 0.05, 0.012, 0.22, 0.02, -0.08, 22);
  addPlate(group, 0.20, 0.045, 0.010, -0.20, -0.01, 0.12, 23);
  return group;
}

export class Clouds {
  group: THREE.Group;
  private clusters: CloudCluster[] = [];

  constructor() {
    this.group = new THREE.Group();

    const mask = createWorldMask();
    const geo = createGeoSample();
    const climate = createClimateSample();
    const candidates: {
      lat: number;
      lon: number;
      score: number;
      builder: () => THREE.Group;
      radius: number;
      windSpeed: number;
      windHeading: number;
      scale: number;
    }[] = [];

    for (let baseLat = -62; baseLat <= 72; baseLat += 9) {
      for (let baseLon = -170; baseLon <= 170; baseLon += 18) {
        const lat = baseLat + (hash01(baseLat, baseLon, 1) - 0.5) * 4.5;
        const lon = normalizeLon(baseLon + (hash01(baseLat, baseLon, 2) - 0.5) * 8);
        const landness = mask.sampleLandBlur(lat, lonToGlobeLng(lon), 2.0);
        const overOcean = landness < 0.35;
        sampleGeo(lat, lon, geo);
        sampleClimate(lat, lon, geo, climate);

        const geographyScore = climate.cloudDensity + (overOcean ? 0.10 : -geo.desert * 0.18);
        const score = geographyScore + hash01(lat, lon, 3) * 0.24;
        if (score < 0.54) continue;

        const builder = climate.orographic > 0.32
          ? createStratus
          : climate.polar > 0.55
            ? createWisp
            : createCumulus;
        candidates.push({
          lat,
          lon,
          score,
          builder,
          radius: climate.cloudAltitude - 0.05 + hash01(lat, lon, 4) * 0.05,
          windSpeed: climate.windSpeed * (0.55 + hash01(lat, lon, 5) * 0.7),
          windHeading: climate.windHeading,
          scale: 0.82 + climate.storm * 0.32 + climate.orographic * 0.18 + hash01(lat, lon, 6) * 0.18,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates.slice(0, 30)) {
      this.clusters.push(this.createCluster(c.builder, c.lat, c.lon, c.radius, c.windSpeed, c.windHeading, c.scale));
    }
  }

  private createCluster(
    builder: () => THREE.Group,
    lat: number,
    lon: number,
    orbitRadius: number,
    windSpeed: number,
    windHeading: number,
    scale: number,
  ): CloudCluster {
    const cloudGroup = builder();
    cloudGroup.scale.setScalar(scale);
    latLonToVec3(lat, lon, orbitRadius, cloudGroup.position);

    // Orient cloud to lie on the sphere surface:
    // cloud geometry is built in XZ plane with Y up
    // we need local Y to point radially outward from origin
    const normal = cloudGroup.position.clone().normalize();
    cloudGroup.quaternion.setFromUnitVectors(_up, normal);
    cloudGroup.quaternion.multiply(_twistQ.setFromAxisAngle(_up, hash01(lat, lon, 8) * Math.PI));

    this.group.add(cloudGroup);

    return {
      group: cloudGroup,
      lat,
      lon,
      windSpeed,
      windHeading,
      orbitRadius,
      phase: hash01(lat, lon, 7) * Math.PI * 2,
      twist: hash01(lat, lon, 8) * Math.PI,
    };
  }

  update(_time: number, opacity: number): void {
    cloudMat.opacity = Math.min(0.28, opacity * 1.05);
    cloudMat.transparent = true;

    for (const c of this.clusters) {
      c.lon = normalizeLon(c.lon + c.windSpeed * c.windHeading);
      const lat = c.lat + Math.sin(_time * 0.08 + c.phase) * 0.05;
      latLonToVec3(lat, c.lon, c.orbitRadius, c.group.position);

      const normal = c.group.position.clone().normalize();
      c.group.quaternion.setFromUnitVectors(_up, normal);
      c.group.quaternion.multiply(_twistQ.setFromAxisAngle(_up, c.twist));
    }
  }
}
