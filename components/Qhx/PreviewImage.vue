<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox'
interface Props {
  className?: string,
  list: Array<{ src: string, alt?: string}>
  preview?: Array<string>
}
const emit = defineEmits(['load'])
const visible = ref(false)
const index = ref(0)
const props = withDefaults(defineProps<Props>(), {
})
// const { } = props
const handleClick = (i: number) =>{
  visible.value = true
  index.value = i
}
const load = () => {
  emit('load')
}
</script>
<template>
  <img :src="`${BASE_IMG}${image.src}`" v-for="(image, i) in list" :alt="image.alt || 'Lo研社 嘎嘎'"
      @click="handleClick(i)"
      @load="load"
      :class="props.className ? `${props.className}` : ''"
      loading="lazy" />
  <vue-easy-lightbox
      :visible="visible"
      :imgs="preview && preview.length > 0 ? preview.map(item => BASE_IMG + item) : list.map((item) => { return BASE_IMG + item.src})"
      :index="index"
      :zoomScale="0.4"
      :maxZoom="5"
      @hide="visible = false"
    />
</template>

<style scoped>
.qhx-tags-list{
	background: #fff;
	border-radius: 20px;
	margin: 2px;
	font-size: 12px;
	white-space: nowrap;
	transition: 0.3s;
	display: inline-block;
}
</style>


