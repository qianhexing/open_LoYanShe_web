<script setup lang="ts">
/**
 * QhxSortableList —— 高性能、零依赖的拖拽排序列表（不使用 vuedraggable）
 *
 * 设计目标：动画流畅、滚动/拖拽不掉帧。
 * 关键手法：
 *  - 指针事件统一鼠标 / 触摸；触摸用长按(delay)区分滚动与拖拽，鼠标用位移阈值。
 *  - 拖拽时生成一个 position:fixed 的「克隆」跟随手指（GPU transform），原节点留位作占位（ghost）。
 *  - 命中检测用 document.elementFromPoint（克隆 pointer-events:none），天然兼容换行 / 滚动，避免维护 rect 数组。
 *  - 重排用 FLIP（First-Last-Invert-Play）transform 过渡，其他卡片平滑让位，只用 transform 不触发重排重绘。
 *  - 列表项保留外部传入的 content-visibility 等样式，屏外项不参与绘制，长列表进入排序也不卡。
 *  - 靠近滚动容器上下边缘时自动滚动。
 *
 * 用法（与 vuedraggable 接近，便于替换）：
 *  <QhxSortableList v-model="list" item-key="id" item-class="..." :disabled="!sortMode"
 *     ghost-class="drag-ghost" drag-class="dragging" @start="..." @end="...">
 *    <template #item="{ element, index }"> ... </template>
 *  </QhxSortableList>
 */
import { ref, onBeforeUnmount, nextTick } from 'vue'

type ItemKey = string | number

interface EndPayload {
  oldIndex: number
  newIndex: number
  key: ItemKey | null
  clientX: number
  clientY: number
  originalEvent: PointerEvent | null
}

const props = withDefaults(
  defineProps<{
    /** 列表数据（v-model） */
    modelValue: any[]
    /** 取每项唯一 key：字段名或函数 */
    itemKey: string | ((item: any) => ItemKey)
    /** 列表容器标签 */
    tag?: string
    /** 每个列表项外层 class（如响应式宽度） */
    itemClass?: unknown
    /** 是否禁用拖拽 */
    disabled?: boolean
    /** FLIP 动画时长（ms） */
    animation?: number
    /** 触摸长按触发拖拽的延时（ms） */
    delay?: number
    /** 触摸候选期允许的位移容差（超过判定为滚动，放弃拖拽） */
    touchTolerance?: number
    /** 鼠标开始拖拽的位移阈值 */
    mouseThreshold?: number
    /** ghost（占位原节点）class */
    ghostClass?: string
    /** 拖拽克隆 class */
    dragClass?: string
    /** 自动滚动触发的边缘厚度（px） */
    scrollEdge?: number
    /** 自动滚动最大速度（px/frame） */
    scrollSpeed?: number
    /** 返回需要自动滚动的容器；不传则向上查找最近可滚动祖先 */
    getScrollContainer?: () => HTMLElement | null | undefined
  }>(),
  {
    tag: 'div',
    disabled: false,
    animation: 240,
    delay: 140,
    touchTolerance: 10,
    mouseThreshold: 4,
    ghostClass: 'qhx-sortable-ghost',
    dragClass: 'qhx-sortable-drag',
    scrollEdge: 64,
    scrollSpeed: 18,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void
  (e: 'start', payload: { index: number; key: ItemKey | null }): void
  (e: 'end', payload: EndPayload): void
  (e: 'change', value: any[]): void
}>()

const containerRef = ref<HTMLElement | null>(null)

function keyOf(item: any): ItemKey {
  return typeof props.itemKey === 'function' ? props.itemKey(item) : item?.[props.itemKey]
}
function keyStrOf(item: any): string {
  return String(keyOf(item))
}
function indexByKeyStr(s: string): number {
  return props.modelValue.findIndex((it) => keyStrOf(it) === s)
}

/** 仅用于驱动 ghost class 的响应式 key；其余拖拽状态用普通变量避免逐帧 re-render */
const draggingKey = ref<ItemKey | null>(null)

let pointerId: number | null = null
let candidate = false
let dragging = false
let startX = 0
let startY = 0
let curX = 0
let curY = 0
let baseLeft = 0
let baseTop = 0
let activeKey: ItemKey | null = null
let activeIndex = -1
let startIndex = -1
let cloneEl: HTMLElement | null = null
let originalEl: HTMLElement | null = null
let delayTimer: ReturnType<typeof setTimeout> | null = null
let loopRaf: number | null = null
let reordering = false
let lastReorderAt = 0
let scrollEl: HTMLElement | null = null

const EASING = 'cubic-bezier(0.2, 0, 0, 1)'

function clearDelay() {
  if (delayTimer != null) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
}

function getItemEls(): HTMLElement[] {
  const root = containerRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-qhx-key]'))
}

/** 由命中元素向上找到属于本列表的直接子项 */
function findItemEl(target: EventTarget | null): HTMLElement | null {
  const root = containerRef.value
  let el = target as HTMLElement | null
  while (el && el !== root) {
    if (el.parentElement === root && el.dataset && el.dataset.qhxKey != null) return el
    el = el.parentElement
  }
  return null
}

function findScrollContainer(): HTMLElement | null {
  const custom = props.getScrollContainer?.()
  if (custom) return custom
  let el = containerRef.value?.parentElement || null
  while (el) {
    const style = getComputedStyle(el)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return null
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled || dragging || candidate) return
  // 鼠标仅响应左键
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const el = e.currentTarget as HTMLElement | null
  if (!el) return

  pointerId = e.pointerId
  candidate = true
  originalEl = el
  activeKey = el.dataset.qhxKey ?? null
  startX = curX = e.clientX
  startY = curY = e.clientY

  // pointermove 设为 passive，保证候选/判定阶段原生滚动依旧顺滑；
  // 真正进入拖拽后再用非 passive 的 touchmove 阻止滚动（见 beginDrag）。
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('pointercancel', onPointerCancel, { passive: true })

  if (e.pointerType === 'touch') {
    // 触摸：长按后进入拖拽；期间若滚动会触发 pointercancel 或位移超容差而放弃
    delayTimer = setTimeout(() => {
      if (candidate && !dragging) beginDrag()
    }, props.delay)
  }
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  curX = e.clientX
  curY = e.clientY

  if (candidate && !dragging) {
    const dist = Math.hypot(curX - startX, curY - startY)
    if (e.pointerType === 'touch') {
      // 长按未到就移动 => 判定为滚动，放弃拖拽（不拦截，原生滚动继续）
      if (dist > props.touchTolerance) cleanup(false)
    } else if (dist > props.mouseThreshold) {
      beginDrag()
    }
  }
}

/** 拖拽中阻止触摸滚动：touchmove 可取消，preventDefault 才能真正阻止页面滚动 */
function onTouchMoveBlock(e: TouchEvent) {
  if (dragging) e.preventDefault()
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  if (dragging) finishDrag(e)
  else cleanup(false)
}

function onPointerCancel(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  if (dragging) finishDrag(e)
  else cleanup(false)
}

function beginDrag() {
  if (!originalEl || !containerRef.value) return cleanup(false)
  clearDelay()
  candidate = false
  dragging = true

  activeIndex = startIndex = activeKey != null ? indexByKeyStr(String(activeKey)) : -1
  scrollEl = findScrollContainer()

  const rect = originalEl.getBoundingClientRect()
  baseLeft = rect.left
  baseTop = rect.top

  // 生成跟手克隆
  const clone = originalEl.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-qhx-key')
  clone.style.position = 'fixed'
  clone.style.left = `${rect.left}px`
  clone.style.top = `${rect.top}px`
  clone.style.width = `${rect.width}px`
  clone.style.height = `${rect.height}px`
  clone.style.margin = '0'
  clone.style.boxSizing = 'border-box'
  clone.style.pointerEvents = 'none'
  clone.style.zIndex = '99999'
  clone.style.willChange = 'transform'
  clone.style.transform = 'translate3d(0,0,0)'
  clone.style.transition = 'none'
  clone.classList.add('qhx-sortable-clone')
  if (props.dragClass) clone.classList.add(...props.dragClass.split(/\s+/).filter(Boolean))
  document.body.appendChild(clone)
  cloneEl = clone

  // 原节点变占位
  if (props.ghostClass) originalEl.classList.add(...props.ghostClass.split(/\s+/).filter(Boolean))
  draggingKey.value = activeKey

  // 拖拽期间禁用触摸滚动与文本选择：
  // touch-action:none 阻止后续手势滚动，非 passive 的 touchmove + preventDefault 阻止当前手势滚动
  containerRef.value.style.touchAction = 'none'
  document.body.style.userSelect = 'none'
  window.addEventListener('touchmove', onTouchMoveBlock, { passive: false })

  emit('start', { index: activeIndex, key: activeKey })

  updateClonePosition()
  loopRaf = requestAnimationFrame(loop)
}

function updateClonePosition() {
  if (!cloneEl) return
  // 轻微放大营造“拿起”手感；落位时再缩回
  cloneEl.style.transform = `translate3d(${curX - startX}px, ${curY - startY}px, 0) scale(1.03)`
}

function loop() {
  if (!dragging) return
  updateClonePosition()
  stepAutoScroll()
  if (!reordering) hitTest()
  loopRaf = requestAnimationFrame(loop)
}

function stepAutoScroll() {
  if (!scrollEl) return
  const rect = scrollEl.getBoundingClientRect()
  const edge = props.scrollEdge
  let delta = 0
  if (curY < rect.top + edge) {
    const ratio = (rect.top + edge - curY) / edge
    delta = -props.scrollSpeed * Math.min(1, ratio)
  } else if (curY > rect.bottom - edge) {
    const ratio = (curY - (rect.bottom - edge)) / edge
    delta = props.scrollSpeed * Math.min(1, ratio)
  }
  if (delta !== 0) {
    const before = scrollEl.scrollTop
    scrollEl.scrollTop = before + delta
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function hitTest() {
  if (!cloneEl) return
  // 重排冷却：FLIP 动画期间不再命中，避免命中到正在位移的元素而来回抖动
  if (now() - lastReorderAt < props.animation) return
  const hit = document.elementFromPoint(curX, curY)
  const itemEl = findItemEl(hit)
  if (!itemEl) return
  const targetKeyStr = itemEl.dataset.qhxKey
  if (targetKeyStr == null || targetKeyStr === String(activeKey)) return
  const targetIndex = indexByKeyStr(targetKeyStr)
  if (targetIndex < 0 || targetIndex === activeIndex) return
  void performReorder(activeIndex, targetIndex)
}

async function performReorder(from: number, to: number) {
  if (reordering || from < 0 || to < 0) return
  reordering = true

  // FLIP: First —— 记录所有项当前位置
  const els = getItemEls()
  const firstRects = new Map<string, DOMRect>()
  for (const el of els) firstRects.set(el.dataset.qhxKey as string, el.getBoundingClientRect())

  // 重排数组并通知父级
  const next = props.modelValue.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  emit('update:modelValue', next)
  emit('change', next)
  activeIndex = to

  // 等待 DOM 更新
  await nextTick()

  // FLIP: Last + Invert + Play
  const animatedEls = getItemEls()
  const playing: HTMLElement[] = []
  for (const el of animatedEls) {
    const k = el.dataset.qhxKey as string
    const first = firstRects.get(k)
    if (!first) continue
    const last = el.getBoundingClientRect()
    const dx = first.left - last.left
    const dy = first.top - last.top
    if (dx === 0 && dy === 0) continue
    el.style.transition = 'none'
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
    playing.push(el)
  }
  if (playing.length) {
    // 强制一次回流后再播放过渡
    void containerRef.value?.offsetHeight
    for (const el of playing) {
      el.style.transition = `transform ${props.animation}ms ${EASING}`
      el.style.transform = ''
    }
  }

  // 注意：克隆始终以「拖拽起点」为基准用 transform 跟手（fixed 定位、viewport 坐标），
  // 占位节点位置变化不影响克隆跟手，无需重算基准；重算反而会让克隆跳变并引发回弹。
  reordering = false
  lastReorderAt = now()
}

function finishDrag(e: PointerEvent) {
  dragging = false
  if (loopRaf != null) {
    cancelAnimationFrame(loopRaf)
    loopRaf = null
  }
  const payload: EndPayload = {
    oldIndex: startIndex,
    newIndex: activeIndex,
    key: activeKey,
    clientX: e.clientX,
    clientY: e.clientY,
    originalEvent: e,
  }

  // 立即恢复交互（滚动 / 选择），ghost 在落位动画结束后再移除
  restoreInteraction()
  draggingKey.value = null

  // 落位动画：克隆平滑回到占位最终位置后移除（捕获 origin，避免 resetState 置空后取不到）
  const clone = cloneEl
  const origin = originalEl
  if (clone && origin) {
    const r = origin.getBoundingClientRect()
    const targetX = r.left - baseLeft
    const targetY = r.top - baseTop
    clone.style.transition = `transform ${props.animation}ms ${EASING}`
    clone.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1)`
    let done = false
    const finalize = () => {
      if (done) return
      done = true
      clone.removeEventListener('transitionend', finalize)
      clone.remove()
      removeGhost(origin)
    }
    clone.addEventListener('transitionend', finalize)
    setTimeout(finalize, props.animation + 80)
  } else {
    if (clone) clone.remove()
    removeGhost(origin)
  }
  cloneEl = null

  emit('end', payload)
  teardownListeners()
  resetState()
}

/** 移除指定节点的 ghost 占位样式 */
function removeGhost(el: HTMLElement | null) {
  if (el && props.ghostClass) {
    el.classList.remove(...props.ghostClass.split(/\s+/).filter(Boolean))
  }
}

/** 恢复拖拽期间禁用的页面交互 */
function restoreInteraction() {
  if (containerRef.value) containerRef.value.style.touchAction = ''
  if (typeof document !== 'undefined') document.body.style.userSelect = ''
}

function teardownListeners() {
  window.removeEventListener('pointermove', onPointerMove as EventListener)
  window.removeEventListener('pointerup', onPointerUp as EventListener)
  window.removeEventListener('pointercancel', onPointerCancel as EventListener)
  window.removeEventListener('touchmove', onTouchMoveBlock as EventListener)
}

function resetState() {
  pointerId = null
  candidate = false
  dragging = false
  originalEl = null
  activeKey = null
  activeIndex = startIndex = -1
  scrollEl = null
  reordering = false
}

/** 取消（非拖拽收尾，如候选期判定为滚动 / 普通点击） */
function cleanup(_dragged: boolean) {
  clearDelay()
  if (cloneEl) {
    cloneEl.remove()
    cloneEl = null
  }
  removeGhost(originalEl)
  draggingKey.value = null
  restoreInteraction()
  teardownListeners()
  resetState()
}

onBeforeUnmount(() => {
  clearDelay()
  if (loopRaf != null) cancelAnimationFrame(loopRaf)
  if (cloneEl) cloneEl.remove()
  teardownListeners()
  if (typeof document !== 'undefined') document.body.style.userSelect = ''
})
</script>

<template>
  <component :is="tag" ref="containerRef">
    <div
      v-for="(element, index) in modelValue"
      :key="keyOf(element)"
      :data-qhx-key="keyStrOf(element)"
      :class="['qhx-sortable-item', itemClass]"
      @pointerdown="onPointerDown"
    >
      <slot name="item" :element="element" :index="index" />
    </div>
  </component>
</template>

<style scoped>
.qhx-sortable-item {
  touch-action: auto;
}
/* 占位原节点：拖拽中淡出，提示“原位” */
:global(.qhx-sortable-ghost) {
  opacity: 0.32 !important;
  transition: opacity 0.18s ease;
}
/* 拖拽克隆：跟手、抬起阴影；transform 由 JS 内联控制 */
:global(.qhx-sortable-clone) {
  pointer-events: none;
  will-change: transform;
  cursor: grabbing;
  filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.26));
}
/* 默认 dragClass（页面未指定时生效） */
:global(.qhx-sortable-drag) {
  opacity: 0.97;
}
</style>
