<script setup lang="ts">
import { getDecoList } from '@/api/deco'
import type { DecoItem } from '@/api/deco'
import QhxModal from '@/components/Qhx/Modal.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  getDecoDisplayTitle,
  getGardenFlowerDecoMeta,
  setGardenFlowerDecoRegistry,
} from '@/utils/gardenFlowerDeco'

const modelValue = defineModel<string>({ default: '' })

const showModal = ref(false)
const decoList = ref<DecoItem[]>([])
const decoListLoading = ref(false)
const decoListTotal = ref(0)
const decoListPage = ref(1)
const decoListPageSize = 20
const pendingDecoId = ref<number | null>(null)

function getDecoCover(item: DecoItem): string {
  return item.cover || item.url || 'static/plan_cover/default.jpg'
}

function getDecoDesc(item: DecoItem): string | null {
  const d = item.desc?.trim()
  return d || null
}

function getDecoConditionsFromJson(item: DecoItem): string | null {
  const jd = item.json_data as { conditions?: unknown } | null
  if (!jd || jd.conditions == null) return null
  const c = jd.conditions
  if (typeof c === 'string') {
    const t = c.trim()
    return t || null
  }
  if (Array.isArray(c)) {
    const parts = c.map((x) => String(x).trim()).filter(Boolean)
    return parts.length ? parts.join('、') : null
  }
  if (typeof c === 'object') {
    try {
      return JSON.stringify(c)
    } catch {
      return String(c)
    }
  }
  return String(c)
}

function is3DModel(url: string): boolean {
  const lower = String(url || '').toLowerCase()
  return lower.endsWith('.glb') || lower.endsWith('.gltf')
}

const selectedMeta = computed(() => getGardenFlowerDecoMeta(modelValue.value))

const NO_FLOWER_ID = 0

const selectedTitle = computed(() => {
  if (!modelValue.value) return '不种花'
  if (selectedMeta.value) return selectedMeta.value.title
  const id = Number(modelValue.value)
  if (Number.isFinite(id) && id > 0) {
    const row = decoList.value.find((item) => item.deco_id === id)
    if (row) return getDecoDisplayTitle(row)
  }
  return '不种花'
})

const selectedCover = computed(() => {
  if (selectedMeta.value?.cover) return selectedMeta.value.cover
  if (selectedMeta.value?.url) return selectedMeta.value.url
  const id = Number(modelValue.value)
  const row = decoList.value.find((item) => item.deco_id === id)
  return row ? getDecoCover(row) : null
})

async function fetchDecoList(page = 1, append = false) {
  decoListLoading.value = true
  try {
    const res = await getDecoList({ page, pageSize: decoListPageSize, type: 1 })
    if (append) decoList.value = [...decoList.value, ...res.rows]
    else decoList.value = res.rows ?? []
    decoListTotal.value = res.count ?? 0
    decoListPage.value = page
    setGardenFlowerDecoRegistry(decoList.value)
  } catch (error) {
    console.error('获取花朵列表失败:', error)
  } finally {
    decoListLoading.value = false
  }
}

function openModal() {
  const currentId = Number(modelValue.value)
  pendingDecoId.value =
    Number.isFinite(currentId) && currentId > 0 ? currentId : NO_FLOWER_ID
  showModal.value = true
  if (!decoList.value.length) {
    void fetchDecoList(1)
  }
}

function selectNoFlower() {
  pendingDecoId.value = NO_FLOWER_ID
}

function selectDeco(item: DecoItem) {
  if (item.has_own !== 1) return
  pendingDecoId.value = item.deco_id
}

function isPendingSelected(decoId: number) {
  return pendingDecoId.value === decoId
}

function confirmSelect() {
  if (pendingDecoId.value === NO_FLOWER_ID) {
    modelValue.value = ''
    showModal.value = false
    return
  }
  if (pendingDecoId.value == null) return
  const picked = decoList.value.find((item) => item.deco_id === pendingDecoId.value)
  if (!picked || picked.has_own !== 1) return
  modelValue.value = String(pendingDecoId.value)
  showModal.value = false
}

function closeModal() {
  showModal.value = false
}

watch(showModal, (open) => {
  if (!open) return
  const currentId = Number(modelValue.value)
  pendingDecoId.value =
    Number.isFinite(currentId) && currentId > 0 ? currentId : NO_FLOWER_ID
})
</script>

<template>
  <div class="space-y-2">
    <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
      选择今日花朵
      <span class="font-normal text-qhx-text-muted">（可选）</span>
    </div>

    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-qhx-primary/50 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-qhx-primary/40"
      @click="openModal"
    >
      <div
        class="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700"
      >
        <img
          v-if="selectedCover && !is3DModel(selectedCover)"
          :src="`${BASE_IMG}${selectedCover}`"
          alt=""
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div
          v-else-if="selectedCover"
          class="flex h-full w-full items-center justify-center text-qhx-primary"
        >
          <UIcon name="i-heroicons-cube" class="h-7 w-7" />
        </div>
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-2xl"
          aria-hidden="true"
        >
          🌸
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
          {{ selectedTitle }}
        </div>
        <div class="mt-0.5 text-xs text-qhx-text-muted">可选 · 点击选择已解锁的花朵</div>
      </div>
      <UIcon name="i-heroicons-chevron-right" class="h-5 w-5 shrink-0 text-gray-400" />
    </button>

    <QhxModal v-model="showModal" @close="closeModal">
      <div
        class="flex max-h-[80vh] w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl backdrop-blur-xl dark:border-gray-600/60 dark:bg-gray-800"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-gray-200/60 px-5 py-4 dark:border-gray-600/60"
        >
          <h2 class="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
            <span class="text-qhx-primary" aria-hidden="true">🌸</span>
            选择今日花朵
          </h2>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="closeModal"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            仅已解锁的花朵可种植到花园（与徽章相同的使用权限）
          </p>

          <div v-if="decoListLoading && !decoList.length" class="flex justify-center py-12">
            <UIcon name="i-heroicons-arrow-path" class="h-10 w-10 animate-spin text-qhx-primary" />
          </div>
          <div
            v-else-if="!decoList.length"
            class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400"
          >
            <span class="mb-2 text-3xl" aria-hidden="true">🌱</span>
            <span class="text-sm">暂无可用花朵</span>
          </div>
          <div v-else class="grid grid-cols-2 gap-2 sm:gap-3">
            <div
              class="relative flex min-h-0 min-w-0 touch-manipulation gap-2 rounded-2xl border-2 p-2 transition-all sm:gap-3 sm:p-3 cursor-pointer active:scale-[0.98]"
              :class="
                pendingDecoId === NO_FLOWER_ID
                  ? 'border-qhx-primary bg-qhx-primary/10 ring-2 ring-qhx-primary dark:bg-qhx-primary/15'
                  : 'border-gray-200 hover:border-qhx-primary/50 dark:border-gray-600'
              "
              @click="selectNoFlower"
            >
              <div
                class="relative flex aspect-square w-14 shrink-0 items-center justify-center self-center rounded-xl bg-gray-100 text-2xl sm:w-[4.5rem] dark:bg-gray-700/50"
                aria-hidden="true"
              >
                —
              </div>
              <div class="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 text-left">
                <div class="line-clamp-2 text-sm font-semibold leading-snug text-qhx-primary">
                  不种花
                  <span v-if="pendingDecoId === NO_FLOWER_ID" class="ml-0.5">✓</span>
                </div>
                <p class="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  仅打卡签到，不在花园中种植花朵
                </p>
              </div>
            </div>
            <div
              v-for="item in decoList"
              :key="item.deco_id"
              class="relative flex min-h-0 min-w-0 touch-manipulation gap-2 rounded-2xl border-2 p-2 transition-all sm:gap-3 sm:p-3"
              :class="[
                isPendingSelected(item.deco_id)
                  ? 'cursor-pointer border-qhx-primary bg-qhx-primary/10 ring-2 ring-qhx-primary dark:bg-qhx-primary/15 active:scale-[0.98]'
                  : item.has_own === 1
                    ? 'cursor-pointer border-gray-200 hover:border-qhx-primary/50 active:scale-[0.98] dark:border-gray-600'
                    : 'cursor-not-allowed border-gray-200 dark:border-gray-600',
              ]"
              @click="selectDeco(item)"
            >
              <div
                class="relative aspect-square w-14 shrink-0 self-center overflow-hidden rounded-xl bg-gray-100 sm:w-[4.5rem] dark:bg-gray-700/50"
                :class="{ 'opacity-70 grayscale': item.has_own !== 1 }"
              >
                <img
                  v-if="!is3DModel(getDecoCover(item))"
                  :src="`${BASE_IMG}${getDecoCover(item)}`"
                  :alt="getDecoDisplayTitle(item)"
                  class="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div
                  v-else
                  class="absolute inset-0 flex items-center justify-center text-qhx-primary"
                >
                  <UIcon name="i-heroicons-cube" class="h-8 w-8" />
                </div>
                <div
                  v-if="item.has_own !== 1"
                  class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50"
                >
                  <span class="px-1 text-center text-[10px] font-medium leading-tight text-white/95">
                    未解锁
                  </span>
                </div>
              </div>
              <div class="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 text-left">
                <div
                  class="line-clamp-2 text-sm font-semibold leading-snug"
                  :class="
                    item.has_own === 1 ? 'text-qhx-primary' : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{ getDecoDisplayTitle(item) }}
                  <span v-if="isPendingSelected(item.deco_id)" class="ml-0.5">✓</span>
                </div>
                <p
                  v-if="getDecoDesc(item)"
                  class="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400"
                >
                  {{ getDecoDesc(item) }}
                </p>
                <p
                  v-if="getDecoConditionsFromJson(item)"
                  class="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-gray-500"
                >
                  <span class="text-gray-400">获取条件</span>
                  <span class="mx-0.5 text-gray-400">·</span>
                  <span>{{ getDecoConditionsFromJson(item) }}</span>
                </p>
              </div>
            </div>
          </div>

          <div v-if="decoList.length < decoListTotal && !decoListLoading" class="mt-4 text-center">
            <UButton
              size="sm"
              variant="soft"
              class="rounded-full border-qhx-primary/30 bg-qhx-primary/10 px-6 text-qhx-primary hover:bg-qhx-primary/20"
              @click="fetchDecoList(decoListPage + 1, true)"
            >
              加载更多
            </UButton>
          </div>
        </div>

        <div
          class="flex shrink-0 justify-end gap-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700"
        >
          <UButton variant="ghost" color="gray" class="rounded-xl" @click="closeModal">
            取消
          </UButton>
          <UButton
            class="rounded-xl bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :disabled="pendingDecoId == null"
            @click="confirmSelect"
          >
            确定
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>
