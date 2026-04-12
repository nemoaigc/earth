import * as THREE from 'three';
import type { SkyStop } from '../systems/DayNightCycle';

export class SkyDome {
  mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    const geometry = new THREE.SphereGeometry(50, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
  }

  updateGradient(skyStops: SkyStop[]): void {
    const { ctx, canvas } = this;

    // Top half: stop 0 (zenith) → stop 1 (horizon) at canvas middle
    // Bottom half: mirror
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

    // Map sky stops to canvas: stop 0 = top, stop 1 = middle
    for (const s of skyStops) {
      const pos = s.stop * 0.5; // 0→0, 1→0.5 (middle)
      gradient.addColorStop(pos, `#${s.color.getHexString()}`);
    }
    // Mirror for bottom half
    for (let i = skyStops.length - 1; i >= 0; i--) {
      const s = skyStops[i];
      const pos = 1.0 - s.stop * 0.5; // 1→0.5, 0→1.0
      gradient.addColorStop(Math.min(pos, 1), `#${s.color.getHexString()}`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }

  // Legacy 2-color update (fallback)
  update(topColor: THREE.Color, bottomColor: THREE.Color): void {
    const { ctx, canvas } = this;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `#${topColor.getHexString()}`);
    gradient.addColorStop(0.5, `#${bottomColor.getHexString()}`);
    gradient.addColorStop(1, `#${topColor.getHexString()}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }
}
