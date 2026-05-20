<script setup lang="ts">
import type { PlanList } from '@/types/api'

defineProps<{ intentHint?: string; echoPlan: PlanList }>()
const emit = defineEmits<{
	continue: []
	/** 由父级（如 `pages/ai/chat`）统一处理 Uni / 鸿蒙 / Web 跳转 */
	openPlanPage: []
}>()
</script>

<template>
  <div
    class="max-w-[95%] min-w-0 rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-sm text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
    <p v-if="intentHint" class="mb-2 text-[13px] leading-snug text-qhx-text">
      {{ intentHint }}
    </p>
    <div
      class="mt-2 rounded-xl bg-qhx-bg px-2.5 py-2 shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)]">
      <p class="line-clamp-2 text-[12px] font-semibold leading-snug text-qhx-text">
        {{ echoPlan.plan_name?.trim() || '未命名计划' }}
      </p>
      <p class="mt-1 text-[11px] tabular-nums text-qhx-text/75">
        目标 ¥{{ Number(echoPlan.need_money ?? 0) }}
      </p>
      <button
        type="button"
        class="mt-2 text-[11px] font-medium text-qhx-primary/90 underline-offset-2 hover:underline"
        @click="emit('openPlanPage')">
        去计划页查看
      </button>
    </div>
    <button
      type="button"
      class="mt-3 text-xs font-medium text-qhx-primary/90 underline-offset-2 hover:underline"
      @click="emit('continue')">
      继续提问
    </button>
  </div>
</template>
