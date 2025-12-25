<template>
  <div class="visualization-container">
    <!-- 3D 容器 -->
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- UI 层: 顶部栏 -->
    <div class="ui-layer top-bar">
      <div class="user-info" v-if="userData">
        <div class="avatar-ring">
          <img v-if="userData.user.avatar" :src="userData.user.avatar" class="user-avatar" />
          <div v-else class="user-avatar-placeholder">{{ userData.user.nickname[0] }}</div>
        </div>
        <span class="title">✨ {{ userData.user.nickname }} 的梦幻衣橱 ✨</span>
      </div>
      <div class="controls">
        <button class="btn lolita-btn" @click="togglePause">
          {{ isPaused ? '🌸 播放' : '⏸ 暂停' }}
        </button>
      </div>
    </div>

    <!-- UI 层: 信息弹窗 -->
    <div v-if="selectedObject" class="info-card lolita-card" :style="{ left: cardPosition.x + 'px', top: cardPosition.y + 'px' }">
      <div class="card-header">
        <h3>🎀 {{ selectedObject.title }}</h3>
        <button class="close-btn" @click="selectedObject = null">×</button>
      </div>
      <div class="card-content">
        <div v-if="selectedObject.type === 'wardrobe'">
          <p><strong>类型:</strong> 🌸 衣柜</p>
          <p><strong>珍藏:</strong> {{ selectedObject.data.count }} 件小物</p>
        </div>
        <div v-if="selectedObject.type === 'cloth'">
          <p><strong>类型:</strong> 👗 单品</p>
          <p><strong>名称:</strong> {{ selectedObject.data.name }}</p>
          <p><strong>归属:</strong> {{ selectedObject.data.wardrobeName }}</p>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在编织星光...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';

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
    { id: 'w1', name: 'Sweet Lolita', type: 'Sweet' },
    { id: 'w2', name: 'Classic Lolita', type: 'Classic' },
    { id: 'w3', name: 'Gothic Lolita', type: 'Gothic' },
    { id: 'w4', name: '茶会限定', type: 'TeaParty' },
    { id: 'w5', name: '梦幻小物', type: 'Accessories' },
  ];

  const clothes: Cloth[] = [];
  wardrobes.forEach(w => {
    const count = Math.floor(Math.random() * 50) + 30; // 增加数量
    for (let i = 0; i < count; i++) {
      clothes.push({
        id: `c_${w.id}_${i}`,
        wardrobe_id: w.id,
        name: `${w.name} 珍藏 #${i + 1}`,
      });
    }
  });

  return {
    user: {
      id: userId || 'u1',
      nickname: 'Alice',
      avatar: '', 
    },
    wardrobes,
    clothes,
  };
};

// --- Three.js 逻辑 ---

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

// 创建恒星 (用户) - 珍珠/水晶球风格
const createStar = async (user: User) => {
  // 核心：珍珠光泽
  const geometry = new THREE.SphereGeometry(4.5, 64, 64);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xFFF0F5, // 薰衣草/粉白
    emissive: 0xFFB7C5, // 浅粉发光
    emissiveIntensity: 0.1, // 降低自发光
    metalness: 0.1,
    roughness: 0.2, // 稍微粗糙一点，减少反光
    clearcoat: 0.8, // 降低清漆层
    clearcoatRoughness: 0.2,
    transmission: 0.1, // 降低透光
    thickness: 1.5,
  });
  const star = new THREE.Mesh(geometry, material);
  star.name = 'STAR_USER';
  
  // 外层光晕 (Bloom 效果增强)
  const glowGeo = new THREE.SphereGeometry(5.2, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xFF69B4, // 热粉色光晕
    transparent: true,
    opacity: 0.05, // 降低透明度
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  star.add(glow);

  // 内部装饰环 (类似行星环，增加层次)
  const ringGeo = new THREE.TorusGeometry(6.5, 0.05, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.4 }); // 降低不透明度
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  star.add(ring);

  // 名字标签
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 512;
      canvas.height = 128;
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillRect(0, 0, 512, 128);
      
      // 描边文字
      context.font = 'bold 50px "Georgia", "Times New Roman", serif'; // 衬线体更优雅
      context.textAlign = 'center';
      context.lineWidth = 4;
      context.strokeStyle = '#FF69B4'; // 粉色描边
      context.strokeText(user.nickname, 256, 80);
      
      context.fillStyle = '#FFFFFF';
      context.fillText(user.nickname, 256, 80);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.y = 7;
      sprite.scale.set(12, 3, 1);
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
  const texture = createParticleTexture(Math.random() > 0.5 ? 'star' : 'heart'); // 随机星星或爱心

  return new THREE.PointsMaterial({
    color: color,
    size: 1.0, // 稍微减小粒子尺寸
    map: texture,
    transparent: true,
    opacity: 0.7, // 降低不透明度
    blending: THREE.NormalBlending, // 改为 NormalBlending，减少叠加过曝
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: false // 使用统一颜色
  });
};

// 创建星系
const initGalaxy = async () => {
  if (!core.value || !userData.value) return;

  // 0. 设置背景色和 Bloom 参数
  core.value.renderer.setClearColor(0x1a0b2e, 1); // 深紫色背景
  // 增加环境光亮度，让 Pastel 颜色更明显
  core.value.setAmbientLightIntensity(0.8); // 降低环境光
  // 开启并调整 Bloom
  core.value.setBloomParams(0.4, 0.4, 0.85); // 大幅降低强度，提高阈值

  // 1. 创建恒星
  await createStar(userData.value.user);

  // 2. 创建行星和卫星
  const wardrobes = userData.value.wardrobes;
  const allClothes = userData.value.clothes;
  
  // 行星参数
  const baseOrbitRadius = 15;
  const radiusIncrement = 9;
  
  // Lolita 专属配色 (Pastel Colors)
  const planetColors = [
    0xFFB7C5, // Baby Pink
    0xB0E0E6, // Powder Blue
    0xE6E6FA, // Lavender
    0xFFFDD0, // Cream
    0x98FF98  // Mint Green
  ];

  wardrobes.forEach((wardrobe, index) => {
    const orbitRadius = baseOrbitRadius + (index * radiusIncrement);
    const angle = (index / wardrobes.length) * Math.PI * 2;

    const planetOrbitGroup = new THREE.Group();
    planetOrbitGroup.rotation.y = angle;
    
    const planetWrapper = new THREE.Group();
    planetWrapper.position.set(orbitRadius, 0, 0);
    planetOrbitGroup.add(planetWrapper);

    // 行星 Mesh - 使用 Toon 或 Standard 材质让颜色更鲜艳
    const planetGeo = new THREE.SphereGeometry(1.8, 32, 32);
    const pColor = planetColors[index % planetColors.length];
    const planetMat = new THREE.MeshStandardMaterial({ 
      color: pColor, 
      roughness: 0.4, // 增加粗糙度
      metalness: 0.0, // 减少金属感
      emissive: pColor,
      emissiveIntensity: 0.05 // 降低自发光
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.userData = { 
      isPlanet: true, 
      id: wardrobe.id, 
      data: { ...wardrobe, count: allClothes.filter(c => c.wardrobe_id === wardrobe.id).length } 
    };
    planetWrapper.add(planet);

    // 添加行星环装饰 (丝带感)
    const ribbonGeo = new THREE.TorusGeometry(2.8, 0.05, 16, 64);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 }); // 降低不透明度
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.rotation.x = Math.PI / 2.5; // 稍微倾斜
    planetWrapper.add(ribbon);

    // 轨道线 (虚线或发光线)
    const orbitGeo = new THREE.RingGeometry(orbitRadius - 0.08, orbitRadius + 0.08, 128);
    const orbitMat = new THREE.MeshBasicMaterial({ 
      color: 0xFF69B4, // 粉色轨道
      side: THREE.DoubleSide, 
      opacity: 0.1, // 降低不透明度
      transparent: true, 
      blending: THREE.AdditiveBlending 
    });
    const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
    orbitLine.rotation.x = Math.PI / 2;
    galaxyGroup.add(orbitLine);

    // 卫星 (点云 - 星光/糖果)
    const wardrobeClothes = allClothes.filter(c => c.wardrobe_id === wardrobe.id);
    if (wardrobeClothes.length > 0) {
      const positions = [];
      const cloudRadius = 4.0; // 扩大一点范围
      const count = wardrobeClothes.length;
      
      for (let i = 0; i < count; i++) {
        // 螺旋分布或者球状分布
        const r = cloudRadius + (Math.random() - 0.5) * 2.0;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        positions.push(x, y, z);
      }

      const pointsGeo = new THREE.BufferGeometry();
      pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      // 使用更亮的颜色作为粒子颜色
      const cloudColor = new THREE.Color(pColor).offsetHSL(0, 0.2, 0.1); 
      const cloud = new THREE.Points(pointsGeo, createCloudMaterial(cloudColor.getHex()));
      
      cloud.userData = { 
        isCloud: true, 
        wardrobeId: wardrobe.id,
        clothes: wardrobeClothes 
      };
      
      planetWrapper.add(cloud);

      planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: cloud,
        orbitSpeed: 0.0005 + (Math.random() * 0.0005), // 大幅降低公转速度
        rotateSpeed: 0.002 + (Math.random() * 0.002) // 大幅降低自转速度
      });
    } else {
       planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: null as any,
        orbitSpeed: 0.0005 + (Math.random() * 0.0005),
        rotateSpeed: 0.005
      });
    }

    galaxyGroup.add(planetOrbitGroup);
  });
  
  // 添加背景星尘 (增加氛围感)
  addBackgroundStars();

  if (core.value) {
    core.value.scene.add(galaxyGroup);
  }
};

const addBackgroundStars = () => {
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
    opacity: 0.4, // 降低不透明度
    map: createParticleTexture('star'),
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const starField = new THREE.Points(starsGeometry, material);
  galaxyGroup.add(starField);
}

// --- 交互逻辑 ---

const onMouseClick = (event: MouseEvent) => {
  if (!core.value) return;

  const rect = core.value.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, core.value.camera);

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

  raycaster.params.Points.threshold = 0.8; // 稍微增加阈值，更容易点中星星
  const clouds = planetGroups.filter(pg => pg.cloud).map(pg => pg.cloud);
  const cloudIntersects = raycaster.intersectObjects(clouds);

  if (cloudIntersects.length > 0) {
    const intersect = cloudIntersects[0];
    const object = intersect.object;
    const index = intersect.index;

    if (object.userData.isCloud && index !== undefined) {
      const clothes = object.userData.clothes as Cloth[];
      if (clothes && clothes[index]) {
        const cloth = clothes[index];
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

  selectedObject.value = null;
};

const updateCardPosition = (event: MouseEvent) => {
  cardPosition.value = { x: event.clientX + 20, y: event.clientY + 20 };
};

const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// --- 生命周期 ---

onMounted(async () => {
  if (!canvasContainer.value) return;

  const options = {
    antialias: true,
    alpha: true,
    clearColor: 0x1a0b2e, // 初始背景色，会被 initGalaxy 覆盖
    cameraPosition: { x: 0, y: 35, z: 65 },
    enableOrbitControls: true
  };

  core.value = new ThreeCore(options);
  core.value.mount(canvasContainer.value);

  // 调整控制器手感
  core.value.controls.autoRotate = false;
  core.value.controls.maxDistance = 200;
  core.value.controls.minDistance = 10;
  core.value.controls.enableDamping = true;
  core.value.controls.dampingFactor = 0.05;

  const userId = route.query.user_id as string;
  userData.value = await fetchMockData(userId);
  
  await initGalaxy();
  loading.value = false;

  core.value.renderer.domElement.addEventListener('click', onMouseClick);

  core.value.addAnimationCallback(() => {
    if (isPaused.value) return;

    // 缓慢旋转整个星系背景，制造梦幻感
    // galaxyGroup.rotation.y += 0.0002;

    starGroup.rotation.y += 0.0005; // 减慢恒星自转
    starGroup.rotation.z = Math.sin(Date.now() * 0.0002) * 0.05; // 减慢摆动频率

    planetGroups.forEach(pg => {
      pg.group.rotation.y += pg.orbitSpeed;
      pg.mesh.rotation.y += pg.rotateSpeed;

      if (pg.cloud) {
        pg.cloud.rotation.y -= pg.rotateSpeed * 0.5;
        // 让云层有呼吸感
        const scale = 1 + Math.sin(Date.now() * 0.0005 + pg.mesh.id) * 0.05; // 减慢呼吸
        pg.cloud.scale.set(scale, scale, scale);
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
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Quicksand:wght@400;600&display=swap');

.visualization-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  /* 梦幻渐变背景 */
  background: radial-gradient(circle at center, #2e1a3b 0%, #1a0b2e 100%);
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.ui-layer {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.top-bar {
  top: 0;
  left: 0;
  width: 100%;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* 顶部粉色渐变遮罩 */
  background: linear-gradient(to bottom, rgba(255, 183, 197, 0.15), transparent);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.avatar-ring {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid #FFB7C5;
  padding: 2px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 10px #FFB7C5;
}

.user-avatar, .user-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #FF69B4;
  font-size: 20px;
}

.user-info .title {
  color: #FFF0F5;
  font-size: 26px;
  font-weight: 600;
  font-family: 'Cinzel', serif; /* 优雅的衬线体 */
  text-shadow: 0 0 10px rgba(255, 183, 197, 0.8), 2px 2px 4px rgba(0,0,0,0.5);
  letter-spacing: 1px;
}

.controls {
  pointer-events: auto;
}

.lolita-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid #FFB7C5;
  color: #FFF0F5;
  padding: 10px 24px;
  border-radius: 25px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
  font-family: 'Quicksand', sans-serif;
  font-weight: 600;
  box-shadow: 0 0 10px rgba(255, 183, 197, 0.3);
}

.lolita-btn:hover {
  background: rgba(255, 183, 197, 0.3);
  box-shadow: 0 0 20px rgba(255, 183, 197, 0.6);
  transform: scale(1.05);
}

.lolita-card {
  position: fixed;
  z-index: 20;
  width: 300px;
  /* 磨砂玻璃 + 蕾丝边框感 */
  background: rgba(30, 15, 45, 0.75);
  border: 2px solid rgba(255, 183, 197, 0.6);
  border-radius: 16px;
  padding: 20px;
  color: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(255, 183, 197, 0.05);
  backdrop-filter: blur(16px);
  transform: translate(10px, 10px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px dashed rgba(255, 183, 197, 0.3);
  padding-bottom: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #FFB7C5;
  font-family: 'Cinzel', serif;
}

.close-btn {
  background: none;
  border: none;
  color: #FFB7C5;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.card-content p {
  margin: 10px 0;
  font-size: 15px;
  color: #E6E6FA;
  line-height: 1.4;
}

.card-content strong {
  color: #FFF0F5;
  font-weight: 600;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #1a0b2e;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 30;
  color: #FFB7C5;
  font-family: 'Cinzel', serif;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 183, 197, 0.1);
  border-radius: 50%;
  border-top-color: #FFB7C5;
  border-right-color: #E6E6FA;
  animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
  margin-bottom: 20px;
  box-shadow: 0 0 15px rgba(255, 183, 197, 0.2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.1);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 183, 197, 0.5);
  border-radius: 3px;
}
</style>
