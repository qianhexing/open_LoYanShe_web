<template>
  <div class="ar-container relative w-full h-full overflow-hidden bg-black">
    <!-- 1. 隐藏的 Video 元素，用于 MindAR 分析 -->
    <!-- MindAR 需要视频元素存在，但我们可以把它隐藏或放到底层，
         然而 MindAR 默认会把视频作为背景绘制。
         为了完全控制，我们让 MindAR 处理视频，但我们自己管理 Canvas。
         MindAR 的 Controller 模式允许我们只获取位姿，不强制接管渲染。
    -->
    <video ref="videoRef" autoplay muted playsinline webkit-playsinline
      class="hidden-video absolute top-0 left-0 w-full h-full object-cover z-0"></video>
      
    <!-- 为了看到摄像头画面，我们需要让 video 显示出来，或者由 MindAR 绘制到 canvas 上。
         通常 MindAR (ImageTracking) 示例是将 video 作为背景。
         这里我们将 video 设为 absolute top-0 left-0，z-index 0。
         ThreeJS Canvas z-index 10。
         注意：video opacity 0 是为了如果不想要原生 video 显示（比如想做滤镜），
         但 AR 通常需要显示现实世界。所以这里 opacity 应该为 1。
    -->

    <!-- 2. Three.js Canvas 容器 -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"></div>

    <!-- 3. UI 层：扫描框与提示 -->
    <div class="ui-overlay absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
      <div v-if="!isTracking && isScanning"
        class="scan-box w-64 h-64 border-2 border-white/50 rounded-lg animate-pulse relative">
        <div class="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white"></div>
        <div class="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white"></div>
        <div class="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white"></div>
        <div class="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white"></div>
        <div class="text-white text-center mt-64 pt-4 text-sm font-bold shadow-black drop-shadow-md">请将摄像头对准识别图</div>
      </div>

      <div class="absolute bg-black/60 px-4 py-2 rounded text-white backdrop-blur-sm">
        {{ loadingText }}
      </div>

      <div v-if="errorMsg" class="absolute bg-red-600/80 px-4 py-2 rounded text-white">
        {{ errorMsg }}
      </div>
    </div>

    <!-- 4. 调试/操作按钮 -->
    <div
      class="absolute bottom-8 left-0 w-full flex flex-col items-center justify-center z-30 pointer-events-auto gap-4">
      <div v-if="isTracking" class="text-green-400 font-bold drop-shadow-md">
        识别成功 (Scene: {{ currentSceneId }})
      </div>
      <button @click="startScan"
        class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full shadow-lg transition-all"
        v-if="!isScanning">
        开始 AR 体验
      </button>
      <button @click="resetScan" class="bg-gray-600/80 hover:bg-gray-700/80 text-white px-4 py-2 rounded-full text-sm"
        v-if="isScanning">
        重置 / 停止
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick, type Ref } from 'vue';
import * as THREE from 'three';
// 使用 import type 避免构建时报错，实际引入在 mounted 中动态进行
import type { Controller } from 'mind-ar/src/image-target/controller';
import ThreeCore from '@/utils/threeCore';
import { getSceneId } from '@/api/scene';
import { recognizeImage } from '@/api/recognition';
import { getARConfig } from '@/utils/ar/config';

// 状态
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasContainer = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const loadingText = ref('初始化中...');
const isScanning = ref(false);
const isTracking = ref(false);
const errorMsg = ref('');
const currentSceneId = ref<number>(0);

// 核心实例
let threeCore: ThreeCore | null = null;
let mindController: any = null; // Controller
let requestAnimationFrameId: number;

// AR 锚点组 (核心：所有 AR 内容都放在这里)
let arAnchorGroup: THREE.Group | null = null;

// 为了解决 MindAR import 问题 (它可能没有很好的 ESM 支持或依赖 window)
let MindARController: any = null;

onMounted(async () => {
  // 动态导入 MindAR，确保只在客户端运行
  try {
    const mod = await import('mind-ar/src/image-target/controller')
  MindARController = mod.Controller
  } catch (e) {
    console.warn('本地 mind-ar 依赖未找到，尝试 CDN 或检查 npm install');
    // 如果本地没有，这里可以 fallback 到 window.MINDAR (如果 index.html 引入了 script)
    // 但按照要求我们假设 npm install 已完成
    errorMsg.value = 'MindAR 库加载失败，请检查依赖';
  }
});

onBeforeUnmount(() => {
  stopAR();
});

// 1. 初始化 ThreeCore
const initThree = async () => {
  if (!canvasContainer.value || threeCore) return;

  console.log('初始化 ThreeCore...');

  // 关键配置：开启 AR 模式标记(用于内部判断)，背景透明
  threeCore = new ThreeCore({
    enableAR: true,
    alpha: true,
    antialias: true,
    pixelRatio: window.devicePixelRatio,
    // 禁用默认的 OrbitControls，因为我们要自己控制相机或由 MindAR 控制视角
    // MindAR Controller 模式下，通常相机固定，物体移动；或者物体固定，相机移动。
    // MindAR 默认输出的是物体相对于相机的变换矩阵 (ModelViewMatrix 的一部分)。
    // 这里我们将相机固定在 (0,0,0)，并将变换应用到 arAnchorGroup 上。
    enableOrbitControls: false,
  });

  // 挂载 Canvas
  threeCore.mount(canvasContainer.value);

  // 确保背景透明
  threeCore.renderer.setClearColor(0x000000, 0);

  // 手动创建 AR 内容组
  arAnchorGroup = new THREE.Group();
  arAnchorGroup.visible = false;
  // 关键：我们需要手动更新矩阵，而不是由 position/rotation/scale 计算
  arAnchorGroup.matrixAutoUpdate = false;

  // 注入到 threeCore
  threeCore.scene.add(arAnchorGroup);
  threeCore.arContentGroup = arAnchorGroup; // 让 loadSceneFromJSON 能用到

  // 设置相机
  // MindAR 推荐的相机参数需要匹配视频流的 FOV。
  // 初始化时先给个默认值，MindAR start 后会给出一个推荐的投影矩阵，我们需要应用它。
  // 但 Controller 模式下，我们通常自己管理相机。
  // 为了简单，我们稍后在 MindAR ready 时更新相机投影矩阵。

  // 启动渲染循环
  threeCore.startAnimationLoop();
};

// 2. 开始流程
const startScan = async () => {
  if (!videoRef.value || !MindARController) {
    if (!MindARController) errorMsg.value = 'AR 引擎未就绪';
    return;
  }

  isScanning.value = true;
  loading.value = true;
  loadingText.value = '启动摄像头...';
  errorMsg.value = '';

  try {
    await initThree();

    // 2.1 启动摄像头
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 }, // 越高越清晰，但也越耗性能
        height: { ideal: 720 }
      }
    });

    videoRef.value.srcObject = stream;

    // 等待视频元数据加载，以便获取真实宽高
    await new Promise((resolve) => {
      videoRef.value!.onloadedmetadata = () => {
        videoRef.value!.play();
        // 让 video 元素实际显示视频流 (opacity 1)
        // videoRef.value!.style.opacity = '1';
        resolve(true);
      };
    });

    loadingText.value = '正在识别场景...';

    // 2.2 模拟识图
    // 截取一帧
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.value.videoWidth;
    canvas.height = videoRef.value.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.value, 0, 0);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));

    if (!blob) throw new Error('截屏失败');

    const res = await recognizeImage(blob);
    console.log('识别成功, SceneID:', res.scene_id);
    currentSceneId.value = res.scene_id;

    // 2.3 获取配置与场景数据
    const arConfig = getARConfig(res.scene_id);
    if (!arConfig) throw new Error('未找到该场景的 AR 配置');

    loadingText.value = '加载 3D 场景...';

    // 调用现有 API 获取场景 JSON
    // 注意：这里的 getSceneId 是 api/scene.ts 里的方法
    const sceneData = await getSceneId({ sence_id: res.scene_id });

    // 2.4 加载 3D 内容
    if (sceneData && sceneData.json_data) {
      // 先清空之前的
      if (threeCore && threeCore.arContentGroup) {
        threeCore.clearGroup(threeCore.arContentGroup);
      }

      await threeCore?.loadSceneFromJSON(sceneData.json_data);
      console.log('场景内容加载完毕');
    } else {
      // 如果没有数据，加个测试方块
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshNormalMaterial();
      const cube = new THREE.Mesh(geometry, material);
      threeCore?.arContentGroup?.add(cube);
    }

    loadingText.value = '初始化 AR 引擎...';
    const toast = useToast()
    // 2.5 初始化 MindAR
    try {
      await initMindAR(arConfig.mindUrl, videoRef.value);
      toast.add({
        title: 'MindAR 成功',
        description: 'MindAR 初始化成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } catch (error: any) {
      toast.add({
        title: 'MindAR 初始化失败',
        description: error.message || '无法初始化 MindAR',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }

    loading.value = false;

  } catch (error: any) {
    console.error('AR 流程启动失败', error);
    errorMsg.value = error.message || '无法启动 AR';
    loading.value = false;
    isScanning.value = false;
  }
};
const waitVideoReady = (video: HTMLVideoElement) => {
  return new Promise<void>((resolve) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      resolve()
    } else {
      video.onloadedmetadata = () => resolve()
    }
  })
}
async function checkMindBinary(url: string, loadingTextRef: Ref<string>) {
  try {
    loadingTextRef.value = '步骤 3/5: 正在请求识别图文件...'
    console.log('[checkMindBinary] 开始请求:', url)
    
    // 创建带超时的 fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
    
    loadingTextRef.value = '步骤 3/5: 正在下载识别图数据...'
    
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Accept': 'application/octet-stream, */*'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    console.log('[checkMindBinary] status:', res.status)
    console.log('[checkMindBinary] content-type:', res.headers.get('content-type'))
    console.log('[checkMindBinary] content-encoding:', res.headers.get('content-encoding'))
    console.log('[checkMindBinary] content-length:', res.headers.get('content-length'))

    loadingTextRef.value = '步骤 3/5: 正在解析二进制数据...'
    
    const buffer = await res.arrayBuffer()

    console.log('[checkMindBinary] byteLength:', buffer.byteLength)

    if (buffer.byteLength === 0) {
      throw new Error('下载的文件为空')
    }

    // 打印前 16 个字节（用于判断是否被 gzip / text 污染）
    const head = new Uint8Array(buffer.slice(0, 16))
    console.log('[checkMindBinary] head bytes:', [...head])
    
    // 检查是否是 HTML 错误页面（通常以 <!DOCTYPE 或 <html 开头）
    const textDecoder = new TextDecoder()
    const firstChars = textDecoder.decode(buffer.slice(0, 100))
    if (firstChars.trim().toLowerCase().startsWith('<!doctype') || 
        firstChars.trim().toLowerCase().startsWith('<html')) {
      throw new Error('服务器返回了 HTML 页面，可能是文件不存在或路径错误')
    }

    loadingTextRef.value = '步骤 3/5: 识别图数据加载完成'
    console.log('[checkMindBinary] 文件加载成功，大小:', buffer.byteLength, 'bytes')

    return buffer
  } catch (error: any) {
    if (error.name === 'AbortError') {
      loadingTextRef.value = '步骤 3/5: 请求超时，请检查网络连接'
      throw new Error('请求超时（30秒）')
    }
    console.error('[checkMindBinary] 错误:', error)
    loadingTextRef.value = `步骤 3/5: 加载失败 - ${error.message || '未知错误'}`
    throw error
  }
}
function arrayBufferToBlobURL(buffer: ArrayBuffer) {
  const blob = new Blob([buffer], {
    type: 'application/octet-stream'
  });
  return URL.createObjectURL(blob);
}
// 3. 初始化 MindAR 控制器
const initMindAR = async (mindUrl: string, video: HTMLVideoElement) => {
  try {
    // 步骤1: 等待视频准备就绪
    console.log('[步骤1/5] 等待 video ready...')
    loadingText.value = '步骤 1/5: 等待视频准备就绪...'
    
    await waitVideoReady(video)

    console.log(
      '[步骤1完成] video ready:',
      video.videoWidth,
      video.videoHeight
    )
    loadingText.value = `步骤 1/5: 视频准备就绪 ${video.videoWidth}x${video.videoHeight}`
    // 步骤2: 创建 MindAR Controller
    console.log('[步骤2/5] 创建 MindAR Controller...')
    loadingText.value = `步骤 2/5: 创建 MindAR Controller (${video.videoWidth}x${video.videoHeight})...`

    mindController = new MindARController({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      // filterMinCF: 0.001,
      // filterBeta: 1000,
      debugMode: false,
      maxTrack: 1,
      onUpdate: (event: any) => {
        if (event.type === 'updateMatrix' && event.worldMatrix) {
          // === 核心：识别成功 ===
          if (!isTracking.value) {
            isTracking.value = true;
            if (arAnchorGroup) {
              arAnchorGroup.visible = true;
            }
            console.log('Target found!');
            loadingText.value = '目标已锁定!';
          }

          // === 核心：同步位姿 ===
          if (arAnchorGroup) {
            // 直接设置矩阵
            arAnchorGroup.matrix.fromArray(event.worldMatrix);
          }
        } else if (event.type === 'updateMatrix' && event.worldMatrix === null) {
          // 丢失追踪
          if (isTracking.value) {
             // 选择 2: 保持在最后位置 (通常体验更好)
             loadingText.value = '目标丢失，保持最后位置';
          } else {
             loadingText.value = '正在扫描...';
          }
        }
      }
    })

    console.log('[步骤2完成] MindAR Controller created')

    // 步骤3: 加载识别图
    console.log('[步骤3/5] 加载识别图...')
    loadingText.value = '步骤 3/5: 准备加载识别图...'

    try {
      const buffer = await checkMindBinary(mindUrl, loadingText)
      // console.log('[步骤3完成] 识别图加载完毕')
      // loadingText.value = '步骤 3/5: 正在添加识别图到 AR 引擎...'
      // const blobURL = arrayBufferToBlobURL(buffer)
      loadingText.value = '步骤 3/5: 正在添加识别图到 AR 引擎...buffer:' + buffer.byteLength
      await mindController.addImageTargetsFromBuffer(buffer)
      console.log('[步骤3完成] 识别图已添加到 AR 引擎')
    } catch (error: any) {
      console.error('[加载识别图失败]', error)
      loadingText.value = `步骤 3/5 失败: ${error.message || '未知错误'}`
      throw error
    }

    // 步骤4: 执行 dummyRun 预热
    console.log('[步骤4/5] 执行 dummyRun 预热...')
    loadingText.value = '步骤 4/5: 执行 AR 引擎预热...'

    await mindController.dummyRun(video)
    console.log('[步骤4完成] dummyRun 完成')

    // 步骤5: 启动处理循环
    console.log('[步骤5/5] 启动处理循环...')
    loadingText.value = '步骤 5/5: 启动 AR 处理循环...'
    
    // 启动处理循环，mindController.processVideo 内部会开启 loop
    mindController.processVideo(videoRef.value);
    
    console.log('[全部完成] MindAR 初始化成功')
    loadingText.value = 'MindAR 初始化成功，已就绪'
  } catch (error: any) {
    const errorStep = error.message || '未知步骤'
    console.error('[MindAR 初始化失败]', error)
    loadingText.value = `初始化失败: ${errorStep}`
    throw error
  }
}
// processLoop removed as it is handled by onUpdate in MindARController
const resetScan = () => {
//   console.log('初始化 MindAR Controller...');

//   mindController = new MindARController({
//     inputWidth: video.videoWidth,
//     inputHeight: video.videoHeight,
//     // 可以在这里调整 filter 参数来减少抖动
//     filterMinCF: 0.001, // 默认 0.001
//     filterBeta: 1000,   // 默认 1000
//     onUpdate: (data: any) => {
//       // console.log('MindAR update', data);
//     }
//   });

//   // 加载图像识别数据
//   // addImageTargets 返回 { dimensions: [] }
//   await mindController.addImageTargets(mindUrl);
//   console.log('识别图加载完毕');

//   // 模拟 Dummy run 来预热 (MindAR 建议)
//   await mindController.dummyRun(video);

//   // 启动处理循环
//   const processLoop = () => {
//     if (!mindController || !isScanning.value) return;

//     // 关键：处理一帧视频
//     const { type, data } = mindController.processVideo(video);

//     if (type === 'updateMatrix') {
//       const targetIndex = 0; 
//       if (data && data.length > targetIndex && data[targetIndex].worldMatrix) {
//         // === 核心：识别成功 ===
//         if (!isTracking.value) {
//            isTracking.value = true;
//            if(arAnchorGroup) arAnchorGroup.visible = true;
//            console.log('Target found!');
//         }

//         // === 核心：同步位姿 ===
//         // MindAR 返回的是 Column-major 数组
//         // data[targetIndex].worldMatrix 是一个 16 元素的数组

//         if (arAnchorGroup) {
//           // 直接设置矩阵
//           arAnchorGroup.matrix.fromArray(data[targetIndex].worldMatrix);

//           // 如果需要处理坐标系差异，可能需要再乘一个修正矩阵
//           // MindAR 的坐标系通常是：Z 垂直于图像向外，X 向右，Y 向上 (右手系)
//           // Three.js 也是右手系。通常不需要额外转换。
//         }
//       } else {
//         // 丢失追踪
//         if (isTracking.value) {
//             // 选择 1: 立即隐藏
//             // if(arAnchorGroup) arAnchorGroup.visible = false;
//             // isTracking.value = false;

//             // 选择 2: 保持在最后位置 (通常体验更好)
//             // 只有连续丢失很久才隐藏
//         }
//       }
//     }

//     requestAnimationFrameId = requestAnimationFrame(processLoop);
//   };

//   // 更新相机参数
//   // MindAR Controller 计算出的 worldMatrix 是基于特定 FOV 的
//   // 我们需要把 Three.js 的相机 FOV 设置得跟 MindAR 内部估算的一致
//   // 或者，更好的方式是：使用 MindAR 提供的 Projection Matrix
//   // 但 Controller 模式好像不直接提供 getProjectionMatrix (它在 A-Frame wrapper 里有)
//   // 我们可以估算一个：MindAR 默认假设 fov 约为 2 * atan((height/2)/focalLength)
//   // 简单做法：保持 Three.js 默认相机，MindAR 也能工作，但物体贴合度可能稍有偏差
//   // 高级做法：mindController.getProjectionMatrix() (如果源码支持)

//   // 查阅 MindAR 源码，Controller 内部确实维护了 projection matrix
//   // 但这里作为通用方案，我们先用默认相机。
//   // 注意：如果物体看起来“滑”动，说明 FOV 不匹配。

//   processLoop();
// };

const resetScan = () => {
  stopAR();
  isScanning.value = false;
  isTracking.value = false;
  loading.value = false;
  errorMsg.value = '';
  if (videoRef.value) {
    // videoRef.value.style.opacity = '0';
  }
}

const stopAR = () => {
  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = (videoRef.value.srcObject as MediaStream).getTracks();
    tracks.forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }

  if (threeCore) {
    threeCore.dispose();
    threeCore = null;
  }

  if (requestAnimationFrameId) {
    cancelAnimationFrame(requestAnimationFrameId);
  }

  mindController = null;
};
</script>

<style scoped>
/* 确保视频全屏且不变形 */
.hidden-video {
  /* AR 背景必须铺满 */
  width: 100vw;
  height: 100vh;
  object-fit: cover;
}

.scan-box {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}
</style>
