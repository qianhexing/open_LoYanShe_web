<script setup lang="ts">
import type { Wardrobe, PaginationResponse, WardrobeClothes } from '@/types/api';
import { getWardrobeList, getClothesList, sortClothee, checkWadrobePassword, sortWardrobe, updateWardrobe } from '@/api/wardrobe'
import type { ClothesParams } from '@/api/wardrobe'
import Draggable from "vuedraggable"
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import type QhxSelect from '@/components/Qhx/Select.vue'
const wardrobeStore = useWardrobeStore()
const user = useUserStore()
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
const info = ref<Wardrobe | null>(null)
const router = useRouter()
const showPassword = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const password = ref<string>('')
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

let oldList: { clothes_id: number; sort: number }[] = [];
const record = ref<Wardrobe | null>(null)
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import type WardrobeAddEdit from '@/components/Wardrobe/WardrobeAddEdit.vue'
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const toast = useToast()
const filter_list =  ref({
  tags: [] as string[],
  wardrobe_status: [] as string[]
}) 
const addEditWardrobeRef = ref<InstanceType<typeof WardrobeAddEdit> | null>(null)
const showAddWardrobe = () => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel()
  }
}
const showEditWardrobe = (item: Wardrobe) => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel(item)
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
    wardrobe_status: []
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
// 服饰拖拽部分(*^▽^*)
const onDragStart = () => {
  oldList = list.value.map((item, index) => ({ clothes_id: item.clothes_id, sort: item.sort || index }));
};
const onDragEnd = async () => {
  if (isSorting.value) return; // 防止重复提交
  isSorting.value = true;

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
const onWardrobeEditSuccess = () => {
  fetchWardrobeList()
  if (currentWardrobe.value?.wardrobe_id) {
    fetchClothesList(1, pageSize)
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
// 衣柜列表拖拽排序
let oldWardrobeList: { wardrobe_id: number; sort: number }[] = [];
const isWardrobeSorting = ref(false)
const onWardrobeDragStart = () => {
  oldWardrobeList = wardrobeList.value.map((item, index) => ({ 
    wardrobe_id: item.wardrobe_id || 0, 
    sort: item.sort || index 
  }));
};
const onWardrobeDragEnd = async () => {
  if (isWardrobeSorting.value) return; // 防止重复提交
  isWardrobeSorting.value = true;

  try {
    // 找出变化的元素
    const changed: { wardrobe_id: number; sort: number }[] = [];

    wardrobeList.value.forEach((item, newIndex) => {
      const oldItem = oldWardrobeList[newIndex];

      // 如果当前位置的 id 不一样，说明发生了位置变化
      if (!oldItem || item.wardrobe_id !== oldItem.wardrobe_id) {
        changed.push({
          wardrobe_id: item.wardrobe_id || 0,
          // 取 "变化前同一位置的 sort"
          sort: oldItem?.sort ?? item.sort ?? newIndex,
        });
      }
    });

    if (changed.length > 0) {
      const params = {
        sort: changed.map((item) => ({
          wardrobe_id: item.wardrobe_id,
          sort: item.sort,
        })),
      };

      await sortWardrobe(params);
      toast.add({
        title: '排序已更新',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
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
const jumpToClothes = (item: WardrobeClothes) => {
  if (sortMode.value) {
    console.log('排序模式返回')

    return
  }
  console.log('走到这里了')
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/clothes/detail/${item.clothes_id}`,
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
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
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
</script>
<template>

  <div class="wardrobe-wrap">
    <div v-if="isSorting || isWardrobeSorting" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">正在保存排序……</span>
    </div>
    <div v-if="isLoading && page === 1" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">加载中……</span>
    </div>
    <clothes-add ref="addEditClothesRef" @success="reloadWardrobe"></clothes-add>
    <wardrobe-add-edit ref="addEditWardrobeRef" @success="onWardrobeEditSuccess"></wardrobe-add-edit>
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

    <div class="bg-qhx-bg-card rounded-2xl flex">
      <div
        class=" wardrobe-list shadow-xl h-[calc(100vh-20px)] 
        m-[10px] rounded-[10px] w-[180px] max-md:w-[20vw]
        bg-qhx-bg-card
        overflow-y-auto">
        <div v-if="user.user?.user_id === Number.parseInt(id)" class="text-center py-2">
          <QhxJellyButton>
            <div class="h-[60px] text-center px-1  cursor-pointer" @click="showAddWardrobe()">
              <div class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center">
                <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
              </div>
              <div class=" text-sm text-qhx-text">新建衣柜</div>
            </div>
          </QhxJellyButton>
        </div>
        <Draggable :forceFallback="true" :delay="150" :disabled="!sortMode" v-model="wardrobeList" item-key="wardrobe_id" animation="250" ghost-class="drag-ghost"
          chosen-class="drag-chosen" drag-class="dragging" @start="onWardrobeDragStart" @end="onWardrobeDragEnd">
          <template #item="{ element }">
            <transition-group tag="div" name="list">
              <div class="relative group-item">
                <div @click="changeWardrobe(element)"
                  class="group py-4 flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 text-gray-600 rounded-[10px]"
                  :class="currentWardrobe?.wardrobe_id === element.wardrobe_id ? 'bg-qhx-primary text-qhx-inverted' : ''">
                  <img :src="`https://lolitalibrary.com/ali/${element.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="element.wardrobe_name"
                    draggable="false"
                    class="object-cover w-[120px] h-[120px] max-md:w-[50px] max-md:h-[50px] rounded-xl border border-gray-200 shadow-md bg-white cursor-grab active:cursor-grabbing"
                    loading="lazy" />
                  <div class="mt-2 text-sm font-medium text-center w-[120px] max-md:w-[auto] text-qhx-text line-clamp-2">
                    {{ element.wardrobe_name }}
                  </div>
                </div>
                <!-- 编辑按钮（仅对当前用户显示） -->
                <div v-if="user.user?.user_id === Number.parseInt(id)" 
                  class="absolute top-2 right-2 opacity-0 group-item:hover:opacity-100 transition-opacity">
                  <UButton 
                    icon="i-heroicons-pencil-square" 
                    size="xs" 
                    color="gray" 
                    variant="solid"
                    @click.stop="showEditWardrobe(element)"
                    class="bg-white/90 hover:bg-white shadow-md"
                  />
                </div>
              </div>
            </transition-group>
          </template>
        </Draggable>
      </div>
      <div class="flex-1 h-screen overflow-y-auto pr-3 overflow-x-hidden">
        <div class="relative w-full rounded-2xl overflow-hidden shadow-lg mb-3" v-if="info">
          <!-- 半透明遮罩层 -->
          <!-- :style="currentWardrobe?.wardrobe_cover? { backgroundImage: `url(${BASE_IMG + currentWardrobe?.wardrobe_cover})`} : {}" -->
          <div class="absolute inset-0 bg-cover bg-center"></div>
          <div class="relative z-10 p-6 text-left space-y-4 text-qhx-text max-md:p-2 mt-2">
            <div class="flex items-center space-x-3">
              <div>
                <p class="text-xs">创建于 {{ info.create_date }}</p>
              </div>
            </div>

            <!-- 衣柜标题 -->
            <h2 class="text-xl font-bold flex items-center">
              <div class="flex-1">{{ info.wardrobe_name }}</div>
              <div class="flex items-center gap-2">
                <QhxJellyButton>
                  <div class="h-[60px] text-center px-1  cursor-pointer">
                    <div
                      @click="copyUrl()"
                      class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center">
                      <UIcon name="ic:round-share" class="text-[22px] text-[#ffffff]" />
                    </div>
                    <div class=" text-sm">分享</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[60px] text-center px-1  cursor-pointer">
                    <div
                      @click="showEditWardrobe(currentWardrobe || info)"
                      class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center">
                      <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                    </div>
                    <div class=" text-sm">编辑</div>
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
                    class="cursor-pointer m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary" >
                    <UIcon name="i-heroicons-cog-6-tooth" class="text-[22px] text-[#ffffff]" />
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
                  class="cursor-pointer m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary" >
                  <UIcon name="i-heroicons-arrows-up-down" class="text-[22px] text-[#ffffff]" />
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
        <div class=" flex flex-wrap sticky top-[10px] z-10" v-if="user.user?.user_id === Number.parseInt(id)">
          <QhxJellyButton>
            <div class="h-[60px] text-center px-1  cursor-pointer" @click="showAddClothes()">
              <div
                class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary" >
                <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
              </div>
              <div class=" text-sm text-qhx-text">添加</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[60px] text-center px-1  cursor-pointer" @click="sortMode = !sortMode">
              <div
                class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center" :class="sortMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
                <UIcon name="icon-park-outline:sort-two" class="text-[22px] text-[#ffffff]" />
              </div>
              <div class=" text-sm text-qhx-text">排序</div>
            </div>
          </QhxJellyButton>
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
          :forceFallback="true" :delay="150" :disabled="!sortMode" @start="onDragStart" @end="onDragEnd" v-model="list" item-key="id"
            animation="300" ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging"
            class=" flex flex-wrap">
            <template #item="{ element }">
              <transition-group tag="div"
                class="[@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3" name="list">
                <div
                  class="group drag-handle flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]" @click="jumpToClothes(element)">
                  <div class="w-full aspect-[1/1] relative shadow-xl">
                    <div
                      class=" absolute bg-qhx-primary text-qhx-inverted left-0 top-0 text-[12px] rounded-tl-[10px] px-1 py-[2px]"
                      v-if="element.wardrobe_status">
                      {{ element.wardrobe_status }}
                    </div>
                    <img :src="`https://lolitalibrary.com/ali/${element.clothes_img}`"
                      draggable="false"
                      class="object-cover w-full aspect-[1/1.5] max-md:aspect-[1/1] rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                      loading="lazy">
                    </img>
                  </div>
                  <div class="mt-2 text-sm text-qhx-text font-medium text-center w-[140px] truncate">
                    {{ element.clothes_note }}
                  </div>
                  <div v-if="element.price"
                    class="mt-2 text-sm text-qhx-primary font-medium text-center w-[120px] truncate">
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
    <!-- <QhxDrawer v-model="show" direction="right" size="400px">
      <div class="p-4">
        <h2 class="text-xl font-bold">抽屉内容</h2>
        <p>这里可以放任意组件或内容</p>
      </div>
    </QhxDrawer> -->
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
</style>
