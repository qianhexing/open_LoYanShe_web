<script setup lang="ts">
import type { Wardrobe, PaginationResponse, WardrobeClothes } from '@/types/api';
import { getWardrobeList, getClothesList, sortClothee, checkWadrobePassword } from '@/api/wardrobe'
import type { ClothesParams } from '@/api/wardrobe'
import Draggable from "vuedraggable"
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
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
let oldList: { clothes_id: number; sort: number }[] = [];
const record = ref<Wardrobe | null>(null)
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const toast = useToast()
const filter_list =  ref({
  tags: [] as string[],
  wardrobe_status: [] as string[]
}) 

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
  if (!currentWardrobe.value) return
  isLoading.value = true
  const params: ClothesParams = {
    page: Ipage || page.value,
    pageSize: IpageSize || pageSize,
    wardrobe_id: currentWardrobe.value?.wardrobe_id,
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
onMounted(() => {
  setTimeout(async () => {
    await fetchWardrobeList()
    let wardrobe = null
    if (wardrobeList.value && wardrobeList.value.length > 0) {
      if (route.query.wardrobe_id) {
        const index = wardrobeList.value.findIndex((item) => { item.wardrobe_id === Number.parseInt(route.query.wardrobe_id as string) })
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
          changeWardrobe(wardrobeList.value[index])
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
</script>
<template>

  <div class="">
    <div v-if="isSorting" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">正在保存排序……</span>
    </div>
    <div v-if="isLoading && page === 1" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">加载中……</span>
    </div>
    <clothes-add ref="addEditClothesRef" @success="reloadWardrobe"></clothes-add>
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
        <UButton v-if="record" type="submit" block
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
          @click="checkPassword(record?.wardrobe_id)">
          确定
        </UButton>
      </div>
    </QhxModal>

    <div class="bg-qhx-bg-card rounded-2xl flex">
      <div
        class=" wardrobe-list shadow-xl h-[calc(100vh-20px)] m-[10px] rounded-[10px] w-[180px] max-md:w-[100px] bg-gradient-to-b from-white to-gray-50 overflow-y-auto">
        <Draggable :disabled="!sortMode" v-model="wardrobeList" item-key="id" animation="250" ghost-class="drag-ghost"
          chosen-class="drag-chosen" drag-class="dragging">
          <template #item="{ element }">
            <transition-group tag="div" name="list">
              <div @click="changeWardrobe(element)"
                class="group py-4 flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 text-gray-600 rounded-[10px]"
                :class="currentWardrobe?.wardrobe_id === element.wardrobe_id ? 'bg-qhx-primary text-qhx-inverted' : ''">
                <img :src="`https://lolitalibrary.com/ali/${element.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                  :alt="element.wardrobe_name"
                  class="object-cover w-[120px] h-[120px] max-md:w-[70px] max-md:h-[70px] rounded-xl border border-gray-200 shadow-md bg-white cursor-grab active:cursor-grabbing"
                  loading="lazy" />
                <div class="mt-2 text-sm font-medium text-center w-[120px] truncate">
                  {{ element.wardrobe_name }}
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
            </h2>
            <p class="text-sm">
              {{ info.wardrobe_desc }}
            </p>
            <p class="text-sm">
              总穿着次数 {{ info.total_times }}
            </p>

            <div class="grid grid-cols-3 gap-4 text-center">
              <div class="rounded-lg p-2">
                <p class="text-lg font-bold">{{ info.total_count || 0 }}</p>
                <p class="text-xs">收录</p>
              </div>
              <div class="rounded-lg p-2">
                <p class="text-lg font-bold">{{ info.total_price || 0 }}</p>
                <p class="text-xs">总价</p>
              </div>
              <div class="rounded-lg p-2">
                <p class="text-lg font-bold">{{ info.total_community || 0 }}</p>
                <p class="text-xs">记忆</p>
              </div>
            </div>
          </div>
        </div>
        <div class=" flex flex-wrap" v-if="user.user?.user_id === Number.parseInt(id)">
          <QhxJellyButton>
            <div class="h-[60px] text-center px-1  cursor-pointer" @click="showAddClothes()">
              <div
                class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary" >
                <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
              </div>
              <div class=" text-sm">添加</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[60px] text-center px-1  cursor-pointer" @click="sortMode = !sortMode">
              <div
                class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center" :class="sortMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
                <UIcon name="icon-park-outline:sort-two" class="text-[22px] text-[#ffffff]" />
              </div>
              <div class=" text-sm">排序</div>
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
          <Draggable :disabled="!sortMode" @start="onDragStart" @end="onDragEnd" v-model="list" item-key="id"
            animation="300" ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging"
            class=" flex flex-wrap">
            <template #item="{ element }">
              <transition-group tag="div"
                class="[@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3" name="list">
                <div
                  class="group flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]">
                  <div class="w-full aspect-[1/1] relative shadow-xl">
                    <div
                      class=" absolute bg-qhx-primary text-qhx-inverted left-0 top-0 text-[12px] rounded-tl-[10px] px-1 py-[2px]"
                      v-if="element.wardrobe_status">
                      {{ element.wardrobe_status }}
                    </div>
                    <img :src="`https://lolitalibrary.com/ali/${element.clothes_img}`"
                      class="object-cover w-full aspect-[1/1.5] max-md:aspect-[1/1] rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                      loading="lazy">
                    </img>
                  </div>
                  <div class="mt-2 text-sm text-gray-600 font-medium text-center w-[140px] truncate">
                    {{ element.clothes_note }}
                  </div>
                  <div v-if="element.price"
                    class="mt-2 text-sm text-qhx-primary font-medium text-center w-[120px] truncate">
                    ￥ {{ element.price }}
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
</style>
