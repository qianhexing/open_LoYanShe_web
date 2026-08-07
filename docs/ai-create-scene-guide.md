# AI 创建场景指南（素材准备 + 上传配方）

> 给 AI / 自动化用。读完即可按清单收素材，并走完整条「上传模型 → 登记素材 → 插入场景」链路。  
> 源码依据：`pages/scene/detail/[id].vue`、`api/scene.ts`、`api/material.ts`、`utils/threeCore.ts`、`utils/materiaModelKind.ts`、`components/scene/Material.vue`。  
> **注意拼写**：API 路径与字段是 `sence`（少 e）、`materia`（少 r），不要写成 `scene` / `material`。

---

## 0. 心智模型（必读）

场景 **不直接存模型二进制**。场景存的是 `json_data: SceneJSON`，里面用 **OSS 相对路径 URL** 引用已上传资源。

```
本地文件
  → OSS 上传（uploadFileToOSS /qhxUpload）
  →（可选）登记 Material（POST /material/insert）
  → 写入 SceneJSON.objects[]
  → POST /sence/insert
  →（可选）截图补封面 POST /sence/update
```

最低合法场景：

```json
{ "json_data": { "objects": [] } }
```

人工入口：`/scene/detail/0?add=1`（新建）· `/scene/detail/{id}?edit=1`（编辑）。

---

## 1. 给你（人类）的素材准备清单

把下面表格填完交给 AI，AI 就能直接上传生成。

### 1.1 必填

| 项 | 说明 | 你的填写 |
|----|------|----------|
| 登录态 | 需已登录，请求带 Cookie / Token | □ 已登录 |
| 主模型文件 | **仅 `.glb` 或 `.gltf`（单文件）** | 路径：________ |
| 场景意图 | 一句话：展厅 / 单品展示 / 点云空间 / 空场景 | ________ |

### 1.2 强烈建议

| 项 | 说明 | 你的填写 |
|----|------|----------|
| 模型标题 | 写入 `materia_title` | ________ |
| 封面图 | PNG/JPG；无则保存后由编辑器截图画布 | 路径或「自动截图」 |
| 放置位姿 | `position` / `rotation` / `scale` | 默认 `[0,0,0]` / `[0,0,0]` / `[1,1,1]` |
| 机位 | `cameraList[0]`：相机位置 + lookAt 目标 | 默认相机约 `(0,1.5,5)` → `(0,0,0)` |
| 背景 | 图片 URL 或 `color:#rrggbb` | 可选 |
| 是否公开素材 | `is_private`: `0` 公开 / `1` 私密 | 默认 `0` |

### 1.3 按类型附加（有则填）

| 类型 | 支持格式 | 额外要求 |
|------|----------|----------|
| 3D 模型 | `.glb` / `.gltf` | 推荐 Draco；前端默认 `useDracoLoader: true`，decoder `/draco/gltf/` |
| 点云 LoD | **1 个 `.rad` + 可选多个 `.radc`** | 同目录上传；`options: { assetKind: "splat", paged: true }` |
| 其它点云 | `.ply` `.spz` `.splat` `.ksplat` `.zip` | `type: "splat"` |
| 图片平面 | `image/*` | 上传约 **8MB** 上限（后端默认） |
| 视频平面 | `.mp4` `.webm` `.mov` `.m4v` `.ogg` | OSS path 常用 `video` |
| AR 识别图 | JPG/PNG/WebP，**≤ 12MB** | **必须先有 `sence_id`** 再编译 MindAR |

### 1.4 明确不要准备

- ❌ FBX / OBJ / USDZ / Blender 源文件（编辑器自定义上传只认 glb/gltf）
- ❌ 场景标题表单（前端 insert **不传** `sence_desc`）
- ❌ 场景级隐私开关（`is_private` 在 Scene 上有字段，创建 UI 未暴露）
- ❌ 标签 / tags（场景创建流无此字段）

---

## 2. 可复制「任务简报」模板（直接粘贴给 AI）

```markdown
## 创建场景任务

### 目标
用我提供的模型生成一个可浏览的 3D 场景。

### 素材文件（本地路径）
- 主模型：./assets/xxx.glb
- 封面（可选）：./assets/cover.png
- 点云（可选）：./assets/scan.rad + ./assets/*.radc
- 背景图（可选）：./assets/bg.jpg
- 视频（可选）：./assets/clip.mp4

### 元数据
- materia_title: 「模型中文名」
- is_private: 0
- pk_type: 5          # 自定义上传约定
- 放置：position [0,0,0], rotation [0,0,0], scale [1,1,1]
- 机位：position {x:0,y:1.5,z:5}, target {x:0,y:0,z:0}, fov 50
- 背景：color:#f5f5f5  或  图片相对路径
- 灯光：用默认；或见下方 lighting 数组

### 执行步骤（按顺序）
1. uploadFileToOSS(模型, path=`material`) → 得到 file_url, file_id
2. （可选）上传封面到 path=`editor`
3. POST /material/insert（见 §3.2）
4. POST /sence/insert，json_data.objects 引用 file_url（见 §3.3）
5. （可选）上传封面到 path=`sence_cover`，POST /sence/update 补 sence_cover
6. 返回 sence_id 与访问链接 `/scene/detail/{sence_id}`

### 硬约束
- 模型仅 glb/gltf；URL 存 OSS 相对路径（加载时拼 BASE_IMG）
- API 拼写：sence / materia
- Draco：options.useDracoLoader=true（除非明确关闭）
```

---

## 3. API 配方（AI 直接照做）

### 3.1 上传文件

| 资源 | 方式 | path / 备注 |
|------|------|-------------|
| glb/gltf | `uploadFileToOSS(file, 'material')` | 常命名 `{md5}.glb` |
| rad 包 | `uploadFileToOSS` → `material/{radMd5}/{filename}` | rad 与 radc **同目录** |
| 视频 | `uploadFileToOSS(file, 'video')` | |
| 封面/编辑图 | `uploadFileToOSS(file, 'editor')` | |
| 场景封面 | `uploadFileToOSS(file, 'sence_cover', 'cover_{id}')` | |
| 普通图片 | `POST /qhxUpload` FormData `file` | ~8MB |

查重/STS：`POST /qhxUploadOss` `{ file_md5, path? }`  
登记文件：`POST /file/insert/new` `{ file_url, file_md5, file_type?, file_size? }`

### 3.2 登记素材 `POST /material/insert`

```json
{
  "materia_title": "my-model.glb",
  "materia_url": "<OSS相对路径>",
  "cover": "<封面相对路径或 null>",
  "pk_type": 5,
  "pk_id": "<file_id 或 null>",
  "is_enable": 0,
  "is_private": 0,
  "options": {
    "assetKind": "model",
    "useDracoLoader": true
  }
}
```

`options.assetKind` 取值：

| assetKind | 用途 |
|-----------|------|
| `model` | glTF/GLB |
| `splat` | 点云（rad 时加 `paged: true`） |
| `image` | 图片平面 |
| `video` | 视频平面 |

`pk_type` 面板约定：`[0,1,2]` 公共素材 · `3` 服饰 · `4` 场景素材 · **`5` 用户自定义**。

### 3.3 创建场景 `POST /sence/insert`

**单模型场景（最常用）：**

```json
{
  "json_data": {
    "objects": [
      {
        "type": "model",
        "url": "<与 materia_url 相同的 OSS 相对路径>",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1],
        "useDracoLoader": true
      }
    ],
    "cameraList": [
      {
        "position": { "x": 0, "y": 1.5, "z": 5 },
        "target": { "x": 0, "y": 0, "z": 0 },
        "fov": 50
      }
    ],
    "background": "color:#f0f0f0"
  },
  "sence_cover": "<可选，相对路径>"
}
```

**点云场景：**

```json
{
  "json_data": {
    "objects": [
      {
        "type": "splat",
        "url": "<xxx.rad 相对路径>",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1],
        "options": { "paged": true, "maxSplats": 500000 }
      }
    ]
  }
}
```

**图片 / 视频平面：**

```json
{
  "json_data": {
    "objects": [
      {
        "type": "image",
        "url": "<图片相对路径>",
        "position": [0, 1, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1],
        "baseWidth": 2
      }
    ]
  }
}
```

响应：`Scene`，关键字段 `sence_id`、`json_data`、`sence_cover`。

### 3.4 更新场景 `POST /sence/update`

```json
{
  "sence_id": 123,
  "json_data": { },
  "sence_cover": "sence_cover/cover_123.jpg?1700000000",
  "allow_copy": 1
}
```

前端保存行为对齐：

1. **add**：`insertScene({ json_data })` → 截图 OSS → `updateScene({ sence_id, sence_cover })` → 跳转详情  
2. **edit**：先截图，再 `updateScene({ sence_id, json_data, sence_cover? })`

### 3.5 其它常用

| 操作 | Path | Body |
|------|------|------|
| 取场景 | `POST /sence/id` | `{ sence_id }` |
| 删场景 | `POST /sence/delete` | `{ sence_id }` |
| 关联图鉴等 | `POST /sence/foreign/insert` | `{ sence_id, pk_type, pk_id }`（`pk_type`: 0 店铺 · 2 图鉴 · 3 场景本体投稿） |
| 编译 AR | `POST /ar/compile-mind` | `{ imageUrl, sceneId, name?, options? }`（需已有 sence_id） |

备用静态 JSON：`GET {BASE_IMG}/sence/json/{id}.json`（详情无 `json_data` 时）。

---

## 4. SceneJSON 字段速查（AI 构造用）

```ts
interface SceneJSON {
  objects: SceneObjectJSON[]          // 必需，可为 []
  walls?: GalleryWall[]               // XZ 墙体
  step?: SceneStepJSON[]              // 多分组/阶段
  cameraList?: CameraState[]          // 录制镜头
  background?: string                 // 图片 URL 或 "color:#rrggbb"
  lighting?: LightingConfig           // LightConfig[]
  controls?: { min/max Azimuth/Polar Angle }  // 弧度
  origin?: number                     // 克隆来源 sence_id
  arTarget?: { mindUrl, previewUrl, targetIndex?, name?, updatedAt? } | null
}
```

### 4.1 `objects[].type`

| type | 关键字段 |
|------|----------|
| `model` | `url`, `useDracoLoader`, `options`, `material`, `links`, `effect` |
| `character` | 同 model；`options.characterType.stand.primary` 必有 |
| `splat` | `url`；`options.fileType/maxSplats/paged` |
| `image` / `video` | `url`, `baseWidth?` |
| `diary` | `title`, `content` |
| `3Dtext` / `longtext` | `title`/`content`, `url`(字体), `options` |
| `library` | `library_id`, `cover`, `title` |
| `laxian` | `laxian_id`, `laxian_type`, `camera`, `frames` |
| `effect` | `effect_name`, `options` |
| `template` | `template_id` |
| `eztree` | `preset`, `seed`（场景已有 splat 时禁止加植物） |
| `canvas` | `options.canvas` |
| `box` / `sphere` / `voxelBlock` | `size` / `radius` / `color` |

通用变换：`id?`, `position`, `rotation`, `scale`, `renderOrder`。

### 4.2 灯光 `lighting[]`

`type`: `ambient` | `hemisphere` | `directional` | `fill` | `lens` | `spot` | `rim` | `back`  
颜色多为 **hex number**（如 `0xffffff`），不是 CSS 字符串。

默认可用最小集：

```json
"lighting": [
  { "type": "ambient", "color": 16777215, "intensity": 0.6 },
  { "type": "hemisphere", "skyColor": 16777215, "groundColor": 4473924, "intensity": 0.4, "position": [0, 50, 0] },
  { "type": "directional", "color": 16777215, "intensity": 0.8, "position": [5, 10, 7], "castShadow": true }
]
```

画质预设（`sceneGraphicsSettings` / `sceneRenderQuality`）是 **本地渲染设置，不写入场景 API**。

### 4.3 相机序列化注意

编辑器运行时 `CameraState.position/target` 是 `THREE.Vector3`；落库/传输时用 **普通对象或数组数值** 均可被加载逻辑消化，推荐：

```json
{ "position": { "x": 0, "y": 1.5, "z": 5 }, "target": { "x": 0, "y": 0, "z": 0 }, "fov": 50 }
```

---

## 5. 编辑器内放置规则（与 API 对齐）

`chooseMaterial` 优先级：`splat` → `model`（可升格 `character`）→ `video` → 否则 `image`。

- 模型：`useDracoLoader = options.useDracoLoader !== false`
- 角色：`options.characterType.stand.primary` 存在则 `type=character`；**同一 URL 角色禁止重复加载**
- 自定义上传面板：只接受 image / video / glb / gltf

---

## 6. 校验与坑

| 规则 | 说明 |
|------|------|
| 自定义上传格式 | 仅 image / video / glb / gltf |
| 管理页模型 | 单文件 gltf/glb，或 1 rad + N radc |
| `materia_url` | insert 时必填 |
| 植物 + 点云 | 场景已有 splat 时禁止加 eztree |
| AR | 须先保存拿到 `sence_id` |
| URL | **相对路径**；运行时 `BASE_IMG + url` |
| 克隆 | 源 `allow_copy=1`；`insertScene({ json_data, origin })` 注意 `origin` 在 json 内 |

---

## 7. 端到端检查清单（AI 做完自检）

- [ ] 模型已是 `.glb`/`.gltf`（或点云格式合法）
- [ ] OSS 上传成功，拿到相对 `file_url`
- [ ]（可选）`/material/insert` 成功，`assetKind` 正确
- [ ] `/sence/insert` 成功，返回 `sence_id`
- [ ] `json_data.objects[].url` 与上传路径一致，无多余域名
- [ ]（可选）`sence_cover` 已 update
- [ ] 用 `/scene/detail/{sence_id}` 能打开且模型可见

---

## 8. 代码地图（排障）

| 路径 | 职责 |
|------|------|
| `pages/scene/detail/[id].vue` | 编辑器、save/insert/clone、`chooseMaterial` |
| `pages/user/sence/index.vue` | 我的场景；新建 → `?add=1` |
| `pages/manage/Material.vue` | 素材 CRUD + glb/rad 上传 |
| `components/scene/Material.vue` | 素材面板 + 自定义上传 |
| `api/scene.ts` / `api/material.ts` | HTTP |
| `utils/ossUpload.ts` | OSS 直传 |
| `utils/materiaModelKind.ts` | model/splat/video 判别 |
| `utils/threeCore.ts` | `SceneJSON` 加载/保存 |
| `utils/gltfCoverSnapshot.ts` | glb/gltf 自动封面截图 |

---

## 9. 最短成功路径（复制即用）

```
1. 准备 my.glb
2. uploadFileToOSS(my.glb, 'material') → url
3. POST /material/insert {
     materia_title, materia_url: url, pk_type: 5, is_enable: 0, is_private: 0,
     options: { assetKind: 'model', useDracoLoader: true }
   }
4. POST /sence/insert {
     json_data: {
       objects: [{ type:'model', url, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], useDracoLoader:true }],
       cameraList: [{ position:{x:0,y:1.5,z:5}, target:{x:0,y:0,z:0} }]
     }
   }
5. 打开 /scene/detail/{sence_id}
```
