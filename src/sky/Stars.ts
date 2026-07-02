import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

const starsVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uSize;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * aSize * (1.0 / length(mvPosition.xyz)) * 300.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starsFragmentShader = /* glsl */ `
  uniform float uVisibility;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.26, d);
    float glow = 1.0 - smoothstep(0.0, 1.0, d);
    float alpha = (core + glow * 0.34) * uVisibility * vAlpha;

    if (alpha < 0.001) discard;

    gl_FragColor = vec4(vColor, alpha);
  }
`;

const _starColor = new THREE.Color();

export class Stars {
  points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor() {
    const count = 3000;
    const radius = 45;

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const distance = radius + randomRange(-2.5, 3.0);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = distance * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = distance * Math.cos(phi);
      positions[i * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta);
      const bright = Math.random() > 0.92;
      sizes[i] = bright ? randomRange(1.55, 2.85) : randomRange(0.48, 1.58);
      alphas[i] = bright ? randomRange(0.62, 1.0) : randomRange(0.26, 0.66);

      const tint = Math.random();
      if (tint < 0.24) {
        _starColor.set('#C8D8FF');
      } else if (tint > 0.86) {
        _starColor.set('#F3E6CA');
      } else {
        _starColor.set('#EEF8FF');
      }
      colors[i * 3] = _starColor.r;
      colors[i * 3 + 1] = _starColor.g;
      colors[i * 3 + 2] = _starColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      uniforms: {
        uSize: { value: 2.35 },
        uVisibility: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(visibility: number): void {
    this.material.uniforms.uVisibility.value = visibility;
  }
}
