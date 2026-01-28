<script setup lang="ts">
import type { Library, PaginationResponse, FilterList, Wiki, Shop } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getLibraryList } from '@/api/library';
import { getWikiOptionsByKeywords } from '@/api/wiki';
import { getShopOptiosns } from '@/api/shop';
import { insertGood } from '@/api/good';
import { insertCollect } from '@/api/collect';
import authGlobal from '@/middleware/auth.global'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type WikiOptionsChooseType from '@/components/wiki/wikiOptionsChoose.vue'
import type { default as QhxSelect } from '@/components/Qhx/Select.vue'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'
import { useToast } from '#imports'
const { t } = useI18n()
const layoutReady = inject('layoutReady') as Ref<boolean>
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const user = useUserStore()
const configStore = useConfigStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const opearItem = ref<number | null>(null)

// 加衣柜相关
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const wardrobeAddLibraryRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const favoriteOptionsModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')
const column = ref(4)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
const isCheck = ref(true)
const parent_id = ref(true)

// 精确搜索模式
const showFilterList = ref(false)
const filterList = ref<FilterList[]>([])
const filterDescription = ref('')
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChooseType> | null>(null)

// 筛选表单数据
const filterForm = reactive({
  name: '',
  shop_name: [] as Array<{ label: string; value: string; type?: string }>,
  library_type: [] as Array<{ label: string; value: number; type?: string }>,
  state: [] as Array<{ label: string; value: number }>,
  shop_country: -1,
  main_style: [] as Array<{ label: string; value: number; type?: string }>,
  theme: [] as Array<{ label: string; value: number; type?: string }>,
  color: [] as Array<{ label: string; value: number; type?: string }>,
  library_pattern: [] as Array<{ label: string; value: number; type?: string }>,
  design_elements: [] as Array<{ label: string; value: number; type?: string }>,
  pattern_elements: [] as Array<{ label: string; value: number; type?: string }>,
  cloth_elements: [] as Array<{ label: string; value: number; type?: string }>,
  price: {
    start: '',
    end: ''
  },
  sale_time_start: null as number | null,
  sale_time_end: null as number | null
})

// 选项数据
const options = reactive({
  main_style: [] as Array<{ label: string; value: number }>,
  library_type: [] as Array<{ label: string; value: number }>,
  state: [] as Array<{ label: string; value: number }>,
  shop_name: [] as Array<{ label: string; value: string }>,
  sale_time: [] as Array<{ label: string; value: number }>
})


// 当前选择的wiki类型
const currentWikiType = ref<string>('')
useHead({
  title: t('library.title'),
  meta: [
    {
      name: 'keywords',
      content: t('library.keywords')
    },
    {
      name: 'description',
      content: t('library.description')
    }
  ]
})
definePageMeta({
  name: 'library',
  middleware: [authGlobal]
})
const changeFilterType = (index: number, type: string) => {
  const field = filterForm[type as keyof typeof filterForm] as Array<{ label: string; value: number | string; type?: string }>
  if (!field[index].type || field[index].type === 'and') {
    field[index].type = 'or'
  } else if (field[index].type === 'or') {
    field[index].type = 'not'
  } else {
    field[index].type = 'and'
  }
}
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
  // router.push({
  //   query: {
  //     ...route.query,
  //     page: current
  //   },
  //   force: true
  // })
}

const jumpToAddLibrary = () => {
  // 判断是否登录
  if (!user.token) {
    toast.add({
      title: t('library.please_login'),
      color: 'red'
    })
    return
  }
  window.open('/addLibrary', '_blank')
}
const jumpToCollectionList = () => {
  window.open('/collectionList', '_blank')
}
// 统一处理搜索逻辑
const handleSearch = () => {
  if (showFilterList.value) {
    // 精确搜索模式
    applyFilter()
  } else {
    // 模糊搜索模式
    keyword.value = value.value.trim()
    filterList.value = []
    waterList.value?.refresh()
  }
}

const handleChange = (e: boolean) => {
  parent_id.value = e
  waterList.value?.refresh()
}
const jumpToDataVisualization = () => {
  window.open('/visualization/shop-cloud', '_blank')
}
// 切换搜索模式
const toggleSearchMode = () => {
  showFilterList.value = !showFilterList.value
  if (!showFilterList.value) {
    // 切换到模糊搜索，清空筛选条件
    clearFilter()
  } else {
    // 切换到精确搜索，清空描述
    filterDescription.value = ''
  }
}

// 初始化选项数据
const initOptions = async () => {
  try {
    // 获取主要风格
    const mainStyleRes = await getWikiOptionsByKeywords({ type_id: 4 })
    options.main_style = mainStyleRes.map(item => ({
      label: item.wiki_name,
      value: item.wiki_id as number
    }))

    // 获取图鉴类型
    const libraryTypeRes = await getWikiOptionsByKeywords({ type_id: 10 })
    options.library_type = libraryTypeRes.map(item => ({
      label: item.wiki_name,
      value: item.wiki_id as number
    }))

    // 获取图鉴状态
    const stateRes = await getWikiOptionsByKeywords({ type_id: 12 })
    options.state = stateRes.map(item => ({
      label: item.wiki_name,
      value: item.wiki_id as number
    }))

    // 生成年份选项
    const years = []
    for (let i = 2050; i >= 1950; i--) {
      years.push({ label: String(i), value: i })
    }
    options.sale_time = years
  } catch (error) {
    console.error('初始化选项失败:', error)
  }
}

// 店铺搜索
const fetchShopOptiosns = async (keywords: string) => {
  console.log(keywords, 'keywords')
  try {
    const response = await getShopOptiosns({ shop_name: keywords || '' })
    let data: Shop[] = []
    if (response.length > 20) {
      data = response.slice(0, 19)
    } else {
      data = response
    }
    return data
  } catch (error) {
    console.error('搜索店铺失败:', error)
    return []
  }
}

// 处理店铺选择
const handleShopSelect = (selected: Shop | null) => {
  if (selected?.shop_name) {
    const exists = filterForm.shop_name.find(item => item.value === selected.shop_name)
    if (!exists) {
      filterForm.shop_name.push({
        label: selected.shop_name,
        value: selected.shop_name,
        type: 'and'
      })
    }
  }
}

// 选择wiki
const chooseWiki = (type: string) => {
  currentWikiType.value = type
  let typeId = 0
  const params: { type_id: number; parent_id?: number } = { type_id: typeId }

  if (type === 'design_elements') {
    typeId = 2
  } else if (type === 'cloth_elements') {
    typeId = 5
  } else if (type === 'theme') {
    typeId = 14
  } else if (type === 'library_pattern') {
    typeId = 1
    if (filterForm.library_type.length > 0) {
      params.parent_id = filterForm.library_type[0].value
    }
  } else if (type === 'color') {
    typeId = 13
  } else if (type === 'pattern_elements') {
    typeId = 3
  }

  params.type_id = typeId
  // @ts-ignore
  wikiOptionsChooseRef.value?.showModel(params)
}

// Wiki选择回调
const onWikiChoose = (list: Array<{ wiki_id?: number; wiki_name?: string }>) => {
  const type = currentWikiType.value
  if (type && filterForm[type as keyof typeof filterForm]) {
    const arr = filterForm[type as keyof typeof filterForm] as Array<{ label: string; value: number; type?: string }>
    for (const child of list) {
      if (child.wiki_name && child.wiki_id) {
        const index = arr.findIndex((element) => element.label === child.wiki_name)
        if (index === -1) {
          arr.push({
            label: child.wiki_name,
            value: child.wiki_id as number,
            type: 'and'
          })
        }
      }
    }
  }
}

// 选择器refs
const mainStyleSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const libraryTypeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const stateSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const saleTimeStartSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const saleTimeEndSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const sortSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

// 排序模式
const sortMode = ref<number>(0) // 默认时间倒序

// 排序模式选项
const sortOptions = computed(() => [
  { label: t('library.sort_time_desc'), value: 0 },
  { label: t('library.sort_sale_time_desc'), value: 5 },
  { label: t('library.sort_wardrobe'), value: 6 },
  { label: t('library.sort_good'), value: 7 },
  { label: t('library.sort_collect'), value: 8 },
  { label: t('library.sort_time_asc'), value: 9 }
])

// 处理排序变化
const onSortChange = (option: { label: string; value: number }) => {
  sortMode.value = option.value
  waterList.value?.refresh()
}

// 确认主要风格
const confirmMainStyle = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.main_style.some(item => item.value === selected.value)
    if (!hasValue) {
      filterForm.main_style.push({ ...selected, type: 'and' })
    }
  }
}

// 确认图鉴类型
const confirmLibraryType = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.library_type.some(item => item.label === selected.label)
    if (!hasValue) {
      filterForm.library_type.push({ ...selected, type: 'and' })
    }
  }
}

// 确认状态
const confirmState = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.state.some(item => item.value === selected.value)
    if (!hasValue) {
      filterForm.state.push(selected)
    }
  }
}

// 确认起始年份
const confirmSaleTimeStart = (selected: { label: string; value: number }) => {
  if (selected) {
    filterForm.sale_time_start = selected.value
  }
}

// 确认结束年份
const confirmSaleTimeEnd = (selected: { label: string; value: number }) => {
  if (selected) {
    filterForm.sale_time_end = selected.value
  }
}

// 删除数组项
const deleteArrayItem = <T,>(arr: T[], index: number) => {
  arr.splice(index, 1)
}

// 删除店铺
const deleteShop = (label: string) => {
  const index = filterForm.shop_name.findIndex(item => item.label === label)
  if (index !== -1) {
    filterForm.shop_name.splice(index, 1)
  }
}

// 选择国家
const chooseCountry = (value: number) => {
  filterForm.shop_country = value
}

// 应用筛选
const applyFilter = () => {
  const temp: FilterList[] = []

  // 图鉴名称
  if (filterForm.name) {
    temp.push({
      field: 'name',
      op: 'and',
      value: filterForm.name
    })
  }

  // 状态
  if (filterForm.state.length > 0) {
    const stateValue = filterForm.state.map(v => v.label).join(',')
    temp.push({
      field: 'state',
      op: 'and',
      value: stateValue
    })
  }

  // 起始年份
  if (filterForm.sale_time_start) {
    temp.push({
      field: 'sale_time_start',
      op: 'and',
      value: `${filterForm.sale_time_start}-01-01`
    })
  }

  // 结束年份
  if (filterForm.sale_time_end) {
    temp.push({
      field: 'sale_time_end',
      op: 'and',
      value: `${filterForm.sale_time_end}-01-01`
    })
  }

  // 国家
  if (filterForm.shop_country !== -1) {
    temp.push({
      field: 'shop_country',
      op: 'and',
      value: filterForm.shop_country
    })
  }

  // 颜色
  if (filterForm.color.length > 0) {
    const colorValueAnd: string[] = []
    const colorValueOr: string[] = []
    for (const v of filterForm.color) {
      if (v.type === 'and') {
        colorValueAnd.push(v.label)
      } else if (v.type === 'or') {
        colorValueOr.push(v.label)
      } else {
        temp.push({
          field: 'color',
          op: 'not',
          value: v.label
        })
      }
    }
    if (colorValueAnd.length > 0) {
      temp.push({
        field: 'color',
        op: 'and',
        value: colorValueAnd.join(',')
      })
    }
    if (colorValueOr.length > 0) {
      temp.push({
        field: 'color',
        op: 'or',
        value: colorValueOr.join(',')
      })
    }
  }

  // 主题
  if (filterForm.theme.length > 0) {
    const themeValueAnd: string[] = []
    const themeValueOr: string[] = []
    for (const v of filterForm.theme) {
      if (v.type === 'and') {
        themeValueAnd.push(v.label)
      } else if (v.type === 'or') {
        themeValueOr.push(v.label)
      } else {
        temp.push({
          field: 'theme',
          op: 'not',
          value: v.label
        })
      }
    }
    if (themeValueAnd.length > 0) {
      temp.push({
        field: 'theme',
        op: 'and',
        value: themeValueAnd.join(',')
      })
    }
    if (themeValueOr.length > 0) {
      temp.push({
        field: 'theme',
        op: 'or',
        value: themeValueOr.join(',')
      })
    }
  }

  // 版型部位
  if (filterForm.library_pattern.length > 0) {
    const patternValueAnd: string[] = []
    const patternValueOr: string[] = []
    for (const v of filterForm.library_pattern) {
      if (v.type === 'and') {
        patternValueAnd.push(v.label)
      } else if (v.type === 'or') {
        patternValueOr.push(v.label)
      } else {
        temp.push({
          field: 'library_pattern',
          op: 'not',
          value: v.label
        })
      }
    }
    if (patternValueAnd.length > 0) {
      temp.push({
        field: 'library_pattern',
        op: 'and',
        value: patternValueAnd.join(',')
      })
    }
    if (patternValueOr.length > 0) {
      temp.push({
        field: 'library_pattern',
        op: 'or',
        value: patternValueOr.join(',')
      })
    }
  }

  // 主要风格
  if (filterForm.main_style.length > 0) {
    // const mainStyleValue = filterForm.main_style.map(v => v.value).join(',')
    const mainStyleValueAnd: number[] = []
    const mainStyleValueOr: number[] = []

    // biome-ignore lint/complexity/noForEach: <explanation>
    filterForm.main_style.forEach(v => {
      if (v.type === 'and') {
        mainStyleValueAnd.push(v.value)
      } else if (v.type === 'or') {
        mainStyleValueOr.push(v.value)
      } else {
        temp.push({
          field: 'main_style',
          op: 'not',
          value: v.value
        })
      }
    })
    if (mainStyleValueAnd.length > 0) {
      temp.push({
        field: 'main_style',
        op: 'and',
        value: mainStyleValueAnd.join(',')
      })
    }
    if (mainStyleValueOr.length > 0) {
      temp.push({
        field: 'main_style',
        op: 'or',
        value: mainStyleValueOr.join(',')
      })
    }
  }

  // 店铺名称
  if (filterForm.shop_name.length > 0) {
    const shopNameValueAnd: string[] = []
    const shopNameValueOr: string[] = []
    for (const v of filterForm.shop_name) {
      if (v.type === 'and') {
        shopNameValueAnd.push(v.value)
      } else if (v.type === 'or') {
        shopNameValueOr.push(v.value)
      } else {
        temp.push({
          field: 'shop_name',
          op: 'not',
          value: v.value
        })
      }
    }
    if (shopNameValueAnd.length > 0) {
      temp.push({
        field: 'shop_name',
        op: 'and',
        value: shopNameValueAnd.join(',')
      })
    }
    if (shopNameValueOr.length > 0) {
      temp.push({
        field: 'shop_name',
        op: 'or',
        value: shopNameValueOr.join(',')
      })
    }
  }

  // 图鉴类型
  if (filterForm.library_type.length > 0) {
    const libraryTypeValueAnd: string[] = []
    const libraryTypeValueOr: string[] = []
    for (const v of filterForm.library_type) {
      if (v.type === 'and') {
        libraryTypeValueAnd.push(v.label)
      } else if (v.type === 'or') {
        libraryTypeValueOr.push(v.label)
      } else {
        temp.push({
          field: 'library_type',
          op: 'not',
          value: v.label
        })
      }
    }
    if (libraryTypeValueAnd.length > 0) {
      temp.push({
        field: 'library_type',
        op: 'and',
        value: libraryTypeValueAnd.join(',')
      })
    }
    if (libraryTypeValueOr.length > 0) {
      temp.push({
        field: 'library_type',
        op: 'or',
        value: libraryTypeValueOr.join(',')
      })
    }
  }

  // 价格
  if (filterForm.price.start && filterForm.price.end) {
    temp.push({
      field: 'library_price',
      op: 'and',
      value: JSON.stringify(filterForm.price)
    })
  } else if (filterForm.price.start || filterForm.price.end) {
    useToast().add({
      title: t('library.price_range_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  // 柄图元素
  if (filterForm.pattern_elements.length > 0) {
    const patternElementsValueAnd: string[] = []
    const patternElementsValueOr: string[] = []
    for (const v of filterForm.pattern_elements) {
      if (v.type === 'and') {
        patternElementsValueAnd.push(v.label)
      } else if (v.type === 'or') {
        patternElementsValueOr.push(v.label)
      } else {
        temp.push({
          field: 'pattern_elements',
          op: 'not',
          value: v.label
        })
      }
    }
    if (patternElementsValueAnd.length > 0) {
      temp.push({
        field: 'pattern_elements',
        op: 'and',
        value: patternElementsValueAnd.join(',')
      })
    }
    if (patternElementsValueOr.length > 0) {
      temp.push({
        field: 'pattern_elements',
        op: 'or',
        value: patternElementsValueOr.join(',')
      })
    }
  }

  // 设计元素
  if (filterForm.design_elements.length > 0) {
    const designElementsValueAnd: string[] = []
    const designElementsValueOr: string[] = []
    for (const v of filterForm.design_elements) {
      if (v.type === 'and') {
        designElementsValueAnd.push(v.label)
      } else if (v.type === 'or') {
        designElementsValueOr.push(v.label)
      } else {
        temp.push({
          field: 'design_elements',
          op: 'not',
          value: v.label
        })
      }
    }
    if (designElementsValueAnd.length > 0) {
      temp.push({
        field: 'design_elements',
        op: 'and',
        value: designElementsValueAnd.join(',')
      })
    }
    if (designElementsValueOr.length > 0) {
      temp.push({
        field: 'design_elements',
        op: 'or',
        value: designElementsValueOr.join(',')
      })
    }
  }

  // 材质布料
  if (filterForm.cloth_elements.length > 0) {
    const clothElementsValueAnd: string[] = []
    const clothElementsValueOr: string[] = []
    for (const v of filterForm.cloth_elements) {
      if (v.type === 'and') {
        clothElementsValueAnd.push(v.label)
      } else if (v.type === 'or') {
        clothElementsValueOr.push(v.label)
      } else {
        temp.push({
          field: 'cloth_elements',
          op: 'not',
          value: v.label
        })
      }
    }
    if (clothElementsValueAnd.length > 0) {
      temp.push({
        field: 'cloth_elements',
        op: 'and',
        value: clothElementsValueAnd.join(',')
      })
    }
    if (clothElementsValueOr.length > 0) {
      temp.push({
        field: 'cloth_elements',
        op: 'or',
        value: clothElementsValueOr.join(',')
      })
    }
  }

  filterList.value = temp
  keyword.value = ''

  // 生成自然语言描述
  filterDescription.value = generateFilterDescription(temp)

  waterList.value?.refresh()
}

// 字段名称到中文的映射
const fieldNameMap = computed(() => ({
  name: t('library.field_name'),
  shop_name: t('library.field_shop_name'),
  library_type: t('library.field_library_type'),
  state: t('library.field_state'),
  shop_country: t('library.field_shop_country'),
  main_style: t('library.field_main_style'),
  theme: t('library.field_theme'),
  color: t('library.field_color'),
  library_pattern: t('library.field_library_pattern'),
  design_elements: t('library.field_design_elements'),
  pattern_elements: t('library.field_pattern_elements'),
  cloth_elements: t('library.field_cloth_elements'),
  library_price: t('library.field_library_price'),
  sale_time_start: t('library.field_sale_time_start'),
  sale_time_end: t('library.field_sale_time_end')
}))

// 生成自然语言描述
const generateFilterDescription = (filters: FilterList[]): string => {
  if (filters.length === 0) {
    return ''
  }

  // 按字段分组
  const fieldGroups: Record<string, { and: string[], or: string[], not: string[] }> = {}

  for (const filter of filters) {
    if (!fieldGroups[filter.field]) {
      fieldGroups[filter.field] = { and: [], or: [], not: [] }
    }

    const value = typeof filter.value === 'string' ? filter.value : String(filter.value)

    if (filter.op === 'and') {
      // 处理逗号分隔的值
      const values = value.split(',').map(v => v.trim())
      fieldGroups[filter.field].and.push(...values)
    } else if (filter.op === 'or') {
      const values = value.split(',').map(v => v.trim())
      fieldGroups[filter.field].or.push(...values)
    } else if (filter.op === 'not') {
      fieldGroups[filter.field].not.push(value)
    }
  }

  // 生成描述文本
  const descriptions: string[] = []

  for (const field of Object.keys(fieldGroups)) {
    const group = fieldGroups[field]
    const fieldName = fieldNameMap.value[field] || field
    const parts: string[] = []

    // 处理 and 条件
    if (group.and.length > 0) {
      parts.push(group.and.join('、'))
    }

    // 处理 or 条件
    if (group.or.length > 0) {
      if (parts.length > 0) {
        parts.push(`${t('library.filter_or')} ${group.or.join(` ${t('library.filter_or')} `)}`)
      } else {
        parts.push(group.or.join(` ${t('library.filter_or')} `))
      }
    }

    // 处理 not 条件
    if (group.not.length > 0) {
      if (parts.length > 0) {
        parts.push(`${t('library.filter_exclude')} ${group.not.join(`、${t('library.filter_exclude')} `)}`)
      } else {
        parts.push(`${t('library.filter_exclude')} ${group.not.join(`、${t('library.filter_exclude')} `)}`)
      }
    }

    if (parts.length > 0) {
      // 特殊处理价格区间
      if (field === 'library_price') {
        try {
          const priceData = JSON.parse(group.and[0] || '{}')
          if (priceData.start && priceData.end) {
            descriptions.push(`${fieldName}：${priceData.start} ${t('library.price_to')} ${priceData.end}`)
          }
        } catch {
          descriptions.push(`${fieldName}：${parts.join('，')}`)
        }
      } else if (field === 'sale_time_start' || field === 'sale_time_end') {
        // 处理年份
        const year = group.and[0] || group.or[0] || ''
        descriptions.push(`${fieldName}：${year}`)
      } else if (field === 'shop_country') {
        // 国家字段需要从配置中获取名称
        descriptions.push(`${fieldName}：${parts.join('，')}`)
      } else {
        descriptions.push(`${fieldName}：${parts.join('，')}`)
      }
    }
  }

  return descriptions.join('；')
}

// 清空筛选
const clearFilter = () => {
  filterForm.name = ''
  filterForm.shop_name = []
  filterForm.library_type = []
  filterForm.state = []
  filterForm.shop_country = -1
  filterForm.main_style = []
  filterForm.theme = []
  filterForm.color = []
  filterForm.library_pattern = []
  filterForm.design_elements = []
  filterForm.pattern_elements = []
  filterForm.cloth_elements = []
  filterForm.price = { start: '', end: '' }
  filterForm.sale_time_start = null
  filterForm.sale_time_end = null
  filterList.value = []
  filterDescription.value = ''
  waterList.value?.refresh()
}
// 处理点赞点击
const handleGoodClick = async (data: { pk_id: number; pk_type: number; type: number; library_id: number }) => {
  if (!user.token) {
    toast.add({
      title: t('library.please_login'),
      description: t('library.please_login'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  try {
    const result = await insertGood({
      pk_id: data.pk_id,
      pk_type: data.pk_type,
      type: data.type
    })
    console.log(result, '点赞结果')
    // 更新对应 item 的状态
    if (waterList.value && opearItem.value) {
      // 获取当前 item 的状态
      const currentItem = waterList.value.list?.find((item: Library) => item.library_id === opearItem.value)
      if (currentItem) {
        const updates: Partial<Library> = {}
        // result 为 true 表示点赞，false 表示取消点赞
        if (result) {
          updates.is_good = 1
          updates.good_count = (currentItem.good_count || 0) + 1
        } else {
          updates.is_good = 0
          updates.good_count = Math.max((currentItem.good_count || 0) - 1, 0)
        }
        console.log(updates.is_good, '更新后的item')
        waterList.value.updateItem('library_id', opearItem.value, updates)
      }
    }

    if (result) {
      toast.add({
        title: t('library.good_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: t('library.good_cancel'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    console.error('点赞操作失败:', error)
    toast.add({
      title: t('library.operation_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// 当前操作的 library_id（用于收藏成功后更新状态）
const currentCollectLibraryId = ref<number | null>(null)

// 处理收藏点击
const handleCollectClick = (data: { pk_id: number; collect_type: number; library_id: number }, event?: MouseEvent) => {
  if (!user.token) {
    toast.add({
      title: t('library.please_login'),
      description: t('library.please_login'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  // 保存当前操作的 library_id
  currentCollectLibraryId.value = data.library_id

  // 打开收藏夹选择弹窗
  const clickEvent = event || new MouseEvent('click', { clientX: 0, clientY: 0 })
  favoriteOptionsModalRef.value?.showModel({
    pk_id: data.pk_id,
    collect_type: data.collect_type
  }, clickEvent)
}

// 收藏变更处理
const handleCollectChange = (result: boolean) => {
  if (result) {
    toast.add({
      title: t('library.collect_success'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    // 更新对应 item 的状态
    if (waterList.value && currentCollectLibraryId.value) {
      const currentItem = waterList.value.list?.find((item: Library) => item.library_id === currentCollectLibraryId.value)
      if (currentItem) {
        const updates: Partial<Library> = {
          is_collect: 1,
          collect_count: (currentItem.collect_count || 0) + 1
        }
        waterList.value.updateItem('library_id', currentCollectLibraryId.value, updates)
      }
    }
  } else {
    toast.add({
      title: t('library.collect_cancel'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    if (waterList.value && currentCollectLibraryId.value) {
      const currentItem = waterList.value.list?.find((item: Library) => item.library_id === currentCollectLibraryId.value)
      if (currentItem) {
        const updates: Partial<Library> = {
          is_collect: 0,
          collect_count: (currentItem.collect_count || 0) - 1
        }
        waterList.value.updateItem('library_id', currentCollectLibraryId.value, updates)
      }
    }
  }
  // 清空当前操作的 library_id
  opearItem.value = null
  currentCollectLibraryId.value = null
}

// 处理加衣柜点击
const handleWardrobeClick = (data: { library: Library }) => {
  if (!user.token) {
    toast.add({
      title: t('library.please_login'),
      description: t('library.please_login'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  if (!data.library) {
    toast.add({
      title: t('library.library_not_found'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  // 打开图鉴颜色选择
  libraryTypeColorChooseRef.value?.showModel(data.library)
}

// 图鉴颜色选择完成
const handleLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddLibraryRef.value?.showModel(data)
}

// 衣柜添加成功
const handleWardrobeChange = (data?: { library_id?: number }) => {
  toast.add({
    title: t('library.add_success'),
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })

  // 更新对应 item 的状态
  if (waterList.value && data?.library_id) {
    const currentItem = waterList.value.list?.find((item: Library) => item.library_id === data.library_id)
    if (currentItem) {
      const updates: Partial<Library> = {
        is_wardrobe: 1,
        wardrobe_count: (currentItem.wardrobe_count || 0) + 1
      }
      waterList.value.updateItem('library_id', data.library_id, updates)
    }
  } else {
    // 如果没有传递 library_id，刷新整个列表
    waterList.value?.refresh()
  }
}

onMounted(async () => {
  if (window.innerWidth < 768) {
    column.value = 2
  }
  // setTimeout(() => {
  //   if (user.token) {
  //     console.log('是否服务端渲染', isServer.value)
  //     if (isServer.value) {
  //       isServer.value = false
  //       waterList.value?.refresh()
  //     }
  //   } else {
  //     isLoading.value = false
  //   }
  // });
  // 初始化选项数据
  await initOptions()
  // 获取配置
  await configStore.getConfig()
})

</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 搜索头部 -->
    <div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center gap-2">
        <UInput v-model="value" :placeholder="showFilterList ? t('library.search_placeholder_filter') : t('library.search_placeholder')"
          class="flex-1 focus:ring-0" :autofocus="false" @keyup.enter="handleSearch" :ui="{
            base: 'bg-qhx-primary text-qhx-primary focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: ' ring-1 ring-gray-300  focus:ring-2 focus:ring-qhx-primary',
                input: ' bg-qhx-primary',
              }
            }
          }" v-show="!showFilterList" />
        <UButton icon="i-heroicons-magnifying-glass" variant="ghost" color="gray" @click="handleSearch"
          v-show="!showFilterList" />
        <QhxTag :active="true" class="cursor-pointer whitespace-nowrap" @click="sortSelectRef?.showPicker($event)">
          {{ t('library.sort') }}: {{sortOptions.find(opt => opt.value === sortMode)?.label}}
        </QhxTag>
      </div>
    </div>
    <div class="flex grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <QhxTag :active="true" class="cursor-pointer whitespace-nowrap" @click="jumpToAddLibrary()">
          {{ t('library.add_library') }}
        </QhxTag>
        <QhxTag :active="true" class="cursor-pointer whitespace-nowrap" @click="jumpToCollectionList()">
          {{ t('library.not_found_request') }}
        </QhxTag>
    </div>

    <!-- 筛选头部 -->
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="flex items-center justify-between">
        <UCheckbox v-model="isCheck" :ui="{
          rounded: 'text-qhx-primary',
          color: 'qhx-primary',
          wrapper: 'cursor-pointer',
          base: 'cursor-pointer'
        }" @change="handleChange" class="cursor-pointer" :label="t('library.hide_sub_library')" name="remember" />
        <div class="flex items-center justify-end">
          <QhxTag :active="true" class="cursor-pointer" :variant="showFilterList ? 'solid' : 'outline'"
            @click="toggleSearchMode">
            {{ showFilterList ? t('library.fuzzy_search') : t('library.precise_search') }}
          </QhxTag>
        </div>
      </div>
      <div class="flex items-center justify-end">
        <QhxTag :active="true" class="cursor-pointer" :variant="showFilterList ? 'solid' : 'outline'"
            @click="jumpToDataVisualization()">
            {{ t('library.data_visualization') }}
          </QhxTag>
      </div>

    </div>
    <!-- 提示信息 -->
    <div v-if="!showFilterList" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('library.hide_sub_library_tip') }}
    </div>
    <!-- 精确搜索表单 -->
    <div v-if="showFilterList" class="px-4 pb-4 space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
      <!-- 图鉴名称 -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[80px]">{{ t('library.name') }}：</span>
        <UInput v-model="filterForm.name" :placeholder="t('library.search_placeholder_filter')" class="flex-1" :ui="{
          base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
          rounded: 'rounded-lg',
          padding: { xs: 'px-3 py-2' }
        }" />
      </div>

      <!-- 店名检索 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.shop_search') }}：</span>
        <div class="flex-1">
          <USelectMenu :placeholder="t('library.search_shop_placeholder')" :searchable="fetchShopOptiosns" option-attribute="shop_name"
            :multiple="false" trailing by="shop_id" name="shop_name" @update:model-value="handleShopSelect" class="mb-2"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg'
            }" />
          <div class="flex flex-wrap gap-2">
            <QhxTag v-for="(shop, index) in filterForm.shop_name" :key="index" :active="true" class="cursor-pointer"
              :backgroundColor="shop.type === 'and' ? '#317e10' : shop.type === 'or' ? '#0788dc' : '#e11031'">
              <div class="flex items-center gap-1">
                <span @click="changeFilterType(index, 'shop_name')">{{ shop.label }}</span>
                <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer" @click="deleteShop(shop.label)" />
              </div>
            </QhxTag>
          </div>
        </div>
      </div>

      <!-- 图鉴类型 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.type') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.library_type" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'library_type')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.library_type, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="libraryTypeSelectRef?.showPicker($event)">
            {{ t('library.select_type') }}
          </QhxTag>
        </div>
      </div>

      <!-- 图鉴状态 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.state') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.state" :key="index" :active="true" class="cursor-pointer">
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.state, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="stateSelectRef?.showPicker($event)">
            {{ t('library.select_state') }}
          </QhxTag>
        </div>
      </div>

      <!-- 国家 -->
      <div v-if="configStore.config" class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.country') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag :active="filterForm.shop_country === -1" class="cursor-pointer" @click="chooseCountry(-1)">
            {{ t('library.all') }}
          </QhxTag>
          <QhxTag v-for="item in configStore.config.shop_country" :key="item.value"
            :active="filterForm.shop_country === item.value" class="cursor-pointer" @click="chooseCountry(item.value)">
            {{ item.label }}
          </QhxTag>
        </div>
      </div>

      <!-- 主要风格 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.main_style') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.main_style" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'main_style')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.main_style, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="mainStyleSelectRef?.showPicker($event)">
            {{ t('library.select_style') }}
          </QhxTag>
        </div>
      </div>

      <!-- 图鉴主题 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.theme') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.theme" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'theme')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.theme, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('theme')">
            {{ t('library.select_theme') }}
          </QhxTag>
        </div>
      </div>

      <!-- 颜色配色 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.color') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.color" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'color')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.color, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('color')">
            {{ t('library.select_color') }}
          </QhxTag>
        </div>
      </div>

      <!-- 版型部位 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.pattern') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.library_pattern" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'library_pattern')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.library_pattern, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('library_pattern')">
            {{ t('library.select_pattern') }}
          </QhxTag>
        </div>
      </div>

      <!-- 设计元素 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.design_elements') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.design_elements" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'design_elements')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.design_elements, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('design_elements')">
            {{ t('library.select_design_elements') }}
          </QhxTag>
        </div>
      </div>

      <!-- 柄图元素 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.pattern_elements') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.pattern_elements" :key="index" :active="true"
            class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'pattern_elements')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.pattern_elements, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('pattern_elements')">
            {{ t('library.select_pattern_elements') }}
          </QhxTag>
        </div>
      </div>

      <!-- 材质布料 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.cloth_elements') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-for="(item, index) in filterForm.cloth_elements" :key="index" :active="true" class="cursor-pointer"
            :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'">
            <div class="flex items-center gap-1">
              <span @click="changeFilterType(index, 'cloth_elements')">{{ item.label }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.cloth_elements, index)" />
            </div>
          </QhxTag>
          <QhxTag class="cursor-pointer" @click="chooseWiki('cloth_elements')">
            {{ t('library.select_cloth_elements') }}
          </QhxTag>
        </div>
      </div>

      <!-- 价格区间 -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[80px]">{{ t('library.price_range') }}：</span>
        <div class="flex-1 flex items-center gap-2">
          <UInput v-model="filterForm.price.start" type="number" :placeholder="t('library.price_start')" class="flex-1" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-lg',
            padding: { xs: 'px-3 py-2' }
          }" />
          <span>{{ t('library.price_to') }}</span>
          <UInput v-model="filterForm.price.end" type="number" :placeholder="t('library.price_end')" class="flex-1" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-lg',
            padding: { xs: 'px-3 py-2' }
          }" />
        </div>
      </div>

      <!-- 发售年份 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">{{ t('library.sale_year') }}：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag v-if="filterForm.sale_time_start" :active="true" class="cursor-pointer">
            <div class="flex items-center gap-1">
              <span>{{ filterForm.sale_time_start }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="filterForm.sale_time_start = null" />
            </div>
          </QhxTag>
          <QhxTag v-else class="cursor-pointer" @click="saleTimeStartSelectRef?.showPicker($event)">
            {{ t('library.start_year') }}
          </QhxTag>
          <QhxTag v-if="filterForm.sale_time_end" :active="true" class="cursor-pointer">
            <div class="flex items-center gap-1">
              <span>{{ filterForm.sale_time_end }}</span>
              <UIcon name="i-heroicons-x-mark" class="text-xs cursor-pointer"
                @click="filterForm.sale_time_end = null" />
            </div>
          </QhxTag>
          <QhxTag v-else class="cursor-pointer" @click="saleTimeEndSelectRef?.showPicker($event)">
            {{ t('library.end_year') }}
          </QhxTag>
        </div>
      </div>
      <!-- 加一个tip表示各颜色tag的逻辑 -->
      <div v-if="!filterDescription"
        class="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 md:col-span-2">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-heroicons-information-circle" class="w-4 h-4 flex-shrink-0" />
          <span class="font-medium">{{ t('library.tag_logic') }}：</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded" style="background-color: #317e10;"></span>
          <span>{{ t('library.tag_and') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded" style="background-color: #0788dc;"></span>
          <span>{{ t('library.tag_or') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded" style="background-color: #e11031;"></span>
          <span>{{ t('library.tag_not') }}</span>
        </div>
        <span class="text-qhx-primary">{{ t('library.click_tag_to_switch') }}</span>
      </div>

      <!-- 筛选条件自然语言描述 -->
      <div v-if="filterDescription && showFilterList"
        class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 md:col-span-2 border border-blue-200 dark:border-blue-800">
        <div class="flex items-start gap-2">
          <UIcon name="i-heroicons-funnel" class="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div class="flex-1">
            <span class="font-medium text-blue-700 dark:text-blue-300">{{ t('library.current_filter') }}：</span>
            <span>{{ filterDescription }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-4 pt-2 md:col-span-2">
        <UButton color="primary" @click="applyFilter" class="px-6">
          {{ t('library.query') }}
        </UButton>
        <UButton color="red" variant="outline" @click="clearFilter" class="px-6">
          {{ t('library.clear') }}
        </UButton>
      </div>
    </div>
    <!-- 空状态 -->
    <QhxWaterList ref="waterList" v-if="layoutReady" :fetch-data="async (page, pageSize) => {

      const response = await getLibraryList({
        page: page,
        pageSize: pageSize,
        keyword: showFilterList ? null : keyword,
        filter_list: showFilterList ? filterList : [],
        need_Statistics: true,
        parent_id: parent_id,
        sort: sortMode
      })
      isLoading = false
      isCheck = parent_id
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="4" :itemKey="0" :columns_768="2" :enableWaterfall="true" :enableLoadMore="true">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item" :key="item.library_id">
          <LibraryItem :item="item" :show-actions="true" @image-load="debouncedApplyLayout" @good-click="(props: any) => {
            opearItem = item.library_id
            handleGoodClick(props)
          }" @collect-click="(props: any) => {
              opearItem = item.library_id
              handleCollectClick(props)
            }" @wardrobe-click="(props: any) => {
              opearItem = item.library_id
              handleWardrobeClick(props)
            }"></LibraryItem>
        </div>
      </template>
    </QhxWaterList>
    <!-- <div class="relative min-h-[600px]" v-if="total > 0">
      <div class="library-list w-1/2 md:w-1/4" v-for="library in list" :key="library.library_id">
        <LibraryItem :item="library" @image-load="debounceWater"></LibraryItem>
      </div>
    </div> -->
    <!-- <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div> -->
    <!-- <QhxLoading :loading="isLoading"></QhxLoading> -->
    <!-- 分页组件 -->
    <!-- <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination
        v-model="page"
        :total="total / 2"
        :ui="{
          wrapper: 'flex items-center gap-1',
          base: 'flex items-center gap-1',
        }"
        @change="handlePageChange"
      />
    </div> -->

    <!-- 选择器组件 -->
    <QhxSelect ref="mainStyleSelectRef" :options="options.main_style" @select="confirmMainStyle" />
    <QhxSelect ref="libraryTypeSelectRef" :options="options.library_type" @select="confirmLibraryType" />
    <QhxSelect ref="stateSelectRef" :options="options.state" @select="confirmState" />
    <QhxSelect ref="saleTimeStartSelectRef" :options="options.sale_time" @select="confirmSaleTimeStart" />
    <QhxSelect ref="saleTimeEndSelectRef" :options="options.sale_time" @select="confirmSaleTimeEnd" />
    <QhxSelect ref="sortSelectRef" :options="sortOptions"
      :default-value="sortOptions.find(opt => opt.value === sortMode) || sortOptions[0]" @select="onSortChange" />

    <!-- Wiki选择组件 -->
    <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="onWikiChoose" />

    <!-- 加入衣柜相关组件 -->
    <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <WardrobeAddLibrary ref="wardrobeAddLibraryRef" @change="handleWardrobeChange" />

    <!-- 收藏夹选择组件 -->
    <FavoriteOptionsModal ref="favoriteOptionsModalRef" @change="handleCollectChange" />
  </div>
</template>

<style scoped>
.library-list {
  position: absolute;
  transition: 0.3s;
}

.grid {
  container-type: inline-size;
}

@container (min-width: 200px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

/* 添加卡片阴影效果 */
.u-card {
  @apply shadow-sm hover:shadow-md dark:shadow-gray-800;
}

/* 优化图片容器 */
.aspect-\[4\/3\] {
  aspect-ratio: 4/3;
}

/* 适配暗色主题的过渡效果 */
.group:hover .group-hover\:scale-110 {
  @apply transform scale-110 transition-transform duration-300;
}

.badge-tip {
  position: absolute;
  left: calc(50% - 49px);
  top: calc(50% - 45px);
  font-size: 40px;
  z-index: 10;
  width: 80px;
  text-align: center;
  transform: rotate(-45deg);
  color: var(--error-color);
}

/* 拍立得风格卡片样式 */
</style>
