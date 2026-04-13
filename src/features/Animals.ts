import * as THREE from 'three';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';
import { ANIMALS, type AnimalInfo } from '../data/animals';
import { AnimalPanel } from '../ui/AnimalPanel';

interface PlacedAnimal {
  sprite: THREE.Sprite;
  info: AnimalInfo;
  baseScale: number;
}

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.sin(theta) * radius,
  );
}


export class Animals {
  group: THREE.Group;
  private placed: PlacedAnimal[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredAnimal: PlacedAnimal | null = null;
  private selectedAnimal: PlacedAnimal | null = null;
  private tooltip: HTMLDivElement;
  private panel: AnimalPanel;
  private domElement: HTMLElement;

  constructor(terrainData: TerrainData, domElement: HTMLElement) {
    this.group = new THREE.Group();
    this.domElement = domElement;
    const loader = new THREE.TextureLoader();

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'animal-tooltip';
    this.tooltip.style.cssText = `
      position: fixed; pointer-events: none; z-index: 100;
      padding: 6px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.45);
      box-shadow: 0 2px 20px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      font-size: 13px; font-weight: 500; color: #1d1d1f;
      white-space: nowrap; display: none;
      transform: translateY(-100%) translateY(-12px);
      transition: opacity 0.15s ease;
    `;
    document.body.appendChild(this.tooltip);

    // Create panel
    this.panel = new AnimalPanel();

    // Event listeners
    domElement.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('click', this.onClick);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.deselect();
    });

    // Load and place animals
    for (const info of ANIMALS) {
      const positions = this.getPositions(info, terrainData);
      if (positions.length === 0) continue;

      loader.load(`animals/${info.id}.png`, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        for (const pos of positions) {
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false,
            fog: true,
          });

          const sprite = new THREE.Sprite(material);
          const s = info.scale * 1.8 * (0.9 + Math.random() * 0.2);
          sprite.scale.set(s, s, s);

          const normal = pos.clone().normalize();
          sprite.position.copy(pos).addScaledVector(normal, s * 0.45);

          // Store reference on userData
          sprite.userData.animalId = info.id;

          this.placed.push({ sprite, info, baseScale: s });
          this.group.add(sprite);
        }
      });
    }
  }

  private getPositions(def: AnimalInfo, _terrainData: TerrainData): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < def.count; i++) {
      // Small random offset so multiple instances don't stack exactly
      const latOff = (Math.random() - 0.5) * 2;
      const lngOff = (Math.random() - 0.5) * 2;
      positions.push(
        latLngToPosition(def.lat + latOff, def.lng + lngOff, GLOBE_RADIUS + 1.5),
      );
    }
    return positions;
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._tooltipX = e.clientX;
    this._tooltipY = e.clientY;
  };

  private _tooltipX = 0;
  private _tooltipY = 0;

  private onClick = () => {
    if (this.hoveredAnimal) {
      this.select(this.hoveredAnimal);
    }
  };

  private select(animal: PlacedAnimal) {
    this.selectedAnimal = animal;
    this.panel.show(animal.info);
    this.tooltip.style.display = 'none';
  }

  deselect() {
    this.selectedAnimal = null;
    this.panel.hide();
  }

  update(_time: number, camera: THREE.Camera): void {
    if (this.placed.length === 0) return;

    // Raycast
    this.raycaster.setFromCamera(this.mouse, camera);
    const sprites = this.placed.map((p) => p.sprite);
    const intersects = this.raycaster.intersectObjects(sprites, false);

    let newHover: PlacedAnimal | null = null;
    if (intersects.length > 0) {
      const hitSprite = intersects[0].object;
      newHover = this.placed.find((p) => p.sprite === hitSprite) || null;
    }

    // Update hover state
    if (newHover !== this.hoveredAnimal) {
      this.hoveredAnimal = newHover;
      if (newHover && !this.selectedAnimal) {
        const statusLabel = newHover.info.status === 'extinct' ? '已灭绝' : '濒危';
        this.tooltip.innerHTML = `
          <span style="color:#86868b;font-size:11px;margin-right:6px;">${statusLabel}</span>
          ${newHover.info.nameCn}
          <span style="color:#86868b;font-size:11px;margin-left:4px;">${newHover.info.name}</span>
        `;
        this.tooltip.style.display = 'block';
        this.domElement.style.cursor = 'pointer';
      } else {
        this.tooltip.style.display = 'none';
        this.domElement.style.cursor = '';
      }
    }

    // Update tooltip position
    if (this.hoveredAnimal && this.tooltip.style.display === 'block') {
      this.tooltip.style.left = `${this._tooltipX}px`;
      this.tooltip.style.top = `${this._tooltipY}px`;
    }

    // Animate scales (hover effect)
    for (const placed of this.placed) {
      const isHovered = placed === this.hoveredAnimal;
      const isSelected = placed === this.selectedAnimal;
      const target = (isHovered || isSelected ? 1.8 : 1) * placed.baseScale;
      const cur = placed.sprite.scale.x;
      const next = cur + (target - cur) * 0.12;
      placed.sprite.scale.set(next, next, next);
    }
  }

  dispose() {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('click', this.onClick);
    this.tooltip.remove();
    this.panel.dispose();
  }
}
