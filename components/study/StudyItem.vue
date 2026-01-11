<script setup lang="ts">
  const router = useRouter()
import type { Study } from '@/types/api';
interface Props {
  item: Study,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true
})
const { size, needJump } = props
const item = props.item
const handleJump = (ele: Study) => {
  if (!needJump) {
    return
  }
  console.log(item, '点击到的板块')
  if (item.study_type === 2) {
    window.open(item.study_url)
  } else if (item.study_type === 1) {
    const toast = useToast()
    toast.add({
      title: '错误',
      description:  '暂时只支持APP端',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } else {
    // window.open(`/study/detail/${item.study_id}`, '_blank')
    router.push(`/study/detail/${item.study_id}`)
  }
  // window.open(`/study/detail/${id}`, '_blank')
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <!-- mini尺寸 -->
    <div class=" text-center w-full cursor-pointer" v-if="size === 'mini'"
      @click="handleJump(item)">
      <div>
        <img :src="`${BASE_IMG}${item.study_cover || 'static/plan_cover/default.jpg'}`" :alt="item.study_title"
          class="w-[60px] h-[60px] rounded-[10px] shadow-sm object-cover border border-gray-200 my-2 mx-auto" loading="lazy" />
      </div>
      <div class="mx-2">
        {{ item.study_title }}
      </div>
    </div>
  </div>
</template>

<style scoped></style>