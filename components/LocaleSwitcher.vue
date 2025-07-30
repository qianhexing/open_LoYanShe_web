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
        class="absolute mt-2 w-32 bg-white rounded-lg shadow-lg border border-pink-200 backdrop-blur-md"
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
const { locale, locales, setLocale } = useI18n()

const languageStore = useLanguageStore()

const open = ref(false)
const wrapper = ref<HTMLElement | null>(null)

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
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
