<script setup lang="ts">
interface Props {
  className?: string,
  loading: boolean
	page?: number
	total?: number
	pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
})
const emit = defineEmits(['loadMore'])
const loadMore = () => {
	emit('loadMore')
}
const { page, pageSize, total } = toRefs(props)
</script>
<template>
  <div :class="props.className ? `${props.className}` :'w-full flex justify-center'" v-if="loading">
    <div>加载中……</div>
  </div>
	<div v-else-if="page && total && pageSize && page < Math.ceil(total / pageSize)" class="flex justify-center">
		<div class=" inline-block cursor-pointer" @click="loadMore">
			加载更多
		</div>
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


