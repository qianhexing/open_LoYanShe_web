<template>
  <div class="container mx-auto min-h-screen p-4">
    <!-- 顶部控制栏 -->
    <div class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg overflow-x-auto">
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-sm font-bold text-gray-700 whitespace-nowrap">选择日期:</span>
        <QhxDatePicker v-model="picked" @change="onChange" />
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <div class="text-sm text-gray-600 whitespace-nowrap">
          <span class="font-bold">{{ formattedDate }}</span> 未开始茶会:
          <span class="text-primary-600 font-bold">{{ list.length }}</span>
          (共 {{ chunks.length }} 组，每组 {{ ITEMS_PER_CHUNK }} 个)
        </div>

        <UButton
          :loading="isDownloading"
          color="primary"
          icon="i-heroicons-arrow-down-tray"
          class="whitespace-nowrap"
          @click="handleDownloadAll"
        >
          批量下载所有截图 (Canvas重绘)
        </UButton>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
    </div>

    <!-- 内容展示区 -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20 max-w-[1920px] mx-auto">
      <div
        v-for="(chunk, chunkIndex) in chunks"
        :key="chunkIndex"
        :ref="(el) => setChunkRef(el, chunkIndex)"
        class="bg-white shadow-xl overflow-hidden relative group"
      >
        <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton size="xs" color="gray" icon="i-heroicons-camera" @click="downloadChunk(chunkIndex)">
            下载此图
          </UButton>
        </div>

        <div class="w-full aspect-[3/5] bg-white">
          <div class="w-full h-full grid grid-cols-2 grid-rows-2">
            <div
              v-for="(item, itemIndex) in chunk"
              :key="item.tea_id ?? itemIndex"
              class="relative w-full h-full overflow-hidden"
            >
              <img
                :src="getImageUrl(item.tea_cover)"
                class="w-full h-full object-cover block"
                loading="lazy"
                crossorigin="anonymous"
              />

              <div class="absolute bottom-3 left-0 w-full flex flex-col items-center justify-end pointer-events-none px-2">
                <div class="bg-white/90 backdrop-blur-sm px-3 py-2.5 rounded-md flex flex-col items-center justify-center w-full max-w-[calc(100%-4px)] min-w-0 shadow-sm text-center overflow-hidden">
                  <div class="text-lg font-bold text-black leading-snug text-center line-clamp-2 break-all mb-1 w-full">
                    {{ item.tea_title }}
                  </div>

                  <div
                    v-if="getTeapartySnapshotTimeLines(item).startLine"
                    class="text-sm font-medium text-red-600 leading-tight w-full"
                  >
                    {{ getTeapartySnapshotTimeLines(item).startLine }}
                  </div>
                  <div
                    v-if="getTeapartySnapshotTimeLines(item).endLine"
                    class="text-sm font-medium text-red-600 leading-tight mb-1 w-full"
                  >
                    {{ getTeapartySnapshotTimeLines(item).endLine }}
                  </div>

                  <div
                    v-if="getTeapartyStateLabel(item.state)"
                    class="text-[13px] font-medium text-amber-700 leading-tight mb-0.5 w-full"
                  >
                    {{ getTeapartyStateLabel(item.state) }}
                  </div>

                  <div
                    v-if="formatTeapartyPrice(item.price, item.join_way)"
                    class="text-[13px] font-medium text-red-600 leading-tight mb-0.5 w-full"
                  >
                    票价 {{ formatTeapartyPrice(item.price, item.join_way) }}
                  </div>

                  <div
                    v-if="item.mian_style"
                    class="text-[13px] font-medium text-gray-700 leading-tight mb-0.5 line-clamp-1 w-full"
                  >
                    风格 {{ item.mian_style }}
                  </div>

                  <div
                    v-if="item.tea_desc"
                    class="text-[13px] font-normal text-gray-600 leading-tight mb-0.5 line-clamp-2 w-full"
                  >
                    {{ item.tea_desc }}
                  </div>

                  <div
                    v-if="formatTeapartyFullAddress(item)"
                    class="text-[13px] font-medium text-gray-700 leading-tight mb-0.5 line-clamp-2 w-full"
                  >
                    {{ formatTeapartyFullAddress(item) }}
                  </div>

                  <div
                    v-if="item.organizer"
                    class="text-[13px] font-medium text-gray-800 leading-tight mb-0.5 line-clamp-1 w-full"
                  >
                    主办 {{ item.organizer }}
                  </div>

                  <div class="flex items-center gap-1.5 justify-center w-full">
                    <img
                      v-if="item.user?.user_face"
                      :src="getImageUrl(item.user.user_face)"
                      class="w-6 h-6 rounded-full object-cover bg-white shadow-sm flex-shrink-0"
                      crossorigin="anonymous"
                    />
                    <span
                      v-if="item.user?.user_name"
                      class="text-[13px] font-medium text-gray-800 truncate max-w-[140px]"
                    >
                      {{ item.user.user_name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-for="n in (ITEMS_PER_CHUNK - chunk.length)"
              :key="`empty-${n}`"
              class="bg-gray-50 flex items-center justify-center"
            >
              <UIcon name="i-heroicons-photo" class="text-gray-200 text-4xl" />
            </div>
          </div>
        </div>

        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">
          {{ formattedDate }} 未开始 - P{{ chunkIndex + 1 }}
        </div>
      </div>
    </div>

    <div v-if="!loading && list.length === 0" class="text-center py-20 text-gray-500">
      该日期暂无未开始的茶会
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { getTeapartyList } from '@/api/teapart'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  formatTeapartyPrice,
  formatTeapartyFullAddress,
  getTeapartyStateLabel,
  getTeapartySnapshotTimeLines,
  isTeapartyNotStarted,
  isTeapartyOnDate
} from '@/utils/teaparty'
import type { Teaparty } from '@/types/api'

definePageMeta({
  name: 'teaparty-snapshot'
})

useHead({
  title: '茶会生图 - 未开始',
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})

const ITEMS_PER_CHUNK = 4
const GRID_COLS = 2
const GRID_ROWS = 2

const picked = ref<Date>(new Date())
const list = ref<Teaparty[]>([])
const loading = ref(false)
const isDownloading = ref(false)
const chunkRefs = ref<(HTMLElement | null)[]>([])

const setChunkRef = (el: unknown, index: number) => {
  chunkRefs.value[index] = el as HTMLElement | null
}

const formattedDate = computed(() => dayjs(picked.value).format('YYYY-MM-DD'))

const chunks = computed(() => {
  const result: Teaparty[][] = []
  for (let i = 0; i < list.value.length; i += ITEMS_PER_CHUNK) {
    result.push(list.value.slice(i, i + ITEMS_PER_CHUNK))
  }
  return result
})

watch(chunks, () => {
  chunkRefs.value = []
})

const getImageUrl = (path?: string | null) => {
  if (!path) return `${BASE_IMG}static/plan_cover/default.jpg`
  return `${BASE_IMG}${path}`
}

const fetchData = async () => {
  loading.value = true
  list.value = []
  try {
    const res = await getTeapartyList({
      page: 1,
      pageSize: 999,
      time: formattedDate.value
    })
    const rows = res.rows ?? []
    const notStarted = rows.filter((item) => isTeapartyNotStarted(item.state))
    const dateMatched = notStarted.filter((item) => isTeapartyOnDate(item.start_time, picked.value))
    list.value = dateMatched.length > 0 ? dateMatched : notStarted
  } catch (error) {
    console.error('Failed to fetch teaparty list:', error)
    useToast().add({ title: '获取茶会数据失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

const downloadChunk = async (index: number) => {
  const chunkData = chunks.value[index]
  if (!chunkData) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = 1080
  const height = 1800
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const cellWidth = width / GRID_COLS
  const cellHeight = height / GRID_ROWS

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  const wrapTextByWidth = (text: string, maxWidth: number, font: string, maxLines = 3): string[] => {
    if (!text) return []
    ctx.font = font
    if (ctx.measureText(text).width <= maxWidth) return [text]

    const lines: string[] = []
    let currentLine = ''
    for (const char of text) {
      const testLine = currentLine + char
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = char
        if (lines.length >= maxLines - 1) break
      }
    }
    if (currentLine) {
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = truncateTextByWidth(lines[maxLines - 1] + currentLine, maxWidth, font)
      } else {
        lines.push(currentLine)
      }
    }
    return lines.slice(0, maxLines)
  }

  const measureLinesWidth = (lines: string[], font: string): number => {
    if (lines.length === 0) return 0
    ctx.font = font
    return Math.max(...lines.map((line) => ctx.measureText(line).width))
  }

  const truncateTextByWidth = (text: string, maxWidth: number, font: string): string => {
    if (!text) return ''
    ctx.font = font
    if (ctx.measureText(text).width <= maxWidth) return text
    const ellipsis = '…'
    let result = ''
    for (const char of text) {
      const test = result + char + ellipsis
      if (ctx.measureText(test).width > maxWidth) break
      result += char
    }
    return result ? result + ellipsis : ellipsis
  }

  const roundedRect = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) => {
    c.beginPath()
    c.moveTo(x + radius, y)
    c.lineTo(x + w - radius, y)
    c.quadraticCurveTo(x + w, y, x + w, y + radius)
    c.lineTo(x + w, y + h - radius)
    c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    c.lineTo(x + radius, y + h)
    c.quadraticCurveTo(x, y + h, x, y + h - radius)
    c.lineTo(x, y + radius)
    c.quadraticCurveTo(x, y, x + radius, y)
    c.closePath()
  }

  const drawTextBlock = (
    lines: string[],
    font: string,
    color: string,
    centerX: number,
    startY: number,
    lineHeight: number,
    gap: number
  ) => {
    ctx.fillStyle = color
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let y = startY
    for (const line of lines) {
      if (!line) continue
      ctx.fillText(line, centerX, y)
      y += lineHeight + gap
    }
    return y - gap
  }

  for (let i = 0; i < chunkData.length; i++) {
    const item = chunkData[i]
    const row = Math.floor(i / GRID_COLS)
    const col = i % GRID_COLS
    const x = col * cellWidth
    const y = row * cellHeight

    try {
      const coverUrl = getImageUrl(item.tea_cover)
      const img = await loadImage(coverUrl)

      let sWidth = img.width
      let sHeight = img.height
      let sx = 0
      let sy = 0

      const imgAspect = sWidth / sHeight
      const cellAspect = cellWidth / cellHeight

      if (imgAspect > cellAspect) {
        const newWidth = sHeight * cellAspect
        sx = (sWidth - newWidth) / 2
        sWidth = newWidth
      } else {
        const newHeight = sWidth / cellAspect
        sy = (sHeight - newHeight) / 2
        sHeight = newHeight
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, cellWidth, cellHeight)
    } catch {
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(x, y, cellWidth, cellHeight)
    }

    const paddingX = 20
    const paddingY = 14
    const logoSize = 28
    const fontSizeTitle = 30
    const fontSizeTime = 22
    const fontSizeMeta = 18
    const fontSizeDesc = 17
    const fontSizeHost = 17
    const gap = 5

    ctx.save()

    const { startLine, endLine } = getTeapartySnapshotTimeLines(item)
    const stateText = getTeapartyStateLabel(item.state)
    const priceText = formatTeapartyPrice(item.price, item.join_way)
    const styleText = item.mian_style ? `风格 ${item.mian_style}` : ''
    const descText = item.tea_desc || ''
    const addressText = formatTeapartyFullAddress(item)
    const organizerText = item.organizer ? `主办 ${item.organizer}` : ''
    const hostName = item.user?.user_name || ''
    const hasHostLogo = !!item.user?.user_face

    const maxBoxWidth = cellWidth - 24
    const contentMaxWidth = maxBoxWidth - paddingX * 2
    const centerX = x + cellWidth / 2

    const titleFont = `bold ${fontSizeTitle}px sans-serif`
    const timeFont = `${fontSizeTime}px sans-serif`
    const metaFont = `${fontSizeMeta}px sans-serif`
    const descFont = `${fontSizeDesc}px sans-serif`
    const hostFont = `${fontSizeHost}px sans-serif`

    const titleLines = wrapTextByWidth(item.tea_title || '', contentMaxWidth, titleFont, 2)
    const descLines = wrapTextByWidth(descText, contentMaxWidth, descFont, 2)
    const addressLines = wrapTextByWidth(addressText, contentMaxWidth, metaFont, 2)
    const styleDisplay = truncateTextByWidth(styleText, contentMaxWidth, metaFont)

    ctx.font = metaFont
    const stateWidth = stateText ? ctx.measureText(stateText).width : 0
    const priceWidth = priceText ? ctx.measureText(`票价 ${priceText}`).width : 0
    const styleWidth = styleDisplay ? ctx.measureText(styleDisplay).width : 0
    const organizerWidth = organizerText ? ctx.measureText(organizerText).width : 0

    ctx.font = timeFont
    const startWidth = startLine ? ctx.measureText(startLine).width : 0
    const endWidth = endLine ? ctx.measureText(endLine).width : 0

    const hostLogoWidth = hasHostLogo ? logoSize + 6 : 0
    const hostNameDisplay = truncateTextByWidth(hostName, Math.max(contentMaxWidth - hostLogoWidth, 0), hostFont)
    ctx.font = hostFont
    const hostContentWidth = hostLogoWidth + (hostNameDisplay ? ctx.measureText(hostNameDisplay).width : 0)

    const maxContentWidth = Math.max(
      measureLinesWidth(titleLines, titleFont),
      startWidth,
      endWidth,
      stateWidth,
      priceWidth,
      styleWidth,
      measureLinesWidth(descLines, descFont),
      measureLinesWidth(addressLines, metaFont),
      organizerWidth,
      hostContentWidth
    )

    const titleBlockHeight = titleLines.length > 0
      ? titleLines.length * fontSizeTitle + (titleLines.length - 1) * gap
      : 0
    const timeBlockHeight = (startLine ? fontSizeTime + gap : 0) + (endLine ? fontSizeTime + gap : 0)
    const stateBlockHeight = stateText ? fontSizeMeta + gap : 0
    const priceBlockHeight = priceText ? fontSizeMeta + gap : 0
    const styleBlockHeight = styleDisplay ? fontSizeMeta + gap : 0
    const descBlockHeight = descLines.length > 0
      ? descLines.length * fontSizeDesc + (descLines.length - 1) * gap
      : 0
    const addressBlockHeight = addressLines.length > 0
      ? addressLines.length * fontSizeMeta + (addressLines.length - 1) * gap
      : 0
    const organizerBlockHeight = organizerText ? fontSizeMeta + gap : 0
    const hostBlockHeight = (hostNameDisplay || hasHostLogo) ? Math.max(logoSize, fontSizeHost) + gap : 0

    const boxWidth = Math.min(maxContentWidth + paddingX * 2, maxBoxWidth)
    const boxHeight = paddingY * 2 + titleBlockHeight + timeBlockHeight + stateBlockHeight
      + priceBlockHeight + styleBlockHeight + descBlockHeight + addressBlockHeight
      + organizerBlockHeight + hostBlockHeight

    const boxX = x + (cellWidth - boxWidth) / 2
    const boxY = y + cellHeight - boxHeight - 16

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 8)
    ctx.fill()

    let currentY = boxY + paddingY

    currentY = drawTextBlock(titleLines, titleFont, '#000000', centerX, currentY, fontSizeTitle, gap) + gap

    if (startLine) {
      currentY = drawTextBlock([startLine], timeFont, '#dc2626', centerX, currentY, fontSizeTime, gap) + gap
    }
    if (endLine) {
      currentY = drawTextBlock([endLine], timeFont, '#dc2626', centerX, currentY, fontSizeTime, gap) + gap
    }
    if (stateText) {
      currentY = drawTextBlock([stateText], metaFont, '#b45309', centerX, currentY, fontSizeMeta, gap) + gap
    }
    if (priceText) {
      currentY = drawTextBlock([`票价 ${priceText}`], metaFont, '#dc2626', centerX, currentY, fontSizeMeta, gap) + gap
    }
    if (styleDisplay) {
      currentY = drawTextBlock([styleDisplay], metaFont, '#374151', centerX, currentY, fontSizeMeta, gap) + gap
    }
    if (descLines.length > 0) {
      currentY = drawTextBlock(descLines, descFont, '#4b5563', centerX, currentY, fontSizeDesc, gap) + gap
    }
    if (addressLines.length > 0) {
      currentY = drawTextBlock(addressLines, metaFont, '#374151', centerX, currentY, fontSizeMeta, gap) + gap
    }
    if (organizerText) {
      currentY = drawTextBlock([organizerText], metaFont, '#1f2937', centerX, currentY, fontSizeMeta, gap) + gap
    }

    const hostStartX = centerX - hostContentWidth / 2
    if (hasHostLogo && item.user?.user_face) {
      try {
        const logoUrl = getImageUrl(item.user.user_face)
        const logoImg = await loadImage(logoUrl)
        const logoY = currentY + (Math.max(logoSize, fontSizeHost) - logoSize) / 2

        ctx.save()
        ctx.beginPath()
        ctx.arc(hostStartX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(logoImg, hostStartX, logoY, logoSize, logoSize)
        ctx.restore()
      } catch {
        // ignore
      }
    }

    if (hostNameDisplay) {
      ctx.fillStyle = '#1f2937'
      ctx.font = hostFont
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(
        hostNameDisplay,
        hostStartX + hostLogoWidth,
        currentY + (Math.max(logoSize, fontSizeHost) - fontSizeHost) / 2
      )
    }

    ctx.restore()
  }

  const link = document.createElement('a')
  link.download = `茶会未开始_${formattedDate.value}_${index + 1}.jpg`
  link.href = canvas.toDataURL('image/jpeg', 0.92)
  link.click()
}

const handleDownloadAll = async () => {
  if (chunks.value.length === 0) return
  isDownloading.value = true

  const toast = useToast()
  toast.add({ title: '开始批量绘制并下载...', color: 'blue' })

  try {
    for (let i = 0; i < chunks.value.length; i++) {
      await downloadChunk(i)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    toast.add({ title: '下载完成', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '下载过程中出错', color: 'red' })
  } finally {
    isDownloading.value = false
  }
}

const onChange = () => {
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.aspect-\[3\/5\] {
  aspect-ratio: 3 / 5;
}

.line-clamp-1 {
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
