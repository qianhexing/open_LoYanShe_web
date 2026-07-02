<script setup lang="ts">
import dayjs from 'dayjs'
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import type { RichNode } from '@/utils/public'
import type { AblumForeign } from '@/types/api'
import CommunityItem from '@/components/community/CommunityItem.vue'
import LibraryItem from '@/components/library/LibraryItem.vue'
import { useConfigStore } from '@/stores/config'
import {
  canJumpAlbumForeignRelated,
  openAlbumForeignRelatedContent
} from '@/composables/useLibraryDetailNavigation'

const props = defineProps<{
  title: string
  desc?: string
  foreign: AblumForeign
}>()

const configStore = useConfigStore()

const getImageParams = () => configStore.config?.image_params || ''

const descNodes = computed<RichNode[]>(() => {
  if (!props.desc) return []
  try {
    return parseRichText(props.desc)
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
})

const formatDate = (date: string | Date | undefined): string => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const hasRelatedContent = computed(
  () => !!(props.foreign.pk_type && props.foreign.pk_id)
)

const canJumpRelated = computed(() =>
  canJumpAlbumForeignRelated(props.foreign.pk_type, props.foreign)
)

function onRelatedClick(event: MouseEvent | KeyboardEvent) {
  if (!canJumpRelated.value) return
  const target = event.target as HTMLElement
  const currentTarget = event.currentTarget as HTMLElement
  const interactive = target.closest('button, a, [role="button"]')
  if (interactive && interactive !== currentTarget) return
  openAlbumForeignRelatedContent(props.foreign.pk_type, props.foreign)
}
</script>

<template>
  <div class="w-full max-w-md space-y-3 text-left">
    <div>
      <h2 class="text-base font-semibold text-gray-900">{{ title }}</h2>
      <SafeRichText
        v-if="descNodes.length"
        :nodes="descNodes"
        class="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600"
      />
    </div>

    <p v-if="foreign.create_time" class="text-xs text-gray-400">
      达成时间：{{ formatDate(foreign.create_time) }}
    </p>

    <div v-if="hasRelatedContent" class="space-y-2">
      <p class="text-sm font-medium text-gray-700">关联内容</p>
      <div
        class="rounded-xl border border-gray-100 bg-white p-3 shadow-sm ring-1 ring-gray-100"
        :class="canJumpRelated ? 'cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100/80' : ''"
        :role="canJumpRelated ? 'button' : undefined"
        :tabindex="canJumpRelated ? 0 : undefined"
        @click="onRelatedClick"
        @keydown.enter="onRelatedClick"
      >
        <template v-if="foreign.pk_type === 1">
          <CommunityItem
            v-if="foreign.community"
            :item="foreign.community"
            size="big"
            :need-jump="false"
            class="!m-0 !shadow-none border-0 pointer-events-none"
          />
          <p v-else class="text-sm text-amber-600">关联帖子已失效</p>
        </template>

        <template v-else-if="foreign.pk_type === 2">
          <div v-if="foreign.wardrobe_clothes" class="flex gap-3">
            <div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200">
              <img
                :src="`${BASE_IMG}${foreign.wardrobe_clothes.clothes_img || ''}${getImageParams()}`"
                :alt="foreign.wardrobe_clothes.clothes_note"
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900">
                {{ foreign.wardrobe_clothes.clothes_note || '暂无笔记' }}
              </p>
              <p
                v-if="foreign.wardrobe_clothes.wardrobe_status"
                class="mt-0.5 text-xs text-gray-500"
              >
                状态：{{ foreign.wardrobe_clothes.wardrobe_status }}
              </p>
              <p v-if="foreign.wardrobe_clothes.clothes_part" class="text-xs text-gray-500">
                部位：{{ foreign.wardrobe_clothes.clothes_part }}
              </p>
            </div>
          </div>
          <p v-else class="text-sm text-amber-600">关联服饰已失效</p>
        </template>

        <template v-else-if="foreign.pk_type === 3">
          <div v-if="foreign.matching_list" class="flex gap-3">
            <div
              v-if="foreign.matching_list.cover"
              class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200"
            >
              <img
                :src="`${BASE_IMG}${foreign.matching_list.cover}${getImageParams()}`"
                :alt="foreign.matching_list.note || '搭配'"
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900">
                {{ foreign.matching_list.note || '未命名搭配' }}
              </p>
              <p v-if="foreign.matching_list.main_style" class="mt-0.5 text-xs text-gray-500">
                风格：{{ foreign.matching_list.main_style }}
              </p>
            </div>
          </div>
          <p v-else class="text-sm text-amber-600">关联搭配已失效</p>
        </template>

        <template v-else-if="foreign.pk_type === 4">
          <LibraryItem
            v-if="foreign.library"
            :need-jump="false"
            size="mini-list"
            :item="foreign.library"
            class="pointer-events-none"
          />
          <p v-else class="text-sm text-amber-600">关联图鉴已失效</p>
        </template>
      </div>
      <p v-if="canJumpRelated" class="text-[11px] text-gray-400">点击查看详情</p>
    </div>

    <div v-if="foreign.note" class="space-y-2">
      <p class="text-sm font-medium text-gray-700">笔记</p>
      <div class="rounded-xl bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
        {{ foreign.note }}
      </div>
    </div>
  </div>
</template>
