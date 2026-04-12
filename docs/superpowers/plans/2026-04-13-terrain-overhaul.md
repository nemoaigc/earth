# Terrain Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform flat "sticker" globe into a dramatic 3D world with real continent shapes, natural vegetation, water elements, and continent labels.

**Architecture:** 7 tasks executed sequentially. Each task produces a working, committable state. Globe radius increases from 5→7, terrain height from 0.5→0.8, continents refined to 80-150 points each. Civilization features removed, replaced with natural elements.

**Tech Stack:** Three.js, TypeScript, Vite, CSS2DRenderer (labels)

---

### Task 1: Globe parameters + terrain height + remove civilization

**Files:**
- Modify: `src/globe/terrain.ts`
- Modify: `src/globe/Ocean.ts`
- Modify: `src/globe/Atmosphere.ts`
- Modify: `src/systems/Camera.ts`
- Modify: `src/main.ts`
- Delete references to: Villages, Windmills, Lighthouses

- [ ] **Step 1: Update GLOBE_RADIUS and height**

In `src/globe/terrain.ts`:
- `GLOBE_RADIUS`: 5 → 7
- `LAND_HEIGHT_SCALE`: 0.5 → 0.8
- Subdivision: 120 → 140
- Noise params: change to `sampleNoise(nx, ny, nz, 6, 2.0, 0.55, 0.8)`
- Coast ramp: expand to 7 steps at ~2.1° each (15° total range)
- Add `centralBoost = 1.0 + coastDist * 0.5`
- Height formula: `height = noise * coastFactor * centralBoost * LAND_HEIGHT_SCALE`

- [ ] **Step 2: Sync Ocean and Atmosphere radius**

In `src/globe/Ocean.ts`: geometry radius = `GLOBE_RADIUS - 0.005` (already uses import, just verify)
In `src/globe/Atmosphere.ts`: geometry radius = `GLOBE_RADIUS * 1.15` (already uses import)

- [ ] **Step 3: Update Camera distances**

In `src/systems/Camera.ts`:
- `minDistance`: 7 → 10
- `maxDistance`: 25 → 35
- Initial position: `(16, 4, 0)` (further out for bigger globe)

- [ ] **Step 4: Remove civilization from main.ts**

Remove imports and instances of: Villages, Windmills, Lighthouses.
Remove their `update()` calls.
Keep: Trees, PalmTrees, Rocks, Mountains, Balloons.

- [ ] **Step 5: Build and verify**

Run `npx tsc --noEmit` — should pass.
Open browser — globe should be bigger with more dramatic terrain.

- [ ] **Step 6: Commit**

```
git add -A && git commit -m "Bigger globe (r=7), dramatic terrain height, remove civilization"
```

---

### Task 2: Continent outlines refinement

**Files:**
- Modify: `src/globe/worldmap.ts`

- [ ] **Step 1: Rewrite all continent polygons**

Replace every continent array with 80-150 point versions. Key landmarks to capture:
- Africa: horn, gulf of guinea concavity, cape, madagascar
- Europe: iberia, italy boot, scandinavia, baltics
- Asia: arabian peninsula, india triangle, southeast asia, china coast (bohai, shandong, taiwan strait), korea, kamchatka
- North America: alaska, florida, gulf of mexico, great lakes region outline
- South America: brazil bulge, patagonia point
- Australia: great australian bight, cape york

- [ ] **Step 2: Add missing islands**

Add new polygon arrays: NEW_ZEALAND_N, NEW_ZEALAND_S, MADAGASCAR, SRI_LANKA, SUMATRA, BORNEO, JAVA, SULAWESI, PHILIPPINES, TAIWAN, HAINAN. Add all to CONTINENTS array.

- [ ] **Step 3: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Refined continent outlines 80-150pts each + island polygons"
```

---

### Task 3: Tree species expansion (acacia + cactus)

**Files:**
- Modify: `src/features/Trees.ts`

- [ ] **Step 1: Add acacia tree geometry**

Create `buildAcaciaGeometry()`: thin brown cylinder trunk (height 0.3, radius 0.01) + flat disc canopy on top (CylinderGeometry radius 0.12, height 0.02). Merge with vertex colors: trunk #8B6914, canopy #557733.

- [ ] **Step 2: Add cactus geometry**

Create `buildCactusGeometry()`: green cylinder trunk (height 0.15, radius 0.025) + two small cylinder arms branching at 45° from the middle. Color #558833.

- [ ] **Step 3: Place acacias in desert biome (lat 0-20, Africa/Australia)**

~60 acacias. Filter `landPoints` where biome === 'desert' or (biome === 'tropical' && height < 0.2). Use InstancedMesh.

- [ ] **Step 4: Place cacti in desert biome**

~40 cacti. Filter biome === 'desert'. Replace the current 30 tiny desert trees.

- [ ] **Step 5: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Add acacia and cactus tree types for desert/savanna"
```

---

### Task 4: Flowers + Grass

**Files:**
- Create: `src/features/Flowers.ts`
- Create: `src/features/Grass.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create Flowers.ts**

~300 flower clusters on temperate/tropical land (height < 0.3).
Geometry: merge CylinderGeometry(0.003, 0.003, 0.04) stem + SphereGeometry(0.012) head.
4 color groups (InstancedMesh per group): red #cc3344, yellow #eecc33, white #eeeeff, purple #8844aa.
Wind sway shader (onBeforeCompile) with larger amplitude than trees: `swayAmount = transformed.y * 0.04`.

- [ ] **Step 2: Create Grass.ts**

~500 grass tufts on all non-desert/non-polar land.
Geometry: 5 thin triangular blades (PlaneGeometry(0.01, 0.06) each) rotated around Y at different angles, merged.
Color from biome: tropical #228833, temperate #44aa33, boreal #336644.
Wind sway shader.

- [ ] **Step 3: Add to main.ts**

Import Flowers and Grass. Instantiate with `globe.terrainData`. Add to scene. Add `update(elapsed)` calls.

- [ ] **Step 4: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Add flower clusters and grass tufts"
```

---

### Task 5: Water elements (icebergs + reefs)

**Files:**
- Create: `src/features/Icebergs.ts`
- Create: `src/features/Reefs.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create Icebergs.ts**

8-12 icebergs in polar seas (|lat| > 55, ocean areas).
Geometry: DodecahedronGeometry(0.15, 0) with vertex perturbation. Colors: white #eeffff, light blue #ccddff.
Position on ocean surface (GLOBE_RADIUS + 0.02), oriented outward.
Slow drift: rotate around globe axis at 0.001 rad/s.
InstancedMesh.

- [ ] **Step 2: Create Reefs.ts**

15-20 small reef islands in tropical seas (|lat| < 25, ocean areas).
Geometry: SphereGeometry(0.04, 6, 4) flattened (scale Y 0.3). Colors: sand #ddcc88, green #77aa55.
Position at ocean surface (GLOBE_RADIUS + 0.01).
Static (no animation).

- [ ] **Step 3: Add to main.ts**

Import and instantiate Icebergs and Reefs. They need worldmap's `isLand()` to find ocean positions — pass `terrainData` or the mask.

- [ ] **Step 4: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Add icebergs in polar seas and reef islands in tropics"
```

---

### Task 6: Terrain shader (wind sway + altitude gradient)

**Files:**
- Modify: `src/globe/terrain.ts`
- Modify: `src/globe/Globe.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add terrain shader in terrain.ts or Globe.ts**

In Globe constructor, add `onBeforeCompile` to terrainMaterial:
- Add uniform `uTime`
- Vertex shader: for grassland vertices (low height), add subtle wave displacement
- Fragment shader: smooth altitude color blending using `length(vWorldPos)` distance from origin

- [ ] **Step 2: Update main.ts to pass time to Globe**

Add `globe.terrainMaterial.userData.uTime = { value: elapsed }` each frame, or expose a `setTime()` method on Globe.

- [ ] **Step 3: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Terrain shader: wind sway on grassland + smooth altitude colors"
```

---

### Task 7: Continent/Ocean labels (CSS2D)

**Files:**
- Create: `src/features/Labels.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Install CSS2DRenderer**

Already available in three/examples — just import:
```ts
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
```

- [ ] **Step 2: Create Labels.ts**

Define label data: `{ name: string, lat: number, lng: number }[]` for:
- Continents: Africa (10,20), Europe (50,15), Asia (45,90), North America (45,-100), South America (-15,-60), Australia (-25,135), Antarctica (-85,0)
- Oceans: Pacific (0,-160), Atlantic (0,-30), Indian (-20,75)

For each label:
- Convert lat/lng to 3D position on sphere (GLOBE_RADIUS + 0.3)
- Create DOM element (white text, text-shadow, pointer-events:none)
- Wrap in CSS2DObject, add to group

Export `update(camera)` method:
- For each label, compute `dot(labelNormal, toCameraDir)`
- If dot > 0.1: show (opacity 1). If dot < -0.1: hide (opacity 0). Between: fade.

- [ ] **Step 3: Add CSS2DRenderer to main.ts**

Create CSS2DRenderer, size same as WebGLRenderer, append to #app, position absolute on top.
In animate loop: call `labelRenderer.render(scene, camera)` after main render.
Call `labels.update(cameraController.camera)` each frame.

- [ ] **Step 4: Verify and commit**

```
npx tsc --noEmit
git add -A && git commit -m "Add continent/ocean labels with face-culling"
```

---

### Final: Push all

- [ ] `git push`
