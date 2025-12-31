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

// --- Props ---
const props = withDefaults(defineProps<{
  ratio?: string
}>(), {
  ratio: '9:16'
})

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
const PAGE_SEGMENTS = 20 // Increase segments for bending

// --- Lifecycle ---
onMounted(async () => {
  // Parse Ratio
  if (props.ratio) {
    const parts = props.ratio.split(/[:/]/).map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
       // Keep Height constant, calculate Width? Or keep Area?
       // Let's keep Height = 7.5
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
  
  // Helpers
  if (debugMode.value) {
     // ...
  }

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
    
    // Add page bending update here
    updatePageBending()
  })

  core.startAnimationLoop()
}

// --- Book Logic ---
async function initBook() {
  bookGroup = new THREE.Group()
  scene.add(bookGroup)

  // 1. Textures
  const coverTex = await core.loadTexture(`${BASE_IMG}static/library_app/2018_1766770808923142.jpg`).catch(() => null)
  const paperTex = await core.loadTexture(`${BASE_IMG}static/library_app/2018_1766770808923142.jpg`).catch(() => null)
  
  // Materials
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.FrontSide,
    map: paperTex || null
  })
  
  // Cover Material (Spine) - Now White
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White
    roughness: 0.8,
    metalness: 0.2
  })

  // White Base Material (For sides of stack)
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.1
  })

  // Geometries
  const stackHeight = 0.5
  
  // Stack Geometries
  const stackGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, stackHeight)
  stackGeo.translate(PAGE_WIDTH / 2, 0, -stackHeight / 2) 

  // Right Stack Materials: Sides White, Top (+Z) Image
  // Faces: +x, -x, +y, -y, +z, -z
  // +Z is Front/Top in this translation context? 
  // Wait, BoxGeometry is created centered at origin.
  // Z axis is thickness.
  // +Z face is the "Front" face.
  // We translate it -stackHeight/2 in Z, so top face is at Z=0.
  // So index 4 (+Z) is the top face.
  const rightStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    pageMat.clone(), // +Z (Top)
    whiteMat
  ]

  rightStack = new THREE.Mesh(stackGeo, rightStackMats)
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  
  // Left Stack Materials
  // It is rotated Y = -PI.
  // Local +Z (Top) becomes World -Z (Bottom).
  // Local -Z (Back) becomes World +Z (Top).
  // So visible face is -Z (Index 5).
  const leftStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    whiteMat,
    pageMat.clone() // -Z (Back -> Top when rotated)
  ]

  leftStack = new THREE.Mesh(stackGeo, leftStackMats)
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI
  
  // Flipper Group (Contains Front/Back meshes with high segments)
  flipper = new THREE.Group()
  flipper.position.z = 0.05 
  
  // Use PlaneGeometry with many segments for bending
  const bendPageGeo = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_SEGMENTS, 1)
  bendPageGeo.translate(PAGE_WIDTH / 2, 0, 0) // Pivot at spine
  
  // Flipper Front
  flipperFront = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperFront.castShadow = true
  flipperFront.position.z = 0.01 // Offset
  
  // Flipper Back
  flipperBack = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperBack.receiveShadow = true
  flipperBack.position.z = -0.01
  flipperBack.rotation.y = Math.PI // Face back
  // Scale -1 X to correct normal/texture direction for back page
  flipperBack.scale.x = -1 
  
  flipper.add(flipperFront)
  flipper.add(flipperBack)
  
  bookGroup.add(rightStack)
  bookGroup.add(leftStack)
  bookGroup.add(flipper)

  // Spine
  const spineMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, PAGE_HEIGHT + 0.5, 32, 1, false, 0, Math.PI),
    coverMat
  )
  spineMesh.rotation.z = Math.PI / 2
  spineMesh.rotation.y = Math.PI / 2
  spineMesh.geometry.rotateX(Math.PI / 2)
  spineMesh.position.z = -0.1
  bookGroup.add(spineMesh)

  // Initial Update
  await updateTextures()
  flipper.visible = false
}

// --- Bending Logic ---
function updatePageBending() {
    if (!flipper || !flipper.visible) return
    
    // Calculate bend based on rotation angle
    // Angle goes from 0 (Right) to -PI (Left)
    const angle = flipper.rotation.y
    // Normalized progress 0 to 1
    const progress = Math.abs(angle) / Math.PI 
    
    // Peak bend happens at 50% (progress 0.5)
    // Simple parabola: y = 4 * h * x * (1-x)
    // But we are bending the geometry vertices.
    // We bend along Z axis based on X position.
    
    const bendFactor = Math.sin(progress * Math.PI) * 2.0 // Max bend amount
    const torsion = clickRelativeY * 0.5 // Torsion strength based on click Y
    
    // Deform Front Page
    const positionAttribute = flipperFront.geometry.attributes.position
    for ( let i = 0; i < positionAttribute.count; i ++ ) {
        const x = positionAttribute.getX( i )
        const y = positionAttribute.getY( i )
        // Normalize x from 0 to PAGE_WIDTH
        const normX = x / PAGE_WIDTH
        const normY = y / (PAGE_HEIGHT / 2) // -1 to 1

        // Bend Z upwards
        // Formula: Z = bendFactor * sin(normX * PI) * (1 + torsion * normY)
        // If torsion > 0 (click top), normY=1 gets boost.
        // If torsion < 0 (click bottom), normY=-1 gets boost.
        let zMod = 1 + torsion * normY
        // Clamp zMod to avoid weird inversions if torsion is extreme (though 0.5 is safe)
        
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
        const normY = y / (PAGE_HEIGHT / 2) // -1 to 1
        
        // Back Mesh is RotY(180) + ScaleX(-1).
        // Y axis is consistent with Group Y.
        // We match Front deformation Z.
        // Front Z = +val. Back Mesh Local -Z = +val -> Local Z = -val.
        // Torsion logic: If Front top bends more, Back top should bend more.
        // normY is consistent.
        
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
    // Calculate relative Y based on hit point.
    // Book center Y is approx 0.
    // Y range is -PAGE_HEIGHT/2 to PAGE_HEIGHT/2.
    // Clamp it to -1 to 1.
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
  // Bending is updated in animation loop
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
    const frontTex = await getTexture(i)
    const backTex = await getTexture(i + 1)
    
    if (frontTex) (flipperFront.material as THREE.MeshStandardMaterial).map = frontTex
    if (backTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = backTex
        backTex.wrapS = THREE.RepeatWrapping
        backTex.repeat.x = -1 
    }
    
    const nextNextTex = await getTexture(i + 2) 
    if (nextNextTex) {
        // Right Stack is array material, index 4 is top
        const mats = rightStack.material as THREE.MeshStandardMaterial[]
        mats[4].map = nextNextTex
    }
    
  } else {
    flipper.rotation.y = -Math.PI
    const prevTex = await getTexture(i - 1)
    if (prevTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = prevTex
        prevTex.wrapS = THREE.RepeatWrapping
        prevTex.repeat.x = -1;
        
        (flipperFront.material as THREE.MeshStandardMaterial).map = prevTex
    }
    
    const prevPrevTex = await getTexture(i - 2)
    if (prevPrevTex) {
        // Left Stack is array material, index 5 is top (Back face)
        const mats = leftStack.material as THREE.MeshStandardMaterial[]
        mats[5].map = prevPrevTex
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
    duration: 0.8,
    ease: "power2.inOut", // Smooth finish
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
      // Index 5 for left stack
      const mats = leftStack.material as THREE.MeshStandardMaterial[]
      mats[5].map = tex
      mats[5].needsUpdate = true
      leftStack.visible = true
    }
  } else {
    leftStack.visible = false
  }

  // Right Stack (Underneath) - Shows i
  const tex = await getTexture(i)
  if (tex) {
    // Index 4 for right stack
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    mats[4].map = tex
    mats[4].needsUpdate = true
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
