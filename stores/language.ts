import { defineStore } from 'pinia'
import { useCookie } from '#app'

export type AppLocale = 'zh' | 'en' | 'ja'

/** 与壳侧约定、请求头 lang、localStorage 键一致 */
export const LANG_STORAGE_KEY = 'lang'

/** Nuxt i18n cookieKey，与 nuxt.config 保持一致 */
const I18N_COOKIE_KEY = 'i18n_redirected'

export function normalizeAppLocale(raw: unknown, fallback: AppLocale = 'zh'): AppLocale {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (!s) return fallback
  const base = s.split('-')[0] || s
  if (base === 'zh' || s.startsWith('zh')) return 'zh'
  if (base === 'en') return 'en'
  if (base === 'ja' || base === 'jp') return 'ja'
  return fallback
}

function readLocalStorageLang(): AppLocale | null {
  if (!import.meta.client || typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY)
    if (!raw) return null
    return normalizeAppLocale(raw)
  } catch {
    return null
  }
}

function writeLocalStorageLang(lang: AppLocale) {
  if (!import.meta.client || typeof window === 'undefined' || !window.localStorage) return
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

export const useLanguageStore = defineStore('language', {
  state: () => ({
    locale: 'zh' as AppLocale,
  }),
  actions: {
    setLocale(lang: AppLocale | string) {
      const next = normalizeAppLocale(lang)
      this.locale = next
      const cookie = useCookie(I18N_COOKIE_KEY)
      cookie.value = next
      // 壳侧 / 请求注入用 localStorage.lang（对齐 token 写法）
      writeLocalStorageLang(next)
    },
    /** 优先 localStorage（壳注入），其次 i18n cookie */
    initLocale() {
      const fromStorage = readLocalStorageLang()
      if (fromStorage) {
        this.locale = fromStorage
        const cookie = useCookie(I18N_COOKIE_KEY)
        if (cookie.value !== fromStorage) cookie.value = fromStorage
        return
      }
      const cookie = useCookie<AppLocale | string | null>(I18N_COOKIE_KEY)
      if (cookie.value) {
        this.locale = normalizeAppLocale(cookie.value)
        writeLocalStorageLang(this.locale)
      }
    },
  },
})
