# Nuxt 静态资源 CDN（image.lolitalibrary.com/tool/nuxt）

生产构建后，HTML 仍由 Node/Nuxt 提供；`_nuxt` 等静态资源通过 `app.cdnURL` 指向：

`https://image.lolitalibrary.com/tool/nuxt/`

对应 OSS 对象前缀：`tool/nuxt/`（例如本地 `.output/public/_nuxt/xxx.js` → OSS `tool/nuxt/_nuxt/xxx.js`）。

## 发布顺序

1. `pnpm build`
2. `pnpm deploy:assets`（把 `.output/public` 同步到 OSS `tool/nuxt/`）
3. 再发布 / 重启 Node 上的 Nuxt 服务

必须先传资源再切 HTML，否则新 HTML 会引用尚未上传的哈希 chunk。

## 环境变量（`deploy:assets`）

| 变量 | 说明 |
|------|------|
| `OSS_REGION` | 必填，如 `oss-cn-hangzhou` |
| `OSS_ACCESS_KEY_ID` | 必填 |
| `OSS_ACCESS_KEY_SECRET` | 必填 |
| `OSS_BUCKET` | 必填，`image.lolitalibrary.com` 对应桶 |
| `OSS_PREFIX` | 可选，默认 `tool/nuxt` |
| `NUXT_PUBLIC_DIR` | 可选，默认 `.output/public` |
| `OSS_ENDPOINT` | 可选，自定义 endpoint |
| `DRY_RUN=1` | 只列出将上传文件 |
| `NUXT_APP_CDN_URL` | 可选，覆盖默认 CDN；空字符串可关闭 CDN |

开发环境不设 `cdnURL`，资源仍走本机 `/_nuxt`。

## 缓存建议（脚本已按此设置）

| 路径 | Cache-Control |
|------|----------------|
| `_nuxt/` 下带 content hash 的文件 | `public, max-age=31536000, immutable` |
| 其它 public 文件（无 hash / 根资源） | `public, max-age=60, must-revalidate` |

HTML 由 Node 输出，勿对 HTML 做长缓存。

## OSS CORS（必配）

页面在 `lolitalibrary.com`（及 `www` 等），资源在 `image.lolitalibrary.com`。模块脚本、字体、部分 CSS 请求需要跨域，请在 OSS/CDN 为该桶配置 CORS，至少允许：

- **来源**：`https://lolitalibrary.com`、`https://www.lolitalibrary.com`（按实际主站域名补全；开发可加 `http://localhost:3000`）
- **方法**：`GET`、`HEAD`
- **Headers**：`*`（或至少 `Origin`、`Range`）
- **暴露 Headers**：按需（如 `ETag`、`Content-Length`）
- **Max-Age**：可设 `86400`

未开 CORS 时，常见症状是 JS 能加载但字体 / `type=module` 资源控制台报 CORS 错误。

## 旧资源清理

哈希文件名可长期保留；无人引用的旧 `_nuxt` chunk 可定期清理，避免桶膨胀。不要在新版本未全量发布前删除仍被旧 HTML 引用的文件。
