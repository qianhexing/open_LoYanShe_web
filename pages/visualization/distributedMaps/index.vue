<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import { getDistributedMaps, type DistributedMapData } from '@/api/statistics';
import type { PhysicalShop } from '@/types/api';
import { useHead } from '@unhead/vue';
import { BASE_IMG } from '@/utils/ipConfig';
import dayjs from 'dayjs';
import TimeRuler from '@/components/TimeRuler.vue';

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
const shopLoading = ref(false); // 实体店加载状态
const rankList = ref<RankItem[]>([]);
const isRankExpanded = ref(false); // 排行榜默认不展开
const totalCount = ref(0);
// 存储最大数量，用于计算比例
const maxCountVal = ref(1);
// 控制圆柱和数字的显示
const showBars = ref(true);
// 控制实体店的显示
const showShops = ref(false);
// 控制光影（阴影）的显示，手机端默认不启用
const showShadows = ref(false);
// 存储圆柱组的引用
let barGroup: THREE.Group | null = null;
// 存储实体店组的引用
let shopGroup: THREE.Group | null = null;
// 存储地图组的引用（用于实体店定位）
let mapGroup: THREE.Group | null = null;
// 存储地图数据，用于计算高度
let cachedGeoJson: GeoJSON | null = null;
let cachedDataMap: Map<string, DataItem> | null = null;
let cachedMaxCount = 1;
// 存储方向光引用，用于切换阴影
let dirLightRef: THREE.DirectionalLight | null = null;
// 跟踪是否已经添加了阴影更新回调
let shadowUpdateCallbackAdded = false;

// 时间选择器相关
const currentDate = ref(new Date());
const formattedDate = ref(dayjs().format('YYYY-MM-DD'));
const showDateToast = ref(false);
let dateToastTimer: NodeJS.Timeout | null = null;

const handleDateChange = (date: Date) => {
  const fDate = dayjs(date).format('YYYY-MM-DD');
  formattedDate.value = fDate;
  
  // 显示日期提示
  showDateToast.value = true;
  if (dateToastTimer) clearTimeout(dateToastTimer);
  dateToastTimer = setTimeout(() => {
    showDateToast.value = false;
  }, 2000);
};

// 更新方向光位置和阴影相机（模块级别，供切换阴影时使用）
const updateDirLightForShadow = () => {
  if (!threeCore.value?.controls || !dirLightRef) return;
  
  const target = threeCore.value.controls.target;
  const cameraPos = threeCore.value.camera.position;
  
  if (dirLightRef.shadow.camera && showShadows.value) {
    const direction = new THREE.Vector3().subVectors(target, cameraPos).normalize();
    const lightDistance = 100;
    const lightHeight = 80;
    const lightPosition = target.clone();
    lightPosition.addScaledVector(direction, -lightDistance);
    lightPosition.z += lightHeight;
    
    dirLightRef.target.position.copy(target);
    
    const distance = cameraPos.distanceTo(target);
    const fov = threeCore.value.camera instanceof THREE.PerspectiveCamera ? threeCore.value.camera.fov * (Math.PI / 180) : Math.PI / 4;
    const height = 2 * Math.tan(fov / 2) * distance;
    const width = height * (threeCore.value.camera instanceof THREE.PerspectiveCamera ? threeCore.value.camera.aspect : 1);
    
    const margin = 1.5;
    dirLightRef.shadow.camera.left = -width * margin / 2;
    dirLightRef.shadow.camera.right = width * margin / 2;
    dirLightRef.shadow.camera.top = height * margin / 2;
    dirLightRef.shadow.camera.bottom = -height * margin / 2;
    dirLightRef.shadow.camera.near = 0.1;
    dirLightRef.shadow.camera.far = Math.max(distance * 2, 200);
    dirLightRef.shadow.camera.position.copy(lightPosition);
    dirLightRef.shadow.camera.lookAt(target);
    dirLightRef.shadow.camera.updateProjectionMatrix();
  }
};
// 实体店弹窗
const shopModalVisible = ref(false);
const selectedShopCluster = ref<PhysicalShop[]>([]);

// 模拟实体店数据
const mockPhysicalShops: PhysicalShop[] = [
  {
    physical_id: 1,
    physical_name: '上海实体店',
    latitude: 31.23,
    longitude: 121.47,
    physical_logo: '/images/shop1.jpg'
  },
  {
    physical_id: 2,
    physical_name: '北京实体店',
    latitude: 39.90,
    longitude: 116.40,
    physical_logo: '/images/shop2.jpg'
  },
  {
    physical_id: 3,
    physical_name: '广州实体店',
    latitude: 23.13,
    longitude: 113.26,
    physical_logo: '/images/shop3.jpg'
  },
  {
    physical_id: 4,
    physical_name: '深圳实体店',
    latitude: 22.54,
    longitude: 114.07,
    physical_logo: '/images/shop4.jpg'
  },
  {
    physical_id: 5,
    physical_name: '成都实体店',
    latitude: 30.67,
    longitude: 104.06,
    physical_logo: '/images/shop5.jpg'
  }
];

// 地图相关配置
const MAP_CENTER = [104.0, 37.5]; 
const MAP_SCALE = 3.0; 

// 颜色定义 (参考旧代码)
const LOLITA_COLORS = {
  bg: 0xffffff,
  bar: '#FFC0CB', // 改为淡粉色 (Pink / LightPink)
  text: 0x333333,
  borderChina: 0x7130ae, // 国内边框
  borderOther: 0x000000, // 国外边框
  tooltipBg: 'rgba(255, 255, 255, 0.95)',
  tooltipText: '#333333',
  highlight: '#cdb1ef', // 淡紫色高亮
  highlightBar: '#cdb1ef' // 圆柱高亮淡紫
};

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
// 鼠标移动检测相关变量
let mouseHasMoved = false;
let mouseDownX = 0;
let mouseDownY = 0;
const MOUSE_MOVE_THRESHOLD = 5; // 鼠标移动阈值（像素）

const isMobile = ref(false);
const checkIsMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // 手机端默认不启用阴影
    if (isMobile.value) {
      showShadows.value = false;
    } else {
      showShadows.value = true;
    }
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

// 创建圆形图片 Sprite（用于实体店logo，30x30像素）
const createCircularImageSprite = (imageUrl: string): Promise<THREE.Sprite | null> => {
  return new Promise((resolve) => {
    const size = 30; // 30x30像素
    
    // 创建圆形占位符的函数
    const createPlaceholder = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      
      // 绘制圆形背景
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#7130ae';
      ctx.fill();
      
      // 绘制图标
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏪', size / 2, size / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.5, 1.5, 1); // 约30像素大小
      sprite.renderOrder = 10;
      return sprite;
    };
    
    // 如果没有图片URL，直接返回占位符
    if (!imageUrl) {
      resolve(createPlaceholder());
      return;
    }
    
    // 加载图片
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // 创建圆形遮罩的canvas
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(createPlaceholder());
        return;
      }
      
      // 创建圆形路径并裁剪
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, size, size);
      
      const circularTexture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ 
        map: circularTexture, 
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.5, 1.5, 1); // 约30像素大小
      sprite.renderOrder = 10;
      resolve(sprite);
    };
    
    img.onerror = () => {
      // 加载失败时返回占位符
      resolve(createPlaceholder());
    };
    
    img.src = imageUrl;
  });
};

// 生成粒子纹理 (星星/心形)
const createParticleTexture = (type: 'star' | 'heart' = 'star') => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#ffffff';
  
  if (type === 'star') {
    // 绘制星星
    const cx = 32, cy = 32, spikes = 5, outerRadius = 30, innerRadius = 15;
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    
    // 添加发光效果
    ctx.shadowBlur = 5; // 降低阴影模糊，减少发光
    ctx.shadowColor = "rgba(255, 255, 255, 0.5)"; // 降低发光强度
    ctx.fill();
  } else {
    // 绘制心形
    ctx.beginPath();
    const topCurveHeight = 20; // 调整心形顶部曲线高度
    ctx.moveTo(32, 58);
    ctx.bezierCurveTo(32, 55, 10, 40, 10, 25); // 左下控制点，左上控制点，左上结束点
    ctx.bezierCurveTo(10, 10, 32, 10, 32, 25); // 左上顶部控制点，中上控制点，中间凹陷点
    ctx.bezierCurveTo(32, 10, 54, 10, 54, 25); // 中上控制点，右上顶部控制点，右上结束点
    ctx.bezierCurveTo(54, 40, 32, 55, 32, 58); // 右上控制点，右下控制点，底部点
    ctx.closePath();
    ctx.shadowBlur = 5; // 降低阴影模糊
    ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// 添加背景星空
const addBackgroundStars = () => {
  if (!threeCore.value) return;
  
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 1000;
  const posArray = new Float32Array(starsCount * 3);
  
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 400; // 广阔背景
  }
  
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const material = new THREE.PointsMaterial({
    size: 0.8,
    color: 0xE6E6FA, // 浅紫
    transparent: true,
    opacity: 0.4, 
    map: createParticleTexture('star'),
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const starField = new THREE.Points(starsGeometry, material);
  threeCore.value.scene.add(starField);
};

// --- 核心逻辑 ---

// 颜色插值函数：根据 Rank 计算渐变色
const getInterpolatedColor = (rank: number, maxRank: number) => {
    // 排名越前(rank小) 颜色越深(index小)
    // 排名越后(rank大) 颜色越浅(index大)
    
    // 如果只有1个数据，直接用最深色
    if (maxRank <= 1) return new THREE.Color(GRADIENT_COLORS[0]);
    
    // 计算在整个渐变数组中的位置 (0 ~ 1)
    // rank: 1 ~ maxRank
    // ratio: 0 ~ 1
    const ratio = Math.max(0, Math.min(1, (rank - 1) / (maxRank - 1)));
    
    // 映射到 GRADIENT_COLORS 的索引区间
    const maxIndex = GRADIENT_COLORS.length - 1;
    const position = ratio * maxIndex;
    
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const t = position - lowerIndex;
    
    const color1 = new THREE.Color(GRADIENT_COLORS[lowerIndex]);
    const color2 = new THREE.Color(GRADIENT_COLORS[upperIndex]);
    
    return color1.clone().lerp(color2, t);
};

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

  // 获取总排名数（有数据的地区数量）
  const totalRanks = rankList.value.length;

  geojson.features.forEach((feature, index) => {
    const provinceName = feature.properties.name;
    const coordinates = feature.geometry.coordinates;
    const type = feature.geometry.type;
    
    // 查找数据
    let count = 0;
    let rank = 0;
    let dataItem = dataMap.get(provinceName);
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
    const ratio = maxCount > 0 ? count / maxCount : 0;
    
    // 最大高度调整为 6 (10 的 2/3 左右)，减小高低错落感
    const maxHeight = 6;
    const depth = Math.max(0.01, ratio * maxHeight);

    // 颜色逻辑：如果有数据，则根据全球排名计算插值渐变色；无数据则为浅灰
    let baseColor: THREE.Color;
    if (count > 0) {
        baseColor = getInterpolatedColor(rank, totalRanks);
    } else {
        baseColor = new THREE.Color(0xeeeeee);
    }

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
        bevelEnabled: false 
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.computeVertexNormals(); 

      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.castShadow = showShadows.value;
      mesh.receiveShadow = showShadows.value;
      
      // 边框逻辑
      const borderColor = isChina ? LOLITA_COLORS.borderChina : LOLITA_COLORS.borderOther;
      const opacity = 0.3; 
      
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

  const box = new THREE.Box3().setFromObject(mapGroup);
  const center = box.getCenter(new THREE.Vector3());
  mapGroup.position.x = -center.x;
  mapGroup.position.y = -center.y;

  scene.add(mapGroup);
  return mapGroup;
};

// 辅助函数：计算几何中心
const getGeometryCenter = (coordinates: any[], type: string): [number, number] | null => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    
    const updateBounds = (ring: number[][]) => {
        ring.forEach(pt => {
            if (pt[0] < xMin) xMin = pt[0];
            if (pt[0] > xMax) xMax = pt[0];
            if (pt[1] < yMin) yMin = pt[1];
            if (pt[1] > yMax) yMax = pt[1];
        });
    };

    if (type === 'Polygon') {
        (coordinates as number[][][]).forEach(ring => updateBounds(ring));
    } else if (type === 'MultiPolygon') {
        (coordinates as number[][][][]).forEach(polygon => {
            polygon.forEach(ring => updateBounds(ring));
        });
    }

    if (xMin === Infinity) return null;
    return [(xMin + xMax) / 2, (yMin + yMax) / 2];
};

const drawBars = (data: DistributedMapData[], geojson: GeoJSON, scene: THREE.Scene, mapGroupOffset: THREE.Vector3) => {
  // 如果已存在，先移除
  if (barGroup) {
    scene.remove(barGroup);
    barGroup = null;
  }
  
  barGroup = new THREE.Group();
  barGroup.name = 'BarGroup';
  barGroup.position.copy(mapGroupOffset);

  const maxCount = Math.max(...data.map(d => d.COUNT));
  // biome-ignore lint/complexity/noForEach: <explanation>
  data.forEach((item) => {
    // 确保有数据的区块都生成圆柱
    if (item.COUNT === 0) return;

    // 尝试匹配 feature (增强匹配逻辑)
    let feature = geojson.features.find(f => f.properties.name === item.ip_location);
    if (!feature) {
        feature = geojson.features.find(f => f.properties.name.includes(item.ip_location) || item.ip_location.includes(f.properties.name));
    }

    if (feature) {
        let center: [number, number] | undefined = feature.properties.centroid;
        // 如果没有 centroid，尝试 center，或者手动计算
        if (!center) {
            if (feature.properties.center) {
                center = feature.properties.center;
            } else {
                const computed = getGeometryCenter(feature.geometry.coordinates, feature.geometry.type);
                if (computed) center = computed;
            }
        }

        if (center) {
            const { x, y } = project(center[0], center[1]);
            
            const count = item.COUNT;
            const ratio = maxCount > 0 ? count / maxCount : 0;
            // 缩短高度比：系数从 15 改为 8
            const height = ratio * 8 + 1; 
            
            // 重新计算底座高度，保持和 drawMap 里的逻辑一致
            const mapRatio = maxCount > 0 ? count / maxCount : 0;
            const maxHeight = 6; 
            const provinceDepth = Math.max(0.01, mapRatio * maxHeight);
            
            const zBase = provinceDepth;

            // 加粗圆柱：半径从 0.3 改为 0.6
            const geometry = new THREE.CylinderGeometry(0.6, 0.6, height, 16);
            const material = new THREE.MeshStandardMaterial({ 
                color: LOLITA_COLORS.bar,
                roughness: 0.6,
                metalness: 0.1,
                transparent: true,
                opacity: 0.9
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.castShadow = showShadows.value;
            mesh.receiveShadow = showShadows.value;

            mesh.rotation.x = Math.PI / 2;
            mesh.position.set(x, y, zBase + height / 2);
            
            // 添加圆柱边框
            const edges = new THREE.EdgesGeometry(geometry);
            const borderMaterial = new THREE.LineBasicMaterial({ 
                color: 0xfaa2ae, // 浅粉色边框
                linewidth: 1, 
                opacity: 1, 
                transparent: true 
            });
            const border = new THREE.LineSegments(edges, borderMaterial);
            mesh.add(border);

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
            
            const ringGeo = new THREE.RingGeometry(0.7, 0.9, 32); 
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
    }
  });

  // 根据状态决定是否添加到场景
  if (showBars.value) {
    scene.add(barGroup);
  }
};

// 切换圆柱和数字的显示
const toggleBars = () => {
  showBars.value = !showBars.value;
  if (!threeCore.value || !barGroup) return;
  
  const existsInScene = threeCore.value.scene.children.includes(barGroup);
  
  if (showBars.value && !existsInScene) {
    threeCore.value.scene.add(barGroup);
  } else if (!showBars.value && existsInScene) {
    threeCore.value.scene.remove(barGroup);
  }
};

// 切换光影（阴影）的显示
const toggleShadows = () => {
  showShadows.value = !showShadows.value;
  if (!threeCore.value) return;
  
  const renderer = threeCore.value.renderer as THREE.WebGLRenderer;
  if (renderer) {
    renderer.shadowMap.enabled = showShadows.value;
    if (showShadows.value) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }
  
  if (dirLightRef) {
    dirLightRef.castShadow = showShadows.value;
    if (showShadows.value) {
      dirLightRef.shadow.mapSize.width = 2048;
      dirLightRef.shadow.mapSize.height = 2048;
      dirLightRef.shadow.radius = 4;
      dirLightRef.shadow.bias = -0.0001;
    }
  }
  
  // 更新场景中所有mesh的阴影设置
  threeCore.value.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      // 只更新地图和圆柱的阴影，不包括其他对象（如辅助器等）
      if (object.userData.isProvince || object.userData.isBar) {
        
      }
      object.castShadow = showShadows.value;
      object.receiveShadow = showShadows.value;
    }
  });
  
  // 如果启用了阴影，需要添加更新回调（如果还没有添加的话）
  if (showShadows.value && threeCore.value.controls && dirLightRef && !shadowUpdateCallbackAdded) {
    // 添加事件监听和动画回调（只添加一次）
    threeCore.value.controls.addEventListener('change', updateDirLightForShadow);
    threeCore.value.addAnimationCallback(updateDirLightForShadow);
    shadowUpdateCallbackAdded = true;
  }
  
  // 如果启用了阴影，立即更新一次阴影相机
  if (showShadows.value) {
    
  }
  updateDirLightForShadow();
};

// 实体店聚类接口
interface ShopCluster {
  shops: PhysicalShop[];
  centerX: number;
  centerY: number;
  centerLng: number;
  centerLat: number;
}

// 计算两个实体店之间的距离（3D空间距离）
const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

// 实体店聚类算法（基于距离）
const clusterShops = (shops: PhysicalShop[], threshold: number = 5): ShopCluster[] => {
  const clusters: ShopCluster[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < shops.length; i++) {
    if (processed.has(i) || !shops[i].latitude || !shops[i].longitude) continue;
    
    const shop = shops[i];
    const { x, y } = project(shop.longitude, shop.latitude);
    
    // 创建新聚类
    const cluster: ShopCluster = {
      shops: [shop],
      centerX: x,
      centerY: y,
      centerLng: shop.longitude!,
      centerLat: shop.latitude!
    };
    processed.add(i);
    
    // 查找附近的实体店
    for (let j = i + 1; j < shops.length; j++) {
      if (processed.has(j) || !shops[j].latitude || !shops[j].longitude) continue;
      
      const otherShop = shops[j];
      const { x: x2, y: y2 } = project(otherShop.longitude!, otherShop.latitude!);
      const distance = calculateDistance(x, y, x2, y2);
      
      if (distance < threshold) {
        cluster.shops.push(otherShop);
        processed.add(j);
        // 更新聚类中心（平均值）
        cluster.centerX = (cluster.centerX * (cluster.shops.length - 1) + x2) / cluster.shops.length;
        cluster.centerY = (cluster.centerY * (cluster.shops.length - 1) + y2) / cluster.shops.length;
        cluster.centerLng = (cluster.centerLng * (cluster.shops.length - 1) + otherShop.longitude!) / cluster.shops.length;
        cluster.centerLat = (cluster.centerLat * (cluster.shops.length - 1) + otherShop.latitude!) / cluster.shops.length;
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
};

// 获取地图上某个位置的高度
const getMapHeightAtLocation = (lng: number, lat: number, geojson: GeoJSON | null, dataMap: Map<string, DataItem> | null, maxCount: number): number => {
  if (!geojson || !dataMap) {
    return 0.5; // 默认高度
  }
  
  // 查找包含该经纬度的省份
  for (const feature of geojson.features) {
    const provinceName = feature.properties.name;
    const coordinates = feature.geometry.coordinates;
    const type = feature.geometry.type;
    
    // 检查点是否在多边形内（简化版：检查是否在边界框内）
    let isInside = false;
    
    if (type === 'Polygon') {
      const polygon = coordinates[0] as number[][];
      isInside = pointInPolygon([lng, lat], polygon);
    } else if (type === 'MultiPolygon') {
      for (const polygon of coordinates as number[][][]) {
        if (pointInPolygon([lng, lat], polygon[0])) {
          isInside = true;
          break;
        }
      }
    }
    
    if (isInside) {
      // 找到对应的省份，计算高度
      let dataItem = dataMap.get(provinceName);
      if (!dataItem) {
        for (const [key, value] of dataMap.entries()) {
          if (provinceName.includes(key) || key.includes(provinceName)) {
            dataItem = value;
            break;
          }
        }
      }
      
      const count = dataItem?.count || 0;
      const ratio = maxCount > 0 ? count / maxCount : 0;
      const maxHeight = 6;
      const depth = Math.max(0.01, ratio * maxHeight);
      return depth;
    }
  }
  
  return 0.5; // 默认高度
};

// 简化的点在多边形内判断（射线法）
const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > point[1]) !== (yj > point[1])) && 
                      (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// 绘制实体店（只绘制一次，之后缓存）
const drawPhysicalShops = async (
  shops: PhysicalShop[], 
  scene: THREE.Scene, 
  mapGroupOffset: THREE.Vector3,
  geojson: GeoJSON | null = null,
  dataMap: Map<string, DataItem> | null = null,
  maxCount: number = 1,
  effectManager?: any // EffectManager 实例，用于添加描边特效
) => {
  // 如果已存在，直接返回（使用缓存）
  if (shopGroup) {
    return;
  }
  
  // 开始加载
  shopLoading.value = true;
  
  try {
    shopGroup = new THREE.Group();
    shopGroup.name = 'PhysicalShopGroup';
    shopGroup.position.copy(mapGroupOffset);
    
    // 对实体店进行聚类
    const clusters = clusterShops(shops, 5); // 阈值5个单位距离
    
    for (const cluster of clusters) {
    const { x, y } = project(cluster.centerLng, cluster.centerLat);
    // 计算该位置的地图高度
    const mapHeight = getMapHeightAtLocation(cluster.centerLng, cluster.centerLat, geojson, dataMap, maxCount);
    const zBase = mapHeight; // 使用地图高度作为基础高度
    
    if (cluster.shops.length === 1) {
      // 单个实体店，正常显示
      const shop = cluster.shops[0];
      
      // 创建店铺logo Sprite（30x30圆形）
      const logoUrl = shop.physical_logo ? `${BASE_IMG}${shop.physical_logo}` : '';
      const logoSprite = await createCircularImageSprite(logoUrl || '');
      if (logoSprite) {
        logoSprite.position.set(x, y, zBase + 1);
        logoSprite.userData = { isPhysicalShop: true, shop: shop, cluster: cluster.shops };
        shopGroup.add(logoSprite);
      }
      
      // 创建店铺名称标签（在logo上方居中）
      if (shop.physical_name) {
        const nameLabel = createTextSprite(shop.physical_name, '#7130ae');
        if (nameLabel) {
          nameLabel.position.set(x, y, zBase + 2.5);
          shopGroup.add(nameLabel);
        }
      }
    } else {
      // 多个实体店合并，显示大圆
      const clusterSize = Math.min(2 + cluster.shops.length * 0.3, 5); // 根据数量调整大小，最大5
      const radius = clusterSize / 2;
      const clusterGeometry = new THREE.SphereGeometry(radius, 32, 32);
      
      // 粉色材质
      const clusterMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff9eb5,
        transparent: true,
        opacity: 0.8
      });
      const clusterMesh = new THREE.Mesh(clusterGeometry, clusterMaterial);
      // 大圆位置：地图高度 + 大圆半径，确保显示在地图上方
      clusterMesh.position.set(x, y, zBase + radius);
      clusterMesh.userData = { isShopCluster: true, cluster: cluster.shops };
      shopGroup.add(clusterMesh);
      
      // 使用 ToonOutlineEffect 添加白色描边
      if (effectManager) {
        try {
          await effectManager.addEffect('ToonOutlineEffect', clusterMesh, {
            color: '#ffffff', // 白色描边
            opacity: 1.0,
            pixelWidth: 2.0
          });
        } catch (error) {
          console.warn('添加描边特效失败:', error);
          // 如果特效添加失败，使用备用方案：EdgesGeometry
          const edgesGeometry = new THREE.EdgesGeometry(clusterGeometry);
          const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2
          });
          const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          edges.position.set(x, y, zBase + radius);
          shopGroup.add(edges);
        }
      } else {
        // 如果没有 effectManager，使用备用方案
        const edgesGeometry = new THREE.EdgesGeometry(clusterGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
          color: 0xffffff,
          linewidth: 2
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.position.set(x, y, zBase + radius);
        shopGroup.add(edges);
      }
      
      // 显示数量标签（位置与大圆相同，白色文字）
      const countLabel = createTextSprite(`${cluster.shops.length}实体店`, '#ffffff');
      if (countLabel) {
        countLabel.position.set(x, y, zBase + radius);
        shopGroup.add(countLabel);
      }
    }
    
    // 创建标记点（小圆点）- 用于点击检测
    const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x7130ae,
      transparent: true,
      opacity: 0.8
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, y, zBase);
    marker.userData = { 
      isPhysicalShop: cluster.shops.length === 1, 
      isShopCluster: cluster.shops.length > 1,
      shop: cluster.shops.length === 1 ? cluster.shops[0] : null,
      cluster: cluster.shops 
    };
      shopGroup.add(marker);
    }
    
    // 根据状态决定是否添加到场景
    if (showShops.value) {
      scene.add(shopGroup);
    }
  } finally {
    // 加载完成
    shopLoading.value = false;
  }
};

// 切换实体店显示（只控制显示隐藏，不重新绘制）
const toggleShops = async () => {
  showShops.value = !showShops.value;
  
  if (!threeCore.value) return;
  
  // 如果实体店组不存在，需要先绘制（只绘制一次）
  if (!shopGroup && mapGroup) {
    await drawPhysicalShops(
      mockPhysicalShops, 
      threeCore.value.scene, 
      mapGroup.position,
      cachedGeoJson,
      cachedDataMap,
      cachedMaxCount,
      threeCore.value.effectManager
    );
  }
  
  // 控制显示隐藏
  if (shopGroup) {
    const existsInScene = threeCore.value.scene.children.includes(shopGroup);
    
    if (showShops.value && !existsInScene) {
      threeCore.value.scene.add(shopGroup);
    } else if (!showShops.value && existsInScene) {
      threeCore.value.scene.remove(shopGroup);
    }
  }
};

const processData = (data: DistributedMapData[]) => {
  const sorted = [...data].sort((a, b) => b.COUNT - a.COUNT);
  const total = sorted.reduce((sum, i) => sum + i.COUNT, 0);
  totalCount.value = total;
  maxCountVal.value = sorted.length > 0 ? sorted[0].COUNT : 1;

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
      // 手机端触摸控制配置（OrbitControls 默认支持触摸平移和缩放）
      if ('touches' in core.controls) {
        (core.controls as any).touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
      }
  }

  core.toggleBloom(false);

  // 灯光与阴影配置 (PC端开启高质量阴影)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  core.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLightRef = dirLight; // 保存引用，用于切换阴影

  dirLight.position.set(300, 0, 50);
  // 辅助器变量
  let dirLightHelper: THREE.DirectionalLightHelper | null = null;
  let shadowCameraHelper: THREE.CameraHelper | null = null;
  
  // 更新方向光位置，使其指向相机观察的目标点
  const updateDirLight = () => {
    if (!core.controls || !showShadows.value) return;
    
    const target = core.controls.target;
    const cameraPos = core.camera.position;
    // 计算从相机到目标的方向
    const direction = new THREE.Vector3().subVectors(target, cameraPos).normalize();
    
    // 方向光位置：在相机上方一定距离，沿相机到目标的方向偏移
    const lightDistance = 100; // 光源距离目标的距离
    const lightHeight = 80; // 光源在目标上方的垂直高度
    
    // 计算光源位置：从目标点沿方向反方向偏移，并加上垂直高度
    const lightPosition = target.clone();
    lightPosition.addScaledVector(direction, -lightDistance);
    lightPosition.z += lightHeight;
    
    dirLight.target.position.copy(core.controls.target);
    // position.copy(lightPosition);
    
    // 更新方向光辅助器
    if (dirLightHelper) {
      dirLightHelper.update();
    }
    
    // 更新阴影相机（使用模块级别的函数）
    updateDirLightForShadow();
    
    // 更新阴影相机辅助器
    if (shadowCameraHelper && showShadows.value) {
      shadowCameraHelper.update();
    }
  };
  
  // 根据showShadows设置阴影
  // 注意：即使默认不启用，也要初始化阴影配置，以便后续切换时能正常工作
  dirLight.castShadow = true;
  // 始终初始化阴影配置，这样切换时才能正常工作
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.radius = 4;
  dirLight.shadow.bias = -0.0001;
  
  if (core.renderer) {
    const renderer = core.renderer as THREE.WebGLRenderer;
    renderer.shadowMap.enabled = true;
    // 始终设置阴影类型，以便切换时能正常工作
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  
  // 监听控制器变化，实时更新方向光（仅在启用阴影时）
  if (showShadows.value && core.controls) {
    
  }
  core.controls.addEventListener('change', updateDirLight);
    // 在动画循环中更新
    core.addAnimationCallback(updateDirLight);
    shadowUpdateCallbackAdded = true;

  core.scene.add(dirLight);
  
  // 即使默认不启用阴影，也要初始化阴影相机配置（手机端也需要）
  // 这样当用户在手机端切换阴影时，阴影相机已经正确配置
  if (core.controls && dirLight.shadow.camera) {
    // 初始化阴影相机配置
    const target = core.controls.target;
    const cameraPos = core.camera.position;
    const distance = cameraPos.distanceTo(target);
    const fov = core.camera instanceof THREE.PerspectiveCamera ? core.camera.fov * (Math.PI / 180) : Math.PI / 4;
    const height = 2 * Math.tan(fov / 2) * distance;
    const width = height * (core.camera instanceof THREE.PerspectiveCamera ? core.camera.aspect : 1);
    
    const margin = 1.5;
    dirLight.shadow.camera.left = -width * margin / 2;
    dirLight.shadow.camera.right = width * margin / 2;
    dirLight.shadow.camera.top = height * margin / 2;
    dirLight.shadow.camera.bottom = -height * margin / 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = Math.max(distance * 2, 200);
    
    // 计算光源位置
    const direction = new THREE.Vector3().subVectors(target, cameraPos).normalize();
    const lightDistance = 100;
    const lightHeight = 80;
    const lightPosition = target.clone();
    lightPosition.addScaledVector(direction, -lightDistance);
    lightPosition.z += lightHeight;
    
    dirLight.shadow.camera.position.copy(lightPosition);
    dirLight.shadow.camera.lookAt(target);
    dirLight.shadow.camera.updateProjectionMatrix();
  }
  
  // 添加方向光和阴影相机辅助器（仅在启用阴影时，且非手机端）
  if (showShadows.value) {
    // 创建方向光辅助器（红色，显示光源位置和方向）
    
  }
  dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 20, 0xff0000);
  core.scene.add(dirLightHelper);
  
  // 创建阴影相机辅助器（绿色，显示阴影范围）
  if (dirLight.shadow.camera) {
    shadowCameraHelper = new THREE.CameraHelper(dirLight.shadow.camera);
    const material = shadowCameraHelper.material as THREE.LineBasicMaterial;
    if (material) {
      material.color.setHex(0x00ff00); // 绿色
    }
    core.scene.add(shadowCameraHelper);
  }
  
  // 初始化方向光指向上海（使用预估坐标）
  if (core.controls) {
    // 预估上海在世界坐标系中的位置（基于 MAP_CENTER 和 MAP_SCALE）
    const shanghaiEstimatedX = (shanghaiGeo[0] - MAP_CENTER[0]) * MAP_SCALE;
    const shanghaiEstimatedY = (shanghaiGeo[1] - MAP_CENTER[1]) * MAP_SCALE;
    
    // 设置初始目标为上海
    core.controls.target.set(shanghaiEstimatedX, shanghaiEstimatedY, 0);
    
    // 设置初始相机位置
    const cameraHeight = 50;
    const cameraOffsetZ = 45;
    core.camera.position.set(shanghaiEstimatedX, shanghaiEstimatedY - cameraOffsetZ, cameraHeight);
    core.controls.update();
    
    // 初始化方向光位置
    updateDirLight();
  }
  
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
        distData.forEach(d => {
            const rankItem = rankList.value.find(r => r.name === d.ip_location);
            dataMap.set(d.ip_location, { 
                count: d.COUNT, 
                rank: rankItem ? rankItem.rank : 999 
            });
        });
    }

    const maxCount = distData ? Math.max(...distData.map(d => d.COUNT)) : 1;
    // 缓存地图数据
    cachedGeoJson = geojson;
    cachedDataMap = dataMap;
    cachedMaxCount = maxCount;
    
    mapGroup = drawMap(geojson, core.scene, dataMap, maxCount);
    
    if (distData) {
      drawBars(distData, geojson, core.scene, mapGroup.position);
    }
    
    // 如果实体店模式开启，绘制实体店
    if (showShops.value) {
      await drawPhysicalShops(mockPhysicalShops, core.scene, mapGroup.position, geojson, dataMap, maxCount, core.effectManager);
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
        
        // 更新方向光位置（在相机位置设置后）
        updateDirLight();
    }
  }

  // 添加背景星空
  addBackgroundStars();

  loading.value = false;
  core.startAnimationLoop();

  const onMouseDown = (event: MouseEvent) => {
    // 记录鼠标按下位置，重置移动标志
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    mouseHasMoved = false;
  };
  
  const onMouseMoveForClick = (event: MouseEvent) => {
    // 检测是否移动
    if (mouseDownX !== 0 || mouseDownY !== 0) {
      const distance = Math.sqrt(
        (event.clientX - mouseDownX) ** 2 +
        (event.clientY - mouseDownY) ** 2
      );
      if (distance > MOUSE_MOVE_THRESHOLD) {
        mouseHasMoved = true;
      }
    }
  };
  
  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('mousemove', onMouseMoveForClick);
  container.value.addEventListener('mousedown', onMouseDown);
  container.value.addEventListener('dblclick', onDblClick);
  container.value.addEventListener('click', onClick);
  
  // 手机端触摸事件支持
  // 双击触摸相关变量
  let lastTouchTime = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchHasMoved = false;
  const TOUCH_DOUBLE_TAP_DELAY = 300; // 双击间隔时间（毫秒）
  const TOUCH_DOUBLE_TAP_DISTANCE = 50; // 双击允许的最大距离（像素）
  const MOVE_THRESHOLD = 5; // 移动阈值（像素）
  
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchHasMoved = false;
    }
  };
  
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      // 检测是否移动
      if (touchStartX !== 0 || touchStartY !== 0) {
        const distance = Math.sqrt(
          (touch.clientX - touchStartX) ** 2 +
          (touch.clientY - touchStartY) ** 2
        );
        if (distance > MOVE_THRESHOLD) {
          touchHasMoved = true;
        }
      }
    }
  };
  
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) return; // 如果还有触摸点，不处理
    
    const touch = event.changedTouches[0];
    
    // 检查从触摸开始到结束是否移动了
    const moveDistance = Math.sqrt(
      (touch.clientX - touchStartX) ** 2 +
      (touch.clientY - touchStartY) ** 2
    );
    
    // 如果移动了，不触发点击和双击，直接返回
    if (moveDistance > MOVE_THRESHOLD || touchHasMoved) {
      touchStartX = 0;
      touchStartY = 0;
      touchHasMoved = false;
      return;
    }
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastTouchTime;
    const distance = Math.sqrt(
      (touch.clientX - lastTouchX) ** 2 +
      (touch.clientY - lastTouchY) ** 2
    );
    
    if (timeDiff < TOUCH_DOUBLE_TAP_DELAY && distance < TOUCH_DOUBLE_TAP_DISTANCE) {
      // 双击触摸 - 聚焦
      event.preventDefault();
      focusOnTarget(touch.clientX, touch.clientY);
      lastTouchTime = 0; // 重置，避免三击
    } else {
      // 单次触摸 - 触发点击事件（实体店弹窗）
      if (!threeCore.value || !container.value) {
        lastTouchTime = currentTime;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        touchStartX = 0;
        touchStartY = 0;
        touchHasMoved = false;
        return;
      }
      
      const rect = container.value.getBoundingClientRect();
      mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, threeCore.value.camera);
      const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);
      
      if (intersects.length > 0) {
        const object = intersects.find(i => i.object.type === 'Mesh' || i.object.type === 'Sprite')?.object;
        
        if (object && (object.userData.isPhysicalShop || object.userData.isShopCluster)) {
          // 点击了实体店或聚类
          if (object.userData.cluster) {
            selectedShopCluster.value = object.userData.cluster as PhysicalShop[];
            shopModalVisible.value = true;
          } else if (object.userData.shop) {
            selectedShopCluster.value = [object.userData.shop as PhysicalShop];
            shopModalVisible.value = true;
          }
        }
      }
      
      lastTouchTime = currentTime;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
    
    // 重置触摸状态
    touchStartX = 0;
    touchStartY = 0;
    touchHasMoved = false;
  };
  
  // 保存触摸事件处理函数的引用，以便后续清理
  const touchHandlers = {
    start: onTouchStart,
    move: onTouchMove,
    end: onTouchEnd
  };
  
  // 保存鼠标事件处理函数的引用，以便后续清理
  const mouseHandlers = {
    down: onMouseDown,
    moveForClick: onMouseMoveForClick
  };
  
  container.value.addEventListener('touchstart', touchHandlers.start, { passive: true });
  container.value.addEventListener('touchmove', touchHandlers.move, { passive: true });
  container.value.addEventListener('touchend', touchHandlers.end, { passive: true });
  
  // 保存引用以便清理
  (container.value as any).__touchHandlers = touchHandlers;
  (container.value as any).__mouseHandlers = mouseHandlers;
};

// 点击事件处理（用于实体店弹窗）
const onClick = (event: MouseEvent) => {
  if (!threeCore.value || !container.value) return;
  
  // 检查是否移动过，如果移动过则不触发点击
  if (mouseHasMoved) {
    // 重置状态
    mouseDownX = 0;
    mouseDownY = 0;
    mouseHasMoved = false;
    return;
  }
  
  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, threeCore.value.camera);
  const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);
  
  if (intersects.length > 0) {
    const object = intersects.find(i => i.object.type === 'Mesh' || i.object.type === 'Sprite')?.object;
    
    if (object && (object.userData.isPhysicalShop || object.userData.isShopCluster)) {
      // 点击了实体店或聚类
      if (object.userData.cluster) {
        selectedShopCluster.value = object.userData.cluster as PhysicalShop[];
        shopModalVisible.value = true;
      } else if (object.userData.shop) {
        selectedShopCluster.value = [object.userData.shop as PhysicalShop];
        shopModalVisible.value = true;
      }
    }
  }
  
  // 重置状态
  mouseDownX = 0;
  mouseDownY = 0;
  mouseHasMoved = false;
};

const onDblClick = (event: MouseEvent) => {
  focusOnTarget(event.clientX, event.clientY);
};

// 聚焦函数（PC和手机共用）
const focusOnTarget = (clientX: number, clientY: number) => {
  if (!threeCore.value || !container.value) return;
  
  const rect = container.value.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, threeCore.value.camera);
  const intersects = raycaster.intersectObjects(threeCore.value.scene.children, true);
  
  const object = intersects.find(i => i.object.type === 'Mesh' || i.object.type === 'Sprite')?.object;
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
};

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
    const object = intersects.find(i => i.object.type === 'Mesh' || i.object.type === 'Sprite')?.object;
    
    if (object) {
        if (object.parent && object.parent.userData.isProvince) {
            found = true;
            if (hoveredObject !== object) {
                if (hoveredObject) restoreObjectMaterial(hoveredObject);
                hoveredObject = object;
                
                // 地图块高亮色
                const highlightColor = new THREE.Color(LOLITA_COLORS.highlight);

                (object as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                    color: highlightColor,
                    side: THREE.DoubleSide,
                    roughness: 0.5,
                    metalness: 0.1
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
                
                // 圆柱高亮色
                (object as THREE.Mesh).material = new THREE.MeshStandardMaterial({ 
                    color: LOLITA_COLORS.highlightBar,
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
        else if (object.userData.isPhysicalShop || object.userData.isShopCluster) {
            found = true;
            if (object.userData.isShopCluster) {
              // 聚类
              const cluster = object.userData.cluster as PhysicalShop[];
              tooltip.value.visible = true;
              tooltip.value.name = `${cluster.length} 家实体店`;
              tooltip.value.count = 0;
            } else {
              // 单个实体店
              const shop = object.userData.shop as PhysicalShop;
              tooltip.value.visible = true;
              tooltip.value.name = shop.physical_name || '实体店';
              tooltip.value.count = 0; // 实体店不显示数量
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
        (obj as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: baseColor,
            side: THREE.DoubleSide,
            roughness: 0.5,
            metalness: 0.1
        });
    }
}

onMounted(() => {
  checkIsMobile();
  window.addEventListener('resize', () => {
    checkIsMobile();
  });
  initThree();
});

onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose();
  }
  if (container.value) {
    container.value.removeEventListener('mousemove', onMouseMove);
    container.value.removeEventListener('dblclick', onDblClick);
    container.value.removeEventListener('click', onClick);
    // 移除鼠标事件监听器
    const mouseHandlers = (container.value as any).__mouseHandlers;
    if (mouseHandlers) {
      container.value.removeEventListener('mousedown', mouseHandlers.down);
      container.value.removeEventListener('mousemove', mouseHandlers.moveForClick);
    }
    // 移除触摸事件监听器
    const touchHandlers = (container.value as any).__touchHandlers;
    if (touchHandlers) {
      container.value.removeEventListener('touchstart', touchHandlers.start);
      container.value.removeEventListener('touchmove', touchHandlers.move);
      container.value.removeEventListener('touchend', touchHandlers.end);
    }
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

    <!-- 控制按钮 -->
    <div class="absolute top-4 left-4 z-40 flex flex-col gap-2 pointer-events-auto">
      <!-- 分布图显示/隐藏按钮 -->
      <button
        @click.stop="toggleBars"
        class="px-4 py-2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-200 text-sm font-medium transition-colors flex items-center gap-2 touch-manipulation"
        :class="showBars ? 'text-gray-700 hover:bg-gray-50' : 'bg-gray-100 text-gray-500'"
      >
        <span>{{ showBars ? '隐藏' : '显示' }}分布图</span>
        <span>{{ showBars ? '👁️' : '👁️‍🗨️' }}</span>
      </button>
      
      <!-- 实体店显示/隐藏按钮 -->
      <button
        @click.stop="toggleShops"
        class="px-4 py-2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-200 text-sm font-medium transition-colors flex items-center gap-2 touch-manipulation"
        :class="showShops ? 'bg-purple-100 text-purple-700 border-purple-300' : 'text-gray-700 hover:bg-gray-50'"
        :disabled="shopLoading"
      >
        <span v-if="shopLoading" class="flex items-center gap-2">
          <div class="w-3 h-3 border-2 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
          <span>加载中...</span>
        </span>
        <span v-else>
          <span>{{ showShops ? '隐藏' : '显示' }}实体店</span>
          <span>{{ showShops ? '🏪' : '📍' }}</span>
        </span>
      </button>
      
      <!-- 光影显示/隐藏按钮 -->
      <button
        @click.stop="toggleShadows"
        class="px-4 py-2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-200 text-sm font-medium transition-colors flex items-center gap-2 touch-manipulation"
        :class="showShadows ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'text-gray-700 hover:bg-gray-50'"
      >
        <span>{{ showShadows ? '隐藏' : '显示' }}光影</span>
        <span>{{ showShadows ? '☀️' : '🌙' }}</span>
      </button>
      
      <!-- 实体店加载中提示 -->
      <div v-if="shopLoading && showShops"
        class="px-4 py-2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-purple-200 text-sm text-purple-600 flex items-center gap-2">
        <div class="w-4 h-4 border-2 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
        <span>正在加载实体店...</span>
      </div>
      
      <!-- 排行榜 -->
      <div class="w-[280px] bg-white/95 backdrop-blur-md rounded-xl shadow-lg overflow-hidden text-sm transition-all duration-300 border border-gray-200 pointer-events-auto">
        <div 
          class="flex justify-between items-center px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 touch-manipulation"
          @click.stop="isRankExpanded = !isRankExpanded"
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
    </div>

    <!-- Tooltip -->
    <div v-if="tooltip.visible"
      class="fixed pointer-events-none z-50 px-4 py-2 bg-white/95 backdrop-blur text-gray-800 text-xs rounded-lg shadow-xl border border-gray-200"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }">
      <div class="font-bold text-purple-700 text-sm mb-1">{{ tooltip.name }}</div>
      <div v-if="tooltip.count > 0" class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400"></span>
          <span>人数: <span class="font-mono text-lg font-bold">{{ tooltip.count }}</span></span>
      </div>
      <div v-else class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-purple-400"></span>
          <span>实体店</span>
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

    <!-- 实体店列表弹窗 -->
    <UModal v-model="shopModalVisible" :ui="{ width: 'max-w-2xl' }">
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-purple-700">
              实体店列表 ({{ selectedShopCluster.length }})
            </h2>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="shopModalVisible = false" />
          </div>
        </template>
        
        <div class="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div 
            v-for="shop in selectedShopCluster" 
            :key="shop.physical_id"
            class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <!-- 店铺Logo -->
            <div class="w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-300 dark:border-purple-600">
              <img 
                v-if="shop.physical_logo" 
                :src="BASE_IMG + shop.physical_logo" 
                class="w-full h-full object-cover" 
                alt="logo" 
              />
              <div v-else class="w-full h-full flex items-center justify-center text-2xl">🏪</div>
            </div>
            
            <!-- 店铺信息 -->
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-base text-purple-700 dark:text-purple-400 mb-1">
                {{ shop.physical_name || '未命名实体店' }}
              </h3>
              <div v-if="shop.latitude && shop.longitude" class="text-xs text-gray-500 dark:text-gray-400">
                位置: {{ shop.latitude.toFixed(4) }}, {{ shop.longitude.toFixed(4) }}
              </div>
            </div>
          </div>
          
          <div v-if="selectedShopCluster.length === 0" class="text-center text-gray-400 py-8">
            暂无实体店数据
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- Time Ruler (Right Side) -->
    <TimeRuler 
      v-model="currentDate" 
      @change="handleDateChange" 
    />
    
    <!-- Date Toast -->
    <div 
      v-if="showDateToast"
      class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-300"
      :class="showDateToast ? 'opacity-100' : 'opacity-0'"
    >
      <div class="px-6 py-3 bg-black/60 backdrop-blur-md rounded-xl text-white font-mono text-xl font-bold shadow-2xl border border-white/10">
        {{ formattedDate }}
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

/* 优化手机端触摸响应 */
.touch-manipulation {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}

</style>
