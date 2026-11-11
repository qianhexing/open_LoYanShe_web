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

/**
 * 帖子/评论统一：只看 display_lang 与当前 UI 语种是否一致。
 * display_lang 由后端写入（有译文=目标语，无译文=原文语种）。
 */
export function contentNeedsTranslate(
  meta: ContentI18nFields | null | undefined,
  uiLang: string
): boolean {
  if (!meta) return false
  const displayLang = normalizeContentLang(meta.display_lang)
  const requestLang = normalizeContentLang(uiLang)
  return displayLang !== requestLang
}

/** 点译成功后统一回写 i18n 标记（帖子/评论共用） */
export function applyTranslateMeta(
  meta: ContentI18nFields,
  lang: string
): void {
  const next = normalizeContentLang(lang)
  meta.has_i18n = true
  meta.i18n_lang = next
  meta.display_lang = next
}

/** 翻译请求的原文语种：帖子/评论统一取 content_lang */
export function resolveSourceLang(
  meta: ContentI18nFields | null | undefined
): string | undefined {
  if (!meta) return undefined
  const raw = meta.content_lang || meta.lang
  if (raw == null || String(raw).trim() === '') return undefined
  return normalizeContentLang(raw)
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
    applyTranslateMeta,
    resolveSourceLang,
    ContentI18nPkType,
  }
}
