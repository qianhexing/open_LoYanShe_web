<script setup lang="ts">
import SPZModelViewerContent from '@/components/ModelViewer/SPZModelViewerContent.vue'

// 模型项接口（与 SPZModelViewerContent 保持一致）
interface ModelItem {
    url: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
    type?: 'splat' | 'model'
    options?: Record<string, unknown>
}
import { getLibraryVideoById } from '@/api/library'
import type { LibraryVideo } from '@/types/api'

// 设置页面标题
useHead({
    title: '模型查看器 - Lo研社',
    meta: [
        {
            name: 'description',
            content: 'Lo研社模型查看器'
        }
    ]
})

const layoutReady = inject('layoutReady') as Ref<boolean>
watch(layoutReady, (newVal) => {
    if (newVal) {
        loadVideoData()
    }
})

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

// 视频数据
const libraryVideo = ref<LibraryVideo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// 模型列表
const modelList = ref<ModelItem[]>([])

// 加载视频数据
const loadVideoData = async () => {
    if (!id) {
        error.value = '缺少视频ID'
        return
    }

    try {
        loading.value = true
        error.value = null
        const videoId = Number.parseInt(id)
        libraryVideo.value = await getLibraryVideoById({ video_id: videoId })
        
        // 检查是否是点云类型
        if (libraryVideo.value.pk_type === 2 && libraryVideo.value.addr) {
            // 解析模型地址
            const modelUrls = libraryVideo.value.addr.split(',').filter(url => url.trim())
            modelList.value = modelUrls.map((url, index) => ({
                url: url.trim(),
                type: 'splat' as const,
                position: [index * 3, 0, 0] as [number, number, number],
                options: {
                    useDracoLoader: true,
                    dracoDecoderPath: '/draco/gltf/'
                }
            }))
        } else {
            error.value = '该视频不是点云类型或缺少模型地址'
        }
    } catch (err) {
        console.error('加载视频数据失败:', err)
        error.value = err instanceof Error ? err.message : '加载视频数据失败'
    } finally {
        loading.value = false
    }
}

// 关闭查看器
const handleClose = () => {
    router.back()
}

// 页面加载时获取数据
onMounted(() => {
    if (layoutReady.value) {
        loadVideoData()
    }
})
</script>

<template>
    <div class="fixed inset-0 w-full h-full bg-white z-50">
        <!-- 数据加载中 -->
        <div
            v-if="loading"
            class="w-full h-full flex flex-col items-center justify-center"
        >
            <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
            <p class="mt-4 text-purple-600 tracking-widest font-bold">正在加载数据...</p>
        </div>

        <!-- 数据加载错误 -->
        <div
            v-else-if="error"
            class="w-full h-full flex flex-col items-center justify-center"
        >
            <div class="flex flex-col items-center gap-4">
                <div class="w-16 h-16 flex items-center justify-center">
                    <UIcon name="material-symbols:error-outline" class="text-6xl text-red-500" />
                </div>
                <p class="text-red-600 font-bold text-lg">加载失败</p>
                <p class="text-gray-600 text-sm max-w-md text-center px-4">{{ error }}</p>
                <UButton color="purple" @click="loadVideoData" class="mt-2">
                    重试
                </UButton>
                <UButton color="gray" @click="handleClose" class="mt-2">
                    返回
                </UButton>
            </div>
        </div>

        <!-- threejs 内容区域 -->
        <SPZModelViewerContent
            v-else
            :model-list="modelList"
        />
    </div>
</template>

<style scoped>
#spz-scene-viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
