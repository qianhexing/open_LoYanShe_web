# Android 原生选图对接（图片 / Live·动图 / 视频）

给 **Android 原生** 对齐用。  
协议与 iOS **完全一致**，通道同为 **`LoYanSheBridge`**（与 `reloadHome` / Outlink 同桥）。

---

## 0. 现状（Web）

| 项 | 状态 |
| --- | --- |
| iOS / Android 原生选图 | 协议已接；Web 仅在**已声明能力**时调用 |
| Web 开关 | `canUseNativePicker()` = 有桥 **且** `nativePicker` 能力已声明 |
| 旧版有桥无事件 | 不调原生，**同步** `<input>`（避免异步丢手势弹不出相册） |

H5 侧详见：[native-picker-bridge.md](./native-picker-bridge.md)。

**加载 Outlink 后请立刻声明能力**（否则 H5 不会发 `openNativePicker`）：

```json
{ "type": "setCapabilities", "params": { "nativePicker": true } }
```

拉起相册后立刻：`{ "type": "nativePickerOpened", "params": { "requestId": "..." } }`。

Android 实现索引：`app/.../picker/NativePickerHost.kt` 等；`openNativePicker` → `nativePickerOpened` → `nativePickerResult`。

---

## 1. 通道

| 方向 | 方式 |
| --- | --- |
| H5 → Native | `window.LoYanSheBridge.postMessage(JSON字符串)` 或 `webkit.messageHandlers.LoYanSheBridge.postMessage(...)` |
| Native → H5 | 调用页内 `__loSendToH5(str)` / `__loOnNativeMessage(str)`（与现网 Outlink 下行一致） |

识别壳：`client=android` / `sessionStorage.android_webview`。

消息体均为 **JSON 字符串**，形如：

```json
{ "type": "<事件名>", "params": { ... } }
```

---

## 2. 流程

```text
[H5]  type: openNativePicker   params: { requestId, selectionLimit, ... }
        ↓
[Android] 打开系统/自研相册（图 / 动图·Motion / 视频）
        ↓
[Android] type: nativePickerResult  params: { requestId, cancelled?, error?, items? }
        ↓
[H5] 按 requestId 匹配 → Base64 转 File → ImagePicker 预览 → OSS 上传
```

**必须**：回包 `requestId` 与请求一致；用户取消也要回包（`cancelled: true`），否则 H5 Promise 一直挂起。

---

## 3. 上行：`openNativePicker`（H5 → Android）

Android `LoYanSheBridge` / WebView 客户端收到后解析：

```json
{
  "type": "openNativePicker",
  "params": {
    "requestId": "pick-1730000000000-ab12cd",
    "selectionLimit": 9,
    "initialTab": "image",
    "allowLive": true,
    "maxLiveDurationSec": 8
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `"openNativePicker"` | 是 | 固定 |
| `params.requestId` | string | 是 | 原样带回 |
| `params.selectionLimit` | number | 建议 | 最多可选张数，默认按 9 |
| `params.initialTab` | `"image"` \| `"video"` | 否 | 默认 `image` |
| `params.allowLive` | boolean | 否 | 默认 `true`；`false` 时只出静帧图 |
| `params.maxLiveDurationSec` | number | 否 | Live/短视频时长上限，默认 **8** |

### Android 建议行为

1. 收到后打开相册 / Photo Picker（可自研多选页）。  
2. `initialTab === "image"`：图片库；`allowLive === true` 时允许选 **动图 / Motion Photo / 厂商 Live**（需能导出封面 JPEG + 配对短视频）。  
3. `initialTab === "video"`：视频库；时长超过 `maxLiveDurationSec` 应拦截或回 `error`。  
4. `allowLive === false`：禁止动图配对，只回 `kind: "image"`。  
5. 多选不超过 `selectionLimit`。  
6. 未知字段忽略，勿因缺字段崩溃。

---

## 4. 下行：`nativePickerResult`（Android → H5）

通过现有下行把 **整段 JSON 字符串** 交给 H5：

```kotlin
// 示意：与现网 postToH5 / evaluateJavascript 一致
val payload = """{"type":"nativePickerResult","params":{...}}"""
webView.postToH5(payload)
// 等价调用页面：
// window.__loSendToH5?.(payload) 或 window.__loOnNativeMessage?.(payload)
```

### 4.1 取消

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-1730000000000-ab12cd",
    "cancelled": true,
    "items": []
  }
}
```

### 4.2 失败

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-1730000000000-ab12cd",
    "cancelled": false,
    "error": "权限被拒绝",
    "items": []
  }
}
```

### 4.3 成功（`items`）

`base64` / `videoBase64` / `posterBase64` **不要**带 `data:image/jpeg;base64,` 前缀，只传纯 Base64。

#### `kind: "image"`（静帧）

```json
{
  "kind": "image",
  "mime": "image/jpeg",
  "fileName": "img_xxx.jpg",
  "base64": "<JPEG>",
  "byteLength": 12345,
  "width": 1080,
  "height": 1440
}
```

#### `kind: "live"`（封面 + 配对视频）— 对应 iOS Live / Android 动图·Motion Photo

```json
{
  "kind": "live",
  "mime": "image/jpeg",
  "fileName": "live_xxx.jpg",
  "base64": "<封面JPEG>",
  "byteLength": 0,
  "width": 1080,
  "height": 1440,
  "duration": 2.5,
  "videoMime": "video/mp4",
  "videoFileName": "live_xxx.mp4",
  "videoBase64": "<配对MP4>",
  "videoByteLength": 0,
  "assetLocalIdentifier": "可选-媒体库id"
}
```

约定：

- **封面** → `base64` + `fileName`（`.jpg`）  
- **配对视频** → `videoBase64` + `videoFileName`（优先 `.mp4`，H5 上传会按 mp4 存）  
- `duration`：秒，超过 `maxLiveDurationSec` 的不要放进 `items`（或整次 `error`）  
- Web 上传：`uploadPairedLiveToOSS(video, poster)`，`img_list` 只写 **mp4 相对路径**，封面同 basename `.jpg`

#### `kind: "video"`（视频 Tab）

```json
{
  "kind": "video",
  "mime": "video/mp4",
  "fileName": "vid_xxx.mp4",
  "base64": "<视频>",
  "duration": 5.0,
  "posterBase64": "<可选封面JPEG>",
  "posterMime": "image/jpeg"
}
```

有 `posterBase64` 时 H5 按 Live 成对上传；无封面时 H5 会自行抽帧（仍建议原生带封面，省内存）。

### 4.4 完整成功包示例

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-1730000000000-ab12cd",
    "cancelled": false,
    "items": [
      {
        "kind": "image",
        "mime": "image/jpeg",
        "fileName": "a.jpg",
        "base64": "...."
      },
      {
        "kind": "live",
        "mime": "image/jpeg",
        "fileName": "live_b.jpg",
        "base64": "....",
        "videoMime": "video/mp4",
        "videoFileName": "live_b.mp4",
        "videoBase64": "....",
        "duration": 1.8
      }
    ]
  }
}
```

---

## 5. Android 实现要点

### 5.1 动图 / Motion Photo → `kind: "live"`

各厂商容器不一（Google Motion Photo XMP、三星、小米等）。对接目标不是统一解码库，而是 **导出两份二进制再 Base64**：

1. 静帧封面 → JPEG  
2. 内嵌/旁路短视频 → MP4（或转码为 mp4）  

导出失败则降级为 `kind: "image"`（只回封面），或提示用户「无法读取动图」并回 `error` / 跳过该项。

### 5.2 体积与内存

- 多选 Live 时 Base64 膨胀明显；建议限制单次张数、压缩封面、视频转码码率。  
- 回包后尽快释放原生侧临时文件；H5 也会马上转 `File` 上传。  
- 单条过大导致 WebView 卡死时，可改为：原生先上传 OSS 再回相对路径——**当前协议未支持**，需另开 type；首版仍按 Base64 对齐 iOS。

### 5.3 权限

`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`（或旧版存储权限）拒绝时回：

```json
{ "type": "nativePickerResult", "params": { "requestId": "...", "error": "需要相册权限", "items": [] } }
```

### 5.4 与现有 Bridge 注册

在现有 `LoYanSheBridge` / Outlink 消息分发里增加：

```text
when (type) {
  "openNativePicker" -> NativePickerActivity.launch(params)
  "reloadHome" -> ... // 已有
  "back" / "jump" -> ...
}
```

选完后 **只发** `nativePickerResult`，不要误发 `BackAndReload`。

### 5.5 语言

相册 UI 语言跟 App `lang`；H5 URL `lang=zh|en` 约定不变。

---

## 6. 验收清单（Android）

1. H5（`client=android`）发帖页点选图 → 原生相册打开（不是系统文件管理器裸 `<input>`）。  
2. 选 1 张静帧 → H5 预览正常 → 发布后图可看。  
3. 选 1 张动图/Motion（`allowLive: true`）→ 回 `kind:live` 含封面+视频 → H5 显示 LIVE 角标 → 发布后可播。  
4. 选视频 Tab 且时长 ≤ 8s → 成功；> 8s → 拦截或 `error`。  
5. 用户取消 → `cancelled: true`，H5 无报错、可再次打开。  
6. `requestId` 连续打开两次不串单。  
7. `allowLive: false` 的选图位（如衣柜封面）只能出静帧。

---

## 7. Web 启用条件

`canUseNativePicker()` 现为：

- 有 `LoYanSheBridge`（或壳标记）
- **且** 已声明 `nativePicker` 能力（`setCapabilities` / `nativePickerReady` / `?nativePicker=1` 等）
- **且** 本会话未标记 `native_picker_unsupported`

未声明能力时 H5 **不会**发 `openNativePicker`，点选图同步打开系统 `<input>`。  
上行仍走 `postIosBridge`（Android 同名桥），协议字段不变。

---

## 8. 修订

| 日期 | 说明 |
| --- | --- |
| 2026-11-10 | 首版：Android 选图 / Live 对接说明 |
| 2026-11-10 | Android 落地 |
| 2026-11-10 | 能力声明 + `nativePickerOpened`；旧版有桥无事件同步回退 input |
