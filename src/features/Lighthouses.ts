import * as THREE from 'three';
import type { TerrainData } from '../globe/terrain';

const LIGHTHOUSE_COUNT_MIN = 4;
const LIGHTHOUSE_COUNT_MAX = 6;

function buildLighthouse(): THREE.Group {
  const lighthouse = new THREE.Group();

  // --- Rocky base (irregular stone platform) ---
  const baseGeo = new THREE.DodecahedronGeometry(0.05, 0);
  const bp = baseGeo.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    bp.setY(i, bp.getY(i) * 0.3); // flatten
    bp.setX(i, bp.getX(i) + (Math.random() - 0.5) * 0.01);
    bp.setZ(i, bp.getZ(i) + (Math.random() - 0.5) * 0.01);
  }
  baseGeo.translate(0, 0.01, 0);
  baseGeo.computeVertexNormals();
  const baseMat = new THREE.MeshPhongMaterial({ color: '#8A8070', shininess: 5, flatShading: true });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.castShadow = true;
  base.receiveShadow = true;
  lighthouse.add(base);

  // --- Tower: tapered cylinder with red/white stripes ---
  const towerHeight = 0.3;
  const towerGeo = new THREE.CylinderGeometry(0.02, 0.035, towerHeight, 12, 8);
  const towerPos = towerGeo.getAttribute('position');

  const towerColors = new Float32Array(towerPos.count * 3);
  const red = new THREE.Color('#cc3333');
  const white = new THREE.Color('#f0f0f0');

  for (let i = 0; i < towerPos.count; i++) {
    const y = towerPos.getY(i);
    const t = (y + towerHeight / 2) / towerHeight;
    const bandIndex = Math.floor(t * 6);
    const color = bandIndex % 2 === 0 ? red : white;
    towerColors[i * 3] = color.r;
    towerColors[i * 3 + 1] = color.g;
    towerColors[i * 3 + 2] = color.b;
  }
  towerGeo.setAttribute('color', new THREE.BufferAttribute(towerColors, 3));
  towerGeo.translate(0, 0.02 + towerHeight / 2, 0);

  const towerMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20 });
  towerMat.color.set(0xffffff);
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.castShadow = true;
  lighthouse.add(tower);

  // --- Railing ---
  const railingGeo = new THREE.TorusGeometry(0.024, 0.002, 6, 16);
  railingGeo.rotateX(Math.PI / 2);
  railingGeo.translate(0, 0.02 + towerHeight, 0);
  const railingMat = new THREE.MeshPhongMaterial({ color: '#777777', shininess: 30 });
  const railing = new THREE.Mesh(railingGeo, railingMat);
  lighthouse.add(railing);

  // --- Light room ---
  const lightRoomGeo = new THREE.BoxGeometry(0.035, 0.03, 0.035);
  lightRoomGeo.translate(0, 0.02 + towerHeight + 0.015, 0);
  const lightRoomMat = new THREE.MeshPhongMaterial({
    color: '#ffeeaa',
    emissive: '#ffeeaa',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
    shininess: 60,
  });
  lighthouse.add(new THREE.Mesh(lightRoomGeo, lightRoomMat));

  // --- Light beam ---
  const beamLength = 0.8;
  const beamGeo = new THREE.ConeGeometry(0.15, beamLength, 16, 1, true);
  beamGeo.translate(0, beamLength / 2, 0);
  beamGeo.rotateX(Math.PI / 2);

  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffcc44') },
      uColorTip: { value: new THREE.Color('#ff8800') },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uColorTip;
      varying vec3 vPosition;
      void main() {
        float dist = clamp(vPosition.z / 0.8, 0.0, 1.0);
        float radius = length(vPosition.xy);
        float maxRadius = mix(0.01, 0.15, dist);
        float edgeFade = 1.0 - smoothstep(maxRadius * 0.3, maxRadius, radius);
        float tipFade = 1.0 - smoothstep(0.3, 1.0, dist);
        float alpha = edgeFade * tipFade * 0.4;
        vec3 color = mix(uColor, uColorTip, dist);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const beam = new THREE.Mesh(beamGeo, beamMat);
  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 0.02 + towerHeight + 0.015, 0);
  beamPivot.add(beam);
  lighthouse.userData.beamPivot = beamPivot;
  lighthouse.add(beamPivot);

  return lighthouse;
}

export class Lighthouses {
  group: THREE.Group;
  private beamPivots: THREE.Group[] = [];
  private rotationSpeeds: number[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const eligible = terrainData.coastPoints;
    if (eligible.length === 0) return;

    const count = LIGHTHOUSE_COUNT_MIN + Math.floor(
      Math.random() * (LIGHTHOUSE_COUNT_MAX - LIGHTHOUSE_COUNT_MIN + 1)
    );
    const shuffled = eligible.sort(() => Math.random() - 0.5);

    const usedPositions: THREE.Vector3[] = [];
    const minDistance = 2.0;
    let placed = 0;

    for (let i = 0; i < shuffled.length && placed < count; i++) {
      const point = shuffled[i];
      let tooClose = false;
      for (const used of usedPositions) {
        if (point.position.distanceTo(used) < minDistance) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      usedPositions.push(point.position.clone());

      const lh = buildLighthouse();
      lh.position.copy(point.position);
      lh.lookAt(0, 0, 0);
      lh.rotateX(Math.PI / 2);

      this.beamPivots.push(lh.userData.beamPivot as THREE.Group);
      this.rotationSpeeds.push(0.8 + Math.random() * 0.6);

      this.group.add(lh);
      placed++;
    }
  }

  update(time: number): void {
    for (let i = 0; i < this.beamPivots.length; i++) {
      this.beamPivots[i].rotation.y = time * this.rotationSpeeds[i];
    }
  }
}
