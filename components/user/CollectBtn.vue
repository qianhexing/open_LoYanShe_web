<!-- 互动数据组件 -->
<script setup lang="ts">
import { getFavoriteOptions, isCollect as judgeCollect, insertCollect } from '@/api/collect'
import type FavoriteModel from '~/components/Favorite/OptionsModal.vue'
const user = useUserStore()
interface Props {
  pk_id: number
  pk_type: number
  collect_count?: number
  is_collect?: boolean,
  need_judge?: boolean
  need_axios?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  need_judge: false,
  need_axios: true,
})

// 内部状态
const collectCount = ref(props.collect_count || 0)
const isCollect = ref(props.is_collect || false)
watch(() => props.collect_count, (newVal) => {
  collectCount.value = newVal || 0
})
watch(() => props.is_collect, (newVal) => {
  isCollect.value = newVal
})
const loading = ref(false)
const FavoriteRef = ref<InstanceType<typeof FavoriteModel> | null>(null)
const emit = defineEmits(['change', 'handleClick'])
onMounted(async () => {
  if (props.need_judge && user.token) {
    try {
      const resault = await judgeCollect({
        pk_id: props.pk_id,
        collect_type: props.pk_type.toString()
      })
      isCollect.value = resault
    } catch (error) {
    }
  }
})
// 处理收藏
const toggleLike = async (e: MouseEvent) => {
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
  if (!props.need_axios) {
    emit('handleClick', {
      pk_id: props.pk_id,
      collect_type: props.pk_type,
    })
    return
  }
  FavoriteRef.value?.showModel({
    pk_id: props.pk_id,
    collect_type: props.pk_type
  }, e)
}
const handleChange = (item: boolean) => {
  if (!isCollect.value && item) {
    isCollect.value = true
    collectCount.value += 1
  } else if (isCollect.value && !item) {
    isCollect.value = false
    collectCount.value -= 1
  }
}

</script>
<template>
  <div @click="toggleLike" class=" cursor-pointer inline-block">
    <FavoriteOptionsModal @change="handleChange" ref="FavoriteRef">111</FavoriteOptionsModal>
    <slot :childData="{
      collect_count: isCollect,
      is_collect: isCollect
    }">
      <div class="flex items-center">
        <UIcon name="ant-design:star-filled" class="text-[26px]"
        :class="isCollect ? 'text-[#FFD166]' : 'text-gray-500'" />
        <div class="text-base ml-1">{{ collectCount }}</div>
      </div>
    </slot>
  </div>
</template>

<style scoped></style>
