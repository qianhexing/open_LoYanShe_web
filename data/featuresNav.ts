import type {
  FeatureNavFlatItem,
  FeatureNavItem,
  FeatureNavSection,
  FeaturesNavManifest
} from '~/types/featuresNav'

/** 多端默认：Uni 走 outer 包装页压栈（避免 WebView 内 router.push 侧滑整块退出） + 鸿蒙 Outlink */
function def(): Pick<FeatureNavItem, 'uniapp' | 'harmony'> {
  return {
    uniapp: { strategy: 'outer' },
    harmony: { strategy: 'outlink' }
  }
}

export const FEATURE_SITE_ORIGIN = 'https://lolitalibrary.com'

export const featuresNavIntro = {
  title: '功能合集',
  subtitle:
    'Lo研社主要功能入口一览。以下为单数组 `featureNavFlat`：同一 `sectionTitle` 归为同一板块。'
}

/** 单数组：`sectionTitle` 区分板块 */
export const featureNavFlat = [
  {
    sectionTitle: '核心功能',
    id: 'personal-space',
    title: '我的空间',
    desc: '个人主页',
    tone: 'pink',
    icon: 'user',
    path: '/userSpace/{userId}',
    fallbackPath: '/register',
    requiresUserId: true,
    uniapp: {
      strategy: 'native',
      url: '/pages/userSpace/userSpace?id={userId}'
    },
    harmony: {
      strategy: 'jump',
      path: 'UserSpace',
      params: { id: '{userId}' }
    }
  },
  {
    sectionTitle: '核心功能',
    id: 'personal-wardrobe',
    title: '我的衣柜',
    desc: '服饰,3D模型,等管理',
    tone: 'purple',
    icon: 'closet',
    path: '/wardrobe/detail/{userId}',
    fallbackPath: '/register',
    requiresUserId: true,
    ...def(),
    harmony: {
      strategy: 'outlink',
      url: `${FEATURE_SITE_ORIGIN}/wardrobe/detail/{userId}`
    }
  },
  // {
  //   sectionTitle: '核心功能',
  //   id: 'matching',
  //   title: '搭配',
  //   desc: '结合衣柜的服饰搭配，生成搭配方案',
  //   tone: 'rose',
  //   icon: 'image',
  //   path: '/matching',
  //   ...def()
  // },
  {
    sectionTitle: '核心功能',
    id: 'matching-my',
    title: '我的搭配',
    desc: '搭配管理',
    tone: 'purple',
    icon: 'clipboard',
    path: '/matching/my',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'favorite',
    title: '收藏夹',
    desc: '店铺，裙子，帖子等种草清单、收藏管理',
    tone: 'rose',
    icon: 'bookmark',
    path: '/favorite',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'plan',
    title: '定尾计划',
    desc: '定金尾款计划管理',
    tone: 'teal',
    icon: 'plan',
    path: '/user/plan',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'journal',
    title: '手账',
    desc: '记录Lo娘生活，搭配，服饰，图鉴，计划等日常动态',
    tone: 'indigo',
    icon: 'doc',
    path: '/journal',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'scene',
    title: '3D 场景',
    desc: '一个高度自定义的3D小场景，可以添加3D模型，3D文本，3D图片，等',
    tone: 'orange',
    icon: 'package',
    path: '/user/sence',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'album',
    title: 'Lo娘成就簿',
    desc: '完成的一些成就打卡，比如Lo圈神图打卡等，增加一点小目标',
    tone: 'yellow',
    icon: 'award',
    path: '/album',
    ...def()
  },
  {
    sectionTitle: '核心功能',
    id: 'community',
    title: '社区',
    desc: 'Lo娘交流社区，分享生活，搭配，服饰，图鉴，计划等日常动态',
    tone: 'cyan',
    icon: 'chat',
    path: '/community',
    ...def()
  },
  {
    sectionTitle: '其他工具',
    id: 'timepipe',
    title: '上新日历',
    desc: 'Lo裙上新日历，及时了解Lo裙上新信息',
    tone: 'blue',
    icon: 'clock',
    path: '/timepipe',
    ...def()
  },
  {
    sectionTitle: 'Lo裙信息存档',
    id: 'library',
    title: 'Lo裙信息图书馆',
    desc: '检索往期Lolita裙子信息',
    tone: 'purple',
    icon: 'book',
    path: '/library',
    ...def()
  },
  {
    sectionTitle: 'Lo裙信息存档',
    id: 'viz-shop',
    title: 'Lolita星云',
    desc: '裙子与店铺可视化',
    tone: 'blue',
    icon: 'globe',
    path: '/visualization/shop-cloud',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'add-library',
    title: '补充图鉴',
    desc: '提交新图鉴',
    tone: 'blue',
    icon: 'plus',
    path: '/addLibrary',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'my-library',
    title: '我上传的图鉴',
    desc: '图鉴管理',
    tone: 'green',
    icon: 'file',
    path: '/library/my',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'shop',
    title: 'Lolita店铺合集',
    desc: 'Lo店信息汇总与检索，Lo店往期裙子记录。',
    tone: 'rose',
    icon: 'shop',
    path: '/shop',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'shanzheng',
    title: 'Lo店山正快速查询',
    desc: 'Lo店山正快速查询',
    tone: 'orange',
    icon: 'shield',
    path: '/shop/shanzheng',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'compilations',
    title: '合集',
    desc: '用户整理的Lolita风格主题等裙子的合集',
    tone: 'teal',
    icon: 'archive',
    path: '/compilations',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'study',
    title: 'Lolita文化资料研习',
    desc: 'Lolita服饰相关的各种文化资料研习',
    tone: 'blue',
    icon: 'cap',
    path: '/study',
    ...def()
  },
  {
    sectionTitle: 'Lolita文化存档',
    id: 'teaparty',
    title: '茶会 / 线下',
    desc: '线下Lolita线下活动信息',
    tone: 'pink',
    icon: 'sparkles',
    path: '/teaparty',
    ...def()
  },

  {
    sectionTitle: 'Lolita文化存档',
    id: 'wiki',
    title: 'Lolita 词条百科',
    desc: '名词与条目',
    tone: 'purple',
    icon: 'book',
    path: '/lolitaWiki',
    ...def()
  },
  {
    sectionTitle: '可视化与榜单',
    id: 'rank',
    title: '榜单',
    desc: '热度排行',
    tone: 'yellow',
    icon: 'trend',
    path: '/rank',
    ...def()
  },
  {
    sectionTitle: '可视化与榜单',
    id: 'yearly',
    title: '年度总结',
    desc: '年度数据回顾',
    tone: 'pink',
    icon: 'calendar',
    path: '/yearlySummary',
    ...def()
  },
  // {
  //   sectionTitle: '可视化与榜单',
  //   id: 'viz-wardrobe',
  //   title: '衣柜云图',
  //   desc: '衣柜可视化',
  //   tone: 'green',
  //   icon: 'grid',
  //   path: '/visualization/wardrobe',
  //   ...def()
  // },
  
  // {
  //   sectionTitle: '可视化与榜单',
  //   id: 'viz-book',
  //   title: '书籍可视化',
  //   desc: '书单视图',
  //   tone: 'orange',
  //   icon: 'book',
  //   path: '/visualization/book',
  //   ...def()
  // },
  // {
  //   sectionTitle: '可视化与榜单',
  //   id: 'viz-maps',
  //   title: 'Lo娘分布图',
  //   desc: '地理分布',
  //   tone: 'teal',
  //   icon: 'map',
  //   path: '/visualization/distributedMaps',
  //   ...def()
  // },

  // {
  //   sectionTitle: '其他工具',
  //   id: 'ar',
  //   title: 'AR',
  //   desc: 'AR 相关',
  //   tone: 'cyan',
  //   icon: 'video',
  //   path: '/ar',
  //   ...def()
  // },
  {
    sectionTitle: '其他工具',
    id: 'collection-list',
    title: '待收集区',
    desc: '图鉴库中没有的裙子，可以发布在这里',
    tone: 'rose',
    icon: 'bookmark',
    path: '/collectionList',
    ...def()
  }
] as const satisfies readonly FeatureNavFlatItem[]

function sectionIdFromTitle(title: string, index: number): string {
  const slug = title.replace(/\s+/g, '-').replace(/[（）]/g, '')
  return `section-${index}-${slug.slice(0, 48)}`
}

export function buildFeatureNavSections(
  rows: readonly FeatureNavFlatItem[]
): FeatureNavSection[] {
  const order: string[] = []
  const buckets = new Map<string, FeatureNavItem[]>()

  for (const row of rows) {
    const { sectionTitle, ...item } = row
    if (!buckets.has(sectionTitle)) {
      order.push(sectionTitle)
      buckets.set(sectionTitle, [])
    }
    const list = buckets.get(sectionTitle)
    if (list) {
      list.push(item)
    }
  }

  return order.map((title, i) => {
    const items = buckets.get(title)
    if (!items) {
      return { id: sectionIdFromTitle(title, i), title, items: [] }
    }
    return {
      id: sectionIdFromTitle(title, i),
      title,
      items
    }
  })
}

export const featureNavSections = buildFeatureNavSections(featureNavFlat)

export const featuresNavManifest: FeaturesNavManifest = {
  siteOrigin: FEATURE_SITE_ORIGIN,
  intro: featuresNavIntro,
  sections: featureNavSections
}

export default featuresNavManifest
