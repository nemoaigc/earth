import * as THREE from 'three';

interface FlareElement {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  offset: number;   // position along sun-to-center line (0=sun, 1=center, >1=beyond)
  baseScale: number;
}

export class LensFlare {
  group: THREE.Group;
  private elements: FlareElement[] = [];
  private tempVec = new THREE.Vector3();
  private tempVec2 = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();

    const flareConfigs = [
      // Main glow
      { color: new THREE.Color(1.0, 0.95, 0.8), offset: 0.0, scale: 2.0, type: 'soft' as const },
      // Smaller circles at varying distances
      { color: new THREE.Color(1.0, 0.6, 0.2), offset: 0.3, scale: 0.5, type: 'soft' as const },
      { color: new THREE.Color(0.2, 0.8, 1.0), offset: 0.55, scale: 0.35, type: 'soft' as const },
      { color: new THREE.Color(1.0, 0.8, 0.4), offset: 0.75, scale: 0.25, type: 'soft' as const },
      // Rings
      { color: new THREE.Color(0.5, 0.7, 1.0), offset: 0.45, scale: 0.6, type: 'ring' as const },
      { color: new THREE.Color(1.0, 0.5, 0.3), offset: 0.9, scale: 0.8, type: 'ring' as const },
      // Hex-ish shape (soft circle with slight variation)
      { color: new THREE.Color(0.8, 0.9, 1.0), offset: 1.2, scale: 0.3, type: 'soft' as const },
    ];

    for (const config of flareConfigs) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const cx = 64;
      const cy = 64;

      if (config.type === 'soft') {
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
        gradient.addColorStop(0, `rgba(${Math.round(config.color.r * 255)}, ${Math.round(config.color.g * 255)}, ${Math.round(config.color.b * 255)}, 1.0)`);
        gradient.addColorStop(1, `rgba(${Math.round(config.color.r * 255)}, ${Math.round(config.color.g * 255)}, ${Math.round(config.color.b * 255)}, 0.0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
      } else {
        // Ring
        ctx.strokeStyle = `rgba(${Math.round(config.color.r * 255)}, ${Math.round(config.color.g * 255)}, ${Math.round(config.color.b * 255)}, 0.8)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 44, 0, Math.PI * 2);
        ctx.stroke();
        // Add glow
        ctx.strokeStyle = `rgba(${Math.round(config.color.r * 255)}, ${Math.round(config.color.g * 255)}, ${Math.round(config.color.b * 255)}, 0.2)`;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(cx, cy, 44, 0, Math.PI * 2);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(canvas);

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      });

      const sprite = new THREE.Sprite(material);
      sprite.scale.set(config.scale, config.scale, 1);

      this.group.add(sprite);
      this.elements.push({
        sprite,
        material,
        texture,
        offset: config.offset,
        baseScale: config.scale,
      });
    }
  }

  update(camera: THREE.PerspectiveCamera, sunPosition: THREE.Vector3, visibility: number): void {
    // Check if sun is behind the globe (dot product of camera-to-sun vs camera-to-origin)
    this.tempVec.copy(sunPosition).sub(camera.position).normalize();
    this.tempVec2.copy(new THREE.Vector3(0, 0, 0)).sub(camera.position).normalize();

    const sunDist = camera.position.distanceTo(sunPosition);
    const sunBehindGlobe = this.tempVec.dot(this.tempVec2) > 0.95 && sunDist > camera.position.length();

    if (sunBehindGlobe || visibility <= 0) {
      for (const el of this.elements) {
        el.material.opacity = 0;
      }
      return;
    }

    // Project sun position to screen space (NDC)
    this.tempVec.copy(sunPosition).project(camera);
    const sunScreenX = this.tempVec.x;
    const sunScreenY = this.tempVec.y;

    // If sun is behind camera (z > 1), hide flare
    if (this.tempVec.z > 1) {
      for (const el of this.elements) {
        el.material.opacity = 0;
      }
      return;
    }

    // Flare line goes from sun screen position through center (0,0)
    // Elements placed at: sunPos + offset * (center - sunPos)
    for (const el of this.elements) {
      // Position in NDC
      const flareX = sunScreenX + el.offset * (0 - sunScreenX);
      const flareY = sunScreenY + el.offset * (0 - sunScreenY);

      // Convert back to world space at a fixed distance in front of camera
      const distance = 10;
      this.tempVec.set(flareX, flareY, 0.5).unproject(camera);
      this.tempVec.sub(camera.position).normalize().multiplyScalar(distance);
      el.sprite.position.copy(camera.position).add(this.tempVec);

      // Fade when near screen edges
      const screenDist = Math.sqrt(sunScreenX * sunScreenX + sunScreenY * sunScreenY);
      const edgeFade = Math.max(0, 1 - screenDist * 0.5);

      el.material.opacity = visibility * edgeFade * 0.7;
      el.sprite.scale.setScalar(el.baseScale * (0.5 + visibility * 0.5));
    }
  }
}
