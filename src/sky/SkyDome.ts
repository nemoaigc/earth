import * as THREE from 'three';

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

    const defaultTop = new THREE.Color('#2266cc');
    const defaultBottom = new THREE.Color('#88bbee');
    this.update(defaultTop, defaultBottom);
  }

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
