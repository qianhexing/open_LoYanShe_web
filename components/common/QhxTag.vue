<script setup lang="ts">
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
})
const { size } = props
</script>
<template>
  <div :class="props.className ? `${props.className} qhx-tags-list` :'qhx-tags-list border-qhx-primary border text-qhx-primary bg-qhx-bg-card px-2 py-1'">
    <div v-if="size === 'mini'">
        <slot></slot>
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


