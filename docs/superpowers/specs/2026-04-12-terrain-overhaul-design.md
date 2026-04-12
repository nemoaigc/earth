# 地形起伏 + 大陆精细化 + 地表素材重构 + 水上元素

## 目标
1. 地形从"贴纸"变成有明显山丘起伏的立体星球
2. 大陆轮廓接近真实世界地图
3. 地表素材重构为纯自然主题（去掉村庄/风车/灯塔）
4. 地表增加 shader 效果（风吹草地 + 海拔渐变）
5. 水面增加自然元素（冰山、浪花线、小岛礁石）

## 主题定位
**自然/灭绝生物**世界——纯自然景观，无人类文明痕迹。动物后续用 AI 生成素材添加。

## 保留不变
- 海洋 shader（波光粼粼效果）
- 自发光模式 + 昼夜循环
- 生物群落着色系统
- 热气球（作为自然元素保留）
- OrbitControls 鼠标拖动

## 删除
- 村庄（Villages）
- 风车（Windmills）
- 灯塔（Lighthouses）

---

## 一、地形起伏

### 改动
- `LAND_HEIGHT_SCALE`: 0.5 → **0.8**
- 噪声参数：6 octaves, lacunarity 2.0, persistence **0.55**, scale **0.8**
- 海岸检测范围：10° → **15°**（7 步，每步约 2.1°）
- 内陆隆起：`centralBoost = 1.0 + coastDist * 0.5`
- 最终高度：`height = noise * coastFactor * centralBoost * LAND_HEIGHT_SCALE`

### 效果
- 海岸线：缓坡入水
- 内陆 5-10°：丘陵
- 大陆中心：明显山脉/高原

---

## 二、大陆轮廓精细化

### 点数目标
| 大陆 | 当前 | 目标 |
|------|------|------|
| Africa | 45 | 100 |
| Europe | 35 | 90 |
| Asia | 70 | 150 |
| India | 18 | 40 |
| North America | 52 | 100 |
| South America | 42 | 80 |
| Australia | 25 | 50 |

### 新增岛屿
新西兰、马达加斯加、斯里兰卡、印尼主岛、菲律宾、台湾、海南

### 球体参数
- `GLOBE_RADIUS`: 5 → **7**
- 细分：120 → **140**
- 海洋/大气半径同步
- 相机 minDistance 10, maxDistance 35

---

## 三、地表素材重构

### 删除
- `src/features/Villages.ts` — 不再使用
- `src/features/Windmills.ts` — 不再使用
- `src/features/Lighthouses.ts` — 不再使用

### 保留 & 增强
- **树木**（Trees.ts）— 保留，增加种类
- **棕榈树**（PalmTrees.ts）— 保留，海岸热带
- **岩石**（Rocks.ts）— 保留
- **山脉**（Mountains.ts）— 保留
- **气球**（Balloons.ts）— 保留

### 新增地表素材

#### A. 花丛（Flowers.ts）
- ~300 个花丛，放在温带/热带低海拔区域
- 每丛 3-5 朵小花：细圆柱茎 + 球形花头
- 4 种颜色组：红 #cc3344、黄 #eecc33、白 #eeeeff、紫 #8844aa
- InstancedMesh，微风摆动 shader（比树更大幅度）

#### B. 草丛（Grass.ts）
- ~500 个草丛，广泛分布在所有非沙漠/极地陆地
- 每丛：3-7 根细长三角形叶片，从中心向外散开
- 颜色随生物群落变化（热带深绿、温带亮绿、寒带暗绿）
- InstancedMesh，风吹摆动

#### C. 树木种类扩展（更新 Trees.ts）
目前已有热带/温带/寒带/沙漠分区，增加：
- **金合欢/伞形树**（非洲稀树草原）：扁平伞状冠，棕色细干
- **仙人掌**（沙漠）：绿色圆柱+分支，替代当前的小树
- 现有的泪滴树和针叶锥保留

---

## 四、水上元素

### A. 冰山（Icebergs.ts）
- ~8-12 个，只在极地海域（|lat| > 55）
- 不规则多面体（DodecahedronGeometry 扰动），白色/浅蓝
- 部分露出水面，大部分在水下（只渲染上部）
- 缓慢漂移旋转动画
- InstancedMesh

### B. 海岸浪花线（Coastline shader 增强 Ocean.ts）
- 在海洋 shader 中，靠近陆地的区域添加白色泡沫动画带
- 利用现有 foam shader 但在近岸区域加强：当世界坐标靠近陆地时 foam 强度 × 3
- 需要传入陆地位置信息（通过 uniform 或 vertex attribute 标记近岸区域）

### C. 小岛/礁石（Reefs.ts）
- ~15-20 个散布在热带海域
- 很小的凸起（半径 0.03-0.06），刚露出水面
- 浅绿色/沙色，有的上面有 1-2 棵小棕榈
- 用独立的小 SphereGeometry 放置在海面

---

## 五、地表 shader

### A. 风吹草地波动
地形 MeshPhongMaterial onBeforeCompile 注入：
- `swayAmount = sin(time * 1.5 + worldPos.x * 3.0) * 0.003 * heightNorm`
- 只在 heightNorm < 0.4（草地区域）生效

### B. 海拔颜色渐变
片段 shader 根据世界坐标到球心距离实时计算海拔色，比顶点色更平滑

---

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/globe/worldmap.ts` | 大陆坐标重写，增加岛屿 |
| `src/globe/terrain.ts` | 高度参数、海岸 ramp、shader 注入、GLOBE_RADIUS=7 |
| `src/globe/Globe.ts` | shader time、删除 villages/windmills/lighthouses 引用 |
| `src/globe/Ocean.ts` | 半径同步、近岸浪花增强 |
| `src/globe/Atmosphere.ts` | 半径同步 |
| `src/systems/Camera.ts` | 距离范围 10-35 |
| `src/main.ts` | 删除 Villages/Windmills/Lighthouses，添加 Flowers/Grass/Icebergs/Reefs |
| `src/features/Flowers.ts` | 新建 |
| `src/features/Grass.ts` | 新建 |
| `src/features/Icebergs.ts` | 新建 |
| `src/features/Reefs.ts` | 新建 |
| `src/features/Trees.ts` | 增加金合欢、仙人掌 |

## 六、大陆名称标注

### 效果
- 每个大陆/大洋的中心位置浮一个名称标签
- 标签**贴在球面上**，跟随球体旋转
- 当标签朝向背面（dot product < 0）时自动隐藏——只展示当前视角看得到的
- 字体白色，带轻微阴影，不遮挡地形

### 实现
- 用 CSS2DRenderer（Three.js 的 CSS2D 标签系统）
- 每个大陆一个 CSS2DObject，挂在球面对应经纬度的 3D 位置
- 每帧检测标签法线方向与相机方向的点积：
  - `dot(labelNormal, cameraDir) > 0` → 显示（朝向相机）
  - `dot(labelNormal, cameraDir) <= 0` → 隐藏（背面）
- 标签内容：`Africa`、`Europe`、`Asia`、`North America`、`South America`、`Australia`、`Antarctica`
- 大洋：`Pacific Ocean`、`Atlantic Ocean`、`Indian Ocean`

### 新增文件
- `src/features/Labels.ts` — 大陆/大洋名称标签系统

### 修改文件
- `src/main.ts` — 添加 CSS2DRenderer + Labels

---

## 验证
- 从侧面看：山脉轮廓明显突出
- 海岸线：缓坡渐低入水
- 旋转球体：能辨认亚非美大致形状
- 地表密布树木/花/草，像原版那样茂密
- 水面有浪花线、极地有冰山、热带有小岛
- 无村庄/风车/灯塔
- 当前视角的大陆/大洋名称可见，转到背面自动隐藏
