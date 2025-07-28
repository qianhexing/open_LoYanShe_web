<script setup lang="ts">
import type { Community, PaginationResponse, User } from '@/types/api';
import { getCommunityDetail } from '@/api/community'
const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('communityDeatil', () => {
  return getCommunityDetail({ community_id: Number.parseInt(id) })
}, {})
const detail = ref<Community | null>(null)
const libraryRef = ref(null)
const richText = ref<RichNode[] | null>(null)
detail.value = data.value



onMounted(() => {
  if (detail.value?.content) {
    richText.value = parseRichText(detail.value.content)
  }
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: detail.value ? detail.value.title : 'Lolita图鉴',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.title} Lo研社,Lolita图鉴,Lolita图书馆`
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
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg flex max-md:block" :key="detail.community_id">
      <div class="w-[700px] max-md:w-full p-3 aspect-[3/4]" v-if="detail.img_list">
        <UCarousel  v-slot="{ item }" :items="detail.img_list.split(',')"
          :autoplay="{ delay: 3000 }" :ui="{
            item: 'w-[700px] aspect-[3/4] max-md:w-full',
            container: 'h-full',
            indicators: {
              button: {
                color: 'bg-qhx-primary', // 非激活状态颜色
                active: 'bg-qhx-primary' // 激活状态颜色
              }
            }
          }" arrows indicators class="rounded-lg overflow-hidden">
          <img :src="BASE_IMG + item" :alt="detail.title || 'Lo研社'"
            class="w-full aspect-[3/4] left-cover object-contain" draggable="false">
        </UCarousel>
      </div>
      <div class="flex-1">
        <div class="p-3 flex max-md:block max-md:px-1">
          <div class=" font-semibold">
            {{ detail.title }}
          </div>
        </div>
        <UserInfo class="p-3" v-if="detail.user" :user="detail.user"></UserInfo>
        <div class="p-3 max-md:px-1">
          <div v-if="richText" class=" leading-[1.8]">
            <SafeRichText :nodes="richText"></SafeRichText>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['评论区']">
        <QhxTabPanel :index="0">
          <template #default="{ isActive }">
            <div class="bg-white">
              <CommentSection :type="'community'" :id="detail.community_id" :can_load="isActive"/>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
  </div>
</template>

<style scoped></style>
