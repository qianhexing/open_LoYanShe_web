<template>
  <div class="middle-content-container mx-[10px]">
    <!-- 左侧内容 -->
    <div class="content-section">
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
                    color: 'bg-qhx-primary',
                    active: 'bg-qhx-primary'
                  }
                }
              }" arrows indicators class="rounded-lg overflow-hidden h-full">
              <img :src="BASE_IMG + item.swiper_cover" :alt="item.alt" class="w-full left-cover object-cover"
                draggable="false">
            </UCarousel>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧内容 -->
    <div class="content-section">
      <div class="items-center flex-wrap h-full flex">
        <div class="w-full mb-3 home-about shadow-lg">
          <div class="px-2 py-3 bg-qhx-bg-card text-qhx-textBg rounded-[18px]">
            <h3 class="text-center">一个Lolita Fashion服饰数据库</h3>
            <div class="text-center">
              <p class="p-2">合作可以联系QQ 3292658709</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Swiper, Icon } from '@/types/api';
import { getSwiper, getHomeIcon } from '@/api/index';

const images = ref<Swiper[]>([]);
const home_icon = ref<Icon[]>([]);

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
.middle-content-container {
  /* height: 100vh; */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
  position: relative;
}

.content-section {
  margin-bottom: 30px;
  width: 100%;
}

.content-section:last-child {
  margin-bottom: 0;
}

.home-icon-wrap {
  height: calc(90vw * 5 / 16);
  min-height: 80px;
  max-height: 200px;
}

.left-cover {
  height: calc(90vw * 9 / 16);
  min-height: 150px;
  max-height: 400px;
}

.scrollbar-hide-x {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide-x::-webkit-scrollbar {
  display: none;
}
</style>

