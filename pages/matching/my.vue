<script setup lang="ts">
/**
 * 我的搭配：布局/样式对齐衣柜详情（左侧列表 + 右侧内容 + 自定义主题）
 * 左侧首项「列表」= 全部清单；其后为搭配夹（pk_type=3，可排序）
 */
import { defineAsyncComponent, nextTick, onMounted } from 'vue'
import {
  getMatchingListList,
  getMatchingDetail,
  deleteMatchingList,
  type MatchingListItem,
} from '@/api/matching_list'
import {
  getCompMy,
  getCompDetailList,
  insertComp,
  updateComp,
  deleteComp,
  sortComp,
  insertCompDetailArray,
  deleteCompDetailArray,
  cleanInvalidCompDetail,
  sortCompDetail,
  COMP_PK_TYPE_MATCHING_FOLDER,
  type CompDetailRow,
} from '@/api/compilations'
import { getWardrobeList } from '@/api/wardrobe'
import type { Compilations, Wardrobe, WardrobeClothes } from '@/types/api'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import type MatchingChoose from '@/components/matching/MatchingChoose.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import { openMatchingDetailTab } from '@/composables/useLibraryDetailNavigation'
import { navigateBackInShell } from '@/utils/nativeShell'
import { useCommunityDetailTheme } from '@/composables/useCommunityDetailTheme'

/** 与 defineAsyncComponent 共用同一 import，便于 await 预加载后再打开 */
const loadMatchingAddEdit = () => import('@/components/matching/MatchingAddEdit.vue')
const loadMatchingChoose = () => import('@/components/matching/MatchingChoose.vue')
const MatchingAddEditAsync = defineAsyncComponent(loadMatchingAddEdit)
const MatchingChooseAsync = defineAsyncComponent(loadMatchingChoose)

/** 挂载异步子组件并等到 ref 可用，避免首点只加载、第二次才弹出 */
async function waitForMountedRef<T>(options: {
  mounted: Ref<boolean>
  getRef: () => T | null | undefined
  preload: () => Promise<unknown>
  timeoutMs?: number
}): Promise<T> {
  const { mounted, getRef, preload, timeoutMs = 15000 } = options
  if (!mounted.value) mounted.value = true
  await preload()
  await nextTick()
  const existing = getRef()
  if (existing) return existing
  const start = Date.now()
  while (!getRef()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('async component mount timeout')
    }
    await new Promise((r) => setTimeout(r, 16))
  }
  return getRef() as T
}

definePageMeta({
  name: 'matching-my',
  ssr: false,
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()
const router = useRouter()

/** 取用户衣柜主题（自定义背景/按钮色），与衣柜 detail 一致 */
const themeWardrobe = ref<Wardrobe | null>(null)
const {
  customStyle,
  customBtnStyle,
  hasCustomBtnBg,
  hasCustomBtnFont,
  pageBackgroundStyle,
  pageContentStyle,
} = useCommunityDetailTheme(themeWardrobe)

const tabBarInsetPx = computed(() => {
  const n = Number(configStore.tabBarHeight || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const pageStyle = computed(() => ({
  ...(pageContentStyle.value ?? {}),
  ...(tabBarInsetPx.value > 0
    ? { '--wardrobe-tabbar-inset': `${tabBarInsetPx.value}px` }
    : {}),
}))

const keyword = ref('')
const value = ref('')
/** 对齐衣柜网格：自管 list + flex-wrap，不用瀑布流 */
const list = ref<MatchingListItem[]>([])
const page = ref(1)
const total = ref(0)
const isLoading = ref(false)
const pageSize = 40
const scrollRootRef = ref<HTMLElement | null>(null)
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEdit> | null>(null)
const showBatchDeleteModal = ref(false)
const batchDeleting = ref(false)
/** 搭配夹删除时：是否同时删除搭配本体（默认否，只移出合集） */
const alsoDeleteMatching = ref(false)

/** 点击失效项 → 清理失效子项 */
const showCleanInvalidModal = ref(false)
const cleaningInvalid = ref(false)
const mountEditor = ref(false)
const mountMatchingChoose = ref(false)
const matchingChooseRef = ref<InstanceType<typeof MatchingChoose> | null>(null)
const addingToFolder = ref(false)

/** 列表多选 → 选择要加入的搭配夹 */
const showPickFolderModal = ref(false)
const pickingFolder = ref(false)

/** 对齐衣柜：编辑 / 多选 / 排序（互斥；排序仅搭配夹） */
const editMode = ref(false)
const selectMode = ref(false)
const sortMode = ref(false)
const isSorting = ref(false)
let oldSortSnapshot: Array<{ matching_id: number }> = []
const selectedMatchingIds = ref<Set<number>>(new Set())

/** null =「列表」全部清单；否则搭配夹 comp_id */
const selectedCompId = ref<number | null>(null)
const folderList = ref<Compilations[]>([])
const folderLoading = ref(false)
const isFolderSorting = ref(false)
const pageInitialized = ref(false)

const showFolderModal = ref(false)
const folderModalMode = ref<'create' | 'edit'>('create')
const folderFormName = ref('')
const folderFormSaving = ref(false)
const editingFolder = ref<Compilations | null>(null)
const showDeleteFolderModal = ref(false)
const deletingFolder = ref<Compilations | null>(null)

const SIDEBAR_COLLAPSED_KEY = 'matching-my-sidebar-collapsed'
function readSidebarCollapsedPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}
const sidebarCollapsed = ref(readSidebarCollapsedPref())
const sidebarTransitionEnabled = ref(false)

function persistSidebarCollapsed() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
watch(sidebarCollapsed, persistSidebarCollapsed)

useHead({
  title: '我的搭配',
  meta: [
    { name: 'keywords', content: 'Lo研社,搭配,Lolita搭配,我的搭配' },
    { name: 'description', content: '查看我的所有Lolita搭配' },
  ],
})

const filterList = computed(() => {
  const uid = userStore.user?.user_id
  if (!uid) return []
  return [{ field: 'user_id', op: 'eq', value: uid }]
})

const currentFolder = computed(() =>
  selectedCompId.value == null
    ? null
    : folderList.value.find((f) => f.comp_id === selectedCompId.value) ?? null,
)
const contentTitle = computed(() => {
  if (currentFolder.value?.comp_name?.trim()) return currentFolder.value.comp_name.trim()
  return '列表'
})

function goBack() {
  if (navigateBackInShell()) return
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  void navigateTo('/matching')
}

const handleSearch = () => {
  keyword.value = value.value.trim()
  exitSortMode()
  void reloadList()
}

async function loadThemeFromWardrobe() {
  const uid = userStore.user?.user_id
  if (!uid) {
    themeWardrobe.value = null
    return
  }
  try {
    const res = await getWardrobeList({
      user_id: uid,
      page: 1,
      pageSize: 1,
    })
    themeWardrobe.value = res.rows?.[0] ?? null
  } catch {
    themeWardrobe.value = null
  }
}

async function loadFolderList() {
  if (!userStore.user?.user_id) {
    folderList.value = []
    return
  }
  folderLoading.value = true
  try {
    folderList.value = await getCompMy()
    if (
      selectedCompId.value != null &&
      !folderList.value.some((f) => f.comp_id === selectedCompId.value)
    ) {
      selectedCompId.value = null
    }
  } catch {
    folderList.value = []
  } finally {
    folderLoading.value = false
  }
}

function clearSelection() {
  selectedMatchingIds.value = new Set()
}

function exitSortMode() {
  sortMode.value = false
  isSorting.value = false
  oldSortSnapshot = []
}

function selectAllList() {
  selectedCompId.value = null
  exitSortMode()
  clearSelection()
}
function selectFolder(item: Compilations) {
  if (!item.comp_id) return
  selectedCompId.value = item.comp_id
  exitSortMode()
  clearSelection()
}

const toggleEditMode = () => {
  editMode.value = !editMode.value
  if (editMode.value) {
    selectMode.value = false
    exitSortMode()
    clearSelection()
  }
}

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    editMode.value = false
    exitSortMode()
  } else {
    clearSelection()
  }
}

/** 仅搭配夹可开排序；进入时尽量拉全量便于拖拽 */
const toggleSortMode = async () => {
  if (selectedCompId.value == null) return
  if (sortMode.value) {
    exitSortMode()
    return
  }
  editMode.value = false
  selectMode.value = false
  clearSelection()
  if (total.value > list.value.length) {
    await loadMatchingList(1, Math.max(total.value, pageSize))
  }
  if (!list.value.length) {
    toast.add({ title: '暂无清单可排序', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  sortMode.value = true
}

const onFolderItemsDragStart = () => {
  oldSortSnapshot = list.value.map((item) => ({ matching_id: item.matching_id }))
}

const onFolderItemsDragEnd = async () => {
  if (isSorting.value || selectedCompId.value == null) return
  const orderChanged = list.value.some(
    (item, index) => item.matching_id !== oldSortSnapshot[index]?.matching_id,
  )
  if (!orderChanged) return
  isSorting.value = true
  try {
    // 提交当前可见顺序（library_id = matching_id）；后端按数组顺序重排
    await sortCompDetail({
      comp_id: selectedCompId.value,
      sort: list.value.map((item) => ({
        matching_id: item.matching_id,
        library_id: Number((item as MatchingListItem & { library_id?: number }).library_id ?? item.matching_id),
      })),
    })
  } catch {
    toast.add({ title: '排序更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    void reloadList()
  } finally {
    isSorting.value = false
  }
}

const toggleMatchingSelection = (item: MatchingListItem) => {
  if (!item.matching_id) return
  const next = new Set(selectedMatchingIds.value)
  if (next.has(item.matching_id)) next.delete(item.matching_id)
  else next.add(item.matching_id)
  selectedMatchingIds.value = next
}

const isMatchingSelected = (matchingId: number) => selectedMatchingIds.value.has(matchingId)

const onCardClick = (item: MatchingListItem) => {
  if (sortMode.value) return
  if (isMatchingInvalid(item)) {
    if (selectMode.value) {
      toggleMatchingSelection(item)
      return
    }
    // 搭配夹内点失效项：询问是否清理失效子项
    if (selectedCompId.value != null) {
      showCleanInvalidModal.value = true
    }
    return
  }
  if (selectMode.value) {
    toggleMatchingSelection(item)
    return
  }
  // 编辑模式：整卡不进详情，只靠右上角铅笔编辑
  if (editMode.value) return
  jumpToMatchingDetail(item)
}

const confirmCleanInvalid = async () => {
  if (cleaningInvalid.value || selectedCompId.value == null) return
  cleaningInvalid.value = true
  try {
    const res = await cleanInvalidCompDetail({ comp_id: selectedCompId.value })
    const cleaned = Number(res?.cleaned ?? 0)
    toast.add({
      title: cleaned > 0 ? `已清理 ${cleaned} 项失效搭配` : '没有需要清理的失效项',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    showCleanInvalidModal.value = false
    void reloadList()
  } catch {
    toast.add({ title: '清理失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    cleaningInvalid.value = false
  }
}

const onEditButtonClick = async (item: MatchingListItem, e?: Event) => {
  e?.stopPropagation?.()
  e?.preventDefault?.()
  if (!item.matching_id) return
  await handleEdit(item)
}

const openBatchDeleteModal = () => {
  if (selectedMatchingIds.value.size === 0) return
  alsoDeleteMatching.value = false
  showBatchDeleteModal.value = true
}

const matchingChooseFilterList = computed(() => {
  const uid = userStore.user?.user_id
  if (!uid) return []
  return [{ field: 'user_id', op: 'eq', value: uid }]
})

/** 搭配夹内：弹出清单多选，批量加入当前夹 */
const openBatchAddToCurrentFolder = async (event?: MouseEvent) => {
  if (selectedCompId.value == null) return
  try {
    const choose = await waitForMountedRef({
      mounted: mountMatchingChoose,
      getRef: () => matchingChooseRef.value,
      preload: loadMatchingChoose,
    })
    choose.showModel(event)
  } catch {
    toast.add({ title: '选择器加载失败，请重试', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

const onMatchingChoose = async (payload: MatchingListItem | MatchingListItem[]) => {
  const items = Array.isArray(payload) ? payload : [payload]
  const ids = items.map((i) => i.matching_id).filter((id): id is number => typeof id === 'number')
  if (!ids.length || selectedCompId.value == null) return
  if (addingToFolder.value) return
  addingToFolder.value = true
  try {
    await insertCompDetailArray({
      comp_id: selectedCompId.value,
      library_id: ids,
    })
    toast.add({ title: '已加入搭配夹', icon: 'i-heroicons-check-circle', color: 'green' })
    void reloadList()
  } catch {
    toast.add({ title: '加入失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    addingToFolder.value = false
  }
}

/** 列表多选：打开夹子选择 */
const openPickFolderForSelected = () => {
  if (selectedMatchingIds.value.size === 0) return
  if (!folderList.value.length) {
    toast.add({ title: '请先新建搭配夹', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  showPickFolderModal.value = true
}

const addSelectedToFolder = async (folder: Compilations) => {
  if (!folder.comp_id || selectedMatchingIds.value.size === 0 || pickingFolder.value) return
  pickingFolder.value = true
  try {
    await insertCompDetailArray({
      comp_id: folder.comp_id,
      library_id: Array.from(selectedMatchingIds.value),
    })
    toast.add({
      title: `已加入「${folder.comp_name || '搭配夹'}」`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    clearSelection()
    showPickFolderModal.value = false
  } catch {
    toast.add({ title: '加入失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    pickingFolder.value = false
  }
}

const confirmBatchDelete = async () => {
  const ids = Array.from(selectedMatchingIds.value)
  if (!ids.length || batchDeleting.value) return
  batchDeleting.value = true
  try {
    // 搭配夹：默认只删合集项；勾选后额外删搭配本体
    if (selectedCompId.value != null) {
      await deleteCompDetailArray({
        comp_id: selectedCompId.value,
        library_id: ids,
      })
      if (alsoDeleteMatching.value) {
        const invalidIds = new Set(
          list.value.filter((item) => isMatchingInvalid(item)).map((item) => item.matching_id),
        )
        for (const matching_id of ids) {
          if (invalidIds.has(matching_id)) continue
          await deleteMatchingList({ matching_id })
        }
      }
      toast.add({
        title: alsoDeleteMatching.value ? '已移出并删除搭配' : '已从搭配夹移出',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
    } else {
      for (const matching_id of ids) {
        await deleteMatchingList({ matching_id })
      }
      toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }
    clearSelection()
    showBatchDeleteModal.value = false
    alsoDeleteMatching.value = false
    void reloadList()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    batchDeleting.value = false
  }
}

const onFolderDragEnd = async () => {
  if (isFolderSorting.value) return
  isFolderSorting.value = true
  try {
    await sortComp({
      pk_type: COMP_PK_TYPE_MATCHING_FOLDER,
      sort: folderList.value.map((item, index) => ({
        comp_id: item.comp_id,
        sort: index,
      })),
    })
    toast.add({ title: '排序已更新', icon: 'i-heroicons-check-circle', color: 'green' })
  } catch {
    toast.add({ title: '排序更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    void loadFolderList()
  } finally {
    isFolderSorting.value = false
  }
}

function openCreateFolder() {
  folderModalMode.value = 'create'
  editingFolder.value = null
  folderFormName.value = ''
  showFolderModal.value = true
}
function openEditFolder(item: Compilations) {
  folderModalMode.value = 'edit'
  editingFolder.value = item
  folderFormName.value = item.comp_name?.trim() || ''
  showFolderModal.value = true
}

async function saveFolder() {
  const name = folderFormName.value.trim()
  if (!name) {
    toast.add({ title: '请输入搭配夹名称', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  if (folderFormSaving.value) return
  folderFormSaving.value = true
  try {
    if (folderModalMode.value === 'create') {
      await insertComp({
        comp_name: name,
        pk_type: COMP_PK_TYPE_MATCHING_FOLDER,
        sort: folderList.value.length,
      })
      toast.add({ title: '创建成功', icon: 'i-heroicons-check-circle', color: 'green' })
    } else if (editingFolder.value?.comp_id) {
      await updateComp({
        comp_id: editingFolder.value.comp_id,
        comp_name: name,
      })
      toast.add({ title: '修改成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }
    showFolderModal.value = false
    await loadFolderList()
  } catch {
    toast.add({
      title: folderModalMode.value === 'create' ? '创建失败' : '修改失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  } finally {
    folderFormSaving.value = false
  }
}

function openDeleteFolderModal(item: Compilations) {
  deletingFolder.value = item
  showDeleteFolderModal.value = true
}

async function confirmDeleteFolder() {
  const item = deletingFolder.value
  if (!item?.comp_id) {
    showDeleteFolderModal.value = false
    return
  }
  try {
    await deleteComp({ comp_id: item.comp_id })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    if (selectedCompId.value === item.comp_id) selectedCompId.value = null
    await loadFolderList()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    showDeleteFolderModal.value = false
    deletingFolder.value = null
  }
}

const getClothesDisplayList = (item: MatchingListItem) => {
  const result: Array<{ clothes_img: string }> = []
  if (item.clothes_list?.length) result.push(...item.clothes_list)
  if (item.library_list?.length) {
    for (const lib of item.library_list) {
      const img = lib.cover ?? lib.square_cover
      if (img) result.push({ clothes_img: img })
    }
  }
  if (result.length === 0 && item.cover) result.push({ clothes_img: item.cover })
  return result
}

function isMatchingInvalid(item: MatchingListItem) {
  return Boolean((item as MatchingListItem & { is_invalid?: boolean }).is_invalid)
}

function mapCompRowToMatching(row: CompDetailRow): MatchingListItem | null {
  const m = row.matching_list
  const libraryId = Number(row.library_id) || 0
  const matchingId = Number(m?.matching_id ?? libraryId) || 0
  // matching 软删 is_enable=1，或关联已不存在 → 已失效（仍保留夹内占位，方便排序/清理）
  const softDeleted = m?.matching_id != null && Number((m as { is_enable?: number }).is_enable ?? 0) !== 0
  const missing = !m?.matching_id
  if (missing || softDeleted) {
    if (!matchingId && row.comp_list_id == null) return null
    return {
      matching_id: matchingId || Number(row.comp_list_id) || 0,
      note: '已失效',
      cover: undefined,
      tags_list: [],
      height: 0,
      width: 0,
      user_face: '',
      user_name: '',
      is_invalid: true,
      library_id: libraryId || matchingId,
      comp_list_id: row.comp_list_id,
    }
  }
  return {
    ...m,
    matching_id: m.matching_id,
    cover: m.cover,
    note: m.note,
    main_style: m.main_style,
    clothes_list: m.clothes_list,
    library_list: m.library_list,
    tags_list: m.tags_list ?? [],
    height: Number(m.height ?? 0),
    width: Number(m.width ?? 0),
    user_face: String(row.user_face ?? m.user_face ?? ''),
    user_name: String(row.user_name ?? m.user_name ?? ''),
    user_id: Number(row.user_id ?? m.user_id ?? 0) || undefined,
    // 排序接口用：搭配夹内 library_id = matching_id
    library_id: libraryId || m.matching_id,
    comp_list_id: row.comp_list_id,
  }
}

async function fetchMatchingPage(pageNo: number, overridePageSize?: number) {
  const size = overridePageSize ?? pageSize
  if (!userStore.user?.user_id) return { rows: [] as MatchingListItem[], count: 0 }
  if (selectedCompId.value != null) {
    const res = await getCompDetailList({
      comp_id: selectedCompId.value,
      page: pageNo,
      pageSize: size,
      keywords: keyword.value.trim() || undefined,
    })
    const rows = (res.rows ?? [])
      .map((row) => mapCompRowToMatching(row as CompDetailRow))
      .filter((x): x is MatchingListItem => x != null)
    return { rows, count: res.count ?? 0 }
  }
  const res = await getMatchingListList({
    page: pageNo,
    pageSize: size,
    keyword: keyword.value.trim() || '',
    filter_list: filterList.value.length
      ? (filterList.value as unknown as Record<string, unknown>)
      : undefined,
  })
  return { rows: res.rows ?? [], count: res.count ?? 0 }
}

async function loadMatchingList(targetPage = 1, overridePageSize?: number) {
  if (!userStore.user?.user_id) {
    list.value = []
    total.value = 0
    return
  }
  if (isLoading.value) return
  isLoading.value = true
  try {
    const res = await fetchMatchingPage(targetPage, overridePageSize)
    list.value = targetPage === 1 ? res.rows : [...list.value, ...res.rows]
    total.value = res.count
    page.value = targetPage
  } catch {
    toast.add({ title: '加载失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    if (targetPage === 1) {
      list.value = []
      total.value = 0
    }
  } finally {
    isLoading.value = false
  }
}

const reloadList = async () => {
  page.value = 1
  await loadMatchingList(1)
}

const loadMore = () => {
  if (sortMode.value || isLoading.value) return
  if (page.value * pageSize >= total.value) return
  void loadMatchingList(page.value + 1)
}

const jumpToMatchingDetail = (item: MatchingListItem) => {
  if (!item.matching_id) return
  openMatchingDetailTab(item.matching_id)
}

const ensureEditor = () =>
  waitForMountedRef({
    mounted: mountEditor,
    getRef: () => matchingAddEditRef.value,
    preload: loadMatchingAddEdit,
  })

const handleEdit = async (item: MatchingListItem) => {
  if (!item.matching_id) return
  try {
    const [editor, detail] = await Promise.all([
      ensureEditor(),
      getMatchingDetail({ matching_id: item.matching_id }),
    ])
    const clothesList: WardrobeClothes[] = []
    if (detail.clothes_list?.length) {
      for (const c of detail.clothes_list) {
        const wc = c as Record<string, unknown>
        if (typeof wc.clothes_id === 'number') {
          clothesList.push({
            clothes_id: wc.clothes_id,
            clothes_img: String(wc.clothes_img ?? ''),
            clothes_note: (wc.clothes_note as string) ?? undefined,
          })
        }
      }
    }
    if (detail.library_list?.length) {
      for (const lib of detail.library_list) {
        const l = lib as Record<string, unknown>
        if (typeof l.library_id === 'number') {
          clothesList.push({
            library_id: l.library_id,
            clothes_img: String(l.cover ?? l.square_cover ?? ''),
            clothes_note: (l.name as string) ?? undefined,
          } as WardrobeClothes)
        }
      }
    }
    editor.showModel(clothesList, {
      matching_id: detail.matching_id,
      note: detail.note,
      cover: detail.cover,
      appointment_time: detail.appointment_time as string | undefined,
      is_private: (detail as Record<string, unknown>).is_private as number | undefined,
      open_community: (detail as Record<string, unknown>).open_community as number | undefined,
      open_tags: (detail as Record<string, unknown>).open_tags as number | undefined,
      main_style: detail.main_style,
      season: detail.season,
    })
  } catch {
    toast.add({ title: '获取搭配详情失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

const onEditSuccess = () => {
  void reloadList()
}

async function initPage() {
  pageInitialized.value = false
  await Promise.all([loadThemeFromWardrobe(), loadFolderList(), reloadList()])
  pageInitialized.value = true
  // 不再 idle 预取 MatchingAddEdit（会拖 ImagePicker/vuedraggable/ali-oss），改为首次编辑时再拉
}

watch(
  () => userStore.user?.user_id,
  (uid) => {
    if (uid) void initPage()
    else {
      folderList.value = []
      selectedCompId.value = null
      themeWardrobe.value = null
      list.value = []
      total.value = 0
      pageInitialized.value = true
    }
  },
  { immediate: true },
)

watch(selectedCompId, () => {
  exitSortMode()
  void reloadList()
})

onMounted(() => {
  nextTick(() => {
    requestAnimationFrame(() => {
      sidebarTransitionEnabled.value = true
    })
  })
})
</script>

<template>
  <div
    class="wardrobe-wrap wardrobe-page-neu text-qhx-text relative"
    :style="pageStyle"
  >
    <div
      v-if="customStyle"
      class="pointer-events-none fixed inset-0 z-0"
      :style="pageBackgroundStyle"
      aria-hidden="true"
    />

    <div
      v-if="!pageInitialized"
      class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center"
    >
      <span class="text-gray-600">加载中…</span>
    </div>

    <div
      class="relative w-full min-h-[100dvh]"
      :style="tabBarInsetPx > 0 ? { paddingBottom: `${tabBarInsetPx}px` } : undefined"
    >
      <div class="rounded-2xl flex relative overflow-visible">
        <!-- 左侧：对齐衣柜侧栏 -->
        <div
          class="wardrobe-sidebar-wrap flex-shrink-0 relative"
          :class="[
            sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden' : 'w-[180px] max-md:w-[20vw]',
            sidebarTransitionEnabled && 'transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]',
          ]"
        >
          <button
            v-if="sidebarCollapsed"
            type="button"
            class="wardrobe-back-btn fixed z-[55] flex h-9 w-9 items-center justify-center rounded-full shadow-lg backdrop-blur-md"
            :class="[
              !customStyle?.btnColor && 'bg-black/55 hover:bg-black/65',
              !customStyle?.btnFontColor && 'text-white',
            ]"
            :style="{
              top: `${(configStore.statusBarHeight || 0) + 10}px`,
              left: '12px',
              ...customBtnStyle,
            }"
            aria-label="返回"
            @click="goBack"
          >
            <UIcon name="i-heroicons-arrow-left" class="text-[18px]" />
          </button>

          <div
            v-show="!sidebarCollapsed"
            class="wardrobe-list wardrobe-neu-sidebar wardrobe-list-height w-full overflow-y-auto"
          >
            <div
              v-if="configStore.statusBarHeight > 0"
              :style="{ height: `${configStore.statusBarHeight}px` }"
            />

            <div class="relative z-20 flex justify-center px-2 pb-1.5 pt-1">
              <button
                type="button"
                class="wardrobe-back-btn flex h-9 w-9 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-opacity hover:opacity-90 active:scale-95"
                :class="[
                  !customStyle?.btnColor && 'bg-black/55 hover:bg-black/65',
                  !customStyle?.btnFontColor && 'text-white',
                ]"
                :style="customBtnStyle"
                aria-label="返回"
                @click="goBack"
              >
                <UIcon name="i-heroicons-arrow-left" class="text-[18px]" />
              </button>
            </div>

            <div
              v-if="userStore.user?.user_id"
              class="flex flex-col items-center py-2 gap-1.5 pt-0"
            >
              <QhxJellyButton>
                <div
                  class="h-[46px] text-center px-0.5 cursor-pointer"
                  @click="openCreateFolder"
                >
                  <div
                    class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center transition-colors duration-300"
                    :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                    :style="customBtnStyle"
                  >
                    <UIcon name="material-symbols:create-new-folder-outline" class="text-[16px]" />
                  </div>
                  <div class="text-xs text-qhx-text">新建</div>
                </div>
              </QhxJellyButton>
            </div>

            <!-- 固定首项：全部清单（对齐衣柜左侧选中样式） -->
            <div
              class="group w-[90%] mx-auto flex flex-col items-center transition-transform duration-300 ease-out rounded-[10px] cursor-pointer"
              :class="[
                selectedCompId == null && !customStyle?.btnColor ? 'bg-qhx-primary' : '',
                selectedCompId == null && !customStyle?.btnFontColor ? 'text-qhx-inverted' : '',
              ]"
              :style="selectedCompId == null ? customBtnStyle : {}"
              @click="selectAllList"
            >
              <div
                class="wardrobe-name text-sm font-medium text-center w-full py-4"
              >
                列表
              </div>
            </div>

            <div
              v-if="folderLoading && folderList.length === 0"
              class="px-2 py-4 text-center text-xs text-gray-400"
            >
              加载中…
            </div>

            <QhxSortableList
              v-model="folderList"
              item-key="comp_id"
              :animation="250"
              :delay="150"
              :disabled="!userStore.user?.user_id"
              @end="onFolderDragEnd"
            >
              <template #item="{ element }">
                <div>
                  <div class="relative group-item">
                    <div
                      class="group w-[90%] mx-auto flex flex-col items-center transition-transform duration-300 ease-out rounded-[10px] cursor-pointer"
                      :class="[
                        selectedCompId === element.comp_id && !customStyle?.btnColor ? 'bg-qhx-primary' : '',
                        selectedCompId === element.comp_id && !customStyle?.btnFontColor ? 'text-qhx-inverted' : '',
                      ]"
                      :style="selectedCompId === element.comp_id ? customBtnStyle : {}"
                      @click="selectFolder(element)"
                    >
                      <div class="flex flex-col items-center w-full">
                        <div
                          class="wardrobe-name text-sm font-medium text-center w-full max-md:w-auto py-4 px-1 line-clamp-2"
                          :class="selectedCompId === element.comp_id ? '!pb-1' : ''"
                          :title="element.comp_name || '未命名搭配夹'"
                        >
                          {{ element.comp_name || '未命名搭配夹' }}
                        </div>
                        <span
                          v-if="selectedCompId === element.comp_id"
                          class="plan-timeline-hint mb-3 text-[11px] font-medium tracking-wide opacity-90 select-none"
                        >
                          搭配夹
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxSortableList>
          </div>
        </div>

        <button
          type="button"
          class="wardrobe-sidebar-toggle-hit fixed top-1/2 -translate-y-1/2 z-30"
          :class="[
            sidebarCollapsed ? 'is-collapsed' : 'is-expanded',
            !sidebarTransitionEnabled && 'is-no-transition',
          ]"
          :title="sidebarCollapsed ? '展开列表' : '收起列表'"
          :aria-label="sidebarCollapsed ? '展开列表' : '收起列表'"
          @click="toggleSidebarCollapsed"
        >
          <span class="wardrobe-collapse-toggle wardrobe-collapse-toggle--float-left pointer-events-none">
            <UIcon
              :name="sidebarCollapsed ? 'material-symbols:chevron-right' : 'material-symbols:chevron-left'"
              class="text-[14px]"
            />
          </span>
        </button>

        <!-- 右侧内容：对齐衣柜 content-area -->
        <div
          ref="scrollRootRef"
          class="flex-1 content-area-height overflow-y-auto overflow-x-hidden"
        >
          <div
            v-if="configStore.statusBarHeight > 0"
            :style="{ height: `${configStore.statusBarHeight}px` }"
          />

          <div class="relative w-full rounded-2xl overflow-hidden min-h-0">
            <div class="relative z-10 p-6 text-left space-y-4 max-md:p-2 mt-2">
              <div class="flex flex-col gap-2">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                  <div class="min-w-0">
                    <div class="text-lg font-semibold leading-tight">{{ contentTitle }}</div>
                    <div class="text-xs opacity-70 mt-0.5">
                      {{ selectedCompId == null ? '全部搭配清单' : '当前搭配夹' }}
                    </div>
                  </div>
                  <div class="flex items-center justify-end gap-1 flex-wrap">
                    <QhxJellyButton v-if="currentFolder">
                      <div
                        class="h-[46px] text-center px-0.5 cursor-pointer"
                        @click="openEditFolder(currentFolder)"
                      >
                        <div
                          class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                          :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                          :style="customBtnStyle"
                        >
                          <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                        </div>
                        <div class="text-xs">夹设置</div>
                      </div>
                    </QhxJellyButton>
                    <QhxJellyButton v-if="currentFolder">
                      <div
                        class="h-[46px] text-center px-0.5 cursor-pointer"
                        @click="openDeleteFolderModal(currentFolder)"
                      >
                        <div
                          class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                          :class="[!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white']"
                          :style="customBtnStyle"
                        >
                          <UIcon name="i-heroicons-trash" class="text-[16px]" />
                        </div>
                        <div class="text-xs">删夹</div>
                      </div>
                    </QhxJellyButton>
                  </div>
                </div>

                <!-- 工具条：搭配夹可批量添加/排序；列表暂不排序 -->
                <div class="flex flex-wrap gap-1">
                  <QhxJellyButton v-if="currentFolder">
                    <div
                      class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                      @click="openBatchAddToCurrentFolder($event)"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                        :style="customBtnStyle"
                      >
                        <UIcon name="material-symbols:playlist-add" class="text-[16px]" />
                      </div>
                      <div class="text-xs text-qhx-text">批量添加</div>
                    </div>
                  </QhxJellyButton>
                  <QhxJellyButton v-if="currentFolder">
                    <div
                      class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                      @click="toggleSortMode"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="sortMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                        :style="sortMode ? customBtnStyle : {}"
                      >
                        <UIcon name="icon-park-outline:sort-two" class="text-[16px]" />
                      </div>
                      <div class="text-xs text-qhx-text">排序</div>
                    </div>
                  </QhxJellyButton>
                  <QhxJellyButton>
                    <div
                      class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                      @click="toggleEditMode"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="editMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                        :style="editMode ? customBtnStyle : {}"
                      >
                        <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                      </div>
                      <div class="text-xs text-qhx-text">编辑模式</div>
                    </div>
                  </QhxJellyButton>
                  <QhxJellyButton>
                    <div
                      class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                      @click="toggleSelectMode"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="selectMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                        :style="selectMode ? customBtnStyle : {}"
                      >
                        <UIcon name="material-symbols:checklist" class="text-[16px]" />
                      </div>
                      <div class="text-xs text-qhx-text">多选</div>
                    </div>
                  </QhxJellyButton>
                  <QhxJellyButton>
                    <div
                      class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                      @click="handleSearch"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                      >
                        <UIcon name="i-heroicons-magnifying-glass-20-solid" class="text-[16px]" />
                      </div>
                      <div class="text-xs text-qhx-text">搜索</div>
                    </div>
                  </QhxJellyButton>
                </div>

                <div class="flex items-center gap-2">
                  <UInput
                    v-model="value"
                    placeholder="搜索搭配…"
                    class="min-w-0 flex-1"
                    :autofocus="false"
                    @keyup.enter="handleSearch"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            class="px-2 pb-6 max-md:px-1"
            :class="selectMode ? 'pb-28' : ''"
          >
            <div
              v-if="!userStore.user?.user_id"
              class="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm opacity-70"
            >
              <UIcon name="material-symbols:login" class="text-3xl" />
              <p>请先登录后查看我的搭配</p>
            </div>

            <!-- 对齐衣柜默认网格；搭配夹排序态用 QhxSortableList -->
            <template v-else-if="layoutReady && pageInitialized">
              <QhxSortableList
                v-if="sortMode && currentFolder"
                v-model="list"
                item-key="matching_id"
                class="flex flex-wrap"
                item-class="wardrobe-clothes-cell [@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3"
                :animation="200"
                :delay="140"
                :disabled="isSorting"
                :get-scroll-container="() => scrollRootRef"
                @start="onFolderItemsDragStart"
                @end="onFolderItemsDragEnd"
              >
                <template #item="{ element: item }">
                  <div
                    class="group flex flex-col items-center py-[10px] px-[15px] max-md:px-[5px] cursor-grab active:cursor-grabbing"
                    :class="isMatchingInvalid(item) ? 'opacity-60' : ''"
                  >
                    <div class="wardrobe-neu-item wardrobe-aspect-square w-full relative">
                      <div class="wardrobe-neu-photo relative z-0 w-full overflow-hidden rounded-xl border border-gray-200">
                        <img
                          v-if="!isMatchingInvalid(item) && item.cover"
                          :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                          :alt="item.note || '搭配'"
                          class="wardrobe-detail-img absolute inset-0 block h-full w-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <img
                          v-else-if="!isMatchingInvalid(item) && getClothesDisplayList(item).length > 0"
                          :src="`${BASE_IMG}${getClothesDisplayList(item)[0].clothes_img}?x-oss-process=image/quality,q_80/resize,w_200`"
                          alt=""
                          class="wardrobe-detail-img absolute inset-0 block h-full w-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <div
                          v-else
                          class="absolute inset-0 flex items-center justify-center opacity-40 bg-black/5 pointer-events-none"
                        >
                          <UIcon name="material-symbols:style" class="text-3xl" />
                        </div>
                      </div>
                    </div>
                    <div class="wardrobe-card-meta mt-2 mx-[2px] w-full text-center">
                      <div
                        class="wardrobe-card-meta-text line-clamp-2 overflow-hidden font-medium"
                        :class="isMatchingInvalid(item) ? 'text-amber-600' : ''"
                      >
                        {{ isMatchingInvalid(item) ? '已失效' : (item.note?.trim() || '未命名搭配') }}
                      </div>
                      <div
                        v-if="!isMatchingInvalid(item) && item.main_style"
                        class="wardrobe-card-meta-text--sub mt-1 line-clamp-1 text-qhx-primary"
                      >
                        ★ {{ item.main_style }}
                      </div>
                    </div>
                  </div>
                </template>
              </QhxSortableList>

              <div
                v-else
                class="flex flex-wrap"
              >
                <div
                  v-for="item in list"
                  :key="item.matching_id"
                  class="wardrobe-clothes-cell [@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3"
                >
                  <div
                    class="group flex flex-col items-center py-[10px] px-[15px] max-md:px-[5px] transition-transform duration-300 ease-out hover:scale-105 cursor-pointer"
                    :class="isMatchingInvalid(item) ? 'opacity-60' : ''"
                    @click="onCardClick(item)"
                  >
                    <div class="wardrobe-neu-item wardrobe-aspect-square w-full relative">
                      <div
                        v-if="selectMode && item.matching_id"
                        class="absolute top-0 right-0 z-20 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                        @click.stop="toggleMatchingSelection(item)"
                      >
                        <div
                          class="wardrobe-neu-clothes-check w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                          :class="isMatchingSelected(item.matching_id) ? (hasCustomBtnBg ? 'border-transparent' : 'bg-qhx-primary border-qhx-primary') : 'border-gray-400 bg-white/80'"
                          :style="isMatchingSelected(item.matching_id) && hasCustomBtnBg ? { ...customBtnStyle, borderColor: customStyle?.btnColor } : {}"
                        >
                          <UIcon
                            v-if="isMatchingSelected(item.matching_id)"
                            name="i-heroicons-check"
                            class="text-sm"
                            :class="!hasCustomBtnFont && 'text-white'"
                          />
                        </div>
                      </div>
                      <div
                        v-else-if="editMode && item.matching_id && !isMatchingInvalid(item)"
                        class="absolute top-0 right-0 z-20 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                        @click.stop="onEditButtonClick(item, $event)"
                      >
                        <div
                          class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                          :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                          :style="customBtnStyle"
                        >
                          <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                        </div>
                      </div>

                      <div class="wardrobe-neu-photo relative z-0 w-full overflow-hidden rounded-xl border border-gray-200">
                        <img
                          v-if="!isMatchingInvalid(item) && item.cover"
                          :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                          :alt="item.note || '搭配'"
                          class="wardrobe-detail-img absolute inset-0 block h-full w-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <img
                          v-else-if="!isMatchingInvalid(item) && getClothesDisplayList(item).length > 0"
                          :src="`${BASE_IMG}${getClothesDisplayList(item)[0].clothes_img}?x-oss-process=image/quality,q_80/resize,w_200`"
                          alt=""
                          class="wardrobe-detail-img absolute inset-0 block h-full w-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <div
                          v-else
                          class="absolute inset-0 flex items-center justify-center opacity-40 bg-black/5 pointer-events-none"
                        >
                          <UIcon name="material-symbols:style" class="text-3xl" />
                        </div>
                      </div>
                    </div>
                    <div class="wardrobe-card-meta mt-2 mx-[2px] w-full text-center">
                      <div
                        class="wardrobe-card-meta-text line-clamp-2 overflow-hidden font-medium"
                        :class="isMatchingInvalid(item) ? 'text-amber-600' : ''"
                      >
                        {{ isMatchingInvalid(item) ? '已失效' : (item.note?.trim() || '未命名搭配') }}
                      </div>
                      <div
                        v-if="!isMatchingInvalid(item) && item.main_style"
                        class="wardrobe-card-meta-text--sub mt-1 line-clamp-1 text-qhx-primary"
                      >
                        ★ {{ item.main_style }}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="!isLoading && list.length === 0"
                  class="w-full flex flex-col items-center justify-center gap-3 py-16 text-center text-sm opacity-70"
                >
                  <UIcon name="material-symbols:style" class="text-3xl" />
                  <p>{{ selectedCompId == null ? '暂无搭配，去衣柜创建吧' : '该搭配夹暂无清单' }}</p>
                </div>
              </div>
            </template>

            <QhxLoading
              v-if="layoutReady && pageInitialized && userStore.user?.user_id"
              :loading="isLoading"
              :page="page"
              :total="total"
              :page-size="pageSize"
              @load-more="loadMore"
            />
            <div class="pb-[40px]" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 多选底部栏：对齐衣柜 -->
  <Transition name="select-bar">
    <div
      v-if="selectMode"
      class="wardrobe-neu-select-bar fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center justify-center gap-2 px-3 py-3 bg-white/95 backdrop-blur-md safe-area-pb"
      :style="tabBarInsetPx > 0 ? { bottom: `${tabBarInsetPx}px` } : undefined"
    >
      <!-- 仅「列表」：多选加入搭配夹 -->
      <QhxJellyButton v-if="selectedCompId == null">
        <div
          class="h-[46px] text-center px-0.5 cursor-pointer"
          :class="selectedMatchingIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
          @click="selectedMatchingIds.size > 0 && openPickFolderForSelected()"
        >
          <div
            class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
            :class="selectedMatchingIds.size > 0 ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
            :style="selectedMatchingIds.size > 0 ? customBtnStyle : {}"
          >
            <UIcon name="material-symbols:create-new-folder-outline" class="text-[16px]" />
          </div>
          <div class="text-xs text-qhx-text">
            加入夹子
            <span v-if="selectedMatchingIds.size > 0">({{ selectedMatchingIds.size }})</span>
          </div>
        </div>
      </QhxJellyButton>
      <QhxJellyButton>
        <div
          class="h-[46px] text-center px-0.5 cursor-pointer"
          :class="selectedMatchingIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
          @click="selectedMatchingIds.size > 0 && openBatchDeleteModal()"
        >
          <div
            class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
            :class="selectedMatchingIds.size > 0 ? [!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
            :style="selectedMatchingIds.size > 0 ? customBtnStyle : {}"
          >
            <UIcon name="i-heroicons-trash" class="text-[16px]" />
          </div>
          <div class="text-xs text-qhx-text">
            {{ selectedCompId == null ? '批量删除' : '移出夹子' }}
            <span v-if="selectedMatchingIds.size > 0">({{ selectedMatchingIds.size }})</span>
          </div>
        </div>
      </QhxJellyButton>
    </div>
  </Transition>

  <MatchingAddEditAsync
    v-if="mountEditor"
    ref="matchingAddEditRef"
    @success="onEditSuccess"
  />

  <MatchingChooseAsync
    v-if="mountMatchingChoose"
    ref="matchingChooseRef"
    :multiple="true"
    :filter_list="matchingChooseFilterList"
    @choose="onMatchingChoose"
  />

  <QhxModal v-model="showFolderModal">
    <div class="w-[min(94vw,420px)] rounded-[10px] bg-white p-5 shadow-lg">
      <h3 class="mb-4 text-base font-semibold">
        {{ folderModalMode === 'create' ? '新建搭配夹' : '编辑搭配夹' }}
      </h3>
      <UFormGroup label="名称" required>
        <UInput
          v-model="folderFormName"
          placeholder="请输入搭配夹名称"
          maxlength="40"
          @keyup.enter="saveFolder"
        />
      </UFormGroup>
      <div class="mt-5 flex justify-end gap-2">
        <UButton color="gray" variant="soft" @click="showFolderModal = false">取消</UButton>
        <UButton
          :loading="folderFormSaving"
          :style="customBtnStyle"
          :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
          @click="saveFolder"
        >
          确定
        </UButton>
      </div>
    </div>
  </QhxModal>

  <QhxModal v-model="showCleanInvalidModal">
    <div class="w-[min(94vw,420px)] rounded-[10px] bg-white p-5 shadow-lg">
      <h3 class="mb-2 text-base font-semibold">清理失效搭配</h3>
      <p class="mb-5 text-sm opacity-80">
        检测到有已失效的搭配。是否清理本夹内所有失效项？清理后仅从合集列表移除，不会删除其他搭配。
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="gray" variant="soft" @click="showCleanInvalidModal = false">取消</UButton>
        <UButton color="primary" :loading="cleaningInvalid" @click="confirmCleanInvalid">
          清理全部失效
        </UButton>
      </div>
    </div>
  </QhxModal>

  <QhxModal v-model="showBatchDeleteModal">
    <div class="w-[min(94vw,420px)] rounded-[10px] bg-white p-5 shadow-lg">
      <h3 class="mb-2 text-base font-semibold">
        {{ selectedCompId == null ? '批量删除' : '移出搭配夹' }}
      </h3>
      <template v-if="selectedCompId != null">
        <p class="mb-3 text-sm opacity-80">
          确定将选中的 {{ selectedMatchingIds.size }} 项从本夹移出吗？默认不会删除搭配本体。
        </p>
        <label class="mb-5 flex items-start gap-2 cursor-pointer select-none">
          <UCheckbox v-model="alsoDeleteMatching" class="mt-0.5" />
          <span class="text-sm">
            同时删除对应搭配
            <span class="block text-xs opacity-60 mt-0.5">勾选后将永久删除搭配本体，无法恢复</span>
          </span>
        </label>
      </template>
      <p v-else class="mb-5 text-sm opacity-80">
        确定删除选中的 {{ selectedMatchingIds.size }} 个搭配吗？删除后将无法恢复。
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="gray" variant="soft" @click="showBatchDeleteModal = false">取消</UButton>
        <UButton color="red" :loading="batchDeleting" @click="confirmBatchDelete">
          {{ selectedCompId != null && alsoDeleteMatching ? '移出并删除' : selectedCompId != null ? '确定移出' : '确定删除' }}
        </UButton>
      </div>
    </div>
  </QhxModal>

  <!-- 列表多选：选择要加入的搭配夹 -->
  <QhxModal v-model="showPickFolderModal">
    <div class="w-[min(94vw,420px)] max-h-[min(80dvh,560px)] rounded-[10px] bg-white p-5 shadow-lg flex flex-col">
      <h3 class="mb-1 text-base font-semibold shrink-0">加入搭配夹</h3>
      <p class="mb-3 text-xs opacity-70 shrink-0">
        已选 {{ selectedMatchingIds.size }} 个清单，选择目标夹子
      </p>
      <div class="min-h-0 flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
        <button
          v-for="folder in folderList"
          :key="folder.comp_id"
          type="button"
          class="w-full text-left rounded-xl border border-gray-200 px-3 py-3 hover:bg-gray-50 transition disabled:opacity-60"
          :disabled="pickingFolder"
          @click="addSelectedToFolder(folder)"
        >
          <div class="text-sm font-medium">{{ folder.comp_name || '未命名搭配夹' }}</div>
        </button>
        <div v-if="!folderList.length" class="py-8 text-center text-sm opacity-60">
          暂无搭配夹，请先新建
        </div>
      </div>
      <div class="mt-4 flex justify-end shrink-0">
        <UButton color="gray" variant="soft" @click="showPickFolderModal = false">取消</UButton>
      </div>
    </div>
  </QhxModal>

  <QhxModal v-model="showDeleteFolderModal">
    <div class="w-[min(94vw,420px)] rounded-[10px] bg-white p-5 shadow-lg">
      <h3 class="mb-2 text-base font-semibold">删除搭配夹</h3>
      <p class="mb-5 text-sm opacity-80">
        确定删除搭配夹「{{ deletingFolder?.comp_name || '' }}」吗？夹内清单不会被删除。
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="gray" variant="soft" @click="showDeleteFolderModal = false">取消</UButton>
        <UButton color="red" @click="confirmDeleteFolder">确定删除</UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
/* 与衣柜 detail 同源拟态布局样式（scoped 无法跨页复用，故在此对齐复制） */
.wardrobe-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.wardrobe-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.wardrobe-clothes-cell {
  content-visibility: auto;
  contain-intrinsic-size: auto 220px;
}

.wardrobe-wrap {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.wardrobe-page-neu {
  --ward-neu-soft: rgba(255, 255, 255, 0.62);
  --ward-neu-deep: rgba(0, 0, 0, 0.14);
}

.wardrobe-page-neu .wardrobe-neu-sidebar {
  box-shadow:
    4px 3px 10px rgba(0, 0, 0, 0.08),
    -2px -2px 8px rgba(255, 255, 255, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 1px 0 0 rgba(255, 255, 255, 0.12),
    inset -1px 0 2px rgba(0, 0, 0, 0.03);
}

.wardrobe-page-neu .wardrobe-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--color-qhx-text, #666);
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    2px 2px 6px var(--ward-neu-deep),
    -1px -1px 4px var(--ward-neu-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  cursor: pointer;
}

.wardrobe-page-neu .wardrobe-collapse-toggle--float-left {
  width: 20px;
  height: 20px;
}

.wardrobe-page-neu .wardrobe-collapse-toggle--float-left:hover,
.wardrobe-page-neu .wardrobe-collapse-toggle--float-left:active {
  transform: none;
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-collapsed {
  left: 0;
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-no-transition {
  transition: none;
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-expanded {
  left: calc(180px - 10px);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit:hover .wardrobe-collapse-toggle--float-left {
  transform: scale(1.08);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit:active .wardrobe-collapse-toggle--float-left {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-expanded {
    left: calc(20vw - 10px);
  }
}

.wardrobe-page-neu .wardrobe-neu-tool-orb {
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.16),
    -1px -1px 4px rgba(255, 255, 255, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.wardrobe-page-neu .wardrobe-neu-item {
  box-shadow:
    3px 3px 8px rgba(0, 0, 0, 0.08),
    -2px -2px 6px rgba(255, 255, 255, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.wardrobe-aspect-square {
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  overflow: hidden;
}
@supports (aspect-ratio: 1) {
  .wardrobe-aspect-square {
    height: auto;
    padding-bottom: 0;
    aspect-ratio: 1 / 1;
  }
}
.wardrobe-aspect-square > .wardrobe-neu-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.wardrobe-page-neu .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.34);
  transition: box-shadow 0.28s ease;
}

.wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.38);
}

.wardrobe-page-neu .wardrobe-neu-clothes-check {
  box-shadow:
    3px 3px 8px rgba(0, 0, 0, 0.12),
    -2px -2px 7px rgba(255, 255, 255, 0.88),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.wardrobe-page-neu .wardrobe-neu-clothes-check.bg-qhx-primary {
  box-shadow:
    3px 4px 10px rgba(0, 0, 0, 0.2),
    -1px -1px 4px rgba(255, 255, 255, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

.wardrobe-page-neu .wardrobe-neu-select-bar {
  box-shadow:
    0 -8px 22px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.wardrobe-card-meta-text {
  font-size: 14px;
  line-height: 20px;
}

.wardrobe-card-meta-text--sub {
  font-size: 12px;
  line-height: 16px;
}

.select-bar-enter-active,
.select-bar-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
.select-bar-enter-from,
.select-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.safe-area-pb {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.wardrobe-list-height {
  height: 100vh;
  height: 100dvh;
  height: calc(100dvh - var(--wardrobe-tabbar-inset, 0px));
  min-height: 100vh;
  min-height: 100dvh;
  min-height: calc(100dvh - var(--wardrobe-tabbar-inset, 0px));
}

.content-area-height {
  height: 100vh;
  height: 100dvh;
  height: calc(100dvh - var(--wardrobe-tabbar-inset, 0px));
  min-height: 100vh;
  min-height: 100dvh;
  min-height: calc(100dvh - var(--wardrobe-tabbar-inset, 0px));
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.content-area-height::-webkit-scrollbar {
  display: none;
}

@supports (-webkit-touch-callout: none) {
  .wardrobe-list-height,
  .content-area-height {
    min-height: -webkit-fill-available;
  }
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
