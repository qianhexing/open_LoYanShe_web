/**
 * 旧版 WebView 缺少部分 ES2022/ES2021 API，依赖会报错。
 * - Array.prototype.at（Chromium &lt; 92）
 * - String.prototype.replaceAll（Chromium &lt; 85）
 * 需在其它客户端逻辑前加载。
 */

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type ReplaceValue = string | ((substring: string, ...args: string[]) => string)

export default defineNuxtPlugin({
  name: 'legacy-webview-polyfills',
  enforce: 'pre',
  setup() {
    if (typeof Array.prototype.at !== 'function') {
      Object.defineProperty(Array.prototype, 'at', {
        value(this: unknown[], index: number) {
          const len = this.length >>> 0
          const relativeIndex = Math.trunc(Number(index))
          const k = relativeIndex >= 0 ? relativeIndex : len + relativeIndex
          if (k < 0 || k >= len) return undefined
          return this[k]
        },
        writable: true,
        enumerable: false,
        configurable: true,
      })
    }

    if (typeof String.prototype.replaceAll !== 'function') {
      Object.defineProperty(String.prototype, 'replaceAll', {
        value(this: string, searchValue: string | RegExp, replaceValue: ReplaceValue) {
          const s = String(this)
          if (searchValue instanceof RegExp) {
            if (!searchValue.global) {
              throw new TypeError(
                'String.prototype.replaceAll called with a non-global RegExp argument',
              )
            }
            return s.replace(searchValue, replaceValue as never)
          }
          const search = String(searchValue)
          // 空字符串：在每两个 UTF-16 码元之间（及首尾）插入；与 (?=)/g 行为一致
          if (search === '') {
            return s.replace(/(?=)/g, replaceValue as never)
          }
          return s.replace(new RegExp(escapeRegExp(search), 'g'), replaceValue as never)
        },
        writable: true,
        enumerable: false,
        configurable: true,
      })
    }
  },
})
