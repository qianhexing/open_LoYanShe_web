<template>
  <div class="flex items-center flex-wrap h-full">
    <div>
      <div class="overflow-x-auto w-full home-icon-wrap mb-3"></div>
      <div class="left-cover w-full  overflow-hidden shadow-lg">
        <UCarousel v-if="images.length > 0" v-slot="{ item }" :items="images" :autoplay="true" :autoplay-interval="3000"
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
      icon_belong: 1
    }
    return getHomeIcon(params)
  });
  images.value = swiperData.value || [];
  home_icon.value = iconData.value || [];
})
</script>
<style scoped>
.home-icon-wrap {
  height: calc(20vw * 5 / 16);
  background: #000;
}

.left-cover {
  height: calc(20vw * 9 / 16);
}
</style>