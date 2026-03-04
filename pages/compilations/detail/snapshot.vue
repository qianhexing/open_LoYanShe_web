<template>
  <div class="container mx-auto min-h-screen p-4">
    <!-- 顶部控制栏 -->
    <div class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg overflow-x-auto">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="text-sm text-gray-600 whitespace-nowrap">
          <span class="font-bold">{{ detail?.comp_name || '合集' }}</span> 已加载: <span class="text-primary-600 font-bold">{{ list.length }}</span>
          (共 {{ chunks.length }} 组)
        </div>
        
        <UButton 
          :loading="isDownloading"
          color="primary" 
          icon="i-heroicons-arrow-down-tray"
          @click="handleDownloadAll"
          class="whitespace-nowrap"
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
        <!-- 下载当前组按钮 (hover显示) -->
        <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton size="xs" color="gray" icon="i-heroicons-camera" @click="downloadChunk(chunkIndex)">下载此图</UButton>
        </div>

        <!-- 9.6:16 容器 -->
        <div class="w-full aspect-[3/5] bg-white">
          <div class="w-full h-full grid grid-cols-3 grid-rows-3">
            <div 
              v-for="(item, itemIndex) in chunk" 
              :key="getItemId(item, itemIndex)" 
              class="relative w-full h-full overflow-hidden"
            >
              <!-- 封面图 (铺满) -->
              <img 
                :src="getImageUrl(getItemCover(item))" 
                class="w-full h-full object-cover block"
                loading="lazy"
                crossorigin="anonymous" 
              />
              
              <!-- 底部信息浮层 -->
              <div class="absolute bottom-4 left-0 w-full flex flex-col items-center justify-end pointer-events-none px-2">
                <div class="bg-white/60 backdrop-blur-[2px] px-3 py-1.5 rounded-md flex flex-col items-center justify-center max-w-full shadow-sm text-center">
                  <!-- 图鉴名称 -->
                  <div class="text-xs font-bold text-black leading-tight text-center line-clamp-1 break-all mb-1">
                    {{ getItemName(item) }}
                  </div>
                  <!-- 设计元素 -->
                  <div class="text-[10px] font-medium text-gray-700 leading-tight mb-0.5 line-clamp-1" v-if="getDesignElements(item)">
                    设计元素：{{ getDesignElements(item) }}
                  </div>
                  <!-- 柄图元素 -->
                  <div class="text-[10px] font-medium text-gray-700 leading-tight mb-0.5 line-clamp-1" v-if="getPatternElements(item)">
                    柄图元素：{{ getPatternElements(item) }}
                  </div>
                  <!-- 主题 -->
                  <div class="text-[10px] font-medium text-red-600 leading-tight line-clamp-1" v-if="getTheme(item)">
                    主题：{{ getTheme(item) }}
                  </div>
                  <!-- 店铺信息 -->
                  <div class="flex items-center gap-1.5 justify-center mt-1">
                    <img 
                      v-if="getShopLogo(item)"
                      :src="getImageUrl(getShopLogo(item))" 
                      class="w-5 h-5 rounded-full object-cover bg-white shadow-sm flex-shrink-0"
                      crossorigin="anonymous"
                    />
                    <span class="text-[10px] font-medium text-gray-800 truncate max-w-[80px]">
                      {{ getShopName(item) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 填充空白格子 (如果不足9个) -->
            <div 
              v-for="n in (9 - chunk.length)" 
              :key="`empty-${n}`" 
              class="bg-gray-50 flex items-center justify-center"
            >
              <UIcon name="i-heroicons-photo" class="text-gray-200 text-4xl" />
            </div>
          </div>
        </div>
        
        <!-- 底部页码标记 -->
        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">
          {{ detail?.comp_name || '合集' }} - P{{ chunkIndex + 1 }}
        </div>
      </div>
    </div>
    
    <!-- 加载更多（底部） -->
    <div v-if="list.length > 0" class="flex justify-center py-8">
      <UButton 
        v-if="hasMore"
        :loading="loadMoreLoading"
        color="gray" 
        variant="soft"
        icon="i-heroicons-arrow-down"
        @click="loadMore"
        class="whitespace-nowrap"
      >
        加载更多
      </UButton>
      <span v-else class="text-sm text-gray-500">没有更多了</span>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && list.length === 0" class="text-center py-20 text-gray-500">
      该合集暂无数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getCompById, getCompDetailList } from '@/api/compilations'
import { BASE_IMG } from '@/utils/ipConfig'
import type { Compilations } from '@/types/api'
import type { Library } from '@/types/api'

const PAGE_SIZE = 36 // 9的倍数

// 从 item 提取 Library（支持 child.library 或直接的 library）
const toLibrary = (item: CompDetailRow | null | undefined): Partial<Library> | null => {
  if (!item) return null
  if (item.library) return item.library
  if (item.library_id !== undefined) return item
  return null
}

const getItemId = (item: CompDetailRow | null | undefined, index: number) => item?.library_id ?? item?.library?.library_id ?? index
const getItemCover = (item: CompDetailRow | null | undefined) => toLibrary(item)?.cover ?? item?.matching_list?.cover ?? ''
const getItemName = (item: CompDetailRow | null | undefined) => toLibrary(item)?.name ?? item?.matching_list?.note ?? ''
const getDesignElements = (item: CompDetailRow | null | undefined) => toLibrary(item)?.design_elements ?? ''
const getPatternElements = (item: CompDetailRow | null | undefined) => toLibrary(item)?.pattern_elements ?? ''
const getTheme = (item: CompDetailRow | null | undefined) => toLibrary(item)?.theme ?? ''
const getShopName = (item: CompDetailRow | null | undefined) => toLibrary(item)?.shop?.shop_name ?? ''
const getShopLogo = (item: CompDetailRow | null | undefined) => toLibrary(item)?.shop?.shop_logo ?? ''

const route = useRoute()
const compId = computed(() => {
  const id = route.params.id || route.query.id
  return id ? Number.parseInt(String(id)) : 0
})

// 状态
interface CompDetailRow {
  library?: Library
  matching_list?: { cover?: string; note?: string; main_style?: string; matching_id?: number }
  library_id?: number
  cover?: string
  name?: string
  design_elements?: string | null
  pattern_elements?: string | null
  theme?: string
}

const list = ref<CompDetailRow[]>([])
const detail = ref<Compilations | null>(null)
const loading = ref(false)
const loadMoreLoading = ref(false)
const isDownloading = ref(false)
const page = ref(1)
const total = ref(0)
const chunkRefs = ref<(HTMLElement | null)[]>([])

const hasMore = computed(() => list.value.length < total.value)

// 设置Ref
const setChunkRef = (el: unknown, index: number) => {
  chunkRefs.value[index] = el as HTMLElement | null
}

// 将列表分割为9个一组
const chunks = computed(() => {
  const result: CompDetailRow[][] = []
  for (let i = 0; i < list.value.length; i += 9) {
    result.push(list.value.slice(i, i + 9))
  }
  return result
})

// 监听列表变化，重置refs
watch(chunks, () => {
  chunkRefs.value = []
})

// 工具函数：获取图片URL
const getImageUrl = (path?: string) => {
  if (!path) return `${BASE_IMG}static/plan_cover/default.jpg`
  return `${BASE_IMG}${path}`
}

// 获取合集详情
const fetchDetail = async () => {
  if (!compId.value) return
  try {
    detail.value = await getCompById({ comp_id: compId.value })
  } catch (e) {
    console.error('Failed to fetch comp detail:', e)
    useToast().add({ title: '获取合集信息失败', color: 'red' })
  }
}

// 获取数据（首次加载）
const fetchData = async () => {
  if (!compId.value) {
    useToast().add({ title: '请指定合集ID', color: 'red' })
    return
  }
  loading.value = true
  list.value = []
  page.value = 1
  try {
    await fetchDetail()
    const res = await getCompDetailList({
      comp_id: compId.value,
      page: 1,
      pageSize: PAGE_SIZE
    })
    const rows = ((res.rows || []) as CompDetailRow[]).map((child) => {
      if (child.library) return child
      if (child.matching_list) return child
      return child
    })
    list.value = rows
    total.value = res.count || 0
  } catch (error) {
    console.error('Failed to fetch comp detail list:', error)
    useToast().add({ title: '获取数据失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

// 加载更多
const loadMore = async () => {
  if (!hasMore.value || loadMoreLoading.value || !compId.value) return
  loadMoreLoading.value = true
  try {
    const nextPage = page.value + 1
    const res = await getCompDetailList({
      comp_id: compId.value,
      page: nextPage,
      pageSize: PAGE_SIZE
    })
    const rows = ((res.rows || []) as CompDetailRow[]).map((child) => {
      if (child.library) return child
      if (child.matching_list) return child
      return child
    })
    list.value = [...list.value, ...rows]
    total.value = res.count || 0
    page.value = nextPage
  } catch (error) {
    console.error('Failed to load more:', error)
    useToast().add({ title: '加载更多失败', color: 'red' })
  } finally {
    loadMoreLoading.value = false
  }
}

// Canvas 绘图生成与下载功能
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

  const cellWidth = width / 3
  const cellHeight = height / 3

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  const paddingX = 16
  const paddingY = 10
  const logoSize = 24
  const fontSizeTitle = 16
  const fontSizeSub = 12
  const fontSizeShop = 14
  const gap = 6
  const availableWidth = cellWidth - (paddingX * 2) - 20

  const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (!text) return ''
    ctx.font = `${fontSizeSub}px sans-serif`
    const w = ctx.measureText(text).width
    if (w <= maxWidth) return text
    let s = text
    while (s.length > 0 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
    return s ? `${s}…` : ''
  }

  for (let i = 0; i < chunkData.length; i++) {
    const item = chunkData[i]
    const lib = toLibrary(item)
    const row = Math.floor(i / 3)
    const col = i % 3
    const x = col * cellWidth
    const y = row * cellHeight

    try {
      const coverUrl = getImageUrl(lib?.cover)
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
    } catch (e) {
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(x, y, cellWidth, cellHeight)
    }

    const name = getItemName(item)
    const designEl = getDesignElements(item)
    const patternEl = getPatternElements(item)
    const theme = getTheme(item)
    const shopName = getShopName(item)
    const hasShopLogo = !!getShopLogo(item)

    const lines: string[] = []
    if (name) lines.push(name)
    if (designEl) lines.push(`设计: ${truncateText(ctx, designEl, availableWidth)}`)
    if (patternEl) lines.push(`柄图: ${truncateText(ctx, patternEl, availableWidth)}`)
    if (theme) lines.push(`主题: ${truncateText(ctx, theme, availableWidth)}`)

    ctx.font = `bold ${fontSizeTitle}px sans-serif`
    const titleW = ctx.measureText(name || '').width
    ctx.font = `${fontSizeShop}px sans-serif`
    const shopTextWidth = ctx.measureText(shopName).width
    const shopLogoWidth = hasShopLogo ? logoSize + 6 : 0
    const shopContentWidth = shopLogoWidth + shopTextWidth

    ctx.font = `${fontSizeSub}px sans-serif`
    let maxLineW = titleW
    for (const line of lines.slice(1)) {
      const w = ctx.measureText(line).width
      if (w > maxLineW) maxLineW = w
    }
    if (shopName) maxLineW = Math.max(maxLineW, shopContentWidth)
    const boxWidth = maxLineW + (paddingX * 2)
    const shopRowHeight = shopName ? gap + Math.max(logoSize, fontSizeShop) : 0
    const boxHeight = paddingY * 2 + lines.length * (fontSizeSub + gap) - gap + shopRowHeight

    ctx.save()
    const boxX = x + (cellWidth - boxWidth) / 2
    const boxY = y + cellHeight - boxHeight - 20

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 8)
    ctx.fill()

    let currentY = boxY + paddingY
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    ctx.fillStyle = '#000000'
    ctx.font = `bold ${fontSizeTitle}px sans-serif`
    ctx.fillText(lines[0] || '', x + cellWidth / 2, currentY + fontSizeTitle - 2)
    currentY += fontSizeTitle + gap

    ctx.fillStyle = '#374151'
    ctx.font = `${fontSizeSub}px sans-serif`
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j]
      const isTheme = line.startsWith('主题:')
      if (isTheme) ctx.fillStyle = '#dc2626'
      ctx.fillText(line, x + cellWidth / 2, currentY)
      currentY += fontSizeSub + gap
      if (isTheme) ctx.fillStyle = '#374151'
    }

    // 店铺 (Logo + Name)
    if (shopName) {
      currentY += gap + fontSizeShop
      const shopStartX = x + cellWidth / 2 - shopContentWidth / 2
      if (hasShopLogo) {
        try {
          const logoUrl = getImageUrl(getShopLogo(item))
          const logoImg = await loadImage(logoUrl)
          const logoY = currentY - fontSizeShop
          ctx.save()
          ctx.beginPath()
          ctx.arc(shopStartX + logoSize / 2, logoY + logoSize / 2 - 5, logoSize / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(logoImg, shopStartX, logoY - 5, logoSize, logoSize)
          ctx.restore()
        } catch (e) {
          // Logo 加载失败忽略
        }
      }
      ctx.fillStyle = '#1f2937'
      ctx.font = `${fontSizeShop}px sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(shopName, shopStartX + shopLogoWidth, currentY)
    }

    ctx.restore()
  }

  const link = document.createElement('a')
  link.download = `${detail.value?.comp_name ?? '合集'}_${index + 1}.png`
  link.href = canvas.toDataURL('image/png')
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
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    toast.add({ title: '下载完成', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '下载过程中出错', color: 'red' })
  } finally {
    isDownloading.value = false
  }
}

watch(() => compId.value, () => {
  if (compId.value) fetchData()
}, { immediate: false })

onMounted(() => {
  if (compId.value) fetchData()
  else useToast().add({ title: '请从合集详情页进入，或地址栏添加 ?id=xxx', color: 'red' })
})

useHead({
  title: detail.value ? `${detail.value.comp_name || '合集'} - 生成图` : '合集生成图',
})
</script>

<style scoped>
.aspect-\[3\/5\] {
  aspect-ratio: 3 / 5;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
