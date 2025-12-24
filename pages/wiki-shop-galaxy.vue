<template>
  <div ref="container" class="w-full h-screen relative bg-[#050505] overflow-hidden select-none font-sans">
    
    <!-- Loading Screen -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
        <div class="relative w-24 h-24 mb-6">
          <div class="absolute inset-0 border-t-4 border-[#f5aacb] rounded-full animate-spin"></div>
          <div class="absolute inset-2 border-r-4 border-[#00ffcc] rounded-full animate-spin-reverse"></div>
        </div>
        <div class="text-white text-2xl font-light tracking-[0.5em] uppercase">Loading Universe</div>
        <div class="text-[#f5aacb]/70 text-sm mt-2 font-mono">{{ loadingStatus }}</div>
      </div>
    </Transition>

    <!-- HUD Layer -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div class="pointer-events-auto">
          <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f5aacb] to-[#00ffcc] tracking-tighter italic">
            GALAXY <span class="text-white text-2xl not-italic font-light tracking-widest block mt-1">POINT CLOUD VISUALIZER</span>
          </h1>
        </div>
        
        <div class="flex flex-col items-end gap-3 pointer-events-auto">
          <div class="glass-panel px-6 py-4 text-right backdrop-blur-xl border-r-2 border-[#f5aacb]">
            <div class="text-[10px] text-white/40 uppercase tracking-widest mb-1">Current Sector</div>
            <div class="text-xl font-bold text-white">{{ viewState === 'universe' ? 'MAIN GALAXY CLUSTER' : activeShopName }}</div>
            <div class="text-xs text-[#00ffcc] font-mono mt-1">
              {{ viewState === 'universe' ? `${totalParticles.toLocaleString()} SHOPS` : `${currentSystemParticles.toLocaleString()} ARTIFACTS` }}
            </div>
          </div>

          <button 
            v-if="viewState !== 'universe'" 
            @click="returnToGalaxy"
            class="glass-btn px-6 py-2 text-white hover:text-[#f5aacb] transition-all flex items-center gap-2 group"
          >
            <span class="i-heroicons-arrow-left group-hover:-translate-x-1 transition-transform"></span> 
            EXIT SYSTEM
          </button>
        </div>
      </div>

      <!-- Footer & Detail Panel -->
      <div class="flex justify-between items-end">
        <!-- Hover Info (Follows Selection) -->
        <div v-if="hoveredData" class="glass-panel px-6 py-4 pointer-events-auto animate-fade-in backdrop-blur-xl border-l-2 border-[#00ffcc]">
          <div class="text-[10px] text-[#f5aacb] uppercase tracking-widest mb-1">
            {{ viewState === 'universe' ? 'SHOP DETECTED' : 'ARTIFACT DETECTED' }}
          </div>
          <h2 class="text-2xl font-bold text-white mb-1">{{ hoveredData.name }}</h2>
          
          <div v-if="viewState === 'system'" class="text-xs text-white/60 font-mono">
            <div>RELEASE DATE: <span class="text-white">{{ hoveredData.date }}</span></div>
            <div>PRICE: <span class="text-[#00ffcc]">{{ hoveredData.price }}</span></div>
          </div>
          <div v-else class="text-xs text-white/60 font-mono">
            <div>ID: #{{ hoveredData.id }}</div>
            <div class="mt-1 text-[#00ffcc]">CLICK TO ENTER SYSTEM ></div>
          </div>

          <!-- Interaction Prompt -->
          <div v-if="viewState === 'system'" class="mt-3 pt-3 border-t border-white/10">
             <button @click="openModelViewer" class="text-xs bg-white/10 hover:bg-[#f5aacb] hover:text-black transition-colors px-3 py-1 rounded w-full uppercase font-bold">
               View 3D Model
             </button>
          </div>
        </div>
        
        <!-- Empty div for spacing if no hover -->
        <div v-else></div>

        <!-- Legend -->
        <div class="text-right text-[10px] text-white/30 uppercase tracking-widest font-mono">
          <div v-if="viewState === 'system'">
            <span class="text-[#00ffcc]">●</span> NEWER (OUTER) <br>
            <span class="text-[#3366ff]">●</span> OLDER (INNER)
          </div>
        </div>
      </div>
    </div>

    <!-- Model Viewer Overlay -->
    <Transition name="fade">
      <div v-if="showModelViewer" class="absolute inset-0 z-50 bg-black/90 flex flex-col">
        <div class="absolute top-6 right-6 z-50">
          <button @click="closeModelViewer" class="text-white hover:text-[#f5aacb] text-4xl">&times;</button>
        </div>
        <div ref="modelContainer" class="flex-1 w-full h-full"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import TWEEN from '@tweenjs/tween.js';
import { getShopList } from '@/api/shop';
import { getLibraryList } from '@/api/library';

// --- Configuration ---
const GALAXY_SIZE = 15000; // Simulated shops count
const PARTICLE_SIZE_GALAXY = 4;
const PARTICLE_SIZE_SYSTEM = 3;

// --- State ---
const container = ref<HTMLElement | null>(null);
const modelContainer = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadingStatus = ref('Initializing...');
const viewState = ref<'universe' | 'system'>('universe');
const activeShopName = ref('');
const totalParticles = ref(0);
const currentSystemParticles = ref(0);
const hoveredData = ref<any>(null);
const showModelViewer = ref(false);

// --- Three.js Globals ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let composer: EffectComposer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

// Point Clouds
let galaxyPoints: THREE.Points | null = null;
let systemPoints: THREE.Points | null = null;
let hoverHighlight: THREE.Mesh | null = null; // Cursor highlight

// Data Cache
// We store data in arrays matching the particle index
let galaxyData: any[] = []; 
let systemData: any[] = [];

onMounted(async () => {
  initThree();
  await generateGalaxy();
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

// --- Initialization ---
const initThree = () => {
  if (!container.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.001);

  // Camera
  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 5000);
  camera.position.set(0, 100, 200);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.appendChild(renderer.domElement);

  // Post Processing (Bloom)
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.2;
  bloomPass.strength = 1.2;
  bloomPass.radius = 0.5;
  
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.maxDistance = 1000;

  // Raycaster
  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 2; // Hit tolerance
  mouse = new THREE.Vector2();

  // Highlight Cursor
  const geometry = new THREE.RingGeometry(2, 2.5, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  hoverHighlight = new THREE.Mesh(geometry, material);
  hoverHighlight.visible = false;
  scene.add(hoverHighlight);
};

// --- Generate Galaxy (Shops) ---
const generateGalaxy = async () => {
  loadingStatus.value = `Simulating ${GALAXY_SIZE} Star Systems...`;
  
  // Real Data + Mock Data Filling
  let realShops: any[] = [];
  try {
    const res = await getShopList({ page: 1, pageSize: 100 }); // Get first 100 real
    if (res && res.rows) realShops = res.rows;
  } catch(e) { console.error(e); }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GALAXY_SIZE * 3);
  const colors = new Float32Array(GALAXY_SIZE * 3);
  const sizes = new Float32Array(GALAXY_SIZE);
  
  galaxyData = [];
  const color1 = new THREE.Color(0xf5aacb); // Pink inner
  const color2 = new THREE.Color(0x3366ff); // Blue outer
  
  for (let i = 0; i < GALAXY_SIZE; i++) {
    // Spiral Galaxy Math
    const branchAngle = (i % 3) * ((2 * Math.PI) / 3);
    const radius = Math.random() * 300 + 20; // Spread 20 to 320
    const spinAngle = radius * 0.02; // Twist
    const randomOffset = (Math.random() - 0.5) * 20;

    const angle = branchAngle + spinAngle + Math.random() * 0.5;
    
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 15;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 15;
    const y = (Math.random() - 0.5) * (30 - radius * 0.05); // Flat disk, slightly thicker at center

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color mixing based on radius
    const mixedColor = color1.clone().lerp(color2, radius / 300);
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;

    sizes[i] = PARTICLE_SIZE_GALAXY * (Math.random() * 0.5 + 0.8);

    // Data Mapping
    if (i < realShops.length) {
      galaxyData.push({
        type: 'shop',
        id: realShops[i].shop_id,
        name: realShops[i].shop_name,
        count: realShops[i].count_library
      });
      // Make real shops slightly bigger/distinct
      sizes[i] *= 1.5;
      colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 1; // White highlight
    } else {
      galaxyData.push({
        type: 'shop',
        id: i, // Mock ID
        name: `Sector ${Math.floor(Math.random() * 9000) + 1000} Shop`,
        count: Math.floor(Math.random() * 500)
      });
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Shader Material for nice point sprites
  const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE_GALAXY,
    vertexColors: true,
    map: getDiscTexture(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  galaxyPoints = new THREE.Points(geometry, material);
  scene.add(galaxyPoints);
  totalParticles.value = GALAXY_SIZE;
  loading.value = false;
};

// --- Enter Star System (Libraries) ---
const enterSystem = async (shopData: any) => {
  loading.value = true;
  loadingStatus.value = `Warping to ${shopData.name}...`;
  activeShopName.value = shopData.name;
  hoveredData.value = null;

  // Fly Camera Effect
  const startPos = camera.position.clone();
  const targetPos = new THREE.Vector3(0, 0, 0); // Center of universe
  
  // 1. Fetch Libraries
  let libraries: any[] = [];
  try {
    // Attempt to fetch real data
    const res = await getLibraryList({ 
        filter_list: [{ field: 'shop_id', op: '=', value: shopData.id }],
        page: 1, 
        pageSize: 2000 // Get many!
    });
    if (res && res.rows) libraries = res.rows;
  } catch(e) {}

  // If few libraries, generate mock to look impressive
  if (libraries.length < 500) {
     const needed = 2000 - libraries.length;
     for(let i=0; i<needed; i++) {
        libraries.push({
            library_id: 999999 + i,
            name: `Artifact ${i}`,
            sale_time: new Date(2010 + Math.random()*15, Math.random()*12, 1).toISOString(),
            library_price: Math.floor(Math.random()*20000) + ' JPY'
        });
     }
  }

  // 2. Sort by Date for Time Spiral
  libraries.sort((a, b) => {
    const da = new Date(a.sale_time || '2000-01-01').getTime();
    const db = new Date(b.sale_time || '2000-01-01').getTime();
    return da - db;
  });

  // 3. Build System Geometry
  const geometry = new THREE.BufferGeometry();
  const count = libraries.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  systemData = libraries.map(l => ({
    id: l.library_id,
    name: l.name,
    date: l.sale_time ? l.sale_time.split('T')[0] : 'Unknown',
    price: l.library_price || 'N/A',
    cover: l.cover
  }));

  const minRadius = 10;
  const maxRadius = 150;
  
  for (let i = 0; i < count; i++) {
      // Time Spiral layout
      // i/count represents normalized time (0 = oldest, 1 = newest)
      const t = i / count;
      
      const r = minRadius + t * (maxRadius - minRadius);
      const theta = t * 20 * Math.PI; // 10 full circles
      
      const x = r * Math.cos(theta) + (Math.random()-0.5)*2;
      const z = r * Math.sin(theta) + (Math.random()-0.5)*2;
      const y = (Math.random() - 0.5) * 5;

      positions[i*3] = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      // Color Spectrum: Old (Blue/Purple) -> New (Green/Cyan)
      const color = new THREE.Color();
      color.setHSL(0.6 - t * 0.45, 0.8, 0.5); // 0.6(blue) -> 0.15(green/yellow)
      
      colors[i*3] = color.r;
      colors[i*3+1] = color.g;
      colors[i*3+2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE_SYSTEM,
    vertexColors: true,
    map: getDiscTexture(),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  systemPoints = new THREE.Points(geometry, material);
  systemPoints.scale.set(0,0,0); // Start tiny
  scene.add(systemPoints);
  
  currentSystemParticles.value = count;

  // 4. Animation Transition
  new TWEEN.Tween(galaxyPoints!.material)
    .to({ opacity: 0 }, 1000)
    .onComplete(() => { galaxyPoints!.visible = false; })
    .start();

  new TWEEN.Tween(systemPoints.scale)
    .to({ x: 1, y: 1, z: 1 }, 1500)
    .easing(TWEEN.Easing.Elastic.Out)
    .start();

  // Reset Camera smoothly
  new TWEEN.Tween(camera.position)
    .to({ x: 0, y: 80, z: 120 }, 1500)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();

  controls.autoRotateSpeed = 0.2;
  viewState.value = 'system';
  loading.value = false;
};

const returnToGalaxy = () => {
  if (!systemPoints || !galaxyPoints) return;
  
  viewState.value = 'universe';
  hoveredData.value = null;
  if(hoverHighlight) hoverHighlight.visible = false;

  new TWEEN.Tween(systemPoints.scale)
    .to({ x: 0, y: 0, z: 0 }, 800)
    .onComplete(() => {
        scene.remove(systemPoints!);
        systemPoints = null;
    })
    .start();

  galaxyPoints.visible = true;
  new TWEEN.Tween(galaxyPoints.material)
    .to({ opacity: 0.8 }, 1000)
    .start();

  new TWEEN.Tween(camera.position)
    .to({ x: 0, y: 100, z: 200 }, 1500)
    .start();
    
  controls.autoRotateSpeed = 0.5;
};

// --- Model Viewer ---
const openModelViewer = () => {
    showModelViewer.value = true;
    
    // Init Simple Model Viewer in the overlay
    nextTick(() => {
        if(!modelContainer.value) return;
        
        const w = modelContainer.value.clientWidth;
        const h = modelContainer.value.clientHeight;
        
        const mScene = new THREE.Scene();
        mScene.background = new THREE.Color(0x111111);
        
        const mCam = new THREE.PerspectiveCamera(50, w/h, 0.1, 100);
        mCam.position.set(0, 2, 5);
        
        const mRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        mRenderer.setSize(w, h);
        modelContainer.value.innerHTML = '';
        modelContainer.value.appendChild(mRenderer.domElement);
        
        const mControls = new OrbitControls(mCam, mRenderer.domElement);
        mControls.enableDamping = true;
        
        // Lights
        const amb = new THREE.AmbientLight(0xffffff, 0.5);
        mScene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(5, 5, 5);
        mScene.add(dir);
        
        // Load Model
        const loader = new GLTFLoader();
        // Use a placeholder or real url if hoveredData has it
        const url = 'https://lolitalibrary.com/ali//sence/1.gltf';
        
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const scale = 3 / Math.max(size.x, size.y, size.z);
            model.scale.set(scale, scale, scale);
            model.position.sub(center.multiplyScalar(scale));
            mScene.add(model);
        });
        
        const animateModel = () => {
            if(!showModelViewer.value) {
                mRenderer.dispose();
                return;
            }
            requestAnimationFrame(animateModel);
            mControls.update();
            mRenderer.render(mScene, mCam);
        }
        animateModel();
    });
};

const closeModelViewer = () => {
    showModelViewer.value = false;
};

// --- Utilities ---
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
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// --- Interactions ---
const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  composer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const onMouseMove = (event: MouseEvent) => {
  if (loading.value || showModelViewer.value) return;
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  const target = viewState.value === 'universe' ? galaxyPoints : systemPoints;
  if (!target) return;

  const intersects = raycaster.intersectObject(target);
  
  if (intersects.length > 0) {
    const index = intersects[0].index!;
    const posAttribute = target.geometry.getAttribute('position');
    
    // Position highlight
    if (hoverHighlight) {
        hoverHighlight.visible = true;
        hoverHighlight.position.set(
            posAttribute.getX(index),
            posAttribute.getY(index),
            posAttribute.getZ(index)
        );
        hoverHighlight.lookAt(camera.position);
    }
    
    // Update Data
    const dataList = viewState.value === 'universe' ? galaxyData : systemData;
    if (dataList[index]) {
        hoveredData.value = dataList[index];
        document.body.style.cursor = 'pointer';
    }
  } else {
    hoveredData.value = null;
    if (hoverHighlight) hoverHighlight.visible = false;
    document.body.style.cursor = 'default';
  }
};

const onClick = () => {
  if (hoveredData.value && viewState.value === 'universe') {
    enterSystem(hoveredData.value);
  } else if (hoveredData.value && viewState.value === 'system') {
      // Maybe zoom to library or open stats?
  }
};

const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  
  // Rotate Universe slowly
  if (galaxyPoints && viewState.value === 'universe') {
      galaxyPoints.rotation.y += 0.0002;
  }
  if (systemPoints) {
      systemPoints.rotation.y -= 0.0005; // Counter rotate inner system
  }

  composer.render();
};
</script>

<style scoped>
.glass-panel {
  background: rgba(10, 10, 10, 0.6);
  backdrop-filter: blur(12px);
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.glass-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.animate-spin-reverse {
  animation: spin-reverse 1.5s linear infinite;
}

@keyframes spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
