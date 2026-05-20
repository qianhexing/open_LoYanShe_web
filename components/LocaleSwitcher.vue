<template>
  <div class="relative inline-block text-left z-50" ref="wrapper">
    <button
      @click="open = !open"
      class="text-sm font-semibold text-qhx-primary rounded-full border border-qhx-primary
             shadow-md px-3 py-1 transition duration-300 whitespace-nowrap"
    >
      {{ currentLocale.name }}
    </button>
    <transition name="fade">
      <div
        v-if="open"
        :class="[panelPositionClass, placementMotionClass]"
        class="absolute left-0 z-10 w-32 rounded-lg border border-pink-200 bg-white shadow-lg backdrop-blur-md max-h-[min(12rem,calc(100dvh-6rem))] overflow-y-auto"
      >
        <ul class="py-1 text-sm text-gray-700">
          <li
            v-for="l in locales"
            :key="l.code"
            @click="changeLocale(l.code)"
            class="px-4 py-2 hover:bg-pink-100 hover:text-pink-700 cursor-pointer transition-all"
          >
            {{ l.name }}
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 下拉相对按钮的方向：抽屉底部等场景用 above，避免超出视口底部 */
    placement?: 'below' | 'above'
  }>(),
  { placement: 'below' }
)

const { locale, locales, setLocale } = useI18n()

const languageStore = useLanguageStore()

const open = ref(false)
const wrapper = ref<HTMLElement | null>(null)

const panelPositionClass = computed(() =>
  props.placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
)

/** 与 placement 绑定的类名，避免用 CSS 变量做 transform 插值导致关闭动画发涩 */
const placementMotionClass = computed(() =>
  props.placement === 'above' ? 'locale-panel-motion-above' : 'locale-panel-motion-below'
)

const currentLocale = computed(() =>
  locales.value.find((l: any) => l.code === locale.value) || { name: locale.value }
)
const changeLocale = async (lang: 'zh' | 'en' | 'ja') => {
  await setLocale(lang)
  languageStore.setLocale(lang) // 保存到 pinia + localStorage
  open.value = false
}
// 监听点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  if (wrapper.value && !wrapper.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fade-enter-active {
  transition:
    opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-leave-active {
  pointer-events: none;
  transition:
    opacity 0.14s cubic-bezier(0.4, 0, 1, 1),
    transform 0.14s cubic-bezier(0.4, 0, 1, 1);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.locale-panel-motion-below.fade-enter-from,
.locale-panel-motion-below.fade-leave-to {
  opacity: 0;
  transform: translate3d(0, -6px, 0);
}

.locale-panel-motion-above.fade-enter-from,
.locale-panel-motion-above.fade-leave-to {
  opacity: 0;
  transform: translate3d(0, 6px, 0);
}
</style>
