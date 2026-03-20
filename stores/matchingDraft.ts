import { defineStore } from 'pinia'
import type { WardrobeClothes } from '@/types/api'

const STORAGE_KEY = 'matching-draft-clothes'

export const useMatchingDraftStore = defineStore('matchingDraft', {
  state: () => ({
    list: [] as WardrobeClothes[]
  }),

  getters: {
    count: (state) => state.list.length,
    hasClothes: (state) => (clothesId: number) =>
      state.list.some((item) => item.clothes_id === clothesId)
  },

  actions: {
    loadFromStorage() {
      if (typeof window === 'undefined') return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as WardrobeClothes[]
          this.list = Array.isArray(parsed) ? parsed : []
        }
      } catch {
        this.list = []
      }
    },

    saveToStorage() {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list))
      } catch {
        // ignore
      }
    },

    add(item: WardrobeClothes) {
      const id = item.clothes_id
      if (id == null || this.hasClothes(id)) return false
      this.list.push({ ...item })
      this.saveToStorage()
      return true
    },

    remove(clothesId: number) {
      const idx = this.list.findIndex((item) => item.clothes_id === clothesId)
      if (idx === -1) return false
      this.list.splice(idx, 1)
      this.saveToStorage()
      return true
    },

    clear() {
      this.list = []
      this.saveToStorage()
    }
  }
})
