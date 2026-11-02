<!--
  pk_type=6 3D场景：轮播内仅占位 + 封面；WebGL 由父级 JournalCarouselSceneHost 单例托管。
  点「操作场景」通知父级对齐/显示/加载；滑离当前卡通知 clear。
-->
<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Journal } from '@/types/api'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'
import { journalCarouselSceneHostKey } from '@/components/journal/carousel/sceneHostTypes'
import { BASE_IMG } from '@/utils/ipConfig'

const props = withDefaults(
  defineProps<{
    journal: Journal
    imageParams?: string
    /** 仅当前轮播页参与宿主信令 */
    active?: boolean
  }>(),
  { active: false }
)

const sceneHost = inject(journalCarouselSceneHostKey, null)

const slotRef = ref<HTMLElement | null>(null)

const sceneId = computed(() => props.journal.sence?.sence_id ?? null)

const interactive = computed(() =>
  props.active ? Boolean(sceneHost?.cardInteractive.value) : false
)

const coverSrc = computed(() => {
  const cover = props.journal.sence?.sence_cover
  if (!cover) return null
  return `${BASE_IMG}${cover}${props.imageParams || ''}`
})

async function withSlot(run: (el: HTMLElement, id: number) => void) {
  const id = sceneId.value
  if (id == null || !sceneHost) return
  await nextTick()
  const el = slotRef.value
  if (!el) return
  run(el, id)
}

function onEnter() {
  void withSlot((el, id) => {
    sceneHost?.enter(id, el)
  })
}

function onLeave() {
  const id = sceneId.value
  if (id == null || !sceneHost) return
  sceneHost.leave(id)
}

function onOperateClick() {
  if (!sceneHost || sceneId.value == null || interactive.value) return
  void withSlot((el, id) => {
    sceneHost.interact(id, el)
  })
}

watch(
  () => [props.active, sceneId.value] as const,
  ([on]) => {
    if (on) onEnter()
    else onLeave()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.active) onLeave()
})
</script>

<template>
  <div
    v-if="journal.sence && sceneId != null"
    ref="slotRef"
    class="journal-carousel-type-scene relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-xl"
    data-journal-scene-slot
  >
    <!-- 空白占位：父级 WebGL 叠在此区域上方 -->
    <div
      class="journal-carousel-type-scene__box absolute inset-0"
      aria-hidden="true"
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

    <div
      v-show="!interactive"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center p-2"
    >
      <button
        type="button"
        class="journal-carousel-type-scene__toggle pointer-events-auto rounded-full px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm bg-black/55 text-white hover:bg-black/65"
        @click.stop="onOperateClick"
      >
        操作场景
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

.journal-carousel-type-scene__box {
  background: transparent;
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
