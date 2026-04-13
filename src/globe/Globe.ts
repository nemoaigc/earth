import * as THREE from 'three';
import { generateTerrain, GLOBE_RADIUS } from './terrain';
import type { TerrainData } from './terrain';
import { Atmosphere } from './Atmosphere';

const loader = new THREE.TextureLoader();

export class Globe {
  group: THREE.Group;
  terrain: THREE.Mesh;
  terrainMaterial: THREE.ShaderMaterial;
  atmosphere: Atmosphere;
  terrainData: TerrainData;

  // Expose for main.ts ocean color access
  ocean = { update(_t: number) {}, material: { color: new THREE.Color(), emissive: new THREE.Color() } };

  constructor() {
    this.group = new THREE.Group();

    this.terrainData = generateTerrain();

    const colorMap = loader.load('/earth-map.jpg');
    const bumpMap = loader.load('/earth-bump.jpg');

    // Custom shader: land uses texture, ocean uses animated sparkle
    this.terrainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColorMap: { value: colorMap },
        uBumpMap: { value: bumpMap },
        uTime: { value: 0 },
        uGlobeRadius: { value: GLOBE_RADIUS },
      },
      vertexShader: `
        uniform sampler2D uBumpMap;
        uniform float uGlobeRadius;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vDisplacement;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);

          // Displacement from bump map
          float bump = texture2D(uBumpMap, uv).r;
          // Only displace land (bump > 0.05 means above sea level)
          float disp = bump > 0.05 ? bump * 0.4 : 0.0;
          vDisplacement = disp;
          vec3 displaced = position + normal * disp;

          vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uColorMap;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vDisplacement;

        void main() {
          vec4 texColor = texture2D(uColorMap, vUv);

          // Detect ocean: blue-dominant pixels in the texture
          float blueness = texColor.b - max(texColor.r, texColor.g);
          float isOcean = smoothstep(0.02, 0.08, blueness);

          // === LAND: use texture color ===
          vec3 landColor = texColor.rgb;
          // Simple lighting
          vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
          float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5;
          landColor *= diff;

          // === OCEAN: blue base + sparkle ===
          vec3 wp = vWorldPos;
          vec3 oceanBase = vec3(0.12, 0.40, 0.60);

          // Sparkle dots
          float sp1 = sin(wp.x * 40.0 + wp.y * 23.0 + wp.z * 9.0 + uTime * 3.5);
          float sp2 = sin(wp.y * 35.0 + wp.z * 29.0 + wp.x * 13.0 - uTime * 2.8);
          float sp3 = sin(wp.z * 27.0 + wp.x * 37.0 - wp.y * 17.0 + uTime * 4.1);
          float sp4 = sin(wp.x * 71.0 - wp.z * 47.0 + wp.y * 5.0 + uTime * 1.9);
          float sp5 = sin(wp.y * 59.0 + wp.x * 11.0 - wp.z * 31.0 - uTime * 2.3);
          float sparkleMask = sin(wp.x * 3.1 + wp.z * 4.7 + uTime * 0.25)
                            * sin(wp.y * 5.3 - wp.x * 2.9 - uTime * 0.18);
          sparkleMask *= sin(wp.z * 2.3 + wp.y * 3.9 + uTime * 0.35);
          sparkleMask = smoothstep(0.15, 0.5, sparkleMask);
          float sparkle = sp1 * sp2 * sp3 * sp4 + sp2 * sp3 * sp5 * 0.5;
          sparkle = smoothstep(0.35, 0.90, sparkle) * sparkleMask;

          // Subtle foam
          float w1 = sin(wp.x * 43.0 + wp.y * 27.0 + wp.z * 11.0 + uTime * 3.6) * 0.5 + 0.5;
          float w2 = sin(wp.y * 37.0 + wp.z * 53.0 + wp.x * 7.0 - uTime * 2.7) * 0.5 + 0.5;
          float w3 = sin(wp.z * 31.0 + wp.x * 19.0 + wp.y * 47.0 + uTime * 2.1) * 0.5 + 0.5;
          float w4 = sin(wp.x * 17.0 + wp.z * 29.0 - wp.y * 13.0 + uTime * 1.5) * 0.5 + 0.5;
          float foam = w1 * w2 * w3 * w4;
          foam = 1.0 - smoothstep(0.00001, 0.0008, foam);

          vec3 oceanColor = oceanBase * diff;
          oceanColor += vec3(1.0) * sparkle * 0.5;
          oceanColor += vec3(0.8, 0.95, 1.0) * foam * 0.05;

          // Fresnel rim on ocean
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
          oceanColor += vec3(0.3, 0.5, 0.7) * pow(fresnel, 3.0) * 0.3;

          // === MIX: smooth transition at coastline ===
          vec3 finalColor = mix(landColor, oceanColor, isOcean);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 256, 256);
    this.terrain = new THREE.Mesh(geometry, this.terrainMaterial);

    this.atmosphere = new Atmosphere();

    this.group.add(this.terrain);
    this.group.add(this.atmosphere.mesh);
  }

  update(time: number, atmosphereColor: THREE.Color): void {
    this.terrainMaterial.uniforms.uTime.value = time;
    this.atmosphere.updateColor(atmosphereColor);
  }
}
