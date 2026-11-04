<script setup lang="ts">
import type { AvatarFrameItem } from '@/api/avatar_frame'
import { BASE_IMG } from '@/utils/ipConfig'

defineProps<{
  list: AvatarFrameItem[]
  selectedId: number | null
}>()

const emit = defineEmits<{
  choose: [item: AvatarFrameItem | null]
  exchange: [item: AvatarFrameItem]
}>()

function frameSrc(path?: string) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${BASE_IMG}${path.replace(/^\//, '')}`
}

function onChoose(item?: AvatarFrameItem) {
  if (!item) {
    emit('choose', null)
    return
  }
  if (item.disabled) {
    emit('exchange', item)
    return
  }
  emit('choose', item)
}
</script>

<template>
  <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
    <button
      type="button"
      class="flex flex-col items-center rounded-2xl border bg-white p-3 shadow-sm transition dark:bg-gray-800"
      :class="selectedId === 0
        ? 'border-qhx-primary ring-2 ring-qhx-primary/40 bg-pink-50/80 dark:bg-pink-950/30'
        : 'border-transparent hover:border-pink-200'"
      @click="onChoose()"
    >
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-50 to-pink-100 text-sm font-semibold text-gray-400 dark:from-gray-700 dark:to-gray-600"
      >
        无
      </div>
      <span class="mt-2 w-full truncate text-center text-xs font-semibold text-qhx-primary">
        无框
      </span>
    </button>

    <button
      v-for="item in list"
      :key="item.frame_id"
      type="button"
      class="flex flex-col items-center rounded-2xl border bg-white p-3 shadow-sm transition dark:bg-gray-800"
      :class="[
        selectedId === item.frame_id
          ? 'border-qhx-primary ring-2 ring-qhx-primary/40 bg-pink-50/80 dark:bg-pink-950/30'
          : 'border-transparent hover:border-pink-200',
        item.disabled ? 'opacity-60' : '',
      ]"
      @click="onChoose(item)"
    >
      <div
        class="h-16 w-16 overflow-hidden rounded-full"
        :class="item.disabled ? 'grayscale' : ''"
      >
        <img
          :src="frameSrc(item.avatar_frame)"
          :alt="item.frame_name || '头像框'"
          class="h-full w-full object-cover"
          loading="lazy"
        >
      </div>
      <span
        class="mt-2 w-full truncate text-center text-xs font-semibold"
        :class="item.disabled ? 'text-gray-400' : 'text-qhx-primary'"
      >
        {{ item.frame_name || '头像框' }}
      </span>
      <span
        v-if="item.disabled"
        class="mt-0.5 text-[10px] text-gray-400"
      >
        {{ item.is_free ? `${item.is_free} 经验` : '不可用' }}
      </span>
    </button>
  </div>
</template>
