<script setup lang="ts">
import QhxModal from '@/components/Qhx/Modal.vue'
import type { CommunityDetailForeignItem } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

// biome-ignore lint/suspicious/noExplicitAny: @dcloudio/uni-webview-js 无类型声明
let uni: any
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

const props = defineProps<{
  items?: CommunityDetailForeignItem[] | null
}>()

const toast = useToast()

/** 站内 H5 路径对应完整 URL（UniApp outerLink2 / 鸿蒙外链用） */
const SITE_ORIGIN = 'https://lolitalibrary.com'

onMounted(async () => {
  uni = await (
    // @ts-expect-error：@dcloudio/uni-webview-js 无声明文件
    import('@dcloudio/uni-webview-js')
  ).catch((err: unknown) => {
    console.error('Failed to load uni-webview-js:', err)
    return undefined
  })
})

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

/** 预览条最多展示的缩略图数量 */
const previewLimit = 10
const previewItems = computed(() => normalizedList.value.slice(0, previewLimit))

const showModal = ref(false)
const triggerPosition = ref({ x: 0, y: 0 })

function openModal(ev?: MouseEvent) {
  if (ev) triggerPosition.value = { x: ev.clientX, y: ev.clientY }
  else if (typeof window !== 'undefined')
    triggerPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  showModal.value = true
}

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
    default:
      return null
  }
}

function resolveCoverSrc(it: CommunityDetailForeignItem): string {
  const p = it.square_cover || it.cover
  const s =
    typeof p === 'string' && p.trim() !== ''
      ? p.startsWith('http')
        ? p
        : `${BASE_IMG}${p}`
      : `${BASE_IMG}static/plan_cover/default.jpg`
  return s
}

function displayTitle(it: CommunityDetailForeignItem): string {
  const t = it.title ?? it.name
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
  showModal.value = false
  await nextTick()

  const fullUrl = pathToAbsoluteSiteUrl(href)
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni?.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?url=${fullUrl}`,
      fail: () => {
        console.warn('UniApp navigateTo outerLink2 失败', fullUrl)
      },
    })
    return
  }

  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: fullUrl },
      }),
    )
    return
  }

  await navigateTo(href)
}
</script>

<template>
  <div v-if="count > 0" class="mt-4 flex flex-col items-center gap-3 px-1 max-md:px-0">
    <button
      type="button"
      class="inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-medium tabular-nums text-gray-500 underline decoration-gray-400/70 underline-offset-2 transition-colors hover:text-qhx-primary hover:decoration-qhx-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary/40 dark:text-gray-400 dark:decoration-gray-600"
      aria-label="查看关联内容完整列表"
      @click="openModal($event)"
    >
      ——关联{{ count }}条内容——
    </button>
    <!-- <div
      class="flex max-w-full gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
      role="presentation"
      aria-hidden="true"
    >
      <div
        v-for="(it, i) in previewItems"
        :key="`${it.pk_type}-${it.pk_id}-${i}`"
        class="shrink-0 w-[72px]"
      >
        <div class="aspect-[3/4] overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700">
          <img
            :src="resolveCoverSrc(it)"
            alt=""
            class="h-full w-full object-cover"
            draggable="false"
            loading="lazy"
          />
        </div>
      </div>
    </div> -->

    <QhxModal v-model="showModal" :trigger-position="triggerPosition">
      <div
        class="flex max-h-[min(90vh,640px)] w-[min(100vw-1.5rem,420px)] flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-qhx-bg-card shadow-2xl dark:border-gray-700"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"
        >
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">关联内容</h3>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="关闭"
            @click="showModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <button
            v-for="(it, idx) in normalizedList"
            :key="`modal-${it.pk_type}-${it.pk_id}-${idx}`"
            type="button"
            class="flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/80"
            @click="onRowClick(it)"
          >
            <div class="relative h-[4.75rem] w-[3.5rem] shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700">
              <img :src="resolveCoverSrc(it)" alt="" class="h-full w-full object-cover" draggable="false" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
              <div class="line-clamp-2 text-[13px] font-medium leading-snug text-gray-900 dark:text-gray-100">
                {{ displayTitle(it) }}
              </div>
              <span class="text-[11px] text-qhx-primary/90">{{ pkTypeLabel(it.pk_type) }}</span>
              <p
                v-if="it.shop?.shop_name || it.library_type"
                class="line-clamp-1 text-xs text-gray-500 dark:text-gray-400"
              >
                {{
                  [it.shop?.shop_name, it.library_type].filter(Boolean).join(' · ')
                }}
              </p>
              <p v-if="it.state" class="line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500">{{ it.state }}</p>
            </div>
            <UIcon name="i-heroicons-chevron-right" class="mt-7 h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </div>
      </div>
    </QhxModal>
  </div>
</template>
