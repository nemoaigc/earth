import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

const cloudVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPosition.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float rim = abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float soft = pow(rim, 3.0);
    gl_FragColor = vec4(uColor, uOpacity * soft);
  }
`;

interface CloudCluster {
  group: THREE.Group;
  inclination: number;
  azimuth: number;
  orbitSpeed: number;
  orbitRadius: number;
}

export class Clouds {
  group: THREE.Group;
  private clusters: CloudCluster[] = [];
  private material: THREE.ShaderMaterial;

  constructor() {
    this.group = new THREE.Group();

    this.material = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(1, 1, 1) },
        uOpacity: { value: 0.6 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const clusterCount = Math.floor(randomRange(15, 20));

    for (let i = 0; i < clusterCount; i++) {
      const cluster = this.createCluster();
      this.clusters.push(cluster);
      this.group.add(cluster.group);
    }
  }

  private createCluster(): CloudCluster {
    const clusterGroup = new THREE.Group();
    const sphereCount = Math.floor(randomRange(4, 8));
    const orbitRadius = 6.5;

    // Merge spheres into a single geometry for the cluster
    const geometries: THREE.SphereGeometry[] = [];
    const tempMatrix = new THREE.Matrix4();

    for (let i = 0; i < sphereCount; i++) {
      const size = randomRange(0.1, 0.4);
      const geo = new THREE.SphereGeometry(size, 8, 6);
      const offsetX = randomRange(-0.3, 0.3);
      const offsetY = randomRange(-0.1, 0.15);
      const offsetZ = randomRange(-0.3, 0.3);
      tempMatrix.makeTranslation(offsetX, offsetY, offsetZ);
      geo.applyMatrix4(tempMatrix);
      geometries.push(geo);
    }

    const mergedGeometry = this.mergeGeometries(geometries);
    const mesh = new THREE.Mesh(mergedGeometry, this.material);
    clusterGroup.add(mesh);

    // Random orbital parameters
    const inclination = randomRange(-Math.PI * 0.4, Math.PI * 0.4);
    const azimuth = randomRange(0, Math.PI * 2);
    const orbitSpeed = randomRange(0.005, 0.015);

    // Position the cluster on its orbit
    const x = orbitRadius * Math.cos(azimuth) * Math.cos(inclination);
    const y = orbitRadius * Math.sin(inclination);
    const z = orbitRadius * Math.sin(azimuth) * Math.cos(inclination);

    clusterGroup.position.set(x, y, z);
    clusterGroup.lookAt(0, 0, 0);

    return {
      group: clusterGroup,
      inclination,
      azimuth,
      orbitSpeed,
      orbitRadius,
    };
  }

  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];

    for (const geo of geometries) {
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

      geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
  }

  update(_time: number, opacity: number): void {
    // Update opacity uniform
    this.material.uniforms.uOpacity.value = opacity;

    // Orbit each cluster
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
