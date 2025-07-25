<script setup lang="ts">
import type { Study, PaginationResponse } from '@/types/api';
import { getStudyId } from '@/api/study'

const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('studyDeatil', () => {
  return getStudyId({ study_id: Number.parseInt(id) })
}, {})
const detail = ref<Study | null>(null)
detail.value = data.value ?? null
useHead({
  title: detail.value ? detail.value.study_title : 'Lolita研习',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.study_title} Lo研社,Lolita文化研究,Lolita图书馆`
    },
    {
      name: 'description',
      content: 'Lolita文化研究,Lolita图书馆'
    }
  ]
})
</script>
<template>
  <div class="container mx-auto p-4">
    <div v-if="detail && detail.child" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="detail.child.map((item) => { return item.study_title })">
        <QhxTabPanel :index="index" v-for="(item, index) in detail.child" :key="index">
          <template #default="{ isActive, firstLoading }">
            <div v-if="firstLoading" class="w-full">
              <StudyForeignList :isActive="isActive" :keyName="index" :study_id="item.study_id" :key="index"></StudyForeignList>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
  </div>
</template>

<style scoped>

</style>


