<template>
  <div>
  <QhxModal v-model="show" @close="closeModel">
    <div class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-lg font-semibold">{{ isEdit ? '编辑搭配' : '新增搭配' }}</h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
      </div>
      <div class="space-y-4 max-h-[65vh] overflow-y-auto p-4 flex-1">
        <!-- 搭配名称 -->
        <UFormGroup label="搭配名称">
          <UInput v-model="form.note" placeholder="请输入搭配名称" class="flex-1" :ui="inputUi" />
        </UFormGroup>

        <!-- 封面 -->
        <UFormGroup label="封面">
          <QhxImagePicker ref="coverRef" :multiple="false" />
        </UFormGroup>

        <!-- 预定时间 -->
        <UFormGroup label="预定时间">
          <QhxDateTimePicker v-model="form.appointment_time" placeholder="选填" />
        </UFormGroup>

        <!-- 主要风格 -->
        <UFormGroup label="主要风格">
          <div class="flex flex-wrap gap-2">
            <QhxTag
              v-for="(tag, idx) in form.main_style"
              :key="idx"
              class="cursor-pointer"
              @click="form.main_style.splice(idx, 1)"
            >
              {{ tag.label }} ×
            </QhxTag>
            <UButton
              v-if="mainStyleOptions.length > 0"
              size="xs"
              variant="outline"
              @click="showMainStylePicker = true"
            >
              选择风格
            </UButton>
          </div>
        </UFormGroup>

        <!-- 服饰列表 -->
        <UFormGroup label="服饰列表">
          <div v-if="form.list.length === 0" class="text-sm text-gray-500 py-2">暂无服饰，请从衣柜搭配模式添加或点击下方按钮选择</div>
          <div v-else class="space-y-2">
            <div
              v-for="(item, idx) in form.list"
              :key="item.clothes_id ?? item.library_id ?? `item-${idx}`"
              class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <img :src="`${BASE_IMG}${item.clothes_img}`" class="w-full h-full object-cover" />
              </div>
              <span class="text-sm truncate flex-1">{{ item.clothes_note || '未命名' }}</span>
              <button
                type="button"
                class="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                @click="removeClothes(item)"
              >
                <UIcon name="i-heroicons-x-mark" class="text-sm" />
              </button>
            </div>
          </div>
          <UButton
            size="xs"
            variant="outline"
            color="gray"
            class="mt-2"
            icon="i-heroicons-plus"
            @click="wardrobeClothesChooseRef?.showModel()"
          >
            选择服饰
          </UButton>
        </UFormGroup>

        <!-- 是否私密 -->
        <UFormGroup label="是否私密">
          <div class="flex items-center gap-2">
            <UToggle v-model="form.is_private" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ form.is_private ? '私密' : '公开' }}</span>
          </div>
        </UFormGroup>

        <!-- 开放社区 -->
        <UFormGroup label="开放社区">
          <div class="flex items-center gap-2">
            <UToggle v-model="form.open_community" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ form.open_community ? '开启' : '关闭' }}</span>
          </div>
        </UFormGroup>

        <!-- 开放标签 -->
        <UFormGroup label="开放标签">
          <div class="flex items-center gap-2">
            <UToggle v-model="form.open_tags" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ form.open_tags ? '开启' : '关闭' }}</span>
          </div>
        </UFormGroup>
      </div>
      <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <UButton color="gray" @click="closeModel">取消</UButton>
        <UButton :loading="loading" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover" @click="submit">
          {{ isEdit ? '确认修改' : '确认创建' }}
        </UButton>
      </div>
    </div>
  </QhxModal>

  <!-- 衣柜服饰选择弹窗 -->
  <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="onClothesChoose" />

  <!-- 风格选择弹窗 -->
  <QhxModal v-model="showMainStylePicker">
    <div class="p-4 w-[280px] max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 rounded-xl">
      <div class="flex flex-wrap gap-2">
        <QhxTag
          v-for="opt in mainStyleOptions"
          :key="opt.value"
          :active="form.main_style.some((s) => s.value === opt.value)"
          class="cursor-pointer"
          @click="toggleMainStyle(opt)"
        >
          {{ opt.label }}
        </QhxTag>
      </div>
    </div>
  </QhxModal>
  </div>
</template>

<script setup lang="ts">
import { insertMatchingList, updateMatchingList } from '@/api/matching_list'
import type { InsertMatchingListParams, UpdateMatchingListParams } from '@/api/matching_list'
import type { WardrobeClothes } from '@/types/api'
import QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'

interface MainStyleOption {
  label: string
  value: number
}

const show = ref(false)
const emit = defineEmits<{ success: [] }>()
const toast = useToast()
const configStore = useConfigStore()
const loading = ref(false)
const showMainStylePicker = ref(false)
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)

const editingId = ref<number | null>(null)
const isEdit = computed(() => editingId.value != null)

const inputUi = {
  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
  rounded: 'rounded-[10px]',
  padding: { xs: 'px-4 py-2' },
  color: {
    white: {
      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600'
    }
  }
}

const form = ref({
  note: '',
  cover: '',
  appointment_time: '' as string | null,
  is_private: false,
  open_community: false,
  open_tags: false,
  main_style: [] as MainStyleOption[],
  list: [] as WardrobeClothes[]
})

const mainStyleOptions = computed<MainStyleOption[]>(() => {
  return (configStore.config?.main_style as MainStyleOption[]) ?? []
})

const onClothesChoose = (item: WardrobeClothes) => {
  const exists = form.value.list.some(
    (c) => (c.clothes_id != null && c.clothes_id === item.clothes_id) ||
      (c.library_id != null && c.library_id === item.library_id)
  )
  if (!exists) {
    form.value.list = [...form.value.list, item]
  }
}

const removeClothes = (item: WardrobeClothes) => {
  form.value.list = form.value.list.filter((c) => {
    if (c.clothes_id != null && item.clothes_id != null && c.clothes_id === item.clothes_id) return false
    if (c.library_id != null && item.library_id != null && c.library_id === item.library_id) return false
    return true
  })
}

const toggleMainStyle = (opt: MainStyleOption) => {
  const idx = form.value.main_style.findIndex((s) => s.value === opt.value)
  if (idx >= 0) {
    form.value.main_style.splice(idx, 1)
  } else {
    form.value.main_style.push(opt)
  }
}

const closeModel = () => {
  show.value = false
  editingId.value = null
}

const showModel = (list: WardrobeClothes[], item?: { matching_id: number; note?: string; cover?: string; appointment_time?: string; is_private?: number; open_community?: number; open_tags?: number; main_style?: string }) => {
  form.value.list = [...list]
  form.value.note = ''
  form.value.cover = ''
  form.value.appointment_time = null
  form.value.is_private = false
  form.value.open_community = false
  form.value.open_tags = false
  form.value.main_style = []

  if (item) {
    editingId.value = item.matching_id
    form.value.note = item.note ?? ''
    form.value.cover = item.cover ?? ''
    form.value.appointment_time = item.appointment_time ?? null
    form.value.is_private = (item.is_private ?? 0) === 1
    form.value.open_community = (item.open_community ?? 0) === 1
    form.value.open_tags = (item.open_tags ?? 0) === 1
    if (item.main_style) {
      const labels = item.main_style.split(',').filter(Boolean)
      form.value.main_style = labels
        .map((label) => mainStyleOptions.value.find((o) => o.label === label))
        .filter((o): o is MainStyleOption => o != null)
    }
    nextTick(() => {
      if (item.cover && coverRef.value) {
        coverRef.value.previewImages = [{ url: BASE_IMG + item.cover, file: undefined as unknown as File }]
      }
    })
  } else {
    editingId.value = null
  }
  show.value = true
}

const fetchUpload = async (file: { file?: File; url?: string }) => {
  if (!file) return ''
  try {
    if (file.file) {
      const res = await uploadImage(file.file)
      return res.file_url ?? ''
    }
    if (file.url) {
      return file.url.replace(BASE_IMG, '')
    }
  } catch {
    toast.add({ title: '图片上传失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
  return ''
}

/** 获取 cover 路径（去掉 BASE_IMG 前缀） */
const getCoverPath = (path?: string) => {
  if (!path) return ''
  return path.replace(BASE_IMG, '')
}

const buildParams = (forEdit: boolean) => {
  const { note, cover, appointment_time, is_private, open_community, open_tags, main_style, list } = form.value
  const params: Record<string, unknown> = {
    note,
    cover: cover || null,
    appointment_time: appointment_time || undefined,
    is_private: is_private === false ? 0 : 1,
    open_community: open_community === false ? 0 : 1,
    open_tags: open_tags === false ? 0 : 1,
    main_style: main_style.length > 0 ? main_style.map((e) => e.label).join(',') : null
  }
  if (forEdit) {
    params.list = list.map((item) => ({
      id: item.clothes_id ?? item.library_id ?? 0,
      cover: getCoverPath(item.clothes_img),
      type: 0,
      name: item.clothes_note || undefined
    })).filter((e) => e.id > 0)
  } else {
    params.clothes_id = list.map((item) => item.clothes_id).filter((id): id is number => id != null).join(',')
  }
  return params
}

const submit = async () => {
  if (!form.value.note?.trim()) {
    toast.add({ title: '请输入搭配名称', icon: 'i-heroicons-exclamation-circle', color: 'yellow' })
    return
  }
  if (form.value.list.length === 0) {
    toast.add({ title: '请先添加服饰', icon: 'i-heroicons-exclamation-circle', color: 'yellow' })
    return
  }

  loading.value = true
  try {
    let cover = form.value.cover
    if (coverRef.value?.previewImages?.length) {
      const uploaded = await fetchUpload(coverRef.value.previewImages[0])
      if (uploaded) cover = uploaded
    }

    const base = buildParams(isEdit.value)
    base.cover = cover || null

    if (isEdit.value && editingId.value) {
      const params: UpdateMatchingListParams = { ...base, matching_id: editingId.value } as UpdateMatchingListParams
      await updateMatchingList(params)
      toast.add({ title: '修改成功', icon: 'i-heroicons-check-circle', color: 'green' })
    } else {
      const params: InsertMatchingListParams = base as InsertMatchingListParams
      await insertMatchingList(params)
      toast.add({ title: '创建成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }
    closeModel()
    emit('success')
  } catch (e) {
    console.error(e)
    toast.add({ title: '操作失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>
