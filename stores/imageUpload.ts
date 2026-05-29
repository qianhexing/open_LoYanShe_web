import { defineStore } from 'pinia'

const STORAGE_KEY = 'qhx_image_compress_enabled'

export const useImageUploadStore = defineStore('imageUpload', {
  state: () => ({
    /** 开启后对全部图片无差别压缩；关闭时仅压缩超过 2MB 的图片 */
    compressEnabled: false,
    hydrated: false,
  }),
  actions: {
    initFromLocalStorage() {
      if (this.hydrated || !import.meta.client) return
      try {
        const v = localStorage.getItem(STORAGE_KEY)
        if (v !== null) this.compressEnabled = v === '1'
      } catch {
        /* ignore */
      }
      this.hydrated = true
    },
    setCompressEnabled(enabled: boolean) {
      this.compressEnabled = enabled
      if (!import.meta.client) return
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
  },
})
