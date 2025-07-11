<!-- 选择收藏夹的模态框 -->
<script setup lang="ts">
import { getFavoriteOptions } from '@/api/collect'
import type { Favorite } from '@/types/api'
const visible = ref(false)
const options = ref<Favorite[]>([])
const loading = ref(false)
const pk_id = ref<number | null>(null)
const collect_type = ref<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })
const fetchOptions = async () => {
  if (pk_id.value && collect_type.value) {
    const params = { pk_id: pk_id.value, collect_type: collect_type.value }
    loading.value = true
    try {
      const resault = await getFavoriteOptions(params)
      options.value = resault
    } catch (error) {
      console.error('获取失败:', error)
    } finally {
      loading.value = false
    }
  }
}
const showModel = (item: { pk_id: number, collect_type: number }, e: MouseEvent) => {
  clickPosition.value = {
    x: e.clientX, y: e.clientY
  }
  visible.value = true
  pk_id.value = item.pk_id
  collect_type.value = item.collect_type
  fetchOptions()
}
const closeModel = () => {
  visible.value = false
  pk_id.value = null
  collect_type.value = null
  options.value = []
}
defineExpose({
  showModel, closeModel
})
</script>

<template>
  <!-- <UModal v-model="visible" :close="true" title="Modal with footer" description="This is useful when you want a form in a Modal." :ui="{ footer: 'justify-end' }">
    <UButton label="Open"  />
  </UModal> -->

  <QhxModal v-model="visible" :trigger-position="clickPosition">
    <div class="p-6 w-[400px] bg-white rounded-[10px]">
      <div>
        <div v-if="loading" >
          加载中
        </div>
        <div v-else>
          {{ options.length }}
        </div>
      </div>
    </div>
  </QhxModal>
</template>
