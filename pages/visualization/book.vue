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
  // BoxGeometry centered at 0. Moved to correct position.
  const backCoverGeo = new THREE.BoxGeometry(coverWidth, coverHeight, COVER_THICKNESS)
  // Shift pivot to spine edge for symmetry if needed, but back cover is static relative to spine
  // Center X = coverWidth/2. Center Y=0. Center Z = -stackHeight/2 - COVER_THICKNESS/2
  backCoverGeo.translate(coverWidth/2, 0, 0)
  
  backCover = new THREE.Mesh(backCoverGeo, coverMat)
  backCover.position.z = -stackHeight / 2 - COVER_THICKNESS / 2
  backCover.castShadow = true
  backCover.receiveShadow = true
  bookGroup.add(backCover)
  
  // Front Cover (Animated - Part of Flipper or separate?)
  // For simplicity, if we are in "open book" mode, the front cover is just the left side of the spread (Spread 0 left is empty/hidden, but visually we need a cover mesh there?)
  // Actually, spread 0 is "Closed Book" state effectively? No, Spread 0: Right = Cover Front. Left = Empty.
  // Wait, if Spread 0 is Cover, then Right Page shows Cover Image.
  // We need a specific mesh for the Front Cover that can flip?
  // Our existing 'flipper' and 'stacks' logic handles pages.
  // The 'cover' is just Page 0.
  // But we want the cover to be *larger* and *thicker*.
  // So we should probably treat Spread 0 specially: The 'Right Stack' top face for Spread 0 is the Cover.
  
  // HOWEVER, to support thickness and size diff, we might need to separate the cover meshes from the page stack meshes.
  // Let's keep the 'stacks' as the "Page Block" (inner white pages).
  // And added 'Cover' meshes.
  
  // Front Cover Mesh (Static left side for when book is open past cover)
  const frontCoverGeo = new THREE.BoxGeometry(coverWidth, coverHeight, COVER_THICKNESS)
  frontCoverGeo.translate(coverWidth/2, 0, 0)
  
  frontCover = new THREE.Mesh(frontCoverGeo, coverMat)
  frontCover.position.z = -stackHeight / 2 - COVER_THICKNESS / 2
  // Rotate to be on the left
  frontCover.rotation.y = Math.PI
  // Initially hidden if we start at Cover (Spread 0). 
  // At Spread 0, the cover is on the Right (Flipper Front or Right Stack Top).
  // But wait, Spread 0 means we see the Front Cover on the Right side? 
  // Standard "Western" book: Closed book, Front Cover is on Top (Right side relative to spine if we look from top?).
  // If we open it, Front Cover goes to Left.
  // So at Spread 0, we see Front Cover on Right.
  
  // Let's update the stacks to be the "Page Block".
  // Page Block is slightly smaller than cover.
  
  // --- 2. Page Block (Stacks) ---
  pageBlockGroup = new THREE.Group()
  // Lift page block so it sits on back cover (if back cover is at bottom Z)
  // Actually, let's center everything around Z=0.
  
  // Re-adjust Z positions:
  // Spine Center Z = 0. Radius = stackHeight/2 + COVER_THICKNESS.
  // Back Cover Z = -stackHeight/2 - COVER_THICKNESS/2.
  // Front Cover (when closed) Z = +stackHeight/2 + COVER_THICKNESS/2.
  // Page Block Z range: -stackHeight/2 to +stackHeight/2.
  
  // Update Back Cover Z
  backCover.position.z = -stackHeight/2 - COVER_THICKNESS/2
  
  // Front Cover (Left side fixed mesh)
  frontCover.position.z = -stackHeight/2 - COVER_THICKNESS/2 // Same plane as back cover when open flat
  frontCover.castShadow = true
  frontCover.receiveShadow = true
  bookGroup.add(frontCover)
  
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
  // rightStack sits on top of back cover? No, it's half thickness.
  // Its Z goes from 0 to -stackHeight.
  // We want it from 0 to +stackHeight/2 ?
  // Let's stick to: PageBlock center Z=0.
  // StackGeo translates -stackHeight/2. So mesh at 0 spans 0 to -stackHeight.
  // We want it to span +stackHeight/2 to -stackHeight/2 ?
  // Right Stack represents the pile of pages on the right.
  // If we are at Spread 0, all pages are on Right. Stack is full height.
  // If we are at last Spread, all pages are on Left. Right Stack empty.
  // This dynamic height is complex. Simplification: Fixed height stacks, changing texture.
  
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
  leftStack.position.z = stackHeight / 2 // Same start Z, but rotated so it goes down?
  // Rotated Y=PI. +Z becomes -Z.
  // Geo: 0 to -stackHeight.
  // Rotated: 0 to +stackHeight.
  // If PosZ = stackHeight/2. Range: stackHeight/2 to 3*stackHeight/2. Too high.
  // We want Left Stack to mirror Right Stack.
  // Right Stack (0): 0 to -stackHeight (local). + stackHeight/2 (pos) -> stackHeight/2 to -stackHeight/2. Correct.
  // Left Stack (0): 0 to -stackHeight (local). RotY -> 0 to +stackHeight.
  // We want result to be -stackHeight/2 to stackHeight/2.
  // So Left Stack PosZ should be -stackHeight/2.
  // 0 + (-stackHeight/2) = -0.5. Top = -0.5 + 1 = 0.5. Correct.
  leftStack.position.z = -stackHeight / 2
  pageBlockGroup.add(leftStack)
  
  bookGroup.add(pageBlockGroup)

  // --- 3. Flipper ---
  flipper = new THREE.Group()
  // Flipper Z needs to be slightly above stacks to avoid Z-fight
  flipper.position.z = 0 
  
  // Flipper needs separate Cover Mesh and Page Mesh to handle size diff?
  // Complex. Easier: Flipper is always "Page Size". 
  // BUT if we flip the Cover, it must look like the cover.
  // Implementation: Scale the flipper mesh if it is the cover page.
  
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
  const spineWidth = stackHeight + COVER_THICKNESS // Full thickness
  // Spine geometry: Curved Box or Cylinder segment
  // Cylinder is easiest.
  const spineGeo = new THREE.CylinderGeometry(spineWidth/2, spineWidth/2, coverHeight, 32, 1, true, Math.PI, Math.PI)
  // Rotate to align
  spineGeo.rotateZ(Math.PI / 2) // Cylinder along X
  // The cylinder is created around Y axis. Rotate Z 90 -> along X.
  // But we want it along Y (vertical book spine).
  // Cylinder default is Y axis.
  // We want half cylinder facing out (-X direction?).
  // Spine is at X=0.
  // Let's use Box for now for "Square" spine look as requested ("方块").
  const spineBoxGeo = new THREE.BoxGeometry(spineWidth, coverHeight, spineWidth) 
  // Just a block.
  spine = new THREE.Mesh(spineBoxGeo, coverMat)
  // Spine position: X=0 (Center), Y=0, Z=0.
  // Shift it slightly back to cover the gap?
  spine.position.x = -spineWidth/2 // Move left to act as hinge area?
  // Actually spine connects Back and Front.
  // Let's place it centered at X=0.
  // It should block the view between stacks.
  spine.scale.set(0.2, 1, 1) // Thin in X, full in Y/Z
  // Actually "Spine" usually implies the back of the book.
  // Rotate 90 deg?
  spine = new THREE.Mesh(
      new THREE.BoxGeometry(stackHeight + COVER_THICKNESS, coverHeight, 0.1),
      coverMat
  )
  spine.position.x = 0
  spine.rotation.y = Math.PI / 2 // Face -X
  spine.position.x = -0.1 // Slight offset
  
  // Better Spine:
  // A vertical strip at x=0.
  // Reduce dimensions to be minimal as requested
  const realSpineGeo = new THREE.BoxGeometry(stackHeight, coverHeight, 0.02)
  spine = new THREE.Mesh(realSpineGeo, coverMat)
  spine.rotation.y = Math.PI / 2
  spine.position.x = 0
  spine.position.z = 0 // Center Z
  // Shift X to be flush with left edge of covers?
  // Covers start at X=0 and go +Width.
  // Spine should be at X=0.
  
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
  
  // Raycast against Stacks AND Covers
  // If Spread 0, Right Stack is covered by Front Cover (if we had one).
  // Actually, spread 0 Right side IS the Cover. 
  // Since we use RightStack for rendering cover texture at Spread 0, we can click RightStack.
  // BUT we need to distinguish Cover click vs Page click?
  // The logic is same: Click Right -> Next.
  
  const intersects = raycaster.intersectObjects([rightStack, leftStack, frontCover, backCover], true)
  
  if (intersects.length > 0) {
    const obj = intersects[0].object
    const point = intersects[0].point
    clickRelativeY = Math.max(-1, Math.min(1, point.y / (PAGE_HEIGHT / 2)))
    
    // Check if clicked Right side
    if ((obj === rightStack || obj === backCover) && currentSpreadIndex.value < totalSpreads.value) {
      // Allow clicking back cover to close if open? No, back cover is on left usually?
      // Back Cover is Left (Index 0 is Back Cover at bottom).
      // If we are at Spread 0. Right Stack is visible (Front Cover). Click it -> Next.
      if (currentSpreadIndex.value === 0 && obj !== rightStack) return // Only click stack/cover
      
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
    
    // Right Stack Underneath
    const nextRightTex = await getTextureForSpread(i + 1, 'right') 
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[4], nextRightTex)
    
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
    
    // Left Stack Underneath
    const prevLeftTex = await getTextureForSpread(i - 1, 'left')
    const mats = leftStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[5], prevLeftTex)
    
    leftStack.visible = (i - 1) > 0 // Only visible if there is a spread before previous
    if (i===1) leftStack.visible = false // Spread 1 prev is Spread 0. Spread 0 Left is empty.
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
    
    // Visibility logic:
    // If i=1 (Spread 1), Left is Page 1.
    // Left Stack should show Left Cover? 
    // Left Stack represents the pile on the left.
    // If we are at Spread 1, Left Pile Top is Page 1.
    // Underneath Page 1 is Front Cover Inner?
    // Our Left Stack is a block. 
    // If Spread > 0, we show Left Stack.
    leftStack.visible = true
    
    // Front Cover Visibility:
    // If i > 0, Front Cover (mesh) is on the left bottom.
    // It should be visible underneath the stack.
    frontCover.visible = true
  } else {
    // Spread 0: Left is empty.
    leftStack.visible = false
    frontCover.visible = false // Hidden, effectively "on the right" (Right Stack handles it)
  }

  // Right Stack (Top)
  if (i < totalSpreads.value) {
    const tex = await getTextureForSpread(i, 'right')
    const mats = rightStack.material as THREE.MeshStandardMaterial[]
    updateMaterialMap(mats[4], tex)
    
    // Resize Right Stack based on cover?
    // If i=0, Right Stack is the Front Cover.
    // But we defined Right Stack as "Page Size".
    // If we want Front Cover to be larger, we should scale Right Stack?
    // OR hide Right Stack and show a "Front Cover Mesh" on top?
    // Easier: Scale Right Stack mesh if i=0.
    if (i === 0) {
        const scale = (PAGE_WIDTH + COVER_OVERHANG) / PAGE_WIDTH
        const hScale = (PAGE_HEIGHT + COVER_OVERHANG * 2) / PAGE_HEIGHT
        rightStack.scale.set(scale, hScale, 1)
        rightStack.position.x = (PAGE_WIDTH + COVER_OVERHANG) / 2
        // Texture might stretch. Ideally use mapped UVs or distinct mesh.
    } else {
        rightStack.scale.set(1, 1, 1)
        rightStack.position.x = PAGE_WIDTH / 2
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
