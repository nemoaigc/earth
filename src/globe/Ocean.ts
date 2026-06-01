import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  private uniforms: { oceanTime: { value: number } };

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.005, 72);

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

        // === FOAM: layered sine interference ===
        float f1 = sin(wp.x * 39.0 + wp.y * 23.0 + wp.z * 14.0 + oceanTime * 3.2) * 0.5 + 0.5;
        float f2 = sin(wp.y * 33.0 + wp.z * 49.0 + wp.x * 9.0 - oceanTime * 2.4) * 0.5 + 0.5;
        float f3 = sin(wp.z * 27.0 + wp.x * 21.0 + wp.y * 41.0 + oceanTime * 1.9) * 0.5 + 0.5;
        float f4 = sin(wp.x * 19.0 + wp.z * 31.0 - wp.y * 16.0 + oceanTime * 1.3) * 0.5 + 0.5;
        float f5 = sin(wp.y * 13.0 + wp.x * 53.0 + wp.z * 26.0 - oceanTime * 1.0) * 0.5 + 0.5;
        float f6 = sin(wp.z * 37.0 - wp.y * 10.0 + wp.x * 29.0 + oceanTime * 1.6) * 0.5 + 0.5;
        float foam = f1 * f3 * f5 + f2 * f4 * f6 * 0.35;
        foam = 1.0 - smoothstep(0.0002, 0.004, foam);
        gl_FragColor.rgb += vec3(0.72, 0.86, 0.92) * foam * 0.18;

        // === SPARKLE ===
        float s1 = sin(wp.x * 44.0 + wp.y * 19.0 + wp.z * 12.0 + oceanTime * 3.8);
        float s2 = sin(wp.y * 31.0 + wp.z * 33.0 + wp.x * 16.0 - oceanTime * 3.1);
        float s3 = sin(wp.z * 22.0 + wp.x * 41.0 - wp.y * 14.0 + oceanTime * 4.4);
        float s4 = sin(wp.x * 63.0 - wp.z * 51.0 + wp.y * 7.0 + oceanTime * 2.2);
        float sMask = sin(wp.x * 2.7 + wp.z * 5.1 + oceanTime * 0.22)
                    * sin(wp.y * 4.9 - wp.x * 3.3 - oceanTime * 0.15);
        sMask *= sin(wp.z * 2.6 + wp.y * 4.2 + oceanTime * 0.3);
        sMask = smoothstep(0.12, 0.48, sMask);
        float sparkle = s1 * s2 * s3 * s4;
        sparkle = smoothstep(0.52, 0.96, sparkle) * sMask;
        gl_FragColor.rgb += vec3(1.0, 1.0, 1.0) * sparkle * 0.55;

        // === GLASS EFFECT: Fresnel-based opacity ===
        vec3 rimViewDir = normalize(vViewPosition);
        vec3 rimNormal = normalize(normal);
        float fresnel = 1.0 - abs(dot(rimViewDir, rimNormal));
        gl_FragColor.a = mix(0.58, 0.88, pow(fresnel, 2.2));
        gl_FragColor.rgb += vec3(0.18, 0.32, 0.42) * pow(fresnel, 2.8) * 0.35;

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
