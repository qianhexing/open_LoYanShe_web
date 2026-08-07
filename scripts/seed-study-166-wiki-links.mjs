/**
 * 将百科 type2「设计元素」挂到研习 166 各二级分类下（study_type=2）
 *
 *   set TOKEN=xxx
 *   node scripts/seed-study-166-wiki-links.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://lolitalibrary.com/node').replace(/\/$/, '')
const TOKEN = process.env.TOKEN || ''
const DRY_RUN = process.env.DRY_RUN === '1'

/** 分类 → study parent_id */
const PARENTS = {
  领型: 167,
  袖型: 224,
  门襟: 225,
  腰线: 226,
  裙身: 227,
  裙摆: 228,
  结构剪裁: 229,
  装饰工艺: 230
}

/** 各分类可挂的 type17 节点（可选置顶） */
const TYPE17_HUBS = {
  领型: [5349],
  袖型: [5350, 6844],
  门襟: [6410, 6843],
  腰线: [6411, 6443],
  裙身: [6412, 6441],
  裙摆: [6413, 6442],
  结构剪裁: [6902, 6862],
  装饰工艺: [6849, 6848, 6863]
}

/** 强制归类（wiki_id → 分类名） */
const FORCE = {
  44: '裙摆', // 素鸡
  70: '装饰工艺', // 尾椎骨
  208: '裙摆', // 狗短
  214: '袖型', // 挂脖
  261: '结构剪裁', // 三段式
  263: '结构剪裁', // 分体
  325: '装饰工艺', // 交叉绑带
  449: '裙身', // 罩裙
  524: '装饰工艺', // 丝带
  568: '装饰工艺', // 打缆
  784: '裙摆', // 前短后长
  810: '门襟', // 盘扣
  1430: '装饰工艺', // 拼布
  1439: '装饰工艺', // 流苏
  1791: '结构剪裁', // 镂空背部
  2264: '裙身', // 背心款
  2564: '结构剪裁', // 片裁
  2644: '裙摆', // 燕尾
  2939: '门襟', // 拉链
  2973: '裙身', // 巴斯尔
  2974: '裙身', // dress型
  3349: '裙摆', // 拖纱
  3423: '装饰工艺', // 镂空
  3552: '结构剪裁', // 鱼骨
  4718: '裙摆', // 不规则摆
  4994: '结构剪裁', // 斯拉修
  5077: '装饰工艺', // 飘带
  5123: '裙摆', // 克里诺林
  5139: '门襟', // 变形襟
  5144: '门襟', // 双襟
  5167: '领型', // 开口Partlet
  5168: '结构剪裁', // 两段式
  5231: '门襟', // 缺口钥匙孔
  5321: '领型', // Gorget
  5413: '门襟', // 被布衿
  6122: '装饰工艺', // 曲牙/狗牙边
  6186: '结构剪裁', // 多穿法
  6270: '装饰工艺', // 绗缝
  6446: '结构剪裁', // 中心线
  6484: '裙摆', // 包臀裙/铅笔裙
  6497: '裙身', // 蔽膝
  6499: '裙摆', // 破片摆
  6620: '装饰工艺', // 贴边/毛边
  6647: '裙摆', // cascade
  6784: '袖型', // 肩章
  6800: '袖型', // 肩翼
  6925: '裙摆', // 花苞摆
  6946: '结构剪裁', // 露背挖背
  7122: '装饰工艺', // 绳绣
  7157: '装饰工艺', // 宕条
  7160: '装饰工艺', // 掐牙
  7318: '装饰工艺' // 布艺花/仿真花
}

/** 明确跳过（鞋履/包/假发/主题风/测试等，不属于本批 8 类） */
const SKIP = new Set([
  195, 309, 6984, // PH风、测试、待完善
  // 鞋
  3878, 3879, 3882, 3891, 4107, 4111, 4232, 4233, 5177, 5310, 5747, 5748, 5749, 5751, 5759,
  6170, 6488, 6506, 6507, 6708, 6797, 6798, 6803, 6860, 6865, 6915, 7085, 7086,
  // 包
  3900, 4695, 6062, 6063,
  // 发型假发
  4003, 6124, 6125, 6126, 6127, 6136, 6137, 6138, 6878,
  // 汉元素/风格风味（归主要风格）
  249, 250, 251, 302, 3292, 4985, 5000, 6188, 6189, 6190, 6217, 6498, 6574, 6600, 6602, 6765
])

const RULES = [
  ['门襟', /门襟|开襟|对襟|偏襟|前襟|侧开襟|背开|排扣|双排扣|暗扣|盘扣|变形襟|双襟|被布衿/],
  ['领型', /领|拉夫|伯莎|披肩领|水手领|海军领|娃娃领|旗袍领|交领|方领|圆领|尖领|V领|一字领|立领|翻领|驳领|花瓣领|蝙蝠领|假领|Partlet|Gorget|口水巾|口水兜/],
  ['袖型', /袖|肩带|露肩|落肩|一字肩|云肩|披肩袖|无袖|吊带(?!裙)|挂脖|肩章|肩翼/],
  ['腰线', /腰|腰封|束腰|抽带|抽绳|裙头|裤头|收腰|露腰|无腰|奶上|奶下/],
  ['裙摆', /裙摆|下摆|衣摆|拖尾|鱼尾|蛋糕摆|提拉|塔裙|节裙|段段裙|蓬蓬裙|伞裙|波浪摆|花瓣摆|贝壳|蝙蝠摆|尖下摆|斜摆|异形下摆|不规则|多层裙摆|狗短|素鸡|前短后长|燕尾|拖纱|破片摆|花苞摆|包臀|铅笔裙|cascade|克里诺林/],
  ['结构剪裁', /切替|拼接|不对称|结构线|开衩|开叉|分片|假两件|套头|剪裁|嵌线|插片|三段式|分体|片裁|两段式|多穿法|斯拉修|镂空背|露背|挖背|中心线|鱼骨|双面可穿/],
  ['装饰工艺', /褶|荷叶|蕾丝|刺绣|钉珠|蝴蝶结|印花|提花|立体花|花边|滚边|嵌边|镶|抽褶|打揽|打缆|风琴|塔克|珠片|亮片|缎带|丝带|绑带|贴片|尾椎骨|拼布|流苏|法绣|羽毛|植绒|蜈蚣|烫钻|镂空|狗牙|曲牙|绗缝|烫花|贴布|对花|飘带|铆钉|挂链|毛球|绳绣|宕条|掐牙|织带|盘花|布艺花|仿真花|补子|折纸|烫金|烫银|贴边|毛边|拷边|充棉/],
  ['裙身', /裙身|衣身|段段(?!裙)|胸|托胸|省道|公主线|刀背|马甲(?!腰)|围裙|背带|罩裙|深V|帷幕|披帛|绶带|花嫁|巴斯尔|dress型|背心款|蔽膝|痛层/]
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

function classify(w) {
  if (SKIP.has(w.wiki_id)) return null
  if (FORCE[w.wiki_id]) return FORCE[w.wiki_id]
  const text = `${w.wiki_name} ${w.other_name || ''}`
  for (const [name, re] of RULES) {
    if (re.test(text)) return name
  }
  return null
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

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('缺少 TOKEN')
    process.exit(1)
  }

  const type2 = await get('/wiki/getOptions?type_id=2')
  const type17 = await get('/wiki/getOptions?type_id=17')
  const wikiById = new Map([...type2, ...type17].map((w) => [w.wiki_id, w]))

  /** @type {Record<string, any[]>} */
  const buckets = Object.fromEntries(Object.keys(PARENTS).map((k) => [k, []]))
  let skippedUnclassified = 0
  let skippedExplicit = 0

  for (const w of type2) {
    if (SKIP.has(w.wiki_id)) {
      skippedExplicit++
      continue
    }
    const cat = classify(w)
    if (!cat) {
      skippedUnclassified++
      continue
    }
    buckets[cat].push(w)
  }

  // 附加 type17 hub
  for (const [cat, ids] of Object.entries(TYPE17_HUBS)) {
    for (const id of ids) {
      const w = wikiById.get(id)
      if (w && !buckets[cat].some((x) => x.wiki_id === id)) {
        buckets[cat].unshift(w)
      }
    }
  }

  let created = 0
  let skippedExist = 0

  for (const [cat, parentId] of Object.entries(PARENTS)) {
    const items = buckets[cat]
    const existing = DRY_RUN ? [] : await listChildren(parentId)
    const urls = new Set(existing.map((r) => String(r.study_url || '').replace(/\/$/, '')))
    const titles = new Set(existing.map((r) => r.study_title))

    console.log(`\n=== ${cat} (${parentId}) · ${items.length} 条 ===`)
    let sort = 2000
    for (const w of items) {
      const url = wikiUrl(w.wiki_id)
      if (urls.has(url) || titles.has(w.wiki_name)) {
        skippedExist++
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
        console.log('  [DRY]', w.wiki_id, w.wiki_name)
      } else {
        const row = await post('/study/insert', payload)
        console.log(`  + ${w.wiki_name} (#${w.wiki_id}) → study ${row.study_id}`)
        created++
      }
      sort -= 1
    }
  }

  console.log('\n统计:')
  for (const [cat, items] of Object.entries(buckets)) {
    console.log(`  ${cat}: ${items.length}`)
  }
  console.log(`新建 ${created} · 已存在跳过 ${skippedExist} · 显式跳过 ${skippedExplicit} · 未归类跳过 ${skippedUnclassified}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
