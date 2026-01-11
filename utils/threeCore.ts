import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import TWEEN from '@tweenjs/tween.js'
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
// import { TransformGizmo } from './TransformGizmo'
import { getTemplateOne } from '@/api/temeplate.js'
import { EffectManager } from './EffectManager'
import type { Effect } from '~/types/api'
import type { LibraryInterface } from '~/types/sence'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'
import gsap from 'gsap'
import { TransformControls } from './TransformControls'
// import { TransformControls } from 'three/examples/jsm/Addons.js';
import { installUniformScale, restyleGizmo } from './MyTransformControls'
import { FontLoader, TextGeometry } from 'three/examples/jsm/Addons.js'
import { useSceneStore } from '@/stores/sence'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

export interface CameraState {
	position: THREE.Vector3
	target: THREE.Vector3
	fov?: number // 只有 PerspectiveCamera 会用到
}
import { WebGPURenderer } from 'three/webgpu'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import { DeviceOrientationControls } from './DeviceOrientationControls'
import jsQR from 'jsqr'
import { createGrid, updateGrid } from './Grid'
const grid = createGrid();
export interface SceneEffectJSON {
	type: 'animation' | 'effect' | 'timeline'
	cycles?: number // 如果是动画时循环次数 0 为无限循环
	// 动画特有
	options?: Record<string, any> // 特效参数
	// 特效特有
	effect_name?: string // 特效 id，比如 "ToonOutlineEffect"
	id?: number // 如果是动画，数字标识

	// 动画属性
	properties?: Record<string, number> // 要修改的属性，例如 { "position.x": 5, "rotation.y": 1.57 }
	duration?: number
	ease?: string
	delay?: number

	repeat?: number // -1 无限循环
	yoyo?: boolean // 是否反复
	repeatDelay?: number

	// timeline
	children?: SceneEffectJSON[]
	sequence?: boolean // true = 顺序执行，false = 并行执行
}

interface TextureTransform {
	offsetX: number
	offsetY: number
	scale: number
	rotation: number // 单位: 弧度
}
export interface SceneObjectJSON {
	type:
		| 'box'
		| 'sphere'
		| 'model'
		| 'image'
		| 'diary'
		| 'template'
		| 'effect'
		| 'library'
		| '3Dtext'
	position?: [number, number, number]
	rotation?: [number, number, number]
	baseWidth?: number
	scale?: [number, number, number]
	color?: string
	size?: [number, number, number] // for box
	renderOrder?: number // for object
	radius?: number // for sphere
	url?: string // for model
	useDracoLoader?: boolean
	dracoDecoderPath?: string
	title?: string // 如果是日记类型
	content?: string // 如果是日记类型
	playAnimations?: string[]
	loopOnce?: boolean
	template_id?: number
	options?: Record<string, any> // 如果是特效类型 或 模型属性
	effect_name?: string // 特效名称
	cover?: string // 图鉴类型
	library_id?: number // 图鉴类型
	effect?: SceneEffectJSON[] // 如果是model效果列表
	material?: Record<string, any> // 替换过的贴图
}
export interface SceneJSON {
	objects: SceneObjectJSON[]
	cameraList?: CameraState[]
	background?: string
	controls?: {
		minAzimuthAngle?: number // 控制器水平旋转最小角度（弧度）
		maxAzimuthAngle?: number // 控制器水平旋转最大角度（弧度）
		minPolarAngle?: number // 控制器垂直旋转最小角度（弧度）
		maxPolarAngle?: number // 控制器垂直旋转最大角度（弧度）
	}
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
	editMode?: boolean
	enableAR?: boolean
}

class ThreeCore {
	public scene: THREE.Scene
	public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
	public renderer: THREE.WebGLRenderer | WebGPURenderer
	public rendererGPU: WebGPURenderer
	public css3DRenderer?: CSS3DRenderer // CSS3D渲染器
	public controls: OrbitControls
	public deviceOrientationControls?: DeviceOrientationControls // 陀螺仪控制器
	public allObjects: THREE.Object3D[] // 场景里的所有模型
	
	// AR相关
	public arReticle?: THREE.Mesh
	public arHitTestSource?: any
	public arHitTestSourceRequested = false
	public arContentGroup?: THREE.Group // AR模式下包裹所有内容的组
	public isWebcamAR = false // 是否处于Webcam降级AR模式
	public videoElement?: HTMLVideoElement // Webcam AR video
	public qrScanCanvas?: HTMLCanvasElement
	public qrScanContext?: CanvasRenderingContext2D | null
	public lastQRScanTime = 0
	// 渲染顺序计数
	public renderOrderCount = 0
	// 光源系统
	public lights?: {
		ambient: THREE.AmbientLight
		hemisphere: THREE.HemisphereLight
		directional: THREE.DirectionalLight
		fill: THREE.DirectionalLight
		back: THREE.DirectionalLight
		lens: THREE.PointLight
		spot: THREE.SpotLight
		rim: THREE.DirectionalLight
	}
	public lensLight?: THREE.PointLight // 镜头光单独引用
	
	// IBL相关
	public envMap?: THREE.Texture // 环境贴图
	public envMapIntensity: number = 1.0 // 环境贴图强度

	public mixers: AnimationMixer[] = [] // 用于管理多个模型动画混合器
	public stats?: Stats
	public animationCallbacks: Array<() => void>
	public addAnimationFunc: () => void // 注入animate里的方法
	public resizeCallbacks: Array<(width: number, height: number) => void>
	public options: ThreeCoreOptions
	public container?: HTMLElement | null
	private resizeObserver?: ResizeObserver
	public loadedModelURLs: Set<string> // 已加载过的模型地址集合
	public loadedModels: { model: THREE.Object3D, animations: THREE.AnimationClip[] }[] // 加载成功的模型数组
	private loadedTextures: Map<string, THREE.Texture> = new Map() // 加载过的贴图
	private loadingTextures = new Map<string, Promise<THREE.Texture>>() // 正在加载的贴图
	public effectManager: EffectManager
	public background: string | null
	public editMode: boolean

	public loadedDiary: Array<{
		title: string
		content: string
		object: THREE.Object3D
	}> // 加载成功的模型数组
	public loadedLibrary: LibraryInterface[] // 加载成功的模型数组
	public allMat: THREE.Material[]

	public loadTemplate: THREE.Group[] // 加载成功的模型数组
	public cameraList: CameraState[]
	public clock: THREE.Clock
	public picker: GPUPicker | null
	public gizmo: TransformGizmo | null
	public transformControls: TransformControls
	public showbloom: boolean
	// bloom
	bloomLayer = new THREE.Layers()
	bloomPass!: UnrealBloomPass
	bloomComposer!: EffectComposer
	finalComposer!: EffectComposer
	darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' })
	materials: Record<string, THREE.Material | THREE.Material[]> = {}

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
		this.editMode = false
		this.options = { ...defaultOptions, ...options }
		if (this.options.editMode) {
			this.editMode = this.options.editMode
		}
		this.scene = null!
		this.camera = null!
		this.renderer = null!
		this.rendererGPU = null!
		this.animationCallbacks = []
		this.addAnimationFunc = () => {}
		this.resizeCallbacks = []
		this.container = null
		this.controls = null!
		this.picker = null!
		this.allMat = []
		this.transformControls = null!

		this.loadedModelURLs = new Set()
		this.loadedModels = []
		this.allObjects = []
		this.loadedDiary = [] // 加载的日记文本
		this.loadedLibrary = []
		this.loadTemplate = [] // 加载的模版
		this.cameraList = []
		this.background = null
		this.showbloom = true

		this.clock = new THREE.Clock()

		this.initScene()
		this.initCamera()
		this.initRenderer()
		// initAR logic will be called explicitly or inside initAR based on support
		this.initPicker()
		// const cloud = this.createCloud()
		// this.scene.add(cloud)
		// this.scene.add(grid)

		function createRadialGradientTexture(size = 512) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = size;
			const ctx = canvas.getContext('2d');
		
			const gradient = ctx.createRadialGradient(
				size / 2, size / 2, size * 0.4, // 中心
				size / 2, size / 2, size * 0.5  // 边缘
			);
			gradient.addColorStop(0, 'rgba(255,255,255,1)');
			gradient.addColorStop(1, 'rgba(255,255,255,0)');
		
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, size, size);
		
			const texture = new THREE.CanvasTexture(canvas);
			texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
			return texture;
		}
		
		const alphaMap = createRadialGradientTexture(1024);
		
		// ================ 圆形几何 ================
		const circleGeometry = new THREE.CircleGeometry(60, 128);

		// ================ 使用 MeshPhongMaterial ================
		const circleMaterial = new THREE.MeshPhongMaterial({
			color: 0xcccccc,
			shininess: 0,
			specular: 0xcccccc,
			transparent: true,
			alphaMap: alphaMap,   // 边缘渐隐
			// side: THREE.DoubleSide,
			side: THREE.FrontSide
		});

		// ================ Mesh设置 ================
		const ground = new THREE.Mesh(circleGeometry, circleMaterial);
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(0, -2, 0);
		ground.receiveShadow = true;
		ground.renderOrder = -1000;
		ground.userData.ignorePick = true;
		// this.scene.add(ground);

		this.effectManager = new EffectManager(
			this.scene,
			this.camera,
			this.renderer
		)
		const cube = new THREE.Mesh(
			new THREE.BoxGeometry(),
			new THREE.MeshStandardMaterial({ color: 'orange' })
		)
		// 如果启用了CSS3D渲染器
		if (this.options.enableCSS3DRenderer) {
			this.initCSS3DRenderer()
		}
		// this.effectManager.addEffect('SnowEffect', this.scene, { count: 8000, onlyOne: true });

		// setTimeout(() => {
		// 	this.effectManager.removeEffect(this.scene, 'SnowEffect');
		// 	console.log('删除特效')
		// }, 6000);
		this.initLights()

		// if (this.options.enableOrbitControls) {
		//   this.initOrbitControls();
		// }
		this.initOrbitControls()
		this.initTransformontrols()
		if (this.options.enableStats) {
			this.initStats()
		}
		this.bloomLayer.set(1) // layer=1 专门给 bloom 对象
		this.initBloom()

		// this.gizmo = new TransformGizmo(
		// 	this.scene,
		// 	this.camera,
		// 	this.controls,
		// 	this.renderer.domElement,
		// 	this.picker
		// )
		// this.scene.add(this.gizmo)
	}
	// 更新文本模型
	public updateTextMesh(
		mesh: THREE.Mesh,
		text: string,
		options: {
			size?: number,
			depth?: number,
			curveSegments?: number,
			bevelEnabled?: boolean
		}
	) {
		const geometry = new TextGeometry(text, {
			font: mesh.userData.font,
			size: options.size ?? 1,
			depth: options.depth ?? 0.05,
			curveSegments: options.curveSegments ?? 12,
			bevelEnabled: options.bevelEnabled ?? false
		})
		geometry.computeBoundingBox()
		geometry.center()
	
		// 释放旧几何体资源，避免内存泄露
		mesh.geometry.dispose()
	
		// 替换为新几何体
		mesh.geometry = geometry
	}
	public async addTextToScene(
		fontUrl: string,
		text: string,
		options: {
			size?: number
			depth?: number
			color?: number
			position?: { x: number; y: number; z: number }
		} = {}
	): Promise<THREE.Mesh> {
		const loader = new FontLoader()
		return new Promise((resolve, reject) => {
			loader.load(fontUrl, font => {
				const geometry = new TextGeometry(text, {
					font: font,
					size: options.size ?? 1,
					depth: options.depth ?? 0.3,
					curveSegments: 1,
					bevelEnabled: true,
					bevelThickness: 0.003,
					bevelSize: 0.02,
					bevelSegments: 5
				})
	
				geometry.computeBoundingBox()
				geometry.center() // 让文字居中
	
				const material = new THREE.MeshStandardMaterial({
					color: options.color ?? 0xffffff
				})
				const mesh = new THREE.Mesh(geometry, material)
				mesh.userData.type = '3Dtext'
				mesh.userData.title = text
				mesh.userData.url = fontUrl.replace(BASE_IMG, '')
				mesh.userData.options = options
				mesh.scale.y *= -1
				mesh.userData.font = font
				mesh.receiveShadow = true
				mesh.castShadow = true
				resolve(mesh)
			}, undefined, reject)
		})
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
		this.loadedDiary.push({
			title: obj.title || '没有标题',
			content: obj.content || '没有内容',
			object: mesh
		})
		return mesh
	}
	/** 🌟 API：添加辉光对象 */
	addBloomObject(obj: THREE.Object3D) {
		obj.layers.enable(1)
	}

	removeBloomObject(obj: THREE.Object3D) {
		obj.layers.disable(1)
	}

	// ================ 光影控制API ================
	
	/**
	 * 设置环境光强度
	 * @param intensity 强度值 0-2
	 */
	setAmbientLightIntensity(intensity: number) {
		if (this.lights?.ambient) {
			this.lights.ambient.intensity = Math.max(0, Math.min(2, intensity))
		}
	}

	/**
	 * 设置主光源强度和位置
	 * @param intensity 强度值 0-3
	 * @param position 可选位置
	 */
	setMainLightIntensity(intensity: number, position?: THREE.Vector3) {
		if (this.lights?.directional) {
			this.lights.directional.intensity = Math.max(0, Math.min(3, intensity))
			if (position) {
				this.lights.directional.position.copy(position)
			}
		}
	}

	/**
	 * 设置镜头光强度
	 * @param intensity 强度值 0-2
	 */
	setLensLightIntensity(intensity: number) {
		if (this.lensLight) {
			this.lensLight.intensity = Math.max(0, Math.min(2, intensity))
		}
	}

	/**
	 * 设置主光源位置
	 * @param azimuth 水平角度 (0-360)
	 * @param elevation 垂直角度 (0-90)
	 * @param radius 距离 (默认100)
	 */
	setMainLightPosition(azimuth: number, elevation: number, radius = 100) {
		if (this.lights?.directional) {
			const theta = (azimuth * Math.PI) / 180
			const phi = (elevation * Math.PI) / 180

			// 转换为笛卡尔坐标
			const x = radius * Math.cos(phi) * Math.sin(theta)
			const y = radius * Math.sin(phi)
			const z = radius * Math.cos(phi) * Math.cos(theta)

			this.lights.directional.position.set(x, y, z)
			
			// 确保光源看向原点
			this.lights.directional.lookAt(0, 0, 0)
			
			// 如果有阴影，可能需要更新 shadow map
			if (this.lights.directional.shadow.map) {
				this.lights.directional.shadow.map.dispose()
				this.lights.directional.shadow.map = null!
			}
		}
	}

	/**
	 * 切换阴影质量
	 * @param quality 'low' | 'medium' | 'high' | 'ultra'
	 */
	setShadowQuality(quality: 'low' | 'medium' | 'high' | 'ultra') {
		// 定义不同质量等级的配置
		const qualitySettings = {
			low: { 
				mapSize: 512, 
				bias: -0.004, 
				normalBias: 0.05, 
				radius: 2, 
				blurSamples: 4,
				castShadow: { directional: true, lens: false, spot: false }
			},
			medium: { 
				mapSize: 1024, 
				bias: -0.002, 
				normalBias: 0.03, 
				radius: 3, 
				blurSamples: 8,
				castShadow: { directional: true, lens: false, spot: true }
			},
			high: { 
				mapSize: 2048, 
				bias: -0.0005, 
				normalBias: 0.02, 
				radius: 4, 
				blurSamples: 26,
				castShadow: { directional: true, lens: true, spot: true }
			},
			ultra: { 
				mapSize: 4096, 
				bias: -0.0001, 
				normalBias: 0.01, 
				radius: 5, 
				blurSamples: 20,
				castShadow: { directional: true, lens: true, spot: true }
			}
		}

		const settings = qualitySettings[quality]
		
		// 1. 更新主光源 (DirectionalLight)
		if (this.lights?.directional) {
			const light = this.lights.directional
			light.castShadow = settings.castShadow.directional
			
			if (light.castShadow) {
				light.shadow.mapSize.set(settings.mapSize, settings.mapSize)
				light.shadow.bias = settings.bias
				light.shadow.normalBias = settings.normalBias
				light.shadow.radius = settings.radius
				light.shadow.blurSamples = settings.blurSamples
				// 强制更新 shadow map
				if (light.shadow.map) {
					light.shadow.map.dispose()
					light.shadow.map = null!
				}
			}
		}

		// 2. 更新镜头光 (LensLight)
		if (this.lensLight) {
			const light = this.lensLight
			light.castShadow = settings.castShadow.lens
			
			if (light.castShadow) {
				const size = Math.min(settings.mapSize, 2048)
				light.shadow.mapSize.set(size, size)
				light.shadow.bias = settings.bias
				light.shadow.radius = settings.radius
				light.shadow.blurSamples = settings.blurSamples
				if (light.shadow.map) {
					light.shadow.map.dispose()
					light.shadow.map = null!
				}
			}
		}

		// 3. 更新聚光灯 (SpotLight)
		if (this.lights?.spot) {
			const light = this.lights.spot
			light.castShadow = settings.castShadow.spot
			
			if (light.castShadow) {
				const size = Math.min(settings.mapSize, 2048)
				light.shadow.mapSize.set(size, size)
				light.shadow.bias = settings.bias
				light.shadow.radius = settings.radius
				light.shadow.blurSamples = settings.blurSamples
				if (light.shadow.map) {
					light.shadow.map.dispose()
					light.shadow.map = null!
				}
			}
		}
	}

	/**
	 * 设置色调映射参数
	 * @param exposure 曝光值 0.1-3.0
	 * @param toneMapping 色调映射类型
	 */
	setToneMapping(exposure: number, toneMapping?: THREE.ToneMapping) {
		if (this.renderer instanceof THREE.WebGLRenderer) {
			this.renderer.toneMappingExposure = Math.max(0.1, Math.min(3.0, exposure))
			if (toneMapping !== undefined) {
				this.renderer.toneMapping = toneMapping
			}
		}
	}

	/**
	 * 获取光源信息
	 */
	getLightingInfo() {
		return {
			ambient: this.lights?.ambient.intensity || 0,
			directional: this.lights?.directional.intensity || 0,
			lens: this.lensLight?.intensity || 0,
			toneMappingExposure: this.renderer instanceof THREE.WebGLRenderer ? this.renderer.toneMappingExposure : 1.0,
			envMapIntensity: this.envMapIntensity
		}
	}

	/**
	 * 设置Bloom效果参数
	 * @param strength 强度 0-3
	 * @param radius 半径 0-1
	 * @param threshold 阈值 0-2
	 */
	setBloomParams(strength: number, radius: number, threshold: number) {
		if (this.bloomPass) {
			this.bloomPass.strength = Math.max(0, Math.min(3, strength))
			this.bloomPass.radius = Math.max(0, Math.min(1, radius))
			this.bloomPass.threshold = Math.max(0, Math.min(2, threshold))
		}
	}

	/**
	 * 获取Bloom效果参数
	 */
	getBloomParams() {
		if (this.bloomPass) {
			return {
				strength: this.bloomPass.strength,
				radius: this.bloomPass.radius,
				threshold: this.bloomPass.threshold,
				enabled: this.showbloom
			}
		}
		return null
	}

	/**
	 * 切换Bloom效果开关
	 * @param enabled 是否启用
	 */
	toggleBloom(enabled: boolean) {
		this.showbloom = enabled
	}

	// ================ IBL环境光照 ================
	
	/**
	 * 加载HDR环境贴图
	 * @param url HDR文件路径
	 * @param intensity 环境光强度 0-2
	 */
	async loadHDREnvironment(url: string, intensity: number = 1.0): Promise<void> {
		const loader = new RGBELoader()
		
		return new Promise((resolve, reject) => {
			loader.load(
				url,
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping
					
					// 设置为场景环境贴图
					this.scene.environment = texture
					this.scene.background = texture // 可选：作为背景
					
					this.envMap = texture
					this.envMapIntensity = intensity
					
					// 更新所有材质的环境贴图
					this.updateAllMaterialsEnvMap()
					
					console.log('HDR环境贴图加载成功')
					resolve()
				},
				undefined,
				(error) => {
					console.error('HDR环境贴图加载失败:', error)
					reject(error)
				}
			)
		})
	}

	/**
	 * 加载EXR环境贴图
	 * @param url EXR文件路径
	 * @param intensity 环境光强度
	 */
	async loadEXREnvironment(url: string, intensity: number = 1.0): Promise<void> {
		const loader = new EXRLoader()
		
		return new Promise((resolve, reject) => {
			loader.load(
				url,
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping
					
					this.scene.environment = texture
					this.scene.background = texture
					
					this.envMap = texture
					this.envMapIntensity = intensity
					
					this.updateAllMaterialsEnvMap()
					
					console.log('EXR环境贴图加载成功')
					resolve()
				},
				undefined,
				(error) => {
					console.error('EXR环境贴图加载失败:', error)
					reject(error)
				}
			)
		})
	}

	/**
	 * 设置立方体贴图环境
	 * @param urls 6个面的贴图路径数组 [px, nx, py, ny, pz, nz]
	 * @param intensity 环境光强度
	 */
	setCubeMapEnvironment(urls: string[], intensity: number = 1.0): void {
		const loader = new THREE.CubeTextureLoader()
		
		const cubeTexture = loader.load(urls, () => {
			this.scene.environment = cubeTexture
			this.scene.background = cubeTexture
			
			this.envMap = cubeTexture
			this.envMapIntensity = intensity
			
			this.updateAllMaterialsEnvMap()
			
			console.log('立方体环境贴图设置成功')
		})
	}

	/**
	 * 设置环境贴图强度
	 * @param intensity 强度值 0-3
	 */
	setEnvironmentIntensity(intensity: number): void {
		this.envMapIntensity = Math.max(0, Math.min(3, intensity))
		this.updateAllMaterialsEnvMap()
	}

	/**
	 * 更新所有材质的环境贴图设置
	 */
	private updateAllMaterialsEnvMap(): void {
		this.scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				if (Array.isArray(object.material)) {
					object.material.forEach(material => {
						this.updateMaterialEnvMap(material)
					})
				} else {
					this.updateMaterialEnvMap(object.material)
				}
			}
		})
	}

	/**
	 * 更新单个材质的环境贴图
	 */
	private updateMaterialEnvMap(material: THREE.Material): void {
		if (material instanceof THREE.MeshStandardMaterial) {
			material.envMap = this.envMap || null
			material.envMapIntensity = this.envMapIntensity
			material.needsUpdate = true
			if (material.map && material.map.colorSpace !== THREE.SRGBColorSpace) {
				material.map.colorSpace = THREE.SRGBColorSpace
			}
		} else if (material instanceof THREE.MeshPhysicalMaterial) {
			material.envMap = this.envMap || null
			material.envMapIntensity = this.envMapIntensity
			material.needsUpdate = true
			if (material.map && material.map.colorSpace !== THREE.SRGBColorSpace) {
				material.map.colorSpace = THREE.SRGBColorSpace
			}
		} else if (material instanceof THREE.MeshLambertMaterial || 
				   material instanceof THREE.MeshPhongMaterial) {
			material.envMap = this.envMap || null
			material.needsUpdate = true
			if (material.map && material.map.colorSpace !== THREE.SRGBColorSpace) {
				material.map.colorSpace = THREE.SRGBColorSpace
			}
		}
	}

	/**
	 * 移除环境贴图
	 */
	removeEnvironmentMap(): void {
		this.scene.environment = null
		this.scene.background = null
		this.envMap = undefined
		this.envMapIntensity = 1.0
		
		this.updateAllMaterialsEnvMap()
		
		console.log('环境贴图已移除')
	}

	private initBloom() {
		const renderScene = new RenderPass(this.scene, this.camera)

		this.bloomPass = new UnrealBloomPass(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
			0.3,
			0.04,
			1.0
		)

		this.bloomComposer = new EffectComposer(
			this.renderer as THREE.WebGLRenderer
		)
		this.bloomComposer.renderToScreen = false
		this.bloomComposer.addPass(renderScene)
		this.bloomComposer.addPass(this.bloomPass)

		// finalPass
		const finalPass = new ShaderPass(
			new THREE.ShaderMaterial({
				uniforms: {
					baseTexture: { value: null },
					bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
				},
				vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
				fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;

      void main() {
        vec4 base = texture2D(baseTexture, vUv);
        vec4 bloom = texture2D(bloomTexture, vUv);

        // 🌟 每个物体的颜色和强度已经在 bloomTexture 里体现
        // 直接叠加
        gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
      }
    `
			}),
			'baseTexture'
		)

		this.finalComposer = new EffectComposer(
			this.renderer as THREE.WebGLRenderer
		)
		this.finalComposer.addPass(renderScene)
		this.finalComposer.addPass(finalPass)
		const gammaCorrectionShader = new ShaderPass(GammaCorrectionShader)
		this.finalComposer.addPass(gammaCorrectionShader)
	}
	public async createLibrary(obj: SceneObjectJSON): Promise<THREE.Mesh> {
		const radius = 1
		const geometry = new THREE.SphereGeometry(radius, 32, 32)
		const material = new THREE.MeshStandardMaterial({
			color: '#ffaa7f'
		})

		const mesh = new THREE.Mesh(geometry, material)
		mesh.userData.type = 'library'
		mesh.userData.title = obj.title
		mesh.userData.cover = obj.cover
		mesh.userData.library_id = obj.library_id
		this.loadedLibrary.push({
			title: obj.title || '没有标题',
			cover: obj.cover || 'static/plan_cover/default.jpg',
			library_id: obj.library_id || 0,
			object: mesh
		})
		return mesh
	}
	public async loadImageMesh(url: string, baseWidth = 5): Promise<THREE.Mesh> {
		return new Promise((resolve, reject) => {
			if (this.loadedModelURLs.has(url)) {
				const existing = this.loadedModels.find(obj => obj.model.userData.url === url)
				if (existing) {
					const mesh = existing.model.clone(true) as THREE.Mesh
					mesh.position.set(0, 0, 0)
					mesh.rotation.set(0, 0, 0)
					mesh.scale.set(1, 1, 1)
					resolve(mesh)
					return
				}
			}

			const loader = new THREE.TextureLoader()
			loader.load(
				url,
				texture => {
					const image = texture.image
					texture.colorSpace = THREE.SRGBColorSpace
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
						// depthTest: false,
						side: THREE.DoubleSide
					})
					const mesh = new THREE.Mesh(geometry, material)
					mesh.userData.url = url
					mesh.userData.type = 'image'
					mesh.userData.effect = []

					this.loadedModelURLs.add(url)
					this.loadedModels.push({
						model: mesh,
						animations: []
					})

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

	private createUniqueTexture(base: THREE.Texture): THREE.Texture {
		const image = base.image as HTMLImageElement
		const canvas = document.createElement('canvas')
		canvas.width = image.width
		canvas.height = image.height
		const ctx = canvas.getContext('2d')!
		ctx.drawImage(image, 0, 0)

		const newTex = new THREE.Texture(canvas)
		newTex.wrapS = base.wrapS
		newTex.wrapT = base.wrapT
		newTex.needsUpdate = true
		return newTex
	}
	/**
	 * 加载贴图，支持缓存与克隆
	 * @param url 贴图路径
	 * @returns Promise<THREE.Texture>
	 */
	public async loadTexture(url: string): Promise<THREE.Texture> {
		// 如果已经加载过，返回克隆
		if (this.loadedTextures.has(url)) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const existing = this.loadedTextures.get(url)!
			const cloned = existing.clone()
			cloned.needsUpdate = true
			return cloned
		}

		// 如果正在加载，复用 Promise
		if (this.loadingTextures.has(url)) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return this.loadingTextures.get(url)!.then(existing => {
				const cloned = existing.clone()
				cloned.needsUpdate = true
				return cloned
			})
		}

		// 创建一个新的加载 Promise
		const promise = new Promise<THREE.Texture>((resolve, reject) => {
			const loader = new THREE.TextureLoader()
			loader.load(
				url,
				texture => {
					texture.userData = { url }
					texture.wrapS = THREE.RepeatWrapping
					texture.wrapT = THREE.RepeatWrapping
					texture.needsUpdate = true

					// 缓存原始贴图
					this.loadedTextures.set(url, texture)
					this.loadingTextures.delete(url)

					// 返回克隆
					const cloned = texture.clone()
					cloned.needsUpdate = true
					resolve(cloned)
				},
				undefined,
				err => {
					console.error(`加载贴图失败: ${url}`, err)
					this.loadingTextures.delete(url)
					reject(err)
				}
			)
		})

		this.loadingTextures.set(url, promise)

		return promise
	}
	/**
	 * 使用 canvas 绘制贴图并应用变换
	 * @param img 原始图片 (HTMLImageElement)
	 * @param params 偏移、缩放、旋转参数
	 * @param size 生成 canvas 尺寸（默认 1024x1024）
	 */
	createTransformedTexture(
		img: HTMLImageElement,
		params: TextureTransform,
		size = 512
	): THREE.CanvasTexture {
		const { offsetX, offsetY, scale, rotation } = params

		// 创建画布
		const canvas = document.createElement('canvas')
		canvas.width = size
		canvas.height = size
		const ctx = canvas.getContext('2d')!
		ctx.clearRect(0, 0, size, size)

		// 将画布中心作为变换中心
		ctx.save()
		// ctx.translate(size / 2 + offsetX, size / 2 + offsetY)
		// ctx.rotate(rotation)
		// ctx.scale(scale, scale)

		// // 绘制图片 (以中心点对齐)
		// ctx.drawImage(img, -img.width / 2, -img.height / 2)

		ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY)
		ctx.rotate(rotation)
		ctx.scale(scale, scale)

		// === 新增：保持原图比例 ===
		const imgAspect = img.width / img.height
		const canvasAspect = canvas.width / canvas.height
		let drawW: number
		let drawH: number
		if (imgAspect > canvasAspect) {
			// 图片更宽 → 宽占满
			drawW = canvas.width
			drawH = drawW / imgAspect
		} else {
			// 图片更高 → 高占满
			drawH = canvas.height
			drawW = drawH * imgAspect
		}

		ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)

		ctx.restore()

		// 创建 threejs 贴图
		const texture = new THREE.CanvasTexture(canvas)
		texture.wrapS = THREE.ClampToEdgeWrapping
		texture.wrapT = THREE.ClampToEdgeWrapping
		texture.needsUpdate = true

		return texture
	}
	disableLighting(object: THREE.Object3D) {
		object.traverse((child: any) => {
			if (child.isMesh) {
				const oldMat = child.material
	
				// 保留原贴图
				const newMat = new THREE.MeshBasicMaterial({
					map: oldMat.map || null,
					color: oldMat.color || new THREE.Color(0xffffff),
					transparent: oldMat.transparent,
					opacity: oldMat.opacity,
					alphaTest: oldMat.alphaTest,
					side: oldMat.side,
				})
	
				child.material = newMat
			}
		})
	}
	public async loadModel(
		url: string,
		options: any = {
			useDracoLoader: false,
			dracoDecoderPath: 'jsm/libs/draco/gltf/'
		}
	): Promise<THREE.Object3D | THREE.Mesh> {
		// 如果已经加载过，直接返回缓存的模型
		const loader = new GLTFLoader()
		if (options.useDracoLoader) {
			const dracoLoader = new DRACOLoader()
			const decoderPath = options.dracoDecoderPath || '/draco/gltf/'
			dracoLoader.setDecoderPath(decoderPath)
			loader.setDRACOLoader(dracoLoader)
		}
		return new Promise((resolve, reject) => {
			const existing = this.loadedModels.find(obj => obj.model.userData.url === url)
			if (this.loadedModelURLs.has(url) && existing) {
				const model = existing.model.clone(true)
				this.copyMaterial(model)
				if(existing.animations && existing.animations.length > 0) {
					const mixer = new AnimationMixer(model)
					existing.animations.forEach(animation => {
						mixer.clipAction(animation).play()
					})
					this.mixers.push(mixer)
				}
				resolve(model)
			} else {
				loader.load(
					url,
					gltf => {
						console.log(gltf, 'gltf模型')
						const model = gltf.scene
						model.userData.url = url
						model.userData.type = 'model'
						model.userData.effect = []
						model.userData.useDracoLoader = options.useDracoLoader
						// this.scene.add(model);
						// 配置阴影和光照
						model.traverse(child => {
							if (child instanceof THREE.Mesh) {
								child.castShadow = true
								child.receiveShadow = true
								// 确保材质支持阴影和环境贴图
								if (child.material) {
									if (Array.isArray(child.material)) {
										// biome-ignore lint/complexity/noForEach: <explanation>
										child.material.forEach(mat => {
											if (mat instanceof THREE.MeshStandardMaterial || 
												mat instanceof THREE.MeshPhongMaterial || 
												mat instanceof THREE.MeshLambertMaterial) {
												mat.needsUpdate = true
												// 应用环境贴图
												this.updateMaterialEnvMap(mat)
											}
										})
									} else {
										if (child.material instanceof THREE.MeshStandardMaterial || 
											child.material instanceof THREE.MeshPhongMaterial || 
											child.material instanceof THREE.MeshLambertMaterial) {
											child.material.needsUpdate = true
											// 应用环境贴图
											this.updateMaterialEnvMap(child.material)
										}
									}
									if (options.material && child.name === options.material[child.name]) {
										if (options.material.color) {
											child.material.color = new THREE.Color(options.material.color)
										}
										if (options.material.metalness) {
											child.material.metalness = options.material.metalness
										}
										if (options.material.roughness) {
											child.material.roughness = options.material.roughness
										}
										if (options.material.clearcoat) {
											child.material.clearcoat = options.material.clearcoat
										}
										if (options.material.clearcoatRoughness) {
											child.material.clearcoatRoughness = options.material.clearcoatRoughness
										}
										child.material.needsUpdate = true
									}
								}
							}
						})
						// this.disableLighting(gltf.scene)
						this.loadedModelURLs.add(url)
						this.loadedModels.push({
							model: model.clone(true),
							animations: gltf.animations
						})

						// 动画处理
						if (gltf.animations && gltf.animations.length > 0) {
							const mixer = new AnimationMixer(model)
							// biome-ignore lint/complexity/noForEach: <explanation>
							gltf.animations.forEach(clip => {
								mixer.clipAction(clip).play()
							})
							this.mixers.push(mixer)
							// this.addAnimationCallback(() =>
							// 	mixer.update(this.clock.getDelta())
							// )
						}
						this.copyMaterial(model)
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
	async initWebGPU() {
		if (!navigator.gpu) {
			console.warn('WebGPU not supported in this browser')
			return null
		}

		const adapter = await navigator.gpu.requestAdapter()
		if (!adapter) {
			console.warn('No GPU adapter found')
			return null
		}

		const device = await adapter.requestDevice()
		return device
	}
	initRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: this.options.antialias,
			alpha: this.options.alpha
		})
		this.renderer.debug.checkShaderErrors = true; 
		this.rendererGPU = new WebGPURenderer({
			antialias: true
			// device: navigator.gpu?.requestAdapter()?.requestDevice() // 可选手动设置 device
		})
		this.rendererGPU.domElement.addEventListener('mousedown', e => {
			// 将事件传递给底层的WebGL渲染器
		})

		this.renderer.setPixelRatio(this.options.pixelRatio)

		const width = this.container
			? this.container.clientWidth
			: window.innerWidth
		const height = this.container
			? this.container.clientHeight
			: window.innerHeight
		this.renderer.setSize(width, height)

		// 启用物理正确的光照
		this.renderer.physicallyCorrectLights = false
		
		// 色彩空间设置
		this.renderer.outputColorSpace = THREE.SRGBColorSpace
		// this.renderer.toneMapping = THREE.LinearToneMapping
		// this.renderer.toneMapping = THREE.NoToneMapping
		this.renderer.toneMapping = THREE.ReinhardToneMapping

		this.renderer.toneMappingExposure = 1.0
		
		// 高质量阴影设置 - 关键配置来避免阴影条纹
		this.renderer.shadowMap.enabled = true
		// this.renderer.shadowMap.type = THREE.PCFSoftShadowMap // 使用软阴影
		this.renderer.shadowMap.type = THREE.VSMShadowMap;
		this.renderer.shadowMap.autoUpdate = true
		
		// 背景设置
		if (this.options.enableAR) {
			this.renderer.xr.enabled = true
		} else {
			this.renderer.setClearColor(0x000000, 0) // 背景透明
		}

		this.rendererGPU.setSize(width, height)
		console.log(this.renderer, '渲染器=======')
		// this.container.appendChild(this.rendererGPU.domElement);
	}
	initOrbitControls() {
		if (!this.camera || !this.renderer) return
		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.enableDamping = true
		this.controls.dampingFactor = 0.05
	}
	initTransformontrols() {
		if (!this.camera || !this.renderer) return
		this.transformControls = new TransformControls(
			this.camera,
			this.renderer.domElement
		)
		this.scene.add(this.transformControls._root)
		console.log(this.transformControls, '变换控制器')
		this.transformControls.addEventListener('dragging-changed', event => {
			this.controls.enabled = !event.value
		})
		// restyleGizmo(this.transformControls, {
		// 	x: 0xff3b30,   // X轴颜色
		// 	y: 0x34c759,   // Y轴颜色
		// 	z: 0x0a84ff,   // Z轴颜色
		// 	thickness: 1.3 // 手柄加粗
		// })
	}

	initStats() {
		this.stats = new Stats()
		this.stats.showPanel(0)
		document.body.appendChild(this.stats.dom)
	}

	createCloud(size = 20, steps = 64): THREE.Mesh {
		const geo = new THREE.BoxGeometry(size, size, size)
		const mat = new THREE.ShaderMaterial({
			glslVersion: THREE.GLSL3,
			uniforms: {
				uTime: { value: 0 },
				uSteps: { value: steps },
				uLightDir: { value: new THREE.Vector3(1, 1, 0).normalize() },
				uCameraPos: { value: new THREE.Vector3() }
			},
			vertexShader: /* glsl */ `
			varying vec3 vWorldPos;
			void main(){
				vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
				gl_Position = projectionMatrix * viewMatrix * vec4(position,1.0);
			}
		`,
			fragmentShader: /* glsl */ `
			precision highp float;
			uniform float uTime;
			uniform int uSteps;
			uniform vec3 uLightDir;
			uniform vec3 uCameraPos;
			varying vec3 vWorldPos;

			// 简单伪随机和FBM函数
			float rand(vec3 p){
				return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453);
			}
			float noise(vec3 p){
				vec3 i=floor(p), f=fract(p);
				f = f*f*(3.0-2.0*f);
				return mix(
					mix(mix(rand(i+vec3(0,0,0)), rand(i+vec3(1,0,0)), f.x),
							mix(rand(i+vec3(0,1,0)), rand(i+vec3(1,1,0)), f.x), f.y),
					mix(mix(rand(i+vec3(0,0,1)), rand(i+vec3(1,0,1)), f.x),
							mix(rand(i+vec3(0,1,1)), rand(i+vec3(1,1,1)), f.x), f.y), f.z);
			}
			float fbm(vec3 p){
				float v = 0.0, amp = 0.5;
				for(int i=0;i<5;i++){
					v += amp * noise(p);
					p *= 2.0;
					amp *= 0.5;
				}
				return v;
			}

			void main(){
				vec3 rayOrig = uCameraPos;
				vec3 rayDir = normalize(vWorldPos - rayOrig);
				float stepSize = length(vWorldPos - rayOrig) / float(uSteps);

				float t = 0.0;
				vec3 pos = rayOrig;
				vec3 col = vec3(0.0);
				float alpha = 0.0;

				for(int i = 0; i < 128; i++){
					if(i >= uSteps) break;
					pos += rayDir * stepSize;
					float d = fbm(pos * 0.1 + uTime * 0.01);
					float density = smoothstep(0.5, 0.8, d);

					// 光照简单模拟（仅方向光）
					float light = clamp(dot(uLightDir, rayDir), 0.0, 1.0);

					float contribution = (1.0 - alpha) * density * 0.05;
					col += vec3(1.0) * contribution * light;
					alpha += contribution;
					if(alpha >= 0.95) break;
				}

				gl_FragColor = vec4(col, alpha);
			}
		`,
			transparent: true,
			side: THREE.BackSide,
			depthWrite: false
		})

		const mesh = new THREE.Mesh(geo, mat)
		return mesh
	}

	initLights() {
		// ================ 环境光设置 ================
		// 基础环境光 - 为了避免完全黑暗的区域
		const ambientLight = new THREE.AmbientLight(0xffffff, 2.8)
		this.scene.add(ambientLight)

		// ================ 主要方向光（太阳光） ================
		const dirLight = new THREE.DirectionalLight(0xffeecc, 2)
		dirLight.position.set(50, 50, 30)
		dirLight.castShadow = true

		// 高质量阴影配置 - 解决阴影条纹问题
		dirLight.shadow.mapSize.width = 2048
		dirLight.shadow.mapSize.height = 2048
		dirLight.shadow.camera.near = 0.1
		dirLight.shadow.camera.far = 200
		dirLight.shadow.camera.left = -20
		dirLight.shadow.camera.right = 20
		dirLight.shadow.camera.top = 20
		dirLight.shadow.camera.bottom = -20
		
		// 关键：减少阴影条纹的bias设置
		dirLight.shadow.bias = -0.001
		dirLight.shadow.normalBias = 0.02
		dirLight.shadow.radius = 4
		dirLight.shadow.blurSamples = 20
		this.scene.add(dirLight)


		// 半球光 - 模拟天空散射和地面反射
		const hemiLight = new THREE.HemisphereLight(
			0x87ceeb, // 天空颜色 - 淡蓝色
			0x2f4f4f, // 地面颜色 - 暗灰色
			0.4
		)
		hemiLight.position.set(0, 10, 0)
		this.scene.add(hemiLight)


		// ================ 补光设置 (简化) ================
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
		fillLight.position.set(-30, 20, -30)
		fillLight.castShadow = false
		this.scene.add(fillLight)

		// ================ 镜头光（跟随相机） ================
		const lensLight = new THREE.PointLight(0xffffff, 0.5, 100)
		lensLight.position.copy(this.camera.position)
		lensLight.castShadow = false 
		
		lensLight.shadow.mapSize.width = 1024
		lensLight.shadow.mapSize.height = 1024
		lensLight.shadow.camera.near = 0.1
		lensLight.shadow.camera.far = 100
		lensLight.shadow.bias = -0.0001
		lensLight.shadow.radius = 4
		lensLight.shadow.blurSamples = 8
		
		this.scene.add(lensLight)
		this.lensLight = lensLight

		// ================ 调试helpers ================
		if (this.editMode) {
			const dirLightHelper = new THREE.CameraHelper(dirLight.shadow.camera)
			dirLightHelper.visible = false
			// this.scene.add(dirLightHelper)
		}

		// 存储光源引用
		this.lights = {
			ambient: ambientLight,
			hemisphere: hemiLight,
			directional: dirLight,
			fill: fillLight,
			lens: lensLight,
			// back, spot, rim removed/simplified
		} as any

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
				0.01,
				1000
			)
		} else {
			this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
		}

		if (cameraPosition) {
			this.camera.position.set(
				cameraPosition.x,
				cameraPosition.y,
				cameraPosition.z
			)
		}
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
		this.renderer.domElement.style.zIndex = '1'
		this.css3DRenderer.domElement.style.zIndex = '2'
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
		// biome-ignore lint/complexity/noForEach: <explanation>
		this.resizeCallbacks.forEach(callback => callback(width, height))
	}

	// 修改startAnimationLoop方法以支持CSS3D渲染器
	// startAnimationLoop() {
	// 	const animate = (time?: number) => {
	// 		requestAnimationFrame(animate)
	// 		const delta = this.clock.getDelta();
	// 		this.effectManager.update(delta);
	// 		// 更新 OrbitControls
	// 		if (this.controls) {
	// 			this.controls.update()
	// 		}

	// 		// updateKujialeGrid(grid, this.camera);

	// 		// 调用额外的动画回调
	// 		// biome-ignore lint/complexity/noForEach: <explanation>
	// 		this.animationCallbacks.forEach(callback => callback())

	// 		// 渲染 WebGL 场景
	// 		this.renderer.render(this.scene, this.camera)
	// 		// if (this.rendererGPU) {
	// 		// 	this.rendererGPU.render(this.scene, this.camera);
	// 		// 	this.rendererGPU.debug.checkShaderErrors = true;
	// 		// }

	// 		// 渲染 CSS3D 场景
	// 		if (this.css3DRenderer) {
	// 			this.css3DRenderer.render(this.scene, this.camera)
	// 		}

	// 		// 性能监控
	// 		if (this.stats) {
	// 			this.stats.update()
	// 		}
	// 		// 额外动画逻辑
	// 		if (this.addAnimationFunc) {
	// 			this.addAnimationFunc()
	// 		}
	// 		// 更新 Tween.js（传入毫秒时间戳）
	// 		TWEEN.update(time || performance.now())

	// 		// 1. 渲染 bloom 通道
	// 		this.scene.traverse(obj => {
	// 			if ((obj as any).isMesh) {
	// 				const mesh = obj as THREE.Mesh
	// 				if (!this.bloomLayer.test(mesh.layers)) {
	// 					this.materials[mesh.uuid] = mesh.material
	// 					mesh.material = this.darkMaterial
	// 				}
	// 			}
	// 		})
	// 		this.bloomComposer.render()

	// 		// 还原材质
	// 		this.scene.traverse(obj => {
	// 			if ((obj as any).isMesh && this.materials[obj.uuid]) {
	// 				mesh.material = this.materials[obj.uuid]
	// 				delete this.materials[obj.uuid]
	// 			}
	// 		})

	// 		// 2. 合成最终场景
	// 		this.finalComposer.render()

	// 	}

	// 	animate()
	// }
	async initAR() {
		// 检测 WebXR 支持
		let isWebXRSupported = false;
		if ('xr' in navigator) {
			isWebXRSupported = await navigator.xr?.isSessionSupported('immersive-ar') ?? false;
		}

		if (isWebXRSupported) {
			this.initWebXRAR();
		} else {
			console.warn('WebXR not supported, falling back to Webcam AR');
			this.initWebcamAR();
		}
	}

	initWebXRAR() {
		// 1. 添加 AR 按钮
		const arButton = ARButton.createButton(this.renderer, { requiredFeatures: ['hit-test'] });
		arButton.style.zIndex = '9999';
		document.body.appendChild(arButton);

		this.renderer.xr.enabled = true;

		// 2. 创建 Reticle (光标)
		const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
		const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
		this.arReticle = new THREE.Mesh(geometry, material);
		this.arReticle.matrixAutoUpdate = false;
		this.arReticle.visible = false;
		this.scene.add(this.arReticle);

		// 3. 创建 AR 内容组
		this.arContentGroup = new THREE.Group();
		this.scene.add(this.arContentGroup);

		// 4. 监听 AR 会话交互
		const onSelect = () => {
			if (this.arReticle && this.arReticle.visible && this.arContentGroup) {
				const position = new THREE.Vector3();
				const quaternion = new THREE.Quaternion();
				const scale = new THREE.Vector3();
				
				this.arReticle.matrix.decompose(position, quaternion, scale);
				
				this.arContentGroup.position.copy(position);
				this.arContentGroup.quaternion.copy(quaternion);
				this.arContentGroup.visible = true;
			}
		};

		const controller = this.renderer.xr.getController(0);
		controller.addEventListener('select', onSelect);
		this.scene.add(controller);
	}

	async initWebcamAR() {
		this.isWebcamAR = true;
		this.renderer.xr.enabled = false; // 禁用 XR

		// 1. 获取摄像头流并作为背景
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment'
				}
			});
			
			const video = document.createElement('video');
			// iOS 关键属性：允许内联播放，静音自动播放
			video.setAttribute('autoplay', '');
			video.setAttribute('muted', '');
			video.setAttribute('playsinline', '');
			video.setAttribute('webkit-playsinline', '');
			video.style.position = 'absolute';
			video.srcObject = stream;
			video.play().catch(e => {
				console.error('Video play failed:', e);
			});
			video.style.top = '0';
			video.style.left = '0';
			video.style.width = '100%';
			video.style.height = '100%';
			video.style.objectFit = 'cover';
			video.style.zIndex = '0'; // 在 canvas 之下
			
			this.videoElement = video; // 保存 video 引用

			if (this.container) {
				this.container.appendChild(video);
			} else {
				document.body.appendChild(video);
			}
			
			// 确保 canvas 透明
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.domElement.style.background = 'transparent';

			// 初始化二维码扫描 Canvas
			this.qrScanCanvas = document.createElement('canvas');
			this.qrScanContext = this.qrScanCanvas.getContext('2d');

		} catch (err) {
			console.error('Error accessing webcam:', err);
			alert('无法访问摄像头，请检查权限设置');
		}

		// 2. 初始化陀螺仪控制
		// 注意：iOS 需要用户交互触发权限请求，这部分逻辑应在外部 UI 调用
		this.deviceOrientationControls = new DeviceOrientationControls(this.camera, this.renderer.domElement);
		this.controls.enabled = false; // 禁用 OrbitControls

		// 3. 创建 AR 内容组并默认放置在前方
		this.arContentGroup = new THREE.Group();
		this.scene.add(this.arContentGroup);
		// 默认不可见或者放置在一定距离
		this.arContentGroup.position.set(0, 0, -5); // 相机前方 5 米
	}

	// 专门为 Webcam AR 提供的放置方法
	placeSceneInFrontOfCamera() {
		if (!this.arContentGroup || !this.camera) return;

		// 获取相机前方一定距离的位置
		const distance = 5; // 5米
		const direction = new THREE.Vector3();
		this.camera.getWorldDirection(direction);
		
		const position = new THREE.Vector3();
		position.copy(this.camera.position).add(direction.multiplyScalar(distance));
		
		this.arContentGroup.position.copy(position);
		// 可选：让物体朝向相机
		this.arContentGroup.lookAt(this.camera.position);
		// 修正旋转，保持水平
		this.arContentGroup.rotation.x = 0;
		this.arContentGroup.rotation.z = 0;
	}

	// 扫描二维码并定位场景
	scanAndPositionFromQR() {
		if (!this.videoElement || !this.qrScanCanvas || !this.qrScanContext || !this.camera || !this.arContentGroup) {
			return false;
		}

		// 限制扫描频率 (例如每 200ms 扫描一次)
		const now = performance.now();
		if (now - this.lastQRScanTime < 200) {
			return false;
		}
		this.lastQRScanTime = now;

		const video = this.videoElement;
		if (video.readyState === video.HAVE_ENOUGH_DATA) {
			this.qrScanCanvas.width = video.videoWidth;
			this.qrScanCanvas.height = video.videoHeight;
			this.qrScanContext.drawImage(video, 0, 0, this.qrScanCanvas.width, this.qrScanCanvas.height);
			
			const imageData = this.qrScanContext.getImageData(0, 0, this.qrScanCanvas.width, this.qrScanCanvas.height);
			const code = jsQR(imageData.data, imageData.width, imageData.height, {
				inversionAttempts: "dontInvert",
			});

			if (code) {
				console.log("Found QR code", code.data);
				// 根据二维码位置定位
				this.positionSceneByQR(code.location);
				return true;
			}
		}
		return false;
	}

	positionSceneByQR(location: any) {
		if (!this.camera || !this.arContentGroup) return;

		// 1. 计算二维码中心点
		const centerX = (location.topLeftCorner.x + location.topRightCorner.x + location.bottomRightCorner.x + location.bottomLeftCorner.x) / 4;
		const centerY = (location.topLeftCorner.y + location.topRightCorner.y + location.bottomRightCorner.y + location.bottomLeftCorner.y) / 4;

		// 2. 归一化设备坐标 (NDC) -1 to 1
		// 注意 video 可能被 object-fit: cover 裁剪，这里简化假设 video 填满屏幕且比例一致，或者做简单映射
		// 为了更精确，需要考虑 videoElement 的显示尺寸和 videoWidth 的比例
		// 这里简化处理：假设 video 是全屏显示的背景
		
		const ndcX = (centerX / this.videoElement!.videoWidth) * 2 - 1;
		const ndcY = -(centerY / this.videoElement!.videoHeight) * 2 + 1;

		// 3. 估算距离
		// 假设二维码物理宽度为 10cm (0.1m)
		// 简单的相似三角形原理： distance = (physicalWidth * focalLength) / pixelWidth
		const qrPhysicalWidth = 0.15; // 米
		const pixelWidth = Math.sqrt(
			Math.pow(location.topRightCorner.x - location.topLeftCorner.x, 2) +
			Math.pow(location.topRightCorner.y - location.topLeftCorner.y, 2)
		);
		
		// 估算焦距 (pixels)
		// fov = 2 * atan( (height / 2) / focalLength )
		// focalLength = (height / 2) / tan(fov / 2)
		// 这里用 videoHeight 估算
		const fovRad = (this.camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
		const focalLength = (this.videoElement!.videoHeight / 2) / Math.tan(fovRad / 2);
		
		const distance = (qrPhysicalWidth * focalLength) / pixelWidth;

		// 4. 计算 3D 位置
		// 从相机发射射线到该深度的平面
		const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
		vector.unproject(this.camera);
		const dir = vector.sub(this.camera.position).normalize();
		const targetPos = this.camera.position.clone().add(dir.multiplyScalar(distance));

		// 5. 应用位置
		// 平滑过渡
		// this.arContentGroup.position.lerp(targetPos, 0.1); 
		this.arContentGroup.position.copy(targetPos);
		
		// 6. 朝向相机 (简化版，始终正面朝向用户，保持 upright)
		this.arContentGroup.lookAt(this.camera.position);
		this.arContentGroup.rotation.x = 0; // 保持水平
		this.arContentGroup.rotation.z = 0;
	}

	// 请求陀螺仪权限 (iOS)
	async requestDeviceOrientationPermission() {
		if (this.deviceOrientationControls && typeof (this.deviceOrientationControls as any).connect === 'function') {
             // DeviceOrientationControls 内部有权限请求逻辑，但需要重新触发连接
             // 或者我们可以手动调用 DeviceOrientationEvent.requestPermission
             if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                 try {
                     const response = await (DeviceOrientationEvent as any).requestPermission();
                     if (response === 'granted') {
                         this.deviceOrientationControls.connect();
                         return true;
                     } else {
                         alert('陀螺仪权限被拒绝');
                         return false;
                     }
                 } catch (error) {
                     console.error(error);
                     return false;
                 }
             }
        }
        return true; // Android 或非 iOS 设备默认通常允许
	}

	handleARHitTest(frame: any) {
		if (!this.arHitTestSourceRequested) {
			const session = this.renderer.xr.getSession();
			if (session) {
				session.requestReferenceSpace('viewer').then((referenceSpace: any) => {
					session.requestHitTestSource({ space: referenceSpace }).then((source: any) => {
						this.arHitTestSource = source;
					});
				});
				session.addEventListener('end', () => {
					this.arHitTestSourceRequested = false;
					this.arHitTestSource = null;
				});
				this.arHitTestSourceRequested = true;
			}
		}

		if (this.arHitTestSource && this.arReticle) {
			const referenceSpace = this.renderer.xr.getReferenceSpace();
			const hitTestResults = frame.getHitTestResults(this.arHitTestSource);

			if (hitTestResults.length > 0) {
				const hit = hitTestResults[0];
				// 获取姿态
				const pose = hit.getPose(referenceSpace);
				if (pose) {
					this.arReticle.visible = true;
					this.arReticle.matrix.fromArray(pose.transform.matrix);
				}
			} else {
				this.arReticle.visible = false;
			}
		}
	}

	startAnimationLoop() {
		const animate = (time?: number, frame?: any) => {
			// 如果不是 XR 模式，需要手动 requestAnimationFrame
			// 如果是 XR 模式，renderer.setAnimationLoop 会处理循环，不需要 requestAnimationFrame
			// 但这里为了兼容两套逻辑，我们要做个判断
			
			// 注意：renderer.setAnimationLoop(callback) 会在每次 XR 帧时调用 callback
			// 且 callback 会带上 time 和 frame
			
			// 如果没有启用 XR，或者 XR session 没开始，我们需要手动调用 loop（在 else 分支处理）
			
			const delta = this.clock.getDelta()
			this.effectManager.update(delta)

			// AR Hit Test
			if (this.options.enableAR && frame) {
				this.handleARHitTest(frame);
			}

			// Webcam AR: 自动扫描二维码
			if (this.isWebcamAR) {
				this.scanAndPositionFromQR();
			}

			// 更新 OrbitControls
			if (this.controls && this.controls.enabled) {
				this.controls.update()
			}
			// 更新 DeviceOrientationControls
			if (this.deviceOrientationControls && this.deviceOrientationControls.enabled) {
				this.deviceOrientationControls.update()
			}
			
			// 更新镜头光位置跟随相机
			if (this.lensLight && this.camera) {
				// 让镜头光稍微偏离相机位置，避免直射
				const offset = new THREE.Vector3(2, 1, 2)
				this.lensLight.position.copy(this.camera.position).add(offset)
			}

			// 调用额外的动画回调
			// biome-ignore lint/complexity/noForEach: <explanation>
			// this.animationCallbacks.forEach(callback => callback())
			for (const mixer of this.mixers) {
				mixer.update(delta)
			}
			// ⭐️ 渲染流程修改：Bloom 替代原生 WebGL 渲染
			// 1. 渲染 bloom 通道
			this.scene.traverse(obj => {
				if ((obj as any).isMesh) {
					const mesh = obj as THREE.Mesh
					if (!this.bloomLayer.test(mesh.layers)) {
						this.materials[mesh.uuid] = mesh.material
						mesh.material = this.darkMaterial
					}
					if (obj.parent && obj.parent.isTransformControlsGizmo) {
						this.materials[mesh.uuid] = mesh.material
						mesh.material = this.darkMaterial
					}
				}
			})
			if (this.showbloom) {
				this.bloomComposer.render()
			}

			// 还原材质
			this.scene.traverse(obj => {
				if ((obj as any).isMesh && this.materials[obj.uuid]) {
					const mesh = obj as THREE.Mesh
					mesh.material = this.materials[mesh.uuid] // 修改点：类型兼容
					delete this.materials[mesh.uuid]
				}
			})
			
			// AR 模式下通常不需要复杂的 PostProcessing (Composer)，因为要透视背景
			// 但如果有 Bloom 需求，可以用 finalComposer。
			// 不过 WebXR 中使用 Composer 可能会有兼容性问题（RenderTarget 大小等）。
			// 简单起见，AR 模式下直接 render scene
			if (this.renderer.xr.enabled && this.renderer.xr.isPresenting) {
				this.renderer.render(this.scene, this.camera);
			} else {
				// 2. 合成最终场景
				this.finalComposer.render()
			}

			// 渲染 CSS3D 场景（叠加在 WebGL 上）
			if (this.css3DRenderer) {
				this.css3DRenderer.render(this.scene, this.camera)
			}

			// 性能监控
			if (this.stats) {
				this.stats.update()
			}

			// 额外动画逻辑
			if (this.addAnimationFunc) {
				this.addAnimationFunc()
			}
			updateGrid(grid, this.camera);

			// 更新 Tween.js（传入毫秒时间戳）
			TWEEN.update(time || performance.now())
		}

		if (this.renderer.xr.enabled) {
			this.renderer.setAnimationLoop(animate);
		} else {
			const loop = (time: number) => {
				requestAnimationFrame(loop);
				animate(time);
			}
			loop(0);
		}
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
			if (this.rendererGPU) {
				this.container.appendChild(this.rendererGPU.domElement)
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
	addEffect(item: Effect, target: THREE.Object3D | undefined = undefined) {
		if (item.target === 0) {
			this.effectManager.addEffect(item.effect_name, this.scene, item.options)
		} else if (target) {
			this.effectManager.addEffect(item.effect_name, target, item.options)
		}
	}
	removeEffect(item: Effect, target: THREE.Object3D) {
		this.effectManager.removeEffect(target, item.effect_name)
	}
	lookAtCameraState(
		targetState: CameraState,
		duration: number = 1000,
		onComplete?: () => void
	) {
		console.log('切换镜头', targetState)
		this.controls.enabled = false // 禁用操作

		const startPos = this.camera.position.clone()
		const posObj = { x: startPos.x, y: startPos.y, z: startPos.z }

		const startTarget = this.controls.target.clone()
		const targetObj = { x: startTarget.x, y: startTarget.y, z: startTarget.z }

		// 透视相机才考虑 fov
		let fovObj: { fov: number } | null = null
		if (
			(this.camera as THREE.PerspectiveCamera).isPerspectiveCamera &&
			typeof targetState.fov === 'number'
		) {
			fovObj = { fov: (this.camera as THREE.PerspectiveCamera).fov }
		}

		TWEEN.add(
			new TWEEN.Tween(posObj)
				.to(
					{
						x: targetState.position.x,
						y: targetState.position.y,
						z: targetState.position.z
					},
					duration
				)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(() => {
					this.camera.position.set(posObj.x, posObj.y, posObj.z)
				})
				.start()
		)

		TWEEN.add(
			new TWEEN.Tween(targetObj)
				.to(
					{
						x: targetState.target.x,
						y: targetState.target.y,
						z: targetState.target.z
					},
					duration
				)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(() => {
					this.controls.target.set(targetObj.x, targetObj.y, targetObj.z)
					this.controls.update()
				})
				.onComplete(() => {
					this.controls.enabled = true
					if (onComplete) onComplete()
				})
				.start()
		)

		// fov tween
		if (fovObj) {
			new TWEEN.Tween(fovObj)
				.to({ fov: targetState.fov! }, duration)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(() => {
					const cam = this.camera as THREE.PerspectiveCamera
					cam.fov = fovObj!.fov
					cam.updateProjectionMatrix()
				})
				.start()
		}
	}

	public calcSelectObjSphere = (arr: THREE.Object3D[]) => {
		if (!arr || !arr.length) return
		const objectArr = arr
		const object3D = new THREE.Object3D()
		for (let i = 0, len = objectArr.length; i < len; i++) {
			object3D.children.push(objectArr[i])
		}
		const box3 = new THREE.Box3()
		box3.expandByObject(object3D)
		const sphere = new THREE.Sphere()
		box3.getBoundingSphere(sphere)
		return sphere
	}
	public lookAtSelectObj = (meshArr: THREE.Object3D[]) => {
		TWEEN.removeAll()
		const sphere = this.calcSelectObjSphere(meshArr)
		if (!sphere) return
		const { center, radius } = sphere
		const camera = this.camera
		if (!camera) return null

		// 计算理想距离
		const fov = camera.fov * (Math.PI / 180)
		const idealDistance = Math.abs(radius / Math.sin(fov / 2)) * 1.2

		// 计算目标位置方向 (从中心指向当前相机位置)
		const direction = new THREE.Vector3()
			.subVectors(camera.position, center)
			.normalize()

		// 计算完整的目标位置
		const fullTargetPosition = new THREE.Vector3()
			.copy(center)
			.add(direction.multiplyScalar(idealDistance))

		// 使用lerp在当前位置和目标位置之间插值
		const lerpedPosition = new THREE.Vector3()
			.copy(camera.position)
			.lerp(fullTargetPosition, 1.0)

		this.lookAtCameraState({
			position: lerpedPosition,
			target: new THREE.Vector3().copy(center) // 目标总是中心点
		})
	}

	public recordCamera(need_push = true): CameraState {
		const item = {
			position: this.camera.position.clone(),
			target: this.controls.target.clone(),
			fov: (this.camera as THREE.PerspectiveCamera).isPerspectiveCamera
				? (this.camera as THREE.PerspectiveCamera).fov
				: undefined
		}
		if (need_push) {
			this.cameraList.push(item)
		}
		return item
	}
	public saveSceneToJSON(): SceneJSON {
		const objects: SceneObjectJSON[] = []
		console.log(this.scene.children)
		// biome-ignore lint: <就用forEach>
		this.scene.children.forEach(obj => {
			// 忽略灯光、摄像机等非 Mesh 类型
			if (
				!(obj instanceof THREE.Mesh) &&
				!(obj instanceof THREE.Group) &&
				!(obj instanceof THREE.Points)
			)
				return
			const typeGuess = (() => {
				if (obj.userData.url) {
					if (obj.userData.type === 'model') {
						return 'model'
					}
					if (obj.userData.type === '3Dtext') {
						return '3Dtext'
					}
					return 'image'
				}
				if (obj.userData.type === 'effect') {
					return 'effect'
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
					if (obj.userData && obj.userData.type === 'library') {
						return 'library'
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
			const renderOrder = obj.renderOrder

			const jsonObj: SceneObjectJSON = {
				type: typeGuess,
				position,
				rotation,
				scale,
				renderOrder
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
				if (obj.userData.options) {
					jsonObj.options = obj.userData.options
				}
				if (obj.userData.effect && obj.userData.effect.length > 0) {
					jsonObj.effect = obj.userData.effect
				}
				if (obj.userData.material) {
					jsonObj.material = obj.userData.material
				}
			}
			if (typeGuess === 'image') {
				jsonObj.url = obj.userData.url.replace(BASE_IMG, '')
			}
			if (typeGuess === 'effect') {
				jsonObj.options = obj.userData.options
				jsonObj.effect_name = obj.userData.effectName
			}
			if (typeGuess === 'diary') {
				jsonObj.title = obj.userData.title
				jsonObj.content = obj.userData.content
			}
			if (typeGuess === '3Dtext') {
				jsonObj.title = obj.userData.title
				jsonObj.url = obj.userData.url
				jsonObj.options = obj.userData.options
				const mat = obj.material as THREE.Material
				if ((mat as any).color) {
					if (!jsonObj.options) jsonObj.options = {}
					jsonObj.options.color = '#' + (mat as any).color.getHexString()
				}
			}
			if (typeGuess === 'library') {
				jsonObj.title = obj.userData.title
				jsonObj.cover = obj.userData.cover
				jsonObj.library_id = obj.userData.library_id
			}

			if (typeGuess === 'template') {
				jsonObj.template_id = obj.userData.template_id
			}

			objects.push(jsonObj)
		})
		const resault: SceneJSON = { objects }
		if (this.cameraList && this.cameraList.length > 0) {
			resault.cameraList = this.cameraList
		}
		if (this.background) {
			resault.background = this.background
		}
		// 保存controls配置（跳过 Infinity 值，因为 JSON 不支持）
		if (this.controls) {
			const controlsConfig: SceneJSON['controls'] = {}
			if (this.controls.minAzimuthAngle !== undefined && this.controls.minAzimuthAngle !== Number.NEGATIVE_INFINITY) {
				controlsConfig.minAzimuthAngle = this.controls.minAzimuthAngle
			}
			if (this.controls.maxAzimuthAngle !== undefined && this.controls.maxAzimuthAngle !== Number.POSITIVE_INFINITY) {
				controlsConfig.maxAzimuthAngle = this.controls.maxAzimuthAngle
			}
			if (this.controls.minPolarAngle !== undefined) {
				controlsConfig.minPolarAngle = this.controls.minPolarAngle
			}
			if (this.controls.maxPolarAngle !== undefined) {
				controlsConfig.maxPolarAngle = this.controls.maxPolarAngle
			}
			if (Object.keys(controlsConfig).length > 0) {
				resault.controls = controlsConfig
			}
		}
		return resault
	}
	// 为模型设置属性
	public setOptionsModel(
		mesh: THREE.Mesh | THREE.Object3D,
		options: Record<string, any>
	) {
		if (options.color) {
			if (mesh instanceof THREE.Mesh) {
				mesh.material.color = new THREE.Color(options.color)
			}
			mesh.traverse(child => {
				if (child instanceof THREE.Mesh) {
					child.material.color = new THREE.Color(options.color)
				}
			})
		}
		mesh.userData.options = options
	}
	// 为模型设置特效
	public setEffectModel(
		mesh: THREE.Mesh | THREE.Object3D,
		effects: SceneEffectJSON[]
	) {
		if (effects.length > 0) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			effects.forEach(effect => {
				if (effect.type === 'effect' && effect.effect_name) {
					const { options } = effect
					this.addEffect(
						{ effect_name: effect.effect_name, effect_id: 0, options },
						mesh
					)
				} else if (effect.type === 'animation' && effect.options) {
					this.applyAnimation(mesh, effect)
				}
			})
		}
	}
	// 为模型设置贴图
	public setMaterialModel(
		mesh: THREE.Mesh | THREE.Object3D,
		material: Record<string, any>
	) {
		mesh.traverse(async child => {
			if (child.name.includes('replace') && child instanceof THREE.Mesh) {
				if (material[child.name]) {
					const options = material[child.name]
					// console.log('缓存的贴图属性', options)
					// const texture = await this.loadTexture(BASE_IMG + options.url)
					// texture.offset.set(options.offsetX ?? 0, options.offsetY ?? 0)
					// texture.repeat.set(options.scaleX ?? 1, options.scaleY ?? 1)
					// texture.rotation = options.rotation ?? 0
					// texture.center.set(0.5, 0.5)
					// child.material.map = texture
					// child.material.transparent = true
					const img = new Image()
					img.src = BASE_IMG + options.url
					console.log('参数', options)
					img.onload = () => {
						const tex = this.createTransformedTexture(img, {
							offsetX: options.offsetX ?? 0,
							offsetY: options.offsetY ?? 0,
							scale: options.scale ?? 1,
							rotation: options.rotation ?? 0
						})
						tex.flipY = false
						tex.colorSpace = THREE.SRGBColorSpace
						child.material.map = tex
						child.material.transparent = true
						child.material.needsUpdate = true
					}
				}
			} else if (child instanceof THREE.Mesh) {
				if (child.material.map) {
					child.material.map.colorSpace = THREE.SRGBColorSpace
					console.log('其他模型', child.material.map)
				}
			}
		})
		mesh.userData.material = material
	}

	cloneMultiMaterial(obj: THREE.Mesh) {
		// 如果有模型使用同一材质
		//如果一个模型有多个材质
		let flat = false
		console.log(this.allMat, '所有贴图')
		const Mlen = this.allMat.length
		//查看是否有模型使用同一材质
		for (let i = 0; i < Mlen; i++) {
			if (this.allMat[i] === obj.material) {
				obj.material = this.allMat[i].clone()
				flat = true
				break
			}
		}
		if (!flat) {
			if (Array.isArray(obj.material)) {
				this.allMat.push(...obj.material)
			} else {
				this.allMat.push(obj.material)
			}
		}
	}
	copyMaterial(model: THREE.Mesh | THREE.Object3D) {
		model.traverse(child => {
			if (child instanceof THREE.Mesh) {
				// 如果共享材质，需要克隆
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material = child.material.map(mat => {
							const clonedMat = mat.clone()
							// 如果有贴图，贴图也要 clone
							if (clonedMat.map) {
								clonedMat.map = clonedMat.map.clone()
								clonedMat.map.needsUpdate = true
							}
							return clonedMat
						})
					} else {
						const clonedMat = child.material.clone()
						if (clonedMat.map) {
							clonedMat.map = clonedMat.map.clone()
							clonedMat.map.needsUpdate = true
						}
						child.material = clonedMat
					}
				}
			}
		})
	}
	applyAnimation(obj: THREE.Object3D, anim: SceneEffectJSON) {
		if (anim.type === 'animation') {
			const props: any = {}
			for (const key in anim.properties) {
				const [prop, axis] = key.split('.')
				if (axis) {
					props[axis] = anim.properties[key]
					gsap.to((obj as any)[prop], {
						...props,
						duration: anim.duration,
						ease: anim.ease,
						delay: anim.delay,
						repeat: anim.repeat,
						yoyo: anim.yoyo,
						repeatDelay: anim.repeatDelay
					})
				} else {
					gsap.to(obj as any, {
						[prop]: anim.properties[key],
						duration: anim.duration,
						ease: anim.ease,
						delay: anim.delay,
						repeat: anim.repeat,
						yoyo: anim.yoyo,
						repeatDelay: anim.repeatDelay
					})
				}
			}
		} else if (anim.type === 'timeline') {
			const tl = gsap.timeline()
			// biome-ignore lint/complexity/noForEach: <explanation>
			anim.children?.forEach(child => {
				const targetObj = obj // 可以拓展为通过 uuid 查找
				if (anim.sequence) {
					tl.add(() => this.applyAnimation(targetObj, child), 0)
					// tl.to(targetObj, this.applyAnimation(targetObj, child))
				} else {
					tl.add(() => this.applyAnimation(targetObj, child), 0)
				}
			})
		}
	}
	public async loadSceneFromJSON(json: SceneJSON, renturGroup = false, onProgress?: (current: number, total: number) => void) {
		let group = null
		if (renturGroup) {
			group = new THREE.Group()
			group.userData.ignorePick = true
		} else {
			if (json.cameraList) {
				this.cameraList = json.cameraList
			}
			if (json.background) {
				this.background = json.background
			}
			// 加载controls配置
			if (json.controls && this.controls) {
				if (json.controls.minAzimuthAngle !== undefined) {
					this.controls.minAzimuthAngle = json.controls.minAzimuthAngle
				}
				if (json.controls.maxAzimuthAngle !== undefined) {
					this.controls.maxAzimuthAngle = json.controls.maxAzimuthAngle
				}
				if (json.controls.minPolarAngle !== undefined) {
					this.controls.minPolarAngle = json.controls.minPolarAngle
				}
				if (json.controls.maxPolarAngle !== undefined) {
					this.controls.maxPolarAngle = json.controls.maxPolarAngle
				}
			}
		}

		const total = json.objects.length
		let current = 0
		for (const obj of json.objects) {
			const position = obj.position || [0, 0, 0]
			const rotation = obj.rotation || [0, 0, 0]
			const scale = obj.scale || [1, 1, 1]
			this.renderOrderCount += 10
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
					if (obj.options) {
						this.setOptionsModel(mesh, obj.options)
					}
					if (obj.effect) {
						this.setEffectModel(mesh, obj.effect)
					}
					if (obj.material) {
						this.setMaterialModel(mesh, obj.material)
					}
				} catch (e) {
					console.warn(`模型加载失败：${obj.url}`, e)
				}
			}
			if (obj.type === '3Dtext' && obj.url) {
				mesh = await this.addTextToScene(BASE_IMG + obj.url, obj.title || '', obj.options || {})
				console.log('mesh字体', obj.title, obj.url)
			}

			if (obj.type === 'effect' && obj.effect_name) {
				const target = (this.options.enableAR && this.arContentGroup) ? this.arContentGroup : this.scene
				this.addEffect(
					{
						effect_name: obj.effect_name,
						effect_id: 0,
						options: obj.options ? obj.options : {}
					},
					target
				)
			}
			if (obj.type === 'image' && obj.url) {
				mesh = await this.loadImageMesh(BASE_IMG + obj.url, obj.baseWidth || 5)
			}
			if (obj.type === 'diary') {
				mesh = await this.createDiary(obj)
			}
			if (obj.type === 'library') {
				mesh = await this.createLibrary(obj)
			}
			if (obj.type === 'template') {
				// 加载模版类型
				console.log(obj, '对象')
				if (obj.template_id) {
					try {
						const template = await getTemplateOne({
							template_id: obj.template_id
						})
						if (template.json_data) {
							const group = await this.loadSceneFromJSON(
								template.json_data,
								true,
								undefined // 模版加载时不显示进度
							)
							if (group) {
								group.userData.type = 'template'
								group.userData.template_id = template.template_id
									group.userData.ignorePick = true
									if (this.options.enableAR && this.arContentGroup) {
										this.arContentGroup.add(group)
									} else {
										this.scene.add(group)
									}
									this.loadTemplate.push(group)
								}
						} else if (template.json_url) {
							use$Get(`/sence/json/${template.json_url}.json?2`, undefined, {
								baseURL: BASE_IMG
							}).then(async res => {
								const group = await this.loadSceneFromJSON(res, true, undefined) // 模版加载时不显示进度
								if (group) {
									group.userData.type = 'template'
									group.userData.template_id = template.template_id
									group.userData.ignorePick = true
									if (this.options.enableAR && this.arContentGroup) {
										this.arContentGroup.add(group)
									} else {
										this.scene.add(group)
									}
									this.loadTemplate.push(group)
								}
							})
						}
					} catch (error) {
						console.log('加载失败')
					}
				}
			}
			if (mesh) {
				mesh.position.set(...position)
				mesh.rotation.set(...rotation)
				mesh.scale.set(...scale)
				if (obj.renderOrder) {
					mesh.renderOrder = obj.renderOrder
				}
				if (obj.type === 'diary') {
					if (!this.editMode) {
						mesh.scale.set(0.001, 0.001, 0.001)
					} else {
						mesh.scale.set(1, 1, 1)
					}
					console.log('创建日记点', this.editMode)
				}
				if (obj.type === 'library') {
					if (!this.editMode) {
						mesh.scale.set(0.001, 0.001, 0.001)
					} else {
						mesh.scale.set(1, 1, 1)
					}
				}
				if (renturGroup) {
					mesh.userData.ignorePick = true
					mesh.traverse(childMesh => {
						childMesh.userData.ignorePick = true
					})
					group?.add(mesh)
				} else {
					this.allObjects.push(mesh)
					if (this.options.enableAR && this.arContentGroup) {
						this.arContentGroup.add(mesh)
					} else {
						this.scene.add(mesh)
					}
				}

				// const box = this.createBoundingBoxMesh(mesh)
				// box.userData.ignorePick = true
				// box.position.set(...position)
				// box.rotation.set(...rotation)
				// box.scale.set(...scale)
				// box.renderOrder = 100000
				// console.log(box, '包围盒')
			}
			
			// 更新进度
			current++
			if (onProgress && !renturGroup) {
				onProgress(current, total)
			}
		}
		if (renturGroup) {
			return group
		}
		return null
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
	clearObject(object: THREE.Object3D) {
		if (object.isMesh) {
			if (object.geometry) {
				object.geometry.dispose() // 释放几何体内存
			}

			// 处理材质
			if (object.material) {
				// 如果是材质数组
				if (Array.isArray(object.material)) {
					object.material.forEach(material => material.dispose())
				} else {
					object.material.dispose() // 单个材质
				}
			}
			console.log('走到这里了')
			if (object.parent) {
				object.parent.remove(object)
			} else {
				this.scene.remove(object)
			}
		}
	}
	clearGroup(group: THREE.Group | THREE.Object3D) {
		// 遍历组的所有子对象
		while (group.children.length > 0) {
			const child = group.children[0]
			// biome-ignore lint/complexity/noForEach: <explanation>
			group.children.forEach((child: THREE.Object3D) => {
				// 如果子对象是网格(Mesh)，需要处理其几何体和材质
				if (child.isMesh) {
					if (child.geometry) {
						child.geometry.dispose() // 释放几何体内存
					}

					// 处理材质
					if (child.material) {
						// 如果是材质数组
						if (Array.isArray(child.material)) {
							child.material.forEach(material => material.dispose())
						} else {
							child.material.dispose() // 单个材质
						}
					}
				}
			})

			// 从组中移除子对象
			group.remove(child)
			group.parent?.remove(group)
		}
		if (group.isMesh) {
			this.clearObject(group)
		}
		console.log(this.loadedModels, '加载的模型')
	}

	// 修改dispose方法以清理CSS3D渲染器
	dispose() {
		// 清理事件监听
		window.removeEventListener('resize', () => this.onContainerResize())
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
		}

		if (this.deviceOrientationControls) {
			this.deviceOrientationControls.dispose();
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
