import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type ThreeCore from '@/utils/threeCore'

/**
 * 场景详情渲染：柔和日光棚拍风
 * - 干净中性光色（告别旧版粉调电影光）
 * - 3/4 主光 + 冷补光塑造体积
 * - PCFSoft 接触阴影，IBL 只补材质反射
 * 不改动 scene.background（由页面 DOM / 用户背景控制）
 */

/** 默认场景光：柔和日光棚拍 */
export const SCENE_AAA_LIGHT = {
	ambient: 0.2,
	hemi: 0.38,
	key: 1.05,
	fill: 0.26,
	lens: 0.07,
	/** 3/4 前侧高位主光，利于衣物/模型塑形 */
	azimuth: 36,
	elevation: 54,
	/** 补光方位：主光对侧、略低 */
	fillAzimuth: 216,
	fillElevation: 28,
	/** 方向光距原点；兼顾阴影相机精度 */
	lightRadius: 55,
	fillRadius: 42,
	exposure: 0.88,
	exposureSplat: 0.96,
	bloomStrength: 0.07,
	bloomRadius: 0.32,
	bloomThreshold: 0.97,
	envIntensity: 0.34,
	envIntensitySplat: 0.18
} as const

/** 中性日光棚拍色温（默认预设 / tuneLights 共用） */
export const SCENE_AAA_LIGHT_COLORS = {
	ambient: 0xf5f2ed,
	hemiSky: 0xd4e4f2,
	hemiGround: 0x3d342c,
	key: 0xfff4e6,
	fill: 0xa8bcdc,
	lens: 0xfffaf4
} as const

export interface SceneRenderHandles {
	envRT: THREE.WebGLRenderTarget | null
}

/** 与 ThreeCore.setMainLightPosition 同一球坐标约定 */
export function sceneLightPositionFromAngles(
	azimuth: number,
	elevation: number,
	radius: number
): [number, number, number] {
	const theta = (azimuth * Math.PI) / 180
	const phi = (elevation * Math.PI) / 180
	return [
		radius * Math.cos(phi) * Math.sin(theta),
		radius * Math.sin(phi),
		radius * Math.cos(phi) * Math.cos(theta)
	]
}

/** 按方位角放置方向光 */
function placeDirectionalFromAngles(
	light: THREE.DirectionalLight,
	azimuth: number,
	elevation: number,
	radius: number
) {
	const [x, y, z] = sceneLightPositionFromAngles(azimuth, elevation, radius)
	light.position.set(x, y, z)
	light.target.position.set(0, 0, 0)
	light.target.updateMatrixWorld()
	light.lookAt(0, 0, 0)
}

/** Standard/Physical：只同步环境反射强度（不压粗糙度，避免高光过亮） */
export function polishSceneMaterials(
	root: THREE.Object3D,
	envIntensity: number
) {
	root.traverse(obj => {
		if (!(obj instanceof THREE.Mesh)) return
		const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
		for (const mat of mats) {
			if (
				(mat instanceof THREE.MeshStandardMaterial
					|| mat instanceof THREE.MeshPhysicalMaterial)
				&& !mat.userData?.ezTreePart
			) {
				mat.envMapIntensity = envIntensity
				mat.needsUpdate = true
			}
		}
	})
}

/** 新加入物体时同步环境反射强度（不改粗糙度，避免反复压暗） */
export function syncObjectEnvIntensity(
	root: THREE.Object3D,
	envIntensity: number
) {
	if (root.userData?.type === 'eztree') return
	root.traverse(obj => {
		if (!(obj instanceof THREE.Mesh)) return
		const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
		for (const mat of mats) {
			if (
				(mat instanceof THREE.MeshStandardMaterial
					|| mat instanceof THREE.MeshPhysicalMaterial)
				&& !mat.userData?.ezTreePart
			) {
				mat.envMapIntensity = envIntensity
				mat.needsUpdate = true
			}
		}
	})
}

export function createSceneIBL(
	core: ThreeCore
): THREE.WebGLRenderTarget | null {
	if (core.rendererBackend !== 'webgl') return null
	try {
		const gl = core.getWebGLRenderer()
		const pmrem = new THREE.PMREMGenerator(gl)
		pmrem.compileEquirectangularShader()
		const room = new RoomEnvironment()
		const rt = pmrem.fromScene(room, 0.04)
		room.dispose()
		pmrem.dispose()
		return rt
	} catch (e) {
		console.warn('[scene] IBL 环境生成失败', e)
		return null
	}
}

/**
 * 收紧主光阴影相机与 bias：柔边接触阴影，减少 peter-panning / 条纹
 */
export function tuneSceneContactShadows(
	light: THREE.DirectionalLight | undefined,
	mobile: boolean
) {
	if (!light?.castShadow) return

	light.shadow.bias = mobile ? -0.00055 : -0.00028
	light.shadow.normalBias = mobile ? 0.018 : 0.009
	light.shadow.radius = mobile ? 2.2 : 3.2
	light.shadow.blurSamples = mobile ? 8 : 16

	const cam = light.shadow.camera as THREE.OrthographicCamera
	const half = mobile ? 14 : 18
	cam.near = 1
	cam.far = 110
	cam.left = -half
	cam.right = half
	cam.top = half
	cam.bottom = -half
	cam.updateProjectionMatrix()

	const shadowMap = light.shadow.map
	if (shadowMap) {
		shadowMap.dispose()
		light.shadow.map = null
	}
}

/**
 * 应用场景默认渲染管线。
 * @param tuneLights 无存档灯光时为 true，写入棚拍光色 / 强度 / 方位
 */
export function applySceneAaaRender(
	core: ThreeCore,
	opts: {
		withSplats: boolean
		mobile: boolean
		tuneLights: boolean
		handles: SceneRenderHandles
	}
): SceneRenderHandles {
	const { withSplats, mobile, tuneLights } = opts
	const handles = opts.handles
	const L = SCENE_AAA_LIGHT

	// 存档灯光多为旧版高环境光，IBL/曝光需再压一档避免叠曝
	const envScale = tuneLights ? 1 : 0.35
	const exposureScale = tuneLights ? 1 : 0.62

	if (!handles.envRT) {
		handles.envRT = createSceneIBL(core)
	}
	if (handles.envRT) {
		core.scene.environment = handles.envRT.texture
		core.envMap = handles.envRT.texture
		const envI =
			(withSplats ? L.envIntensitySplat : L.envIntensity) * envScale
		core.envMapIntensity = envI
		core.setEnvironmentIntensity(envI)
	}

	if (tuneLights && core.lights) {
		const { ambient, hemisphere, directional, fill } = core.lights
		const C = SCENE_AAA_LIGHT_COLORS

		ambient.color.setHex(C.ambient)
		ambient.intensity = L.ambient

		if (hemisphere) {
			hemisphere.color.setHex(C.hemiSky)
			hemisphere.groundColor.setHex(C.hemiGround)
			hemisphere.intensity = L.hemi
			hemisphere.position.set(0, 12, 0)
		}

		directional.color.setHex(C.key)
		directional.intensity = L.key
		directional.castShadow = true
		if (!directional.target.parent) {
			core.scene.add(directional.target)
		}
		placeDirectionalFromAngles(
			directional,
			L.azimuth,
			L.elevation,
			L.lightRadius
		)

		if (fill) {
			fill.color.setHex(C.fill)
			fill.intensity = L.fill
			fill.castShadow = false
			if (!fill.target.parent) {
				core.scene.add(fill.target)
			}
			placeDirectionalFromAngles(
				fill,
				L.fillAzimuth,
				L.fillElevation,
				L.fillRadius
			)
		}
	}

	if (tuneLights && core.lensLight) {
		core.lensLight.color.setHex(SCENE_AAA_LIGHT_COLORS.lens)
		core.lensLight.intensity = L.lens
		core.lensLight.distance = 22
		core.lensLight.decay = 2
		core.lensLight.castShadow = false
	}

	// VSM 近距光渗会导致物体贴太近时阴影消失；场景改用 PCFSoft 保接触阴影
	core.setShadowMapType(THREE.PCFSoftShadowMap)
	core.setShadowQuality(mobile ? 'medium' : 'high')
	tuneSceneContactShadows(core.lights?.directional, mobile)
	core.setShadowMapEnabled(true)

	core.syncSceneColorSpaces()
	const baseExposure = withSplats ? L.exposureSplat : L.exposure
	core.setToneMapping(
		baseExposure * exposureScale,
		THREE.ACESFilmicToneMapping
	)

	if (withSplats) {
		core.toggleBloom(false)
	} else {
		core.toggleBloom(true)
		core.setBloomParams(
			mobile ? L.bloomStrength * 0.65 : L.bloomStrength,
			L.bloomRadius,
			L.bloomThreshold
		)
	}

	const envI =
		(withSplats ? L.envIntensitySplat : L.envIntensity) * envScale
	polishSceneMaterials(core.scene, envI)

	return handles
}

export function disposeSceneRenderHandles(handles: SceneRenderHandles) {
	if (handles.envRT) {
		handles.envRT.dispose()
		handles.envRT = null
	}
}
