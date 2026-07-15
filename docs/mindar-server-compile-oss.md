# MindAR 识别图服务端编译方案（OSS URL → `.mind`）

> 给后端 AI / 后端同学落地用。  
> 目标：**不要在前端 Nuxt 里跑 MindAR Compiler**（Vite + tfjs + `long` 互操作问题极多）；由 **Node 服务** 用官方 `OfflineCompiler` 把识别图编成 `.mind`，再回写 OSS。

---

## 1. 背景与结论

### 1.1 为什么必须服务端做

MindAR 图像追踪需要预先把图片编译成 `.mind`（特征点库）。官方路径：

| 方式 | 环境 | 说明 |
|------|------|------|
| 官方网页 Compiler | 浏览器 WebGL | [Image Targets Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile/) |
| **OfflineCompiler** | **Node.js + node-canvas + CPU kernel** | 官方 `examples/nodejs/createImageTargetLibrary.js` |
| 前端 `Compiler` 塞进 Nuxt | ❌ 不推荐 | 会拉 tfjs/worker，易出现 `Long.fromString` / `require is not defined` |

**本方案采用 OfflineCompiler（Node）。**

### 1.2 产品链路（与前端约定）

```
用户上传识别图 → OSS 得到 imageUrl（相对路径或完整 URL）
    → 前端/管理端调用本服务：{ imageUrl }
    → Node：下载图 → OfflineCompiler → 生成 .mind（+ 可选规范化预览图）
    → 上传 OSS → 返回 { mindUrl, previewUrl, ... }
    → 前端写入场景 json_data.arTarget，保存场景
    → AR 页只加载 mindUrl 做追踪（不负责编译）
```

---

## 2. 官方参考（必须按此实现）

### 2.1 官方示例逻辑

来源：`mind-ar` 仓库  
`examples/nodejs/createImageTargetLibrary.js`

```js
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { writeFile } from 'fs/promises'
import { loadImage } from 'canvas'

const images = await Promise.all(imagePaths.map((p) => loadImage(p)))
const compiler = new OfflineCompiler()
await compiler.compileImageTargets(images, console.log) // progress 0–100
const buffer = compiler.exportData() // Uint8Array / Buffer 可写盘
await writeFile('targets.mind', buffer)
```

`OfflineCompiler` 要点：

- 使用 `canvas` 的 `createCanvas`（非浏览器 DOM）
- 使用 CPU detector kernels（`detector/kernels/cpu`），**不依赖 WebGL**
- `exportData()` 产出与浏览器 Compiler 同格式的 msgpack `.mind`（version = 2）

### 2.2 依赖

```json
{
  "dependencies": {
    "mind-ar": "1.2.5",
    "canvas": "^2.11.2"
  }
}
```

**注意：**

1. `canvas`（node-canvas）是原生模块，部署机需要系统库（常见：`cairo`、`pango`、`libjpeg`、`giflib` 等）。Linux 镜像请按 [node-canvas Wiki](https://github.com/Automattic/node-canvas/wiki) 装齐。
2. `mind-ar` 的 Offline 路径会间接触发 `@tensorflow/tfjs` CPU 相关逻辑；**在纯 Node 进程里跑，不要用 Vite 打包这段代码**。
3. 建议 **独立 Node 服务 / 独立 worker 进程**，不要塞进前端 Nuxt SSR。
4. 版本建议与前端运行时一致：`mind-ar@1.2.5`（避免 `.mind` 版本不兼容）。

---

## 3. 是否另起项目

| 选项 | 建议 |
|------|------|
| 独立小服务 `mind-ar-compiler-service` | **推荐**：职责清晰，原生依赖隔离，崩溃不影响主 API |
| 挂在现有 `/node` 后端里一个路由 + 队列 | 可以，但务必 **子进程 / Worker 线程** 跑编译，避免拖垮主进程事件循环 |
| 继续放前端编译 | **否决** |

若资源紧张：可先做「同步 HTTP 接口 + 超时」；量上来再改成「任务队列 + 轮询/回调」。

---

## 4. API 设计（给前端对接）

### 4.1 编译接口（推荐）

`POST /api/ar/compile-mind`  
（路径可按现有后端规范调整，保持语义即可）

**Request JSON**

```json
{
  "imageUrl": "sence_ar/xxx_preview.jpg",
  "sceneId": 12345,
  "name": "封面识别图",
  "options": {
    "maxEdge": 1024,
    "uploadPath": "sence_ar"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageUrl` | string | 是 | OSS 上的识别图。可为相对路径（如 `sence_ar/a.jpg`）或 `https://image.lolitalibrary.com/...` |
| `sceneId` | number/string | 否 | 仅用于生成对象名，如 `scene_12345_{ts}.mind` |
| `name` | string | 否 | 展示名，原样回传 |
| `options.maxEdge` | number | 否 | 编译前最长边缩放上限，默认 `1024`（过大编译慢） |
| `options.uploadPath` | string | 否 | OSS path 前缀，建议 `sence_ar` |

**Success Response**

```json
{
  "code": 0,
  "data": {
    "mindUrl": "sence_ar/scene_12345_1710000000000.mind",
    "previewUrl": "sence_ar/scene_12345_1710000000000_preview.jpg",
    "targetIndex": 0,
    "name": "封面识别图",
    "updatedAt": "2026-07-15T05:00:00.000Z",
    "meta": {
      "width": 800,
      "height": 600,
      "compileMs": 12345
    }
  }
}
```

**Error Response（示例）**

```json
{
  "code": 40001,
  "message": "识别图过小，最短边需 ≥ 200px"
}
```

建议错误码：

| code | 含义 |
|------|------|
| 40001 | 图片非法 / 下载失败 / 尺寸不合规 |
| 40002 | 编译失败 |
| 40003 | 上传 OSS 失败 |
| 40800 | 编译超时 |
| 50000 | 未知错误 |

### 4.2 前端写入场景 JSON 的字段（契约）

前端会把返回结果写入场景 `json_data.arTarget`：

```ts
interface SceneArTargetJSON {
  mindUrl: string      // OSS 相对路径或可拼 BASE_IMG 的路径
  previewUrl: string   // 预览图，同上
  targetIndex?: number // 默认 0（单图编译固定 0）
  name?: string
  updatedAt?: string   // ISO
}
```

**约定：**

- `mindUrl` / `previewUrl` 优先存 **OSS 相对路径**（与站内其它素材一致），前端用 `https://image.lolitalibrary.com/` + 相对路径访问。
- 有合法 `arTarget`（两 URL 都非空）时，场景详情右上角展示 AR 入口。
- AR 运行时 **只读** `mindUrl`，不再编译。

---

## 5. 服务端实现步骤（给 AI 按序编码）

### 5.1 模块划分

```
mind-compiler/
  src/
    index.ts              # HTTP 入口
    routes/compileMind.ts
    services/
      resolveImageUrl.ts  # 相对路径 → 可下载绝对 URL
      downloadImage.ts
      normalizeImage.ts   # 缩放、转 JPEG 预览
      compileMind.ts      # OfflineCompiler 封装
      uploadOss.ts        # 复用现有 OSS 上传
    config.ts
  package.json
```

### 5.2 `resolveImageUrl`

```ts
const BASE_IMG = process.env.BASE_IMG || 'https://image.lolitalibrary.com/'

export function resolveImageUrl(imageUrl: string): string {
  const u = imageUrl.trim()
  if (!u) throw Object.assign(new Error('imageUrl 为空'), { code: 40001 })
  if (/^https?:\/\//i.test(u)) return u
  return `${BASE_IMG.replace(/\/$/, '')}/${u.replace(/^\//, '')}`
}
```

安全建议：

- 仅允许白名单域名（如 `image.lolitalibrary.com`、内网 OSS 域名）。
- 禁止 `file://`、内网任意 IP SSRF（若 URL 来自用户输入）。

### 5.3 下载图片

```ts
export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw Object.assign(new Error(`下载失败 HTTP ${res.status}`), { code: 40001 })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > 12 * 1024 * 1024) {
    throw Object.assign(new Error('图片超过 12MB'), { code: 40001 })
  }
  return buf
}
```

### 5.4 规范化（建议）

用 `canvas` / `sharp` 均可；与 OfflineCompiler 同用 `canvas` 更省依赖：

1. `loadImage(buffer)` 得到宽高  
2. 最短边 `< 200` → 拒绝（特征太少，追踪差）  
3. 最长边 `> maxEdge(1024)` → 等比缩小  
4. 导出：
   - **编译用**：`HTMLImage`-like / canvas Image（`canvas` 的 Image）
   - **预览用**：JPEG buffer（quality ~0.92）→ 上传为 `previewUrl`

> MindAR 建议识别图：纹理丰富、对比清晰、避免大面积纯色。可在 API 文档里提示，服务端不必强校验特征点数（除非后续要读 compile 可视化数据）。

### 5.5 核心：编译 `.mind`

```ts
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { loadImage } from 'canvas'

export async function compileToMindBuffer(
  imageInput: Buffer | string, // buffer 或本地临时路径
  onProgress?: (p: number) => void
): Promise<Buffer> {
  const img = await loadImage(imageInput)
  const compiler = new OfflineCompiler()
  await compiler.compileImageTargets([img], (p) => onProgress?.(p))
  const data = compiler.exportData()
  return Buffer.isBuffer(data) ? data : Buffer.from(data)
}
```

**注意导入路径：**

- 使用 `mind-ar/src/image-target/offline-compiler.js`（官方 Node 示例同款）。
- `package.json` 建议 `"type": "module"`，或用动态 `import()`。
- **不要** import 浏览器版 `compiler.js`（带 `?worker&inline`，只适合 Vite 网页）。

### 5.6 上传 OSS

复用现有后端 OSS 逻辑（与 `sence_cover` / `editor` 等同套签名）。

建议对象名：

```text
sence_ar/scene_{sceneId|new}_{timestamp}.mind
sence_ar/scene_{sceneId|new}_{timestamp}_preview.jpg
```

Content-Type：

- `.mind` → `application/octet-stream`
- 预览 → `image/jpeg`

返回写入 DB/响应的应为 **相对 path**（与现网 `file_url` 风格一致）。

### 5.7 超时与并发

| 项 | 建议 |
|----|------|
| 单次编译超时 | 120s（大图 CPU 编译可能较慢） |
| 进程内并发 | 默认 1～2；排队，避免 CPU/内存打满 |
| 内存 | 大图峰值较高，容器建议 ≥ 1～2GB |

同步接口伪代码：

```ts
await Promise.race([
  compilePipeline(...),
  sleep(120_000).then(() => {
    throw Object.assign(new Error('编译超时'), { code: 40800 })
  })
])
```

量上来后改为：

1. `POST` 返回 `taskId`  
2. Worker 编译  
3. `GET /api/ar/compile-mind/:taskId` 查状态 / 或回调 webhook  

---

## 6. 完整流水线伪代码

```ts
async function compileMindFromOssUrl(body: CompileBody) {
  const absUrl = resolveImageUrl(body.imageUrl)
  const raw = await downloadImage(absUrl)

  const { compileImage, previewJpeg, width, height } = await normalizeImage(raw, {
    maxEdge: body.options?.maxEdge ?? 1024
  })

  const t0 = Date.now()
  const mindBuf = await compileToMindBuffer(compileImage)
  const compileMs = Date.now() - t0

  const stamp = Date.now()
  const sid = body.sceneId ?? 'new'
  const base = `scene_${sid}_${stamp}`
  const path = body.options?.uploadPath ?? 'sence_ar'

  const previewUrl = await uploadOss({
    path,
    name: `${base}_preview`,
    buffer: previewJpeg,
    contentType: 'image/jpeg',
    ext: '.jpg'
  })
  const mindUrl = await uploadOss({
    path,
    name: base,
    buffer: mindBuf,
    contentType: 'application/octet-stream',
    ext: '.mind'
  })

  return {
    mindUrl,
    previewUrl,
    targetIndex: 0,
    name: body.name || undefined,
    updatedAt: new Date().toISOString(),
    meta: { width, height, compileMs }
  }
}
```

---

## 7. 环境与部署 Checklist

- [ ] Node ≥ 18  
- [ ] 安装 `mind-ar@1.2.5`、`canvas`  
- [ ] 系统已装 node-canvas 原生依赖  
- [ ] 本机可跑通官方示例：本地 png → 写出 `targets.mind`  
- [ ] 用官方网页 Compiler 对同一张图编一份，两边 `.mind` 均可被同一前端 AR 页锁定（抽测）  
- [ ] OSS 上传权限、path 白名单 `sence_ar`  
- [ ] SSRF 域名白名单  
- [ ] 日志：sceneId、耗时、宽高、错误栈（勿打图片二进制）  
- [ ] （可选）鉴权：与现有用户 token 一致，仅场景所有者可调  

### 本地验证命令（建议写进 README）

```bash
# 在编译服务目录
node --experimental-vm-modules ./scripts/smoke-compile.mjs ./fixtures/card.png ./out/targets.mind
```

`smoke-compile.mjs` 即官方示例的薄封装：本地文件进、`.mind` 出。先保证这条通，再接 HTTP/OSS。

---

## 8. 与前端协作约定

1. **前端只传已上传到 OSS 的 `imageUrl`**，不传超大 base64（避免网关限制）。  
2. 编译成功后前端把 `data` 写入 `json_data.arTarget`，并 **保存场景**。  
3. 清除识别图：前端置 `arTarget: null` 并保存；服务端可不提供删除（OSS 可孤儿保留或另做 GC）。  
4. AR 页优先读场景 `arTarget.mindUrl`；无则不要静默用默认 Card（产品侧按需求定）。  
5. 前端 **禁止** 再依赖 `mind-ar/.../compiler` 做上传编译。

---

## 9. 验收标准

1. 传入合法 OSS 图片 URL，返回可用的 `mindUrl` + `previewUrl`。  
2. 浏览器打开 AR 页，对准该预览图（或打印图），能进入 tracking / 位姿锁定。  
3. 非法图（过小、非图片、下载 404）返回明确业务错误，不 500 堆栈裸奔。  
4. 并发 2 个编译任务时服务仍稳定（或明确排队）。  
5. 编译服务宕机不影响主站其它 API（若独立部署）。

---

## 10. 非目标（本阶段不做）

- 多图打进同一个 `.mind`（`targetIndex` 多目标）——接口可预留数组，首期只支持 1 张。  
- 服务端评估「特征点是否足够好」的可视化打分。  
- 在 Nuxt/Vite 主工程内编译。  
- 替换 MindAR 运行时（追踪仍用现有前端 MindAR Controller / 后续另案隔离）。

---

## 11. 给后端 AI 的实现优先级

1. **P0** 本地脚本：文件 → `OfflineCompiler` → `.mind` 写盘（打通原生依赖）  
2. **P0** `compileToMindBuffer` + 单测/smoke  
3. **P0** HTTP：`imageUrl` → 下载 → 编译 → 上传 OSS → 返回契约 JSON  
4. **P1** 图片规范化、校验、超时、域名白名单  
5. **P2** 异步任务队列  

---

## 12. 关键参考链接

- 官方编译说明：https://hiukim.github.io/mind-ar-js-doc/quick-start/compile  
- 官方在线 Compiler：https://hiukim.github.io/mind-ar-js-doc/tools/compile/  
- Offline 示例：https://github.com/hiukim/mind-ar-js/blob/master/examples/nodejs/createImageTargetLibrary.js  
- OfflineCompiler 源码：https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/offline-compiler.js  
- 服务端编译讨论：https://github.com/hiukim/mind-ar-js/issues/493  

---

## 前端对接说明（open_LoYanShe_web）

1. 场景所有者：更多菜单 →「添加/管理识别图」→ 先 `uploadFileToOSS(..., 'sence_ar')`，再 `POST /ar/compile-mind`。
2. 编译成功后服务端已写 `json_data.arTarget`，前端用返回值更新本地 UI；**不必**再为 arTarget 单独调场景 update。
3. 有 `arTarget.mindUrl + previewUrl` 时，场景详情右上角显示 **AR** → `/scene/detail/ar/:id`。
4. AR 页优先读场景 `arTarget`，无则兜底默认 Card。
5. 清除：前端 `updateScene` 把 `json_data.arTarget = null`（整份 json 一并提交）。

相关文件：`api/ar.ts`、`components/scene/SceneArTargetModal.vue`、`pages/scene/detail/[id].vue`、`pages/scene/detail/ar/[id].vue`。
