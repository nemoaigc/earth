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
      emissive: new THREE.Color('#226688'),
      shininess: 40,
      specular: new THREE.Color('#668899'),
    });

    const uniforms = this.uniforms;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.oceanTime = uniforms.oceanTime;

      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        `
      );

      shader.fragmentShader = `
        uniform float oceanTime;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `
        vec3 wp = vWorldPos;

        // --- Base color: bright turquoise/cyan ---
        float depthNoise = sin(wp.x * 1.5) * 0.3 + sin(wp.y * 1.8) * 0.3 + sin(wp.z * 1.2) * 0.3;
        vec3 deepColor = vec3(0.20, 0.60, 0.85);
        vec3 shallowColor = vec3(0.40, 0.80, 0.95);
        vec3 baseOcean = mix(deepColor, shallowColor, depthNoise * 0.5 + 0.5);

        // --- Foam: white cap patterns ---
        float foam = 0.0;
        foam += sin(wp.x * 8.0 + oceanTime * 0.7) * 0.14;
        foam += sin(wp.y * 7.0 - oceanTime * 0.5) * 0.14;
        foam += sin(wp.z * 7.5 + oceanTime * 0.6) * 0.14;
        foam += sin((wp.x + wp.z) * 5.5 + oceanTime * 0.9) * 0.12;
        foam += sin((wp.y - wp.x) * 9.0 - oceanTime * 0.4) * 0.10;
        foam += sin((wp.z + wp.y) * 4.5 + oceanTime * 1.1) * 0.10;
        foam += sin((wp.x * 0.7 + wp.z * 1.3) * 3.5 + oceanTime * 0.35) * 0.08;
        foam = smoothstep(0.35, 0.6, foam + 0.5);
        baseOcean = mix(baseOcean, vec3(0.9, 0.95, 1.0), foam * 0.3);

        // --- Sparkle layer 1: scattered bright white dots ---
        float sp = 0.0;
        sp += sin(wp.x * 25.0 + oceanTime * 3.0);
        sp += sin(wp.y * 22.0 - oceanTime * 2.5);
        sp += sin(wp.z * 23.0 + oceanTime * 2.8);
        sp += sin((wp.x + wp.y) * 18.0 + oceanTime * 3.5);
        sp += sin((wp.z - wp.y) * 20.0 - oceanTime * 2.0);
        sp += sin((wp.x - wp.z) * 16.0 + oceanTime * 3.2);
        sp += sin((wp.x + wp.y + wp.z) * 14.0 + oceanTime * 2.3);
        sp = sp / 7.0 * 0.5 + 0.5;
        float sparkle = pow(sp, 10.0) * 4.0;

        // --- Sparkle layer 2 ---
        float sp2 = 0.0;
        sp2 += sin(wp.x * 35.0 - oceanTime * 2.2);
        sp2 += sin(wp.y * 30.0 + oceanTime * 2.7);
        sp2 += sin(wp.z * 32.0 - oceanTime * 1.9);
        sp2 += sin((wp.x - wp.y) * 28.0 + oceanTime * 3.1);
        sp2 += sin((wp.z + wp.x) * 26.0 - oceanTime * 2.4);
        sp2 = sp2 / 5.0 * 0.5 + 0.5;
        sparkle += pow(sp2, 12.0) * 3.0;

        baseOcean += vec3(1.0, 1.0, 0.95) * sparkle;

        // --- Fresnel rim ---
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = 1.0 - max(dot(vWorldNormal, viewDir), 0.0);
        fresnel = pow(fresnel, 2.5);
        baseOcean += vec3(0.5, 0.8, 1.0) * fresnel * 0.4;

        // Day/night tint comes from material.color set by DayNightCycle
        // Normalize: divide by daytime material color to get a multiplier
        vec3 dayColor = vec3(0.333, 0.8, 0.933); // matches '#55ccee'
        vec3 tint = diffuseColor.rgb / dayColor;
        vec3 finalColor = baseOcean * tint;

        #include <output_fragment>
        gl_FragColor = vec4(finalColor, 1.0);
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
