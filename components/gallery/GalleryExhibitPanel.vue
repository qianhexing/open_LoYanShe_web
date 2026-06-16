<script setup lang="ts">
import type { GalleryExhibit } from '@/types/gallery'

defineProps<{
  exhibit: GalleryExhibit | null
  nearby: boolean
}>()

const emit = defineEmits<{
  close: []
  teleport: [exhibit: GalleryExhibit]
}>()
</script>

<template>
  <!-- 靠近提示 -->
  <Transition name="fade">
    <div
      v-if="nearby && !exhibit"
      class="gallery-hint"
    >
      <span class="gallery-hint__icon">👆</span>
      点击展品查看详情
    </div>
  </Transition>

  <!-- 详情面板 -->
  <Transition name="slide-up">
    <div
      v-if="exhibit"
      class="gallery-panel"
    >
      <button
        class="gallery-panel__close"
        aria-label="关闭"
        @click="emit('close')"
      >
        ✕
      </button>
      <h2 class="gallery-panel__title">{{ exhibit.name }}</h2>
      <p
        v-if="exhibit.description"
        class="gallery-panel__desc"
      >
        {{ exhibit.description }}
      </p>
      <div class="gallery-panel__actions">
        <button
          class="gallery-panel__btn gallery-panel__btn--primary"
          @click="emit('teleport', exhibit)"
        >
          传送到展品前
        </button>
        <button
          class="gallery-panel__btn"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.gallery-hint {
  position: fixed;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(20, 15, 30, 0.85);
  border: 1px solid rgba(216, 136, 152, 0.4);
  border-radius: 999px;
  color: #fff;
  font-size: 14px;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.gallery-hint__icon {
  font-size: 18px;
}

.gallery-panel {
  position: fixed;
  z-index: 40;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 24px 32px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
}

@media (min-width: 768px) {
  .gallery-panel {
    bottom: auto;
    top: 50%;
    left: auto;
    right: 24px;
    transform: translateY(-50%);
    border-radius: 20px;
    max-width: 360px;
  }
}

.gallery-panel__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: background 0.15s;
}

.gallery-panel__close:hover {
  background: rgba(0, 0, 0, 0.12);
}

.gallery-panel__title {
  font-size: 20px;
  font-weight: 700;
  color: #d48898;
  margin: 0 32px 12px 0;
}

.gallery-panel__desc {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin: 0 0 20px;
}

.gallery-panel__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.gallery-panel__btn {
  flex: 1;
  min-width: 100px;
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.gallery-panel__btn:hover {
  border-color: #d48898;
  color: #d48898;
}

.gallery-panel__btn--primary {
  background: #d48898;
  border-color: #d48898;
  color: #fff;
}

.gallery-panel__btn--primary:hover {
  background: #c07788;
  border-color: #c07788;
  color: #fff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
    transform: translate(20px, -50%);
    opacity: 0;
  }
}
</style>
