import type { Object3D } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BASE_IMG } from '@/utils/ipConfig'
import type { SceneJSON, SceneObjectJSON } from '@/utils/threeCore'

/** A-Frame `mindar-image` 组件属性值 */
export function buildMindarImageAttr(mindUrl: string): string {
	return `imageTargetSrc: ${mindUrl};`
}

/** A-Frame `mindar-image-target` 组件属性值 */
export function buildMindarImageTargetAttr(targetIndex: number): string {
	return `targetIndex: ${targetIndex}`
}

type AframeMount = HTMLElement & {
	setObject3D?: (name: string, object: Object3D) => void
}

export function getAframeTHREE(): typeof import('three') | null {
	if (typeof window === 'undefined') return null
	const t = (
		window as unknown as {
			readonly THREE?: typeof import('three')
		}
	).THREE
	return t ?? null
}

/** 仅在识别图上调节球时使用 */
export interface MindarCustomSphereOptions {
	radius?: number
	color?: number | string
	position?: readonly [number, number, number]
}

/** 球 + `json_data.objects` 合并挂载的配置 */
export interface MindarSphereAndSceneOptions {
	/** MeshBasic，不依赖灯光；`false` 为只挂场景物体 */
	sphere?: MindarCustomSphereOptions | false
	baseImgPrefix?: string
}

function addLightsForScene(THREE: typeof import('three'), group: import('three').Group) {
	const amb = new THREE.AmbientLight(0xffffff, 1.05)
	const dir = new THREE.DirectionalLight(0xffffff, 0.85)
	dir.position.set(0.2, 2, 2)
	group.add(amb)
	group.add(dir)
}

function addSphereMeshToGroup(
	THREE: typeof import('three'),
	group: import('three').Group,
	options: MindarCustomSphereOptions
) {
	const r = options.radius ?? 0.1
	const geom = new THREE.SphereGeometry(r, 24, 24)
	const col =
		options.color !== undefined
			? new THREE.Color(options.color as number | string)
			: new THREE.Color(0xff3355)
	const mat = new THREE.MeshBasicMaterial({
		color: col,
		depthTest: true
	})
	const mesh = new THREE.Mesh(geom, mat)
	mesh.frustumCulled = false
	const p = options.position ?? ([0, 0.06, 0.16] as const)
	mesh.position.set(p[0], p[1], p[2])
	group.add(mesh)
}

/**
 * 从编辑器场景 JSON 解析物体到 Group（不含灯、不含球）。
 * 支持类型与早前版本一致 subset：box / sphere / character|model+gltf / image
 */
type ThreeWithLoaders = NonNullable<ReturnType<typeof getAframeTHREE>>

async function parseSceneObjectForMindar(
	obj: SceneObjectJSON,
	parentGroup: import('three').Group,
	THREE: ThreeWithLoaders,
	baseImgPrefix: string
): Promise<boolean> {
	const T = THREE as typeof THREE & {
		GLTFLoader?: new () => {
			load: (
				url: string,
				onLoad: (gltf: { scene: Object3D }) => void,
				onProgress?: unknown,
				onError?: (err: unknown) => void
			) => void
			setDRACOLoader?: (l: unknown) => void
		}
		DRACOLoader?: new () => { setDecoderPath: (p: string) => unknown }
	}
	const position = (obj.position as number[] | undefined) || [0, 0, 0]
	const rotation = (obj.rotation as number[] | undefined) || [0, 0, 0]
	const scale = (obj.scale as number[] | undefined) || [1, 1, 1]
	const type = obj.type
	let mesh: import('three').Object3D | null = null

	try {
		if (type === 'box') {
			const size = (obj.size as number[] | undefined) || [1, 1, 1]
			const geometry = new THREE.BoxGeometry(...size)
			const material = new THREE.MeshStandardMaterial({
				color: (obj.color as string) || '#ffffff'
			})
			mesh = new THREE.Mesh(geometry, material)
		} else if (type === 'sphere') {
			const radius = (obj.radius as number) || 1
			const geometry = new THREE.SphereGeometry(radius, 32, 32)
			const material = new THREE.MeshStandardMaterial({
				color: (obj.color as string) || '#ffffff'
			})
			mesh = new THREE.Mesh(geometry, material)
		} else if (obj.url && (type === 'model' || type === 'character')) {
			if (!T.GLTFLoader) {
				console.warn('THREE.GLTFLoader is missing.')
				return false
			}
			const loader = new T.GLTFLoader()
			if (obj.useDracoLoader && T.DRACOLoader) {
				const dracoLoader = new T.DRACOLoader()
				dracoLoader.setDecoderPath(
					obj.dracoDecoderPath ||
						'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
				)
				loader.setDRACOLoader?.(dracoLoader)
			}
			const fullUrl = baseImgPrefix + String(obj.url)
			const gltf = await new Promise<{ scene: import('three').Object3D }>(
				(resolve, reject) => {
					loader.load(fullUrl, resolve, undefined, reject)
				}
			)
			mesh = gltf.scene
			const matOpt = obj.options as
				| { material?: { color?: string } }
				| undefined
			const colorHex = matOpt?.material?.color
			if (colorHex && mesh) {
				mesh.traverse(child => {
					if ('isMesh' in child && child.isMesh && 'material' in child) {
						const mat = child.material as import('three').MeshStandardMaterial
						if (mat?.color) mat.color.set(colorHex)
					}
				})
			}
		} else if (type === 'image' && obj.url) {
			const textureLoader = new THREE.TextureLoader()
			const fullUrl = baseImgPrefix + String(obj.url)
			const texture = await new Promise<import('three').Texture>((resolve, reject) => {
				textureLoader.load(fullUrl, resolve, undefined, reject)
			})
			texture.colorSpace = THREE.SRGBColorSpace
			const img = texture.image as HTMLImageElement
			const baseWidth = (obj.baseWidth as number) || 1
			const aspect = img.height / img.width
			const geometry = new THREE.PlaneGeometry(baseWidth, baseWidth * aspect)
			const material = new THREE.MeshBasicMaterial({
				map: texture,
				transparent: true,
				side: THREE.DoubleSide
			})
			mesh = new THREE.Mesh(geometry, material)
		}

		if (mesh) {
			mesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0)
			mesh.rotation.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0)
			mesh.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1)
			parentGroup.add(mesh)
			return true
		}
	} catch (e) {
		console.warn(`MindAR scene object failed type=${type}:`, e)
	}
	return false
}

/** 额外挂在识别图上的 glTF/glB（与球共用锚点）；`url` 可为完整 https 或相对（拼 `baseImgPrefix`） */
export interface MindarExtraGltfItem {
	url: string
	position?: readonly [number, number, number]
	rotation?: readonly [number, number, number]
	/** 统一缩放或与轴对齐缩放 */
	scale?: number | readonly [number, number, number]
	useDracoLoader?: boolean
	dracoDecoderPath?: string
}

export interface MindarSphereAndExtrasOptions {
	sphere?: MindarCustomSphereOptions
	extras?: MindarExtraGltfItem[]
	baseImgPrefix?: string
}

export type MindarSphereAndExtrasResult =
	| {
			ok: true
			/** 占位球已成功，但有附加模型未挂上或加载异常 */
			partialWarning?: string
	  }
	| { ok: false; error: string }

function resolveMindarAssetUrl(base: string, url: string): string {
	const u = url.trim()
	if (/^https?:\/\//i.test(u)) return u
	return base + u
}

/**
 * 识别图上同时挂：MeshBasic 球 + 可选若干 GLB/glTF。
 * 根 Group / 球 / 灯光必须使用 A-Frame 注入的 `window.THREE`（与 `attachCustomSphereToMindarMount`
 * 一致）；若用 Vite 打包的另一份 `three` 建网格，会导致整组无法在 MindAR 画面里渲染。
 * GLB 使用项目依赖的 `three/examples/jsm` 中静态 import 的 `GLTFLoader`（与仓库其它用法一致）。
 */
export async function attachMindarSphereAndExtras(
	mountEl: AframeMount | null,
	options?: MindarSphereAndExtrasOptions
): Promise<MindarSphereAndExtrasResult> {
	if (!mountEl || typeof mountEl.setObject3D !== 'function') {
		return { ok: false, error: '无效的挂载实体（缺少 setObject3D）' }
	}
	if (typeof window === 'undefined') {
		return { ok: false, error: '仅客户端可挂载' }
	}

	const W = getAframeTHREE()
	if (!W) {
		return { ok: false, error: 'THREE not found（请等待 A-Frame 加载完成）' }
	}

	const base = options?.baseImgPrefix ?? BASE_IMG
	const sphereOpts = options?.sphere ?? {}
	const extras = options?.extras?.filter(e => e?.url?.trim()) ?? []

	const group = new W.Group()
	group.name = 'mindarSphereAndExtras'

	if (extras.length > 0) {
		addLightsForScene(W, group)
	}

	addSphereMeshToGroup(W, group, sphereOpts)

	let gltfOk = 0
	const failedLoads: string[] = []
	for (const item of extras) {
		const fullUrl = resolveMindarAssetUrl(base, item.url)
		try {
			const loader = new GLTFLoader()
			if (item.useDracoLoader) {
				const draco = new DRACOLoader()
				draco.setDecoderPath(
					item.dracoDecoderPath ||
						'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
				)
				loader.setDRACOLoader(draco)
			}
			const gltf = await loader.loadAsync(fullUrl)
			const root = gltf.scene
			root.name = 'mindarExtraGltf'
			const p = item.position ?? [0, 0, 0]
			root.position.set(p[0], p[1], p[2])
			const r = item.rotation ?? [0, 0, 0]
			root.rotation.set(r[0], r[1], r[2])
			const s = item.scale
			if (typeof s === 'number') {
				root.scale.set(s, s, s)
			} else if (s) {
				root.scale.set(s[0], s[1], s[2])
			} else {
				root.scale.set(1, 1, 1)
			}
			group.add(root)
			gltfOk++
		} catch (e) {
			const hint =
				e instanceof Error ? (e.message || e.name || 'Error') : String(e)
			failedLoads.push(`${fullUrl}\n  → ${hint}`)
			console.warn(`[MindAR] 额外模型加载失败 ${fullUrl}`, e)
		}
	}

	let partialWarning: string | undefined
	if (extras.length > 0 && failedLoads.length > 0) {
		const head =
			gltfOk === 0
				? `共有 ${extras.length} 个额外模型均未挂载成功。占位球与灯光仍会显示。\n（请核对 URL / CORS / 网络）\n\n`
				: `成功 ${gltfOk}/${extras.length}；下列项未挂载：\n\n`
		partialWarning = head + failedLoads.join('\n\n')
		console.warn('[MindAR]', partialWarning)
	}

	group.visible = true
	mountEl.setObject3D('mesh', group)
	const rootObj = (mountEl as unknown as { object3D?: Object3D }).object3D
	if (rootObj) rootObj.visible = true
	return partialWarning !== undefined
		? { ok: true, partialWarning }
		: { ok: true }
}

/** 仅挂识别图上的自定义球（无灯光、无 GLB，同步） */
export function attachCustomSphereToMindarMount(
	mountEl: AframeMount | null,
	options?: MindarCustomSphereOptions
): { ok: true } | { ok: false; error: string } {
	const THREE = getAframeTHREE()
	if (!THREE) {
		return { ok: false, error: 'THREE not found（请等待 A-Frame 加载完成）' }
	}
	if (!mountEl || typeof mountEl.setObject3D !== 'function') {
		return { ok: false, error: '无效的挂载实体（缺少 setObject3D）' }
	}
	const group = new THREE.Group()
	group.name = 'mindarCustomSphere'
	group.visible = true
	addSphereMeshToGroup(THREE, group, options ?? {})
	mountEl.setObject3D('mesh', group)
	const rootObj = (mountEl as unknown as { object3D?: Object3D }).object3D
	if (rootObj) rootObj.visible = true
	return { ok: true }
}

/**
 * 将球与 `scene.json_data` 一并挂到 MindAR 锚点（同一 THREE.Group）。
 */
export async function attachMindarSphereAndSceneJSON(
	mountEl: AframeMount | null,
	jsonData: SceneJSON | null | undefined,
	options?: MindarSphereAndSceneOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
	const THREE = getAframeTHREE()
	if (!THREE) {
		return { ok: false, error: 'THREE not found（请等待 A-Frame 加载完成）' }
	}
	if (!mountEl || typeof mountEl.setObject3D !== 'function') {
		return { ok: false, error: '无效的挂载实体（缺少 setObject3D）' }
	}

	const objects = jsonData?.objects ?? []
	if (!jsonData || !Array.isArray(jsonData.objects)) {
		return { ok: false, error: '缺少合法的 json_data.objects' }
	}

	const base = options?.baseImgPrefix ?? BASE_IMG
	const sphereOpt = options?.sphere
	const sphereConfig: MindarCustomSphereOptions | null =
		sphereOpt === false
			? null
			: sphereOpt !== undefined
				? { ...sphereOpt }
				: ({} satisfies MindarCustomSphereOptions)

	const group = new THREE.Group()
	group.name = 'mindarSphereAndScene'

	addLightsForScene(THREE, group)

	if (sphereConfig) {
		addSphereMeshToGroup(THREE, group, sphereConfig)
	}

	let parsedAny = false
	for (const obj of objects) {
		const ok = await parseSceneObjectForMindar(obj, group, THREE, base)
		if (ok) parsedAny = true
	}

	if (objects.length > 0 && !parsedAny) {
		const msg =
			'场景物体均未能渲染（MindAR 子集支持：box / sphere / image / character、model+gltf；不支持 splat/template 等需另外接入）'
		if (!sphereConfig) {
			return { ok: false, error: msg }
		}
		console.warn(`[MindAR] ${msg}；已仅显示测试球`)
	}

	if (objects.length === 0 && !sphereConfig && group.children.length <= 2) {
		return { ok: false, error: '无场景物体且 sphere: false' }
	}

	group.visible = true
	mountEl.setObject3D('mesh', group)
	const rootObj = (mountEl as unknown as { object3D?: Object3D }).object3D
	if (rootObj) rootObj.visible = true
	return { ok: true }
}


export function waitForMindarAnchorReady(
	selector = '#mindar-scene-mount',
	timeoutMs = 15000
): Promise<AframeMount | null> {
	return new Promise(resolve => {
		let done = false
		const finish = (el: AframeMount | null) => {
			if (done) return
			done = true
			clearInterval(iv)
			clearTimeout(to)
			resolve(el)
		}
		const iv = setInterval(() => {
			const el = document.querySelector(selector) as AframeMount | null
			if (el && typeof el.setObject3D === 'function') finish(el)
		}, 50)
		const to = setTimeout(() => finish(null), timeoutMs)
	})
}

export function waitForASceneLoaded(timeoutMs = 10000): Promise<HTMLElement | null> {
	return new Promise(resolve => {
		let listenerAttachedTo: HTMLElement | null = null

		const done = (el: HTMLElement | null) => {
			clearInterval(iv)
			clearTimeout(to)
			resolve(el)
		}

		const iv = setInterval(() => {
			const sceneEl = document.querySelector('a-scene') as HTMLElement | null
			if (!sceneEl) return

			if ((sceneEl as { hasLoaded?: boolean }).hasLoaded) {
				done(sceneEl)
				return
			}

			if (listenerAttachedTo !== sceneEl) {
				listenerAttachedTo = sceneEl
				sceneEl.addEventListener(
					'loaded',
					() => {
						done(sceneEl)
					},
					{ once: true }
				)
			}
		}, 100)

		const to = setTimeout(() => {
			clearInterval(iv)
			resolve(null)
		}, timeoutMs)
	})
}
