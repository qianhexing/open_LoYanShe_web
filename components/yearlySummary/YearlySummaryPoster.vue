<template>
  <QhxModal :model-value="modelValue" @update:model-value="handleUpdate" @close="handleClose">
    <div class="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden max-w-4xl w-full h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10 bg-white dark:bg-gray-800">
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">生成分享图</h3>
        <button
          @click="handleClose"
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 预览区域 -->
      <div class="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4 md:p-8">
        <div v-if="generating" class="flex flex-col items-center justify-center h-full absolute inset-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500 mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400 font-medium">正在绘制美好回忆...</p>
        </div>
        
        <!-- Canvas 容器 -->
        <div class="relative shadow-2xl origin-top transform-gpu transition-transform duration-300" :style="previewStyle">
          <canvas ref="canvasRef" class="bg-white"></canvas>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
        <button
          @click="handleClose"
          class="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="downloadPoster"
          :disabled="generating || !drawComplete"
          class="px-8 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
        >
          <span v-if="!generating">保存图片</span>
          <span v-else>处理中...</span>
        </button>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { YearlySummaryData } from '@/api/yearlySummary'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps<{
  modelValue: boolean
  summaryData: YearlySummaryData
  currentYear: number
}>()

const emit = defineEmits(['update:modelValue'])

const canvasRef = ref<HTMLCanvasElement | null>(null)
const generating = ref(false)
const drawComplete = ref(false)
const scale = ref(1)
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

// 画布尺寸配置
const CANVAS_WIDTH = 750
// 基础高度，后续会根据内容动态调整
const BASE_HEIGHT = 1334

// 颜色配置
const COLORS = {
  bg: '#fffcfc',
  primary: '#ec4899', // pink-500
  secondary: '#a855f7', // purple-500
  text: '#1f2937', // gray-800
  textLight: '#9ca3af', // gray-400
  cardBg: '#ffffff',
  cardBorder: '#f3f4f6', // gray-100
  accent: '#fdf2f8', // pink-50
}

// 计算预览缩放比例
const updateScale = () => {
  if (typeof window === 'undefined') return
  const isMobile = window.innerWidth < 800
  const availableWidth = window.innerWidth - (isMobile ? 32 : 64)
  if (availableWidth < 750) {
    scale.value = availableWidth / 750
  } else {
    scale.value = 1
  }
}

const previewStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  marginBottom: `-${(canvasRef.value?.height || BASE_HEIGHT) * (1 - scale.value)}px`
}))

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleUpdate = (value: boolean) => {
  emit('update:modelValue', value)
}

// 图片加载工具
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    // 替换为 HTTPS 并添加处理参数
    const fullUrl = `${BASE_IMG}${url.replace(BASE_IMG, '')}`.replace('http://', 'https://')
    img.src = `${fullUrl}?x-oss-process=image/quality,q_80/resize,w_300`
    img.onload = () => resolve(img)
    img.onerror = () => {
      // 失败时尝试加载原图或占位图
      console.warn('Failed to load image:', url)
      resolve(img) // 仍然 resolve 以免阻塞流程，只是图片可能是空的
    }
  })
}

// 绘制圆角矩形
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 绘制文本自动换行
const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split('')
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY)
      line = words[n]
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, currentY)
}

// 主绘制逻辑
const drawPoster = async () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  generating.value = true
  drawComplete.value = false

  try {
    // 1. 计算总高度
    let currentY = 0
    const PADDING = 40
    
    // Header height approx 200
    // Stats grid height approx 300
    // Purchase stats height approx 150
    // Each item section approx 350
    // Footer approx 100
    
    const itemSections = [
      props.summaryData.latest_dress,
      props.summaryData.most_worn
    ].filter(arr => arr && arr.length > 0).length
    
    const TOTAL_HEIGHT = 200 + 320 + 150 + (itemSections * 380) + 150 + (props.summaryData.blacklisted_shops?.length ? 150 : 0) + 100
    
    canvasRef.value.width = CANVAS_WIDTH
    canvasRef.value.height = TOTAL_HEIGHT

    // 2. 绘制背景
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, CANVAS_WIDTH, TOTAL_HEIGHT)
    
    // 顶部渐变装饰
    const gradient = ctx.createLinearGradient(0, 0, 0, 500)
    gradient.addColorStop(0, '#fff1f2') // pink-50
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, 500)

    // 装饰圆点
    ctx.save()
    ctx.filter = 'blur(60px)'
    ctx.fillStyle = 'rgba(233, 213, 255, 0.5)' // purple-100
    ctx.beginPath()
    ctx.arc(CANVAS_WIDTH, 0, 200, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(252, 231, 243, 0.5)' // pink-100
    ctx.beginPath()
    ctx.arc(0, 400, 150, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    currentY += 80

    // 3. Header
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 80px serif'
    ctx.fillText(props.currentYear.toString(), CANVAS_WIDTH / 2, currentY)
    
    currentY += 40
    
    // 装饰线和标题
    ctx.beginPath()
    ctx.strokeStyle = '#d1d5db' // gray-300
    ctx.lineWidth = 1
    ctx.moveTo(CANVAS_WIDTH / 2 - 140, currentY - 10)
    ctx.lineTo(CANVAS_WIDTH / 2 - 90, currentY - 10)
    ctx.moveTo(CANVAS_WIDTH / 2 + 90, currentY - 10)
    ctx.lineTo(CANVAS_WIDTH / 2 + 140, currentY - 10)
    ctx.stroke()

    ctx.fillStyle = COLORS.primary
    ctx.font = '500 20px sans-serif'
    ctx.letterSpacing = '4px'
    ctx.fillText('YEARLY SUMMARY', CANVAS_WIDTH / 2, currentY)
    
    currentY += 30
    ctx.fillStyle = COLORS.textLight
    ctx.font = '14px sans-serif'
    ctx.fillText('LOLITA FASHION JOURNEY', CANVAS_WIDTH / 2, currentY)

    currentY += 60

    // 4. 核心数据卡片 (Grid Layout)
    const CARD_GAP = 20
    const LEFT_COL_WIDTH = (CANVAS_WIDTH - PADDING * 2 - CARD_GAP) / 3
    const RIGHT_COL_WIDTH = LEFT_COL_WIDTH * 2 + CARD_GAP
    const CARD_HEIGHT = LEFT_COL_WIDTH // Square aspect for left card

    // 入坑卡片
    ctx.save()
    roundRect(ctx, PADDING, currentY, LEFT_COL_WIDTH, CARD_HEIGHT, 30)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    ctx.fill()
    ctx.shadowColor = 'transparent' // Reset shadow
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 1
    ctx.stroke()

    // 内容
    const cardCenterX = PADDING + LEFT_COL_WIDTH / 2
    const cardCenterY = currentY + CARD_HEIGHT / 2
    
    ctx.font = '40px sans-serif'
    ctx.fillText('🕰️', cardCenterX, cardCenterY - 20)
    ctx.fillStyle = COLORS.textLight
    ctx.font = '12px sans-serif'
    ctx.fillText('SINCE', cardCenterX, cardCenterY + 10)
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 32px serif'
    ctx.fillText(props.summaryData.years_in_lolita + '年', cardCenterX, cardCenterY + 45)
    ctx.restore()

    // 消费卡片
    const rightCardX = PADDING + LEFT_COL_WIDTH + CARD_GAP
    
    ctx.save()
    roundRect(ctx, rightCardX, currentY, RIGHT_COL_WIDTH, CARD_HEIGHT, 30)
    // Gradient bg
    const cardGradient = ctx.createLinearGradient(rightCardX, currentY, rightCardX + RIGHT_COL_WIDTH, currentY + CARD_HEIGHT)
    cardGradient.addColorStop(0, '#ec4899')
    cardGradient.addColorStop(1, '#9333ea')
    ctx.fillStyle = cardGradient
    ctx.shadowColor = 'rgba(236, 72, 153, 0.2)'
    ctx.shadowBlur = 15
    ctx.shadowOffsetY = 8
    ctx.fill()

    // 装饰圆圈
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    ctx.arc(rightCardX + RIGHT_COL_WIDTH - 20, currentY + 20, 60, 0, Math.PI * 2)
    ctx.fill()

    // 内容
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText('TOTAL SPENDING', rightCardX + 30, currentY + 40)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 60px sans-serif'
    const spendingText = props.summaryData.total_spending.toLocaleString('zh-CN')
    ctx.fillText('¥ ' + spendingText, rightCardX + 30, currentY + 110)
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = '12px sans-serif'
    ctx.fillText('每一分热爱都值得铭记', rightCardX + 30, currentY + 145)
    ctx.restore()

    currentY += CARD_HEIGHT + 30

    // 5. 购买统计
    const STATS_HEIGHT = 120
    
    ctx.save()
    roundRect(ctx, PADDING, currentY, CANVAS_WIDTH - PADDING * 2, STATS_HEIGHT, 30)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    ctx.fill()
    ctx.stroke()

    // Title
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 18px sans-serif'
    // Pink pill
    ctx.fillStyle = COLORS.primary
    roundRect(ctx, PADDING + 20, currentY + 20, 6, 24, 3)
    ctx.fill()
    ctx.fillStyle = COLORS.text
    ctx.fillText('年度战利品', PADDING + 35, currentY + 38)

    // Grid
    const statItemWidth = (CANVAS_WIDTH - PADDING * 2 - 40) / props.summaryData.purchase_stats.length
    props.summaryData.purchase_stats.forEach((stat, index) => {
      const x = PADDING + 20 + index * statItemWidth + statItemWidth / 2
      const y = currentY + 70
      
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 28px serif'
      ctx.fillText(stat.value.toString(), x, y)
      
      // Label pill
      ctx.font = '12px sans-serif'
      const labelWidth = ctx.measureText(stat.label).width + 20
      ctx.fillStyle = '#f9fafb' // gray-50
      roundRect(ctx, x - labelWidth / 2, y + 10, labelWidth, 24, 12)
      ctx.fill()
      ctx.fillStyle = COLORS.textLight
      ctx.fillText(stat.label, x, y + 26)
    })
    ctx.restore()

    currentY += STATS_HEIGHT + 40

    // 6. 图片展示区域 (Latest Dress & Most Worn)
    const sections = [
      { title: '最新的裙子', icon: '👗', items: props.summaryData.latest_dress },
      { title: '穿着率最高', icon: '⭐', items: props.summaryData.most_worn }
    ]

    for (const section of sections) {
      if (section.items && section.items.length > 0) {
        // Section Title
        ctx.textAlign = 'left'
        ctx.fillStyle = COLORS.text
        ctx.font = 'bold 24px serif'
        ctx.fillText(`${section.icon} ${section.title}`, PADDING + 10, currentY)
        currentY += 30

        // Grid of 4
        const GRID_GAP = 15
        const ITEM_WIDTH = (CANVAS_WIDTH - PADDING * 2 - GRID_GAP * 3) / 4
        const ITEM_HEIGHT = ITEM_WIDTH * 1.33 + 60 // Image + Text

        for (let i = 0; i < Math.min(section.items.length, 4); i++) {
          const item = section.items[i]
          const x = PADDING + i * (ITEM_WIDTH + GRID_GAP)
          
          // Card bg
          ctx.save()
          roundRect(ctx, x, currentY, ITEM_WIDTH, ITEM_HEIGHT, 12)
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'
          ctx.shadowBlur = 8
          ctx.shadowOffsetY = 2
          ctx.fill()
          ctx.clip() // Clip for image

          // Load and draw image
          try {
            const img = await loadImage(item.clothes_img)
            // Object fit cover logic
            const imgRatio = img.width / img.height
            const targetRatio = ITEM_WIDTH / (ITEM_WIDTH * 1.33)
            let drawW, drawH, drawX, drawY

            if (imgRatio > targetRatio) {
              drawH = ITEM_WIDTH * 1.33
              drawW = drawH * imgRatio
              drawX = x - (drawW - ITEM_WIDTH) / 2
              drawY = currentY
            } else {
              drawW = ITEM_WIDTH
              drawH = drawW / imgRatio
              drawX = x
              drawY = currentY - (drawH - (ITEM_WIDTH * 1.33)) / 2
            }
            
            ctx.drawImage(img, drawX, drawY, drawW, drawH)
          } catch (e) {
            // Draw placeholder
            ctx.fillStyle = '#f3f4f6'
            ctx.fillRect(x, currentY, ITEM_WIDTH, ITEM_WIDTH * 1.33)
          }
          ctx.restore() // Remove clip

          // Text info
          const textY = currentY + ITEM_WIDTH * 1.33 + 10
          ctx.fillStyle = COLORS.text
          ctx.font = '12px sans-serif'
          // Truncate text
          let note = item.clothes_note || ''
          if (ctx.measureText(note).width > ITEM_WIDTH - 10) {
            while (ctx.measureText(note + '...').width > ITEM_WIDTH - 10 && note.length > 0) {
              note = note.slice(0, -1)
            }
            note += '...'
          }
          ctx.fillText(note, x + 8, textY + 12)
          
          ctx.fillStyle = COLORS.primary
          ctx.font = 'bold 14px sans-serif'
          ctx.fillText(`¥${formatNumber(item.price)}`, x + 8, textY + 32)
          
          if (section.title === '穿着率最高') {
             // Badge
             const badgeW = 40
             const badgeH = 20
             const badgeX = x + ITEM_WIDTH - badgeW - 5
             const badgeY = currentY + ITEM_WIDTH * 1.33 - badgeH - 5
             ctx.save()
             ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
             roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4)
             ctx.fill()
             ctx.fillStyle = COLORS.text
             ctx.font = 'bold 10px sans-serif'
             ctx.textAlign = 'center'
             ctx.fillText(`${item.times}次`, badgeX + badgeW/2, badgeY + 14)
             ctx.restore()
             ctx.textAlign = 'left' // Reset alignment
          }
        }
        
        currentY += ITEM_HEIGHT + 40
      }
    }

    // 7. 黑名单
    if (props.summaryData.blacklisted_shops?.length) {
      const BL_HEIGHT = 120
      ctx.save()
      ctx.fillStyle = '#fef2f2' // red-50
      ctx.strokeStyle = '#fee2e2' // red-100
      roundRect(ctx, PADDING, currentY, CANVAS_WIDTH - PADDING * 2, BL_HEIGHT, 30)
      ctx.fill()
      ctx.stroke()
      
      ctx.textAlign = 'center'
      ctx.fillStyle = '#991b1b' // red-800
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('⛔ 避雷指南', CANVAS_WIDTH / 2, currentY + 30)
      
      // Shops list
      let shopX = PADDING + 30
      let shopY = currentY + 70
      ctx.font = '12px sans-serif'
      
      const shops = props.summaryData.blacklisted_shops
      // Simple centered rendering logic for pills
      const totalWidth = shops.reduce((acc, s) => acc + ctx.measureText(s.shop_name).width + 30, 0)
      let startX = (CANVAS_WIDTH - totalWidth) / 2 + 15
      
      shops.forEach(shop => {
        const textW = ctx.measureText(shop.shop_name).width
        const pillW = textW + 24
        
        ctx.fillStyle = '#ffffff'
        roundRect(ctx, startX - pillW/2, shopY - 15, pillW, 30, 15)
        ctx.fill()
        
        ctx.fillStyle = '#4b5563'
        ctx.fillText(shop.shop_name, startX, shopY + 5)
        
        startX += pillW + 10
      })
      
      ctx.restore()
      currentY += BL_HEIGHT + 40
    }

    // 8. Footer
    // Dotted line
    ctx.save()
    ctx.strokeStyle = '#d1d5db'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(PADDING, currentY)
    ctx.lineTo(CANVAS_WIDTH - PADDING, currentY)
    ctx.stroke()
    ctx.restore()
    
    currentY += 40
    
    // Logo pill
    ctx.save()
    const footerText = 'Lo研社 · My Lolita Summary'
    ctx.font = '14px serif'
    const footerW = ctx.measureText(footerText).width + 60
    
    ctx.fillStyle = '#111827' // gray-900
    roundRect(ctx, (CANVAS_WIDTH - footerW) / 2, currentY, footerW, 36, 18)
    ctx.fill()
    
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(footerText, CANVAS_WIDTH / 2, currentY + 22)
    
    ctx.fillStyle = COLORS.textLight
    ctx.font = '12px sans-serif'
    ctx.fillText(`Generated at ${new Date().toLocaleDateString()}`, CANVAS_WIDTH / 2, currentY + 60)
    ctx.restore()

    drawComplete.value = true

  } catch (error) {
    console.error('Canvas drawing failed:', error)
  } finally {
    generating.value = false
  }
}

const downloadPoster = () => {
  if (!canvasRef.value) return
  try {
    const dataURL = canvasRef.value.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `Lo研社_年度总结_${props.currentYear}.png`
    link.href = dataURL
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Download failed:', error)
  }
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    nextTick(() => {
      updateScale()
      setTimeout(drawPoster, 100)
    })
  }
})
</script>