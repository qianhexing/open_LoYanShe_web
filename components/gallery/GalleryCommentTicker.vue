<script setup lang="ts">
import type { GalleryCommentTickerItem } from '@/composables/useGalleryWebSocket'
import { formatGalleryTickerText } from '@/composables/useGalleryWebSocket'

defineProps<{
  items: readonly GalleryCommentTickerItem[]
}>()
</script>

<template>
  <Transition name="ticker-fade">
    <div v-if="items.length" class="gallery-comment-ticker">
      <TransitionGroup name="ticker-slide" tag="ul" class="gallery-comment-ticker__list">
        <li
          v-for="item in items"
          :key="item.commentId"
          class="gallery-comment-ticker__item"
          :title="formatGalleryTickerText(item)"
        >
          <span class="gallery-comment-ticker__name">{{ item.userName }}</span>
          <span class="gallery-comment-ticker__hint">在某处留下了讯息</span>
          <span class="gallery-comment-ticker__content">{{ item.contentPlain }}</span>
        </li>
      </TransitionGroup>
    </div>
  </Transition>
</template>

<style scoped>
.gallery-comment-ticker {
  pointer-events: none;
  max-width: min(520px, 72vw);
}

.gallery-comment-ticker__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow: hidden;
}

.gallery-comment-ticker__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 14px;
  background: rgba(10, 8, 14, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: 2px solid rgba(232, 164, 180, 0.55);
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  backdrop-filter: blur(12px) saturate(1.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.gallery-comment-ticker__name {
  flex-shrink: 0;
  color: #e8b4c8;
  font-weight: 600;
}

.gallery-comment-ticker__hint {
  flex-shrink: 0;
}

.gallery-comment-ticker__content {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(255, 255, 255, 0.58);
}

.ticker-fade-enter-active,
.ticker-fade-leave-active {
  transition: opacity 0.25s ease;
}

.ticker-fade-enter-from,
.ticker-fade-leave-to {
  opacity: 0;
}

.ticker-slide-enter-active,
.ticker-slide-leave-active {
  transition: all 0.35s ease;
}

.ticker-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.ticker-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.ticker-slide-leave-active {
  position: absolute;
  width: 100%;
}

.ticker-slide-move {
  transition: transform 0.35s ease;
}

@media (max-width: 767px) {
  .gallery-comment-ticker {
    max-width: min(420px, 88vw);
  }

  .gallery-comment-ticker__item {
    font-size: 11px;
    padding: 6px 12px;
  }
}
</style>
