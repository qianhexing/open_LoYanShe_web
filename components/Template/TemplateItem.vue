<script setup lang="ts">
import type { TemplateInterface } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  communityBackgroundImageCss,
  parseCommunityCustomStyle,
  type CommunityCustomStyle,
} from '@/utils/communityCustomStyle'

interface Props {
  item: TemplateInterface
  className?: string
  size?: string
  needJump?: boolean
  /** 紧凑模式（主题选择：预览应用后样式） */
  compact?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
  compact: false,
})
const { t } = useI18n()
const item = toRef(props, 'item')
const emit = defineEmits(['choose'])

const stylePreview = computed((): CommunityCustomStyle =>
  parseCommunityCustomStyle(
    item.value.json_data as unknown as Record<string, unknown> | null | undefined,
  ),
)

/** 预览背景图：json_data.background 优先，否则用 cover */
const previewBgPath = computed(() => {
  const fromStyle = stylePreview.value.background?.trim()
  if (fromStyle) return fromStyle
  const cover = item.value.cover?.trim()
  return cover || null
})

function hexToRgba(color: string, opacity: number): string | null {
  const hex = color.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * 与详情页主题一致：背景图完整显示，backColor 以 back_opacity 叠在图上
 */
const previewShellStyle = computed(() => {
  const s = stylePreview.value
  const back = s.backColor || '#f8fafc'
  const opacity = Number.isFinite(s.back_opacity) ? s.back_opacity : 1
  const colorLayer = hexToRgba(back, opacity) || back
  const bgPath = previewBgPath.value
  if (bgPath) {
    return {
      background: `linear-gradient(${colorLayer}, ${colorLayer}), url(${BASE_IMG}${bgPath}) ${communityBackgroundImageCss(s.back_mode)}`,
      backgroundPosition: 'center',
    }
  }
  return {
    background: colorLayer,
  }
})

const previewTitleStyle = computed(() => ({
  color: stylePreview.value.fontColor || '#334155',
}))

const previewBtnStyle = computed(() => {
  const s = stylePreview.value
  return {
    backgroundColor: s.btnColor || '#ec4899',
    color: s.btnFontColor || '#ffffff',
  }
})

const opacityPercent = computed(() =>
  Math.round((Number.isFinite(stylePreview.value.back_opacity) ? stylePreview.value.back_opacity : 1) * 100),
)

const handleClick = (element: TemplateInterface) => {
  emit('choose', element)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <div
      v-if="compact"
      class="w-full overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 cursor-pointer transition-all duration-200 hover:border-pink-300/80 hover:shadow-md active:scale-[0.98]"
      @click="handleClick(item)"
    >
      <div
        class="relative aspect-[4/3] w-full overflow-hidden"
        :style="previewShellStyle"
      >
        <div class="relative z-[1] flex h-full flex-col justify-between p-2.5">
          <div class="flex items-start justify-between gap-1">
            <div class="min-w-0 flex-1">
              <p
                class="truncate text-xs font-semibold leading-tight drop-shadow-sm"
                :style="previewTitleStyle"
              >
                {{ item.title || t('community.style.preview_fallback') }}
              </p>
              <p
                class="mt-0.5 line-clamp-2 text-[10px] leading-snug opacity-80"
                :style="previewTitleStyle"
              >
                {{ t('community.style.preview_body') }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <span
                v-if="previewBgPath"
                class="rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-[1px]"
              >
                {{ t('community.style.preview_bg') }}
              </span>
              <span
                class="rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-white backdrop-blur-[1px]"
              >
                {{ t('community.style.preview_opacity', { percent: opacityPercent }) }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium shadow-sm"
              :style="previewBtnStyle"
            >
              {{ t('community.style.preview_btn') }}
            </span>
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm"
              :style="previewBtnStyle"
              aria-hidden="true"
            >
              +
            </span>
          </div>
        </div>
      </div>
      <div class="px-2 py-1.5">
        <h3 class="truncate text-center text-[11px] font-medium text-gray-800 dark:text-gray-100">
          {{ item.title }}
        </h3>
      </div>
    </div>
    <div v-else>
      <div
        class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white cursor-pointer"
        @click="handleClick(item)"
      >
        <img
          :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
          class="object-cover w-full h-[100px] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy"
        />
      </div>
      <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
        <h3
          class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300"
        >
          {{ item.title }}
        </h3>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
