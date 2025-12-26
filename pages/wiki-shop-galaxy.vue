<template>
  <div ref="container" class="w-full h-screen relative bg-[#050505] overflow-hidden select-none font-sans text-gray-200">
    
    <!-- 加载界面 -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-50">
        <div class="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="text-gray-400 text-xs mt-3 font-mono tracking-widest">{{ loadingStatus }}</div>
      </div>
    </Transition>

    <!-- UI 层 -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      
      <!-- 顶部 -->
      <div class="flex justify-between items-start">
        <div class="pointer-events-auto">
          <h1 class="text-4xl font-black text-white tracking-tighter mix-blend-difference">
            NATURE <span class="font-light text-gray-400">OF COMMERCE</span>
          </h1>
          <p class="text-xs text-gray-500 mt-1 font-mono">150 YEARS STYLE EVOLUTION VISUALIZATION</p>
        </div>
        
        <div class="flex flex-col items-end gap-2 pointer-events-auto">
          <div class="bg-black/80 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-lg">
            <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">节点统计</div>
            <div class="flex gap-4 text-xs font-mono">
              <div><span class="text-white font-bold">{{ SHOP_COUNT }}</span> 店铺</div>
              <div><span class="text-gray-400 font-bold">{{ totalPoints - SHOP_COUNT }}</span> 图鉴</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="flex justify-between items-end">
        <!-- 悬停信息 -->
        <div v-if="hoveredData" class="bg-black/90 backdrop-blur-md border-l-2 border-white px-6 py-4 pointer-events-auto max-w-sm rounded-r-lg shadow-2xl animate-fade-in">
          <div class="text-[10px] font-bold tracking-widest mb-1 uppercase text-gray-500">
            {{ hoveredData.type === 'shop' ? 'CLUSTER ROOT' : 'DATA POINT' }}
          </div>
          <h2 class="text-xl font-bold text-white mb-2 leading-tight">{{ hoveredData.name }}</h2>
          
          <div class="text-xs text-gray-400 space-y-1 font-mono">
            <div class="flex justify-between border-b border-gray-800 pb-1 mb-1">
              <span>时间节点</span> 
              <span class="text-white">{{ hoveredData.dateStr }}</span>
            </div>
            <div v-if="hoveredData.type === 'library'">
                 <div class="flex justify-between">
                   <span>热度指数</span> 
                   <span class="text-white">{{ hoveredData.wardrobeCount }}</span>
                 </div>
                 <div class="mt-2 text-blue-400 cursor-pointer hover:underline" @click="focusTarget(hoveredData.parentId)">
                    定位所属星团 ↗
                 </div>
            </div>
            <div v-else>
                 <div class="flex justify-between">
                   <span>包含数据</span> 
                   <span class="text-white">{{ hoveredData.childCount }} 项</span>
                 </div>
            </div>
          </div>
        </div>
        
        <div v-else></div>

        <!-- 时间轴图例 -->
        <div class="bg-black/80 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-lg pointer-events-auto">
          <div class="flex items-center gap-3 text-[10px] text-gray-400 font-mono mb-2">
            <span>2010</span>
            <div class="w-32 h-px bg-gradient-to-r from-gray-700 via-gray-400 to-white"></div>
            <span>2024</span>
          </div>
          <div class="text-[9px] text-gray-600 text-center uppercase tracking-widest">X-AXIS TIME SCALE</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import TWEEN from '@tweenjs/tween.js';

// --- 配置参数 ---
const SHOP_COUNT = 400;             
const MAX_ITEMS_PER_SHOP = 100;     
const START_YEAR = 2010;
const END_YEAR = 2024;
const BASE_TIME = new Date(`${START_YEAR}-01-01`).getTime();
const TOTAL_TIME = new Date(`${END_YEAR}-01-01`).getTime() - BASE_TIME;

// 布局参数
const X_SCALE = 0.00000004; // 时间轴拉伸系数 (横向)
const CLUSTER_SPREAD = 30;  // 团簇内部扩散半径
const GALAXY_WIDTH = 150;   // 整体流的宽度 (Y/Z轴随机范围)

// --- 状态 ---
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
const progress = ref(0);
const loadingStatus = ref('初始化...');
const totalPoints = ref(0);
const hoveredData = ref<any>(null);

// --- Three.js ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let composer: EffectComposer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

let pointCloud: THREE.Points | null = null;
let connectionLines: THREE.LineSegments | null = null;
let hoverHighlight: THREE.Mesh | null = null;

const pointsMetadata: any[] = [];
// 色板：Nature 风格通常使用高饱和度的区分色
const PALETTE = [
  0xe63946, 0xf1faee, 0xa8dadc, 0x457b9d, 0x1d3557, // 蓝红白
  0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51,           // 黄绿橙
  0x8338ec, 0x3a86ff, 0xff006e, 0xfb5607, 0xffbe0b  // 霓虹
];

onMounted(async () => {
  initThree();
  await generateNatureData();
  animate();
  
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', onClick);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onClick);
  cancelAnimationFrame(animationId);
  renderer?.dispose();
});

const initThree = () => {
  if (!container.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.Fog(0x050505, 500, 2000);

  camera = new THREE.PerspectiveCamera(45, container.value.clientWidth / container.value.clientHeight, 0.1, 5000);
  // 初始视角：侧面远眺整个时间长河
  camera.position.set(0, 0, 800);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.appendChild(renderer.domElement);

  // 后处理：非常轻微的Bloom，增加一点点空气感，但不模糊
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.8;
  bloomPass.strength = 0.2;
  bloomPass.radius = 0.1;
  
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false; // 停止自旋转
  controls.maxDistance = 2000;
  // 允许自由旋转，不限制角度

  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 1.5;
  mouse = new THREE.Vector2();

  // 高亮光圈
  const geometry = new THREE.RingGeometry(1, 1.2, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  hoverHighlight = new THREE.Mesh(geometry, material);
  hoverHighlight.visible = false;
  scene.add(hoverHighlight);
};

const generateNatureData = async () => {
  loadingStatus.value = "生成点云数据...";
  
  // 缓冲区
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const linePositions: number[] = [];
  const lineColors: number[] = [];

  // 为了模拟 Nature 的“团块”感，我们使用 Perlin Noise 类似的思路或随机游走
  // 但这里简单起见，使用 Time-based Clustering
  
  for (let i = 0; i < SHOP_COUNT; i++) {
    // 进度条模拟
    if (i % 20 === 0) {
        progress.value = (i / SHOP_COUNT) * 100;
        await new Promise(r => setTimeout(r, 0)); // 让UI刷新
    }

    const shopId = i;
    const shopName = `BRAND-${(i+1000).toString(16).toUpperCase()}`;
    
    // 1. 店铺基础位置 (Cluster Center)
    const startOffset = Math.random() * (TOTAL_TIME * 0.8);
    const startTime = BASE_TIME + startOffset;
    
    // X轴：严格的时间轴
    // 中心点 X
    const cx = (startOffset * X_SCALE) - 400; // 将时间轴平移到中心
    
    // Y/Z轴：随机分布，形成一个长条形的"云"
    // 使用正态分布让中间密集，边缘稀疏
    const cy = (Math.random() - 0.5) * GALAXY_WIDTH * (Math.random() + 0.5);
    const cz = (Math.random() - 0.5) * GALAXY_WIDTH * (Math.random() + 0.5);
    
    // 店铺颜色：每个Cluster一种主色调
    const paletteIndex = Math.floor(Math.random() * PALETTE.length);
    const baseColorHex = PALETTE[paletteIndex];
    const baseColor = new THREE.Color(baseColorHex);

    // 添加店铺粒子
    positions.push(cx, cy, cz);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    sizes.push(6.0); // 店铺稍大

    const shopIndex = pointsMetadata.length;
    pointsMetadata.push({
      type: 'shop',
      id: shopId,
      name: shopName,
      dateStr: new Date(startTime).getFullYear(),
      parentId: null,
      childCount: 0
    });

    // 2. 图鉴生成 (Cluster Points)
    const itemCount = Math.floor(Math.random() * MAX_ITEMS_PER_SHOP) + 10;
    pointsMetadata[shopIndex].childCount = itemCount;

    for (let j = 0; j < itemCount; j++) {
      // 图鉴时间 >= 店铺时间
      // 时间跨度在几年内
      const itemOffset = startOffset + Math.random() * (3 * 365 * 24 * 3600 * 1000); 
      const itemTime = BASE_TIME + itemOffset;
      const wardrobe = Math.floor(Math.random() * 5000);

      // 图鉴位置：围绕店铺中心，像蒲公英一样散开
      // 但也要受到整体时间轴(X)的影响，所以 X 轴不能乱跑太多，主要在 Y/Z 轴扩散
      
      // X 轴：跟随时间，微量偏移
      const ix = (itemOffset * X_SCALE) - 400; 
      
      // Y/Z 轴：在店铺周围随机球体分布
      // 半径随热度或随机
      const r = Math.random() * CLUSTER_SPREAD;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      const iy = cy + r * Math.sin(phi) * Math.sin(theta);
      const iz = cz + r * Math.cos(phi);

      positions.push(ix, iy, iz);
      
      // 颜色：基于店铺主色，稍微变化亮度或饱和度，不做完全随机
      // 这样能保证视觉上的"团块感"
      const itemColor = baseColor.clone();
      // 稍微偏移一点色相，根据热度变亮
      itemColor.offsetHSL(0, 0, (wardrobe / 10000) * 0.3); 
      
      colors.push(itemColor.r, itemColor.g, itemColor.b);
      
      // 大小：基于热度
      const size = 1.5 + (wardrobe / 2000);
      sizes.push(size);

      pointsMetadata.push({
        type: 'library',
        id: `${shopId}-${j}`,
        name: `${shopName} ITEM #${j}`,
        dateStr: new Date(itemTime).getFullYear(),
        wardrobeCount: wardrobe,
        parentId: shopId
      });

      // 连线：连接到店铺中心
      // 只有部分连线，避免过密
      if (Math.random() > 0.3) {
        linePositions.push(cx, cy, cz); // 起点：店铺
        linePositions.push(ix, iy, iz); // 终点：图鉴
        
        // 线条颜色：非常淡，接近透明
        lineColors.push(baseColor.r, baseColor.g, baseColor.b);
        lineColors.push(itemColor.r, itemColor.g, itemColor.b);
      }
    }
  }

  // 构建点云
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  pGeo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

  const pMat = new THREE.PointsMaterial({
    vertexColors: true,
    sizeAttenuation: true,
    map: getSoftCircleTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending // 叠加混合，让密集处变亮
  });

  pointCloud = new THREE.Points(pGeo, pMat);
  scene.add(pointCloud);

  // 构建线条
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

  const lMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.08, // 极低的透明度
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  connectionLines = new THREE.LineSegments(lGeo, lMat);
  scene.add(connectionLines);

  totalPoints.value = pointsMetadata.length;
  loading.value = false;
};

// 纹理：柔和的辉光点，模拟 Nature 的渲染风格
const getSoftCircleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  }
  return new THREE.CanvasTexture(canvas);
};

const focusTarget = (targetId: number | string) => {
    // 查找目标索引
    // 简单遍历 (可优化为Map)
    let index = -1;
    if (typeof targetId === 'number') {
        index = pointsMetadata.findIndex(p => p.type === 'shop' && p.id === targetId);
    }
    
    if (index !== -1 && pointCloud) {
        const pos = pointCloud.geometry.getAttribute('position');
        const x = pos.getX(index);
        const y = pos.getY(index);
        const z = pos.getZ(index);
        
        // 缓慢飞向目标
        new TWEEN.Tween(controls.target)
            .to({ x, y, z }, 1500)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
        new TWEEN.Tween(camera.position)
            .to({ x: x + 60, y: y + 30, z: z + 80 }, 1500)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
    }
}

// 交互
const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  composer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const onMouseMove = (event: MouseEvent) => {
  if (loading.value) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  if (pointCloud) {
    const intersects = raycaster.intersectObject(pointCloud);
    if (intersects.length > 0) {
      const index = intersects[0].index!;
      const pos = pointCloud.geometry.getAttribute('position');
      
      if (hoverHighlight) {
          hoverHighlight.visible = true;
          hoverHighlight.position.set(pos.getX(index), pos.getY(index), pos.getZ(index));
          hoverHighlight.lookAt(camera.position);
      }
      hoveredData.value = pointsMetadata[index];
      document.body.style.cursor = 'pointer';
    } else {
      hoveredData.value = null;
      if (hoverHighlight) hoverHighlight.visible = false;
      document.body.style.cursor = 'default';
    }
  }
};

const onClick = () => {
    if (hoveredData.value) {
        if (hoveredData.value.type === 'shop') {
            focusTarget(hoveredData.value.id);
        } else {
            focusTarget(hoveredData.value.parentId);
        }
    }
}

const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  composer.render();
};
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>
