import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLOBE_RADIUS } from '../globe/terrain';

interface LabelDef {
  name: string;
  lat: number;
  lng: number;
}

const LABELS: LabelDef[] = [
  { name: 'Africa', lat: 5, lng: 20 },
  { name: 'Europe', lat: 50, lng: 15 },
  { name: 'Asia', lat: 45, lng: 90 },
  { name: 'North America', lat: 45, lng: -100 },
  { name: 'South America', lat: -15, lng: -60 },
  { name: 'Australia', lat: -25, lng: 135 },
  { name: 'Antarctica', lat: -80, lng: 0 },
  { name: 'Pacific Ocean', lat: 0, lng: -160 },
  { name: 'Atlantic Ocean', lat: 15, lng: -35 },
  { name: 'Indian Ocean', lat: -20, lng: 75 },
];

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export class Labels {
  group: THREE.Group;
  private labels: { obj: CSS2DObject; normal: THREE.Vector3; element: HTMLDivElement }[] = [];

  constructor() {
    this.group = new THREE.Group();
    const labelRadius = GLOBE_RADIUS + 0.3;

    for (const def of LABELS) {
      const pos = latLngToPosition(def.lat, def.lng, labelRadius);
      const normal = pos.clone().normalize();

      const div = document.createElement('div');
      div.textContent = def.name;
      div.style.cssText = 'color: white; font-size: 11px; font-family: Inter, system-ui, sans-serif; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.6); pointer-events: none; white-space: nowrap; opacity: 0; transition: opacity 0.3s;';

      const label = new CSS2DObject(div);
      label.position.copy(pos);
      this.group.add(label);
      this.labels.push({ obj: label, normal, element: div });
    }
  }

  update(camera: THREE.PerspectiveCamera): void {
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const camPos = camera.position.clone().normalize();

    for (const { normal, element } of this.labels) {
      // dot > 0 means label faces camera
      const dot = normal.dot(camPos);
      if (dot > 0.15) {
        element.style.opacity = '1';
      } else if (dot > -0.1) {
        element.style.opacity = String((dot + 0.1) / 0.25);
      } else {
        element.style.opacity = '0';
      }
    }
  }
}
