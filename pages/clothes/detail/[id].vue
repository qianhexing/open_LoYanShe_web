<script setup lang="ts">
import { nextTick } from 'vue'
import type { WardrobeClothes, Library, Shop, Wardrobe, Scene, Community } from '@/types/api'

// 扩展 WardrobeClothes 类型以包含关联数据
interface ExtendedWardrobeClothes extends WardrobeClothes {
  library?: Library
  wardrobe?: Wardrobe
  origin_shop?: Shop
  sence_id?: number
  image_list?: string[]
}
import { getClothesDetail, getClothesListAllFallback, parseClothesIdsFromRows, updateClothes, deteleClothes, addClothesCitation } from '@/api/wardrobe'
import { getCommunityForeignList, insertCommunityForeign } from '@/api/community'
import { planComplete, deletePlanList } from '@/api/plan'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type SceneChoose from '@/components/scene/SceneChoose.vue'
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import ClothesFavoriteCoverOverlay from '@/components/Clothes/ClothesFavoriteCoverOverlay.vue'
import CommunityPostModal from '@/components/community/CommunityPostModal.vue'
import type { CommunityPostForeignContext } from '@/utils/communityPost'
import { BASE_IMG } from '@/utils/ipConfig'
import PhysicsDrop from '@/components/PhysicsDrop.client.vue'
import type { MaterialForeign, Material } from '@/types/api'
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const isMobile = computed(() => configStore.isMobile)
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const route = useRoute()
const router = useRouter()
const config = useConfigStore()
const wardrobeStore = useWardrobeStore()
const user = useUserStore()
const toast = useToast()
const clothesRouteId = computed(() => String(route.params.id ?? ''))

const detail = ref<ExtendedWardrobeClothes | null>(null)
/** 当前衣柜内服饰 id 顺序（来自 `/clothes/all` 或 list 分页兜底） */
const wardrobeSiblingIds = ref<number[]>([])
const siblingsWardrobeId = ref<number | null>(null)
/** 最近一次详情期望拉取的衣柜（用于丢弃慢请求覆盖新衣柜） */
const latestSiblingWardrobeTarget = ref<number | null>(null)
const siblingIdsInflight = new Map<number, Promise<void>>()
const slideTransitionName = ref<'clothes-slide-forward' | 'clothes-slide-back'>('clothes-slide-forward')
const showMemoryListModal = ref(false)
/** 关联成功后强制刷新记忆列表（CommunityForeignList 无对外 refresh） */
const memoryListRefreshKey = ref(0)
const memoryForeignLinkLoading = ref(false)
const memoryCommunityChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const clothesMemoryPostModalRef = ref<InstanceType<typeof CommunityPostModal> | null>(null)
const showClothesMemoryPostModal = ref(false)
const sortMode = ref(false)
const showDeleteModal = ref(false)
const showDeleteLinkModal = ref(false)
const showAddClothesModal = ref(false)
const showDeleteCommunityModal = ref(false)
const showSceneChooseModal = ref(false)
const showRemoveSceneModal = ref(false)
const showRemovePlanModal = ref(false)
const showCompletePlanModal = ref(false)
const completePlanListId = ref<number | null>(null)
const showDeletePlanModal = ref(false)
const planAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
/** 从详情页打开计划弹窗时预填当前服饰 */
const planAddEditLinkedClothes = computed((): WardrobeClothes | null => {
  const d = detail.value
  if (!d?.clothes_id) return null
  return {
    clothes_id: d.clothes_id,
    clothes_note: d.clothes_note,
    clothes_img: d.clothes_img
  }
})
const planRemoveLoading = ref(false)
const planCompleteLoading = ref(false)
const planDeleteLoading = ref(false)
const sceneChooseClickPosition = ref({ x: 0, y: 0 })
const selectedClothes = ref<WardrobeClothes | null>(null)
const memoryCount = ref(0)
const matchingCount = ref(0)

// 组件引用
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const numSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const timesSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const SceneChooseRef = ref<InstanceType<typeof SceneChoose> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)
const linkClothesLoading = ref(false)
const sharedLoading = ref(false)

// 数字选择器选项
const numOptions = Array.from({ length: 100 }, (_, i) => ({
  label: `${i + 1}`,
  value: i + 1
}))

const timesOptions = Array.from({ length: 1000 }, (_, i) => ({
  label: `${i}`,
  value: i
}))

const fetchSiblingClothesIds = async (wardrobeId: number | string | undefined | null) => {
  const wid = typeof wardrobeId === 'number' ? wardrobeId : Number(wardrobeId)
  if (!Number.isFinite(wid) || wid <= 0) return
  latestSiblingWardrobeTarget.value = wid
  // 已成功缓存过该衣柜（即使解析 id 为空也不再重复打 /clothes/all）
  if (siblingsWardrobeId.value === wid) return

  let pending = siblingIdsInflight.get(wid)
  if (!pending) {
    pending = (async () => {
      try {
        const rows = await getClothesListAllFallback({ wardrobe_id: wid })
        if (latestSiblingWardrobeTarget.value !== wid) return
        wardrobeSiblingIds.value = parseClothesIdsFromRows(rows)
        siblingsWardrobeId.value = wid
      } catch {
        if (latestSiblingWardrobeTarget.value !== wid) return
        wardrobeSiblingIds.value = []
      } finally {
        siblingIdsInflight.delete(wid)
      }
    })()
    siblingIdsInflight.set(wid, pending)
  }
  await pending
}

const currentSiblingIndex = computed(() => {
  const cid = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(cid)) return -1
  return wardrobeSiblingIds.value.findIndex((id) => Number(id) === cid)
})

const canGoSiblingPrev = computed(() => {
  const i = currentSiblingIndex.value
  return i > 0
})

const canGoSiblingNext = computed(() => {
  const i = currentSiblingIndex.value
  return i >= 0 && i < wardrobeSiblingIds.value.length - 1
})

const showSiblingNav = computed(
  () => wardrobeSiblingIds.value.length > 1 && currentSiblingIndex.value >= 0
)

/** 手机端：横向滑动切相邻件；电脑端不用滑动（见悬浮按钮） */
const swipeMobileActive = computed(() => showSiblingNav.value && isMobile.value)

const goToSibling = (delta: -1 | 1) => {
  const i = currentSiblingIndex.value
  const nextId = wardrobeSiblingIds.value[i + delta]
  if (nextId == null) return
  slideTransitionName.value = delta < 0 ? 'clothes-slide-back' : 'clothes-slide-forward'
  router.replace({ path: `/clothes/detail/${nextId}`, query: route.query })
}

const swipeStartX = ref(0)
const swipeStartY = ref(0)
const swipeTrackingPointerId = ref<number | null>(null)

const SWIPE_MIN_DISTANCE = 48

const isSwipeIgnoredTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el?.closest) return false
  return !!el.closest(
    'button, a, input, textarea, select, label, [role="button"], iframe'
  )
}

const swipePointerDown = (e: PointerEvent) => {
  if (!swipeMobileActive.value) return
  if (isSwipeIgnoredTarget(e.target)) return
  if (swipeTrackingPointerId.value !== null) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  swipeTrackingPointerId.value = e.pointerId
  swipeStartX.value = e.clientX
  swipeStartY.value = e.clientY
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
}

const swipePointerUp = (e: PointerEvent) => {
  if (!swipeMobileActive.value) return
  if (swipeTrackingPointerId.value !== e.pointerId) return
  ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
  swipeTrackingPointerId.value = null

  const dx = e.clientX - swipeStartX.value
  const dy = e.clientY - swipeStartY.value
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.15) return

  if (dx < 0 && canGoSiblingNext.value) goToSibling(1)
  else if (dx > 0 && canGoSiblingPrev.value) goToSibling(-1)
}

const swipePointerCancel = (e: PointerEvent) => {
  if (swipeTrackingPointerId.value !== e.pointerId) return
  try {
    ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
  } catch {
    /* capture 可能已释放 */
  }
  swipeTrackingPointerId.value = null
}

/** 手机端：进入详情约 2s 后提示可横向滑动切换（不占点击，穿透到底层） */
const showSwipeGuide = ref(false)
const swipeGuideTimers: ReturnType<typeof setTimeout>[] = []

const SWIPE_GUIDE_SESSION_KEY = 'clothes-detail-swipe-guide'

const clearSwipeGuideTimers = () => {
  for (const t of swipeGuideTimers) clearTimeout(t)
  swipeGuideTimers.length = 0
}

const scheduleMobileSwipeGuide = () => {
  clearSwipeGuideTimers()
  showSwipeGuide.value = false
  if (!import.meta.client) return
  try {
    if (sessionStorage.getItem(SWIPE_GUIDE_SESSION_KEY) === '1') return
  } catch {
    /* 无痕模式等 */
  }
  if (!isMobile.value || !showSiblingNav.value || !detail.value) return

  const tShow = setTimeout(() => {
    if (!isMobile.value || !showSiblingNav.value || !detail.value) return
    // 弹出即写入会话缓存，避免切换 sibling 时 cancel 掉 hide 定时器导致从未写入，从而反复弹出
    try {
      sessionStorage.setItem(SWIPE_GUIDE_SESSION_KEY, '1')
    } catch {
      /* */
    }
    showSwipeGuide.value = true
    const tHide = setTimeout(() => {
      showSwipeGuide.value = false
    }, 4800)
    swipeGuideTimers.push(tHide)
  }, 2000)
  swipeGuideTimers.push(tShow)
}

watch(
  () => [isMobile.value, showSiblingNav.value, !!detail.value] as const,
  () => {
    scheduleMobileSwipeGuide()
  }
)

onUnmounted(() => {
  clearSwipeGuideTimers()
})

const fetchClothesDetail = async () => {
  const pid = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(pid)) return
  try {
    const response = await getClothesDetail({ clothes_id: pid })
    const data = response
    if (data) {
      if (data.detail_image) {
        data.detail_image_list = data.detail_image.split(',')
      } else {
        data.detail_image_list = []
      }
      if (data.main_style && data.main_style !== '' && config.config?.main_style) {
        const mian_style_option = config.config?.main_style
        const main_style_list: { label: string; value: number }[] = []
        data.main_style.split(',').map((item) => {
          const index = mian_style_option.findIndex((element) => {
            return element.value === Number.parseInt(item)
          })
          if (index !== -1 && mian_style_option[index]) {
            main_style_list.push(mian_style_option[index] as { label: string; value: number })
          }
        })
        data.main_style_list = main_style_list
      } else {
        data.main_style_list = []
      }
      if (data.include_clothes && data.include_clothes !== '' && data.include && data.include.length > 0) {
        const include: WardrobeClothes[] = []
        for (const idStr of data.include_clothes.split(',')) {
          if (!data.include) continue
          const index = data.include.findIndex((child) => {
            return child.clothes_id === Number.parseInt(idStr)
          })
          if (index !== -1) {
            include.push(data.include[index])
          }
        }
        data.include = include
      }
    }
    detail.value = data
    void fetchSiblingClothesIds(
      data.wardrobe_id ?? (data as ExtendedWardrobeClothes).wardrobe?.wardrobe_id ?? null
    )
  } catch (error) {
    console.error('获取服饰详情失败:', error)
    toast.add({
      title: '获取详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 判断是否是当前用户拥有的服饰
const isOwner = computed(() => {
  return detail.value?.wardrobe && detail.value.wardrobe.user_id === user.user?.user_id
})

// 是否共享（兼容 undefined/null/0）
const isShared = computed(() => (detail.value?.is_shared ?? 0) === 1)

// 共享时的赞数与引用数（确保为数字）
const displayGoodCount = computed(() => Number(detail.value?.good_count) || 0)
const displayCitationCount = computed(() => Number(detail.value?.citation_count) || 0)

/** 有关联服饰即展示。缺价格不参与相加（数值等同于 +0）；分解式里只写出有有效价格的项。 */
const includeOutfitPriceBreakdown = computed(() => {
  const d = detail.value
  if (!d?.include_clothes?.trim() || !d.include?.length) return null

  const segmentPrices: number[] = []
  const pushIfNumeric = (raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return
    const n = Number(raw)
    if (!Number.isNaN(n)) segmentPrices.push(n)
  }

  pushIfNumeric(d.price)
  for (const item of d.include) {
    pushIfNumeric(item.price)
  }

  const total = segmentPrices.reduce((a, b) => a + b, 0)
  return { segmentPrices, total }
})

// 编辑服饰
const editClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item)
  }
}

// 复制服饰
const copyClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item, true)
  }
}

// 删除服饰
const confirmDelete = async () => {
  if (!detail.value) return
  if (!detail.value.clothes_id) return
  try {
    await deteleClothes({
      clothes_id: detail.value.clothes_id
    })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus');
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateBack) {
      // 发送刷新通知，让上一页在返回时刷新列表
      if (typeof uni.postMessage === 'function') {
        uni.postMessage({ data: { type: 'BackAndReload' } })
      }
      uni.navigateBack()
    } else {
      if (port.value) {
        port.value.postMessage(JSON.stringify({
          type: 'BackAndReload'
        }))
      } else {
        router.back()
      }
    }
  } catch (error) {
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteModal.value = false
  }
}

/** 喜爱级别 0–5，与接口字段 `is_favorite` 对应 */
const favoriteLevelDisplay = computed(() => {
  const v = detail.value?.is_favorite
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
})

/** 详情区喜爱星级：新拟态容器 */
const favoriteNeuPanel =
  'inline-flex items-center gap-0.5 rounded-2xl border border-white/55 bg-[#e8eaf0] px-2 py-1 shadow-[4px_4px_10px_rgb(163_177_198/0.45),-3px_-3px_10px_rgb(255_255_255/0.9),inset_0_1px_1px_rgb(255_255_255/0.8)] dark:border-white/[0.08] dark:bg-[#3d4354] dark:shadow-[5px_5px_12px_rgb(0_0_0/0.45),-4px_-4px_12px_rgb(255_255_255/0.05),inset_0_1px_1px_rgb(255_255_255/0.06)]'

const favoriteNeuMiniBtn =
  'rounded-xl border border-white/50 bg-[#e8eaf0] px-2.5 py-1 text-xs font-medium text-gray-600 shadow-[3px_3px_8px_rgb(163_177_198/0.4),-2px_-2px_8px_rgb(255_255_255/0.85)] transition-all hover:text-gray-800 active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.45)] dark:border-white/[0.08] dark:bg-[#3d4354] dark:text-gray-300 dark:shadow-[4px_4px_10px_rgb(0_0_0/0.4),-3px_-3px_10px_rgb(255_255_255/0.04)] dark:hover:text-gray-100 dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]'

const setFavoriteLevel = async (level: number) => {
  if (!detail.value || !isOwner.value) return
  const next = Math.min(5, Math.max(0, Math.round(level)))
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      is_favorite: next
    })
    if (detail.value) {
      detail.value.is_favorite = next
    }
    toast.add({
      title: next === 0 ? '已设为无星级' : `已设为 ${next} 星`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 设置是否共享（实时修改）
const setShared = async (is_shared: number) => {
  if (!detail.value || !isOwner.value || sharedLoading.value) return
  sharedLoading.value = true
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      is_shared
    })
    if (detail.value) {
      detail.value.is_shared = is_shared
    }
    // 刷新详情以获取最新的 good_count、citation_count
    await fetchClothesDetail()
  } catch (error) {
  } finally {
    sharedLoading.value = false
  }
}

// 更新数量
const updateNum = async (num: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      num
    })
    if (detail.value) {
      detail.value.num = num
    }
  } catch (error) {
    console.error('更新数量失败:', error)
  }
}

// 更新穿着次数
const updateTimes = async (times: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      times
    })
    if (detail.value) {
      detail.value.times = times
    }
  } catch (error) {
    console.error('更新穿着次数失败:', error)
  }
}

// 跳转到图鉴详情
const jumpToLibrary = (library: Library) => {
  router.push(`/library/detail/${library.library_id}`)
}

// 跳转到店铺详情
const jumpToShop = (shop_id: number) => {
  router.push(`/shop/detail/${shop_id}`)
}

// 跳转到关联服饰详情
const jumpToClothes = (item: WardrobeClothes) => {
  router.push(`/clothes/detail/${item.clothes_id}`)
}

// 跳转到衣柜
const jumpToWardrobe = () => {
  if (detail.value?.wardrobe_id && detail.value.wardrobe?.user_id) {
    router.push(`/wardrobe/detail/${detail.value.wardrobe.user_id}?wardrobe_id=${detail.value.wardrobe_id}`)
  }
}

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN')
}

// 格式化货币标签
type MoneyType = { value: number; label: string; exchange_rate?: string }
const formatLabel = (shop_country: number | undefined, money_type: MoneyType[]) => {
  if (!shop_country || !money_type) return ''
  const item = money_type.find((m) => m.value === shop_country)
  return item ? item.label : ''
}

// 汇率换算
const exchangeRate = (shop_country: number | undefined, price: number | undefined): string | false => {
  if (!shop_country || !price || !config.config) return false
  const index = config.config.money_type.findIndex((item) => {
    return item.value === shop_country
  })
  if (index !== -1 && config.config.money_type[index]?.exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (Number.parseFloat(String(price)) / Number.parseFloat(String(config.config.exchange_rate[exchange_rate]))).toFixed(2)
  }
  return false
}

// 预览图片（由 QhxPreviewImage 组件处理）

// 打开关联服饰选择
const openLinkClothesChoose = (e?: MouseEvent) => {
  wardrobeClothesChooseRef.value?.showModel(e)
}

// 选择服饰后关联
const handleLinkClothesChoose = async (clothes: WardrobeClothes) => {
  if (!detail.value?.clothes_id || !clothes?.clothes_id || linkClothesLoading.value) return
  if (clothes.clothes_id === detail.value.clothes_id) {
    toast.add({ title: '不能关联自身', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  const currentInclude = detail.value.include_clothes ? detail.value.include_clothes.split(',') : []
  if (currentInclude.includes(String(clothes.clothes_id))) {
    toast.add({ title: '该服饰已关联', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  if (currentInclude.length >= 10) {
    toast.add({ title: '最多关联10条', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  linkClothesLoading.value = true
  try {
    // 自身：新增选中的 clothes_id 到 include_clothes
    const selfIncludeClothes = detail.value.include_clothes
      ? `${detail.value.include_clothes},${clothes.clothes_id}`
      : String(clothes.clothes_id)
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: selfIncludeClothes
    })
    // 被关联对象：新增当前 clothes_id 到其 include_clothes
    const otherIncludeClothes = clothes.include_clothes
      ? `${clothes.include_clothes},${detail.value.clothes_id}`
      : String(detail.value.clothes_id)
    await updateClothes({
      clothes_id: clothes.clothes_id,
      include_clothes: otherIncludeClothes
    })
    await fetchClothesDetail()
    // 用户通过 include_clothes 引用他人服饰，增加被引用服饰的 citation_count
    await addClothesCitation({ clothes_id: clothes.clothes_id }).catch(() => {})
    toast.add({ title: '关联成功', icon: 'i-heroicons-check-circle', color: 'green' })
  } catch (error) {
    toast.add({ title: '关联失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    linkClothesLoading.value = false
  }
}

// 删除关联服饰
const deleteLinkClothes = async () => {
  if (!detail.value || !selectedClothes.value) return
  try {
    let include_clothes: string[] = []
    if (detail.value.include_clothes) {
      include_clothes = detail.value.include_clothes.split(',')
    }
    if (!selectedClothes.value) return
    const index = include_clothes.findIndex((item) => {
      return Number.parseInt(item, 10) === selectedClothes.value.clothes_id
    })
    if (index !== -1) {
      include_clothes.splice(index, 1)
      await updateClothes({
        clothes_id: detail.value.clothes_id,
        include_clothes: include_clothes.length === 0 ? null : include_clothes.join(',')
      })
      await fetchClothesDetail()
      toast.add({
        title: '取消关联成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteLinkModal.value = false
    selectedClothes.value = null
  }
}

// 上移关联服饰
const upItem = async (index: number) => {
  if (index === 0 || !detail.value || !detail.value.include_clothes) return
  try {
    const include_clothes = detail.value.include_clothes.split(',')
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index - 1]
    include_clothes[index - 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('上移失败:', error)
  }
}

// 下移关联服饰
const downItem = async (index: number) => {
  if (!detail.value || !detail.value.include || index >= detail.value.include.length - 1) return
  try {
    const include_clothes = detail.value.include_clothes?.split(',') || []
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index + 1]
    include_clothes[index + 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('下移失败:', error)
  }
}

// 编辑成功回调
const onEditSuccess = () => {
  fetchClothesDetail()
}

// 记忆数量更新（弹窗内列表加载时同步）
const onMemoryCountChange = (count: number) => {
  memoryCount.value = count
}

const MEMORY_PK_TYPE = 2 as const

const clothesMemoryPkId = computed(() => {
  const n = Number.parseInt(clothesRouteId.value, 10)
  return Number.isFinite(n) ? n : null
})

/** 记忆发帖弹窗 foreign 上下文（pk_type=服饰） */
const memoryPostForeignForModal = computed((): CommunityPostForeignContext | null => {
  const id = clothesMemoryPkId.value
  if (id == null) return null
  return { pk_id: id, pk_type: MEMORY_PK_TYPE }
})

function openMemoryChooseCommunity(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (clothesMemoryPkId.value == null) return
  memoryCommunityChooseRef.value?.showModel(e)
}

async function onMemoryCommunityChosen(item: Community) {
  const pkId = clothesMemoryPkId.value
  if (pkId == null) return
  memoryForeignLinkLoading.value = true
  try {
    await insertCommunityForeign({
      pk_type: MEMORY_PK_TYPE,
      community_id: item.community_id,
      pk_id: pkId
    })
    toast.add({
      title: '已关联到本条裙子记忆',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    memoryListRefreshKey.value += 1
    void fetchMemoryListCount()
  } catch (error: unknown) {
    console.error('关联记忆帖子失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '关联失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    memoryForeignLinkLoading.value = false
  }
}

function goNewMemoryPost(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const pkId = clothesMemoryPkId.value
  if (pkId == null) return
  showMemoryListModal.value = false
  clothesMemoryPostModalRef.value?.open(e)
}

function onClothesMemoryPostSuccess() {
  memoryListRefreshKey.value += 1
  void fetchMemoryListCount()
}

/** 直接请求记忆列表总数（用于角标，不依赖弹窗是否打开） */
const fetchMemoryListCount = async () => {
  const clothesId = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(clothesId)) return
  try {
    const res = await getCommunityForeignList({
      page: 1,
      pageSize: 1,
      pk_id: clothesId,
      pk_type: MEMORY_PK_TYPE
    })
    memoryCount.value = res.count ?? 0
  } catch {
    /* 保持原数量 */
  }
}

// 搭配数量更新
const onMatchingCountChange = (count: number) => {
  matchingCount.value = count
}

onMounted(async () => {
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  if (isInUniApp || port.value) {
    void wardrobeStore.getWardrobeConfig()
  }
  void fetchMemoryListCount()
  setTimeout(async () => {
    await fetchClothesDetail()
  })
})

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId === oldId) return
    memoryCount.value = 0
    void fetchMemoryListCount()
    detail.value = null
    void fetchClothesDetail()
  }
)

watch(showMemoryListModal, (open) => {
  if (!open) void fetchMemoryListCount()
})

useHead({
  title: detail.value?.clothes_note || '服饰详情',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.clothes_note || ''} Lo研社,Lolita服饰,Lolita衣柜`
    },
    {
      name: 'description',
      content: detail.value?.clothes_note || 'Lolita服饰详情'
    }
  ]
})
const jumpToScene = (sence_id: number) => {
  const sceneUrl = `/scene/detail/${sence_id}?edit=1`
  const fullUrl = `https://lolitalibrary.com${sceneUrl}`

  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境 - 使用 outerlink
    uni.navigateTo({
      url: `/pages/common/outerLink?url=${fullUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else if (port.value) {
    // 鸿蒙系统 - 使用 outerlink
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: {
        url: fullUrl
      }
    }))
  } else {
    // 普通浏览器环境
    window.open(sceneUrl, '_blank')
  }
}

// 移除场景
const removeScene = async () => {
  await updateClothes({
    clothes_id: detail.value?.clothes_id,
    sence_id: null
  })
  await fetchClothesDetail()
  showRemoveSceneModal.value = false
}

// 显示场景选择对话框
const showChooseScene = (event?: MouseEvent) => {
  // 记录触发位置
  if (event) {
    sceneChooseClickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    sceneChooseClickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  // 显示选择对话框
  showSceneChooseModal.value = true
}

// 关闭场景选择对话框
const handleSceneChooseClose = () => {
  showSceneChooseModal.value = false
}

// 套用模版
const chooseTemplate = () => {
  // 套用模版 - 先空实现
  showSceneChooseModal.value = false
  // TODO: 实现套用模版功能
}

// 选择现有场景
const chooseExistingScene = () => {
  // 选择现有场景
  showSceneChooseModal.value = false
  // 使用 nextTick 确保模态框关闭后再打开场景选择器
  nextTick(() => {
    if (SceneChooseRef.value) {
      // 创建一个模拟的 MouseEvent，使用之前记录的点击位置
      const mockEvent = {
        clientX: sceneChooseClickPosition.value.x,
        clientY: sceneChooseClickPosition.value.y
      } as MouseEvent
      SceneChooseRef.value.showModel(mockEvent)
    }
  })
}

// 选择场景后的回调
const chooseScene = async (list: Scene[]) => {
  if (list.length > 0 && detail.value) {
    const selectedScene = list[0]
    try {
      await updateClothes({
        clothes_id: detail.value.clothes_id,
        sence_id: selectedScene.sence_id
      })
      // 更新本地数据
      if (detail.value) {
        detail.value.plan_id = selectedScene.sence_id
        detail.value.sence_id = selectedScene.sence_id
      }
      toast.add({
        title: '关联场景成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      // 刷新详情数据
      await fetchClothesDetail()
    } catch (error) {
      toast.add({
        title: '关联场景失败',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
    }
  }
}

// PhysicsDrop 组件相关 - 从接口返回的 model_list 动态生成
const physicsDropModels = computed(() => {
  // 没有服饰详情或没有模型列表时不展示
  const modelList = detail.value?.model_list
  if (!detail.value || !Array.isArray(modelList)) {
    return []
  }

  return modelList
    // 只取启用并且有 material_box 的数据
    .filter((item): item is MaterialForeign & { material_box: NonNullable<Material> } => {
      return !!item && item.is_enable === 0 && !!item.material_box && !!item.material_box.materia_url
    })
    // 格式化成 PhysicsDrop 组件需要的结构
    .map((item) => ({
      url: item.material_box.materia_url,
      id: item.materia_id ?? item.material_box.materia_id,
      name: item.material_box.materia_title || '未命名',
      options: item.material_box.options || { useDracoLoader: true }
    }))
})

const handleObjectClick = (data: { url: string; name: string; id: string | number }) => {
  console.log('点击了物体:', data)
  // toast.add({
  //   title: `点击了: ${data.name}`,
  //   description: `ID: ${data.id}`,
  //   icon: 'i-heroicons-information-circle',
  //   color: 'blue'
  // })
}

// PhysicsDrop 显示/隐藏控制 - 与 library detail 共用缓存
const PHYSICS_DROP_VISIBLE_KEY = 'physicsDropVisible'
// 从 localStorage 读取初始状态，默认显示
const getInitialVisibility = (): boolean => {
  if (import.meta.client) {
    const savedState = localStorage.getItem(PHYSICS_DROP_VISIBLE_KEY)
    return savedState !== null ? savedState === 'true' : true
  }
  return true
}
const isPhysicsDropVisible = ref(getInitialVisibility())

// 切换显示/隐藏状态
const togglePhysicsDrop = () => {
  isPhysicsDropVisible.value = !isPhysicsDropVisible.value
  if (import.meta.client) {
    localStorage.setItem(PHYSICS_DROP_VISIBLE_KEY, String(isPhysicsDropVisible.value))
  }
}

// ---------- 计划相关逻辑（参考计划页面） ----------
const getPlanListId = () => detail.value?.plan?.list_id ?? detail.value?.plan_id

// 完成计划（主计划）
const confirmCompletePlan = () => {
  completePlanListId.value = getPlanListId() ?? null
  showCompletePlanModal.value = true
}

// 完成子计划
const confirmCompleteChildPlan = (child: { list_id?: number }) => {
  if (!child?.list_id) return
  completePlanListId.value = child.list_id
  showCompletePlanModal.value = true
}

const handleCompletePlan = async () => {
  const listId = completePlanListId.value ?? getPlanListId()
  if (!listId) return
  planCompleteLoading.value = true
  try {
    await planComplete({ list_id: listId })
    toast.add({ title: '计划已完成', icon: 'i-heroicons-check-circle', color: 'green' })
    showCompletePlanModal.value = false
    completePlanListId.value = null
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '完成失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planCompleteLoading.value = false
  }
}

// 移除计划（取消服饰与计划的关联）
const confirmRemovePlan = () => {
  showRemovePlanModal.value = true
}

const handleRemovePlan = async () => {
  if (!detail.value?.clothes_id) return
  planRemoveLoading.value = true
  try {
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: null })
    toast.add({ title: '已移除计划', icon: 'i-heroicons-check-circle', color: 'green' })
    showRemovePlanModal.value = false
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '移除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planRemoveLoading.value = false
  }
}

// 删除计划（彻底删除计划，参考计划页面）
const confirmDeletePlan = () => {
  showDeletePlanModal.value = true
}

const handleDeletePlan = async () => {
  const listId = getPlanListId()
  if (!listId || !detail.value?.clothes_id) return
  planDeleteLoading.value = true
  try {
    await deletePlanList({ list_id: listId })
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: null })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    showDeletePlanModal.value = false
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planDeleteLoading.value = false
  }
}

// 添加计划
const showAddPlan = (e?: MouseEvent) => {
  planAddEditRef.value?.showModel(e)
}

const onPlanAddSuccess = async (data: { list_id?: number }) => {
  if (!detail.value?.clothes_id || !data?.list_id) return
  try {
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: data.list_id })
    toast.add({ title: '关联计划成功', icon: 'i-heroicons-check-circle', color: 'green' })
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '关联失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

// 编辑计划
const showEditPlan = (e?: MouseEvent) => {
  if (!detail.value?.plan) return
  planAddEditRef.value?.showModel(e)
}
</script>

<template>
  <div>
    <button
      v-if="detail"
      type="button"
      class="fixed top-20 right-3 max-md:top-16 max-md:right-2 z-[60] rounded-full bg-qhx-primary text-white shadow-md shadow-qhx-primary/20 pl-2 pr-2.5 py-1.5 text-xs font-medium ring-1 ring-white/20 transition hover:brightness-110 active:scale-[0.98]"
      @click="showMemoryListModal = true"
    >
      <span class="relative inline-flex items-center gap-1">
        <UIcon name="i-heroicons-sparkles" class="w-4 h-4 shrink-0" />
        记忆
        <span
          v-if="memoryCount > 0"
          class="absolute -top-2.5 -right-3 z-10 flex min-h-4 min-w-4 translate-x-px -translate-y-px items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-white dark:ring-gray-900"
        >{{ memoryCount > 99 ? '99+' : memoryCount }}</span>
      </span>
    </button>

    <Transition name="clothes-swipe-guide">
      <div
        v-if="showSwipeGuide"
        class="clothes-swipe-guide-root pointer-events-none fixed inset-0 z-[61] flex items-center justify-center px-6"
        aria-hidden="true"
      >
        <div class="clothes-swipe-guide-backdrop" />
        <div class="clothes-swipe-guide-content pointer-events-none relative z-[1] max-w-[18rem] text-center">
          <div class="clothes-swipe-guide-hint-row mb-2.5 flex items-center justify-center">
            <UIcon
              name="material-symbols:swipe-outline-rounded"
              class="clothes-swipe-guide-hand-icon h-16 w-16 text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.4)]"
            />
          </div>
          <p class="text-[13px] leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
            左右滑动可切换服饰
          </p>
        </div>
      </div>
    </Transition>

    <QhxModal v-model="showMemoryListModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-pink-50/90 to-purple-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">记忆</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showMemoryListModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
            发帖记录你与小裙子之间的美好记忆
          </p>
          <div class="flex flex-wrap gap-2 justify-center mb-4">
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-heroicons-link"
              :loading="memoryForeignLinkLoading"
              :disabled="memoryForeignLinkLoading || clothesMemoryPkId == null"
              @click="openMemoryChooseCommunity($event)"
            >
              关联已有帖子
            </UButton>
            <UButton
              color="primary"
              size="sm"
              icon="i-heroicons-pencil-square"
              :disabled="clothesMemoryPkId == null"
              @click="goNewMemoryPost($event)"
            >
              写新记忆
            </UButton>
          </div>
          <CommunityForeignList
            v-if="showMemoryListModal && clothesMemoryPkId != null"
            :key="memoryListRefreshKey"
            :pk_type="MEMORY_PK_TYPE"
            :pk_id="clothesMemoryPkId"
            single-column
            allow-delete-foreign
            @count-change="onMemoryCountChange"
          />
        </div>
      </div>
    </QhxModal>

    <CommunityChoose
      ref="memoryCommunityChooseRef"
      :only-mine="true"
      title="选择要关联的帖子"
      placeholder="搜索我的帖子..."
      @choose="onMemoryCommunityChosen"
    />

    <CommunityPostModal
      ref="clothesMemoryPostModalRef"
      v-model="showClothesMemoryPostModal"
      :foreign-pk="memoryPostForeignForModal"
      modal-title="写新记忆"
      :skip-summary-link="true"
      :success-redirect="false"
      @success="onClothesMemoryPostSuccess"
    />

    <clothes-add ref="addEditClothesRef" @success="onEditSuccess"></clothes-add>
    <PlanAddEdit
      ref="planAddEditRef"
      :plan-list="detail?.plan ?? null"
      :initial-need-money="detail?.price ?? 0"
      enable-link-clothes
      :linked-clothes="planAddEditLinkedClothes"
      @insert="onPlanAddSuccess"
      @updated="() => fetchClothesDetail()"
    />
    <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="handleLinkClothesChoose" />

    <Transition :name="slideTransitionName" mode="out-in">
    <div
      v-if="detail && detail.sence_id"
      :key="`scene-${clothesRouteId}`"
      class="relative min-h-[100dvh]"
      :class="{ 'touch-pan-y': isMobile }"
      @pointerdown="swipePointerDown"
      @pointerup="swipePointerUp"
      @pointercancel="swipePointerCancel"
    >
      <!-- 全屏场景背景 -->
      <div class="fixed inset-0 w-screen h-screen z-0">
        <iframe :src="`https://lolitalibrary.com/scene/detail/${detail.sence_id}?from_iframe=true`" class="w-full h-full border-0"
          frameborder="0"></iframe>
      </div>

      <!-- 可拖拽的半模态框 -->
      <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
        <QhxBottomDrawer v-if="detail" :direction="isMobile ? 'bottom' : 'right'">
        <div v-if="detail" class="bg-qhx-bg-card">
          <div class="py-2">
                  <!-- 标题和操作按钮 -->
                  <div class="items-center justify-between mb-4">
                    <h2 class="text-xl font-bold flex-1">
                      {{ detail.clothes_note || '暂无名称' }}
                    </h2>
                    <div v-if="isOwner" class="flex justify-end gap-2 ml-2">
                      <QhxJellyButton>

                      <div class="h-[60px] text-center px-[1px]  cursor-pointer">
                        <div
                          class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                          @click="showRemoveSceneModal = true">
                          <UIcon name="i-heroicons-trash" class="text-[22px] text-[#ffffff]" />
                        </div>
                        <div class=" text-[12px]">移除场景</div>
                      </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-[1px]  cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="jumpToScene(detail.sence_id)">
                            <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">编辑场景</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-1 cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="copyClothes">
                            <UIcon name="i-heroicons-document-duplicate" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">复制</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-1 cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="editClothes">
                            <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">修改</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-[1px] cursor-pointer">
                          <div
                            :class="['my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer', linkClothesLoading ? 'opacity-70' : '']"
                            @click="openLinkClothesChoose">
                            <UIcon name="i-heroicons-link" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">关联服饰</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-1 cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="showDeleteModal = true">
                            <UIcon name="i-heroicons-trash" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">删除</div>
                        </div>
                      </QhxJellyButton>
                    </div>
                  </div>

                  <!-- 信息内容 -->
                  <div class="space-y-3">
                    <!-- 笔记 -->
                    <div v-if="detail.note" class="text-sm text-gray-600">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 喜爱级别（0–5 星） -->
                    <div v-if="detail.is_favorite !== undefined" class="flex flex-wrap items-center gap-2">
                      <span class="text-sm shrink-0 text-gray-600 dark:text-gray-400">喜爱级别：</span>
                      <div v-if="isOwner" class="flex flex-wrap items-center gap-2">
                        <div :class="favoriteNeuPanel">
                          <button v-for="s in 5" :key="s" type="button"
                            class="text-2xl leading-none rounded-lg p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.5)] dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]"
                            :aria-label="`设为 ${s} 星`" @click="setFavoriteLevel(s)">
                            <UIcon
                              :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                              :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                          </button>
                        </div>
                        <button v-if="favoriteLevelDisplay > 0" type="button" :class="favoriteNeuMiniBtn"
                          @click="setFavoriteLevel(0)">
                          清空
                        </button>
                      </div>
                      <div v-else :class="['inline-flex items-center gap-2', favoriteNeuPanel]">
                        <UIcon v-for="s in 5" :key="s"
                          :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                          class="text-xl"
                          :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                        <span class="text-sm text-gray-700 dark:text-gray-200">（{{ favoriteLevelDisplay }} 星）</span>
                      </div>
                    </div>

                    <!-- 状态 -->
                    <div v-if="detail.wardrobe_status" class="text-sm">
                      状态：{{ detail.wardrobe_status }}
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span class="text-sm">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.num" type="number" :min="1" class="w-20"
                          @blur="updateNum(detail.num || 1)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price" class="text-sm">
                      价格：￥{{ detail.price }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" class="text-sm">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span class="text-sm">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.times" type="number" :min="0" class="w-20"
                          @blur="updateTimes(detail.times || 0)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" class="text-sm">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" class="text-sm">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" class="text-sm">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>
                    <!-- 关联服饰 -->
                    <div v-if="detail.include && detail.include.length > 0" class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">关联服饰</h3>
                        <button
                          v-if="isOwner"
                          type="button"
                          class="text-xs px-2 py-1 rounded transition-colors"
                          :class="sortMode ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
                          @click="sortMode = !sortMode">
                          {{ sortMode ? '退出排序' : '排序模式' }}
                        </button>
                      </div>
                      <ul class="space-y-2">
                        <li
                          v-for="(item, index) in detail.include"
                          :key="item.clothes_id"
                          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                          :class="{ 'cursor-pointer': !sortMode }"
                          @click="!sortMode && jumpToClothes(item)">
                          <img
                            :src="`${BASE_IMG}${item.clothes_img || ''}${config.config?.image_params || ''}`"
                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            :alt="item.clothes_note" />
                          <div class="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                            <span class="text-sm truncate">{{ item.clothes_note || item.library?.name || '未命名' }}</span>
                            <span
                              v-if="item.price !== undefined && item.price !== null && item.price !== ''"
                              class="text-xs font-semibold tabular-nums text-qhx-primary"
                            >￥{{ item.price }}</span>
                          </div>
                          <template v-if="isOwner && sortMode">
                            <div class="flex items-center gap-1 flex-shrink-0">
                              <button
                                v-if="index !== 0"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="upItem(index)">
                                <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" />
                              </button>
                              <button
                                v-if="index < detail.include.length - 1"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="downItem(index)">
                                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                              </button>
                            </div>
                          </template>
                          <UIcon v-else name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </li>
                      </ul>
                    </div>
                    <div
                      v-if="includeOutfitPriceBreakdown"
                      class="rounded-lg bg-gradient-to-r from-qhx-primary/20 via-orange-50 to-amber-50 py-1 text-sm font-semibold leading-snug text-gray-900 dark:from-qhx-primary/35 dark:via-amber-950/50 dark:to-orange-950/40 dark:text-gray-50"
                    >
                      <template v-if="includeOutfitPriceBreakdown.segmentPrices.length">
                        总价：<template v-for="(p, i) in includeOutfitPriceBreakdown.segmentPrices" :key="i">
                          <template v-if="i > 0"> + </template>
                          <span class="text-qhx-primary dark:text-qhx-primary">￥{{ p }}</span>
                        </template>
                        <span class="text-qhx-primary dark:text-qhx-primary"> = ￥{{ includeOutfitPriceBreakdown.total }}</span>
                      </template>
                      <template v-else><span class="text-qhx-primary dark:text-qhx-primary">总价：￥0</span></template>
                    </div>
                    <!-- 来源 -->
                    <div v-if="!detail.library && !detail.origin_shop && detail.origin" class="text-sm">
                      来源：{{ detail.origin }}
                    </div>

                    <!-- 尾款计划 -->
                    <div v-if="detail.plan_id || detail.plan" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold text-amber-700 dark:text-amber-300">尾款计划</span>
                        <!-- 计划操作按钮（仅所有者） -->
                        <div v-if="isOwner" class="flex items-center gap-1 ml-auto">
                          <template v-if="detail.plan?.is_complete !== 1">
                            <button
                              type="button"
                              class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded"
                              @click="confirmCompletePlan"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                              title="编辑"
                              @click="showEditPlan"
                            >
                              <UIcon name="i-heroicons-pencil" class="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="移除"
                              @click="confirmRemovePlan"
                            >
                              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                            </button>
                          </template>
                          <button
                            type="button"
                            class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="删除计划"
                            @click="confirmDeletePlan"
                          >
                            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div class="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/50 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-gray-600 dark:text-gray-400">{{ detail.plan?.plan_name || '尾款计划' }}</span>
                          <span class="text-base font-bold text-amber-600 dark:text-amber-400">￥{{ detail.plan?.need_money ?? 0 }}</span>
                        </div>
                        <div v-if="detail.plan?.have_money != null" class="text-xs text-gray-500 dark:text-gray-400">
                          已攒：￥{{ detail.plan.have_money }}
                        </div>
                        <div v-if="detail.plan?.end_time" class="text-xs text-gray-500 dark:text-gray-400">
                          尾款时间：{{ formatDate(detail.plan.end_time) }}
                        </div>
                        <!-- 子计划列表 -->
                        <div
                          v-if="detail.plan?.plan_list && detail.plan.plan_list.length > 0"
                          class="ml-2 pl-2 border-l-2 border-amber-200/60 dark:border-amber-600/40 space-y-1 mt-2"
                        >
                          <div
                            v-for="(child, idx) in detail.plan.plan_list"
                            :key="child.list_id ?? idx"
                            class="flex items-center justify-between gap-2 text-xs"
                          >
                            <span class="text-gray-600 dark:text-gray-400 flex-1 truncate">{{ child.plan_note || `阶段 ${idx + 1}` }}</span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">￥{{ child.need_money ?? 0 }}</span>
                            <button
                              v-if="isOwner && child.is_complete !== 1"
                              type="button"
                              class="px-2 py-0.5 text-[10px] bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded flex-shrink-0"
                              @click="confirmCompleteChildPlan(child)"
                            >
                              完成
                            </button>
                            <span v-else-if="child.is_complete === 1" class="text-gray-400 text-[10px] flex-shrink-0">已完成</span>
                          </div>
                        </div>
                        <NuxtLink
                          v-if="detail.plan?.list_id"
                          :to="`/user/plan`"
                          class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          查看计划详情
                          <UIcon name="i-heroicons-arrow-right" class="text-xs" />
                        </NuxtLink>
                      </div>
                    </div>
                    <!-- 无计划时显示添加按钮 -->
                    <div v-else-if="isOwner" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold text-amber-700 dark:text-amber-300">尾款计划</span>
                      </div>
                      <UButton
                        type="button"
                        size="sm"
                        class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                        @click="showAddPlan"
                      >
                        <UIcon name="i-heroicons-plus" class="mr-1" />
                        添加尾款计划
                      </UButton>
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div class="font-semibold">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" class="text-sm mb-2">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" class="text-sm mb-2">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 来源店铺 -->
                    <div v-if="detail.origin_shop" class="border-t pt-3 mt-3">
                      <h3 class="text-lg font-semibold mb-3">来源店铺</h3>
                      <div class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                        @click="jumpToShop(detail.origin_shop!.shop_id)">
                        <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.origin_shop.shop_name" />
                        <div class="font-semibold">{{ detail.origin_shop.shop_name }}</div>
                      </div>
                    </div>

                    <!-- 详情图片列表 -->
                    <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                      <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                        :list="[{ src: img, alt: detail.clothes_note || '' }]" :preview="detail.detail_image_list"
                        className="w-full rounded-lg" />
                    </div>

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <UButton color="primary" @click="jumpToWardrobe">查看该衣柜</UButton>
                    </div>

                    <!-- 是否共享 -->
                    <div class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-sm text-gray-600 dark:text-gray-400">是否共享</span>
                        <UToggle
                          v-if="isOwner"
                          :model-value="isShared"
                          :disabled="sharedLoading"
                          @update:model-value="setShared($event ? 1 : 0)"
                        />
                        <span v-else class="text-sm font-medium" :class="isShared ? 'text-qhx-primary' : 'text-gray-500'">
                          {{ isShared ? '已共享' : '未共享' }}
                        </span>
                      </div>
                      <p v-if="isShared" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        当前为共享状态，服饰数据公开，其他用户可以直接导入
                      </p>
                      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        开启后可以向其他用户共享该服饰数据！
                      </p>
                      <div v-if="isShared" class="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <UIcon name="i-heroicons-heart" class="text-red-500" />
                          赞数 {{ displayGoodCount }}
                        </span>
                        <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <UIcon name="i-heroicons-link" class="text-qhx-primary" />
                          引用数 {{ displayCitationCount }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
        </div>
      </QhxBottomDrawer>
      </Transition>
    </div>
    <div
      v-else-if="detail && !detail.sence_id"
      :key="`plain-${clothesRouteId}`"
      class="container mx-auto px-4 pb-4 max-md:px-2 max-md:pb-2 pt-[calc(1rem+env(safe-area-inset-top,0px))] max-md:pt-[calc(0.5rem+env(safe-area-inset-top,0px))] min-h-[100dvh]"
      :class="{ 'touch-pan-y': isMobile }"
      @pointerdown="swipePointerDown"
      @pointerup="swipePointerUp"
      @pointercancel="swipePointerCancel"
    >
      <!-- <div
        v-if="configStore.statusBarHeight > 0"
        :style="{ height: `${configStore.statusBarHeight}px` }"
      /> -->
      <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg">
        <div class="p-4 max-md:p-2">
                <!-- 图片区域 -->
                <div class="flex max-md:block gap-4 mb-4">
                  <!-- 主图 -->
                  <div class="flex-1 min-w-0">
                    <div v-if="detail.include && detail.include.length > 0"
                      class="mb-4 overflow-hidden w-full">
                      <!-- 主图 float 左，占 2/3 宽，比例 2:3（高度为附图 3 倍） -->
                      <div class="w-2/3 aspect-[2/3] float-left p-1">
                        <div class="relative h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-qhx-primary/20">
                          <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                            :preview="[detail.clothes_img]" className="w-full h-full object-cover" />
                          <ClothesFavoriteCoverOverlay
                            v-if="detail.is_favorite !== undefined"
                            :level="favoriteLevelDisplay"
                          />
                        </div>
                      </div>
                      <!-- 附图 float 右，占 1/3 宽，超过 3 张往下排列 -->
                      <div v-for="(item, index) in detail.include" :key="item.clothes_id"
                        class="w-1/3 aspect-[1/1] float-left p-1">
                        <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/40 group">
                          <QhxPreviewImage :list="[{ src: item.clothes_img, alt: item.clothes_note || '' }]"
                            :preview="[item.clothes_img]" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                          <div v-if="isOwner && sortMode"
                            class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center cursor-pointer z-10 shadow-lg transition-all hover:scale-110 hover:bg-red-500"
                            @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                            <UIcon name="i-heroicons-x-mark" class="text-xs font-bold" />
                          </div>
                          <div v-if="isOwner && sortMode && index < detail.include.length - 1"
                            class="absolute top-1/2 -right-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                            @click.stop="downItem(index)">
                            <UIcon name="i-heroicons-chevron-right" class="text-sm font-bold" />
                          </div>
                          <div v-if="isOwner && sortMode && index !== 0"
                            class="absolute top-1/2 -left-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                            @click.stop="upItem(index)">
                            <UIcon name="i-heroicons-chevron-left" class="text-sm font-bold" />
                          </div>
                          <div
                            class="absolute bottom-0 left-0 right-0 py-2 px-2 text-xs text-white text-center truncate cursor-pointer bg-gradient-to-t from-black/80 via-black/50 to-transparent backdrop-blur-[1px] transition-opacity hover:from-black/90"
                            @click="jumpToClothes(item)">
                            {{ item.clothes_note || item.library?.name || '' }}
                          </div>
                        </div>
                      </div>
                      <div class="clear-both"></div>
                    </div>
                    <div
                      v-else-if="detail.clothes_part && detail.clothes_part.split(',').length > 1 && detail.detail_image_list && detail.detail_image_list.length > 0"
                      class="mb-4 overflow-hidden w-full">
                      <!-- 主图 float 左，占 2/3 宽，比例 2:3（高度为附图 3 倍） -->
                      <div class="w-2/3 aspect-[2/3] float-left p-1">
                        <div class="relative rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-lg">
                          <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                            :preview="[detail.clothes_img]" className="w-full h-full object-cover" />
                          <ClothesFavoriteCoverOverlay
                            v-if="detail.is_favorite !== undefined"
                            :level="favoriteLevelDisplay"
                          />
                        </div>
                      </div>
                      <!-- 附图 float 右，占 1/3 宽，超过 3 张往下排列 -->
                      <div v-for="(img, index) in detail.detail_image_list" :key="index"
                        class="w-1/3 aspect-[1/1] float-left p-1">
                        <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/30">
                          <QhxPreviewImage :list="[{ src: img, alt: detail.clothes_note || '' }]"
                            :preview="detail.detail_image_list" className="w-full h-full object-cover transition-transform duration-200 hover:scale-105" />
                        </div>
                      </div>
                      <div class="clear-both"></div>
                    </div>
                    <div v-else class="relative rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-lg">
                      <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                        :preview="[detail.clothes_img]" className="w-full aspect-[3/4] object-cover" />
                      <ClothesFavoriteCoverOverlay
                        v-if="detail.is_favorite !== undefined"
                        :level="favoriteLevelDisplay"
                        class="right-[calc(50%-50px)] pointer-events-none"
                      />
                    </div>
                  </div>

                  <!-- 信息区域 -->
                  <div class="flex-1 space-y-3">
                    <!-- 标题和操作按钮 -->
                    <div class="items-start justify-between">
                      <h2 class="text-xl font-bold flex-1">
                        {{ detail.clothes_note || '暂无名称' }}
                      </h2>
                      <div v-if="isOwner" class="flex justify-end gap-2 ml-2">
                        <QhxJellyButton v-if="detail.include && detail.include.length > 0">
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              class="my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
                              :class="sortMode ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-qhx-primary'"
                              @click="sortMode = !sortMode">
                              <UIcon name="fluent:arrow-sort-28-filled" class="text-[20px] text-[#ffffff]" />
                            </div>
                            <div class="text-[12px] font-medium" :class="sortMode ? 'text-red-500' : ''">排序模式</div>
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              class="my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 bg-qhx-primary"
                              @click="(e: MouseEvent) => showChooseScene(e)">
                              <UIcon name="garden:box-3d-fill-12" class="text-[22px] text-[#ffffff]" />
                            </div>
                            <div class=" text-[12px]">关联3D</div>
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              class="my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 bg-qhx-primary"
                              @click="copyClothes">
                              <UIcon name="i-heroicons-document-duplicate" class="text-[22px] text-[#ffffff]" />
                            </div>
                            <div class=" text-[12px]">复制</div>
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              class="my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 bg-qhx-primary"
                              @click="editClothes">
                              <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                            </div>
                            <div class=" text-[12px]">编辑</div>
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              :class="['my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 disabled:hover:scale-100 bg-qhx-primary', linkClothesLoading ? 'opacity-70' : '']"
                              @click="openLinkClothesChoose">
                              <UIcon name="i-heroicons-link" class="text-[22px] text-[#ffffff]" />
                            </div>
                            <div class=" text-[12px]">关联服饰</div>
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div class="h-[60px] text-center px-1 cursor-pointer">
                            <div
                              class="my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
                              @click="showDeleteModal = true">
                              <UIcon name="i-heroicons-trash" class="text-[22px] text-[#ffffff]" />
                            </div>
                            <div class=" text-[12px]">删除</div>
                          </div>
                          
                        </QhxJellyButton>
                      </div>
                    </div>

                    <!-- 笔记 -->
                    <div v-if="detail.note" class="text-sm text-gray-600">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 喜爱级别（0–5 星） -->
                    <div v-if="detail.is_favorite !== undefined" class="flex flex-wrap items-center gap-2">
                      <span class="text-sm shrink-0 text-gray-600 dark:text-gray-400">喜爱级别：</span>
                      <div v-if="isOwner" class="flex flex-wrap items-center gap-2">
                        <div :class="favoriteNeuPanel">
                          <button v-for="s in 5" :key="s" type="button"
                            class="text-2xl leading-none rounded-lg p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.5)] dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]"
                            :aria-label="`设为 ${s} 星`" @click="setFavoriteLevel(s)">
                            <UIcon
                              :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                              :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                          </button>
                        </div>
                        <button v-if="favoriteLevelDisplay > 0" type="button" :class="favoriteNeuMiniBtn"
                          @click="setFavoriteLevel(0)">
                          清空
                        </button>
                      </div>
                      <div v-else :class="['inline-flex items-center gap-2', favoriteNeuPanel]">
                        <UIcon v-for="s in 5" :key="s"
                          :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                          class="text-xl"
                          :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                        <span class="text-sm text-gray-700 dark:text-gray-200">（{{ favoriteLevelDisplay }} 星）</span>
                      </div>
                    </div>

                    <!-- 状态 -->
                    <div v-if="detail.wardrobe_status" class="text-sm">
                      状态：{{ detail.wardrobe_status }}
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span class="text-sm">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.num" type="number" :min="1" class="w-20"
                          @blur="updateNum(detail.num || 1)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price" class="text-sm">
                      价格：￥{{ detail.price }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" class="text-sm">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span class="text-sm">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.times" type="number" :min="0" class="w-20"
                          @blur="updateTimes(detail.times || 0)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" class="text-sm">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" class="text-sm">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" class="text-sm">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>
                    <!-- 来源 -->
                    <div v-if="!detail.origin_shop && detail.origin" class="text-sm">
                      来源：{{ detail.origin }}
                    </div>
                    <!-- 关联服饰 -->
                    <div v-if="detail.include && detail.include.length > 0" class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">关联服饰</h3>
                        <button
                          v-if="isOwner"
                          type="button"
                          class="text-xs px-2 py-1 rounded transition-colors"
                          :class="sortMode ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
                          @click="sortMode = !sortMode">
                          {{ sortMode ? '退出排序' : '排序模式' }}
                        </button>
                      </div>
                      <ul class="space-y-2">
                        <li
                          v-for="(item, index) in detail.include"
                          :key="item.clothes_id"
                          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                          :class="{ 'cursor-pointer': !sortMode }"
                          @click="!sortMode && jumpToClothes(item)">
                          <img
                            :src="`${BASE_IMG}${item.clothes_img || ''}${config.config?.image_params || ''}`"
                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            :alt="item.clothes_note" />
                          <div class="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                            <span class="text-sm truncate">{{ item.clothes_note || item.library?.name || '未命名' }}</span>
                            <span
                              v-if="item.price !== undefined && item.price !== null && item.price !== ''"
                              class="text-xs font-semibold tabular-nums text-qhx-primary"
                            >￥{{ item.price }}</span>
                          </div>
                          <template v-if="isOwner && sortMode">
                            <div class="flex items-center gap-1 flex-shrink-0">
                              <button
                                v-if="index !== 0"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="upItem(index)">
                                <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" />
                              </button>
                              <button
                                v-if="index < detail.include.length - 1"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="downItem(index)">
                                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                              </button>
                            </div>
                          </template>
                          <UIcon v-else name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </li>
                      </ul>
                    </div>
                    <div
                      v-if="includeOutfitPriceBreakdown"
                      class="rounded-lg bg-gradient-to-r from-qhx-primary/20 via-orange-50 to-amber-50 py-1 text-sm font-semibold leading-snug text-gray-900 dark:from-qhx-primary/35 dark:via-amber-950/50 dark:to-orange-950/40 dark:text-gray-50"
                    >
                      <template v-if="includeOutfitPriceBreakdown.segmentPrices.length">
                        总价：<template v-for="(p, i) in includeOutfitPriceBreakdown.segmentPrices" :key="i">
                          <template v-if="i > 0"> + </template>
                          <span class="text-qhx-primary dark:text-qhx-primary">￥{{ p }}</span>
                        </template>
                        <span class="text-qhx-primary dark:text-qhx-primary"> = ￥{{ includeOutfitPriceBreakdown.total }}</span>
                      </template>
                      <template v-else><span class="text-qhx-primary dark:text-qhx-primary">总价：￥0</span></template>
                    </div>
                    <!-- 尾款计划 -->
                    <div v-if="detail.plan_id || detail.plan" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold text-amber-700 dark:text-amber-300">尾款计划</span>
                        <!-- 计划操作按钮（仅所有者） -->
                        <div v-if="isOwner" class="flex items-center gap-1 ml-auto">
                          <template v-if="detail.plan?.is_complete !== 1">
                            <button
                              type="button"
                              class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded"
                              @click="confirmCompletePlan"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                              title="编辑"
                              @click="showEditPlan"
                            >
                              <UIcon name="i-heroicons-pencil" class="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="移除"
                              @click="confirmRemovePlan"
                            >
                              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                            </button>
                          </template>
                          <button
                            type="button"
                            class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="删除计划"
                            @click="confirmDeletePlan"
                          >
                            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div class="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/50 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-gray-600 dark:text-gray-400">{{ detail.plan?.plan_name || '尾款计划' }}</span>
                          <span class="text-base font-bold text-amber-600 dark:text-amber-400">￥{{ detail.plan?.need_money ?? 0 }}</span>
                        </div>
                        <div v-if="detail.plan?.have_money != null" class="text-xs text-gray-500 dark:text-gray-400">
                          已攒：￥{{ detail.plan.have_money }}
                        </div>
                        <div v-if="detail.plan?.end_time" class="text-xs text-gray-500 dark:text-gray-400">
                          尾款时间：{{ formatDate(detail.plan.end_time) }}
                        </div>
                        <!-- 子计划列表 -->
                        <div
                          v-if="detail.plan?.plan_list && detail.plan.plan_list.length > 0"
                          class="ml-2 pl-2 border-l-2 border-amber-200/60 dark:border-amber-600/40 space-y-1 mt-2"
                        >
                          <div
                            v-for="(child, idx) in detail.plan.plan_list"
                            :key="child.list_id ?? idx"
                            class="flex items-center justify-between gap-2 text-xs"
                          >
                            <span class="text-gray-600 dark:text-gray-400 flex-1 truncate">{{ child.plan_note || child.plan_name || `阶段 ${idx + 1}` }}</span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">￥{{ child.need_money ?? 0 }}</span>
                            <button
                              v-if="isOwner && child.is_complete !== 1"
                              type="button"
                              class="px-2 py-0.5 text-[10px] bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded flex-shrink-0"
                              @click="confirmCompleteChildPlan(child)"
                            >
                              完成
                            </button>
                            <span v-else-if="child.is_complete === 1" class="text-gray-400 text-[10px] flex-shrink-0">已完成</span>
                          </div>
                        </div>
                        <NuxtLink
                          v-if="detail.plan?.list_id"
                          :to="`/user/plan`"
                          class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          查看计划详情
                          <UIcon name="i-heroicons-arrow-right" class="text-xs" />
                        </NuxtLink>
                      </div>
                    </div>
                    <!-- 无计划时显示添加按钮 -->
                    <div v-else-if="isOwner" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold text-amber-700 dark:text-amber-300">尾款计划</span>
                      </div>
                      <UButton
                        type="button"
                        size="sm"
                        class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                        @click="showAddPlan"
                      >
                        <UIcon name="i-heroicons-plus" class="mr-1" />
                        添加尾款计划
                      </UButton>
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div class="font-semibold">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" class="text-sm mb-2">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" class="text-sm mb-2">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 关联服饰 -->
                    <!-- <div v-if="isOwner && detail.include && detail.include.length < 10" class="mt-4">
                    <UButton icon="i-heroicons-plus" color="primary" @click="showAddClothesModal = true">
                      关联服饰
                    </UButton>
                  </div>
                  <div v-else-if="isOwner && detail.include && detail.include.length >= 10"
                    class="text-sm text-center text-gray-500 mt-4">
                    最多关联10条
                  </div> -->

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <UButton color="primary" @click="jumpToWardrobe">查看该衣柜</UButton>
                    </div>
                  </div>
                </div>

                <!-- 来源店铺 -->
                <div v-if="detail.origin_shop" class="border-t pt-4 mt-4">
                  <h3 class="text-lg font-semibold mb-3">来源店铺</h3>
                  <div class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    @click="jumpToShop(detail.origin_shop!.shop_id)">
                    <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                      :alt="detail.origin_shop.shop_name" />
                    <div class="font-semibold">{{ detail.origin_shop.shop_name }}</div>
                  </div>
                </div>

                <!-- 详情图片列表 -->
                <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                  <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                    :list="[{ src: img, alt: detail.clothes_note || '' }]" :preview="detail.detail_image_list"
                    className="w-full rounded-lg" />
                </div>

                <!-- 是否共享 -->
                <div class="border-t pt-3 mt-3">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-gray-600 dark:text-gray-400">是否共享</span>
                    <UToggle
                      v-if="isOwner"
                      :model-value="isShared"
                      :disabled="sharedLoading"
                      @update:model-value="setShared($event ? 1 : 0)"
                    />
                        <span v-else class="text-sm font-medium" :class="isShared ? 'text-qhx-primary' : 'text-gray-500'">
                          {{ isShared ? '已共享' : '未共享' }}
                        </span>
                      </div>
                      <p v-if="isShared" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        当前为共享状态，服饰数据公开，其他用户可以直接导入衣柜
                      </p>
                      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        开启可以与其他用户共享数据
                      </p>
                      <div v-if="isShared" class="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="i-heroicons-heart" class="text-red-500" />
                      赞数 {{ displayGoodCount }}
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="i-heroicons-link" class="text-qhx-primary" />
                      引用数 {{ displayCitationCount }}
                    </span>
                  </div>
                </div>
              </div>
        </div>
      <!-- 场景选择组件 -->
      <SceneChoose ref="SceneChooseRef" @choose="chooseScene"></SceneChoose>
      
      <!-- 场景选择对话框 -->
      <QhxModal v-model="showSceneChooseModal" :trigger-position="sceneChooseClickPosition" @close="handleSceneChooseClose">
        <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">选择场景方式</h3>
            <button
              @click="handleSceneChooseClose"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="p-6 space-y-4">
            <!-- 套用模版 -->
            <!-- <div
              @click="chooseTemplate"
              class="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md group"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UIcon name="material-symbols:auto-awesome-rounded" class="text-2xl text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  套用模版
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  从预设模版中选择场景
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div> -->

            <!-- 现有场景 -->
            <div
              @click="chooseExistingScene"
              class="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md group"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UIcon name="material-symbols:scatter-plot-rounded" class="text-2xl text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  现有场景
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  从已创建的场景中选择
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      </QhxModal>
    </div>
    <div
      v-else
      key="clothes-detail-loading"
      class="min-h-0"
      aria-hidden="true"
    />
    </Transition>

    <div
      v-if="!isMobile && showSiblingNav"
      class="pointer-events-none fixed inset-y-0 left-0 right-0 z-[58] flex items-end justify-between px-2 sm:px-5 pb-6 sm:pb-8"
    >
      <div class="pointer-events-auto flex min-w-[2rem] justify-start">
        <button
          v-if="canGoSiblingPrev"
          type="button"
          class="clothes-sibling-neu-btn h-8 w-8 shrink-0"
          aria-label="上一件服饰"
          @click="goToSibling(-1)"
        >
          <UIcon name="i-heroicons-chevron-left" class="h-4 w-4" />
        </button>
      </div>
      <div class="pointer-events-auto flex min-w-[2rem] justify-end">
        <button
          v-if="canGoSiblingNext"
          type="button"
          class="clothes-sibling-neu-btn h-8 w-8 shrink-0"
          aria-label="下一件服饰"
          @click="goToSibling(1)"
        >
          <UIcon name="i-heroicons-chevron-right" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <UModal v-model="showDeleteModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要删除吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeleteModal = false">取消</UButton>
            <UButton color="red" @click="confirmDelete">确定</UButton>
          </div>
        </div>
      </UModal>

      <!-- 移除场景确认弹窗 -->
      <UModal v-model="showRemoveSceneModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要移除当前关联的场景吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showRemoveSceneModal = false">取消</UButton>
            <UButton color="red" @click="removeScene">确定</UButton>
          </div>
        </div>
      </UModal>

      <!-- 完成计划确认弹窗 -->
      <UModal v-model="showCompletePlanModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要完成该计划吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showCompletePlanModal = false; completePlanListId = null">取消</UButton>
            <UButton color="primary" @click="handleCompletePlan" :loading="planCompleteLoading">确认完成</UButton>
          </div>
        </div>
      </UModal>

      <!-- 移除计划确认弹窗 -->
      <UModal v-model="showRemovePlanModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要移除该计划与服饰的关联吗？计划仍将保留在计划列表中。</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showRemovePlanModal = false">取消</UButton>
            <UButton color="primary" @click="handleRemovePlan" :loading="planRemoveLoading">确认移除</UButton>
          </div>
        </div>
      </UModal>

      <!-- 删除计划确认弹窗 -->
      <UModal v-model="showDeletePlanModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要删除该计划吗？删除后将无法恢复。</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeletePlanModal = false">取消</UButton>
            <UButton color="red" @click="handleDeletePlan" :loading="planDeleteLoading">确认删除</UButton>
          </div>
        </div>
      </UModal>

      <!-- 删除关联确认弹窗 -->
      <UModal v-model="showDeleteLinkModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要取消关联吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeleteLinkModal = false">取消</UButton>
            <UButton color="red" @click="deleteLinkClothes">确定</UButton>
          </div>
        </div>
      </UModal>
    
    <!-- 物理掉落组件 - 只在没有 sence_id 时显示 -->
    <!-- <ClientOnly>
      <PhysicsDrop 
        v-if="!detail?.sence_id && isPhysicsDropVisible && physicsDropModels.length > 0"
        :models="physicsDropModels"
        @object-click="handleObjectClick"
      />
    </ClientOnly> -->
    
    <!-- 悬浮开关按钮 - 只在没有 sence_id 且有模型时显示 -->
    <!-- <div 
      class="fixed bottom-8 left-8 z-50 pointer-events-none" 
      v-if="!detail?.sence_id && detail && physicsDropModels.length > 0"
    >
      <button
        @click="togglePhysicsDrop"
        class="pointer-events-auto bg-gray-900/80 dark:bg-white/80 backdrop-blur-md text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <UIcon
          :name="isPhysicsDropVisible ? 'weui:eyes-on-filled' : 'weui:eyes-off-filled'"
          class="text-[16px] group-hover:rotate-12 transition-transform"
        />
        <span class="text-sm font-semibold">{{ isPhysicsDropVisible ? '关闭掉落' : '开启掉落' }}</span>
      </button>
    </div> -->
  </div>
</template>

<style scoped>
.clothes-slide-forward-enter-active,
.clothes-slide-forward-leave-active,
.clothes-slide-back-enter-active,
.clothes-slide-back-leave-active {
  transition:
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.26s ease;
}

.clothes-slide-forward-enter-from {
  transform: translateX(22px);
  opacity: 0;
}
.clothes-slide-forward-leave-to {
  transform: translateX(-22px);
  opacity: 0;
}

.clothes-slide-back-enter-from {
  transform: translateX(-22px);
  opacity: 0;
}
.clothes-slide-back-leave-to {
  transform: translateX(22px);
  opacity: 0;
}

/* 电脑端相邻服饰切换：拟态圆形按钮（与衣柜/搭配页色系接近） */
.clothes-sibling-neu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  color: #6b5563;
  background: #ebe3e8;
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -4px -4px 10px rgba(255, 252, 254, 0.95),
    inset 0 1px 1px rgba(255, 255, 255, 0.55);
  transition:
    box-shadow 0.2s ease,
    transform 0.15s ease,
    color 0.2s ease;
}

.clothes-sibling-neu-btn:hover {
  color: #5b4660;
  box-shadow:
    5px 5px 12px rgba(150, 110, 130, 0.26),
    -5px -5px 12px rgba(255, 252, 254, 0.98),
    inset 0 1px 1px rgba(255, 255, 255, 0.6);
}

.clothes-sibling-neu-btn:active {
  transform: scale(0.94);
  color: #524459;
  box-shadow:
    inset 3px 3px 8px rgba(150, 110, 130, 0.28),
    inset -2px -2px 6px rgba(255, 252, 254, 0.65);
}

.dark .clothes-sibling-neu-btn {
  color: rgba(251, 207, 232, 0.82);
  background: #241d26;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.45),
    -3px -3px 10px rgba(120, 80, 100, 0.08),
    inset 0 1px 0 rgba(255, 210, 230, 0.06);
}

.dark .clothes-sibling-neu-btn:hover {
  color: rgba(252, 220, 236, 0.92);
  box-shadow:
    5px 5px 14px rgba(0, 0, 0, 0.5),
    -4px -4px 11px rgba(130, 90, 110, 0.1),
    inset 0 1px 0 rgba(255, 210, 230, 0.08);
}

.dark .clothes-sibling-neu-btn:active {
  box-shadow:
    inset 3px 3px 10px rgba(0, 0, 0, 0.55),
    inset -2px -2px 8px rgba(140, 100, 120, 0.06);
}

/* 手机端滑动引导：轻遮罩、无卡片无模糊，低存在感 */
.clothes-swipe-guide-root {
  isolation: isolate;
}

.clothes-swipe-guide-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(0, 0, 0, 0.38);
}

.dark .clothes-swipe-guide-backdrop {
  background: rgba(0, 0, 0, 0.42);
}

.clothes-swipe-guide-enter-active {
  transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-swipe-guide-leave-active {
  transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.clothes-swipe-guide-enter-active .clothes-swipe-guide-content,
.clothes-swipe-guide-leave-active .clothes-swipe-guide-content {
  transition:
    opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-swipe-guide-enter-from,
.clothes-swipe-guide-leave-to {
  opacity: 0;
}

.clothes-swipe-guide-enter-from .clothes-swipe-guide-content,
.clothes-swipe-guide-leave-to .clothes-swipe-guide-content {
  opacity: 0;
  transform: translateY(8px);
}

.clothes-swipe-guide-hint-row {
  animation: clothes-swipe-guide-hand 2.2s ease-in-out infinite;
  transform-origin: 50% 65%;
  will-change: transform;
}

@keyframes clothes-swipe-guide-hand {
  0%,
  100% {
    transform: translateX(-14px) rotate(-8deg);
  }
  50% {
    transform: translateX(14px) rotate(8deg);
  }
}
</style>
