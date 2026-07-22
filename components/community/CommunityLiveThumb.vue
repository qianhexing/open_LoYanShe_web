<script setup lang="ts">
/**
 * 社区 Live 媒体：默认 jpg 封面 + LIVE 角标；
 * active 时播一次；点角标重播；长按角标切换循环。
 */
import { computed, ref } from 'vue'
import { useCommunityLivePlayback } from '@/composables/useCommunityLivePlayback'

const props = withDefaults(
  defineProps<{
    /** 封面绝对 URL（jpg） */
    posterSrc: string
    /** 视频绝对 URL（mp4）；无则仅静态图 */
    videoSrc?: string
    alt?: string
    /** 为 true 时加载并播放视频 */
    active?: boolean
    showBadge?: boolean
    /** 覆盖在 img/video 上的 class */
    mediaClass?: string
  }>(),
  {
    alt: 'Lo研社',
    active: false,
    showBadge: true,
    mediaClass: 'h-full w-full object-contain',
  },
)

const emit = defineEmits<{
  load: []
  click: [e: MouseEvent]
  /** 循环开关变化（便于外层 toast） */
  'loop-change': [enabled: boolean]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isLive = computed(() => Boolean(props.videoSrc?.trim()))
const toast = useToast()

const {
  loopEnabled,
  videoVisible,
  onEnded,
  onBadgePointerDown,
  onBadgePointerMove,
  onBadgePointerUp,
  onBadgePointerCancel,
  onBadgeClick,
} = useCommunityLivePlayback({
  videoRef,
  getSrc: () => props.videoSrc,
  shouldPlay: () => Boolean(props.active && props.videoSrc?.trim()),
  onLoopChange: (enabled) => {
    emit('loop-change', enabled)
    toast.add({
      title: enabled ? '已开启循环播放' : '已关闭循环，仅播放一次',
      icon: enabled ? 'i-heroicons-arrow-path' : 'i-heroicons-stop',
      color: 'gray',
    })
  },
})

function onRootClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <div
    class="community-live-thumb relative h-full w-full select-none"
    @click="onRootClick"
  >
    <img
      :src="posterSrc"
      :alt="alt"
      :class="mediaClass"
      class="community-live-thumb__poster"
      draggable="false"
      decoding="async"
      @load="emit('load')"
    />
    <video
      v-if="isLive"
      ref="videoRef"
      class="community-live-thumb__video absolute inset-0 h-full w-full"
      :class="[mediaClass, videoVisible ? 'opacity-100' : 'opacity-0']"
      muted
      playsinline
      webkit-playsinline
      preload="none"
      disablepictureinpicture
      @ended="onEnded"
    />
    <button
      v-if="isLive && showBadge"
      type="button"
      class="community-live-thumb__badge absolute left-1.5 top-1.5 z-20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
      :class="{ 'community-live-thumb__badge--loop': loopEnabled }"
      data-live-badge
      :aria-label="loopEnabled ? '重播；长按关闭循环' : '重播；长按开启循环'"
      :title="loopEnabled ? '点击重播 · 长按关闭循环' : '点击重播 · 长按开启循环'"
      @click.stop="onBadgeClick"
      @mousedown.stop="onBadgePointerDown"
      @mousemove.stop="onBadgePointerMove"
      @mouseup.stop="onBadgePointerUp"
      @mouseleave="onBadgePointerCancel"
      @touchstart.stop.prevent="onBadgePointerDown"
      @touchmove.stop.prevent="onBadgePointerMove"
      @touchend.stop.prevent="onBadgePointerUp"
      @touchcancel.stop="onBadgePointerCancel"
      @contextmenu.prevent
      @pointerdown.stop
    >
      LIVE
      <span v-if="loopEnabled" class="ml-0.5 opacity-90" aria-hidden="true">∞</span>
    </button>
  </div>
</template>

<style scoped>
.community-live-thumb__poster {
  -webkit-touch-callout: none;
  user-select: none;
}

.community-live-thumb__video {
  transition: opacity 0.15s ease;
  background: transparent;
}

.community-live-thumb__badge {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  line-height: 1.2;
}

.community-live-thumb__badge--loop {
  background: rgba(199, 107, 152, 0.85);
  border-color: rgba(255, 255, 255, 0.35);
}
</style>
