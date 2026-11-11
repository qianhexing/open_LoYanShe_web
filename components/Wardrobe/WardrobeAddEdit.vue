<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? t('wardrobe.add_edit.create') : t('wardrobe.add_edit.edit') }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
    </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-6 flex-1">
        <!-- 衣柜名称 -->
        <UFormGroup :label="t('wardrobe.add_edit.name')">
          <UInput v-model="form.wardrobe_name" :placeholder="t('wardrobe.add_edit.name_placeholder')" class="flex-1 focus:ring-0" :ui="{
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
        <UFormGroup :label="t('wardrobe.add_edit.cover')">
          <QhxImagePicker :multiple="false" @update:files="onUpdateCoverFiles" ref="wardrobeCoverRef" />
        </UFormGroup>

        <!-- 衣柜描述 -->
        <UFormGroup :label="t('wardrobe.add_edit.desc')">
          <UTextarea v-model="form.wardrobe_desc" :placeholder="t('wardrobe.add_edit.desc_placeholder')" :rows="3" class="flex-1 focus:ring-0" :ui="{
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

        <!-- 是否私密 -->
        <UFormGroup :label="t('wardrobe.add_edit.private')">
          <div class="flex items-center gap-2">
            <UToggle v-model="form.is_private" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ form.is_private ? t('wardrobe.add_edit.private_on') : t('wardrobe.add_edit.private_off') }}</span>
          </div>
          <p class="text-xs text-gray-500 mt-1" v-if="!form.is_private">{{ t('wardrobe.add_edit.private_hint') }}</p>
        </UFormGroup>

        <!-- 访问密码 -->
        <UFormGroup :label="t('wardrobe.add_edit.password')" v-if="form.is_private">
          <UInput v-model="form.password" type="text" :placeholder="t('wardrobe.add_edit.password_placeholder')" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
          <p class="text-xs text-gray-500 mt-1" v-if="form.password">{{ t('wardrobe.add_edit.password_hint') }}</p>
        </UFormGroup>

        <!-- 排序类型 -->
        <UFormGroup :label="t('wardrobe.add_edit.sort_type')">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-900 dark:text-gray-100">{{ currentSortTypeLabel }}</span>
            <UButton
              type="button"
              size="xs"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="openSortTypeSelect($event)"
            >
              {{ t('wardrobe.add_edit.select_sort') }}
            </UButton>
          </div>
          <QhxSelect
            ref="sortTypeSelectRef"
            :options="sortTypeOptions"
            :default-value="defaultSortTypeForSelect"
            @select="onSortTypeSelect"
          />
        </UFormGroup>

        <!-- 自定义衣柜（默认收起，展开状态缓存） -->
        <section class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/40"
            :aria-expanded="customSectionExpanded"
            @click="toggleCustomSection"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('wardrobe.add_edit.custom_section') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('wardrobe.add_edit.custom_section_hint') }}
              </div>
            </div>
            <UIcon
              :name="customSectionExpanded ? 'material-symbols:expand-less' : 'material-symbols:expand-more'"
              class="shrink-0 text-[18px] text-gray-500 dark:text-gray-400"
            />
          </button>
          <div
            v-show="customSectionExpanded"
            class="space-y-6 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            <!-- 开放弹幕 -->
            <UFormGroup :label="t('wardrobe.add_edit.open_danmu')">
              <div class="flex items-center gap-2">
                <UToggle v-model="form.config.open_danmu" />
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ form.config.open_danmu ? t('wardrobe.add_edit.on') : t('wardrobe.add_edit.off') }}</span>
              </div>
              <p class="text-xs text-gray-500 mt-1">{{ t('wardrobe.add_edit.danmu_hint') }}</p>
            </UFormGroup>

            <!-- 自定义主题（与帖子对齐） -->
            <CommunityCustomStyleForm
              ref="customStyleFormRef"
              v-model="customStyle"
              :background-hint="t('wardrobe.add_edit.bg_hint')"
            />

            <!-- 显示价格 -->
            <UFormGroup :label="t('wardrobe.add_edit.show_price')">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-gray-900 dark:text-gray-100">{{ currentShowPriceLabel }}</span>
                <UButton
                  type="button"
                  size="xs"
                  class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                  @click="openShowPriceSelect($event)"
                >
                  {{ t('wardrobe.add_edit.select_mode') }}
                </UButton>
              </div>
              <QhxSelect
                ref="showPriceSelectRef"
                :options="showPriceOptions"
                :default-value="defaultShowPriceForSelect"
                @select="onShowPriceSelect"
              />
            </UFormGroup>
          </div>
        </section>
      </div>
      <!-- 底部 -->
      <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <UButton color="gray" @click="closeModel">{{ t('common.cancel') }}</UButton>
        <UButton :loading="loading" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="insert">
          {{ type === 1 ? t('wardrobe.add_edit.confirm_update') : t('wardrobe.add_edit.confirm_add') }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>


<script setup lang="ts">
import { insertWardrobe, updateWardrobe } from '@/api/wardrobe'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import CommunityCustomStyleForm from '@/components/community/CommunityCustomStyleForm.vue'
import type { Wardrobe } from '@/types/api'
import { uploadImage } from '@/api'
import { useToast } from '#imports'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  createDefaultCommunityCustomStyle,
  hasCommunityCustomStyle,
  parseEntityCustomStyle,
  serializeCommunityCustomStyle,
  type CommunityCustomStyle,
} from '@/utils/communityCustomStyle'

const { t } = useI18n()

const WARDROBE_CUSTOM_SECTION_KEY = 'wardrobe-add-edit-custom-section-expanded'

function readCustomSectionExpanded(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(WARDROBE_CUSTOM_SECTION_KEY) === '1'
  } catch {
    return false
  }
}

function persistCustomSectionExpanded(expanded: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WARDROBE_CUSTOM_SECTION_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const show = ref<boolean>(false)
const customSectionExpanded = ref(readCustomSectionExpanded())
const clickPosition = ref({ x: 0, y: 0 })
const emit = defineEmits(['success'])
const toast = useToast()
const wardrobe_id = ref<number | null>(null)
const type = ref<number>(0) // 0 添加 1 编辑
const loading = ref<boolean>(false)

// 图片选择器引用
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const customStyleFormRef = ref<InstanceType<typeof CommunityCustomStyleForm> | null>(null)
const sortTypeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const showPriceSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const customStyle = ref<CommunityCustomStyle>(createDefaultCommunityCustomStyle())

// 表单数据
const form = ref<{
  wardrobe_name: string
  wardrobe_cover: string
  wardrobe_desc: string
  is_private: boolean
  sort_type: number
  show_price: number
  password: string
  config: {
    open_danmu: boolean
  }
}>({
  wardrobe_name: '',
  wardrobe_cover: '',
  wardrobe_desc: '',
  is_private: false,
  sort_type: 0,
  show_price: 1,
  password: '',
  config: {
    open_danmu: false
  },
})

const sortTypeOptions = computed((): optionsInterface[] => [
  { label: t('wardrobe.sort.custom'), value: 0 },
  { label: t('wardrobe.sort.buy_desc'), value: 1 },
  { label: t('wardrobe.sort.buy_asc'), value: 2 },
  { label: t('wardrobe.sort.price_desc'), value: 3 },
  { label: t('wardrobe.sort.price_asc'), value: 4 },
  { label: t('wardrobe.sort.wear_count_desc'), value: 5 },
  { label: t('wardrobe.sort.wear_count_asc'), value: 11 },
  { label: t('wardrobe.sort.wear_time_desc'), value: 9 },
  { label: t('wardrobe.sort.wear_time_asc'), value: 10 },
])

const defaultSortTypeForSelect = computed(
  (): optionsInterface =>
    sortTypeOptions.value.find((o) => Number(o.value) === form.value.sort_type)
    ?? sortTypeOptions.value[0]
)

const currentSortTypeLabel = computed(
  () => sortTypeOptions.value.find((o) => Number(o.value) === form.value.sort_type)?.label ?? t('wardrobe.sort.custom')
)

function openSortTypeSelect(e: MouseEvent) {
  sortTypeSelectRef.value?.showPicker(e)
}

function onSortTypeSelect(sel: optionsInterface | { label: string; value: string }) {
  const num = typeof sel.value === 'number' ? sel.value : Number(sel.value)
  if (!Number.isNaN(num)) {
    form.value.sort_type = num
  }
}

const showPriceOptions = computed((): optionsInterface[] => [
  { label: t('wardrobe.show_price.total'), value: 1 },
  { label: t('wardrobe.show_price.hide_total'), value: 0 },
  { label: t('wardrobe.show_price.hide_all'), value: 2 },
])

const defaultShowPriceForSelect = computed(
  (): optionsInterface =>
    showPriceOptions.value.find((o) => Number(o.value) === form.value.show_price)
    ?? showPriceOptions.value[0]
)

const currentShowPriceLabel = computed(
  () => showPriceOptions.value.find((o) => Number(o.value) === form.value.show_price)?.label ?? t('wardrobe.show_price.total')
)

function openShowPriceSelect(e: MouseEvent) {
  showPriceSelectRef.value?.showPicker(e)
}

function onShowPriceSelect(sel: optionsInterface | { label: string; value: string }) {
  const num = typeof sel.value === 'number' ? sel.value : Number(sel.value)
  if (!Number.isNaN(num)) {
    form.value.show_price = num
  }
}

function toggleCustomSection() {
  customSectionExpanded.value = !customSectionExpanded.value
  persistCustomSectionExpanded(customSectionExpanded.value)
}

// 关闭回调
const handleClose = () => {
  closeModel()
}

// 显示模型
const showModel = (item: Wardrobe | null = null, event?: MouseEvent) => {
  // 记录触发位置（用于 QhxModal 动画）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    clickPosition.value = {
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0
    }
  }
  if (item) {
    type.value = 1
    form.value.wardrobe_name = item.wardrobe_name || ''
    form.value.wardrobe_desc = item.wardrobe_desc || ''
    form.value.is_private = (item.is_private ?? 0) === 1
    form.value.sort_type = item.sort_type ?? 0
    form.value.show_price = item.show_price ?? 1
    console.log(item.password, 'item.password')
    form.value.password = item.password ?? ''
    form.value.config.open_danmu = (item.config?.open_danmu ?? 0) === 1
    customStyle.value = parseEntityCustomStyle(item)
    
    wardrobe_id.value = item.wardrobe_id || null
    
    // 设置封面图片预览
    nextTick(() => {
      if (item.wardrobe_cover && wardrobeCoverRef.value) {
        wardrobeCoverRef.value.previewImages = [{
          url: BASE_IMG + item.wardrobe_cover,
          file: undefined as unknown as File
        }]
      }
    })
  } else {
    type.value = 0
    customStyle.value = createDefaultCommunityCustomStyle()
    nextTick(() => customStyleFormRef.value?.reset())
  }
  customSectionExpanded.value = readCustomSectionExpanded()
  show.value = true
}

// 上传图片处理
const fetchUpload = async (file: { file?: File; url: string }) => {
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
    toast.add({
      title: t('wardrobe.add_edit.upload_failed'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return ''
  }
}

// 封面图片更新
const onUpdateCoverFiles = (files: File[]) => {
  // 文件已通过 QhxImagePicker 处理
}

// 提交表单
const insert = async () => {
  if (!form.value.wardrobe_name.trim()) {
    toast.add({
      title: t('wardrobe.add_edit.name_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  loading.value = true
  try {
    const stylePayload = { ...customStyle.value }
    const bgPicker = customStyleFormRef.value?.getBackgroundPicker()
    if (bgPicker?.previewImages.length) {
      const bgImg = bgPicker.previewImages[0]
      if (bgImg && typeof bgImg === 'object' && 'url' in bgImg) {
        const background = await fetchUpload(bgImg as { file?: File; url: string })
        if (!background) {
          loading.value = false
          return
        }
        stylePayload.background = background
      }
    } else {
      stylePayload.background = null
    }

    const params: Wardrobe = {
      wardrobe_name: form.value.wardrobe_name,
      wardrobe_desc: form.value.wardrobe_desc,
      is_private: form.value.is_private ? 1 : 0,
      sort_type: form.value.sort_type,
      show_price: form.value.show_price,
      config: {
        open_danmu: form.value.config.open_danmu ? 1 : 0,
      },
      custom_style: hasCommunityCustomStyle(stylePayload)
        ? serializeCommunityCustomStyle(stylePayload)
        : undefined,
      background: stylePayload.background ?? undefined,
    }

    // 处理密码
    if (form.value.password?.trim()) {
      params.password = form.value.password
    } else {
      params.password = undefined
    }

    // 处理封面图片
    if (wardrobeCoverRef.value?.previewImages.length) {
      const wardrobe_cover = await fetchUpload(wardrobeCoverRef.value.previewImages[0])
      if (wardrobe_cover) {
        params.wardrobe_cover = wardrobe_cover
      }
    } else {
      params.wardrobe_cover = undefined
    }

    if (type.value === 0) {
      await insertWardrobe(params)
      toast.add({
        title: t('wardrobe.add_edit.add_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    } else {
      if (!wardrobe_id.value) {
        toast.add({
          title: t('wardrobe.add_edit.id_missing'),
          icon: 'i-heroicons-exclamation-circle',
          color: 'red'
        })
        return
      }
      params.wardrobe_id = wardrobe_id.value
      await updateWardrobe(params)
      toast.add({
        title: t('wardrobe.add_edit.update_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    }
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: t('common.failed'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 关闭模型
const closeModel = () => {
  show.value = false
  initData()
}

// 初始化数据
const initData = () => {
  form.value = {
    wardrobe_name: '',
    wardrobe_cover: '',
    wardrobe_desc: '',
    is_private: false,
    sort_type: 0,
    show_price: 1,
    password: '',
    config: {
      open_danmu: false
    },
  }
  customStyle.value = createDefaultCommunityCustomStyle()
  wardrobe_id.value = null
  
  // 清空图片选择器
  nextTick(() => {
    if (wardrobeCoverRef.value) {
      wardrobeCoverRef.value.clear()
    }
    customStyleFormRef.value?.reset()
  })
}

defineExpose({
  showModel
})
</script>
