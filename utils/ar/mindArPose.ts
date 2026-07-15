import * as THREE from 'three'

/**
 * MindAR Controller 位姿辅助（路线 A：只出矩阵，不渲染场景）。
 * 对齐 mind-ar 官方 `MindARThree` 的 postMatrix / 投影适配逻辑。
 */

/** 识别图尺寸 → 锚点后处理矩阵（把单位内容铺到 marker 上） */
export function buildMindArPostMatrix(
	markerWidth: number,
	markerHeight: number
): THREE.Matrix4 {
	const position = new THREE.Vector3(
		markerWidth / 2,
		markerWidth / 2 + (markerHeight - markerWidth) / 2,
		0
	)
	const quaternion = new THREE.Quaternion()
	const scale = new THREE.Vector3(markerWidth, markerWidth, markerWidth)
	return new THREE.Matrix4().compose(position, quaternion, scale)
}

/**
 * 将 MindAR `getProjectionMatrix()` 应用到 Three 透视相机，
 * 并按容器与视频显示比例校正 FOV（与官方 three.js 适配一致）。
 */
export function applyMindArProjectionToCamera(
	camera: THREE.PerspectiveCamera,
	projectionMatrix: number[] | Float32Array,
	opts: {
		containerWidth: number
		containerHeight: number
		videoWidth: number
		videoHeight: number
		controllerInputWidth: number
		controllerInputHeight: number
	}
): void {
	const {
		containerWidth,
		containerHeight,
		videoWidth,
		videoHeight,
		controllerInputWidth,
		controllerInputHeight
	} = opts
	if (containerWidth <= 0 || containerHeight <= 0) return

	const proj = projectionMatrix
	const containerRatio = containerWidth / containerHeight
	const inputRatio = controllerInputWidth / controllerInputHeight

	let inputAdjust: number
	if (inputRatio > containerRatio) {
		inputAdjust = videoWidth / controllerInputWidth
	} else {
		inputAdjust = videoHeight / controllerInputHeight
	}

	let videoDisplayHeight: number
	if (inputRatio > containerRatio) {
		videoDisplayHeight = containerHeight * inputAdjust
	} else {
		const videoDisplayWidth = containerWidth
		videoDisplayHeight =
			(videoDisplayWidth / controllerInputWidth) *
			controllerInputHeight *
			inputAdjust
	}

	const fovAdjust = containerHeight / Math.max(videoDisplayHeight, 1e-6)
	const fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI
	const near = proj[14] / (proj[10] - 1.0)
	const far = proj[14] / (proj[10] + 1.0)

	camera.fov = fov
	camera.near = near
	camera.far = far
	camera.aspect = containerWidth / containerHeight
	camera.updateProjectionMatrix()
}

/** 视频 object-fit: cover 式铺满容器（与 MindARThree.resize 一致） */
export function layoutMindArVideo(
	video: HTMLVideoElement,
	containerWidth: number,
	containerHeight: number
): void {
	const vw0 = video.videoWidth || video.width
	const vh0 = video.videoHeight || video.height
	if (!vw0 || !vh0 || !containerWidth || !containerHeight) return

	// MindAR InputLoader 用 video.width/height（HTML 属性）取帧，必须等于 videoWidth/Height
	syncMindArVideoIntrinsicSize(video)

	const videoRatio = vw0 / vh0
	const containerRatio = containerWidth / containerHeight
	let vw: number
	let vh: number
	if (videoRatio > containerRatio) {
		vh = containerHeight
		vw = vh * videoRatio
	} else {
		vw = containerWidth
		vh = vw / videoRatio
	}

	video.style.position = 'absolute'
	video.style.top = `${-(vh - containerHeight) / 2}px`
	video.style.left = `${-(vw - containerWidth) / 2}px`
	video.style.width = `${vw}px`
	video.style.height = `${vh}px`
	video.style.objectFit = 'cover'
	video.style.zIndex = '0'
}

/**
 * MindAR 官方 MindARThree 在 loadedmetadata 后会：
 * `video.setAttribute('width', video.videoWidth)` / height。
 * InputLoader.loadInput 使用 `input.width/height`（不是 videoWidth）画到检测 canvas；
 * 若不设置，常见为 0 或默认值，特征全空 → processDone 正常但永远 hit=0。
 */
export function syncMindArVideoIntrinsicSize(video: HTMLVideoElement): {
	ok: boolean
	attrWidth: number
	attrHeight: number
	videoWidth: number
	videoHeight: number
} {
	const videoWidth = video.videoWidth
	const videoHeight = video.videoHeight
	if (videoWidth > 0 && videoHeight > 0) {
		video.setAttribute('width', String(videoWidth))
		video.setAttribute('height', String(videoHeight))
		video.width = videoWidth
		video.height = videoHeight
	}
	return {
		ok: video.width === videoWidth && video.height === videoHeight && videoWidth > 0,
		attrWidth: video.width,
		attrHeight: video.height,
		videoWidth,
		videoHeight
	}
}

/** worldMatrix × postMatrix × contentScale → 写入锚点 Group */
export function composeMindArAnchorMatrix(
	worldMatrix: ArrayLike<number>,
	postMatrix: THREE.Matrix4,
	contentScale = 1,
	out = new THREE.Matrix4()
): THREE.Matrix4 {
	out.fromArray(worldMatrix as number[])
	out.multiply(postMatrix)
	if (contentScale !== 1) {
		out.multiply(new THREE.Matrix4().makeScale(contentScale, contentScale, contentScale))
	}
	return out
}
