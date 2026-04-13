import * as THREE from 'three';
import { GLOBE_RADIUS } from '../globe/terrain';
import type { TerrainData } from '../globe/terrain';
import { createWorldMask } from '../globe/worldmap';

type AnimalCategory = 'extinct' | 'endangered';

interface AnimalDef {
  name: string;
  file: string;
  biome: string; // 'tropical' | 'temperate' | 'boreal' | 'desert' | 'polar' | 'ocean'
  category: AnimalCategory;
  count: number;
  scale: number;
}

const ANIMAL_DEFS: AnimalDef[] = [
  // === EXTINCT / PREHISTORIC ===
  { name: 'T-Rex',           file: 'trex',           biome: 'tropical',  category: 'extinct', count: 2, scale: 0.35 },
  { name: 'Triceratops',     file: 'triceratops',    biome: 'temperate', category: 'extinct', count: 2, scale: 0.30 },
  { name: 'Pteranodon',      file: 'pteranodon',      biome: 'tropical',  category: 'extinct', count: 2, scale: 0.30 },
  { name: 'Brachiosaurus',   file: 'brachiosaurus',   biome: 'tropical',  category: 'extinct', count: 1, scale: 0.45 },
  { name: 'Stegosaurus',     file: 'stegosaurus',     biome: 'temperate', category: 'extinct', count: 2, scale: 0.30 },
  { name: 'Mammoth',         file: 'mammoth',         biome: 'boreal',    category: 'extinct', count: 2, scale: 0.35 },
  { name: 'Saber-tooth',     file: 'sabertooth',      biome: 'temperate', category: 'extinct', count: 2, scale: 0.28 },
  { name: 'Dodo',            file: 'dodo',            biome: 'tropical',  category: 'extinct', count: 2, scale: 0.20 },
  { name: 'Velociraptor',    file: 'velociraptor',    biome: 'desert',    category: 'extinct', count: 2, scale: 0.22 },
  { name: 'Spinosaurus',     file: 'spinosaurus',     biome: 'tropical',  category: 'extinct', count: 1, scale: 0.40 },
  { name: 'Megalodon',       file: 'megalodon',       biome: 'ocean',     category: 'extinct', count: 2, scale: 0.40 },
  { name: 'Plesiosaur',      file: 'plesiosaur',      biome: 'ocean',     category: 'extinct', count: 2, scale: 0.30 },
  { name: 'Woolly Rhino',    file: 'woollyrhino',     biome: 'boreal',    category: 'extinct', count: 2, scale: 0.30 },
  { name: 'Ankylosaurus',    file: 'ankylosaurus',    biome: 'temperate', category: 'extinct', count: 2, scale: 0.28 },
  { name: 'Parasaurolophus', file: 'parasaurolophus', biome: 'tropical',  category: 'extinct', count: 2, scale: 0.32 },
  { name: 'Archaeopteryx',   file: 'archaeopteryx',   biome: 'temperate', category: 'extinct', count: 2, scale: 0.18 },
  { name: 'Thylacine',       file: 'thylacine',       biome: 'temperate', category: 'extinct', count: 2, scale: 0.22 },
  { name: 'Ammonite',        file: 'ammonite',        biome: 'ocean',     category: 'extinct', count: 3, scale: 0.18 },
  { name: 'Ground Sloth',    file: 'groundsloth',     biome: 'tropical',  category: 'extinct', count: 1, scale: 0.35 },
  { name: 'Moa',             file: 'moa',             biome: 'temperate', category: 'extinct', count: 2, scale: 0.30 },
  // === ENDANGERED ===
  { name: 'Giant Panda',     file: 'panda',           biome: 'boreal',    category: 'endangered', count: 2, scale: 0.28 },
  { name: 'Snow Leopard',    file: 'snowleopard',     biome: 'boreal',    category: 'endangered', count: 2, scale: 0.25 },
  { name: 'Orangutan',       file: 'orangutan',       biome: 'tropical',  category: 'endangered', count: 2, scale: 0.28 },
  { name: 'Mountain Gorilla',file: 'gorilla',         biome: 'tropical',  category: 'endangered', count: 2, scale: 0.32 },
  { name: 'Tiger',           file: 'tiger',           biome: 'tropical',  category: 'endangered', count: 2, scale: 0.28 },
  { name: 'Polar Bear',      file: 'polarbear',       biome: 'polar',     category: 'endangered', count: 2, scale: 0.30 },
  { name: 'Blue Whale',      file: 'bluewhale',       biome: 'ocean',     category: 'endangered', count: 2, scale: 0.50 },
  { name: 'Sea Turtle',      file: 'seaturtle',       biome: 'ocean',     category: 'endangered', count: 3, scale: 0.20 },
  { name: 'Red Panda',       file: 'redpanda',        biome: 'boreal',    category: 'endangered', count: 2, scale: 0.20 },
  { name: 'Rhinoceros',      file: 'rhinoceros',      biome: 'tropical',  category: 'endangered', count: 2, scale: 0.30 },
  { name: 'Pangolin',        file: 'pangolin',        biome: 'tropical',  category: 'endangered', count: 2, scale: 0.20 },
  { name: 'Snowy Owl',       file: 'snowyowl',        biome: 'polar',     category: 'endangered', count: 2, scale: 0.18 },
  { name: 'Crested Ibis',    file: 'crestedibis',     biome: 'temperate', category: 'endangered', count: 2, scale: 0.20 },
  { name: 'Baiji Dolphin',   file: 'baijidolphin',    biome: 'ocean',     category: 'endangered', count: 2, scale: 0.25 },
  { name: 'Amur Leopard',    file: 'amurleopard',     biome: 'boreal',    category: 'endangered', count: 2, scale: 0.25 },
];

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.sin(theta) * radius,
  );
}

function findOceanPositions(count: number, minAbsLat = 0, maxAbsLat = 60): { lat: number; lng: number }[] {
  const mask = createWorldMask();
  const results: { lat: number; lng: number }[] = [];
  let attempts = 0;

  while (results.length < count && attempts < 3000) {
    attempts++;
    const absLat = minAbsLat + Math.random() * (maxAbsLat - minAbsLat);
    const lat = Math.random() < 0.5 ? absLat : -absLat;
    const lng = Math.random() * 360 - 180;
    if (!mask.isLand(lat, lng)) {
      results.push({ lat, lng });
    }
  }

  return results;
}

/**
 * Remove near-white background pixels by modifying alpha channel in a canvas.
 */
function makeTransparent(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Remove near-white and near-black backgrounds
    const brightness = (r + g + b) / 3;
    if (brightness > 235 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
      // White/light grey background
      const fade = Math.max(0, (brightness - 235) / 20);
      data[i + 3] = Math.round(255 * (1 - fade));
    } else if (brightness < 30 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
      // Black/dark background
      const fade = Math.max(0, (30 - brightness) / 30);
      data[i + 3] = Math.round(255 * (1 - fade));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export class Animals {
  group: THREE.Group;
  private sprites: THREE.Sprite[] = [];

  constructor(terrainData: TerrainData) {
    this.group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    for (const def of ANIMAL_DEFS) {
      const positions = this.getPositions(def, terrainData);
      if (positions.length === 0) continue;

      // Load texture and create sprites
      const imgPath = `animals/${def.file}.png`;

      loader.load(imgPath, (rawTexture) => {
        // Process image to make background transparent
        const image = rawTexture.image as HTMLImageElement;
        const canvas = makeTransparent(image);

        const texture = new THREE.CanvasTexture(canvas);
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
          sprite.position.copy(pos.point);

          // Scale the sprite
          const s = def.scale * (0.85 + Math.random() * 0.3);
          sprite.scale.set(s, s, s);

          // Offset sprite up so it sits on the surface
          const normal = pos.point.clone().normalize();
          sprite.position.addScaledVector(normal, def.scale * 0.4);

          this.sprites.push(sprite);
          this.group.add(sprite);
        }
      });
    }
  }

  private getPositions(
    def: AnimalDef,
    terrainData: TerrainData
  ): { point: THREE.Vector3 }[] {
    if (def.biome === 'ocean') {
      const oceanPos = findOceanPositions(def.count);
      return oceanPos.map(({ lat, lng }) => ({
        point: latLngToPosition(lat, lng, GLOBE_RADIUS + 0.02),
      }));
    }

    if (def.biome === 'polar') {
      // Place in polar regions (high latitude land or ocean edge)
      const polarPoints = terrainData.landPoints.filter(
        (p) => p.biome === 'polar'
      );
      if (polarPoints.length === 0) {
        // Fallback to high latitude ocean positions
        const positions = findOceanPositions(def.count, 60, 80);
        return positions.map(({ lat, lng }) => ({
          point: latLngToPosition(lat, lng, GLOBE_RADIUS + 0.03),
        }));
      }
      const shuffled = polarPoints.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, def.count).map((p) => ({
        point: p.position.clone().multiplyScalar(1 + 0.005),
      }));
    }

    // Land biomes
    const biomePoints = terrainData.landPoints.filter(
      (p) => p.biome === def.biome
    );
    if (biomePoints.length === 0) return [];

    const shuffled = biomePoints.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, def.count).map((p) => ({
      point: p.position.clone().multiplyScalar(1 + 0.005),
    }));
  }

  update(_time: number): void {
    // Sprites auto-face camera, no per-frame update needed
  }
}
