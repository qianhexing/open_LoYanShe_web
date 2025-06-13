export default defineAppConfig({
  ui: {
    tokens: {
      primary: 'var(--primary-color)',
      background: 'var(--background-color)',
      text: 'var(--text-color)',
      gray: 'var(--gray-color)',
    },
    input: {
      // 修改 focus 状态的 ring 颜色（选中时的边框效果）
      ring: 'focus:ring-2 focus:ring-qhx-primary focus:ring-opacity-50',
      // 或者直接修改 border 颜色
      base: 'focus:border-qhx-primary',
    },
  }
})