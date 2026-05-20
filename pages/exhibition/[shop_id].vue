<script setup lang="ts">
// biome-ignore lint/style/useImportType: Vue SFC 供 template 与 InstanceType 使用
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
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
setLayoutStyle(1)
onBeforeUnmount(() => setLayoutStyle(0))

const shopId = computed(() => {
    const n = Number.parseInt(String(route.params.shop_id ?? ''), 10)
    return Number.isNaN(n) ? 0 : n
})

const shop = ref<Shop | null>(null)
const shopLoading = ref(false)

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

const formatImg = (url?: string | null, opt = '') => {
    if (!url) return ''
    return `${BASE_IMG}${url}${opt}`
}

const formatSimilarityScore = (score: number) => {
    if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
    return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

const loadShop = async () => {
    if (!shopId.value) return
    shopLoading.value = true
    try {
        shop.value = await getShopDetail({ shop_id: shopId.value })
    } catch (err) {
        console.error('店铺信息加载失败:', err)
        shop.value = null
    } finally {
        shopLoading.value = false
    }
}

/** 拉取该店铺所有 3D 视频（按 shop_id 前端过滤；分页累加直至取完） */
const loadAllVideos = async () => {
    if (!shopId.value) return
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
                const sid = v.library?.shop_id ?? v.library?.shop?.shop_id
                if (sid === shopId.value && v.addr && v.pk_type === 2) collected.push(v)
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

/** 选中某条 video（版型）：拉取完整 video 含 json_data，构造 SceneJSON 或 modelList */
const selectVideo = async (video: LibraryVideo) => {
    if (!video.video_id) return
    if (currentVideoId.value === video.video_id) return
    currentVideoId.value = video.video_id
    modelLoading.value = true
    modelError.value = null
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    try {
        const detail = await getLibraryVideoById({ video_id: video.video_id })
        if (detail.pk_type !== 2 || !detail.addr) {
            modelError.value = '该视频不是点云类型或缺少模型地址'
            return
        }
        const jd = detail.json_data as
            | (Partial<SceneJSON> & { laxian_list?: LaxianItem[] })
            | undefined
        const hasFullScene = !!jd && Array.isArray(jd.objects) && jd.objects.length > 0
        if (hasFullScene) {
            sceneJson.value = {
                objects: jd!.objects as SceneJSON['objects'],
                cameraList: jd!.cameraList,
                background: jd!.background,
                lighting: jd!.lighting,
                controls: jd!.controls
            }
            laxianList.value = Array.isArray(jd?.laxian_list) ? jd!.laxian_list! : []
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
            laxianList.value = Array.isArray(jd?.laxian_list) ? jd!.laxian_list! : []
        }
    } catch (err) {
        console.error('版型加载失败:', err)
        modelError.value = err instanceof Error ? err.message : '加载失败'
    } finally {
        modelLoading.value = false
    }
}

/** 选中某个图鉴：加载图鉴详情、相似推荐、版型列表，并自动选中第一条版型 */
const selectLibrary = async (lid: number, preferVideoId?: number) => {
    if (currentLibraryId.value === lid && !preferVideoId) {
        const first = currentVideoList.value[0]
        if (first) await selectVideo(first)
        return
    }
    currentLibraryId.value = lid
    currentVideoId.value = null
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    currentVideoList.value = []
    similarRows.value = []
    currentLibrary.value = null
    await Promise.all([
        loadLibraryDetail(lid),
        loadSimilar(lid),
        loadCurrentVideoList(lid)
    ])
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
    if (!shopId.value) return
    currentLibraryId.value = null
    currentVideoId.value = null
    currentLibrary.value = null
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    similarRows.value = []
    currentVideoList.value = []
    await Promise.all([loadShop(), loadAllVideos()])
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
</script>

<template>
    <!-- 移动端不适配：提示用户切换至 PC 端 -->
    <div class="md:hidden p-8 text-center text-sm text-stone-300 bg-stone-900 min-h-screen flex flex-col items-center justify-center">
        <UIcon name="material-symbols:desktop-windows-outline" class="text-6xl mb-3 text-amber-400" />
        <p class="font-serif font-semibold text-lg mb-1 tracking-wider text-amber-200">数字展馆</p>
        <p class="text-amber-100/70">PLEASE VISIT ON DESKTOP</p>
        <p class="mt-3 text-xs text-stone-400">本展馆暂只适配 PC 端，请使用电脑浏览器访问</p>
    </div>

    <div class="exhibition-root hidden md:flex w-full h-screen gap-4 p-4">
        <!-- 左：店铺 + 3D 图鉴列表 -->
        <aside class="w-[300px] xl:w-[340px] flex flex-col gap-4 min-h-0">
            <!-- 店铺信息 -->
            <section class="museum-panel overflow-hidden">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">展馆主理</h3>
                    <span class="ornament" />
                </div>
                <div v-if="shopLoading" class="p-5 flex items-center justify-center min-h-[120px]">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="shop" class="p-4">
                    <div class="flex items-center gap-3 cursor-pointer group" @click="jumpToShop(shop.shop_id)">
                        <div class="relative">
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
                        class="mt-3 text-xs text-stone-300/80 line-clamp-3 leading-relaxed font-serif"
                        v-html="shop.shop_describe"
                    />
                    <div v-if="shop.style_list && shop.style_list.length" class="mt-3 flex flex-wrap gap-1">
                        <span
                            v-for="(tag, i) in shop.style_list.slice(0, 6)"
                            :key="i"
                            class="px-2 py-0.5 text-[10px] rounded-full border border-amber-400/30 text-amber-200/90 bg-amber-500/5 tracking-wider"
                        >{{ tag.wiki_name }}</span>
                    </div>
                </div>
                <div v-else class="p-4 text-center text-sm text-stone-400 font-serif">店铺信息不存在</div>
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
                        class="w-full flex items-center gap-2 p-2 text-left rounded-md transition-all duration-300 border border-transparent group"
                        :class="currentLibraryId === group.library_id
                            ? 'bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border-amber-400/50 shadow-[0_0_18px_rgba(212,175,55,0.18)]'
                            : 'hover:bg-amber-400/5 hover:border-amber-400/20'"
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
        <main class="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
            <section class="museum-stage relative flex-1 min-h-0 overflow-hidden">
                <!-- 顶部：藏品标题与版型切换 -->
                <div class="absolute top-4 left-4 right-4 z-30 flex items-start justify-between gap-3 pointer-events-none">
                    <div class="pointer-events-auto flex-1 min-w-0">
                        <div class="text-[10px] tracking-[0.4em] text-amber-300/70 font-serif">EXHIBIT · 藏品</div>
                        <h2 class="mt-0.5 font-serif text-xl text-amber-50 truncate drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]">
                            {{ currentLibrary?.name || '—' }}
                        </h2>
                    </div>
                    <button
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
                <div
                    v-if="currentVideoList.length > 0"
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[80%] pointer-events-auto"
                >
                    <div class="flex items-center gap-1.5 px-3 py-2 rounded-full border border-amber-400/40 bg-stone-950/60 backdrop-blur-md shadow-[0_0_24px_rgba(0,0,0,0.4)]">
                        <span class="text-[10px] tracking-[0.3em] text-amber-300/80 pr-1 font-serif">VERSION</span>
                        <div class="h-4 w-px bg-amber-400/30" />
                        <div class="flex items-center gap-1 overflow-x-auto museum-scroll-x max-w-[60vw]">
                            <button
                                v-for="(v, i) in currentVideoList"
                                :key="v.video_id"
                                type="button"
                                class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 border"
                                :class="currentVideoId === v.video_id
                                    ? 'bg-amber-400 text-stone-900 border-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.6)]'
                                    : 'text-amber-100/80 border-transparent hover:bg-amber-400/10 hover:text-amber-200'"
                                @click="selectVideo(v)"
                            >
                                {{ v.title || `版型 ${String(i + 1).padStart(2, '0')}` }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 3D 区域 -->
                <client-only>
                    <SPZModelViewerContent
                        v-if="(sceneJson && sceneJson.objects && sceneJson.objects.length > 0) || modelList.length > 0"
                        :model-list="modelList"
                        :laxian-list="laxianList"
                        :scene-json="sceneJson"
                        :auto-rotate="autoRotate"
                        :background-color="0x140e08"
                    />
                    <div
                        v-else
                        class="w-full h-full flex flex-col items-center justify-center text-amber-200/50 font-serif"
                    >
                        <UIcon name="i-heroicons-cube-transparent" class="text-7xl mb-3 text-amber-400/40" />
                        <p class="text-sm tracking-[0.3em]">{{ allVideosLoading || modelLoading ? 'LOADING…' : 'NO EXHIBIT SELECTED' }}</p>
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
        <aside class="w-[320px] xl:w-[360px] flex flex-col gap-4 min-h-0">
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
                <div v-else class="flex-1 overflow-y-auto overscroll-contain p-2 grid grid-cols-2 gap-2 content-start museum-scroll">
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
    </div>
</template>

<style scoped>
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
