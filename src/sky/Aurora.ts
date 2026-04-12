import * as THREE from 'three';

const auroraVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec3 pos = position;
    pos.y += sin(pos.x * 3.0 + uTime * 0.5) * 0.15;
    pos.z += cos(pos.x * 2.0 + uTime * 0.3) * 0.1;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const auroraFragmentShader = /* glsl */ `
  uniform float uVisibility;

  varying vec2 vUv;

  void main() {
    // 3-color vertical gradient: green -> teal -> purple
    vec3 green  = vec3(0.0, 1.0, 0.533);   // #00ff88
    vec3 teal   = vec3(0.0, 0.8, 0.667);   // #00ccaa
    vec3 purple = vec3(0.533, 0.267, 1.0);  // #8844ff

    vec3 color;
    if (vUv.y < 0.5) {
      color = mix(green, teal, vUv.y * 2.0);
    } else {
      color = mix(teal, purple, (vUv.y - 0.5) * 2.0);
    }

    // Fade at horizontal edges
    float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(0.0, 0.15, 1.0 - vUv.x);

    // Fade at vertical edges
    float vertFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(0.0, 0.2, 1.0 - vUv.y);

    float alpha = edgeFade * vertFade * uVisibility * 0.6;

    gl_FragColor = vec4(color, alpha);
  }
`;

export class Aurora {
  group: THREE.Group;
  private materials: THREE.ShaderMaterial[] = [];

  constructor() {
    this.group = new THREE.Group();

    const curtainCount = 3;
    const auroraRadius = 8;

    for (let i = 0; i < curtainCount; i++) {
      const geometry = new THREE.PlaneGeometry(3, 1.5, 40, 10);

      // Curve the plane into a band
      const posAttr = geometry.getAttribute('position');
      for (let v = 0; v < posAttr.count; v++) {
        const x = posAttr.getX(v);
        const y = posAttr.getY(v);
        const z = posAttr.getZ(v);

        // Bend along x-axis into an arc
        const angle = (x / 3) * 0.8; // arc span
        const newX = Math.sin(angle) * (auroraRadius + z);
        const newZ = Math.cos(angle) * (auroraRadius + z) - auroraRadius;

        posAttr.setXYZ(v, newX, y, newZ);
      }
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();

      const material = new THREE.ShaderMaterial({
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uVisibility: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      this.materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);

      // Position near north pole, tilted
      mesh.position.set(0, auroraRadius * 0.75, 0);
      mesh.rotation.x = -Math.PI * 0.25;

      // Spread curtains in an arc
      mesh.rotation.y = ((i - 1) * Math.PI) / 6;

      // Slight vertical offset per curtain
      mesh.position.y += i * 0.2;

      this.group.add(mesh);
    }
  }

  update(time: number, visibility: number): void {
    for (const material of this.materials) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVisibility.value = visibility;
    }
  }
}
