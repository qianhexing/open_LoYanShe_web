<script setup lang="ts">
import type { EventRedblack } from '@/types/api'
import { getEventRedblackList, insertEventRedblack } from '@/api/event_redblack'
import EventList from '@/components/eventRedblack/EventList.vue'
import type QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'
import { useToast } from '#imports'

interface Props {
  pk_id: number
  pk_type: number
  can_load?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  can_load: true,
})

const emit = defineEmits<{
  load: [count: number]
}>()

const user = useUserStore()
const toast = useToast()

const pageSize = 10
const page = ref(1)
const list = ref<EventRedblack[]>([])
const total = ref(0)
const loading = ref(false)

const showAddModal = ref(false)
const submitting = ref(false)
const editorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)
const attitude = ref(3)

const attitudeOptions = [
  { value: 3, label: '中性' },
  { value: 0, label: '好评' },
  { value: 1, label: '差评' },
] as const

const canAdd = computed(
  () => !!user.token && (user.user?.access_level ?? 0) > 0
)

const attitudeLabel = computed(
  () => attitudeOptions.find(o => o.value === attitude.value)?.label ?? '中性'
)

async function fetchList(targetPage = page.value) {
  if (!props.can_load) return
  loading.value = true
  try {
    const res = await getEventRedblackList({
      page: targetPage,
      pageSize,
      pk_id: props.pk_id,
      pk_type: props.pk_type,
    })
    if (targetPage === 1) {
      list.value = res.rows ?? []
    } else {
      list.value = [...list.value, ...(res.rows ?? [])]
    }
    total.value = res.count ?? 0
    emit('load', total.value)
  } catch {
    if (targetPage === 1) {
      list.value = []
      total.value = 0
      emit('load', 0)
    }
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (loading.value) return
  const maxPage = Math.ceil(total.value / pageSize)
  if (page.value < maxPage) {
    page.value += 1
    fetchList(page.value)
  }
}

function reload() {
  const size = page.value * pageSize
  page.value = 1
  loading.value = true
  getEventRedblackList({
    page: 1,
    pageSize: size || pageSize,
    pk_id: props.pk_id,
    pk_type: props.pk_type,
  })
    .then((res) => {
      list.value = res.rows ?? []
      total.value = res.count ?? 0
      emit('load', total.value)
    })
    .finally(() => {
      loading.value = false
    })
}

function openAddModal(e?: MouseEvent) {
  if (!canAdd.value) return
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
  attitude.value = 3
  editorRef.value?.clearContent()
}

async function submitEvent() {
  if (submitting.value) return
  if (!editorRef.value || editorRef.value.isEmpty) {
    toast.add({ title: '请输入内容', color: 'orange' })
    return
  }
  const content = editorRef.value.getContent()
  if (content.length > 5000) {
    toast.add({ title: '字数超过5000字', color: 'orange' })
    return
  }

  submitting.value = true
  try {
    await insertEventRedblack({
      pk_id: props.pk_id,
      pk_type: props.pk_type,
      attitude: attitude.value,
      event_desc: content,
    })
    toast.add({ title: '添加成功', color: 'green' })
    closeAddModal()
    reload()
  } catch {
    toast.add({ title: '添加失败', color: 'red' })
  } finally {
    submitting.value = false
  }
}

watch(
  () => [props.can_load, props.pk_id, props.pk_type] as const,
  ([canLoad]) => {
    if (canLoad) {
      page.value = 1
      fetchList(1)
    }
  },
  { immediate: true }
)

defineExpose({ reload })
</script>

<template>
  <div class="bg-white dark:bg-gray-900">
    <p class="text-sm text-gray-500 dark:text-gray-400 text-center px-4 pt-4 pb-2">
      记录与这条目相关的红黑事件，由投稿人负责言论真实性
    </p>
    <div class="flex justify-center px-4 pb-4">
      <QhxJellyButton v-if="canAdd">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="openAddModal"
        >
          <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
          添加大事记
        </button>
      </QhxJellyButton>
      <p v-else class="text-xs text-gray-500">
        正式居民可以添加大事记
      </p>
    </div>

    <EventList :list="list" />

    <QhxLoading
      :loading="loading"
      :page="page"
      :total="total"
      :page-size="pageSize"
      @load-more="loadMore"
    />

    <QhxModal v-model="showAddModal" :close-on-backdrop="false" @close="closeAddModal">
      <div class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50/90 to-orange-50/80 dark:from-gray-800 dark:to-gray-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">添加大事记</h2>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="closeAddModal"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>

        <div class="p-4 space-y-4 overflow-y-auto flex-1">
          <p class="text-xs text-gray-500">请确保发布信息的真实性</p>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in attitudeOptions"
              :key="opt.value"
              type="button"
              class="px-3 py-1.5 text-xs rounded-full border transition-colors"
              :class="attitude === opt.value
                ? 'border-qhx-primary bg-qhx-primary/10 text-qhx-primary font-semibold'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'"
              @click="attitude = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <p class="text-xs text-gray-400">当前事件性质：{{ attitudeLabel }}</p>

          <ClientOnly>
            <QhxRichTextEditor
              ref="editorRef"
              placeholder="红黑事件由投稿人为言论负责，与平台无关"
              :min-height="180"
              :max-height="320"
              :enable-topic="false"
              :enable-emoji="true"
              :enable-mention="true"
              :enable-internal-link="true"
            />
          </ClientOnly>
        </div>

        <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <QhxJellyButton>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              @click="closeAddModal"
            >
              取消
            </button>
          </QhxJellyButton>
          <QhxJellyButton>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
              :disabled="submitting"
              @click="submitEvent"
            >
              <UIcon v-if="submitting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
              添加大事件
            </button>
          </QhxJellyButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>
