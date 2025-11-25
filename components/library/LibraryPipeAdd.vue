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

const emit = defineEmits(['success'])

const qhxSelectRef = ref<InstanceType<typeof QhxSelect>>()
const mainStyleRef = ref<InstanceType<typeof QhxSelect>>()
const clothesPartRef = ref<InstanceType<typeof QhxSelect>>()
const tagRef = ref<InstanceType<typeof customInput>>()

const openPicker = (e: MouseEvent) => {
  qhxSelectRef.value?.showPicker(e)
}
const openMainStyle = (e: MouseEvent) => {
  mainStyleRef.value?.showPicker(e)
}
const openClothesPart = (e: MouseEvent) => {
  clothesPartRef.value?.showPicker(e)
}
const openTag = (e: MouseEvent) => {
  tagRef.value?.showModel(e)
}
const userStore = storeToRefs(useUserStore())
const { user } = userStore
const wardrobe = ref<Wardrobe | null>(null) // 衣柜信息
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
console.log(wardrobeStore, '衣柜配置')
const wardrobe_status_options = ref<optionsInterface[]>([])
const main_style_options = ref<optionsInterface[]>([])
const clothes_part_options = ref<optionsInterface[]>([])
const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const toast = useToast()

const form = ref({
  start_time: undefined,
  state: undefined,
  note: '',
})
const shop_options_loading = ref(false)
const shop_options = ref<Shop[]>([])
const origin_shop = ref()
const fetchShopOptiosns = async (keywords: string) => {
  const params: any = {}
  if (keywords !== '') {
    params.shop_name = keywords
  }
  shop_options_loading.value = true
  const response = await getShopOptiosns(params)
  shop_options.value = response
  let data = []
  if (response.length > 20) {
    data = response.slice(0, 19);
  } else {
    data = response
  }
  return data
}
const showChooseLibrary = () => {
  if (LibraryChooseRef.value) {
    LibraryChooseRef.value.showModel()
  }
}
const showChooseLibraryList = () => {
  if (LibraryChooseLibraryListRef.value) {
    LibraryChooseLibraryListRef.value.showModel()
  }
}
const showModel = (item: any) => {
  show.value = true
}

const library = ref<Library | null>(null)
const library_list = ref<Library[]>([])

const showControl = ref({
  color_choose: false,
  wardrobe_status: false,
  main_style: false,
  clothes_part: false,
  add_time: false,
  season: false,
  tags_custom: false,
})
const chooseLibrary = (list: Library[]) => {
  if (list.length > 0) {
    library.value = list[0]
  }
  console.log(library.value, '图鉴列表')
}
const chooseLibraryList = (list: Library[]) => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  list.forEach((item) => {
    if (library_list.value.findIndex((child) => { return child.library_id === item.library_id }) === -1) {
      library_list.value.push(item)
    }
  })
}
const closeModel = () => {
  show.value = false
  initData()
}
const initData = () => {
  form.value = {
    start_time: undefined,
    state: undefined,
    note: '',
  }
  // this.plan = null
  library.value = null
  wardrobe.value = null
  library_list.value = []
}
const fetchUpload = async (file: { file: { readonly lastModified: number; readonly name: string; readonly webkitRelativePath: string; readonly size: number; readonly type: string; arrayBuffer: { (): Promise<ArrayBuffer>; (): Promise<ArrayBuffer> }; bytes: { (): Promise<Uint8Array<ArrayBuffer>>; (): Promise<Uint8Array<ArrayBuffer>> }; slice: { (start?: number, end?: number, contentType?: string): Blob; (start?: number, end?: number, contentType?: string): Blob }; stream: { (): ReadableStream<Uint8Array<ArrayBuffer>>; (): ReadableStream<Uint8Array<ArrayBuffer>> }; text: { (): Promise<string>; (): Promise<string> } }; url: string }) => {
  try {
    let url: string
    if (file.file) {
      const res = await uploadImage(file.file)
      url = res.file_url
    } else {
      url = file.url.replace(BASE_IMG, '')
    }
    return url
  } catch (error) {
    throw error;
  }
}
const insert = async () => {
  if (loading.value) {
    return
  }
  if (!form.value.state) {
    toast.add({
      title: '错误',
      description: '请选择状态',
      color: 'red'
    })
    return
  }
  if (!form.value.start_time) {
    toast.add({
      title: '错误',
      description: '请选择起止时间',
      color: 'red'
    })
    return
  }
  const [start_time, end_time] = form.value.start_time as [string, string]
  if (start_time > end_time) {
    toast.add({
      title: '错误',
      description: '起始时间不能大于结束时间',
      color: 'red'
    })
    return
  }
  if (!library.value?.library_id) {
    toast.add({
      title: '错误',
      description: '请选择图鉴',
      color: 'red'
    })
    return
  }
  const state = config.value?.pipe_state.find((item: any) => item.label === form.value.state)?.value
  loading.value = true
  const params: PipeInsertParams = {
    state: state as number,
    start_time: `${dayjs(start_time).format('YYYY-MM-DD')} 00:00:00`,
    end_time: `${dayjs(end_time).format('YYYY-MM-DD')} 23:59:59`,
    note: form.value.note,
    pk_id: library.value?.library_id,
    pk_type: 0
  }
  if (library_list.value.length > 0) {
    params.include_library = library_list.value.map((item) => item.library_id).join(',')
  }
  const response = await insertLibraryPipe(params)
  if (response) {
    emit('success')
    closeModel()
    toast.add({
      title: '成功',
      description: '添加成功',
      color: 'green'
    })
  }
  loading.value = false
}
const jumpToAddLibrary = () => {
  navigateTo('/addLibrary')
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
            {{ type === 0 ? '新增工作流' : '编辑工作流' }}
          </h2>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="show = false" />
        </div>
      </template>

      <!-- 内容区域 -->
      <div class="space-y-6 min-h-[60vh] max-h-[60vh] overflow-y-auto px-2">
        <UFormGroup label="提示">
          <UButton color="primary" size="sm" @click="jumpToAddLibrary()">
            没有图鉴时需先去新增图鉴，并等图鉴审核通过后才能添加工作流
          </UButton>
        </UFormGroup>
        <UFormGroup label="起止时间">
          <div class="col-span-9 space-y-2">
            <VueDatePicker v-model="form.start_time" :enable-time-picker="true" :range="true" format="MM/dd/yyyy" />
          </div>
        </UFormGroup>
        <UFormGroup label="工作流状态" name="state" required>
          <USelectMenu v-model="form.state" :options="config?.pipe_state" placeholder="请选择状态" searchable
            class="w-1/2 min-w-[200px]" value-attribute="label" option-attribute="label" :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }" />
        </UFormGroup>
        <UFormGroup label="选择图鉴">
          <div class="col-span-9 space-y-2">
            <QhxTag v-if="library" :active="true">
              <div class="flex">
                <QhxJellyButton
                  class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] bg-qhx-primary"
                  @click="library = null, library_list = []">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ library.name }}</div>
              </div>
            </QhxTag>
            <p v-else class="text-xs text-gray-500">
              <UButton type="submit" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
                :loading="loading" @click="showChooseLibrary()" v-show="!library">
                选择图鉴
              </UButton>
            </p>
          </div>
        </UFormGroup>
        <UFormGroup label="包含版型，不选默认包含所有版型" v-if="library && library.library_type === '系列'">
          <div class="col-span-9 space-y-2">
            <QhxTag :active="true"v-for="(item, index) in library_list" :key="item.library_id">
              <div class="flex">
                <QhxJellyButton
                  class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] bg-qhx-primary"
                  @click="library_list.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ item.name }}</div>
              </div>
            </QhxTag>
            <div class="text-xs text-gray-500">
              <UButton type="submit" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
                :loading="loading" @click="showChooseLibraryList()">
                选择包含版型
              </UButton>
            </div>
          </div>
        </UFormGroup>
        <UFormGroup label="备注">
          <UTextarea v-model="form.note" placeholder="工作流的一些备注" :rows="3" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="show = false">取消</UButton>
          <UButton :loading="loading" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="insert">
            {{ type === 1 ? '确认修改' : '确认添加' }}
          </UButton>
        </div>
      </template>
    </UCard>
    <LibraryChoose ref="LibraryChooseRef" @choose="chooseLibrary" :needExamin="false" :filter_list="[
    { field: 'library_type', value: '系列', op: 'and' },
    { field: 'shopkeeperOrUser', value: user?.user_id as number, op: 'and' }]"></LibraryChoose>
    <LibraryChoose ref="LibraryChooseLibraryListRef" @choose="chooseLibraryList"
    :multiple="true"
    v-if="library"
    :need_parent="false"
      :filter_list="[{ field: 'parent_id', value: library?.library_id, op: 'and' }]"></LibraryChoose>
  </UModal>
</template>
