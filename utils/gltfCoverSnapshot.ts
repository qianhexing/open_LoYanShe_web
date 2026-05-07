import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

export interface GltfCoverSnapshotOptions {
  /** 输出宽度，默认 512 */
  width?: number
  /** 输出高度，默认 512 */
  height?: number
  /** 背景色 */
  background?: string
  /**
   * 视锥留白系数，略大于 1 可避免贴边
   * @default 1.2
   */
  margin?: number
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry?.dispose()
      const m = mesh.material
      if (Array.isArray(m)) {
        for (const mat of m) mat.dispose()
      } else {
        m?.dispose()
      }
    }
  })
}

/**
 * 从本地 GLB/GLTF 文件加载模型，渲染一帧后导出 PNG Blob（用于封面）。
 * 会计算场景包围球并将透视相机推远，使模型完整落在画面内。
 */
export async function createGltfCoverBlob(
  file: File,
  options: GltfCoverSnapshotOptions = {}
): Promise<Blob> {
  const { width = 512, height = 512, background = '#e5e7eb', margin = 1.2 } = options

  const ext = file.name.toLowerCase()
  if (!ext.endsWith('.glb') && !ext.endsWith('.gltf')) {
    throw new Error('需要 .glb 或 .gltf 文件')
  }

  const objectUrl = URL.createObjectURL(file)
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
  loader.setDRACOLoader(draco)

  let gltf: Awaited<ReturnType<typeof loader.loadAsync>>
  try {
    gltf = await loader.loadAsync(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
    draco.dispose()
  }

  const root = gltf.scene
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) {
    disposeObject(root)
    throw new Error('无法计算模型包围盒，请确认文件有效')
  }

  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)
  root.updateMatrixWorld(true)

  const box2 = new THREE.Box3().setFromObject(root)
  const sphere = box2.getBoundingSphere(new THREE.Sphere())
  const radius = Math.max(sphere.radius, 0.0001)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(background)

  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const d1 = new THREE.DirectionalLight(0xffffff, 0.9)
  d1.position.set(2.2, 4, 2.5)
  scene.add(d1)
  const d2 = new THREE.DirectionalLight(0x8899ff, 0.35)
  d2.position.set(-2, 1, -2)
  scene.add(d2)
  scene.add(new THREE.HemisphereLight(0xf0f0f0, 0x3a3a3a, 0.4))

  scene.add(root)

  const aspect = width / height
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.01, 10000)

  const vFovRad = THREE.MathUtils.degToRad(camera.fov)
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect)
  const distV = (radius * margin) / Math.tan(vFovRad / 2)
  const distH = (radius * margin) / Math.tan(hFovRad / 2)
  const dist = Math.max(distV, distH, 0.1)

  const eye = new THREE.Vector3(1, 0.45, 1).normalize().multiplyScalar(dist)
  camera.position.copy(eye)
  camera.lookAt(0, 0, 0)
  camera.near = Math.max(dist / 2000, 0.01)
  camera.far = dist * 2000
  camera.updateProjectionMatrix()

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(width, height, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  renderer.render(scene, camera)

  const blob: Blob = await new Promise((resolve, reject) => {
    renderer.domElement.toBlob(
      (b) => {
        if (!b) reject(new Error('截图失败'))
        else resolve(b)
      },
      'image/png',
      0.92
    )
  })

  disposeObject(root)
  renderer.dispose()
  scene.clear()

  return blob
}
