# HDR 环境贴图文件夹

这个文件夹用于存放高动态范围 (HDR) 环境贴图文件。

## 支持的文件格式

- **HDR**: Radiance HDR 格式 (.hdr)
- **EXR**: OpenEXR 格式 (.exr)

## 推荐的环境贴图资源

### 免费资源
- [Poly Haven](https://polyhaven.com/hdris) - 高质量免费 HDR 环境贴图
- [HDRLabs](http://www.hdrlabs.com/sibl/archive.html) - 免费 HDR 集合
- [NoEmotion HDRs](http://noemotionhdrs.net/) - 免费 HDR 环境贴图

### 商业资源  
- [HDR Haven](https://hdrihaven.com/) - 专业级 HDR 贴图
- [CGBookcase](https://www.cgbookcase.com/textures/hdri) - 商业 HDRI 资源

## 文件命名建议

- `studio.hdr` - 工作室环境
- `outdoor.hdr` - 户外环境
- `sunset.hdr` - 夕阳环境
- `night.hdr` - 夜晚环境

## 性能建议

- 推荐分辨率: 2048x1024 或 4096x2048
- 文件大小: 尽量控制在 10MB 以下
- 压缩: 可以使用工具压缩 HDR 文件以减小加载时间

## 使用方法

将 HDR/EXR 文件复制到此文件夹后，在光影调试 GUI 中选择对应的预设环境，或者使用自定义文件上传功能。