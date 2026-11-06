import type { ContentI18nFields } from '@/types/api'
import {
  ContentI18nPkType,
  translateContent,
  type ContentI18nPkTypeValue,
  type ContentI18nTranslateResult,
} from '@/api/content_i18n'

/** 与后端 normalizePopularLang 大致对齐：en-US → en */
export function normalizeContentLang(raw: string | null | undefined, fallback = 'zh'): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (!s) return fallback
  const base = s.split('-')[0] || s
  if (base === 'zh' || s.startsWith('zh')) return 'zh'
  if (base === 'en') return 'en'
  if (base === 'ja' || base === 'jp') return 'ja'
  return base
}

/** 语种不一致且本次响应未覆盖译文 → 显示「翻译」 */
export function contentNeedsTranslate(
  meta: ContentI18nFields | null | undefined,
  uiLang: string
): boolean {
  if (!meta) return false
  const contentLang = normalizeContentLang(meta.content_lang || meta.lang)
  const requestLang = normalizeContentLang(uiLang)
  if (contentLang === requestLang) return false
  if (meta.has_i18n) return false
  return true
}

export function useContentTranslate() {
  const languageStore = useLanguageStore()
  const translating = ref(false)

  const uiLang = computed(() => normalizeContentLang(languageStore.locale))

  function needsTranslate(meta: ContentI18nFields | null | undefined) {
    return contentNeedsTranslate(meta, uiLang.value)
  }

  async function runTranslate(options: {
    pkType: ContentI18nPkTypeValue | number
    pkId: number
    force?: boolean
    sourceLang?: string
  }): Promise<ContentI18nTranslateResult | null> {
    const pkId = Number(options.pkId)
    if (!Number.isFinite(pkId) || pkId <= 0) return null
    if (translating.value) return null
    translating.value = true
    try {
      return await translateContent({
        pk_type: options.pkType,
        pk_id: pkId,
        lang: uiLang.value,
        force: options.force,
        source_lang: options.sourceLang,
      })
    } finally {
      translating.value = false
    }
  }

  return {
    uiLang,
    translating,
    needsTranslate,
    runTranslate,
    ContentI18nPkType,
  }
}
