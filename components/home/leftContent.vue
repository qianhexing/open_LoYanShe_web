<template>
  <div>
    <div class="left-cover w-full  overflow-hidden shadow-md">
      <UCarousel 
        v-slot="{ item }" 
        :items="images" 
        :ui="{ 
          item: 'w-full h-full',
          container: 'h-full',
          indicators: {
            button: {
              color: 'bg-qhx-primary', // 非激活状态颜色
              active: 'bg-qhx-primary' // 激活状态颜色
            }
          }
        }"
        arrows
        indicators
        class="rounded-lg overflow-hidden h-full"
      >
        <img 
          :src="item.src" 
          :alt="item.alt" 
          class="w-full h-full object-cover"
          draggable="false"
        >
      </UCarousel>
		</div>
	</div>
</template>

<script setup lang="ts">
const images = ref([
  { 
    src: 'https://lolitalibrary.com/ali/static/shoplogo/12424_174970502929189.PNG',
    alt: 'Nature 1' 
  },
  { 
    src: 'https://lolitalibrary.com/ali/static/library_app/498_174937755911428.JPG',
    alt: 'Nature 2' 
  }
])
</script>
<style>
.left-cover{
	height: calc(30vw * 9 / 16);
}
</style>