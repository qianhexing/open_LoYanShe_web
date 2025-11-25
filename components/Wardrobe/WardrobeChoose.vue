<!-- 选择衣柜组件 -->
<template>
  <UModal v-model="show" :overlay="true" :ui="{ width: 'max-w-3xl' }">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h3 class="text-lg font-semibold">选择衣柜</h3>
      <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
    </div>

    <div class="p-4 space-y-4">
      <!-- 搜索框 -->
      <!-- <UInput v-model="keywords" placeholder="请输入关键词" icon="i-heroicons-magnifying-glass-20-solid"
        @keyup.enter="search" /> -->
        <UInput
          v-model="keywords"
          placeholder="搜索衣柜 多条件空格分割."
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
          <div v-for="item in choose_list" class="bg-qhx-primary flex items-center">
            <WardrobeItem :needJump="false" :size="'list'" :item="item" class="flex-1" :key="item.wardrobe_id"></WardrobeItem>
            <QhxJellyButton>
              <div class="h-[30px] text-center px-1 cursor-pointer" @click="deleteList(item.wardrobe_id)">
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
          <div v-for="item in listData" v-show="choose_list.findIndex((child) => { return child.wardrobe_id === item.wardrobe_id}) === -1">
            <WardrobeItem :needJump="false" :size="'list'" :item="item" @click="chooseWardrobe(item)" :key="item.wardrobe_id"></WardrobeItem>
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
import type { Wardrobe } from '~/types/api'
import { getWardrobeList as apiGetWardrobeList } from '@/api/wardrobe'
import type { WardrobeSearchParams } from '@/api/wardrobe'
const user = useUserStore()
const props = defineProps({
  needStatus: { type: Boolean, default: true },
  needHiddenTabbar: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false },
  need_parent: { type: Boolean, default: true },
  keywordMode: { type: Boolean, default: false },
  needExamin: { type: Boolean, default: true },
  user_id: { type: Number, default: 0 }
})
const emit = defineEmits(['choose'])

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Wardrobe[]>([])
const parent_id = ref(true)
const choose_list = ref<Wardrobe[]>([])
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
        await getWardrobeList()
    } catch (error) {
      page.value -= 1
    }
  }
}
const search = () => {
  page.value = 1
  getWardrobeList()
}
const formateExaminState = (state: number) => {
  // 审核 0 通过 1待审核 2拒绝
  switch (state) {
    case 0:
      return '通过'
    case 1:
      return '待审核'
    case 2:
      return '拒绝'
    case 3:
      return '永久拒绝'
  }
}
function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.wardrobe_id !== id)
}

function checkboxParentId() {
  page.value = 1
  getWardrobeList()
}

function chooseWardrobe(item: Wardrobe) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择衣柜',
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

const getWardrobeList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  const params: WardrobeSearchParams = {
    page: initPage || page.value,
    pageSize: initPageSize || pageSize.value,
    user_id: props.user_id,
  }
  try {
    const res = await apiGetWardrobeList(params)
    const data = res.rows
    total.value = res.count
    if (page.value === 1) listData.value = data
    else listData.value.push(...data)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  getWardrobeList()
})
defineExpose({
  showModel
})
</script>
