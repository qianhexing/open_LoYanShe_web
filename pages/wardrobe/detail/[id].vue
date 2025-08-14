<script setup lang="ts">
import type { Wardrobe, PaginationResponse } from '@/types/api';
import { getWardrobeList } from '@/api/wardrobe'

import type { UserBlackBtn, UserGoodBtn } from '#components';
const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const fetchWardrobeList = async () => {
   const response = await getWardrobeList({
    user_id: id,
    pageSize: 999
  })
  console.log(response, '衣柜返回值')
} 
onMounted(() => {
  fetchWardrobeList()
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
    }
  ]
})
</script>
<template>
  <div class="">
    <div class="bg-qhx-bg-card rounded-lg shadow-lg">
      正在建设
    </div>
  </div>
</template>

<style scoped>

</style>


