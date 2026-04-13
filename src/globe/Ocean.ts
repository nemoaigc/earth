import * as THREE from 'three';
import { GLOBE_RADIUS } from './terrain';
import { createWorldMask } from './worldmap';

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  private uniforms: { oceanTime: { value: number } };

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.005, 80);
    const mask = createWorldMask();

    // Add vertex colors: shallow near coast, deep far from coast
    const posAttr = geometry.getAttribute('position');
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    const shallow = new THREE.Color('#4dd8e8'); // bright cyan
    const mid = new THREE.Color('#2899cc');      // medium blue
    const deep = new THREE.Color('#1a6699');      // deep blue

    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      const len = Math.sqrt(x*x + y*y + z*z);
      const nx = x/len, ny = y/len, nz = z/len;
      const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
      const lng = Math.atan2(nz, nx) * 180 / Math.PI;

      // Check distance to nearest land
      let nearCoast = false;
      let veryNearCoast = false;
      if (mask.isLand(lat+2, lng) || mask.isLand(lat-2, lng) ||
          mask.isLand(lat, lng+2) || mask.isLand(lat, lng-2)) {
        veryNearCoast = true;
      } else if (mask.isLand(lat+5, lng) || mask.isLand(lat-5, lng) ||
          mask.isLand(lat, lng+5) || mask.isLand(lat, lng-5)) {
        nearCoast = true;
      }

      if (veryNearCoast) c.copy(shallow);
      else if (nearCoast) c.copy(mid);
      else c.copy(deep);

      colors[i*3] = c.r;
      colors[i*3+1] = c.g;
      colors[i*3+2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.uniforms = { oceanTime: { value: 0 } };

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: new THREE.Color('#0a2040'),
      shininess: 8,
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

        // Sparkle dots
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
        sparkle = smoothstep(0.35, 0.90, sparkle) * sparkleMask;
        gl_FragColor.rgb += vec3(1.0, 1.0, 1.0) * sparkle * 0.5;

        // 4 waves, extremely narrow lines
        float w1 = sin(wp.x * 43.0 + wp.y * 27.0 + wp.z * 11.0 + oceanTime * 3.6) * 0.5 + 0.5;
        float w2 = sin(wp.y * 37.0 + wp.z * 53.0 + wp.x * 7.0 - oceanTime * 2.7) * 0.5 + 0.5;
        float w3 = sin(wp.z * 31.0 + wp.x * 19.0 + wp.y * 47.0 + oceanTime * 2.1) * 0.5 + 0.5;
        float w4 = sin(wp.x * 17.0 + wp.z * 29.0 - wp.y * 13.0 + oceanTime * 1.5) * 0.5 + 0.5;
        float foam = w1 * w2 * w3 * w4;
        foam = 1.0 - smoothstep(0.00001, 0.0008, foam);
        gl_FragColor.rgb += vec3(0.8, 0.95, 1.0) * foam * 0.05;

        // Fresnel rim
        vec3 rimViewDir = normalize(vViewPosition);
        vec3 rimNormal = normalize(normal);
        float rimFresnel = 1.0 - abs(dot(rimViewDir, rimNormal));
        gl_FragColor.rgb += vec3(0.5, 0.8, 1.0) * 0.4 * pow(rimFresnel, 3.5);

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
