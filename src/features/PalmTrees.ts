import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PALM_COUNT = 60;

function buildPalmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // --- Trunk: slightly curved cylinder ---
  const trunkSegments = 8;
  const trunkHeight = 0.22;
  const trunkRadius = 0.012;
  const trunkGeo = new THREE.CylinderGeometry(
    trunkRadius * 0.6,
    trunkRadius,
    trunkHeight,
    6,
    trunkSegments
  );

  // Bend the trunk slightly
  const trunkPos = trunkGeo.getAttribute('position');
  for (let i = 0; i < trunkPos.count; i++) {
    const y = trunkPos.getY(i);
    const t = (y + trunkHeight / 2) / trunkHeight; // 0 at base, 1 at top
    const bend = Math.sin(t * Math.PI * 0.5) * 0.03;
    trunkPos.setX(i, trunkPos.getX(i) + bend);
  }
  trunkGeo.translate(0.0, trunkHeight / 2, 0);

  // Color trunk brown
  const trunkColor = new THREE.Color('#8B6914');
  const trunkColors = new Float32Array(trunkPos.count * 3);
  for (let i = 0; i < trunkPos.count; i++) {
    trunkColors[i * 3] = trunkColor.r;
    trunkColors[i * 3 + 1] = trunkColor.g;
    trunkColors[i * 3 + 2] = trunkColor.b;
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(trunkColors, 3));
  parts.push(trunkGeo);

  // --- Fronds ---
  const frondColor = new THREE.Color('#2d8a1e');
  const frondCount = 6;
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    // Elongated triangle shape
    const frondGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      0.12, -0.04, 0.015,
      0.12, -0.04, -0.015,
    ]);
    frondGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    frondGeo.computeVertexNormals();

    // Color
    const fColors = new Float32Array(3 * 3);
    for (let i = 0; i < 3; i++) {
      fColors[i * 3] = frondColor.r;
      fColors[i * 3 + 1] = frondColor.g;
      fColors[i * 3 + 2] = frondColor.b;
    }
    frondGeo.setAttribute('color', new THREE.BufferAttribute(fColors, 3));

    // Position at top of trunk, rotated outward and slightly drooping
    const mat = new THREE.Matrix4();
    mat.makeTranslation(0.0, trunkHeight, 0);
    const rotY = new THREE.Matrix4().makeRotationY(angle);
    const rotZ = new THREE.Matrix4().makeRotationZ(-0.3); // droop
    mat.multiply(rotY).multiply(rotZ);
    frondGeo.applyMatrix4(mat);

    parts.push(frondGeo);
  }

  // --- Coconuts ---
  const coconutColor = new THREE.Color('#8B4513');
  for (let c = 0; c < 3; c++) {
    const coconutGeo = new THREE.SphereGeometry(0.01, 4, 4);
    const cAngle = (c / 3) * Math.PI * 2 + 0.5;
    const cx = Math.cos(cAngle) * 0.015;
    const cz = Math.sin(cAngle) * 0.015;
    coconutGeo.translate(cx, trunkHeight - 0.01, cz);

    const cPos = coconutGeo.getAttribute('position');
    const cColors = new Float32Array(cPos.count * 3);
    for (let i = 0; i < cPos.count; i++) {
      cColors[i * 3] = coconutColor.r;
      cColors[i * 3 + 1] = coconutColor.g;
      cColors[i * 3 + 2] = coconutColor.b;
    }
    coconutGeo.setAttribute('color', new THREE.BufferAttribute(cColors, 3));
    parts.push(coconutGeo);
  }

  // Ensure all parts are non-indexed for merging
  const nonIndexed = parts.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    // Ensure all have the same attributes
    if (!ni.getAttribute('normal')) ni.computeVertexNormals();
    if (!ni.getAttribute('uv')) {
      const count = ni.getAttribute('position').count;
      ni.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    return ni;
  });

  return mergeGeometries(nonIndexed, false);
}

export class PalmTrees {
  group: THREE.Group;
  private mesh: THREE.InstancedMesh;
  private material: THREE.MeshPhongMaterial;
  private timeUniform: { value: number };

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    this.timeUniform = { value: 0 };

    const palmGeo = buildPalmGeometry();

    this.material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 10,
    });

    // Wind sway (slower than regular trees)
    const timeUniform = this.timeUniform;
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
        float swayAmount = transformed.y * transformed.y * 0.015;
        transformed.x += sin(uTime * 1.2 + worldPos4.x * 2.0 + worldPos4.z * 1.5) * swayAmount;
        transformed.z += cos(uTime * 1.0 + worldPos4.z * 2.0 + worldPos4.x * 1.5) * swayAmount;`
      );
    };

    const eligible = terrainData.coastPoints;
    const count = Math.min(PALM_COUNT, eligible.length);

    this.mesh = new THREE.InstancedMesh(palmGeo, this.material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const shuffled = eligible.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const point = shuffled[i];

      dummy.position.copy(point.position);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);

      const scale = 0.8 + Math.random() * 0.4;
      dummy.scale.set(scale, scale, scale);
      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  update(time: number): void {
    this.timeUniform.value = time;
  }
}
