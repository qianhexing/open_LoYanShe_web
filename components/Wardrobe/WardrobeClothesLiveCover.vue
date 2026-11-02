<script setup lang="ts">
/**
 * 衣柜服饰封面：仅 .mp4 当 Live（封面用同名 .jpg）；其它图片格式原样展示。
 */
import { computed } from 'vue'
import CommunityLiveThumb from '@/components/community/CommunityLiveThumb.vue'
import {
  isCommunityLivePath,
  normalizeRawImgPath,
  stripMediaQuery,
  toAbsoluteMediaUrl,
  withOssImageProcess,
} from '@/utils/communityLiveMedia'

const WARDROBE_THUMB_PROCESS = 'image/quality,q_100/resize,w_300'

const props = withDefaults(
  defineProps<{
    clothesImg?: string | null
    imgClass?: string
    loading?: 'lazy' | 'eager'
    /** 列表默认不播；仅详情主封面打开 */
    playLive?: boolean
    /** false：瀑布流按图片自然高度 */
    fill?: boolean
  }>(),
  {
    playLive: false,
    fill: true,
    loading: 'lazy',
    imgClass: 'block h-full w-full object-cover',
  },
)

const emit = defineEmits<{
  load: []
}>()

const rawPath = computed(() => props.clothesImg?.trim() || '')
const isLive = computed(() => isCommunityLivePath(rawPath.value))
const posterSrc = computed(() => {
  if (!rawPath.value) return ''
  return toAbsoluteMediaUrl(withOssImageProcess(rawPath.value, WARDROBE_THUMB_PROCESS))
})
const videoSrc = computed(() => {
  if (!isLive.value) return ''
  return toAbsoluteMediaUrl(stripMediaQuery(normalizeRawImgPath(rawPath.value)))
})
</script>

<template>
  <div
    class="wardrobe-clothes-live-cover"
    :class="fill ? 'absolute inset-0 block h-full w-full' : 'relative block w-full'"
  >
    <CommunityLiveThumb
      v-if="playLive && isLive && videoSrc"
      class="h-full w-full"
      :poster-src="posterSrc"
      :video-src="videoSrc"
      :active="true"
      default-loop
      badge-position="bottom-right"
      :media-class="imgClass"
      @load="emit('load')"
    />
    <template v-else>
      <img
        :src="posterSrc"
        draggable="false"
        :class="imgClass"
        :loading="loading"
        decoding="async"
        @load="emit('load')"
        @contextmenu.prevent
      />
      <span
        v-if="isLive"
        class="wardrobe-clothes-live-badge pointer-events-none absolute bottom-1.5 right-1.5 z-20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        aria-hidden="true"
      >
        LIVE
      </span>
    </template>
  </div>
</template>

<style scoped>
.wardrobe-clothes-live-badge {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  letter-spacing: 0.04em;
  line-height: 1.2;
  border: 1px solid transparent;
}
</style>
