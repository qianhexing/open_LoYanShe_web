<script setup lang="ts">
import type { Library } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatLabel } from '@/utils/public'

const props = defineProps<{
  items: Library[]
  keywords: string[]
}>()

const configStore = useConfigStore()
const config = computed(() => configStore.config)

function buildTagList(item: Library): string[] {
  const tags: string[] = []
  if (item.library_type) tags.push(item.library_type)
  const pushCsv = (raw?: string | null) => {
    if (!raw?.trim()) return
    for (const part of raw.split(',')) {
      const t = part.trim()
      if (t) tags.push(t)
    }
  }
  pushCsv(item.library_pattern)
  pushCsv(item.pattern_elements)
  pushCsv(item.design_elements)
  pushCsv(item.cloth_elements)
  pushCsv(item.secondary_cloth)
  pushCsv(item.season)
  pushCsv(item.color)
  return tags
}

function isTagMatched(tag: string): boolean {
  const lower = tag.toLowerCase()
  return props.keywords.some((kw) => kw && lower.includes(kw.toLowerCase()))
}

function coverUrl(item: Library): string {
  const path = item.square_cover || item.cover
  return `${BASE_IMG}${path}?x-oss-process=image/quality,q_80/resize,w_240,h_240`
}

function openDetail(id: number) {
  window.open(`/library/detail/${id}`, '_blank')
}
</script>

<template>
  <ul v-if="items.length" class="space-y-3">
    <li
      v-for="item in items"
      :key="item.library_id"
      class="search-card group flex gap-3 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm transition hover:border-qhx-primary/35 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/90"
    >
      <button
        type="button"
        class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-700"
        @click="openDetail(item.library_id)"
      >
        <img
          :src="coverUrl(item)"
          :alt="item.name"
          class="h-full w-full object-cover transition group-hover:scale-[1.03]"
          loading="lazy"
        />
      </button>

      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="w-full text-left"
          @click="openDetail(item.library_id)"
        >
          <div class="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              v-if="item.shop_country != null"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="
                item.shop_country === 0
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              "
            >
              {{ formatLabel(item.shop_country, config?.shop_country ?? []) }}
            </span>
            <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {{ item.name }}
            </h3>
          </div>

          <p
            v-if="item.library_price"
            class="mb-2 text-xs font-medium text-qhx-primary"
          >
            ¥ {{ item.library_price }}
          </p>
        </button>

        <div v-if="buildTagList(item).length" class="flex flex-wrap gap-1.5">
          <span
            v-for="(tag, index) in buildTagList(item)"
            :key="`${item.library_id}-${index}`"
            class="rounded-full px-2 py-0.5 text-[10px]"
            :class="
              isTagMatched(tag)
                ? 'bg-qhx-primary/15 text-qhx-primary ring-1 ring-qhx-primary/30'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            "
          >
            {{ tag }}
          </span>
        </div>

        <div
          v-if="item.shop?.shop_name"
          class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
        >
          <img
            v-if="item.shop.shop_logo"
            :src="`${BASE_IMG}${item.shop.shop_logo}?x-oss-process=image/quality,q_80/resize,w_48,h_48`"
            :alt="item.shop.shop_name"
            class="h-5 w-5 rounded-full object-cover"
            loading="lazy"
          />
          <span class="truncate">{{ item.shop.shop_name }}</span>
        </div>
      </div>
    </li>
  </ul>
</template>
