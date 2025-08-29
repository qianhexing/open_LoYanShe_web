<template>
  <div class="lighting-debug-gui">
    <!-- GUI面板 -->
    <div class="gui-panel" :class="{ collapsed: isCollapsed }">
      <div class="gui-header" @click="toggleCollapse">
        <h3>光影调试控制台</h3>
        <button class="collapse-btn">{{ isCollapsed ? '展开' : '收起' }}</button>
      </div>
      
      <div class="gui-content" v-show="!isCollapsed">
        <!-- 基础光源控制 -->
        <div class="control-section">
          <h4>基础光源</h4>
          
          <!-- 环境光强度 -->
          <div class="control-group">
            <label>环境光强度</label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              v-model="lightingParams.ambientIntensity"
              @input="updateAmbientLight"
            />
            <span>{{ lightingParams.ambientIntensity }}</span>
          </div>
          
          <!-- 主方向光强度 -->
          <div class="control-group">
            <label>主光源强度</label>
            <input 
              type="range" 
              min="0" 
              max="3" 
              step="0.1" 
              v-model="lightingParams.directionalIntensity"
              @input="updateDirectionalLight"
            />
            <span>{{ lightingParams.directionalIntensity }}</span>
          </div>
          
          <!-- 主方向光位置 -->
          <div class="control-group">
            <label>主光源位置</label>
            <div class="vector-controls">
              <div class="axis-control">
                <label>X</label>
                <input 
                  type="range" 
                  min="-100" 
                  max="100" 
                  step="5" 
                  v-model="lightingParams.directionalPosition.x"
                  @input="updateDirectionalLightPosition"
                />
                <span>{{ lightingParams.directionalPosition.x }}</span>
              </div>
              <div class="axis-control">
                <label>Y</label>
                <input 
                  type="range" 
                  min="-100" 
                  max="100" 
                  step="5" 
                  v-model="lightingParams.directionalPosition.y"
                  @input="updateDirectionalLightPosition"
                />
                <span>{{ lightingParams.directionalPosition.y }}</span>
              </div>
              <div class="axis-control">
                <label>Z</label>
                <input 
                  type="range" 
                  min="-100" 
                  max="100" 
                  step="5" 
                  v-model="lightingParams.directionalPosition.z"
                  @input="updateDirectionalLightPosition"
                />
                <span>{{ lightingParams.directionalPosition.z }}</span>
              </div>
            </div>
          </div>
          
          <!-- 镜头光强度 -->
          <div class="control-group">
            <label>镜头光强度</label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              v-model="lightingParams.lensLightIntensity"
              @input="updateLensLight"
            />
            <span>{{ lightingParams.lensLightIntensity }}</span>
          </div>
        </div>
        
        <!-- 阴影控制 -->
        <div class="control-section">
          <h4>阴影设置</h4>
          
          <div class="control-group">
            <label>阴影质量</label>
            <select v-model="lightingParams.shadowQuality" @change="updateShadowQuality">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="ultra">超高</option>
            </select>
          </div>
        </div>
        
        <!-- 色调映射 -->
        <div class="control-section">
          <h4>色调映射</h4>
          
          <div class="control-group">
            <label>曝光度</label>
            <input 
              type="range" 
              min="0.1" 
              max="3" 
              step="0.1" 
              v-model="lightingParams.exposure"
              @input="updateToneMapping"
            />
            <span>{{ lightingParams.exposure }}</span>
          </div>
          
          <div class="control-group">
            <label>色调映射类型</label>
            <select v-model="lightingParams.toneMapping" @change="updateToneMapping">
              <option value="0">无</option>
              <option value="1">线性</option>
              <option value="2">Reinhard</option>
              <option value="3">电影</option>
              <option value="4">ACES电影</option>
            </select>
          </div>
        </div>
        
        <!-- 环境贴图 -->
        <div class="control-section">
          <h4>环境贴图</h4>
          
          <div class="control-group">
            <label>环境光强度</label>
            <input 
              type="range" 
              min="0" 
              max="3" 
              step="0.1" 
              v-model="lightingParams.envMapIntensity"
              @input="updateEnvironmentIntensity"
            />
            <span>{{ lightingParams.envMapIntensity }}</span>
          </div>
          
          <div class="control-group">
            <label>预设环境</label>
            <select v-model="selectedEnvironment" @change="loadPresetEnvironment">
              <option value="">无环境贴图</option>
              <option value="studio">工作室</option>
              <option value="outdoor">户外</option>
              <option value="sunset">夕阳</option>
              <option value="night">夜晚</option>
            </select>
          </div>
          
          <div class="control-group">
            <label>自定义HDR</label>
            <input 
              type="file" 
              accept=".hdr,.exr" 
              @change="loadCustomEnvironment"
              ref="envFileInput"
            />
          </div>
        </div>
        
        <!-- 后处理效果 -->
        <div class="control-section">
          <h4>后处理效果</h4>
          
          <div class="control-group">
            <label>辉光效果</label>
            <input 
              type="checkbox" 
              v-model="lightingParams.bloomEnabled"
              @change="toggleBloom"
            />
          </div>
          
          <div class="control-group" v-if="lightingParams.bloomEnabled">
            <label>辉光强度</label>
            <input 
              type="range" 
              min="0" 
              max="3" 
              step="0.1" 
              v-model="lightingParams.bloomStrength"
              @input="updateBloomParams"
            />
            <span>{{ lightingParams.bloomStrength }}</span>
          </div>
          
          <div class="control-group" v-if="lightingParams.bloomEnabled">
            <label>辉光半径</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              v-model="lightingParams.bloomRadius"
              @input="updateBloomParams"
            />
            <span>{{ lightingParams.bloomRadius }}</span>
          </div>
          
          <div class="control-group" v-if="lightingParams.bloomEnabled">
            <label>辉光阈值</label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.01" 
              v-model="lightingParams.bloomThreshold"
              @input="updateBloomParams"
            />
            <span>{{ lightingParams.bloomThreshold }}</span>
          </div>
        </div>
        
        <!-- 预设方案 -->
        <div class="control-section">
          <h4>预设方案</h4>
          
          <div class="preset-buttons">
            <button @click="applyPreset('default')">默认</button>
            <button @click="applyPreset('studio')">工作室</button>
            <button @click="applyPreset('dramatic')">戏剧性</button>
            <button @click="applyPreset('soft')">柔和</button>
            <button @click="applyPreset('cinematic')">电影感</button>
          </div>
          
          <div class="preset-actions">
            <button @click="saveCurrentAsPreset">保存当前设置</button>
            <button @click="resetToDefault">重置为默认</button>
            <button @click="exportSettings">导出设置</button>
            <input 
              type="file" 
              accept=".json" 
              @change="importSettings"
              ref="settingsFileInput"
              style="display: none"
            />
            <button @click="$refs.settingsFileInput.click()">导入设置</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 快速切换按钮 -->
    <div class="quick-toggle" v-if="isCollapsed">
      <button @click="toggleCollapse" class="toggle-btn">🎨</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, nextTick } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  threeCore: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['settings-changed'])

// GUI状态
const isCollapsed = ref(false)
const selectedEnvironment = ref('')
const envFileInput = ref(null)
const settingsFileInput = ref(null)

// 光影参数
const lightingParams = reactive({
  // 基础光源
  ambientIntensity: 0.3,
  directionalIntensity: 1.5,
  directionalPosition: { x: 50, y: 50, z: 30 },
  lensLightIntensity: 0.8,
  
  // 阴影
  shadowQuality: 'high',
  
  // 色调映射
  exposure: 1.0,
  toneMapping: 4, // ACES电影
  
  // 环境贴图
  envMapIntensity: 1.0,
  
  // 后处理
  bloomEnabled: true,
  bloomStrength: 0.5,
  bloomRadius: 0.04,
  bloomThreshold: 0.85
})

// 预设方案
const presets = {
  default: {
    ambientIntensity: 0.3,
    directionalIntensity: 1.5,
    directionalPosition: { x: 50, y: 50, z: 30 },
    lensLightIntensity: 0.8,
    shadowQuality: 'high',
    exposure: 1.0,
    toneMapping: 4,
    envMapIntensity: 1.0,
    bloomEnabled: true,
    bloomStrength: 0.5,
    bloomRadius: 0.04,
    bloomThreshold: 0.85
  },
  studio: {
    ambientIntensity: 0.4,
    directionalIntensity: 1.2,
    directionalPosition: { x: 30, y: 60, z: 40 },
    lensLightIntensity: 1.0,
    shadowQuality: 'ultra',
    exposure: 1.2,
    toneMapping: 1,
    envMapIntensity: 0.8,
    bloomEnabled: false,
    bloomStrength: 0.3,
    bloomRadius: 0.02,
    bloomThreshold: 1.0
  },
  dramatic: {
    ambientIntensity: 0.1,
    directionalIntensity: 2.5,
    directionalPosition: { x: 80, y: 30, z: 20 },
    lensLightIntensity: 0.3,
    shadowQuality: 'high',
    exposure: 0.8,
    toneMapping: 3,
    envMapIntensity: 0.5,
    bloomEnabled: true,
    bloomStrength: 1.0,
    bloomRadius: 0.08,
    bloomThreshold: 0.6
  },
  soft: {
    ambientIntensity: 0.6,
    directionalIntensity: 0.8,
    directionalPosition: { x: 20, y: 80, z: 50 },
    lensLightIntensity: 1.2,
    shadowQuality: 'medium',
    exposure: 1.3,
    toneMapping: 2,
    envMapIntensity: 1.5,
    bloomEnabled: true,
    bloomStrength: 0.3,
    bloomRadius: 0.06,
    bloomThreshold: 1.2
  },
  cinematic: {
    ambientIntensity: 0.2,
    directionalIntensity: 2.0,
    directionalPosition: { x: 70, y: 40, z: 60 },
    lensLightIntensity: 0.6,
    shadowQuality: 'ultra',
    exposure: 1.1,
    toneMapping: 4,
    envMapIntensity: 1.2,
    bloomEnabled: true,
    bloomStrength: 0.7,
    bloomRadius: 0.05,
    bloomThreshold: 0.9
  }
}

// 环境贴图预设
const environmentPresets = {
  studio: '/hdr/studio.hdr',
  outdoor: '/hdr/outdoor.hdr', 
  sunset: '/hdr/sunset.hdr',
  night: '/hdr/night.hdr'
}

// 方法实现
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const updateAmbientLight = () => {
  if (props.threeCore) {
    props.threeCore.setAmbientLightIntensity(lightingParams.ambientIntensity)
    emitSettingsChanged()
  }
}

const updateDirectionalLight = () => {
  if (props.threeCore) {
    props.threeCore.setMainLightIntensity(lightingParams.directionalIntensity)
    emitSettingsChanged()
  }
}

const updateDirectionalLightPosition = () => {
  if (props.threeCore) {
    const position = new THREE.Vector3(
      lightingParams.directionalPosition.x,
      lightingParams.directionalPosition.y,
      lightingParams.directionalPosition.z
    )
    props.threeCore.setMainLightIntensity(lightingParams.directionalIntensity, position)
    emitSettingsChanged()
  }
}

const updateLensLight = () => {
  if (props.threeCore) {
    props.threeCore.setLensLightIntensity(lightingParams.lensLightIntensity)
    emitSettingsChanged()
  }
}

const updateShadowQuality = () => {
  if (props.threeCore) {
    props.threeCore.setShadowQuality(lightingParams.shadowQuality)
    emitSettingsChanged()
  }
}

const updateToneMapping = () => {
  if (props.threeCore) {
    props.threeCore.setToneMapping(lightingParams.exposure, lightingParams.toneMapping)
    emitSettingsChanged()
  }
}

const updateEnvironmentIntensity = () => {
  if (props.threeCore) {
    props.threeCore.setEnvironmentIntensity(lightingParams.envMapIntensity)
    emitSettingsChanged()
  }
}

const loadPresetEnvironment = async () => {
  if (!props.threeCore || !selectedEnvironment.value) {
    if (props.threeCore) {
      props.threeCore.removeEnvironmentMap()
    }
    return
  }
  
  try {
    const envPath = environmentPresets[selectedEnvironment.value]
    if (envPath) {
      await props.threeCore.loadHDREnvironment(envPath, lightingParams.envMapIntensity)
      console.log(`已加载环境贴图: ${selectedEnvironment.value}`)
    }
  } catch (error) {
    console.warn(`预设环境贴图 ${selectedEnvironment.value} 不存在:`, error)
    console.log('提示：请将对应的 HDR 文件放在 public/hdr/ 目录下')
    
    // 创建一个简单的程序化环境作为后备
    const envType = selectedEnvironment.value
    selectedEnvironment.value = ''
    createProceduralEnvironment(envType)
  }
}

// 创建程序化环境贴图作为后备方案
const createProceduralEnvironment = (type) => {
  if (!props.threeCore) return
  
  // 创建一个简单的渐变天空盒
  const scene = props.threeCore.scene
  
  let topColor, bottomColor
  switch (type) {
    case 'studio':
      topColor = new THREE.Color(0xffffff)
      bottomColor = new THREE.Color(0xcccccc)
      break
    case 'outdoor':
      topColor = new THREE.Color(0x87CEEB)
      bottomColor = new THREE.Color(0x98FB98)
      break
    case 'sunset':
      topColor = new THREE.Color(0xFF6B47)
      bottomColor = new THREE.Color(0xFFE066)
      break
    case 'night':
      topColor = new THREE.Color(0x191970)
      bottomColor = new THREE.Color(0x000000)
      break
    default:
      return
  }
  
  // 创建渐变背景
  const geometry = new THREE.SphereGeometry(500, 32, 32)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: topColor },
      bottomColor: { value: bottomColor }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide
  })
  
  const skybox = new THREE.Mesh(geometry, material)
  skybox.userData.isProceduralSky = true
  
  // 移除之前的程序化天空
  scene.children.forEach(child => {
    if (child.userData.isProceduralSky) {
      scene.remove(child)
    }
  })
  
  scene.add(skybox)
  console.log(`已创建程序化 ${type} 环境`)
}

const loadCustomEnvironment = async (event) => {
  const file = event.target.files[0]
  if (!file || !props.threeCore) return
  
  try {
    const url = URL.createObjectURL(file)
    if (file.name.toLowerCase().endsWith('.hdr')) {
      await props.threeCore.loadHDREnvironment(url, lightingParams.envMapIntensity)
    } else if (file.name.toLowerCase().endsWith('.exr')) {
      await props.threeCore.loadEXREnvironment(url, lightingParams.envMapIntensity)
    }
    selectedEnvironment.value = ''
    console.log('已加载自定义环境贴图')
  } catch (error) {
    console.error('加载自定义环境贴图失败:', error)
  }
}

const toggleBloom = () => {
  if (props.threeCore) {
    props.threeCore.toggleBloom(lightingParams.bloomEnabled)
    emitSettingsChanged()
  }
}

const updateBloomParams = () => {
  if (props.threeCore) {
    props.threeCore.setBloomParams(
      lightingParams.bloomStrength,
      lightingParams.bloomRadius,
      lightingParams.bloomThreshold
    )
    emitSettingsChanged()
  }
}

const applyPreset = (presetName) => {
  if (presets[presetName]) {
    Object.assign(lightingParams, presets[presetName])
    // 应用所有设置
    nextTick(() => {
      updateAmbientLight()
      updateDirectionalLight()
      updateDirectionalLightPosition()
      updateLensLight()
      updateShadowQuality()
      updateToneMapping()
      updateEnvironmentIntensity()
      toggleBloom()
      updateBloomParams()
    })
    console.log(`已应用预设: ${presetName}`)
  }
}

const saveCurrentAsPreset = () => {
  const presetName = prompt('请输入预设名称:')
  if (presetName) {
    presets[presetName] = { ...lightingParams }
    localStorage.setItem('lightingPresets', JSON.stringify(presets))
    console.log(`已保存预设: ${presetName}`)
  }
}

const resetToDefault = () => {
  applyPreset('default')
}

const exportSettings = () => {
  const settings = {
    lighting: lightingParams,
    timestamp: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lighting-settings-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importSettings = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result)
      if (settings.lighting) {
        Object.assign(lightingParams, settings.lighting)
        nextTick(() => {
          updateAmbientLight()
          updateDirectionalLight()
          updateDirectionalLightPosition()
          updateLensLight()
          updateShadowQuality()
          updateToneMapping()
          updateEnvironmentIntensity()
          toggleBloom()
          updateBloomParams()
        })
        console.log('已导入光影设置')
      }
    } catch (error) {
      console.error('导入设置失败:', error)
      alert('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
}

const emitSettingsChanged = () => {
  emit('settings-changed', { ...lightingParams })
}

// 初始化
onMounted(() => {
  // 加载保存的预设
  const savedPresets = localStorage.getItem('lightingPresets')
  if (savedPresets) {
    try {
      Object.assign(presets, JSON.parse(savedPresets))
    } catch (error) {
      console.error('加载保存的预设失败:', error)
    }
  }
  
  // 应用默认设置
  nextTick(() => {
    applyPreset('default')
  })
})
</script>

<style scoped>
.lighting-debug-gui {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.gui-panel {
  background: rgba(0, 0, 0, 0.9);
  border-radius: 8px;
  color: white;
  min-width: 300px;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.gui-panel.collapsed {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

.gui-header {
  padding: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.gui-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.collapse-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.gui-content {
  padding: 15px;
}

.control-section {
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 15px;
}

.control-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.control-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 500;
  color: #4CAF50;
}

.control-group {
  margin-bottom: 12px;
}

.control-group label {
  display: block;
  font-size: 12px;
  margin-bottom: 5px;
  color: #ccc;
}

.control-group input[type="range"] {
  width: 100%;
  margin: 5px 0;
}

.control-group input[type="checkbox"] {
  margin-right: 8px;
}

.control-group select {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 6px;
  border-radius: 4px;
  font-size: 12px;
}

.control-group span {
  font-size: 11px;
  color: #888;
  margin-left: 8px;
}

.vector-controls {
  display: flex;
  gap: 10px;
}

.axis-control {
  flex: 1;
}

.axis-control label {
  font-size: 10px;
  text-align: center;
  margin-bottom: 2px;
}

.axis-control input {
  margin: 0;
}

.axis-control span {
  font-size: 10px;
  text-align: center;
  display: block;
  margin: 2px 0 0 0;
}

.preset-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.preset-buttons button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.preset-buttons button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.preset-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-actions button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s;
}

.preset-actions button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.quick-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
}

.toggle-btn {
  background: rgba(0, 0, 0, 0.8);
  border: none;
  color: white;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

/* 滚动条样式 */
.gui-panel::-webkit-scrollbar {
  width: 6px;
}

.gui-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.gui-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.gui-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .lighting-debug-gui {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .gui-panel {
    min-width: auto;
    max-width: none;
  }
  
  .vector-controls {
    flex-direction: column;
    gap: 5px;
  }
  
  .preset-buttons {
    grid-template-columns: 1fr;
  }
  
  .preset-actions {
    grid-template-columns: 1fr;
  }
}
</style>