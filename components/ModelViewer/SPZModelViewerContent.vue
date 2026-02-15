<script setup lang="ts">
import { useSceneCore } from '@/composables/useSceneCore'
import type { SceneObjectJSON, SceneJSON } from '@/utils/threeCore'
import * as THREE from 'three'
import { BASE_IMG } from '@/utils/ipConfig'

// 模型项接口
export interface ModelItem {
    url: string // 模型文件路径
    position?: [number, number, number] // 位置
    rotation?: [number, number, number] // 旋转
    scale?: [number, number, number] // 缩放
    type?: 'splat' | 'model' // 模型类型，默认为 splat
    options?: Record<string, unknown> // 其他选项
}

interface Props {
    modelList: ModelItem[]
}

const props = defineProps<Props>()

// 场景相关状态
const sceneLoading = ref(false)
const sceneLoadProgress = ref({ current: 0, total: 0 })
const sceneLoadError = ref<string | null>(null)

const {
    threeCore,
    initScene,
    disposeScene
} = useSceneCore()

// 监听模型列表变化，自动加载
watch(() => props.modelList, async (newList) => {
    if (newList && newList.length > 0) {
        await nextTick()
        await initThreejs()
    }
}, { immediate: true })

// 初始化场景
const initThreejs = async () => {
    const sceneElement = document.getElementById('spz-scene-viewer')
    if (!sceneElement) return

    try {
        sceneLoading.value = true
        sceneLoadError.value = null

        // 初始化场景
        await initScene(sceneElement, '0', {
            editMode: false,
            baseUrl: BASE_IMG,
            sceneData: null
        })

        // 设置场景背景为白色
        if (threeCore.value) {
            threeCore.value.scene.background = new THREE.Color(0xffffff)
        }

        // 加载模型列表
        if (props.modelList.length > 0 && threeCore.value) {
            await loadModels()
        }

        sceneLoading.value = false
    } catch (error) {
        console.error('初始化场景失败:', error)
        sceneLoadError.value = error instanceof Error ? error.message : '初始化场景失败'
        sceneLoading.value = false
    }
}

// 加载模型列表
const loadModels = async () => {
    if (!threeCore.value || props.modelList.length === 0) return

    try {
        // 将模型列表转换为 SceneJSON 格式
        const sceneJSON: SceneJSON = {
            objects: props.modelList.map((item, index) => {
                const obj: SceneObjectJSON = {
                    type: item.type || 'splat',
                    url: item.url,
                    position: item.position || [index * 3, 0, 0], // 默认横向排列
                    rotation: item.rotation || [0, 0, 0],
                    scale: item.scale || [1, 1, 1],
                    options: item.options || {}
                }
                return obj
            }),
            cameraList: [],
            background: undefined,
            lighting: []
        }

        // 使用 loadSceneFromJSON 加载场景
        const total = sceneJSON.objects.length
        sceneLoadProgress.value = { current: 0, total }

        const onProgress = (current: number, total: number) => {
            sceneLoadProgress.value = { current, total }
        }

        await threeCore.value.loadSceneFromJSON(sceneJSON, false, onProgress)

        // 调整相机视角，让所有模型都在视野内
        if (threeCore.value && props.modelList.length > 0) {
            adjustCamera()
        }
    } catch (error) {
        console.error('加载模型失败:', error)
        sceneLoadError.value = error instanceof Error ? error.message : '加载模型失败'
    }
}

// 调整相机视角
const adjustCamera = () => {
    if (!threeCore.value) return

    // 计算所有模型的包围盒
    const box = new THREE.Box3()
    threeCore.value.scene.traverse((child) => {
        if (child.userData.type === 'splat' || child.userData.type === 'model') {
            if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
                const childBox = new THREE.Box3().setFromObject(child)
                box.union(childBox)
            }
        }
    })

    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2

    // 设置相机位置和目标
    if (threeCore.value.camera instanceof THREE.PerspectiveCamera) {
        threeCore.value.camera.position.set(
            center.x,
            center.y + distance * 0.5,
            center.z + distance
        )
        threeCore.value.camera.lookAt(center)
        threeCore.value.camera.updateProjectionMatrix()
    }

    // 更新控制器目标
    if (threeCore.value.controls) {
        threeCore.value.controls.target.copy(center)
        threeCore.value.controls.update()
    }
}

// 重试加载
const handleRetry = async () => {
    sceneLoadError.value = null
    await initThreejs()
}

// 组件卸载时清理
onUnmounted(() => {
    const sceneElement = document.getElementById('spz-scene-viewer')
    if (sceneElement) {
        disposeScene(sceneElement)
    }
})

// 暴露加载进度和状态
defineExpose({
    sceneLoading,
    sceneLoadProgress,
    sceneLoadError,
    modelCount: computed(() => props.modelList.length)
})
</script>

<template>
    <div class="w-full h-full relative overflow-hidden">
        <!-- 加载状态 -->
        <div
            v-if="sceneLoading || sceneLoadError"
            class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-50"
        >
            <!-- 加载中 -->
            <template v-if="sceneLoading && !sceneLoadError">
                <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
                <p class="mt-4 text-purple-600 tracking-widest font-bold">
                    <span v-if="sceneLoadProgress.total > 0">
                        正在加载模型... {{ sceneLoadProgress.current }} / {{ sceneLoadProgress.total }}
                    </span>
                    <span v-else>
                        正在初始化...
                    </span>
                </p>
            </template>

            <!-- 加载错误 -->
            <template v-else-if="sceneLoadError">
                <div class="flex flex-col items-center gap-4">
                    <div class="w-16 h-16 flex items-center justify-center">
                        <UIcon name="material-symbols:error-outline" class="text-6xl text-red-500" />
                    </div>
                    <p class="text-red-600 font-bold text-lg">加载失败</p>
                    <p class="text-gray-600 text-sm max-w-md text-center px-4">{{ sceneLoadError }}</p>
                    <UButton color="purple" @click="handleRetry" class="mt-2">
                        重试
                    </UButton>
                </div>
            </template>
        </div>

        <!-- 场景容器插槽 -->
        <slot name="scene-viewer">
            <div
                id="spz-scene-viewer"
                class="w-full h-full bg-white"
            ></div>
        </slot>
    </div>
</template>

<style scoped>
#spz-scene-viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
