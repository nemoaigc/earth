import * as THREE from 'three';
import { sampleNoise, noise3D } from '../utils/noise';
import { createWorldMask, type BiomeWeights } from './worldmap';

export const GLOBE_RADIUS = 5;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  landPoints: { position: THREE.Vector3; normal: THREE.Vector3; height: number; biome: string }[];
  coastPoints: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  oceanRatio: number;
}

const LAND_HEIGHT_SCALE = 1.0;

// Vibrant colors matching reference screenshots
const BIOME_COLORS: Record<string, { low: THREE.Color; mid: THREE.Color; high: THREE.Color; snow: THREE.Color }> = {
  tropical: {
    low: new THREE.Color('#86D468'),  // bright grass green
    mid: new THREE.Color('#55A645'),  // forest green
    high: new THREE.Color('#6B8B3A'), // olive (not brown — kept subtle)
    snow: new THREE.Color('#F5F5F5'), // near-white peak
  },
  temperate: {
    low: new THREE.Color('#7ACC55'),  // vivid green
    mid: new THREE.Color('#55A645'),  // forest
    high: new THREE.Color('#8B9944'), // yellow-green olive (original)
    snow: new THREE.Color('#F8F8F8'), // snow peak
  },
  boreal: {
    low: new THREE.Color('#3A8833'),  // dark green
    mid: new THREE.Color('#2A6622'),  // deep forest
    high: new THREE.Color('#556644'), // grey-green
    snow: new THREE.Color('#FFFFFF'), // pure snow
  },
  desert: {
    low: new THREE.Color('#DDCC88'),  // sand
    mid: new THREE.Color('#CCBB77'),  // darker sand
    high: new THREE.Color('#AA9955'), // brown
    snow: new THREE.Color('#E8DDC8'), // pale dune crest
  },
  polar: {
    low: new THREE.Color('#DDEEFF'),  // ice blue
    mid: new THREE.Color('#CCDDEE'),  // lighter
    high: new THREE.Color('#BBCCDD'), // grey-blue
    snow: new THREE.Color('#FFFFFF'), // white
  },
};

// Secondary noise: darker vegetation patches
const PATCH_COLORS = [
  new THREE.Color('#3A7A2A'), // dark green patch
  new THREE.Color('#7A8844'), // olive patch
  new THREE.Color('#998855'), // brown-green patch
];

// Ocean colors
const COLOR_OCEAN_DEEP = new THREE.Color('#22aadd');
const COLOR_OCEAN_SHALLOW = new THREE.Color('#55ccee');

export function generateTerrain(): TerrainData {
  // 320 segments → ~0.56°/vertex (~62 km), noticeably smoother coastlines
  // without going to 400+ which doubles generation time.
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 480, 480);
  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr.count;

  const colors = new Float32Array(vertexCount * 3);
  const landPoints: TerrainData['landPoints'] = [];
  const coastPoints: TerrainData['coastPoints'] = [];
  let oceanCount = 0;

  const mask = createWorldMask();
  const color = new THREE.Color();
  const tmpC = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // Convert to lat/lng
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const lng = Math.atan2(nz, nx) * 180 / Math.PI;

    // Continuous landness. Small 0.4° blur kernel — cardinal samples land
    // INSIDE the adjacent bitmap pixel (px = 0.5°), so it smooths the
    // bilinear stair pattern without bridging the ~1° Taiwan Strait.
    const landness = mask.sampleLandBlur(lat, lng, 0.55);
    const biome = mask.getBiome(lat, lng);
    const smoothstepFn = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    if (landness >= 0.5) {
      // Check distance to coast: sample nearby points for ocean
      let coastDist = 1.0; // 1.0 = far from coast
      for (let step = 1; step <= 7; step++) {
        const d = step * 2.1;
        const nearOcean =
          !mask.isLand(lat + d, lng) || !mask.isLand(lat - d, lng) ||
          !mask.isLand(lat, lng + d) || !mask.isLand(lat, lng - d) ||
          !mask.isLand(lat + d, lng + d) || !mask.isLand(lat - d, lng - d);
        if (nearOcean) {
          coastDist = step / 7;
          break;
        }
      }
      // Smooth ramp: height scales with distance from coast
      const coastFactor = coastDist; // linear ramp — visible mountains inland

      // Low-freq rolling hills. Two key choices for smoothness:
      // (1) We map noise from [-1,1] to [0,1] with (n+1)*0.5 — NOT
      //     Math.abs(n). Math.abs has a V-shaped fold at n=0, so any
      //     vertex straddling that boundary becomes a local minimum
      //     while its neighbours can be high — exactly the "spike /
      //     column" artefact we saw. Linear remap removes the fold.
      // (2) Keep scale at 0.20 (original) so plains still have visible
      //     rolling elevation — just smoother because the abs-fold is
      //     gone, not because the field is artificially flattened.
      const hills = sampleNoise(nx, ny, nz, 2, 1.8, 0.5, 0.20);
      // Texture scale lowered 0.50 -> 0.30: high-freq detail varies more
      // slowly across the sphere, so adjacent vertices have very close
      // height — kills the "blocky" feel where neighbouring triangles
      // have visibly different elevation.
      const texture = sampleNoise(nx, ny, nz, 2, 2.0, 0.4, 0.30);
      const hillsN = (hills + 1) * 0.5;
      const textN  = (texture + 1) * 0.5;
      const noise = hillsN * 0.85 + textN * 0.08 + 0.07;
      const centralBoost = 1.0 + coastDist * 0.30;

      // Ridge noise — sharp peaks/valleys that break the smooth gaussian
      // regionBoost into a more "mountain range" look. Only applied where
      // mountainBlendFactor > 0 (real mountain regions).
      const ridgeRaw = sampleNoise(nx, ny, nz, 2, 4.0, 0.5, 0.35);
      const ridge = 1.0 - Math.abs(ridgeRaw); // [0..1], 1 = peak ridge

      // Regional mountain boost
      // lng from atan2 is raw (positive=east), negate to match our polygon system
      // Actually: lng = atan2(nz,nx), for real-world east=positive this gives positive values
      // But our polygons are negated. So lng itself IS the negated value.
      // Use lng directly (which is already in our negated coord system)
      // 2D gaussian falloff helper: center (clat, clng), half-extents (dlat, dlng).
      // Outside the falloff radius returns 0 so we can skip the if-box entirely.
      const peak2d = (clat: number, dlat: number, clng: number, dlng: number) => {
        const fl = 1 - Math.abs(lat - clat) / dlat;
        const fn = 1 - Math.abs(lng - clng) / dlng;
        if (fl <= 0 || fn <= 0) return 0;
        return fl * fn;
      };
      // 1D ridge helper for long N-S or E-W ranges
      const ridge1dLng = (clng: number, dlng: number, latMin: number, latMax: number) => {
        if (lat < latMin || lat > latMax) return 0;
        return Math.max(0, 1 - Math.abs(lng - clng) / dlng);
      };
      // lng note: real east → negative in our system, real west → positive.
      let regionBoost = 1.0;
      const bump = (peakBoost: number, factor: number) => {
        if (factor <= 0) return;
        regionBoost = Math.max(regionBoost, 1.0 + peakBoost * factor);
      };

      // === Asia ===
      // Himalayas / Tibet Plateau
      bump(1.8, peak2d(33, 8, -85, 16));
      // Japanese Alps (central Honshu)
      bump(0.45, peak2d(36, 2, -138, 2));
      // Urals (north-south ridge)
      bump(0.25, ridge1dLng(-60, 4, 50, 67));

      // === Americas ===
      // Andes — narrow N-S ridge along the Pacific coast (Chile/Peru).
      // Width tightened from 9° to 4° so the chain reads as a coastal
      // wall rather than a slab covering half the continent.
      bump(1.5, ridge1dLng(70, 4, -55, 10));
      // Rockies — slightly wider N-S ridge.
      bump(1.1, ridge1dLng(112, 5, 35, 60));
      // Appalachians (E North America)
      bump(0.55, ridge1dLng(78, 6, 33, 45));
      // Sierra Madre Occidental (W Mexico)
      bump(0.35, peak2d(27, 5, 105, 3));
      // Brazilian Highlands (E Brazil) — low elevated plateau
      bump(0.20, peak2d(-15, 7, 47, 7));

      // === Europe ===
      // Alps
      bump(0.65, peak2d(46, 3, -10, 6));
      // Scandinavian mountains (N-S ridge)
      bump(0.30, ridge1dLng(-8, 4, 57, 71));
      // Caucasus
      bump(0.30, peak2d(42.5, 2, -44, 4));
      // Pyrenees
      bump(0.50, peak2d(43, 1.5, -0.5, 3));
      // Apennines (Italy)
      bump(0.30, peak2d(43, 4, -13, 3));
      // Carpathians (Romania/Ukraine)
      bump(0.35, peak2d(47, 3, -22, 4));

      // === Africa ===
      // Atlas Mountains (NW Africa)
      bump(0.45, peak2d(33, 4, -1, 12));
      // Ethiopian Highlands
      bump(0.50, peak2d(10, 5, -38, 4));
      // Drakensberg (SE Africa)
      bump(0.35, peak2d(-30, 3, -29, 3));

      // === Oceania & polar ===
      // Great Dividing Range (E Australia)
      bump(0.30, ridge1dLng(-148, 3, -38, -28));
      // New Zealand Southern Alps
      bump(0.55, peak2d(-43, 2, -170, 3));
      // Greenland ice cap (high plateau)
      bump(0.55, peak2d(72, 8, 37, 12));

      const mountainBlendFactor = Math.max(0, (regionBoost - 1.0) / 1.5);
      // regionBoost still fades to coast but less aggressively, so seaside
      // ranges (Andes) actually rise out of the water.
      const effectiveRegionBoost = 1.0 + (regionBoost - 1.0) * Math.pow(coastDist, 0.3);
      // Coast softness: ramp height from 0 across a wide [0.45, 0.90] band.
      const coastSoftness = smoothstepFn(0.50, 0.95, landness);
      // Mountain regions: modulate by ridge noise so the smooth gaussian
      // dome becomes a series of peaks/saddles. Outside mountains: factor=1.
      const ridgeFactor = 1.0 + mountainBlendFactor * (ridge - 0.5) * 0.4;
      const heightNorm = Math.min(
        noise * coastFactor * coastSoftness * centralBoost * effectiveRegionBoost * ridgeFactor,
        1.35,
      );
      const height = heightNorm * LAND_HEIGHT_SCALE;
      const newRadius = GLOBE_RADIUS + height;

      posAttr.setXYZ(i, nx * newRadius, ny * newRadius, nz * newRadius);

      // ── Colour is driven by actual height, not by region presence ──
      // Previously colorNorm was forced to 1.0 wherever a mountain bump
      // existed at all (mountainBlendFactor → 1 across the whole bump),
      // so every face inside Andes/Rockies hit the snow band even at
      // mid-elevation. Driving it from heightNorm lets ridge-high faces
      // be snow while ridge-low faces inside the same range stay
      // biome-coloured or rocky brown — the "snow on peaks, green on
      // slopes" look from the reference Himalaya art.
      const microVar = noise3D(nx * 1.9, ny * 1.9, nz * 1.9) * 0.03;
      const colorNorm = Math.min(1.0, heightNorm * 0.95 + microVar);

      // Smooth-step color bands — avoids the hard threshold "steps" that
      // create visible colour blocks on the terrain surface.
      const smoothstep = (e0: number, e1: number, x: number) => {
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      };

      const weights = mask.getBiomeWeights(lat, lng);
      color.setRGB(0, 0, 0);
      // Rocky-brown intermediate stage between olive high-elevation and snow.
      // Only applied within real mountain regions so plains don't get brown.
      const ROCKY = tmpC; // reuse holder
      for (const [biomeName, weight] of Object.entries(weights) as [keyof BiomeWeights, number][]) {
        if (weight < 0.01) continue;
        const palette = BIOME_COLORS[biomeName];
        if (!palette) continue;
        // Continuous quad-lerp: low → mid → high(olive) → rocky → snow.
        const t01 = smoothstep(0.0, 0.35, colorNorm);
        const t12 = smoothstep(0.32, 0.62, colorNorm);
        // Rocky band only inside mountain regions (mountainBlendFactor > 0)
        const rockyT = smoothstep(0.55, 0.78, colorNorm) * mountainBlendFactor;
        const t23 = smoothstep(0.78, 0.95, colorNorm);
        ROCKY.setRGB(0.42, 0.36, 0.30); // dark rocky brown
        tmpC.copy(palette.low)
          .lerp(palette.mid,  t01)
          .lerp(palette.high, t12);
        // Blend toward rocky brown inside mountains
        tmpC.r = tmpC.r * (1 - rockyT) + 0.42 * rockyT;
        tmpC.g = tmpC.g * (1 - rockyT) + 0.36 * rockyT;
        tmpC.b = tmpC.b * (1 - rockyT) + 0.30 * rockyT;
        // Snow cap on top
        tmpC.r = tmpC.r * (1 - t23) + palette.snow.r * t23;
        tmpC.g = tmpC.g * (1 - t23) + palette.snow.g * t23;
        tmpC.b = tmpC.b * (1 - t23) + palette.snow.b * t23;
        color.r += tmpC.r * weight;
        color.g += tmpC.g * weight;
        color.b += tmpC.b * weight;
      }
      // Soft coast colour: blend toward shallow-ocean across [0.50, 0.72].
      // Wider window erases the hard green/blue coast line.
      const oceanBlend = 1 - smoothstepFn(0.50, 0.88, landness);
      if (oceanBlend > 0) {
        color.r = color.r * (1 - oceanBlend) + COLOR_OCEAN_SHALLOW.r * oceanBlend;
        color.g = color.g * (1 - oceanBlend) + COLOR_OCEAN_SHALLOW.g * oceanBlend;
        color.b = color.b * (1 - oceanBlend) + COLOR_OCEAN_SHALLOW.b * oceanBlend;
      }


      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Collect land points at the exact vertex position. We deliberately
      // don't jitter the XZ here — jittering moved the point off the
      // actual triangle face plane, which caused features to float or get
      // buried. Visual variation comes from per-instance rotation/scale
      // in the feature classes instead.
      // landness >= 0.72: vertex is fully land-coloured (oceanBlend == 0).
      // Below that, the vertex is still in the land branch but is being
      // tinted toward shallow ocean — placing trees there reads as
      // "trees in the sea". Skip them.
      const sampleChance = (Math.sin(i * 7.13) * 0.5 + 0.5) > 0.85;
      if ((i % 12 === 0 || sampleChance) && landness >= 0.88) {
        landPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
          height: heightNorm,
          biome,
        });
      }

      // Coast points
      if (heightNorm < 0.1) {
        coastPoints.push({
          position: new THREE.Vector3(nx * newRadius, ny * newRadius, nz * newRadius),
          normal: new THREE.Vector3(nx, ny, nz),
        });
      }
    } else {
      // Inland water bodies (Caspian, Aral, lakes): land in all 4 directions → treat as land
      const isInland =
        mask.isLand(lat + 15, lng) && mask.isLand(lat - 15, lng) &&
        mask.isLand(lat, lng + 15) && mask.isLand(lat, lng - 15);

      if (isInland) {
        // Push above ocean mesh so sparkle doesn't bleed through; color as neutral terrain
        posAttr.setXYZ(i, nx * (GLOBE_RADIUS + 0.002), ny * (GLOBE_RADIUS + 0.002), nz * (GLOBE_RADIUS + 0.002));
        color.set('#7ab8cc'); // muted inland water — no animated sparkle
      } else {
        // True ocean — lift toward globe surface as landness approaches 0.5
        // so the coast doesn't have a hard 0.008-unit cliff against land.
        const oceanLift = smoothstepFn(0.20, 0.50, landness); // 0=deep, 1=at surface
        const depth = (1 - oceanLift) * 0.008;
        const r = GLOBE_RADIUS - depth;
        posAttr.setXYZ(i, nx * r, ny * r, nz * r);

        // Shallow→deep gradient driven by landness instead of binary nearLand
        // check — gives a soft turquoise halo around every coast.
        const shallowMix = smoothstepFn(0.05, 0.45, landness);
        color.copy(COLOR_OCEAN_DEEP).lerp(COLOR_OCEAN_SHALLOW, shallowMix);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      oceanCount++;
    }
  }


  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return {
    geometry,
    landPoints,
    coastPoints,
    oceanRatio: oceanCount / vertexCount,
  };
}

// Shallow water transition ring — only near coastlines
export function createShallowWaterMesh(): THREE.Mesh {
  const mask = createWorldMask();
  const geo = new THREE.IcosahedronGeometry(GLOBE_RADIUS - 0.001, 80);
  const posAttr = geo.getAttribute('position');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len, ny = y / len, nz = z / len;
    const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const lng = Math.atan2(nz, nx) * 180 / Math.PI;

    const onLand = mask.isLand(lat, lng);
    // Check if near coast (within 5°)
    const nearLand = !onLand && (
      mask.isLand(lat + 1, lng) || mask.isLand(lat - 1, lng) ||
      mask.isLand(lat, lng + 1) || mask.isLand(lat, lng - 1)
    );

    if (nearLand) {
      // Shallow turquoise water
      colors[i * 3] = 0.25; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.65;
    } else if (onLand) {
      // On land — fully transparent (land terrain shows through)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
    } else {
      // Deep ocean — fully transparent (ocean mesh below handles this)
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    shininess: 20,
    flatShading: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
