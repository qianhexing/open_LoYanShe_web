<script lang="ts">
definePageMeta({ name: 'gallery-walkthrough' })
</script>

<script setup lang="ts">
import GalleryJoystick from '@/components/gallery/GalleryJoystick.vue'
import GalleryMinimap from '@/components/gallery/GalleryMinimap.vue'
import GalleryShopPanel from '@/components/gallery/GalleryShopPanel.vue'
import GalleryLibraryPanel from '@/components/gallery/GalleryLibraryPanel.vue'
import { useGalleryWalkthrough } from '@/composables/useGalleryWalkthrough'
import { fetchGalleryConfigById } from '@/utils/fetchGalleryConfig'

const route = useRoute()

const galleryId = computed(() => String(route.params.id ?? ''))

const containerRef = ref<HTMLElement | null>(null)
const configLoading = ref(true)
const configError = ref<string | null>(null)

const {
  loading,
  loadProgress,
  error,
  playerX,
  playerZ,
  cameraYaw,
  isMobile,
  galleryName,
  init,
  dispose,
  setJoystickInput,
  clearJoystickInput,
  nearbyShop,
  selectedShop,
  selectedLibrary,
  selectedLibraryTitle,
  libraryLoading,
  shopVideosLoading,
  config
} = useGalleryWalkthrough()

const closeShopPanel = () => { selectedShop.value = null }
const closeLibraryPanel = () => {
  selectedLibrary.value = null
  selectedLibraryTitle.value = ''
}

useHead({
  title: () => (galleryName.value ? `${galleryName.value} - 云看展` : '云看展 - Lo研社'),
  meta: [{ name: 'description', content: '3D 线上展馆，自由漫步浏览' }]
})

const onJoystickMove = (x: number, y: number) => setJoystickInput(x, y)
const onJoystickEnd = () => clearJoystickInput()

const loadGallery = async (id: string) => {
  configLoading.value = true
  configError.value = null

  try {
    const file = await fetchGalleryConfigById(id)

    if (containerRef.value) {
      await init(containerRef.value, file)
    }
  } catch (e) {
    console.error('展馆配置加载失败:', e)
    configError.value = e instanceof Error ? e.message : '展馆配置加载失败'
  } finally {
    configLoading.value = false
  }
}

onMounted(() => {
  if (galleryId.value) {
    loadGallery(galleryId.value)
  }
})

watch(galleryId, async (newId, oldId) => {
  if (!newId || newId === oldId) return
  dispose()
  await loadGallery(newId)
})

onBeforeUnmount(() => dispose())

const isPageLoading = computed(() => configLoading.value || loading.value)
const pageError = computed(() => configError.value || error.value)
</script>

<template>
  <div class="gallery-page">
    <div ref="containerRef" class="gallery-page__canvas" />

    <div v-if="isPageLoading" class="gallery-page__loading">
      <div class="gallery-page__spinner" />
      <p class="gallery-page__loading-text">
        {{ configLoading ? '加载展馆配置…' : `加载场景中… ${loadProgress}%` }}
      </p>
    </div>

    <div v-if="pageError" class="gallery-page__error">
      <p>{{ pageError }}</p>
    </div>

    <div class="gallery-page__header">
      <h1 class="gallery-page__title">云看展</h1>
      <p class="gallery-page__subtitle">
        {{ galleryName || 'Lo研社数字展馆' }}
      </p>
    </div>

    <div class="gallery-page__hints">
      <template v-if="!isMobile">
        <span>WASD 移动</span>
        <span>·</span>
        <span>左键拖拽旋转视角</span>
        <span>·</span>
        <span>点击店铺标点查看信息</span>
        <span>·</span>
        <span>点击 3D 模型查看图鉴</span>
        <span>·</span>
        <span>滚轮缩放镜头</span>
      </template>
      <template v-else>
        <span>左侧摇杆移动 · 单指滑动旋转 · 双指缩放 · 点击店铺</span>
      </template>
    </div>

    <div class="gallery-page__minimap">
      <GalleryMinimap
        :config="config"
        :player-x="playerX"
        :player-z="playerZ"
        :camera-yaw="cameraYaw"
      />
    </div>

    <div v-if="isMobile" class="gallery-page__joystick">
      <GalleryJoystick @move="onJoystickMove" @end="onJoystickEnd" />
    </div>

    <GalleryShopPanel
      :shop="selectedShop"
      :nearby="!!nearbyShop"
      :videos-loading="shopVideosLoading"
      @close="closeShopPanel"
    />

    <GalleryLibraryPanel
      :library="selectedLibrary"
      :loading="libraryLoading"
      :title="selectedLibraryTitle"
      @close="closeLibraryPanel"
    />
  </div>
</template>

<style scoped>
.gallery-page {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #1a1520;
}

.gallery-page__canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.gallery-page__loading {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(26, 21, 32, 0.92);
  backdrop-filter: blur(8px);
}

.gallery-page__spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(216, 136, 152, 0.2);
  border-top-color: #d48898;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.gallery-page__loading-text {
  margin-top: 16px;
  color: #d48898;
  font-size: 14px;
  letter-spacing: 0.05em;
}

.gallery-page__error {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 21, 32, 0.95);
  color: #ff6b6b;
  font-size: 16px;
}

.gallery-page__header {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
  pointer-events: none;
}

.gallery-page__title {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #d48898, #e8b4c8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.gallery-page__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.gallery-page__hints {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(20, 15, 30, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .gallery-page__hints {
    bottom: 16px;
    font-size: 11px;
    max-width: 90vw;
    white-space: normal;
    text-align: center;
  }
}

.gallery-page__minimap {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 20;
}

.gallery-page__joystick {
  position: absolute;
  bottom: 80px;
  left: 24px;
  z-index: 25;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
