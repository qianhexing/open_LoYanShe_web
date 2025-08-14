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
    
  </div>
</template>

<style scoped>

</style>


