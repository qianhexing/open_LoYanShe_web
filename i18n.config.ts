export default defineI18nConfig(() => ({
	legacy: false,
	fallbackLocale: 'zh',
	/**
	 * locale JSON 使用扁平点分 key（如 "login.title"）。
	 * nuxt i18n 懒加载时 flatJson 不一定会展开，这里优先按完整 key 取值。
	 */
	messageResolver: (obj: unknown, path: string) => {
		if (obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, path)) {
			return (obj as Record<string, unknown>)[path]
		}
		if (obj == null) return null
		const parts = path.split('.')
		let cur: unknown = obj
		for (const key of parts) {
			if (cur == null || typeof cur !== 'object') return null
			cur = (cur as Record<string, unknown>)[key]
		}
		return cur ?? null
	},
}))
