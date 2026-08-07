# 场景物体 GSAP 动效预设开发指南

本文说明如何在场景编辑器中为物体添加新的动效预设，以及如何定义可在面板中调节的参数。实现基于 **GSAP**，预设注册表集中在 `utils/sceneAnimationPresets.ts`。

---

## 1. 架构概览

```
用户点击预设图标
    → useSceneObjectAnimation.applyPreset()
    → preset.buildEffect(params, obj)   // 生成 SceneEffectJSON
    → 写入 mesh.userData.effect[]
    → threeCore.applyAnimation()        // GSAP 播放

保存场景
    → threeCore.saveSceneToJSON()
    → json.objects[].effect（仅 preset + options，不含 properties）

加载场景
    → threeCore.setEffectModel()
    → resolveAnimationEffect()          // 按当前物体变换重算 properties
    → applyAnimation()
```

| 文件 | 职责 |
|------|------|
| `utils/sceneAnimationPresets.ts` | **唯一需要改动的注册表**：预设列表、`paramDefs`、`buildEffect` |
| `composables/useSceneObjectAnimation.ts` | 应用 / 暂停 / 继续 / 调参 / 列表（一般无需改） |
| `components/scene/SceneAnimationEditor.vue` | 预设网格 + 已应用列表 UI（一般无需改） |
| `utils/threeCore.ts` | `SceneEffectJSON`、`applyAnimation`、`setEffectModel` |

新增预设时，**通常只需编辑 `sceneAnimationPresets.ts`**，在 `SCENE_ANIMATION_PRESETS` 数组末尾追加一项即可；编辑器会自动出现新图标与调参表单。

---

## 2. 预设对象结构 `SceneAnimationPreset`

```typescript
export interface SceneAnimationPreset {
  id: string              // 唯一标识，写入 SceneEffectJSON.preset
  label: string           // 面板显示名称
  icon: string            // UIcon 名称，如 'material-symbols:360'
  category: 'translate' | 'rotate'  // 分类（当前 UI 未分组，可预留）
  paramDefs: AnimationParamDef[]    // 调参表单定义
  buildEffect: (params, obj) => SceneEffectJSON
}
```

### 2.1 可调参数 `AnimationParamDef`

| 字段 | 说明 |
|------|------|
| `key` | 参数键，存入 `effect.options[key]` |
| `label` | 表单标签 |
| `type` | `'number'` \| `'select'` \| `'boolean'` |
| `default` | 点击图标「一键应用」时的默认值 |
| `min` / `max` / `step` | `number` 类型可选，供 `QhxNumberStepper` 使用 |
| `options` | `select` 类型：`{ value, label }[]` |

面板里「调参」区域会根据 `paramDefs` **自动生成**控件，无需改 Vue 组件。

### 2.2 共用时间轴参数

`SCENE_ANIMATION_TIMING_PARAMS` 已包含：

- `duration` 时长（秒）
- `ease` 缓动（GSAP ease 字符串）
- `delay` 延迟（开始前等待）
- `startTime` **起始时间 / 已运行秒**：播放时 `seek` 切入该进度，用于多物体错落相位；**不是** `delay`
- `repeat` 重复次数（**`-1` = 无限循环**）
- `yoyo` 是否往返
- `repeatDelay` 重复间隔

通过 `mergeParamDefs(自定义参数...)` 合并进预设；**同名 `key` 以先定义的为准**（自定义可覆盖默认 `duration` 等）。

```typescript
paramDefs: mergeParamDefs(
  { key: 'distance', label: '距离', type: 'number', default: 0.5, step: 0.05 },
  { key: 'duration', label: '时长(秒)', type: 'number', default: 1.5, min: 0.2, max: 30, step: 0.1 }
  // 自动追加 ease / delay / repeat / yoyo / repeatDelay（若 key 未重复）
)
```

辅助函数 `timingFromParams(params, overrides?)` 可从 `params` 解析 GSAP 时间字段，必要时用 `overrides` 强制行为（如无限循环 + 往返）。

---

## 3. `buildEffect` 编写规范

```typescript
buildEffect(params, obj) {
  return {
    type: 'animation',       // 固定
    preset: 'yourPresetId',  // 与 id 一致
    options: { ...params },  // 原样保存，供加载与调参回显

    // 运行时目标（GSAP tween 终点）
    properties: {
      'position.x': obj.position.x + 1,
      'position.y': obj.position.y,
      'rotation.y': obj.rotation.y + Math.PI * 2,
      'scale.x': 2,
    },

    // 时间轴（也可用 timingFromParams）
    duration: 2,
    ease: 'power2.inOut',
    delay: 0,
    repeat: -1,    // -1 无限
    yoyo: true,
    repeatDelay: 0,
  }
}
```

### 3.1 `properties` 键名约定

`threeCore.applyAnimation` 支持 **点分路径**，会 tween 到对应子属性：

| 键 | GSAP 目标 |
|----|-----------|
| `position.x` / `position.y` / `position.z` | `obj.position` |
| `rotation.x` / `rotation.y` / `rotation.z` | `obj.rotation`（弧度） |
| `scale.x` / `scale.y` / `scale.z` | `obj.scale` |

### 3.2 相对当前变换 vs 绝对目标

- **相对**：用 `obj.position.x + offset` 或 `obj.rotation.y + angle`（加载场景时会按**当时**物体状态重算，与编辑时一致）。
- **绝对**：直接写 `num(params, 'x')` 作为世界目标坐标/角度。

往返循环（上浮、左右摆）：目标设为「当前值 ± 偏移」，并设 `repeat: -1`、`yoyo: true`。

持续旋转一圈：`rotation.*` 目标为 `current + Math.PI * 2`，`ease: 'none'`，`repeat: -1`。

### 3.3 持久化：不要依赖 `properties`

保存到场景 JSON 时，`toStoredAnimationEffect()` 会**去掉 `properties`**，只保留：

```json
{
  "type": "animation",
  "id": 1,
  "preset": "floatUp",
  "options": {
    "distance": 0.4,
    "duration": 1.5,
    "repeat": -1,
    "yoyo": true,
    "ease": "power2.inOut"
  }
}
```

加载时 `resolveAnimationEffect(effect, obj)` 会再次调用 `buildEffect(options, obj)` 生成 `properties`。因此 **`options` 必须包含调参所需的全部字段**。

---

## 4. 新增预设步骤（Checklist）

1. 在 `SCENE_ANIMATION_PRESETS` 数组中新增对象。
2. 填写 `id`（英文 camelCase）、`label`、`icon`（[Material Symbols](https://fonts.google.com/icons) 或项目已有 UIcon 名）。
3. 用 `mergeParamDefs(...)` 声明 `paramDefs`，设置好 **默认值**（即用户点击图标的初始效果）。
4. 实现 `buildEffect`，保证 `preset` 与 `id` 一致，并返回合法 `properties` + 时间轴字段。
5. 本地验证：
   - 场景编辑 → 选中模型 →「动效」→ 点击新图标应立即播放；
   - 「已应用」列表出现该项 →「调参」修改后仍正常；
   - 保存场景 → 刷新/重进 → 动效仍正确（证明 `options` 足够）。
6. （可选）若重命名旧 `id`，在 `LEGACY_PRESET_ALIASES` 中增加映射，避免旧场景 JSON 失效。

**无需修改** `SceneAnimationEditor.vue`，预设网格读取 `SCENE_ANIMATION_PRESETS` 自动渲染。

---

## 5. 完整示例：缩放脉动 `scalePulse`

```typescript
{
  id: 'scalePulse',
  label: '脉动',
  icon: 'material-symbols:unfold-more',
  category: 'translate', // 或后续扩展 'scale' 分类
  paramDefs: mergeParamDefs(
    {
      key: 'scaleFactor',
      label: '缩放倍数',
      type: 'number',
      default: 1.15,
      min: 1.01,
      max: 3,
      step: 0.01
    },
    {
      key: 'duration',
      label: '时长(秒)',
      type: 'number',
      default: 0.8,
      min: 0.1,
      max: 10,
      step: 0.1
    },
    { key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
    { key: 'yoyo', label: '往返', type: 'boolean', default: true }
  ),
  buildEffect(params, obj) {
    const factor = num(params, 'scaleFactor', 1.15)
    return {
      type: 'animation',
      preset: 'scalePulse',
      options: { ...params },
      properties: {
        'scale.x': obj.scale.x * factor,
        'scale.y': obj.scale.y * factor,
        'scale.z': obj.scale.z * factor
      },
      ...timingFromParams(params, { repeat: -1, yoyo: true })
    }
  }
}
```

将上述对象推入 `SCENE_ANIMATION_PRESETS` 即可。

---

## 6. 工具函数速查

| 函数 | 用途 |
|------|------|
| `num(params, key, fallback)` | 安全读取数值参数 |
| `timingFromParams(params, overrides?)` | 解析 duration / ease / repeat / yoyo 等 |
| `mergeParamDefs(...groups)` | 合并自定义参数 + 共用时间轴参数（去重） |
| `getDefaultPresetParams(preset)` | 从 `paramDefs` 收集默认值 |
| `resolveAnimationEffect(effect, obj)` | 加载时根据 preset + options 重建 effect |
| `toStoredAnimationEffect(effect)` | 保存前剥离 `properties` |
| `getSceneAnimationPreset(id)` | 按 id 取预设（含 `LEGACY_PRESET_ALIASES`） |

---

## 7. 内置预设一览（维护表）

| id | 名称 | 默认行为摘要 |
|----|------|----------------|
| `rotate360` | 旋转 | Y 轴 360°，`repeat: -1`，单圈 4s，线性 |
| `floatUp` | 上浮 | Y 上移 0.4，往返无限 |
| `floatDown` | 下沉 | Y 下移 0.4，往返无限 |
| `swayRotateZ` | 左右摇摆 | Z 轴 ±12°，往返无限 |
| `swayX` | 左右 | X 偏移 0.5，往返无限 |
| `swayZ` | 前后 | Z 偏移 0.5，往返无限 |
| `riseOnce` | 升起 | Y 上移 1，播放一次 |
| `swing` | 秋千 | 绕上方支点正弦钟摆，默认摆角 28°、绳长 1.2、周期 2.4s |

新增预设后请同步更新此表。

---

## 8. 旧预设 id 兼容

重命名或删除预设时，在 `LEGACY_PRESET_ALIASES` 中映射旧 id → 新 id：

```typescript
const LEGACY_PRESET_ALIASES: Record<string, string> = {
  rotateLoop: 'rotate360',
  // oldId: 'newId',
}
```

---

## 9. 常见问题

**Q：调参后物体「跳」了一下？**  
A：`buildEffect` 基于**当前**变换计算目标。改参数会 `kill` 后重播；若需从初始姿态播放，应在 `options` 中额外保存基准 `position/rotation`（当前未内置，需自行扩展 preset）。

**Q：`repeat: -1` 不循环？**  
A: 确认 `buildEffect` 里 `repeat` 为数字 `-1`，且未被 `timingFromParams` 的默认值覆盖。

**Q：同一预设点了两次？**  
A: 设计如此，每次点击追加一条「已应用」记录，可分别调参；不需要则合并逻辑需改 `applyPreset`（`useSceneObjectAnimation.ts`）。

**Q：想 tween 材质、透明度？**  
A: 当前 `applyAnimation` 仅支持 `position` / `rotation` / `scale` 点分属性；扩展需改 `threeCore.applyAnimation`。

**Q：图标不显示？**  
A: 使用项目已支持的 `UIcon` 名称，优先 `material-symbols:*` 或 `ant-design:*`。

---

## 10. 相关类型（`threeCore.ts`）

```typescript
export interface SceneEffectJSON {
  type: 'animation' | 'effect' | 'timeline'
  preset?: string
  options?: Record<string, any>
  id?: number
  properties?: Record<string, number>
  duration?: number
  ease?: string
  delay?: number
  repeat?: number   // -1 无限
  yoyo?: boolean
  repeatDelay?: number
}
```

物体上的列表：`mesh.userData.effect: SceneEffectJSON[]`（与 shader 特效 `type: 'effect'` 共用数组，GSAP 项为 `type: 'animation'` 或带 `preset` 字段）。

---

## 11. 参考链接

- GSAP ease 列表：https://gsap.com/docs/v3/Eases
- 场景页入口：`pages/scene/detail/[id].vue` → 选中物体 → 操作条「动效」
