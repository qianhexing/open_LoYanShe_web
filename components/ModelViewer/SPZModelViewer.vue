<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import SPZModelViewerContent from './SPZModelViewerContent.vue'

// 模型项接口（与 SPZModelViewerContent 保持一致）
interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    options?: Record<string, unknown>
}

const show = ref(false)
const modelList = ref<ModelItem[]>([])
const contentRef = ref<InstanceType<typeof SPZModelViewerContent> | null>(null)

// 显示模型弹窗
const showModel = async (models: ModelItem[]) => {
    if (!models || models.length === 0) {
        console.warn('模型列表为空')
        return
    }

    modelList.value = models
    show.value = true
}

// 关闭弹窗
const closeModel = () => {
    show.value = false
    modelList.value = []
}

// 暴露方法
defineExpose({
    showModel
})
</script>

<template>
    <QhxModal v-model="show" @close="closeModel">
        <div class="w-[95vw] max-w-6xl h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <!-- 头部 -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
                <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">
                    嘎
                </h2>
                <button
                    @click="closeModel"
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                    <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 relative overflow-hidden">
                <SPZModelViewerContent
                    ref="contentRef"
                    :model-list="modelList"
                />
            </div>

            <!-- 底部信息 -->
            <div class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>模型数量: {{ modelList.length }}</span>
                    <span v-if="contentRef && contentRef.sceneLoadProgress && contentRef.sceneLoadProgress.total > 0">
                        加载进度: {{ contentRef.sceneLoadProgress.current }} / {{ contentRef.sceneLoadProgress.total }}
                    </span>
                </div>
            </div>
        </div>
    </QhxModal>
</template>
