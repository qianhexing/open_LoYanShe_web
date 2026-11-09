/**
 * 将 Nuxt 构建产物 `.output/public` 同步到 OSS 前缀 `tool/nuxt/`，
 * 与 `nuxt.config.ts` 的 `app.cdnURL`（https://image.lolitalibrary.com/tool/nuxt/）对齐。
 *
 * 用法：
 *   pnpm build && pnpm deploy:assets
 *
 * 环境变量（必填）：
 *   OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET
 * 可选：
 *   OSS_PREFIX          默认 tool/nuxt
 *   NUXT_PUBLIC_DIR     默认 .output/public
 *   OSS_ENDPOINT        自定义 endpoint（内网等）
 *   DRY_RUN=1           只列出将上传的文件，不实际上传
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OSS from 'ali-oss'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const PUBLIC_DIR = path.resolve(
  rootDir,
  process.env.NUXT_PUBLIC_DIR || '.output/public',
)
const PREFIX = String(process.env.OSS_PREFIX || 'tool/nuxt')
  .replace(/^\/+|\/+$/g, '')
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

const LONG_CACHE =
  'public, max-age=31536000, immutable'
const SHORT_CACHE = 'public, max-age=60, must-revalidate'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`)
  }
  return value
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function isHashedNuxtAsset(relativePosix) {
  // _nuxt 下带 content hash 的产物可长缓存；其余短缓存
  if (!relativePosix.startsWith('_nuxt/')) return false
  // 典型：entry.xxxxx.js / xxx.a1b2c3d4.css / builds/meta/xxxxx.json
  return /\.[a-f0-9]{8,}\./i.test(path.basename(relativePosix))
    || /\/builds\//.test(relativePosix)
}

function cacheControlFor(relativePosix) {
  return isHashedNuxtAsset(relativePosix) ? LONG_CACHE : SHORT_CACHE
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
  }
  return map[ext] || undefined
}

async function walkFiles(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)))
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const region = requireEnv('OSS_REGION')
  const accessKeyId = requireEnv('OSS_ACCESS_KEY_ID')
  const accessKeySecret = requireEnv('OSS_ACCESS_KEY_SECRET')
  const bucket = requireEnv('OSS_BUCKET')

  try {
    await fs.access(PUBLIC_DIR)
  } catch {
    throw new Error(
      `找不到构建产物目录：${PUBLIC_DIR}\n请先执行 pnpm build`,
    )
  }

  const files = await walkFiles(PUBLIC_DIR)
  if (!files.length) {
    throw new Error(`构建产物为空：${PUBLIC_DIR}`)
  }

  console.log(`[deploy:assets] public=${PUBLIC_DIR}`)
  console.log(`[deploy:assets] prefix=oss://${bucket}/${PREFIX}/`)
  console.log(`[deploy:assets] files=${files.length}${DRY_RUN ? ' (dry-run)' : ''}`)

  const client = DRY_RUN
    ? null
    : new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        ...(process.env.OSS_ENDPOINT
          ? { endpoint: process.env.OSS_ENDPOINT }
          : {}),
      })

  let uploaded = 0
  for (const absolute of files) {
    const relative = toPosix(path.relative(PUBLIC_DIR, absolute))
    const objectKey = `${PREFIX}/${relative}`
    const headers = {
      'Cache-Control': cacheControlFor(relative),
    }
    const contentType = contentTypeFor(absolute)
    if (contentType) headers['Content-Type'] = contentType

    if (DRY_RUN) {
      console.log(`  would put ${objectKey}  (${headers['Cache-Control']})`)
      uploaded++
      continue
    }

    await client.put(objectKey, absolute, { headers })
    uploaded++
    if (uploaded % 20 === 0 || uploaded === files.length) {
      console.log(`  uploaded ${uploaded}/${files.length}`)
    }
  }

  console.log(`[deploy:assets] done: ${uploaded} file(s)`)
  console.log(
    '[deploy:assets] 请先完成本上传，再发布/重启 Node 上的 Nuxt，避免 HTML 引用尚未存在的哈希资源。',
  )
}

main().catch((err) => {
  console.error('[deploy:assets] failed:', err?.message || err)
  process.exit(1)
})
