/** 场景 3D 画质设置（localStorage 持久化，切换预设后需刷新页面生效） */
export const SCENE_GRAPHICS_SETTINGS_KEY = 'sceneGraphicsSettings'

export type SceneGraphicsPreset = 'performance' | 'balanced' | 'high'

export interface SceneGraphicsSettings {
	preset: SceneGraphicsPreset
	antialias: boolean
	/** 相对设备 devicePixelRatio 的倍率 */
	pixelRatioScale: number
	/** 为 true 时在手机上沿用性能帽（关 AA、限制 DPR） */
	mobilePerfCap: boolean
}

export const DEFAULT_SCENE_GRAPHICS_PRESET: SceneGraphicsPreset = 'balanced'

const PRESET_VALUES: Record<
	SceneGraphicsPreset,
	Omit<SceneGraphicsSettings, 'preset'>
> = {
	performance: {
		antialias: false,
		pixelRatioScale: 0.75,
		mobilePerfCap: true
	},
	balanced: {
		antialias: false,
		pixelRatioScale: 1,
		mobilePerfCap: true
	},
	high: {
		antialias: true,
		pixelRatioScale: 1,
		mobilePerfCap: false
	}
}

export function settingsFromPreset(
	preset: SceneGraphicsPreset
): SceneGraphicsSettings {
	return { preset, ...PRESET_VALUES[preset] }
}

function isValidPreset(v: unknown): v is SceneGraphicsPreset {
	return v === 'performance' || v === 'balanced' || v === 'high'
}

export function normalizeSceneGraphicsSettings(
	raw: Partial<SceneGraphicsSettings> | null | undefined
): SceneGraphicsSettings {
	const preset = isValidPreset(raw?.preset)
		? raw.preset
		: DEFAULT_SCENE_GRAPHICS_PRESET
	return settingsFromPreset(preset)
}

export function loadSceneGraphicsSettings(): SceneGraphicsSettings {
	if (!import.meta.client || typeof localStorage === 'undefined') {
		return settingsFromPreset(DEFAULT_SCENE_GRAPHICS_PRESET)
	}
	try {
		const raw = localStorage.getItem(SCENE_GRAPHICS_SETTINGS_KEY)
		if (!raw) return settingsFromPreset(DEFAULT_SCENE_GRAPHICS_PRESET)
		return normalizeSceneGraphicsSettings(
			JSON.parse(raw) as Partial<SceneGraphicsSettings>
		)
	} catch {
		return settingsFromPreset(DEFAULT_SCENE_GRAPHICS_PRESET)
	}
}

export function saveSceneGraphicsSettings(
	settings: SceneGraphicsSettings
): void {
	if (!import.meta.client || typeof localStorage === 'undefined') return
	const normalized = normalizeSceneGraphicsSettings(settings)
	localStorage.setItem(
		SCENE_GRAPHICS_SETTINGS_KEY,
		JSON.stringify({ preset: normalized.preset })
	)
}

export function resolveRendererPixelRatio(
	settings: SceneGraphicsSettings,
	devicePixelRatio = typeof window !== 'undefined'
		? window.devicePixelRatio || 1
		: 1
): number {
	const base = devicePixelRatio * settings.pixelRatioScale
	if (settings.mobilePerfCap) {
		return Math.min(base, 2)
	}
	return Math.min(base, 3)
}
