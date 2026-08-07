<!--
  pk_type=6 3D场景：当前卡挂载 iframe（from_iframe+from_card）仅初始化灯光；
  点「操作场景」后 postMessage 加载内容；「恢复滑动」不卸载；滑离当前卡卸载。
-->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import { postSceneLoadContent } from '@/utils/sceneIframeBridge'

const props = withDefaults(
  defineProps<{
    journal: Journal
    imageParams?: string
    /** 仅当前轮播页挂载 iframe */
    active?: boolean
  }>(),
  { active: false }
)

/** 是否处于操作场景（露出 iframe） */
const interactive = ref(false)
/** 是否已请求加载场景内容（同卡恢复滑动后保持，避免重复通信） */
const wantContent = ref(false)

const iframeRef = ref<HTMLIFrameElement | null>(null)

const sceneId = computed(() => props.journal.sence?.sence_id ?? null)

const coverSrc = computed(() => {
  const cover = props.journal.sence?.sence_cover
  if (!cover) return null
  return `${BASE_IMG}${cover}${props.imageParams || ''}`
})

/** 当前卡即挂载：仅初始化页面；内容等「操作场景」消息 */
const iframeSrc = computed(() => {
  if (!props.active || sceneId.value == null) return ''
  return `/scene/detail/${sceneId.value}?from_iframe=true&from_card=true`
})

watch(
  () => props.active,
  (on) => {
    if (!on) {
      interactive.value = false
      wantContent.value = false
    }
  }
)

function sendLoadContent() {
  if (!wantContent.value) return
  postSceneLoadContent(iframeRef.value?.contentWindow)
}

function onIframeLoad() {
  sendLoadContent()
}

function toggleInteractive() {
  if (!interactive.value) {
    interactive.value = true
    wantContent.value = true
    sendLoadContent()
    return
  }
  // 恢复滑动：盖回封面，同卡不卸载 iframe
  interactive.value = false
}
</script>

<template>
  <div
    v-if="journal.sence && sceneId != null"
    class="journal-carousel-type-scene relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-xl"
  >
    <iframe
      v-if="iframeSrc"
      ref="iframeRef"
      :key="sceneId"
      :src="iframeSrc"
      class="journal-carousel-type-scene__frame absolute inset-0 h-full w-full border-0 bg-black/5"
      :class="interactive ? 'z-[1]' : 'z-0 opacity-0'"
      :style="{ pointerEvents: interactive ? 'auto' : 'none' }"
      title="3D场景"
      allow="autoplay; fullscreen; xr-spatial-tracking"
      allowfullscreen
      @load="onIframeLoad"
    />

    <!-- 未操作 / 恢复滑动：封面 -->
    <div
      v-show="!interactive"
      class="journal-carousel-type-scene__cover absolute inset-0 z-[1]"
    >
      <img
        v-if="coverSrc"
        :src="coverSrc"
        alt=""
        class="h-full w-full object-cover"
        draggable="false"
      >
      <div
        v-else
        class="journal-carousel-type-scene__placeholder flex h-full w-full items-center justify-center"
      >
        <UIcon name="i-heroicons-cube-transparent" class="h-12 w-12 opacity-35" />
      </div>
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center p-2">
      <button
        type="button"
        class="journal-carousel-type-scene__toggle pointer-events-auto rounded-full px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm"
        :class="
          interactive
            ? 'bg-[var(--seal-red)] text-white'
            : 'bg-black/55 text-white hover:bg-black/65'
        "
        @click.stop="toggleInteractive"
      >
        {{ interactive ? '恢复滑动' : '操作场景' }}
      </button>
    </div>
  </div>
  <TypeInvalid v-else />
</template>

<style scoped>
.journal-carousel-type-scene {
  min-height: 280px;
  background: var(--paper-dent);
}

.journal-carousel-type-scene__placeholder {
  color: var(--ink-faint, #9d8090);
  background:
    linear-gradient(160deg, rgba(184, 92, 72, 0.08) 0%, transparent 55%),
    var(--paper-dent);
}

.journal-carousel-type-scene__toggle {
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
