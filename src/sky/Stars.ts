import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

const starsVertexShader = /* glsl */ `
  attribute float aSize;
  uniform float uSize;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * aSize * (1.0 / length(mvPosition.xyz)) * 300.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starsFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uVisibility;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.3, d);
    float glow = 1.0 - smoothstep(0.0, 1.0, d);
    float alpha = (core + glow * 0.3) * uVisibility;

    if (alpha < 0.001) discard;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export class Stars {
  points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor() {
    const count = 2000;
    const radius = 45;

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random point on sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      sizes[i] = randomRange(0.5, 2.0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      uniforms: {
        uSize: { value: 2.0 },
        uColor: { value: new THREE.Color(1, 1, 1) },
        uVisibility: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
  }

  update(visibility: number): void {
    this.material.uniforms.uVisibility.value = visibility;
  }
}
