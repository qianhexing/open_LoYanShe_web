<template>
  <div class="container mx-auto min-h-screen p-4">
    <!-- 顶部控制栏 -->
    <div class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg overflow-x-auto">
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-sm font-bold text-gray-700 whitespace-nowrap">选择日期:</span>
        <div class="w-[500px]"> <!-- 限制日期选择器容器宽度 -->
            
        </div>
      </div>
      <QhxDatePicker v-model="picked" @change="onChange" />
      
      <div class="flex items-center gap-4 flex-wrap">
        <div class="text-sm text-gray-600 whitespace-nowrap">
          <span class="font-bold">{{ formattedDate }}</span> 上新: <span class="text-primary-600 font-bold">{{ list.length }}</span>
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
        <!-- aspect ratio: 9.6 / 16 = 0.6 (3:5) -->
        <div class="w-full aspect-[3/5] bg-white">
          <div class="w-full h-full grid grid-cols-3 grid-rows-3">
            <div 
              v-for="(item, itemIndex) in chunk" 
              :key="item.id || itemIndex" 
              class="relative w-full h-full overflow-hidden"
            >
              <!-- 封面图 (铺满) -->
              <img 
                :src="getImageUrl(item.item?.cover)" 
                class="w-full h-full object-cover block"
                loading="lazy"
                crossorigin="anonymous" 
              />
              
              <!-- 底部信息浮层 -->
              <div class="absolute bottom-4 left-0 w-full flex flex-col items-center justify-end pointer-events-none px-2">
                <div class="bg-white/88 backdrop-blur-sm px-3 py-1.5 rounded-md flex flex-col items-center justify-center w-full max-w-[calc(100%-4px)] min-w-0 shadow-sm text-center overflow-hidden">
                   <!-- 图鉴名称 -->
                   <div class="text-xs font-bold text-black leading-tight text-center line-clamp-2 break-all mb-1 w-full">
                    {{ item.item?.name }}
                  </div>
                   <!-- 起止时间 -->
                   <div class="text-[10px] font-medium text-red-600 leading-tight mb-1" v-if="item.start_time || item.end_time">
                     {{ formatTimeRange(item.start_time, item.end_time) }}
                   </div>
                  <!-- 店铺信息 -->
                  <div class="flex items-center gap-1.5 justify-center">
                    <img 
                      v-if="item.item?.shop?.shop_logo"
                      :src="getImageUrl(item.item?.shop?.shop_logo)" 
                      class="w-5 h-5 rounded-full object-cover bg-white shadow-sm flex-shrink-0"
                      crossorigin="anonymous"
                    />
                    <span class="text-[10px] font-medium text-gray-800 truncate max-w-[80px]">
                      {{ item.item?.shop?.shop_name }}
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
        
        <!-- 底部页码标记 (可选) -->
        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">
           {{ formattedDate }} - P{{ chunkIndex + 1 }}
        </div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && list.length === 0" class="text-center py-20 text-gray-500">
      该日期暂无上新数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { getLibraryPipeList } from '@/api/library'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatLabel } from '@/utils/public'
import type { LibraryPipe } from '@/types/api'

const configStore = useConfigStore()
const moneyTypeOptions = computed(() => configStore.config?.money_type ?? [])

/** Canvas 导出：人民币(shop_country=0) 仅「￥金额」；其他国家追加配置中的货币单位标签 */
const formatCanvasPrice = (price: number | undefined, shopCountry?: number): string => {
  if (price === undefined || price === null) return ''
  const country = shopCountry ?? 0
  const base = `￥${price}`
  if (country === 0) return base
  const unit = formatLabel(country, moneyTypeOptions.value)
  return unit ? `${base} ${unit}` : base
}

interface LibrarySkuRecord {
  library_pattern: string
  library_price?: number | null
}

const parseLibraryJsonData = (jsonData: unknown): Record<string, unknown> => {
  if (jsonData == null) return {}
  if (typeof jsonData === 'string') {
    try {
      const parsed = JSON.parse(jsonData)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    return jsonData as Record<string, unknown>
  }
  return {}
}

const extractSkuListFromJsonData = (jsonData: unknown): LibrarySkuRecord[] => {
  const data = parseLibraryJsonData(jsonData)
  const raw = data.sku
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return []
    }
  }
  return list
    .map((item): LibrarySkuRecord | null => {
      if (!item || typeof item !== 'object' || !('library_pattern' in item)) return null
      const record = item as { library_pattern?: unknown; library_price?: unknown }
      const pattern = String(record.library_pattern ?? '').trim()
      if (!pattern) return null
      return {
        library_pattern: pattern,
        library_price: record.library_price != null ? Number(record.library_price) : null
      }
    })
    .filter((item): item is LibrarySkuRecord => item != null)
}

// 状态
const picked = ref<Date>(new Date())
const list = ref<LibraryPipe[]>([])
const loading = ref(false)
const isDownloading = ref(false)
const chunkRefs = ref<(HTMLElement | null)[]>([])

// 设置Ref
const setChunkRef = (el: any, index: number) => {
  chunkRefs.value[index] = el as HTMLElement | null
}

// 计算属性
const formattedDate = computed(() => dayjs(picked.value).format('YYYY-MM-DD'))

// 将列表分割为9个一组
const chunks = computed(() => {
  const result = []
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

// 工具函数：格式化时间范围 25-10-12-25-10-30
const formatTimeRange = (start?: string, end?: string) => {
  const format = (d?: string) => d ? dayjs(d).format('YY-MM-DD') : ''
  const s = format(start)
  const e = format(end)
  if (s && e) return `${s} - ${e}`
  if (s) return `${s} -`
  if (e) return `- ${e}`
  return ''
}

// 获取数据
const fetchData = async () => {
  loading.value = true
  list.value = []
  try {
    // pageSize: 999 获取全部
    const res = await getLibraryPipeList({
      page: 1,
      pageSize: 999,
      sort: 2,
      time: formattedDate.value,
      state: 0
    })
    list.value = res.rows || []
  } catch (error) {
    console.error('Failed to fetch library pipe list:', error)
    useToast().add({ title: '获取数据失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

// Canvas 绘图生成与下载功能
const downloadChunk = async (index: number) => {
  const chunkData = chunks.value[index]
  if (!chunkData) return

  // 创建一个离屏 Canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 设置画布大小 (9.6:16 比例，为了高清设宽为 1080)
  // 1080 / 3 * 5 = 1800
  const width = 1080
  const height = 1800
  canvas.width = width
  canvas.height = height

  // 绘制背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const cellWidth = width / 3
  const cellHeight = height / 3

  // 加载图片辅助函数
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  // 按最大宽度将文本拆成多行（逐字测量，适配中文）
  const wrapTextByWidth = (text: string, maxWidth: number, font: string): string[] => {
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
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  const measureLinesWidth = (lines: string[], font: string): number => {
    if (lines.length === 0) return 0
    ctx.font = font
    return Math.max(...lines.map(line => ctx.measureText(line).width))
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

  // 绘制圆角矩形路径辅助函数
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

  // 绘制每个单元格
  for (let i = 0; i < chunkData.length; i++) {
    const item = chunkData[i]
    const row = Math.floor(i / 3)
    const col = i % 3
    const x = col * cellWidth
    const y = row * cellHeight

    // 1. 绘制封面图 (object-cover 效果)
    try {
      const coverUrl = getImageUrl(item.item?.cover)
      const img = await loadImage(coverUrl)
      
      // 计算裁剪区域以实现 cover 效果
      let sWidth = img.width
      let sHeight = img.height
      let sx = 0
      let sy = 0
      
      const imgAspect = sWidth / sHeight
      const cellAspect = cellWidth / cellHeight

      if (imgAspect > cellAspect) {
        // 图片过宽，裁左右
        const newWidth = sHeight * cellAspect
        sx = (sWidth - newWidth) / 2
        sWidth = newWidth
      } else {
        // 图片过高，裁上下
        const newHeight = sWidth / cellAspect
        sy = (sHeight - newHeight) / 2
        sHeight = newHeight
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, cellWidth, cellHeight)
    } catch (e) {
      console.warn('Failed to load image:', item.item?.cover)
      // 绘制占位背景
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(x, y, cellWidth, cellHeight)
    }

    // 2. 绘制底部文字浮层
    // 配置参数
    const paddingX = 16 // 文字左右padding
    const paddingY = 10 // 文字上下padding
    const logoSize = 24 // logo大小
    const fontSizeTitle = 16
    const fontSizeTime = 14
    const fontSizeShop = 14
    const fontSizeLibrary = 12 // library_list 字体大小
    const gap = 6 // 行间距
    
    ctx.save()
    
    // 准备文字内容
    const mainCountry = item.item?.shop_country ?? item.item?.shop?.shop_country ?? 0
    const title = `${item.item?.library_price ? `${formatCanvasPrice(item.item.library_price, mainCountry)} ` : ''}${item.item?.name || ''}`
    const timeText = formatTimeRange(item.start_time, item.end_time)
    const shopName = item.item?.shop?.shop_name || ''
    const hasShopLogo = !!item.item?.shop?.shop_logo
    const libraryList = item.library_list || []

    // 准备价目表文本：library_list 或 json_data.sku（版型 + 参考价）
    const libraryItems: string[] = []
    if (libraryList.length > 0) {
      for (const lib of libraryList) {
        const type = lib.library_type || ''
        const price = lib.library_price ? formatCanvasPrice(lib.library_price, lib.shop_country) : ''
        const text = [type, price].filter(Boolean).join(' ')
        if (text) libraryItems.push(text)
      }
    } else {
      const skuList = extractSkuListFromJsonData(item.item?.json_data)
      for (const sku of skuList) {
        const type = sku.library_pattern || ''
        const price = sku.library_price ? formatCanvasPrice(sku.library_price, mainCountry) : ''
        const text = [type, price].filter(Boolean).join(' ')
        if (text) libraryItems.push(text)
      }
    }
    const librarySeparator = ' / '
    const libraryFullText = libraryItems.join(librarySeparator)

    const maxBoxWidth = cellWidth - 20
    const contentMaxWidth = maxBoxWidth - paddingX * 2
    const titleFont = `bold ${fontSizeTitle}px sans-serif`
    const timeFont = `${fontSizeTime}px sans-serif`
    const shopFont = `${fontSizeShop}px sans-serif`
    const libraryFont = `${fontSizeLibrary}px sans-serif`

    const titleLines = wrapTextByWidth(title, contentMaxWidth, titleFont)
    const titleWidth = measureLinesWidth(titleLines, titleFont)

    ctx.font = timeFont
    const timeWidth = timeText ? ctx.measureText(timeText).width : 0

    const shopLogoWidth = hasShopLogo ? logoSize + 6 : 0
    const shopNameMaxWidth = Math.max(contentMaxWidth - shopLogoWidth, 0)
    const shopNameDisplay = truncateTextByWidth(shopName, shopNameMaxWidth, shopFont)
    ctx.font = shopFont
    const shopTextWidth = ctx.measureText(shopNameDisplay).width
    const shopContentWidth = shopLogoWidth + shopTextWidth

    // 计算 library_list 文本宽度（考虑换行）
    ctx.font = libraryFont
    const availableWidth = contentMaxWidth
    let libraryLines: string[] = []
    let maxLibraryWidth = 0
    
    if (libraryFullText) {
      // 如果总宽度不超过可用宽度，直接一行
      const fullWidth = ctx.measureText(libraryFullText).width
      if (fullWidth <= availableWidth) {
        libraryLines = [libraryFullText]
        maxLibraryWidth = fullWidth
      } else {
        // 需要换行：按分隔符分割，然后组合
        let currentLine = ''
        for (const item of libraryItems) {
          const testText = currentLine ? `${currentLine}${librarySeparator}${item}` : item
          const testWidth = ctx.measureText(testText).width
          
          if (testWidth <= availableWidth) {
            currentLine = testText
          } else {
            // 当前行已满，保存并开始新行
            if (currentLine) {
              libraryLines.push(currentLine)
              const lineWidth = ctx.measureText(currentLine).width
              if (lineWidth > maxLibraryWidth) maxLibraryWidth = lineWidth
            }
            currentLine = item
          }
        }
        // 添加最后一行
        if (currentLine) {
          libraryLines.push(currentLine)
          const lineWidth = ctx.measureText(currentLine).width
          if (lineWidth > maxLibraryWidth) maxLibraryWidth = lineWidth
        }
      }
    }

    // 计算浮层总宽高
    const maxContentWidth = Math.max(titleWidth, timeWidth, shopContentWidth, maxLibraryWidth)
    const boxWidth = Math.min(maxContentWidth + paddingX * 2, maxBoxWidth)
    const titleBlockHeight = titleLines.length > 0
      ? titleLines.length * fontSizeTitle + (titleLines.length - 1) * gap
      : 0
    const libraryListHeight = libraryLines.length > 0 
      ? libraryLines.length * (fontSizeLibrary + gap) - gap
      : 0
    const timeBlockHeight = timeText ? fontSizeTime + gap : 0
    const shopBlockHeight = (shopNameDisplay || hasShopLogo) ? Math.max(logoSize, fontSizeShop) + gap : 0
    const boxHeight = paddingY * 2 + titleBlockHeight + timeBlockHeight + shopBlockHeight
      + (libraryListHeight > 0 ? libraryListHeight : 0)
    
    // 浮层位置 (bottom center, margin-bottom 20px)
    const boxX = x + (cellWidth - boxWidth) / 2
    const boxY = y + cellHeight - boxHeight - 20
    
    // 绘制半透明圆角背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    // ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    // ctx.shadowBlur = 4
    roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 8)
    ctx.fill()
    // ctx.shadowColor = 'transparent' // 重置阴影

    // 绘制文字内容 (居中)
    let currentY = boxY + paddingY
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // 标题（自动换行）
    ctx.fillStyle = '#000000'
    ctx.font = titleFont
    for (const line of titleLines) {
      ctx.fillText(line, x + cellWidth / 2, currentY)
      currentY += fontSizeTitle + gap
    }

    // 时间
    if (timeText) {
      ctx.fillStyle = '#dc2626'
      ctx.font = timeFont
      ctx.fillText(timeText, x + cellWidth / 2, currentY)
      currentY += fontSizeTime + gap
    }

    // 店铺 (Logo + Name)
    const shopStartX = x + cellWidth / 2 - shopContentWidth / 2
    
    if (hasShopLogo) {
       try {
         const logoUrl = getImageUrl(item.item?.shop?.shop_logo)
         const logoImg = await loadImage(logoUrl)
         const logoY = currentY + (Math.max(logoSize, fontSizeShop) - logoSize) / 2
         
         ctx.save()
         ctx.beginPath()
         ctx.arc(shopStartX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
         ctx.closePath()
         ctx.clip()
         ctx.drawImage(logoImg, shopStartX, logoY, logoSize, logoSize)
         ctx.restore()
       } catch {
         // Logo 加载失败忽略
       }
    }
    
    ctx.fillStyle = '#1f2937'
    ctx.font = shopFont
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    if (shopNameDisplay) {
      ctx.fillText(shopNameDisplay, shopStartX + shopLogoWidth, currentY + (Math.max(logoSize, fontSizeShop) - fontSizeShop) / 2)
    }
    currentY += Math.max(logoSize, fontSizeShop) + gap

    // library_list 信息（红色字体，自动换行）
    if (libraryLines.length > 0) {
      ctx.fillStyle = '#dc2626'
      ctx.font = libraryFont
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const line of libraryLines) {
        ctx.fillText(line, x + cellWidth / 2, currentY)
        currentY += fontSizeLibrary + gap
      }
    }

    ctx.restore()
  }

  // 生成图片并下载
  const link = document.createElement('a')
  link.download = `上新_${formattedDate.value}_${index + 1}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

const handleDownloadAll = async () => {
  if (chunks.value.length === 0) return
  isDownloading.value = true
  
  const toast = useToast()
  toast.add({ title: '开始批量绘制并下载...', color: 'blue' })

  try {
    // 串行下载，避免浏览器卡死
    for (let i = 0; i < chunks.value.length; i++) {
      await downloadChunk(i)
      // 稍微等待一下，给浏览器喘息时间
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

// 监听日期变化
const onChange = () => {
  fetchData()
}

// 初始化
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
/* 确保截图时样式一致 */
.aspect-\[3\/5\] {
  aspect-ratio: 3 / 5;
}
</style>