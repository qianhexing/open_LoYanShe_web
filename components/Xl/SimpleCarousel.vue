<script setup lang="ts">
import CommunityLiveThumb from '@/components/community/CommunityLiveThumb.vue'

export type SimpleCarouselImage =
  | string
  | {
      src: string
      videoSrc?: string
      alt?: string
    }

const props = defineProps<{
  images: SimpleCarouselImage[]
}>()

const currentIndex = ref(0)

const slides = computed(() =>
  props.images.map((item) => {
    if (typeof item === 'string') {
      return { src: item, videoSrc: undefined as string | undefined, alt: '' }
    }
    return {
      src: item.src,
      videoSrc: item.videoSrc,
      alt: item.alt ?? '',
    }
  }),
)

const prev = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const next = () => {
  if (currentIndex.value < slides.value.length - 1) currentIndex.value++
}

const handleImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.src = 'https://placehold.co/600x800/e2e8f0/94a3b8?text=Image+Lost'
}
</script>

<template>
  <div class="relative h-full w-full overflow-hidden group bg-gray-100">
    <div
      class="flex h-full w-full transition-transform duration-500 ease-out"
      :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
    >
      <div
        v-for="(slide, index) in slides"
        :key="`${slide.src}-${index}`"
        class="h-full w-full flex-shrink-0"
      >
        <CommunityLiveThumb
          v-if="slide.videoSrc"
          :poster-src="slide.src"
          :video-src="slide.videoSrc"
          :active="index === currentIndex"
          :alt="slide.alt || 'Lo研社'"
          media-class="h-full w-full object-cover select-none"
        />
        <img
          v-else
          :src="slide.src"
          class="pointer-events-none h-full w-full select-none object-cover"
          draggable="false"
          @error="handleImageError"
        />
      </div>
    </div>

    <div class="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
      <div
        v-for="(_, idx) in slides"
        :key="idx"
        class="h-1.5 w-1.5 rounded-full transition-all duration-300"
        :class="currentIndex === idx ? 'w-3 bg-white' : 'bg-white/50'"
      />
    </div>

    <template v-if="slides.length > 1">
      <button
        v-show="currentIndex > 0"
        type="button"
        class="absolute left-3 top-1/2 z-20 -translate-y-1/2 cursor-pointer scale-90 opacity-0 transition-all duration-300 hover:scale-100 active:scale-95 group-hover:opacity-100"
        aria-label="上一张"
        @click.stop="prev"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-full border border-pink-400 bg-pink-500 shadow-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2.5"
            stroke="currentColor"
            class="h-5 w-5 text-white"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </div>
      </button>

      <button
        v-show="currentIndex < slides.length - 1"
        type="button"
        class="absolute right-3 top-1/2 z-20 -translate-y-1/2 cursor-pointer scale-90 opacity-0 transition-all duration-300 hover:scale-100 active:scale-95 group-hover:opacity-100"
        aria-label="下一张"
        @click.stop="next"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-full border border-pink-400 bg-pink-500 shadow-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2.5"
            stroke="currentColor"
            class="h-5 w-5 text-white"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </div>
      </button>
    </template>

    <div
      v-if="slides.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center text-gray-400"
    >
      <span class="text-3xl">🖼️</span>
      <span class="mt-2 text-xs">暂无图片</span>
    </div>
  </div>
</template>
