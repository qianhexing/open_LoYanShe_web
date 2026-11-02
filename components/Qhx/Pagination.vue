<script setup lang="ts">
import { computed } from 'vue'

type PageItem = number | 'ellipsis'

const props = withDefaults(
  defineProps<{
    /** 总条数 */
    total: number
    /** 每页条数 */
    pageSize?: number
    /** 最多展示的页码按钮数（含省略号两侧的首页/末页） */
    max?: number
    disabled?: boolean
  }>(),
  {
    pageSize: 20,
    max: 7,
    disabled: false,
  },
)

const page = defineModel<number>({ default: 1 })

const totalPages = computed(() => {
  const size = Math.max(1, props.pageSize)
  return Math.max(1, Math.ceil(Math.max(0, props.total) / size))
})

const currentPage = computed(() => {
  const raw = Number(page.value) || 1
  return Math.min(Math.max(1, raw), totalPages.value)
})

const canGoPrev = computed(() => currentPage.value > 1 && !props.disabled)
const canGoNext = computed(() => currentPage.value < totalPages.value && !props.disabled)

const displayedPages = computed((): PageItem[] => {
  const total = totalPages.value
  const current = currentPage.value
  const max = Math.max(5, props.max)

  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items: PageItem[] = [1]
  const innerCount = max - 2
  let start = Math.max(2, current - Math.floor((innerCount - 1) / 2))
  let end = start + innerCount - 1
  if (end > total - 1) {
    end = total - 1
    start = Math.max(2, end - innerCount + 1)
  }
  if (start <= 2) {
    start = 2
  } else {
    items.push('ellipsis')
  }
  for (let i = start; i <= end; i++) {
    items.push(i)
  }
  if (end < total - 1) items.push('ellipsis')
  items.push(total)
  return items
})

function go(target: number) {
  if (props.disabled) return
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
}
</script>

<template>
  <nav class="qhx-pagination" aria-label="分页">
    <button
      type="button"
      class="qhx-pagination-btn"
      :disabled="!canGoPrev"
      aria-label="上一页"
      @click="go(currentPage - 1)"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12.5 4.5 7 10l5.5 5.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <template v-for="(item, index) in displayedPages" :key="`${item}-${index}`">
      <span v-if="item === 'ellipsis'" class="qhx-pagination-ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        class="qhx-pagination-btn"
        :class="{ 'is-active': item === currentPage }"
        :disabled="disabled"
        :aria-current="item === currentPage ? 'page' : undefined"
        :aria-label="`第 ${item} 页`"
        @click="go(item)"
      >
        {{ item }}
      </button>
    </template>

    <button
      type="button"
      class="qhx-pagination-btn"
      :disabled="!canGoNext"
      aria-label="下一页"
      @click="go(currentPage + 1)"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M7.5 4.5 13 10l-5.5 5.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.qhx-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.qhx-pagination-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color, #ffd1dc);
  background: var(--card-color, #fff);
  color: var(--text-color, #111827);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.qhx-pagination-btn svg {
  width: 14px;
  height: 14px;
}

.qhx-pagination-btn:hover:not(:disabled) {
  border-color: var(--primary-color, #ff9eb5);
  color: var(--primary-color, #ff9eb5);
}

.qhx-pagination-btn.is-active {
  background: var(--primary-color, #ff9eb5);
  border-color: var(--primary-color, #ff9eb5);
  color: var(--inverted-color, #fff);
}

.qhx-pagination-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.qhx-pagination-ellipsis {
  min-width: 20px;
  text-align: center;
  color: var(--textSecondary-color, #9b8a97);
  font-weight: 700;
  user-select: none;
}
</style>
