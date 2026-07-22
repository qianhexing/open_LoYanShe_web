import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type ThreeCore from '@/utils/threeCore'

/**
 * 场景详情 3A 渲染：IBL / 电影色调 / 阴影 / 轻 Bloom / 材质环境反射
 * 不改动 scene.background（由页面 DOM / 用户背景控制）
 */

/**
 * 对齐云展馆光色/比例，整体再压一档：
 * 场景页背景更亮、素材 albedo 更高，同档数值易过曝。
 */
export const SCENE_AAA_LIGHT = {
	ambient: 0.08,
	hemi: 0.2,
	key: 0.58,
	fill: 0.12,
	lens: 0.04,
	exposure: 0.7,
	exposureSplat: 0.78,
	bloomStrength: 0.12,
	bloomRadius: 0.28,
	bloomThreshold: 0.94,
	envIntensity: 0.26,
	envIntensitySplat: 0.14
} as const

export interface SceneRenderHandles {
	envRT: THREE.WebGLRenderTarget | null
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
 * 应用 3A 渲染管线。
 * @param tuneLights 无存档灯光时为 true，写入电影光色与强度
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

		// 光色对齐云展馆
		ambient.color.setHex(0xfff5f8)
		ambient.intensity = L.ambient

		if (hemisphere) {
			hemisphere.color.setHex(0xffdce8)
			hemisphere.groundColor.setHex(0x3a2830)
			hemisphere.intensity = L.hemi
		}

		directional.color.setHex(0xfff2e6)
		directional.intensity = L.key
		directional.castShadow = true
		if (!directional.target.parent) {
			core.scene.add(directional.target)
		}

		if (fill) {
			fill.color.setHex(0xa8b8e0)
			fill.intensity = L.fill
			fill.castShadow = false
		}
	}

	if (tuneLights && core.lensLight) {
		core.lensLight.color.setHex(0xfff8f5)
		core.lensLight.intensity = L.lens
		core.lensLight.distance = 18
		core.lensLight.decay = 2
		core.lensLight.castShadow = false
	}

	core.setShadowQuality(mobile ? 'medium' : 'high')
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
			mobile ? L.bloomStrength * 0.7 : L.bloomStrength,
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
