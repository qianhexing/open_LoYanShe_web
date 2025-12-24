<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, shallowRef } from 'vue';
import ThreeCore from '@/utils/threeCore';
import * as THREE from 'three';
import { getShopList } from '@/api/shop';
import { getLibraryList } from '@/api/library';
import type { Shop, Library } from '@/types/api';
import { useRouter } from 'vue-router';

const router = useRouter();
const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const shopMap = new Map<number, Shop>();
const libraryList = ref<Library[]>([]);

// 选中信息（点击后锁定）
const selectedInfo = ref<{
  visible: boolean;
  x: number;
  y: number;
  data: Library | Shop | null;
  type: 'library' | 'shop';
}>({
  visible: false,
  x: 0,
  y: 0,
  data: null,
  type: 'library'
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
    const libRes = await getLibraryList({ page: 1, pageSize: 999 });
    libraryList.value = libRes.rows.filter(l => l.shop_id && l.sale_time);

    console.log(`Loaded ${libraryList.value.length} libraries from ${shopMap.size} shops.`);

  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    loading.value = false;
  }
};

const createFocusRing = () => {
  const geometry = new THREE.RingGeometry(0.8, 1.0, 32);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xffff00, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.visible = false;
  ring.userData.isFocusRing = true;
  return ring;
}

const createPointCloud = () => {
  if (!threeCore.value || libraryList.value.length === 0) return;

  const scene = threeCore.value.scene;
  const libraries = libraryList.value;
  const count = libraries.length;

  // 1. 计算店铺聚类位置 (Grid Layout - Random Space)
  const shopClusters = new Map<number, {cx: number, cy: number, cz: number}>();
  // 收集所有出现的 shop_id
  const uniqueShopIds = new Set(libraries.map(l => l.shop_id).filter(id => id));
  const uniqueShopIdsArray = Array.from(uniqueShopIds);
  
  // 星系排布紧凑一些：减小半径
  const GALAXY_RADIUS = 60; // 原来 120
  uniqueShopIdsArray.forEach((id, index) => {
    const r = Math.random() * GALAXY_RADIUS + 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
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
  const shopDataList: Shop[] = []; 

  const linePositions = new Float32Array(count * 2 * 3);
  const lineColors = new Float32Array(count * 2 * 3);

  // 3. 构建图鉴点和连线数据
  libraries.forEach((lib, i) => {
    const shopId = lib.shop_id!;
    const center = shopClusters.get(shopId) || { cx: 0, cy: 0, cz: 0 };
    const color = getShopColor(shopId);

    // 图鉴点扩散的开一些：增大 offset
    const offset = 25; // 原来 12
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

    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0) * 2;
    libSizes[i] = Math.max(1.5, Math.min(6, Math.log(popularity + 1) * 1.5));

    // Fill Line Data
    linePositions[i * 6] = x;
    linePositions[i * 6 + 1] = y;
    linePositions[i * 6 + 2] = z;
    
    lineColors[i * 6] = color.r;
    lineColors[i * 6 + 1] = color.g;
    lineColors[i * 6 + 2] = color.b;

    linePositions[i * 6 + 3] = center.cx;
    linePositions[i * 6 + 4] = center.cy;
    linePositions[i * 6 + 5] = center.cz;
    
    lineColors[i * 6 + 3] = color.r * 0.4;
    lineColors[i * 6 + 4] = color.g * 0.4;
    lineColors[i * 6 + 5] = color.b * 0.4;
  });

  // 4. 构建店铺点数据
  uniqueShopIdsArray.forEach((id) => {
    const center = shopClusters.get(id!)!;
    const color = getShopColor(id!);
    const shop = shopMap.get(id!);

    if (shop) {
      shopPositions.push(center.cx, center.cy, center.cz);
      shopColors.push(color.r, color.g, color.b);
      shopSizes.push(8.0);
      shopDataList.push(shop);
    }
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
  
  const shopMaterial = material.clone();
  
  const shopPoints = new THREE.Points(shopGeometry, shopMaterial);
  shopPoints.userData = { isShopPoints: true, shops: shopDataList };
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

  // --- Focus Ring ---
  const focusRing = createFocusRing();
  scene.add(focusRing);
};

const initThree = () => {
  if (!container.value) return;

  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: 0, z: 200 },
    clearColor: 0x000000,
    alpha: false,
    enableStats: false, // 1. 去掉性能监控
    enableOrbitControls: true
  });
  
  core.camera.lookAt(0, 0, 0);

  threeCore.value = core;
  core.mount(container.value);
  core.startAnimationLoop();

  // Raycaster setup
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 1.5; 
  const mouse = new THREE.Vector2();

  // 通用 Raycast 函数
  const performRaycast = (clientX: number, clientY: number) => {
    if (!core.camera) return null;
    const rect = container.value!.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, core.camera);

    const pointsObject = core.scene.children.find(child => (child as any).userData?.isPointCloud) as THREE.Points;
    const shopPointsObject = core.scene.children.find(child => (child as any).userData?.isShopPoints) as THREE.Points;

    // Check Shops
    if (shopPointsObject) {
      const intersections = raycaster.intersectObject(shopPointsObject);
      if (intersections.length > 0) {
        const index = intersections[0].index!;
        const shop = (shopPointsObject as any).userData.shops[index] as Shop;
        const pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(shopPointsObject.geometry.attributes.position as THREE.BufferAttribute, index);
        return { type: 'shop', data: shop, position: pointPosition, index } as const;
      }
    }

    // Check Libraries
    if (pointsObject) {
      const intersections = raycaster.intersectObject(pointsObject);
      if (intersections.length > 0) {
        const index = intersections[0].index!;
        const lib = (pointsObject as any).userData.libraries[index] as Library;
        const pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(pointsObject.geometry.attributes.position as THREE.BufferAttribute, index);
        return { type: 'library', data: lib, position: pointPosition, index } as const;
      }
    }
    return null;
  };

  const onMouseMove = (event: MouseEvent) => {
    const result = performRaycast(event.clientX, event.clientY);
    const focusRing = core.scene.children.find(child => (child as any).userData?.isFocusRing) as THREE.Mesh;

    if (result) {
      document.body.style.cursor = 'pointer';
      if (focusRing) {
        focusRing.visible = true;
        focusRing.position.copy(result.position);
        focusRing.lookAt(core.camera.position);
        focusRing.scale.set(result.type === 'shop' ? 3 : 1.5, result.type === 'shop' ? 3 : 1.5, 1);
      }
    } else {
      document.body.style.cursor = 'default';
      // 如果没有选中任何东西，且鼠标移开，我们只隐藏聚焦环
      // 信息框的显隐由 Click 控制
      if (focusRing) focusRing.visible = false;
    }
  };
  
  const onClick = (event: MouseEvent) => {
    const result = performRaycast(event.clientX, event.clientY);
    if (result) {
       selectedInfo.value = {
         visible: true,
         x: event.clientX + 15,
         y: event.clientY + 15,
         data: result.data,
         type: result.type
       };
    } else {
       // 点击空白处，隐藏信息框
       selectedInfo.value.visible = false;
    }
  }

  // 2. 双击聚焦
  const onDblClick = (event: MouseEvent) => {
    const result = performRaycast(event.clientX, event.clientY);
    if (result && core) {
      // 移动相机到目标点附近
      const targetPos = result.position.clone();
      const currentPos = core.camera.position.clone();
      
      // 计算新的相机位置：保持当前方向，但推进距离
      // 或者：移动到目标点前方固定距离
      // 简单策略：在目标点 Z 轴方向偏移一点
      const offset = new THREE.Vector3(0, 0, 40); 
      // 如果当前相机在反面，就反向偏移
      if (currentPos.z < targetPos.z) offset.z = -40;
      
      const newCamPos = targetPos.clone().add(offset);
      
      core.lookAtCameraState({
        position: newCamPos,
        target: targetPos
      }, 1500); // 1.5s 动画
    }
  }

  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('click', onClick);
  container.value.addEventListener('dblclick', onDblClick);
};

// 跳转详情页
const goToDetail = () => {
  if (!selectedInfo.value.data) return;
  const id = selectedInfo.value.type === 'shop' 
    ? (selectedInfo.value.data as Shop).shop_id 
    : (selectedInfo.value.data as Library).library_id;
  
  const path = selectedInfo.value.type === 'shop' 
    ? `/shop/detail/${id}` 
    : `/library/detail/${id}`;
    
  router.push(path);
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

    <!-- Info Card (Based on selectedInfo) -->
    <div 
      v-if="selectedInfo.visible && selectedInfo.data"
      class="fixed z-50 bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg p-4 text-white shadow-2xl backdrop-blur-md w-80 transform transition-opacity duration-150"
      :style="{ left: `${selectedInfo.x}px`, top: `${selectedInfo.y}px` }"
    >
      <!-- Shop Info -->
      <div v-if="selectedInfo.type === 'shop'" class="flex items-center gap-4 mb-3">
         <div class="w-16 h-16 flex-shrink-0 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center border-2 border-blue-500">
           <img 
            v-if="(selectedInfo.data as Shop).shop_logo" 
            :src="(selectedInfo.data as Shop).shop_logo" 
            class="w-full h-full object-cover"
            alt="logo"
          />
          <span v-else class="text-xs text-gray-500">Logo</span>
         </div>
         <div class="flex-1">
            <h3 class="font-bold text-lg text-blue-400">{{ (selectedInfo.data as Shop).shop_name }}</h3>
            <p class="text-sm text-gray-400">{{ (selectedInfo.data as Shop).shop_country === 0 ? 'China' : 'Overseas' }}</p>
         </div>
      </div>

      <!-- Library Info -->
      <div v-else class="flex items-start gap-4 mb-3">
        <div class="w-16 h-20 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
          <img 
            v-if="(selectedInfo.data as Library).cover" 
            :src="(selectedInfo.data as Library).cover" 
            class="w-full h-full object-cover"
            alt="cover"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-base text-blue-400 truncate leading-tight mb-1">{{ (selectedInfo.data as Library).name }}</h3>
          <p class="text-xs text-gray-400 truncate mb-2">
            {{ shopMap.get((selectedInfo.data as Library).shop_id!)?.shop_name || 'Unknown Shop' }}
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <div class="flex items-center gap-1">
              <span class="opacity-50">📅</span>
              <span>{{ (selectedInfo.data as Library).sale_time?.split(' ')[0] || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="opacity-50">🔥</span>
              <span>{{ (selectedInfo.data as Library).good_count || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Action Button -->
      <div class="flex justify-end pt-2 border-t border-gray-700">
        <button 
          @click.stop="goToDetail" 
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          查看详情
        </button>
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="absolute bottom-6 left-6 text-gray-600 text-xs pointer-events-none select-none">
      <p>Left Click to Select Info</p>
      <p>Double Click to Focus</p>
      <p>Left Click + Drag to Rotate</p>
      <p>Scroll to Zoom</p>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 0px;
}
</style>