/**
 * 从 study/list 拉取研习项，将 study_cover 同步到对应 wiki 的 cover
 *
 *   set TOKEN=xxx
 *   node scripts/sync-study-cover-to-wiki.mjs
 *
 * 可选环境变量:
 *   PARENT_ID=167   研习父级 ID
 *   PAGE_SIZE=40    每页条数
 *   DRY_RUN=1       只预览不更新
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const PARENT_ID = Number(process.env.PARENT_ID || 167)
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 40)
const DRY_RUN = process.env.DRY_RUN === '1'

const WIKI_DETAIL_RE = /\/lolitaWiki\/detail\/(\d+)/i

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN
    },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(`${path} → ${json.code} ${json.message || json.msg || ''}`)
  }
  return json.data
}

function extractWikiId(studyUrl) {
  const url = String(studyUrl || '').trim()
  const m = url.match(WIKI_DETAIL_RE)
  return m ? Number(m[1]) : null
}

async function fetchAllStudyItems(parentId) {
  const all = []
  let page = 1
  let total = Infinity

  while (all.length < total) {
    const data = await post('/study/list', {
      page,
      pageSize: PAGE_SIZE,
      parent_id: parentId
    })
    total = data.count ?? 0
    const rows = data.rows || []
    if (!rows.length) break
    all.push(...rows)
    console.log(`  拉取第 ${page} 页: ${rows.length} 条 (累计 ${all.length}/${total})`)
    page += 1
  }

  return all
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  console.log(`parent_id=${PARENT_ID} · pageSize=${PAGE_SIZE}${DRY_RUN ? ' · DRY_RUN' : ''}`)
  console.log('拉取 study/list …')
  const items = await fetchAllStudyItems(PARENT_ID)

  const targets = items
    .filter((item) => item.study_cover)
    .map((item) => ({
      study_id: item.study_id,
      study_title: item.study_title,
      study_cover: item.study_cover,
      wiki_id: extractWikiId(item.study_url)
    }))
    .filter((item) => item.wiki_id)

  const skippedNoCover = items.length - items.filter((i) => i.study_cover).length
  const skippedNoWiki = items.filter((i) => i.study_cover).length - targets.length

  console.log(`\n共 ${items.length} 条 · 待同步 ${targets.length} · 无封面跳过 ${skippedNoCover} · 非 wiki 链接跳过 ${skippedNoWiki}\n`)

  let updated = 0
  let skippedSame = 0
  let failed = 0

  for (const item of targets) {
    try {
      const wiki = await post('/wiki/detail', { wiki_id: item.wiki_id })
      if (wiki.cover === item.study_cover) {
        console.log(`  = ${item.study_title} (#${item.wiki_id}) 封面已一致，跳过`)
        skippedSame++
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${item.study_title} (#${item.wiki_id}) ${wiki.cover || '(空)'} → ${item.study_cover}`)
        updated++
        continue
      }

      await post('/wiki/update', {
        wiki_id: item.wiki_id,
        cover: item.study_cover
      })
      console.log(`  ✓ ${item.study_title} (#${item.wiki_id}) → ${item.study_cover}`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${item.study_title} (#${item.wiki_id}) ${err.message}`)
      failed++
    }
  }

  console.log(`\n完成: 更新 ${updated} · 已一致跳过 ${skippedSame} · 失败 ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
