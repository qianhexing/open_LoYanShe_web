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
const item = toRef(props, 'item')

const shopUsesAi = computed(() => Number(item.value?.use_ai) === 1)

const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  window.open(`/shop/detail/${id}`, '_blank')
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <!-- mini尺寸 -->
    <div class="flex items-center w-full" v-if="size === 'mini'"
      @click="handleJump(item.shop_id)">
      <div class="shop-logo">
        <img :src="`${BASE_IMG}${item.shop_logo}`" :alt="item.shop_name"
          class="w-4 h-4 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" />
      </div>
      <div class="flex-1 mx-2 text-sm text-gray-600 text-nowrap overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
        <span class="truncate">{{ item.shop_name }}</span>
        <span
          v-if="shopUsesAi"
          class="shop-ai-badge shop-ai-badge--inline shrink-0"
          aria-label="疑似使用AI"
        >AI</span>
      </div>
    </div>
    <div class="flex items-center w-full" v-else-if="size === 'small'">
      <div class="shop-logo relative" @click="handleJump(item.shop_id)">
        <img :src="`${BASE_IMG}${item.shop_logo}`" :alt="item.shop_name"
          class="w-16 h-16 object-cover rounded-[60px] border border-gray-200 my-2 cursor-pointer" loading="lazy" />
        <div
          v-if="shopUsesAi"
          class="shop-ai-badge shop-ai-badge--sm"
          aria-label="疑似使用AI"
        >
          AI
        </div>
      </div>
      <div class="mx-2 cursor-pointer" @click="handleJump(item.shop_id)">
        {{ item.shop_name }}
      </div>
    </div>
    <!-- 大尺寸 -->
    <div v-else-if="size === 'big'">
      <div class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white relative" @click="handleJump(item.shop_id)">
          <img
            :src="`https://lolitalibrary.com/ali/${item.shop_logo}`"
            :alt="item.shop_name"
            class="object-cover w-full h-36 rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
            loading="lazy"
          />
          <div
            v-if="shopUsesAi"
            class="shop-ai-badge shop-ai-badge--lg"
            aria-label="疑似使用AI"
          >
            AI
          </div>
        </div>
        <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 min-h-[70px] relative">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
            {{ item.shop_name }}
          </h3>
          <div class="flex items-center justify-between w-full mt-1">
            <span class="text-xs text-gray-700 opacity-70 group-hover:opacity-100 transition-colors duration-300 flex items-center gap-1 flex-wrap">
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

<style scoped>
.shop-ai-badge {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.85);
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
  box-shadow: 0 1px 8px rgba(239, 68, 68, 0.45);
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

.shop-ai-badge--lg {
  left: 22px;
  top: 22px;
  min-width: 28px;
  padding: 5px 7px;
  border-radius: 8px;
  font-size: 12px;
}

.shop-ai-badge--sm {
  left: 4px;
  top: 10px;
  min-width: 22px;
  padding: 3px 5px;
  border-radius: 7px;
  font-size: 10px;
}

.shop-ai-badge--inline {
  position: static;
  display: inline-flex;
  min-width: 20px;
  padding: 2px 4px;
  border-radius: 5px;
  font-size: 10px;
  box-shadow: 0 1px 4px rgba(239, 68, 68, 0.35);
}
</style>
