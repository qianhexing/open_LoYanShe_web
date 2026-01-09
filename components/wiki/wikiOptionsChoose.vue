<template>

	<UModal v-model="show" @close="closeModel" :ui="{ width: 'max-w-3xl'  }">
		<UCard>
      <template #header>
        <div>
					<div class="flex justify-between items-center">
						<h2 class="text-lg font-semibold">
							选择词条
						</h2>
						<UButton
							color="gray"
							variant="ghost"
							icon="i-heroicons-x-mark"
							@click="closeModel()"
						/>
					</div>
					<UInput
						v-model="keywords"
						placeholder="搜索图鉴 多条件空格分割."
						class="flex-1 focus:ring-0"
						:autofocus="false"
						@keyup.enter="search"
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
          <div class="flex justify-end">
            <div class="flex-1 flex overflow-x-auto"  ref="tagsContainer">
              <div class="flex scrollbar-hide">
                <div v-if="!type_id">
                  <QhxTag style="white-space: nowrap !important;"  @click="show_control.wiki_type = true" v-if="!choose_wiki_type" class="cursor-pointer">
                    选择大类
                  </QhxTag>
                  <QhxTag style="white-space: nowrap !important;"  @click="show_control.wiki_type = true" v-else class="cursor-pointer">
                    {{ choose_wiki_type.label }}
                  </QhxTag>
                </div>
                <QhxTag v-for="(tags) in default_options"
                style="white-space: nowrap !important" 
                class="cursor-pointer"
                :active="parent_id === tags.wiki_id ? true : false" @click="chooseParentId(tags)">
                  {{ tags.wiki_name }}
                </QhxTag>
              </div>
            </div>
            <UButton color="primary" @click="multipleChoose" class="mt-1">确认选择</UButton>
          </div>
				</div>
      </template>
			<div class="max-h-[60vh] overflow-y-auto p-1">
        <div v-if="choose_list.length" class="flex flex-wrap">
          <div v-for="item in choose_list">
            <QhxTag :active="true">
              <div class="flex items-center">
                <UIcon name="ant-design:close-outlined" class="text-[16px] cursor-pointer" @click="deleteList(item.wiki_id)" />
                <div class="ml-1">{{ item.wiki_name }}</div>
              </div>
            </QhxTag>
          </div>
        </div>
				<view>
					<template v-for="(listItem, index) in list" :key="listItem.wiki_id">
						<QhxTag @click="choose(listItem)" class="cursor-pointer"
							v-if="choose_list.length === 0 || !choose_list.some((item: Wiki) => { return item.wiki_id === listItem.wiki_id })">
							{{ (where && where.type_id && where.type_id.length > 1) ? `${listItem.type_id}·` : '' }}{{listItem.wiki_name}}
						</QhxTag>
					</template>
				</view>	
			</div>
		</UCard>
	</UModal>
</template>

<script setup lang="ts">
// import { formatCommunity } from '../../pages/community/formatCommunity.js'
// 依赖 Nuxt 组件自动注册：Loading、QhxModal、QhxSelect
import { getWikiList, getWikiOptions, getWikiFilterOptions, getWikiWikiList } from '@/api/wiki'
import type { Wiki } from '@/types/api'
import { useScrollListener } from '@/composables/useScrollListener'
// import { getWikiWikiList, getWikiList, getWikiTypeOptions } from '@/api/wiki'

// Props 定义
interface WikiItem {
  wiki_id?: number
}

interface OptionItem { value: number; label: string }

interface FilterOption {
  options: Array<{ label: string; value: number }>
  value: number
  label: string
}

const props = defineProps<{
  wiki_id?: number
}>()

// Emits 定义
const emit = defineEmits<{
  choose: [list: WikiItem[]]
}>()

// 响应式数据
const type_options = ref<OptionItem[]>([])
const show_control = reactive({
  wiki_type: false as boolean
})
const choose_wiki_type = ref<OptionItem | null>(null)
const type_id = ref<number | null>(null) // 类型的ID
const keywords = ref('')
const page = ref(0)
const pageSize = ref(60)
const show = ref(false)
const loading = ref(false)
const total = ref(0)
const list = ref<Wiki[]>([])
const parent_id = ref<number | null>(null)
const where = ref<Record<string, any>>({})
const choose_list = ref<Wiki[]>([])
const options = ref<FilterOption[]>([])
const default_options = ref<Wiki[]>([]) // 默认选项

type QhxSelectExpose = { showPicker: (e: MouseEvent) => void } | null
const selectRef = ref<QhxSelectExpose>(null)

// 标签容器的滚动监听
const tagsContainer = ref<HTMLElement | null>(null)
const { isScrolling, scrollDirection, onScrollWheel, onScrollTouch } = useScrollListener({
  enableWheel: true,
  enableTouch: true,
  threshold: 3,
  preventDefault: false,
  target: tagsContainer.value || undefined
})

// 计算属性
const filteredList = computed(() => {
  return list.value.filter((item: WikiItem) =>
    choose_list.value.length === 0 ||
    !choose_list.value.some((selectedItem: WikiItem) => selectedItem.wiki_id === item.wiki_id)
  )
})

// 方法定义
const chooseParentId = (tags: Wiki) => {
  if (parent_id.value === tags.wiki_id) {
    parent_id.value = null
  } else {
    parent_id.value = tags.wiki_id
  }
  page.value = 0
  getWikiListData()
}

const onSelectWikiType = (opt: OptionItem) => {
  choose_wiki_type.value = opt
  Object.assign(where, { type_id: opt.value })
  page.value = 0
  getWikiListData()
}

const openWikiTypePicker = (e: MouseEvent) => {
  selectRef.value?.showPicker(e)
}

const fetchWikiFilterOptions = async (type_id_param: number) => {
  const params = {
    type_id: type_id_param
  }
  try {
    // const res = await getWikiFilterOptions(params)
    // const data = res.rows
    // if (data && data.length > 0) {
    //   options.value = data.map((element: WikiItem) => {
    //     const options_arr: Array<{ label: string; value: number }> = []
    //     // 这里可能需要根据实际 API 结构调整
    //     return {
    //       options: options_arr,
    //       value: element.wiki_id,
    //       label: element.wiki_name
    //     }
    //   })
    // }
    console.log('选项列表', options.value)
  } catch (error) {
    console.error('获取过滤选项失败:', error)
  }
}

const showModel = (item: { type_id?: string; parent_id?: number }) => {
  if (item.type_id) {
		where.value.type_id = item.type_id
    type_id.value = Number.parseInt(item.type_id)
    fetchWikiFilterOptions(Number.parseInt(item.type_id))
  } else {
    getWikiTypeOptions()
  }
  if (item.parent_id) {
    parent_id.value = item.parent_id
  }
  console.log(item.parent_id, '父级')
  show.value = true
  if (props.needHiddenTabbar) {
    // @ts-ignore
    uni?.hideTabBar()
  }
  getWikiListData()
}

const getWikiTypeOptions = async () => {
  try {
    const res = await getWikiOptions({})
    const data = res.rows
    type_options.value = data.map((child: WikiItem) => ({
      value: child.wiki_id,
      label: child.wiki_name
    }))
  } catch (error) {
    console.error('获取类型选项失败:', error)
  }
}

const search = () => {
  page.value = 0
  console.log('搜索', keywords.value)
  getWikiListData()
}

const init = () => {
  choose_list.value = []
  keywords.value = ''
  page.value = 0
  choose_wiki_type.value = null
  for (const key of Object.keys(where.value)) {
    delete where.value[key as keyof typeof where.value]
  }
  default_options.value = []
  parent_id.value = null
}

const closeModel = () => {
  show.value = false
  console.log('触发关闭')
  init()
}

const getWikiListData = async (page_param?: number, pageSize_param?: number, currentTime = '') => {
  if (loading.value) {
    // this.$message.warning('请求中请稍后')
    return false
  }
  loading.value = true
  if (!page_param) {
    page.value += 1
  }
  const params = {
    page: page_param || page.value,
    pageSize: pageSize_param || pageSize.value,
    where: where.value,
    keywords: keywords.value,
    parent_id: parent_id.value
  }
  try {
    const res = await getWikiWikiList(params)
    console.log(res)
    const data = res.rows
    total.value = res.count
    if (params.page === 1) {
      list.value = data
      // default_options 可能不存在，暂时注释
      if (res.default_options) {
        default_options.value = res.default_options
      }
    } else {
      list.value.push(...data)
    }
  } catch (error) {
    console.error('获取Wiki列表失败:', error)
  } finally {
    loading.value = false
  }
}

const choose = (list_item: Wiki) => {
  const index = choose_list.value.findIndex((item: Wiki) => {
    return item.wiki_id === list_item.wiki_id
  })
  if (index !== -1) {
    choose_list.value.splice(index, 1)
  } else {
    choose_list.value.push(list_item)
  }
  // emit('choose', list_item)
  // closeModel()
}

const multipleChoose = () => {
  if (choose_list.value.length === 0) {
    useToast().add({
      title: '请选择Wiki',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } else {
    emit('choose', choose_list.value)
    closeModel()
  }
}

const deleteList = (id: number) => {
  const index = choose_list.value.findIndex((item: Wiki) => {
    return item.wiki_id === id
  })
  if (index !== -1) {
    choose_list.value.splice(index, 1)
  }
}

// 标签容器滚动事件处理
const handleTagsScrollWheel = (scrollEvent: { direction: string; deltaX: number; deltaY: number }) => {
  if (!tagsContainer.value) return

  const container = tagsContainer.value
  const { scrollWidth, clientWidth, scrollLeft } = container

  // 每次滚动的步长，可以根据需要调整
  const step = 80

  let delta = 0
  if (scrollEvent.direction === 'down' || scrollEvent.direction === 'right') {
    delta = step
  } else if (scrollEvent.direction === 'up' || scrollEvent.direction === 'left') {
    delta = -step
  }

  // 新的滚动位置
  const newScrollLeft = Math.min(
    Math.max(scrollLeft + delta, 0),
    scrollWidth - clientWidth
  )

  // 如果位置变化才滚动
  if (newScrollLeft !== scrollLeft) {
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    })
  }
}


const handleTagsScrollTouch = (touchEvent: { direction: string; deltaX: number; deltaY: number }) => {
  if (!tagsContainer.value) return
  
  console.log('标签容器触摸滚动:', {
    direction: touchEvent.direction,
    deltaX: touchEvent.deltaX,
    deltaY: touchEvent.deltaY
  })
  
  const container = tagsContainer.value
  const scrollLeft = container.scrollLeft
  const scrollWidth = container.scrollWidth
  const clientWidth = container.clientWidth
  
  // 处理水平滚动 - 优先使用 deltaX，如果没有则使用 deltaY
  let scrollAmount = 0
  let newScrollLeft = scrollLeft
  
  if (touchEvent.direction === 'right' || touchEvent.direction === 'down') {
    // 向右或向下滚动 - 向右移动
    scrollAmount = Math.abs(touchEvent.deltaX || touchEvent.deltaY) * 1.2
    newScrollLeft = Math.min(scrollLeft + scrollAmount, scrollWidth - clientWidth)
  } else if (touchEvent.direction === 'left' || touchEvent.direction === 'up') {
    // 向左或向上滚动 - 向左移动
    scrollAmount = Math.abs(touchEvent.deltaX || touchEvent.deltaY) * 1.2
    newScrollLeft = Math.max(scrollLeft - scrollAmount, 0)
  }
  
  // 只有当滚动位置发生变化时才执行滚动
  if (Math.abs(newScrollLeft - scrollLeft) > 1) {
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    })
  }
}

// 监听标签容器滚动事件
onMounted(() => {
  // 监听鼠标滚轮事件
  const removeWheelListener = onScrollWheel(handleTagsScrollWheel)
  // 监听触摸滚动事件
  // const removeTouchListener = onScrollTouch(handleTagsScrollTouch)
  
  // 组件卸载时清理监听器
  onUnmounted(() => {
    removeWheelListener()
    // removeTouchListener()
  })
})

// 暴露方法给父组件使用（如果需要的话）
defineExpose({
  showModel,
  closeModel
})
</script>

<style scoped>
/* 仅隐藏水平滚动条 */
.scrollbar-hide-x {
  overflow-y: auto;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide-x::-webkit-scrollbar {
  height: 0; /* 水平滚动条高度设为 0 */
}

/* 仅隐藏垂直滚动条 */
.scrollbar-hide-y {
  overflow-x: auto;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide-y::-webkit-scrollbar {
  width: 0; /* 垂直滚动条宽度设为 0 */
}
</style>