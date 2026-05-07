<!-- 选择店铺组件（站内链接等场景，交互参考 LibraryChoose） -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>选择店铺</div>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="p-6 space-y-4 flex-shrink-0">
          <div class="relative">
            <UInput
              v-model="keywords"
              placeholder="搜索店铺 多条件空格分割..."
              class="flex-1 focus:ring-0"
              :autofocus="false"
              :ui="{
                base: 'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-emerald-500'
                  }
                }
              }"
              @keyup.enter="search"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
              </template>
            </UInput>
          </div>

          <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <div v-show="choose_list.length !== 0" class="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm font-medium">
              <UIcon name="material-symbols:check-circle-rounded" class="text-base" />
              已选择 {{ choose_list.length }}
            </div>
            <UButton
              class="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 transition-all duration-200"
              @click="multipleChoose"
            >
              确认选择
            </UButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div v-if="choose_list.length" class="space-y-2">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <UIcon name="material-symbols:storefront-rounded" class="text-emerald-600" />
              已选店铺
            </div>
            <div
              v-for="item in choose_list"
              :key="item.shop_id"
              class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center p-2 transition-all duration-200 hover:shadow-md min-w-0"
            >
              <div class="flex-1 min-w-0 overflow-hidden">
                <ShopItem :need-jump="false" size="mini" :item="item" />
              </div>
              <QhxJellyButton>
                <button
                  type="button"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white transition-all duration-200 hover:scale-110 ml-2 flex-shrink-0 shadow-md shadow-red-500/30"
                  @click.stop="deleteList(item.shop_id)"
                >
                  <UIcon name="ant-design:close-outlined" class="text-sm" />
                </button>
              </QhxJellyButton>
            </div>
          </div>

          <div v-if="listData.length" class="space-y-2">
            <div v-if="choose_list.length" class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 mt-4">
              <UIcon name="material-symbols:store-rounded" class="text-teal-600" />
              可选店铺
            </div>
            <div
              v-for="item in listData"
              :key="item.shop_id"
              v-show="choose_list.findIndex((child) => child.shop_id === item.shop_id) === -1"
              class="group"
            >
              <div
                class="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 hover:scale-[1.01] min-w-0 overflow-hidden"
                @click="chooseShop(item)"
              >
                <ShopItem :need-jump="false" size="mini" :item="item" />
              </div>
            </div>
          </div>

          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="material-symbols:store-outline" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500 text-lg">暂无数据</p>
            </div>
          </div>

          <div class="py-3">
            <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore" />
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getShopList } from '@/api/shop'
import type { Shop } from '@/types/api'
import ShopItem from '@/components/shop/ShopItem.vue'

const props = defineProps({
  multiple: { type: Boolean, default: false },
})

const emit = defineEmits<{
  choose: [list: Shop[]]
}>()

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Shop[]>([])
const choose_list = ref<Shop[]>([])
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

const closeModel = () => {
  show.value = false
  init()
}

const handleClose = () => {
  closeModel()
}

const showModel = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  } else {
    clickPosition.value = { x: 0, y: 0 }
  }
  show.value = true
}

const loadMore = async () => {
  if (loading.value) return
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getShopListData()
    } catch {
      page.value -= 1
    }
  }
}

const search = () => {
  page.value = 1
  getShopListData()
}

function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.shop_id !== id)
}

function chooseShop(item: Shop) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择店铺',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  emit('choose', choose_list.value)
  closeModel()
}

function init() {
  keywords.value = ''
  choose_list.value = []
  page.value = 1
}

const getShopListData = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getShopList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keywords.value || null,
    })
    total.value = res.count
    if (page.value === 1) listData.value = res.rows
    else listData.value.push(...res.rows)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  getShopListData()
})

defineExpose({
  showModel,
})
</script>
