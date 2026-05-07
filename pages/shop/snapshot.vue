<template>
  <div class="container mx-auto min-h-screen p-4">
    <div
      class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg overflow-x-auto"
    >
      <div class="flex items-center gap-2 flex-1 min-w-[200px]">
        <UInput
          v-model="searchInput"
          placeholder="搜索店铺（与店铺列表相同，空格分隔多条件）"
          class="max-w-md"
          @keyup.enter="applySearch"
        />
        <UButton icon="i-heroicons-magnifying-glass" color="gray" variant="soft" @click="applySearch">
          搜索
        </UButton>
      </div>
      <div class="flex items-center gap-4 flex-wrap">
        <div class="text-sm text-gray-600 whitespace-nowrap">
          店铺数 <span class="text-primary-600 font-bold">{{ list.length }}</span>
          （每图 <span class="font-mono">144</span> 格，共 <span class="font-bold">{{ chunks.length }}</span> 张）
        </div>
        <UButton
          :loading="isDownloading"
          color="primary"
          icon="i-heroicons-arrow-down-tray"
          @click="handleDownloadAll"
        >
          批量下载（Canvas）
        </UButton>
        <UButton :loading="loading" color="gray" variant="soft" icon="i-heroicons-arrow-path" @click="fetchData">
          刷新列表
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
    </div>

    <div v-else-if="list.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20 max-w-[1920px] mx-auto">
      <div
        v-for="(chunk, chunkIndex) in chunks"
        :key="chunkIndex"
        class="bg-white shadow-xl overflow-hidden relative group"
      >
        <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton size="xs" color="gray" icon="i-heroicons-camera" @click="downloadChunk(chunkIndex)">
            下载此图
          </UButton>
        </div>

        <!-- 9:16，9×16=144 格，每格正方形，仅 logo 铺满 -->
        <div
          class="w-full aspect-[9/16] bg-white grid grid-cols-9 grid-rows-[repeat(16,minmax(0,1fr))] gap-0"
        >
          <div
            v-for="(shop, itemIndex) in chunk"
            :key="shop?.shop_id ?? `e-${itemIndex}`"
            class="relative min-h-0 w-full h-full overflow-hidden"
          >
            <img
              v-if="shop?.shop_logo"
              :src="getImageUrl(shop.shop_logo)"
              :alt="shop.shop_name"
              class="w-full h-full object-cover block"
              loading="lazy"
              crossorigin="anonymous"
            />
            <div v-else class="w-full h-full bg-gray-100 flex items-center justify-center">
              <UIcon name="i-heroicons-photo" class="text-gray-300 text-lg" />
            </div>
          </div>
        </div>

        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">店铺拼图 - P{{ chunkIndex + 1 }}</div>
      </div>
    </div>

    <div v-if="!loading && list.length === 0" class="text-center py-20 text-gray-500">暂无店铺数据</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getShopList } from '@/api/shop'
import { BASE_IMG } from '@/utils/ipConfig'
import type { Shop } from '@/types/api'

const GRID_COLS = 9
/** 9×16 格，与 9:16 画布的方形单元格一致 */
const CELLS_PER_CHUNK = 144

const searchInput = ref('')
const keyword = ref('')
const list = ref<Shop[]>([])
const loading = ref(false)
const isDownloading = ref(false)
const chunks = computed(() => {
  const rows: (Shop | null)[][] = []
  for (let i = 0; i < list.value.length; i += CELLS_PER_CHUNK) {
    const slice = list.value.slice(i, i + CELLS_PER_CHUNK)
    const padded: (Shop | null)[] = [...slice]
    while (padded.length < CELLS_PER_CHUNK) {
      padded.push(null)
    }
    rows.push(padded)
  }
  return rows
})

const getImageUrl = (path?: string | null) => {
  if (!path) return `${BASE_IMG}static/plan_cover/default.jpg`
  return `${BASE_IMG}${path}`
}

const applySearch = () => {
  keyword.value = searchInput.value.trim()
  fetchData()
}

const fetchData = async () => {
  loading.value = true
  list.value = []
  try {
    const pageSize = 144
    let page = 1
    let total = Number.POSITIVE_INFINITY
    const rows: Shop[] = []
    while (rows.length < total) {
      const res = await getShopList({
        page,
        pageSize,
        keyword: keyword.value || undefined
      })
      total = res.count ?? 0
      const batch = res.rows ?? []
      if (!batch.length) break
      rows.push(...batch)
      page += 1
      if (batch.length < pageSize) break
    }
    list.value = rows
  } catch (e) {
    console.error(e)
    useToast().add({ title: '获取店铺列表失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** object-cover：在正方形 dst 内铺满 */
const drawLogoCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number
) => {
  let sWidth = img.width
  let sHeight = img.height
  let sx = 0
  let sy = 0
  const imgAspect = sWidth / sHeight
  if (imgAspect > 1) {
    const nw = sHeight
    sx = (sWidth - nw) / 2
    sWidth = nw
  } else if (imgAspect < 1) {
    const nh = sWidth
    sy = (sHeight - nh) / 2
    sHeight = nh
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, size, size)
}

const downloadChunk = async (index: number) => {
  const chunkData = chunks.value[index]
  if (!chunkData?.length) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = 1080
  const height = Math.round((width * 16) / 9)
  canvas.width = width
  canvas.height = height

  const cell = width / GRID_COLS

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  for (let i = 0; i < chunkData.length; i++) {
    const shop = chunkData[i]
    const row = Math.floor(i / GRID_COLS)
    const col = i % GRID_COLS
    const x = col * cell
    const y = row * cell

    if (!shop || !shop.shop_logo) {
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(x, y, cell, cell)
      continue
    }

    try {
      const img = await loadImage(getImageUrl(shop.shop_logo))
      drawLogoCover(ctx, img, x, y, cell)
    } catch {
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(x, y, cell, cell)
    }
  }

  const link = document.createElement('a')
  link.download = `店铺拼图_${keyword.value || 'all'}_${index + 1}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

const handleDownloadAll = async () => {
  if (chunks.value.length === 0) return
  isDownloading.value = true
  const toast = useToast()
  toast.add({ title: '开始批量绘制并下载…', color: 'blue' })
  try {
    for (let i = 0; i < chunks.value.length; i++) {
      await downloadChunk(i)
      await new Promise((r) => setTimeout(r, 400))
    }
    toast.add({ title: '下载完成', color: 'green' })
  } catch (e) {
    console.error(e)
    toast.add({ title: '下载出错', color: 'red' })
  } finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  fetchData()
})

useHead({
  title: '店铺拼图生成',
  meta: [
    { name: 'description', content: '按列表生成 9:16 店铺 logo 拼图（每图 144 格）' }
  ]
})
</script>

<style scoped>
.aspect-\[9\/16\] {
  aspect-ratio: 9 / 16;
}
</style>
