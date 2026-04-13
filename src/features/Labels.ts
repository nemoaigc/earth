import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLOBE_RADIUS } from '../globe/terrain';
import { latLngToPosition } from '../utils/geo';

interface LabelDef {
  name: string;
  lat: number;
  lng: number;
}

const LABELS: LabelDef[] = [
  { name: 'Africa', lat: 5, lng: -20 },
  { name: 'Europe', lat: 50, lng: -15 },
  { name: 'Asia', lat: 45, lng: -90 },
  { name: 'North America', lat: 45, lng: 100 },
  { name: 'South America', lat: -15, lng: 60 },
  { name: 'Australia', lat: -25, lng: -135 },
  { name: 'Antarctica', lat: -80, lng: 0 },
  { name: 'Pacific Ocean', lat: 0, lng: 160 },
  { name: 'Atlantic Ocean', lat: 15, lng: 35 },
  { name: 'Indian Ocean', lat: -20, lng: -75 },
];

export class Labels {
  group: THREE.Group;
  private labels: { obj: CSS2DObject; normal: THREE.Vector3; element: HTMLDivElement }[] = [];
  private _camDir = new THREE.Vector3();
  private _camPos = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    const labelRadius = GLOBE_RADIUS + 0.3;

    for (const def of LABELS) {
      const pos = latLngToPosition(def.lat, def.lng, labelRadius);
      const normal = pos.clone().normalize();

      const div = document.createElement('div');
      div.textContent = def.name;
      div.style.cssText = 'color: white; font-size: 28px; font-family: Inter, system-ui, sans-serif; font-weight: 800; text-shadow: 0 3px 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4); pointer-events: none; white-space: nowrap; opacity: 0; transition: opacity 0.3s; letter-spacing: 3px; text-transform: uppercase;';

      const label = new CSS2DObject(div);
      label.position.copy(pos);
      this.group.add(label);
      this.labels.push({ obj: label, normal, element: div });
    }
  }

  update(camera: THREE.PerspectiveCamera): void {
    camera.getWorldDirection(this._camDir);
    this._camPos.copy(camera.position).normalize();

    for (const { normal, element } of this.labels) {
      // dot > 0 means label faces camera
      const dot = normal.dot(this._camPos);
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
