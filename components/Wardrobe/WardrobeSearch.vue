<template>
  <QhxBottomDrawer 
    v-if="show" 
    :direction="isMobile ? 'bottom' : 'right'" 
    :default-size="isMobile ? 600 : 500"
  >
    <div class="flex flex-col h-full">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between mb-2 px-4 pt-2 flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-3">
        <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">搜索衣柜</h3>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 可滚动内容区域 -->
      <div class="flex-1 overflow-y-auto px-4 py-2">
        <!-- 所属衣柜 -->
        <div v-if="wardrobeList.length > 0" class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">所属衣柜：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.wardrobe_id"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteArr(filter_list.wardrobe_id, index)" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="openWardrobeSelect">
              选择衣柜
            </QhxTag>
          </div>
        </div>

        <!-- 搜索名称 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">搜索名称：</div>
          <UInput 
            v-model="filter_list.clothes_note" 
            placeholder="搜索名称"
            class="flex-1"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </div>

        <!-- 搜索笔记 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">搜索笔记：</div>
          <UInput 
            v-model="filter_list.note" 
            placeholder="搜索笔记"
            class="flex-1"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </div>

        <!-- 筛选颜色 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">筛选颜色：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <div
              v-for="(color, index) in filter_list.color"
              :key="index"
              :style="{ background: color, width: '35px', height: '35px', borderRadius: '8px' }"
              class="relative cursor-pointer"
            >
              <button
                @click="deleteArr(filter_list.color, index)"
                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
              >
                <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
              </button>
            </div>
            <QhxTag class="cursor-pointer" @click="showColorChoose = true">
              颜色选择
            </QhxTag>
          </div>
        </div>

        <!-- 拥有状态 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">拥有状态：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.wardrobe_status"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.label, 'wardrobeStatus')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openStatusSelect"
            >
              选择状态
            </UButton>
          </div>
        </div>

        <!-- 版型部位 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">版型部位：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.clothes_part"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.label, 'clothesPart')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openClothesPartSelect"
            >
              选择部位
            </UButton>
          </div>
        </div>

        <!-- 价格区间 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">价格区间：</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.price.start_price"
              type="number"
              placeholder="起"
              class="flex-1"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">到</span>
            <UInput
              v-model="filter_list.price.end_price"
              type="number"
              placeholder="末"
              class="flex-1"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </div>
        </div>

        <!-- 穿着次数 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">穿着次数：</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.times.start_times"
              type="number"
              placeholder="起"
              class="flex-1"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">到</span>
            <UInput
              v-model="filter_list.times.end_times"
              type="number"
              placeholder="末"
              class="flex-1"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </div>
        </div>

        <!-- 适宜季节 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">适宜季节：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.season"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteArr(filter_list.season, index)" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="openSeasonSelect">
              选择季节
            </QhxTag>
          </div>
        </div>

        <!-- 搜索标签 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">搜索标签：</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.tags"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.label, 'tags')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openTagsSelect"
            >
              选择标签
            </UButton>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="mb-4 flex gap-2">
          <UButton
            color="primary"
            class="flex-1"
            @click="handleSearch"
          >
            搜索
          </UButton>
          <UButton
            color="gray"
            variant="outline"
            class="flex-1"
            @click="clearFilter"
          >
            清空
          </UButton>
        </div>

        <!-- 搜索结果列表 -->
        <div class="clothes-list-wrap">
          <div
            v-for="(item, index) in list"
            :key="index"
            class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="chooseClothes(item)"
          >
            <div class="flex gap-3">
              <div
                class="clothes-cover flex-shrink-0"
              >
                <img
                  :src="BASE_IMG + item.clothes_img"
                  :alt="item.clothes_note || '服饰图片'"
                  class="w-[100px] h-[100px] object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
              <div class="flex-1 min-w-0" @click.stop="jumpToClothes(item)">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {{ item.clothes_note || '暂无笔记' }}
                </div>
                <div v-if="item.price" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  价格：{{ item.price }}
                </div>
                <div v-if="item.times !== undefined && item.times !== null" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  穿着次数：{{ item.times }}
                </div>
                <div v-if="item.color" class="flex items-center gap-1 mb-1">
                  <span class="text-xs text-gray-600 dark:text-gray-400">颜色：</span>
                  <div
                    v-for="(color, colorIndex) in item.color.split(',')"
                    :key="colorIndex"
                    :style="{ background: color, width: '20px', height: '20px', borderRadius: '4px' }"
                    class="inline-block"
                  />
                </div>
                <div v-if="item.season" class="flex flex-wrap gap-1 mb-1">
                  <span class="text-xs text-gray-600 dark:text-gray-400">季节：</span>
                  <QhxTag
                    v-for="(season, seasonIndex) in item.season.split(',')"
                    :key="seasonIndex"
                    size="xs"
                  >
                    {{ season }}
                  </QhxTag>
                </div>
                <div v-if="item.wardrobe_status" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  状态：{{ item.wardrobe_status }}
                </div>
                <div v-if="item.clothes_part" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  部位：{{ item.clothes_part }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-500 mt-2 text-right">
                  {{ formatDate(item.date) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <QhxLoading
          :loading="loading"
          :page="page"
          :total="total"
          :page-size="pageSize"
          @load-more="loadMore"
        />
      </div>
    </div>

    <!-- 季节选择 -->
    <QhxSelect
      v-model="showSeasonSelect"
      ref="seasonSelectRef"
      :options="seasonOptions"
      @select="confirmSeason"
    />

    <!-- 衣柜选择 -->
    <QhxSelect
      v-model="showWardrobeSelect"
      ref="wardrobeSelectRef"
      :options="wardrobeOptions"
      @select="confirmWardrobe"
    />

    <!-- 状态选择 -->
    <QhxSelect
      v-model="showStatusSelect"
      ref="statusSelectRef"
      :options="wardrobeStatusOptions"
      :can-customize="true"
      @select="confirmStatus"
    />

    <!-- 部位选择 -->
    <QhxSelect
      v-model="showClothesPartSelect"
      ref="clothesPartSelectRef"
      :options="clothesPartOptions"
      :can-customize="true"
      @select="confirmClothesPart"
    />

    <!-- 标签选择 -->
    <QhxSelect
      v-model="showTagsSelect"
      ref="tagsSelectRef"
      :options="tagsOptions"
      :can-customize="true"
      @select="confirmTags"
    />

    <!-- 颜色选择弹窗 -->
    <UModal v-model="showColorChoose">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">选择颜色</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="showColorChoose = false"
            />
          </div>
        </template>
        <div class="p-4">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">为了方便检索，请优先选择衣柜内已有的颜色</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(color, index) in wardrobeColors"
              :key="index"
              :style="{ background: color, width: '35px', height: '35px', borderRadius: '8px' }"
              class="cursor-pointer hover:opacity-80 transition-opacity"
              @click="colorChoose(color)"
            />
            <div v-if="wardrobeColors.length === 0" class="text-sm text-gray-500">
              衣柜内暂无颜色
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </QhxBottomDrawer>
</template>

<script setup lang="ts">
import type { Wardrobe, WardrobeClothes } from '@/types/api'
import { getClothesSearch } from '@/api/wardrobe'
import type QhxSelect from '@/components/Qhx/Select.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'

interface Props {
  wardrobeList?: Wardrobe[]
  needStatus?: boolean
  canChoose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  wardrobeList: () => [],
  needStatus: false,
  canChoose: false
})

const emit = defineEmits<{
  choose: [item: WardrobeClothes]
}>()

const show = ref(false)
const list = ref<WardrobeClothes[]>([])
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const toast = useToast()
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
let uni: any
const port = computed(() => configStore.getPort())

// 判断是否为移动端
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

// 季节选项
const seasonOptions = [
  { value: '春', label: '春' },
  { value: '夏', label: '夏' },
  { value: '秋', label: '秋' },
  { value: '冬', label: '冬' }
]

// 衣柜选项
const wardrobeOptions = computed(() => {
  return props.wardrobeList.map((item) => ({
    value: item.wardrobe_id,
    label: item.wardrobe_name
  }))
})

// 衣柜状态选项
const wardrobeStatusOptions = computed(() => {
  if (!wardrobeStore.config?.wardrobe_status) return []
  return wardrobeStore.config.wardrobe_status
    .filter((status: string) => status !== '自定义')
    .map((status: string) => ({
      label: status,
      value: status
    }))
})

// 版型部位选项
const clothesPartOptions = computed(() => {
  if (!wardrobeStore.config?.clothes_part) return []
  return wardrobeStore.config.clothes_part.map((part: string) => ({
    label: part,
    value: part
  }))
})

// 标签选项（从配置中获取，如果没有则使用空数组）
const tagsOptions = computed(() => {
  // 这里可以根据实际需求从配置或API获取标签列表
  return []
})

// 衣柜颜色列表（从配置中获取）
const wardrobeColors = computed(() => {
  if (!wardrobeStore.config?.color_list) return []
  return wardrobeStore.config.color_list
})

// 筛选条件
const filter_list = ref({
  wardrobe_id: [] as Array<{ value: number | string; label: string }>,
  color: [] as string[],
  times: {
    start_times: null as number | null,
    end_times: null as number | null
  },
  price: {
    start_price: null as number | null,
    end_price: null as number | null
  },
  season: [] as Array<{ value: string; label: string }>,
  clothes_note: '',
  wardrobe_status: [] as Array<{ value: string; label: string }>,
  clothes_part: [] as Array<{ value: string; label: string }>,
  note: '',
  tags: [] as Array<{ value: string; label: string }>
})

const filter_list1 = ref<Array<{ field: string; op: string; value: string | number }>>([])

// 控制显示
const show_control = ref({
  color_choose: false,
  season: false,
  wardrobe: false
})

const showSeasonSelect = ref(false)
const showWardrobeSelect = ref(false)
const showStatusSelect = ref(false)
const showClothesPartSelect = ref(false)
const showTagsSelect = ref(false)
const showColorChoose = ref(false)

// 选择器引用
const seasonSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const wardrobeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const statusSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const clothesPartSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const tagsSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

// 打开选择器
const openStatusSelect = (e: MouseEvent) => {
  showStatusSelect.value = true
  nextTick(() => {
    statusSelectRef.value?.showPicker(e)
  })
}

const openClothesPartSelect = (e: MouseEvent) => {
  showClothesPartSelect.value = true
  nextTick(() => {
    clothesPartSelectRef.value?.showPicker(e)
  })
}

const openTagsSelect = (e: MouseEvent) => {
  showTagsSelect.value = true
  nextTick(() => {
    tagsSelectRef.value?.showPicker(e)
  })
}

const openSeasonSelect = (e: MouseEvent) => {
  showSeasonSelect.value = true
  nextTick(() => {
    seasonSelectRef.value?.showPicker(e)
  })
}

const openWardrobeSelect = (e: MouseEvent) => {
  showWardrobeSelect.value = true
  nextTick(() => {
    wardrobeSelectRef.value?.showPicker(e)
  })
}

// 删除数组项
const deleteArr = (arr: any[], index: number) => {
  arr.splice(index, 1)
}

// 删除远程选择项
const deleteRemote = (str: string, type: 'wardrobeStatus' | 'clothesPart' | 'tags') => {
  if (type === 'wardrobeStatus') {
    const index = filter_list.value.wardrobe_status.findIndex(item => item.label === str)
    if (index !== -1) {
      filter_list.value.wardrobe_status.splice(index, 1)
    }
  } else if (type === 'clothesPart') {
    const index = filter_list.value.clothes_part.findIndex(item => item.label === str)
    if (index !== -1) {
      filter_list.value.clothes_part.splice(index, 1)
    }
  } else if (type === 'tags') {
    const index = filter_list.value.tags.findIndex(item => item.label === str)
    if (index !== -1) {
      filter_list.value.tags.splice(index, 1)
    }
  }
}

// 确认选择
const confirmSeason = (v: { value: string; label: string }) => {
  const hasValue = filter_list.value.season.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.season.push(v)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showSeasonSelect.value = false
}

const confirmWardrobe = (v: { value: number | string; label: string }) => {
  const hasValue = filter_list.value.wardrobe_id.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.wardrobe_id.push(v)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showWardrobeSelect.value = false
}

const confirmStatus = (v: { value: string; label: string }) => {
  const hasValue = filter_list.value.wardrobe_status.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.wardrobe_status.push(v)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showStatusSelect.value = false
}

const confirmClothesPart = (v: { value: string; label: string }) => {
  const hasValue = filter_list.value.clothes_part.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.clothes_part.push(v)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showClothesPartSelect.value = false
}

const confirmTags = (v: { value: string; label: string }) => {
  const hasValue = filter_list.value.tags.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.tags.push(v)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showTagsSelect.value = false
}

// 选择颜色
const colorChoose = (hex: string) => {
  const index = filter_list.value.color.findIndex(item => item === hex)
  if (index === -1) {
    filter_list.value.color.push(hex)
  } else {
    toast.add({
      title: '重复添加',
      type: 'warning'
    })
  }
  showColorChoose.value = false
}

// 选择服饰
const chooseClothes = (item: WardrobeClothes) => {
  if (props.canChoose) {
    emit('choose', item)
    closeModel()
  }
}

// 跳转到服饰详情
const jumpToClothes = (item: WardrobeClothes) => {
  if (!props.canChoose) {
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/common/outerLink?url=https://lolitalibrary.com/clothes/detail/${item.clothes_id}`,
        fail: () => {
          console.log('跳转错误')
        }
      })
    } else {
      if (port.value) {
        // 鸿蒙系统
        port.value.postMessage(JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: {
            url: `https://lolitalibrary.com/clothes/detail/${item.clothes_id}`
          }
        }))
      } else {
        // 普通网页环境
        window.open(`https://lolitalibrary.com/clothes/detail/${item.clothes_id}`, '_blank')
      }
    }
  }
}

// 格式化筛选列表
const formatFilterList = () => {
  const filterList: Array<{ field: string; op: string; value: string | number }> = []

  // 颜色
  if (filter_list.value.color.length > 0) {
    filterList.push({
      field: 'color',
      op: 'and',
      value: filter_list.value.color.join(',')
    })
  }

  // 穿着次数
  const { start_times, end_times } = filter_list.value.times
  if (start_times !== null && start_times !== undefined && start_times !== '') {
    filterList.push({
      field: 'start_times',
      op: 'and',
      value: start_times
    })
  }
  if (end_times !== null && end_times !== undefined && end_times !== '') {
    filterList.push({
      field: 'end_times',
      op: 'and',
      value: end_times
    })
  }

  // 价格
  const { start_price, end_price } = filter_list.value.price
  if (start_price !== null && start_price !== undefined && start_price !== '') {
    filterList.push({
      field: 'start_price',
      op: 'and',
      value: start_price
    })
  }
  if (end_price !== null && end_price !== undefined && end_price !== '') {
    filterList.push({
      field: 'end_price',
      op: 'and',
      value: end_price
    })
  }

  // 名称
  if (filter_list.value.clothes_note && filter_list.value.clothes_note.trim() !== '') {
    filterList.push({
      field: 'clothes_note',
      op: 'and',
      value: filter_list.value.clothes_note
    })
  }

  // 笔记
  if (filter_list.value.note && filter_list.value.note.trim() !== '') {
    filterList.push({
      field: 'note',
      op: 'and',
      value: filter_list.value.note
    })
  }

  // 状态
  if (filter_list.value.wardrobe_status.length > 0) {
    filterList.push({
      field: 'wardrobe_status',
      op: 'and',
      value: filter_list.value.wardrobe_status.map(v => v.label).join(',')
    })
  }

  // 标签
  if (filter_list.value.tags.length > 0) {
    filterList.push({
      field: 'tags',
      op: 'and',
      value: filter_list.value.tags.map(v => v.label).join(',')
    })
  }

  // 部位
  if (filter_list.value.clothes_part.length > 0) {
    filterList.push({
      field: 'clothes_part',
      op: 'and',
      value: filter_list.value.clothes_part.map(v => v.label).join(',')
    })
  }

  // 季节
  if (filter_list.value.season.length > 0) {
    filterList.push({
      field: 'season',
      op: 'and',
      value: filter_list.value.season.map(v => v.label).join(',')
    })
  }

  return filterList
}

// 搜索
const handleSearch = () => {
  filter_list1.value = formatFilterList()
  page.value = 1
  getClothesSearchData()
}

// 清空筛选
const clearFilter = () => {
  filter_list.value = {
    wardrobe_id: [],
    color: [],
    times: {
      start_times: null,
      end_times: null
    },
    price: {
      start_price: null,
      end_price: null
    },
    season: [],
    clothes_note: '',
    wardrobe_status: [],
    clothes_part: [],
    note: '',
    tags: []
  }
  reload()
}

// 加载更多
const loadMore = () => {
  if (loading.value) {
    toast.add({
      title: '正在加载',
      type: 'warning'
    })
    return
  }
  const maxLength = Math.ceil(total.value / pageSize.value)
  if (page.value < maxLength) {
    page.value += 1
    getClothesSearchData()
  } else {
    toast.add({
      title: '没有更多',
      type: 'info'
    })
  }
}

// 获取搜索数据
const getClothesSearchData = async () => {
  const wardrobe_id: number[] = []
  if (filter_list.value.wardrobe_id.length > 0) {
    filter_list.value.wardrobe_id.forEach((item) => {
      wardrobe_id.push(Number(item.value))
    })
  }

  const params = {
    filter_list: filter_list1.value,
    page: page.value,
    pageSize: pageSize.value,
    wardrobe_id: wardrobe_id.length > 0 ? wardrobe_id : undefined
  }

  loading.value = true
  try {
    const res = await getClothesSearch(params)
    const data = res.rows
    total.value = res.count
    if (params.page === 1) {
      list.value = data
    } else {
      list.value.push(...data)
    }
  } catch (error) {
    console.error('搜索失败:', error)
    toast.add({
      title: '搜索失败',
      type: 'error'
    })
  } finally {
    loading.value = false
  }
}

// 重新加载
const reload = () => {
  page.value = 1
  filter_list1.value = formatFilterList()
  getClothesSearchData()
}

// 格式化日期
const formatDate = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  try {
    return dayjs(dateStr).format('YYYY-MM-DD')
  } catch {
    return String(dateStr)
  }
}

// 显示模态框
const showModel = () => {
  show.value = true
  if (props.canChoose) {
    handleSearch()
  }
}

// 关闭模态框
const closeModel = () => {
  show.value = false
  initData()
}

// 初始化数据
const initData = () => {
  list.value = []
  filter_list.value = {
    wardrobe_id: [],
    color: [],
    times: {
      start_times: null,
      end_times: null
    },
    price: {
      start_price: null,
      end_price: null
    },
    season: [],
    clothes_note: '',
    wardrobe_status: [],
    clothes_part: [],
    note: '',
    tags: []
  }
  filter_list1.value = []
  page.value = 1
  total.value = 0
}

// 暴露方法
defineExpose({
  showModel,
  closeModel
})

// 初始化 uni
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
})

// 监听衣柜列表变化
watch(() => props.wardrobeList, () => {
  // 衣柜列表变化时的处理
}, { deep: true })
</script>

<style scoped>
.clothes-cover {
  width: 100px;
  height: 100px;
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 1px 1px 10px rgba(0, 0, 0, 0.1);
}
</style>

