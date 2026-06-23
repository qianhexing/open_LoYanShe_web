import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import type ThreeCore from '@/utils/threeCore'

export interface WallDrawCameraSnapshot {
	cameraType: 'perspective' | 'orthographic'
	position: THREE.Vector3
	target: THREE.Vector3
	fov?: number
	controlsEnabled: boolean
	enableRotate: boolean
	enablePan: boolean
	enableZoom: boolean
	minAzimuthAngle: number
	maxAzimuthAngle: number
	minPolarAngle: number
	maxPolarAngle: number
}

function asOrbitControls(core: ThreeCore): OrbitControls | null {
	const controls = core.controls
	if (!controls || !('enableRotate' in controls)) return null
	return controls as OrbitControls
}

export function captureWallDrawCameraSnapshot(core: ThreeCore): WallDrawCameraSnapshot {
	const controls = asOrbitControls(core)
	const cam = core.camera
	const fov =
		cam instanceof THREE.PerspectiveCamera ? cam.fov : undefined
	return {
		cameraType: core.options.cameraType ?? 'perspective',
		position: cam.position.clone(),
		target:
			controls && 'target' in controls
				? controls.target.clone()
				: new THREE.Vector3(),
		fov,
		controlsEnabled: controls?.enabled ?? true,
		enableRotate: controls?.enableRotate ?? true,
		enablePan: controls?.enablePan ?? true,
		enableZoom: controls?.enableZoom ?? true,
		minAzimuthAngle: controls?.minAzimuthAngle ?? Number.NEGATIVE_INFINITY,
		maxAzimuthAngle: controls?.maxAzimuthAngle ?? Number.POSITIVE_INFINITY,
		minPolarAngle: controls?.minPolarAngle ?? 0,
		maxPolarAngle: controls?.maxPolarAngle ?? Math.PI
	}
}

function lockTopViewControls(core: ThreeCore) {
	const controls = asOrbitControls(core)
	if (!controls) return
	const azimuth = controls.getAzimuthalAngle()
	controls.enableRotate = false
	controls.minPolarAngle = 0
	controls.maxPolarAngle = 0
	controls.minAzimuthAngle = azimuth
	controls.maxAzimuthAngle = azimuth
	controls.update()
}

/** 进入墙体绘制：正交顶视 + 锁定旋转（保留平移/缩放） */
export function applyWallDrawTopView(core: ThreeCore) {
	if (core.options.cameraType !== 'orthographic') {
		core.setCameraType('orthographic')
	}

	const controls = asOrbitControls(core)
	const target =
		controls && 'target' in controls
			? controls.target.clone()
			: new THREE.Vector3()
	const dist = Math.max(core.camera.position.distanceTo(target), 18)
	const position = target.clone().add(new THREE.Vector3(0, dist, 0))

	core.lookAtCameraState({ position, target }, 280, () => {
		lockTopViewControls(core)
	})
}

export function restoreWallDrawCamera(
	core: ThreeCore,
	snapshot: WallDrawCameraSnapshot
) {
	if (core.options.cameraType !== snapshot.cameraType) {
		core.setCameraType(snapshot.cameraType)
	}

	core.lookAtCameraState(
		{
			position: snapshot.position,
			target: snapshot.target,
			fov: snapshot.fov
		},
		0,
		() => {
			const controls = asOrbitControls(core)
			if (!controls) return
			controls.enabled = snapshot.controlsEnabled
			controls.enableRotate = snapshot.enableRotate
			controls.enablePan = snapshot.enablePan
			controls.enableZoom = snapshot.enableZoom
			controls.minAzimuthAngle = snapshot.minAzimuthAngle
			controls.maxAzimuthAngle = snapshot.maxAzimuthAngle
			controls.minPolarAngle = snapshot.minPolarAngle
			controls.maxPolarAngle = snapshot.maxPolarAngle
			controls.update()
		}
	)
}
