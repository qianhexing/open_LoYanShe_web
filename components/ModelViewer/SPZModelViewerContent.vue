<script setup lang="ts">
import { useSceneCore } from '@/composables/useSceneCore'
import type { SceneObjectJSON, SceneJSON } from '@/utils/threeCore'
import type { LaxianInterface } from '@/types/sence'
import * as THREE from 'three'
import { BASE_IMG } from '@/utils/ipConfig'
import type { LaxianItem } from '@/types/api'

// 模型项接口
export interface ModelItem {
    url: string // 模型文件路径
    position?: [number, number, number] // 位置
    rotation?: [number, number, number] // 旋转
    scale?: [number, number, number] // 缩放
    type?: 'splat' | 'model' // 模型类型，默认为 splat
    /** Spark 2.0：`type === 'splat'` 时仅 `fileType`、`maxSplats`、`maxSh`、`mobileOptimized` 传入 ThreeCore.loadSplat；勿传 GLTF 的 useDracoLoader。 */
    options?: Record<string, unknown> // 其他选项
}


interface Props {
    modelList: ModelItem[]
    /** 拉线点数组，有数据时会加入场景 objects */
    laxianList?: LaxianItem[]
    /** 是否开启自动旋转 */
    autoRotate?: boolean
    /** 编辑模式：拉线列表变更时不触发全量重载，由外部调用 addLaxianToScene 等 */
    editMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    autoRotate: false,
    editMode: false,
    laxianList: () => [
        {
            position: [0, 1, 0] as [number, number, number],
            title: '设计元素',
            laxian_id: 'point_001',
            type: 0 as const,
            camera: { position: [2, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number] }
        },
        {
            position: [2, 1, 1] as [number, number, number],
            title: '吐槽啊啊啊',
            laxian_id: 'point_002',
            type: 1 as const,
            camera: { position: [4, 2, 2] as [number, number, number], target: [2, 1, 1] as [number, number, number] }
        },
        {
            position: [-1, 0.5, 2] as [number, number, number],
            title: '标注点！嘎嘎嘎嘎嘎嘎嘎嘎嘎嘎嘎嘎',
            laxian_id: 'point_003',
            type: 0 as const,
            camera: { position: [0, 1.5, 4] as [number, number, number], target: [-1, 0.5, 2] as [number, number, number] }
        }
    ] as LaxianItem[]
})
console.log(props.laxianList, '默认拉线点')
// 场景相关状态
const sceneLoading = ref(false)
const sceneLoadProgress = ref({ current: 0, total: 0 })
const sceneLoadError = ref<string | null>(null)

const {
    threeCore,
    initScene,
    disposeScene,
    laxianList
} = useSceneCore()

/** 挂载 WebGL 的容器（避免仅用 id 时在 client-only / 首轮 tick 中取不到 DOM） */
const sceneViewerEl = ref<HTMLElement | null>(null)

// 同步 autoRotate 到 OrbitControls
watch([() => props.autoRotate, () => threeCore.value], ([autoRotate, core]) => {
    if (!core?.controls || !('autoRotate' in core.controls)) return
    if (autoRotate) {
        // 开启自动旋转前：先计算物体包围盒、聚焦中心，确保物体全部显示
        adjustCamera()
    }
    (core.controls as { autoRotate: boolean }).autoRotate = !!autoRotate
}, { immediate: true })

// 监听模型列表和拉线点变化，自动加载（编辑模式下不因 laxianList 变化重载，避免覆盖动态添加）
watch(
    [
        () => props.modelList,
        () => (props.editMode ? null : props.laxianList)
    ],
    async ([newList, newLaxian]) => {
        const hasModels = newList && newList.length > 0
        const hasLaxian = newLaxian && newLaxian.length > 0
        if (hasModels || hasLaxian) {
            await nextTick()
            // client-only / Teleport 等场景下再等一帧，确保挂载点已进入 DOM
            await nextTick()
            await initThreejs()
        }
    },
    { immediate: true }
)

// 初始化场景
const initThreejs = async () => {
    const sceneElement = sceneViewerEl.value
    if (!sceneElement) return

    try {
        sceneLoading.value = true
        sceneLoadError.value = null

        if (threeCore.value) {
            disposeScene(sceneElement)
        }

        // 初始化场景（编辑模式下启用点可视化）
        await initScene(sceneElement, '0', {
            editMode: props.editMode,
            baseUrl: BASE_IMG,
            sceneData: null
        })

        // 设置场景背景为白色
        if (threeCore.value) {
            threeCore.value.scene.background = new THREE.Color(0xffffff)
        }

        // 加载模型列表或拉线点
        if ((props.modelList.length > 0 || (props.laxianList?.length ?? 0) > 0) && threeCore.value) {
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
    const hasModels = props.modelList.length > 0
    const hasLaxian = (props.laxianList?.length ?? 0) > 0
    if (!threeCore.value || (!hasModels && !hasLaxian)) return

    try {
        // 将模型列表转换为 SceneJSON 格式
        const modelObjects: SceneObjectJSON[] = props.modelList.map((item, index) => {
            const obj: SceneObjectJSON = {
                type: item.type || 'splat',
                url: item.url,
                position: item.position || [index * 3, 0, 0], // 默认横向排列
                rotation: item.rotation || [0, 0, 0],
                scale: item.scale || [1, 1, 1],
                options: item.options || {}
            }
            return obj
        })

        // 若有拉线点数据，加入 objects
        const laxianObjects: SceneObjectJSON[] = (props.laxianList?.length ? props.laxianList : []).map((item) => ({
            type: 'laxian' as const,
            position: item.position || [0, 0, 0],
            rotation: item.rotation || [0, 0, 0],
            scale: item.scale || [1, 1, 1],
            title: item.title || '拉线点',
            laxian_id: item.laxian_id,
            laxian_type: item.type ?? 0,
            camera: item.camera
        }))

        const sceneJSON: SceneJSON = {
            objects: [...modelObjects, ...laxianObjects],
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

        // 调整相机视角，让所有模型都在视野内（带过渡动画）
        if (threeCore.value && (props.modelList.length > 0 || (props.laxianList?.length ?? 0) > 0)) {
            adjustCamera(true)
        }
        // 打印场景所有对象

    } catch (error) {
        console.error('加载模型失败:', error)
        sceneLoadError.value = error instanceof Error ? error.message : '加载模型失败'
    }
}

/** 聚焦时长（毫秒） */
const FOCUS_DURATION = 800

// 调整相机视角（带过渡动画）
const adjustCamera = (animate = true) => {
    if (!threeCore.value) return

    // 计算所有模型的包围盒（不包含拉线点）
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
    const distance = maxDim * 3.2 // 拉远镜头，确保模型整体可见

    // 平视：相机与模型中心同高，从正前方观察
    const targetPosition = new THREE.Vector3(
        center.x,
        center.y,
        center.z + distance
    )

    if (animate) {
        threeCore.value.lookAtCameraState(
            { position: targetPosition, target: center.clone() },
            FOCUS_DURATION
        )
    } else {
        if (threeCore.value.camera instanceof THREE.PerspectiveCamera) {
            threeCore.value.camera.position.copy(targetPosition)
            threeCore.value.camera.lookAt(center)
            threeCore.value.camera.updateProjectionMatrix()
        }
        if (threeCore.value.controls) {
            threeCore.value.controls.target.copy(center)
            threeCore.value.controls.update()
        }
    }
}

/** 点击拉线时聚焦镜头：若有 camera 则使用其 position/target，否则聚焦到拉线点对象（带过渡动画） */
const focusLaxianCamera = (item: LaxianInterface) => {
    if (!threeCore.value) return
    if (item.camera) {
        threeCore.value.lookAtCameraState(
            {
                position: new THREE.Vector3(...item.camera.position),
                target: new THREE.Vector3(...item.camera.target)
            },
            FOCUS_DURATION
        )
    } else if (item.object) {
        threeCore.value.lookAtSelectObj([item.object])
    }
}

// 重试加载
const handleRetry = async () => {
    sceneLoadError.value = null
    await initThreejs()
}

// 组件卸载时清理
onUnmounted(() => {
    const sceneElement = sceneViewerEl.value
    if (sceneElement) {
        disposeScene(sceneElement)
    }
})

// 暴露加载进度和状态（含 getThreeCore 供编辑模式使用）
const getThreeCore = () => threeCore.value

defineExpose({
    sceneLoading,
    sceneLoadProgress,
    sceneLoadError,
    modelCount: computed(() => props.modelList.length),
    laxianList,
    focusLaxianCamera,
    getThreeCore
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
                ref="sceneViewerEl"
                class="w-full h-full bg-white min-h-[50vh]"
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
