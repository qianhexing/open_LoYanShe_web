<template>
  <div ref="container" class="w-full h-screen relative bg-black overflow-hidden select-none">
    <!-- Loading Screen -->
    <Transition name="fade">
      <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
        <div class="loader mb-4"></div>
        <div class="text-[#f5aacb] text-xl font-light tracking-widest uppercase">Initializing Universe</div>
      </div>
    </Transition>

    <!-- UI Overlay (HUD) -->
    <div class="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
      <!-- Top Bar -->
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold text-white/90 tracking-tighter shadow-glow">WIKI COSMOS</h1>
          <p class="text-white/50 text-sm mt-1">Interactive 3D Visualization</p>
        </div>
        <div class="flex flex-col items-end gap-2 pointer-events-auto">
          <div class="glass-panel px-4 py-2 text-xs text-white/70">
            <span class="text-[#f5aacb] font-bold">{{ nodeCount }}</span> NODES DETECTED
          </div>
          <button 
            v-if="showModel" 
            @click="closeModel"
            class="glass-btn px-6 py-2 text-white hover:text-[#f5aacb] transition-all flex items-center gap-2"
          >
            <span class="i-heroicons-arrow-left"></span> RETURN TO ORBIT
          </button>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="flex justify-between items-end">
        <div class="text-white/30 text-xs max-w-md">
          <p>NAVIGATION SYSTEM:</p>
          <p class="mt-1">• Left Click to Select / Focus</p>
          <p>• Right Click / Drag to Rotate</p>
          <p>• Scroll to Zoom</p>
        </div>
        
        <!-- Hover Info -->
        <Transition name="slide-up">
          <div v-if="hoverInfo.visible && !showModel" class="glass-panel px-6 py-4 pointer-events-auto max-w-sm">
            <div class="text-[#f5aacb] text-xs uppercase tracking-widest mb-1">Detected Entity</div>
            <div class="text-white text-xl font-bold mb-1">{{ hoverInfo.name }}</div>
            <div class="text-white/50 text-sm" v-if="hoverInfo.isLeaf">Type: Artifact (Leaf)</div>
            <div class="text-white/50 text-sm" v-else>Type: Cluster Node</div>
            <div v-if="hoverInfo.isLeaf" class="mt-3 text-xs text-[#f5aacb]/80 animate-pulse">
              Click to Analyze Model >
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
import { getWikiTree } from '@/api/statistics';
import type { WikiTreeNode } from '@/api/statistics';
import TWEEN from '@tweenjs/tween.js';

// --- State ---
const container = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const showModel = ref(false);
const nodeCount = ref(0);
const hoverInfo = reactive({ visible: false, name: '', isLeaf: false, id: 0 });

// --- Three.js Globals ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let nodesGroup: THREE.Group;
let linesGroup: THREE.Group;
let starField: THREE.Points;
let modelGroup: THREE.Group;
let animationId: number;

// Objects Map for interaction
const nodeMeshMap = new Map<number, THREE.Mesh>();
const nodeDataMap = new Map<number, WikiTreeNode>();
const textMeshMap = new Map<number, any>(); // Troika text instance
let hoveredNodeId: number | null = null;
let selectedNodeId: number | null = null;

// Route
const route = useRoute();
const wikiId = route.query.wiki_id ? Number(route.query.wiki_id) : 1;

// --- Colors ---
const COLOR_ROOT = 0xff3366;
const COLOR_BRANCH = 0x4488ff;
const COLOR_LEAF = 0x00ffcc;
const COLOR_LINE = 0x334466;
const COLOR_HOVER = 0xffffff;

// --- Lifecycle ---
onMounted(async () => {
  initThree();
  initStars();
  await loadData();
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

// --- Initialization ---
const initThree = () => {
  if (!container.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.001);

  // Camera
  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 2000);
  camera.position.set(0, 30, 100);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); // Antialias false for post-processing performance
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ReinhardToneMapping;
  container.value.appendChild(renderer.domElement);

  // Post Processing (Bloom)
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0;
  bloomPass.strength = 1.2; // High glow
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
  controls.maxDistance = 500;
  controls.minDistance = 10;

  // Groups
  nodesGroup = new THREE.Group();
  linesGroup = new THREE.Group();
  modelGroup = new THREE.Group();
  scene.add(linesGroup); // Lines first (behind nodes)
  scene.add(nodesGroup);
  scene.add(modelGroup);

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
};

const initStars = () => {
  const geometry = new THREE.BufferGeometry();
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 800 * Math.sqrt(Math.random()); // Even distribution in sphere volume-ish
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Star colors (bluish white to reddish white)
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.2, 0.8);
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
    opacity: 0.8,
    sizeAttenuation: true
  });

  starField = new THREE.Points(geometry, material);
  scene.add(starField);
};

// --- Data & Layout ---
const loadData = async () => {
  try {
    const res = await getWikiTree({ wiki_id: wikiId });
    if (res && res.data) {
      buildGraph(res.data);
    } else {
      // Mock data if API fails
      buildGraph(generateMockData());
    }
    loading.value = false;
  } catch (error) {
    console.error(error);
    loading.value = false;
    // Fallback
    buildGraph(generateMockData());
  }
};

const generateMockData = () => {
    // Generate a deep tree
    const root: WikiTreeNode = { wiki_id: 1, wiki_name: 'Origin', child: [] };
    
    const addChildren = (parent: WikiTreeNode, depth: number) => {
        if (depth > 3) return;
        const count = 3 + Math.floor(Math.random() * 5);
        parent.child = parent.child || [];
        for (let i = 0; i < count; i++) {
            const node: WikiTreeNode = {
                wiki_id: Math.floor(Math.random() * 100000) + i,
                wiki_name: `Entity-${depth}-${i}`,
                child: []
            };
            parent.child.push(node);
            addChildren(node, depth + 1);
        }
    };
    addChildren(root, 1);
    return root;
};

// 3D Layout Algorithm
const buildGraph = (data: WikiTreeNode) => {
  // Reset
  nodesGroup.clear();
  linesGroup.clear();
  nodeMeshMap.clear();
  nodeDataMap.clear();
  textMeshMap.clear();
  let count = 0;

  // Recursive placement
  // Strategy: Root at 0. Children placed in shells.
  // To avoid overlap, we use vector direction from parent.
  
  const placeNode = (node: WikiTreeNode, position: THREE.Vector3, parentPos: THREE.Vector3 | null, level: number) => {
    count++;
    nodeDataMap.set(node.wiki_id, node);

    // 1. Create Node Visual
    const isLeaf = !node.child || node.child.length === 0;
    const baseSize = isLeaf ? 1 : (level === 0 ? 4 : 2);
    const geometry = new THREE.SphereGeometry(baseSize, 32, 32);
    
    let color = COLOR_BRANCH;
    if (level === 0) color = COLOR_ROOT;
    else if (isLeaf) color = COLOR_LEAF;

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.8
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.userData = { id: node.wiki_id, level, isLeaf, originalColor: color, originalScale: baseSize };
    nodesGroup.add(mesh);
    nodeMeshMap.set(node.wiki_id, mesh);

    // 2. Create Label (Initially hidden or minimal)
    const text = new Text();
    text.text = node.wiki_name;
    text.fontSize = level === 0 ? 2 : 1.2;
    text.position.set(0, baseSize + 0.5, 0); // Relative to mesh
    text.color = 0xffffff;
    text.anchorX = 'center';
    text.anchorY = 'bottom';
    text.fillOpacity = 0; // Hide by default, show on hover
    text.sync();
    mesh.add(text); // Add as child so it moves with mesh
    textMeshMap.set(node.wiki_id, text);

    // 3. Create Line to Parent
    if (parentPos) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([parentPos, position]);
      const lineMat = new THREE.LineBasicMaterial({ 
        color: COLOR_LINE, 
        transparent: true, 
        opacity: 0.3,
        blending: THREE.AdditiveBlending 
      });
      const line = new THREE.Line(lineGeo, lineMat);
      linesGroup.add(line);
    }

    // 4. Recurse children
    if (node.child && node.child.length > 0) {
      // Calculate child positions
      // Cone expansion:
      // Direction = (position - parentPos).normalize(). 
      // If root, direction is random or Up.
      
      let direction = new THREE.Vector3(0, 1, 0);
      if (parentPos) {
        direction.subVectors(position, parentPos).normalize();
      } else {
        // Root has no parent, children explode in all directions (sphere)
      }

      const childCount = node.child.length;
      // Radius depends on level to separate clusters
      const radius = level === 0 ? 40 : (20 / (level * 0.8)); 
      
      // Distribute points
      if (level === 0) {
         // Root children: Fibonacci Sphere
         const phi = Math.PI * (3 - Math.sqrt(5));
         for (let i = 0; i < childCount; i++) {
           const y = 1 - (i / (childCount - 1)) * 2;
           const radiusAtY = Math.sqrt(1 - y * y);
           const theta = phi * i;
           const x = Math.cos(theta) * radiusAtY;
           const z = Math.sin(theta) * radiusAtY;
           
           const childPos = new THREE.Vector3(x, y, z).multiplyScalar(radius).add(position);
           placeNode(node.child[i], childPos, position, level + 1);
         }
      } else {
        // Branch children: Cone around 'direction'
        // Construct a coordinate system based on 'direction'
        const axisA = new THREE.Vector3(0, 1, 0);
        if (Math.abs(direction.dot(axisA)) > 0.99) axisA.set(1, 0, 0);
        const axisB = new THREE.Vector3().crossVectors(direction, axisA).normalize();
        const axisC = new THREE.Vector3().crossVectors(direction, axisB).normalize();

        const angleStep = (Math.PI * 2) / childCount;
        // Cone spread angle
        const coneAngle = Math.PI / 4; // 45 degrees

        for (let i = 0; i < childCount; i++) {
            // Randomize slightly to look organic
            const spread = coneAngle * (0.8 + Math.random() * 0.4); 
            const rotAngle = i * angleStep;

            // Compute local position in cone
            // Base vector is 'direction' rotated? 
            // Simplified: offset from 'direction' vector
            
            const offset = new THREE.Vector3();
            offset.addScaledVector(axisB, Math.cos(rotAngle) * Math.sin(spread));
            offset.addScaledVector(axisC, Math.sin(rotAngle) * Math.sin(spread));
            offset.addScaledVector(direction, Math.cos(spread));
            
            const childPos = offset.normalize().multiplyScalar(radius).add(position);
            placeNode(node.child[i], childPos, position, level + 1);
        }
      }
    }
  };

  placeNode(data, new THREE.Vector3(0, 0, 0), null, 0);
  nodeCount.value = count;
  
  // Show root text by default
  const rootText = textMeshMap.get(data.wiki_id);
  if (rootText) rootText.fillOpacity = 1;
};

// --- Interactions ---
const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  composer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const updateHover = () => {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodesGroup.children);

  if (intersects.length > 0) {
    const object = intersects[0].object as THREE.Mesh;
    const id = object.userData.id;

    if (hoveredNodeId !== id) {
      // Restore previous
      if (hoveredNodeId !== null) {
        setNodeEmissive(hoveredNodeId, false);
      }
      
      // Set new
      hoveredNodeId = id;
      setNodeEmissive(id, true);
      
      // Update HUD
      const data = nodeDataMap.get(id);
      if (data) {
        hoverInfo.visible = true;
        hoverInfo.name = data.wiki_name;
        hoverInfo.isLeaf = object.userData.isLeaf;
        hoverInfo.id = id;
      }

      // Stop auto rotation when interacting
      controls.autoRotate = false;
    }
  } else {
    if (hoveredNodeId !== null) {
      setNodeEmissive(hoveredNodeId, false);
      hoveredNodeId = null;
      hoverInfo.visible = false;
      controls.autoRotate = true;
    }
  }
};

const setNodeEmissive = (id: number, active: boolean) => {
  const mesh = nodeMeshMap.get(id);
  const text = textMeshMap.get(id);
  if (!mesh) return;

  const mat = mesh.material as THREE.MeshStandardMaterial;
  const originalColor = new THREE.Color(mesh.userData.originalColor);
  const originalScale = mesh.userData.originalScale;

  if (active) {
    // Highlight
    mat.emissive.setHex(COLOR_HOVER);
    mat.emissiveIntensity = 2;
    // Scale up
    new TWEEN.Tween(mesh.scale)
        .to({ x: 1.5, y: 1.5, z: 1.5 }, 200)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    
    // Show text
    if (text) {
        text.fillOpacity = 1;
        text.lookAt(camera.position); // Billboard
    }
  } else {
    // Restore
    mat.emissive.set(originalColor);
    mat.emissiveIntensity = 0.5;
    
    new TWEEN.Tween(mesh.scale)
        .to({ x: 1, y: 1, z: 1 }, 200)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    // Hide text unless it's root or selected (implementation detail: let's hide all non-hovered for clean look)
    if (text && id !== 1) { // Assuming 1 is root
        text.fillOpacity = 0;
    }
  }
};

const onMouseMove = (event: MouseEvent) => {
  if (showModel.value) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
};

const onClick = (event: MouseEvent) => {
  if (showModel.value) return;
  
  // Check click on nodes
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodesGroup.children);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    const data = object.userData;

    // Fly to node
    const targetPos = object.position.clone();
    const offset = targetPos.clone().normalize().multiplyScalar(20); // Stand back a bit
    const camPos = targetPos.clone().add(offset);
    
    // Animate Camera
    new TWEEN.Tween(camera.position)
        .to({ x: camPos.x, y: camPos.y + 10, z: camPos.z }, 1000)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
    
    new TWEEN.Tween(controls.target)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1000)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    // If Leaf, load model
    if (data.isLeaf) {
      loadModel();
    }
  }
};

// --- Model Viewer ---
const loadModel = () => {
  // Hide universe
  new TWEEN.Tween(nodesGroup.scale).to({ x: 0, y: 0, z: 0 }, 500).start();
  new TWEEN.Tween(linesGroup.scale).to({ x: 0, y: 0, z: 0 }, 500).start();
  
  setTimeout(() => {
    loading.value = true;
    nodesGroup.visible = false;
    linesGroup.visible = false;
    modelGroup.visible = true;

    const loader = new GLTFLoader();
    const url = 'https://lolitalibrary.com/ali//sence/1.gltf';
    
    loader.load(url, (gltf) => {
      modelGroup.clear();
      const model = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 20 / maxDim;
      
      model.scale.set(scale, scale, scale);
      model.position.copy(center).multiplyScalar(-scale); // Center at 0,0,0
      
      modelGroup.add(model);
      
      // Light up the model specifically
      const spotLight = new THREE.SpotLight(0xffffff, 2);
      spotLight.position.set(20, 50, 20);
      spotLight.angle = 0.5;
      spotLight.penumbra = 1;
      modelGroup.add(spotLight);

      showModel.value = true;
      loading.value = false;
      
      // Reset controls for model
      controls.target.set(0,0,0);
      new TWEEN.Tween(camera.position).to({ x: 0, y: 10, z: 40 }, 1000).start();
      
    }, undefined, (err) => {
        console.error(err);
        loading.value = false;
    });
  }, 500);
};

const closeModel = () => {
  showModel.value = false;
  modelGroup.visible = false;
  nodesGroup.visible = true;
  linesGroup.visible = true;
  
  new TWEEN.Tween(nodesGroup.scale).to({ x: 1, y: 1, z: 1 }, 500).start();
  new TWEEN.Tween(linesGroup.scale).to({ x: 1, y: 1, z: 1 }, 500).start();
  
  // Fly back to overview
  new TWEEN.Tween(camera.position).to({ x: 0, y: 30, z: 100 }, 1500).start();
  new TWEEN.Tween(controls.target).to({ x: 0, y: 0, z: 0 }, 1500).start();
  
  controls.autoRotate = true;
};

// --- Animation Loop ---
const animate = (time?: number) => {
  animationId = requestAnimationFrame(animate);
  TWEEN.update(time);
  controls.update();
  
  // Mouse hover logic in loop
  if (!showModel.value) {
    updateHover();
    
    // Rotate stars slowly
    if (starField) {
        starField.rotation.y += 0.0005;
    }
    
    // Billboard all visible texts
    textMeshMap.forEach(text => {
        if (text.fillOpacity > 0.1) {
            text.lookAt(camera.position);
        }
    });
  }

  // Use composer for bloom
  composer.render();
};
</script>

<style scoped>
.loader {
  width: 48px;
  height: 48px;
  border: 5px solid #FFF;
  border-bottom-color: #f5aacb;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.glass-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #f5aacb;
}

.shadow-glow {
  text-shadow: 0 0 10px rgba(245, 170, 203, 0.5), 0 0 20px rgba(245, 170, 203, 0.3);
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }
</style>
