<template>
  <div class="flex items-center flex-wrap h-full">
    <div>
      <!-- 隐藏滚动条 -->
      <div class="overflow-x-auto w-full home-icon-wrap mb-3 rounded-[18px] scrollbar-hide-x flex align-center">
        <div v-for="item in home_icon" :key="item.icon_id" class=" mx-2 cursor-pointer" @click="handleIconClick(item)">
          <img :src="BASE_IMG + item.icon_cover" :alt="item.icon_name" class="w-[50px] h-[50px] mt-2 object-cover mx-auto"></img>
          <div class="text-center text-sm overflow-hidden text-ellipsis whitespace-nowrap mt-2">{{ item.icon_name }}</div>
        </div>
      </div>
      <div class="left-cover w-full  overflow-hidden shadow-lg rounded-[18px]">
        <UCarousel v-if="images.length > 0" v-slot="{ item }" :items="images" :autoplay="{ delay: 3000 }"
          :ui="{
            item: 'w-full h-full s',
            container: 'h-full',
            indicators: {
              button: {
                color: 'bg-qhx-primary', // 非激活状态颜色
                active: 'bg-qhx-primary' // 激活状态颜色
              }
            }
          }" arrows indicators class="rounded-lg overflow-hidden h-full">
          <img :src="BASE_IMG + item.swiper_cover" :alt="item.alt" class="w-full left-cover object-cover"
            draggable="false">
        </UCarousel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Swiper, Icon } from '@/types/api';
import { getSwiper, getHomeIcon } from '@/api/index';
const images = ref<Swiper[]>([]);
const home_icon = ref<Icon[]>([]);
const count = ref(1);
onMounted(async () => {
  const { data: swiperData } = await useAsyncData('swiper', getSwiper);
  const { data: iconData } = await useAsyncData('icon', () => {
    const params = {
      icon_belong: 4
    }
    return getHomeIcon(params)
  });
  images.value = swiperData.value || [];
  home_icon.value = iconData.value || [];
})
const handleIconClick = (item: Icon) => {
  window.open(item.link);
}
</script>
<style scoped>
.home-icon-wrap {
  height: calc(20vw * 5 / 16);
  /* background: #000; */
}

.left-cover {
  height: calc(20vw * 9 / 16);
}
</style>