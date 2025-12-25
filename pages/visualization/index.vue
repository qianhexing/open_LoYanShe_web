<template>
  <div class="visualization-container">
    <!-- 3D 容器 -->
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- UI 层: 顶部栏 -->
    <div class="ui-layer top-bar">
      <div class="user-info" v-if="userData">
        <span class="title">🌌 {{ userData.user.nickname }} 的星系衣橱</span>
      </div>
      <div class="controls">
        <button class="btn" @click="togglePause">
          {{ isPaused ? '▶ 播放' : '⏸ 暂停' }}
        </button>
      </div>
    </div>

    <!-- UI 层: 信息弹窗 -->
    <div v-if="selectedObject" class="info-card" :style="{ left: cardPosition.x + 'px', top: cardPosition.y + 'px' }">
      <div class="card-header">
        <button class="close-btn" @click="selectedObject = null">×</button>
        <h3>{{ selectedObject.title }}</h3>
      </div>
      <div class="card-content">
        <div v-if="selectedObject.type === 'wardrobe'">
          <p><strong>类型:</strong> 衣柜</p>
          <p><strong>服饰数量:</strong> {{ selectedObject.data.count }} 件</p>
        </div>
        <div v-if="selectedObject.type === 'cloth'">
          <p><strong>类型:</strong> 服饰</p>
          <p><strong>名称:</strong> {{ selectedObject.data.name }}</p>
          <p><strong>所属衣柜:</strong> {{ selectedObject.data.wardrobeName }}</p>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在生成星系...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// --- 类型定义 ---
interface User {
  id: string;
  nickname: string;
  avatar: string;
}

interface Wardrobe {
  id: string;
  name: string;
  type: string;
}

interface Cloth {
  id: string;
  wardrobe_id: string;
  name: string;
  image?: string;
}

interface MockData {
  user: User;
  wardrobes: Wardrobe[];
  clothes: Cloth[];
}

// --- 状态 ---
const route = useRoute();
const canvasContainer = ref<HTMLElement | null>(null);
const loading = ref(true);
const isPaused = ref(false);
const userData = ref<MockData | null>(null);

// 选中对象信息
const selectedObject = ref<{
  type: 'wardrobe' | 'cloth';
  title: string;
  data: any;
} | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

// Three.js 相关引用
const core = shallowRef<ThreeCore | null>(null);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 场景对象引用，用于动画
const galaxyGroup = new THREE.Group(); // 整个星系容器
const starGroup = new THREE.Group(); // 恒星容器
const planetGroups: {
  group: THREE.Group; // 包含行星和卫星的组，用于公转
  mesh: THREE.Mesh; // 行星本体，用于自转
  cloud: THREE.Points; // 点云，用于自转
  orbitSpeed: number; // 公转速度
  rotateSpeed: number; // 自转速度
}[] = [];

// --- Mock 数据生成 ---
const fetchMockData = async (userId: string): Promise<MockData> => {
  // 模拟 API 延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  const wardrobes: Wardrobe[] = [
    { id: 'w1', name: '当季常穿', type: 'Daily' },
    { id: 'w2', name: '冬季收藏', type: 'Winter' },
    { id: 'w3', name: '运动装备', type: 'Sport' },
    { id: 'w4', name: '复古风', type: 'Vintage' },
    { id: 'w5', name: '配饰柜', type: 'Accessories' },
  ];

  const clothes: Cloth[] = [];
  wardrobes.forEach(w => {
    const count = Math.floor(Math.random() * 50) + 20; // 每个衣柜 20-70 件衣服
    for (let i = 0; i < count; i++) {
      clothes.push({
        id: `c_${w.id}_${i}`,
        wardrobe_id: w.id,
        name: `${w.name}单品 #${i + 1}`,
      });
    }
  });

  return {
    user: {
      id: userId || 'u1',
      nickname: '星际旅行者',
      avatar: '', // 可以换成真实头像 URL
    },
    wardrobes,
    clothes,
  };
};

// --- Three.js 逻辑 ---

// 创建恒星 (用户)
const createStar = async (user: User) => {
  const geometry = new THREE.SphereGeometry(4, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    metalness: 0.8
  });
  const star = new THREE.Mesh(geometry, material);
  star.name = 'STAR_USER';
  
  // 添加发光效果 (简单模拟)
  const glowGeo = new THREE.SphereGeometry(4.5, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  star.add(glow);

  // 添加名字标签
  try {
    // 尝试加载字体，这里使用 Three.js 自带的简单字体加载逻辑，实际项目可能需要本地字体
    // 为了简化，这里先用 Canvas 贴图做文字，因为 FontLoader 需要字体文件路径
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 512;
      canvas.height = 128;
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillRect(0, 0, 512, 128);
      context.font = 'bold 60px Arial';
      context.textAlign = 'center';
      context.fillStyle = '#ffffff';
      context.fillText(user.nickname, 256, 80);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.y = 6;
      sprite.scale.set(10, 2.5, 1);
      star.add(sprite);
    }
  } catch (e) {
    console.error('Text load failed', e);
  }

  starGroup.add(star);
  galaxyGroup.add(starGroup);
};

// 创建点云材质
const createCloudMaterial = (color: number) => {
  // 使用 Canvas 创建圆形纹理
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0,0,32,32);
  }
  const texture = new THREE.CanvasTexture(canvas);

  return new THREE.PointsMaterial({
    color: color,
    size: 0.8,
    map: texture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
};

// 创建星系
const initGalaxy = async () => {
  if (!core.value || !userData.value) return;

  // 1. 创建恒星
  await createStar(userData.value.user);

  // 2. 创建行星和卫星
  const wardrobes = userData.value.wardrobes;
  const allClothes = userData.value.clothes;
  
  // 行星参数
  const baseOrbitRadius = 15;
  const radiusIncrement = 8;
  const planetColors = [0x4facfe, 0x00f2fe, 0x43e97b, 0xfa709a, 0xa18cd1];

  wardrobes.forEach((wardrobe, index) => {
    const orbitRadius = baseOrbitRadius + (index * radiusIncrement);
    const angle = (index / wardrobes.length) * Math.PI * 2; // 初始角度均匀分布

    // 行星组 (用于公转) - 位于恒星中心，但通过 wrapper 偏移
    const planetOrbitGroup = new THREE.Group();
    // 旋转到初始角度
    planetOrbitGroup.rotation.y = angle;
    
    // 行星容器 (实际位置偏移)
    const planetWrapper = new THREE.Group();
    planetWrapper.position.set(orbitRadius, 0, 0);
    planetOrbitGroup.add(planetWrapper);

    // 行星 Mesh
    const planetGeo = new THREE.SphereGeometry(1.5, 24, 24);
    const pColor = planetColors[index % planetColors.length];
    const planetMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.6 });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.userData = { 
      isPlanet: true, 
      id: wardrobe.id, 
      data: { ...wardrobe, count: allClothes.filter(c => c.wardrobe_id === wardrobe.id).length } 
    };
    planetWrapper.add(planet);

    // 轨道线 (Visual Guide)
    const orbitGeo = new THREE.RingGeometry(orbitRadius - 0.1, orbitRadius + 0.1, 64);
    const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, opacity: 0.1, transparent: true });
    const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
    orbitLine.rotation.x = Math.PI / 2;
    galaxyGroup.add(orbitLine); // 轨道线加在主组里，不动

    // 卫星 (点云)
    const wardrobeClothes = allClothes.filter(c => c.wardrobe_id === wardrobe.id);
    if (wardrobeClothes.length > 0) {
      const pointsGeo = new THREE.BufferGeometry();
      const positions = [];
      const userDatas = []; // 存储每个点的元数据不太容易直接通过 BufferGeometry，我们用索引映射

      const cloudRadius = 3.5;
      const count = wardrobeClothes.length;
      
      for (let i = 0; i < count; i++) {
        // 随机分布在行星周围的球壳上
        const r = cloudRadius + (Math.random() - 0.5) * 1.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions.push(x, y, z);
      }

      pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const cloud = new THREE.Points(pointsGeo, createCloudMaterial(pColor));
      cloud.userData = { 
        isCloud: true, 
        wardrobeId: wardrobe.id,
        clothes: wardrobeClothes // 存储该点云对应的衣服列表
      };
      
      planetWrapper.add(cloud);

      // 保存引用用于动画
      planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: cloud,
        orbitSpeed: 0.002 + (Math.random() * 0.002), // 随机公转速度
        rotateSpeed: 0.005 + (Math.random() * 0.005) // 随机自转速度
      });
    } else {
       planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: null as any,
        orbitSpeed: 0.002 + (Math.random() * 0.002),
        rotateSpeed: 0.01
      });
    }

    galaxyGroup.add(planetOrbitGroup);
  });

  if (core.value) {
    core.value.scene.add(galaxyGroup);
  }
};

// --- 交互逻辑 ---

const onMouseClick = (event: MouseEvent) => {
  if (!core.value) return;

  // 计算鼠标位置 (-1 到 1)
  const rect = core.value.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, core.value.camera);

  // 1. 检测行星点击
  const planets = planetGroups.map(pg => pg.mesh);
  const planetIntersects = raycaster.intersectObjects(planets);

  if (planetIntersects.length > 0) {
    const object = planetIntersects[0].object;
    if (object.userData.isPlanet) {
      selectedObject.value = {
        type: 'wardrobe',
        title: object.userData.data.name,
        data: object.userData.data
      };
      updateCardPosition(event);
      return;
    }
  }

  // 2. 检测点云点击
  // 点云检测需要设置阈值
  raycaster.params.Points.threshold = 0.5;
  const clouds = planetGroups.filter(pg => pg.cloud).map(pg => pg.cloud);
  const cloudIntersects = raycaster.intersectObjects(clouds);

  if (cloudIntersects.length > 0) {
    const intersect = cloudIntersects[0];
    const object = intersect.object;
    const index = intersect.index; // 点的索引

    if (object.userData.isCloud && index !== undefined) {
      const clothes = object.userData.clothes as Cloth[];
      if (clothes && clothes[index]) {
        const cloth = clothes[index];
        // 查找所属衣柜名
        const wardrobe = userData.value?.wardrobes.find(w => w.id === cloth.wardrobe_id);
        
        selectedObject.value = {
          type: 'cloth',
          title: cloth.name,
          data: {
            ...cloth,
            wardrobeName: wardrobe?.name || '未知衣柜'
          }
        };
        updateCardPosition(event);
        return;
      }
    }
  }

  // 点击空白处关闭
  selectedObject.value = null;
};

const updateCardPosition = (event: MouseEvent) => {
  // 简单的让卡片跟随鼠标点击位置
  cardPosition.value = { x: event.clientX + 20, y: event.clientY + 20 };
};

const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// --- 生命周期 ---

onMounted(async () => {
  if (!canvasContainer.value) return;

  // 初始化 ThreeCore
  const options = {
    antialias: true,
    alpha: true,
    clearColor: 0x000000,
    cameraPosition: { x: 0, y: 30, z: 60 },
    enableOrbitControls: true
  };

  core.value = new ThreeCore(options);
  core.value.mount(canvasContainer.value);

  // 调整相机
  core.value.controls.autoRotate = false;
  core.value.controls.maxDistance = 200;
  core.value.controls.minDistance = 10;

  // 加载数据
  const userId = route.query.user_id as string;
  userData.value = await fetchMockData(userId);
  
  await initGalaxy();
  loading.value = false;

  // 注册点击事件
  core.value.renderer.domElement.addEventListener('click', onMouseClick);

  // 注册动画循环
  core.value.addAnimationCallback(() => {
    if (isPaused.value) return;

    // 1. 恒星自转
    starGroup.rotation.y += 0.001;

    // 2. 行星公转和自转
    planetGroups.forEach(pg => {
      // 公转 (旋转父组)
      pg.group.rotation.y += pg.orbitSpeed;
      
      // 行星自转
      pg.mesh.rotation.y += pg.rotateSpeed;

      // 云层自转 (稍微快一点，营造动态感)
      if (pg.cloud) {
        pg.cloud.rotation.y -= pg.rotateSpeed * 0.5;
        pg.cloud.rotation.x += pg.rotateSpeed * 0.2;
      }
    });
  });

  core.value.startAnimationLoop();
});

onBeforeUnmount(() => {
  if (core.value) {
    core.value.renderer.domElement.removeEventListener('click', onMouseClick);
    core.value.dispose();
  }
});
</script>

<style scoped>
.visualization-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: #050510; /* 深空背景 */
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.ui-layer {
  position: absolute;
  z-index: 10;
  pointer-events: none; /* 让点击穿透到 canvas */
}

.top-bar {
  top: 0;
  left: 0;
  width: 100%;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
}

.user-info .title {
  color: white;
  font-size: 24px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.controls {
  pointer-events: auto;
}

.btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  backdrop-filter: blur(5px);
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.4);
}

.info-card {
  position: fixed;
  z-index: 20;
  width: 280px;
  background: rgba(16, 20, 40, 0.9);
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 12px;
  padding: 16px;
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  /* 防止卡片溢出屏幕 */
  transform: translate(0, 0); 
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #4facfe;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.card-content p {
  margin: 8px 0;
  font-size: 14px;
  color: #ddd;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 30;
  color: #4facfe;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(79, 172, 254, 0.3);
  border-radius: 50%;
  border-top-color: #4facfe;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
