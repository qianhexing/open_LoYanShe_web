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
    if (!url) {
        resolve(new Image()) // 返回空图片对象
        return
    }
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    // 替换为 HTTPS 并添加处理参数
    const fullUrl = `${BASE_IMG}${url.replace(BASE_IMG, '')}`.replace('http://', 'https://')
    img.src = `${fullUrl}?x-oss-process=image/quality,q_80/resize,w_300`
    img.onload = () => resolve(img)
    img.onerror = () => {
      // 失败时尝试加载原图或占位图
      console.warn('Failed to load image:', url)
      resolve(img) // 仍然 resolve 以免阻塞流程
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

// 主绘制逻辑
const drawPoster = async () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  generating.value = true
  drawComplete.value = false

  try {
    const PADDING = 40
    let totalHeight = 0
    
    // 1. 计算总高度
    totalHeight += 250 // Header
    totalHeight += 320 // Stats Grid
    totalHeight += 150 // Purchase Stats
    
    // 相册高度计算
    const albumCount = props.summaryData.ablumn_items?.length || 0
    let albumHeight = 0
    if (albumCount > 0) {
        const cols = 3
        const rows = Math.ceil(albumCount / cols)
        const gap = 15
        const itemW = (CANVAS_WIDTH - PADDING * 2 - gap * (cols - 1)) / cols
        const itemH = itemW + 40 // Image + Title
        albumHeight = rows * itemH + (rows - 1) * gap + 80 // + Title
        totalHeight += albumHeight + 40 // Padding
    }
    
    // Favorite sections
    let favSections = 0
    if (props.summaryData.favorite?.length) {
        favSections = props.summaryData.favorite.filter(f => f.value?.length).length
    }
    totalHeight += favSections * 380
    
    // Most Worn
    if (props.summaryData.most_worn?.length) {
        totalHeight += 380
    }
    
    // Shop List (Optional)
    if (props.summaryData.shop_list?.length) {
        totalHeight += 200
    }

    // Blacklist
    if (props.summaryData.blacklisted_shops?.length) {
        totalHeight += 180
    }
    
    totalHeight += 150 // Footer

    canvasRef.value.width = CANVAS_WIDTH
    canvasRef.value.height = totalHeight

    // 2. 绘制背景
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight)
    
    // 顶部渐变装饰
    const gradient = ctx.createLinearGradient(0, 0, 0, 500)
    gradient.addColorStop(0, '#fff1f2')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, 500)

    let currentY = 80

    // 3. Header
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 80px serif'
    ctx.fillText(props.currentYear.toString(), CANVAS_WIDTH / 2, currentY)
    
    currentY += 40
    
    ctx.beginPath()
    ctx.strokeStyle = '#d1d5db'
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
    
    currentY += 40
    
    // User Info
    if (props.summaryData.user_info) {
        ctx.fillStyle = COLORS.text
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(props.summaryData.user_info.user_name, CANVAS_WIDTH / 2, currentY)
        currentY += 30
    }

    currentY += 40

    // 4. 核心数据卡片 (Grid Layout)
    const CARD_GAP = 20
    const LEFT_COL_WIDTH = (CANVAS_WIDTH - PADDING * 2 - CARD_GAP) / 3
    const RIGHT_COL_WIDTH = LEFT_COL_WIDTH * 2 + CARD_GAP
    const CARD_HEIGHT = LEFT_COL_WIDTH

    // 入坑卡片
    ctx.save()
    roundRect(ctx, PADDING, currentY, LEFT_COL_WIDTH, CARD_HEIGHT, 30)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    ctx.fill()
    ctx.stroke()

    const cardCenterX = PADDING + LEFT_COL_WIDTH / 2
    const cardCenterY = currentY + CARD_HEIGHT / 2
    
    ctx.textAlign = 'center'
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
    const cardGradient = ctx.createLinearGradient(rightCardX, currentY, rightCardX + RIGHT_COL_WIDTH, currentY + CARD_HEIGHT)
    cardGradient.addColorStop(0, '#ec4899')
    cardGradient.addColorStop(1, '#9333ea')
    ctx.fillStyle = cardGradient
    ctx.shadowColor = 'rgba(236, 72, 153, 0.2)'
    ctx.shadowBlur = 15
    ctx.shadowOffsetY = 8
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText('TOTAL SPENDING', rightCardX + 30, currentY + 40)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 60px sans-serif'
    const spendingText = props.summaryData.total_spending.toLocaleString('zh-CN')
    ctx.fillText('¥ ' + spendingText, rightCardX + 30, currentY + 110)
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

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText('📊 年度收获', PADDING + 30, currentY + 38)

    if (props.summaryData.purchase_stats?.length) {
        const statItemWidth = (CANVAS_WIDTH - PADDING * 2 - 40) / props.summaryData.purchase_stats.length
        props.summaryData.purchase_stats.forEach((stat, index) => {
          const x = PADDING + 20 + index * statItemWidth + statItemWidth / 2
          const y = currentY + 70
          
          ctx.textAlign = 'center'
          ctx.fillStyle = COLORS.text
          ctx.font = 'bold 28px serif'
          ctx.fillText(stat.value.toString(), x, y)
          
          ctx.font = '12px sans-serif'
          ctx.fillStyle = COLORS.textLight
          ctx.fillText(stat.label, x, y + 26)
        })
    }
    ctx.restore()

    currentY += STATS_HEIGHT + 40

    // 6. 相册展示 (重点)
    if (albumCount > 0) {
        ctx.textAlign = 'left'
        ctx.fillStyle = COLORS.text
        ctx.font = 'bold 24px serif'
        ctx.fillText('📸 年度回忆', PADDING + 10, currentY)
        currentY += 30

        const cols = 3
        const gap = 15
        const itemW = (CANVAS_WIDTH - PADDING * 2 - gap * (cols - 1)) / cols
        const itemH = itemW
        
        for (let i = 0; i < albumCount; i++) {
            const album = props.summaryData.ablumn_items[i]
            const col = i % cols
            const row = Math.floor(i / cols)
            
            const x = PADDING + col * (itemW + gap)
            const y = currentY + row * (itemH + gap + 40) // + text space
            
            // Draw Cover
            ctx.save()
            roundRect(ctx, x, y, itemW, itemH, 12)
            ctx.clip()
            
            if (album.ablumn?.album_cover) {
                 try {
                    const img = await loadImage(album.ablumn.album_cover)
                    // Cover fit
                    const imgRatio = img.width / img.height
                    let dw, dh, dx, dy
                    if (imgRatio > 1) {
                        dh = itemH
                        dw = dh * imgRatio
                        dx = x - (dw - itemW) / 2
                        dy = y
                    } else {
                        dw = itemW
                        dh = dw / imgRatio
                        dx = x
                        dy = y - (dh - itemH) / 2
                    }
                    ctx.drawImage(img, dx, dy, dw, dh)
                 } catch (e) {
                     ctx.fillStyle = '#f3f4f6'
                     ctx.fillRect(x, y, itemW, itemH)
                 }
            } else {
                ctx.fillStyle = '#f3f4f6'
                ctx.fillRect(x, y, itemW, itemH)
            }
            ctx.restore()
            
            // Draw Title
            ctx.fillStyle = COLORS.text
            ctx.font = 'bold 14px sans-serif'
            const title = album.ablumn?.album_title || '未命名'
            // Truncate
            let displayTitle = title
            if (ctx.measureText(title).width > itemW) {
                while (ctx.measureText(displayTitle + '...').width > itemW && displayTitle.length > 0) {
                    displayTitle = displayTitle.slice(0, -1)
                }
                displayTitle += '...'
            }
            ctx.textAlign = 'center'
            ctx.fillText(displayTitle, x + itemW/2, y + itemH + 20)
        }
        
        currentY += albumHeight + 40
    }

    // 7. 图片展示区域 (Favorite & Most Worn)
    const drawItemSection = async (title: string, icon: string, items: any[], showTimesBadge = false) => {
      if (!items || items.length === 0) return
      
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 24px serif'
      ctx.fillText(`${icon} ${title}`, PADDING + 10, currentY)
      currentY += 30

      const GRID_GAP = 15
      const ITEM_WIDTH = (CANVAS_WIDTH - PADDING * 2 - GRID_GAP * 3) / 4
      const ITEM_HEIGHT = ITEM_WIDTH * 1.33 + 60 

      for (let i = 0; i < Math.min(items.length, 4); i++) {
        const item = items[i]
        const x = PADDING + i * (ITEM_WIDTH + GRID_GAP)
        
        ctx.save()
        roundRect(ctx, x, currentY, ITEM_WIDTH, ITEM_HEIGHT, 12)
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 2
        ctx.fill()
        ctx.clip()

        // Get Image URL
        let imgUrl = item.clothes_img
        if (!imgUrl && item.library?.cover) imgUrl = item.library.cover
        if (!imgUrl && item.library?.square_cover) imgUrl = item.library.square_cover
        
        if (imgUrl) {
             try {
                const img = await loadImage(imgUrl)
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
                 ctx.fillStyle = '#f3f4f6'
                 ctx.fillRect(x, currentY, ITEM_WIDTH, ITEM_WIDTH * 1.33)
             }
        } else {
             ctx.fillStyle = '#f3f4f6'
             ctx.fillRect(x, currentY, ITEM_WIDTH, ITEM_WIDTH * 1.33)
        }
        ctx.restore()

        const textY = currentY + ITEM_WIDTH * 1.33 + 10
        ctx.fillStyle = COLORS.text
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'left'
        
        // Name priority: item.clothes_note -> item.library.name
        let name = item.clothes_note || item.library?.name || ''
        if (ctx.measureText(name).width > ITEM_WIDTH - 10) {
          while (ctx.measureText(name + '...').width > ITEM_WIDTH - 10 && name.length > 0) {
            name = name.slice(0, -1)
          }
          name += '...'
        }
        ctx.fillText(name, x + 8, textY + 12)
        
        if (item.price) {
            ctx.fillStyle = COLORS.primary
            ctx.font = 'bold 14px sans-serif'
            ctx.fillText(`¥${formatNumber(item.price)}`, x + 8, textY + 32)
        }
        
        if (showTimesBadge && item.times) {
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
        }
      }
      currentY += ITEM_HEIGHT + 40
    }

    if (props.summaryData.favorite && props.summaryData.favorite.length > 0) {
      const getFavoriteIcon = (label: string): string => {
        const iconMap: Record<string, string> = {
          '小物': '💍', '袜子': '🧦', '包包': '👜', '鞋子': '👠', '头饰': '👑', '手套': '🧤', '其他': '✨'
        }
        return iconMap[label] || '✨'
      }

      for (const fav of props.summaryData.favorite) {
        if (fav.value && fav.value.length > 0) {
          await drawItemSection(`最喜欢的${fav.label}`, getFavoriteIcon(fav.label), fav.value)
        }
      }
    }

    if (props.summaryData.most_worn?.length) {
        await drawItemSection('穿着率最高', '⭐', props.summaryData.most_worn, true)
    }

    // 8. 店铺排行 (简单列表)
    if (props.summaryData.shop_list?.length) {
        ctx.textAlign = 'left'
        ctx.fillStyle = COLORS.text
        ctx.font = 'bold 24px serif'
        ctx.fillText('🛍️ 常逛店铺', PADDING + 10, currentY)
        currentY += 30
        
        const topShops = props.summaryData.shop_list.slice(0, 5)
        let shopX = PADDING
        
        topShops.forEach((shop, i) => {
            const name = shop.shop?.shop_name || shop.label
            const text = `${i+1}. ${name} (${shop.value})`
            ctx.font = '14px sans-serif'
            ctx.fillStyle = COLORS.text
            ctx.fillText(text, shopX, currentY + 20)
            
            // Draw simple bar
            const barW = Math.min(shop.value * 2, 100)
            ctx.fillStyle = COLORS.primary
            ctx.globalAlpha = 0.6
            roundRect(ctx, shopX + ctx.measureText(text).width + 10, currentY + 8, barW, 12, 6)
            ctx.fill()
            ctx.globalAlpha = 1.0
            
            currentY += 30
        })
        currentY += 40
    }

    // 9. 黑名单
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
      
      let shopY = currentY + 70
      ctx.font = '12px sans-serif'
      
      const shops = props.summaryData.blacklisted_shops
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

    // 10. Footer
    ctx.save()
    ctx.strokeStyle = '#d1d5db'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(PADDING, currentY)
    ctx.lineTo(CANVAS_WIDTH - PADDING, currentY)
    ctx.stroke()
    ctx.restore()
    
    currentY += 40
    
    const footerText = 'Lo研社 · My Lolita Summary'
    ctx.font = '14px serif'
    const footerW = ctx.measureText(footerText).width + 60
    
    ctx.fillStyle = '#111827'
    roundRect(ctx, (CANVAS_WIDTH - footerW) / 2, currentY, footerW, 36, 18)
    ctx.fill()
    
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(footerText, CANVAS_WIDTH / 2, currentY + 22)
    
    ctx.fillStyle = COLORS.textLight
    ctx.font = '12px sans-serif'
    ctx.fillText(`Generated at ${new Date().toLocaleDateString()}`, CANVAS_WIDTH / 2, currentY + 60)

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
