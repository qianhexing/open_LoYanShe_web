<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox'

interface Image {
  src: string, alt?: string, title?: string
}
interface Props {
  className?: string,
  list: Array<Image>
  preview?: Array<string> | Image[]
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
      loading="lazy"><slot></slot></img>
  <vue-easy-lightbox
      :visible="visible"
      :imgs="preview && preview.length > 0 ? preview.map(item => {
        if (typeof item === 'string') {
          return { src: BASE_IMG + item || '' }
        }
        return { src: BASE_IMG + item.src || '', title: item.title }
      }) 
      :list.map((item) => { return { src: BASE_IMG + item.src || '', title: item.title || '' }})"
      :index="index"
      append-to-body
      :teleport="'body'"
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


