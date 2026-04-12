import * as THREE from 'three';

export class SkyDome {
  mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);

    const geometry = new THREE.SphereGeometry(50, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.BackSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Paint default colors
    const defaultTop = new THREE.Color('#1a3a6a');
    const defaultBottom = new THREE.Color('#4a7aaa');
    this.update(defaultTop, defaultBottom);
  }

  update(topColor: THREE.Color, bottomColor: THREE.Color): void {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = canvas.width / 2;

    const gradient = ctx.createRadialGradient(cx, 0, 0, cx, cy, radius);
    gradient.addColorStop(0, `#${topColor.getHexString()}`);
    gradient.addColorStop(1, `#${bottomColor.getHexString()}`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.texture.needsUpdate = true;
  }
}
