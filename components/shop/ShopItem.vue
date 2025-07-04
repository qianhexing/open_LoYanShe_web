<script setup lang="ts">
import type { Shop } from '@/types/api';
interface Props {
  item: Shop,
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
const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <!-- mini尺寸 -->
    <div class="flex items-center w-full" v-if="size === 'mini'"
      @click="handleJump(item.shop_id)">
      <div class="shop-logo">
        <img :src="`${BASE_IMG}${item.shop_logo}`" :alt="item.shop_name"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" />
      </div>
      <div class="mx-2">
        {{ item.shop_name }}
      </div>
    </div>
    <!-- 大尺寸 -->
    <div v-else-if="size === 'big'">
      <div class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white" @click="handleJump(item.shop_id)">
          <img
            :src="`https://lolitalibrary.com/ali/${item.shop_logo}`"
            :alt="item.shop_name"
            class="object-cover w-full h-36 rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
            loading="lazy"
          />
        </div>
        <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 min-h-[70px] relative">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
            {{ item.shop_name }}
          </h3>
          <div class="flex items-center justify-between w-full mt-1">
            <span class="text-xs text-gray-700 opacity-70 group-hover:opacity-100 transition-colors duration-300 flex items-center gap-1">
              已收录：{{ item.count_library || 0 }}
              <div
                :style="{
                  color: item.shop_country === 0 ? 'red' : 'green'
                }"
                class="text-xs"
              >
                {{ item.shop_country === 0 ? '国牌' : '日牌' }}
              </div>
            </span>
          </div>
        </div>
    </div>
  </div>
</template>

<style scoped></style>