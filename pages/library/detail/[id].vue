<script setup lang="ts">
import type { Library, PaginationResponse, Shop } from '@/types/api';
import { getLibraryDetail, getLibraryList } from '@/api/library'
import QhxTag from '~/components/common/QhxTag.vue';
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('libraryDeatil', () => {
  return getLibraryDetail({ library_id: Number.parseInt(id) })
}, {})
const library = ref<Library | null>(null)
const shop = ref<Shop | null>(null)
const parent = ref<Library | null>(null)
const child_list = ref<Library[]>([])
library.value = data.value?.library ?? null
console.log('触发更新', library.value?.library_id)

parent.value = data.value?.parent ?? null
shop.value = data.value?.shop ?? null
if (library.value && library.value?.library_type === '系列') {
  const { data } = await useAsyncData('librarys', () => {
    return getLibraryList({
      filter_list: [{
        field: 'parent_id',
        op: 'and',
        value: id
      }],
      page: 1,
      pageSize: 999
    })
  }, {})
  child_list.value = data.value?.rows ?? []
}

interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: library.value ? library.value.name : 'Lolita图鉴',
  meta: [
    {
      name: 'keywords',
      content: `${library.value?.name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
</script>
<template>
  <div class="container mx-auto p-4 max-md:p-2">
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="library.library_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full">
          <img :src="`${BASE_IMG}${library.cover}`" :alt="library.name"
            class=" h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200"
            :class="child_list.length > 0 || parent ? 'ml-3 w-[300px] max-md:w-0 max-md:flex-1' : 'w-full ml-0'"
            loading="lazy" />
          <div class="w-[110px] h-[430px] overflow-y-auto overflow-x-hidden library-list-wrap ml-3"
            v-if="child_list.length > 0 || parent">
            <div class="w-[100px]" v-if="child_list && child_list.length > 0">
              <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in child_list" :key="item.library_id"
                class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                <div
                  class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                  {{ item.library_type }}</div>
                <img :src="`${BASE_IMG}${item.cover}`" :alt="item.name"
                  class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
              </nuxt-link>
            </div>
            <div class="w-[100px]" v-else-if="parent">
              <nuxt-link :to="`/library/detail/${parent.library_id}`"
                class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                <div
                  class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                  {{ parent.library_type }}</div>
                <img :src="`${BASE_IMG}${parent.cover}`" :alt="parent.name"
                  class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
              </nuxt-link>
            </div>
          </div>
        </div>
        <div class="m-2 flex-1">
          <div class="library-info">
            <h1 class="mb-3 text-lg font-semibold">{{ library.name }}</h1>
          </div>
          <!-- 主题 -->
          <div v-if="library.theme" class="mb-1">
            <h3 class="text-sm m-1">主题</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.theme.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 版型/部位 -->
          <div v-if="library.library_pattern" class="mb-1">
            <h3 class="text-sm m-1">版型/部位</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.library_pattern.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 发售时间 -->
          <div v-show="library.sale_time" class="mb-1">
            <h3 class="text-sm m-1">发售时间</h3>
            <p class="text-xs p-2">{{ library.sale_time }}</p>
          </div>

          <!-- 颜色 -->
          <div v-if="library.color" class="mb-1">
            <h3 class="text-sm m-1">颜色</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.color.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 柄图元素 -->
          <div v-if="library.pattern_elements" class="mb-1">
            <h3 class="text-sm m-1">柄图元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.pattern_elements.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- Design Elements -->
          <div v-if="library.design_elements" class="mb-4">
            <h3 class="text-sm m-1">设计元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.design_elements.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>
            <!-- Fabric Composition -->
            <div v-if="library.fabric_composition" class="mb-4">
              <h3 class="text-sm m-1">面料成分</h3>
              <div class="flex flex-wrap gap-2">
                <QhxTag v-for="(tags, index) in library.fabric_composition.split(',')" :key="index"
                  @click="jumpToWiki({ wiki_name: tags.split('%').length > 1 ? tags.split('%')[1] : tags, type_id: 15 })"
                  class="cursor-pointer">
                  {{ tags }}
                </QhxTag>
              </div>
            </div>

            <!-- 主料 -->
            <div v-if="library.cloth_elements" class="mb-4">
              <h3 class="text-sm m-1">主料</h3>
              <div class="flex flex-wrap gap-2">
                <QhxTag v-for="(tags, index) in library.cloth_elements.split(',')" :key="index"
                  @click="jumpToWiki({ wiki_name: tags, type_id: 5 })"
                  class="cursor-pointer">
                  {{ tags }}
                </QhxTag>
              </div>
            </div>

            <!-- 辅料/里衬 -->
            <div v-if="library.secondary_cloth" class="mb-4">
              <h3 class="text-sm m-1">辅料/里衬</h3>
              <div class="flex flex-wrap gap-2">
                <QhxTag v-for="(item, index) in library.secondary_cloth" :key="index"
                  @click="jumpToWiki({ wiki_name: item, type_id: 5 })"
                  class="cursor-pointer">
                  {{ item }}
                </QhxTag>
              </div>
            </div>

            <!-- 笔记 -->
            <div v-show="library.notes" class="mb-4">
              <h3 class="text-sm m-1">笔记</h3>
              <div class="text-xs p-2" v-html="library.notes"></div>
            </div>


            <!-- 尺码 -->
            <div v-show="library.size" class="mb-4">
              <h3 class="text-sm m-1">尺码</h3>
              <p class="text-xs p-2">{{ library.size }}</p>
            </div>
          </div>
        </div>
        <div v-if="shop" class="p-3 px-6">
          <ShopItem :item="shop" size="small"></ShopItem>
        </div>
      </div>
    </div>
</template>

<style scoped>
.library-list-wrap::-webkit-scrollbar {
  width: 6px;
  /* 垂直滚动条宽度 */
}

/* 滚动条轨道 */
.library-list-wrap::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
}

/* 滚动条滑块 */
.library-list-wrap::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

/* 滚动条滑块悬停状态 */
.library-list-wrap::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>
