<script setup lang="ts">
interface Props {
  className?: string,
  loading: boolean
}

const props = withDefaults(defineProps<Props>(), {
})
// const {  } = props
</script>
<template>
  <div :class="props.className ? `${props.className}` :'w-full flex justify-center'" v-if="loading">
    <div>加载中……</div>
  </div>
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


