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
  texture = new THREE.CanvasTexture(canvas.value)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  texture.flipY = false
  const mat = (props.target as THREE.Mesh).material as THREE.MeshStandardMaterial
  mat.map = texture
  mat.transparent = true
  mat.needsUpdate = true

  draw()
}

onMounted(() => {
  if (!canvas.value) return
  canvas.value.width = 512
  canvas.value.height = 512
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
      image.onload = draw
      
    } else {
      image.src = props.imageUrl
      image.onload = draw
    }
  }
  
  if (props.maskUrl) {
    mask.src = props.maskUrl
    mask.onload = draw
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
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  uploadImage(file[0])
    .then(async (res) => {
      console.log('上传返回', res)
      image.src = BASE_IMG + res.file_url
      image.onload = () => {
        setupTexture()
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
    <div class="w-full flex justify-center">
      <canvas ref="canvas" class="border rounded-lg touch-none"></canvas>
    </div>
  </div>
</template>

<style scoped>
canvas {
  max-width: 100%;
  height: auto;
  background: #eee;
}
</style>
