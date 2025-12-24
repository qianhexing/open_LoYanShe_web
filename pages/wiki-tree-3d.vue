<template>
  <div ref="container" class="w-full h-screen relative bg-[#fff0f5] overflow-hidden">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/20 z-50">
      <div class="text-[#d86c9b] text-xl font-bold">Loading...</div>
    </div>
    
    <div v-if="showModel" class="absolute top-4 left-4 z-10">
      <button 
        @click="closeModel"
        class="px-4 py-2 bg-[#ffe6f0] text-[#d86c9b] rounded-lg border border-[#f9c3d1] hover:bg-[#ffd1e1] transition-colors shadow-sm font-comic"
      >
        Back to Tree
      </button>
    </div>

    <!-- Info/Tooltip simulation -->
    <div 
      v-if="hoverInfo.visible && !showModel"
      :style="{ left: hoverInfo.x + 'px', top: hoverInfo.y + 'px' }"
      class="absolute pointer-events-none bg-[#ffe4ec] border border-[#f9c3d1] text-[#c94e85] text-xs p-2 rounded shadow-md z-20"
    >
      {{ hoverInfo.name }}
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Text } from 'troika-three-text';
import { getWikiTree } from '@/api/statistics';
import type { WikiTreeNode } from '@/api/statistics';

const container = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const showModel = ref(false);
const hoverInfo = reactive({ visible: false, x: 0, y: 0, name: '' });

// Three.js variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let treeGroup: THREE.Group;
let modelGroup: THREE.Group;
let animationId: number;
let hoveredNode: THREE.Object3D | null = null;

// Data
const route = useRoute();
const wikiId = route.query.wiki_id ? Number(route.query.wiki_id) : 1; // Default to 1 if not provided

onMounted(async () => {
  initThree();
  await loadData();
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', onClick);
  animate();
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onClick);
  if (animationId) cancelAnimationFrame(animationId);
  if (renderer) renderer.dispose();
  if (controls) controls.dispose();
});

const initThree = () => {
  if (!container.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfff0f5);
  scene.fog = new THREE.Fog(0xfff0f5, 20, 100);

  // Camera
  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 40);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 10, 10);
  scene.add(dirLight);

  // Groups
  treeGroup = new THREE.Group();
  scene.add(treeGroup);
  
  modelGroup = new THREE.Group();
  scene.add(modelGroup);
  modelGroup.visible = false;

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getWikiTree({ wiki_id: wikiId });
    if (res && res.data) {
      // Assuming res.data is the root node or list. 
      // The user snippet implies res.data needs formatting or is the tree.
      // Based on typical recursive structures:
      buildTree(res.data);
    } else {
        // Fallback mock data if API fails or returns empty (for dev purposes)
        const mockData: WikiTreeNode = {
            wiki_id: 1,
            wiki_name: 'Mock Root',
            child: [
                { wiki_id: 2, wiki_name: 'Child 1', child: [
                    { wiki_id: 3, wiki_name: 'Leaf 1' },
                    { wiki_id: 4, wiki_name: 'Leaf 2' }
                ]},
                { wiki_id: 5, wiki_name: 'Child 2', child: [
                    { wiki_id: 6, wiki_name: 'Leaf 3' }
                ]}
            ]
        };
        // buildTree(mockData);
    }
  } catch (error) {
    console.error('Failed to load wiki tree', error);
  } finally {
    loading.value = false;
  }
};

const buildTree = (data: WikiTreeNode) => {
  // Clear existing
  while(treeGroup.children.length > 0){ 
      treeGroup.remove(treeGroup.children[0]); 
  }

  // Simple layout: Radial or Layered?
  // Let's do a 3D Layered layout. 
  // Root at (0,0,0). Children in semi-circle or grid at z or y offset.
  
  const levels: WikiTreeNode[][] = [];
  
  const traverse = (node: WikiTreeNode, depth: number) => {
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    if (node.child) {
      node.child.forEach(c => traverse(c, depth + 1));
    }
  };
  traverse(data, 0);

  // Calculate positions
  // We need to link parents and children. So maybe a recursive build is better to draw lines.
  
  // Let's assign positions first.
  // Using a simple algorithm: assign x,y based on index in level, z based on depth.
  // To make it look like a tree, we need to center children under parents.
  
  const nodeRadius = 2;
  const levelHeight = 8;
  
  const nodeMap = new Map<number, THREE.Vector3>();

  // Re-traverse to set positions. 
  // A better way for 3D tree is to use a cone/sphere distribution or just 2D layout in 3D space.
  // Let's stick to a 2D layout projected in 3D (X-Y plane, Z=0) or X-Z plane?
  // User asked for "3D visualization".
  // Let's do a cylindrical layout? Depth = Y axis. Angle = X/Z.
  // Or: Depth = Z. X/Y spread.
  
  const setPosition = (node: WikiTreeNode, x: number, y: number, z: number, rangeWidth: number) => {
    const vector = new THREE.Vector3(x, y, z);
    nodeMap.set(node.wiki_id, vector);

    // Create visual node
    const geometry = new THREE.SphereGeometry(0.8, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xf5aacb });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(vector);
    mesh.userData = { id: node.wiki_id, name: node.wiki_name, isLeaf: !node.child || node.child.length === 0 };
    treeGroup.add(mesh);

    // Label
    const myText = new Text();
    myText.text = node.wiki_name;
    myText.fontSize = 0.8;
    myText.position.set(x, y - 1.5, z);
    myText.color = 0xd86c9b;
    myText.anchorX = 'center';
    myText.anchorY = 'top';
    myText.sync();
    treeGroup.add(myText);

    if (node.child && node.child.length > 0) {
      const childCount = node.child.length;
      // Spread children below parent
      const widthPerChild = rangeWidth / childCount;
      const startX = x - rangeWidth / 2 + widthPerChild / 2;
      
      node.child.forEach((child, index) => {
        const childX = startX + index * widthPerChild;
        const childY = y - levelHeight;
        const childZ = z + (Math.random() - 0.5) * 5; // Add some depth variation for 3D effect
        
        setPosition(child, childX, childY, 0, widthPerChild); // Keep Z relatively flat for readability or curve it?
        
        // Draw line
        const points = [];
        points.push(new THREE.Vector3(x, y, z));
        points.push(new THREE.Vector3(childX, childY, 0));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xf9c3d1 });
        const line = new THREE.Line(lineGeo, lineMat);
        treeGroup.add(line);
      });
    }
  };

  // Initial call
  setPosition(data, 0, 10, 0, 40); // Start high up
  
  // Center camera on root roughly
  controls.target.set(0, 0, 0);
  camera.position.set(0, 20, 60);
  controls.update();
};

const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const onMouseMove = (event: MouseEvent) => {
  if (showModel.value) {
    hoverInfo.visible = false;
    return;
  }
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(treeGroup.children);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    // Check if it's a node (Mesh) not line or text
    if (object instanceof THREE.Mesh) {
      if (hoveredNode !== object) {
        hoveredNode = object;
        document.body.style.cursor = 'pointer';
      }
      hoverInfo.visible = true;
      hoverInfo.x = event.clientX + 10;
      hoverInfo.y = event.clientY + 10;
      hoverInfo.name = object.userData.name;
    }
  } else {
    if (hoveredNode) {
      hoveredNode = null;
      document.body.style.cursor = 'default';
    }
    hoverInfo.visible = false;
  }
};

const onClick = (event: MouseEvent) => {
  if (showModel.value) return;
  
  // Raycast already updated in mousemove, but update again for click precision
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(treeGroup.children);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    if (object instanceof THREE.Mesh && object.userData.isLeaf) {
      loadModel();
    }
  }
};

const loadModel = () => {
  loading.value = true;
  const loader = new GLTFLoader();
  const url = 'https://lolitalibrary.com/ali//sence/1.gltf';
  
  loader.load(url, (gltf) => {
    // Clear previous model
    while(modelGroup.children.length > 0) {
      modelGroup.remove(modelGroup.children[0]);
    }
    
    const model = gltf.scene;
    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Normalize scale
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxDim;
    model.scale.set(scale, scale, scale);
    
    model.position.x = -center.x * scale;
    model.position.y = -center.y * scale;
    model.position.z = -center.z * scale;

    modelGroup.add(model);
    
    // Switch view
    showModel.value = true;
    treeGroup.visible = false;
    modelGroup.visible = true;
    
    controls.reset();
    loading.value = false;
  }, undefined, (error) => {
    console.error('An error happened', error);
    loading.value = false;
  });
};

const closeModel = () => {
  showModel.value = false;
  modelGroup.visible = false;
  treeGroup.visible = true;
  controls.reset();
  // Restore camera for tree
  camera.position.set(0, 20, 60);
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
</script>

<style scoped>
.font-comic {
  font-family: 'Comic Sans MS', sans-serif;
}
</style>
