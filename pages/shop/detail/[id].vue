<script setup lang="ts">
import type { Shop, PaginationResponse } from '@/types/api';
import { getShopDetail } from '@/api/shop';
const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('shopDeatil', () => {
  return getShopDetail({ shop_id: Number.parseInt(id) })
}, {})
const detail = ref<Shop | null>(null)
const shop = ref<Shop | null>(null)
detail.value = data.value ?? null

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
</script>
<template>
  <div class="container mx-auto p-4">
    <div v-if="detail" ref="libraryRef" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="detail.shop_id">
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
          <!-- 主营风格 -->
          <div v-if="detail.style_list" class="mb-1">
            <h3 class="text-sm m-1">主营风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主营类型 -->
          <div v-if="detail.style_list" class="mb-1">
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
  </div>
</template>

<style scoped>

</style>


