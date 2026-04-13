import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  private uniforms: { oceanTime: { value: number } };

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.005, 80);

    this.uniforms = {
      oceanTime: { value: 0 },
    };

    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('#3399cc'),
      emissive: new THREE.Color('#0a2244'),
      shininess: 20,
      flatShading: true,
    });

    const uniforms = this.uniforms;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.oceanTime = uniforms.oceanTime;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        'uniform vec3 emissive;',
        `uniform vec3 emissive;
        uniform float oceanTime;
        varying vec3 vWorldPos;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        vec3 wp = vWorldPos;

        // === FLOWING CURRENT: slow undulating color waves ===
        float flow1 = sin(wp.x * 2.5 + wp.z * 1.8 + oceanTime * 0.4) * 0.5 + 0.5;
        float flow2 = sin(wp.y * 3.0 - wp.x * 2.0 + oceanTime * 0.3) * 0.5 + 0.5;
        float flow3 = sin(wp.z * 2.2 + wp.y * 1.5 - oceanTime * 0.35) * 0.5 + 0.5;
        float currentPattern = flow1 * flow2 * 0.5 + flow3 * 0.3;
        // Subtle lighter streaks where currents converge
        gl_FragColor.rgb += vec3(0.08, 0.15, 0.20) * currentPattern;

        // === SOFT CAUSTICS: gentle light ripples ===
        float c1 = sin(wp.x * 8.0 + wp.y * 5.0 + oceanTime * 1.2) * 0.5 + 0.5;
        float c2 = sin(wp.z * 7.0 - wp.x * 6.0 + oceanTime * 0.9) * 0.5 + 0.5;
        float c3 = sin(wp.y * 9.0 + wp.z * 4.0 - oceanTime * 1.0) * 0.5 + 0.5;
        float caustics = c1 * c2 * c3;
        caustics = smoothstep(0.08, 0.15, caustics);
        gl_FragColor.rgb += vec3(0.12, 0.18, 0.22) * caustics;

        // === SPARSE SPARKLE: just a few bright dots, not everywhere ===
        float sp = sin(wp.x * 30.0 + oceanTime * 2.5)
                 * sin(wp.y * 28.0 - oceanTime * 2.0)
                 * sin(wp.z * 32.0 + oceanTime * 1.8);
        float sparkleMask = sin(wp.x * 1.5 + wp.z * 2.0 + oceanTime * 0.15);
        sparkleMask = smoothstep(0.3, 0.6, sparkleMask);
        float sparkle = smoothstep(0.85, 0.98, sp * 0.5 + 0.5) * sparkleMask;
        gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * sparkle * 0.5;

        // === FRESNEL RIM: subtle edge glow ===
        vec3 rimViewDir = normalize(vViewPosition);
        vec3 rimNormal = normalize(normal);
        float rimFresnel = 1.0 - abs(dot(rimViewDir, rimNormal));
        gl_FragColor.rgb += vec3(0.15, 0.25, 0.35) * pow(rimFresnel, 3.0) * 0.5;

        #include <dithering_fragment>
        `
      );
    };

    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
  }

  update(time: number): void {
    this.uniforms.oceanTime.value = time;
  }
}
