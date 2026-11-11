# Web ↔ 原生选图（图片 / Live / 视频）

面向 H5：如何触发 `openNativePicker`、接收 `nativePickerResult`、预览回显，再上传。  
通道为 **LoYanSheBridge**（与 checklist / `reloadHome` 同桥）。

| 壳 | 原生选图 / Live | 说明 |
| --- | --- | --- |
| **iOS** | 已接 | `canUseNativePicker()` 为真，走本文协议 |
| **Android** | **已接** | 同协议；`canUseNativePicker()` 含 Android 壳；细节见 [native-picker-android.md](./native-picker-android.md) |

---

## 步骤总览

```text
[H5] postMessage openNativePicker
        ↓
[iOS] 原生相册（图片 Tab 含 Live / 可切视频）
        ↓
[iOS] postToH5 nativePickerResult
        ↓
[H5] 按 requestId 匹配 → 转 File → 预览 → 走现有上传
```

---

## 1. Web 封装（推荐）

```ts
import {
  canUseNativePicker,
  pickFromNative,
  itemsToPreviewable,
  uploadNativeEntries,
} from '@/utils/nativePicker'

if (canUseNativePicker()) {
  const result = await pickFromNative({
    selectionLimit: 9,
    initialTab: 'image', // 'image' | 'video'
    allowLive: true,
    maxLiveDurationSec: 8,
  })
  if (result.cancelled) return
  if (result.error) throw new Error(result.error)
  const entries = itemsToPreviewable(result.items)
  // 预览 / 上传…
}
```

底层上行与手写一致：`postIosBridge({ type: 'openNativePicker', params })`。  
下行：`installWkStyleNativeBridge` 派发 `loyanshe-native`；`ensureNativePickerListeners` 按 `requestId` resolve。

**UI 接入**：`components/Qhx/ImagePicker.vue` 在壳内且**已声明选图能力**时走原生相册；否则同步回退 `<input type="file">`（保留用户手势）。

### 旧版兜底（重要）

旧版 iOS **也有** `LoYanSheBridge`，但没有 `openNativePicker`。若 Web 只判断「有桥」就异步等待回包：

1. 原生忽略消息 → Promise 一直挂起  
2. 即便超时后再 `input.click()`，**用户手势已丢失**，WKWebView 往往弹不出系统相册  

因此 Web 要求新版在打开 H5 时先声明能力（见下）；未声明 → **首次点击就同步走 input**，旧版可选图。

新版声明（任一即可）：

```json
{ "type": "setCapabilities", "params": { "nativePicker": true } }
```

或 `{ "type": "nativePickerReady" }`，或注入 `sessionStorage.native_picker='1'` / `window.__loNativePicker=true`，或 URL `?nativePicker=1`。

拉起相册后请立刻回（取消 Web 短超时，允许用户慢慢选）：

```json
{ "type": "nativePickerOpened", "params": { "requestId": "与请求一致" } }
```

---

## 2. 协议

### 2.1 上行 `openNativePicker`

```json
{
  "type": "openNativePicker",
  "params": {
    "requestId": "pick-…",
    "selectionLimit": 9,
    "initialTab": "image",
    "allowLive": true,
    "maxLiveDurationSec": 8
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `requestId` | 与回包匹配，必填（Web 自动生成） |
| `selectionLimit` | 最多张数 |
| `initialTab` | `image` \| `video` |
| `allowLive` | 图片 Tab 是否可选 Live |
| `maxLiveDurationSec` | Live / 短视频上限（默认 8） |

### 2.2 下行 `nativePickerOpened`（建议，拉起 UI 后立刻发）

```json
{
  "type": "nativePickerOpened",
  "params": { "requestId": "pick-…" }
}
```

### 2.3 下行 `nativePickerResult`

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-…",
    "cancelled": false,
    "error": null,
    "items": [ /* 见下 */ ]
  }
}
```

| 字段 | 含义 |
| --- | --- |
| `requestId` | 与请求一致 |
| `cancelled` | `true` = 用户取消，`items` 为空 |
| `error` | 失败文案（可选） |
| `items` | 选中条目 |

`base64` / `videoBase64` / `posterBase64` **无** `data:` 前缀。

#### Live 条目示例

```json
{
  "kind": "live",
  "mime": "image/jpeg",
  "fileName": "live_<ts>.jpg",
  "base64": "<封面JPEG>",
  "width": 0,
  "height": 0,
  "duration": 0,
  "videoMime": "video/mp4",
  "videoFileName": "live_<ts>.mp4",
  "videoBase64": "<配对视频>",
  "assetLocalIdentifier": "可选"
}
```

`kind`: `image` \| `live` \| `video`（视频可带 `posterBase64`）。

---

## 3. Base64 → File → 预览

`itemToPreviewable` / `itemsToPreviewable`：转 `File` + `URL.createObjectURL`。  
替换预览或离页时调用 `revokeNativePreviewEntries`。

---

## 4. 上传

推荐先转 `File`，再走现有 Web 上传（与 `<input type=file>` 同源），**不要**把整段 Base64 塞进业务接口。

| kind | 做法 |
| --- | --- |
| `image` | `uploadImageOSS(file)` |
| `live` | `uploadPairedLiveToOSS(videoFile, posterFile)` → 返回 `.mp4` 相对路径；封面同 basename `.jpg` |
| `video` | 有封面时按 Live 成对上传；否则自定义 `uploadVideoFile` |

`uploadNativeEntries(entries)` 可串行上传并 `join(',')` 对齐 `img_list`。

`QhxImagePicker` 路径：原生结果写入 `previewImages`（Live/视频进 `kind:'live'`），业务侧提交时与文件选择一致。

---

## 5. 注意

1. **仅「有桥 + 已声明 nativePicker 能力」**才走原生选图；旧版有桥无事件 → 同步 `<input>`，避免异步丢手势导致系统相册也弹不出。  
2. 已声明能力后若仍在短窗口内收不到 `nativePickerOpened` / `Result`，标记本会话 unsupported 并回退 input。  
3. 「拖拽图片到这里上传」仅桌面浏览器；手机 / 原生壳不显示。  
4. Live / 视频 Base64 体积大，尽快转 File 并上传。  
5. **`requestId` 必须匹配**。Android：[native-picker-android.md](./native-picker-android.md)。

---

## 6. 文件索引

| 路径 | 职责 |
| --- | --- |
| `utils/nativePicker.ts` | 开选 / 回包 / Base64→File / 上传辅助 |
| `utils/nativeShell.ts` | `postIosBridge`；下行派发 `loyanshe-native` |
| `components/Qhx/ImagePicker.vue` | iOS 壳接入预览回显 |
| `utils/ossUpload.ts` | `uploadImageOSS` / `uploadPairedLiveToOSS` |

---

## 7. 修订

| 日期 | 说明 |
| --- | --- |
| 2026-11-10 | 首版：H5 选图桥 + ImagePicker 接入 |
| 2026-11-10 | 标明 Android 未接；增补 Android 对接文档链接 |
| 2026-11-10 | 无桥 / post 失败回退 input；手机隐藏拖拽上传区 |
| 2026-11-10 | Android 已接；`canUseNativePicker` 含 Android |
| 2026-11-10 | 旧版有桥无事件：需能力声明才走原生；否则同步 input（保手势）；增 `nativePickerOpened` |
