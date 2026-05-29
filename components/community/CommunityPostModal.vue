<template>
  <QhxModal
    v-model="open"
    :trigger-position="innerTriggerPosition"
    :close-on-backdrop="closeOnBackdrop"
  >
    <div
      class="w-[96vw] max-w-3xl max-h-[92vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/60 dark:border-gray-700/60"
    >
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-pink-50/90 to-purple-50/80 dark:from-gray-800 dark:to-gray-800"
      >
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ modalTitle }}</h3>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          aria-label="关闭"
          @click="closeFromHeader"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
        <div
          v-if="sceneContextLabel"
          class="mb-5 flex gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 px-4 py-3 text-sm dark:border-violet-800/60 dark:bg-violet-950/35"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 ring-1 ring-violet-200/70 dark:bg-gray-900/70 dark:ring-violet-700/45"
            aria-hidden="true"
          >
            <UIcon name="material-symbols:view-in-ar-rounded" class="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div class="min-w-0 pt-0.5">
            <p class="font-semibold text-violet-900 dark:text-violet-100">关联 3D 场景</p>
            <p class="mt-0.5 text-xs leading-relaxed text-violet-800/85 dark:text-violet-200/85">
              {{ sceneContextLabel }}
            </p>
          </div>
        </div>
        <ClientOnly>
          <CommunityPostEditor
            v-if="open"
            embedded
            :user-id="userId"
            :skip-summary-link="skipSummaryLink"
            :foreign-pk="foreignResolved"
            :initial-type="initialType"
            :initial-is-open="initialIsOpen"
            :sence-id="senceId"
            :scene-cover-relative-path="sceneCoverRelativePath"
            @success="onEditorSuccess"
            @cancel="onEditorCancel"
          />
        </ClientOnly>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import CommunityPostEditor from '@/components/community/PostEditor.vue'
import type { Community } from '@/types/api'
import {
  resolveCommunityPostForeignPk,
  type CommunityPostForeignContext
} from '@/utils/communityPost'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 外键上下文（优先于 pk_id + pk_type）；extra 预留扩展 */
    foreignPk?: CommunityPostForeignContext | null
    /** 便捷：与 foreignPk 二选一；pk_type 含义见 types/api `CommunityForeign` */
    pk_id?: number | null
    pk_type?: number | null
    userId?: number
    skipSummaryLink?: boolean
    initialType?: string
    /** 社区内可见：0 正式居民可见，1 开放，2 仅自己可见（未传则由编辑器默认 1） */
    initialIsOpen?: number
    /** 发帖成功后跳转；false 表示不跳转（默认 /community） */
    successRedirect?: string | false
    /** 关闭弹窗且非发布成功时是否 router.back（发帖独立页可设为 true） */
    navigateBackOnDismiss?: boolean
    modalTitle?: string
    /** 点击遮罩关闭；发帖场景默认关闭须点标题栏 ✕ / 编辑器取消 */
    closeOnBackdrop?: boolean
    /** 场景 ID：嵌入 iframe、写入 sence_id、预填封面 */
    senceId?: number
    /** 场景封面相对路径 */
    sceneCoverRelativePath?: string
  }>(),
  {
    foreignPk: undefined,
    pk_id: undefined,
    pk_type: undefined,
    userId: undefined,
    skipSummaryLink: false,
    initialType: undefined,
    initialIsOpen: undefined,
    successRedirect: '/community',
    navigateBackOnDismiss: false,
    modalTitle: '发帖分享',
    closeOnBackdrop: false,
    senceId: undefined,
    sceneCoverRelativePath: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: [community: Community]
  cancel: []
  close: []
}>()

const router = useRouter()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const innerTriggerPosition = ref({ x: 0, y: 0 })
const openedViaExpose = ref(false)
const closedBySuccess = ref(false)

const foreignResolved = computed(() =>
  resolveCommunityPostForeignPk(props.foreignPk, props.pk_id ?? undefined, props.pk_type ?? undefined)
)

const sceneContextLabel = computed(() => {
  if (props.senceId == null || !Number.isFinite(props.senceId)) return null
  const title = props.modalTitle === '发帖分享' ? '搭配场景' : '场景'
  return `${title} #${props.senceId} · 发布成功后将自动嵌入 3D 场景预览`
})

function centerTrigger() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

watch(
  () => props.modelValue,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      closedBySuccess.value = false
      if (!openedViaExpose.value) {
        innerTriggerPosition.value = centerTrigger()
      }
      openedViaExpose.value = false
    }
    if (wasOpen && !isOpen) {
      emit('close')
      if (!closedBySuccess.value && props.navigateBackOnDismiss) {
        router.back()
      }
      if (closedBySuccess.value) {
        closedBySuccess.value = false
      }
    }
  }
)

async function onEditorSuccess(c: Community) {
  closedBySuccess.value = true
  emit('success', c)
  const redir = props.successRedirect
  if (redir !== false) {
    await router.push(typeof redir === 'string' ? redir : '/community')
  }
  open.value = false
}

function onEditorCancel() {
  emit('cancel')
  open.value = false
}

function closeFromHeader() {
  open.value = false
}

/** 从点击位置打开（动画原点）；不设事件则居中 */
function openModal(e?: MouseEvent) {
  openedViaExpose.value = true
  innerTriggerPosition.value = e
    ? { x: e.clientX, y: e.clientY }
    : centerTrigger()
  open.value = true
}

function closeModal() {
  open.value = false
}

defineExpose({
  open: openModal,
  close: closeModal
})
</script>
