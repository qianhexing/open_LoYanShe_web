<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, shallowRef, reactive } from 'vue';
import ThreeCore from '@/utils/threeCore';
import * as THREE from 'three';
import { getShopList } from '@/api/shop';
import { getLibraryList } from '@/api/library';
import type { Shop, Library } from '@/types/api';
import gsap from 'gsap';

const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const shopMap = new Map<number, Shop>();
const libraryList = ref<Library[]>([]);
const currentLayout = ref('timeline');

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

interface LayoutData {
  libs: number[];
  shops: number[];
}

// 预计算的位置数据
const layouts: Record<string, LayoutData> = {
  timeline: { libs: [], shops: [] },
  sphere: { libs: [], shops: [] },
  helix: { libs: [], shops: [] },
  grid: { libs: [], shops: [] }
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

// 计算不同布局的坐标
const calculateLayouts = () => {
  const libraries = libraryList.value;
  const count = libraries.length;
  const shopCount = shopMap.size; // 注意：这里可能并不包含所有library引用的shop，需要处理

  // --- Timeline Layout ---
  const times = libraries.map(l => new Date(l.sale_time!).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;
  const SPREAD_X = 150;
  
  // 计算店铺在timeline中的位置 (平均时间)
  const shopTimes = new Map<number, { sum: number, count: number }>();
  
  layouts.timeline.libs = [];
  libraries.forEach((lib) => {
    const time = new Date(lib.sale_time!).getTime();
    const x = ((time - minTime) / timeRange - 0.5) * SPREAD_X;
    
    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0);
    const y = Math.max(-20, Math.min(20, Math.log(popularity + 1) * 3 - 10));
    const yFinal = y + (Math.random() - 0.5) * 10;
    
    const z = (Math.random() - 0.5) * 40;
    
    layouts.timeline.libs.push(x, yFinal, z);

    // 累加店铺时间
    if (lib.shop_id) {
      if (!shopTimes.has(lib.shop_id)) {
        shopTimes.set(lib.shop_id, { sum: 0, count: 0 });
      }
      const st = shopTimes.get(lib.shop_id)!;
      st.sum += time;
      st.count++;
    }
  });

  // 计算 Timeline 下 Shop 的位置 (对应图鉴列表的每一项，为了连线方便，我们需要知道每个图鉴对应的店铺坐标)
  // 为了性能，我们不仅计算店铺的位置，还要构建一个数组，长度和 libs 位置数组一样，
  // 其中第 i 个元素是 第 i 个图鉴所属店铺的坐标。这样 LineSegments 可以直接使用。
  // 同时，我们可能也需要渲染“店铺点”，这需要单独的数组。
  // 为了简化，我们这里只维护“每个图鉴对应的店铺位置”，用于连线。
  // 另外维护“所有店铺的位置”，用于渲染店铺粒子。
  
  // 但这样会导致数据结构复杂。
  // 简化方案：
  // 1. PointCloud (Libraries): N 个点
  // 2. Lines: N 条线 (2N 个顶点). 顶点 2i 是 Lib[i] 位置，顶点 2i+1 是 Shop[Lib[i].shop_id] 位置。
  
  // 所以 layouts.timeline.shops 应该存储：[ShopPosForLib0_X, ShopPosForLib0_Y, ShopPosForLib0_Z, ShopPosForLib1_X, ...]
  
  layouts.timeline.shops = [];
  libraries.forEach(lib => {
     let sx = 0, sy = 20, sz = 0; // 默认位置
     if (lib.shop_id && shopTimes.has(lib.shop_id)) {
        const st = shopTimes.get(lib.shop_id)!;
        const avgTime = st.sum / st.count;
        sx = ((avgTime - minTime) / timeRange - 0.5) * SPREAD_X;
        // 店铺显示在上方
        sy = 30;
        sz = 0;
     }
     layouts.timeline.shops.push(sx, sy, sz);
  });

  // --- Sphere Layout ---
  layouts.sphere.libs = [];
  layouts.sphere.shops = []; // 对应每个 lib 的 shop 位置
  const radius = 60;
  // 店铺位于球心
  libraries.forEach((lib, i) => {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    layouts.sphere.libs.push(x, y, z);
    // Shop at center
    layouts.sphere.shops.push(0, 0, 0);
  });

  // --- Helix Layout ---
  layouts.helix.libs = [];
  layouts.helix.shops = [];
  for (let i = 0; i < count; i++) {
    const theta = i * 0.175 + Math.PI;
    const y = - (i * 0.05) + 30;
    const r = 40; 
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    layouts.helix.libs.push(x, y, z);
    // Shop at axis
    layouts.helix.shops.push(0, y, 0);
  }

  // --- Grid Layout (按店铺聚类) ---
  layouts.grid.libs = [];
  layouts.grid.shops = [];
  const shopClusters = new Map<number, {cx: number, cy: number, cz: number}>();
  // 为所有出现的店铺计算位置
  // 收集所有 shop_id
  const uniqueShopIds = new Set(libraries.map(l => l.shop_id).filter(id => id));
  const uniqueShopIdsArray = Array.from(uniqueShopIds);
  
  uniqueShopIdsArray.forEach((id, index) => {
    const r = 60;
    // 均匀分布在球面上
    const phi = Math.acos(-1 + (2 * index) / uniqueShopIdsArray.length);
    const theta = Math.sqrt(uniqueShopIdsArray.length * Math.PI) * phi;
    
    shopClusters.set(id!, {
      cx: r * Math.sin(phi) * Math.cos(theta),
      cy: r * Math.sin(phi) * Math.sin(theta),
      cz: r * Math.cos(phi)
    });
  });

  libraries.forEach((lib) => {
    const center = shopClusters.get(lib.shop_id!) || { cx: 0, cy: 0, cz: 0 };
    layouts.grid.shops.push(center.cx, center.cy, center.cz);
    
    // Lib around shop
    const offset = 8; // 稍微散开一点
    const x = center.cx + (Math.random() - 0.5) * offset;
    const y = center.cy + (Math.random() - 0.5) * offset;
    const z = center.cz + (Math.random() - 0.5) * offset;
    layouts.grid.libs.push(x, y, z);
  });
};

// 切换视图动画
const transitionTo = (layoutName: keyof typeof layouts, duration = 2000) => {
  currentLayout.value = layoutName;
  const targetData = layouts[layoutName];
  if (!targetData) return;

  const pointsObject = threeCore.value?.scene.children.find(child => (child as any).userData?.isPointCloud) as THREE.Points;
  const linesObject = threeCore.value?.scene.children.find(child => (child as any).userData?.isLines) as THREE.LineSegments;
  
  if (!pointsObject || !linesObject) return;

  const pointsGeo = pointsObject.geometry;
  const currentLibPositions = pointsGeo.attributes.position.array as Float32Array;
  
  const linesGeo = linesObject.geometry;
  const currentLinePositions = linesGeo.attributes.position.array as Float32Array;

  // 记录起始状态
  const startLibPositions = Float32Array.from(currentLibPositions);
  // Lines 的位置由 Lib 和 Shop 组成。我们需要知道当前的 Shop 位置。
  // 由于 Lines 的偶数索引点就是 Lib 点，奇数索引点是 Shop 点。
  // 我们可以分别插值。
  const startLinePositions = Float32Array.from(currentLinePositions);

  const temp = { t: 0 };

  gsap.to(temp, {
    t: 1,
    duration: duration / 1000,
    ease: "power2.inOut",
    onUpdate: () => {
      // Update Lib Points
      for (let i = 0; i < currentLibPositions.length; i++) {
        currentLibPositions[i] = startLibPositions[i] + (targetData.libs[i] - startLibPositions[i]) * temp.t;
      }
      pointsGeo.attributes.position.needsUpdate = true;

      // Update Lines
      // Line positions: [L0x, L0y, L0z, S0x, S0y, S0z, L1x, L1y, L1z, S1x, S1y, S1z, ...]
      // libraries count N. line positions count 2 * N * 3.
      const count = currentLibPositions.length / 3;
      for (let i = 0; i < count; i++) {
        // Lib pos (Start of line)
        const lx = currentLibPositions[i * 3];
        const ly = currentLibPositions[i * 3 + 1];
        const lz = currentLibPositions[i * 3 + 2];
        
        // Shop pos (End of line) - need interpolation
        // Target Shop Pos
        const tsx = targetData.shops[i * 3];
        const tsy = targetData.shops[i * 3 + 1];
        const tsz = targetData.shops[i * 3 + 2];
        
        // Start Shop Pos from lines array
        const ssx = startLinePositions[i * 6 + 3];
        const ssy = startLinePositions[i * 6 + 4];
        const ssz = startLinePositions[i * 6 + 5];
        
        const csx = ssx + (tsx - ssx) * temp.t;
        const csy = ssy + (tsy - ssy) * temp.t;
        const csz = ssz + (tsz - ssz) * temp.t;

        // Set Line Vertex 0 (Lib)
        currentLinePositions[i * 6] = lx;
        currentLinePositions[i * 6 + 1] = ly;
        currentLinePositions[i * 6 + 2] = lz;

        // Set Line Vertex 1 (Shop)
        currentLinePositions[i * 6 + 3] = csx;
        currentLinePositions[i * 6 + 4] = csy;
        currentLinePositions[i * 6 + 5] = csz;
      }
      linesGeo.attributes.position.needsUpdate = true;
    }
  });
};

const createPointCloud = () => {
  if (!threeCore.value || libraryList.value.length === 0) return;

  const scene = threeCore.value.scene;
  const libraries = libraryList.value;
  const count = libraries.length;

  calculateLayouts();

  // --- Points ---
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(layouts.timeline.libs);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  libraries.forEach((lib, i) => {
    const color = getShopColor(lib.shop_id!);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Size larger
    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0) * 2;
    sizes[i] = Math.max(1.5, Math.min(6, Math.log(popularity + 1) * 1.5));
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // PointsMaterial instead of Shader for simpler non-glowing look, but with vertex colors support
  // But standard PointsMaterial creates square points unless map is used.
  // Using a simple Shader for circle points without glow.
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
        // Flat color, no glow
        gl_FragColor = vec4(vColor, 1.0); 
      }
    `,
    transparent: true,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData = { isPointCloud: true, libraries };
  scene.add(points);

  // --- Lines ---
  const lineGeometry = new THREE.BufferGeometry();
  // 2 vertices per line: [LibPos, ShopPos]
  const linePositions = new Float32Array(count * 2 * 3);
  const lineColors = new Float32Array(count * 2 * 3);

  for (let i = 0; i < count; i++) {
    // Lib Pos
    linePositions[i * 6] = layouts.timeline.libs[i * 3];
    linePositions[i * 6 + 1] = layouts.timeline.libs[i * 3 + 1];
    linePositions[i * 6 + 2] = layouts.timeline.libs[i * 3 + 2];
    
    // Shop Pos
    linePositions[i * 6 + 3] = layouts.timeline.shops[i * 3];
    linePositions[i * 6 + 4] = layouts.timeline.shops[i * 3 + 1];
    linePositions[i * 6 + 5] = layouts.timeline.shops[i * 3 + 2];

    const color = getShopColor(libraries[i].shop_id!);
    // Lib Vertex Color
    lineColors[i * 6] = color.r;
    lineColors[i * 6 + 1] = color.g;
    lineColors[i * 6 + 2] = color.b;
    
    // Shop Vertex Color (Fade out or same?)
    // Let's make it slightly darker near shop center for depth or same color
    lineColors[i * 6 + 3] = color.r * 0.5;
    lineColors[i * 6 + 4] = color.g * 0.5;
    lineColors[i * 6 + 5] = color.b * 0.5;
  }

  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3, // Faint lines
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
    cameraPosition: { x: 0, y: 0, z: 150 },
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
  raycaster.params.Points.threshold = 2; // Increase threshold for larger points
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
      <div class="text-xl tracking-widest">LOADING DATAALAXY</div>
    </div>

    <!-- UI Overlay -->
    <div class="absolute top-6 left-6 z-40">
      <h1 class="text-2xl font-bold text-white mb-1 tracking-wider">SHOP GALAXY</h1>
      <p class="text-gray-400 text-sm mb-6">{{ libraryList.length }} Libraries | {{ shopMap.size }} Shops</p>
      
      <div class="flex flex-col gap-2">
        <button 
          v-for="layout in ['timeline', 'sphere', 'helix', 'grid']" 
          :key="layout"
          @click="transitionTo(layout as any)"
          class="px-4 py-2 text-left bg-gray-900 bg-opacity-60 border border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 hover:bg-blue-900 hover:bg-opacity-30 transition-all rounded text-sm uppercase tracking-wide"
          :class="{ 'border-blue-500 bg-blue-900 bg-opacity-30 text-white': currentLayout === layout }"
        >
          {{ layout }} View
        </button>
      </div>
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
