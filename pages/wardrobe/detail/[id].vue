<script setup lang="ts">
import type { Wardrobe, PaginationResponse, WardrobeClothes } from '@/types/api';
import { getWardrobeList, getClothesList, sortClothee, changeWardrobeClothes, changeWardrobeClothesBatch, deleteClothesByIds, checkWadrobePassword, sortWardrobe, updateWardrobe, deleteWardrobe } from '@/api/wardrobe'
import type { ClothesParams } from '@/api/wardrobe'
import Draggable from "vuedraggable"
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import type QhxSelect from '@/components/Qhx/Select.vue'
import { useMatchingDraftStore } from '@/stores/matchingDraft'
import { useFlyToButton } from '~/composables/useFlyToButton'
import { BASE_IMG } from '@/utils/ipConfig'

const wardrobeStore = useWardrobeStore()
const user = useUserStore()
const matchingDraftStore = useMatchingDraftStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const wardrobeList = ref<Wardrobe[]>([])
const wardrobeCount = ref<number>(0)
const currentWardrobe = ref<Wardrobe | null>(null)
const pageSize = 40
const page = ref(1)
const list = ref<WardrobeClothes[]>([])
const total = ref(0)
const isLoading = ref(false)
const tagList = ref<Array<string>>([])
const isSorting = ref(false) // loading 状态
const show = ref(true)
const sortMode = ref(false)
// 搭配模式：与排序互斥，开启后服饰卡片右上角显示加号，可添加进搭配草稿
const matchingMode = ref(false)
// 多选模式：与排序、搭配互斥，开启后服饰卡片右上角显示选择框，可批量操作
const selectMode = ref(false)
const selectedClothesIds = ref<Set<number>>(new Set())
const showMatchingDrawer = ref(false)
const info = ref<Wardrobe | null>(null)
const router = useRouter()
const showPassword = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const password = ref<string>('')
const showDeleteModal = ref(false)
const showBatchDeleteModal = ref(false)
const showMoreMenu = ref(false)
const moreMenuPosition = ref({ x: 0, y: 0 })
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
// 监听port变化
watch(port, (newVal) => {
  if (newVal) {
    newVal.onmessage = (e) => {
      const message = JSON.parse(e.data)
      if (message.type === 'reload') {
        reload()
      }
    }
  }
})

// 监听 UniApp iframe 传来的 postMessage 刷新
const handleUniRefreshMessage = (e: MessageEvent) => {
  try {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    if (data?.type === 'refresh' && data?.from === 'uni') {
      reload()
    }
  } catch {
    // 忽略解析错误
  }
}

// 传入颜色（十六进制）和透明度转换为十六进制颜色
const hexColor = (color: string, opacity: number) => {
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  console.log(`rgba(${r}, ${g}, ${b}, ${opacity})`, '返回的颜色')
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
const opearClothesId = ref<number | null>(null)
let oldList: { clothes_id: number; sort: number }[] = [];
const record = ref<Wardrobe | null>(null)
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import type WardrobeAddEdit from '@/components/Wardrobe/WardrobeAddEdit.vue'
import type WardrobeSearch from '@/components/Wardrobe/WardrobeSearch.vue'
import type WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import dayjs from 'dayjs';
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const toast = useToast()
const filter_list =  ref({
  tags: [] as string[],
  wardrobe_status: [] as string[],
  clothes_note: '' as string
}) 
const showFilterDrawer = ref(false)
const addEditWardrobeRef = ref<InstanceType<typeof WardrobeAddEdit> | null>(null)
const wardrobeSearchRef = ref<InstanceType<typeof WardrobeSearch> | null>(null)
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEdit> | null>(null)
const matchingBtnRef = ref<HTMLElement | null>(null)
const { flyToTarget } = useFlyToButton()

// 判断是否为移动端
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

// 衣柜状态标签背景颜色映射，便于扩展新状态
const WARDROBE_STATUS_BG_MAP: Record<string, string> = {
  待补款: 'bg-amber-500',
  已拥有: 'bg-emerald-500',
  // 可在此扩展: 已出: 'bg-gray-500', 等等
}

function getWardrobeStatusBgClass(status: string | null | undefined): string {
  if (!status) return 'bg-qhx-primary'
  return WARDROBE_STATUS_BG_MAP[status] ?? 'bg-qhx-primary'
}

// 衣柜状态选项
const wardrobeStatusOptions = computed(() => {
  if (!wardrobeStore.config?.wardrobe_status) return []
  return wardrobeStore.config.wardrobe_status
    .filter((status: string) => status !== '自定义')
    .map((status: string) => ({
      label: status,
      value: status
    }))
})

// 筛选条件数量
const filterCount = computed(() => {
  let count = 0
  if (filter_list.value.wardrobe_status.length > 0) {
    count += filter_list.value.wardrobe_status.length
  }
  if (filter_list.value.clothes_note && filter_list.value.clothes_note.trim() !== '') {
    count += 1
  }
  return count
})

// 是否有激活的筛选
const hasActiveFilter = computed(() => {
  return filterCount.value > 0
})
const showAddWardrobe = (e?: MouseEvent) => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel(null, e)
  }
}
const openWardrobeSearch = () => {
  if (wardrobeSearchRef.value) {
    wardrobeSearchRef.value.showModel()
  }
}
const showEditWardrobe = (item: Wardrobe, e?: MouseEvent) => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel(item, e)
  }
}
const fetchWardrobeList = async () => {
  const response = await getWardrobeList({
    user_id: Number.parseInt(id),
    pageSize: 999
  })
  wardrobeList.value = response.rows
  wardrobeCount.value = response.count
}
const checkPassword = (wardrobe_id: number) => {
  const params = {
    wardrobe_id,
    password: password.value
  }
  checkWadrobePassword(params)
    .then((res) => {
      if (record.value) {
        currentWardrobe.value = record.value
        console.log(currentWardrobe.value, 'currentWardrobe.value')
        isLoading.value = true
        page.value = 1
        fetchClothesList()
        router.replace({
          query: {
            ...route.query,
            password: params.password,
            wardrobe_id: currentWardrobe.value.wardrobe_id
          },
          force: true
        })
        showPassword.value = false
      }
    })
    .catch(() => {
      currentWardrobe.value = null
    })
}
const initFilter = () => {
  filter_list.value = {
    tags: [],
    wardrobe_status: [],
    clothes_note: ''
  }
}
const changeWardrobe = (item: Wardrobe) => {
  console.log(item, 'item')
  if (currentWardrobe.value?.wardrobe_id === item.wardrobe_id) return
  if (isLoading.value) return
  if (Number.parseInt(id) !== user.user?.user_id && item.password) {
    if (password.value || password.value === '') {
      showPassword.value = true
    }
    record.value = item
    return
  }
  currentWardrobe.value = item
  isLoading.value = true
  page.value = 1
  initFilter()
  selectMode.value = false
  selectedClothesIds.value = new Set()
  fetchClothesList()
  router.replace({
    query: {
      ...route.query,
      wardrobe_id: currentWardrobe.value.wardrobe_id
    },
    force: true
  })
}
const fetchClothesList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
  if (!currentWardrobe.value || !currentWardrobe.value.wardrobe_id) return
  isLoading.value = true
  const params: ClothesParams = {
    page: Ipage || page.value,
    pageSize: IpageSize || pageSize,
    wardrobe_id: currentWardrobe.value.wardrobe_id,
    filter_list: filter_list.value
  }
  if (password.value) {
    params.password = password.value
  }
  try {
    const response = await getClothesList(params)
    if (params.page === 1) {
      list.value = response.rows ?? []
      if (response.tags_list) {
        tagList.value = response.tags_list
      } else {
        tagList.value = []
      }
    } else {
      list.value = [...list.value, ...(response.rows ?? [])]
    }
    total.value = response.count
    if (response.info) {
      info.value = response.info
    }
    console.log(response, '衣柜返回值')
  } catch (error) {

  }
  isLoading.value = false

}
const copyUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl();
  try {
    await copyCurrentUrl()
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const showAddClothes = () => {
  if (addEditClothesRef.value) {
    addEditClothesRef.value.showModel(currentWardrobe.value)
  }
}
const getWardrobeIdByPoint = (clientX: number, clientY: number): number | null => {
  if (typeof document === 'undefined') return null

  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!el) return null

  let current: HTMLElement | null = el
  while (current) {
    // 你的衣柜名称节点 class 是 wardrobe-name，并带有 data-wardrobe-id
    if (current.classList && current.classList.contains('wardrobe-name')) {
      const idStr = current.dataset.wardrobeId
      return idStr ? Number.parseInt(idStr) : null
    }
    current = current.parentElement
  }
  return null
}
const fetchWardrobeClothes = async (clothesId: number, wardrobeId: number) => {
  const response = await changeWardrobeClothes({
    clothes_id: clothesId,
    wardrobe_id: wardrobeId
  })
  if (response) {
    toast.add({
      title: '服饰已移动到其他衣柜',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  }
  const index = list.value.findIndex(item => item.clothes_id === clothesId)
  if (index !== -1) {
    list.value.splice(index, 1)
  }
  opearClothesId.value = null
  reload()
  isSorting.value = false
}
// 服饰拖拽部分(*^▽^*)
const onDragStart = (e) => {
  oldList = list.value.map((item, index) => ({ clothes_id: item.clothes_id, sort: item.sort || index }));
};
const onDragEnd = async (e: any) => {
  if (isSorting.value) return; // 防止重复提交
  isSorting.value = true;
  console.log('拖拽结束', opearClothesId.value)
  // 获取正在拖拽的服饰ID
  const clothesId = e.originalEvent.target.dataset.clothesId
  if (e.originalEvent.type === 'touchend' && e.originalEvent.changedTouches.length > 0) {
    const touch = e.originalEvent.changedTouches[0];
    console.log('touch', touch)
    const clientX = touch.clientX
    const clientY = touch.clientY
    const wardrobeId = getWardrobeIdByPoint(clientX, clientY)
    if (wardrobeId && wardrobeId !== currentWardrobe.value?.wardrobe_id && opearClothesId.value) {
      console.log('是衣柜', wardrobeId)
      await fetchWardrobeClothes(opearClothesId.value, wardrobeId)
      return
    }
  } else {
    const isWardrobe = e.originalEvent.target.className.includes('wardrobe-name')
    if (isWardrobe) {
      const wardrobeId = e.originalEvent.target.dataset.wardrobeId
      console.log('是衣柜', wardrobeId)
      if (wardrobeId !== currentWardrobe.value?.wardrobe_id && opearClothesId.value) {
        await fetchWardrobeClothes(opearClothesId.value, wardrobeId)
        return
      }
    }
  }
  try {
    // 找出变化的元素
    const changed: { clothes_id: number; sort: number }[] = [];

    list.value.forEach((item, newIndex) => {
      const oldItem = oldList[newIndex];

      // 如果当前位置的 id 不一样，说明发生了位置变化
      if (!oldItem || item.clothes_id !== oldItem.clothes_id) {
        changed.push({
          clothes_id: item.clothes_id,
          // 取 "变化前同一位置的 sort"
          sort: oldItem?.sort ?? item.sort,
        });
      }
    });

    if (changed.length > 0 && currentWardrobe.value) {
      if (!currentWardrobe.value.wardrobe_id) return
      const params = {
        wardrobe_id: currentWardrobe.value?.wardrobe_id,
        sort: changed.map((item) => ({
          clothes_id: item.clothes_id,
          sort: item.sort,
        })),
      };

      await sortClothee(params);
      // useToast().success("排序已更新")
    }
  } catch (error) {
    console.error("排序更新失败:", error);
    // useToast().error("排序更新失败")
  } finally {
    isSorting.value = false;
  }
};
const loadMore = () => {
  console.log('是否在加载', isLoading.value)
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}
// 页码改变处理函数
const handlePageChange = async (current: number) => {
  page.value = current
  try {
    await fetchClothesList()
  } catch (error) {
    page.value -= 1
  }
}
const reload = async () => {
  fetchClothesList(1, pageSize * page.value)
}
const reloadWardrobe = () => {
  reload()
  wardrobeStore.getWardrobeConfig()
}
const onWardrobeEditSuccess = async () => {
  await fetchWardrobeList()
  if (currentWardrobe.value?.wardrobe_id) {
    await fetchClothesList(1, pageSize)
    // 用最新数据更新 currentWardrobe，避免再次编辑时显示旧数据
    const updated = wardrobeList.value.find(w => w.wardrobe_id === currentWardrobe.value?.wardrobe_id)
    if (updated) {
      currentWardrobe.value = updated
    }
    // 同时确保 info 与 currentWardrobe 一致（info 来自 getClothesList，可能包含更多字段）
    if (info.value && info.value.wardrobe_id === currentWardrobe.value?.wardrobe_id) {
      currentWardrobe.value = { ...currentWardrobe.value, ...info.value }
    }
  }
}
// 快速更新衣柜设置
const isUpdatingWardrobe = ref(false)
const loadingController = ref({
  is_private: false,
  show_price: false,
  sort_type: false
})
const updateWardrobeSetting = async (field: 'sort_type' | 'is_private' | 'show_price', value: number) => {
  if (!currentWardrobe.value?.wardrobe_id || !info.value) return
  if (loadingController.value[field]) return
  
  loadingController.value[field] = true
  try {
    const params: Wardrobe = {
      wardrobe_id: currentWardrobe.value.wardrobe_id,
      [field]: value
    }
    await updateWardrobe(params)
    // 更新本地数据
    if (info.value) {
      info.value[field] = value
    }
    if (currentWardrobe.value) {
      currentWardrobe.value[field] = value
    }
    // 如果是排序类型改变，重新加载列表
    if (field === 'sort_type') {
      page.value = 1
      await fetchClothesList(1, pageSize)
    }
    toast.add({
      title: '修改成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('更新失败:', error)
    toast.add({
      title: '修改失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    setTimeout(() => {
      loadingController.value[field] = false
    }, 300)
  }
}
// 格式化排序类型显示
const formatSortType = (index: number | undefined) => {
  if (index === undefined || index === null) return '自定义'
  const sortTypeMap: Record<number, string> = {
    0: '自定义',
    1: '购入倒叙',
    2: '购入正序',
    3: '价格倒叙',
    4: '价格正序',
    5: '穿着次数倒叙'
  }
  return sortTypeMap[index] || '自定义'
}
// 价格显示模式选项
const priceTypeOptions = [
  { label: '显示总价', value: 1 },
  { label: '隐藏总价', value: 0 },
  { label: '隐藏所有', value: 2 }
]
// 排序模式选项
const sortTypeOptions = [
  { label: '自定义', value: 0 },
  { label: '购入倒叙', value: 1 },
  { label: '购入正序', value: 2 },
  { label: '价格倒叙', value: 3 },
  { label: '价格正序', value: 4 },
  { label: '穿着次数倒叙', value: 5 }
]
// 选择价格显示模式
const showPriceSelect = ref(false)
const priceSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const showChoosePrice = (e: MouseEvent) => {
  if (priceSelectRef.value) {
    priceSelectRef.value.showPicker(e)
  }
}
const onPriceTypeChange = (option: { label: string; value: number }) => {
  updateWardrobeSetting('show_price', option.value)
}
// 选择排序模式
const sortSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const showChooseSort = (e: MouseEvent) => {
  if (sortSelectRef.value) {
    sortSelectRef.value.showPicker(e)
  }
}
const onSortTypeChange = (option: { label: string; value: number }) => {
  updateWardrobeSetting('sort_type', option.value)
}
// 判断是否是当前衣柜的拥有者
const isWardrobeOwner = computed(() => {
  return user.user?.user_id === Number.parseInt(id) && currentWardrobe.value?.user_id === user.user?.user_id
})

// 是否开放弹幕（config.open_danmu === 1 时显示弹幕组件）
const isDanmakuEnabled = computed(() => {
  const cfg = info.value?.config ?? currentWardrobe.value?.config
  return cfg?.open_danmu === 1
})

// 自定义主题样式
const customStyle = computed(() => {
  if (!info.value?.custom_style) return null
  const style = info.value.custom_style

  return {
    background: `${info.value?.background
      ? `linear-gradient(
          ${hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)},
          ${hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)}
        ),
        url(${BASE_IMG + info.value.background}) ${style.back_mode ? 'center/cover no-repeat' : 'repeat'}
      `
      : hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)
    }`,
    btnColor: style.btnColor || undefined,
    backColor: style.backColor || undefined,
    back_mode: style.back_mode ?? undefined,
    fontColor: style.fontColor || undefined,
    back_opacity: style.back_opacity ?? undefined,
    btnFontColor: style.btnFontColor || undefined
  }
})

// 是否有自定义主题
const hasCustomStyle = computed(() => {
  return customStyle.value !== null
})

// 背景样式
const backgroundStyle = computed(() => {
  if (!hasCustomStyle.value || !customStyle.value) return {}
  const style = customStyle.value
  const opacity = style.back_opacity ?? 1
  // 解析十六进制颜色值
  const hexColor = style.backColor.replace('#', '')
  const r = parseInt(hexColor.slice(0, 2), 16)
  const g = parseInt(hexColor.slice(2, 4), 16)
  const b = parseInt(hexColor.slice(4, 6), 16)
  
  if (style.back_mode) {
    // 背景模式：直接使用背景颜色作为背景
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  } else {
    // 非背景模式：使用背景颜色作为遮罩层（覆盖在背景图片上）
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  }
})

// 文本样式
const textStyle = computed(() => {
  if (!hasCustomStyle.value || !customStyle.value) return {}
  return {
    color: customStyle.value.fontColor
  }
})

// 按钮样式
const buttonStyle = computed(() => {
  if (!hasCustomStyle.value || !customStyle.value) return {}
  return {
    backgroundColor: customStyle.value.btnColor,
    color: customStyle.value.btnFontColor
  }
})
// 删除衣柜
const confirmDeleteWardrobe = async () => {
  if (!currentWardrobe.value?.wardrobe_id) return
  try {
    await deleteWardrobe({
      wardrobe_id: currentWardrobe.value.wardrobe_id
    })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 从列表中移除已删除的衣柜
    const index = wardrobeList.value.findIndex(item => item.wardrobe_id === currentWardrobe.value?.wardrobe_id)
    if (index !== -1) {
      wardrobeList.value.splice(index, 1)
    }
    // 切换到其他衣柜或清空
    if (wardrobeList.value.length > 0) {
      changeWardrobe(wardrobeList.value[0])
    } else {
      currentWardrobe.value = null
      info.value = null
      list.value = []
      router.replace({
        query: {
          ...route.query,
          wardrobe_id: undefined
        },
        force: true
      })
    }
  } catch (error) {
    console.error('删除失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteModal.value = false
  }
}
// 衣柜列表拖拽排序
const isWardrobeSorting = ref(false)
const onWardrobeDragEnd = async () => {
  if (isWardrobeSorting.value) return; // 防止重复提交
  isWardrobeSorting.value = true;

  try {
    const params = {
      sort: wardrobeList.value.map((item, index) => ({
        wardrobe_id: item.wardrobe_id || 0,
        sort: index,
      })),
    };

    await sortWardrobe(params);
    toast.add({
      title: '排序已更新',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error("排序更新失败:", error);
    toast.add({
      title: '排序更新失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    isWardrobeSorting.value = false;
  }
};
const chooseTags = (tags: string) => {
  const index = filter_list.value.tags.findIndex((child) => {
    return tags === child
  })
  if (index === -1) {
    filter_list.value.tags.push(tags)
  } else {
    filter_list.value.tags.splice(index, 1)
  }
  reload()
}
// 选择状态
const chooseStatus = (label: string) => {
  const index = filter_list.value.wardrobe_status.findIndex((status) => {
    return status === label
  })
  if (index === -1) {
    filter_list.value.wardrobe_status.push(label)
  } else {
    filter_list.value.wardrobe_status.splice(index, 1)
  }
}
// 重置筛选
const resetFilter = () => {
  filter_list.value.wardrobe_status = []
  filter_list.value.clothes_note = ''
  confirmFilter()
}
// 确认筛选
const confirmFilter = () => {
  showFilterDrawer.value = false
  page.value = 1
  fetchClothesList()
}
// 关闭筛选抽屉
const closeFilterDrawer = () => {
  showFilterDrawer.value = false
}
const jumpToClothes = (item: WardrobeClothes) => {
  if (sortMode.value) return
  if (matchingMode.value) return
  if (selectMode.value) return
  console.log('走到这里了')
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/common/outerLink?url=https://lolitalibrary.com/clothes/detail/${item.clothes_id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com/clothes/detail/${item.clothes_id}`
        }
      }));
    } else {
      // 普通网页环境 不用新窗口
      navigateTo(`/clothes/detail/${item.clothes_id}`)
      // window.location.href = `/clothes/detail/${item.clothes_id}`
    }
	}
}

// 打开更多菜单
const openMoreMenu = (e: MouseEvent) => {
  moreMenuPosition.value = {
    x: e.clientX + 50,
    y: e.clientY
  }
  showMoreMenu.value = true
}

// 跳转到星系可视化页面
const jumpToVisualization = () => {
  showMoreMenu.value = false
  const userId = user.user?.user_id || Number.parseInt(id)
  const visualizationUrl = `/visualization/wardrobe?user_id=${userId}`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${visualizationUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${visualizationUrl}`
        }
      }));
    } else {
      // 普通网页环境
      navigateTo(visualizationUrl)
    }
  }
}

// 跳转到搭配清单页面（我的所有搭配）
const jumpToMatchingList = () => {
  showMoreMenu.value = false
  const matchingUrl = `/matching/my`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${matchingUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${matchingUrl}`
        }
      }));
    } else {
      navigateTo(matchingUrl)
    }
  }
}

// 跳转到定制计划页面
const jumpToPlan = () => {
  showMoreMenu.value = false
  const planUrl = `/user/plan`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${planUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${planUrl}`
        }
      }));
    } else {
      // 普通网页环境
      navigateTo(planUrl)
    }
  }
}
onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleUniRefreshMessage)
  }
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  matchingDraftStore.loadFromStorage()
  setTimeout(async () => {
    await fetchWardrobeList()
    let wardrobe = null
    console.log(route.query.wardrobe_id, 'route.query')
    if (wardrobeList.value && wardrobeList.value.length > 0) {
      if (route.query.wardrobe_id) {
        const index = wardrobeList.value.findIndex((item) => { return item.wardrobe_id === Number.parseInt(route.query.wardrobe_id as string) })
        if (index !== -1) {
          wardrobe = wardrobeList.value[index]
        }
      }
      if (route.query.password) {
        password.value = route.query.password as string
        
      }
      console.log( password.value, 'password')
      if (user.user?.user_id === Number.parseInt(id)) {
        changeWardrobe(wardrobe || wardrobeList.value[0])
      } else {
        const index = wardrobeList.value.findIndex((item) => {
          return item.is_private === 0 || item.password
        })
        if (index !== -1) {
          if (wardrobe && wardrobe.is_private === 0) {
            changeWardrobe(wardrobe)
          } else {
            changeWardrobe(wardrobeList.value[index])
          }
        }
      }

    }

    if (user.user?.user_id === Number.parseInt(id)) {
      wardrobeStore.getWardrobeConfig()
    }
  });
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleUniRefreshMessage)
  }
})

useHead({
  title: 'Lolita衣柜',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita合集,Lolita图书馆'
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    },
  ]

})
const enableDrag = () => {
  sortMode.value = true
}

// 收缩展开状态: 0=全部展开, 1=左侧收起, 2=左侧+上方收起
const collapseState = ref(0)
const toggleCollapse = () => {
  collapseState.value = (collapseState.value + 1) % 3
}

// 搭配模式、排序、多选互斥
const toggleMatchingMode = () => {
  matchingMode.value = !matchingMode.value
  if (matchingMode.value) {
    sortMode.value = false
    selectMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const toggleSortMode = () => {
  sortMode.value = !sortMode.value
  if (sortMode.value) {
    matchingMode.value = false
    selectMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    sortMode.value = false
    matchingMode.value = false
    selectedClothesIds.value = new Set()
  } else {
    selectedClothesIds.value = new Set()
  }
}
const toggleClothesSelection = (item: WardrobeClothes) => {
  const id = item.clothes_id
  if (id == null) return
  const next = new Set(selectedClothesIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedClothesIds.value = next
}
const isClothesSelected = (clothesId: number) => selectedClothesIds.value.has(clothesId)

// 添加服饰到搭配草稿
const addToMatchingDraft = (item: WardrobeClothes) => {
  if (matchingDraftStore.add(item)) {
    // toast.add({ title: '已加入搭配', icon: 'i-heroicons-check-circle', color: 'green' })
  } else {
    // toast.add({ title: '已在搭配中', icon: 'i-heroicons-information-circle', color: 'gray' })
  }
}

// 打开搭配新增弹窗
const openMatchingAddEdit = () => {
  showMatchingDrawer.value = false
  matchingAddEditRef.value?.showModel(matchingDraftStore.list)
}

// 搭配模式：点击加号添加、点击删除图标从缓存移除；添加时播放飞入悬浮按钮动画
// 多选模式底部栏：切换衣柜，弹出衣柜选择后调用 clothes/update/wardrobe
const onSelectModeSwitchWardrobe = () => {
  wardrobeChooseRef.value?.showModel()
}
const onWardrobeChooseForMove = async (wards: Wardrobe[]) => {
  const target = wards[0]
  if (!target?.wardrobe_id || selectedClothesIds.value.size === 0) return
  const ids = Array.from(selectedClothesIds.value)
  try {
    await changeWardrobeClothesBatch({ ids: ids.join(','), wardrobe_id: target.wardrobe_id })
    toast.add({ title: '已移动到目标衣柜', icon: 'i-heroicons-check-circle', color: 'green' })
    for (const id of ids) {
      const idx = list.value.findIndex((item) => item.clothes_id === id)
      if (idx !== -1) list.value.splice(idx, 1)
    }
    selectedClothesIds.value = new Set()
  } catch {
    toast.add({ title: '移动失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}
// 多选模式底部栏：批量删除，调用 clothes/delete/ids
const onSelectModeBatchDelete = () => {
  if (selectedClothesIds.value.size === 0) return
  showBatchDeleteModal.value = true
}
const confirmBatchDelete = async () => {
  const ids = Array.from(selectedClothesIds.value)
  if (ids.length === 0) return
  try {
    await deleteClothesByIds({ ids: ids.join(',') })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    for (const id of ids) {
      const idx = list.value.findIndex((item) => item.clothes_id === id)
      if (idx !== -1) list.value.splice(idx, 1)
    }
    selectedClothesIds.value = new Set()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    showBatchDeleteModal.value = false
  }
}

const handleMatchingDraftToggle = (item: WardrobeClothes, e?: MouseEvent) => {
  const id = item.clothes_id
  if (id == null) return
  if (matchingDraftStore.hasClothes(id)) {
    matchingDraftStore.remove(id)
    // toast.add({ title: '已移除', icon: 'i-heroicons-check-circle', color: 'gray' })
  } else {
    const sourceEl = e?.currentTarget as HTMLElement | null
    const sourceRect = sourceEl?.parentElement?.getBoundingClientRect()
    const imgSrc = item.clothes_img ? `${BASE_IMG}${item.clothes_img}` : ''
    addToMatchingDraft(item)
    if (sourceRect && imgSrc) {
      nextTick(() => {
        flyToTarget(sourceRect, imgSrc, matchingBtnRef)
      })
    }
  }
}
</script>
<template>

  <div class="wardrobe-wrap text-qhx-text" :style="{ 
    background: customStyle?.background,
    backgroundPosition: 'center',
    color: customStyle?.fontColor || 'inherit',
    }">
    <div v-if="isSorting || isWardrobeSorting" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">正在保存排序……</span>
    </div>
    <div v-if="isLoading && page === 1" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">加载中……</span>
    </div>
    <!-- 弹幕组件：仅当开放弹幕时显示 -->
    <div
      v-if="isDanmakuEnabled && currentWardrobe?.wardrobe_id"
      class="fixed inset-0 w-full h-full pointer-events-none z-40"
    >
      <CommentDanmakuComment
        :key="currentWardrobe.wardrobe_id"
        type="wardrobe"
        :id="currentWardrobe.wardrobe_id"
        width="100%"
        height="100%"
        :pageSize="50"
        :can-delete-all="isWardrobeOwner"
        class="pointer-events-none"
      />
    </div>
    <clothes-add ref="addEditClothesRef" @success="reloadWardrobe"></clothes-add>
    <wardrobe-add-edit ref="addEditWardrobeRef" @success="onWardrobeEditSuccess"></wardrobe-add-edit>
    <matching-add-edit ref="matchingAddEditRef" @success="matchingDraftStore.clear" />
    <QhxModal @close="password = ''" v-model="showPassword" :trigger-position="clickPosition">
      <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
        <UInput v-model="password" :placeholder="'请输入密码'" class="flex-1 focus:ring-0" :ui="{
          base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
          rounded: 'rounded-[10px]',
          padding: { xs: 'px-4 py-2' },
          color: {
            white: {
              outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
            }
          }
        }" />
        <UButton v-if="record && record.wardrobe_id" type="submit" block
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
          @click="checkPassword(record.wardrobe_id)">
          确定
        </UButton>
      </div>
    </QhxModal>
    <UModal v-model="showDeleteModal" title="操作确认">
      <div class="p-6">
        <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除这个衣柜吗？删除后将无法恢复。</p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="showDeleteModal = false">取消</UButton>
          <UButton color="red" @click="confirmDeleteWardrobe">确定删除</UButton>
        </div>
      </div>
    </UModal>
    <UModal v-model="showBatchDeleteModal" title="批量删除确认">
      <div class="p-6">
        <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除选中的 {{ selectedClothesIds.size }} 件服饰吗？删除后将无法恢复。</p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="showBatchDeleteModal = false">取消</UButton>
          <UButton color="red" @click="confirmBatchDelete">确定删除</UButton>
        </div>
      </div>
    </UModal>
    <QhxModal v-model="showMoreMenu" :trigger-position="moreMenuPosition">
      <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">更多选项</h3>

        <!-- 星系选项 -->
        <button @click="jumpToVisualization"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
          <div
            class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <UIcon name="material-symbols:auto-awesome" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">星系</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看衣柜可视化</div>
          </div>
        </button>

        <!-- 搭配清单选项 -->
        <button @click="jumpToMatchingList"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
          <div
            class="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <UIcon name="material-symbols:style" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">搭配清单</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看我的所有搭配</div>
          </div>
        </button>

        <!-- 定制计划选项 -->
        <button @click="jumpToPlan"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
          <div
            class="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <UIcon name="material-symbols:calendar-month" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">定制计划</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看攒钱计划列表</div>
          </div>
        </button>
      </div>
    </QhxModal>

    <div class="rounded-2xl flex">
      <div
        class="wardrobe-list wardrobe-list-height shadow-xl rounded-[10px] flex-shrink-0 transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="collapseState >= 1 ? 'w-0 min-w-0 overflow-hidden' : 'w-[180px] max-md:w-[20vw] overflow-y-auto'">
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        
        <div v-if="user.user?.user_id === Number.parseInt(id)" class="flex flex-col items-center py-2 gap-1.5">
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5  cursor-pointer" @click="showAddWardrobe($event)">
              <div class="my-[3px] mx-auto text-white rounded-[50%] h-[24px] w-[24px] bg-qhx-primary flex items-center justify-center">
                <UIcon name="material-symbols:add-2" class="text-[16px] text-[#ffffff]" />
              </div>
              <div class="text-xs text-qhx-text">新建衣柜</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="openWardrobeSearch()">
              <div class="my-[3px] mx-auto text-white rounded-[50%] h-[24px] w-[24px] bg-qhx-primary flex items-center justify-center">
                <UIcon name="i-heroicons-magnifying-glass" class="text-[16px] text-[#ffffff]" />
              </div>
              <div class="text-xs text-qhx-text">搜索</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="openMoreMenu($event)">
              <div class="my-[3px] mx-auto text-white rounded-[50%] h-[24px] w-[24px] bg-qhx-primary flex items-center justify-center">
                <UIcon name="material-symbols:more-horiz" class="text-[16px] text-[#ffffff]" />
              </div>
              <div class="text-xs text-qhx-text">更多</div>
            </div>
          </QhxJellyButton>
        </div>
        <Draggable :forceFallback="true" :delay="150" :disabled="!sortMode" v-model="wardrobeList" item-key="wardrobe_id" animation="250" ghost-class="drag-ghost"
          chosen-class="drag-chosen" drag-class="dragging" @end="onWardrobeDragEnd">
          <template #item="{ element }">
            <transition-group tag="div" name="list">
              <div class="relative group-item">
                <div @click="changeWardrobe(element)"
                  class="group w-[90%] mx-auto flex flex-col items-center transition-transform duration-300 ease-out  rounded-[10px]"
                  :class="currentWardrobe?.wardrobe_id === element.wardrobe_id ? 'bg-qhx-primary text-qhx-inverted' : ''">
                  <!-- <img :src="`https://lolitalibrary.com/ali/${element.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="element.wardrobe_name"
                    draggable="false"
                    class="object-cover w-[120px] h-[120px] max-md:w-[50px] max-md:h-[50px] rounded-xl border border-gray-200 shadow-md bg-white cursor-grab active:cursor-grabbing"
                    loading="lazy" /> -->
                  <div class="wardrobe-name py-4 text-sm font-medium text-center w-[full] max-md:w-[auto] cursor-pointer"
                  :data-wardrobe-id="element.wardrobe_id">
                    {{ element.wardrobe_name }}
                  </div>
                </div>
                <!-- 编辑按钮（仅对当前用户显示） -->
                <!-- <div v-if="user.user?.user_id === Number.parseInt(id)" 
                  class="absolute top-2 right-2 opacity-0 group-item:hover:opacity-100 transition-opacity">
                  <UButton 
                    icon="i-heroicons-pencil-square" 
                    size="xs" 
                    color="gray" 
                    variant="solid"
                    @click.stop="showEditWardrobe(element)"
                    class="bg-white/90 hover:bg-white shadow-md"
                  />
                </div> -->
              </div>
            </transition-group>
          </template>
        </Draggable>
      </div>
      <div class="flex-1 content-area-height overflow-y-auto pr-3 overflow-x-hidden">
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        <div
          v-if="info"
          class="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] mb-3 overflow-hidden"
          :style="{ gridTemplateRows: collapseState >= 2 ? '0fr' : '1fr' }"
        >
        <div class="relative w-full rounded-2xl overflow-hidden shadow-lg min-h-0">
          <!-- 半透明遮罩层 -->
          <!-- :style="currentWardrobe?.wardrobe_cover? { backgroundImage: `url(${BASE_IMG + currentWardrobe?.wardrobe_cover})`} : {}" -->
          <div class="absolute inset-0 bg-cover bg-center"></div>
          <div class="relative z-10 p-6 text-left space-y-4 max-md:p-2 mt-2">
            <div class="flex items-center space-x-3">
              <div>
                <p class="text-xs">创建于 {{ dayjs(info.create_date).format('YYYY-MM-DD') }}</p>
              </div>
            </div>

            <!-- 衣柜标题 -->
            <h2 class="text-xl font-bold flex items-center">
              <div class="flex-1">{{ info.wardrobe_name }}</div>
              <div class="flex items-center gap-1">
                <QhxJellyButton>
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="copyUrl()"
                      class=" m-[3px] text-white rounded-[50%] h-[24px] w-[24px] bg-qhx-primary flex items-center justify-center">
                      <UIcon name="ic:round-share" class="text-[16px] text-[#ffffff]" />
                    </div>
                    <div class="text-xs">分享</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="showEditWardrobe(info, $event)"
                      class=" m-[3px] text-white rounded-[50%] h-[24px] w-[24px] bg-qhx-primary flex items-center justify-center">
                      <UIcon name="i-heroicons-pencil-square" class="text-[16px] text-[#ffffff]" />
                    </div>
                    <div class="text-xs">编辑</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="showDeleteModal = true"
                      class=" m-[3px] text-white rounded-[50%] h-[24px] w-[24px] bg-red-500 flex items-center justify-center">
                      <UIcon name="i-heroicons-trash" class="text-[16px] text-[#ffffff]" />
                    </div>
                    <div class="text-xs">删除</div>
                  </div>
                </QhxJellyButton>
              </div>
            </h2>
            <p class="text-sm">
              {{ info.wardrobe_desc }}
            </p>
            <p class="text-sm">
              衣柜收纳: {{ info.total_count || 0 }} 条
            </p>
            <p class="text-sm flex items-center">
              <span>衣柜总价: ￥ </span>
              <span>{{ info.show_price !== 1 ? '***' : (info.total_price || 0) }}</span>
              <span v-if="isWardrobeOwner" class="flex items-center ml-2 cursor-pointer" @click="showChoosePrice">
                <QhxJellyButton v-if="isWardrobeOwner" @click="showChoosePrice">
                  <div
                    class="cursor-pointer m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary" >
                    <UIcon name="i-heroicons-cog-6-tooth" class="text-[16px] text-[#ffffff]" />
                  </div>
                </QhxJellyButton>
                <span class="text-xs ml-1 text-qhx-text">
                  {{ info.show_price === 0 ? '隐藏总价' : info.show_price === 2 ? '隐藏所有' : '' }}
                </span>
              </span>
            </p>
            <p class="text-sm">
              穿着次数: {{ info.total_times }}
            </p>
            <p class="text-sm">
              共有 {{ info.total_community || 0 }} 条与小裙子间美好的回忆(*^▽^*)
            </p>
            
            <!-- 是否私密（仅拥有者可见） -->
            <div v-if="isWardrobeOwner" class="flex items-center justify-between text-sm">
              <span class="text-qhx-text">是否私密:</span>
              <div class="flex items-center">
                <UToggle 
                  :model-value="(info.is_private ?? 0) === 1" 
                  @update:model-value="(val: boolean) => updateWardrobeSetting('is_private', val ? 1 : 0)"
                  :loading="loadingController.is_private"
                  :disabled="loadingController.is_private"
                />
                <span class="text-xs ml-2 text-qhx-text">
                  {{ (info.is_private ?? 0) === 1 ? '私密' : '开放' }}
                </span>
              </div>
            </div>
            
            <!-- 排序模式（仅拥有者可见） -->
            <p class="text-sm flex items-center">
              <span>排序模式: {{ formatSortType(info.sort_type) }}</span>
              <QhxJellyButton v-if="isWardrobeOwner" @click="showChooseSort">
                <div
                  class="cursor-pointer m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary" >
                  <UIcon name="i-heroicons-arrows-up-down" class="text-[16px] text-[#ffffff]" />
                </div>
              </QhxJellyButton>
            </p>
            
            <!-- 隐藏的选择器组件 -->
            <QhxSelect 
              v-if="isWardrobeOwner && info"
              ref="priceSelectRef"
              :options="priceTypeOptions"
              :default-value="priceTypeOptions.find(opt => opt.value === (info?.show_price ?? 1)) || priceTypeOptions[0]"
              @select="onPriceTypeChange"
            />
            <QhxSelect 
              v-if="isWardrobeOwner && info"
              ref="sortSelectRef"
              :options="sortTypeOptions"
              :default-value="sortTypeOptions.find(opt => opt.value === (info?.sort_type ?? 0)) || sortTypeOptions[0]"
              @select="onSortTypeChange"
            />
          </div>
        </div>
        </div>
        <div
          class="flex justify-between items-center sticky z-10 gap-1.5"
          :style="{ top: `${(configStore.statusBarHeight || 0) + 10}px` }"
          v-if="user.user?.user_id === Number.parseInt(id)"
        >
          <div class="flex flex-wrap gap-1">
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showAddClothes()">
                <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary">
                  <UIcon name="material-symbols:add-2" class="text-[16px] text-[#ffffff]" />
                </div>
                <div class="text-xs text-qhx-text">添加</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleSortMode">
                <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center" :class="sortMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
                  <UIcon name="icon-park-outline:sort-two" class="text-[16px] text-[#ffffff]" />
                </div>
                <div class="text-xs text-qhx-text">排序</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleMatchingMode">
                <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center" :class="matchingMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
                  <UIcon name="material-symbols:style" class="text-[16px] text-[#ffffff]" />
                </div>
                <div class="text-xs text-qhx-text">搭配模式</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleSelectMode">
                <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center" :class="selectMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
                  <UIcon name="material-symbols:checklist" class="text-[16px] text-[#ffffff]" />
                </div>
                <div class="text-xs text-qhx-text">多选</div>
              </div>
            </QhxJellyButton>
          </div>
          <div class="flex flex-wrap gap-1">
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleCollapse">
                <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-info">
                  <UIcon :name="collapseState === 2 ? 'material-symbols:open-in-full' : 'material-symbols:collapse-content'" class="text-[16px] text-[#ffffff] transition-transform duration-300" />
                </div>
                <div class="text-xs text-qhx-text">{{ collapseState === 2 ? '展开' : '收起' }}</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showFilterDrawer = true">
                <div class="relative m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center" :class="hasActiveFilter ? 'bg-qhx-primary' : 'bg-qhx-info'">
                  <UIcon name="material-symbols:filter-list" class="text-[16px] text-[#ffffff]" />
                  <span v-if="filterCount > 0" class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full">
                    {{ filterCount > 99 ? '99+' : filterCount }}
                  </span>
                </div>
                <div class="text-xs text-qhx-text">筛选</div>
              </div>
            </QhxJellyButton>
          </div>
        </div>
        <div class="flex flex-wrap gap-2" v-if="tagList && tagList.length > 0">
          
          <QhxJellyButton  v-for="(tags, index) in tagList">
            <QhxTag @click="chooseTags(tags)" :active="filter_list.tags.findIndex((child) => { return child === tags}) !== -1" class=" cursor-pointer" :key="index">
              {{ tags }}
            </QhxTag>
          </QhxJellyButton>
        </div>
        <div class="w-full">
          <Draggable 
          :scroll="true"
          :scroll-sensitivity="150"
          :scroll-speed="15"
          :fallback-tolerance="0"
          :forceFallback="true" :delay="150" :disabled="!sortMode" @start="onDragStart" :move="() => { console.log('移动') }" @end="onDragEnd" v-model="list" item-key="id"
            animation="300" ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging"
            class=" flex flex-wrap">
            <template #item="{ element }">
              <transition-group tag="div"
                class="[@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3" name="list">
                <div
                  class="group drag-handle flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]"
                  @mousedown="opearClothesId = element.clothes_id"
                  @touchstart="opearClothesId = element.clothes_id"
                  @click="selectMode ? toggleClothesSelection(element) : jumpToClothes(element)">
                  <div class="w-full aspect-[1/1] relative shadow-xl">
                    <div
                      class="absolute left-0 top-0 text-[10px] rounded-tl-[6px] rounded-br-[6px] px-1 py-[1px] text-white"
                      :class="getWardrobeStatusBgClass(element.wardrobe_status)"
                      v-if="element.wardrobe_status">
                      {{ element.wardrobe_status }}
                    </div>
                    <!-- 多选模式：右上角选择框，点击选择/取消选择 -->
                    <div
                      v-if="selectMode && element.clothes_id"
                      class="absolute top-0 right-0 h-[32px] w-[32px] flex items-center justify-center cursor-pointer transition-all duration-200"
                      @click.stop="toggleClothesSelection(element)"
                    >
                      <div
                        class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                        :class="isClothesSelected(element.clothes_id) ? 'bg-qhx-primary border-qhx-primary' : 'border-gray-400 bg-white/80 dark:bg-gray-700/80'"
                      >
                        <UIcon v-if="isClothesSelected(element.clothes_id)" name="i-heroicons-check" class="text-white text-sm" />
                      </div>
                    </div>
                    <!-- 搭配模式：加号添加/删除图标，样式参考操作按钮；非搭配模式：有尾款计划时显示储蓄 icon -->
                    <div
                      v-else-if="matchingMode && element.clothes_id"
                      class="absolute top-0 right-0 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                      @click.stop="handleMatchingDraftToggle(element, $event)"
                    >
                      <div
                        class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="matchingDraftStore.hasClothes(element.clothes_id) ? 'bg-red-500' : 'bg-qhx-primary'"
                      >
                        <UIcon
                          :name="matchingDraftStore.hasClothes(element.clothes_id) ? 'i-heroicons-trash' : 'material-symbols:add-2'"
                          class="text-[16px] text-[#ffffff]"
                        />
                      </div>
                    </div>
                    <div
                      v-else-if="(element.plan_id || element.plan) && element.wardrobe_status !== '已拥有'"
                      class="absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-[#D4AF37] dark:text-[#F0D050]"
                      @click.stop="jumpToClothes(element)"
                    >
                      <UIcon name="material-symbols:savings-rounded" class="text-base" />
                    </div>
                    <!-- 颜色列表圆点：封面左下角 -->
                    <div
                      v-if="element.color"
                      class="absolute left-0 bottom-0 z-10 flex flex-wrap gap-0.5 p-1 rounded-bl-xl"
                    >
                      <div
                        v-for="(c, ci) in element.color.split(',')"
                        :key="ci"
                        class="w-3 h-3 rounded-full shadow-sm border border-white/50 dark:border-gray-700/50 shrink-0"
                        :style="{ backgroundColor: c.trim() }"
                      />
                    </div>
                    <img :src="`${BASE_IMG}${element.clothes_img}`"
                      draggable="false"
                      class="object-cover w-full aspect-[1/1.5] max-md:aspect-[1/1] rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                      loading="lazy">
                    </img>
                  </div>
                  <div class="mt-2 mx-[2px] line-clamp-2 overflow-hidden text-sm font-medium text-center">
                    {{ element.clothes_note }}
                  </div>
                  <div v-if="element.price"
                    class="mt-2 text-sm text-qhx-primary font-medium text-center w-[120px] line-clamp-2 overflow-hidden">
                    ￥ {{ info?.show_price === 2 ? '***' : (element.price || 0) }}
                  </div>
                </div>
              </transition-group>
            </template>
          </Draggable>
        </div>
        <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore">
        </QhxLoading>
        <div class="pb-[40px]"></div>
      </div>
    </div>
    <!-- 筛选抽屉 -->
    <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
      <QhxBottomDrawer v-if="showFilterDrawer" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 500 : 450">
      <div class="flex flex-col h-full">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between mb-2 px-4 pt-2 flex-shrink-0">
          <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">筛选</h3>
          <button
            @click="closeFilterDrawer"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>
        
        <!-- 可滚动内容区域 -->
        <div class="flex-1 overflow-y-auto px-4">
          <div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">注意: 该筛选会影响总价等统计数据</p>
          </div>
          
          <div class="mb-4">
            <div class="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">服饰名字：</div>
            <UInput 
              v-model="filter_list.clothes_note" 
              placeholder="请输入服饰名字进行筛选"
              class="w-full"
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
          </div>
          
          <div class="mb-2">
            <div class="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">状态：</div>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(status, index) in wardrobeStatusOptions"
                :key="index"
                :active="filter_list.wardrobe_status.includes(status.label)"
                class="cursor-pointer"
                @click="chooseStatus(status.label)"
              >
                {{ status.label }}
              </QhxTag>
            </div>
          </div>
        </div>
        
        <!-- 固定在底部的按钮 -->
        <div class="flex justify-end gap-2 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <UButton color="gray" variant="outline" @click="resetFilter">
            重置
          </UButton>
          <UButton color="primary" @click="confirmFilter">
            确认筛选
          </UButton>
        </div>
      </div>
    </QhxBottomDrawer>
    </Transition>

    <!-- 搭配草稿悬浮按钮 + 抽屉，初始左下角；matchingBtnRef 用于飞入动画目标定位 -->
    <QhxFloatingButton v-if="matchingDraftStore.count > 0" initial-position="bottom-left">
      <div ref="matchingBtnRef" class="relative w-12 h-12 rounded-full bg-qhx-primary flex items-center justify-center shadow-lg cursor-pointer" @click="showMatchingDrawer = true">
        <UIcon name="material-symbols:style" class="text-white text-2xl" />
        <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
          {{ matchingDraftStore.count > 99 ? '99+' : matchingDraftStore.count }}
        </span>
      </div>
    </QhxFloatingButton>
    <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
      <QhxBottomDrawer v-if="showMatchingDrawer" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 450 : 400">
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between mb-2 px-4 pt-2 flex-shrink-0">
            <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">搭配草稿 ({{ matchingDraftStore.count }})</h3>
            <button
              @click="showMatchingDrawer = false"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <UIcon name="i-heroicons-x-mark" class="text-gray-500" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <div v-if="matchingDraftStore.list.length === 0" class="text-center py-12 text-gray-500">
              暂无服饰，开启搭配模式添加
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in matchingDraftStore.list"
                :key="item.clothes_id"
                class="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div class="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <img
                    :src="`${BASE_IMG}${item.clothes_img}`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{{ item.clothes_note || '未命名' }}</div>
                  <div v-if="item.price" class="text-xs text-qhx-primary mt-0.5">￥{{ item.price }}</div>
                </div>
                <button
                  class="w-8 h-8 flex-shrink-0 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  @click="matchingDraftStore.remove(item.clothes_id!)"
                >
                  <UIcon name="i-heroicons-trash" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
          <div class="flex justify-center px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <UButton
              block
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="openMatchingAddEdit"
            >
              创建搭配
            </UButton>
          </div>
        </div>
      </QhxBottomDrawer>
    </Transition>

    <!-- 全局搜索组件 -->
    <WardrobeSearch
      ref="wardrobeSearchRef"
      :wardrobe-list="wardrobeList"
      :can-choose="false"
    />
    <!-- 多选模式：切换衣柜选择 -->
    <WardrobeChoose
      v-if="user.user?.user_id === Number.parseInt(id)"
      ref="wardrobeChooseRef"
      :user_id="Number.parseInt(id)"
      :multiple="false"
      @choose="onWardrobeChooseForMove"
    />

    <!-- 多选模式底部悬浮功能栏 -->
    <Transition name="select-bar">
      <div
        v-if="selectMode"
        class="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-pb"
      >
        <QhxJellyButton>
          <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="onSelectModeSwitchWardrobe">
            <div class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto bg-qhx-info">
              <UIcon name="material-symbols:swap-horiz" class="text-[16px] text-[#ffffff]" />
            </div>
            <div class="text-xs text-qhx-text">切换衣柜</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div
            class="h-[46px] text-center px-0.5 cursor-pointer"
            :class="selectedClothesIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
            @click="selectedClothesIds.size > 0 && onSelectModeBatchDelete()"
          >
            <div
              class="m-[3px] text-white rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
              :class="selectedClothesIds.size > 0 ? 'bg-red-500' : 'bg-qhx-info'"
            >
              <UIcon name="i-heroicons-trash" class="text-[16px] text-[#ffffff]" />
            </div>
            <div class="text-xs text-qhx-text">
              批量删除
              <span v-if="selectedClothesIds.size > 0">({{ selectedClothesIds.size }})</span>
            </div>
          </div>
        </QhxJellyButton>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drag-ghost {
  opacity: 0.4;
  transform: scale(0.95);
}

.drag-chosen {
  /* outline: 2px solid #ec4899; */
  border-radius: 12px;
}

.dragging {
  transform: scale(1.05);
}

/* 拖拽切换时的过渡动效 */
.list-move {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  /* 类似回弹效果 */
}

.wardrobe-list::-webkit-scrollbar {
  width: 1px;
  height: 0px;
  /* 垂直滚动条宽度 */
}

/* 滚动条轨道 */
.wardrobe-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
}

/* 滚动条滑块 */
.wardrobe-list::-webkit-scrollbar-thumb {
  background: #bbbbbb;
  border-radius: 10px;
}

/* 滚动条滑块悬停状态 */
.wardrobe-list::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
.wardrobe-wrap{
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* iOS 浏览器 100vh 滚动条修复：使用 dvh 和 -webkit-fill-available */
.wardrobe-list-height {
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
}

.content-area-height {
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
}

@supports (-webkit-touch-callout: none) {
  .wardrobe-list-height,
  .content-area-height {
    min-height: -webkit-fill-available;
  }
}

/* 多选模式底部栏：自下而上滑入/滑出 */
.select-bar-enter-active,
.select-bar-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
.select-bar-enter-from,
.select-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 安全区：底部栏预留 iPhone 刘海等 */
.safe-area-pb {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
</style>
