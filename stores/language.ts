import { defineStore } from 'pinia'
import { useCookie } from '#app'

export const useLanguageStore = defineStore('language', {
  state: () => ({
    locale: 'zh' as 'zh' | 'en' | 'ja'
  }),
  actions: {
    setLocale(lang: 'zh' | 'en' | 'ja') {
      this.locale = lang
      console.log('设置语言', lang)
      const cookie = useCookie('i18n_redirected')
      cookie.value = lang
    },
    initLocale() {
      const cookie = useCookie<'zh' | 'en' | 'ja'>('i18n_redirected')
      if (cookie.value) {
        this.locale = cookie.value
      }
    }
  }
})
