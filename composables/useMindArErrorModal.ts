/**
 * MindAR / A-Frame 调试页统一的错误弹窗状态（文案 + 是否打开）。
 */
export function useMindArErrorModal() {
	const dlgOpen = ref(false)
	const dlgTitle = ref('MindAR')
	const dlgKind = ref<'error' | 'warn'>('error')
	const dlgMessage = ref('')

	function showMindArAlert(
		message: string,
		options?: {
			title?: string
			/** error：红色标题；warn：琥珀色标题 */
			kind?: 'error' | 'warn'
		}
	) {
		const kind = options?.kind ?? 'error'
		dlgKind.value = kind
		dlgTitle.value =
			options?.title ??
			(kind === 'warn' ? 'MindAR · 提示' : 'MindAR · 错误')
		dlgMessage.value = message
		dlgOpen.value = true
		console.warn('[MindAR]', dlgTitle.value, message)
	}

	function closeMindArAlert() {
		dlgOpen.value = false
	}

	return {
		dlgOpen,
		dlgTitle,
		dlgMessage,
		dlgKind,
		showMindArAlert,
		closeMindArAlert
	}
}
