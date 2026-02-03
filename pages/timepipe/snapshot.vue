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
                <div class="bg-white/60 backdrop-blur-[2px] px-3 py-1.5 rounded-md flex flex-col items-center justify-center max-w-full shadow-sm text-center">
                   <!-- 图鉴名称 -->
                   <div class="text-xs font-bold text-black leading-tight text-center line-clamp-1 break-all mb-1">
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
import type { LibraryPipe } from '@/types/api'

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
    const title = `${item.item?.library_price ? `￥${item.item?.library_price}` : ''}${item.item?.name}`
    const timeText = formatTimeRange(item.start_time, item.end_time)
    const shopName = item.item?.shop?.shop_name || ''
    const hasShopLogo = !!item.item?.shop?.shop_logo
    const libraryList = item.library_list || []

    // 准备 library_list 文本内容（组合成一行，用分隔符连接）
    const libraryItems: string[] = []
    if (libraryList.length > 0) {
      for (const lib of libraryList) {
        const type = lib.library_type || ''
        const price = lib.library_price ? `￥${lib.library_price}` : ''
        const text = [type, price].filter(Boolean).join(' ')
        if (text) libraryItems.push(text)
      }
    }
    const librarySeparator = ' / '
    const libraryFullText = libraryItems.join(librarySeparator)

    // 设置字体计算宽度
    ctx.font = `bold ${fontSizeTitle}px sans-serif`
    const titleWidth = ctx.measureText(title).width
    
    ctx.font = `${fontSizeTime}px sans-serif`
    const timeWidth = ctx.measureText(timeText).width
    
    ctx.font = `${fontSizeShop}px sans-serif`
    const shopTextWidth = ctx.measureText(shopName).width
    const shopLogoWidth = hasShopLogo ? logoSize + 6 : 0 // logo + margin
    const shopContentWidth = shopLogoWidth + shopTextWidth

    // 计算 library_list 文本宽度（考虑换行）
    ctx.font = `${fontSizeLibrary}px sans-serif`
    const availableWidth = cellWidth - (paddingX * 2) - 20 // 可用宽度，留一些边距
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
    const boxWidth = maxContentWidth + (paddingX * 2)
    // 基础行数: 标题 + 时间 + 店铺，如果有 library_list 则加上
    const libraryListHeight = libraryLines.length > 0 
      ? libraryLines.length * (fontSizeLibrary + gap) - gap // 最后一行不需要 gap
      : 0
    const boxHeight = paddingY * 2 + fontSizeTitle + gap + fontSizeTime + gap + Math.max(logoSize, fontSizeShop) + (libraryListHeight > 0 ? gap + libraryListHeight : 0)
    
    // 浮层位置 (bottom center, margin-bottom 20px)
    const boxX = x + (cellWidth - boxWidth) / 2
    const boxY = y + cellHeight - boxHeight - 20
    
    // 绘制半透明圆角背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    // ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    // ctx.shadowBlur = 4
    roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 8)
    ctx.fill()
    // ctx.shadowColor = 'transparent' // 重置阴影

    // 绘制文字内容 (居中)
    let currentY = boxY + paddingY + fontSizeTitle - 2
    
    // 标题
    ctx.fillStyle = '#000000'
    ctx.font = `bold ${fontSizeTitle}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(title, x + cellWidth/2, currentY)
    
    // 时间
    currentY += gap + fontSizeTime
    ctx.fillStyle = '#dc2626' // red-600
    ctx.font = `${fontSizeTime}px sans-serif`
    ctx.fillText(timeText, x + cellWidth/2, currentY)

    // 店铺 (Logo + Name)
    currentY += gap + fontSizeShop
    const shopStartX = x + cellWidth/2 - shopContentWidth/2
    
    if (hasShopLogo) {
       // 绘制圆形 Logo
       try {
         const logoUrl = getImageUrl(item.item?.shop?.shop_logo)
         const logoImg = await loadImage(logoUrl)
         const logoY = currentY - fontSizeShop // 大致对齐
         
         ctx.save()
         ctx.beginPath()
         ctx.arc(shopStartX + logoSize/2, logoY + logoSize/2 - 5, logoSize/2, 0, Math.PI * 2)
         ctx.closePath()
         ctx.clip()
         ctx.drawImage(logoImg, shopStartX, logoY - 5, logoSize, logoSize)
         ctx.restore()
       } catch (e) {
         // Logo 加载失败忽略
       }
    }
    
    ctx.fillStyle = '#1f2937' // gray-800
    ctx.font = `${fontSizeShop}px sans-serif`
    ctx.textAlign = 'left' // 改为左对齐方便排版
    ctx.fillText(shopName, shopStartX + shopLogoWidth, currentY)

    // library_list 信息（红色字体，自动换行）
    if (libraryLines.length > 0) {
      currentY += gap + fontSizeLibrary
      ctx.fillStyle = '#dc2626' // red-600
      ctx.font = `${fontSizeLibrary}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      for (const line of libraryLines) {
        ctx.fillText(line, x + cellWidth/2, currentY)
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