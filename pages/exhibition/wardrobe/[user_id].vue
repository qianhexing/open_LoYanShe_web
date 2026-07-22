<script setup lang="ts">
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'
import type { SceneLoadState } from '@/components/ModelViewer/SPZModelViewerContent.vue'
import type { Wardrobe, WardrobeClothes, User, Library, Shop, LaxianItem } from '@/types/api'
import type { Material, MaterialForeign } from '@/types/api'
import type { SceneJSON } from '@/utils/threeCore'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'
import ClothesFavoriteCoverOverlay from '@/components/Clothes/ClothesFavoriteCoverOverlay.vue'
import PhysicsDrop from '@/components/PhysicsDrop.client.vue'
import { getUserSpace } from '@/api/user'
import { getSceneId } from '@/api/scene'
import {
    getWardrobeList,
    getClothesListAllFallback,
    getClothesDetail,
    checkWadrobePassword
} from '@/api/wardrobe'
import { getCommunityForeignList } from '@/api/community'
import { BASE_IMG } from '@/utils/ipConfig'
import { useLayoutStyle } from '@/composables/useLayoutStyle'

interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    options?: Record<string, unknown>
}

interface ExtendedWardrobeClothes extends WardrobeClothes {
    library?: Library
    wardrobe?: Wardrobe
    origin_shop?: Shop
    detail_image_list?: string[]
}

definePageMeta({ name: 'exhibition-wardrobe-detail' })
useHead({
    title: '衣柜展馆 - Lo研社',
    meta: [
        { name: 'description', content: '衣柜展馆 - 服饰与记忆展示' }
    ]
})

const route = useRoute()
const config = useConfigStore()
const layoutReady = inject('layoutReady') as Ref<boolean>
const { setLayoutStyle } = useLayoutStyle()
setLayoutStyle(1)
onBeforeUnmount(() => setLayoutStyle(0))

const MEMORY_PK_TYPE = 2 as const

const userId = computed(() => {
    const n = Number.parseInt(String(route.params.user_id ?? ''), 10)
    return Number.isNaN(n) ? 0 : n
})

const password = computed(() => {
    const p = route.query.password
    return typeof p === 'string' ? p : ''
})

const owner = ref<User | null>(null)
const ownerLoading = ref(false)

const wardrobeList = ref<Wardrobe[]>([])
const wardrobesLoading = ref(false)
const wardrobesError = ref<string | null>(null)

const currentWardrobeId = ref<number | null>(null)
const clothesRows = ref<WardrobeClothes[]>([])
const clothesLoading = ref(false)
const clothesError = ref<string | null>(null)

const currentClothesId = ref<number | null>(null)
const detail = ref<ExtendedWardrobeClothes | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const memoryCount = ref(0)
const memoryListKey = ref(0)

/** 喂给 SPZModelViewerContent（互斥优先：sceneJson > modelList） */
const sceneJson = ref<SceneJSON | null>(null)
const modelList = ref<ModelItem[]>([])
const laxianList = ref<LaxianItem[]>([])
const modelLoading = ref(false)
const modelError = ref<string | null>(null)
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

/** 接口拉取或 WebGL 场景加载中，禁止切换服饰/衣柜 */
const exhibitSwitchBlocked = computed(
    () =>
        sceneLoadState.value.loading
        || modelLoading.value
        || detailLoading.value
        || clothesLoading.value
)

const showPasswordModal = ref(false)
const showWardrobePickerModal = ref(false)
const passwordInput = ref('')
const pendingWardrobe = ref<Wardrobe | null>(null)

const imageSuffix = computed(() => config.config?.image_params ?? '')

const formatImg = (url?: string | null, opt = '') => {
    if (!url) return ''
    return `${BASE_IMG}${url}${opt}`
}

const formatClothesImg = (url?: string | null) => {
    if (!url) return ''
    return `${BASE_IMG}${url}${imageSuffix.value}`
}

const favoriteLevelDisplay = computed(() => {
    const v = detail.value?.is_favorite
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.min(5, Math.max(0, Math.round(n)))
})

const currentWardrobe = computed(() =>
    wardrobeList.value.find((w) => w.wardrobe_id === currentWardrobeId.value) ?? null
)

const physicsDropModels = computed(() => {
    const modelList = detail.value?.model_list
    if (!detail.value || !Array.isArray(modelList)) return []
    return modelList
        .filter((item): item is MaterialForeign & { material_box: NonNullable<Material> } =>
            !!item && item.is_enable === 0 && !!item.material_box?.materia_url
        )
        .map((item) => ({
            url: item.material_box.materia_url,
            id: item.materia_id ?? item.material_box.materia_id,
            name: item.material_box.materia_title || '未命名',
            options: item.material_box.options || { useDracoLoader: true }
        }))
})

const hasSceneViewer = computed(
    () =>
        (sceneJson.value?.objects != null && sceneJson.value.objects.length > 0)
        || modelList.value.length > 0
)
const hasPhysics = computed(() => physicsDropModels.value.length > 0)
const showStageImage = computed(
    () =>
        !!detail.value?.clothes_img
        && !hasSceneViewer.value
        && !hasPhysics.value
        && !modelLoading.value
        && !sceneLoadState.value.loading
)

const clearSceneViewer = () => {
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    modelError.value = null
    spzViewerRef.value?.clearSceneContent()
}

/** 服饰关联场景：拉取 `/sence/id` 详情并构造 SceneJSON 或 modelList */
const loadSceneForClothes = async (senceId: number) => {
    modelLoading.value = true
    modelError.value = null
    sceneJson.value = null
    modelList.value = []
    laxianList.value = []
    try {
        const sceneDetail = await getSceneId({ sence_id: senceId })
        const jd = sceneDetail.json_data as
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
        } else if (sceneDetail.addr) {
            const splatExt = /\.(ply|spz|splat|ksplat|sog|zip|rad)(\?|#|$)/i
            modelList.value = sceneDetail.addr
                .split(',')
                .map((u) => u.trim())
                .filter((u) => !!u)
                .map((url, index) => ({
                    url,
                    type: (splatExt.test(url) ? 'splat' : 'model') as 'splat' | 'model',
                    position: [index * 3, 0, 0] as [number, number, number],
                    options: {}
                }))
            laxianList.value = Array.isArray(jd?.laxian_list) ? jd.laxian_list : []
        } else {
            modelError.value = '场景缺少可展示的 3D 数据'
        }
    } catch (err) {
        console.error('场景加载失败:', err)
        modelError.value = err instanceof Error ? err.message : '场景加载失败'
    } finally {
        modelLoading.value = false
    }
}

const loadOwner = async () => {
    if (!userId.value) return
    ownerLoading.value = true
    try {
        owner.value = await getUserSpace({ user_id: userId.value })
    } catch (err) {
        console.error('用户信息加载失败:', err)
        owner.value = null
    } finally {
        ownerLoading.value = false
    }
}

const loadWardrobes = async () => {
    if (!userId.value) return
    wardrobesLoading.value = true
    wardrobesError.value = null
    try {
        const res = await getWardrobeList({ user_id: userId.value, pageSize: 999 })
        wardrobeList.value = (res.rows ?? []).filter((w) => w.is_enable !== 1)
    } catch (err) {
        console.error('衣柜列表加载失败:', err)
        wardrobesError.value = err instanceof Error ? err.message : '加载失败'
        wardrobeList.value = []
    } finally {
        wardrobesLoading.value = false
    }
}

const loadClothesForWardrobe = async (wid: number) => {
    clothesLoading.value = true
    clothesError.value = null
    try {
        const rows = await getClothesListAllFallback({
            wardrobe_id: wid,
            password: password.value || undefined,
            attributes: ['clothes_img', 'clothes_note', 'clothes_part']
        })
        clothesRows.value = rows.filter((c) => c.is_enable !== 1)
    } catch (err) {
        console.error('服饰列表加载失败:', err)
        clothesError.value = err instanceof Error ? err.message : '加载失败'
        clothesRows.value = []
    } finally {
        clothesLoading.value = false
    }
}

const enrichClothesDetail = (data: ExtendedWardrobeClothes) => {
    if (data.detail_image) {
        data.detail_image_list = data.detail_image.split(',').filter(Boolean)
    } else {
        data.detail_image_list = []
    }
    if (data.include_clothes && data.include_clothes !== '' && data.include?.length) {
        const include: WardrobeClothes[] = []
        for (const idStr of data.include_clothes.split(',')) {
            const index = data.include.findIndex(
                (child) => child.clothes_id === Number.parseInt(idStr, 10)
            )
            if (index !== -1) include.push(data.include[index])
        }
        data.include = include
    }
    return data
}

const loadClothesDetail = async (cid: number) => {
    detailLoading.value = true
    detailError.value = null
    clearSceneViewer()
    try {
        const raw = await getClothesDetail({ clothes_id: cid })
        detail.value = enrichClothesDetail(raw as ExtendedWardrobeClothes)
        void fetchMemoryCount(cid)
        const sid = detail.value?.sence_id
        if (sid) {
            await loadSceneForClothes(sid)
        }
    } catch (err) {
        console.error('服饰详情加载失败:', err)
        detailError.value = err instanceof Error ? err.message : '加载失败'
        detail.value = null
    } finally {
        detailLoading.value = false
    }
}

const fetchMemoryCount = async (cid: number) => {
    try {
        const res = await getCommunityForeignList({
            page: 1,
            pageSize: 1,
            pk_id: cid,
            pk_type: MEMORY_PK_TYPE
        })
        memoryCount.value = res.count ?? 0
    } catch {
        /* 保持原数量 */
    }
}

const selectClothes = async (item: WardrobeClothes) => {
    if (exhibitSwitchBlocked.value) return
    const cid = item.clothes_id
    if (!cid || currentClothesId.value === cid) return
    currentClothesId.value = cid
    detail.value = null
    memoryCount.value = 0
    clearSceneViewer()
    await loadClothesDetail(cid)
}

const applyWardrobeSelection = async (item: Wardrobe, preferClothesId?: number) => {
    const wid = item.wardrobe_id
    if (!wid) return
    currentWardrobeId.value = wid
    currentClothesId.value = null
    detail.value = null
    memoryCount.value = 0
    clearSceneViewer()
    clothesRows.value = []
    await loadClothesForWardrobe(wid)
    const prefer = preferClothesId
        ? clothesRows.value.find((c) => c.clothes_id === preferClothesId)
        : clothesRows.value[0]
    if (prefer?.clothes_id) await selectClothes(prefer)
}

const selectWardrobe = async (item: Wardrobe, preferClothesId?: number) => {
    if (exhibitSwitchBlocked.value) return
    if (!item.wardrobe_id) return
    if (currentWardrobeId.value === item.wardrobe_id && !preferClothesId) {
        const first = clothesRows.value[0]
        if (first) await selectClothes(first)
        return
    }
    if (item.password && !password.value) {
        pendingWardrobe.value = item
        passwordInput.value = ''
        showPasswordModal.value = true
        return
    }
    await applyWardrobeSelection(item, preferClothesId)
}

const pickWardrobeFromModal = async (item: Wardrobe) => {
    if (exhibitSwitchBlocked.value) return
    showWardrobePickerModal.value = false
    await selectWardrobe(item)
}

const confirmPassword = async () => {
    const item = pendingWardrobe.value
    if (!item?.wardrobe_id) return
    try {
        await checkWadrobePassword({
            wardrobe_id: item.wardrobe_id,
            password: passwordInput.value
        })
        showPasswordModal.value = false
        pendingWardrobe.value = null
        await navigateTo({
            path: route.path,
            query: { ...route.query, password: passwordInput.value, wardrobe_id: String(item.wardrobe_id) }
        })
        await applyWardrobeSelection(item)
    } catch {
        detailError.value = '衣柜密码错误'
    }
}

const onMemoryCountChange = (count: number) => {
    memoryCount.value = count
}

const jumpToUserSpace = () => {
    if (!userId.value) return
    window.open(`/userSpace/${userId.value}`, '_blank')
}

const jumpToWardrobe = (wid?: number | null) => {
    if (!userId.value) return
    const q = wid ? `?wardrobe_id=${wid}` : ''
    window.open(`/wardrobe/detail/${userId.value}${q}`, '_blank')
}

const jumpToClothes = (cid?: number | null) => {
    if (!cid) return
    window.open(`/clothes/detail/${cid}`, '_blank')
}

const jumpToLibrary = (lid?: number | null) => {
    if (!lid) return
    window.open(`/library/detail/${lid}`, '_blank')
}

const init = async () => {
    if (!userId.value) return
    currentWardrobeId.value = null
    currentClothesId.value = null
    detail.value = null
    clothesRows.value = []
    memoryCount.value = 0
    clearSceneViewer()
    await Promise.all([loadOwner(), loadWardrobes()])

    const qWid = Number.parseInt(String(route.query.wardrobe_id ?? ''), 10)
    const qCid = Number.parseInt(String(route.query.clothes_id ?? ''), 10)
    const targetWardrobe = Number.isFinite(qWid)
        ? wardrobeList.value.find((w) => w.wardrobe_id === qWid)
        : wardrobeList.value[0]
    if (targetWardrobe) {
        await selectWardrobe(
            targetWardrobe,
            Number.isFinite(qCid) ? qCid : undefined
        )
    }
}

watch(layoutReady, (v) => {
    if (v) init()
})
watch(userId, () => {
    if (layoutReady.value) init()
})
onMounted(() => {
    if (layoutReady.value) init()
})
</script>

<template>
    <div class="md:hidden p-8 text-center text-sm text-stone-300 bg-stone-900 min-h-screen flex flex-col items-center justify-center">
        <UIcon name="material-symbols:checkroom-outline" class="text-6xl mb-3 text-amber-400" />
        <p class="font-serif font-semibold text-lg mb-1 tracking-wider text-amber-200">衣柜展馆</p>
        <p class="text-amber-100/70">PLEASE VISIT ON DESKTOP</p>
        <p class="mt-3 text-xs text-stone-400">本展馆暂只适配 PC 端，请使用电脑浏览器访问</p>
    </div>

    <div class="exhibition-root hidden md:flex w-full h-screen gap-4 p-4">
        <!-- 左：用户 + 服饰列表 -->
        <aside class="w-[300px] xl:w-[340px] flex flex-col gap-4 min-h-0">
            <section class="museum-panel overflow-hidden">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">展馆主人</h3>
                    <span class="ornament" />
                </div>
                <div v-if="ownerLoading" class="p-5 flex items-center justify-center min-h-[120px]">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="owner" class="p-4 cursor-pointer group" @click="jumpToUserSpace">
                    <div class="flex items-center gap-3">
                        <UserFace :user="owner" size="mini" class="flex-shrink-0 scale-110" />
                        <div class="flex-1 min-w-0">
                            <h2 class="font-serif text-base font-semibold text-amber-50 truncate group-hover:text-amber-200 transition-colors">
                                {{ owner.user_name || '未设置昵称' }}
                            </h2>
                            <p class="text-[11px] tracking-widest uppercase text-amber-200/60 mt-0.5">
                                WARDROBE · {{ wardrobeList.length }} CLOSETS
                            </p>
                        </div>
                    </div>
                    <p
                        v-if="owner.signature"
                        class="mt-3 text-xs text-stone-300/80 line-clamp-3 leading-relaxed font-serif"
                    >
                        {{ owner.signature }}
                    </p>
                </div>
                <div v-else class="p-4 text-center text-sm text-stone-400 font-serif">用户不存在</div>
            </section>

            <!-- 当前衣柜（点击打开弹窗切换） -->
            <section v-if="wardrobeList.length > 0 || wardrobesLoading" class="museum-panel overflow-hidden">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">当前衣柜</h3>
                    <span class="ornament" />
                </div>
                <div v-if="wardrobesLoading" class="p-4 flex items-center justify-center min-h-[88px]">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="wardrobesError" class="p-4 text-center text-xs text-amber-300 font-serif">
                    {{ wardrobesError }}
                </div>
                <button
                    v-else
                    type="button"
                    class="w-full p-4 text-left transition-colors hover:bg-amber-400/5 group disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="exhibitSwitchBlocked"
                    @click="showWardrobePickerModal = true"
                >
                    <div v-if="currentWardrobe" class="flex items-center gap-3">
                        <div class="relative flex-shrink-0">
                            <img
                                v-if="currentWardrobe.wardrobe_cover"
                                :src="formatImg(currentWardrobe.wardrobe_cover, '?x-oss-process=image/quality,q_80/resize,w_160,h_160')"
                                :alt="currentWardrobe.wardrobe_name"
                                class="w-14 h-14 rounded-md object-cover border border-amber-400/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                            />
                            <div
                                v-else
                                class="w-14 h-14 rounded-md bg-stone-800 flex items-center justify-center border border-amber-400/25"
                            >
                                <UIcon name="material-symbols:checkroom-outline" class="w-6 h-6 text-amber-300/50" />
                            </div>
                            <UIcon
                                v-if="currentWardrobe.password"
                                name="i-heroicons-lock-closed"
                                class="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-amber-200 bg-stone-900/90 rounded-full p-0.5"
                            />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-serif text-sm font-semibold text-amber-50 truncate group-hover:text-amber-200 transition-colors">
                                {{ currentWardrobe.wardrobe_name || '未命名衣柜' }}
                            </h3>
                            <p class="text-[10px] tracking-widest text-amber-200/50 mt-0.5 font-serif">
                                {{ currentWardrobe.count_clothes ?? clothesRows.length }} 件服饰
                            </p>
                            <p
                                v-if="currentWardrobe.wardrobe_desc"
                                class="mt-1 text-[11px] text-stone-300/75 line-clamp-2 leading-relaxed font-serif"
                            >
                                {{ currentWardrobe.wardrobe_desc }}
                            </p>
                        </div>
                        <div class="flex flex-col items-center gap-0.5 flex-shrink-0 text-amber-300/70 group-hover:text-amber-200">
                            <UIcon name="i-heroicons-arrows-right-left" class="w-4 h-4" />
                            <span class="text-[9px] tracking-[0.2em] font-serif">切换</span>
                        </div>
                    </div>
                    <div v-else class="flex items-center justify-center gap-2 py-2 text-xs text-amber-200/60 font-serif">
                        <UIcon name="i-heroicons-cursor-arrow-rays" class="w-4 h-4" />
                        点击选择衣柜
                    </div>
                </button>
            </section>

            <section class="museum-panel flex-1 min-h-0 flex flex-col">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">服饰列表</h3>
                    <span class="ornament" />
                </div>
                <div class="px-3 pt-2 text-[10px] tracking-[0.25em] text-amber-200/50 text-center font-serif">
                    GARMENTS · {{ clothesRows.length }}
                </div>
                <div v-if="clothesLoading" class="flex-1 flex items-center justify-center">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="clothesError" class="flex-1 flex items-center justify-center text-xs text-amber-300 px-3 text-center">
                    {{ clothesError }}
                </div>
                <div v-else-if="!currentWardrobeId" class="flex-1 flex items-center justify-center text-xs text-stone-400 px-3 text-center font-serif">
                    请先选择衣柜
                </div>
                <div v-else-if="clothesRows.length === 0" class="flex-1 flex items-center justify-center text-xs text-stone-400 px-3 text-center font-serif">
                    该衣柜暂无服饰
                </div>
                <div v-else class="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5 museum-scroll">
                    <button
                        v-for="(item, idx) in clothesRows"
                        :key="item.clothes_id"
                        type="button"
                        class="w-full flex items-center gap-2 p-2 text-left rounded-md transition-all duration-300 border border-transparent group disabled:opacity-50 disabled:cursor-not-allowed"
                        :class="currentClothesId === item.clothes_id
                            ? 'bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border-amber-400/50 shadow-[0_0_18px_rgba(212,175,55,0.18)]'
                            : 'hover:bg-amber-400/5 hover:border-amber-400/20'"
                        :disabled="exhibitSwitchBlocked"
                        @click="selectClothes(item)"
                    >
                        <span class="w-5 text-center font-serif text-[10px] text-amber-300/70 tracking-widest">
                            {{ String(idx + 1).padStart(2, '0') }}
                        </span>
                        <img
                            v-if="item.clothes_img"
                            :src="formatClothesImg(item.clothes_img)"
                            :alt="item.clothes_note"
                            class="w-11 h-11 rounded-md object-cover flex-shrink-0 border border-amber-400/30"
                        />
                        <div v-else class="w-11 h-11 rounded-md bg-stone-800 flex items-center justify-center flex-shrink-0 border border-amber-400/20">
                            <UIcon name="i-heroicons-photo" class="w-5 h-5 text-amber-300/50" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-serif font-medium text-amber-50 line-clamp-2 leading-snug">
                                {{ item.clothes_note || item.library?.name || '未命名服饰' }}
                            </p>
                            <p v-if="item.wardrobe_status" class="mt-0.5 text-[10px] text-amber-200/40 tracking-widest truncate">
                                {{ item.wardrobe_status }}
                            </p>
                        </div>
                        <UIcon
                            v-if="currentClothesId === item.clothes_id"
                            name="material-symbols:chevron-right"
                            class="text-amber-300 text-base flex-shrink-0"
                        />
                    </button>
                </div>
            </section>
        </aside>

        <!-- 中：服饰展示 -->
        <main class="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
            <section class="museum-stage relative flex-1 min-h-0 overflow-hidden">
                <div class="absolute top-4 left-4 right-4 z-30 flex items-start justify-between gap-3 pointer-events-none">
                    <div class="pointer-events-auto flex-1 min-w-0">
                        <div class="text-[10px] tracking-[0.4em] text-amber-300/70 font-serif">EXHIBIT · 服饰</div>
                        <h2 class="mt-0.5 font-serif text-xl text-amber-50 truncate drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]">
                            {{ detail?.clothes_note || detail?.library?.name || '—' }}
                        </h2>
                    </div>
                    <div class="pointer-events-auto flex items-center gap-2 flex-shrink-0">
                        <button
                            v-if="hasSceneViewer"
                            type="button"
                            class="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg border border-amber-400/40 backdrop-blur-md transition-all hover:border-amber-300 hover:bg-amber-400/10 active:scale-95"
                            :class="autoRotate ? 'text-amber-300 bg-amber-500/15' : 'text-amber-100/70 bg-stone-900/40'"
                            :title="autoRotate ? '关闭自动旋转' : '开启自动旋转'"
                            @click="autoRotate = !autoRotate"
                        >
                            <UIcon name="material-symbols:rotate-right" class="text-lg" />
                            <span class="text-[10px] tracking-widest">{{ autoRotate ? 'ROTATING' : 'AUTO' }}</span>
                        </button>
                        <button
                            v-if="currentClothesId"
                            type="button"
                            class="py-2 px-3 rounded-lg border border-amber-400/40 backdrop-blur-md text-amber-100/80 bg-stone-900/40 text-xs tracking-widest font-serif hover:border-amber-300 hover:bg-amber-400/10 transition-all"
                            @click="jumpToClothes(currentClothesId)"
                        >
                            DETAIL →
                        </button>
                    </div>
                </div>

                <!-- 关联服饰缩略条 -->
                <div
                    v-if="detail?.include && detail.include.length > 0"
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[70%]"
                >
                    <div class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-400/30 bg-stone-950/70 backdrop-blur-md overflow-x-auto museum-scroll-x">
                        <button
                            v-for="inc in detail.include"
                            :key="inc.clothes_id"
                            type="button"
                            class="flex-shrink-0 w-10 h-10 rounded overflow-hidden border border-amber-400/25 hover:border-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            :title="inc.clothes_note || ''"
                            :disabled="exhibitSwitchBlocked"
                            @click="inc.clothes_id && selectClothes(inc)"
                        >
                            <img
                                v-if="inc.clothes_img"
                                :src="formatClothesImg(inc.clothes_img)"
                                :alt="inc.clothes_note"
                                class="w-full h-full object-cover"
                            />
                        </button>
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

                <client-only>
                    <SPZModelViewerContent
                        ref="spzViewerRef"
                        v-show="hasSceneViewer"
                        class="w-full h-full"
                        :model-list="modelList"
                        :laxian-list="laxianList"
                        :scene-json="sceneJson"
                        :auto-rotate="autoRotate"
                        :background-color="0x140e08"
                        :show-loading-mask="false"
                        @load-state-change="onSceneLoadStateChange"
                    />
                    <PhysicsDrop
                        v-if="hasPhysics"
                        v-show="!hasSceneViewer"
                        :models="physicsDropModels"
                        class="w-full h-full"
                    />
                    <div
                        v-if="showStageImage && detail"
                        class="w-full h-full flex items-center justify-center p-8 pt-16 pb-24"
                    >
                        <div class="relative max-h-full max-w-full rounded-lg overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.15)]">
                            <img
                                :src="formatClothesImg(detail.clothes_img)"
                                :alt="detail.clothes_note || ''"
                                class="max-h-[calc(100vh-12rem)] max-w-full object-contain"
                            />
                            <ClothesFavoriteCoverOverlay
                                v-if="detail.is_favorite !== undefined"
                                :level="favoriteLevelDisplay"
                            />
                        </div>
                    </div>
                    <div
                        v-else-if="!hasSceneViewer && !hasPhysics"
                        class="w-full h-full flex flex-col items-center justify-center text-amber-200/50 font-serif"
                    >
                        <UIcon name="i-heroicons-photo" class="text-7xl mb-3 text-amber-400/40" />
                        <p class="text-sm tracking-[0.3em]">
                            {{ clothesLoading || detailLoading || wardrobesLoading || modelLoading || sceneLoadState.loading ? 'LOADING…' : 'NO GARMENT SELECTED' }}
                        </p>
                    </div>
                </client-only>

                <div v-if="modelError" class="absolute inset-x-0 top-20 mx-auto w-fit z-30 px-4 py-2 rounded-md bg-amber-900/60 border border-amber-400/40 text-amber-100 text-xs font-serif backdrop-blur-md">
                    {{ modelError }}
                </div>
                <div v-if="detailError" class="absolute inset-x-0 top-32 mx-auto w-fit z-30 px-4 py-2 rounded-md bg-amber-900/60 border border-amber-400/40 text-amber-100 text-xs font-serif backdrop-blur-md">
                    {{ detailError }}
                </div>

                <span class="corner-ornament top-2 left-2" />
                <span class="corner-ornament top-2 right-2 rotate-90" />
                <span class="corner-ornament bottom-2 left-2 -rotate-90" />
                <span class="corner-ornament bottom-2 right-2 rotate-180" />
            </section>
        </main>

        <!-- 右：服饰铭牌 + 记忆 -->
        <aside class="w-[320px] xl:w-[360px] flex flex-col gap-4 min-h-0">
            <section class="museum-panel overflow-hidden shrink-0">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">服饰铭牌</h3>
                    <span class="ornament" />
                </div>
                <div v-if="detailLoading" class="p-5 flex items-center justify-center min-h-[180px]">
                    <div class="spinner-gold" />
                </div>
                <div v-else-if="detail" class="p-4">
                    <div class="flex gap-3 cursor-pointer group" @click="jumpToClothes(detail.clothes_id)">
                        <div class="relative flex-shrink-0">
                            <img
                                v-if="detail.clothes_img"
                                :src="formatClothesImg(detail.clothes_img)"
                                :alt="detail.clothes_note"
                                class="w-20 h-28 rounded-md object-cover border border-amber-400/40 shadow-[0_0_16px_rgba(212,175,55,0.18)]"
                            />
                            <div class="absolute inset-0 rounded-md ring-1 ring-amber-300/30 pointer-events-none" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h2 class="font-serif text-sm font-semibold text-amber-50 line-clamp-2 leading-snug group-hover:text-amber-200 transition-colors">
                                {{ detail.clothes_note || '未命名服饰' }}
                            </h2>
                            <div class="mt-1.5 flex flex-wrap gap-1">
                                <span v-if="detail.wardrobe_status" class="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-200/90">{{ detail.wardrobe_status }}</span>
                                <span v-if="detail.clothes_part" class="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-200/90">{{ detail.clothes_part.split(',')[0] }}</span>
                            </div>
                            <p v-if="detail.price" class="mt-1.5 text-xs text-amber-100/70 font-serif">
                                ¥ {{ detail.price }}
                            </p>
                        </div>
                    </div>

                    <dl class="mt-3 space-y-1.5 text-xs">
                        <div v-if="detail.times != null" class="flex gap-2">
                            <dt class="w-14 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">穿着</dt>
                            <dd class="flex-1 text-amber-100/85">{{ detail.times }} 次</dd>
                        </div>
                        <div v-if="detail.color" class="flex gap-2">
                            <dt class="w-14 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">颜色</dt>
                            <dd class="flex-1 text-amber-100/85">{{ detail.color }}</dd>
                        </div>
                        <div v-if="detail.tags" class="flex gap-2">
                            <dt class="w-14 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">标签</dt>
                            <dd class="flex-1 flex flex-wrap gap-1">
                                <span v-for="tag in detail.tags.split(',')" :key="tag" class="px-1.5 py-0.5 rounded bg-amber-400/5 border border-amber-400/15 text-amber-100/85 text-[10px]">{{ tag }}</span>
                            </dd>
                        </div>
                        <div v-if="detail.note" class="flex gap-2">
                            <dt class="w-14 flex-shrink-0 text-amber-200/50 font-serif tracking-wider">笔记</dt>
                            <dd class="flex-1 text-amber-100/85 line-clamp-3">{{ detail.note }}</dd>
                        </div>
                    </dl>

                    <div
                        v-if="detail.library"
                        class="mt-3 pt-3 border-t border-amber-400/15 cursor-pointer group/lib"
                        @click="jumpToLibrary(detail.library!.library_id)"
                    >
                        <p class="text-[10px] tracking-widest text-amber-200/50 mb-1.5 font-serif">LINKED LIBRARY</p>
                        <div class="flex items-center gap-2">
                            <img
                                v-if="detail.library.cover"
                                :src="formatImg(detail.library.cover, '?x-oss-process=image/quality,q_80/resize,w_80,h_80')"
                                :alt="detail.library.name"
                                class="w-10 h-10 rounded object-cover border border-amber-400/25"
                            />
                            <span class="text-xs font-serif text-amber-50 line-clamp-2 group-hover/lib:text-amber-200 transition-colors">
                                {{ detail.library.name }}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="mt-3 w-full py-1.5 rounded-md border border-amber-400/50 text-amber-200 text-xs tracking-[0.3em] font-serif hover:bg-amber-400 hover:text-stone-900 transition-colors"
                        @click="jumpToClothes(detail.clothes_id)"
                    >
                        ENTER · 进入服饰详情
                    </button>
                </div>
                <div v-else class="p-4 text-center text-xs text-stone-400 font-serif">暂未选择服饰</div>
            </section>

            <section class="museum-panel flex-1 min-h-0 flex flex-col">
                <div class="museum-panel-header">
                    <span class="ornament" />
                    <h3 class="title">相关记忆</h3>
                    <span class="ornament" />
                    <span
                        v-if="memoryCount > 0"
                        class="ml-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
                    >{{ memoryCount > 99 ? '99+' : memoryCount }}</span>
                </div>
                <div v-if="!currentClothesId" class="flex-1 flex items-center justify-center text-xs text-stone-400 font-serif px-3 text-center">
                    选择服饰后查看记忆
                </div>
                <div v-else class="flex-1 min-h-[140px] overflow-y-auto overscroll-contain px-2 py-2 museum-scroll exhibition-memory-scroll">
                    <CommunityForeignList
                        :key="`${memoryListKey}-${currentClothesId}`"
                        :pk_type="MEMORY_PK_TYPE"
                        :pk_id="currentClothesId"
                        single-column
                        :pc-columns="1"
                        :need_water="false"
                        size="small"
                        class="exhibition-memory-list"
                        @count-change="onMemoryCountChange"
                    />
                </div>
            </section>
        </aside>
    </div>

    <!-- 衣柜切换 -->
    <QhxModal v-model="showWardrobePickerModal">
        <div class="exhibition-picker-modal w-[92vw] max-w-sm max-h-[min(80vh,520px)] flex flex-col overflow-hidden">
            <div class="exhibition-picker-modal__header flex items-center justify-between px-4 py-3 shrink-0">
                <div>
                    <p class="text-[10px] tracking-[0.35em] text-amber-300/70 font-serif">CLOSET</p>
                    <h3 class="font-serif text-base text-amber-50 tracking-wider">选择衣柜</h3>
                </div>
                <button
                    type="button"
                    class="w-8 h-8 flex items-center justify-center rounded-full border border-amber-400/30 text-amber-200/80 hover:bg-amber-400/10 hover:text-amber-100 transition-colors"
                    aria-label="关闭"
                    @click="showWardrobePickerModal = false"
                >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                </button>
            </div>
            <div class="px-2 pb-2 text-[10px] tracking-[0.2em] text-center text-amber-200/45 font-serif shrink-0">
                {{ wardrobeList.length }} CLOSETS · 点击切换
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3 space-y-1 museum-scroll exhibition-picker-modal__list">
                <button
                    v-for="w in wardrobeList"
                    :key="w.wardrobe_id"
                    type="button"
                    class="w-full flex items-center gap-3 p-2.5 text-left rounded-md border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    :class="currentWardrobeId === w.wardrobe_id
                        ? 'bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border-amber-400/55 shadow-[0_0_14px_rgba(212,175,55,0.2)]'
                        : 'border-transparent hover:bg-amber-400/8 hover:border-amber-400/25'"
                    :disabled="exhibitSwitchBlocked"
                    @click="pickWardrobeFromModal(w)"
                >
                    <div class="relative flex-shrink-0">
                        <img
                            v-if="w.wardrobe_cover"
                            :src="formatImg(w.wardrobe_cover, '?x-oss-process=image/quality,q_80/resize,w_120,h_120')"
                            :alt="w.wardrobe_name"
                            class="w-11 h-11 rounded-md object-cover border border-amber-400/30"
                        />
                        <div
                            v-else
                            class="w-11 h-11 rounded-md bg-stone-800/80 flex items-center justify-center border border-amber-400/20"
                        >
                            <UIcon name="material-symbols:checkroom-outline" class="w-5 h-5 text-amber-300/45" />
                        </div>
                        <UIcon
                            v-if="w.password"
                            name="i-heroicons-lock-closed"
                            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-amber-200"
                        />
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-serif font-medium text-amber-50 line-clamp-1 leading-snug">
                            {{ w.wardrobe_name || '未命名衣柜' }}
                        </p>
                        <p class="mt-0.5 text-[10px] text-amber-200/45 tracking-widest font-serif">
                            {{ w.count_clothes ?? 0 }} 件
                        </p>
                    </div>
                    <UIcon
                        v-if="currentWardrobeId === w.wardrobe_id"
                        name="i-heroicons-check-circle-solid"
                        class="text-amber-400 text-lg flex-shrink-0"
                    />
                </button>
            </div>
        </div>
    </QhxModal>

    <!-- 密码衣柜 -->
    <QhxModal v-model="showPasswordModal">
        <div class="p-6 max-w-sm bg-white dark:bg-gray-800 rounded-xl">
            <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">私密衣柜</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">该衣柜需要密码才能浏览</p>
            <UInput v-model="passwordInput" type="password" placeholder="请输入密码" class="mb-4" />
            <div class="flex justify-end gap-2">
                <UButton variant="ghost" @click="showPasswordModal = false">取消</UButton>
                <UButton color="primary" @click="confirmPassword">确认</UButton>
            </div>
        </div>
    </QhxModal>
</template>

<style scoped>
/* ====== 古典博物馆主题（与店铺展馆一致） ====== */
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

.corner-ornament {
    position: absolute;
    width: 28px;
    height: 28px;
    pointer-events: none;
    border-top: 1px solid rgba(212, 175, 55, 0.55);
    border-left: 1px solid rgba(212, 175, 55, 0.55);
}

/* 金色主题滚动条（纵向 / 横向 / 记忆列表） */
.exhibition-root .museum-scroll,
.exhibition-picker-modal .museum-scroll,
.exhibition-memory-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(212, 175, 55, 0.5) rgba(0, 0, 0, 0.12);
}

.exhibition-root .museum-scroll-x {
    scrollbar-width: thin;
    scrollbar-color: rgba(212, 175, 55, 0.5) rgba(0, 0, 0, 0.12);
}

.museum-scroll::-webkit-scrollbar,
.exhibition-memory-scroll::-webkit-scrollbar,
:deep(.exhibition-memory-list)::-webkit-scrollbar {
    width: 5px;
}

.museum-scroll::-webkit-scrollbar-track,
.exhibition-memory-scroll::-webkit-scrollbar-track,
:deep(.exhibition-memory-list)::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 3px;
}

.museum-scroll::-webkit-scrollbar-thumb,
.exhibition-memory-scroll::-webkit-scrollbar-thumb,
:deep(.exhibition-memory-list)::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(244, 208, 111, 0.65), rgba(212, 175, 55, 0.45));
    border-radius: 3px;
    border: 1px solid rgba(212, 175, 55, 0.2);
}

.museum-scroll::-webkit-scrollbar-thumb:hover,
.exhibition-memory-scroll::-webkit-scrollbar-thumb:hover,
:deep(.exhibition-memory-list)::-webkit-scrollbar-thumb:hover {
    background: rgba(244, 208, 111, 0.85);
}

.museum-scroll-x::-webkit-scrollbar {
    height: 5px;
}

.museum-scroll-x::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.22);
    border-radius: 3px;
}

.museum-scroll-x::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, rgba(244, 208, 111, 0.6), rgba(212, 175, 55, 0.45));
    border-radius: 3px;
    border: 1px solid rgba(212, 175, 55, 0.2);
}

.museum-scroll-x::-webkit-scrollbar-thumb:hover {
    background: rgba(244, 208, 111, 0.8);
}

.spinner-gold {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(212, 175, 55, 0.25);
    border-top-color: #f4d06f;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.exhibition-memory-scroll :deep(.exhibition-memory-list.container) {
    max-width: 100%;
    margin-left: 0;
    margin-right: 0;
    padding-top: 0;
    padding-bottom: 0;
    overflow: visible;
}

.exhibition-memory-scroll :deep(.exhibition-memory-list .polaroid-card) {
    margin: 0.25rem 0;
    background: rgba(40, 28, 18, 0.55);
    border: 1px solid rgba(212, 175, 55, 0.22);
    box-shadow: none;
}

.exhibition-memory-scroll :deep(.exhibition-memory-list h3) {
    color: #f4e4b0;
}

.exhibition-memory-scroll :deep(.exhibition-memory-list .community-content-plain) {
    color: rgba(244, 228, 176, 0.55);
}

:deep(#spz-scene-viewer) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent !important;
}

/* 衣柜选择弹窗：博物馆金色主题 */
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
</style>
