// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/**': {
        proxy: 'https://lolitalibrary.com/apiLolita/**'
      }
    },
    compressPublicAssets: true // 启动压缩
  },
  runtimeConfig: {
    public: {
      //这是后端API的baseUrl
      baseUrl: '/api'
    }
  },
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/seo',
    '@nuxt/ui',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt'
  ],
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
  },
  tailwindcss: {
    config: {
      theme: {
        extend: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
            // 您可以根据需要添加更多自定义颜色
          }
        }
      }
    }
  },
  devServer: {
    port: 3000
  },
})
