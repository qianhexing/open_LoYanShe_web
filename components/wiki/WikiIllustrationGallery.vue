<script setup lang="ts">
/** 与图鉴详情共用布局偏好：缩略图（九宫格）/ 长图（竖排） */
const ILLUSTRATION_LAYOUT_KEY = 'libraryDetailImageLayout'
type IllustrationLayout = 'thumb' | 'long'

const props = defineProps<{
  /** 配图相对路径（不含域名），逗号拆分后的列表 */
  paths: string[]
}>()

function readIllustrationLayoutPref(): IllustrationLayout {
  if (!import.meta.client || typeof localStorage === 'undefined') return 'thumb'
  return localStorage.getItem(ILLUSTRATION_LAYOUT_KEY) === 'long' ? 'long' : 'thumb'
}

function persistIllustrationLayoutPref(layout: IllustrationLayout) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  localStorage.setItem(ILLUSTRATION_LAYOUT_KEY, layout)
}

const layout = shallowRef<IllustrationLayout>('thumb')
const layoutReady = shallowRef(false)

function setLayout(next: IllustrationLayout) {
  layout.value = next
  persistIllustrationLayoutPref(next)
}

const imageUrls = computed(() =>
  props.paths.map((item) => item.trim()).filter(Boolean),
)

const thumbList = computed(() =>
  imageUrls.value.map((image) => ({
    src: `${image}?x-oss-process=image/quality,q_80/resize,w_300,h_300`,
  })),
)

const longList = computed(() =>
  imageUrls.value.map((image) => ({
    src: `${image}?x-oss-process=image/quality,q_80/resize,w_750`,
  })),
)

const thumbGridClass =
  'wiki-illustration-thumb-grid flex flex-wrap my-2 max-md:grid max-md:grid-cols-3 max-md:gap-2'
const thumbImgClass =
  'cursor-pointer ml-3 w-[100px] h-[100px] aspect-square object-cover object-center rounded-[10px] shadow-lg border border-gray-200 max-md:ml-0 max-md:w-full'
const longImgClass =
  'cursor-pointer w-full h-auto object-contain rounded-[10px] shadow-lg border border-gray-200'

onMounted(() => {
  layout.value = readIllustrationLayoutPref()
  layoutReady.value = true
})
</script>

<template>
  <div v-if="imageUrls.length > 0 && layoutReady" class="mb-6">
    <div class="flex items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-semibold">词条配图</h2>
      <div
        class="wiki-layout-capsule"
        role="group"
        aria-label="配图布局"
      >
        <button
          type="button"
          class="wiki-layout-capsule__btn"
          :class="{ 'wiki-layout-capsule__btn--active': layout === 'thumb' }"
          :aria-pressed="layout === 'thumb'"
          @click="setLayout('thumb')"
        >
          缩略图
        </button>
        <button
          type="button"
          class="wiki-layout-capsule__btn"
          :class="{ 'wiki-layout-capsule__btn--active': layout === 'long' }"
          :aria-pressed="layout === 'long'"
          @click="setLayout('long')"
        >
          长图
        </button>
      </div>
    </div>
    <div v-if="layout === 'long'" class="flex flex-col gap-2">
      <QhxPreviewImage
        :list="longList"
        :preview="imageUrls"
        :className="longImgClass"
      />
    </div>
    <div v-else :class="thumbGridClass">
      <QhxPreviewImage
        :list="thumbList"
        :preview="imageUrls"
        :className="thumbImgClass"
      />
    </div>
  </div>
</template>

<style scoped>
.wiki-illustration-thumb-grid :deep(img) {
  aspect-ratio: 1 / 1;
  object-fit: cover;
  object-position: center;
}

@media (max-width: 767px) {
  .wiki-illustration-thumb-grid :deep(img) {
    display: block;
    width: 100%;
    height: auto;
  }
}

.wiki-layout-capsule {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.18rem;
  border-radius: 9999px;
  border: 1.5px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 40%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 6%, #fff);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 2px 8px rgba(0, 0, 0, 0.05);
}

.dark .wiki-layout-capsule {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 45%, rgba(255, 255, 255, 0.1));
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, rgba(17, 24, 39, 0.72));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 10px rgba(0, 0, 0, 0.28);
}

.wiki-layout-capsule__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.28rem 0.75rem;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 72%, #6b7280);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.14s ease;
}

.wiki-layout-capsule__btn:hover:not(.wiki-layout-capsule__btn--active) {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

.wiki-layout-capsule__btn:active {
  transform: scale(0.97);
}

.wiki-layout-capsule__btn--active {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 90%, #fff) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, #f472b6) 100%
  );
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.38),
    0 2px 8px color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, transparent);
}

.dark .wiki-layout-capsule__btn {
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 70%, #e5e7eb);
}

.dark .wiki-layout-capsule__btn--active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 75%, #831843) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, #4c0519) 100%
  );
  color: #fce7f3;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 2px 10px color-mix(in srgb, var(--primary-color, #ff9eb5) 28%, transparent);
}
</style>
