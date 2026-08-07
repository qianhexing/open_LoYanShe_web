<script setup lang="ts">
import LibraryShareImage from '@/components/library/LibraryShareImage.vue'
import type { LibrarySharePayload } from '@/utils/libraryShareCanvas'

defineProps<{
  libraryId: number
  goodCount: number
  collectCount: number
  wardrobeCount: number
  isInWardrobe: boolean
  sharePayload: LibrarySharePayload | null
}>()

const emit = defineEmits<{
  comment: []
  'add-to-wardrobe': []
}>()
</script>

<template>
  <div
    class="library-detail-action-dock pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3"
    role="toolbar"
    aria-label="图鉴互动"
  >
    <div
      class="library-detail-action-capsule pointer-events-auto flex max-w-full items-stretch gap-0.5 overflow-x-auto"
    >
      <button
        type="button"
        class="library-detail-action-item"
        aria-label="写评论"
        @click="emit('comment')"
      >
        <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="library-detail-action-item__icon" />
        <span class="library-detail-action-item__label">写评论</span>
      </button>

      <UserGoodBtn
        :pk_type="2"
        :pk_id="libraryId"
        :good_count="goodCount"
        :need_judge="true"
      >
        <template #default="{ childData }">
          <div class="library-detail-action-item" role="button" aria-label="点赞">
            <UIcon
              name="weui:like-filled"
              class="library-detail-action-item__icon"
              :class="childData.is_good ? 'text-[#409EFF]' : ''"
            />
            <span class="library-detail-action-item__label tabular-nums">
              {{ childData.good_count }}
            </span>
          </div>
        </template>
      </UserGoodBtn>

      <UserCollectBtn
        :collect_count="collectCount"
        :pk_type="2"
        :pk_id="libraryId"
        :need_judge="true"
      >
        <template #default="collectSlot">
          <div class="library-detail-action-item" role="button" aria-label="收藏">
            <UIcon
              name="ant-design:star-filled"
              class="library-detail-action-item__icon"
              :class="collectSlot.childData?.is_collect ? 'text-[#FFD166]' : ''"
            />
            <span class="library-detail-action-item__label tabular-nums">
              {{ collectSlot.childData?.collect_count ?? collectCount }}
            </span>
          </div>
        </template>
      </UserCollectBtn>

      <button
        type="button"
        class="library-detail-action-item"
        aria-label="加入衣柜"
        @click="emit('add-to-wardrobe')"
      >
        <UIcon
          name="hugeicons:wardrobe-04"
          class="library-detail-action-item__icon"
          :class="isInWardrobe ? 'text-[#409EFF]' : ''"
        />
        <span class="library-detail-action-item__label tabular-nums">{{ wardrobeCount }}</span>
      </button>

      <LibraryShareImage :payload="sharePayload" variant="capsule" />
    </div>
  </div>
</template>

<style scoped>
.library-detail-action-dock {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}

.library-detail-action-capsule {
  height: 3.2rem;
  min-height: 3.2rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 55%, transparent);
  background: color-mix(in srgb, var(--background-color-card, #fff) 62%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  padding: 0.28rem 0.4rem;
  scrollbar-width: none;
}

.library-detail-action-capsule::-webkit-scrollbar {
  display: none;
}

.dark .library-detail-action-capsule {
  border-color: color-mix(in srgb, #fff 12%, transparent);
  background: color-mix(in srgb, #111827 58%, transparent);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.library-detail-action-item {
  box-sizing: border-box;
  display: inline-flex;
  width: 3.25rem;
  height: 2.625rem;
  min-width: 3.25rem;
  min-height: 2.625rem;
  flex: 0 0 3.25rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.28rem 0.35rem;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--text-color, #374151) 88%, transparent);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
  user-select: none;
  overflow: hidden;
}

.library-detail-action-item:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

.library-detail-action-item:active {
  transform: scale(0.96);
}

.library-detail-action-item__icon {
  display: block;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  line-height: 0;
}

.library-detail-action-item__icon :deep(svg) {
  width: 18px !important;
  height: 18px !important;
}

.library-detail-action-item__label {
  display: block;
  width: 100%;
  height: 10px;
  font-size: 10px;
  line-height: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

:deep(.share-inline-btn) {
  box-sizing: border-box;
  width: 3.25rem;
  height: 2.625rem;
  min-width: 3.25rem;
  min-height: 2.625rem;
  flex: 0 0 3.25rem;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--text-color, #374151) 88%, transparent);
  transition: background 0.15s ease, transform 0.12s ease;
  overflow: hidden;
}

:deep(.share-inline-btn:hover) {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

:deep(.share-inline-btn:active) {
  transform: scale(0.96);
}

:deep(.cursor-pointer.inline-block) {
  display: inline-flex;
  align-items: stretch;
  width: 3.25rem;
  height: 2.625rem;
  flex: 0 0 3.25rem;
}
</style>
