/**
 * 在研习 107「名词释义」下创建二级分类 1–6（study_type=1 · studyMore）
 *
 * 用法：
 *   set TOKEN=你的Bearer或站点token
 *   node scripts/seed-study-107-categories.mjs
 *
 * 可选：
 *   set BASE_URL=https://lolitalibrary.com/node
 *   set DRY_RUN=1
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'
const PARENT_ID = 107

/** 与 utils/study107NounCategories.ts 保持一致：1–6 先建；7 暂缓 */
const CATEGORIES = [
  { study_title: '基础称呼', sort: 600 },
  { study_title: '版权与款式属性', sort: 590 },
  { study_title: '穿着与搭配口语', sort: 580 },
  { study_title: '入坑与社交', sort: 570 },
  { study_title: '买卖与交易', sort: 560 },
  { study_title: '成色描述', sort: 550 }
]

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

async function listChildren() {
  const data = await post('/study/list', {
    page: 1,
    pageSize: 100,
    parent_id: PARENT_ID
  })
  return data.rows || []
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN。示例：set TOKEN=xxx && node scripts/seed-study-107-categories.mjs')
    process.exit(1)
  }

  const existing = DRY_RUN ? [] : await listChildren()
  const byTitle = new Map(existing.map((r) => [r.study_title, r]))

  for (const cat of CATEGORIES) {
    if (byTitle.has(cat.study_title)) {
      console.log(`跳过（已存在）: ${cat.study_title} → study_id=${byTitle.get(cat.study_title).study_id}`)
      continue
    }

    const payload = {
      study_title: cat.study_title,
      study_desc: '',
      study_cover: null,
      study_type: 1,
      study_url: '',
      sort: cat.sort,
      parent_id: PARENT_ID
    }

    if (DRY_RUN) {
      console.log('[DRY_RUN] insert', payload)
      continue
    }

    const created = await post('/study/insert', payload)
    const studyId = created.study_id
    const studyUrl = `pages/study/studyMore?id=${studyId}`
    await post('/study/update', {
      study_id: studyId,
      study_title: cat.study_title,
      study_desc: '',
      study_cover: created.study_cover ?? null,
      study_type: 1,
      study_url: studyUrl,
      sort: cat.sort,
      parent_id: PARENT_ID
    })
    console.log(`已创建: ${cat.study_title} → study_id=${studyId} · ${studyUrl}`)
  }

  if (!DRY_RUN) {
    const after = await listChildren()
    console.log('\n当前 107 子项:')
    for (const r of after) {
      console.log(`- [${r.study_id}] ${r.study_title} (type=${r.study_type}, sort=${r.sort})`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
