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
            {{ currentSpreadIndex }} / {{ totalSpreads }}
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
  thickness: 0.15 
})

// --- Mock Data & Page Management ---
const contentImages = Array.from({ length: 20 }).map((_, i) => {
  return `${BASE_IMG}static/library_app/2018_1766770808923142.jpg`
})

// Spread Logic:
// Spread 0: Cover (Right: Cover Image)
// Spread 1: Page 1 (Left: Content 1, Right: Content 2)
// Spread 2: Page 2 (Left: Content 3, Right: Content 4)
// ...
// Total Spreads = 1 (Cover) + ceil(contentImages.length / 2)
const totalSpreads = computed(() => 1 + Math.ceil(contentImages.length / 2))

// --- State ---
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const isAnimating = ref(false)
const currentSpreadIndex = ref(0) // Start at 0 (Cover)
const debugMode = ref(true)

// --- Three.js Variables ---
let core: ThreeCore
let scene: THREE.Scene
// Raycaster for Drag
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isDragging = false
let dragStartPoint = new THREE.Vector2()
let clickRelativeY = 0 

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
  if (props.ratio) {
    const parts = props.ratio.split(/[:/]/).map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
       PAGE_WIDTH = PAGE_HEIGHT * (parts[0] / parts[1])
    }
  }

  await nextTick()
  setTimeout(async () => {
    initThree()
    await initBook()
    loading.value = false
  }, 1000)
  
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

  const pointLight = new THREE.PointLight(0xffd700, 0.8, 20)
  pointLight.position.set(0, 5, 5)
  scene.add(pointLight)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
  if (bookGroup) {
      gsap.to(bookGroup.position, {
        y: 0.5,
        duration: 2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      })
  }
  
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

  const stackHeight = props.thickness 
  
  const stackGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, stackHeight)
  stackGeo.translate(PAGE_WIDTH / 2, 0, -stackHeight / 2) 

  const rightStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    pageMat.clone(), 
    whiteMat
  ]

  rightStack = new THREE.Mesh(stackGeo, rightStackMats)
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  
  const leftStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    whiteMat,
    pageMat.clone() 
  ]

  leftStack = new THREE.Mesh(stackGeo, leftStackMats)
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI
  
  flipper = new THREE.Group()
  flipper.position.z = 0.02 
  
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

  const spineRadius = stackHeight * 0.6 
  const spineMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(spineRadius, spineRadius, PAGE_HEIGHT + 0.2, 32, 1, false, 0, Math.PI),
    coverMat
  )
  spineMesh.rotation.z = Math.PI / 2
  spineMesh.rotation.y = Math.PI / 2
  spineMesh.geometry.rotateX(Math.PI / 2)
  spineMesh.position.z = -stackHeight / 2
  bookGroup.add(spineMesh)

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
    
    if (obj === rightStack && currentSpreadIndex.value < totalSpreads.value) {
      isDragging = true
      core.controls.enabled = false
      dragStartPoint.set(event.clientX, event.clientY)
      setupFlipperForDrag('next')
    } else if (obj === leftStack && currentSpreadIndex.value > 0) {
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
  const i = currentSpreadIndex.value
  
  // Logic:
  // Spread i: Left Page showing Content (2*i - 3), Right Page showing Content (2*i - 2)
  // Spread 0 (Cover): Left - (Hidden), Right - Cover
  // Spread 1: Left - Content 0 (Back of Cover), Right - Content 1
  // Spread 2: Left - Content 2, Right - Content 3
  
  // When Flipping NEXT from Spread i to Spread i+1:
  // Flipper Front (Visible initially): Right Page of Spread i (Content 2*i - 2)
  // Flipper Back (Revealed): Left Page of Spread i+1 (Content 2*(i+1) - 3) = Content 2*i - 1
  // Right Stack (Revealed): Right Page of Spread i+1 (Content 2*(i+1) - 2) = Content 2*i
  
  if (direction === 'next') {
    flipper.rotation.y = 0
    const currentRightTex = await getTextureForSpread(i, 'right')
    const nextLeftTex = await getTextureForSpread(i + 1, 'left')
    
    // Flipper Front: Current Right Page
    if (currentRightTex) {
        (flipperFront.material as THREE.MeshStandardMaterial).map = currentRightTex;
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        (flipperFront.material as THREE.MeshStandardMaterial).map = null;
        (flipperFront.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }

    // Flipper Back: Next Left Page
    if (nextLeftTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = nextLeftTex
        nextLeftTex.wrapS = THREE.RepeatWrapping
        nextLeftTex.repeat.x = -1;
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        (flipperBack.material as THREE.MeshStandardMaterial).map = null;
        (flipperBack.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    
    // Right Stack Underneath: Next Right Page
    const nextRightTex = await getTextureForSpread(i + 1, 'right') 
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    if (nextRightTex) {
        mats[4].map = nextRightTex
        mats[4].needsUpdate = true
    } else {
        mats[4].map = null
        mats[4].color.set(0xffffff)
        mats[4].needsUpdate = true
    }
    
  } else {
    // Flipping PREV from Spread i to Spread i-1
    // Flipper Front (Hidden initially, Back face visible): Right Page of Spread i-1 (Content 2*(i-1) - 2)
    // Flipper Back (Visible initially): Left Page of Spread i (Content 2*i - 3)
    // Left Stack Underneath: Left Page of Spread i-1 (Content 2*(i-1) - 3)
    
    flipper.rotation.y = -Math.PI
    
    const currentLeftTex = await getTextureForSpread(i, 'left')
    
    // Flipper Back (Visible): Current Left Page
    if (currentLeftTex) {
        (flipperBack.material as THREE.MeshStandardMaterial).map = currentLeftTex
        currentLeftTex.wrapS = THREE.RepeatWrapping
        currentLeftTex.repeat.x = -1;
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
        
        // Front needs to match prev right for edge-on consistency, or separate logic
    } else {
        (flipperBack.material as THREE.MeshStandardMaterial).map = null;
        (flipperBack.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperBack.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    
    // Flipper Front: Prev Right Page
    const prevRightTex = await getTextureForSpread(i - 1, 'right')
    if (prevRightTex) {
        (flipperFront.material as THREE.MeshStandardMaterial).map = prevRightTex;
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    } else {
        (flipperFront.material as THREE.MeshStandardMaterial).map = null;
        (flipperFront.material as THREE.MeshStandardMaterial).color.set(0xffffff);
        (flipperFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    
    // Left Stack Underneath: Prev Left Page
    const prevLeftTex = await getTextureForSpread(i - 1, 'left')
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    if (prevLeftTex) {
        mats[5].map = prevLeftTex
        mats[5].needsUpdate = true
        leftStack.visible = true
    } else {
        // If Prev Spread is 0, Left Page is null (inside of cover? or just empty).
        // Spread 0: Left=null, Right=Cover.
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
        currentSpreadIndex.value += 1
      } else {
        currentSpreadIndex.value -= 1
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

// Map Spread Index to Content
// Spread 0: Left=None, Right=Cover
// Spread 1: Left=Content[0], Right=Content[1]
// Spread 2: Left=Content[2], Right=Content[3]
// ...
// Spread k: Left=Content[2k-2], Right=Content[2k-1]
async function getTextureForSpread(spreadIndex: number, side: 'left' | 'right'): Promise<THREE.Texture | null> {
    if (spreadIndex < 0) return null
    
    let url = ''
    if (spreadIndex === 0) {
        if (side === 'right') {
            return props.coverImage ? await loadTex(props.coverImage) : null
        } else {
            return null // No left page on cover spread
        }
    } else {
        // Content Pages
        const k = spreadIndex
        let contentIdx = -1
        if (side === 'left') {
            contentIdx = 2 * k - 2
        } else {
            contentIdx = 2 * k - 1
        }
        
        if (contentIdx >= 0 && contentIdx < contentImages.length) {
            return await loadTex(contentImages[contentIdx])
        }
        return null
    }
}

async function loadTex(url: string): Promise<THREE.Texture | null> {
    try {
        const tex = await core.loadTexture(url)
        tex.colorSpace = THREE.SRGBColorSpace
        return tex
    } catch {
        return null
    }
}

async function updateTextures() {
  const i = currentSpreadIndex.value
  
  // Left Stack (Top) - Shows Left Page of current spread
  if (i > 0) {
    const tex = await getTextureForSpread(i, 'left')
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    if (tex) {
      mats[5].map = tex
      mats[5].needsUpdate = true
      leftStack.visible = true
    } else {
      mats[5].map = null
      mats[5].color.set(0xffffff) 
      mats[5].needsUpdate = true
      // Only hide if it's strictly empty and not just a blank white page?
      // For spread 0, left is null, so hidden.
      // For spread 1, left is content[0].
      leftStack.visible = true
    }
    // Special case for spread 0 (Cover) - Left stack shouldn't be visible
    if (i === 0) leftStack.visible = false
  } else {
    leftStack.visible = false
  }

  // Right Stack (Underneath) - Shows Right Page of current spread
  if (i < totalSpreads.value) {
    const tex = await getTextureForSpread(i, 'right')
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    if (tex) {
        mats[4].map = tex
        mats[4].needsUpdate = true
    } else {
        mats[4].map = null
        mats[4].color.set(0xffffff) 
        mats[4].needsUpdate = true
    }
     rightStack.visible = true
  } else {
     rightStack.visible = false
  }
}

function nextPage() {
    if (isAnimating.value || currentSpreadIndex.value >= totalSpreads.value) return
    isAnimating.value = true
    clickRelativeY = 0 // Reset torsion for auto flip
    setupFlipperForDrag('next').then(() => finishPageFlip('next'))
}

function prevPage() {
    if (isAnimating.value || currentSpreadIndex.value <= 0) return
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
