# 人台点云查看器 · SuperSplat 复刻项目说明

> 目标：新建独立前端项目（或独立应用包），**功能对齐**现有 `pages/humanPlatform/[id].vue`，渲染层从 **Spark（Three.js）** 换成 **PlayCanvas / SuperSplat 生态的高斯点云管线**。  
> 本文档供立项、拆任务、验收使用；不修改现有 Lo研社主站人台页。

---

## 1. 背景与动机

现有人台页依赖：

| 层级 | 现状 |
|------|------|
| 页面 | `pages/humanPlatform/[id].vue` |
| 查看器 | `components/ModelViewer/SPZModelViewerContent.vue` |
| 引擎 | `utils/threeCore.ts` + `@sparkjsdev/spark` |

主站场景编辑器（`pages/scene/detail/[id].vue`）与 Spark 深度耦合（`.rad` 流式、mesh 深度混合、ez-tree 互斥等），**不适合整站换库**。人台页以「单/多点云浏览 + 拉线标注」为主，更适合作为 **独立验证 SuperSplat 收益** 的试点。

预期收益（需 PoC 验证，非保证）：

- 大点云：PlayCanvas WebGPU compute 排序带来更高帧率
- 流式 SOG：首屏更快、按设备预算渐进细化
- 与主站 Spark 解耦，失败不影响场景编辑器

---

## 2. 项目范围

### 2.1 做（In Scope）

1. **复刻人台页产品能力**（见 §4 功能清单），UI/交互可与现网一致或等价。
2. **点云渲染**基于 PlayCanvas Engine 的 GSplat / SuperSplat 相关能力（推荐嵌入 Engine，而非整页 iframe SuperSplat Editor）。
3. **格式支持**（见 §5）：
   - ✅ `.ply`
   - ✅ `.spz`
   - ✅ `.splat`（若 Engine 版本支持）
   - ✅ SuperSplat / PlayCanvas **流式格式**（Streamed SOG / SOG 相关；以所选 Engine 版本文档为准）
   - ❌ **不支持** `.rad` / `.radc`（Spark 专用 LoD，本项目明确排除）
4. 继续对接现有图鉴/视频 API（或通过适配层兼容同一 JSON 契约），保证可切换同一 `video_id` 数据源。
5. 移动端可用：浏览、旋转、拉线标签、类型过滤；编辑模式在手机上降级策略需在 §8 明确。

### 2.2 不做（Out of Scope）

- 不替换主站场景详情、图鉴漫游、展览页中的 Spark。
- 不实现 Spark `.rad` / `.radc` 兼容层。
- 不把 SuperSplat **完整编辑器**（裁剪/优化/发布整套 UI）搬进产品；仅复用其 **渲染与流式加载** 能力。
- 不在本项目中复刻场景编辑器的植物、墙体、灯光调试等能力。

---

## 3. 参考实现（现网）

### 3.1 入口与路由

- 路由：`/humanPlatform/:id`
- Query：
  - `library_id`：图鉴 ID（`id=0` 时可加载该图鉴下第一个点云视频）
  - `edit=1`：拉线编辑模式
  - `hide_ui=true`：仅画布，隐藏全部操作 UI（嵌入封面等）
  - `from_iframe=true`：iframe 嵌入精简布局

### 3.2 数据流

```
layoutReady
  → getLibraryVideoById / getLibraryVideo（pk_type === 2）
  → addr（逗号分隔模型 URL）→ modelList
  → json_data.laxian_list → 拉线
  → json_data.cameraList[0] → 初始镜头
  → SPZModelViewerContent → ThreeCore.loadSceneFromJSON
```

保存（编辑模式）：

```
updateLibraryVideoJson({
  video_id,
  json_data: { ...existing, laxian_list, cameraList }
})
```

### 3.3 关键类型（须保持兼容）

定义见 `types/api.ts`：

- `LaxianItem` / `LaxianHighlightFrame` / `LaxianFrameShape` / `LaxianType`
- `LaxianInitialCamera`（`json_data.cameraList`）
- `LibraryVideo.addr`：点云地址，逗号分隔多模型
- `pk_type === 2`：点云视频

新项目应 **读写同一字段语义**，避免双端 JSON 分叉；若需扩展格式元数据，放在 `options` 或新增可选字段，并做好向后兼容。

---

## 4. 功能清单（验收对照表）

按现网 `humanPlatform/[id].vue` 拆分。SuperSplat 项目实现时逐项打勾。

### 4.1 加载与生命周期

| ID | 能力 | 现网要点 | 新项目要求 |
|----|------|----------|------------|
| L1 | 按 `video_id` 加载点云视频 | `getLibraryVideoById` | 同 API 或适配器 |
| L2 | 仅接受点云类型 | `pk_type === 2` 且有 `addr` | 同；非法提示一致 |
| L3 | 多 URL 横向排布 | `position: [index * 3, 0, 0]` | 同默认布局 |
| L4 | 首次加载 / 切换不销毁上下文 | `hasLoadedOnce` + `reloadSceneKeepWebGL` | PlayCanvas 侧等价：切换人台图时尽量复用 device / canvas |
| L5 | 加载遮罩与错误重试 | 进度、失败页、重试 | 同 |
| L6 | 拒绝 / 跳过 `.rad` | 现网 Spark 支持 rad | **检测 URL，rad/radc 提示不支持并跳过** |

### 4.2 浏览交互

| ID | 能力 | 现网要点 | 新项目要求 |
|----|------|----------|------------|
| V1 | Orbit 旋转 / 缩放 / 平移 | OrbitControls | PlayCanvas Orbit / 等价相机控制 |
| V2 | 自动旋转开关 | `autoRotate` | 同 |
| V3 | 初始镜头 | `cameraList[0]` position/target/fov | 进入页应用；编辑可预览/清除 |
| V4 | 分享复制链接 | `useCopyCurrentUrl` | 同 |
| V5 | 关闭返回 | `router.back` | 同或等价 |

### 4.3 拉线（浏览）

| ID | 能力 | 现网要点 | 新项目要求 |
|----|------|----------|------------|
| X1 | 拉线点投影标签 | Canvas 圆点 + DOM 标签 RAF 同步 | 同 UX；坐标从 PC 相机投影 |
| X2 | 类型过滤 | type 0 设计 / type 1 柄图 | 同配色与开关 |
| X3 | Ctrl+H 显隐全部标点 | 快捷键 | 同 |
| X4 | 点击标签聚焦镜头 | `focusLaxianCamera` | 同 |
| X5 | 富文本详情展开 | `detail` + `SafeRichText` | 同 |
| X6 | ↑/↓ 切换标点 | 浏览模式键盘 | 同 |
| X7 | `hide_ui` 不加载拉线 | `viewerLaxianList = []` | 同 |

### 4.4 拉线（编辑 `edit=1`）

| ID | 能力 | 现网要点 | 新项目要求 |
|----|------|----------|------------|
| E1 | 增删定位点 | 面板 + 场景实体 | 同 |
| E2 | 平移 / 旋转 gizmo | TransformControls | PlayCanvas 等价 gizmo 或自研 |
| E3 | 下级线框 box/ellipse | 尺寸、形状、增删 | 同数据契约 |
| E4 | 独显某点 | `setLaxianSoloDisplay` | 同 |
| E5 | 绑定相机到点 / 设初始镜头 | 保存到 item.camera / cameraList | 同 |
| E6 | 详情富文本编辑 | QhxRichTextEditor 或等价 | 同字段 |
| E7 | 保存 / 复制 JSON | `updateLibraryVideoJson` / clipboard | 同 |
| E8 | 排序列表 | QhxSortableList | 可用等价组件 |

### 4.5 周边产品能力

| ID | 能力 | 现网要点 | 新项目要求 |
|----|------|----------|------------|
| P1 | 同图鉴人台列表切换 | `getLibraryVideo` + 侧栏 | 同 |
| P2 | 相似推荐 | `getLibrarySimilar` | 同（可二期） |
| P3 | iframe / hide_ui 嵌入 | layout 精简 | 同 |
| P4 | 移动端点云预算 | Spark：`maxSplats: 40000` | 见 §8；SOG 用 device budget |

---

## 5. 格式与资源策略

### 5.1 支持矩阵

| 扩展名 | 支持 | 说明 |
|--------|------|------|
| `.ply` | ✅ 必须 | 常见导出格式；体积大，建议仅桌面或转 SOG |
| `.spz` | ✅ 必须 | 现网上传主流之一；需确认所选 PlayCanvas / 加载器版本支持 |
| `.splat` | ✅ 建议 | 若 Engine 支持则直接加载 |
| Streamed SOG / SOG（SuperSplat 流格式） | ✅ 必须 | 项目差异化能力：流式 LoD、设备预算 |
| `.ksplat` | ✅ 必须 | 非现网主路径 |
| `.rad` / `.radc` | ❌ 禁止 | 明确不支持；UI/加载器拒绝 |

> 「SuperSplat 本身的流格式」以所选版本官方名为准（常见为 **SOG / Streamed SOG**）。实现前在 PoC 中锁定 Engine 版本与 loader API，并在本文档附录补一条「实测版本与 API 摘录」。

### 5.2 URL 识别建议

```ts
// 伪代码
const SUPPORTED = /\.(ply|spz|splat|sog)(\?|#|$)/i
// 流式包可能是目录、.json manifest、.zip 等，按 PoC 结果扩展
const REJECTED = /\.(rad|radc)(\?|#|$)/i
```

多地址 `addr` 中若混入 `.rad`：跳过该项并 toast「本查看器不支持 RAD（Spark LoD），请使用 ply/spz/流式 SOG」。

### 5.3 资产生产建议（新项目配套）

| 用途 | 建议格式 |
|------|----------|
| 快速预览 / 兼容现网 | `.spz` |
| 大场景 / 手机首屏 | Streamed SOG（上传后转码或预转） |
| 临时调试 | `.ply`（控制点数） |
| 旧 Spark LoD | 留在主站 Spark；本项目不接 |

可在新项目侧增加「上传 → 转 SOG」流水线（CLI / 服务端），与 SuperSplat 平台自动转码对齐；主站 `build3d` 的 rad 上传逻辑 **不要** 搬进本项目。

---

## 6. 推荐架构

### 6.1 为何不整页嵌入 SuperSplat Editor

- Editor 面向「裁剪/优化/发布」，不是产品人台浏览壳。
- 拉线、标签、iframe、编辑 gizmo 需深度定制，iframe 通信成本高。
- 推荐：**PlayCanvas Engine（GSplat）作为渲染内核**，业务 UI 自建（可参考人台页布局）。

### 6.2 模块划分

```
apps/human-platform-pc/          # 或独立仓库
├── app/                         # 路由、页面壳（对齐 humanPlatform）
├── viewers/
│   └── SuperSplatViewer/        # 替代 SPZModelViewerContent
│       ├── createApp.ts         # PlayCanvas Application / GraphicsDevice
│       ├── loadSplat.ts         # ply / spz / sog 统一入口
│       ├── cameraControls.ts
│       ├── laxianLayer.ts       # 拉线实体 + 投影到 2D
│       └── gizmo.ts             # 编辑模式变换
├── api/                         # 复用或代理 Lo研社 library API
├── types/                       # 对齐 LaxianItem 等
└── docs/                        # 本说明的副本与附录
```

### 6.3 Viewer 对外接口（对齐现网 `defineExpose`）

新查看器至少暴露：

```ts
interface HumanPlatformViewerExpose {
  laxianList: Ref<LaxianScreenItem[]>
  focusLaxianCamera: (item: LaxianScreenItem) => void
  setLaxianSoloDisplay: (laxianId: string | null) => void
  reloadSceneKeepDevice: () => Promise<void>  // 对齐 reloadSceneKeepWebGL
  clearSceneContent: () => void
  setTransformMode: (mode: 'translate' | 'rotate') => void
  detachTransformControls: () => void
  bindLaxianTransformListener: (fn: TransformListener | null) => void
  selectLaxianObject: (laxianId?: string) => void
  selectLaxianFrameObject: (laxianId?: string, frameId?: string) => void
  /** 可选：调试用 */
  getApp: () => pc.Application | null
}
```

页面层尽量少改业务逻辑，优先替换 Viewer 实现。

### 6.4 渲染与叠加层

- **点云**：PlayCanvas GSplat（WebGPU 优先，WebGL2 回退）。
- **拉线 3D 实体**：PC Entity（盒子/椭球线框），或独立 Three overlay（不推荐双引擎）。
- **2D 标签**：继续「世界坐标 → 屏幕投影 → Canvas/DOM」，与现网 RAF 策略一致，避免每帧 Vue 重渲染。

---

## 7. 与主站共存策略

| 方案 | 说明 | 建议 |
|------|------|------|
| A. 独立域名 / 子路径新应用 | 完全隔离依赖 | **推荐试点** |
| B. 主站新路由 `/humanPlatformPc/:id` | 同仓不同入口，按 feature flag 切换 | 验证通过后可迁流量 |
| C. 同路由按格式分流 | `addr` 含 sog → PC，含 spz → Spark | 后期优化；初期易乱 |

试点期建议：**A 或 B**，数据共用同一 `video_id`；用户侧可用「试用新版查看器」入口。

---

## 8. 移动端策略

现网 Spark 策略：`mobileOptimized` + `maxSplats: 40000`。

新项目建议：

1. **优先 Streamed SOG**：用引擎「设备高斯预算」自动控制质量；手机给更低 budget。
2. **`.ply` 大文件**：手机拒绝或强制先转 SOG；避免整包下载爆内存。
3. **`.spz`**：设最大解码点数上限（与现网 4 万同量级起步，真机调参）。
4. **WebGPU**：有则用；无则 WebGL2；低端机关闭抗锯齿、限制 DPR（≤1.5）。
5. **编辑模式**：手机默认只读浏览；完整 gizmo 编辑引导至桌面（或提供简化「仅改标题/详情」）。

验收机型建议：iPhone 12+、主流 Android 中端、微信内置浏览器（若业务需要）。

---

## 9. 实施阶段

### Phase 0 · PoC（1–2 周）

- [ ] 锁定 `playcanvas` Engine 版本
- [ ] 验证加载：`.ply` / `.spz` / Streamed SOG 各至少 1 个样例
- [ ] 测 WebGPU / WebGL2 回退与手机 FPS
- [ ] 明确 **不支持 rad** 的错误提示文案
- [ ] 将实测 API 与格式名写入附录

**退出标准**：手机可流畅旋转中等 spz；SOG 样例可渐进加载。

### Phase 1 · Viewer MVP

- [ ] Orbit + 初始镜头 + 多模型排布
- [ ] 对接 `getLibraryVideoById`，复用 `addr` / `json_data`
- [ ] 加载态 / 错误态
- [ ] rad URL 拒绝逻辑

### Phase 2 · 拉线浏览

- [ ] 拉线投影标签、类型过滤、聚焦、详情、快捷键
- [ ] `hide_ui` / iframe 嵌入

### Phase 3 · 拉线编辑

- [ ] gizmo、线框、保存 API、独显、初始镜头编辑
- [ ] 与现网 JSON 互读互写回归

### Phase 4 · 产品完善

- [ ] 同图鉴列表切换、相似推荐
- [ ] 性能 HUD、埋点、灰度开关
- [ ] 文档与运维：转 SOG 流程

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| `.spz` 在某版 Engine 支持不完整 | 现网资产打不开 | PoC 必测；不行则服务端转 SOG/PLY |
| 拉线 gizmo 在 PC 上缺现成 TransformControls | 编辑延期 | Phase 3 可先「面板改数值」再上 gizmo |
| 双栈维护（Spark 人台 + PC 人台） | 成本 | 明确试点期限；成功后只保留一条浏览链 |
| 微信 / 旧 Android 无 WebGPU | FPS 不如宣传 | WebGL2 回退 + SOG 预算；低端降级文案 |
| 误把 rad 链进新查看器 | 加载失败 | 入口校验 + 上传侧引导 |

---

## 11. 验收标准（摘要）

1. 同一 `video_id`（`addr` 为 ply/spz/流式格式）在新项目可浏览，拉线与现网 JSON 一致。
2. `.rad` / `.radc` 被明确拒绝，不静默失败。
3. 桌面：旋转流畅；有 SOG 样例时可见渐进细化。
4. 手机：至少 1 个 spz + 1 个 SOG 流程可完成「打开 → 旋转 → 点拉线 → 看详情」。
5. `edit=1`：增删点、改线框、保存后刷新仍在；主站 Spark 人台读同一 JSON 不崩（字段兼容）。
6. `hide_ui=1`：仅画布，可嵌封面。

---

## 12. 非目标澄清（再次强调）

- **不能**保证「换库即功能 100% 不变」；本项目通过清单逐项对齐，差异记入变更日志。
- **不能**保证所有手机达到 SuperSplat 宣传的 WebGPU 峰值；以真机验收为准。
- **不**承担场景编辑器 Spark → SuperSplat 迁移；人台试点成功后再评估。

---

## 附录 A · 现网关键文件

| 文件 | 作用 |
|------|------|
| `pages/humanPlatform/[id].vue` | 人台页产品逻辑 |
| `components/ModelViewer/SPZModelViewerContent.vue` | Spark/Three 查看器 |
| `utils/threeCore.ts` | `loadSplat` / 拉线实体 |
| `types/api.ts` | `LaxianItem` 等 |
| `pages/library/build3d.vue` | 现网点云上传（含 rad，新项目勿照搬 rad） |

## 附录 B · PoC 实测记录（实施时填写）

| 项 | 填写 |
|----|------|
| playcanvas 版本 | |
| 加载 API（ply） | |
| 加载 API（spz） | |
| 流式 SOG API / 目录结构 | |
| iPhone 机型 / FPS（spz） | |
| Android 机型 / FPS（SOG） | |
| WebGPU 可用率（内测样本） | |

## 附录 C · 建议仓库命名

- 独立仓：`loyanshe-human-platform-supersplat`
- 或 monorepo 包：`apps/human-platform-pc`

入口路由建议：`/hp-pc/:id` 或独立域 `/humanPlatform/:id`（与主站分流时注意 cookie / CORS）。
