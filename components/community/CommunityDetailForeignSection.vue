<script setup lang="ts">
import type {
  CommunityDetailForeignItem,
  MatchingForeignRelatedItem,
} from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { openInNativeShell } from '@/utils/nativeShell'

const props = withDefaults(
  defineProps<{
    items?: CommunityDetailForeignItem[] | null
    /** 评论等紧凑场景：减小外边距 */
    compact?: boolean
  }>(),
  { compact: false },
)

const { t } = useI18n()
const toast = useToast()

const KIND_LABEL_KEYS: Record<string, string> = {
  clothes: 'community.foreign_label.clothes',
  miniTool: 'community.foreign_label.mini_tool',
  library: 'community.foreign_label.library',
  community: 'community.foreign_label.community',
  wardrobe: 'community.foreign_label.wardrobe',
  shop: 'community.foreign_label.shop',
  wiki: 'community.foreign_label.wiki',
  scene: 'community.foreign_label.scene',
  album: 'community.foreign_label.album',
  matching: 'community.foreign_label.matching',
  physical: 'community.foreign_label.physical_shop',
}

/** 旧 pk_type → kind（无 object / kind 时兜底标签） */
const PK_TYPE_TO_KIND: Record<number, string> = {
  0: 'shop',
  1: 'physical',
  2: 'clothes',
  3: 'scene',
  4: 'matching',
  5: 'compilations',
  6: 'teaparty',
  7: 'library',
  8: 'miniTool',
}

type MatchingIconView = {
  key: string
  name: string
  cover: string
  href: string | null
}

type ForeignRowView = {
  key: string
  href: string | null
  cover: string
  title: string
  kindLabel: string
  subtitle: string
  isMatching: boolean
  matchingIcons: MatchingIconView[]
  raw: CommunityDetailForeignItem
}

function ossSrc(path: string | null | undefined): string | null {
  if (typeof path !== 'string' || !path.trim()) return null
  const p = path.trim()
  return p.startsWith('http') ? p : `${BASE_IMG}${p}`
}

function firstCsvPath(list: string | null | undefined): string | null {
  if (typeof list !== 'string' || !list.trim()) return null
  const first = list.split(',')[0]?.trim()
  return first || null
}

function joinMeta(parts: Array<string | null | undefined | false>): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' · ')
}

function detectKind(it: CommunityDetailForeignItem): string | null {
  if (it.wardrobe_clothes) return 'clothes'
  if (it.mini_tool) return 'miniTool'
  if (it.library) return 'library'
  if (it.community) return 'community'
  if (it.wardrobe) return 'wardrobe'
  if (it.shop) return 'shop'
  if (it.wiki) return 'wiki'
  if (it.sence) return 'scene'
  if (it.album) return 'album'
  if (it.matching_list || (Array.isArray(it.items) && it.items.length > 0)) {
    return 'matching'
  }
  if (typeof it.kind === 'string' && it.kind.trim()) return it.kind.trim()
  if (it.pk_type != null && Number.isFinite(it.pk_type)) {
    return PK_TYPE_TO_KIND[it.pk_type] ?? null
  }
  return null
}

function kindLabelOf(kind: string | null): string {
  if (!kind) return ''
  const key = KIND_LABEL_KEYS[kind]
  if (key) return t(key)
  if (kind === 'compilations') return t('community.foreign_label.compilations')
  if (kind === 'teaparty') return t('community.foreign_label.teaparty')
  return kind
}

function fallbackTitle(it: CommunityDetailForeignItem): string {
  const title = it.title ?? it.tool_name ?? it.name
  return typeof title === 'string' && title.trim() ? title.trim() : t('community.unnamed')
}

function fallbackCover(it: CommunityDetailForeignItem): string {
  return (
    ossSrc(it.square_cover || it.cover || it.icon) ||
    `${BASE_IMG}static/plan_cover/default.jpg`
  )
}

function relatedHref(type: string, id: number): string | null {
  if (!Number.isFinite(id) || id <= 0) return null
  if (type === 'clothes') return `/clothes/detail/${id}`
  if (type === 'library') return `/library/detail/${id}`
  return null
}

/** 优先 items；旧 matching_list 回退 */
function resolveMatchingIcons(it: CommunityDetailForeignItem): MatchingIconView[] {
  const fromItems = Array.isArray(it.items) ? it.items : []
  if (fromItems.length > 0) {
    return fromItems
      .map((entry: MatchingForeignRelatedItem, idx) => {
        const id = Number(entry.id)
        const type = String(entry.type || '')
        const name =
          (typeof entry.name === 'string' && entry.name.trim()) ||
          t('community.unnamed')
        const cover =
          ossSrc(entry.cover) || `${BASE_IMG}static/plan_cover/default.jpg`
        return {
          key: `m-item-${type}-${id || idx}`,
          name,
          cover,
          href: relatedHref(type, id),
        }
      })
      .filter((x) => x.cover)
  }

  const m = it.matching_list
  if (!m) return []

  const icons: MatchingIconView[] = []
  for (const [idx, c] of (m.clothes_list || []).entries()) {
    const raw = c as { clothes_id?: number; clothes_img?: string; name?: string }
    const id = Number(raw.clothes_id) || 0
    const cover =
      ossSrc(raw.clothes_img) || `${BASE_IMG}static/plan_cover/default.jpg`
    icons.push({
      key: `m-clothes-${id || idx}`,
      name:
        (typeof raw.name === 'string' && raw.name.trim()) ||
        t('community.unnamed'),
      cover,
      href: relatedHref('clothes', id),
    })
  }
  for (const [idx, lib] of (m.library_list || []).entries()) {
    const raw = lib as {
      library_id?: number
      square_cover?: string
      cover?: string
      name?: string
    }
    const id = Number(raw.library_id) || 0
    const cover =
      ossSrc(raw.square_cover || raw.cover) ||
      `${BASE_IMG}static/plan_cover/default.jpg`
    icons.push({
      key: `m-library-${id || idx}`,
      name:
        (typeof raw.name === 'string' && raw.name.trim()) ||
        t('community.unnamed'),
      cover,
      href: relatedHref('library', id),
    })
  }
  return icons
}

/** 有对应 object 时读类型字段；否则用顶层 title/cover 兜底。仍保持单行条目。 */
function toRowView(it: CommunityDetailForeignItem, idx: number): ForeignRowView {
  const kind = detectKind(it)
  const href = typeof it.url === 'string' && it.url.trim() ? it.url.trim() : null
  const kindLabel = kindLabelOf(kind)
  const baseTitle = fallbackTitle(it)
  let cover = fallbackCover(it)
  let title = baseTitle
  let subtitle = ''
  const isMatching = kind === 'matching'
  const matchingIcons = isMatching ? resolveMatchingIcons(it) : []

  if (it.wardrobe_clothes) {
    const c = it.wardrobe_clothes
    cover = ossSrc(c.clothes_img || c.real_picture || c.detail_image) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      c.clothes_note?.trim() ||
      c.note?.trim() ||
      baseTitle
    subtitle = joinMeta([c.clothes_part, c.color_text || c.color, c.wardrobe_status, c.size])
  } else if (it.mini_tool) {
    const m = it.mini_tool
    cover = ossSrc(m.icon) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      m.tool_name?.trim() ||
      baseTitle
    subtitle = joinMeta([m.tool_desc])
  } else if (it.library) {
    const lib = it.library as typeof it.library & { square_cover?: string | null }
    cover = ossSrc(lib.square_cover || lib.cover) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      lib.name?.trim() ||
      baseTitle
    subtitle = joinMeta([lib.library_type, lib.shop?.shop_name, lib.state])
  } else if (it.community) {
    const post = it.community
    cover = ossSrc(firstCsvPath(post.small_img_list) || firstCsvPath(post.img_list)) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      post.title?.trim() ||
      baseTitle
    subtitle = joinMeta([post.user?.user_name])
  } else if (it.wardrobe) {
    const w = it.wardrobe
    cover = ossSrc(w.wardrobe_cover || w.background) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      w.wardrobe_name?.trim() ||
      baseTitle
    subtitle = joinMeta([
      w.count_clothes != null ? t('community.foreign_meta.clothes_n', { n: w.count_clothes }) : '',
      w.wardrobe_desc,
    ])
  } else if (it.shop) {
    const s = it.shop
    cover = ossSrc(s.shop_logo) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      s.shop_name?.trim() ||
      baseTitle
    subtitle = joinMeta([s.main_type, s.shop_describe])
  } else if (it.wiki) {
    const w = it.wiki
    cover = ossSrc(w.cover) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      String(w.wiki_name || '').trim() ||
      baseTitle
  } else if (it.sence) {
    const sc = it.sence
    cover = ossSrc(sc.sence_cover) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      sc.sence_desc?.trim() ||
      baseTitle
  } else if (it.album) {
    const a = it.album
    cover = ossSrc(a.album_cover) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      a.album_title?.trim() ||
      baseTitle
    const progress =
      a.count != null && a.count_achieve != null
        ? `${a.count_achieve}/${a.count}`
        : ''
    subtitle = joinMeta([progress, a.album_desc])
  } else if (it.matching_list) {
    const m = it.matching_list
    cover = ossSrc(m.cover) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      m.note?.trim() ||
      baseTitle
  } else if (it.physical_shop) {
    const p = it.physical_shop
    cover = ossSrc(p.physical_logo) || cover
    title =
      (typeof it.title === 'string' && it.title.trim()) ||
      p.physical_name?.trim() ||
      baseTitle
    subtitle = joinMeta([p.city || p.province, p.address || p.area, p.shop?.shop_name])
  } else {
    // 无 object：基础字段兜底
    subtitle = joinMeta([it.tool_desc, it.library_type, it.state])
  }

  // 搭配无关联项时，用主封面 + 标题作为唯一小图标
  const finalMatchingIcons =
    isMatching && matchingIcons.length === 0
      ? [
          {
            key: `m-self-${idx}`,
            name: title,
            cover,
            href,
          },
        ]
      : matchingIcons

  const key = href
    ? `foreign-${href}-${idx}`
    : kind && it.pk_id != null
      ? `foreign-${kind}-${it.pk_id}-${idx}`
      : `foreign-${idx}`

  return {
    key,
    href,
    cover,
    title,
    kindLabel,
    subtitle,
    isMatching,
    matchingIcons: finalMatchingIcons,
    raw: it,
  }
}

const COLLAPSE_LIMIT = 3

const rows = computed(() => {
  const raw = props.items ?? []
  return raw
    .filter((it) => {
      if (!it || typeof it !== 'object') return false
      const hasUrl = typeof it.url === 'string' && it.url.trim() !== ''
      const hasTitle =
        (typeof it.title === 'string' && it.title.trim() !== '') ||
        (typeof it.tool_name === 'string' && it.tool_name.trim() !== '') ||
        (typeof it.name === 'string' && it.name.trim() !== '') ||
        !!it.wardrobe_clothes ||
        !!it.mini_tool ||
        !!it.library ||
        !!it.community ||
        !!it.wardrobe ||
        !!it.shop ||
        !!it.wiki ||
        !!it.sence ||
        !!it.album ||
        !!it.matching_list ||
        !!it.physical_shop ||
        (Array.isArray(it.items) && it.items.length > 0)
      const hasCover =
        (typeof it.cover === 'string' && it.cover.trim() !== '') ||
        (typeof it.square_cover === 'string' && it.square_cover.trim() !== '') ||
        (typeof it.icon === 'string' && it.icon.trim() !== '')
      return hasUrl || hasTitle || hasCover
    })
    .map((it, idx) => toRowView(it, idx))
})

const count = computed(() => rows.value.length)
const canCollapse = computed(() => count.value > COLLAPSE_LIMIT)
const expanded = ref(false)

watch(
  () => props.items,
  () => {
    expanded.value = false
  },
)

const visibleRows = computed(() =>
  canCollapse.value && !expanded.value
    ? rows.value.slice(0, COLLAPSE_LIMIT)
    : rows.value,
)

const hiddenCount = computed(() => Math.max(0, count.value - COLLAPSE_LIMIT))

function isStandaloneOrExternal(href: string): boolean {
  return href.startsWith('/pc/') || /^https?:\/\//i.test(href)
}

function goHref(href: string | null, raw?: CommunityDetailForeignItem) {
  if (!href) {
    toast.add({
      title: t('community.no_page_jump'),
      description:
        raw && (detectKind(raw) === 'physical' || raw.pk_type === 1)
          ? t('community.physical_shop_hint')
          : undefined,
      icon: 'i-heroicons-information-circle',
      color: 'amber',
    })
    return
  }

  if (isStandaloneOrExternal(href)) {
    openInNativeShell(href)
    return
  }

  openInNativeShell(href, {
    inAppNavigate: (path) => {
      void navigateTo(path)
    },
  })
}

function onRowClick(row: ForeignRowView) {
  goHref(row.href, row.raw)
}

function onMatchingIconClick(icon: MatchingIconView) {
  goHref(icon.href)
}
</script>

<template>
  <div
    v-if="count > 0"
    class="flex flex-col gap-0.5 px-1 max-md:px-0"
    :class="compact ? 'mt-2' : 'mt-3'"
  >
    <template v-for="row in visibleRows" :key="row.key">
      <!-- 搭配：一行小图标，上封面下文本，单行省略，横向滚动 -->
      <div
        v-if="row.isMatching"
        class="rounded-lg px-2 py-1.5"
      >
        <div class="mb-1.5 flex min-w-0 items-center gap-1.5 px-0.5">
          <span
            v-if="row.kindLabel"
            class="shrink-0 rounded-full bg-qhx-primary/10 px-2 py-0.5 text-[10px] leading-none text-qhx-primary"
          >
            {{ row.kindLabel }}
          </span>
          <button
            v-if="row.href"
            type="button"
            class="min-w-0 truncate text-left text-[13px] text-gray-900 transition-colors hover:text-qhx-primary dark:text-gray-100"
            @click="onRowClick(row)"
          >
            {{ row.title }}
          </button>
          <span
            v-else
            class="min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100"
          >
            {{ row.title }}
          </span>
        </div>
        <div
          class="foreign-matching-strip -mx-0.5 flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-0.5 pb-0.5"
        >
          <button
            v-for="icon in row.matchingIcons"
            :key="icon.key"
            type="button"
            class="flex w-14 shrink-0 flex-col items-center gap-1 text-center outline-none transition-opacity"
            :class="icon.href ? 'hover:opacity-80 active:opacity-70' : 'cursor-default opacity-80'"
            @click.stop="onMatchingIconClick(icon)"
          >
            <div
              class="size-12 overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700"
            >
              <img
                :src="icon.cover"
                alt=""
                class="h-full w-full object-cover"
                draggable="false"
                loading="lazy"
                decoding="async"
              >
            </div>
            <span
              class="w-full truncate text-[10px] leading-tight text-gray-600 dark:text-gray-300"
            >
              {{ icon.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- 其它类型：通用单行链接 -->
      <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
        :class="
          row.href
            ? 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
            : 'cursor-default opacity-80'
        "
        @click="onRowClick(row)"
      >
        <div
          class="relative size-8 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700"
        >
          <img
            :src="row.cover"
            alt=""
            class="h-full w-full object-cover"
            draggable="false"
            loading="lazy"
            decoding="async"
          >
        </div>
        <div class="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            v-if="row.kindLabel"
            class="shrink-0 rounded-full bg-qhx-primary/10 px-2 py-0.5 text-[10px] leading-none text-qhx-primary"
          >
            {{ row.kindLabel }}
          </span>
          <span class="min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100">
            {{ row.title }}
          </span>
        </div>
        <UIcon
          v-if="row.href"
          name="i-heroicons-chevron-right"
          class="h-3.5 w-3.5 shrink-0 text-gray-400"
        />
      </button>
    </template>

    <button
      v-if="canCollapse"
      type="button"
      class="mx-2 mt-0.5 inline-flex items-center gap-1 self-start rounded-full px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-qhx-primary dark:text-gray-400 dark:hover:bg-gray-800/80 dark:hover:text-qhx-primary"
      @click="expanded = !expanded"
    >
      <span>
        {{
          expanded
            ? t('library.collapse')
            : t('library.expand_more', { count: hiddenCount })
        }}
      </span>
      <UIcon
        :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="h-3.5 w-3.5"
      />
    </button>
  </div>
</template>

<style scoped>
.foreign-matching-strip {
  scrollbar-width: none;
}
.foreign-matching-strip::-webkit-scrollbar {
  display: none;
}
</style>
