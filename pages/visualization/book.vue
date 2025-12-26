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
  return `${BASE_IMG}static/library_app/2018_1766770808923142.jpg`
})

// --- State ---
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const isAnimating = ref(false)
const currentPageIndex = ref(0)
const debugMode = ref(true)

// --- Three.js Variables ---
let core: ThreeCore
let scene: THREE.Scene
// Raycaster for Drag
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isDragging = false
let dragStartPoint = new THREE.Vector2()
let draggedPage: THREE.Group | null = null

// Book Parts
let bookGroup: THREE.Group
let leftStack: THREE.Mesh
let rightStack: THREE.Mesh
let flipper: THREE.Group 
let flipperFront: THREE.Mesh
let flipperBack: THREE.Mesh
let spine: THREE.Mesh

const PAGE_WIDTH = 5
const PAGE_HEIGHT = 7.5
// const PAGE_SEGMENTS = 10 

// --- Lifecycle ---
onMounted(async () => {
  await nextTick()
  setTimeout(async () => {
    initThree()
    await initBook()
    loading.value = false
  }, 1000)
  
  // Events
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  if (core) {
    core.dispose()
  }
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

// --- Initialization ---
function initThree() {
  if (!canvasContainer.value) return

  const rect = canvasContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    setTimeout(() => initThree(), 100)
    return
  }

  core = new ThreeCore({
    antialias: true,
    alpha: true,
    cameraPosition: { x: 0, y: 0, z: 18 },
    enableOrbitControls: true, // Will disable when dragging
    enableStats: true,
    editMode: true,
    clearColor: 0x000000
  })

  core.mount(canvasContainer.value)
  scene = core.scene
  scene.background = new THREE.Color(0xfdf2f5) 
  
  // Custom Controls Settings
  if (core.controls) {
    core.controls.minDistance = 5
    core.controls.maxDistance = 50
    core.controls.enablePan = false // Disable pan to focus on book
  }

  // --- Lighting & Environment (Magic Book Style) ---
  // Add some point lights for magical glow
  const pointLight = new THREE.PointLight(0xffd700, 0.5, 20)
  pointLight.position.set(0, 5, 5)
  scene.add(pointLight)
  
  // Helpers
  if (debugMode.value) {
     // ... (Previous Helpers)
  }

  core.startAnimationLoop()
}

// --- Book Logic ---
async function initBook() {
  bookGroup = new THREE.Group()
  scene.add(bookGroup)

  // 1. Textures
  const coverTex = await core.loadTexture(`${BASE_IMG}static/library_app/cover_leather.jpg`).catch(() => null)
  const paperTex = await core.loadTexture(`${BASE_IMG}static/library_app/paper_texture.jpg`).catch(() => null) // Optional texture for page roughness
  
  // Materials
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.FrontSide,
    map: paperTex || null
  })
  
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21, // Leather brown
    roughness: 0.8,
    metalness: 0.2
  })

  // Geometries
  // Using BoxGeometry for stacks to look like thick book
  const stackHeight = 0.5
  const pageGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, 0.05) // Thin page
  pageGeo.translate(PAGE_WIDTH / 2, 0, 0) // Pivot at spine
  
  const stackGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, stackHeight)
  stackGeo.translate(PAGE_WIDTH / 2, 0, -stackHeight / 2) // Pivot at spine, sit on z=0

  // Right Stack (Bottom)
  rightStack = new THREE.Mesh(stackGeo, pageMat.clone())
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  
  // Left Stack (Bottom)
  leftStack = new THREE.Mesh(stackGeo, pageMat.clone())
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI
  
  // Flipper Group
  flipper = new THREE.Group()
  flipper.position.z = 0.05 // Slightly above stack
  
  // Flipper Page (A single thin box or plane)
  // Front Side
  flipperFront = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT), pageMat.clone())
  flipperFront.geometry.translate(PAGE_WIDTH / 2, 0, 0.01) // Slightly front
  
  // Back Side
  flipperBack = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT), pageMat.clone())
  flipperBack.rotation.y = Math.PI
  flipperBack.geometry.translate(-PAGE_WIDTH / 2, 0, -0.01) // Slightly back? No, rotate PI makes +x become -x.
  // If we rotate mesh Y 180, local +X becomes global -X.
  // But our geometry pivot is at 0 (left edge).
  // Plane 0 to 5. Rotate 180 at 0,0,0 -> 0 to -5.
  // We want it to be 0 to 5 relative to group, but facing backwards.
  // So: Geometry 0 to 5. Mesh rotation Y 180?
  // If Group rotates, Mesh follows.
  // Let's stick to Group logic:
  // Flipper Group at 0.
  // Front Mesh: 0 to 5. Normal (0,0,1).
  // Back Mesh: 0 to 5. Normal (0,0,-1).
  // To achieve Back Mesh facing back:
  // Rotation Y = PI.
  // But if we rotate Y=PI, geometry (0 to 5) becomes (0 to -5).
  // So for Back Mesh, we need geometry to be (-5 to 0)? Or translate it?
  // Easier: PlaneGeometry(W, H). Translate(W/2, 0, 0).
  // Mesh2.rotation.y = Math.PI.
  // Result: Mesh2 extends from 0 to -5.
  // We want it to extend 0 to 5 but face back.
  // So Mesh2.position.x = PAGE_WIDTH? No.
  // Let's just use DoubleSide? No, different textures.
  
  // Fix for Back Mesh:
  // Rotate Y PI. Then Translate X by PAGE_WIDTH? No.
  // Just mirror the geometry for back mesh?
  // Let's manually construct Back Mesh geometry to match Front spatial coords but normal flipped?
  // Or just: 
  flipperBack = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT), pageMat.clone())
  flipperBack.geometry.translate(PAGE_WIDTH / 2, 0, 0)
  flipperBack.scale.x = -1 // Mirror geometry along X?
  // If scale x = -1, normal flips? Yes.
  // And texture also flips. Perfect for back of page?
  // If texture text is "Page 2", flipping X makes it mirrored.
  // We might need to un-mirror texture. texture.repeat.x = -1.
  
  flipper.add(flipperFront)
  flipper.add(flipperBack)
  
  bookGroup.add(rightStack)
  bookGroup.add(leftStack)
  bookGroup.add(flipper)

  // Spine (Magic Book Style - thicker, rounded)
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, PAGE_HEIGHT/2, 0),
    new THREE.Vector3(-0.5, PAGE_HEIGHT/2, -stackHeight),
    new THREE.Vector3(0.5, PAGE_HEIGHT/2, -stackHeight),
    // ...
  ])
  // Simplified Spine
  const spineMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, PAGE_HEIGHT + 0.5, 32, 1, false, 0, Math.PI),
    coverMat
  )
  spineMesh.rotation.z = Math.PI / 2
  spineMesh.rotation.y = Math.PI / 2
  // Align spine
  spineMesh.geometry.rotateX(Math.PI / 2)
  spineMesh.position.z = -0.1
  bookGroup.add(spineMesh)

  // Initial Update
  await updateTextures()
  flipper.visible = false
}

// --- Interaction (Drag to Flip) ---
function onMouseDown(event: MouseEvent) {
  if (isAnimating.value || loading.value) return
  
  // Calculate mouse pos
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, core.camera)
  
  // Intersect with book parts
  const intersects = raycaster.intersectObjects([rightStack, leftStack], true)
  
  if (intersects.length > 0) {
    const obj = intersects[0].object
    if (obj === rightStack && currentPageIndex.value < totalPages - 1) {
      // Start Drag Next
      isDragging = true
      core.controls.enabled = false
      dragStartPoint.set(event.clientX, event.clientY)
      
      // Init Flipper for Drag
      setupFlipperForDrag('next')
    } else if (obj === leftStack && currentPageIndex.value > 0) {
      // Start Drag Prev
      isDragging = true
      core.controls.enabled = false
      dragStartPoint.set(event.clientX, event.clientY)
      
      setupFlipperForDrag('prev')
    }
  }
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging) return
  
  const deltaX = event.clientX - dragStartPoint.x
  // Map deltaX to rotation
  // Dragging Next: Right to Left (deltaX < 0)
  // Dragging Prev: Left to Right (deltaX > 0)
  
  // Normalize drag distance (screen width / 2 approx)
  const sensitivity = 0.005
  let rotation = 0
  
  // Current logic assumes flipper.rotation.y goes from 0 to -PI
  
  // If dragging Next (Right Page):
  // Start at 0. Moving Left (deltaX neg) -> rotation goes towards -PI.
  
  // If dragging Prev (Left Page):
  // Start at -PI. Moving Right (deltaX pos) -> rotation goes towards 0.
  
  if (flipper.userData.direction === 'next') {
    rotation = Math.max(-Math.PI, Math.min(0, deltaX * sensitivity))
  } else {
    rotation = Math.max(-Math.PI, Math.min(0, -Math.PI + deltaX * sensitivity))
  }
  
  flipper.rotation.y = rotation
}

function onMouseUp() {
  if (!isDragging) return
  isDragging = false
  core.controls.enabled = true
  
  // Snap to nearest page
  const currentRot = flipper.rotation.y
  const threshold = -Math.PI / 2
  
  if (flipper.userData.direction === 'next') {
    if (currentRot < threshold) {
      finishPageFlip('next')
    } else {
      cancelPageFlip('next')
    }
  } else {
    if (currentRot > threshold) {
      finishPageFlip('prev')
    } else {
      cancelPageFlip('prev')
    }
  }
}

async function setupFlipperForDrag(direction: 'next' | 'prev') {
  flipper.visible = true
  flipper.userData.direction = direction
  const i = currentPageIndex.value
  
  if (direction === 'next') {
    flipper.rotation.y = 0
    // Setup Textures
    const frontTex = await getTexture(i)
    const backTex = await getTexture(i + 1)
    
    if (frontTex) (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex
    if (backTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = backTex
        // Handle texture mirroring for back page
        backTex.wrapS = THREE.RepeatWrapping
        backTex.repeat.x = -1 
    }
    
    // Reveal Next-Next on Right Stack?
    const nextNextTex = await getTexture(i + 2) // Reveal what's under the flipping page
    if (nextNextTex) (rightStack.material as THREE.MeshStandardMaterial).map = nextNextTex
    
  } else {
    flipper.rotation.y = -Math.PI
    // Setup Textures
    // Flipper Front (Hidden inside stack initially): i-1
    // Flipper Back (Visible on Left): i-1
    // Wait, if we pull from left stack (i-1), we are grabbing page i-1.
    // So Flipper Back should be i-1.
    // Flipper Front will be i-1 (which lands on right).
    
    const prevTex = await getTexture(i - 1)
    if (prevTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = prevTex
        prevTex.wrapS = THREE.RepeatWrapping
        prevTex.repeat.x = -1
        
        (flipperFront.material as THREE.MeshStandardMaterial).map = prevTex
    }
    
    // Reveal Prev-Prev on Left Stack
    const prevPrevTex = await getTexture(i - 2)
    if (prevPrevTex) {
        (leftStack.material as THREE.MeshStandardMaterial).map = prevPrevTex
        leftStack.visible = true
    } else {
        leftStack.visible = false
    }
  }
}

function finishPageFlip(direction: 'next' | 'prev') {
  isAnimating.value = true
  const targetRot = direction === 'next' ? -Math.PI : 0
  
  gsap.to(flipper.rotation, {
    y: targetRot,
    duration: 0.5,
    ease: "power2.out",
    onComplete: () => {
      if (direction === 'next') {
        currentPageIndex.value += 1
      } else {
        currentPageIndex.value -= 1
      }
      updateTextures()
      flipper.visible = false
      isAnimating.value = false
      
      // Reset texture repeat (cleanup)
      resetTextureRepeat(flipperBack.material as THREE.MeshStandardMaterial)
    }
  })
}

function cancelPageFlip(direction: 'next' | 'prev') {
  isAnimating.value = true
  const targetRot = direction === 'next' ? 0 : -Math.PI
  
  gsap.to(flipper.rotation, {
    y: targetRot,
    duration: 0.5,
    ease: "power2.out",
    onComplete: () => {
      flipper.visible = false
      isAnimating.value = false
      updateTextures() // Restore original stack look
    }
  })
}

function resetTextureRepeat(mat: THREE.MeshStandardMaterial) {
    if (mat.map) {
        mat.map.repeat.x = 1
    }
}

async function getTexture(index: number): Promise<THREE.Texture | null> {
  if (index < 0 || index >= imageUrls.length) return null
  const url = imageUrls[index]
  try {
    const tex = await core.loadTexture(url)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  } catch (e) {
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
}

function nextPage() {
    if (isAnimating.value || currentPageIndex.value >= totalPages - 1) return
    isAnimating.value = true
    setupFlipperForDrag('next').then(() => finishPageFlip('next'))
}

function prevPage() {
    if (isAnimating.value || currentPageIndex.value <= 0) return
    isAnimating.value = true
    setupFlipperForDrag('prev').then(() => finishPageFlip('prev'))
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
