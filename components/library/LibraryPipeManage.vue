<script setup lang="ts">
import { ref } from 'vue'
import type { Library, Shop, Wardrobe } from '~/types/api'
import { getShopOptiosns } from '@/api/shop'
import { insertClothes, updateClothes } from '@/api/wardrobe'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
const LibraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const LibraryChooseLibraryListRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
const ColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import type customInput from '../Clothes/customInput.vue'
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { uploadImage } from '@/api';
import { insertLibraryPipe, type PipeInsertParams } from '@/api/library'
import dayjs from 'dayjs'
import { getLibraryPipeList } from '@/api/library'
import type { LibraryPipe } from '~/types/api'

const emit = defineEmits(['success'])

const loading = ref(false)
const userStore = storeToRefs(useUserStore())
const { user } = userStore
const wardrobe = ref<Wardrobe | null>(null) // 衣柜信息
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
console.log(wardrobeStore, '衣柜配置')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const pipe_list = ref<LibraryPipe[]>([])
const fetchLibraryPipe = async (page: number, pageSize: number) => {
  loading.value = true
  const res = await getLibraryPipeList({ page, pageSize, shop_id: shop_id.value })
  const rows = res.rows
  pipe_list.value = rows
  total.value = res.count
  if (page > 1) {
    pipe_list.value = [...pipe_list.value, ...rows]
  } else {
    pipe_list.value = rows
  }
  loading.value = false
}
const show = ref(false)
const shop_id = ref(0)
const showModel = (item: { shop_id: number }) => {
  show.value = true
  shop_id.value = item.shop_id
  fetchLibraryPipe(page.value, pageSize.value)
}

const closeModel = () => {
  show.value = false
  initData()
}
const initData = () => {
  page.value = 1
  pageSize.value = 10
  pipe_list.value = []
  total.value = 0
}

defineExpose({
  showModel
})
</script>

<template>
  <!-- Popup -->
  <UModal v-model="show" :ui="{ width: 'max-w-3xl' }" prevent-close>
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            管理工作流
          </h2>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="show = false" />
        </div>
      </template>
      <div v-for="value in pipe_list" :key="value.pipe_id">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold">{{ dayjs(value.create_time).format('YYYY-MM-DD HH:mm:ss') }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
						<div v-if="value.library?.library_type === '系列'">
              包含版型：
              <div v-for="item in value.library_list" class="qhx-tags-list" :key="item.library_id">
                {{ item.name }} {{ item.library_type }}
              </div>
            </div>
          </div>
      </div>
      <QhxLoading :loading="loading" :page="page" :total="total" :pageSize="pageSize" @loadMore="fetchLibraryPipe"></QhxLoading>
      <template #footer>
        <div class="flex justify-end gap-2">
          <!-- <UButton color="gray" @click="show = false">取消</UButton>
          <UButton :loading="loading" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="insert">
            确认添加
          </UButton> -->
        </div>
      </template>
    </UCard>
  </UModal>
</template>
