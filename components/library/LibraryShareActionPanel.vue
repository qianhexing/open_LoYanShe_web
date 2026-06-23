<template>
  <div>
    <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
      生成分享图
    </p>
    <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
      <button
        type="button"
        class="neu-share-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-pink-100"
        :disabled="!payload || generating"
        @click="emit('generate')"
      >
        <span v-if="generating" class="inline-flex items-center justify-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
          生成并上传中…
        </span>
        <span v-else>生成分享图并上传</span>
      </button>
      <button
        v-if="previewReady && !generating"
        type="button"
        class="rounded-xl px-4 py-2.5 text-sm font-medium text-[#7a5f6f] outline-none ring-1 ring-pink-300/50 transition hover:bg-pink-50/80 active:scale-[0.99] dark:text-pink-200/90 dark:ring-pink-800/60 dark:hover:bg-pink-950/40"
        @click="emit('preview')"
      >
        查看分享图
      </button>
    </div>
    <p
      v-if="previewReady && !generating"
      class="mt-2 text-center text-[11px] text-[#8a6f7d] dark:text-pink-300/80"
    >
      <template v-if="isAppWebView">
        已上传，点「查看分享图」后可用<strong class="font-semibold text-[#9d6080] dark:text-pink-300">保存到相册</strong>按钮，或长按图片保存
      </template>
      <template v-else>
        已上传至服务器，点击「查看分享图」可在弹窗中预览或右键另存
      </template>
    </p>
    <div v-if="errorMsg" class="mt-2 text-center text-xs text-red-600 dark:text-red-400">
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LibrarySharePayload } from '@/utils/libraryShareCanvas'
import { isHtml5PlusWebView } from '@/composables/useSaveNetworkImageToAlbum'

defineProps<{
  payload: LibrarySharePayload | null
  generating: boolean
  previewReady: boolean
  errorMsg: string
}>()

const emit = defineEmits<{
  generate: []
  preview: []
}>()

const isAppWebView = computed(() => isHtml5PlusWebView())
</script>

<style scoped>
.neu-share-btn {
  background: var(--neu-raised, #ebe3e8);
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -3px -3px 10px rgba(255, 252, 254, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .neu-share-btn {
  --neu-raised: #2e252c;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.4),
    -2px -2px 8px rgba(130, 90, 110, 0.06),
    inset 0 1px 0 rgba(255, 210, 230, 0.05);
}
</style>
