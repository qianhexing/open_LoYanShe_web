# ThreeCore 光影调试系统使用指南

## 概述

ThreeCore 光影调试系统提供了一个直观的 GUI 界面，用于实时调试和优化 Three.js 场景的光影效果。该系统包含以下主要功能：

- 基础光源控制（环境光、主方向光、镜头光）
- 阴影质量设置
- 色调映射参数调整
- 环境贴图（HDR/EXR）管理
- 后处理效果（辉光/Bloom）
- 预设方案和设置导入导出

## 快速开始

### 1. 基本集成

```vue
<template>
  <div class="scene-container" ref="container">
    <!-- ThreeCore 场景容器 -->
  </div>
  
  <!-- 光影调试 GUI -->
  <LightingDebugGUI 
    v-if="threeCore" 
    :three-core="threeCore"
    @settings-changed="onSettingsChanged"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ThreeCore from '~/utils/threeCore'
import LightingDebugGUI from '~/components/LightingDebugGUI.vue'

const container = ref(null)
const threeCore = ref(null)

onMounted(() => {
  threeCore.value = new ThreeCore({
    editMode: true, // 启用编辑模式显示光源辅助
    enableStats: true
  })
  
  threeCore.value.mount(container.value)
  threeCore.value.startAnimationLoop()
})

const onSettingsChanged = (settings) => {
  console.log('光影设置已更新:', settings)
}
</script>
```

### 2. 访问调试页面

访问 `/lighting-debug` 页面查看完整的调试界面示例。

## 功能详解

### 基础光源控制

#### 环境光 (Ambient Light)
- **作用**: 提供场景的基础照明，避免完全黑暗的区域
- **调节范围**: 0-2
- **建议值**: 0.2-0.4（室内），0.1-0.3（户外）

#### 主方向光 (Directional Light)
- **作用**: 模拟太阳光，提供主要照明和阴影
- **强度范围**: 0-3
- **位置调节**: X、Y、Z 轴独立控制
- **建议设置**: 
  - 室内: 强度 1.0-1.5, 位置 (30, 60, 40)
  - 户外: 强度 2.0-2.5, 位置 (50, 80, 30)

#### 镜头光 (Lens Light)
- **作用**: 跟随相机移动的补光，增强物体细节
- **调节范围**: 0-2
- **建议值**: 0.5-1.0

### 阴影设置

提供四个质量级别：

- **低 (Low)**: 1024x1024 阴影贴图，适合移动设备
- **中 (Medium)**: 2048x2048 阴影贴图，平衡性能和质量
- **高 (High)**: 4096x4096 阴影贴图，推荐设置
- **超高 (Ultra)**: 8192x8192 阴影贴图，最高质量

### 色调映射

#### 曝光度 (Exposure)
- **作用**: 控制场景整体亮度
- **调节范围**: 0.1-3.0
- **建议值**: 0.8-1.5

#### 色调映射类型
- **无**: 不进行色调映射
- **线性**: 简单线性映射
- **Reinhard**: 经典的 Reinhard 算法
- **电影**: 电影级色调映射
- **ACES电影**: 业界标准，推荐使用

### 环境贴图

#### 预设环境
- **工作室**: 均匀的工作室照明
- **户外**: 自然光环境
- **夕阳**: 温暖的夕阳色调
- **夜晚**: 夜间城市环境

#### 自定义 HDR/EXR
支持加载自定义的高动态范围环境贴图：
- **HDR 格式**: .hdr 文件
- **EXR 格式**: .exr 文件

### 后处理效果

#### 辉光效果 (Bloom)
- **辉光强度**: 控制发光物体的亮度增强 (0-3)
- **辉光半径**: 控制光晕扩散范围 (0-1)
- **辉光阈值**: 控制多亮的物体开始发光 (0-2)

要让物体发光，需要调用：
```javascript
threeCore.addBloomObject(mesh) // 添加辉光
threeCore.removeBloomObject(mesh) // 移除辉光
```

## 预设方案

### 内置预设

1. **默认**: 平衡的通用设置
2. **工作室**: 适合产品展示的均匀照明
3. **戏剧性**: 强对比度的戏剧化光影
4. **柔和**: 柔和的光影效果
5. **电影感**: 电影级的光影质感

### 自定义预设

- **保存当前设置**: 将当前参数保存为新预设
- **导出设置**: 导出为 JSON 文件
- **导入设置**: 从 JSON 文件导入设置

## API 参考

### ThreeCore 光影方法

```typescript
// 基础光源控制
threeCore.setAmbientLightIntensity(intensity: number)
threeCore.setMainLightIntensity(intensity: number, position?: Vector3)
threeCore.setLensLightIntensity(intensity: number)

// 阴影设置
threeCore.setShadowQuality(quality: 'low' | 'medium' | 'high' | 'ultra')

// 色调映射
threeCore.setToneMapping(exposure: number, toneMapping?: ToneMapping)

// 环境贴图
threeCore.loadHDREnvironment(url: string, intensity: number)
threeCore.loadEXREnvironment(url: string, intensity: number)
threeCore.setEnvironmentIntensity(intensity: number)
threeCore.removeEnvironmentMap()

// Bloom 效果
threeCore.setBloomParams(strength: number, radius: number, threshold: number)
threeCore.toggleBloom(enabled: boolean)
threeCore.addBloomObject(object: Object3D)
threeCore.removeBloomObject(object: Object3D)

// 信息获取
threeCore.getLightingInfo()
threeCore.getBloomParams()
```

## 性能优化建议

1. **阴影质量**: 移动设备使用 'medium' 或 'low'
2. **环境贴图**: 大文件会影响加载速度，建议压缩
3. **Bloom 效果**: 高强度的 Bloom 会影响性能
4. **光源数量**: 避免过多的实时光源

## 故障排除

### 常见问题

1. **GUI 不显示**: 确保传入了有效的 ThreeCore 实例
2. **设置不生效**: 检查 ThreeCore 是否正确初始化
3. **环境贴图加载失败**: 检查文件路径和格式
4. **性能问题**: 降低阴影质量和 Bloom 参数

### 调试技巧

1. 启用 `editMode: true` 查看光源辅助线
2. 启用 `enableStats: true` 监控性能
3. 查看浏览器控制台的错误信息
4. 使用预设方案作为起点进行调整

## 扩展开发

### 添加自定义预设

```javascript
const customPreset = {
  ambientIntensity: 0.3,
  directionalIntensity: 1.5,
  // ... 其他参数
}

// 在 LightingDebugGUI 组件中添加
presets.custom = customPreset
```

### 自定义环境贴图

将 HDR/EXR 文件放在 `public/hdr/` 目录下，然后在 `environmentPresets` 中添加引用。

### 集成到项目

该光影调试系统设计为独立模块，可以轻松集成到任何使用 ThreeCore 的项目中。只需导入 `LightingDebugGUI` 组件并传入 ThreeCore 实例即可。