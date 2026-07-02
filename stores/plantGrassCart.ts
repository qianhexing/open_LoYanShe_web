import { defineStore } from 'pinia'
import type { Library } from '@/types/api'
import { clampUserLibraryScore } from '@/utils/libraryScore'

const STORAGE_KEY = 'timepipe-plant-grass-cart'

/** 种草车内单条图鉴 */
export interface PlantGrassCartItem {
  library_id: number
  name: string
  cover?: string
  square_cover?: string
  library_type?: string
  library_price?: number
  shop_country?: number
  /** 种草评分 0–5（支持 0.5 步进；0 为未定） */
  score: number
}

export function libraryToPlantGrassItem(lib: Library, score = 0): PlantGrassCartItem {
  const ext = lib as Library & { square_cover?: string }
  return {
    library_id: lib.library_id,
    name: lib.name,
    cover: lib.cover,
    square_cover: ext.square_cover,
    library_type: lib.library_type,
    library_price: lib.library_price,
    shop_country: lib.shop_country,
    score,
  }
}

export const usePlantGrassCartStore = defineStore('plantGrassCart', {
  state: () => ({
    list: [] as PlantGrassCartItem[],
  }),

  getters: {
    count: (state) => state.list.length,
    hasLibrary: (state) => (libraryId: number) =>
      state.list.some((item) => item.library_id === libraryId),
  },

  actions: {
    loadFromStorage() {
      if (typeof window === 'undefined') return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as PlantGrassCartItem[]
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

    addFromLibrary(lib: Library) {
      if (this.hasLibrary(lib.library_id)) return false
      this.list.push(libraryToPlantGrassItem(lib))
      this.saveToStorage()
      return true
    },

    remove(libraryId: number) {
      const idx = this.list.findIndex((item) => item.library_id === libraryId)
      if (idx === -1) return false
      this.list.splice(idx, 1)
      this.saveToStorage()
      return true
    },

    setScore(libraryId: number, score: number) {
      const item = this.list.find((i) => i.library_id === libraryId)
      if (!item) return
      item.score = score <= 0 ? 0 : clampUserLibraryScore(score)
      this.saveToStorage()
    },

    clear() {
      this.list = []
      this.saveToStorage()
    },
  },
})
