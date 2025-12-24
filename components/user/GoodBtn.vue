<!-- 互动数据组件 -->
<script setup lang="ts">
import { insertGood, isGood as judgeGood } from '@/api/good'

interface Props {
  pk_id: number
  pk_type: number
  good_count?: number
  is_good?: boolean,
  need_judge?: boolean
  need_axios?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  need_judge: false,
  need_axios: true,
})

// 内部状态
const goodCount = ref(props.good_count || 0)
watch(() => props.good_count, (newVal) => {
  goodCount.value = newVal || 0
})
// 响应式数据
const isGood = ref(props.is_good || false)
watch(() => props.is_good, (newVal) => {
  isGood.value = newVal
})
const loading = ref(false)
const emit = defineEmits(['change', 'handleClick'])
const user = useUserStore()
onMounted(async () => {
  if (props.need_judge && user.token) {
    try {
      const resault = await judgeGood({
        pk_id: props.pk_id,
        pk_type: props.pk_type,
        type: 0 // 假设1表示点赞
      })
      isGood.value = resault
    } catch (error) {
      console.error('点赞操作失败:', error)
    }
  }
})
// 处理点赞/取消点赞
const toggleLike = async () => {
  console.log(user.token)
  if (!user.token) {
    const toast = useToast()
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  console.log('走到这了111')
  if (!props.need_axios) {
    console.log('走到这了', props.need_axios)
    emit('handleClick', {
      pk_id: props.pk_id,
      pk_type: props.pk_type,
      type: 0 // 假设1表示点赞
    })
    return
  }
  
  if (loading.value) return
  loading.value = true

  try {
    const resault = await insertGood({
      pk_id: props.pk_id,
      pk_type: props.pk_type,
      type: 0 // 假设1表示点赞
    })

    if (resault) {
      goodCount.value += 1
      emit('change', { count: goodCount.value })
    } else {
      goodCount.value -= 1
      emit('change', { count: goodCount.value })
    }

    isGood.value = resault
  } catch (error) {
    console.error('点赞操作失败:', error)
  } finally {
    loading.value = false
  }
}
defineExpose({
  goodCount
})
</script>
<template>
  <div @click="toggleLike" class=" cursor-pointer inline-block">
    <slot :childData="{
      good_count: goodCount,
      is_good: isGood
    }">
      <div class="flex items-center">
        <UIcon :name="isGood ? 'i-heroicons-heart-20-solid' : 'i-heroicons-heart-20-solid'" class=" text-[26px]"
        :class="isGood ? 'text-[#409EFF]' : 'text-gray-500'" />
        <div class="text-base ml-1">{{ goodCount }}</div>
      </div>
    </slot>
  </div>
</template>

<style scoped></style>
