import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float rim = 1.0 - abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float glow = pow(rim, 3.0);
    gl_FragColor = vec4(uColor, glow * uIntensity);
  }
`;

export class Atmosphere {
  mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS * 1.15, 32);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color('#4488ff') },
        uIntensity: { value: 0.35 },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  updateColor(color: THREE.Color): void {
    this.material.uniforms.uColor.value.copy(color);
  }
}
