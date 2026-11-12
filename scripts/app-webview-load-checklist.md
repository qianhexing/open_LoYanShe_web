# App WebView 加载验收清单

面向「每个页面独立冷启动」的回归检查（不做路由预取）。

## 本地体积

```bash
pnpm analyze
```

关注：

- entry / layout 是否仍含 `gsap`、`three`、`@tiptap`
- `pages/library/detail`、`clothes/detail`、`journal`、`wardrobe/detail` 的 route chunk 是否明显变小
- 重库是否落在 `vendor-three` / `vendor-gsap` / `vendor-tiptap` 等独立 chunk，且仅被用到的页请求

## 真机 WebView

用 `?client=ios`（或 android）+ `token` 打开：

1. `/community/detail/:id`（标杆）
2. `/library/detail/:id`
3. `/clothes/detail/:id`
4. `/journal/:id`
5. `/wardrobe/detail/:id`

期望：

- 无 Header/Footer
- 首屏尽快出骨架/正文
- Network 中未交互前不出现 three / tiptap / mind-ar（除非该页首屏必须）
- 评论区 / 分享 / 发帖在 idle 或打开后再出现对应 chunk

## 发布

```bash
pnpm build && pnpm deploy:assets
```

确认生产 `cdnURL` 与 App WebView 资源域名一致。
