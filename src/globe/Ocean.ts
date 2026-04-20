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
      color: new THREE.Color('#44aacc'),
      emissive: new THREE.Color('#0a2244'),
      shininess: 15,
      flatShading: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
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

        // === FOAM: original multiplied sine waves ===
        float w1 = sin(wp.x * 43.0 + wp.y * 27.0 + wp.z * 11.0 + oceanTime * 3.6) * 0.5 + 0.5;
        float w2 = sin(wp.y * 37.0 + wp.z * 53.0 + wp.x * 7.0 - oceanTime * 2.7) * 0.5 + 0.5;
        float w3 = sin(wp.z * 31.0 + wp.x * 19.0 + wp.y * 47.0 + oceanTime * 2.1) * 0.5 + 0.5;
        float w4 = sin(wp.x * 17.0 + wp.z * 29.0 - wp.y * 13.0 + oceanTime * 1.5) * 0.5 + 0.5;
        float w5 = sin(wp.y * 11.0 + wp.x * 59.0 + wp.z * 23.0 - oceanTime * 1.2) * 0.5 + 0.5;
        float w6 = sin(wp.z * 41.0 - wp.y * 7.0 + wp.x * 33.0 + oceanTime * 1.8) * 0.5 + 0.5;
        float w7 = sin(wp.x * 67.0 - wp.z * 43.0 + wp.y * 3.0 - oceanTime * 0.9) * 0.5 + 0.5;
        float foam = w1 * w2 * w4 * w6 + w3 * w5 * w7 * 0.3;
        foam = 1.0 - smoothstep(0.0001, 0.003, foam);
        gl_FragColor.rgb += vec3(0.7, 0.85, 0.9) * foam * 0.2;

        // === SPARKLE ===
        float sp1 = sin(wp.x * 40.0 + wp.y * 23.0 + wp.z * 9.0 + oceanTime * 3.5);
        float sp2 = sin(wp.y * 35.0 + wp.z * 29.0 + wp.x * 13.0 - oceanTime * 2.8);
        float sp3 = sin(wp.z * 27.0 + wp.x * 37.0 - wp.y * 17.0 + oceanTime * 4.1);
        float sp4 = sin(wp.x * 71.0 - wp.z * 47.0 + wp.y * 5.0 + oceanTime * 1.9);
        float sp5 = sin(wp.y * 59.0 + wp.x * 11.0 - wp.z * 31.0 - oceanTime * 2.3);
        float sparkleMask = sin(wp.x * 3.1 + wp.z * 4.7 + oceanTime * 0.25)
                          * sin(wp.y * 5.3 - wp.x * 2.9 - oceanTime * 0.18);
        sparkleMask *= sin(wp.z * 2.3 + wp.y * 3.9 + oceanTime * 0.35);
        sparkleMask = smoothstep(0.15, 0.5, sparkleMask);
        float sparkle = sp1 * sp2 * sp3 * sp4 + sp2 * sp3 * sp5 * 0.5;
        sparkle = smoothstep(0.55, 0.97, sparkle) * sparkleMask;
        gl_FragColor.rgb += vec3(1.0, 1.0, 1.0) * sparkle * 0.6;

        // === GLASS EFFECT: vary opacity by viewing angle ===
        vec3 rimViewDir = normalize(vViewPosition);
        vec3 rimNormal = normalize(normal);
        float rimFresnel = 1.0 - abs(dot(rimViewDir, rimNormal));
        // More opaque at edges (glass-like refraction look)
        gl_FragColor.a = mix(0.6, 0.9, pow(rimFresnel, 2.0));
        // Edge glow
        gl_FragColor.rgb += vec3(0.2, 0.35, 0.45) * pow(rimFresnel, 2.5) * 0.4;

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
