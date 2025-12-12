<template>
  <UModal v-model="show" :ui="{ width: 'max-w-3xl' }" prevent-close>
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ type === 0 ? '新增衣柜' : '编辑衣柜' }}
          </h2>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="show = false" />
        </div>
      </template>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-2">

        <!-- 衣柜名称 -->
        <!-- 名称 -->
        <UFormGroup label="衣柜名称">
          <UInput v-model="form.wardrobe_name" placeholder="请输入衣柜名称" class="flex-1 focus:ring-0" :ui="{
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
        <!-- 衣柜封面 -->
        <UFormGroup label="衣柜封面">
          <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="wardrobeCoverRef" />
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
  </UModal>
</template>


<script setup lang="ts">
import { insertWardrobe, updateWardrobe } from '@/api/wardrobe'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const show = ref<boolean>(false)
import type { Wardrobe } from '@/types/api'
const emit = defineEmits(['success'])
import { uploadImage } from '@/api';
const wardrobe_id = ref<number | null>(null)
const showModel = (item: Wardrobe | null = null) => {
  if (item) {
    type.value = 1
    form.value.wardrobe_name = item.wardrobe_name || ''
    form.value.wardrobe_cover = item.wardrobe_cover || ''
    wardrobe_id.value = item.wardrobe_id || null
  } else {
    type.value = 0
  }
  show.value = true
}
const type = ref<number>(0)
const loading = ref<boolean>(false)
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
    console.error(error)
    return ''
  }
}
const insert = async () => {
  loading.value = true
  const params: Wardrobe = {
    wardrobe_name: form.value.wardrobe_name,
  }
  if (wardrobeCoverRef.value && wardrobeCoverRef.value.previewImages.length > 0) {
    const wardrobe_cover = await fetchUpload(wardrobeCoverRef.value.previewImages[0])
    params.wardrobe_cover = wardrobe_cover
  } else {
    params.wardrobe_cover = null
  }
  if (type.value === 0) {
    await insertWardrobe(params)
    emit('success')
  } else {
    if (!wardrobe_id.value) return
    params.wardrobe_id = wardrobe_id.value
    await updateWardrobe(params)
    emit('success')
  }
  closeModel()
  loading.value = false
}
const closeModel = () => {
  show.value = false
  initData()
}
const initData = () => {
  form.value = {
    wardrobe_name: '',
    wardrobe_cover: ''
  }
  wardrobe_id.value = null
}
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const onUpdateFiles = (file: File[]) => {
  console.log(file)
}
const form = ref<{
  wardrobe_name: string
  wardrobe_cover: string
}>({
  wardrobe_name: '',
  wardrobe_cover: ''
})

defineExpose({
  showModel
})


</script>
