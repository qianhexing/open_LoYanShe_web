<template>
  <div ref="container" class="w-full h-screen relative bg-[#020205] overflow-hidden select-none font-sans text-gray-200">
    
    <!-- 加载界面 -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#020205] z-50">
        <div class="relative w-16 h-16 mb-4">
          <div class="absolute inset-0 border-t-2 border-blue-400 rounded-full animate-spin"></div>
        </div>
        <div class="text-xl font-light tracking-[0.3em]">正在构建星系数据</div>
        <div class="text-gray-500 text-xs mt-2 font-mono">{{ loadingStatus }}</div>
      </div>
    </Transition>

    <!-- UI 层 -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      
      <!-- 顶部标题 -->
      <div class="flex justify-between items-start">
        <div class="pointer-events-auto">
          <h1 class="text-3xl font-bold text-white tracking-widest">
            银河时光树 <span class="text-blue-400 text-sm font-normal block mt-1">商业与图鉴的时空演化</span>
          </h1>
        </div>
        
        <div class="flex flex-col items-end gap-3 pointer-events-auto">
          <div class="glass-panel px-5 py-3 text-right border-r-2 border-blue-500/50">
            <div class="text-[10px] text-gray-400 uppercase tracking-widest mb-1">数据概览</div>
            <div class="text-lg font-bold text-white">{{ totalPoints.toLocaleString() }} <span class="text-xs font-normal text-gray-400">节点</span></div>
            <div class="text-xs text-blue-300 mt-1">
              包含 {{ SHOP_COUNT }} 家店铺
            </div>
          </div>
          
          <!-- 时间轴指示器 -->
          <div class="glass-panel px-3 py-4 flex flex-col items-center gap-2">
              <div class="text-[10px] text-gray-500">现在</div>
              <div class="w-1 h-20 bg-gradient-to-b from-blue-400 via-purple-500 to-gray-700 rounded-full opacity-50"></div>
              <div class="text-[10px] text-gray-500">过去</div>
          </div>
        </div>
      </div>

      <!-- 底部信息与图例 -->
      <div class="flex justify-between items-end">
        <!-- 悬停信息面板 -->
        <div v-if="hoveredData" class="glass-panel px-6 py-4 pointer-events-auto animate-fade-in border-l-2 border-blue-400 max-w-sm backdrop-blur-md bg-black/40">
          <div class="text-[10px] font-bold tracking-widest mb-1" :class="hoveredData.type === 'shop' ? 'text-purple-400' : 'text-blue-400'">
            {{ hoveredData.type === 'shop' ? '店铺核心 (STAR)' : '图鉴 (ARTIFACT)' }}
          </div>
          <h2 class="text-xl font-bold text-white mb-2">{{ hoveredData.name }}</h2>
          
          <div class="text-xs text-gray-300 space-y-2 font-mono">
            <div v-if="hoveredData.type === 'shop'">
                 <div class="flex justify-between"><span>成立时间:</span> <span class="text-white">{{ hoveredData.dateStr }}</span></div>
                 <div class="flex justify-between"><span>图鉴总数:</span> <span class="text-white">{{ hoveredData.childCount }}</span></div>
            </div>
            <div v-else>
                 <div class="flex justify-between"><span>贩售时间:</span> <span class="text-white">{{ hoveredData.dateStr }}</span></div>
                 <div class="flex justify-between"><span>热度 (衣柜数):</span> <span class="text-blue-300">{{ hoveredData.wardrobeCount }}</span></div>
                 <div class="mt-2 pt-2 border-t border-gray-700 text-purple-300 cursor-pointer hover:text-white transition-colors" @click="focusShop(hoveredData.parentId)">
                    所属店铺: {{ getShopName(hoveredData.parentId) }} ↗
                 </div>
            </div>
          </div>
        </div>
        
        <div v-else></div>

        <!-- 图例 -->
        <div class="glass-panel px-4 py-2 text-[10px] text-gray-400 font-mono text-right">
          <div class="flex items-center justify-end gap-2 mb-1">
            <span>店铺核心</span> <span class="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <div class="flex items-center justify-end gap-2">
            <span>图鉴节点</span> <span class="w-1 h-1 rounded-full bg-blue-400"></span>
          </div>
          <div class="mt-2 text-gray-600">
            Y轴: 时间流逝<br>
            粒子大小: 热度权重
          </div>
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
const SHOP_COUNT = 300;             // 模拟店铺数量
const MAX_ITEMS_PER_SHOP = 150;     // 每家店铺最大图鉴数
const START_YEAR = 2010;            // 起始年份
const END_YEAR = 2024;              // 结束年份
const TIME_SPAN_MS = (END_YEAR - START_YEAR) * 365 * 24 * 3600 * 1000;
const BASE_DATE = new Date(`${START_YEAR}-01-01`).getTime();

const TIME_TO_Y_SCALE = 0.00000005; // 时间转Y轴高度的比例
const GALAXY_RADIUS = 400;          // 星系XZ平面的分布半径

// --- 状态管理 ---
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadingStatus = ref('初始化引擎...');
const totalPoints = ref(0);
const hoveredData = ref<any>(null);

// --- Three.js 核心变量 ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let composer: EffectComposer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

let pointCloud: THREE.Points | null = null;
let lineSegments: THREE.LineSegments | null = null;
let hoverMesh: THREE.Mesh | null = null;

// 数据存储
const pointsMetadata: any[] = [];
const shopMap = new Map<number, string>();

onMounted(async () => {
  initThree();
  await generateData();
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

  // 1. 场景 - 纯黑偏蓝背景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020205);
  scene.fog = new THREE.FogExp2(0x020205, 0.0008);

  // 2. 相机
  camera = new THREE.PerspectiveCamera(50, container.value.clientWidth / container.value.clientHeight, 0.1, 5000);
  camera.position.set(0, 200, 600); // 俯视视角

  // 3. 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.appendChild(renderer.domElement);

  // 4. 后处理 - 极低的光晕，仅用于平滑边缘
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.5; // 提高阈值，只有很亮的部分才发光
  bloomPass.strength = 0.3;  // 降低强度，避免光污染
  bloomPass.radius = 0.2;
  
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // 5. 控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;
  controls.maxDistance = 1500;

  // 6. 交互
  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 2;
  mouse = new THREE.Vector2();

  // 7. 高亮光标
  const cursorGeo = new THREE.RingGeometry(1.5, 2, 32);
  const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  hoverMesh = new THREE.Mesh(cursorGeo, cursorMat);
  hoverMesh.visible = false;
  scene.add(hoverMesh);
};

// --- 数据生成与布局核心逻辑 ---
const generateData = async () => {
  loadingStatus.value = "生成时空拓扑结构...";
  
  // 缓冲区
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  
  // 颜色配置
  const colorShop = new THREE.Color(0x9d4edd); // 紫色店铺
  const colorOld = new THREE.Color(0x219ebc);  // 蓝色旧物
  const colorNew = new THREE.Color(0x8ecae6);  // 青白新物
  const colorHot = new THREE.Color(0xffb703);  // 热门高亮

  for (let i = 0; i < SHOP_COUNT; i++) {
    const shopId = i;
    const shopName = `店铺 ${i+1}号`;
    shopMap.set(shopId, shopName);

    // 1. 店铺生成
    // 随机成立时间 (2010 - 2020)
    const startOffset = Math.random() * (TIME_SPAN_MS * 0.7);
    const startTime = BASE_DATE + startOffset;
    
    // 店铺布局：基于螺旋分布在 XZ 平面，Y轴由成立时间决定
    // 这样老店铺在下面，新店铺在上面，符合"树"的生长
    const angle = i * 2.4; // 黄金角
    const r = 20 * Math.sqrt(i) + 10; // 扩散半径
    
    // 基础坐标
    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const cy = (startOffset * TIME_TO_Y_SCALE) - 100; // 映射到Y轴

    // 添加店铺粒子
    positions.push(cx, cy, cz);
    colors.push(colorShop.r, colorShop.g, colorShop.b);
    sizes.push(8.0); // 店铺粒子较大

    const shopNodeIndex = pointsMetadata.length;
    pointsMetadata.push({
      type: 'shop',
      id: shopId,
      name: shopName,
      dateStr: new Date(startTime).toISOString().split('T')[0],
      childCount: 0
    });

    // 2. 图鉴生成
    const itemCount = Math.floor(Math.random() * MAX_ITEMS_PER_SHOP) + 5;
    pointsMetadata[shopNodeIndex].childCount = itemCount;

    // 临时存储该店铺的所有图鉴，用于排序连接
    const shopItems = [];

    for (let j = 0; j < itemCount; j++) {
      // 贩售时间 > 店铺成立时间
      const itemTime = startTime + Math.random() * (BASE_DATE + TIME_SPAN_MS - startTime);
      const wardrobeCount = Math.floor(Math.pow(Math.random(), 3) * 10000); // 偏向小数值，偶尔大数值

      shopItems.push({
        id: j,
        time: itemTime,
        wardrobe: wardrobeCount
      });
    }

    // 按时间排序，构建生长链
    shopItems.sort((a, b) => a.time - b.time);

    let prevX = cx, prevY = cy, prevZ = cz;
    
    // 遍历生成图鉴粒子
    for (let k = 0; k < shopItems.length; k++) {
      const item = shopItems[k];
      
      // 高度 Y
      const iy = (item.time - BASE_DATE) * TIME_TO_Y_SCALE - 100;
      
      // XZ 坐标：在店铺中心周围螺旋上升
      // 半径随热度变化？或者随时间扩散？
      // 为了体现"树"，围绕中心轴旋转
      const itemAngle = (k * 0.5) + angle; // 局部螺旋
      const itemRadius = 2 + (k * 0.1); // 随数量微扩
      // 加上一些随机扰动模拟树枝分叉感
      const noiseX = (Math.random() - 0.5) * 5;
      const noiseZ = (Math.random() - 0.5) * 5;

      const ix = cx + Math.cos(itemAngle) * itemRadius + noiseX;
      const iz = cz + Math.sin(itemAngle) * itemRadius + noiseZ;

      positions.push(ix, iy, iz);

      // 颜色逻辑：混合时间颜色，如果是高热度则高亮
      const t = (item.time - BASE_DATE) / TIME_SPAN_MS;
      let c = colorOld.clone().lerp(colorNew, t);
      
      if (item.wardrobe > 5000) {
        c = colorHot; // 爆款显示金色
      }
      colors.push(c.r, c.g, c.b);

      // 大小逻辑：基于热度
      const size = 2 + (item.wardrobe / 2000); // 2 ~ 7
      sizes.push(size);

      pointsMetadata.push({
        type: 'library',
        id: `${shopId}-${item.id}`,
        name: `${shopName} - 图鉴#${item.id}`,
        dateStr: new Date(item.time).toISOString().split('T')[0],
        wardrobeCount: item.wardrobe,
        parentId: shopId
      });

      // 连线逻辑：
      // 方案A: 连向店铺中心 (星状) -> 用户需求"连线店铺"
      // 方案B: 连向上一件商品 (树状/链状) -> 视觉更好，体现生长
      // 结合：如果单纯连店铺，几千根线会糊成一团。我们采用链式连接，
      // 但视觉上这根链就是"店铺的历史线"。
      
      // 这里采用链式连接（连接到上一个节点），形成生长轨迹
      linePositions.push(prevX, prevY, prevZ);
      linePositions.push(ix, iy, iz);
      
      // 线条颜色淡一些
      lineColors.push(c.r * 0.3, c.g * 0.3, c.b * 0.3);
      lineColors.push(c.r * 0.5, c.g * 0.5, c.b * 0.5); // 渐变

      // 更新前置节点
      prevX = ix;
      prevY = iy;
      prevZ = iz;
    }
  }

  // 构建几何体
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  pGeo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

  const pMat = new THREE.PointsMaterial({
    vertexColors: true,
    sizeAttenuation: true,
    map: getCircleTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false, // 关键：解决透明遮挡问题
    blending: THREE.NormalBlending // 不用 Additive，防止过曝光污染
  });

  pointCloud = new THREE.Points(pGeo, pMat);
  scene.add(pointCloud);

  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

  const lMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });

  lineSegments = new THREE.LineSegments(lGeo, lMat);
  scene.add(lineSegments);

  totalPoints.value = pointsMetadata.length;
  loading.value = false;
};

// 纹理生成 - 实心柔边圆点，不带光晕
const getCircleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
};

// 辅助函数
const getShopName = (id: number) => shopMap.get(id) || '未知店铺';

const focusShop = (shopId: number) => {
  const index = pointsMetadata.findIndex(p => p.type === 'shop' && p.id === shopId);
  if (index !== -1 && pointCloud) {
    const pos = pointCloud.geometry.getAttribute('position');
    const x = pos.getX(index);
    const y = pos.getY(index);
    const z = pos.getZ(index);

    new TWEEN.Tween(controls.target)
      .to({ x, y: y + 50, z }, 1200) // 视点稍微抬高
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();

    new TWEEN.Tween(camera.position)
      .to({ x: x + 80, y: y + 80, z: z + 80 }, 1200)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }
};

// --- 事件监听 ---
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
      
      if (hoverMesh) {
        hoverMesh.visible = true;
        hoverMesh.position.set(pos.getX(index), pos.getY(index), pos.getZ(index));
        hoverMesh.lookAt(camera.position);
      }
      
      hoveredData.value = pointsMetadata[index];
      document.body.style.cursor = 'pointer';
    } else {
      hoveredData.value = null;
      if (hoverMesh) hoverMesh.visible = false;
      document.body.style.cursor = 'default';
    }
  }
};

const onClick = () => {
  if (hoveredData.value) {
    if (hoveredData.value.type === 'shop') {
      focusShop(hoveredData.value.id);
    } else {
      focusShop(hoveredData.value.parentId);
    }
  }
};

const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  composer.render();
};
</script>

<style scoped>
.glass-panel {
  background: rgba(15, 15, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
