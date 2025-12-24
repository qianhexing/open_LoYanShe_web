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

// 预计算的位置数据
const layouts = {
  timeline: [] as number[],
  sphere: [] as number[],
  helix: [] as number[],
  grid: [] as number[]
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

  // --- Timeline Layout ---
  const times = libraries.map(l => new Date(l.sale_time!).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;
  const SPREAD_X = 150;
  
  layouts.timeline = [];
  libraries.forEach((lib) => {
    const time = new Date(lib.sale_time!).getTime();
    const x = ((time - minTime) / timeRange - 0.5) * SPREAD_X;
    
    // 热度影响 Y
    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0);
    const y = Math.max(-20, Math.min(20, Math.log(popularity + 1) * 3 - 10));
    const yFinal = y + (Math.random() - 0.5) * 10;
    
    const z = (Math.random() - 0.5) * 40;
    
    layouts.timeline.push(x, yFinal, z);
  });

  // --- Sphere Layout ---
  layouts.sphere = [];
  const radius = 60;
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    layouts.sphere.push(x, y, z);
  }

  // --- Helix Layout ---
  layouts.helix = [];
  for (let i = 0; i < count; i++) {
    const theta = i * 0.175 + Math.PI;
    const y = - (i * 0.05) + 30; // 这里的y作为高度
    // 如果要让它更像圆柱螺旋
    const r = 40; 
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    
    layouts.helix.push(x, y, z);
  }

  // --- Grid Layout (按店铺聚类) ---
  layouts.grid = [];
  // 简单的格子排列，或者按照店铺ID排序后排列
  // 这里我们做一个基于店铺的简单聚类：每个店铺一个球簇
  const shopClusters = new Map<number, {cx: number, cy: number, cz: number}>();
  const shopIds = Array.from(shopMap.keys());
  shopIds.forEach((id, index) => {
    // 店铺中心随机分布在空间中
    const r = 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    shopClusters.set(id, {
      cx: r * Math.sin(phi) * Math.cos(theta),
      cy: r * Math.sin(phi) * Math.sin(theta),
      cz: r * Math.cos(phi)
    });
  });

  libraries.forEach((lib) => {
    const center = shopClusters.get(lib.shop_id!) || { cx: 0, cy: 0, cz: 0 };
    // 在店铺中心周围随机偏移
    const offset = 3;
    const x = center.cx + (Math.random() - 0.5) * offset;
    const y = center.cy + (Math.random() - 0.5) * offset;
    const z = center.cz + (Math.random() - 0.5) * offset;
    layouts.grid.push(x, y, z);
  });
};

// 切换视图动画
const transitionTo = (layoutName: keyof typeof layouts, duration = 2000) => {
  currentLayout.value = layoutName;
  const targetPositions = layouts[layoutName];
  if (!targetPositions || targetPositions.length === 0) return;

  const pointsObject = threeCore.value?.scene.children.find(child => (child as any).userData?.isPointCloud) as THREE.Points;
  if (!pointsObject) return;

  const geometry = pointsObject.geometry;
  const currentPositions = geometry.attributes.position.array as Float32Array;

  // 使用 GSAP 动画化位置数组
  // 由于数组太大，直接对数组元素进行 tween 性能较差
  // 更好的方式是创建一个 dummy 对象来驱动 progress，并在 onUpdate 中插值
  
  const temp = { t: 0 };
  // 保存初始状态以便插值
  const startPositions = Float32Array.from(currentPositions);

  gsap.to(temp, {
    t: 1,
    duration: duration / 1000,
    ease: "power2.inOut",
    onUpdate: () => {
      for (let i = 0; i < currentPositions.length; i++) {
        currentPositions[i] = startPositions[i] + (targetPositions[i] - startPositions[i]) * temp.t;
      }
      geometry.attributes.position.needsUpdate = true;
    }
  });
};

const createPointCloud = () => {
  if (!threeCore.value || libraryList.value.length === 0) return;

  const scene = threeCore.value.scene;
  const libraries = libraryList.value;
  const count = libraries.length;

  calculateLayouts();

  const geometry = new THREE.BufferGeometry();
  // 初始使用 timeline 布局
  const positions = new Float32Array(layouts.timeline);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  libraries.forEach((lib, i) => {
    // Color
    const color = getShopColor(lib.shop_id!);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Size
    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0) * 2;
    sizes[i] = Math.max(0.8, Math.min(4, Math.log(popularity + 1)));
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // ShaderMaterial
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
        float dist = length(coord);
        if(dist > 0.5) discard;
        
        // 简单的光晕效果
        float strength = 1.0 - (dist * 2.0);
        strength = pow(strength, 2.0);
        
        gl_FragColor = vec4(vColor, strength);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  
  (points as any).userData = { isPointCloud: true, libraries };
};

const initThree = () => {
  if (!container.value) return;

  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: 0, z: 120 }, // 稍微远一点
    clearColor: 0x000000,
    alpha: false,
    enableStats: true,
    enableOrbitControls: true
  });
  
  // 调整相机 LookAt
  core.camera.lookAt(0, 0, 0);

  threeCore.value = core;
  core.mount(container.value);
  core.startAnimationLoop();

  // Raycaster setup
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 1.5;
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
  
  // 简单的点击事件，如果需要的话
  const onClick = (event: MouseEvent) => {
     if (hoverInfo.value.visible && hoverInfo.value.data) {
        console.log('Clicked:', hoverInfo.value.data);
        // 可以跳转到详情页
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
/* Custom Scrollbar for container if needed */
::-webkit-scrollbar {
  width: 0px;
}
</style>
