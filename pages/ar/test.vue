<template>
  <ClientOnly>
    <div style="height: 100vh; width: 100vw; position: relative; overflow: hidden;">
      <a-scene 
        mindar-image="imageTargetSrc: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind;" 
        color-space="sRGB" 
        renderer="colorManagement: true, physicallyCorrectLights" 
        vr-mode-ui="enabled: false" 
        device-orientation-permission-ui="enabled: false"
        embedded
        style="width: 100%; height: 100%;"
      >
        <a-assets>
          <img id="card" src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png" />
          <a-asset-item id="avatarModel" src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf"></a-asset-item>
        </a-assets>

        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        
        <a-entity mindar-image-target="targetIndex: 0">
          <a-plane src="#card" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
          <a-gltf-model rotation="0 0 0 " position="0 0 0.1" scale="0.005 0.005 0.005" src="#avatarModel" animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"></a-gltf-model>
          
          <!-- 挂载点：用于挂载自定义 Three.js 场景 -->
          <a-entity id="my-three-scene"></a-entity>
        </a-entity>
      </a-scene>
      
      <!-- 提示信息 -->
      <div class="absolute top-4 left-0 w-full text-center text-white z-50 pointer-events-none">
        <div class="bg-black/50 inline-block px-4 py-2 rounded">
          请扫描示例图片 (MindAR Card)
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup>
import { onMounted } from 'vue';
import { getSceneId } from '@/api/scene';
import { BASE_IMG } from '@/utils/ipConfig.ts';

definePageMeta({
  layout: false
});

useHead({
  script: [
    {
      src: 'https://aframe.io/releases/1.6.0/aframe.min.js',
      crossorigin: 'anonymous'
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js',
      crossorigin: 'anonymous'
    }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no' }
  ]
})

onMounted(() => {
  // 等待 A-Frame 加载
  const checkAFrame = setInterval(() => {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl && sceneEl.hasLoaded) {
      clearInterval(checkAFrame);
      loadMyScene(sceneEl);
    } else if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        clearInterval(checkAFrame);
        loadMyScene(sceneEl);
      }, { once: true });
    }
  }, 100);
  
  // 超时清除
  setTimeout(() => clearInterval(checkAFrame), 10000);
});

async function loadMyScene(sceneEl) {
  // 获取 A-Frame 的 THREE 实例（全局）
  // 注意：MindAR 和 A-Frame 会在 window 上挂载 THREE
  const THREE = window.THREE; 
  if (!THREE) {
    console.error('THREE not found on window');
    return;
  }

  const container = document.querySelector('#my-three-scene');
  if (!container) return;
  
  console.log('Fetching scene data for ID: 1 ...');
  
  try {
    // 1. 获取 Scene ID = 1 的数据
    const res = await getSceneId({ sence_id: 1 });
    if (!res || !res.json_data) {
      console.warn('No json_data found for scene_id 1');
      return;
    }
    
    const sceneJSON = res.json_data;
    console.log('Scene Data Loaded:', sceneJSON);
    
    // 2. 创建自定义 Group 并解析 JSON
    const group = new THREE.Group();
    // 遍历 JSON 中的 objects
    if (sceneJSON.objects && Array.isArray(sceneJSON.objects)) {
      for (const obj of sceneJSON.objects) {
        await parseObject(obj, group, THREE);
      }
    }
    
    // 3. 挂载到 A-Frame 实体
    // 为了防止物体过大挡住视线，可以根据需要调整 scale
    // 假设编辑器单位是米，MindAR 的图宽是 1 unit。如果物体很大，需要缩小。
    // 这里先给个保险的缩放值，或者您可以根据实际情况调整。
    // group.scale.set(0.1, 0.1, 0.1); 

    container.setObject3D('mesh', group);
    console.log('Custom Three.js scene integrated.');

  } catch (error) {
    console.error('Error loading scene:', error);
  }
}

// 简易解析器：使用 window.THREE 解析 SceneJSON Object
async function parseObject(obj, parentGroup, THREE) {
  const position = obj.position || [0, 0, 0];
  const rotation = obj.rotation || [0, 0, 0];
  const scale = obj.scale || [1, 1, 1];
  let mesh = null;

  try {
    if (obj.type === 'box') {
      const size = obj.size || [1, 1, 1];
      const geometry = new THREE.BoxGeometry(...size);
      const material = new THREE.MeshStandardMaterial({ color: obj.color || '#ffffff' });
      mesh = new THREE.Mesh(geometry, material);
    } 
    else if (obj.type === 'sphere') {
      const radius = obj.radius || 1;
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: obj.color || '#ffffff' });
      mesh = new THREE.Mesh(geometry, material);
    }
    else if (obj.type === 'model' && obj.url) {
      // 检查 GLTFLoader
      if (!THREE.GLTFLoader) {
        console.warn('THREE.GLTFLoader is missing. Models cannot be loaded.');
        return;
      }
      
      const loader = new THREE.GLTFLoader();
      
      // 如果需要 Draco 解压
      if (obj.useDracoLoader && THREE.DRACOLoader) {
         const dracoLoader = new THREE.DRACOLoader();
         // 使用公共 CDN 或者本地 public 目录
         dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
         loader.setDRACOLoader(dracoLoader);
      }

      const fullUrl = BASE_IMG + obj.url;
      const gltf = await new Promise((resolve, reject) => {
        loader.load(fullUrl, resolve, undefined, reject);
      });
      
      mesh = gltf.scene;
      
      // 处理材质颜色覆盖
      if (obj.options && obj.options.material && obj.options.material.color) {
         mesh.traverse(child => {
           if (child.isMesh) {
             child.material.color.set(obj.options.material.color);
           }
         });
      }
    }
    else if (obj.type === 'image' && obj.url) {
      const textureLoader = new THREE.TextureLoader();
      const fullUrl = BASE_IMG + obj.url;
      const texture = await new Promise((resolve, reject) => {
        textureLoader.load(fullUrl, resolve, undefined, reject);
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // 根据图片比例创建 Plane
      const img = texture.image;
      const baseWidth = obj.baseWidth || 1;
      const aspect = img.height / img.width;
      const geometry = new THREE.PlaneGeometry(baseWidth, baseWidth * aspect);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true, 
        side: THREE.DoubleSide 
      });
      mesh = new THREE.Mesh(geometry, material);
    }
    
    // 如果成功创建 mesh
    if (mesh) {
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.scale.set(...scale);
      parentGroup.add(mesh);
    }

  } catch (e) {
    console.warn(`Failed to parse object type ${obj.type}:`, e);
  }
}
</script>

<style scoped>
/* 确保视频背景层级正确 */
:deep(video) {
  z-index: 1 !important;
}
:deep(.a-canvas) {
  z-index: 2 !important;
}
</style>