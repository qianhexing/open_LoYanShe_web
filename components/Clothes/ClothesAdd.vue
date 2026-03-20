<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue'
import type { Library, Shop, Wardrobe, Scene, PlanList } from '~/types/api'
import { getShopOptiosns } from '@/api/shop'
import { insertClothes, updateClothes, getClothesSharedList, getClothesDetail, addClothesCitation } from '@/api/wardrobe'
import { debounce } from '@/utils/public'
import { getPlanList } from '@/api/plan'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
const LibraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
import type SceneChoose from '@/components/scene/SceneChoose.vue'
const SceneChooseRef = ref<InstanceType<typeof SceneChoose> | null>(null)
import type PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
const PlanAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type { Wiki } from '@/types/api'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
const ColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import customInput from './customInput.vue'
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import { uploadImage } from '@/api';
import { BASE_IMG } from '@/utils/ipConfig'
import type { WardrobeClothes } from '@/types/api'

// 扩展类型以包含详情页传递的数据
interface ExtendedClothesItem extends Partial<WardrobeClothes> {
  wardrobe_name?: string
  wardrobe?: Wardrobe
  library?: Library
  scene?: Scene
  origin_shop?: Shop
  plan?: PlanList
  main_style_list?: { label: string; value: number }[]
  detail_image_list?: string[]
}

const emit = defineEmits(['success'])


const qhxSelectRef = ref<InstanceType<typeof QhxSelect>>()
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChoose> | null>(null)
const clothesPartRef = ref<InstanceType<typeof QhxSelect>>()
const tagRef = ref<InstanceType<typeof customInput>>()
  const form = ref<{
  wardrobe_id: number | null
  clothes_id: number | null
  clothes_note: string
  is_have: boolean | number
  wardrobe_status: string | null
  color: string[]
  tags: string[]
  price: number
  season: string[]
  clothes_part: optionsInterface[]
  note: string
  sum_price: number
  origin: string | number | null
  size: string
  add_time: Date | string | null
  position: string
  main_style: optionsInterface[]
  plan_id: number | null
  times: number
  is_shared: number
}>({
  wardrobe_id: null,
  clothes_id: null,
  clothes_note: '',
  is_have: true,
  wardrobe_status: null,
  color: [],
  tags: [],
  price: 0,
  season: [],
  clothes_part: [],
  note: '',
  sum_price: 1,
  origin: null,
  size: '',
  add_time: null,
  position: '',
  main_style: [],
  plan_id: null,
  times: 0,
  is_shared: 0
})
  
const openPicker = (e: MouseEvent) => {
    qhxSelectRef.value?.showPicker(e)
}
const showChooseMainStyle = (e: MouseEvent) => {
  wikiOptionsChooseRef.value?.showModel({ type_id: 4 }, e)
}
const chooseMainStyleWiki = (wikiList: Wiki[]) => {
  for (const item of wikiList) {
    const exists = form.value.main_style.some((child) => child.value === Number(item.wiki_id))
    if (!exists) {
      form.value.main_style.push({
        value: Number(item.wiki_id),
        label: item.wiki_name
      })
    }
  }
}
const openClothesPart = (e: MouseEvent) => {
  clothesPartRef.value?.showPicker(e)
}
const openTag = (e: MouseEvent) => {
  tagRef.value?.showModel(e)
}

const wardrobe = ref<Wardrobe | null>(null) // 衣柜信息
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
console.log(wardrobeStore, '衣柜配置')
const wardrobe_status_defaults: optionsInterface[] = [
  { value: '已拥有', label: '已拥有' },
  { value: '待补款', label: '待补款' },
  { value: '已出', label: '已出' },
]
const wardrobe_status_options = ref<optionsInterface[]>([...wardrobe_status_defaults])
const main_style_options = ref<optionsInterface[]>([])
const clothes_part_options = ref<optionsInterface[]>([])
const season_options = [{ value: '春', label: '春' }, { value: '夏', label: '夏' }, { value: '秋', label: '秋' }, { value: '冬', label: '冬' }]
const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const clickPosition = ref({ x: 0, y: 0 })
const showSceneChooseModal = ref(false)
const sceneChooseClickPosition = ref({ x: 0, y: 0 })
const plan = ref<PlanList | null>(null)
const planAddEditClickPosition = ref({ x: 0, y: 0 })

// 新增服饰时，名称输入框聚焦时显示共享服饰列表
const contentScrollRef = ref<HTMLElement | null>(null)
// 名称表单区域（输入框 + 弹窗）的包裹元素，用于 scrollIntoView 与点击区域外判断
const clothesNoteFormRef = ref<HTMLElement | null>(null)
const showClothesSharedPopover = ref(false)
const sharedClothesList = ref<WardrobeClothes[]>([])
const sharedClothesLoading = ref(false)
const selectedSharedClothes = ref<WardrobeClothes | null>(null)
/** 确认选择后，在下方单独列出的服饰（完整详情，含 include 子服饰） */
const confirmedSharedClothesList = ref<WardrobeClothes[]>([])
const confirmDetailLoading = ref(false)
/** 二级确认弹框：代入会覆盖信息 */
const showConfirmOverwriteModal = ref(false)

const fetchSharedClothesList = async () => {
  if (type.value !== 0) return
  sharedClothesLoading.value = true
  try {
    const keywords = form.value.clothes_note?.trim() || undefined
    const res = await getClothesSharedList({
      page: 1,
      pageSize: 20,
      ...(keywords ? { keywords } : {})
    })
    sharedClothesList.value = res?.rows ?? []
  } catch {
    sharedClothesList.value = []
  } finally {
    sharedClothesLoading.value = false
  }
}

const debouncedFetchSharedClothesList = debounce(fetchSharedClothesList, 300)

const sharedPopoverRef = ref<HTMLElement | null>(null)

// 点击区域外隐藏；点击输入框或弹窗内不隐藏（弹窗在 wrapper 内）
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as Node
  const wrapper = clothesNoteFormRef.value
  if (wrapper?.contains(target)) return
  showClothesSharedPopover.value = false
}

const onClothesNoteFocus = () => {
  if (type.value !== 0) return
  showClothesSharedPopover.value = true
  selectedSharedClothes.value = null
  fetchSharedClothesList()
  // 聚焦时滚动弹框内容区，让名称输入框到可视区顶部；手机端键盘弹出会顶起输入框，跳过避免冲突
  // if (configStore.isMobile) return
  // nextTick(() => {
  //   requestAnimationFrame(() => {
  //     const el = clothesNoteFormRef.value
  //     if (el instanceof HTMLElement) {
  //       el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  //     }
  //   })
  // })
}

// 弹窗显示时监听点击外部，隐藏时移除（仅在客户端执行，避免 SSR 报错）
const safeRemoveClickListener = () => {
  try {
    document?.removeEventListener?.('mousedown', handleClickOutside, true)
  } catch {
    // 忽略 SSR 或已卸载等异常场景
  }
}

watch(showClothesSharedPopover, (visible) => {
  if (typeof document === 'undefined') return
  if (visible) {
    nextTick(() => {
      try {
        document.addEventListener('mousedown', handleClickOutside, true)
      } catch {
        // 忽略
      }
    })
  } else {
    safeRemoveClickListener()
  }
}, { immediate: true })

onUnmounted(safeRemoveClickListener)

const onSelectSharedClothes = (item: WardrobeClothes) => {
  selectedSharedClothes.value = item
}

/** 点击「确认选择」时先弹出二级确认 */
const onRequestConfirmSharedClothes = () => {
  const item = selectedSharedClothes.value
  if (!item?.clothes_id) return
  const exists = confirmedSharedClothesList.value.some(
    (c) => c.clothes_id === item.clothes_id
  )
  if (exists) {
    selectedSharedClothes.value = null
    showClothesSharedPopover.value = false
    return
  }
  showConfirmOverwriteModal.value = true
}

/** 将共享服饰详情代入表单（覆盖当前已填信息） */
function fillFormFromSharedDetail(detail: WardrobeClothes) {
  form.value.clothes_note = detail.clothes_note || ''
  form.value.note = detail.note || ''
  form.value.price = detail.price || 0
  form.value.size = detail.size || ''
  form.value.position = detail.position || ''
  form.value.times = detail.times || 0
  form.value.sum_price = detail.sum_price !== undefined ? detail.sum_price : 1
  form.value.is_have = detail.is_have !== undefined ? detail.is_have : true
  form.value.wardrobe_status = detail.wardrobe_status || null
  form.value.origin = detail.origin || null
  form.value.add_time = detail.add_time || null
  if (detail.color) {
    form.value.color = typeof detail.color === 'string'
      ? detail.color.split(',').filter((c: string) => c.trim() !== '')
      : Array.isArray(detail.color) ? [...detail.color] : []
  } else {
    form.value.color = []
  }
  if (detail.tags) {
    form.value.tags = typeof detail.tags === 'string'
      ? detail.tags.split(',').filter((t: string) => t.trim() !== '')
      : Array.isArray(detail.tags) ? [...detail.tags] : []
  } else {
    form.value.tags = []
  }
  if (detail.season) {
    form.value.season = typeof detail.season === 'string'
      ? detail.season.split(',').filter((s: string) => s.trim() !== '')
      : Array.isArray(detail.season) ? [...detail.season] : []
  } else {
    form.value.season = []
  }
  if (detail.clothes_part) {
    if (typeof detail.clothes_part === 'string') {
      const parts = detail.clothes_part.split(',').filter((p: string) => p.trim() !== '')
      form.value.clothes_part = parts.map((part: string): optionsInterface => ({ value: part, label: part }))
    } else if (Array.isArray(detail.clothes_part)) {
      form.value.clothes_part = (detail.clothes_part as (string | optionsInterface)[]).map((p: string | optionsInterface): optionsInterface =>
        typeof p === 'string' ? { value: p, label: p } : p
      )
    } else {
      form.value.clothes_part = []
    }
  } else {
    form.value.clothes_part = []
  }
  if ((detail as ExtendedClothesItem).main_style_list && Array.isArray((detail as ExtendedClothesItem).main_style_list)) {
    form.value.main_style = (detail as ExtendedClothesItem).main_style_list!.map((s: { label: string; value: number }) => ({ value: s.value, label: s.label }))
  } else if (detail.main_style) {
    const styles = typeof detail.main_style === 'string' ? detail.main_style.split(',').filter((s: string) => s.trim() !== '') : []
    form.value.main_style = styles.map((styleValue: string) => {
      const styleNum = Number.parseInt(styleValue, 10)
      const styleOption = main_style_options.value.find(opt => opt.value === styleNum)
      return styleOption || { value: styleNum, label: styleValue }
    })
  } else {
    form.value.main_style = []
  }
  if ((detail as ExtendedClothesItem).library) library.value = (detail as ExtendedClothesItem).library!
  else library.value = null
  if ((detail as ExtendedClothesItem).scene) scene.value = (detail as ExtendedClothesItem).scene!
  else scene.value = null
  if ((detail as ExtendedClothesItem).origin_shop) origin_shop.value = (detail as ExtendedClothesItem).origin_shop
  else origin_shop.value = undefined
  setTimeout(() => {
    if (wardrobeCoverRef.value && detail.clothes_img) {
      wardrobeCoverRef.value.previewImages = [{
        id: `img_${Date.now()}_${Math.random()}`,
        file: undefined as unknown as File,
        url: BASE_IMG + detail.clothes_img
      }]
    }
    if (detailImageRef.value && detail.detail_image_list && Array.isArray(detail.detail_image_list) && detail.detail_image_list.length > 0) {
      detailImageRef.value.previewImages = detail.detail_image_list.map((img: string) => ({
        id: `img_${Date.now()}_${Math.random()}`,
        file: undefined as unknown as File,
        url: BASE_IMG + img
      }))
    } else if (detailImageRef.value && detail.detail_image && typeof detail.detail_image === 'string') {
      const imgs = detail.detail_image.split(',').filter((img: string) => img.trim() !== '')
      detailImageRef.value.previewImages = imgs.map((img: string) => ({
        id: `img_${Date.now()}_${Math.random()}`,
        file: undefined as unknown as File,
        url: BASE_IMG + img
      }))
    }
  })
}

/** 二级确认弹框内点击确认：拉取详情、代入表单、替换已选（单选）、关闭弹窗 */
const onConfirmOverwrite = async () => {
  const item = selectedSharedClothes.value
  if (!item?.clothes_id) {
    showConfirmOverwriteModal.value = false
    return
  }
  confirmDetailLoading.value = true
  try {
    const detail = await getClothesDetail({ clothes_id: item.clothes_id })
    fillFormFromSharedDetail(detail)
    selectedIncludeIds.value.clear()
    confirmedSharedClothesList.value = [detail]
    // 用户引用他人共享服饰，增加被引用服饰的 citation_count
    await addClothesCitation({ clothes_id: item.clothes_id }).catch(() => {})
  } catch {
    fillFormFromSharedDetail(item)
    selectedIncludeIds.value.clear()
    confirmedSharedClothesList.value = [item]
    await addClothesCitation({ clothes_id: item.clothes_id }).catch(() => {})
  } finally {
    confirmDetailLoading.value = false
  }
  showConfirmOverwriteModal.value = false
  selectedSharedClothes.value = null
  showClothesSharedPopover.value = false
}

const onRemoveConfirmedSharedClothes = (item: WardrobeClothes) => {
  const mainItem = confirmedSharedClothesList.value.find((c) => c.clothes_id === item.clothes_id)
  if (mainItem?.include?.length) {
    mainItem.include.forEach((child) => selectedIncludeIds.value.delete(child.clothes_id!))
  }
  confirmedSharedClothesList.value = confirmedSharedClothesList.value.filter(
    (c) => c.clothes_id !== item.clothes_id
  )
}

/** 已选中的关联子服饰 ID 集合（多选） */
const selectedIncludeIds = ref<Set<number>>(new Set())

const isIncludeChildSelected = (child: WardrobeClothes) =>
  child.clothes_id != null && selectedIncludeIds.value.has(child.clothes_id)

const onToggleIncludeChild = (child: WardrobeClothes) => {
  if (child.clothes_id == null) return
  const next = new Set(selectedIncludeIds.value)
  if (next.has(child.clothes_id)) {
    next.delete(child.clothes_id)
  } else {
    next.add(child.clothes_id)
  }
  selectedIncludeIds.value = next
}

const onCancelSharedClothes = () => {
  showClothesSharedPopover.value = false
}

/** 已点选的关联服饰列表（用于底部展示及传参） */
const selectedIncludeItems = computed(() => {
  const items: WardrobeClothes[] = []
  const ids = selectedIncludeIds.value
  for (const main of confirmedSharedClothesList.value) {
    if (!main.include?.length) continue
    for (const child of main.include) {
      if (child.clothes_id != null && ids.has(child.clothes_id)) {
        items.push(child)
      }
    }
  }
  return items
})

// 弹窗打开时，输入框内容变化触发搜索（聚焦时由 onClothesNoteFocus 直接请求，避免重复）
watch(
  () => form.value.clothes_note,
  () => {
    if (showClothesSharedPopover.value) debouncedFetchSharedClothesList()
  }
)

const shop_options_loading = ref(false)
const shop_options = ref<Shop[]>([])
const origin_shop = ref<Shop | undefined>(undefined)
const fetchShopOptiosns = async (keywords: string) => {
  shop_options_loading.value = true
  const response = await getShopOptiosns({ shop_name: keywords || '' })
  shop_options.value = response
  const data: Shop[] = []
  if (response.length > 20) {
    data.push(...response.slice(0, 19))
  } else {
    data.push(...response)
  }
  return data
}
const showChooseLibrary = () => {
  if (LibraryChooseRef.value) {
    LibraryChooseRef.value.showModel()
  }
}

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

const handleSceneChooseClose = () => {
  showSceneChooseModal.value = false
}

const chooseTemplate = () => {
  // 套用模版 - 先空实现
  showSceneChooseModal.value = false
  // TODO: 实现套用模版功能
}

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
const showModel = async (item: ExtendedClothesItem | null, isCopy = false, event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  // 初始化配置选项
  const config = configStore.config
  if (wardrobeStore.config) {
    const fromConfig = wardrobeStore.config?.wardrobe_status?.map((child) => ({
      value: child,
      label: child
    })) ?? []
    wardrobe_status_options.value = [
      ...wardrobe_status_defaults,
      ...fromConfig.filter((o) => !wardrobe_status_defaults.some((d) => d.label === o.label))
    ]
    clothes_part_options.value = wardrobeStore.config?.clothes_part.map((child) => {
      return {
        value: child,
        label: child
      }
    })
  }
  if (config) {
    main_style_options.value = config?.main_style.map((child) => {
      return {
        value: child.value,
        label: child.label
      }
    })
  }

  // 设置类型：0=添加，1=编辑
  type.value = isCopy ? 0 : (item?.clothes_id ? 1 : 0)

  // 初始化表单数据
  console.log(item, '编辑服饰', item?.clothes_img, wardrobeCoverRef.value)
  if (item) {
    // 基本字段
    form.value.wardrobe_id = item.wardrobe_id || null
    form.value.clothes_id = isCopy ? null : (item.clothes_id || null)
    form.value.clothes_note = item.clothes_note || ''
    form.value.note = item.note || ''
    form.value.price = item.price || 0
    form.value.size = item.size || ''
    form.value.position = item.position || ''
    form.value.times = item.times || 0
    form.value.sum_price = item.sum_price !== undefined ? item.sum_price : 1
    form.value.is_have = item.is_have !== undefined ? item.is_have : true
    form.value.wardrobe_status = item.wardrobe_status || null
    form.value.plan_id = item.plan_id || null
    form.value.is_shared = item.is_shared !== undefined ? item.is_shared : 0
    // 修改时代入 plan，支持从 item.plan 或按 plan_id 拉取
    if (item.plan && (item.plan as PlanList).list_id) {
      plan.value = item.plan as PlanList
    } else if (item.plan_id) {
      try {
        const res = await getPlanList({ list_id: item.plan_id, pageSize: 1 })
        if (res?.rows?.[0]) {
          plan.value = res.rows[0]
        } else {
          plan.value = null
        }
      } catch {
        plan.value = null
      }
    } else {
      plan.value = null
    }
    if (isCopy) {
      form.value.plan_id = null
      plan.value = null
    }
    form.value.add_time = item.add_time || null
    form.value.origin = item.origin || null
    setTimeout(() => {
      if (item.detail_image_list && Array.isArray(item.detail_image_list) && item.detail_image_list.length > 0 && detailImageRef.value) {
        detailImageRef.value.previewImages = item.detail_image_list.map((img: string) => ({
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + img
        }))
      }
      if (item.clothes_img && wardrobeCoverRef.value) {
        wardrobeCoverRef.value.previewImages = [{
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + item.clothes_img
        }]
        console.log(wardrobeCoverRef.value.previewImages, '主图')
      }
    });
    // 处理颜色数组
    if (item.color) {
      if (typeof item.color === 'string') {
        form.value.color = item.color.split(',').filter((c: string) => c.trim() !== '')
      } else if (Array.isArray(item.color)) {
        form.value.color = [...item.color]
      } else {
        form.value.color = []
      }
    } else {
      form.value.color = []
    }

    // 处理标签数组
    if (item.tags) {
      if (typeof item.tags === 'string') {
        form.value.tags = item.tags.split(',').filter((t: string) => t.trim() !== '')
      } else if (Array.isArray(item.tags)) {
        form.value.tags = [...item.tags]
      } else {
        form.value.tags = []
      }
    } else {
      form.value.tags = []
    }

    // 处理季节数组
    if (item.season) {
      if (typeof item.season === 'string') {
        form.value.season = item.season.split(',').filter((s: string) => s.trim() !== '')
      } else if (Array.isArray(item.season)) {
        form.value.season = [...item.season]
      } else {
        form.value.season = []
      }
    } else {
      form.value.season = []
    }

    // 处理部位数组
    if (item.clothes_part) {
      if (typeof item.clothes_part === 'string') {
        const parts = item.clothes_part.split(',').filter((p: string) => p.trim() !== '')
        form.value.clothes_part = parts.map((part: string): optionsInterface => ({
          value: part,
          label: part
        }))
      } else if (Array.isArray(item.clothes_part)) {
        // 如果已经是 optionsInterface 格式
        form.value.clothes_part = (item.clothes_part as (string | optionsInterface)[]).map((part: string | optionsInterface): optionsInterface => {
          if (typeof part === 'string') {
            return { value: part, label: part }
          }
          return part
        })
      } else {
        form.value.clothes_part = []
      }
    } else {
      form.value.clothes_part = []
    }

    // 处理主要风格数组
    if (item.main_style_list && Array.isArray(item.main_style_list) && item.main_style_list.length > 0) {
      // 如果已经有 main_style_list（来自详情页）
      form.value.main_style = item.main_style_list.map((style: { label: string; value: number }) => ({
        value: style.value,
        label: style.label
      }))
    } else if (item.main_style) {
      // 如果是字符串格式
      if (typeof item.main_style === 'string') {
        const styles = item.main_style.split(',').filter((s: string) => s.trim() !== '')
        form.value.main_style = styles.map((styleValue: string) => {
          const styleNum = Number.parseInt(styleValue, 10)
          const styleOption = main_style_options.value.find(opt => opt.value === styleNum)
          return styleOption || { value: styleNum, label: styleValue }
        })
      } else if (Array.isArray(item.main_style)) {
        form.value.main_style = (item.main_style as (string | optionsInterface)[]).map((style: string | optionsInterface): optionsInterface => {
          if (typeof style === 'string') {
            const styleNum = Number.parseInt(style, 10)
            const styleOption = main_style_options.value.find(opt => opt.value === styleNum)
            return styleOption || { value: styleNum, label: style }
          }
          return style
        })
      } else {
        form.value.main_style = []
      }
    } else {
      form.value.main_style = []
    }

    // 处理图鉴关联
    if (item.library) {
      library.value = item.library
    } else {
      library.value = null
    }

    // 处理场景关联
    if (item.scene) {
      scene.value = item.scene
    } else {
      scene.value = null
    }

    // 处理来源店铺
    if (item.origin_shop) {
      origin_shop.value = item.origin_shop
    } else {
      // 如果 origin 存在但不是 origin_shop，暂时设为 undefined
      // 后续可以通过 origin 字段查找店铺
      origin_shop.value = undefined
    }

    // 处理衣柜名称
    wardrobeName.value = item.wardrobe_name || item.wardrobe?.wardrobe_name || ''
    wardrobe.value = item.wardrobe || null

    // 处理主图
    if (wardrobeCoverRef.value) {
      if (item.clothes_img) {
        wardrobeCoverRef.value.previewImages = [{ 
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File, 
          url: BASE_IMG + item.clothes_img 
        }]
      } else {
        wardrobeCoverRef.value.previewImages = []
      }
    }

    // 处理详情图
    if (detailImageRef.value) {
      if (item.detail_image_list && Array.isArray(item.detail_image_list) && item.detail_image_list.length > 0) {
        detailImageRef.value.previewImages = item.detail_image_list.map((img: string) => ({
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + img
        }))
      } else if (item.detail_image && typeof item.detail_image === 'string') {
        const detailImages = item.detail_image.split(',').filter((img: string) => img.trim() !== '')
        detailImageRef.value.previewImages = detailImages.map((img: string) => ({
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + img
        }))
      } else {
        detailImageRef.value.previewImages = []
      }
    }
  } else {
    // 如果没有传入 item，重置表单
    initData()
    plan.value = null
  }

  show.value = true
}

const showColorPicker = () => {
  if (ColorPickerRef.value) {
    ColorPickerRef.value.showModel()
  }
}
const wardrobeName = ref('')
const library = ref<Library | null>(null)
const scene = ref<Scene | null>(null)

const showControl = ref({
  color_choose: false,
  wardrobe_status: false,
  main_style: false,
  clothes_part: false,
  add_time: false,
  season: false,
  tags_custom: false,
})
const chooseLibrary = (list: Library[]) => {
  if (list.length > 0) {
    const selectedLibrary = list[0]
    library.value = selectedLibrary
    
    // 如果 clothes_note 没有填写，则设置为 library.name
    if (!form.value.clothes_note || form.value.clothes_note.trim() === '') {
      form.value.clothes_note = selectedLibrary.name || ''
    }
    
    // 如果没有选择图片，则设置为 library.cover
    if (wardrobeCoverRef.value && wardrobeCoverRef.value.previewImages.length === 0) {
      if (selectedLibrary.cover) {
        wardrobeCoverRef.value.previewImages = [{
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + selectedLibrary.cover
        }]
      }
    }
    
    // 如果 price 没填（为0或null），则设置为 library.library_price
    if (!form.value.price || form.value.price === 0) {
      form.value.price = selectedLibrary.library_price || 0
    }

    // 如果有店铺信息，代入来源表单
    if (selectedLibrary.shop) {
      origin_shop.value = selectedLibrary.shop
    } else if (selectedLibrary.shop_id) {
      // 仅有 shop_id 时，创建最小化 Shop 对象
      origin_shop.value = {
        shop_id: selectedLibrary.shop_id,
        shop_name: `店铺 #${selectedLibrary.shop_id}`,
        shop_logo: '',
        shop_country: 0
      }
    }
  }
}

const chooseScene = (list: Scene[]) => {
  if (list.length > 0) {
    const selectedScene = list[0]
    scene.value = selectedScene
    form.value.plan_id = selectedScene.sence_id
  }
}

// 尾款计划：创建
const showPlanAddEdit = (e?: MouseEvent) => {
  if (e) {
    planAddEditClickPosition.value = { x: e.clientX, y: e.clientY }
  } else {
    planAddEditClickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  PlanAddEditRef.value?.showModel(e)
}

// 尾款计划：编辑（代入 plan）
const showPlanAddEditForEdit = (e?: MouseEvent) => {
  if (!plan.value) return
  if (e) {
    planAddEditClickPosition.value = { x: e.clientX, y: e.clientY }
  } else {
    planAddEditClickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  PlanAddEditRef.value?.showModel(e)
}

// 计划创建成功：记录计划，显示金额，传参 plan_id
const onPlanInsert = (data: PlanList) => {
  if (data?.list_id) {
    form.value.plan_id = data.list_id
    plan.value = data
  }
}

// 计划编辑成功：更新本地 plan
const onPlanUpdated = (data: PlanList) => {
  if (data) plan.value = data
}

const clearPlan = () => {
  plan.value = null
  form.value.plan_id = null
}
const chooseColor = (color: string) => {
  if (form.value.color.findIndex((child: string) => {
    return child === color
  }) === -1) {
    form.value.color.push(color)
  }
}
const closeModel = () => {
  show.value = false
  initData()
}

const handleClose = () => {
  closeModel()
}
const initData = () => {
			form.value = {
				clothes_note: '',
				note: '',
				is_have: true,
				wardrobe_status: null,
				color: [],
				price: 0,
				season: [],
				clothes_part: [],
				sum_price: 1,
				origin: null,
				size: '',
				add_time: null,
				position: '',
				tags: [],
				main_style: [],
				plan_id: null,
        wardrobe_id: null,
        clothes_id: null,
        times: 0,
        is_shared: 0
			}
			// this.plan = null
			library.value = null
			scene.value = null
			wardrobe.value = null
			wardrobeName.value = ''
			origin_shop.value = undefined
			plan.value = null
			showClothesSharedPopover.value = false
			selectedSharedClothes.value = null
			sharedClothesList.value = []
			confirmedSharedClothesList.value = []
			selectedIncludeIds.value.clear()

			// 清空图片选择器
			if (wardrobeCoverRef.value) {
				wardrobeCoverRef.value.previewImages = []
			}
			if (detailImageRef.value) {
				detailImageRef.value.previewImages = []
			}
		}
const fetchUpload = async (file: { file: { readonly lastModified: number; readonly name: string; readonly webkitRelativePath: string; readonly size: number; readonly type: string; arrayBuffer: { (): Promise<ArrayBuffer>; (): Promise<ArrayBuffer> }; bytes: { (): Promise<Uint8Array<ArrayBuffer>>; (): Promise<Uint8Array<ArrayBuffer>> }; slice: { (start?: number, end?: number, contentType?: string): Blob; (start?: number, end?: number, contentType?: string): Blob }; stream: { (): ReadableStream<Uint8Array<ArrayBuffer>>; (): ReadableStream<Uint8Array<ArrayBuffer>> }; text: { (): Promise<string>; (): Promise<string> } }; url: string }) => {
  try {
    let url: string
    if (file.file) {
      console.log(file.file, 'file.file图片文件')
      const res = await uploadImage(file.file)
      url = res.file_url
    } else {
      url = file.url.replace(BASE_IMG, '')
    }
    return url
  } catch (error) {
    throw error;
  }
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  // uploadImage(file[0])
  //   .then(async (res) => {
  //     console.log('上传返回', res)
  //     if ( imageType.value === 0) {
  //       emit('addImage', res)

  //     } else {
  //       emit('addBackgroun', res)

  //     }
      
  //     if (imagePicker.value) {
  //       imagePicker.value.clear()
  //     }
  //   })
}
const insert = async () => {
  if (loading.value) {
    return
  }
  loading.value = true
  const { clothes_note, wardrobe_id, clothes_id, add_time, position, size, is_have, wardrobe_status, clothes_part, note, sum_price } = form.value
	let { color, season, price, times, tags, main_style, plan_id } = form.value
  const params: any = {
    wardrobe_id,
    wardrobe_status,
    sum_price,
    is_shared: form.value.is_shared ?? 0
  }
  if (size !== '') {
    params.size = size
  } else {
    params.size = null
  }
  if (position !== '') {
    params.position = position
  } else {
    params.position = null
  }
  if (clothes_note !== '') {
    params.clothes_note = clothes_note
  } else {
    params.clothes_note = null
  }
  if (note !== '') {
    params.note = note
  } else {
    params.note = null
  }
  if (origin_shop.value) {
    if (origin_shop.value.shop_id) {
      params.origin = origin_shop.value.shop_id
    } else {
      params.origin = origin_shop.value.shop_name
    }
  } else {
    params.origin = null
  }
  if (clothes_part && Array.isArray(clothes_part) && clothes_part.length > 0) {
    params.clothes_part = clothes_part.map((p: optionsInterface) => p.label || String(p.value)).join(',')
  } else {
    params.clothes_part = null
  }
  if (library.value) {
    params.library_id = library.value.library_id
  } else {
    params.library_id = null
  }

  params.plan_id = form.value.plan_id
  params.is_shared = form.value.is_shared ?? 0

  // 点选的关联服饰，通过 include_clothes 传参（逗号分隔 clothes_id）
  if (selectedIncludeIds.value.size > 0) {
    params.include_clothes = Array.from(selectedIncludeIds.value).join(',')
  } else {
    params.include_clothes = null
  }

  if (color && color.length > 0) {
    params.color = color.join()
  } else {
    params.color = null
  }

  if (price && price !== 0) {
    params.price = price
  } else {
    params.price = null
  }

  if (times !== undefined && times !== null) {
    params.times = times
  } else {
    params.times = 0
  }
  if (tags && tags.length > 0) {
    params.tags = tags.join()
  } else {
    params.tags = null
  }

  if (main_style && Array.isArray(main_style) && main_style.length > 0) {
    params.main_style = main_style.map((child: optionsInterface) => child.value).join(',')
  } else {
    params.main_style = null
  }
  if (season && Array.isArray(season) && season.length > 0) {
    params.season = season.join(',')
  } else {
    params.season = null
  }
  if (add_time) {
    // 处理日期格式：如果是 Date 对象，转换为 YYYY-MM-DD 格式；如果是字符串，直接使用
    if (add_time instanceof Date) {
      const year = add_time.getFullYear()
      const month = String(add_time.getMonth() + 1).padStart(2, '0')
      const day = String(add_time.getDate()).padStart(2, '0')
      params.add_time = `${year}-${month}-${day}`
    } else if (typeof add_time === 'string') {
      params.add_time = add_time
    } else {
      params.add_time = null
    }
  } else {
    params.add_time = null
  }
  if (wardrobeCoverRef.value && wardrobeCoverRef.value.previewImages.length > 0) {
    console.log(wardrobeCoverRef.value.previewImages, '图片')
    try {
      const clothes_img = await fetchUpload(wardrobeCoverRef.value.previewImages[0])
      
      params.clothes_img = clothes_img
    } catch (error) {
      console.log(params, '传图失败')
      params.clothes_img = null
    }
    console.log(params, '传图成功')
  } else {
    params.clothes_img = null
  }
  console.log(params, '参数')
  if (detailImageRef.value && detailImageRef.value.previewImages.length > 0) {
    const detail_image = []
    for (let index = 0; index < detailImageRef.value.previewImages.length; index++) {
      const element = detailImageRef.value.previewImages[index];
      try {
        const url = await fetchUpload(element)
        detail_image.push(url)
      } catch (error) {
        
      }
    }
    params.detail_image = detail_image.join()
  } else {
    params.detail_image = null
  }
  // 点选的关联服饰，通过 include_clothes 传参（逗号分隔 clothes_id）
  if (selectedIncludeIds.value.size > 0) {
    params.include_clothes = Array.from(selectedIncludeIds.value).join(',')
  } else {
    params.include_clothes = null
  }
  if (type.value === 0) {
      insertClothes(params)
        .then((res) => {
          emit('success')
          closeModel()
        })
        .finally(() => {
          loading.value = false
        })
    } else {
      params.clothes_id = clothes_id
      updateClothes(params)
        .then((res) => {
          emit('success')
          closeModel()
        })
        .finally(() => {
          loading.value = false
        })
    }


}

// 日期输入的计算属性，用于处理 Date | string | null 到 string 的转换
const addTimeInput = computed({
  get: () => {
    if (!form.value.add_time) return ''
    if (form.value.add_time instanceof Date) {
      const year = form.value.add_time.getFullYear()
      const month = String(form.value.add_time.getMonth() + 1).padStart(2, '0')
      const day = String(form.value.add_time.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return String(form.value.add_time)
  },
  set: (value: string | null) => {
    form.value.add_time = value || null
  }
})

defineExpose({
  showModel
})
</script>

<template>
  <!-- Popup -->
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold ">
          {{ type === 0 ? '新增服饰' : '编辑服饰' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div ref="contentScrollRef" class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">

        <!-- 衣柜名称 -->
        <div class="grid grid-cols-12 gap-4 items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl border border-blue-100 dark:border-gray-600">
          <div class="col-span-3 font-semibold text-gray-700 dark:text-gray-300">衣柜名称</div>
          <div class="col-span-9 text-gray-900 dark:text-gray-100 font-medium">{{ wardrobeName }}</div>
        </div>

        <!-- 主要信息板块 -->
        <div class="space-y-6">
          <!-- 关联图鉴 -->
          <UFormGroup label="关联图鉴" class="space-y-3">
            <div v-if="library" class="inline-block">
              <QhxTag
                :active="true"
                class="transition-all duration-200 hover:scale-105"
              >
                <div class="flex items-center gap-2">
                  <QhxJellyButton class="cursor-pointer flex items-center justify-center w-5 h-5 text-white rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 transition-all" @click.stop="library = null">
                    <UIcon name="ant-design:close-outlined" class="text-xs text-white" />
                  </QhxJellyButton>
                  <span class="font-medium">{{ library.name }}</span>
                </div>
              </QhxTag>
            </div>
            <div v-else class="space-y-2">
              <UButton 
                type="submit" 
                size="sm"
                class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md shadow-pink-500/30 transition-all duration-200"
                :loading="loading"
                @click="showChooseLibrary()"
              >
                <UIcon name="material-symbols:book-rounded" class="mr-1" />
                选择图鉴
              </UButton>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 关联图鉴可自动填入名称、图片和价格信息
              </p>
            </div>
          </UFormGroup>

          <!-- 关联场景 -->
          <!-- <UFormGroup label="关联场景" class="space-y-3">
            <div v-if="scene" class="inline-block">
              <QhxTag
                :active="true"
                class="transition-all duration-200 hover:scale-105"
              >
                <div class="flex items-center gap-2">
                  <QhxJellyButton class="cursor-pointer flex items-center justify-center w-5 h-5 rounded-full" @click.stop="scene = null; form.plan_id = null">
                    <UIcon name="ant-design:close-outlined" class="text-xs" />
                  </QhxJellyButton>
                  <span class="font-medium">{{ scene.sence_desc || '未命名场景' }}</span>
                </div>
              </QhxTag>
            </div>
            <div v-else class="space-y-2">
              <UButton
                type="submit" 
                size="sm"
                class="bg-qhx-primary text-qhx-inverted shadow-lg shadow-blue-500/30 transition-all duration-200"
                :loading="loading"
                @click="(e: MouseEvent) => showChooseScene(e)"
              >
                <UIcon name="material-symbols:scatter-plot-rounded" class="mr-1" />
                选择场景
              </UButton>
            </div>
          </UFormGroup> -->

          <!-- 服饰图片（封面） -->
          <UFormGroup label="服饰封面" class="space-y-2">
            <div class=" bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="wardrobeCoverRef" />
            </div>
          </UFormGroup>

          <!-- 名称 -->
          <div ref="clothesNoteFormRef">
          <UFormGroup label="名称" class="relative">
            <UInput
                v-model="form.clothes_note"
                placeholder="名称(原笔记)"
                class="flex-1 focus:ring-0"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }"
                @focus="onClothesNoteFocus"
              />
            <!-- 新增服饰时，聚焦显示共享服饰列表 -->
            <div
              ref="sharedPopoverRef"
              v-if="type === 0 && showClothesSharedPopover"
              class="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl max-h-64 overflow-hidden flex flex-col"
            >
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
                <span class="text-xs text-gray-500 dark:text-gray-400">此处为用户共享服饰，可不选</span>
              </div>
              <div class="flex-1 overflow-y-auto p-2 min-h-0">
                <div v-if="sharedClothesLoading" class="flex justify-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin text-xl text-qhx-primary" />
                </div>
                <div v-else-if="sharedClothesList.length === 0" class="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  暂无匹配的共享服饰
                </div>
                <div
                  v-else
                  v-for="item in sharedClothesList"
                  :key="item.clothes_id"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="selectedSharedClothes?.clothes_id === item.clothes_id
                    ? 'bg-qhx-primary/25 dark:bg-qhx-primary/35 ring-2 ring-qhx-primary ring-inset'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'"
                  @click="onSelectSharedClothes(item)"
                >
                  <img
                    v-if="item.clothes_img"
                    :src="BASE_IMG + item.clothes_img"
                    class="w-10 h-10 rounded object-cover flex-shrink-0"
                    alt=""
                  />
                  <div v-else class="w-10 h-10 rounded bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                    <UIcon name="i-heroicons-photo" class="text-gray-400 text-lg" />
                  </div>
                  <span class="flex-1 truncate text-sm">{{ item.clothes_note || '未命名' }}</span>
                </div>
              </div>
              <div class="flex justify-end gap-2 p-2 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
                <UButton size="xs" variant="ghost" @click="onCancelSharedClothes">取消</UButton>
                <UButton size="xs" color="primary" :disabled="!selectedSharedClothes || confirmDetailLoading" :loading="confirmDetailLoading" @click="onRequestConfirmSharedClothes">
                  确认选择
                </UButton>
              </div>
            </div>
          </UFormGroup>
          <!-- 已选择的共享服饰（完整主服饰回显 + 子服饰列表） -->
          <div
            v-if="type === 0 && confirmedSharedClothesList.length > 0"
            class="mt-3 space-y-3"
          >
            <span class="text-sm text-gray-500 dark:text-gray-400">已选择：</span>
            <div class="space-y-3">
              <div
                v-for="mainItem in confirmedSharedClothesList"
                :key="mainItem.clothes_id"
                class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 overflow-hidden"
              >
                <!-- 主服饰 -->
                <div class="flex items-start gap-3 p-3">
                  <img
                    v-if="mainItem.clothes_img"
                    :src="BASE_IMG + mainItem.clothes_img"
                    class="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    alt=""
                  />
                  <div v-else class="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                    <UIcon name="i-heroicons-photo" class="text-gray-400 text-xl" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 dark:text-gray-100">{{ mainItem.clothes_note || '未命名' }}</div>
                    <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span v-if="mainItem.price">¥{{ mainItem.price }}</span>
                      <span v-if="mainItem.origin">{{ mainItem.origin }}</span>
                      <span v-if="mainItem.clothes_part">{{ mainItem.clothes_part }}</span>
                      <span v-if="mainItem.color">{{ mainItem.color }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                    @click="onRemoveConfirmedSharedClothes(mainItem)"
                  >
                    <UIcon name="i-heroicons-x-mark" class="text-base text-gray-500" />
                  </button>
                </div>
                <!-- 关联子服饰列表 -->
                <div
                  v-if="mainItem.include && mainItem.include.length > 0"
                  class="border-t border-gray-200 dark:border-gray-600 px-3 py-2 bg-white/50 dark:bg-gray-900/30"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">关联服饰</span>
                    <span class="text-xs text-amber-600 dark:text-amber-400">（点击可多选）</span>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="child in mainItem.include"
                      :key="child.clothes_id"
                      role="button"
                      tabindex="0"
                      class="inline-flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors border"
                      :class="isIncludeChildSelected(child)
                        ? 'bg-qhx-primary/25 dark:bg-qhx-primary/35 ring-2 ring-qhx-primary ring-inset border-qhx-primary/50'
                        : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'"
                      @click="onToggleIncludeChild(child)"
                    >
                      <img
                        v-if="child.clothes_img"
                        :src="BASE_IMG + child.clothes_img"
                        class="w-6 h-6 rounded object-cover flex-shrink-0"
                        alt=""
                      />
                      <div v-else class="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                        <UIcon name="i-heroicons-photo" class="text-gray-400 text-xs" />
                      </div>
                      <span class="text-xs truncate max-w-[100px]">{{ child.clothes_note || '未命名' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <!-- 基础信息板块 -->
        <div class="space-y-4">
        <UFormGroup label="来源">
          <div class="flex items-center">
            <USelectMenu
              v-model="origin_shop"
              :loading="loading"
              :searchable="fetchShopOptiosns"
              placeholder="搜索店铺..."
              option-attribute="shop_name"
              creatable
              :multiple="false"
              trailing
              by="shop_id"
              name="shop_name"
              class="flex-1"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
            <QhxJellyButton>
              <div class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                @click="origin_shop = undefined">
                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
              </div>
            </QhxJellyButton>
          </div>
        </UFormGroup>
        <!-- 价格 -->
        <UFormGroup label="价格">
          <UInput
              v-model="form.price"
              type="number"
              placeholder="价格"
              class="flex-1 focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
        </UFormGroup>
        <UFormGroup label="尾款计划" class="space-y-3">
          <div v-if="plan" class="space-y-2">
            <div
              class="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-r from-amber-50/80 to-orange-50/60 dark:from-gray-700/40 dark:to-gray-800/40 transition-all duration-200 hover:shadow-md hover:border-amber-300/60 dark:hover:border-amber-500/40"
            >
              <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg flex-shrink-0" />
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ plan.plan_name || '尾款计划' }}</span>
                <span class="text-base font-bold text-amber-600 dark:text-amber-400">¥{{ plan.need_money ?? 0 }}</span>
              </div>
              <div class="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-100/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors"
                  title="编辑"
                  @click.stop="showPlanAddEditForEdit($event)"
                >
                  <UIcon name="ant-design:edit-outlined" class="text-sm" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="移除"
                  @click.stop="clearPlan"
                >
                  <UIcon name="ant-design:close-outlined" class="text-sm" />
                </button>
              </div>
            </div>
            <!-- 子计划简单列表 -->
            <div
              v-if="plan.plan_list && plan.plan_list.length > 0"
              class="ml-6 pl-3 border-l-2 border-amber-200/60 dark:border-amber-600/40 space-y-1.5"
            >
              <div
                v-for="(child, idx) in plan.plan_list"
                :key="child.list_id ?? idx"
                class="flex items-center justify-between gap-2 py-1 text-xs"
              >
                <span class="text-gray-600 dark:text-gray-400 truncate">{{ child.plan_note || `阶段 ${idx + 1}` }}</span>
                <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">¥{{ child.need_money ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div v-else class="space-y-2">
            <UButton
              type="button"
              size="sm"
              class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 transition-all duration-200"
              :loading="loading"
              @click="showPlanAddEdit($event)"
            >
              <UIcon name="material-symbols:savings-rounded" class="mr-1.5" />
              创建尾款计划
            </UButton>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              💡 可将当前价格预填到计划中
            </p>
          </div>
        </UFormGroup>
        <UFormGroup label="尺码">
          <UInput
            v-model="form.size"
            placeholder="尺码"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>
        <!-- 计入总价 -->
        <UFormGroup label="计入总价">
          <UToggle
            :model-value="form.sum_price === 1"
            @update:model-value="form.sum_price = $event ? 1 : 0"
          />
        </UFormGroup>
        </div>

        <!-- 分类信息板块 -->
        <div class="space-y-4">
        <!-- 颜色选择 -->
        <UFormGroup label="颜色">
          <div class="gap-2">
            <ClientOnly>
              <QhxColorPicker @choose="chooseColor" ref="ColorPickerRef"></QhxColorPicker>
            </ClientOnly>
            <div v-if="form.color.length > 0">
              <QhxTag
                v-for="(tag, index) in form.color"
                :style="{ background: tag }"
              >
                <div class="flex">
                  <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.color.splice(index, 1)">
                    <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                  </QhxJellyButton>
                  <div>{{ tag }}</div>
                </div>
              </QhxTag>
            </div>
            <UButton
              size="xs"
              color="primary"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
              @click="showColorPicker"
            >
              选择颜色
            </UButton>
          </div>
        </UFormGroup>
        <UFormGroup label="拥有状态">
          <div v-if="form.wardrobe_status">
            <QhxTag>
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.wardrobe_status = null">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ form.wardrobe_status }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openPicker(e) }"
          >
            选择状态
          </UButton>
          <QhxSelect 
            ref="qhxSelectRef"
            :options="wardrobe_status_options"
            :default-value="wardrobe_status_options[0]"
            :canCustomize="true"
            @select="(select) => { 
              form.wardrobe_status = select.label
             } "
          />
        </UFormGroup>
        <UFormGroup label="主要风格">
          <div class="flex items-center m-1" v-if="form.main_style && form.main_style.length > 0">
            <QhxTag v-for="(tag, index) in form.main_style" :key="tag.value">
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.main_style.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag.label }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="button" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            @click="(e: MouseEvent) => { showChooseMainStyle(e) }"
          >
            选择风格
          </UButton>
          <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="chooseMainStyleWiki" />
        </UFormGroup>
        <UFormGroup label="版型部位">
          <div v-if="form.clothes_part.length > 0">
            <QhxTag
              v-for="(tag, index) in form.clothes_part"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.clothes_part.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag.label }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openClothesPart(e) }"
          >
            选择版型
          </UButton>
          <QhxSelect 
            ref="clothesPartRef"
            :options="clothes_part_options"
            :default-value="clothes_part_options[0]"
            :canCustomize="true"
            @select="(select) => { 
              if (form.clothes_part.findIndex((child) => { return select.label === child.label }) === -1) {
                form.clothes_part.push(select)
              }
             } "
          />
        </UFormGroup>
        <UFormGroup label="自定义标签">
          <div>
            <QhxTag
              v-for="(tag, index) in form.tags"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.tags.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag }}</div>
              </div>
            </QhxTag>
          </div>
          <customInput @insert="(select) => { 
              if (form.tags.findIndex((child) => { return select === child }) === -1) {
                form.tags.push(select)
              }
             }" ref="tagRef"></customInput>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openTag(e) }"
          >
            添加tag
          </UButton>
        </UFormGroup>
        <UFormGroup label="适宜季节">
          <div v-if="form.season.length > 0" class="flex flex-wrap gap-2 mb-2">
            <QhxTag
              v-for="(season, index) in form.season"
              :key="index"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.season.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ season }}</div>
              </div>
            </QhxTag>
          </div>
          <USelectMenu 
            v-model="form.season" 
            :options="season_options" 
            placeholder="请选择季节" 
            multiple
            value-attribute="value"
            option-attribute="label"
            class="flex-1"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>
        </div>

        <!-- 其他信息板块 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="material-symbols:more-horiz-rounded" class="text-lg text-gray-500 dark:text-gray-400" />
            <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">其他信息</h3>
          </div>

        <!-- 笔记 -->
        <UFormGroup label="笔记">
          <UTextarea 
            v-model="form.note" placeholder="笔记" :rows="3" 
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>
        <UFormGroup label="穿着次数">
          <UInput
            v-model="form.times"
            type="number"
            placeholder="穿着次数"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>
        <!-- 收纳位置 -->
        <UFormGroup label="收纳位置">
          <UInput v-model="form.position"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
           placeholder="收纳位置" />
        </UFormGroup>
        <UFormGroup label="购入时间">
          <QhxDateTimePicker
            v-model="addTimeInput"
            mode="date"
            :enable-time-picker="false"
            format="YYYY-MM-DD"
            placeholder="选择购入时间"
          />
        </UFormGroup>
        <UFormGroup label="详情图" class="space-y-2">
          <div class=" bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" ref="detailImageRef" />
          </div>
        </UFormGroup>
        <!-- 是否分享（表单底部） -->
        <UFormGroup label="是否共享" class="space-y-2">
          <UToggle
            :model-value="form.is_shared === 1"
            @update:model-value="form.is_shared = $event ? 1 : 0"
          />
          <p v-if="form.is_shared === 1" class="text-xs text-amber-600 dark:text-amber-400">
            注意：当前为共享状态，服饰数据公开，其他用户可以直接导入衣柜
          </p>
          <p v-else class="text-xs text-amber-600 dark:text-amber-400">
            当前为私有状态
          </p>
        </UFormGroup>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton 
          color="gray" 
          variant="ghost"
          @click="closeModel"
          class="px-6"
        >
          取消
        </UButton>
        <UButton
          :loading="loading"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="insert"
        >
          {{ type === 1 ? '确认修改' : '确认添加' }}
        </UButton>
      </div>
    </div>
    <LibraryChoose ref="LibraryChooseRef" :keywordMode="true" @choose="chooseLibrary"></LibraryChoose>
    <SceneChoose ref="SceneChooseRef" @choose="chooseScene"></SceneChoose>
    <PlanAddEdit
      ref="PlanAddEditRef"
      :plan-list="plan"
      :initial-need-money="form.price || 0"
      @insert="onPlanInsert"
      @updated="onPlanUpdated"
    />
    
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
          <div
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
          </div>

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
    <!-- 二级确认：代入会覆盖信息 -->
    <QhxModal v-model="showConfirmOverwriteModal" :trigger-position="clickPosition" @close="showConfirmOverwriteModal = false">
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">操作确认</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-gray-600 dark:text-gray-400">代入会覆盖当前已填写信息，是否确认？</p>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <UButton color="gray" variant="outline" @click="showConfirmOverwriteModal = false">取消</UButton>
          <UButton color="primary" :loading="confirmDetailLoading" @click="onConfirmOverwrite">确认</UButton>
        </div>
      </div>
    </QhxModal>
  </QhxModal>
</template>
