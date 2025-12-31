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
  thickness: 0.2 // Slightly thicker default for box effect
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
let pageBlockGroup: THREE.Group
let leftStack: THREE.Mesh
let rightStack: THREE.Mesh
let flipper: THREE.Group 
let flipperFront: THREE.Mesh
let flipperBack: THREE.Mesh
let spine: THREE.Mesh
let frontCover: THREE.Mesh
let backCover: THREE.Mesh

// Calculate Dimensions based on ratio
let PAGE_WIDTH = 5
let PAGE_HEIGHT = 7.5
const PAGE_SEGMENTS = 20 

// Cover settings
const COVER_OVERHANG = 0.2
const COVER_THICKNESS = 0.05

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
  
  // Materials
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.FrontSide,
    map: paperTex || null
  })
  
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White default
    roughness: 0.8,
    metalness: 0.1,
  })

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0
  })

  // Dimensions
  const stackHeight = props.thickness 
  const coverWidth = PAGE_WIDTH + COVER_OVERHANG
  const coverHeight = PAGE_HEIGHT + COVER_OVERHANG * 2

  // --- 1. Covers (Hard Covers) ---
  
  // Back Cover (Fixed)
  const backCoverGeo = new THREE.BoxGeometry(coverWidth, coverHeight, COVER_THICKNESS)
  backCoverGeo.translate(coverWidth/2, 0, 0)
  
  backCover = new THREE.Mesh(backCoverGeo, coverMat)
  backCover.position.z = -stackHeight / 2 - COVER_THICKNESS / 2
  backCover.castShadow = true
  backCover.receiveShadow = true
  bookGroup.add(backCover)
  
  // Front Cover (Static left side for when book is open past cover)
  const frontCoverGeo = new THREE.BoxGeometry(coverWidth, coverHeight, COVER_THICKNESS)
  frontCoverGeo.translate(coverWidth/2, 0, 0)
  
  frontCover = new THREE.Mesh(frontCoverGeo, coverMat)
  frontCover.position.z = -stackHeight / 2 - COVER_THICKNESS / 2
  frontCover.rotation.y = Math.PI
  
  // Update Back Cover Z
  backCover.position.z = -stackHeight/2 - COVER_THICKNESS/2
  
  // Front Cover (Left side fixed mesh)
  frontCover.position.z = -stackHeight/2 - COVER_THICKNESS/2 
  frontCover.castShadow = true
  frontCover.receiveShadow = true
  bookGroup.add(frontCover)
  
  // --- 2. Page Block (Stacks) ---
  pageBlockGroup = new THREE.Group()
  
  // --- Stacks (Page Block) ---
  const stackGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, stackHeight)
  stackGeo.translate(PAGE_WIDTH / 2, 0, -stackHeight / 2) 

  const rightStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    pageMat.clone(), // Top
    whiteMat
  ]
  rightStack = new THREE.Mesh(stackGeo, rightStackMats)
  rightStack.castShadow = true
  rightStack.receiveShadow = true
  
  // Adjust Right Stack Z to align with spine center
  rightStack.position.z = stackHeight / 2
  pageBlockGroup.add(rightStack)
  
  const leftStackMats = [
    whiteMat, whiteMat, whiteMat, whiteMat,
    whiteMat,
    pageMat.clone() 
  ]
  leftStack = new THREE.Mesh(stackGeo, leftStackMats)
  leftStack.castShadow = true
  leftStack.receiveShadow = true
  leftStack.rotation.y = -Math.PI
  leftStack.position.z = -stackHeight / 2
  pageBlockGroup.add(leftStack)
  
  bookGroup.add(pageBlockGroup)

  // --- 3. Flipper ---
  flipper = new THREE.Group()
  flipper.position.z = 0 
  
  const bendPageGeo = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_SEGMENTS, 1)
  bendPageGeo.translate(PAGE_WIDTH / 2, 0, 0) 
  
  flipperFront = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperFront.castShadow = true
  flipperFront.position.z = 0.01 
  
  flipperBack = new THREE.Mesh(bendPageGeo.clone(), pageMat.clone())
  flipperBack.receiveShadow = true
  flipperBack.position.z = -0.01
  flipperBack.rotation.y = Math.PI 
  flipperBack.scale.x = -1 
  
  flipper.add(flipperFront)
  flipper.add(flipperBack)
  bookGroup.add(flipper)

  // --- 4. Spine ---
  // Minimal Spine
  const realSpineGeo = new THREE.BoxGeometry(stackHeight, coverHeight, 0.02)
  spine = new THREE.Mesh(realSpineGeo, coverMat)
  spine.rotation.y = Math.PI / 2
  spine.position.x = 0
  spine.position.z = 0 
  
  bookGroup.add(spine)

  await updateTextures()
  flipper.visible = false
}

// --- Bending Logic ---
function updatePageBending() {
    if (!flipper || !flipper.visible) return
    
    const angle = flipper.rotation.y
    const progress = Math.abs(angle) / Math.PI 
    
    // Check if we are flipping the cover
    const isCoverFlip = (currentSpreadIndex.value === 0 && flipper.userData.direction === 'next') || 
                        (currentSpreadIndex.value === 1 && flipper.userData.direction === 'prev')
    
    // Adjust Flipper Size for Cover
    if (isCoverFlip) {
        const scale = (PAGE_WIDTH + COVER_OVERHANG) / PAGE_WIDTH
        const hScale = (PAGE_HEIGHT + COVER_OVERHANG * 2) / PAGE_HEIGHT
        flipper.scale.set(scale, hScale, 1)
        
        // Increase Z offset to avoid clipping stacks
        flipperFront.position.z = COVER_THICKNESS / 2 + 0.01
        flipperBack.position.z = -COVER_THICKNESS / 2 - 0.01
    } else {
        flipper.scale.set(1, 1, 1)
        flipperFront.position.z = 0.01
        flipperBack.position.z = -0.01
    }

    const bendFactor = Math.sin(progress * Math.PI) * (isCoverFlip ? 0.5 : 2.0) // Stiffer cover
    const torsion = clickRelativeY * 0.5 
    
    const positionAttribute = flipperFront.geometry.attributes.position
    for ( let i = 0; i < positionAttribute.count; i ++ ) {
        const x = positionAttribute.getX( i )
        const y = positionAttribute.getY( i )
        const normX = x / PAGE_WIDTH
        const normY = y / (PAGE_HEIGHT / 2) 

        let zMod = 1 + torsion * normY
        const z = bendFactor * Math.sin(normX * Math.PI) * 0.5 * zMod
        positionAttribute.setZ( i, z + (isCoverFlip ? 0 : 0) ) // Base Z handled by mesh pos
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
  
  const intersects = raycaster.intersectObjects([rightStack, leftStack, frontCover, backCover], true)
  
  if (intersects.length > 0) {
    const obj = intersects[0].object
    const point = intersects[0].point
    clickRelativeY = Math.max(-1, Math.min(1, point.y / (PAGE_HEIGHT / 2)))
    
    // Check if clicked Right side
    if ((obj === rightStack || obj === backCover) && currentSpreadIndex.value < totalSpreads.value) {
      if (currentSpreadIndex.value === 0 && obj !== rightStack) return 
      
      isDragging = true
      core.controls.enabled = false
      dragStartPoint.set(event.clientX, event.clientY)
      setupFlipperForDrag('next')
    } else if ((obj === leftStack || obj === frontCover) && currentSpreadIndex.value > 0) {
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
  
  if (direction === 'next') {
    flipper.rotation.y = 0
    const currentRightTex = await getTextureForSpread(i, 'right')
    const nextLeftTex = await getTextureForSpread(i + 1, 'left')
    
    // Flipper Front
    updateMaterialMap(flipperFront.material as THREE.MeshStandardMaterial, currentRightTex)

    // Flipper Back
    updateMaterialMap(flipperBack.material as THREE.MeshStandardMaterial, nextLeftTex)
    if (flipperBack.material.map) {
        flipperBack.material.map.wrapS = THREE.RepeatWrapping
        flipperBack.material.map.repeat.x = -1
    }
    
    // Right Stack Underneath (Next Spread Right Page)
    const nextRightTex = await getTextureForSpread(i + 1, 'right') 
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[4], nextRightTex)
    
    // Correct Scale for Revealed Right Stack
    // If next spread is > 0, it's NOT a cover, so small.
    // If next spread is 0? Impossible for 'next'.
    // So Revealed Right Stack is always Small (Page).
    rightStack.scale.set(1, 1, 1)
    rightStack.position.x = PAGE_WIDTH / 2
    
  } else {
    flipper.rotation.y = -Math.PI
    
    const currentLeftTex = await getTextureForSpread(i, 'left')
    
    // Flipper Back (Visible)
    updateMaterialMap(flipperBack.material as THREE.MeshStandardMaterial, currentLeftTex)
    if (flipperBack.material.map) {
        flipperBack.material.map.wrapS = THREE.RepeatWrapping
        flipperBack.material.map.repeat.x = -1
    }
    
    // Flipper Front
    const prevRightTex = await getTextureForSpread(i - 1, 'right')
    updateMaterialMap(flipperFront.material as THREE.MeshStandardMaterial, prevRightTex)
    
    // Left Stack Underneath (Prev Spread Left Page)
    const prevLeftTex = await getTextureForSpread(i - 1, 'left')
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[5], prevLeftTex)
    
    leftStack.visible = (i - 1) > 0 
    // Special case: If we are flipping back to Spread 1 (i=2 -> i=1).
    // Prev Spread is 1. Left Stack is Spread 1 Left Page (Endpaper).
    // It should be visible and Big? 
    // Wait, Spread 1 Left is Big (Endpaper).
    // So if (i - 1) === 1, we should scale Left Stack to Big.
    if ((i - 1) === 1) {
        // Actually, Endpaper logic: Spread 1 Left is Endpaper.
        // It is big (Cover Inner).
        const scale = (PAGE_WIDTH + COVER_OVERHANG) / PAGE_WIDTH
        const hScale = (PAGE_HEIGHT + COVER_OVERHANG * 2) / PAGE_HEIGHT
        leftStack.scale.set(scale, hScale, 1)
        leftStack.position.x = (PAGE_WIDTH + COVER_OVERHANG) / 2
        // Position X needs to be adjusted because LeftStack is rotated.
        // LeftStack is rotated Y=PI.
        // Local X goes from 0 to Width.
        // Rotated: Local +X is World -X.
        // We want it to extend to the Left (World -X).
        // Default Pos X = PAGE_WIDTH / 2 (2.5). 
        // Pivot at 2.5? No. StackGeo translate PAGE_WIDTH/2. Pivot at 0.
        // If Pivot at 0. Rotated Y=PI. Mesh goes 0 to -Width.
        // If we want it at Left: It should be at X=0?
        // Wait. StackGeo translates 2.5. So Pivot (0,0,0) -> Geometry Center (2.5, 0, -h/2).
        // Mesh at 0,0,0. -> Mesh occupies 0 to 5 in X.
        // LeftStack Rot Y=PI. -> Mesh occupies 0 to -5 in X.
        // This is correct for Left Page.
        // If we Scale X by 1.04. Mesh occupies 0 to -5.2.
        // So LeftStack Position X should stay 0?
        // Wait, rightStack.position.x = PAGE_WIDTH / 2 ??
        // In init: stackGeo translate PAGE_WIDTH/2. -> Pivot at Left Edge.
        // rightStack Mesh at 0,0,0 -> Box from 0 to 5.
        // Why did I set rightStack.position.x = PAGE_WIDTH/2 in updateTextures?
        // Ah! If I set position.x = 2.5, then Pivot moves to 2.5. Box goes from 2.5 to 7.5!
        // That's WRONG.
        // In init, I didn't set position.x for stacks. Default 0.
        // So Box goes 0 to 5.
        // My updateTextures logic `rightStack.position.x = PAGE_WIDTH / 2` was wrong! It shifted pages to right!
        // That explains "separation"!
        
        // CORRECTION: Reset Position X to 0 (or adjust for Overhang centering).
        // If Overhang: Width 5.2.
        // Pivot at 0. Box goes 0 to 5.2.
        // This is correct (extends away from spine).
        // So Position X should always be 0!
        
        leftStack.position.x = 0
    } else {
        leftStack.scale.set(1, 1, 1)
        leftStack.position.x = 0
    }
    
    // And remove my previous erroneous shift for RightStack in setupFlipperForDrag
    rightStack.position.x = 0
  }
}

function updateMaterialMap(mat: THREE.MeshStandardMaterial, tex: THREE.Texture | null) {
    if (tex) {
        mat.map = tex
        mat.needsUpdate = true
        mat.color.set(0xffffff)
    } else {
        mat.map = null
        mat.color.set(0xffffff)
        mat.needsUpdate = true
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
      if (flipperBack.material.map) flipperBack.material.map.repeat.x = 1
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

async function getTextureForSpread(spreadIndex: number, side: 'left' | 'right'): Promise<THREE.Texture | null> {
    if (spreadIndex < 0) return null
    
    if (spreadIndex === 0) {
        if (side === 'right') {
            return props.coverImage ? await loadTex(props.coverImage) : null
        } else {
            return null 
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
  
  // Left Stack (Top)
  if (i > 0) {
    const tex = await getTextureForSpread(i, 'left')
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[5], tex)
    
    leftStack.visible = true
    frontCover.visible = true
    
    // Scale Logic for Left Stack
    // If i=1 (Spread 1), Left is Endpaper.
    // It should match Cover Size?
    // Let's assume Endpaper is Big.
    /* 
    if (i === 1) {
        const scale = (PAGE_WIDTH + COVER_OVERHANG) / PAGE_WIDTH
        const hScale = (PAGE_HEIGHT + COVER_OVERHANG * 2) / PAGE_HEIGHT
        leftStack.scale.set(scale, hScale, 1)
    } else {
        leftStack.scale.set(1, 1, 1)
    }
    */
    // For now, keep Left Stack always Small (Page Block), except maybe Position.
    // Actually if LeftStack is Small, and FrontCover (Big) is underneath.
    // It looks like pages on top of cover. Correct.
    // So NO Scale needed for Left Stack (unless we want full-bleed endpaper).
    leftStack.scale.set(1, 1, 1)
    leftStack.position.x = 0 // Always 0 (Pivot at Spine)

  } else {
    leftStack.visible = false
    frontCover.visible = false 
  }

  // Right Stack (Top)
  if (i < totalSpreads.value) {
    const tex = await getTextureForSpread(i, 'right')
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[4], tex)
    
    // Resize Right Stack based on cover?
    // If i=0, Right Stack IS the Front Cover. Must be Big.
    if (i === 0) {
        const scale = (PAGE_WIDTH + COVER_OVERHANG) / PAGE_WIDTH
        const hScale = (PAGE_HEIGHT + COVER_OVERHANG * 2) / PAGE_HEIGHT
        rightStack.scale.set(scale, hScale, 1)
        // No Position X shift! Pivot is at 0.
        // Box stretches from 0 to 5.2. Correct.
    } else {
        rightStack.scale.set(1, 1, 1)
    }
    rightStack.position.x = 0
    
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
