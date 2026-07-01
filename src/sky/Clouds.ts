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

function hash01(lat: number, lon: number, salt: number): number {
  return Math.sin(lat * 17.371 + lon * 31.117 + salt * 101.73) * 0.5 + 0.5;
}

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
          radius: climate.cloudAltitude + hash01(lat, lon, 4) * 0.08,
          windSpeed: climate.windSpeed * (0.55 + hash01(lat, lon, 5) * 0.7),
          windHeading: climate.windHeading,
          scale: 0.72 + climate.storm * 0.38 + climate.orographic * 0.24 + hash01(lat, lon, 6) * 0.22,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates.slice(0, 34)) {
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

    this.group.add(cloudGroup);

    return {
      group: cloudGroup,
      lat,
      lon,
      windSpeed,
      windHeading,
      orbitRadius,
      phase: hash01(lat, lon, 7) * Math.PI * 2,
    };
  }

  update(_time: number, opacity: number): void {
    cloudMat.opacity = opacity;
    cloudMat.transparent = opacity < 1;

    for (const c of this.clusters) {
      c.lon = normalizeLon(c.lon + c.windSpeed * c.windHeading);
      const lat = c.lat + Math.sin(_time * 0.08 + c.phase) * 0.05;
      latLonToVec3(lat, c.lon, c.orbitRadius, c.group.position);

      const normal = c.group.position.clone().normalize();
      c.group.quaternion.setFromUnitVectors(_up, normal);
    }
  }
}
