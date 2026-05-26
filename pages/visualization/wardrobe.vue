<template>
  <div class="visualization-container">
    <!-- 3D 容器 -->
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- UI 层: 顶部栏 -->
    <div class="ui-layer top-bar">
      <div class="user-info flex-1" v-if="userData">
        <div class="avatar-ring">
          <img v-if="userData.user.user_face" :src="BASE_IMG + userData.user.user_face" class="user-avatar" />
          <div v-else class="user-avatar-placeholder">{{ userData.user.user_name?.[0] || 'U' }}</div>
        </div>
        <span class="title flex-1">
          <div class="">✨ {{ userData.user.user_name || '用户' }} ✨</div>
          <div class="text-sm text-gray-400">衣柜星系</div>
        </span>
      </div>
      <div class="controls ">
        <button class="btn lolita-btn m-2" @click="handleShare">
          🔗 分享
        </button>
      </div>
    </div>

    <!-- UI 层: 左下角控制区 -->
    <div class="ui-layer bottom-left-controls">
      <button class="btn lolita-btn" @click="togglePause">
        {{ isPaused ? '🌸 播放' : '⏸ 暂停' }}
      </button>
    </div>

    <!-- UI 层: 信息弹窗 - PC端 -->
    <div v-if="selectedObject && !isMobile" class="info-card lolita-card" :style="{ left: cardPosition.x + 'px', top: cardPosition.y + 'px' }">
      <div class="card-header">
        <h3>🎀 {{ selectedObject.title }}</h3>
        <button class="close-btn" @click="selectedObject = null">×</button>
      </div>
      <div class="card-content">
        <template v-if="selectedObject.type === 'wardrobe'">
          <p><strong>类型:</strong> 🌸 衣柜</p>
          <p><strong>收录:</strong> {{ selectedObject.data.count || 0 }} 件</p>
        </template>
        <template v-if="selectedObject.type === 'cloth'">
          <p><strong>类型:</strong> {{ selectedObject.data.clothes_part || '未分类' }}</p>
          <p v-if="selectedObject.data.clothes_note"><strong>备注:</strong> {{ selectedObject.data.clothes_note }}</p>
          <p><strong>归属:</strong> {{ selectedObject.data.wardrobeName }}</p>
        </template>
      </div>
      <!-- Action Button -->
      <div class="card-footer">
        <button @click.stop="goToDetail" class="lolita-btn detail-btn">
          🔍 查看详情
        </button>
      </div>
    </div>

    <!-- UI 层: 信息弹窗 - 手机端抽屉 -->
    <Transition name="drawer">
      <div v-if="selectedObject && isMobile" class="fixed bottom-0 left-0 right-0 z-50 flex items-end pointer-events-none">
        <!-- 抽屉内容 -->
        <div class="relative w-full bg-qhx-bg-card rounded-t-[2rem] p-6 shadow-2xl border-t border-white/50 max-w-md mx-auto pointer-events-auto max-h-[60vh] overflow-y-auto">
          <!-- 关闭按钮 -->
          <button @click.stop="selectedObject = null" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400">
            <span class="text-xl">✕</span>
          </button>
          <!-- 卡片内容 -->
          <div class="card-header mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">🎀 {{ selectedObject.title }}</h3>
          </div>
          <div class="card-content">
            <template v-if="selectedObject.type === 'wardrobe'">
              <div class="space-y-3">
                <div class="flex items-center gap-2 px-3 py-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <span class="text-lg">🌸</span>
                  <span class="text-sm text-qhx-text">类型: 衣柜</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span class="text-lg">💎</span>
                  <span class="text-sm text-qhx-text">收录: {{ selectedObject.data.count || 0 }} 件</span>
                </div>
              </div>
            </template>
            <template v-if="selectedObject.type === 'cloth'">
              <div class="space-y-3">
                <div class="flex items-center gap-2 px-3 py-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <span class="text-lg">👗</span>
                  <span class="text-sm text-qhx-text">类型: {{ selectedObject.data.clothes_part || '未分类' }}</span>
                </div>
                <div v-if="selectedObject.data.clothes_note" class="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p class="text-sm text-qhx-text">备注: {{ selectedObject.data.clothes_note }}</p>
                </div>
                <div class="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span class="text-lg">📁</span>
                  <span class="text-sm text-qhx-text">归属: {{ selectedObject.data.wardrobeName }}</span>
                </div>
              </div>
            </template>
          </div>
          <!-- Action Button -->
          <div class="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-700 mt-4">
            <button @click.stop="goToDetail"
              class="px-6 py-2 bg-qhx-primary text-white text-sm rounded-full font-medium transition-all shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105">
              🔍 查看详情
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在编织星光...</p>
    </div>

    <!-- 未登录状态 -->
    <div v-if="notLoggedIn" class="loading-overlay">
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full mx-4">
        <div class="text-6xl mb-6 text-center">🔒</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">需要登录</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-8 text-center">请登录后查看衣柜星系，或者通过分享链接查看他人的星系。</p>
        <button 
          @click="showLoginModal = true"
          class="w-full px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
        >
          去登录
        </button>
      </div>
    </div>

    <!-- 快速登录弹窗 -->
    <YearlySummaryLoginModal
      v-model="showLoginModal"
      @success="handleLoginSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as THREE from 'three';
import ThreeCore from '@/utils/threeCore';
import type { User, Wardrobe, WardrobeClothes } from '@/types/api';
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig';
import gsap from 'gsap';
import { useUserStore } from '@/stores/user';
import { getUserMy } from '@/api/user';
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue';
import { getWardrobeVisualization } from '@/api/wardrobe';

// --- 类型定义 ---
interface VisualizationData {
  user: User;
  wardrobe: Wardrobe[];
  wardrobe_clothes: WardrobeClothes[];
}

// --- 状态 ---
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const canvasContainer = ref<HTMLElement | null>(null);
const loading = ref(true);
const notLoggedIn = ref(false);
const showLoginModal = ref(false);
const isPaused = ref(false);
const userData = ref<VisualizationData | null>(null);

// 检测是否为手机端
const isMobile = ref(false);
const checkIsMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
};

// 选中对象信息
type SelectedWardrobe = {
  type: 'wardrobe';
  title: string;
  data: Wardrobe & { count?: number };
};
type SelectedCloth = {
  type: 'cloth';
  title: string;
  data: WardrobeClothes & { wardrobeName?: string };
};
const selectedObject = ref<SelectedWardrobe | SelectedCloth | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

// 双击检测
let lastClickTime = 0;
let clickTimeout: ReturnType<typeof setTimeout> | null = null;
const DOUBLE_CLICK_DELAY = 300; // 双击间隔时间（毫秒）

// Three.js 相关引用
const core = shallowRef<ThreeCore | null>(null);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 场景对象引用，用于动画
const galaxyGroup = new THREE.Group(); // 整个星系容器
const starGroup = new THREE.Group(); // 恒星容器
let avatarMesh: THREE.Mesh | null = null; // 用户头像Mesh
let nameSprite: THREE.Sprite | null = null; // 名字Sprite

const planetGroups: {
  group: THREE.Group; // 包含行星和卫星的组，用于公转
  mesh: THREE.Mesh; // 行星本体，用于自转
  cloud: THREE.Points; // 点云，用于自转
  orbitSpeed: number; // 公转速度
  rotateSpeed: number; // 自转速度
}[] = [];

// --- 获取真实数据 ---
const fetchWardrobeData = async (userId: string | number): Promise<VisualizationData> => {
  const userIdNum = typeof userId === 'string' ? Number.parseInt(userId, 10) : userId;
  
  const data = await getWardrobeVisualization({
    user_id: userIdNum
  });
  console.log(data, '数据')
  return data;
};

// 加载数据
const loadData = async () => {
  try {
    loading.value = true;
    notLoggedIn.value = false;
    
    // 检查登录状态
    const userId = route.query.user_id as string | undefined;
    if (!userId) {
      loading.value = false;
      return;
    }

    // 如果有 user_id，使用它；否则使用当前用户
    let targetUserId: string | number;
    if (userId) {
      targetUserId = userId;
    } 

    // 加载数据
    userData.value = await fetchWardrobeData(userId);
    
    // 初始化场景
    if (core.value && userData.value) {
      await initGalaxy();
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    // 判断是否有token
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null);
    
    if (!token) {
      // 没有token，显示登录弹窗
      showLoginModal.value = true;
    } else {
      // 有token但请求失败，尝试重新加载
      const userId = route.query.user_id as string || userStore.user?.user_id?.toString();
      if (userId) {
        try {
          userData.value = await fetchWardrobeData(userId);
          if (core.value && userData.value) {
            await initGalaxy();
          }
        } catch (retryError) {
          console.error('重试加载数据失败:', retryError);
        }
      }
      if (core.value && userData.value) {
        await initGalaxy();
      }
    }
  } finally {
    loading.value = false;
  }
};

// 登录成功回调
const handleLoginSuccess = async () => {
  // 重新加载数据
  await loadData();
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

// 将图片纹理转换为圆形
const convertTextureToCircle = (texture: THREE.Texture): Promise<THREE.Texture> => {
  return new Promise((resolve) => {
    const img = texture.image;
    if (!img) {
      resolve(texture);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(texture);
      return;
    }

    // 创建圆形裁剪路径
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 计算图片缩放和位置，使其居中并填满圆形
    const size = Math.min(img.width, img.height);
    const scale = 256 / size;
    const x = (256 - img.width * scale) / 2;
    const y = (256 - img.height * scale) / 2;

    // 绘制图片
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    const circleTexture = new THREE.CanvasTexture(canvas);
    circleTexture.colorSpace = THREE.SRGBColorSpace;
    resolve(circleTexture);
  });
};

// 生成头像纹理
const createAvatarTexture = (user: User) => {
  if (user.user_face) {
    const loader = new THREE.TextureLoader();
    // 设置允许跨域
    loader.crossOrigin = 'Anonymous';
    // 注意：真实场景下需要处理跨域问题，这里假设 avatar 是同域或支持 CORS 的
    // 如果是外部链接，可以尝试设置 loader.crossOrigin = 'Anonymous';
    // 但为了演示稳定，如果加载失败我们回退到 Canvas 生成
    return new Promise<THREE.Texture>((resolve) => {
        loader.load(BASE_IMG + user.user_face, async (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            // 将图片转换为圆形
            const circleTex = await convertTextureToCircle(tex);
            resolve(circleTex);
        }, undefined, () => {
            // 加载失败回退
             resolve(createDefaultAvatarTexture(user.user_name || 'U'));
        });
    });
  } else {
    return Promise.resolve(createDefaultAvatarTexture(user.user_name || 'U'));
  }
};

const createDefaultAvatarTexture = (nickname: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // 背景
        const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, '#FFB7C5');
        gradient.addColorStop(1, '#FF69B4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        // 文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 120px "Quicksand", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nickname[0]?.toUpperCase() || 'U', 128, 128);
        
        // 边框
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// 创建恒星 (用户) - 精灵贴图头像
const createStar = async (user: User) => {
  // 1. 获取头像纹理
  const avatarTexture = await createAvatarTexture(user);
  
  // 2. 创建头像 Sprite
  const spriteMat = new THREE.SpriteMaterial({ 
    map: avatarTexture,
    transparent: true,
    depthWrite: false, // 避免遮挡半透明物体
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(8, 8, 1); // 调整头像大小
  sprite.name = 'STAR_AVATAR';
  sprite.renderOrder = 2; // 头像在上层
  console.log(sprite);
  
  // 3. 添加一个发光背景 Sprite (增强层次感)
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const ctx = glowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 183, 197, 0.8)'); // 粉色中心
    gradient.addColorStop(0.5, 'rgba(255, 105, 180, 0.2)'); // 扩散
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowMat = new THREE.SpriteMaterial({ 
    map: glowTexture, 
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glowSprite = new THREE.Sprite(glowMat);
  glowSprite.scale.set(12, 12, 1); // 光晕比头像大
  glowSprite.renderOrder = 0; // 光晕在底层
  // 4. 装饰环 (Mesh) - 让它围绕 Sprite 旋转，增加 3D 空间感
  // 稍微倾斜一点，避免完全侧面对着镜头看不见
  const ringGeo = new THREE.TorusGeometry(6.0, 0.05, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 1.8; // 稍微倾斜
  ring.renderOrder = 10;
  // 组装
  starGroup.add(ring);       // 环
  starGroup.add(sprite);     // 头像在最上层
  starGroup.add(glowSprite); // 光晕在最底层


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
      context.font = 'bold 50px "Georgia", "Times New Roman", serif';
      context.textAlign = 'center';
      context.lineWidth = 4;
      context.strokeStyle = '#FF69B4'; // 粉色描边
      context.strokeText(user.user_name || '用户', 256, 80);
      
      context.fillStyle = '#FFFFFF';
      context.fillText(user.user_name || '用户', 256, 80);
      
      const texture = new THREE.CanvasTexture(canvas);
      const nameMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      nameSprite = new THREE.Sprite(nameMat);
      nameSprite.position.y = 6.5;
      nameSprite.scale.set(12, 3, 1);
      nameSprite.renderOrder = 0; // 昵称在头像后面渲染
      starGroup.add(nameSprite);
    }
  } catch (e) {
    console.error('Text load failed', e);
  }

  galaxyGroup.add(starGroup);
};

// 创建点云材质
const createCloudMaterial = (color: number) => {
  const texture = createParticleTexture(Math.random() > 0.5 ? 'star' : 'heart'); // 随机星星或爱心

  return new THREE.PointsMaterial({
    color: color,
    size: 1.0, 
    map: texture,
    transparent: true,
    opacity: 0.7, 
    blending: THREE.NormalBlending, 
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: false 
  });
};

// 创建星系
const initGalaxy = async () => {
  if (!core.value || !userData.value) return;

  // 0. 设置背景色和 Bloom 参数
  core.value.renderer.setClearColor(0x000000, 1); 
  core.value.setAmbientLightIntensity(0.8); 
  // 保持较低的 Bloom 参数
  // core.value.setBloomParams(0.4, 0.4, 0.85); 
  core.value.setBloomParams(0, 0, 0); 

  // 1. 创建恒星 (头像)
  await createStar(userData.value.user);

  // 2. 创建行星和卫星
  const wardrobes = userData.value.wardrobe;
  const allClothes = userData.value.wardrobe_clothes;
  
  // 行星参数
  const baseOrbitRadius = 15;
  const radiusIncrement = 9;
  
  const planetColors = [
    0xFFB7C5, // Baby Pink
    0xB0E0E6, // Powder Blue
    0xE6E6FA, // Lavender
    0xFFFDD0, // Cream
    0x98FF98  // Mint Green
  ];
  console.log(userData.value, '衣柜')
  wardrobes.forEach((wardrobe, index) => {
    const orbitRadius = baseOrbitRadius + (index * radiusIncrement);
    const angle = (index / wardrobes.length) * Math.PI * 2;
    
    // 为每个轨道生成不同的倾斜角度，让它们错落有致
    // 倾斜角度范围：-60度到60度
    const tiltAngle = (Math.PI / 3) * (Math.random() * 2 - 1); // -60° 到 60°
    // 也可以使用固定模式，让轨道分布更均匀
    // const tiltAngle = (Math.PI / 3) * Math.sin(index * 0.8); // 使用正弦波模式
    
    // 轨道平面的旋转角度（让轨道在不同方向倾斜）
    const tiltRotation = (index / wardrobes.length) * Math.PI * 2;

    // 创建轨道倾斜组（只负责倾斜，不公转）
    const orbitTiltGroup = new THREE.Group();
    orbitTiltGroup.rotation.x = tiltAngle;
    orbitTiltGroup.rotation.z = tiltRotation * 0.3; // 额外的旋转，让轨道更错落
    
    // 创建公转组（在倾斜轨道上进行公转）
    const planetOrbitGroup = new THREE.Group();
    planetOrbitGroup.rotation.y = angle; // 初始公转角度
    orbitTiltGroup.add(planetOrbitGroup);
    
    // 行星包装组（在轨道上的位置）
    const planetWrapper = new THREE.Group();
    planetWrapper.position.set(orbitRadius, 0, 0);
    planetOrbitGroup.add(planetWrapper);

    // 计算该衣柜的衣服数量
    const wardrobeClothes = allClothes.filter(c => c.wardrobe_id === wardrobe.wardrobe_id);
    const clothesCount = wardrobeClothes.length;
    
    // 计算所有衣柜的衣服数量范围（用于归一化）
    const allCounts = wardrobes.map(w => 
      allClothes.filter(c => c.wardrobe_id === w.wardrobe_id).length
    );
    const minCount = Math.min(...allCounts, 0);
    const maxCount = Math.max(...allCounts, 1); // 至少为1，避免除零
    
    // 根据衣服数量计算行星大小（范围：1.2 到 3.0）
    const baseSize = 0.5;
    const maxSize = 3.0;
    const sizeRange = maxSize - baseSize;
    // 使用平方根映射，让大小变化更平滑
    const normalizedCount = maxCount > minCount 
      ? (clothesCount - minCount) / (maxCount - minCount)
      : 0;
    const planetSize = baseSize + sizeRange * Math.sqrt(normalizedCount);
    
    // 行星 Mesh
    const planetGeo = new THREE.SphereGeometry(planetSize, 32, 32);
    const pColor = planetColors[index % planetColors.length];
    const planetMat = new THREE.MeshStandardMaterial({ 
      color: pColor, 
      roughness: 0.4, 
      metalness: 0.0, 
      emissive: pColor,
      emissiveIntensity: 0.05 
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.userData = { 
      isPlanet: true, 
      id: wardrobe.wardrobe_id, 
      data: { ...wardrobe, count: clothesCount } 
    };
    planetWrapper.add(planet);

    // 添加行星环装饰（大小随行星大小变化）
    const ribbonRadius = planetSize * 1.55; // 环的半径约为行星大小的1.55倍
    const ribbonGeo = new THREE.TorusGeometry(ribbonRadius, 0.05, 16, 64);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.rotation.x = Math.PI / 2.5; 
    planetWrapper.add(ribbon);

    // 轨道线 - 创建一个独立的组来管理轨道线的倾斜，但不跟随公转
    const orbitLineGroup = new THREE.Group();
    orbitLineGroup.rotation.x = tiltAngle;
    orbitLineGroup.rotation.z = tiltRotation * 0.3;
    
    const orbitGeo = new THREE.RingGeometry(orbitRadius - 0.08, orbitRadius + 0.08, 128);
    const orbitMat = new THREE.MeshBasicMaterial({ 
      color: 0xFF69B4, 
      side: THREE.DoubleSide, 
      opacity: 0.1, 
      transparent: true, 
      blending: THREE.AdditiveBlending 
    });
    const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
    // 轨道线在组内旋转到水平位置
    orbitLine.rotation.x = Math.PI / 2;
    orbitLineGroup.add(orbitLine);
    galaxyGroup.add(orbitLineGroup);

    // 卫星 (点云)
    if (wardrobeClothes.length > 0) {
      const positions = [];
      const cloudRadius = 10.0;
      const count = wardrobeClothes.length;
      
      for (let i = 0; i < count; i++) {
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
      
      const cloudColor = new THREE.Color(pColor).offsetHSL(0, 0.2, 0.1); 
      const cloud = new THREE.Points(pointsGeo, createCloudMaterial(cloudColor.getHex()));
      
      cloud.userData = { 
        isCloud: true, 
        wardrobeId: wardrobe.wardrobe_id,
        clothes: wardrobeClothes 
      };
      
      planetWrapper.add(cloud);

      planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: cloud,
        // 极慢的公转和自转
        orbitSpeed: 0.0001 + (Math.random() * 0.0001), 
        rotateSpeed: 0.001 + (Math.random() * 0.001) 
      });
    } else {
       planetGroups.push({
        group: planetOrbitGroup,
        mesh: planet,
        cloud: null as unknown as THREE.Points,
        orbitSpeed: 0.0001 + (Math.random() * 0.0001),
        rotateSpeed: 0.002
      });
    }

    galaxyGroup.add(orbitTiltGroup);
  });
  
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
    opacity: 0.4, 
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

  const currentTime = Date.now();
  const timeSinceLastClick = currentTime - lastClickTime;
  
  // 检测双击
  if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
    // 清除单击的延迟处理
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }
    // 执行双击操作
    onDoubleClick(event);
    lastClickTime = 0; // 重置，避免三击触发
    return;
  }
  
  lastClickTime = currentTime;
  
  // 延迟执行单击操作，等待可能的双击
  if (clickTimeout) {
    clearTimeout(clickTimeout);
  }
  
  clickTimeout = setTimeout(() => {
    handleSingleClick(event);
    clickTimeout = null;
  }, DOUBLE_CLICK_DELAY);
};

const handleSingleClick = (event: MouseEvent) => {
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
        title: object.userData.data.wardrobe_name || '衣柜',
        data: object.userData.data
      };
      updateCardPosition(event);
      return;
    }
  }

  raycaster.params.Points.threshold = 0.8; 
  const clouds = planetGroups.filter(pg => pg.cloud).map(pg => pg.cloud);
  const cloudIntersects = raycaster.intersectObjects(clouds);

  if (cloudIntersects.length > 0) {
    const intersect = cloudIntersects[0];
    const object = intersect.object;
    const index = intersect.index;

    if (object.userData.isCloud && index !== undefined) {
      const clothes = object.userData.clothes as WardrobeClothes[];
      if (clothes?.[index]) {
        const cloth = clothes[index];
        const wardrobe = userData.value?.wardrobe.find(w => w.wardrobe_id === cloth.wardrobe_id);
        
        selectedObject.value = {
          type: 'cloth',
          title: cloth.clothes_note || `服饰 #${cloth.clothes_id}`,
          data: {
            ...cloth,
            wardrobeName: wardrobe?.wardrobe_name || '未知衣柜'
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

// 分享功能
const handleShare = async () => {
  try {
    const { useCopyCurrentUrl } = await import('@/composables/useCopyCurrentUrl');
    const { copyCurrentUrl } = useCopyCurrentUrl();
    const result = await copyCurrentUrl();
    if (result?.success) {
      // 可以添加 toast 提示，这里先简单处理
      console.log('链接已复制');
    } else {
      console.log('复制失败:', result?.message || '请手动复制链接');
    }
  } catch (error) {
    console.error('复制链接失败:', error);
  }
};

// 跳转详情页
let uni: any;
const configStore = useConfigStore();
const port = computed(() => configStore.getPort());

const goToDetail = () => {
  if (!selectedObject.value || !userData.value) return;
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (selectedObject.value.type === 'wardrobe') {
    const wardrobe = selectedObject.value.data;
    const userId = userData.value.user.user_id;
    
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/wardrobe/wardrobe?user_id=${userId}&wardrobe_id=${wardrobe.wardrobe_id}`,
        fail: () => {
          console.log('跳转错误');
        }
      });
    } else {
      if (port.value) {
        // 鸿蒙系统
        port.value.postMessage(JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: {
            url: `https://lolitalibrary.com/wardrobe/detail/${userId}?wardrobe_id=${wardrobe.wardrobe_id}`
          }
        }));
      } else {
        // 普通网页环境
        window.open(`/wardrobe/detail/${userId}?wardrobe_id=${wardrobe.wardrobe_id}`, '_blank');
      }
    }
  } else if (selectedObject.value.type === 'cloth') {
    const cloth = selectedObject.value.data;
    
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/wardrobe/clothesDetail/clothesDetail?id=${cloth.clothes_id}`,
        fail: () => {
          console.log('跳转错误');
        }
      });
    } else {
      if (port.value) {
        // 鸿蒙系统
        port.value.postMessage(JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: {
            url: `https://lolitalibrary.com/clothes/detail/${cloth.clothes_id}`
          }
        }));
      } else {
        // 普通网页环境
        window.open(`/clothes/detail/${cloth.clothes_id}`, '_blank');
      }
    }
  }
};

// 聚焦到目标对象
const focusOnObject = (targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3) => {
  if (!core.value) return;
  
  const camera = core.value.camera;
  const controls = core.value.controls;
  
  // 计算从目标到当前相机的方向
  const direction = new THREE.Vector3()
    .subVectors(camera.position, targetLookAt)
    .normalize();
  
  // 如果方向为零向量（相机已经在目标位置），使用默认方向
  if (direction.length() === 0) {
    direction.set(0, 0.3, 1).normalize();
  }
  
  // 计算合适的距离（根据目标对象类型调整）
  const currentDistance = camera.position.distanceTo(targetLookAt);
  const targetDistance = Math.max(12, Math.min(currentDistance * 0.7, 30));
  
  // 计算新的相机位置
  const newPosition = new THREE.Vector3()
    .copy(targetLookAt)
    .add(direction.multiplyScalar(targetDistance));
  
  // 使用 gsap 平滑移动相机
  gsap.to(camera.position, {
    x: newPosition.x,
    y: newPosition.y,
    z: newPosition.z,
    duration: 1.2,
    ease: 'power2.inOut',
    onUpdate: () => {
      controls.update();
    }
  });
  
  // 平滑移动控制器的目标点
  gsap.to(controls.target, {
    x: targetLookAt.x,
    y: targetLookAt.y,
    z: targetLookAt.z,
    duration: 1.2,
    ease: 'power2.inOut',
    onUpdate: () => {
      controls.update();
    }
  });
};

// 双击事件处理
const onDoubleClick = (event: MouseEvent) => {
  if (!core.value) return;
  
  const rect = core.value.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, core.value.camera);
  
  // 检查是否点击了头像（starGroup 中的 sprite）
  const starSprites = starGroup.children.filter(child => child.name === 'STAR_AVATAR');
  if (starSprites.length > 0) {
    const spriteIntersects = raycaster.intersectObjects(starSprites);
    if (spriteIntersects.length > 0) {
      // 聚焦到头像（中心位置）
      focusOnObject(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
      return;
    }
  }
  
  // 检查是否点击了行星
  const planets = planetGroups.map(pg => pg.mesh);
  const planetIntersects = raycaster.intersectObjects(planets);
  
  if (planetIntersects.length > 0) {
    const object = planetIntersects[0].object;
    if (object.userData.isPlanet) {
      // 获取行星的世界坐标
      const worldPosition = new THREE.Vector3();
      object.getWorldPosition(worldPosition);
      focusOnObject(worldPosition, worldPosition);
      return;
    }
  }
  
  // 检查是否点击了卫星（点云）
  raycaster.params.Points.threshold = 0.8;
  const clouds = planetGroups.filter(pg => pg.cloud).map(pg => pg.cloud);
  const cloudIntersects = raycaster.intersectObjects(clouds);
  
  if (cloudIntersects.length > 0) {
    const intersect = cloudIntersects[0];
    const object = intersect.object;
    
    if (object.userData.isCloud) {
      // 获取点云的世界坐标
      const worldPosition = new THREE.Vector3();
      object.getWorldPosition(worldPosition);
      focusOnObject(worldPosition, worldPosition);
      return;
    }
  }
};

// --- 生命周期 ---

onMounted(async () => {
  // 加载 uni-webview-js
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  
  if (!canvasContainer.value) return;

  const options = {
    antialias: true,
    alpha: true,
    clearColor: 0x1a0b2e, 
    cameraPosition: { x: 0, y: 35, z: 65 },
    enableOrbitControls: true
  };

  core.value = new ThreeCore(options);
  await core.value.mount(canvasContainer.value);

  // 调整控制器手感
  core.value.controls.autoRotate = false;
  core.value.controls.maxDistance = 200;
  core.value.controls.minDistance = 10;
  core.value.controls.enableDamping = true;
  core.value.controls.dampingFactor = 0.05;

  // 设置事件监听器
  core.value.renderer.domElement.addEventListener('click', onMouseClick);

  core.value.addAnimationCallback(() => {
    if (isPaused.value) return;

    // 2. 恒星组其他部分自转 (环、光晕等)
    if (starGroup) {
      // 只有装饰环旋转
      starGroup.children.forEach(child => {
         // 识别环 (TorusGeometry)
         if (child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry) {
             child.rotation.z += 0.001; // 环自转
         }
      });
      // 移除整体摆动，避免 Sprite 头像歪斜
      // starGroup.rotation.z = Math.sin(Date.now() * 0.0002) * 0.05; 
    }

    // 3. 行星公转和自转
    planetGroups.forEach(pg => {
      pg.group.rotation.y += pg.orbitSpeed;
      pg.mesh.rotation.y += pg.rotateSpeed;

      if (pg.cloud) {
        pg.cloud.rotation.y -= pg.rotateSpeed * 0.5;
        const scale = 1 + Math.sin(Date.now() * 0.0003 + pg.mesh.id) * 0.03; // 更慢的呼吸
        pg.cloud.scale.set(scale, scale, scale);
      }
    });
  });

  await core.value.startAnimationLoop();

  // 检测手机端
  checkIsMobile();
  if (import.meta.client) {
    window.addEventListener('resize', checkIsMobile);
  }

  // 延迟加载数据，等待 Three.js 初始化完成
  setTimeout(() => {
    // 如果有token，则获取用户信息
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null);
    if (token) {
      getUserMy().then((res) => {
        // 如果路由没有user_id，则设置user_id为当前用户id并跳转
        if (!route.query.user_id) {
          window.location.href = `/visualization/wardrobe?user_id=${res.user_id}`;
        } else {
          // 如果路由有user_id，则加载数据
          loadData();
        }
      }).catch(() => {
        // 获取用户信息失败，如果有user_id参数则加载数据，否则显示登录
        if (route.query.user_id) {
          loadData();
        } else {
          showLoginModal.value = true;
        }
      });
    } else {
      // 如果路由有user_id，则加载数据
      if (route.query.user_id) {
        loadData();
      } else {
        // 如果既没有token也没有路由user_id参数，则触发登录弹窗
        showLoginModal.value = true;
      }
    }
  }, 100);
});

onBeforeUnmount(() => {
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }
  if (import.meta.client) {
    window.removeEventListener('resize', checkIsMobile);
  }
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
  font-size: 16px;
  font-weight: 600;
  font-family: 'Cinzel', serif; /* 优雅的衬线体 */
  text-shadow: 0 0 10px rgba(255, 183, 197, 0.8), 2px 2px 4px rgba(0,0,0,0.5);
  letter-spacing: 1px;
}

.controls {
  pointer-events: auto;
}

.bottom-left-controls {
  bottom: 24px;
  left: 24px;
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
  /* color: #E6E6FA; */
  line-height: 1.4;
}

.card-content strong {
  /* color: #FFF0F5; */
  font-weight: 600;
}

.card-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 183, 197, 0.3);
  display: flex;
  justify-content: flex-end;
}

.detail-btn {
  padding: 8px 20px;
  font-size: 14px;
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

/* 抽屉动画 */
.drawer-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-active > div {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-leave-active > div {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-from > div {
  transform: translateY(100%);
}

.drawer-leave-to > div {
  transform: translateY(100%);
}

.drawer-enter-to > div,
.drawer-leave-from > div {
  transform: translateY(0);
}
</style>
