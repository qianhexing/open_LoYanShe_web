import { defineStore } from 'pinia'

const STORAGE_KEY = 'qhx_image_compress_enabled'

export const useImageUploadStore = defineStore('imageUpload', {
  state: () => ({
    /** 开启后对全部图片统一压缩；关闭时原图直传（不解码、不经过 Canvas）。超过 10MB 仍由 ImagePicker 强制压缩 */
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
