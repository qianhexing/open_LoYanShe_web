<script setup lang="ts">
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import type { LaxianInterface } from '@/types/sence'


// 模型项接口（与 SPZModelViewerContent 保持一致）
interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    options?: Record<string, unknown>
}
import { getLibraryVideoById, getLibraryVideo } from '@/api/library'
import type { LibraryVideo, LaxianItem } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { BASE_IMG } from '@/utils/ipConfig'

// 设置页面标题
useHead({
    title: '模型查看器 - Lo研社',
    meta: [
        {
            name: 'description',
            content: 'Lo研社模型查看器'
        }
    ]
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const route = useRoute()
const router = useRouter()
const id = computed(() => (route.params.id as string) ?? '')

// 编辑模式：通过地址栏 edit=1 开启
const isEditMode = computed(() => route.query.edit ? true : false)

// library_id 来自 query 参数，用于获取同图鉴下的所有人台图列表
const libraryId = computed(() => {
    const q = route.query.library_id
    if (typeof q === 'string' && q) {
        const num = Number.parseInt(q, 10)
        return Number.isNaN(num) ? null : num
    }
    return null
})

// 同图鉴下的点云视频列表（pk_type === 2）
const libraryVideoList = ref<LibraryVideo[]>([])
const libraryVideoListLoading = ref(false)
const libraryListExpanded = ref(true)

const loadLibraryVideoList = async () => {
    const lid = libraryId.value
    if (!lid) return
    try {
        libraryVideoListLoading.value = true
        const list = await getLibraryVideo({ pk_id: lid })
        libraryVideoList.value = list.filter((item) => item.pk_type === 2)
    } catch (err) {
        console.error('加载图鉴人台图列表失败:', err)
        libraryVideoList.value = []
    } finally {
        libraryVideoListLoading.value = false
    }
}

const handleVideoSelect = (item: LibraryVideo) => {
    const vid = item.video_id
    if (vid == null) return
    const lid = libraryId.value
    const url = lid ? `/humanPlatform/${vid}?library_id=${lid}` : `/humanPlatform/${vid}`
    router.push(url)
}

const initVideoAndList = async () => {
    if (!layoutReady.value) return
    const lid = libraryId.value
    const isDefaultFirst = id.value === '0' && lid
    if (isDefaultFirst) {
        await loadLibraryVideoList()
        const first = libraryVideoList.value[0]
        if (first?.video_id != null) {
            await loadVideoData(first.video_id)
            router.replace(`/humanPlatform/${first.video_id}?library_id=${lid}`)
        } else {
            loading.value = false
            error.value = '该图鉴暂无点云人台图'
        }
    } else {
        loadVideoData()
    }
    if (lid) loadLibraryVideoList()
}
watch(layoutReady, (newVal) => {
    if (newVal) initVideoAndList()
})
watch(isEditMode, (val) => {
    if (val && laxianListFromVideo.value.length > 0) {
        editableLaxianList.value = laxianListFromVideo.value.map((item) => ({ ...item }))
    }
})
watch(libraryId, (val) => {
    if (val && layoutReady.value) loadLibraryVideoList()
}, { immediate: true })

// 视频数据
const libraryVideo = ref<LibraryVideo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// 模型列表
const modelList = ref<ModelItem[]>([])

// 拉线列表（从 video.json_data.laxian_list 加载）
const laxianListFromVideo = ref<LaxianItem[]>([])
// 编辑模式下的可编辑拉线列表（本地修改）
const editableLaxianList = ref<LaxianItem[]>([])

// 加载视频数据（可选传入 videoId，用于 id=0 时加载第一个场景）
const loadVideoData = async (videoIdOverride?: number) => {
    const vid = videoIdOverride ?? (id.value ? Number.parseInt(id.value, 10) : Number.NaN)
    if (Number.isNaN(vid) || vid < 0) {
        error.value = '缺少视频ID'
        return
    }

    try {
        loading.value = true
        error.value = null
        libraryVideo.value = await getLibraryVideoById({ video_id: vid })
        
        // 检查是否是点云类型
        if (libraryVideo.value.pk_type === 2 && libraryVideo.value.addr) {
            // 从 json_data 加载拉线（先设置拉线，再设置模型，确保 watch 时数据完整）
            const list = libraryVideo.value.json_data?.laxian_list
            laxianListFromVideo.value = Array.isArray(list) ? list : []
            if (isEditMode.value) {
                editableLaxianList.value = (Array.isArray(list) ? list : []).map((item) => ({ ...item }))
            }
            // 解析模型地址
            const modelUrls = libraryVideo.value.addr.split(',').filter(url => url.trim())
            modelList.value = modelUrls.map((url, index) => ({
                url: url.trim(),
                type: 'splat' as const,
                position: [index * 3, 0, 0] as [number, number, number],
                options: {
                    useDracoLoader: true,
                    dracoDecoderPath: '/draco/gltf/'
                }
            }))
        } else {
            laxianListFromVideo.value = []
            error.value = '该视频不是点云类型或缺少模型地址'
        }
    } catch (err) {
        console.error('加载视频数据失败:', err)
        error.value = err instanceof Error ? err.message : '加载视频数据失败'
    } finally {
        loading.value = false
    }
}

// 关闭查看器
const handleClose = () => {
    router.back()
}

// 吐槽
const handleFeedback = () => {
    // TODO: 打开吐槽/反馈入口
}

// 传给查看器的拉线列表（编辑模式用可编辑列表）
const laxianListForViewer = computed(() =>
    isEditMode.value ? editableLaxianList.value : laxianListFromVideo.value
)

// 拉线点列表（从 SPZModelViewerContent 暴露）
const viewerRef = ref<InstanceType<typeof SPZModelViewerContent> | null>(null)
const laxianList = computed<LaxianInterface[]>(() => {
    const raw = viewerRef.value?.laxianList
    if (!raw) return []
    return (raw as { value?: LaxianInterface[] }).value ?? (Array.isArray(raw) ? raw : [])
})

// ===== 编辑模式：拉线数据制作 =====
const addLaxianPoint = () => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core?.controls?.target) return
    const t = core.controls.target
    const pos: [number, number, number] = [t.x, t.y, t.z]
    const laxianId = `edit_${Date.now()}`
    const newItem: LaxianItem = {
        position: pos,
        title: '新拉线点',
        laxian_id: laxianId,
        type: 0
    }
    editableLaxianList.value = [...editableLaxianList.value, newItem]
    core.addLaxianToScene?.({
        position: pos,
        title: newItem.title,
        laxian_id: newItem.laxian_id,
        type: newItem.type,
        camera: newItem.camera
    })
}

const saveCameraForLaxian = (item: LaxianItem) => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core?.camera || !core?.controls?.target) return
    const cam = core.camera as { position: { x: number; y: number; z: number } }
    const target = core.controls.target
    const cameraState = {
        position: [cam.position.x, cam.position.y, cam.position.z] as [number, number, number],
        target: [target.x, target.y, target.z] as [number, number, number]
    }
    const list = editableLaxianList.value
    const idx = list.findIndex((l) => l.laxian_id === item.laxian_id)
    if (idx >= 0) {
        list[idx] = { ...list[idx], camera: cameraState }
        editableLaxianList.value = [...list]
    }
    core.updateLaxianById?.(item.laxian_id, { camera: cameraState })
}

const removeLaxian = (item: LaxianItem) => {
    const core = viewerRef.value?.getThreeCore?.()
    core?.removeLaxianById?.(item.laxian_id)
    editableLaxianList.value = editableLaxianList.value.filter((l) => l.laxian_id !== item.laxian_id)
}

const updateLaxianItem = (item: LaxianItem, updates: Partial<Pick<LaxianItem, 'title' | 'type'>>) => {
    const list = editableLaxianList.value
    const idx = list.findIndex((l) => l.laxian_id === item.laxian_id)
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates }
        editableLaxianList.value = [...list]
    }
    const core = viewerRef.value?.getThreeCore?.()
    if ((updates.title !== undefined || updates.type !== undefined) && core) {
        core?.updateLaxianById?.(item.laxian_id, {
            title: updates.title ?? list[idx]?.title,
            type: updates.type ?? list[idx]?.type
        })
    }
}

const copyLaxianJson = async () => {
    const json = JSON.stringify(
        { laxian_list: editableLaxianList.value },
        null,
        2
    )
    try {
        await navigator.clipboard.writeText(json)
        useToast().add({ title: '已复制到剪贴板', color: 'green' })
    } catch {
        useToast().add({ title: '复制失败', color: 'red' })
    }
}

// 拉线类型显示开关：0 设计元素，1 柄图元素
const showType0 = ref(true)
const showType1 = ref(true)
const showLaxianModal = ref(false)
const laxianModalPosition = ref({ x: 0, y: 0 })
const openLaxianModal = (e: MouseEvent) => {
    laxianModalPosition.value = { x: e.clientX, y: e.clientY }
    showLaxianModal.value = true
}

// 是否开启自动旋转
const autoRotateEnabled = ref(false)

// 屏幕中线，用于判断拉线方向
const screenCenterX = ref(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const screenHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)
const updateScreenCenter = () => {
    screenCenterX.value = window.innerWidth / 2
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
}
onMounted(() => {
    updateScreenCenter()
    window.addEventListener('resize', updateScreenCenter)
})
onUnmounted(() => {
    window.removeEventListener('resize', updateScreenCenter)
})

// 标签安全区域：上（避开拉线按钮）、下边距
const LABEL_SAFE_TOP = 56
const LABEL_SAFE_BOTTOM = 32
const LABEL_EDGE_OFFSET = 12
const LABEL_MAX_WIDTH = 140
const LABEL_HEIGHT = 70

const configStore = useConfigStore()

// 按侧边均匀分布后的拉线数据（含 displayTop、lineEnd）
interface LaxianWithLayout extends LaxianInterface {
    displayTop: number
    lineEnd: { x: number; y: number }
}
const laxianWithLayout = computed<LaxianWithLayout[]>(() => {
    const list = laxianList.value
    if (list.length === 0) return []

    // 按类型开关过滤
    const filtered = list.filter((item) => {
        const t = item.type ?? 0
        return (t === 0 && showType0.value) || (t === 1 && showType1.value)
    })
    if (filtered.length === 0) return []

    const centerX = screenCenterX.value
    const innerHeight = screenHeight.value
    const innerWidth = screenWidth.value
    const safeTop = LABEL_SAFE_TOP + configStore.statusBarHeight
    const availableRange = innerHeight - safeTop - LABEL_SAFE_BOTTOM - LABEL_HEIGHT

    const left = filtered
        .filter((item) => (item.edgePosition?.x ?? 0) < centerX)
        .map((item) => ({ item, y: item.edgePosition?.y ?? 0 }))
        .sort((a, b) => a.y - b.y)

    const right = filtered
        .filter((item) => (item.edgePosition?.x ?? 0) >= centerX)
        .map((item) => ({ item, y: item.edgePosition?.y ?? 0 }))
        .sort((a, b) => a.y - b.y)

    const assignLayout = (
        group: { item: LaxianInterface; y: number }[],
        isLeft: boolean
    ): LaxianWithLayout[] => {
        if (group.length === 0) return []
        const count = group.length
        const step = count > 1 ? availableRange / (count - 1) : availableRange / 2
        const edgeX = isLeft
            ? LABEL_EDGE_OFFSET + LABEL_MAX_WIDTH
            : innerWidth - LABEL_EDGE_OFFSET - LABEL_MAX_WIDTH

        return group.map((g, i) => {
            const displayTop = safeTop + (count > 1 ? i * step : availableRange / 2)
            const labelCenterY = displayTop + LABEL_HEIGHT / 2
            return {
                ...g.item,
                displayTop,
                lineEnd: { x: edgeX, y: labelCenterY }
            }
        })
    }

    return [...assignLayout(left, true), ...assignLayout(right, false)]
})

// 页面加载时获取数据
onMounted(() => {
    if (layoutReady.value) initVideoAndList()
})

// Canvas 拉线绘制（含 300ms 缓动，与标题层一致）
const canvasRef = ref<HTMLCanvasElement | null>(null)
let rafId = 0
const LAXIAN_DURATION = 300
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

// 每个拉线的插值状态 key=laxian_id|index
const currentLineEnd = new Map<
    string,
    {
        x: number
        y: number
        startX: number
        startY: number
        startTime: number
        lastTargetX: number
        lastTargetY: number
    }
>()

const lerpLineEnd = (
    key: string,
    targetX: number,
    targetY: number,
    now: number
): { x: number; y: number } => {
    const cur = currentLineEnd.get(key)
    if (!cur) {
        currentLineEnd.set(key, {
            x: targetX,
            y: targetY,
            startX: targetX,
            startY: targetY,
            startTime: now,
            lastTargetX: targetX,
            lastTargetY: targetY
        })
        return { x: targetX, y: targetY }
    }
    if (cur.lastTargetX !== targetX || cur.lastTargetY !== targetY) {
        cur.startX = cur.x
        cur.startY = cur.y
        cur.startTime = now
        cur.lastTargetX = targetX
        cur.lastTargetY = targetY
    }
    const dx = targetX - cur.startX
    const dy = targetY - cur.startY
    const elapsed = now - cur.startTime
    if (elapsed >= LAXIAN_DURATION) {
        cur.x = targetX
        cur.y = targetY
        cur.startX = targetX
        cur.startY = targetY
        return { x: targetX, y: targetY }
    }
    const progress = easeOutCubic(elapsed / LAXIAN_DURATION)
    cur.x = cur.startX + dx * progress
    cur.y = cur.startY + dy * progress
    return { x: cur.x, y: cur.y }
}

const drawLaxianCanvas = () => {
    const canvas = canvasRef.value
    if (!canvas) {
        rafId = requestAnimationFrame(drawLaxianCanvas)
        return
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const w = window.innerWidth
    const h = window.innerHeight

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
        rafId = requestAnimationFrame(drawLaxianCanvas)
        return
    }

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    if (laxianWithLayout.value.length === 0) {
        currentLineEnd.clear()
        ctx.restore()
        rafId = requestAnimationFrame(drawLaxianCanvas)
        return
    }

    const list = laxianWithLayout.value
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

    // 清除已不存在的 key
    const keys = new Set(list.map((item, i) => item.laxian_id ?? `idx-${i}`))
    for (const k of currentLineEnd.keys()) {
        if (!keys.has(k)) currentLineEnd.delete(k)
    }

    // 拉线颜色：0 设计元素-紫色，1 柄图元素-青色
    const type0Line = 'rgba(147, 51, 234, 0.6)'
    const type0Dot = 'rgba(147, 51, 234, 0.8)'
    const type1Line = 'rgba(20, 184, 166, 0.6)'
    const type1Dot = 'rgba(20, 184, 166, 0.8)'

    for (let i = 0; i < list.length; i++) {
        const item = list[i]
        const key = item.laxian_id ?? `idx-${i}`
        const x1 = item.position?.x ?? 0
        const y1 = item.position?.y ?? 0
        const end = lerpLineEnd(key, item.lineEnd.x, item.lineEnd.y, now)
        const x2 = end.x
        const y2 = end.y
        const t = item.type ?? 0
        const lineColor = t === 1 ? type1Line : type0Line
        const dotColor = t === 1 ? type1Dot : type0Dot

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x1, y1, 5, 0, Math.PI * 2)
        ctx.strokeStyle = dotColor
        ctx.lineWidth = 2
        ctx.stroke()
    }

    ctx.restore()
    rafId = requestAnimationFrame(drawLaxianCanvas)
}

onMounted(() => {
    rafId = requestAnimationFrame(drawLaxianCanvas)
})

onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
    <div class="fixed inset-0 w-full h-full bg-white z-50">
        <!-- 数据加载中 -->
        <div
            v-if="loading"
            class="w-full h-full flex flex-col items-center justify-center"
        >
            <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
            <p class="mt-4 text-purple-600 tracking-widest font-bold">正在加载数据...</p>
        </div>

        <!-- 数据加载错误 -->
        <div
            v-else-if="error"
            class="w-full h-full flex flex-col items-center justify-center"
        >
            <div class="flex flex-col items-center gap-4">
                <div class="w-16 h-16 flex items-center justify-center">
                    <UIcon name="material-symbols:error-outline" class="text-6xl text-red-500" />
                </div>
                <p class="text-red-600 font-bold text-lg">加载失败</p>
                <p class="text-gray-600 text-sm max-w-md text-center px-4">{{ error }}</p>
                <UButton color="purple" @click="loadVideoData" class="mt-2">
                    重试
                </UButton>
                <UButton color="gray" @click="handleClose" class="mt-2">
                    返回
                </UButton>
            </div>
        </div>

        <!-- threejs 内容区域 -->
        <client-only v-else>
            <SPZModelViewerContent
                ref="viewerRef"
                :model-list="modelList"
                :laxian-list="laxianListForViewer"
                :auto-rotate="autoRotateEnabled"
                :edit-mode="isEditMode"
            />
            <!-- 功能栏 -->
            <div
                class="fixed left-3 z-30 flex items-center gap-2 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 p-1"
                :style="{ top: `${12 + configStore.statusBarHeight}px` }"
            >
                <button
                    v-if="laxianList.length > 0"
                    type="button"
                    class="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-purple-600 dark:text-purple-400"
                    title="拉线设置"
                    @click="openLaxianModal"
                >
                    <UIcon name="material-symbols:timeline" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">拉线</span>
                </button>
                <button
                    type="button"
                    class="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                    :class="autoRotateEnabled ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'"
                    :title="autoRotateEnabled ? '关闭自动旋转' : '开启自动旋转'"
                    @click="autoRotateEnabled = !autoRotateEnabled"
                >
                    <UIcon name="material-symbols:rotate-right" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">自动旋转</span>
                </button>
                <button
                    type="button"
                    class="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-gray-600 dark:text-gray-400"
                    title="吐槽"
                    @click="handleFeedback"
                >
                    <UIcon name="material-symbols:chat-bubble-outline" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">吐槽</span>
                </button>
                {{ isEditMode }}
            </div>
            <!-- 悬浮人台图列表：有 library_id 时显示，可收缩展开 -->
            <div
                v-if="libraryId && !loading && !error"
                class="fixed right-0 z-30 flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
                :class="libraryListExpanded
                    ? 'top-1/2 -translate-y-1/2 max-h-[70vh] w-[180px] sm:w-[200px] md:w-[220px]'
                    : 'top-1/2 -translate-y-1/2 max-h-[70vh] w-[44px] sm:w-[52px]'"
            >
                <button
                    type="button"
                    class="flex items-center justify-center gap-1.5 py-2.5 px-2 shrink-0 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors"
                    :class="libraryListExpanded ? 'border-b border-gray-100 dark:border-gray-600' : 'min-h-[48px]'"
                    :title="libraryListExpanded ? '收起列表' : '展开列表'"
                    @click="libraryListExpanded = !libraryListExpanded"
                >
                    <UIcon
                        :name="libraryListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:view-module'"
                        class="text-xl sm:text-2xl transition-transform"
                        :class="libraryListExpanded ? '' : 'rotate-90'"
                    />
                    <span v-if="libraryListExpanded" class="text-xs font-medium hidden sm:inline">人台图</span>
                </button>
                <div
                    v-show="libraryListExpanded"
                    class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0"
                >
                    <div v-if="libraryVideoListLoading" class="flex items-center justify-center py-6">
                        <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                    </div>
                    <template v-else-if="libraryVideoList.length > 0">
                        <button
                            v-for="item in libraryVideoList"
                            :key="item.video_id"
                            type="button"
                            class="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
                            :class="Number(id) === item.video_id ? 'bg-purple-100 dark:bg-purple-900/30 ring-1 ring-purple-200 dark:ring-purple-700' : ''"
                            @click="handleVideoSelect(item)"
                        >
                            <div class="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                                <img
                                    v-if="item.cover"
                                    :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200,h_200`"
                                    :alt="item.title || ''"
                                    class="w-full h-full object-cover"
                                />
                                <div v-else class="w-full h-full flex items-center justify-center">
                                    <UIcon name="i-heroicons-cube" class="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <div class="flex-1 min-w-0 block">
                                <span class="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{{ item.title || '3D' }}</span>
                            </div>
                        </button>
                    </template>
                    <div v-else class="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                        暂无点云人台图
                    </div>
                </div>
            </div>
            <!-- 拉线点 overlay：Canvas 层（仅展示，忽略点击触摸） -->
            <div class="fixed inset-0 pointer-events-none z-10" v-show="laxianWithLayout.length > 0">
                <canvas
                    ref="canvasRef"
                    class="absolute inset-0 w-full h-full block"
                />
            </div>
            <!-- 拉线点 overlay：标题层（显示在 Canvas 上层） -->
            <div class="fixed inset-0 pointer-events-none z-20" v-show="laxianWithLayout.length > 0">
                <div
                    v-for="(item, i) in laxianWithLayout"
                    :key="'label-' + (item.laxian_id ?? i)"
                    class="absolute p-2 px-3 pointer-events-auto cursor-pointer bg-qhx-bg-card/95 dark:bg-qhx-bg-card-dark/95 rounded-2xl shadow-lg text-sm w-[130px] line-clamp-3 laxian-label transition-all duration-300 ease-out hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    :style="{
                        top: item.displayTop + 20 + 'px',
                        left: (item.edgePosition?.x ?? 0) < screenCenterX ? '12px' : 'calc(100% - 142px)'
                    }"
                    @click="viewerRef?.focusLaxianCamera?.(item)"
                >
                    {{ item.title }}
                </div>
            </div>
            <!-- 拉线设置弹窗 -->
            <!-- 编辑模式：拉线数据制作面板 -->
            <div
                v-if="isEditMode && !loading && !error"
                class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100vw-2rem)] rounded-2xl bg-white/95 dark:bg-gray-800/95 shadow-xl border border-gray-200/50 dark:border-gray-600/50 p-4 backdrop-blur-sm"
            >
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">拉线数据编辑</h3>
                    <div class="flex items-center gap-2">
                        <UButton size="xs" color="primary" @click="addLaxianPoint">
                            <UIcon name="material-symbols:add" class="mr-1" />
                            添加拉线点
                        </UButton>
                        <UButton size="xs" color="gray" variant="soft" @click="copyLaxianJson">
                            <UIcon name="material-symbols:content-copy" class="mr-1" />
                            复制 JSON
                        </UButton>
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    旋转视角至目标位置后点击「添加拉线点」，可在列表中编辑标题、类型，点击「保存镜头」记录当前视角
                </p>
                <div class="max-h-48 overflow-y-auto space-y-2">
                    <div
                        v-for="(item, i) in editableLaxianList"
                        :key="item.laxian_id ?? i"
                        class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                        <input
                            v-model="item.title"
                            type="text"
                            class="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                            placeholder="标题"
                            @blur="updateLaxianItem(item, { title: item.title })"
                        />
                        <select
                            :value="item.type ?? 0"
                            class="px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                            @change="(e) => updateLaxianItem(item, { type: Number((e.target as HTMLSelectElement).value) as 0 | 1 })"
                        >
                            <option :value="0">设计元素</option>
                            <option :value="1">柄图元素</option>
                        </select>
                        <UButton size="xs" color="gray" variant="ghost" title="保存当前镜头到此点" @click="saveCameraForLaxian(item)">
                            <UIcon name="material-symbols:photo-camera" />
                        </UButton>
                        <UButton size="xs" color="red" variant="ghost" title="删除" @click="removeLaxian(item)">
                            <UIcon name="material-symbols:delete-outline" />
                        </UButton>
                    </div>
                    <div v-if="editableLaxianList.length === 0" class="text-center py-4 text-sm text-gray-400">
                        暂无拉线点，点击「添加拉线点」开始制作
                    </div>
                </div>
            </div>
            <QhxModal v-model="showLaxianModal" :trigger-position="laxianModalPosition" @close="showLaxianModal = false">
                <div class="p-6 w-[240px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">拉线显示</h3>
                    <div class="space-y-3">
                        <label class="flex items-center justify-between gap-3 cursor-pointer">
                            <span class="text-sm text-gray-700 dark:text-gray-300">设计元素</span>
                            <UToggle v-model="showType0" />
                        </label>
                        <label class="flex items-center justify-between gap-3 cursor-pointer">
                            <span class="text-sm text-gray-700 dark:text-gray-300">柄图元素</span>
                            <UToggle v-model="showType1" />
                        </label>
                    </div>
                </div>
            </QhxModal>
        </client-only>
    </div>
</template>

<style scoped>
#spz-scene-viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
}

/* 拉线标签左右切换、上下移动时的平滑过渡 */
.laxian-label {
    transition-property: left, top, transform;
    transition-duration: 0.35s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
