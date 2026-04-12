import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  private uniforms: { oceanTime: { value: number } };

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.02, 64);

    this.uniforms = {
      oceanTime: { value: 0 },
    };

    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('#55ccee'),
      emissive: new THREE.Color('#1a5577'),
      shininess: 8,
      flatShading: true,
    });

    const uniforms = this.uniforms;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.oceanTime = uniforms.oceanTime;
      shader.uniforms.foamColor = { value: new THREE.Color('#b3ffff') };
      shader.uniforms.rimColor = { value: new THREE.Color('#ffee55') };
      shader.uniforms.rimIntensity = { value: 0.8 };
      shader.uniforms.rimPower = { value: 8.5 };

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
        uniform vec3 foamColor;
        uniform vec3 rimColor;
        uniform float rimIntensity;
        uniform float rimPower;
        varying vec3 vWorldPos;`
      );

      // Inject after dithering (at the very end) — same approach as original
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        // === FOAM: multiplied sine waves create sharp web-like patterns ===
        vec3 wp = vWorldPos;
        float w1 = sin(wp.x * 43.0 + wp.y * 27.0 + wp.z * 11.0 + oceanTime * 3.6) * 0.5 + 0.5;
        float w2 = sin(wp.y * 37.0 + wp.z * 53.0 + wp.x * 7.0 - oceanTime * 2.7) * 0.5 + 0.5;
        float w3 = sin(wp.z * 31.0 + wp.x * 19.0 + wp.y * 47.0 + oceanTime * 2.1) * 0.5 + 0.5;
        float w4 = sin(wp.x * 17.0 + wp.z * 29.0 - wp.y * 13.0 + oceanTime * 1.5) * 0.5 + 0.5;
        float w5 = sin(wp.y * 11.0 + wp.x * 59.0 + wp.z * 23.0 - oceanTime * 1.2) * 0.5 + 0.5;
        float w6 = sin(wp.z * 41.0 - wp.y * 7.0 + wp.x * 33.0 + oceanTime * 1.8) * 0.5 + 0.5;
        float w7 = sin(wp.x * 67.0 - wp.z * 43.0 + wp.y * 3.0 - oceanTime * 0.9) * 0.5 + 0.5;
        float foam = w1 * w2 * w4 * w6 + w3 * w5 * w7 * 0.3;
        foam = 1.0 - smoothstep(0.0001, 0.003, foam);
        gl_FragColor.rgb += foamColor * foam * 0.25;

        // === SPARKLE: multiplied high-freq waves + spatial mask ===
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
        gl_FragColor.rgb += vec3(1.0, 1.0, 1.0) * sparkle * 0.8;

        // === FRESNEL RIM ===
        vec3 rimViewDir = normalize(vViewPosition);
        vec3 rimNormal = normalize(normal);
        float rimFresnel = 1.0 - abs(dot(rimViewDir, rimNormal));
        vec3 rim = rimColor * rimIntensity * pow(rimFresnel, rimPower);
        gl_FragColor.rgb += rim;

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
