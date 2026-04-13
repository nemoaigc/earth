# Tree Visual Upgrade Design

## Problem

当前树木使用简单的泪滴形/锥形几何体，没有树干，尺寸过小（0.25-0.5，相对 GLOBE_RADIUS=7），在默认相机距离下几乎无法辨认。

## Goal

让树木在默认视距下一眼能认出是树，保持 Low-Poly 风格，纯程序化生成，不引入外部模型。

## Approach

方案 B：分层树冠 + 树干，每种生态区有特征性剪影，同时放大尺寸约 2x。

## Design

### 1. 几何体结构

所有树统一结构：**棕色树干（CylinderGeometry）+ 特征树冠**，用 `mergeGeometries` 合并。

#### 热带树 (Tropical)
- 树干：CylinderGeometry，底粗顶细，高度约总高 35-40%
- 树冠：2-3 个 DodecahedronGeometry（subdivision 1），从下到上尺寸递减，略微重叠堆叠
- 剪影：矮胖、圆润的阔叶树

#### 温带树 (Temperate)
- 树干：同上
- 树冠：IcosahedronGeometry（subdivision 1），Y 轴拉伸为椭球形
- 剪影：经典"棒棒糖"形树

#### 寒带树 (Boreal)
- 树干：更细长，高度约总高 25-30%
- 树冠：3 层 ConeGeometry，上小下大，层间留间隔
- 剪影：尖塔形云杉/圣诞树

#### 沙漠
- Acacia：保持现有（已有树干+扁平树冠）
- 仙人掌：保持现有

### 2. 尺寸参数

| 树种 | 当前高度 | 新高度 | 当前宽度 | 新宽度 |
|------|---------|--------|---------|--------|
| 热带 | 0.3-0.5 | 0.6-1.0 | 0.08-0.12 | 0.16-0.24 |
| 温带 | 0.25-0.4 | 0.5-0.8 | 0.06-0.09 | 0.12-0.18 |
| 寒带 | 0.3-0.45 | 0.6-0.9 | 0.04-0.06 | 0.08-0.12 |

### 3. 颜色与材质

- 树干：底部深棕 `#5C3D1A` → 顶部浅棕 `#8B6914`，顶点色渐变
- 树冠：沿用现有 BIOME_CONFIGS 颜色，底部深 → 顶部亮，渐变幅度 20-30%
- 材质：MeshPhongMaterial + vertexColors + flatShading（不变）
- Shader：沿用现有 `createWindSwayMaterial`（不变）

### 4. 代码改动

**仅修改 `src/features/Trees.ts`**：

1. 新增 3 个几何体函数：
   - `createTropicalTreeGeometry(height, width)`
   - `createTemperateTreeGeometry(height, width)`
   - `createBorealTreeGeometry(height, width)`
2. 修改 BIOME_CONFIGS 的 `geoType`：tropical/temperate/boreal
3. 更新 heightRange 和 widthRange
4. 删除 `createTeardropGeometry` 和 `createConeTreeGeometry`
5. 保留：`createAcaciaGeometry`、`createCactusGeometry`、`createWindSwayMaterial`、`placeTrees`、`Trees` class

### 5. 性能

- 每棵树面数：约 60 → 90-120 面
- InstancedMesh 机制不变，draw call 数不变
- 总增加面数约 60K，对现代 GPU 无压力
