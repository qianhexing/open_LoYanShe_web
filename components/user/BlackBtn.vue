<!-- 拉黑按钮 -->
<script setup lang="ts">
// import { insertGood, isGood as judgeGood } from '@/api/good'
import { insertBlack, isBlack as judgeBlack } from '@/api/black_list'

interface Props {
  pk_id: number
  pk_type: number
  black_count?: number
  is_black?: boolean,
  need_judge?: boolean
  need_axios?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  need_judge: false,
  need_axios: true,
})

// 内部状态
const blackCount = ref(props.black_count || 0)
const isBlack = ref(props.is_black || false)
const isOpen = ref(false)


const loading = ref(false)
const emit = defineEmits(['change', 'handleClick'])
const user = useUserStore()
onMounted(async () => {
  if (props.need_judge && user.token) {
    try {
      const resault = await judgeBlack({
        balck_user: props.pk_id,
        pk_type: props.pk_type,
      })
      isBlack.value = resault
    } catch (error) {
      console.error('操作失败:', error)
    }
  }
})
const confirm = () =>{
  toggle()
}
const handelClick = () => {
  if (!isBlack.value) {
    isOpen.value = true
  } else {
    toggle()
  }
}
// 处理点赞/取消点赞
const toggle = async () => {
  console.log(user.token)
  if (!user.token) {
    return
  }
  if (!props.need_axios) {
    emit('handleClick', {
      pk_id: props.pk_id,
      pk_type: props.pk_type
    })
    return
  }
  
  if (loading.value) return
  loading.value = true

  try {
    const resault = await insertBlack({
      balck_user: props.pk_id,
      pk_type: props.pk_type,
    })

    if (resault) {
      blackCount.value += 1
      emit('change', { count: blackCount.value })
    } else {
      blackCount.value -= 1
      emit('change', { count: blackCount.value })
    }

    isBlack.value = resault
    isOpen.value = false
  } catch (error) {
    console.error('操作失败:', error)
  } finally {
    loading.value = false
  }
}
defineExpose({
  blackCount
})
</script>
<template>
  <div @click="handelClick" class=" cursor-pointer inline-block">
    <slot :childData="{
      black_count: blackCount,
      is_black: isBlack
    }">
      <div class="flex items-center">
        <UIcon :name="isBlack ? 'gravity-ui:thumbs-down-fill' : 'gravity-ui:thumbs-down-fill'" class=" text-[26px]"
        :class="isBlack ? 'text-[#f56c6c]' : 'text-gray-500'" />
        <div class="text-base ml-1">{{ blackCount }}</div>
      </div>
    </slot>
  </div>
  <UModal v-model="isOpen">
      <div class="p-4">
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          确定要拉黑吗？
        </p>
        
        <div class="mt-4 flex justify-end space-x-3">
          <UButton
            label="取消"
            color="gray"
            variant="ghost"
            @click="isOpen = false"
          />
          <UButton
            label="确认"
            color="red"
            @click="confirm"
          />
        </div>
      </div>
    </UModal>
</template>

<style scoped></style>
