import * as THREE from 'three';
import { randomRange } from '../utils/helpers';

const rainVertexShader = /* glsl */ `
  attribute float aOffset;
  uniform float uTime;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Animate downward; aOffset staggers the drops
    float speed = 8.0;
    float cycle = mod(pos.y - uTime * speed + aOffset, 6.0) - 3.0;
    pos.y = cycle;

    // Taper: even vertices are top of streak, odd are bottom
    // The streak direction is implicit in the paired vertex layout
    vAlpha = 1.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const rainFragmentShader = /* glsl */ `
  uniform float uIntensity;

  void main() {
    gl_FragColor = vec4(0.7, 0.8, 0.9, uIntensity * 0.3);
  }
`;

export class Rain {
  group: THREE.Group;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.group = new THREE.Group();

    const dropCount = 500;
    const positions = new Float32Array(dropCount * 2 * 3); // 2 vertices per line
    const offsets = new Float32Array(dropCount * 2);

    for (let i = 0; i < dropCount; i++) {
      // Random position in a cylinder around origin
      const angle = Math.random() * Math.PI * 2;
      const radius = randomRange(1, 8);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = randomRange(-3, 3);

      const streakLength = randomRange(0.15, 0.35);
      const offset = Math.random() * 6.0; // phase offset

      // Top vertex
      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // Bottom vertex (offset downward for streak)
      positions[idx + 3] = x;
      positions[idx + 4] = y - streakLength;
      positions[idx + 5] = z;

      // Offset attribute (same for both vertices of a segment)
      offsets[i * 2] = offset;
      offsets[i * 2 + 1] = offset;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, this.material);
    this.group.add(lines);
  }

  update(time: number, intensity: number): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uIntensity.value = intensity;
  }
}
