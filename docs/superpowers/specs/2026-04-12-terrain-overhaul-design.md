# 地形起伏 + 大陆精细化 + 地表 shader 设计

## 目标
1. 地形从"贴纸"变成有明显山丘起伏的立体星球
2. 大陆轮廓接近真实世界地图
3. 地表增加 shader 效果（风吹草地 + 海拔渐变）

## 不动的部分
- 海洋 shader（波光粼粼）
- 所有地表素材（树、村庄、风车、灯塔、气球）
- 自发光模式 + 昼夜循环
- 生物群落系统逻辑

---

## 一、地形起伏

### 当前问题
- `LAND_HEIGHT_SCALE = 0.5`，noise 值 0-0.5，实际高度仅 0-0.25，太平
- 海岸渐低 ramp 范围只有 10°，过渡太窄

### 改动
- `LAND_HEIGHT_SCALE`: 0.5 → **0.8**
- 噪声参数：6 octaves, lacunarity 2.0, persistence **0.55**, scale **0.8**
- 海岸检测范围：10° → **15°**（7 步，每步约 2.1°）
- 内陆隆起：`centralBoost = 1.0 + coastDist * 0.5`，让大陆中央额外高 50%
- 最终高度：`height = noise * coastFactor * centralBoost * LAND_HEIGHT_SCALE`

### 效果
- 海岸线：缓坡入水，几乎平到海平面
- 内陆 5-10°：丘陵开始出现
- 大陆中心：明显的山脉/高原，从侧面能看到突出轮廓

---

## 二、大陆轮廓精细化

### 改动文件
`src/globe/worldmap.ts`

### 点数目标
| 大陆 | 当前 | 目标 | 重点区域 |
|------|------|------|---------|
| Africa | 45 | 100 | 西非凹陷、马达加斯加、好望角 |
| Europe | 35 | 90 | 地中海、意大利靴、斯堪的纳维亚、英国 |
| Asia | 70 | 150 | 中国海岸线、朝鲜半岛、东南亚半岛、阿拉伯 |
| India | 18 | 40 | 次大陆三角形、斯里兰卡 |
| North America | 52 | 100 | 五大湖轮廓、佛罗里达、墨西哥湾 |
| South America | 42 | 80 | 巴西突出、巴塔哥尼亚 |
| Australia | 25 | 50 | 大堡礁海岸、塔斯马尼亚 |

### 新增岛屿
- 新西兰（2 个岛）
- 马达加斯加
- 斯里兰卡
- 印尼（苏门答腊、婆罗洲、爪哇、苏拉威西）
- 菲律宾（简化轮廓）
- 台湾、海南

### 球体参数
- `GLOBE_RADIUS`: 5 → **7**
- 细分：120 → **140**
- 海洋网格半径同步：`GLOBE_RADIUS - 0.005`
- 相机 `minDistance`: 7 → **10**
- 相机 `maxDistance`: 25 → **35**

---

## 三、地表 shader

### A. 风吹草地波动
在地形 MeshPhongMaterial 的 `onBeforeCompile` 中注入：
- uniform `uTime`
- 顶点 shader：对非海洋顶点，根据高度和世界位置添加微小的正弦位移
- `swayAmount = sin(time * 1.5 + worldPos.x * 3.0) * 0.003 * heightNorm`
- 只在低-中海拔（草地区域，heightNorm < 0.4）生效
- 高海拔（岩石/雪）不动

### B. 海拔颜色渐变（shader 化）
当前用顶点色做海拔着色，改为 shader 内实时计算：
- 在片段 shader 中根据 `vWorldPos` 到球心的距离推算海拔
- 低海拔：biome 低色
- 中海拔：biome 中色
- 高海拔：biome 高色 → 雪色
- 比顶点色更平滑，无三角形边界色差

---

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/globe/worldmap.ts` | 所有大陆坐标重写，增加岛屿 |
| `src/globe/terrain.ts` | 高度参数、海岸 ramp、centralBoost、shader 注入 |
| `src/globe/Globe.ts` | terrain shader 时间 uniform 更新 |
| `src/globe/Ocean.ts` | 半径同步 |
| `src/globe/Atmosphere.ts` | 半径同步 |
| `src/systems/Camera.ts` | 距离范围调整 |
| `src/main.ts` | 传 time 给 terrain shader |

## 验证
- 从侧面看球体：山脉轮廓明显突出
- 海岸线：缓坡渐低入水
- 旋转球体：能辨认出亚洲、非洲、美洲的大致形状
- 草地区域有微微波动
- 低→高颜色平滑渐变，无锯齿色块
