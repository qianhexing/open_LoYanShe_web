<template>
  <div class="book-page w-full h-full relative overflow-hidden bg-[#fdf2f5]">
    <!-- Canvas Container -->
    <div ref="canvasContainer" class="absolute inset-0 z-0"></div>

    <!-- UI Overlay (Lolita Style) -->
    <div class="ui-overlay absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
      <!-- Header -->
      <div class="header text-center mt-4">
        <h1 class="lolita-title text-4xl text-[#d48898] drop-shadow-sm mb-2">My Memory Book</h1>
        <div class="decoration-line mx-auto w-32 h-1 bg-[#d48898] rounded-full opacity-50"></div>
      </div>

      <!-- Controls -->
      <div class="controls pointer-events-auto flex justify-center items-center gap-12 mb-8">
        <button 
          @click="prevPage" 
          class="lolita-btn group"
          :disabled="isAnimating"
        >
          <span class="icon group-hover:-translate-x-1 transition-transform">❮</span>
          <span class="text">Prev</span>
        </button>
        
        <div class="page-indicator font-serif text-[#d48898] text-lg bg-white/80 px-4 py-1 rounded-full border border-[#ffccd5]">
          {{ currentPageIndex + 1 }} / {{ totalPages }}
        </div>

        <button 
          @click="nextPage" 
          class="lolita-btn group"
          :disabled="isAnimating"
        >
          <span class="text">Next</span>
          <span class="icon group-hover:translate-x-1 transition-transform">❯</span>
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="absolute inset-0 z-50 flex items-center justify-center bg-[#fdf2f5]">
      <div class="text-[#d48898] text-xl font-serif animate-pulse">Loading Magic...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'

// --- Mock Data ---
const totalPages = 20
const imageUrls = Array.from({ length: totalPages }).map((_, i) => {
  // Use placeholder images with different themes/colors to distinguish pages
  const id = 10 + i
  return `https://picsum.photos/id/${id}/600/900`
})

// --- State ---
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const isAnimating = ref(false)
const currentPageIndex = ref(0) // 0 means displaying page 0 (left) and page 1 (right)

// --- Three.js Variables ---
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let lights: { ambient: THREE.AmbientLight; dir: THREE.DirectionalLight }

// Book Parts
let bookGroup: THREE.Group
let leftStack: THREE.Mesh
let rightStack: THREE.Mesh
let flipper: THREE.Group // Group to hold the double-sided page for rotation
let flipperFront: THREE.Mesh
let flipperBack: THREE.Mesh
let spine: THREE.Mesh

// Materials Cache
const textureLoader = new THREE.TextureLoader()
const loadedTextures: Map<string, THREE.Texture> = new Map()

const PAGE_WIDTH = 5
const PAGE_HEIGHT = 7.5
const PAGE_SEGMENTS = 10 // For bending effects later if needed

// --- Lifecycle ---
onMounted(async () => {
  initThree()
  await initBook()
  animate()
  window.addEventListener('resize', onResize)
  loading.value = false
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
})

// --- Initialization ---
function initThree() {
  if (!canvasContainer.value) return

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xfdf2f5) // Lolita pink background

  // Camera
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.set(0, 0, 18)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.outputColorSpace = THREE.SRGBColorSpace
  canvasContainer.value.appendChild(renderer.domElement)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 10
  controls.maxDistance = 30
  controls.maxPolarAngle = Math.PI / 1.5 // Don't let go below ground too much

  // Lights
  lights = {
    ambient: new THREE.AmbientLight(0xffffff, 0.6),
    dir: new THREE.DirectionalLight(0xffffff, 1.2)
  }
  lights.dir.position.set(5, 10, 10)
  lights.dir.castShadow = true
  lights.dir.shadow.mapSize.width = 2048
  lights.dir.shadow.mapSize.height = 2048
  
  scene.add(lights.ambient)
  scene.add(lights.dir)

  // Floor (Decorative)
  const floorGeo = new THREE.PlaneGeometry(100, 100)
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0xffe4e1, 
    side: THREE.FrontSide,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -5
  floor.receiveShadow = true
  scene.add(floor)
}

// --- Book Logic ---
async function initBook() {
  bookGroup = new THREE.Group()
  scene.add(bookGroup)

  // Geometries
  const pageGeo = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT)
  // Translate geometry so left edge is at x=0 (Pivot Point)
  pageGeo.translate(PAGE_WIDTH / 2, 0, 0) 

  const baseMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.0,
    side: THREE.FrontSide
  })

  // 1. Right Stack (Static bottom)
  rightStack = new THREE.Mesh(pageGeo, baseMat.clone())
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  // rightStack.position.x = 0 // Pivot is at 0
  
  // 2. Left Stack (Static bottom)
  // Left stack needs to be mirrored or just rotated
  leftStack = new THREE.Mesh(pageGeo, baseMat.clone())
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI // Folded to left
  
  // 3. Flipper (The moving page)
  flipper = new THREE.Group()
  flipper.position.set(0, 0, 0.01) // Slightly above to avoid z-fighting
  
  // Flipper needs two sides: Front and Back
  // Front Mesh
  flipperFront = new THREE.Mesh(pageGeo, baseMat.clone())
  flipperFront.castShadow = true
  // Back Mesh
  flipperBack = new THREE.Mesh(pageGeo, baseMat.clone())
  flipperBack.rotation.y = Math.PI // Back to back
  // IMPORTANT: For the back mesh, since we rotated it PI, 
  // its "local left" is now "global right". 
  // But wait, the geometry is translated +Width/2.
  // If we rotate Y 180, the +Width/2 becomes -Width/2. 
  // So the back mesh pivots correctly around 0.
  // However, we want the textures to be upright.
  // Standard Plane UVs: (0,0) bottom-left, (1,1) top-right.
  // If we rotate the mesh 180 Y, the texture is mirrored horizontally? 
  // No, looking at back of plane is mirrored. Rotating 180 makes it look normal?
  // Let's test.
  
  // Actually, simpler approach for Flipper:
  // Just use one Mesh with DoubleSide? No, need different textures.
  // Use Group with 2 meshes back-to-back.
  
  // Front: 0 to Width. Normal.
  // Back: 0 to Width. Rotated 180 Y. 
  // To avoid z-fighting between front/back meshes in the group:
  flipperFront.position.z = 0.005
  flipperBack.position.z = -0.005
  
  flipper.add(flipperFront)
  flipper.add(flipperBack)
  
  // Add parts to book
  bookGroup.add(rightStack)
  bookGroup.add(leftStack)
  bookGroup.add(flipper)

  // Spine
  const spineGeo = new THREE.CylinderGeometry(0.2, 0.2, PAGE_HEIGHT, 32)
  const spineMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c })
  spine = new THREE.Mesh(spineGeo, spineMat)
  spine.position.z = 0
  spine.rotation.x = Math.PI / 2 // Lay down? No, vertical along Y? No, spine is along Y axis of the book?
  // Wait, if pages are WxH, spine is along H (Y axis).
  spine.position.set(0, 0, 0)
  bookGroup.add(spine)

  // Initial Texture Load
  updateTextures()
  
  // Hide flipper initially if at start
  flipper.visible = false
}

function getTexture(index: number) {
  if (index < 0 || index >= imageUrls.length) return null
  const url = imageUrls[index]
  if (loadedTextures.has(url)) return loadedTextures.get(url)
  
  const tex = textureLoader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  loadedTextures.set(url, tex)
  return tex
}

function updateTextures() {
  // We view the book as:
  // Left Page: index i - 1 (Back of previous sheet)
  // Right Page: index i (Front of current sheet)
  
  const i = currentPageIndex.value
  
  // Left Stack (Top)
  // Should show image i-1
  if (i > 0) {
    const tex = getTexture(i - 1)
    if (tex) {
      (leftStack.material as THREE.MeshStandardMaterial).map = tex
      ;(leftStack.material as THREE.MeshStandardMaterial).needsUpdate = true
      leftStack.visible = true
    }
  } else {
    // Cover or empty
    leftStack.visible = false
  }

  // Right Stack (Underneath)
  // Should show image i + 1? No.
  // Current view is: Left=Img(i-1), Right=Img(i).
  // If we assume single page = single image.
  // Page 0 (Right). Page -1 (Left, invalid).
  // Right Stack currently displays Img i.
  const tex = getTexture(i)
  if (tex) {
    (rightStack.material as THREE.MeshStandardMaterial).map = tex
    ;    (rightStack.material as THREE.MeshStandardMaterial).needsUpdate = true
     rightStack.visible = true
  } else {
     rightStack.visible = false
  }
  
  // Preload Neighbors
  getTexture(i + 1)
  getTexture(i + 2)
  getTexture(i - 1)
  getTexture(i - 2)
}

// --- Animation ---

function nextPage() {
  if (isAnimating.value || currentPageIndex.value >= totalPages - 1) return
  isAnimating.value = true

  const i = currentPageIndex.value
  
  // Flipper Logic for Next (Right to Left)
  // We are flipping the page currently at `i`.
  // Flipper Front: Img i
  // Flipper Back: Img i+1
  // Right Underneath: Img i+2? Or just the next one in stack?
  // Let's assume standard array traversal.
  
  // Setup Flipper
  flipper.visible = true
  flipper.rotation.y = 0
  
  const frontTex = getTexture(i)
  const backTex = getTexture(i + 1)
  
  if (frontTex) (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex
  if (backTex) {
    // We need to flip the texture horizontally for the back page because the mesh is rotated 180?
    // Let's check visual results. Usually THREE.Texture.repeat.x = -1 handles mirror.
    // For now, let's just assign.
    (flipperBack.material as THREE.MeshStandardMaterial).map = backTex
  }
  
  // Setup Underneath (Right Stack)
  // While flipping `i`, we reveal `i+2`? 
  // Standard: [i-1][i] -> flip -> [i+1][i+2] ?
  // If we flip one sheet, we reveal one back and one front.
  // If i is "Right Page", then next Right Page is i+2?
  // Let's assume pages are single sided images for simplicity of array?
  // Or:
  // Array: [P1, P2, P3, P4]
  // Open: Left(Empty), Right(P1)
  // Flip P1: Left(P1-Back?), Right(P2)
  // If we just want to "browse images":
  // Left always shows Previous. Right always shows Current.
  // Flip: Current moves to Left. Next appears on Right.
  
  // So: 
  // Flipper Front = Current (i)
  // Flipper Back = Next (i+1) ? No, Back of flipper will become Left Page.
  // So Back of flipper = Current (i) ?? No, that's same image.
  // User wants "Infinite Book".
  
  // Let's do:
  // Flipper Front: Img(i)
  // Flipper Back: Img(i+1)
  // Right Stack (Underneath): Img(i+1)
  
  // Animation:
  // 1. Right Stack immediately shows i+1 (Next).
  const nextRightTex = getTexture(i + 1)
  if (nextRightTex) (rightStack.material as THREE.MeshStandardMaterial).map = nextRightTex
  
  // 2. Animate Flipper from 0 to -180
  gsap.to(flipper.rotation, {
    y: -Math.PI,
    duration: 1.2,
    ease: "power2.inOut",
    onComplete: () => {
      // Finished flipping
      currentPageIndex.value += 1
      updateTextures() // Sets Left=i(now i-1), Right=i+1(now i)
      flipper.visible = false
      isAnimating.value = false
    }
  })
}

function prevPage() {
  if (isAnimating.value || currentPageIndex.value <= 0) return
  isAnimating.value = true
  
  // Reverse Logic (Left to Right)
  // We want to bring back the page from Left.
  // Current: Left(i-1), Right(i)
  // Target: Left(i-2), Right(i-1)
  
  const i = currentPageIndex.value
  
  // Flipper Front: Img(i-1) (The one on the left)
  // Flipper Back: Img(i) (The one currently on right? No)
  // We are flipping the Left page back to the Right.
  
  // Flipper needs to start at -180 (Left side)
  flipper.visible = true
  flipper.rotation.y = -Math.PI
  
  // Texture Setup
  // When flipping back, the "Front" of the flipper (local +Z) faces LEFT when rotated -180?
  // If rotation is -180 (or PI), Front faces -Z (Global Back).
  // Back faces +Z (Global Front).
  // So visible side on Left is "Back" mesh.
  // Wait, my FlipperBack mesh is rotated PI relative to group.
  // Group is rotated -PI. Total rotation 0.
  // So FlipperBack is facing Camera.
  // So FlipperBack should be Img(i-1).
  
  const prevTex = getTexture(i - 1) // Content of left page
  if (prevTex) (flipperBack.material as THREE.MeshStandardMaterial).map = prevTex
  
  // Flipper Front (which will land on Right) should be Img(i-1)? 
  // Yes, because it lands on right.
  if (prevTex) (flipperFront.material as THREE.MeshStandardMaterial).map = prevTex
  
  // Setup Underneath (Left Stack)
  // Reveals i-2
  const prevLeftTex = getTexture(i - 2)
  if (prevLeftTex) {
    (leftStack.material as THREE.MeshStandardMaterial).map = prevLeftTex
    leftStack.visible = true
  } else {
    leftStack.visible = false
  }

  // Animation: -180 to 0
  gsap.to(flipper.rotation, {
    y: 0,
    duration: 1.2,
    ease: "power2.inOut",
    onComplete: () => {
      currentPageIndex.value -= 1
      updateTextures()
      flipper.visible = false
      isAnimating.value = false
    }
  })
}

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

function onResize() {
  if (!canvasContainer.value) return
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}
</script>

<style scoped>
/* Lolita Font & Utilities */
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Playfair+Display:ital@0;1&display=swap');

.lolita-title {
  font-family: 'Cinzel Decorative', cursive;
  text-shadow: 2px 2px 0px #fff;
}

.lolita-btn {
  background: linear-gradient(to bottom, #fff0f5, #ffe4e1);
  border: 2px solid #ffb7c5;
  border-radius: 999px;
  padding: 12px 32px;
  color: #d48898;
  font-family: 'Playfair Display', serif;
  font-weight: bold;
  font-size: 1.1rem;
  box-shadow: 0 4px 6px rgba(212, 136, 152, 0.2);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lolita-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(212, 136, 152, 0.3);
  background: #fff;
  border-color: #ff9eb5;
}

.lolita-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.lolita-btn .icon {
  font-size: 1.2em;
  display: inline-block;
}

/* Custom Scrollbar for container if needed */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #fff0f5; 
}
::-webkit-scrollbar-thumb {
  background: #ffccd5; 
  border-radius: 4px;
}
</style>
