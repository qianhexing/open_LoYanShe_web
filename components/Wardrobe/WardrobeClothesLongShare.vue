<template>
  <ClientOnly>
    <div class="wardrobe-long-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        生成长图（含当前筛选与排序，服饰较多时请稍候）
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
          <span v-else>生成长图并上传</span>
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
          已上传至服务器，可在弹窗中预览或右键另存（过长图若异常可缩小浏览器再试）
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
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">分享图预览</span>
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
                alt="衣柜长图分享"
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
                <UIcon
                  name="i-heroicons-arrow-path"
                  class="h-4 w-4 animate-spin"
                />
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
import { getClothesList, type ClothesParams } from '@/api/wardrobe'
import { uploadImageToTemp } from '@/api/index'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'

const toast = useToast()

const props = defineProps<{
  wardrobeId: number
  info: Wardrobe
  filterList: { tags: string[]; wardrobe_status: string[]; clothes_note: string }
  password: string
  timelineMode: boolean
}>()

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
    await saveToAlbum(url, { docFilename: `_doc/wardrobe_long_${Date.now()}.png` })
    toast.add({
      title: '已保存到相册',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败，请检查网络、相册权限，或尝试长按图片',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const CW = 750
const PAD = 28
/** 头部右上角品牌标识占位，避免标题与文案重叠 */
const HEADER_BRAND_RESERVE = 120
/** 头部左侧封面尺寸 */
const COVER_HEADER = 200
const COVER_HEAD_GAP = 16
/** 单张画布最大高度，避免超出浏览器限制 */
const MAX_CANVAS_H = 16000
const STATUS_FILL: Record<string, string> = {
  待补款: '#f59e0b',
  已拥有: '#10b981',
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function resolveImgUrl(path: string | null | undefined): string {
  if (!path?.trim()) return ''
  const p = path.trim()
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

function loadImageCors(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 与衣柜详情时间轴一致：按入柜时间升序 */
function clothesAddTimeMs(item: WardrobeClothes): number {
  const t = item.add_time
  if (t == null) return 0
  const d = t instanceof Date ? t : new Date(typeof t === 'string' || typeof t === 'number' ? t : String(t))
  const ms = d.getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function sortListByAddTimeAsc(rows: WardrobeClothes[]): WardrobeClothes[] {
  return [...rows].sort((a, b) => clothesAddTimeMs(a) - clothesAddTimeMs(b))
}

async function fetchAllClothesForShare(): Promise<WardrobeClothes[]> {
  const batch = 400
  const all: WardrobeClothes[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY
  while (all.length < totalCount) {
    const params: ClothesParams = {
      page,
      pageSize: batch,
      wardrobe_id: props.wardrobeId,
      filter_list: props.filterList,
    }
    if (props.timelineMode) {
      params.sort_list = 'add_time_asc'
    }
    if (props.password) {
      params.password = props.password
    }
    const res = await getClothesList(params)
    const rows = res.rows ?? []
    totalCount = typeof res.count === 'number' ? res.count : all.length + rows.length
    all.push(...rows)
    if (rows.length < batch || all.length >= totalCount) break
    page += 1
    if (page > 200) break
  }
  if (props.timelineMode && !props.filterList) {
    /* noop */
  }
  if (props.timelineMode) {
    return sortListByAddTimeAsc(all)
  }
  return all
}

watch(
  () => [props.wardrobeId, props.timelineMode, props.info?.wardrobe_id],
  () => {
    serverRelativeUrl.value = ''
    errorMsg.value = ''
  }
)

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const ir = img.width / img.height
  const cr = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (ir > cr) {
    sw = sh * cr
    sx = (img.width - sw) / 2
  } else {
    sh = sw / cr
    sy = (img.height - sh) / 2
  }
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
  ctx.strokeStyle = 'rgba(180, 140, 160, 0.45)'
  ctx.lineWidth = 1
  ctx.save()
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()
  ctx.restore()
}

function headerTextX(showCover: boolean): number {
  return showCover ? PAD + COVER_HEADER + COVER_HEAD_GAP : PAD
}

function headerTextMaxW(showCover: boolean): number {
  return CW - headerTextX(showCover) - PAD - HEADER_BRAND_RESERVE
}

/** 仅在头部右上角绘制 Lo研社 标识 */
function drawHeaderBrandMark(ctx: CanvasRenderingContext2D, top: number) {
  const rx = CW - PAD
  const ty = top + 6
  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(122, 72, 95, 0.38)'
  ctx.font = 'bold 17px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText('Lo研社', rx, ty)
  ctx.fillStyle = 'rgba(122, 72, 95, 0.28)'
  ctx.font = '600 11px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('Lolita图书馆', rx, ty + 22)
  ctx.restore()
}

/**
 * 绘制或度量头部：左侧封面 + 右侧文案；度量时不绘制封面图。
 * @returns 头部底部 y（含分隔线以下留白）
 */
function layoutWardrobeHeader(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  coverImg: HTMLImageElement | null,
  mode: 'draw' | 'measure',
  showCover: boolean
): number {
  const textX = headerTextX(showCover)
  const maxTextW = headerTextMaxW(showCover)
  const top = startY + 20
  let y = top

  if (mode === 'draw') {
    if (showCover && coverImg) {
      drawImageCover(ctx, coverImg, PAD, top, COVER_HEADER, COVER_HEADER, 14)
    }
    drawHeaderBrandMark(ctx, top)
  }

  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 28px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  const titleLines = wrapLines(ctx, info.wardrobe_name || '衣柜', maxTextW)
  for (const line of titleLines.slice(0, 3)) {
    if (mode === 'draw') ctx.fillText(line, textX, y)
    y += 34
  }
  if (titleLines.length > 3) {
    if (mode === 'draw') ctx.fillText('…', textX, y)
    y += 34
  }
  y += 6
  ctx.font = '14px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#6b4f5f'
  if (info.create_date) {
    if (mode === 'draw') ctx.fillText(`创建于 ${dayjs(info.create_date).format('YYYY-MM-DD')}`, textX, y)
    y += 24
  }
  const desc = (info.wardrobe_desc || '').trim()
  if (desc) {
    const dl = wrapLines(ctx, desc, maxTextW)
    for (const line of dl.slice(0, 4)) {
      if (mode === 'draw') ctx.fillText(line, textX, y)
      y += 22
    }
    if (dl.length > 4) {
      if (mode === 'draw') ctx.fillText('…', textX, y)
      y += 22
    }
  }
  y += 4
  ctx.fillStyle = '#5e3a4b'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  if (mode === 'draw') ctx.fillText(`衣柜收纳: ${info.total_count ?? 0} 条`, textX, y)
  y += 26
  const priceShown = info.show_price !== 1 ? '***' : String(info.total_price ?? 0)
  if (mode === 'draw') ctx.fillText(`衣柜总价: ￥${priceShown}`, textX, y)
  y += 26
  if (mode === 'draw') ctx.fillText(`穿着次数: ${info.total_times ?? 0}`, textX, y)
  y += 26
  if (mode === 'draw')
    ctx.fillText(`共有 ${info.total_community ?? 0} 条与小裙子间美好的回忆 (*^▽^*)`, textX, y)
  y += 32

  if (showCover) {
    y = Math.max(y, top + COVER_HEADER + 8)
  }

  ctx.strokeStyle = 'rgba(196, 168, 184, 0.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(CW - PAD, y)
  if (mode === 'draw') ctx.stroke()
  y += 28
  return y
}

function measureHeaderEndY(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  showCover: boolean
): number {
  return layoutWardrobeHeader(ctx, info, startY, null, 'measure', showCover)
}

function cellMetrics(cols: number, gap: number, titleArea: number, priceH: number) {
  const availW = CW - PAD * 2
  const cellW = (availW - gap * (cols - 1)) / cols
  const imgH = Math.round(cellW * 1.5)
  const cellBlock = imgH + titleArea + priceH + gap
  return { cellW, imgH, cellBlock }
}

function pickColsForHeight(itemCount: number, headH: number, gap: number, titleArea: number, priceH: number): number {
  let cols = 3
  while (cols <= 6) {
    const { cellBlock } = cellMetrics(cols, gap, titleArea, priceH)
    const rows = Math.ceil(itemCount / cols) || 1
    const needH = headH + rows * cellBlock + PAD + 56
    if (needH <= MAX_CANVAS_H || cols >= 6) return cols
    cols += 1
  }
  return 6
}

async function drawLongCanvas(
  info: Wardrobe,
  items: WardrobeClothes[]
): Promise<{ canvas: HTMLCanvasElement; drawnCount: number; sourceCount: number }> {
  progressLabel.value = '加载封面…'
  const coverUrl = resolveImgUrl(info.wardrobe_cover)
  const coverImg = coverUrl ? await loadImageCors(coverUrl) : null
  const showCover = Boolean(coverImg)

  const measureCv = document.createElement('canvas')
  measureCv.width = CW
  measureCv.height = 1200
  const mctx = measureCv.getContext('2d')
  if (!mctx) throw new Error('canvas')
  const headH = measureHeaderEndY(mctx, info, PAD, showCover)

  const gap = 12
  const titleArea = 44
  const priceH = 20
  const cols = pickColsForHeight(items.length, headH, gap, titleArea, priceH)
  const { cellW, imgH, cellBlock } = cellMetrics(cols, gap, titleArea, priceH)
  const maxRowsLimit = Math.max(1, Math.floor((MAX_CANVAS_H - headH - PAD - 56) / cellBlock))
  const maxItems = maxRowsLimit * cols
  const drawItems = items.length > maxItems ? items.slice(0, maxItems) : items
  if (drawItems.length < items.length) {
    console.warn(
      `[wardrobe-long-share] 画布高度上限，仅绘制前 ${drawItems.length}/${items.length} 件，可缩小筛选范围后重试`
    )
  }
  const rows = Math.ceil(drawItems.length / cols) || 1
  const H = Math.min(MAX_CANVAS_H, headH + rows * cellBlock + PAD + 56)

  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')

  ctx.fillStyle = '#ebe3e8'
  ctx.fillRect(0, 0, CW, H)

  progressLabel.value = '加载服饰图片…'

  const gridTop = layoutWardrobeHeader(ctx, info, PAD, coverImg, 'draw', showCover)

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

  for (let idx = 0; idx < drawItems.length; idx++) {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = PAD + col * (cellW + gap)
    const y = gridTop + row * cellBlock
    const el = drawItems[idx]
    const u = resolveImgUrl(el.clothes_img)
    const im = u ? imgCache.get(u) ?? null : null

    if (im) {
      drawImageCover(ctx, im, x, y, cellW, imgH, 10)
    } else {
      ctx.fillStyle = '#ddd5dc'
      roundRectPath(ctx, x, y, cellW, imgH, 10)
      ctx.fill()
      ctx.fillStyle = '#8a6f7d'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('无图', x + cellW / 2, y + imgH / 2)
      ctx.textAlign = 'left'
    }

    const st = el.wardrobe_status?.trim()
    if (st) {
      ctx.font = '11px system-ui, sans-serif'
      const tw = ctx.measureText(st).width
      const bw = Math.min(cellW - 4, tw + 14)
      const fill = STATUS_FILL[st] ?? '#9d6080'
      ctx.fillStyle = fill
      roundRectPath(ctx, x, y, bw, 22, 6)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(st, x + 6, y + 15)
    }

    ctx.fillStyle = '#4a2f3d'
    ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    const note = (el.clothes_note || '').trim() || '—'
    const noteLines = wrapLines(ctx, note, cellW - 8).slice(0, 2)
    let ty = y + imgH + 16
    for (const nl of noteLines) {
      ctx.fillText(truncate(nl, 40), x + 4, ty)
      ty += 18
    }

    if (el.price != null && Number(el.price) > 0) {
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillStyle = '#9d4080'
      const pt =
        info.show_price === 2 ? '***' : info.show_price !== 1 ? '***' : String(el.price)
      ctx.fillText(`￥${pt}`, x + 4, y + imgH + titleArea + 6)
    }
  }

  ctx.fillStyle = '#927084'
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 我的衣柜', CW / 2, H - 20)

  return { canvas, drawnCount: drawItems.length, sourceCount: items.length }
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value || !canGenerate.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false

  generating.value = true
  progressLabel.value = '拉取服饰列表…'
  try {
    const items = await fetchAllClothesForShare()
    if (!items.length) {
      errorMsg.value = '当前筛选下没有可生成的服饰'
      return
    }
    progressLabel.value = `绘制中（${items.length} 件）…`
    const { canvas, drawnCount, sourceCount } = await drawLongCanvas(props.info, items)
    if (drawnCount < sourceCount) {
      toast.add({
        title: `长图仅包含前 ${drawnCount} 件（共 ${sourceCount} 件），超出部分未绘制`,
        color: 'amber',
        icon: 'i-heroicons-information-circle',
      })
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.9)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败（可能被跨域图片污染画布，请稍后重试）'
      return
    }
    progressLabel.value = '上传中…'
    const file = new File([blob], `wardrobe-long-${Date.now()}.png`, { type: 'image/png' })
    const res = await uploadImageToTemp(file)
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
.wardrobe-long-share {
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

.share-preview-app-hint {
  background: rgba(214, 170, 190, 0.35);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-preview-app-hint {
  background: rgba(80, 45, 60, 0.45);
  border-color: rgba(200, 140, 165, 0.25);
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

/*
 * Android / iOS WebView：祖先上的 user-select:none（如 select-none）会继承到 img，
 * 导致长按不出现「保存图片」。预览区单独放开选择与系统长按菜单。
 */
.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}
</style>
