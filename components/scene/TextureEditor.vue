<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
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

// 交互状态
let dragging = false
let lastX = 0
let lastY = 0
let lastDist = 0
let lastAngle = 0

// 渲染循环控制
let isDirty = false
let animationFrameId = 0

const showModel = () => {
  show.value = true
  // 确保显示时重新生成 Mask 并绘制
  if (props.target) {
    nextTick(() => {
      setupTexture()
    })
  }
}
const closeModel = () => {
  show.value = false
  emit('close')
}

// 生成基于 UV 的 Mask
const generateMaskFromUV = (mesh: THREE.Mesh) => {
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

  if (indexAttribute) {
    for (let i = 0; i < indexAttribute.count; i += 3) {
      drawTriangle(
        indexAttribute.getX(i),
        indexAttribute.getX(i + 1),
        indexAttribute.getX(i + 2)
      )
    }
  } else {
    for (let i = 0; i < uvAttribute.count; i += 3) {
      drawTriangle(i, i + 1, i + 2)
    }
  }
  
  maskCtx.fill()
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
  if (image.complete && image.src) {
    // 如果没有 Mask，直接绘制；如果有 Mask，已经在上面设置了 source-in
    if (!maskDrawn) {
       ctx.save() // 为了保持 restore 的一致性
    }

    ctx.translate(canvas.value.width / 2 + offsetX, canvas.value.height / 2 + offsetY)
    ctx.rotate(rotation)
    ctx.scale(scale, scale)

    // 保持原图比例
    const imgAspect = image.width / image.height
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
  } else {
    // 如果没有图片但有 Mask，记得 restore
    if (maskDrawn) ctx.restore()
  }

  // 3. 更新 Texture
  if (texture) texture.needsUpdate = true
}

function loop() {
  if (isDirty) {
    draw()
    isDirty = false
  }
  animationFrameId = requestAnimationFrame(loop)
}

function setupTexture() {
  if (!props.target || !canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return

  // 设置 Canvas 尺寸
  canvas.value.width = 512
  canvas.value.height = 512

  // 生成 UV Mask
  hasMask = generateMaskFromUV(props.target as THREE.Mesh)
  
  // 初始化 Texture
  if (!texture) {
    texture = new THREE.CanvasTexture(canvas.value)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.flipY = false
  } else {
    // 如果 texture 已经存在（比如重新打开），确保它使用当前的 canvas
    // 通常不需要重新 new，除非 canvas 元素变了
    // 这里保持引用一致
  }
  
  texture.needsUpdate = true
  
  const mat = (props.target as THREE.Mesh).material as THREE.MeshStandardMaterial
  // 只有当 map 不存在或者不是当前 texture 时才赋值，避免不必要的副作用
  if (mat.map !== texture) {
    mat.map = texture
    mat.transparent = true
    mat.needsUpdate = true
  }

  // 触发一次绘制
  isDirty = true
  draw()
}

onMounted(() => {
  // 启动渲染循环
  loop()

  if (!canvas.value) return
  
  if (props.target) {
    const parent = findTopmostParent(props.target)
    // 恢复之前的编辑状态
    if (parent.userData.material && parent.userData.material[props.target.name]) {
      const options = parent.userData.material[props.target.name]
      offsetX = options.offsetX
      offsetY = options.offsetY
      scale = options.scale
      rotation= options.rotation
      if (options.url) {
        image.src = BASE_IMG + options.url
      } else {
        // Fallback
        image.src = props.imageUrl
      }
      image.onload = () => { isDirty = true }
      
    } else {
      image.src = props.imageUrl
      image.onload = () => { isDirty = true }
    }
  }
  
  if (props.maskUrl) {
    mask.src = props.maskUrl
    mask.onload = () => { isDirty = true }
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
    isDirty = true // 标记为脏，下一帧绘制
  })
  window.addEventListener('mouseup', () => (dragging = false))

  // 触摸缩放 + 旋转
  canvas.value.addEventListener('touchstart', e => {
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
  }, { passive: false })

  canvas.value.addEventListener('touchmove', e => {
    e.preventDefault() // 防止滚动
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
    isDirty = true
  }, { passive: false })
  
  canvas.value.addEventListener('wheel', e => {
    e.preventDefault()
    const zoomSpeed = 0.001 // 越大缩放越快
    scale += e.deltaY * -zoomSpeed
    scale = Math.max(0.1, Math.min(5, scale)) // 限制缩放范围 0.1~5
    isDirty = true
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
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
  // 提示保存成功 (可选)
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  uploadImage(file[0])
    .then(async (res) => {
      console.log('上传返回', res)
      image.src = BASE_IMG + res.file_url
      image.onload = () => {
        // 重置位置? 或者保持位置? 这里保持位置
        isDirty = true
        setupTexture() // 重新确保 texture 设置
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
  <div class="w-full fixed transition-all duration-300 bottom-0 left-0 z-30 h-[500px] md:h-full md:w-[500px]  bg-qhx-bg"
    :class="show ? '' : 'bottom-[-500px] md:bottom-[0px] md:left-[-500px]'">
    <div class="fun-head h-[60px] border-b flex">
      <div class="flex flex-1">
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="saveData()">
              <UIcon name="ant-design:file-filled" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">保存</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="addImage()">
              <UIcon name="ant-design:picture-filled" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">选择图片</div>
          </div>
        </QhxJellyButton>
      </div>
      <QhxJellyButton>
        <div class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
          @click="closeModel()">
          <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
        </div>
      </QhxJellyButton>
    </div>
    <div class="w-full flex justify-center p-4">
      <!-- 增加透明背景格子样式，方便查看透明区域 -->
      <canvas ref="canvas" class="border rounded-lg touch-none shadow-md" style="background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; background-color: white;"></canvas>
    </div>
    <div class="p-4 text-center text-sm text-gray-500">
       双指旋转缩放，单指拖拽
    </div>
  </div>
</template>

<style scoped>
canvas {
  max-width: 100%;
  height: auto;
  /* 背景样式已移至 inline style 以支持 checkerboard */
}
</style>