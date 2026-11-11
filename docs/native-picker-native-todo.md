# 原生选图：iOS / Android 必改清单（发给客户端）

**读者**：iOS、Android  
**背景**：H5 已接 `openNativePicker` / `nativePickerResult`。旧版 App 也有 `LoYanSheBridge`，但没有选图事件；若 H5 只判断「有桥」就异步等回包，超时后再点 `<input>` 会丢掉用户手势，**系统相册也弹不出**。  
因此 Web 改为：**只有原生声明「支持选图」后，才走原生相册**；未声明则同步用系统文件选择（旧版不受影响）。

通道：现有 **`LoYanSheBridge`**（与 jump / back / `reloadHome` 同桥）。  
消息均为 **JSON 字符串**。

---

## 一句话结论

| 端 | 要改吗？ |
| --- | --- |
| **已实现选图 UI 的新版** | **要改**：补「能力声明」+ 建议补「已打开」回执 |
| **旧版（无选图）** | **不用发版**：不声明即可，H5 自动走 `<input>` |
| **协议字段**（`items` / Live Base64 等） | 已按现网即可；本文只补「开关」与时序 |

---

## 1. 必做：打开 Outlink / 加载 H5 后声明能力

在 WebView **首屏可点选图之前**，向 H5 下行一次（推荐）：

```json
{
  "type": "setCapabilities",
  "params": {
    "nativePicker": true
  }
}
```

等价任选其一（做一种即可）：

| 方式 | 示例 |
| --- | --- |
| 下行事件 | `{ "type": "nativePickerReady" }` |
| 注入 JS | `window.__loNativePicker = true` |
| sessionStorage | `sessionStorage.setItem('native_picker', '1')` |
| URL 参数 | Outlink URL 带 `nativePicker=1` |

**不声明 → H5 永远不会发 `openNativePicker`**，用户点选图走系统 `<input>`。

下行入口与现网一致，例如：

- iOS：`evaluateJavaScript` → `window.__loSendToH5?.(json)` 或 `__loOnNativeMessage?.(json)`
- Android：同上（现有 `postToH5`）

---

## 2. 必做：处理上行 `openNativePicker`

H5 会发：

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

| 字段 | 说明 |
| --- | --- |
| `requestId` | **原样带回**所有回包 |
| `selectionLimit` | 最多张数 |
| `initialTab` | `image` \| `video` |
| `allowLive` | `false` 时只出静帧，不要动图/Live |
| `maxLiveDurationSec` | Live/短视频时长上限（默认 8 秒） |

收到后打开原生相册；**不要**当成未知 type 直接丢弃且不回包。

---

## 3. 强烈建议：相册 UI 一出来就回 `nativePickerOpened`

```json
{
  "type": "nativePickerOpened",
  "params": {
    "requestId": "pick-1730000000000-ab12cd"
  }
}
```

作用：告诉 H5「原生已接住」，取消约 **1s** 的短超时，用户可以慢慢选。  
若已通过 §1 声明能力，即使稍晚发 opened 一般也没问题；**仍建议一打开就发**，时序更稳。

---

## 4. 必做：结束时回 `nativePickerResult`

### 4.1 用户取消（也必须回，否则 H5 一直等）

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-…",
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
    "requestId": "pick-…",
    "error": "需要相册权限",
    "items": []
  }
}
```

### 4.3 成功

`base64` / `videoBase64` / `posterBase64`：**不要**带 `data:...;base64,` 前缀。

**静帧**

```json
{
  "kind": "image",
  "mime": "image/jpeg",
  "fileName": "img_xxx.jpg",
  "base64": "<纯Base64>",
  "width": 1080,
  "height": 1440
}
```

**Live / 动图 / Motion Photo**（封面 JPEG + 配对 MP4）

```json
{
  "kind": "live",
  "mime": "image/jpeg",
  "fileName": "live_xxx.jpg",
  "base64": "<封面>",
  "duration": 2.5,
  "videoMime": "video/mp4",
  "videoFileName": "live_xxx.mp4",
  "videoBase64": "<配对视频>"
}
```

**视频 Tab**（建议带封面）

```json
{
  "kind": "video",
  "mime": "video/mp4",
  "fileName": "vid_xxx.mp4",
  "base64": "<视频>",
  "duration": 5.0,
  "posterBase64": "<可选封面>",
  "posterMime": "image/jpeg"
}
```

完整成功包：

```json
{
  "type": "nativePickerResult",
  "params": {
    "requestId": "pick-…",
    "cancelled": false,
    "items": [ /* 上列 1..N 条 */ ]
  }
}
```

---

## 5. 时序（复制给实现同学）

```text
1. WebView 加载 H5 完成（或即将可交互）
2. Native → H5   setCapabilities { nativePicker: true }     【必做】
3. 用户点选图
4. H5 → Native   openNativePicker { requestId, ... }
5. Native 弹出相册
6. Native → H5   nativePickerOpened { requestId }           【强烈建议】
7. 用户选完 / 取消
8. Native → H5   nativePickerResult { requestId, ... }      【必做，含取消】
```

---

## 6. 分端检查清单

### iOS

- [ ] Outlink / WKWebView 加载后发送 `setCapabilities.nativePicker=true`（或等价声明）
- [ ] `LoYanSheBridge` 分发 `openNativePicker`
- [ ] 弹出 PHPicker / 自研相册后立刻 `nativePickerOpened`
- [ ] 完成/取消都回 `nativePickerResult`，`requestId` 一致
- [ ] Live：封面 + 配对视频两条 Base64；时长 > `maxLiveDurationSec` 不入选或回 `error`
- [ ] `allowLive=false` 时不提供 Live

### Android

- [ ] 同上能力声明（加载 Outlink 后）
- [ ] 处理 `openNativePicker`（Photo Picker / 自研）
- [ ] `nativePickerOpened` + `nativePickerResult`（含取消）
- [ ] Motion Photo / 厂商动图导出为 `kind:live`（JPEG 封面 + MP4）
- [ ] 权限拒绝回 `error`，不要静默

---

## 7. 验收（两端各测一遍）

1. **新包 + 已声明能力**：点选图 → 原生相册 → 选图/Live → H5 预览正常 → 可发布。  
2. **取消**：关相册 → H5 无卡死，可再次点选。  
3. **旧包 / 不声明能力**：点选图 → **系统文件选择能弹出**（不是没反应）。  
4. **连续点两次**：`requestId` 不串单。  
5. 发帖 `allowLive` 关的位置：只能静帧。

---

## 8. 不必改 / 不要做

- 不必为旧版发「空实现」的 `openNativePicker`（不声明能力即可）。  
- 不要用 `BackAndReload` 代替选图回包。  
- 不要把整段 Base64 写进业务 HTTP；H5 会转 `File` 再走现有 OSS 上传。  
- 未知字段忽略，缺 `community_id` 类字段不要崩溃（选图协议不依赖它们）。

---

## 9. 相关文档（可选深入）

| 文档 | 内容 |
| --- | --- |
| [native-picker-bridge.md](./native-picker-bridge.md) | H5 侧完整协议与兜底说明 |
| [native-picker-android.md](./native-picker-android.md) | Android 动图/实现细节 |

---

## 修订

| 日期 | 说明 |
| --- | --- |
| 2026-11-10 | 首版：给 iOS/Android 的必改清单（能力声明 + opened + result） |
