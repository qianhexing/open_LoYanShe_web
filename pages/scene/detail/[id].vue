<script setup lang="ts">
import type { Compilations, PaginationResponse } from '@/types/api';
import { getCompById, getCompDetailList } from '@/api/compilations'

import type { UserBlackBtn, UserGoodBtn } from '#components';
const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('compDeatil', () => {
  return getCompById({ comp_id: Number.parseInt(id) })
}, {})
const detail = ref<Compilations | null>(null)
const goodBtn = ref<InstanceType<typeof UserGoodBtn> | null>(null)
const blackBtn = ref<InstanceType<typeof UserBlackBtn> | null>(null)

detail.value = data.value ?? null
console.log('获取到的合集详情', data.value)
useHead({
  title: detail.value ? detail.value.comp_name : 'Lolita合集',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.comp_name} Lo研社,Lolita合集,Lolita图书馆`
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
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="detail.comp_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] aspect-[16/9] max-md:w-full relative">
          <QhxPreviewImage :key="detail.comp_id" :list="[{ src: detail.comp_cover || 'static/plan_cover/default.jpg', alt: detail.comp_name || 'Lo研社 合集' }]" 
          :className="'cursor-pointer w-full ml-0 aspect-[16/9] object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
        </div>
        <div class="m-2 flex-1">
          <div>
            <h1 class="mb-3 text-lg font-semibold">{{ detail?.comp_name }}</h1>
          </div>
          <h3 class="text-sm m-1" v-html="detail.comp_describe" v-if="detail.comp_describe"></h3>
          <div>
            <QhxTag>
              {{ detail.pk_type === 0 ? '图鉴合集' : '搭配合集'}}
            </QhxTag>
          </div>
        </div>
      </div>
    </div>

    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['图鉴']">
        <QhxTabPanel :index="0">
          <QhxWaterList 
            :fetch-data="async (page, pageSize) => {
              const response = await getCompDetailList({ page, pageSize, comp_id: Number.parseInt(id) })
              return {
                rows: response.rows,
                count: response.count
              }
            }" 
            :columns="4"
            :columns_768="1"
          >
            <template #default="{ item, debouncedApplyLayout }">
              <!-- 自定义内容 -->
              <div class="custom-item">
                <div v-if="item.library">
                  <LibraryItem :item="item.library" @imageLoad="debouncedApplyLayout"></LibraryItem>
                </div>
              </div>
            </template>
          </QhxWaterList>
        </QhxTabPanel>
      </QhxTabs>
    </div>
  </div>
</template>

<style scoped>

</style>


