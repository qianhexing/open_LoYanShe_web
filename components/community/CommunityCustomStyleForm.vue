<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      自定义主题
      <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">
        可选 · 背景与配色
      </span>
    </label>

    <button
      type="button"
      class="group w-full flex items-center gap-3 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-700/40 px-4 py-2.5 text-left outline-none transition-all duration-200 hover:border-pink-300/95 dark:hover:border-pink-500/35 hover:bg-white dark:hover:bg-gray-700/90 hover:shadow-md hover:shadow-gray-900/[0.04] dark:hover:shadow-none focus-visible:ring-2 focus-visible:ring-pink-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
      :aria-expanded="expanded"
      :aria-label="`自定义主题：${summaryText}`"
      @click="expanded = !expanded"
    >
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-[1.04]"
        :class="themeUi.iconWrap"
      >
        <UIcon :name="themeUi.icon" class="h-5 w-5" :class="themeUi.iconClass" />
      </div>
      <div class="min-w-0 flex-1 py-0.5">
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug tracking-tight">
          {{ expanded ? '收起主题设置' : summaryTitle }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-1">
          {{ summaryText }}
        </p>
      </div>
      <div
        class="flex shrink-0 items-center justify-center rounded-full p-2 text-gray-400 transition-colors group-hover:text-pink-500 dark:group-hover:text-pink-400"
      >
        <UIcon
          name="i-heroicons-chevron-down"
          class="w-4 h-4 transition-transform duration-200"
          :class="expanded ? 'rotate-180' : 'group-hover:translate-y-[1px]'"
        />
      </div>
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-show="expanded"
        class="mt-3 space-y-5 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-600/80 dark:bg-gray-800/40 md:p-5"
      >
        <!-- 主题模版 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            主题模版
            <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">可选 · 一键带入配色</span>
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-pink-300 hover:text-pink-600 dark:bg-gray-700/50 dark:text-gray-200 dark:hover:border-pink-500/35 dark:hover:text-pink-300"
              @click="showTemplateModal = true"
            >
              <UIcon name="i-heroicons-squares-2x2" class="h-4 w-4" />
              {{ selectedTemplateTitle ?? '选择模版' }}
            </button>
            <button
              v-if="selectedTemplateTitle"
              type="button"
              class="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              @click="clearTemplateSelection"
            >
              清除模版
            </button>
          </div>
        </div>

        <!-- 背景图 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            背景图
            <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">{{ backgroundHint }}</span>
          </label>
          <QhxImagePicker
            ref="backgroundPickerRef"
            :multiple="false"
            @update:files="onBackgroundFiles"
          />
        </div>

        <!-- 背景显示 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">背景显示</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in backModeOptions"
              :key="String(opt.value)"
              type="button"
              class="px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200"
              :class="
                model.back_mode === opt.value
                  ? 'border-pink-400 bg-pink-50 text-pink-700 shadow-sm dark:border-pink-500/50 dark:bg-pink-950/40 dark:text-pink-200'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200 hover:text-pink-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:border-pink-500/35'
              "
              @click="model.back_mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 颜色项 -->
        <div v-for="field in colorFields" :key="field.key">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ field.label }}
            <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">{{ field.hint }}</span>
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <div
              v-if="model[field.key]"
              class="relative inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-1.5 pr-2 py-1.5"
            >
              <div
                class="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 dark:border-gray-700 dark:ring-gray-600"
                :style="{ background: model[field.key]! }"
              />
              <span class="text-xs font-mono text-gray-600 dark:text-gray-300 uppercase max-w-[7rem] truncate">
                {{ model[field.key] }}
              </span>
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                :aria-label="`清除${field.label}`"
                @click="model[field.key] = null"
              >
                <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
              </button>
            </div>
            <span v-else class="text-xs text-gray-400 dark:text-gray-500">未设置</span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-pink-300 hover:text-pink-600 dark:bg-gray-700/50 dark:text-gray-200 dark:hover:border-pink-500/35 dark:hover:text-pink-300"
              @click="showColorPicker(field.key)"
            >
              <UIcon name="i-heroicons-swatch" class="h-4 w-4" />
              {{ model[field.key] ? '更换颜色' : '选择颜色' }}
            </button>
          </div>
        </div>

        <!-- 背景透明度 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            背景透明度
            <span class="text-gray-500 dark:text-gray-400 font-normal text-xs ml-1.5">
              {{ model.back_opacity.toFixed(1) }}
            </span>
          </label>
          <div
            class="flex items-center gap-3 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 px-4 py-3"
          >
            <UIcon name="i-heroicons-eye" class="h-4 w-4 shrink-0 text-gray-400" />
            <input
              v-model.number="model.back_opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              class="custom-style-range flex-1"
            />
            <span
              class="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300"
            >
              {{ Math.round(model.back_opacity * 100) }}%
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <ClientOnly>
      <QhxColorPicker ref="btnColorPickerRef" @choose="(c: string) => (model.btnColor = c)" />
      <QhxColorPicker ref="btnFontColorPickerRef" @choose="(c: string) => (model.btnFontColor = c)" />
      <QhxColorPicker ref="fontColorPickerRef" @choose="(c: string) => (model.fontColor = c)" />
      <QhxColorPicker ref="backColorPickerRef" @choose="(c: string) => (model.backColor = c)" />
    </ClientOnly>

    <QhxModal v-model="showTemplateModal">
      <div
        class="w-[96vw] max-w-lg max-h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/60 dark:border-gray-700/60"
      >
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
        >
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">选择主题模版</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">选择后将自动带入背景与配色</p>
          </div>
          <button
            type="button"
            class="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showTemplateModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto min-h-0 p-4">
          <TemplateList compact :pk-type="templatePkType" @choose="onChooseTemplate" />
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import type { TemplateInterface } from '@/types/api'
import QhxModal from '@/components/Qhx/Modal.vue'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  createDefaultCommunityCustomStyle,
  hasCommunityCustomStyle,
  parseCommunityCustomStyleFromTemplateJsonData,
  type CommunityCustomStyle
} from '@/utils/communityCustomStyle'

const props = withDefaults(
  defineProps<{
    /** 背景图说明文案 */
    backgroundHint?: string
    /** 主题模版 pk_type */
    templatePkType?: number
  }>(),
  {
    backgroundHint: '详情页背景',
    templatePkType: 1,
  }
)

const model = defineModel<CommunityCustomStyle>({ required: true })

const toast = useToast()
const expanded = ref(false)
const showTemplateModal = ref(false)
const selectedTemplateTitle = ref<string | null>(null)
const backgroundPickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const btnColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const btnFontColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const fontColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const backColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)

type ColorKey = 'btnColor' | 'btnFontColor' | 'fontColor' | 'backColor'

const backModeOptions = [
  { label: '平铺背景', value: 'tile' as const },
  { label: '拉伸填充', value: 'cover' as const },
  { label: '完整显示', value: 'contain' as const }
]

const colorFields: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'btnColor', label: '按钮颜色', hint: '互动按钮底色' },
  { key: 'btnFontColor', label: '按钮字体颜色', hint: '按钮文字色' },
  { key: 'fontColor', label: '字体颜色', hint: '正文与标题文字' },
  { key: 'backColor', label: '背景颜色', hint: '背景遮罩或纯色' }
]

const hasConfig = computed(() => hasCommunityCustomStyle(model.value))

const summaryTitle = computed(() =>
  hasConfig.value ? '已配置自定义主题' : '使用默认主题'
)

const summaryText = computed(() => {
  if (selectedTemplateTitle.value) {
    return `模版：${selectedTemplateTitle.value}`
  }
  if (!hasConfig.value) return '点击展开，设置背景图与配色'
  const parts: string[] = []
  if (model.value.background) parts.push('背景图')
  if (model.value.backColor) parts.push('背景色')
  if (model.value.fontColor) parts.push('字体色')
  if (model.value.btnColor) parts.push('按钮色')
  return parts.length ? parts.join(' · ') : '已调整显示参数'
})

const themeUi = computed(() => {
  if (hasConfig.value) {
    return {
      icon: 'i-heroicons-swatch',
      iconWrap:
        'bg-pink-500/[0.11] ring-1 ring-inset ring-pink-500/15 dark:bg-pink-400/10 dark:ring-pink-400/20',
      iconClass: 'text-pink-600 dark:text-pink-300'
    }
  }
  return {
    icon: 'i-heroicons-paint-brush',
    iconWrap:
      'bg-slate-500/[0.09] ring-1 ring-inset ring-slate-400/20 dark:bg-slate-400/10 dark:ring-slate-500/25',
    iconClass: 'text-slate-600 dark:text-slate-300'
  }
})

function showColorPicker(key: ColorKey) {
  const current = model.value[key]
  switch (key) {
    case 'btnColor':
      btnColorPickerRef.value?.showModel(undefined, current)
      break
    case 'btnFontColor':
      btnFontColorPickerRef.value?.showModel(undefined, current)
      break
    case 'fontColor':
      fontColorPickerRef.value?.showModel(undefined, current)
      break
    case 'backColor':
      backColorPickerRef.value?.showModel(undefined, current)
      break
  }
}

function onBackgroundFiles(_files: File[]) {
  // QhxImagePicker 内部维护 previewImages
}

function onChooseTemplate(item: TemplateInterface) {
  try {
    model.value = parseCommunityCustomStyleFromTemplateJsonData(item.json_data)
    selectedTemplateTitle.value = item.title
    expanded.value = true
    showTemplateModal.value = false
    toast.add({
      title: '模版已应用',
      description: item.title,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '模版数据无效'
    toast.add({
      title: '模版加载失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

function clearTemplateSelection() {
  selectedTemplateTitle.value = null
  reset()
}

watch(
  () => model.value.background,
  (path) => {
    nextTick(() => {
      if (path && backgroundPickerRef.value) {
        backgroundPickerRef.value.previewImages = [
          { url: BASE_IMG + path, file: undefined as unknown as File }
        ]
      }
    })
  },
  { immediate: true }
)

function reset() {
  model.value = createDefaultCommunityCustomStyle()
  selectedTemplateTitle.value = null
  expanded.value = false
  nextTick(() => {
    backgroundPickerRef.value?.clear()
  })
}

function getBackgroundPicker() {
  return backgroundPickerRef.value
}

defineExpose({ reset, getBackgroundPicker })
</script>

<style scoped>
.custom-style-range {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(to right, rgb(236 72 153 / 0.25), rgb(236 72 153 / 0.85));
  outline: none;
}

.custom-style-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid white;
  background: rgb(236 72 153);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  cursor: pointer;
}

.custom-style-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid white;
  background: rgb(236 72 153);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  cursor: pointer;
}

:global(.dark) .custom-style-range {
  background: linear-gradient(to right, rgb(236 72 153 / 0.2), rgb(236 72 153 / 0.7));
}
</style>
