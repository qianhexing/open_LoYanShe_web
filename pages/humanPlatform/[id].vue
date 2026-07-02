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
import type { LibraryVideo, LaxianItem, LaxianInitialCamera, LaxianHighlightFrame, LaxianFrameShape, LibrarySimilarItem } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { BASE_IMG } from '@/utils/ipConfig'
import { useLayoutStyle } from '@/composables/useLayoutStyle'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
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
const { setLayoutStyle } = useLayoutStyle()

/** iframe 嵌入（如服饰详情封面） */
const isFromIframeEmbed = computed(() => {
  const v = route.query.from_iframe
  return (Array.isArray(v) ? v[0] : v) === 'true'
})

/** hide_ui=true：仅保留 3D 画布，隐藏全部操作 UI */
const isHideUi = computed(() => {
  const v = route.query.hide_ui
  return (Array.isArray(v) ? v[0] : v) === 'true'
})

const isEmbedMinimal = computed(() => isHideUi.value || isFromIframeEmbed.value)

/** 站内跳转时保留 embed 相关 query（如 hide_ui、from_iframe） */
const buildHumanPlatformPath = (videoId: number | string, libraryId?: number | null) => {
    const q = new URLSearchParams()
    const lid = libraryId ?? queryLibraryId.value
    if (lid != null) q.set('library_id', String(lid))
    for (const key of ['from_iframe', 'hide_ui', 'edit'] as const) {
        const raw = route.query[key]
        const val = Array.isArray(raw) ? raw[0] : raw
        if (val != null && val !== '') q.set(key, String(val))
    }
    const qs = q.toString()
    return qs ? `/humanPlatform/${videoId}?${qs}` : `/humanPlatform/${videoId}`
}

// 编辑模式：通过地址栏 edit=1 开启
const isEditMode = computed(() => Boolean(route.query.edit) && !isHideUi.value)

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
/** 首次成功加载前为 true；之后切换人台图不再卸载 3D 查看器 */
const hasLoadedOnce = ref(false)
const videoLoading = ref(false)
const error = ref<string | null>(null)
/** 切换人台图时抑制 props 自动重载，由 loadVideoData 写完后单次 reloadSceneKeepWebGL */
const suppressViewerAutoReload = ref(false)

const isMobileDevice = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

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
    router.push(buildHumanPlatformPath(vid))
}

const initVideoAndList = async () => {
    if (!layoutReady.value) return
    const lid = queryLibraryId.value
    const isDefaultFirst = id.value === '0' && lid
    if (isDefaultFirst) {
        await loadLibraryVideoList()
        const first = libraryVideoList.value[0]
        if (first?.video_id != null) {
            // 仅 replace 路由，由 id watch 统一 loadVideoData，避免 iframe 入口双次解码点云
            await router.replace(buildHumanPlatformPath(first.video_id, lid))
        } else {
            loading.value = false
            error.value = '该图鉴暂无点云人台图'
        }
    } else {
        loadVideoData()
    }
}
let initVideoStarted = false
const ensureInitVideoAndList = () => {
    if (!layoutReady.value || initVideoStarted) return
    initVideoStarted = true
    void initVideoAndList()
}
watch(layoutReady, (newVal) => {
    if (newVal) ensureInitVideoAndList()
})
watch(isEditMode, (val) => {
    if (val && laxianListFromVideo.value.length > 0) {
        editableLaxianList.value = laxianListFromVideo.value.map((item) => normalizeEditableLaxianItem(item))
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
        expandedLaxianId.value = null
        soloLaxianId.value = null
        viewerRef.value?.setLaxianSoloDisplay?.(null)
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

    const isFirstLoad = !hasLoadedOnce.value
    if (!isFirstLoad) {
        suppressViewerAutoReload.value = true
    }
    try {
        if (isFirstLoad) {
            loading.value = true
        } else {
            videoLoading.value = true
        }
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
                editableLaxianList.value = (Array.isArray(list) ? list : []).map((item) => normalizeEditableLaxianItem(item))
                editableInitialCameraList.value = cameras.map((item) => ({ ...item }))
            }
            // 解析模型地址
            // Spark 2.0（@sparkjsdev/spark）：点云由 ThreeCore.loadSplat / loadSceneFromJSON 加载。
            // splat 的 options 仅使用 fileType、maxSplats、maxSh、mobileOptimized（见 utils/threeCore.ts）；
            // 勿传 GLTF 的 useDracoLoader / dracoDecoderPath，否则会误导维护且对点云无效。
            // 文档：https://sparkjs.dev/docs/0.1-2.0-migration-guide/
            const modelUrls = libraryVideo.value.addr.split(',').filter(url => url.trim())
            const splatOptions = isMobileDevice
                ? { mobileOptimized: true, maxSplats: 40000 }
                : {}
            modelList.value = modelUrls.map((url, index) => ({
                url: url.trim(),
                type: 'splat' as const,
                position: [index * 3, 0, 0] as [number, number, number],
                options: splatOptions
            }))
            hasLoadedOnce.value = true
        } else {
            laxianListFromVideo.value = []
            error.value = '该视频不是点云类型或缺少模型地址'
        }
    } catch (err) {
        console.error('加载视频数据失败:', err)
        error.value = err instanceof Error ? err.message : '加载视频数据失败'
    } finally {
        if (!isFirstLoad) {
            try {
                if (!error.value) {
                    await nextTick()
                    await viewerRef.value?.reloadSceneKeepWebGL()
                }
            } finally {
                suppressViewerAutoReload.value = false
            }
        }
        loading.value = false
        videoLoading.value = false
    }
}

// 关闭查看器
const handleClose = () => {
    router.back()
}

const { copyCurrentUrl } = useCopyCurrentUrl()

const handleShareLink = async () => {
    try {
        const result = await copyCurrentUrl()
        if (result?.success) {
            useToast().add({ title: '链接已复制', color: 'green' })
        } else {
            useToast().add({
                title: '复制失败',
                description: result?.message ?? '请手动复制地址栏链接',
                color: 'orange',
            })
        }
    } catch {
        useToast().add({ title: '复制失败', color: 'red' })
    }
}

// 吐槽
// const handleFeedback = () => {
//     // TODO: 打开吐槽/反馈入口
// }

// 传给查看器的拉线列表（编辑模式用可编辑列表）
const laxianListForViewer = computed(() =>
    isEditMode.value ? editableLaxianList.value : laxianListFromVideo.value
)

/** hide_ui：场景内不加载拉线点，仅保留点云画布 */
const viewerLaxianList = computed(() =>
    isHideUi.value ? [] : laxianListForViewer.value
)

// 拉线点列表（节流同步，避免 Three 每帧更新触发 Vue 全树重渲染）
const viewerRef = ref<InstanceType<typeof SPZModelViewerContent> | null>(null)
const laxianList = shallowRef<LaxianInterface[]>([])

// ===== 编辑模式：拉线数据制作 =====
/** 默认线框尺寸：长、高、宽 */
const LAXIAN_FRAME_DEFAULT: [number, number, number] = [0.3, 0.2, 0.2]

const normalizeEditableLaxianItem = (item: LaxianItem): LaxianItem => ({
    ...item,
    frames: (item.frames ?? []).map((frame) => ({
        ...frame,
        position: frame.position
            ? [frame.position[0], frame.position[1], frame.position[2]] as [number, number, number]
            : [0, 0, 0],
        rotation: frame.rotation
            ? [frame.rotation[0], frame.rotation[1], frame.rotation[2]] as [number, number, number]
            : [0, 0, 0],
        scale: [
            frame.scale?.[0] ?? LAXIAN_FRAME_DEFAULT[0],
            frame.scale?.[1] ?? LAXIAN_FRAME_DEFAULT[1],
            frame.scale?.[2] ?? LAXIAN_FRAME_DEFAULT[2]
        ] as [number, number, number],
        shape: frame.shape === 'ellipse' ? 'ellipse' : 'box'
    }))
})

const ensureLaxianFrames = (item: LaxianItem): LaxianHighlightFrame[] => item.frames ?? []

const syncLaxianTransformFromPayload = (payload: {
    object: THREE.Object3D
    laxianId?: string
    frameId?: string
}) => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core || !payload.laxianId) return
    const idx = editableLaxianList.value.findIndex((l) => l.laxian_id === payload.laxianId)
    if (idx < 0) return
    const item = editableLaxianList.value[idx]
    if (payload.frameId) {
        const frameGroup = core.resolveScenePickTarget(payload.object)
        if (frameGroup?.userData.type !== 'laxian_frame') return
        const frameData = core.extractLaxianFrameData(frameGroup)
        const frames = [...ensureLaxianFrames(item)]
        const frameIdx = frames.findIndex((f) => f.frame_id === payload.frameId)
        if (frameIdx >= 0) {
            frames[frameIdx] = frameData
            editableLaxianList.value[idx] = { ...item, frames }
            editableLaxianList.value = [...editableLaxianList.value]
        }
        return
    }
    if (payload.object.userData.type === 'laxian') {
        editableLaxianList.value[idx] = {
            ...item,
            position: [payload.object.position.x, payload.object.position.y, payload.object.position.z],
            rotation: [payload.object.rotation.x, payload.object.rotation.y, payload.object.rotation.z]
        }
        editableLaxianList.value = [...editableLaxianList.value]
    }
}

const transformType = ref<'translate' | 'rotate'>('translate')
const selectedLaxianId = ref<string | null>(null)
const selectedFrameId = ref<string | null>(null)
/** 编辑独显：仅显示该定位点及其子线框 */
const soloLaxianId = ref<string | null>(null)

const syncLaxianSoloToViewer = () => {
    viewerRef.value?.setLaxianSoloDisplay?.(soloLaxianId.value)
}

const toggleLaxianSoloDisplay = (item: LaxianItem) => {
    if (!item.laxian_id) return
    const next = soloLaxianId.value === item.laxian_id ? null : item.laxian_id
    soloLaxianId.value = next
    if (next && selectedLaxianId.value && selectedLaxianId.value !== next) {
        viewerRef.value?.detachTransformControls?.()
        selectedLaxianId.value = null
        selectedFrameId.value = null
    }
    syncLaxianSoloToViewer()
}

const onLaxianSelect = (payload: { laxianId: string | null; frameId: string | null }) => {
    const frameChanged = payload.frameId !== selectedFrameId.value
    selectedLaxianId.value = payload.laxianId
    selectedFrameId.value = payload.frameId
    // 仅在新选中线框时默认切到移动，避免切换旋转模式时被 deep watch 重复触发重置
    if (payload.frameId && frameChanged) {
        transformType.value = 'translate'
        viewerRef.value?.setTransformMode?.('translate')
    }
}

const setLaxianTransformMode = (mode: 'translate' | 'rotate') => {
    transformType.value = mode
    viewerRef.value?.setTransformMode?.(mode)
}

const applyFrameBoxSizeToScene = (item: LaxianItem, frame: LaxianHighlightFrame) => {
    if (!item.laxian_id || !frame.frame_id || !frame.scale) return
    const [length, height, width] = frame.scale
    const l = Math.max(0.05, Number(length) || LAXIAN_FRAME_DEFAULT[0])
    const h = Math.max(0.05, Number(height) || LAXIAN_FRAME_DEFAULT[1])
    const w = Math.max(0.05, Number(width) || LAXIAN_FRAME_DEFAULT[2])
    frame.scale = [l, h, w]
    viewerRef.value?.getThreeCore?.()?.resizeLaxianSubFrame?.(item.laxian_id, frame.frame_id, l, h, w)
}

const applyFrameShapeToScene = (item: LaxianItem, frame: LaxianHighlightFrame, shape: LaxianFrameShape) => {
    if (!item.laxian_id || !frame.frame_id) return
    frame.shape = shape === 'ellipse' ? 'ellipse' : 'box'
    viewerRef.value?.getThreeCore?.()?.setLaxianSubFrameShape?.(item.laxian_id, frame.frame_id, frame.shape)
}

const selectLaxianFrameInEditor = (item: LaxianItem, frame: LaxianHighlightFrame) => {
    if (!item.laxian_id || !frame.frame_id) return
    selectedLaxianId.value = item.laxian_id
    selectedFrameId.value = frame.frame_id
    viewerRef.value?.selectLaxianFrameObject?.(item.laxian_id, frame.frame_id)
    setLaxianTransformMode('translate')
}

const addLaxianFrameToPoint = (item: LaxianItem) => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core || !item.laxian_id) return
    const frameId = `frame_${Date.now()}`
    const newFrame: LaxianHighlightFrame = {
        frame_id: frameId,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [...LAXIAN_FRAME_DEFAULT],
        shape: 'box'
    }
    const idx = editableLaxianList.value.findIndex((l) => l.laxian_id === item.laxian_id)
    if (idx >= 0) {
        const frames = [...ensureLaxianFrames(editableLaxianList.value[idx]), newFrame]
        editableLaxianList.value[idx] = { ...editableLaxianList.value[idx], frames }
        editableLaxianList.value = [...editableLaxianList.value]
    }
    core.addLaxianFrame(item.laxian_id, newFrame)
    selectLaxianFrameInEditor(item, newFrame)
}

const removeLaxianFrameFromPoint = (item: LaxianItem, frame: LaxianHighlightFrame) => {
    if (!item.laxian_id || !frame.frame_id) return
    if (selectedFrameId.value === frame.frame_id) {
        viewerRef.value?.detachTransformControls?.()
        selectedFrameId.value = null
    }
    viewerRef.value?.getThreeCore?.()?.removeLaxianFrame?.(item.laxian_id, frame.frame_id)
    const idx = editableLaxianList.value.findIndex((l) => l.laxian_id === item.laxian_id)
    if (idx >= 0) {
        const frames = ensureLaxianFrames(editableLaxianList.value[idx]).filter(
            (f) => f.frame_id !== frame.frame_id
        )
        editableLaxianList.value[idx] = { ...editableLaxianList.value[idx], frames }
        editableLaxianList.value = [...editableLaxianList.value]
    }
}

watch(isEditMode, (edit) => {
    if (!edit) {
        selectedLaxianId.value = null
        selectedFrameId.value = null
        soloLaxianId.value = null
        viewerRef.value?.setLaxianSoloDisplay?.(null)
        viewerRef.value?.bindLaxianTransformListener?.(null)
        return
    }
    viewerRef.value?.bindLaxianTransformListener?.(syncLaxianTransformFromPayload)
}, { immediate: true })

watch(viewerRef, (viewer) => {
    if (!viewer) return
    if (isEditMode.value) {
        viewer.bindLaxianTransformListener?.(syncLaxianTransformFromPayload)
        syncLaxianSoloToViewer()
    }
})

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
        type: 0,
        frames: []
    }
    editableLaxianList.value = [...editableLaxianList.value, newItem]
    core.addLaxianToScene?.({
        position: pos,
        title: newItem.title,
        laxian_id: newItem.laxian_id,
        type: newItem.type,
        camera: newItem.camera,
        frames: []
    })
}

const saveCameraForLaxian = (item: LaxianItem) => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core?.camera || !core?.controls?.target) return
    const { position, target } = core.cameraStateToStepCamera(core.recordCamera(false))
    const cameraState = { position, target }
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
    if (selectedLaxianId.value === item.laxian_id) {
        viewerRef.value?.detachTransformControls?.()
        selectedLaxianId.value = null
        selectedFrameId.value = null
    }
    if (soloLaxianId.value === item.laxian_id) {
        soloLaxianId.value = null
        viewerRef.value?.setLaxianSoloDisplay?.(null)
    }
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

const syncEditableLaxianFramesFromScene = () => {
    const core = viewerRef.value?.getThreeCore?.()
    if (!core) return
    editableLaxianList.value = editableLaxianList.value.map((item) => {
        if (!item.laxian_id) return item
        const frames = core.extractLaxianFramesByLaxianId(item.laxian_id)
        if (!frames.length) return item
        return { ...item, frames }
    })
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
        syncEditableLaxianFramesFromScene()
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
    syncEditableLaxianFramesFromScene()
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

const LABEL_MAX_WIDTH = 240
const LABEL_EXPANDED_MAX_WIDTH = 320

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

const handleLaxianLabelClick = (item: LaxianInterface) => {
    viewerRef.value?.focusLaxianCamera?.(item)
    const laxianId = item.laxian_id
    if (!laxianId || !hasLaxianDetailContent(getLaxianById(item.laxian_id))) return
    expandedLaxianId.value = expandedLaxianId.value === laxianId ? null : laxianId
}

const openLaxianDetailEdit = (item: LaxianItem, e: MouseEvent) => {
    activeLaxianDetail.value = { ...item }
    setDetailModalPosition(e)
    showLaxianDetailEdit.value = true
}

const openLaxianDetailEditFromLabel = (item: LaxianInterface, e: MouseEvent) => {
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

// 拉线类型显示开关：0 设计元素，1 柄图元素
const showType0 = ref(true)
const showType1 = ref(true)
const allLaxianMarkersHidden = computed(() => !showType0.value && !showType1.value)

const toggleAllLaxianMarkers = () => {
    if (isHideUi.value || laxianListForViewer.value.length === 0) return
    const hideAll = !allLaxianMarkersHidden.value
    showType0.value = !hideAll
    showType1.value = !hideAll
    if (hideAll) expandedLaxianId.value = null
}

const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return target.isContentEditable
}

const onLaxianShortcutKeyDown = (e: KeyboardEvent) => {
    if (isHideUi.value || laxianListForViewer.value.length === 0) return
    if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    if (e.key.toLowerCase() !== 'h') return
    if (isTypingTarget(e.target)) return
    e.preventDefault()
    toggleAllLaxianMarkers()
}

const showLaxianModal = ref(false)
const laxianModalPosition = ref({ x: 0, y: 0 })
const openLaxianModal = (e: MouseEvent) => {
    laxianModalPosition.value = { x: e.clientX, y: e.clientY }
    showLaxianModal.value = true
}

// 是否开启自动旋转
const autoRotateEnabled = ref(false)

watch(
  isEmbedMinimal,
  (minimal) => {
    setLayoutStyle(minimal ? 1 : 0)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
    setLayoutStyle(0)
})

const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const screenHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)
const updateScreenCenter = () => {
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
}
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const debouncedUpdateScreenCenter = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(updateScreenCenter, 150)
}

// 标签安全区域：上（避开顶部按钮）、下边距
const LABEL_SAFE_TOP = 56
const LABEL_SAFE_BOTTOM = 32
const LABEL_EDGE_OFFSET = 12
const LABEL_HEIGHT = 70
const LABEL_BELOW_OFFSET = 12

const configStore = useConfigStore()

const filterVisibleLaxian = (list: LaxianInterface[]) =>
    list.filter((item) => {
        if (!item.position) return false
        if (isEditMode.value && soloLaxianId.value && item.laxian_id !== soloLaxianId.value) return false
        const t = item.type ?? 0
        return (t === 0 && showType0.value) || (t === 1 && showType1.value)
    })

// 按类型过滤后的可见拉线点（结构数据；屏幕坐标由 RAF 直接写 DOM，避免 Vue 每帧重渲染）
const laxianWithLayout = computed<LaxianInterface[]>(() => filterVisibleLaxian(laxianList.value))

const getLaxianLabelStyle = (item: LaxianInterface) => {
    const expanded = isLaxianExpanded(item.laxian_id)
    const maxWidth = Math.min(
        expanded ? LABEL_EXPANDED_MAX_WIDTH : LABEL_MAX_WIDTH,
        screenWidth.value - LABEL_EDGE_OFFSET * 2
    )
    return { maxWidth: `${maxWidth}px` }
}

/** 拉线类型配色：0 设计元素-紫色，1 柄图元素-青色（与 Canvas 定位点一致） */
const LAXIAN_TYPE_THEME = {
    0: {
        dot: 'rgba(147, 51, 234, 0.8)',
        bg: 'bg-purple-400/35 dark:bg-purple-500/30 border border-purple-200/60 dark:border-purple-700/50',
        ring: 'ring-2 ring-purple-300/70 dark:ring-purple-600/50',
    },
    1: {
        dot: 'rgba(20, 184, 166, 0.8)',
        bg: 'bg-teal-400/35 dark:bg-teal-500/30 border border-teal-200/60 dark:border-teal-700/50',
        ring: 'ring-2 ring-teal-300/70 dark:ring-teal-600/50',
    },
} as const

const getLaxianTypeTheme = (type?: number) => LAXIAN_TYPE_THEME[type === 1 ? 1 : 0]

const getLaxianLabelBgClass = (type?: number) => getLaxianTypeTheme(type).bg

const getLaxianLabelExpandedRingClass = (type?: number) => getLaxianTypeTheme(type).ring

const computeLaxianLabelTop = (py: number) => {
    const innerHeight = screenHeight.value
    const safeTop = LABEL_SAFE_TOP + configStore.statusBarHeight
    const top = py + LABEL_BELOW_OFFSET
    return Math.max(safeTop, Math.min(top, innerHeight - LABEL_SAFE_BOTTOM - LABEL_HEIGHT))
}

// Canvas 定位点绘制 + 标签位置（每帧 RAF 同步，与 Three 动画环对齐）
const canvasRef = ref<HTMLCanvasElement | null>(null)
const labelLayerRef = ref<HTMLElement | null>(null)
let laxianOverlayLoopId = 0
let laxianOverlayActive = false
const getCanvasDpr = () => {
    const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return isMobileDevice ? Math.min(raw, 1.5) : Math.min(raw, 2)
}

const readLaxianFromViewer = (): LaxianInterface[] => {
    const raw = viewerRef.value?.laxianList
    if (!raw) return []
    return (raw as { value?: LaxianInterface[] }).value ?? (Array.isArray(raw) ? raw : [])
}

/** 仅在拉线点增删或标题变化时更新 Vue 列表，避免每帧触发模板 diff */
const syncLaxianListStructure = (visible: LaxianInterface[]) => {
    const prevKey = laxianList.value.map((i) => `${i.laxian_id ?? ''}:${i.title ?? ''}:${i.type ?? 0}`).join('|')
    const nextKey = visible.map((i) => `${i.laxian_id ?? ''}:${i.title ?? ''}:${i.type ?? 0}`).join('|')
    if (prevKey !== nextKey) {
        laxianList.value = visible.map((item) => ({
            ...item,
            position: item.position ? { ...item.position } : item.position
        }))
        nextTick(() => updateLaxianLabelPositions(visible))
    }
}

const drawLaxianCanvasFrame = (list: LaxianInterface[]) => {
    const canvas = canvasRef.value
    if (!canvas) return

    const dpr = getCanvasDpr()
    const w = window.innerWidth
    const h = window.innerHeight

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    if (list.length === 0) {
        ctx.restore()
        return
    }

    for (const item of list) {
        const x = item.position?.x ?? 0
        const y = item.position?.y ?? 0
        const dotColor = getLaxianTypeTheme(item.type).dot

        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.strokeStyle = dotColor
        ctx.lineWidth = 2
        ctx.stroke()
    }

    ctx.restore()
}

const updateLaxianLabelPositions = (list: LaxianInterface[]) => {
    const layer = labelLayerRef.value
    if (!layer) return
    for (const item of list) {
        const id = item.laxian_id
        if (!id) continue
        const el = layer.querySelector(`[data-laxian-id="${CSS.escape(id)}"]`) as HTMLElement | null
        if (!el) continue
        const px = item.position?.x ?? 0
        const py = item.position?.y ?? 0
        el.style.left = `${px}px`
        el.style.top = `${computeLaxianLabelTop(py)}px`
        el.style.transform = 'translate3d(-50%, 0, 0)'
    }
}

const syncLaxianOverlayFrame = () => {
    const visible = filterVisibleLaxian(readLaxianFromViewer())
    syncLaxianListStructure(visible)
    drawLaxianCanvasFrame(visible)
    updateLaxianLabelPositions(visible)
}

const stopLaxianOverlayLoop = () => {
    laxianOverlayActive = false
    if (laxianOverlayLoopId) {
        cancelAnimationFrame(laxianOverlayLoopId)
        laxianOverlayLoopId = 0
    }
}

const startLaxianOverlayLoop = () => {
    if (laxianOverlayActive || isHideUi.value) return
    laxianOverlayActive = true
    const tick = () => {
        if (!laxianOverlayActive || document.hidden || isHideUi.value) {
            stopLaxianOverlayLoop()
            return
        }
        syncLaxianOverlayFrame()
        laxianOverlayLoopId = requestAnimationFrame(tick)
    }
    laxianOverlayLoopId = requestAnimationFrame(tick)
}

watch(
    () => [viewerRef.value, viewerLaxianList.value.length, isHideUi.value] as const,
    ([viewer, count, hideUi]) => {
        if (viewer && count > 0 && !hideUi) {
            startLaxianOverlayLoop()
        } else {
            stopLaxianOverlayLoop()
            laxianList.value = []
        }
    },
    { immediate: true },
)

watch([expandedLaxianId, soloLaxianId, showType0, showType1], () => {
    syncLaxianOverlayFrame()
    if (viewerRef.value && viewerLaxianList.value.length > 0 && !isHideUi.value) {
        startLaxianOverlayLoop()
    }
})

const onVisibilityChange = () => {
    if (document.hidden) {
        stopLaxianOverlayLoop()
    } else if (viewerRef.value && viewerLaxianList.value.length > 0 && !isHideUi.value) {
        startLaxianOverlayLoop()
    }
}
onMounted(() => {
    ensureInitVideoAndList()
    updateScreenCenter()
    window.addEventListener('resize', debouncedUpdateScreenCenter, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('keydown', onLaxianShortcutKeyDown)
})
onUnmounted(() => {
    window.removeEventListener('resize', debouncedUpdateScreenCenter)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('keydown', onLaxianShortcutKeyDown)
    if (resizeTimer) clearTimeout(resizeTimer)
    stopLaxianOverlayLoop()
})
</script>

<template>
    <div class="fixed inset-0 w-full h-full bg-white z-50">
        <!-- 首次加载（hide_ui 嵌入模式跳过，直接展示 3D 画布） -->
        <div
            v-if="!isHideUi && loading && !hasLoadedOnce"
            class="w-full h-full flex flex-col items-center justify-center"
        >
            <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
            <p class="mt-4 text-purple-600 tracking-widest font-bold">正在加载数据...</p>
        </div>

        <!-- 首次加载失败（hide_ui 嵌入模式不展示错误页） -->
        <div
            v-else-if="!isHideUi && error && !hasLoadedOnce"
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
                <UButton v-if="!isHideUi" color="gray" @click="handleClose" class="mt-2">
                    返回
                </UButton>
            </div>
        </div>

        <!-- threejs 内容区域（首次成功后保持挂载，切换人台图不再销毁 WebGL） -->
        <client-only v-else>
            <div
                v-if="videoLoading && !isHideUi"
                class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] pointer-events-none"
            >
                <div class="w-10 h-10 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
            </div>
            <div
                v-if="error && hasLoadedOnce && !isHideUi"
                class="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-md px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-sm shadow-md"
            >
                {{ error }}
            </div>
            <SPZModelViewerContent
                ref="viewerRef"
                :model-list="modelList"
                :laxian-list="viewerLaxianList"
                :initial-camera-list="initialCameraForViewer"
                :auto-rotate="autoRotateEnabled"
                :edit-mode="isEditMode"
                :show-loading-mask="!hasLoadedOnce && !isHideUi"
                :hide-scene-chrome="isHideUi"
                :suppress-props-reload="suppressViewerAutoReload"
                @laxian-select="onLaxianSelect"
            />
            <!-- 功能栏 -->
            <div
                v-if="!isHideUi"
                class="fixed left-3 z-30 flex items-center gap-2 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 p-1"
                :style="{ top: `${12 + configStore.statusBarHeight}px` }"
            >
                <button
                    v-if="laxianListForViewer.length > 0"
                    type="button"
                    class="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-purple-600 dark:text-purple-400"
                    title="标点设置"
                    @click="openLaxianModal"
                >
                    <UIcon name="material-symbols:pin-drop" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">标点</span>
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
                    title="分享"
                    aria-label="分享：复制当前页链接"
                    @click="handleShareLink"
                >
                    <UIcon name="ic:round-share" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">分享</span>
                </button>
                <!-- 吐槽
                <button
                    type="button"
                    class="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-gray-600 dark:text-gray-400"
                    title="吐槽"
                    @click="handleFeedback"
                >
                    <UIcon name="material-symbols:chat-bubble-outline" class="text-lg" />
                    <span class="text-[10px] font-medium leading-tight">吐槽</span>
                </button>
                -->
            </div>
            <!-- 悬浮人台图列表：有 library_id 时显示，可收缩展开 -->
            <div
                v-if="effectiveLibraryId && hasLoadedOnce && !isHideUi"
                class="fixed right-0 z-30 flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
                :class="libraryListExpanded
                    ? 'top-1/2 -translate-y-1/2 max-h-[58vh] sm:max-h-[70vh] w-[108px] sm:w-[200px] md:w-[220px]'
                    : 'top-1/2 -translate-y-1/2 max-h-[58vh] sm:max-h-[70vh] w-[36px] sm:w-[52px]'"
            >
                <button
                    type="button"
                    class="flex items-center justify-center gap-1.5 py-2 px-1.5 sm:py-2.5 sm:px-2 shrink-0 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors"
                    :class="libraryListExpanded ? 'border-b border-gray-100 dark:border-gray-600' : 'min-h-[40px] sm:min-h-[48px]'"
                    :title="libraryListExpanded ? '收起列表' : '展开列表'"
                    @click="libraryListExpanded = !libraryListExpanded"
                >
                    <UIcon
                        :name="libraryListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:view-module'"
                        class="text-lg sm:text-2xl transition-transform"
                        :class="libraryListExpanded ? '' : 'rotate-90'"
                    />
                    <span v-if="libraryListExpanded" class="text-[10px] sm:text-xs font-medium hidden sm:inline">人台图</span>
                </button>
                <div
                    v-show="libraryListExpanded"
                    class="flex-1 overflow-y-auto overscroll-contain p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 min-h-0"
                >
                    <div v-if="libraryVideoListLoading" class="flex items-center justify-center py-4 sm:py-6">
                        <div class="w-5 h-5 sm:w-6 sm:h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                    </div>
                    <template v-else-if="libraryVideoList.length > 0">
                        <button
                            v-for="item in libraryVideoList"
                            :key="item.video_id"
                            type="button"
                            class="w-full flex flex-col items-center gap-1 p-1.5 sm:flex-row sm:items-center sm:gap-2 sm:p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors text-center sm:text-left group"
                            :class="Number(id) === item.video_id ? 'bg-purple-100 dark:bg-purple-900/30 ring-1 ring-purple-200 dark:ring-purple-700' : ''"
                            @click="handleVideoSelect(item)"
                        >
                            <div class="w-full aspect-square sm:w-14 sm:h-14 sm:aspect-auto flex-shrink-0 rounded-md sm:rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                                <img
                                    v-if="item.cover"
                                    :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200,h_200`"
                                    :alt="item.title || ''"
                                    class="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div v-else class="w-full h-full flex items-center justify-center">
                                    <UIcon name="i-heroicons-cube" class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                </div>
                            </div>
                            <div class="w-full min-w-0 sm:flex-1">
                                <span class="text-[10px] sm:text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">{{ item.title || '3D' }}</span>
                            </div>
                        </button>
                    </template>
                    <div v-else class="py-3 sm:py-4 text-center text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                        暂无点云人台图
                    </div>
                </div>
            </div>
            <!-- 右下角：相似推荐角标（默认收起，点击展开横向滚动列表） -->
            <div
                v-if="effectiveLibraryId && hasLoadedOnce && !isHideUi"
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
            <!-- 拉线点 overlay：Canvas 层（定位点圆环，忽略点击触摸） -->
            <div class="fixed inset-0 pointer-events-none z-10" v-show="laxianWithLayout.length > 0 && !isHideUi">
                <canvas
                    ref="canvasRef"
                    class="absolute inset-0 w-full h-full block"
                />
            </div>
            <!-- 拉线点 overlay：标题层（显示在 Canvas 上层，点击展开详情） -->
            <div
                ref="labelLayerRef"
                class="fixed inset-0 pointer-events-none z-20"
                v-show="laxianWithLayout.length > 0 && !isHideUi"
            >
                <div
                    v-for="(item, i) in laxianWithLayout"
                    :key="'label-' + (item.laxian_id ?? i)"
                    :data-laxian-id="item.laxian_id"
                    class="absolute pointer-events-auto laxian-label w-max"
                    :class="isLaxianExpanded(item.laxian_id)
                        ? 'z-30'
                        : 'z-20'"
                    :style="getLaxianLabelStyle(item)"
                >
                    <div
                        class="rounded-2xl shadow-lg text-sm backdrop-blur-sm overflow-hidden transition-all duration-300 ease-out hover:shadow-xl"
                        :class="[
                            getLaxianLabelBgClass(item.type),
                            isLaxianExpanded(item.laxian_id)
                                ? getLaxianLabelExpandedRingClass(item.type)
                                : 'hover:scale-[1.02] active:scale-[0.98]',
                        ]"
                    >
                        <button
                            type="button"
                            class="p-2 px-3 text-left cursor-pointer inline-flex items-center gap-1 max-w-full"
                            @click="handleLaxianLabelClick(item)"
                        >
                            <span
                                class="font-medium text-gray-800 dark:text-gray-100"
                                :class="isLaxianExpanded(item.laxian_id) ? '' : 'truncate'"
                            >
                                {{ item.title }}
                            </span>
                            <UIcon
                                v-if="hasLaxianDetailContent(getLaxianById(item.laxian_id))"
                                :name="isLaxianExpanded(item.laxian_id)
                                    ? 'material-symbols:expand-less'
                                    : 'material-symbols:expand-more'"
                                class="text-base shrink-0 opacity-60"
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
                v-if="isEditMode && hasLoadedOnce"
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
                    每个点位可添加多个标注线框（立方体 / 椭圆）；点击列表中的线框项即可选中，并在下方切换移动/旋转；「独显」仅显示该点及其线框
                </p>
                <div
                    v-if="selectedFrameId"
                    class="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200/80 dark:border-gray-600/50"
                >
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">变换模式</span>
                    <UButton
                        size="xs"
                        :color="transformType === 'translate' ? 'primary' : 'gray'"
                        variant="soft"
                        @click="setLaxianTransformMode('translate')"
                    >
                        <UIcon name="material-symbols:open-with" class="mr-0.5" />
                        移动
                    </UButton>
                    <UButton
                        size="xs"
                        :color="transformType === 'rotate' ? 'primary' : 'gray'"
                        variant="soft"
                        @click="setLaxianTransformMode('rotate')"
                    >
                        <UIcon name="material-symbols:rotate-right" class="mr-0.5" />
                        旋转
                    </UButton>
                </div>
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
                <div class="max-h-64 overflow-y-auto space-y-2">
                    <div
                        v-for="(item, i) in editableLaxianList"
                        :key="item.laxian_id ?? i"
                        class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-2"
                        :class="soloLaxianId === item.laxian_id
                            ? 'ring-1 ring-primary-400/80 dark:ring-primary-500/60'
                            : ''"
                    >
                        <div class="flex items-center gap-2">
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
                            <UButton size="xs" color="primary" variant="soft" title="添加线框" @click="addLaxianFrameToPoint(item)">
                                <UIcon name="material-symbols:add-box" class="mr-0.5" />
                                线框
                            </UButton>
                            <UButton size="xs" color="gray" variant="ghost" title="编辑详情" @click="openLaxianDetailEdit(item, $event)">
                                <UIcon name="material-symbols:edit-note" />
                            </UButton>
                            <UButton size="xs" color="gray" variant="ghost" title="保存当前镜头到此点" @click="saveCameraForLaxian(item)">
                                <UIcon name="material-symbols:photo-camera" />
                            </UButton>
                            <UButton
                                size="xs"
                                :color="soloLaxianId === item.laxian_id ? 'primary' : 'gray'"
                                variant="soft"
                                title="独显：仅显示此定位点及其线框"
                                @click="toggleLaxianSoloDisplay(item)"
                            >
                                <UIcon name="material-symbols:filter-center-focus" class="mr-0.5" />
                                独显
                            </UButton>
                            <UButton size="xs" color="red" variant="ghost" title="删除" @click="removeLaxian(item)">
                                <UIcon name="material-symbols:delete-outline" />
                            </UButton>
                        </div>
                        <div v-if="ensureLaxianFrames(item).length === 0" class="text-[10px] text-gray-400 pl-1">
                            暂无线框，点击「线框」添加标注区域
                        </div>
                        <div
                            v-for="(frame, fi) in (item.frames ?? [])"
                            :key="frame.frame_id ?? `${item.laxian_id}-${fi}`"
                            role="button"
                            tabindex="0"
                            class="ml-2 pl-2 py-1.5 rounded-r-md border-l-2 cursor-pointer transition-colors space-y-1.5"
                            :class="selectedFrameId === frame.frame_id
                                ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30'
                                : 'border-purple-200 dark:border-purple-700 hover:bg-gray-100/80 dark:hover:bg-gray-600/30'"
                            @click="selectLaxianFrameInEditor(item, frame)"
                            @keydown.enter.prevent="selectLaxianFrameInEditor(item, frame)"
                            @keydown.space.prevent="selectLaxianFrameInEditor(item, frame)"
                        >
                            <div class="flex flex-wrap items-center gap-2 text-xs">
                                <span
                                    class="shrink-0 font-medium"
                                    :class="selectedFrameId === frame.frame_id
                                        ? 'text-purple-600 dark:text-purple-300'
                                        : 'text-gray-500 dark:text-gray-400'"
                                >
                                    线框 {{ fi + 1 }}
                                </span>
                                <label class="flex items-center gap-1" @click.stop>
                                    <span class="text-gray-500">形状</span>
                                    <select
                                        :value="frame.shape ?? 'box'"
                                        class="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        @change="(e) => applyFrameShapeToScene(item, frame, (e.target as HTMLSelectElement).value as LaxianFrameShape)"
                                    >
                                        <option value="box">立方体</option>
                                        <option value="ellipse">椭圆</option>
                                    </select>
                                </label>
                                <label class="flex items-center gap-1" @click.stop>
                                    <span class="text-gray-500">长</span>
                                    <input
                                        v-model.number="frame.scale![0]"
                                        type="number"
                                        min="0.05"
                                        step="0.05"
                                        class="w-14 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        @change="applyFrameBoxSizeToScene(item, frame)"
                                    />
                                </label>
                                <label class="flex items-center gap-1" @click.stop>
                                    <span class="text-gray-500">高</span>
                                    <input
                                        v-model.number="frame.scale![1]"
                                        type="number"
                                        min="0.05"
                                        step="0.05"
                                        class="w-14 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        @change="applyFrameBoxSizeToScene(item, frame)"
                                    />
                                </label>
                                <label class="flex items-center gap-1" @click.stop>
                                    <span class="text-gray-500">宽</span>
                                    <input
                                        v-model.number="frame.scale![2]"
                                        type="number"
                                        min="0.05"
                                        step="0.05"
                                        class="w-14 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        @change="applyFrameBoxSizeToScene(item, frame)"
                                    />
                                </label>
                                <UButton size="xs" color="red" variant="ghost" title="删除线框" @click.stop="removeLaxianFrameFromPoint(item, frame)">
                                    <UIcon name="material-symbols:close" />
                                </UButton>
                            </div>
                        </div>
                    </div>
                    <div v-if="editableLaxianList.length === 0" class="text-center py-4 text-sm text-gray-400">
                        暂无拉线点，点击「添加拉线点」开始制作
                    </div>
                </div>
            </div>
            <QhxModal v-if="!isHideUi" v-model="showLaxianModal" :trigger-position="laxianModalPosition" @close="showLaxianModal = false">
                <div class="p-6 w-[240px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">标点显示</h3>
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
                v-if="!isHideUi"
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

/* 拉线标签：位置由 RAF 直接写 style，不做 transition，避免镜头移动时滞后抖动 */
.laxian-label {
    width: max-content;
    will-change: left, top, transform;
    transition-property: max-width;
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
