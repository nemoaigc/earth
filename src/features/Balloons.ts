import * as THREE from 'three';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';

const BALLOON_COUNT_MIN = 5;
const BALLOON_COUNT_MAX = 8;

const BRIGHT_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#264653', '#e9c46a',
  '#d62828', '#457b9d', '#f77f00', '#6a4c93', '#1982c4',
];

function buildBalloon(): THREE.Group {
  const balloon = new THREE.Group();

  // Pick two random bright colors for stripes
  const color1 = new THREE.Color(BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)]);
  let color2Idx = Math.floor(Math.random() * BRIGHT_COLORS.length);
  const color2 = new THREE.Color(BRIGHT_COLORS[color2Idx]);

  // --- Envelope: LatheGeometry with balloon profile ---
  const profilePoints: THREE.Vector2[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let radius: number;
    if (t < 0.15) {
      // Bottom neck (narrow opening)
      radius = 0.02 + t * 0.8;
    } else if (t < 0.5) {
      // Expanding bulge
      const s = (t - 0.15) / 0.35;
      radius = 0.14 + Math.sin(s * Math.PI * 0.5) * 0.06;
    } else if (t < 0.85) {
      // Main body (widest)
      const s = (t - 0.5) / 0.35;
      radius = 0.2 * Math.cos(s * Math.PI * 0.3);
    } else {
      // Top closing
      const s = (t - 0.85) / 0.15;
      radius = 0.2 * Math.cos(Math.PI * 0.3) * (1 - s * 0.9);
    }
    const y = t * 0.25; // Total height of envelope ~0.25
    profilePoints.push(new THREE.Vector2(Math.max(0.005, radius), y));
  }

  const envelopeGeo = new THREE.LatheGeometry(profilePoints, 16);
  envelopeGeo.translate(0, 0.08, 0); // Lift above basket

  // Striped vertex colors
  const envPos = envelopeGeo.getAttribute('position');
  const envColors = new Float32Array(envPos.count * 3);
  for (let i = 0; i < envPos.count; i++) {
    // Use angle around Y axis for striping
    const x = envPos.getX(i);
    const z = envPos.getZ(i);
    const angle = Math.atan2(z, x);
    const stripeIndex = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8);
    const color = stripeIndex % 2 === 0 ? color1 : color2;
    envColors[i * 3] = color.r;
    envColors[i * 3 + 1] = color.g;
    envColors[i * 3 + 2] = color.b;
  }
  envelopeGeo.setAttribute('color', new THREE.BufferAttribute(envColors, 3));

  const envelopeMat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 20,
    side: THREE.DoubleSide,
  });
  const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
  envelope.castShadow = true;
  balloon.add(envelope);

  // --- Basket ---
  const basketGeo = new THREE.BoxGeometry(0.04, 0.03, 0.04);
  basketGeo.translate(0, 0.015, 0);
  const basketMat = new THREE.MeshPhongMaterial({ color: '#9A7A5A', shininess: 10 });
  const basket = new THREE.Mesh(basketGeo, basketMat);
  balloon.add(basket);

  // --- 4 ropes connecting basket corners to envelope bottom ---
  const ropeMat = new THREE.MeshBasicMaterial({ color: '#8a7a5a' });
  const ropeOffsets = [
    [-0.018, 0.018],
    [0.018, 0.018],
    [0.018, -0.018],
    [-0.018, -0.018],
  ];

  for (const [rx, rz] of ropeOffsets) {
    const ropeLength = 0.07;
    const ropeGeo = new THREE.CylinderGeometry(0.002, 0.002, ropeLength, 4);
    ropeGeo.translate(0, ropeLength / 2, 0);

    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(rx, 0.03, rz);

    // Angle rope inward slightly toward center at envelope contact point
    const angleX = Math.atan2(rz, ropeLength) * -0.3;
    const angleZ = Math.atan2(rx, ropeLength) * 0.3;
    rope.rotation.set(angleX, 0, angleZ);

    balloon.add(rope);
  }

  // --- Burner glow: small emissive sphere ---
  const burnerGeo = new THREE.SphereGeometry(0.01, 6, 6);
  burnerGeo.translate(0, 0.07, 0);
  const burnerMat = new THREE.MeshBasicMaterial({
    color: '#ff6600',
    transparent: true,
    opacity: 0.8,
  });
  const burner = new THREE.Mesh(burnerGeo, burnerMat);
  balloon.add(burner);

  return balloon;
}

interface BalloonInstance {
  group: THREE.Group;
  basePosition: THREE.Vector3;
  normal: THREE.Vector3;
  baseRadius: number;
  bobPhase: number;
  driftSpeed: number;
}

export class Balloons {
  group: THREE.Group;
  private balloons: BalloonInstance[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();

    const eligible = terrainData.landPoints.filter((p) => p.height > 0.1 && p.height < 0.5);
    if (eligible.length === 0) return;

    const count = BALLOON_COUNT_MIN + Math.floor(
      Math.random() * (BALLOON_COUNT_MAX - BALLOON_COUNT_MIN + 1)
    );
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const actual = Math.min(count, shuffled.length);

    for (let i = 0; i < actual; i++) {
      const point = shuffled[i];
      const balloonGroup = buildBalloon();

      // Position above the globe surface
      const floatHeight = GLOBE_RADIUS + 0.8 + Math.random() * 0.4; // 0.8 to 1.2 above center
      const normal = point.normal.clone().normalize();
      const pos = normal.clone().multiplyScalar(floatHeight);

      balloonGroup.position.copy(pos);
      balloonGroup.lookAt(0, 0, 0);
      balloonGroup.rotateX(Math.PI / 2);

      const scale = 0.8 + Math.random() * 0.4;
      balloonGroup.scale.set(scale, scale, scale);

      this.balloons.push({
        group: balloonGroup,
        basePosition: pos.clone(),
        normal: normal.clone(),
        baseRadius: floatHeight,
        bobPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.03 + Math.random() * 0.04,
      });

      this.group.add(balloonGroup);
    }
  }

  update(time: number): void {
    for (const b of this.balloons) {
      // Gentle bobbing on the radial axis
      const bobOffset = Math.sin(time * 0.8 + b.bobPhase) * 0.05;
      const currentRadius = b.baseRadius + bobOffset;

      // Slow drift: rotate the position around the globe
      const driftAngle = time * b.driftSpeed;
      const axis = new THREE.Vector3(0, 1, 0); // drift around global Y
      const driftedNormal = b.normal.clone().applyAxisAngle(axis, driftAngle);

      const newPos = driftedNormal.multiplyScalar(currentRadius);
      b.group.position.copy(newPos);

      // Re-orient outward
      b.group.lookAt(0, 0, 0);
      b.group.rotateX(Math.PI / 2);
    }
  }
}
