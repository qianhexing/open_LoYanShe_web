<!-- 选择图鉴组件 -->
<template>
  <UModal v-model="show" :overlay="true" :ui="{ width: 'max-w-3xl' }">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h3 class="text-lg font-semibold">选择图鉴</h3>
      <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
    </div>

    <div class="p-4 space-y-4">
      <!-- 搜索框 -->
      <!-- <UInput v-model="keywords" placeholder="请输入关键词" icon="i-heroicons-magnifying-glass-20-solid"
        @keyup.enter="search" /> -->
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

      <!-- 筛选栏 -->
      <div class="flex justify-between items-center">
        <UCheckbox v-if="need_parent" v-model="parent_id" label="不显示子图鉴" @change="checkboxParentId" />
        <div v-show="choose_list.length !== 0">已选择 {{ choose_list.length }}</div>
        <UButton color="primary" @click="multipleChoose">确认选择</UButton>
      </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto">
        <!-- 已选列表 -->
        <div v-if="choose_list.length" class="space-y-2">
          <div v-for="item in choose_list" class="bg-qhx-primary flex items-center">
            <LibraryItem :needJump="false" :size="'mid'" :item="item" class="flex-1" :key="item.library_id"></LibraryItem>
            <QhxJellyButton>
              <div class="h-[30px] text-center px-1 cursor-pointer" @click="deleteList(item.library_id)">
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
          <div v-for="item in listData" v-show="choose_list.findIndex((child) => { return child.library_id === item.library_id}) === -1">
            <LibraryItem :needJump="false" :size="'mid'" :item="item" @click="chooseLibrary(item)"></LibraryItem>
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
import { ref } from 'vue'
import { getLibraryList as apiGetLibraryList } from '@/api/library'
import type { Library } from '~/types/api'

const props = defineProps({
  needStatus: { type: Boolean, default: true },
  needHiddenTabbar: { type: Boolean, default: false },
  filter_list: { type: Array as () => any[], default: () => [] },
  multiple: { type: Boolean, default: false },
  need_parent: { type: Boolean, default: true },
  keywordMode: { type: Boolean, default: false }
})
const emit = defineEmits(['choose'])

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<any[]>([])
const parent_id = ref(true)
const choose_list = ref<any[]>([])
const toast = useToast()

const closeModel = () => {
  show.value = false
  init()
}
const showModel = () => {
  show.value = true
}

const loadMore =async () => {
  
  if (loading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getLibraryList()
    } catch (error) {
      page.value -= 1
    }
  }
}
const search = () => {
  page.value = 1
  getLibraryList()
}

function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.library_id !== id)
}

function checkboxParentId() {
  page.value = 1
  getLibraryList()
}

function chooseLibrary(item: Library) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择图鉴',
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
  page.value = 0
}

const getLibraryList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  let params: any = {
    page: initPage || page.value,
    pageSize: initPageSize || pageSize.value,
    filter_list: [
      { field: 'name', value: keywords.value, op: 'and' },
      ...props.filter_list
    ]
  }

  if (parent_id.value) {
    params.filter_list.push({ field: 'parent_id', op: 'and', value: 0 })
  }

  if (props.keywordMode) {
    params = {
      page: page.value,
      pageSize: pageSize.value,
      parent_id: parent_id.value,
      keyword: keywords.value,
      need_Statistics: false
    }
  }

  try {
    const res = await apiGetLibraryList(params)
    const data = res.rows
    total.value = res.count
    if (page.value === 1) listData.value = data
    else listData.value.push(...data)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  getLibraryList()
})
defineExpose({
  showModel
})
</script>
