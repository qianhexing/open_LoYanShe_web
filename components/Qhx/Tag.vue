<script setup lang="ts">
interface Props {
  className?: string
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  active?: boolean
  backgroundColor?: string
  /** 自定义主题按钮底色（如 wardrobe custom_style.btnColor） */
  btnColor?: string
  /** 自定义主题按钮文字色（如 custom_style.btnFontColor） */
  btnFontColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  active: false
})
const { size, active } = toRefs(props)

const useCustomBtn = computed(() => Boolean(props.btnColor || props.btnFontColor))

const rootClass = computed(() => {
  if (props.className) {
    return `${props.className} qhx-tags-list`
  }
  if (!useCustomBtn.value) {
    return `qhx-tags-list border-qhx-primary border bg-qhx-bg-card px-2 py-1 
    ${active.value ? 'bg-qhx-primary text-qhx-inverted' : 'bg-qhx-inverted text-qhx-primary' }`
  }
  if (active.value && !props.btnColor) {
    return 'qhx-tags-list border px-2 py-1 border-qhx-primary border bg-qhx-bg-card bg-qhx-primary text-qhx-inverted'
  }
  if (active.value && props.btnColor) {
    return 'qhx-tags-list border px-2 py-1'
  }
  // 未激活：与无自定义时一致，用默认主色描边/字色示意
  return 'qhx-tags-list border-qhx-primary border bg-qhx-bg-card px-2 py-1 bg-qhx-inverted text-qhx-primary'
})

const rootStyle = computed(() => {
  const s: Record<string, string> = {}
  if (props.backgroundColor && !useCustomBtn.value) {
    s.backgroundColor = props.backgroundColor
  }
  if (!useCustomBtn.value) return s

  // 仅激活态套用自定义 btn 色；未激活样式由 rootClass 默认主色承担
  if (props.active) {
    if (props.btnColor) {
      s.backgroundColor = props.btnColor
      s.borderColor = props.btnColor
    }
    if (props.btnFontColor) s.color = props.btnFontColor
  }
  return s
})
</script>
<template>
  <div :class="rootClass" :style="rootStyle">
    <div v-if="size === 'mini'">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.qhx-tags-list {
  border-radius: 20px;
  margin: 2px;
  font-size: 12px;
  /* white-space: nowrap; */
  transition: 0.3s;
  display: inline-block;
}
</style>
