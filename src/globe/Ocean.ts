import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';

export class Ocean {
  mesh: THREE.Mesh;
  private uniforms: { oceanTime: { value: number } };

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.02, 60);

    this.uniforms = {
      oceanTime: { value: 0 },
    };

    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('#1e5799'),
      transparent: true,
      opacity: 0.85,
      shininess: 80,
      specular: new THREE.Color('#88bbff'),
    });

    const uniforms = this.uniforms;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.oceanTime = uniforms.oceanTime;
      shader.uniforms.rimColor = { value: new THREE.Vector3(0.5, 0.75, 1.0) };
      shader.uniforms.rimIntensity = { value: 1.5 };
      shader.uniforms.rimPower = { value: 3.0 };

      // Add uniforms and varyings to fragment shader
      shader.fragmentShader = `
        uniform float oceanTime;
        uniform vec3 rimColor;
        uniform float rimIntensity;
        uniform float rimPower;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      ` + shader.fragmentShader;

      // Add varyings to vertex shader
      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      ` + shader.vertexShader;

      // Inject world position calculation into vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        `
      );

      // Inject custom effects before output
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `
        // Animated foam: 7 overlapping sine waves
        float foam = 0.0;
        foam += sin(vWorldPos.x * 8.0 + oceanTime * 0.7) * 0.15;
        foam += sin(vWorldPos.y * 6.0 - oceanTime * 0.5) * 0.15;
        foam += sin(vWorldPos.z * 7.0 + oceanTime * 0.6) * 0.15;
        foam += sin((vWorldPos.x + vWorldPos.z) * 5.0 + oceanTime * 0.8) * 0.12;
        foam += sin((vWorldPos.y - vWorldPos.x) * 9.0 - oceanTime * 0.4) * 0.1;
        foam += sin((vWorldPos.z + vWorldPos.y) * 4.0 + oceanTime * 1.1) * 0.1;
        foam += sin((vWorldPos.x * vWorldPos.z) * 3.0 + oceanTime * 0.3) * 0.08;
        foam = smoothstep(0.3, 0.7, foam + 0.5);

        // Sparkle effect: specular highlights
        float sparkle = 0.0;
        sparkle += sin(vWorldPos.x * 15.0 + oceanTime * 1.2) * 0.2;
        sparkle += sin(vWorldPos.y * 12.0 - oceanTime * 0.9) * 0.2;
        sparkle += sin(vWorldPos.z * 14.0 + oceanTime * 1.0) * 0.2;
        sparkle += sin((vWorldPos.x + vWorldPos.y) * 10.0 + oceanTime * 1.5) * 0.15;
        sparkle += sin((vWorldPos.z - vWorldPos.y) * 11.0 - oceanTime * 0.7) * 0.15;
        sparkle += sin((vWorldPos.x - vWorldPos.z) * 13.0 + oceanTime * 0.8) * 0.1;
        sparkle += sin(dot(vWorldPos, vec3(1.0)) * 8.0 + oceanTime * 1.3) * 0.1;
        sparkle = pow(max(sparkle, 0.0), 3.0);

        // Fresnel rim
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float rim = 1.0 - dot(vWorldNormal, viewDir);
        rim = pow(max(rim, 0.0), rimPower);

        vec3 finalColor = outgoingLight;
        finalColor += foam * 0.08;
        finalColor += sparkle * 0.15;
        finalColor += rimColor * rim * rimIntensity * 0.3;

        #include <output_fragment>
        gl_FragColor = vec4(finalColor, diffuseColor.a);
        `
      );
    };

    this.mesh = new THREE.Mesh(geometry, material);
  }

  update(time: number): void {
    this.uniforms.oceanTime.value = time;
  }
}
