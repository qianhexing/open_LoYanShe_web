# ThreeCore 光影调试系统

一个为 ThreeCore 设计的实时光影调试 GUI 系统，让你能够直观地调整和优化 Three.js 场景的光影效果。

## ✨ 功能特性

- 🌟 **实时光源控制** - 环境光、主方向光、镜头光强度和位置调节
- 🎭 **阴影质量设置** - 四级阴影质量选择（低/中/高/超高）
- 🎨 **色调映射** - 曝光度和多种色调映射算法
- 🌄 **环境贴图** - HDR/EXR 环境贴图加载和强度控制
- ✨ **后处理效果** - Bloom 辉光效果的强度、半径、阈值调节
- 🎯 **预设方案** - 多种内置预设（工作室、戏剧性、柔和、电影感等）
- 💾 **设置管理** - 导入/导出光影配置，自定义预设保存

## 🚀 快速开始

### 1. 访问调试页面

启动项目后，访问：
```
http://localhost:3000/lighting-debug
```

### 2. 基本集成

在你的 Vue 组件中使用：

```vue
<template>
  <div class="scene-container" ref="container"></div>
  
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
    editMode: true,     // 显示光源辅助线
    enableStats: true   // 显示性能统计
  })
  
  threeCore.value.mount(container.value)
  threeCore.value.startAnimationLoop()
})

const onSettingsChanged = (settings) => {
  console.log('光影设置更新:', settings)
}
</script>
```

### 3. 添加发光物体

```javascript
// 让物体发光
threeCore.addBloomObject(mesh)

// 移除发光效果
threeCore.removeBloomObject(mesh)
```

## 🎛️ 控制面板说明

### 基础光源
- **环境光强度**: 场景基础照明 (0-2)
- **主光源强度**: 主要方向光 (0-3)
- **主光源位置**: XYZ 轴位置控制
- **镜头光强度**: 跟随相机的补光 (0-2)

### 阴影设置
- **低**: 1024x1024 - 移动设备推荐
- **中**: 2048x2048 - 平衡性能
- **高**: 4096x4096 - 推荐设置
- **超高**: 8192x8192 - 最高质量

### 色调映射
- **曝光度**: 场景整体亮度 (0.1-3.0)
- **映射类型**: 无/线性/Reinhard/电影/ACES电影

### 环境贴图
- **预设环境**: 工作室/户外/夕阳/夜晚
- **自定义 HDR**: 支持 .hdr 和 .exr 格式
- **环境强度**: 环境光贡献度 (0-3)

### 后处理效果
- **辉光强度**: 发光物体亮度增强 (0-3)
- **辉光半径**: 光晕扩散范围 (0-1)
- **辉光阈值**: 发光物体亮度阈值 (0-2)

## 🎨 预设方案

| 预设 | 适用场景 | 特点 |
|------|----------|------|
| 默认 | 通用展示 | 平衡的光影效果 |
| 工作室 | 产品展示 | 均匀柔和的照明 |
| 戏剧性 | 艺术展示 | 强对比度光影 |
| 柔和 | 温馨场景 | 柔和的光线氛围 |
| 电影感 | 视频制作 | 电影级光影质感 |

## 📁 文件结构

```
├── components/
│   └── LightingDebugGUI.vue     # 光影调试GUI组件
├── pages/
│   └── lighting-debug.vue       # 调试页面示例
├── utils/
│   └── threeCore.ts             # ThreeCore核心类（已扩展光影API）
├── public/
│   └── hdr/                     # HDR环境贴图存放目录
│       └── README.md            # HDR文件说明
└── docs/
    └── lighting-debug-guide.md  # 详细使用指南
```

## 🔧 API 参考

### ThreeCore 光影方法

```typescript
// 基础光源
threeCore.setAmbientLightIntensity(intensity: number)
threeCore.setMainLightIntensity(intensity: number, position?: Vector3)
threeCore.setLensLightIntensity(intensity: number)

// 阴影和渲染
threeCore.setShadowQuality('low' | 'medium' | 'high' | 'ultra')
threeCore.setToneMapping(exposure: number, toneMapping?: number)

// 环境贴图
threeCore.loadHDREnvironment(url: string, intensity: number)
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

## 💡 使用技巧

### 基础调试流程
1. 从默认预设开始
2. 调整主光源位置和强度
3. 设置合适的环境光
4. 选择环境贴图
5. 调整阴影质量
6. 微调色调映射参数
7. 添加 Bloom 效果（可选）

### 性能优化
- 移动设备使用"中"或"低"阴影质量
- 大型场景避免过高的环境贴图强度
- Bloom 效果会影响性能，适度使用

### 环境贴图
- 将 HDR/EXR 文件放在 `public/hdr/` 目录
- 推荐分辨率：2048x1024 或 4096x2048
- 免费资源：[Poly Haven](https://polyhaven.com/hdris)

## 🐛 故障排除

**GUI 不显示**: 检查是否传入了有效的 ThreeCore 实例
**设置不生效**: 确认 ThreeCore 正确初始化并挂载
**环境贴图加载失败**: 检查文件路径和格式
**性能问题**: 降低阴影质量和 Bloom 参数

## 📚 更多信息

详细使用指南请查看：[lighting-debug-guide.md](./docs/lighting-debug-guide.md)

## 🎯 示例场景

调试页面提供了多种测试模型：
- 球体（金属感材质）
- 立方体（漫反射材质）
- 扭结几何体（高反射材质）

可以添加不同材质的物体来测试各种光影效果。