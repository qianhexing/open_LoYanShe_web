<script setup lang="ts">
import type { EventRedblack } from '@/types/api'
import { parseRichText } from '@/utils/public'
import SafeRichText from '@/components/SafeRichText.vue'
import dayjs from 'dayjs'

interface Props {
  list: EventRedblack[]
}

defineProps<Props>()

function attitudeLabel(attitude?: number) {
  if (attitude === 0) return '好评'
  if (attitude === 1) return '差评'
  return '中性'
}

function attitudeColor(attitude?: number) {
  if (attitude === 0) return '#67C23A'
  if (attitude === 1) return '#F56C6C'
  return '#909399'
}

function formatDate(date?: string | Date) {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}
</script>

<template>
  <div v-if="list.length > 0" class="px-4 py-2">
    <div
      v-for="item in list"
      :key="item.event_id"
      class="relative pl-6 pb-6 last:pb-2"
    >
      <div
        class="absolute left-[3px] top-[6px] w-[10px] h-[10px] rounded-full z-10"
        :style="{ background: attitudeColor(item.attitude) }"
      />
      <div
        v-if="item !== list[list.length - 1]"
        class="absolute left-[7px] top-[18px] bottom-0 w-px bg-gray-200 dark:bg-gray-700"
      />

      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span class="font-semibold" :style="{ color: attitudeColor(item.attitude) }">
            {{ attitudeLabel(item.attitude) }}
          </span>
          <span>{{ formatDate(item.create_time) }}</span>
        </div>

        <div v-if="item.user" class="flex items-center gap-2">
          <NuxtLink
            :to="`/userSpace/${item.user.user_id}`"
            class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              v-if="item.user.user_face"
              :src="`${BASE_IMG}${item.user.user_face}`"
              :alt="item.user.user_name || '用户'"
              class="w-[30px] h-[30px] rounded-full object-cover"
              loading="lazy"
            />
            <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ item.user.user_name }}
            </span>
          </NuxtLink>
        </div>

        <p v-if="item.attitude !== 2" class="text-xs text-gray-400">
          仅代表上传用户观点，与平台无关，请勿发布虚假信息
        </p>

        <div
          v-if="item.event_desc"
          class="text-sm text-gray-700 dark:text-gray-300 event-desc"
        >
          <SafeRichText :nodes="parseRichText(item.event_desc)" />
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-center text-gray-500 py-8 text-sm">
    暂无大事记
  </div>
</template>

<style scoped>
.event-desc :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
</style>
