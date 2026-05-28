<script setup lang="ts">
import type { CameraState, SceneObjectJSON, SceneJSON } from '@/utils/threeCore';
import { sceneStepLabel, pruneSceneObjectIdFromSteps, resolveStepGroupRoot, labelForStepGroupRoot, isSceneStepContentRoot } from '@/utils/sceneSteps';
import type ThreeCore from '@/utils/threeCore';
import * as THREE from 'three';
import { updateScene, insertScene, getSceneId } from '@/api/scene'
import type { Community, Effect, Library, Material, Scene, TemplateInterface } from '@/types/api'
import { insertCommunity } from '@/api/community'
import type { DiaryInterface, LibraryInterface } from '@/types/sence'
import type SceneMaterial from '@/components/scene/Material.vue'
import type SceneTextureEditor from '@/components/scene/TextureEditor.vue'
import type SceneAnimationEditor from '@/components/scene/SceneAnimationEditor.vue'
import { isAnimatableSceneObject } from '@/composables/useSceneObjectAnimation'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
import { useSceneStore } from '@/stores/sence'
import { useConfigStore } from '@/stores/config'
import { createFont } from '~/api';
import { uploadFileToOSS } from '@/utils/ossUpload';
import { useSceneCore } from '@/composables/useSceneCore';
import { useSceneUndo, type TransformState } from '@/composables/useSceneUndo';
import CommunityPostModal from '@/components/community/CommunityPostModal.vue';
import SceneViewCube from '@/components/scene/SceneViewCube.vue';
import SceneStepEditor from '@/components/scene/SceneStepEditor.vue';
import SceneObjectLinkModal from '@/components/scene/SceneObjectLinkModal.vue';
import SceneObjectLinkDetailModal from '@/components/scene/SceneObjectLinkDetailModal.vue';
import type QhxStepGuide from '@/components/Qhx/StepGuide.vue';
import { useSceneEditGuide } from '@/composables/useSceneEditGuide';
import type { SceneEditGuidePanelKey, SceneEditGuideStep } from '@/utils/sceneEditGuide';
import {
    cloneSceneObjectLinks,
    collectSceneObjectsWithLinks,
    getLinkBadgeScreenPosition,
    getSceneObjectLinks,
    hasSceneObjectLinks,
    isLinkableSceneObject,
    setSceneObjectLinks,
    type SceneObjectLink
} from '@/utils/sceneObjectLink';
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig';
import { CharacterTypeController } from '@/utils/characterTypeController';
import type { CharacterTypeConfig } from '@/utils/characterTypeController';
import {
    loadSceneGraphicsSettings,
    resolveRendererPixelRatio,
    saveSceneGraphicsSettings,
    settingsFromPreset,
    type SceneGraphicsPreset
} from '@/utils/sceneGraphicsSettings';
import { isGltfGlbModelMaterial, isSplatMaterial } from '@/utils/materiaModelKind';
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
/** 角色类型控制器（自定义素材 options.characterType） */
const roleControllers = ref<CharacterTypeController[]>([])

/** 左侧独立「动画」面板展开（与右侧列表块一致，与功能栏分离） */
const roleAnimationListExpanded = ref(false)
const showRoleAnimation = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = roleAnimationListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    if (!wasExpanded) {
        roleAnimationListExpanded.value = true
    } else {
        roleAnimationListExpanded.value = false
    }
}
type SceneRoleAnimationEntry = {
    key: string
    label: string
    controller: CharacterTypeController
    clips: string[]
}
const sceneRoleAnimationTree = computed((): SceneRoleAnimationEntry[] =>
    roleControllers.value.map((c, i) => ({
        key: `${c.modelUrl}-${i}`,
        label:
            c.config.id?.trim()
            || c.modelUrl.split('/').filter(Boolean).pop()
            || `角色${i + 1}`,
        controller: c as CharacterTypeController,
        clips: c.getClipNameList()
    }))
)
const pickSceneRoleAnimation = (
    ctrl: CharacterTypeController,
    clip: string
) => {
    ctrl.playUserSelectedAnimation(clip)
}

/**
 * 本页已加入场景（含角色控制）的模型 URL，同一地址禁止再次作为角色加载
 * 与 threeCore 内 URL 缓存一致，以完整 BASE_IMG+路径 为键
 */
const loadedRoleModelUrls = new Set<string>()

/**
 * 若选中/射线命中为某角色的子节点，找到其 CharacterTypeController 的 root
 */
const findRoleControllerIndexForObject = (object: THREE.Object3D): number => {
    return roleControllers.value.findIndex((c) => {
        if (c.root === object) {
            return true
        }
        let p: THREE.Object3D | null = object
        while (p) {
            if (p === c.root) {
                return true
            }
            p = p.parent
        }
        return false
    })
}

/**
 * 从场景中移除前：释放角色控制器、本地 URL 去重、返回 modelUrl 供 threeCore 清缓存
 */
const detachRoleControllerForObject = (object: THREE.Object3D): string | null => {
    const i = findRoleControllerIndexForObject(object)
    if (i < 0) {
        return null
    }
    const ctrl = roleControllers.value[i]
    if (!ctrl) {
        return null
    }
    const url = ctrl.modelUrl
    ctrl.dispose()
    roleControllers.value.splice(i, 1)
    loadedRoleModelUrls.delete(url)
    return url
}

/** 角色点击对话气泡（固定定位，据角色头侧上缘投影，约 5s 后消失） */
const showRoleDialog = ref(false)
const roleDialogStyle = ref<Record<string, string>>({ left: '0px', top: '0px' })
const roleDialogTitle = ref('对话')
const roleDialogMessage = ref('')
const roleDialogAutoCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const pickRoleDialogueMessage = (cfg?: CharacterTypeConfig | null): string => {
    if (!cfg) {
        return '点我继续播放下一个动作~'
    }
    if (cfg.dialogueLines?.length) {
        const i = Math.floor(Math.random() * cfg.dialogueLines.length)
        return cfg.dialogueLines[i] ?? '…'
    }
    if (cfg.dialogueText?.trim()) {
        return cfg.dialogueText.trim()
    }
    return '点我继续播放下一个动作~'
}

const pickRoleDialogueTitle = (cfg?: CharacterTypeConfig | null) =>
    cfg?.dialogueTitle?.trim() || '对话'

/** 取角色包围盒上缘中点在屏幕上的位置（用于挂气泡） */
const getCharacterDialogScreenAnchor = (root: THREE.Object3D) => {
    if (!threeCore.value?.camera) {
        return { x: window.innerWidth / 2, y: window.innerHeight * 0.28 }
    }
    const box = new THREE.Box3().setFromObject(root)
    if (box.isEmpty()) {
        return threeCore.value.screenPositionFromObject(root)
    }
    // 世界空间包围盒顶面中心（头/上半身附近）
    const v = new THREE.Vector3(
        (box.min.x + box.max.x) * 0.5,
        box.max.y,
        (box.min.z + box.max.z) * 0.5
    )
    v.project(threeCore.value.camera)
    return {
        x: ((v.x + 1) * window.innerWidth) / 2,
        y: ((-v.y + 1) * window.innerHeight) / 2
    }
}

const BUBBLE_W = 280
const PADDING = 8

const clearRoleDialogTimer = () => {
    const t = roleDialogAutoCloseTimer.value
    if (t) {
        clearTimeout(t)
        roleDialogAutoCloseTimer.value = null
    }
}

/**
 * 在角色头侧右上方显示对话气泡，5 秒后自动消失
 * @param characterRoot 角色根节点（与 CharacterTypeController.root 一致）
 */
const openRoleDialogue = (
    cfg: CharacterTypeConfig | null | undefined,
    characterRoot: THREE.Object3D
) => {
    if (!import.meta.client) {
        return
    }
    clearRoleDialogTimer()
    const ax = getCharacterDialogScreenAnchor(characterRoot)
    // 气泡主体在锚点右上方：左侧 = 头右侧偏移，上缘 = 头上方向上浮
    let left = ax.x + 12
    let top = ax.y - 6
    const estH = 100
    top -= estH
    if (left + BUBBLE_W + PADDING > window.innerWidth) {
        left = window.innerWidth - BUBBLE_W - PADDING
    }
    if (left < PADDING) {
        left = PADDING
    }
    if (top < PADDING) {
        top = ax.y + 16
    }
    if (top + estH + PADDING > window.innerHeight) {
        top = Math.max(PADDING, window.innerHeight - estH - PADDING)
    }
    roleDialogStyle.value = {
        left: `${left}px`,
        top: `${top}px`,
        width: `${BUBBLE_W}px`
    }
    roleDialogTitle.value = pickRoleDialogueTitle(cfg)
    roleDialogMessage.value = pickRoleDialogueMessage(cfg)
    showRoleDialog.value = true
    roleDialogAutoCloseTimer.value = setTimeout(() => {
        showRoleDialog.value = false
        roleDialogAutoCloseTimer.value = null
    }, 5000)
}

const closeRoleDialog = () => {
    clearRoleDialogTimer()
    showRoleDialog.value = false
}

/**
 * 场景 JSON 加载后，将 threeCore 中 type: character 的条目补挂 CharacterTypeController
 */
const rehydrateSceneCharacterControllers = () => {
    const core = threeCore.value
    if (!core || !import.meta.client) {
        return
    }
    const items = core.takePendingCharacterRehydrations()
    for (const { mesh, modelUrl, config } of items) {
        if (loadedRoleModelUrls.has(modelUrl)) {
            continue
        }
        const cfg = config as unknown as CharacterTypeConfig
        if (!cfg?.stand?.primary) {
            continue
        }
        try {
            const ctrl = new CharacterTypeController({
                core,
                root: mesh,
                modelUrl,
                config: cfg
            })
            if (core.renderer?.domElement && core.camera) {
                ctrl.attachClick(core.renderer.domElement, core.camera)
                ctrl.setOnClick((ctx) => {
                    openRoleDialogue(cfg, ctx.controller.root)
                })
                roleControllers.value.push(ctrl)
                loadedRoleModelUrls.add(modelUrl)
            }
        } catch (e) {
            console.error('[rehydrateSceneCharacterControllers]', e)
        }
    }
}

/** 角色演示用 GLB（相对 BASE_IMG 的路径） */
const ROLE_DEMO_GLB_PATH = 'material/4954a62cd251a643fba9dd3761a28359.glb'

/**
 * 加载固定路径的角色示例：按 glTF 内 clip 顺序，第 1 个为主站立、其余为扩展（在左侧「动画」中切换；播完回主站立）
 */
const loadRoleDemoGlb = async () => {
    if (!threeCore.value) {
        return
    }
    if (!import.meta.client) {
        return
    }
    const modelUrl = `${BASE_IMG}${ROLE_DEMO_GLB_PATH}`
    if (loadedRoleModelUrls.has(modelUrl)) {
        toast.add({
            title: '角色示例',
            description: '该角色已加载，请勿重复添加',
            color: 'amber'
        })
        return
    }
    sceneStore.setLoading(true)
    try {
        const mesh = await threeCore.value.loadModel(modelUrl, {
            useDracoLoader: true,
            dracoDecoderPath: '/draco/gltf/',
            skipDefaultAnimations: true
        })
        const clips = threeCore.value.getLoadedAnimationClips(modelUrl)
        if (!clips?.length) {
            const p = getScreenCenter()
            mesh.position.set(p.x, p.y, p.z)
            stampAndAddSceneObject(mesh)
            loadedRoleModelUrls.add(modelUrl)
            toast.add({
                title: '角色示例',
                description: '该 glb 无动画，仅添加模型到场景',
                color: 'amber'
            })
            return
        }
        const standPrimary = clips[0].name
        const extraNames = clips.slice(1).map((c) => c.name)
        const config: CharacterTypeConfig = {
            id: 'demo-role-02c37',
            stand: { primary: standPrimary, primaryWeight: 1 },
            extras: extraNames,
            dialogueTitle: '角色示例',
            dialogueLines: [
                '欢迎来到这个场景~',
                '今天想四处看看吗？',
                '你好鸭',
                '这是一个角色类型的示例',
                '我期待可以把它做成OC展示平台哦'
            ]
        }
        const screen = getScreenCenter()
        mesh.position.set(screen.x, screen.y, screen.z)
        mesh.userData.type = 'character'
        threeCore.value.setOptionsModel(mesh, { characterType: config })
        stampAndAddSceneObject(mesh)
        if (threeCore.value.renderer?.domElement && threeCore.value.camera) {
            const ctrl = new CharacterTypeController({
                core: threeCore.value,
                root: mesh,
                modelUrl,
                config
            })
            ctrl.attachClick(
                threeCore.value.renderer.domElement,
                threeCore.value.camera
            )
            ctrl.setOnClick((ctx) => {
                openRoleDialogue(config, ctx.controller.root)
            })
            roleControllers.value.push(ctrl)
        }
        loadedRoleModelUrls.add(modelUrl)
        toast.add({
            title: '角色示例已加载',
            description: `站立: ${standPrimary}（共 ${clips.length} 个 clip）`
        })
    } catch (e) {
        console.error('[loadRoleDemoGlb]', e)
        toast.add({ title: '角色示例', description: '加载失败，请检查资源地址', color: 'red' })
    } finally {
        sceneStore.setLoading(false)
    }
}

let uni: any;

// 判断是否可替换贴图
const canObjectAnimation = computed(() => {
    if (!clickObject.value?.length) return false
    return isAnimatableSceneObject(clickObject.value[0])
})

const canTexture = computed(() => {
    let flag = false
    if (clickObject.value && clickObject.value.length > 0) {
        clickObject.value[0].traverse((child) => {
            if (child instanceof THREE.Mesh && child.name.includes('replace')) {
                flag = true
            }
        })
    }
    return flag
});

const MaterialRef = ref<InstanceType<typeof SceneMaterial> | null>(null)
const SceneTextureEditorRef = ref<InstanceType<typeof SceneTextureEditor> | null>(null)

/** 页面 DOM 背景（响应式；threeCore 为 shallowRef，直接改其 background 不会触发视图更新） */
const scenePageBackground = ref<string | null>(null)

function syncScenePageBackgroundFromCore() {
    scenePageBackground.value = threeCore.value?.background ?? null
}

/** 贴图编辑器默认底图：与根容器背景一致，纯色 color: 不设底图；兼容已是绝对 URL */
const textureEditorDefaultImageUrl = computed(() => {
    const bg = scenePageBackground.value
    if (!bg || typeof bg !== 'string') return ''
    const trimmed = bg.trim()
    if (!trimmed || trimmed.startsWith('color:')) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `${BASE_IMG}${trimmed.replace(/^\//, '')}`
})

/** 场景页背景：图片/纯色均走 DOM，WebGL 保持透明（避免 scene.background 盖住背面透明图） */
const scenePageBackgroundStyle = computed(() => {
    const bg = scenePageBackground.value
    if (!bg || typeof bg !== 'string') {
        return { backgroundSize: 'cover' as const }
    }
    if (bg.startsWith('color:')) {
        return {
            background: bg.slice('color:'.length),
            backgroundSize: 'cover' as const
        }
    }
    return {
        background: `url(${BASE_IMG}${bg})`,
        backgroundSize: 'cover' as const
    }
})

const route = useRoute()
/** 从站内 iframe 嵌入打开（如 /scene/detail/x?from_iframe=true）时隐藏发帖/分享浮层 */
const isFromIframeEmbed = computed(() => {
  const v = route.query.from_iframe
  return (Array.isArray(v) ? v[0] : v) === 'true'
})
const edit_mode = ref(false) // 编辑模式
const add_mode = ref(false)
const token = ref<string | null>(null) // 传入的token
// console.log(route.query, '路由')
const toast = useToast()
const userStore = useUserStore()
const clickPosition = ref({ x: 0, y: 0 })
const target: Ref<THREE.Mesh | null> = ref(null)
/** GSAP 物体动效编辑器目标（顶层场景对象） */
const animationTarget: Ref<THREE.Object3D | null> = ref(null)
const SceneAnimationEditorRef = ref<InstanceType<typeof SceneAnimationEditor> | null>(null)
const transformType = ref('translate')
const showToolbar = ref(Boolean(route.query?.edit || route.query?.add)) // 非编辑模式默认收起
watch([edit_mode, add_mode], ([edit, add]) => {
    if (!edit && !add) {
        showToolbar.value = false
    }
})

const {
    showGuide: showSceneEditGuide,
    guideSteps: sceneEditGuideSteps,
    guideStorageKey: sceneEditGuideStorageKey,
    onGuideStepChange,
    registerGuideLayoutHandlers,
    replayGuide: replaySceneEditGuide
} = useSceneEditGuide({
    editMode: edit_mode,
    addMode: add_mode,
    sceneLoading
})
const sceneEditGuideRef = ref<InstanceType<typeof QhxStepGuide> | null>(null)
/** 编辑模式或场景中已有角色时显示左侧「角色」面板 */
const showRoleAnimationPanel = computed(
    () => (edit_mode.value || add_mode.value) || sceneRoleAnimationTree.value.length > 0
)
// 六个独立的悬浮列表展开状态，互不联动，但同时只展开一个
const materialListExpanded = ref(false)
const clothingListExpanded = ref(false)
const sceneListExpanded = ref(false)
const effectListExpanded = ref(false)
const templateListExpanded = ref(false)
const customListExpanded = ref(false)
/** 左侧「贴图」面板（动画下方）：列出所有名称含 replace 的可替换 Mesh */
const textureListExpanded = ref(false)
/** 左侧「分组」面板：多场景 step 编辑 */
const sceneStepListExpanded = ref(false)
/** 分组模式：不隐藏物体，点击场景物体加入当前激活分组 */
const sceneStepGroupingMode = ref(false)
/** 分组编辑时临时隐藏的分组索引（同时仅允许一个） */
const hiddenGroupingStepIndex = ref<number | null>(null)
const sceneStepEditorRef = ref<InstanceType<typeof SceneStepEditor> | null>(null)

function applyGroupingStepVisibility() {
    const core = threeCore.value
    if (!core || !sceneStepGroupingMode.value) return
    core.applyGroupingStepHidden(hiddenGroupingStepIndex.value)
    refreshSceneStepHighlights()
}

function exitSceneStepGroupingMode() {
    sceneStepGroupingMode.value = false
    hiddenGroupingStepIndex.value = null
    threeCore.value?.transformControls.detach()
    clickObject.value = null
    if (!edit_mode.value && !add_mode.value && threeCore.value?.hasSceneSteps()) {
        currentSceneStepIndex.value = threeCore.value.applySceneStep(
            currentSceneStepIndex.value
        )
    } else {
        threeCore.value?.showAllStepManagedObjects()
    }
    refreshSceneStepHighlights()
}

function enterSceneStepGroupingMode() {
    sceneStepGroupingMode.value = true
    hiddenGroupingStepIndex.value = null
    ensureSceneObjectIdsForSteps()
    threeCore.value?.showAllStepManagedObjects()
    threeCore.value?.transformControls.detach()
    clickObject.value = null
    if (threeCore.value && threeCore.value.sceneSteps.length === 0) {
        threeCore.value.sceneSteps = [{ id: [] }]
        currentSceneStepIndex.value = 0
    }
    bumpSceneObjectRevision()
    refreshSceneStepHighlights()
    threeCore.value?.applySceneStepCamera(currentSceneStepIndex.value, { animate: false })
}

function closeSceneStepGroupingIfOpen() {
    if (!sceneStepListExpanded.value) return
    sceneStepListExpanded.value = false
    exitSceneStepGroupingMode()
}

function handleGroupingScenePick(obj: THREE.Object3D): boolean {
    if (!sceneStepGroupingMode.value || !threeCore.value) return false
    const root = resolveStepGroupRoot(obj, threeCore.value.scene)
    if (!root) {
        toast.add({
            title: '无法加入分组',
            description: '请点选场景中的模型、图片或点云',
            color: 'amber'
        })
        return true
    }
    if (!root.userData.id) {
        threeCore.value.assignSceneObjectId(root)
    }
    const ok = sceneStepEditorRef.value?.addObjectFromSceneObject(root) ?? false
    if (ok) {
        toast.add({
            title: '已加入当前分组',
            description: labelForStepGroupRoot(root),
            color: 'green'
        })
        bumpSceneObjectRevision()
        applyGroupingStepVisibility()
    }
    return true
}

type GuidePanelsSnapshot = {
    showToolbar: boolean
    roleAnimationListExpanded: boolean
    textureListExpanded: boolean
    sceneStepListExpanded: boolean
    materialListExpanded: boolean
    clothingListExpanded: boolean
    sceneListExpanded: boolean
    effectListExpanded: boolean
    templateListExpanded: boolean
    customListExpanded: boolean
}

let guidePanelsSnapshot: GuidePanelsSnapshot | null = null

function collapseAllGuideSideLists() {
    roleAnimationListExpanded.value = false
    textureListExpanded.value = false
    sceneStepListExpanded.value = false
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
}

function expandGuidePanel(panel: SceneEditGuidePanelKey) {
    collapseAllGuideSideLists()
    switch (panel) {
        case 'role':
            roleAnimationListExpanded.value = true
            break
        case 'texture':
            textureListExpanded.value = true
            break
        case 'material':
            materialListExpanded.value = true
            break
        case 'clothing':
            clothingListExpanded.value = true
            break
        case 'scene':
            sceneListExpanded.value = true
            break
        case 'effect':
            effectListExpanded.value = true
            break
        case 'template':
            templateListExpanded.value = true
            break
        case 'custom':
            customListExpanded.value = true
            break
    }
}

function captureGuidePanelsSnapshot() {
    guidePanelsSnapshot = {
        showToolbar: showToolbar.value,
        roleAnimationListExpanded: roleAnimationListExpanded.value,
        textureListExpanded: textureListExpanded.value,
        sceneStepListExpanded: sceneStepListExpanded.value,
        materialListExpanded: materialListExpanded.value,
        clothingListExpanded: clothingListExpanded.value,
        sceneListExpanded: sceneListExpanded.value,
        effectListExpanded: effectListExpanded.value,
        templateListExpanded: templateListExpanded.value,
        customListExpanded: customListExpanded.value
    }
}

function restoreGuidePanelsSnapshot() {
    const snap = guidePanelsSnapshot
    if (!snap) return
    showToolbar.value = snap.showToolbar
    roleAnimationListExpanded.value = snap.roleAnimationListExpanded
    textureListExpanded.value = snap.textureListExpanded
    sceneStepListExpanded.value = snap.sceneStepListExpanded
    materialListExpanded.value = snap.materialListExpanded
    clothingListExpanded.value = snap.clothingListExpanded
    sceneListExpanded.value = snap.sceneListExpanded
    effectListExpanded.value = snap.effectListExpanded
    templateListExpanded.value = snap.templateListExpanded
    customListExpanded.value = snap.customListExpanded
    guidePanelsSnapshot = null
}

function applySceneGuideStepLayout(step: SceneEditGuideStep) {
    const layout = step.layout
    if (!layout) return

    if (layout.collapseAllLists) {
        collapseAllGuideSideLists()
        const shouldCollapseToolbar =
            layout.collapseToolbar !== false && !layout.expandToolbar
        if (shouldCollapseToolbar) {
            showToolbar.value = false
        }
    }
    if (layout.expandToolbar) {
        showToolbar.value = true
    }
    if (layout.expandPanel) {
        expandGuidePanel(layout.expandPanel)
    }
}

function scheduleSceneGuideLayoutRefresh() {
    sceneEditGuideRef.value?.refreshLayout()
}

registerGuideLayoutHandlers({
    onOpen: captureGuidePanelsSnapshot,
    onClose: restoreGuidePanelsSnapshot,
    onStep: (step) => {
        applySceneGuideStepLayout(step)
        scheduleSceneGuideLayoutRefresh()
    }
})

/** 遍历场景顶层子树，收集全部可替换贴图网格（与悬浮条「贴图」判定一致） */
function collectReplaceTextureMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    for (const child of scene.children) {
        child.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.name.includes('replace')) {
                meshes.push(obj)
            }
        })
    }
    return meshes
}

function getSceneTopLevelRoot(obj: THREE.Object3D, scene: THREE.Scene): THREE.Object3D | null {
    let cur: THREE.Object3D | null = obj
    while (cur?.parent && cur.parent !== scene) {
        cur = cur.parent
    }
    return cur && cur.parent === scene ? cur : null
}

function textureReplaceableModelLabel(root: THREE.Object3D): string {
    const u = root.userData as Record<string, unknown>
    const title = u?.title
    if (typeof title === 'string' && title.trim()) return title.trim()
    const name = root.name?.trim()
    if (name) return name
    return `模型 ${root.uuid.slice(0, 8)}`
}

function textureReplaceableMeshLabel(mesh: THREE.Mesh): string {
    const scene = threeCore.value?.scene
    const meshLabel = mesh.name.trim() || 'replace'
    if (!scene) return meshLabel
    const root = getSceneTopLevelRoot(mesh, scene)
    if (!root || root === mesh) return meshLabel
    return `${textureReplaceableModelLabel(root)} · ${meshLabel}`
}

const textureSceneScanRev = ref(0)
const textureReplaceableMeshes = shallowRef<THREE.Mesh[]>([])

function bumpTextureReplaceableScan() {
    textureSceneScanRev.value++
}

watchEffect(() => {
    textureSceneScanRev.value
    if (!(edit_mode.value || add_mode.value)) {
        textureReplaceableMeshes.value = []
        return
    }
    const scene = threeCore.value?.scene
    if (!scene) {
        textureReplaceableMeshes.value = []
        return
    }
    textureReplaceableMeshes.value = collectReplaceTextureMeshes(scene)
})

watch(
    () => sceneStore.loading,
    (loading, prevLoading) => {
        if (prevLoading === true && loading === false) {
            bumpTextureReplaceableScan()
        }
    }
)

/** 等待 v-if 子组件挂载/卸载后与画布 ref 对齐 */
async function flushTextureEditorMount() {
    await nextTick()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

/**
 * 打开贴图编辑器：若当前已打开则先关闭（卸载组件），再挂载目标 mesh 并 showModel，避免同实例残留
 */
async function openTextureEditorForMesh(mesh: THREE.Mesh) {
    if (target.value) {
        target.value = null
        await flushTextureEditorMount()
    }
    target.value = mesh
    await flushTextureEditorMount()
    SceneTextureEditorRef.value?.showModel()
}

/** 选中列表中的 replace Mesh：聚焦其所属顶层模型并打开贴图编辑器（编辑目标为该 Mesh） */
async function pickReplaceMeshFromTextureToolbar(mesh: THREE.Mesh) {
    const core = threeCore.value
    if (!core || !(edit_mode.value || add_mode.value)) return

    const root = getSceneTopLevelRoot(mesh, core.scene)
    if (!root) return

    core.transformControls.attach(root)
    clickObject.value = [root]
    operaPosition.value = core.screenPositionFromObject(root)
    core.lookAtSelectObj([root])

    await openTextureEditorForMesh(mesh)
}

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
    // 始终按当前选中物体解析 replace 网格，避免上次编辑遗留的 target 导致换物体后贴图不回显
    if (!clickObject.value || clickObject.value.length === 0) return

    let found: THREE.Mesh | null = null
    clickObject.value[0].traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.includes('replace')) {
            found = child
        }
    })
    if (!found) return

    await openTextureEditorForMesh(found)
}

async function flushAnimationEditorMount() {
    await nextTick()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function openAnimationEditorForObject(obj: THREE.Object3D) {
    if (animationTarget.value) {
        animationTarget.value = null
        await flushAnimationEditorMount()
    }
    animationTarget.value = obj
    await flushAnimationEditorMount()
    SceneAnimationEditorRef.value?.showPanel()
}

const showObjectAnimation = async () => {
    if (!clickObject.value?.length || !threeCore.value) return
    const root = clickObject.value[0]
    if (!isAnimatableSceneObject(root)) return
    await openAnimationEditorForObject(root)
}

const copySceneObject = async () => {
    if (!threeCore.value) return
    if (!clickObject.value?.length) return
    const source = clickObject.value[0]
    const t = source.userData.type
    if (!source.userData.url) return

    if (t === 'image') {
        const mesh = await threeCore.value.loadImageMesh(source.userData.url)
        if (source.userData.follow) {
            mesh.userData.follow = true
        }
        mesh.position.copy(source.position)
        mesh.rotation.copy(source.rotation)
        mesh.scale.copy(source.scale)
        stampAndAddSceneObject(mesh)
        bumpTextureReplaceableScan()
        return
    }

    if (t !== 'model' && t !== 'character') return

    const mesh = await threeCore.value.loadModel(source.userData.url)
    if (source.userData.options) {
        threeCore.value.setOptionsModel(mesh, source.userData.options)
    }
    const links = cloneSceneObjectLinks(getSceneObjectLinks(source))
    if (links?.length) {
        mesh.userData.links = links
    }
    mesh.position.copy(source.position)
    mesh.rotation.copy(source.rotation)
    mesh.scale.copy(source.scale)
    stampAndAddSceneObject(mesh)
    bumpTextureReplaceableScan()
}

const sceneObjectLinkModalRef = ref<InstanceType<typeof SceneObjectLinkModal> | null>(null)
const sceneLinkDetailModalRef = ref<InstanceType<typeof SceneObjectLinkDetailModal> | null>(null)

const openSceneLinkDetailModal = (
    obj: THREE.Object3D,
    ev?: MouseEvent | TouchEvent
) => {
    const links = getSceneObjectLinks(obj)
    if (!links.length) return
    const pos = (() => {
        if (ev && 'clientX' in ev) {
            return { x: ev.clientX, y: ev.clientY }
        }
        if (ev && 'changedTouches' in ev && ev.changedTouches[0]) {
            const t = ev.changedTouches[0]
            return { x: t.clientX, y: t.clientY }
        }
        return undefined
    })()
    sceneLinkDetailModalRef.value?.open(links, pos)
}

const onLinkBadgeClick = (uuid: string, ev: MouseEvent) => {
    const core = threeCore.value
    if (!core) return
    const obj = core.scene.children.find(c => c.uuid === uuid)
    if (!obj) return
    openSceneLinkDetailModal(obj, ev)
}

const sceneOwnerUserId = computed(() => {
    const uid = detail.value?.user_id
    return typeof uid === 'number' && uid > 0 ? uid : userStore.user?.user_id ?? 0
})

const canEditObjectLinks = computed(() => {
    if (!(edit_mode.value || add_mode.value)) return false
    const obj = clickObject.value?.[0]
    return obj ? isLinkableSceneObject(obj) : false
})

const openObjectLinkEditor = () => {
    const obj = clickObject.value?.[0]
    if (!obj) return
    sceneObjectLinkModalRef.value?.show(getSceneObjectLinks(obj))
}

const onObjectLinksSave = (links: SceneObjectLink[]) => {
    const obj = clickObject.value?.[0]
    if (!obj) return
    setSceneObjectLinks(obj, links)
    updateLinkBadgeMarkers()
    toast.add({
        title: links.length ? '关联已保存' : '已清除关联',
        icon: 'i-heroicons-check-circle',
        color: 'green'
    })
}

/** 关联模型屏幕角标（包围盒右上投影） */
type SceneLinkBadgeMarker = {
    uuid: string
    count: number
    x: number
    y: number
}

const linkBadgeMarkers = ref<SceneLinkBadgeMarker[]>([])
let linkBadgeAnimCb: (() => void) | null = null

const updateLinkBadgeMarkers = () => {
    const core = threeCore.value
    if (!import.meta.client || !core?.camera) {
        linkBadgeMarkers.value = []
        return
    }
    const canvas = core.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
        linkBadgeMarkers.value = []
        return
    }
    const markers: SceneLinkBadgeMarker[] = []
    for (const obj of collectSceneObjectsWithLinks(core.scene)) {
        const screen = getLinkBadgeScreenPosition(obj, core.camera, {
            width: rect.width,
            height: rect.height
        })
        if (!screen?.visible) continue
        const count = getSceneObjectLinks(obj).length
        if (count <= 0) continue
        markers.push({
            uuid: obj.uuid,
            count,
            x: rect.left + screen.x,
            y: rect.top + screen.y
        })
    }
    linkBadgeMarkers.value = markers
}

const detachLinkBadgeAnimCb = () => {
    const core = threeCore.value
    if (!core || !linkBadgeAnimCb) return
    const idx = core.animationCallbacks.indexOf(linkBadgeAnimCb)
    if (idx >= 0) core.animationCallbacks.splice(idx, 1)
    linkBadgeAnimCb = null
}

const deleteModel = () => {
    if (!threeCore.value) return
    if (clickObject.value && clickObject.value.length > 0) {
        const toRemove = clickObject.value[0]
        const removedObjectId =
            typeof toRemove.userData?.id === 'string' ? toRemove.userData.id : ''
        if (toRemove.userData.type === 'diary') {
            const index = threeCore.value.loadedDiary.findIndex((child) => {
                return clickObject.value && child.object.uuid === toRemove.uuid
            })
            if (index !== -1) {
                threeCore.value.loadedDiary.splice(index, 1)
            }
        }
        threeCore.value.killObjectGsapAnimations(toRemove)
        if (animationTarget.value?.uuid === toRemove.uuid) {
            animationTarget.value = null
        }
        const evictUrl = detachRoleControllerForObject(toRemove)
        threeCore.value.clearGroup(toRemove)
        if (evictUrl) {
            threeCore.value.evictModelCacheIfOrphaned(evictUrl)
        }
        clickObject.value = null
        threeCore.value.transformControls.detach()
        if (removedObjectId && threeCore.value.hasSceneSteps()) {
            pruneSceneObjectIdFromSteps(threeCore.value.sceneSteps, removedObjectId)
            if (!sceneStepGroupingMode.value && !(edit_mode.value || add_mode.value)) {
                currentSceneStepIndex.value = threeCore.value.applySceneStep(
                    currentSceneStepIndex.value
                )
            }
            syncSceneStepUi()
            sceneStepEditorRef.value?.syncFromCore()
        }
        bumpSceneObjectRevision()
        bumpTextureReplaceableScan()
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
    closeSceneStepGroupingIfOpen()
    const wasExpanded = materialListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) materialListExpanded.value = true
}
const showClothing = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = clothingListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) clothingListExpanded.value = true
}
const showScene = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = sceneListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) sceneListExpanded.value = true
}
const showEffect = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = effectListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) effectListExpanded.value = true
}
const showTemplate = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = templateListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) templateListExpanded.value = true
}
const showCustom = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = customListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) customListExpanded.value = true
}
const showTextureList = () => {
    closeSceneStepGroupingIfOpen()
    const wasExpanded = textureListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) textureListExpanded.value = true
}

const showSceneStepList = () => {
    const wasExpanded = sceneStepListExpanded.value
    materialListExpanded.value = false
    clothingListExpanded.value = false
    sceneListExpanded.value = false
    effectListExpanded.value = false
    templateListExpanded.value = false
    customListExpanded.value = false
    textureListExpanded.value = false
    roleAnimationListExpanded.value = false
    if (!wasExpanded) {
        sceneStepListExpanded.value = true
        enterSceneStepGroupingMode()
    } else {
        sceneStepListExpanded.value = false
        exitSceneStepGroupingMode()
    }
}

const showSettings = ref(false)
const settingsState = reactive({
    shadowsEnabled: true,
    shadowQuality: 'high',
    cameraType: 'perspective' as 'perspective' | 'orthographic',
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

const cameraTypeOptions = [
    { label: '透视', value: 'perspective' },
    { label: '正交', value: 'orthographic' }
]

const sceneGraphicsPreset = ref<SceneGraphicsPreset>(
    loadSceneGraphicsSettings().preset
)
const graphicsPresetOptions = [
    { label: '省电', value: 'performance' },
    { label: '均衡', value: 'balanced' },
    { label: '高清', value: 'high' }
]

const onGraphicsPresetChange = (preset: string) => {
    const next = settingsFromPreset(preset as SceneGraphicsPreset)
    if (next.preset === sceneGraphicsPreset.value) return
    saveSceneGraphicsSettings(next)
    if (import.meta.client) {
        window.location.reload()
    }
}

function ensureSceneObjectIdsForSteps() {
    const core = threeCore.value
    if (!core) return
    const roots =
        core.options.enableAR && core.arContentGroup
            ? core.arContentGroup.children
            : core.scene.children
    for (const child of roots) {
        if (!isSceneStepContentRoot(child)) continue
        if (!child.userData?.id) {
            core.assignSceneObjectId(child)
        }
    }
}

const openSettings = (e: MouseEvent) => {
    clickPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }

    if (threeCore.value?.renderer) {
        if (threeCore.value.isShadowMapEnabled()) {
            // 如果开启，保持当前的 shadowQuality 或者默认为 high
            if (!settingsState.shadowQuality || settingsState.shadowQuality === 'off') {
                settingsState.shadowQuality = 'high'
            }
        } else {
            settingsState.shadowQuality = 'off'
        }
    }

    // 摄像机类型与镜头角度
    if (threeCore.value?.camera) {
        settingsState.cameraType = threeCore.value.camera instanceof THREE.OrthographicCamera
            ? 'orthographic'
            : 'perspective'
        if (threeCore.value.camera instanceof THREE.PerspectiveCamera) {
            settingsState.fov = threeCore.value.camera.fov
        }
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
        threeCore.value.setShadowMapEnabled(false)
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
        if (!threeCore.value.isShadowMapEnabled()) {
            threeCore.value.setShadowMapEnabled(true)
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

const changeCameraType = (val: string) => {
    if (!threeCore.value) return
    const t = val as 'perspective' | 'orthographic'
    threeCore.value.setCameraType(t)
    settingsState.cameraType = t
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
    longText: '', // 长文本内容
    follow: false // 图片是否面向相机
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
const showMoreMenu = ref(false)
const moreMenuPosition = ref({ x: 0, y: 0 })

const openMoreMenu = (e: MouseEvent) => {
    moreMenuPosition.value = {
        x: e.clientX + 50,
        y: e.clientY
    }
    showMoreMenu.value = true
}

const openScenePostFromMenu = () => {
    showMoreMenu.value = false
    showPostModal.value = true
}

const handleSceneShareFromMenu = async () => {
    showMoreMenu.value = false
    await handleShare()
}

const replaySceneEditGuideFromMenu = () => {
    showMoreMenu.value = false
    replaySceneEditGuide()
}

const showSceneSettings = ref(false)
const allowCopyUpdating = ref(false)

const openSceneSettingsFromMenu = () => {
    showMoreMenu.value = false
    showSceneSettings.value = true
}

const hasSceneOrigin = computed(() => {
    const origin = detail.value?.json_data?.origin
    return typeof origin === 'number' && Number.isFinite(origin) && origin > 0
})

const updateSceneAllowCopy = async (val: boolean) => {
    const sid = Number.parseInt(id, 10)
    if (!Number.isFinite(sid) || sid <= 0 || !detail.value) return
    if (allowCopyUpdating.value) return
    if (val && hasSceneOrigin.value) {
        toast.add({
            title: '无法开启',
            description: '由其他场景克隆而来的场景不可再被克隆',
            icon: 'i-heroicons-exclamation-circle',
            color: 'orange'
        })
        return
    }

    const value = val ? 1 : 0
    allowCopyUpdating.value = true
    try {
        await updateScene({ sence_id: sid, allow_copy: value })
        detail.value.allow_copy = value
        toast.add({
            title: '修改成功',
            icon: 'i-heroicons-check-circle',
            color: 'green'
        })
    } catch (error) {
        console.error('更新场景设置失败:', error)
        toast.add({
            title: '修改失败',
            icon: 'i-heroicons-exclamation-circle',
            color: 'red'
        })
    } finally {
        setTimeout(() => {
            allowCopyUpdating.value = false
        }, 300)
    }
}

const cloneSceneLoading = ref(false)
const showCloneSceneConfirm = ref(false)

/** allow_copy：0 不允许，1 允许（接口可能返回字符串） */
function isSceneAllowCopyEnabled(allowCopy?: number | string | null) {
    return Number(allowCopy) === 1
}

const sceneAllowCopyEnabled = computed(() => isSceneAllowCopyEnabled(detail.value?.allow_copy))

const isSceneOwner = computed(
    () => detail.value != null && userStore.user?.user_id === detail.value.user_id
)

const canCloneScene = computed(() => {
    if (!detail.value || id === '0') return false
    if (hasSceneOrigin.value) return false
    if (!sceneAllowCopyEnabled.value) return false
    const json = detail.value.json_data
    return json != null && Array.isArray(json.objects)
})

const showSceneCloneAction = computed(
    () => detail.value != null && canCloneScene.value
)

const showSceneOwnerActions = computed(
    () => detail.value != null && !isFromIframeEmbed.value && isSceneOwner.value
)

function openCloneSceneConfirm() {
    if (!userStore.user?.user_id) {
        toast.add({
            title: '请先登录',
            description: '登录后可克隆场景到自己的账号',
            icon: 'i-heroicons-exclamation-circle',
            color: 'orange'
        })
        return
    }
    const sourceId = Number.parseInt(id, 10)
    if (!Number.isFinite(sourceId) || sourceId <= 0 || !detail.value?.json_data) return
    if (!canCloneScene.value) return
    if (cloneSceneLoading.value || loading.value) return
    showCloneSceneConfirm.value = true
}

const cloneScene = async (): Promise<boolean> => {
    if (!userStore.user?.user_id) {
        toast.add({
            title: '请先登录',
            description: '登录后可克隆场景到自己的账号',
            icon: 'i-heroicons-exclamation-circle',
            color: 'orange'
        })
        return false
    }
    const sourceId = Number.parseInt(id, 10)
    if (!Number.isFinite(sourceId) || sourceId <= 0 || !detail.value?.json_data) return false
    if (!canCloneScene.value) return false
    if (cloneSceneLoading.value || loading.value) return false

    cloneSceneLoading.value = true
    try {
        const json_data = JSON.parse(JSON.stringify(detail.value.json_data)) as SceneJSON
        json_data.origin = sourceId
        const res = await insertScene({ json_data })
        toast.add({
            title: '克隆成功',
            description: '正在打开新场景',
            icon: 'i-heroicons-check-circle',
            color: 'green'
        })
        showCloneSceneConfirm.value = false
        await navigateTo(`/scene/detail/${res.sence_id}?edit=1`)
        return true
    } catch (error) {
        console.error('克隆场景失败:', error)
        toast.add({
            title: '克隆失败',
            icon: 'i-heroicons-x-circle',
            color: 'red'
        })
        return false
    } finally {
        cloneSceneLoading.value = false
    }
}

async function confirmCloneScene() {
    await cloneScene()
}

const scenePostForeignPk = computed(() => {
    const sid = Number.parseInt(id, 10)
    if (!Number.isFinite(sid)) return undefined
    return { pk_id: sid, pk_type: 3 }
})

const scenePostSenceId = computed(() => {
    const sid = Number.parseInt(id, 10)
    return Number.isFinite(sid) ? sid : undefined
})

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
            if (obj.userData.follow === undefined) {
                obj.userData.follow = false
            }
            objectSettingsState.follow = !!obj.userData.follow
            clickPosition.value = {
                x: operaPosition.value.x + 100,
                y: operaPosition.value.y
            }
            showObjectSettings.value = true
        }
    }
}

const onImageFollowChange = (v: boolean) => {
    if (clickObject.value?.[0]?.userData?.type === 'image') {
        clickObject.value[0].userData.follow = v
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
                    threeCore.value.assignSceneObjectId(
                        newMesh,
                        obj.userData.id as string | undefined
                    )
                    parent.add(newMesh)
                } else {
                    stampAndAddSceneObject(newMesh, obj.userData.id as string | undefined)
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
        const bg = threeCore.value?.background
        const initial =
            typeof bg === 'string' && bg.startsWith('color:') ? bg.slice('color:'.length) : undefined
        colorPickerRef.value.showModel(undefined, initial)
    }
}

// 设置纯色背景（仅 DOM + background 字段，不写入 scene.background，与图片背景一致）
const setSolidColorBackground = (color: string) => {
    if (!threeCore.value) return
    threeCore.value.scene.background = null
    const value = `color:${color}`
    threeCore.value.background = value
    scenePageBackground.value = value
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
        stampAndAddSceneObject(mesh)

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
    stampAndAddSceneObject(mesh)
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
    bumpTextureReplaceableScan()
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

/** 写入稳定 userData.id 后加入场景；savedId 用于恢复已保存对象（如编辑长文本） */
const stampAndAddSceneObject = (obj: THREE.Object3D, savedId?: string) => {
    if (!threeCore.value) return
    threeCore.value.assignSceneObjectId(obj, savedId)
    threeCore.value.scene.add(obj)
    if (threeCore.value.hasSceneSteps() && !sceneStepGroupingMode.value && !(edit_mode.value || add_mode.value)) {
        threeCore.value.applySceneStep(threeCore.value.currentStepIndex)
    }
    bumpSceneObjectRevision()
}

const currentSceneStepIndex = ref(0)
/** 编辑模式下全览：不按分组隐藏物体，顶部不选中任一阶段 */
const sceneStepShowAll = ref(false)
const sceneObjectRevision = ref(0)

function bumpSceneObjectRevision() {
    sceneObjectRevision.value += 1
}

function shouldShowSceneStepHighlights(): boolean {
    if (!threeCore.value?.hasSceneSteps()) return false
    if (!edit_mode.value && !add_mode.value) return false
    return sceneStepGroupingMode.value
}

function refreshSceneStepHighlights() {
    const core = threeCore.value
    if (!core) return
    if (!shouldShowSceneStepHighlights()) {
        core.clearStepGroupHighlights()
        return
    }
    core.syncStepGroupHighlights(currentSceneStepIndex.value)
}

watchEffect(() => {
    void sceneObjectRevision.value
    void currentSceneStepIndex.value
    void sceneStepGroupingMode.value
    void hiddenGroupingStepIndex.value
    void edit_mode.value
    void add_mode.value
    if (!threeCore.value) return
    if (sceneStepGroupingMode.value) {
        applyGroupingStepVisibility()
    } else {
        refreshSceneStepHighlights()
    }
})

function syncSceneStepUi() {
    const core = threeCore.value
    if (!core) return
    // 分组编辑模式下以面板 activeIndex 为准，勿用 core.currentStepIndex 覆盖（后者未随分组切换更新）
    if (sceneStepGroupingMode.value) return
    currentSceneStepIndex.value = core.currentStepIndex
}

function enterSceneStepOverview() {
    const core = threeCore.value
    if (!core?.hasSceneSteps()) return
    if (sceneStepShowAll.value) return
    sceneStepShowAll.value = true
    core.showAllStepManagedObjects()
    clickObject.value = null
    core.transformControls.detach()
    showRoleDialog.value = false
    clearRoleDialogTimer()
    bumpTextureReplaceableScan()
    updateLinkBadgeMarkers()
}

const switchSceneStep = (index: number) => {
    const core = threeCore.value
    if (!core?.hasSceneSteps()) return
    if (!sceneStepShowAll.value && index === currentSceneStepIndex.value) return
    sceneStepShowAll.value = false
    const animate = !(edit_mode.value || add_mode.value)
    currentSceneStepIndex.value = core.applySceneStep(index, { animate })
    clickObject.value = null
    core.transformControls.detach()
    showRoleDialog.value = false
    clearRoleDialogTimer()
    bumpTextureReplaceableScan()
    updateLinkBadgeMarkers()
    refreshSceneStepHighlights()
}

const onSceneStepEditorChange = () => {
    syncSceneStepUi()
    applyGroupingStepVisibility()
}
const chooseMaterial = async (item: Material) => {
    if (!threeCore.value) return
    const isModel = isGltfGlbModelMaterial(item)
    const isSplat = isSplatMaterial(item)
    if (isSplat) {
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
            stampAndAddSceneObject(group)
            
            // 调整相机视角
            // setTimeout(() => {
            //     threeCore.value!.lookAtSelectObj([group])
            // })
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
    } else if (isModel) {
        sceneStore.setLoading(true)
        try {
            const screenCenter = getScreenCenter()
            const modelUrl = BASE_IMG + item.materia_url
            const rawCt = item.options?.characterType as CharacterTypeConfig | undefined
            const hasCharacterType = Boolean(
                rawCt
                && typeof rawCt.stand?.primary === 'string'
                && rawCt.stand.primary.length > 0
            )
            if (hasCharacterType && loadedRoleModelUrls.has(modelUrl)) {
                if (process.client) {
                    toast.add({
                        title: '角色',
                        description: '该模型已作为角色加载，请勿重复添加',
                        color: 'amber'
                    })
                }
                return
            }
            const mesh = await threeCore.value.loadModel(modelUrl, {
                useDracoLoader: item.options?.useDracoLoader !== false,
                dracoDecoderPath: '/draco/gltf/',
                ...(hasCharacterType ? { skipDefaultAnimations: true } : {})
            })
            mesh.position.set(screenCenter.x, screenCenter.y, screenCenter.z)
            if (item.options) {
                threeCore.value.setOptionsModel(mesh, item.options)
            }
            if (hasCharacterType) {
                mesh.userData.type = 'character'
            }
            stampAndAddSceneObject(mesh)
            if (
                hasCharacterType
                && rawCt
                && threeCore.value.renderer?.domElement
                && threeCore.value.camera
            ) {
                try {
                    const config: CharacterTypeConfig = {
                        ...rawCt,
                        extras: Array.isArray(rawCt.extras) ? rawCt.extras : []
                    }
                    const ctrl = new CharacterTypeController({
                        core: threeCore.value,
                        root: mesh,
                        modelUrl,
                        config
                    })
                    ctrl.attachClick(
                        threeCore.value.renderer.domElement,
                        threeCore.value.camera
                    )
                    ctrl.setOnClick((ctx) => {
                        openRoleDialogue(config, ctx.controller.root)
                    })
                    roleControllers.value.push(ctrl)
                    loadedRoleModelUrls.add(modelUrl)
                } catch (roleErr) {
                    console.error('[characterType] 初始化失败', roleErr)
                    if (process.client) {
                        toast.add({
                            title: '角色动画',
                            description: '动作配置与模型不匹配，请检查 clip 名称',
                            color: 'amber'
                        })
                    }
                }
            }
            bumpTextureReplaceableScan()
        } catch (error) {
            console.error('加载素材失败:', error)
            if (process.client) {
                toast.add({
                    title: '加载失败',
                    description: '素材加载失败，请稍后重试',
                    color: 'red'
                })
            }
        } finally {
            sceneStore.setLoading(false)
        }
    } else {
        sceneStore.setLoading(true)
        try {
            const screenCenter = getScreenCenter()
            const mesh = await threeCore.value.loadImageMesh(BASE_IMG + item.materia_url)
            mesh.position.set(screenCenter.x, screenCenter.y, screenCenter.z)
            stampAndAddSceneObject(mesh)
        } catch (error) {
            console.error('加载素材失败:', error)
            if (process.client) {
                toast.add({
                    title: '加载失败',
                    description: '素材加载失败，请稍后重试',
                    color: 'red'
                })
            }
        } finally {
            sceneStore.setLoading(false)
        }
    }
}
/** 选择模版后先展示确认弹窗，确认后再写入场景 */
const showTemplateConfirmModal = ref(false)
const pendingTemplateItem = ref<TemplateInterface | null>(null)
const templateConfirmLoading = ref(false)

/**
 * 是否允许加载该模版（预留：后续可接入会员、购买、限免等校验）
 * @returns true 表示可加载
 */
const canUseTemplate = (_item: TemplateInterface): boolean => {
    return true
}

const pendingTemplateCoverUrl = computed(() => {
    const item = pendingTemplateItem.value
    if (!item) {
        return ''
    }
    return `${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`
})

const pendingTemplatePriceLabel = computed(() => {
    const item = pendingTemplateItem.value
    if (!item) {
        return ''
    }
    if (item.is_free) {
        return '免费'
    }
    if (item.price > 0) {
        return `¥${item.price}`
    }
    return '付费'
})

const chooseTemplate = (item: TemplateInterface) => {
    if (!threeCore.value) {
        return
    }
    pendingTemplateItem.value = item
    showTemplateConfirmModal.value = true
}

/**
 * 将 loadSceneFromJSON(..., true) 返回的临时 Group 拆开：每个根子节点单独加入场景并记入 loadTemplate
 */
const addFlattenedTemplateFromGroup = (
    core: ThreeCore,
    group: THREE.Group,
    templateId: number
) => {
    const roots = [...group.children]
    for (const obj of roots) {
        obj.userData.type = 'template'
        obj.userData.template_id = templateId
        obj.userData.ignorePick = true
        if (!obj.userData.id) {
            core.assignSceneObjectId(obj)
        }
        core.scene.add(obj)
        core.loadTemplate.push(obj)
    }
}

/** 将模版 JSON 载入当前场景（不包含弹窗与权限校验） */
const applyTemplateToScene = async (item: TemplateInterface) => {
    const core = threeCore.value
    if (!core) {
        return
    }
    if (core.loadTemplate.length > 0) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        core.loadTemplate.forEach((child) => {
            core.clearGroup(child)
        })
        core.loadTemplate = []
    }
    if (item.json_data) {
        const group = await core.loadSceneFromJSON(item.json_data, true)
        if (group) {
            addFlattenedTemplateFromGroup(core, group, item.template_id)
        }
    } else if (item.json_url) {
        const res = await use$Get(`/sence/json/${item.json_url}.json?2`, undefined, {
            baseURL: BASE_IMG
        })
        const group = await core.loadSceneFromJSON(res, true)
        if (group) {
            addFlattenedTemplateFromGroup(core, group, item.template_id)
        }
    } else {
        throw new Error('NO_TEMPLATE_DATA')
    }
}

const confirmLoadPendingTemplate = async () => {
    const item = pendingTemplateItem.value
    if (!item || !threeCore.value) {
        return
    }
    if (!canUseTemplate(item)) {
        toast.add({
            title: '无法加载',
            description: '您当前无权使用该模版',
            icon: 'i-heroicons-exclamation-circle',
            color: 'amber'
        })
        return
    }
    templateConfirmLoading.value = true
    try {
        await applyTemplateToScene(item)
        showTemplateConfirmModal.value = false
    } catch (e) {
        const msg =
            e instanceof Error && e.message === 'NO_TEMPLATE_DATA'
                ? '该模版缺少场景数据'
                : '模版加载失败，请稍后重试'
        toast.add({
            title: '加载失败',
            description: msg,
            icon: 'i-heroicons-exclamation-circle',
            color: 'red'
        })
    } finally {
        templateConfirmLoading.value = false
        bumpTextureReplaceableScan()
    }
}

watch(showTemplateConfirmModal, (open) => {
    if (!open) {
        templateConfirmLoading.value = false
        pendingTemplateItem.value = null
    }
})

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

    const restoreEditorOverlays = threeCore.value.hideEditorOverlaysForCapture()
    try {
        // 确保场景已渲染（隐藏网格、坐标轴、视点球等编辑辅助物）
        await threeCore.value.renderFrame()

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

        // 创建新的 canvas，用于添加白色背景和可能的压缩（显式 sRGB，避免从 WebGL 读回时偏灰）
        const finalCanvas = document.createElement('canvas')
        finalCanvas.width = width
        finalCanvas.height = height
        finalCanvas.style.colorSpace = 'srgb'
        const ctx = finalCanvas.getContext('2d', { colorSpace: 'srgb' })

        if (!ctx) {
            console.error('无法创建 canvas context')
            return null
        }

        if (!canvas.style.colorSpace) {
            canvas.style.colorSpace = 'srgb'
        }

        const bg = threeCore.value.background
        ctx.fillStyle =
            typeof bg === 'string' && bg.startsWith('color:')
                ? bg.slice('color:'.length)
                : '#ffffff'
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
    } finally {
        restoreEditorOverlays()
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
    stampAndAddSceneObject(mesh)
}
const addBackgroun = async (resault) => {
    if (!threeCore.value) return
    threeCore.value.background = resault.file_url
    scenePageBackground.value = resault.file_url
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
    stampAndAddSceneObject(mesh)
}

onUnmounted(() => {
    if (sceneStepListExpanded.value) {
        sceneStepListExpanded.value = false
        sceneStepGroupingMode.value = false
    }
    // 移除变换控件的撤销监听，避免 dispose 后仍被触发
    const listeners = transformUndoListeners.value
    const core = threeCore.value
    if (listeners && core?.transformControls) {
        core.transformControls.removeEventListener('mouseDown', listeners.onMouseDown)
        core.transformControls.removeEventListener('mouseUp', listeners.onMouseUp)
        transformUndoListeners.value = null
    }
    for (const c of roleControllers.value) {
        c.dispose()
    }
    roleControllers.value = []
    loadedRoleModelUrls.clear()
    clearRoleDialogTimer()
    showRoleDialog.value = false
    detachLinkBadgeAnimCb()
    linkBadgeMarkers.value = []
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
    const selected = clickObject.value?.[0]
    const tc = threeCore.value.transformControls
    if (selected && tc.object !== selected) {
        tc.attach(selected)
    }
    transformType.value = type
    tc.setMode(type)
}

function isTypingInForm(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function tryTransformHotkey(key: string): boolean {
    if (sceneStepGroupingMode.value) return false
    if (!(edit_mode.value || add_mode.value)) return false
    if (!clickObject.value?.length) return false
    if (target.value || animationTarget.value || showSceneEditGuide.value) return false
    const mode =
        key === 'g' ? 'translate'
        : key === 'r' ? 'rotate'
        : key === 's' ? 'scale'
        : null
    if (!mode) return false
    setMode(mode)
    return true
}

/** 撤销操作（当前支持移动/缩放/旋转，预留扩展） */
const handleUndo = () => {
    if (!threeCore.value || !canUndo.value) return
    const undoneObj = performUndo(threeCore.value.scene)
    if (undoneObj) {
        threeCore.value.reapplyGsapAnimations(undoneObj)
        bumpTextureReplaceableScan()
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
        
        const gfx = loadSceneGraphicsSettings()
        sceneGraphicsPreset.value = gfx.preset
        await initScene(sceneElement, id, {
            editMode: edit_mode.value,
            baseUrl: BASE_IMG,
            sceneData: detail.value,
            enableRaycaster: hasSplatObject,
            preferWebGPU: false,
            colorStyle: 'anime',
            graphicsSettings: {
                antialias: gfx.antialias,
                pixelRatio: resolveRendererPixelRatio(gfx),
                mobilePerfCap: gfx.mobilePerfCap
            },
            onLinkedObjectPick: (obj, ev) => {
                if (edit_mode.value || add_mode.value) return false
                if (!hasSceneObjectLinks(obj)) return false
                openSceneLinkDetailModal(obj, ev)
                return true
            },
            onSceneStepGroupingPick: (obj) => handleGroupingScenePick(obj)
        })
        // 兼容旧数据：纯色曾写在 scene.background，迁到 DOM（background: color:#…）
        if (threeCore.value?.scene.background instanceof THREE.Color) {
            const hex = `#${threeCore.value.scene.background.getHexString()}`
            threeCore.value.background = `color:${hex}`
            threeCore.value.scene.background = null
        }
        syncScenePageBackgroundFromCore()

        rehydrateSceneCharacterControllers()
        bumpTextureReplaceableScan()
        syncSceneStepUi()
        bumpSceneObjectRevision()
        if (threeCore.value && (edit_mode.value || add_mode.value)) {
            threeCore.value.showAllStepManagedObjects()
            sceneStepShowAll.value = true
        }

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
                const obj = (tc as { object?: THREE.Object3D }).object
                if (pendingTransformState.value) {
                    pushTransformUndo(
                        pendingTransformState.value.objectUuid,
                        pendingTransformState.value.state,
                        '移动/缩放/旋转'
                    )
                    pendingTransformState.value = null
                }
                if (obj?.userData?.effect?.length) {
                    threeCore.value?.reapplyGsapAnimations(obj)
                }
            }
            tc.addEventListener('mouseDown', onMouseDown)
            tc.addEventListener('mouseUp', onMouseUp)
            transformUndoListeners.value = { onMouseDown, onMouseUp }
        }

        // 如果是编辑模式，添加坐标系和无限地面网格
        if (threeCore.value && edit_mode.value) {
            // 添加坐标系（AxesHelper）
            const axesHelper = new THREE.AxesHelper(10) // 5 个单位长度
            axesHelper.userData.ignorePick = true // 不参与拾取
            axesHelper.userData.sceneEditorOverlay = true
            threeCore.value.scene.add(axesHelper)

            // 添加无限地面网格（使用 InfiniteGridHelper）
            // 参数：size1 (次要网格), size2 (主要网格), color, distance (淡出距离), axes
            const gridHelper = new InfiniteGridHelper(
                1,  // size1 - 次要网格线大小
                5,  // size2 - 主要网格线大小
                new THREE.Color(0x000000), // color - 网格颜色（黑线）
                30, // distance - 淡出距离（30 会让淡出效果更好）
                'xzy' // axes - 轴方向（xzy 表示在 XZ 平面上）
            )
            gridHelper.position.y = 0
            gridHelper.userData.ignorePick = true // 不参与拾取
            gridHelper.userData.sceneEditorOverlay = true
            threeCore.value.scene.add(gridHelper)
            // 注意：InfiniteGridHelper 会自动跟随相机，不需要手动更新位置
        }

        detachLinkBadgeAnimCb()
        linkBadgeAnimCb = () => updateLinkBadgeMarkers()
        threeCore.value.addAnimationCallback(linkBadgeAnimCb)
        updateLinkBadgeMarkers()
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
        // R 旋转、G 移动、S 缩放（编辑/新建模式、已选物体、非输入态）
        if (
            !isTypingInForm(e.target)
            && !(e.ctrlKey || e.metaKey || e.altKey)
        ) {
            const key = e.key.toLowerCase()
            if ((key === 'g' || key === 'r' || key === 's') && tryTransformHotkey(key)) {
                e.preventDefault()
            }
        }
    }
    if (process.client) {
        document.addEventListener('keydown', onKeyDown)
        onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
    }
})

const isMobile = computed(() => configStore.isMobile);
const sceneOwnerActionTop = computed(() => {
    const bar = configStore.statusBarHeight || 0
    return `calc(0.75rem + max(env(safe-area-inset-top, 0px), ${bar}px))`
})
const sceneStepSwitcherTop = computed(() => {
    const bar = configStore.statusBarHeight || 0
    return `calc(2.75rem + max(env(safe-area-inset-top, 0px), ${bar}px))`
})
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
    <div class="select-none touch-callout-none scene-page-neu" :style="scenePageBackgroundStyle">
        <div
            v-if="showSceneCloneAction || showSceneOwnerActions"
            class="fixed right-3 z-50 flex items-center gap-1.5"
            :style="{ top: sceneOwnerActionTop }"
        >
            <button
                v-if="showSceneCloneAction"
                type="button"
                title="克隆场景"
                class="scene-neu-action-btn scene-neu-action-btn--compact group scene-neu-action-btn--emerald"
                :disabled="cloneSceneLoading"
                @click="openCloneSceneConfirm"
            >
                <div
                    class="scene-neu-action-icon scene-neu-action-icon--compact scene-neu-action-icon--emerald"
                >
                    <UIcon
                        v-if="!cloneSceneLoading"
                        name="material-symbols:content-copy-outline-rounded"
                        class="text-sm text-emerald-600 dark:text-emerald-400"
                    />
                    <UIcon
                        v-else
                        name="i-heroicons-arrow-path"
                        class="text-sm text-emerald-600 dark:text-emerald-400 animate-spin"
                    />
                </div>
                <span class="scene-neu-action-label scene-neu-action-label--compact">克隆</span>
            </button>
            <button
                v-if="showSceneOwnerActions"
                type="button"
                title="更多选项"
                class="scene-neu-action-btn scene-neu-action-btn--compact group"
                @click="openMoreMenu($event)"
            >
                <div
                    class="scene-neu-action-icon scene-neu-action-icon--compact bg-gradient-to-br from-gray-200/80 to-gray-100/40 dark:from-gray-800/40 dark:to-gray-700/20"
                >
                    <UIcon
                        name="material-symbols:more-horiz"
                        class="text-sm text-gray-600 dark:text-gray-400"
                    />
                </div>
                <span class="scene-neu-action-label scene-neu-action-label--compact">更多</span>
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
            :image-url="textureEditorDefaultImageUrl" @close="target = null" />
        <SceneAnimationEditor
            v-if="animationTarget && threeCore"
            ref="SceneAnimationEditorRef"
            :target="animationTarget"
            :three-core="threeCore"
            @close="animationTarget = null"
        />
        <SceneObjectLinkModal
            ref="sceneObjectLinkModalRef"
            :picker-user-id="sceneOwnerUserId"
            @save="onObjectLinksSave"
        />
        <SceneObjectLinkDetailModal
            ref="sceneLinkDetailModalRef"
            :default-user-id="sceneOwnerUserId"
            :harmony-port="port"
        />

        <!-- 左侧功能栏：仅编辑工具；「动画」见下方独立块，交互与右侧素材/特效等一致 -->
        <div
            id="scene-guide-left-toolbar"
            class="fixed left-0 z-[20] flex flex-col overflow-hidden rounded-r-xl scene-neu-panel backdrop-blur-md transition-all duration-300 ease-out top-1/2 z-[30] max-h-[75vh] -translate-y-1/2"
            :class="showToolbar ? 'w-[52px] sm:w-[56px]' : 'w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-toggle-btn shrink-0 flex w-full flex-col items-center justify-center text-gray-600 dark:text-gray-300"
                :class="showToolbar ? 'scene-neu-toggle-btn--expanded gap-0.5 py-2 px-1' : 'scene-neu-toggle-btn--collapsed'"
                :title="showToolbar ? '收起' : '展开'"
                @click="showToolbar = !showToolbar"
            >
                <UIcon
                    :name="showToolbar ? 'material-symbols:tune-rounded' : 'material-symbols:settings-rounded'"
                    :class="showToolbar ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span
                    v-if="showToolbar"
                    class="text-center text-[9px] font-medium leading-tight text-gray-700 dark:text-gray-200"
                >
                    收起
                </span>
            </button>
            <!-- 内容区用 max-h 过渡实现流畅收起，不使用 v-show 避免瞬间消失 -->
            <div
                class="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                :class="showToolbar ? 'max-h-[calc(75vh-52px)]' : 'max-h-0'"
            >
                <div class="overflow-y-auto overscroll-contain p-1.5 space-y-1.5 scrollbar-hide">
                    <!-- 保存 -->
                    <button v-if="edit_mode || add_mode" @click="saveScene"
                        class="scene-neu-tool-btn group"
                        title="保存">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--blue">
                            <UIcon name="material-symbols:save-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">保存</span>
                    </button>

                    <!-- 撤销 -->
                    <button v-if="edit_mode || add_mode" @click="handleUndo"
                        :class="[canUndo ? '' : 'opacity-50 cursor-not-allowed', 'scene-neu-tool-btn group']"
                        :title="canUndo ? `撤销 (${undoStack.length} 步)` : '暂无可撤销操作'"
                        :disabled="!canUndo">
                        <div class="relative">
                            <div class="scene-neu-icon-orb scene-neu-icon-orb--gray">
                                <UIcon name="i-heroicons-arrow-uturn-left" class="text-sm text-white" />
                            </div>
                            <span v-if="undoStack.length > 0"
                                class="scene-neu-badge absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-medium leading-none">
                                {{ undoStack.length > 99 ? '99+' : undoStack.length }}
                            </span>
                        </div>
                        <span class="scene-neu-tool-label">撤销</span>
                    </button>

                    <!-- 图片 -->
                    <button v-if="edit_mode || add_mode" @click="openImageMenu"
                        class="scene-neu-tool-btn group"
                        title="图片">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--green">
                            <UIcon name="material-symbols:add-photo-alternate-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">图片</span>
                    </button>

                    <!-- 点位 -->
                    <button v-if="edit_mode || add_mode" @click="openPointMenu"
                        class="scene-neu-tool-btn group"
                        title="点位">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--amber">
                            <UIcon name="material-symbols:location-on-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">点位</span>
                    </button>
                    <!-- 文本 -->
                    <button v-if="edit_mode || add_mode" @click="openTextMenu"
                        class="scene-neu-tool-btn group"
                        title="文本">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--indigo">
                            <UIcon name="material-symbols:title-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">文本</span>
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
                    <!-- 角色示例（固定 material/02c37...glb，自动识别动画 clip） -->
                    <button v-if="edit_mode || add_mode" type="button" @click="loadRoleDemoGlb"
                        class="scene-neu-tool-btn group"
                        title="加载角色动画示例（material/02c37...glb）">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--cyan">
                            <UIcon name="material-symbols:face-3" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">角色示例</span>
                    </button>

                    <!-- 记录镜头 -->
                    <button v-if="edit_mode || add_mode" @click="recordCamera"
                        class="scene-neu-tool-btn group"
                        title="记录镜头">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--rose">
                            <UIcon name="material-symbols:videocam-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">记录镜头</span>
                    </button>
                    <!-- 设置 -->
                    <button @click="openSettings"
                        class="scene-neu-tool-btn group"
                        title="设置">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--gray">
                            <UIcon name="material-symbols:settings-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">设置</span>
                    </button>

                    <!-- 灯光 -->
                    <button v-if="edit_mode || add_mode" @click="openLightMenu"
                        class="scene-neu-tool-btn group"
                        title="灯光">
                        <div class="scene-neu-icon-orb scene-neu-icon-orb--yellow">
                            <UIcon name="material-symbols:lightbulb-rounded" class="text-sm text-white" />
                        </div>
                        <span class="scene-neu-tool-label">灯光</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 动画：独立块，布局与右侧「特效/模版」等一致（fixed + 折叠条 + 展开列表） -->
        <div
            v-if="showRoleAnimationPanel"
            id="scene-guide-role-panel"
            class="fixed left-0 z-[20] flex flex-col rounded-r-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="roleAnimationListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+46px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--violet shrink-0 text-violet-600 dark:text-violet-400"
                :class="roleAnimationListExpanded
                    ? 'flex flex-row items-center justify-center gap-1.5 scene-neu-panel-toggle--expanded py-2 px-2'
                    : 'scene-neu-panel-toggle--collapsed'"
                :title="roleAnimationListExpanded ? '收起列表' : '展开列表'"
                @click="showRoleAnimation()"
            >
                <UIcon
                    :name="roleAnimationListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:animation-rounded'"
                    :class="roleAnimationListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label text-center font-medium leading-tight">角色</span>
            </button>
            <div
                v-show="roleAnimationListExpanded"
                class="min-h-0 h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2"
            >
                <p class="text-[10px] font-medium text-violet-700/80 dark:text-violet-300/80">
                    glTF 骨骼动画
                </p>
                <template v-if="sceneRoleAnimationTree.length">
                    <div
                        v-for="entry in sceneRoleAnimationTree"
                        :key="entry.key"
                        class="text-left"
                    >
                        <div
                            class="truncate text-[10px] font-medium text-gray-500 dark:text-gray-400"
                            :title="entry.label"
                        >
                            {{ entry.label }}
                        </div>
                        <div class="mt-1 flex flex-wrap gap-1">
                            <button
                                v-for="clip in entry.clips"
                                :key="`${entry.key}-${clip}`"
                                type="button"
                                class="scene-neu-chip scene-neu-chip--violet max-w-full truncate px-1.5 py-0.5 text-[10px]"
                                :title="clip"
                                @click="pickSceneRoleAnimation(entry.controller, clip)"
                            >
                                {{ clip }}
                            </button>
                        </div>
                    </div>
                </template>
                <p
                    v-else
                    class="text-[10px] leading-relaxed text-gray-400"
                >
                    暂无角色。请添加「角色示例」或带 characterType 的自定义素材。
                </p>
            </div>
        </div>

        <!-- 贴图：左侧动画下方；列出可替换 Mesh，角标为可替换数量 -->
        <div
            v-if="edit_mode || add_mode"
            id="scene-guide-texture-panel"
            class="fixed left-0 z-[20] flex flex-col rounded-r-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="textureListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+92px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--amber shrink-0 text-amber-600 dark:text-amber-400"
                :class="textureListExpanded
                    ? 'flex flex-row items-center justify-center gap-1.5 scene-neu-panel-toggle--expanded py-2 px-2'
                    : 'scene-neu-panel-toggle--collapsed'"
                :title="textureListExpanded ? '收起列表' : '展开列表'"
                @click="showTextureList()"
            >
                <span class="relative inline-flex shrink-0">
                    <UIcon
                        :name="textureListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:texture-rounded'"
                        :class="textureListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                        class="transition-transform"
                    />
                    <span
                        v-if="textureReplaceableMeshes.length > 0"
                        class="scene-neu-collapsed-badge absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-amber-500 font-bold leading-none text-white shadow-sm ring-1 ring-white/80 dark:ring-gray-800/90"
                        :class="textureListExpanded ? 'h-[18px] min-w-[18px] px-0.5 text-[10px]' : 'h-[14px] min-w-[14px] px-0.5 text-[9px]'"
                    >
                        {{ textureReplaceableMeshes.length > 99 ? '99+' : textureReplaceableMeshes.length }}
                    </span>
                </span>
                <span class="scene-neu-collapsed-label text-center font-medium leading-tight">贴图</span>
            </button>
            <div
                v-show="textureListExpanded"
                class="min-h-0 h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2"
            >
                <p
                    v-if="textureReplaceableMeshes.length === 0"
                    class="text-[10px] leading-relaxed text-gray-400 px-0.5"
                >
                    场景中暂无可替换贴图网格（名称需包含 replace）。
                </p>
                <button
                    v-for="m in textureReplaceableMeshes"
                    :key="m.uuid"
                    type="button"
                    class="scene-neu-list-item scene-neu-list-item--amber w-full truncate px-2 py-1.5 text-left text-[11px] active:scale-[0.98]"
                    :title="textureReplaceableMeshLabel(m)"
                    @click="pickReplaceMeshFromTextureToolbar(m)"
                >
                    {{ textureReplaceableMeshLabel(m) }}
                </button>
            </div>
        </div>

        <!-- 分组：左侧贴图下方，多场景 step 编辑 -->
        <div
            v-if="edit_mode || add_mode"
            id="scene-guide-step-panel"
            class="fixed left-0 z-[20] flex flex-col rounded-r-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out top-[calc(50%+138px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed"
            :data-grouping-active="sceneStepGroupingMode ? '1' : undefined"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--emerald scene-neu-panel-toggle--collapsed shrink-0 text-emerald-600 dark:text-emerald-400"
                :class="sceneStepListExpanded ? 'ring-2 ring-emerald-400/50 dark:ring-emerald-500/40' : ''"
                :title="sceneStepListExpanded ? '收起分组' : '展开分组'"
                @click="showSceneStepList()"
            >
                <span class="relative inline-flex shrink-0">
                    <UIcon
                        name="material-symbols:view-carousel-rounded"
                        class="text-base transition-transform"
                    />
                    <span
                        v-if="threeCore && threeCore.sceneSteps.length > 0"
                        class="scene-neu-collapsed-badge absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-white/80 dark:ring-gray-800/90"
                    >
                        {{ threeCore.sceneSteps.length > 99 ? '99+' : threeCore.sceneSteps.length }}
                    </span>
                </span>
                <span class="scene-neu-collapsed-label text-center font-medium leading-tight">分组</span>
            </button>
        </div>
        <Transition :name="`drawer-${isMobile ? 'bottom' : 'left'}`">
            <QhxBottomDrawer
                v-if="sceneStepListExpanded"
                :direction="isMobile ? 'bottom' : 'left'"
                :default-size="isMobile ? 420 : 320"
                :content-padding="false"
            >
                <div class="flex h-full min-h-0 flex-col">
                    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200/90 px-4 py-3 dark:border-gray-700/80">
                        <div class="flex min-w-0 items-center gap-3">
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.11] ring-1 ring-inset ring-emerald-500/15 dark:bg-emerald-400/10 dark:ring-emerald-400/20"
                            >
                                <UIcon name="material-symbols:view-carousel-rounded" class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div class="min-w-0">
                                <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">场景分组</h3>
                                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">点击场景物体加入当前分组</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            class="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="关闭分组"
                            @click="closeSceneStepGroupingIfOpen()"
                        >
                            <UIcon name="i-heroicons-x-mark" class="text-gray-500 transition-colors group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200" />
                        </button>
                    </div>
                    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                        <SceneStepEditor
                            ref="sceneStepEditorRef"
                            v-if="threeCore"
                            :core="threeCore"
                            v-model:active-index="currentSceneStepIndex"
                            v-model:hidden-step-index="hiddenGroupingStepIndex"
                            :object-revision="sceneObjectRevision"
                            @change="onSceneStepEditorChange"
                        />
                    </div>
                </div>
            </QhxBottomDrawer>
        </Transition>

        <!-- 五个独立的悬浮列表，展开后居中、固定高度，互不联动，同时只展开一个 -->
        <!-- 素材 -->
        <div
            v-if="edit_mode || add_mode"
            id="scene-guide-right-material"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="materialListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%-92px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--purple items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-purple-600 dark:text-purple-400"
                :class="materialListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="materialListExpanded ? '收起列表' : '展开列表'"
                @click="showMaterial()"
            >
                <UIcon
                    :name="materialListExpanded ? 'material-symbols:chevron-right' : 'carbon:model-alt'"
                    :class="materialListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">素材</span>
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
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="clothingListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%-46px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--pink items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-pink-600 dark:text-pink-400"
                :class="clothingListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="clothingListExpanded ? '收起列表' : '展开列表'"
                @click="showClothing()"
            >
                <UIcon
                    :name="clothingListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:checkroom-rounded'"
                    :class="clothingListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">服饰</span>
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
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="sceneListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-1/2 -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--teal items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-teal-600 dark:text-teal-400"
                :class="sceneListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="sceneListExpanded ? '收起列表' : '展开列表'"
                @click="showScene()"
            >
                <UIcon
                    :name="sceneListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:landscape-rounded'"
                    :class="sceneListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">场景</span>
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
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="effectListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+46px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--orange items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-orange-600 dark:text-orange-400"
                :class="effectListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="effectListExpanded ? '收起列表' : '展开列表'"
                @click="showEffect()"
            >
                <UIcon
                    :name="effectListExpanded ? 'material-symbols:chevron-right' : 'icon-park-twotone:effects'"
                    :class="effectListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">特效</span>
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
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="templateListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+92px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--blue items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-blue-600 dark:text-blue-400"
                :class="templateListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="templateListExpanded ? '收起列表' : '展开列表'"
                @click="showTemplate()"
            >
                <UIcon
                    :name="templateListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:dashboard-rounded'"
                    :class="templateListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">模版</span>
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
        <!-- 自定义 -->
        <div
            v-if="edit_mode || add_mode"
            class="fixed right-0 z-[20] flex flex-col rounded-l-xl scene-neu-panel backdrop-blur-md overflow-hidden transition-all duration-300 ease-out"
            :class="customListExpanded
                ? 'top-1/2 -translate-y-1/2 h-[62vh] w-[100px] min-[756px]:w-[170px] min-[756px]:sm:w-[190px] md:w-[210px] z-[30]'
                : 'top-[calc(50%+138px)] -translate-y-1/2 h-[40px] w-[36px] sm:w-[38px] scene-neu-panel--collapsed'"
        >
            <button
                type="button"
                class="scene-neu-panel-toggle scene-neu-panel-toggle--indigo items-center justify-center gap-1.5 py-2 px-2 shrink-0 text-indigo-600 dark:text-indigo-400"
                :class="customListExpanded ? 'scene-neu-panel-toggle--expanded flex gap-1.5 py-2 px-2' : 'scene-neu-panel-toggle--collapsed'"
                :title="customListExpanded ? '收起列表' : '展开列表'"
                @click="showCustom()"
            >
                <UIcon
                    :name="customListExpanded ? 'material-symbols:chevron-right' : 'material-symbols:extension-rounded'"
                    :class="customListExpanded ? 'text-xl sm:text-2xl' : 'text-base'"
                    class="transition-transform"
                />
                <span class="scene-neu-collapsed-label font-medium">自定义</span>
            </button>
            <div
                v-show="customListExpanded"
                class="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0 h-0"
            >
                <SceneMaterial
                    panel-type="custom"
                    :load-template="false"
                    @choose-material="chooseMaterial"
                    @choose-template="chooseTemplate"
                    @choose-effect="chooseEffect"
                    @clear-template="clearTemplate"
                />
            </div>
        </div>

        <div style="height: 100vh; width: 100vw; overflow: hidden; " id="scene"></div>
        <div
            v-if="linkBadgeMarkers.length"
            class="scene-link-badge-layer pointer-events-none fixed inset-0 z-[15]"
            aria-hidden="false"
        >
            <button
                v-for="badge in linkBadgeMarkers"
                :key="badge.uuid"
                type="button"
                class="scene-link-badge pointer-events-auto"
                :style="{ left: `${badge.x}px`, top: `${badge.y}px` }"
                :title="`关联 ${badge.count} 项，点击查看`"
                @click.stop="onLinkBadgeClick(badge.uuid, $event)"
            >
                {{ badge.count }}
            </button>
        </div>
        <div
            v-if="threeCore?.hasSceneSteps() && !sceneStepGroupingMode"
            class="scene-step-switcher fixed left-1/2 z-[25] flex max-w-[min(100vw-24px,42rem)] -translate-x-1/2 pointer-events-auto"
            :style="{ top: sceneStepSwitcherTop }"
        >
            <div
                class="scene-neu-opera-bar flex w-full items-center gap-1 overflow-x-auto rounded-full p-1.5 backdrop-blur-md scrollbar-hide"
            >
                <button
                    v-if="edit_mode || add_mode"
                    type="button"
                    class="scene-neu-opera-chip flex-shrink-0"
                    :class="sceneStepShowAll ? 'scene-neu-opera-chip--violet' : ''"
                    title="全览：显示全部模型"
                    @click="enterSceneStepOverview"
                >
                    全览
                </button>
                <button
                    v-for="(step, index) in threeCore.sceneSteps"
                    :key="`scene-step-${index}`"
                    type="button"
                    class="scene-neu-opera-chip max-w-[10rem] flex-shrink-0 inline-flex items-center gap-0.5 truncate"
                    :class="!sceneStepShowAll && currentSceneStepIndex === index ? 'scene-neu-opera-chip--violet' : ''"
                    :title="step.intro?.trim() || sceneStepLabel(step, index)"
                    @click="switchSceneStep(index)"
                >
                    <UIcon
                        v-if="step.camera"
                        name="material-symbols:video-camera-back"
                        class="shrink-0 text-[11px] opacity-80"
                    />
                    <span class="truncate">{{ sceneStepLabel(step, index) }}</span>
                </button>
            </div>
        </div>
        <SceneViewCube :core="threeCore" :enabled="edit_mode" />
        <div class="opera fixed z-20 md:flex items-center whitespace-nowrap"
            v-show="clickObject && edit_mode && !sceneStepGroupingMode && !target && !animationTarget" :class="[
                'md:absolute md:top-auto md:bottom-auto md:left-auto md:right-auto',
                'fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] md:w-auto md:translate-x-0 md:static'
            ]"
            :style="!isMobile && operaPosition ? { left: operaPosition.x + 40 + 'px', top: operaPosition.y - 100 + 'px' } : {}">
            <!-- <QhxJellyButton>
                
            </QhxJellyButton> -->
            <div
                class="scene-neu-opera-bar opera p-1.5 backdrop-blur-md rounded-full z-20 flex items-center whitespace-nowrap overflow-x-auto scrollbar-hide w-full md:w-auto gap-0.5">
                <div class="scene-neu-opera-chip flex-shrink-0" @click="setMode('translate')"
                    v-show="transformType !== 'translate'">移动</div>
                <div class="scene-neu-opera-chip flex-shrink-0" @click="setMode('rotate')"
                    v-show="transformType !== 'rotate'">
                    旋转</div>
                <div class="scene-neu-opera-chip flex-shrink-0" @click="setMode('scale')"
                    v-show="transformType !== 'scale'">缩放
                </div>
                <div class="scene-neu-opera-chip flex-shrink-0" @click.stop="openObjectSettings"
                    v-if="clickObject && (clickObject[0].userData.type === 'image' || clickObject[0].userData.type === '3Dtext' || clickObject[0].userData.type === 'longtext')">
                    设置
                </div>
                <div class="scene-neu-opera-chip flex-shrink-0" @click.stop="copySceneObject()"
                    v-if="clickObject && (clickObject[0].userData.type === 'model' || clickObject[0].userData.type === 'character' || clickObject[0].userData.type === 'image')">复制</div>
                <div
                    class="scene-neu-opera-chip scene-neu-opera-chip--violet flex-shrink-0"
                    v-if="canEditObjectLinks"
                    @click.stop="openObjectLinkEditor"
                >
                    关联
                </div>
                <div class="scene-neu-opera-chip flex-shrink-0" @click.stop="showTexture()" v-if="canTexture">贴图</div>
                <div
                    class="scene-neu-opera-chip scene-neu-opera-chip--violet flex-shrink-0"
                    v-if="canObjectAnimation"
                    @click.stop="showObjectAnimation()"
                >
                    动效
                </div>
                <div class="scene-neu-opera-chip scene-neu-opera-chip--danger flex-shrink-0" @click.stop="deleteModel()">删除</div>
            </div>
        </div>
        <div id="scene-guide-camera-list" class="camera-list fixed z-10 right-[10px] bottom-0 w-[40px] h-auto max-h-full" v-if="threeCore">
            <div class=" relative flex justify-center" v-for="(camera_list, index) in threeCore.cameraList">
                <QhxJellyButton>
                    <div class="text-center cursor-pointer" @click="lookAtCameraState(camera_list)">
                        <div class="scene-neu-camera-orb relative m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center">
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
                            <div class="scene-neu-camera-orb m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center">
                                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
                            </div>
                        </div>
                    </QhxJellyButton>
                    <QhxJellyButton>
                        <div class="text-center cursor-pointer" @click="resetCamera(index)">
                            <div class="scene-neu-camera-orb m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center">
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
        <QhxModal
            v-model="showCloneSceneConfirm"
            :close-on-backdrop="!cloneSceneLoading"
        >
            <div
                class="w-[min(calc(100vw-2rem),360px)] rounded-[12px] bg-white p-4 shadow-lg dark:bg-gray-800"
            >
                <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                    确认克隆场景
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    将把当前场景完整复制到你的账号下，并进入编辑模式。是否继续？
                </p>
                <div class="mt-4 flex flex-col gap-2 sm:flex-row">
                    <UButton
                        variant="outline"
                        color="gray"
                        class="w-full min-w-0 justify-center sm:flex-1"
                        :disabled="cloneSceneLoading"
                        @click="showCloneSceneConfirm = false"
                    >
                        取消
                    </UButton>
                    <UButton
                        class="w-full min-w-0 justify-center bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover sm:flex-1"
                        :loading="cloneSceneLoading"
                        :disabled="cloneSceneLoading"
                        @click="confirmCloneScene"
                    >
                        确认克隆
                    </UButton>
                </div>
            </div>
        </QhxModal>

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
        <QhxModal
            v-model="showTemplateConfirmModal"
            :close-on-backdrop="!templateConfirmLoading"
        >
            <div
                v-if="pendingTemplateItem"
                class="w-[min(92vw,420px)] max-h-[min(85vh,640px)] flex flex-col overflow-hidden rounded-[12px] bg-white shadow-lg dark:bg-gray-800"
            >
                <div class="relative w-full shrink-0 bg-gray-100 dark:bg-gray-900">
                    <img
                        :src="pendingTemplateCoverUrl"
                        :alt="pendingTemplateItem.title"
                        class="max-h-[220px] w-full object-cover"
                        loading="lazy"
                    />
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto p-4">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {{ pendingTemplateItem.title }}
                    </h3>
                    <div class="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <div class="flex justify-between gap-2">
                            <span class="shrink-0 text-gray-500 dark:text-gray-400">风格</span>
                            <span class="text-right">{{ pendingTemplateItem.main_style || '—' }}</span>
                        </div>
                        <div class="flex justify-between gap-2">
                            <span class="shrink-0 text-gray-500 dark:text-gray-400">类型</span>
                            <span class="text-right">{{ pendingTemplateItem.pk_type }}</span>
                        </div>
                        <!-- <div class="flex justify-between gap-2">
                            <span class="shrink-0 text-gray-500 dark:text-gray-400">定价</span>
                            <span class="text-right font-medium text-qhx-primary">{{ pendingTemplatePriceLabel }}</span>
                        </div> -->
                    </div>
                </div>
                <div
                    class="shrink-0 border-t border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                    <UButton
                        block
                        class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover justify-center"
                        :loading="templateConfirmLoading"
                        :disabled="templateConfirmLoading"
                        @click="confirmLoadPendingTemplate"
                    >
                        确认加载模版
                    </UButton>
                </div>
            </div>
        </QhxModal>
        <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
            <QhxBottomDrawer v-if="showSettings" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 500 : 450">
            <div class="py-1 space-y-5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 min-w-0">
                        <div
                            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-500/[0.11] ring-1 ring-inset ring-slate-400/20 dark:bg-slate-400/10 dark:ring-slate-500/25"
                        >
                            <UIcon name="material-symbols:settings-rounded" class="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">场景设置</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">光影与控制器</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        @click="showSettings = false"
                        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group shrink-0"
                        aria-label="关闭设置"
                    >
                        <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                    </button>
                </div>

                <!-- 光影设置区域 -->
                <section class="space-y-4 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-600/80 dark:bg-gray-800/40 md:p-5">
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">光影设置</h4>

                    <!-- 摄像机类型 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">摄像机类型</label>
                        <USelect v-model="settingsState.cameraType" :options="cameraTypeOptions"
                            option-attribute="label" @update:model-value="changeCameraType" color="white" />
                    </div>
                    
                    <!-- 阴影质量 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">阴影质量</label>
                        <USelect v-model="settingsState.shadowQuality" :options="shadowQualityOptions"
                            option-attribute="label" @update:model-value="changeShadowQuality" color="white" />
                    </div>

                    <!-- 镜头角度（仅透视相机） -->
                    <div v-if="settingsState.cameraType === 'perspective'">
                        <div class="flex justify-between mb-2">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">镜头角度</label>
                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ Math.round(settingsState.fov) }}°</span>
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
                </section>

                <section class="space-y-4 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-600/80 dark:bg-gray-800/40 md:p-5">
                    <div>
                        <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">画质设置</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">切换后将刷新页面并保存到本机</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">画质预设</label>
                        <USelect
                            :model-value="sceneGraphicsPreset"
                            :options="graphicsPresetOptions"
                            option-attribute="label"
                            value-attribute="value"
                            color="white"
                            @update:model-value="onGraphicsPresetChange"
                        />
                    </div>
                </section>

                <section v-if="edit_mode || add_mode" class="space-y-4 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-600/80 dark:bg-gray-800/40 md:p-5">
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">控制器设置</h4>

                    <!-- 水平旋转角度范围 -->
                    <div>
                        <div class="flex justify-between mb-2">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">水平旋转角度范围</label>
                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400">
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
                    <div>
                        <div class="flex justify-between mb-2">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">垂直旋转角度范围</label>
                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400">
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
                </section>
            </div>
        </QhxBottomDrawer>
        </Transition>
        <QhxModal v-model="showObjectSettings" :trigger-position="clickPosition">
            <div class="p-6 w-[min(92vw,420px)] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-700/80">
                <div class="flex items-center gap-3 mb-5">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/[0.11] ring-1 ring-inset ring-violet-500/15 dark:bg-violet-400/10 dark:ring-violet-400/20">
                        <UIcon name="material-symbols:tune-rounded" class="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">物体设置</h3>
                </div>

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

                <!-- 图片设置 -->
                <template v-if="clickObject && clickObject[0] && clickObject[0].userData.type === 'image'">
                    <div class="mb-2">
                        <div class="flex items-center justify-between gap-3 mb-2">
                            <span class="text-sm text-gray-700 dark:text-gray-300">面向相机</span>
                            <div class="flex items-center gap-2 shrink-0">
                                <UToggle
                                    v-model="objectSettingsState.follow"
                                    @update:model-value="onImageFollowChange"
                                />
                                <span class="text-sm text-gray-600 dark:text-gray-400">
                                    {{ objectSettingsState.follow ? '开启' : '关闭' }}
                                </span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500">
                            开启后图片会随视角旋转，始终面向相机（Billboard）
                        </p>
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
            <div class="flex flex-col w-[min(92vw,500px)] h-[min(72vh,480px)] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-[10px] shadow-lg overflow-hidden">
                <h3 class="text-base font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-200 shrink-0">添加长文本</h3>

                <div class="mb-4 flex-1 min-h-0 flex flex-col">
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-2 shrink-0">文本内容</div>
                    <div class="flex-1 min-h-0 [&_textarea]:h-full [&_textarea]:min-h-0 [&_textarea]:resize-none">
                        <UTextarea
                            v-model="longTextContent"
                            placeholder="请输入长文本内容（支持多行）"
                            :rows="1"
                            class="h-full focus:ring-0"
                            :ui="{
                                base: 'h-full min-h-0 focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
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
                </div>

                <div class="flex gap-3 justify-end shrink-0">
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
        <!-- 角色对话气泡：据模型头侧上缘投屏，右上浮层，5s 后消失 -->
        <ClientOnly>
            <Teleport to="body">
                <Transition name="role-dialogue-fx">
                    <div
                        v-show="showRoleDialog"
                        class="role-dialogue-bubble pointer-events-none fixed z-[5000]"
                        :style="roleDialogStyle"
                    >
                        <div
                            class="role-dialogue-neu-panel pointer-events-auto relative cursor-default rounded-[1.05rem] px-4 py-3 transition-transform active:scale-[0.99]"
                            title="点击关闭"
                            @click="closeRoleDialog"
                        >
                            <!-- 顶部柔光（拟态凸起感） -->
                            <div
                                class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
                                aria-hidden="true"
                            />
                            <div
                                class="role-dialogue-neu-tail pointer-events-none absolute -bottom-[5px] left-5 h-3 w-3 rotate-45"
                                aria-hidden="true"
                            />
                            <div
                                class="relative text-xs font-semibold tracking-wide text-amber-900/95 dark:text-amber-100/95"
                            >
                                {{ roleDialogTitle }}
                            </div>
                            <p
                                class="relative mt-1.5 text-sm leading-relaxed text-stone-800/95 dark:text-stone-100/95"
                            >
                                {{ roleDialogMessage }}
                            </p>
                        </div>
                    </div>
                </Transition>
            </Teleport>
        </ClientOnly>
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

        <QhxModal v-model="showMoreMenu" :trigger-position="moreMenuPosition">
            <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
                <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">更多选项</h3>

                <button
                    v-if="edit_mode || add_mode"
                    type="button"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
                    @click="replaySceneEditGuideFromMenu"
                >
                    <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-400 to-sky-500 group-hover:scale-110 transition-transform"
                    >
                        <UIcon name="material-symbols:map-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">操作引导</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">重播编辑操作引导</div>
                    </div>
                </button>

                <button
                    type="button"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
                    :class="(edit_mode || add_mode) && 'mt-2'"
                    @click="openScenePostFromMenu"
                >
                    <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 group-hover:scale-110 transition-transform"
                    >
                        <UIcon name="material-symbols:edit-note-rounded" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">发帖分享</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">发布到社区</div>
                    </div>
                </button>

                <button
                    type="button"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                    @click="handleSceneShareFromMenu"
                >
                    <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-500 group-hover:scale-110 transition-transform"
                    >
                        <UIcon name="ic:round-share" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">分享</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">复制场景链接</div>
                    </div>
                </button>

                <button
                    v-if="id !== '0'"
                    type="button"
                    class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
                    @click="openSceneSettingsFromMenu"
                >
                    <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-500 to-gray-600 group-hover:scale-110 transition-transform"
                    >
                        <UIcon name="i-heroicons-cog-6-tooth" class="text-base text-white" />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">设置</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">场景权限与克隆</div>
                    </div>
                </button>
            </div>
        </QhxModal>

        <UModal v-model="showSceneSettings" :ui="{ width: 'max-w-md' }">
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">场景设置</h3>
                </template>
                <div v-if="hasSceneOrigin" class="py-1">
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">允许克隆场景</div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        本场景由其他场景克隆而来，不可开启克隆权限
                    </p>
                </div>
                <div v-else class="flex items-center justify-between gap-4 py-1">
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">允许克隆场景</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            开启后，其他用户可将本场景克隆到自己的账号
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <UToggle
                            :model-value="sceneAllowCopyEnabled"
                            :loading="allowCopyUpdating"
                            :disabled="allowCopyUpdating"
                            @update:model-value="updateSceneAllowCopy"
                        />
                        <span class="text-xs text-gray-500 dark:text-gray-400 w-8 text-center">
                            {{ sceneAllowCopyEnabled ? '开启' : '关闭' }}
                        </span>
                    </div>
                </div>
                <template #footer>
                    <div class="flex justify-end">
                        <UButton color="gray" @click="showSceneSettings = false">关闭</UButton>
                    </div>
                </template>
            </UCard>
        </UModal>

        <!-- 颜色选择器 -->
        <QhxColorPicker ref="colorPickerRef" @choose="setSolidColorBackground" />

        <!-- 发帖弹窗 -->
        <ClientOnly>
            <CommunityPostModal
                v-model="showPostModal"
                :foreign-pk="scenePostForeignPk"
                :sence-id="scenePostSenceId"
                :scene-cover-relative-path="detail?.sence_cover ?? ''"
                initial-type="3D"
                modal-title="发帖分享"
                :skip-summary-link="true"
                :success-redirect="false"
                @success="handlePostSuccess"
            />
        </ClientOnly>

        <QhxStepGuide
            ref="sceneEditGuideRef"
            v-model="showSceneEditGuide"
            :steps="sceneEditGuideSteps"
            :storage-key="sceneEditGuideStorageKey"
            @step-change="onGuideStepChange"
        />
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

/* 场景页：拟态 + 半透明玻璃（工具栏 / 侧栏 / 操作条 / 顶栏按钮） */
.scene-page-neu {
    --scene-neu-soft: rgba(255, 255, 255, 0.58);
    --scene-neu-deep: rgba(0, 0, 0, 0.13);
    --scene-neu-inset: rgba(255, 255, 255, 0.42);
    --scene-neu-glass: rgba(255, 255, 255, 0.58);
    --scene-neu-border: rgba(255, 255, 255, 0.38);
}

html.dark .scene-page-neu {
    --scene-neu-soft: rgba(255, 255, 255, 0.07);
    --scene-neu-deep: rgba(0, 0, 0, 0.5);
    --scene-neu-inset: rgba(255, 255, 255, 0.08);
    --scene-neu-glass: rgba(38, 40, 48, 0.68);
    --scene-neu-border: rgba(255, 255, 255, 0.09);
}

.scene-page-neu .scene-neu-panel {
    background: var(--scene-neu-glass);
    border: 1px solid var(--scene-neu-border);
    box-shadow:
        8px 6px 20px var(--scene-neu-deep),
        -5px -4px 14px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset),
        inset 1px 0 0 rgba(255, 255, 255, 0.22);
}

html.dark .scene-page-neu .scene-neu-panel {
    box-shadow:
        8px 8px 24px var(--scene-neu-deep),
        -4px -3px 12px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset),
        inset 1px 0 0 rgba(255, 255, 255, 0.04),
        inset -2px 0 4px rgba(0, 0, 0, 0.35);
}

/* 侧栏收缩态：更透的玻璃拟态、更小占位 */
.scene-page-neu .scene-neu-panel--collapsed {
    background: rgba(255, 255, 255, 0.34);
    border-color: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(16px) saturate(1.15);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    box-shadow:
        3px 2px 10px rgba(0, 0, 0, 0.08),
        -2px -2px 7px rgba(255, 255, 255, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        inset 1px 0 0 rgba(255, 255, 255, 0.18);
}

html.dark .scene-page-neu .scene-neu-panel--collapsed {
    background: rgba(30, 32, 40, 0.42);
    border-color: rgba(255, 255, 255, 0.06);
    box-shadow:
        4px 4px 14px rgba(0, 0, 0, 0.38),
        -2px -2px 6px rgba(255, 255, 255, 0.03),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        inset -1px 0 2px rgba(0, 0, 0, 0.22);
}

.scene-page-neu .scene-neu-panel-toggle--collapsed {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    min-height: 40px;
    width: 100%;
    padding: 0.25rem 0.125rem;
}

.scene-page-neu .scene-neu-panel-toggle--collapsed:hover {
    background: rgba(255, 255, 255, 0.14);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

html.dark .scene-page-neu .scene-neu-panel-toggle--collapsed:hover {
    background: rgba(255, 255, 255, 0.05);
}

.scene-page-neu .scene-neu-panel-toggle--expanded .scene-neu-collapsed-label {
    font-size: 0.75rem;
    line-height: 1.25;
}

.scene-page-neu .scene-neu-panel-toggle--collapsed .scene-neu-collapsed-label {
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0.02em;
    opacity: 0.9;
}

.scene-page-neu .scene-neu-toggle-btn--collapsed {
    min-height: 40px;
    padding: 0.25rem 0.125rem;
    gap: 0.125rem;
}

.scene-page-neu .scene-neu-toggle-btn--collapsed:hover {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.scene-page-neu .scene-neu-collapsed-badge {
    box-shadow:
        1px 1px 4px rgba(0, 0, 0, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

/* 顶栏：发帖 / 分享 */
.scene-page-neu .scene-neu-action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 9999px;
    padding: 0.5rem 1rem 0.5rem 0.5rem;
    border: 1px solid var(--scene-neu-border);
    background: var(--scene-neu-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: box-shadow 0.2s ease, transform 0.18s ease, border-color 0.2s ease;
    box-shadow:
        5px 5px 14px var(--scene-neu-deep),
        -3px -3px 10px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset);
}

.scene-page-neu .scene-neu-action-btn:hover {
    transform: translateY(-1px);
    box-shadow:
        6px 7px 16px var(--scene-neu-deep),
        -4px -4px 12px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset);
}

.scene-page-neu .scene-neu-action-btn:active {
    transform: translateY(0) scale(0.98);
    box-shadow:
        inset 3px 3px 9px var(--scene-neu-deep),
        inset -2px -2px 6px var(--scene-neu-soft);
}

.scene-page-neu .scene-neu-action-btn--pink:hover {
    border-color: color-mix(in srgb, #ec4899 35%, var(--scene-neu-border));
}

.scene-page-neu .scene-neu-action-btn--violet:hover {
    border-color: color-mix(in srgb, #8b5cf6 35%, var(--scene-neu-border));
}

.scene-page-neu .scene-neu-action-btn--emerald:hover {
    border-color: color-mix(in srgb, #10b981 35%, var(--scene-neu-border));
}

.scene-page-neu .scene-neu-action-icon {
    display: flex;
    height: 2rem;
    width: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    transition: transform 0.2s ease;
}

.scene-page-neu .scene-neu-action-btn:hover .scene-neu-action-icon {
    transform: scale(1.05);
}

.scene-page-neu .scene-neu-action-icon--pink {
    background: linear-gradient(145deg, rgba(236, 72, 153, 0.22), rgba(244, 114, 182, 0.12));
    box-shadow:
        2px 2px 6px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.scene-page-neu .scene-neu-action-icon--emerald {
    background: linear-gradient(145deg, rgba(16, 185, 129, 0.22), rgba(52, 211, 153, 0.12));
    box-shadow:
        2px 2px 6px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.scene-page-neu .scene-neu-action-icon--violet {
    background: linear-gradient(145deg, rgba(139, 92, 246, 0.22), rgba(167, 139, 250, 0.12));
    box-shadow:
        2px 2px 6px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.scene-page-neu .scene-neu-action-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgb(31 41 55);
}

html.dark .scene-page-neu .scene-neu-action-label {
    color: rgb(243 244 246);
}

/* 顶栏紧凑态：与侧栏收缩条一致的半透明拟态 */
.scene-page-neu .scene-neu-action-btn--compact {
    gap: 0.375rem;
    padding: 0.3rem 0.55rem 0.3rem 0.3rem;
    border-radius: 0.625rem;
    background: rgba(255, 255, 255, 0.34);
    border-color: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(16px) saturate(1.15);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    box-shadow:
        3px 2px 10px rgba(0, 0, 0, 0.08),
        -2px -2px 7px rgba(255, 255, 255, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        inset 1px 0 0 rgba(255, 255, 255, 0.18);
}

html.dark .scene-page-neu .scene-neu-action-btn--compact {
    background: rgba(30, 32, 40, 0.42);
    border-color: rgba(255, 255, 255, 0.06);
    box-shadow:
        4px 4px 14px rgba(0, 0, 0, 0.38),
        -2px -2px 6px rgba(255, 255, 255, 0.03),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        inset -1px 0 2px rgba(0, 0, 0, 0.22);
}

.scene-page-neu .scene-neu-action-btn--compact:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.42);
    box-shadow:
        4px 3px 12px rgba(0, 0, 0, 0.1),
        -2px -2px 8px rgba(255, 255, 255, 0.55),
        inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

html.dark .scene-page-neu .scene-neu-action-btn--compact:hover {
    background: rgba(36, 38, 48, 0.52);
}

.scene-page-neu .scene-neu-action-btn--compact:active {
    transform: scale(0.97);
    box-shadow:
        inset 2px 2px 7px rgba(0, 0, 0, 0.12),
        inset -1px -1px 4px rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-action-icon--compact {
    height: 1.5rem;
    width: 1.5rem;
}

.scene-page-neu .scene-neu-action-label--compact {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.02em;
}

/* 左侧栏展开钮 */
.scene-page-neu .scene-neu-toggle-btn {
    transition: background 0.2s ease, box-shadow 0.2s ease;
}

.scene-page-neu .scene-neu-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.18);
}

html.dark .scene-page-neu .scene-neu-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.06);
}

.scene-page-neu .scene-neu-toggle-btn--expanded {
    border-bottom: 1px solid color-mix(in srgb, var(--scene-neu-border) 80%, transparent);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.04);
}

/* 左侧工具钮 */
.scene-page-neu .scene-neu-tool-btn {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
    border-radius: 0.75rem;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.18s ease, background 0.2s ease;
}

.scene-page-neu .scene-neu-tool-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.22);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        2px 2px 6px rgba(0, 0, 0, 0.06);
}

html.dark .scene-page-neu .scene-neu-tool-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
}

.scene-page-neu .scene-neu-tool-btn:active:not(:disabled) {
    transform: scale(0.95);
    box-shadow:
        inset 2px 2px 7px var(--scene-neu-deep),
        inset -1px -1px 4px var(--scene-neu-soft);
}

.scene-page-neu .scene-neu-tool-label {
    font-size: 9px;
    font-weight: 500;
    line-height: 1.2;
    color: rgb(55 65 81);
}

html.dark .scene-page-neu .scene-neu-tool-label {
    color: rgb(229 231 235);
}

.scene-page-neu .scene-neu-icon-orb {
    display: flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.scene-page-neu .scene-neu-tool-btn:hover:not(:disabled) .scene-neu-icon-orb {
    transform: scale(1.08);
}

.scene-page-neu .scene-neu-icon-orb--blue {
    background: linear-gradient(145deg, rgba(59, 130, 246, 0.88), rgba(37, 99, 235, 0.72));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--gray {
    background: linear-gradient(145deg, rgba(107, 114, 128, 0.9), rgba(75, 85, 99, 0.75));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.scene-page-neu .scene-neu-icon-orb--green {
    background: linear-gradient(145deg, rgba(34, 197, 94, 0.88), rgba(22, 163, 74, 0.72));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--amber {
    background: linear-gradient(145deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.75));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--indigo {
    background: linear-gradient(145deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.75));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--cyan {
    background: linear-gradient(145deg, rgba(6, 182, 212, 0.9), rgba(8, 145, 178, 0.75));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--rose {
    background: linear-gradient(145deg, rgba(244, 63, 94, 0.9), rgba(225, 29, 72, 0.75));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-icon-orb--yellow {
    background: linear-gradient(145deg, rgba(234, 179, 8, 0.92), rgba(202, 138, 4, 0.78));
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.16), -2px -2px 6px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.scene-page-neu .scene-neu-badge {
    box-shadow:
        2px 2px 5px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

/* 侧栏折叠头 */
.scene-page-neu .scene-neu-panel-toggle {
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background 0.2s ease, box-shadow 0.2s ease;
}

.scene-page-neu .scene-neu-panel-toggle:hover:not(.scene-neu-panel-toggle--collapsed) {
    background: rgba(255, 255, 255, 0.2);
}

html.dark .scene-page-neu .scene-neu-panel-toggle:hover {
    background: rgba(255, 255, 255, 0.06);
}

.scene-page-neu .scene-neu-panel-toggle--expanded {
    border-bottom: 1px solid color-mix(in srgb, var(--scene-neu-border) 85%, transparent);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.04);
}

/* 动画 clip / 贴图列表项 */
.scene-page-neu .scene-neu-chip {
    border-radius: 0.375rem;
    border: 1px solid transparent;
    cursor: pointer;
    transition: box-shadow 0.18s ease, transform 0.16s ease;
    box-shadow:
        2px 2px 6px rgba(0, 0, 0, 0.1),
        -1px -1px 4px rgba(255, 255, 255, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.scene-page-neu .scene-neu-chip--violet {
    background: color-mix(in srgb, #8b5cf6 18%, rgba(255, 255, 255, 0.55));
    color: rgb(76 29 149);
    border-color: color-mix(in srgb, #8b5cf6 22%, transparent);
}

html.dark .scene-page-neu .scene-neu-chip--violet {
    background: color-mix(in srgb, #6d28d9 35%, rgba(30, 32, 40, 0.75));
    color: rgb(237 233 254);
}

.scene-page-neu .scene-neu-chip:active {
    transform: scale(0.97);
    box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.12);
}

.scene-page-neu .scene-neu-list-item {
    border-radius: 0.5rem;
    cursor: pointer;
    transition: box-shadow 0.18s ease, transform 0.16s ease;
}

.scene-page-neu .scene-neu-list-item--amber {
    background: color-mix(in srgb, #f59e0b 14%, rgba(255, 255, 255, 0.5));
    color: rgb(120 53 15);
    border: 1px solid color-mix(in srgb, #f59e0b 28%, transparent);
    box-shadow:
        3px 3px 8px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

html.dark .scene-page-neu .scene-neu-list-item--amber {
    background: color-mix(in srgb, #b45309 28%, rgba(30, 32, 40, 0.72));
    color: rgb(254 243 199);
    border-color: color-mix(in srgb, #d97706 35%, transparent);
}

.scene-page-neu .scene-neu-list-item--amber:hover {
    box-shadow:
        4px 4px 10px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* 关联详情弹窗（Teleport 到 body，自带 scene-page-neu 以复用拟态变量） */
.scene-page-neu.scene-link-detail-shell {
    --scene-neu-soft: rgba(255, 255, 255, 0.58);
    --scene-neu-deep: rgba(0, 0, 0, 0.13);
    --scene-neu-inset: rgba(255, 255, 255, 0.42);
    --scene-neu-glass: rgba(255, 255, 255, 0.58);
    --scene-neu-border: rgba(255, 255, 255, 0.38);
    width: min(95vw, 22rem);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1rem;
    background: var(--scene-neu-glass);
    border: 1px solid var(--scene-neu-border);
    backdrop-filter: blur(14px) saturate(1.12);
    -webkit-backdrop-filter: blur(14px) saturate(1.12);
    box-shadow:
        8px 8px 24px var(--scene-neu-deep),
        -5px -5px 14px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset);
}

html.dark .scene-page-neu.scene-link-detail-shell {
    --scene-neu-soft: rgba(255, 255, 255, 0.07);
    --scene-neu-deep: rgba(0, 0, 0, 0.5);
    --scene-neu-inset: rgba(255, 255, 255, 0.08);
    --scene-neu-glass: rgba(38, 40, 48, 0.72);
    --scene-neu-border: rgba(255, 255, 255, 0.09);
}

.scene-page-neu .scene-link-detail-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--scene-neu-border) 90%, transparent);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.04);
}

.scene-page-neu .scene-link-detail-head__title {
    font-size: 1rem;
    font-weight: 700;
    color: rgb(31 41 55);
    line-height: 1.3;
}

html.dark .scene-page-neu .scene-link-detail-head__title {
    color: rgb(243 244 246);
}

.scene-page-neu .scene-link-detail-head__sub {
    margin-top: 0.125rem;
    font-size: 0.75rem;
    color: rgb(107 114 128);
}

html.dark .scene-page-neu .scene-link-detail-head__sub {
    color: rgb(156 163 175);
}

.scene-page-neu .scene-link-detail-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: 1px solid var(--scene-neu-border);
    background: color-mix(in srgb, #fff 50%, transparent);
    color: rgb(75 85 99);
    cursor: pointer;
    transition: transform 0.16s ease, box-shadow 0.18s ease;
    box-shadow:
        2px 2px 5px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

html.dark .scene-page-neu .scene-link-detail-close {
    color: rgb(209 213 219);
    background: color-mix(in srgb, #fff 6%, rgba(50, 52, 60, 0.65));
}

.scene-page-neu .scene-link-detail-close:hover {
    transform: scale(1.05);
}

.scene-page-neu .scene-link-detail-close:active {
    transform: scale(0.94);
    box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.12);
}

.scene-page-neu .scene-link-detail-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.scene-page-neu .scene-link-detail-loading,
.scene-page-neu .scene-link-detail-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
}

.scene-page-neu .scene-link-detail-card {
    padding: 0.75rem;
    border-radius: 0.875rem;
    background: color-mix(in srgb, #fff 42%, transparent);
    border: 1px solid var(--scene-neu-border);
    box-shadow:
        4px 4px 12px var(--scene-neu-deep),
        -2px -2px 8px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset);
}

html.dark .scene-page-neu .scene-link-detail-card {
    background: color-mix(in srgb, #fff 5%, rgba(44, 46, 54, 0.75));
}

.scene-page-neu .scene-link-detail-card__badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
}

.scene-page-neu .scene-link-detail-card__type {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgb(55 65 81);
}

html.dark .scene-page-neu .scene-link-detail-card__type {
    color: rgb(229 231 235);
}

.scene-page-neu .scene-link-detail-card__error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    color: rgb(185 28 28);
    background: color-mix(in srgb, #ef4444 10%, #fff);
    border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
}

html.dark .scene-page-neu .scene-link-detail-card__error {
    color: rgb(252 165 165);
    background: color-mix(in srgb, #b91c1c 22%, transparent);
}

.scene-page-neu .scene-link-detail-card__polaroid {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.625rem;
}

.scene-page-neu .scene-link-detail-card__cover {
    width: 5.25rem;
    height: 5.25rem;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: 0.625rem;
    border: 1px solid color-mix(in srgb, var(--scene-neu-border) 80%, #e5e7eb);
    box-shadow:
        3px 3px 8px rgba(0, 0, 0, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.scene-page-neu .scene-link-detail-card__meta {
    flex: 1;
    min-width: 0;
}

.scene-page-neu .scene-link-detail-card__name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: rgb(17 24 39);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

html.dark .scene-page-neu .scene-link-detail-card__name {
    color: rgb(243 244 246);
}

.scene-page-neu .scene-link-detail-card__desc {
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: rgb(107 114 128);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

html.dark .scene-page-neu .scene-link-detail-card__desc {
    color: rgb(156 163 175);
}

.scene-page-neu .scene-link-detail-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.4rem;
}

.scene-page-neu .scene-link-detail-tag {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    color: rgb(91 33 182);
    background: color-mix(in srgb, #8b5cf6 14%, rgba(255, 255, 255, 0.7));
    border: 1px solid color-mix(in srgb, #8b5cf6 22%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

html.dark .scene-page-neu .scene-link-detail-tag {
    color: rgb(216 180 254);
    background: color-mix(in srgb, #6d28d9 30%, transparent);
}

.scene-page-neu .scene-link-detail-tag--amber {
    color: rgb(146 64 14);
    background: color-mix(in srgb, #f59e0b 16%, rgba(255, 255, 255, 0.7));
    border-color: color-mix(in srgb, #f59e0b 28%, transparent);
}

html.dark .scene-page-neu .scene-link-detail-tag--amber {
    color: rgb(253 230 138);
    background: color-mix(in srgb, #d97706 28%, transparent);
}

.scene-page-neu .scene-link-detail-tag--price {
    font-weight: 700;
}

.scene-page-neu .scene-link-detail-card__empty {
    padding: 0.75rem 0;
    text-align: center;
    font-size: 0.8125rem;
    color: rgb(156 163 175);
    margin-bottom: 0.5rem;
}

.scene-page-neu .scene-link-detail-card__action {
    display: inline-flex;
    align-items: center;
    margin-top: 0.125rem;
}

/* 关联编辑弹窗 */
.scene-page-neu .scene-link-edit-hint {
    font-size: 0.8125rem;
    line-height: 1.45;
    color: rgb(107 114 128);
    margin: 0;
}

html.dark .scene-page-neu .scene-link-edit-hint {
    color: rgb(156 163 175);
}

.scene-page-neu .scene-link-edit-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.scene-page-neu .scene-link-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, #fff 42%, transparent);
    border: 1px solid var(--scene-neu-border);
    box-shadow:
        3px 3px 8px var(--scene-neu-deep),
        inset 0 1px 0 var(--scene-neu-inset);
}

html.dark .scene-page-neu .scene-link-edit-row {
    background: color-mix(in srgb, #fff 5%, rgba(44, 46, 54, 0.75));
}

.scene-page-neu .scene-link-edit-row__orb {
    width: 1.75rem;
    height: 1.75rem;
}

.scene-page-neu .scene-link-edit-row__id {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: rgb(31 41 55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

html.dark .scene-page-neu .scene-link-edit-row__id {
    color: rgb(243 244 246);
}

.scene-page-neu .scene-link-edit-row__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: none;
    background: color-mix(in srgb, #ef4444 12%, transparent);
    color: rgb(185 28 28);
    cursor: pointer;
    transition: transform 0.16s ease, background 0.18s ease;
}

html.dark .scene-page-neu .scene-link-edit-row__remove {
    color: rgb(252 165 165);
    background: color-mix(in srgb, #b91c1c 28%, transparent);
}

.scene-page-neu .scene-link-edit-row__remove:hover {
    transform: scale(1.06);
}

.scene-page-neu .scene-link-edit-row__remove:active {
    transform: scale(0.92);
}

.scene-page-neu .scene-link-edit-foot {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 0.875rem;
    border-top: 1px solid color-mix(in srgb, var(--scene-neu-border) 90%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

html.dark .scene-page-neu .scene-link-edit-foot {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* 模型关联角标（包围盒右上屏幕投影） */
.scene-page-neu .scene-link-badge {
    position: fixed;
    z-index: 15;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
    color: #fff;
    background: linear-gradient(145deg, #8b5cf6, #6d28d9);
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    box-shadow:
        0 2px 8px rgba(109, 40, 217, 0.45),
        0 1px 2px rgba(0, 0, 0, 0.2);
    transform: translate(2px, -2px);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.scene-page-neu .scene-link-badge:hover {
    transform: translate(2px, -2px) scale(1.06);
}

.scene-page-neu .scene-link-badge:active {
    transform: translate(2px, -2px) scale(0.96);
}

/* 选中对象操作条 */
.scene-page-neu .scene-neu-opera-bar {
    background: var(--scene-neu-glass);
    border: 1px solid var(--scene-neu-border);
    box-shadow:
        6px 6px 18px var(--scene-neu-deep),
        -4px -4px 12px var(--scene-neu-soft),
        inset 0 1px 0 var(--scene-neu-inset);
}

.scene-page-neu .scene-neu-opera-chip {
    cursor: pointer;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgb(55 65 81);
    transition: box-shadow 0.18s ease, transform 0.16s ease, background 0.18s ease;
    box-shadow:
        2px 2px 5px rgba(0, 0, 0, 0.08),
        -1px -1px 4px rgba(255, 255, 255, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.35);
    background: color-mix(in srgb, #fff 55%, transparent);
}

html.dark .scene-page-neu .scene-neu-opera-chip {
    color: rgb(229 231 235);
    background: color-mix(in srgb, #fff 8%, rgba(50, 52, 60, 0.65));
    box-shadow:
        2px 2px 6px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.scene-page-neu .scene-neu-opera-chip:hover {
    transform: translateY(-1px);
}

.scene-page-neu .scene-neu-opera-chip:active {
    transform: scale(0.96);
    box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.12);
}

.scene-page-neu .scene-neu-opera-chip--violet {
    color: rgb(109 40 217);
    background: color-mix(in srgb, #8b5cf6 16%, rgba(255, 255, 255, 0.55));
}

html.dark .scene-page-neu .scene-neu-opera-chip--violet {
    color: rgb(196 181 253);
    background: color-mix(in srgb, #6d28d9 32%, rgba(40, 42, 50, 0.7));
}

.scene-page-neu .scene-neu-opera-chip--danger {
    color: rgb(220 38 38);
    background: color-mix(in srgb, #ef4444 14%, rgba(255, 255, 255, 0.55));
}

html.dark .scene-page-neu .scene-neu-opera-chip--danger {
    color: rgb(252 165 165);
    background: color-mix(in srgb, #b91c1c 28%, rgba(40, 42, 50, 0.7));
}

/* 镜头列表圆钮 */
.scene-page-neu .scene-neu-camera-orb {
    background: linear-gradient(145deg, color-mix(in srgb, var(--qhx-primary, #a855f7) 92%, #fff), color-mix(in srgb, var(--qhx-primary, #9333ea) 78%, #000));
    box-shadow:
        4px 5px 11px rgba(0, 0, 0, 0.22),
        -2px -3px 9px rgba(255, 255, 255, 0.35),
        inset 0 1.5px 0 rgba(255, 255, 255, 0.38),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.2s ease, transform 0.18s ease;
}

.scene-page-neu .scene-neu-camera-orb:active {
    transform: scale(0.94);
    box-shadow:
        inset 3px 3px 9px rgba(0, 0, 0, 0.28),
        inset -1px -1px 4px rgba(255, 255, 255, 0.12);
}

html.dark .scene-page-neu .scene-neu-camera-orb {
    box-shadow:
        4px 5px 14px rgba(0, 0, 0, 0.52),
        -2px -2px 7px rgba(255, 255, 255, 0.06),
        inset 0 1.5px 0 rgba(255, 255, 255, 0.12),
        inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.role-dialogue-fx-enter-active,
.role-dialogue-fx-leave-active {
    transition: opacity 0.22s ease, transform 0.22s ease;
}

.role-dialogue-fx-enter-from,
.role-dialogue-fx-leave-to {
    opacity: 0;
    transform: translateY(6px);
}

/* 角色对话气泡：拟态（软凸起 + 内阴影层次，与站内 neu 按钮风格一致） */
.role-dialogue-neu-panel {
    border: 1px solid color-mix(in srgb, #fbbf24 28%, #fde68a 72%);
    background: linear-gradient(
        155deg,
        color-mix(in srgb, #fffbeb 94%, #fef3c7),
        color-mix(in srgb, #fff7ed 90%, #fde68a 18%)
    );
    box-shadow:
        6px 6px 16px color-mix(in srgb, #b45309 14%, transparent),
        -4px -4px 14px rgba(255, 255, 255, 0.95),
        inset 0 1px 0 rgba(255, 255, 255, 0.88),
        inset 0 -1px 0 color-mix(in srgb, #d97706 12%, transparent);
}

html.dark .role-dialogue-neu-panel {
    border-color: color-mix(in srgb, #d97706 35%, rgba(28, 25, 23, 0.9));
    background: linear-gradient(
        155deg,
        color-mix(in srgb, rgb(41 37 36) 92%, rgb(69 26 3)),
        color-mix(in srgb, rgb(28 25 23) 96%, rgb(120 53 15 / 0.45))
    );
    box-shadow:
        8px 8px 22px rgba(0, 0, 0, 0.55),
        -3px -3px 12px color-mix(in srgb, #fbbf24 9%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        inset 0 -2px 6px rgba(0, 0, 0, 0.35);
}

.role-dialogue-neu-tail {
    background: linear-gradient(
        135deg,
        color-mix(in srgb, #fffbeb 92%, #fef3c7),
        color-mix(in srgb, #fff7ed 88%, #fcd34d 22%)
    );
    border-right: 1px solid color-mix(in srgb, #fbbf24 22%, #fde68a);
    border-bottom: 1px solid color-mix(in srgb, #f59e0b 18%, transparent);
    box-shadow:
        3px 3px 8px color-mix(in srgb, #b45309 12%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

html.dark .role-dialogue-neu-tail {
    background: linear-gradient(
        135deg,
        color-mix(in srgb, rgb(41 37 36) 94%, rgb(69 26 3)),
        color-mix(in srgb, rgb(28 25 23) 98%, rgb(120 53 15 / 0.5))
    );
    border-right-color: color-mix(in srgb, #92400e 45%, rgb(41 37 36));
    border-bottom-color: color-mix(in srgb, #000000 45%, rgb(69 26 3));
    box-shadow:
        4px 4px 10px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

</style>
