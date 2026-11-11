# 原生主页刷新桥：`reloadHome`

给网页端 / 原生（iOS · Android）对齐用。  
**不要用** `BackAndReload` 代替本事件：`BackAndReload` 只刷新**外链 H5 上一层**，不会动原生首页 feed。

---

## 1. 通道

| 壳 | 上行方式 | 识别 |
| --- | --- | --- |
| **iOS** | `webkit.messageHandlers.LoYanSheBridge.postMessage(JSON)` | `client=ios` / `sessionStorage.ios_webview` |
| **Android** | 同名 `LoYanSheBridge`（webkit shim / JavascriptInterface） | `client=android` / `sessionStorage.android_webview` |
| **鸿蒙** | MessagePort（与现网 jump/back 相同） | port 已建连 |

推荐统一调用（已封装）：

```ts
import { nativeReloadHome } from '@/utils/nativeShell'

// 发帖成功
nativeReloadHome({ reset: true, community_id: id })

// 删帖成功
nativeReloadHome({ reset: false })
```

等价手写信封：

```json
{
  "type": "reloadHome",
  "params": {
    "reset": true,
    "community_id": 12345
  }
}
```

---

## 2. 协议

### 2.1 发帖成功（重置主页）

```json
{
  "type": "reloadHome",
  "params": {
    "reset": true,
    "community_id": <number>
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `"reloadHome"` | 是 | 固定 |
| `params.reset` | `true` | 是 | 主页 feed **回第 1 页**重拉 |
| `params.community_id` | `number` | 建议 | 新帖 id，便于原生高亮 / 定位 |

**原生行为（约定）**

1. 原生首页社区流重置到第 1 页并重拉。
2. **不**要求关掉当前 Outlink；关壳另发 `back`（见下）。
3. **不要**再发 `BackAndReload` 指望刷主页。

**建议时序（发帖页）**

1. API 发帖成功  
2. `nativeReloadHome({ reset: true, community_id })`  
3. `nativeBack()` / `navigateBackInShell()` 关闭发帖 Outlink  

参考：`components/community/PostEditor.vue`（发 `reloadHome`）+ `pages/community/post.vue`（关壳）。

### 2.2 删帖成功（保页重拉）

```json
{
  "type": "reloadHome",
  "params": {
    "reset": false
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `params.reset` | `false` | 是 | **保页**：尽量保留已加载窗口重拉，不强制滚回顶 |
| `params.community_id` | — | 否 | 删帖可不传 |

**原生行为（约定）**

1. 按当前已加载页窗口重拉 feed（去掉已删帖）。  
2. 尽量不重置滚动到顶部。  
3. 关详情 Outlink：再发 plain `back`（**不要** `BackAndReload`）。

**建议时序（详情删帖）**

1. API 删帖成功  
2. `nativeReloadHome({ reset: false })`  
3. iOS / Android：`navigateBackInShell()`（无 reload）  
4. Uni / 鸿蒙过渡期仍可 `navigateBackInShell({ reload: true })`，待壳接上 `reloadHome` 后统一为 plain back  

参考：`pages/community/detail/[id].vue` → `navigateAfterCommunityDelete`。

---

## 3. 与旧事件对比

| type | 作用对象 | 典型场景 | 是否替代 `reloadHome` |
| --- | --- | --- | --- |
| `back` | 关闭当前 Outlink | 取消发帖、删帖后关详情 | 否（可配合使用） |
| `BackAndReload` | 上一层 **H5** 收 `{type:reload}` | 外链栈内互相刷新 | **否**，不能刷原生主页 |
| `reload`（壳→H5） | 当前 H5 | 子页 pop 后刷父 H5 | 否 |
| **`reloadHome`** | **原生主页 feed** | 发帖重置 / 删帖保页 | — |

---

## 4. Web 接入清单

| 场景 | 文件（参考） | 调用 |
| --- | --- | --- |
| 社区发帖 | `PostEditor.vue` | `nativeReloadHome({ reset: true, community_id })` |
| 发帖页关壳 | `pages/community/post.vue` | iOS/Android：`nativeBack()` |
| 年度总结发帖 | `yearlySummary/PostModal.vue` | 同上 `reset: true` |
| 社区删帖 | `pages/community/detail/[id].vue` | `nativeReloadHome({ reset: false })` + plain back |

工具函数：`utils/nativeShell.ts` → `nativeReloadHome` / `NativeReloadHomeParams`。

**Web 状态（2026-11-10）**：上表路径已落地；iOS / Android 经 `LoYanSheBridge` 发出，鸿蒙经 MessagePort 同步发出。

---

## 5. Outlink UI：原生返回按钮留位

iOS **与** Android Outlink 均由原生绘制左上角返回，H5 **不要**再叠一层可点返回，且左侧内容须让位。

| 做法 | 说明 | 参考 |
| --- | --- | --- |
| 工具栏左垫 | `needsNativeBackSlot()` 为真时加 `pl-11` | `pages/user/plan.vue`、`pages/journal/[id].vue` |
| 隐藏自绘返回、保留槽 | `invisible pointer-events-none`，布局占位仍在 | `pages/clothes/detail`、`pages/wardrobe/detail` |

```ts
import { needsNativeBackSlot } from '@/utils/nativeShell'
// needsNativeBackSlot() === isIosWebview() || isAndroidWebview()
```

- **不要**只判断 iOS：Android 同样有原生返回。  
- 状态栏高度仍走 `?statusbar=` → `configStore.statusBarHeight`，与返回留位是两件事。

---

## 6. 原生接入提示（给 iOS / Android）

解析 `type === "reloadHome"` 后读 `params`：

```text
reset == true  → 主页 feed 重置到 page=1 重拉；可选高亮 community_id
reset == false → 保页重拉（重拉已加载页窗口 / 等价本地刷新且尽量保滚动）
```

- 本事件**独立于** Outlink 返回栈；通常与随后的 `back` 组合。  
- 未知字段忽略，勿因缺 `community_id` 崩溃。  
- Android 已接：`HomeReloadStore` + `HomeViewModel.applyBridgeReload`。  
- iOS：按本 MD 在 `OutlinkBridge` 增加同名 type 后接到 `HomeViewModel`。

---

## 7. 验收

1. 原生壳内发帖成功 → 关发帖页回到主页 → 列表第 1 页出现新帖（或顶部刷新）。  
2. 原生壳内删帖成功 → 关详情 → 主页列表更新且**不**无故滚回顶。  
3. 仅 `BackAndReload`、不发 `reloadHome` 时，原生主页 feed **不变**（回归旧行为）。  
4. 浏览器（非壳）发帖/删帖不依赖本事件，站内路由照旧。  
5. iOS / Android Outlink：左上角原生返回不与 H5 按钮重叠（计划 / 手账 `pl-11`；衣柜 / 服饰详情隐藏自绘返回）。

---

## 8. 修订

| 日期 | 说明 |
| --- | --- |
| 2026-11-10 | 首版：发帖 `reset:true` / 删帖 `reset:false`；与 `BackAndReload` 职责拆分 |
| 2026-11-10 | Web 清单落地；补充 iOS/Android 原生返回留位（`needsNativeBackSlot`） |
