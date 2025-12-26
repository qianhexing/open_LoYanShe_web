<template>
  <div class="book-page w-full h-full relative overflow-hidden bg-[#fdf2f5]">
    <!-- Canvas Container -->
    <div ref="canvasContainer" class="absolute inset-0 z-0 canvasContainer"></div>

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
        
        <div class="flex flex-col items-center gap-2">
            <div class="page-indicator font-serif text-[#d48898] text-lg bg-white/80 px-4 py-1 rounded-full border border-[#ffccd5]">
            {{ currentPageIndex + 1 }} / {{ totalPages }}
            </div>
            <button @click="focusOnBook" class="text-xs text-[#d48898] underline opacity-70 hover:opacity-100">
                Reset View
            </button>
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
import gsap from 'gsap'
import ThreeCore from '@/utils/threeCore'
import { BASE_IMG } from '@/utils/ipConfig'

// --- Mock Data ---
const totalPages = 20
const imageUrls = Array.from({ length: totalPages }).map((_, i) => {
  // Use placeholder images with different themes/colors to distinguish pages
  return `${BASE_IMG}static/library_app/2018_1766770808923142.jpg`
})

// --- State ---
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const isAnimating = ref(false)
const currentPageIndex = ref(0) // 0 means displaying page 0 (left) and page 1 (right)
const debugMode = ref(true)

// --- Three.js Variables ---
let core: ThreeCore
let scene: THREE.Scene
// let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera

// Book Parts
let bookGroup: THREE.Group
let leftStack: THREE.Mesh
let rightStack: THREE.Mesh
let flipper: THREE.Group // Group to hold the double-sided page for rotation
let flipperFront: THREE.Mesh
let flipperBack: THREE.Mesh
let spine: THREE.Mesh

// Materials Cache (Using ThreeCore's texture loader wrapper if possible, or standard)
// ThreeCore has loadTexture but it's async. We can use it.

const PAGE_WIDTH = 5
const PAGE_HEIGHT = 7.5
const PAGE_SEGMENTS = 10 

// --- Lifecycle ---
onMounted(async () => {
  // 等待 DOM 渲染完成，确保容器有正确的尺寸
  await nextTick()
  
  setTimeout(async () => {
    initThree()
    await initBook()
    loading.value = false
  }, 1000)
})

onUnmounted(() => {
  if (core) {
    core.dispose()
  }
})

// --- Initialization ---
function initThree() {
  if (!canvasContainer.value) {
    console.error('Canvas container not found')
    return
  }

  // 确保容器有尺寸
  const rect = canvasContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    console.warn('Container has zero size, retrying...')
    setTimeout(() => initThree(), 100)
    return
  }

  // 实例化 ThreeCore（不传 container，使用 mount 方法挂载）
  core = new ThreeCore({
    antialias: true,
    alpha: true, // Allow CSS background to show through
    cameraPosition: { x: 0, y: 0, z: 18 }, // Adjusted camera position to see the book from front
    enableOrbitControls: true,
    enableStats: true,
    editMode: true,
    clearColor: 0x000000 // Transparent anyway
  })

  // 挂载到容器（必须在容器有尺寸后调用）
  core.mount(canvasContainer.value)
  
  scene = core.scene
  
  // Custom Scene Setup
  // If ThreeCore sets a background, we might want to clear it or set it to match our CSS
  scene.background = new THREE.Color(0xfdf2f5) 
  
  // Helpers
  if (debugMode.value) {
    const axesHelper = new THREE.AxesHelper(10)
    scene.add(axesHelper)

    // XYZ轴辅助器 - 使用箭头更清晰地显示方向
    const axisLength = 8
    const arrowLength = 1.5
    const arrowHeadLength = 0.5
    const arrowHeadWidth = 0.3
    
    // X轴 - 红色
    const xAxisHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0xff0000,
      arrowHeadLength,
      arrowHeadWidth
    )
    scene.add(xAxisHelper)
    
    // Y轴 - 绿色
    const yAxisHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0x00ff00,
      arrowHeadLength,
      arrowHeadWidth
    )
    scene.add(yAxisHelper)
    
    // Z轴 - 蓝色
    const zAxisHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0x0000ff,
      arrowHeadLength,
      arrowHeadWidth
    )
    scene.add(zAxisHelper)

    const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xdddddd)
    gridHelper.position.y = -5.01 // Slightly below floor
    scene.add(gridHelper)

    // Debug Cube - 用于确定场景位置
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2)
    const cubeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff6b9d,
      wireframe: false,
      transparent: true,
      opacity: 0.7
    })
    const debugCube = new THREE.Mesh(cubeGeometry, cubeMaterial)
    debugCube.position.set(0, 0, 0) // 放在原点位置
    debugCube.castShadow = true
    debugCube.receiveShadow = true
    scene.add(debugCube)

    // 添加线框版本，更清晰
    const wireframeGeometry = new THREE.BoxGeometry(2, 2, 2)
    const wireframeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      wireframe: true
    })
    const wireframeCube = new THREE.Mesh(wireframeGeometry, wireframeMaterial)
    wireframeCube.position.set(0, 0, 0)
    scene.add(wireframeCube)
  }

  // Adjust Controls
  if (core.controls) {
    core.controls.minDistance = 5
    core.controls.maxDistance = 50
    core.controls.maxPolarAngle = Math.PI // Allow looking from below if needed for debug
    core.controls.target.set(0, 0, 0)
    core.controls.update()
  }

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
  
  // Start Loop
  core.startAnimationLoop()
}

function focusOnBook() {
  if (core) {
     core.lookAtCameraState({
      position: new THREE.Vector3(0, 0, 18),
      target: new THREE.Vector3(0, 0, 0),
      fov: 45
    }, 1000)
  }
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
  
  // 2. Left Stack (Static bottom)
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
  spine.rotation.x = 0 
  spine.position.set(0, 0, 0)
  bookGroup.add(spine)
  core.lookAtSelectObj([bookGroup])
  // Initial Texture Load
  await updateTextures()
  console.log(bookGroup, 'bookGroup')
  // Hide flipper initially if at start
  flipper.visible = false
}

// Helper to get texture using ThreeCore or TextureLoader
// Since ThreeCore.loadTexture is async, let's just use it but handle async inside update
async function getTexture(index: number): Promise<THREE.Texture | null> {
  if (index < 0 || index >= imageUrls.length) return null
  const url = imageUrls[index]
  try {
    const tex = await core.loadTexture(url)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  } catch (e) {
    console.warn('Failed to load texture', url)
    return null
  }
}

async function updateTextures() {
  const i = currentPageIndex.value
  
  // Left Stack (Top) - Shows i-1
  if (i > 0) {
    const tex = await getTexture(i - 1)
    if (tex) {
      (leftStack.material as THREE.MeshStandardMaterial).map = tex
      ;(leftStack.material as THREE.MeshStandardMaterial).needsUpdate = true
      leftStack.visible = true
    }
  } else {
    leftStack.visible = false
  }

  // Right Stack (Underneath) - Shows i
  const tex = await getTexture(i)
  if (tex) {
    (rightStack.material as THREE.MeshStandardMaterial).map = tex
    ;(rightStack.material as THREE.MeshStandardMaterial).needsUpdate = true
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

async function nextPage() {
  if (isAnimating.value || currentPageIndex.value >= totalPages - 1) return
  isAnimating.value = true

  const i = currentPageIndex.value
  
  // Flipper Front: Img i
  // Flipper Back: Img i+1
  
  flipper.visible = true
  flipper.rotation.y = 0
  
  const frontTex = await getTexture(i)
  const backTex = await getTexture(i + 1)
  
  if (frontTex) (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex
  if (backTex) (flipperBack.material as THREE.MeshStandardMaterial).map = backTex
  
  // 1. Right Stack immediately shows i+1 (Next).
  // Ideally this should be i+2 if we were simulating a thick book, but for infinite scroll:
  // We just show the next page.
  // Actually, if we flip page 'i', the right stack underneath should reveal page 'i+1'.
  // But wait, page i+1 is on the BACK of the flipper.
  // So the right stack should reveal page i+2 (if it exists).
  // But here we are simplifying. Let's make Right Stack show i+1?
  // No, if Right Stack shows i+1, then as soon as we lift the page (Flipper Front=i), 
  // we see i+1 underneath.
  // And Flipper Back is also i+1.
  // So when it lands on left, Left becomes i+1? No, Left becomes i (Flipper Front) -> No.
  
  // Correct logic for flipping single sheets (Page N = Sheet N/2? No, Page N = Image N):
  // Let's treat indices as "spreads"? Or just sequence of images?
  // User asked for "image array".
  // Sequence: [0, 1, 2, 3]
  // Start: Left: Empty, Right: 0
  // Next -> Flip 0. 0 lands on Left. 1 appears on Right?
  // This means 0 is on Flipper Front. Flipper Back is... 0? (If 0 is a single sheet front/back same?)
  // Usually books have P1 front, P2 back.
  // If we treat array as [P1, P2, P3...], then:
  // Sheet 1: Front=P1, Back=P2.
  // Sheet 2: Front=P3, Back=P4.
  
  // BUT the user just gave a list of images.
  // Let's assume the "Photo Album" mode where each "sheet" has Image[i] on Front and Image[i] on Back?
  // Or Image[i] on Front, and Image[i+1] on Back?
  // If we do Image[i] Front, Image[i+1] Back.
  // Then when we flip 0 (Front) -> 1 (Back).
  // 1 is now on Left.
  // Right Stack should show 2.
  // So:
  // Flipper Front: i
  // Flipper Back: i+1 (Wait, if Back is i+1, it will end up on Left side facing up).
  // So Left side will show i+1.
  // Right side (revealed) will show i+2?
  // This skips images fast.
  
  // "Standard" Photo Album:
  // Left: i-1. Right: i.
  // Flip: Move i to Left. Reveal i+1 on Right.
  // Flipper Front: i.
  // Flipper Back: i. (Same image on back, or blank?)
  // If we want to see i on the left after flip, Flipper Back must be i.
  // And underneath on Right, we reveal i+1.
  
  // Let's try this: Flipper Front = i, Flipper Back = i.
  // Right Stack = i+1.
  const nextRightTex = await getTexture(i + 1)
  if (nextRightTex) (rightStack.material as THREE.MeshStandardMaterial).map = nextRightTex
  
  // Flipper Texture
  if (frontTex) {
    (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex
    (flipperBack.material as THREE.MeshStandardMaterial).map = frontTex // Same image on back
  }

  // 2. Animate Flipper from 0 to -180
  gsap.to(flipper.rotation, {
    y: -Math.PI,
    duration: 1.2,
    ease: "power2.inOut",
    onComplete: () => {
      // Finished flipping
      currentPageIndex.value += 1
      updateTextures() // Left=i(now shows prev i), Right=i+1(now current i)
      flipper.visible = false
      isAnimating.value = false
    }
  })
}

async function prevPage() {
  if (isAnimating.value || currentPageIndex.value <= 0) return
  isAnimating.value = true
  
  const i = currentPageIndex.value
  
  // We want to bring back page i-1 from Left.
  // Flipper Front (will land on Right): i-1.
  // Flipper Back (starts visible on Left): i-1.
  
  flipper.visible = true
  flipper.rotation.y = -Math.PI
  
  const prevTex = await getTexture(i - 1)
  if (prevTex) {
    (flipperFront.material as THREE.MeshStandardMaterial).map = prevTex
    (flipperBack.material as THREE.MeshStandardMaterial).map = prevTex
  }
  
  // Underneath on Left: i-2
  const prevLeftTex = await getTexture(i - 2)
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

function onResize() {
  // ThreeCore handles resize internally via resizeObserver on container,
  // but if we need manual control:
  // core.onContainerResize()
}
</script>

<style scoped>
/* Lolita Font & Utilities */
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Playfair+Display:ital@0;1&display=swap');

.book-page {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.canvasContainer {
  width: 100%;
  height: 100%;
  min-width: 100%;
  min-height: 100%;
}

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
