<template>
  <div ref="container" class="w-full h-screen relative bg-[#050505] overflow-hidden select-none font-sans">
    
    <!-- Loading Screen -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
        <div class="relative w-24 h-24 mb-6">
          <div class="absolute inset-0 border-t-4 border-[#f5aacb] rounded-full animate-spin"></div>
          <div class="absolute inset-2 border-r-4 border-[#00ffcc] rounded-full animate-spin-reverse"></div>
        </div>
        <div class="text-white text-2xl font-light tracking-[0.5em] uppercase">Generating Nature Galaxy</div>
        <div class="text-[#f5aacb]/70 text-sm mt-2 font-mono">{{ loadingStatus }}</div>
      </div>
    </Transition>

    <!-- HUD Layer -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div class="pointer-events-auto">
          <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f5aacb] to-[#00ffcc] tracking-tighter italic">
            NATURE <span class="text-white text-2xl not-italic font-light tracking-widest block mt-1">150TH STYLE VISUALIZATION</span>
          </h1>
        </div>
        
        <div class="flex flex-col items-end gap-3 pointer-events-auto">
          <div class="glass-panel px-6 py-4 text-right backdrop-blur-xl border-r-2 border-[#f5aacb]">
            <div class="text-[10px] text-white/40 uppercase tracking-widest mb-1">Total Entities</div>
            <div class="text-xl font-bold text-white">{{ totalPoints.toLocaleString() }} NODES</div>
            <div class="text-xs text-[#00ffcc] font-mono mt-1">
              CONNECTED CLUSTERS
            </div>
          </div>
          
          <div class="glass-panel px-4 py-2 text-right">
              <div class="text-[10px] text-white/40 uppercase mb-1">Time Axis (Vertical)</div>
              <div class="h-24 w-2 bg-gradient-to-t from-blue-900 via-purple-500 to-white rounded-full mx-auto relative">
                  <span class="absolute -left-8 top-0 text-[9px] text-white">NOW</span>
                  <span class="absolute -left-8 bottom-0 text-[9px] text-blue-500">PAST</span>
              </div>
          </div>
        </div>
      </div>

      <!-- Footer & Detail Panel -->
      <div class="flex justify-between items-end">
        <!-- Hover Info (Follows Selection) -->
        <div v-if="hoveredData" class="glass-panel px-6 py-4 pointer-events-auto animate-fade-in backdrop-blur-xl border-l-2 border-[#00ffcc] max-w-sm">
          <div class="text-[10px] font-bold uppercase tracking-widest mb-1" :class="hoveredData.type === 'shop' ? 'text-[#f5aacb]' : 'text-[#00ffcc]'">
            {{ hoveredData.type === 'shop' ? 'STAR SYSTEM (SHOP)' : 'PLANETARY ARTIFACT (ITEM)' }}
          </div>
          <h2 class="text-2xl font-bold text-white mb-1 leading-tight">{{ hoveredData.name }}</h2>
          
          <div class="text-xs text-white/60 font-mono space-y-1 mt-2">
            <div v-if="hoveredData.type === 'library'">
                 <div>RELEASE: <span class="text-white">{{ hoveredData.dateStr }}</span></div>
                 <div>PRICE: <span class="text-[#00ffcc]">{{ hoveredData.price }}</span></div>
                 <div class="mt-2 text-[#f5aacb] cursor-pointer" @click="focusShop(hoveredData.parentId)">
                    BELONGS TO: {{ getShopName(hoveredData.parentId) }} >
                 </div>
            </div>
            <div v-else>
                 <div>ID: #{{ hoveredData.id }}</div>
                 <div>ITEMS: <span class="text-white">{{ hoveredData.childCount }}</span></div>
            </div>
          </div>
        </div>
        
        <div v-else></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import TWEEN from '@tweenjs/tween.js';

// --- Configuration ---
const SHOP_COUNT = 500;        // Number of shops
const MAX_ITEMS_PER_SHOP = 100; // Max items per shop
const TOTAL_TIME_SPAN = 20 * 365 * 24 * 60 * 60 * 1000; // 20 years in ms
const START_DATE = new Date('2005-01-01').getTime();
const VERTICAL_SCALE = 0.00000002; // Scale time to Y axis
const SPIRAL_TIGHTNESS = 0.5;
const CLUSTER_RADIUS_FACTOR = 0.5;

// --- State ---
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadingStatus = ref('Initializing...');
const totalPoints = ref(0);
const hoveredData = ref<any>(null);

// --- Three.js Globals ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let composer: EffectComposer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

let pointCloud: THREE.Points | null = null;
let connectionLines: THREE.LineSegments | null = null;
let hoverHighlight: THREE.Mesh | null = null;

// Data Store
// Stores metadata for each point index
const pointsMetadata: any[] = [];
const shopMap = new Map<number, string>(); // ID -> Name

onMounted(async () => {
  initThree();
  await generateNatureGalaxy();
  animate();
  
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', onClick);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onClick);
  cancelAnimationFrame(animationId);
  renderer?.dispose();
});

const initThree = () => {
  if (!container.value) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.0005);

  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 10000);
  camera.position.set(400, 200, 400);

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.appendChild(renderer.domElement);

  // Bloom
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.1;
  bloomPass.strength = 1.0;
  bloomPass.radius = 0.5;
  
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.2;
  controls.maxDistance = 2000;

  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 3;
  mouse = new THREE.Vector2();

  // Highlight Ring
  const ringGeo = new THREE.RingGeometry(1, 1.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  hoverHighlight = new THREE.Mesh(ringGeo, ringMat);
  hoverHighlight.visible = false;
  scene.add(hoverHighlight);
};

// --- Core Generation Logic ---
const generateNatureGalaxy = async () => {
  loadingStatus.value = "Simulating temporal clusters...";
  
  // Buffers
  // Estimate total points
  const estimatedTotal = SHOP_COUNT * (MAX_ITEMS_PER_SHOP / 2) + SHOP_COUNT; 
  const positions = [];
  const colors = [];
  const sizes = [];
  
  // Line buffers (Shop center -> Item)
  const linePositions = [];
  const lineColors = [];

  const shopColor = new THREE.Color(0xf5aacb);
  
  for (let i = 0; i < SHOP_COUNT; i++) {
    // 1. Create Shop (Cluster Center)
    const shopId = i;
    const shopName = `Star System #${i}`;
    shopMap.set(shopId, shopName);
    
    // Shop base position determines its "Thread" in the universe
    // We distribute shops in a large ring or phyllotaxis spiral on the XZ plane
    // But they drift upward over time? No, shops usually persist.
    // Nature 150th style: Roots at bottom, branches growing up.
    // Let's make Shop center follow a large spiral path UPWARDS too, 
    // or keep shops static in XZ and items spiraling up.
    
    // Let's place Shops in a Phyllotaxis spiral on XZ plane to separate them
    const angle = i * 2.39996; // Golden angle approx
    const radius = 30 * Math.sqrt(i) + 50; 
    const shopX = Math.cos(angle) * radius;
    const shopZ = Math.sin(angle) * radius;
    const shopY = -100; // Base level
    
    // Push Shop Point
    positions.push(shopX, shopY, shopZ);
    colors.push(shopColor.r, shopColor.g, shopColor.b);
    sizes.push(10.0); // Big shop node
    
    const shopIndex = pointsMetadata.length;
    pointsMetadata.push({
      type: 'shop',
      id: shopId,
      name: shopName,
      childCount: 0
    });
    
    // 2. Create Items (Library) for this Shop
    const itemCount = Math.floor(Math.random() * MAX_ITEMS_PER_SHOP) + 10;
    pointsMetadata[shopIndex].childCount = itemCount;

    for (let j = 0; j < itemCount; j++) {
      // Random Date within 20 years
      const timeOffset = Math.random() * TOTAL_TIME_SPAN;
      const itemDate = START_DATE + timeOffset;
      const dateStr = new Date(itemDate).toISOString().split('T')[0];
      
      // Calculate Height (Y) based on Time
      // Newer items are higher
      const y = (timeOffset * VERTICAL_SCALE) - 50; 
      
      // Spiral around the shop center
      // The higher (newer), the wider the spiral? Or consistent?
      // Nature 150th creates "branches".
      // Let's add some noise to X/Z relative to Shop Center
      
      // Local spiral for the shop's history
      const itemAngle = (timeOffset / TOTAL_TIME_SPAN) * 10 * Math.PI; // 5 rotations over history
      const itemRadius = 10 + (timeOffset / TOTAL_TIME_SPAN) * 20; // Expands slightly over time
      
      const x = shopX + Math.cos(itemAngle) * itemRadius;
      const z = shopZ + Math.sin(itemAngle) * itemRadius;
      
      positions.push(x, y, z);
      
      // Color based on Time (Blue -> Cyan -> White)
      const t = timeOffset / TOTAL_TIME_SPAN;
      const itemColor = new THREE.Color();
      itemColor.setHSL(0.6 - t * 0.4, 0.8, 0.5 + t * 0.3);
      colors.push(itemColor.r, itemColor.g, itemColor.b);
      
      sizes.push(4.0);
      
      pointsMetadata.push({
        type: 'library',
        id: `${shopId}-${j}`,
        name: `Artifact ${shopId}-${j}`,
        dateStr: dateStr,
        price: Math.floor(Math.random() * 20000) + ' JPY',
        parentId: shopId
      });
      
      // Add Line from Previous Item (to form a thread) OR from Shop Center?
      // Nature 150th connects nodes. 
      // Let's connect items sequentially in time for this shop -> DNA strand look
      // OR connect to center. Connecting to center looks like a messy cone.
      // Connecting sequentially looks like a rising vine.
      
      // Let's connect to the previous item of this shop to make a strand
      if (j > 0) {
        // Prev item is at positions.length - 6 (current x,y,z is at -3)
        // Actually accessing via index is safer
        const prevIndex = (positions.length / 3) - 2;
        const currIndex = (positions.length / 3) - 1;
        
        linePositions.push(
            positions[prevIndex*3], positions[prevIndex*3+1], positions[prevIndex*3+2],
            x, y, z
        );
        
        // Line color matches item color but dimmer
        lineColors.push(
            itemColor.r, itemColor.g, itemColor.b,
            itemColor.r, itemColor.g, itemColor.b
        );
      } else {
        // Connect first item to Shop Center
        linePositions.push(
            shopX, shopY, shopZ,
            x, y, z
        );
        lineColors.push(
            shopColor.r, shopColor.g, shopColor.b,
            itemColor.r, itemColor.g, itemColor.b
        );
      }
    }
  }
  
  // Create Point Cloud
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  
  const mat = new THREE.PointsMaterial({
    size: 4,
    vertexColors: true,
    map: getDiscTexture(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  
  pointCloud = new THREE.Points(geo, mat);
  scene.add(pointCloud);
  
  // Create Lines
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15, // Subtle connections
    blending: THREE.AdditiveBlending
  });
  
  connectionLines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(connectionLines);

  totalPoints.value = pointsMetadata.length;
  loading.value = false;
};

// --- Utils ---
const getDiscTexture = () => {
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
    context.fillRect(0, 0, 32, 32);
  }
  return new THREE.CanvasTexture(canvas);
};

const getShopName = (id: number) => shopMap.get(id) || 'Unknown Shop';

const focusShop = (shopId: number) => {
    // Find the shop node index (it's stored sequentially but we need to search metadata to be safe or store index map)
    // Optimization: Metadata is index aligned.
    const index = pointsMetadata.findIndex(p => p.type === 'shop' && p.id === shopId);
    if (index !== -1 && pointCloud) {
        const pos = pointCloud.geometry.getAttribute('position');
        const x = pos.getX(index);
        const y = pos.getY(index);
        const z = pos.getZ(index);
        
        new TWEEN.Tween(controls.target)
            .to({ x, y, z }, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
        new TWEEN.Tween(camera.position)
            .to({ x: x + 50, y: y + 50, z: z + 50 }, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
    }
}

// --- Interactions ---
const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  composer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const onMouseMove = (event: MouseEvent) => {
  if (loading.value) return;
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  if (pointCloud) {
    const intersects = raycaster.intersectObject(pointCloud);
    if (intersects.length > 0) {
      const index = intersects[0].index!;
      const pos = pointCloud.geometry.getAttribute('position');
      
      // Highlight
      if (hoverHighlight) {
          hoverHighlight.visible = true;
          hoverHighlight.position.set(pos.getX(index), pos.getY(index), pos.getZ(index));
          hoverHighlight.lookAt(camera.position);
      }
      
      hoveredData.value = pointsMetadata[index];
      document.body.style.cursor = 'pointer';
    } else {
      hoveredData.value = null;
      if (hoverHighlight) hoverHighlight.visible = false;
      document.body.style.cursor = 'default';
    }
  }
};

const onClick = (event: MouseEvent) => {
    if (hoveredData.value) {
        // Fly to clicked item
        if (hoverHighlight) {
            const target = hoverHighlight.position.clone();
            new TWEEN.Tween(controls.target)
                .to({ x: target.x, y: target.y, z: target.z }, 800)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();
        }
    }
};

const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  composer.render();
};
</script>

<style scoped>
.glass-panel {
  background: rgba(10, 10, 10, 0.7);
  backdrop-filter: blur(16px);
  border-radius: 4px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.animate-spin-reverse {
  animation: spin-reverse 1.5s linear infinite;
}
@keyframes spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

.animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
