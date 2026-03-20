import type { Object3D, Quaternion, Scene, Vector3 } from 'three'

/**
 * 可扩展的场景撤销系统
 * 预留多种操作类型的撤销能力，当前实现移动、缩放、旋转的撤销
 */

/** 变换状态快照（位置、旋转、缩放） */
export interface TransformState {
  position: Vector3
  quaternion: Quaternion
  scale: Vector3
}

/** 撤销条目类型 */
export type UndoEntryType = 'transform' | string

/** 撤销条目基类 */
export interface UndoEntryBase {
  type: UndoEntryType
  /** 操作描述，用于调试或未来 UI 展示 */
  description?: string
}

/** 变换操作的撤销条目 */
export interface TransformUndoEntry extends UndoEntryBase {
  type: 'transform'
  objectUuid: string
  state: TransformState
}

export type UndoEntry = TransformUndoEntry | (UndoEntryBase & Record<string, unknown>)

/** 创建变换状态的深拷贝 */
function cloneTransformState(obj: Object3D): TransformState {
  return {
    position: obj.position.clone(),
    quaternion: obj.quaternion.clone(),
    scale: obj.scale.clone()
  }
}

/** 应用变换状态到对象 */
function applyTransformState(obj: Object3D, state: TransformState) {
  obj.position.copy(state.position)
  obj.quaternion.copy(state.quaternion)
  obj.scale.copy(state.scale)
}

/**
 * 场景撤销 composable
 * 支持扩展多种操作类型，当前实现 transform（移动/缩放/旋转）撤销
 */
export function useSceneUndo() {
  const undoStack = ref<UndoEntry[]>([])

  /** 在场景中按 uuid 查找对象（包含子对象） */
  const findObjectByUuid = (scene: Scene, uuid: string): Object3D | undefined => {
    let found: Object3D | undefined
    scene.traverse((obj) => {
      if (obj.uuid === uuid) {
        found = obj
        return
      }
    })
    return found
  }

  /** 是否可以撤销 */
  const canUndo = computed(() => undoStack.value.length > 0)

  /** 压入变换操作的撤销状态（操作前的状态，用于撤销时恢复） */
  const pushTransformUndo = (
    objectOrUuid: Object3D | string,
    state?: TransformState,
    description?: string
  ) => {
    const objectUuid = typeof objectOrUuid === 'string' ? objectOrUuid : objectOrUuid.uuid
    const entryState = state ?? (typeof objectOrUuid === 'object' ? cloneTransformState(objectOrUuid) : undefined)
    if (!entryState) return
    undoStack.value.push({
      type: 'transform',
      objectUuid,
      state: entryState,
      description: description ?? '移动/缩放/旋转'
    })
    // 限制栈深度，防止内存占用过大
    const MAX_UNDO = 50
    if (undoStack.value.length > MAX_UNDO) {
      undoStack.value.shift()
    }
  }

  /** 执行撤销 */
  const undo = (scene: Scene): boolean => {
    const entry = undoStack.value.pop()
    if (!entry || !scene) return false

    if (entry.type === 'transform') {
      const tEntry = entry as TransformUndoEntry
      const obj = findObjectByUuid(scene, tEntry.objectUuid)
      if (obj) {
        applyTransformState(obj, tEntry.state)
        return true
      }
    }

    // 预留：其他类型的 undo 处理
    return false
  }

  /** 清空撤销栈 */
  const clear = () => {
    undoStack.value = []
  }

  return {
    undoStack,
    canUndo,
    pushTransformUndo,
    undo,
    clear,
    findObjectByUuid,
    cloneTransformState
  }
}
