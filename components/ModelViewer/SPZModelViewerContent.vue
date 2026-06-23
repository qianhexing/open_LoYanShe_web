<script setup lang="ts">
import { useSceneCore } from '@/composables/useSceneCore'
import type { SceneObjectJSON, SceneJSON, CameraState } from '@/utils/threeCore'
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

/** 场景加载状态（同步给父级） */
export interface SceneLoadState {
    loading: boolean
    progress: { current: number; total: number }
    error: string | null
}

interface Props {
    modelList: ModelItem[]
    /** 拉线点数组，有数据时会加入场景 objects */
    laxianList?: LaxianItem[]
    /** 是否开启自动旋转 */
    autoRotate?: boolean
    /** 编辑模式：拉线列表变更时不触发全量重载，由外部调用 addLaxianToScene 等 */
    editMode?: boolean
    /** 完整 SceneJSON，传入时优先走 threeCore.loadSceneFromJSON（含灯光/背景/对象），忽略 modelList */
    sceneJson?: SceneJSON | null
    /** WebGL 场景背景色（CSS 颜色或 THREE 颜色数值），默认白色，sceneJson.background 会覆盖之 */
    backgroundColor?: number | string
    /** 是否显示加载中遮罩；为 false 时仅隐藏加载态，加载失败提示仍会显示 */
    showLoadingMask?: boolean
    /** 嵌入模式：隐藏加载/错误遮罩，仅保留 3D 画布 */
    hideSceneChrome?: boolean
    /** 初始镜头列表，仅使用第一项作为进入页面时的机位 */
    initialCameraList?: Array<{
        position: [number, number, number]
        target: [number, number, number]
        fov?: number
    }>
}

const props = withDefaults(defineProps<Props>(), {
    autoRotate: false,
    editMode: false,
    sceneJson: null,
    backgroundColor: 0xffffff,
    showLoadingMask: true,
    hideSceneChrome: false,
    initialCameraList: () => [],
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

const emit = defineEmits<{
    /** 加载中 / 进度 / 错误 任一变化时触发 */
    'load-state-change': [state: SceneLoadState]
}>()

// 场景相关状态
const sceneLoading = ref(false)
const sceneLoadProgress = ref({ current: 0, total: 0 })
const sceneLoadError = ref<string | null>(null)

const syncLoadStateToParent = () => {
    emit('load-state-change', {
        loading: sceneLoading.value,
        progress: {
            current: sceneLoadProgress.value.current,
            total: sceneLoadProgress.value.total
        },
        error: sceneLoadError.value
    })
}

watch([sceneLoading, sceneLoadProgress, sceneLoadError], syncLoadStateToParent, {
    deep: true,
    immediate: true
})

const {
    threeCore,
    initScene,
    disposeScene,
    laxianList
} = useSceneCore()

/** 挂载 WebGL 的容器（避免仅用 id 时在 client-only / 首轮 tick 中取不到 DOM） */
const sceneViewerEl = ref<HTMLElement | null>(null)

/** 切换代次：递增后取消进行中的 loadModels，避免 Wasm / 场景叠加 */
let viewerLoadGeneration = 0

const waitAnimationFrames = (count = 2) =>
    new Promise<void>(resolve => {
        const step = (left: number) => {
            if (left <= 0) {
                resolve()
                return
            }
            requestAnimationFrame(() => step(left - 1))
        }
        step(count)
    })

// 同步 autoRotate 到 OrbitControls（不调整镜头，直接开启/关闭旋转）
watch([() => props.autoRotate, () => threeCore.value], ([autoRotate, core]) => {
    if (!core?.controls || !('autoRotate' in core.controls)) return
    (core.controls as { autoRotate: boolean }).autoRotate = !!autoRotate
}, { immediate: true })

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
            sceneData: null,
            // 目标默认 (0,0,0)，相机与目标同高 = 平视
            cameraPosition: { x: 0, y: 0, z: 12 }
        })

        // 设置场景默认背景色（可由 props.backgroundColor 自定义；若 sceneJson.background 存在则在后续 loadSceneFromJSON 中再次覆盖）
        if (threeCore.value) {
            threeCore.value.scene.background = new THREE.Color(props.backgroundColor)
        }

        // 加载模型列表/完整 SceneJSON/拉线点
        const hasScene = !!props.sceneJson && Array.isArray(props.sceneJson.objects) && props.sceneJson.objects.length > 0
        if ((hasScene || props.modelList.length > 0 || (props.laxianList?.length ?? 0) > 0) && threeCore.value) {
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
    const hasScene = !!props.sceneJson && Array.isArray(props.sceneJson.objects) && props.sceneJson.objects.length > 0
    const hasModels = props.modelList.length > 0
    const hasLaxian = (props.laxianList?.length ?? 0) > 0
    if (!threeCore.value || (!hasScene && !hasModels && !hasLaxian)) return

    const loadGen = viewerLoadGeneration

    try {
        // 优先使用外部传入的完整 SceneJSON（含灯光/背景/对象等），允许追加 laxian
        let sceneJSON: SceneJSON
        if (hasScene) {
            const externalLaxian: SceneObjectJSON[] = (props.laxianList?.length ? props.laxianList : []).map((item) => ({
                type: 'laxian' as const,
                position: item.position || [0, 0, 0],
                rotation: item.rotation || [0, 0, 0],
                scale: item.scale || [1, 1, 1],
                title: item.title || '拉线点',
                laxian_id: item.laxian_id,
                laxian_type: item.type ?? 0,
                camera: item.camera
            }))
            sceneJSON = {
                ...(props.sceneJson as SceneJSON),
                objects: [...(props.sceneJson as SceneJSON).objects, ...externalLaxian]
            }
        } else {
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

            sceneJSON = {
                objects: [...modelObjects, ...laxianObjects],
                cameraList: props.initialCameraList?.length ? props.initialCameraList : [],
                background: undefined,
                lighting: []
            }
        }

        // 使用 loadSceneFromJSON 加载场景
        const total = sceneJSON.objects.length
        sceneLoadProgress.value = { current: 0, total }

        const onProgress = (current: number, total: number) => {
            sceneLoadProgress.value = { current, total }
        }

        await threeCore.value.loadSceneFromJSON(sceneJSON, false, onProgress)

        if (loadGen !== viewerLoadGeneration) return

        if (threeCore.value && (hasScene || props.modelList.length > 0 || (props.laxianList?.length ?? 0) > 0)) {
            if (!applyInitialCameraIfAny(false)) {
                const box = new THREE.Box3()
                const objects = threeCore.value.allObjects?.length
                    ? threeCore.value.allObjects
                    : []
                if (objects.length > 0) {
                    for (const obj of objects) {
                        if (obj.userData?.type === 'splat' || obj.userData?.type === 'model') {
                            box.expandByObject(obj)
                        }
                    }
                }
                if (!box.isEmpty() && threeCore.value.controls?.target) {
                    threeCore.value.controls.target.copy(box.getCenter(new THREE.Vector3()))
                }
                adjustCamera(false)
            }
        }
    } catch (error) {
        if (loadGen !== viewerLoadGeneration) return
        console.error('加载模型失败:', error)
        sceneLoadError.value = error instanceof Error ? error.message : '加载模型失败'
    }
}

/** 聚焦时长（毫秒） */
const FOCUS_DURATION = 800

const parseCameraState = (raw: unknown): CameraState | null => {
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    const toVec3 = (value: unknown) => {
        if (value instanceof THREE.Vector3) return value.clone()
        if (Array.isArray(value) && value.length >= 3) {
            return new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]))
        }
        if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
            const v = value as { x: number; y: number; z: number }
            return new THREE.Vector3(v.x, v.y, v.z)
        }
        return null
    }
    const position = toVec3(item.position)
    const target = toVec3(item.target)
    if (!position || !target) return null
    return {
        position,
        target,
        ...(typeof item.fov === 'number' ? { fov: item.fov } : {})
    }
}

const applyInitialCameraIfAny = (animate = false) => {
    if (!threeCore.value) return false
    const raw =
        props.initialCameraList?.[0]
        ?? threeCore.value.cameraList?.[0]
    const state = parseCameraState(raw)
    if (!state) return false
    threeCore.value.lookAtCameraState(state, animate ? FOCUS_DURATION : 0)
    return true
}

// 调整相机视角：目标不变，相机移至与目标同高的平视位置
const adjustCamera = (animate = true) => {
    if (!threeCore.value?.controls?.target) return

    const target = threeCore.value.controls.target.clone()

    // 计算模型包围盒（优先 allObjects，兼容 SplatMesh）
    const box = new THREE.Box3()
    const objects = threeCore.value.allObjects?.length
        ? threeCore.value.allObjects
        : []
    if (objects.length > 0) {
        for (const obj of objects) {
            if (obj.userData?.type === 'splat' || obj.userData?.type === 'model') {
                box.expandByObject(obj)
            }
        }
    } else {
        threeCore.value.scene.traverse((child) => {
            if (child.userData?.type === 'splat' || child.userData?.type === 'model') {
                box.expandByObject(child)
            }
        })
    }

    const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 1)
    const distance = maxDim * 8.5

    // 平视：相机 Y 与目标同高，从 +Z 方向观察
    const targetPosition = new THREE.Vector3(
        target.x,
        target.y,
        target.z + distance
    )

    if (animate) {
        threeCore.value.lookAtCameraState(
            { position: targetPosition, target },
            FOCUS_DURATION
        )
    } else {
        if (threeCore.value.camera instanceof THREE.PerspectiveCamera) {
            threeCore.value.camera.position.copy(targetPosition)
            threeCore.value.camera.lookAt(target)
            threeCore.value.camera.updateProjectionMatrix()
        }
        threeCore.value.controls.update()
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

/** 清空场景内容，不销毁 WebGL 渲染上下文与 Wasm 单例 */
const clearSceneContent = () => {
    viewerLoadGeneration++
    if (!threeCore.value) return
    threeCore.value.clearSceneContent()
    sceneLoadProgress.value = { current: 0, total: 0 }
    sceneLoadError.value = null
}

/** 保留 WebGL 上下文：清空场景并按当前 props 重新加载 */
const reloadSceneKeepWebGL = async () => {
    const sceneElement = sceneViewerEl.value
    if (!sceneElement) return

    try {
        sceneLoading.value = true
        sceneLoadError.value = null

        if (!threeCore.value) {
            await initThreejs()
            return
        }

        clearSceneContent()
        const loadGen = viewerLoadGeneration

        await waitAnimationFrames(2)

        if (loadGen !== viewerLoadGeneration) return

        if (threeCore.value) {
            threeCore.value.scene.background = new THREE.Color(props.backgroundColor)
        }

        const hasScene =
            !!props.sceneJson
            && Array.isArray(props.sceneJson.objects)
            && props.sceneJson.objects.length > 0
        const hasModels = props.modelList.length > 0
        const hasLaxian = (props.laxianList?.length ?? 0) > 0
        if ((hasScene || hasModels || hasLaxian) && threeCore.value) {
            await loadModels()
        }

        if (loadGen !== viewerLoadGeneration) return
        sceneLoading.value = false
    } catch (error) {
        console.error('重新加载场景失败:', error)
        sceneLoadError.value = error instanceof Error ? error.message : '重新加载场景失败'
        sceneLoading.value = false
    }
}

// 监听模型列表/场景 JSON/拉线点变化（已有 WebGL 时复用上下文重载，无数据时仅清空）
watch(
    [
        () => props.sceneJson,
        () => props.modelList,
        () => (props.editMode ? null : props.laxianList)
    ],
    async ([newScene, newList, newLaxian]) => {
        const hasScene = !!newScene && Array.isArray(newScene.objects) && newScene.objects.length > 0
        const hasModels = newList && newList.length > 0
        const hasLaxian = newLaxian && newLaxian.length > 0
        if (hasScene || hasModels || hasLaxian) {
            await nextTick()
            await nextTick()
            if (threeCore.value) {
                await reloadSceneKeepWebGL()
            } else {
                await initThreejs()
            }
        } else if (threeCore.value) {
            clearSceneContent()
        }
    },
    { immediate: true }
)

// 重试加载（已有 WebGL 时复用 Wasm，不 disposeScene 重建）
const handleRetry = async () => {
    sceneLoadError.value = null
    if (threeCore.value) {
        await reloadSceneKeepWebGL()
    } else {
        await initThreejs()
    }
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
    getThreeCore,
    clearSceneContent,
    reloadSceneKeepWebGL,
    applyInitialCameraIfAny
})
</script>

<template>
    <div class="w-full h-full relative overflow-hidden">
        <!-- 加载状态 -->
        <div
            v-if="!hideSceneChrome && ((showLoadingMask && sceneLoading) || sceneLoadError)"
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
