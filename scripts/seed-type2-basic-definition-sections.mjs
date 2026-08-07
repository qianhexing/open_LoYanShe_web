/**
 * 为 type2 设计元素词条新增「基础定义」段落（sort=0 置顶）
 * 数据源：docs/type2-design-basic-definitions.json
 * 成功后回写 section_applied / section_id / section_applied_at
 *
 *   set TOKEN=xxx
 *   node scripts/seed-type2-basic-definition-sections.mjs
 *
 * 可选：
 *   set BASE_URL=https://lolitalibrary.com/node
 *   set DRY_RUN=1
 *   set LIMIT=10
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_PATH = path.join(ROOT, 'docs/type2-design-basic-definitions.json')

const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : 0
const SECTION_TITLE = '基础定义'
const DELAY_MS = Number(process.env.DELAY_MS || 80)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toSectionHtml(text) {
  return `<p>${escapeHtml(text.trim())}</p>`
}

async function post(apiPath, body) {
  const res = await fetch(`${BASE_URL}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN
    },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(`${apiPath} → ${json.code} ${json.message || json.msg || ''}`)
  }
  return json.data
}

async function ensureBasicSection(item) {
  const wikiId = item.wiki_id
  const sections = (await post('/wikiSection/list', { wiki_id: wikiId })) || []
  const existing = sections.find((s) => s.section_title === SECTION_TITLE)

  if (existing) {
    // 已有则保证置顶
    const others = sections.filter((s) => s.section_id !== existing.section_id)
    const needSort =
      existing.sort !== 0 ||
      others.some((s, i) => Number(s.sort) !== i + 1) ||
      sections[0]?.section_id !== existing.section_id

    if (needSort && !DRY_RUN) {
      await post('/wikiSection/sort', {
        wiki_id: wikiId,
        sort: [
          { section_id: existing.section_id, sort: 0 },
          ...others.map((s, i) => ({ section_id: s.section_id, sort: i + 1 }))
        ]
      })
    }

    return {
      status: 'already_exists',
      section_id: existing.section_id
    }
  }

  const content = toSectionHtml(item.basic_definition)
  if (DRY_RUN) {
    return { status: 'would_insert', section_id: null }
  }

  const created = await post('/wikiSection/insert', {
    wiki_id: wikiId,
    section_title: SECTION_TITLE,
    section_content: content,
    sort: 0
  })

  const after = (await post('/wikiSection/list', { wiki_id: wikiId })) || []
  const basic = after.find((s) => s.section_id === created.section_id) || created
  const others = after.filter((s) => s.section_id !== basic.section_id)
  await post('/wikiSection/sort', {
    wiki_id: wikiId,
    sort: [
      { section_id: basic.section_id, sort: 0 },
      ...others.map((s, i) => ({ section_id: s.section_id, sort: i + 1 }))
    ]
  })

  return {
    status: 'inserted',
    section_id: basic.section_id
  }
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  const now = new Date().toISOString()
  let candidates = data.items.filter(
    (it) => it.action !== 'skip' && String(it.basic_definition || '').trim()
  )

  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT)

  let inserted = 0
  let already = 0
  let failed = 0
  let skippedMarked = 0

  console.log(`待处理 ${candidates.length} / 有定义可写入 ${data.items.filter((i) => i.action !== 'skip' && i.basic_definition).length}`)

  for (const item of candidates) {
    if (item.section_applied && item.section_id) {
      skippedMarked++
      continue
    }

    try {
      const result = await ensureBasicSection(item)
      item.section_applied = true
      item.section_id = result.section_id
      item.section_applied_at = now
      item.section_apply_status = result.status

      if (result.status === 'inserted' || result.status === 'would_insert') inserted++
      else already++

      console.log(
        `[${result.status}] ${item.wiki_id} ${item.wiki_name}` +
          (result.section_id ? ` section=${result.section_id}` : '')
      )
    } catch (err) {
      failed++
      item.section_applied = false
      item.section_apply_error = String(err.message || err)
      console.error(`[fail] ${item.wiki_id} ${item.wiki_name}:`, err.message || err)
    }

    // 每处理几条就落盘，避免中断丢进度
    if ((inserted + already + failed) % 20 === 0) {
      data.meta.section_seed = {
        ...(data.meta.section_seed || {}),
        last_run_at: now,
        progress: { inserted, already, failed, skippedMarked }
      }
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
    }

    if (!DRY_RUN) await sleep(DELAY_MS)
  }

  const appliedCount = data.items.filter((i) => i.section_applied).length
  data.meta.status = failed === 0 ? 'section_seeded' : 'section_seed_partial'
  data.meta.section_seed = {
    title: SECTION_TITLE,
    sort: 0,
    last_run_at: now,
    base_url: BASE_URL,
    dry_run: DRY_RUN,
    inserted,
    already_exists: already,
    failed,
    skipped_already_marked: skippedMarked,
    applied_total: appliedCount
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log('\n=== done ===')
  console.log(JSON.stringify(data.meta.section_seed, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
