<script setup lang="ts">
import type { Material } from '@/types/api';
import { useSceneStore } from '@/stores/sence'
import { isGltfGlbModelMaterial } from '@/utils/materiaModelKind'
interface Props {
  item: Material,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  compact?: boolean // 紧凑模式
  /** 不显示标题（如自定义侧栏对图片等）；GLB/GLTF 模型仍会显示标题 */
  hideTitle?: boolean
  deletable?: boolean // 显示删除按钮
  /** 对 GLB/GLTF 显示「修改」入口（标题/封面，不换模型） */
  allowGltfEdit?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
  compact: false,
  hideTitle: false,
  deletable: false,
  allowGltfEdit: false
})
const sceneStore = useSceneStore()
const { size, needJump } = props
const item = props.item
const emit = defineEmits<{
  choose: [el: Material]
  delete: [el: Material]
  'edit-gltf': [el: Material]
}>()
const handleClick = (element: Material) => {
  emit('choose', element)
  // navigateTo(`/shop/detail/${id}`)
}

const showItemTitle = computed(
  () => !props.hideTitle || isGltfGlbModelMaterial(props.item)
)
</script>
<template>
  <div :class="className ? className : 'w-full relative'">
    <div v-if="compact" class="w-full relative flex flex-col items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95" @click="handleClick(item)">
      <button
        v-if="allowGltfEdit && isGltfGlbModelMaterial(item)"
        type="button"
        class="absolute top-0 left-0 z-[2] flex h-5 w-5 items-center justify-center rounded-br-md rounded-tl-md bg-qhx-primary text-white shadow-sm hover:opacity-90 active:scale-95"
        title="修改（标题/封面）"
        aria-label="修改素材"
        @click.stop="emit('edit-gltf', item)"
      >
        <UIcon name="i-heroicons-pencil-square" class="size-3" />
      </button>
      <button
        v-if="deletable"
        type="button"
        class="absolute top-0 right-0 z-[2] flex h-5 w-5 items-center justify-center rounded-bl-md rounded-tr-md bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-95"
        title="删除"
        aria-label="删除"
        @click.stop="emit('delete', item)"
      >
        <UIcon name="i-heroicons-trash" class="size-3" />
      </button>
      <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
        class="object-cover w-[50px] h-[50px] rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
        loading="lazy" />
      <div v-if="showItemTitle" class="w-full px-0.5">
        <h3 class="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate text-center leading-tight">
          {{ item.materia_title }}
        </h3>
      </div>
      <div v-if="sceneStore.loading" class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-md">
        <span class="text-[10px] text-gray-600 dark:text-gray-400">加载中……</span>
      </div>
    </div>
    <div v-else>
      <div class="w-full flex justify-center relative items-center pt-4 px-4 pb-2 bg-white cursor-pointer" @click="handleClick(item)">
        <button
          v-if="deletable"
          type="button"
          class="absolute top-2 right-5 z-[2] flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm hover:bg-red-600"
          title="删除"
          aria-label="删除"
          @click.stop="emit('delete', item)"
        >
          <UIcon name="i-heroicons-trash" class="size-4" />
        </button>
        <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
          class="object-cover w-full  h-[100px] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy" />
      </div>
      <div v-if="showItemTitle" class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
        <h3
          class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
          {{ item.materia_title }}
        </h3>
      </div>
      <div v-if="sceneStore.loading" class="absolute top-0 left-0 w-full h-full bg-white/50 flex items-center justify-center">
          <span class="text-gray-600">加载中……</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>