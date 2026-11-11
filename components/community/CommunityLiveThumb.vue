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
    /** 角标是否可点（关则仅展示，不拦截点击） */
    badgeInteractive?: boolean
    /** LIVE 角标位置 */
    badgePosition?: 'top-left' | 'bottom-right'
    /** 覆盖在 img/video 上的 class */
    mediaClass?: string
    /** 默认循环播放（服饰封面） */
    defaultLoop?: boolean
  }>(),
  {
    alt: undefined,
    active: false,
    showBadge: true,
    badgeInteractive: true,
    badgePosition: 'top-left',
    mediaClass: 'h-full w-full object-contain',
    defaultLoop: false,
  },
)

const emit = defineEmits<{
  load: []
  click: [e: MouseEvent]
  /** 循环开关变化（便于外层 toast） */
  'loop-change': [enabled: boolean]
}>()

const { t } = useI18n()
const resolvedAlt = computed(() => props.alt || t('common.brand'))
const videoRef = ref<HTMLVideoElement | null>(null)
const isLive = computed(() => Boolean(props.videoSrc?.trim()))
const toast = useToast()

const {
  loopEnabled,
  videoVisible,
  onEnded,
  onPlaying,
  onBadgePointerDown,
  onBadgePointerMove,
  onBadgePointerUp,
  onBadgePointerCancel,
  onBadgeClick,
} = useCommunityLivePlayback({
  videoRef,
  getSrc: () => props.videoSrc,
  shouldPlay: () => Boolean(props.active && props.videoSrc?.trim()),
  defaultLoop: props.defaultLoop,
  onLoopChange: (enabled) => {
    emit('loop-change', enabled)
    toast.add({
      title: enabled ? t('community.live.loop_on') : t('community.live.loop_off'),
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
      :alt="resolvedAlt"
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
      :src="active ? videoSrc : undefined"
      muted
      playsinline
      webkit-playsinline
      :autoplay="active"
      :loop="defaultLoop"
      :preload="active ? 'auto' : 'none'"
      disablepictureinpicture
      @playing="onPlaying"
      @ended="onEnded"
    />
    <button
      v-if="isLive && showBadge && badgeInteractive"
      type="button"
      class="community-live-thumb__badge absolute z-20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
      :class="[
        badgePosition === 'bottom-right' ? 'bottom-1.5 right-1.5' : 'left-1.5 top-1.5',
        { 'community-live-thumb__badge--loop': loopEnabled },
      ]"
      data-live-badge
      :aria-label="loopEnabled ? t('community.live.replay_loop_off_aria') : t('community.live.replay_loop_on_aria')"
      :title="loopEnabled ? t('community.live.replay_loop_off_title') : t('community.live.replay_loop_on_title')"
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
    <span
      v-else-if="isLive && showBadge"
      class="community-live-thumb__badge pointer-events-none absolute z-20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
      :class="badgePosition === 'bottom-right' ? 'bottom-1.5 right-1.5' : 'left-1.5 top-1.5'"
      aria-hidden="true"
    >
      LIVE
    </span>
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
