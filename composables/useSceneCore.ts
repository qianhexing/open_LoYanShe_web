import qhxCore, { type CameraState } from '@/utils/threeCore';
import * as THREE from 'three';
import { getSceneId } from '@/api/scene'
import type { DiaryInterface, LibraryInterface } from '@/types/sence'
import type { Scene } from '@/types/api'

export const useSceneCore = () => {
    const threeCore = shallowRef<qhxCore | null>(null)
    const sceneLoading = ref(false)
    const sceneLoadProgress = ref({ current: 0, total: 0 })
    const sceneLoadError = ref<string | null>(null)
    const diaryList = ref<DiaryInterface[]>([])
    const libraryList = ref<LibraryInterface[]>([])
    const clickObject = ref<THREE.Object3D[] | null>(null)
    const isClick = ref(false)
    const pointerDownPosition = ref({ x: 0, y: 0 })
    const MOVE_THRESHOLD = 5
    const doubleClickTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const operaPosition = ref<{ x: number, y: number }>({ x: 0, y: 0 })
    
    // 基础配置
    const config = reactive({
        editMode: false,
        baseUrl: '' // BASE_IMG
    })

    const updateDiaryAndLibraryLists = () => {
        if (!threeCore.value) return

        if (clickObject.value && clickObject.value.length > 0) {
            operaPosition.value = threeCore.value.screenPositionFromObject(clickObject.value[0])
        }

        const diary_list: DiaryInterface[] = []
        if (threeCore.value.loadedDiary && threeCore.value.loadedDiary.length > 0) {
            threeCore.value.loadedDiary.forEach((diary) => {
                const position = threeCore.value!.screenPositionFromObject(diary.object)
                diary_list.push({ 
                    object: diary.object, 
                    title: diary.object.userData.title, 
                    content: diary.object.userData.content, 
                    position, 
                    id: diary.object.uuid 
                })
            })
        }
        diaryList.value = diary_list

        const library_list: LibraryInterface[] = []
        if (threeCore.value.loadedLibrary && threeCore.value.loadedLibrary.length > 0) {
            threeCore.value.loadedLibrary.forEach((library) => {
                const position = threeCore.value!.screenPositionFromObject(library.object)
                library_list.push({ 
                    object: library.object, 
                    title: library.object.userData.title, 
                    cover: library.object.userData.cover, 
                    position, 
                    id: library.object.uuid, 
                    library_id: library.object.userData.library_id 
                })
            })
        }
        libraryList.value = library_list
    }

    const gpuPick = (ev: MouseEvent | TouchEvent) => {
        if (!threeCore.value) return
        const obj = threeCore.value.gpuPick(ev)
        // console.log('点击', obj)
        if (obj) {
            if (doubleClickTimer.value) {
                clearTimeout(doubleClickTimer.value)
                doubleClickTimer.value = null
                if (clickObject.value && clickObject.value.length > 0 && clickObject.value[0].uuid === obj.uuid) {
                    // console.log('双击')
                    threeCore.value.lookAtSelectObj([obj])
                    return
                }
            }
            if (clickObject.value && clickObject.value[0].uuid === obj.uuid) {
                // console.log('点到同一个目标')
                return
            }
            if (config.editMode) {
                threeCore.value.transformControls.attach(obj)
                // setMode('translate') // 需要外部处理或者传入回调
                threeCore.value.showbloom = false
            }
            doubleClickTimer.value = setTimeout(() => {
                doubleClickTimer.value = null
            }, 300)
            clickObject.value = [obj]
            operaPosition.value = threeCore.value.screenPositionFromObject(obj)

        } else if (threeCore.value.gizmo?.dragging) {
            // dragging logic
        } else {
            if (config.editMode) {
                threeCore.value.transformControls.detach()
                threeCore.value.showbloom = true
            }
            clickObject.value = null
        }
    }

    const _onPointerDown = (event: PointerEvent) => {
        isClick.value = true
        pointerDownPosition.value = { x: event.clientX, y: event.clientY }
    }

    const _onPointerMove = (event: PointerEvent) => {
        if (isClick.value) {
            const deltaX = Math.abs(event.clientX - pointerDownPosition.value.x)
            const deltaY = Math.abs(event.clientY - pointerDownPosition.value.y)
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

            if (distance > MOVE_THRESHOLD) {
                isClick.value = false
            }
        }
    }

    const _onPointerUp = (event: PointerEvent) => {
        if (isClick.value) {
            gpuPick(event)
        }
        isClick.value = false
    }

    const initScene = async (container: HTMLElement, id: string, options: { 
        editMode: boolean, 
        baseUrl: string,
        sceneData?: Scene | null,
        enableAR?: boolean
    }) => {
        sceneLoading.value = true
        sceneLoadError.value = null
        config.editMode = options.editMode
        config.baseUrl = options.baseUrl

        try {
            const core = new qhxCore({
                enableCSS3DRenderer: true,
                alpha: true,
                editMode: options.editMode,
                enableAR: options.enableAR
            })
            threeCore.value = core
            
            core.mount(container)
            
            if (options.enableAR) {
                await core.initAR()
                isWebcamAR.value = core.isWebcamAR
            }

            const onProgress = (current: number, total: number) => {
                sceneLoadProgress.value = { current, total }
            }

            let detail = options.sceneData
            
            // 如果没有传入 sceneData，则尝试获取
            if (!detail) {
                // 这里假设 getSceneId 可以直接调用，或者需要外部传入获取数据的逻辑
                 const { data } = await useAsyncData('studyDeatil-' + id, () => {
                     return getSceneId({ sence_id: Number.parseInt(id) })
                 }, {})
                 detail = data.value
            }

            if (detail?.json_data) {
                const total = detail.json_data?.objects?.length || 0
                sceneLoadProgress.value = { current: 0, total }
                await core.loadSceneFromJSON(detail.json_data, false, onProgress)
            } else {
                 try {
                    const res = await use$Get(`/sence/json/${id}.json`, undefined, { baseURL: options.baseUrl })
                    const total = res?.objects?.length || 0
                    sceneLoadProgress.value = { current: 0, total }
                    await core.loadSceneFromJSON(res, false, onProgress)
                } catch (error) {
                    console.error('加载场景JSON失败:', error)
                    throw new Error(error instanceof Error ? error.message : '加载场景数据失败，请稍后重试')
                }
            }

            core.controls.enabled = true
            if (core.cameraList && core.cameraList.length > 0) {
                core.lookAtCameraState(core.cameraList[0])
            }

            container.addEventListener('pointerdown', _onPointerDown)
            container.addEventListener('pointermove', _onPointerMove)
            container.addEventListener('pointerup', _onPointerUp)

            core.startAnimationLoop()
            core.addAnimationFunc = () => { updateDiaryAndLibraryLists() }

            sceneLoading.value = false
            sceneLoadError.value = null
            
            return core
        } catch (error) {
            console.error('初始化场景失败:', error)
            sceneLoadError.value = error instanceof Error ? error.message : '初始化场景失败，请稍后重试'
            sceneLoading.value = false
            if (threeCore.value) {
                try {
                    threeCore.value.dispose?.()
                } catch (e) {
                    console.error('清理资源失败:', e)
                }
            }
            throw error
        }
    }
    
    const disposeScene = (container?: HTMLElement) => {
        if (container) {
            container.removeEventListener('pointerdown', _onPointerDown)
            container.removeEventListener('pointermove', _onPointerMove)
            container.removeEventListener('pointerup', _onPointerUp)
        }
        if (threeCore.value) {
            threeCore.value.dispose?.()
            threeCore.value = null
        }
    }

    const isWebcamAR = ref(false)

    // ... existing code ...

    const toggleQRScan = ref(true)

    const requestPermission = async () => {
        if (threeCore.value) {
            await threeCore.value.requestDeviceOrientationPermission()
        }
    }

    const placeScene = () => {
        if (threeCore.value) {
            threeCore.value.placeSceneInFrontOfCamera()
        }
    }

    return {
        threeCore,
        sceneLoading,
        sceneLoadProgress,
        sceneLoadError,
        diaryList,
        libraryList,
        clickObject,
        operaPosition,
        initScene,
        disposeScene,
        updateDiaryAndLibraryLists,
        isWebcamAR,
        requestPermission,
        placeScene,
        toggleQRScan
    }
}
