
  // stores/config.ts
import { defineStore } from 'pinia'

interface configState {
  loading: boolean
  editMode: boolean
}
export const useSceneStore = defineStore('scene', {
  state: ():configState => ({
    loading: false,
    editMode: false
  }),
  
  actions: {
    setLoading(loading: boolean) {
      this.loading = loading
    },
    setEditMode(editMode: boolean) {
      this.editMode = editMode
    }
  }
})