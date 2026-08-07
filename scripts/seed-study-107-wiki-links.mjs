/**
 * 将百科 type8 词条按分类挂到研习 170–175 下（study_type=2 外链）
 *
 *   set TOKEN=xxx
 *   node scripts/seed-study-107-wiki-links.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'

/** parent study_id → wiki_id 列表（仅已存在百科） */
const LINKS_BY_PARENT = {
  // 1 基础称呼
  170: [58, 7330, 7331, 7332, 7333, 7345, 7346, 7347, 7348, 7355],
  // 2 版权与款式属性
  171: [10, 11, 12, 13, 7339, 7352, 7353, 7354, 7359, 7360, 7361],
  // 3 穿着与搭配口语
  172: [45, 46, 7334, 7335, 7349, 7350, 7351, 7362],
  // 4 入坑与社交
  173: [7336, 7337, 7342, 7343, 7344],
  // 5 买卖与交易
  174: [7338, 7340, 7341, 7356, 7357, 7358, 7363, 7364, 7365, 7366, 7367, 7368, 7369, 7370],
  // 6 成色描述（百科尚无「全新/无瑕…」等，暂空）
  175: []
}

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

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: TOKEN }
  })
  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(`${path} → ${json.code} ${json.message || json.msg || ''}`)
  }
  return json.data
}

async function listChildren(parentId) {
  const data = await post('/study/list', {
    page: 1,
    pageSize: 200,
    parent_id: parentId
  })
  return data.rows || []
}

function wikiUrl(wikiId) {
  return `https://lolitalibrary.com/lolitaWiki/detail/${wikiId}`
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  const wikiList = DRY_RUN
    ? []
    : await get('/wiki/getOptions?type_id=8')
  const wikiById = new Map((wikiList || []).map((w) => [w.wiki_id, w]))

  let created = 0
  let skipped = 0

  for (const [parentIdStr, wikiIds] of Object.entries(LINKS_BY_PARENT)) {
    const parentId = Number(parentIdStr)
    const existing = DRY_RUN ? [] : await listChildren(parentId)
    const existingUrls = new Set(
      existing.map((r) => String(r.study_url || '').replace(/\/$/, ''))
    )
    const existingTitles = new Set(existing.map((r) => r.study_title))

    console.log(`\n=== parent ${parentId} · 计划 ${wikiIds.length} 条 ===`)

    // sort：列表靠前优先，按数组顺序递减
    let sort = 1000
    for (const wikiId of wikiIds) {
      const wiki = wikiById.get(wikiId)
      if (!wiki && !DRY_RUN) {
        console.log(`  跳过（百科不存在） wiki_id=${wikiId}`)
        skipped++
        continue
      }
      const title = wiki?.wiki_name || `wiki_${wikiId}`
      const url = wikiUrl(wikiId)
      if (existingUrls.has(url) || existingTitles.has(title)) {
        console.log(`  跳过（已关联） ${title} (${wikiId})`)
        skipped++
        sort -= 5
        continue
      }

      const payload = {
        study_title: title,
        study_desc: wiki?.other_name || '',
        study_cover: wiki?.cover || null,
        study_type: 2,
        study_url: url,
        sort,
        parent_id: parentId
      }

      if (DRY_RUN) {
        console.log('  [DRY_RUN]', payload)
      } else {
        const row = await post('/study/insert', payload)
        console.log(`  已关联: ${title} → study_id=${row.study_id} · wiki=${wikiId}`)
        created++
      }
      sort -= 5
    }
  }

  console.log(`\n完成：新建 ${created}，跳过 ${skipped}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
