<script setup lang="ts">
// biome-ignore lint/style/useImportType: 组件供 template 挂载，InstanceType 供 ref
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
import type { SceneLoadState } from '@/components/ModelViewer/SPZModelViewerContent.vue'
import type { Library, LibrarySimilarItem, LibraryVideo, Shop } from '@/types/api'
import type { LaxianItem } from '@/types/api'
import type { SceneJSON } from '@/utils/threeCore'
import { getShopDetail } from '@/api/shop'
import {
    getLibraryDetail,
    getLibrarySimilar,
    getLibraryVideo,
    getLibraryVideoById,
    getLibraryVideoList
} from '@/api/library'
import { BASE_IMG } from '@/utils/ipConfig'
import { useLayoutStyle } from '@/composables/useLayoutStyle'
import { useForcedLandscape } from '@/composables/useForcedLandscape'
import { useCssRotatedPointerFix } from '@/composables/useCssRotatedPointerFix'

interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    /** Spark 2.0：`type === 'splat'` 时仅 `fileType`、`maxSplats`、`maxSh`、`mobileOptimized` 传入 ThreeCore.loadSplat */
    options?: Record<string, unknown>
}

definePageMeta({ name: 'exhibition-detail' })
useHead({
    title: '数字展馆 - Lo研社',
    meta: [
        { name: 'description', content: '数字展馆 - 店铺 3D 图鉴展示' }
    ]
})

const route = useRoute()
const layoutReady = inject('layoutReady') as Ref<boolean>
const { setLayoutStyle } = useLayoutStyle()
const { isPortraitMobile } = useForcedLandscape()

const mobileLeftOpen = ref(false)
const mobileRightOpen = ref(false)
const mobilePickerOpen = ref(false)

setLayoutStyle(1)
onBeforeUnmount(() => setLayoutStyle(0))

const shopId = computed(() => {
    const n = Number.parseInt(String(route.params.shop_id ?? ''), 10)
    return Number.isNaN(n) ? 0 : n
})

/** 链接参数为 0：不限定店铺，展示全站藏品，选中后再拉取店主信息 */
const isGlobalExhibition = computed(() => shopId.value === 0)

const shop = ref<Shop | null>(null)
const shopLoading = ref(false)
/** 全站模式下当前展示的店铺 id（避免重复请求） */
const displayedShopId = ref<number | null>(null)

/** 该店铺下所有 3D 视频（pk_type=2，前端按 shop_id 过滤），用于聚合出图鉴列表 */
const allVideos = ref<LibraryVideo[]>([])
const allVideosLoading = ref(false)
const allVideosError = ref<string | null>(null)

/** 当前选中图鉴下的版型（视频）列表（pk_type=2） */
const currentVideoList = ref<LibraryVideo[]>([])
const currentVideoListLoading = ref(false)

const currentLibraryId = ref<number | null>(null)
const currentLibrary = ref<Library | null>(null)
const currentLibraryLoading = ref(false)

const currentVideoId = ref<number | null>(null)

/** 喂给 SPZModelViewerContent 的三种数据（互斥优先：sceneJson > modelList） */
const sceneJson = ref<SceneJSON | null>(null)
const modelList = ref<ModelItem[]>([])
const laxianList = ref<LaxianItem[]>([])
const modelLoading = ref(false)
const modelError = ref<string | null>(null)

const similarRows = ref<LibrarySimilarItem[]>([])
const similarLoading = ref(false)

const autoRotate = ref(false)

const spzViewerRef = ref<InstanceType<typeof SPZModelViewerContent> | null>(null)
const sceneLoadState = ref<SceneLoadState>({
    loading: false,
    progress: { current: 0, total: 0 },
    error: null
})

const onSceneLoadStateChange = (state: SceneLoadState) => {
    sceneLoadState.value = state
}

/** 接口拉取或 WebGL 场景加载中，禁止切换藏品/版型 */
const exhibitSwitchBlocked = computed(
    () =>
        sceneLoadState.value.loading
        || modelLoading.value
        || currentLibraryLoading.value
        || currentVideoListLoading.value
)

const hasSceneViewer = computed(
    () =>
        (sceneJson.value?.objects != null && sceneJson.value.objects.length > 0)
        || modelList.value.length > 0
)

const getViewerCanvas = () =>
    spzViewerRef.value?.getThreeCore?.()?.renderer?.domElement ?? null

/** canvas 异步创建，需在场景就绪后重新挂载指针修正 */
const viewerCanvasReady = computed(() => {
    void hasSceneViewer.value
    void sceneLoadState.value.loading
    return getViewerCanvas() != null
})

useCssRotatedPointerFix(getViewerCanvas, isPortraitMobile, viewerCanvasReady)

const triggerViewerResize = () => {
    nextTick(() => {
        spzViewerRef.value?.getThreeCore?.()?.onContainerResize?.()
        window.dispatchEvent(new Event('resize'))
    })
}

const clearSceneViewer = () => {
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    modelError.value = null
    spzViewerRef.value?.clearSceneContent()
}

const formatImg = (url?: string | null, opt = '') => {
    if (!url) return ''
    return `${BASE_IMG}${url}${opt}`
}

const formatSimilarityScore = (score: number) => {
    if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
    return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

const loadShop = async (targetShopId?: number) => {
    const sid = targetShopId ?? shopId.value
    if (!sid) return
    shopLoading.value = true
    try {
        shop.value = await getShopDetail({ shop_id: sid })
        displayedShopId.value = sid
    } catch (err) {
        console.error('店铺信息加载失败:', err)
        shop.value = null
        displayedShopId.value = null
    } finally {
        shopLoading.value = false
    }
}

const resolveShopIdFromLibrary = (lib?: Library | null) =>
    lib?.shop_id ?? lib?.shop?.shop_id ?? null

/** 全站模式：选中藏品后按图鉴所属店铺拉取店主信息 */
const loadShopForSelection = async (lib?: Library | null) => {
    if (!isGlobalExhibition.value) return
    const sid = resolveShopIdFromLibrary(lib)
    if (!sid) {
        shop.value = null
        displayedShopId.value = null
        return
    }
    if (displayedShopId.value === sid && shop.value) return
    await loadShop(sid)
}

/** 拉取 3D 视频列表（单店按 shop_id 过滤；shop_id=0 为全站不限店） */
const loadAllVideos = async () => {
    if (!shopId.value && !isGlobalExhibition.value) return
    const restrictByShop = !isGlobalExhibition.value
    allVideosLoading.value = true
    allVideosError.value = null
    try {
        const pageSize = 100
        let page = 1
        const collected: LibraryVideo[] = []
        for (let i = 0; i < 20; i++) {
            const res = await getLibraryVideoList({ page, pageSize, pk_type: 2 })
            const rows = res.rows ?? []
            for (const v of rows) {
                if (!v.addr || v.pk_type !== 2) continue
                if (restrictByShop) {
                    const sid = v.library?.shop_id ?? v.library?.shop?.shop_id
                    if (sid !== shopId.value) continue
                }
                collected.push(v)
            }
            if (rows.length < pageSize) break
            page += 1
        }
        allVideos.value = collected
    } catch (err) {
        console.error('图鉴列表加载失败:', err)
        allVideosError.value = err instanceof Error ? err.message : '加载失败'
        allVideos.value = []
    } finally {
        allVideosLoading.value = false
    }
}

const loadLibraryDetail = async (lid: number) => {
    currentLibraryLoading.value = true
    try {
        const detail = await getLibraryDetail({ library_id: lid })
        currentLibrary.value = detail.library ?? null
    } catch (err) {
        console.error('图鉴详情加载失败:', err)
        currentLibrary.value = null
    } finally {
        currentLibraryLoading.value = false
    }
}

const loadSimilar = async (lid: number) => {
    similarLoading.value = true
    try {
        const res = await getLibrarySimilar({ library_id: lid, pageSize: 20 })
        similarRows.value = (res.rows ?? []).filter((r) => r.library_id !== lid)
    } catch {
        similarRows.value = []
    } finally {
        similarLoading.value = false
    }
}

/** 获取当前图鉴的所有 video（含多版型），仅保留点云类型 pk_type=2 */
const loadCurrentVideoList = async (lid: number) => {
    currentVideoListLoading.value = true
    try {
        const list = await getLibraryVideo({ pk_id: lid })
        currentVideoList.value = (list ?? []).filter((v) => v.pk_type === 2 && v.addr)
    } catch (err) {
        console.error('版型列表加载失败:', err)
        currentVideoList.value = []
    } finally {
        currentVideoListLoading.value = false
    }
}

/** 拉取版型 video 详情并构造 SceneJSON 或 modelList（复用 WebGL，不销毁渲染上下文） */
const loadSceneForVideo = async (videoId: number) => {
    modelLoading.value = true
    modelError.value = null
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    try {
        const detail = await getLibraryVideoById({ video_id: videoId })
        if (detail.pk_type !== 2 || !detail.addr) {
            modelError.value = '该视频不是点云类型或缺少模型地址'
            return
        }
        const jd = detail.json_data as
            | (Partial<SceneJSON> & { laxian_list?: LaxianItem[] })
            | undefined
        const objects = jd?.objects
        const hasFullScene = Array.isArray(objects) && objects.length > 0
        if (hasFullScene && jd) {
            sceneJson.value = {
                objects: objects as SceneJSON['objects'],
                cameraList: jd.cameraList,
                background: jd.background,
                lighting: jd.lighting,
                controls: jd.controls
            }
            laxianList.value = Array.isArray(jd.laxian_list) ? jd.laxian_list : []
        } else {
            modelList.value = detail.addr
                .split(',')
                .map((u) => u.trim())
                .filter((u) => !!u)
                .map((url, index) => ({
                    url,
                    type: 'splat' as const,
                    position: [index * 3, 0, 0] as [number, number, number],
                    options: {}
                }))
            laxianList.value = Array.isArray(jd?.laxian_list) ? jd.laxian_list : []
        }
    } catch (err) {
        console.error('版型加载失败:', err)
        modelError.value = err instanceof Error ? err.message : '加载失败'
    } finally {
        modelLoading.value = false
    }
}

const selectVideo = async (video: LibraryVideo) => {
    if (exhibitSwitchBlocked.value) return
    if (!video.video_id) return
    if (currentVideoId.value === video.video_id) return
    currentVideoId.value = video.video_id
    clearSceneViewer()
    await loadSceneForVideo(video.video_id)
}

/** 选中某个图鉴：加载图鉴详情、相似推荐、版型列表，并自动选中第一条版型 */
const selectLibrary = async (lid: number, preferVideoId?: number) => {
    if (exhibitSwitchBlocked.value) return
    if (currentLibraryId.value === lid && !preferVideoId) {
        const first = currentVideoList.value[0]
        if (first) await selectVideo(first)
        return
    }
    currentLibraryId.value = lid
    currentVideoId.value = null
    currentVideoList.value = []
    similarRows.value = []
    currentLibrary.value = null
    clearSceneViewer()
    const group = groupedList.value.find((g) => g.library_id === lid)
    await Promise.all([
        loadLibraryDetail(lid),
        loadSimilar(lid),
        loadCurrentVideoList(lid)
    ])
    await loadShopForSelection(
        currentLibrary.value ?? group?.library ?? null
    )
    const target = preferVideoId
        ? currentVideoList.value.find((v) => v.video_id === preferVideoId)
        : currentVideoList.value[0]
    if (target) await selectVideo(target)
}

/** 按图鉴聚合（仅用于左侧列表展示） */
interface LibraryGroup {
    library_id: number
    library?: Library
    videoCount: number
    cover?: string
    name?: string
}
const groupedList = computed<LibraryGroup[]>(() => {
    const map = new Map<number, LibraryGroup>()
    for (const v of allVideos.value) {
        const lid = v.library?.library_id ?? v.pk_id
        if (lid == null) continue
        let group = map.get(lid)
        if (!group) {
            group = {
                library_id: lid,
                library: v.library,
                videoCount: 0,
                cover: v.library?.cover,
                name: v.library?.name
            }
            map.set(lid, group)
        }
        group.videoCount += 1
    }
    return Array.from(map.values())
})

const jumpToLibrary = (id?: number | null) => {
    if (!id) return
    window.open(`/library/detail/${id}`, '_blank')
}

const jumpToShop = (id?: number | null) => {
    if (!id) return
    window.open(`/shop/detail/${id}`, '_blank')
}

const init = async () => {
    if (!shopId.value && !isGlobalExhibition.value) return
    currentLibraryId.value = null
    currentVideoId.value = null
    currentLibrary.value = null
    similarRows.value = []
    currentVideoList.value = []
    shop.value = null
    displayedShopId.value = null
    clearSceneViewer()
    if (isGlobalExhibition.value) {
        await loadAllVideos()
    } else {
        await Promise.all([loadShop(), loadAllVideos()])
    }
    const first = groupedList.value[0]
    if (first) await selectLibrary(first.library_id)
}

watch(layoutReady, (v) => {
    if (v) init()
})
watch(shopId, () => {
    if (layoutReady.value) init()
})
onMounted(() => {
    if (layoutReady.value) init()
})

watch(isPortraitMobile, triggerViewerResize)
watch(hasSceneViewer, (v) => {
    if (v) triggerViewerResize()
})
watch(
    () => sceneLoadState.value.loading,
    (loading, wasLoading) => {
        if (wasLoading && !loading && hasSceneViewer.value) triggerViewerResize()
    }
)
</script>

<template>
    <div
        class="exhibition-mobile-shell"
        :class="{ 'exhibition-mobile-shell--portrait': isPortraitMobile }"
    >
        <div class="exhibition-landscape-viewport">
            <div class="exhibition-root flex w-full h-full min-h-0 gap-2 md:gap-4 p-2 md:p-4">
        <!-- 左：店铺 + 3D 图鉴列表 -->
        <aside
            class="exhibition-side-left flex flex-col gap-2 md:gap-4 min-h-0 w-[168px] sm:w-[200px] md:w-[300px] xl:w-[340px] shrink-0 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-[4px_0_24px_rgba(0,0,0,0.55)] max-md:transition-transform max-md:duration-300"
            :class="mobileLeftOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'"
        >
            <!-- 店铺信息（固定高度，内容区滚动，避免切换时挤压下方列表） -->
            <section class="museum-panel exhibition-shop-panel overflow-hidden shrink-0 flex flex-col">
                <div class="museum-panel-header shrink-0">
                    <span class="ornament" />
                    <h3 class="title">展馆店主</h3>
                    <span class="ornament" />
                </div>
                <div class="exhibition-shop-panel__body museum-scroll overscroll-contain">
                    <div v-if="shopLoading" class="p-5 h-full min-h-[10rem] flex items-center justify-center">
                        <div class="spinner-gold" />
                    </div>
                    <div v-else-if="shop" class="p-4">
                        <div class="flex items-center gap-3 cursor-pointer group" @click="jumpToShop(shop.shop_id)">
                            <div class="relative flex-shrink-0">
                                <img
                                    v-if="shop.shop_logo"
                                    :src="formatImg(shop.shop_logo, '?x-oss-process=image/quality,q_80/resize,w_160,h_160')"
                                    :alt="shop.shop_name"
                                    class="w-14 h-14 rounded-full object-cover border-2 border-amber-400/60 shadow-[0_0_18px_rgba(212,175,55,0.25)]"
                                />
                                <div class="absolute inset-0 rounded-full ring-1 ring-amber-300/40 pointer-events-none" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h2 class="font-serif text-base font-semibold text-amber-100 truncate group-hover:text-amber-300 transition-colors">{{ shop.shop_name }}</h2>
                                <p class="text-[11px] tracking-widest uppercase text-amber-200/60 mt-0.5">
                                    {{ shop.shop_country === 0 ? 'DOMESTIC' : 'JAPANESE' }} · {{ shop.count_library ?? 0 }} ITEMS
                                </p>
                            </div>
                        </div>
                        <p
                            v-if="shop.shop_describe"
                            class="mt-3 text-xs text-stone-300/80 leading-relaxed font-serif break-words"
                            v-html="shop.shop_describe"
                        />
                        <div v-if="shop.style_list && shop.style_list.length" class="mt-3 flex flex-wrap gap-1">
                            <span
                                v-for="(tag, i) in shop.style_list"
                                :key="i"
                                class="px-2 py-0.5 text-[10px] rounded-full border border-amber-400/30 text-amber-200/90 bg-amber-500/5 tracking-wider"
                            >{{ tag.wiki_name }}</span>
                        </div>
                    </div>
                    <div v-else-if="isGlobalExhibition" class="p-4 h-full min-h-[10rem] flex items-center justify-center text-center text-sm text-stone-400 font-serif leading-relaxed">
                        全站展馆 · 选择藏品后显示对应店主
                    </div>
                    <div v-else class="p-4 h-full min-h-[10rem] flex items-center justify-center text-center text-sm text-stone-400 font-serif">
                        店铺信息不存在
                    </div>
                </div>
            </section>

            <!-- 图鉴列表 -->
            <section class="museum-panel flex-1 min-h-0 flex flex-col">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">藏品列表</h3>
                    <span class="ornament" />
                </div>
                <div class="px-3 pt-2 text-[10px] tracking-[0.25em] text-amber-200/50 text-center font-serif">
                    COLLECTIONS · {{ groupedList.length }}
                </div>
                <div v-if="allVideosLoading" class="flex-1 flex items-center justify-center">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="allVideosError" class="flex-1 flex items-center justify-center text-xs text-rose-300 px-3 text-center">
                    {{ allVideosError }}
                </div>
                <div v-else-if="groupedList.length === 0" class="flex-1 flex items-center justify-center text-xs text-stone-400 px-3 text-center font-serif">
                    本展馆暂无藏品
                </div>
                <div v-else class="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5 museum-scroll">
                    <button
                        v-for="(group, idx) in groupedList"
                        :key="group.library_id"
                        type="button"
                        class="w-full flex items-center gap-2 p-2 text-left rounded-md transition-all duration-300 border border-transparent group disabled:opacity-50 disabled:cursor-not-allowed"
                        :class="currentLibraryId === group.library_id
                            ? 'bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border-amber-400/50 shadow-[0_0_18px_rgba(212,175,55,0.18)]'
                            : 'hover:bg-amber-400/5 hover:border-amber-400/20'"
                        :disabled="exhibitSwitchBlocked"
                        @click="selectLibrary(group.library_id)"
                    >
                        <span class="w-5 text-center font-serif text-[10px] text-amber-300/70 tracking-widest">
                            {{ String(idx + 1).padStart(2, '0') }}
                        </span>
                        <img
                            v-if="group.cover"
                            :src="formatImg(group.cover, '?x-oss-process=image/quality,q_80/resize,w_120,h_120')"
                            :alt="group.name"
                            class="w-11 h-11 rounded-md object-cover flex-shrink-0 border border-amber-400/30"
                        />
                        <div v-else class="w-11 h-11 rounded-md bg-stone-800 flex items-center justify-center flex-shrink-0 border border-amber-400/20">
                            <UIcon name="i-heroicons-cube" class="w-5 h-5 text-amber-300/50" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-serif font-medium text-amber-50 line-clamp-2 leading-snug">
                                {{ group.name || '未命名藏品' }}
                            </p>
                            <p class="mt-0.5 text-[10px] text-amber-200/40 tracking-widest">
                                {{ group.videoCount }} 件版型
                            </p>
                        </div>
                        <UIcon
                            v-if="currentLibraryId === group.library_id"
                            name="material-symbols:chevron-right"
                            class="text-amber-300 text-base flex-shrink-0"
                        />
                    </button>
                </div>
            </section>
        </aside>

        <!-- 中：3D 展示 -->
        <main class="flex-1 min-w-0 flex flex-col gap-2 md:gap-4 min-h-0 relative">
            <section class="museum-stage relative flex-1 min-h-0 overflow-hidden">
                <!-- 移动端侧栏开关 -->
                <div class="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 pointer-events-auto">
                    <button
                        type="button"
                        class="exhibition-mobile-tab"
                        :class="mobileLeftOpen ? 'exhibition-mobile-tab--active' : ''"
                        aria-label="藏品列表"
                        @click="mobileLeftOpen = !mobileLeftOpen; mobileRightOpen = false"
                    >
                        <UIcon name="material-symbols:museum-outline" class="text-base" />
                    </button>
                    <button
                        type="button"
                        class="exhibition-mobile-tab"
                        :class="mobileRightOpen ? 'exhibition-mobile-tab--active' : ''"
                        aria-label="藏品铭牌"
                        @click="mobileRightOpen = !mobileRightOpen; mobileLeftOpen = false"
                    >
                        <UIcon name="material-symbols:info-outline" class="text-base" />
                    </button>
                </div>

                <!-- 顶部：藏品标题与版型切换 -->
                <div class="absolute top-2 md:top-4 left-10 md:left-4 right-2 md:right-4 z-30 flex items-start justify-between gap-2 md:gap-3 pointer-events-none">
                    <div class="pointer-events-auto flex-1 min-w-0">
                        <div class="text-[9px] md:text-[10px] tracking-[0.25em] md:tracking-[0.4em] text-amber-300/70 font-serif">EXHIBIT · 藏品</div>
                        <h2 class="mt-0.5 font-serif text-sm md:text-xl text-amber-50 truncate drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]">
                            {{ currentLibrary?.name || '—' }}
                        </h2>
                    </div>
                    <button
                        v-if="hasSceneViewer"
                        type="button"
                        class="pointer-events-auto flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg border border-amber-400/40 backdrop-blur-md transition-all hover:border-amber-300 hover:bg-amber-400/10 active:scale-95"
                        :class="autoRotate ? 'text-amber-300 bg-amber-500/15' : 'text-amber-100/70 bg-stone-900/40'"
                        :title="autoRotate ? '关闭自动旋转' : '开启自动旋转'"
                        @click="autoRotate = !autoRotate"
                    >
                        <UIcon name="material-symbols:rotate-right" class="text-lg" />
                        <span class="text-[10px] tracking-widest">{{ autoRotate ? 'ROTATING' : 'AUTO' }}</span>
                    </button>
                </div>

                <!-- 底部：版型切换轨道（参考 humanPlatform 多版型） -->
                <button
                    type="button"
                    class="md:hidden absolute bottom-2 right-2 z-30 flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-amber-400/40 bg-stone-950/70 text-amber-100 text-[10px] tracking-widest font-serif backdrop-blur-md pointer-events-auto"
                    @click="mobilePickerOpen = true"
                >
                    <UIcon name="material-symbols:swap-horiz" class="text-sm" />
                    切换
                </button>

                <div
                    v-if="currentVideoList.length > 0"
                    class="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[72%] md:max-w-[80%] pointer-events-auto max-md:pr-14"
                >
                    <div class="flex items-center gap-1.5 px-3 py-2 rounded-full border border-amber-400/40 bg-stone-950/60 backdrop-blur-md shadow-[0_0_24px_rgba(0,0,0,0.4)]">
                        <span class="text-[10px] tracking-[0.3em] text-amber-300/80 pr-1 font-serif">VERSION</span>
                        <div class="h-4 w-px bg-amber-400/30" />
                        <div class="flex items-center gap-1 overflow-x-auto museum-scroll-x max-w-[60vw]">
                            <button
                                v-for="(v, i) in currentVideoList"
                                :key="v.video_id"
                                type="button"
                                class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 border disabled:opacity-50 disabled:cursor-not-allowed"
                                :class="currentVideoId === v.video_id
                                    ? 'bg-amber-400 text-stone-900 border-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.6)]'
                                    : 'text-amber-100/80 border-transparent hover:bg-amber-400/10 hover:text-amber-200'"
                                :disabled="exhibitSwitchBlocked"
                                @click="selectVideo(v)"
                            >
                                {{ v.title || `版型 ${String(i + 1).padStart(2, '0')}` }}
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    v-if="hasSceneViewer && (sceneLoadState.loading || modelLoading)"
                    class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-950/55 backdrop-blur-sm pointer-events-none"
                >
                    <div class="spinner-gold" />
                    <p
                        v-if="sceneLoadState.progress.total > 0"
                        class="mt-3 text-[10px] tracking-[0.3em] text-amber-200/70 font-serif"
                    >
                        {{ sceneLoadState.progress.current }} / {{ sceneLoadState.progress.total }}
                    </p>
                </div>

                <!-- 3D 区域：常驻组件 + v-show，切换时仅 clearSceneContent 复用 WebGL -->
                <client-only>
                    <SPZModelViewerContent
                        ref="spzViewerRef"
                        v-show="hasSceneViewer"
                        class="w-full h-full museum-stage__viewer"
                        :model-list="modelList"
                        :laxian-list="laxianList"
                        :scene-json="sceneJson"
                        :auto-rotate="autoRotate"
                        :background-color="0x140e08"
                        :show-loading-mask="false"
                        @load-state-change="onSceneLoadStateChange"
                    />
                    <div
                        v-if="!hasSceneViewer"
                        class="w-full h-full flex flex-col items-center justify-center text-amber-200/50 font-serif"
                    >
                        <UIcon name="i-heroicons-cube-transparent" class="text-7xl mb-3 text-amber-400/40" />
                        <p class="text-sm tracking-[0.3em]">
                            {{ allVideosLoading || modelLoading || currentLibraryLoading ? 'LOADING…' : 'NO EXHIBIT SELECTED' }}
                        </p>
                    </div>
                </client-only>

                <!-- 加载错误 -->
                <div v-if="modelError" class="absolute inset-x-0 top-20 mx-auto w-fit z-30 px-4 py-2 rounded-md bg-rose-900/60 border border-rose-400/40 text-rose-100 text-xs font-serif backdrop-blur-md">
                    {{ modelError }}
                </div>

                <!-- 角饰 -->
                <span class="corner-ornament top-2 left-2" />
                <span class="corner-ornament top-2 right-2 rotate-90" />
                <span class="corner-ornament bottom-2 left-2 -rotate-90" />
                <span class="corner-ornament bottom-2 right-2 rotate-180" />
            </section>
        </main>

        <!-- 右：图鉴信息 + 相似推荐 -->
        <aside
            class="exhibition-side-right flex flex-col gap-2 md:gap-4 min-h-0 w-[168px] sm:w-[200px] md:w-[320px] xl:w-[360px] shrink-0 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:shadow-[-4px_0_24px_rgba(0,0,0,0.55)] max-md:transition-transform max-md:duration-300"
            :class="mobileRightOpen ? 'max-md:translate-x-0' : 'max-md:translate-x-full'"
        >
            <section class="museum-panel overflow-hidden">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">藏品铭牌</h3>
                    <span class="ornament" />
                </div>
                <div v-if="currentLibraryLoading" class="p-5 flex items-center justify-center min-h-[180px]">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="currentLibrary" class="p-4">
                    <div class="flex gap-3 cursor-pointer group" @click="jumpToLibrary(currentLibrary.library_id)">
                        <div class="relative flex-shrink-0">
                            <img
                                v-if="currentLibrary.cover"
                                :src="formatImg(currentLibrary.cover, '?x-oss-process=image/quality,q_80/resize,w_240,h_320')"
                                :alt="currentLibrary.name"
                                class="w-20 h-28 rounded-md object-cover border border-amber-400/40 shadow-[0_0_16px_rgba(212,175,55,0.18)]"
                            />
                            <div class="absolute inset-0 rounded-md ring-1 ring-amber-300/30 pointer-events-none" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h2 class="font-serif text-sm font-semibold text-amber-50 line-clamp-2 leading-snug group-hover:text-amber-200 transition-colors">
                                {{ currentLibrary.name }}
                            </h2>
                            <div class="mt-1.5 flex flex-wrap gap-1">
                                <span v-if="currentLibrary.library_pattern" class="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-200/90">{{ currentLibrary.library_pattern }}</span>
                                <span v-if="currentLibrary.library_type" class="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-200/90">{{ currentLibrary.library_type }}</span>
                                <span v-if="currentLibrary.state" class="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-200/90">{{ currentLibrary.state }}</span>
                            </div>
                            <p v-if="currentLibrary.library_price" class="mt-1.5 text-xs text-amber-100/70 font-serif">
                                ¥ {{ currentLibrary.library_price }}
                            </p>
                        </div>
                    </div>

                    <dl class="mt-3 space-y-1.5 text-xs">
                        <div v-if="currentLibrary.pattern_elements" class="flex gap-2">
                            <dt class="w-12 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">柄图</dt>
                            <dd class="flex-1 flex flex-wrap gap-1">
                                <span v-for="el in currentLibrary.pattern_elements.split(',')" :key="el" class="px-1.5 py-0.5 rounded bg-amber-400/5 border border-amber-400/15 text-amber-100/85 text-[10px]">{{ el }}</span>
                            </dd>
                        </div>
                        <div v-if="currentLibrary.design_elements" class="flex gap-2">
                            <dt class="w-12 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">设计</dt>
                            <dd class="flex-1 flex flex-wrap gap-1">
                                <span v-for="el in currentLibrary.design_elements.split(',')" :key="el" class="px-1.5 py-0.5 rounded bg-amber-400/5 border border-amber-400/15 text-amber-100/85 text-[10px]">{{ el }}</span>
                            </dd>
                        </div>
                        <div v-if="currentLibrary.color" class="flex gap-2">
                            <dt class="w-12 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">颜色</dt>
                            <dd class="flex-1 text-amber-100/85">{{ currentLibrary.color }}</dd>
                        </div>
                    </dl>

                    <button
                        type="button"
                        class="mt-3 w-full py-1.5 rounded-md border border-amber-400/50 text-amber-200 text-xs tracking-[0.3em] font-serif hover:bg-amber-400 hover:text-stone-900 transition-colors"
                        @click="jumpToLibrary(currentLibrary.library_id)"
                    >
                        ENTER · 进入图鉴详情
                    </button>
                </div>
                <div v-else class="p-4 text-center text-xs text-stone-400 font-serif">暂未选择藏品</div>
            </section>

            <!-- 相似推荐 -->
            <section class="museum-panel flex-1 min-h-0 flex flex-col">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">相似推荐</h3>
                    <span class="ornament" />
                </div>
                <div v-if="similarLoading" class="flex-1 flex items-center justify-center">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="similarRows.length === 0" class="flex-1 flex items-center justify-center text-xs text-stone-400 font-serif">
                    暂无相似藏品
                </div>
                <div v-else class="flex-1 overflow-y-auto overscroll-contain p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start museum-scroll">
                    <button
                        v-for="item in similarRows"
                        :key="item.library_id"
                        type="button"
                        class="block rounded-md border border-amber-400/15 overflow-hidden bg-stone-950/40 text-left hover:border-amber-400/50 hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] transition-all"
                        @click="jumpToLibrary(item.library_id)"
                    >
                        <div class="relative aspect-[3/4] w-full">
                            <img
                                :src="formatImg(item.cover, '?x-oss-process=image/quality,q_80/resize,w_220,h_300')"
                                :alt="item.name"
                                class="w-full h-full object-cover"
                                loading="lazy"
                            />
                            <span
                                v-if="item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))"
                                class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-400/90 text-stone-900"
                            >
                                {{ formatSimilarityScore(Number(item.similarity_score)) }}
                            </span>
                        </div>
                        <div class="p-1.5">
                            <p class="text-xs font-serif font-medium text-amber-50 leading-snug line-clamp-2" :title="item.name">{{ item.name }}</p>
                            <p
                                v-if="item.shop?.shop_name"
                                class="text-[10px] text-amber-200/50 truncate mt-0.5"
                                :title="item.shop.shop_name"
                            >{{ item.shop.shop_name }}</p>
                        </div>
                    </button>
                </div>
            </section>
        </aside>

            <!-- 移动端遮罩：关闭侧栏 -->
            <div
                v-if="mobileLeftOpen || mobileRightOpen"
                class="md:hidden absolute inset-0 z-30 bg-black/40"
                @click="mobileLeftOpen = false; mobileRightOpen = false"
            />
            </div>

            <!-- 移动端：藏品 / 版型选择（置于横屏视口内，随强制旋转） -->
            <div
                v-if="mobilePickerOpen"
                class="md:hidden absolute inset-0 z-50 flex items-end justify-center bg-black/50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                @click.self="mobilePickerOpen = false"
            >
            <div class="exhibition-picker-modal w-full max-h-[min(72vh,420px)] flex flex-col overflow-hidden" @click.stop>
                <div class="exhibition-picker-modal__header flex items-center justify-between px-3 py-2.5 shrink-0">
                    <h3 class="font-serif text-sm tracking-[0.2em] text-amber-100">切换藏品 / 版型</h3>
                    <button
                        type="button"
                        class="p-1.5 rounded-md text-amber-200/80 hover:bg-amber-400/10"
                        aria-label="关闭"
                        @click="mobilePickerOpen = false"
                    >
                        <UIcon name="material-symbols:close" class="text-lg" />
                    </button>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 space-y-3 museum-scroll">
                    <div>
                        <p class="text-[10px] tracking-widest text-amber-200/50 px-1 mb-1 font-serif">COLLECTIONS</p>
                        <div class="space-y-1">
                            <button
                                v-for="(group, idx) in groupedList"
                                :key="group.library_id"
                                type="button"
                                class="w-full flex items-center gap-2 p-2 text-left rounded-md border border-transparent transition-all disabled:opacity-50"
                                :class="currentLibraryId === group.library_id
                                    ? 'bg-amber-500/15 border-amber-400/50'
                                    : 'hover:bg-amber-400/5'"
                                :disabled="exhibitSwitchBlocked"
                                @click="selectLibrary(group.library_id); mobilePickerOpen = false"
                            >
                                <span class="w-5 text-center text-[10px] text-amber-300/70">{{ String(idx + 1).padStart(2, '0') }}</span>
                                <img
                                    v-if="group.cover"
                                    :src="formatImg(group.cover, '?x-oss-process=image/quality,q_80/resize,w_80,h_80')"
                                    :alt="group.name"
                                    class="w-9 h-9 rounded object-cover border border-amber-400/30"
                                />
                                <span class="flex-1 text-xs text-amber-50 line-clamp-1 font-serif">{{ group.name || '未命名藏品' }}</span>
                            </button>
                        </div>
                    </div>
                    <div v-if="currentVideoList.length > 0">
                        <p class="text-[10px] tracking-widest text-amber-200/50 px-1 mb-1 font-serif">VERSION</p>
                        <div class="flex flex-wrap gap-1">
                            <button
                                v-for="(v, i) in currentVideoList"
                                :key="v.video_id"
                                type="button"
                                class="px-2.5 py-1 rounded-full text-xs border disabled:opacity-50"
                                :class="currentVideoId === v.video_id
                                    ? 'bg-amber-400 text-stone-900 border-amber-300'
                                    : 'text-amber-100/80 border-amber-400/20'"
                                :disabled="exhibitSwitchBlocked"
                                @click="selectVideo(v); mobilePickerOpen = false"
                            >
                                {{ v.title || `版型 ${String(i + 1).padStart(2, '0')}` }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 移动端全屏 + 竖屏时 CSS 强制横屏视口 */
.exhibition-mobile-shell {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #110c08;
    z-index: 1;
}

@media (min-width: 768px) {
    .exhibition-mobile-shell {
        position: relative;
    }
}

.exhibition-landscape-viewport {
    width: 100%;
    height: 100%;
    position: relative;
}

@media (max-width: 767px) {
    .exhibition-mobile-shell--portrait .exhibition-landscape-viewport {
        position: absolute;
        width: 100vh;
        width: 100dvh;
        height: 100vw;
        height: 100dvw;
        top: 0;
        left: 100vw;
        left: 100dvw;
        transform: rotate(90deg);
        transform-origin: top left;
        overflow: hidden;
    }
}

.exhibition-mobile-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(212, 175, 55, 0.35);
    background: rgba(12, 8, 5, 0.75);
    color: rgba(244, 228, 176, 0.85);
    backdrop-filter: blur(6px);
    transition: background 0.2s, border-color 0.2s;
}
.exhibition-mobile-tab--active {
    border-color: rgba(212, 175, 55, 0.65);
    background: rgba(212, 175, 55, 0.15);
    color: #f4d06f;
}

.exhibition-picker-modal {
    background: linear-gradient(180deg, rgba(40, 28, 18, 0.98), rgba(22, 16, 10, 0.99));
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 10px;
    box-shadow:
        0 0 0 1px rgba(212, 175, 55, 0.1) inset,
        0 16px 48px rgba(0, 0, 0, 0.55);
    color: #f5e9c8;
}
.exhibition-picker-modal__header {
    border-bottom: 1px solid rgba(212, 175, 55, 0.22);
}

/* ====== 古典博物馆主题 ====== */
.exhibition-root {
    background:
        radial-gradient(1200px 600px at 50% -200px, rgba(212, 175, 55, 0.12), transparent 60%),
        radial-gradient(800px 500px at 90% 110%, rgba(120, 53, 15, 0.18), transparent 60%),
        linear-gradient(180deg, #1a140d 0%, #110c08 100%);
    color: #f5e9c8;
}

.museum-panel {
    position: relative;
    background:
        linear-gradient(180deg, rgba(40, 28, 18, 0.85), rgba(26, 20, 14, 0.92));
    border: 1px solid rgba(212, 175, 55, 0.28);
    border-radius: 8px;
    box-shadow:
        0 0 0 1px rgba(212, 175, 55, 0.08) inset,
        0 10px 30px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
}

.museum-panel::before,
.museum-panel::after {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.45), transparent);
    pointer-events: none;
}

.museum-panel::before { top: 4px; }
.museum-panel::after { bottom: 4px; }

.museum-panel-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 14px 6px;
}
.museum-panel-header .title {
    font-family: 'Times New Roman', 'Songti SC', 'STSong', serif;
    font-size: 14px;
    letter-spacing: 0.35em;
    color: #f4e4b0;
    text-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
}
.museum-panel-header .ornament {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
    position: relative;
}
.museum-panel-header .ornament::after {
    content: '✦';
    position: absolute;
    right: -3px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(212, 175, 55, 0.7);
    font-size: 8px;
}
.museum-panel-header .ornament:first-child::after {
    left: -3px;
    right: auto;
}

/* 左侧店铺信息：固定占位，切换店主时下方藏品列表不跳动 */
.exhibition-shop-panel {
    height: 13.75rem;
    flex-shrink: 0;
}
@media (max-width: 767px) {
    .exhibition-shop-panel {
        height: 8.25rem;
    }
    .exhibition-side-left .museum-panel-header,
    .exhibition-side-right .museum-panel-header {
        padding: 8px 10px 4px;
    }
    .exhibition-side-left .museum-panel-header .title,
    .exhibition-side-right .museum-panel-header .title {
        font-size: 12px;
        letter-spacing: 0.2em;
    }
}
.exhibition-shop-panel__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}

/* 中部展示舞台 */
.museum-stage {
    background:
        radial-gradient(circle at 50% 100%, rgba(212, 175, 55, 0.18), transparent 65%),
        linear-gradient(180deg, #1c1610 0%, #0c0805 100%);
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 12px;
    box-shadow:
        inset 0 0 80px rgba(0, 0, 0, 0.6),
        0 0 30px rgba(0, 0, 0, 0.5);
}
.museum-stage-bg {
    background:
        radial-gradient(circle at 50% 60%, #2a2018 0%, #110b07 75%);
}

.corner-ornament {
    position: absolute;
    width: 28px;
    height: 28px;
    pointer-events: none;
    border-top: 1px solid rgba(212, 175, 55, 0.55);
    border-left: 1px solid rgba(212, 175, 55, 0.55);
}

/* 列表滚动条 */
.museum-scroll::-webkit-scrollbar { width: 4px; }
.museum-scroll::-webkit-scrollbar-track { background: transparent; }
.museum-scroll::-webkit-scrollbar-thumb {
    background: rgba(212, 175, 55, 0.35);
    border-radius: 2px;
}
.museum-scroll-x::-webkit-scrollbar { height: 4px; }
.museum-scroll-x::-webkit-scrollbar-thumb {
    background: rgba(212, 175, 55, 0.35);
    border-radius: 2px;
}

/* 旋转加载 */
.spinner-gold {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(212, 175, 55, 0.25);
    border-top-color: #f4d06f;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

:deep(#spz-scene-viewer) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent !important;
}
</style>
