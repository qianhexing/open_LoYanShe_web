<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, shallowRef } from 'vue';
import ThreeCore from '@/utils/threeCore';
import * as THREE from 'three';
import { getShopList } from '@/api/shop';
import { getLibraryList } from '@/api/library';
import type { Shop, Library } from '@/types/api';

const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const shopMap = new Map<number, Shop>();
const libraryList = ref<Library[]>([]);

// 鼠标悬停信息
const hoverInfo = ref<{
  visible: boolean;
  x: number;
  y: number;
  data: Library | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  data: null
});

// 颜色生成器
const colorMap = new Map<number, THREE.Color>();
const getShopColor = (shopId: number) => {
  if (!colorMap.has(shopId)) {
    const hue = Math.random();
    const saturation = 0.6 + Math.random() * 0.4;
    const lightness = 0.4 + Math.random() * 0.3;
    colorMap.set(shopId, new THREE.Color().setHSL(hue, saturation, lightness));
  }
  return colorMap.get(shopId)!;
};

// 获取数据
const fetchData = async () => {
  try {
    loading.value = true;
    
    // 获取店铺列表
    const shopRes = await getShopList({ page: 1, pageSize: 200 });
    shopRes.rows.forEach(shop => {
      shopMap.set(shop.shop_id, shop);
      getShopColor(shop.shop_id);
    });

    // 获取图鉴列表
    const libRes = await getLibraryList({ page: 1, pageSize: 1500 });
    libraryList.value = libRes.rows.filter(l => l.shop_id && l.sale_time);

    console.log(`Loaded ${libraryList.value.length} libraries from ${shopMap.size} shops.`);

  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    loading.value = false;
  }
};

const createPointCloud = () => {
  if (!threeCore.value || libraryList.value.length === 0) return;

  const scene = threeCore.value.scene;
  const libraries = libraryList.value;
  const count = libraries.length;

  // 1. 计算店铺聚类位置 (Grid Layout)
  const shopClusters = new Map<number, {cx: number, cy: number, cz: number}>();
  // 收集所有出现的 shop_id (有些图鉴的 shop_id 可能不在 shopMap 里)
  const uniqueShopIds = new Set(libraries.map(l => l.shop_id).filter(id => id));
  const uniqueShopIdsArray = Array.from(uniqueShopIds);
  
  uniqueShopIdsArray.forEach((id, index) => {
    // 球面均匀分布
    const r = 80;
    const phi = Math.acos(-1 + (2 * index) / uniqueShopIdsArray.length);
    const theta = Math.sqrt(uniqueShopIdsArray.length * Math.PI) * phi;
    
    shopClusters.set(id!, {
      cx: r * Math.sin(phi) * Math.cos(theta),
      cy: r * Math.sin(phi) * Math.sin(theta),
      cz: r * Math.cos(phi)
    });
  });

  // 2. 准备数据数组
  const libPositions = new Float32Array(count * 3);
  const libColors = new Float32Array(count * 3);
  const libSizes = new Float32Array(count);

  const shopPositions: number[] = [];
  const shopColors: number[] = [];
  const shopSizes: number[] = [];

  const linePositions = new Float32Array(count * 2 * 3);
  const lineColors = new Float32Array(count * 2 * 3);

  // 3. 构建图鉴点和连线数据
  libraries.forEach((lib, i) => {
    const shopId = lib.shop_id!;
    const center = shopClusters.get(shopId) || { cx: 0, cy: 0, cz: 0 };
    const color = getShopColor(shopId);

    // 图鉴位置：在店铺中心周围随机分布
    const offset = 12; 
    const x = center.cx + (Math.random() - 0.5) * offset;
    const y = center.cy + (Math.random() - 0.5) * offset;
    const z = center.cz + (Math.random() - 0.5) * offset;

    // Fill Lib Data
    libPositions[i * 3] = x;
    libPositions[i * 3 + 1] = y;
    libPositions[i * 3 + 2] = z;

    libColors[i * 3] = color.r;
    libColors[i * 3 + 1] = color.g;
    libColors[i * 3 + 2] = color.b;

    // Size based on popularity
    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0) * 2;
    libSizes[i] = Math.max(1.5, Math.min(6, Math.log(popularity + 1) * 1.5));

    // Fill Line Data
    // Vertex 0: Lib
    linePositions[i * 6] = x;
    linePositions[i * 6 + 1] = y;
    linePositions[i * 6 + 2] = z;
    
    lineColors[i * 6] = color.r;
    lineColors[i * 6 + 1] = color.g;
    lineColors[i * 6 + 2] = color.b;

    // Vertex 1: Shop Center
    linePositions[i * 6 + 3] = center.cx;
    linePositions[i * 6 + 4] = center.cy;
    linePositions[i * 6 + 5] = center.cz;
    
    // Line end color (slightly darker)
    lineColors[i * 6 + 3] = color.r * 0.4;
    lineColors[i * 6 + 4] = color.g * 0.4;
    lineColors[i * 6 + 5] = color.b * 0.4;
  });

  // 4. 构建店铺点数据
  // 注意：uniqueShopIdsArray 里的顺序就是 shopClusters 里的顺序
  uniqueShopIdsArray.forEach((id) => {
    const center = shopClusters.get(id!)!;
    const color = getShopColor(id!);

    shopPositions.push(center.cx, center.cy, center.cz);
    shopColors.push(color.r, color.g, color.b);
    shopSizes.push(15.0); // 店铺点固定较大
  });

  // --- Render Library Points ---
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(libPositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(libColors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(libSizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if(length(coord) > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0); 
      }
    `,
    transparent: true,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData = { isPointCloud: true, libraries };
  scene.add(points);

  // --- Render Shop Points ---
  const shopGeometry = new THREE.BufferGeometry();
  shopGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shopPositions), 3));
  shopGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(shopColors), 3));
  shopGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(shopSizes), 1));
  
  // Use same shader but with larger points
  const shopMaterial = material.clone();
  
  const shopPoints = new THREE.Points(shopGeometry, shopMaterial);
  shopPoints.userData = { isShopPoints: true };
  scene.add(shopPoints);

  // --- Render Lines ---
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2, 
    blending: THREE.AdditiveBlending
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.userData = { isLines: true };
  scene.add(lines);
};

const initThree = () => {
  if (!container.value) return;

  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: 0, z: 180 },
    clearColor: 0x000000,
    alpha: false,
    enableStats: true,
    enableOrbitControls: true
  });
  
  core.camera.lookAt(0, 0, 0);

  threeCore.value = core;
  core.mount(container.value);
  core.startAnimationLoop();

  // Raycaster setup
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 2; 
  const mouse = new THREE.Vector2();

  const onMouseMove = (event: MouseEvent) => {
    if (!core.camera) return;
    
    const rect = container.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, core.camera);

    const pointsObject = core.scene.children.find(child => (child as any).userData?.isPointCloud) as THREE.Points;
    if (pointsObject) {
      const intersections = raycaster.intersectObject(pointsObject);
      
      if (intersections.length > 0) {
        const index = intersections[0].index!;
        const lib = (pointsObject as any).userData.libraries[index] as Library;
        
        hoverInfo.value = {
          visible: true,
          x: event.clientX + 15,
          y: event.clientY + 15,
          data: lib
        };
        document.body.style.cursor = 'pointer';
      } else {
        hoverInfo.value.visible = false;
        document.body.style.cursor = 'default';
      }
    }
  };
  
  const onClick = (event: MouseEvent) => {
     if (hoverInfo.value.visible && hoverInfo.value.data) {
        console.log('Clicked:', hoverInfo.value.data);
     }
  }

  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('click', onClick);
};

onMounted(async () => {
  await fetchData();
  initThree();
  createPointCloud();
});

onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose();
  }
});
</script>

<template>
  <div class="relative w-full h-screen bg-black overflow-hidden font-sans">
    <div ref="container" class="w-full h-full"></div>
    
    <!-- Loading Overlay -->
    <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 text-white z-50">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <div class="text-xl tracking-widest">LOADING GALAXY</div>
    </div>

    <!-- UI Overlay -->
    <div class="absolute top-6 left-6 z-40 pointer-events-none">
      <h1 class="text-2xl font-bold text-white mb-1 tracking-wider">SHOP GALAXY</h1>
      <p class="text-gray-400 text-sm">{{ libraryList.length }} Libraries | {{ shopMap.size }} Shops</p>
    </div>

    <!-- Info Card -->
    <div 
      v-if="hoverInfo.visible && hoverInfo.data"
      class="fixed pointer-events-none z-50 bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg p-4 text-white shadow-2xl backdrop-blur-md w-80 transform transition-opacity duration-150"
      :style="{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }"
    >
      <div class="flex items-start gap-4">
        <div class="w-16 h-20 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
          <img 
            v-if="hoverInfo.data.cover" 
            :src="hoverInfo.data.cover" 
            class="w-full h-full object-cover"
            alt="cover"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-base text-blue-400 truncate leading-tight mb-1">{{ hoverInfo.data.name }}</h3>
          <p class="text-xs text-gray-400 truncate mb-2">
            {{ shopMap.get(hoverInfo.data.shop_id!)?.shop_name || 'Unknown Shop' }}
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <div class="flex items-center gap-1">
              <span class="opacity-50">📅</span>
              <span>{{ hoverInfo.data.sale_time?.split(' ')[0] || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="opacity-50">🔥</span>
              <span>{{ hoverInfo.data.good_count || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="opacity-50">👗</span>
              <span>{{ hoverInfo.data.wardrobe_count || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="absolute bottom-6 left-6 text-gray-600 text-xs pointer-events-none select-none">
      <p>Left Click + Drag to Rotate</p>
      <p>Right Click + Drag to Pan</p>
      <p>Scroll to Zoom</p>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 0px;
}
</style>
