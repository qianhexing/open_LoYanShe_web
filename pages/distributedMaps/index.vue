<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed, watch } from 'vue';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import { getDistributedMaps, type DistributedMapData } from '@/api/statistics';
import { useHead } from '@unhead/vue';

// --- 类型定义 ---
interface ProvinceFeature {
  type: string;
  properties: {
    adcode: number;
    name: string;
    center?: [number, number];
    centroid?: [number, number];
    childrenNum?: number;
    level?: string;
    parent?: { adcode: number };
    subFeatureIndex?: number;
    acroutes?: number[];
  };
  geometry: {
    type: string; // "Polygon" | "MultiPolygon"
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSON {
  type: string;
  features: ProvinceFeature[];
}

interface RankItem {
  rank: number;
  name: string;
  count: number;
  percent: string;
}

// --- 状态 ---
const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const rankList = ref<RankItem[]>([]);
const isRankExpanded = ref(false); // 排行榜展开状态
const totalCount = ref(0);

// 地图相关配置
const MAP_CENTER = [104.0, 37.5]; // 地图中心经纬度
const MAP_SCALE = 3.0; // 缩放比例
const PROVINCE_COLOR = 0x2c3e50; // 省份默认颜色
const PROVINCE_HOVER_COLOR = 0x34495e; // 悬停颜色
const BAR_COLOR = 0x9b59b6; // 柱状图颜色 #9b59b6 (紫色系)
const TEXT_COLOR = 0xffffff;

// 交互相关
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject: THREE.Object3D | null = null;
const tooltip = ref({ visible: false, x: 0, y: 0, name: '', count: 0 });

// --- 辅助函数 ---

// 墨卡托投影简化版 (经纬度 -> XY坐标)
const project = (lng: number, lat: number) => {
  const x = (lng - MAP_CENTER[0]) * MAP_SCALE;
  const y = (lat - MAP_CENTER[1]) * MAP_SCALE;
  return { x, y };
};

// 创建字体 (简化：使用 Canvas 贴图代替 3D 字体，避免加载字体文件慢的问题)
const createTextSprite = (text: string, color: string = '#ffffff') => {
  const canvas = document.createElement('canvas');
  const fontSize = 24;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.font = `Bold ${fontSize}px Arial`;
  const metrics = context.measureText(text);
  const width = metrics.width;
  const height = fontSize * 1.4;

  canvas.width = width;
  canvas.height = height;

  // 重新设置 font，因为改变 width/height 会重置 context
  context.font = `Bold ${fontSize}px Arial`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  
  // 缩放 Sprite 大小
  const scale = 0.15;
  sprite.scale.set(width * scale * 0.1, height * scale * 0.1, 1);
  return sprite;
};

// --- 核心逻辑 ---

// 1. 加载地图数据
const loadMapData = async () => {
  try {
    // 使用阿里云 DataV 的 GeoJSON 数据 (中国地图)
    // 也可以考虑把这个 json 下载下来放到 public 目录
    const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
    if (!res.ok) throw new Error('Network response was not ok');
    const geojson: GeoJSON = await res.json();
    return geojson;
  } catch (error) {
    console.error('Failed to load map data:', error);
    return null;
  }
};

// 2. 绘制地图
const drawMap = (geojson: GeoJSON, scene: THREE.Scene) => {
  const mapGroup = new THREE.Group();
  mapGroup.name = 'MapGroup';

  geojson.features.forEach((feature) => {
    const provinceName = feature.properties.name;
    const coordinates = feature.geometry.coordinates;
    const type = feature.geometry.type;

    const provinceGroup = new THREE.Group();
    provinceGroup.name = provinceName;
    (provinceGroup as any).userData = { isProvince: true, name: provinceName };

    const drawPolygon = (polygon: number[][]) => {
      const shape = new THREE.Shape();
      polygon.forEach((point, i) => {
        const { x, y } = project(point[0], point[1]);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });

      const extrudeSettings = {
        depth: 0.5, // 板块厚度
        bevelEnabled: false,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const material = new THREE.MeshLambertMaterial({
        color: PROVINCE_COLOR,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geometry, material);
      // 调整位置，确保 Z 轴向上
      // mesh.rotation.x = -Math.PI / 2; // 如果需要躺平
      // 这里我们保持 XY 平面，Z 轴作为高度
      
      // 添加边框线
      const lineGeometry = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
      const line = new THREE.LineSegments(lineGeometry, lineMaterial);
      
      mesh.add(line);
      provinceGroup.add(mesh);
    };

    if (type === 'Polygon') {
      coordinates.forEach((ring) => {
        drawPolygon(ring as number[][]);
      });
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((polygon) => {
        (polygon as number[][][]).forEach((ring) => {
          drawPolygon(ring);
        });
      });
    }

    mapGroup.add(provinceGroup);
  });

  // 调整地图整体位置，使其居中
  // 由于我们已经用 project 函数做过中心化处理，这里不需要大动
  scene.add(mapGroup);
  return mapGroup;
};

// 3. 绘制柱状图
const drawBars = (data: DistributedMapData[], geojson: GeoJSON, scene: THREE.Scene) => {
  const barGroup = new THREE.Group();
  barGroup.name = 'BarGroup';

  // 计算总数，用于归一化高度
  const maxCount = Math.max(...data.map(d => d.COUNT));
  const total = data.reduce((sum, d) => sum + d.COUNT, 0);
  totalCount.value = total;

  data.forEach((item) => {
    const feature = geojson.features.find(f => f.properties.name.includes(item.ip_location));
    if (feature && feature.properties.centroid) { // 使用 centroid 更准确
      const center = feature.properties.centroid; // [lng, lat]
      const { x, y } = project(center[0], center[1]);
      
      const count = item.COUNT;
      const height = (count / maxCount) * 20 + 0.1; // 最小高度 0.1

      const geometry = new THREE.CylinderGeometry(0.5, 0.5, height, 16);
      const material = new THREE.MeshLambertMaterial({ color: BAR_COLOR });
      const mesh = new THREE.Mesh(geometry, material);

      // Cylinder 默认中心在原点，我们需要把它向上移动一半高度，使其底部对齐 z=0.5 (板块表面)
      mesh.rotation.x = Math.PI / 2; // 旋转使其沿 Z 轴生长
      mesh.position.set(x, y, 0.5 + height / 2);
      
      // 添加名字和数量标签
      const label = createTextSprite(`${item.ip_location}: ${count}`);
      if (label) {
        label.position.set(x, y, 0.5 + height + 1.5);
        barGroup.add(label);
      }

      mesh.userData = { isBar: true, name: item.ip_location, count: count };
      barGroup.add(mesh);
    }
  });

  scene.add(barGroup);
};

// 4. 处理数据并生成排行榜
const processData = (data: DistributedMapData[]) => {
  const sorted = [...data].sort((a, b) => b.COUNT - a.COUNT);
  const total = sorted.reduce((sum, i) => sum + i.COUNT, 0);

  let lastCount: number | null = null;
  let lastRank = 0;
  let sameRankCount = 0;

  rankList.value = sorted.map((item, idx) => {
    if (item.COUNT === lastCount) {
      sameRankCount++;
    } else {
      lastRank = idx + 1;
      sameRankCount = 1;
      lastCount = item.COUNT;
    }
    return {
      rank: lastRank,
      name: item.ip_location,
      count: item.COUNT,
      percent: total > 0 ? ((item.COUNT / total) * 100).toFixed(2) + '%' : '0%',
    };
  });
};

// 初始化 Three.js
const initThree = async () => {
  if (!container.value) return;

  // 使用 ThreeCore 初始化
  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: 0, z: 100 }, // 初始相机位置，远一点看全貌
    clearColor: 0x111111,
    alpha: true,
    enableOrbitControls: true,
  });

  threeCore.value = core;
  core.mount(container.value);

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  core.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 50, 100);
  core.scene.add(dirLight);

  // 加载数据
  const [geojson, distData] = await Promise.all([
    loadMapData(),
    getDistributedMaps().then(res => res.data)
  ]);

  if (geojson) {
    drawMap(geojson, core.scene);
    
    if (distData) {
      processData(distData);
      drawBars(distData, geojson, core.scene);
    }
  }

  loading.value = false;
  core.startAnimationLoop();

  // 添加交互事件
  container.value.addEventListener('mousemove', onMouseMove);
};

// 鼠标移动事件
const onMouseMove = (event: MouseEvent) => {
  if (!threeCore.value || !container.value) return;

  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 更新 Tooltip 位置
  tooltip.value.x = event.clientX + 15;
  tooltip.value.y = event.clientY + 15;

  raycaster.setFromCamera(mouse, threeCore.value.camera);
  
  // 检测 Province Mesh (位于 MapGroup -> ProvinceGroup -> Mesh)
  // 或者 Bar Mesh
  const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);

  let found = false;
  if (intersects.length > 0) {
    const object = intersects[0].object;
    
    // 检查是否是省份板块
    if (object.parent && object.parent.userData.isProvince) {
      // 高亮处理...这里简化，暂不高亮，只显示 tooltip
      // const provinceName = object.parent.userData.name;
    }

    // 检查是否是柱状图
    if (object.userData.isBar) {
      found = true;
      if (hoveredObject !== object) {
        hoveredObject = object;
        // 高亮
        (object as THREE.Mesh).material = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
        
        tooltip.value.visible = true;
        tooltip.value.name = object.userData.name;
        tooltip.value.count = object.userData.count;
      }
    }
  }

  if (!found && hoveredObject) {
    // 恢复颜色
    (hoveredObject as THREE.Mesh).material = new THREE.MeshLambertMaterial({ color: BAR_COLOR });
    hoveredObject = null;
    tooltip.value.visible = false;
  }
};


onMounted(() => {
  initThree();
});

onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose();
  }
  if (container.value) {
    container.value.removeEventListener('mousemove', onMouseMove);
  }
});

useHead({
  title: 'Lo娘分布地图 - Lo研社',
});
</script>

<template>
  <div class="relative w-full h-screen bg-[#111111] overflow-hidden">
    <!-- 3D 容器 -->
    <div ref="container" class="w-full h-full relative z-10"></div>

    <!-- Loading -->
    <div v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center bg-[#111111]/90 backdrop-blur-sm z-50">
      <div class="w-16 h-16 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
      <p class="mt-4 text-purple-400 tracking-widest">正在加载地图数据...</p>
    </div>

    <!-- 排行榜 (参考 React 旧代码样式) -->
    <div class="absolute top-4 left-4 z-40 w-[280px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-xl overflow-hidden text-sm transition-all duration-300">
      <div 
        class="flex justify-between items-center px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        @click="isRankExpanded = !isRankExpanded"
      >
        <span class="font-bold text-gray-800 dark:text-gray-200">分布图 样本总数: {{ totalCount }}</span>
        <span class="transform transition-transform duration-300" :class="{ 'rotate-180': isRankExpanded }">▼</span>
      </div>

      <div v-show="isRankExpanded" class="max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div 
          v-for="item in rankList" 
          :key="item.name"
          class="flex items-center px-4 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          :class="{ 'bg-gray-50/50 dark:bg-gray-800/30': item.rank % 2 !== 0 }"
        >
          <span class="w-8 font-bold text-center text-purple-600 dark:text-purple-400">{{ item.rank }}</span>
          <span class="flex-1 truncate px-2 text-gray-700 dark:text-gray-300">{{ item.name }}</span>
          <span class="w-12 text-right text-gray-500 dark:text-gray-400 font-mono">{{ item.count }}</span>
          <span class="w-16 text-right text-gray-400 dark:text-gray-500 text-xs">{{ item.percent }}</span>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div v-if="tooltip.visible"
      class="fixed pointer-events-none z-50 px-3 py-2 bg-black/80 text-white text-xs rounded shadow-lg transform -translate-x-1/2 -translate-y-full mt-[-10px]"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }">
      <div class="font-bold">{{ tooltip.name }}</div>
      <div>人数: {{ tooltip.count }}</div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 2px;
}
</style>
