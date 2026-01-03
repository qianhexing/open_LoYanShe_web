<template>
  <div class="ar-container relative w-full h-full overflow-hidden bg-black">
    <!-- 1. 隐藏的 Video 元素，用于 MindAR 分析 -->
    <video ref="videoRef" autoplay muted playsinline webkit-playsinline
      class="hidden-video absolute top-0 left-0 w-full h-full object-cover z-0"></video>
      
    <!-- 2. Three.js Canvas 容器 -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"></div>

    <!-- 3. UI 层：提示与控制 -->
    <div class="ui-overlay absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
      <!-- 加载/提示信息 -->
      <div v-if="loading || !isScanning" class="absolute bg-black/60 px-4 py-2 rounded text-white backdrop-blur-sm">
        {{ loadingText }}
      </div>

      <!-- 错误信息 -->
      <div v-if="errorMsg" class="absolute top-20 bg-red-600/80 px-4 py-2 rounded text-white">
        {{ errorMsg }}
      </div>
      
      <!-- 扫描框 (可选，如果只是加载特定场景可能不需要，但为了对准方便保留) -->
      <div v-if="!isTracking && isScanning && !loading"
        class="scan-box w-64 h-64 border-2 border-white/50 rounded-lg animate-pulse relative">
        <div class="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white"></div>
        <div class="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white"></div>
        <div class="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white"></div>
        <div class="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white"></div>
        <div class="text-white text-center mt-64 pt-4 text-sm font-bold shadow-black drop-shadow-md">请将摄像头对准识别图</div>
      </div>
    </div>

    <!-- 4. 操作按钮 -->
    <div class="absolute bottom-8 left-0 w-full flex flex-col items-center justify-center z-30 pointer-events-auto gap-4">
      <div v-if="isTracking" class="text-green-400 font-bold drop-shadow-md">
        识别成功 (Scene: {{ currentSceneId }})
      </div>
      
      <button @click="startAR"
        class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full shadow-lg transition-all"
        v-if="!isScanning">
        开始 AR 体验 (场景 ID: 1)
      </button>
      
      <button @click="resetScan" class="bg-gray-600/80 hover:bg-gray-700/80 text-white px-4 py-2 rounded-full text-sm"
        v-if="isScanning">
        停止 / 重置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import { getSceneId } from '@/api/scene';
import { getARConfig } from '@/utils/ar/config';

definePageMeta({
  layout: false
});

// 状态
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasContainer = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const loadingText = ref('点击开始加载场景...');
const isScanning = ref(false);
const isTracking = ref(false);
const errorMsg = ref('');
const currentSceneId = ref<number>(1); // 固定加载 ID = 1

// 核心实例
let threeCore: ThreeCore | null = null;
let mindController: any = null;
let requestAnimationFrameId: number;
let arAnchorGroup: THREE.Group | null = null;
let MindARController: any = null;

onMounted(async () => {
  // 动态导入 MindAR
  try {
    const mod = await import('mind-ar/src/image-target/controller')
    MindARController = mod.Controller
  } catch (e) {
    console.warn('MindAR 依赖加载失败');
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
  threeCore = new ThreeCore({
    enableAR: true,
    alpha: true,
    antialias: true,
    pixelRatio: window.devicePixelRatio,
    enableOrbitControls: false,
  });

  threeCore.mount(canvasContainer.value);
  threeCore.renderer.setClearColor(0x000000, 0);

  // AR 内容组
  arAnchorGroup = new THREE.Group();
  arAnchorGroup.visible = false;
  arAnchorGroup.matrixAutoUpdate = false;

  threeCore.scene.add(arAnchorGroup);
  threeCore.arContentGroup = arAnchorGroup;

  threeCore.startAnimationLoop();
};

// 2. 开始 AR 流程 (直接加载 Scene 1)
const startAR = async () => {
  if (!videoRef.value || !MindARController) {
    errorMsg.value = !MindARController ? 'AR 引擎未就绪' : '无法获取 Video 元素';
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
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    videoRef.value.srcObject = stream;

    // 等待视频元数据
    await new Promise((resolve) => {
      videoRef.value!.onloadedmetadata = () => {
        videoRef.value!.play();
        resolve(true);
      };
    });

    // 2.2 加载场景数据 (ID = 1)
    loadingText.value = '加载 3D 场景数据 (ID: 1)...';
    const targetSceneId = 1;
    currentSceneId.value = targetSceneId;

    const arConfig = getARConfig(targetSceneId);
    if (!arConfig) throw new Error('未找到该场景的 AR 配置');

    // 获取 Scene JSON
    const sceneData = await getSceneId({ sence_id: targetSceneId });
    
    // 2.3 加载 3D 内容
    if (sceneData && sceneData.json_data) {
      if (threeCore && threeCore.arContentGroup) {
        threeCore.clearGroup(threeCore.arContentGroup);
      }
      await threeCore?.loadSceneFromJSON(sceneData.json_data);
      console.log('场景内容加载完毕');
    } else {
      // Fallback
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshNormalMaterial();
      const cube = new THREE.Mesh(geometry, material);
      threeCore?.arContentGroup?.add(cube);
    }

    // 2.4 初始化 MindAR
    loadingText.value = '初始化 AR 引擎...';
    await initMindAR(arConfig.mindUrl, videoRef.value);

    loading.value = false;
    loadingText.value = '';

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

// 辅助函数：下载并检查 mind 文件
async function checkMindBinary(url: string, loadingTextRef: Ref<string>) {
  // 复用之前的逻辑，简化处理
  loadingTextRef.value = '正在下载识别图...'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = await res.arrayBuffer()
  if (buffer.byteLength === 0) throw new Error('文件为空')
  return buffer
}

// 3. 初始化 MindAR 控制器
const initMindAR = async (mindUrl: string, video: HTMLVideoElement) => {
  loadingText.value = '准备 MindAR...';
  await waitVideoReady(video);

  mindController = new MindARController({
    inputWidth: video.videoWidth,
    inputHeight: video.videoHeight,
    onUpdate: (event: any) => {
      if (event.type === 'processDone') {
         // Frame done
      } else if (event.type === 'updateMatrix' && event.worldMatrix) {
        // 识别成功
        if (!isTracking.value) {
          isTracking.value = true;
          if (arAnchorGroup) arAnchorGroup.visible = true;
          loadingText.value = 'Target found!';
        }
        // 同步位姿
        if (arAnchorGroup) {
          arAnchorGroup.matrix.fromArray(event.worldMatrix);
        }
      } else if (event.type === 'updateMatrix' && event.worldMatrix === null) {
        // 丢失追踪
        // 可以选择隐藏或保持最后位置
      }
    }
  });

  // 加载识别图
  loadingText.value = '加载识别图...';
  // 注意：MindAR Controller 支持 URL 或 buffer。为了稳妥可以用 buffer。
  // 这里直接用 URL 尝试，如果不行可以用 checkMindBinary
  // await mindController.addImageTargets(mindUrl);
  // 为了跟之前保持一致，使用 buffer 下载方式更稳健
  const buffer = await checkMindBinary(mindUrl, loadingText);
  await mindController.addImageTargetsFromBuffer(buffer);

  loadingText.value = 'AR 引擎预热...';
  await mindController.dummyRun(video);

  // 启动循环
  mindController.processVideo(videoRef.value);
};

const resetScan = () => {
  stopAR();
  isScanning.value = false;
  isTracking.value = false;
  loading.value = false;
  errorMsg.value = '';
  loadingText.value = '点击开始加载场景...';
};

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
  mindController = null;
};
</script>

<style scoped>
.hidden-video {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
}
.scan-box {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}
</style>