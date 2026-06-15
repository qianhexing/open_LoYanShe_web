<script setup lang="ts">
import type { Wardrobe } from '@/types/api';
import { openWardrobeDetail } from '@/composables/useLibraryDetailNavigation'

interface Props {
  item: Wardrobe,
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const emit = defineEmits(['imageLoad'])
const props = withDefaults(defineProps<Props>(), {
  size: 'big',
  needJump: true
})
// 响应式变量
const size = toRef(props, 'size')
const { needJump } = props
const item = props.item
const imageLoad = () => {
  emit('imageLoad')
}
const handleJump = (item: Wardrobe) => {
  if (!needJump || !item.wardrobe_id || !item.user_id) return
  openWardrobeDetail({
    userId: item.user_id,
    wardrobeId: item.wardrobe_id,
  })
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" @click="handleJump(item)">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
        :alt="item.wardrobe_name" class="w-full rounded-[10px] border border-gray-200 my-2" loading="lazy" />
      <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
        {{ item.wardrobe_name }}
      </h3>
    </div>
    <div v-else-if="size === 'list'" @click="handleJump(item)" class="flex items-center">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
        :alt="item.wardrobe_name" class="w-[100px] h-[100px] rounded-[10px] object-cover" loading="lazy" />
      <div class="mx-1 flex-1">
        <h3 class="text-base truncate w-full transition-colors duration-300">
          {{ item.wardrobe_name }}
        </h3>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
