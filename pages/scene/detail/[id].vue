<script setup lang="ts">
import type { CameraState, SceneObjectJSON, SceneJSON } from '@/utils/threeCore';
import * as THREE from 'three';
import { updateScene, insertScene, getSceneId } from '@/api/scene'
import type { Community, Effect, Library, Material, Scene, TemplateInterface } from '@/types/api'
import { insertCommunity } from '@/api/community'
import type { DiaryInterface, LibraryInterface } from '@/types/sence'
import type SceneMaterial from '@/components/scene/Material.vue'
import type SceneTextureEditor from '@/components/scene/TextureEditor.vue'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
import { useSceneStore } from '@/stores/sence'
import { useConfigStore } from '@/stores/config'
import { createFont } from '~/api';
import { uploadFileToOSS } from '@/utils/ossUpload';
import { useSceneCore } from '@/composables/useSceneCore';
import { useSceneUndo, type TransformState } from '@/composables/useSceneUndo';
import YearlySummaryPostModal from '@/components/yearlySummary/PostModal.vue';
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig';
// @ts-ignore - 缺少类型定义
import InfiniteGridHelper from '@plackyfantacky/three.infinitegridhelper';

const sceneStore = useSceneStore()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const port = computed(() => configStore.getPort())
const showDiary = ref(false)
const theme = useThemeStore()
const activeDiary = ref<DiaryInterface | null>(null)
const loading = ref(false)

const {
    threeCore,
    sceneLoading,
    sceneLoadProgress,
    sceneLoadError,
    diaryList,
    libraryList,
    clickObject,
    operaPosition,
    initScene,
    disposeScene
} = useSceneCore()

/** 撤销管理：支持多种操作类型，当前实现移动/缩放/旋转 */
const { canUndo, undoStack, pushTransformUndo, undo: performUndo, cloneTransformState } = useSceneUndo()
/** 拖拽开始时的变换状态，mouseUp 时压入撤销栈 */
const pendingTransformState = ref<{ objectUuid: string; state: TransformState } | null>(null)
/** 变换控件的撤销监听器，用于 onBeforeUnmount 时移除 */
const transformUndoListeners = ref<{ onMouseDown: () => void; onMouseUp: () => void } | null>(null)

let uni: any;

// 判断是否可替换贴图
const canTexture = computed(() => {
    let flag = false
    if (clickObject.value && clickObject.value.length > 0) {
        clickObject.value[0].traverse((child) => {
            if (child.name.includes('replace')) {
                flag = true
            }
        })
    }
    return flag
});

const MaterialRef = ref<InstanceType<typeof SceneMaterial> | null>(null)
const SceneTextureEditorRef = ref<InstanceType<typeof SceneTextureEditor> | null>(null)

const route = useRoute()
const edit_mode = ref(false) // 编辑模式
const add_mode = ref(false)
const token = ref<string | null>(null) // 传入的token
// console.log(route.query, '路由')
const toast = useToast()
const userStore = useUserStore()
const clickPosition = ref({ x: 0, y: 0 })
const target: Ref<THREE.Object3D | null> = ref(null)
const transformType = ref('translate')
const showToolbar = ref(true) // 控制工具栏显示/隐藏
// 五个独立的悬浮列表展开状态，互不联动，但同时只展开一个
const materialListExpanded = ref(false)
const clothingListExpanded = ref(false)
const sceneListExpanded = ref(false)
const effectListExpanded = ref(false)
const templateListExpanded = ref(false)
const layoutReady = inject('layoutReady') as Ref<boolean>
if (route.query?.edit) {
    edit_mode.value = true
}
if (route.query?.add) {
    edit_mode.value = true
    add_mode.value = true
}

if (route.query?.token) {
    userStore.setToken(route.query.token.toString())
}
const id = route.params.id as string

const { data } = await useAsyncData('studyDeatil', () => {
    return getSceneId({ sence_id: Number.parseInt(id) })
}, {})
const detail = ref<Scene | null>(null)
detail.value = data.value ?? null

const editDiary = () => {
    if (activeDiary.value?.object) {
        activeDiary.value.object.userData.title = activeDiary.value.title
        activeDiary.value.object.userData.content = activeDiary.value.content
        showDiary.value = false
    }
}
const showTexture = async () => {
    if (!target.value && clickObject.value && clickObject.value.length > 0) {
        clickObject.value[0].traverse((child) => {
            if (child.name.includes('replace')) {
                target.value = child
            }
        })
    }

    if (target.value) {
        await nextTick()
        if (SceneTextureEditorRef.value) {
            SceneTextureEditorRef.value.showModel()
        }
    }
}
const copyModel = async () => {
    if (!threeCore.value) return
    if (clickObject.value && clickObject.value.length > 0) {
        if (clickObject.value[0].userData.url) {
            if (clickObject.value[0].userData.type === 'model') {
                const mesh = await threeCore.value.loadModel(clickObject.value[0].userData.url)
                if (clickObject.value[0].userData.options) {
                    threeCore.value.setOptionsModel(mesh, clickObject.value[0].userData.options)
                }
                threeCore.value.scene.add(mesh)
            }
        }
    }
}
const deleteModel = () => {
    if (!threeCore.value) return
    if (clickObject.value && clickObject.value.length > 0) {
        if (clickObject.value[0].userData.type === 'diary') {
            const index = threeCore.value.loadedDiary.findIndex((child) => {
                return clickObject.value && child.object.uuid === clickObject.value[0].uuid
            })
            if (index !== -1) {
                threeCore.value.loadedDiary.splice(index, 1)
            }
        }
        threeCore.value.clearGroup(clickObject.value[0])
        clickObject.value = null
        threeCore.value.transformControls.detach()
        threeCore.value.showbloom = true
    }
}
const handleClickDiary = (e: MouseEvent, item: DiaryInterface) => {
    showDiary.value = true
    clickPosition.value = {
        x: e.clientX, y: e.clientY
    }
    activeDiary.value = item
}
const handleClickLibrary = (item: LibraryInterface) => {
    const isInUniApp =
        typeof window !== 'undefined' &&
        navigator.userAgent.includes('Html5Plus');
    if (!item.library_id) return
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
        // UniApp WebView 环境
        uni.navigateTo({
            url: `/pages/library/libraryDetail/libraryDetail?id=${item.library_id}`,
            fail: () => {
                console.log('跳转错误')
            }
        });
    } else {
        if (port.value) {
            // 鸿蒙系统
            port.value.postMessage(JSON.stringify({
                type: 'jump',
                path: 'LibraryDetail',
                params: {
                    id: item.library_id
                }
            }));
        } else {
            // 普通网页环境
            window.open(`/library/detail/${item.library_id}`, '_blank')
        }
    }
}
const handleShare = async () => {
    try {
        const { copyCurrentUrl } = useCopyCurrentUrl()
        const result = await copyCurrentUrl()
        if (result?.success) {
            toast.add({
                title: '链接已复制',
                description: '分享链接已复制到剪贴板',
                icon: 'i-heroicons-check-circle',
                color: 'green'
            })
        } else {
            toast.add({
                title: '复制失败',
                description: result?.message || '请手动复制链接',
                icon: 'i-heroicons-exclamation-circle',
                color: 'orange'
            })
        }
    } catch (error) {
        console.error('复制链接失败:', error)
        toast.add({
            title: '复制失败',
            icon: 'i-heroicons-x-circle',
            color: 'red'
        })
    }
}
const deleteCamera = (index: number) => {
    if (!threeCore.value) return
    threeCore.value.cameraList.splice(index, 1)
}
const resetCamera = (index: number) => {
    if (!threeCore.value) return
    threeCore.value.cameraList[index] = threeCore.value.recordCamera(false)
}

// 每个按钮独立控制其列表：点击展开时收起其它，点击已展开的则收起
const showMaterial = () => {
    const wasExpanded = materialListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    if (!wasExpanded) materialListExpanded.value = true
}
const showClothing = () => {
    const wasExpanded = clothingListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    if (!wasExpanded) clothingListExpanded.value = true
}
const showScene = () => {
    const wasExpanded = sceneListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    if (!wasExpanded) sceneListExpanded.value = true
}
const showEffect = () => {
    const wasExpanded = effectListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    if (!wasExpanded) effectListExpanded.value = true
}
const showTemplate = () => {
    const wasExpanded = templateListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    if (!wasExpanded) templateListExpanded.value = true
}

const showSettings = ref(false)
const settingsState = reactive({
    shadowsEnabled: true,
    shadowQuality: 'high',
    fov: 45, // 镜头角度（视野角度）
    lightAzimuth: 45, // 光源水平角度
    lightElevation: 45, // 光源垂直角度
    minAzimuthAngle: -180, // 控制器水平旋转最小角度（度）
    maxAzimuthAngle: 180, // 控制器水平旋转最大角度（度）
    minPolarAngle: 0, // 控制器垂直旋转最小角度（度）
    maxPolarAngle: 180, // 控制器垂直旋转最大角度（度）
})

// 双向滑块使用的计算属性
const azimuthRange = computed({
    get: () => [settingsState.minAzimuthAngle, settingsState.maxAzimuthAngle] as [number, number],
    set: (values: [number, number]) => {
        settingsState.minAzimuthAngle = values[0]
        settingsState.maxAzimuthAngle = values[1]
        handleAzimuthRangeChange(values)
    }
})

const polarRange = computed({
    get: () => [settingsState.minPolarAngle, settingsState.maxPolarAngle] as [number, number],
    set: (values: [number, number]) => {
        settingsState.minPolarAngle = values[0]
        settingsState.maxPolarAngle = values[1]
        handlePolarRangeChange(values)
    }
})
const shadowQualityOptions = [
    { label: '关闭', value: 'off' },
    // { label: '低', value: 'low' },
    // { label: '中', value: 'medium' },
    { label: '高', value: 'high' },
    // { label: '超高', value: 'ultra' }
]

const openSettings = (e: MouseEvent) => {
    clickPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }

    if (threeCore.value?.renderer) {
        if (threeCore.value.renderer.shadowMap.enabled) {
            // 如果开启，保持当前的 shadowQuality 或者默认为 high
            if (!settingsState.shadowQuality || settingsState.shadowQuality === 'off') {
                settingsState.shadowQuality = 'high'
            }
        } else {
            settingsState.shadowQuality = 'off'
        }
    }

    // 初始化镜头角度
    if (threeCore.value?.camera && (threeCore.value.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        settingsState.fov = (threeCore.value.camera as THREE.PerspectiveCamera).fov
    }

    // 初始化controls旋转角度限制
    if (threeCore.value?.controls) {
        // 水平角度（azimuth）：默认无限制（Number.NEGATIVE_INFINITY 到 Number.POSITIVE_INFINITY）
        const minAzimuthRad = threeCore.value.controls.minAzimuthAngle ?? Number.NEGATIVE_INFINITY
        const maxAzimuthRad = threeCore.value.controls.maxAzimuthAngle ?? Number.POSITIVE_INFINITY
        settingsState.minAzimuthAngle = minAzimuthRad === Number.NEGATIVE_INFINITY ? -180 : (minAzimuthRad * 180) / Math.PI
        settingsState.maxAzimuthAngle = maxAzimuthRad === Number.POSITIVE_INFINITY ? 180 : (maxAzimuthRad * 180) / Math.PI
        
        // 垂直角度（polar）：默认 0 到 Math.PI（180度）
        const minPolarRad = threeCore.value.controls.minPolarAngle ?? 0
        const maxPolarRad = threeCore.value.controls.maxPolarAngle ?? Math.PI
        settingsState.minPolarAngle = (minPolarRad * 180) / Math.PI
        settingsState.maxPolarAngle = (maxPolarRad * 180) / Math.PI
    }

    showSettings.value = true
}

const updateLightPosition = () => {
    if (threeCore.value) {
        threeCore.value.setMainLightPosition(
            settingsState.lightAzimuth,
            settingsState.lightElevation
        )
    }
}

const changeShadowQuality = (val: string) => {
    if (!threeCore.value || !threeCore.value.renderer) return

    if (val === 'off') {
        threeCore.value.renderer.shadowMap.enabled = false
        // 强制更新
        threeCore.value.scene.traverse((child) => {
            if ((child as any).isMesh && (child as any).material) {
                const mesh = child as THREE.Mesh
                if (Array.isArray(mesh.material)) {
                    // biome-ignore lint/complexity/noForEach: <explanation>
                    mesh.material.forEach(m => { m.needsUpdate = true })
                } else {
                    mesh.material.needsUpdate = true
                }
            }
        })
    } else {
        if (!threeCore.value.renderer.shadowMap.enabled) {
            threeCore.value.renderer.shadowMap.enabled = true
            // 开启时也需要强制更新材质
            threeCore.value.scene.traverse((child) => {
                if ((child as any).isMesh && (child as any).material) {
                    const mesh = child as THREE.Mesh
                    if (Array.isArray(mesh.material)) {
                        // biome-ignore lint/complexity/noForEach: <explanation>
                        mesh.material.forEach(m => { m.needsUpdate = true })
                    } else {
                        mesh.material.needsUpdate = true
                    }
                }
            })
        }
        threeCore.value.setShadowQuality(val as 'low' | 'medium' | 'high' | 'ultra')
    }
}

const changeFov = (val: number) => {
    if (!threeCore.value || !threeCore.value.camera) return

    if ((threeCore.value.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const cam = threeCore.value.camera as THREE.PerspectiveCamera
        cam.fov = val
        cam.updateProjectionMatrix()
    }
}

const handleAzimuthRangeChange = (values: [number, number]) => {
    if (!threeCore.value || !threeCore.value.controls) return
    const [min, max] = values
    // 将度转换为弧度，-180度表示无限制，180度表示无限制
    threeCore.value.controls.minAzimuthAngle = min === -180 ? Number.NEGATIVE_INFINITY : (min * Math.PI) / 180
    threeCore.value.controls.maxAzimuthAngle = max === 180 ? Number.POSITIVE_INFINITY : (max * Math.PI) / 180
}

const handlePolarRangeChange = (values: [number, number]) => {
    if (!threeCore.value || !threeCore.value.controls) return
    const [min, max] = values
    // 将度转换为弧度
    threeCore.value.controls.minPolarAngle = (min * Math.PI) / 180
    threeCore.value.controls.maxPolarAngle = (max * Math.PI) / 180
}

const showObjectSettings = ref(false)
const objectSettingsState = reactive({
    color: '#ffffff',
    depth: 0.3,
    size: 1,
    longText: '' // 长文本内容
})

const showTextMenu = ref(false)
const textMenuPosition = ref({ x: 0, y: 0 })

const showPointMenu = ref(false)
const pointMenuPosition = ref({ x: 0, y: 0 })

const showImageMenu = ref(false)
const imageMenuPosition = ref({ x: 0, y: 0 })

const showColorPicker = ref(false)
const colorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)

const showLightMenu = ref(false)
const lightMenuPosition = ref({ x: 0, y: 0 })
const currentLightPreset = ref('default')

const showPostModal = ref(false)

const showLongTextModal = ref(false)
const longTextContent = ref('')
const longTextModalPosition = ref({ x: 0, y: 0 })

const openObjectSettings = () => {
    if (clickObject.value && clickObject.value.length > 0) {
        const obj = clickObject.value[0]
        if (obj.userData.type === '3Dtext') {
            // 初始化设置
            if (obj.material && (obj.material as THREE.MeshStandardMaterial).color) {
                objectSettingsState.color = '#' + (obj.material as THREE.MeshStandardMaterial).color.getHexString()
            }
            if (obj.userData.options) {
                objectSettingsState.depth = obj.userData.options.depth ?? 0.3
                objectSettingsState.size = obj.userData.options.size ?? 1
            }

            // 设置弹窗位置（基于操作菜单位置）
            clickPosition.value = {
                x: operaPosition.value.x + 100,
                y: operaPosition.value.y
            }
            showObjectSettings.value = true
        } 
        if (obj.userData.type === 'longtext') {
            // 初始化长文本内容
            objectSettingsState.longText = obj.userData.text || ''
            
            // 设置弹窗位置（基于操作菜单位置）
            clickPosition.value = {
                x: operaPosition.value.x + 100,
                y: operaPosition.value.y
            }
            showObjectSettings.value = true
        }
        if (obj.userData.type === 'image') {
            // 初始化设置
            if (obj.userData.follow === undefined) {
                obj.userData.follow = false
            }
        }
    }
}

const updateTextObject = () => {
    if (clickObject.value && clickObject.value.length > 0 && threeCore.value) {
        const obj = clickObject.value[0] as THREE.Mesh
        if (obj.userData.type === '3Dtext') {
            // 更新颜色
            if (obj.material) {
                (obj.material as THREE.MeshStandardMaterial).color.set(objectSettingsState.color)
            }

            // 更新几何体（如果深度或大小改变）
            const options = {
                ...obj.userData.options,
                depth: Number(objectSettingsState.depth),
                size: Number(objectSettingsState.size)
            }

            // 更新 userData
            obj.userData.options = options

            // 重新生成几何体
            threeCore.value.updateTextMesh(obj, obj.userData.title, options)
        }
    }
}

// 更新长文本对象
const updateLongTextObject = async () => {
    if (clickObject.value && clickObject.value.length > 0 && threeCore.value) {
        const obj = clickObject.value[0] as THREE.Mesh
        if (obj.userData.type === 'longtext' && objectSettingsState.longText.trim()) {
            try {
                // 保存当前 mesh 的变换信息
                const position = obj.position.clone()
                const rotation = obj.rotation.clone()
                const scale = obj.scale.clone()
                const parent = obj.parent
                const baseWidth = obj.userData.baseWidth || 5
                const options = obj.userData.options || {}

                // 创建新的长文本 mesh
                const newMesh = await threeCore.value.loadTextMesh(
                    objectSettingsState.longText,
                    baseWidth,
                    options
                )

                // 应用之前的变换
                newMesh.position.copy(position)
                newMesh.rotation.copy(rotation)
                newMesh.scale.copy(scale)

                // 从原父节点中移除旧 mesh
                if (parent) {
                    parent.remove(obj)
                } else {
                    threeCore.value.scene.remove(obj)
                }
                // 更新选中的对象
                clickObject.value = null
                threeCore.value.transformControls.detach()
                // 清理旧 mesh 的资源
                if (obj instanceof THREE.Mesh) {
                    if (obj.geometry) obj.geometry.dispose()
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            for (const m of obj.material) {
                                if (m instanceof THREE.MeshBasicMaterial && m.map) {
                                    m.map.dispose()
                                }
                                m.dispose()
                            }
                        } else {
                            const mat = obj.material as THREE.MeshBasicMaterial
                            if (mat.map) mat.map.dispose()
                            mat.dispose()
                        }
                    }
                }

                // 添加新 mesh 到原父节点或场景
                if (parent) {
                    parent.add(newMesh)
                } else {
                    threeCore.value.scene.add(newMesh)
                }
                // setTimeout(() => {
                //     clickObject.value = [newMesh]
                // }, 100)
                
                // 如果 transformControls 正在控制这个对象，需要重新附加
                // if (threeCore.value.transformControls.object === obj) {
                //     threeCore.value.transformControls.attach(newMesh)
                // }

                // 关闭设置弹窗
                showObjectSettings.value = false
            } catch (error) {
                console.error('更新长文本失败:', error)
                toast.add({
                    title: '更新失败',
                    description: '长文本更新失败，请重试',
                    icon: 'i-heroicons-x-circle',
                    color: 'red'
                })
            }
        }
    }
}

// 添加图片
const addImage = () => {
    if (MaterialRef.value) {
        MaterialRef.value.addImage()
    }
}

// 打开图片菜单
const openImageMenu = (e: MouseEvent) => {
    imageMenuPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }
    showImageMenu.value = true
}

// 选择图片
const selectImage = () => {
    showImageMenu.value = false
    addImage()
}

// 选择背景
const selectBackground = () => {
    showImageMenu.value = false
    addBackgroundClick()
}

// 选择纯色背景
const selectSolidColorBackground = () => {
    showImageMenu.value = false
    if (colorPickerRef.value) {
        colorPickerRef.value.showModel()
    }
}

// 设置纯色背景
const setSolidColorBackground = (color: string) => {
    if (!threeCore.value) return
    // 将颜色字符串转换为 THREE.Color
    const threeColor = new THREE.Color(color)
    threeCore.value.scene.background = threeColor
    // 保存颜色值到 background（使用特殊格式 color:#ffffff 以便区分图片背景）
    threeCore.value.background = `color:${color}`
}

// 灯光预设配置
interface LightPreset {
    name: string
    description: string
    ambientIntensity: number
    directionalIntensity: number
    directionalAzimuth: number
    directionalElevation: number
    hemisphereIntensity?: number
    fillIntensity?: number
    lensIntensity: number
}

const lightPresets: Record<string, LightPreset> = {
    default: {
        name: '默认',
        description: '默认灯光配置',
        ambientIntensity: 2.8,
        directionalIntensity: 2,
        directionalAzimuth: 45,
        directionalElevation: 45,
        hemisphereIntensity: 0.4,
        fillIntensity: 0.4,
        lensIntensity: 0.5
    },
    warm: {
        name: '温暖',
        description: '温暖的暖色调灯光',
        ambientIntensity: 1.5,
        directionalIntensity: 2.5,
        directionalAzimuth: 60,
        directionalElevation: 50,
        hemisphereIntensity: 0.6,
        fillIntensity: 0.5,
        lensIntensity: 0.8
    },
    cool: {
        name: '冷调',
        description: '冷色调灯光效果',
        ambientIntensity: 1.2,
        directionalIntensity: 1.8,
        directionalAzimuth: 30,
        directionalElevation: 60,
        hemisphereIntensity: 0.5,
        fillIntensity: 0.3,
        lensIntensity: 0.6
    }
}

// 打开灯光菜单
const openLightMenu = (e: MouseEvent) => {
    lightMenuPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }
    showLightMenu.value = true
}

// 应用灯光预设
const applyLightPreset = (presetKey: string, silent = false) => {
    if (!threeCore.value || !lightPresets[presetKey]) return
    
    const preset = lightPresets[presetKey]
    currentLightPreset.value = presetKey
    
    // 应用环境光
    threeCore.value.setAmbientLightIntensity(preset.ambientIntensity)
    
    // 应用主方向光
    threeCore.value.setMainLightPosition(
        preset.directionalAzimuth,
        preset.directionalElevation
    )
    threeCore.value.setMainLightIntensity(preset.directionalIntensity)
    
    // 应用镜头光
    threeCore.value.setLensLightIntensity(preset.lensIntensity)
    
    // 应用半球光和补光（如果存在）
    if (threeCore.value.lights) {
        if (preset.hemisphereIntensity !== undefined && threeCore.value.lights.hemisphere) {
            threeCore.value.lights.hemisphere.intensity = preset.hemisphereIntensity
        }
        if (preset.fillIntensity !== undefined && threeCore.value.lights.fill) {
            threeCore.value.lights.fill.intensity = preset.fillIntensity
        }
    }
    
    if (!silent) {
        showLightMenu.value = false
        
        toast.add({
            title: '灯光预设已应用',
            description: `已切换到"${preset.name}"预设`,
            icon: 'i-heroicons-check-circle',
            color: 'green'
        })
    }
}

// 添加日记点
const addDiaryClick = (e: MouseEvent) => {
    if (MaterialRef.value) {
        MaterialRef.value.addDiary(e)
    }
}

// 打开点位菜单
const openPointMenu = (e: MouseEvent) => {
    pointMenuPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }
    showPointMenu.value = true
}

// 选择日记点
const selectDiaryPoint = () => {
    showPointMenu.value = false
    // 创建一个模拟事件对象，因为 addDiaryClick 需要事件参数
    // 实际使用时，MaterialRef.value.addDiary 会处理点击事件
    if (MaterialRef.value) {
        const mockEvent = { clientX: pointMenuPosition.value.x, clientY: pointMenuPosition.value.y } as MouseEvent
        MaterialRef.value.addDiary(mockEvent)
    }
}

// 选择图鉴
const selectLibraryPoint = () => {
    // TODO: 实现图鉴功能
    showPointMenu.value = false
}

// 选择店铺
const selectShopPoint = () => {
    // TODO: 实现店铺功能
    showPointMenu.value = false
}

// 添加背景
const addBackgroundClick = () => {
    if (MaterialRef.value) {
        MaterialRef.value.addBackground()
    }
}

// 添加文本
const addTextClick = () => {
    if (MaterialRef.value) {
        MaterialRef.value.addText()
    }
}

// 打开文本菜单
const openTextMenu = (e: MouseEvent) => {
    textMenuPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }
    showTextMenu.value = true
}

// 选择长文本
const selectLongText = () => {
    showTextMenu.value = false
    // 设置弹窗位置（在文本菜单位置附近）
    longTextModalPosition.value = {
        x: textMenuPosition.value.x,
        y: textMenuPosition.value.y
    }
    // 清空之前的内容
    longTextContent.value = ''
    showLongTextModal.value = true
}

// 确认创建长文本
const confirmLongText = async () => {
    if (!threeCore.value || !longTextContent.value.trim()) {
        showLongTextModal.value = false
        return
    }

    try {
        // 创建长文本 Mesh
        const mesh = await threeCore.value.loadTextMesh(longTextContent.value, 5, {
            fontSize: 32,
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            backgroundColor: '', // 默认透明背景
            padding: 20,
            lineHeight: 1.5,
            maxWidth: 800
        })

        // 放到当前视图中心
        const center = getScreenCenter()
        mesh.position.set(center.x, center.y, center.z)
        threeCore.value.scene.add(mesh)

        // 关闭弹窗并清空内容
        showLongTextModal.value = false
        longTextContent.value = ''
    } catch (error) {
        console.error('创建长文本失败:', error)
        toast.add({
            title: '创建失败',
            description: '长文本创建失败，请重试',
            icon: 'i-heroicons-x-circle',
            color: 'red'
        })
    }
}

// 取消长文本输入
const cancelLongText = () => {
    showLongTextModal.value = false
    longTextContent.value = ''
}

// 选择3D文本
const select3DText = () => {
    showTextMenu.value = false
    addTextClick()
}
const addDiary = async (form) => {
    if (!threeCore.value) return
    const mesh = await threeCore.value.createDiary({
        title: form.title,
        content: form.content,
        type: 'diary'
    })
    mesh.position.set(0, 0, 0)
    threeCore.value.scene.add(mesh)
}
const clearTemplate = () => {
    if (!threeCore.value) return
    if (threeCore.value.loadTemplate.length > 0) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        threeCore.value.loadTemplate.forEach((child) => {
            threeCore.value!.clearGroup(child)
        })
        threeCore.value.loadTemplate = []
    }
}
const recordCamera = () => {
    if (!threeCore.value) return
    threeCore.value.recordCamera()
}
const chooseEffect = async (item: Effect) => {
    if (!threeCore.value) return
    let effectName = null
    // biome-ignore lint/complexity/noForEach: <explanation>
    threeCore.value.scene.children.forEach((child: THREE.Object3D) => {
        if (child.userData && child.userData.type === 'effect') {
            effectName = child.userData.effectName
        }
    })
    if (effectName) {
        threeCore.value.removeEffect({ effect_name: effectName, effect_id: 0 }, threeCore.value.scene)
    }
    threeCore.value.addEffect(item)
}
// 获取屏幕中心坐标
const getScreenCenter = () => {
    if (!threeCore.value) return new THREE.Vector3()
    const screenCenter = new THREE.Vector3()
    threeCore.value.camera.getWorldPosition(screenCenter)
    return threeCore.value.controls.target.clone()
}
const chooseMaterial = async (item: Material) => {
    if (!threeCore.value) return
    if (item.pk_type === 1) {
        sceneStore.setLoading(true)
        const mesh = await threeCore.value.loadModel(BASE_IMG + item.materia_url, { useDracoLoader: item.options?.useDracoLoader ? item.options.useDracoLoader : true, dracoDecoderPath: '/draco/gltf/' })

        console.log(mesh, '对象')
        const screenCenter = getScreenCenter()
        mesh.position.set(screenCenter.x, screenCenter.y, screenCenter.z)
        if (item.options) {
            threeCore.value.setOptionsModel(mesh, item.options)
        }
        sceneStore.setLoading(false)
        setTimeout(() => {
            threeCore.value!.lookAtSelectObj([mesh])
        });

        threeCore.value.scene.add(mesh)
    } else if (item.pk_type === 3) {
        sceneStore.setLoading(true)
        try {
            // 判断是否射线模式，如果不是则切换至射线模式
            if (!threeCore.value.options.enableRaycaster) {
                threeCore.value.setRaycasterMode(true)
            }
            
            // 获取屏幕中心坐标
            const screenCenter = getScreenCenter()
            
            // 使用封装的 loadSplat 方法加载点云
            const url = BASE_IMG + item.materia_url
            const splatOptions = {
                fileType: item.options?.fileType || undefined,
                maxSplats: item.options?.maxSplats || undefined,
                maxSh: item.options?.maxSh || undefined
            }
            
            const group = await threeCore.value.loadSplat(url, splatOptions)
            
            // 设置位置、旋转和缩放
            group.position.set(screenCenter.x, screenCenter.y, screenCenter.z)
            group.rotation.set(0, 0, 0)
            group.scale.set(1, 1, 1)
            
            // 设置额外的 userData
            group.userData.materia_id = item.materia_id
            
            // 添加到场景
            threeCore.value.scene.add(group)
            
            // 调整相机视角
            setTimeout(() => {
                threeCore.value!.lookAtSelectObj([group])
            })
        } catch (error) {
            console.error('加载点云失败:', error)
            if (process.client) {
                toast.add({
                    title: '加载失败',
                    description: '点云模型加载失败，请稍后重试',
                    color: 'red'
                })
            }
        } finally {
            sceneStore.setLoading(false)
        }
    }
}
const chooseTemplate = async (item: TemplateInterface) => {
    if (!threeCore.value) return
    if (threeCore.value.loadTemplate.length > 0) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        threeCore.value.loadTemplate.forEach((child) => {
            threeCore.value!.clearGroup(child)
        })
        threeCore.value.loadTemplate = []
    }
    if (item.json_data) {
        const group = await threeCore.value.loadSceneFromJSON(item.json_data, true)
        if (group) {
            group.userData.type = 'template'
            group.userData.template_id = item.template_id
            group.userData.ignorePick = true
            threeCore.value.scene.add(group)
            threeCore.value.loadTemplate.push(group)
        }
    } else if (item.json_url) {
        use$Get(`/sence/json/${item.json_url}.json?2`, undefined, { baseURL: BASE_IMG })
            .then(async (res) => {
                const group = await threeCore.value!.loadSceneFromJSON(res, true)
                if (group) {
                    group.userData.type = 'template'
                    group.userData.template_id = item.template_id
                    group.userData.ignorePick = true
                    threeCore.value!.scene.add(group)
                    threeCore.value!.loadTemplate.push(group)
                }
            })
    }
}
const jumpToCommunity = (item: Community) => {
    const isInUniApp =
        typeof window !== 'undefined' &&
        navigator.userAgent.includes('Html5Plus');

    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
        // UniApp WebView 环境
        uni.navigateTo({
            url: `/pages/community/communityDetail/communityDetail?id=${item.community_id}`,
            fail: () => {
                console.log('跳转错误')
            }
        });
    } else {
        if (port.value) {
            // 鸿蒙系统
            port.value.postMessage(JSON.stringify({
                type: 'back',
                path: 'CommunityDetail',
                params: { reload: true, sence_id: item.sence_id }
            }));
        } else {
            // 普通网页环境
            window.open(`/community/detail/${item.community_id}`, '_blank')
        }
    }
}

// 发帖成功回调
const handlePostSuccess = (community: Community) => {
    jumpToCommunity(community)
}
// 生成场景截图
const captureSceneImage = async (sence_id: number): Promise<string | null> => {
    if (!threeCore.value || !threeCore.value.renderer) {
        console.error('场景未初始化')
        return null
    }

    try {
        // 确保场景已渲染
        threeCore.value.renderer.render(threeCore.value.scene, threeCore.value.camera)

        // 从渲染器的 canvas 获取数据
        const canvas = threeCore.value.renderer.domElement
        let width = canvas.width
        let height = canvas.height

        // 计算是否需要压缩
        let scale = 1
        if (width > 2048 || height > 2048) {
            scale = Math.min(2048 / width, 2048 / height)
            width = Math.floor(width * scale)
            height = Math.floor(height * scale)
        }

        // 创建新的 canvas，用于添加白色背景和可能的压缩
        const finalCanvas = document.createElement('canvas')
        finalCanvas.width = width
        finalCanvas.height = height
        const ctx = finalCanvas.getContext('2d')

        if (!ctx) {
            console.error('无法创建 canvas context')
            return null
        }

        // 填充白色背景
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // 使用高质量缩放
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // 将原 canvas 绘制到新 canvas（如果需要压缩，会自动缩放）
        ctx.drawImage(canvas, 0, 0, width, height)

        // 使用 JPEG 格式，质量设置为 0.9
        const dataURL = finalCanvas.toDataURL('image/jpeg', 0.9)

        // 将 base64 转换为 Blob，再转换为 File
        const response = await fetch(dataURL)
        const blob = await response.blob()
        const file = new File([blob], 'scene_cover.jpg', { type: 'image/jpeg' })

        // 上传到 OSS，使用 sence_cover 作为路径前缀
        const uploadResult = await uploadFileToOSS(file, 'sence_cover', `cover_${sence_id}`)

        return uploadResult.file_url
    } catch (error) {
        console.error('生成场景截图失败:', error)
        return null
    }
}

const saveScene = async () => {
    if (!threeCore.value) return
    const json_data = threeCore.value.saveSceneToJSON()
    // 灯光配置已经在 saveSceneToJSON 中自动保存了
    const params: {
        json_data: typeof json_data
        sence_cover?: string
    } = {
        json_data
    }
    console.log('保存的数据', json_data)

    if (add_mode.value) {
        if (loading.value) {
            toast.add({
                title: '请求中……',
                icon: 'i-heroicons-check-circle',
                color: 'green'
            })
            return
        }
        loading.value = true

        try {
            // 先生成并上传场景图
            const res = await insertScene(params)
            const sence_cover = await captureSceneImage(res.sence_id)
            if (sence_cover) {
                updateScene({
                    sence_id: res.sence_id,
                    sence_cover: `${sence_cover}?${Date.now()}`
                })
            }

            // 保存成功后跳转到对应id的场景
            toast.add({
                title: '保存成功',
                icon: 'i-heroicons-check-circle',
                color: 'green'
            })
            window.location.replace(`/scene/detail/${res.sence_id}`)
            // 跳转逻辑
            // const isInUniApp =
            //     typeof window !== 'undefined' &&
            //     navigator.userAgent.includes('Html5Plus');

            // if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
            //     // UniApp WebView 环境
            //     uni.navigateTo({
            //         url: `/pages/scene/detail/detail?id=${res.sence_id}`,
            //         fail: () => {
            //             console.log('跳转错误')
            //         }
            //     });
            // } else {
            //     if (port.value) {
            //         // 鸿蒙系统
            //         port.value.postMessage(JSON.stringify({
            //             type: 'jump',
            //             path: 'SceneDetail',
            //             params: {
            //                 id: res.sence_id
            //             }
            //         }));
            //     } else {
            //         // 普通网页环境
            //         navigateTo(`/scene/detail/${res.sence_id}`)
            //     }
            // }
            // const communityParams = {
            //     title: '3D帖子',
            //     content: `<p><iframe style="width:100%; height:60vh" frameborder="0" allowfullscreen
            //     mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking"
            //     xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share
            //     src="https://lolitalibrary.com/scene/detail/${res.sence_id}"> </iframe></p>`,
            //     type: '3D',
            //     sence_id: res.sence_id
            // }
            // try {
            //     const community = await insertCommunity(communityParams)
            //     jumpToCommunity(community)
            //     toast.add({
            //         title: '新增成功',
            //         icon: 'i-heroicons-check-circle',
            //         color: 'green'
            //     })
            // } catch (error) {
            //     console.error('创建社区帖子失败:', error)
            // }
        } catch (error) {
            console.error('保存场景失败:', error)
            toast.add({
                title: '保存失败',
                icon: 'i-heroicons-x-circle',
                color: 'red'
            })
        } finally {
            loading.value = false
        }
    } else {
        if (loading.value) {
            toast.add({
                title: '请求中……',
                icon: 'i-heroicons-check-circle',
                color: 'green'
            })
            return
        }
        loading.value = true
        const sence_cover = await captureSceneImage(Number.parseInt(id))
        if (sence_cover) {
            params.sence_cover = `${sence_cover}?${Date.now()}`
        }
        updateScene({
            ...params,
            sence_id: Number.parseInt(id)
        })
            .then((res) => {
                toast.add({
                    title: '保存成功',
                    icon: 'i-heroicons-check-circle',
                    color: 'green'
                })
            })
            .finally(() => {
                loading.value = false
            })
    }
}
const onUpdateFiles = async (resault) => {
    if (!threeCore.value) return
    const mesh = await threeCore.value.loadImageMesh(BASE_IMG + resault.file_url)
    console.log('当前面片', mesh)
    threeCore.value.scene.add(mesh)
}
const addBackgroun = async (resault) => {
    if (!threeCore.value) return
    threeCore.value.background = resault.file_url
    // 清除纯色背景
    threeCore.value.scene.background = null
}
const addText = async (resault: string) => {
    if (!threeCore.value) return
    const charset = resault
    const font = await createFont({ charset })
    const mesh = await threeCore.value.addTextToScene(BASE_IMG + font.file_url, charset)
    console.log('文本返回', mesh)
    mesh.userData.url = font.file_url
    threeCore.value.scene.add(mesh)
}

onUnmounted(() => {
    // 移除变换控件的撤销监听，避免 dispose 后仍被触发
    const listeners = transformUndoListeners.value
    const core = threeCore.value
    if (listeners && core?.transformControls) {
        core.transformControls.removeEventListener('mouseDown', listeners.onMouseDown)
        core.transformControls.removeEventListener('mouseUp', listeners.onMouseUp)
        transformUndoListeners.value = null
    }
    disposeScene(document.getElementById('scene') || undefined)

    // 恢复 body 样式
    if (process.client) {
        document.body.style.width = ''
        document.body.style.height = ''
        document.body.style.overflow = ''
    }
})

const setMode = (type: 'translate' | 'scale' | 'rotate') => {
    if (!threeCore.value) return
    transformType.value = type
    threeCore.value.transformControls.setMode(type)
}

/** 撤销操作（当前支持移动/缩放/旋转，预留扩展） */
const handleUndo = () => {
    if (!threeCore.value || !canUndo.value) return
    const ok = performUndo(threeCore.value.scene)
    if (ok) {
        toast.add({ title: '已撤销', icon: 'i-heroicons-arrow-uturn-left' })
    }
}

const lookAtCameraState = (item: CameraState) => {
    if (!threeCore.value) return
    threeCore.value.lookAtCameraState(item)
}

const initThreejs = async () => {
    const sceneElement = document.getElementById('scene')
    if (sceneElement) {
        // 判断场景数据中是否有点云类型的对象
        const hasSplatObject = detail.value?.json_data?.objects?.some(
            (obj: SceneObjectJSON) => obj.type === 'splat'
        ) ?? false
        
        await initScene(sceneElement, id, {
            editMode: edit_mode.value,
            baseUrl: BASE_IMG,
            sceneData: detail.value,
            enableRaycaster: hasSplatObject
        })
        
        // 场景加载完成后，灯光配置已经在 loadSceneFromJSON 中自动应用了
        // 如果没有保存的灯光配置，使用默认预设
        if (threeCore.value && !detail.value?.json_data?.lighting) {
            applyLightPreset('default', true)
        }

        // 编辑模式下：监听变换控件的拖拽，记录撤销状态（预留扩展其他操作）
        if (threeCore.value && edit_mode.value) {
            const tc = threeCore.value.transformControls
            const onMouseDown = () => {
                const obj = (tc as { object?: THREE.Object3D }).object
                if (obj) {
                    pendingTransformState.value = {
                        objectUuid: obj.uuid,
                        state: cloneTransformState(obj)
                    }
                }
            }
            const onMouseUp = () => {
                if (pendingTransformState.value) {
                    pushTransformUndo(
                        pendingTransformState.value.objectUuid,
                        pendingTransformState.value.state,
                        '移动/缩放/旋转'
                    )
                    pendingTransformState.value = null
                }
            }
            tc.addEventListener('mouseDown', onMouseDown)
            tc.addEventListener('mouseUp', onMouseUp)
            transformUndoListeners.value = { onMouseDown, onMouseUp }
        }

        // 如果是编辑模式，添加坐标系和无限地面
        if (threeCore.value && edit_mode.value && false) {
            // 添加坐标系（AxesHelper）
            const axesHelper = new THREE.AxesHelper(10) // 5 个单位长度
            axesHelper.userData.ignorePick = true // 不参与拾取
            threeCore.value.scene.add(axesHelper)

            // 添加无限地面网格（使用 InfiniteGridHelper）
            // 参数：size1 (次要网格), size2 (主要网格), color, distance (淡出距离), axes
            const gridHelper = new InfiniteGridHelper(
                1,  // size1 - 次要网格线大小
                5,  // size2 - 主要网格线大小
                new THREE.Color(0xcfd3dc),  // color - 网格颜色
                30, // distance - 淡出距离（30 会让淡出效果更好）
                'xzy' // axes - 轴方向（xzy 表示在 XZ 平面上）
            )
            gridHelper.position.y = 0
            gridHelper.userData.ignorePick = true // 不参与拾取
            threeCore.value.scene.add(gridHelper)
            // 注意：InfiniteGridHelper 会自动跟随相机，不需要手动更新位置
        }
    }
}

onMounted(async () => {
    // 设置 body 样式
    if (process.client) {
        document.body.style.width = '100vw'
        document.body.style.height = '100vh'
        document.body.style.overflow = 'hidden'
    }
    
    uni = await import('@dcloudio/uni-webview-js').catch((err) => {
        console.error('Failed to load uni-webview-js:', err);
    });
    // 初始化移动端检测
    configStore.initMobileDetection()
    setTimeout(async () => {
        await initThreejs()
        // 如果是手机端，默认关闭阴影
        if (configStore.isMobile && threeCore.value?.renderer) {
            changeShadowQuality('off')
        }
    })
    // 撤销快捷键 Ctrl+Z / Cmd+Z
    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement
        const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
        // Ctrl/Cmd+Z 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (isInput) return
            e.preventDefault()
            if (edit_mode.value && canUndo.value) handleUndo()
            return
        }
        // R 旋转、G 移动、S 缩放（仅编辑模式且未在输入框）
        if (!isInput && edit_mode.value && clickObject.value?.length) {
            const key = e.key.toLowerCase()
            if (key === 'r') {
                e.preventDefault()
                setMode('rotate')
            } else if (key === 'g') {
                e.preventDefault()
                setMode('translate')
            } else if (key === 's') {
                e.preventDefault()
                setMode('scale')
            }
        }
    }
    if (process.client) {
        document.addEventListener('keydown', onKeyDown)
        onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
    }
})

const isMobile = computed(() => configStore.isMobile);
useHead({
    title: '3D手账',
    meta: [
        {
            name: 'keywords',
            content: '3D手账'
        },
        {
            name: 'description',
            content: 'Lo研社 Lolita服饰与文化研习社'
        }
    ]
})
</script>
<template>
    <div class="select-none touch-callout-none"
        :style="{ background: threeCore && threeCore.background && !threeCore.background.startsWith('color:') ? `url(${BASE_IMG}${threeCore.background})` : '', backgroundSize: 'cover' }">
        <div v-if="detail && userStore.user?.user_id === detail?.user_id"
            class="fixed top-[60px] right-4 z-50 flex items-center gap-3">
            <button @click="showPostModal = true"
                class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">发帖分享</span>
            </button>
            <button @click="handleShare"
                class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
                <span class="text-xl">🔗</span>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">分享</span>
            </button>
        </div>
        <!-- 场景加载状态 -->
        <div v-if="sceneLoading || sceneLoadError && id !== '0'"
            class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-50">
            <!-- 加载中 -->
            <template v-if="sceneLoading && !sceneLoadError">
                <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
                <p class="mt-4 text-purple-600 tracking-widest font-bold">
                    <span v-if="sceneLoadProgress.total > 0">
                        正在加载场景... {{ sceneLoadProgress.current }} / {{ sceneLoadProgress.total }}
                    </span>
                    <span v-else>
                        正在初始化...
                    </span>
                </p>
            </template>

            <template v-else-if="sceneLoadError">
                <div class="flex flex-col items-center gap-4">
                    <div class="w-16 h-16 flex items-center justify-center">
                        <UIcon name="material-symbols:error-outline" class="text-6xl text-red-500" />
                    </div>
                    <p class="text-red-600 font-bold text-lg">加载失败</p>
                    <p class="text-gray-600 text-sm max-w-md text-center px-4">{{ sceneLoadError }}</p>
                    <UButton color="purple" @click="initThreejs" class="mt-2">
                        重试
                    </UButton>
                </div>
            </template>
        </div>

        <!-- 场景保存中全屏 Loading -->
        <div
            v-if="loading"
            class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
            <div
                class="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/90 dark:bg-gray-900/90 shadow-2xl border border-white/60 dark:border-gray-700"
            >
                <div class="w-8 h-8 border-3 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        正在保存场景...
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                        请不要关闭页面或刷新浏览器
                    </span>
                </div>
            </div>
        </div>

        <SceneTextureEditor ref="SceneTextureEditorRef" v-if="target" :target="target"
            :image-url="BASE_IMG + threeCore?.background" @close="target = null" />

        <!-- 左侧功能列表 - 参考右侧悬浮按钮样式，默认展开，收起动画优化为内容区过渡 -->
        <div
            class="fixed left-0 z-[20] flex flex-col rounded-r-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden top-1/2 -translate-y-1/2 max-h-[75vh] z-[30] transition-[width] duration-300 ease-in-out"
            :class="showToolbar ? 'w-[52px] sm:w-[56px]' : 'w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="shrink-0 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                :class="showToolbar ? 'flex items-center justify-center gap-1.5 py-2 px-2 border-b border-gray-100 dark:border-gray-600' : 'flex flex-col items-center justify-center min-h-[52px] w-full py-2'"
                :title="showToolbar ? '收起' : '展开'"
                @click="showToolbar = !showToolbar"
            >
                <UIcon
                    :name="showToolbar ? 'material-symbols:chevron-left' : 'material-symbols:menu'"
                    class="text-xl sm:text-2xl transition-transform"
                />
            </button>
            <!-- 内容区用 max-h 过渡实现流畅收起，不使用 v-show 避免瞬间消失 -->
            <div
                class="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                :class="showToolbar ? 'max-h-[calc(75vh-52px)]' : 'max-h-0'"
            >
                <div class="overflow-y-auto overscroll-contain p-1.5 space-y-1.5 scrollbar-hide">
                    <!-- 保存 -->
                    <button v-if="edit_mode || add_mode" @click="saveScene"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group active:scale-95"
                        title="保存">
                        <div
                            class="w-7 h-7 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:save-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">保存</span>
                    </button>

                    <!-- 撤销 -->
                    <button v-if="edit_mode || add_mode" @click="handleUndo"
                        :class="[canUndo ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed', 'w-full flex flex-col items-center gap-1 p-1.5 rounded-xl transition-colors group active:scale-95']"
                        :title="canUndo ? `撤销 (${undoStack.length} 步)` : '暂无可撤销操作'"
                        :disabled="!canUndo">
                        <div class="relative">
                            <div
                                class="w-7 h-7 bg-gray-500 dark:bg-gray-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <UIcon name="i-heroicons-arrow-uturn-left" class="text-sm text-white" />
                            </div>
                            <span v-if="undoStack.length > 0"
                                class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-medium leading-none">
                                {{ undoStack.length > 99 ? '99+' : undoStack.length }}
                            </span>
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">撤销</span>
                    </button>

                    <!-- 图片 -->
                    <button v-if="edit_mode || add_mode" @click="openImageMenu"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group active:scale-95"
                        title="图片">
                        <div
                            class="w-7 h-7 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:add-photo-alternate-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">图片</span>
                    </button>

                    <!-- 点位 -->
                    <button v-if="edit_mode || add_mode" @click="openPointMenu"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors group active:scale-95"
                        title="点位">
                        <div
                            class="w-7 h-7 bg-amber-500 dark:bg-amber-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:location-on-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">点位</span>
                    </button>
                    <!-- 文本 -->
                    <button v-if="edit_mode || add_mode" @click="openTextMenu"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group active:scale-95"
                        title="文本">
                        <div
                            class="w-7 h-7 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:title-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">文本</span>
                    </button>

                    <!-- 素材 -->
                    <!-- <button v-if="edit_mode || add_mode" @click="showMaterial()"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group active:scale-95"
                        :class="materialListExpanded ? 'bg-purple-100 dark:bg-purple-900/40' : ''" title="素材">
                        <div
                            class="w-7 h-7 bg-purple-500 dark:bg-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:deployed-code-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">素材</span>
                    </button> -->

                    <!-- 服饰 -->
                    <!-- <button v-if="edit_mode || add_mode" @click="showClothing()"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors group active:scale-95"
                        :class="clothingListExpanded ? 'bg-pink-100 dark:bg-pink-900/40' : ''" title="服饰">
                        <div
                            class="w-7 h-7 bg-pink-500 dark:bg-pink-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:checkroom-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">服饰</span>
                    </button> -->

                    <!-- 特效 -->
                    <!-- <button v-if="edit_mode || add_mode" @click="showEffect()"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors group active:scale-95"
                        :class="effectListExpanded ? 'bg-orange-100 dark:bg-orange-900/40' : ''" title="特效">
                        <div
                            class="w-7 h-7 bg-orange-500 dark:bg-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:auto-fix-high-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">特效</span>
                    </button> -->
                    
                    <!-- 模版 -->
                    <!-- <button v-if="edit_mode || add_mode" @click="showTemplate()"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group active:scale-95"
                        :class="templateListExpanded ? 'bg-blue-100 dark:bg-blue-900/40' : ''" title="模版">
                        <div
                            class="w-7 h-7 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:dashboard-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">模版</span>
                    </button> -->
                    <!-- 记录镜头 -->
                    <button v-if="edit_mode || add_mode" @click="recordCamera"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors group active:scale-95"
                        title="记录镜头">
                        <div
                            class="w-7 h-7 bg-rose-500 dark:bg-rose-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:videocam-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">记录镜头</span>
                    </button>
                    <!-- 设置 -->
                    <button @click="openSettings"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group active:scale-95"
                        title="设置">
                        <div
                            class="w-7 h-7 bg-gray-500 dark:bg-gray-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:settings-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">设置</span>
                    </button>

                    <!-- 灯光 -->
                    <button v-if="edit_mode || add_mode" @click="openLightMenu"
                        class="w-full flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors group active:scale-95"
                        title="灯光">
                        <div
                            class="w-7 h-7 bg-yellow-500 dark:bg-yellow-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UIcon name="material-symbols:lightbulb-rounded" class="text-sm text-white" />
                        </div>
                        <span class="text-[9px] text-gray-700 dark:text-gray-200 font-medium leading-tight">灯光</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 五个独立的悬浮列表，展开后居中、固定高度，互不联动，同时只展开一个 -->
        <!-- 素材 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
            :class="materialListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[170px] sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%-124px)] -translate-y-1/2 h-[52px] w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors"
                :class="materialListExpanded ? 'border-b border-gray-100 dark:border-gray-600 flex' : 'min-h-[52px] block leading-[14px]'"
                :title="materialListExpanded ? '收起列表' : '展开列表'"
                @click="showMaterial()"
            >
                <UIcon
                    :name="materialListExpanded ? 'material-symbols:chevron-right' : 'carbon:model-alt'"
                    class="text-xl sm:text-2xl transition-transform"
                    :class="materialListExpanded ? '' : 'rotate-0'"
                />
                <span class="text-xs font-medium sm:inline">素材</span>
            </button>
            <div
                v-show="materialListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="material"
                    :load-template="false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>
        <!-- 服饰 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
            :class="clothingListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[170px] sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%-62px)] -translate-y-1/2 h-[52px] w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-gray-700/50 transition-colors"
                :class="clothingListExpanded ? 'border-b border-gray-100 dark:border-gray-600 flex' : 'min-h-[52px] block leading-[14px]'"
                :title="clothingListExpanded ? '收起列表' : '展开列表'"
                @click="showClothing()"
            >
                <UIcon
                    :name="clothingListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:checkroom-rounded'"
                    class="text-xl sm:text-2xl transition-transform"
                    :class="clothingListExpanded ? '' : 'rotate-0'"
                />
                <span class="text-xs font-medium sm:inline">服饰</span>
            </button>
            <div
                v-show="clothingListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="clothing"
                    :load-template="false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>
        <!-- 场景 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
            :class="sceneListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[170px] sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-1/2 -translate-y-1/2 h-[52px] w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-gray-700/50 transition-colors"
                :class="sceneListExpanded ? 'border-b border-gray-100 dark:border-gray-600 flex' : 'min-h-[52px] block leading-[14px]'"
                :title="sceneListExpanded ? '收起列表' : '展开列表'"
                @click="showScene()"
            >
                <UIcon
                    :name="sceneListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:landscape-rounded'"
                    class="text-xl sm:text-2xl transition-transform"
                    :class="sceneListExpanded ? '' : 'rotate-0'"
                />
                <span class="text-xs font-medium sm:inline">场景</span>
            </button>
            <div
                v-show="sceneListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="scene"
                    :load-template="false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>
        <!-- 特效 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
            :class="effectListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[170px] sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+62px)] -translate-y-1/2 h-[52px] w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                :class="effectListExpanded ? 'border-b border-gray-100 dark:border-gray-600 flex' : 'min-h-[52px] block leading-[14px]'"
                :title="effectListExpanded ? '收起列表' : '展开列表'"
                @click="showEffect()"
            >
                <UIcon
                    :name="effectListExpanded ? 'material-symbols:chevron-right' : 'icon-park-twotone:effects'"
                    class="text-xl sm:text-2xl transition-transform"
                    :class="effectListExpanded ? '' : 'rotate-0'"
                />
                <span class="text-xs font-medium sm:inline">特效</span>
            </button>
            <div
                v-show="effectListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="effect"
                    :load-template="false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>
        <!-- 模版 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
            :class="templateListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[170px] sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+124px)] -translate-y-1/2 h-[52px] w-[44px] sm:w-[48px]'"
        >
            <button
                type="button"
                class="items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors"
                :class="templateListExpanded ? 'border-b border-gray-100 dark:border-gray-600 flex' : 'min-h-[52px] block leading-[14px]'"
                :title="templateListExpanded ? '收起列表' : '展开列表'"
                @click="showTemplate()"
            >
                <UIcon
                    :name="templateListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:dashboard-rounded'"
                    class="text-xl sm:text-2xl transition-transform"
                    :class="templateListExpanded ? '' : 'rotate-0'"
                />
                <span class="text-xs font-medium sm:inline">模版</span>
            </button>
            <div
                v-show="templateListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="template"
                    :load-template="threeCore && threeCore.loadTemplate.length > 0 ? true : false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>

        <div style="height: 100vh; width: 100vw; overflow: hidden; " id="scene"></div>
        <div class="opera fixed z-20 md:flex items-center whitespace-nowrap"
            v-show="clickObject && edit_mode && !target" :class="[
                'md:absolute md:top-auto md:bottom-auto md:left-auto md:right-auto',
                'fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] md:w-auto md:translate-x-0 md:static'
            ]"
            :style="!isMobile && operaPosition ? { left: operaPosition.x + 40 + 'px', top: operaPosition.y - 100 + 'px' } : {}">
            <!-- <QhxJellyButton>
                
            </QhxJellyButton> -->
            <div
                class="opera p-3 bg-qhx-bg-card rounded-[30px] z-20 h-[60px] flex items-center whitespace-nowrap overflow-x-auto scrollbar-hide w-full md:w-auto shadow-lg border border-gray-100 dark:border-gray-700">
                <div class=" cursor-pointer px-3 flex-shrink-0" @click="setMode('translate')"
                    v-show="transformType !== 'translate'">移动</div>
                <div class=" cursor-pointer px-3 flex-shrink-0" @click="setMode('rotate')"
                    v-show="transformType !== 'rotate'">
                    旋转</div>
                <div class=" cursor-pointer px-3 flex-shrink-0" @click="setMode('scale')"
                    v-show="transformType !== 'scale'">缩放
                </div>
                <div class=" cursor-pointer px-3 flex-shrink-0" @click.stop="openObjectSettings"
                    v-if="clickObject && (clickObject[0].userData.type === 'image' || clickObject[0].userData.type === '3Dtext' || clickObject[0].userData.type === 'longtext')">
                    设置
                </div>
                <div class=" cursor-pointer px-3 flex-shrink-0" @click.stop="copyModel()"
                    v-if="clickObject && clickObject[0].userData.type === 'model'">复制</div>
                <div class=" cursor-pointer px-3 flex-shrink-0" @click.stop="showTexture()" v-if="canTexture">贴图</div>
                <div class=" cursor-pointer px-3 flex-shrink-0 text-red-500" @click.stop="deleteModel()">删除</div>
            </div>
        </div>
        <div class="camera-list fixed z-10 right-[10px] bottom-0 w-[40px] h-auto max-h-full" v-if="threeCore">
            <div class=" relative flex justify-center" v-for="(camera_list, index) in threeCore.cameraList">
                <QhxJellyButton>
                    <div class="text-center cursor-pointer" @click="lookAtCameraState(camera_list)">
                        <div class=" relative m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                            style="font-size: 22px">
                            <div
                                class="text-[#000] absolute left-0 top-0 h-[30px] w-[30px] flex items-center justify-center z-[1] text-[10px]">
                                {{ index + 1 }}</div>
                            <UIcon name="material-symbols:video-camera-back" class="text-[22px] text-[#ffffff]"></UIcon>
                        </div>
                    </div>
                </QhxJellyButton>
                <div v-if="edit_mode" class=" absolute right-[50px] top-0 flex">
                    <QhxJellyButton>
                        <div class="text-center cursor-pointer mr-2" @click="deleteCamera(index)">
                            <div class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                                style="font-size: 22px">
                                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
                            </div>
                        </div>
                    </QhxJellyButton>
                    <QhxJellyButton>
                        <div class="text-center cursor-pointer" @click="resetCamera(index)">
                            <div class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                                style="font-size: 22px">
                                <UIcon name="ri:reset-right-line" class="text-[22px] text-[#ffffff]" />
                            </div>
                        </div>
                    </QhxJellyButton>
                </div>
            </div>
        </div>
        <div @click.stop="(e) => {
            handleClickDiary(e, diary)
        }" class="fixed p-3 cursor-pointer bg-qhx-bg-card rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden"
            v-for="diary in diaryList" :style="{ left: diary.position?.x + 'px', top: diary.position?.y - 30 + 'px' }">
            {{ diary.title }}
        </div>
        <div @click.stop="handleClickLibrary(library)"
            class="fixed cursor-pointer bg-qhx-bg-card rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden"
            v-for="library in libraryList"
            :style="{ left: library.position?.x + 'px', top: library.position?.y - 30 + 'px' }">
            <div class=" flex items-center">
                <div>
                    <img :src="`${BASE_IMG}${library.cover}`"
                        class="w-16 h-16 object-cover rounded-[60px] border border-gray-200 my-2 cursor-pointer"
                        loading="lazy" />
                </div>
                <div class="p-2">{{ library.title }}</div>
            </div>
        </div>
        <SceneMaterial v-if="edit_mode && layoutReady" @recordCamera="recordCamera" @chooseTemplate="chooseTemplate"
            @choose-material="chooseMaterial" @clearTemplate="clearTemplate" @addDiary="addDiary" @saveScene="saveScene"
            @addImage="onUpdateFiles" @addBackgroun="addBackgroun" @choose-effect="chooseEffect" @addText="addText"
            ref="MaterialRef" :loadTemplate="threeCore && threeCore.loadTemplate.length > 0 ? true : false">
        </SceneMaterial>
        <QhxModal v-model="showDiary" :trigger-position="clickPosition">
            <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto"
                v-if="activeDiary && !edit_mode">
                <div>{{ activeDiary.title }}</div>
                <div>{{ activeDiary.content }}</div>
            </div>
            <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto"
                v-if="activeDiary && edit_mode">
                <UInput v-model="activeDiary.title" :placeholder="'标题'" class="flex-1 focus:ring-0" :ui="{
                    base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                    rounded: 'rounded-[10px]',
                    padding: { xs: 'px-4 py-2' },
                    color: {
                        white: {
                            outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                        }
                    }
                }" />
                <UTextarea v-model="activeDiary.content" :placeholder="'内容'" type="texare"
                    class="flex-1 focus:ring-0 pt-3" :ui="{
                        base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                        rounded: 'rounded-[10px]',
                        padding: { xs: 'px-4 py-2' },
                        color: {
                            white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                            }
                        }
                    }" />
                <UButton type="submit" block class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
                    @click="editDiary()">
                    保存修改
                </UButton>
            </div>
        </QhxModal>
        <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
            <QhxBottomDrawer v-if="showSettings" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 500 : 450">
            <div class="py-2">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">场景设置</h3>
                    <button
                        @click="showSettings = false"
                        class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                        <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                    </button>
                </div>

                <!-- 光影设置区域 -->
                <div class="mb-6">
                    <h4 class="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">光影设置</h4>
                    
                    <!-- 阴影质量 -->
                    <div class="mb-4">
                        <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">阴影质量</div>
                        <USelect v-model="settingsState.shadowQuality" :options="shadowQualityOptions"
                            option-attribute="label" @update:model-value="changeShadowQuality" color="white" />
                    </div>

                    <!-- 镜头角度 -->
                    <div class="mb-2">
                        <div class="flex justify-between mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">镜头角度</span>
                            <span class="text-xs text-gray-500">{{ Math.round(settingsState.fov) }}°</span>
                        </div>
                        <URange v-model="settingsState.fov" :min="10" :max="120" :step="1"
                            @update:model-value="changeFov" />
                    </div>

                    <!-- 光源水平角度 -->
                    <div class="mb-2">
                        <div class="flex justify-between mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">光照方向(水平)</span>
                            <span class="text-xs text-gray-500">{{ Math.round(settingsState.lightAzimuth) }}°</span>
                        </div>
                        <URange v-model="settingsState.lightAzimuth" :min="0" :max="360" :step="1"
                            @update:model-value="updateLightPosition" />
                    </div>

                    <!-- 光源垂直角度 -->
                    <div class="mb-2">
                        <div class="flex justify-between mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">光照高度(垂直)</span>
                            <span class="text-xs text-gray-500">{{ Math.round(settingsState.lightElevation) }}°</span>
                        </div>
                        <URange v-model="settingsState.lightElevation" :min="0" :max="90" :step="1"
                            @update:model-value="updateLightPosition" />
                    </div>
                </div>

                <!-- 控制器设置区域 - 仅在编辑模式下显示 -->
                <template v-if="edit_mode || add_mode">
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 class="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">控制器设置</h4>
                        
                        <!-- 水平旋转角度范围 -->
                        <div class="mb-4">
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-700 dark:text-gray-300">水平旋转角度范围</span>
                                <span class="text-xs text-gray-500">
                                    {{ Math.round(settingsState.minAzimuthAngle) }}° ~ {{ Math.round(settingsState.maxAzimuthAngle) }}°
                                </span>
                            </div>
                            <QhxDualRange
                                v-model="azimuthRange"
                                :min="-180"
                                :max="180"
                                :step="1"
                            />
                        </div>

                        <!-- 垂直旋转角度范围 -->
                        <div class="mb-2">
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-700 dark:text-gray-300">垂直旋转角度范围</span>
                                <span class="text-xs text-gray-500">
                                    {{ Math.round(settingsState.minPolarAngle) }}° ~ {{ Math.round(settingsState.maxPolarAngle) }}°
                                </span>
                            </div>
                            <QhxDualRange
                                v-model="polarRange"
                                :min="0"
                                :max="180"
                                :step="1"
                            />
                        </div>
                    </div>
                </template>
            </div>
        </QhxBottomDrawer>
        </Transition>
        <QhxModal v-model="showObjectSettings" :trigger-position="clickPosition">
            <div class="p-6 w-[400px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">物体设置</h3>

                <!-- 3D文本设置 -->
                <template v-if="clickObject && clickObject[0] && clickObject[0].userData.type === '3Dtext'">
                    <!-- 文本颜色 -->
                    <div class="mb-4">
                        <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">颜色</div>
                        <div class="flex items-center gap-2">
                            <input type="color" v-model="objectSettingsState.color" @input="updateTextObject"
                                class="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            <span class="text-xs text-gray-500">{{ objectSettingsState.color }}</span>
                        </div>
                    </div>

                    <!-- 文本厚度 -->
                    <div class="mb-4">
                        <div class="flex justify-between mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">厚度</span>
                            <span class="text-xs text-gray-500">{{ objectSettingsState.depth }}</span>
                        </div>
                        <URange v-model="objectSettingsState.depth" :min="0.01" :max="2" :step="0.01"
                            @update:model-value="updateTextObject" />
                    </div>

                    <!-- 文本大小 -->
                    <div class="mb-2">
                        <div class="flex justify-between mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">大小</span>
                            <span class="text-xs text-gray-500">{{ objectSettingsState.size }}</span>
                        </div>
                        <URange v-model="objectSettingsState.size" :min="0.1" :max="5" :step="0.1"
                            @update:model-value="updateTextObject" />
                    </div>
                </template>

                <!-- 长文本设置 -->
                <template v-if="clickObject && clickObject[0] && clickObject[0].userData.type === 'longtext'">
                    <div class="mb-4">
                        <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">文本内容</div>
                        <UTextarea 
                            v-model="objectSettingsState.longText" 
                            placeholder="请输入长文本内容（支持多行）" 
                            :rows="8"
                            class="flex-1 focus:ring-0" 
                            :ui="{
                                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                                rounded: 'rounded-[10px]',
                                padding: { xs: 'px-4 py-2' },
                                color: {
                                    white: {
                                        outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                                    }
                                }
                            }" 
                        />
                    </div>
                    <div class="flex gap-3 justify-end">
                        <UButton 
                            color="gray" 
                            variant="outline" 
                            @click="showObjectSettings = false"
                        >
                            取消
                        </UButton>
                        <UButton 
                            color="primary" 
                            @click="updateLongTextObject"
                            :disabled="!objectSettingsState.longText.trim()"
                        >
                            保存
                        </UButton>
                    </div>
                </template>
            </div>
        </QhxModal>
        <QhxModal v-model="showTextMenu" :trigger-position="textMenuPosition">
            <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择文本类型</h3>

                <!-- 长文本选项 -->
                <button @click="selectLongText"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
                    <div
                        class="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:text-fields-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">长文本</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加多行文本</div>
                    </div>
                </button>

                <!-- 3D文本选项 -->
                <button @click="select3DText"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
                    <div
                        class="w-8 h-8 bg-indigo-500 dark:bg-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:title-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">3D文本</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加3D立体文本</div>
                    </div>
                </button>
            </div>
        </QhxModal>
        <QhxModal v-model="showLongTextModal" :trigger-position="longTextModalPosition">
            <div class="p-6 w-[500px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">添加长文本</h3>
                
                <div class="mb-4">
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">文本内容</div>
                    <UTextarea 
                        v-model="longTextContent" 
                        placeholder="请输入长文本内容（支持多行）" 
                        :rows="8"
                        class="flex-1 focus:ring-0" 
                        :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-[10px]',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                                white: {
                                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                                }
                            }
                        }" 
                    />
                </div>

                <div class="flex gap-3 justify-end">
                    <UButton 
                        color="gray" 
                        variant="outline" 
                        @click="cancelLongText"
                    >
                        取消
                    </UButton>
                    <UButton 
                        color="primary" 
                        @click="confirmLongText"
                        :disabled="!longTextContent.trim()"
                    >
                        确认
                    </UButton>
                </div>
            </div>
        </QhxModal>
        <QhxModal v-model="showPointMenu" :trigger-position="pointMenuPosition">
            <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择点位类型</h3>

                <!-- 日记点选项 -->
                <button @click="selectDiaryPoint"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
                    <div
                        class="w-8 h-8 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:edit-note-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">日记点</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加日记标记点</div>
                    </div>
                </button>

                <!-- 图鉴选项 -->
                <!-- <button
                    @click="selectLibraryPoint"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                >
                    <div class="w-8 h-8 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:book-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">图鉴</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加图鉴标记点</div>
                    </div>
                </button> -->

                <!-- 店铺选项 -->
                <!-- <button
                    @click="selectShopPoint"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                >
                    <div class="w-8 h-8 bg-green-500 dark:bg-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:store-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">店铺</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加店铺标记点</div>
                    </div>
                </button> -->
            </div>
        </QhxModal>
        <QhxModal v-model="showImageMenu" :trigger-position="imageMenuPosition">
            <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择类型</h3>

                <!-- 图片选项 -->
                <button @click="selectImage"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
                    <div
                        class="w-8 h-8 bg-green-500 dark:bg-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:add-photo-alternate-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">图片</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">添加图片到场景</div>
                    </div>
                </button>

                <!-- 背景选项 -->
                <button @click="selectBackground"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
                    <div
                        class="w-8 h-8 bg-cyan-500 dark:bg-cyan-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:wallpaper-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">背景</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">设置场景背景</div>
                    </div>
                </button>

                <!-- 纯色背景选项 -->
                <button @click="selectSolidColorBackground"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
                    <div
                        class="w-8 h-8 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:palette-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">纯色背景</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">选择纯色作为背景</div>
                    </div>
                </button>
            </div>
        </QhxModal>
        <QhxModal v-model="showLightMenu" :trigger-position="lightMenuPosition">
            <div class="p-4 w-[240px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择灯光预设</h3>

                <!-- 默认预设 -->
                <button @click="applyLightPreset('default')"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
                    :class="currentLightPreset === 'default' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''">
                    <div
                        class="w-8 h-8 bg-yellow-500 dark:bg-yellow-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:light-mode-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">默认</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">默认灯光配置</div>
                    </div>
                    <UIcon v-if="currentLightPreset === 'default'" name="material-symbols:check-circle-rounded"
                        class="text-yellow-500 text-lg" />
                </button>

                <!-- 温暖预设 -->
                <button @click="applyLightPreset('warm')"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                    :class="currentLightPreset === 'warm' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''">
                    <div
                        class="w-8 h-8 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:wb-sunny-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">温暖</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">温暖的暖色调灯光</div>
                    </div>
                    <UIcon v-if="currentLightPreset === 'warm'" name="material-symbols:check-circle-rounded"
                        class="text-yellow-500 text-lg" />
                </button>

                <!-- 冷调预设 -->
                <button @click="applyLightPreset('cool')"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                    :class="currentLightPreset === 'cool' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''">
                    <div
                        class="w-8 h-8 bg-cyan-500 dark:bg-cyan-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UIcon name="material-symbols:ac-unit-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">冷调</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">冷色调灯光效果</div>
                    </div>
                    <UIcon v-if="currentLightPreset === 'cool'" name="material-symbols:check-circle-rounded"
                        class="text-yellow-500 text-lg" />
                </button>
            </div>
        </QhxModal>

        <!-- 颜色选择器 -->
        <QhxColorPicker ref="colorPickerRef" @choose="setSolidColorBackground" />

        <!-- 发帖弹窗 -->
        <ClientOnly>
            <YearlySummaryPostModal v-model="showPostModal" :sence-id="Number.parseInt(id)" :skip-summary-link="true"
                @success="handlePostSuccess" />
        </ClientOnly>
    </div>
</template>
<style>
.left-box {
    height: 100vh;
    width: 20vw;
    /* background: #000; */
}

.right-box {
    height: 100vh;
    width: 30vw;
    /* background: #000; */
}

/* 隐藏滚动条但保持滚动功能 */
.scrollbar-hide {
    -ms-overflow-style: none;
    /* IE and Edge */
    scrollbar-width: none;
    /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari and Opera */
}

/* 手机端优化 */
@media (max-width: 768px) {
    .scrollbar-hide {
        max-height: calc(100vh - 2rem);
    }
}

</style>
