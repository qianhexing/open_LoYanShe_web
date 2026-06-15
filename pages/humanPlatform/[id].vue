<script setup lang="ts">
// biome-ignore lint/style/useImportType: Vue SFC 供 template 与 InstanceType 使用
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'
import type { RichTextToolbarItem } from '@/components/Qhx/RichTextEditor.vue'
import SafeRichText from '@/components/SafeRichText.vue'
import type { LaxianInterface } from '@/types/sence'
import { parseRichText } from '@/utils/public'


// 模型项接口（与 SPZModelViewerContent 保持一致）
interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    /** Spark 2.0（@sparkjsdev/spark）：`type === 'splat'` 时仅 `fileType`、`maxSplats`、`maxSh`、`mobileOptimized` 会传入 loadSplat；与 GLTF 无关，勿传 useDracoLoader。 */
    options?: Record<string, unknown>
}
import { getLibraryVideoById, getLibraryVideo, updateLibraryVideoJson, getLibrarySimilar } from '@/api/library'
import type { LibraryVideo, LaxianItem, LaxianInitialCamera, LibrarySimilarItem } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { BASE_IMG } from '@/utils/ipConfig'
import * as THREE from 'three'

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
const isEditMode = computed(() => Boolean(route.query.edit))

// library_id：优先地址栏 query，否则从当前 video 的 pk_id 获取
const queryLibraryId = computed(() => {
    const q = route.query.library_id
    if (typeof q === 'string' && q) {
        const num = Number.parseInt(q, 10)
        return Number.isNaN(num) ? null : num
    }
    return null
})

// 视频数据（需在 effectiveLibraryId 之前声明）
const libraryVideo = ref<LibraryVideo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const effectiveLibraryId = computed(() => {
    if (queryLibraryId.value != null) return queryLibraryId.value
    const pk = libraryVideo.value?.pk_id
    if (pk == null) return null
    const num = typeof pk === 'number' ? pk : Number.parseInt(String(pk), 10)
    return Number.isNaN(num) ? null : num
})

// 同图鉴下的点云视频列表（pk_type === 2）
const libraryVideoList = ref<LibraryVideo[]>([])
const libraryVideoListLoading = ref(false)
const libraryListExpanded = ref(true)

// ===== 相似推荐（右下角角标，点击后展开并请求） =====
const similarExpanded = ref(false)
const similarLoading = ref(false)
const similarRows = ref<LibrarySimilarItem[]>([])
const similarFetched = ref(false)

const similarPanelBottom = computed(() => (isEditMode.value ? 200 : 16))

const formatSimilarityScore = (score: number) => {
    if (score >= 0 && score <= 1) {
        return `${(score * 100).toFixed(0)}%`
    }
    return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

const resetSimilarRecommend = () => {
    similarExpanded.value = false
    similarRows.value = []
    similarFetched.value = false
    similarLoading.value = false
}

const fetchSimilarLibraries = async () => {
    const lid = effectiveLibraryId.value
    if (!lid) return
    similarLoading.value = true
    try {
        const res = await getLibrarySimilar({ library_id: lid, pageSize: 20 })
        similarRows.value = (res.rows ?? []).filter((r) => r.library_id !== lid)
        similarFetched.value = true
    } catch (err) {
        console.error('加载相似推荐失败:', err)
        similarRows.value = []
        similarFetched.value = true
    } finally {
        similarLoading.value = false
    }
}

const toggleSimilarRecommend = async () => {
    if (similarExpanded.value) {
        similarExpanded.value = false
        return
    }
    similarExpanded.value = true
    if (!similarFetched.value && !similarLoading.value) {
        await fetchSimilarLibraries()
    }
}

const openSimilarLibrary = (targetLibraryId: number) => {
    if (!targetLibraryId) return
    router.push(`/library/detail/${targetLibraryId}`)
}

const loadLibraryVideoList = async () => {
    const lid = effectiveLibraryId.value
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
    const lid = effectiveLibraryId.value
    const url = lid ? `/humanPlatform/${vid}?library_id=${lid}` : `/humanPlatform/${vid}`
    router.push(url)
}

const initVideoAndList = async () => {
    if (!layoutReady.value) return
    const lid = queryLibraryId.value
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
    if (val) {
        editableInitialCameraList.value = initialCameraList.value.map((item) => ({ ...item }))
    }
})

// 同人台站内切换路由 /humanPlatform/:id 时需重新拉取视频（否则会一直显示上一份 modelList）
watch(
    () => id.value,
    (next, prev) => {
        if (!layoutReady.value || next === prev) return
        const isDefaultLanding = next === '0' && Boolean(queryLibraryId.value)
        if (isDefaultLanding) {
            void initVideoAndList()
            return
        }
        void loadVideoData()
    }
)

// 模型列表
const modelList = ref<ModelItem[]>([])

// 拉线列表（从 video.json_data.laxian_list 加载）
const laxianListFromVideo = ref<LaxianItem[]>([])
// 编辑模式下的可编辑拉线列表（本地修改）
const editableLaxianList = ref<LaxianItem[]>([])
// 初始镜头（json_data.cameraList，仅使用第一项）
const initialCameraList = ref<LaxianInitialCamera[]>([])
const editableInitialCameraList = ref<LaxianInitialCamera[]>([])

const normalizeInitialCamera = (raw: unknown): LaxianInitialCamera | null => {
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    const toTuple = (value: unknown): [number, number, number] | null => {
        if (Array.isArray(value) && value.length >= 3) {
            return [Number(value[0]), Number(value[1]), Number(value[2])]
        }
        if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
            const v = value as { x: number; y: number; z: number }
            return [v.x, v.y, v.z]
        }
        return null
    }
    const position = toTuple(item.position)
    const target = toTuple(item.target)
    if (!position || !target) return null
    return {
        position,
        target,
        ...(typeof item.fov === 'number' ? { fov: item.fov } : {})
    }
}

const normalizeInitialCameraList = (raw: unknown): LaxianInitialCamera[] => {
    if (!Array.isArray(raw)) return []
    const list: LaxianInitialCamera[] = []
    for (const item of raw) {
        const camera = normalizeInitialCamera(item)
        if (camera) list.push(camera)
    }
    return list
}

const hasInitialCamera = computed(() =>
    (isEditMode.value ? editableInitialCameraList.value : initialCameraList.value).length > 0
)

const initialCameraForViewer = computed(() =>
    isEditMode.value ? editableInitialCameraList.value : initialCameraList.value
)

watch(effectiveLibraryId, (val) => {
    resetSimilarRecommend()
    if (val && layoutReady.value) loadLibraryVideoList()
}, { immediate: true })

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
            const cameras = normalizeInitialCameraList(libraryVideo.value.json_data?.cameraList)
            initialCameraList.value = cameras
            if (isEditMode.value) {
                editableLaxianList.value = (Array.isArray(list) ? list : []).map((item) => ({ ...item }))
                editableInitialCameraList.value = cameras.map((item) => ({ ...item }))
            }
            // 解析模型地址
            // Spark 2.0（@sparkjsdev/spark）：点云由 ThreeCore.loadSplat / loadSceneFromJSON 加载。
            // splat 的 options 仅使用 fileType、maxSplats、maxSh、mobileOptimized（见 utils/threeCore.ts）；
            // 勿传 GLTF 的 useDracoLoader / dracoDecoderPath，否则会误导维护且对点云无效。
            // 文档：https://sparkjs.dev/docs/0.1-2.0-migration-guide/
            const modelUrls = libraryVideo.value.addr.split(',').filter(url => url.trim())
            modelList.value = modelUrls.map((url, index) => ({
                url: url.trim(),
                type: 'splat' as const,
                position: [index * 3, 0, 0] as [number, number, number],
                options: {}
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
    const dirX = cam.position.x - target.x
    const dirZ = cam.position.z - target.z
    const xzDist = Math.hypot(dirX, dirZ)
    const cameraState = {
        position: (xzDist < 1e-6
            ? [target.x, target.y, target.z + 3]
            : [target.x + dirX, target.y, target.z + dirZ]) as [number, number, number],
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

const setInitialCamera = () => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core?.camera || !core?.controls?.target) return
    const cam = core.camera
    const target = core.controls.target
    editableInitialCameraList.value = [{
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z],
        ...((cam as THREE.PerspectiveCamera).isPerspectiveCamera
            ? { fov: (cam as THREE.PerspectiveCamera).fov }
            : {})
    }]
    useToast().add({ title: '已设为初始镜头，记得点击保存', color: 'green' })
}

const previewInitialCamera = () => {
    const state = editableInitialCameraList.value[0]
    if (!state) {
        useToast().add({ title: '尚未设置初始镜头', color: 'orange' })
        return
    }
    const core = viewerRef.value?.getThreeCore?.()
    if (!core) return
    core.lookAtCameraState({
        position: new THREE.Vector3(...state.position),
        target: new THREE.Vector3(...state.target),
        ...(state.fov != null ? { fov: state.fov } : {})
    }, 800)
}

const clearInitialCamera = () => {
    editableInitialCameraList.value = []
    useToast().add({ title: '已清除初始镜头，记得点击保存', color: 'green' })
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

const savingLaxian = ref(false)

const saveLaxianJson = async () => {
    const videoId = libraryVideo.value?.video_id
    if (videoId == null) {
        useToast().add({ title: '缺少视频 ID', color: 'red' })
        return
    }
    try {
        savingLaxian.value = true
        const existingJsonData = libraryVideo.value?.json_data ?? {}
        const updated = await updateLibraryVideoJson({
            video_id: videoId,
            json_data: {
                ...existingJsonData,
                laxian_list: editableLaxianList.value,
                cameraList: editableInitialCameraList.value
            }
        })
        libraryVideo.value = updated
        laxianListFromVideo.value = editableLaxianList.value.map((item) => ({ ...item }))
        initialCameraList.value = editableInitialCameraList.value.map((item) => ({ ...item }))
        useToast().add({ title: '保存成功', color: 'green' })
    } catch (err) {
        console.error('保存拉线数据失败:', err)
        useToast().add({ title: '保存失败', color: 'red' })
    } finally {
        savingLaxian.value = false
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

// ===== 拉线点详情 =====
const laxianDetailToolbar: RichTextToolbarItem[] = ['bold', 'italic', 'strike', 'image', 'internalLink', 'emoji']
const expandedLaxianId = ref<string | null>(null)
const showLaxianDetailEdit = ref(false)
const detailModalPosition = ref({ x: 0, y: 0 })
const activeLaxianDetail = ref<LaxianItem | null>(null)
const laxianDetailEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)

const LABEL_COLLAPSED_WIDTH = 130
const LABEL_EXPANDED_WIDTH = 280

const getLaxianSourceList = () =>
    isEditMode.value ? editableLaxianList.value : laxianListFromVideo.value

const getLaxianById = (id?: string) =>
    id ? getLaxianSourceList().find((l) => l.laxian_id === id) : undefined

const getLaxianDetailNodesFor = (id?: string) => {
    const html = getLaxianById(id)?.detail
    if (!html?.trim()) return []
    try {
        return parseRichText(html)
    } catch {
        return []
    }
}

const hasLaxianDetailContent = (item?: LaxianItem | null) => Boolean(item?.detail?.trim())

const isLaxianExpanded = (id?: string) => Boolean(id && expandedLaxianId.value === id)

const laxianExpandedDetailNodes = computed(() =>
    getLaxianDetailNodesFor(expandedLaxianId.value ?? undefined)
)

const setDetailModalPosition = (e?: MouseEvent) => {
    detailModalPosition.value = e
        ? { x: e.clientX, y: e.clientY }
        : {
            x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
            y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0
        }
}

const handleLaxianLabelClick = (item: LaxianWithLayout) => {
    viewerRef.value?.focusLaxianCamera?.(item)
    const laxianId = item.laxian_id
    if (!laxianId) return
    expandedLaxianId.value = expandedLaxianId.value === laxianId ? null : laxianId
}

const openLaxianDetailEdit = (item: LaxianItem, e: MouseEvent) => {
    activeLaxianDetail.value = { ...item }
    setDetailModalPosition(e)
    showLaxianDetailEdit.value = true
}

const openLaxianDetailEditFromLabel = (item: LaxianWithLayout, e: MouseEvent) => {
    const src = getLaxianById(item.laxian_id) ?? { title: item.title, laxian_id: item.laxian_id }
    openLaxianDetailEdit(src, e)
}

watch(showLaxianDetailEdit, async (open) => {
    if (!open) return
    await nextTick()
    laxianDetailEditorRef.value?.setContentForEdit(activeLaxianDetail.value?.detail || '')
})

const saveLaxianDetailEdit = () => {
    const laxianId = activeLaxianDetail.value?.laxian_id
    if (!laxianId || !laxianDetailEditorRef.value) return
    const detail = laxianDetailEditorRef.value.getContent()
    const idx = editableLaxianList.value.findIndex((l) => l.laxian_id === laxianId)
    if (idx >= 0) {
        editableLaxianList.value[idx] = { ...editableLaxianList.value[idx], detail }
        editableLaxianList.value = [...editableLaxianList.value]
    }
    showLaxianDetailEdit.value = false
    useToast().add({ title: '详情已更新，记得点击保存', color: 'green' })
}

watch(
    () => id.value,
    () => {
        expandedLaxianId.value = null
    }
)

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

const getLaxianLabelStyle = (item: LaxianWithLayout) => {
    const isLeft = (item.edgePosition?.x ?? 0) < screenCenterX.value
    const expanded = isLaxianExpanded(item.laxian_id)
    const width = expanded ? LABEL_EXPANDED_WIDTH : LABEL_COLLAPSED_WIDTH
    return {
        top: `${item.displayTop + 20}px`,
        left: isLeft ? '12px' : `calc(100% - ${width + 12}px)`,
        width: `${width}px`
    }
}

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
                :initial-camera-list="initialCameraForViewer"
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
            </div>
            <!-- 悬浮人台图列表：有 library_id 时显示，可收缩展开 -->
            <div
                v-if="effectiveLibraryId && !loading && !error"
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
            <!-- 右下角：相似推荐角标（默认收起，点击展开横向滚动列表） -->
            <div
                v-if="effectiveLibraryId && !loading && !error"
                class="fixed right-3 z-40 flex flex-col items-end pointer-events-none"
                :style="{ bottom: `${similarPanelBottom}px` }"
            >
                <Transition name="similar-panel">
                    <div
                        v-if="similarExpanded"
                        class="pointer-events-auto mb-2 w-[min(calc(100vw-24px),520px)] rounded-2xl bg-white/95 dark:bg-gray-800/95 shadow-xl backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden"
                    >
                        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/80">
                            <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">相似推荐</span>
                            <button
                                type="button"
                                class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                                aria-label="收起相似推荐"
                                @click="similarExpanded = false"
                            >
                                <UIcon name="material-symbols:close" class="text-lg" />
                            </button>
                        </div>
                        <div v-if="similarLoading" class="flex items-center justify-center py-8">
                            <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                        </div>
                        <p
                            v-else-if="similarRows.length === 0"
                            class="py-6 text-center text-xs text-gray-400 dark:text-gray-500"
                        >
                            暂无相似图鉴
                        </p>
                        <div
                            v-else
                            class="flex gap-2.5 overflow-x-auto overscroll-x-contain px-3 py-3 similar-scroll"
                        >
                            <button
                                v-for="item in similarRows"
                                :key="item.library_id"
                                type="button"
                                class="flex-shrink-0 w-[100px] sm:w-[110px] text-left rounded-xl border border-gray-100 dark:border-gray-600/50 overflow-hidden bg-white dark:bg-gray-900/40 shadow-sm hover:shadow-md hover:ring-1 hover:ring-purple-200 dark:hover:ring-purple-700 transition-all"
                                :title="item.name"
                                @click="openSimilarLibrary(item.library_id!)"
                            >
                                <div class="relative aspect-[3/4] w-full bg-gray-100 dark:bg-gray-700">
                                    <img
                                        v-if="item.cover"
                                        :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_300,h_400`"
                                        :alt="item.name || ''"
                                        class="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <div v-else class="w-full h-full flex items-center justify-center">
                                        <UIcon name="i-heroicons-photo" class="w-6 h-6 text-gray-400" />
                                    </div>
                                    <span
                                        v-if="item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))"
                                        class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white"
                                    >
                                        {{ formatSimilarityScore(Number(item.similarity_score)) }}
                                    </span>
                                </div>
                                <div class="p-2 pt-1.5">
                                    <p class="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                                        {{ item.name }}
                                    </p>
                                    <p
                                        v-if="item.shop?.shop_name"
                                        class="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5"
                                    >
                                        {{ item.shop.shop_name }}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                </Transition>
                <button
                    type="button"
                    class="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 text-purple-600 dark:text-purple-400 hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                    :class="similarExpanded ? 'ring-2 ring-purple-300/70 dark:ring-purple-600/50' : ''"
                    :title="similarExpanded ? '收起相似推荐' : '相似推荐'"
                    @click="toggleSimilarRecommend"
                >
                    <UIcon name="material-symbols:recommend" class="text-lg" />
                    <span class="text-xs font-semibold">相似</span>
                </button>
            </div>
            <!-- 拉线点 overlay：Canvas 层（仅展示，忽略点击触摸） -->
            <div class="fixed inset-0 pointer-events-none z-10" v-show="laxianWithLayout.length > 0">
                <canvas
                    ref="canvasRef"
                    class="absolute inset-0 w-full h-full block"
                />
            </div>
            <!-- 拉线点 overlay：标题层（显示在 Canvas 上层，点击展开详情） -->
            <div class="fixed inset-0 pointer-events-none z-20" v-show="laxianWithLayout.length > 0">
                <div
                    v-for="(item, i) in laxianWithLayout"
                    :key="'label-' + (item.laxian_id ?? i)"
                    class="absolute pointer-events-auto laxian-label transition-all duration-300 ease-out"
                    :class="isLaxianExpanded(item.laxian_id)
                        ? 'z-30'
                        : 'z-20'"
                    :style="getLaxianLabelStyle(item)"
                >
                    <div
                        class="rounded-2xl shadow-lg text-sm bg-qhx-bg-card/95 dark:bg-qhx-bg-card-dark/95 overflow-hidden transition-all duration-300 ease-out hover:shadow-xl"
                        :class="isLaxianExpanded(item.laxian_id)
                            ? 'ring-2 ring-purple-300/70 dark:ring-purple-600/50'
                            : 'hover:scale-[1.02] active:scale-[0.98]'"
                    >
                        <button
                            type="button"
                            class="w-full p-2 px-3 text-left cursor-pointer flex items-start gap-1"
                            @click="handleLaxianLabelClick(item)"
                        >
                            <span
                                class="flex-1 font-medium text-gray-800 dark:text-gray-100"
                                :class="isLaxianExpanded(item.laxian_id) ? '' : 'line-clamp-3'"
                            >
                                {{ item.title }}
                            </span>
                            <UIcon
                                :name="isLaxianExpanded(item.laxian_id)
                                    ? 'material-symbols:expand-less'
                                    : (hasLaxianDetailContent(getLaxianById(item.laxian_id))
                                        ? 'material-symbols:expand-more'
                                        : 'material-symbols:chevron-right')"
                                class="text-base shrink-0 opacity-60 mt-0.5"
                            />
                        </button>
                        <Transition name="laxian-detail-expand">
                            <div
                                v-if="isLaxianExpanded(item.laxian_id)"
                                class="px-3 pb-3 border-t border-gray-100/80 dark:border-gray-600/50"
                                @click.stop
                            >
                                <template v-if="laxianExpandedDetailNodes.length > 0">
                                    <SafeRichText
                                        :nodes="laxianExpandedDetailNodes"
                                        class="text-xs text-gray-600 dark:text-gray-300 laxian-detail-rich pt-2 max-h-[40vh] overflow-y-auto overscroll-contain"
                                    />
                                </template>
                                <p v-else class="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">
                                    暂无详情
                                </p>
                                <div v-if="isEditMode" class="mt-2 flex justify-end">
                                    <UButton
                                        size="xs"
                                        color="primary"
                                        variant="soft"
                                        @click="openLaxianDetailEditFromLabel(item, $event)"
                                    >
                                        <UIcon name="material-symbols:edit-note" class="mr-1" />
                                        编辑详情
                                    </UButton>
                                </div>
                            </div>
                        </Transition>
                    </div>
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
                        <UButton
                            size="xs"
                            color="green"
                            :loading="savingLaxian"
                            :disabled="savingLaxian"
                            @click="saveLaxianJson"
                        >
                            <UIcon name="material-symbols:save" class="mr-1" />
                            保存
                        </UButton>
                        <UButton size="xs" color="gray" variant="soft" @click="copyLaxianJson">
                            <UIcon name="material-symbols:content-copy" class="mr-1" />
                            复制 JSON
                        </UButton>
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    调整视角后可「设为初始镜头」；添加拉线点、编辑详情，「保存镜头」记录各拉线点视角
                </p>
                <div class="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-lg bg-purple-50/80 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40">
                    <span class="text-xs font-medium text-purple-700 dark:text-purple-300">初始镜头</span>
                    <UButton size="xs" color="primary" variant="soft" @click="setInitialCamera">
                        <UIcon name="material-symbols:video-camera-front" class="mr-1" />
                        设为初始镜头
                    </UButton>
                    <UButton
                        size="xs"
                        color="gray"
                        variant="soft"
                        :disabled="!hasInitialCamera"
                        @click="previewInitialCamera"
                    >
                        <UIcon name="material-symbols:preview" class="mr-1" />
                        预览
                    </UButton>
                    <UButton
                        size="xs"
                        color="gray"
                        variant="ghost"
                        :disabled="!hasInitialCamera"
                        @click="clearInitialCamera"
                    >
                        清除
                    </UButton>
                    <span
                        class="text-[10px]"
                        :class="hasInitialCamera ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
                    >
                        {{ hasInitialCamera ? '已设置' : '未设置（默认平视）' }}
                    </span>
                </div>
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
                        <UButton size="xs" color="gray" variant="ghost" title="编辑详情" @click="openLaxianDetailEdit(item, $event)">
                            <UIcon name="material-symbols:edit-note" />
                        </UButton>
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
            <!-- 拉线点详情编辑（仅编辑模式） -->
            <QhxModal
                v-model="showLaxianDetailEdit"
                :trigger-position="detailModalPosition"
                @close="showLaxianDetailEdit = false"
            >
                <div class="p-4 w-[min(92vw,520px)] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                    <div class="flex items-center justify-between gap-3 mb-3">
                        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            编辑详情 · {{ activeLaxianDetail?.title || '拉线点' }}
                        </h3>
                        <button
                            type="button"
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                            @click="showLaxianDetailEdit = false"
                        >
                            <UIcon name="material-symbols:close" class="text-lg" />
                        </button>
                    </div>
                    <QhxRichTextEditor
                        ref="laxianDetailEditorRef"
                        placeholder="输入拉线点详情，支持图文与表情…"
                        :min-height="180"
                        :max-height="320"
                        :toolbar="laxianDetailToolbar"
                    />
                    <div class="flex justify-end gap-2 mt-3">
                        <UButton size="sm" color="gray" variant="soft" @click="showLaxianDetailEdit = false">
                            取消
                        </UButton>
                        <UButton size="sm" color="primary" @click="saveLaxianDetailEdit">
                            确定
                        </UButton>
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
    transition-property: left, top, width, transform;
    transition-duration: 0.35s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.laxian-detail-expand-enter-active,
.laxian-detail-expand-leave-active {
    transition: opacity 0.25s ease, max-height 0.3s ease;
    overflow: hidden;
}

.laxian-detail-expand-enter-from,
.laxian-detail-expand-leave-to {
    opacity: 0;
    max-height: 0;
}

.laxian-detail-expand-enter-to,
.laxian-detail-expand-leave-from {
    opacity: 1;
    max-height: 480px;
}

.laxian-detail-rich :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
}

.similar-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(147, 51, 234, 0.35) transparent;
}

.similar-scroll::-webkit-scrollbar {
    height: 4px;
}

.similar-scroll::-webkit-scrollbar-thumb {
    background: rgba(147, 51, 234, 0.35);
    border-radius: 999px;
}

.similar-panel-enter-active,
.similar-panel-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
}

.similar-panel-enter-from,
.similar-panel-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
}
</style>
