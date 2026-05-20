<script setup lang="ts">
// biome-ignore lint/style/useImportType: Vue SFC 供 template 与 InstanceType 使用
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
import type { Library, LibrarySimilarItem, LibraryVideo, Shop } from '@/types/api'
import { getShopDetail } from '@/api/shop'
import {
    getLibraryDetail,
    getLibrarySimilar,
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
const videoList = ref<LibraryVideo[]>([])
const videoListLoading = ref(false)
const videoListError = ref<string | null>(null)

const currentVideo = ref<LibraryVideo | null>(null)
const currentLibrary = ref<Library | null>(null)
const currentLibraryLoading = ref(false)

/** 预留多模型加载能力：addr 可逗号分隔多个 url */
const modelList = ref<ModelItem[]>([])

const similarRows = ref<LibrarySimilarItem[]>([])
const similarLoading = ref(false)

const autoRotate = ref(false)

const formatImg = (url?: string | null, opt = '') => {
    if (!url) return ''
    return `${BASE_IMG}${url}${opt}`
}

const buildModelList = (addr?: string | null): ModelItem[] => {
    if (!addr) return []
    return addr
        .split(',')
        .map((u) => u.trim())
        .filter((u) => !!u)
        .map((url, index) => ({
            url,
            type: 'splat' as const,
            position: [index * 3, 0, 0] as [number, number, number],
            options: {}
        }))
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
const loadVideoList = async () => {
    if (!shopId.value) return
    videoListLoading.value = true
    videoListError.value = null
    try {
        const pageSize = 100
        let page = 1
        const collected: LibraryVideo[] = []
        for (let i = 0; i < 20; i++) {
            const res = await getLibraryVideoList({
                page,
                pageSize,
                pk_type: 2
            })
            const rows = res.rows ?? []
            for (const v of rows) {
                const sid = v.library?.shop_id ?? v.library?.shop?.shop_id
                if (sid === shopId.value && v.addr) collected.push(v)
            }
            if (rows.length < pageSize) break
            page += 1
        }
        videoList.value = collected
    } catch (err) {
        console.error('图鉴列表加载失败:', err)
        videoListError.value = err instanceof Error ? err.message : '加载失败'
        videoList.value = []
    } finally {
        videoListLoading.value = false
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

/** 按图鉴聚合：同一图鉴下可能有多个版型（多个 LibraryVideo） */
interface LibraryGroup {
    library_id: number
    library?: Library
    videos: LibraryVideo[]
}
const groupedList = computed<LibraryGroup[]>(() => {
    const map = new Map<number, LibraryGroup>()
    for (const v of videoList.value) {
        const lid = v.library?.library_id ?? v.pk_id
        if (lid == null) continue
        let group = map.get(lid)
        if (!group) {
            group = { library_id: lid, library: v.library, videos: [] }
            map.set(lid, group)
        }
        group.videos.push(v)
    }
    return Array.from(map.values())
})

/** 当前选中图鉴下的版型列表 */
const currentVersionList = computed<LibraryVideo[]>(() => {
    const lid = currentVideo.value?.library?.library_id ?? currentVideo.value?.pk_id
    if (lid == null) return []
    return videoList.value.filter((v) => (v.library?.library_id ?? v.pk_id) === lid)
})

const selectVideo = (item: LibraryVideo) => {
    if (currentVideo.value?.video_id === item.video_id) return
    currentVideo.value = item
    modelList.value = buildModelList(item.addr)
    const lid = item.library?.library_id ?? item.pk_id
    if (lid != null) {
        currentLibrary.value = item.library ?? currentLibrary.value
        loadLibraryDetail(lid)
        loadSimilar(lid)
    }
}

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
    currentVideo.value = null
    currentLibrary.value = null
    modelList.value = []
    similarRows.value = []
    await Promise.all([loadShop(), loadVideoList()])
    const first = videoList.value[0]
    if (first) selectVideo(first)
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
    <div class="md:hidden p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <UIcon name="material-symbols:desktop-windows-outline" class="text-5xl mb-2 text-purple-400" />
        <p class="font-semibold text-base mb-1">数字展馆暂只适配 PC 端</p>
        <p>请使用电脑浏览器访问以获得最佳体验</p>
    </div>

    <div class="hidden md:flex w-full h-screen gap-3 p-3 bg-gray-50 dark:bg-gray-900">
        <!-- 左侧：店铺信息 + 3D 图鉴列表 -->
        <aside class="w-[280px] xl:w-[320px] flex flex-col gap-3 min-h-0">
            <!-- 店铺信息 -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div v-if="shopLoading" class="p-4 flex items-center justify-center min-h-[120px]">
                    <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                </div>
                <div v-else-if="shop" class="p-3">
                    <div class="flex items-center gap-3 cursor-pointer" @click="jumpToShop(shop.shop_id)">
                        <img
                            v-if="shop.shop_logo"
                            :src="formatImg(shop.shop_logo, '?x-oss-process=image/quality,q_80/resize,w_160,h_160')"
                            :alt="shop.shop_name"
                            class="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-600 shadow-sm flex-shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                            <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{{ shop.shop_name }}</h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                收录 {{ shop.count_library ?? 0 }} · {{ shop.shop_country === 0 ? '国牌' : '日牌' }}
                            </p>
                        </div>
                    </div>
                    <p
                        v-if="shop.shop_describe"
                        class="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed"
                        v-html="shop.shop_describe"
                    />
                    <div v-if="shop.style_list && shop.style_list.length" class="mt-2 flex flex-wrap gap-1">
                        <QhxTag v-for="(tag, i) in shop.style_list.slice(0, 6)" :key="i">{{ tag.wiki_name }}</QhxTag>
                    </div>
                </div>
                <div v-else class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">店铺信息不存在</div>
            </div>

            <!-- 3D 图鉴列表 -->
            <div class="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        3D 图鉴
                        <span class="ml-1 text-xs text-gray-400 font-normal">({{ groupedList.length }})</span>
                    </h3>
                </div>
                <div v-if="videoListLoading" class="flex-1 flex items-center justify-center">
                    <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                </div>
                <div v-else-if="videoListError" class="flex-1 flex items-center justify-center text-xs text-red-500 px-3 text-center">
                    {{ videoListError }}
                </div>
                <div v-else-if="groupedList.length === 0" class="flex-1 flex items-center justify-center text-xs text-gray-400 px-3 text-center">
                    该店铺暂无 3D 图鉴
                </div>
                <div v-else class="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5">
                    <div
                        v-for="group in groupedList"
                        :key="group.library_id"
                        class="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
                    >
                        <!-- 图鉴行 -->
                        <button
                            type="button"
                            class="w-full flex items-center gap-2 p-2 text-left transition-colors"
                            :class="(currentVideo?.library?.library_id ?? currentVideo?.pk_id) === group.library_id
                                ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-700'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                            @click="selectVideo(group.videos[0])"
                        >
                            <img
                                v-if="group.library?.cover"
                                :src="formatImg(group.library.cover, '?x-oss-process=image/quality,q_80/resize,w_120,h_120')"
                                :alt="group.library?.name"
                                class="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                            />
                            <div v-else class="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <UIcon name="i-heroicons-cube" class="w-5 h-5 text-gray-400" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">
                                    {{ group.library?.name || '未命名图鉴' }}
                                </p>
                                <p class="mt-0.5 text-[10px] text-gray-400">{{ group.videos.length }} 个版型</p>
                            </div>
                        </button>
                        <!-- 同图鉴下的多版型 -->
                        <div
                            v-if="group.videos.length > 1 && (currentVideo?.library?.library_id ?? currentVideo?.pk_id) === group.library_id"
                            class="flex flex-wrap gap-1 px-2 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30"
                        >
                            <button
                                v-for="v in group.videos"
                                :key="v.video_id"
                                type="button"
                                class="px-2 py-0.5 rounded text-[10px] font-medium border transition-colors"
                                :class="currentVideo?.video_id === v.video_id
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-300'"
                                @click="selectVideo(v)"
                            >
                                {{ v.title || `版型${group.videos.indexOf(v) + 1}` }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- 中部：3D 区域 -->
        <main class="flex-1 min-w-0 flex flex-col gap-3">
            <div class="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                <!-- 顶部工具栏：版型切换 + 自动旋转 -->
                <div class="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
                    <div
                        v-if="currentVersionList.length > 1"
                        class="pointer-events-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm border border-gray-200/60 dark:border-gray-600/60"
                    >
                        <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">版型</span>
                        <button
                            v-for="v in currentVersionList"
                            :key="v.video_id"
                            type="button"
                            class="px-2 py-0.5 rounded text-xs font-medium transition-colors"
                            :class="currentVideo?.video_id === v.video_id
                                ? 'bg-purple-500 text-white'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700'"
                            @click="selectVideo(v)"
                        >
                            {{ v.title || `版型${currentVersionList.indexOf(v) + 1}` }}
                        </button>
                    </div>
                    <div v-else />
                    <button
                        type="button"
                        class="pointer-events-auto flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm border border-gray-200/60 dark:border-gray-600/60 hover:scale-105 active:scale-95 transition-transform"
                        :class="autoRotate ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'"
                        :title="autoRotate ? '关闭自动旋转' : '开启自动旋转'"
                        @click="autoRotate = !autoRotate"
                    >
                        <UIcon name="material-symbols:rotate-right" class="text-lg" />
                        <span class="text-[10px] font-medium leading-tight">自动旋转</span>
                    </button>
                </div>

                <client-only>
                    <SPZModelViewerContent
                        v-if="modelList.length > 0"
                        :model-list="modelList"
                        :auto-rotate="autoRotate"
                    />
                    <div v-else class="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <UIcon name="i-heroicons-cube-transparent" class="text-6xl mb-2" />
                        <p class="text-sm">{{ videoListLoading ? '正在加载…' : '请从左侧选择一个 3D 图鉴' }}</p>
                    </div>
                </client-only>
            </div>
        </main>

        <!-- 右侧：图鉴信息 + 相似推荐 -->
        <aside class="w-[300px] xl:w-[340px] flex flex-col gap-3 min-h-0">
            <!-- 当前图鉴信息 -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div v-if="currentLibraryLoading" class="p-4 flex items-center justify-center min-h-[160px]">
                    <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                </div>
                <div v-else-if="currentLibrary" class="p-3">
                    <div class="flex gap-3 cursor-pointer" @click="jumpToLibrary(currentLibrary.library_id)">
                        <img
                            v-if="currentLibrary.cover"
                            :src="formatImg(currentLibrary.cover, '?x-oss-process=image/quality,q_80/resize,w_240,h_320')"
                            :alt="currentLibrary.name"
                            class="w-20 h-28 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600 shadow-sm"
                        />
                        <div class="flex-1 min-w-0">
                            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                                {{ currentLibrary.name }}
                            </h2>
                            <div class="mt-1 flex flex-wrap gap-1">
                                <QhxTag v-if="currentLibrary.library_pattern">{{ currentLibrary.library_pattern }}</QhxTag>
                                <QhxTag v-if="currentLibrary.library_type">{{ currentLibrary.library_type }}</QhxTag>
                                <QhxTag v-if="currentLibrary.state">{{ currentLibrary.state }}</QhxTag>
                            </div>
                            <p v-if="currentLibrary.library_price" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                参考价 ¥ {{ currentLibrary.library_price }}
                            </p>
                        </div>
                    </div>
                    <div v-if="currentLibrary.pattern_elements" class="mt-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">柄图:</span>
                        <QhxTag v-for="el in currentLibrary.pattern_elements.split(',')" :key="el">{{ el }}</QhxTag>
                    </div>
                    <div v-if="currentLibrary.design_elements" class="mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">设计:</span>
                        <QhxTag v-for="el in currentLibrary.design_elements.split(',')" :key="el">{{ el }}</QhxTag>
                    </div>
                    <div v-if="currentLibrary.color" class="mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">颜色:</span>
                        <QhxTag>{{ currentLibrary.color }}</QhxTag>
                    </div>
                    <UButton
                        block
                        size="xs"
                        variant="soft"
                        color="primary"
                        class="mt-3"
                        @click="jumpToLibrary(currentLibrary.library_id)"
                    >
                        查看图鉴详情
                    </UButton>
                </div>
                <div v-else class="p-4 text-center text-xs text-gray-400">暂未选择图鉴</div>
            </div>

            <!-- 相似推荐 -->
            <div class="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">相似推荐</h3>
                </div>
                <div v-if="similarLoading" class="flex-1 flex items-center justify-center">
                    <div class="w-6 h-6 border-2 border-purple-400 rounded-full border-t-transparent animate-spin" />
                </div>
                <div v-else-if="similarRows.length === 0" class="flex-1 flex items-center justify-center text-xs text-gray-400">
                    暂无相似推荐
                </div>
                <div v-else class="flex-1 overflow-y-auto overscroll-contain p-2 grid grid-cols-2 gap-2 content-start">
                    <button
                        v-for="item in similarRows"
                        :key="item.library_id"
                        type="button"
                        class="block rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-900/40 text-left"
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
                                class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white"
                            >
                                {{ formatSimilarityScore(Number(item.similarity_score)) }}
                            </span>
                        </div>
                        <div class="p-1.5">
                            <p class="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2" :title="item.name">
                                {{ item.name }}
                            </p>
                            <p
                                v-if="item.shop?.shop_name"
                                class="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5"
                                :title="item.shop.shop_name"
                            >
                                {{ item.shop.shop_name }}
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </aside>
    </div>
</template>

<style scoped>
:deep(#spz-scene-viewer) {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
