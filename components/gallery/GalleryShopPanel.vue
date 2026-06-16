<script setup lang="ts">
import type { GalleryShopMarker } from '@/types/gallery'
import { resolveShopLogoUrl } from '@/utils/galleryShopMarker'

const props = defineProps<{
  shop: GalleryShopMarker | null
  nearby: boolean
  videosLoading?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const logoUrl = computed(() =>
  props.shop ? resolveShopLogoUrl(props.shop.shop_logo) : ''
)

const goShopDetail = () => {
  if (!props.shop?.shop_id) return
  window.open(`/shop/detail/${props.shop.shop_id}`, '_blank')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="nearby && !shop" class="gallery-hint">
      <span class="gallery-hint__icon">🏪</span>
      点击店铺标点查看信息
    </div>
  </Transition>

  <Transition name="slide-up">
    <div v-if="shop" class="gallery-shop-panel">
      <button
        class="gallery-shop-panel__close"
        aria-label="关闭"
        @click="emit('close')"
      >
        ✕
      </button>
      <div class="gallery-shop-panel__header">
        <div class="gallery-shop-panel__logo-wrap">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="shop.shop_name"
            class="gallery-shop-panel__logo"
          >
          <span v-else class="gallery-shop-panel__logo-fallback">🛍️</span>
        </div>
        <h2 class="gallery-shop-panel__title">{{ shop.shop_name }}</h2>
      </div>
      <div class="gallery-shop-panel__actions">
        <p v-if="videosLoading" class="gallery-shop-panel__loading-hint">
          正在加载 3D 藏品…
        </p>
        <div class="gallery-shop-panel__actions-row">
          <button
            v-if="shop.shop_id"
            class="gallery-shop-panel__btn gallery-shop-panel__btn--primary"
            @click="goShopDetail"
          >
            进入店铺
          </button>
          <button class="gallery-shop-panel__btn" @click="emit('close')">
            关闭
          </button>
        </div>
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

.gallery-shop-panel {
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
  .gallery-shop-panel {
    bottom: auto;
    top: 50%;
    left: auto;
    right: 24px;
    transform: translateY(-50%);
    border-radius: 20px;
    max-width: 360px;
  }
}

.gallery-shop-panel__close {
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
}

.gallery-shop-panel__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-right: 32px;
}

.gallery-shop-panel__logo-wrap {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #fce4ec, #f8bbd0);
  border: 2px solid rgba(212, 136, 152, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-shop-panel__logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-shop-panel__logo-fallback {
  font-size: 28px;
}

.gallery-shop-panel__title {
  font-size: 20px;
  font-weight: 700;
  color: #d48898;
  margin: 0;
  line-height: 1.3;
}

.gallery-shop-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gallery-shop-panel__loading-hint {
  margin: 0;
  font-size: 13px;
  color: #d48898;
  text-align: center;
}

.gallery-shop-panel__actions-row {
  display: flex;
  gap: 12px;
}

.gallery-shop-panel__btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: 14px;
  cursor: pointer;
}

.gallery-shop-panel__btn--primary {
  background: #d48898;
  border-color: #d48898;
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
