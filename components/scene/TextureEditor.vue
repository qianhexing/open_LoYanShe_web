<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImage } from '@/api';
const imagePicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)

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


// 图片 & mask
const image = new Image()
const mask = new Image()

// 控制参数
let offsetX = 0
let offsetY = 0
let scale = 1
let rotation = 0

// 交互状态
let dragging = false
let lastX = 0
let lastY = 0
let lastDist = 0
let lastAngle = 0

const showModel = () => {
  show.value = true
}
const closeModel = () => {
  show.value = false
  emit('close')
}
function draw() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  if (props.maskUrl && mask.complete) {
    ctx.save()
    ctx.drawImage(mask, 0, 0, canvas.value.width, canvas.value.height)
    ctx.globalCompositeOperation = 'source-in'
  }

  if (image.complete) {
    ctx.save()
    ctx.translate(canvas.value.width / 2 + offsetX, canvas.value.height / 2 + offsetY)
    ctx.rotate(rotation)
    ctx.scale(scale, scale)

    // === 新增：保持原图比例 ===
    const imgAspect = image.width / image.height
    const canvasAspect = canvas.value.width / canvas.value.height
    let drawW: number
    let drawH: number
    if (imgAspect > canvasAspect) {
      // 图片更宽 → 宽占满
      drawW = canvas.value.width
      drawH = drawW / imgAspect
    } else {
      // 图片更高 → 高占满
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
  }

  if (props.maskUrl) ctx.restore()
  if (texture) texture.needsUpdate = true
}


function setupTexture() {
  if (!props.target || !canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  // 如果纹理已存在，先释放
  if (texture) {
    texture.dispose()
  }
  
  texture = new THREE.CanvasTexture(canvas.value)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  texture.flipY = false
  
  const targetMesh = props.target as THREE.Mesh
  // 确保材质是单一材质且支持 map
  if (targetMesh.material) {
    const mat = targetMesh.material as THREE.MeshStandardMaterial
    mat.map = texture
    mat.transparent = true
    // mat.alphaTest = 0.5 // 可选：如果需要硬裁剪
    mat.needsUpdate = true
  }

  draw()
}

onMounted(async () => {
  if (!canvas.value) return
  
  // 1. 优先加载 Mask 并适配 Canvas 尺寸
  if (props.maskUrl) {
    await new Promise((resolve) => {
      mask.src = props.maskUrl
      mask.crossOrigin = 'Anonymous'
      mask.onload = () => {
        if (canvas.value) {
          // 适配 Mask 比例，最大边长 1024
          const maxDim = 1024
          const aspect = mask.width / mask.height
          if (aspect >= 1) {
            canvas.value.width = maxDim
            canvas.value.height = maxDim / aspect
          } else {
            canvas.value.height = maxDim
            canvas.value.width = maxDim * aspect
          }
        }
        resolve(true)
      }
      mask.onerror = () => {
        console.error('Mask load failed')
        if (canvas.value) {
          canvas.value.width = 512
          canvas.value.height = 512
        }
        resolve(false)
      }
    })
  } else {
    canvas.value.width = 512
    canvas.value.height = 512
  }

  // 2. 初始化 Texture
  setupTexture()

  // 3. 加载图片数据
  if (props.target) {
    const parent = findTopmostParent(props.target)
    console.log(parent)
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    if (parent.userData.material && parent.userData.material[props.target.name]) {
      const options = parent.userData.material[props.target.name]
      offsetX = options.offsetX
      offsetY = options.offsetY
      scale = options.scale
      rotation= options.rotation
      image.src = BASE_IMG + options.url
    } else {
      image.src = props.imageUrl
    }
    image.crossOrigin = 'Anonymous'
    image.onload = draw
  }

  // 鼠标拖动
  canvas.value.addEventListener('mousedown', e => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
  })
  window.addEventListener('mousemove', e => {
    if (!dragging) return
    offsetX += e.clientX - lastX
    offsetY += e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    draw()
  })
  window.addEventListener('mouseup', () => (dragging = false))

  // 触摸缩放 + 旋转
  canvas.value.addEventListener('touchstart', e => {
    e.preventDefault() // 防止页面滚动
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      lastDist = Math.hypot(dx, dy)
      lastAngle = Math.atan2(dy, dx)
    } else if (e.touches.length === 1) {
      lastX = e.touches[0].clientX
      lastY = e.touches[0].clientY
    }
  })

  canvas.value.addEventListener('touchmove', e => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastX
      const dy = e.touches[0].clientY - lastY
      offsetX += dx
      offsetY += dy
      lastX = e.touches[0].clientX
      lastY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)

      scale *= dist / lastDist
      rotation += angle - lastAngle

      lastDist = dist
      lastAngle = angle
    }
    draw()
  })
  canvas.value.addEventListener('wheel', e => {
    e.preventDefault()
    const zoomSpeed = 0.001 // 越大缩放越快
    scale += e.deltaY * -zoomSpeed
    scale = Math.max(0.1, Math.min(5, scale)) // 限制缩放范围 0.1~5
    draw()
  })
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
  console.log(params, '参数', parent)
  // 保存后关闭
  closeModel()
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  uploadImage(file[0])
    .then(async (res) => {
      console.log('上传返回', res)
      image.src = BASE_IMG + res.file_url
      image.onload = () => {
        // 重置变换参数，让新图片居中显示
        offsetX = 0
        offsetY = 0
        scale = 1
        rotation = 0
        draw()
      }
      if (imagePicker.value) {
        imagePicker.value.clear()
      }
    })
}
defineExpose({
  showModel
})
</script>

<template>
  <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" class="hidden" ref="imagePicker" />
  
  <!-- 遮罩层 -->
  <transition name="fade">
    <div v-if="show" class="fixed inset-0 bg-black/50 z-20" @click="closeModel"></div>
  </transition>

  <!-- 编辑面板 -->
  <div 
    class="w-full fixed transition-all duration-300 bottom-0 left-0 z-30 bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl flex flex-col max-h-[90vh]"
    :class="show ? 'translate-y-0' : 'translate-y-full'"
  >
    <!-- 头部：标题和关闭 -->
    <div class="h-12 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0">
      <h3 class="font-bold text-gray-700 dark:text-gray-200">编辑贴图</h3>
      <button 
        class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        @click="closeModel"
      >
        <UIcon name="ant-design:close-outlined" class="text-lg" />
      </button>
    </div>

    <!-- 画布区域 -->
    <div class="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div class="relative shadow-lg canvas-wrapper">
        <canvas ref="canvas" class="block touch-none checkerboard-bg rounded"></canvas>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="h-16 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-4 shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur safe-area-bottom">
      <button
        class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[64px]"
        @click="addImage()"
      >
        <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <UIcon name="ant-design:picture-filled" class="text-lg" />
        </div>
        <span class="text-xs text-gray-600 dark:text-gray-300">换图</span>
      </button>

      <button
        class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[64px]"
        @click="saveData()"
      >
        <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
          <UIcon name="ant-design:save-filled" class="text-lg" />
        </div>
        <span class="text-xs text-gray-600 dark:text-gray-300">保存</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.checkerboard-bg {
  background-image: 
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: white;
}

/* 深色模式下的棋盘格 */
:global(.dark) .checkerboard-bg {
  background-image: 
    linear-gradient(45deg, #374151 25%, transparent 25%), 
    linear-gradient(-45deg, #374151 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #374151 75%), 
    linear-gradient(-45deg, transparent 75%, #374151 75%);
  background-color: #1f2937;
}

.canvas-wrapper {
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
}

canvas {
  max-width: 100%;
  max-height: 60vh; /* 限制画布最大显示高度 */
  height: auto;
  object-fit: contain;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
