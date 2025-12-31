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
            {{ currentPageIndex }} / {{ totalPages - 1 }}
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

// --- Props ---
const props = withDefaults(defineProps<{
  ratio?: string
  coverImage?: string
  thickness?: number
}>(), {
  ratio: '9:16',
  coverImage: '',
  thickness: 0.15 // Default thin book
})

// --- Mock Data & Page Management ---
const contentImages = Array.from({ length: 20 }).map((_, i) => {
  return `${BASE_IMG}static/library_app/2018_1766770808923142.jpg`
})

// Combined pages list: [Cover, Content1, Content2, ...]
// Index 0 is the Cover. Index 1+ are contents.
// This allows the cover to be "Page 0" and handled by the same logic.
const totalPages = contentImages.length + 1
// We use a computed or function to get URL based on index

// --- State ---
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const isAnimating = ref(false)
const currentPageIndex = ref(0) // Start at 0 (Cover)
const debugMode = ref(true)

// --- Three.js Variables ---
let core: ThreeCore
let scene: THREE.Scene
// Raycaster for Drag
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isDragging = false
let dragStartPoint = new THREE.Vector2()
// let draggedPage: THREE.Group | null = null
let clickRelativeY = 0 // -1 to 1 based on click height

// Book Parts
let bookGroup: THREE.Group
let leftStack: THREE.Mesh
let rightStack: THREE.Mesh
let flipper: THREE.Group 
let flipperFront: THREE.Mesh
let flipperBack: THREE.Mesh
let spine: THREE.Mesh

// Calculate Dimensions based on ratio
let PAGE_WIDTH = 5
let PAGE_HEIGHT = 7.5
const PAGE_SEGMENTS = 20 

// --- Lifecycle ---
onMounted(async () => {
  // Parse Ratio
  if (props.ratio) {
    const parts = props.ratio.split(/[:/]/).map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
       // Keep Height constant, calculate Width
       PAGE_WIDTH = PAGE_HEIGHT * (parts[0] / parts[1])
    }
  }

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
    enableOrbitControls: true, 
    enableStats: true,
    editMode: true,
    clearColor: 0x000000
  })

  core.mount(canvasContainer.value)
  scene = core.scene
  scene.background = new THREE.Color(0xfdf2f5) 
  
  if (core.controls) {
    core.controls.minDistance = 5
    core.controls.maxDistance = 50
    core.controls.enablePan = false 
  }

  // --- Lighting & Environment ---
  const pointLight = new THREE.PointLight(0xffd700, 0.8, 20)
  pointLight.position.set(0, 5, 5)
  scene.add(pointLight)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
  // Magic Float Animation
  if (bookGroup) {
      gsap.to(bookGroup.position, {
        y: 0.5,
        duration: 2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      })
  }
  
  // Add Particles
  const particlesGeo = new THREE.BufferGeometry()
  const particlesCount = 200
  const posArray = new Float32Array(particlesCount * 3)
  for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 20
    posArray[i+1] = (Math.random() - 0.5) * 10 
    posArray[i+2] = (Math.random() - 0.5) * 20
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  const particlesMat = new THREE.PointsMaterial({
    size: 0.05,
    color: 0xffd700,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  })
  const particlesMesh = new THREE.Points(particlesGeo, particlesMat)
  scene.add(particlesMesh)
  
  core.addAnimationCallback(() => {
    particlesMesh.rotation.y += 0.001
    const positions = particlesMesh.geometry.attributes.position.array as Float32Array;
    for(let i = 1; i < positions.length; i+=3) {
        positions[i] += 0.01;
        if (positions[i] > 5) positions[i] = -5;
    }
    particlesMesh.geometry.attributes.position.needsUpdate = true;
    
    updatePageBending()
  })

  core.startAnimationLoop()
}

// --- Book Logic ---
async function initBook() {
  bookGroup = new THREE.Group()
  scene.add(bookGroup)

  // 1. Base Textures & Materials
  const paperTex = await core.loadTexture(`${BASE_IMG}static/library_app/2018_1766770808923142.jpg`).catch(() => null)
  
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.FrontSide,
    map: paperTex || null
  })
  
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.2
  })

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.1
  })

  // Geometries
  const stackHeight = props.thickness // Use prop thickness
  
  // Stack Geometries
  const stackGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, stackHeight)
  stackGeo.translate(PAGE_WIDTH / 2, 0, -stackHeight / 2) 

  // Right Stack Materials
  // +Z (Index 4) is the Top Face.
  const rightStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    pageMat.clone(), // +Z (Top) - Will be updated by updateTextures
    whiteMat
  ]

  rightStack = new THREE.Mesh(stackGeo, rightStackMats)
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  
  // Left Stack Materials
  // -Z (Index 5) is the Top Face when rotated Y=PI.
  const leftStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    whiteMat,
    pageMat.clone() // -Z (Top) - Will be updated by updateTextures
  ]

  leftStack = new THREE.Mesh(stackGeo, leftStackMats)
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI
  
  // Flipper Group
  flipper = new THREE.Group()
  flipper.position.z = 0.02 // Slightly above stack
  
  const bendPageGeo = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_SEGMENTS, 1)
  bendPageGeo.translate(PAGE_WIDTH / 2, 0, 0) 
  
  flipperFront = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperFront.castShadow = true
  flipperFront.position.z = 0.005 
  
  flipperBack = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperBack.receiveShadow = true
  flipperBack.position.z = -0.005
  flipperBack.rotation.y = Math.PI 
  flipperBack.scale.x = -1 
  
  flipper.add(flipperFront)
  flipper.add(flipperBack)
  
  bookGroup.add(rightStack)
  bookGroup.add(leftStack)
  bookGroup.add(flipper)

  // Spine
  // Diameter should match stackHeight somewhat, maybe slightly larger
  const spineRadius = stackHeight * 0.6 // Adjust radius
  const spineMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(spineRadius, spineRadius, PAGE_HEIGHT + 0.2, 32, 1, false, 0, Math.PI),
    coverMat
  )
  spineMesh.rotation.z = Math.PI / 2
  spineMesh.rotation.y = Math.PI / 2
  spineMesh.geometry.rotateX(Math.PI / 2)
  // Align spine center Z with stack center Z
  spineMesh.position.z = -stackHeight / 2
  bookGroup.add(spineMesh)

  // Initial Update
  await updateTextures()
  flipper.visible = false
}

// --- Bending Logic ---
function updatePageBending() {
    if (!flipper || !flipper.visible) return
    
    const angle = flipper.rotation.y
    const progress = Math.abs(angle) / Math.PI 
    
    const bendFactor = Math.sin(progress * Math.PI) * 2.0 
    const torsion = clickRelativeY * 0.5 
    
    const positionAttribute = flipperFront.geometry.attributes.position
    for ( let i = 0; i < positionAttribute.count; i ++ ) {
        const x = positionAttribute.getX( i )
        const y = positionAttribute.getY( i )
        const normX = x / PAGE_WIDTH
        const normY = y / (PAGE_HEIGHT / 2) 

        let zMod = 1 + torsion * normY
        const z = bendFactor * Math.sin(normX * Math.PI) * 0.5 * zMod
        positionAttribute.setZ( i, z )
    }
    positionAttribute.needsUpdate = true
    flipperFront.geometry.computeVertexNormals()
    
    const backPosAttr = flipperBack.geometry.attributes.position
    for ( let i = 0; i < backPosAttr.count; i ++ ) {
        const x = backPosAttr.getX( i )
        const y = backPosAttr.getY( i )
        const normX = x / PAGE_WIDTH
        const normY = y / (PAGE_HEIGHT / 2) 
        
        let zMod = 1 + torsion * normY
        const z = - (bendFactor * Math.sin(normX * Math.PI) * 0.5 * zMod)
        backPosAttr.setZ( i, z )
    }
    backPosAttr.needsUpdate = true
    flipperBack.geometry.computeVertexNormals()
}

// --- Interaction (Drag to Flip) ---
function onMouseDown(event: MouseEvent) {
  if (isAnimating.value || loading.value) return
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, core.camera)
  
  const intersects = raycaster.intersectObjects([rightStack, leftStack], true)
  
  if (intersects.length > 0) {
    const obj = intersects[0].object
    const point = intersects[0].point
    clickRelativeY = Math.max(-1, Math.min(1, point.y / (PAGE_HEIGHT / 2)))
    
    if (obj === rightStack && currentPageIndex.value < totalPages - 1) {
      isDragging = true
      core.controls.enabled = false
      dragStartPoint.set(event.clientX, event.clientY)
      setupFlipperForDrag('next')
    } else if (obj === leftStack && currentPageIndex.value > 0) {
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
  const sensitivity = 0.005
  let rotation = 0
  
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
    const frontTex = await getTexture(i) // Current Page
    const backTex = await getTexture(i + 1) // Next Page Back
    
    if (frontTex) {
        (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex;
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        // Fallback for cover
        (flipperFront.material as THREE.MeshStandardMaterial).map = null;
        (flipperFront.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }

    if (backTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = backTex
        backTex.wrapS = THREE.RepeatWrapping
        backTex.repeat.x = -1;
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        (flipperBack.material as THREE.MeshStandardMaterial).map = null;
        (flipperBack.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    
    // Reveal next next
    const nextNextTex = await getTexture(i + 2) 
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    if (nextNextTex) {
        mats[4].map = nextNextTex
        mats[4].needsUpdate = true
    } else {
        mats[4].map = null
        mats[4].color.set(0xffffff)
        mats[4].needsUpdate = true
    }
    
  } else {
    flipper.rotation.y = -Math.PI
    const prevTex = await getTexture(i - 1)
    
    if (prevTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = prevTex
        prevTex.wrapS = THREE.RepeatWrapping
        prevTex.repeat.x = -1;
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
        
        // Also set front for visual consistency if flipper is viewed edge on
        (flipperFront.material as THREE.MeshStandardMaterial).map = prevTex;
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        (flipperBack.material as THREE.MeshStandardMaterial).map = null;
        (flipperBack.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;

        (flipperFront.material as THREE.MeshStandardMaterial).map = null;
        (flipperFront.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    
    const prevPrevTex = await getTexture(i - 2)
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    if (prevPrevTex) {
        mats[5].map = prevPrevTex
        mats[5].needsUpdate = true
        leftStack.visible = true
    } else if (i - 2 === -1) { 
        // Showing "nothing" or default cover white?
        // Actually i=1, prev=0(Cover), prevPrev=-1.
        // Left Stack should show nothing underneath if at beginning?
        // Or show cover if we are flipping back TO cover?
        // If i=1, we flip page 0 back. Left stack shows page -1 (nothing).
        leftStack.visible = false
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
    duration: 0.8,
    ease: "power2.inOut", 
    onComplete: () => {
      if (direction === 'next') {
        currentPageIndex.value += 1
      } else {
        currentPageIndex.value -= 1
      }
      updateTextures()
      flipper.visible = false
      isAnimating.value = false
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
      updateTextures()
    }
  })
}

function resetTextureRepeat(mat: THREE.MeshStandardMaterial) {
    if (mat.map) {
        mat.map.repeat.x = 1
    }
}

// Get Texture Logic:
// Index 0: Cover (props.coverImage or white)
// Index 1+: contentImages[index-1]
async function getTexture(index: number): Promise<THREE.Texture | null> {
  if (index < 0) return null
  
  let url = ''
  if (index === 0) {
      if (props.coverImage) {
          url = props.coverImage
      } else {
          // No cover image -> return null for white material
          return null
      }
  } else {
      const contentIndex = index - 1
      if (contentIndex < contentImages.length) {
          url = contentImages[contentIndex]
      } else {
          return null
      }
  }

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
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    if (tex) {
      mats[5].map = tex
      mats[5].needsUpdate = true
    } else {
      mats[5].map = null
      mats[5].color.set(0xffffff) // White fallback
      mats[5].needsUpdate = true
    }
    leftStack.visible = true
  } else {
    leftStack.visible = false
  }

  // Right Stack (Underneath) - Shows i
  // If i is last page index (totalPages), then right stack is empty/invisible?
  if (i < totalPages) {
    const tex = await getTexture(i)
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    if (tex) {
        mats[4].map = tex
        mats[4].needsUpdate = true
    } else {
        mats[4].map = null
        mats[4].color.set(0xffffff) // White fallback
        mats[4].needsUpdate = true
    }
     rightStack.visible = true
  } else {
     rightStack.visible = false
  }
}

function nextPage() {
    if (isAnimating.value || currentPageIndex.value >= totalPages - 1) return
    isAnimating.value = true
    clickRelativeY = 0 // Reset torsion for auto flip
    setupFlipperForDrag('next').then(() => finishPageFlip('next'))
}

function prevPage() {
    if (isAnimating.value || currentPageIndex.value <= 0) return
    isAnimating.value = true
    clickRelativeY = 0 // Reset torsion for auto flip
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
