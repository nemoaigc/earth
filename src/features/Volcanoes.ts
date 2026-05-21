import * as THREE from 'three';
import { GLOBE_RADIUS } from '../globe/terrain';

// Self-contained feature. Does NOT touch terrain / mask / Globe data.
// Only depends on GLOBE_RADIUS to know where to place itself.
// Style matches the project's trees: simple primitive geometry, flat
// shading, small palette — readable at any zoom.
//
// lng convention follows the rest of the codebase: east hemisphere is
// stored as a NEGATIVE number (real-world 138.7°E → -138.7 here).

interface Volcano {
  lat: number;
  lng: number;
  size: number;     // radius of the cone base, in world units
  smoke?: boolean;
}

const VOLCANOES: Volcano[] = [
  // Pacific Ring of Fire
  { lat:  46.2, lng:  122.2, size: 0.07, smoke: false }, // Mt St Helens
  { lat:  19.4, lng:  155.3, size: 0.07, smoke: true  }, // Kilauea (Hawaii)
  { lat: -39.3, lng:  171.4, size: 0.06, smoke: false }, // Mt Ruapehu (NZ)
  // SE Asia
  { lat:  -6.1, lng: -105.4, size: 0.07, smoke: true  }, // Krakatoa
  { lat:  -7.5, lng: -110.4, size: 0.06, smoke: true  }, // Mt Merapi
  // Europe
  { lat:  40.8, lng:  -14.4, size: 0.07, smoke: true  }, // Vesuvius
  { lat:  37.7, lng:  -15.0, size: 0.08, smoke: true  }, // Etna
  // Iceland
  { lat:  64.6, lng:   19.6, size: 0.06, smoke: true  }, // Eyjafjallajökull
  // Americas
  { lat:  -0.7, lng:   78.4, size: 0.07, smoke: true  }, // Cotopaxi
  { lat:  19.0, lng:   98.6, size: 0.07, smoke: true  }, // Popocatépetl
  // Africa — these mountains already exist as elevated cones in the
  // terrain table, so the volcano sprite just adds the active-volcano
  // detail (lava tip + optional smoke).
  { lat:  -3.1, lng:  -37.3, size: 0.09, smoke: false }, // Kilimanjaro (dormant)
];

function latLngToVec3(lat: number, lng: number, r: number, out: THREE.Vector3): void {
  const phi = lat * Math.PI / 180;
  const theta = lng * Math.PI / 180;
  out.set(
    Math.cos(phi) * Math.cos(theta) * r,
    Math.sin(phi) * r,
    Math.cos(phi) * Math.sin(theta) * r,
  );
}

function makeSmokeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0,    'rgba(235, 235, 235, 0.85)');
  g.addColorStop(0.5,  'rgba(200, 200, 200, 0.45)');
  g.addColorStop(1,    'rgba(180, 180, 180, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Volcanoes {
  group: THREE.Group;
  private smokes: { sprite: THREE.Sprite; phase: number; baseScale: number }[] = [];

  constructor() {
    this.group = new THREE.Group();

    const coneMat = new THREE.MeshPhongMaterial({
      color: '#4D3E30',
      flatShading: true,
      shininess: 2,
    });
    const tipMat = new THREE.MeshPhongMaterial({
      color: '#E5763A',
      flatShading: true,
      emissive: '#C53A10',
      emissiveIntensity: 0.5,
    });
    const smokeTex = makeSmokeTexture();

    const tmp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const v of VOLCANOES) {
      // Main cone: low-poly, 7 segments for slight asymmetry.
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(v.size, v.size * 1.4, 7),
        coneMat,
      );

      // Lava tip: small bright cone seated on top.
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(v.size * 0.32, v.size * 0.22, 6),
        tipMat,
      );
      tip.position.y = v.size * 0.75;
      cone.add(tip);

      // Place + orient onto the sphere surface.
      latLngToVec3(v.lat, v.lng, GLOBE_RADIUS + v.size * 0.55, tmp);
      cone.position.copy(tmp);
      cone.quaternion.setFromUnitVectors(up, tmp.clone().normalize());
      this.group.add(cone);

      // Optional smoke plume — billboard sprite drifting up.
      if (v.smoke) {
        const mat = new THREE.SpriteMaterial({
          map: smokeTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.7,
        });
        const sprite = new THREE.Sprite(mat);
        latLngToVec3(v.lat, v.lng, GLOBE_RADIUS + v.size * 1.7, tmp);
        sprite.position.copy(tmp);
        const s = v.size * 2.4;
        sprite.scale.set(s, s, s);
        this.group.add(sprite);
        this.smokes.push({
          sprite,
          phase: Math.sin((v.lat + v.lng) * 9.13) * Math.PI,  // deterministic
          baseScale: s,
        });
      }
    }
  }

  update(time: number): void {
    // Gentle pulse on the smoke so the volcanoes feel alive.
    for (const s of this.smokes) {
      const t = time * 0.6 + s.phase;
      s.sprite.material.opacity = 0.55 + Math.sin(t) * 0.20;
      const scale = s.baseScale * (1.0 + Math.sin(t * 0.7) * 0.08);
      s.sprite.scale.set(scale, scale, scale);
    }
  }
}
