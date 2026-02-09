<template>
	<div ref="containerRef" class="physics-drop-container">
		<!-- 画布容器 -->
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import ThreeCore from '@/utils/threeCore'
import { BASE_IMG_MODEL } from '@/utils/ipConfig.js'

// 定义接口
interface ModelData {
	url: string
	name: string
	id: string | number
	options?: {
		useDracoLoader?: boolean
		dracoDecoderPath?: string
		[key: string]: unknown
	}
}

interface PhysicsBody {
	mesh: THREE.Object3D
	// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
	body: any // Ammo.js 刚体
	userData: ModelData
}

// Props
const props = defineProps<{
	models?: ModelData[]
}>()

// Emits
const emit = defineEmits<{
	objectClick: [data: ModelData]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
let threeCore: ThreeCore | null = null
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let ammoInstance: any = null
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let physicsWorld: any = null
let physicsBodies: PhysicsBody[] = []
let isModelsLoaded = false
let modelsToLoad: ModelData[] = []
let cleanupTimer: ReturnType<typeof setInterval> | null = null
const CLEANUP_INTERVAL = 10000 // 每10秒检查一次
const MAX_MODELS = 60 // 场景中最多保留的模型数量

// 缓存的模型模板
interface CachedModel {
	mesh: THREE.Object3D // 原始模型（不添加到场景）
	modelData: ModelData
	size: THREE.Vector3 // 包围盒尺寸
	center: THREE.Vector3 // 包围盒中心
}

let cachedModels: CachedModel[] = []
let spawnTimer: ReturnType<typeof setInterval> | null = null
const SPAWN_INTERVAL = 2000 // 每2秒生成一个模型
const GROUND_Y = -10 // 地面Y轴位置（屏幕底部）
const SPAWN_HEIGHT_MIN = 10 // 生成高度最小值
const SPAWN_HEIGHT_MAX = 20 // 生成高度最大值
const CAMERA_ANGLE = 0 // 相机与地面的角度（度）
const CAMERA_DISTANCE = 50 // 相机距离场景中心的距离

// 可视区域范围（动态计算）
let visibleRangeX = 15 // X轴可视范围
let visibleRangeZ = 15 // Z轴可视范围

// 初始化 Ammo.js
const initAmmo = async () => {
	try {
		// 动态导入 ammo.js
		// @ts-ignore - ammo.js 缺少类型定义
		const AmmoModule = await import('ammo.js')
		
		// ammo.js 的正确导入方式
		// ammo.js 通常导出一个初始化函数
		if (AmmoModule.default && typeof AmmoModule.default === 'function') {
			ammoInstance = await AmmoModule.default()
		} else if (typeof AmmoModule === 'function') {
			ammoInstance = await (AmmoModule as () => Promise<unknown>)()
		} else if (AmmoModule.default) {
			ammoInstance = AmmoModule.default
		} else {
			ammoInstance = AmmoModule
		}
		
		console.log('Ammo.js 初始化成功', ammoInstance)
		createPhysicsWorld()
	} catch (error) {
		console.error('初始化 Ammo.js 失败:', error)
		throw error
	}
}

// 创建物理世界（提取为独立函数）
const createPhysicsWorld = () => {
	if (!ammoInstance) return
	
	// 创建物理世界
	const collisionConfiguration = new ammoInstance.btDefaultCollisionConfiguration()
	const dispatcher = new ammoInstance.btCollisionDispatcher(collisionConfiguration)
	const overlappingPairCache = new ammoInstance.btDbvtBroadphase()
	const solver = new ammoInstance.btSequentialImpulseConstraintSolver()
	
	physicsWorld = new ammoInstance.btDiscreteDynamicsWorld(
		dispatcher,
		overlappingPairCache,
		solver,
		collisionConfiguration
	)
	
	// 设置重力 (Y轴向下) - 增加重力值使掉落更明显
	physicsWorld.setGravity(new ammoInstance.btVector3(0, -9.8, 0))
	
	console.log('物理世界创建成功')
	
	// 创建地面
	createGround()
}

// 创建地面
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let groundRigidBody: any = null

const createGround = () => {
	if (!threeCore || !ammoInstance || !physicsWorld) return
	
	// Three.js 地面
	const groundGeometry = new THREE.PlaneGeometry(200, 200)
	const groundMaterial = new THREE.MeshStandardMaterial({ 
		color: 0x888888,
		transparent: true,
		opacity: 0
	})
	const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
	groundMesh.rotation.x = -Math.PI / 2
	groundMesh.position.y = GROUND_Y // 地面在屏幕底部
	groundMesh.receiveShadow = true
	groundMesh.userData.ignorePick = true
	threeCore.scene.add(groundMesh)
	
	// Ammo.js 地面刚体 - 平面法向量 (0, 1, 0) 表示 Y 轴向上，常数 GROUND_Y 表示平面在 y=GROUND_Y
	// 注意：btStaticPlaneShape 不支持 setMargin，它是无限平面，不需要设置边距
	const groundShape = new ammoInstance.btStaticPlaneShape(
		new ammoInstance.btVector3(0, 1, 0),
		GROUND_Y
	)
	const groundTransform = new ammoInstance.btTransform()
	groundTransform.setIdentity()
	groundTransform.setOrigin(new ammoInstance.btVector3(0, GROUND_Y, 0))
	
	const groundMotionState = new ammoInstance.btDefaultMotionState(groundTransform)
	const groundRigidBodyInfo = new ammoInstance.btRigidBodyConstructionInfo(0, groundMotionState, groundShape)
	groundRigidBody = new ammoInstance.btRigidBody(groundRigidBodyInfo)
	
	physicsWorld.addRigidBody(groundRigidBody)
	
	console.log('地面创建成功，位置:', GROUND_Y)
}

// 加载模型（只缓存，不添加到场景）
const loadModels = async (models: ModelData[]) => {
	if (!threeCore || !ammoInstance) {
		modelsToLoad = models
		return
	}
	
	// 清空之前的缓存
	cachedModels = []
	
	// 加载所有模型并缓存
	const loadPromises = models.map(async (modelData) => {
		try {
			if (!threeCore) return null
			
			const fullUrl = modelData.url.startsWith('http') 
				? modelData.url 
				: `${BASE_IMG_MODEL}${modelData.url.startsWith('/') ? modelData.url : `/${modelData.url}`}`
			
			// 使用 options 中的配置，如果没有则默认 false
			const loadOptions = {
				useDracoLoader: modelData.options?.useDracoLoader ?? false,
				dracoDecoderPath: modelData.options?.dracoDecoderPath || '/draco/gltf/'
			}
			
			const mesh = await threeCore.loadModel(fullUrl, loadOptions)
			console.log('加载模型模板', mesh)
			
			// 计算包围盒
			const box = new THREE.Box3().setFromObject(mesh)
			const size = box.getSize(new THREE.Vector3())
			const center = box.getCenter(new THREE.Vector3())
			
			// 重置位置和旋转，确保模板模型在原点
			mesh.position.set(0, 0, 0)
			mesh.rotation.set(0, 0, 0)
			
			// 不添加到场景，只缓存
			return {
				mesh,
				modelData,
				size,
				center
			} as CachedModel
		} catch (error) {
			console.error(`加载模型失败: ${modelData.url}`, error)
			return null
		}
	})
	
	const results = await Promise.all(loadPromises)
	cachedModels = results.filter((model): model is CachedModel => model !== null)
	
	console.log('模型加载完成，成功缓存:', cachedModels.length, '个模型模板')
	
	isModelsLoaded = true
	
	// 开始物理模拟
	if (cachedModels.length > 0) {
		startPhysicsSimulation()
		// 启动定期生成模型
		startSpawnTimer()
		// 启动定期清理
		startCleanupTimer()
	}
}

// 克隆并生成模型
const spawnModel = () => {
	if (!threeCore || !ammoInstance || !physicsWorld || cachedModels.length === 0) {
		return
	}
	
	// 随机选择一个缓存的模型
	const randomIndex = Math.floor(Math.random() * cachedModels.length)
	const cachedModel = cachedModels[randomIndex]
	
	try {
		// 克隆模型
		const clonedMesh = cachedModel.mesh.clone()
		
		// 设置 userData
		clonedMesh.userData.name = cachedModel.modelData.name
		clonedMesh.userData.id = cachedModel.modelData.id
		clonedMesh.userData.modelData = cachedModel.modelData
		clonedMesh.userData.ignorePick = false // 允许点击检测
		
		// 随机初始位置（在可视区域内）
		const startX = (Math.random() * 18) - 9
		const startY = SPAWN_HEIGHT_MIN + Math.random() * (SPAWN_HEIGHT_MAX - SPAWN_HEIGHT_MIN)
		const startZ = (Math.random() - 0.5) * visibleRangeZ * 2
		
		// 考虑模型中心偏移
		const adjustedX = startX - cachedModel.center.x
		const adjustedY = startY - cachedModel.center.y
		const adjustedZ = startZ - cachedModel.center.z
		
		// 创建物理刚体
		const halfExtents = new ammoInstance.btVector3(
			Math.max(cachedModel.size.x / 2, 0.1),
			Math.max(cachedModel.size.y / 2, 0.1),
			Math.max(cachedModel.size.z / 2, 0.1)
		)
		const shape = new ammoInstance.btBoxShape(halfExtents)
		shape.setMargin(0.05)
		
		const transform = new ammoInstance.btTransform()
		transform.setIdentity()
		transform.setOrigin(new ammoInstance.btVector3(adjustedX, adjustedY, adjustedZ))
		
		// 添加随机初始旋转
		const eulerX = Math.random() * Math.PI * 2
		const eulerY = Math.random() * Math.PI * 2
		const eulerZ = Math.random() * Math.PI * 2
		
		const threeEuler = new THREE.Euler(eulerX, eulerY, eulerZ, 'XYZ')
		const threeQuat = new THREE.Quaternion()
		threeQuat.setFromEuler(threeEuler)
		
		const quat = new ammoInstance.btQuaternion(
			threeQuat.x,
			threeQuat.y,
			threeQuat.z,
			threeQuat.w
		)
		transform.setRotation(quat)
		
		const motionState = new ammoInstance.btDefaultMotionState(transform)
		const mass = 1
		const localInertia = new ammoInstance.btVector3(0, 0, 0)
		shape.calculateLocalInertia(mass, localInertia)
		
		const rbInfo = new ammoInstance.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia)
		const body = new ammoInstance.btRigidBody(rbInfo)
		
		// 设置物理属性
		body.setFriction(0.8)
		body.setRestitution(0.3)
		body.setDamping(0.1, 0.1)
		body.setActivationState(4) // DISABLE_DEACTIVATION
		
		const initialVelocity = new ammoInstance.btVector3(0, -0.01, 0)
		body.setLinearVelocity(initialVelocity)
		body.activate()
		
		physicsWorld.addRigidBody(body)
		
		// 设置 mesh 位置和旋转
		clonedMesh.position.set(adjustedX + cachedModel.center.x, adjustedY + cachedModel.center.y, adjustedZ + cachedModel.center.z)
		clonedMesh.rotation.set(eulerX, eulerY, eulerZ)
		clonedMesh.castShadow = true
		clonedMesh.receiveShadow = true
		
		threeCore.scene.add(clonedMesh)
		
		// 添加到物理刚体数组
		physicsBodies.push({
			mesh: clonedMesh,
			body,
			userData: cachedModel.modelData
		})
		
		// console.log('生成模型:', cachedModel.modelData.name, '位置:', startX, startY, startZ)
	} catch (error) {
		console.error('生成模型失败:', error)
	}
}

// 启动定期生成定时器
const startSpawnTimer = () => {
	// 清除旧的定时器
	if (spawnTimer) {
		clearInterval(spawnTimer)
	}
	
	spawnTimer = setInterval(() => {
		spawnModel()
	}, SPAWN_INTERVAL)
	
	console.log(`定期生成已启动，每 ${SPAWN_INTERVAL / 1000} 秒生成一个模型`)
}

// 启动定期清理定时器
const startCleanupTimer = () => {
	// 清除旧的定时器
	if (cleanupTimer) {
		clearInterval(cleanupTimer)
	}
	
	cleanupTimer = setInterval(() => {
		cleanupGroundModels()
	}, CLEANUP_INTERVAL)
	
	console.log(`定期清理已启动，每 ${CLEANUP_INTERVAL / 1000} 秒检查一次（超过 ${MAX_MODELS} 个模型会被清理多余部分）`)
}

// 清理多余的模型：每次检查数量，超过 MAX_MODELS 就移除多出的（优先移除最早创建的）
const cleanupGroundModels = () => {
	if (!ammoInstance || !physicsWorld || physicsBodies.length === 0) return
	
	if (physicsBodies.length <= MAX_MODELS) {
		// 数量未超出上限，不处理
		return
	}
	
	// 需要移除的数量
	const removeCount = physicsBodies.length - MAX_MODELS
	
	console.log(`开始清理多余模型，当前数量: ${physicsBodies.length}，需要移除: ${removeCount}`)
	
	// 优先移除最早加入的模型：从数组前面开始删
	for (let i = 0; i < removeCount; i++) {
		// 每次都从索引 0 移除，因为 removePhysicsBody 内部会维护数组
		const physicsBody = physicsBodies[0]
		if (!physicsBody) break
		
		removePhysicsBody(physicsBody, 0)
	}
	
	console.log(`清理完成，剩余模型数量: ${physicsBodies.length}`)
}

// 移除单个物理刚体
const removePhysicsBody = (physicsBody: PhysicsBody, index: number) => {
	if (!ammoInstance || !physicsWorld || !threeCore) return
	
	try {
		// 从物理世界移除
		physicsWorld.removeRigidBody(physicsBody.body)
		
		// 清理 Ammo.js 对象
		if (physicsBody.body.getMotionState) {
			ammoInstance.destroy(physicsBody.body.getMotionState())
		}
		if (physicsBody.body.getCollisionShape) {
			ammoInstance.destroy(physicsBody.body.getCollisionShape())
		}
		ammoInstance.destroy(physicsBody.body)
		
		// 从场景移除
		threeCore.scene.remove(physicsBody.mesh)
		
		// 清理 Three.js 对象
		physicsBody.mesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				if (child.geometry) child.geometry.dispose()
				if (child.material) {
					if (Array.isArray(child.material)) {
						for (const mat of child.material) {
							mat.dispose()
						}
					} else {
						child.material.dispose()
					}
				}
			}
		})
		
		// 从数组中移除
		physicsBodies.splice(index, 1)
	} catch (e) {
		console.warn('移除物理刚体时出错:', e)
	}
}

// 开始物理模拟
let physicsAnimationCallback: (() => void) | null = null
let isPhysicsRunning = false
const startPhysicsSimulation = () => {
	if (!threeCore || !ammoInstance || !isModelsLoaded || !physicsWorld) {
		console.warn('物理模拟启动条件不满足', {
			threeCore: !!threeCore,
			ammoInstance: !!ammoInstance,
			isModelsLoaded,
			physicsWorld: !!physicsWorld
		})
		return
	}
	
	// 如果已经在运行，不重复启动
	if (isPhysicsRunning && physicsAnimationCallback) {
		console.log('物理模拟已在运行中')
		return
	}
	
	let lastTime = performance.now()
	
	// 在动画循环中更新物理
	physicsAnimationCallback = () => {
		if (!physicsWorld || !isModelsLoaded) return
		
		const currentTime = performance.now()
		const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1) // 限制最大时间步长
		lastTime = currentTime
		
		// 更新物理世界 - 使用固定的时间步长确保稳定性
		// 关键：必须传入 fixedTimeStep (1/60)，否则 Bullet 容易第一帧进入 sleep
		if (deltaTime > 0) {
			const fixedTimeStep = 1 / 60 // 60 FPS 固定时间步长
			physicsWorld.stepSimulation(deltaTime, 10, fixedTimeStep)
			
			// 同步 Three.js 对象位置和旋转
			for (const { mesh, body } of physicsBodies) {
				if (!mesh || !body) continue
				
				try {
					// 持续激活刚体，防止进入睡眠状态
					// 虽然已禁用睡眠，但持续调用可以确保刚体保持活跃
					body.activate(true)
					
					const transform = body.getWorldTransform()
					const position = transform.getOrigin()
					const rotation = transform.getRotation()
					
					mesh.position.set(position.x(), position.y(), position.z())
					mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w())
				} catch (e) {
					console.warn('同步物理对象时出错:', e)
				}
			}
		}
	}
	
	// 添加到动画回调
	threeCore.addAnimationCallback(physicsAnimationCallback)
	isPhysicsRunning = true
	
	console.log('物理模拟已启动，刚体数量:', physicsBodies.length)
}

// 动态设置相机位置，使地面始终在屏幕底部，与相机呈30度角
const updateCameraPosition = () => {
	if (!threeCore || !containerRef.value) return
	
	const camera = threeCore.camera as THREE.PerspectiveCamera
	const controls = threeCore.controls
	const container = containerRef.value
	
	// 更新相机宽高比
	const aspect = container.clientWidth / container.clientHeight
	camera.aspect = aspect
	camera.updateProjectionMatrix()
	
	// 将角度转换为弧度
	const angleRad = (CAMERA_ANGLE * Math.PI) / 180
	const fovRad = (camera.fov * Math.PI) / 180
	
	// 设置看向的点（地面中心稍微上方）
	const lookAtY = GROUND_Y + 1
	
	// 计算使地面正好在视野底部所需的距离
	// 视野底部到中心的垂直距离 = distance * tan(fov/2)
	// 我们希望：lookAtY - distance * tan(fov/2) = GROUND_Y
	const verticalFovHalf = Math.tan(fovRad / 2)
	const distanceToLookAt = (lookAtY - GROUND_Y) / verticalFovHalf
	
	// 根据30度角和计算出的距离，确定相机位置
	// 相机与水平面的夹角是30度
	// 相机到lookAt点的距离是distanceToLookAt
	// 垂直距离 = distanceToLookAt * sin(30°)
	// 水平距离 = distanceToLookAt * cos(30°)
	const verticalOffset = distanceToLookAt * Math.sin(angleRad)
	const horizontalDistance = distanceToLookAt * Math.cos(angleRad)
	
	const cameraY = lookAtY + verticalOffset
	
	// 设置相机位置（从斜上方看向场景中心）
	camera.position.set(0, cameraY + 2, horizontalDistance * 16)
	
	// 设置相机看向场景中心（地面中心）
	
	// 更新控制器目标
	if (controls) {
		controls.target.set(0, lookAtY + 2, 0)
		camera.lookAt(controls.target)

		controls.update()
	}
	console.log(camera,controls)
	console.log('相机位置已更新:', {
		position: camera.position,
		角度: `${CAMERA_ANGLE}度`,
		地面Y: GROUND_Y,
		距离: distanceToLookAt.toFixed(2)
	})
	
	// 更新可视区域范围
	updateVisibleRange()
}

// 计算可视区域范围（基于相机视野）
const updateVisibleRange = () => {
	if (!threeCore || !containerRef.value) return
	
	const camera = threeCore.camera as THREE.PerspectiveCamera
	const container = containerRef.value
	
	// 获取相机到地面的距离（在lookAt点）
	const lookAtY = GROUND_Y + 1
	const lookAtPoint = new THREE.Vector3(0, lookAtY, 0)
	const distanceToLookAt = camera.position.distanceTo(lookAtPoint)
	
	// 计算视野范围
	const fovRad = (camera.fov * Math.PI) / 180
	const aspect = container.clientWidth / container.clientHeight
	
	// 垂直视野的一半（弧度）
	const verticalFovHalf = Math.tan(fovRad / 2)
	// 水平视野的一半（弧度）
	const horizontalFovHalf = verticalFovHalf * aspect
	
	// 使用射线投射计算视野在地面的实际投影范围
	const raycaster = new THREE.Raycaster()
	const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)
	
	// 计算视野四个角的方向
	const corners = [
		new THREE.Vector2(-1, -1), // 左下
		new THREE.Vector2(1, -1),  // 右下
		new THREE.Vector2(-1, 1),  // 左上
		new THREE.Vector2(1, 1)    // 右上
	]
	
	let minX = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY
	
	for (const corner of corners) {
		raycaster.setFromCamera(corner, camera)
		const intersection = new THREE.Vector3()
		raycaster.ray.intersectPlane(groundPlane, intersection)
		
		if (intersection) {
			minX = Math.min(minX, intersection.x)
			maxX = Math.max(maxX, intersection.x)
			minZ = Math.min(minZ, intersection.z)
			maxZ = Math.max(maxZ, intersection.z)
		}
	}
	
	// 计算范围（从中心到边缘的距离）
	visibleRangeX = Math.max(Math.abs(minX), Math.abs(maxX))
	// visibleRangeZ = Math.max(Math.abs(minZ), Math.abs(maxZ))
	visibleRangeZ = 0
	
	// 添加一些边距，确保物体在可视区域边缘也能看到
	visibleRangeX *= 1.1
	visibleRangeZ *= 1.1
	
	console.log('可视区域范围已更新:', {
		X: visibleRangeX.toFixed(2),
		Z: visibleRangeZ.toFixed(2),
		距离: distanceToLookAt.toFixed(2)
	})
}

// 处理画布点击
const handleCanvasClick = (event: MouseEvent | TouchEvent) => {
	if (!threeCore) return
	
	// 使用 ThreeCore 的 gpuPick 方法检测点击
	const pickedObject = threeCore.gpuPick(event)
	
	if (pickedObject?.userData?.modelData) {
		// 检测到物体时，阻止事件冒泡和默认行为，避免影响页面
		event.stopPropagation()
		event.preventDefault()
		
		// 通知父组件
		emit('objectClick', pickedObject.userData.modelData)
	}
	// 如果没有检测到物体，事件会穿透，不影响页面交互
}

// 窗口大小改变处理函数
let resizeHandler: (() => void) | null = null
// 全局点击事件处理函数
let globalClickHandler: ((event: MouseEvent | TouchEvent) => void) | null = null

// 初始化 Three.js 场景
const initThreeScene = () => {
	if (!containerRef.value) return
	
	threeCore = new ThreeCore({
		antialias: true,
		alpha: true,
		clearColor: 0x000000,
		cameraType: 'perspective',
		cameraPosition: { x: 5, y: -5, z: 30 },
		enableOrbitControls: true,
		enableStats: false
	})
	
	threeCore.mount(containerRef.value)
	
	// 动态设置相机位置（30度角，地面在底部）
	updateCameraPosition()
	
	// 固定控制器 - 禁用交互
	threeCore.controls.enabled = true
	
	// 设置 canvas 不拦截事件
	const canvas = threeCore.renderer.domElement
	canvas.style.pointerEvents = 'none'
	
	// 创建全局点击事件处理函数，检查点击是否在 canvas 区域内
	globalClickHandler = (event: MouseEvent | TouchEvent) => {
		if (!threeCore || !canvas) return
		
		// 获取点击位置
		let clientX: number
		let clientY: number
		
		if ('touches' in event) {
			if (event.touches.length === 0 && 'changedTouches' in event) {
				// touchend 事件使用 changedTouches
				clientX = event.changedTouches[0].clientX
				clientY = event.changedTouches[0].clientY
			} else {
				clientX = event.touches[0].clientX
				clientY = event.touches[0].clientY
			}
		} else {
			clientX = event.clientX
			clientY = event.clientY
		}
		
		// 检查点击位置是否在 canvas 区域内
		const rect = canvas.getBoundingClientRect()
		const isInsideCanvas = 
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom
		
		// 如果点击在 canvas 区域内，处理点击事件
		if (isInsideCanvas) {
			handleCanvasClick(event)
		}
	}
	
	// 在全局添加点击事件监听（鼠标和触摸）
	window.addEventListener('click', globalClickHandler as EventListener, true)
	window.addEventListener('touchend', globalClickHandler as EventListener, true)
	
	// 启动动画循环
	threeCore.startAnimationLoop()
	
	// 监听窗口大小改变，动态调整相机
	resizeHandler = () => {
		if (threeCore && containerRef.value) {
			updateCameraPosition()
		}
	}
	window.addEventListener('resize', resizeHandler)
	
	// 初始化 Ammo.js
	initAmmo().then(() => {
		console.log('Ammo.js 初始化完成，准备加载模型')
		// 如果有待加载的模型，加载它们
		if (modelsToLoad.length > 0) {
			loadModels(modelsToLoad)
			modelsToLoad = []
		} else if (props.models && props.models.length > 0) {
			loadModels(props.models)
		}
	}).catch((error) => {
		console.error('初始化物理引擎失败:', error)
	})
}

// 暴露加载模型方法
const loadModelData = (models: ModelData[]) => {
	if (isModelsLoaded) {
		// 如果已经加载过，先清理
		cleanupPhysicsBodies()
	}
	loadModels(models)
}

// 清理物理刚体
const cleanupPhysicsBodies = () => {
	// 停止生成定时器
	if (spawnTimer) {
		clearInterval(spawnTimer)
		spawnTimer = null
	}
	
	// 停止清理定时器
	if (cleanupTimer) {
		clearInterval(cleanupTimer)
		cleanupTimer = null
	}
	
	if (!ammoInstance || !physicsWorld) return
	
	// 使用倒序移除，避免索引问题
	for (let i = physicsBodies.length - 1; i >= 0; i--) {
		const physicsBody = physicsBodies[i]
		removePhysicsBody(physicsBody, i)
	}
	
	physicsBodies = []
	cachedModels = []
	isModelsLoaded = false
	isPhysicsRunning = false
	physicsAnimationCallback = null
}

// 暴露方法给父组件
defineExpose({
	loadModelData
})

onMounted(() => {
	initThreeScene()
})

onBeforeUnmount(() => {
	cleanupPhysicsBodies()
	
	// 移除窗口大小改变监听器
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler)
		resizeHandler = null
	}
	
	// 移除全局点击事件监听器
	if (globalClickHandler) {
		window.removeEventListener('click', globalClickHandler as EventListener, true)
		window.removeEventListener('touchend', globalClickHandler as EventListener, true)
		globalClickHandler = null
	}
	
	// 清理 Three.js
	if (threeCore) {
		threeCore.dispose()
		threeCore = null
	}
	
	physicsWorld = null
	ammoInstance = null
})
</script>

<style scoped>
.physics-drop-container {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	z-index: 10;
	pointer-events: none; /* 容器不拦截事件，让事件穿透到页面 */
	overflow: hidden;
	touch-action: none; /* 防止移动端默认手势 */
}

.physics-drop-container :deep(canvas) {
	display: block;
	width: 100%;
	height: 100%;
	cursor: pointer;
	pointer-events: auto; /* canvas 可以接收事件 */
}
</style>

