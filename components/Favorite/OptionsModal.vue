<!-- 选择收藏夹的模态框 -->
<script setup lang="ts">
import { getFavoriteOptions, insertCollect } from '@/api/collect'
import type { Favorite } from '@/types/api'
const visible = ref(false)
const options = ref<Favorite[]>([])
const loading = ref(false)
const fetch_loading = ref(false)
const pk_id = ref<number | null>(null)
const collect_type = ref<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })
const selectedOptions = ref<number[]>([])
const fetchOptions = async () => {
  if (pk_id.value && collect_type.value) {
    const params = { pk_id: pk_id.value, collect_type: collect_type.value }
    loading.value = true
    try {
      const resault = await getFavoriteOptions(params)
      options.value = resault
      const select: Array<number> = []
      if (resault && resault.length > 0) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        resault.forEach((item) => {
          if (item.is_collect === 1) {
            select.push(item.id)
          }
        })
      }
      selectedOptions.value = select
    } catch (error) {
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
const emit = defineEmits(['change', 'handleClick'])
const fetchInsertCollect = async () => {
  if (loading.value) {
    return
  }
  if (pk_id.value === null) {
    return
  }
  const params = {
    pk_id: pk_id.value,
    ids: selectedOptions.value
  }
  fetch_loading.value = true
  try {
      const resault = await insertCollect(params)
      console.log('返回值', resault)
      emit('change', resault)
      closeModel()
    } catch (error) {
    } finally {
      fetch_loading.value = false
    }
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
    <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
      <div>
        <div v-if="loading" >
          加载中
        </div>
        <div v-else>
          <UCheckbox
            v-for="option in options"
            :key="option.id"
            v-model="selectedOptions"
            :value="option.id"
            :label="option.favorite_name"
            class="px-1 py-2"
            :ui="{ 
              rounded: 'text-qhx-primary cursor-pointer ',
              color: 'qhx-primary',
              label: 'text-[base] cursor-pointer '
            }"
          />
          <UButton 
            type="submit" 
            @click="fetchInsertCollect()"
            block 
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-8"
          >
            收藏
          </UButton>
        </div>
      </div>
    </div>
  </QhxModal>
</template>
