import { defineStore } from 'pinia'
interface ThemeColors {
  // 主色调（低饱和度粉色/紫色系）
  primary: string // 主色 链接颜色
  primaryHover: string
  primaryActive: string
  inverted: string // 反色

  // 辅助色
  secondary: string
  accent: string
  tertiary: string

  // 背景与卡片
  background: string
  surface: string
  card: string

  // 文字（深色但柔和）
  text: string
  textSecondary: string
  textInverted: string
  textSeat?: string // 占位色
  textBan?: string // 禁用色


  // 状态色（柔和版本）
  success: string
  warning: string
  error: string
  info: string

  // 边框与分割线
  border: string
  divider: string
}

interface Theme {
  name: string
  label: string
  colors: ThemeColors
}

interface ThemeState {
  currentTheme: string
  themes: Record<string, Theme>
  isCustomizing: boolean,
  themeCss: ThemeColors
}

// 默认主题配置
const defaultThemes = {
  light: {
    name: 'light',
    label: 'Light',
    colors: {
      // 主色调（低饱和度粉色/紫色系）
      primary: "#FF9EB5",       // 樱花粉（主按钮、重点）
      primaryHover: "#FFB3C6",  // 浅粉悬停
      primaryActive: "#FF85A2", // 深粉点击
      inverted: "#ffffff",       // 樱花粉（主按钮、重点）
  
      // 辅助色（柔和糖果色）
      secondary: "#A5D8FF",     // 淡蓝（次要按钮）
      accent: "#B5EAD7",       // 薄荷绿（高亮、标签）
      tertiary: "#FFDAC1",     // 蜜桃橙（点缀）
  
      // 背景与卡片（奶白色/浅灰粉）
      background: "#FFF9FB",   // 极浅粉白（整体背景）
      surface: "#FFF0F5",      // 淡粉白（卡片背景）
      card: "#FFFFFF",        // 纯白（卡片底色，带轻微阴影）
  
      // 文字（深色但柔和）
      text: "#5A3D4F",         // 紫灰色（主要文字）
      textSecondary: "#9B8A97",// 灰粉紫（次要文字）
      textInverted: "#FFFFFF", // 白色（深色背景上的文字）
      textSeat: "#FFFFFF", // 白色（深色背景上的文字）
      textBan: "#FFFFFF", // 白色（深色背景上的文字）
      // 状态色（柔和版本）
      success: "#B5EAD7",      // 薄荷绿（成功）
      warning: "#FFD700",      // 浅金黄（警告）
      error: "#df2343",        // 粉红色（错误）
      info: "#A5D8FF",         // 淡蓝（信息）
  
      // 边框与分割线
      border: "#FFD1DC",       // 浅粉边框
      divider: "#FFE5EE"       // 极浅粉分割线
    }
  }
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    currentTheme: 'light',
    themeCss: JSON.parse(JSON.stringify(defaultThemes)).light.colors,
    themes: JSON.parse(JSON.stringify(defaultThemes)), // 深拷贝默认主题
    isCustomizing: false
  }),
  
  actions: {
    setTheme(themeName: string) {
      this.currentTheme = themeName
      this.applyTheme()
      this.saveToLocalStorage()
    },
    
    updateCustomThemeColor(key: keyof ThemeColors, value: string) {
      if (Object.prototype.hasOwnProperty.call(this.themes.custom.colors, key)) {
        this.themes.custom.colors[key] = value
        if (this.currentTheme === 'custom') {
          this.applyTheme()
        }
      }
    },
    
    applyTheme() {
      const theme = this.themes[this.currentTheme]
      this.themeCss = theme.colors
      // biome-ignore lint: <理由>
      Object.entries(theme.colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--${key}-color`, value)
      })
    },
    
    saveToLocalStorage() {
      localStorage.setItem('theme', JSON.stringify({
        currentTheme: this.currentTheme,
        themes: this.themes
      }))
    },
    
    loadFromLocalStorage() {
      const saved = localStorage.getItem('theme')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          this.currentTheme = parsed.currentTheme || 'light'
          this.themes = { ...this.themes, ...parsed.themes }
          this.applyTheme()
        } catch (e) {
          console.error('Failed to parse saved theme', e)
        }
      }
    },
    
    resetCustomTheme() {
      // this.themes.custom.colors = {
      //   primary: '#3b82f6',
      //   secondary: '#10b981',
      //   background: '#ffffff',
      //   text: '#1f2937',
      //   card: '#f9fafb'
      // }
      if (this.currentTheme === 'custom') {
        this.applyTheme()
      }
    }
  }
})