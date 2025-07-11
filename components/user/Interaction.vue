<!-- 互动数据组件 -->
<script setup lang="ts">
import { insertGood } from '@/api/good'
interface ListProps {
  good_count?: number
  is_good?: boolean
  collect_count?: number
  is_collect?: boolean
  wardrobe_count?: number
  is_wardrobe?: boolean
}
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  dataMap: ListProps
  pk_id: number
  pk_type: number
  need_load: boolean // 是否需要加载操作数据
  disabled: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  disabled: false, // 是否禁用
  need_load: false, // 是否需要请求判断数据
  need_axios: true // 点击是否需要请求
})

// 内部状态
const goodCount = ref(props.dataMap.good_count)
const isGood = ref(props.dataMap.is_good || false)
const loading = ref(false)
const emit = defineEmits(['goodChange'])
// 处理点赞/取消点赞
const toggleLike = async () => {
  if (props.disabled || loading.value) return
  
  loading.value = true
  
  try {
    const resault = await insertGood({
      pk_id: props.pk_id,
      pk_type: props.pk_type,
      type: 0 // 假设1表示点赞
    })
    
    if (resault) {
      if (goodCount.value) {
        goodCount.value += goodCount.value 
        emit('goodChange', { count: goodCount.value })
      }
      
    } else {
      if (goodCount.value) {
        goodCount.value -=goodCount.value 
        emit('goodChange', { count: goodCount.value })
      }
    }
    
    isGood.value = resault
  } catch (error) {
    console.error('点赞操作失败:', error)
  } finally {
    loading.value = false
  }
}

</script>
<template>
  <div :class="props.className ? `${props.className}` :''">
    <div v-if="size === 'mini'" class="w-full h-[40px] flex">
      <div
        
        :variant="isGood ? 'solid' : 'ghost'"
        :loading="loading"
        :class="[className, isGood ? 'bg-red-50 hover:bg-red-100' : '']"
        @click="toggleLike"
      >
        <UIcon
          :name="isGood ? 'i-heroicons-heart-20-solid' : 'i-heroicons-heart-20-solid'"
          :class="isGood ? 'text-red-500' : 'text-gray-500'"
        />
        <span v-if="size !== 'mini'" class="ml-1">{{ goodCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>


