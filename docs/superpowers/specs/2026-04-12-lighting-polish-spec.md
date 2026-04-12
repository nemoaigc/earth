# 昼夜循环 + 光照 + 海洋反射 打磨 Spec

## 问题总结

对比原版 Tiny Skies 提取的精确数据，我们的系统在以下方面存在差距：

### 1. 光照系统过于简单
**原版**: 5 盏灯（sun, sun2, fill, fill2, back）+ 1 个半球光（hemiSky + hemiGround）+ 1 个环境光
**我们**: 1 盏方向光 + 1 个环境光

原版的多灯系统让星球各个角度都有光照层次，不会出现"背面全黑"的问题。半球光提供天地两色的漫反射。

### 2. 天空渐变太简单
**原版**: 10 个 color stop 的径向渐变（从天顶到地平线），颜色非常细腻
**我们**: 2 个 color stop 的线性渐变

原版天空渐变示例（白天）：
- stop 0: #04102e（天顶深蓝）
- stop 0.3: #103268
- stop 0.5: #2080b0
- stop 0.7: #28b8dc
- stop 1.0: #70f2fc（地平线亮青）

### 3. 海洋颜色需要独立关键帧
**原版**: oceanShallow 和 oceanDeep 是每个预设单独定义的
- 白天: shallow #2a8ca0, deep #1560a0
- 日落: shallow #5a4a98, deep #302868（紫色调！）
- 夜晚: shallow #081838, deep #040c20（极深蓝）

**我们**: 从天空色推导，缺少精确控制

### 4. 泡沫颜色随时段变化
**原版**: oceanFoam 颜色也随昼夜变化
- 白天: #b3ffff（青白色）
- 日落: #ff9944（橙色！）
- 夜晚: #2050aa（暗蓝色）

### 5. 大气辉光颜色
**原版**:
- 白天: #bbddcc（淡绿白）
- 日落: #ffcc44（金黄）
- 夜晚: #2850aa（蓝紫）

## 实施方案

### A. 升级光照系统

在 `main.ts` 中添加：
```
sunLight      — 主阳光（已有）
sun2Light     — 辅助阳光，弱一些，偏移角度
fillLight     — 填充光，从侧面照射，避免暗面全黑
backLight     — 背光，微弱，从背面提供轮廓光
hemiLight     — 半球光（天色+地色），替代 ambientLight
```

参数从原版提取：
| 灯光 | 白天 intensity | 日落 | 夜晚 |
|------|---------------|------|------|
| sun | 3.75 | 3.5 | 1.25 |
| sun2 | 2.5 | 1.0 | 0.625 |
| fill | 1.25 | 0.875 | 0.625 |
| fill2 | 1.0 | 0.5 | 0.44 |
| back | 1.0 | 0.625 | 0.5 |
| hemi | 1.25 | 0.94 | 0.625 |

注意：原版光照强度总和 ~11，远高于我们的 ~2.5。这就是为什么原版即使夜晚也很亮。

### B. 升级天空渐变

修改 `SkyDome.ts`:
- 从 2-stop 渐变升级为 10-stop 渐变
- 在 DayNightState 中添加 `skyGradient: {stop: number, color: THREE.Color}[]`
- 每个关键帧定义完整的 10-stop 渐变
- Canvas 绘制使用 createLinearGradient 添加所有 stop

### C. 海洋/泡沫颜色加入关键帧

在 KeyFrame 中恢复：
- `oceanShallow: THREE.Color`
- `oceanDeep: THREE.Color`
- `oceanFoam: THREE.Color`

在 Ocean.ts 中：
- 把 foamColor 从固定 uniform 改为每帧更新
- 把 material.color 直接设为插值后的 oceanShallow
- emissive 设为 oceanDeep 的部分

### D. 大气辉光颜色已有

已经在关键帧中，只需确保用的是原版颜色。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/systems/DayNightCycle.ts` | 添加 5 灯参数 + 海洋/泡沫颜色到关键帧 + 天空渐变数据 |
| `src/main.ts` | 添加 sun2, fill, fill2, back, hemi 灯光 + 每帧更新 |
| `src/sky/SkyDome.ts` | 支持 10-stop 渐变 |
| `src/globe/Ocean.ts` | foamColor 动态更新 + 基础颜色从关键帧 |

## 验证
- 白天：明亮，星球各面都有光，天空从深蓝渐变到亮青
- 日落：温暖橙金，海洋泡沫变橙色，天空渐变紫→橙
- 夜晚：深蓝但星球清晰可见（多灯补光），泡沫变暗蓝
- 全程海洋颜色和天空统一
