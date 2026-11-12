<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue'
import type { Library, Shop, Wardrobe, Scene, PlanList, WardrobeClothes } from '~/types/api'
import { getShopOptiosns } from '@/api/shop'
import {
  insertClothes,
  updateClothes,
  getClothesSharedList,
  getClothesDetail,
  addClothesCitation,
  getWardrobeList,
  insertWardrobe,
  getClothesList
} from '@/api/wardrobe'
import { debounce } from '@/utils/public'
import { getPlanList } from '@/api/plan'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
const LibraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
import ClothesLibraryCoverPicker from '@/components/Clothes/ClothesLibraryCoverPicker.vue'
const libraryCoverPickerRef = ref<InstanceType<typeof ClothesLibraryCoverPicker> | null>(null)
import type SceneChoose from '@/components/scene/SceneChoose.vue'
const SceneChooseRef = ref<InstanceType<typeof SceneChoose> | null>(null)
import type PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
const PlanAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type { Wiki } from '@/types/api'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
import {
  mapConfigStatusOptions,
  wardrobePartLabel,
  wardrobeSeasonLabel,
  wardrobeSeasonOptions,
  wardrobeStatusLabel,
  wardrobeStatusOptions,
} from '@/utils/wardrobeDisplayI18n'
const ColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)

const { t } = useI18n()
const showCoverImageColorPicker = ref(false)
const imageColorPickerClickPosition = ref({ x: 0, y: 0 })
/** 服饰封面首张预览图，用于 canvas 取色 */
const coverPreviewUrl = computed(
  () => wardrobeCoverRef.value?.previewImages?.[0]?.url?.trim() ?? ''
)
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import type QhxOptionsChoose from '@/components/Qhx/OptionsChoose.vue'
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import { uploadImage } from '@/api';
import { BASE_IMG } from '@/utils/ipConfig'
import { normalizeClothesImgPath } from '@/utils/libraryClothesSeed'
import { uploadPairedLiveToOSS } from '@/utils/ossUpload'
import { normalizeRawImgPath } from '@/utils/communityLiveMedia'
import {
  clothesTermDeletedMessage,
  deleteClothesConfigOptionThenReload,
  type ClothesConfigOptionKind,
} from '@/utils/clothesConfigOption'

// 扩展类型以包含详情页传递的数据
interface ExtendedClothesItem extends Partial<Omit<WardrobeClothes, 'add_time' | 'origin'>> {
  wardrobe_name?: string
  wardrobe?: Wardrobe
  library?: Library | null
  scene?: Scene
  origin_shop?: Shop | Partial<Shop>
  plan?: PlanList
  main_style_list?: { label: string; value: number }[]
  detail_image_list?: string[]
  color_text?: string | null
  add_time?: Date | string | null
  origin?: string | number | null
  /** 识图填入：只覆盖非 null 字段 */
  extractFill?: boolean
  /** 调用方已拉过 /clothes/id，跳过二次 hydrate */
  detailReady?: boolean
}

const props = withDefaults(
  defineProps<{
    /** 新增 / 复制时在表单内用 QhxSelect 选择衣柜；若无衣柜则自动创建「默认衣柜」 */
    enableWardrobePicker?: boolean
  }>(),
  { enableWardrobePicker: false }
)

const emit = defineEmits<{
  /** 服饰写入成功后把接口返回带给上层（用于 AI 对话回显等） */
  success: [payload?: WardrobeClothes]
}>()

/** 表单操作按钮：胶囊圆角，与输入框风格统一 */
const capsuleBtnUi = { rounded: 'rounded-full' } as const


const statusChooseRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChoose> | null>(null)
const clothesPartChooseRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const wardrobeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const tagChooseRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const colorTextChooseRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
  const form = ref<{
  wardrobe_id: number | null
  clothes_id: number | null
  clothes_note: string
  is_have: boolean | number
  wardrobe_status: string | null
  color: string[]
  color_text: string[]
  tags: string[]
  price: number
  original_price: number | null
  offer_price: number | null
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
  num: number
  currency_type: string | number | null
  json_data: Record<string, unknown> | null
  is_favorite: number | null
}>({
  wardrobe_id: null,
  clothes_id: null,
  clothes_note: '',
  is_have: true,
  wardrobe_status: null,
  color: [],
  color_text: [],
  tags: [],
  price: 0,
  original_price: null,
  offer_price: null,
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
  is_shared: 0,
  num: 1,
  currency_type: null,
  json_data: null,
  is_favorite: null
})
  
const openPicker = (e: MouseEvent) => {
  const selected = form.value.wardrobe_status
    ? [{ value: form.value.wardrobe_status, label: wardrobeStatusLabel(t, form.value.wardrobe_status) }]
    : []
  statusChooseRef.value?.showPicker(e, selected)
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
  clothesPartChooseRef.value?.showPicker(
    e,
    form.value.clothes_part.map((part) => ({
      value: part.value,
      label: wardrobePartLabel(t, String(part.value || part.label)),
    })),
  )
}
const openTag = (e: MouseEvent) => {
  tagChooseRef.value?.showPicker(
    e,
    form.value.tags.map((tag) => ({ value: tag, label: tag })),
  )
}
const openColorText = (e: MouseEvent) => {
  colorTextChooseRef.value?.showPicker(
    e,
    form.value.color_text.map((tag) => ({ value: tag, label: tag })),
  )
}
const rememberOption = (list: optionsInterface[], item: optionsInterface) => {
  if (!list.some((opt) => opt.label === item.label)) {
    list.push({ value: item.value, label: item.label })
  }
}
const onStatusChoose = (list: optionsInterface[]) => {
  const first = list[0]
  const value = String(first?.value ?? '').trim()
  if (!value || !first) return
  form.value.wardrobe_status = value
  rememberOption(wardrobe_status_options.value, {
    value,
    label: first.label?.trim() || wardrobeStatusLabel(t, value),
  })
}
const onClothesPartChoose = (list: optionsInterface[]) => {
  for (const select of list) {
    const value = String(select.value ?? '').trim()
    const label = select.label?.trim() || wardrobePartLabel(t, value)
    if (!value) continue
    const item = { value, label }
    if (form.value.clothes_part.findIndex((child) => String(child.value) === value) === -1) {
      form.value.clothes_part.push(item)
    }
    rememberOption(clothes_part_options.value, item)
  }
}

const wardrobe = ref<Wardrobe | null>(null) // 衣柜信息
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
const userStore = useUserStore()
const toast = useToast()

/** iOS Tab 内嵌：底部留白（query.tabbar → configStore），避免弹框底部按钮被原生栏挡住 */
const tabBarInsetPx = computed(() => {
  const n = Number(configStore.tabBarHeight || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const modalPanelStyle = computed(() =>
  tabBarInsetPx.value > 0
    ? { maxHeight: `calc(90dvh - ${tabBarInsetPx.value}px)` }
    : undefined
)
console.log(wardrobeStore, '衣柜配置')
const wardrobe_status_defaults = computed(() => wardrobeStatusOptions(t))
const color_text_defaults: optionsInterface[] = [
  { value: '白色', label: '白色' },
  { value: '黑色', label: '黑色' },
  { value: '绀色', label: '绀色' },
  { value: '赤色', label: '赤色' },
  { value: '粉色', label: '粉色' },
  { value: '水色', label: '水色' },
  { value: '紫色', label: '紫色' },
  { value: '绿色', label: '绿色' },
  { value: '黄色', label: '黄色' },
  { value: '灰色', label: '灰色' },
  { value: '棕色', label: '棕色' },
  { value: '米色', label: '米色' },
]
const wardrobe_status_options = ref<optionsInterface[]>(wardrobeStatusOptions(t))
const color_text_options = ref<optionsInterface[]>([...color_text_defaults])
const main_style_options = ref<optionsInterface[]>([])
const clothes_part_options = ref<optionsInterface[]>([])
/** 自定义标签选项：仅使用接口已有记忆；没有则空列表，可在弹框内自定义 */
const tags_options = ref<optionsInterface[]>([])
let tagsFetchSeq = 0

function flattenTagList(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const tags: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    for (const part of item.split(',')) {
      const t = part.trim()
      if (t) tags.push(t)
    }
  }
  return [...new Set(tags)]
}

function readConfigMemoryTags(): string[] {
  const config = wardrobeStore.config as { tags?: unknown; tags_list?: unknown } | null | undefined
  if (!config) return []
  return flattenTagList(config.tags ?? config.tags_list)
}

function readItemMemoryTags(item: unknown): string[] {
  if (!item || typeof item !== 'object') return []
  const row = item as {
    config?: { tags?: unknown }
    wardrobe?: { config?: { tags?: unknown } }
  }
  return [
    ...flattenTagList(row.config?.tags),
    ...flattenTagList(row.wardrobe?.config?.tags)
  ]
}

function toTagOptions(labels: string[]): optionsInterface[] {
  return [...new Set(labels.map((t) => t.trim()).filter(Boolean))].map((label) => ({
    value: label,
    label
  }))
}

function syncTagsOptions(extra: string[] = []) {
  tags_options.value = toTagOptions([
    ...readConfigMemoryTags(),
    ...extra,
    ...form.value.tags
  ])
}

async function fetchWardrobeMemoryTags(wardrobeId: number | null | undefined): Promise<string[]> {
  if (wardrobeId == null || !Number.isFinite(Number(wardrobeId)) || Number(wardrobeId) <= 0) {
    return []
  }
  try {
    const res = await getClothesList({
      wardrobe_id: Number(wardrobeId),
      page: 1,
      pageSize: 1
    })
    return flattenTagList(res?.tags_list)
  } catch {
    return []
  }
}

async function loadMemoryTags(wardrobeId?: number | null, extra: string[] = []) {
  const seq = ++tagsFetchSeq
  syncTagsOptions(extra)
  const fromList = await fetchWardrobeMemoryTags(wardrobeId ?? form.value.wardrobe_id)
  if (seq !== tagsFetchSeq) return
  tags_options.value = toTagOptions([
    ...readConfigMemoryTags(),
    ...fromList,
    ...extra,
    ...form.value.tags
  ])
}

function onTagSelect(select: optionsInterface | string | null | undefined) {
  const label = (typeof select === 'string' ? select : select?.label)?.trim() ?? ''
  if (!label) return
  if (!form.value.tags.includes(label)) {
    form.value.tags.push(label)
  }
  if (!tags_options.value.some((o) => o.label === label)) {
    tags_options.value.push({ value: label, label })
  }
}
function onTagsChoose(list: optionsInterface[]) {
  for (const item of list) onTagSelect(item)
}

function setColorText(value: unknown) {
  form.value.color_text = splitCommaField(value)
  for (const label of form.value.color_text) {
    rememberOption(color_text_options.value, { value: label, label })
  }
}

function onColorTextChoose(list: optionsInterface[]) {
  const next: string[] = []
  for (const select of list) {
    const label = select.label?.trim()
    if (!label || next.includes(label)) continue
    next.push(label)
    rememberOption(color_text_options.value, { value: label, label })
  }
  form.value.color_text = next
}

function onDeleteColorText(item: optionsInterface) {
  const label = item.label?.trim()
  if (!label || color_text_defaults.some((opt) => opt.label === label)) return
  color_text_options.value = color_text_options.value.filter((opt) => opt.label !== label)
  form.value.color_text = form.value.color_text.filter((tag) => tag !== label)
}

function syncConfigOptions() {
  const cfg = wardrobeStore.config
  if (!cfg) return
  const defaults = wardrobe_status_defaults.value
  const fromConfig = mapConfigStatusOptions(t, cfg.wardrobe_status ?? [])
  wardrobe_status_options.value = [
    ...defaults,
    ...fromConfig.filter((o) => !defaults.some((d) => d.value === o.value)),
  ]
  clothes_part_options.value = (cfg.clothes_part ?? []).map((child) => ({
    value: child,
    label: wardrobePartLabel(t, child),
  }))
}

async function onDeleteConfigOption(kind: ClothesConfigOptionKind, item: optionsInterface) {
  const term = String(item.value ?? item.label ?? '').trim()
  if (!term) return
  try {
    const { updated } = await deleteClothesConfigOptionThenReload(kind, term)
    if (kind === 'wardrobe_status' && form.value.wardrobe_status?.trim() === term) {
      form.value.wardrobe_status = null
    }
    if (kind === 'clothes_part') {
      form.value.clothes_part = form.value.clothes_part.filter((part) => String(part.value).trim() !== term)
    }
    if (kind === 'tags') {
      form.value.tags = form.value.tags.filter((tag) => tag.trim() !== term)
    }
    syncConfigOptions()
    if (kind === 'tags') await loadMemoryTags(form.value.wardrobe_id)
    toast.add({ title: clothesTermDeletedMessage(updated), color: 'green', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({ title: t('wardrobe.toast.delete_failed'), color: 'red', icon: 'i-heroicons-exclamation-circle' })
  }
}
const season_options = computed(() => wardrobeSeasonOptions(t))
const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const clickPosition = ref({ x: 0, y: 0 })
/** enableWardrobePicker：下拉选项与缓存列表（表单内 QhxSelect） */
const wardrobeSelectOptions = ref<optionsInterface[]>([])
const wardrobeListCached = ref<Wardrobe[]>([])
const showSceneChooseModal = ref(false)
const sceneChooseClickPosition = ref({ x: 0, y: 0 })
const showColorListModal = ref(false)
const colorListClickPosition = ref({ x: 0, y: 0 })
const wardrobeColors = computed(() => {
  const list = wardrobeStore.config?.color_list
  if (!list?.length) return []
  return list
})
const plan = ref<PlanList | null>(null)
const planAddEditClickPosition = ref({ x: 0, y: 0 })
/** 防止快速切换服饰时，迟到的 getPlanList 覆盖当前计划 */
let planLoadSeq = 0

/** 深拷贝并按 list_id 去重子计划，避免列表行共享引用 / 重复阶段 */
const normalizeClothesPlan = (src: PlanList): PlanList => {
  const parentId = src.list_id
  const raw = Array.isArray(src.plan_list) ? src.plan_list : []
  const seen = new Set<number>()
  const plan_list: PlanList[] = []
  for (const child of raw) {
    if (!child) continue
    const id = child.list_id
    if (parentId != null && id === parentId) continue
    if (id != null) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    plan_list.push({ ...child })
  }
  return { ...src, plan_list }
}

const resolveClothesPlan = async (
  item: ExtendedClothesItem,
  seq: number
): Promise<void> => {
  // 优先用服饰详情/列表已带回的 plan（hydrateClothesForEdit → /clothes/id）
  const embedded = item.plan as PlanList | undefined
  if (embedded?.list_id) {
    if (seq === planLoadSeq) plan.value = normalizeClothesPlan(embedded)
    return
  }
  const planId = item.plan_id ?? null
  if (planId == null) {
    if (seq === planLoadSeq) plan.value = null
    return
  }
  // 仅有 plan_id、无嵌套 plan 时再单独拉计划
  try {
    const res = await getPlanList({ list_id: planId, pageSize: 1 })
    if (seq !== planLoadSeq) return
    if (res?.rows?.[0]) {
      plan.value = normalizeClothesPlan(res.rows[0])
      return
    }
  } catch {
    /* ignore */
  }
  if (seq === planLoadSeq) plan.value = null
}

/** 编辑已有服饰时，计划弹窗预填关联服饰 */
const planLinkedClothesPreset = computed((): WardrobeClothes | null => {
  if (form.value.clothes_id == null) return null
  return {
    clothes_id: form.value.clothes_id,
    clothes_note: form.value.clothes_note || undefined
  }
})

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
/** 共享服饰点赞：good 表 pk_type（与后端约定） */
const PK_TYPE_SHARED_CLOTHES_GOOD = 8

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
  form.value.original_price = detail.original_price ?? null
  form.value.offer_price = detail.offer_price ?? null
  form.value.size = detail.size || ''
  form.value.position = detail.position || ''
  form.value.times = detail.times || 0
  form.value.sum_price = detail.sum_price !== undefined ? detail.sum_price : 1
  form.value.is_have = detail.is_have !== undefined ? detail.is_have : true
  form.value.wardrobe_status = detail.wardrobe_status || null
  form.value.origin = detail.origin || null
  form.value.add_time = detail.add_time || null
  form.value.num = detail.num != null && Number.isFinite(Number(detail.num)) ? Number(detail.num) : 1
  form.value.currency_type = detail.currency_type ?? null
  form.value.json_data = detail.json_data ?? null
  if (detail.color) {
    form.value.color = typeof detail.color === 'string'
      ? detail.color.split(',').filter((c: string) => c.trim() !== '')
      : Array.isArray(detail.color) ? [...detail.color] : []
  } else {
    form.value.color = []
  }
  setColorText(detail.color_text)
  if (detail.tags) {
    form.value.tags = typeof detail.tags === 'string'
      ? detail.tags.split(',').filter((t: string) => t.trim() !== '')
      : Array.isArray(detail.tags) ? [...detail.tags] : []
  } else {
    form.value.tags = []
  }
  void loadMemoryTags(form.value.wardrobe_id, form.value.tags)
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
  else if (detail.library_id != null) {
    library.value = {
      library_id: detail.library_id,
      name: detail.clothes_note || '',
      cover: typeof detail.clothes_img === 'string' ? detail.clothes_img : '',
    }
  } else library.value = null
  if ((detail as ExtendedClothesItem).scene) scene.value = (detail as ExtendedClothesItem).scene!
  else scene.value = null
  if ((detail as ExtendedClothesItem).origin_shop) origin_shop.value = (detail as ExtendedClothesItem).origin_shop
  else origin_shop.value = undefined
  setTimeout(() => {
    seedClothesCover(detail.clothes_img)
    seedDetailImages(resolveDetailImagePaths(detail as ExtendedClothesItem))
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
const origin_shop = ref<Shop | Partial<Shop> | undefined>(undefined)
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
async function ensureAtLeastOneWardrobe(uid: number) {
  const res = await getWardrobeList({
    user_id: uid,
    page: 1,
    pageSize: 99
  })
  const rows = res.rows ?? []
  if (rows.length === 0) {
    await insertWardrobe({ wardrobe_name: t('wardrobe.default_name') })
  }
}

async function loadWardrobeSelectOptions(uid: number): Promise<boolean> {
  await ensureAtLeastOneWardrobe(uid)
  const res = await getWardrobeList({
    user_id: uid,
    page: 1,
    pageSize: 99
  })
  const rows = [...(res.rows ?? [])].sort(
    (a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0)
  )
  wardrobeListCached.value = rows
  wardrobeSelectOptions.value = rows
    .filter((w) => w.wardrobe_id != null)
    .map((w) => ({
      value: Number(w.wardrobe_id),
      label: w.wardrobe_name?.trim() || `衣柜 #${w.wardrobe_id}`
    }))
  return wardrobeSelectOptions.value.length > 0
}

/** 无 item 时用列表第一项；有 item 时校验 wardrobe_id 是否在列表内 */
function mergeItemWithDefaultWardrobe(
  item: ExtendedClothesItem | null
): ExtendedClothesItem | null {
  const opts = wardrobeSelectOptions.value
  if (!opts.length) return item
  const firstOpt = opts[0]
  const firstId = Number(firstOpt.value)
  const firstRow = wardrobeListCached.value.find(
    (w) => Number(w.wardrobe_id) === firstId
  )

  if (!item) {
    return {
      wardrobe_id: firstId,
      wardrobe_name: firstRow?.wardrobe_name ?? String(firstOpt.label),
      wardrobe: firstRow
    }
  }

  const wid =
    item.wardrobe_id != null ? Number(item.wardrobe_id) : Number.NaN
  const valid =
    Number.isFinite(wid) &&
    opts.some((o) => Number(o.value) === wid)

  if (valid) return item

  return {
    ...item,
    wardrobe_id: firstId,
    wardrobe_name: firstRow?.wardrobe_name ?? String(firstOpt.label),
    wardrobe: firstRow ?? item.wardrobe
  }
}

function onWardrobeSelectChanged(select: optionsInterface) {
  form.value.wardrobe_id = Number(select.value)
  const id = form.value.wardrobe_id
  const row = wardrobeListCached.value.find((w) => Number(w.wardrobe_id) === id)
  wardrobeName.value = row?.wardrobe_name?.trim() ?? select.label
  wardrobe.value = row ?? null
  void loadMemoryTags(id, readItemMemoryTags(row))
}

function openWardrobeSelectPicker(e: MouseEvent) {
  wardrobeSelectRef.value?.showPicker(e)
}

function splitCommaField(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean)
  }
  return []
}

function applyExtractFields(item: ExtendedClothesItem) {
  if (item.wardrobe_id != null) form.value.wardrobe_id = item.wardrobe_id
  if (item.wardrobe_name || item.wardrobe) {
    wardrobeName.value = item.wardrobe_name || item.wardrobe?.wardrobe_name || wardrobeName.value
    wardrobe.value = item.wardrobe || wardrobe.value
  }
  if (item.clothes_note != null) form.value.clothes_note = item.clothes_note
  if (item.note != null) form.value.note = item.note
  if (item.price != null) form.value.price = item.price
  if (item.original_price != null) form.value.original_price = item.original_price
  if (item.offer_price != null) form.value.offer_price = item.offer_price
  if (item.size != null) form.value.size = item.size
  if (item.wardrobe_status != null) form.value.wardrobe_status = item.wardrobe_status
  if (item.num != null && Number.isFinite(Number(item.num))) form.value.num = Number(item.num)
  if (item.currency_type != null) form.value.currency_type = item.currency_type
  if (item.json_data != null) form.value.json_data = item.json_data
  if (item.is_favorite != null) form.value.is_favorite = item.is_favorite
  if (item.add_time != null) form.value.add_time = item.add_time
  if (item.origin != null) form.value.origin = item.origin

  if (item.color != null) {
    form.value.color = splitCommaField(item.color)
  }
  if (item.color_text != null) setColorText(item.color_text)
  if (item.tags != null) form.value.tags = splitCommaField(item.tags)
  if (item.season != null) form.value.season = splitCommaField(item.season)
  if (item.clothes_part != null) {
    form.value.clothes_part = splitCommaField(item.clothes_part).map((part) => ({
      value: part,
      label: part,
    }))
  }

  if (item.library != null) {
    library.value = item.library
  } else if (item.library_id != null) {
    library.value = {
      library_id: item.library_id,
      name: item.clothes_note || '',
      cover: typeof item.clothes_img === 'string' ? item.clothes_img : '',
    }
  }

  if (item.origin_shop) {
    origin_shop.value = item.origin_shop
  } else if (item.origin != null) {
    if (typeof item.origin === 'number' || /^\d+$/.test(String(item.origin))) {
      origin_shop.value = {
        shop_id: Number(item.origin),
        shop_name: `店铺 #${item.origin}`,
      }
    } else {
      origin_shop.value = { shop_name: String(item.origin) }
    }
  }
}

async function applyShowModelPayload(
  item: ExtendedClothesItem | null,
  isCopy: boolean
) {
  // 初始化配置选项
  if (!wardrobeStore.config) {
    await wardrobeStore.getWardrobeConfig()
  }
  const config = configStore.config
  if (wardrobeStore.config) {
    syncConfigOptions()
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

  if (item?.extractFill) {
    if (!show.value) {
      initData()
      type.value = 0
    }
    applyExtractFields(item)
    void loadMemoryTags(form.value.wardrobe_id, [
      ...form.value.tags,
      ...readItemMemoryTags(item)
    ])
    show.value = true
    nextTick(() => {
      if (item.clothes_img) seedClothesCover(item.clothes_img)
    })
    return
  }

  // 初始化表单数据
  console.log(item, '编辑服饰', item?.clothes_img, wardrobeCoverRef.value)
  if (item) {
    // 基本字段
    form.value.wardrobe_id = item.wardrobe_id || null
    form.value.clothes_id = isCopy ? null : (item.clothes_id || null)
    form.value.clothes_note = item.clothes_note || ''
    form.value.note = item.note || ''
    form.value.price = item.price || 0
    form.value.original_price = item.original_price ?? null
    form.value.offer_price = item.offer_price ?? null
    form.value.size = item.size || ''
    form.value.position = item.position || ''
    form.value.times = item.times || 0
    form.value.sum_price = item.sum_price !== undefined ? item.sum_price : 1
    form.value.is_have = item.is_have !== undefined ? item.is_have : true
    form.value.wardrobe_status = item.wardrobe_status || null
    form.value.plan_id = item.plan_id || null
    form.value.is_shared = item.is_shared !== undefined ? item.is_shared : 0
    form.value.num = item.num != null && Number.isFinite(Number(item.num)) ? Number(item.num) : 1
    form.value.currency_type = item.currency_type ?? null
    form.value.json_data = item.json_data ?? null
    form.value.is_favorite = item.is_favorite ?? null
    // 修改时代入 plan：优先按 plan.list_id / plan_id 拉取最新，并去重子阶段
    const planSeq = ++planLoadSeq
    if (isCopy) {
      form.value.plan_id = null
      plan.value = null
    } else {
      await resolveClothesPlan(item, planSeq)
      if (plan.value?.list_id != null) {
        form.value.plan_id = plan.value.list_id
      }
    }
    form.value.add_time = item.add_time || null
    console.log(item.origin, '来源字段')
    form.value.origin = item.origin || null
    // 处理颜色数组
    if (item.color) {
      if (typeof item.color === 'string') {
        form.value.color = item.color.split(/[,，]/).filter((c: string) => c.trim() !== '')
      } else if (Array.isArray(item.color)) {
        form.value.color = [...item.color]
      } else {
        form.value.color = []
      }
    } else {
      form.value.color = []
    }
    setColorText(item.color_text)

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
    } else if (item.library_id != null) {
      library.value = {
        library_id: item.library_id,
        name: item.clothes_note || '',
        cover: typeof item.clothes_img === 'string' ? item.clothes_img : '',
      }
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
      if (item.origin) {
        origin_shop.value = {
          // shop_id: 0,
          shop_name: item.origin.toString()
        }
      } else {
        origin_shop.value = undefined
      }
    }

    // 处理衣柜名称
    wardrobeName.value = item.wardrobe_name || item.wardrobe?.wardrobe_name || ''
    wardrobe.value = item.wardrobe || null
  } else {
    // 如果没有传入 item，重置表单
    initData()
    plan.value = null
  }

  void loadMemoryTags(form.value.wardrobe_id, [
    ...form.value.tags,
    ...readItemMemoryTags(item)
  ])
  show.value = true
  // Modal 用 v-if，需挂载后再回填；同时兼容 detail_image 字符串与 detail_image_list
  nextTick(() => {
    setTimeout(() => {
      if (!item) return
      seedClothesCover(item.clothes_img)
      seedDetailImages(resolveDetailImagePaths(item))
    })
  })
}

/** 列表行可能缺 plan_id / plan / include 等，编辑或复制前拉完整详情 */
async function hydrateClothesForEdit(
  item: ExtendedClothesItem
): Promise<ExtendedClothesItem> {
  const clothesId = item.clothes_id
  if (clothesId == null || item.extractFill || item.detailReady) return item
  try {
    const detail = await getClothesDetail({ clothes_id: clothesId })
    const merged: ExtendedClothesItem = {
      ...detail,
      wardrobe_name:
        item.wardrobe_name
        ?? detail.wardrobe?.wardrobe_name
        ?? item.wardrobe?.wardrobe_name,
      wardrobe: item.wardrobe ?? detail.wardrobe ?? null,
    }
    // /clothes/id 只返回 detail_image 字符串，补齐 list 供回填使用
    if (!merged.detail_image_list?.length) {
      const paths = resolveDetailImagePaths(merged)
      if (paths.length > 0) {
        merged.detail_image_list = paths
      } else if (item.detail_image_list?.length) {
        merged.detail_image_list = [...item.detail_image_list]
        if (!merged.detail_image) {
          merged.detail_image = item.detail_image_list.join(',')
        }
      }
    }
    return merged
  } catch {
    return item
  }
}

const showModel = async (
  item: ExtendedClothesItem | null,
  isCopy = false,
  event?: MouseEvent
) => {
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }

  const resolvedItem =
    item?.clothes_id && !item.extractFill
      ? await hydrateClothesForEdit(item)
      : item

  const needsWardrobePick =
    props.enableWardrobePicker && (isCopy || !resolvedItem?.clothes_id)

  if (needsWardrobePick) {
    const uid = userStore.user?.user_id
    if (uid == null || !Number.isFinite(Number(uid))) {
      toast.add({
        title: t('common.please_login'),
        color: 'amber',
        icon: 'i-heroicons-information-circle'
      })
      return
    }
    if (!wardrobeStore.config) {
      await wardrobeStore.getWardrobeConfig()
    }
    try {
      const ok = await loadWardrobeSelectOptions(Number(uid))
      if (!ok) {
        toast.add({
          title: t('wardrobe.toast.no_clothes'),
          description: t('common.retry'),
          color: 'amber',
          icon: 'i-heroicons-information-circle'
        })
        return
      }
      const merged = mergeItemWithDefaultWardrobe(resolvedItem)
      await applyShowModelPayload(merged, isCopy)
    } catch {
      toast.add({
        title: t('wardrobe.toast.load_wardrobe_failed'),
        description: t('common.retry'),
        color: 'red',
        icon: 'i-heroicons-exclamation-circle'
      })
    }
    return
  }

  await applyShowModelPayload(resolvedItem, isCopy)
}

const handleColorListClose = () => {
  showColorListModal.value = false
}

const openCustomColorPicker = (event?: MouseEvent) => {
  showColorListModal.value = false
  nextTick(() => {
    if (!ColorPickerRef.value) return
    const e =
      event ??
      ({
        clientX: colorListClickPosition.value.x,
        clientY: colorListClickPosition.value.y
      } as MouseEvent)
    ColorPickerRef.value.showModel(e)
  })
}

const pickWardrobeColor = (hex: string) => {
  chooseColor(hex)
  showColorListModal.value = false
}

const showColorPicker = async (event?: MouseEvent) => {
  if (event) {
    colorListClickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else if (typeof window !== 'undefined') {
    colorListClickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }

  if (!wardrobeStore.config) {
    await wardrobeStore.getWardrobeConfig()
  }

  if (wardrobeColors.value.length > 0) {
    showColorListModal.value = true
    return
  }

  openCustomColorPicker(event)
}

const openCoverImageColorPicker = (e?: MouseEvent) => {
  if (!coverPreviewUrl.value) return
  if (e) {
    imageColorPickerClickPosition.value = { x: e.clientX, y: e.clientY }
  } else if (typeof window !== 'undefined') {
    imageColorPickerClickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  showCoverImageColorPicker.value = true
}
const wardrobeName = ref('')
const library = ref<Library | null>(null)
const scene = ref<Scene | null>(null)

/** 与 form.wardrobe_id 对齐，供 QhxSelect default-value */
const wardrobeSelectDefault = computed(() => {
  const opts = wardrobeSelectOptions.value
  if (!opts.length) return null
  const wid = form.value.wardrobe_id
  if (wid != null && Number.isFinite(Number(wid))) {
    const hit = opts.find((o) => Number(o.value) === Number(wid))
    if (hit) return hit
  }
  return opts[0]
})

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
      seedClothesCover(selectedLibrary.cover)
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

    // 图鉴 color 是文本色名，写入 color_text（勿写入 hex 的 color）
    if (
      selectedLibrary.color &&
      form.value.color_text.length === 0
    ) {
      setColorText(selectedLibrary.color)
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
    plan.value = normalizeClothesPlan(data)
  }
}

// 计划编辑成功：更新本地 plan
const onPlanUpdated = (data: PlanList) => {
  if (data) plan.value = normalizeClothesPlan(data)
}

const clearPlan = () => {
  planLoadSeq += 1
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
				color_text: [],
				price: 0,
				original_price: null,
				offer_price: null,
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
        is_shared: 0,
        num: 1,
        currency_type: null,
        json_data: null,
        is_favorite: null
			}
			planLoadSeq += 1
			library.value = null
			scene.value = null
			wardrobe.value = null
			wardrobeName.value = ''
			wardrobeSelectOptions.value = []
			wardrobeListCached.value = []
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
function currentCoverPath() {
  const url = wardrobeCoverRef.value?.previewImages?.[0]?.url
  return normalizeClothesImgPath(url) ?? null
}

function openLibraryCoverPicker(event?: MouseEvent) {
  if (!library.value) return
  libraryCoverPickerRef.value?.showModel(library.value, currentCoverPath(), event)
}

function appendDetailImages(paths: string[]) {
  const picker = detailImageRef.value
  const next = paths.map((path) => path.trim()).filter(Boolean)
  if (!picker || !next.length) return
  const existing = picker.previewImages
    .map((img) => normalizeClothesImgPath(img.url))
    .filter((path): path is string => Boolean(path))
  const merged = [...existing]
  for (const path of next) {
    if (!merged.includes(path)) merged.push(path)
  }
  picker.seedFromPaths(merged)
}

function onLibraryCoverChoose(payload: { clothesImg: string | null; typeLabels: string[]; typeCovers: string[] }) {
  const cover = payload.clothesImg || payload.typeCovers[0]
  if (cover) seedClothesCover(cover)
  for (const label of payload.typeLabels) {
    if (!label) continue
    if (form.value.clothes_part.findIndex((part) => part.label === label) === -1) {
      form.value.clothes_part.push({ value: label, label })
    }
  }
  appendDetailImages(payload.typeCovers)
}

function seedClothesCover(path?: string | null) {
  if (!wardrobeCoverRef.value) return
  const t = path?.trim()
  if (t) {
    wardrobeCoverRef.value.seedFromPaths([t])
  } else {
    wardrobeCoverRef.value.clear()
  }
}

/** 从 list 或逗号串解析详情图路径（hydrate 后通常只有 detail_image 字符串） */
function resolveDetailImagePaths(item: ExtendedClothesItem | null | undefined): string[] {
  if (!item) return []
  if (Array.isArray(item.detail_image_list) && item.detail_image_list.length > 0) {
    return item.detail_image_list.map((img) => String(img).trim()).filter(Boolean)
  }
  if (typeof item.detail_image === 'string' && item.detail_image.trim()) {
    return item.detail_image.split(',').map((img) => img.trim()).filter(Boolean)
  }
  return []
}

function seedDetailImages(paths?: string[] | null) {
  if (!detailImageRef.value) return
  const next = (paths || []).map((p) => String(p).trim()).filter(Boolean)
  if (next.length > 0) {
    detailImageRef.value.seedFromPaths(next)
  } else {
    detailImageRef.value.clear()
  }
}

type ClothesPickerUploadItem = {
  file?: File
  url?: string
  videoFile?: File
  videoUrl?: string
  kind?: 'image' | 'live'
}

const fetchUpload = async (item: ClothesPickerUploadItem) => {
  if (item.kind === 'live' && item.videoFile && item.file) {
    return uploadPairedLiveToOSS(item.videoFile, item.file)
  }
  if (item.kind === 'live' && item.videoUrl && !item.videoFile) {
    return normalizeRawImgPath(item.videoUrl)
  }
  if (item.file) {
    const res = await uploadImage(item.file)
    return res.file_url
  }
  if (item.url) {
    return item.url.replace(BASE_IMG, '')
  }
  throw new Error('无效图片')
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
	let { color, season, price, original_price, offer_price, times, tags, main_style, plan_id } = form.value
  const params: any = {
    wardrobe_id,
    wardrobe_status,
    sum_price,
    is_shared: form.value.is_shared ?? 0
  }
  const num = Number(form.value.num)
  if (Number.isFinite(num) && num > 0) {
    params.num = num
  }
  if (form.value.currency_type != null && form.value.currency_type !== '') {
    params.currency_type = form.value.currency_type
  }
  if (form.value.is_favorite != null) {
    params.is_favorite = form.value.is_favorite
  }
  if (form.value.json_data) {
    params.json_data = form.value.json_data
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
  console.log(origin_shop.value, '来源字段')
  if (origin_shop.value) {
    if (origin_shop.value.shop_id) {
      params.origin = origin_shop.value.shop_id
    } else if (origin_shop.value.shop_name) {
      params.origin = origin_shop.value.shop_name
    } else {
      params.origin = origin_shop.value
    }
  } else {
    params.origin = null
  }
  if (clothes_part && Array.isArray(clothes_part) && clothes_part.length > 0) {
    params.clothes_part = clothes_part.map((p: optionsInterface) => String(p.value || p.label)).join(',')
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
    // params.include_clothes = null
  }

  if (color && color.length > 0) {
    params.color = color.join()
  } else {
    params.color = null
  }
  const colorText = form.value.color_text.map((item) => item.trim()).filter(Boolean)
  params.color_text = colorText.length ? colorText.join(',') : null

  if (price && price !== 0) {
    params.price = price
  } else {
    params.price = null
  }

  const toOptionalPrice = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  params.original_price = toOptionalPrice(original_price as number | string | null | undefined)
  params.offer_price = toOptionalPrice(offer_price as number | string | null | undefined)

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
    const detail_image: string[] = []
    for (let index = 0; index < detailImageRef.value.previewImages.length; index++) {
      const element = detailImageRef.value.previewImages[index];
      try {
        const url = await fetchUpload(element)
        detail_image.push(url)
      } catch (error) {
        
      }
    }
    if (detail_image.length > 0) {
      params.detail_image = detail_image.join()
    } else if (type.value === 1) {
      // 编辑时上传全失败：不传该字段，避免误清空
    } else {
      params.detail_image = null
    }
  } else if (type.value === 1) {
    // 编辑且预览为空：显式清空（后端会忽略 null，空串才清）
    params.detail_image = ''
  } else {
    params.detail_image = null
  }
  // 点选的关联服饰，通过 include_clothes 传参（逗号分隔 clothes_id）
  if (selectedIncludeIds.value.size > 0) {
    params.include_clothes = Array.from(selectedIncludeIds.value).join(',')
  } else {
    // params.include_clothes = null
  }
  if (type.value === 0) {
      insertClothes(params)
        .then((res) => {
          emit('success', res)
          closeModel()
        })
        .finally(() => {
          loading.value = false
        })
    } else {
      params.clothes_id = clothes_id
      updateClothes(params)
        .then((res) => {
          emit('success', res)
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
  <QhxModal
    v-model="show"
    :trigger-position="clickPosition"
    :close-on-backdrop="false"
    :bottom-inset="tabBarInsetPx"
    @close="handleClose"
  >
    <div
      class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50"
      :style="modalPanelStyle"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold ">
          {{ type === 0 ? t('clothes.add.create') : t('clothes.add.edit') }}
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

        <!-- 衣柜：表单内选择（enableWardrobePicker + 新增）或只读名称 -->
        <div class="grid grid-cols-12 gap-4 items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl border border-blue-100 dark:border-gray-600">
          <div class="col-span-3 font-semibold text-gray-700 dark:text-gray-300">
            {{ enableWardrobePicker && type === 0 ? t('clothes.add.wardrobe') : t('clothes.add.wardrobe_name') }}
          </div>
          <div class="col-span-9 space-y-2">
            <template v-if="enableWardrobePicker && type === 0 && wardrobeSelectOptions.length">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ wardrobeName || t('clothes.add.please_select_wardrobe') }}</span>
                <UButton
                  type="button"
                  size="xs"
                  :ui="capsuleBtnUi"
                  class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                  @click="openWardrobeSelectPicker($event)"
                >
                  {{ t('clothes.add.select_wardrobe') }}
                </UButton>
              </div>
              <QhxSelect
                ref="wardrobeSelectRef"
                :options="wardrobeSelectOptions"
                :default-value="wardrobeSelectDefault ?? undefined"
                :can-customize="false"
                @select="onWardrobeSelectChanged"
              />
            </template>
            <div
              v-else
              class="font-medium text-gray-900 dark:text-gray-100"
            >
              {{ wardrobeName }}
            </div>
          </div>
        </div>

        <!-- 主要信息板块 -->
        <div class="space-y-6">
          <!-- 关联图鉴 -->
          <UFormGroup :label="t('clothes.add.link_library')" class="space-y-3">
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
                :ui="capsuleBtnUi"
                class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md shadow-pink-500/30 transition-all duration-200"
                :loading="loading"
                @click="showChooseLibrary()"
              >
                <UIcon name="material-symbols:book-rounded" class="mr-1" />
                {{ t('clothes.add.select_library') }}
              </UButton>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ t('clothes.add.library_hint') }}
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
                :ui="capsuleBtnUi"
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
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('clothes.add.cover') }}</span>
              <UButton
                v-if="library"
                type="button"
                size="xs"
                :ui="capsuleBtnUi"
                class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md shadow-pink-500/30"
                @click="openLibraryCoverPicker"
              >
                <UIcon name="i-heroicons-photo" class="mr-1" />
                {{ t('clothes.add.change_cover_from_library') }}
              </UButton>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <QhxImagePicker allow-live :multiple="false" @update:files="onUpdateFiles" ref="wardrobeCoverRef" />
            </div>
          </div>

          <!-- 名称 -->
          <div ref="clothesNoteFormRef">
          <UFormGroup :label="t('clothes.add.name')" class="relative">
            <UInput
                v-model="form.clothes_note"
                :placeholder="t('clothes.add.name_placeholder')"
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
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('clothes.add.shared_hint') }}</span>
              </div>
              <div class="flex-1 overflow-y-auto p-2 min-h-0">
                <div v-if="sharedClothesLoading" class="flex justify-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin text-xl text-qhx-primary" />
                </div>
                <div v-else-if="sharedClothesList.length === 0" class="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {{ t('clothes.add.shared_empty') }}
                </div>
                <div
                  v-else
                  v-for="item in sharedClothesList"
                  :key="item.clothes_id"
                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                  :class="selectedSharedClothes?.clothes_id === item.clothes_id
                    ? 'bg-qhx-primary/25 dark:bg-qhx-primary/35 ring-2 ring-qhx-primary ring-inset'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'"
                  @click="onSelectSharedClothes(item)"
                >
                  <img
                    v-if="item.clothes_img"
                    :src="BASE_IMG + item.clothes_img"
                    class="w-9 h-9 rounded object-cover flex-shrink-0"
                    alt=""
                  />
                  <div v-else class="w-9 h-9 rounded bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                    <UIcon name="i-heroicons-photo" class="text-gray-400 text-sm" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="truncate text-sm leading-snug">{{ item.clothes_note || t('clothes.add.unnamed') }}</div>
                    <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                      <span class="inline-flex items-center gap-0.5 shrink-0 text-qhx-primary/80 dark:text-qhx-primary/90">
                        <UIcon name="i-heroicons-hand-thumb-up" class="w-3 h-3 flex-shrink-0" />
                        {{ item.good_count ?? 0 }}
                      </span>
                      <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                      <span class="inline-flex items-center gap-0.5 shrink-0" title="引用数">
                        <UIcon name="i-heroicons-link" class="w-3 h-3 flex-shrink-0 opacity-80" />
                        {{ item.citation_count ?? 0 }}
                      </span>
                      <template v-if="item.price != null">
                        <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                        <span class="truncate">¥{{ item.price }}</span>
                      </template>
                      <template v-if="item.origin">
                        <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                        <span class="truncate max-w-[4.5rem]" :title="item.origin">{{ item.origin }}</span>
                      </template>
                      <template v-if="item.color">
                        <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                        <span class="truncate max-w-[3rem]" :title="item.color">{{ item.color }}</span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-2 p-2 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
                <UButton size="xs" variant="ghost" :ui="capsuleBtnUi" @click="onCancelSharedClothes">{{ t('common.cancel') }}</UButton>
                <UButton size="xs" color="primary" :ui="capsuleBtnUi" :disabled="!selectedSharedClothes || confirmDetailLoading" :loading="confirmDetailLoading" @click="onRequestConfirmSharedClothes">
                  {{ t('clothes.add.confirm_select') }}
                </UButton>
              </div>
            </div>
          </UFormGroup>
          <!-- 已选择的共享服饰（完整主服饰回显 + 子服饰列表） -->
          <div
            v-if="type === 0 && confirmedSharedClothesList.length > 0"
            class="mt-3 space-y-3"
          >
            <div class="space-y-1">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('clothes.add.selected') }}</span>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('clothes.add.like_hint') }}</p>
            </div>
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
                    <div class="font-medium text-gray-900 dark:text-gray-100">{{ mainItem.clothes_note || t('clothes.add.unnamed') }}</div>
                    <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span v-if="mainItem.price">¥{{ mainItem.price }}</span>
                      <span v-if="mainItem.origin">{{ mainItem.origin }}</span>
                      <span v-if="mainItem.clothes_part">{{ mainItem.clothes_part }}</span>
                      <span v-if="mainItem.color">{{ mainItem.color }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1 flex-shrink-0 self-start">
                    <div
                      v-if="mainItem.clothes_id != null"
                      class="inline-block origin-top-right scale-[0.82] leading-none"
                      :title="t('clothes.add.like_source')"
                    >
                      <UserGoodBtn
                        :pk_id="mainItem.clothes_id"
                        :pk_type="PK_TYPE_SHARED_CLOTHES_GOOD"
                        :good_count="mainItem.good_count ?? 0"
                        :need_judge="true"
                      />
                    </div>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      :title="t('clothes.add.remove')"
                      @click="onRemoveConfirmedSharedClothes(mainItem)"
                    >
                      <UIcon name="i-heroicons-x-mark" class="text-base text-gray-500" />
                    </button>
                  </div>
                </div>
                <!-- 关联子服饰列表 -->
                <div
                  v-if="mainItem.include && mainItem.include.length > 0"
                  class="border-t border-gray-200 dark:border-gray-600 px-3 py-2 bg-white/50 dark:bg-gray-900/30"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('clothes.add.link_clothes') }}</span>
                    <span class="text-xs text-amber-600 dark:text-amber-400">{{ t('clothes.add.multi_select_hint') }}</span>
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
                      <span class="text-xs truncate max-w-[100px]">{{ child.clothes_note || t('clothes.add.unnamed') }}</span>
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
        <UFormGroup :label="t('clothes.field.origin')">
          <div class="flex items-center">
            <USelectMenu
              v-model="origin_shop"
              :loading="loading"
              :searchable="fetchShopOptiosns"
              :placeholder="t('wardrobe.search.shop_placeholder')"
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
        <!-- 价格 / 原价 / 出物价 同一行 -->
        <div class="grid grid-cols-3 gap-2">
          <UFormGroup :label="t('clothes.field.price')">
            <UInput
              v-model="form.price"
              type="number"
              :placeholder="t('clothes.field.price')"
              class="w-full focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-3 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>
          <UFormGroup :label="t('clothes.field.original_price')">
            <UInput
              v-model="form.original_price"
              type="number"
              :placeholder="t('clothes.add.optional')"
              class="w-full focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-3 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>
          <UFormGroup :label="t('clothes.field.offer_price')">
            <UInput
              v-model="form.offer_price"
              type="number"
              :placeholder="t('clothes.add.optional')"
              class="w-full focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-3 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>
        </div>
        <UFormGroup :label="t('clothes.add.balance_plan')" class="space-y-3">
          <div v-if="plan" class="space-y-2">
            <div
              class="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-r from-amber-50/80 to-orange-50/60 dark:from-gray-700/40 dark:to-gray-800/40 transition-all duration-200 hover:shadow-md hover:border-amber-300/60 dark:hover:border-amber-500/40"
            >
              <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg flex-shrink-0" />
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ plan.plan_name || t('clothes.add.balance_plan') }}</span>
                <span class="text-base font-bold text-amber-600 dark:text-amber-400">¥{{ plan.need_money ?? 0 }}</span>
              </div>
              <div class="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-100/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors"
                  :title="t('common.edit')"
                  @click.stop="showPlanAddEditForEdit($event)"
                >
                  <UIcon name="ant-design:edit-outlined" class="text-sm" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  :title="t('clothes.add.remove')"
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
                <span class="text-gray-600 dark:text-gray-400 truncate">{{ child.plan_note || t('clothes.add.stage', { n: idx + 1 }) }}</span>
                <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">¥{{ child.need_money ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div v-else class="space-y-2">
            <UButton
              type="button"
              size="sm"
              :ui="capsuleBtnUi"
              class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 transition-all duration-200"
              :loading="loading"
              @click="showPlanAddEdit($event)"
            >
              <UIcon name="material-symbols:savings-rounded" class="mr-1.5" />
              {{ t('clothes.add.create_balance_plan') }}
            </UButton>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('clothes.add.plan_hint') }}
            </p>
          </div>
        </UFormGroup>
        <div class="grid grid-cols-2 gap-2">
          <UFormGroup :label="t('clothes.field.size')">
            <UInput
              v-model="form.size"
              :placeholder="t('clothes.field.size')"
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
          <UFormGroup :label="t('clothes.field.quantity')">
            <QhxNumberStepper v-model="form.num" :min="1" />
          </UFormGroup>
        </div>
        <!-- 计入总价 -->
        <UFormGroup :label="t('clothes.add.count_in_total')">
          <UToggle
            :model-value="form.sum_price === 1"
            @update:model-value="form.sum_price = $event ? 1 : 0"
          />
        </UFormGroup>
        </div>

        <!-- 分类信息板块 -->
        <div class="space-y-4">
        <!-- 颜色选择 -->
        <UFormGroup :label="t('clothes.field.color')">
          <div class="gap-2">
            <ClientOnly>
              <QhxColorPicker @choose="chooseColor" ref="ColorPickerRef"></QhxColorPicker>
              <QhxImageCanvasColorPicker
                v-model="showCoverImageColorPicker"
                :image-src="coverPreviewUrl"
                :trigger-position="imageColorPickerClickPosition"
                :title="t('clothes.add.pick_from_cover_title')"
                @confirm="chooseColor"
              />
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
            <div class="flex flex-wrap gap-2 mt-2">
              <UButton
                size="xs"
                color="primary"
                :ui="capsuleBtnUi"
                class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                @click="(e: MouseEvent) => showColorPicker(e)"
              >
                {{ t('clothes.add.select_color') }}
              </UButton>
              <UButton
                v-if="coverPreviewUrl"
                size="xs"
                variant="outline"
                :ui="capsuleBtnUi"
                class="ring-1 ring-gray-200 dark:ring-gray-600 text-gray-800 dark:text-gray-200"
                @click="(e: MouseEvent) => openCoverImageColorPicker(e)"
              >
                <UIcon name="i-heroicons-swatch-20-solid" class="size-4 mr-0.5" />
                {{ t('clothes.add.pick_from_cover') }}
              </UButton>
            </div>
          </div>
        </UFormGroup>
        <UFormGroup :label="t('clothes.field.color_text')">
          <div v-if="form.color_text.length > 0">
            <QhxTag
              v-for="(tag, index) in form.color_text"
              :key="tag"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.color_text.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton
            type="button"
            size="xs"
            :ui="capsuleBtnUi"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            @click="(e: MouseEvent) => { openColorText(e) }"
          >
            {{ t('clothes.add.select_color_text') }}
          </UButton>
          <QhxOptionsChoose
            ref="colorTextChooseRef"
            :title="t('clothes.add.choose_color_text_title')"
            :options="color_text_options"
            :can-customize="true"
            :max-length="12"
            :undeletable-values="color_text_defaults.map((item) => item.value)"
            :empty-confirm-message="t('clothes.add.choose_color_text_empty')"
            :customize-placeholder="t('clothes.add.custom_color')"
            @select="onColorTextChoose"
            @delete="onDeleteColorText"
          />
        </UFormGroup>
        <UFormGroup :label="t('wardrobe.search.status')">
          <div v-if="form.wardrobe_status">
            <QhxTag>
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.wardrobe_status = null">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ wardrobeStatusLabel(t, form.wardrobe_status) }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            :ui="capsuleBtnUi"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openPicker(e) }"
          >
            {{ t('clothes.add.select_status') }}
          </UButton>
          <QhxOptionsChoose
            ref="statusChooseRef"
            :title="t('clothes.add.choose_status_title')"
            :options="wardrobe_status_options"
            :multiple="false"
            :can-customize="true"
            :undeletable-values="wardrobe_status_defaults.map((item) => item.value)"
            :empty-confirm-message="t('clothes.add.choose_status_empty')"
            @select="onStatusChoose"
            @delete="(item) => onDeleteConfigOption('wardrobe_status', item)"
          />
        </UFormGroup>
        <UFormGroup :label="t('clothes.field.style')">
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
            :ui="capsuleBtnUi"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            @click="(e: MouseEvent) => { showChooseMainStyle(e) }"
          >
            {{ t('clothes.add.select_style') }}
          </UButton>
          <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="chooseMainStyleWiki" />
        </UFormGroup>
        <UFormGroup :label="t('wardrobe.search.part')">
          <div v-if="form.clothes_part.length > 0">
            <QhxTag
              v-for="(tag, index) in form.clothes_part"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.clothes_part.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ wardrobePartLabel(t, String(tag.value || tag.label)) }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            :ui="capsuleBtnUi"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openClothesPart(e) }"
          >
            {{ t('clothes.add.select_part') }}
          </UButton>
          <QhxOptionsChoose
            ref="clothesPartChooseRef"
            :title="t('clothes.add.choose_part_title')"
            :options="clothes_part_options"
            :can-customize="true"
            :empty-confirm-message="t('clothes.add.choose_part_empty')"
            @select="onClothesPartChoose"
            @delete="(item) => onDeleteConfigOption('clothes_part', item)"
          />
        </UFormGroup>
        <UFormGroup :label="t('clothes.add.custom_tags')">
          <div v-if="form.tags.length > 0">
            <QhxTag
              v-for="(tag, index) in form.tags"
              :key="tag"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.tags.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            :ui="capsuleBtnUi"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openTag(e) }"
          >
            {{ t('clothes.add.select_tags') }}
          </UButton>
          <QhxOptionsChoose
            ref="tagChooseRef"
            :title="t('clothes.add.choose_tags_title')"
            :options="tags_options"
            :can-customize="true"
            :empty-confirm-message="t('clothes.add.choose_tags_empty')"
            @select="onTagsChoose"
            @delete="(item) => onDeleteConfigOption('tags', item)"
          />
        </UFormGroup>
        <UFormGroup :label="t('clothes.add.season')">
          <div v-if="form.season.length > 0" class="flex flex-wrap gap-2 mb-2">
            <QhxTag
              v-for="(season, index) in form.season"
              :key="index"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.season.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ wardrobeSeasonLabel(t, season) }}</div>
              </div>
            </QhxTag>
          </div>
          <USelectMenu 
            v-model="form.season" 
            :options="season_options" 
            :placeholder="t('clothes.add.select_season')" 
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
            <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">{{ t('clothes.add.other') }}</h3>
          </div>

        <!-- 笔记 -->
        <UFormGroup :label="t('clothes.field.note')">
          <UTextarea 
            v-model="form.note" :placeholder="t('clothes.field.note')" :rows="3" 
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
        <UFormGroup :label="t('clothes.field.wear_times')">
          <UInput
            v-model="form.times"
            type="number"
            :placeholder="t('clothes.field.wear_times')"
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
        <UFormGroup :label="t('clothes.add.storage')">
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
           :placeholder="t('clothes.add.storage')" />
        </UFormGroup>
        <UFormGroup :label="t('clothes.field.buy_time')">
          <QhxDateTimePicker
            v-model="addTimeInput"
            mode="date"
            :enable-time-picker="false"
            format="YYYY-MM-DD"
            :placeholder="t('clothes.add.select_buy_time')"
          />
        </UFormGroup>
        <UFormGroup :label="t('clothes.add.detail_images')" class="space-y-2">
          <div class=" bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" ref="detailImageRef" />
          </div>
        </UFormGroup>
        <!-- 是否分享（表单底部） -->
        <UFormGroup :label="t('clothes.add.is_shared')" class="space-y-2">
          <UToggle
            :model-value="form.is_shared === 1"
            @update:model-value="form.is_shared = $event ? 1 : 0"
          />
          <p v-if="form.is_shared === 1" class="text-xs text-amber-600 dark:text-amber-400">
            {{ t('clothes.add.shared_warning') }}
          </p>
          <p v-else class="text-xs text-amber-600 dark:text-amber-400">
            {{ t('clothes.add.private_hint') }}
          </p>
        </UFormGroup>
        </div>
      </div>

      <!-- 底部操作栏：无 tabbar 时仍保留安全区，避免 Home 条遮挡 -->
      <div
        class="flex justify-end gap-3 px-6 pt-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0"
        :style="{
          paddingBottom:
            tabBarInsetPx > 0
              ? '1rem'
              : 'max(1rem, env(safe-area-inset-bottom, 0px))',
        }"
      >
        <UButton 
          color="gray" 
          variant="ghost"
          :ui="capsuleBtnUi"
          @click="closeModel"
          class="px-6"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          :loading="loading"
          :ui="capsuleBtnUi"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="insert"
        >
          {{ type === 1 ? t('clothes.add.confirm_update') : t('clothes.add.confirm_add') }}
        </UButton>
      </div>
    </div>
    <LibraryChoose ref="LibraryChooseRef" :keywordMode="true" @choose="chooseLibrary"></LibraryChoose>
    <ClothesLibraryCoverPicker ref="libraryCoverPickerRef" @choose="onLibraryCoverChoose" />
    <SceneChoose ref="SceneChooseRef" @choose="chooseScene"></SceneChoose>
    <PlanAddEdit
      ref="PlanAddEditRef"
      :plan-list="plan"
      :initial-need-money="form.price || 0"
      :enable-link-clothes="type === 1 ? true : false"
      :linked-clothes="planLinkedClothesPreset"
      @insert="onPlanInsert"
      @updated="onPlanUpdated"
    />
    
    <!-- 衣柜预设颜色选择 -->
    <QhxModal
      v-model="showColorListModal"
      :trigger-position="colorListClickPosition"
      :close-on-backdrop="false"
      :bottom-inset="tabBarInsetPx"
      @close="handleColorListClose"
    >
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('clothes.add.select_color') }}</h3>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleColorListClose"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div class="p-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('clothes.add.color_hint') }}</p>
          <div class="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              class="w-[35px] h-[35px] rounded-lg shrink-0 flex flex-col items-center justify-center gap-0 cursor-pointer transition-all hover:opacity-80 bg-gray-50 dark:bg-gray-700/80 ring-1 ring-gray-200/80 dark:ring-gray-600 hover:ring-qhx-primary/50 dark:hover:ring-qhx-primary/50"
              @click="openCustomColorPicker()"
            >
              <span class="text-[10px] leading-[12px] font-medium text-gray-700 dark:text-gray-200">{{ t('clothes.add.custom_color_btn') }}</span>
              <span class="text-[10px] leading-[12px] font-medium text-gray-700 dark:text-gray-200">{{ t('clothes.add.color_btn') }}</span>
            </button>
            <div
              v-for="(color, index) in wardrobeColors"
              :key="index"
              :style="{ background: color, width: '35px', height: '35px', borderRadius: '8px' }"
              class="cursor-pointer hover:opacity-80 transition-opacity ring-1 ring-gray-200/80 dark:ring-gray-600"
              role="button"
              tabindex="0"
              @click="pickWardrobeColor(color)"
              @keydown.enter="pickWardrobeColor(color)"
            />
          </div>
        </div>
      </div>
    </QhxModal>

    <!-- 场景选择对话框 -->
    <QhxModal
      v-model="showSceneChooseModal"
      :trigger-position="sceneChooseClickPosition"
      :close-on-backdrop="false"
      :bottom-inset="tabBarInsetPx"
      @close="handleSceneChooseClose"
    >
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('clothes.add.choose_scene_way') }}</h3>
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
                {{ t('clothes.add.use_template') }}
              </h4>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('clothes.add.use_template_desc') }}
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
                {{ t('clothes.add.existing_scene') }}
              </h4>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('clothes.add.existing_scene_desc') }}
              </p>
            </div>
            <UIcon name="i-heroicons-chevron-right" class="text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </div>
      </div>
    </QhxModal>
    <!-- 二级确认：代入会覆盖信息 -->
    <QhxModal
      v-model="showConfirmOverwriteModal"
      :trigger-position="clickPosition"
      :close-on-backdrop="false"
      :bottom-inset="tabBarInsetPx"
      @close="showConfirmOverwriteModal = false"
    >
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('clothes.add.confirm_title') }}</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-gray-600 dark:text-gray-400">{{ t('clothes.add.overwrite_confirm') }}</p>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <UButton color="gray" variant="outline" :ui="capsuleBtnUi" @click="showConfirmOverwriteModal = false">{{ t('common.cancel') }}</UButton>
          <UButton color="primary" :ui="capsuleBtnUi" :loading="confirmDetailLoading" @click="onConfirmOverwrite">{{ t('common.confirm') }}</UButton>
        </div>
      </div>
    </QhxModal>
  </QhxModal>
</template>
