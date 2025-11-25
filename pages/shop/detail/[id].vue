<script setup lang="ts">
import type { Shop, PaginationResponse, LibraryPipe } from '@/types/api';
import { getShopDetail } from '@/api/shop';
import { getLibraryPipeList, getLibraryPipeListAll } from '@/api/library';
import type { UserBlackBtn, UserGoodBtn } from '#components';
import type LibraryPipeManage from '@/components/library/LibraryPipeManage.vue'

const user = useUserStore()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('shopDeatil', () => {
  return getShopDetail({ shop_id: Number.parseInt(id) })
}, {})
const detail = ref<Shop | null>(null)
const shop = ref<Shop | null>(null)
const goodBtn = ref<InstanceType<typeof UserGoodBtn> | null>(null)
const blackBtn = ref<InstanceType<typeof UserBlackBtn> | null>(null)
const library_pipe = ref<LibraryPipe[]>([])
import dayjs from 'dayjs'
detail.value = data.value ?? null
const router = useRouter()
const selectLibraryPipe = (item: LibraryPipe) => {
  console.log(item)
  // router.push(`/library/detail/${item.library?.library_id}`)
}
const fetchLibraryPipe = () => {
  getLibraryPipeListAll({ shop_id: Number.parseInt(id), end_time: dayjs().format('YYYY-MM-DD'), pk_type: 0 })
    .then((res) => {
      library_pipe.value = res
    })
}
const formateState = (state: number) => {
  const item = config.value?.pipe_state.find(item => item.value === state)
  return item?.label
}
onMounted(() => {
  fetchLibraryPipe()
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: detail.value ? detail.value.shop_name : 'Lolita店铺汇总',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.shop_name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
const libraryPipeManageRef = ref<InstanceType<typeof LibraryPipeManage> | null>(null)
const showLibraryPipeManage = () => {
  libraryPipeManageRef.value?.showModel({ shop_id: Number.parseInt(id) })
}
</script>
<template>
  <div class="container mx-auto p-4container mx-auto p-4">
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="detail.shop_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full relative">
          <QhxPreviewImage :key="detail.shop_id" :list="[{ src: detail.shop_logo, alt: detail.shop_name }]" :className="'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
        </div>
        <div class="m-2 flex-1">
          <div>
            <h1 class="mb-3 text-lg font-semibold">{{ detail?.shop_name }}</h1>
          </div>
          <h3 class="text-sm m-1" v-html="detail.shop_describe" v-if="detail.shop_describe"></h3>
          <div class="flex justify-center p-3">
            <UButton color="gray" variant="ghost" icon="i-heroicons-pencil-square" @click="showLibraryPipeManage">
              管理店铺状态流
            </UButton>
          </div>
          <div class="flex justify-center p-3">
            <div class=" flex-1 text-center">
              <UserGoodBtn ref="goodBtn" :pk_type="1" :pk_id="detail.shop_id" :good_count="detail.good_count || 0" :need_judge="true">
              </UserGoodBtn>
            </div>
            <div class=" flex-1 text-center">
              <UserBlackBtn ref="blackBtn" :pk_type="1" :pk_id="detail.shop_id" :black_count="detail.black_count || 0" :need_judge="true">
              </UserBlackBtn>
            </div>
            <div class=" flex-1 text-center" v-if="goodBtn && blackBtn">
              赞黑比 {{ blackBtn.blackCount ? (goodBtn.goodCount / blackBtn.blackCount).toFixed(2) : goodBtn.goodCount ? goodBtn.goodCount : '--' }}
            </div>
          </div>
          <!-- 主营风格 -->
          <div v-if="detail.style_list  && detail.style_list?.length" class="mb-1">
            <h3 class="text-sm m-1">主营风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主营类型 -->
          <div v-if="detail.type_list && detail.type_list?.length > 0" class="mb-1">
            <h3 class="text-sm m-1">主营类型</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.type_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主体 -->
          <div v-if="detail.main_type" class="mb-1">
            <h3 class="text-sm m-1">主体</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in formatShopMainType(detail.main_type)" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>
          <!-- 代表作 -->
          <div v-if="detail.masterpiece_list && detail.masterpiece_list.length > 0" class="mb-1">
            <h3 class="text-sm m-1">代表作</h3>
            <div class="flex flex-wrap gap-2">
              <div v-for="library in detail.masterpiece_list">
                <LibraryItem :item="library" size="mini" :className="' w-[100px] cursor-pointer'"></LibraryItem>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['近期工作流', '图表版']">
        <QhxTabPanel :index="0">
          <div class=" bg-white">
            <div v-if="library_pipe.length > 0">
              <div v-for="value in library_pipe" :key="value.pipe_id">
                <div v-if="value.library">
                  <LibraryItem :need-jump="false" :item="value.library" size="mini-list" class="w-full">
                    <template #extra>
                      <div class="p-2 flex items-center">
                        <QhxTag :active="true"> {{ formateState(value.state || 0) }} </QhxTag>
                        <h3 class="p-2">起止时间</h3>
                        <QhxTag :active="true">{{ dayjs(value.start_time).format('YY-MM-DD') }}</QhxTag> - 
                        <QhxTag :active="true">{{ dayjs(value.end_time).format('YY-MM-DD') }}</QhxTag>
                      </div>
                    </template>
                  </LibraryItem>
                </div>
              </div>
            </div>
          </div>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <div class=" bg-white" v-if="isActive">
              <div v-if="library_pipe.length > 0" class="p-3">
                <h3 class="text-sm m-1">近期工作流</h3>
                <div class="flex flex-wrap gap-2">
                  <QhxTimePipe :timePipe="[...library_pipe]" @select="selectLibraryPipe"></QhxTimePipe>
                </div>
              </div>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['图鉴', '大事记']">
        <QhxTabPanel :index="0">
          <div class=" bg-white">
            <LibraryList :filter_list="[{ field: 'shop_id', op: 'and', value: id }]" :size="'big'"></LibraryList>
          </div>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <div class=" bg-white">这是111我的内容</div>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    <LibraryPipeManage ref="libraryPipeManageRef" />
  </div>
</template>

<style scoped>

</style>


