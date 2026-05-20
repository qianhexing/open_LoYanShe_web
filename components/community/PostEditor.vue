<template>
  <div
    :class="
      embedded
        ? ''
        : 'min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4'
    "
  >
    <div :class="embedded ? '' : 'max-w-2xl mx-auto'">
      <!-- 表单 -->
      <div
        :class="
          embedded
            ? ''
            : 'bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700'
        "
      >
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- 标题输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              标题 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formData.title"
              type="text"
              placeholder="请输入标题"
              required
              maxlength="100"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200 placeholder-gray-400"
            />
          </div>

          <!-- 富文本编辑器 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容 <span class="text-red-500">*</span>
              </label>
              <QhxRichTextEditor
                v-model="formData.content"
                placeholder="请输入内容..."
                :min-height="embedded ? editorMinHeightEmbedded : editorMinHeight"
                :max-height="embedded ? editorMaxHeightEmbedded : editorMaxHeight"
                :enable-image-upload="true"
                :enable-topic="false"
                :enable-emoji="true"
                :enable-mention="false"
                :enable-internal-link="true"
                ref="richTextEditorRef"
              />
            </div>

          <!-- 图片选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              图片 <span class="text-gray-500 text-xs">(最多20张，支持拖拽排序)</span>
            </label>
            <QhxImagePicker 
              :multiple="true" 
              :max="20"
              :initial-image-paths="initialImagePaths"
              @update:files="onUpdateFiles" 
              ref="imagePickerRef" 
            />
          </div>

          <!-- 谁能看到（与标题区同一套版面：标签在上 + 圆角控件） -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              谁能看到
              <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">
                社区展示范围 · 点此更换
              </span>
            </label>
            <button
              type="button"
              class="group w-full flex items-center gap-3 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-700/40 px-4 py-2.5 text-left outline-none transition-all duration-200 hover:border-pink-300/95 dark:hover:border-pink-500/35 hover:bg-white dark:hover:bg-gray-700/90 hover:shadow-md hover:shadow-gray-900/[0.04] dark:hover:shadow-none focus-visible:ring-2 focus-visible:ring-pink-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
              :aria-label="`谁能看到：${currentIsOpenDisplay.label}，${currentIsOpenDisplay.desc}`"
              @click="openIsOpenPicker($event)"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-[1.04]"
                :class="isOpenUi.iconWrap"
              >
                <UIcon :name="isOpenUi.icon" class="h-5 w-5" :class="isOpenUi.iconClass" />
              </div>
              <div class="min-w-0 flex-1 py-0.5">
                <p
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug tracking-tight"
                >
                  {{ currentIsOpenDisplay.label }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-1">
                  {{ currentIsOpenDisplay.desc }}
                </p>
              </div>
              <div
                class="flex shrink-0 items-center justify-center rounded-full p-2 text-gray-400 transition-colors group-hover:text-pink-500 dark:group-hover:text-pink-400"
              >
                <UIcon
                  name="i-heroicons-chevron-down"
                  class="w-4 h-4 transition-transform duration-200 group-hover:translate-y-[1px]"
                />
              </div>
            </button>
          </div>

          <QhxSelect
            ref="isOpenSelectRef"
            :options="isOpenSelectOptions"
            :default-value="defaultIsOpenForSelect"
            @select="onIsOpenSelect"
          />

          <!-- 按钮组 -->
          <div class="flex gap-4 pt-4">
            <button
              type="button"
              @click="handleCancel"
              class="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full font-bold transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="submitting || !formData.title.trim()"
              class="flex-1 px-6 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-full font-bold transition-colors shadow-lg shadow-qhx-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ submitting ? (isEditMode ? '保存中...' : '发布中...') : (isEditMode ? '保存' : '发布') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
// QhxRichTextEditor 在模板中注册为组件，需值导入；biome 无法识别 SFC 模板用法
// biome-ignore lint/style/useImportType: Vue SFC 组件供模板与 InstanceType 使用
import QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'

import {
  insertCommunity,
  insertCommunityForeign,
  updateCommunity,
  type CommunityInterface,
  type UpdateCommunityParams
} from '@/api/community'
import { useUserStore } from '@/stores/user'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import { uploadImageOSS } from '@/utils/ossUpload'

interface Props {
  userId?: number
  skipSummaryLink?: boolean
  /** 有值时为编辑已有帖子 */
  communityId?: number
  initialTitle?: string
  initialContent?: string
  initialImgList?: string | null
  /** 原帖 type，更新时回传 */
  initialType?: string
  /** 发帖成功后写入 community foreign；pk_type：0店铺 1实体店 2衣柜服饰 3搭配场景 4搭配清单 5合集考据 6茶会返图 7图鉴返图（详见 types/api CommunityForeign） */
  foreignPk?: { pk_id: number; pk_type: number } | null
  /** 社区内可见：0 正式居民可见，1 开放（默认），2 仅自己可见 */
  initialIsOpen?: number
  /**
   * 嵌入模式（弹窗等）：去掉整页背景与外层卡片；取消不发 router.back；成功不发 router.push。
   */
  embedded?: boolean
  /** 嵌入模式下富文本最小高度 */
  editorMinHeightEmbedded?: number
  /** 嵌入模式下富文本最大高度 */
  editorMaxHeightEmbedded?: number
  /** 整页模式下富文本最小高度 */
  editorMinHeight?: number
  /** 整页模式下富文本最大高度 */
  editorMaxHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  userId: undefined,
  skipSummaryLink: false,
  communityId: undefined,
  initialTitle: '',
  initialContent: '',
  initialImgList: null,
  initialType: '日常交流',
  foreignPk: undefined,
  initialIsOpen: 1,
  embedded: false,
  editorMinHeightEmbedded: 220,
  editorMaxHeightEmbedded: 320,
  editorMinHeight: 300,
  editorMaxHeight: 400
})

const isOpenDisplayOptions = [
  { value: 0, label: '正式居民可见', desc: '仅正式居民在社区内可见' },
  { value: 1, label: '开放', desc: '在社区内对他人开放展示' },
  { value: 2, label: '仅自己可见', desc: '仅在本人视角可见' }
] as const

const IS_OPEN_UI: Record<
  0 | 1 | 2,
  { icon: string; iconWrap: string; iconClass: string }
> = {
  0: {
    icon: 'i-heroicons-user-group',
    iconWrap:
      'bg-violet-500/[0.11] ring-1 ring-inset ring-violet-500/15 dark:bg-violet-400/10 dark:ring-violet-400/20',
    iconClass: 'text-violet-600 dark:text-violet-300'
  },
  1: {
    icon: 'i-heroicons-globe-alt',
    iconWrap:
      'bg-emerald-500/[0.11] ring-1 ring-inset ring-emerald-500/15 dark:bg-emerald-400/10 dark:ring-emerald-400/20',
    iconClass: 'text-emerald-600 dark:text-emerald-300'
  },
  2: {
    icon: 'i-heroicons-lock-closed',
    iconWrap:
      'bg-slate-500/[0.09] ring-1 ring-inset ring-slate-400/20 dark:bg-slate-400/10 dark:ring-slate-500/25',
    iconClass: 'text-slate-600 dark:text-slate-300'
  }
}

const isOpenSelectOptions: optionsInterface[] = isOpenDisplayOptions.map((o) => ({
  label: o.label,
  value: o.value
}))

const isEditMode = computed(() => props.communityId != null && props.communityId > 0)

function normalizeInitialIsOpen(v: number | undefined): number {
  if (v === 0 || v === 1 || v === 2) return v
  return 1
}

const initialImagePaths = computed(() => {
  if (!props.initialImgList?.trim()) return undefined
  return props.initialImgList.split(',').map((s) => s.trim()).filter(Boolean)
})

const emit = defineEmits<{
  success: [value: Community]
  cancel: []
}>()

const toast = useToast()
const router = useRouter()
const userStore = useUserStore()

const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const richTextEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)
const isOpenSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

const formData = ref({
  title: props.initialTitle,
  content: props.initialContent,
  is_open: normalizeInitialIsOpen(props.initialIsOpen)
})

const defaultIsOpenForSelect = computed(
  (): optionsInterface =>
    isOpenSelectOptions.find((o) => Number(o.value) === formData.value.is_open)
    ?? isOpenSelectOptions[1]
)

const currentIsOpenDisplay = computed(() => {
  const v = formData.value.is_open
  const hit = isOpenDisplayOptions.find((o) => o.value === v)
  return hit ?? isOpenDisplayOptions[1]
})

const isOpenUi = computed(() => {
  const v = formData.value.is_open
  if (v === 0 || v === 1 || v === 2) return IS_OPEN_UI[v]
  return IS_OPEN_UI[1]
})

function openIsOpenPicker(e: MouseEvent) {
  isOpenSelectRef.value?.showPicker(e)
}

function onIsOpenSelect(sel: optionsInterface | { label: string; value: string }) {
  const v = sel.value
  const num = typeof v === 'number' ? v : Number(v)
  if (num === 0 || num === 1 || num === 2) {
    formData.value.is_open = num
  }
}

watch(
  () =>
    [props.communityId, props.initialTitle, props.initialContent, props.initialIsOpen] as const,
  () => {
    if (!isEditMode.value) return
    formData.value.title = props.initialTitle
    formData.value.content = props.initialContent
    formData.value.is_open = normalizeInitialIsOpen(props.initialIsOpen)
  },
  { immediate: true }
)

watch(
  () => props.initialIsOpen,
  (v) => {
    if (isEditMode.value) return
    formData.value.is_open = normalizeInitialIsOpen(v)
  }
)

// Upload & Submit Logic (Similar to before)
const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  try {
    const res = await uploadImageOSS(file)
    return res
  } catch (error) {
    console.error('图片上传失败:', error)
    throw error
  }
}

const onUpdateFiles = (files: File[]) => {
  if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 9) {
    toast.add({
      title: '最多只能上传9张图片',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    imagePickerRef.value.previewImages = imagePickerRef.value.previewImages.slice(0, 9)
  }
}

const handleCancel = () => {
  if (props.embedded) {
    emit('cancel')
    return
  }
  router.back()
}

const handleSubmit = async () => {
  if (!formData.value.title.trim()) {
    toast.add({
      title: '请输入标题',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (!richTextEditorRef.value || richTextEditorRef.value.isEmpty) {
    toast.add({
      title: '请输入内容',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  submitting.value = true

  try {
    const currentUserId = props.userId || userStore.user?.user_id
    if (!currentUserId) {
      toast.add({
        title: '请先登录',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      submitting.value = false
      return
    }

    let finalContent = richTextEditorRef.value.getContent()
    if (!props.skipSummaryLink) {
      const summaryLink = `<a href="lolitalibrary.com/yearlySummary?user_id=${currentUserId}">#2025年终总结</a>`
      finalContent = `${summaryLink}<br><br>${finalContent}`
    }

    let imgList: string[] = []
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages
          .filter((img): img is { file?: File; url: string } => typeof img === 'object' && 'url' in img && typeof img.url === 'string')
          .map(img => fetchUpload(img))
        imgList = await Promise.all(uploadPromises)
      } catch (error) {
        toast.add({
          title: '图片上传失败',
          description: '请检查图片后重试',
          icon: 'i-heroicons-x-circle',
          color: 'red'
        })
        submitting.value = false
        return
      }
    }

    const params: CommunityInterface = {
      title: formData.value.title,
      content: finalContent,
      type: props.initialType || '日常交流',
      img_list: imgList.length > 0 ? imgList.join() : null,
      is_open: formData.value.is_open
    }

    let community: Community
    if (isEditMode.value && props.communityId) {
      const updateParams: UpdateCommunityParams = {
        ...params,
        community_id: props.communityId
      }
      community = await updateCommunity(updateParams)
      toast.add({
        title: '保存成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success', community)
      if (!props.embedded) {
        router.push(`/community/detail/${props.communityId}`)
      }
    } else {
      community = await insertCommunity(params)
      const fk = props.foreignPk
      if (fk && Number.isFinite(fk.pk_id) && Number.isFinite(fk.pk_type)) {
        try {
          await insertCommunityForeign({
            pk_type: fk.pk_type,
            community_id: community.community_id,
            pk_id: fk.pk_id
          })
        } catch (foreignErr: unknown) {
          console.error('关联外键失败:', foreignErr)
          const msg = foreignErr instanceof Error ? foreignErr.message : '请稍后在帖子中手动关联'
          toast.add({
            title: '帖子已发布，但关联失败',
            description: msg,
            icon: 'i-heroicons-exclamation-triangle',
            color: 'orange'
          })
        }
      }
      toast.add({
        title: '发布成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success', community)
      if (!props.embedded) {
        router.push('/community')
      }
    }
  } catch (error: unknown) {
    console.error(isEditMode.value ? '保存失败:' : '发布失败:', error)
    const errorMessage = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: isEditMode.value ? '保存失败' : '发布失败',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}
</script>
