<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch, computed } from 'vue'
import * as THREE from 'three'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImage } from '@/api';
import { uploadImageOSS } from '@/utils/ossUpload'
import { useConfigStore } from '@/stores/config';

const imagePicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)

interface Props {
  target: THREE.Mesh | null
  imageUrl: string
  maskUrl?: string
}
const props = defineProps<Props>()
const show = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let texture: THREE.CanvasTexture | null = null
const imageType = ref(0) // 0是添加图片 1是添加背景
const emit = defineEmits(['close'])

const isLoading = ref(false)

// 离屏 Canvas 用于缓存 Mask
const maskCanvas = document.createElement('canvas')
const maskCtx = maskCanvas.getContext('2d')
let hasMask = false

// 图片 & mask
const image = new Image()
const mask = new Image()

// 控制参数
let offsetX = 0
let offsetY = 0
let scale = 1
let rotation = 0

// 初始状态备份（用于取消还原）
let originalState = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  url: ''
}
let isSaved = false

// 交互状态
let dragging = false
let lastX = 0
let lastY = 0
let lastDist = 0
let lastAngle = 0

// 渲染循环控制
let isDirty = false
let animationFrameId = 0

// 事件处理函数引用（用于移除监听器）
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let mouseUpHandler: (() => void) | null = null
let mouseDownHandler: ((e: MouseEvent) => void) | null = null
let touchStartHandler: ((e: TouchEvent) => void) | null = null
let touchMoveHandler: ((e: TouchEvent) => void) | null = null
let wheelHandler: ((e: WheelEvent) => void) | null = null

// 添加事件监听器
const setupEventListeners = () => {
  if (!canvas.value) return
  
  // 鼠标拖动
  mouseDownHandler = (e: MouseEvent) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
  }
  
  mouseMoveHandler = (e: MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    // 简单的阈值检测，避免微小抖动导致的重绘
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
    
    offsetX += dx
    offsetY += dy
    lastX = e.clientX
    lastY = e.clientY
    isDirty = true // 标记为脏，下一帧绘制
  }
  
  mouseUpHandler = () => {
    dragging = false
  }
  
  // 触摸缩放 + 旋转
  touchStartHandler = (e: TouchEvent) => {
    e.preventDefault() // 防止滚动
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      lastDist = Math.hypot(dx, dy)
      lastAngle = Math.atan2(dy, dx)
    } else if (e.touches.length === 1) {
      lastX = e.touches[0].clientX
      lastY = e.touches[0].clientY
    }
  }
  
  touchMoveHandler = (e: TouchEvent) => {
    e.preventDefault() // 防止滚动
    let changed = false
    
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastX
      const dy = e.touches[0].clientY - lastY
      
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
         offsetX += dx
         offsetY += dy
         lastX = e.touches[0].clientX
         lastY = e.touches[0].clientY
         changed = true
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      
      // 旋转缩放通常都需要响应，因为变化比较敏感
      if (Math.abs(dist - lastDist) > 1 || Math.abs(angle - lastAngle) > 0.01) {
          scale *= dist / lastDist
          rotation += angle - lastAngle

          lastDist = dist
          lastAngle = angle
          changed = true
      }
    }
    
    if (changed) {
        isDirty = true
    }
  }
  
  wheelHandler = (e: WheelEvent) => {
    e.preventDefault()
    const zoomSpeed = 0.001 // 越大缩放越快
    scale += e.deltaY * -zoomSpeed
    scale = Math.max(0.1, Math.min(5, scale)) // 限制缩放范围 0.1~5
    isDirty = true
  }
  
  // 绑定事件
  canvas.value.addEventListener('mousedown', mouseDownHandler)
  window.addEventListener('mousemove', mouseMoveHandler)
  window.addEventListener('mouseup', mouseUpHandler)
  canvas.value.addEventListener('touchstart', touchStartHandler, { passive: false })
  canvas.value.addEventListener('touchmove', touchMoveHandler, { passive: false })
  canvas.value.addEventListener('wheel', wheelHandler)
}

// 移除事件监听器
const removeEventListeners = () => {
  if (!canvas.value) return
  
  if (mouseDownHandler) {
    canvas.value.removeEventListener('mousedown', mouseDownHandler)
    mouseDownHandler = null
  }
  if (mouseMoveHandler) {
    window.removeEventListener('mousemove', mouseMoveHandler)
    mouseMoveHandler = null
  }
  if (mouseUpHandler) {
    window.removeEventListener('mouseup', mouseUpHandler)
    mouseUpHandler = null
  }
  if (touchStartHandler) {
    canvas.value.removeEventListener('touchstart', touchStartHandler)
    touchStartHandler = null
  }
  if (touchMoveHandler) {
    canvas.value.removeEventListener('touchmove', touchMoveHandler)
    touchMoveHandler = null
  }
  if (wheelHandler) {
    canvas.value.removeEventListener('wheel', wheelHandler)
    wheelHandler = null
  }
}

const showModel = () => {
  show.value = true
  isSaved = false // 重置保存状态
  isDirty = true
  
  // 开启渲染循环
  if (!animationFrameId) {
    loop()
  }

  // 确保显示时重新生成 Mask 并绘制，然后添加事件监听器
  if (props.target) {
    nextTick(() => {
      setupTexture()
      // 在 canvas 渲染后添加事件监听器
      nextTick(() => {
        setupEventListeners()
      })
    })
  }
}

const closeModel = () => {
  if (!isSaved) {
    // 还原逻辑
    restoreOriginalState()
  } else {
    finishClose()
  }
}

const finishClose = () => {
  show.value = false
  cancelAnimationFrame(animationFrameId)
  animationFrameId = 0
  
  // 移除事件监听器
  removeEventListeners()
  
  // 显式释放资源
  if (texture) {
    texture.dispose()
    texture = null
  }
  
  emit('close')
}

// 还原到初始状态
const restoreOriginalState = () => {
  isLoading.value = true
  offsetX = originalState.offsetX
  offsetY = originalState.offsetY
  scale = originalState.scale
  rotation = originalState.rotation
  
  const restoreDraw = () => {
    try {
      isDirty = true
      draw() // 强制重绘
    } catch (error) {
      console.warn('还原状态时绘制失败:', error)
    } finally {
      isLoading.value = false
      finishClose()
    }
  }

  if (originalState.url) {
    // 检查是否需要重新加载图片
    // 注意：image.src 永远是绝对路径 (包含 base_img)
    // originalState.url 在 setupTexture 里也被存为了绝对路径
    
    // 检查当前图片是否有效
    const currentImageValid = image.src === originalState.url && 
                              image.complete && 
                              image.naturalWidth > 0 && 
                              image.naturalHeight > 0
    
    if (!currentImageValid) {
      // 需要重新加载图片
      image.onload = () => {
        // 确保图片加载成功后再绘制
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          restoreDraw()
        } else {
          // 图片加载失败，直接关闭
          restoreDraw()
        }
      }
      image.onerror = () => {
        // 图片加载失败，清空图片并关闭
        image.removeAttribute('src')
        restoreDraw()
      }
      image.src = originalState.url
    } else {
      // 当前图片有效，直接还原
      restoreDraw()
    }
  } else {
    // 初始没有图片
    image.removeAttribute('src') 
    restoreDraw()
  }
}

// 生成基于 UV 的 Mask (异步分片处理)
const generateMaskFromUV = async (mesh: THREE.Mesh) => {
  if (!maskCtx || !canvas.value) return false
  
  const width = canvas.value.width
  const height = canvas.value.height
  
  // 设置 maskCanvas 大小
  if (maskCanvas.width !== width || maskCanvas.height !== height) {
    maskCanvas.width = width
    maskCanvas.height = height
  }

  // 清空并填充黑色背景
  maskCtx.fillStyle = 'black'
  maskCtx.fillRect(0, 0, width, height)
  
  const geometry = mesh.geometry
  if (!geometry || !geometry.attributes.uv) return false

  const uvAttribute = geometry.attributes.uv
  const indexAttribute = geometry.index

  // 如果面数过多，显示 Loading
  const count = indexAttribute ? indexAttribute.count : uvAttribute.count
  const isLargeModel = count > 3000 // 3000 顶点/索引以上视为大模型
  
  if (isLargeModel) {
    isLoading.value = true
    // 让 UI 有机会渲染 Loading
    await new Promise(resolve => requestAnimationFrame(resolve))
  }

  maskCtx.beginPath()
  maskCtx.fillStyle = 'white'

  // 辅助函数：绘制三角形
  const drawTriangle = (a: number, b: number, c: number) => {
    const u1 = uvAttribute.getX(a) * width
    const v1 = (1 - uvAttribute.getY(a)) * height
    
    const u2 = uvAttribute.getX(b) * width
    const v2 = (1 - uvAttribute.getY(b)) * height
    
    const u3 = uvAttribute.getX(c) * width
    const v3 = (1 - uvAttribute.getY(c)) * height

    maskCtx.moveTo(u1, v1)
    maskCtx.lineTo(u2, v2)
    maskCtx.lineTo(u3, v3)
  }

  // 分批处理大小
  const BATCH_SIZE = 3000 
  let processed = 0
  
  const processBatch = async () => {
    return new Promise<void>(resolve => {
       // 使用 setTimeout 给 UI 线程喘息机会，避免卡死
       setTimeout(() => {
         resolve()
       }, 0)
    })
  }

  if (indexAttribute) {
    for (let i = 0; i < indexAttribute.count; i += 3) {
      drawTriangle(
        indexAttribute.getX(i),
        indexAttribute.getX(i + 1),
        indexAttribute.getX(i + 2)
      )
      
      processed += 3
      if (isLargeModel && processed % BATCH_SIZE === 0) {
         // 每批次填充一次，防止 path 过大
         maskCtx.fill()
         maskCtx.beginPath()
         await processBatch()
      }
    }
  } else {
    for (let i = 0; i < uvAttribute.count; i += 3) {
      drawTriangle(i, i + 1, i + 2)
      
      processed += 3
      if (isLargeModel && processed % BATCH_SIZE === 0) {
         maskCtx.fill()
         maskCtx.beginPath()
         await processBatch()
      }
    }
  }
  
  maskCtx.fill()
  
  if (isLargeModel) {
    isLoading.value = false
  }
  
  return true
}

function draw() {
  if (!ctx || !canvas.value) return
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // 1. 绘制 Mask
  let maskDrawn = false
  
  // 优先使用外部传入的 Mask 图片 (如果加载完成)
  if (props.maskUrl && mask.complete && mask.src) {
    ctx.save()
    ctx.drawImage(mask, 0, 0, canvas.value.width, canvas.value.height)
    ctx.globalCompositeOperation = 'source-in'
    maskDrawn = true
  } 
  // 否则使用 UV 生成的 Mask (如果有)
  else if (hasMask) {
    ctx.save()
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    maskDrawn = true
  }

  // 2. 绘制用户图片
  // 检查 image.src 是否有效，并且图片不是 broken 状态
  // naturalWidth 和 naturalHeight 为 0 表示图片加载失败
  const isImageValid = image.complete && 
                       image.src && 
                       image.src !== window.location.href &&
                       image.naturalWidth > 0 && 
                       image.naturalHeight > 0
  
  if (isImageValid) {
    try {
      // 如果没有 Mask，直接绘制；如果有 Mask，已经在上面设置了 source-in
      if (!maskDrawn) {
         ctx.save() // 为了保持 restore 的一致性
      }

      ctx.translate(canvas.value.width / 2 + offsetX, canvas.value.height / 2 + offsetY)
      ctx.rotate(rotation)
      ctx.scale(scale, scale)

      // 保持原图比例
      const imgAspect = image.naturalWidth / image.naturalHeight
      const canvasAspect = canvas.value.width / canvas.value.height
      let drawW: number
      let drawH: number
      if (imgAspect > canvasAspect) {
        drawW = canvas.value.width
        drawH = drawW / imgAspect
      } else {
        drawH = canvas.value.height
        drawW = drawH * imgAspect
      }

      ctx.drawImage(
        image,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
      )

      ctx.restore()
    } catch (error) {
      // 如果绘制失败，确保 restore
      console.warn('绘制图片失败:', error)
      if (maskDrawn) ctx.restore()
    }
  } else {
    // 如果没有图片但有 Mask，记得 restore
    if (maskDrawn) ctx.restore()
  }

  // 3. 更新 Texture
  // 只有在显示状态下才更新 Texture，避免后台更新
  if (show.value && texture) {
    texture.needsUpdate = true
  }
}

function loop() {
  // 如果面板关闭了，就停止循环
  if (!show.value) {
    animationFrameId = 0
    return
  }
  
  if (isDirty) {
    draw()
    isDirty = false
  }
  animationFrameId = requestAnimationFrame(loop)
}

async function setupTexture() {
  if (!props.target || !canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return

  // 设置 Canvas 尺寸
  canvas.value.width = 512
  canvas.value.height = 512

  // 生成 UV Mask (await 异步生成)
  hasMask = await generateMaskFromUV(props.target as THREE.Mesh)
  
  // 初始化 Texture
  if (!texture) {
    texture = new THREE.CanvasTexture(canvas.value)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
  } 
  
  texture.needsUpdate = true
  
  const mat = (props.target as THREE.Mesh).material as THREE.MeshStandardMaterial
  if (mat.map !== texture) {
    mat.map = texture
    mat.transparent = true
    mat.needsUpdate = true
  }

  // 读取并备份初始状态
  const parent = findTopmostParent(props.target)
  let targetUrl = ''
  
  // 优先从 userData 中读取之前的配置
  if (parent.userData.material && parent.userData.material[props.target.name]) {
      const options = parent.userData.material[props.target.name]
      offsetX = options.offsetX
      offsetY = options.offsetY
      scale = options.scale
      rotation= options.rotation
      
      if (options.url) {
        targetUrl = BASE_IMG + options.url
      }
  } else {
      // 第一次编辑，使用默认值
      offsetX = 0
      offsetY = 0
      scale = 1
      rotation = 0
      // 只有在没有 userData 配置时，才尝试使用 props.imageUrl (背景图)
      // 但也要注意，如果用户没有配置过，可能不希望显示背景图，而是显示空白等待上传?
      // 之前的逻辑是会显示 props.imageUrl
      targetUrl = props.imageUrl || ''
  }

  // 备份初始状态 (存绝对路径)
  originalState = { 
    offsetX, offsetY, scale, rotation, 
    url: targetUrl 
  }
  
  if (targetUrl) {
    image.src = targetUrl
    image.onload = () => { isDirty = true }
  } else {
    // 确保清空
    image.removeAttribute('src')
  }

  // 触发一次绘制
  isDirty = true
  draw()
}

onMounted(() => {
  // 初始化移动端检测（如果还没有初始化）
  if (typeof window !== 'undefined' && configStore.windowWidth === 1024) {
    configStore.initMobileDetection()
  }

  // 注意：不再默认启动 loop，而是在 showModel 时启动
  // 事件监听器会在 showModel 时添加

  if (props.maskUrl) {
    mask.src = props.maskUrl
    mask.onload = () => { isDirty = true }
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  // 移除事件监听器
  removeEventListeners()
  if (texture) {
    texture.dispose()
    texture = null
  }
})

const addImage = () => {
  imageType.value = 0
  if (imagePicker.value) {
    imagePicker.value.triggerInput()
  }
}
const findTopmostParent = (object: THREE.Mesh | THREE.Object3D) => {
  let current = object;
  while (current.parent && current.parent !== null && current.parent.type !== 'Scene') {
    current = current.parent;
  }
  return current;
}
const saveData = () => {
  if (!props.target) {
    return
  }
  const url = image.src.replace(BASE_IMG, '')
  const params = {
    id: props.target.name,
    offsetX, offsetY, scale, rotation,
    url
  }
  const parent = findTopmostParent(props.target)
  if (!parent.userData.material) {
    parent.userData.material = {}
  }
  parent.userData.material[props.target.name] = params
  
  // 更新 originalState 为当前保存的状态，防止关闭时还原
  originalState = { ...params, url: image.src }
  isSaved = true
  
  console.log(params, '参数', parent)
  // 可以添加 toast 提示
  closeModel() // 保存后自动关闭? 或者不关闭让用户继续调？根据需求，这里手动关闭比较好，或者让用户点关闭。
  // 按照目前逻辑，点击保存只保存数据，不关闭。
}

const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  isLoading.value = true
  uploadImageOSS({ file: file[0] })
    .then(async (res) => {      
      // 关键修复：更换图片时，重置 scale/rotation/offset 还是保持?
      // 通常更换图片希望保持位置，或者重置到默认?
      // 这里我们选择保留当前编辑状态，只换图
      
      // 更新 image src
      const newSrc = BASE_IMG + res
      
      // 确保 image 对象感知到变化
      image.src = newSrc
      
      image.onload = () => {
        isDirty = true // 标记重绘
        isLoading.value = false
      }
      image.onerror = () => {
        isLoading.value = false
      }
      if (imagePicker.value) {
        imagePicker.value.clear()
      }
    })
    .catch(() => {
      isLoading.value = false
    })
}
defineExpose({
  showModel
})
</script>

<template>
  <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" class="hidden" ref="imagePicker" />
  
  <!-- 抽屉容器 - PC端右侧，手机端下方 -->
  <Transition :name="isMobile ? 'slide-bottom' : 'slide-right'">
    <div 
      v-if="show"
      class="fixed z-[100] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden pointer-events-auto"
      :class="[
        isMobile 
          ? 'bottom-0 left-0 right-0 w-full max-h-[80vh] rounded-t-2xl' 
          : 'top-0 right-0 w-[480px] h-full'
      ]"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">贴图编辑器</h3>
        <button @click="closeModel" 
          class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700">
          <UIcon name="ant-design:close-outlined" class="text-lg" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="p-4 flex flex-col items-center gap-4 overflow-y-auto" :class="isMobile ? 'max-h-[calc(80vh-60px)]' : 'h-[calc(100vh-60px)]'">
        <!-- Canvas 容器 -->
        <div class="relative w-full aspect-square bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner group flex-shrink-0">
          <!-- 透明背景格子 -->
           <div class="absolute inset-0 z-0 opacity-30" 
                style="background-image: linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;">
           </div>
           
           <canvas ref="canvas" class="relative z-10 w-full h-full object-contain cursor-move touch-none"></canvas>
           
           <!-- Loading Overlay -->
           <div v-if="isLoading" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
             <UIcon name="svg-spinners:180-ring-with-bg" class="text-4xl text-qhx-primary" />
             <span class="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">处理中...</span>
           </div>

           <!-- 提示文字 -->
           <div class="absolute bottom-2 left-0 right-0 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <span class="px-3 py-1 bg-black/50 text-white text-[10px] rounded-full backdrop-blur-md">
               双指旋转缩放 / 单指拖拽
             </span>
           </div>
        </div>

        <!-- 操作按钮栏 -->
        <div class="grid grid-cols-2 gap-3 w-full flex-shrink-0">
          <button @click="addImage()" 
            class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 font-medium text-sm">
            <UIcon name="ant-design:picture-filled" class="text-lg text-blue-500" />
            更换图片
          </button>
          
          <button @click="saveData()" 
            class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-qhx-primary text-white hover:bg-qhx-primaryHover transition-all active:scale-95 shadow-lg shadow-pink-500/30 font-medium text-sm">
            <UIcon name="ant-design:save-filled" class="text-lg" />
            保存应用
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 抽屉滑动动画 - 右侧（PC端） */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 抽屉滑动动画 - 下方（手机端） */
.slide-bottom-enter-active,
.slide-bottom-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-bottom-enter-from,
.slide-bottom-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>