/**
 * 在研习 166「设计元素」下创建二级分类（study_type=1 · studyMore）
 *
 *   set TOKEN=xxx
 *   node scripts/seed-study-166-categories.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'
const PARENT_ID = 166

/** 首批：肩袖并入袖型；鞋类/小物跳过；领型已有 167，会校正 sort */
const CATEGORIES = [
  { study_title: '领型', sort: 800, existingId: 167 },
  { study_title: '袖型', sort: 790 },
  { study_title: '门襟', sort: 780 },
  { study_title: '腰线', sort: 770 },
  { study_title: '裙身', sort: 760 },
  { study_title: '裙摆', sort: 750 },
  { study_title: '结构剪裁', sort: 740 },
  { study_title: '装饰工艺', sort: 730 }
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

async function ensureStudyMore(studyId, title, sort) {
  const studyUrl = `pages/study/studyMore?id=${studyId}`
  await post('/study/update', {
    study_id: studyId,
    study_title: title,
    study_desc: '',
    study_cover: null,
    study_type: 1,
    study_url: studyUrl,
    sort,
    parent_id: PARENT_ID
  })
  return studyUrl
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  const existing = DRY_RUN ? [] : await listChildren()
  const byTitle = new Map(existing.map((r) => [r.study_title, r]))

  for (const cat of CATEGORIES) {
    const hit = byTitle.get(cat.study_title) || (cat.existingId
      ? existing.find((r) => r.study_id === cat.existingId)
      : null)

    if (hit) {
      if (DRY_RUN) {
        console.log(`[DRY_RUN] update ${hit.study_id} ${cat.study_title} sort=${cat.sort}`)
        continue
      }
      const url = await ensureStudyMore(hit.study_id, cat.study_title, cat.sort)
      console.log(`已更新: ${cat.study_title} → study_id=${hit.study_id} · ${url}`)
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
    const url = await ensureStudyMore(created.study_id, cat.study_title, cat.sort)
    console.log(`已创建: ${cat.study_title} → study_id=${created.study_id} · ${url}`)
  }

  if (!DRY_RUN) {
    const after = await listChildren()
    console.log('\n当前 166 子项:')
    for (const r of after.sort((a, b) => (b.sort || 0) - (a.sort || 0))) {
      console.log(`- [${r.study_id}] ${r.study_title} (type=${r.study_type}, sort=${r.sort})`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
