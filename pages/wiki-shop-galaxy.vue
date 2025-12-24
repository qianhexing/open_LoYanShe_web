<template>
  <div ref="container" class="w-full h-screen relative bg-black overflow-hidden select-none font-sans">
    <!-- Loading Screen -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
        <div class="loader mb-4"></div>
        <div class="text-[#f5aacb] text-xl font-light tracking-widest uppercase animate-pulse">Scanning Galaxy</div>
        <div class="text-white/30 text-xs mt-2">{{ loadingStatus }}</div>
      </div>
    </Transition>

    <!-- HUD -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      <!-- Top Header -->
      <div class="flex justify-between items-start">
        <div class="pointer-events-auto">
          <h1 class="text-4xl font-black text-white tracking-tighter shadow-glow italic">
            <span class="text-[#f5aacb]">LOLITA</span> GALAXY
          </h1>
          <div class="flex items-center gap-2 mt-2">
             <span class="w-2 h-2 rounded-full bg-[#f5aacb] animate-pulse"></span>
             <p class="text-white/60 text-xs uppercase tracking-widest">Live Visualization</p>
          </div>
        </div>

        <div class="flex flex-col items-end gap-3 pointer-events-auto">
          <div class="glass-panel px-5 py-3 text-right backdrop-blur-md">
            <div class="text-xs text-white/40 uppercase mb-1">System Status</div>
            <div class="flex gap-4">
               <div>
                 <div class="text-lg font-bold text-white">{{ shopCount }}</div>
                 <div class="text-[10px] text-[#f5aacb] uppercase">Star Systems</div>
               </div>
               <div>
                 <div class="text-lg font-bold text-white">{{ totalLibraries }}</div>
                 <div class="text-[10px] text-[#00ffcc] uppercase">Planets Detected</div>
               </div>
            </div>
          </div>
          
          <button 
            v-if="viewState !== 'universe'" 
            @click="returnToUniverse"
            class="glass-btn px-6 py-2 text-white hover:text-[#f5aacb] transition-all flex items-center gap-2 group"
          >
            <span class="i-heroicons-arrow-left group-hover:-translate-x-1 transition-transform"></span> 
            RETURN TO GALAXY
          </button>
        </div>
      </div>

      <!-- Bottom Info -->
      <div class="flex justify-between items-end">
        <!-- Navigation Guide -->
        <div class="glass-panel px-4 py-3 text-white/40 text-[10px] uppercase tracking-wider backdrop-blur-sm">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1"><span class="i-heroicons-cursor-click"></span> Select</span>
            <span class="flex items-center gap-1"><span class="i-heroicons-arrows-pointing-out"></span> Drag Rotate</span>
            <span class="flex items-center gap-1"><span class="i-heroicons-magnifying-glass"></span> Zoom</span>
          </div>
        </div>
        
        <!-- Dynamic Detail Panel -->
        <Transition name="slide-up">
          <div v-if="selectedObject" class="glass-panel px-8 py-6 pointer-events-auto max-w-md backdrop-blur-xl border-l-4 border-[#f5aacb]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[#f5aacb] text-xs font-bold uppercase tracking-widest py-1 px-2 bg-[#f5aacb]/10 rounded">
                {{ selectedObject.type === 'shop' ? 'STAR SYSTEM' : 'PLANETARY ARTIFACT' }}
              </span>
              <span class="text-white/30 text-xs font-mono">ID: #{{ selectedObject.data.id }}</span>
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2 leading-tight shadow-text">{{ selectedObject.data.name }}</h2>
            
            <div v-if="selectedObject.type === 'shop'" class="text-white/60 text-sm mb-4">
              <p>Contains {{ selectedObject.data.count }} known artifacts.</p>
              <p class="mt-2 text-xs text-white/30">Click to enter system orbit.</p>
            </div>
            
            <div v-if="selectedObject.type === 'library'" class="space-y-3">
              <div v-if="selectedObject.data.cover" class="w-full h-32 rounded-lg overflow-hidden relative group cursor-pointer border border-white/10">
                <img :src="selectedObject.data.cover" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                  <span class="text-white text-xs font-bold flex items-center gap-1">
                    <span class="i-heroicons-eye"></span> View Model
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-white/5 p-2 rounded">
                  <span class="text-white/30 block">Price</span>
                  <span class="text-[#00ffcc] font-mono">{{ selectedObject.data.price || 'N/A' }}</span>
                </div>
                <div class="bg-white/5 p-2 rounded">
                  <span class="text-white/30 block">Style</span>
                  <span class="text-[#f5aacb] font-mono">{{ selectedObject.data.style || 'Unknown' }}</span>
                </div>
              </div>
              <button @click="enterModelView" class="w-full mt-2 bg-[#f5aacb] text-black font-bold py-3 rounded hover:bg-white transition-colors uppercase text-xs tracking-wider">
                Initialize Model Viewer
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { Text } from 'troika-three-text';
import TWEEN from '@tweenjs/tween.js';
import { getShopList } from '@/api/shop';
import { getLibraryList } from '@/api/library';

// --- Types ---
type ViewState = 'universe' | 'system' | 'model';

// --- State ---
const container = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const loadingStatus = ref('Initializing...');
const viewState = ref<ViewState>('universe');
const shopCount = ref(0);
const totalLibraries = ref(0);
const selectedObject = ref<any>(null);

// --- Three.js ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

// Groups
const universeGroup = new THREE.Group();
const systemGroup = new THREE.Group();
const modelGroup = new THREE.Group();

// Cache
const shopsData = ref<any[]>([]);
const activeShopId = ref<number | null>(null);
const objectMap = new Map<string, any>(); // UUID -> Data

// Constants
const STAR_COLOR = 0xff3366; // Pink/Red for shops
const PLANET_COLOR = 0x00ffcc; // Cyan for libraries
const SYSTEM_RADIUS = 60; 

onMounted(async () => {
  initThree();
  createStarField();
  await loadShops();
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
  renderer.dispose();
  composer.dispose();
});

const initThree = () => {
  if (!container.value) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.002);

  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 2000);
  camera.position.set(0, 50, 150);

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ReinhardToneMapping;
  container.value.appendChild(renderer.domElement);

  // Post Processing
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
  controls.maxDistance = 500;

  scene.add(universeGroup);
  scene.add(systemGroup);
  scene.add(modelGroup);
  
  systemGroup.visible = false;
  modelGroup.visible = false;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Lights
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 2, 1000);
  scene.add(pointLight);
};

const createStarField = () => {
  const geometry = new THREE.BufferGeometry();
  const count = 5000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 1000 * Math.pow(Math.random(), 0.5);
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const color = new THREE.Color();
    color.setHSL(0.6 + Math.random() * 0.2, 0.5, Math.random());
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
};

const loadShops = async () => {
  loadingStatus.value = 'Downloading Star Maps...';
  try {
    const res = await getShopList({ page: 1, pageSize: 50 });
    if (res && res.rows) {
      shopsData.value = res.rows;
      shopCount.value = res.rows.length;
      totalLibraries.value = res.rows.reduce((acc, s) => acc + (s.count_library || 0), 0);
      buildUniverse(res.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const buildUniverse = (shops: any[]) => {
  // Use a helical or spiral galaxy layout
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  
  shops.forEach((shop, i) => {
    // Spiral layout
    const distance = Math.sqrt(i + 1) * 20;
    const theta = i * goldenAngle;
    const x = distance * Math.cos(theta);
    const z = distance * Math.sin(theta);
    const y = (Math.random() - 0.5) * 10; // Flat galaxy

    // Star Mesh
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: STAR_COLOR,
      emissive: STAR_COLOR,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.userData = { type: 'shop', id: shop.shop_id, data: {
      name: shop.shop_name,
      count: shop.count_library,
      id: shop.shop_id
    }};
    
    // Add Glow Sprite
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/spark1.png'), 
      color: STAR_COLOR, 
      blending: THREE.AdditiveBlending 
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(12, 12, 1);
    mesh.add(sprite);

    // Text Label
    const text = new Text();
    text.text = shop.shop_name;
    text.fontSize = 1.5;
    text.position.set(0, 3.5, 0);
    text.color = 0xffffff;
    text.anchorX = 'center';
    text.anchorY = 'bottom';
    text.outlineWidth = 0.1;
    text.outlineColor = 0x000000;
    text.sync();
    mesh.add(text);

    universeGroup.add(mesh);
    objectMap.set(mesh.uuid, mesh.userData);
  });
};

const enterSystem = async (shopId: number) => {
  if (activeShopId.value === shopId) return;
  activeShopId.value = shopId;
  loading.value = true;
  loadingStatus.value = 'Entering Star System...';

  // 1. Fetch Libraries
  try {
    const res = await getLibraryList({ 
        filter_list: [{ field: 'shop_id', op: '=', value: shopId }],
        page: 1,
        pageSize: 100 // Limit for performance
    });
    
    // 2. Clear previous system
    systemGroup.clear();
    
    // 3. Build System
    // Central Star (The Shop)
    const starGeo = new THREE.SphereGeometry(5, 64, 64);
    const starMat = new THREE.MeshBasicMaterial({ color: STAR_COLOR });
    const star = new THREE.Mesh(starGeo, starMat);
    systemGroup.add(star);
    
    // Light from star
    const light = new THREE.PointLight(STAR_COLOR, 3, 200);
    star.add(light);

    if (res && res.rows) {
      const libs = res.rows;
      // Orbit rings
      libs.forEach((lib, i) => {
        const angle = (i / libs.length) * Math.PI * 2;
        const radius = 20 + (i % 3) * 10 + Math.random() * 5; // Variation
        
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        const planetGeo = new THREE.SphereGeometry(1, 16, 16);
        const planetMat = new THREE.MeshStandardMaterial({
            color: PLANET_COLOR,
            emissive: PLANET_COLOR,
            emissiveIntensity: 0.2,
            roughness: 0.3
        });
        
        const planet = new THREE.Mesh(planetGeo, planetMat);
        planet.position.set(x, 0, z); // Simple flat system for now, or randomize Y
        
        planet.userData = { 
            type: 'library', 
            id: lib.library_id, 
            data: {
                name: lib.name,
                cover: lib.cover ? 'https://lolitalibrary.com/ali/' + lib.cover : null,
                price: lib.library_price,
                style: lib.main_style,
                id: lib.library_id
            }
        };

        // Planet Label
        const text = new Text();
        text.text = lib.name.length > 10 ? lib.name.substring(0, 10) + '...' : lib.name;
        text.fontSize = 0.6;
        text.position.set(0, 1.5, 0);
        text.color = 0xccffff;
        text.anchorX = 'center';
        text.anchorY = 'bottom';
        text.outlineWidth = 0.05;
        text.outlineColor = 0x000000;
        // Optimization: Only render if close? For now render all
        text.sync();
        planet.add(text);

        // Orbit Line
        const orbitGeo = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 64);
        const orbitMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.05 
        });
        const orbit = new THREE.Mesh(orbitGeo, orbitMat);
        orbit.rotation.x = Math.PI / 2;
        systemGroup.add(orbit);

        systemGroup.add(planet);
        objectMap.set(planet.uuid, planet.userData);
      });
    }

    // 4. Transition
    viewState.value = 'system';
    universeGroup.visible = false;
    systemGroup.visible = true;
    
    // Reset Camera
    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 40, z: 60 }, 1500)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
        
    controls.maxDistance = 100;
    
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const returnToUniverse = () => {
  viewState.value = 'universe';
  systemGroup.visible = false;
  modelGroup.visible = false;
  universeGroup.visible = true;
  activeShopId.value = null;
  selectedObject.value = null;

  controls.maxDistance = 500;
  
  new TWEEN.Tween(camera.position)
      .to({ x: 0, y: 50, z: 150 }, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
};

const enterModelView = () => {
    viewState.value = 'model';
    systemGroup.visible = false;
    modelGroup.visible = true;
    
    loading.value = true;
    const loader = new GLTFLoader();
    // Placeholder model
    loader.load('https://lolitalibrary.com/ali//sence/1.gltf', (gltf) => {
        modelGroup.clear();
        const model = gltf.scene;
        
        // Normalize
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10 / maxDim;
        
        model.scale.set(scale, scale, scale);
        model.position.copy(center).multiplyScalar(-scale);
        
        modelGroup.add(model);
        
        // Add specific lights for model
        const spot = new THREE.SpotLight(0xffffff, 3);
        spot.position.set(10, 20, 10);
        modelGroup.add(spot);
        
        loading.value = false;
    });
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
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Basic hover effect could be added here if needed
};

const onClick = (event: MouseEvent) => {
  if (viewState.value === 'model') return;

  raycaster.setFromCamera(mouse, camera);
  const targetGroup = viewState.value === 'universe' ? universeGroup : systemGroup;
  const intersects = raycaster.intersectObjects(targetGroup.children, true); // Recursive

  if (intersects.length > 0) {
    // Find first object with userData
    const hit = intersects.find(i => i.object.userData && i.object.userData.type);
    
    if (hit) {
      const data = hit.object.userData;
      selectedObject.value = data;
      
      // Fly to object
      const objPos = new THREE.Vector3();
      hit.object.getWorldPosition(objPos);
      
      const offset = objPos.clone().normalize().multiplyScalar(20);
      if (viewState.value === 'universe') offset.y += 10;
      
      new TWEEN.Tween(controls.target)
          .to({ x: objPos.x, y: objPos.y, z: objPos.z }, 1000)
          .easing(TWEEN.Easing.Cubic.Out)
          .start();

      // If in universe and clicked shop, double click or button to enter? 
      // Let's say click selects, double click enters. 
      // Or just a button in the UI "Enter System"
      
      if (data.type === 'shop') {
          // Auto enter after short delay or wait for UI?
          // Let's auto enter for smooth experience
          setTimeout(() => enterSystem(data.id), 800);
      }
    }
  } else {
    selectedObject.value = null;
  }
};

const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  
  // Billboard Text
  scene.traverse((obj) => {
    if (obj instanceof Text) {
      obj.lookAt(camera.position);
    }
  });
  
  // Rotation
  if (viewState.value === 'universe') {
      universeGroup.rotation.y += 0.0005;
  } else if (viewState.value === 'system') {
      systemGroup.rotation.y += 0.001;
      // Also rotate planets locally?
  }

  composer.render();
};
</script>

<style scoped>
.loader {
  width: 48px;
  height: 48px;
  border: 3px solid #FFF;
  border-bottom-color: #f5aacb;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.glass-panel {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.glass-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  backdrop-filter: blur(4px);
}

.shadow-glow { text-shadow: 0 0 20px rgba(245, 170, 203, 0.6); }
.shadow-text { text-shadow: 0 2px 10px rgba(0,0,0,0.5); }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(40px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
