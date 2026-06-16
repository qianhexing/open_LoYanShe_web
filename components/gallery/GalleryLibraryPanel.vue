<script setup lang="ts">
import type { Library } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

defineProps<{
  library: Library | null
  loading: boolean
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const coverUrl = (cover?: string | null) =>
  cover ? `${BASE_IMG}${cover}` : ''

const goLibraryDetail = (id?: number) => {
  if (!id) return
  window.open(`/library/detail/${id}`, '_blank')
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="library || loading" class="gallery-library-panel">
      <button
        class="gallery-library-panel__close"
        aria-label="关闭"
        @click="emit('close')"
      >
        ✕
      </button>

      <div v-if="loading" class="gallery-library-panel__loading">
        <div class="gallery-library-panel__spinner" />
        <p>加载图鉴信息…</p>
      </div>

      <template v-else-if="library">
        <div class="gallery-library-panel__header">
          <div class="gallery-library-panel__cover-wrap">
            <img
              v-if="library.cover"
              :src="coverUrl(library.cover)"
              :alt="library.name"
              class="gallery-library-panel__cover"
            >
            <span v-else class="gallery-library-panel__cover-fallback">📚</span>
          </div>
          <div class="gallery-library-panel__meta">
            <h2 class="gallery-library-panel__title">{{ library.name }}</h2>
            <p v-if="title" class="gallery-library-panel__subtitle">{{ title }}</p>
          </div>
        </div>

        <div class="gallery-library-panel__stats">
          <span v-if="library.sale_time">初售 {{ library.sale_time.split(' ')[0] }}</span>
          <span>点赞 {{ library.good_count ?? 0 }}</span>
          <span>收藏 {{ library.collect_count ?? 0 }}</span>
          <span>衣柜 {{ library.wardrobe_count ?? 0 }}</span>
        </div>

        <div class="gallery-library-panel__actions">
          <button
            class="gallery-library-panel__btn gallery-library-panel__btn--primary"
            @click="goLibraryDetail(library.library_id)"
          >
            查看图鉴
          </button>
          <button class="gallery-library-panel__btn" @click="emit('close')">
            关闭
          </button>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.gallery-library-panel {
  position: fixed;
  z-index: 45;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 24px 32px;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
}

@media (min-width: 768px) {
  .gallery-library-panel {
    bottom: auto;
    top: 50%;
    left: 24px;
    right: auto;
    transform: translateY(-50%);
    border-radius: 20px;
    max-width: 360px;
  }
}

.gallery-library-panel__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  cursor: pointer;
  color: #666;
}

.gallery-library-panel__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  color: #d48898;
  font-size: 14px;
}

.gallery-library-panel__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(212, 136, 152, 0.2);
  border-top-color: #d48898;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.gallery-library-panel__header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-right: 32px;
}

.gallery-library-panel__cover-wrap {
  width: 72px;
  height: 96px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #fce4ec;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-library-panel__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-library-panel__cover-fallback {
  font-size: 32px;
}

.gallery-library-panel__title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: #d48898;
  line-height: 1.3;
}

.gallery-library-panel__subtitle {
  margin: 0;
  font-size: 13px;
  color: #888;
}

.gallery-library-panel__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 12px;
  color: #666;
}

.gallery-library-panel__stats span {
  padding: 4px 10px;
  background: #fdf2f5;
  border-radius: 999px;
}

.gallery-library-panel__actions {
  display: flex;
  gap: 12px;
}

.gallery-library-panel__btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: 14px;
  cursor: pointer;
}

.gallery-library-panel__btn--primary {
  background: #d48898;
  border-color: #d48898;
  color: #fff;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (min-width: 768px) {
  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: translate(-20px, -50%);
    opacity: 0;
  }
}
</style>
