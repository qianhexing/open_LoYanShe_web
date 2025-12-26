<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
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

interface DataItem {
    count: number;
    rank: number;
}

// --- 状态 ---
const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const rankList = ref<RankItem[]>([]);
const isRankExpanded = ref(true); 
const totalCount = ref(0);

// 地图相关配置
const MAP_CENTER = [104.0, 37.5]; 
const MAP_SCALE = 3.0; 

// 颜色定义 (参考旧代码)
const LOLITA_COLORS = {
  bg: 0xffffff,
  bar: '#ffaa7f', 
  text: 0x333333,
  borderChina: 0x7130ae, // 国内边框
  borderOther: 0x000000, // 国外边框
  tooltipBg: 'rgba(255, 255, 255, 0.95)',
  tooltipText: '#333333'
};

const PROVINCE_COLORS = [
    "#FADADD", "#FFC3A0", "#FFD1DC", "#FFABAB", "#FFCCCC", "#FFB7C5", "#FF9AA2", "#FF85A1", "#FF6F61", "#FFB6C1",
    "#FF69B4", "#FF1493", "#FFC0CB", "#FFA07A", "#FF7F50", "#FFD700", "#FFE4E1", "#FFE5B4", "#FFDEAD", "#FFE4C4",
    "#FFF0F5", "#FAF0E6", "#F5DEB3", "#F4C2C2", "#F8C8DC", "#F0E68C", "#F5F5DC", "#F5F5F5", "#F0FFF0", "#E6E6FA",
    "#E0FFFF", "#DDA0DD", "#D8BFD8", "#D2B48C"
];

const GRADIENT_COLORS = [
  "#7130ae", "#7740bb", "#7e51c6", "#865ccc", "#8e66d2", "#9670d7",
  "#9f7bdc", "#a784e0", "#b08fe4", "#ba99e8", "#c4a3eb", "#cdb1ef",
  "#d5b9f1", "#debff4", "#e6c5f6", "#edcdf9", "#f4d4fb", "#fadcfb",
  "#fce3fb", "#fdebfc", "#fef5fd", "#fefafd", "#fefcfe", "#fefeff",
  "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff",
  "#ffffff", "#ffffff", "#ffffff", "#ffffff"
];

const CHINA_PROVINCES = [
    '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省', 
    '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', 
    '海南省', '重庆市', '四川省', '贵州省', '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', 
    '新疆维吾尔自治区', '台湾省', '香港特别行政区', '澳门特别行政区'
];

// 交互相关
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject: THREE.Object3D | null = null;
const tooltip = ref({ visible: false, x: 0, y: 0, name: '', count: 0 });

const isMobile = ref(false);
const checkIsMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
};

const project = (lng: number, lat: number) => {
  const x = (lng - MAP_CENTER[0]) * MAP_SCALE;
  const y = (lat - MAP_CENTER[1]) * MAP_SCALE;
  return { x, y };
};

const createTextSprite = (text: string, color: string = '#333333') => {
  const canvas = document.createElement('canvas');
  const fontSize = 32;
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
  
  context.shadowColor = 'rgba(255, 255, 255, 0.8)';
  context.shadowBlur = 4;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  
  const scale = 0.12;
  sprite.scale.set(width * scale * 0.1, height * scale * 0.1, 1);
  sprite.renderOrder = 10;
  return sprite;
};

// --- 核心逻辑 ---

const loadMapData = async () => {
  try {
    const url = `${BASE_IMG}ssr/world.json`; 
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

const drawMap = (geojson: GeoJSON, scene: THREE.Scene, dataMap: Map<string, DataItem>, maxCount: number) => {
  const mapGroup = new THREE.Group();
  mapGroup.name = 'MapGroup';

  geojson.features.forEach((feature, index) => {
    const provinceName = feature.properties.name;
    const coordinates = feature.geometry.coordinates;
    const type = feature.geometry.type;
    
    // 查找数据
    let count = 0;
    let rank = 0;
    // 尝试直接匹配
    let dataItem = dataMap.get(provinceName);
    // 如果没找到，尝试模糊匹配 (dataMap key 可能只是 '上海', '北京' 等)
    if (!dataItem) {
        for (const [key, value] of dataMap.entries()) {
            if (provinceName.includes(key) || key.includes(provinceName)) {
                dataItem = value;
                break;
            }
        }
    }
    if (dataItem) {
        count = dataItem.count;
        rank = dataItem.rank;
    }

    const isChina = CHINA_PROVINCES.includes(provinceName);
    const ratio = totalCount.value > 0 ? count / totalCount.value : 0;
    
    // 旧代码逻辑：
    // depth = is_china ? Math.max(0.01, ratio * maxHeight) : 0.008
    // maxHeight = 15
    const maxHeight = 15;
    const depth = isChina ? Math.max(0.01, ratio * maxHeight) : 0.008;

    // 颜色逻辑：
    // is_china ? randColor[rank - 1] : provinceColors[index % 5]
    let baseColorHex: string | number;
    if (isChina) {
        // rank 是从 1 开始的
        if (rank > 0 && rank <= GRADIENT_COLORS.length) {
            baseColorHex = GRADIENT_COLORS[rank - 1];
        } else {
             // 默认颜色或者最后一个颜色
             baseColorHex = GRADIENT_COLORS[GRADIENT_COLORS.length - 1]; 
        }
        // 如果没有数据，且是中国省份，给一个默认浅色，或者保持渐变逻辑的最末端
        if (count === 0) baseColorHex = 0xeeeeee;
    } else {
        baseColorHex = PROVINCE_COLORS[index % PROVINCE_COLORS.length];
    }
    const baseColor = new THREE.Color(baseColorHex);

    const provinceGroup = new THREE.Group();
    provinceGroup.name = provinceName;
    (provinceGroup as any).userData = { 
        isProvince: true, 
        name: provinceName,
        count: count,
        depth: depth,
        baseColor: baseColor,
        isChina: isChina
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
        bevelEnabled: false // 旧代码 bevelEnabled: false
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // 旧代码使用 MeshLambertMaterial
      const material = new THREE.MeshLambertMaterial({
        color: baseColor,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      if (isMobile.value) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      } else {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      
      // 边框逻辑
      const borderColor = isChina ? LOLITA_COLORS.borderChina : LOLITA_COLORS.borderOther;
      const opacity = isChina ? 0.3 : 0.3; // 旧代码都是 0.3，虽然写了 borderColor = 0x000000 但 opacity 还是 0.3
      
      const lineGeometry = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ 
          color: borderColor, 
          linewidth: 1,
          transparent: true,
          opacity: opacity
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

  // Center map
  const box = new THREE.Box3().setFromObject(mapGroup);
  const center = box.getCenter(new THREE.Vector3());
  mapGroup.position.x = -center.x;
  mapGroup.position.y = -center.y;

  scene.add(mapGroup);
  return mapGroup;
};

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
      
      // 计算底座高度 (对应地图块的厚度)
      // 需要重新计算该省份的 depth
      const provRatio = totalCount.value > 0 ? count / totalCount.value : 0;
      const provinceDepth = Math.max(0.01, provRatio * 15);
      
      const zBase = provinceDepth;

      const geometry = new THREE.CylinderGeometry(0.3, 0.3, height, 16);
      const material = new THREE.MeshStandardMaterial({ 
          color: LOLITA_COLORS.bar,
          roughness: 0.6,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      if (isMobile.value) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      } else {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }

      mesh.rotation.x = Math.PI / 2;
      // Cylinder 默认中心在原点，高 h。旋转后沿 y 轴变沿 z 轴。
      // 需要向上平移 h/2 + zBase
      mesh.position.set(x, y, zBase + height / 2);
      
      const label = createTextSprite(`${item.ip_location}`, '#333333');
      const numLabel = createTextSprite(`${count}`, '#7130ae');
      
      if (label && numLabel) {
        label.position.set(x, y, zBase + height + 2.0);
        numLabel.position.set(x, y, zBase + height + 0.8);
        barGroup.add(label);
        barGroup.add(numLabel);
      }

      mesh.userData = { isBar: true, name: item.ip_location, count: count };
      barGroup.add(mesh);
      
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

const initThree = async () => {
  if (!container.value) return;

  const shanghaiGeo = [121.47, 31.23];
  
  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: -40, z: 40 },
    clearColor: LOLITA_COLORS.bg,
    alpha: false, 
    enableOrbitControls: true, 
    enableStats: false,
  });

  threeCore.value = core;
  core.mount(container.value);

  if (core.camera instanceof THREE.PerspectiveCamera) {
    core.camera.fov = 45; 
    core.camera.updateProjectionMatrix();
  }

  if (core.controls) {
      core.controls.enableRotate = false;
      core.controls.enablePan = true;
      core.controls.screenSpacePanning = true; 
      core.controls.panSpeed = 2.0; 
      core.controls.zoomSpeed = 1.2;
      core.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
      };
  }

  core.toggleBloom(false);

  // 灯光与阴影配置 (PC端开启高质量阴影)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  core.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(50, -50, 80);
  
  if (!isMobile.value) {
    dirLight.castShadow = true;
    // 增加阴影贴图分辨率
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    
    // 软化阴影
    dirLight.shadow.radius = 2;
    dirLight.shadow.bias = -0.0001;

    // 开启 PCFSoftShadowMap
    if (core.renderer) {
        (core.renderer as THREE.WebGLRenderer).shadowMap.enabled = true;
        (core.renderer as THREE.WebGLRenderer).shadowMap.type = THREE.PCFSoftShadowMap;
    }
  } else {
     // 移动端关闭
     if (core.renderer) {
        (core.renderer as THREE.WebGLRenderer).shadowMap.enabled = false;
     }
  }

  core.scene.add(dirLight);
  
  const fillLight = new THREE.DirectionalLight(0xffecd2, 0.4);
  fillLight.position.set(-50, 50, 50);
  core.scene.add(fillLight);

  const [geojson, distData] = await Promise.all([
    loadMapData(),
    getDistributedMaps().then(res => res.data)
  ]);

  if (geojson) {
    const dataMap = new Map<string, DataItem>();
    
    if (distData) {
        processData(distData);
        // 将 rank 信息也存入 Map
        // rankList 已经计算好了 rank，可以直接用 ip_location 匹配
        distData.forEach(d => {
            const rankItem = rankList.value.find(r => r.name === d.ip_location);
            dataMap.set(d.ip_location, { 
                count: d.COUNT, 
                rank: rankItem ? rankItem.rank : 999 
            });
        });
    }

    const maxCount = distData ? Math.max(...distData.map(d => d.COUNT)) : 1;
    const mapGroup = drawMap(geojson, core.scene, dataMap, maxCount);
    
    if (distData) {
      drawBars(distData, geojson, core.scene, mapGroup.position);
    }

    // 调整镜头对准上海
    const { x: rawSx, y: rawSy } = project(shanghaiGeo[0], shanghaiGeo[1]);
    const groupOffset = mapGroup.position;
    const shanghaiWorldX = rawSx + groupOffset.x;
    const shanghaiWorldY = rawSy + groupOffset.y;
    
    const cameraHeight = 50; 
    const cameraOffsetZ = 45; 
    
    if (core.controls) {
        core.controls.target.set(shanghaiWorldX, shanghaiWorldY, 0);
        core.camera.position.set(shanghaiWorldX, shanghaiWorldY - cameraOffsetZ, cameraHeight);
        core.controls.update();
    }
  }

  loading.value = false;
  core.startAnimationLoop();

  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('dblclick', onDblClick); 
};

const onDblClick = (event: MouseEvent) => {
    if (!threeCore.value || !container.value) return;
    
    const rect = container.value.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, threeCore.value.camera);
    const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);
    
    const object = intersects.find(i => i.object.type === 'Mesh')?.object;
    if (object) {
        const point = intersects.find(i => i.object === object)?.point;
        
        if (point && threeCore.value.controls) {
            const currentCamPos = threeCore.value.camera.position.clone();
            const currentTarget = threeCore.value.controls.target.clone();
            
            const offset = new THREE.Vector3().subVectors(currentCamPos, currentTarget);
            
            const targetHeight = 15; 
            const scale = targetHeight / currentCamPos.z; 
            const newOffset = offset.clone();
            if (currentCamPos.z > targetHeight) {
                 newOffset.multiplyScalar(scale);
            }
            
            const newCamPos = new THREE.Vector3().addVectors(point, newOffset);
            
            threeCore.value.lookAtCameraState({
                position: newCamPos,
                target: point
            }, 1000);
        }
    }
}

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
        if (object.parent && object.parent.userData.isProvince) {
            found = true;
            if (hoveredObject !== object) {
                if (hoveredObject) restoreObjectMaterial(hoveredObject);
                hoveredObject = object;
                
                const baseColor = object.parent.userData.baseColor || new THREE.Color(0xeeeeee);
                const hoverColor = baseColor.clone().offsetHSL(0, 0, -0.1); 

                (object as THREE.Mesh).material = new THREE.MeshLambertMaterial({
                    color: hoverColor,
                    side: THREE.DoubleSide
                });

                tooltip.value.visible = true;
                tooltip.value.name = object.parent.userData.name;
                tooltip.value.count = object.parent.userData.count;
            }
        }
        else if (object.userData.isBar) {
            found = true;
            if (hoveredObject !== object) {
                if (hoveredObject) restoreObjectMaterial(hoveredObject);
                hoveredObject = object;
                
                (object as THREE.Mesh).material = new THREE.MeshStandardMaterial({ 
                    color: 0xe74c3c,
                    transparent: true,
                    opacity: 1.0,
                    roughness: 0.6,
                    metalness: 0.1
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

const restoreObjectMaterial = (obj: THREE.Object3D) => {
    if (obj.userData.isBar) {
        (obj as THREE.Mesh).material = new THREE.MeshStandardMaterial({ 
            color: LOLITA_COLORS.bar,
            roughness: 0.6,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });
    } else if (obj.parent?.userData.isProvince) {
        const baseColor = obj.parent.userData.baseColor || new THREE.Color(0xeeeeee);
        (obj as THREE.Mesh).material = new THREE.MeshLambertMaterial({
            color: baseColor,
            side: THREE.DoubleSide
        });
    }
}


onMounted(() => {
  checkIsMobile();
  window.addEventListener('resize', checkIsMobile);
  initThree();
});

onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose();
  }
  if (container.value) {
    container.value.removeEventListener('mousemove', onMouseMove);
    container.value.removeEventListener('dblclick', onDblClick);
  }
  window.removeEventListener('resize', checkIsMobile);
});

useHead({
  title: 'Lo娘分布地图 - Lo研社',
});
</script>

<template>
  <div class="relative w-full h-screen bg-white overflow-hidden font-serif">
    <!-- 3D 容器 -->
    <div ref="container" class="w-full h-full relative z-10"></div>

    <!-- Loading -->
    <div v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-50">
      <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
      <p class="mt-4 text-purple-600 tracking-widest font-bold">正在生成星图...</p>
    </div>

    <!-- 排行榜 -->
    <div class="absolute top-4 left-4 z-40 w-[280px] bg-white/95 backdrop-blur-md rounded-xl shadow-lg overflow-hidden text-sm transition-all duration-300 border border-gray-200">
      <div 
        class="flex justify-between items-center px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50"
        @click="isRankExpanded = !isRankExpanded"
      >
        <span class="font-bold text-gray-800 flex items-center gap-2">
            <span class="text-xl">📊</span>
            分布图 样本总数: {{ totalCount }}
        </span>
        <span class="transform transition-transform duration-300 text-gray-500" :class="{ 'rotate-180': isRankExpanded }">▼</span>
      </div>

      <div v-show="isRankExpanded" class="max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div 
          v-for="item in rankList" 
          :key="item.name"
          class="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
          :class="{ 'bg-purple-50': item.rank % 2 !== 0 }"
        >
          <span 
            class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-2"
            :class="{
                'bg-yellow-400 text-yellow-900': item.rank === 1,
                'bg-gray-300 text-gray-800': item.rank === 2,
                'bg-amber-600 text-amber-100': item.rank === 3,
                'bg-purple-200 text-purple-800': item.rank > 3
            }"
          >
            {{ item.rank }}
          </span>
          <span class="flex-1 truncate text-gray-700 font-medium">{{ item.name }}</span>
          <span class="w-12 text-right text-gray-600 font-mono font-bold">{{ item.count }}</span>
          <span class="w-14 text-right text-gray-400 text-xs scale-90">{{ item.percent }}</span>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div v-if="tooltip.visible"
      class="fixed pointer-events-none z-50 px-4 py-2 bg-white/95 backdrop-blur text-gray-800 text-xs rounded-lg shadow-xl transform -translate-x-1/2 -translate-y-full mt-[-15px] border border-gray-200">
      <div class="font-bold text-purple-700 text-sm mb-1">{{ tooltip.name }}</div>
      <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400"></span>
          <span>人数: <span class="font-mono text-lg font-bold">{{ tooltip.count }}</span></span>
      </div>
    </div>
    
    <!-- 底部操作提示 -->
    <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none opacity-80">
        <div class="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-gray-600 border border-gray-200 shadow-sm flex items-center gap-4">
            <span class="flex items-center gap-1"><span class="i-heroicons-arrows-pointing-out"></span> 左键拖拽平移</span>
            <span class="flex items-center gap-1"><span class="i-heroicons-magnifying-glass"></span> 滚轮缩放</span>
            <span class="flex items-center gap-1"><span class="i-heroicons-cursor-click"></span> 双击聚焦</span>
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
  background-color: rgba(113, 48, 174, 0.2);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(113, 48, 174, 0.5);
}
</style>
