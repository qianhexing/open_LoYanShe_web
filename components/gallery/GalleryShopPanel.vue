<script setup lang="ts">
import QhxModal from '@/components/Qhx/Modal.vue'
import QhxJellyButton from '@/components/Qhx/JellyButton.vue'
import QhxTag from '@/components/Qhx/Tag.vue'
import type { GalleryShopMarker } from '@/types/gallery'
import type { Shop } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { resolveShopLogoUrl } from '@/utils/galleryShopMarker'

const props = defineProps<{
  open: boolean
  shop: GalleryShopMarker | null
  shopDetail: Shop | null
  loading: boolean
  error: string | null
  nearby: boolean
  objectsLoading?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const visible = computed({
  get: () => props.open && !!props.shop,
  set: (value: boolean) => {
    if (!value) emit('close')
  }
})

const displayName = computed(
  () => props.shopDetail?.shop_name ?? props.shop?.shop_name ?? '店铺'
)

const logoUrl = computed(() =>
  resolveShopLogoUrl(props.shopDetail?.shop_logo ?? props.shop?.shop_logo)
)

const descriptionText = computed(() => {
  const raw = props.shopDetail?.shop_describe
  if (!raw?.trim()) return ''
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
})

const statItems = computed(() => {
  if (!props.shopDetail) return []
  return [
    { label: '图鉴', value: props.shopDetail.count_library ?? 0 },
    { label: '点赞', value: props.shopDetail.good_count ?? 0 },
    { label: '收藏', value: props.shopDetail.collect_count ?? 0 }
  ]
})

const styleTags = computed(
  () => props.shopDetail?.style_list?.map(item => item.wiki_name).filter(Boolean) ?? []
)

const typeTags = computed(
  () => props.shopDetail?.type_list?.map(item => item.wiki_name).filter(Boolean) ?? []
)

const masterpieceCovers = computed(() =>
  (props.shopDetail?.masterpiece_list ?? [])
    .filter(item => item.cover)
    .slice(0, 4)
)

const shopId = computed(() => props.shopDetail?.shop_id ?? props.shop?.shop_id ?? 0)

const normalizeExternalUrl = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

const officialLink = computed(() => {
  const raw = props.shopDetail?.shop_url?.trim()
  if (!raw) return null
  return { href: normalizeExternalUrl(raw), label: '淘宝 / 官网' }
})

const socialLink = computed(() => {
  const raw = props.shopDetail?.wb_url?.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const label = lower.includes('xiaohongshu') || lower.includes('xhslink')
    ? '小红书'
    : '微博'
  return { href: normalizeExternalUrl(raw), label }
})

const openExternal = (href: string) => {
  if (!href) return
  window.open(href, '_blank', 'noopener,noreferrer')
}

const goShopDetail = () => {
  if (!shopId.value || shopId.value <= 0) return
  window.open(`/shop/detail/${shopId.value}`, '_blank')
}

const coverUrl = (cover: string) => `${BASE_IMG}${cover}`
</script>

<template>
  <Transition name="fade">
    <div v-if="nearby && !shop" class="gallery-hint">
      <span class="gallery-hint__icon">🏪</span>
      点击店铺标点查看信息
    </div>
  </Transition>

  <QhxModal v-model="visible">
    <div class="shop-modal">
      <div class="shop-modal__glow" aria-hidden="true" />

      <button
        class="shop-modal__close"
        type="button"
        aria-label="关闭"
        @click="emit('close')"
      >
        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
      </button>

      <div class="shop-modal__hero">
        <div class="shop-modal__logo-ring">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="displayName"
            class="shop-modal__logo"
          >
          <span v-else class="shop-modal__logo-fallback">🛍️</span>
        </div>

        <div class="shop-modal__hero-text">
          <p class="shop-modal__eyebrow">云看展 · 合作店铺</p>
          <h2 class="shop-modal__title">{{ displayName }}</h2>
          <p v-if="loading" class="shop-modal__desc shop-modal__desc--loading">
            正在同步店铺资料…
          </p>
          <p v-else-if="error" class="shop-modal__error">{{ error }}</p>
          <p v-else-if="descriptionText" class="shop-modal__desc">
            {{ descriptionText }}
          </p>
        </div>
      </div>

      <div v-if="loading" class="shop-modal__loading">
        <div class="shop-modal__spinner" />
      </div>

      <template v-else>
        <div v-if="statItems.length" class="shop-modal__stats">
          <div
            v-for="item in statItems"
            :key="item.label"
            class="shop-modal__stat"
          >
            <span class="shop-modal__stat-value">{{ item.value }}</span>
            <span class="shop-modal__stat-label">{{ item.label }}</span>
          </div>
        </div>

        <div v-if="styleTags.length || typeTags.length" class="shop-modal__tags">
          <QhxTag
            v-for="tag in styleTags"
            :key="`style-${tag}`"
            :active="true"
            class="shop-modal__tag"
          >
            {{ tag }}
          </QhxTag>
          <QhxTag
            v-for="tag in typeTags"
            :key="`type-${tag}`"
            class="shop-modal__tag shop-modal__tag--muted"
          >
            {{ tag }}
          </QhxTag>
        </div>

        <div v-if="masterpieceCovers.length" class="shop-modal__masterpieces">
          <p class="shop-modal__section-title">代表作品</p>
          <div class="shop-modal__cover-grid">
            <img
              v-for="item in masterpieceCovers"
              :key="item.library_id"
              :src="coverUrl(item.cover!)"
              :alt="item.name"
              class="shop-modal__cover"
            >
          </div>
        </div>

        <div v-if="officialLink || socialLink" class="shop-modal__links">
          <button
            v-if="officialLink"
            type="button"
            class="shop-modal__link-chip"
            @click="openExternal(officialLink.href)"
          >
            <UIcon name="i-heroicons-shopping-bag" class="w-4 h-4" />
            {{ officialLink.label }}
          </button>
          <button
            v-if="socialLink"
            type="button"
            class="shop-modal__link-chip"
            @click="openExternal(socialLink.href)"
          >
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-4 h-4" />
            {{ socialLink.label }}
          </button>
          <span v-if="shopDetail?.wb_name?.trim()" class="shop-modal__wb-name">
            {{ shopDetail.wb_name }}
          </span>
        </div>
      </template>

      <div v-if="objectsLoading" class="shop-modal__objects-loading">
        <span class="shop-modal__objects-dot" />
        正在加载 3D 藏品…
      </div>

      <div class="shop-modal__actions">
        <QhxJellyButton v-if="shopId > 0">
          <button
            type="button"
            class="shop-modal__btn shop-modal__btn--primary"
            @click="goShopDetail"
          >
            进入店铺
          </button>
        </QhxJellyButton>
        <button
          type="button"
          class="shop-modal__btn shop-modal__btn--ghost"
          @click="emit('close')"
        >
          继续逛展
        </button>
      </div>
    </div>
  </QhxModal>
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

.shop-modal {
  position: relative;
  width: min(440px, calc(100vw - 32px));
  max-height: min(86vh, 720px);
  overflow: auto;
  padding: 24px 22px 22px;
  border-radius: 24px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(22, 16, 30, 0.94);
  border: 1px solid rgba(232, 180, 200, 0.22);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
  color: #fff;
}

.shop-modal__glow {
  position: absolute;
  inset: 0 0 auto;
  height: 120px;
  border-radius: 24px 24px 0 0;
  background: radial-gradient(
    ellipse 80% 100% at 50% -20%,
    rgba(212, 136, 152, 0.35),
    transparent 70%
  );
  pointer-events: none;
}

.shop-modal__close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.shop-modal__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.shop-modal__loading {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}

.shop-modal__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(212, 136, 152, 0.2);
  border-top-color: #d48898;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.shop-modal__hero {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
  padding-right: 28px;
}

.shop-modal__logo-ring {
  flex-shrink: 0;
  width: 76px;
  height: 76px;
  padding: 3px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d48898, #e8b4c8, #d48898);
  box-shadow: 0 8px 24px rgba(212, 136, 152, 0.35);
}

.shop-modal__logo {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #2a2030;
}

.shop-modal__logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #2a2030;
  font-size: 30px;
}

.shop-modal__hero-text {
  min-width: 0;
  flex: 1;
}

.shop-modal__eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 180, 200, 0.75);
}

.shop-modal__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  background: linear-gradient(135deg, #fff, #e8b4c8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.shop-modal__error {
  margin: 10px 0 0;
  font-size: 13px;
  color: #ff9a9a;
}

.shop-modal__desc {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.62);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.shop-modal__desc--loading {
  color: rgba(232, 180, 200, 0.75);
  -webkit-line-clamp: unset;
}

.shop-modal__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.shop-modal__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.shop-modal__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #e8b4c8;
}

.shop-modal__stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.shop-modal__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.shop-modal__tag {
  font-size: 12px;
}

.shop-modal__tag--muted {
  opacity: 0.85;
}

.shop-modal__masterpieces {
  margin-bottom: 16px;
}

.shop-modal__section-title {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.shop-modal__cover-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.shop-modal__cover {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.shop-modal__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.shop-modal__link-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgba(212, 136, 152, 0.35);
  border-radius: 999px;
  background: rgba(212, 136, 152, 0.12);
  color: #e8b4c8;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.shop-modal__link-chip:hover {
  background: rgba(212, 136, 152, 0.22);
  border-color: rgba(212, 136, 152, 0.55);
}

.shop-modal__wb-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.shop-modal__objects-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(212, 136, 152, 0.1);
  color: #e8b4c8;
  font-size: 12px;
}

.shop-modal__objects-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d48898;
  animation: pulse 1.2s ease-in-out infinite;
}

.shop-modal__actions {
  display: flex;
  gap: 10px;
}

.shop-modal__btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
}

.shop-modal__btn--primary {
  border: none;
  background: linear-gradient(135deg, #d48898, #c97588);
  color: #fff;
  box-shadow: 0 8px 24px rgba(212, 136, 152, 0.35);
}

.shop-modal__btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(212, 136, 152, 0.45);
}

.shop-modal__btn--ghost {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.72);
}

.shop-modal__btn--ghost:hover {
  background: rgba(255, 255, 255, 0.08);
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@media (max-width: 767px) {
  .shop-modal {
    width: calc(100vw - 24px);
    padding: 20px 18px 18px;
    border-radius: 20px;
  }

  .shop-modal__title {
    font-size: 20px;
  }

  .shop-modal__cover-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
