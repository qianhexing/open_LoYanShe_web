<script setup lang="ts">
import type { Library, PaginationResponse, FilterList, Wiki } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getLibraryList } from '@/api/library';
import { getWikiOptionsByKeywords } from '@/api/wiki';
import { getShopOptiosns } from '@/api/shop';
import authGlobal from '@/middleware/auth.global'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type WikiOptionsChooseType from '@/components/wiki/wikiOptionsChoose.vue'
import type { default as QhxSelect } from '@/components/Qhx/Select.vue'

const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const user = useUserStore()
const configStore = useConfigStore()
const router = useRouter()
const route = useRoute()
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
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChooseType> | null>(null)

// 筛选表单数据
const filterForm = reactive({
  name: '',
  shop_name: [] as Array<{ label: string; value: string }>,
  library_type: [] as Array<{ label: string; value: number }>,
  state: [] as Array<{ label: string; value: number }>,
  shop_country: -1,
  main_style: [] as Array<{ label: string; value: number }>,
  theme: [] as Array<{ label: string; value: number }>,
  color: [] as Array<{ label: string; value: number }>,
  library_pattern: [] as Array<{ label: string; value: number }>,
  design_elements: [] as Array<{ label: string; value: number }>,
  pattern_elements: [] as Array<{ label: string; value: number }>,
  cloth_elements: [] as Array<{ label: string; value: number }>,
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
	title: 'Lolita图鉴',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,洛丽塔图鉴,Lolita,Lolita图鉴,Lolita图书馆'
		},
		{
			name: 'description',
			content: '洛丽塔图书馆汇总,Lolita图书馆'
		}
	]
})
definePageMeta({
  name: 'library',
  middleware: [authGlobal]
})
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

// 切换搜索模式
const toggleSearchMode = () => {
  showFilterList.value = !showFilterList.value
  if (!showFilterList.value) {
    // 切换到模糊搜索，清空筛选条件
    clearFilter()
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
const searchShop = async (query: string) => {
  if (!query) {
    options.shop_name = []
    return
  }
  try {
    const res = await getShopOptiosns({ shop_name: query })
    options.shop_name = res.map(item => ({
      label: item.shop_name,
      value: item.shop_name
    }))
  } catch (error) {
    console.error('搜索店铺失败:', error)
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
    const arr = filterForm[type as keyof typeof filterForm] as Array<{ label: string; value: number }>
    for (const child of list) {
      if (child.wiki_name && child.wiki_id) {
        const index = arr.findIndex((element) => element.label === child.wiki_name)
        if (index === -1) {
          arr.push({
            label: child.wiki_name,
            value: child.wiki_id as number
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

// 确认主要风格
const confirmMainStyle = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.main_style.some(item => item.value === selected.value)
    if (!hasValue) {
      filterForm.main_style.push(selected)
    }
  }
}

// 确认图鉴类型
const confirmLibraryType = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.library_type.some(item => item.label === selected.label)
    if (!hasValue) {
      filterForm.library_type.push(selected)
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
    const colorValue = filterForm.color.map(v => v.label).join(',')
    temp.push({
      field: 'color',
      op: 'and',
      value: colorValue
    })
  }

  // 主题
  if (filterForm.theme.length > 0) {
    const themeValue = filterForm.theme.map(v => v.label).join(',')
    temp.push({
      field: 'theme',
      op: 'and',
      value: themeValue
    })
  }

  // 版型部位
  if (filterForm.library_pattern.length > 0) {
    const patternValue = filterForm.library_pattern.map(v => v.label).join(',')
    temp.push({
      field: 'library_pattern',
      op: 'and',
      value: patternValue
    })
  }

  // 主要风格
  if (filterForm.main_style.length > 0) {
    const mainStyleValue = filterForm.main_style.map(v => v.value).join(',')
    temp.push({
      field: 'main_style',
      op: 'and',
      value: mainStyleValue
    })
  }

  // 店铺名称
  if (filterForm.shop_name.length > 0) {
    const shopNameValue = filterForm.shop_name.map(v => v.value).join(',')
    temp.push({
      field: 'shop_name',
      op: 'and',
      value: shopNameValue
    })
  }

  // 图鉴类型
  if (filterForm.library_type.length > 0) {
    const libraryTypeValue = filterForm.library_type.map(v => v.label).join(',')
    temp.push({
      field: 'library_type',
      op: 'and',
      value: libraryTypeValue
    })
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
      title: '价格区间需有起末',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  // 柄图元素
  if (filterForm.pattern_elements.length > 0) {
    const patternElementsValue = filterForm.pattern_elements.map(v => v.label).join(',')
    temp.push({
      field: 'pattern_elements',
      op: 'and',
      value: patternElementsValue
    })
  }

  // 设计元素
  if (filterForm.design_elements.length > 0) {
    const designElementsValue = filterForm.design_elements.map(v => v.label).join(',')
    temp.push({
      field: 'design_elements',
      op: 'and',
      value: designElementsValue
    })
  }

  // 材质布料
  if (filterForm.cloth_elements.length > 0) {
    const clothElementsValue = filterForm.cloth_elements.map(v => v.label).join(',')
    temp.push({
      field: 'cloth_elements',
      op: 'and',
      value: clothElementsValue
    })
  }

  filterList.value = temp
  keyword.value = ''
  waterList.value?.refresh()
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
  waterList.value?.refresh()
}
onMounted(async () => {
  if (window.innerWidth < 768) {
    column.value = 2
  }
  if (user.token) {
    console.log('是否服务端渲染', isServer.value)
    if (isServer.value) {
      isServer.value = false
      waterList.value?.refresh()
    }
  } else {
    isLoading.value = false
  }
  // 初始化选项数据
  await initOptions()
  // 获取配置
  await configStore.getConfig()
})

</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 搜索头部 -->
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center" v-if="!showFilterList">
        <UInput
          v-model="value"
          :placeholder="showFilterList ? '图鉴名检索,多条件空格分割' : '搜索图鉴 多条件空格分割.'"
          class="flex-1 focus:ring-0"
          :autofocus="false"
          @keyup.enter="handleSearch"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }"
        />
        <UButton
          icon="i-heroicons-magnifying-glass"
          variant="ghost"
          color="gray"
          @click="handleSearch"
        />
      </div>
    </div>
    
    <!-- 筛选头部 -->
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="flex items-center justify-between">
        <UCheckbox 
          v-model="isCheck"
          :ui="{ 
            rounded: 'text-qhx-primary',
            color: 'qhx-primary',
            wrapper: 'cursor-pointer',
            base: 'cursor-pointer'
          }"
          @change="handleChange"
          class="cursor-pointer"
          label="不显示子图鉴"
          name="remember"
        />
      </div>
      <div class="flex items-center justify-end">
        <UButton
          :variant="showFilterList ? 'solid' : 'outline'"
          color="primary"
          @click="toggleSearchMode"
          size="sm"
        >
          {{ showFilterList ? '模糊搜索' : '精确搜索' }}
        </UButton>
      </div>
    </div>

    <!-- 精确搜索表单 -->
    <div v-if="showFilterList" class="px-4 pb-4 space-y-4">
      <!-- 提示信息 -->
      <div v-if="!showFilterList" class="text-sm text-gray-500 dark:text-gray-400">
        不显示子图鉴时，仅显示父级图鉴
      </div>

      <!-- 图鉴名称 -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[80px]">图鉴名称：</span>
        <UInput
          v-model="filterForm.name"
          placeholder="图鉴名检索,多条件空格分割"
          class="flex-1"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-lg',
            padding: { xs: 'px-3 py-2' }
          }"
        />
      </div>

      <!-- 店名检索 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">店名检索：</span>
        <div class="flex-1">
          <USelectMenu
            :options="options.shop_name"
            placeholder="搜索店铺..."
            searchable
            :searchable-placeholder="'搜索店铺...'"
            @search="searchShop"
            option-attribute="label"
            value-attribute="value"
            class="mb-2"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg'
            }"
          />
          <div class="flex flex-wrap gap-2">
            <QhxTag
              v-for="(shop, index) in filterForm.shop_name"
              :key="index"
              :active="true"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                <span>{{ shop.label }}</span>
                <UIcon
                  name="i-heroicons-x-mark"
                  class="text-xs cursor-pointer"
                  @click="deleteShop(shop.label)"
                />
              </div>
            </QhxTag>
          </div>
        </div>
      </div>

      <!-- 图鉴类型 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">图鉴类型：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.library_type"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.library_type, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="libraryTypeSelectRef?.showPicker($event)"
          >
            选择类型
          </QhxTag>
        </div>
      </div>

      <!-- 图鉴状态 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">图鉴状态：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.state"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.state, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="stateSelectRef?.showPicker($event)"
          >
            选择状态
          </QhxTag>
        </div>
      </div>

      <!-- 国家 -->
      <div v-if="configStore.config" class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">国家：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            :active="filterForm.shop_country === -1"
            class="cursor-pointer"
            @click="chooseCountry(-1)"
          >
            全部
          </QhxTag>
          <QhxTag
            v-for="item in configStore.config.shop_country"
            :key="item.value"
            :active="filterForm.shop_country === item.value"
            class="cursor-pointer"
            @click="chooseCountry(item.value)"
          >
            {{ item.label }}
          </QhxTag>
        </div>
      </div>

      <!-- 主要风格 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">主要风格：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.main_style"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.main_style, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="mainStyleSelectRef?.showPicker($event)"
          >
            选择风格
          </QhxTag>
        </div>
      </div>

      <!-- 图鉴主题 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">图鉴主题：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.theme"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.theme, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('theme')"
          >
            选择主题
          </QhxTag>
        </div>
      </div>

      <!-- 颜色配色 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">颜色配色：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.color"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.color, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('color')"
          >
            选择颜色
          </QhxTag>
        </div>
      </div>

      <!-- 版型部位 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">版型部位：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.library_pattern"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.library_pattern, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('library_pattern')"
          >
            选择版型部位
          </QhxTag>
        </div>
      </div>

      <!-- 设计元素 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">设计元素：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.design_elements"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.design_elements, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('design_elements')"
          >
            选择设计元素
          </QhxTag>
        </div>
      </div>

      <!-- 柄图元素 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">柄图元素：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.pattern_elements"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.pattern_elements, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('pattern_elements')"
          >
            选择柄图元素
          </QhxTag>
        </div>
      </div>

      <!-- 材质布料 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">材质布料：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-for="(item, index) in filterForm.cloth_elements"
            :key="index"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ item.label }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="deleteArrayItem(filterForm.cloth_elements, index)"
              />
            </div>
          </QhxTag>
          <QhxTag
            class="cursor-pointer"
            @click="chooseWiki('cloth_elements')"
          >
            选择材质布料
          </QhxTag>
        </div>
      </div>

      <!-- 价格区间 -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[80px]">价格区间：</span>
        <div class="flex-1 flex items-center gap-2">
          <UInput
            v-model="filterForm.price.start"
            type="number"
            placeholder="起"
            class="flex-1"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg',
              padding: { xs: 'px-3 py-2' }
            }"
          />
          <span>到</span>
          <UInput
            v-model="filterForm.price.end"
            type="number"
            placeholder="末"
            class="flex-1"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg',
              padding: { xs: 'px-3 py-2' }
            }"
          />
        </div>
      </div>

      <!-- 发售年份 -->
      <div class="flex items-start gap-2">
        <span class="text-sm font-medium min-w-[80px] pt-2">发售年份：</span>
        <div class="flex-1 flex flex-wrap gap-2">
          <QhxTag
            v-if="filterForm.sale_time_start"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ filterForm.sale_time_start }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="filterForm.sale_time_start = null"
              />
            </div>
          </QhxTag>
          <QhxTag
            v-else
            class="cursor-pointer"
            @click="saleTimeStartSelectRef?.showPicker($event)"
          >
            起始年份
          </QhxTag>
          <QhxTag
            v-if="filterForm.sale_time_end"
            :active="true"
            class="cursor-pointer"
          >
            <div class="flex items-center gap-1">
              <span>{{ filterForm.sale_time_end }}</span>
              <UIcon
                name="i-heroicons-x-mark"
                class="text-xs cursor-pointer"
                @click="filterForm.sale_time_end = null"
              />
            </div>
          </QhxTag>
          <QhxTag
            v-else
            class="cursor-pointer"
            @click="saleTimeEndSelectRef?.showPicker($event)"
          >
            结束年份
          </QhxTag>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-4 pt-2">
        <UButton
          color="primary"
          @click="applyFilter"
          class="px-6"
        >
          查询
        </UButton>
        <UButton
          color="red"
          variant="outline"
          @click="clearFilter"
          class="px-6"
        >
          清空
        </UButton>
      </div>
    </div>
    <!-- 空状态 -->
    <QhxWaterList ref="waterList"
    :fetch-data="async (page, pageSize) => {
      
      const response = await getLibraryList({
        page: page,
        pageSize: pageSize,
        keyword: showFilterList ? null : keyword,
        filter_list: showFilterList ? filterList : [],
        need_Statistics: true,
        parent_id: parent_id
      })
      isLoading = false
      isCheck = parent_id
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="4" :itemKey="0"  :columns_768="2" :enableWaterfall="true" :enableLoadMore="true">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item" :key="item.library_id">
          <LibraryItem :item="item" @image-load="debouncedApplyLayout"></LibraryItem>
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
    <QhxSelect
      ref="mainStyleSelectRef"
      :options="options.main_style"
      @select="confirmMainStyle"
    />
    <QhxSelect
      ref="libraryTypeSelectRef"
      :options="options.library_type"
      @select="confirmLibraryType"
    />
    <QhxSelect
      ref="stateSelectRef"
      :options="options.state"
      @select="confirmState"
    />
    <QhxSelect
      ref="saleTimeStartSelectRef"
      :options="options.sale_time"
      @select="confirmSaleTimeStart"
    />
    <QhxSelect
      ref="saleTimeEndSelectRef"
      :options="options.sale_time"
      @select="confirmSaleTimeEnd"
    />

    <!-- Wiki选择组件 -->
    <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="onWikiChoose" />
  </div>
</template>

<style scoped>
.library-list{
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
.badge-tip{
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


