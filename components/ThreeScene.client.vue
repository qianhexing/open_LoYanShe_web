<template>
  <div ref="container" class="three-scene-container" id="webgl">
    <slot></slot>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, provide } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  backgroundColor: { type: [String, Number], default: 0x000000 },
  pixelRatio: { type: Number, default: null },
  antialias: { type: Boolean, default: true },
  autoStart: { type: Boolean, default: true },
  cameraOptions: {
    type: Object,
    default: () => ({
      fov: 75,
      near: 0.1,
      far: 1000,
      position: { x: 0, y: 0, z: 5 }
    })
  }
})

const emit = defineEmits(['init', 'before-render', 'after-render', 'resize'])

const container = ref(null)
let scene, camera, renderer, animationId

// 提供给子组件使用
// provide('threeScene', {
//   getScene: () => scene,
//   getCamera: () => camera,
//   getRenderer: () => renderer,
//   addToScene: (object) => scene.add(object),
//   removeFromScene: (object) => scene.remove(object)
// })

// 初始化场景
const initScene = () => {
  // 确保容器已存在且有宽度
  if (!container.value || container.value.clientWidth === 0) {
    console.error('Container not ready or has zero width')
    return
  }
  
  // 场景
  scene = new THREE.Scene()
  if (props.backgroundColor instanceof THREE.Color || typeof props.backgroundColor === 'number') {
    scene.background = new THREE.Color(props.backgroundColor)
  }
  
  // 相机
  camera = new THREE.PerspectiveCamera(
    props.cameraOptions.fov,
    container.value.clientWidth / container.value.clientHeight,
    props.cameraOptions.near,
    props.cameraOptions.far
  )
  camera.position.set(
    props.cameraOptions.position.x,
    props.cameraOptions.position.y,
    props.cameraOptions.position.z
  )
  
  // 渲染器
  renderer = new THREE.WebGLRenderer({ 
    antialias: props.antialias,
    alpha: typeof props.backgroundColor === 'string' && props.backgroundColor === 'transparent'
  })
  
  const pixelRatio = props.pixelRatio || Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  container.value.appendChild(renderer.domElement)
  
  emit('init', { scene, camera, renderer })
  
  if (props.autoStart) {
    startAnimation()
  }
}

// 动画循环
const startAnimation = () => {
  if (animationId) return
  
  const clock = new THREE.Clock()
  let previousTime = 0
  
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime
    
    emit('before-render', { elapsedTime, deltaTime })
    renderer.render(scene, camera)
    emit('after-render', { elapsedTime, deltaTime })
  }
  
  animate()
}

const stopAnimation = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (!renderer || !camera) return
  
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  emit('resize', { width: container.value.clientWidth, height: container.value.clientHeight })
}

onMounted(() => {
  setTimeout(() => {
  console.log(document.getElementById('webgl'), '获取页面元素')
    initScene()
  });
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopAnimation()
  window.removeEventListener('resize', handleResize)
  
  if (renderer) {
    renderer.dispose()
    if (renderer.domElement && container.value) {
      container.value.removeChild(renderer.domElement)
    }
  }
  
  // 清理场景
  if (scene) {
    while(scene.children.length > 0) {
      const object = scene.children[0]
      if (object.dispose) object.dispose()
      scene.remove(object)
    }
  }
})

// // 暴露方法给父组件
// defineExpose({
//   startAnimation,
//   stopAnimation,
//   getScene: () => scene,
//   getCamera: () => camera,
//   getRenderer: () => renderer
// })
</script>

<style scoped>
.three-scene-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.three-scene-container canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>