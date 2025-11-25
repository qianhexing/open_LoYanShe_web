<template>
  <div class="lighting-debug-page">
    <div class="scene-container" ref="sceneContainer">
      <!-- Three.js 场景将挂载到这里 -->
    </div>
    
    <!-- 光影调试GUI -->
    <LightingDebugGUI 
      v-if="threeCore" 
      :three-core="threeCore"
      @settings-changed="onLightingSettingsChanged"
    />
    
    <!-- 信息面板 -->
    <div class="info-panel">
      <h3>光影系统调试</h3>
      <p>使用右侧的控制面板来实时调试场景的光影效果。</p>
      <div class="current-settings" v-if="currentSettings">
        <h4>当前设置:</h4>
        <pre>{{ JSON.stringify(currentSettings, null, 2) }}</pre>
      </div>
    </div>
    
    <!-- 模型加载控制 -->
    <div class="model-controls">
      <button @click="addTestModel" :disabled="!threeCore">添加测试模型</button>
      <button @click="addTestSphere" :disabled="!threeCore">添加测试球体</button>
      <button @click="addTestCube" :disabled="!threeCore">添加测试立方体</button>
      <button @click="clearScene" :disabled="!threeCore">清空场景</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ThreeCore from '~/utils/threeCore'
import LightingDebugGUI from '~/components/LightingDebugGUI.vue'
import * as THREE from 'three'

// 响应式数据
const sceneContainer = ref(null)
const threeCore = ref(null)
const currentSettings = ref(null)

// 页面元数据
useHead({
  title: '光影系统调试 - ThreeCore',
  meta: [
    {
      name: 'description',
      content: '实时调试Three.js场景的光影效果，包括光源、阴影、色调映射和后处理效果。'
    }
  ]
})

// 初始化Three.js场景
const initThreeScene = () => {
  if (!sceneContainer.value) return
  
  // 创建ThreeCore实例
  threeCore.value = new ThreeCore({
    antialias: true,
    alpha: false,
    clearColor: 0x222222,
    cameraType: 'perspective',
    cameraPosition: { x: 5, y: 5, z: 5 },
    enableOrbitControls: true,
    enableStats: true,
    editMode: true // 启用编辑模式以显示光源helpers
  })
  
  // 挂载到容器
  threeCore.value.mount(sceneContainer.value)
  
  // 启动动画循环
  threeCore.value.startAnimationLoop()
  
  // 添加一些初始模型用于测试光影
  addTestSphere()
  addTestCube()
  
  console.log('ThreeCore initialized for lighting debug')
}

// 光影设置变化回调
const onLightingSettingsChanged = (settings) => {
  currentSettings.value = settings
  console.log('Lighting settings changed:', settings)
}

// 添加测试模型
const addTestModel = async () => {
  if (!threeCore.value) return
  
  try {
    // 这里可以加载一个测试模型，暂时创建一个复杂的几何体
    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16)
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xff6b6b,
      metalness: 0.7,
      roughness: 0.2
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(
      (Math.random() - 0.5) * 8,
      Math.random() * 3,
      (Math.random() - 0.5) * 8
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    
    threeCore.value.scene.add(mesh)
    threeCore.value.allObjects.push(mesh)
    
    console.log('Added test torus knot model')
  } catch (error) {
    console.error('Failed to add test model:', error)
  }
}

// 添加测试球体
const addTestSphere = () => {
  if (!threeCore.value) return
  
  const geometry = new THREE.SphereGeometry(1, 32, 32)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x4ecdc4,
    metalness: 0.3,
    roughness: 0.4
  })
  const sphere = new THREE.Mesh(geometry, material)
  sphere.position.set(
    (Math.random() - 0.5) * 6,
    Math.random() * 2 + 1,
    (Math.random() - 0.5) * 6
  )
  sphere.castShadow = true
  sphere.receiveShadow = true
  
  threeCore.value.scene.add(sphere)
  threeCore.value.allObjects.push(sphere)
  
  console.log('Added test sphere')
}

// 添加测试立方体
const addTestCube = () => {
  if (!threeCore.value) return
  
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0xffe66d,
    metalness: 0.1,
    roughness: 0.8
  })
  const cube = new THREE.Mesh(geometry, material)
  cube.position.set(
    (Math.random() - 0.5) * 6,
    Math.random() * 2 + 0.5,
    (Math.random() - 0.5) * 6
  )
  cube.castShadow = true
  cube.receiveShadow = true
  
  threeCore.value.scene.add(cube)
  threeCore.value.allObjects.push(cube)
  
  console.log('Added test cube')
}

// 清空场景（保留光源和摄像机）
const clearScene = () => {
  if (!threeCore.value) return
  
  const objectsToRemove = [...threeCore.value.allObjects]
  objectsToRemove.forEach(obj => {
    threeCore.value.scene.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(mat => mat.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
  
  threeCore.value.allObjects = []
  console.log('Scene cleared')
}

// 组件挂载
onMounted(() => {
  setTimeout(() => {
    initThreeScene()
  }, 100) // 稍微延迟确保DOM准备好
})

// 组件卸载
onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose()
  }
})
</script>

<style scoped>
.lighting-debug-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #1a1a1a;
  overflow: hidden;
}

.scene-container {
  width: 100%;
  height: 100%;
}

.info-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  max-width: 300px;
  max-height: 200px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.info-panel h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #4CAF50;
}

.info-panel p {
  margin: 0 0 10px 0;
  font-size: 12px;
  color: #ccc;
  line-height: 1.4;
}

.current-settings {
  margin-top: 10px;
}

.current-settings h4 {
  margin: 0 0 5px 0;
  font-size: 12px;
  color: #FFC107;
}

.current-settings pre {
  font-size: 10px;
  color: #aaa;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px;
  border-radius: 4px;
  max-height: 100px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.model-controls {
  position: fixed;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
}

.model-controls button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 10px 15px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.model-controls button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.model-controls button:disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

/* 滚动条样式 */
.info-panel::-webkit-scrollbar,
.current-settings pre::-webkit-scrollbar {
  width: 4px;
}

.info-panel::-webkit-scrollbar-track,
.current-settings pre::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.info-panel::-webkit-scrollbar-thumb,
.current-settings pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.info-panel::-webkit-scrollbar-thumb:hover,
.current-settings pre::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .info-panel {
    bottom: 10px;
    left: 10px;
    right: 10px;
    max-width: none;
  }
  
  .model-controls {
    top: 10px;
    left: 10px;
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .model-controls button {
    flex: 1;
    min-width: 80px;
    padding: 8px 10px;
    font-size: 11px;
  }
}
</style>