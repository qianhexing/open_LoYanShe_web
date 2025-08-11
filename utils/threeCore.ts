import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import {
	CSS3DRenderer,
	CSS3DObject
} from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer } from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { BASE_IMG } from '@/utils/ipConfig.js'
// @ts-ignore
import { GPUPicker } from 'three_gpu_picking/src/gpupicker.js'
import { TransformGizmo } from './TransformGizmo.js'
export interface SceneObjectJSON {
	type: 'box' | 'sphere' | 'model' | 'image' | 'diary' | 'template'
	position?: [number, number, number]
	rotation?: [number, number, number]
  baseWidth?: number
	scale?: [number, number, number]
	color?: string
	size?: [number, number, number] // for box
	radius?: number // for sphere
	url?: string // for model
	useDracoLoader?: boolean
	dracoDecoderPath?: string
	title?: string // 如果是日记类型
	content?: string // 如果是日记类型
	playAnimations?: string[]
	loopOnce?: boolean
	template_id?: number
}
export interface SceneJSON {
	objects: SceneObjectJSON[]
}

interface ThreeCoreOptions {
	antialias?: boolean
	alpha?: boolean
	clearColor?: number
	cameraType?: 'perspective' | 'orthographic'
	cameraPosition?: { x: number; y: number; z: number }
	enableOrbitControls?: boolean
	enableStats?: boolean
	pixelRatio?: number
	enableCSS3DRenderer?: boolean // 新增选项：是否启用CSS3D渲染器
}

class ThreeCore {
	public scene: THREE.Scene
	public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
	public renderer: THREE.WebGLRenderer
	public css3DRenderer?: CSS3DRenderer // CSS3D渲染器
	public controls: OrbitControls
	public allObjects: THREE.Object3D[] // 场景里的所有模型

	public mixers: AnimationMixer[] = [] // 用于管理多个模型动画混合器
	public stats?: Stats
	public animationCallbacks: Array<() => void>
	public addAnimationFunc: () => void  // 注入animate里的方法
	public resizeCallbacks: Array<(width: number, height: number) => void>
	public options: ThreeCoreOptions
	public container?: HTMLElement | null
	private resizeObserver?: ResizeObserver
	public loadedModelURLs: Set<string> // 已加载过的模型地址集合
	public loadedModels: THREE.Object3D[] // 加载成功的模型数组
	public loadedDiary: Array<{title: string, content: string, object: THREE.Object3D}> // 加载成功的模型数组
	public loadTemplate: THREE.Group[] // 加载成功的模型数组

	

	public clock: THREE.Clock
	public picker: GPUPicker | null
	public gizmo: any | null

	constructor(options: ThreeCoreOptions = {}) {
		const defaultOptions: ThreeCoreOptions = {
			antialias: true,
			alpha: false,
			clearColor: 0x000000,
			cameraType: 'perspective',
			cameraPosition: { x: 0, y: 4, z: 5 },
			enableOrbitControls: true,
			enableStats: false,
			pixelRatio: window.devicePixelRatio || 1,
			enableCSS3DRenderer: false // 默认不启用CSS3D渲染器
		}

		this.options = { ...defaultOptions, ...options }
		this.scene = null!
		this.camera = null!
		this.renderer = null!
		this.animationCallbacks = []
		this.addAnimationFunc = () => {}
		this.resizeCallbacks = []
		this.container = null
		this.controls = null!
		this.picker = null!

		this.loadedModelURLs = new Set()
		this.loadedModels = []
		this.allObjects = []
		this.loadedDiary = [] // 加载的日记文本
		this.loadTemplate = [] // 加载的模版
		
		this.clock = new THREE.Clock()

		this.initScene()
		this.initCamera()
		this.initRenderer()
		this.initPicker()
		// 如果启用了CSS3D渲染器
		if (this.options.enableCSS3DRenderer) {
			this.initCSS3DRenderer()
		}

		this.initLights()

		// if (this.options.enableOrbitControls) {
		//   this.initOrbitControls();
		// }
		this.initOrbitControls()
		if (this.options.enableStats) {
			this.initStats()
		}

		this.gizmo = new TransformGizmo(
			this.scene,
			this.camera,
			this.controls,
			this.renderer.domElement,
			this.picker
		)
		this.scene.add(this.gizmo)
	}
	public async createDiary(obj: SceneObjectJSON): Promise<THREE.Mesh> {
        const radius = 1
				const geometry = new THREE.SphereGeometry(radius, 32, 32)
				const material = new THREE.MeshStandardMaterial({
					color: '#ffaa7f'
				})
				
				const mesh = new THREE.Mesh(geometry, material)
				mesh.userData.type = 'diary'
				mesh.userData.title = obj.title
				mesh.userData.content = obj.content
				this.loadedDiary.push({ title: obj.title || '没有标题', content: obj.content || '没有内容', object: mesh})
				return mesh
	}
	public async loadImageMesh(url: string, baseWidth = 5): Promise<THREE.Mesh> {
		return new Promise((resolve, reject) => {
			if (this.loadedModelURLs.has(url)) {
				const existing = this.loadedModels.find(obj => obj.userData.url === url)
				if (existing) {
					resolve(existing.clone(true) as THREE.Mesh)
					return
				}
			}

			const loader = new THREE.TextureLoader()
			loader.load(
				url,
				texture => {
					const image = texture.image
					if (!image || !image.width || !image.height) {
						reject(new Error(`图片未能正确加载宽高: ${url}`))
						return
					}

					const aspect = image.height / image.width
					const width = baseWidth
					const height = baseWidth * aspect

					const geometry = new THREE.PlaneGeometry(width, height)
					const material = new THREE.MeshBasicMaterial({
						map: texture,
						transparent: true,
						depthTest: false,
						side: THREE.DoubleSide
					})
					const mesh = new THREE.Mesh(geometry, material)
					mesh.userData.url = url
          mesh.userData.type = 'image'

					this.loadedModelURLs.add(url)
					this.loadedModels.push(mesh)

					resolve(mesh)
				},
				undefined,
				err => {
					console.error(`加载图片失败: ${url}`, err)
					reject(err)
				}
			)
		})
	}

	public async loadModel(
		url: string,
		options = {
			useDracoLoader: false,
			dracoDecoderPath: 'jsm/libs/draco/gltf/'
		}
	): Promise<THREE.Object3D> {
		// 如果已经加载过，直接返回缓存的模型
		const loader = new GLTFLoader()
		if (options.useDracoLoader) {
			const dracoLoader = new DRACOLoader()
			const decoderPath = options.dracoDecoderPath || '/draco/gltf/'
			dracoLoader.setDecoderPath(decoderPath)
			loader.setDRACOLoader(dracoLoader)
		}

		return new Promise((resolve, reject) => {
			if (this.loadedModelURLs.has(url)) {
				const existing = this.loadedModels.find(obj => obj.userData.url === url)
				if (existing) {
					resolve(existing.clone(true))
				}
			} else {
				loader.load(
					url,
					gltf => {
						const model = gltf.scene
						model.userData.url = url
            model.userData.type = 'model'
						model.userData.useDracoLoader = options.useDracoLoader
						// this.scene.add(model);
						this.loadedModelURLs.add(url)
						this.loadedModels.push(model)

						// 动画处理
						if (gltf.animations && gltf.animations.length > 0) {
							const mixer = new AnimationMixer(model)
							gltf.animations.forEach(clip => {
								mixer.clipAction(clip).play()
							})
							this.addAnimationCallback(() =>
								mixer.update(this.clock.getDelta())
							)
						}
						resolve(model)
					},
					undefined,
					error => {
						console.error(`加载模型失败: ${url}`, error)
						reject(error)
					}
				)
			}
		})
	}

	initRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: this.options.antialias,
			alpha: this.options.alpha
		})
		this.renderer.domElement.addEventListener('mousedown', e => {
			// 将事件传递给底层的WebGL渲染器
			console.log('webgl控制器被点击了')
		})
		this.renderer.setPixelRatio(this.options.pixelRatio)

		const width = this.container
			? this.container.clientWidth
			: window.innerWidth
		const height = this.container
			? this.container.clientHeight
			: window.innerHeight
		this.renderer.setSize(width, height)

		this.renderer.physicallyCorrectLights = true
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
	}
	initOrbitControls() {
		if (!this.camera || !this.renderer) return
		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.enableDamping = true
		this.controls.dampingFactor = 0.05
	}

	initStats() {
		this.stats = new Stats()
		this.stats.showPanel(0)
		document.body.appendChild(this.stats.dom)
	}

	initLights() {
		const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
		this.scene.add(ambientLight)

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
		directionalLight.position.set(1, 1, 1)
		directionalLight.castShadow = true
		directionalLight.shadow.mapSize.width = 1024
		directionalLight.shadow.mapSize.height = 1024
		this.scene.add(directionalLight)

		const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.7)
		this.scene.add(hemisphereLight)
	}
	addAnimationCallback(callback: () => void) {
		this.animationCallbacks.push(callback)
	}
	initScene() {
		this.scene = new THREE.Scene()
		if (!this.options.alpha) {
			this.scene.background = null
			// new THREE.Color(this.options.clearColor);
		}
	}
	initPicker() {
		this.picker = new GPUPicker(
			THREE,
			this.renderer,
			this.scene,
			this.camera,
			this.idFromObject
		)
	}
	// gpuPick (ev: MouseEvent | TouchEvent) {
	// 	function shouldPickObject(object: THREE.Object3D) {
	// 		// 如果对象具有 `ignorePick` 标志，则忽略它
	//     return object.userData && !object.userData.ignorePick;

	// 	}
	// 	const inversePixelRatio = 1.0 / (window.devicePixelRatio || 1);

	// 	let clientX : number
	//   let clientY : number;
	// 	// 处理触摸事件和鼠标事件
	// 	if ('touches' in ev) {
	// 		// 触摸事件
	// 		clientX = ev.touches[0].clientX;
	// 		clientY = ev.touches[0].clientY;
	// 	} else {
	// 		// 鼠标事件
	// 		clientX = ev.clientX;
	// 		clientY = ev.clientY;
	// 	}
	// 	let sub = 0
	//   if (this.container) {
	//     sub = this.container.getBoundingClientRect().left
	//   }
	//   console.log(clientX, clientY, 'clientX')
	// 	const objId = this.picker.pick(clientX * window.devicePixelRatio - sub * inversePixelRatio, clientY * window.devicePixelRatio, shouldPickObject);
	// 	return this.scene.getObjectById(objId)
	// }
	gpuPick(ev: MouseEvent | TouchEvent) {
		function shouldPickObject(object: THREE.Object3D) {
			return object.userData && !object.userData.ignorePick
		}

		const inversePixelRatio = 1.0 / (window.devicePixelRatio || 1)

		let clientX: number
		let clientY: number

		if ('touches' in ev) {
			clientX = ev.touches[0].clientX
			clientY = ev.touches[0].clientY
		} else {
			clientX = ev.clientX
			clientY = ev.clientY
		}

		let sub = 0
		if (this.container) {
			sub = this.container.getBoundingClientRect().left
		}

		const objId = this.picker.pick(
			clientX * window.devicePixelRatio - sub * inversePixelRatio,
			clientY * window.devicePixelRatio,
			shouldPickObject
		)

		const pickedObject = this.scene.getObjectById(objId)

		function findTopGroup(
			object: THREE.Object3D | null | undefined
		): THREE.Object3D | null {
			if (!object) return null
			let current = object
			while (current.parent && current.parent.type !== 'Scene') {
				current = current.parent
			}
			return current
		}

		return findTopGroup(pickedObject)
	}

	idFromObject(object: THREE.Object3D) {
		let ret: THREE.Object3D | null = object
		while (ret) {
			if (ret.parent?.type === 'Sence') {
				return ret.id
			}
			ret = ret.parent
		}
	}

	// 物体坐标转屏幕坐标
	screenPositionFromObject(obj: THREE.Object3D) {
		const pos = new THREE.Vector3()
		obj.getWorldPosition(pos)
		pos.project(this.camera)
		return {
			x: ((pos.x + 1) * window.innerWidth) / 2,
			y: ((-pos.y + 1) * window.innerHeight) / 2
		}
	}

	initCamera() {
		const { cameraType, cameraPosition } = this.options
		const width = this.container
			? this.container.clientWidth
			: window.innerWidth
		const height = this.container
			? this.container.clientHeight
			: window.innerHeight
		const aspect = width / height

		if (cameraType === 'orthographic') {
			const frustumSize = 5
			this.camera = new THREE.OrthographicCamera(
				(-frustumSize * aspect) / 2,
				(frustumSize * aspect) / 2,
				frustumSize / 2,
				-frustumSize / 2,
				0.1,
				1000
			)
		} else {
			this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
		}

		this.camera.position.set(
			cameraPosition.x,
			cameraPosition.y,
			cameraPosition.z
		)
		this.camera.lookAt(0, 0, 0)
	}
	// 新增方法：初始化CSS3D渲染器
	initCSS3DRenderer() {
		this.css3DRenderer = new CSS3DRenderer()
		this.css3DRenderer.setSize(
			this.container ? this.container.clientWidth : window.innerWidth,
			this.container ? this.container.clientHeight : window.innerHeight
		)

		// 设置CSS3D渲染器的DOM元素样式，使其与WebGL渲染器重叠
		this.css3DRenderer.domElement.style.position = 'absolute'
		this.css3DRenderer.domElement.style.top = '0'
		this.css3DRenderer.domElement.style.pointerEvents = 'none'
		// 在初始化代码中添加
		this.css3DRenderer.domElement.addEventListener('mousedown', e => {
			// 将事件传递给底层的WebGL渲染器
			console.log('点击了')
			this.renderer.domElement.dispatchEvent(new MouseEvent(e.type, e))
		})
		this.renderer.domElement.style.position = 'absolute'
		this.renderer.domElement.style.position = 'absolute'
		this.renderer.domElement.style.zIndex = '0'
		this.css3DRenderer.domElement.style.zIndex = '1'
	}

	// 修改onContainerResize方法以支持CSS3D渲染器
	onContainerResize() {
		if (!this.container) return

		const width = this.container.clientWidth
		const height = this.container.clientHeight
		const aspect = width / height

		// 更新相机
		if (this.camera instanceof THREE.PerspectiveCamera) {
			this.camera.aspect = aspect
		} else if (this.camera instanceof THREE.OrthographicCamera) {
			const frustumSize = 5
			this.camera.left = (-frustumSize * aspect) / 2
			this.camera.right = (frustumSize * aspect) / 2
			this.camera.top = frustumSize / 2
			this.camera.bottom = -frustumSize / 2
		}
		this.camera.updateProjectionMatrix()

		// 更新渲染器
		this.renderer.setSize(width, height)

		// 更新CSS3D渲染器
		if (this.css3DRenderer) {
			this.css3DRenderer.setSize(width, height)
		}

		// 执行注册的回调
		this.resizeCallbacks.forEach(callback => callback(width, height))
	}

	// 修改startAnimationLoop方法以支持CSS3D渲染器
	startAnimationLoop() {
		const animate = () => {
			requestAnimationFrame(animate)

			if (this.controls) {
				this.controls.update()
			}

			this.animationCallbacks.forEach(callback => callback())

			// 渲染WebGL场景
			this.renderer.render(this.scene, this.camera)

			// 如果启用了CSS3D渲染器，也渲染CSS3D场景
			if (this.css3DRenderer) {
				this.css3DRenderer.render(this.scene, this.camera)
			}

			if (this.stats) {
				this.stats.update()
			}
			if (this.addAnimationFunc) {
				this.addAnimationFunc()
			}
		}

		animate()
	}

	// 修改mount方法以支持CSS3D渲染器
	mount(container: HTMLElement | null) {
		// 先清理之前的容器
		if (this.container) {
			if (this.renderer.domElement.parentNode) {
				this.renderer.domElement.parentNode.removeChild(
					this.renderer.domElement
				)
			}
			if (this.css3DRenderer?.domElement.parentNode) {
				this.css3DRenderer.domElement.parentNode.removeChild(
					this.css3DRenderer.domElement
				)
			}
		}

		// 移除之前的resize观察者
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
		}

		this.container = container

		if (this.container) {
			// 添加WebGL渲染器
			this.container.appendChild(this.renderer.domElement)

			// 如果启用了CSS3D渲染器，添加到容器中
			if (this.css3DRenderer) {
				this.container.appendChild(this.css3DRenderer.domElement)
			}

			// 使用ResizeObserver监听容器大小变化
			this.resizeObserver = new ResizeObserver(() => {
				this.onContainerResize()
			})
			this.resizeObserver.observe(this.container)

			// 初始调整大小
			this.onContainerResize()
		} else {
			// 如果没有指定容器，添加到body
			document.body.appendChild(this.renderer.domElement)

			if (this.css3DRenderer) {
				document.body.appendChild(this.css3DRenderer.domElement)
			}

			// 监听窗口大小变化
			window.addEventListener('resize', () => this.onContainerResize())
		}
	}

	// 新增方法：创建CSS3D对象
	createCSS3DObject(element: HTMLElement): CSS3DObject {
		if (!this.css3DRenderer) {
			throw new Error(
				'CSS3DRenderer is not enabled. Set enableCSS3DRenderer to true in options.'
			)
		}
		return new CSS3DObject(element)
	}

	public saveSceneToJSON(): SceneJSON {
		const objects: SceneObjectJSON[] = []
		console.log(this.scene.children)
		// biome-ignore lint: <就用forEach>
		this.scene.children.forEach(obj => {
			// 忽略灯光、摄像机等非 Mesh 类型
			if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Group)) return
			const typeGuess = (() => {
				if (obj.userData.url) {
          if (obj.userData.type === 'model') {
            return 'model'
          }
          return 'image'
        }
				if (obj.userData.type && obj.userData.type === 'template') {
          return 'template'
        }
				if (
					obj instanceof THREE.Mesh &&
					obj.geometry instanceof THREE.BoxGeometry
				)
					return 'box'
				if (
					obj instanceof THREE.Mesh &&
					obj.geometry instanceof THREE.SphereGeometry
				) {
					if (obj.userData && obj.userData.type === 'diary') {
						return 'diary'
					}
					return 'sphere'
				}
				return null
			})()

			if (!typeGuess) return

			const position: [number, number, number] = [
				obj.position.x,
				obj.position.y,
				obj.position.z
			]
			const rotation: [number, number, number] = [
				obj.rotation.x,
				obj.rotation.y,
				obj.rotation.z
			]
			const scale: [number, number, number] = [
				obj.scale.x,
				obj.scale.y,
				obj.scale.z
			]

			const jsonObj: SceneObjectJSON = {
				type: typeGuess,
				position,
				rotation,
				scale
			}

			// 如果是 box 或 sphere，保存颜色和大小
			if (
				typeGuess === 'box' &&
				obj instanceof THREE.Mesh &&
				obj.geometry instanceof THREE.BoxGeometry
			) {
				const boxGeo = obj.geometry as THREE.BoxGeometry
				const size = [
					boxGeo.parameters.width,
					boxGeo.parameters.height,
					boxGeo.parameters.depth
				]
				jsonObj.size = size as [number, number, number]

				const mat = obj.material as THREE.Material
				if ((mat as any).color) {
					jsonObj.color = '#' + (mat as any).color.getHexString()
				}
			}

			if (
				typeGuess === 'sphere' &&
				obj instanceof THREE.Mesh &&
				obj.geometry instanceof THREE.SphereGeometry
			) {
				const sphereGeo = obj.geometry as THREE.SphereGeometry
				jsonObj.radius = sphereGeo.parameters.radius

				const mat = obj.material as THREE.Material
				if ((mat as any).color) {
					jsonObj.color = `#${
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						(mat as any).color.getHexString()
					}`
				}
			}

			if (typeGuess === 'model') {
				jsonObj.url = obj.userData.url.replace(BASE_IMG, '')
				if (obj.userData.useDracoLoader) {
					jsonObj.useDracoLoader = obj.userData.useDracoLoader
				}
			}
      if (typeGuess === 'image') {
				jsonObj.url = obj.userData.url.replace(BASE_IMG, '')
			}
			if (typeGuess === 'diary') {
				jsonObj.title = obj.userData.title
				jsonObj.content = obj.userData.content
			}
			if (typeGuess === 'template') {
				jsonObj.template_id = obj.userData.template_id
			}
			

			objects.push(jsonObj)
		})
    console.log(JSON.stringify(objects), '数据')
		return { objects }
	}
	public async loadSceneFromJSON(json: SceneJSON, renturGroup = false) {
		let group = null
		if (renturGroup) {
			group = new THREE.Group()
			group.userData.ignorePick = true
		}
		for (const obj of json.objects) {
			const position = obj.position || [0, 0, 0]
			const rotation = obj.rotation || [0, 0, 0]
			const scale = obj.scale || [1, 1, 1]

			let mesh: THREE.Object3D | null = null

			if (obj.type === 'box') {
				const size = obj.size || [1, 1, 1]
				const geometry = new THREE.BoxGeometry(...size)
				const material = new THREE.MeshStandardMaterial({
					color: obj.color || '#ffffff'
				})
				mesh = new THREE.Mesh(geometry, material)
				mesh.userData.type = 'box'
			}

			if (obj.type === 'sphere') {
				const radius = obj.radius || 1
				const geometry = new THREE.SphereGeometry(radius, 32, 32)
				const material = new THREE.MeshStandardMaterial({
					color: obj.color || '#ffffff'
				})
				mesh = new THREE.Mesh(geometry, material)
				mesh.userData.type = 'sphere'
			}

			if (obj.type === 'model' && obj.url) {
				try {
					const model = await this.loadModel(BASE_IMG + obj.url, {
						useDracoLoader: obj.useDracoLoader ?? false,
						dracoDecoderPath: '/draco/gltf/'
						// (obj.useDracoLoader && obj.dracoDecoderPath) ? obj.dracoDecoderPath : 'jsm/libs/draco/gltf/',
					})
					mesh = model
				} catch (e) {
					console.warn(`模型加载失败：${obj.url}`, e)
				}
			}
      if (obj.type === 'image' && obj.url) {
        mesh = await this.loadImageMesh(BASE_IMG + obj.url, obj.baseWidth || 5)
      } 
			if (obj.type === 'diary') {
				mesh = await this.createDiary(obj)
      } 
			if (mesh) {
				mesh.position.set(...position)
				mesh.rotation.set(...rotation)
				mesh.scale.set(...scale)
				if (renturGroup) {
					mesh.userData.ignorePick = true
					mesh.traverse((childMesh) => {
						childMesh.userData.ignorePick = true
					})
					group?.add(mesh)
				} else {
					this.allObjects.push(mesh)
					this.scene.add(mesh)
				}

				// const box = this.createBoundingBoxMesh(mesh)
				// box.userData.ignorePick = true
				// box.position.set(...position)
				// box.rotation.set(...rotation)
				// box.scale.set(...scale)
				// box.renderOrder = 100000
				// console.log(box, '包围盒')
			}
		}
		if (renturGroup) {
			return group
		} return null
	}

	createBoundingBoxMesh(object: THREE.Object3D) {
		const box = new THREE.Box3().setFromObject(object)
		const size = new THREE.Vector3()
		const center = new THREE.Vector3()
		box.getSize(size)
		box.getCenter(center)

		const geometry = new THREE.BoxGeometry(
			size.x * 1.1,
			size.y * 1.1,
			size.z * 1.1
		)
		const edges = new THREE.EdgesGeometry(geometry)
		const line = new THREE.LineSegments(
			edges,
			new THREE.LineBasicMaterial({ color: 0x00ffff })
		)

		const boxMesh = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({
				color: 0x00ffff,
				opacity: 0.1,
				transparent: true
			})
		)
		line.userData.ignorePick = true
		boxMesh.userData.ignorePick = true
		const group = new THREE.Group()
		group.add(boxMesh)
		group.add(line)
		group.position.copy(center)

		this.scene.add(group)

		return group
	}
	clearObject (object: THREE.Object3D) {
		if (object.isMesh) {
			if (object.geometry) {
				object.geometry.dispose(); // 释放几何体内存
			}
			
			// 处理材质
			if (object.material) {
				// 如果是材质数组
				if (Array.isArray(object.material)) {
					
					object.material.forEach(material => material.dispose());
				} else {
					object.material.dispose(); // 单个材质
				}
			}
			console.log('走到这里了')
			if (object.parent) {
					object.parent.remove(object);
			} else {
				this.scene.remove(object)
			}
		}
	}
	clearGroup(group: THREE.Group | THREE.Object3D) {
		// 遍历组的所有子对象
		while (group.children.length > 0) { 
			const child = group.children[0];
			// biome-ignore lint/complexity/noForEach: <explanation>
			group.children.forEach((child: THREE.Object3D) => {
							// 如果子对象是网格(Mesh)，需要处理其几何体和材质
			if (child.isMesh) {
				if (child.geometry) {
					child.geometry.dispose(); // 释放几何体内存
				}
				
				// 处理材质
				if (child.material) {
					// 如果是材质数组
					if (Array.isArray(child.material)) {
						
						child.material.forEach(material => material.dispose());
					} else {
						child.material.dispose(); // 单个材质
					}
				}
			}
			})

			
			// 从组中移除子对象
			group.remove(child);
		}
		if (group.isMesh) {
			this.clearObject(group)
		}
	}

	// 修改dispose方法以清理CSS3D渲染器
	dispose() {
		// 清理事件监听
		window.removeEventListener('resize', () => this.onContainerResize())
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
		}

		if (this.controls) {
			this.controls.dispose()
		}

		if (this.stats) {
			document.body.removeChild(this.stats.dom)
		}

		if (this.renderer) {
			this.renderer.dispose()
		}

		// 清理CSS3D渲染器的DOM元素
		if (this.css3DRenderer?.domElement.parentNode) {
			this.css3DRenderer.domElement.parentNode.removeChild(
				this.css3DRenderer.domElement
			)
		}

		// 清理场景
		while (this.scene.children.length > 0) {
			const object = this.scene.children[0]
			if ('geometry' in object) object.geometry.dispose()
			if ('material' in object) {
				if (Array.isArray(object.material)) {
					object.material.forEach(material => material.dispose())
				} else {
					object.material.dispose()
				}
			}
			this.scene.remove(object)
		}
	}
}

export default ThreeCore
