<script setup lang="ts">
import type { CommunityDetailForeignItem } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  isNativeAppShell,
  openInNativeShell,
  SITE_ORIGIN,
} from '@/utils/nativeShell'

const props = defineProps<{
  items?: CommunityDetailForeignItem[] | null
}>()

const toast = useToast()

/** 与 `CommunityForeign` / `CommunityDetailForeignItem` 的 `pk_type` 对齐 */
const PK_TYPE_LABELS: Record<number, string> = {
  0: '店铺',
  1: '实体店',
  2: '服饰',
  3: '场景',
  4: '搭配清单',
  5: '合集',
  6: '茶会',
  7: '图鉴',
  8: '小工具',
}

const normalizedList = computed(() => {
  const raw = props.items ?? []
  return raw.filter(
    (it) =>
      it &&
      typeof it.pk_type === 'number' &&
      Number.isFinite(it.pk_type) &&
      typeof it.pk_id === 'number' &&
      Number.isFinite(it.pk_id)
  )
})

const count = computed(() => normalizedList.value.length)

function resolveHref(item: CommunityDetailForeignItem): string | null {
  const pk = item.pk_type
  const id = item.pk_id
  if (!Number.isFinite(pk) || !Number.isFinite(id)) return null
  /** 接口可能仅用 `pk_id` 表示店铺 id，也可用 `shop` 嵌套 */
  const shopFromRow = item.shop_id ?? item.shop?.shop_id ?? id
  const libId = item.library_id ?? null
  switch (pk) {
    case 0:
      return Number.isFinite(Number(shopFromRow)) ? `/shop/detail/${Number(shopFromRow)}` : null
    case 1:
      return null
    case 2:
      return `/clothes/detail/${id}`
    case 3:
      return `/scene/detail/${id}`
    case 4:
      return `/matching/detail/${id}`
    case 5:
      return `/compilations/detail/${id}`
    case 6:
      return `/teaparty/detail/${id}`
    case 7: {
      const lid = libId ?? id
      return Number.isFinite(lid) ? `/library/detail/${lid}` : null
    }
    case 8: {
      // 统一进小工具容器（独立项目），由容器上报次数并嵌入 path
      return Number.isFinite(id) ? `/pc/tool/?id=${id}` : null
    }
    default:
      return null
  }
}

function resolveCoverSrc(it: CommunityDetailForeignItem): string {
  const p = it.square_cover || it.cover || it.icon
  const s =
    typeof p === 'string' && p.trim() !== ''
      ? p.startsWith('http')
        ? p
        : `${BASE_IMG}${p}`
      : `${BASE_IMG}static/plan_cover/default.jpg`
  return s
}

function displayTitle(it: CommunityDetailForeignItem): string {
  const t = it.title ?? it.tool_name ?? it.name
  return typeof t === 'string' && t.trim() ? t.trim() : '未命名'
}

function pkTypeLabel(pk: number): string {
  return PK_TYPE_LABELS[pk] ?? `类型${pk}`
}

function pathToAbsoluteSiteUrl(path: string): string {
  return path.startsWith('/') ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}/${path}`
}

async function onRowClick(it: CommunityDetailForeignItem) {
  const href = resolveHref(it)
  if (!href) {
    toast.add({
      title: '暂无对应页面跳转',
      description: pkTypeLabel(it.pk_type) === '实体店' ? '实体店请从地图等入口浏览' : undefined,
      icon: 'i-heroicons-information-circle',
      color: 'amber',
    })
    return
  }

  const isAbsoluteHttp = /^https?:\/\//i.test(href)
  const fullUrl = isAbsoluteHttp ? href : pathToAbsoluteSiteUrl(href)

  // Uni / 鸿蒙 / iOS：外链壳
  if (isNativeAppShell()) {
    openInNativeShell(fullUrl)
    return
  }

  // 浏览器：小工具新开；其它站内 SPA
  if (it.pk_type === 8) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer')
    return
  }
  await navigateTo(href)
}
</script>

<template>
  <div v-if="count > 0" class="mt-4 flex flex-col gap-2 px-1 max-md:px-0">
    <div class="px-1 text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
      关联内容 · {{ count }}
    </div>
    <div class="flex flex-col gap-0.5">
      <button
        v-for="(it, idx) in normalizedList"
        :key="`foreign-${it.pk_type}-${it.pk_id}-${idx}`"
        type="button"
        class="flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/80"
        @click="onRowClick(it)"
      >
        <div class="relative size-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700">
          <img
            :src="resolveCoverSrc(it)"
            alt=""
            class="h-full w-full object-cover"
            draggable="false"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
          <div class="line-clamp-2 text-[13px] font-medium leading-snug text-gray-900 dark:text-gray-100">
            {{ displayTitle(it) }}
          </div>
          <span class="text-[11px] text-qhx-primary/90">{{ pkTypeLabel(it.pk_type) }}</span>
          <p
            v-if="it.shop?.shop_name || it.library_type || it.tool_desc"
            class="line-clamp-1 text-xs text-gray-500 dark:text-gray-400"
          >
            {{
              [it.shop?.shop_name, it.library_type, it.tool_desc].filter(Boolean).join(' · ')
            }}
          </p>
          <p v-if="it.state" class="line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500">{{ it.state }}</p>
        </div>
        <UIcon name="i-heroicons-chevron-right" class="mt-5 h-4 w-4 shrink-0 text-gray-400" />
      </button>
    </div>
  </div>
</template>
