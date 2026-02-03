<script setup lang="ts">
import type { Compilations } from '@/types/api';
interface Props {
  item: Compilations,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  showEdit?: boolean // 是否显示编辑按钮
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
  showEdit: false
})
const emit = defineEmits<{
  edit: [event: MouseEvent]
  delete: [event: MouseEvent]
}>()
const { size, needJump, showEdit } = props
const item = props.item
const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  window.open(`/compilations/detail/${id}`, '_blank')
  // navigateTo(`/compilations/detail/${id}`)
}
const handleEdit = (event: MouseEvent) => {
  event.stopPropagation()
  emit('edit', event)
}
const handleDelete = (event: MouseEvent) => {
  event.stopPropagation()
  emit('delete', event)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <!-- mini尺寸 -->
    <div class="flex items-center w-full" v-if="size === 'mini'" @click="handleJump(item.comp_id)">
      <div class="shop-logo">
        <img :src="`${BASE_IMG}${item.comp_cover}`" :alt="item.comp_name || 'lolita合集'"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" />
      </div>
      <div class="mx-2">
        {{ item.comp_name }}
      </div>
    </div>
    <div class="flex items-center w-full" v-else-if="size === 'small'">
      <div class="shop-logo" @click="handleJump(item.comp_id)">
        <img :src="`${BASE_IMG}${item.comp_cover}`" :alt="item.comp_name || 'lolita合集'"
          class="w-16 h-16 object-cover rounded-[60px] border border-gray-200 my-2 cursor-pointer" loading="lazy" />
      </div>
      <div class="mx-2 cursor-pointer" @click="handleJump(item.comp_id)">
        {{ item.comp_name }}
      </div>
    </div>
    <!-- 大尺寸 -->
    <div v-else-if="size === 'big'">
      <div class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white relative"
        @click="handleJump(item.comp_id)">
        <img :src="`https://lolitalibrary.com/ali/${item.comp_cover || 'static/plan_cover/default.jpg'}`" :alt="item.comp_name || 'lolita合集'"
          class="object-cover w-full aspect-[16/9] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy" />
        <!-- 编辑和删除按钮 -->
        <div v-if="showEdit" class="absolute top-6 right-6 flex items-center gap-2 z-10">
          <button
            @click="handleEdit"
            class="w-10 h-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110"
            title="编辑合集"
          >
            <UIcon name="i-heroicons-pencil" class="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            @click="handleDelete"
            class="w-10 h-10 bg-red-500/90 dark:bg-red-600/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 dark:hover:bg-red-600 transition-all duration-200 hover:scale-110"
            title="删除合集"
          >
            <UIcon name="i-heroicons-trash" class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 min-h-[70px] relative">
        <h3
          class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
          {{ item.comp_name }}
        </h3>
        <div class="flex items-center justify-between w-full mt-1">
          <!-- <span class="text-xs text-gray-700 opacity-70 group-hover:opacity-100 transition-colors duration-300 flex items-center gap-1">
              已收录：{{ item.count_library || 0 }}
              <div
                :style="{
                  color: item.shop_country === 0 ? 'red' : 'green'
                }"
                class="text-xs"
              >
                {{ item.shop_country === 0 ? '国牌' : '日牌' }}
              </div>
            </span> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>