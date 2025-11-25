export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    // 覆盖鸿蒙注入的 Rn 对象
    window.Rn = {
      getColorScheme() {
        return 'light'
      }
    }

    // 覆盖鸿蒙可能注入的 Harmony / HMService
    window.Harmony = window.Harmony ?? {}
    window.HMService = window.HMService ?? {}

    // 防止某些方法不存在导致报错
    for (const key in window.Harmony) {
      if (typeof window.Harmony[key] !== 'function') {
        window.Harmony[key] = () => null
      }
    }
  }
})