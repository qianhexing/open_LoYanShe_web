<template>
  <ClientOnly>
    <div class="wardrobe-favorite-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        按喜爱评级表格生成 4K 长图(有点慢，请耐心等待)
      </p>
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          class="neu-share-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-pink-100"
          :disabled="!canGenerate || generating"
          @click="generateAndUpload"
        >
          <span v-if="generating" class="inline-flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
            {{ progressLabel }}
          </span>
          <span v-else>生成评级分享图并上传</span>
        </button>
        <button
          v-if="previewSrc && !generating"
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium text-[#7a5f6f] outline-none ring-1 ring-pink-300/50 transition hover:bg-pink-50/80 active:scale-[0.99] dark:text-pink-200/90 dark:ring-pink-800/60 dark:hover:bg-pink-950/40"
          @click="showSharePreviewModal = true"
        >
          查看分享图
        </button>
      </div>
      <p
        v-if="previewSrc && !generating"
        class="mt-2 text-center text-[11px] text-[#8a6f7d] dark:text-pink-300/80"
      >
        <template v-if="isAppWebView">
          已上传，点「查看分享图」后可用<strong class="font-semibold text-[#9d6080] dark:text-pink-300">保存到相册</strong>按钮，或长按图片保存
        </template>
        <template v-else>
          已上传至服务器，可在弹窗中预览或右键另存
        </template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-red-600 dark:text-red-400">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">评级分享图预览</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showSharePreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            class="share-preview-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1"
          >
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="衣柜评级分享图"
                class="share-preview-modal__img mx-auto h-auto w-full max-w-full object-contain"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="share-preview-modal__footer shrink-0 border-t border-[#dfc9d4] px-3 py-3 dark:border-[#3d2f38]"
          >
            <button
              type="button"
              class="share-save-album-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              :disabled="savingToAlbum"
              @click="savePreviewToAlbum"
            >
              <span
                v-if="savingToAlbum"
                class="inline-flex items-center justify-center gap-2"
              >
                <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
                保存中…
              </span>
              <span v-else>保存到相册</span>
            </button>
          </div>
        </div>
      </div>
    </QhxModal>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { Wardrobe, WardrobeClothes } from '@/types/api'
import { getUserSpace } from '@/api/user'
import { uploadTempFileToOSS } from '@/utils/ossUpload'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  FAVORITE_SHARE_ROW_DEFS,
  groupClothesForFavoriteShare,
} from '@/utils/clothesFavoriteLevel'
import {
  buildShareTheme,
  drawCellBadges,
  drawImageCover,
  drawNeuPhotoFrame,
  drawPageBackground,
  fetchAllClothesForShare,
  layoutWardrobeCompactHeader,
  loadImageCors,
  measureWardrobeCompactHeaderEndY,
  readShareLayoutPrefs,
  resolveImgUrl,
  WARDROBE_SHARE_DEFAULT_AVATAR,
  spx,
  shareFont,
  shareFontSans,
  SHARE_FOOTER_PAD,
  type ShareCanvasTheme,
  type ShareLayoutPrefs,
  WARDROBE_SHARE_CANVAS,
} from '@/utils/wardrobeClothesShareCanvas'

const toast = useToast()

const props = defineProps<{
  wardrobeId: number
  info: Wardrobe
  filterList: { tags: string[]; wardrobe_status: string[]; clothes_note: string; size: string[] }
  password: string
  timelineMode: boolean
  userName?: string
  userFace?: string
  ownerUserId?: number
}>()

const { CW, PAD, MAX_CANVAS_H, PHOTO_RADIUS } = WARDROBE_SHARE_CANVAS

/** 表格左列：评级表头（设计稿尺寸经 4K 缩放） */
const LABEL_COL_W = spx(92)
const TABLE_INNER_PAD = spx(10)
const THUMB = spx(66)
const THUMB_GAP = spx(8)
const MIN_TABLE_ROW_H = spx(76)
const LABEL_STAR_SIZE = spx(11)
const LABEL_STAR_GAP = spx(1)

function contentAreaLeft(): number {
  return PAD + LABEL_COL_W + TABLE_INNER_PAD
}

function contentAreaWidth(): number {
  return CW - PAD - contentAreaLeft()
}

function thumbsPerLine(): number {
  return Math.max(1, Math.floor((contentAreaWidth() + THUMB_GAP) / (THUMB + THUMB_GAP)))
}

interface TableRowLayout {
  defIndex: number
  label: string
  level: number
  items: WardrobeClothes[]
  contentLines: number
  rowH: number
}

function computeTableRowHeight(itemCount: number): number {
  if (itemCount <= 0) return MIN_TABLE_ROW_H
  const perLine = thumbsPerLine()
  const lines = Math.ceil(itemCount / perLine)
  const contentH = lines * THUMB + Math.max(0, lines - 1) * THUMB_GAP + TABLE_INNER_PAD * 2
  return Math.max(MIN_TABLE_ROW_H, contentH)
}

function computeTableRowLayouts(buckets: WardrobeClothes[][]): TableRowLayout[] {
  return FAVORITE_SHARE_ROW_DEFS.map((def, i) => {
    const items = buckets[i] ?? []
    const contentLines = items.length ? Math.ceil(items.length / thumbsPerLine()) : 1
    return {
      defIndex: i,
      label: def.label,
      level: def.level,
      items,
      contentLines,
      rowH: computeTableRowHeight(items.length),
    }
  })
}

function drawLabelStars(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  level: number,
  theme: ShareCanvasTheme
) {
  if (level <= 0) return
  ctx.font = `${LABEL_STAR_SIZE}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const starW = ctx.measureText('★').width
  const totalW = 5 * starW + 4 * LABEL_STAR_GAP
  let sx = cx - totalW / 2 + starW / 2
  for (let s = 1; s <= 5; s++) {
    ctx.fillStyle = s <= level ? '#d97706' : 'rgba(120, 113, 108, 0.45)'
    ctx.fillText('★', sx, y)
    sx += starW + LABEL_STAR_GAP
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawTableLabelCell(
  ctx: CanvasRenderingContext2D,
  y: number,
  rowH: number,
  label: string,
  level: number,
  theme: ShareCanvasTheme
) {
  const x = PAD
  ctx.fillStyle = hexToRgba(theme.primary, 0.08)
  ctx.fillRect(x, y, LABEL_COL_W, rowH)

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(x + 0.5, y + 0.5, LABEL_COL_W - 1, rowH - 1)

  const cx = x + LABEL_COL_W / 2
  const hasStars = level > 0
  const captionY = hasStars ? y + rowH / 2 + spx(10) : y + rowH / 2

  ctx.fillStyle = theme.title
  ctx.font = shareFont(13, 'bold')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, captionY)

  if (hasStars) {
    drawLabelStars(ctx, cx, y + rowH / 2 - spx(12), level, theme)
  }
}

function drawTableContentCell(
  ctx: CanvasRenderingContext2D,
  rowY: number,
  rowH: number,
  items: WardrobeClothes[],
  theme: ShareCanvasTheme,
  prefs: ShareLayoutPrefs,
  imgCache: Map<string, HTMLImageElement | null>
) {
  const contentLeft = PAD + LABEL_COL_W
  const contentWidth = CW - PAD - contentLeft
  const thumbLeft = contentLeft + TABLE_INNER_PAD

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fillRect(contentLeft, rowY, contentWidth, rowH)

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(contentLeft + 0.5, rowY + 0.5, contentWidth - 1, rowH - 1)

  if (!items.length) {
    ctx.fillStyle = theme.textMuted
    ctx.font = shareFontSans(13)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('—', thumbLeft, rowY + rowH / 2)
    return
  }

  const perLine = thumbsPerLine()
  let x = thumbLeft
  let cy = rowY + TABLE_INNER_PAD
  const badgePrefs: ShareLayoutPrefs = { ...prefs, showFavorite: false }

  for (let i = 0; i < items.length; i++) {
    const col = i % perLine
    if (col === 0 && i > 0) {
      x = thumbLeft
      cy += THUMB + THUMB_GAP
    } else if (i > 0) {
      x += THUMB + THUMB_GAP
    }

    const el = items[i]
    const u = resolveImgUrl(el.clothes_img)
    const im = u ? imgCache.get(u) ?? null : null

    if (im) {
      drawImageCover(ctx, im, x, cy, THUMB, THUMB, PHOTO_RADIUS, theme)
    } else {
      drawNeuPhotoFrame(ctx, x, cy, THUMB, THUMB, PHOTO_RADIUS, theme)
      ctx.fillStyle = theme.textMuted
      ctx.font = shareFontSans(11)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('无图', x + THUMB / 2, cy + THUMB / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    drawCellBadges(ctx, x, cy, THUMB, el, badgePrefs, { compact: true })
  }
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  layout: TableRowLayout,
  theme: ShareCanvasTheme,
  prefs: ShareLayoutPrefs,
  imgCache: Map<string, HTMLImageElement | null>
) {
  drawTableLabelCell(ctx, y, layout.rowH, layout.label, layout.level, theme)
  drawTableContentCell(ctx, y, layout.rowH, layout.items, theme, prefs, imgCache)

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.beginPath()
  ctx.moveTo(PAD, y + layout.rowH)
  ctx.lineTo(CW - PAD, y + layout.rowH)
  ctx.stroke()
}

const generating = ref(false)
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()
const progressLabel = ref('')
const errorMsg = ref('')
const serverRelativeUrl = ref('')
const showSharePreviewModal = ref(false)

const canGenerate = computed(() => !!props.wardrobeId && !!props.info?.wardrobe_id)
const isAppWebView = computed(() => isHtml5PlusWebView())

const previewSrc = computed(() => {
  const rel = serverRelativeUrl.value.trim()
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  return `${BASE_IMG}${rel.replace(/^\//, '')}`
})

async function savePreviewToAlbum() {
  const url = previewSrc.value.trim()
  if (!url) {
    toast.add({ title: '没有可保存的图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  try {
    await saveToAlbum(url, { docFilename: `_doc/wardrobe_favorite_${Date.now()}.jpg` })
    toast.add({ title: '已保存到相册', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败，请检查网络、相册权限，或尝试长按图片',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

async function drawFavoriteCanvas(
  info: Wardrobe,
  items: WardrobeClothes[],
  userName: string,
  userFace: string
): Promise<{ canvas: HTMLCanvasElement; drawnCount: number; sourceCount: number }> {
  const theme = buildShareTheme(info)
  const prefs = readShareLayoutPrefs()
  progressLabel.value = '加载封面…'
  const bgUrl = resolveImgUrl(info.background)
  const avatarUrl = resolveImgUrl(userFace || WARDROBE_SHARE_DEFAULT_AVATAR)
  const [bgImg, avatarImg] = await Promise.all([
    bgUrl ? loadImageCors(bgUrl) : Promise.resolve(null),
    loadImageCors(avatarUrl),
  ])

  const measureCv = document.createElement('canvas')
  measureCv.width = CW
  measureCv.height = 1200
  const mctx = measureCv.getContext('2d')
  if (!mctx) throw new Error('canvas')
  const headH = measureWardrobeCompactHeaderEndY(mctx, info, PAD, userName, theme)

  const buckets = groupClothesForFavoriteShare(items)
  const rowItems = buckets.map((b) => [...b])
  let layouts = computeTableRowLayouts(rowItems)

  let bodyH = layouts.reduce((a, s) => a + s.rowH, 0)
  const totalItems = items.length
  let drawnCount = totalItems

  while (headH + bodyH + PAD + SHARE_FOOTER_PAD > MAX_CANVAS_H && drawnCount > 0) {
    let trimmed = false
    for (let i = rowItems.length - 1; i >= 0 && headH + bodyH + PAD + SHARE_FOOTER_PAD > MAX_CANVAS_H; i--) {
      if (rowItems[i].length > 0) {
        rowItems[i] = rowItems[i].slice(0, -1)
        trimmed = true
        drawnCount -= 1
        break
      }
    }
    if (!trimmed) break
    layouts = computeTableRowLayouts(rowItems)
    bodyH = layouts.reduce((a, s) => a + s.rowH, 0)
  }

  if (drawnCount < totalItems) {
    console.warn(
      `[wardrobe-favorite-share] 画布高度上限，仅绘制 ${drawnCount}/${totalItems} 件`
    )
  }

  const H = Math.min(MAX_CANVAS_H, headH + bodyH + PAD + SHARE_FOOTER_PAD)
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')

  drawPageBackground(ctx, CW, H, theme, bgImg)
  progressLabel.value = '加载服饰图片…'

  const tableTop = layoutWardrobeCompactHeader(ctx, info, PAD, avatarImg, userName, 'draw', theme)

  const drawItems = rowItems.flat()
  const urls = [...new Set(drawItems.map((it) => resolveImgUrl(it.clothes_img)).filter(Boolean))]
  const imgCache = new Map<string, HTMLImageElement | null>()
  const chunk = 20
  for (let i = 0; i < urls.length; i += chunk) {
    const part = urls.slice(i, i + chunk)
    await Promise.all(
      part.map(async (u) => {
        if (imgCache.has(u)) return
        imgCache.set(u, await loadImageCors(u))
      })
    )
  }

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(PAD + 0.5, tableTop + 0.5, CW - PAD * 2 - 1, bodyH - 1)
  ctx.beginPath()
  ctx.moveTo(PAD + LABEL_COL_W, tableTop)
  ctx.lineTo(PAD + LABEL_COL_W, tableTop + bodyH)
  ctx.stroke()

  let rowY = tableTop
  for (const layout of layouts) {
    drawTableRow(ctx, rowY, layout, theme, prefs, imgCache)
    rowY += layout.rowH
  }

  ctx.fillStyle = theme.footer
  ctx.font = shareFontSans(13)
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 我的衣柜 · 评级分享', CW / 2, H - spx(20))

  return { canvas, drawnCount, sourceCount: totalItems }
}

watch(
  () => [props.wardrobeId, props.timelineMode, props.info?.wardrobe_id],
  () => {
    serverRelativeUrl.value = ''
    errorMsg.value = ''
  }
)

async function resolveShareUserProfile(): Promise<{ userName: string; userFace: string }> {
  const name = props.userName?.trim()
  const face = props.userFace?.trim()
  if (name) {
    return {
      userName: name,
      userFace: face || WARDROBE_SHARE_DEFAULT_AVATAR,
    }
  }
  const uid = props.ownerUserId ?? props.info.user_id
  if (uid != null && Number.isFinite(Number(uid))) {
    try {
      const u = await getUserSpace({ user_id: Number(uid) })
      return {
        userName: u.user_name?.trim() || '用户',
        userFace: u.user_face?.trim() || WARDROBE_SHARE_DEFAULT_AVATAR,
      }
    } catch {
      /* fallback below */
    }
  }
  return { userName: '用户', userFace: face || WARDROBE_SHARE_DEFAULT_AVATAR }
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value || !canGenerate.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false

  generating.value = true
  progressLabel.value = '拉取服饰列表…'
  try {
    const items = await fetchAllClothesForShare({
      wardrobeId: props.wardrobeId,
      filterList: props.filterList,
      password: props.password,
      timelineMode: props.timelineMode,
    })
    if (!items.length) {
      errorMsg.value = '当前筛选下没有可生成的服饰'
      return
    }
    progressLabel.value = `绘制中（${items.length} 件）…`
    const profile = await resolveShareUserProfile()
    const { canvas, drawnCount, sourceCount } = await drawFavoriteCanvas(
      props.info,
      items,
      profile.userName,
      profile.userFace
    )
    if (drawnCount < sourceCount) {
      toast.add({
        title: `评级图仅包含 ${drawnCount} 件（共 ${sourceCount} 件），超出部分未绘制`,
        color: 'amber',
        icon: 'i-heroicons-information-circle',
      })
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败（可能被跨域图片污染画布，请稍后重试）'
      return
    }
    progressLabel.value = '上传中…'
    const file = new File([blob], `wardrobe-favorite-${Date.now()}.jpg`, { type: 'image/jpeg' })
    const res = await uploadTempFileToOSS(file)
    if (!res?.file_url) {
      errorMsg.value = '上传失败：未返回地址'
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
    progressLabel.value = ''
  } catch (e) {
    console.error(e)
    errorMsg.value = '生成或上传失败，请稍后重试'
  } finally {
    generating.value = false
    progressLabel.value = ''
  }
}
</script>

<style scoped>
.wardrobe-favorite-share {
  background: var(--neu-dent, #e4d9e0);
}

.neu-share-btn {
  background: var(--neu-raised, #ebe3e8);
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -3px -3px 10px rgba(255, 252, 254, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .neu-share-btn {
  --neu-raised: #2e252c;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.4),
    -2px -2px 8px rgba(130, 90, 110, 0.06),
    inset 0 1px 0 rgba(255, 210, 230, 0.05);
}

.share-preview-modal {
  --neu-raised: #ebe3e8;
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px rgba(150, 110, 130, 0.24),
    -8px -8px 22px rgba(255, 252, 254, 0.94),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .share-preview-modal {
  --neu-raised: #241d26;
  background-color: #241d26;
}

.share-preview-modal__head {
  background-color: var(--neu-raised);
  border-bottom: 1px solid #dfc9d4;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d2f38;
}

.share-preview-modal__body {
  background-color: var(--neu-raised);
}

.share-preview-modal__footer {
  background-color: var(--neu-raised);
}

.share-save-album-btn {
  color: #5e3a4b;
  background: var(--neu-raised, #ebe3e8);
  box-shadow:
    3px 3px 8px rgba(150, 110, 130, 0.2),
    -2px -2px 8px rgba(255, 252, 254, 0.85);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-save-album-btn {
  color: #fad6e8;
  --neu-raised: #2e252c;
  border-color: rgba(200, 140, 165, 0.25);
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -1px -1px 6px rgba(130, 90, 110, 0.05);
}

.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}
</style>
