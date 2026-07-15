export interface ARSceneConfig {
	id: number
	name: string
	mindUrl: string // MindAR 编译好的 .mind 文件地址
	targetIndex: number // .mind 文件中包含多个图时，指定使用哪一张（通常是0）
}

/**
 * MindAR 图像追踪目标（与 `a-scene` 的 mindar-image 配合）
 *
 * - `mindUrl`：用 Mind AR 「Image Targets Compiler」将识别图编成 `.mind`，部署为可访问 URL。
 *   取景框对准的必须是「与该图一致」的内容（纸质图 / 同图屏幕）。
 * - `previewImageUrl`：仅作缩略参考或可选 UI；不参与运行时追踪，可自行改成本地识别图的副本。
 */
export interface ImageTargetConfig {
	mindUrl: string
	previewImageUrl: string
	/** 单一 .mind 内多 Target 时使用，一般为 0 */
	targetIndex: number
	/** 可选标签，便于 UI 展示 */
	name?: string
}

/** MindAR 官方 Card 示例，作为默认识别图 */
export const DEFAULT_IMAGE_TARGET: ImageTargetConfig = {
	name: 'MindAR Card（默认）',
	mindUrl:
		'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind',
	previewImageUrl:
		'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png',
	targetIndex: 0
}

/**
 * 第二个槽位：请将 mindUrl / previewImageUrl 换成自建识别图；
 * 与默认相同的路径仅用于保证开箱可切换会话；可自行改为其他 .mind。
 */
export const ALT_IMAGE_TARGET: ImageTargetConfig = {
	name: '槽位 B（在 config.ts 绑定你的 .mind）',
	mindUrl:
		'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind',
	previewImageUrl:
		'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png',
	targetIndex: 0
}

/**
 * 场景 ID → 识别图 .mind。
 * 路线 A（`pages/scene/detail/ar/[id]`）用此配置做追踪，场景本体仍走 ThreeCore 完整加载。
 */
export const AR_SCENE_MAP: Record<number, ARSceneConfig> = {
	1: {
		id: 1,
		name: '示例场景',
		mindUrl: DEFAULT_IMAGE_TARGET.mindUrl,
		targetIndex: DEFAULT_IMAGE_TARGET.targetIndex
	}
	// 追加：`[sceneId]: { id, name, mindUrl, targetIndex }`
}

/**
 * 按场景 ID 取 MindAR 资源；无映射时用默认识别图（仍可打开任意场景做完整 3D + 追踪联调）
 */
export const getARConfig = (sceneId: number): ARSceneConfig => {
	const mapped = AR_SCENE_MAP[sceneId]
	if (mapped) return mapped
	return {
		id: sceneId,
		name: `场景 ${sceneId}`,
		mindUrl: DEFAULT_IMAGE_TARGET.mindUrl,
		targetIndex: DEFAULT_IMAGE_TARGET.targetIndex
	}
}
