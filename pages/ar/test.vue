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

function loadMyScene(sceneEl) {
  // 获取 A-Frame 的 THREE 实例（全局）
  // 注意：MindAR 和 A-Frame 会在 window 上挂载 THREE
  const THREE = window.THREE; 
  if (!THREE) {
    console.error('THREE not found on window');
    return;
  }

  const container = document.querySelector('#my-three-scene');
  if (!container) return;
  
  console.log('Loading custom Three.js scene...');
  
  // === 集成自定义 Three.js 场景 ===
  // 示例：创建一个自定义的 Group 并添加物体
  const group = new THREE.Group();
  
  // 示例 1: 动态创建一个旋转的环形结
  const geometry = new THREE.TorusKnotGeometry(0.1, 0.03, 100, 16);
  // 使用 Standard 材质以响应场景光照
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x00aaff, 
    roughness: 0.2, 
    metalness: 0.8 
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0.2, 0.2); // 调整位置
  group.add(mesh);
  
  // 示例 2: 如果您有现成的 Three.js 代码或类，可以在这里实例化
  // 例如：const myObject = new MyCustomObject(THREE);
  // group.add(myObject);

  // 简单的动画逻辑
  function animate() {
    if (mesh) {
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.02;
    }
    requestAnimationFrame(animate);
  }
  animate();

  // 将 group 设置为 entity 的 object3D
  // setObject3D(type, obj) - type 通常是 'mesh' 或 'group'
  container.setObject3D('mesh', group);
  console.log('Custom Three.js scene integrated.');
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