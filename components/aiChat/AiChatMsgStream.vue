<script setup lang="ts">
defineProps<{
	reasoning?: string
	content?: string
}>()
</script>

<template>
  <div
    class="max-w-[95%] min-w-0 rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-sm text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
    <div
      v-if="!(reasoning?.length) && !(content?.length)"
      class="flex items-center gap-2 text-[13px] leading-snug text-qhx-text/80">
      <span
        class="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-qhx-border border-t-qhx-primary"
        aria-hidden="true" />
      <span>正在分析意图…</span>
    </div>
    <template v-else>
      <div
        v-if="reasoning?.length"
        class="mb-3 rounded-xl bg-qhx-bg/90 px-2.5 py-2 text-[12px] leading-relaxed text-qhx-text/85 shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)]">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-qhx-primary/90">思考</p>
        <p class="whitespace-pre-wrap break-words font-normal">{{ reasoning }}</p>
      </div>
      <div
        v-if="content?.length"
        class="rounded-xl bg-qhx-bg px-2.5 py-2 font-mono text-[11px] leading-relaxed text-qhx-text/90 shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)]">
        <p class="mb-1 text-[11px] font-semibold text-qhx-text/70">模型输出</p>
        <pre class="max-h-[40dvh] overflow-auto whitespace-pre-wrap break-words">{{ content }}</pre>
      </div>
    </template>
  </div>
</template>
