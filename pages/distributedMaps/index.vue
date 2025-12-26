<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed, watch } from 'vue';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import { getDistributedMaps, type DistributedMapData } from '@/api/statistics';
import { useHead } from '@unhead/vue';
import { BASE_IMG } from '@/utils/ipConfig';

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
const isRankExpanded = ref(true); // 排行榜展开状态，默认展开
const totalCount = ref(0);

// 地图相关配置
const MAP_CENTER = [104.0, 37.5]; // 地图中心经纬度
const MAP_SCALE = 3.0; // 缩放比例

// Lolita 风格配色
const LOLITA_COLORS = {
  bg: 0x1a1120, // 深紫色背景
  bar: 0x96D296, // 柱状图颜色 (参考旧代码 selectColor)
  text: 0xffffff,
  rankText: 0x7130ae, // 排行榜排名颜色
  border: 0xd8bfd8, // 边框浅紫色
};

// 渐变色配置：从白到深紫
// 0% (低占比) -> 100% (高占比)
// 颜色插值函数将在 drawMap 中实现

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

// 颜色插值函数：根据比例 (0-1) 获取颜色
const getGradientColor = (ratio: number) => {
  // 定义颜色节点
  const startColor = new THREE.Color(0xffffff); // 白色 (0%)
  // const midColor = new THREE.Color(0xd8bfd8);   // 浅紫 (可选中间点)
  const endColor = new THREE.Color(0x7130ae);   // 深紫 (100%) - 参考旧代码的 ranking-rank 颜色

  // 使用 HSL 插值通常比 RGB 更自然，但这里简单的 RGB 线性插值配合这种色系也不错
  // 也可以尝试 lerpHSL
  const color = startColor.clone().lerp(endColor, ratio);
  return color;
};

// 创建字体 Sprite
const createTextSprite = (text: string, color: string = '#ffffff') => {
  const canvas = document.createElement('canvas');
  const fontSize = 32; // 增大字体清晰度
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  const metrics = context.measureText(text);
  const width = metrics.width;
  const height = fontSize * 1.4;

  canvas.width = width;
  canvas.height = height;

  context.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // 添加文字阴影
  context.shadowColor = 'rgba(0, 0, 0, 0.8)';
  context.shadowBlur = 4;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;
  
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }); // 确保文字在最上层
  const sprite = new THREE.Sprite(material);
  
  // 缩放 Sprite 大小
  const scale = 0.12;
  sprite.scale.set(width * scale * 0.1, height * scale * 0.1, 1);
  sprite.renderOrder = 10; // 渲染顺序
  return sprite;
};

// --- 核心逻辑 ---

// 1. 加载地图数据
const loadMapData = async () => {
  try {
    const url = `${BASE_IMG}ssr/world.json`; 
    console.log('Loading map data from:', url);
    
    try {
        const res = await fetch(url);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('Local map data load failed, falling back to online source.', e);
    }
    
    const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();

  } catch (error) {
    console.error('Failed to load map data:', error);
    return null;
  }
};

// 2. 绘制地图
const drawMap = (geojson: GeoJSON, scene: THREE.Scene, dataMap: Map<string, number>, maxCount: number) => {
  const mapGroup = new THREE.Group();
  mapGroup.name = 'MapGroup';

  geojson.features.forEach((feature) => {
    const provinceName = feature.properties.name;
    const coordinates = feature.geometry.coordinates;
    const type = feature.geometry.type;
    
    // 获取该省份的数量
    let count = 0;
    // 模糊匹配：比如 "北京市" 匹配 "北京"
    for (const [key, value] of dataMap.entries()) {
        if (provinceName.includes(key)) {
            count = value;
            break;
        }
    }

    // 根据占比计算颜色和厚度
    const ratio = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
    // 厚度：基础 0.5，最大增加 3.0
    const depth = 0.5 + (count > 0 ? ratio * 3.0 : 0);
    // 颜色：从白到深紫 (如果 count 为 0，使用默认深色底色，或者也是白色起始？根据"区块根据占比从白渐变到深紫"，暂定 0 也是白色或极淡紫色)
    // 通常无数据的区块会给一个深色背景以示区分，但根据描述"从白渐变到深紫"，可能意味着 0 是白色，满是深紫。
    // 不过考虑到背景是深紫，如果 0 是白色会很亮。
    // 我们假设 0 也是参与渐变的起点，或者 0 可以是一个基础深色。
    // 为了美观，我们设定：有数据且 > 0 才参与渐变计算，无数据的使用基础深色。
    // 或者完全按照描述：占比 0 -> 白， 占比 1 -> 深紫。
    const baseColor = count > 0 ? getGradientColor(ratio) : new THREE.Color(0x333333); // 无数据给深灰色，避免太亮抢眼

    const provinceGroup = new THREE.Group();
    provinceGroup.name = provinceName;
    (provinceGroup as any).userData = { 
        isProvince: true, 
        name: provinceName,
        count: count,
        depth: depth,
        baseColor: baseColor // 存储基础色以便 hover 恢复
    };

    const drawPolygon = (polygon: number[][]) => {
      const shape = new THREE.Shape();
      polygon.forEach((point, i) => {
        const { x, y } = project(point[0], point[1]);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });

      const extrudeSettings = {
        depth: depth, 
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      const material = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.95,
        roughness: 0.4,
        metalness: 0.1,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // 添加发光边框线
      const lineGeometry = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ 
          color: LOLITA_COLORS.border, 
          linewidth: 1,
          transparent: true,
          opacity: 0.4
      });
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

  // 整体居中调整
  const box = new THREE.Box3().setFromObject(mapGroup);
  const center = box.getCenter(new THREE.Vector3());
  mapGroup.position.x = -center.x;
  mapGroup.position.y = -center.y;

  scene.add(mapGroup);
  return mapGroup;
};

// 3. 绘制柱状图 (保留，作为额外指示)
const drawBars = (data: DistributedMapData[], geojson: GeoJSON, scene: THREE.Scene, mapGroupOffset: THREE.Vector3) => {
  const barGroup = new THREE.Group();
  barGroup.name = 'BarGroup';
  barGroup.position.copy(mapGroupOffset);

  const maxCount = Math.max(...data.map(d => d.COUNT));

  data.forEach((item) => {
    if (item.COUNT === 0) return;

    const feature = geojson.features.find(f => f.properties.name.includes(item.ip_location));
    if (feature && feature.properties.centroid) {
      const center = feature.properties.centroid;
      const { x, y } = project(center[0], center[1]);
      
      const count = item.COUNT;
      const ratio = maxCount > 0 ? count / maxCount : 0;
      const height = ratio * 15 + 1; 
      const provinceDepth = 0.5 + ratio * 3.0;
      const zBase = provinceDepth;

      const geometry = new THREE.CylinderGeometry(0.3, 0.3, height, 16);
      const material = new THREE.MeshPhysicalMaterial({ 
          color: LOLITA_COLORS.bar,
          emissive: LOLITA_COLORS.bar,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.9
      });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, zBase + height / 2);
      
      // 添加标签
      const label = createTextSprite(`${item.ip_location}`, '#ffffff');
      const numLabel = createTextSprite(`${count}`, '#ffccff');
      
      if (label && numLabel) {
        label.position.set(x, y, zBase + height + 2.0);
        numLabel.position.set(x, y, zBase + height + 0.8);
        barGroup.add(label);
        barGroup.add(numLabel);
      }

      mesh.userData = { isBar: true, name: item.ip_location, count: count };
      barGroup.add(mesh);
      
      // 添加底部光圈
      const ringGeo = new THREE.RingGeometry(0.4, 0.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({ 
          color: LOLITA_COLORS.bar, 
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y, zBase + 0.1);
      barGroup.add(ring);
    }
  });

  scene.add(barGroup);
};

// 4. 处理数据
const processData = (data: DistributedMapData[]) => {
  const sorted = [...data].sort((a, b) => b.COUNT - a.COUNT);
  const total = sorted.reduce((sum, i) => sum + i.COUNT, 0);
  totalCount.value = total;

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
  // 目标：初始镜头对准上海
  // 上海大概坐标：121.47, 31.23
  // 我们的 project 函数是基于 map center [104.0, 37.5]
  const shanghaiGeo = [121.47, 31.23];
  const { x: sx, y: sy } = project(shanghaiGeo[0], shanghaiGeo[1]);
  
  // 地图整体被平移了 (-centerX, -centerY)
  // 我们需要在数据加载后，计算出这个偏移量，才能准确得出上海在世界坐标中的位置
  // 但我们可以在 camera lookAt 时动态调整
  
  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: -40, z: 40 }, // 初始位置稍后会被覆盖
    clearColor: LOLITA_COLORS.bg,
    alpha: false, 
    enableOrbitControls: true, 
    enableStats: false,
  });

  threeCore.value = core;
  core.mount(container.value);

  // 限制控制器
  if (core.controls) {
      core.controls.enableRotate = false;
      core.controls.enablePan = true;
      core.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
      };
      core.controls.panSpeed = 1.0;
  }

  // 开启 Bloom 效果
  core.toggleBloom(true);
  core.setBloomParams(1.5, 0.4, 0.85);

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  core.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(20, -20, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  core.scene.add(dirLight);
  
  const purpleLight = new THREE.PointLight(0xa020f0, 0.8, 200);
  purpleLight.position.set(-50, 50, 50);
  core.scene.add(purpleLight);

  // 加载数据
  const [geojson, distData] = await Promise.all([
    loadMapData(),
    getDistributedMaps().then(res => res.data)
  ]);

  if (geojson) {
    const dataMap = new Map<string, number>();
    const maxCount = distData ? Math.max(...distData.map(d => d.COUNT)) : 1;
    if (distData) {
        processData(distData);
        distData.forEach(d => dataMap.set(d.ip_location, d.COUNT));
    }

    const mapGroup = drawMap(geojson, core.scene, dataMap, maxCount);
    
    if (distData) {
      drawBars(distData, geojson, core.scene, mapGroup.position);
    }

    // --- 调整镜头对准上海 ---
    // 计算地图整体偏移
    const mapBox = new THREE.Box3().setFromObject(mapGroup);
    const mapCenter = mapBox.getCenter(new THREE.Vector3()); // 应该是 (0,0, z) 附近，因为我们在 drawMap 里把 mapGroup 归零了
    
    // 上海在 mapGroup 内部的相对坐标
    // 注意：drawMap 中我们对 mapGroup 做了 position 平移 mapGroup.position.x = -center.x
    // 所以上海的世界坐标 = 上海的原始投影坐标 + mapGroup.position
    
    // 上海投影坐标
    const { x: rawSx, y: rawSy } = project(shanghaiGeo[0], shanghaiGeo[1]);
    
    // mapGroup 的位移
    const groupOffset = mapGroup.position;
    
    // 上海的世界坐标
    const shanghaiWorldX = rawSx + groupOffset.x;
    const shanghaiWorldY = rawSy + groupOffset.y;
    
    // 设置相机目标
    // 保持 45 度视角: z = 40, y = targetY - 40
    const cameraHeight = 35;
    const cameraOffsetZ = 30; // 控制俯视角度
    
    // 我们希望相机看着上海
    if (core.controls) {
        core.controls.target.set(shanghaiWorldX, shanghaiWorldY, 0);
        core.camera.position.set(shanghaiWorldX, shanghaiWorldY - cameraOffsetZ, cameraHeight);
        core.controls.update();
    }
  }

  loading.value = false;
  core.startAnimationLoop();

  container.value.addEventListener('mousemove', onMouseMove);
};

// 鼠标移动事件
const onMouseMove = (event: MouseEvent) => {
  if (!threeCore.value || !container.value) return;

  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  tooltip.value.x = event.clientX + 15;
  tooltip.value.y = event.clientY + 15;

  raycaster.setFromCamera(mouse, threeCore.value.camera);
  
  const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);

  let found = false;
  if (intersects.length > 0) {
    const object = intersects.find(i => i.object.type === 'Mesh')?.object;
    
    if (object) {
        // 检查是否是省份板块
        if (object.parent && object.parent.userData.isProvince) {
            found = true;
            if (hoveredObject !== object) {
                // 恢复上一个
                if (hoveredObject) {
                    restoreObjectMaterial(hoveredObject);
                }

                hoveredObject = object;
                // 高亮省份 (更亮的发光)
                const baseColor = object.parent.userData.baseColor || new THREE.Color(LOLITA_COLORS.province);
                // 高亮色可以是基础色的加亮版，或者统一高亮色
                const hoverColor = baseColor.clone().offsetHSL(0, 0, 0.2); // 亮度增加

                (object as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({
                    color: hoverColor,
                    emissive: hoverColor,
                    emissiveIntensity: 0.4,
                    transparent: true,
                    opacity: 1.0,
                    roughness: 0.2,
                    metalness: 0.3,
                    side: THREE.DoubleSide
                });

                tooltip.value.visible = true;
                tooltip.value.name = object.parent.userData.name;
                tooltip.value.count = object.parent.userData.count;
            }
        }

        // 检查是否是柱状图
        else if (object.userData.isBar) {
            found = true;
            if (hoveredObject !== object) {
                 // 恢复上一个
                if (hoveredObject) {
                    restoreObjectMaterial(hoveredObject);
                }

                hoveredObject = object;
                // 高亮柱子
                (object as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({ 
                    color: 0xe74c3c,
                    emissive: 0xe74c3c,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 1.0
                });
                
                tooltip.value.visible = true;
                tooltip.value.name = object.userData.name;
                tooltip.value.count = object.userData.count;
            }
        }
    }
  }

  if (!found && hoveredObject) {
    restoreObjectMaterial(hoveredObject);
    hoveredObject = null;
    tooltip.value.visible = false;
  }
};

// 恢复物体材质
const restoreObjectMaterial = (obj: THREE.Object3D) => {
    if (obj.userData.isBar) {
        (obj as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({ 
            color: LOLITA_COLORS.bar,
            emissive: LOLITA_COLORS.bar,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });
    } else if (obj.parent?.userData.isProvince) {
        // 恢复到基础渐变色
        const baseColor = obj.parent.userData.baseColor || new THREE.Color(LOLITA_COLORS.province);
        (obj as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.95,
            roughness: 0.4,
            metalness: 0.1,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });
    }
}


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
  <div class="relative w-full h-screen bg-[#1a1120] overflow-hidden font-serif">
    <!-- 背景装饰 (模仿星空/光晕) -->
    <div class="absolute inset-0 pointer-events-none z-0">
        <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[100px]"></div>
        <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/20 blur-[100px]"></div>
    </div>

    <!-- 3D 容器 -->
    <div ref="container" class="w-full h-full relative z-10"></div>

    <!-- Loading -->
    <div v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1120]/90 backdrop-blur-sm z-50">
      <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
      <p class="mt-4 text-purple-200 tracking-widest font-bold">正在生成星图...</p>
    </div>

    <!-- 排行榜 -->
    <div class="absolute top-4 left-4 z-40 w-[280px] bg-white/90 dark:bg-[#2c1e38]/90 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden text-sm transition-all duration-300 border border-purple-200/20">
      <div 
        class="flex justify-between items-center px-4 py-3 cursor-pointer border-b border-purple-100/10 hover:bg-purple-500/10"
        @click="isRankExpanded = !isRankExpanded"
      >
        <span class="font-bold text-gray-800 dark:text-purple-100 flex items-center gap-2">
            <span class="text-xl">📊</span>
            分布图 样本总数: {{ totalCount }}
        </span>
        <span class="transform transition-transform duration-300 text-purple-300" :class="{ 'rotate-180': isRankExpanded }">▼</span>
      </div>

      <div v-show="isRankExpanded" class="max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div 
          v-for="item in rankList" 
          :key="item.name"
          class="flex items-center px-4 py-2.5 border-b border-purple-100/5 last:border-0 hover:bg-purple-500/20 transition-colors"
          :class="{ 'bg-purple-500/5': item.rank % 2 !== 0 }"
        >
          <span 
            class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-2"
            :class="{
                'bg-yellow-400 text-yellow-900': item.rank === 1,
                'bg-gray-300 text-gray-800': item.rank === 2,
                'bg-amber-600 text-amber-100': item.rank === 3,
                'bg-purple-900/50 text-purple-300': item.rank > 3
            }"
          >
            {{ item.rank }}
          </span>
          <span class="flex-1 truncate text-gray-700 dark:text-gray-200 font-medium">{{ item.name }}</span>
          <span class="w-12 text-right text-gray-500 dark:text-purple-200 font-mono font-bold">{{ item.count }}</span>
          <span class="w-14 text-right text-gray-400 dark:text-gray-500 text-xs scale-90">{{ item.percent }}</span>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div v-if="tooltip.visible"
      class="fixed pointer-events-none z-50 px-4 py-2 bg-[#2c1e38]/95 backdrop-blur text-white text-xs rounded-lg shadow-xl transform -translate-x-1/2 -translate-y-full mt-[-15px] border border-purple-400/30">
      <div class="font-bold text-purple-200 text-sm mb-1">{{ tooltip.name }}</div>
      <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400"></span>
          <span>人数: <span class="font-mono text-lg font-bold">{{ tooltip.count }}</span></span>
      </div>
    </div>
    
    <!-- 底部操作提示 -->
    <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none opacity-60">
        <div class="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white border border-white/10 flex items-center gap-4">
            <span class="flex items-center gap-1"><span class="i-heroicons-arrows-pointing-out"></span> 左键平移</span>
            <span class="flex items-center gap-1"><span class="i-heroicons-magnifying-glass"></span> 滚轮缩放</span>
        </div>
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
  background-color: rgba(139, 92, 246, 0.3);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(139, 92, 246, 0.6);
}
</style>
