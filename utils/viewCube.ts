import * as THREE from 'three'
import TWEEN from '@tweenjs/tween.js'
import type ThreeCore from '@/utils/threeCore'

export type ViewCubeFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

const FACE_LABELS: Record<ViewCubeFace, string> = {
	front: '前',
	back: '后',
	left: '左',
	right: '右',
	top: '上',
	bottom: '下'
}

/** BoxGeometry 材质索引 → 相机应移动到的方向（世界 +X/+Y/+Z 轴） */
const FACE_DIRECTIONS: THREE.Vector3[] = [
	new THREE.Vector3(1, 0, 0), // right +x
	new THREE.Vector3(-1, 0, 0), // left
	new THREE.Vector3(0, 1, 0), // top
	new THREE.Vector3(0, -1, 0), // bottom
	new THREE.Vector3(0, 0, 1), // front +z
	new THREE.Vector3(0, 0, -1) // back
]

const FACE_NAMES: ViewCubeFace[] = [
	'right',
	'left',
	'top',
	'bottom',
	'front',
	'back'
]

const FACE_COLORS = [
	'#e57373',
	'#ef5350',
	'#81c784',
	'#66bb6a',
	'#64b5f6',
	'#42a5f5'
] as const

function createFaceTexture(label: string, bg: string): THREE.CanvasTexture {
	const size = 128
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		return new THREE.CanvasTexture(canvas)
	}

	ctx.fillStyle = bg
	ctx.fillRect(0, 0, size, size)

	const gradient = ctx.createLinearGradient(0, 0, size, size)
	gradient.addColorStop(0, 'rgba(255,255,255,0.25)')
	gradient.addColorStop(1, 'rgba(0,0,0,0.12)')
	ctx.fillStyle = gradient
	ctx.fillRect(0, 0, size, size)

	ctx.strokeStyle = 'rgba(255,255,255,0.55)'
	ctx.lineWidth = 3
	ctx.strokeRect(1.5, 1.5, size - 3, size - 3)

	ctx.fillStyle = '#ffffff'
	ctx.font = 'bold 52px sans-serif'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.fillText(label, size / 2, size / 2)

	const tex = new THREE.CanvasTexture(canvas)
	tex.needsUpdate = true
	return tex
}

export function lookAtViewDirection(
	core: ThreeCore,
	direction: THREE.Vector3,
	duration = 450
) {
	if (!core.controls || !core.camera) return

	TWEEN.removeAll()
	const target = core.controls.target.clone()
	const currentDist = core.camera.position.distanceTo(target)
	const dist = currentDist > 0.001 ? currentDist : 10
	const dir = direction.clone().normalize()
	const position = target.clone().add(dir.multiplyScalar(dist))

	core.lookAtCameraState(
		{
			position,
			target,
			fov:
				(core.camera as THREE.PerspectiveCamera).isPerspectiveCamera
					? (core.camera as THREE.PerspectiveCamera).fov
					: undefined
		},
		duration
	)
}

export class ViewCube {
	private core: ThreeCore
	private container: HTMLElement
	private canvas: HTMLCanvasElement
	private renderer: THREE.WebGLRenderer
	private scene: THREE.Scene
	private camera: THREE.OrthographicCamera
	private cube: THREE.Mesh
	private raycaster = new THREE.Raycaster()
	private pointer = new THREE.Vector2()
	private updateCallback: () => void
	private hoveredIndex = -1
	private readonly size = 112
	private readonly onPointerMoveBound: (event: PointerEvent) => void
	private readonly onPointerLeaveBound: () => void
	private readonly onClickBound: (event: MouseEvent) => void

	constructor(core: ThreeCore, mountEl: HTMLElement) {
		this.core = core
		this.onPointerMoveBound = (event) => this.onPointerMove(event)
		this.onPointerLeaveBound = () => this.onPointerLeave()
		this.onClickBound = (event) => this.onClick(event)

		this.container = document.createElement('div')
		this.container.className = 'scene-view-cube-host'
		this.container.style.cssText =
			'position:absolute;left:12px;bottom:12px;width:112px;height:112px;z-index:15;pointer-events:auto;'
		mountEl.style.position = mountEl.style.position || 'relative'
		mountEl.appendChild(this.container)

		this.canvas = document.createElement('canvas')
		this.canvas.style.cssText =
			'display:block;width:100%;height:100%;cursor:pointer;'
		this.container.appendChild(this.canvas)

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true
		})
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.renderer.setSize(this.size, this.size, false)
		this.renderer.setClearColor(0x000000, 0)

		this.scene = new THREE.Scene()
		this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10)
		this.camera.position.set(0, 0, 5)

		const materials = FACE_NAMES.map((name, i) =>
			new THREE.MeshBasicMaterial({
				map: createFaceTexture(FACE_LABELS[name], FACE_COLORS[i]),
				transparent: true,
				opacity: 0.92
			})
		)

		const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6)
		this.cube = new THREE.Mesh(geometry, materials)
		this.scene.add(this.cube)

		const edges = new THREE.EdgesGeometry(geometry)
		const edgeLines = new THREE.LineSegments(
			edges,
			new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
		)
		this.cube.add(edgeLines)

		this.updateCallback = () => this.update()
		this.core.addAnimationCallback(this.updateCallback)

		this.canvas.addEventListener('pointermove', this.onPointerMoveBound)
		this.canvas.addEventListener('pointerleave', this.onPointerLeaveBound)
		this.canvas.addEventListener('click', this.onClickBound)
	}

	private update() {
		if (!this.core.camera) return

		this.cube.quaternion.copy(this.core.camera.quaternion).conjugate()
		this.renderer.render(this.scene, this.camera)
	}

	private onPointerMove(event: PointerEvent) {
		const rect = this.canvas.getBoundingClientRect()
		this.pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		)

		this.raycaster.setFromCamera(this.pointer, this.camera)
		const hits = this.raycaster.intersectObject(this.cube, false)
		const nextIndex =
			hits.length > 0 && hits[0].face
				? hits[0].face.materialIndex
				: -1

		if (nextIndex !== this.hoveredIndex) {
			this.hoveredIndex = nextIndex
			const mats = this.cube.material
			if (Array.isArray(mats)) {
				for (let i = 0; i < mats.length; i++) {
					const mat = mats[i] as THREE.MeshBasicMaterial
					mat.opacity = i === this.hoveredIndex ? 1 : 0.92
				}
			}
		}
	}

	private onPointerLeave() {
		this.hoveredIndex = -1
		const mats = this.cube.material
		if (Array.isArray(mats)) {
			for (const mat of mats) {
				(mat as THREE.MeshBasicMaterial).opacity = 0.92
			}
		}
	}

	private onClick(event: MouseEvent) {
		event.stopPropagation()
		event.preventDefault()

		const rect = this.canvas.getBoundingClientRect()
		this.pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		)

		this.raycaster.setFromCamera(this.pointer, this.camera)
		const hits = this.raycaster.intersectObject(this.cube, false)
		if (!hits.length || !hits[0].face) return

		const index = hits[0].face.materialIndex
		const direction = FACE_DIRECTIONS[index]
		if (direction) {
			lookAtViewDirection(this.core, direction)
		}
	}

	dispose() {
		const idx = this.core.animationCallbacks.indexOf(this.updateCallback)
		if (idx >= 0) {
			this.core.animationCallbacks.splice(idx, 1)
		}

		this.canvas.removeEventListener('pointermove', this.onPointerMoveBound)
		this.canvas.removeEventListener('pointerleave', this.onPointerLeaveBound)
		this.canvas.removeEventListener('click', this.onClickBound)

		if (this.container.parentNode) {
			this.container.parentNode.removeChild(this.container)
		}

		const mats = this.cube.material
		if (Array.isArray(mats)) {
			for (const mat of mats) {
				(mat as THREE.MeshBasicMaterial).map?.dispose()
				;(mat as THREE.MeshBasicMaterial).dispose()
			}
		}
		this.cube.geometry.dispose()
		this.renderer.dispose()
	}
}
