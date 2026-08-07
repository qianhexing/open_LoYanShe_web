/**
 * 研习 166：新增「鞋类设计 / 包包 / 假发」分类并挂载百科
 *
 *   set TOKEN=xxx
 *   node scripts/seed-study-166-accessories.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'
const PARENT_ID = 166

const CATEGORIES = [
  { study_title: '鞋类设计', sort: 720, hubs: [6804, 6805, 6806, 6807, 6945] },
  { study_title: '包包', sort: 710, hubs: [6904] },
  { study_title: '假发', sort: 700, hubs: [6868] }
]

/** wiki_id 白名单（避免「包臀裙」「包边袖口」等误伤） */
const LINKS = {
  鞋类设计: [
    2923, 3878, 3879, 3880, 3882, 3891, 4107, 4111, 4232, 4233, 5177, 5310, 5747, 5748, 5749,
    5751, 5757, 5759, 6170, 6488, 6506, 6507, 6708, 6797, 6798, 6803, 6860, 6865, 6915, 6917,
    6918, 7085, 7086
  ],
  包包: [3900, 4695, 6062, 6063],
  假发: [4003, 6124, 6125, 6126, 6127, 6136, 6137, 6138, 6878]
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

function wikiUrl(wikiId) {
  return `https://lolitalibrary.com/lolitaWiki/detail/${wikiId}`
}

async function listChildren(parentId) {
  const data = await post('/study/list', {
    page: 1,
    pageSize: 500,
    parent_id: parentId
  })
  return data.rows || []
}

async function ensureCategory(title, sort) {
  const existing = await listChildren(PARENT_ID)
  const hit = existing.find((r) => r.study_title === title)
  if (hit) {
    await post('/study/update', {
      study_id: hit.study_id,
      study_title: title,
      study_desc: '',
      study_cover: hit.study_cover ?? null,
      study_type: 1,
      study_url: `pages/study/studyMore?id=${hit.study_id}`,
      sort,
      parent_id: PARENT_ID
    })
    return hit.study_id
  }
  if (DRY_RUN) {
    console.log('[DRY] create category', title, sort)
    return null
  }
  const created = await post('/study/insert', {
    study_title: title,
    study_desc: '',
    study_cover: null,
    study_type: 1,
    study_url: '',
    sort,
    parent_id: PARENT_ID
  })
  await post('/study/update', {
    study_id: created.study_id,
    study_title: title,
    study_desc: '',
    study_cover: null,
    study_type: 1,
    study_url: `pages/study/studyMore?id=${created.study_id}`,
    sort,
    parent_id: PARENT_ID
  })
  console.log(`已创建分类: ${title} → ${created.study_id}`)
  return created.study_id
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  const type2 = await get('/wiki/getOptions?type_id=2')
  const type17 = await get('/wiki/getOptions?type_id=17')
  const wikiById = new Map([...type2, ...type17].map((w) => [w.wiki_id, w]))

  let createdLinks = 0
  let skipped = 0

  for (const cat of CATEGORIES) {
    const parentId = DRY_RUN ? 0 : await ensureCategory(cat.study_title, cat.sort)
    const wikiIds = [...cat.hubs, ...LINKS[cat.study_title]]
    const existing = parentId ? await listChildren(parentId) : []
    const urls = new Set(existing.map((r) => String(r.study_url || '').replace(/\/$/, '')))
    const titles = new Set(existing.map((r) => r.study_title))

    console.log(`\n=== ${cat.study_title} (${parentId || 'dry'}) · 计划 ${wikiIds.length} ===`)
    let sort = 2000
    const seen = new Set()
    for (const wikiId of wikiIds) {
      if (seen.has(wikiId)) continue
      seen.add(wikiId)
      const w = wikiById.get(wikiId)
      if (!w) {
        console.log(`  跳过（无百科） #${wikiId}`)
        skipped++
        continue
      }
      const url = wikiUrl(wikiId)
      if (urls.has(url) || titles.has(w.wiki_name)) {
        console.log(`  已存在 ${w.wiki_name}`)
        skipped++
        sort -= 1
        continue
      }
      const payload = {
        study_title: w.wiki_name,
        study_desc: w.other_name || '',
        study_cover: w.cover || null,
        study_type: 2,
        study_url: url,
        sort,
        parent_id: parentId
      }
      if (DRY_RUN) {
        console.log('  [DRY]', wikiId, w.wiki_name)
      } else {
        const row = await post('/study/insert', payload)
        console.log(`  + ${w.wiki_name} (#${wikiId}) → study ${row.study_id}`)
        createdLinks++
      }
      sort -= 1
    }
  }

  console.log(`\n完成：新建关联 ${createdLinks}，跳过 ${skipped}`)

  if (!DRY_RUN) {
    const after = await listChildren(PARENT_ID)
    console.log('\n当前 166 子项:')
    for (const r of after.sort((a, b) => (b.sort || 0) - (a.sort || 0))) {
      console.log(`- [${r.study_id}] ${r.study_title} (sort=${r.sort})`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
