<!-- pk_type=5 计划：封面由卡片壳按 getJournalFirstImagePath 展示，无封面则不显示 -->
<script setup lang="ts">
import type { Journal, PlanList } from '@/types/api'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'

defineProps<{
  journal: Journal
  imageParams?: string
}>()

function formatPlanMoney(money?: number | null): string {
  if (money === undefined || money === null) return '0'
  return Number(money).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function getPlanProgress(plan: PlanList): number {
  const needMoney = plan.need_money || 0
  const haveMoney = plan.have_money || 0
  if (needMoney === 0) return 0
  return Math.min(Math.max(Math.round((haveMoney / needMoney) * 100), 0), 100)
}
</script>

<template>
  <div v-if="journal.plan" class="space-y-1.5">
    <div class="text-base font-semibold text-[#3d2833] dark:text-[var(--ink-primary)]">
      {{ journal.plan.plan_name || '未命名计划' }}
    </div>
    <div
      v-if="journal.plan.plan_note"
      class="line-clamp-2 text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]"
    >
      {{ journal.plan.plan_note }}
    </div>
    <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">
      ￥{{ formatPlanMoney(journal.plan.have_money) }}/￥{{ formatPlanMoney(journal.plan.need_money) }}
    </div>
    <div class="flex items-center gap-2">
      <div class="h-1.5 max-w-32 flex-1 rounded-full bg-[var(--paper-dent)]">
        <div
          class="h-1.5 rounded-full bg-[var(--accent-warm)]"
          :style="{ width: `${getPlanProgress(journal.plan)}%` }"
        />
      </div>
      <span class="text-[10px] text-[#8a6f7d] dark:text-[var(--ink-muted)]">
        {{ Math.ceil(getPlanProgress(journal.plan)) }}%
      </span>
    </div>
  </div>
  <TypeInvalid v-else />
</template>
