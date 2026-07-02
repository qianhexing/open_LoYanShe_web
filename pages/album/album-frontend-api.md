# 打卡相册（成就簿）前端对接文档

> 所有接口均为 `POST`，请求头需携带 `Authorization: <登录 token>`。

---

## 一、前端需要实现的页面

| 页面 | 说明 |
|------|------|
| **我的打卡目标** | 展示系统成就、我创建的、我订阅的母相册 |
| **相册市场** | 浏览他人公开分享的打卡相册，可预览并添加 |
| **相册详情** | 母相册信息 + 子打卡目标列表 + 打卡进度 |
| **新建打卡相册** | 创建母相册 + 多个子打卡目标 |
| **编辑打卡相册** | 仅可编辑自己创建的相册 |
| **打卡操作** | 对单个子目标完成打卡（上传图片/关联业务数据） |

---

## 二、接口一览

| 功能 | 路径 |
|------|------|
| 我的打卡目标列表 | `POST /album/list` |
| 仅我创建的 | `POST /album/list`（`list_type: owned`） |
| 仅我订阅的 | `POST /album/list`（`list_type: subscribed`） |
| 相册市场 | `POST /album/discover` |
| 相册详情 | `POST /album/detail` |
| 子打卡目标列表 | `POST /album/list`（传 `parent_id`） |
| 新建相册 | `POST /album/insert` |
| 编辑相册 | `POST /album/update` |
| 删除自己的相册 | `POST /album/delete` |
| 添加到我的目标 | `POST /album/subscribe` |
| 取消订阅 | `POST /album/unsubscribe` 或 `POST /album/subscribe/delete` |
| 打卡（新增） | `POST /album/foregin/insert` |
| 打卡（更新） | `POST /album/foregin/update` |
| 成就统计 | `POST /album/achievement/stats` |

---

## 三、核心字段说明

### 母相册 / 子目标通用字段

| 字段 | 说明 |
|------|------|
| `album_id` | 相册 ID |
| `parent_id` | `0` = 母相册；非 0 = 子打卡目标 |
| `album_title` | 标题 |
| `album_cover` | 封面 URL |
| `album_desc` | 描述 |
| `is_private` | `0` 公开（可进市场） / `1` 私有（仅本人） |
| `user_id` | 创建者；空或 `0` 为系统成就 |
| `pk_type` | 打卡关联类型（子目标必填） |
| `sort` | 排序，越大越靠前 |

### 列表返回扩展字段（仅母相册列表）

| 字段 | 值 | 说明 |
|------|-----|------|
| `source_type` | `system` | 系统成就 |
| | `owned` | 我创建的 |
| | `subscribed` | 我订阅（从市场添加） |
| | `public` | 公开但未订阅（市场浏览时） |
| `is_subscribed` | boolean | 是否已添加进我的目标 |

### pk_type 参考

| 值 | 含义 |
|----|------|
| 0 | 服饰 / 图片打卡（需传 `cover`） |
| 1 | 帖子类 |
| 2 | 服饰 |
| 3 | 搭配 |
| 4 | 图鉴 |
| 5 | 计划 |

---

## 四、页面调用指南

### 1. 我的打卡目标（首页）

**全部（系统 + 自建 + 已订阅）：**

```json
POST /album/list
{
  "parent_id": 0,
  "page": 1,
  "pageSize": 20
}
```

**Tab：我创建的**

```json
{
  "parent_id": 0,
  "list_type": "owned",
  "page": 1,
  "pageSize": 20
}
```

**Tab：已添加（订阅）**

```json
{
  "parent_id": 0,
  "list_type": "subscribed",
  "page": 1,
  "pageSize": 20
}
```

点击相册进入子目标：

```json
{
  "parent_id": 100,
  "page": 1,
  "pageSize": 50
}
```

---

### 2. 相册市场

**市场列表：**

```json
POST /album/discover
{
  "page": 1,
  "pageSize": 20
}
```

**预览母相册：**

```json
POST /album/detail
{ "album_id": 100 }
```

**预览子打卡目标：**

```json
POST /album/list
{ "parent_id": 100, "page": 1, "pageSize": 50 }
```

**添加到我的打卡目标：**

```json
POST /album/subscribe
{
  "album_id": 100,
  "sort": 0
}
```

| 错误信息 | 处理建议 |
|----------|----------|
| 系统成就无需添加 | 系统相册已在「我的目标」中，隐藏添加按钮 |
| 无需添加自己的成就簿 | 自己的相册不需要订阅 |
| 该成就簿为私有，无法添加 | 不可添加 |
| 已添加 | 显示「已添加」，提供移除入口 |

**取消订阅（从我的目标移除，不删原相册）：**

```json
POST /album/unsubscribe
{ "album_id": 100 }
```

（兼容旧路径：`POST /album/subscribe/delete`）

**响应：**

```json
{
  "code": 200,
  "data": { "album_id": 100, "is_subscribed": false }
}
```

| 错误信息 | 说明 |
|----------|------|
| 未添加该成就簿 | 当前未订阅，无需取消 |

---

### 3. 新建打卡相册

```json
POST /album/insert
{
  "album_title": "我的 Lolita 打卡",
  "album_cover": "https://...",
  "album_desc": "描述",
  "is_private": 0,
  "sort": 0,
  "children": [
    {
      "album_title": "购入第一套裙子",
      "album_cover": "https://...",
      "pk_type": 0,
      "target_num": 1,
      "points_num": 10,
      "conditions": { "logic": "AND", "rules": [] },
      "conclusion": "达成说明",
      "sort": 1
    }
  ]
}
```

- `is_private` 默认 `1`（私有）；**分享到市场需传 `0`**
- `children` 至少 1 项，每项必须有 `album_title`、`pk_type`

---

### 4. 编辑打卡相册

仅**本人创建的母相册**可编辑。

```json
POST /album/update
{
  "album_id": 100,
  "album_title": "新标题",
  "album_cover": "https://...",
  "album_desc": "新描述",
  "is_private": 0,
  "sort": 0,
  "children": [
    {
      "album_id": 101,
      "album_title": "修改已有目标",
      "pk_type": 0,
      "target_num": 1,
      "sort": 2
    },
    {
      "album_title": "新增的目标",
      "pk_type": 0,
      "target_num": 1,
      "sort": 1
    }
  ],
  "delete_child_ids": [102]
}
```

| 字段 | 说明 |
|------|------|
| `album_id` | 必填，母相册 ID |
| 母相册字段 | 传什么改什么，不传则不变 |
| `children` | 可选；有 `album_id` 为更新，无则为新增 |
| `delete_child_ids` | 可选；要删除的子目标 ID 数组（软删除） |

**注意：**

- 改为私有（`is_private: 1`）会自动清除所有用户的订阅
- 作者删除母相册后，订阅者无法再查看

---

### 5. 删除

**删除自己创建的相册：**

```json
POST /album/delete
{ "album_id": 100 }
```

- 传**母相册 ID**：删除母相册 + 全部子目标，并清除所有订阅
- 传**子目标 ID**：仅删除该子项

**移除市场添加的相册（不删原相册）：**

```json
POST /album/subscribe/delete
{ "album_id": 100 }
```

---

### 6. 子目标打卡

**首次打卡：**

```json
POST /album/foregin/insert
{
  "album_id": 101,
  "cover": "https://...",
  "note": "备注",
  "pk_type": 0,
  "pk_id": 12345
}
```

**更新打卡：**

```json
POST /album/foregin/update
{
  "album_id": 101,
  "cover": "https://...",
  "note": "备注"
}
```

- `pk_type === 0` 时 `cover` 必填
- 子目标列表中查看 `album_foreign`（打卡记录）、`is_achieved`、`progress`

---

## 五、前端 UI 建议

```
打卡相册
├── 我的目标
│   ├── Tab：全部 / 我创建的 / 已添加
│   └── 进入 → 子目标列表 → 打卡
├── 相册市场
│   ├── 列表（/album/discover）
│   ├── 详情预览（/album/detail + /album/list）
│   └── [添加进我的目标]（/album/subscribe）
└── 管理（仅 source_type === 'owned'）
    ├── 新建（/album/insert）
    ├── 编辑（/album/update）
    └── 删除（/album/delete）
```

**按钮显示逻辑：**

| 场景 | 显示 |
|------|------|
| `source_type === 'system'` | 无添加/编辑/删除 |
| `source_type === 'owned'` | 编辑、删除 |
| `source_type === 'subscribed'` | 移除订阅 |
| 市场预览且未订阅 | 添加进我的目标 |
| `is_private === 1` 且非本人 | 不可见、不可添加 |

---

## 六、响应格式

成功：

```json
{
  "code": 200,
  "data": { ... },
  "message": "success"
}
```

失败（HTTP 422 等）：

```json
{
  "code": 422,
  "message": "错误说明"
}
```

列表分页：

```json
{
  "code": 200,
  "data": {
    "count": 100,
    "rows": [ ... ]
  }
}
```
