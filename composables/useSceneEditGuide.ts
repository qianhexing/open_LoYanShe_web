import type { StepGuideItem } from '@/components/Qhx/StepGuide.vue'
import type { SceneEditGuideStep } from '@/utils/sceneEditGuide'
import {
  hasCompletedSceneEditGuide,
  SCENE_EDIT_GUIDE_STEPS,
  SCENE_EDIT_GUIDE_STORAGE_KEY
} from '@/utils/sceneEditGuide'

/** 场景编辑页首次进入（edit/add 模式）时展示步骤引导 */
export function useSceneEditGuide(options: {
  editMode: Ref<boolean>
  addMode: Ref<boolean>
  sceneLoading: Ref<boolean>
}) {
  const showGuide = ref(false)
  let triggered = false

  let onStepLayout: ((step: SceneEditGuideStep, index: number) => void) | undefined
  let onGuideOpen: (() => void) | undefined
  let onGuideClose: (() => void) | undefined

  const shouldOfferGuide = computed(
    () =>
      import.meta.client &&
      (options.editMode.value || options.addMode.value) &&
      !hasCompletedSceneEditGuide()
  )

  function tryOpenGuide() {
    if (triggered || !shouldOfferGuide.value) return
    if (options.sceneLoading.value) return
    triggered = true
    showGuide.value = true
  }

  watch(
    [options.sceneLoading, options.editMode, options.addMode],
    ([loading]) => {
      if (!loading) {
        nextTick(() => {
          requestAnimationFrame(() => tryOpenGuide())
        })
      }
    },
    { immediate: true }
  )

  watch(showGuide, (open, wasOpen) => {
    if (open) {
      onGuideOpen?.()
    } else if (wasOpen) {
      onGuideClose?.()
    }
  }, { flush: 'sync' })

  function registerGuideLayoutHandlers(handlers: {
    onOpen?: () => void
    onClose?: () => void
    onStep?: (step: SceneEditGuideStep, index: number) => void
  }) {
    onGuideOpen = handlers.onOpen
    onGuideClose = handlers.onClose
    onStepLayout = handlers.onStep
  }

  function onGuideStepChange(index: number, _step: StepGuideItem) {
    const guideStep = SCENE_EDIT_GUIDE_STEPS[index]
    if (guideStep) {
      onStepLayout?.(guideStep, index)
    }
  }

  /** 手动重播引导（不依赖 localStorage 是否已完成） */
  function replayGuide() {
    if (!(options.editMode.value || options.addMode.value)) return
    if (options.sceneLoading.value) return
    if (showGuide.value) {
      showGuide.value = false
      nextTick(() => {
        showGuide.value = true
      })
      return
    }
    showGuide.value = true
  }

  return {
    showGuide,
    guideSteps: SCENE_EDIT_GUIDE_STEPS,
    guideStorageKey: SCENE_EDIT_GUIDE_STORAGE_KEY,
    onGuideStepChange,
    registerGuideLayoutHandlers,
    replayGuide
  }
}
