<!-- 选择场景组件 -->
<template>
  <UModal v-model="show" :overlay="true" :ui="{ width: 'max-w-3xl' }">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h3 class="text-lg font-semibold">选择场景</h3>
      <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
    </div>

    <div class="p-4 space-y-4">
      <!-- 搜索框 -->
      <UInput
        v-model="keywords"
        placeholder="搜索场景 多条件空格分割."
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

      <!-- 筛选栏 -->
      <div class="flex justify-between items-center">
        <div v-show="choose_list.length !== 0">已选择 {{ choose_list.length }}</div>
        <UButton color="primary" @click="multipleChoose">确认选择</UButton>
      </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto">
        <!-- 已选列表 -->
        <div v-if="choose_list.length" class="space-y-2">
          <div v-for="item in choose_list" :key="item.sence_id" class="bg-qhx-primary flex items-center">
            <SceneItem :needJump="false" :size="'mini-list'" :item="item" class="flex-1" />
            <QhxJellyButton>
              <div class="h-[30px] text-center px-1 cursor-pointer" @click="deleteList(item.sence_id)">
                <div
                  class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                  style="font-size: 22px">
                  <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
                </div>
              </div>
            </QhxJellyButton>
          </div>
        </div>

        <!-- 可选列表 -->
        <div v-if="listData.length" class="space-y-2">
          <div 
            v-for="item in listData" 
            :key="item.sence_id"
            v-show="choose_list.findIndex((child) => child.sence_id === item.sence_id) === -1"
          >
            <SceneItem 
              :needJump="false" 
              :size="'mini-list'" 
              :item="item" 
              @click="chooseScene(item)" 
            />
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!listData.length && !loading" class="text-center text-gray-400 py-6">
          暂无数据
        </div>
        <div class="py-3">
          <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getSenceList } from '@/api/scene'
import type { Scene } from '~/types/api'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  multiple: { type: Boolean, default: false }
})

const emit = defineEmits(['choose'])

const userStore = useUserStore()
const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Scene[]>([])
const choose_list = ref<Scene[]>([])
const toast = useToast()

const user_id = computed(() => userStore.user?.user_id || 0)

const closeModel = () => {
  show.value = false
  init()
}

const showModel = () => {
  show.value = true
}

const loadMore = async () => {
  if (loading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getSceneList()
    } catch (error) {
      page.value -= 1
    }
  }
}

const search = () => {
  page.value = 1
  getSceneList()
}

function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.sence_id !== id)
}

function chooseScene(item: Scene) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择场景',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
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

const getSceneList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  
  const params = {
    page: initPage || page.value,
    visitor_id: parseInt(user_id.value.toString()),
    pageSize: initPageSize || pageSize.value,
  }
  
  // 如果有搜索关键词，可以添加到参数中
  if (keywords.value) {
    // 根据实际API需求添加搜索参数
    // params.keyword = keywords.value
  }

  try {
    const res = await getSenceList(params)
    const data = res.rows
    total.value = res.count
    if (page.value === 1) listData.value = data
    else listData.value.push(...data)
  } finally {
    loading.value = false
  }
}

// 监听 user_id 变化，当有用户ID时加载数据
watch(user_id, (newId) => {
  if (newId && show.value) {
    page.value = 1
    listData.value = []
    getSceneList()
  }
}, { immediate: true })

onMounted(() => {
  if (user_id.value) {
    getSceneList()
  }
})

defineExpose({
  showModel
})
</script>

