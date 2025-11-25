<script setup lang="ts">
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  active: false
})
const { size, active } = toRefs(props)
</script>
<template>
  <div :class="props.className ? `${props.className} qhx-tags-list` :`qhx-tags-list border-qhx-primary border bg-qhx-bg-card px-2 py-1 ${active ? 'bg-qhx-primary text-qhx-inverted' : 'bg-qhx-inverted text-qhx-primary' }`">
    <div v-if="size === 'mini'">
        <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.qhx-tags-list{
	border-radius: 20px;
	margin: 2px;
	font-size: 12px;
	/* white-space: nowrap; */
	transition: 0.3s;
	display: inline-block;
}
</style>


